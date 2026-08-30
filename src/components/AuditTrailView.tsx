import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  RefreshCw, 
  Lock, 
  Unlock, 
  Power, 
  Filter, 
  Search, 
  Download, 
  Trash2, 
  ChevronRight, 
  ChevronDown, 
  AlertTriangle,
  Clock,
  Terminal,
  Activity,
  CheckCircle2
} from 'lucide-react';
import { apiFetch, safeJson } from '../utils/apiHelper';

export interface AuditEvent {
  id: number;
  timestamp: number;
  eventType: string;
  symbol?: string;
  strategy?: string;
  action?: string;
  details: any;
}

export interface EngineFullStatus {
  state: string;
  stateReason: string;
  lastStateChangeTime: number;
  canTrade: boolean;
  isLocked: boolean;
  reconciliation: {
    lastReconciledAt: number | null;
    isDesynced: boolean;
    desyncReason: string | null;
    balanceDriftUSDT: number;
    driftThresholdUSDT: number;
    exchangePositionsCount: number;
    localPositionsCount: number;
  };
  auditStats: {
    totalEvents: number;
    typeCounts: Record<string, number>;
    lastEventTimestamp: number | null;
  };
}

export function AuditTrailView() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [totalEvents, setTotalEvents] = useState<number>(0);
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [engineStatus, setEngineStatus] = useState<EngineFullStatus | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedEventType, setSelectedEventType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [symbolFilter, setSymbolFilter] = useState<string>('');
  const [expandedEventId, setExpandedEventId] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const fetchStatusAndEvents = async () => {
    try {
      setLoading(true);
      // Fetch Engine Status
      const statusRes = await apiFetch('/api/engine/status');
      if (statusRes.ok) {
        const statusData = await safeJson(statusRes, null);
        if (statusData) {
          setEngineStatus(statusData);
        }
      }

      // Fetch Audit Events
      const params = new URLSearchParams();
      if (selectedEventType && selectedEventType !== 'ALL') params.set('eventType', selectedEventType);
      if (symbolFilter) params.set('symbol', symbolFilter);
      if (searchQuery) params.set('search', searchQuery);
      params.set('limit', '150');

      const eventsRes = await apiFetch(`/api/engine/audit-events?${params.toString()}`);
      if (eventsRes.ok) {
        const eventsData = await safeJson(eventsRes, null);
        if (eventsData) {
          setEvents(eventsData.events || []);
          setTotalEvents(eventsData.total || 0);
          if (eventsData.eventTypes) setEventTypes(eventsData.eventTypes);
        }
      }
    } catch (err: any) {
      console.error('[AuditTrailView] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatusAndEvents();
    const interval = setInterval(fetchStatusAndEvents, 4000);
    return () => clearInterval(interval);
  }, [selectedEventType, symbolFilter]);

  const handleManualReconcile = async () => {
    setActionLoading('reconcile');
    setStatusMessage({ type: 'info', text: 'Executing live state reconciliation...' });
    try {
      const res = await apiFetch('/api/engine/reconcile', { method: 'POST' });
      const data = await safeJson(res, null);
      if (data && data.success) {
        setStatusMessage({ 
          type: data.reconciliation?.isDesynced ? 'error' : 'success', 
          text: data.reconciliation?.isDesynced 
            ? `Desynchronization detected: ${data.reconciliation.desyncReason}` 
            : 'Reconciliation complete: Local and exchange states in total parity.' 
        });
      } else {
        setStatusMessage({ type: 'error', text: data?.error || 'Reconciliation failed.' });
      }
      await fetchStatusAndEvents();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Error executing reconciliation.' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnlockDesync = async () => {
    setActionLoading('unlock');
    try {
      const res = await apiFetch('/api/engine/unlock-desync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Operator verified account and unlocked desync' })
      });
      const data = await safeJson(res, null);
      if (data && data.success) {
        setStatusMessage({ type: 'success', text: 'DESYNC_LOCK successfully released. Trading resumed.' });
      }
      await fetchStatusAndEvents();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Failed to unlock desync.' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleKillSwitch = async () => {
    if (!window.confirm('Trigger EMERGENCY Kill Switch? This will instantly block all automated trading.')) return;
    setActionLoading('kill');
    try {
      const res = await apiFetch('/api/engine/kill-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Emergency Kill Switch triggered by operator' })
      });
      const data = await safeJson(res, null);
      if (data && data.success) {
        setStatusMessage({ type: 'error', text: 'EMERGENCY Kill Switch engaged. Engine halted.' });
      }
      await fetchStatusAndEvents();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Failed to trigger kill switch.' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleResume = async () => {
    setActionLoading('resume');
    try {
      const res = await apiFetch('/api/engine/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Operator resumed trading' })
      });
      const data = await safeJson(res, null);
      if (data && data.success) {
        setStatusMessage({ type: 'success', text: 'Trading engine resumed.' });
      }
      await fetchStatusAndEvents();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Failed to resume engine.' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleClearAuditLogs = async () => {
    if (!window.confirm('Clear all audit events? This action cannot be undone.')) return;
    try {
      await apiFetch('/api/engine/audit-events/clear', { method: 'POST' });
      setStatusMessage({ type: 'info', text: 'Audit events cleared.' });
      await fetchStatusAndEvents();
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err?.message || 'Failed to clear events.' });
    }
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(events, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `tradebot_audit_trail_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const getEventTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'POSITION_OPENED':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'POSITION_CLOSED':
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
      case 'DESYNC_LOCK':
      case 'KILL_SWITCH_ACTIVATED':
      case 'CIRCUIT_BREAKER_TRIGGERED':
        return 'bg-rose-500/20 text-rose-400 border-rose-500/40 font-bold animate-pulse';
      case 'RECONCILE_DRIFT':
      case 'TRADE_BLOCKED_ENGINE_STATE':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'RISK_EVALUATED':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'SIGNAL_EVALUATED':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      default:
        return 'bg-zinc-800 text-zinc-300 border-zinc-700';
    }
  };

  const getStateColor = (state?: string) => {
    switch (state) {
      case 'TRADING':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      case 'DESYNC_LOCK':
        return 'text-amber-400 bg-amber-500/20 border-amber-500/40 animate-pulse';
      case 'EMERGENCY':
        return 'text-rose-400 bg-rose-500/20 border-rose-500/40 animate-pulse';
      case 'SYNCING':
        return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
      default:
        return 'text-zinc-400 bg-zinc-800 border-zinc-700';
    }
  };

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[#07090e] text-zinc-100 p-4 md:p-6 space-y-5 font-sans">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
            <h1 className="text-xl font-bold tracking-tight text-white uppercase font-mono">
              TradeBot // Reconciliation &amp; Audit Trail
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-zinc-800 text-zinc-300 border border-zinc-700">
              Phase 4 Engine
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Real-time state machine monitoring, exchange balance drift verification, and deterministic trade lifecycle auditing.
          </p>
        </div>

        {/* Engine Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleManualReconcile}
            disabled={actionLoading === 'reconcile'}
            className="px-3 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-mono font-semibold text-zinc-200 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            title="Perform live reconciliation with exchange balances"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${actionLoading === 'reconcile' ? 'animate-spin text-emerald-400' : 'text-zinc-400'}`} />
            <span>Reconcile Parity</span>
          </button>

          {engineStatus?.state === 'DESYNC_LOCK' && (
            <button
              onClick={handleUnlockDesync}
              disabled={actionLoading === 'unlock'}
              className="px-3 py-1.5 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-xs font-mono font-bold text-amber-300 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Unlock className="w-3.5 h-3.5 text-amber-400" />
              <span>Unlock DESYNC</span>
            </button>
          )}

          {engineStatus?.state === 'EMERGENCY' ? (
            <button
              onClick={handleResume}
              disabled={actionLoading === 'resume'}
              className="px-3 py-1.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 text-xs font-mono font-bold text-emerald-400 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Power className="w-3.5 h-3.5 text-emerald-400" />
              <span>Resume Engine</span>
            </button>
          ) : (
            <button
              onClick={handleKillSwitch}
              disabled={actionLoading === 'kill'}
              className="px-3 py-1.5 rounded bg-rose-500/10 hover:bg-rose-500/25 border border-rose-500/40 text-xs font-mono font-bold text-rose-400 flex items-center gap-1.5 transition-all cursor-pointer"
              title="Instantly stop all automated trading"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
              <span>Kill Switch</span>
            </button>
          )}

          <button
            onClick={handleExportJSON}
            className="px-3 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-mono text-zinc-300 flex items-center gap-1.5 transition-all cursor-pointer"
            title="Download audit trail logs as JSON"
          >
            <Download className="w-3.5 h-3.5 text-zinc-400" />
            <span>Export Logs</span>
          </button>

          <button
            onClick={handleClearAuditLogs}
            className="px-2.5 py-1.5 rounded bg-zinc-900 hover:bg-rose-950/40 border border-zinc-800 hover:border-rose-800/50 text-xs font-mono text-zinc-500 hover:text-rose-400 transition-all cursor-pointer"
            title="Clear stored audit logs"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Status Alert Banner if any */}
      {statusMessage && (
        <div className={`px-4 py-2.5 rounded border text-xs font-mono flex items-center justify-between ${
          statusMessage.type === 'success' 
            ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' 
            : statusMessage.type === 'error'
            ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
            : 'bg-zinc-900 border-zinc-700 text-zinc-300'
        }`}>
          <div className="flex items-center gap-2">
            {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
            <span>{statusMessage.text}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="text-zinc-500 hover:text-zinc-300 text-xs">✕</button>
        </div>
      )}

      {/* Engine Status & Reconciliation Metric Bento Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Engine State Machine */}
        <div className="bg-zinc-950/80 border border-zinc-800/80 rounded p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Engine State</span>
            <Activity className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded text-xs font-mono font-bold border ${getStateColor(engineStatus?.state)}`}>
              {engineStatus?.state || 'TRADING'}
            </span>
            <span className="text-[11px] font-mono text-zinc-400">
              {engineStatus?.canTrade ? '🟢 EXECUTION ACTIVE' : '🔴 LOCKED'}
            </span>
          </div>
          <div className="mt-2 text-[10px] font-mono text-zinc-500 truncate" title={engineStatus?.stateReason}>
            Reason: {engineStatus?.stateReason || 'Nominal operation'}
          </div>
        </div>

        {/* Card 2: Balance Drift Monitor */}
        <div className="bg-zinc-950/80 border border-zinc-800/80 rounded p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Balance Drift</span>
            <ShieldCheck className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-lg font-bold font-mono ${
              (engineStatus?.reconciliation?.balanceDriftUSDT || 0) > 5 ? 'text-rose-400' : 'text-emerald-400'
            }`}>
              ${(engineStatus?.reconciliation?.balanceDriftUSDT || 0).toFixed(2)} USDT
            </span>
            <span className="text-[10px] font-mono text-zinc-500">
              Max: ${engineStatus?.reconciliation?.driftThresholdUSDT || 5.0} USDT
            </span>
          </div>
          <div className="mt-2 text-[10px] font-mono text-zinc-500 flex items-center justify-between">
            <span>Parity Drift Status:</span>
            <span className={engineStatus?.reconciliation?.isDesynced ? 'text-amber-400 font-bold' : 'text-emerald-400'}>
              {engineStatus?.reconciliation?.isDesynced ? 'DESYNC DETECTED' : 'IN-SYNC'}
            </span>
          </div>
        </div>

        {/* Card 3: Positions Parity */}
        <div className="bg-zinc-950/80 border border-zinc-800/80 rounded p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Position Sync</span>
            <Lock className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-lg font-bold font-mono text-zinc-200">
              {engineStatus?.reconciliation?.localPositionsCount ?? 0} Local
            </span>
            <span className="text-xs font-mono text-zinc-500">
              / {engineStatus?.reconciliation?.exchangePositionsCount ?? 0} Exchange
            </span>
          </div>
          <div className="mt-2 text-[10px] font-mono text-zinc-500">
            Last Sync: {engineStatus?.reconciliation?.lastReconciledAt ? new Date(engineStatus.reconciliation.lastReconciledAt).toLocaleTimeString() : 'Awaiting heartbeat'}
          </div>
        </div>

        {/* Card 4: Audit Event Count */}
        <div className="bg-zinc-950/80 border border-zinc-800/80 rounded p-3.5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-500">Audit Trail Ledger</span>
            <Terminal className="w-3.5 h-3.5 text-zinc-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-lg font-bold font-mono text-zinc-200">
              {totalEvents}
            </span>
            <span className="text-[10px] font-mono text-zinc-500">stored events</span>
          </div>
          <div className="mt-2 text-[10px] font-mono text-zinc-500">
            Storage: Persistent JSON Storage (/data)
          </div>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="bg-zinc-950 border border-zinc-800/80 rounded p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-700/80 rounded px-2.5 py-1 text-xs">
            <Filter className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-zinc-500 text-[11px] font-mono">Event:</span>
            <select
              value={selectedEventType}
              onChange={(e) => setSelectedEventType(e.target.value)}
              className="bg-transparent text-zinc-200 font-mono text-xs focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-zinc-900">ALL EVENTS ({totalEvents})</option>
              {eventTypes.map(t => (
                <option key={t} value={t} className="bg-zinc-900">{t}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-700/80 rounded px-2.5 py-1 text-xs">
            <span className="text-zinc-500 text-[11px] font-mono">Symbol:</span>
            <input
              type="text"
              placeholder="e.g. BTC, ETH"
              value={symbolFilter}
              onChange={(e) => setSymbolFilter(e.target.value)}
              className="bg-transparent text-zinc-200 font-mono text-xs focus:outline-none w-24 uppercase"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="flex items-center gap-1.5 bg-zinc-900 border border-zinc-700/80 rounded px-2.5 py-1 text-xs flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-zinc-400" />
            <input
              type="text"
              placeholder="Search details / reasons..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchStatusAndEvents()}
              className="bg-transparent text-zinc-200 font-mono text-xs focus:outline-none w-full"
            />
          </div>
          <button
            onClick={fetchStatusAndEvents}
            className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-xs font-mono text-zinc-200 cursor-pointer"
          >
            Search
          </button>
        </div>
      </div>

      {/* Audit Event Ledger Table */}
      <div className="bg-zinc-950 border border-zinc-800/80 rounded overflow-hidden">
        <div className="px-4 py-2.5 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/50 text-xs font-mono">
          <span className="text-zinc-400 font-bold uppercase tracking-wider">
            Audit Ledger ({events.length} shown of {totalEvents})
          </span>
          <span className="text-zinc-500 text-[11px]">
            Live polling 4s
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-zinc-800 text-[11px] uppercase tracking-wider text-zinc-500 bg-zinc-900/30">
                <th className="py-2.5 px-3 w-12">#</th>
                <th className="py-2.5 px-3 w-28">Timestamp</th>
                <th className="py-2.5 px-3 w-48">Event Type</th>
                <th className="py-2.5 px-3 w-24">Symbol</th>
                <th className="py-2.5 px-3 w-20">Action</th>
                <th className="py-2.5 px-3">Lifecycle Summary</th>
                <th className="py-2.5 px-3 w-12 text-center">Inspect</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50 text-zinc-300">
              {events.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-zinc-500 font-mono">
                    {loading ? 'Loading audit records...' : 'No audit events found matching the specified filters.'}
                  </td>
                </tr>
              ) : (
                events.map((evt) => {
                  const isExpanded = expandedEventId === evt.id;
                  const timeStr = new Date(evt.timestamp).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  
                  return (
                    <React.Fragment key={evt.id}>
                      <tr 
                        onClick={() => setExpandedEventId(isExpanded ? null : evt.id)}
                        className="hover:bg-zinc-900/60 transition-colors cursor-pointer"
                      >
                        <td className="py-2 px-3 text-zinc-500 text-[11px]">{evt.id}</td>
                        <td className="py-2 px-3 text-zinc-400 text-[11px] whitespace-nowrap">{timeStr}</td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap ${getEventTypeBadgeClass(evt.eventType)}`}>
                            {evt.eventType}
                          </span>
                        </td>
                        <td className="py-2 px-3 font-semibold text-zinc-200">
                          {evt.symbol || '-'}
                        </td>
                        <td className="py-2 px-3">
                          {evt.action ? (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              evt.action === 'BUY' ? 'bg-emerald-500/20 text-emerald-400' :
                              evt.action === 'SELL' ? 'bg-cyan-500/20 text-cyan-400' :
                              evt.action === 'VETO' ? 'bg-rose-500/20 text-rose-400' :
                              evt.action === 'BLOCK' ? 'bg-amber-500/20 text-amber-400' :
                              'text-zinc-400'
                            }`}>
                              {evt.action}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="py-2 px-3 text-zinc-400 text-[11px] truncate max-w-md">
                          {evt.details?.reason || evt.details?.exitReason || evt.details?.entryReason || evt.details?.desyncReason || JSON.stringify(evt.details).slice(0, 80)}
                        </td>
                        <td className="py-2 px-3 text-center text-zinc-500">
                          {isExpanded ? <ChevronDown className="w-4 h-4 mx-auto" /> : <ChevronRight className="w-4 h-4 mx-auto" />}
                        </td>
                      </tr>

                      {/* Expanded JSON Inspector */}
                      {isExpanded && (
                        <tr className="bg-zinc-900/90 border-b border-zinc-800">
                          <td colSpan={7} className="p-3">
                            <div className="bg-[#050608] border border-zinc-800 rounded p-3 text-[11px] font-mono text-zinc-300">
                              <div className="flex items-center justify-between pb-2 mb-2 border-b border-zinc-800/80 text-zinc-400">
                                <span>Event ID #{evt.id} Details [{evt.eventType}]</span>
                                <span>{new Date(evt.timestamp).toISOString()}</span>
                              </div>
                              <pre className="overflow-x-auto text-emerald-400/90 whitespace-pre-wrap">
                                {JSON.stringify(evt.details, null, 2)}
                              </pre>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
