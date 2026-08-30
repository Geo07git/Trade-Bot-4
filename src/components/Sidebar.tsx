import React from 'react';
import { ViewState } from '../types';
import { X, Power, RotateCcw, Globe } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useTradingStore } from '../store';
import { getTranslation } from '../utils/i18n';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

interface SidebarProps {
  currentView: ViewState;
  onViewChange: (view: ViewState) => void;
  isOpenMobile?: boolean;
  onCloseMobile?: () => void;
}

export function Sidebar({ currentView, onViewChange, isOpenMobile, onCloseMobile }: SidebarProps) {
  const { 
    language,
    setLanguage,
    autoTradingActive, 
    setAutoTradingActive,
    binanceMode,
    apiKey,
    apiSecret,
    testnetApiKey,
    testnetApiSecret,
    circuitBreakerTriggered,
    accumulationBalance = 0,
    sessionCycleCount = 1
  } = useTradingStore();

  const t = getTranslation(language);

  const navItems: { id: ViewState; label: string }[] = [
    { id: 'bloomberg', label: t.bloombergView },
    { id: 'dashboard', label: t.overviewView },
    { id: 'strategy', label: t.strategyView },
    { id: 'audit', label: t.auditView },
    { id: 'momentumPaper', label: t.momentumView },
    { id: 'backtest', label: t.backtestView },
    { id: 'journal', label: t.journalView },
    { id: 'logs', label: t.logsView },
    { id: 'settings', label: t.settingsView },
  ];

  return (
    <>
      {/* Mobile backdrop overlay */}
      {isOpenMobile && (
        <div 
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 md:hidden"
        />
      )}

      <aside className={cn(
        "w-64 border-r border-amber-500/20 bg-[#08090c] backdrop-blur-3xl flex flex-col h-full z-50 transition-transform duration-300 ease-in-out shrink-0",
        "fixed inset-y-0 left-0 md:static md:translate-x-0",
        isOpenMobile ? "translate-x-0 shadow-2xl" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="p-4 flex items-center justify-between border-b border-amber-500/20">
          <div className="flex items-center gap-2.5">
            <img 
              src="/logo.png" 
              alt="TradeBot Logo" 
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded object-contain border border-amber-500/40 shadow-md bg-zinc-950 p-0.5" 
            />
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-mono text-base font-bold tracking-tight text-white leading-tight">TradeBot</h1>
                <span className="px-1 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">PRO v4</span>
              </div>
              <p className="text-[8px] uppercase tracking-[0.12em] text-amber-400 font-mono mt-0.5">{t.terminalSub}</p>
            </div>
          </div>
          {onCloseMobile && (
            <button 
              onClick={onCloseMobile}
              className="p-1.5 text-zinc-400 hover:text-white md:hidden"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <nav className="flex-1 px-3 space-y-1 py-3 overflow-y-auto font-mono text-xs">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onViewChange(item.id);
                if (onCloseMobile) onCloseMobile();
              }}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2.5 rounded text-xs transition-all text-left font-mono tracking-tight",
                currentView === item.id || (item.id === 'bloomberg' && currentView === 'superDashboard')
                  ? "bg-amber-500 text-black font-bold shadow-md shadow-amber-500/10" 
                  : "text-zinc-400 hover:text-white hover:bg-white/5"
              )}
            >
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-amber-500/20 space-y-2.5">
          {/* Language Selector */}
          <div className="flex items-center justify-between p-2 rounded bg-zinc-900/60 border border-white/10 text-xs font-mono">
            <span className="text-zinc-400 flex items-center gap-1.5 text-[11px]">
              <Globe className="w-3.5 h-3.5 text-amber-400" />
              {t.languageSelect}
            </span>
            <div className="flex items-center rounded overflow-hidden border border-amber-500/40">
              <button
                onClick={() => setLanguage('en')}
                className={cn(
                  "px-2 py-0.5 text-[10px] font-bold",
                  language === 'en' ? "bg-amber-500 text-black" : "bg-zinc-800 text-zinc-400 hover:text-white"
                )}
              >
                EN
              </button>
              <button
                onClick={() => setLanguage('ro')}
                className={cn(
                  "px-2 py-0.5 text-[10px] font-bold",
                  language === 'ro' ? "bg-amber-500 text-black" : "bg-zinc-800 text-zinc-400 hover:text-white"
                )}
              >
                RO
              </button>
            </div>
          </div>

          {/* Hard Refresh Button */}
          <button
            onClick={() => {
              localStorage.removeItem('trading_store');
              window.location.reload();
            }}
            className="w-full flex items-center justify-center gap-1.5 p-2 rounded border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-[11px] font-semibold transition-all cursor-pointer font-mono"
            title="Reset store & reload"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
            <span>{t.hardReset}</span>
          </button>

          {/* Server 24/7 Control Button in Sidebar */}
          <button
            onClick={() => setAutoTradingActive(!autoTradingActive)}
            className={cn(
              "w-full flex items-center justify-between p-2.5 rounded border text-[11px] font-semibold transition-all cursor-pointer font-mono",
              autoTradingActive
                ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20"
                : "bg-rose-500/10 border-rose-500/40 text-rose-400 hover:bg-rose-500/20"
            )}
          >
            <div className="flex items-center gap-2">
              <span className={cn("w-2 h-2 rounded-full", autoTradingActive ? "bg-emerald-400 animate-pulse" : "bg-rose-500")}></span>
              <span>{autoTradingActive ? `24/7: ${t.tradingActive}` : `24/7: ${t.tradingHalted}`}</span>
            </div>
            <Power className="w-3.5 h-3.5 opacity-75" />
          </button>

          {/* Real API Status & Binance Mode panel */}
          {(() => {
            let statusText = t.connected;
            let statusColor = 'text-emerald-400 font-semibold';
            let modeLabel = t.paperMode;
            let modeBg = 'bg-blue-500/10 border-blue-500/30 text-blue-400';

            if (circuitBreakerTriggered) {
              statusText = 'CIRCUIT BREAKER';
              statusColor = 'text-rose-500 font-bold animate-pulse';
            }

            if (binanceMode === 'live') {
              const hasKeys = Boolean(apiKey && apiSecret && apiKey.trim().length > 5 && apiSecret.trim().length > 5);
              modeLabel = t.liveMode;
              modeBg = 'bg-rose-500/10 border-rose-500/30 text-rose-400';
              if (!circuitBreakerTriggered) {
                if (hasKeys) {
                  statusText = t.connected;
                  statusColor = 'text-emerald-400 font-bold';
                } else {
                  statusText = 'MISSING API KEYS';
                  statusColor = 'text-amber-400 font-bold';
                }
              }
            } else if (binanceMode === 'testnet') {
              const hasTestKeys = Boolean(testnetApiKey && testnetApiSecret && testnetApiKey.trim().length > 5 && testnetApiSecret.trim().length > 5);
              modeLabel = t.testnetMode;
              modeBg = 'bg-amber-500/10 border-amber-500/30 text-amber-400';
              if (!circuitBreakerTriggered) {
                if (hasTestKeys) {
                  statusText = t.connected;
                  statusColor = 'text-emerald-400 font-semibold';
                } else {
                  statusText = 'NO TEST KEYS';
                  statusColor = 'text-amber-400';
                }
              }
            }

            return (
              <div className="bg-zinc-900/60 rounded p-2.5 border border-white/5 space-y-1.5 font-mono">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-zinc-500 uppercase font-medium">Engine Mode</span>
                  <span className={cn(statusColor)}>{statusText}</span>
                </div>
                <div className="flex items-center justify-between gap-1 pt-0.5">
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-medium", modeBg)}>
                    {modeLabel}
                  </span>
                  <div className="flex items-center gap-1 text-[10px] text-zinc-400 shrink-0">
                    <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", binanceMode === 'live' ? "bg-rose-500 animate-pulse" : binanceMode === 'testnet' ? "bg-amber-400" : "bg-emerald-400")}></span>
                    <span className="uppercase">{binanceMode}</span>
                  </div>
                </div>

                <div className="pt-1.5 border-t border-white/5 flex items-center justify-between text-[10px]">
                  <span className="text-amber-400/90 font-medium">Vault:</span>
                  <span className="text-amber-300 font-bold">
                    ${accumulationBalance.toFixed(2)} USDT <span className="text-[9px] text-zinc-500">(#{sessionCycleCount})</span>
                  </span>
                </div>
              </div>
            );
          })()}
        </div>
      </aside>
    </>
  );
}

