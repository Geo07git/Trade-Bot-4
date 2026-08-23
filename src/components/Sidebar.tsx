import React from 'react';
import { ViewState } from '../types';
import { X, Power, RotateCcw } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useTradingStore } from '../store';

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

  const navItems: { id: ViewState; label: string }[] = [
    { id: 'superDashboard', label: '⚡ Super Dashboard' },
    { id: 'dashboard', label: 'Dashboard Complet' },
    { id: 'scalping', label: '⚡ Motor Scalping ML' },
    { id: 'journal', label: 'Trading Journal' },
    { id: 'logs', label: 'Trade Logs' },
    { id: 'settings', label: 'Settings' },
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
        "w-64 border-r border-white/5 bg-black backdrop-blur-3xl flex flex-col h-full z-50 transition-transform duration-300 ease-in-out shrink-0",
        "fixed inset-y-0 left-0 md:static md:translate-x-0",
        isOpenMobile ? "translate-x-0 shadow-2xl" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="p-5 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-3">
            <img 
              src="/logo.png" 
              alt="G&S-Trade-Bot Logo" 
              referrerPolicy="no-referrer"
              className="w-10 h-10 rounded-xl object-contain border border-emerald-500/30 shadow-md bg-zinc-950 p-0.5" 
            />
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-serif italic text-xl font-bold tracking-tight text-white leading-tight">G&amp;S-Trade-Bot</h1>
                <span className="px-1.5 py-0.2 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">v3.0</span>
              </div>
              <p className="text-[9px] uppercase tracking-[0.2em] text-emerald-400 font-mono mt-0.5">AI Grid &amp; Scalping 24/7</p>
            </div>
          </div>
          {onCloseMobile && (
            <button 
              onClick={onCloseMobile}
              className="p-2 text-zinc-400 hover:text-white md:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <nav className="flex-1 px-4 space-y-1 py-4 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                onViewChange(item.id);
                if (onCloseMobile) onCloseMobile();
              }}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded text-sm transition-colors text-left",
                currentView === item.id 
                  ? "bg-white/10 text-white font-medium" 
                  : "text-zinc-400 hover:text-white"
              )}
            >
              {currentView === item.id ? (
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></div>
              ) : (
                 <div className="w-1.5 h-1.5 shrink-0 opacity-0"></div>
              )}
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-6 border-t border-white/5 space-y-3">
          {/* Hard Refresh Button */}
          <button
            onClick={() => {
              localStorage.removeItem('trading_store');
              window.location.reload();
            }}
            className="w-full flex items-center justify-center gap-2 p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-semibold transition-all cursor-pointer"
            title="Şterge starea locală (trading_store) şi reîncarcă aplicaţia"
          >
            <RotateCcw className="w-4 h-4 text-amber-400" />
            <span>Hard Refresh State</span>
          </button>

          {/* Server 24/7 Control Button in Sidebar */}
          <button
            onClick={() => setAutoTradingActive(!autoTradingActive)}
            className={cn(
              "w-full flex items-center justify-between p-3 rounded-lg border text-xs font-semibold transition-all cursor-pointer",
              autoTradingActive
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                : "bg-rose-500/10 border-rose-500/30 text-rose-400 hover:bg-rose-500/20"
            )}
          >
            <div className="flex items-center gap-2">
              <span className={cn("w-2 h-2 rounded-full", autoTradingActive ? "bg-emerald-400 animate-pulse" : "bg-rose-500")}></span>
              <span>{autoTradingActive ? "Server 24/7: ACTIV" : "Server 24/7: OPRIT"}</span>
            </div>
            <Power className="w-4 h-4 opacity-75" />
          </button>

          {/* Real API Status & Binance Mode panel */}
          {(() => {
            let statusText = 'CONECTAT';
            let statusColor = 'text-emerald-400 font-semibold';
            let modeLabel = 'Paper Trading (Simulare)';
            let modeBg = 'bg-blue-500/10 border-blue-500/30 text-blue-400';

            if (circuitBreakerTriggered) {
              statusText = 'CIRCUIT BREAKER';
              statusColor = 'text-rose-500 font-bold animate-pulse';
            }

            if (binanceMode === 'live') {
              const hasKeys = Boolean(apiKey && apiSecret && apiKey.trim().length > 5 && apiSecret.trim().length > 5);
              modeLabel = 'Binance Real Live';
              modeBg = 'bg-rose-500/10 border-rose-500/30 text-rose-400';
              if (!circuitBreakerTriggered) {
                if (hasKeys) {
                  statusText = 'CONECTAT REAL';
                  statusColor = 'text-emerald-400 font-bold';
                } else {
                  statusText = 'LIPSĂ CHEI API';
                  statusColor = 'text-amber-400 font-bold';
                }
              }
            } else if (binanceMode === 'testnet') {
              const hasTestKeys = Boolean(testnetApiKey && testnetApiSecret && testnetApiKey.trim().length > 5 && testnetApiSecret.trim().length > 5);
              modeLabel = 'Binance Testnet';
              modeBg = 'bg-amber-500/10 border-amber-500/30 text-amber-400';
              if (!circuitBreakerTriggered) {
                if (hasTestKeys) {
                  statusText = 'TESTNET CONECTAT';
                  statusColor = 'text-emerald-400 font-semibold';
                } else {
                  statusText = 'FĂRĂ CHEI TEST';
                  statusColor = 'text-amber-400';
                }
              }
            } else {
              // Paper
              modeLabel = 'Paper Trading (Simulat)';
              modeBg = 'bg-blue-500/10 border-blue-500/30 text-blue-400';
              if (!circuitBreakerTriggered) {
                statusText = 'SIMULATOR ACTIV';
                statusColor = 'text-emerald-400';
              }
            }

            return (
              <div className="bg-zinc-800/40 rounded-lg p-3 border border-white/5 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] uppercase tracking-widest text-zinc-500 font-medium">API Status</span>
                  <span className={cn("text-[10px] font-mono", statusColor)}>{statusText}</span>
                </div>
                <div className="flex items-center justify-between gap-1 pt-0.5">
                  <span className={cn("text-[11px] px-2 py-0.5 rounded border font-medium", modeBg)}>
                    {modeLabel}
                  </span>
                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-mono shrink-0">
                    <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", binanceMode === 'live' ? "bg-rose-500 animate-pulse" : binanceMode === 'testnet' ? "bg-amber-400" : "bg-emerald-400")}></span>
                    <span className="uppercase">{binanceMode}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-amber-400/90 font-medium flex items-center gap-1">
                    <span>🏦 Acumulare:</span>
                  </span>
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

