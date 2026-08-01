import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { registerSymbolCooldown } from './services/ml';
import { ViewState, MarketOpportunity, SymbolPerformanceStat } from './types';

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
  circuitBreakerTriggered: boolean;
  circuitBreakerReason: string | null;
  dataInterval: number;
  analysisInterval: number;
  positionSizePercent: number;
  stopLossPercent: number;
  apiKey: string;
  apiSecret: string;
  testnetApiKey: string;
  testnetApiSecret: string;
  geminiApiKey: string;
  notificationProvider: 'telegram';
  discordWebhookUrl: string;
  telegramBotToken: string;
  telegramChatId: string;
  timezone: string;
  binanceMode: 'testnet' | 'live' | 'paper';
  lastCheckAt: string | null;
  reportConfig: {
    channels: { telegram: boolean; browser: boolean };
    daily: { enabled: boolean; time: string };
    weekly: { enabled: boolean; day: number; time: string };
    monthly: { enabled: boolean };
  };
  
  setCurrentView: (view: ViewState) => void;
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
  setApiKey: (key: string) => void;
  setApiSecret: (secret: string) => void;
  setTestnetApiKey: (key: string) => void;
  setTestnetApiSecret: (secret: string) => void;
  setGeminiApiKey: (key: string) => void;
  setNotificationProvider: (provider: 'telegram') => void;
  setDiscordWebhookUrl: (url: string) => void;
  setTelegramBotToken: (token: string) => void;
  setTelegramChatId: (id: string) => void;
  setTimezone: (timezone: string) => void;
  setBinanceMode: (mode: 'testnet' | 'live' | 'paper') => void;
  setReportConfig: (config: Partial<TradingStore['reportConfig']>) => void;
  syncBinanceBalance: () => Promise<any>;
  checkEnginePulse: () => Promise<any>;
  triggerScanOpportunities: () => Promise<any>;
}

export const useTradingStore = create<TradingStore>()(
  persist(
    (set) => ({
  currentView: 'dashboard',
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
  dynamicWatchlistSize: 20,
  lastScanAt: null,
  positions: [],
  logs: [],
  signalJournal: [],
  tradeHistory: [],
  maxLogs: 2500,
  autoTradingActive: false,
  circuitBreakerTriggered: false,
  circuitBreakerReason: null,
  dataInterval: 30, // 30 seconds
  analysisInterval: 60, // 1 minute
  positionSizePercent: 5, // 5% of equity per trade
  stopLossPercent: 2.0, // 2.0% stop loss
  apiKey: '',
  apiSecret: '',
  testnetApiKey: '',
  testnetApiSecret: '',
  geminiApiKey: '',
  notificationProvider: 'telegram',
  discordWebhookUrl: '',
  telegramBotToken: '',
  telegramChatId: '',
  timezone: 'Europe/Bucharest',
  binanceMode: 'paper',
  lastCheckAt: null,
  reportConfig: {
    channels: { telegram: true, browser: true },
    daily: { enabled: true, time: '21:00' },
    weekly: { enabled: true, day: 0, time: '21:00' },
    monthly: { enabled: true }
  },
  
  setCurrentView: (view) => set({ currentView: view }),
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
    fetch('/api/bot/add-funds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount })
    })
      .then(res => res.json())
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
      .catch(err => console.error('Error adding funds on server:', err));

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
    fetch('/api/bot/trade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, action, price, amount })
    })
      .then(res => res.json())
      .then(data => {
        if (data && data.state) {
          set((state) => ({
            ...state,
            balance: data.state.balance ?? state.balance,
            positions: data.state.positions ?? state.positions,
            logs: data.state.logs ?? state.logs,
            circuitBreakerTriggered: data.state.circuitBreakerTriggered ?? state.circuitBreakerTriggered,
            circuitBreakerReason: data.state.circuitBreakerReason ?? state.circuitBreakerReason,
            autoTradingActive: data.state.autoTradingActive ?? state.autoTradingActive
          }));
        }
      })
      .catch((err) => console.error('Error executing trade on server:', err));

    set((state) => {
      // Simplified paper trading optimistic UI update
      const cost = price * amount;
      if (action === 'BUY' && state.balance >= cost) {
        const existing = state.positions.find(p => p.symbol === symbol);
        let newPositions = [...state.positions];
        if (existing) {
          newPositions = state.positions.map(p => p.symbol === symbol ? { ...p, amount: p.amount + amount, currentPrice: price } : p);
        } else {
          newPositions.push({ symbol, amount, entryPrice: price, currentPrice: price });
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
      logs: state.logs.slice(0, limit)
    }));
    fetch('/api/bot/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maxLogs: limit })
    }).catch(() => {});
  },

  clearLogs: () => {
    set({ logs: [] });
    fetch('/api/bot/clear-logs', { method: 'POST' }).catch(() => {});
  },

  clearSignalJournal: () => {
    set({ signalJournal: [] });
    fetch('/api/bot/clear-signal-journal', { method: 'POST' }).catch(() => {});
  },

  setAutoTradingActive: (active) => {
    set({ autoTradingActive: active });
    fetch('/api/bot/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ autoTradingActive: active })
    }).catch(() => {});
  },

  resetCircuitBreaker: () => {
    set({ circuitBreakerTriggered: false, circuitBreakerReason: null, autoTradingActive: true });
    fetch('/api/bot/reset-circuit-breaker', {
      method: 'POST'
    }).catch(() => {});
  },
  setDataInterval: (seconds) => {
    set({ dataInterval: seconds });
    fetch('/api/bot/config', {
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
    set({ positionSizePercent: pct });
    fetch('/api/bot/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ positionSizePercent: pct })
    }).catch(() => {});
  },
  setStopLossPercent: (pct) => {
    set({ stopLossPercent: pct });
    fetch('/api/bot/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stopLossPercent: pct })
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
    fetch('/api/bot/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ binanceMode: mode })
    })
      .then(() => {
        fetch('/api/bot/sync-binance', { method: 'POST' })
          .then(res => res.json())
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
      await fetch('/api/bot/config', {
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

      const res = await fetch('/api/bot/sync-binance', { method: 'POST' });
      const data = await res.json();
      if (data && data.state) {
        set({
          balance: data.state.balance,
          initialBalance: data.state.initialBalance,
          logs: data.state.logs
        });
      }
      return data;
    } catch (e: any) {
      console.warn(`Failed to sync binance balance: ${e?.message || e}`);
      return { success: false, error: 'Network error' };
    }
  },
  setReportConfig: (config) => set((state) => {
    const newConfig = { ...state.reportConfig, ...config };
    fetch('/api/bot/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportConfig: newConfig })
    }).catch(() => {});
    return { reportConfig: newConfig };
  }),
  checkEnginePulse: async () => {
    try {
      const res = await fetch('/api/bot/pulse', { method: 'POST' });
      const data = await res.json();
      if (data && data.state) {
        set({
          balance: data.state.balance,
          initialBalance: data.state.initialBalance,
          logs: data.state.logs,
          signalJournal: data.state.signalJournal || [],
          lastCheckAt: data.state.lastCheckAt || data.lastCheckAt
        });
      }
      return data;
    } catch (e: any) {
      console.warn(`Failed to check engine pulse: ${e?.message || e}`);
      return { success: false, error: 'Network error' };
    }
  },
  triggerScanOpportunities: async () => {
    try {
      const res = await fetch('/api/bot/scan-opportunities', { method: 'POST' });
      const data = await res.json();
      if (data && data.marketOpportunities) {
        set({
          marketOpportunities: data.marketOpportunities,
          symbolStats: data.symbolStats || {},
          lastScanAt: data.lastScanAt || new Date().toISOString()
        });
      }
      return data;
    } catch (e: any) {
      console.warn(`Failed to scan market opportunities: ${e?.message || e}`);
      return { success: false, error: 'Network error' };
    }
  }
    }),
    {
      name: 'trading-store'
    }
  )
);
