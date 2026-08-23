import React, { useState, useEffect, useMemo } from 'react';
import { 
  BookOpen, 
  TrendingUp, 
  TrendingDown, 
  Filter, 
  Cpu, 
  Calendar, 
  DollarSign, 
  Zap, 
  Percent, 
  Award, 
  Clock, 
  ShieldAlert,
  Search,
  ChevronDown,
  RefreshCw,
  BarChart2,
  Trash2,
  PlusCircle,
  Download,
  FileText,
  Save,
  X,
  CheckCircle2
} from 'lucide-react';
import { JournalEntry, DailySnapshot } from '../types';
import { useTradingStore } from '../store';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';
import { apiFetch, safeJson, safeJsonFetch } from '../utils/apiHelper';

interface JournalAnalytics {
  totalTrades: number;
  closedTrades: number;
  winRate: number;
  totalPnL: number;
  totalFees: number;
  bestModel: string;
  bestStrategy: string;
  performanceByModel: Array<{
    model: string;
    totalTrades: number;
    closedTrades: number;
    winRate: number;
    totalPnL: number;
    avgProbability: number;
  }>;
  performanceByStrategy: Array<{
    strategy: string;
    totalTrades: number;
    closedTrades: number;
    winRate: number;
    totalPnL: number;
  }>;
}

function TradeGradeBadge({ grade, score, stars }: { grade?: string; score?: number; stars?: number }) {
  const scoreNum = score !== undefined ? parseFloat(score.toFixed(1)) : undefined;
  const g = grade || (scoreNum ? (scoreNum >= 90 ? 'A+' : scoreNum >= 80 ? 'A' : scoreNum >= 70 ? 'B' : scoreNum >= 60 ? 'C' : 'F') : 'B');
  const starCount = stars || (g === 'A+' ? 5 : g === 'A' ? 5 : g === 'B' ? 4 : g === 'C' ? 3 : 2);

  let colorStyle = 'bg-sky-500/10 text-sky-400 border-sky-500/30';
  if (g === 'A+') colorStyle = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/10';
  else if (g === 'A') colorStyle = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
  else if (g === 'B') colorStyle = 'bg-sky-500/10 text-sky-400 border-sky-500/30';
  else if (g === 'C') colorStyle = 'bg-amber-500/10 text-amber-400 border-amber-500/30';
  else if (g === 'F' || g === 'D') colorStyle = 'bg-rose-500/10 text-rose-400 border-rose-500/30';

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1.5">
        <span className={`px-2 py-0.5 rounded font-bold text-[10px] border font-mono ${colorStyle}`}>
          Grad {g}
        </span>
        {scoreNum !== undefined && (
          <span className="text-[10px] text-zinc-300 font-mono font-semibold">{scoreNum.toFixed(1)}/100</span>
        )}
      </div>
      <div className="flex text-amber-400 text-[10px] tracking-tighter">
        {'★'.repeat(starCount)}{'☆'.repeat(5 - starCount)}
      </div>
    </div>
  );
}

function formatInTimezone(isoStr?: string, timeZone = 'Europe/Bucharest'): string {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).formatToParts(d);

    const year = parts.find(p => p.type === 'year')?.value;
    const month = parts.find(p => p.type === 'month')?.value;
    const day = parts.find(p => p.type === 'day')?.value;
    let hour = parts.find(p => p.type === 'hour')?.value;
    if (hour === '24') hour = '00';
    const minute = parts.find(p => p.type === 'minute')?.value;

    return `${year}-${month}-${day} ${hour}:${minute}`;
  } catch {
    return isoStr.replace('T', ' ').substring(0, 16);
  }
}

function MinuteProfitDisplay({ minuteLogs, notes }: { minuteLogs?: any[]; notes?: string }) {
  if (minuteLogs && minuteLogs.length > 0) {
    return (
      <div className="flex flex-col gap-0.5 mt-1 pt-1 border-t border-white/5">
        <div className="text-[9px] font-mono text-zinc-400 flex items-center gap-1 font-semibold">
          <Clock className="w-2.5 h-2.5 text-sky-400 shrink-0" />
          <span>Profit/min ({minuteLogs.length}m):</span>
        </div>
        <div className="flex flex-wrap gap-0.5 max-w-[220px]">
          {minuteLogs.map((log, idx) => {
            const isPos = (log.pnlPercent ?? 0) >= 0;
            return (
              <span
                key={idx}
                className={`px-1 py-0.25 rounded font-mono text-[9px] font-bold border ${
                  isPos
                    ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                }`}
                title={`Minutul ${log.minute}: ${isPos ? '+' : ''}${log.pnlPercent}% ($${log.pnl ?? 0}) @ $${log.price ?? ''}`}
              >
                M{log.minute}:{isPos ? '+' : ''}{log.pnlPercent}%
              </span>
            );
          })}
        </div>
      </div>
    );
  }

  if (notes && notes.includes('Profit pe minute:')) {
    const parts = notes.split('Profit pe minute:')[1]?.trim();
    if (parts) {
      return (
        <div className="flex flex-col gap-0.5 mt-1 pt-1 border-t border-white/5">
          <div className="text-[9px] font-mono text-zinc-400 flex items-center gap-1 font-semibold">
            <Clock className="w-2.5 h-2.5 text-sky-400 shrink-0" />
            <span>Profit/min:</span>
          </div>
          <span className="font-mono text-[9px] text-zinc-300 bg-zinc-800/80 px-1.5 py-0.5 rounded border border-white/10 max-w-[220px] truncate">
            {parts}
          </span>
        </div>
      );
    }
  }

  return null;
}

export function TradingJournal() {
  const { 
    tradeHistory, 
    positions, 
    binanceMode, 
    timezone, 
    initialBalance,
    accumulationBalance = 0,
    sessionCycleCount = 1,
    consolidateAccumulation,
    resetAccumulationVault
  } = useTradingStore();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [snapshots, setSnapshots] = useState<DailySnapshot[]>([]);
  const [analytics, setAnalytics] = useState<JournalAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmResetAcc, setConfirmResetAcc] = useState(false);

  // Initial Equity from session start
  const initialEquity = useMemo(() => {
    return initialBalance && initialBalance > 0 ? initialBalance : 10000;
  }, [initialBalance]);

  // Session Profit Target % (defaults to 3.0%, stored in localStorage)
  const [sessionTargetPct, setSessionTargetPct] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('journal_session_target_pct');
      return saved ? parseFloat(saved) || 3.0 : 3.0;
    } catch {
      return 3.0;
    }
  });

  const handleSessionTargetChange = (val: number) => {
    setSessionTargetPct(val);
    try {
      localStorage.setItem('journal_session_target_pct', val.toString());
    } catch (e) {
      console.warn('Could not save session target to localStorage:', e);
    }
  };

  // Filters
  const [selectedSymbol, setSelectedSymbol] = useState<string>('ALL');
  const [selectedModel, setSelectedModel] = useState<string>('ALL');
  const [selectedAction, setSelectedAction] = useState<string>('ALL');
  const [selectedMode, setSelectedMode] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'entries' | 'models' | 'snapshots'>('entries');
  const [isTableCollapsed, setIsTableCollapsed] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'pnl' | 'date'>('date');
  
  // Modal and Manual Save State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Manual Form Fields State
  const [newSymbol, setNewSymbol] = useState('BTCUSDT');
  const [newAction, setNewAction] = useState<'BUY' | 'SELL'>('BUY');
  const [newPrice, setNewPrice] = useState<string>('63000');
  const [newAmount, setNewAmount] = useState<string>('0.05');
  const [newFeeBUY, setNewFeeBUY] = useState<string>('2.3625');
  const [newFeeSELL, setNewFeeSELL] = useState<string>('0');
  const [newPnLBrut, setNewPnLBrut] = useState<string>('0');
  const [newPnLPercent, setNewPnLPercent] = useState<string>('0');
  const [newMlProb, setNewMlProb] = useState<number>(85);
  const [newModelName, setNewModelName] = useState('Random Forest Ensemble 2.0');
  const [newEntryReason, setNewEntryReason] = useState('Semnal Manual / Strategie personalizată');
  const [newQualityScore, setNewQualityScore] = useState<number>(90);
  const [newNotes, setNewNotes] = useState('');

  const handleSaveManualEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingManual(true);
    try {
      const priceNum = parseFloat(newPrice) || 0;
      const amountNum = parseFloat(newAmount) || 0;
      const feeBUYNum = parseFloat(newFeeBUY) || 0;
      const feeSELLNum = parseFloat(newFeeSELL) || 0;
      const feeTotal = newAction === 'BUY' ? feeBUYNum : (feeBUYNum + feeSELLNum);
      const pnlBrutNum = parseFloat(newPnLBrut) || 0;
      const pnlPctNum = parseFloat(newPnLPercent) || 0;
      const scoreNum = Math.min(100, Math.max(0, newQualityScore || 85));

      const calculatedGrade = scoreNum >= 90 ? 'A+' : scoreNum >= 82 ? 'A' : scoreNum >= 76 ? 'B' : scoreNum >= 68 ? 'C' : 'F';
      const calculatedStars = scoreNum >= 90 ? 5 : scoreNum >= 82 ? 5 : scoreNum >= 76 ? 4 : scoreNum >= 68 ? 3 : 2;

      const payload = {
        symbol: newSymbol.toUpperCase().trim(),
        action: newAction,
        price: priceNum,
        amount: amountNum,
        fee: newAction === 'BUY' ? feeBUYNum : feeSELLNum,
        buyFee: feeBUYNum,
        sellFee: feeSELLNum,
        totalFee: feeTotal,
        pnl: pnlBrutNum,
        pnlPercent: pnlPctNum,
        mlProbability: newMlProb,
        modelName: newModelName,
        entryReason: newEntryReason,
        tradeQualityScore: scoreNum,
        tradeGrade: calculatedGrade,
        stars: calculatedStars,
        notes: newNotes,
        mode: binanceMode || 'paper',
        timestamp: new Date().toISOString(),
        date: new Date().toISOString().split('T')[0]
      };

      const res = await apiFetch('/api/journal/entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await safeJson(res, { success: false, error: 'Răspuns invalid de la server' });
      if (data && data.success) {
        setSaveSuccessMsg('Tranzacție salvată cu succes în jurnal!');
        setTimeout(() => setSaveSuccessMsg(null), 3000);
        setIsAddModalOpen(false);
        // Reset form
        setNewNotes('');
        await fetchData();
      } else {
        alert('Eroare la salvare: ' + (data?.error || 'Necunoscută'));
      }
    } catch (err: any) {
      alert('Eroare la conexiunea cu serverul: ' + (err?.message || err));
    } finally {
      setIsSavingManual(false);
    }
  };

  const handleExportCSV = () => {
    if (sortedFilteredEntries.length === 0) {
      alert('Nu există tranzacții de exportat.');
      return;
    }
    const headers = [
      'ID',
      'Data_Ora',
      'Simbol',
      'Tip',
      'Pret_Executie',
      'Cantitate',
      'Fee_BUY',
      'Fee_SELL',
      'Fee_Total',
      'PnL_Brut',
      'PnL_Net',
      'Equity',
      'Session_PnL_Percent',
      'Peak_Equity',
      'Drawdown_Percent',
      'Scor_Calitate',
      'Grad_AI',
      'Model_ML',
      'Motiv_Intrare',
      'Mod',
      'Note'
    ];
    const csvRows = [headers.join(',')];

    sortedFilteredEntries.forEach(e => {
      const timeStr = formatInTimezone(e.timestamp || new Date().toISOString(), timezone || 'Europe/Bucharest');
      const row = [
        `"${e.id}"`,
        `"${timeStr}"`,
        `"${e.symbol || ''}"`,
        `"${e.action || ''}"`,
        e.price || 0,
        e.amount || 0,
        (e.computedFeeBUY || 0).toFixed(4),
        (e.computedFeeSELL || 0).toFixed(4),
        (e.computedFeeTotal || 0).toFixed(4),
        (e.computedPnLBrut || 0).toFixed(2),
        (e.computedPnLNet || 0).toFixed(2),
        (e.computedEquity || 0).toFixed(2),
        (e.computedSessionPnLPercent || 0).toFixed(2),
        (e.computedPeakEquity || 0).toFixed(2),
        (e.computedDrawdownPercent || 0).toFixed(2),
        e.tradeQualityScore || 0,
        `"${e.tradeGrade || 'B'}"`,
        `"${(e.modelName || '').replace(/"/g, '""')}"`,
        `"${(e.entryReason || '').replace(/"/g, '""')}"`,
        `"${e.mode || 'paper'}"`,
        `"${(e.notes || '').replace(/"/g, '""')}"`
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = '\uFEFF' + csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Trading_Journal_NetPnL_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJSON = () => {
    const exportData = {
      exportedAt: new Date().toISOString(),
      totalEntries: allDisplayEntries.length,
      totalSnapshots: snapshots.length,
      analytics,
      entries: allDisplayEntries,
      snapshots
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Trading_Journal_Backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const fetchData = async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    try {
      const [entriesData, snapshotsData, analyticsData] = await Promise.all([
        safeJsonFetch<{ success: boolean; entries: JournalEntry[] }>('/api/journal/entries', undefined, { success: false, entries: [] }),
        safeJsonFetch<{ success: boolean; snapshots: DailySnapshot[] }>('/api/journal/daily-snapshots', undefined, { success: false, snapshots: [] }),
        safeJsonFetch<{ success: boolean; analytics: JournalAnalytics }>('/api/journal/analytics', undefined, { success: false, analytics: null as any })
      ]);

      if (entriesData && entriesData.success && Array.isArray(entriesData.entries)) {
        setEntries(entriesData.entries);
      }
      if (snapshotsData && snapshotsData.success && Array.isArray(snapshotsData.snapshots)) {
        setSnapshots(snapshotsData.snapshots);
      }
      if (analyticsData && analyticsData.success && analyticsData.analytics) {
        setAnalytics(analyticsData.analytics);
      }
    } catch (err: any) {
      // Graceful fallback to existing state if network is reconnecting
      console.warn('Journal data fetch notice:', err?.message || err);
    } finally {
      if (!isSilent) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData(false);
    const timer = setInterval(() => {
      fetchData(true);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  const handleClearSnapshots = async () => {
    if (!window.confirm('Ești sigur că vrei să ștergi toate rapoartele zilnice și istoricul evoluției equity?')) return;
    try {
      const res = await apiFetch('/api/journal/clear-snapshots', { method: 'POST' });
      const data = await safeJson(res, { success: false });
      if (data && data.success) {
        setSnapshots([]);
      }
    } catch (err) {
      console.error('Eroare la ștergerea rapoartelor zilnice:', err);
    }
  };

  const handleClearEntries = async () => {
    if (!window.confirm('Ești sigur că vrei să ștergi toate înregistrările din jurnalul de tranzacții?')) return;
    try {
      const res = await apiFetch('/api/journal/clear-entries', { method: 'POST' });
      const data = await safeJson(res, { success: false });
      if (data && data.success) {
        setEntries([]);
        useTradingStore.setState({ tradeHistory: [] });
      }
    } catch (err) {
      console.error('Eroare la ștergerea jurnalului:', err);
    }
  };

  const handleDeleteSingleEntry = async (entry: JournalEntry) => {
    if (!window.confirm(`Ștergi tranzacția ${entry.symbol} (${entry.action}) din ${formatInTimezone(entry.timestamp || new Date().toISOString(), timezone || 'Europe/Bucharest')}?`)) return;
    try {
      const res = await apiFetch('/api/journal/delete-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: entry.id, symbol: entry.symbol, timestamp: entry.timestamp })
      });
      const data = await safeJson(res, { success: false });
      if (data && data.success) {
        setEntries((prev) => prev.filter((e) => e.id !== entry.id));
        if (tradeHistory && Array.isArray(tradeHistory)) {
          const updatedHistory = tradeHistory.filter((t, idx) => {
            const tId = `store_trade_${idx}_${t.symbol}`;
            if (entry.id && (tId === entry.id || t.id === entry.id)) return false;
            if (entry.symbol && entry.timestamp && t.symbol === entry.symbol && t.timestamp === entry.timestamp) return false;
            return true;
          });
          useTradingStore.setState({ tradeHistory: updatedHistory });
        }
      }
    } catch (err) {
      console.error('Eroare la ștergerea tranzacției:', err);
    }
  };

  // Merge server journal entries, tradeHistory, and gridHistory from Smart AI Grid with strict deduplication
  const allDisplayEntries = useMemo(() => {
    // 1. Deduplicate base entries from server
    const baseEntries: JournalEntry[] = [];
    (entries || []).forEach(item => {
      if (!item || !item.symbol) return;
      const isDup = baseEntries.some(e => {
        if (item.id && e.id && item.id === e.id) return true;
        const timeDiff = Math.abs(new Date(item.timestamp).getTime() - new Date(e.timestamp).getTime());
        const sameSymbol = item.symbol.toUpperCase() === e.symbol.toUpperCase();
        const sameAction = item.action === e.action;
        const samePrice = Math.abs((item.price || 0) - (e.price || 0)) < 0.00001;
        const sameAmount = Math.abs((item.amount || 0) - (e.amount || 0)) < 0.0001;
        return sameSymbol && sameAction && samePrice && sameAmount && (timeDiff < 15000 || isNaN(timeDiff));
      });
      if (!isDup) baseEntries.push(item);
    });

    const combined = [...baseEntries];

    // 2. Merge tradeHistory safely without generating duplicate entries
    if (tradeHistory && Array.isArray(tradeHistory)) {
      tradeHistory.forEach((t, idx) => {
        if (!t || !t.symbol) return;
        const tExitPrice = (t.exitPrice && t.exitPrice > 0)
          ? t.exitPrice
          : ((t.price && t.price > 0) ? t.price : (t.entryPrice || 0));
        const tTimeMs = new Date(t.timestamp).getTime();

        const alreadyInBase = baseEntries.some(e => {
          if (e.symbol.toUpperCase() !== t.symbol.toUpperCase()) return false;
          if (e.action === 'SELL') {
            const timeDiff = Math.abs(new Date(e.timestamp).getTime() - tTimeMs);
            const priceMatch = Math.abs((e.price || 0) - tExitPrice) < 0.0001;
            const pnlMatch = Math.abs((e.pnl || 0) - (t.pnl || 0)) < 0.001;
            if (timeDiff < 30000 || (priceMatch && pnlMatch)) return true;
          }
          return false;
        });

        if (!alreadyInBase) {
          const amt = t.amount || 0;
          const calculatedFee = t.fee || (tExitPrice * amt * 0.00075);
          combined.push({
            id: `store_trade_${idx}_${t.symbol}_${t.timestamp}`,
            symbol: t.symbol || 'USDT',
            action: 'SELL' as const,
            price: tExitPrice,
            amount: amt,
            fee: calculatedFee,
            pnl: t.pnl || 0,
            pnlPercent: t.pnlPercent || 0,
            mlProbability: 78,
            modelName: 'Random Forest Ensemble 2.0',
            entryReason: `Tranzacție Închisă (PnL: ${t.pnlPercent >= 0 ? '+' : ''}${(t.pnlPercent || 0).toFixed(2)}%)`,
            mode: (binanceMode || 'paper') as any,
            timestamp: t.timestamp || new Date().toISOString(),
            date: (t.timestamp || new Date().toISOString()).split('T')[0],
            notes: `Ordin închis de server`,
            tradeGrade: (t as any).tradeGrade || 'A',
            tradeQualityScore: (t as any).tradeQualityScore || 85,
            stars: (t as any).stars || 5
          });
        }
      });
    }


    return combined.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [entries, tradeHistory, binanceMode]);

  const uniqueSymbols = useMemo(() => {
    const symbols = new Set(allDisplayEntries.map(e => e?.symbol).filter(Boolean));
    return ['ALL', ...Array.from(symbols)];
  }, [allDisplayEntries]);

  const uniqueModels = useMemo(() => {
    const models = new Set(allDisplayEntries.map(e => e?.modelName).filter(Boolean));
    return ['ALL', ...Array.from(models)];
  }, [allDisplayEntries]);

  // Chronological calculation of Fee BUY, Fee SELL, Fee Total, PnL Brut, PnL Net, Equity, Session PnL %, Peak Equity, Drawdown %
  const processedEntries = useMemo(() => {
    if (!allDisplayEntries || allDisplayEntries.length === 0) return [];

    // Sort ascending by time for sequential equity tracking
    const chronological = [...allDisplayEntries].sort(
      (a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime()
    );

    let runningEquity = initialEquity;
    let peakEquity = initialEquity;

    const lastBuyFeesBySymbol: Record<string, number> = {};

    return chronological.map((e) => {
      const isBuy = e.action === 'BUY';
      const sym = (e.symbol || 'USDT').toUpperCase();

      let feeBUY = 0;
      let feeSELL = 0;
      let pnlBrut = 0;

      const effPrice = (e.price && e.price > 0)
        ? e.price
        : ((e as any).exitPrice || (e as any).entryPrice || 0);
      const amt = e.amount || 0;

      if (isBuy) {
        feeBUY = e.fee > 0 ? e.fee : (effPrice * amt * 0.00075);
        feeSELL = 0;
        pnlBrut = 0;
        lastBuyFeesBySymbol[sym] = feeBUY;
      } else {
        // SELL action
        feeSELL = e.fee > 0 ? e.fee : (effPrice * amt * 0.00075);

        if ((e as any).buyFee !== undefined && (e as any).buyFee > 0) {
          feeBUY = (e as any).buyFee;
        } else if ((e as any).entryPrice && (e as any).entryPrice > 0) {
          feeBUY = (e as any).entryPrice * amt * 0.00075;
        } else if (lastBuyFeesBySymbol[sym] !== undefined && lastBuyFeesBySymbol[sym] > 0) {
          feeBUY = lastBuyFeesBySymbol[sym];
        } else {
          feeBUY = feeSELL > 0 ? feeSELL : (effPrice * amt * 0.00075);
        }

        pnlBrut = e.pnl !== undefined ? e.pnl : 0;
      }

      const feeTotal = feeBUY + feeSELL;

      // PnL Net = PnL Brut - Fee Total
      const pnlNet = isBuy ? -feeBUY : (pnlBrut - feeTotal);

      const hadPrecedingBuy = isBuy ? false : (lastBuyFeesBySymbol[sym] !== undefined || Boolean((e as any).entryPrice));
      const equityDelta = isBuy ? -feeBUY : (hadPrecedingBuy ? (pnlBrut - feeSELL) : pnlNet);

      runningEquity = runningEquity + equityDelta;

      const sessionPnLPercent = initialEquity > 0 ? ((runningEquity - initialEquity) / initialEquity) * 100 : 0;
      peakEquity = Math.max(peakEquity, runningEquity);
      const drawdownPercent = peakEquity > 0 ? ((peakEquity - runningEquity) / peakEquity) * 100 : 0;

      return {
        ...e,
        computedFeeBUY: feeBUY,
        computedFeeSELL: feeSELL,
        computedFeeTotal: feeTotal,
        computedPnLBrut: pnlBrut,
        computedPnLNet: pnlNet,
        computedEquity: runningEquity,
        computedSessionPnLPercent: sessionPnLPercent,
        computedPeakEquity: peakEquity,
        computedDrawdownPercent: drawdownPercent
      };
    });
  }, [allDisplayEntries, initialEquity]);

  // Session Summary KPI Statistics
  const summarySessionStats = useMemo(() => {
    const count = processedEntries.length;
    const closed = processedEntries.filter(e => e.action === 'SELL');
    const currentEquity = processedEntries.length > 0 ? processedEntries[processedEntries.length - 1].computedEquity : initialEquity;
    const currentPeakEquity = processedEntries.length > 0 ? Math.max(...processedEntries.map(e => e.computedPeakEquity)) : initialEquity;

    const totalPnLBrut = closed.reduce((acc, e) => acc + (e.computedPnLBrut || 0), 0);
    const totalFeeBUY = processedEntries.reduce((acc, e) => acc + (e.computedFeeBUY || 0), 0);
    const totalFeeSELL = processedEntries.reduce((acc, e) => acc + (e.computedFeeSELL || 0), 0);
    const totalFeeTotal = totalFeeBUY + totalFeeSELL;

    const sessionNetPnL = currentEquity - initialEquity;
    const sessionNetPnLPercent = initialEquity > 0 ? (sessionNetPnL / initialEquity) * 100 : 0;

    const targetProfitUsdt = (initialEquity * sessionTargetPct) / 100;
    const targetProgressPercent = targetProfitUsdt > 0 ? Math.min(100, Math.max(0, (sessionNetPnL / targetProfitUsdt) * 100)) : 0;
    const isTargetAchieved = sessionNetPnL >= targetProfitUsdt && targetProfitUsdt > 0;

    const maxDrawdownPercent = currentPeakEquity > 0 ? Math.max(0, ...processedEntries.map(e => e.computedDrawdownPercent)) : 0;

    return {
      count,
      closedCount: closed.length,
      initialEquity,
      currentEquity,
      currentPeakEquity,
      totalPnLBrut,
      totalFeeBUY,
      totalFeeSELL,
      totalFeeTotal,
      sessionNetPnL,
      sessionNetPnLPercent,
      targetProfitUsdt,
      targetProgressPercent,
      isTargetAchieved,
      sessionTargetPct,
      maxDrawdownPercent
    };
  }, [processedEntries, initialEquity, sessionTargetPct]);

  const filteredEntries = useMemo(() => {
    return processedEntries.filter(e => {
      if (!e) return false;
      if (selectedSymbol !== 'ALL' && e.symbol !== selectedSymbol) return false;
      if (selectedModel !== 'ALL' && e.modelName !== selectedModel) return false;
      if (selectedAction !== 'ALL' && e.action !== selectedAction) return false;
      if (selectedMode !== 'ALL' && e.mode !== selectedMode) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchSymbol = (e.symbol || '').toLowerCase().includes(q);
        const matchReason = (e.entryReason || '').toLowerCase().includes(q);
        const matchModel = (e.modelName || '').toLowerCase().includes(q);
        const matchNotes = (e.notes || '').toLowerCase().includes(q);
        if (!matchSymbol && !matchReason && !matchModel && !matchNotes) return false;
      }
      return true;
    });
  }, [processedEntries, selectedSymbol, selectedModel, selectedAction, selectedMode, searchQuery]);

  const sortedFilteredEntries = useMemo(() => {
    const list = [...filteredEntries];
    if (sortBy === 'pnl') {
      list.sort((a, b) => {
        const pnlA = a.computedPnLNet !== undefined ? a.computedPnLNet : (a.pnl || 0);
        const pnlB = b.computedPnLNet !== undefined ? b.computedPnLNet : (a.pnl || 0);
        if (pnlB !== pnlA) return pnlB - pnlA;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });
    } else {
      list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    return list;
  }, [filteredEntries, sortBy]);

  const getYDomain = useMemo(() => {
    return ([dataMin, dataMax]: [number, number]): [number, number] => {
      if (!Number.isFinite(dataMin) || !Number.isFinite(dataMax)) {
        return [0, 100];
      }
      const min = Number(dataMin.toFixed(2));
      const max = Number(dataMax.toFixed(2));
      if (min === max) {
        const pad = min === 0 ? 10 : Math.abs(min) * 0.05;
        return [Number((min - pad).toFixed(2)), Number((max + pad).toFixed(2))];
      }
      const range = max - min;
      if (range < 0.01) {
        return [Number((min - 1).toFixed(2)), Number((max + 1).toFixed(2))];
      }
      const pad = range * 0.05;
      return [Number((min - pad).toFixed(2)), Number((max + pad).toFixed(2))];
    };
  }, []);

  const snapshotChartData = useMemo(() => {
    if (!snapshots || snapshots.length === 0) return [];
    return [...snapshots].reverse().map((s, index) => ({
      date: s.date ? s.date.substring(5) : `D-${index}`,
      equity: Number(Number(s.equity || 0).toFixed(2)),
      realizedPnL: Number(Number(s.realizedPnL || 0).toFixed(2)),
      winRate: Number(Number(s.winRate || 0).toFixed(2))
    }));
  }, [snapshots]);

  const gradeStats = useMemo(() => {
    const closed = allDisplayEntries.filter(e => e.action === 'SELL');

    const getScore = (e: JournalEntry): number => {
      if (e.tradeQualityScore !== undefined && e.tradeQualityScore > 0) {
        return e.tradeQualityScore;
      }
      if (e.tradeGrade === 'A+') return 93.5;
      if (e.tradeGrade === 'A') return 85.5;
      if (e.tradeGrade === 'B') return 78.5;
      if (e.tradeGrade === 'C') return 71.5;
      if (e.tradeGrade === 'D' || e.tradeGrade === 'F') return 52.0;
      return Math.min(100, Math.max(10, (e.mlProbability || 75) * 0.9 + (e.pnlPercent && e.pnlPercent > 0 ? 15 : 0)));
    };

    const calcBracket = (
      list: JournalEntry[],
      label: string,
      range: string,
      grade: string,
      stars: number,
      theme: 'emerald' | 'sky' | 'indigo' | 'amber' | 'rose'
    ) => {
      const count = list.length;
      if (count === 0) {
        return {
          label,
          range,
          grade,
          stars,
          theme,
          count: 0,
          wins: 0,
          losses: 0,
          winRate: 0,
          grossProfit: 0,
          grossLoss: 0,
          totalPnL: 0,
          avgWin: 0,
          avgWinPercent: 0,
          avgLoss: 0,
          avgLossPercent: 0,
          profitFactor: 0,
          expectancy: 0,
          expectancyPercent: 0,
          maxDrawdownPercent: 0
        };
      }

      const winsList = list.filter(e => (e.pnl || 0) > 0);
      const lossesList = list.filter(e => (e.pnl || 0) <= 0);
      const wins = winsList.length;
      const losses = lossesList.length;

      const winRate = parseFloat(((wins / count) * 100).toFixed(1));

      const grossProfit = winsList.reduce((acc, e) => acc + (e.pnl || 0), 0);
      const grossLoss = Math.abs(lossesList.reduce((acc, e) => acc + (e.pnl || 0), 0));
      const totalPnL = list.reduce((acc, e) => acc + (e.pnl || 0), 0);

      const avgWin = wins > 0 ? grossProfit / wins : 0;
      const avgWinPercent = wins > 0 ? (winsList.reduce((acc, e) => acc + (e.pnlPercent || 0), 0) / wins) : 0;

      const avgLoss = losses > 0 ? grossLoss / losses : 0;
      const avgLossPercent = losses > 0 ? (lossesList.reduce((acc, e) => acc + Math.abs(e.pnlPercent || 0), 0) / losses) : 0;

      let profitFactor = 0;
      if (grossLoss > 0) {
        profitFactor = parseFloat((grossProfit / grossLoss).toFixed(2));
      } else if (grossProfit > 0) {
        profitFactor = 99.9;
      }

      const expectancy = parseFloat((totalPnL / count).toFixed(2));
      const expectancyPercent = parseFloat((list.reduce((acc, e) => acc + (e.pnlPercent || 0), 0) / count).toFixed(2));

      // Max Drawdown in bracket sequence
      let cumPnLPercent = 0;
      let peak = 0;
      let maxDD = 0;
      const sorted = [...list].sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());
      for (const tr of sorted) {
        cumPnLPercent += (tr.pnlPercent || 0);
        if (cumPnLPercent > peak) peak = cumPnLPercent;
        const dd = peak - cumPnLPercent;
        if (dd > maxDD) maxDD = dd;
      }

      return {
        label,
        range,
        grade,
        stars,
        theme,
        count,
        wins,
        losses,
        winRate,
        grossProfit,
        grossLoss,
        totalPnL,
        avgWin,
        avgWinPercent,
        avgLoss,
        avgLossPercent,
        profitFactor,
        expectancy,
        expectancyPercent,
        maxDrawdownPercent: parseFloat(maxDD.toFixed(1))
      };
    };

    const b90 = closed.filter(e => getScore(e) >= 90);
    const b82 = closed.filter(e => getScore(e) >= 82 && getScore(e) < 90);
    const b76 = closed.filter(e => getScore(e) >= 76 && getScore(e) < 82);
    const b68 = closed.filter(e => getScore(e) >= 68 && getScore(e) < 76);
    const bUnder68 = closed.filter(e => getScore(e) < 68);

    return {
      brackets: [
        calcBracket(b90, 'Scor 90-100', '90-100', 'A+', 5, 'emerald'),
        calcBracket(b82, 'Scor 82-89.9', '82-89.9', 'A', 5, 'sky'),
        calcBracket(b76, 'Scor 76-81.9', '76-81.9', 'B', 4, 'indigo'),
        calcBracket(b68, 'Scor 68-75.9', '68-75.9', 'C', 3, 'amber'),
        calcBracket(bUnder68, 'Scor < 68', '< 68', 'F', 2, 'rose'),
      ]
    };
  }, [allDisplayEntries]);

  return (
    <div className="h-full w-full bg-black overflow-y-auto p-3 sm:p-6 md:p-8 space-y-4 sm:space-y-6 pb-28">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/5 pb-4 sm:pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <BookOpen size={22} />
            </div>
            <div>
              <h1 className="font-serif text-2xl text-white">Jurnal de Tranzacționare AI</h1>
              <p className="text-xs text-zinc-400 mt-0.5">
                Istoric automatizat al ordinelor, comisioanelor și atribuirii modelelor ML
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-all text-xs font-semibold shadow-sm cursor-pointer"
          >
            <PlusCircle size={15} />
            Adaugă / Salvează Tranzacție
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-900 border border-white/10 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors text-xs font-medium cursor-pointer"
            title="Exportă tranzacțiile afișate în format CSV"
          >
            <FileText size={15} className="text-emerald-400" />
            CSV Export
          </button>

          <button
            onClick={handleExportJSON}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-900 border border-white/10 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors text-xs font-medium cursor-pointer"
            title="Exportă backup complet JSON"
          >
            <Download size={15} className="text-indigo-400" />
            Backup JSON
          </button>

          <button
            onClick={() => fetchData(false)}
            disabled={isLoading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-900 border border-white/10 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors text-xs font-medium cursor-pointer"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin text-emerald-400" : ""} />
            Actualizează Datele
          </button>
        </div>
      </div>

      {/* KPI Cards: Equity & Session Profit Target & Fees & Vault */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Capital & Equity Sesiune */}
        <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-4 md:p-5">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Equity Curent (Sesiune)</span>
            <DollarSign size={16} className={summarySessionStats.sessionNetPnL >= 0 ? "text-emerald-400" : "text-rose-400"} />
          </div>
          <div className="text-2xl font-serif text-white font-mono font-bold">
            ${summarySessionStats.currentEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5 text-[11px] font-mono">
            <span className="text-zinc-500">Equity Inițial: ${summarySessionStats.initialEquity.toLocaleString()}</span>
            <span className={summarySessionStats.sessionNetPnL >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
              {summarySessionStats.sessionNetPnL >= 0 ? '+' : ''}${summarySessionStats.sessionNetPnL.toFixed(2)} ({summarySessionStats.sessionNetPnLPercent >= 0 ? '+' : ''}{summarySessionStats.sessionNetPnLPercent.toFixed(2)}%)
            </span>
          </div>
        </div>

        {/* Card Vault: Sold "Acumulare" (Profit Conservat 3%) */}
        <div className="bg-gradient-to-b from-amber-950/40 to-zinc-900/60 border border-amber-500/30 rounded-2xl p-4 md:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-amber-300 mb-1">
              <span className="text-xs font-semibold uppercase tracking-wider">Sold "Acumulare"</span>
              <div className="flex flex-col items-end gap-1">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
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
                        className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-mono font-bold text-[10px] shadow transition-all cursor-pointer"
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
                      className="px-2 py-0.5 rounded bg-amber-500/10 hover:bg-rose-500/20 text-amber-300 hover:text-rose-300 border border-amber-500/30 hover:border-rose-500/40 text-[10px] font-mono font-semibold transition-all cursor-pointer"
                      title="Resetează Soldul Acumulare la $0.00"
                    >
                      Reset
                    </button>
                  )
                )}
              </div>
            </div>
            <div className="text-2xl font-serif text-amber-300 font-mono font-bold">
              ${accumulationBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-amber-500/20 text-[11px] font-mono text-amber-400/90">
            <span>Profit Salvat:</span>
            <button
              onClick={() => consolidateAccumulation && consolidateAccumulation()}
              className="px-2 py-0.5 rounded bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-[10px] transition-all cursor-pointer"
              title="Extras profitul curent în balanța Acumulare și resetare ciclu"
            >
              🔒 Consolidează +{summarySessionStats.sessionNetPnLPercent.toFixed(1)}%
            </button>
          </div>
        </div>

        {/* Card 2: Target Profit Sesiune */}
        <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-4 md:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-zinc-400 mb-1">
              <span className="text-xs font-medium uppercase tracking-wider">Session Profit Target</span>
              <Award size={16} className={summarySessionStats.isTargetAchieved ? "text-emerald-400 animate-pulse" : "text-indigo-400"} />
            </div>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-lg font-serif font-bold text-indigo-300 font-mono">
                +{summarySessionStats.sessionTargetPct}% <span className="text-xs font-sans text-zinc-400">(${summarySessionStats.targetProfitUsdt.toFixed(2)})</span>
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase font-mono ${
                summarySessionStats.isTargetAchieved
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                  : "bg-indigo-500/10 text-indigo-300 border border-indigo-500/20"
              }`}>
                {summarySessionStats.isTargetAchieved ? '🎯 Target Atins!' : `${summarySessionStats.targetProgressPercent.toFixed(0)}% Progres`}
              </span>
            </div>

            {/* Target Progress Bar */}
            <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden mb-2">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  summarySessionStats.isTargetAchieved ? 'bg-emerald-400 shadow-lg shadow-emerald-500/50' : 'bg-indigo-500'
                }`}
                style={{ width: `${summarySessionStats.targetProgressPercent}%` }}
              />
            </div>
          </div>

          {/* Target Preset Selector Buttons */}
          <div className="flex items-center gap-1.5 pt-1.5 border-t border-white/5 text-[10px]">
            <span className="text-zinc-500">Setează Target:</span>
            {[1, 2, 3, 5, 10].map((pct) => (
              <button
                key={pct}
                onClick={() => handleSessionTargetChange(pct)}
                className={`px-1.5 py-0.5 rounded font-mono font-medium transition-colors cursor-pointer ${
                  sessionTargetPct === pct
                    ? 'bg-indigo-500 text-white font-bold'
                    : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700'
                }`}
              >
                +{pct}%
              </button>
            ))}
          </div>
        </div>

        {/* Card 3: Comisioane Defalcate (Fee BUY, Fee SELL, Fee Total) */}
        <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-4 md:p-5">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Comisioane Totale</span>
            <Zap size={16} className="text-amber-400" />
          </div>
          <div className="text-2xl font-serif text-amber-300 font-mono font-bold">
            ${summarySessionStats.totalFeeTotal.toFixed(4)}
          </div>
          <div className="grid grid-cols-2 gap-1 mt-2 pt-2 border-t border-white/5 text-[10px] font-mono text-zinc-400">
            <div>Fee BUY: <span className="text-amber-400">${summarySessionStats.totalFeeBUY.toFixed(4)}</span></div>
            <div>Fee SELL: <span className="text-amber-400">${summarySessionStats.totalFeeSELL.toFixed(4)}</span></div>
          </div>
        </div>

        {/* Card 4: Peak Equity & Drawdown Max */}
        <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-4 md:p-5">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Peak Equity & Drawdown</span>
            <Percent size={16} className="text-rose-400" />
          </div>
          <div className="text-2xl font-serif text-indigo-300 font-mono font-bold">
            ${summarySessionStats.currentPeakEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5 text-[11px] font-mono">
            <span className="text-zinc-500">Max Drawdown:</span>
            <span className="text-rose-400 font-bold">-{summarySessionStats.maxDrawdownPercent.toFixed(2)}%</span>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-2">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('entries')}
            className={`px-4 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'entries'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            }`}
          >
            <BookOpen size={14} />
            Istoric Ordine & Tranzacții ({filteredEntries.length})
          </button>

          <button
            onClick={() => setActiveTab('models')}
            className={`px-4 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'models'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            }`}
          >
            <Cpu size={14} />
            Performanță pe Modele ML & Strategii
          </button>

          <button
            onClick={() => setActiveTab('snapshots')}
            className={`px-4 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2 shrink-0 cursor-pointer ${
              activeTab === 'snapshots'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
            }`}
          >
            <Calendar size={14} />
            Rapoarte Zilnice & Evoluție Equity ({snapshots.length})
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            onClick={handleClearEntries}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-medium transition-all cursor-pointer shadow-sm"
            title="Șterge definitiv toate ordinele și tranzacțiile din jurnal"
          >
            <Trash2 size={13} />
            Șterge Toate Tranzacțiile
          </button>

          <button
            onClick={handleClearSnapshots}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-medium transition-all cursor-pointer shadow-sm"
            title="Șterge definitiv rapoartele zilnice și graficul equity"
          >
            <Trash2 size={13} />
            Șterge Rapoarte & Equity
          </button>
        </div>
      </div>

      {/* TAB 1: ENTRIES LIST */}
      {activeTab === 'entries' && (
        <div className="space-y-6">
          {/* Trade Grade Quality Analysis Banner */}
          <div className="bg-gradient-to-r from-zinc-900/95 via-zinc-900/60 to-indigo-950/40 border border-indigo-500/20 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="font-serif text-base text-white">Analiză Performanță pe Interval de Scor de Calitate (Trade Quality Score 0-100)</h3>
                  <p className="text-xs text-zinc-400">Meta-analiză AI: Relația dintre Scorul de Calitate (0-100) și Profit Factor, Win Rate, Expectancy și Risk:Reward</p>
                </div>
              </div>
              <span className="text-[10px] font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-3 py-1 rounded-full">
                AI Meta-Model Benchmark
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {gradeStats.brackets.map((b, idx) => {
                let borderClass = 'border-emerald-500/30 bg-emerald-950/10';
                let headerTextClass = 'text-emerald-300';
                let pfColor = 'text-emerald-400';
                if (b.theme === 'sky') {
                  borderClass = 'border-sky-500/30 bg-sky-950/10';
                  headerTextClass = 'text-sky-300';
                  pfColor = 'text-sky-400';
                } else if (b.theme === 'indigo') {
                  borderClass = 'border-indigo-500/30 bg-indigo-950/10';
                  headerTextClass = 'text-indigo-300';
                  pfColor = 'text-indigo-400';
                } else if (b.theme === 'amber') {
                  borderClass = 'border-amber-500/30 bg-amber-950/10';
                  headerTextClass = 'text-amber-300';
                  pfColor = 'text-amber-400';
                } else if (b.theme === 'rose') {
                  borderClass = 'border-rose-500/30 bg-rose-950/10';
                  headerTextClass = 'text-rose-300';
                  pfColor = 'text-rose-400';
                }

                return (
                  <div key={idx} className={`p-3.5 rounded-xl border ${borderClass} bg-zinc-950/80 flex flex-col justify-between space-y-2.5`}>
                    <div>
                      {/* Top Header: Grade & Range */}
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`text-xs font-bold ${headerTextClass} flex items-center gap-1.5`}>
                          <span>Grad {b.grade}</span>
                          <span className="text-[9px] text-amber-400 tracking-tighter">
                            {'★'.repeat(b.stars)}{'☆'.repeat(5 - b.stars)}
                          </span>
                        </span>
                        <span className="text-[10px] font-mono text-zinc-400 bg-zinc-900 px-1.5 py-0.5 rounded border border-white/5">
                          {b.range}
                        </span>
                      </div>

                      {/* Metric 1: Win Rate & Trades */}
                      <div className="flex items-baseline justify-between mb-2">
                        <span className="text-lg font-mono font-extrabold text-white">
                          {b.winRate}% <span className="text-[10px] font-normal text-zinc-400">WinRate</span>
                        </span>
                        <span className="text-[11px] font-mono text-zinc-400">{b.count} tranz.</span>
                      </div>

                      {/* Metric 2: Profit Factor */}
                      <div className="bg-zinc-900/80 p-2 rounded-lg border border-white/5 space-y-1 text-[11px] mb-2">
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-400">Profit Factor:</span>
                          <span className={`font-mono font-bold text-xs ${pfColor}`}>
                            {b.profitFactor >= 99 ? '∞ (Ideal)' : b.profitFactor.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-zinc-400">Expectancy:</span>
                          <span className={`font-mono font-semibold ${b.expectancy >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {b.expectancy >= 0 ? '+' : ''}${b.expectancy.toFixed(2)} ({b.expectancyPercent >= 0 ? '+' : ''}{b.expectancyPercent.toFixed(1)}%)
                          </span>
                        </div>
                      </div>

                      {/* Metric 3: Avg Win vs Avg Loss */}
                      <div className="space-y-1 text-[10px] text-zinc-400 font-mono">
                        <div className="flex justify-between items-center">
                          <span>Avg Win:</span>
                          <span className="text-emerald-400 font-medium">+${b.avgWin.toFixed(2)} (+{b.avgWinPercent.toFixed(1)}%)</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span>Avg Loss:</span>
                          <span className="text-rose-400 font-medium">-${b.avgLoss.toFixed(2)} (-{b.avgLossPercent.toFixed(1)}%)</span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom: Max Drawdown */}
                    <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] font-mono text-zinc-400">
                      <span>Max Drawdown:</span>
                      <span className="text-rose-400 font-semibold">-{b.maxDrawdownPercent.toFixed(1)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Collapsible Journal Table Section */}
          <div className="bg-zinc-900/40 border border-white/5 rounded-2xl overflow-hidden shadow-xl transition-all">
            {/* Header / Collapse Bar */}
            <div 
              onClick={() => setIsTableCollapsed(!isTableCollapsed)}
              className="p-4 bg-zinc-900/80 border-b border-white/5 flex items-center justify-between cursor-pointer hover:bg-zinc-800/60 transition-colors select-none flex-wrap gap-3"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-white flex items-center gap-2 flex-wrap">
                    Tabel Tranzacții & Istoric Execuții ({sortedFilteredEntries.length})
                    {isTableCollapsed ? (
                      <span className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                        Colapsat (Apasă pentru deschidere)
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2.5 py-0.5 rounded-full">
                        Scrolabil (Max 10 rânduri vizibile)
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {isTableCollapsed 
                      ? "Ordonat implicit după mărimea câștigului (PnL descrescător). Apasă pentru a vizualiza lista." 
                      : `Tabel scrolabil de maxim 10 rânduri. Derulați pentru a vedea toate cele ${sortedFilteredEntries.length} tranzacții sau folosiți filtrele de căutare.`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {!isTableCollapsed && (
                  <div className="flex items-center gap-2 bg-zinc-950 border border-white/10 rounded-xl px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
                    <span className="text-xs text-zinc-400 font-medium">Ordonare:</span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as 'pnl' | 'date')}
                      className="bg-black text-xs text-emerald-400 font-mono font-bold focus:outline-none cursor-pointer border border-emerald-500/30 rounded px-2 py-0.5"
                    >
                      <option value="pnl">💰 Mărime Câștig (PnL Descrescător)</option>
                      <option value="date">🕒 Dată & Oră (Cele mai recente)</option>
                    </select>
                  </div>
                )}

                <button 
                  className="p-2 bg-zinc-800 text-zinc-300 hover:text-white rounded-xl border border-white/10 flex items-center justify-center transition-transform"
                  title={isTableCollapsed ? "Extinde tabelul" : "Colapsează tabelul"}
                >
                  <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${isTableCollapsed ? '' : 'rotate-180'}`} />
                </button>
              </div>
            </div>

            {/* Collapsed State Box */}
            {isTableCollapsed ? (
              <div 
                onClick={() => setIsTableCollapsed(false)}
                className="p-8 bg-zinc-950/40 text-center flex flex-col items-center justify-center gap-3 cursor-pointer hover:bg-zinc-900/30 transition-colors border-t border-white/5"
              >
                <div className="flex items-center gap-2 text-xs text-zinc-300 font-mono">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <span>Tabelul cu tranzacții este colapsat. Apasă pentru deschidere ({sortedFilteredEntries.length} tranzacții salvate).</span>
                </div>
                <button className="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer">
                  <BookOpen className="w-3.5 h-3.5" />
                  Afișează Tranzacțiile Ordonate după Profit (PnL)
                </button>
              </div>
            ) : (
              <div className="p-4 space-y-4">
                {/* Filters Bar */}
                <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-4 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
                  {/* Search */}
                  <div className="relative flex-1">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                      type="text"
                      placeholder="Caută după simbol, strategie sau model..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-zinc-950 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50"
                    />
                  </div>

                  {/* Select Dropdowns */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <select
                      value={selectedSymbol}
                      onChange={(e) => setSelectedSymbol(e.target.value)}
                      className="bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500/50"
                    >
                      <option value="ALL">Toate Simbolurile</option>
                      {uniqueSymbols.filter(s => s !== 'ALL').map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>

                    <select
                      value={selectedModel}
                      onChange={(e) => setSelectedModel(e.target.value)}
                      className="bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500/50"
                    >
                      <option value="ALL">Toate Modelele ML</option>
                      {uniqueModels.filter(m => m !== 'ALL').map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>

                    <select
                      value={selectedAction}
                      onChange={(e) => setSelectedAction(e.target.value)}
                      className="bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500/50"
                    >
                      <option value="ALL">BUY & SELL</option>
                      <option value="BUY">🟢 Doar BUY</option>
                      <option value="SELL">🔴 Doar SELL</option>
                    </select>

                    <select
                      value={selectedMode}
                      onChange={(e) => setSelectedMode(e.target.value)}
                      className="bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500/50"
                    >
                      <option value="ALL">Toate Modurile</option>
                      <option value="paper">Paper Trading</option>
                      <option value="testnet">Binance Testnet</option>
                      <option value="live">Binance Live</option>
                    </select>
                  </div>
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block bg-zinc-900/40 border border-white/5 rounded-2xl overflow-hidden shadow-lg">
                  <div className="max-h-[500px] overflow-auto border-t border-white/5">
                    <table className="w-full text-left text-xs">
                      <thead className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur-md text-zinc-400 font-mono text-[11px] uppercase border-b border-white/10 shadow-sm">
                        <tr>
                          <th className="px-3 py-2 whitespace-nowrap">Dată / Oră</th>
                          <th className="px-3 py-2 whitespace-nowrap">Simbol</th>
                          <th className="px-3 py-2 whitespace-nowrap">Tip</th>
                          <th className="px-3 py-2 text-right whitespace-nowrap">Preț</th>
                          <th className="px-3 py-2 text-right whitespace-nowrap">Cantitate</th>
                          <th className="px-3 py-2 text-right whitespace-nowrap text-amber-400/90">Fee BUY</th>
                          <th className="px-3 py-2 text-right whitespace-nowrap text-amber-400/90">Fee SELL</th>
                          <th className="px-3 py-2 text-right whitespace-nowrap text-amber-400/90">Fee Total</th>
                          <th className="px-3 py-2 text-right whitespace-nowrap">PnL Brut</th>
                          <th className="px-3 py-2 text-right whitespace-nowrap">PnL Net</th>
                          <th className="px-3 py-2 text-right whitespace-nowrap text-indigo-300">Equity</th>
                          <th className="px-3 py-2 text-right whitespace-nowrap">Session PnL %</th>
                          <th className="px-3 py-2 text-right whitespace-nowrap text-indigo-300">Peak Equity</th>
                          <th className="px-3 py-2 text-right whitespace-nowrap text-rose-400">Drawdown %</th>
                          <th className="px-3 py-2 whitespace-nowrap">Grad AI</th>
                          <th className="px-3 py-2 whitespace-nowrap">Prob ML</th>
                          <th className="px-3 py-2 whitespace-nowrap">Model</th>
                          <th className="px-3 py-2 max-w-[200px]">Motiv / Strategie</th>
                          <th className="px-3 py-2 text-center whitespace-nowrap">Acțiuni</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5 text-zinc-300">
                        {sortedFilteredEntries.length === 0 ? (
                          <tr>
                            <td colSpan={19} className="px-3 py-8 text-center text-zinc-500">
                              Nicio tranzacție găsită conform filtrelor selectate.
                            </td>
                          </tr>
                        ) : (
                          sortedFilteredEntries.map((e) => (
                            <tr key={e.id} className="hover:bg-white/[0.02] transition-colors">
                              <td className="px-3 py-2 font-mono text-zinc-400 whitespace-nowrap text-[11px]">
                                {formatInTimezone(e.timestamp || new Date().toISOString(), timezone || 'Europe/Bucharest')}
                              </td>

                              <td className="px-3 py-2 font-semibold text-white whitespace-nowrap text-xs">
                                {e.symbol || 'USDT'}
                              </td>

                              <td className="px-3 py-2 whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                  e.action === 'BUY'
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                }`}>
                                  {e.action || 'BUY'}
                                </span>
                              </td>

                              <td className="px-3 py-2 font-mono text-right whitespace-nowrap text-xs">
                                ${(e.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                              </td>

                              <td className="px-3 py-2 font-mono text-right whitespace-nowrap text-xs">
                                {e.amount || 0}
                              </td>

                              {/* Fee BUY */}
                              <td className="px-3 py-2 font-mono text-right text-amber-400 whitespace-nowrap text-xs font-semibold">
                                ${(e.computedFeeBUY || 0).toFixed(4)}
                              </td>

                              {/* Fee SELL */}
                              <td className="px-3 py-2 font-mono text-right text-amber-400 whitespace-nowrap text-xs font-semibold">
                                ${(e.computedFeeSELL || 0).toFixed(4)}
                              </td>

                              {/* Fee Total */}
                              <td className="px-3 py-2 font-mono text-right text-amber-300 whitespace-nowrap text-xs font-bold">
                                ${(e.computedFeeTotal || 0).toFixed(4)}
                              </td>

                              {/* PnL Brut */}
                              <td className="px-3 py-2 font-mono text-right whitespace-nowrap text-xs">
                                {e.action === 'SELL' ? (
                                  <span className={(e.computedPnLBrut || 0) >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                                    {(e.computedPnLBrut || 0) >= 0 ? '+' : ''}${(e.computedPnLBrut || 0).toFixed(2)}
                                  </span>
                                ) : (
                                  <span className="text-zinc-500">-</span>
                                )}
                              </td>

                              {/* PnL Net */}
                              <td className="px-3 py-2 font-mono text-right whitespace-nowrap text-xs font-bold">
                                {e.action === 'SELL' ? (
                                  <span className={(e.computedPnLNet || 0) >= 0 ? "text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20" : "text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded border border-rose-500/20"}>
                                    {(e.computedPnLNet || 0) >= 0 ? '+' : ''}${(e.computedPnLNet || 0).toFixed(2)}
                                  </span>
                                ) : (
                                  <span className="text-amber-400 text-[11px] font-normal">
                                    -${(e.computedFeeBUY || 0).toFixed(4)}
                                  </span>
                                )}
                              </td>

                              {/* Equity */}
                              <td className="px-3 py-2 font-mono text-right text-indigo-200 font-bold whitespace-nowrap text-xs">
                                ${(e.computedEquity || initialEquity).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>

                              {/* Session PnL % */}
                              <td className="px-3 py-2 font-mono text-right whitespace-nowrap text-xs font-bold">
                                <span className={(e.computedSessionPnLPercent || 0) >= 0 ? "text-emerald-400" : "text-rose-400"}>
                                  {(e.computedSessionPnLPercent || 0) >= 0 ? '+' : ''}${(e.computedSessionPnLPercent || 0).toFixed(2)}%
                                </span>
                              </td>

                              {/* Peak Equity */}
                              <td className="px-3 py-2 font-mono text-right text-indigo-300 whitespace-nowrap text-xs">
                                ${(e.computedPeakEquity || initialEquity).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>

                              {/* Drawdown % */}
                              <td className="px-3 py-2 font-mono text-right text-rose-400 font-semibold whitespace-nowrap text-xs">
                                -{(e.computedDrawdownPercent || 0).toFixed(2)}%
                              </td>

                              <td className="px-3 py-2 whitespace-nowrap">
                                <TradeGradeBadge grade={e.tradeGrade} score={e.tradeQualityScore} stars={e.stars} />
                              </td>

                              <td className="px-3 py-2 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <div className="w-10 bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                                    <div 
                                      className="bg-emerald-400 h-full rounded-full"
                                      style={{ width: `${Math.min(100, Math.max(0, e.mlProbability || 75))}%` }}
                                    />
                                  </div>
                                  <span className="font-mono text-emerald-400 font-semibold text-[10px]">
                                    {e.mlProbability || 75}%
                                  </span>
                                </div>
                              </td>

                              <td className="px-3 py-2 whitespace-nowrap">
                                <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-sans text-[10px] truncate max-w-[100px] inline-block">
                                  {e.modelName || 'Random Forest 2.0'}
                                </span>
                              </td>

                              <td className="px-3 py-2 text-zinc-300 max-w-[200px]">
                                <div className="text-[11px] text-zinc-200 font-medium truncate" title={e.entryReason || 'Semnal AI Strategy'}>
                                  {e.entryReason || 'Semnal AI Strategy'}
                                </div>
                                <MinuteProfitDisplay minuteLogs={e.minuteProfitLogs} notes={e.notes} />
                              </td>

                              <td className="px-3 py-2 text-center whitespace-nowrap">
                                <button
                                  onClick={() => handleDeleteSingleEntry(e)}
                                  className="p-1 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                                  title="Șterge tranzacția din jurnal"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Mobile Card List View */}
                <div className="block md:hidden max-h-[580px] overflow-y-auto pr-1 space-y-3">
                  {sortedFilteredEntries.length === 0 ? (
                    <div className="p-8 text-center text-zinc-500 bg-zinc-900/40 rounded-2xl border border-white/5">
                      Nicio tranzacție găsită.
                    </div>
                  ) : (
                    sortedFilteredEntries.map((e) => (
                      <div key={e.id} className="bg-zinc-900/50 border border-white/5 rounded-2xl p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                              e.action === 'BUY'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            }`}>
                              {e.action || 'BUY'}
                            </span>
                            <span className="font-semibold text-white text-sm">{e.symbol || 'USDT'}</span>
                          </div>

                          <div className="flex items-center gap-3">
                            <TradeGradeBadge grade={e.tradeGrade} score={e.tradeQualityScore} stars={e.stars} />
                            <span className="text-[11px] font-mono text-zinc-400">
                              {formatInTimezone(e.timestamp || new Date().toISOString(), timezone || 'Europe/Bucharest')}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-zinc-950/50 p-2.5 rounded-xl">
                          <div>
                            <span className="text-zinc-500 text-[10px] block">PREȚ EXECUȚIE</span>
                            <span className="text-zinc-200">${(e.price || 0).toLocaleString()}</span>
                          </div>
                          <div>
                            <span className="text-zinc-500 text-[10px] block">CANTITATE</span>
                            <span className="text-zinc-200">{e.amount || 0}</span>
                          </div>
                          <div>
                            <span className="text-amber-400 text-[10px] block">FEE BUY / SELL / TOT</span>
                            <span className="text-amber-300 font-bold">${(e.computedFeeBUY || 0).toFixed(2)} / ${(e.computedFeeSELL || 0).toFixed(2)} / ${(e.computedFeeTotal || 0).toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-zinc-500 text-[10px] block">PNL BRUT / NET</span>
                            {e.action === 'SELL' ? (
                              <span className={(e.computedPnLNet || 0) >= 0 ? "text-emerald-400 font-bold block" : "text-rose-400 font-bold block"}>
                                Brut: ${(e.computedPnLBrut || 0).toFixed(2)} | Net: {(e.computedPnLNet || 0) >= 0 ? '+' : ''}${(e.computedPnLNet || 0).toFixed(2)}
                              </span>
                            ) : (
                              <span className="text-amber-400 block text-[11px]">Net: -${(e.computedFeeBUY || 0).toFixed(2)}</span>
                            )}
                          </div>
                          <div>
                            <span className="text-indigo-300 text-[10px] block">EQUITY / PEAK</span>
                            <span className="text-indigo-200 font-bold">${(e.computedEquity || initialEquity).toLocaleString('en-US', { maximumFractionDigits: 0 })} / ${(e.computedPeakEquity || initialEquity).toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                          </div>
                          <div>
                            <span className="text-zinc-500 text-[10px] block">SESSION % / DD %</span>
                            <span className={(e.computedSessionPnLPercent || 0) >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                              {(e.computedSessionPnLPercent || 0) >= 0 ? '+' : ''}${(e.computedSessionPnLPercent || 0).toFixed(2)}% / -{(e.computedDrawdownPercent || 0).toFixed(2)}%
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5">
                          <span className="text-zinc-400">{e.modelName || 'Random Forest 2.0'}</span>
                          <span className="text-emerald-400 font-mono font-semibold">{e.mlProbability || 75}% Prob</span>
                        </div>

                        <div className="text-[11px] text-zinc-400 bg-zinc-900 p-2.5 rounded-lg space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="truncate max-w-[200px] font-medium text-zinc-200">{e.entryReason || 'Semnal AI Strategy'}</span>
                            <button
                              onClick={() => handleDeleteSingleEntry(e)}
                              className="p-1.5 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/15 rounded-lg transition-colors cursor-pointer shrink-0"
                              title="Șterge tranzacția"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                          <MinuteProfitDisplay minuteLogs={e.minuteProfitLogs} notes={e.notes} />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: MODEL PERFORMANCE */}
      {activeTab === 'models' && analytics && (
        <div className="space-y-8">
          {/* Performance by Model Section */}
          <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-6 space-y-6">
            <h2 className="font-serif text-lg text-white flex items-center gap-2">
              <Cpu size={18} className="text-indigo-400" />
              Performanță Comparativă Modele ML
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {analytics.performanceByModel.map((m) => (
                <div key={m.model} className="bg-zinc-950 border border-white/5 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span className="font-medium text-white text-xs">{m.model}</span>
                    <span className="text-[10px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 px-2 py-0.5 rounded">
                      {m.avgProbability}% avg prob
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between text-zinc-400">
                      <span>Rată Câștig:</span>
                      <span className="text-emerald-400 font-bold">{m.winRate}%</span>
                    </div>

                    <div className="flex justify-between text-zinc-400">
                      <span>PnL Generat:</span>
                      <span className={m.totalPnL >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                        {m.totalPnL >= 0 ? '+' : ''}${m.totalPnL.toFixed(2)}
                      </span>
                    </div>

                    <div className="flex justify-between text-zinc-400">
                      <span>Tranzacții Executate:</span>
                      <span className="text-zinc-200">{m.totalTrades} ({m.closedTrades} închise)</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Performance by Strategy Section */}
          <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-6 space-y-6">
            <h2 className="font-serif text-lg text-white flex items-center gap-2">
              <BarChart2 size={18} className="text-emerald-400" />
              Performanță pe Strategii AI Strategy Lab
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {analytics.performanceByStrategy.map((s) => (
                <div key={s.strategy} className="bg-zinc-950 border border-white/5 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-semibold text-white">{s.strategy}</h3>
                    <p className="text-[11px] text-zinc-500 mt-1">
                      {s.totalTrades} semnale | {s.closedTrades} tranzacții finale
                    </p>
                  </div>

                  <div className="text-right">
                    <div className={`text-sm font-mono font-bold ${s.totalPnL >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {s.totalPnL >= 0 ? '+' : ''}${s.totalPnL.toFixed(2)}
                    </div>
                    <div className="text-[11px] text-emerald-300 font-mono">
                      {s.winRate}% Win Rate
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DAILY SNAPSHOTS & EQUITY CURVE */}
      {activeTab === 'snapshots' && (
        <div className="space-y-8">
          {/* Equity & PnL History Chart */}
          <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="font-serif text-lg text-white flex items-center gap-2">
                <TrendingUp size={18} className="text-emerald-400" />
                Evoluție Zilnică Equity Portofoliu
              </h2>

              {snapshots.length > 0 && (
                <button
                  onClick={handleClearSnapshots}
                  className="flex items-center gap-2 px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-sm"
                  title="Șterge definitiv rapoartele zilnice și graficul equity"
                >
                  <Trash2 size={14} />
                  Șterge Rapoarte & Istoric Equity
                </button>
              )}
            </div>

            {snapshots.length > 0 ? (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={snapshotChartData}>
                    <defs>
                      <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" stroke="#52525b" fontSize={11} tickLine={false} allowDuplicatedCategory={false} />
                    <YAxis 
                      stroke="#52525b" 
                      fontSize={11} 
                      tickLine={false} 
                      domain={getYDomain} 
                      tickFormatter={(val) => `$${Number(val).toFixed(2)}`}
                      allowDuplicatedCategory={false}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#09090b', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                      labelStyle={{ color: '#a1a1aa' }}
                    />
                    <Area type="monotone" dataKey="equity" name="Equity ($)" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#equityGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="py-12 text-center text-zinc-500 text-sm font-mono bg-zinc-950/40 rounded-xl border border-dashed border-white/5">
                Nu există rapoarte zilnice sau au fost șterse. Noile snapshot-uri se vor genera automat pe măsură ce botul înregistrează activitate.
              </div>
            )}
          </div>

          {/* Daily Snapshots Table */}
          <div className="bg-zinc-900/40 border border-white/5 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-white/5 flex items-center justify-between">
              <h3 className="font-serif text-md text-white">Istoric Înregistrări Zilnice (Daily Snapshots)</h3>
              {snapshots.length > 0 && (
                <button
                  onClick={handleClearSnapshots}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
                >
                  <Trash2 size={13} />
                  Șterge Tot
                </button>
              )}
            </div>

            {snapshots.length > 0 ? (
              <div className="max-h-[460px] overflow-auto border-t border-white/5">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur-md text-zinc-400 font-mono text-[11px] uppercase border-b border-white/10 shadow-sm">
                    <tr>
                      <th className="px-5 py-3">Dată</th>
                      <th className="px-5 py-3 text-right">Equity Închidere</th>
                      <th className="px-5 py-3 text-right">PnL Realizat Zi</th>
                      <th className="px-5 py-3 text-right">PnL Nerealizat</th>
                      <th className="px-5 py-3 text-right">Win Rate Zi</th>
                      <th className="px-5 py-3 text-right">Tranzacții</th>
                      <th className="px-5 py-3">Cel Mai Bun Model</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-zinc-300 font-mono">
                    {snapshots.map((s) => (
                      <tr key={s.date} className="hover:bg-white/[0.02]">
                        <td className="px-5 py-3 text-white font-bold">{s.date}</td>
                        <td className="px-5 py-3 text-right">${s.equity.toLocaleString()}</td>
                        <td className={`px-5 py-3 text-right font-bold ${s.realizedPnL >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {s.realizedPnL >= 0 ? '+' : ''}${s.realizedPnL.toFixed(2)}
                        </td>
                        <td className="px-5 py-3 text-right text-zinc-400">
                          ${s.unrealizedPnL.toFixed(2)}
                        </td>
                        <td className="px-5 py-3 text-right text-emerald-400">{s.winRate}%</td>
                        <td className="px-5 py-3 text-right text-zinc-200">{s.totalTrades}</td>
                        <td className="px-5 py-3 font-sans text-zinc-300">{s.bestModel}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-zinc-500 text-xs font-mono">
                Tabelul de rapoarte zilnice este gol.
              </div>
            )}
          </div>
        </div>
      )}

      {/* MANUAL TRADE ENTRY SAVE MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-white/10 rounded-2xl max-w-xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <PlusCircle size={20} />
                </div>
                <div>
                  <h3 className="font-serif text-lg text-white">Adaugă / Salvează Tranzacție în Jurnal</h3>
                  <p className="text-xs text-zinc-400">Înregistrează o tranzacție manuală cu evaluare ML și Scor de Calitate</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveManualEntry} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Simbol (ex. BTCUSDT)</label>
                  <input
                    type="text"
                    required
                    value={newSymbol}
                    onChange={(e) => setNewSymbol(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500/50"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Tip Tranzacție</label>
                  <select
                    value={newAction}
                    onChange={(e) => setNewAction(e.target.value as any)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500/50"
                  >
                    <option value="BUY">🟢 BUY (Cumpărare)</option>
                    <option value="SELL">🔴 SELL (Vânzare)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 font-mono">
                <div>
                  <label className="block text-zinc-400 mb-1 font-sans font-medium">Preț Execuție ($)</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500/50"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1 font-sans font-medium">Cantitate</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500/50"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1 font-sans font-medium">Fee BUY ($)</label>
                  <input
                    type="number"
                    step="any"
                    value={newFeeBUY}
                    onChange={(e) => setNewFeeBUY(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-amber-400 focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
              </div>

              {newAction === 'SELL' && (
                <div className="space-y-3">
                  <div className="grid grid-cols-3 gap-3 font-mono">
                    <div>
                      <label className="block text-zinc-400 mb-1 font-sans font-medium">Fee SELL ($)</label>
                      <input
                        type="number"
                        step="any"
                        value={newFeeSELL}
                        onChange={(e) => setNewFeeSELL(e.target.value)}
                        placeholder="0.00"
                        className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-amber-400 focus:outline-none focus:border-emerald-500/50"
                      />
                    </div>

                    <div>
                      <label className="block text-zinc-400 mb-1 font-sans font-medium">PnL Brut ($)</label>
                      <input
                        type="number"
                        step="any"
                        value={newPnLBrut}
                        onChange={(e) => {
                          setNewPnLBrut(e.target.value);
                        }}
                        placeholder="0.00"
                        className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500/50"
                      />
                    </div>

                    <div>
                      <label className="block text-zinc-400 mb-1 font-sans font-medium">PnL %</label>
                      <input
                        type="number"
                        step="any"
                        value={newPnLPercent}
                        onChange={(e) => setNewPnLPercent(e.target.value)}
                        className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500/50"
                      />
                    </div>
                  </div>

                  {/* Calculated Net PnL Preview Banner */}
                  <div className="bg-zinc-900/80 border border-white/10 p-3 rounded-xl flex items-center justify-between text-xs font-mono">
                    <span className="text-zinc-400">
                      Fee Total: <span className="text-amber-400 font-bold">${((parseFloat(newFeeBUY) || 0) + (parseFloat(newFeeSELL) || 0)).toFixed(4)}</span>
                    </span>
                    <span className="text-zinc-300">
                      PnL Net Calculat: <span className={((parseFloat(newPnLBrut) || 0) - ((parseFloat(newFeeBUY) || 0) + (parseFloat(newFeeSELL) || 0))) >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                        {((parseFloat(newPnLBrut) || 0) - ((parseFloat(newFeeBUY) || 0) + (parseFloat(newFeeSELL) || 0))) >= 0 ? '+' : ''}
                        ${(((parseFloat(newPnLBrut) || 0) - ((parseFloat(newFeeBUY) || 0) + (parseFloat(newFeeSELL) || 0)))).toFixed(2)}
                      </span>
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Probabilitate ML (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={newMlProb}
                    onChange={(e) => setNewMlProb(Number(e.target.value))}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500/50"
                  />
                </div>

                <div>
                  <label className="block text-zinc-400 mb-1 font-medium">Scor Calitate Trade (0-100)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={newQualityScore}
                    onChange={(e) => setNewQualityScore(Number(e.target.value))}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Model ML / Sursă Semnal</label>
                <input
                  type="text"
                  value={newModelName}
                  onChange={(e) => setNewModelName(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Motiv Intrare / Strategie</label>
                <input
                  type="text"
                  value={newEntryReason}
                  onChange={(e) => setNewEntryReason(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div>
                <label className="block text-zinc-400 mb-1 font-medium">Note Suplimentare</label>
                <textarea
                  rows={2}
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Observații despre tranzacție, starea pieței..."
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500/50"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-900 text-zinc-400 hover:text-white border border-white/5 transition-colors cursor-pointer"
                >
                  Anulează
                </button>

                <button
                  type="submit"
                  disabled={isSavingManual}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold transition-all cursor-pointer shadow-lg shadow-emerald-500/20"
                >
                  <Save size={15} />
                  {isSavingManual ? 'Se salvează...' : 'Salvează în Jurnal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
