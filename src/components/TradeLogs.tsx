import React, { useState } from 'react';
import { useTradingStore, SignalJournalEntry } from '../store';
import { Download, Trash2, Database, Search, HardDrive, RefreshCw, Activity, ShieldAlert, CheckCircle2, XCircle, Zap, Sliders, Info, Filter } from 'lucide-react';

export function TradeLogs() {
  const { logs, signalJournal, maxLogs, setMaxLogs, clearLogs, clearSignalJournal } = useTradingStore();
  const [activeTab, setActiveTab] = useState<'console' | 'signals'>('signals');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'success' | 'warning' | 'info'>('all');
  const [signalFilter, setSignalFilter] = useState<'all' | 'BUY' | 'SELL' | 'HOLD' | 'reversal'>('all');
  const [selectedSignal, setSelectedSignal] = useState<SignalJournalEntry | null>(null);

  const logLimitOptions = [
    { value: 100, label: '100 Loguri (Standard)' },
    { value: 250, label: '250 Loguri' },
    { value: 500, label: '500 Loguri' },
    { value: 1000, label: '1.000 Loguri (Recomandat)' },
    { value: 2500, label: '2.500 Loguri (VPS Medium)' },
    { value: 5000, label: '5.000 Loguri (VPS Pro)' },
    { value: 10000, label: '10.000 Loguri (VPS Max)' },
  ];

  const handleExportCSV = () => {
    if (logs.length === 0) return;
    const headers = ['Ora', 'Tip', 'Mesaj', 'Portofoliu ($)'];
    const rows = logs.map(l => [
      `"${l.time || ''}"`,
      `"${l.type || ''}"`,
      `"${(l.message || '').replace(/"/g, '""')}"`,
      `"${l.equity !== undefined ? l.equity.toFixed(2) : ''}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ai_trade_console_logs_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportSignalJournalCSV = () => {
    const list = signalJournal || [];
    if (list.length === 0) return;
    const headers = ['Ora', 'Simbol', 'Pret ($)', 'RF Prob (%)', 'Meta Prob (%)', 'Reversal Score (%)', 'Decizie Finala', 'Motiv Veto / Detalii', 'Explicare (Pas cu Pas AI Pipeline)'];
    const rows = list.map(s => {
      const explanationText = Array.isArray(s.explanation) && s.explanation.length > 0
        ? s.explanation.join(' | ')
        : (s.vetoReason || '');

      return [
        `"${s.time || ''}"`,
        `"${s.symbol || ''}"`,
        `"${s.price ? (s.price < 1 ? s.price.toFixed(6) : s.price.toFixed(4)) : ''}"`,
        `"${s.rfProb || 0}"`,
        `"${s.metaProb || 0}"`,
        `"${s.reversalScore || 0}"`,
        `"${s.finalAction || 'HOLD'}"`,
        `"${(s.vetoReason || '').replace(/"/g, '""')}"`,
        `"${explanationText.replace(/"/g, '""')}"`
      ];
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `ai_trade_signal_audit_journal_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportServerJSON = async () => {
    try {
      const res = await fetch('/api/bot/state');
      if (!res.ok) throw new Error('Nu s-a putut obține starea de pe server');
      const data = await res.json();
      
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ai_trade_server_full_backup_${new Date().toISOString().slice(0,10)}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Eroare la descărcarea datelor de pe server.');
    }
  };

  const handleClear = () => {
    if (activeTab === 'console') {
      if (window.confirm('Sigur dorești să ștergi toate logurile din memorie și de pe server?')) {
        clearLogs();
      }
    } else {
      if (window.confirm('Sigur dorești să ștergi jurnalul de audit semnale de pe server?')) {
        clearSignalJournal();
      }
    }
  };

  const filteredLogs = logs.filter(l => {
    const matchesFilter = filterType === 'all' || l.type === filterType;
    const matchesSearch = searchTerm === '' || l.message.toLowerCase().includes(searchTerm.toLowerCase()) || l.time.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const rawSignalList = signalJournal || [];
  const filteredSignals = rawSignalList.filter(s => {
    const matchesSearch = searchTerm === '' || s.symbol.toLowerCase().includes(searchTerm.toLowerCase()) || s.vetoReason.toLowerCase().includes(searchTerm.toLowerCase()) || s.time.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    if (signalFilter === 'all') return true;
    if (signalFilter === 'reversal') return s.isReversal;
    if (signalFilter === 'BUY') return s.finalAction === 'BUY';
    if (signalFilter === 'SELL') return s.finalAction === 'SELL';
    if (signalFilter === 'HOLD') return s.finalAction === 'HOLD';
    return true;
  });

  const totalEvaluations = rawSignalList.length;
  const buySignalsCount = rawSignalList.filter(s => s.finalAction === 'BUY').length;
  const sellSignalsCount = rawSignalList.filter(s => s.finalAction === 'SELL').length;
  const vetoedCount = rawSignalList.filter(s => s.finalAction === 'HOLD' && s.vetoReason.includes('🚫')).length;
  const reversalCount = rawSignalList.filter(s => s.isReversal).length;

  return (
    <div className="flex flex-col h-full bg-black">
      <header className="py-4 border-b border-white/5 flex items-center justify-between px-8 bg-zinc-900/10 backdrop-blur-md shrink-0 flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-serif text-xl text-white">Decision & Audit Journal</h1>
            <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded-full font-mono flex items-center gap-1">
              <HardDrive className="w-3 h-3" />
              VPS 24/7 Engine
            </span>
          </div>
          <p className="text-[10px] uppercase text-zinc-500 tracking-wider mt-0.5">Jurnal de decizie AI & audit detaliat al tuturor semnalelor evaluate</p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Capacity Selector */}
          <div className="flex items-center gap-2 bg-zinc-900 border border-white/10 rounded-lg px-3 py-1.5">
            <Database className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-xs text-zinc-400 font-medium whitespace-nowrap">Capacitate Istoric:</span>
            <select
              value={maxLogs || 1000}
              onChange={(e) => setMaxLogs(Number(e.target.value))}
              className="bg-black text-xs text-emerald-400 font-mono font-semibold focus:outline-none cursor-pointer border border-emerald-500/30 rounded px-2 py-0.5"
            >
              {logLimitOptions.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <button 
            onClick={handleClear}
            title="Șterge jurnalele active"
            className="text-[10px] uppercase tracking-widest text-rose-400 border border-rose-500/20 px-3 py-1.5 rounded-lg hover:bg-rose-500/10 transition-colors flex items-center gap-1 font-medium"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Șterge
          </button>

          <button 
            onClick={activeTab === 'console' ? handleExportCSV : handleExportSignalJournalCSV}
            className="text-[10px] uppercase tracking-widest text-emerald-400 border border-emerald-500/20 px-3.5 py-1.5 rounded-lg hover:bg-emerald-500/10 transition-colors flex items-center gap-1.5 font-medium"
          >
            <Download className="w-3.5 h-3.5" />
            CSV Export
          </button>

          <button 
            onClick={handleExportServerJSON}
            className="text-[10px] uppercase tracking-widest text-zinc-300 border border-white/10 px-3.5 py-1.5 rounded-lg hover:bg-white/5 transition-colors flex items-center gap-1.5"
          >
            Backup JSON
          </button>
        </div>
      </header>

      {/* Main View Mode Selector Tabs */}
      <div className="px-8 pt-4 pb-2 border-b border-white/5 flex items-center justify-between gap-4 flex-wrap bg-zinc-950">
        <div className="flex items-center gap-2 bg-zinc-900/80 p-1 rounded-xl border border-white/10">
          <button
            onClick={() => setActiveTab('signals')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'signals'
                ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Jurnal Audit Semnale AI</span>
            <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
              activeTab === 'signals' ? 'bg-black/20 text-black' : 'bg-emerald-500/20 text-emerald-400'
            }`}>
              {totalEvaluations}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('console')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'console'
                ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            <span>Console Execuții Sistem</span>
            <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
              activeTab === 'console' ? 'bg-black/20 text-black' : 'bg-zinc-700 text-zinc-300'
            }`}>
              {logs.length}
            </span>
          </button>
        </div>

        {activeTab === 'signals' && (
          <div className="flex items-center gap-3 text-xs flex-wrap">
            <div className="bg-zinc-900 border border-white/5 rounded-lg px-3 py-1 flex items-center gap-2">
              <span className="text-zinc-500 text-[11px]">Cumpărări Aprobate:</span>
              <span className="font-mono text-emerald-400 font-bold">{buySignalsCount}</span>
            </div>
            <div className="bg-zinc-900 border border-white/5 rounded-lg px-3 py-1 flex items-center gap-2">
              <span className="text-zinc-500 text-[11px]">Vânzări Aprobate:</span>
              <span className="font-mono text-rose-400 font-bold">{sellSignalsCount}</span>
            </div>
            <div className="bg-zinc-900 border border-white/5 rounded-lg px-3 py-1 flex items-center gap-2">
              <span className="text-zinc-500 text-[11px]">Respinse / Vetoed:</span>
              <span className="font-mono text-amber-400 font-bold">{vetoedCount}</span>
            </div>
            <div className="bg-zinc-900 border border-white/5 rounded-lg px-3 py-1 flex items-center gap-2">
              <span className="text-zinc-500 text-[11px]">Reversale Detectate:</span>
              <span className="font-mono text-cyan-400 font-bold">{reversalCount}</span>
            </div>
          </div>
        )}
      </div>

      <div className="p-8 overflow-y-auto flex-1 space-y-4">
        {activeTab === 'signals' ? (
          <>
            {/* Filter & Search for Signals */}
            <div className="flex items-center justify-between gap-4 flex-wrap bg-zinc-900/60 border border-white/5 rounded-xl p-3">
              <div className="flex items-center gap-2 flex-1 min-w-[240px] bg-black border border-white/10 rounded-lg px-3 py-1.5">
                <Search className="w-3.5 h-3.5 text-zinc-500" />
                <input 
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Caută în audit semnale (ZAMA, BTC, motiv veto, timp)..."
                  className="w-full bg-transparent text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none font-mono"
                />
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-zinc-500 text-[11px] mr-1 flex items-center gap-1">
                  <Filter className="w-3 h-3 text-zinc-400" /> Filtru:
                </span>
                <button
                  onClick={() => setSignalFilter('all')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                    signalFilter === 'all' ? 'bg-white/10 text-white border border-white/20' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Toate ({rawSignalList.length})
                </button>
                <button
                  onClick={() => setSignalFilter('BUY')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                    signalFilter === 'BUY' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-zinc-400 hover:text-emerald-400'
                  }`}
                >
                  BUY ({buySignalsCount})
                </button>
                <button
                  onClick={() => setSignalFilter('SELL')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                    signalFilter === 'SELL' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'text-zinc-400 hover:text-rose-400'
                  }`}
                >
                  SELL ({sellSignalsCount})
                </button>
                <button
                  onClick={() => setSignalFilter('HOLD')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                    signalFilter === 'HOLD' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'text-zinc-400 hover:text-amber-400'
                  }`}
                >
                  HOLD / Respinse ({rawSignalList.length - buySignalsCount - sellSignalsCount})
                </button>
                <button
                  onClick={() => setSignalFilter('reversal')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                    signalFilter === 'reversal' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'text-zinc-400 hover:text-cyan-400'
                  }`}
                >
                  Reversals ({reversalCount})
                </button>
              </div>
            </div>

            {/* Signal Audit Table */}
            <div className="bg-[#18181b] rounded-xl border border-white/10 overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-900/80 text-[10px] font-mono text-zinc-400 uppercase tracking-wider border-b border-white/10">
                      <th className="py-3 px-4">Ora</th>
                      <th className="py-3 px-4">Simbol</th>
                      <th className="py-3 px-4">Preț Actual</th>
                      <th className="py-3 px-4">Random Forest</th>
                      <th className="py-3 px-4">Meta Model</th>
                      <th className="py-3 px-4">Reversal Setup</th>
                      <th className="py-3 px-4">Acțiune Finală</th>
                      <th className="py-3 px-4">Motiv Veto / Confluență</th>
                      <th className="py-3 px-4 text-right">Detalii</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-xs font-mono">
                    {filteredSignals.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-zinc-500 font-sans">
                          {rawSignalList.length === 0 ? (
                            <div className="space-y-2">
                              <RefreshCw className="w-6 h-6 animate-spin text-emerald-400 mx-auto" />
                              <p>Așteptăm scanarea automată 24/7 pe server pentru a popula Jurnalul de Audit Semnale...</p>
                            </div>
                          ) : (
                            'Nicio evaluare de semnal nu corespunde căutării sau filtrelor.'
                          )}
                        </td>
                      </tr>
                    ) : (
                      filteredSignals.map((sig) => {
                        const isBuy = sig.finalAction === 'BUY';
                        const isSell = sig.finalAction === 'SELL';
                        const isVetoed = sig.finalAction === 'HOLD' && sig.vetoReason.includes('🚫');

                        return (
                          <tr key={sig.id} className="hover:bg-white/[0.03] transition-colors">
                            <td className="py-3 px-4 text-zinc-400 font-mono text-[11px]">
                              {sig.time}
                            </td>
                            <td className="py-3 px-4 font-bold text-white flex items-center gap-1.5">
                              {sig.symbol}
                              {sig.isReversal && (
                                <span className="bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[9px] px-1.5 py-0.2 rounded font-mono flex items-center gap-0.5">
                                  <Zap className="w-2.5 h-2.5" /> REV
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-zinc-300">
                              ${sig.price < 1 ? sig.price.toFixed(5) : sig.price.toFixed(2)}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                sig.rfProb >= 70 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                                sig.rfProb >= 55 ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                                'bg-zinc-800 text-zinc-400'
                              }`}>
                                {sig.rfProb}%
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                sig.metaProb >= 60 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                                sig.metaProb >= 40 ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                                'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              }`}>
                                {sig.metaProb}%
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              {sig.isReversal ? (
                                <span className="text-cyan-400 font-bold flex items-center gap-1">
                                  <Zap className="w-3 h-3 text-cyan-400 animate-pulse" />
                                  {sig.reversalType === 'bullish' ? 'Bullish Bottom' : 'Bearish Peak'} ({sig.reversalScore}%)
                                </span>
                              ) : (
                                <span className="text-zinc-600">-</span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider ${
                                isBuy ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                                isSell ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                                isVetoed ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                'bg-zinc-800 text-zinc-400'
                              }`}>
                                {isBuy && <CheckCircle2 className="w-3 h-3" />}
                                {isSell && <XCircle className="w-3 h-3" />}
                                {isVetoed && <ShieldAlert className="w-3 h-3" />}
                                {sig.finalAction}
                              </span>
                            </td>
                            <td className="py-3 px-4 max-w-xs truncate text-[11px]">
                              <span className={isVetoed ? 'text-amber-300' : isBuy ? 'text-emerald-400' : isSell ? 'text-rose-400' : 'text-zinc-400'}>
                                {sig.vetoReason}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                onClick={() => setSelectedSignal(sig)}
                                className="text-[10px] text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 px-2.5 py-1 rounded transition-colors flex items-center gap-1 ml-auto"
                              >
                                <Info className="w-3 h-3" /> Explicare
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : (
          /* System Logs Console Tab */
          <>
            <div className="flex items-center justify-between gap-4 flex-wrap bg-zinc-900/60 border border-white/5 rounded-xl p-3">
              <div className="flex items-center gap-2 flex-1 min-w-[240px] bg-black border border-white/10 rounded-lg px-3 py-1.5">
                <Search className="w-3.5 h-3.5 text-zinc-500" />
                <input 
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Caută în loguri sistem (tranzacție, simbol, timp)..."
                  className="w-full bg-transparent text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none font-mono"
                />
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-zinc-500 text-[11px] mr-1">Filtru:</span>
                <button
                  onClick={() => setFilterType('all')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                    filterType === 'all' ? 'bg-white/10 text-white border border-white/20' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  Toate ({logs.length})
                </button>
                <button
                  onClick={() => setFilterType('success')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                    filterType === 'success' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-zinc-400 hover:text-emerald-400'
                  }`}
                >
                  Achiziții ({logs.filter(l => l.type === 'success').length})
                </button>
                <button
                  onClick={() => setFilterType('warning')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                    filterType === 'warning' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' : 'text-zinc-400 hover:text-rose-400'
                  }`}
                >
                  Vânzări/Avertizări ({logs.filter(l => l.type === 'warning').length})
                </button>
                <button
                  onClick={() => setFilterType('info')}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                    filterType === 'info' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'text-zinc-400 hover:text-blue-400'
                  }`}
                >
                  Info ({logs.filter(l => l.type === 'info').length})
                </button>
              </div>

              <div className="text-[11px] font-mono text-zinc-400 bg-black/50 border border-white/5 rounded-lg px-3 py-1.5 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Salvate: <strong className="text-emerald-400">{logs.length}</strong> / <span className="text-zinc-400">{maxLogs || 1000}</span> max
              </div>
            </div>

            {/* Terminal Window */}
            <div className="bg-[#1e1e1e] rounded-xl border border-white/10 p-4 font-mono text-xs overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between gap-2 mb-4 text-zinc-500 border-b border-white/5 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
                  <span className="ml-2 uppercase tracking-widest text-[9px]">Server Inference Engine Console</span>
                </div>
                <div className="text-[10px] text-zinc-500 flex items-center gap-1">
                  <RefreshCw className="w-3 h-3 animate-spin text-emerald-400" />
                  <span>Sincronizat 24/7 (Server Cloud / VPS)</span>
                </div>
              </div>
              
              <div className="space-y-2 text-zinc-300 max-h-[600px] overflow-y-auto pr-2">
                {filteredLogs.length === 0 ? (
                  <div className="text-zinc-500 py-8 text-center">
                    {logs.length === 0 ? 'Așteptare execuții model AI...' : 'Niciun log nu corespunde filtrelor selectate.'}
                  </div>
                ) : (
                  filteredLogs.map((log, i) => (
                    <div key={i} className="flex gap-4 hover:bg-white/[0.02] p-1 rounded transition-colors">
                      <span className="text-zinc-500 shrink-0 select-none">[{log.time}]</span>
                      <span className={`
                        ${log.type === 'success' ? 'text-emerald-400 font-bold' : ''}
                        ${log.type === 'warning' ? 'text-rose-400 font-bold' : ''}
                        ${log.type === 'info' ? 'text-blue-400' : ''}
                      `}>
                        {log.message}
                        {log.equity !== undefined && (
                          <span className="text-zinc-400 font-normal ml-2 bg-white/5 px-2 py-0.5 rounded text-[11px]">
                            Portofoliu: ${log.equity.toFixed(2)}
                          </span>
                        )}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Signal Details Modal */}
      {selectedSignal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl max-w-2xl w-full p-6 space-y-4 font-sans shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>Audit Detaliat {selectedSignal.symbol}</span>
                  <span className={`text-xs px-2 py-0.5 rounded font-mono ${
                    selectedSignal.finalAction === 'BUY' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                    selectedSignal.finalAction === 'SELL' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                    'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}>
                    {selectedSignal.finalAction}
                  </span>
                </h3>
                <p className="text-xs text-zinc-400 mt-0.5 font-mono">Ora evaluării: {selectedSignal.time} | Preț: ${selectedSignal.price.toFixed(4)}</p>
              </div>
              <button 
                onClick={() => setSelectedSignal(null)}
                className="text-zinc-400 hover:text-white text-lg font-mono p-1"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-4 gap-2.5">
              <div className="bg-black/50 border border-white/5 rounded-xl p-2.5">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Random Forest</span>
                <span className="text-base font-mono font-bold text-emerald-400">{selectedSignal.rfProb}%</span>
              </div>
              <div className="bg-black/50 border border-white/5 rounded-xl p-2.5">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Meta Model</span>
                <span className="text-base font-mono font-bold text-blue-400">{selectedSignal.metaProb}%</span>
              </div>
              <div className="bg-black/50 border border-white/5 rounded-xl p-2.5">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Reversal Score</span>
                <span className="text-base font-mono font-bold text-cyan-400">{selectedSignal.reversalScore}%</span>
              </div>
              <div className="bg-black/50 border border-emerald-500/20 rounded-xl p-2.5 bg-emerald-500/[0.03]">
                <span className="text-[10px] text-zinc-400 uppercase tracking-wider block">Decizie Finală</span>
                <span className={`text-base font-mono font-bold ${
                  selectedSignal.finalAction === 'BUY' ? 'text-emerald-400' : selectedSignal.finalAction === 'SELL' ? 'text-rose-400' : 'text-amber-400'
                }`}>{selectedSignal.finalAction}</span>
              </div>
            </div>

            <div className="bg-black/60 border border-white/5 rounded-xl p-3.5 space-y-2">
              <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" /> Rezultat Confluență & Motiv Veto:
              </h4>
              <p className="text-xs font-mono text-amber-300 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
                {selectedSignal.vetoReason}
              </p>
            </div>

            {selectedSignal.explanation && selectedSignal.explanation.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-cyan-400" /> Pas cu Pas Pipeline AI & Execution Engine:
                </h4>
                <div className="bg-black/40 border border-white/5 rounded-xl p-3 space-y-1.5 font-mono text-[11px] text-zinc-300 max-h-52 overflow-y-auto whitespace-pre-line">
                  {selectedSignal.explanation.map((exp, idx) => (
                    <div key={idx} className="border-b border-white/[0.04] pb-1.5 last:border-none leading-relaxed">
                      {exp}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-2 flex items-center justify-between border-t border-white/5 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    const textContent = `Audit Detaliat ${selectedSignal.symbol}\nOra: ${selectedSignal.time}\nPreț: $${selectedSignal.price}\nRandom Forest: ${selectedSignal.rfProb}%\nMeta Model: ${selectedSignal.metaProb}%\nReversal Score: ${selectedSignal.reversalScore}%\nDecizie Finală: ${selectedSignal.finalAction}\nMotiv/Confluență: ${selectedSignal.vetoReason}\n\nExplicare Pas cu Pas Pipeline AI:\n${(selectedSignal.explanation || []).join('\n')}`;
                    navigator.clipboard.writeText(textContent);
                    alert('Auditul a fost copiat în clipboard!');
                  }}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> Copiază Audit
                </button>
                <button
                  onClick={() => {
                    const textContent = `Audit Detaliat ${selectedSignal.symbol}\nOra: ${selectedSignal.time}\nPreț: $${selectedSignal.price}\nRandom Forest: ${selectedSignal.rfProb}%\nMeta Model: ${selectedSignal.metaProb}%\nReversal Score: ${selectedSignal.reversalScore}%\nDecizie Finală: ${selectedSignal.finalAction}\nMotiv/Confluență: ${selectedSignal.vetoReason}\n\nExplicare Pas cu Pas Pipeline AI:\n${(selectedSignal.explanation || []).join('\n')}`;
                    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = `audit_${selectedSignal.symbol}_${selectedSignal.time.replace(/:/g, '-')}.txt`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                  }}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> Descarcă .TXT
                </button>
              </div>

              <button
                onClick={() => setSelectedSignal(null)}
                className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black text-xs font-bold rounded-lg transition-colors"
              >
                Închide Audit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
