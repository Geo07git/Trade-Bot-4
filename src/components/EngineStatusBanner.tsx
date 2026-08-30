import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  ShieldCheck, 
  RefreshCw, 
  Lock, 
  Unlock, 
  Power,
  Activity,
  AlertTriangle
} from 'lucide-react';
import { apiFetch, safeJson } from '../utils/apiHelper';
import { useTradingStore } from '../store';
import { getTranslation } from '../utils/i18n';

export function EngineStatusBanner() {
  const { language } = useTradingStore();
  const t = getTranslation(language);

  const [engineState, setEngineState] = useState<string>('TRADING');
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [stateReason, setStateReason] = useState<string>('');
  const [balanceDrift, setBalanceDrift] = useState<number>(0);
  const [isDesynced, setIsDesynced] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await apiFetch('/api/engine/status');
      if (res && res.ok) {
        const data = await safeJson(res, null);
        if (data) {
          setEngineState(data.state || 'TRADING');
          setIsLocked(!!data.isLocked);
          setStateReason(data.stateReason || '');
          if (data.reconciliation) {
            setBalanceDrift(data.reconciliation.balanceDriftUSDT || 0);
            setIsDesynced(!!data.reconciliation.isDesynced);
          }
        }
      }
    } catch (err) {
      // Ignore polling errors
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleReconcile = async () => {
    setActionLoading('reconcile');
    try {
      await apiFetch('/api/engine/reconcile', { method: 'POST' });
      await fetchStatus();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnlockDesync = async () => {
    setActionLoading('unlock');
    try {
      await apiFetch('/api/engine/unlock-desync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Operator verified exchange balance' })
      });
      await fetchStatus();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleKillSwitch = async () => {
    if (!window.confirm(language === 'ro' ? 'Activați Oprirea de Urgență (Kill Switch)?' : 'Engage Emergency Kill Switch?')) return;
    setActionLoading('kill');
    try {
      await apiFetch('/api/engine/kill-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Emergency Stop by operator' })
      });
      await fetchStatus();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleResume = async () => {
    setActionLoading('resume');
    try {
      await apiFetch('/api/engine/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Operator resumed trading' })
      });
      await fetchStatus();
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(null);
    }
  };

  // If DESYNC_LOCK or EMERGENCY is active, show prominent alert banner
  const isEmergency = engineState === 'EMERGENCY';
  const isDesync = engineState === 'DESYNC_LOCK' || isDesynced;

  if (isEmergency) {
    return (
      <div className="bg-rose-950/90 border-b border-rose-500/60 px-4 py-2.5 text-white flex flex-wrap items-center justify-between gap-3 shadow-lg z-30 shrink-0 font-mono text-xs">
        <div className="flex items-center gap-2.5">
          <ShieldAlert className="w-5 h-5 text-rose-400 animate-bounce" />
          <div>
            <span className="font-bold text-rose-200">{t.emergencyKill}</span>
            <p className="text-[11px] text-rose-300/80">{stateReason || (language === 'ro' ? 'Toate execuțiile automate sunt blocate de oprirea de urgență.' : 'All automated trading is locked by operator kill switch.')}</p>
          </div>
        </div>
        <button
          onClick={handleResume}
          disabled={actionLoading === 'resume'}
          className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <Power className="w-3.5 h-3.5" />
          <span>{language === 'ro' ? 'Reluare Tranzacționare' : 'Resume Engine'}</span>
        </button>
      </div>
    );
  }

  if (isDesync) {
    return (
      <div className="bg-amber-950/90 border-b border-amber-500/60 px-4 py-2.5 text-white flex flex-wrap items-center justify-between gap-3 shadow-lg z-30 shrink-0 font-mono text-xs">
        <div className="flex items-center gap-2.5">
          <AlertTriangle className="w-5 h-5 text-amber-400 animate-pulse" />
          <div>
            <span className="font-bold text-amber-200">{t.desyncLock}: Deviație (${balanceDrift.toFixed(2)} USDT)</span>
            <p className="text-[11px] text-amber-300/80">{stateReason || (language === 'ro' ? 'Pozițiile noi sunt blocate până la reconcilierea cu bursa.' : 'New positions blocked until local balance & positions match exchange.')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReconcile}
            disabled={actionLoading === 'reconcile'}
            className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 rounded flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${actionLoading === 'reconcile' ? 'animate-spin' : ''}`} />
            <span>{t.reconcileNow}</span>
          </button>
          <button
            onClick={handleUnlockDesync}
            disabled={actionLoading === 'unlock'}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-zinc-950 font-bold rounded flex items-center gap-1.5 cursor-pointer"
          >
            <Unlock className="w-3.5 h-3.5" />
            <span>{t.unlockDesync}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0b0e14] border-b border-amber-500/20 px-4 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs font-mono shrink-0 z-20">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-zinc-400 text-[11px]">{t.engineState}:</span>
          <span className="text-emerald-400 font-bold tracking-wider">{engineState}</span>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 text-zinc-500 text-[11px] border-l border-white/10 pl-3">
          <span>{t.systemParity}:</span>
          <span className="text-zinc-300 font-semibold">${balanceDrift.toFixed(2)}</span>
        </div>

        <div className="hidden md:flex items-center gap-1.5 text-zinc-500 text-[11px] border-l border-white/10 pl-3">
          <span>{t.liveParity}:</span>
          <span className="text-emerald-400 font-semibold">{t.connected}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {engineState === 'TRADING' ? (
          <button
            onClick={handleKillSwitch}
            disabled={actionLoading === 'kill'}
            className="px-2.5 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-[11px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 transition-all cursor-pointer"
            title="Pause / Stop Trading"
          >
            <Lock className="w-3 h-3 text-amber-400" />
            <span>{language === 'ro' ? 'Pauză' : 'Pause Engine'}</span>
          </button>
        ) : (
          <button
            onClick={handleResume}
            disabled={actionLoading === 'resume'}
            className="px-2.5 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-[11px] font-bold text-emerald-300 flex items-center gap-1 transition-all cursor-pointer"
            title="Resume / Start Trading"
          >
            <Power className="w-3 h-3 text-emerald-400" />
            <span>{language === 'ro' ? 'Pornire / Reluare' : 'Resume / Start'}</span>
          </button>
        )}

        <button
          onClick={handleReconcile}
          disabled={actionLoading === 'reconcile'}
          className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-amber-500/30 text-[11px] text-amber-300 hover:text-amber-200 flex items-center gap-1 transition-all cursor-pointer"
          title="Force state reconciliation with exchange"
        >
          <RefreshCw className={`w-3 h-3 ${actionLoading === 'reconcile' ? 'animate-spin text-amber-400' : 'text-amber-400'}`} />
          <span>{t.reconcileNow}</span>
        </button>

        <button
          onClick={handleKillSwitch}
          disabled={actionLoading === 'kill'}
          className="px-2.5 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-[11px] font-bold text-rose-400 hover:text-rose-300 flex items-center gap-1 transition-all cursor-pointer"
          title="Engage emergency kill switch"
        >
          <ShieldAlert className="w-3 h-3 text-rose-400" />
          <span>{t.cmdKill}</span>
        </button>
      </div>
    </div>
  );
}
