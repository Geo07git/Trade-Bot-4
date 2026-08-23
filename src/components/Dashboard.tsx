import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { useTradingStore } from '../store';
import { PositionTimer } from './PositionTimer';
import { fetchLivePrice, fetchChartData } from '../services/api';
import { ArrowUpRight, ArrowDownRight, Wallet, TrendingUp, AlertTriangle, Trash2, Newspaper, ExternalLink, RefreshCw, ShoppingCart, ArrowUpCircle, ArrowDownCircle, Zap, CheckCircle2, Heart, Radio } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { NewsArticle } from '../types';
import { TradingViewChart } from './TradingViewChart';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

export function Dashboard() {
  const { 
    balance, 
    positions, 
    maxHoldMinutes,
    scalpingConfig,
    watchlist, 
    marketOpportunities,
    symbolStats,
    lastScanAt,
    triggerScanOpportunities,
    logs, 
    initialBalance, 
    tradeHistory,
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
  const [oppFilter, setOppFilter] = useState<'TOP20' | 'ALL'>('ALL');
  const [oppSearch, setOppSearch] = useState('');

  const oppsList = Array.isArray(marketOpportunities) ? marketOpportunities : [];
  const statsMap = symbolStats && typeof symbolStats === 'object' ? symbolStats : {};

  const filteredOpps = oppsList.filter(o => {
    if (oppSearch) {
      const matchSym = o.symbol.toLowerCase().includes(oppSearch.toLowerCase());
      const matchPattern = (o.candlestickPatternName || '').toLowerCase().includes(oppSearch.toLowerCase());
      if (!matchSym && !matchPattern) return false;
    }
    return true;
  });

  const displayOpps = oppFilter === 'TOP20' ? filteredOpps.slice(0, 20) : filteredOpps;

  useEffect(() => {
    if (!marketOpportunities || marketOpportunities.length === 0) {
      triggerScanOpportunities();
    }
  }, []);

  const handleScanOpportunities = async () => {
    setIsScanningOpps(true);
    await triggerScanOpportunities();
    setTimeout(() => setIsScanningOpps(false), 500);
  };
  
  const [activeChartId, setActiveChartId] = useState('PORTFOLIO');
  const [assetChartData, setAssetChartData] = useState<{time: string, value: number}[]>([]);

  // State for Quick Trade Widget
  const [tradeSymbol, setTradeSymbol] = useState('BTCUSDT');
  const [tradeAmountUsdt, setTradeAmountUsdt] = useState<number>(10);
  const [tradeMessage, setTradeMessage] = useState<string | null>(null);

  const positionsMargin = positions.reduce((acc, pos) => {
    const lev = (pos as any).leverage || 1;
    return acc + ((pos as any).margin || ((pos.entryPrice * pos.amount) / lev));
  }, 0);
  const unrealizedPnL = positions.reduce((acc, pos) => {
    const cp = pos.currentPrice || pos.entryPrice;
    return acc + ((cp - pos.entryPrice) * pos.amount);
  }, 0);
  const equity = balance + positionsMargin + unrealizedPnL;
  const dayChange = equity - initialBalance;
  const dayChangePercent = initialBalance > 0 ? (dayChange / initialBalance) * 100 : 0;

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
    const fetchMissingPrices = async () => {
      const missing = watchlist.filter(w => w.price === null || w.price === undefined);
      if (missing.length === 0) return;
      
      missing.forEach(async (item) => {
        const price = await fetchLivePrice(item.symbol);
        if (price) {
          updatePrice(item.symbol, price);
        }
      });
    };
    
    fetchMissingPrices();
  }, [watchlist.filter(w => w.price === null).map(w => w.symbol).join(','), updatePrice]);

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
      <header className="min-h-12 md:min-h-16 border-b border-white/5 flex flex-col md:flex-row items-start md:items-center justify-between px-2.5 sm:px-6 py-2 bg-zinc-950/40 shrink-0 gap-2">
        <div className="flex items-center justify-between w-full md:w-auto gap-3 sm:gap-6">
          <div>
            <p className="text-[9px] sm:text-[10px] uppercase text-zinc-500 tracking-wider mb-0.5">
              {binanceMode === 'testnet' ? 'Capital Testnet' : binanceMode === 'live' ? 'Capital Real' : 'Capital Paper'}
            </p>
            <p className="font-serif text-sm sm:text-lg font-medium text-white">${Number(equity || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})} <span className={cn("text-[10px] sm:text-xs font-sans ml-0.5", dayChangePercent >= 0 ? "text-emerald-400" : "text-rose-400")}>{dayChangePercent >= 0 ? '+' : ''}{(dayChangePercent || 0).toFixed(2)}%</span></p>
          </div>
          <div>
            <p className="text-[9px] sm:text-[10px] uppercase text-zinc-500 tracking-wider mb-0.5">
              {binanceMode === 'testnet' ? 'Profit Testnet' : binanceMode === 'live' ? 'Profit Real' : 'Profit Virtual'}
            </p>
            <p className={cn("font-serif text-sm sm:text-lg font-medium", dayChange >= 0 ? "text-emerald-400" : "text-rose-400")}>{dayChange >= 0 ? '+' : ''}${Number(dayChange || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
          </div>
          <div>
            <p className="text-[9px] sm:text-[10px] uppercase text-zinc-500 tracking-wider mb-0.5">USDT Liber</p>
            <p className="font-serif text-sm sm:text-lg font-medium text-white">${Number(balance || 0).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-1.5 sm:gap-3 w-full md:w-auto justify-between md:justify-end shrink-0">
          {binanceMode !== 'paper' && (
            <button
              type="button"
              disabled={isSyncing}
              onClick={async () => {
                setIsSyncing(true);
                await syncBinanceBalance();
                setIsSyncing(false);
              }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition-colors disabled:opacity-50 cursor-pointer"
              title="Sincronizează balanța din contul Binance"
            >
              <RefreshCw className={cn("w-3 h-3", isSyncing && "animate-spin")} />
              <span className="hidden sm:inline">Sincronizează</span>
            </button>
          )}

          <button 
            onClick={() => setAutoTradingActive(!autoTradingActive)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-[10px] sm:text-xs font-semibold transition-all cursor-pointer border shadow-sm shrink-0",
              autoTradingActive 
                ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20" 
                : "bg-rose-500/10 border-rose-500/40 text-rose-400 hover:bg-rose-500/20"
            )}
            title="Apasă pentru a porni sau opri motorul de tranzacționare de pe server"
          >
            <span className={cn("w-1.5 h-1.5 rounded-full", autoTradingActive ? "bg-emerald-400 animate-pulse" : "bg-rose-500")}></span>
            <span>{autoTradingActive ? "24/7 ACTIV" : "24/7 OPRIT"}</span>
          </button>
          
          <div className={cn(
            "px-2 py-1 border rounded-full text-[10px] sm:text-xs font-medium",
            binanceMode === 'testnet' 
              ? "bg-amber-500/10 border-amber-500/30 text-amber-300"
              : binanceMode === 'live'
              ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
              : "border-white/10 text-zinc-400"
          )}>
            {binanceMode === 'testnet' ? 'Testnet' : binanceMode === 'live' ? 'LIVE' : 'Paper'}
          </div>
        </div>
      </header>

      <div className="p-3 sm:p-6 lg:p-8 overflow-y-auto flex-1 space-y-6">
        <div className="grid grid-cols-12 gap-4 sm:gap-6">
          {/* TradingView Simulation Chart Section */}
          <div className="col-span-12 bg-zinc-900/50 border border-white/5 rounded-2xl p-3 sm:p-6 relative">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h2 className="font-serif text-lg text-white flex items-center gap-2">
                  <span>Grafic Profesional TradingView</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">Candlesticks & Indicators</span>
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">Analiză tehnică în timp real: <span className="font-mono font-bold text-emerald-400">{activeChartId === 'PORTFOLIO' ? 'Portofoliu Global' : activeChartId}</span></p>
              </div>

              {/* Selector Asset Pill Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none max-w-full">
                <button
                  type="button"
                  onClick={() => setActiveChartId('PORTFOLIO')}
                  className={cn(
                    "px-3 py-1 text-xs rounded-lg transition-colors font-medium flex items-center gap-1.5 border cursor-pointer shrink-0",
                    activeChartId === 'PORTFOLIO' 
                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 font-bold shadow-sm" 
                      : "bg-white/5 text-zinc-300 border-white/5 hover:bg-white/10"
                  )}
                >
                  <span>📊 Portofoliu</span>
                </button>
                {watchlist.map(w => (
                  <button
                    key={w.symbol}
                    type="button"
                    onClick={() => setActiveChartId(w.symbol)}
                    className={cn(
                      "px-2.5 py-1 text-xs font-mono rounded-lg transition-colors border cursor-pointer shrink-0",
                      activeChartId === w.symbol
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold"
                        : "bg-zinc-800/80 text-zinc-300 border-white/5 hover:bg-zinc-700/80"
                    )}
                  >
                    {w.symbol.replace('USDT', '')}
                  </button>
                ))}
              </div>
            </div>

            {/* TradingView Canvas Engine */}
            <div className="w-full h-[420px] sm:h-[520px] rounded-xl overflow-hidden border border-[#2a2e39] shadow-2xl bg-[#131722]">
              <TradingViewChart 
                symbol={activeChartId} 
                initialData={activeChartId === 'PORTFOLIO' ? displayChartData : undefined}
                height="100%"
                showToolbar={true}
                initialBalance={initialBalance}
                equity={equity}
                balance={balance}
                positions={positions}
                tradeHistory={tradeHistory}
                logs={logs}
              />
            </div>

            {/* Key Metrics Dashboard Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mt-6">
              <div className="p-3.5 sm:p-4 bg-zinc-800/40 rounded-xl border border-white/5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-0.5">Poziții Active</p>
                  <p className="text-lg sm:text-xl font-serif text-white">{positions.length}</p>
                </div>
                <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                  <Wallet className="w-4 h-4" />
                </div>
              </div>

              <div className="p-3.5 sm:p-4 bg-zinc-800/40 rounded-xl border border-white/5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-0.5">Max Drawdown (Sim)</p>
                  <p className="text-lg sm:text-xl font-serif text-white">{maxDrawdown}</p>
                </div>
                <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>

              <div className="p-3.5 sm:p-4 bg-zinc-800/40 rounded-xl border border-white/5 flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-0.5">Sharpe Ratio</p>
                  <p className={cn(
                    "text-lg sm:text-xl font-serif font-bold",
                    sharpeNum > 0 ? "text-emerald-400" : sharpeNum < 0 ? "text-rose-400" : "text-zinc-400"
                  )}>
                    {sharpeRatioStr}
                  </p>
                </div>
                <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg">
                  <Zap className="w-4 h-4" />
                </div>
              </div>
            </div>
          </div>

          {/* G&S-Trade-Bot - Opportunity Score & Dynamic Watchlist Scanner */}
          <div className="col-span-12 bg-gradient-to-b from-zinc-900/90 via-zinc-900/60 to-zinc-900/40 border border-emerald-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none"></div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 relative z-10">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-bold uppercase tracking-wider">
                    G&S-Trade-Bot Engine
                  </span>
                  <span className="text-[10px] font-mono text-zinc-400">
                    {lastScanAt ? `Scanat: ${new Date(lastScanAt).toLocaleTimeString()}` : 'Scanare Automată Continuă'}
                  </span>
                </div>
                <h2 className="font-serif italic text-xl font-bold text-white mt-1 flex items-center gap-2">
                  <span>🎯 Clasament Oportunități Scalping (Opportunity Score 0–100)</span>
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Serverul scanează automat universul de 200 perechi USDT de pe Binance și mută capitalul exclusiv în cele mai profitabile oportunități din Top 10.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <input
                  type="text"
                  value={oppSearch}
                  onChange={(e) => setOppSearch(e.target.value)}
                  placeholder="Caută pereche (ex: BTC, PEPE)..."
                  className="px-3 py-1.5 rounded-xl bg-zinc-900 border border-white/10 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 w-44 font-mono"
                />

                <div className="flex bg-zinc-800/80 p-1 rounded-xl border border-white/10">
                  <button
                    type="button"
                    onClick={() => setOppFilter('TOP20')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer",
                      oppFilter === 'TOP20' ? "bg-emerald-500 text-black font-bold shadow-sm" : "text-zinc-400 hover:text-white"
                    )}
                  >
                    Top 20 Pattern
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
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto relative z-10 rounded-xl border border-white/5 bg-black/40">
              <table className="w-full text-left text-xs font-mono text-zinc-300">
                <thead className="text-[10px] uppercase tracking-wider text-zinc-400 bg-zinc-900/90 border-b border-white/10 sticky top-0 z-20">
                  <tr>
                    <th className="py-3 px-3">Rank</th>
                    <th className="py-3 px-3">Pereche USDT</th>
                    <th className="py-3 px-3 text-center">Discovery Score</th>
                    <th className="py-3 px-3 text-center">Candlestick Pattern (50%)</th>
                    <th className="py-3 px-3 text-center">Opp Score</th>
                    <th className="py-3 px-3 text-right">Preț Curent</th>
                    <th className="py-3 px-3 text-center">Volum 24h</th>
                    <th className="py-3 px-3 text-center">ML / Reversal</th>
                    <th className="py-3 px-3 text-center">Hist. Perf.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {displayOpps.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-zinc-500">
                        {isScanningOpps ? 'Se scanează universul Binance USDT (200 perechi)...' : 'Nicio oportunitate găsită. Apăsați "Scanează Piața Instant" pentru a calcula scorurile pe 200 de perechi.'}
                      </td>
                    </tr>
                  ) : (
                    displayOpps.map((opp, idx) => {
                      const symStat = statsMap[opp.symbol];
                      const isTopDynamic = idx < 10;

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
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/30 font-bold text-sm">
                              <span className={cn(
                                (opp.discoveryScore || 0) >= 75 ? "text-emerald-300 font-extrabold" : ((opp.discoveryScore || 0) >= 60 ? "text-amber-300" : "text-zinc-400")
                              )}>
                                {opp.discoveryScore || opp.opportunityScore}/100
                              </span>
                            </div>
                          </td>

                          <td className="py-2.5 px-3 text-center">
                            <div className="font-bold text-zinc-200 text-xs flex items-center justify-center gap-1">
                              <span>{opp.candlestickPatternName || 'Candle Standard'}</span>
                            </div>
                            <div className="text-[10px] text-emerald-400 font-mono">
                              Pattern: {opp.candlestickPatternScore || 50}pt (50%)
                            </div>
                          </td>

                          <td className="py-2.5 px-3 text-center">
                            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-900 border border-white/10 text-xs font-bold text-zinc-300">
                              <span>{opp.opportunityScore}/100</span>
                            </div>
                          </td>

                          <td className="py-2.5 px-3 text-right font-bold text-zinc-100">
                            ${Number(opp.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
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
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Active Positions - Aesthetic Full-Width Grid */}
          <div className="col-span-12 bg-zinc-900/50 border border-white/5 rounded-2xl p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-serif text-lg font-bold text-white flex items-center gap-2">
                    <span>Poziții Curente în Portofoliu</span>
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Mode executare: <span className="font-mono text-emerald-400 font-bold uppercase">{binanceMode === 'testnet' ? 'Binance Testnet' : binanceMode === 'live' ? 'Binance Live' : 'Paper Trading'}</span>
                  </p>
                </div>
              </div>

              {positions.length > 0 && (
                <div className="flex items-center gap-3 text-xs font-mono bg-zinc-950 px-4 py-2 rounded-xl border border-white/10 shrink-0">
                  <span className="text-zinc-400">Total Poziții Deschise:</span>
                  <span className="text-white font-bold">{positions.length}</span>
                  <span className="text-zinc-600">|</span>
                  <span className="text-zinc-400">Margină Alocată:</span>
                  <span className="text-emerald-400 font-bold">
                    ${positionsMargin.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              )}
            </div>

            {positions.length === 0 ? (
              <div className="p-12 text-center border border-white/5 rounded-2xl bg-zinc-950/40 flex flex-col items-center justify-center gap-3">
                <div className="p-4 rounded-full bg-zinc-900 text-zinc-500 border border-white/5">
                  <Wallet className="w-8 h-8" />
                </div>
                <h3 className="text-sm font-semibold text-zinc-300">Nicio poziție deschisă în acest moment</h3>
                <p className="text-xs text-zinc-500 max-w-md">
                  Serverul 24/7 monitorizează piața Binance în fundal și va deschide automat poziții conform filtrelor de calitate ML.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {positions.map((pos, i) => {
                  const currentPrice = pos.currentPrice || pos.entryPrice;
                  const value = currentPrice * pos.amount;
                  const pl = value - (pos.entryPrice * pos.amount);
                  const plPercent = (pl / (pos.entryPrice * pos.amount)) * 100;
                  
                  return (
                    <div key={i} className="p-4 bg-zinc-950/80 rounded-2xl border border-white/10 hover:border-white/20 transition-all flex flex-col justify-between gap-4 shadow-lg group">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-white font-mono tracking-wide">{pos.symbol}</span>
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              BUY
                            </span>
                            <span className={cn(
                              "text-[9px] font-mono font-bold px-2 py-0.5 rounded border uppercase flex items-center gap-1",
                              "bg-purple-500/10 text-purple-300 border-purple-500/30"
                            )}>
                              {`SCALPING ${(pos as any).leverage && (pos as any).leverage > 1 ? `${(pos as any).leverage}x` : ''}`}
                            </span>
                          </div>

                          <div className={cn(
                            "px-2.5 py-1 rounded-lg text-xs font-mono font-bold border flex items-center gap-1",
                            pl >= 0 
                              ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" 
                              : "bg-rose-500/15 text-rose-400 border-rose-500/30"
                          )}>
                            {pl >= 0 ? '+' : ''}{plPercent.toFixed(2)}%
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono bg-zinc-900/60 p-2 rounded-xl border border-white/5">
                          <span>Timp Poziție:</span>
                          <PositionTimer 
                            pos={pos} 
                            maxHoldMinutes={maxHoldMinutes} 
                            maxNegativeHoldMinutes={scalpingConfig?.maxNegativeHoldMinutes ?? 1.0} 
                            enableMaxNegativeHold={scalpingConfig?.enableMaxNegativeHold ?? true}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-black/50 p-3 rounded-xl border border-white/5">
                          <div>
                            <span className="text-[9px] uppercase tracking-wider text-zinc-500 block mb-0.5">Preț Intrare</span>
                            <span className="text-zinc-300 font-semibold">${Number(pos.entryPrice || 0).toLocaleString(undefined, {maximumFractionDigits: 6})}</span>
                          </div>

                          <div>
                            <span className="text-[9px] uppercase tracking-wider text-zinc-500 block mb-0.5">Preț Curent</span>
                            <span className="text-white font-bold">${Number(currentPrice || 0).toLocaleString(undefined, {maximumFractionDigits: 6})}</span>
                          </div>

                          <div className="pt-1.5 border-t border-white/5">
                            <span className="text-[9px] uppercase tracking-wider text-zinc-500 block mb-0.5">Cantitate (Qty)</span>
                            <span className="text-zinc-300">{pos.amount.toFixed(4)}</span>
                          </div>

                          <div className="pt-1.5 border-t border-white/5">
                            <span className="text-[9px] uppercase tracking-wider text-zinc-500 block mb-0.5">Valoare Poziție</span>
                            <span className="text-emerald-400 font-bold">${Number(value || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs font-mono px-1">
                          <span className="text-zinc-400">Profit / Pierdere Un-Realizat:</span>
                          <span className={cn("font-bold text-sm", pl >= 0 ? "text-emerald-400" : "text-rose-400")}>
                            {pl >= 0 ? '+' : ''}${Number(pl || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleManualTrade(pos.symbol, 'SELL', value)}
                        className="w-full py-2 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-xl text-xs font-mono font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm group-hover:border-rose-500/60"
                      >
                        <ArrowDownCircle className="w-4 h-4 text-rose-400" />
                        <span>Închide Poziția (Vinde {pos.symbol})</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
