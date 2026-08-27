import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { registerSymbolCooldown } from './services/ml';
import { scanClientSideMarketOpportunities } from './services/api';
import { apiFetch, safeJson } from './utils/apiHelper';
import { ViewState, MarketOpportunity, SymbolPerformanceStat, ScalpingConfig, ExecutionEngineMode, MlModelSelection, Position, ScalpingPreset } from './types';

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
  accumulationBalance: number;
  accumulationTargetPercent: number;
  sessionCycleCount: number;
  accumulationTargetEnabled: boolean;
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
  presets: Record<'Conservator' | 'Free Trade' | 'Configurabil' | 'Dinamic', ScalpingPreset>;
  setScalpingConfig: (config: Partial<ScalpingConfig>) => void;
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
  setReportConfig: (config: Partial<TradingStore['reportConfig']>) => void;
  setAccumulationTargetPercent: (pct: number) => void;
  toggleAccumulationTarget: (enabled?: boolean) => void;
  consolidateAccumulation: () => Promise<any>;
  resetAccumulationVault: () => Promise<any>;
  syncBinanceBalance: () => Promise<any>;
  checkEnginePulse: () => Promise<any>;
  triggerScanOpportunities: () => Promise<any>;
  runClientEnginePulse: () => void;
}

export const useTradingStore = create<TradingStore>()(
  persist(
    (set) => ({
  currentView: 'dashboard',
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
  dynamicWatchlistSize: 20,
  lastScanAt: null,
  positions: [],
  logs: [],
  signalJournal: [],
  tradeHistory: [],
  maxLogs: 250,
  autoTradingActive: false,
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
  lastCheckAt: null,
  scalpingActive: true,
  scalpingConfig: {
    active: true,
    timeframe: '1m',
    minRfProb: 60,
    minMetaScore: 55,
    stopLossPercent: 0.50,
    targetTakeProfit: 1.00,
    trailingStopActivation: 0.55,
    trailingStopDistance: 0.18,
    breakEvenActivation: 0.40,
    positionSizePercent: 5.0,
    maxHoldMinutes: 25,
    maxNegativeHoldMinutes: 0.0,
    enableMaxNegativeHold: false,
    minOpportunityScore: 50,
    cooldownMinutes: 5,
    enableDynamicSizing: true,
    minVolumeGrowth: 0.8,
    enableStagnationFilter: true,
    minAtrPctThreshold: 0.12,
    minRange20pThreshold: 0.38,
    leverage: 1,
    activePreset: 'Conservator'
  },
  presets: {
    Conservator: {
        minRfProb: 75,
        minMetaScore: 55,
        stopLossPercent: 0.55,
        targetTakeProfit: 0.85,
        trailingStopActivation: 0.50,
        trailingStopDistance: 0.15,
        breakEvenActivation: 0.35,
        maxHoldMinutes: 8,
    },
    'Free Trade': {
        minRfProb: 70,
        minMetaScore: 50,
        stopLossPercent: 1.0,
        targetTakeProfit: 5.0,
        trailingStopActivation: 0.60,
        trailingStopDistance: 0.35,
        breakEvenActivation: 0.40,
        maxHoldMinutes: 8,
    },
    Configurabil: {
        minRfProb: 70,
        minMetaScore: 70,
        stopLossPercent: 1.0,
        targetTakeProfit: 3.0,
        trailingStopActivation: 1.5,
        trailingStopDistance: 0.5,
        breakEvenActivation: 1.0,
        maxHoldMinutes: 8,
    },
    Dinamic: {
        minRfProb: 75,
        minMetaScore: 55,
        stopLossPercent: 1.0, // Va fi suprascris de dinamic
        targetTakeProfit: 1.0, // Va fi suprascris de dinamic
        trailingStopActivation: 0.50,
        trailingStopDistance: 0.15,
        breakEvenActivation: 0.35,
        maxHoldMinutes: 8,
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

  setAccumulationTargetPercent: (pct) => {
    set({ accumulationTargetPercent: pct });
    apiFetch('/api/bot/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accumulationTargetPercent: pct })
    }).catch(() => {});
  },

  toggleAccumulationTarget: (enabled) => {
    set(state => {
      const nextVal = enabled !== undefined ? enabled : !state.accumulationTargetEnabled;
      apiFetch('/api/bot/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accumulationTargetEnabled: nextVal })
      }).catch(() => {});
      return { accumulationTargetEnabled: nextVal };
    });
  },

  consolidateAccumulation: async () => {
    try {
      const res = await apiFetch('/api/bot/consolidate-accumulation', { method: 'POST' });
      const data = await safeJson(res, null);
      if (data && data.state) {
        set({
          balance: data.state.balance,
          initialBalance: data.state.initialBalance,
          accumulationBalance: data.state.accumulationBalance,
          sessionCycleCount: data.state.sessionCycleCount,
          logs: data.state.logs || []
        });
      }
      return data;
    } catch (e: any) {
      console.error('Error consolidating accumulation:', e);
      return null;
    }
  },

  resetAccumulationVault: async () => {
    try {
      const res = await apiFetch('/api/bot/reset-accumulation', { method: 'POST' });
      const data = await safeJson(res, null);
      if (data && data.state) {
        set((state) => ({
          accumulationBalance: data.state.accumulationBalance !== undefined ? data.state.accumulationBalance : 0,
          sessionCycleCount: data.state.sessionCycleCount !== undefined ? data.state.sessionCycleCount : 1,
          initialBalance: data.state.initialBalance !== undefined ? data.state.initialBalance : state.initialBalance,
          balance: data.state.balance !== undefined ? data.state.balance : state.balance,
          logs: data.state.logs || []
        }));
      } else {
        set({ accumulationBalance: 0, sessionCycleCount: 1 });
      }
      return data;
    } catch (e: any) {
      console.error('Error resetting accumulation vault:', e);
      set({ accumulationBalance: 0, sessionCycleCount: 1 });
      return null;
    }
  },
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
        console.warn('[Trade Execution] Server sync deferred (optimistic state applied):', err?.message || err);
      });

    set((state) => {
      // Simplified paper trading optimistic UI update
      const cost = price * amount;
      if (action === 'BUY' && state.balance >= cost) {
        const existing = state.positions.find(p => p.symbol === symbol);
        let newPositions = [...state.positions];
        if (existing) {
          newPositions = state.positions.map(p => p.symbol === symbol ? { ...p, amount: p.amount + amount, currentPrice: price } : p);
        } else {
          newPositions.push({ symbol, amount, entryPrice: price, currentPrice: price, openedAt: Date.now() });
        }
        
        const newBalance = state.balance - cost;
        const newEquity = newBalance + newPositions.reduce((acc, pos) => acc + (pos.amount * (pos.currentPrice || pos.entryPrice)), 0);
        
        const timeFormatter = new Intl.DateTimeFormat('en-US', {
          timeZone: state.timezone || 'Europe/Bucharest',
          hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
        });
        const time = timeFormatter.format(new Date());

        return { 
          balance: newBalance, 
          positions: newPositions,
          logs: [{ time, message: `Cumpărat ${amount} ${symbol} @ $${price}`, type: 'success', equity: newEquity }, ...state.logs]
        };
      } else if (action === 'SELL') {
        const existing = state.positions.find(p => p.symbol === symbol);
        if (existing && existing.amount >= amount) {
          const pnlPercent = ((price - existing.entryPrice) / existing.entryPrice) * 100;
          registerSymbolCooldown(symbol, pnlPercent, pnlPercent >= 0 ? `Take Profit (+${pnlPercent.toFixed(2)}%)` : `Stop Loss (${pnlPercent.toFixed(2)}%)`);

          const newPositions = state.positions.map(p => 
            p.symbol === symbol ? { ...p, amount: p.amount - amount } : p
          ).filter(p => p.amount > 0);
          
          const newBalance = state.balance + cost;
          const newEquity = newBalance + newPositions.reduce((acc, pos) => acc + (pos.amount * (pos.currentPrice || pos.entryPrice)), 0);
          
          const timeFormatter = new Intl.DateTimeFormat('en-US', {
            timeZone: state.timezone || 'Europe/Bucharest',
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
          });
          const time = timeFormatter.format(new Date());

          return { 
            balance: newBalance,
            positions: newPositions,
            logs: [{ time, message: `Vândut ${amount} ${symbol} @ $${price}`, type: 'warning', equity: newEquity }, ...state.logs]
          };
        }
      }
      return state;
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
            initialBalance: data.state.initialBalance ?? 10000,
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
          accumulationBalance: data.state.accumulationBalance ?? 0,
          sessionCycleCount: data.state.sessionCycleCount ?? 1,
          positions: data.state.positions || [],
          watchlist: data.state.watchlist || [],
          logs: data.state.logs,
          signalJournal: data.state.signalJournal || [],
          lastCheckAt: data.state.lastCheckAt || data.lastCheckAt,
          scalpingConfig: data.state.scalpingConfig || {
            active: true,
            minRfProb: 70,
            minMetaScore: 70,
            stopLossPercent: 1.0,
            targetTakeProfit: 3.0,
            trailingStopActivation: 1.5,
            trailingStopDistance: 0.5,
            breakEvenActivation: 1.0,
            positionSizePercent: 5.0,
            maxHoldMinutes: 15,
            minOpportunityScore: 50,
            cooldownMinutes: 2,
            enableDynamicSizing: true,
            minVolumeGrowth: 0.8
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
    const state = useTradingStore.getState();
    if (state.circuitBreakerTriggered) return;

    const now = new Date();
    const timeStr = now.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    let newBalance = state.balance;
    let newPositions = [...state.positions];
    let newLogs = [...state.logs];
    let newJournal = [...(state.signalJournal || [])];
    let newTradeHistory = [...(state.tradeHistory || [])];

    // 1. Evaluate open positions for TP / SL
    let positionsChanged = false;
    newPositions = newPositions.map(pos => {
      const opp = state.marketOpportunities.find(o => o.symbol === pos.symbol);
      const watch = state.watchlist.find(w => w.symbol === pos.symbol);
      const currentPrice = opp?.price || watch?.price || pos.currentPrice || pos.entryPrice;

      const pnlUSD = (currentPrice - pos.entryPrice) * pos.amount;
      const pnlPercent = pos.entryPrice > 0 ? ((currentPrice - pos.entryPrice) / pos.entryPrice) * 100 : 0;

      // Minute profit logging
      const openedAtMs = pos.openedAt || Date.now();
      const currentMinute = Math.floor((Date.now() - openedAtMs) / 60000);
      let minuteProfitLogs = pos.minuteProfitLogs ? [...pos.minuteProfitLogs] : [];
      let lastMinuteLogged = pos.lastMinuteLogged || 0;

      if (currentMinute >= 1 && currentMinute > lastMinuteLogged) {
        lastMinuteLogged = currentMinute;
        minuteProfitLogs.push({
          minute: currentMinute,
          pnlPercent: parseFloat(pnlPercent.toFixed(2)),
          pnl: parseFloat(pnlUSD.toFixed(2)),
          price: currentPrice,
          timestamp: new Date().toISOString()
        });
      }

      let negEnteredAt = pos.negativeEnteredAt;
      if (pnlPercent < 0) {
        if (!negEnteredAt) negEnteredAt = Date.now();
      } else {
        negEnteredAt = undefined;
      }

      const tpTarget = state.scalpingConfig?.targetTakeProfit || 1.5;
      const slTarget = state.stopLossPercent || 2.0;
      const maxNegHold = state.scalpingConfig?.maxNegativeHoldMinutes ?? 1.0;
      const enableMaxNegHold = state.scalpingConfig?.enableMaxNegativeHold ?? true;
      const negDurationMinutes = negEnteredAt ? (Date.now() - negEnteredAt) / 60000 : 0;
      const isNegHoldExpired = enableMaxNegHold && pnlPercent < 0 && negEnteredAt && maxNegHold > 0 && negDurationMinutes >= maxNegHold;

      if (pnlPercent >= tpTarget || pnlPercent <= -slTarget || isNegHoldExpired) {
        positionsChanged = true;
        const isTP = pnlPercent > 0;
        const closeReason = isNegHoldExpired 
          ? `Timp Minus Expirat (${negDurationMinutes.toFixed(1)}m >= ${maxNegHold}m)`
          : (isTP ? 'Target Take Profit Atins' : 'Stop Loss Declanșat');
        
        const closeLog = `[${isNegHoldExpired ? 'TIMP MINUS EXPIRAT ⏳' : (isTP ? 'TAKE PROFIT 🎯' : 'STOP LOSS 🛑')}] Vândut ${pos.amount.toFixed(4)} ${pos.symbol} @ $${currentPrice.toFixed(4)}. PnL: ${pnlUSD >= 0 ? '+' : ''}$${pnlUSD.toFixed(2)} (${pnlPercent.toFixed(2)}%)`;
        
        newBalance += pos.amount * currentPrice;
        
        newLogs.unshift({
          time: timeStr,
          message: closeLog,
          type: isTP ? 'success' : 'warning',
          equity: newBalance
        });

        newTradeHistory.unshift({
          id: `trade_${Date.now()}_${pos.symbol}`,
          timestamp: new Date().toISOString(),
          time: timeStr,
          symbol: pos.symbol,
          type: 'SELL',
          price: currentPrice,
          amount: pos.amount,
          total: pos.amount * currentPrice,
          pnl: pnlUSD,
          pnlPercent: pnlPercent,
          reason: closeReason,
          minuteProfitLogs: minuteProfitLogs
        } as any);

        return null;
      }

      return { ...pos, currentPrice, negativeEnteredAt: negEnteredAt, lastMinuteLogged, minuteProfitLogs };
    }).filter(Boolean) as Position[];

    // 2. Evaluate signals & Auto-Trading when enabled
    if (state.autoTradingActive && state.marketOpportunities.length > 0) {
      const openSymbols = new Set(newPositions.map(p => p.symbol));
      const candidates = state.marketOpportunities.filter(o => !openSymbols.has(o.symbol)).slice(0, 4);

      candidates.forEach(cand => {
        const price = cand.price;
        const rfProb = cand.rfProb || 65;
        const metaProb = cand.metaProb || 55;
        const reversalScore = cand.patternScore || 60;
        const opportunityScore = cand.opportunityScore || 60;

        let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
        let vetoReason = '';
        const explanation: string[] = [
          `Analiză candidat: ${cand.symbol} la $${price}`,
          `Pattern Detectat: ${cand.patternName || 'Impuls Momentum'} (Scor: ${reversalScore}/100)`,
          `Probabilitate Model RF: ${rfProb}% | Meta-Predictor: ${metaProb}%`
        ];

        if (opportunityScore >= 55 && rfProb >= 60) {
          action = 'BUY';
          explanation.push(`✅ Semnal de Cumpărare APROBAT! Toate verificările ML au fost trecute cu succes.`);
        } else if (rfProb < 60) {
          vetoReason = `🚫 Veto ML: Probabilitatea RF (${rfProb}%) este sub pragul minim de 60%`;
          explanation.push(vetoReason);
        } else {
          vetoReason = `🚫 Veto Oportunitate: Scor oportunitate (${opportunityScore}/100) insuficient`;
          explanation.push(vetoReason);
        }

        const journalId = `sig_${Date.now()}_${cand.symbol}`;
        const existingIdx = newJournal.findIndex(j => j.symbol === cand.symbol && j.time === timeStr);
        if (existingIdx === -1) {
          newJournal.unshift({
            id: journalId,
            timestamp: new Date().toISOString(),
            time: timeStr,
            symbol: cand.symbol,
            price,
            rfProb,
            metaProb,
            reversalScore,
            isReversal: cand.patternScore > 80,
            reversalType: cand.priceChangePercent >= 0 ? 'bullish' : 'bearish',
            newsSentiment: cand.priceChangePercent >= 2 ? 'bullish' : 'neutral',
            finalAction: action,
            vetoReason: vetoReason || 'Niciun veto. Ordin executat.',
            explanation
          });
        }

        if (action === 'BUY' && newBalance > 50 && newPositions.length < 5) {
          const tradeAmountUSD = Math.min(newBalance * 0.15, 500);
          const amount = tradeAmountUSD / price;

          newBalance -= tradeAmountUSD;
          newPositions.push({
            symbol: cand.symbol,
            amount,
            entryPrice: price,
            currentPrice: price
          });

          const buyLog = `[SIGNAL ML BUY] Cumpărat ${amount.toFixed(4)} ${cand.symbol} @ $${price.toFixed(4)} (Total: $${tradeAmountUSD.toFixed(2)} USDT). Probabilitate ML: ${rfProb}%.`;
          newLogs.unshift({
            time: timeStr,
            message: buyLog,
            type: 'success',
            equity: newBalance + newPositions.reduce((a, p) => a + (p.amount * p.currentPrice), 0)
          });

          newTradeHistory.unshift({
            id: `trade_${Date.now()}_${cand.symbol}`,
            timestamp: new Date().toISOString(),
            time: timeStr,
            symbol: cand.symbol,
            type: 'BUY',
            price,
            amount,
            total: tradeAmountUSD,
            pnl: 0,
            pnlPercent: 0,
            reason: `Execuție Semnal Autonom ML (${rfProb}%)`
          });
        }
      });
    }

    const limit = state.maxLogs || 1000;
    set({
      balance: newBalance,
      positions: newPositions,
      logs: newLogs.slice(0, limit),
      signalJournal: newJournal.slice(0, limit),
      tradeHistory: newTradeHistory.slice(0, limit)
    });
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
