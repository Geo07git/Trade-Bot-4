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
import { AIAnalyst } from './components/AIAnalyst';
import { TradeLogs } from './components/TradeLogs';
import { Alerts } from './components/Alerts';
import { TradingJournal } from './components/TradingJournal';
import { NewsFeed } from './components/NewsFeed';
import { Settings } from './components/Settings';
import { useTradingStore } from './store';
import { sendWebPush, sendNotificationMessage } from './services/notifications';
import { generateSignal } from './services/ml';
import { fetchLivePrice } from './services/api';
import { Menu, ShieldAlert } from 'lucide-react';

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
        const res = await fetch('/api/bot/state');
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
            fetch('/api/bot/config', {
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
                sendWebPush('AI.TRADE Semnal', currentLatestLog.message);
              }
            }
            lastLogRef.current = currentLatestLog;
          }

          // Sync server state to Zustand store cleanly
          const updates: any = {};

          if (data.balance !== undefined) updates.balance = data.balance;
          if (data.initialBalance !== undefined) updates.initialBalance = data.initialBalance;
          if (data.positions) updates.positions = data.positions;
          if (data.logs) updates.logs = data.logs;
          if (data.signalJournal) updates.signalJournal = data.signalJournal;
          if (data.tradeHistory) updates.tradeHistory = data.tradeHistory;
          if (data.watchlist) updates.watchlist = data.watchlist;
          if (data.marketOpportunities) updates.marketOpportunities = data.marketOpportunities;
          if (data.symbolStats) updates.symbolStats = data.symbolStats;
          if (data.lastScanAt) updates.lastScanAt = data.lastScanAt;
          if (data.dynamicWatchlistSize) updates.dynamicWatchlistSize = data.dynamicWatchlistSize;
          if (data.positionSizePercent) updates.positionSizePercent = data.positionSizePercent;
          if (data.stopLossPercent) updates.stopLossPercent = data.stopLossPercent;

          if (data.autoTradingActive !== undefined) updates.autoTradingActive = data.autoTradingActive;
          if (data.circuitBreakerTriggered !== undefined) updates.circuitBreakerTriggered = !!data.circuitBreakerTriggered;
          if (data.circuitBreakerReason !== undefined) updates.circuitBreakerReason = data.circuitBreakerReason || null;
          if (data.maxLogs) updates.maxLogs = data.maxLogs;
          if (data.notificationProvider) updates.notificationProvider = data.notificationProvider;
          if (data.discordWebhookUrl) updates.discordWebhookUrl = data.discordWebhookUrl;
          if (data.telegramBotToken) updates.telegramBotToken = data.telegramBotToken;
          if (data.telegramChatId) updates.telegramChatId = data.telegramChatId;
          if (data.timezone) updates.timezone = data.timezone;
          if (data.apiKey) updates.apiKey = data.apiKey;
          if (data.apiSecret) updates.apiSecret = data.apiSecret;
          if (data.testnetApiKey) updates.testnetApiKey = data.testnetApiKey;
          if (data.testnetApiSecret) updates.testnetApiSecret = data.testnetApiSecret;
          if (data.binanceMode) updates.binanceMode = data.binanceMode;
          if (data.lastCheckAt) updates.lastCheckAt = data.lastCheckAt;

          useTradingStore.setState(updates);
        }
      } catch (err) {
        console.debug('Server state sync error:', err);
      }
    };

    fetchServerBotState();
    const interval = setInterval(fetchServerBotState, 3000);
    return () => clearInterval(interval);
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

  return (
    <div className="flex flex-col md:flex-row h-screen w-full bg-black text-zinc-100 overflow-hidden font-sans">
      {/* Mobile Top Header */}
      <header className="md:hidden h-14 bg-zinc-900/90 border-b border-white/5 flex items-center justify-between px-3 shrink-0 z-30">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-1.5 text-zinc-300 hover:text-white rounded-lg bg-zinc-800/50 border border-white/5"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-serif italic text-base text-white font-semibold">AI.TRADE</span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentView(currentView === 'superDashboard' ? 'dashboard' : 'superDashboard')}
            className={cn(
              "px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all flex items-center gap-1 cursor-pointer",
              currentView === 'superDashboard'
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40 font-semibold"
                : "bg-zinc-800 text-zinc-300 border-white/10 hover:text-white"
            )}
            title="Deschide Super Dashboard pentru mobil"
          >
            <span>⚡ Super</span>
          </button>

          <button
            onClick={() => setAutoTradingActive(!autoTradingActive)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold border transition-all cursor-pointer",
              autoTradingActive
                ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400"
                : "bg-rose-500/10 border-rose-500/40 text-rose-400"
            )}
            title="Pornire / Oprire tranzacționare server"
          >
            <span className={cn("w-2 h-2 rounded-full", autoTradingActive ? "bg-emerald-400 animate-pulse" : "bg-rose-500")}></span>
            <span>{autoTradingActive ? "24/7 ACTIV" : "24/7 OPRIT"}</span>
          </button>
        </div>
      </header>

      <Sidebar 
        currentView={currentView} 
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
          {currentView === 'superDashboard' && <SuperDashboard onSwitchToFullDashboard={() => setCurrentView('dashboard')} />}
          {currentView === 'dashboard' && <Dashboard />}
          {currentView === 'journal' && <TradingJournal />}
          {currentView === 'analyst' && <AIAnalyst />}
          {currentView === 'news' && <NewsFeed />}
          {currentView === 'alerts' && <Alerts />}
          {currentView === 'logs' && <TradeLogs />}
          {currentView === 'settings' && <Settings />}
        </div>
      </main>
    </div>
  );
}
