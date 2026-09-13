import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { registerSymbolCooldown } from './services/ml';
import { scanClientSideMarketOpportunities } from './services/api';
import { apiFetch, safeJson } from './utils/apiHelper';
import { Language } from './utils/i18n';
import { ViewState, MarketOpportunity, SymbolPerformanceStat, ScalpingConfig, ExecutionEngineMode, MlModelSelection, Position, ScalpingPreset, EquityProtectionConfig } from './types';

export interface WatchlistItem {
  symbol: string;
  price: number | null;
  signal: { action: 'BUY' | 'SELL' | 'HOLD'; prob: number } | null;
  active: boolean;
  opportunityScore?: number;
  rank?: number;
  isDynamic?: boolean;
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

interface TradingStore {
  currentView: ViewState;
  aiUsageStats?: {
    totalRequests: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    lastRequestTime: string | null;
    lastInputTokens: number;
    lastOutputTokens: number;
  };
  balance: number;
  initialBalance: number;
  watchlist: WatchlistItem[];
  marketOpportunities: MarketOpportunity[];
  symbolStats: Record<string, SymbolPerformanceStat>;
  dynamicWatchlistSize: number;
  lastScanAt: string | null;
  positions: Position[];
  logs: { time: string; message: string; type: 'info' | 'success' | 'warning'; equity?: number }[];
  signalJournal: SignalJournalEntry[];
  tradeHistory: any[];
  maxLogs: number;
  autoTradingActive: boolean;
  terminalActiveTab: 'matrix' | 'blotter' | 'intelligence' | 'audit';
  setTerminalActiveTab: (tab: 'matrix' | 'blotter' | 'intelligence' | 'audit') => void;
  circuitBreakerTriggered: boolean;
  circuitBreakerReason: string | null;
  dataInterval: number;
  analysisInterval: number;
  positionSizePercent: number;
  stopLossPercent: number;
  maxHoldMinutes: number;
  executionEngine: ExecutionEngineMode;
  mlModelType: MlModelSelection;
  serverUrl: string;
  apiKey: string;
  apiSecret: string;
  testnetApiKey: string;
  testnetApiSecret: string;
  geminiApiKey: string;
  notificationProvider: 'telegram' | 'discord' | 'all';
  discordWebhookUrl: string;
  telegramBotToken: string;
  telegramChatId: string;
  timezone: string;
  binanceMode: 'testnet' | 'live' | 'paper';
  exchangeProvider: 'binance' | 'bybit' | 'okx';
  bybitApiKey: string;
  bybitApiSecret: string;
  bybitTestnetApiKey: string;
  bybitTestnetApiSecret: string;
  okxApiKey: string;
  okxApiSecret: string;
  okxPassphrase: string;
  okxTestnetApiKey: string;
  okxTestnetApiSecret: string;
  okxTestnetPassphrase: string;
  lastCheckAt: string | null;
  reportConfig: {
    enabled?: boolean;
    channels: { telegram: boolean; discord: boolean; browser: boolean };
    daily: { enabled: boolean; time: string };
    weekly: { enabled: boolean; day: number; time: string };
    monthly: { enabled: boolean };
  };
  
  scalpingActive: boolean;
  scalpingConfig: ScalpingConfig;
  equityProtectionConfig: EquityProtectionConfig;
  presets: Record<'Free' | 'Dinamic', ScalpingPreset>;
  setScalpingConfig: (config: Partial<ScalpingConfig>) => void;
  setEquityProtectionConfig: (config: Partial<EquityProtectionConfig>) => void;
  toggleScalpingEngine: (active?: boolean) => void;
  resetScalpingEngine: () => Promise<any>;
  
  setCurrentView: (view: ViewState) => void;
  setServerUrl: (url: string) => void;
  setBalance: (amount: number) => void;
  addFunds: (amount: number) => void;
  addWatchlist: (symbol: string) => void;
  removeWatchlist: (symbol: string) => void;
  updatePrice: (symbol: string, price: number) => void;
  updateSignal: (symbol: string, signal: WatchlistItem['signal']) => void;
  toggleWatchlistActive: (symbol: string) => void;
  executeTrade: (symbol: string, action: 'BUY' | 'SELL', price: number, amount: number) => void;
  addLog: (message: string, type?: 'info' | 'success' | 'warning') => void;
  setMaxLogs: (limit: number) => void;
  clearLogs: () => void;
  clearSignalJournal: () => void;
  setAutoTradingActive: (active: boolean) => void;
  resetCircuitBreaker: () => void;
  setDataInterval: (seconds: number) => void;
  setAnalysisInterval: (seconds: number) => void;
  setPositionSizePercent: (pct: number) => void;
  setStopLossPercent: (pct: number) => void;
  setMaxHoldMinutes: (minutes: number) => void;
  setMaxNegativeHoldMinutes: (minutes: number) => void;
  setEnableMaxNegativeHold: (enabled: boolean) => void;
  setExecutionEngine: (engine: ExecutionEngineMode) => void;
  setMlModelType: (modelType: MlModelSelection) => void;
  setApiKey: (key: string) => void;
  setApiSecret: (secret: string) => void;
  setTestnetApiKey: (key: string) => void;
  setTestnetApiSecret: (secret: string) => void;
  setGeminiApiKey: (key: string) => void;
  setNotificationProvider: (provider: 'telegram' | 'discord' | 'all') => void;
  setDiscordWebhookUrl: (url: string) => void;
  setTelegramBotToken: (token: string) => void;
  setTelegramChatId: (id: string) => void;
  setTimezone: (timezone: string) => void;
  setBinanceMode: (mode: 'testnet' | 'live' | 'paper') => void;
  setExchangeProvider: (provider: 'binance' | 'bybit' | 'okx') => void;
  setBybitApiKey: (key: string) => void;
  setBybitApiSecret: (secret: string) => void;
  setBybitTestnetApiKey: (key: string) => void;
  setBybitTestnetApiSecret: (secret: string) => void;
  setOkxApiKey: (key: string) => void;
  setOkxApiSecret: (secret: string) => void;
  setOkxPassphrase: (pass: string) => void;
  setOkxTestnetApiKey: (key: string) => void;
  setOkxTestnetApiSecret: (secret: string) => void;
  setOkxTestnetPassphrase: (pass: string) => void;
  setReportConfig: (config: Partial<TradingStore['reportConfig']>) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  syncBinanceBalance: () => Promise<any>;
  checkEnginePulse: () => Promise<any>;
  triggerScanOpportunities: () => Promise<any>;
  runClientEnginePulse: () => void;
}

export const useTradingStore = create<TradingStore>()(
  persist(
    (set) => ({
  language: 'en',
  setLanguage: (lang) => set({ language: lang }),
  currentView: 'bloomberg',
  balance: 10000,
  initialBalance: 250,
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
  dynamicWatchlistSize: 20,
  lastScanAt: null,
  positions: [],
  logs: [],
  signalJournal: [],
  tradeHistory: [],
  maxLogs: 250,
  autoTradingActive: false,
  terminalActiveTab: 'matrix' as const,
  circuitBreakerTriggered: false,
  circuitBreakerReason: null,
  dataInterval: 10, // 10 seconds
  analysisInterval: 60, // 1 minute
  positionSizePercent: 5, // 5% of equity per trade
  stopLossPercent: 2.0, // 2.0% stop loss
  maxHoldMinutes: 5, // 5 min max position hold time
  executionEngine: 'both', // 'both' | 'grid' | 'scalping'
  mlModelType: 'rf',
  serverUrl: '',
  apiKey: '',
  apiSecret: '',
  testnetApiKey: '',
  testnetApiSecret: '',
  geminiApiKey: '',
  notificationProvider: 'all',
  discordWebhookUrl: '',
  telegramBotToken: '',
  telegramChatId: '',
  timezone: 'Europe/Bucharest',
  binanceMode: 'paper',
  exchangeProvider: 'binance',
  bybitApiKey: '',
  bybitApiSecret: '',
  bybitTestnetApiKey: '',
  bybitTestnetApiSecret: '',
  okxApiKey: '',
  okxApiSecret: '',
  okxPassphrase: '',
  okxTestnetApiKey: '',
  okxTestnetApiSecret: '',
  okxTestnetPassphrase: '',
  lastCheckAt: null,
  scalpingActive: true,
  scalpingConfig: {
    active: true,
    timeframe: '1m',
    minRfProb: 90,
    minMetaScore: 80,
    stopLossPercent: 5.0,
    targetTakeProfit: 0,
    trailingStopActivation: 3.0,
    trailingStopDistance: 0.5,
    breakEvenActivation: 2.0,
    positionSizePercent: 5.0,
    maxHoldMinutes: 120,
    maxNegativeHoldMinutes: 0.0,
    enableMaxNegativeHold: false,
    minOpportunityScore: 50,
    cooldownMinutes: 5,
    enableDynamicSizing: false,
    minVolumeGrowth: 0.8,
    enableStagnationFilter: false,
    minAtrPctThreshold: 0.12,
    minRange20pThreshold: 0.38,
    leverage: 1,
    activePreset: 'Free'
  },
  equityProtectionConfig: {
    enabled: true,
    trailingDistancePct: 0.40,
    profitThresholdPct: 0.80,
    highWaterMark: 0,
    isLocked: false
  },
  presets: {
    Free: {
      minRfProb: 90,
      minMetaScore: 80,
      stopLossPercent: 5.0,
      targetTakeProfit: 0,
      trailingStopActivation: 3.0,
      trailingStopDistance: 0.5,
      breakEvenActivation: 2.0,
      maxHoldMinutes: 120,
      positionSizePercent: 5.0,
      cooldownMinutes: 5,
      enableMaxNegativeHold: false,
      enableStagnationFilter: false,
      enableDynamicSizing: false
    },
    Dinamic: {
      minRfProb: 90,
      minMetaScore: 80,
      stopLossPercent: 5.0,
      targetTakeProfit: 0,
      trailingStopActivation: 3.0,
      trailingStopDistance: 0.5,
      breakEvenActivation: 2.0,
      maxHoldMinutes: 120,
      positionSizePercent: 5.0,
      cooldownMinutes: 5,
      enableMaxNegativeHold: false,
      enableStagnationFilter: false,
      enableDynamicSizing: true,
      enableDynamicTpSl: true
    }
  },
  reportConfig: {
    enabled: true,
    channels: { telegram: true, discord: true, browser: true },
    daily: { enabled: true, time: '21:00' },
    weekly: { enabled: true, day: 0, time: '21:00' },
    monthly: { enabled: true }
  },
  
  setCurrentView: (view) => set({ currentView: view }),




  setServerUrl: (url) => set({ serverUrl: url }),
  setBalance: (amount) => {
    set({ balance: amount, initialBalance: amount, positions: [], logs: [] });
    fetch('/api/bot/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ balance: amount })
    }).catch(() => {});
  },

  addFunds: (amount) => {
    if (isNaN(amount) || amount <= 0) return;
    apiFetch('/api/bot/add-funds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount })
    })
      .then(res => safeJson(res, null))
      .then(data => {
        if (data && data.state) {
          set(state => ({
            ...state,
            balance: data.state.balance ?? state.balance,
            initialBalance: data.state.initialBalance ?? state.initialBalance,
            logs: data.state.logs ?? state.logs
          }));
        }
      })
      .catch(err => console.warn('[Add Funds] Server sync deferred (optimistic state applied):', err?.message || err));

    set(state => ({
      balance: state.balance + amount,
      initialBalance: state.initialBalance + amount,
      logs: [
        {
          time: new Date().toLocaleTimeString(),
          message: `➕ Depunere/Adăugare fonduri: +$${amount.toFixed(2)} USDT adăugați în balanță.`,
          type: 'info',
          equity: state.balance + amount
        },
        ...state.logs
      ]
    }));
  },
  
  addWatchlist: (symbol) => set((state) => {
    if (state.watchlist.find(w => w.symbol === symbol)) return state;
    const newWatchlist = [...state.watchlist, { symbol, price: null, signal: null, active: true }];
    fetch('/api/bot/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ watchlist: newWatchlist })
    }).catch(() => {});
    return { watchlist: newWatchlist };
  }),

  removeWatchlist: (symbol) => set((state) => {
    const newWatchlist = state.watchlist.filter(w => w.symbol !== symbol);
    fetch('/api/bot/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ watchlist: newWatchlist })
    }).catch(() => {});
    return { watchlist: newWatchlist };
  }),

  updatePrice: (symbol, price) => set((state) => ({
    watchlist: state.watchlist.map(w => w.symbol === symbol ? { ...w, price } : w),
    positions: state.positions.map(p => p.symbol === symbol ? { ...p, currentPrice: price } : p)
  })),

  updateSignal: (symbol, signal) => set((state) => ({
    watchlist: state.watchlist.map(w => w.symbol === symbol ? { ...w, signal } : w)
  })),

  toggleWatchlistActive: (symbol) => set((state) => {
    const newWatchlist = state.watchlist.map(w => w.symbol === symbol ? { ...w, active: !w.active } : w);
    fetch('/api/bot/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ watchlist: newWatchlist })
    }).catch(() => {});
    return { watchlist: newWatchlist };
  }),

  executeTrade: (symbol, action, price, amount) => {
    apiFetch('/api/bot/trade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, action, price, amount })
    })
      .then(res => safeJson(res, null))
      .then(data => {
        if (data && data.state) {
          set((state) => ({
            ...state,
            balance: data.state.balance ?? state.balance,
            positions: (data.state.positions || state.positions || []).map((p: any) => ({
              ...p,
              openedAt: p.openedAt ? (typeof p.openedAt === 'string' ? new Date(p.openedAt).getTime() : p.openedAt) : Date.now()
            })),
            logs: data.state.logs ?? state.logs,
            circuitBreakerTriggered: data.state.circuitBreakerTriggered ?? state.circuitBreakerTriggered,
            circuitBreakerReason: data.state.circuitBreakerReason ?? state.circuitBreakerReason,
            autoTradingActive: data.state.autoTradingActive ?? state.autoTradingActive
          }));
        }
      })
      .catch((err) => {
        console.error('[Trade Execution API Error]:', err?.message || err);
      });
  },

  addLog: (message, type = 'info') => set((state) => {
    const timeFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: state.timezone || 'Europe/Bucharest',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
    });
    const time = timeFormatter.format(new Date());
    const limit = state.maxLogs || 1000;
    return {
      logs: [{ time, message, type }, ...state.logs.slice(0, limit - 1)]
    };
  }),

  setMaxLogs: (limit) => {
    set((state) => ({
      maxLogs: limit,
      logs: state.logs.slice(0, limit),
      signalJournal: (state.signalJournal || []).slice(0, limit)
    }));
    apiFetch('/api/bot/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maxLogs: limit })
    })
      .then(r => safeJson(r, null))
      .then(data => {
        if (data?.state) {
          set({
            maxLogs: data.state.maxLogs,
            logs: data.state.logs || [],
            signalJournal: data.state.signalJournal || []
          });
        }
      })
      .catch(() => {});
  },

  clearLogs: () => {
    set({ logs: [] });
    apiFetch('/api/bot/clear-logs', { method: 'POST' })
      .then(r => safeJson(r, null))
      .then(data => {
        if (data?.state) set({ logs: data.state.logs || [] });
      })
      .catch(() => {});
  },

  clearSignalJournal: () => {
    set({ signalJournal: [] });
    apiFetch('/api/bot/clear-signal-journal', { method: 'POST' })
      .then(r => safeJson(r, null))
      .then(data => {
        if (data?.state) set({ signalJournal: data.state.signalJournal || [] });
      })
      .catch(() => {});
  },

  setTerminalActiveTab: (tab) => set({ terminalActiveTab: tab }),

  setAutoTradingActive: (active) => {
    set({ autoTradingActive: active });
    apiFetch('/api/bot/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ autoTradingActive: active })
    }).catch(() => {});
  },

  resetCircuitBreaker: () => {
    set({ circuitBreakerTriggered: false, circuitBreakerReason: null, autoTradingActive: true });
    apiFetch('/api/bot/reset-circuit-breaker', {
      method: 'POST'
    })
      .then(res => safeJson(res, null))
      .then(data => {
        if (data && data.state) {
          set({
            circuitBreakerTriggered: !!data.state.circuitBreakerTriggered,
            circuitBreakerReason: data.state.circuitBreakerReason || null,
            autoTradingActive: !!data.state.autoTradingActive,
            initialBalance: data.state.initialBalance ?? 250,
            balance: data.state.balance ?? 10000
          });
        }
      })
      .catch(() => {});
  },
  setDataInterval: (seconds) => {
    set({ dataInterval: seconds });
    apiFetch('/api/bot/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataInterval: seconds })
    }).catch(() => {});
  },
  setAnalysisInterval: (seconds) => {
    set({ analysisInterval: seconds });
    fetch('/api/bot/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ analysisInterval: seconds })
    }).catch(() => {});
  },
  setPositionSizePercent: (pct) => {
    set((state) => ({
      positionSizePercent: pct,
      scalpingConfig: { ...state.scalpingConfig, positionSizePercent: pct }
    }));
    fetch('/api/bot/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ positionSizePercent: pct })
    }).catch(() => {});
  },
  setStopLossPercent: (pct) => {
    set((state) => ({
      stopLossPercent: pct,
      scalpingConfig: { ...state.scalpingConfig, stopLossPercent: pct }
    }));
    fetch('/api/bot/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stopLossPercent: pct })
    }).catch(() => {});
  },
  setMaxHoldMinutes: (minutes) => {
    set((state) => ({
      maxHoldMinutes: minutes,
      scalpingConfig: { ...state.scalpingConfig, maxHoldMinutes: minutes }
    }));
    fetch('/api/scalping-bot/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maxHoldMinutes: minutes })
    }).catch(() => {});
  },
  setMaxNegativeHoldMinutes: (minutes) => {
    set((state) => ({
      scalpingConfig: { ...state.scalpingConfig, maxNegativeHoldMinutes: minutes }
    }));
    fetch('/api/scalping-bot/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maxNegativeHoldMinutes: minutes })
    }).catch(() => {});
  },
  setEnableMaxNegativeHold: (enabled) => {
    set((state) => ({
      scalpingConfig: { ...state.scalpingConfig, enableMaxNegativeHold: enabled }
    }));
    fetch('/api/scalping-bot/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enableMaxNegativeHold: enabled })
    }).catch(() => {});
  },
  setExecutionEngine: (engine) => {
    set({ executionEngine: engine });
    fetch('/api/bot/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ executionEngine: engine })
    }).catch(() => {});
  },
  setMlModelType: (modelType) => {
    set({ mlModelType: modelType });
    fetch('/api/bot/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mlModelType: modelType })
    }).catch(() => {});
  },
  setApiKey: (key) => {
    set({ apiKey: key });
    fetch('/api/bot/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: key })
    }).catch(() => {});
  },
  setApiSecret: (secret) => {
    set({ apiSecret: secret });
    fetch('/api/bot/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiSecret: secret })
    }).catch(() => {});
  },
  setTestnetApiKey: (key) => {
    set({ testnetApiKey: key });
    fetch('/api/bot/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testnetApiKey: key })
    }).catch(() => {});
  },
  setTestnetApiSecret: (secret) => {
    set({ testnetApiSecret: secret });
    fetch('/api/bot/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ testnetApiSecret: secret })
    }).catch(() => {});
  },
  setGeminiApiKey: (key) => set({ geminiApiKey: key }),
  setNotificationProvider: (provider) => {
    set({ notificationProvider: provider });
    fetch('/api/bot/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notificationProvider: provider })
    }).catch(() => {});
  },
  setDiscordWebhookUrl: (url) => {
    set({ discordWebhookUrl: url });
    fetch('/api/bot/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ discordWebhookUrl: url })
    }).catch(() => {});
  },
  setTelegramBotToken: (token) => {
    set({ telegramBotToken: token });
    fetch('/api/bot/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramBotToken: token })
    }).catch(() => {});
  },
  setTelegramChatId: (id) => {
    set({ telegramChatId: id });
    fetch('/api/bot/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramChatId: id })
    }).catch(() => {});
  },
  setTimezone: (timezone) => {
    set({ timezone });
    fetch('/api/bot/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timezone })
    }).catch(() => {});
  },
  setBinanceMode: (mode) => {
    set({ binanceMode: mode });
    apiFetch('/api/bot/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ binanceMode: mode })
    })
      .then(() => {
        apiFetch('/api/bot/sync-binance', { method: 'POST' })
          .then(res => safeJson(res, null))
          .then(data => {
            if (data && data.state) {
              set({
                balance: data.state.balance,
                initialBalance: data.state.initialBalance,
                logs: data.state.logs
              });
            }
          })
          .catch(() => {});
      })
      .catch(() => {});
  },
  setExchangeProvider: (exchangeProvider) => set({ exchangeProvider }),
  setBybitApiKey: (bybitApiKey) => set({ bybitApiKey }),
  setBybitApiSecret: (bybitApiSecret) => set({ bybitApiSecret }),
  setBybitTestnetApiKey: (bybitTestnetApiKey) => set({ bybitTestnetApiKey }),
  setBybitTestnetApiSecret: (bybitTestnetApiSecret) => set({ bybitTestnetApiSecret }),
  setOkxApiKey: (okxApiKey) => set({ okxApiKey }),
  setOkxApiSecret: (okxApiSecret) => set({ okxApiSecret }),
  setOkxPassphrase: (okxPassphrase) => set({ okxPassphrase }),
  setOkxTestnetApiKey: (okxTestnetApiKey) => set({ okxTestnetApiKey }),
  setOkxTestnetApiSecret: (okxTestnetApiSecret) => set({ okxTestnetApiSecret }),
  setOkxTestnetPassphrase: (okxTestnetPassphrase) => set({ okxTestnetPassphrase }),
  syncBinanceBalance: async () => {
    try {
      // First ensure the server has the latest API keys and mode from store
      const currentState = useTradingStore.getState();
      await apiFetch('/api/bot/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: currentState.apiKey?.trim(),
          apiSecret: currentState.apiSecret?.trim(),
          testnetApiKey: currentState.testnetApiKey?.trim(),
          testnetApiSecret: currentState.testnetApiSecret?.trim(),
          binanceMode: currentState.binanceMode
        })
      }).catch(() => {});

      const res = await apiFetch('/api/bot/sync-binance', { method: 'POST' });
      const data = await safeJson(res, null);
      if (data && data.state) {
        set({
          balance: data.state.balance,
          initialBalance: data.state.initialBalance,
          logs: data.state.logs
        });
      }
      return data || { success: false, error: 'Empty response' };
    } catch (e: any) {
      console.warn(`Failed to sync binance balance: ${e?.message || e}`);
      return { success: false, error: 'Network error' };
    }
  },
  setReportConfig: (config) => set((state) => {
    const newConfig = { ...state.reportConfig, ...config };
    apiFetch('/api/bot/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportConfig: newConfig })
    }).catch(() => {});
    return { reportConfig: newConfig };
  }),
  setScalpingConfig: (config) => set((state) => {
    const newConfig = { ...state.scalpingConfig, ...config };
    apiFetch('/api/scalping-bot/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newConfig)
    }).catch(() => {});
    return { 
      scalpingConfig: newConfig, 
      scalpingActive: newConfig.active,
      stopLossPercent: newConfig.stopLossPercent ?? state.stopLossPercent,
      maxHoldMinutes: newConfig.maxHoldMinutes ?? state.maxHoldMinutes,
      positionSizePercent: newConfig.positionSizePercent ?? state.positionSizePercent
    };
  }),
  setEquityProtectionConfig: (config) => set((state) => {
    const newConfig = { ...state.equityProtectionConfig, ...config };
    apiFetch('/api/bot/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ equityProtectionConfig: newConfig })
    }).catch(() => {});
    return { equityProtectionConfig: newConfig };
  }),
  toggleScalpingEngine: (active) => set((state) => {
    const nextActive = active !== undefined ? active : !state.scalpingActive;
    const newConfig = { ...state.scalpingConfig, active: nextActive };
    apiFetch('/api/scalping-bot/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: nextActive })
    }).catch(() => {});
    return { scalpingActive: nextActive, scalpingConfig: newConfig };
  }),
  resetScalpingEngine: async () => {
    try {
      const res = await apiFetch('/api/scalping-bot/reset', { method: 'POST' });
      const data = await safeJson(res, null);
      if (data && data.state) {
        set({
          logs: data.state.logs || [],
          signalJournal: data.state.signalJournal || []
        });
      }
      return data || { success: false };
    } catch (e: any) {
      console.warn(`Failed to reset scalping engine: ${e?.message || e}`);
      return { success: false, error: 'Network error' };
    }
  },
  checkEnginePulse: async () => {
    try {
      const res = await apiFetch('/api/bot/pulse', { method: 'POST' });
      const data = await safeJson(res, null);
      if (data && data.state) {
        set({
          balance: data.state.balance,
          initialBalance: data.state.initialBalance,
          positions: data.state.positions || [],
          watchlist: data.state.watchlist || [],
          logs: data.state.logs,
          signalJournal: data.state.signalJournal || [],
          lastCheckAt: data.state.lastCheckAt || data.lastCheckAt,
          scalpingConfig: data.state.scalpingConfig || {
            active: true,
            timeframe: '1m',
            minRfProb: 90,
            minMetaScore: 80,
            stopLossPercent: 5.0,
            targetTakeProfit: 0,
            trailingStopActivation: 3.0,
            trailingStopDistance: 0.5,
            breakEvenActivation: 2.0,
            positionSizePercent: 5.0,
            maxHoldMinutes: 120,
            maxNegativeHoldMinutes: 0.0,
            enableMaxNegativeHold: false,
            minOpportunityScore: 50,
            cooldownMinutes: 5,
            enableDynamicSizing: false,
            minVolumeGrowth: 0.8,
            enableStagnationFilter: false,
            minAtrPctThreshold: 0.12,
            minRange20pThreshold: 0.38,
            leverage: 1,
            activePreset: 'Free'
          },
          scalpingActive: data.state.scalpingConfig?.active ?? true
        });
      }
      return data || { success: false };
    } catch (e: any) {
      console.warn(`Failed to check engine pulse: ${e?.message || e}`);
      return { success: false, error: 'Network error' };
    }
  },
  triggerScanOpportunities: async () => {
    try {
      const res = await apiFetch('/api/bot/scan-opportunities', { method: 'POST' });
      if (res.ok) {
        const data = await safeJson(res, null);
        if (data && Array.isArray(data.marketOpportunities) && data.marketOpportunities.length > 0) {
          set({
            marketOpportunities: data.marketOpportunities,
            symbolStats: data.symbolStats || {},
            lastScanAt: data.lastScanAt || new Date().toISOString()
          });
          return data;
        }
      }
      throw new Error('Backend scanner unavailable');
    } catch (e: any) {
      console.debug(`Backend scan unavailable, switching to client-side Binance scanner: ${e?.message || e}`);
      const fallbackOpps = await scanClientSideMarketOpportunities();
      if (fallbackOpps && fallbackOpps.length > 0) {
        set({
          marketOpportunities: fallbackOpps,
          lastScanAt: new Date().toISOString()
        });
        return { success: true, marketOpportunities: fallbackOpps };
      }
      return { success: false, error: 'Network error' };
    }
  },
  runClientEnginePulse: () => {
    // Decoupled UI architecture: all execution and order management is handled exclusively by the server engine.
    // Client pulse only updates UI opportunity timers without overriding server-side PnL calculations to prevent flickering.
    const state = useTradingStore.getState();
    if (state.marketOpportunities && state.marketOpportunities.length > 0) {
      // Do not recalculate PnL here as it causes conflicts with server-side updates.
    }
  }
    }),
    {
      name: 'trading-store',
      partialize: (state) => ({
        currentView: state.currentView,
        serverUrl: state.serverUrl,
        autoTradingActive: state.autoTradingActive,
        apiKey: state.apiKey,
        apiSecret: state.apiSecret,
        testnetApiKey: state.testnetApiKey,
        testnetApiSecret: state.testnetApiSecret,
        binanceMode: state.binanceMode,
        telegramBotToken: state.telegramBotToken,
        telegramChatId: state.telegramChatId
      })
    }
  )
);
