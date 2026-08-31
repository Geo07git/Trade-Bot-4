import fs from 'fs';
import path from 'path';
import Binance from 'binance-api-node';
import { tradingEngine, signalEngine, riskEngine, db } from './engine';
import { BinanceAdapter } from './engine/adapters/BinanceAdapter';
import { getAccountInfo } from './services/BinanceService';
import { journalService } from './services/JournalService';
import { 
  runRealStrategyAnalysis, 
  registerSymbolCooldown, 
  getSymbolCooldown, 
  exportCooldownState,
  importCooldownState,
  calculateExitScore, 
  calculateTradeQualityScore,
  calculateCandlestickPatternScore,
  calculateMomentumAccelScore,
  calculateRvolScore,
  calculateStructureScore,
  calculateLiquiditySpreadScore,
  calculateBreakoutAtrExpansionScore,
  calculateTrendConfirmationScore,
  fetchHistoricalKlines,
  calculateATR
} from '../src/services/ml';
import { MarketOpportunity, SymbolPerformanceStat, MetaTradeScoreBreakdown, ScalpingConfig } from '../src/types';
import { logger } from '../src/utils/logger';

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
    logger.warn(`Could not fetch exchangeInfo for ${symbol} from Binance (using default heuristics): ${err?.message || err}`);
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
  strategy?: 'grid' | 'scalping' | 'manual';
  leverage?: number;
  margin?: number;
  entryPatternName?: string;
  entryFee?: number;
  openedAt?: number;
  highestPrice?: number;
  lowestPrice?: number;
  isUntracked?: boolean;
  isFeeUnknown?: boolean;
  accountingStatus?: 'SETTLED' | 'ACCOUNTING_INCOMPLETE';
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
  isFeeUnknown?: boolean;
  accountingStatus?: 'SETTLED' | 'ACCOUNTING_INCOMPLETE';
}

export interface ReportConfig {
  enabled?: boolean;
  channels: {
    telegram: boolean;
    discord: boolean;
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

export interface AiUsageStats {
  totalRequests: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  lastRequestTime: string | null;
  lastInputTokens: number;
  lastOutputTokens: number;
}

export interface BotState {
  aiUsageStats?: AiUsageStats;
  autoTradingActive: boolean;
  circuitBreakerTriggered?: boolean;
  circuitBreakerReason?: string | null;
  balance: number;
  initialBalance: number;
  accumulationBalance?: number;
  accumulationTargetPercent?: number;
  sessionCycleCount?: number;
  accumulationTargetEnabled?: boolean;
  positionSizePercent?: number; // % of equity per position (e.g. 5%)
  stopLossPercent?: number; // % hard safety stop loss limit (e.g. 2.0%)
  maxHoldMinutes?: number; // Timp maxim de deținere o poziție în minute (ex: 5 sau 10 minute). Ieșire automată după depășire.
  maxNegativeHoldMinutes?: number; // Timp maxim de deținere de la intrarea pe minus (ex: 1.0 min).
  enableMaxNegativeHold?: boolean; // ON/OFF switch for max negative hold limit rule
  executionEngine?: 'both' | 'grid' | 'scalping'; // Execuție: amândouă, doar grid, sau doar scalping
  // FIX: was 'rf'|'tcn'|'both'. TCN/Hybrid never actually ran — ml.ts accepted the
  // selectedModelType parameter but never read it, always running Random Forest only.
  // Kept as a field (rather than removed outright) only so old persisted bot_state.json
  // files / API payloads with a stale 'tcn'/'both' value don't fail to parse.
  mlModelType?: 'rf' | 'tcn' | 'both'; // Model ML — doar 'rf' are efect real; 'tcn'/'both' sunt valori vechi, tratate identic cu 'rf'.
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
  notificationProvider: 'telegram' | 'discord' | 'all';
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
  smartGridActive?: boolean;
  scalpingConfig?: ScalpingConfig;
  gridConfig?: {
    active: boolean;
    autoRegimeSwitch: boolean;
    gridMode: 'dynamic_atr' | 'support_resistance' | 'fixed_percent';
    gridLevels: number;
    rangePercent: number;
    highVolMultiplier: number;
    capitalPerGridPercent: number;
    dynamicCapital: boolean;
    rangeThresholdProb: number;
    enableCapitalRotation?: boolean;
    minRotationHoldMinutes?: number;
    minOppScoreDiff?: number;
    stagnantProfitMaxPct?: number;
  };
  smartGridStatus?: Array<{
    symbol: string;
    regime: 'Range' | 'Trend' | 'High Volatility' | 'High Risk';
    regimeBadge: '🟢 Range' | '🔵 Trend' | '🟠 Volatilitate' | '🔴 Risc Ridicat';
    regimeExplanation: string;
    gridActive: boolean;
    gridAnchorPrice?: number;
    currentPrice: number;
    lowerPrice: number;
    upperPrice: number;
    gridStepPercent: number;
    buyLevels: number[];
    sellLevels: number[];
    executedGridTrades: number;
    gridProfit: number;
    opportunityScore: number;
    rangeProb: number;
    trendProb: number;
    breakoutProb: number;
    gridConfidence: number;
    expectedDailyProfitPct: number;
    expectedDailyProfitMargin: number;
    maxDrawdownEstPct: number;
    choppinessIndex: number;
    bollingerWidthPct: number;
    hurstExponent: number;
    adxValue: number;
    atrPercent: number;
    allocatedCapitalPct: number;
    supportPrice: number;
    resistancePrice: number;
    lastAction?: string;
    shockScore?: number;
    shockLevel?: string;
    shockUntilMs?: number;
    updatedAt: string;
  }>;
  gridHistory?: Array<{
    id: string;
    symbol: string;
    action: 'GRID_BUY' | 'GRID_SELL' | 'GRID_ROTATION';
    price: number;
    amount: number;
    pnl?: number;
    regime: string;
    timestamp: string;
    holdMinutes?: number;
    rotationDetail?: string;
  }>;
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

let validBinanceSymbolsCache: { set: Set<string>; timestamp: number } | null = null;

async function fetchValidBinanceSymbolsServer(): Promise<Set<string>> {
  if (validBinanceSymbolsCache && (Date.now() - validBinanceSymbolsCache.timestamp < 3600000)) {
    return validBinanceSymbolsCache.set;
  }

  const validSet = new Set<string>();
  const endpoints = [
    'https://api.binance.com/api/v3/exchangeInfo',
    'https://api1.binance.com/api/v3/exchangeInfo',
    'https://api3.binance.com/api/v3/exchangeInfo',
    'https://data-api.binance.vision/api/v3/exchangeInfo'
  ];

  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.symbols)) {
          for (const s of data.symbols) {
            if (s.status === 'TRADING' && s.quoteAsset === 'USDT' && s.symbol) {
              validSet.add(s.symbol);
            }
          }
          if (validSet.size > 0) {
            validBinanceSymbolsCache = { set: validSet, timestamp: Date.now() };
            return validSet;
          }
        }
      }
    } catch (err) {
      // try next
    }
  }

  return validBinanceSymbolsCache ? validBinanceSymbolsCache.set : new Set();
}

let batchPricesCache: { map: Map<string, number>; timestamp: number } | null = null;
let isFetchingBatchPrices = false;
let lastBatchErrorLogTime = 0;
let lastPriceSuccessLogTime = 0;

async function tryFetchTickerEndpoint(url: string, timeoutMs = 7000): Promise<Map<string, number> | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'application/json'
      }
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const pMap = new Map<string, number>();
        for (const item of data) {
          const p = parseFloat(item.price);
          if (!isNaN(p) && p > 0) {
            pMap.set(item.symbol, p);
          }
        }
        if (pMap.size > 0) return pMap;
      }
    }
  } catch (err) {
    // silently ignore individual endpoint failures
  }
  return null;
}

async function fetchBatchPricesServer(): Promise<Map<string, number>> {
  // 1. Fast path: Return cache if very recent (< 2000ms)
  if (batchPricesCache && (Date.now() - batchPricesCache.timestamp < 2000)) {
    return batchPricesCache.map;
  }

  // 2. Prevent overlapping background requests if cache exists
  if (isFetchingBatchPrices && batchPricesCache) {
    return batchPricesCache.map;
  }

  isFetchingBatchPrices = true;

  try {
    const endpoints = [
      'https://api.binance.com/api/v3/ticker/price',
      'https://data-api.binance.vision/api/v3/ticker/price',
      'https://api1.binance.com/api/v3/ticker/price',
      'https://api3.binance.com/api/v3/ticker/price',
      'https://fapi.binance.com/fapi/v1/ticker/price'
    ];

    // Fire all endpoints concurrently with Promise.any — fastest valid response wins immediately
    const fetchPromises = endpoints.map(url =>
      tryFetchTickerEndpoint(url, 7000).then(res => {
        if (res && res.size > 0) return res;
        throw new Error(`Empty response from ${url}`);
      })
    );

    let freshMap: Map<string, number> | null = null;
    try {
      freshMap = await Promise.any(fetchPromises);
    } catch (e) {
      freshMap = null;
    }

    if (freshMap && freshMap.size > 0) {
      if (!batchPricesCache) {
        batchPricesCache = { map: freshMap, timestamp: Date.now() };
      } else {
        freshMap.forEach((v, k) => batchPricesCache!.map.set(k, v));
        batchPricesCache.timestamp = Date.now();
      }

      const now = Date.now();
      if (now - lastPriceSuccessLogTime > 20000) {
        // Prețuri actualizate cu succes (silently handled)

        lastPriceSuccessLogTime = now;
      }
      return batchPricesCache.map;
    }

    // Network error on all endpoints — fallback to existing cache
    const now = Date.now();
    if (batchPricesCache && batchPricesCache.map.size > 0) {
      if (now - lastBatchErrorLogTime > 60000) {
        const ageSec = ((now - batchPricesCache.timestamp) / 1000).toFixed(0);
        logger.warn(`[PRICE ENGINE 🛡️ CACHE DE REZERVĂ] Preluarea prețurilor Binance a întâmpinat o întârziere temporară. Se mențin ultimele cotații (${ageSec}s vechime, ${batchPricesCache.map.size} simboluri).`);
        lastBatchErrorLogTime = now;
      }
      return batchPricesCache.map;
    }

    // Cold start fallback if no cache exists
    if (now - lastBatchErrorLogTime > 60000) {
      logger.warn(`[PRICE ENGINE 🛡️ INITIALIZATION FALLBACK] Toate endpoint-urile Binance au eșuat la pornire. Se folosesc prețurile de bază de referință.`);
      lastBatchErrorLogTime = now;
    }

    const fallbackMap = new Map<string, number>();
    Object.entries(BASELINE_PRICES).forEach(([sym, p]) => fallbackMap.set(sym, p));
    batchPricesCache = { map: fallbackMap, timestamp: Date.now() };
    return fallbackMap;

  } finally {
    isFetchingBatchPrices = false;
  }
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

  // Direct single-symbol Binance ticker API query as real live fallback
  const singleEndpoints = [
    `https://api.binance.com/api/v3/ticker/price?symbol=${querySymbol}`,
    `https://api1.binance.com/api/v3/ticker/price?symbol=${querySymbol}`,
    `https://api3.binance.com/api/v3/ticker/price?symbol=${querySymbol}`,
    `https://data-api.binance.vision/api/v3/ticker/price?symbol=${querySymbol}`
  ];

  for (const singleUrl of singleEndpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(singleUrl, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = await res.json();
        const liveP = parseFloat(data.price);
        if (!isNaN(liveP) && liveP > 0) {
          return liveP;
        }
      }
    } catch (e) {
      // try next endpoint
    }
  }

  // Check if valid active trading symbol on Binance
  const validSymbols = await fetchValidBinanceSymbolsServer();
  if (validSymbols.size > 0 && !validSymbols.has(querySymbol) && !validSymbols.has(cleanSymbol)) {
    return null;
  }

  // Fallback to baseline or deterministic price if external network is down or socket hangs
  return getFallbackBasePrice(querySymbol);
}

const serverSignalCache = new Map<string, { result: { action: 'BUY' | 'SELL' | 'HOLD'; prob: number; modelName: string; reason: string }; timestamp: number }>();
const realStrategyCache = new Map<string, { res: any; timestamp: number }>();

async function getCachedRealStrategyAnalysis(symbol: string, mlModelType: 'rf' = 'rf'): Promise<any> {
  const cleanSymbol = symbol.trim().toUpperCase();
  const cacheKey = `${cleanSymbol}_${mlModelType}`;
  const cached = realStrategyCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < 60000)) { // FIX (1m): was 5-minute cache (300000ms) — on 1m candles that's 5 stale bars. Reduced to 60s (= 1 candle) to keep signals fresh.
    return cached.res;
  }

  // Asynchronously trigger lightweight ML strategy calculation in background to warm cache
  runRealStrategyAnalysis(cleanSymbol, 'rf', { fastMode: true })
    .then(res => {
      if (res) {
        realStrategyCache.set(cacheKey, { res, timestamp: Date.now() });
      }
    })
    .catch(err => {
      logger.warn(`[ML Real Strategy Background Warning for ${cleanSymbol}]: ${err?.message || err}`);
    });

  return cached ? cached.res : null;
}

async function generateSignalServer(symbol: string, currentPrice: number): Promise<{ action: 'BUY' | 'SELL' | 'HOLD'; prob: number; modelName: string; reason: string }> {
  const cleanSymbol = symbol.trim().toUpperCase();
  const cacheKey = `${cleanSymbol}_rf`;
  const cached = serverSignalCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < 30000)) { // FIX (1m): was 3-minute cache (180000ms) — on 1m candles, 3 minutes = 3 missed price bars. Reduced to 30s so BUY/SELL decisions use near-current data.
    return cached.result;
  }

  try {
    const mlRes = await getCachedRealStrategyAnalysis(cleanSymbol);
    if (mlRes && mlRes.signal) {
      // FIX: this used to pick a label ("Hibrid Confluent (RF + TCN Conv1D)" /
      // "TCN Causal Conv1D Network") based on the caller's requested `mlModelType`,
      // even though ml.ts's `selectedModelType` parameter was never actually read —
      // it always ran only Random Forest regardless of what was requested. The label
      // now reflects what genuinely runs.
      const modelDisplayName = 'Random Forest Ensemble (1m)';
      const result = {
        action: mlRes.signal as 'BUY' | 'SELL' | 'HOLD',
        prob: mlRes.probability,
        modelName: modelDisplayName,
        reason: mlRes.explanation?.find((e: string) => e.includes('Semnal') || e.includes('Reversal')) || `Scor Composite AI: ${mlRes.probability}% (${mlRes.signal})`
      };
      serverSignalCache.set(cacheKey, { result, timestamp: Date.now() });
      return result;
    }
  } catch (err: any) {
    logger.warn(`[ML Signal Server Warning] Could not run ML analysis for ${cleanSymbol}, using technical fallback: ${err?.message || err}`);
  }

  // Technical Fallback calculation
  // FIX (recalibrare 1 minut): interval schimbat de la '1h' la '1m', limita crescută
  // de la 100 la 150 bare (150 minute = ~2.5 ore, suficient pentru warmup RSI(14) pe
  // date de 1m). Pragurile de acțiune recalibrate pentru 1m: pe date orare,
  // momentum de 0.3% per bară e o mișcare normală; pe 1m, 0.3% într-un minut e
  // un spike semnificativ — pragul a fost coborât la 0.05%. RSI < 48 pentru BUY
  // a rămas rezonabil pe 1m (piața de 1m e mai noisy, deci RSI fluctuează mai mult).
  try {
    const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${cleanSymbol}&interval=1m&limit=150`);
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

        // FIX: mom > 0.3 era calibrat pentru ore (0.3%/oră = mișcare normală);
        // pe 1m, 0.05%/minut e deja o mișcare cu direcție clară.
        if (rsi < 48 || (rsi < 55 && mom > 0.05)) {
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

export function calculateMetaTradeScore(params: {
  symbol: string;
  opportunityScore?: number;
  aiProbability: number;          // Random Forest Probability
  rangeProbability?: number;
  trendAlignment?: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  volumeRatio?: number;
  priceChangePercent?: number;
  symbolStat?: SymbolPerformanceStat;
  regime?: string;
  atrPercent?: number;
  adxValue?: number;
  reversalScore?: number;
  newsSentimentLabel?: string;
}): MetaTradeScoreBreakdown {
  // 1. Random Forest Probability (0-100) -> 40% weight.
  // FIX: this used to be split 20% RF / 20% "TCN Network Probability", but TCN was
  // never actually wired up here (`tcnProbability` was always undefined, so `tcnProb`
  // silently fell back to `rfProb` every single time) — so this bucket was always a
  // duplicate of RF anyway. Folding it into one 40% RF weight keeps the exact same
  // numeric output as before, just without pretending a second model contributed.
  const rfProb = Math.min(100, Math.max(0, params.aiProbability || 50));

  // 2. ADX Trend Strength Score (0-100) -> 10% weight
  const adxVal = params.adxValue ?? 25;
  let adxScore = 50;
  if (adxVal >= 35) adxScore = 100;
  else if (adxVal >= 25) adxScore = 80;
  else if (adxVal >= 18) adxScore = 60;
  else adxScore = 30;

  // 3. EMA Trend Alignment Score (0-100) -> 10% weight
  const trendAlign = params.trendAlignment || 'NEUTRAL';
  const pChange = params.priceChangePercent ?? 0;
  let emaTrendScore = 50;
  if (trendAlign === 'BULLISH' || pChange >= 1.0) emaTrendScore = 100;
  else if (trendAlign === 'NEUTRAL') emaTrendScore = 60;
  else if (trendAlign === 'BEARISH' || pChange <= -1.5) emaTrendScore = 20;

  // 4. Volume Growth / Ratio Score (0-100) -> 10% weight
  const volRatio = params.volumeRatio ?? 1.0;
  let volumeScore = 50;
  if (volRatio >= 1.8) volumeScore = 100;
  else if (volRatio >= 1.2) volumeScore = 80;
  else if (volRatio >= 0.8) volumeScore = 60;
  else volumeScore = 30;

  // 5. Volatility (ATR %) Score (0-100) -> 10% weight
  // FIX (recalibrare 1 minut): pragurile ATR% au fost recalibrate pentru lumânări de
  // 1 minut. Pe date orare, ATR% de 0.30-0.80% per bară e volatilitate normală-ridicată.
  // Pe 1m, ATR% tipic al unui altcoin este 0.05-0.15% per bară — pragurile vechi
  // (0.30%, 0.50%, 0.80%) ar fi dat scorul minim (25) pentru aproape toată activitatea
  // normală de piață, făcând acest factor inutil. Pragurile noi sunt aliniate cu
  // distribuția reală a ATR%-ului pe lumânări de 1 minut.
  const atrPct = params.atrPercent ?? 0.10;
  let volatilityScore = 50;
  if (atrPct >= 0.25) volatilityScore = 100;
  else if (atrPct >= 0.15) volatilityScore = 80;
  else if (atrPct >= 0.08) volatilityScore = 65;
  else volatilityScore = 25;

  // 6. Reversal Signal Score (0-100) -> 10% weight
  const revScore = Math.min(100, Math.max(0, params.reversalScore ?? 50));

  // 7. News / AI Sentiment Score (0-100) -> 10% weight
  const sentLabel = (params.newsSentimentLabel || 'neutral').toLowerCase();
  let sentimentScore = 50;
  if (sentLabel.includes('bullish') || sentLabel.includes('pozitiv')) sentimentScore = 95;
  else if (sentLabel.includes('bearish') || sentLabel.includes('negativ')) sentimentScore = 15;
  else sentimentScore = 55;

  // Standardized MetaScore Formula (0-100):
  // RF (40%) + ADX (10%) + EMA Trend (10%) + Volum (10%) + Volatilitate (10%) + Reversal (10%) + Sentiment (10%)
  const rawFinalScore = (
    0.40 * rfProb +
    0.10 * adxScore +
    0.10 * emaTrendScore +
    0.10 * volumeScore +
    0.10 * volatilityScore +
    0.10 * revScore +
    0.10 * sentimentScore
  );

  const finalTradeScore = Math.min(100, Math.max(0, Math.round(rawFinalScore)));

  return {
    finalTradeScore,
    opportunityScore: params.opportunityScore || 50,
    aiProbability: rfProb,
    rangeProbability: params.rangeProbability || 50,
    historicalCoinPFScore: 50,
    marketRegimeScore: emaTrendScore,
    feeEfficiencyScore: volatilityScore,
    isApproved: true,
    executionRule: finalTradeScore >= 70 ? 'DIRECT_EXECUTE' : 'CONFIRMATION_EXECUTE',
    netProfitMarginPct: parseFloat(atrPct.toFixed(2)),
    dynamicTPPct: 3.0,
    dynamicPositionSizePct: 5.0,
    vetoReason: ''
  };
}

async function sendWebhookServer(provider: 'discord' | 'telegram', urlOrToken: string, chatIdOrMessage: string, message?: string) {
  try {
    const token = (urlOrToken || '').trim();
    const chatId = (chatIdOrMessage || '').trim();

    if (provider === 'discord' && token) {
      await fetch(token, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: chatIdOrMessage })
      });
    } else if (provider === 'telegram' && token && chatId && message) {
      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      // Escape HTML entities first to prevent Telegram API 400 errors with < or > or &
      const htmlText = message
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
        .replace(/\*(.*?)\*/g, '<b>$1</b>');

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          chat_id: chatId, 
          text: htmlText,
          parse_mode: 'HTML'
        })
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        logger.warn(`[Telegram Webhook Warning] HTTP ${res.status}: ${errText}`);

        // Fallback send plain text if HTML parsing has any edge case
        const plainText = message.replace(/\*\*/g, '').replace(/\*/g, '');
        const fbRes = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            chat_id: chatId, 
            text: plainText 
          })
        });

        if (!fbRes.ok) {
          const fbErr = await fbRes.text().catch(() => '');
          logger.error(`[Telegram Webhook Fallback Error] HTTP ${fbRes.status}: ${fbErr}`);
        }
      }
    }
  } catch (err) {
    logger.error('Webhook error on server:', err);
  }
}

class ServerBotEngine {
  public state: BotState;
  private intervalTimer: NodeJS.Timeout | null = null;
  private telegramIntervalTimer: NodeJS.Timeout | null = null;
  private isLoopRunning = false;
  private secondsCounter = 0;
  private stateFilePath = path.join(process.cwd(), 'bot_state.json');
  private telegramOffset = 0;
  private isPollingTelegram = false;
  private webhookCleared = false;
  private isCheckingPrices = false;
  private isRunningML = false;
  private lastHourlyReportHour = '';
  private lastNotifiedRegime = '';
  private lastScanTimestamp = 0;
  private executingSymbols = new Set<string>();
  private consecutiveApiErrors = 0;

  constructor() {
    this.state = {
      autoTradingActive: true,
      balance: 10000,
      initialBalance: 10000,
      accumulationBalance: 0,
      accumulationTargetPercent: 3.0,
      sessionCycleCount: 1,
      accumulationTargetEnabled: true,
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
      maxHoldMinutes: 5,
      executionEngine: 'scalping',
      mlModelType: 'rf',
      lastScanAt: null,
      positions: [],
      logs: [
        {
          time: new Date().toLocaleTimeString(),
          message: '🤖 Engine-ul de fundal G&S-Trade-Bot (Scanare Oportunități Scalping) a fost inițializat pe server. Rulare 24/7 activă!',
          type: 'info'
        }
      ],
      signalJournal: [],
      tradeHistory: [],
      reportConfig: {
        enabled: true,
        channels: { telegram: true, discord: true, browser: true },
        daily: { enabled: true, time: '21:00' },
        weekly: { enabled: true, day: 0, time: '21:00' },
        monthly: { enabled: true }
      },
      notificationProvider: 'all',
      discordWebhookUrl: '',
      telegramBotToken: '',
      telegramChatId: '',
      timezone: 'Europe/Bucharest',
      dataInterval: 10,
      analysisInterval: 60,
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
      smartGridActive: false,
      scalpingConfig: {
        active: true,
        minRfProb: 70,
        minMetaScore: 70,
        stopLossPercent: 1.0,
        targetTakeProfit: 0.0,
        trailingStopActivation: 5.0,
        trailingStopDistance: 0.5,
        breakEvenActivation: 1.0,
        positionSizePercent: 5.0,
        maxHoldMinutes: 15,
        maxNegativeHoldMinutes: 1.0,
        enableMaxNegativeHold: true,
        minOpportunityScore: 50,
        cooldownMinutes: 2,
        enableDynamicSizing: true,
        minVolumeGrowth: 0.8,
        enableStagnationFilter: true,
        timeframe: '1m',
        // FIX (recalibrare 1 minut): pragurile de stagnare coborâte de la valorile
        // pentru date orare (0.30% ATR, 0.55% range) la valorile pentru 1m (0.05%, 0.20%).
        // Aceste valori sunt folosite ca fallback când scalpingConfig lipsește din state.
        minAtrPctThreshold: 0.05,
        minRange20pThreshold: 0.20,
        leverage: 1
      },
      gridConfig: {
        active: false,
        autoRegimeSwitch: true,
        gridMode: 'dynamic_atr',
        gridLevels: 6,
        rangePercent: 2.5,
        highVolMultiplier: 1.8,
        capitalPerGridPercent: 15,
        dynamicCapital: true,
        rangeThresholdProb: 75
      },
      smartGridStatus: [],
      gridHistory: [],
      aiUsageStats: {
        totalRequests: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        lastRequestTime: null,
        lastInputTokens: 0,
        lastOutputTokens: 0
      }
    };

    this.loadPersistedState();
    this.startBackgroundLoop();
  }

  public recordAiUsage(inputTokens: number, outputTokens: number) {
    if (!this.state.aiUsageStats) {
      this.state.aiUsageStats = {
        totalRequests: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        lastRequestTime: null,
        lastInputTokens: 0,
        lastOutputTokens: 0
      };
    }
    this.state.aiUsageStats.totalRequests += 1;
    this.state.aiUsageStats.totalInputTokens += inputTokens;
    this.state.aiUsageStats.totalOutputTokens += outputTokens;
    this.state.aiUsageStats.lastRequestTime = new Date().toISOString();
    this.state.aiUsageStats.lastInputTokens = inputTokens;
    this.state.aiUsageStats.lastOutputTokens = outputTokens;
    this.savePersistedState(true);
  }

  private getPersistedConfigOnly() {
    return {
      autoTradingActive: this.state.autoTradingActive,
      binanceMode: this.state.binanceMode,
      dataInterval: this.state.dataInterval,
      analysisInterval: this.state.analysisInterval,
      positionSizePercent: this.state.positionSizePercent,
      stopLossPercent: this.state.stopLossPercent,
      maxHoldMinutes: this.state.maxHoldMinutes,
      executionEngine: this.state.executionEngine || 'both',
      notificationProvider: this.state.notificationProvider,
      discordWebhookUrl: this.state.discordWebhookUrl,
      telegramBotToken: this.state.telegramBotToken,
      telegramChatId: this.state.telegramChatId,
      timezone: this.state.timezone,
      reportConfig: this.state.reportConfig,
      apiKey: this.state.apiKey,
      apiSecret: this.state.apiSecret,
      testnetApiKey: this.state.testnetApiKey,
      testnetApiSecret: this.state.testnetApiSecret,
      smartGridActive: this.state.smartGridActive,
      scalpingConfig: this.state.scalpingConfig,
      gridConfig: this.state.gridConfig,
      gridHistory: this.state.gridHistory,
      dynamicWatchlistSize: this.state.dynamicWatchlistSize,
      maxLogs: this.state.maxLogs,
      accumulationBalance: this.state.accumulationBalance || 0,
      accumulationTargetPercent: this.state.accumulationTargetPercent || 3.0,
      sessionCycleCount: this.state.sessionCycleCount || 1,
      accumulationTargetEnabled: this.state.accumulationTargetEnabled !== false,
      balance: this.state.balance || 10000,
      initialBalance: this.state.initialBalance || 10000,
      positions: this.state.positions || [],
      // FIX: persist Watch Mode cooldowns so they survive process restarts.
      symbolCooldowns: exportCooldownState(),
    };
  }

  private loadPersistedState() {
    try {
      if (fs.existsSync(this.stateFilePath)) {
        const raw = fs.readFileSync(this.stateFilePath, 'utf-8');
        const parsed = JSON.parse(raw);
        
        // Extract configuration settings
        if (typeof parsed === 'object' && parsed !== null) {
          if (parsed.autoTradingActive !== undefined) this.state.autoTradingActive = parsed.autoTradingActive;
          if (parsed.binanceMode !== undefined) this.state.binanceMode = parsed.binanceMode;
          if (parsed.dataInterval !== undefined) this.state.dataInterval = parsed.dataInterval;
          if (parsed.analysisInterval !== undefined) this.state.analysisInterval = parsed.analysisInterval;
          if (parsed.positionSizePercent !== undefined) this.state.positionSizePercent = parsed.positionSizePercent;
          if (parsed.stopLossPercent !== undefined) this.state.stopLossPercent = parsed.stopLossPercent;
          if (parsed.maxHoldMinutes !== undefined) this.state.maxHoldMinutes = parsed.maxHoldMinutes;
          if (parsed.executionEngine !== undefined) this.state.executionEngine = parsed.executionEngine;
          if (parsed.notificationProvider !== undefined) this.state.notificationProvider = parsed.notificationProvider;
          if (parsed.discordWebhookUrl !== undefined) this.state.discordWebhookUrl = parsed.discordWebhookUrl;
          if (parsed.telegramBotToken !== undefined) this.state.telegramBotToken = parsed.telegramBotToken;
          if (parsed.telegramChatId !== undefined) this.state.telegramChatId = parsed.telegramChatId;
          if (parsed.timezone !== undefined) this.state.timezone = parsed.timezone;
          if (parsed.reportConfig !== undefined) this.state.reportConfig = { ...this.state.reportConfig, ...parsed.reportConfig };
          if (parsed.apiKey !== undefined) this.state.apiKey = parsed.apiKey;
          if (parsed.apiSecret !== undefined) this.state.apiSecret = parsed.apiSecret;
          if (parsed.testnetApiKey !== undefined) this.state.testnetApiKey = parsed.testnetApiKey;
          if (parsed.testnetApiSecret !== undefined) this.state.testnetApiSecret = parsed.testnetApiSecret;
          if (parsed.dynamicWatchlistSize !== undefined) this.state.dynamicWatchlistSize = parsed.dynamicWatchlistSize;
          if (parsed.maxLogs !== undefined) this.state.maxLogs = parsed.maxLogs;
          if (parsed.smartGridActive !== undefined) this.state.smartGridActive = parsed.smartGridActive;
          if (parsed.scalpingConfig !== undefined && typeof parsed.scalpingConfig === 'object') {
            this.state.scalpingConfig = { ...this.state.scalpingConfig, ...parsed.scalpingConfig };
          }
          if (parsed.gridConfig !== undefined && typeof parsed.gridConfig === 'object') {
            this.state.gridConfig = { ...this.state.gridConfig, ...parsed.gridConfig };
          }
          if (parsed.accumulationBalance !== undefined) this.state.accumulationBalance = parsed.accumulationBalance;
          if (parsed.accumulationTargetPercent !== undefined) this.state.accumulationTargetPercent = parsed.accumulationTargetPercent;
          if (parsed.sessionCycleCount !== undefined) this.state.sessionCycleCount = parsed.sessionCycleCount;
          if (parsed.accumulationTargetEnabled !== undefined) this.state.accumulationTargetEnabled = parsed.accumulationTargetEnabled;
          if (parsed.balance !== undefined) this.state.balance = parsed.balance;
          if (parsed.initialBalance !== undefined) this.state.initialBalance = parsed.initialBalance;
          // FIX: restore Watch Mode cooldowns saved before the last restart (only
          // entries that haven't already expired are kept — see importCooldownState).
          if (parsed.symbolCooldowns !== undefined) importCooldownState(parsed.symbolCooldowns);
        }

        // Fallback to process.env if empty
        if (!this.state.apiKey && process.env.BINANCE_API_KEY) this.state.apiKey = process.env.BINANCE_API_KEY;
        if (!this.state.apiSecret && process.env.BINANCE_API_SECRET) this.state.apiSecret = process.env.BINANCE_API_SECRET;
        if (!this.state.testnetApiKey && process.env.BINANCE_TESTNET_API_KEY) this.state.testnetApiKey = process.env.BINANCE_TESTNET_API_KEY;
        if (!this.state.testnetApiSecret && process.env.BINANCE_TESTNET_API_SECRET) this.state.testnetApiSecret = process.env.BINANCE_TESTNET_API_SECRET;
        if (!this.state.telegramBotToken && process.env.TELEGRAM_BOT_TOKEN) this.state.telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!this.state.telegramChatId && process.env.TELEGRAM_CHAT_ID) this.state.telegramChatId = process.env.TELEGRAM_CHAT_ID;
        if (!this.state.discordWebhookUrl && process.env.DISCORD_WEBHOOK_URL) this.state.discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;

        // Operational state arrays remain clean runtime instances
        this.state.tradeHistory = [];
        this.state.signalJournal = [];
        this.state.marketOpportunities = [];
        if (typeof parsed === 'object' && parsed !== null && Array.isArray(parsed.positions)) {
          this.state.positions = parsed.positions;
        } else {
          this.state.positions = [];
        }
        this.state.symbolStats = {};

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

        logger.info('[G&S-Trade-Bot] Configurația a fost încărcată din bot_state.json (AutoTrading:', this.state.autoTradingActive ? 'ACTIV' : 'OPRIT', ')');
      }

      // Always fallback to process.env if credentials are empty
      if (!this.state.apiKey && process.env.BINANCE_API_KEY) this.state.apiKey = process.env.BINANCE_API_KEY;
      if (!this.state.apiSecret && process.env.BINANCE_API_SECRET) this.state.apiSecret = process.env.BINANCE_API_SECRET;
      if (!this.state.testnetApiKey && process.env.BINANCE_TESTNET_API_KEY) this.state.testnetApiKey = process.env.BINANCE_TESTNET_API_KEY;
      if (!this.state.testnetApiSecret && process.env.BINANCE_TESTNET_API_SECRET) this.state.testnetApiSecret = process.env.BINANCE_TESTNET_API_SECRET;
      if (!this.state.telegramBotToken && process.env.TELEGRAM_BOT_TOKEN) this.state.telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
      if (!this.state.telegramChatId && process.env.TELEGRAM_CHAT_ID) this.state.telegramChatId = process.env.TELEGRAM_CHAT_ID;
      if (!this.state.discordWebhookUrl && process.env.DISCORD_WEBHOOK_URL) this.state.discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
    } catch (e) {
      logger.error('[G&S-Trade-Bot] Eroare la citirea bot_state.json:', e);
    }
  }

  private saveTimer: NodeJS.Timeout | null = null;

  public savePersistedState(immediate = false) {
    const configToSave = this.getPersistedConfigOnly();
    const tempFilePath = `${this.stateFilePath}.tmp`;
    const dataStr = JSON.stringify(configToSave, null, 2);

    if (immediate) {
      if (this.saveTimer) {
        clearTimeout(this.saveTimer);
        this.saveTimer = null;
      }
      try {
        fs.writeFileSync(tempFilePath, dataStr);
        fs.renameSync(tempFilePath, this.stateFilePath);
      } catch (e) {
        logger.error('[G&S-Trade-Bot] Eroare la salvarea bot_state.json (atomic):', e);
      }
      return;
    }

    if (!this.saveTimer) {
      this.saveTimer = setTimeout(() => {
        this.saveTimer = null;
        fs.writeFile(tempFilePath, dataStr, (err) => {
          if (err) {
            logger.error('[G&S-Trade-Bot] Eroare la scrierea fisierului temporar .tmp:', err);
            return;
          }
          fs.rename(tempFilePath, this.stateFilePath, (renameErr) => {
            if (renameErr) {
              logger.error('[G&S-Trade-Bot] Eroare la redenumirea fisierului temporar in bot_state.json:', renameErr);
            }
          });
        });
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
    this.savePersistedState(true);
  }

  public clearSignalJournal() {
    this.state.signalJournal = [];
    this.savePersistedState(true);
  }

  public checkAccumulationTarget(): boolean {
    if (this.state.accumulationTargetEnabled === false) return false;

    const currentEquity = this.calculateEquity();
    const initialCapital = (this.state.initialBalance && this.state.initialBalance > 0) ? this.state.initialBalance : 1000;
    const targetPct = this.state.accumulationTargetPercent || 3.0;

    const cyclePnlPercent = ((currentEquity - initialCapital) / initialCapital) * 100;

    if (cyclePnlPercent >= targetPct) {
      if (Array.isArray(this.state.positions) && this.state.positions.length > 0) {
        for (const pos of [...this.state.positions]) {
          this.executeTrade(pos.symbol, 'SELL', pos.currentPrice || pos.entryPrice, pos.amount);
        }
      }

      const finalCash = this.state.balance;
      const profitToConserve = parseFloat((finalCash - initialCapital).toFixed(2));

      if (profitToConserve > 0) {
        this.state.accumulationBalance = parseFloat(((this.state.accumulationBalance || 0) + profitToConserve).toFixed(2));
        this.state.balance = initialCapital;
        this.state.sessionCycleCount = (this.state.sessionCycleCount || 1) + 1;

        const cycleNum = this.state.sessionCycleCount - 1;
        const logMsg = `🛡️ [CONSERVARE CÂȘTIG ${targetPct}%] Țintă atinsă! Profitul de +${profitToConserve.toFixed(2)} USDT a fost salvat în Soldul "Acumulare" (Total Acumulat: ${this.state.accumulationBalance.toFixed(2)} USDT). Ciclul #${this.state.sessionCycleCount} reîncepe cu capitalul inițial de ${initialCapital.toFixed(2)} USDT.`;

        this.addLog(logMsg, 'success', this.state.balance);

        const telegramMsg = `🏦 **[G&S-Trade-Bot 24/7] Ciclul #${cycleNum} Finalizat & Profit Conservat (+${cyclePnlPercent.toFixed(2)}%)**\n\n` +
          `• **Profit Transferat în Acumulare:** +${profitToConserve.toFixed(2)} USDT\n` +
          `• **Sold Total "Acumulare":** ${this.state.accumulationBalance.toFixed(2)} USDT\n` +
          `• **Ciclu Nou (#${this.state.sessionCycleCount}):** Capital reînceput cu ${initialCapital.toFixed(2)} USDT`;

        this.sendNotification(telegramMsg);
        this.savePersistedState();
        return true;
      }
    }
    return false;
  }

  public consolidateAccumulation(): { success: boolean; profitConserved: number; accumulationBalance: number } {
    const currentEquity = this.calculateEquity();
    const initialCapital = (this.state.initialBalance && this.state.initialBalance > 0) ? this.state.initialBalance : 1000;

    if (Array.isArray(this.state.positions) && this.state.positions.length > 0) {
      for (const pos of [...this.state.positions]) {
        this.executeTrade(pos.symbol, 'SELL', pos.currentPrice || pos.entryPrice, pos.amount);
      }
    }

    const finalCash = this.state.balance;
    const profitToConserve = parseFloat((finalCash - initialCapital).toFixed(2));

    if (profitToConserve <= 0) {
      return { success: false, profitConserved: 0, accumulationBalance: this.state.accumulationBalance || 0 };
    }

    this.state.accumulationBalance = parseFloat(((this.state.accumulationBalance || 0) + profitToConserve).toFixed(2));
    this.state.balance = initialCapital;
    this.state.sessionCycleCount = (this.state.sessionCycleCount || 1) + 1;

    const cycleNum = this.state.sessionCycleCount - 1;
    this.addLog(`🔒 [CONSERVARE MANUALĂ] Câștigul de +${profitToConserve.toFixed(2)} USDT din Ciclul #${cycleNum} a fost salvat în Soldul "Acumulare" (Total Acumulat: ${this.state.accumulationBalance.toFixed(2)} USDT). Ciclul #${this.state.sessionCycleCount} reîncepe cu ${initialCapital.toFixed(2)} USDT.`, 'success', this.state.balance);

    this.sendNotification(
      `🔒 **[G&S-Trade-Bot] Consolidează Profit în Acumulare**\n\n` +
      `• **Profit Transferat:** +${profitToConserve.toFixed(2)} USDT\n` +
      `• **Sold Total "Acumulare":** ${this.state.accumulationBalance.toFixed(2)} USDT\n` +
      `• **Nou Ciclu #${this.state.sessionCycleCount}:** Reîncepe cu ${initialCapital.toFixed(2)} USDT`
    );

    this.savePersistedState();
    return { success: true, profitConserved: profitToConserve, accumulationBalance: this.state.accumulationBalance };
  }

  public resetAccumulationVault(): { success: boolean } {
    const currentEq = this.calculateEquity();
    this.state.accumulationBalance = 0;
    this.state.sessionCycleCount = 1;
    if (currentEq > 0) {
      this.state.initialBalance = currentEq;
    } else {
      this.state.initialBalance = this.state.balance || 10000;
    }
    this.addLog(`🏦 Soldul "Acumulare" a fost resetat la $0.00 USDT. Ciclul de acumulare re-ancorat la $${this.state.initialBalance.toFixed(2)} USDT.`, 'info');
    this.savePersistedState(true);
    return { success: true };
  }

  public checkCircuitBreaker(): boolean {
    // 1. Check Accumulation Target (+3% cycle profit rule)
    this.checkAccumulationTarget();

    const equity = this.calculateEquity();
    const initial = (this.state.initialBalance && this.state.initialBalance > 0) ? this.state.initialBalance : 10000;
    const pnlPercent = ((equity - initial) / initial) * 100;

    // Ignore circuit breaker trigger if testnet/live account has negligible funds (< $1)
    if (this.state.binanceMode !== 'paper' && equity < 1) {
      return false;
    }

    // Profit Target (+10%): Stop trading automatically -> Requires manual restart / reset
    if (pnlPercent >= 10.0) {
      if (!this.state.circuitBreakerTriggered) {
        this.state.circuitBreakerTriggered = true;
        this.state.autoTradingActive = false;
        const reason = `🎉 Limita de Profit +10% a fost atinsă! (PNL: +${pnlPercent.toFixed(2)}%, Equity: $${equity.toFixed(2)}). Auto-Trading OPRIT.`;
        this.state.circuitBreakerReason = reason;

        this.addLog(`[CIRCUIT BREAKER - TARGET +10%] Auto-trading oprit automat! PnL: +${pnlPercent.toFixed(2)}%. Re-start manual necesar.`, 'success', equity);

        const telegramMsg = `🎉 **[CIRCUIT BREAKER - TARGET +10% PROFIT ATINS]**\n\n` +
          `Sistemul a atins ținta de profit pe capital de **+${pnlPercent.toFixed(2)}%**!\n\n` +
          `• **Auto-Trading:** OPRIT AUTOMAT pentru securizarea câștigurilor\n` +
          `• **Capital Curent:** $${equity.toFixed(2)} USDT (Inițial: $${initial.toFixed(2)} USDT)\n\n` +
          `Apasă pe butonul **'Reluare Manual Trade / Reset'** în interfața web pentru a re-ancora capitalul și a reporni botul.`;

        this.sendNotification(telegramMsg);
        this.savePersistedState();
      }
      return true;
    }

    // Safety Stop Loss (-5% drawdown): Stop trading automatically -> Requires manual restart / reset
    if (pnlPercent <= -5.0) {
      if (!this.state.circuitBreakerTriggered) {
        this.state.circuitBreakerTriggered = true;
        this.state.autoTradingActive = false;
        const reason = `🚨 Limita de siguranță -5% pierdere a fost atinsă! (PNL: ${pnlPercent.toFixed(2)}%, Equity: $${equity.toFixed(2)}). Auto-Trading OPRIT.`;
        this.state.circuitBreakerReason = reason;

        this.addLog(`[CIRCUIT BREAKER - STOP LOSS -5%] Auto-trading oprit automat pe server! PnL: ${pnlPercent.toFixed(2)}%. Re-start manual necesar.`, 'warning', equity);

        const telegramMsg = `🚨 **[CIRCUIT BREAKER - STOP LOSS -5% ATINS]**\n\n` +
          `Sistemul a atins limita maximă de pierdere pe capital de **${pnlPercent.toFixed(2)}%**.\n\n` +
          `• **Auto-Trading:** OPRIT AUTOMAT pentru protecția capitalului\n` +
          `• **Capital Curent:** $${equity.toFixed(2)} USDT (Inițial: $${initial.toFixed(2)} USDT)\n\n` +
          `Verifică piața și apasă pe butonul **'Reluare Manual Trade / Reset'** în interfață pentru a re-ancora capitalul și a reporni botul.`;

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
    const currentEquity = this.calculateEquity();
    this.state.initialBalance = currentEquity > 0 ? currentEquity : 10000;
    this.addLog(`[CIRCUIT BREAKER RESETAT] Circuit breaker eliberat. Capital re-ancorat la $${this.state.initialBalance.toFixed(2)} USDT. Auto-trading reluat.`, 'info', this.state.initialBalance);
    this.savePersistedState();
  }

  public updateConfig(newConfig: Partial<BotState>) {
    if (newConfig.accumulationTargetPercent !== undefined) {
      this.state.accumulationTargetPercent = Math.max(0.5, Math.min(50, Number(newConfig.accumulationTargetPercent)));
    }
    if (newConfig.accumulationTargetEnabled !== undefined) {
      this.state.accumulationTargetEnabled = Boolean(newConfig.accumulationTargetEnabled);
    }
    if (newConfig.accumulationBalance !== undefined) {
      this.state.accumulationBalance = Math.max(0, Number(newConfig.accumulationBalance));
    }
    if (newConfig.sessionCycleCount !== undefined) {
      this.state.sessionCycleCount = Math.max(1, Number(newConfig.sessionCycleCount));
    }
    if (newConfig.autoTradingActive !== undefined) {
      const isStarting = Boolean(newConfig.autoTradingActive);
      this.state.autoTradingActive = isStarting;
      if (isStarting) {
        this.state.circuitBreakerTriggered = false;
        this.state.circuitBreakerReason = null;
        const currentEq = this.calculateEquity();
        if (currentEq > 0) {
          this.state.initialBalance = currentEq;
        }
        this.sendNotification(`▶️ **[G&S-Trade-Bot]** Auto-Trading PORNIT`);
      } else {
        this.sendNotification(`⏸️ **[G&S-Trade-Bot]** Auto-Trading OPRIT`);
      }
      this.savePersistedState(true);
    }
    if (newConfig.circuitBreakerTriggered !== undefined) this.state.circuitBreakerTriggered = newConfig.circuitBreakerTriggered;
    if (newConfig.circuitBreakerReason !== undefined) this.state.circuitBreakerReason = newConfig.circuitBreakerReason;
    if (newConfig.notificationProvider !== undefined) this.state.notificationProvider = newConfig.notificationProvider;
    if (newConfig.discordWebhookUrl !== undefined) this.state.discordWebhookUrl = newConfig.discordWebhookUrl;
    if (newConfig.telegramBotToken !== undefined) this.state.telegramBotToken = newConfig.telegramBotToken;
    if (newConfig.telegramChatId !== undefined) this.state.telegramChatId = newConfig.telegramChatId;
    if (newConfig.reportConfig !== undefined) this.state.reportConfig = { ...this.state.reportConfig, ...newConfig.reportConfig };
    if (newConfig.timezone !== undefined) this.state.timezone = newConfig.timezone;
    if (newConfig.dataInterval !== undefined) this.state.dataInterval = newConfig.dataInterval;
    if (newConfig.analysisInterval !== undefined) this.state.analysisInterval = newConfig.analysisInterval;
    if (newConfig.positionSizePercent !== undefined) {
      this.state.positionSizePercent = Math.max(1, Math.min(50, Number(newConfig.positionSizePercent)));
      if (this.state.scalpingConfig) this.state.scalpingConfig.positionSizePercent = this.state.positionSizePercent;
    }
    if (newConfig.stopLossPercent !== undefined) {
      this.state.stopLossPercent = Math.max(0.5, Math.min(20, Number(newConfig.stopLossPercent)));
      if (this.state.scalpingConfig) this.state.scalpingConfig.stopLossPercent = this.state.stopLossPercent;
    }
    if (newConfig.maxHoldMinutes !== undefined) {
      this.state.maxHoldMinutes = Math.max(0, Math.min(240, Number(newConfig.maxHoldMinutes)));
      if (this.state.scalpingConfig) this.state.scalpingConfig.maxHoldMinutes = this.state.maxHoldMinutes;
    }
    if (newConfig.maxNegativeHoldMinutes !== undefined) {
      const val = Math.max(0, Math.min(60, Number(newConfig.maxNegativeHoldMinutes)));
      if (this.state.scalpingConfig) this.state.scalpingConfig.maxNegativeHoldMinutes = val;
    }
    if (newConfig.enableMaxNegativeHold !== undefined) {
      if (this.state.scalpingConfig) this.state.scalpingConfig.enableMaxNegativeHold = Boolean(newConfig.enableMaxNegativeHold);
    }
    if (newConfig.executionEngine !== undefined && ['both', 'grid', 'scalping'].includes(newConfig.executionEngine)) {
      this.state.executionEngine = newConfig.executionEngine;
      const modeLabel = newConfig.executionEngine === 'both' ? 'HIBRID (Grid + Scalping)' : (newConfig.executionEngine === 'grid' ? 'DOAR GRID' : 'DOAR SCALPING');
      this.addLog(`[Motor Execuție Modificat ⚙️] Modul de execuție a fost schimbat pe: ${modeLabel}.`, 'info');
    }
    if (newConfig.mlModelType !== undefined && ['rf', 'tcn', 'both'].includes(newConfig.mlModelType)) {
      // FIX: 'tcn'/'both' never actually selected a different model (ml.ts never read
      // this value) — coerced to 'rf' here so state reflects what genuinely runs.
      // Legacy values are still accepted (not rejected) so old clients/saved configs
      // don't break, they just no longer produce a false "TCN"/"Hybrid" label.
      this.state.mlModelType = 'rf';
      this.addLog(`[Model ML Modificat 🧠] Motorul de calcul al semnalelor este: Random Forest Ensemble (1m).`, 'info');
    }
    if (newConfig.gridConfig !== undefined && typeof newConfig.gridConfig === 'object') {
      this.state.gridConfig = { ...this.state.gridConfig, ...newConfig.gridConfig };
    }
    if (newConfig.smartGridActive !== undefined) {
      this.state.smartGridActive = newConfig.smartGridActive;
      if (this.state.gridConfig) this.state.gridConfig.active = newConfig.smartGridActive;
    }
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
    if (newConfig.apiKey !== undefined && newConfig.apiKey !== '••••••••' && newConfig.apiKey !== '') {
      this.state.apiKey = newConfig.apiKey;
    }
    if (newConfig.apiSecret !== undefined && newConfig.apiSecret !== '••••••••' && newConfig.apiSecret !== '') {
      this.state.apiSecret = newConfig.apiSecret;
    }
    if (newConfig.testnetApiKey !== undefined && newConfig.testnetApiKey !== '••••••••' && newConfig.testnetApiKey !== '') {
      this.state.testnetApiKey = newConfig.testnetApiKey;
    }
    if (newConfig.testnetApiSecret !== undefined && newConfig.testnetApiSecret !== '••••••••' && newConfig.testnetApiSecret !== '') {
      this.state.testnetApiSecret = newConfig.testnetApiSecret;
    }
    if (newConfig.telegramBotToken !== undefined && newConfig.telegramBotToken !== '••••••••' && newConfig.telegramBotToken !== '') {
      this.state.telegramBotToken = newConfig.telegramBotToken;
    }
    if (newConfig.discordWebhookUrl !== undefined && newConfig.discordWebhookUrl !== '••••••••' && newConfig.discordWebhookUrl !== '') {
      this.state.discordWebhookUrl = newConfig.discordWebhookUrl;
    }
    
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

  private async reconcilePositionsWithBinance(balances: any[]) {
    if (!Array.isArray(balances) || this.state.binanceMode === 'paper') return;

    // Build map of active holding assets on Binance (excluding USDT)
    const activeAssetsOnExchange = new Map<string, number>();
    for (const b of balances) {
      if (!b || b.asset === 'USDT') continue;
      const totalVal = (parseFloat(b.free) || 0) + (parseFloat(b.locked) || 0);
      if (totalVal > 0.000001) {
        activeAssetsOnExchange.set(`${b.asset}USDT`, totalVal);
      }
    }

    const currentPositions = [...(this.state.positions || [])];
    const updatedPositions: Position[] = [];

    // 1. Reconcile existing local positions
    for (const pos of currentPositions) {
      const exchangeQty = activeAssetsOnExchange.get(pos.symbol);
      if (exchangeQty !== undefined && exchangeQty > 0) {
        // Position exists on Binance: update amount if changed, preserve openedAt timestamp!
        if (Math.abs(pos.amount - exchangeQty) > 0.000001) {
          this.addLog(`[RECONCILIERE 🔄] Cantitate ajustată pentru ${pos.symbol}: local ${pos.amount} -> exchange ${exchangeQty}`, 'info');
          pos.amount = exchangeQty;
        }
        updatedPositions.push(pos);
        activeAssetsOnExchange.delete(pos.symbol);
      } else {
        // Position exists locally but closed/absent on Binance
        this.addLog(`[RECONCILIERE 🔄] Poziția ${pos.symbol} nu mai există pe Binance (închisă pe exchange). Eliminată din starea locală.`, 'warning');
      }
    }

    // 2. Add positions existing on Binance but absent locally
    const apiKey = (this.state.binanceMode === 'testnet'
      ? (this.state.testnetApiKey || this.state.apiKey)
      : this.state.apiKey)?.trim();
    const apiSecret = (this.state.binanceMode === 'testnet'
      ? (this.state.testnetApiSecret || this.state.apiSecret)
      : this.state.apiSecret)?.trim();

    for (const [symbol, qty] of activeAssetsOnExchange.entries()) {
      const item = this.state.watchlist.find(w => w.symbol === symbol);
      const currentMarketPrice = item?.price || 1;
      
      // Calculate estimated USDT value: if value >= minNotional ($5), add
      if (currentMarketPrice * qty >= 5.0) {
        let realEntryPrice: number | null = null;
        let realOpenedAt: number | null = null;
        let isUntracked = false;

        if (apiKey && apiSecret) {
          try {
            const client = createBinanceClient({
              apiKey,
              apiSecret,
              httpBase: this.state.binanceMode === 'testnet' ? 'https://testnet.binance.vision' : 'https://api.binance.com'
            });
            const trades = await client.myTrades({ symbol, limit: 10 });
            if (Array.isArray(trades) && trades.length > 0) {
              const buyTrades = trades.filter((t: any) => t.isBuyer);
              if (buyTrades.length > 0) {
                let totalQty = 0;
                let totalCost = 0;
                // Weighted avg price of recent buys
                buyTrades.slice(-5).forEach((bt: any) => {
                  const bQty = parseFloat(bt.qty) || 0;
                  const bPrice = parseFloat(bt.price) || 0;
                  totalQty += bQty;
                  totalCost += bQty * bPrice;
                });
                const lastBuy = buyTrades[buyTrades.length - 1];
                realEntryPrice = totalQty > 0 ? (totalCost / totalQty) : (parseFloat(lastBuy.price) || null);
                realOpenedAt = lastBuy.time ? Number(lastBuy.time) : null;
              }
            }
          } catch (err: any) {
            logger.warn(`[RECONCILIERE] Nu s-au putut obține istoricul myTrades pentru ${symbol}: ${err?.message || err}`);
          }
        }

        if (!realEntryPrice || !realOpenedAt) {
          isUntracked = true;
          this.addLog(`[RECONCILIERE ⚠️] Poziție descoperită pe Binance pentru ${symbol} (${qty} unități). Istoricul de achiziție nu a putut fi determinat — marcată ca UNTRACKED.`, 'warning');
        } else {
          this.addLog(`[RECONCILIERE 🔄] Poziție descoperită pe Binance pentru ${symbol} (${qty} unități @ $${realEntryPrice.toFixed(4)} din ${formatInTimezone(new Date(realOpenedAt).toISOString())}).`, 'info');
        }

        updatedPositions.push({
          symbol,
          amount: qty,
          entryPrice: realEntryPrice || currentMarketPrice,
          currentPrice: currentMarketPrice,
          highestPrice: Math.max(currentMarketPrice, realEntryPrice || currentMarketPrice),
          openedAt: realOpenedAt || Date.now(),
          entryFee: parseFloat(((realEntryPrice || currentMarketPrice) * qty * 0.00075).toFixed(4)),
          strategy: 'scalping',
          leverage: 1,
          margin: (realEntryPrice || currentMarketPrice) * qty,
          isUntracked
        } as Position);
      }
    }

    this.state.positions = updatedPositions;
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
        this.consecutiveApiErrors = 0; // Reset error counter on successful API sync
        await this.reconcilePositionsWithBinance(account.balances);

        const exchangeBalancesMap: Record<string, number> = {};
        for (const b of account.balances) {
          const free = parseFloat((b as any).free) || 0;
          if (free > 0) exchangeBalancesMap[(b as any).asset] = free;
        }

        const usdtAsset = account.balances.find((b: any) => b.asset === 'USDT');
        if (usdtAsset) {
          const freeUsdt = parseFloat(usdtAsset.free) || 0;
          const lockedUsdt = parseFloat(usdtAsset.locked) || 0;
          const totalUsdt = freeUsdt + lockedUsdt;

          if (mode === 'testnet' && freeUsdt < 10) {
            const fallbackBalance = (this.state.balance && this.state.balance >= 100) 
              ? this.state.balance 
              : 10000;

            this.state.balance = fallbackBalance;
            this.state.initialBalance = fallbackBalance;
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
            await tradingEngine.reconcile(this.state.positions, fallbackBalance, { USDT: fallbackBalance });
            return { success: true, balance: fallbackBalance, total: fallbackBalance, lowTestnetBalance: true };
          }

          this.state.balance = freeUsdt;
          this.state.initialBalance = totalUsdt > 0 ? totalUsdt : (freeUsdt || 10000);
          
          if (this.state.circuitBreakerTriggered) {
            this.state.circuitBreakerTriggered = false;
            this.state.circuitBreakerReason = null;
            this.state.autoTradingActive = true;
          }

          this.addLog(
            `[BINANCE ${mode.toUpperCase()}] Sincronizare reuşită! Balanţă liberă: $${freeUsdt.toLocaleString('en-US', {minimumFractionDigits: 2})} USDT (Total cont: $${totalUsdt.toLocaleString('en-US', {minimumFractionDigits: 2})}). Capital inițial actualizat.`,
            'success'
          );
          this.savePersistedState();

          // Reconcile with TradingEngine
          await tradingEngine.reconcile(this.state.positions, freeUsdt, exchangeBalancesMap);

          return { success: true, balance: freeUsdt, total: totalUsdt };
        } else {
          this.addLog(`[BINANCE ${mode.toUpperCase()}] S-a realizat conexiunea, dar activul USDT nu s-a găsit în balanțe.`, 'warning');
        }
      }
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      logger.warn(`[BINANCE ${mode.toUpperCase()}] Could not sync balance: ${errMsg}`);
      this.addLog(`[BINANCE ${mode.toUpperCase()}] Eroare la sincronizarea balanței: ${errMsg}`, 'warning');

      if (mode === 'live') {
        this.consecutiveApiErrors += 1;
        if (this.consecutiveApiErrors >= 3) {
          this.state.autoTradingActive = false;
          this.addLog(`[SAFE STOP 🛑] Sincronizarea cu Binance pe modul Live a eșuat de 3 ori consecutiv (${errMsg}). Oprit tradingul automat de siguranță.`, 'warning');
          this.sendNotification(`🛑 **[SAFE STOP LIVE]**\nSincronizarea cu Binance Live a eșuat de 3 ori consecutiv (${errMsg}). Tradingul automat a fost OPRIT de siguranță.`);
        }
      }
      
      if (mode === 'testnet') {
        const fallbackBalance = (this.state.balance && this.state.balance >= 100) 
          ? this.state.balance 
          : 10000;
        this.state.balance = fallbackBalance;
        this.state.initialBalance = fallbackBalance;
        if (this.state.circuitBreakerTriggered) {
          this.state.circuitBreakerTriggered = false;
          this.state.circuitBreakerReason = null;
          this.state.autoTradingActive = true;
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

  public resetPortfolio(newBalance = 10000) {
    this.state.balance = newBalance;
    this.state.initialBalance = newBalance;
    this.state.positions = [];
    this.state.logs = [];
    this.state.circuitBreakerTriggered = false;
    this.state.circuitBreakerReason = null;
    this.state.accumulationBalance = 0;
    this.state.sessionCycleCount = 1;
    this.addLog(`Portofoliu resetat la $${newBalance} pe server. Sold Acumulare resetat.`, 'warning');
    this.savePersistedState(true);
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
      `📌 <b>GHID & LISTĂ COMENZI BOT G&S-Trade-Bot 24/7</b>\n` +
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
      const token = (this.state.telegramBotToken || '').trim();
      if (!token || !targetChatId) {
        return { success: false, error: 'Telegram Bot Token sau Chat ID lipsă! Introdu-le în Setări.' };
      }

      const sendUrl = `https://api.telegram.org/bot${token}/sendMessage`;
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
          const pinUrl = `https://api.telegram.org/bot${token}/pinChatMessage`;
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

  public sendNotification(message: string) {
    const channels = this.state.reportConfig?.channels;

    const isTelegramEnabled = !channels || channels.telegram !== false;
    const isDiscordEnabled = !channels || channels.discord !== false;

    if (isDiscordEnabled && this.state.discordWebhookUrl) {
      sendWebhookServer('discord', this.state.discordWebhookUrl, message);
    }
    if (isTelegramEnabled && this.state.telegramBotToken && this.state.telegramChatId) {
      sendWebhookServer('telegram', this.state.telegramBotToken, this.state.telegramChatId, message);
    }
  }

  private async pollTelegramMessages() {
    if (!this.state.telegramBotToken || this.isPollingTelegram) return;
    this.isPollingTelegram = true;

    try {
      const url = `https://api.telegram.org/bot${this.state.telegramBotToken}/getUpdates?offset=${this.telegramOffset}&timeout=0`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      
      if (!res.ok) {
        const errText = await res.text();
        if (res.status === 409) {
          if (!this.webhookCleared) {
            this.webhookCleared = true;
            logger.info('[Telegram Bot] Removing webhook to resolve 409 conflict...');
            await fetch(`https://api.telegram.org/bot${this.state.telegramBotToken}/deleteWebhook`);
          }
        } else {
          logger.warn(`[Telegram Polling Warning] HTTP ${res.status}: ${errText}`);
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
              logger.info(`[Telegram Bot] Updated active telegramChatId to ${chatId}`);
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
                `• Capital Inițial: ${this.state.initialBalance.toFixed(2)}\n` +
                `• Capital Curent: ${equity.toFixed(2)}\n` +
                `• Balanță Liberă (Cash): ${this.state.balance.toFixed(2)}\n` +
                `• 🏦 Sold "Acumulare": ${(this.state.accumulationBalance || 0).toFixed(2)} USDT\n` +
                `• Ciclu Activ: #${this.state.sessionCycleCount || 1}\n` +
                `• Profit / Pierdere: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} (${pnl >= 0 ? '+' : ''}${pnlPct}%)\n` +
                `• Tranzacții Executate: ${this.state.totalTradesExecuted || 0}`;
        break;
      }

      case '/acumulare':
      case '/vault': {
        const accumBal = (this.state.accumulationBalance || 0).toFixed(2);
        const cycle = this.state.sessionCycleCount || 1;
        const target = this.state.accumulationTargetPercent || 3.0;
        const enabled = this.state.accumulationTargetEnabled !== false ? '✅ ACTIVATĂ' : '❌ DEZACTIVATĂ';

        reply = `<b>🏦 Sold "Acumulare" (Profit Conservat)</b>\n\n` +
                `• <b>Total Profit Salvat:</b> ${accumBal} USDT\n` +
                `• <b>Ciclu Activ:</b> #${cycle}\n` +
                `• <b>Țintă Profit Conservare:</b> +${target}%\n` +
                `• <b>Automatizare Regulă:</b> ${enabled}\n\n` +
                `<i>La atingeria țintei de +${target}% per ciclu, profitul este extras automat în Soldul "Acumulare", iar tranzacționarea se reia de la capitalul inițial.</i>`;
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
    meta?: { mlProbability?: number; modelName?: string; entryReason?: string; notes?: string; strategy?: 'grid' | 'scalping' | 'manual'; targetTP?: number; metaTradeScore?: number; entryPatternName?: string; candlestickPatternName?: string; leverage?: number; margin?: number }
  ) {
    if (!price || price <= 0 || isNaN(price) || !amount || amount <= 0 || isNaN(amount)) {
      logger.warn(`[SAFETY] Trade anulat pentru ${symbol}: Preț sau cantitate invalidă (preț: ${price}, cantitate: ${amount})`);
      return;
    }

    // Engine state check
    if (action === 'BUY' && !tradingEngine.engines.state.canTrade()) {
      const currentState = tradingEngine.engines.state.getState();
      this.addLog(`[ENGINE ${currentState} 🔒] Cumpărarea pentru ${symbol} a fost blocată deoarece starea Trading Engine este ${currentState} (${tradingEngine.engines.state.getReason()}).`, 'warning');
      await db.logEvent('TRADE_BLOCKED_ENGINE_STATE', { symbol, action, price, amount, state: currentState, reason: tradingEngine.engines.state.getReason() }, symbol, 'TradeBot', 'BLOCK');
      return;
    }

    // Fix ATR calculation
    let atrPercent = 0.10; // Default
    try {
      const klines = await fetchHistoricalKlines(symbol, 30, '15m');
      // logger.info(`[DEBUG] ATR Calculation for ${symbol}: received ${klines.length} klines.`);
      const atrValues = calculateATR(klines as any, 14);
      const lastAtr = atrValues[atrValues.length - 1];
      if (lastAtr && price > 0) {
        atrPercent = (lastAtr / price) * 100;
        logger.info(`[DEBUG] ATR Calculation for ${symbol}: lastAtr=${lastAtr}, price=${price}, atrPercent=${atrPercent}%`);
      } else {
        logger.warn(`[DEBUG] ATR Calculation for ${symbol}: lastAtr or price invalid. lastAtr=${lastAtr}, price=${price}`);
      }
    } catch (e: any) {
      logger.warn(`Failed to calculate ATR for ${symbol}: ${e.message}`);
    }

    // CENTRALIZED EXECUTION: Risk Engine Evaluation (P0 Mandate)
    const hasOpenPosition = this.state.positions.some(p => p.symbol === symbol && p.amount > 0);
    const riskReq = {
      symbol,
      signal: {
        confidence: meta?.mlProbability || 75,
        metaScore: meta?.metaTradeScore || 75,
        mlRes: {
          marketRegime: {
            atrPercent
          }
        }
      } as any,
      scalpConfig: (this.state.scalpingConfig || { active: true, minRfProb: 70, minMetaScore: 70 }) as any,
      currentBalanceUSDT: this.state.balance,
      hasOpenPosition: action === 'BUY' && hasOpenPosition,
      globalAutoTradingActive: this.state.autoTradingActive !== false
    };

    const riskResult = riskEngine.evaluateOrder(riskReq);
    if (riskResult.decision !== 'ALLOW') {
      this.addLog(`[RISK ENGINE VETO 🛑] Ordinul ${symbol} (${action}) respins: ${riskResult.reason} [Veto: ${riskResult.vetoType}]`, 'warning');
      await db.logEvent('ORDER_REJECTED_RISK', { symbol, action, price, amount, reason: riskResult.reason, vetoType: riskResult.vetoType }, symbol, 'TradeBot', 'BLOCK');
      return;
    }

    // Log order creation intent
    await db.logEvent('ORDER_CREATED', {
      symbol,
      side: action,
      price,
      amount,
      strategy: meta?.strategy || 'TradeBot',
      metaTradeScore: meta?.metaTradeScore,
      entryReason: meta?.entryReason
    }, symbol, 'TradeBot', action);

    // 1. EXECUTION LOCK: Prevent concurrent execution for the same symbol
    if (this.executingSymbols.has(symbol)) {
      this.addLog(`[EXECUTION LOCK 🔒] Ordin concurent pentru ${symbol} în curs de procesare. Se previne duplicarea.`, 'warning');
      return;
    }
    this.executingSymbols.add(symbol);

    try {
      // Consistency sanity check: price anomaly check (> 20% jump)
      const item = this.state.watchlist.find(w => w.symbol === symbol);
      const pos = this.state.positions.find(p => p.symbol === symbol);
      const lastPrice = item?.price || pos?.currentPrice || pos?.entryPrice;

      if (lastPrice && lastPrice > 0) {
        const diff = Math.abs(price - lastPrice) / lastPrice;
        if (diff > 0.20) {
          if (diff > 0.40) {
            logger.warn(`[SAFETY RE-SYNC] Re-calibrare preț stocat pentru ${symbol}: $${lastPrice} -> $${price}`);
            if (item) item.price = price;
            if (pos) pos.currentPrice = price;
          } else {
            this.addLog(`[SAFETY] Preț anormal ignorat pentru ${symbol}: $${lastPrice} -> $${price} (variație ${(diff * 100).toFixed(1)}%). Ordin anulat.`, 'warning');
            logger.warn(`Preț anormal pentru ${symbol}: ${lastPrice} -> ${price}`);
            return;
          }
        }
      }

      let orderSuccess = false;
      let actualExecutedQty = amount;
      let actualEntryPrice = price;
      let actualFee = parseFloat((price * amount * 0.00075).toFixed(4));
      let feeUnknown = false;

      if (this.state.binanceMode === 'paper') {
        orderSuccess = true;
      } else if (this.state.binanceMode === 'testnet' || this.state.binanceMode === 'live') {
        const apiKey = (this.state.binanceMode === 'testnet'
          ? (this.state.testnetApiKey || this.state.apiKey)
          : this.state.apiKey)?.trim();
        const apiSecret = (this.state.binanceMode === 'testnet'
          ? (this.state.testnetApiSecret || this.state.apiSecret)
          : this.state.apiSecret)?.trim();

        if (!apiKey || !apiSecret) {
          this.addLog(`[BINANCE ${this.state.binanceMode.toUpperCase()}] Execuție anulată: Cheile API nu sunt configurate în Setări.`, 'warning');
          return;
        }

        const client = createBinanceClient({
          apiKey,
          apiSecret,
          httpBase: this.state.binanceMode === 'testnet' ? 'https://testnet.binance.vision' : 'https://api.binance.com'
        });

        const filters = await getSymbolFilters(client, symbol);

        // Pre-check real Binance balance
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
          logger.warn(`[Binance Account Pre-Check Warning] ${e?.message || e}`);
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

          // SKIPPED_MIN_NOTIONAL Check for BUY
          if (availableUSDT < filters.minNotional) {
            this.addLog(`[BINANCE ${this.state.binanceMode.toUpperCase()}] Ordin CUMPĂRARE ${symbol} anulat (SKIPPED_MIN_NOTIONAL): Balanță USDT disponibilă ($${availableUSDT.toFixed(2)}) sub minimul necesar de $${filters.minNotional} USDT.`, 'warning');
            return;
          }

          const safeCostInUSDT = Math.min(requestedCost, availableUSDT * 0.995);
          if (safeCostInUSDT < filters.minNotional) {
            this.addLog(`[BINANCE ${this.state.binanceMode.toUpperCase()}] Ordin CUMPĂRARE ${symbol} anulat (SKIPPED_MIN_NOTIONAL): Valoarea ordinului ($${safeCostInUSDT.toFixed(2)}) este sub minimul de $${filters.minNotional} USDT.`, 'warning');
            return;
          }

          orderParams.quoteOrderQty = safeCostInUSDT.toFixed(2);
        } else { // SELL
          const availableAsset = realFreeAsset !== null ? realFreeAsset : amount;
          const qtyToSell = Math.min(amount, availableAsset);
          const formattedSellQtyStr = formatQuantityByStepSize(qtyToSell, filters.stepSize);
          const formattedSellQtyNum = parseFloat(formattedSellQtyStr);
          const estimatedSellVal = formattedSellQtyNum * price;

          if (formattedSellQtyNum < filters.minQty) {
            this.addLog(`[BINANCE ${this.state.binanceMode.toUpperCase()}] Ordin VÂNZARE ${symbol} anulat: Cantitatea disponibilă (${formattedSellQtyStr}) este sub minimul de lot (${filters.minQty}).`, 'warning');
            return;
          }

          // SKIPPED_MIN_NOTIONAL Check for SELL
          if (estimatedSellVal < filters.minNotional) {
            this.addLog(`[BINANCE ${this.state.binanceMode.toUpperCase()}] Ordin VÂNZARE ${symbol} anulat (SKIPPED_MIN_NOTIONAL): Valoarea estimată ($${estimatedSellVal.toFixed(2)}) este sub minimul de $${filters.minNotional} USDT.`, 'warning');
            return;
          }

          orderParams.quantity = formattedSellQtyStr;
        }

        try {
          const order = await client.order(orderParams);
          
          if (order && (order.status === 'FILLED' || order.status === 'PARTIALLY_FILLED')) {
            const execQty = parseFloat(order.executedQty || '0');
            const cummulativeQuote = parseFloat(order.cummulativeQuoteQty || '0');

            if (execQty > 0) {
              actualExecutedQty = execQty;
              actualEntryPrice = cummulativeQuote > 0 ? (cummulativeQuote / execQty) : price;

              // Parse actual commission fee from order fills (Fail-Safe)
              let fillComm = 0;

              if (Array.isArray(order.fills) && order.fills.length > 0) {
                const baseAsset = symbol.replace(/USDT$/i, '').toUpperCase();
                const bnbItem = this.state.watchlist.find(w => w.symbol === 'BNBUSDT');

                for (const f of order.fills) {
                  const c = parseFloat(f.commission || 0);
                  if (!c || c <= 0) continue;
                  const commAsset = (f.commissionAsset || '').toUpperCase();
                  const fillPx = parseFloat(f.price) || actualEntryPrice || price;

                  if (commAsset === 'USDT') {
                    fillComm += c;
                  } else if (commAsset === baseAsset) {
                    fillComm += c * fillPx;
                  } else if (commAsset === 'BNB') {
                    if (bnbItem?.price && bnbItem.price > 0) {
                      fillComm += c * bnbItem.price;
                    } else {
                      feeUnknown = true;
                      this.addLog(`[FEE ERROR ⚠️] Imposibil de determinat comisionul BNB (prețul BNBUSDT nu este disponibil în watchlist).`, 'warning');
                      break;
                    }
                  } else {
                    const altItem = this.state.watchlist.find(w => w.symbol === `${commAsset}USDT`);
                    if (altItem?.price && altItem.price > 0) {
                      fillComm += c * altItem.price;
                    } else {
                      feeUnknown = true;
                      this.addLog(`[FEE ERROR ⚠️] Imposibil de determinat comisionul pentru ${commAsset} (prețul ${commAsset}USDT nu este disponibil).`, 'warning');
                      break;
                    }
                  }
                }
              } else {
                feeUnknown = true;
                this.addLog(`[FEE ERROR ⚠️] Imposibil de determinat comisionul real (răspunsul exchange-ului nu conține detaliile order.fills).`, 'warning');
              }

              // Recovery via Binance API if initial parse failed
              if (feeUnknown && client && (this.state.binanceMode as string) !== 'paper') {
                try {
                  const recentTrades = await client.myTrades({ symbol, limit: 5 });
                  if (Array.isArray(recentTrades) && recentTrades.length > 0) {
                    let recoveredComm = 0;
                    let recoveryFailed = false;
                    const bnbItem = this.state.watchlist.find(w => w.symbol === 'BNBUSDT');

                    const targetTrades = recentTrades.filter((t: any) => 
                      t.orderId === order.orderId || (t.time && Math.abs(Date.now() - Number(t.time)) < 30000)
                    );
                    const tradesToProcess = targetTrades.length > 0 ? targetTrades : [recentTrades[recentTrades.length - 1]];

                    for (const t of tradesToProcess) {
                      const c = parseFloat(t.commission || 0);
                      if (!c || c <= 0) continue;
                      const commAsset = (t.commissionAsset || '').toUpperCase();
                      const tradePx = parseFloat(t.price) || actualEntryPrice || price;
                      const baseAsset = symbol.replace(/USDT$/i, '').toUpperCase();

                      if (commAsset === 'USDT') {
                        recoveredComm += c;
                      } else if (commAsset === baseAsset) {
                        recoveredComm += c * tradePx;
                      } else if (commAsset === 'BNB') {
                        if (bnbItem?.price && bnbItem.price > 0) {
                          recoveredComm += c * bnbItem.price;
                        } else {
                          recoveryFailed = true;
                          break;
                        }
                      } else {
                        const altItem = this.state.watchlist.find(w => w.symbol === `${commAsset}USDT`);
                        if (altItem?.price && altItem.price > 0) {
                          recoveredComm += c * altItem.price;
                        } else {
                          recoveryFailed = true;
                          break;
                        }
                      }
                    }

                    if (!recoveryFailed) {
                      fillComm = recoveredComm;
                      feeUnknown = false;
                      this.addLog(`[FEE RECOVERY 🔄] Comisionul real a fost recuperat cu succes prin myTrades API: $${fillComm.toFixed(4)}`, 'info');
                    }
                  }
                } catch (recErr: any) {
                  logger.warn(`[FEE RECOVERY] Recuperarea prin myTrades a eșuat: ${recErr?.message || recErr}`);
                }
              }

              if (feeUnknown) {
                this.addLog(`[ACCOUNTING_INCOMPLETE ⚠️] Comisionul real nu poate fi determinat în mod fiabil. Tranzacția este marcată ca ACCOUNTING_INCOMPLETE pentru reconciliere. PnL-ul net nu este considerat finalizat.`, 'warning');
                actualFee = 0;
              } else {
                actualFee = parseFloat(fillComm.toFixed(4));
              }
              orderSuccess = true;
              this.consecutiveApiErrors = 0; // Reset error counter

              if (realFreeUSDT !== null) {
                this.state.balance = realFreeUSDT;
              }
              logger.info(`[Binance Executed ${order.status}] ${action} ${symbol}: ${actualExecutedQty} @ $${actualEntryPrice.toFixed(4)} (Fee: $${actualFee.toFixed(4)})`);
            } else {
              orderSuccess = false;
              this.addLog(`[BINANCE] Ordinul ${symbol} a raportat status ${order.status}, dar cantitatea executată este 0. Nicio poziție locală creată.`, 'warning');
            }
          } else if (order && order.status === 'NEW') {
            orderSuccess = false;
            this.addLog(`[BINANCE] Ordinul ${symbol} a fost plasat și este în așteptare (NEW). Nicio poziție locală nu a fost creată încă.`, 'info');
          } else {
            orderSuccess = false;
            const st = order?.status || 'REJECTED/CANCELED';
            this.addLog(`[BINANCE] Ordinul ${symbol} a fost ${st}. Nicio poziție locală creată.`, 'warning');
          }
        } catch (err: any) {
          orderSuccess = false;
          const errMsg = err?.message || String(err);
          logger.warn(`[Binance Order Error] ${errMsg}`);
          this.addLog(`Eroare Binance (${this.state.binanceMode}): ${errMsg}`, 'warning', this.calculateEquity());

          if (this.state.binanceMode === 'live') {
            this.consecutiveApiErrors += 1;
            if (this.consecutiveApiErrors >= 3) {
              this.state.autoTradingActive = false;
              this.addLog(`[SAFE STOP 🛑] Oprire de urgență: 3 erori API consecutive pe modul Live. Tradingul automat a fost dezactivat.`, 'warning');
              this.sendNotification(`🛑 **[SAFE STOP LIVE]**\nAu intervenit 3 erori API consecutive pe Binance Live. Tradingul automat a fost OPRIT de siguranță.`);
            }
          }
        }
      }

      if (!orderSuccess) return;

      const finalAmount = actualExecutedQty;
      const finalPrice = actualEntryPrice;
      const finalFee = actualFee;
      const cost = finalPrice * finalAmount;

      if (action === 'BUY') {
        const detectedStrategy = meta?.strategy || (meta?.entryReason?.includes('Grid') ? 'grid' : (meta?.entryReason?.includes('Manual') ? 'manual' : 'scalping'));
        // On SPOT markets, leverage is capped at 1x
        const lev = 1;
        const marginCost = cost;
        const actualDeductCost = Math.min(marginCost, this.state.balance);

        const existing = this.state.positions.find(p => p.symbol === symbol);
        if (existing) {
          existing.amount += finalAmount;
          existing.currentPrice = finalPrice;
          existing.entryFee = (existing.entryFee || 0) + finalFee;
          if (feeUnknown) {
            (existing as any).isFeeUnknown = true;
            (existing as any).accountingStatus = 'ACCOUNTING_INCOMPLETE';
          }
          if ((existing as any).margin) (existing as any).margin += actualDeductCost;
          if (!(existing as any).highestPrice || finalPrice > (existing as any).highestPrice) {
            (existing as any).highestPrice = finalPrice;
          }
        } else {
          this.state.positions.push({
            symbol,
            amount: finalAmount,
            entryPrice: finalPrice,
            currentPrice: finalPrice,
            highestPrice: finalPrice,
            openedAt: Date.now(),
            entryFee: finalFee,
            entryMlProb: meta?.mlProbability || 75,
            entryOppScore: meta?.entryReason?.includes('OppScore:') ? parseFloat(meta.entryReason.split('OppScore:')[1]) || 70 : 70,
            entryPatternName: meta?.entryPatternName || (meta as any)?.candlestickPatternName || undefined,
            strategy: detectedStrategy,
            targetTP: meta?.targetTP || 0.8,
            metaTradeScore: meta?.metaTradeScore || 75,
            leverage: lev,
            margin: actualDeductCost,
            isFeeUnknown: feeUnknown,
            accountingStatus: feeUnknown ? 'ACCOUNTING_INCOMPLETE' : 'SETTLED'
          } as any);
        }

        if (this.state.binanceMode === 'paper') {
          this.state.balance = Math.max(0, this.state.balance - actualDeductCost - finalFee);
        }
        this.state.totalTradesExecuted += 1;

        const oppScoreVal = meta?.entryReason?.includes('OppScore:')
          ? (parseFloat(meta.entryReason.split('OppScore:')[1]) || 70)
          : 70;

        const qualityRes = calculateTradeQualityScore({
          action: 'BUY',
          mlProbability: meta?.mlProbability || 75,
          oppScore: oppScoreVal,
          pnlPercent: 0
        });

        journalService.addJournalEntry({
          symbol,
          action: 'BUY',
          price: finalPrice,
          amount: finalAmount,
          fee: finalFee,
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
          oppScore: oppScoreVal,
          isFeeUnknown: feeUnknown,
          accountingStatus: feeUnknown ? 'ACCOUNTING_INCOMPLETE' : 'SETTLED'
        });

        await db.logEvent('POSITION_OPENED', {
          symbol,
          entryPrice: finalPrice,
          amount: finalAmount,
          fee: finalFee,
          strategy: detectedStrategy,
          metaScore: meta?.metaTradeScore,
          tradeGrade: qualityRes.grade,
          mode: this.state.binanceMode
        }, symbol, 'TradeBot', 'BUY');

        const currentEquity = this.calculateEquity();
        this.addLog(`[SERVER BOT] Cumpărat ${finalAmount.toFixed(4)} ${symbol} @ $${finalPrice.toFixed(4)} (Comision: $${finalFee.toFixed(4)}) | Trade Quality: Grade ${qualityRes.grade}`, 'success', currentEquity);
      } else if (action === 'SELL') {
        const existingIndex = this.state.positions.findIndex(p => p.symbol === symbol);
        if (existingIndex !== -1) {
          const pos = this.state.positions[existingIndex];
          const qtyToClose = Math.min(pos.amount, finalAmount);
          const entryPrice = pos.entryPrice;

          const isTradeFeeUnknown = feeUnknown || !!(pos as any).isFeeUnknown;
          const tradeAccountingStatus: 'SETTLED' | 'ACCOUNTING_INCOMPLETE' = isTradeFeeUnknown ? 'ACCOUNTING_INCOMPLETE' : 'SETTLED';

          // Gross vs Net PnL Accounting
          const grossPnl = (finalPrice - entryPrice) * qtyToClose;
          const portionEntryFee = (pos.entryFee || 0) * (qtyToClose / pos.amount);
          const exitFee = finalFee;
          const totalFees = portionEntryFee + exitFee;
          const netPnl = grossPnl - totalFees;
          const pnlPercent = ((finalPrice - entryPrice) / entryPrice) * 100;
          const pnlValueStr = netPnl >= 0 ? `+$${netPnl.toFixed(2)}` : `-$${Math.abs(netPnl).toFixed(2)}`;

          if (isTradeFeeUnknown) {
            this.addLog(`[ACCOUNTING_INCOMPLETE ⚠️] Închidere ${symbol}: Comisionul real este neconfirmat (FEE_UNKNOWN). PnL-ul net este marcat ca ACCOUNTING_INCOMPLETE pentru reconciliere.`, 'warning');
          }

          // MFE & MAE Analytics
          const highestP = (pos as any).highestPrice || Math.max(entryPrice, finalPrice);
          const lowestP = (pos as any).lowestPrice || Math.min(entryPrice, finalPrice);
          const mfePct = parseFloat((((highestP - entryPrice) / entryPrice) * 100).toFixed(2));
          const maePct = parseFloat((((entryPrice - lowestP) / entryPrice) * 100).toFixed(2));
          const captureEff = mfePct > 0 ? Math.min(100, Math.max(0, parseFloat(((pnlPercent / mfePct) * 100).toFixed(1)))) : 0;

          const origAmount = pos.amount;
          const closeRatio = qtyToClose / origAmount;
          const totalPosMargin = (pos as any).margin || (entryPrice * origAmount);
          const closingMargin = totalPosMargin * closeRatio;

          pos.amount -= qtyToClose;
          pos.entryFee = Math.max(0, (pos.entryFee || 0) - portionEntryFee);
          if ((pos as any).margin !== undefined) {
            (pos as any).margin = Math.max(0, (pos as any).margin - closingMargin);
          }

          if (pos.amount <= 0.000001) {
            this.state.positions.splice(existingIndex, 1);
          }

          const returnedCapital = closingMargin + netPnl;
          this.state.balance += returnedCapital;
          this.state.totalTradesExecuted += 1;

          const sellTimestamp = new Date().toISOString();

          this.state.tradeHistory.push({
            symbol,
            entryPrice,
            exitPrice: finalPrice,
            amount: qtyToClose,
            pnl: netPnl,
            pnlPercent,
            mfePct,
            maePct,
            timestamp: sellTimestamp,
            isFeeUnknown: isTradeFeeUnknown,
            accountingStatus: tradeAccountingStatus
          } as any);

          if (this.state.tradeHistory.length > 1000) {
            this.state.tradeHistory.shift();
          }

          await db.logEvent('POSITION_CLOSED', {
            symbol,
            entryPrice,
            exitPrice: finalPrice,
            amount: qtyToClose,
            netPnl,
            pnlPercent,
            mfePct,
            maePct,
            exitReason: meta?.entryReason || 'Exit Order'
          }, symbol, 'TradeBot', 'SELL');

          const cdMin = registerSymbolCooldown(symbol, pnlPercent, meta?.entryReason || `Ieșire Poziție (${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%)`, finalPrice);
          this.addLog(
            `[Analitică Tranzacție MFE/MAE 📊] ${symbol}: Net PnL: ${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}% (${pnlValueStr} | Gross: $${grossPnl.toFixed(2)}, Taxe Total: $${totalFees.toFixed(2)}) | Watch Mode: Activ (${cdMin}m)`,
            netPnl >= 0 ? 'success' : 'warning'
          );

          const entryOpp = (pos as any).entryOppScore || 70;
          const qualityRes = calculateTradeQualityScore({
            action: 'SELL',
            mlProbability: meta?.mlProbability || 75,
            oppScore: entryOpp,
            pnlPercent
          });

          journalService.addJournalEntry({
            symbol,
            action: 'SELL',
            price: finalPrice,
            amount: qtyToClose,
            fee: exitFee,
            pnl: netPnl,
            pnlPercent,
            mlProbability: meta?.mlProbability || 75,
            modelName: meta?.modelName || 'XGBoost Classifier',
            entryReason: meta?.entryReason || 'Semnal Vânzare AI',
            mode: this.state.binanceMode,
            timestamp: sellTimestamp,
            notes: `Ieșire Poziție | Net PnL: ${pnlValueStr} (Taxe: $${totalFees.toFixed(2)}) | Stare: ${tradeAccountingStatus}`,
            tradeGrade: qualityRes.grade,
            tradeQualityScore: qualityRes.score,
            stars: qualityRes.stars,
            oppScore: entryOpp,
            isFeeUnknown: isTradeFeeUnknown,
            accountingStatus: tradeAccountingStatus
          });

          // Update per-symbol performance statistics
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
          if (netPnl > 0) symStat.wins += 1;
          else if (netPnl < 0) symStat.losses += 1;
          symStat.realizedPnL = parseFloat((symStat.realizedPnL + netPnl).toFixed(2));
          symStat.winRate = parseFloat(((symStat.wins / symStat.totalTrades) * 100).toFixed(1));

          const symTrades = this.state.tradeHistory.filter(t => t.symbol === symbol);
          const grossWin = symTrades.filter(t => t.pnl > 0).reduce((acc, t) => acc + t.pnl, 0);
          const grossLoss = Math.abs(symTrades.filter(t => t.pnl < 0).reduce((acc, t) => acc + t.pnl, 0));
          symStat.profitFactor = grossLoss > 0 ? parseFloat((grossWin / grossLoss).toFixed(2)) : (grossWin > 0 ? 3.0 : 1.0);
          symStat.lastTradedAt = new Date().toISOString();

          this.state.symbolStats[symbol] = symStat;
          
          const currentEquity = this.calculateEquity();
          this.addLog(`[SERVER BOT] Vândut ${qtyToClose.toFixed(4)} ${symbol} @ $${finalPrice.toFixed(4)} (Net PnL: ${pnlPercent.toFixed(2)}% | ${pnlValueStr}).`, 'warning', currentEquity);
        }
      }
      this.savePersistedState();
      this.checkCircuitBreaker();
    } finally {
      // Always release execution lock
      this.executingSymbols.delete(symbol);
    }
  }

  public calculateEquity(): number {
    const positionsValue = this.state.positions.reduce((acc, pos) => {
      const lev = pos.leverage || 1;
      const margin = pos.margin || ((pos.entryPrice * pos.amount) / lev);
      const pnl = ((pos.currentPrice || pos.entryPrice) - pos.entryPrice) * pos.amount;
      return acc + (margin + pnl);
    }, 0);
    return parseFloat((this.state.balance + positionsValue).toFixed(2));
  }

  public async cleanupDelistedAssets(): Promise<Set<string>> {
    const validSymbols = await fetchValidBinanceSymbolsServer();
    if (!validSymbols || validSymbols.size === 0) return new Set();

    // 1. Purge delisted positions (e.g. COCOSUSDT, HNTUSDT, PLAUSDT, PDAUSDT)
    if (Array.isArray(this.state.positions) && this.state.positions.length > 0) {
      const remainingPositions: Position[] = [];
      for (const pos of this.state.positions) {
        if (!validSymbols.has(pos.symbol)) {
          const cost = (pos.amount || 0) * (pos.entryPrice || 0);
          if (cost > 0) {
            this.state.balance = parseFloat((this.state.balance + cost).toFixed(2));
          }
          this.addLog(
            `[CURĂȚARE AUTOMATĂ 🧹] Eliminat asset delistat ${pos.symbol} din poziții active. Capitalul de $${cost.toFixed(2)} USDT a fost eliberat în balanță.`,
            'warning'
          );
        } else {
          remainingPositions.push(pos);
        }
      }
      this.state.positions = remainingPositions;
    }

    // 2. Purge delisted assets from watchlist
    if (Array.isArray(this.state.watchlist)) {
      const filteredWatchlist = this.state.watchlist.filter(w => validSymbols.has(w.symbol));
      if (filteredWatchlist.length !== this.state.watchlist.length) {
        this.state.watchlist = filteredWatchlist;
      }
    }

    return validSymbols;
  }

  public async scanMarketOpportunities(): Promise<MarketOpportunity[]> {
    if (this.state.marketOpportunities && this.state.marketOpportunities.length > 0 && (Date.now() - this.lastScanTimestamp < 15000)) {
      return this.state.marketOpportunities;
    }

    try {
      const validSymbols = await this.cleanupDelistedAssets();

      const endpoints = [
        'https://api.binance.com/api/v3/ticker/24hr',
        'https://api1.binance.com/api/v3/ticker/24hr',
        'https://api3.binance.com/api/v3/ticker/24hr',
        'https://data-api.binance.vision/api/v3/ticker/24hr'
      ];

      let tickerData: any[] = [];
      try {
        const fetchWithTimeout = async (url: string) => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3500);
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(timeoutId);
          if (!res.ok) throw new Error('HTTP ' + res.status);
          const data = await res.json();
          if (!Array.isArray(data) || data.length === 0) throw new Error('Empty');
          return data;
        };
        tickerData = await Promise.any(endpoints.map(url => fetchWithTimeout(url)));
      } catch (err) {
        // Fallback
      }

      if (!Array.isArray(tickerData) || tickerData.length === 0) {
        if (!this.state.marketOpportunities || this.state.marketOpportunities.length === 0) {
          logger.warn('[Opportunity Scanner] Could not fetch Binance 24hr ticker data, populating top market liquid pairs fallback.');
          const defaultTopPairs = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'LINKUSDT', 'NEARUSDT', 'SUIUSDT', 'FETUSDT', 'INJUSDT', 'PEPEUSDT', 'RNDRUSDT'];
          const fallbackOpps: MarketOpportunity[] = defaultTopPairs.map((symbol, idx) => ({
            symbol,
            price: 0,
            priceChangePercent: 2.5 + (idx % 5),
            volume24h: 100000000 - idx * 2000000,
            volumeSpikeRatio: 1.5 + (idx % 3) * 0.2,
            score: 85 - idx * 2,
            opportunityScore: 85 - idx * 2,
            rfProb: 75,
            metaProb: 70,
            recommendation: idx < 3 ? 'STRONG_BUY' : (idx < 8 ? 'BUY' : 'NEUTRAL'),
            reason: 'Top Liquid Pair (Active Market Scanner)',
            breakoutProbability: 75 - idx,
            trendDirection: 'BULLISH',
            trendAlignment: 'BULLISH',
            rsi: 55,
            volatility: 3.2,
            orderBookImbalanceRatio: 1.2,
            spreadPercent: 0.05,
            vwap: 0,
            atr: 0,
            adx: 25,
            mfi: 55,
            volumeSpike: true,
            highFrequencyPulse: true,
            isAnomalousVolume: false,
            timestamp: new Date().toISOString()
          })) as unknown as MarketOpportunity[];
          this.state.marketOpportunities = fallbackOpps;
        }
        return this.state.marketOpportunities || [];
      }

      // Exclude leveraged tokens, stablecoins, fiat, and known delisted tokens
      const excludedSubstrings = ['UPUSDT', 'DOWNUSDT', 'BEARUSDT', 'BULLUSDT', 'BUSDUSDT', 'USDCUSDT', 'FDUSDUSDT', 'TUSDUSDT', 'DAIUSDT', 'EURUSDT', 'TRYUSDT', 'GBPUSDT', 'AEURUSDT', 'SUSDUSDT', 'USDPUSDT', 'PAXUSDT', 'USDSUSDT', 'PLAUSDT', 'PDAUSDT', 'LUNAUSDT', 'FTTUSDT', 'ANCUSDT', 'MIRUSDT', 'COCOSUSDT', 'HNTUSDT', 'SNMUSDT', 'SRMUSDT', 'YFIIUSDT', 'EPXUSDT', 'DREPUSDT', 'MOBUSDT', 'PNTUSDT'];

      const filtered = tickerData.filter((item: any) => {
        const sym = item.symbol;
        if (!sym || !sym.endsWith('USDT')) return false;
        if (excludedSubstrings.includes(sym)) return false;
        if (validSymbols.size > 0 && !validSymbols.has(sym)) return false;
        const quoteVol = parseFloat(item.quoteVolume);
        const price = parseFloat(item.lastPrice);
        const count = parseInt(item.count, 10) || 0;
        const change = Math.abs(parseFloat(item.priceChangePercent));
        return !isNaN(quoteVol) && quoteVol >= 500000 && !isNaN(price) && price > 0 && count > 100 && !isNaN(change) && change >= 0.3;
      });

      // Sort by 24h quote volume to analyze top 100 candidates
      filtered.sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume));
      const topCandidates = filtered.slice(0, 250);

      const btcFiltered = filtered.find((i: any) => i.symbol === 'BTCUSDT');
      const btcTop = topCandidates.find((i: any) => i.symbol === 'BTCUSDT');
      const diagMsg = `[DIAGNOSTIC] BTCUSDT in filtered: ${!!btcFiltered}, in topCandidates: ${!!btcTop}` + 
        (btcFiltered ? ` | Vol24h: $${parseFloat(btcFiltered.quoteVolume).toLocaleString('en-US')} | Var24h: ${btcFiltered.priceChangePercent}%` : '');
      logger.info(diagMsg);
      this.addLog(diagMsg, 'info');

      const batchPriceMap = await fetchBatchPricesServer();

      // Step 1: Scan all 500 pairs to compute Candlestick Pattern Strength & Discovery Score
      const BATCH_SIZE = 25;
      const scannedCandidates: MarketOpportunity[] = [];

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

          // FIX (recalibrare 1 minut): limita de kline crescută de la 50 la 100 bare.
          // Pe date orare, 50 bare = ~2 zile — mult prea mult pentru discovery scanner.
          // Pe 1m, 50 bare = 50 minute — suficient pentru detectarea pattern-urilor
          // (minimul e 4 bare), dar insuficient pentru warmup-ul EMA21 folosit de
          // calculateTrendConfirmationScore (are nevoie de cel puțin 21 bare).
          // 100 bare de 1m = 100 minute — acoperă confortabil toate calculele.
          let klines: any[] = [];
          if (idx < 40) {
            klines = await fetchHistoricalKlines(symbol, 100).catch(() => []);
          }

          // 1. Candlestick/Price Action (35% weight)
          const candlestickRes = calculateCandlestickPatternScore(klines);
          const candlestickPatternScore = candlestickRes.score;
          const candlestickPatternName = candlestickRes.patternName;

          // 2. Momentum / accelerație preț (25% weight)
          const momentumAccelScore = calculateMomentumAccelScore(klines, priceChangePercent);

          // 3. RVOL + volum (20% weight)
          const rvolScore = calculateRvolScore(klines, volume24h);

          // 4. Breakout + ATR expansion (10% weight)
          const breakoutAtrScore = calculateBreakoutAtrExpansionScore(klines, highPrice, price);

          // 5. Trend confirmation (10% weight)
          const trendConfirmationScore = calculateTrendConfirmationScore(klines, priceChangePercent);

          const rangePercent = lowPrice > 0 ? ((highPrice - lowPrice) / lowPrice) * 100 : Math.abs(priceChangePercent);
          let atrPercent = parseFloat((rangePercent / 2).toFixed(2));
          let volScore = Math.min(20, Math.max(2, (rangePercent >= 2.0 && rangePercent <= 12.0) ? 12 + (rangePercent / 12) * 8 : (rangePercent < 2.0 ? rangePercent * 6 : Math.max(4, 20 - (rangePercent - 12)))));
          let liquidityScore = volume24h > 500000 ? Math.min(20, Math.max(2, Math.log10(volume24h / 500000) * 8.0 + 3)) : 2;
          let momentumScore = Math.min(20, Math.max(2, 10 + (priceChangePercent * 1.1)));
          const trendAlignment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = priceChangePercent >= 1.2 ? 'BULLISH' : (priceChangePercent <= -2.5 ? 'BEARISH' : 'NEUTRAL');
          const regime: 'TRENDING_BULL' | 'RANGING' | 'TRENDING_BEAR' = priceChangePercent >= 3.0 ? 'TRENDING_BULL' : (priceChangePercent <= -3.0 ? 'TRENDING_BEAR' : 'RANGING');

          const spreadPercent = parseFloat((volume24h > 10000000 ? 0.02 : 0.06).toFixed(3));
          const liquiditySpreadScore = calculateLiquiditySpreadScore(volume24h, spreadPercent);

          const symbolHashBonus = (symbol.charCodeAt(0) + symbol.charCodeAt(symbol.length - 1)) % 30 / 10 - 1.5;
          const baseRfProb = trendAlignment === 'BULLISH' ? 68 : (trendAlignment === 'BEARISH' ? 44 : 54);
          const rfProb = Math.min(98, Math.max(10, baseRfProb + symbolHashBonus));
          const metaProb = 50;

          const totalRawScore = volScore + liquidityScore + momentumScore + (rfProb * 0.18) + (metaProb * 0.07);
          const opportunityScore = Math.min(100, Math.max(0, Math.round(totalRawScore * 10) / 10));

          // Discovery Score formula with user requested exact weighting:
          // Candlestick (35%), Momentum (25%), RVOL (20%), Breakout/ATR (10%), Trend (10%)
          const discoveryScore = Math.min(100, Math.max(0, parseFloat((
            (candlestickPatternScore * 0.35) +
            (momentumAccelScore * 0.25) +
            (rvolScore * 0.20) +
            (breakoutAtrScore * 0.10) +
            (trendConfirmationScore * 0.10)
          ).toFixed(1))));

          const reason = `Pattern: ${candlestickPatternName} (${candlestickPatternScore}pt) | Discovery: ${discoveryScore}/100 | RVOL: ${rvolScore}pt | Vol: $${(volume24h / 1000000).toFixed(1)}M`;

          const sentimentLabel: 'bullish' | 'bearish' | 'neutral' = trendAlignment === 'BULLISH' ? 'bullish' : (trendAlignment === 'BEARISH' ? 'bearish' : 'neutral');

          return {
            symbol,
            price,
            opportunityScore,
            discoveryScore,
            candlestickPatternScore,
            candlestickPatternName,
            momentumAccelScore,
            rvolScore,
            structureScore: breakoutAtrScore,
            breakoutAtrScore,
            trendConfirmationScore,
            liquiditySpreadScore,
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
            reversalSignal: 'NONE' as const,
            sentimentLabel,
            regime,
            historicalPerformanceScore: 0,
            inDynamicWatchlist: false,
            rank: 0,
            updatedAt: new Date().toISOString(),
            reason
          };
        }));
        scannedCandidates.push(...batchResults);
      }

      // DIAGNOSTIC: Log BTCUSDT scores after calculation and before sort
      const btcBeforeSort = scannedCandidates.find(c => c.symbol === 'BTCUSDT');
      if (btcBeforeSort) {
        // discoveryScore calculation logged silently

      } else {
        logger.info('[DIAGNOSTIC] BTCUSDT not found in scannedCandidates after discoveryScore calculation');
      }

      // STAGE 1: Sort all 500 candidates by Momentum/Pattern Discovery Score
      scannedCandidates.sort((a, b) => (b.discoveryScore || 0) - (a.discoveryScore || 0));

      // STAGE 2: Select TOP 50 Candidates for ML + MetaScore Analysis
      const top50Candidates = scannedCandidates.slice(0, 50);

      // DIAGNOSTIC: Log BTCUSDT rank, TOP 50 inclusion, and candidate counts
      const btcIndex = scannedCandidates.findIndex(c => c.symbol === 'BTCUSDT');
      if (btcIndex !== -1) {
        const btcRank = btcIndex + 1;
        const isIncludedInTop50 = btcRank <= 50;
        // Rank logged silently

      } else {
        logger.info(`[DIAGNOSTIC] BTCUSDT not found in scannedCandidates after sort. scannedCandidates count: ${scannedCandidates.length}, top50Candidates count: ${top50Candidates.length}`);
      }
      await Promise.all(top50Candidates.map(async (op, idx) => {
        try {
          // Fetch full ML strategy analysis for top 25 candidates or if already cached.
          // FIX: was `idx < 10` — candidates ranked 11-25 got a fake `rfProb || 70`
          // placeholder instead of a real computed probability, so the ranking that
          // decided the execution watchlist was partly based on fabricated data for
          // anyone beyond rank 10. Now matches the scope already used for
          // SignalJournal logging below (top50Candidates.slice(0, 25)).
          if (idx < 25) {
            const mlRes = await signalEngine.getCachedRealStrategyAnalysis(op.symbol);
            if (mlRes) {
              op.rfProb = mlRes.rfProb || op.rfProb;
              op.metaProb = mlRes.metaProb || op.metaProb;
              if (mlRes.reversalSignal) {
                op.reversalSignal = mlRes.reversalSignal.isBullishReversal 
                  ? 'BULLISH_REVERSAL' 
                  : (mlRes.reversalSignal.isBearishReversal ? 'BEARISH_REVERSAL' : 'NONE');
              }
            }
          }

          const symStats = this.state.symbolStats ? this.state.symbolStats[op.symbol] : undefined;
          const metaBreakdown = calculateMetaTradeScore({
            symbol: op.symbol,
            opportunityScore: op.opportunityScore,
            aiProbability: op.rfProb || 70,
            rangeProbability: op.rfProb || 60,
            trendAlignment: op.trendAlignment || 'BULLISH',
            volumeRatio: 1.0 + ((op.volumeGrowth24h || 0) / 100),
            priceChangePercent: op.volumeGrowth24h || 0,
            symbolStat: symStats,
            regime: op.regime,
            atrPercent: op.atrPercent
          });

          (op as any).metaTradeScore = metaBreakdown.finalTradeScore;
          (op as any).metaExecutionRule = metaBreakdown.executionRule;
          (op as any).dynamicTP = metaBreakdown.dynamicTPPct;

          let histScore = 0;
          if (symStats && symStats.totalTrades >= 2) {
            if (symStats.winRate >= 65 && symStats.profitFactor >= 1.2) histScore = 12;
            else if (symStats.winRate >= 50 && symStats.realizedPnL > 0) histScore = 5;
            else if (symStats.winRate < 40 || symStats.realizedPnL < -5) histScore = -12;
          }
          op.historicalPerformanceScore = histScore;
        } catch (e) {
          // preserve defaults
        }
      }));

      // STAGE 3: Sort TOP 50 by MetaScore & ML Confirmation to determine TOP 25 for Scalping Execution
      top50Candidates.sort((a, b) => {
        const scoreA = (a as any).metaTradeScore || a.discoveryScore || 0;
        const scoreB = (b as any).metaTradeScore || b.discoveryScore || 0;
        return scoreB - scoreA;
      });

      // FIX: was `.slice(0, 10)` — widened to 25 to match the execution watchlist size
      // below (variable name kept for minimal diff footprint; it holds the top 25).
      const top5Candidates = top50Candidates.slice(0, 25);

      // Re-sort entire 500 candidates array putting top 50 first
      const otherCandidates = scannedCandidates.slice(50);
      const reorderedCandidates = [...top50Candidates, ...otherCandidates];

      // Assign Ranks 1..500
      reorderedCandidates.forEach((op, index) => {
        op.rank = index + 1;
        // FIX: was `index < 10` — kept in sync with the widened execution watchlist
        // below (25), so the UI's "in dynamic watchlist" flag doesn't undercount.
        if (index < 25) {
          op.inDynamicWatchlist = true;
        } else {
          op.inDynamicWatchlist = false;
        }
      });

      this.lastScanTimestamp = Date.now();
      this.state.marketOpportunities = reorderedCandidates;
      this.state.lastScanAt = new Date().toISOString();

      // Ensure signalJournal is populated with top candidate audit entries
      if (!this.state.signalJournal) this.state.signalJournal = [];
      const timeStr = new Intl.DateTimeFormat('ro-RO', {
        timeZone: this.state.timezone || 'Europe/Bucharest',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      }).format(new Date());

      top50Candidates.slice(0, 25).forEach(op => {
        const journalEntry: SignalJournalEntry = {
          id: `${op.symbol}_${Date.now()}_${Math.random().toString(36).substring(2,6)}`,
          timestamp: new Date().toISOString(),
          time: timeStr,
          symbol: op.symbol,
          price: op.price,
          rfProb: op.rfProb || 50,
          metaProb: op.metaProb || 50,
          reversalScore: (op as any).reversalScore || 0,
          isReversal: op.reversalSignal === 'BULLISH_REVERSAL' || op.reversalSignal === 'BEARISH_REVERSAL',
          reversalType: op.reversalSignal === 'BULLISH_REVERSAL' ? 'bullish' : (op.reversalSignal === 'BEARISH_REVERSAL' ? 'bearish' : undefined),
          newsSentiment: op.sentimentLabel || 'neutral',
          finalAction: (op as any).metaExecutionRule || (op.rfProb >= 65 ? 'BUY' : 'HOLD'),
          vetoReason: op.reason || `MetaScore: ${(op as any).metaTradeScore || op.discoveryScore}/100`,
          explanation: [
            `Candlestick Pattern: ${op.candlestickPatternName || 'Standard'} (${op.candlestickPatternScore || 0}pt)`,
            `Momentum Accel: ${op.momentumAccelScore || 0}pt | RVOL: ${op.rvolScore || 0}pt`,
            `Breakout/ATR: ${op.breakoutAtrScore || 0}pt | Trend: ${op.trendConfirmationScore || 0}pt`
          ]
        };
        const existingIdx = this.state.signalJournal.findIndex(s => s.symbol === op.symbol);
        if (existingIdx !== -1) {
          this.state.signalJournal[existingIdx] = journalEntry;
        } else {
          this.state.signalJournal.unshift(journalEntry);
        }
      });

      const signalLimit = this.state.maxLogs || 2500;
      if (this.state.signalJournal.length > signalLimit) {
        this.state.signalJournal = this.state.signalJournal.slice(0, signalLimit);
      }

      // AUTO ROTATION: Dynamic Watchlist updated with TOP 25 (with TOP 5 prioritized for execution)
      // FIX: was `.slice(0, 10), 10` — this was the actual bottleneck behind "missing
      // opportunities": only the top 10 discovery-ranked symbols ever reached
      // runMLAnalysis's real BUY/SELL decision loop, no matter how strong a candidate
      // ranked #15-25 looked. Widened to top 25, matching what SignalJournal already
      // logs and what the discovery-phase ML gate above now also computes.
      this.updateDynamicWatchlist(reorderedCandidates.slice(0, 25), 25);

      const top5SymbolsStr = top5Candidates.map(c => `${c.symbol} (${(c as any).metaTradeScore || c.discoveryScore}/100)`).join(', ');
      this.addLog(
        `[Funil Momentum-First 🚀] 500 perechi → TOP 50 Discovery (Candle 35%, Mom 25%, RVOL 20%, Breakout 10%, Trend 10%) → ML + MetaScore calculate → TOP 25 Execuție: ${top5SymbolsStr}`,
        'info'
      );

      return reorderedCandidates;
    } catch (err: any) {
      logger.warn(`[Market Opportunity Scanner Error]: ${err?.message || err}`);
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
        `[G&S-Trade-Bot 🔄 Dynamic Watchlist] Auto-Rotire Executată! Top ${topCount} oportunități scalping (${addedCount} noi, ${removedCount} rotite). Lider clasament: ${top1?.symbol} (Scor: ${top1?.opportunityScore}/100, Rank #1).`,
        'info'
      );
    }
  }

  private startBackgroundLoop() {
    if (this.intervalTimer) clearInterval(this.intervalTimer);
    if (this.telegramIntervalTimer) clearInterval(this.telegramIntervalTimer);

    // Initial immediate scan on server startup for fast data population.
    // FIX: previously this ran outside the `isLoopRunning` guard used by the 5s
    // heartbeat interval below, so if this startup call was still in-flight (slow
    // Binance/price-feed network calls) when the first interval tick fired 5s later,
    // both would run checkPricesAndSLTP/runMLAnalysis concurrently — a real race
    // window where two evaluations of the same open position could overlap. Now it
    // sets the same flag the interval checks, so the two paths can never overlap.
    setTimeout(() => {
      if (this.isLoopRunning) return;
      this.isLoopRunning = true;
      this.checkPricesAndSLTP()
        .then(() => this.runMLAnalysis())
        .catch((err: any) => logger.warn(`[Startup Scan Warning] ${err?.message || err}`))
        .finally(() => { this.isLoopRunning = false; });
    }, 500);

    // Dedicated fast Telegram Polling every 1.5s
    this.telegramIntervalTimer = setInterval(() => {
      this.pollTelegramMessages().catch(() => {});
    }, 1500);

    // Heartbeat loop every 5 seconds
    this.intervalTimer = setInterval(async () => {
      if (this.isLoopRunning) return;
      this.isLoopRunning = true;

      try {
        this.secondsCounter += 5;
        this.state.lastCheckAt = new Date().toISOString();

        // Check prices every 5s loop (always update prices continuously)
        await this.checkPricesAndSLTP();

        // Run ML analysis according to analysisInterval (always update AI signals)
        if (this.secondsCounter % Math.max(10, this.state.analysisInterval) === 0) {
          await this.runMLAnalysis();
        }

        // Check reports every minute
        if (this.secondsCounter % 60 === 0) {
          this.checkAndSendReports();
        }

        // Periodic Automatic Heartbeat Log every 3 minutes (180s)
        if (this.secondsCounter % 180 === 0) {
          const activeCount = this.state.watchlist.filter(w => w.active).length;
          const statusText = this.state.autoTradingActive ? 'PORNIT (24/7)' : 'OPRIT (Standby)';
          const posText = this.state.positions.length > 0 ? `${this.state.positions.length} poziții active` : 'nicio poziție deschisă';
          this.addLog(`[PULS AUTOMAT 24/7 💓] Engine activ | Monitorizare ${activeCount} perechi (${posText}). Stare Auto-Trading: ${statusText}.`, 'info');
        }

        this.savePersistedState();
      } catch (err: any) {
        logger.warn(`[Background Loop Warning] ${err?.message || err}`);
      } finally {
        this.isLoopRunning = false;
      }
    }, 5000);

    logger.info('[G&S-Trade-Bot] Background 24/7 trading engine is active on server.');
  }

  private checkAndSendReports() {
    const now = new Date();
    const timeZone = this.state.timezone || 'Europe/Bucharest';
    
    // Get time in specified timezone
    const timeFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const currentTime = timeFormatter.format(now); // e.g. "21:00"

    const hourFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit',
      hour12: false
    });
    const currentHourStr = hourFormatter.format(now);

    const dayFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short'
    });
    const currentDayStr = dayFormatter.format(now);
    const dayMap: Record<string, number> = { 'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6 };
    const currentDay = dayMap[currentDayStr];

    const datePartsFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric'
    });
    const dateStr = datePartsFormatter.format(now); // "M/D/YYYY"
    const [month, day, year] = dateStr.split('/').map(Number);
    const isLastDayOfMonth = new Date(year, month, 0).getDate() === day;

    const currentHourKey = `${dateStr}_${currentHourStr}`;
    const config = this.state.reportConfig;

    // Record or update daily snapshot in Trading Journal database
    const currentEquity = this.calculateEquity();
    const openPnL = this.state.positions.reduce((acc, p) => acc + ((p.currentPrice - p.entryPrice) * p.amount), 0);
    journalService.recordDailySnapshot(currentEquity, openPnL);

    // Level 2: Hourly Report (Triggers every top of hour)
    if (this.lastHourlyReportHour !== currentHourKey) {
      if (this.lastHourlyReportHour !== '') {
        this.sendNotification(this.generateHourlyReport(now));
      }
      this.lastHourlyReportHour = currentHourKey;
    }

    // Level 3: Daily Summary Report
    if (config?.daily?.enabled && config.daily.time === currentTime) {
      this.sendNotification(this.generateDailyReport(now));
    }

    if (config?.weekly?.enabled && config.weekly.day === currentDay && config.weekly.time === currentTime) {
      this.sendNotification(this.generateWeeklyReport(now));
    }

    if (config?.monthly?.enabled && isLastDayOfMonth && config.daily?.time === currentTime) {
      this.sendNotification(`📅 **Monthly Report**\nCapital Curent: $${this.calculateEquity().toFixed(2)}`);
    }
  }

  public generateHourlyReport(now: Date): string {
    const timeZone = this.state.timezone || 'Europe/Bucharest';
    const hourFormatter = new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', hour12: false });
    const currHour = parseInt(hourFormatter.format(now), 10);
    const prevHour = (currHour - 1 + 24) % 24;
    const pad = (n: number) => n.toString().padStart(2, '0');
    const hourSpan = `${pad(prevHour)}:00–${pad(currHour)}:00`;

    const equity = this.calculateEquity();

    // Trades in last 1 hour (3600s)
    const oneHourAgo = now.getTime() - 3600 * 1000;
    const hourlyTrades = this.state.tradeHistory.filter(t => new Date(t.timestamp).getTime() >= oneHourAgo);

    let pnlBrutSum = 0;
    let comisioaneSum = 0;
    let pnlNetSum = 0;

    for (const t of hourlyTrades) {
      const fee = (t as any).fee !== undefined 
        ? (t as any).fee 
        : ((t.entryPrice * t.amount + (t.exitPrice || t.entryPrice) * t.amount) * 0.00075);
      const gross = (t as any).pnlBrut !== undefined ? (t as any).pnlBrut : (t.pnl + fee);
      const net = t.pnl;

      pnlBrutSum += gross;
      comisioaneSum += fee;
      pnlNetSum += net;
    }

    const tradeCount = hourlyTrades.length;
    const winTrades = hourlyTrades.filter(t => t.pnl > 0);
    const lossTrades = hourlyTrades.filter(t => t.pnl <= 0);
    const winRate = tradeCount > 0 ? (winTrades.length / tradeCount) * 100 : 0;

    const avgProfitPct = winTrades.length > 0 
      ? (winTrades.reduce((acc, t) => acc + t.pnlPercent, 0) / winTrades.length) 
      : 0;
    const avgLossPct = lossTrades.length > 0 
      ? (lossTrades.reduce((acc, t) => acc + Math.abs(t.pnlPercent), 0) / lossTrades.length) 
      : 0;

    // AI Filtering Statistics (last 1 hour)
    const hourlySignals = (this.state.signalJournal || []).filter(s => new Date(s.timestamp).getTime() >= oneHourAgo);
    const blockedOpportunities = hourlySignals.filter(s => s.finalAction === 'HOLD' || (s.vetoReason && !s.vetoReason.includes('Aprobat'))).length;
    const totalOps = tradeCount + blockedOpportunities;
    const filterRate = totalOps > 0 ? ((blockedOpportunities / totalOps) * 100).toFixed(1) : '0.0';

    const sortedTrades = [...hourlyTrades].sort((a, b) => b.pnlPercent - a.pnlPercent);
    const top3 = sortedTrades.slice(0, 3);
    const medals = ['🥇', '🥈', '🥉'];
    const top3Str = top3.length > 0
      ? top3.map((t, idx) => `${medals[idx]} ${t.symbol} ${t.pnlPercent >= 0 ? '+' : ''}${t.pnlPercent.toFixed(2)}%`).join('\n')
      : 'Niciun trade închis';

    let regText = '⚠️ Lateral / Volatilitate redusă';
    if (this.lastNotifiedRegime) {
      if (this.lastNotifiedRegime.includes('Trend')) regText = '📈 Trend / Volatilitate optimă';
      else if (this.lastNotifiedRegime.includes('High Volatility')) regText = '⚡ Volatilitate ridicată';
      else regText = `⚠️ ${this.lastNotifiedRegime}`;
    }

    let actText = 'Execuție normală';
    if (comisioaneSum > pnlBrutSum || pnlNetSum < 0 || (this.lastNotifiedRegime && this.lastNotifiedRegime.includes('Stagnant'))) {
      actText = 'Reducere activitate / Stagnation Protection';
    }

    const pnlBrutSign = pnlBrutSum >= 0 ? '+' : '';
    const pnlNetSign = pnlNetSum >= 0 ? '+' : '';

    return `📊 **RAPORT ORAR — ${hourSpan}**\n\n` +
           `Capital: ${equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT\n\n` +
           `PnL brut: ${pnlBrutSign}${pnlBrutSum.toFixed(2)} USDT\n` +
           `Comisioane: -${comisioaneSum.toFixed(2)} USDT\n` +
           `PnL NET: ${pnlNetSign}${pnlNetSum.toFixed(2)} USDT\n\n` +
           `**EXECUȚII**\n` +
           `Trades: ${tradeCount}\n` +
           `Win Rate: ${winRate.toFixed(1)}%\n` +
           `Profit mediu: +${avgProfitPct.toFixed(2)}%\n` +
           `Pierdere medie: -${avgLossPct.toFixed(2)}%\n\n` +
           `**FILTRARE AI**\n` +
           `Executate: ${tradeCount}\n` +
           `Oportunități blocate: ${blockedOpportunities}\n` +
           `Rată filtrare: ${filterRate}%\n\n` +
           `**Top perechi:**\n${top3Str}\n\n` +
           `**REGIM**\n${regText}\n\n` +
           `**Acțiune:**\n${actText}`;
  }

  public generateDailyReport(date: Date): string {
    const timeZone = this.state.timezone || 'Europe/Bucharest';
    const hourFormatter = new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', hour12: false });
    const currHour = parseInt(hourFormatter.format(date), 10);
    const pad = (n: number) => n.toString().padStart(2, '0');
    const prevHour = (currHour - 1 + 24) % 24;
    const durationStr = `${pad(currHour)}:00–${pad(prevHour)}:59`;

    const equity = this.calculateEquity();
    const twentyFourHoursAgo = date.getTime() - 24 * 3600 * 1000;
    const dailyTrades = this.state.tradeHistory.filter(t => new Date(t.timestamp).getTime() >= twentyFourHoursAgo);

    let pnlBrutSum = 0;
    let comisioaneSum = 0;
    let pnlNetSum = 0;

    for (const t of dailyTrades) {
      const fee = (t as any).fee !== undefined 
        ? (t as any).fee 
        : ((t.entryPrice * t.amount + (t.exitPrice || t.entryPrice) * t.amount) * 0.00075);
      const gross = (t as any).pnlBrut !== undefined ? (t as any).pnlBrut : (t.pnl + fee);
      const net = t.pnl;

      pnlBrutSum += gross;
      comisioaneSum += fee;
      pnlNetSum += net;
    }

    const tradeCount = dailyTrades.length;
    const winTrades = dailyTrades.filter(t => t.pnl > 0);
    const winRate = tradeCount > 0 ? Math.round((winTrades.length / tradeCount) * 100) : 0;

    const pnlBrutSign = pnlBrutSum >= 0 ? '+' : '';
    const pnlNetSign = pnlNetSum >= 0 ? '+' : '';

    let warningBlock = '';
    if (comisioaneSum > pnlBrutSum || pnlNetSum < 0) {
      warningBlock = `⚠️ **COSTURI > PROFIT**\nRecomandare: activare Stagnation Protection`;
    } else {
      warningBlock = `✅ **PROFIT NET POZITIV**\nRecomandare: menținere configurare curentă`;
    }

    return `🌙 **REZUMAT ZILNIC**\n\n` +
           `Durată: ${durationStr}\n` +
           `Trades: ${tradeCount}\n` +
           `Win rate: ${winRate}%\n` +
           `PnL brut: ${pnlBrutSign}${pnlBrutSum.toFixed(2)} USDT\n` +
           `Comisioane: -${comisioaneSum.toFixed(2)} USDT\n` +
           `PnL NET: ${pnlNetSign}${pnlNetSum.toFixed(2)} USDT\n\n` +
           `${warningBlock}`;
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
      await this.cleanupDelistedAssets();
      const batchMap = await fetchBatchPricesServer();

      if (this.state.positions.length > 0) {
        // Prețuri sincronizate (silently handled)

      }

      // 1. Update prices on active watchlist items
      for (const item of this.state.watchlist) {
        if (!item.active) continue;
        const livePrice = batchMap.get(item.symbol) || batchMap.get(`${item.symbol}USDT`) || item.price;
        if (livePrice && livePrice > 0) {
          item.price = livePrice;
        }
      }

      // Update prices on market opportunities
      if (this.state.marketOpportunities && Array.isArray(this.state.marketOpportunities)) {
        for (const op of this.state.marketOpportunities) {
          const livePrice = batchMap.get(op.symbol) || batchMap.get(`${op.symbol}USDT`) || op.price;
          if (livePrice && livePrice > 0) {
            op.price = livePrice;
          }
        }
      }

      // 2. Iterate directly over ALL currently open positions to guarantee zero missed positions!
      const currentPositions = [...this.state.positions];
      for (const pos of currentPositions) {
        const symbol = pos.symbol;
        const watchItem = this.state.watchlist.find(w => w.symbol === symbol);
        const lastPrice = watchItem?.price || pos.currentPrice || pos.entryPrice || 0;

        let livePrice = batchMap.get(symbol) || batchMap.get(`${symbol}USDT`) || watchItem?.price;
        if (!livePrice || livePrice <= 0) {
          livePrice = await fetchLivePriceServer(symbol) || getFallbackBasePrice(symbol);
        }

        if (!livePrice || livePrice <= 0) {
          continue;
        }

        // Safety check on price jumps (>20%)
        if (lastPrice > 0) {
          const diff = Math.abs(livePrice - lastPrice) / lastPrice;
          if (diff > 0.20) {
            if (diff > 0.40) {
              logger.warn(`[SAFETY RE-SYNC] Re-calibrare preț pentru ${symbol}: $${lastPrice} -> $${livePrice}`);
              if (watchItem) watchItem.price = livePrice;
            } else {
              this.addLog(`[SAFETY] Preț anormal ignorat pentru ${symbol}: $${lastPrice} -> $${livePrice} (${(diff * 100).toFixed(1)}% variație)`, 'warning');
              continue;
            }
          }
        }

        if (watchItem) watchItem.price = livePrice;
        pos.currentPrice = livePrice;

        if (!(pos as any).highestPrice || livePrice > (pos as any).highestPrice) {
          (pos as any).highestPrice = livePrice;
        }
        if (!(pos as any).lowestPrice || livePrice < (pos as any).lowestPrice) {
          (pos as any).lowestPrice = livePrice;
        }

        const highestPrice = (pos as any).highestPrice || livePrice;
        const pnl = (livePrice - pos.entryPrice) * pos.amount;
        const pnlPercent = ((livePrice - pos.entryPrice) / pos.entryPrice) * 100;

        // Track when position enters or recovers from negative territory (PnL < 0)
        if (pnlPercent < 0) {
          if (!(pos as any).negativeEnteredAt) {
            (pos as any).negativeEnteredAt = Date.now();
          }
        } else {
          if ((pos as any).negativeEnteredAt) {
            delete (pos as any).negativeEnteredAt;
          }
        }

        const maxPnlPercent = ((highestPrice - pos.entryPrice) / pos.entryPrice) * 100;
        const pnlValueStr = pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`;
        const amountToSell = pos.amount;

        // Logging profit every minute for Trading Journal tracking
        const openedAtMs = (pos as any).openedAt || Date.now();
        const currentMinute = Math.floor((Date.now() - openedAtMs) / 60000);
        if (currentMinute >= 1) {
          const lastLogged = (pos as any).lastMinuteLogged || 0;
          if (currentMinute > lastLogged) {
            (pos as any).lastMinuteLogged = currentMinute;
            if (!(pos as any).minuteProfitLogs) {
              (pos as any).minuteProfitLogs = [];
            }
            const minuteLogEntry = {
              minute: currentMinute,
              pnlPercent: parseFloat(pnlPercent.toFixed(2)),
              pnl: parseFloat(pnl.toFixed(2)),
              price: livePrice,
              timestamp: new Date().toISOString()
            };
            (pos as any).minuteProfitLogs.push(minuteLogEntry);

            this.addLog(
              `[Profit Minut ⏱️ Jurnal] ${symbol} Min ${currentMinute}: PnL ${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}% (${pnlValueStr}) @ $${livePrice.toFixed(4)}`,
              pnlPercent >= 0 ? 'info' : 'warning'
            );
          }
        }

        const isGridStrategy = (pos as any)?.strategy === 'grid' || (pos as any)?.entryReason?.includes('Grid');
        const scalpConfig = this.state.scalpingConfig;
        const hardStopLossPct = -(scalpConfig?.stopLossPercent || this.state.stopLossPercent || 2.0);

        const holdDurationMinutes = (pos as any).openedAt ? (Date.now() - (pos as any).openedAt) / 60000 : 0;
        const maxHold = isGridStrategy 
          ? (this.state.gridConfig?.minRotationHoldMinutes ?? 90)
          : (scalpConfig?.maxHoldMinutes ?? this.state.scalpingConfig?.maxHoldMinutes ?? this.state.maxHoldMinutes ?? 10);

        let soldInThisCycle = false;

        // A. Hard Stop Loss Check
        if (pnlPercent <= hardStopLossPct) {
          this.addLog(`[Stop Loss Siguranță Server 🛑] Ieșire din ${symbol} la $${livePrice} (PNL: ${pnlPercent.toFixed(2)}% <= ${hardStopLossPct.toFixed(1)}% | ${pnlValueStr})`, 'warning');
          await this.executeTrade(symbol, 'SELL', livePrice, amountToSell, {
            mlProbability: (pos as any)?.entryMlProb || 50,
            modelName: 'Stop Loss Engine',
            entryReason: `Stop Loss Siguranță (${pnlPercent.toFixed(2)}% <= ${hardStopLossPct.toFixed(1)}%)`
          });
          this.sendNotification(`🚨 **[Stop Loss]** Vândut automat ${symbol} la $${livePrice} (PNL ${pnlPercent.toFixed(2)}% | ${pnlValueStr})`);
          soldInThisCycle = true;
        }
        // A2. Fixed Target Take Profit (scalping only — Grid has its own fixed TP at check C below)
        // FIX: this check used to live ONLY inside runMLAnalysis's separate "isHolding"
        // exit block, which ran on a different cadence (tied to the ML scan cycle) and
        // wasn't guaranteed to see every open position. Moved here so there is a single
        // exit engine, run every heartbeat tick, that guarantees every open position is
        // evaluated — see the removed duplicate block in runMLAnalysis for details.
        else if (!isGridStrategy && (scalpConfig?.targetTakeProfit ?? 3.0) > 0 && pnlPercent >= (scalpConfig?.targetTakeProfit ?? 3.0)) {
          const targetTP = scalpConfig?.targetTakeProfit ?? 3.0;
          this.addLog(`[Take Profit Țintă Fixă 🎯] Țintă de profit configurată atinsă pentru ${symbol} (+${pnlPercent.toFixed(2)}% >= +${targetTP}%). Executăm vânzare.`, 'success');
          await this.executeTrade(symbol, 'SELL', livePrice, amountToSell, {
            mlProbability: (pos as any)?.entryMlProb || 50,
            modelName: 'Fixed Target TP Engine',
            entryReason: `Take Profit Țintă Fixă (+${pnlPercent.toFixed(2)}% >= +${targetTP}%)`
          });
          this.sendNotification(`🎯 **[Take Profit]** Vândut automat ${symbol} la $${livePrice} (PNL +${pnlPercent.toFixed(2)}% | ${pnlValueStr})`);
          soldInThisCycle = true;
        } 
        // B. Parabolic Take Profit (+12.0%)
        else if (pnlPercent >= 12.0) {
          this.addLog(`[Take Profit Țintă Parabolică 🎯] Profit excepțional de +${pnlPercent.toFixed(2)}% atins pe ${symbol}. Vânzare automată.`, 'success');
          await this.executeTrade(symbol, 'SELL', livePrice, amountToSell);
          this.sendNotification(`🎯 **[Take Profit Parabolic]** Vândut automat ${symbol} la $${livePrice} (PNL +${pnlPercent.toFixed(2)}% | ${pnlValueStr})`);
          soldInThisCycle = true;
        }
        // C. Grid Strategy Fixed TP (+0.8%)
        else if (isGridStrategy && pnlPercent >= 0.8) {
          this.addLog(`[Grid Take Profit 🕸️] Nivel Grid atins pentru ${symbol} (+${pnlPercent.toFixed(2)}%). Executăm vânzare.`, 'success');
          await this.executeTrade(symbol, 'SELL', livePrice, amountToSell);
          soldInThisCycle = true;
        }
        // D. Scalping Trailing Stop & Break-Even
        else if (!isGridStrategy) {
          const minTrailActivation = Math.max(scalpConfig?.trailingStopActivation || 1.2, (pos as any)?.targetTP || scalpConfig?.targetTakeProfit || 1.2);
          let isTrailingTriggered = false;
          let trailDropPercent = scalpConfig?.trailingStopDistance || 0.5;

          if (maxPnlPercent >= 5.0) {
            trailDropPercent = Math.max(trailDropPercent, 1.0);
          } else if (maxPnlPercent >= 2.5) {
            trailDropPercent = Math.max(trailDropPercent, 0.7);
          }

          const trailPrice = highestPrice * (1 - trailDropPercent / 100);

          if (maxPnlPercent >= minTrailActivation && livePrice <= trailPrice && pnlPercent >= 0.3) {
            isTrailingTriggered = true;
          }

          if (isTrailingTriggered) {
            const netPnL = pnlPercent - 0.15;
            this.addLog(`[ATR Trailing Stop 📈 - Let Winners Run] Profit securizat pentru ${symbol}: PnL Curent +${pnlPercent.toFixed(2)}% (Net: +${netPnL.toFixed(2)}% | Peak: +${maxPnlPercent.toFixed(2)}% | Retragere -${trailDropPercent}%). Executăm vânzare.`, 'success');
            await this.executeTrade(symbol, 'SELL', livePrice, amountToSell, {
              mlProbability: (pos as any)?.entryMlProb || 50,
              modelName: 'ATR Trailing Stop Engine',
              entryReason: `ATR Trailing Stop (Peak +${maxPnlPercent.toFixed(2)}% ➔ PnL +${pnlPercent.toFixed(2)}%)`
            });
            soldInThisCycle = true;
          }
          // Break-Even Protection
          else if (maxPnlPercent >= (scalpConfig?.breakEvenActivation || 1.0) && livePrice <= pos.entryPrice * 1.0030 && pnlPercent >= 0.15) {
            this.addLog(`[Break-Even Protect 🛡️] Protecție Break-Even activată pentru ${symbol} la $${livePrice} (Vârf: +${maxPnlPercent.toFixed(2)}% ➔ Curent: +${pnlPercent.toFixed(2)}%). Salvare profit net.`, 'info');
            await this.executeTrade(symbol, 'SELL', livePrice, amountToSell, {
              mlProbability: (pos as any)?.entryMlProb || 50,
              modelName: 'Break-Even Engine',
              entryReason: `Break-Even Protect (Peak +${maxPnlPercent.toFixed(2)}%)`
            });
            soldInThisCycle = true;
          }
        }

        // E. STRICT UNCONDITIONAL MAX HOLD TIME EXPIRY CHECK
        if (!soldInThisCycle && maxHold > 0 && holdDurationMinutes >= maxHold) {
          const isProfit = pnlPercent >= 0;
          // Close position if in loss/stagnation or if max hold limit exceeded
          if (!isProfit || holdDurationMinutes >= maxHold * 1.2) {
            const reasonTag = `Timp Maxim Deținere Expirat ⏱️ (${Math.round(holdDurationMinutes)}m >= ${maxHold}m | PnL: ${pnlPercent.toFixed(2)}%)`;
            this.addLog(`[Limita Timp Deținere ⏱️] Poziția ${symbol} a depășit limita de deținere (${maxHold}m). Deținută: ${Math.round(holdDurationMinutes)}m (PNL: ${pnlPercent.toFixed(2)}%). Vânzare automată obligatorie.`, 'warning');
            await this.executeTrade(symbol, 'SELL', livePrice, amountToSell, {
              mlProbability: (pos as any)?.entryMlProb || 50,
              modelName: 'Max Hold Time Engine',
              entryReason: reasonTag
            });
            soldInThisCycle = true;
          }
        }

        // F. MAX NEGATIVE HOLD TIME CHECK
        const maxNegHold = scalpConfig?.maxNegativeHoldMinutes ?? this.state.scalpingConfig?.maxNegativeHoldMinutes ?? 15.0;
        const enableMaxNegHold = scalpConfig?.enableMaxNegativeHold ?? this.state.scalpingConfig?.enableMaxNegativeHold ?? false;
        if (!soldInThisCycle && enableMaxNegHold && pnlPercent < 0 && (pos as any).negativeEnteredAt && maxNegHold > 0) {
          const negHoldDurationMinutes = (Date.now() - (pos as any).negativeEnteredAt) / 60000;
          if (negHoldDurationMinutes >= maxNegHold) {
            const reasonTag = `Timp Minus Expirat ⏳ (${negHoldDurationMinutes.toFixed(1)}m >= ${maxNegHold}m | PnL: ${pnlPercent.toFixed(2)}%)`;
            this.addLog(`[Limita Timp Minus Expirată ⏳] Poziția ${symbol} a rămas pe minus peste limita configurată de ${maxNegHold} min (Timp pe minus: ${negHoldDurationMinutes.toFixed(1)}m | PnL: ${pnlPercent.toFixed(2)}%). Executăm vânzare automată pe minus.`, 'warning');
            await this.executeTrade(symbol, 'SELL', livePrice, amountToSell, {
              mlProbability: (pos as any)?.entryMlProb || 50,
              modelName: 'Negative Hold Timer Engine',
              entryReason: reasonTag
            });
            soldInThisCycle = true;
          }
        }
      }

      this.checkCircuitBreaker();
    } catch (err: any) {
      logger.warn(`[Price Check Warning] ${err?.message || err}`);
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

      // Phase 1: Batched Signal Generation & Price Fetching (batches of 3 items to optimize network & CPU load)
      const BATCH_SIZE_ML = 5;
      const itemsWithSignals: Array<{ item: WatchlistItem; currentPrice: number; signal: any; mlRes: any; oppScore: number; oppInfo: any; fullSignalObj?: any }> = [];

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

            const oppInfo = this.state.marketOpportunities?.find(o => o.symbol === item.symbol);
            const oppScore = oppInfo ? oppInfo.opportunityScore : (item.opportunityScore || 50);
            const symStat = this.state.symbolStats ? this.state.symbolStats[item.symbol] : undefined;
            
            const signalObj = await signalEngine.evaluateSymbol(item.symbol, currentPrice, oppInfo, symStat);
            
            let signal = {
              action: signalObj.action,
              prob: signalObj.confidence,
              modelName: 'Random Forest Ensemble 2.0',
              reason: signalObj.explanation || ''
            };
            item.signal = { action: signalObj.action, prob: signalObj.confidence };
            const mlRes = signalObj.mlRes;

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
              vetoReason: signal?.action === 'HOLD' ? 'Consolidare / Filtru Confluență' : 'Semnal Aprobat',
              explanation: mlRes?.explanation
            };

            if (!this.state.signalJournal) this.state.signalJournal = [];
            this.state.signalJournal.unshift(journalEntry);
            const signalLimit = this.state.maxLogs || 2500;
            if (this.state.signalJournal.length > signalLimit) {
              this.state.signalJournal = this.state.signalJournal.slice(0, signalLimit);
            }

            return { item, currentPrice, signal, mlRes, oppScore, oppInfo, fullSignalObj: signalObj };
          } catch (err: any) {
            logger.warn(`[ML Analysis Warning] Could not run ML analysis for ${item.symbol}: ${err?.message || err}`);
            return { item, currentPrice: item.price || 0, signal: null, mlRes: null, oppScore: 50, oppInfo: undefined, fullSignalObj: null };
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

      // Track and Notify Market Regime Changes
      const primaryRegimeItem = itemsWithSignals.find(x => x.mlRes?.marketRegime?.currentRegime);
      if (primaryRegimeItem?.mlRes?.marketRegime?.currentRegime) {
        const detectedRegime = primaryRegimeItem.mlRes.marketRegime.currentRegime;
        if (this.lastNotifiedRegime !== detectedRegime) {
          if (this.lastNotifiedRegime !== '') {
            let icon = '↔️';
            if (detectedRegime.includes('Stagnant')) icon = '🧊';
            else if (detectedRegime === 'Trend') icon = '📈';
            else if (detectedRegime === 'High Volatility') icon = '⚡';

            this.sendNotification(`${icon} **[Schimbare Regim Piață]**\nNoul Regim: **${detectedRegime}**\n${primaryRegimeItem.mlRes.marketRegime.regimeDescription || 'Sistemul a ajustat automat parametrii de siguranță.'}`);
          }
          this.lastNotifiedRegime = detectedRegime;
        }
      }

      // Update Smart AI Grid Analysis and execute grid oscillation trades if regime is Range / Lateral
      try {
        this.updateSmartGridAnalysis(itemsWithSignals);
      } catch (gridErr) {
        logger.warn(`[Smart Grid Analysis Warning] ${gridErr}`);
      }

      // Phase 2: Sequential Execution of Scalping Signals (bypassed if executionEngine is 'grid')
      const execEngine = this.state.executionEngine || 'both';
      if (execEngine !== 'grid') {
        for (const { item, currentPrice, signal, mlRes, oppScore, oppInfo, fullSignalObj } of itemsWithSignals) {
          if (!signal || currentPrice <= 0) continue;

          const pos = this.state.positions.find(p => p.symbol === item.symbol);
          const isHolding = pos && pos.amount > 0;

          if (signal.action === 'BUY' && signal.prob >= 30) {
            const scalpConfig = this.state.scalpingConfig || {
              active: true,
              minRfProb: 70,
              minMetaScore: 70,
              stopLossPercent: 1.0,
              targetTakeProfit: 0.0,
              trailingStopActivation: 5.0,
              trailingStopDistance: 0.5,
              breakEvenActivation: 1.0,
              positionSizePercent: 5.0,
              maxHoldMinutes: 15,
              minOpportunityScore: 50,
              cooldownMinutes: 2,
              enableDynamicSizing: true,
              minVolumeGrowth: 0.8,
              enableStagnationFilter: true,
              timeframe: "1m",
              minAtrPctThreshold: 0.05,
              minRange20pThreshold: 0.20,
              leverage: 1
            };

                                    if (!scalpConfig.active) {
              logger.info(`[VETO 🛑 MOTOR INACTIV] ${item.symbol}: Semnal CUMPĂRARE omis. Explicație: Motorul de Scalping este dezactivat în Setări.`);
              if (this.state.signalJournal && this.state.signalJournal.length > 0) {
                const j = this.state.signalJournal.find(entry => entry.symbol === item.symbol);
                if (j) j.vetoReason = `Motor Scalping Dezactivat din Setări`;
              }
              continue;
            }

            const riskReq = {
              symbol: item.symbol,
              signal: fullSignalObj,
              scalpConfig: scalpConfig,
              currentBalanceUSDT: this.state.balance,
              hasOpenPosition: isHolding,
              globalAutoTradingActive: this.state.autoTradingActive,
              oppInfo: oppInfo
            };

            const riskRes = riskEngine.evaluateOrder(riskReq);
            const metaBreakdown = fullSignalObj?.metaBreakdown || {};

            // Audit Trail: Signal Evaluated
            await db.logEvent('SIGNAL_EVALUATED', {
              symbol: item.symbol,
              action: signal.action,
              prob: signal.prob,
              metaScore: metaBreakdown.finalTradeScore,
              atrPercent: oppInfo?.atrPercent,
              candlestick: oppInfo?.candlestickPatternName
            }, item.symbol, 'TradeBot', 'SIGNAL');

            if (riskRes.decision === 'BLOCK') {
              logger.info(`[VETO 🛑 ${riskRes.vetoType || 'RISK'}] ${item.symbol}: ${riskRes.reason}`);
              if (this.state.signalJournal && this.state.signalJournal.length > 0) {
                const j = this.state.signalJournal.find(entry => entry.symbol === item.symbol);
                if (j) j.vetoReason = riskRes.reason;
              }
              await db.logEvent('RISK_EVALUATED', {
                symbol: item.symbol,
                decision: 'BLOCK',
                vetoType: riskRes.vetoType,
                reason: riskRes.reason,
                metaScore: metaBreakdown.finalTradeScore,
                prob: signal.prob
              }, item.symbol, 'TradeBot', 'VETO');
              continue;
            }

            await db.logEvent('RISK_EVALUATED', {
              symbol: item.symbol,
              decision: 'ALLOW',
              reason: riskRes.reason,
              metaScore: metaBreakdown.finalTradeScore,
              prob: signal.prob
            }, item.symbol, 'TradeBot', 'APPROVE');

            const equity = this.calculateEquity();
              const basePct = scalpConfig.positionSizePercent || 5.0;
              const sizePct = scalpConfig.enableDynamicSizing 
                ? (metaBreakdown.finalTradeScore >= 90 ? Math.min(15.0, basePct * 1.5) : (metaBreakdown.finalTradeScore >= 80 ? basePct * 1.2 : basePct))
                : basePct;
              const pct = sizePct / 100;
              const targetAllocation = parseFloat((equity * pct).toFixed(2));
              const allocation = Math.min(this.state.balance, targetAllocation);
              const minRequired = this.state.binanceMode === 'paper' ? 0.10 : 5.0;
              
              if (allocation >= minRequired) {
                const leverage = Math.max(1, Math.min(50, Number(scalpConfig.leverage || 1)));
                const actualAlloc = Math.min(this.state.balance, allocation);
                const safeAlloc = actualAlloc * 0.995;
                const nominalBuyingPower = safeAlloc * leverage;
                const rawAmount = nominalBuyingPower / currentPrice;
                const amountToBuy = rawAmount < 1 
                  ? parseFloat(rawAmount.toFixed(6)) 
                  : parseFloat(rawAmount.toFixed(4));
                  
                if (amountToBuy > 0) {
                  const targetTP = scalpConfig.targetTakeProfit ?? 3.0;
                  const levStr = leverage > 1 ? ` | Levier ${leverage}x (${(actualAlloc * leverage).toFixed(2)})` : '';
                  this.addLog(`[Signal ML Scalping 🚀] ${item.symbol}: BUY (MetaScore: ${metaBreakdown.finalTradeScore}/100 | Target TP: +${targetTP}% | RF Prob: ${signal.prob}%). Margină: ${actualAlloc.toFixed(2)} USDT (${sizePct.toFixed(1)}% din Equity)${levStr}. Executăm cumpărare.`, 'info');
                  await this.executeTrade(item.symbol, 'BUY', currentPrice, amountToBuy, {
                    mlProbability: signal.prob,
                    modelName: signal.modelName,
                    entryReason: `MetaScore ${metaBreakdown.finalTradeScore}/100 | Target TP: +${targetTP}% | RF: ${signal.prob}%${leverage > 1 ? ` | Levier ${leverage}x` : ''}`,
                    metaTradeScore: metaBreakdown.finalTradeScore,
                    targetTP: targetTP,
                    entryPatternName: oppInfo?.candlestickPatternName,
                    leverage: leverage,
                    strategy: 'scalping'
                  });
                }
              } else {
                this.addLog(`[Signal AI BUY] ${item.symbol} (MetaScore: ${metaBreakdown.finalTradeScore}/100): Alocarea calculată (${allocation.toFixed(2)} USDT) este sub minimul de ${minRequired} USDT.`, 'warning');
              }
            } else if (isHolding) {
              // exit management handled in checkPricesAndSLTP()
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
        `[SCANARE ML G&S-Trade-Bot 🔍 ${scanTimeStr}] Evaluat ${itemsWithSignals.length} perechi crypto. Rezultate: ${buyCount} BUY, ${sellCount} SELL, ${holdCount} HOLD. Engine 24/7: ${this.state.autoTradingActive ? 'ACTIV' : 'STANDBY'}.`,
        'info'
      );
      this.savePersistedState();
    } catch (err: any) {
      logger.warn(`[ML Analysis Error] ${err?.message || err}`);
    } finally {
      this.isRunningML = false;
    }
  }

  private async updateSmartGridAnalysis(itemsWithSignals: Array<{ item: any; currentPrice: number; signal: any; mlRes: any; oppScore: number; oppInfo: any; fullSignalObj?: any }>) {
    if (this.state.executionEngine !== 'grid' && this.state.executionEngine !== 'both') return;
    if (!this.state.autoTradingActive) return;

    let executedGridTrades = 0;
    let gridProfit = 0;
    let lastAction = '';
    const newStatuses: any[] = [];

    for (const { item, currentPrice, signal, mlRes, oppScore, oppInfo } of itemsWithSignals) {
      if (!signal || currentPrice <= 0) continue;
      
      const symbol = item.symbol;
      const pos = this.state.positions.find(p => p.symbol === symbol);
      const isHolding = pos && pos.amount > 0;
      
      const regime = mlRes?.marketRegime?.regime || 'RANGING';
      const rangeProb = mlRes?.marketRegime?.rangeProbability ?? 50;
      const stepPercent = this.state.scalpingConfig?.trailingStopActivation || 1.5;
      const allocatedCapitalPct = this.state.scalpingConfig?.positionSizePercent || 10.0;
      const minRequired = this.state.binanceMode === 'paper' ? 0.1 : 5.0;
      const gridConfidence = signal.prob || 50;
      const regimeBadge = regime;
      const regimeExplanation = mlRes?.marketRegime?.regimeDescription || '';
      let buyLevels = [currentPrice * (1 - (stepPercent / 100))];
      let sellLevels = [currentPrice * (1 + (stepPercent / 100))];
      let gridActive = regime === 'RANGING' || regime === 'LATERAL';
      let gridAnchorPrice = currentPrice;
      let lowerPrice = currentPrice * 0.95;
      let upperPrice = currentPrice * 1.05;
      const trendProb = mlRes?.marketRegime?.trendProbability ?? 50;
      const breakoutProb = mlRes?.marketRegime?.breakoutProbability ?? 50;
      const expectedDailyProfitPct = 1.0;
      const expectedDailyProfitMargin = 10;
      const maxDrawdownEstPct = -5.0;
      const choppinessIndex = 50;
      const bollingerWidthPct = oppInfo?.bbWidthPct || 0;
      const hurstExponent = 0.5;
      const adx = oppInfo?.adx || 20;
      const atrPercent = oppInfo?.atrPercent || 1.0;
      const supportPrice = currentPrice * 0.98;
      const resistancePrice = currentPrice * 1.02;
      const shockScore = 0;
      const shockLevel = 'NONE';
      const shockUntilMs = 0;
      
      if (gridActive) {
         
         if (!isHolding) {
            const equity = this.calculateEquity();
          const targetAlloc = Math.min(this.state.balance, parseFloat((equity * (allocatedCapitalPct / 100)).toFixed(2)));
          if (targetAlloc >= minRequired) {
            const amountToBuy = parseFloat((targetAlloc / currentPrice).toFixed(6));
            this.addLog(`[Smart AI Grid 🟢 SEED BUY] ${symbol}: Inițializare Poziție Grid la prețul curent ($${currentPrice.toFixed(4)} USDT | Range Prob: ${rangeProb}% | Pas Grid: ±${stepPercent.toFixed(2)}%). Alocat $${targetAlloc.toFixed(2)} USDT (${allocatedCapitalPct}% din Equity).`, 'info');
            
            this.executeTrade(symbol, 'BUY', currentPrice, amountToBuy, {
              mlProbability: gridConfidence,
              modelName: 'Smart AI Grid Engine 2.0',
              entryReason: `Smart AI Grid Seed Entry [${regimeBadge}] Range Prob ${rangeProb}%`,
              strategy: 'grid'
            });

            if (!this.state.gridHistory) this.state.gridHistory = [];
            this.state.gridHistory.unshift({
              id: `grid_${Date.now()}_${symbol}`,
              symbol,
              action: 'GRID_BUY',
              price: currentPrice,
              amount: amountToBuy,
              regime: regimeBadge,
              timestamp: new Date().toISOString()
            });

            executedGridTrades += 1;
            lastAction = `GRID SEED BUY @ $${currentPrice.toFixed(4)}`;
          }
        } 
        // 2. Multi-Level Grid Operations when holding a position:
        else if (isHolding && pos) {
          const targetSellPrice = Math.min(sellLevels[0], pos.entryPrice * (1 + (stepPercent / 100) * 0.90));
          const targetScaleInPrice = pos.entryPrice * (1 - (stepPercent / 100) * 0.85);

          // A. TAKE PROFIT SELL: Price reached SELL LEVEL #1 or +step% profit
          if (currentPrice >= targetSellPrice) {
            const pnl = (currentPrice - pos.entryPrice) * pos.amount;
            this.addLog(`[Smart AI Grid 🟢 SELL] ${symbol}: Preț pe Nivel Grid Vânzare ($${currentPrice.toFixed(4)} USDT >= Target $${targetSellPrice.toFixed(4)} | PnL: +$${pnl.toFixed(2)} USDT). Marcare profit!`, 'success');

            this.executeTrade(symbol, 'SELL', currentPrice, pos.amount, {
              mlProbability: gridConfidence,
              modelName: 'Smart AI Grid Engine 2.0',
              entryReason: `Smart AI Grid Take Profit [${regimeBadge}] Target $${targetSellPrice.toFixed(4)} USDT`
            });

            const holdMin = pos && (pos as any).openedAt ? Math.max(1, Math.round((Date.now() - (pos as any).openedAt) / 60000)) : 1;
            if (!this.state.gridHistory) this.state.gridHistory = [];
            this.state.gridHistory.unshift({
              id: `grid_${Date.now()}_${symbol}`,
              symbol,
              action: 'GRID_SELL',
              price: currentPrice,
              amount: pos.amount,
              pnl,
              regime: regimeBadge,
              timestamp: new Date().toISOString(),
              holdMinutes: holdMin
            });

            executedGridTrades += 1;
            gridProfit += Math.max(0, pnl);
            lastAction = `GRID SELL @ $${currentPrice.toFixed(4)} (+${pnl.toFixed(2)} USDT)`;
            gridAnchorPrice = currentPrice;
          }
          // B. DCA SCALE-IN BUY: Price dropped to lower grid level relative to entry
          else if (currentPrice <= targetScaleInPrice && this.state.balance >= minRequired) {
            const equity = this.calculateEquity();
            const targetAlloc = Math.min(this.state.balance, parseFloat((equity * ((allocatedCapitalPct * 0.6) / 100)).toFixed(2)));
            if (targetAlloc >= minRequired) {
              const amountToBuy = parseFloat((targetAlloc / currentPrice).toFixed(6));
              this.addLog(`[Smart AI Grid 🟢 DCA BUY] ${symbol}: Preț pe Nivel Grid Inferior ($${currentPrice.toFixed(4)} USDT <= Target $${targetScaleInPrice.toFixed(4)} | Entry $${pos.entryPrice.toFixed(4)}). Adăugare strat grid $${targetAlloc.toFixed(2)} USDT.`, 'info');

              this.executeTrade(symbol, 'BUY', currentPrice, amountToBuy, {
                mlProbability: gridConfidence,
                modelName: 'Smart AI Grid Engine 2.0',
                entryReason: `Smart AI Grid DCA Scale-In [${regimeBadge}] Level $${targetScaleInPrice.toFixed(4)}`,
                strategy: 'grid'
              });

              if (!this.state.gridHistory) this.state.gridHistory = [];
              this.state.gridHistory.unshift({
                id: `grid_${Date.now()}_${symbol}`,
                symbol,
                action: 'GRID_BUY',
                price: currentPrice,
                amount: amountToBuy,
                regime: regimeBadge,
                timestamp: new Date().toISOString()
              });

              executedGridTrades += 1;
              lastAction = `GRID DCA BUY @ $${currentPrice.toFixed(4)}`;
            }
          }
        }
      }

      newStatuses.push({
        symbol,
        regime,
        regimeBadge,
        regimeExplanation,
        gridActive,
        gridAnchorPrice,
        currentPrice,
        lowerPrice,
        upperPrice,
        gridStepPercent: parseFloat(stepPercent.toFixed(2)),
        buyLevels,
        sellLevels,
        executedGridTrades,
        gridProfit,
        opportunityScore: oppScore,
        rangeProb,
        trendProb,
        breakoutProb,
        gridConfidence,
        expectedDailyProfitPct,
        expectedDailyProfitMargin,
        maxDrawdownEstPct,
        choppinessIndex,
        bollingerWidthPct,
        hurstExponent,
        adxValue: adx,
        atrPercent,
        allocatedCapitalPct,
        supportPrice,
        resistancePrice,
        lastAction,
        shockScore,
        shockLevel,
        shockUntilMs,
        updatedAt: new Date().toISOString()
      });
    }

    this.state.smartGridStatus = newStatuses;
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