import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { useTradingStore } from '../store';
import { PositionTimer } from './PositionTimer';
import { fetchLivePrice, fetchChartData } from '../services/api';
import { ArrowUpRight, ArrowDownRight, Wallet, TrendingUp, AlertTriangle, Trash2, Newspaper, ExternalLink, RefreshCw, ShoppingCart, ArrowUpCircle, ArrowDownCircle, Zap, CheckCircle2, Heart, Radio } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { NewsArticle } from '../types';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export function Dashboard() {
  const { 
    balance, 
    positions, 
    maxHoldMinutes,
    watchlist, 
    marketOpportunities,
    symbolStats,
    lastScanAt,
    triggerScanOpportunities,
    logs, 
    initialBalance, 
    updatePrice, 
    addWatchlist, 
    toggleWatchlistActive, 
    removeWatchlist, 
    autoTradingActive, 
    setAutoTradingActive, 
    binanceMode, 
    syncBinanceBalance,
    executeTrade
  } = useTradingStore();

  const [newSymbol, setNewSymbol] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isScanningOpps, setIsScanningOpps] = useState(false);
  const [oppFilter, setOppFilter] = useState<'TOP20' | 'ALL'>('TOP20');

  const oppsList = Array.isArray(marketOpportunities) ? marketOpportunities : [];
  const statsMap = symbolStats && typeof symbolStats === 'object' ? symbolStats : {};

  const handleScanOpportunities = async () => {
    setIsScanningOpps(true);
    await triggerScanOpportunities();
    setTimeout(() => setIsScanningOpps(false), 500);
  };
  
  const [activeChartId, setActiveChartId] = useState('PORTFOLIO');
  const [assetChartData, setAssetChartData] = useState<{time: string, value: number}[]>([]);
  const [recentNews, setRecentNews] = useState<NewsArticle[]>([]);

  // State for Quick Trade Widget
  const [tradeSymbol, setTradeSymbol] = useState('BTCUSDT');
  const [tradeAmountUsdt, setTradeAmountUsdt] = useState<number>(10);
  const [tradeMessage, setTradeMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/news')
      .then(res => res.json())
      .then(data => {
        if (data.articles) setRecentNews(data.articles.slice(0, 3));
      })
      .catch(err => console.debug('News fetch error on dashboard:', err));
  }, []);

  const equity = balance + positions.reduce((acc, pos) => acc + (pos.amount * (pos.currentPrice || pos.entryPrice)), 0);
  const dayChange = equity - initialBalance;
  const dayChangePercent = (dayChange / initialBalance) * 100;

  useEffect(() => {
    if (activeChartId === 'PORTFOLIO') return;

    let mounted = true;
    setAssetChartData([]); // Clear previous while loading
    fetchChartData(activeChartId).then(data => {
      if (mounted) setAssetChartData(data);
    });

    return () => { mounted = false; };
  }, [activeChartId]);

  // Use dynamic performance data using local state simulation
  const portfolioChartData = React.useMemo(() => {
    const data = logs
      .filter(log => log.equity !== undefined)
      .map(log => ({ time: log.time, value: log.equity as number }))
      .reverse();
    
    if (data.length === 0) {
      return [
        { time: 'Start', value: initialBalance },
        { time: 'Now', value: equity }
      ];
    }
    
    // Add start and current equity if we have some data points
    return [
      { time: 'Start', value: initialBalance },
      ...data,
      { time: 'Now', value: equity }
    ];
  }, [logs, equity, initialBalance]);

  const displayChartData = activeChartId === 'PORTFOLIO' 
    ? portfolioChartData
    : assetChartData;

  const yDomain = React.useMemo(() => {
    if (!displayChartData || displayChartData.length === 0) return ['auto', 'auto'];
    const values = displayChartData
      .map(d => Number(d.value))
      .filter(v => typeof v === 'number' && !isNaN(v));
    
    if (values.length === 0) return ['auto', 'auto'];

    const min = Math.min(...values);
    const max = Math.max(...values);

    // If min == max or virtually flat range (less than 0.5% variation)
    if (min === max || (max - min) / (min || 1) < 0.005) {
      const padding = min === 0 ? 10 : Math.abs(min) * 0.05; // 5% padding around equity
      const lower = Math.max(0, min - padding);
      const upper = max + padding;
      return [Number(lower.toFixed(2)), Number(upper.toFixed(2))];
    }

    // Dynamic padding around real min & max
    const range = max - min;
    const padding = Math.max(range * 0.15, min * 0.01);
    const lower = Math.max(0, min - padding);
    const upper = max + padding;
    return [Number(lower.toFixed(2)), Number(upper.toFixed(2))];
  }, [displayChartData]);

  const maxDrawdown = React.useMemo(() => {
    if (!displayChartData.length) return "0.0%";
    let max = displayChartData[0].value;
    let maxDD = 0;
    for (const point of displayChartData) {
      if (point.value > max) {
        max = point.value;
      }
      const dd = (max - point.value) / max * 100;
      if (dd > maxDD) {
        maxDD = dd;
      }
    }
    return `${maxDD.toFixed(2)}%`;
  }, [displayChartData]);

  const { sharpeNum, sharpeRatioStr } = React.useMemo(() => {
    if (displayChartData.length < 2) return { sharpeNum: 0, sharpeRatioStr: "0.00" };
    const returns: number[] = [];
    for (let i = 1; i < displayChartData.length; i++) {
      const prev = displayChartData[i - 1].value;
      if (prev > 0) {
        returns.push((displayChartData[i].value - prev) / prev);
      }
    }
    if (returns.length === 0) return { sharpeNum: 0, sharpeRatioStr: "0.00" };

    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((a, b) => a + Math.pow(b - avgReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev === 0) {
      const fallbackVal = avgReturn > 0 ? 1 : (avgReturn < 0 ? -1 : 0);
      return { sharpeNum: fallbackVal, sharpeRatioStr: fallbackVal.toFixed(2) };
    }

    // Standardize scaling according to sample size so small sample counts don't explode
    const samples = returns.length;
    const factor = samples >= 30 ? Math.sqrt(252) : Math.sqrt(Math.max(1, samples));
    let val = (avgReturn / stdDev) * factor;

    // Clamp extreme noise for UI clarity
    if (val > 10) val = 10;
    if (val < -10) val = -10;

    return { sharpeNum: val, sharpeRatioStr: val.toFixed(2) };
  }, [displayChartData]);

  useEffect(() => {
    const fetchAllPrices = async () => {
      watchlist.forEach(async (item) => {
        const price = await fetchLivePrice(item.symbol);
        if (price) {
          updatePrice(item.symbol, price);
        }
      });
    };
    
    // Initial fetch
    fetchAllPrices();
  }, [watchlist.map(w => w.symbol).join(','), updatePrice]);

  const handleManualTrade = async (symbol: string, action: 'BUY' | 'SELL', usdtAmount: number) => {
    let price = watchlist.find(w => w.symbol === symbol)?.price;
    if (!price || price <= 0) {
      price = await fetchLivePrice(symbol);
    }
    
    if (!price || price <= 0) {
      setTradeMessage(`❌ Eroare: Prețul pentru ${symbol} nu s-a putut prelua.`);
      return;
    }

    if (action === 'BUY') {
      if (balance < usdtAmount) {
        setTradeMessage(`❌ Fonduri insuficiente! Cash disponibil: $${balance.toFixed(2)} USDT.`);
        return;
      }
      const qty = usdtAmount / price;
      executeTrade(symbol, 'BUY', price, qty);
      setTradeMessage(`✅ Ordin Cumpărare executat: ${qty.toFixed(4)} ${symbol} ($${usdtAmount} USDT)`);
    } else {
      const pos = positions.find(p => p.symbol === symbol);
      if (!pos || pos.amount <= 0) {
        setTradeMessage(`❌ Nu aveți nicio poziție deschisă pe ${symbol}.`);
        return;
      }
      executeTrade(symbol, 'SELL', price, pos.amount);
      setTradeMessage(`✅ Ordin Vânzare executat: Închisă poziția de ${symbol} @ $${price.toFixed(2)}`);
    }

    setTimeout(() => setTradeMessage(null), 6000);
  };

  const handleAddSymbol = () => {
    if (newSymbol.trim()) {
      addWatchlist(newSymbol.trim().toUpperCase());
      setNewSymbol('');
    }
  };

  return (
    <div className="flex flex-col h-full">
      <header className="min-h-20 border-b border-white/5 flex flex-col md:flex-row items-start md:items-center justify-between px-4 sm:px-8 py-3 md:py-0 bg-zinc-900/10 backdrop-blur-md shrink-0 gap-3">
        <div className="flex flex-wrap items-center gap-4 sm:gap-8 w-full md:w-auto">
          <div>
            <p className="text-[10px] uppercase text-zinc-500 tracking-wider mb-0.5">
              {binanceMode === 'testnet' ? 'Capital Testnet' : binanceMode === 'live' ? 'Capital Real Binance' : 'Capital Virtual (Paper)'}
            </p>
            <p className="font-serif text-lg sm:text-xl font-medium">${Number(equity || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} <span className={cn("text-xs sm:text-sm font-sans ml-1", dayChangePercent >= 0 ? "text-emerald-400" : "text-rose-400")}>{dayChangePercent >= 0 ? '+' : ''}{(dayChangePercent || 0).toFixed(2)}%</span></p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-zinc-500 tracking-wider mb-0.5">
              {binanceMode === 'testnet' ? 'Profit Testnet' : binanceMode === 'live' ? 'Profit Real' : 'Profit Virtual'}
            </p>
            <p className={cn("font-serif text-lg sm:text-xl font-medium", dayChange >= 0 ? "text-emerald-400" : "text-rose-400")}>{dayChange >= 0 ? '+' : ''}${Number(dayChange || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase text-zinc-500 tracking-wider mb-0.5">Cash USDT Liber</p>
            <p className="font-serif text-lg sm:text-xl font-medium">${Number(balance || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-2 sm:gap-4 w-full md:w-auto justify-between md:justify-end">
          {binanceMode !== 'paper' && (
            <button
              type="button"
              disabled={isSyncing}
              onClick={async () => {
                setIsSyncing(true);
                await syncBinanceBalance();
                setIsSyncing(false);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
              title="Sincronizează balanța din contul Binance Testnet / Live"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isSyncing && "animate-spin")} />
              <span>Sincronizează Balanța</span>
            </button>
          )}

          <button 
            onClick={() => setAutoTradingActive(!autoTradingActive)}
            className={cn(
              "flex items-center gap-2 px-3 sm:px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer border shadow-sm shrink-0",
              autoTradingActive 
                ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20" 
                : "bg-rose-500/10 border-rose-500/40 text-rose-400 hover:bg-rose-500/20"
            )}
            title="Apasă pentru a porni sau opri motorul de tranzacționare de pe server"
          >
            <span className={cn("w-2 h-2 rounded-full", autoTradingActive ? "bg-emerald-400 animate-pulse" : "bg-rose-500")}></span>
            {autoTradingActive ? "Server 24/7: ACTIV (Stop)" : "Server 24/7: OPRIT (Start)"}
          </button>
          
          <div className={cn(
            "px-3 py-1.5 border rounded-full text-[11px] sm:text-xs font-medium",
            binanceMode === 'testnet' 
              ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
              : binanceMode === 'live'
              ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
              : "border-white/10 text-zinc-400"
          )}>
            {binanceMode === 'testnet' ? 'Binance Testnet' : binanceMode === 'live' ? 'Binance LIVE' : 'Paper Mode'}
          </div>
        </div>
      </header>

      <div className="p-8 overflow-y-auto flex-1 space-y-6">
        <div className="grid grid-cols-12 gap-6">
          {/* Chart Section */}
          <div className="col-span-12 bg-zinc-900/50 border border-white/5 rounded-2xl p-6 relative overflow-x-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="font-serif text-lg text-white">Performanță / Istoric (24h)</h2>
                <p className="text-xs text-zinc-400 mt-0.5">Grafic în timp real: <span className="font-mono font-bold text-emerald-400">{activeChartId === 'PORTFOLIO' ? 'Portofoliu Global' : activeChartId}</span></p>
              </div>
              <div className="flex gap-2">
                <span className="px-2 py-1 bg-white/10 text-white rounded text-[10px] font-mono">1D (Binance Klines)</span>
              </div>
            </div>

            <div className="flex flex-col xl:flex-row gap-6 items-start overflow-x-auto pb-2">
              {/* Left Side: Chart Area with exact 1045px width and 600px height */}
              <div className="w-[700px] shrink-0 h-[360px]" style={{ width: '700px', height: '360px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={displayChartData}>
                    <defs>
                      <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis dataKey="time" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis 
                      domain={yDomain} 
                      stroke="#52525b" 
                      fontSize={10} 
                      tickLine={false} 
                      axisLine={false}
                      tickFormatter={(value) => {
                        const num = Number(value || 0);
                        if (activeChartId === 'PORTFOLIO') {
                          if (num >= 100000) return `$${(num / 1000).toFixed(0)}k`;
                          if (num >= 10000) return `$${(num / 1000).toFixed(1)}k`;
                          if (num >= 1000) return `$${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
                          return `$${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
                        } else {
                          if (num < 0.01) return `$${num.toFixed(6)}`;
                          if (num < 1) return `$${num.toFixed(4)}`;
                          if (num < 10) return `$${num.toFixed(2)}`;
                          if (num >= 10000) return `$${(num / 1000).toFixed(1)}k`;
                          return `$${num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
                        }
                      }}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px', color: '#f4f4f5', fontSize: '12px', fontFamily: 'monospace' }}
                      itemStyle={{ color: '#10b981' }}
                      formatter={(value: any) => [`$${Number(value || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 6})}`, activeChartId === 'PORTFOLIO' ? 'Portofoliu' : activeChartId]}
                    />
                    <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#a1a1aa' }} />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      name={activeChartId === 'PORTFOLIO' ? 'Portofoliu Global' : activeChartId}
                      stroke="#10b981" 
                      strokeWidth={2} 
                      fillOpacity={1} 
                      fill="url(#colorEquity)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Right Side Column: Grouped Watchlist Coins */}
              <div className="w-full xl:w-72 shrink-0 h-[300px] bg-zinc-950/70 border border-white/5 rounded-xl p-3 flex flex-col gap-2">
                <div className="flex items-center justify-between pb-1.5 border-b border-white/5">
                  <span className="text-[10px] uppercase font-mono tracking-wider text-zinc-400">Selectează Grafic</span>
                  <span className="text-[10px] font-mono text-zinc-500">{watchlist.length} Monede</span>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveChartId('PORTFOLIO')}
                  className={cn(
                    "w-full px-2.5 py-1.5 text-xs rounded-lg transition-colors font-medium flex items-center justify-between border cursor-pointer shrink-0",
                    activeChartId === 'PORTFOLIO' 
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 font-bold shadow-sm" 
                      : "bg-white/5 text-zinc-300 border-white/5 hover:bg-white/10"
                  )}
                >
                  <span>📊 Portofoliu Global</span>
                  {activeChartId === 'PORTFOLIO' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>}
                </button>

                <div className="text-[9px] uppercase font-mono tracking-wider text-zinc-500 mt-1 shrink-0">
                  Active din Watchlist
                </div>

                <div className="grid grid-cols-2 gap-1.5 flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
                  {watchlist.map(w => (
                    <button
                      key={w.symbol}
                      type="button"
                      onClick={() => setActiveChartId(w.symbol)}
                      className={cn(
                        "px-2 py-1 text-[10px] font-mono rounded transition-colors text-left flex items-center justify-between border cursor-pointer truncate",
                        activeChartId === w.symbol
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold"
                          : w.active
                          ? "bg-zinc-800/80 text-zinc-300 border-white/5 hover:bg-zinc-700/80"
                          : "bg-zinc-900/40 text-zinc-500 border-white/5 hover:text-zinc-300"
                      )}
                      title={`Afișează evoluția ${w.symbol}`}
                    >
                      <span className="truncate">{w.symbol.replace('USDT', '')}</span>
                      <span className="text-[8px] opacity-50">USDT</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            
            <div className="grid grid-cols-3 gap-4 mt-8">
              <div className="p-4 bg-zinc-800/40 rounded-xl border border-white/5">
                <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Total Positions</p>
                <p className="text-xl font-serif">{positions.length}</p>
              </div>
              <div className="p-4 bg-zinc-800/40 rounded-xl border border-white/5">
                <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Max Drawdown (Sim)</p>
                <p className="text-xl font-serif">{maxDrawdown}</p>
              </div>
              <div className="p-4 bg-zinc-800/40 rounded-xl border border-white/5">
                <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Sharpe Ratio</p>
                <p className={cn(
                  "text-xl font-serif font-bold",
                  sharpeNum > 0 ? "text-emerald-400" : sharpeNum < 0 ? "text-rose-400" : "text-zinc-400"
                )}>
                  {sharpeRatioStr}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Manual Trade Panel */}
          <div className="col-span-12 bg-zinc-900/50 border border-white/5 rounded-2xl p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="font-serif text-lg text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-400" />
                  Tranzacționare Rapidă Spot (Ordin Cumpărare / Vânzare Instant)
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Lansați manual un ordin pe {binanceMode === 'testnet' ? 'Binance Testnet' : binanceMode === 'live' ? 'Binance Real (LIVE)' : 'Paper Mode (Virtual)'}
                </p>
              </div>

              {tradeMessage && (
                <div className="px-3 py-1.5 rounded-lg text-xs font-mono bg-zinc-800 border border-white/10 text-emerald-300 flex items-center gap-2">
                  <span>{tradeMessage}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1 font-mono">Selectează Moneda</label>
                <select
                  value={tradeSymbol}
                  onChange={(e) => setTradeSymbol(e.target.value)}
                  className="w-full bg-zinc-800 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-500/50"
                >
                  {watchlist.map(item => (
                    <option key={item.symbol} value={item.symbol}>
                      {item.symbol} {item.price ? `($${Number(item.price).toFixed(2)})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1 font-mono flex items-center justify-between">
                  <span>Suma în USDT (Custom sau Butoane)</span>
                  <span className="text-zinc-400 font-sans normal-case text-[10px]">Min: $1 USDT</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <div className="relative flex-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500 text-xs font-mono">$</span>
                    <input
                      type="number"
                      min={1}
                      step="any"
                      value={tradeAmountUsdt || ''}
                      onChange={(e) => setTradeAmountUsdt(e.target.value === '' ? 0 : Number(e.target.value))}
                      placeholder="Suma custom..."
                      className="w-full bg-zinc-800 border border-white/10 rounded-lg pl-6 pr-2 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-500/50"
                    />
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {[10, 20, 50, 100].map(amt => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => setTradeAmountUsdt(amt)}
                        className={cn(
                          "px-2 py-1.5 rounded text-[10px] font-mono border transition-colors",
                          tradeAmountUsdt === amt ? "bg-amber-500/20 text-amber-300 border-amber-500/40 font-semibold" : "bg-zinc-800 text-zinc-400 border-white/5 hover:text-white"
                        )}
                      >
                        ${amt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-2 col-span-1 sm:col-span-2 md:col-span-2">
                <button
                  type="button"
                  onClick={() => handleManualTrade(tradeSymbol, 'BUY', tradeAmountUsdt)}
                  className="flex-1 px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-lg font-mono text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <ArrowUpCircle className="w-4 h-4 text-emerald-400" />
                  <span>CUMPĂRĂ ({tradeSymbol})</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleManualTrade(tradeSymbol, 'SELL', tradeAmountUsdt)}
                  className="flex-1 px-4 py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-lg font-mono text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <ArrowDownCircle className="w-4 h-4 text-rose-400" />
                  <span>VINDE / ÎNCHIDE</span>
                </button>
              </div>
            </div>
          </div>

          {/* AI.TRADE Bot 2.0 - Opportunity Score & Dynamic Watchlist Scanner */}
          <div className="col-span-12 bg-gradient-to-b from-zinc-900/90 via-zinc-900/60 to-zinc-900/40 border border-emerald-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 relative z-10">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-bold uppercase tracking-wider">
                    AI.TRADE Bot 2.0 Engine
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400">
                    {lastScanAt ? `Scanat: ${new Date(lastScanAt).toLocaleTimeString()}` : 'Scanare Automată Continuă'}
                  </span>
                </div>
                <h2 className="font-serif italic text-xl font-bold text-white mt-1 flex items-center gap-2">
                  <span>🎯 Clasament Oportunități Scalping (Opportunity Score 0–100)</span>
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Serverul scanează automat peste 100-150 perechi USDT pe Binance și mută capitalul exclusiv în primele 15-20 cele mai promițătoare oportunități ale momentului.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="flex bg-zinc-800/80 p-1 rounded-xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => setOppFilter('TOP20')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer",
                      oppFilter === 'TOP20' ? "bg-emerald-500 text-black font-bold shadow-sm" : "text-zinc-400 hover:text-white"
                    )}
                  >
                    Top 20 Dynamic Watchlist
                  </button>
                  <button
                    type="button"
                    onClick={() => setOppFilter('ALL')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer",
                      oppFilter === 'ALL' ? "bg-emerald-500 text-black font-bold shadow-sm" : "text-zinc-400 hover:text-white"
                    )}
                  >
                    Toate Oportunitățile ({oppsList.length})
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleScanOpportunities}
                  disabled={isScanningOpps}
                  className="px-4 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-xl font-mono text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  <RefreshCw className={cn("w-4 h-4 text-emerald-400", isScanningOpps && "animate-spin")} />
                  <span>{isScanningOpps ? 'Se scanează...' : 'Scanează Piața Instant'}</span>
                </button>
              </div>
            </div>

            {/* Opportunities Table */}
            <div className="overflow-x-auto relative z-10 rounded-xl border border-white/5 bg-black/40">
              <table className="w-full text-left text-xs font-mono text-zinc-300">
                <thead className="text-[10px] uppercase tracking-wider text-zinc-400 bg-zinc-900/90 border-b border-white/10">
                  <tr>
                    <th className="py-3 px-3">Rank</th>
                    <th className="py-3 px-3">Pereche USDT</th>
                    <th className="py-3 px-3 text-center">Opportunity Score</th>
                    <th className="py-3 px-3 text-right">Preț Curent</th>
                    <th className="py-3 px-3 text-center">Volatilitate (ATR%)</th>
                    <th className="py-3 px-3 text-center">Volum 24h</th>
                    <th className="py-3 px-3 text-center">ML / Reversal</th>
                    <th className="py-3 px-3 text-center">Performanță Istorică</th>
                    <th className="py-3 px-3 text-right">Status Rotire</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {(oppFilter === 'TOP20' ? oppsList.slice(0, 20) : oppsList).length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-zinc-500">
                        {isScanningOpps ? 'Se scanează universul Binance USDT...' : 'Apăsați "Scanează Piața Instant" pentru a calcula Opportunity Score pe întreaga piață.'}
                      </td>
                    </tr>
                  ) : (
                    (oppFilter === 'TOP20' ? oppsList.slice(0, 20) : oppsList).map((opp, idx) => {
                      const symStat = statsMap[opp.symbol];
                      const isTopDynamic = idx < 20;

                      return (
                        <tr key={opp.symbol} className={cn("hover:bg-white/5 transition-colors", isTopDynamic && "bg-emerald-500/5")}>
                          <td className="py-2.5 px-3 font-bold">
                            <span className={cn(
                              "w-6 h-6 rounded-full inline-flex items-center justify-center text-[10px] font-bold border",
                              opp.rank === 1 && "bg-amber-500/20 text-amber-300 border-amber-500/40",
                              opp.rank === 2 && "bg-zinc-300/20 text-zinc-200 border-zinc-400/40",
                              opp.rank === 3 && "bg-amber-700/20 text-amber-400 border-amber-600/40",
                              opp.rank > 3 && "bg-zinc-800 text-zinc-400 border-white/5"
                            )}>
                              #{opp.rank || idx + 1}
                            </span>
                          </td>

                          <td className="py-2.5 px-3">
                            <div className="font-bold text-white text-sm flex items-center gap-1.5">
                              <span>{opp.symbol}</span>
                              {opp.reversalSignal === 'BULLISH_REVERSAL' && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">Reversal</span>
                              )}
                            </div>
                            <div className="text-[10px] text-zinc-500 truncate max-w-[220px]" title={opp.reason}>
                              {opp.reason}
                            </div>
                          </td>

                          <td className="py-2.5 px-3 text-center">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900 border border-white/10 font-bold text-sm">
                              <span className={cn(
                                opp.opportunityScore >= 75 ? "text-emerald-400 font-extrabold" : (opp.opportunityScore >= 60 ? "text-amber-400" : "text-zinc-400")
                              )}>
                                {opp.opportunityScore}/100
                              </span>
                            </div>
                          </td>

                          <td className="py-2.5 px-3 text-right font-bold text-zinc-100">
                            ${Number(opp.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                          </td>

                          <td className="py-2.5 px-3 text-center">
                            <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-white/5 text-[11px]">
                              {opp.atrPercent}% ATR
                            </span>
                          </td>

                          <td className="py-2.5 px-3 text-center">
                            <div className="font-bold text-zinc-200">
                              ${((opp.volume24h || 0) / 1000000).toFixed(1)}M
                            </div>
                            <div className={cn("text-[10px]", (opp.volumeGrowth24h || 0) >= 0 ? "text-emerald-400" : "text-rose-400")}>
                              {(opp.volumeGrowth24h || 0) >= 0 ? '+' : ''}{(opp.volumeGrowth24h || 0).toFixed(1)}% 24h
                            </div>
                          </td>

                          <td className="py-2.5 px-3 text-center">
                            <div className="text-emerald-400 font-bold">
                              AI: {opp.rfProb}%
                            </div>
                            <div className="text-[10px] text-zinc-400">
                              Meta: {opp.metaProb}%
                            </div>
                          </td>

                          <td className="py-2.5 px-3 text-center">
                            {symStat && symStat.totalTrades > 0 ? (
                              <div>
                                <div className={cn("font-bold text-[11px]", symStat.winRate >= 50 ? "text-emerald-400" : "text-rose-400")}>
                                  WR: {symStat.winRate}% ({symStat.wins}W/{symStat.losses}L)
                                </div>
                                <div className="text-[10px] text-zinc-400">
                                  PF: {symStat.profitFactor} | PnL: ${symStat.realizedPnL}
                                </div>
                              </div>
                            ) : (
                              <span className="text-zinc-500 text-[10px]">Netranzacționat</span>
                            )}
                          </td>

                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleManualTrade(opp.symbol, 'BUY', 10)}
                              className={cn(
                                "px-2.5 py-1 rounded text-[11px] font-bold border transition-all cursor-pointer",
                                isTopDynamic
                                  ? "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border-emerald-500/40"
                                  : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border-white/10"
                              )}
                            >
                              +Cumpără $10
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

          {/* Asset Selection / Watchlist */}
          <div className="col-span-12 xl:col-span-8 bg-zinc-900/50 border border-white/5 rounded-2xl p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-serif text-lg text-white">Selecție Active (Watchlist AI)</h2>
              <div className="relative">
                <input 
                  type="text" 
                  value={newSymbol}
                  onChange={(e) => setNewSymbol(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSymbol()}
                  placeholder="Caută simbol (ex: ETHUSDT)..." 
                  className="bg-zinc-800/40 border border-white/5 rounded-lg px-4 py-1.5 text-zinc-100 focus:outline-none focus:border-white/20 font-mono text-xs w-64"
                />
                <button 
                  onClick={handleAddSymbol}
                  className="absolute right-2 top-1.5 text-emerald-400 text-xs font-bold uppercase tracking-widest hover:text-emerald-300">
                  Adaugă
                </button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm font-mono text-zinc-400">
                <thead className="text-[10px] uppercase tracking-widest text-zinc-500 border-b border-white/5">
                  <tr>
                    <th className="pb-3 font-medium">Activ (Binance)</th>
                    <th className="pb-3 font-medium">Preț Curent</th>
                    <th className="pb-3 font-medium text-right">Semnal AI</th>
                    <th className="pb-3 font-medium text-right">Acțiuni Rapid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {watchlist.map((item) => (
                    <tr key={item.symbol}>
                      <td className="py-3 font-bold text-zinc-200">{item.symbol}</td>
                      <td className="py-3">{item.price ? `$${Number(item.price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}` : 'Se încarcă...'}</td>
                      <td className={`py-3 text-right font-bold tracking-wider ${item.signal?.action === 'BUY' ? 'text-emerald-400' : item.signal?.action === 'SELL' ? 'text-rose-400' : 'text-zinc-400'}`}>
                        {item.signal ? `${item.signal.action} (${item.signal.prob}%)` : '-'}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleManualTrade(item.symbol, 'BUY', 10)}
                            className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-[11px] font-bold transition-colors"
                            title="Cumpără $10 USDT din această monedă"
                          >
                            +$10
                          </button>
                          <button
                            type="button"
                            onClick={() => handleManualTrade(item.symbol, 'BUY', 50)}
                            className="px-2 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded text-[11px] font-bold transition-colors"
                            title="Cumpără $50 USDT din această monedă"
                          >
                            +$50
                          </button>
                          <button 
                            onClick={() => toggleWatchlistActive(item.symbol)}
                            className={`px-2.5 py-1 text-[11px] transition-colors rounded border ${item.active ? 'bg-amber-500/10 border-amber-500/20 text-amber-300 font-bold' : 'bg-white/5 hover:bg-white/10 text-white border-white/5'}`}>
                            {item.active ? 'Activ' : 'Inactiv'}
                          </button>
                          <button 
                            onClick={() => removeWatchlist(item.symbol)}
                            className="p-1 text-zinc-500 hover:text-rose-400 transition-colors rounded hover:bg-white/5"
                            title="Elimină activ">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-zinc-500 mt-4 text-center">Botul va procesa doar activele marcate ca "Activ". Date preluate gratuit via Binance Public API.</p>
          </div>

          {/* Active Positions */}
          <div className="col-span-12 xl:col-span-4 bg-zinc-900/50 border border-white/5 rounded-2xl p-6">
            <h2 className="font-serif text-lg mb-6 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_8px_blue]"></span>
              Poziții Curente ({binanceMode === 'testnet' ? 'Testnet' : binanceMode === 'live' ? 'Live' : 'Paper'})
            </h2>
            <div className="space-y-4">
              {positions.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-8 border border-white/5 rounded-xl border-dashed">
                  Nicio poziție deschisă. Apăsați "+Cumpără $50" de mai sus sau lăsați serverul 24/7 activ.
                </p>
              ) : (
                positions.map((pos, i) => {
                  const currentPrice = pos.currentPrice || pos.entryPrice;
                  const value = currentPrice * pos.amount;
                  const pl = value - (pos.entryPrice * pos.amount);
                  const plPercent = (pl / (pos.entryPrice * pos.amount)) * 100;
                  
                  return (
                    <div key={i} className="p-4 bg-zinc-800/40 rounded-xl border border-white/5 flex flex-col gap-3">
                      <div className="flex justify-between items-center gap-2">
                        <div className="flex items-center gap-2">
                          <p className="text-[12px] font-bold text-zinc-200 tracking-wider font-mono">{pos.symbol}</p>
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            BUY
                          </span>
                        </div>
                        <PositionTimer pos={pos} maxHoldMinutes={maxHoldMinutes} />
                        <p className={cn("text-xs font-mono font-bold", pl >= 0 ? "text-emerald-400" : "text-rose-400")}>
                          {pl >= 0 ? '+' : ''}{plPercent.toFixed(2)}%
                        </p>
                      </div>

                      <div className="flex justify-between items-end">
                        <div>
                           <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">Value (Qty)</p>
                           <p className="text-sm font-mono text-zinc-300">${Number(value || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} <span className="text-xs text-zinc-500">({pos.amount.toFixed(4)})</span></p>
                        </div>
                        <div className="text-right">
                           <p className="text-[10px] text-zinc-500 uppercase tracking-widest mb-1">P&L / Entry</p>
                           <p className={cn("text-sm font-mono", pl >= 0 ? "text-emerald-400" : "text-rose-400")}>
                             ${Number(Math.abs(pl) || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} <span className="text-xs text-zinc-500">(@ ${Number(pos.entryPrice || 0).toLocaleString(undefined, {maximumFractionDigits: 6})})</span>
                           </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleManualTrade(pos.symbol, 'SELL', value)}
                        className="w-full py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 rounded text-xs font-mono font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <ArrowDownCircle className="w-3.5 h-3.5 text-rose-400" />
                        <span>Închide Poziția (Vinde {pos.symbol})</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Live Binance & Crypto News Widget */}
            <div className="mt-8 pt-6 border-t border-white/5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-serif text-sm font-semibold text-white flex items-center gap-2">
                  <Newspaper className="w-4 h-4 text-amber-400" />
                  Ştiri Binance Live
                </h3>
                <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">LIVE</span>
              </div>

              <div className="space-y-3">
                {recentNews.length === 0 ? (
                  <p className="text-xs text-zinc-500 font-mono">Se încarcă știrile...</p>
                ) : (
                  recentNews.map((item) => (
                    <a
                      key={item.id}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-3 bg-zinc-800/30 hover:bg-zinc-800/70 border border-white/5 rounded-xl transition-colors group"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[10px] font-mono text-amber-400/90 font-semibold">{item.source}</span>
                        <span className={cn(
                          "text-[9px] font-mono px-1.5 py-0.2 rounded uppercase font-bold",
                          item.sentiment === 'bullish' && "bg-emerald-500/10 text-emerald-400",
                          item.sentiment === 'bearish' && "bg-rose-500/10 text-rose-400",
                          item.sentiment === 'neutral' && "bg-zinc-700/50 text-zinc-400"
                        )}>
                          {item.sentiment}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-200 group-hover:text-white font-medium line-clamp-2">
                        {item.title}
                      </p>
                    </a>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
