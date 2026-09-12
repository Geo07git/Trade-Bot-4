import React, { useState, useEffect, useMemo } from 'react';
import { 
  Play, 
  Square, 
  RefreshCw, 
  Activity, 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  ShieldCheck, 
  AlertCircle, 
  Sliders, 
  ShieldAlert, 
  Award,
  Zap,
  Percent,
  CheckCircle2
} from 'lucide-react';
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
  minMomentumScore: number;
  intervalMinutes: number;
  trailingActivationPct: number;
  trailingDistancePct: number;
  hardStopLossPct: number;
  maxHoldMinutes: number;
  takeProfitPct: number | null;
  positionAllocationPct: number;
  hardStopTriggered?: 'DRAWDOWN_50' | 'PROFIT_100' | null;
  totalFeesPaid?: number;
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
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Engine Parameters
  const [minScore, setMinScore] = useState<number>(50);
  const [trailingActivation, setTrailingActivation] = useState<number>(3.0);
  const [trailingDistance, setTrailingDistance] = useState<number>(0.5);
  const [hardSL, setHardSL] = useState<number>(5.0);
  const [maxHold, setMaxHold] = useState<number>(1440);
  const [isTPEnabled, setIsTPEnabled] = useState<boolean>(false);
  const [tpValue, setTpValue] = useState<number>(10.0);
  const [allocationPct, setAllocationPct] = useState<number>(10);

  const [selectedPositionBreakdown, setSelectedPositionBreakdown] = useState<PaperPosition | null>(null);

  const fetchState = async () => {
    try {
      const res = await apiFetch('/api/momentum/paper/status');
      const data = await safeJson(res, null);
      if (data && data.success && data.state) {
        setState(data.state);
        if (data.state.minMomentumScore !== undefined) {
          setMinScore(data.state.minMomentumScore);
        }
        if (data.state.trailingActivationPct !== undefined) {
          setTrailingActivation(data.state.trailingActivationPct);
        }
        if (data.state.trailingDistancePct !== undefined) {
          setTrailingDistance(data.state.trailingDistancePct);
        }
        if (data.state.hardStopLossPct !== undefined) {
          setHardSL(data.state.hardStopLossPct);
        }
        if (data.state.maxHoldMinutes !== undefined) {
          setMaxHold(data.state.maxHoldMinutes);
        }
        if (data.state.positionAllocationPct !== undefined) {
          setAllocationPct(data.state.positionAllocationPct);
        }
        if (data.state.takeProfitPct !== undefined) {
          if (data.state.takeProfitPct !== null && data.state.takeProfitPct > 0) {
            setIsTPEnabled(true);
            setTpValue(data.state.takeProfitPct);
          } else {
            setIsTPEnabled(false);
          }
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

  const handleSaveParams = async (override?: {
    score?: number;
    trailingAct?: number;
    trailingDist?: number;
    sl?: number;
    hold?: number;
    tpEnabled?: boolean;
    tpVal?: number;
    alloc?: number;
  }) => {
    const act = override?.trailingAct ?? trailingActivation;
    const dist = override?.trailingDist ?? trailingDistance;
    const slVal = override?.sl ?? hardSL;
    const holdVal = override?.hold ?? maxHold;
    const tpOn = override?.tpEnabled !== undefined ? override.tpEnabled : isTPEnabled;
    const tpNum = override?.tpVal ?? tpValue;
    const scoreVal = override?.score ?? minScore;
    const allocVal = override?.alloc ?? allocationPct;

    try {
      const payload = {
        minMomentumScore: scoreVal,
        trailingActivationPct: act,
        trailingDistancePct: dist,
        hardStopLossPct: slVal,
        maxHoldMinutes: holdVal,
        takeProfitPct: tpOn ? tpNum : null,
        positionAllocationPct: allocVal
      };

      const res = await apiFetch('/api/momentum/paper/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await safeJson(res, null);
      if (data && data.success) {
        setState(data.state);
        setSuccessMsg(language === 'ro' ? 'Parametrii motorului au fost actualizați!' : 'Engine parameters updated successfully!');
        setTimeout(() => setSuccessMsg(null), 3500);
      } else {
        setError(data?.error || 'Failed to update parameters');
      }
    } catch (err: any) {
      setError(err?.message || 'Error updating parameters');
    }
  };

  const handleReset = async () => {
    try {
      setActionLoading('reset');
      // Reset is now global for both Scalping & Momentum
      const res = await apiFetch('/api/bot/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ balance: 1000 }) // Default paper balance for Simulator
      });
      
      const data = await safeJson(res, null);
      if (data && data.success) {
        fetchState();
        setSuccessMsg(language === 'ro' ? 'Capitalul global și Simulatorul Momentum au fost resetate la $1,000.' : 'Global Capital and Momentum Simulator reset to $1,000.');
        setTimeout(() => setSuccessMsg(null), 4000);
      } else {
        setError(data?.error || 'Failed to reset simulator');
      }
    } catch (err: any) {
      setError(err?.message || 'Error resetting simulator');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStart = async () => {
    setActionLoading('start');
    try {
      const payload = {
        intervalMinutes: 15,
        minMomentumScore: minScore,
        trailingActivationPct: trailingActivation,
        trailingDistancePct: trailingDistance,
        hardStopLossPct: hardSL,
        maxHoldMinutes: maxHold,
        takeProfitPct: isTPEnabled ? tpValue : null,
        positionAllocationPct: allocationPct
      };

      const res = await apiFetch('/api/momentum/paper/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await safeJson(res, null);
      if (data && data.success) {
        setState(data.state);
      } else {
        setError(data?.error || 'Failed to start paper trader');
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

  const handleManualClose = async (symbol: string) => {
    setActionLoading(`close-${symbol}`);
    try {
      const res = await apiFetch('/api/momentum-paper/close-position', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol })
      });
      const data = await safeJson(res, null);
      if (data && data.success) {
        setState(data.state);
      } else {
        setError(data?.error || 'Failed to close position manually');
      }
    } catch (err: any) {
      setError(err?.message || 'Error closing position');
    } finally {
      setActionLoading(null);
    }
  };

  const closedTrades = useMemo(() => {
    const raw = state?.history || [];
    const seen = new Set<string>();
    return raw.filter((t, idx) => {
      const key = t?.id || `${t?.symbol}-${t?.entryTimestamp || idx}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [state?.history]);

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

  // Exact mark-to-market total equity
  const openPositionsValue = state.positions.reduce((sum, p) => {
    const curPrice = p.currentPrice || p.entryPrice;
    return sum + ((curPrice / p.entryPrice) * p.sizeUSDT);
  }, 0);
  const totalEquity = state.paperBalanceUSDT + openPositionsValue;
  const totalPnL = totalEquity - state.startingBalanceUSDT;
  const totalPnLPct = (totalPnL / state.startingBalanceUSDT) * 100;
  const winningTrades = closedTrades.filter(t => (t.realizedPnL || 0) > 0);
  const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0;
  const totalFeesPaid = state.totalFeesPaid || 0;

  const isHardStopDrawdown = state.hardStopTriggered === 'DRAWDOWN_50';
  const isHardStopProfit = state.hardStopTriggered === 'PROFIT_100';

  return (
    <div className="flex-1 flex flex-col h-full bg-black text-zinc-100 overflow-y-auto p-4 md:p-6 space-y-6">
      {/* Top Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-950 border border-white/10 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold tracking-tight text-white">Momentum Paper Trading</h1>
              <span className={cn(
                "px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold border",
                state.active ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" : "bg-zinc-800 text-zinc-400 border-white/10"
              )}>
                {language === 'ro' 
                  ? (state.active ? "● MOTOR ACTIV (24/7)" : "○ MOTOR OPRIT")
                  : (state.active ? "● ACTIVE ENGINE (24/7)" : "○ ENGINE STOPPED")}
              </span>
              {state.hardStopTriggered && (
                <span className={cn(
                  "px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border",
                  isHardStopDrawdown 
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/50" 
                    : "bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
                )}>
                  {isHardStopDrawdown ? "🛑 HARD STOP (-50%)" : "🏆 TARGET PROFIT (+100%)"}
                </span>
              )}
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              {language === 'ro'
                ? 'Simulare automată pe date live Binance cu contabilizare exactă a balanței, taxe incluse și protecție Hard Stop (-50% / +100%).'
                : 'Automated simulation on live Binance data with exact balance accounting, deducted fees and Hard Stop protection (-50% / +100%).'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
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
              disabled={actionLoading === 'start' || !!state.hardStopTriggered}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg cursor-pointer",
                state.hardStopTriggered 
                  ? "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-white/10"
                  : "bg-emerald-500 hover:bg-emerald-600 text-black shadow-emerald-500/20"
              )}
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
            <span>{language === 'ro' ? 'Snapshots (JSON)' : 'Snapshots (JSON)'}</span>
          </a>

          <button
            onClick={handleReset}
            disabled={actionLoading === 'reset'}
            className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
          >
            <span>{language === 'ro' ? 'Reset Capital Global ($1,000)' : 'Reset Global Capital ($1,000)'}</span>
          </button>
        </div>
      </div>

      {/* Notifications / Feedback */}
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Hard Stop Trigger Banners */}
      {isHardStopDrawdown && (
        <div className="bg-rose-950/70 border-2 border-rose-500/80 rounded-2xl p-5 shadow-2xl flex items-start gap-4 text-rose-100">
          <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500 flex items-center justify-center text-rose-400 shrink-0">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
          </div>
          <div className="space-y-1">
            <div className="text-base font-bold text-white flex items-center gap-2">
              <span>🛑 HARD STOP CIRCUIT BREAKER ACTIVAT (-50%)</span>
              <span className="text-xs px-2 py-0.5 rounded bg-rose-500/30 border border-rose-500 text-rose-200 font-mono font-normal">
                Balanță: ${totalEquity.toFixed(2)} / Initial: ${state.startingBalanceUSDT.toLocaleString()}
              </span>
            </div>
            <p className="text-xs text-rose-200 leading-relaxed">
              {language === 'ro'
                ? `Balanța totală a scăzut cu 50% față de capitalul inițial (limita de siguranță de $${(state.startingBalanceUSDT * 0.5).toFixed(0)} a fost atinsă). Execuția automată a fost OPRITĂ pentru protejarea capitalului rămas. Apăsați butonul „Reset Simulator” pentru a reinițializa balanța la $${state.startingBalanceUSDT.toLocaleString()}.`
                : `Total equity dropped by 50% from initial capital ($${(state.startingBalanceUSDT * 0.5).toFixed(0)} threshold reached). Automated trading was STOPPED to protect remaining funds. Click "Reset Simulator" to re-initialize balance to $${state.startingBalanceUSDT.toLocaleString()}.`}
            </p>
          </div>
        </div>
      )}

      {isHardStopProfit && (
        <div className="bg-emerald-950/70 border-2 border-emerald-500/80 rounded-2xl p-5 shadow-2xl flex items-start gap-4 text-emerald-100">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500 flex items-center justify-center text-emerald-400 shrink-0">
            <Award className="w-6 h-6 animate-bounce" />
          </div>
          <div className="space-y-1">
            <div className="text-base font-bold text-white flex items-center gap-2">
              <span>🏆 ȚINTĂ ATINSĂ: CAPITAL DUBLAT (+100% PROFIT)!</span>
              <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/30 border border-emerald-500 text-emerald-200 font-mono font-normal">
                Balanță: ${totalEquity.toFixed(2)} / Initial: ${state.startingBalanceUSDT.toLocaleString()}
              </span>
            </div>
            <p className="text-xs text-emerald-200 leading-relaxed">
              {language === 'ro'
                ? `Felicitări! Balanța totală a depășit ținta de +100% (Capitalul de $${state.startingBalanceUSDT.toLocaleString()} a atins $${(state.startingBalanceUSDT * 2).toLocaleString()}+). Execuția a fost oprită conform regulii de securizare a profitului obținut.`
                : `Congratulations! Total equity has doubled (+100% target profit hit, reaching $${(state.startingBalanceUSDT * 2).toLocaleString()}+). Trading stopped according to profit-taking target rule.`}
            </p>
          </div>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-zinc-950 border border-white/10 rounded-2xl p-4">
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{language === 'ro' ? 'Sold Cash Disponibil' : 'Available Cash'}</span>
          <div className="text-xl md:text-2xl font-bold font-mono text-white mt-1">
            ${state.paperBalanceUSDT.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-zinc-500">{language === 'ro' ? 'Capital Inițial:' : 'Initial Capital:'} ${state.startingBalanceUSDT.toLocaleString()}</span>
        </div>

        <div className="bg-zinc-950 border border-white/10 rounded-2xl p-4">
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{language === 'ro' ? 'Total Equity (Live)' : 'Total Equity (Live)'}</span>
          <div className={cn("text-xl md:text-2xl font-bold font-mono mt-1", totalPnL >= 0 ? "text-emerald-400" : "text-rose-400")}>
            ${totalEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span className="text-[11px] text-zinc-500">{language === 'ro' ? 'Cash + Poziții Deschise' : 'Cash + Open Positions'}</span>
        </div>

        <div className="bg-zinc-950 border border-white/10 rounded-2xl p-4">
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{language === 'ro' ? 'PnL Total (+/-)' : 'Total Net PnL'}</span>
          <div className={cn("text-xl md:text-2xl font-bold font-mono mt-1", totalPnL >= 0 ? "text-emerald-400" : "text-rose-400")}>
            {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)} ({totalPnLPct >= 0 ? '+' : ''}{totalPnLPct.toFixed(2)}%)
          </div>
          <span className="text-[11px] text-zinc-500">{language === 'ro' ? 'Calcul exact contabilizat' : 'Exact net accounting'}</span>
        </div>

        <div className="bg-zinc-950 border border-white/10 rounded-2xl p-4">
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{language === 'ro' ? 'Taxe & Cheltuieli' : 'Total Fees Paid'}</span>
          <div className="text-xl md:text-2xl font-bold font-mono text-amber-400 mt-1">
            -${totalFeesPaid.toFixed(2)}
          </div>
          <span className="text-[11px] text-zinc-500">{language === 'ro' ? 'Comisioane intrare + ieșire' : 'Entry + Exit Fees'}</span>
        </div>

        <div className="bg-zinc-950 border border-white/10 rounded-2xl p-4 col-span-2 md:col-span-1">
          <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{language === 'ro' ? 'Win Rate & Active' : 'Win Rate & Open'}</span>
          <div className="text-xl md:text-2xl font-bold font-mono text-white mt-1">
            {winRate.toFixed(1)}% <span className="text-xs text-emerald-400 font-normal">({state.positions.length} active)</span>
          </div>
          <span className="text-[11px] text-zinc-500">{winningTrades.length} win / {closedTrades.length} închise</span>
        </div>
      </div>

      {/* MOTOR DE REGLAJ PARAMETRI (Interactive Adjustment Engine Panel) */}
      <div className="bg-zinc-950 border border-white/10 rounded-2xl p-5 shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span>{language === 'ro' ? 'Motor de Reglaj Parametri (Live Tuning Engine)' : 'Parameter Adjustment Engine (Live Tuning)'}</span>
              </h2>
              <p className="text-xs text-zinc-400">
                {language === 'ro'
                  ? 'Ajustează pragurile de ieșire, trailing stop-ul, stop loss-ul și durata maximă de menținere.'
                  : 'Adjust dynamic exit thresholds, trailing stop, hard stop loss, and max hold duration.'}
              </p>
            </div>
          </div>

          <button
            onClick={() => handleSaveParams()}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-emerald-500/20 cursor-pointer self-start sm:self-auto"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>{language === 'ro' ? 'Salvează & Aplică Parametrii' : 'Save & Apply Parameters'}</span>
          </button>
        </div>

        {/* Parameters Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* 0. Alocare Capital / Poziție */}
          <div className="bg-zinc-900/60 border border-emerald-500/20 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                <span>{language === 'ro' ? 'Alocare Capital / Poziție' : 'Capital Allocation / Position'}</span>
              </span>
              <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {allocationPct}% (~${(((state.startingBalanceUSDT || state.paperBalanceUSDT || 1000) * allocationPct) / 100).toFixed(1)})
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-tight">
              {language === 'ro'
                ? 'Procent din capitalul inițial alocat per poziție nouă (fix din capitalul de start, nu dinamic).'
                : 'Percentage of initial capital allocated per new position (fixed from starting capital, non-dynamic).'}
            </p>
            <div className="flex items-center gap-3 pt-1">
              <input
                type="range"
                min="1"
                max="100"
                step="1"
                value={allocationPct}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setAllocationPct(val);
                  handleSaveParams({ alloc: val });
                }}
                className="w-full h-2 bg-zinc-950 rounded-lg appearance-none cursor-pointer accent-emerald-500 border border-white/10"
              />
              <span className="font-mono text-xs font-bold text-emerald-400 w-12 text-right">{allocationPct}%</span>
            </div>
            {/* Quick Presets */}
            <div className="flex items-center gap-1.5 pt-1">
              {[5, 10, 20, 25, 50, 100].map((preset) => (
                <button
                  key={preset}
                  onClick={() => {
                    setAllocationPct(preset);
                    handleSaveParams({ alloc: preset });
                  }}
                  className={cn(
                    "flex-1 py-1 text-[10px] font-mono font-bold rounded border transition-all cursor-pointer",
                    allocationPct === preset
                      ? "bg-emerald-500 text-black border-emerald-400 shadow-sm shadow-emerald-500/30"
                      : "bg-zinc-950/80 hover:bg-zinc-800 text-zinc-400 border-white/10 hover:text-white"
                  )}
                >
                  {preset}%
                </button>
              ))}
            </div>
          </div>

          {/* 1. Trailing Activation */}
          <div className="bg-zinc-900/60 border border-white/5 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                <span>Trailing Activation</span>
              </span>
              <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                +{trailingActivation.toFixed(1)}%
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-tight">
              {language === 'ro'
                ? 'Prag profit minim pentru declanșare Trailing Stop (0 - 10%, trepte de 0.5%).'
                : 'Min profit threshold to activate Trailing Stop (0 - 10%, steps of 0.5%).'}
            </p>
            <div className="flex items-center gap-3 pt-1">
              <input
                type="range"
                min="0"
                max="10"
                step="0.5"
                value={trailingActivation}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setTrailingActivation(val);
                  handleSaveParams({ trailingAct: val });
                }}
                className="w-full h-2 bg-zinc-950 rounded-lg appearance-none cursor-pointer accent-emerald-500 border border-white/10"
              />
              <span className="font-mono text-xs font-bold text-emerald-400 w-12 text-right">{trailingActivation.toFixed(1)}%</span>
            </div>
          </div>

          {/* 2. Trailing Distance */}
          <div className="bg-zinc-900/60 border border-white/5 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5 text-emerald-400" />
                <span>Trailing Distance</span>
              </span>
              <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                -{trailingDistance.toFixed(1)}%
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-tight">
              {language === 'ro'
                ? 'Distanța de protecție față de vârful atins (0 - 5%, trepte de 0.5%).'
                : 'Protective buffer distance from peak price (0 - 5%, steps of 0.5%).'}
            </p>
            <div className="flex items-center gap-3 pt-1">
              <input
                type="range"
                min="0"
                max="5"
                step="0.5"
                value={trailingDistance}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setTrailingDistance(val);
                  handleSaveParams({ trailingDist: val });
                }}
                className="w-full h-2 bg-zinc-950 rounded-lg appearance-none cursor-pointer accent-emerald-500 border border-white/10"
              />
              <span className="font-mono text-xs font-bold text-emerald-400 w-12 text-right">{trailingDistance.toFixed(1)}%</span>
            </div>
          </div>

          {/* 3. Hard SL */}
          <div className="bg-zinc-900/60 border border-white/5 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
                <span>Hard Stop Loss (SL)</span>
              </span>
              <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
                -{hardSL.toFixed(1)}%
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-tight">
              {language === 'ro'
                ? 'Stop Loss fix sub prețul de intrare (-5% - 0%, trepte de 0.5%).'
                : 'Hard Stop Loss level below entry price (-5% - 0%, steps of 0.5%).'}
            </p>
            <div className="flex items-center gap-3 pt-1">
              <input
                type="range"
                min="0"
                max="5"
                step="0.5"
                value={hardSL}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setHardSL(val);
                  handleSaveParams({ sl: val });
                }}
                className="w-full h-2 bg-zinc-950 rounded-lg appearance-none cursor-pointer accent-rose-500 border border-white/10"
              />
              <span className="font-mono text-xs font-bold text-rose-400 w-12 text-right">-{hardSL.toFixed(1)}%</span>
            </div>
          </div>

          {/* 4. Max Hold */}
          <div className="bg-zinc-900/60 border border-white/5 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                <span>Max Hold</span>
              </span>
              <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                {maxHold} min ({(maxHold / 60).toFixed(1)}h)
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-tight">
              {language === 'ro'
                ? 'Timp maxim de menținere a poziției (0 - 1440 min, trepte de 10 min).'
                : 'Maximum duration to hold an open position (0 - 1440 min, steps of 10 min).'}
            </p>
            <div className="flex items-center gap-3 pt-1">
              <input
                type="range"
                min="0"
                max="1440"
                step="10"
                value={maxHold}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setMaxHold(val);
                  handleSaveParams({ hold: val });
                }}
                className="w-full h-2 bg-zinc-950 rounded-lg appearance-none cursor-pointer accent-blue-500 border border-white/10"
              />
              <span className="font-mono text-xs font-bold text-blue-400 w-16 text-right">{maxHold}m</span>
            </div>
          </div>

          {/* 5. Take Profit (TP) */}
          <div className="bg-zinc-900/60 border border-white/5 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-amber-400" />
                <span>Take Profit (TP)</span>
              </span>
              <button
                onClick={() => {
                  const nextState = !isTPEnabled;
                  setIsTPEnabled(nextState);
                  handleSaveParams({ tpEnabled: nextState });
                }}
                className={cn(
                  "px-2 py-0.5 rounded text-xs font-mono font-bold border transition-all cursor-pointer",
                  !isTPEnabled 
                    ? "bg-zinc-800 text-zinc-400 border-white/10" 
                    : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                )}
              >
                {isTPEnabled ? `+${tpValue.toFixed(1)}%` : (language === 'ro' ? 'Dezactivat' : 'Disabled')}
              </button>
            </div>
            <p className="text-[11px] text-zinc-400 leading-tight">
              {language === 'ro'
                ? 'Țintă fixă de profit per trade. Conform cerințelor, este setat pe Dezactivat implicit.'
                : 'Fixed profit target per trade. Default disabled as specified.'}
            </p>
            {isTPEnabled ? (
              <div className="flex items-center gap-3 pt-1">
                <input
                  type="range"
                  min="1"
                  max="30"
                  step="0.5"
                  value={tpValue}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setTpValue(val);
                    handleSaveParams({ tpVal: val });
                  }}
                  className="w-full h-2 bg-zinc-950 rounded-lg appearance-none cursor-pointer accent-amber-500 border border-white/10"
                />
                <span className="font-mono text-xs font-bold text-amber-400 w-12 text-right">+{tpValue.toFixed(1)}%</span>
              </div>
            ) : (
              <div className="text-xs font-mono text-zinc-500 italic py-1">
                {language === 'ro' ? '● Dezactivat (Ieșirile sunt gestionate pur prin Trailing Stop)' : '● Disabled (Exits managed purely via Trailing Stop)'}
              </div>
            )}
          </div>

          {/* 6. Min Momentum Score */}
          <div className="bg-zinc-900/60 border border-white/5 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-emerald-400" />
                <span>{language === 'ro' ? 'Scor Minim Intrare' : 'Min Momentum Score'}</span>
              </span>
              <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {minScore} / 100
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 leading-tight">
              {language === 'ro'
                ? 'Prag minim scor momentum pentru inițierea automată a trade-ului (20 - 90).'
                : 'Min score threshold to automatically trigger paper trade entry (20 - 90).'}
            </p>
            <div className="flex items-center gap-3 pt-1">
              <input
                type="range"
                min="20"
                max="90"
                step="1"
                value={minScore}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setMinScore(val);
                  handleSaveParams({ score: val });
                }}
                className="w-full h-2 bg-zinc-950 rounded-lg appearance-none cursor-pointer accent-emerald-500 border border-white/10"
              />
              <span className="font-mono text-xs font-bold text-emerald-400 w-12 text-right">{minScore}</span>
            </div>
          </div>
        </div>

        {/* Hard Stop Rules Explanation Badge */}
        <div className="bg-zinc-900/40 border border-white/5 rounded-xl p-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs font-mono text-zinc-300">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong className="text-white">Reguli Hard Stop Balanță active:</strong> Stop trade-uri la <span className="text-rose-400 font-bold">-50%</span> (${(state.startingBalanceUSDT * 0.5).toFixed(0)}) și la <span className="text-emerald-400 font-bold">+100%</span> (${(state.startingBalanceUSDT * 2).toFixed(0)}) din balanță. Taxele sunt contabilizate cu minus exact.
            </span>
          </div>
          <div className="text-[11px] text-zinc-500">
            {language === 'ro' ? 'Frecvență scan: 15m' : 'Scan interval: 15m'}
          </div>
        </div>
      </div>

      {/* Active Positions Table */}
      <div className="bg-zinc-950 border border-white/10 rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            {language === 'ro' ? `Poziții Paper Active (${state.positions.length})` : `Active Paper Positions (${state.positions.length})`}
          </h2>
          <span className="text-xs text-zinc-400 font-mono">
            {language === 'ro' ? `Max Hold: ${maxHold}m` : `Max Hold: ${maxHold}m`}
          </span>
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
                  <th className="py-2.5 px-3">{language === 'ro' ? 'Trailing Stop' : 'Trailing Stop'}</th>
                  <th className="py-2.5 px-3">{language === 'ro' ? 'Scor Intrare' : 'Entry Score'}</th>
                  <th className="py-2.5 px-3">{language === 'ro' ? 'Timp Scurs' : 'Elapsed'}</th>
                  <th className="py-2.5 px-3 text-right">{language === 'ro' ? 'Acțiuni' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {state.positions.map((pos, idx) => {
                  const minutesElapsed = Math.floor((Date.now() - pos.entryTimestamp) / (1000 * 60));
                  const hoursElapsed = (minutesElapsed / 60).toFixed(1);
                  return (
                    <tr key={pos.id ? `${pos.id}-${idx}` : `pos-${idx}`} className="hover:bg-white/5 transition-colors">
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
                        {pos.trailingActive && pos.trailingStopPrice ? (
                          <span className="text-amber-300 font-bold">${pos.trailingStopPrice.toFixed(4)}</span>
                        ) : (
                          <span className="text-zinc-500">Activare la +{trailingActivation}%</span>
                        )}
                      </td>
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
                      <td className="py-3 px-3 text-zinc-400">{hoursElapsed}h / {(maxHold/60).toFixed(0)}h</td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => handleManualClose(pos.symbol)}
                          disabled={actionLoading === `close-${pos.symbol}`}
                          className="px-2.5 py-1 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 text-[11px] font-bold cursor-pointer transition-all disabled:opacity-50 hover:border-rose-500"
                        >
                          {actionLoading === `close-${pos.symbol}` ? '...' : (language === 'ro' ? 'Închide' : 'Close')}
                        </button>
                      </td>
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
            <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
              {closedTrades.map((t, idx) => {
                const isWin = (t.realizedPnL || 0) > 0;
                return (
                  <div key={t.id ? `${t.id}-${idx}` : `closed-${idx}`} className="bg-zinc-900/50 border border-white/5 rounded-xl p-3 flex items-center justify-between text-xs font-mono">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white">{t.symbol}</span>
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-semibold", isWin ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-rose-500/20 text-rose-300 border border-rose-500/30")}>
                          {isWin ? "WIN" : "LOSS"}
                        </span>
                        {t.exitReason && (
                          <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded font-bold font-mono border",
                            t.exitReason === 'TRAILING' ? "bg-amber-500/20 text-amber-300 border-amber-500/40" :
                            t.exitReason === 'SL' ? "bg-rose-500/20 text-rose-300 border-rose-500/40" :
                            t.exitReason === 'TP' ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" :
                            "bg-blue-500/20 text-blue-300 border-blue-500/40"
                          )}>
                            {t.exitReason === 'TRAILING' ? '🎯 TRAILING' : t.exitReason === 'SL' ? `🛑 SL -${hardSL}%` : t.exitReason === 'TP' ? '💰 TP' : `⏳ TIMEOUT`}
                          </span>
                        )}
                        {t.scoreAtEntry !== undefined && (
                          <button
                            onClick={() => setSelectedPositionBreakdown(t)}
                            className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-[10px] flex items-center gap-1 border border-white/10 cursor-pointer"
                          >
                            <Activity className="w-3 h-3 text-emerald-400" />
                            <span>{t.scoreAtEntry.toFixed(1)}</span>
                          </button>
                        )}
                      </div>
                      <div className="text-[10px] text-zinc-400 mt-1">
                        {language === 'ro' ? 'Intrare:' : 'Entry:'} ${t.entryPrice.toFixed(4)} → {language === 'ro' ? 'Ieșire:' : 'Exit:'} ${t.exitPrice?.toFixed(4)} | Taxe: -${t.feePaid.toFixed(3)}
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
            {state.logs.map((log, idx) => {
              const isBtcDiag = log.message.includes('BTC_DIAGNOSTIC');
              return (
                <div key={idx} className={cn(
                  "border rounded-lg p-2.5 flex items-start gap-2.5 transition-all",
                  isBtcDiag
                    ? "bg-amber-500/15 border-amber-500/50 shadow-lg shadow-amber-950/40 text-amber-100 ring-1 ring-amber-500/30"
                    : "bg-zinc-900/40 border-white/5 text-zinc-300"
                )}>
                  <span className="text-zinc-500 shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
                  <div className="flex-1 leading-tight">
                    {isBtcDiag && (
                      <span className="inline-block px-2 py-0.5 rounded bg-amber-500 text-zinc-950 font-bold text-[10px] uppercase mb-1.5 mr-2 shadow-sm">
                        Bitcoin Live Diagnostic 🌟
                      </span>
                    )}
                    <span className={isBtcDiag ? "font-bold text-amber-200 font-mono text-xs block mt-0.5" : "text-zinc-300"}>
                      {log.message}
                    </span>
                  </div>
                </div>
              );
            })}
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
