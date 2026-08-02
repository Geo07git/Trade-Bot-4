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

export function TradingJournal() {
  const { tradeHistory, positions, binanceMode, timezone } = useTradingStore();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [snapshots, setSnapshots] = useState<DailySnapshot[]>([]);
  const [analytics, setAnalytics] = useState<JournalAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [selectedSymbol, setSelectedSymbol] = useState<string>('ALL');
  const [selectedModel, setSelectedModel] = useState<string>('ALL');
  const [selectedAction, setSelectedAction] = useState<string>('ALL');
  const [selectedMode, setSelectedMode] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'entries' | 'models' | 'snapshots'>('entries');
  
  // Modal and Manual Save State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSavingManual, setIsSavingManual] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Manual Form Fields State
  const [newSymbol, setNewSymbol] = useState('BTCUSDT');
  const [newAction, setNewAction] = useState<'BUY' | 'SELL'>('BUY');
  const [newPrice, setNewPrice] = useState<string>('63000');
  const [newAmount, setNewAmount] = useState<string>('0.05');
  const [newFee, setNewFee] = useState<string>('0.05');
  const [newPnL, setNewPnL] = useState<string>('0');
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
      const feeNum = parseFloat(newFee) || 0;
      const pnlNum = parseFloat(newPnL) || 0;
      const pnlPctNum = parseFloat(newPnLPercent) || 0;
      const scoreNum = Math.min(100, Math.max(0, newQualityScore || 85));

      const calculatedGrade = scoreNum >= 90 ? 'A+' : scoreNum >= 80 ? 'A' : scoreNum >= 70 ? 'B' : scoreNum >= 60 ? 'C' : 'F';
      const calculatedStars = scoreNum >= 90 ? 5 : scoreNum >= 80 ? 5 : scoreNum >= 70 ? 4 : scoreNum >= 60 ? 3 : 2;

      const payload = {
        symbol: newSymbol.toUpperCase().trim(),
        action: newAction,
        price: priceNum,
        amount: amountNum,
        fee: feeNum,
        pnl: pnlNum,
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

      const res = await fetch('/api/journal/entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        setSaveSuccessMsg('Tranzacție salvată cu succes în jurnal!');
        setTimeout(() => setSaveSuccessMsg(null), 3000);
        setIsAddModalOpen(false);
        // Reset form
        setNewNotes('');
        await fetchData();
      } else {
        alert('Eroare la salvare: ' + (data.error || 'Necunoscută'));
      }
    } catch (err: any) {
      alert('Eroare la conexiunea cu serverul: ' + (err?.message || err));
    } finally {
      setIsSavingManual(false);
    }
  };

  const handleExportCSV = () => {
    if (filteredEntries.length === 0) {
      alert('Nu există tranzacții de exportat.');
      return;
    }
    const headers = ['ID', 'Data_Ora', 'Simbol', 'Tip', 'Pret_Executie', 'Cantitate', 'Comision', 'PnL', 'PnL_Percent', 'Scor_Calitate', 'Grad_AI', 'Model_ML', 'Motiv_Intrare', 'Mod', 'Note'];
    const csvRows = [headers.join(',')];

    filteredEntries.forEach(e => {
      const timeStr = formatInTimezone(e.timestamp || new Date().toISOString(), timezone || 'Europe/Bucharest');
      const row = [
        `"${e.id}"`,
        `"${timeStr}"`,
        `"${e.symbol || ''}"`,
        `"${e.action || ''}"`,
        e.price || 0,
        e.amount || 0,
        e.fee || 0,
        e.pnl || 0,
        e.pnlPercent || 0,
        e.tradeQualityScore || 0,
        `"${e.tradeGrade || 'B'}"`,
        `"${(e.modelName || '').replace(/"/g, '""')}"`,
        `"${(e.entryReason || '').replace(/"/g, '""')}"`,
        `"${e.mode || 'paper'}"`,
        `"${(e.notes || '').replace(/"/g, '""')}"`
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Trading_Journal_${new Date().toISOString().split('T')[0]}.csv`);
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

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [entriesRes, snapshotsRes, analyticsRes] = await Promise.all([
        fetch('/api/journal/entries'),
        fetch('/api/journal/daily-snapshots'),
        fetch('/api/journal/analytics')
      ]);

      if (entriesRes.ok) {
        const data = await entriesRes.json();
        if (data.success && Array.isArray(data.entries)) {
          setEntries(data.entries);
        }
      }
      if (snapshotsRes.ok) {
        const data = await snapshotsRes.json();
        if (data.success && Array.isArray(data.snapshots)) {
          setSnapshots(data.snapshots);
        }
      }
      if (analyticsRes.ok) {
        const data = await analyticsRes.json();
        if (data.success && data.analytics) {
          setAnalytics(data.analytics);
        }
      }
    } catch (err) {
      console.error('Error fetching journal data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const timer = setInterval(() => {
      fetchData();
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const handleClearSnapshots = async () => {
    if (!window.confirm('Ești sigur că vrei să ștergi toate rapoartele zilnice și istoricul evoluției equity?')) return;
    try {
      const res = await fetch('/api/journal/clear-snapshots', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setSnapshots([]);
      }
    } catch (err) {
      console.error('Eroare la ștergerea rapoartelor zilnice:', err);
    }
  };

  const handleClearEntries = async () => {
    if (!window.confirm('Ești sigur că vrei să ștergi toate înregistrările din jurnalul de tranzacții?')) return;
    try {
      const res = await fetch('/api/journal/clear-entries', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setEntries([]);
        useTradingStore.setState({ tradeHistory: [] });
      }
    } catch (err) {
      console.error('Eroare la ștergerea jurnalului:', err);
    }
  };

  // Merge server journal entries with tradeHistory from store so no trade is ever missed
  const allDisplayEntries = useMemo(() => {
    const existingKeys = new Set(entries.map(e => `${e.symbol}_${e.timestamp}`));
    const combined = [...entries];

    if (tradeHistory && Array.isArray(tradeHistory)) {
      tradeHistory.forEach((t, idx) => {
        const key = `${t.symbol}_${t.timestamp}`;
        if (!existingKeys.has(key)) {
          combined.push({
            id: `store_trade_${idx}_${t.symbol}`,
            symbol: t.symbol || 'USDT',
            action: 'SELL' as const,
            price: t.exitPrice || t.entryPrice || 0,
            amount: t.amount || 0,
            fee: (t.exitPrice || 0) * (t.amount || 0) * 0.00075,
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

  const filteredEntries = useMemo(() => {
    return allDisplayEntries.filter(e => {
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
  }, [allDisplayEntries, selectedSymbol, selectedModel, selectedAction, selectedMode, searchQuery]);

  const snapshotChartData = useMemo(() => {
    return [...snapshots].reverse().map(s => ({
      date: s.date.substring(5), // MM-DD
      equity: s.equity,
      realizedPnL: s.realizedPnL,
      winRate: s.winRate
    }));
  }, [snapshots]);

  const gradeStats = useMemo(() => {
    const closed = allDisplayEntries.filter(e => e.action === 'SELL');

    const getScore = (e: JournalEntry): number => {
      if (e.tradeQualityScore !== undefined && e.tradeQualityScore > 0) {
        return e.tradeQualityScore;
      }
      if (e.tradeGrade === 'A+') return 93.5;
      if (e.tradeGrade === 'A') return 84.5;
      if (e.tradeGrade === 'B') return 74.5;
      if (e.tradeGrade === 'C') return 64.5;
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
    const b80 = closed.filter(e => getScore(e) >= 80 && getScore(e) < 90);
    const b70 = closed.filter(e => getScore(e) >= 70 && getScore(e) < 80);
    const b60 = closed.filter(e => getScore(e) >= 60 && getScore(e) < 70);
    const bUnder60 = closed.filter(e => getScore(e) < 60);

    return {
      brackets: [
        calcBracket(b90, 'Scor 90-100', '90-100', 'A+', 5, 'emerald'),
        calcBracket(b80, 'Scor 80-89', '80-89.9', 'A', 5, 'sky'),
        calcBracket(b70, 'Scor 70-79', '70-79.9', 'B', 4, 'indigo'),
        calcBracket(b60, 'Scor 60-69', '60-69.9', 'C', 3, 'amber'),
        calcBracket(bUnder60, 'Scor < 60', '< 60', 'F', 2, 'rose'),
      ]
    };
  }, [allDisplayEntries]);

  return (
    <div className="h-full w-full bg-black overflow-y-auto p-4 md:p-8 space-y-8 pb-24">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
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
            onClick={fetchData}
            disabled={isLoading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-zinc-900 border border-white/10 text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors text-xs font-medium cursor-pointer"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin text-emerald-400" : ""} />
            Actualizează Datele
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-4 md:p-5">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Tranzacții Totale</span>
            <Zap size={16} className="text-amber-400" />
          </div>
          <div className="text-2xl font-serif text-white">
            {analytics?.totalTrades || 0}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">
            {analytics?.closedTrades || 0} închise cu PnL calculat
          </p>
        </div>

        <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-4 md:p-5">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Rată de Câștig (Win Rate)</span>
            <Percent size={16} className="text-emerald-400" />
          </div>
          <div className="text-2xl font-serif text-emerald-400">
            {analytics?.winRate || 0}%
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">
            Măsurat pe tranzacțiile închise
          </p>
        </div>

        <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-4 md:p-5">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">PnL Total Realizat</span>
            <DollarSign size={16} className={analytics && analytics.totalPnL >= 0 ? "text-emerald-400" : "text-rose-400"} />
          </div>
          <div className={`text-2xl font-serif ${analytics && analytics.totalPnL >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {analytics && analytics.totalPnL >= 0 ? '+' : ''}${analytics?.totalPnL.toFixed(2) || '0.00'}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1">
            Comisioane totale: ${analytics?.totalFees.toFixed(2) || '0.00'}
          </p>
        </div>

        <div className="bg-zinc-900/40 border border-white/5 rounded-2xl p-4 md:p-5">
          <div className="flex items-center justify-between text-zinc-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Cel mai bun Model ML</span>
            <Award size={16} className="text-indigo-400" />
          </div>
          <div className="text-lg font-serif text-indigo-300 truncate">
            {analytics?.bestModel || 'XGBoost Classifier'}
          </div>
          <p className="text-[11px] text-zinc-500 mt-1 truncate">
            Top strategie: {analytics?.bestStrategy || 'RSI + Momentum'}
          </p>
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

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleClearSnapshots}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-medium transition-all cursor-pointer shadow-sm"
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
          <div className="hidden md:block bg-zinc-900/40 border border-white/5 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-zinc-900/80 text-zinc-400 font-mono text-[11px] uppercase border-b border-white/5">
                  <tr>
                    <th className="px-5 py-3">Dată & Oră</th>
                    <th className="px-5 py-3">Simbol</th>
                    <th className="px-5 py-3">Tip</th>
                    <th className="px-5 py-3 text-right">Preț Execuție</th>
                    <th className="px-5 py-3 text-right">Cantitate</th>
                    <th className="px-5 py-3 text-right">Comision</th>
                    <th className="px-5 py-3 text-right">PnL</th>
                    <th className="px-5 py-3">Grad Calitate AI</th>
                    <th className="px-5 py-3">Probabilitate ML</th>
                    <th className="px-5 py-3">Model ML</th>
                    <th className="px-5 py-3">Motiv Intrare / Strategie</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-zinc-300">
                  {filteredEntries.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-5 py-12 text-center text-zinc-500">
                        Nicio tranzacție găsită conform filtrelor selectate.
                      </td>
                    </tr>
                  ) : (
                    filteredEntries.map((e) => (
                      <tr key={e.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-3.5 font-mono text-zinc-400 whitespace-nowrap">
                          {formatInTimezone(e.timestamp || new Date().toISOString(), timezone || 'Europe/Bucharest')}
                        </td>

                        <td className="px-5 py-3.5 font-semibold text-white whitespace-nowrap">
                          {e.symbol || 'USDT'}
                        </td>

                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase ${
                            e.action === 'BUY'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}>
                            {e.action || 'BUY'}
                          </span>
                        </td>

                        <td className="px-5 py-3.5 font-mono text-right whitespace-nowrap">
                          ${(e.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>

                        <td className="px-5 py-3.5 font-mono text-right whitespace-nowrap">
                          {e.amount || 0}
                        </td>

                        <td className="px-5 py-3.5 font-mono text-right text-zinc-400 whitespace-nowrap">
                          ${(e.fee || 0).toFixed(4)}
                        </td>

                        <td className="px-5 py-3.5 font-mono text-right whitespace-nowrap font-medium">
                          {e.action === 'SELL' ? (
                            <span className={(e.pnl || 0) >= 0 ? "text-emerald-400" : "text-rose-400"}>
                              {(e.pnl || 0) >= 0 ? '+' : ''}${(e.pnl || 0).toFixed(2)} ({(e.pnlPercent || 0) >= 0 ? '+' : ''}${(e.pnlPercent || 0).toFixed(2)}%)
                            </span>
                          ) : (
                            <span className="text-zinc-500">-</span>
                          )}
                        </td>

                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <TradeGradeBadge grade={e.tradeGrade} score={e.tradeQualityScore} stars={e.stars} />
                        </td>

                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-12 bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                              <div 
                                className="bg-emerald-400 h-full rounded-full"
                                style={{ width: `${Math.min(100, Math.max(0, e.mlProbability || 75))}%` }}
                              />
                            </div>
                            <span className="font-mono text-emerald-400 font-semibold text-[11px]">
                              {e.mlProbability || 75}%
                            </span>
                          </div>
                        </td>

                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className="px-2 py-1 rounded bg-zinc-800 text-zinc-300 font-sans text-[11px]">
                            {e.modelName || 'Random Forest 2.0'}
                          </span>
                        </td>

                        <td className="px-5 py-3.5 text-zinc-300 max-w-xs truncate" title={e.entryReason || ''}>
                          {e.entryReason || 'Semnal AI Strategy'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile Card List View */}
          <div className="block md:hidden space-y-3">
            {filteredEntries.length === 0 ? (
              <div className="p-8 text-center text-zinc-500 bg-zinc-900/40 rounded-2xl border border-white/5">
                Nicio tranzacție găsită.
              </div>
            ) : (
              filteredEntries.map((e) => (
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
                      <span className="text-zinc-500 text-[10px] block">COMISION</span>
                      <span className="text-zinc-400">${(e.fee || 0).toFixed(4)}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500 text-[10px] block">PNL REALIZAT</span>
                      {e.action === 'SELL' ? (
                        <span className={(e.pnl || 0) >= 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                          {(e.pnl || 0) >= 0 ? '+' : ''}${(e.pnl || 0).toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-zinc-500">-</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1 border-t border-white/5">
                    <span className="text-zinc-400">{e.modelName || 'Random Forest 2.0'}</span>
                    <span className="text-emerald-400 font-mono font-semibold">{e.mlProbability || 75}% Prob</span>
                  </div>

                  <div className="text-[11px] text-zinc-400 italic bg-zinc-900 p-2 rounded-lg">
                    {e.entryReason || 'Semnal AI Strategy'}
                  </div>
                </div>
              ))
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
                    <XAxis dataKey="date" stroke="#52525b" fontSize={11} tickLine={false} />
                    <YAxis stroke="#52525b" fontSize={11} tickLine={false} domain={['auto', 'auto']} />
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
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-900/80 text-zinc-400 font-mono text-[11px] uppercase border-b border-white/5">
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
                  <label className="block text-zinc-400 mb-1 font-sans font-medium">Comision ($)</label>
                  <input
                    type="number"
                    step="any"
                    value={newFee}
                    onChange={(e) => setNewFee(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
              </div>

              {newAction === 'SELL' && (
                <div className="grid grid-cols-2 gap-3 font-mono">
                  <div>
                    <label className="block text-zinc-400 mb-1 font-sans font-medium">PnL Realizat ($)</label>
                    <input
                      type="number"
                      step="any"
                      value={newPnL}
                      onChange={(e) => setNewPnL(e.target.value)}
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
