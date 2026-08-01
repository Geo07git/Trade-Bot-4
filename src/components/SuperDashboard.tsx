import React, { useState } from 'react';
import { useTradingStore } from '../store';
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

export function SuperDashboard({ onSwitchToFullDashboard }: SuperDashboardProps) {
  const {
    balance,
    positions,
    initialBalance,
    logs,
    autoTradingActive,
    setAutoTradingActive,
    circuitBreakerTriggered,
    circuitBreakerReason,
    resetCircuitBreaker,
    binanceMode,
    syncBinanceBalance,
    executeTrade
  } = useTradingStore();

  const [isSyncing, setIsSyncing] = useState(false);
  const [sellingSymbol, setSellingSymbol] = useState<string | null>(null);

  // Calculations
  const positionsValue = positions.reduce((acc, pos) => acc + (pos.amount * (pos.currentPrice || pos.entryPrice)), 0);
  const equity = balance + positionsValue;
  const totalPnL = equity - initialBalance;
  const totalPnLPercent = initialBalance > 0 ? (totalPnL / initialBalance) * 100 : 0;
  
  const unrealizedPnL = positions.reduce((acc, pos) => {
    const cp = pos.currentPrice || pos.entryPrice;
    return acc + ((cp - pos.entryPrice) * pos.amount);
  }, 0);

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

      {/* Core Mobile KPI Grid (4 Cards) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
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
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <h3 className="font-medium text-sm sm:text-base text-white">
              Poziții Active în Piață ({positions.length})
            </h3>
          </div>
          <span className="text-xs text-zinc-400 font-mono">
            Total Valoare: ${positionsValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
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

              return (
                <div 
                  key={pos.symbol}
                  className="bg-black/60 border border-white/10 hover:border-white/20 rounded-xl p-3.5 space-y-2.5 transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-white font-mono">{pos.symbol}</span>
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        BUY
                      </span>
                    </div>

                    <button
                      onClick={() => handleClosePosition(pos.symbol, pos.amount, currentPrice)}
                      disabled={isSelling}
                      className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 active:bg-rose-500/30 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-medium transition-all cursor-pointer"
                    >
                      {isSelling ? 'Vânzare...' : 'Vinde Tot'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-white/5 font-mono">
                    <div>
                      <span className="text-[10px] text-zinc-500 uppercase block">Cantitate / Valoare</span>
                      <span className="text-zinc-200 font-medium">
                        {pos.amount.toFixed(4)} ({`$${posValue.toFixed(2)}`})
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-zinc-500 uppercase block">Entry / Curent</span>
                      <span className="text-zinc-300">
                        ${pos.entryPrice.toFixed(2)} ➔ ${currentPrice.toFixed(2)}
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
