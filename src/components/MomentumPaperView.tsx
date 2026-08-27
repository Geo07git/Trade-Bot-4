import React, { useState, useEffect } from 'react';
import { Play, Square, RefreshCw, Activity, DollarSign, TrendingUp, TrendingDown, Clock, ShieldCheck, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

interface PaperPosition {
  id: string;
  symbol: string;
  entryTimestamp: number;
  entryPrice: number;
  sizeUSDT: number;
  feePaid: number;
  status: 'OPEN' | 'CLOSED';
  exitTimestamp?: number;
  exitPrice?: number;
  realizedPnL?: number;
  realizedPnLPct?: number;
  maxFavorableExcursion: number;
  maxAdverseExcursion: number;
}

interface PaperState {
  active: boolean;
  paperBalanceUSDT: number;
  startingBalanceUSDT: number;
  positions: PaperPosition[];
  history: PaperPosition[];
  lastRunTimestamp: number;
  logs: { timestamp: number; message: string }[];
}

export function MomentumPaperView() {
  const [state, setState] = useState<PaperState | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchState = async () => {
    try {
      const res = await fetch('/api/momentum/paper/status');
      const data = await res.json();
      if (data.success) {
        setState(data.state);
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch paper state');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchState();
    const interval = setInterval(fetchState, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, []);

  const handleStart = async () => {
    setActionLoading('start');
    try {
      const res = await fetch('/api/momentum/paper/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intervalMinutes: 15 })
      });
      const data = await res.json();
      if (data.success) {
        setState(data.state);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStop = async () => {
    setActionLoading('stop');
    try {
      const res = await fetch('/api/momentum/paper/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.success) {
        setState(data.state);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRunCycle = async () => {
    setActionLoading('cycle');
    try {
      const res = await fetch('/api/momentum/paper/run-cycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.success) {
        setState(data.state);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  if (!state) {
    return (
      <div className="flex-1 flex items-center justify-center bg-black text-zinc-400">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin text-emerald-500" />
          <span>Se încarcă motorul Paper Trading...</span>
        </div>
      </div>
    );
  }

  const totalPnL = state.paperBalanceUSDT - state.startingBalanceUSDT;
  const totalPnLPct = (totalPnL / state.startingBalanceUSDT) * 100;
  const closedTrades = state.history || [];
  const winningTrades = closedTrades.filter(t => (t.realizedPnL || 0) > 0);
  const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0;

  return (
    <div className="flex-1 flex flex-col h-full bg-black text-zinc-100 overflow-y-auto p-4 md:p-6 space-y-6">
      {/* Top Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-950 border border-white/10 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-white">Momentum Paper Trading</h1>
              <span className={cn(
                "px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold border",
                state.active ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" : "bg-zinc-800 text-zinc-400 border-white/10"
              )}>
                {state.active ? "● MOTOR ACTIV (24/7)" : "○ MOTOR OPRIT"}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              Simulare automată pe date live Binance (Interval 15m) cu scor minim momentum ≥ 50. Fără risc real.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {state.active ? (
            <button
              onClick={handleStop}
              disabled={actionLoading === 'stop'}
              className="px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
            >
              <Square className="w-4 h-4 fill-current" />
              <span>Oprește Paper Trading</span>
            </button>
          ) : (
            <button
              onClick={handleStart}
              disabled={actionLoading === 'start'}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-xl text-xs flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Pornește Paper Trading</span>
            </button>
          )}

          <button
            onClick={handleRunCycle}
            disabled={actionLoading === 'cycle'}
            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-white/10 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
          >
            <RefreshCw className={cn("w-4 h-4 text-emerald-400", actionLoading === 'cycle' && "animate-spin")} />
            <span>Rulează Ciclu Acum</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-zinc-950 border border-white/10 rounded-2xl p-4">
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Sold Total Paper</span>
          <div className="text-2xl font-bold font-mono text-white mt-1">
            ${state.paperBalanceUSDT.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-zinc-500">Capital Inițial: ${state.startingBalanceUSDT.toLocaleString()}</span>
        </div>

        <div className="bg-zinc-950 border border-white/10 rounded-2xl p-4">
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Net PnL Simulat</span>
          <div className={cn("text-2xl font-bold font-mono mt-1", totalPnL >= 0 ? "text-emerald-400" : "text-rose-400")}>
            {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)} ({totalPnLPct >= 0 ? '+' : ''}{totalPnLPct.toFixed(2)}%)
          </div>
          <span className="text-[11px] text-zinc-500">Comisioane & Slippage incluse</span>
        </div>

        <div className="bg-zinc-950 border border-white/10 rounded-2xl p-4">
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Win Rate (Închise)</span>
          <div className="text-2xl font-bold font-mono text-white mt-1">
            {winRate.toFixed(1)}%
          </div>
          <span className="text-[11px] text-zinc-500">{winningTrades.length} win / {closedTrades.length} total</span>
        </div>

        <div className="bg-zinc-950 border border-white/10 rounded-2xl p-4">
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Poziții Active</span>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
            {state.positions.length}
          </div>
          <span className="text-[11px] text-zinc-500">Monitorizate live la 15m</span>
        </div>
      </div>

      {/* Active Positions Table */}
      <div className="bg-zinc-950 border border-white/10 rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            Poziții Paper Active ({state.positions.length})
          </h2>
          <span className="text-xs text-zinc-400 font-mono">Holding max 24h</span>
        </div>

        {state.positions.length === 0 ? (
          <div className="text-center py-8 text-zinc-500 text-xs italic">
            Nicio poziție paper deschisă momentan. Motorul scanează piețele la fiecare 15 minute...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="border-b border-white/10 text-zinc-400">
                  <th className="py-2.5 px-3">Simbol</th>
                  <th className="py-2.5 px-3">Preț Intrare</th>
                  <th className="py-2.5 px-3">Valoare (USDT)</th>
                  <th className="py-2.5 px-3">MFE Max</th>
                  <th className="py-2.5 px-3">MAE Min</th>
                  <th className="py-2.5 px-3">Timp Scurs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {state.positions.map((pos) => {
                  const hoursElapsed = ((Date.now() - pos.entryTimestamp) / (1000 * 60 * 60)).toFixed(1);
                  return (
                    <tr key={pos.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-3 font-bold text-white">{pos.symbol}</td>
                      <td className="py-3 px-3">${pos.entryPrice.toFixed(4)}</td>
                      <td className="py-3 px-3">${pos.sizeUSDT.toFixed(2)}</td>
                      <td className="py-3 px-3 text-emerald-400">+{pos.maxFavorableExcursion.toFixed(2)}%</td>
                      <td className="py-3 px-3 text-rose-400">{pos.maxAdverseExcursion.toFixed(2)}%</td>
                      <td className="py-3 px-3 text-zinc-400">{hoursElapsed}h / 24h</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Closed History & Logs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-6">
        {/* Closed History */}
        <div className="bg-zinc-950 border border-white/10 rounded-2xl p-5 space-y-4 shadow-xl">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Istoric Trade-uri Închise ({closedTrades.length})</h2>
          {closedTrades.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 text-xs italic">
              Niciun trade închis în acest ciclu.
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
              {closedTrades.slice(0, 20).map((t) => {
                const isWin = (t.realizedPnL || 0) > 0;
                return (
                  <div key={t.id} className="bg-zinc-900/50 border border-white/5 rounded-xl p-3 flex items-center justify-between text-xs font-mono">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{t.symbol}</span>
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-semibold", isWin ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300")}>
                          {isWin ? "WIN" : "LOSS"}
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-400 mt-1">
                        Intrare: ${t.entryPrice.toFixed(4)} → Ieșire: ${t.exitPrice?.toFixed(4)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={cn("font-bold", isWin ? "text-emerald-400" : "text-rose-400")}>
                        {isWin ? '+' : ''}${t.realizedPnL?.toFixed(2)} ({isWin ? '+' : ''}{t.realizedPnLPct?.toFixed(2)}%)
                      </div>
                      <div className="text-[10px] text-zinc-500 mt-1">
                        {new Date(t.exitTimestamp || Date.now()).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Paper Logs */}
        <div className="bg-zinc-950 border border-white/10 rounded-2xl p-5 space-y-4 shadow-xl">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Jurnal Activitate Paper Engine</h2>
          <div className="max-h-80 overflow-y-auto space-y-2 font-mono text-[11px] pr-1">
            {state.logs.map((log, idx) => (
              <div key={idx} className="bg-zinc-900/40 border border-white/5 rounded-lg p-2.5 flex items-start gap-2.5">
                <span className="text-zinc-500 shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                <span className="text-zinc-300 leading-tight">{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
