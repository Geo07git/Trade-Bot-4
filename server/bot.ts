import fs from 'fs';
import path from 'path';
import Binance from 'binance-api-node';
import { getAccountInfo } from './services/BinanceService';
import { journalService } from './services/JournalService';
import { runRealStrategyAnalysis, registerSymbolCooldown, getSymbolCooldown, calculateExitScore, calculateTradeQualityScore } from '../src/services/ml';
import { MarketOpportunity, SymbolPerformanceStat } from '../src/types';

function createBinanceClient(options: { apiKey?: string; apiSecret?: string; httpBase?: string }) {
  const binanceFactory = typeof Binance === 'function' 
    ? Binance 
    : (Binance as any)?.default;

  if (typeof binanceFactory !== 'function') {
    throw new Error('Librăria binance-api-node nu a putut fi instanțiată ca funcție.');
  }

  return binanceFactory(options);
}

const exchangeInfoCache = new Map<string, { stepSize: number; minQty: number; minNotional: number }>();

async function getSymbolFilters(client: any, symbol: string) {
  if (exchangeInfoCache.has(symbol)) {
    return exchangeInfoCache.get(symbol)!;
  }

  try {
    const info = await client.exchangeInfo();
    if (info && Array.isArray(info.symbols)) {
      for (const s of info.symbols) {
        if (!s || !s.symbol || !s.filters) continue;
        const lotSize = s.filters.find((f: any) => f.filterType === 'LOT_SIZE');
        const minNotional = s.filters.find((f: any) => f.filterType === 'MIN_NOTIONAL' || f.filterType === 'NOTIONAL');

        const stepSize = lotSize?.stepSize ? parseFloat(lotSize.stepSize) : 0.0001;
        const minQty = lotSize?.minQty ? parseFloat(lotSize.minQty) : 0.0001;
        const notional = minNotional?.minNotional || minNotional?.notional ? parseFloat(minNotional.minNotional || minNotional.notional) : 5.0;

        exchangeInfoCache.set(s.symbol, { stepSize, minQty, minNotional: notional });
      }
    }
    if (exchangeInfoCache.has(symbol)) {
      return exchangeInfoCache.get(symbol)!;
    }
  } catch (err: any) {
    console.warn(`Could not fetch exchangeInfo for ${symbol} from Binance (using default heuristics): ${err?.message || err}`);
  }

  let defaultStepSize = 0.0001;
  const symUpper = symbol.toUpperCase();
  if (symUpper.startsWith('BTC')) defaultStepSize = 0.00001;
  else if (symUpper.startsWith('ETH')) defaultStepSize = 0.0001;
  else if (symUpper.startsWith('DOGE') || symUpper.startsWith('PEPE') || symUpper.startsWith('TRX') || symUpper.startsWith('SEI') || symUpper.startsWith('FET')) defaultStepSize = 1.0;
  else if (symUpper.startsWith('SOL') || symUpper.startsWith('BNB') || symUpper.startsWith('LINK') || symUpper.startsWith('AVAX') || symUpper.startsWith('DOT') || symUpper.startsWith('APT') || symUpper.startsWith('DEXE')) defaultStepSize = 0.01;
  else if (symUpper.startsWith('XRP') || symUpper.startsWith('ADA') || symUpper.startsWith('SUI') || symUpper.startsWith('TON') || symUpper.startsWith('ARB') || symUpper.startsWith('OP') || symUpper.startsWith('FIL') || symUpper.startsWith('RENDER') || symUpper.startsWith('NEAR')) defaultStepSize = 0.1;

  const fallback = { stepSize: defaultStepSize, minQty: defaultStepSize, minNotional: 5.0 };
  exchangeInfoCache.set(symbol, fallback);
  return fallback;
}

function formatQuantityByStepSize(amount: number, stepSize: number): string {
  if (!stepSize || stepSize <= 0) return amount.toString();

  const stepStr = stepSize.toString();
  let precision = 0;
  if (stepStr.includes('.')) {
    precision = stepStr.split('.')[1].replace(/0+$/, '').length;
  }

  const steps = Math.floor((amount + 1e-12) / stepSize);
  const roundedQty = steps * stepSize;

  return roundedQty.toFixed(precision);
}

export function formatInTimezone(isoStr?: string, timeZone = 'Europe/Bucharest'): string {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(d);

    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    let hour = parts.find(p => p.type === 'hour')?.value;
    if (hour === '24') hour = '00';
    const minute = parts.find(p => p.type === 'minute')?.value;

    return `${year}-${month}-${day} ${hour}:${minute}`;
  } catch {
    return isoStr.replace('T', ' ').substring(0, 16);
  }
}

export interface WatchlistItem {
  symbol: string;
  price: number | null;
  signal: { action: 'BUY' | 'SELL' | 'HOLD'; prob: number } | null;
  active: boolean;
  opportunityScore?: number;
  rank?: number;
  isDynamic?: boolean;
}

export interface Position {
  symbol: string;
  amount: number;
  entryPrice: number;
  currentPrice: number;
}

export interface LogItem {
  time: string;
  message: string;
  type: 'info' | 'success' | 'warning';
  equity?: number;
}

export interface CompletedTrade {
  symbol: string;
  entryPrice: number;
  exitPrice: number;
  amount: number;
  pnl: number;
  pnlPercent: number;
  timestamp: string;
}

export interface ReportConfig {
  channels: {
    telegram: boolean;
    browser: boolean;
  };
  daily: {
    enabled: boolean;
    time: string;
  };
  weekly: {
    enabled: boolean;
    day: number;
    time: string;
  };
  monthly: {
    enabled: boolean;
  };
}

export interface SignalJournalEntry {
  id: string;
  timestamp: string;
  time: string;
  symbol: string;
  price: number;
  rfProb: number;
  metaProb: number;
  reversalScore: number;
  isReversal: boolean;
  reversalType?: 'bullish' | 'bearish';
  newsSentiment: string;
  finalAction: 'BUY' | 'SELL' | 'HOLD';
  vetoReason: string;
  explanation?: string[];
}

export interface BotState {
  autoTradingActive: boolean;
  circuitBreakerTriggered?: boolean;
  circuitBreakerReason?: string | null;
  balance: number;
  initialBalance: number;
  positionSizePercent?: number; // % of equity per position (e.g. 5%)
  stopLossPercent?: number; // % hard safety stop loss limit (e.g. 2.0%)
  watchlist: WatchlistItem[];
  marketOpportunities: MarketOpportunity[];
  symbolStats: Record<string, SymbolPerformanceStat>;
  dynamicWatchlistSize: number;
  lastScanAt: string | null;
  positions: Position[];
  logs: LogItem[];
  signalJournal: SignalJournalEntry[];
  tradeHistory: CompletedTrade[];
  reportConfig: ReportConfig;
  notificationProvider: 'telegram';
  discordWebhookUrl: string;
  telegramBotToken: string;
  telegramChatId: string;
  timezone: string;
  dataInterval: number; // in seconds
  analysisInterval: number; // in seconds
  maxLogs: number;
  apiKey: string;
  apiSecret: string;
  testnetApiKey?: string;
  testnetApiSecret?: string;
  binanceMode: 'testnet' | 'live' | 'paper';
  serverStartedAt: string;
  lastCheckAt: string;
  totalTradesExecuted: number;
}

const BASELINE_PRICES: Record<string, number> = {
  'BTC': 64230.00,
  'BTCUSDT': 64230.00,
  'ETH': 3450.00,
  'ETHUSDT': 3450.00,
  'SOL': 145.20,
  'SOLUSDT': 145.20,
  'BNB': 565.00,
  'BNBUSDT': 565.00,
  'XRP': 0.58,
  'XRPUSDT': 0.58,
  'ADA': 0.164,
  'ADAUSDT': 0.164,
  'LINK': 8.30,
  'LINKUSDT': 8.30,
  'AVAX': 6.30,
  'AVAXUSDT': 6.30,
  'DOGE': 0.069,
  'DOGEUSDT': 0.069,
  'SUI': 0.71,
  'SUIUSDT': 0.71,
  'NEAR': 1.80,
  'NEARUSDT': 1.80,
  'ATOM': 1.38,
  'ATOMUSDT': 1.38,
  'DEXE': 3.50,
  'DEXEUSDT': 3.50,
  'ACE': 0.092,
  'ACEUSDT': 0.092,
  'ZAMA': 0.053,
  'ZAMAUSDT': 0.053,
  'TON': 5.20,
  'TONUSDT': 5.20,
  'TRX': 0.13,
  'TRXUSDT': 0.13,
  'LTC': 46.00,
  'LTCUSDT': 46.00,
  'DOT': 4.80,
  'DOTUSDT': 4.80,
  'APT': 6.80,
  'APTUSDT': 6.80,
  'ARB': 0.55,
  'ARBUSDT': 0.55,
  'OP': 1.40,
  'OPUSDT': 1.40,
  'FIL': 3.90,
  'FILUSDT': 3.90,
  'INJ': 18.50,
  'INJUSDT': 18.50,
  'SEI': 0.32,
  'SEIUSDT': 0.32,
  'FET': 1.30,
  'FETUSDT': 1.30,
  'RENDER': 6.20,
  'RENDERUSDT': 6.20,
  'PEPE': 0.000009,
  'PEPEUSDT': 0.000009,
  'RIF': 0.08,
  'RIFUSDT': 0.08,
  'KORUB': 14.30,
  'KORUBUSDT': 14.30,
  'SHIB': 0.000017,
  'SHIBUSDT': 0.000017,
  'NVDA': 125.80,
  'AAPL': 224.50,
  'MSFT': 412.30,
  'TSLA': 187.40,
  'AMD': 164.20,
  'COIN': 210.50,
  'SPY': 540.20,
  'QQQ': 460.80,
};

function getFallbackBasePrice(symbol: string): number {
  let cleanSymbol = symbol.trim().toUpperCase();
  if (cleanSymbol.endsWith('SDT') && !cleanSymbol.endsWith('USDT')) {
    cleanSymbol = cleanSymbol.replace(/SDT$/, 'USDT');
  }

  if (BASELINE_PRICES[cleanSymbol] !== undefined) {
    return BASELINE_PRICES[cleanSymbol];
  }

  // Check base asset if ending with USDT
  if (cleanSymbol.endsWith('USDT')) {
    const baseAsset = cleanSymbol.replace(/USDT$/, '');
    if (BASELINE_PRICES[baseAsset] !== undefined) {
      return BASELINE_PRICES[baseAsset];
    }
  } else {
    if (BASELINE_PRICES[cleanSymbol + 'USDT'] !== undefined) {
      return BASELINE_PRICES[cleanSymbol + 'USDT'];
    }
  }

  let hash = 0;
  for (let i = 0; i < cleanSymbol.length; i++) {
    hash = cleanSymbol.charCodeAt(i) + ((hash << 5) - hash);
  }
  const absoluteHash = Math.abs(hash);
  // Return a realistic crypto price between $0.05 and $2.50 for unknown tokens
  return parseFloat((0.05 + (absoluteHash % 245) / 100).toFixed(4));
}

let batchPricesCache: { map: Map<string, number>; timestamp: number } | null = null;

async function fetchBatchPricesServer(): Promise<Map<string, number>> {
  if (batchPricesCache && (Date.now() - batchPricesCache.timestamp < 5000)) {
    return batchPricesCache.map;
  }

  const priceMap = new Map<string, number>();
  const endpoints = [
    'https://api.binance.com/api/v3/ticker/price',
    'https://api1.binance.com/api/v3/ticker/price',
    'https://api3.binance.com/api/v3/ticker/price',
    'https://data-api.binance.vision/api/v3/ticker/price'
  ];

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          for (const item of data) {
            const p = parseFloat(item.price);
            if (!isNaN(p) && p > 0) {
              priceMap.set(item.symbol, p);
            }
          }
          if (priceMap.size > 0) {
            batchPricesCache = { map: priceMap, timestamp: Date.now() };
            return priceMap;
          }
        }
      }
    } catch (err) {
      // try next endpoint
    }
  }

  if (batchPricesCache) return batchPricesCache.map;
  return priceMap;
}

async function fetchLivePriceServer(symbol: string): Promise<number | null> {
  let cleanSymbol = symbol.trim().toUpperCase();
  if (cleanSymbol.endsWith('SDT') && !cleanSymbol.endsWith('USDT')) {
    cleanSymbol = cleanSymbol.replace(/SDT$/, 'USDT');
  }

  const stocks = ['NVDA', 'AAPL', 'MSFT', 'TSLA', 'AMD', 'COIN', 'SPY', 'QQQ'];
  const querySymbol = (!cleanSymbol.endsWith('USDT') && !stocks.includes(cleanSymbol))
    ? `${cleanSymbol}USDT`
    : cleanSymbol;

  const batchMap = await fetchBatchPricesServer();
  if (batchMap.has(querySymbol)) {
    return batchMap.get(querySymbol)!;
  }
  if (batchMap.has(cleanSymbol)) {
    return batchMap.get(cleanSymbol)!;
  }

  // Fallback to baseline or deterministic price if external network is down or socket hangs
  return getFallbackBasePrice(querySymbol);
}

const serverSignalCache = new Map<string, { result: { action: 'BUY' | 'SELL' | 'HOLD'; prob: number; modelName: string; reason: string }; timestamp: number }>();
const realStrategyCache = new Map<string, { res: any; timestamp: number }>();

async function getCachedRealStrategyAnalysis(symbol: string): Promise<any> {
  const cleanSymbol = symbol.trim().toUpperCase();
  const cached = realStrategyCache.get(cleanSymbol);
  if (cached && (Date.now() - cached.timestamp < 180000)) { // 3-minute cache
    return cached.res;
  }

  try {
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('ML Strategy Timeout')), 25000));
    const res = await Promise.race([runRealStrategyAnalysis(cleanSymbol, 'rf'), timeoutPromise]);
    if (res) {
      realStrategyCache.set(cleanSymbol, { res, timestamp: Date.now() });
    }
    return res;
  } catch (err: any) {
    console.warn(`[ML Real Strategy Warning for ${cleanSymbol}]: ${err?.message || err}`);
    return null;
  }
}

async function generateSignalServer(symbol: string, currentPrice: number): Promise<{ action: 'BUY' | 'SELL' | 'HOLD'; prob: number; modelName: string; reason: string }> {
  const cleanSymbol = symbol.trim().toUpperCase();
  const cached = serverSignalCache.get(cleanSymbol);
  if (cached && (Date.now() - cached.timestamp < 180000)) { // 3-minute cache
    return cached.result;
  }

  try {
    const mlRes = await getCachedRealStrategyAnalysis(cleanSymbol);
    if (mlRes && mlRes.signal) {
      const result = {
        action: mlRes.signal as 'BUY' | 'SELL' | 'HOLD',
        prob: mlRes.probability,
        modelName: 'Random Forest Ensemble 2.0',
        reason: mlRes.explanation?.find((e: string) => e.includes('Semnal') || e.includes('Reversal')) || `Scor Composite AI: ${mlRes.probability}% (${mlRes.signal})`
      };
      serverSignalCache.set(cleanSymbol, { result, timestamp: Date.now() });
      return result;
    }
  } catch (err: any) {
    console.warn(`[ML Signal Server Warning] Could not run ML analysis for ${cleanSymbol}, using technical fallback: ${err?.message || err}`);
  }

  // Technical Fallback calculation
  try {
    const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${cleanSymbol}&interval=1h&limit=100`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length >= 30) {
        const closes = data.map((d: any) => parseFloat(d[4]));
        let gains = 0, losses = 0;
        for (let i = 1; i <= 14; i++) {
          const diff = closes[i] - closes[i - 1];
          if (diff >= 0) gains += diff;
          else losses -= diff;
        }
        let avgGain = gains / 14;
        let avgLoss = losses / 14;
        for (let i = 15; i < closes.length; i++) {
          const diff = closes[i] - closes[i - 1];
          const gain = diff > 0 ? diff : 0;
          const loss = diff < 0 ? -diff : 0;
          avgGain = (avgGain * 13 + gain) / 14;
          avgLoss = (avgLoss * 13 + loss) / 14;
        }
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        const rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + rs));

        const lastClose = closes[closes.length - 1];
        const prevClose = closes[closes.length - 2];
        const mom = ((lastClose - prevClose) / prevClose) * 100;

        let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
        let prob = 52;

        if (rsi < 48 || (rsi < 55 && mom > 0.3)) {
          action = 'BUY';
          prob = Math.min(92, Math.max(55, Math.round(58 + (50 - rsi) * 1.1 + Math.max(0, mom * 5))));
        } else if (rsi > 65) {
          action = 'SELL';
          prob = Math.min(90, Math.max(58, Math.round(60 + (rsi - 65) * 1.2)));
        }

        const fallbackRes = { action, prob, modelName: 'Technical Fallback (RSI+Mom)', reason: `RSI (${rsi.toFixed(1)}) | Mom (${mom.toFixed(2)}%)` };
        serverSignalCache.set(cleanSymbol, { result: fallbackRes, timestamp: Date.now() });
        return fallbackRes;
      }
    }
  } catch (err) {
    // Fallback below
  }

  return { 
    action: 'HOLD', 
    prob: 52, 
    modelName: 'Random Forest Ensemble', 
    reason: `Consolidare Piață (${cleanSymbol})` 
  };
}

async function sendWebhookServer(provider: 'discord' | 'telegram', urlOrToken: string, chatIdOrMessage: string, message?: string) {
  try {
    if (provider === 'discord' && urlOrToken) {
      await fetch(urlOrToken, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: chatIdOrMessage })
      });
    } else if (provider === 'telegram' && urlOrToken && chatIdOrMessage && message) {
      const url = `https://api.telegram.org/bot${urlOrToken}/sendMessage`;
      // Format Markdown bold syntax (** or *) into HTML <b> tags for rock-solid Telegram rendering
      const htmlText = message
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
        .replace(/\*(.*?)\*/g, '<b>$1</b>');

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          chat_id: chatIdOrMessage, 
          text: htmlText,
          parse_mode: 'HTML'
        })
      });

      if (!res.ok) {
        // Fallback send plain text if HTML parsing has any edge case
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            chat_id: chatIdOrMessage, 
            text: message 
          })
        });
      }
    }
  } catch (err) {
    console.error('Webhook error on server:', err);
  }
}

class ServerBotEngine {
  public state: BotState;
  private intervalTimer: NodeJS.Timeout | null = null;
  private secondsCounter = 0;
  private stateFilePath = path.join(process.cwd(), 'bot_state.json');
  private telegramOffset = 0;
  private isPollingTelegram = false;
  private webhookCleared = false;
  private isCheckingPrices = false;
  private isRunningML = false;

  constructor() {
    this.state = {
      autoTradingActive: true,
      balance: 100,
      initialBalance: 100,
      watchlist: [
        { symbol: 'BTCUSDT', price: null, signal: null, active: true },
        { symbol: 'ETHUSDT', price: null, signal: null, active: true },
        { symbol: 'BNBUSDT', price: null, signal: null, active: true },
        { symbol: 'SOLUSDT', price: null, signal: null, active: true },
        { symbol: 'XRPUSDT', price: null, signal: null, active: true },
        { symbol: 'DOGEUSDT', price: null, signal: null, active: true },
        { symbol: 'ADAUSDT', price: null, signal: null, active: true },
        { symbol: 'LINKUSDT', price: null, signal: null, active: true },
        { symbol: 'AVAXUSDT', price: null, signal: null, active: true },
        { symbol: 'SUIUSDT', price: null, signal: null, active: true },
        { symbol: 'TONUSDT', price: null, signal: null, active: true },
        { symbol: 'TRXUSDT', price: null, signal: null, active: true },
        { symbol: 'LTCUSDT', price: null, signal: null, active: true },
        { symbol: 'DOTUSDT', price: null, signal: null, active: true },
        { symbol: 'APTUSDT', price: null, signal: null, active: true },
        { symbol: 'ARBUSDT', price: null, signal: null, active: true },
        { symbol: 'OPUSDT', price: null, signal: null, active: true },
        { symbol: 'NEARUSDT', price: null, signal: null, active: true },
        { symbol: 'ATOMUSDT', price: null, signal: null, active: true },
        { symbol: 'FILUSDT', price: null, signal: null, active: true },
        { symbol: 'INJUSDT', price: null, signal: null, active: true },
        { symbol: 'SEIUSDT', price: null, signal: null, active: true },
        { symbol: 'FETUSDT', price: null, signal: null, active: true },
        { symbol: 'RENDERUSDT', price: null, signal: null, active: true },
        { symbol: 'PEPEUSDT', price: null, signal: null, active: true },
      ],
      marketOpportunities: [],
      symbolStats: {},
      dynamicWatchlistSize: 25,
      positionSizePercent: 5,
      stopLossPercent: 2.0,
      lastScanAt: null,
      positions: [],
      logs: [
        {
          time: new Date().toLocaleTimeString(),
          message: '🤖 Engine-ul de fundal Trade-Bot-2.0 (Scanare Oportunități Scalping) a fost inițializat pe server. Rulare 24/7 activă!',
          type: 'info'
        }
      ],
      signalJournal: [],
      tradeHistory: [],
      reportConfig: {
        channels: { telegram: true, browser: true },
        daily: { enabled: true, time: '21:00' },
        weekly: { enabled: true, day: 0, time: '21:00' },
        monthly: { enabled: true }
      },
      notificationProvider: 'telegram',
      discordWebhookUrl: '',
      telegramBotToken: '',
      telegramChatId: '',
      timezone: 'Europe/Bucharest',
      dataInterval: 10,
      analysisInterval: 30,
      maxLogs: 2500,
      serverStartedAt: new Date().toISOString(),
      apiKey: '',
      apiSecret: '',
      testnetApiKey: '',
      testnetApiSecret: '',
      binanceMode: 'paper',
      lastCheckAt: new Date().toISOString(),
      totalTradesExecuted: 0,
      circuitBreakerTriggered: false,
      circuitBreakerReason: null,
    };

    this.loadPersistedState();
    this.startBackgroundLoop();
  }

  private loadPersistedState() {
    try {
      if (fs.existsSync(this.stateFilePath)) {
        const raw = fs.readFileSync(this.stateFilePath, 'utf-8');
        const parsed = JSON.parse(raw);
        const defaultWatchlist = JSON.parse(JSON.stringify(this.state.watchlist));
        this.state = { ...this.state, ...parsed };
        
        if (!Array.isArray(this.state.marketOpportunities)) this.state.marketOpportunities = [];
        if (!this.state.symbolStats || typeof this.state.symbolStats !== 'object') this.state.symbolStats = {};
        if (!this.state.dynamicWatchlistSize) this.state.dynamicWatchlistSize = 25;
        if (!this.state.positionSizePercent) this.state.positionSizePercent = 5;
        if (!this.state.stopLossPercent) this.state.stopLossPercent = 2.0;

        // Ensure autoTradingActive defaults to false if not explicitly set
        if (this.state.autoTradingActive === undefined) {
          this.state.autoTradingActive = false;
        }

        // Default balance initialization if missing
        if (!this.state.balance && this.state.balance !== 0) {
          this.state.balance = 100;
        }
        if (!this.state.initialBalance && this.state.initialBalance !== 0) {
          this.state.initialBalance = this.state.balance || 100;
        }

        // Ensure arrays exist
        if (!Array.isArray(this.state.logs)) this.state.logs = [];
        if (!Array.isArray(this.state.signalJournal)) this.state.signalJournal = [];
        if (!Array.isArray(this.state.positions)) this.state.positions = [];
        if (!Array.isArray(this.state.tradeHistory)) this.state.tradeHistory = [];

        if (this.state.logs.length === 0) {
          const time = new Intl.DateTimeFormat('en-US', {
            timeZone: this.state.timezone || 'Europe/Bucharest',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
          }).format(new Date());
          this.state.logs.push({
            time,
            message: '[SERVICIU 24/7 🚀] Motorul de tranzacționare AI a fost pornit pe server. Se începe scanarea pieței.',
            type: 'info'
          });
        }

        // Merge missing symbols from default watchlist and ensure they are active
        for (const defaultItem of defaultWatchlist) {
          const existing = this.state.watchlist.find(item => item.symbol === defaultItem.symbol);
          if (!existing) {
            this.state.watchlist.push(defaultItem);
          } else {
            existing.active = true;
          }
        }
        console.log('[AI.TRADE Bot] State încărcat din bot_state.json pe server (AutoTrading:', this.state.autoTradingActive ? 'ACTIV' : 'OPRIT', ')');
      }
    } catch (e) {
      console.error('[AI.TRADE Bot] Eroare la citirea bot_state.json:', e);
    }
  }

  private saveTimer: NodeJS.Timeout | null = null;

  public savePersistedState(immediate = false) {
    if (immediate) {
      if (this.saveTimer) {
        clearTimeout(this.saveTimer);
        this.saveTimer = null;
      }
      try {
        fs.writeFileSync(this.stateFilePath, JSON.stringify(this.state));
      } catch (e) {
        console.error('[AI.TRADE Bot] Eroare la salvarea bot_state.json:', e);
      }
      return;
    }

    if (!this.saveTimer) {
      this.saveTimer = setTimeout(() => {
        this.saveTimer = null;
        try {
          fs.writeFileSync(this.stateFilePath, JSON.stringify(this.state));
        } catch (e) {
          console.error('[AI.TRADE Bot] Eroare la salvarea bot_state.json:', e);
        }
      }, 1500);
    }
  }

  public addLog(message: string, type: 'info' | 'success' | 'warning' = 'info', equity?: number) {
    const timeFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: this.state.timezone || 'Europe/Bucharest',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
    const time = timeFormatter.format(new Date());
    const limit = this.state.maxLogs || 2500;
    this.state.logs = [{ time, message, type, equity }, ...this.state.logs.slice(0, limit - 1)];
    this.savePersistedState(false);
  }

  public clearLogs() {
    this.state.logs = [];
    this.addLog('Logurile au fost șterse de utilizator.', 'info');
    this.savePersistedState();
  }

  public clearSignalJournal() {
    if (!this.state.signalJournal) this.state.signalJournal = [];
    this.state.signalJournal = [];
    this.addLog('Jurnalul de audit semnale a fost șters.', 'info');
    this.savePersistedState();
  }

  public checkCircuitBreaker(): boolean {
    const equity = this.calculateEquity();
    const initial = this.state.initialBalance || 100;
    const pnlPercent = ((equity - initial) / initial) * 100;

    // Ignore circuit breaker trigger if testnet/live account has negligible funds (< $1)
    if (this.state.binanceMode !== 'paper' && equity < 1) {
      return false;
    }

    // Profit milestone (+10%): Record milestone without changing fixed initial capital baseline
    if (pnlPercent >= 10.0) {
      this.addLog(`🎉 [MILESTONE +10%] Țintă de profit atinsă! Portofoliu: $${equity.toFixed(2)} (Initial: $${initial.toFixed(2)}).`, 'success', equity);
      this.sendNotification(`🎉 **[AI.TRADE Bot 24/7] Milestone +10% Profit Atins!**\nPortofoliu actual: $${equity.toFixed(2)} USDT.\nSistemul continuă tranzacționarea automată!`);
      this.savePersistedState();
      return false;
    }

    // Safety Stop (-15% severe drawdown): Pause auto-trading to protect user funds
    if (pnlPercent <= -15.0) {
      if (!this.state.circuitBreakerTriggered) {
        this.state.circuitBreakerTriggered = true;
        this.state.autoTradingActive = false;
        const reason = `🚨 Limita de siguranță -15% a fost atinsă! (PNL: ${pnlPercent.toFixed(2)}%, Equity: $${equity.toFixed(2)})`;
        this.state.circuitBreakerReason = reason;

        this.addLog(`[CIRCUIT BREAKER ACTIVAT] Auto-trading oprit automat pe server! Motiv: ${reason}`, 'warning', equity);

        const telegramMsg = `🚨 **[CIRCUIT BREAKER - PAUZĂ DE SIGURANȚĂ]**\n\n` +
          `Sistemul a detectat un drawdown de **${pnlPercent.toFixed(2)}%**.\n\n` +
          `• **Auto-Trading:** OPRIT AUTOMAT pentru protecția capitalului\n` +
          `• **Capital Curent:** $${equity.toFixed(2)} (Inițial: $${initial.toFixed(2)})\n\n` +
          `Poți reîncepe tranzacționarea din interfața web prin butonul 'PORNEȘTE Server 24/7'.`;

        this.sendNotification(telegramMsg);
        this.savePersistedState();
      }
      return true;
    }

    if (this.state.autoTradingActive) {
      this.state.circuitBreakerTriggered = false;
      this.state.circuitBreakerReason = null;
    }

    return !!this.state.circuitBreakerTriggered;
  }

  public resetCircuitBreaker() {
    this.state.circuitBreakerTriggered = false;
    this.state.circuitBreakerReason = null;
    this.state.autoTradingActive = true;
    this.addLog('[CIRCUIT BREAKER RESETAT] Circuit breaker eliberat. Auto-trading reluat.', 'info', this.calculateEquity());
    this.savePersistedState();
  }

  public updateConfig(newConfig: Partial<BotState>) {
    if (newConfig.autoTradingActive !== undefined) {
      this.state.autoTradingActive = newConfig.autoTradingActive;
      if (newConfig.autoTradingActive) {
        this.state.circuitBreakerTriggered = false;
        this.state.circuitBreakerReason = null;
      }
    }
    if (newConfig.circuitBreakerTriggered !== undefined) this.state.circuitBreakerTriggered = newConfig.circuitBreakerTriggered;
    if (newConfig.circuitBreakerReason !== undefined) this.state.circuitBreakerReason = newConfig.circuitBreakerReason;
    if (newConfig.notificationProvider !== undefined) this.state.notificationProvider = newConfig.notificationProvider;
    if (newConfig.discordWebhookUrl !== undefined) this.state.discordWebhookUrl = newConfig.discordWebhookUrl;
    if (newConfig.telegramBotToken !== undefined) this.state.telegramBotToken = newConfig.telegramBotToken;
    if (newConfig.telegramChatId !== undefined) this.state.telegramChatId = newConfig.telegramChatId;
    if (newConfig.timezone !== undefined) this.state.timezone = newConfig.timezone;
    if (newConfig.dataInterval !== undefined) this.state.dataInterval = newConfig.dataInterval;
    if (newConfig.analysisInterval !== undefined) this.state.analysisInterval = newConfig.analysisInterval;
    if (newConfig.positionSizePercent !== undefined) this.state.positionSizePercent = Math.max(1, Math.min(50, Number(newConfig.positionSizePercent)));
    if (newConfig.stopLossPercent !== undefined) this.state.stopLossPercent = Math.max(0.5, Math.min(20, Number(newConfig.stopLossPercent)));
    if (newConfig.maxLogs !== undefined) {
      this.state.maxLogs = newConfig.maxLogs;
      if (this.state.logs.length > newConfig.maxLogs) {
        this.state.logs = this.state.logs.slice(0, newConfig.maxLogs);
      }
      if (this.state.signalJournal && this.state.signalJournal.length > newConfig.maxLogs) {
        this.state.signalJournal = this.state.signalJournal.slice(0, newConfig.maxLogs);
      }
    }
    if (newConfig.watchlist !== undefined) this.state.watchlist = newConfig.watchlist;
    if (newConfig.initialBalance !== undefined) this.state.initialBalance = newConfig.initialBalance;
    if (newConfig.balance !== undefined) {
      this.state.balance = newConfig.balance;
      if (!this.state.initialBalance && this.state.initialBalance !== 0) {
        this.state.initialBalance = newConfig.balance;
      }
    }
    if (newConfig.reportConfig !== undefined) this.state.reportConfig = { ...this.state.reportConfig, ...newConfig.reportConfig };
    if (newConfig.apiKey !== undefined) this.state.apiKey = newConfig.apiKey;
    if (newConfig.apiSecret !== undefined) this.state.apiSecret = newConfig.apiSecret;
    if (newConfig.testnetApiKey !== undefined) this.state.testnetApiKey = newConfig.testnetApiKey;
    if (newConfig.testnetApiSecret !== undefined) this.state.testnetApiSecret = newConfig.testnetApiSecret;
    
    // Switch binance mode and auto-reset circuit breaker
    if (newConfig.binanceMode !== undefined) {
      this.state.binanceMode = newConfig.binanceMode;
      this.state.circuitBreakerTriggered = false;
      this.state.circuitBreakerReason = null;
      this.state.autoTradingActive = true;
    }

    this.savePersistedState();

    if (
      newConfig.binanceMode !== undefined ||
      newConfig.apiKey !== undefined ||
      newConfig.apiSecret !== undefined ||
      newConfig.testnetApiKey !== undefined ||
      newConfig.testnetApiSecret !== undefined
    ) {
      setTimeout(() => {
        this.syncBinanceBalance().catch(() => {});
      }, 300);
    }
  }

  public async syncBinanceBalance() {
    if (this.state.binanceMode === 'paper') {
      return { success: true, mode: 'paper', balance: this.state.balance };
    }

    const mode = this.state.binanceMode;
    const apiKey = (mode === 'testnet'
      ? (this.state.testnetApiKey || this.state.apiKey)
      : this.state.apiKey)?.trim();
    const apiSecret = (mode === 'testnet'
      ? (this.state.testnetApiSecret || this.state.apiSecret)
      : this.state.apiSecret)?.trim();

    if (!apiKey || !apiSecret) {
      this.addLog(`[BINANCE ${mode.toUpperCase()}] Cheile API pentru ${mode} nu sunt configurate în Setări.`, 'warning');
      return { success: false, error: 'API keys missing' };
    }

    try {
      const account = await getAccountInfo({ apiKey, apiSecret, mode });
      if (account && account.balances) {
        const usdtAsset = account.balances.find((b: any) => b.asset === 'USDT');
        if (usdtAsset) {
          const freeUsdt = parseFloat(usdtAsset.free) || 0;
          const lockedUsdt = parseFloat(usdtAsset.locked) || 0;
          const totalUsdt = freeUsdt + lockedUsdt;

          if (mode === 'testnet' && freeUsdt < 10) {
            // Testnet account on Binance has negligible funds (< $10 USDT, e.g. 0.009 USDT)
            const fallbackBalance = (this.state.balance && this.state.balance >= 10) 
              ? this.state.balance 
              : (this.state.initialBalance && this.state.initialBalance >= 10 ? this.state.initialBalance : 300);

            this.state.balance = fallbackBalance;
            if (!this.state.initialBalance || this.state.initialBalance < 10) {
              this.state.initialBalance = fallbackBalance;
            }
            if (this.state.circuitBreakerTriggered) {
              this.state.circuitBreakerTriggered = false;
              this.state.circuitBreakerReason = null;
              this.state.autoTradingActive = true;
            }

            this.addLog(
              `[BINANCE TESTNET] Conexiune API reuşită! Contul de pe testnet.binance.vision are $${freeUsdt.toFixed(3)} USDT. A fost stabilită o balanţă de lucru de $${fallbackBalance.toFixed(2)} USDT pentru execuţie. Poţi re-încărca Faucet-ul oficial pe testnet.binance.vision sau folosi "Adaugă Fonduri".`,
              'info'
            );
            this.savePersistedState();
            return { success: true, balance: fallbackBalance, total: fallbackBalance, lowTestnetBalance: true };
          }

          this.state.balance = freeUsdt;
          if (!this.state.initialBalance && this.state.initialBalance !== 0) {
            this.state.initialBalance = totalUsdt > 0 ? totalUsdt : (freeUsdt || 100);
          }
          if (this.state.circuitBreakerTriggered && freeUsdt > 0) {
            this.state.circuitBreakerTriggered = false;
            this.state.circuitBreakerReason = null;
            this.state.autoTradingActive = true;
          }

          this.addLog(
            `[BINANCE ${mode.toUpperCase()}] Sincronizare reuşită! Balanţă liberă: $${freeUsdt.toLocaleString('en-US', {minimumFractionDigits: 2})} USDT (Total cont: $${totalUsdt.toLocaleString('en-US', {minimumFractionDigits: 2})}).`,
            'success'
          );
          this.savePersistedState();
          return { success: true, balance: freeUsdt, total: totalUsdt };
        } else {
          this.addLog(`[BINANCE ${mode.toUpperCase()}] S-a realizat conexiunea, dar activul USDT nu s-a găsit în balanțe.`, 'warning');
        }
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      console.warn(`[BINANCE ${mode.toUpperCase()}] Could not sync balance: ${errMsg}`);
      this.addLog(`[BINANCE ${mode.toUpperCase()}] Eroare la sincronizarea balanței: ${errMsg}`, 'warning');
      
      if (mode === 'testnet') {
        const fallbackBalance = (this.state.balance && this.state.balance >= 10) 
          ? this.state.balance 
          : (this.state.initialBalance && this.state.initialBalance >= 10 ? this.state.initialBalance : 300);
        this.state.balance = fallbackBalance;
        if (!this.state.initialBalance || this.state.initialBalance < 10) {
          this.state.initialBalance = fallbackBalance;
        }
        this.addLog(
          `[BINANCE TESTNET] Cheile API de testnet sunt invalide sau restricționate (${errMsg}). S-a activat soldul de simulare $${fallbackBalance.toFixed(2)} USDT. Puteți genera chei noi pe testnet.binance.vision sau treceți în modul Paper Trading.`,
          'info'
        );
        this.savePersistedState();
        return { success: false, error: errMsg, balance: fallbackBalance, fallback: true };
      }

      return { success: false, error: errMsg };
    }

    return { success: false, error: 'Unknown sync error' };
  }

  public resetPortfolio(newBalance = 100) {
    this.state.balance = newBalance;
    this.state.initialBalance = newBalance;
    this.state.positions = [];
    this.state.logs = [];
    this.state.circuitBreakerTriggered = false;
    this.state.circuitBreakerReason = null;
    this.addLog(`Portofoliu resetat la $${newBalance} pe server.`, 'warning');
    this.savePersistedState();
  }

  public addFunds(addedAmount: number) {
    if (isNaN(addedAmount) || addedAmount <= 0) return;
    this.state.balance = (this.state.balance || 0) + addedAmount;
    this.state.initialBalance = (this.state.initialBalance || 0) + addedAmount;
    this.addLog(`➕ Depunere/Adăugare fonduri: +$${addedAmount.toFixed(2)} USDT adăugați în balanță. Noul sold: $${this.state.balance.toFixed(2)} USDT.`, 'info');
    this.sendNotification(`💰 **[Adăugare Fonduri]**\nS-au adăugat $${addedAmount.toFixed(2)} USDT în balanța activă.\nNoul Sold: $${this.state.balance.toFixed(2)} USDT`);
    this.savePersistedState();
  }

  public async sendTelegramCommandGuide(chatId?: string, pin = true) {
    const targetChatId = chatId || this.state.telegramChatId;
    if (!this.state.telegramBotToken || !targetChatId) {
      return { success: false, error: 'Token-ul Telegram Bot sau Chat ID nu sunt configurate.' };
    }

    const guideText = 
      `📌 <b>GHID & LISTĂ COMENZI BOT AI.TRADE 24/7</b>\n` +
      `<i>Păstrează sau fixează (Pin) acest mesaj în chat pentru acces rapid!</i>\n\n` +
      `<b>📊 Interogare & Stare:</b>\n` +
      `• <b>/portofoliu</b> sau <b>/portofolio</b> - Capital, equity & performanță PnL\n` +
      `• <b>/stare</b> sau <b>/status</b> - Stare sistem, modul active & circuit breaker\n` +
      `• <b>/pozitii</b> sau <b>/positions</b> - Poziții deschise curente & PnL\n` +
      `• <b>/jurnal</b> sau <b>/tranzactii</b> - Ultima istorie de tranzacționare\n\n` +
      `<b>⚙️ Control Execuție Automată:</b>\n` +
      `• <b>/pauza</b> sau <b>/pause</b> - Oprește temporar tranzacționarea automată\n` +
      `• <b>/porneste</b> sau <b>/resume</b> - Repornește tranzacționarea automată\n\n` +
      `<b>🛒 Tranzacționare Manuală Directă:</b>\n` +
      `• <b>/cumpara [SIMBOL] [CANTITATE]</b>\n` +
      `  <i>Exemplu:</i> <code>/cumpara BTCUSDT 0.005</code>\n` +
      `• <b>/vinde [SIMBOL] [CANTITATE]</b>\n` +
      `  <i>Exemplu:</i> <code>/vinde BTCUSDT 0.005</code>\n\n` +
      `<b>ℹ️ Ajutor:</b>\n` +
      `• <b>/ajutor</b>, <b>/help</b>, <b>/comenzi</b> sau <b>/ghid</b> - Trimite din nou această listă.\n\n` +
      `💡 <i>Sfat: Apasă lung pe acest mesaj și selectează <b>Pin / Fixează</b> pentru a-l avea permanent la începutul conversației!</i>`;

    try {
      const sendUrl = `https://api.telegram.org/bot${this.state.telegramBotToken}/sendMessage`;
      const res = await fetch(sendUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: targetChatId,
          text: guideText,
          parse_mode: 'HTML'
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        return { success: false, error: errJson.description || 'Eroare la trimitere pe Telegram.' };
      }

      const data = await res.json();
      const messageId = data?.result?.message_id;

      if (pin && messageId) {
        try {
          const pinUrl = `https://api.telegram.org/bot${this.state.telegramBotToken}/pinChatMessage`;
          await fetch(pinUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: targetChatId,
              message_id: messageId,
              disable_notification: false
            })
          });
        } catch (pinErr) {
          // Non-blocking if bot lacks pin permission
        }
      }

      this.addLog('[TELEGRAM] Ghidul de comenzi a fost trimis pe Telegram cu succes!', 'info');
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Eroare conexiune Telegram' };
    }
  }

  private sendNotification(message: string) {
    if (this.state.discordWebhookUrl) {
      sendWebhookServer('discord', this.state.discordWebhookUrl, message);
    }
    if (this.state.telegramBotToken && this.state.telegramChatId) {
      sendWebhookServer('telegram', this.state.telegramBotToken, this.state.telegramChatId, message);
    }
  }

  private async pollTelegramMessages() {
    if (!this.state.telegramBotToken || this.isPollingTelegram) return;
    this.isPollingTelegram = true;

    try {
      const url = `https://api.telegram.org/bot${this.state.telegramBotToken}/getUpdates?offset=${this.telegramOffset}&timeout=0`;
      const res = await fetch(url);
      
      if (!res.ok) {
        const errText = await res.text();
        if (res.status === 409) {
          if (!this.webhookCleared) {
            this.webhookCleared = true;
            console.log('[Telegram Bot] Removing webhook to resolve 409 conflict...');
            await fetch(`https://api.telegram.org/bot${this.state.telegramBotToken}/deleteWebhook`);
          }
        } else {
          console.warn(`[Telegram Polling Warning] HTTP ${res.status}: ${errText}`);
        }
        return;
      }

      // Reset webhook cleared flag on successful poll
      this.webhookCleared = false;

      const data = await res.json();
      if (data.ok && Array.isArray(data.result) && data.result.length > 0) {
        for (const update of data.result) {
          this.telegramOffset = update.update_id + 1;
          
          if (update.message && update.message.text) {
            const text = update.message.text.trim();
            const chatId = update.message.chat.id.toString();

            // Auto-update/bind telegramChatId if empty or different so user gets alerts & replies
            if (this.state.telegramChatId !== chatId) {
              this.state.telegramChatId = chatId;
              this.savePersistedState();
              console.log(`[Telegram Bot] Updated active telegramChatId to ${chatId}`);
            }

            await this.handleTelegramCommand(text, chatId);
          }
        }
      }
    } catch (e: any) {
      // Catch transient network error
    } finally {
      this.isPollingTelegram = false;
    }
  }

  private async handleTelegramCommand(fullCommand: string, chatId: string) {
    const parts = fullCommand.trim().split(/\s+/);
    if (parts.length === 0) return;

    // Handle bot tags in group chats, e.g. /position@MyBot -> /position
    const cmd = parts[0].split('@')[0].toLowerCase();
    let reply = '';
    
    switch (cmd) {
      case '/start':
      case '/help':
      case '/ajutor':
      case '/comenzi':
      case '/ghid':
      case '/guide':
        await this.sendTelegramCommandGuide(chatId, true);
        return;

      case '/status':
      case '/state':
      case '/stare': {
        const equity = this.calculateEquity();
        const profit = equity - this.state.initialBalance;
        const profitSign = profit >= 0 ? '+' : '';
        const activePositions = this.state.positions.map(p => `${p.symbol} (${p.amount})`).join(', ') || 'Niciuna';
        const cbStatus = this.state.circuitBreakerTriggered 
          ? '🚨 ACTIVAT (Pauză de protecție)' 
          : '🟢 ACTIV (Monitorizare activă)';
        
        reply = `<b>📊 AI Trading Bot Status Server 24/7</b>\n\n` +
                `<b>Capital total (Equity):</b> $${equity.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}\n` +
                `<b>Profit total:</b> ${profitSign}$${profit.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}\n` +
                `<b>Mod de operare:</b> ${this.state.binanceMode.toUpperCase()}\n` +
                `<b>Status Auto-Trading:</b> ${this.state.autoTradingActive ? '✅ ACTIV' : '⏸️ OPRIT'}\n` +
                `<b>Circuit Breaker:</b> ${cbStatus}\n` +
                `<b>Poziții deschise:</b> ${activePositions}`;
        break;
      }

      case '/portfolio':
      case '/portofolio':
      case '/portofoliu':
      case '/performance':
      case '/balance':
      case '/bal':
      case '/capital': {
        const equity = this.calculateEquity();
        const pnl = equity - this.state.initialBalance;
        const pnlPct = ((pnl / this.state.initialBalance) * 100).toFixed(2);
        
        reply = `<b>📈 Performanță Portofoliu</b>\n\n` +
                `• Capital Inițial: $${this.state.initialBalance.toFixed(2)}\n` +
                `• Capital Curent: $${equity.toFixed(2)}\n` +
                `• Balanță Liberă (Cash): $${this.state.balance.toFixed(2)}\n` +
                `• Profit / Pierdere: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} (${pnl >= 0 ? '+' : ''}${pnlPct}%)\n` +
                `• Tranzacții Executate: ${this.state.totalTradesExecuted || 0}`;
        break;
      }

      case '/position':
      case '/positions':
      case '/pozitie':
      case '/pozitii':
      case '/pos': {
        if (this.state.positions.length === 0) {
          reply = '<b>ℹ️ Nicio poziție deschisă în prezent.</b>';
        } else {
          reply = `<b>📌 Poziții Deschise (${this.state.positions.length}):</b>\n\n` + 
            this.state.positions.map(p => {
              const currentVal = p.amount * (p.currentPrice || p.entryPrice);
              const pnlVal = ((p.currentPrice || p.entryPrice) - p.entryPrice) * p.amount;
              const pnlPct = (((p.currentPrice || p.entryPrice) - p.entryPrice) / p.entryPrice) * 100;
              const sign = pnlVal >= 0 ? '+' : '';
              return `• <b>${p.symbol}</b>: ${p.amount} buc @ $${p.entryPrice.toFixed(2)}\n  Preț Curent: $${(p.currentPrice || p.entryPrice).toFixed(2)} | Valoare: $${currentVal.toFixed(2)}\n  PnL: ${sign}$${pnlVal.toFixed(2)} (${sign}${pnlPct.toFixed(2)}%)`;
            }).join('\n\n');
        }
        break;
      }

      case '/journal':
      case '/jurnal':
      case '/trades':
      case '/tranzactii':
      case '/history':
      case '/istoric': {
        const recentEntries = journalService.getEntries().slice(0, 5);
        if (recentEntries.length === 0) {
          reply = '<b>Jurnal de tranzacții gol. Nicio tranzacție înregistrată încă.</b>';
        } else {
          reply = `<b>📖 Ultimele ${recentEntries.length} Tranzacții din Jurnal:</b>\n\n` +
            recentEntries.map(t => {
              const pnlStr = t.action === 'SELL' ? ` | PnL: ${t.pnl >= 0 ? '+' : ''}$${t.pnl.toFixed(2)} (${t.pnlPercent >= 0 ? '+' : ''}${t.pnlPercent.toFixed(2)}%)` : '';
              return `• <b>${t.action === 'BUY' ? '🟢 BUY' : '🔴 SELL'} ${t.symbol}</b> @ $${t.price.toFixed(2)}\n  Quantitate: ${t.amount} | Model: ${t.modelName} (${t.mlProbability}% prob)${pnlStr}\n  Dată: ${formatInTimezone(t.timestamp, this.state.timezone || 'Europe/Bucharest')}`;
            }).join('\n\n');
        }
        break;
      }

      case '/pause':
      case '/stop':
      case '/pauza':
        this.state.autoTradingActive = false;
        this.savePersistedState();
        reply = '⏸️ <b>Auto-Trading Oprit</b>\nBotul server 24/7 nu va mai executa ordine automate.';
        break;

      case '/resume':
      case '/start_bot':
      case '/porneste':
        this.state.autoTradingActive = true;
        this.state.circuitBreakerTriggered = false;
        this.state.circuitBreakerReason = null;
        this.savePersistedState();
        reply = '▶️ <b>Auto-Trading Pornit & Resetat</b>\nBotul 24/7 rulează activ pe server și scanează piața.';
        break;

      case '/reset':
      case '/resetare':
      case '/reporneste':
        const targetResetAmt = this.state.initialBalance || 300;
        this.resetPortfolio(targetResetAmt);
        this.state.autoTradingActive = true;
        this.savePersistedState();
        reply = `🔄 <b>Portofoliu & Bot Resetate cu Succes!</b>\nCapitalul virtual este de $${targetResetAmt} USDT, iar auto-tradingul rulează activ.`;
        break;

      case '/buy':
      case '/cumpara': {
        if (parts.length < 3) {
          reply = '⚠️ Format incorect. Folosește: <code>/buy SYMBOL CANTITATE</code> (ex: <code>/buy BTCUSDT 0.005</code>)';
          break;
        }
        const sym = parts[1].toUpperCase();
        const qty = parseFloat(parts[2]);
        if (isNaN(qty) || qty <= 0) {
          reply = '⚠️ Cantitate invalidă.';
          break;
        }
        
        const item = this.state.watchlist.find(w => w.symbol === sym);
        const price = item?.price || 0;
        if (price <= 0) {
          reply = `⚠️ Nu am putut obține prețul curent pentru ${sym}. Se va încerca executarea.`;
        }

        await this.executeTrade(sym, 'BUY', price > 0 ? price : 100, qty, {
          mlProbability: 85,
          modelName: 'Manual Telegram Command',
          entryReason: 'Ordin lansat manual din Telegram'
        });
        reply = `✅ Ordin de CUMPĂRARE transmis pentru ${qty} ${sym}.`;
        break;
      }

      case '/sell':
      case '/vinde': {
        if (parts.length < 3) {
          reply = '⚠️ Format incorect. Folosește: <code>/sell SYMBOL CANTITATE</code> (ex: <code>/sell BTCUSDT 0.005</code>)';
          break;
        }
        const sym = parts[1].toUpperCase();
        const qty = parseFloat(parts[2]);
        if (isNaN(qty) || qty <= 0) {
          reply = '⚠️ Cantitate invalidă.';
          break;
        }

        const item = this.state.watchlist.find(w => w.symbol === sym);
        const price = item?.price || 0;

        await this.executeTrade(sym, 'SELL', price > 0 ? price : 100, qty, {
          mlProbability: 85,
          modelName: 'Manual Telegram Command',
          entryReason: 'Ordin lansat manual din Telegram'
        });
        reply = `✅ Ordin de VÂNZARE transmis pentru ${qty} ${sym}.`;
        break;
      }

      default:
        reply = `🤖 <b>Comandă recunoscută.</b>\nSintaxă primită: <code>${cmd}</code>\nFolosește /help sau /ajutor pentru lista de comenzi.`;
        break;
    }
    
    await sendWebhookServer('telegram', this.state.telegramBotToken, chatId, reply);
  }

  public async executeTrade(
    symbol: string, 
    action: 'BUY' | 'SELL', 
    price: number, 
    amount: number,
    meta?: { mlProbability?: number; modelName?: string; entryReason?: string; notes?: string }
  ) {
    if (!price || price <= 0 || isNaN(price) || !amount || amount <= 0 || isNaN(amount)) {
      console.warn(`[SAFETY] Trade anulat pentru ${symbol}: Preț sau cantitate invalidă (preț: ${price}, cantitate: ${amount})`);
      return;
    }

    // Consistency sanity check: price anomaly check (> 20% jump)
    const item = this.state.watchlist.find(w => w.symbol === symbol);
    const pos = this.state.positions.find(p => p.symbol === symbol);
    const lastPrice = item?.price || pos?.currentPrice || pos?.entryPrice;

    if (lastPrice && lastPrice > 0) {
      const diff = Math.abs(price - lastPrice) / lastPrice;
      if (diff > 0.20) {
        if (diff > 0.40) {
          // Auto-recalibrate corrupt price from old fallback or state
          console.warn(`[SAFETY RE-SYNC] Re-calibrare preț stocat pentru ${symbol}: $${lastPrice} -> $${price}`);
          if (item) item.price = price;
          if (pos) pos.currentPrice = price;
        } else {
          this.addLog(`[SAFETY] Preț anormal ignorat pentru ${symbol}: $${lastPrice} -> $${price} (variație ${(diff * 100).toFixed(1)}%). Ordin anulat.`, 'warning');
          console.warn(`Preț anormal pentru ${symbol}: ${lastPrice} -> ${price}`);
          return;
        }
      }
    }

    let orderSuccess = true;
    
    if (this.state.binanceMode === 'testnet' || this.state.binanceMode === 'live') {
      try {
        const apiKey = (this.state.binanceMode === 'testnet'
          ? (this.state.testnetApiKey || this.state.apiKey)
          : this.state.apiKey)?.trim();
        const apiSecret = (this.state.binanceMode === 'testnet'
          ? (this.state.testnetApiSecret || this.state.apiSecret)
          : this.state.apiSecret)?.trim();

        if (!apiKey || !apiSecret) {
          if (this.state.binanceMode === 'testnet') {
            this.addLog(`[BINANCE TESTNET -> PAPER] Cheile API de Testnet nu sunt configurate. Ordinul ${action} ${symbol} este executat în modul Simulat (Paper Trading).`, 'info');
            orderSuccess = true;
          } else {
            this.addLog(`[BINANCE LIVE] Execuție anulată: Cheile API pentru modul Live nu sunt configurate în Setări.`, 'warning');
            return;
          }
        } else {

        const client = createBinanceClient({
          apiKey,
          apiSecret,
          httpBase: this.state.binanceMode === 'testnet' ? 'https://testnet.binance.vision' : 'https://api.binance.com'
        });

        const filters = await getSymbolFilters(client, symbol);

        // Pre-check real Binance balance to prevent -2010 insufficient balance errors
        let realFreeUSDT: number | null = null;
        let realFreeAsset: number | null = null;
        try {
          const accInfo = await client.accountInfo();
          if (accInfo && Array.isArray(accInfo.balances)) {
            const usdtB = accInfo.balances.find((b: any) => b.asset === 'USDT');
            if (usdtB) realFreeUSDT = parseFloat(usdtB.free) || 0;

            const assetName = symbol.replace(/USDT$/i, '');
            const assetB = accInfo.balances.find((b: any) => b.asset === assetName);
            if (assetB) realFreeAsset = parseFloat(assetB.free) || 0;
          }
        } catch (e: any) {
          console.warn(`[Binance Account Pre-Check Warning] ${e?.message || e}`);
        }

        const orderParams: any = {
          symbol: symbol,
          side: action as any,
          type: 'MARKET' as any,
        };

        if (action === 'BUY') {
          const requestedCost = price * amount;
          const availableUSDT = (realFreeUSDT !== null && (this.state.binanceMode !== 'testnet' || realFreeUSDT >= filters.minNotional))
            ? realFreeUSDT
            : this.state.balance;

          if (availableUSDT < filters.minNotional) {
            this.addLog(`[BINANCE ${this.state.binanceMode.toUpperCase()}] Ordin CUMPĂRARE ${symbol} anulat: Balanță USDT disponibilă ($${availableUSDT.toFixed(2)}) sub minimul necesar de $${filters.minNotional} USDT.`, 'warning');
            if (realFreeUSDT !== null && (this.state.binanceMode !== 'testnet' || realFreeUSDT >= filters.minNotional)) {
              this.state.balance = realFreeUSDT;
              this.savePersistedState();
            }
            return;
          }

          // Cap quote order size to available USDT (leaving 0.5% margin for fees/slippage)
          const safeCostInUSDT = Math.min(requestedCost, availableUSDT * 0.995);
          if (safeCostInUSDT >= filters.minNotional) {
            orderParams.quoteOrderQty = safeCostInUSDT.toFixed(2);
          } else {
            const formattedQtyStr = formatQuantityByStepSize(safeCostInUSDT / price, filters.stepSize);
            orderParams.quantity = formattedQtyStr;
          }
        } else { // SELL
          const availableAsset = realFreeAsset !== null ? realFreeAsset : amount;
          const qtyToSell = Math.min(amount, availableAsset);
          const formattedSellQtyStr = formatQuantityByStepSize(qtyToSell, filters.stepSize);
          const formattedSellQtyNum = parseFloat(formattedSellQtyStr);

          if (formattedSellQtyNum < filters.minQty) {
            this.addLog(`[BINANCE ${this.state.binanceMode.toUpperCase()}] Ordin VÂNZARE ${symbol} anulat: Cantitatea disponibilă (${formattedSellQtyStr}) este sub minimul de lot (${filters.minQty}).`, 'warning');
            return;
          }
          orderParams.quantity = formattedSellQtyStr;
        }

        const order = await client.order(orderParams);
        
        // If order successful, update real balance (only for live or testnet with adequate balance)
        if (order && (order.status === 'FILLED' || order.status === 'NEW')) {
          console.log(`[Binance Executed] ${action} ${symbol} order filled successfully on ${this.state.binanceMode}`);
          if (realFreeUSDT !== null && (this.state.binanceMode === 'live' || (this.state.binanceMode === 'testnet' && realFreeUSDT >= 10))) {
            this.state.balance = realFreeUSDT;
          }
        }
        }
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        console.warn(`[Binance Order Warning] ${errMsg}`);

        const isInsufficient = errMsg.includes('insufficient balance') || errMsg.includes('-2010') || errMsg.includes('2010');
        const isInvalidKeyOrConn = errMsg.includes('Invalid API-key') || errMsg.includes('-2015') || errMsg.includes('socket') || errMsg.includes('TLS') || errMsg.includes('disconnected');

        if (isInsufficient) {
          if (this.state.binanceMode === 'testnet') {
            this.addLog(
              `[BINANCE TESTNET] Ordinul transmis pe testnet.binance.vision a fost respins (Eroare -2010: Balanță USDT insuficientă pe serverul Binance Testnet). Executăm ordinul în modul Paper (Simulat).`,
              'warning',
              this.calculateEquity()
            );
            orderSuccess = true;
          } else {
            orderSuccess = false;
            this.addLog(`[BINANCE LIVE] Balanță insuficientă în contul Binance pentru ordinul ${action} ${symbol}. Re-sincronizăm balanța...`, 'warning', this.calculateEquity());
            this.sendNotification(`⚠️ **[Binance Live] Balanță insuficientă**\nContul Binance nu dispune de fonduri suficiente pentru ${action} ${symbol}. S-a efectuat re-sincronizarea.`);
            this.syncBinanceBalance().catch(() => {});
          }
        } else if (isInvalidKeyOrConn && this.state.binanceMode === 'testnet') {
          this.addLog(
            `[BINANCE TESTNET -> SIMULARE PAPER] Conexiunea sau cheia Binance Testnet a raportat o eroare (${errMsg}). Ordinul ${action} ${symbol} a fost executat în modul Paper (Simulat).`,
            'info',
            this.calculateEquity()
          );
          orderSuccess = true;
        } else {
          orderSuccess = false;
          this.addLog(`Eroare Binance (${this.state.binanceMode}): ${errMsg}`, 'warning', this.calculateEquity());
          this.sendNotification(`❌ **Eroare Binance [${this.state.binanceMode}]**\nActiv: ${symbol}\nAcțiune: ${action}\nEroare: ${errMsg}`);
        }
      }
    }

    if (!orderSuccess) return;

    const cost = price * amount;
    const fee = parseFloat((cost * 0.00075).toFixed(4)); // 0.075% standard fee

    if (action === 'BUY' && this.state.balance >= cost) {
      const existing = this.state.positions.find(p => p.symbol === symbol);
      if (existing) {
        existing.amount += amount;
        existing.currentPrice = price;
        if (!(existing as any).highestPrice || price > (existing as any).highestPrice) {
          (existing as any).highestPrice = price;
        }
      } else {
        this.state.positions.push({
          symbol,
          amount,
          entryPrice: price,
          currentPrice: price,
          highestPrice: price,
          openedAt: Date.now(),
          entryMlProb: meta?.mlProbability || 75,
          entryOppScore: meta?.entryReason?.includes('OppScore:') ? parseFloat(meta.entryReason.split('OppScore:')[1]) || 70 : 70
        } as any);
      }
      this.state.balance -= cost;
      this.state.totalTradesExecuted += 1;

      // Calculate Trade Quality Rating & Grade (A+ / A / B / C / F)
      const oppScoreVal = meta?.entryReason?.includes('OppScore:')
        ? (parseFloat(meta.entryReason.split('OppScore:')[1]) || 70)
        : 70;

      const qualityRes = calculateTradeQualityScore({
        action: 'BUY',
        mlProbability: meta?.mlProbability || 75,
        oppScore: oppScoreVal,
        pnlPercent: 0
      });

      // Automatically add BUY trade to Trading Journal database
      journalService.addJournalEntry({
        symbol,
        action: 'BUY',
        price,
        amount,
        fee,
        pnl: 0,
        pnlPercent: 0,
        mlProbability: meta?.mlProbability || 75,
        modelName: meta?.modelName || 'XGBoost Classifier',
        entryReason: meta?.entryReason || 'Semnal Cumpărare Algoritm AI',
        mode: this.state.binanceMode,
        timestamp: new Date().toISOString(),
        notes: meta?.notes || `Deschis pe modul ${this.state.binanceMode} | Trade Grade: ${qualityRes.grade} (${qualityRes.score}/100)`,
        tradeGrade: qualityRes.grade,
        tradeQualityScore: qualityRes.score,
        stars: qualityRes.stars,
        oppScore: oppScoreVal
      });

      const currentEquity = this.calculateEquity();
      this.addLog(`[SERVER BOT] Cumpărat ${amount} ${symbol} @ $${price} | Trade Quality: Grade ${qualityRes.grade} ('${'★'.repeat(qualityRes.stars)}')`, 'success', currentEquity);

      this.sendNotification(`🟢 **[AI.TRADE Bot Server 24/7]** CUMPĂRĂ\nActiv: ${symbol}\nPreț: $${price}\nCantitate: ${amount}\nBalanță liberă: $${this.state.balance.toFixed(2)}`);
    } else if (action === 'BUY') {
      this.addLog(`[SERVER BOT] Cumpărare ${symbol} neefectuată: Costul ($${cost.toFixed(2)} USDT) depășește balanța disponibilă ($${this.state.balance.toFixed(2)} USDT).`, 'warning');
    } else if (action === 'SELL') {
      const existingIndex = this.state.positions.findIndex(p => p.symbol === symbol);
      if (existingIndex !== -1) {
        const pos = this.state.positions[existingIndex];
        if (pos.amount >= amount) {
          const entryPrice = pos.entryPrice;
          const pnl = (price - entryPrice) * amount;
          const pnlPercent = ((price - entryPrice) / entryPrice) * 100;
          const pnlValueStr = pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`;
          
          pos.amount -= amount;
          if (pos.amount <= 0) {
            this.state.positions.splice(existingIndex, 1);
          }
          this.state.balance += cost;
          this.state.totalTradesExecuted += 1;

          this.state.tradeHistory.push({
            symbol,
            entryPrice,
            exitPrice: price,
            amount,
            pnl,
            pnlPercent,
            timestamp: new Date().toISOString()
          });
          // Limit history size
          if (this.state.tradeHistory.length > 1000) {
            this.state.tradeHistory.shift();
          }

          // Calculate Trade Quality Rating & Grade for SELL
          const entryOpp = (pos as any).entryOppScore || 70;
          const qualityRes = calculateTradeQualityScore({
            action: 'SELL',
            mlProbability: meta?.mlProbability || 75,
            oppScore: entryOpp,
            pnlPercent
          });

          // Automatically add SELL trade to Trading Journal database
          journalService.addJournalEntry({
            symbol,
            action: 'SELL',
            price,
            amount,
            fee,
            pnl,
            pnlPercent,
            mlProbability: meta?.mlProbability || 75,
            modelName: meta?.modelName || 'XGBoost Classifier',
            entryReason: meta?.entryReason || 'Ieșire Poziție (Ieșire Semnal / SL / TP)',
            mode: this.state.binanceMode,
            timestamp: new Date().toISOString(),
            notes: meta?.notes || `Închis PnL: ${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}% | Grade: ${qualityRes.grade} (${qualityRes.score}/100)`,
            tradeGrade: qualityRes.grade,
            tradeQualityScore: qualityRes.score,
            stars: qualityRes.stars,
            oppScore: entryOpp
          });

          // Update per-symbol performance statistics for AI.TRADE Bot 2.0
          if (!this.state.symbolStats) this.state.symbolStats = {};
          const symStat = this.state.symbolStats[symbol] || {
            symbol,
            totalTrades: 0,
            wins: 0,
            losses: 0,
            winRate: 0,
            realizedPnL: 0,
            profitFactor: 1.0,
            avgProfitPercent: 0,
            avgLossPercent: 0,
            maxDrawdownPercent: 0,
            sharpeScore: 1.0,
            avgHoldDurationMinutes: 15,
            lastTradedAt: new Date().toISOString()
          };

          symStat.totalTrades += 1;
          if (pnl > 0) symStat.wins += 1;
          else if (pnl < 0) symStat.losses += 1;
          symStat.realizedPnL = parseFloat((symStat.realizedPnL + pnl).toFixed(2));
          symStat.winRate = parseFloat(((symStat.wins / symStat.totalTrades) * 100).toFixed(1));

          const symTrades = this.state.tradeHistory.filter(t => t.symbol === symbol);
          const grossWin = symTrades.filter(t => t.pnl > 0).reduce((acc, t) => acc + t.pnl, 0);
          const grossLoss = Math.abs(symTrades.filter(t => t.pnl < 0).reduce((acc, t) => acc + t.pnl, 0));
          symStat.profitFactor = grossLoss > 0 ? parseFloat((grossWin / grossLoss).toFixed(2)) : (grossWin > 0 ? 3.0 : 1.0);

          const winPcnts = symTrades.filter(t => t.pnlPercent > 0).map(t => t.pnlPercent);
          const lossPcnts = symTrades.filter(t => t.pnlPercent < 0).map(t => Math.abs(t.pnlPercent));
          symStat.avgProfitPercent = winPcnts.length > 0 ? parseFloat((winPcnts.reduce((a, b) => a + b, 0) / winPcnts.length).toFixed(2)) : 0;
          symStat.avgLossPercent = lossPcnts.length > 0 ? parseFloat((lossPcnts.reduce((a, b) => a + b, 0) / lossPcnts.length).toFixed(2)) : 0;
          symStat.lastTradedAt = new Date().toISOString();

          this.state.symbolStats[symbol] = symStat;

          // Register Post-Exit Cooldown Protection Engine (Prevents rapid re-entries)
          const cooldownMinutes = registerSymbolCooldown(symbol, pnlPercent, pnlPercent >= 0 ? `Take Profit (+${pnlPercent.toFixed(2)}%)` : `Stop Loss (${pnlPercent.toFixed(2)}%)`);
          
          const currentEquity = this.calculateEquity();
          this.addLog(`[SERVER BOT] Vândut ${amount} ${symbol} @ $${price} (PNL: ${pnlPercent.toFixed(2)}% | ${pnlValueStr}). Moneda intră în cooldown ${cooldownMinutes} min.`, 'warning', currentEquity);

          this.sendNotification(`🔴 **[AI.TRADE Bot Server 24/7]** VÂNZARE\nActiv: ${symbol}\nPreț: $${price}\nCantitate: ${amount}\nPNL: ${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}% (${pnlValueStr})\nBalanță liberă: $${this.state.balance.toFixed(2)}`);
        }
      }
    }
    this.savePersistedState();
    this.checkCircuitBreaker();
  }

  public calculateEquity(): number {
    const positionsValue = this.state.positions.reduce((acc, pos) => acc + (pos.amount * (pos.currentPrice || pos.entryPrice)), 0);
    return parseFloat((this.state.balance + positionsValue).toFixed(2));
  }

  public async scanMarketOpportunities(): Promise<MarketOpportunity[]> {
    try {
      const endpoints = [
        'https://api.binance.com/api/v3/ticker/24hr',
        'https://api1.binance.com/api/v3/ticker/24hr',
        'https://api3.binance.com/api/v3/ticker/24hr',
        'https://data-api.binance.vision/api/v3/ticker/24hr'
      ];

      let tickerData: any[] = [];
      for (const url of endpoints) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 4000);
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
              tickerData = data;
              break;
            }
          }
        } catch (err) {
          // try next endpoint
        }
      }

      if (!Array.isArray(tickerData) || tickerData.length === 0) {
        console.warn('[Opportunity Scanner] Could not fetch Binance 24hr ticker data, retaining existing opportunities.');
        return this.state.marketOpportunities || [];
      }

      // Exclude leveraged tokens, stablecoins, fiat
      const excludedSubstrings = ['UPUSDT', 'DOWNUSDT', 'BEARUSDT', 'BULLUSDT', 'BUSDUSDT', 'USDCUSDT', 'FDUSDUSDT', 'TUSDUSDT', 'DAIUSDT', 'EURUSDT', 'TRYUSDT', 'GBPUSDT', 'AEURUSDT', 'SUSDUSDT', 'USDPUSDT', 'PAXUSDT', 'USDSUSDT'];

      const filtered = tickerData.filter((item: any) => {
        const sym = item.symbol;
        if (!sym || !sym.endsWith('USDT')) return false;
        if (excludedSubstrings.includes(sym)) return false;
        const quoteVol = parseFloat(item.quoteVolume);
        const price = parseFloat(item.lastPrice);
        const count = parseInt(item.count, 10) || 0;
        const change = Math.abs(parseFloat(item.priceChangePercent));
        return !isNaN(quoteVol) && quoteVol >= 800000 && !isNaN(price) && price > 0 && count > 100 && !isNaN(change) && change >= 1.0;
      });

      // Sort by 24h quote volume to analyze top ~120 candidates
      filtered.sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume));
      const topCandidates = filtered.slice(0, 200);

      const batchPriceMap = await fetchBatchPricesServer();

      // Calculate Opportunity Score for candidates in controlled batches (e.g. 15 per batch to prevent network congestion)
      const BATCH_SIZE = 25;
      const opportunities: MarketOpportunity[] = [];

      for (let batchOffset = 0; batchOffset < topCandidates.length; batchOffset += BATCH_SIZE) {
        const batchCandidates = topCandidates.slice(batchOffset, batchOffset + BATCH_SIZE);
        const batchResults = await Promise.all(batchCandidates.map(async (item: any, batchIdx: number) => {
          const idx = batchOffset + batchIdx;
          const symbol = item.symbol;
          const price = parseFloat(item.lastPrice) || batchPriceMap.get(symbol) || getFallbackBasePrice(symbol);
          const volume24h = parseFloat(item.quoteVolume) || 0;
          const priceChangePercent = parseFloat(item.priceChangePercent) || 0;
          const highPrice = parseFloat(item.highPrice) || price * 1.02;
          const lowPrice = parseFloat(item.lowPrice) || price * 0.98;

          // 1. Scalping Volatility & ATR % Score (0 to 20 pts - continuous curve)
          const rangePercent = lowPrice > 0 ? ((highPrice - lowPrice) / lowPrice) * 100 : Math.abs(priceChangePercent);
          let atrPercent = parseFloat((rangePercent / 2).toFixed(2));
          let volScore = Math.min(20, Math.max(2, (rangePercent >= 2.0 && rangePercent <= 12.0) ? 12 + (rangePercent / 12) * 8 : (rangePercent < 2.0 ? rangePercent * 6 : Math.max(4, 20 - (rangePercent - 12)))));

          // 2. Volume & Liquidity Score (0 to 20 pts - continuous logarithmic scale)
          let liquidityScore = volume24h > 500000 
            ? Math.min(20, Math.max(2, Math.log10(volume24h / 500000) * 8.0 + 3))
            : 2;

          // 3. Momentum & Trend Alignment (0 to 20 pts - continuous scale)
          let momentumScore = Math.min(20, Math.max(2, 10 + (priceChangePercent * 1.1)));

          const trendAlignment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = priceChangePercent >= 1.2 ? 'BULLISH' : (priceChangePercent <= -2.5 ? 'BEARISH' : 'NEUTRAL');
          const regime: 'TRENDING_BULL' | 'RANGING' | 'TRENDING_BEAR' = priceChangePercent >= 3.0 ? 'TRENDING_BULL' : (priceChangePercent <= -3.0 ? 'TRENDING_BEAR' : 'RANGING');

          // 4. ML / Strategy Calibrated Score (0 to 25 pts) - Fetch full ML for top 30 candidates
          let mlRes: any = null;
          if (idx < 30) {
            mlRes = await getCachedRealStrategyAnalysis(symbol);
          }
          const baseRfProb = mlRes?.rfProb || (trendAlignment === 'BULLISH' ? 66 : (trendAlignment === 'BEARISH' ? 44 : 54));
          // Continuous price & symbol character dispersion to eliminate identical step bucket capping
          const symbolHashBonus = (symbol.charCodeAt(0) + symbol.charCodeAt(symbol.length - 1)) % 30 / 10 - 1.5;
          const rfProb = Math.min(98, Math.max(10, baseRfProb + (mlRes ? 0 : symbolHashBonus)));
          const metaProb = mlRes?.metaProb || 50;
          const mlPoints = (rfProb * 0.18) + (metaProb * 0.07);

          // 5. Reversal & Sentiment (0 to 10 pts)
          const isReversal = mlRes?.reversalSignal?.isBullishReversal || (priceChangePercent <= -4.0 && priceChangePercent >= -10.0);
          const reversalSignal: 'BULLISH_REVERSAL' | 'BEARISH_REVERSAL' | 'NONE' = isReversal ? 'BULLISH_REVERSAL' : (mlRes?.reversalSignal?.isBearishReversal ? 'BEARISH_REVERSAL' : 'NONE');
          const reversalPts = isReversal ? 10 : 0;

          // 6. Spread Penalty (0 to 5 pts)
          const spreadPercent = parseFloat((volume24h > 10000000 ? 0.02 : 0.06).toFixed(3));
          const spreadPts = spreadPercent <= 0.03 ? 5 : 2;

          // 7. Symbol Historical Performance Adjustment (-15 to +15 pts)
          const symStats = this.state.symbolStats ? this.state.symbolStats[symbol] : undefined;
          let histScore = 0;
          if (symStats && symStats.totalTrades >= 2) {
            if (symStats.winRate >= 65 && symStats.profitFactor >= 1.2) {
              histScore = +12; // Bonus for proven winning symbols
            } else if (symStats.winRate >= 50 && symStats.realizedPnL > 0) {
              histScore = +5;
            } else if (symStats.winRate < 40 || symStats.realizedPnL < -5) {
              histScore = -12; // Penalty for repeat losing symbols
            }
          }

          let totalRawScore = volScore + liquidityScore + momentumScore + mlPoints + reversalPts + spreadPts + histScore;
          const opportunityScore = Math.min(100, Math.max(0, Math.round(totalRawScore * 10) / 10));

          const reason = `Vol: $${(volume24h / 1000000).toFixed(1)}M | Range: ${rangePercent.toFixed(1)}% | AI Prob: ${rfProb.toFixed(0)}% | Trend: ${trendAlignment}${histScore !== 0 ? ` | Hist: ${histScore > 0 ? '+' : ''}${histScore}` : ''}`;

          const sentimentLabel: 'bullish' | 'bearish' | 'neutral' = trendAlignment === 'BULLISH' ? 'bullish' : (trendAlignment === 'BEARISH' ? 'bearish' : 'neutral');

          return {
            symbol,
            price,
            opportunityScore,
            rfProb,
            metaProb,
            trendAlignment,
            adx: Math.round(20 + Math.abs(priceChangePercent) * 1.8),
            atrPercent,
            momentumScore: Math.round(momentumScore * 5),
            volume24h,
            volumeGrowth24h: parseFloat(priceChangePercent.toFixed(2)),
            liquidityScore: Math.round(liquidityScore * 5),
            spreadPercent,
            reversalSignal,
            sentimentLabel,
            regime,
            historicalPerformanceScore: histScore,
            inDynamicWatchlist: false,
            rank: 0,
            updatedAt: new Date().toISOString(),
            reason
          };
        }));
        opportunities.push(...batchResults);
      }

      // Sort descending by Opportunity Score
      opportunities.sort((a, b) => b.opportunityScore - a.opportunityScore);

      // Assign Ranks and set inDynamicWatchlist for top N
      const targetSize = this.state.dynamicWatchlistSize || 20;
      opportunities.forEach((op, index) => {
        op.rank = index + 1;
        if (index < targetSize) {
          op.inDynamicWatchlist = true;
        }
      });

      this.state.marketOpportunities = opportunities;
      this.state.lastScanAt = new Date().toISOString();

      // AUTO ROTATION: Rebalance Watchlist with Top Dynamic Opportunities
      this.updateDynamicWatchlist(opportunities, targetSize);

      return opportunities;
    } catch (err: any) {
      console.warn(`[Market Opportunity Scanner Error]: ${err?.message || err}`);
      return this.state.marketOpportunities || [];
    }
  }

  private updateDynamicWatchlist(opportunities: MarketOpportunity[], topCount: number) {
    const topOpportunities = opportunities.slice(0, topCount);
    const topSymbols = new Set(topOpportunities.map(o => o.symbol));

    const newWatchlist: WatchlistItem[] = [];

    // Add top opportunity symbols
    for (const op of topOpportunities) {
      const existing = this.state.watchlist.find(w => w.symbol === op.symbol);
      newWatchlist.push({
        symbol: op.symbol,
        price: op.price || existing?.price || null,
        signal: existing?.signal || null,
        active: true,
        opportunityScore: op.opportunityScore,
        rank: op.rank,
        isDynamic: true
      });
    }

    // Preserve held position symbols in watchlist so SL/TP continue working
    for (const pos of this.state.positions) {
      if (!topSymbols.has(pos.symbol)) {
        const existing = this.state.watchlist.find(w => w.symbol === pos.symbol);
        newWatchlist.push({
          symbol: pos.symbol,
          price: pos.currentPrice || pos.entryPrice,
          signal: existing?.signal || null,
          active: true,
          opportunityScore: 30,
          rank: 99,
          isDynamic: false
        });
      }
    }

    const addedCount = newWatchlist.filter(w => !this.state.watchlist.some(old => old.symbol === w.symbol)).length;
    const removedCount = this.state.watchlist.filter(w => !newWatchlist.some(nw => nw.symbol === w.symbol)).length;

    this.state.watchlist = newWatchlist;

    if (addedCount > 0 || removedCount > 0) {
      const top1 = opportunities[0];
      this.addLog(
        `[AI.TRADE Bot 2.0 🔄 Dynamic Watchlist] Auto-Rotire Executată! Top ${topCount} oportunități scalping (${addedCount} noi, ${removedCount} rotite). Lider clasament: ${top1?.symbol} (Scor: ${top1?.opportunityScore}/100, Rank #1).`,
        'info'
      );
    }
  }

  private startBackgroundLoop() {
    if (this.intervalTimer) clearInterval(this.intervalTimer);

    // Initial immediate scan on server startup for fast data population
    setTimeout(() => {
      this.checkPricesAndSLTP().then(() => this.runMLAnalysis());
    }, 500);

    // Heartbeat every 5 seconds
    this.intervalTimer = setInterval(async () => {
      this.secondsCounter += 5;
      this.state.lastCheckAt = new Date().toISOString();

      // Check prices according to dataInterval (always update prices)
      if (this.secondsCounter % Math.max(5, this.state.dataInterval) === 0) {
        await this.checkPricesAndSLTP();
      }

      // Run ML analysis according to analysisInterval (always update AI signals)
      if (this.secondsCounter % Math.max(10, this.state.analysisInterval) === 0) {
        await this.runMLAnalysis();
      }

      // Check reports every minute
      if (this.secondsCounter % 60 === 0) {
        this.checkAndSendReports();
      }

      // Periodic Automatic Heartbeat Log every 3 minutes (180s) to reassure user of active 24/7 scanning
      if (this.secondsCounter % 180 === 0) {
        const activeCount = this.state.watchlist.filter(w => w.active).length;
        const statusText = this.state.autoTradingActive ? 'PORNIT (24/7)' : 'OPRIT (Standby)';
        const posText = this.state.positions.length > 0 ? `${this.state.positions.length} poziții active` : 'nicio poziție deschisă';
        this.addLog(`[PULS AUTOMAT 24/7 💓] Engine activ | Monitorizare ${activeCount} perechi (${posText}). Stare Auto-Trading: ${statusText}.`, 'info');
      }

      await this.pollTelegramMessages();

      this.savePersistedState();
    }, 5000);

    console.log('[AI.TRADE Bot] Background 24/7 trading engine is active on server.');
  }

  private checkAndSendReports() {
    const now = new Date();
    
    // Get time in specified timezone
    const timeFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: this.state.timezone || 'Europe/Bucharest',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const currentTime = timeFormatter.format(now); // e.g. "21:00"

    const dayFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: this.state.timezone || 'Europe/Bucharest',
      weekday: 'short'
    });
    const currentDayStr = dayFormatter.format(now);
    const dayMap: Record<string, number> = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
    const currentDay = dayMap[currentDayStr];

    // For end of month check, we can use the local timezone date
    const datePartsFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: this.state.timezone || 'Europe/Bucharest',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    });
    const dateStr = datePartsFormatter.format(now); // "M/D/YYYY"
    const [month, day, year] = dateStr.split('/').map(Number);
    const isLastDayOfMonth = new Date(year, month, 0).getDate() === day;

    const config = this.state.reportConfig;

    // Record or update daily snapshot in Trading Journal database
    const currentEquity = this.calculateEquity();
    const openPnL = this.state.positions.reduce((acc, p) => acc + ((p.currentPrice - p.entryPrice) * p.amount), 0);
    journalService.recordDailySnapshot(currentEquity, openPnL);

    if (config.daily.enabled && config.daily.time === currentTime) {
      this.sendNotification(this.generateDailyReport(now));
    }

    if (config.weekly.enabled && config.weekly.day === currentDay && config.weekly.time === currentTime) {
      this.sendNotification(this.generateWeeklyReport(now));
    }

    if (config.monthly.enabled && isLastDayOfMonth && config.daily.time === currentTime) {
      // Just reuse daily report format for monthly, or create a specific one. Let's send a summary.
      this.sendNotification(`📅 **Monthly Report**\nCapital Curent: $${this.calculateEquity().toFixed(2)}`);
    }
  }

  private generateDailyReport(date: Date): string {
    const equity = this.calculateEquity();
    const profit = equity - this.state.initialBalance;
    const profitPercent = (profit / this.state.initialBalance) * 100;
    const profitSign = profit >= 0 ? '+' : '';

    const todayStr = formatInTimezone(date.toISOString(), this.state.timezone || 'Europe/Bucharest').split(' ')[0];
    const todayTrades = this.state.tradeHistory.filter(t => formatInTimezone(t.timestamp, this.state.timezone || 'Europe/Bucharest').startsWith(todayStr));
    
    // In our simplified simulation, we count total trades executed. But let's build stats from todayTrades.
    const winTrades = todayTrades.filter(t => t.pnl > 0);
    const lossTrades = todayTrades.filter(t => t.pnl <= 0);
    const winRate = todayTrades.length > 0 ? ((winTrades.length / todayTrades.length) * 100).toFixed(1) : '0.0';
    
    const avgProfit = winTrades.length > 0 ? winTrades.reduce((a, b) => a + b.pnl, 0) / winTrades.length : 0;
    const avgLoss = lossTrades.length > 0 ? lossTrades.reduce((a, b) => a + b.pnl, 0) / lossTrades.length : 0;
    const profitFactor = Math.abs(avgLoss) > 0 ? (avgProfit / Math.abs(avgLoss)).toFixed(2) : (avgProfit > 0 ? 'INF' : '0.00');

    let bestTrade = todayTrades.length > 0 ? todayTrades.reduce((a, b) => a.pnl > b.pnl ? a : b) : null;
    let worstTrade = todayTrades.length > 0 ? todayTrades.reduce((a, b) => a.pnl < b.pnl ? a : b) : null;

    const openPositions = this.state.positions.length > 0 
      ? this.state.positions.map(p => `• ${p.symbol} → ${(((p.currentPrice! - p.entryPrice) / p.entryPrice) * 100).toFixed(2)}%`).join('\n')
      : 'Niciuna';

    return `🤖 *AI.TRADE Bot - Daily Paper Trading Report*\n\n` +
           `📅 Data: ${date.toLocaleDateString('ro-RO')}\n\n` +
           `💼 Valoare portofoliu: $${equity.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}\n` +
           `💵 Cash disponibil: $${this.state.balance.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})}\n\n` +
           `📈 Profit total: ${profitSign}$${profit.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})} (${profitSign}${profitPercent.toFixed(2)}%)\n\n` +
           `📋 Tranzacții închise azi: ${todayTrades.length}\n` +
           `🎯 Win Rate: ${winRate}%\n` +
           `💰 Profit mediu/tranzacție: +$${avgProfit.toFixed(2)}\n` +
           `📉 Pierdere medie: -$${Math.abs(avgLoss).toFixed(2)}\n` +
           `⚖️ Profit Factor: ${profitFactor}\n\n` +
           `📌 Poziții deschise:\n${openPositions}\n\n` +
           `🏆 Cel mai bun trade:\n${bestTrade ? `${bestTrade.symbol} +$${bestTrade.pnl.toFixed(2)}` : 'N/A'}\n\n` +
           `📉 Cel mai slab trade:\n${worstTrade ? `${worstTrade.symbol} -$${Math.abs(worstTrade.pnl).toFixed(2)}` : 'N/A'}`;
  }

  private generateWeeklyReport(date: Date): string {
    const equity = this.calculateEquity();
    const profit = equity - this.state.initialBalance;
    const profitPercent = (profit / this.state.initialBalance) * 100;
    const profitSign = profit >= 0 ? '+' : '';

    // Simplified weekly stats, taking all history for now
    const trades = this.state.tradeHistory;
    const winTrades = trades.filter(t => t.pnl > 0);
    const winRate = trades.length > 0 ? ((winTrades.length / trades.length) * 100).toFixed(1) : '0.0';
    const bestTrade = trades.length > 0 ? trades.reduce((a, b) => a.pnl > b.pnl ? a : b) : null;

    return `📅 *Weekly Report*\n\n` +
           `Profit:\n${profitSign}$${profit.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2})} (${profitSign}${profitPercent.toFixed(2)}%)\n\n` +
           `Tranzacții total (istoric):\n${trades.length}\n\n` +
           `Win Rate:\n${winRate}%\n\n` +
           `Cel mai profitabil activ:\n${bestTrade ? bestTrade.symbol : 'N/A'}`;
  }

  private async checkPricesAndSLTP() {
    if (this.isCheckingPrices) return;
    this.isCheckingPrices = true;

    try {
      const batchMap = await fetchBatchPricesServer();

      for (const item of this.state.watchlist) {
        if (!item.active) continue;
        
        const pos = this.state.positions.find(p => p.symbol === item.symbol);
        const lastPrice = item.price || pos?.currentPrice || pos?.entryPrice || 0;

        let livePrice = batchMap.get(item.symbol) || batchMap.get(`${item.symbol}USDT`) || item.price;
        if (!livePrice || livePrice <= 0) {
          livePrice = await fetchLivePriceServer(item.symbol) || getFallbackBasePrice(item.symbol);
        }

        if (!livePrice || livePrice <= 0) {
          continue;
        }

        // Check price jump consistency (diff > 20%)
        if (lastPrice > 0) {
          const diff = Math.abs(livePrice - lastPrice) / lastPrice;
          if (diff > 0.20) {
            if (diff > 0.40) {
              console.warn(`[SAFETY RE-SYNC] Re-calibrare preț pentru ${item.symbol}: $${lastPrice} -> $${livePrice}`);
              item.price = livePrice;
              if (pos) pos.currentPrice = livePrice;
            } else {
              this.addLog(`[SAFETY] Preț anormal ignorat pentru ${item.symbol}: $${lastPrice} -> $${livePrice} (${(diff * 100).toFixed(1)}% variație)`, 'warning');
              console.warn(`Preț anormal pentru ${item.symbol}: ${lastPrice} -> ${livePrice}`);
              continue;
            }
          }
        }

        item.price = livePrice;

        // Update position current price if held
        if (pos) {
          pos.currentPrice = livePrice;
          if (!(pos as any).highestPrice || livePrice > (pos as any).highestPrice) {
            (pos as any).highestPrice = livePrice;
          }
          const highestPrice = (pos as any).highestPrice || livePrice;
          const pnl = (livePrice - pos.entryPrice) * pos.amount;
          const pnlPercent = ((livePrice - pos.entryPrice) / pos.entryPrice) * 100;
          const maxPnlPercent = ((highestPrice - pos.entryPrice) / pos.entryPrice) * 100;
          const pnlValueStr = pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`;
          const amountToSell = pos.amount;

          // Configured Hard Safety Stop Loss (e.g. -2.0%)
          const hardStopLossPct = -(Math.abs(this.state.stopLossPercent || 2.0));
          if (pnlPercent <= hardStopLossPct) {
            this.addLog(`[Stop Loss Siguranță Server 🛑] Ieșire din ${item.symbol} la $${livePrice} (PNL: ${pnlPercent.toFixed(2)}% | Limită: ${hardStopLossPct.toFixed(1)}% | ${pnlValueStr})`, 'warning');
            await this.executeTrade(item.symbol, 'SELL', livePrice, amountToSell, {
              mlProbability: (pos as any)?.entryMlProb || 50,
              modelName: 'Stop Loss Engine',
              entryReason: `Stop Loss Siguranță (${pnlPercent.toFixed(2)}% <= ${hardStopLossPct.toFixed(1)}%)`
            });
            this.sendNotification(`🚨 **[Stop Loss]** Vândut automat ${item.symbol} la $${livePrice} (PNL ${pnlPercent.toFixed(2)}% | ${pnlValueStr})`);
          } 
          // Target Profit +8.0%
          else if (pnlPercent >= 8.0) {
            this.addLog(`[Take Profit Țintă Înaltă] Ieșire din ${item.symbol} la $${livePrice} (PNL: +${pnlPercent.toFixed(2)}% | ${pnlValueStr})`, 'success');
            await this.executeTrade(item.symbol, 'SELL', livePrice, amountToSell);
            this.sendNotification(`🎯 **[Take Profit]** Vândut automat ${item.symbol} la $${livePrice} (PNL +${pnlPercent.toFixed(2)}% | ${pnlValueStr})`);
          }
          // Dynamic Trailing Profit Lock: Lock in profit ONLY if peak PnL reached >= +2.5% and price pulled back, protecting MINIMUM +1.5% net profit
          else if (maxPnlPercent >= 2.5 && livePrice <= highestPrice * 0.992 && pnlPercent >= 1.5) {
            this.addLog(`[Trailing Profit Lock 💰] Profit de +${pnlPercent.toFixed(2)}% securizat pentru ${item.symbol} (Vârf atins: +${maxPnlPercent.toFixed(2)}%). Executăm vânzare.`, 'success');
            await this.executeTrade(item.symbol, 'SELL', livePrice, amountToSell);
            this.sendNotification(`💰 **[Trailing Profit]** Vândut ${item.symbol} la $${livePrice} cu profit securizat +${pnlPercent.toFixed(2)}% (${pnlValueStr})`);
          }
          // Break-Even Protection: Lock in minimum +0.3% net profit (covering Binance fees) ONLY if peak reached >= +1.5%
          else if (maxPnlPercent >= 1.5 && livePrice <= pos.entryPrice * 1.003 && pnlPercent >= 0.2) {
            this.addLog(`[Break-Even Protect 🛡️] Protecție Break-Even +${pnlPercent.toFixed(2)}% activată pentru ${item.symbol} la $${livePrice} (Vârf: +${maxPnlPercent.toFixed(2)}%).`, 'info');
            await this.executeTrade(item.symbol, 'SELL', livePrice, amountToSell);
            this.sendNotification(`🛡️ **[Break-Even Protect]** Ieșire în siguranță ${item.symbol} la $${livePrice} (PNL +${pnlPercent.toFixed(2)}%)`);
          }
        }
      }
      this.checkCircuitBreaker();
    } catch (err: any) {
      console.warn(`[Price Check Warning] ${err?.message || err}`);
    } finally {
      this.isCheckingPrices = false;
    }
  }

  private async runMLAnalysis() {
    if (this.isRunningML) return;
    this.isRunningML = true;

    try {
      if (this.checkCircuitBreaker()) {
        return;
      }

      // Automatically run market opportunities scan if stale (>60s) or unpopulated
      if (!this.state.marketOpportunities || this.state.marketOpportunities.length === 0 || !this.state.lastScanAt || (Date.now() - new Date(this.state.lastScanAt).getTime() > 60000)) {
        await this.scanMarketOpportunities();
      }

      // Auto-replenish paper/testnet trading capital if balance depleted and no positions held
      if ((this.state.binanceMode === 'paper' || this.state.binanceMode === 'testnet') && this.state.balance < 9.5 && this.state.positions.length === 0) {
        const replenishAmt = (this.state.initialBalance && this.state.initialBalance >= 10) ? this.state.initialBalance : 300;
        this.state.balance = replenishAmt;
        this.state.initialBalance = replenishAmt;
        this.addLog(`[REFILL BALANȚĂ] Capitalul virtual a fost reîncărcat automat la $${replenishAmt.toFixed(2)} USDT pentru continuitate.`, 'info', replenishAmt);
        this.savePersistedState();
      }

      const activeItems = this.state.watchlist.filter(w => w.active);
      if (activeItems.length === 0) return;

      const batchMap = await fetchBatchPricesServer();

      // Phase 1: Batched Signal Generation & Price Fetching (batches of 8 items to optimize network & CPU load)
      const BATCH_SIZE_ML = 8;
      const itemsWithSignals: Array<{ item: WatchlistItem; currentPrice: number; signal: any; mlRes: any; oppScore: number; oppInfo: any }> = [];

      for (let i = 0; i < activeItems.length; i += BATCH_SIZE_ML) {
        const batch = activeItems.slice(i, i + BATCH_SIZE_ML);
        const batchResults = await Promise.all(batch.map(async (item) => {
          try {
            let price = batchMap.get(item.symbol) || batchMap.get(`${item.symbol}USDT`) || item.price;
            if (!price || price <= 0) {
              price = await fetchLivePriceServer(item.symbol) || getFallbackBasePrice(item.symbol);
            }
            if (price && price > 0) {
              item.price = price;
            }

            const currentPrice = price || getFallbackBasePrice(item.symbol);
            const mlRes = await getCachedRealStrategyAnalysis(item.symbol);
            
            let signal: { action: 'BUY' | 'SELL' | 'HOLD'; prob: number; modelName: string; reason: string } | null = null;
            if (mlRes) {
              signal = {
                action: mlRes.signal,
                prob: mlRes.probability,
                modelName: 'Random Forest Ensemble 2.0',
                reason: mlRes.explanation?.find(e => e.includes('Semnal') || e.includes('Reversal')) || `Scor AI: ${mlRes.probability}%`
              };
              item.signal = { action: mlRes.signal, prob: mlRes.probability };
            } else {
              signal = await generateSignalServer(item.symbol, currentPrice);
              if (signal) item.signal = signal;
            }

            // Fetch opportunity score for symbol
            const oppInfo = this.state.marketOpportunities.find(o => o.symbol === item.symbol);
            const oppScore = oppInfo ? oppInfo.opportunityScore : (item.opportunityScore || 50);

            // Record Signal Audit Journal Entry
            const timeStr = new Intl.DateTimeFormat('en-US', {
              timeZone: this.state.timezone || 'Europe/Bucharest',
              hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
            }).format(new Date());

            const journalEntry: SignalJournalEntry = {
              id: `${item.symbol}_${Date.now()}_${Math.random().toString(36).substring(2,6)}`,
              timestamp: new Date().toISOString(),
              time: timeStr,
              symbol: item.symbol,
              price: currentPrice,
              rfProb: mlRes?.rfProb || signal?.prob || 50,
              metaProb: mlRes?.metaProb || 50,
              reversalScore: mlRes?.reversalSignal?.score || 0,
              isReversal: !!(mlRes?.reversalSignal?.isBullishReversal || mlRes?.reversalSignal?.isBearishReversal),
              reversalType: mlRes?.reversalSignal?.isBullishReversal ? 'bullish' : (mlRes?.reversalSignal?.isBearishReversal ? 'bearish' : undefined),
              newsSentiment: mlRes?.newsSentiment?.sentimentLabel || 'neutral',
              finalAction: signal?.action || 'HOLD',
              vetoReason: mlRes?.vetoReason || (signal?.action === 'HOLD' ? 'Consolidare / Filtru Confluență' : 'Semnal Aprobat'),
              explanation: mlRes?.explanation
            };

            if (!this.state.signalJournal) this.state.signalJournal = [];
            this.state.signalJournal.unshift(journalEntry);
            const signalLimit = this.state.maxLogs || 2500;
            if (this.state.signalJournal.length > signalLimit) {
              this.state.signalJournal = this.state.signalJournal.slice(0, signalLimit);
            }

            return { item, currentPrice, signal, mlRes, oppScore, oppInfo };
          } catch (err: any) {
            console.warn(`[ML Analysis Warning] Could not run ML analysis for ${item.symbol}: ${err?.message || err}`);
            return { item, currentPrice: item.price || 0, signal: null, mlRes: null, oppScore: 50, oppInfo: undefined };
          }
        }));
        itemsWithSignals.push(...batchResults);
      }

      // Sort candidates: Combine AI signal probability (60%) and Market Opportunity Score (40%) to select top scalping trades
      itemsWithSignals.sort((a, b) => {
        const scoreA = ((a.signal?.prob || 0) * 0.6) + ((a.oppScore || 50) * 0.4);
        const scoreB = ((b.signal?.prob || 0) * 0.6) + ((b.oppScore || 50) * 0.4);
        return scoreB - scoreA;
      });

      // Phase 2: Sequential Execution of Signals (prevents async balance race conditions)
      for (const { item, currentPrice, signal, mlRes, oppScore, oppInfo } of itemsWithSignals) {
        if (!signal || currentPrice <= 0) continue;

        const pos = this.state.positions.find(p => p.symbol === item.symbol);
        const isHolding = pos && pos.amount > 0;

        if (signal.action === 'BUY' && signal.prob >= 36) {
          // ANTI-WHIPSAW TRADE COOLDOWN CHECK
          const cooldown = getSymbolCooldown(item.symbol);
          if (cooldown && cooldown.active) {
            this.addLog(`[Filtru Cooldown 🛑] ${item.symbol} este în perioada de protecție anti-whipsaw (${cooldown.remainingMinutes} min rămase | Motiv: ${cooldown.reason}). Semnal BUY omis.`, 'warning');
            continue;
          }

          // Adaptive Volume Ratio Filter (User Rule)
          const volRatio = mlRes?.lastVolRatio !== undefined 
            ? mlRes.lastVolRatio 
            : (oppInfo?.volumeGrowth24h !== undefined ? (1 + oppInfo.volumeGrowth24h / 100) : 1.0);

          let minVolRatio = 0.50;
          if (oppScore >= 80) {
            minVolRatio = 0.20;
          } else if (oppScore >= 70) {
            minVolRatio = 0.30;
          } else {
            minVolRatio = 0.50;
          }

          if (!this.state.autoTradingActive) {
            this.addLog(`[Signal AI BUY] ${item.symbol} (Scor AI: ${signal.prob}% | OppScore: ${oppScore}/100 | ${signal.reason}), dar Auto-Trading este OPRIT.`, 'warning');
          } else if (isHolding) {
            // Already holding this position
          } else if (volRatio < minVolRatio) {
            this.addLog(`[Filtru Volum Adaptiv 2.0 📊] ${item.symbol} are semnal BUY (${signal.prob}%), dar VolRatio (${volRatio.toFixed(2)}x) este sub pragul minim adaptiv (${minVolRatio.toFixed(2)}x pentru OppScore ${oppScore}/100). Cumpărare omisă.`, 'warning');
          } else if (oppScore < 43) {
            // Filter out low opportunity score assets in AI.TRADE Bot 2.0
            this.addLog(`[Filtru Oportunitate AI 2.0] ${item.symbol} are semnal BUY (${signal.prob}%), dar OppScore (${oppScore}/100) este scăzut. Căutăm cele mai bune oportunități din piață.`, 'warning');
          } else if (this.state.balance < 9.5) {
            this.addLog(`[Signal AI BUY] ${item.symbol} (Scor AI: ${signal.prob}% | OppScore: ${oppScore}/100): Fonduri disponibile ($${this.state.balance.toFixed(2)} USDT) din cele ${this.state.positions.length} poziții deschise. Așteptăm eliberarea de capital (TP/SL) pentru noi intrări.`, 'warning');
          } else {
            const equity = this.calculateEquity();
            const pct = (this.state.positionSizePercent || 5) / 100;
            const targetAllocation = Math.max(10, parseFloat((equity * pct).toFixed(2)));
            const allocation = Math.min(this.state.balance, targetAllocation);

            if (allocation >= 9.5) {
              const actualAlloc = Math.min(this.state.balance, allocation);
              const amountToBuy = parseFloat((actualAlloc / currentPrice).toFixed(6));
              if (amountToBuy > 0) {
                this.addLog(`[Signal AI.TRADE 2.0] ${item.symbol}: BUY (AI Prob: ${signal.prob}% | OppScore: ${oppScore}/100 | Rank #${oppInfo?.rank || 1}). Alocare $${actualAlloc.toFixed(2)} USDT (${(pct * 100).toFixed(0)}% din Equity $${equity.toFixed(2)}). Executăm cumpărare scalping.`, 'info');
                await this.executeTrade(item.symbol, 'BUY', currentPrice, amountToBuy, {
                  mlProbability: signal.prob,
                  modelName: signal.modelName,
                  entryReason: `${signal.reason} | OppScore: ${oppScore}/100`
                });
              }
            } else {
              this.addLog(`[Signal AI BUY] ${item.symbol} (Scor: ${signal.prob}%): Alocarea rămasă ($${allocation.toFixed(2)} USDT) este sub minimul de $10 USDT per ordin.`, 'warning');
            }
          }
        } else if (isHolding) {
          // MULTI-FACTOR EXIT SCORE ENGINE & ASYMMETRIC RISK-REWARD ENGINE
          const pnlPercent = pos ? ((currentPrice - pos.entryPrice) / pos.entryPrice) * 100 : 0;
          const holdDurationMinutes = pos && (pos as any).openedAt ? (Date.now() - (pos as any).openedAt) / 60000 : 60;

          const exitScoreRes = calculateExitScore({
            currentMlProb: signal.prob,
            entryMlProb: (pos as any).entryMlProb || 75,
            currentOppScore: oppScore,
            entryOppScore: (pos as any).entryOppScore || 70,
            trendAlignment: oppInfo?.trendAlignment || (signal.prob >= 60 ? 'BULLISH' : (signal.prob <= 45 ? 'BEARISH' : 'NEUTRAL')),
            volRatio: oppInfo?.volumeGrowth24h ? (1 + (oppInfo.volumeGrowth24h / 100)) : 1.0,
            percentB: mlRes?.indicators?.percentB ?? 0.5,
            isBearishReversal: !!(mlRes?.reversalSignal?.isBearishReversal),
            pnlPercent,
            holdDurationMinutes
          });

          const { exitScore, recommendation, details: exitDetails } = exitScoreRes;

          let shouldExecuteSell = false;
          let sellReasonCategory = '';

          // A. WINNING POSITIONS (PnL > 0) -> Let Winners Run when OppScore is High!
          if (pnlPercent > 0) {
            if (pnlPercent >= 8.0) {
              shouldExecuteSell = true;
              sellReasonCategory = `Țintă Profit Înalt (+${pnlPercent.toFixed(2)}%)`;
            } 
            // User Rule 1: If OppScore has degraded (< 60) and PnL >= +1.5%, lock in profit!
            else if (pnlPercent >= 1.5 && oppScore < 60) {
              shouldExecuteSell = true;
              sellReasonCategory = `Profit Lock pe OppScore Degradat (PnL: +${pnlPercent.toFixed(2)}% | OppScore: ${oppScore}/100 < 60)`;
            }
            // User Rule 2: If OppScore is high (>= 80), HOLD even if ExitScore is moderate!
            else if (oppScore >= 80 && exitScore < 65) {
              shouldExecuteSell = false; // HOLD because strong market opportunity still exists!
            } 
            else if (pnlPercent >= 2.0 && exitScore >= 60) {
              shouldExecuteSell = true;
              sellReasonCategory = `Take Profit Inteligent (PnL: +${pnlPercent.toFixed(2)}% | ExitScore: ${exitScore}/100 | OppScore: ${oppScore}/100)`;
            } else if (pnlPercent >= 1.5 && (signal.reason.includes('BEARISH REVERSAL') || signal.prob < 40)) {
              shouldExecuteSell = true;
              sellReasonCategory = `Reversal Bearish pe Profit (+${pnlPercent.toFixed(2)}%)`;
            } else if (signal.action === 'SELL' && exitScore >= 55 && pnlPercent >= 2.5 && oppScore < 70) {
              shouldExecuteSell = true;
              sellReasonCategory = `Semnal AI SELL Confirmat pe Profit (+${pnlPercent.toFixed(2)}% | ExitScore: ${exitScore}/100)`;
            }
          } 
          // B. LOSING POSITIONS (PnL < 0) -> Configured Stop Loss & Smart Loss Cut!
          else {
            const configuredSL = -(Math.abs(this.state.stopLossPercent || 2.0));
            // 0. Configured Hard Stop Loss limit reached
            if (pnlPercent <= configuredSL) {
              shouldExecuteSell = true;
              sellReasonCategory = `Stop Loss Configurat ✂️ (PnL: ${pnlPercent.toFixed(2)}% <= ${configuredSL.toFixed(1)}%)`;
            }
            // 1. Smart Loss Cut (Cut loss at -1.8% if ExitScore >= 50 or ML confidence drops)
            else if (pnlPercent <= -1.8 && (exitScore >= 50 || signal.prob < 48 || oppScore < 50)) {
              shouldExecuteSell = true;
              sellReasonCategory = `Tăiere Agresivă Pierdere ✂️ (PnL: ${pnlPercent.toFixed(2)}% | ExitScore: ${exitScore}/100)`;
            }
            // 2. Urgent Bearish Reversal Loss Cut
            else if (pnlPercent <= -1.0 && (signal.reason.includes('BEARISH REVERSAL') || signal.prob <= 38)) {
              shouldExecuteSell = true;
              sellReasonCategory = `Reversal Bearish Urgent pe Pierdere (${pnlPercent.toFixed(2)}%)`;
            }
            // 3. Stagnant Loser Rotation (>45m & PnL < -1.5% & ExitScore >= 45)
            else if (pnlPercent <= -1.5 && holdDurationMinutes >= 45 && exitScore >= 45) {
              shouldExecuteSell = true;
              sellReasonCategory = `Rotire Stagnare pe Pierdere (${pnlPercent.toFixed(2)}%, >45m | ExitScore: ${exitScore}/100)`;
            }
          }

          if (shouldExecuteSell && this.state.autoTradingActive) {
            this.addLog(`[Exit Engine 2.0] ${item.symbol}: SELL (${sellReasonCategory} | ExitScore: ${exitScore}/100 | Details: ${exitDetails.join(', ')} | PnL: ${pnlPercent.toFixed(2)}% | Hold: ${Math.round(holdDurationMinutes)}m). Executăm vânzare.`, 'info');
            await this.executeTrade(item.symbol, 'SELL', currentPrice, pos!.amount, {
              mlProbability: signal.prob,
              modelName: signal.modelName,
              entryReason: `${sellReasonCategory} [ExitScore: ${exitScore}/100]`
            });
          } else if (isHolding) {
            if (pnlPercent >= 0.5 && exitScore < 50) {
              this.addLog(`[HOLD Câștigător 🚀] ${item.symbol}: PnL +${pnlPercent.toFixed(2)}% | ExitScore: ${exitScore}/100 (<50). Impulsul și scorul AI rămân puternice. Se lasă poziția să crească!`, 'info');
            } else if (pnlPercent < 0 && pnlPercent > -1.8) {
              this.addLog(`[HOLD Toleranță Micro-Pierdere 🛡️] ${item.symbol}: PnL ${pnlPercent.toFixed(2)}% este în zona normală de fluctuație scalping (> -1.8%). Retinem poziția.`, 'info');
            }
          }
        }
      }

      // Add continuous scan log entry to System Console Logs
      const buyCount = itemsWithSignals.filter(i => i.signal?.action === 'BUY').length;
      const sellCount = itemsWithSignals.filter(i => i.signal?.action === 'SELL').length;
      const holdCount = itemsWithSignals.filter(i => i.signal?.action === 'HOLD' || !i.signal).length;
      const scanTimeStr = new Intl.DateTimeFormat('en-US', {
        timeZone: this.state.timezone || 'Europe/Bucharest',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      }).format(new Date());

      this.addLog(
        `[SCANARE ML 2.0 🔍 ${scanTimeStr}] Evaluat ${itemsWithSignals.length} perechi crypto. Rezultate: ${buyCount} BUY, ${sellCount} SELL, ${holdCount} HOLD. Engine 24/7: ${this.state.autoTradingActive ? 'ACTIV' : 'STANDBY'}.`,
        'info'
      );
      this.savePersistedState();
    } catch (err: any) {
      console.warn(`[ML Analysis Error] ${err?.message || err}`);
    } finally {
      this.isRunningML = false;
    }
  }

  public triggerPulseCheck() {
    const now = Date.now();
    const lastCheckTime = this.state.lastCheckAt ? new Date(this.state.lastCheckAt).getTime() : now;
    const secondsAgo = Math.max(0, Math.floor((now - lastCheckTime) / 1000));
    const activeCount = this.state.watchlist.filter(w => w.active).length;
    const uptimeSeconds = Math.floor((now - new Date(this.state.serverStartedAt || now).getTime()) / 1000);

    const logMsg = `[PULS VERIFICAT 💓] Server Trading Engine este 100% ACTIV (24/7)! Uptime: ${Math.floor(uptimeSeconds / 60)} min | Ultima scanare: acum ${secondsAgo}s pe ${activeCount} perechi. Mode: ${this.state.binanceMode.toUpperCase()} | Auto-Trading: ${this.state.autoTradingActive ? 'PORNIT' : 'OPRIT'}.`;
    
    this.addLog(logMsg, 'success');
    this.savePersistedState();

    return {
      active: true,
      lastCheckAt: this.state.lastCheckAt,
      secondsAgo,
      uptimeSeconds,
      autoTradingActive: this.state.autoTradingActive,
      binanceMode: this.state.binanceMode,
      activeCount,
      positionsCount: this.state.positions.length,
      calculatedEquity: this.calculateEquity(),
      message: `✅ Server Trading Engine este 100% ACTIV (24/7). Ultima scanare a avut loc acum ${secondsAgo} secunde.`
    };
  }
}

export const botEngine = new ServerBotEngine();
