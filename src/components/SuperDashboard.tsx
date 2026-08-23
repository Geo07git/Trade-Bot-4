import React, { useState } from 'react';
import { useTradingStore } from '../store';
import { PositionTimer } from './PositionTimer';
import { 
  Wallet, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownRight, 
  Zap, 
  RefreshCw, 
  Power, 
  Activity, 
  CheckCircle2, 
  AlertTriangle,
  Layers,
  Clock,
  ArrowRight
} from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

interface SuperDashboardProps {
  onSwitchToFullDashboard?: () => void;
}

function MiniCandlePatternChart({ patternName, strategy }: { patternName?: string; strategy?: 'grid' | 'scalping' | 'manual' }) {
  const nameLower = (patternName || '').toLowerCase();
  const isGrid = strategy === 'grid' || nameLower.includes('grid');

  let cleanName = 'Bullish Engulfing';
  let patternType: 'engulfing' | 'hammer' | 'soldiers' | 'inside' | 'marubozu' | 'piercing' | 'grid' = 'engulfing';

  if (isGrid) {
    cleanName = 'Grid Rebound';
    patternType = 'grid';
  } else if (nameLower.includes('hammer') || nameLower.includes('pinbar')) {
    cleanName = 'Hammer Pinbar';
    patternType = 'hammer';
  } else if (nameLower.includes('soldier') || nameLower.includes('3 white')) {
    cleanName = '3 Soldiers';
    patternType = 'soldiers';
  } else if (nameLower.includes('inside') || nameLower.includes('harami')) {
    cleanName = 'Inside Breakout';
    patternType = 'inside';
  } else if (nameLower.includes('marubozu') || nameLower.includes('expansion')) {
    cleanName = 'Marubozu Bar';
    patternType = 'marubozu';
  } else if (nameLower.includes('piercing')) {
    cleanName = 'Piercing Line';
    patternType = 'piercing';
  } else if (patternName) {
    cleanName = patternName.replace(/[^\w\s]/gi, '').trim().slice(0, 15) || 'Bullish Pattern';
  }

  return (
    <div className="flex flex-col items-center justify-center gap-0.5" title={`Pattern intrare: ${patternName || cleanName}`}>
      <svg className="w-11 h-5 shrink-0" viewBox="0 0 50 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        {patternType === 'engulfing' && (
          <>
            <line x1="13" y1="5" x2="13" y2="19" stroke="#f43f5e" strokeWidth="1" strokeLinecap="round" />
            <rect x="10.5" y="8" width="5" height="7" rx="0.5" fill="#f43f5e" />
            <line x1="33" y1="2" x2="33" y2="22" stroke="#10b981" strokeWidth="1" strokeLinecap="round" />
            <rect x="29.5" y="4" width="7" height="15" rx="0.5" fill="#10b981" />
          </>
        )}

        {patternType === 'hammer' && (
          <>
            <line x1="13" y1="6" x2="13" y2="18" stroke="#f43f5e" strokeWidth="1" />
            <rect x="10.5" y="8" width="5" height="6" rx="0.5" fill="#f43f5e" />
            <line x1="33" y1="2" x2="33" y2="22" stroke="#10b981" strokeWidth="1.2" />
            <rect x="29" y="3" width="8" height="5" rx="0.5" fill="#10b981" />
          </>
        )}

        {patternType === 'soldiers' && (
          <>
            <line x1="9" y1="12" x2="9" y2="22" stroke="#10b981" strokeWidth="1" />
            <rect x="7" y="14" width="4" height="6" rx="0.5" fill="#10b981" />
            <line x1="25" y1="7" x2="25" y2="17" stroke="#10b981" strokeWidth="1" />
            <rect x="23" y="9" width="4" height="6" rx="0.5" fill="#10b981" />
            <line x1="41" y1="2" x2="41" y2="12" stroke="#10b981" strokeWidth="1" />
            <rect x="39" y="4" width="4" height="6" rx="0.5" fill="#10b981" />
          </>
        )}

        {patternType === 'inside' && (
          <>
            <line x1="9" y1="3" x2="9" y2="21" stroke="#f43f5e" strokeWidth="1" />
            <rect x="6.5" y="6" width="5" height="12" rx="0.5" fill="#f43f5e" />
            <line x1="25" y1="9" x2="25" y2="17" stroke="#38bdf8" strokeWidth="1" />
            <rect x="23" y="11" width="4" height="4" rx="0.5" fill="#38bdf8" />
            <line x1="41" y1="1" x2="41" y2="21" stroke="#10b981" strokeWidth="1" />
            <rect x="38.5" y="2" width="5" height="15" rx="0.5" fill="#10b981" />
          </>
        )}

        {patternType === 'marubozu' && (
          <>
            <line x1="13" y1="10" x2="13" y2="20" stroke="#f43f5e" strokeWidth="1" />
            <rect x="10.5" y="12" width="5" height="6" rx="0.5" fill="#f43f5e" />
            <rect x="28" y="2" width="10" height="20" rx="0.5" fill="#10b981" />
          </>
        )}

        {patternType === 'piercing' && (
          <>
            <line x1="13" y1="4" x2="13" y2="20" stroke="#f43f5e" strokeWidth="1" />
            <rect x="10.5" y="6" width="5" height="12" rx="0.5" fill="#f43f5e" />
            <line x1="33" y1="2" x2="33" y2="22" stroke="#10b981" strokeWidth="1" />
            <rect x="30.5" y="5" width="5" height="14" rx="0.5" fill="#10b981" />
          </>
        )}

        {patternType === 'grid' && (
          <>
            <line x1="2" y1="21" x2="48" y2="21" stroke="#10b981" strokeWidth="1" strokeDasharray="2 2" opacity="0.5" />
            <line x1="13" y1="8" x2="13" y2="21" stroke="#f43f5e" strokeWidth="1" />
            <rect x="10.5" y="10" width="5" height="10" rx="0.5" fill="#f43f5e" />
            <line x1="33" y1="5" x2="33" y2="21" stroke="#10b981" strokeWidth="1" />
            <rect x="30.5" y="6" width="5" height="14" rx="0.5" fill="#10b981" />
          </>
        )}
      </svg>

      <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 truncate max-w-[80px] leading-tight text-center">
        {cleanName}
      </span>
    </div>
  );
}

export function SuperDashboard({ onSwitchToFullDashboard }: SuperDashboardProps) {
  const {
    balance,
    positions,
    marketOpportunities,
    maxHoldMinutes,
    scalpingConfig,
    initialBalance,
    accumulationBalance = 0,
    sessionCycleCount = 1,
    accumulationTargetPercent = 3.0,
    consolidateAccumulation,
    resetAccumulationVault,
    logs,
    autoTradingActive,
    setAutoTradingActive,
    circuitBreakerTriggered,
    circuitBreakerReason,
    resetCircuitBreaker,
    binanceMode,
    syncBinanceBalance,
    executeTrade,
    executionEngine
  } = useTradingStore();

  const [isSyncing, setIsSyncing] = useState(false);
  const [sellingSymbol, setSellingSymbol] = useState<string | null>(null);
  const [confirmResetAcc, setConfirmResetAcc] = useState(false);

  // Calculations
  const positionsMargin = positions.reduce((acc, pos) => {
    const lev = (pos as any).leverage || 1;
    return acc + ((pos as any).margin || ((pos.entryPrice * pos.amount) / lev));
  }, 0);
  const nominalPositionsValue = positions.reduce((acc, pos) => acc + (pos.amount * (pos.currentPrice || pos.entryPrice)), 0);
  const unrealizedPnL = positions.reduce((acc, pos) => {
    const cp = pos.currentPrice || pos.entryPrice;
    return acc + ((cp - pos.entryPrice) * pos.amount);
  }, 0);
  const equity = balance + positionsMargin + unrealizedPnL;
  const totalPnL = equity - initialBalance;
  const totalPnLPercent = initialBalance > 0 ? (totalPnL / initialBalance) * 100 : 0;

  const handleSync = async () => {
    setIsSyncing(true);
    await syncBinanceBalance();
    setTimeout(() => setIsSyncing(false), 600);
  };

  const handleClosePosition = async (symbol: string, amount: number, price: number) => {
    setSellingSymbol(symbol);
    await executeTrade(symbol, 'SELL', price, amount);
    setTimeout(() => setSellingSymbol(null), 500);
  };

  // Get last 5 meaningful actions from logs
  const last5Actions = logs.slice(0, 5);

  return (
    <div className="h-full w-full bg-black text-zinc-100 overflow-y-auto p-3 sm:p-5 md:p-8 space-y-4 pb-28 font-sans">
      
      {/* Top Banner & Quick Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-zinc-900/80 border border-white/10 rounded-2xl p-3 sm:p-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 shrink-0">
            <Zap className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-serif italic text-lg sm:text-xl font-bold text-white tracking-tight">Super Dashboard</h2>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/10 text-zinc-300 border border-white/10 uppercase">
                {binanceMode.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-zinc-400">Vizualizare rapidă optimizată pentru telefon</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="flex items-center gap-1.5 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-600 border border-white/10 rounded-xl text-xs text-zinc-200 transition-all cursor-pointer"
            title="Sincronizează balanța cu Binance"
          >
            <RefreshCw className={cn("w-3.5 h-3.5 text-zinc-400", isSyncing && "animate-spin text-emerald-400")} />
            <span className="hidden sm:inline">Sync</span>
          </button>

          <button
            onClick={() => setAutoTradingActive(!autoTradingActive)}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer",
              autoTradingActive
                ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20"
                : "bg-rose-500/10 border-rose-500/40 text-rose-400 hover:bg-rose-500/20"
            )}
          >
            <Power className="w-3.5 h-3.5" />
            <span>{autoTradingActive ? "24/7 ACTIV" : "24/7 OPRIT"}</span>
          </button>

          <span className={cn(
            "flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-mono font-bold",
            (executionEngine || 'both') === 'both' ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-300" :
            "bg-amber-500/10 border-amber-500/30 text-amber-300"
          )}>
            <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span>
            <span>{(executionEngine || 'both') === 'both' ? 'Hibrid' : 'Scalping'}</span>
          </span>

          {onSwitchToFullDashboard && (
            <button
              onClick={onSwitchToFullDashboard}
              className="flex items-center gap-1 px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-medium border border-white/10 transition-all cursor-pointer"
            >
              <span>Full View</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Circuit Breaker Warning Alert */}
      {circuitBreakerTriggered && (
        <div className="bg-gradient-to-r from-rose-950/90 to-red-900/90 border border-rose-500/50 rounded-2xl p-4 text-white space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
              <span className="font-semibold text-sm">Circuit Breaker Activat</span>
            </div>
            <button
              onClick={() => resetCircuitBreaker()}
              className="px-3 py-1 bg-rose-500 hover:bg-rose-600 text-white font-medium text-xs rounded-lg transition-all"
            >
              Reset & Reluare
            </button>
          </div>
          <p className="text-xs text-rose-200/90">{circuitBreakerReason || 'Limita de siguranță a fost atinsă.'}</p>
        </div>
      )}

      {/* Core Mobile KPI Grid (5 Cards) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-4">
        {/* Capital Total (Equity) */}
        <div className="bg-zinc-900/90 border border-white/10 rounded-2xl p-3.5 sm:p-5 relative overflow-hidden">
          <div className="flex items-center justify-between text-zinc-400 mb-1">
            <span className="text-[11px] uppercase tracking-wider font-medium">Capital Total</span>
            <Wallet className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-white tracking-tight">
            ${equity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            Initial: ${initialBalance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </div>
        </div>

        {/* Sold Acumulare (Vault Profit Conservat) */}
        <div className="bg-gradient-to-b from-amber-950/40 to-zinc-900/90 border border-amber-500/30 rounded-2xl p-3.5 sm:p-5 relative overflow-hidden">
          <div className="flex items-center justify-between text-amber-300 mb-1">
            <span className="text-[11px] uppercase tracking-wider font-semibold flex items-center gap-1">
              <span>Sold "Acumulare"</span>
            </span>
            <div className="flex flex-col items-end gap-1">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-bold border border-amber-500/30">
                Ciclu #{sessionCycleCount}
              </span>
              {resetAccumulationVault && (
                confirmResetAcc ? (
                  <div className="flex items-center gap-1 mt-0.5">
                    <button
                      onClick={async () => {
                        await resetAccumulationVault();
                        setConfirmResetAcc(false);
                      }}
                      className="px-1.5 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-mono font-bold text-[10px] shadow transition-all cursor-pointer"
                    >
                      Confirmi $0?
                    </button>
                    <button
                      onClick={() => setConfirmResetAcc(false)}
                      className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono text-[10px] transition-all cursor-pointer"
                    >
                      Nu
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmResetAcc(true)}
                    className="px-1.5 py-0.5 rounded bg-amber-500/10 hover:bg-rose-500/20 text-amber-300 hover:text-rose-300 border border-amber-500/30 hover:border-rose-500/40 text-[10px] font-mono font-semibold transition-all cursor-pointer flex items-center gap-1"
                    title="Resetează Soldul Acumulare la $0.00"
                  >
                    <RefreshCw className="w-2.5 h-2.5" />
                    Reset
                  </button>
                )
              )}
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-amber-300 tracking-tight">
            ${accumulationBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-amber-400/80 mt-1 flex items-center justify-between font-mono">
            <span>Țintă: +{accumulationTargetPercent}%</span>
            {totalPnLPercent >= accumulationTargetPercent && (
              <button
                onClick={() => consolidateAccumulation && consolidateAccumulation()}
                className="px-1.5 py-0.5 rounded bg-emerald-500 text-black text-[10px] font-bold hover:bg-emerald-400 transition-all cursor-pointer"
                title="Consolidează profitul manual"
              >
                Salvează
              </button>
            )}
          </div>
        </div>

        {/* Profit / Pierdere Total (PnL) */}
        <div className="bg-zinc-900/90 border border-white/10 rounded-2xl p-3.5 sm:p-5 relative overflow-hidden">
          <div className="flex items-center justify-between text-zinc-400 mb-1">
            <span className="text-[11px] uppercase tracking-wider font-medium">Profit Total</span>
            {totalPnL >= 0 ? (
              <ArrowUpRight className="w-4 h-4 text-emerald-400" />
            ) : (
              <ArrowDownRight className="w-4 h-4 text-rose-400" />
            )}
          </div>
          <div className={cn(
            "text-xl sm:text-2xl font-bold font-mono tracking-tight",
            totalPnL >= 0 ? "text-emerald-400" : "text-rose-400"
          )}>
            {totalPnL >= 0 ? '+' : ''}${totalPnL.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className={cn(
            "text-[11px] font-mono font-medium mt-1 flex items-center gap-1",
            totalPnLPercent >= 0 ? "text-emerald-400" : "text-rose-400"
          )}>
            {totalPnLPercent >= 0 ? '▲' : '▼'} {totalPnLPercent.toFixed(2)}% PnL
          </div>
        </div>

        {/* Cash Liber (USDT Balance) */}
        <div className="bg-zinc-900/90 border border-white/10 rounded-2xl p-3.5 sm:p-5 relative overflow-hidden">
          <div className="flex items-center justify-between text-zinc-400 mb-1">
            <span className="text-[11px] uppercase tracking-wider font-medium">Cash Liber</span>
            <TrendingUp className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-xl sm:text-2xl font-bold font-mono text-white tracking-tight">
            ${balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            {equity > 0 ? ((balance / equity) * 100).toFixed(1) : 0}% din portofoliu
          </div>
        </div>

        {/* PnL Nerealizat (Pozitii deschise) */}
        <div className="bg-zinc-900/90 border border-white/10 rounded-2xl p-3.5 sm:p-5 relative overflow-hidden">
          <div className="flex items-center justify-between text-zinc-400 mb-1">
            <span className="text-[11px] uppercase tracking-wider font-medium">PnL Nerealizat</span>
            <Activity className="w-4 h-4 text-purple-400" />
          </div>
          <div className={cn(
            "text-xl sm:text-2xl font-bold font-mono tracking-tight",
            unrealizedPnL >= 0 ? "text-emerald-400" : "text-rose-400"
          )}>
            {unrealizedPnL >= 0 ? '+' : ''}${unrealizedPnL.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-zinc-500 mt-1">
            {positions.length} poziții deschise
          </div>
        </div>
      </div>

      {/* Active Positions List */}
      <div className="bg-zinc-900/80 border border-white/10 rounded-2xl p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 pb-3 gap-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <h3 className="font-medium text-sm sm:text-base text-white">
              Poziții Active în Piață ({positions.length})
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono px-2 py-0.5 rounded border bg-zinc-800 text-zinc-300 border-white/10">
              Motor: {(executionEngine || 'both') === 'both' ? 'Hibrid' : 'DOAR SCALPING ⚡'}
            </span>
            <span className="text-xs text-zinc-400 font-mono">
              Margină: <strong className="text-white">${positionsMargin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
              {nominalPositionsValue > positionsMargin && (
                <span className="text-amber-400/90 ml-1.5">(Expunere: ${nominalPositionsValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</span>
              )}
            </span>
          </div>
        </div>


        {positions.length === 0 ? (
          <div className="text-center py-8 text-zinc-500 space-y-2">
            <CheckCircle2 className="w-8 h-8 text-zinc-600 mx-auto" />
            <p className="text-xs">Nu există nicio poziție deschisă în acest moment.</p>
            <p className="text-[11px] text-zinc-600">Botul scanat activ piața pentru semnale de cumpărare ML.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {positions.map((pos) => {
              const currentPrice = pos.currentPrice || pos.entryPrice;
              const posValue = pos.amount * currentPrice;
              const posPnL = (currentPrice - pos.entryPrice) * pos.amount;
              const posPnLPercent = pos.entryPrice > 0 ? ((currentPrice - pos.entryPrice) / pos.entryPrice) * 100 : 0;
              const isSelling = sellingSymbol === pos.symbol;
              const isGridPos = false;
              const oppMatch = (marketOpportunities || []).find(o => o.symbol === pos.symbol);
              const posPatternName = pos.entryPatternName || oppMatch?.candlestickPatternName || 'Bullish Engulfing 🟢';

              return (
                <div 
                  key={pos.symbol}
                  className="bg-black/60 border border-white/10 hover:border-white/20 rounded-xl p-3.5 space-y-2.5 transition-all"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="font-bold text-sm text-white font-mono">{pos.symbol}</span>
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        BUY
                      </span>
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase bg-purple-500/10 text-purple-300 border-purple-500/30">
                        {`SCALPING ${pos.leverage && pos.leverage > 1 ? `${pos.leverage}x` : ''}`}
                      </span>
                    </div>

                    <PositionTimer 
                      pos={pos} 
                      maxHoldMinutes={maxHoldMinutes} 
                      maxNegativeHoldMinutes={scalpingConfig?.maxNegativeHoldMinutes ?? 1.0} 
                      enableMaxNegativeHold={scalpingConfig?.enableMaxNegativeHold ?? true}
                    />

                    <button
                      onClick={() => handleClosePosition(pos.symbol, pos.amount, currentPrice)}
                      disabled={isSelling}
                      className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 active:bg-rose-500/30 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-medium transition-all cursor-pointer shrink-0"
                    >
                      {isSelling ? 'Vânzare...' : 'Vinde Tot'}
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 items-center text-xs pt-1 border-t border-white/5 font-mono">
                    <div>
                      <span className="text-[9px] text-zinc-500 uppercase block tracking-wider">Cantitate / Valoare</span>
                      <span className="text-zinc-200 font-medium text-[11px]">
                        {pos.amount.toFixed(3)} ({`$${posValue.toFixed(2)}`})
                      </span>
                    </div>

                    <div className="flex flex-col items-center justify-center border-x border-white/5 px-1">
                      <span className="text-[9px] text-zinc-500 uppercase block tracking-wider mb-0.5 text-center">Pattern Intrare</span>
                      <MiniCandlePatternChart 
                        patternName={posPatternName} 
                        strategy={pos.strategy} 
                      />
                    </div>

                    <div className="text-right">
                      <span className="text-[9px] text-zinc-500 uppercase block tracking-wider">Entry / Curent</span>
                      <span className="text-zinc-300 text-[11px]">
                        ${pos.entryPrice.toFixed(3)} ➔ ${currentPrice.toFixed(3)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-white/5 font-mono text-xs">
                    <span className="text-zinc-400 text-[11px]">Profit/Pierdere:</span>
                    <span className={cn("font-bold flex items-center gap-1", posPnL >= 0 ? "text-emerald-400" : "text-rose-400")}>
                      {posPnL >= 0 ? '+' : ''}${posPnL.toFixed(2)} ({posPnLPercent >= 0 ? '+' : ''}{posPnLPercent.toFixed(2)}%)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Latest 5 Bot Actions Summarized */}
      <div className="bg-zinc-900/80 border border-white/10 rounded-2xl p-4 sm:p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400" />
            <h3 className="font-medium text-sm sm:text-base text-white">
              Ultimele 5 Acțiuni Bot (Sumarizat)
            </h3>
          </div>
          <span className="text-[11px] text-zinc-500">Live Server Activity</span>
        </div>

        {last5Actions.length === 0 ? (
          <div className="text-center py-6 text-zinc-500 text-xs">
            Nicio acțiune înregistrată încă.
          </div>
        ) : (
          <div className="space-y-2 font-mono">
            {last5Actions.map((log, idx) => {
              const isBuy = log.message.includes('Cumpărat') || log.type === 'success';
              const isSell = log.message.includes('Vândut') || log.message.includes('SELL');
              const isWarning = log.type === 'warning' || log.message.includes('CIRCUIT BREAKER');

              return (
                <div 
                  key={idx}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 p-2.5 rounded-xl bg-black/50 border border-white/5 text-xs"
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <span className="text-[10px] text-zinc-500 shrink-0 font-sans">{log.time}</span>
                    
                    <span className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0",
                      isBuy ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" :
                      isSell ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
                      isWarning ? "bg-rose-500/20 text-rose-400 border border-rose-500/30" :
                      "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                    )}>
                      {isBuy ? 'BUY' : isSell ? 'SELL' : isWarning ? 'ALERT' : 'INFO'}
                    </span>

                    <span className="text-zinc-200 truncate">{log.message}</span>
                  </div>

                  {log.equity !== undefined && (
                    <span className="text-[11px] text-zinc-400 shrink-0 sm:text-right">
                      Equity: ${log.equity.toFixed(2)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
