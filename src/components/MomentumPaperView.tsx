import React, { useState, useEffect } from 'react';
import { Play, Square, RefreshCw, Activity, DollarSign, TrendingUp, TrendingDown, Clock, ShieldCheck, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { apiFetch, safeJson } from '../utils/apiHelper';
import { useTradingStore } from '../store';

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
  exitReason?: string;
  realizedPnL?: number;
  realizedPnLPct?: number;
  maxFavorableExcursion: number;
  maxAdverseExcursion: number;
  trailingActive?: boolean;
  trailingStopPrice?: number;
  scoreAtEntry?: number;
  currentPrice?: number;
  currentPnLPct?: number;
  scoreBreakdown?: {
    momentum_15m: number;
    momentum_1h: number;
    momentum_4h: number;
    rvol: number;
    volumeAcceleration: number;
    breakoutStrength: number;
    atrExpansion: number;
    pullbackQuality: number;
  };
}

interface PaperState {
  active: boolean;
  paperBalanceUSDT: number;
  startingBalanceUSDT: number;
  intervalMinutes?: number;
  positions: PaperPosition[];
  history: PaperPosition[];
  lastRunTimestamp: number;
  logs: { timestamp: number; message: string }[];
}

export function MomentumPaperView() {
  const { language } = useTradingStore();
  const [state, setState] = useState<PaperState | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [minScore, setMinScore] = useState<number>(50);
  const [selectedPositionBreakdown, setSelectedPositionBreakdown] = useState<PaperPosition | null>(null);

  const fetchState = async () => {
    try {
      const res = await apiFetch('/api/momentum/paper/status');
      const data = await safeJson(res, null);
      if (data && data.success) {
        setState(data.state);
        if (data.state.minMomentumScore !== undefined) {
          setMinScore(data.state.minMomentumScore);
        }
        setError(null);
      } else if (data && data.error) {
        setError(data.error || 'Failed to fetch paper state');
      }
    } catch (err: any) {
      setError(err?.message || 'Network error');
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

  const handleUpdateConfig = async (newScore: number) => {
    setMinScore(newScore);
    try {
      const res = await apiFetch('/api/momentum/paper/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minMomentumScore: newScore })
      });
      const data = await safeJson(res, null);
      if (data && data.success) {
        setState(data.state);
      }
    } catch (err: any) {
      setError(err?.message || 'Error updating config');
    }
  };

  const handleStart = async () => {
    setActionLoading('start');
    try {
      const res = await apiFetch('/api/momentum/paper/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ intervalMinutes: 15, minMomentumScore: minScore })
      });
      const data = await safeJson(res, null);
      if (data && data.success) {
        setState(data.state);
      }
    } catch (err: any) {
      setError(err?.message || 'Error starting paper bot');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStop = async () => {
    setActionLoading('stop');
    try {
      const res = await apiFetch('/api/momentum/paper/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await safeJson(res, null);
      if (data && data.success) {
        setState(data.state);
      }
    } catch (err: any) {
      setError(err?.message || 'Error stopping paper bot');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRunCycle = async () => {
    setActionLoading('cycle');
    try {
      const res = await apiFetch('/api/momentum/paper/run-cycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await safeJson(res, null);
      if (data && data.success) {
        setState(data.state);
      }
    } catch (err: any) {
      setError(err?.message || 'Error executing cycle');
    } finally {
      setActionLoading(null);
    }
  };

  if (!state) {
    return (
      <div className="flex-1 flex items-center justify-center bg-black text-zinc-400">
        <div className="flex items-center gap-2">
          <RefreshCw className="w-5 h-5 animate-spin text-emerald-500" />
          <span>{language === 'ro' ? 'Se încarcă motorul Paper Trading...' : 'Loading Paper Trading Engine...'}</span>
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
                {language === 'ro' 
                  ? (state.active ? "● MOTOR ACTIV (24/7)" : "○ MOTOR OPRIT")
                  : (state.active ? "● ACTIVE ENGINE (24/7)" : "○ ENGINE STOPPED")}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              {language === 'ro'
                ? 'Simulare automată pe date live Binance (Interval 15m) cu scor minim momentum ≥ 50. Fără risc real.'
                : 'Automated simulation on live Binance data (15m interval) with min momentum score ≥ 50. Zero real risk.'}
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
              <span>{language === 'ro' ? 'Oprește Paper Trading' : 'Stop Paper Trading'}</span>
            </button>
          ) : (
            <button
              onClick={handleStart}
              disabled={actionLoading === 'start'}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-xl text-xs flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>{language === 'ro' ? 'Pornește Paper Trading' : 'Start Paper Trading'}</span>
            </button>
          )}

          <button
            onClick={handleRunCycle}
            disabled={actionLoading === 'cycle'}
            className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-white/10 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
          >
            <RefreshCw className={cn("w-4 h-4 text-emerald-400", actionLoading === 'cycle' && "animate-spin")} />
            <span>{language === 'ro' ? 'Rulează Ciclu Acum' : 'Run Cycle Now'}</span>
          </button>

          <a
            href="/api/momentum/paper/download-snapshots"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all"
          >
            <span>{language === 'ro' ? 'Descarcă Snapshots Orare (JSON)' : 'Download Hourly Snapshots (JSON)'}</span>
          </a>

          <a
            href="/api/momentum/paper/download-state"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all"
          >
            <span>{language === 'ro' ? 'Descarcă State (JSON)' : 'Download State (JSON)'}</span>
          </a>
        </div>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Configuration / Slider Card */}
      <div className="bg-zinc-950 border border-white/10 rounded-2xl p-4 md:p-5 flex flex-col md:flex-row items-center justify-between gap-4 shadow-xl">
        <div className="space-y-1 w-full md:w-auto">
          <div className="text-sm font-semibold text-white flex items-center gap-2">
            <span>{language === 'ro' ? 'Prag Scor Minim Intrare (Momentum Score)' : 'Min Entry Momentum Score Threshold'}</span>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono text-xs font-bold border border-emerald-500/40">
              {minScore} / 100
            </span>
          </div>
          <p className="text-xs text-zinc-400">
            {language === 'ro'
              ? 'Stabilește scorul minim de la care botul deschide poziții paper. Anterior hardcodat la 50.'
              : 'Sets the minimum score for paper position entry. Previously hardcoded at 50.'}
          </p>
        </div>

        <div className="flex items-center gap-4 w-full md:w-80">
          <input
            type="range"
            min="20"
            max="90"
            step="1"
            value={minScore}
            onChange={(e) => handleUpdateConfig(Number(e.target.value))}
            className="w-full h-2 bg-zinc-900 rounded-lg appearance-none cursor-pointer accent-emerald-500 border border-white/10"
          />
          <span className="font-mono font-bold text-sm text-emerald-400 w-10 text-right">{minScore}</span>
        </div>
      </div>

      {/* Frequency & Info Banner */}
      <div className="bg-zinc-950/80 border border-emerald-500/20 rounded-2xl p-4 flex items-center justify-between text-xs">
        <div className="flex items-center gap-3 text-zinc-300">
          <Clock className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <span className="font-semibold text-white">{language === 'ro' ? 'Frecvență Actualizare Preț & MFE:' : 'Price & MFE Update Frequency:'}</span>{' '}
            {language === 'ro'
              ? 'Prețurile și MFE-ul pozițiilor active sunt actualizate automat la fiecare ciclu de scanare (setat la 15 minute). Poți forța actualizarea instantanee apăsând butonul'
              : 'Active position prices and MFE are updated automatically every scan cycle (set to 15m). You can force instant update by clicking'}{' '}
            <span className="text-emerald-400 font-bold">{language === 'ro' ? '„Rulează Ciclu Acum”' : '"Run Cycle Now"'}</span>.
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-zinc-950 border border-white/10 rounded-2xl p-4">
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{language === 'ro' ? 'Sold Total Paper' : 'Total Paper Balance'}</span>
          <div className="text-2xl font-bold font-mono text-white mt-1">
            ${state.paperBalanceUSDT.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-zinc-500">{language === 'ro' ? 'Capital Inițial:' : 'Initial Capital:'} ${state.startingBalanceUSDT.toLocaleString()}</span>
        </div>

        <div className="bg-zinc-950 border border-white/10 rounded-2xl p-4">
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{language === 'ro' ? 'Net PnL Simulat' : 'Simulated Net PnL'}</span>
          <div className={cn("text-2xl font-bold font-mono mt-1", totalPnL >= 0 ? "text-emerald-400" : "text-rose-400")}>
            {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)} ({totalPnLPct >= 0 ? '+' : ''}{totalPnLPct.toFixed(2)}%)
          </div>
          <span className="text-[11px] text-zinc-500">{language === 'ro' ? 'Comisioane & Slippage incluse' : 'Fees & Slippage included'}</span>
        </div>

        <div className="bg-zinc-950 border border-white/10 rounded-2xl p-4">
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{language === 'ro' ? 'Win Rate (Închise)' : 'Win Rate (Closed)'}</span>
          <div className="text-2xl font-bold font-mono text-white mt-1">
            {winRate.toFixed(1)}%
          </div>
          <span className="text-[11px] text-zinc-500">{winningTrades.length} {language === 'ro' ? 'win' : 'wins'} / {closedTrades.length} {language === 'ro' ? 'total' : 'total'}</span>
        </div>

        <div className="bg-zinc-950 border border-white/10 rounded-2xl p-4">
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{language === 'ro' ? 'Poziții Active' : 'Active Positions'}</span>
          <div className="text-2xl font-bold font-mono text-emerald-400 mt-1">
            {state.positions.length}
          </div>
          <span className="text-[11px] text-zinc-500">{language === 'ro' ? 'Actualizate la fiecare 15m' : 'Updated every 15m'}</span>
        </div>
      </div>

      {/* Active Positions Table */}
      <div className="bg-zinc-950 border border-white/10 rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            {language === 'ro' ? `Poziții Paper Active (${state.positions.length})` : `Active Paper Positions (${state.positions.length})`}
          </h2>
          <span className="text-xs text-zinc-400 font-mono">{language === 'ro' ? 'Holding max 24h' : 'Max holding 24h'}</span>
        </div>

        {state.positions.length === 0 ? (
          <div className="text-center py-8 text-zinc-500 text-xs italic">
            {language === 'ro'
              ? 'Nicio poziție paper deschisă momentan. Motorul scanează piețele la fiecare 15 minute...'
              : 'No open paper positions at the moment. Engine scans markets every 15 minutes...'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="border-b border-white/10 text-zinc-400">
                  <th className="py-2.5 px-3">{language === 'ro' ? 'Simbol' : 'Symbol'}</th>
                  <th className="py-2.5 px-3">{language === 'ro' ? 'Preț Intrare' : 'Entry Price'}</th>
                  <th className="py-2.5 px-3">{language === 'ro' ? 'Preț Curent (PnL)' : 'Current Price (PnL)'}</th>
                  <th className="py-2.5 px-3">{language === 'ro' ? 'Valoare (USDT)' : 'Value (USDT)'}</th>
                  <th className="py-2.5 px-3">{language === 'ro' ? 'MFE Max' : 'Max MFE'}</th>
                  <th className="py-2.5 px-3">{language === 'ro' ? 'MAE Min' : 'Min MAE'}</th>
                  <th className="py-2.5 px-3">{language === 'ro' ? 'Scor Intrare' : 'Entry Score'}</th>
                  <th className="py-2.5 px-3">{language === 'ro' ? 'Timp Scurs' : 'Elapsed Time'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {state.positions.map((pos) => {
                  const hoursElapsed = ((Date.now() - pos.entryTimestamp) / (1000 * 60 * 60)).toFixed(1);
                  return (
                    <tr key={pos.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-3 font-bold text-white flex items-center gap-2">
                        <span>{pos.symbol}</span>
                      </td>
                      <td className="py-3 px-3">${pos.entryPrice.toFixed(4)}</td>
                      <td className="py-3 px-3 font-mono">
                        {pos.currentPrice ? (
                          <div className="flex flex-col">
                            <span>${pos.currentPrice.toFixed(4)}</span>
                            <span className={pos.currentPnLPct && pos.currentPnLPct >= 0 ? 'text-emerald-400 text-[11px]' : 'text-rose-400 text-[11px]'}>
                              {pos.currentPnLPct && pos.currentPnLPct > 0 ? '+' : ''}{pos.currentPnLPct?.toFixed(2)}%
                            </span>
                          </div>
                        ) : '...'}
                      </td>
                      <td className="py-3 px-3">${pos.sizeUSDT.toFixed(2)}</td>
                      <td className="py-3 px-3 text-emerald-400">+{pos.maxFavorableExcursion.toFixed(2)}%</td>
                      <td className="py-3 px-3 text-rose-400">{pos.maxAdverseExcursion.toFixed(2)}%</td>
                      <td className="py-3 px-3">
                        <button
                          onClick={() => setSelectedPositionBreakdown(pos)}
                          className="px-2 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 flex items-center gap-1.5 transition-all cursor-pointer"
                          title={language === 'ro' ? 'Vezi componentele scorului la achiziție' : 'View score components at entry'}
                        >
                          <Activity className="w-3.5 h-3.5" />
                          <span>{pos.scoreAtEntry !== undefined ? pos.scoreAtEntry.toFixed(1) : 'N/A'}</span>
                        </button>
                      </td>
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
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            {language === 'ro' ? `Istoric Trade-uri Închise (${closedTrades.length})` : `Closed Trades History (${closedTrades.length})`}
          </h2>
          {closedTrades.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 text-xs italic">
              {language === 'ro' ? 'Niciun trade închis în acest ciclu.' : 'No closed trades in this cycle.'}
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
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-semibold", isWin ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-rose-500/20 text-rose-300 border border-rose-500/30")}>
                          {isWin ? "WIN" : "LOSS"}
                        </span>
                        {t.exitReason && (
                          <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded font-bold font-mono border",
                            t.exitReason === 'TRAILING' ? "bg-amber-500/20 text-amber-300 border-amber-500/40" :
                            t.exitReason === 'SL' ? "bg-rose-500/20 text-rose-300 border-rose-500/40" :
                            "bg-blue-500/20 text-blue-300 border-blue-500/40"
                          )}>
                            {t.exitReason === 'TRAILING' ? '🎯 TRAILING' : t.exitReason === 'SL' ? '🛑 SL 1%' : '⏳ 24H'}
                          </span>
                        )}
                        {t.scoreAtEntry !== undefined && (
                          <button
                            onClick={() => setSelectedPositionBreakdown(t)}
                            className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] flex items-center gap-1 border border-white/10 cursor-pointer"
                          >
                            <Activity className="w-3 h-3 text-emerald-400" />
                            <span>{language === 'ro' ? 'Scor' : 'Score'}: {t.scoreAtEntry.toFixed(1)}</span>
                          </button>
                        )}
                      </div>
                      <div className="text-[10px] text-zinc-400 mt-1">
                        {language === 'ro' ? 'Intrare:' : 'Entry:'} ${t.entryPrice.toFixed(4)} → {language === 'ro' ? 'Ieșire:' : 'Exit:'} ${t.exitPrice?.toFixed(4)}
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
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">
            {language === 'ro' ? 'Jurnal Activitate Paper Engine' : 'Paper Engine Activity Log'}
          </h2>
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

      {/* Score Breakdown Modal */}
      {selectedPositionBreakdown && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-white/15 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-400" />
                  <span>{language === 'ro' ? `Descompunere Scor: ${selectedPositionBreakdown.symbol}` : `Score Breakdown: ${selectedPositionBreakdown.symbol}`}</span>
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  {language === 'ro' ? 'Valorile indicatorilor la momentul achiziției (Scor Total:' : 'Indicator values at acquisition (Total Score:'}{' '}
                  <span className="text-emerald-400 font-bold">{selectedPositionBreakdown.scoreAtEntry?.toFixed(1) || 'N/A'}</span>)
                </p>
              </div>
              <button
                onClick={() => setSelectedPositionBreakdown(null)}
                className="w-8 h-8 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center font-bold text-sm border border-white/10 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {selectedPositionBreakdown.scoreBreakdown ? (
              <div className="space-y-3 font-mono text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-zinc-900/60 p-3 rounded-xl border border-white/5">
                    <span className="text-zinc-400 block text-[11px]">{language === 'ro' ? 'Momentum 15m (RoC)' : '15m Momentum (RoC)'}</span>
                    <span className="text-white font-bold text-sm mt-0.5 block">{selectedPositionBreakdown.scoreBreakdown.momentum_15m.toFixed(2)}%</span>
                  </div>
                  <div className="bg-zinc-900/60 p-3 rounded-xl border border-white/5">
                    <span className="text-zinc-400 block text-[11px]">{language === 'ro' ? 'Momentum 1h (RoC)' : '1h Momentum (RoC)'}</span>
                    <span className="text-white font-bold text-sm mt-0.5 block">{selectedPositionBreakdown.scoreBreakdown.momentum_1h.toFixed(2)}%</span>
                  </div>
                  <div className="bg-zinc-900/60 p-3 rounded-xl border border-white/5">
                    <span className="text-zinc-400 block text-[11px]">{language === 'ro' ? 'Momentum 4h (RoC)' : '4h Momentum (RoC)'}</span>
                    <span className="text-white font-bold text-sm mt-0.5 block">{selectedPositionBreakdown.scoreBreakdown.momentum_4h.toFixed(2)}%</span>
                  </div>
                  <div className="bg-zinc-900/60 p-3 rounded-xl border border-white/5">
                    <span className="text-zinc-400 block text-[11px]">{language === 'ro' ? 'RVOL 1h (Volum Relativ)' : '1h RVOL (Relative Volume)'}</span>
                    <span className="text-white font-bold text-sm mt-0.5 block">{selectedPositionBreakdown.scoreBreakdown.rvol.toFixed(2)}x</span>
                  </div>
                  <div className="bg-zinc-900/60 p-3 rounded-xl border border-white/5">
                    <span className="text-zinc-400 block text-[11px]">{language === 'ro' ? 'Accelerație Volum' : 'Volume Acceleration'}</span>
                    <span className="text-white font-bold text-sm mt-0.5 block">{selectedPositionBreakdown.scoreBreakdown.volumeAcceleration.toFixed(3)}</span>
                  </div>
                  <div className="bg-zinc-900/60 p-3 rounded-xl border border-white/5">
                    <span className="text-zinc-400 block text-[11px]">{language === 'ro' ? 'Putere Breakout' : 'Breakout Strength'}</span>
                    <span className="text-white font-bold text-sm mt-0.5 block">{selectedPositionBreakdown.scoreBreakdown.breakoutStrength.toFixed(2)}</span>
                  </div>
                  <div className="bg-zinc-900/60 p-3 rounded-xl border border-white/5">
                    <span className="text-zinc-400 block text-[11px]">{language === 'ro' ? 'Expansiune ATR (15m)' : '15m ATR Expansion'}</span>
                    <span className="text-white font-bold text-sm mt-0.5 block">{selectedPositionBreakdown.scoreBreakdown.atrExpansion.toFixed(2)}x</span>
                  </div>
                  <div className="bg-zinc-900/60 p-3 rounded-xl border border-white/5">
                    <span className="text-zinc-400 block text-[11px]">{language === 'ro' ? 'Calitate Pullback' : 'Pullback Quality'}</span>
                    <span className="text-white font-bold text-sm mt-0.5 block">{selectedPositionBreakdown.scoreBreakdown.pullbackQuality.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-zinc-500 italic text-xs">
                {language === 'ro' ? 'Nu există detalii salvate pentru acest trade vechi.' : 'No saved details for this legacy trade.'}
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedPositionBreakdown(null)}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-white/10 rounded-xl text-xs font-semibold cursor-pointer"
              >
                {language === 'ro' ? 'Închide' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

