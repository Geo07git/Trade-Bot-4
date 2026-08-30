import React, { useState, useEffect, useMemo } from 'react';
import { Play, Download, Settings, BarChart2, CheckCircle2, XCircle, ChevronRight, Activity, Clock, Trash2 } from 'lucide-react';
import { MomentumBacktestResult } from '../types';
import { useTradingStore } from '../store';
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Cell, LineChart, Line, Legend } from 'recharts';

export function BacktestMomentum() {
  const { apiKey, language } = useTradingStore();
  const [activeTab, setActiveTab] = useState<'run' | 'history' | 'analysis'>('run');
  const [isRunning, setIsRunning] = useState(false);
  
  // Run Form State
  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [symbolLimit, setSymbolLimit] = useState(10);
  const [minMomentumScore, setMinMomentumScore] = useState(50);
  const [singleSymbol, setSingleSymbol] = useState('');
  
  // History State
  const [historyFiles, setHistoryFiles] = useState<{filename: string, createdAt: number, sizeMB: string}[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  
  // Analysis State
  const [selectedResults, setSelectedResults] = useState<MomentumBacktestResult[] | null>(null);
  const [loadingResults, setLoadingResults] = useState(false);
  
  // Simulator State
  const [slPct, setSlPct] = useState(2.0);
  const [tpPct, setTpPct] = useState(4.0);
  const [trailingAct, setTrailingAct] = useState(3.0);
  const [trailingDist, setTrailingDist] = useState(1.0);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    }
  }, [activeTab]);

  const authHeaders = {
    'Content-Type': 'application/json',
    ...(apiKey ? { 'x-admin-password': apiKey } : {})
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/momentum/list', { headers: authHeaders });
      const data = await res.json();
      if (data.success) {
        setHistoryFiles(data.files);
      }
    } catch (e) {
      console.error(e);
    }
    setLoadingHistory(false);
  };

  const runBacktest = async () => {
    setIsRunning(true);
    try {
      const res = await fetch('/api/momentum/run-backtest', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          startTime: new Date(startDate).getTime(),
          endTime: new Date(endDate).getTime(),
          symbolLimit: symbolLimit === 0 ? undefined : symbolLimit, // 0 = unlimited
          singleSymbol: singleSymbol.trim() || undefined,
          config: {
            minLiquidity24h: 10000000,
            entryFeePct: 0.075,
            exitFeePct: 0.075,
            entrySlippagePct: 0.1,
            exitSlippagePct: 0.1,
            minMomentumScore
          },
          includePath: true // We need this for the simulator
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message || 'Backtest started successfully in the background.');
        setActiveTab('history');
      } else {
        alert('Error: ' + data.error);
      }
    } catch (e) {
      alert('Error running backtest');
    }
    setIsRunning(false);
  };

  const loadResultFile = async (filename: string) => {
    setLoadingResults(true);
    try {
      const res = await fetch(`/api/momentum/${filename}`, { headers: authHeaders });
      const data = await res.json();
      setSelectedResults(data); // it sends the raw array (or object if wrapped, we assume it's the JSON array directly)
      setActiveTab('analysis');
    } catch (e) {
      console.error(e);
      alert('Eroare la incarcarea fisierului');
    }
    setLoadingResults(false);
  };

  const deleteResultFile = async (filename: string) => {
    if (!confirm(language === 'ro' ? `Sigur doriți să ștergeți fișierul ${filename}?` : `Are you sure you want to delete ${filename}?`)) {
      return;
    }
    try {
      const res = await fetch(`/api/momentum/${filename}`, {
        method: 'DELETE',
        headers: authHeaders
      });
      const data = await res.json();
      if (data.success) {
        fetchHistory();
      } else {
        alert('Error: ' + data.error);
      }
    } catch (e) {
      console.error(e);
      alert('Eroare la ștergerea fișierului');
    }
  };

  // --- Simulator & Analytics Logic ---
  const simulationResults = useMemo(() => {
    if (!selectedResults) return null;

    let totalTrades = 0;
    let originalWins = 0;
    let simWins = 0;
    let originalPnL = 0;
    let simPnL = 0;

    const timeCurveData: any = { '2h': 0, '4h': 0, '8h': 0, '12h': 0, '20h': 0, '24h': 0 };

    const scatterData = selectedResults.map((r) => {
      totalTrades++;
      
      // Original Baseline
      originalPnL += r.netPnL_at_24h_Pct;
      if (r.netPnL_at_24h_Pct > 0) originalWins++;

      // Averages for curve
      timeCurveData['2h'] += r.plus_2h_Pct;
      timeCurveData['4h'] += r.plus_4h_Pct;
      timeCurveData['8h'] += r.plus_8h_Pct;
      timeCurveData['12h'] += r.plus_12h_Pct;
      timeCurveData['20h'] += r.plus_20h_Pct;
      timeCurveData['24h'] += r.plus_24h_Pct;

      // Simulated Return
      let simulatedReturn = r.netPnL_at_24h_Pct; // default fallback
      if (r.path && r.path.length > 0) {
        let maxHigh = 0;
        let trailingActive = false;

        for (const k of r.path) {
          // SL hit (assume low hits before high for safety/conservatism)
          if (slPct > 0 && k.lowPct <= -slPct) {
            simulatedReturn = -slPct - r.totalTradingCostPct;
            break;
          }
          
          // TP hit
          if (tpPct > 0 && k.highPct >= tpPct) {
            simulatedReturn = tpPct - r.totalTradingCostPct;
            break;
          }

          // Trailing Stop logic (Evaluat cu maxHigh precedent pentru a evita intra-bar look-ahead bias)
          if (trailingAct > 0 && trailingDist > 0) {
             if (trailingActive && k.lowPct <= (maxHigh - trailingDist)) {
               simulatedReturn = (maxHigh - trailingDist) - r.totalTradingCostPct;
               break;
             }
             
             // Actualizăm trailing-ul pentru următoarea lumânare (următoarea iterație)
             if (k.highPct >= trailingAct) trailingActive = true;
             maxHigh = Math.max(maxHigh, k.highPct);
          }
        }
      }

      simPnL += simulatedReturn;
      if (simulatedReturn > 0) simWins++;

      return {
        x: r.MAE_Pct, // negative usually
        y: r.MFE_Pct, // positive usually
        pnl: simulatedReturn,
        isOriginalWin: r.netPnL_at_24h_Pct > 0,
        symbol: r.symbol
      };
    });

    if (totalTrades > 0) {
      Object.keys(timeCurveData).forEach(k => timeCurveData[k] /= totalTrades);
    }

    const curveArray = [
      { name: '2h', return: timeCurveData['2h'] },
      { name: '4h', return: timeCurveData['4h'] },
      { name: '8h', return: timeCurveData['8h'] },
      { name: '12h', return: timeCurveData['12h'] },
      { name: '20h', return: timeCurveData['20h'] },
      { name: '24h', return: timeCurveData['24h'] },
    ];

    return {
      totalTrades,
      originalWinRate: totalTrades ? (originalWins / totalTrades) * 100 : 0,
      simWinRate: totalTrades ? (simWins / totalTrades) * 100 : 0,
      originalPnL,
      simPnL,
      scatterData,
      curveArray
    };

  }, [selectedResults, slPct, tpPct, trailingAct, trailingDist]);


  return (
    <div className="flex h-full bg-slate-950 text-slate-300 font-sans">
      
      {/* Sidebar Nav pt Modul */}
      <div className="w-64 border-r border-slate-800 p-4 flex flex-col gap-2">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <Activity size={24} className="text-blue-500" /> Momentum
        </h2>
        
        <button 
          onClick={() => setActiveTab('run')}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'run' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'hover:bg-slate-900 border border-transparent'}`}
        >
          <Play size={18} /> New Backtest
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'history' ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30' : 'hover:bg-slate-900 border border-transparent'}`}
        >
          <Download size={18} /> Saved Runs
        </button>
        <button 
          onClick={() => { if(selectedResults) setActiveTab('analysis'); }}
          disabled={!selectedResults}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === 'analysis' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'hover:bg-slate-900 border border-transparent opacity-50'}`}
        >
          <BarChart2 size={18} /> Analysis
        </button>
      </div>

      {/* Continut Principal */}
      <div className="flex-1 overflow-auto p-8 relative">
        
        {activeTab === 'run' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <h1 className="text-3xl font-light text-white mb-2">Configure Backtest</h1>
            <p className="text-slate-400 mb-8">Rulează backtest pe universul Binance bazat pe momentum și lichiditate.</p>
            
            <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Start Date</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all outline-none" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">End Date</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all outline-none" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Symbol Limit (0 = All)</label>
                  <input type="number" value={symbolLimit} onChange={e => setSymbolLimit(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:border-blue-500 transition-all outline-none" />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-2">Min Momentum Score</label>
                  <input type="number" value={minMomentumScore} onChange={e => setMinMomentumScore(Number(e.target.value))} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:border-blue-500 transition-all outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-sm text-slate-400 mb-2">Single Asset Override (Optional, e.g. BTCUSDT)</label>
                <input 
                  type="text" 
                  placeholder="e.g. BTCUSDT (lăsați gol pentru întregul univers)" 
                  value={singleSymbol} 
                  onChange={e => setSingleSymbol(e.target.value)} 
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-white focus:border-blue-500 transition-all outline-none uppercase font-mono" 
                />
                <p className="text-xs text-slate-500 mt-1">Dacă completați un simbol, backtest-ul se va rula exclusiv pentru acel activ.</p>
              </div>

              <button 
                onClick={runBacktest} 
                disabled={isRunning}
                className="w-full mt-6 bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-lg transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isRunning ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/> : <Play size={20} />}
                {isRunning ? 'Running (This may take a while)...' : 'Run Backtest'}
              </button>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="max-w-4xl mx-auto space-y-6">
             <div className="flex items-center justify-between mb-8">
               <h1 className="text-3xl font-light text-white">Saved Backtests</h1>
               <button onClick={fetchHistory} className="text-blue-400 hover:text-blue-300 text-sm">Refresh List</button>
             </div>
             
             {loadingHistory ? (
               <div className="text-center py-12 text-slate-500">Loading history...</div>
             ) : (
               <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                 <table className="w-full text-left">
                   <thead className="bg-slate-950/50 border-b border-slate-800">
                     <tr>
                       <th className="px-6 py-4 font-medium text-slate-400 text-sm">File Name</th>
                       <th className="px-6 py-4 font-medium text-slate-400 text-sm">Date Saved</th>
                       <th className="px-6 py-4 font-medium text-slate-400 text-sm">Size (MB)</th>
                       <th className="px-6 py-4 font-medium text-slate-400 text-sm text-right">Action</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-800/50">
                     {historyFiles.map(f => (
                       <tr key={f.filename} className="hover:bg-slate-800/30 transition-colors">
                         <td className="px-6 py-4 text-white text-sm font-mono">{f.filename}</td>
                         <td className="px-6 py-4 text-slate-400 text-sm">{new Date(f.createdAt).toLocaleString()}</td>
                         <td className="px-6 py-4 text-slate-400 text-sm">{f.sizeMB} MB</td>
                         <td className="px-6 py-4 text-right">
                           <button 
                             onClick={() => loadResultFile(f.filename)}
                             disabled={loadingResults}
                             className="text-blue-400 hover:text-blue-300 flex items-center justify-end gap-1 w-full"
                           >
                             {loadingResults ? 'Loading...' : 'Load & Analyze'} <ChevronRight size={16} />
                           </button>
                         </td>
                       </tr>
                     ))}
                     {historyFiles.length === 0 && (
                       <tr><td colSpan={4} className="text-center py-8 text-slate-500">No saved backtests found in server/data/backtests/</td></tr>
                     )}
                   </tbody>
                 </table>
               </div>
             )}
          </div>
        )}

        {activeTab === 'analysis' && simulationResults && (
          <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-300">
            <h1 className="text-3xl font-light text-white mb-2">Backtest Analysis</h1>
            
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800">
                <div className="text-sm text-slate-400 mb-1">Total Trades</div>
                <div className="text-2xl font-bold text-white">{simulationResults.totalTrades}</div>
              </div>
              <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800">
                <div className="text-sm text-slate-400 mb-1">Baseline Win Rate</div>
                <div className="text-2xl font-bold text-slate-300">{simulationResults.originalWinRate.toFixed(1)}%</div>
              </div>
              <div className="bg-slate-900 p-5 rounded-2xl border border-blue-900/50 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                <div className="text-sm text-blue-400 mb-1">Simulated Win Rate</div>
                <div className="text-2xl font-bold text-white">{simulationResults.simWinRate.toFixed(1)}%</div>
              </div>
              <div className="bg-slate-900 p-5 rounded-2xl border border-blue-900/50 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                <div className="text-sm text-blue-400 mb-1">Simulated Net PnL</div>
                <div className={`text-2xl font-bold ${simulationResults.simPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {simulationResults.simPnL > 0 ? '+' : ''}{simulationResults.simPnL.toFixed(2)}%
                </div>
              </div>
            </div>

            <div className="grid grid-cols-12 gap-6">
              
              {/* Simulator Controls */}
              <div className="col-span-12 lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-lg font-medium text-white mb-6 flex items-center gap-2"><Settings size={18}/> SL/TP/Trailing Simulator</h3>
                <p className="text-xs text-slate-500 mb-6 leading-relaxed">Adjust parameters below to dynamically recalculate execution paths based on the 15m candle sequences of each trade.</p>
                
                <div className="space-y-6">
                  <div>
                     <div className="flex justify-between text-sm mb-2">
                       <span className="text-slate-400">Stop Loss (%)</span>
                       <span className="text-white font-mono">{slPct}%</span>
                     </div>
                     <input type="range" min="0" max="15" step="0.5" value={slPct} onChange={e => setSlPct(Number(e.target.value))} className="w-full accent-red-500" />
                  </div>
                  <div>
                     <div className="flex justify-between text-sm mb-2">
                       <span className="text-slate-400">Take Profit (%)</span>
                       <span className="text-white font-mono">{tpPct}%</span>
                     </div>
                     <input type="range" min="0" max="25" step="0.5" value={tpPct} onChange={e => setTpPct(Number(e.target.value))} className="w-full accent-green-500" />
                  </div>
                  <div className="pt-4 border-t border-slate-800">
                     <div className="flex justify-between text-sm mb-2">
                       <span className="text-slate-400">Trailing Activation (%)</span>
                       <span className="text-white font-mono">{trailingAct}%</span>
                     </div>
                     <input type="range" min="0" max="15" step="0.5" value={trailingAct} onChange={e => setTrailingAct(Number(e.target.value))} className="w-full accent-blue-500" />
                  </div>
                  <div>
                     <div className="flex justify-between text-sm mb-2">
                       <span className="text-slate-400">Trailing Distance (%)</span>
                       <span className="text-white font-mono">{trailingDist}%</span>
                     </div>
                     <input type="range" min="0" max="10" step="0.5" value={trailingDist} onChange={e => setTrailingDist(Number(e.target.value))} className="w-full accent-blue-500" />
                  </div>
                </div>
              </div>

              {/* MFE vs MAE Scatter */}
              <div className="col-span-12 lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-lg font-medium text-white mb-6">MAE vs MFE Distribution</h3>
                <div className="h-80 w-full text-xs">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis type="number" dataKey="x" name="MAE (%)" stroke="#64748b" tick={{fill: '#64748b'}} domain={['auto', 0]} />
                      <YAxis type="number" dataKey="y" name="MFE (%)" stroke="#64748b" tick={{fill: '#64748b'}} domain={[0, 'auto']} />
                      <RechartsTooltip cursor={{strokeDasharray: '3 3'}} contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }} />
                      <Scatter name="Trades" data={simulationResults.scatterData}>
                        {simulationResults.scatterData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.isOriginalWin ? '#22c55e' : '#ef4444'} fillOpacity={0.6} />
                        ))}
                      </Scatter>
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Average Return Curve */}
              <div className="col-span-12 bg-slate-900 border border-slate-800 rounded-2xl p-6">
                 <h3 className="text-lg font-medium text-white mb-6 flex items-center gap-2"><Clock size={18}/> Average Return Curve (Baseline 24h)</h3>
                 <div className="h-64 w-full text-xs">
                   <ResponsiveContainer width="100%" height="100%">
                     <LineChart data={simulationResults.curveArray} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                       <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                       <XAxis dataKey="name" stroke="#64748b" tick={{fill: '#64748b'}} />
                       <YAxis stroke="#64748b" tick={{fill: '#64748b'}} />
                       <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }} />
                       <Line type="monotone" dataKey="return" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6' }} activeDot={{ r: 6 }} />
                     </LineChart>
                   </ResponsiveContainer>
                 </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}
