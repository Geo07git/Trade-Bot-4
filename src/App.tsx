import React, { useState, useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ViewState } from './types';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}
import { Sidebar } from './components/Sidebar';
import { SuperDashboard } from './components/SuperDashboard';
import { Dashboard } from './components/Dashboard';
import { ScalpingBot } from './components/ScalpingBot';
import { TradeLogs } from './components/TradeLogs';
import { TradingJournal } from './components/TradingJournal';
import { Settings } from './components/Settings';
import { useTradingStore } from './store';
import { sendWebPush, sendNotificationMessage } from './services/notifications';
import { generateSignal } from './services/ml';
import { fetchLivePrice } from './services/api';
import { apiFetch } from './utils/apiHelper';
import { Menu, ShieldAlert, RotateCcw } from 'lucide-react';

export default function App() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { 
    currentView,
    setCurrentView,
    balance, 
    setBalance, 
    autoTradingActive, 
    circuitBreakerTriggered,
    circuitBreakerReason,
    resetCircuitBreaker,
    dataInterval,
    analysisInterval, 
    setAutoTradingActive, 
    updatePrice
  } = useTradingStore();

  const [dataCountdown, setDataCountdown] = useState(dataInterval);
  const [analysisCountdown, setAnalysisCountdown] = useState(analysisInterval);
  const lastLogRef = useRef<{time: string, message: string} | null>(null);

  // Sync local credentials to server on app mount and poll server bot state
  useEffect(() => {
    // Initial sync of credentials from localStorage to server engine
    const localStore = useTradingStore.getState();
    if (
      localStore.testnetApiKey ||
      localStore.testnetApiSecret ||
      localStore.apiKey ||
      localStore.apiSecret ||
      localStore.telegramBotToken ||
      localStore.telegramChatId ||
      localStore.binanceMode
    ) {
      fetch('/api/bot/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: localStore.apiKey?.trim(),
          apiSecret: localStore.apiSecret?.trim(),
          testnetApiKey: localStore.testnetApiKey?.trim(),
          testnetApiSecret: localStore.testnetApiSecret?.trim(),
          binanceMode: localStore.binanceMode,
          telegramBotToken: localStore.telegramBotToken?.trim(),
          telegramChatId: localStore.telegramChatId?.trim(),
          discordWebhookUrl: localStore.discordWebhookUrl?.trim(),
          notificationProvider: localStore.notificationProvider
        })
      }).catch(() => {});
    }

    const fetchServerBotState = async () => {
      try {
        const res = await apiFetch('/api/bot/state');
        if (res.ok) {
          const data = await res.json();
          const currentStore = useTradingStore.getState();

          // If server is missing keys that exist locally in client, push them to server
          if (
            (currentStore.testnetApiKey && !data.testnetApiKey) ||
            (currentStore.testnetApiSecret && !data.testnetApiSecret) ||
            (currentStore.apiKey && !data.apiKey) ||
            (currentStore.apiSecret && !data.apiSecret) ||
            (currentStore.telegramBotToken && !data.telegramBotToken)
          ) {
            apiFetch('/api/bot/config', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                apiKey: currentStore.apiKey?.trim(),
                apiSecret: currentStore.apiSecret?.trim(),
                testnetApiKey: currentStore.testnetApiKey?.trim(),
                testnetApiSecret: currentStore.testnetApiSecret?.trim(),
                binanceMode: currentStore.binanceMode || data.binanceMode,
                telegramBotToken: currentStore.telegramBotToken?.trim(),
                telegramChatId: currentStore.telegramChatId?.trim()
              })
            }).catch(() => {});
          }
          
          if (data.logs && data.logs.length > 0) {
            const currentLatestLog = data.logs[0];
            if (lastLogRef.current && (lastLogRef.current.time !== currentLatestLog.time || lastLogRef.current.message !== currentLatestLog.message)) {
              if (currentLatestLog.type === 'success' || currentLatestLog.type === 'warning') {
                sendWebPush('G&S-Trade-Bot Semnal', currentLatestLog.message);
              }
            }
            lastLogRef.current = currentLatestLog;
          }

          // Sync server state to Zustand store cleanly with change-detection
          const updates: any = {};

          if (data.balance !== undefined && data.balance !== currentStore.balance) updates.balance = data.balance;
          if (data.initialBalance !== undefined && data.initialBalance !== currentStore.initialBalance) updates.initialBalance = data.initialBalance;
          if (data.accumulationBalance !== undefined && data.accumulationBalance !== currentStore.accumulationBalance) updates.accumulationBalance = data.accumulationBalance;
          if (data.accumulationTargetPercent !== undefined && data.accumulationTargetPercent !== currentStore.accumulationTargetPercent) updates.accumulationTargetPercent = data.accumulationTargetPercent;
          if (data.sessionCycleCount !== undefined && data.sessionCycleCount !== currentStore.sessionCycleCount) updates.sessionCycleCount = data.sessionCycleCount;
          if (data.accumulationTargetEnabled !== undefined && data.accumulationTargetEnabled !== currentStore.accumulationTargetEnabled) updates.accumulationTargetEnabled = data.accumulationTargetEnabled;
          if (data.positions && JSON.stringify(data.positions) !== JSON.stringify(currentStore.positions)) updates.positions = data.positions;
          if (data.logs && JSON.stringify(data.logs) !== JSON.stringify(currentStore.logs)) updates.logs = data.logs;
          if (data.signalJournal && JSON.stringify(data.signalJournal) !== JSON.stringify(currentStore.signalJournal)) updates.signalJournal = data.signalJournal;
          if (data.tradeHistory && JSON.stringify(data.tradeHistory) !== JSON.stringify(currentStore.tradeHistory)) updates.tradeHistory = data.tradeHistory;
          if (data.watchlist && JSON.stringify(data.watchlist) !== JSON.stringify(currentStore.watchlist)) updates.watchlist = data.watchlist;
          if (data.marketOpportunities && JSON.stringify(data.marketOpportunities) !== JSON.stringify(currentStore.marketOpportunities)) updates.marketOpportunities = data.marketOpportunities;
          if (data.symbolStats && JSON.stringify(data.symbolStats) !== JSON.stringify(currentStore.symbolStats)) updates.symbolStats = data.symbolStats;
          if (data.lastScanAt && data.lastScanAt !== currentStore.lastScanAt) updates.lastScanAt = data.lastScanAt;
          if (data.dynamicWatchlistSize && data.dynamicWatchlistSize !== currentStore.dynamicWatchlistSize) updates.dynamicWatchlistSize = data.dynamicWatchlistSize;
          if (data.positionSizePercent && data.positionSizePercent !== currentStore.positionSizePercent) updates.positionSizePercent = data.positionSizePercent;
          if (data.stopLossPercent && data.stopLossPercent !== currentStore.stopLossPercent) updates.stopLossPercent = data.stopLossPercent;
          if (data.maxHoldMinutes !== undefined && data.maxHoldMinutes !== currentStore.maxHoldMinutes) updates.maxHoldMinutes = data.maxHoldMinutes;
          if (data.executionEngine && data.executionEngine !== currentStore.executionEngine) updates.executionEngine = data.executionEngine;

          if (data.autoTradingActive !== undefined && data.autoTradingActive !== currentStore.autoTradingActive) updates.autoTradingActive = data.autoTradingActive;
          if (data.circuitBreakerTriggered !== undefined && !!data.circuitBreakerTriggered !== currentStore.circuitBreakerTriggered) updates.circuitBreakerTriggered = !!data.circuitBreakerTriggered;
          if (data.circuitBreakerReason !== undefined && data.circuitBreakerReason !== currentStore.circuitBreakerReason) updates.circuitBreakerReason = data.circuitBreakerReason || null;
          if (data.maxLogs && data.maxLogs !== currentStore.maxLogs) updates.maxLogs = data.maxLogs;
          if (data.notificationProvider && data.notificationProvider !== currentStore.notificationProvider) updates.notificationProvider = data.notificationProvider;
          if (data.discordWebhookUrl && data.discordWebhookUrl !== currentStore.discordWebhookUrl) updates.discordWebhookUrl = data.discordWebhookUrl;
          if (data.telegramBotToken && data.telegramBotToken !== currentStore.telegramBotToken) updates.telegramBotToken = data.telegramBotToken;
          if (data.telegramChatId && data.telegramChatId !== currentStore.telegramChatId) updates.telegramChatId = data.telegramChatId;
          if (data.timezone && data.timezone !== currentStore.timezone) updates.timezone = data.timezone;
          if (data.apiKey && data.apiKey !== currentStore.apiKey) updates.apiKey = data.apiKey;
          if (data.apiSecret && data.apiSecret !== currentStore.apiSecret) updates.apiSecret = data.apiSecret;
          if (data.testnetApiKey && data.testnetApiKey !== currentStore.testnetApiKey) updates.testnetApiKey = data.testnetApiKey;
          if (data.testnetApiSecret && data.testnetApiSecret !== currentStore.testnetApiSecret) updates.testnetApiSecret = data.testnetApiSecret;
          if (data.binanceMode && data.binanceMode !== currentStore.binanceMode) updates.binanceMode = data.binanceMode;
          if (data.lastCheckAt && data.lastCheckAt !== currentStore.lastCheckAt) updates.lastCheckAt = data.lastCheckAt;
          if (data.aiUsageStats && JSON.stringify(data.aiUsageStats) !== JSON.stringify(currentStore.aiUsageStats)) updates.aiUsageStats = data.aiUsageStats;

          if (Object.keys(updates).length > 0) {
            useTradingStore.setState(updates);
          }
        } else {
          // Server returned error, run client engine pulse fallback
          useTradingStore.getState().runClientEnginePulse();
        }
      } catch (err) {
        // Network/standalone mode, run client engine pulse fallback
        useTradingStore.getState().runClientEnginePulse();
      }
    };

    fetchServerBotState();
    const interval = setInterval(fetchServerBotState, 3000);

    // Auto-scan opportunities if empty or every 60s (ensures mobile Android & standalone client always have live rankings)
    if (useTradingStore.getState().marketOpportunities.length === 0) {
      useTradingStore.getState().triggerScanOpportunities();
    }
    const oppInterval = setInterval(() => {
      useTradingStore.getState().triggerScanOpportunities();
    }, 60000);

    return () => {
      clearInterval(interval);
      clearInterval(oppInterval);
    };
  }, []);

  // Tick countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setDataCountdown((prev) => prev - 1);
      if (autoTradingActive) {
        setAnalysisCountdown((prev) => prev - 1);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [autoTradingActive]);

  // Data Update Loop (Prices & Indicators)
  useEffect(() => {
    if (dataCountdown <= 0) {
      setDataCountdown(dataInterval);
    }
  }, [dataCountdown, autoTradingActive, dataInterval]);

  // AI Analysis & Execution Loop
  useEffect(() => {
    if (!autoTradingActive) return;

    if (analysisCountdown <= 0) {
      setAnalysisCountdown(analysisInterval);
    }
  }, [analysisCountdown, autoTradingActive, analysisInterval]);

  // Reset countdown if interval configuration changes
  useEffect(() => {
    setDataCountdown(dataInterval);
  }, [dataInterval]);

  useEffect(() => {
    setAnalysisCountdown(analysisInterval);
  }, [analysisInterval]);

  const validViews: ViewState[] = [
    'superDashboard', 
    'dashboard', 
    'scalping',
    'journal', 
    'logs', 
    'settings'
  ];
  const activeView: ViewState = validViews.includes(currentView) ? currentView : 'dashboard';

  useEffect(() => {
    console.log(`[G&S App.tsx] Content Mounting - Active View: "${activeView}" (raw store view: "${currentView}")`);
  }, [activeView, currentView]);

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-black text-zinc-100 overflow-hidden font-sans">
      {/* Mobile Ultra-Compact Top Header */}
      <header className="md:hidden h-11 bg-zinc-950 border-b border-white/10 flex items-center justify-between px-2.5 shrink-0 z-30">
        <div className="flex items-center gap-1.5">
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-1 text-zinc-300 hover:text-white rounded-md bg-zinc-900 border border-white/10 cursor-pointer"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1.5">
            <img 
              src="/logo.png" 
              alt="G&S Logo" 
              referrerPolicy="no-referrer"
              className="w-5 h-5 rounded object-contain border border-emerald-500/30 bg-zinc-900 p-0.5" 
            />
            <span className="font-serif italic text-sm text-white font-semibold tracking-tight">G&amp;S-Trade</span>
          </div>
        </div>
        
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCurrentView(activeView === 'superDashboard' ? 'dashboard' : 'superDashboard')}
            className={cn(
              "px-2 py-0.5 rounded-full text-[10px] font-medium border transition-all flex items-center gap-1 cursor-pointer",
              activeView === 'superDashboard'
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40 font-semibold"
                : "bg-zinc-900 text-zinc-300 border-white/10 hover:text-white"
            )}
            title="Comută vizualizarea Super Dashboard"
          >
            <span>⚡ Super</span>
          </button>

          <button
            onClick={() => {
              localStorage.removeItem('trading_store');
              window.location.reload();
            }}
            className="px-2 py-0.5 rounded-full text-[10px] font-medium border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 transition-all flex items-center gap-1 cursor-pointer"
            title="Hard Refresh: Șterge trading_store și reîncarcă"
          >
            <RotateCcw className="w-3 h-3 text-amber-400" />
            <span>Hard Refresh</span>
          </button>

          <button
            onClick={() => setAutoTradingActive(!autoTradingActive)}
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border transition-all cursor-pointer",
              autoTradingActive
                ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400"
                : "bg-rose-500/10 border-rose-500/40 text-rose-400"
            )}
            title="Pornire / Oprire tranzacționare server"
          >
            <span className={cn("w-1.5 h-1.5 rounded-full", autoTradingActive ? "bg-emerald-400 animate-pulse" : "bg-rose-500")}></span>
            <span>{autoTradingActive ? "24/7 ACTIV" : "24/7 OPRIT"}</span>
          </button>
        </div>
      </header>

      <Sidebar 
        currentView={activeView} 
        onViewChange={setCurrentView} 
        isOpenMobile={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />
      
      <main className="flex-1 h-full overflow-hidden relative flex flex-col">
        {/* Emergency Circuit Breaker Banner */}
        {circuitBreakerTriggered && (
          <div className="bg-gradient-to-r from-rose-950/90 via-red-900/90 to-rose-950/90 border-b border-rose-500/40 px-4 py-3 text-white flex flex-col md:flex-row items-center justify-between gap-3 shadow-lg z-20 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-400 shrink-0 animate-bounce">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-rose-200">CIRCUIT BREAKER ACTIVAT (Limita +10% Profit / -5% Loss)</span>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-rose-500/30 text-rose-300 border border-rose-400/30">Auto-Trade Oprit</span>
                </div>
                <p className="text-xs text-rose-300/90 mt-0.5">
                  {circuitBreakerReason || "Pragul de siguranță (+10% Profit / -5% Pierdere) a fost atins. Serverul a oprit executarea automată și a trimis notificare pe Telegram."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => resetCircuitBreaker()}
                className="px-4 py-1.5 bg-rose-500 hover:bg-rose-600 text-white font-medium text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span>Reluare Manual Trade / Reset</span>
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 h-full overflow-hidden relative flex flex-col">
          {activeView === 'superDashboard' && <SuperDashboard onSwitchToFullDashboard={() => setCurrentView('dashboard')} />}
          {activeView === 'dashboard' && <Dashboard />}
          {activeView === 'scalping' && <ScalpingBot />}
          {activeView === 'journal' && <TradingJournal />}
          {activeView === 'logs' && <TradeLogs />}
          {activeView === 'settings' && <Settings />}
        </div>
      </main>
    </div>
  );
}
