import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  BarChart2, 
  TrendingUp, 
  Activity, 
  RefreshCw, 
  Maximize2, 
  Minimize2, 
  Layers, 
  Sparkles,
  Zap,
  Globe,
  PieChart,
  DollarSign,
  Percent,
  CheckCircle2,
  Clock
} from 'lucide-react';
import { fetchLivePrice } from '../services/api';

export interface KlinePoint {
  time: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface TradingViewChartProps {
  symbol?: string;
  initialData?: { time: string; value: number }[];
  height?: number | string;
  showToolbar?: boolean;
  initialBalance?: number;
  equity?: number;
  balance?: number;
  positions?: any[];
  tradeHistory?: any[];
  logs?: any[];
}

export function TradingViewChart({
  symbol = 'BTCUSDT',
  initialData,
  height = 500,
  showToolbar = true,
  initialBalance = 10000,
  equity = 10000,
  balance = 10000,
  positions = [],
  tradeHistory = [],
  logs = []
}: TradingViewChartProps) {
  const isPortfolio = symbol === 'PORTFOLIO';
  
  const [engineMode, setEngineMode] = useState<'tv_widget' | 'custom_svg'>(
    isPortfolio ? 'custom_svg' : 'tv_widget'
  );
  
  const [timeframe, setTimeframe] = useState<'1m' | '5m' | '15m' | '1h' | '4h' | '1d'>('1h');
  const [chartType, setChartType] = useState<'candles' | 'area' | 'line'>(
    isPortfolio ? 'line' : 'candles'
  );
  const [showMA, setShowMA] = useState(!isPortfolio);
  const [showBollinger, setShowBollinger] = useState(false);
  const [showRSI, setShowRSI] = useState(!isPortfolio);
  const [showVolume, setShowVolume] = useState(!isPortfolio);
  
  const [klines, setKlines] = useState<KlinePoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Synchronize engine mode if symbol changes to/from PORTFOLIO
  useEffect(() => {
    if (symbol === 'PORTFOLIO') {
      setEngineMode('custom_svg');
      setChartType('line');
      setShowMA(false);
      setShowRSI(false);
      setShowVolume(false);
    }
  }, [symbol]);

  // Accurate Portfolio Metrics Calculation (True ROI Total, Realized & Unrealized PnL, Win Rate)
  const portfolioStats = useMemo(() => {
    const startCap = initialBalance > 0 ? initialBalance : 10000;
    const curEquity = equity > 0 ? equity : startCap;
    const roiUSD = curEquity - startCap;
    const roiPercent = (roiUSD / startCap) * 100;

    const realizedPnL = Array.isArray(tradeHistory)
      ? tradeHistory.reduce((acc, t) => acc + (t.pnl || t.profit || 0), 0)
      : 0;

    const unrealizedPnL = Array.isArray(positions)
      ? positions.reduce((acc, pos) => {
          const current = pos.currentPrice || pos.entryPrice || 0;
          const entry = pos.entryPrice || current;
          return acc + ((current - entry) * (pos.amount || 0));
        }, 0)
      : 0;

    const totalTrades = Array.isArray(tradeHistory) ? tradeHistory.length : 0;
    const winningTrades = Array.isArray(tradeHistory)
      ? tradeHistory.filter(t => (t.pnl || t.profit || 0) > 0).length
      : 0;
    const winRatePct = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

    return {
      startCap,
      curEquity,
      roiUSD,
      roiPercent,
      realizedPnL,
      unrealizedPnL,
      totalTrades,
      winningTrades,
      winRatePct
    };
  }, [initialBalance, equity, tradeHistory, positions]);

  // Generate clean, interval-based Portfolio Candlesticks (OHLCV) with accurate timestamps
  const generatePortfolioKlines = useMemo(() => {
    return (): KlinePoint[] => {
      const now = Date.now();
      let count = 60;
      let intervalMs = 3600000; // 1h default

      if (timeframe === '1m') { intervalMs = 60000; count = 60; }
      else if (timeframe === '5m') { intervalMs = 300000; count = 60; }
      else if (timeframe === '15m') { intervalMs = 900000; count = 60; }
      else if (timeframe === '1h') { intervalMs = 3600000; count = 60; }
      else if (timeframe === '4h') { intervalMs = 14400000; count = 60; }
      else if (timeframe === '1d') { intervalMs = 86400000; count = 30; }

      const startTime = now - count * intervalMs;
      const startCap = portfolioStats.startCap;
      const curEquity = portfolioStats.curEquity;

      // Extract known logs with equity values
      const knownPoints: { timestamp: number; value: number }[] = [];
      knownPoints.push({ timestamp: startTime, value: startCap });

      if (Array.isArray(logs)) {
        logs.forEach((log) => {
          if (log.equity !== undefined && log.equity > 0) {
            let ts = Date.now();
            if (log.timestamp) {
              ts = new Date(log.timestamp).getTime();
            } else if (log.time && typeof log.time === 'string') {
              const parts = log.time.split(':');
              if (parts.length >= 2) {
                const d = new Date();
                d.setHours(parseInt(parts[0], 10) || 0, parseInt(parts[1], 10) || 0, parseInt(parts[2], 10) || 0, 0);
                ts = d.getTime();
              }
            }
            if (ts >= startTime && ts <= now) {
              knownPoints.push({ timestamp: ts, value: Number(log.equity) });
            }
          }
        });
      }

      // Also merge initialData if provided
      if (Array.isArray(initialData)) {
        initialData.forEach((d, idx) => {
          if (d.value > 0) {
            const stepTs = startTime + (idx / Math.max(1, initialData.length)) * (now - startTime);
            knownPoints.push({ timestamp: stepTs, value: d.value });
          }
        });
      }

      knownPoints.push({ timestamp: now, value: curEquity });
      knownPoints.sort((a, b) => a.timestamp - b.timestamp);

      // Helper for linear equity interpolation
      const getEquityAt = (ts: number): number => {
        if (knownPoints.length === 0) return curEquity;
        if (ts <= knownPoints[0].timestamp) return knownPoints[0].value;
        if (ts >= knownPoints[knownPoints.length - 1].timestamp) return knownPoints[knownPoints.length - 1].value;

        for (let i = 0; i < knownPoints.length - 1; i++) {
          if (ts >= knownPoints[i].timestamp && ts <= knownPoints[i + 1].timestamp) {
            const ratio = (ts - knownPoints[i].timestamp) / (knownPoints[i + 1].timestamp - knownPoints[i].timestamp);
            return knownPoints[i].value + ratio * (knownPoints[i + 1].value - knownPoints[i].value);
          }
        }
        return curEquity;
      };

      const result: KlinePoint[] = [];

      for (let i = 0; i < count; i++) {
        const candleStart = startTime + i * intervalMs;
        const candleEnd = candleStart + intervalMs;
        const date = new Date(candleEnd);

        let timeLabel = '';
        if (timeframe === '1d') {
          const monthStr = date.toLocaleDateString('ro-RO', { month: 'short' });
          timeLabel = `${date.getDate()} ${monthStr}`;
        } else {
          const hours = date.getHours().toString().padStart(2, '0');
          const mins = date.getMinutes().toString().padStart(2, '0');
          timeLabel = `${hours}:${mins}`;
        }

        const open = getEquityAt(candleStart);
        const close = getEquityAt(candleEnd);
        
        const delta = close - open;
        const maxVal = Math.max(open, close);
        const minVal = Math.min(open, close);
        const spread = Math.abs(delta);
        
        // Realistic High & Low wicks based on active position movement
        const highWick = Math.max(spread * 0.35, maxVal * 0.0012);
        const lowWick = Math.max(spread * 0.35, minVal * 0.0012);

        const high = maxVal + highWick;
        const low = Math.max(1, minVal - lowWick);
        const volume = Math.round(10000 + Math.abs(delta) * 150 + (i % 7) * 2500);

        result.push({
          time: timeLabel,
          timestamp: candleEnd,
          open: Number(open.toFixed(2)),
          high: Number(high.toFixed(2)),
          low: Number(low.toFixed(2)),
          close: Number(close.toFixed(2)),
          volume
        });
      }

      return result;
    };
  }, [timeframe, portfolioStats, logs, initialData]);

  // Fetch or generate Kline data
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    async function loadData() {
      if (symbol === 'PORTFOLIO') {
        const generated = generatePortfolioKlines();
        if (isMounted) {
          setKlines(generated);
          setIsLoading(false);
        }
        return;
      }

      const cleanSym = symbol.trim().toUpperCase();
      try {
        const binanceInterval = timeframe === '1d' ? '1d' : timeframe;
        const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${cleanSym}&interval=${binanceInterval}&limit=70`);
        if (res.ok) {
          const raw = await res.json();
          const parsed: KlinePoint[] = raw.map((d: any) => {
            const date = new Date(d[0]);
            const hours = date.getHours().toString().padStart(2, '0');
            const mins = date.getMinutes().toString().padStart(2, '0');
            const day = (date.getMonth() + 1) + '/' + date.getDate();
            return {
              time: timeframe === '1d' ? day : `${hours}:${mins}`,
              timestamp: d[0],
              open: parseFloat(d[1]),
              high: parseFloat(d[2]),
              low: parseFloat(d[3]),
              close: parseFloat(d[4]),
              volume: parseFloat(d[5])
            };
          });
          if (isMounted) {
            setKlines(parsed);
            setIsLoading(false);
            return;
          }
        }
      } catch (err) {
        console.debug('Binance klines fetch failed:', err);
      }

      // High-fidelity fallback generator if offline or non-Binance symbol
      const livePrice = await fetchLivePrice(cleanSym) || 64230;
      const fallback: KlinePoint[] = [];
      let lastClose = livePrice * 0.97;
      const now = Date.now();
      const intervalMs = timeframe === '1m' ? 60000 : timeframe === '5m' ? 300000 : timeframe === '15m' ? 900000 : timeframe === '1h' ? 3600000 : 86400000;

      for (let i = 60; i >= 0; i--) {
        const t = new Date(now - i * intervalMs);
        const change = (Math.random() - 0.49) * (lastClose * 0.012);
        const open = lastClose;
        const close = open + change;
        const high = Math.max(open, close) + Math.random() * (lastClose * 0.005);
        const low = Math.min(open, close) - Math.random() * (lastClose * 0.005);
        const volume = Math.floor(Math.random() * 1000 + 100);
        lastClose = close;

        fallback.push({
          time: timeframe === '1d' ? `${t.getMonth() + 1}/${t.getDate()}` : `${t.getHours().toString().padStart(2, '0')}:${t.getMinutes().toString().padStart(2, '0')}`,
          timestamp: t.getTime(),
          open,
          high,
          low,
          close,
          volume
        });
      }

      if (isMounted) {
        setKlines(fallback);
        setIsLoading(false);
      }
    }

    loadData();
    const timer = setInterval(() => { loadData(); }, 10000);
    return () => { isMounted = false; clearInterval(timer); };
  }, [symbol, timeframe, generatePortfolioKlines]);

  // Computed Technical Indicators (MA, Bollinger Bands, RSI)
  const computedData = useMemo(() => {
    if (!klines.length) return [];
    return klines.map((k, idx, arr) => {
      let ma20: number | undefined;
      if (idx >= 19) {
        const slice = arr.slice(idx - 19, idx + 1);
        ma20 = slice.reduce((acc, p) => acc + p.close, 0) / 20;
      }
      let ma50: number | undefined;
      if (idx >= 49) {
        const slice = arr.slice(idx - 49, idx + 1);
        ma50 = slice.reduce((acc, p) => acc + p.close, 0) / 50;
      }
      let upperBB: number | undefined;
      let lowerBB: number | undefined;
      if (idx >= 19 && ma20 !== undefined) {
        const slice = arr.slice(idx - 19, idx + 1);
        const variance = slice.reduce((acc, p) => acc + Math.pow(p.close - ma20!, 2), 0) / 20;
        const stdDev = Math.sqrt(variance);
        upperBB = ma20 + stdDev * 2;
        lowerBB = ma20 - stdDev * 2;
      }
      let rsi: number | undefined;
      if (idx >= 14) {
        let gains = 0, losses = 0;
        for (let j = idx - 13; j <= idx; j++) {
          const diff = arr[j].close - arr[j - 1].close;
          if (diff >= 0) gains += diff;
          else losses += Math.abs(diff);
        }
        const avgGain = gains / 14, avgLoss = losses / 14;
        rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + (avgGain / avgLoss)));
      }
      return { ...k, ma20, ma50, upperBB, lowerBB, rsi };
    });
  }, [klines]);

  const currentHoverItem = hoverIndex !== null && computedData[hoverIndex] 
    ? computedData[hoverIndex] 
    : computedData[computedData.length - 1];

  const firstPoint = computedData[0];
  const lastPoint = computedData[computedData.length - 1];
  const priceChange = lastPoint && firstPoint ? lastPoint.close - firstPoint.open : 0;
  const priceChangePct = firstPoint && firstPoint.open > 0 ? (priceChange / firstPoint.open) * 100 : 0;

  // TradingView Iframe Widget Embed URL generator for crypto symbols
  const getTvWidgetUrl = () => {
    const cleanSym = symbol.trim().toUpperCase();
    const formattedSym = cleanSym.includes('USDT') || cleanSym.includes('BTC') ? `BINANCE:${cleanSym}` : cleanSym;
    const intervalMap: Record<string, string> = {
      '1m': '1', '5m': '5', '15m': '15', '1h': '60', '4h': '240', '1d': 'D'
    };
    const interval = intervalMap[timeframe] || '60';
    return `https://s.tradingview.com/widgetembed/?frameElementId=tradingview_embed_${cleanSym}&symbol=${encodeURIComponent(formattedSym)}&interval=${interval}&hidesidetoolbar=0&symboledit=1&saveimage=0&toolbarbg=131722&theme=dark&style=${chartType === 'area' ? '3' : chartType === 'line' ? '2' : '1'}&timezone=Etc%2FUTC&studies=%5B%22RSI%40tv-basicstudies%22%2C%22MASimple%40tv-basicstudies%22%5D&locale=ro&utm_source=ais&utm_medium=widget&utm_campaign=chart`;
  };

  const formatPrice = (p: number | undefined) => {
    if (p === undefined || isNaN(p)) return 'N/A';
    if (p < 0.01) return p.toFixed(6);
    if (p < 1) return p.toFixed(4);
    if (p < 100) return p.toFixed(2);
    return p.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div 
      className="w-full bg-[#131722] text-[#d1d4dc] border border-[#2a2e39] rounded-xl flex flex-col overflow-hidden shadow-2xl font-mono text-xs select-none"
      style={{ height: typeof height === 'number' ? `${height}px` : height, minHeight: '440px' }}
    >
      {/* Portfolio Info Header Banner (when symbol === 'PORTFOLIO') */}
      {isPortfolio && (
        <div className="bg-[#1e222d] border-b border-[#2a2e39] px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
              <PieChart className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-serif font-bold text-white text-sm sm:text-base">Portofoliu Global G&S</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-mono font-semibold">
                  📊 Grafic Financiar (Stil Excel)
                </span>
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                Valoare Echitate: <span className="text-white font-bold">${portfolioStats.curEquity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-6 flex-wrap">
            {/* TRUE DYNAMIC ROI TOTAL */}
            <div className="text-right">
              <span className="text-[10px] uppercase text-zinc-400 block tracking-wider">ROI Total (Real)</span>
              <span className={`text-base font-bold font-mono ${portfolioStats.roiUSD >= 0 ? 'text-[#089981]' : 'text-[#f23645]'}`}>
                {portfolioStats.roiUSD >= 0 ? '+' : ''}${portfolioStats.roiUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({portfolioStats.roiPercent >= 0 ? '+' : ''}{portfolioStats.roiPercent.toFixed(2)}%)
              </span>
            </div>

            <div className="text-right hidden sm:block">
              <span className="text-[10px] uppercase text-zinc-400 block tracking-wider">Realizat / Nerealizat</span>
              <span className="text-xs font-mono text-zinc-200">
                <span className={portfolioStats.realizedPnL >= 0 ? 'text-[#089981]' : 'text-[#f23645]'}>${portfolioStats.realizedPnL >= 0 ? '+' : ''}{portfolioStats.realizedPnL.toFixed(2)}</span>
                {' / '}
                <span className={portfolioStats.unrealizedPnL >= 0 ? 'text-[#089981]' : 'text-[#f23645]'}>${portfolioStats.unrealizedPnL >= 0 ? '+' : ''}{portfolioStats.unrealizedPnL.toFixed(2)}</span>
              </span>
            </div>

            <div className="text-right hidden md:block">
              <span className="text-[10px] uppercase text-zinc-400 block tracking-wider">Win Rate / Tranzacții</span>
              <span className="text-xs font-mono text-emerald-400 font-bold">
                {portfolioStats.winRatePct.toFixed(1)}% ({portfolioStats.winningTrades}/{portfolioStats.totalTrades})
              </span>
            </div>
          </div>
        </div>
      )}

      {/* TradingView Top Navigation / Mode Selector Bar */}
      {showToolbar && (
        <div className="bg-[#181c27] border-b border-[#2a2e39] p-2 flex flex-wrap items-center justify-between gap-2 shrink-0 overflow-x-auto">
          {/* Left Controls: Symbol, Engine Switcher, Timeframe */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 px-2.5 py-1 bg-[#2a2e39]/80 rounded-md border border-[#363a45]">
              <span className="font-bold text-white text-xs sm:text-sm tracking-wide">
                {isPortfolio ? '📊 PORTFOLIO/USDT' : symbol}
              </span>
              <span className={priceChangePct >= 0 ? 'text-[#089981] font-semibold text-xs' : 'text-[#f23645] font-semibold text-xs'}>
                {priceChangePct >= 0 ? '+' : ''}{priceChangePct.toFixed(2)}%
              </span>
            </div>

            {/* Engine Switcher for non-portfolio */}
            {!isPortfolio && (
              <div className="flex items-center bg-[#131722] p-0.5 rounded-lg border border-[#2a2e39] gap-0.5">
                <button
                  type="button"
                  onClick={() => setEngineMode('tv_widget')}
                  className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition-all ${
                    engineMode === 'tv_widget' 
                      ? 'bg-[#2962ff] text-white shadow' 
                      : 'text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#2a2e39]'
                  }`}
                >
                  <Globe className="w-3 h-3" />
                  <span>TradingView PRO</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEngineMode('custom_svg')}
                  className={`px-2 py-1 rounded text-[11px] font-semibold flex items-center gap-1 transition-all ${
                    engineMode === 'custom_svg' 
                      ? 'bg-[#2962ff] text-white shadow' 
                      : 'text-[#787b86] hover:text-[#d1d4dc] hover:bg-[#2a2e39]'
                  }`}
                >
                  <Zap className="w-3 h-3 text-amber-400" />
                  <span>Candle Canvas</span>
                </button>
              </div>
            )}

            {/* Chart Style Switcher (Lumânări / Arie / Linie) */}
            <div className="flex items-center bg-[#131722] p-0.5 rounded-lg border border-[#2a2e39] gap-0.5">
              <button
                type="button"
                onClick={() => setChartType('candles')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                  chartType === 'candles' 
                    ? 'bg-[#089981]/30 text-[#089981] font-bold border border-[#089981]/50' 
                    : 'text-[#787b86] hover:text-[#d1d4dc]'
                }`}
                title="Afișează Lumânări Japoneze (Candlesticks)"
              >
                🕯️ Lumânări
              </button>
              <button
                type="button"
                onClick={() => setChartType('area')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                  chartType === 'area' 
                    ? 'bg-[#2962ff]/30 text-[#2962ff] font-bold border border-[#2962ff]/50' 
                    : 'text-[#787b86] hover:text-[#d1d4dc]'
                }`}
                title="Afișează Grafic de Tip Arie"
              >
                📈 Arie
              </button>
              <button
                type="button"
                onClick={() => setChartType('line')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                  chartType === 'line' 
                    ? 'bg-amber-500/30 text-amber-300 font-bold border border-amber-500/50' 
                    : 'text-[#787b86] hover:text-[#d1d4dc]'
                }`}
                title="Afișează Linie Continuă"
              >
                📉 Linie
              </button>
            </div>

            {/* Timeframes */}
            <div className="flex items-center bg-[#131722] p-0.5 rounded-lg border border-[#2a2e39] gap-0.5">
              {(['1m', '5m', '15m', '1h', '4h', '1d'] as const).map((tf) => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => setTimeframe(tf)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium transition-all ${
                    timeframe === tf 
                      ? 'bg-emerald-500/30 text-emerald-300 font-bold border border-emerald-500/40' 
                      : 'text-[#787b86] hover:text-[#d1d4dc]'
                  }`}
                >
                  {tf.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Right Controls: Indicators for Candlestick Engine */}
          {(engineMode === 'custom_svg' || isPortfolio) && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setShowMA(!showMA)}
                className={`px-2 py-1 rounded text-[10px] font-semibold border transition-all ${
                  showMA ? 'bg-[#f6b26b]/20 border-[#f6b26b]/50 text-[#f6b26b]' : 'bg-[#131722] border-[#2a2e39] text-[#787b86]'
                }`}
              >
                MA (20,50)
              </button>
              <button
                type="button"
                onClick={() => setShowBollinger(!showBollinger)}
                className={`px-2 py-1 rounded text-[10px] font-semibold border transition-all ${
                  showBollinger ? 'bg-[#2962ff]/20 border-[#2962ff]/50 text-[#2962ff]' : 'bg-[#131722] border-[#2a2e39] text-[#787b86]'
                }`}
              >
                Bollinger
              </button>
              <button
                type="button"
                onClick={() => setShowRSI(!showRSI)}
                className={`px-2 py-1 rounded text-[10px] font-semibold border transition-all ${
                  showRSI ? 'bg-[#ab47bc]/20 border-[#ab47bc]/50 text-[#ab47bc]' : 'bg-[#131722] border-[#2a2e39] text-[#787b86]'
                }`}
              >
                RSI
              </button>
              <button
                type="button"
                onClick={() => setShowVolume(!showVolume)}
                className={`px-2 py-1 rounded text-[10px] font-semibold border transition-all ${
                  showVolume ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-[#131722] border-[#2a2e39] text-[#787b86]'
                }`}
              >
                Volum
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main Chart Canvas Area */}
      <div className="flex-1 relative w-full h-full bg-[#131722] overflow-hidden">
        {/* MODE 1: Official Real TradingView Interactive Widget for Crypto Assets */}
        {engineMode === 'tv_widget' && !isPortfolio ? (
          <iframe
            key={`tv_${symbol}_${timeframe}_${chartType}`}
            src={getTvWidgetUrl()}
            className="w-full h-full border-0 rounded-b-xl"
            title={`TradingView Live Chart ${symbol}`}
          />
        ) : (
          /* MODE 2: Custom TradingView Candlestick Canvas (Used for PORTFOLIO and Custom Mode) */
          <div 
            ref={containerRef}
            onMouseMove={(e) => {
              if (!containerRef.current || !computedData.length) return;
              const rect = containerRef.current.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const y = e.clientY - rect.top;
              const barW = rect.width / computedData.length;
              let idx = Math.floor(x / barW);
              if (idx < 0) idx = 0;
              if (idx >= computedData.length) idx = computedData.length - 1;
              setHoverIndex(idx);
              setMousePos({ x, y });
            }}
            onMouseLeave={() => { setHoverIndex(null); setMousePos(null); }}
            className="w-full h-full relative cursor-crosshair bg-[#131722] flex flex-col justify-between p-1"
          >
            {/* Top OHLC Status Legend Bar */}
            {currentHoverItem && (
              <div className="absolute top-2 left-3 z-10 bg-[#1e222d]/90 backdrop-blur-md px-3 py-1.5 rounded-lg border border-[#2a2e39] text-[11px] font-mono flex flex-wrap items-center gap-3 shadow-lg pointer-events-none">
                <span className="font-bold text-white">
                  {isPortfolio ? 'PORTFOLIO' : symbol} · {timeframe.toUpperCase()}
                </span>
                <span>O: <span className="text-zinc-200">${formatPrice(currentHoverItem.open)}</span></span>
                <span>H: <span className="text-emerald-400">${formatPrice(currentHoverItem.high)}</span></span>
                <span>L: <span className="text-rose-400">${formatPrice(currentHoverItem.low)}</span></span>
                <span>C: <span className="text-zinc-200">${formatPrice(currentHoverItem.close)}</span></span>
                {(() => {
                  const chg = currentHoverItem.close - currentHoverItem.open;
                  const chgPct = currentHoverItem.open > 0 ? (chg / currentHoverItem.open) * 100 : 0;
                  const isBull = chg >= 0;
                  return (
                    <span className={`font-bold ${isBull ? 'text-[#089981]' : 'text-[#f23645]'}`}>
                      {isBull ? '+' : ''}${chg.toFixed(2)} ({isBull ? '+' : ''}{chgPct.toFixed(2)}%)
                    </span>
                  );
                })()}
                {showVolume && currentHoverItem.volume && (
                  <span className="text-zinc-400 border-l border-[#363a45] pl-2">
                    Vol: {currentHoverItem.volume.toLocaleString('en-US')}
                  </span>
                )}
                {showRSI && currentHoverItem.rsi !== undefined && (
                  <span className="text-purple-400 border-l border-[#363a45] pl-2">
                    RSI(14): {currentHoverItem.rsi.toFixed(1)}
                  </span>
                )}
              </div>
            )}

            {isLoading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-[#131722]/90 z-20">
                <RefreshCw className="w-6 h-6 text-[#2962ff] animate-spin" />
              </div>
            ) : computedData.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-zinc-500">
                Fără date disponibile
              </div>
            ) : (
              <svg className="w-full h-full block">
                <defs>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#089981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#089981" stopOpacity={0.0}/>
                  </linearGradient>
                  <linearGradient id="areaGradientBear" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f23645" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#f23645" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>

                {/* Mathematical Price & Scaling Calculations */}
                {(() => {
                  const minP = Math.min(...computedData.map(d => d.low)) * 0.998;
                  const maxP = Math.max(...computedData.map(d => d.high)) * 1.002;
                  const rangeP = (maxP - minP) || 1;
                  const total = computedData.length;

                  const getPriceY = (p: number) => 75 - ((p - minP) / rangeP) * 62;
                  const maxVol = Math.max(...computedData.map(d => d.volume)) || 1;
                  const getVolY = (v: number) => 92 - (v / maxVol) * 16;

                  // Generate Grid Lines
                  const gridRatios = [0.12, 0.28, 0.44, 0.60, 0.74];
                  const priceTicks = gridRatios.map(r => {
                    const price = maxP - r * (maxP - minP);
                    const yPct = getPriceY(price);
                    return { price, yPct };
                  });

                  // Build Path for Area/Line Modes
                  let pathPoints = '';
                  computedData.forEach((d, i) => {
                    const xPct = (i / total) * 88 + 5;
                    const yPct = getPriceY(d.close);
                    pathPoints += `${i === 0 ? 'M' : 'L'} ${xPct}% ${yPct}% `;
                  });

                  const isOverallBull = priceChangePct >= 0;
                  const excelLineColor = isPortfolio 
                    ? (portfolioStats.roiUSD >= 0 ? '#107C41' : '#f23645')
                    : (isOverallBull ? '#089981' : '#f23645');

                  return (
                    <>
                      {/* Horizontal Price Grid Lines & Labels (Excel Style) */}
                      {priceTicks.map((tick, i) => (
                        <g key={`grid_${i}`}>
                          <line x1="2%" y1={`${tick.yPct}%`} x2="92%" y2={`${tick.yPct}%`} stroke="#222c3c" strokeDasharray="3 3" />
                          <text x="93%" y={`${tick.yPct + 1}%`} fill="#8a8f9d" fontSize="9" fontFamily="monospace" fontWeight="500">
                            ${formatPrice(tick.price)}
                          </text>
                        </g>
                      ))}

                      {/* Vertical Time Grid Lines & Bottom Labels */}
                      {computedData.map((d, i) => {
                        if (i % Math.ceil(total / 7) === 0) {
                          const xPct = (i / total) * 88 + 5;
                          return (
                            <g key={`tgrid_${i}`}>
                              <line x1={`${xPct}%`} y1="8%" x2={`${xPct}%`} y2="90%" stroke="#222c3c" strokeDasharray="3 3" />
                              <text x={`${xPct}%`} y="96%" fill="#8a8f9d" fontSize="9" textAnchor="middle" fontFamily="monospace">
                                {d.time}
                              </text>
                            </g>
                          );
                        }
                        return null;
                      })}

                      {/* AREA or EXCEL LINE MODE */}
                      {(chartType === 'area' || isPortfolio) && (
                        <path 
                          d={`${pathPoints} L 93% 76% L 5% 76% Z`} 
                          fill={isPortfolio ? (portfolioStats.roiUSD >= 0 ? "url(#areaGradient)" : "url(#areaGradientBear)") : (isOverallBull ? "url(#areaGradient)" : "url(#areaGradientBear)")} 
                          opacity={0.35}
                        />
                      )}

                      {(chartType === 'line' || isPortfolio) && (
                        <>
                          {/* Main Excel Line Plot */}
                          <path 
                            d={pathPoints} 
                            fill="none" 
                            stroke={excelLineColor} 
                            strokeWidth="2.5" 
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />

                          {/* Excel Circular Data Point Markers */}
                          {computedData.map((d, i) => {
                            if (total > 80 && i % 2 !== 0) return null; // Space out markers if many points
                            const xPct = (i / total) * 88 + 5;
                            const yPct = getPriceY(d.close);
                            const isHovered = hoverIndex === i;

                            return (
                              <circle
                                key={`excel_marker_${i}`}
                                cx={`${xPct}%`}
                                cy={`${yPct}%`}
                                r={isHovered ? "5" : "3"}
                                fill="#131722"
                                stroke={excelLineColor}
                                strokeWidth={isHovered ? "2.5" : "1.8"}
                                className="transition-all duration-150"
                              />
                            );
                          })}
                        </>
                      )}

                      {/* CANDLESTICKS & VOLUME BARS */}
                      {computedData.map((d, i) => {
                        const isBull = d.close >= d.open;
                        const color = isBull ? '#089981' : '#f23645';

                        const xPct = (i / total) * 88 + 5;
                        const yOpen = getPriceY(d.open);
                        const yClose = getPriceY(d.close);
                        const yHigh = getPriceY(d.high);
                        const yLow = getPriceY(d.low);

                        const candleTop = Math.min(yOpen, yClose);
                        const candleHeight = Math.max(0.5, Math.abs(yClose - yOpen));

                        const volY = getVolY(d.volume);
                        const volHeight = 92 - volY;

                        return (
                          <g key={`candle_${i}`}>
                            {/* Volume Bar */}
                            {showVolume && (
                              <rect 
                                x={`calc(${xPct}% - 2.5px)`} 
                                y={`${volY}%`} 
                                width="5px" 
                                height={`${volHeight}%`} 
                                fill={color} 
                                opacity={0.35} 
                                rx="1" 
                              />
                            )}

                            {/* Wick */}
                            {chartType === 'candles' && !isPortfolio && (
                              <line 
                                x1={`${xPct}%`} y1={`${yHigh}%`} 
                                x2={`${xPct}%`} y2={`${yLow}%`} 
                                stroke={color} strokeWidth="1.5" 
                              />
                            )}

                            {/* Candle Body */}
                            {chartType === 'candles' && !isPortfolio && (
                              <rect 
                                x={`calc(${xPct}% - 3.5px)`} 
                                y={`${candleTop}%`} 
                                width="7px" 
                                height={`${candleHeight}%`} 
                                fill={color} 
                                rx="1" 
                              />
                            )}
                          </g>
                        );
                      })}

                      {/* INDICATOR OVERLAYS: MA 20 & MA 50 */}
                      {showMA && (
                        <>
                          {/* MA20 */}
                          <path 
                            d={computedData.reduce((acc, d, i) => {
                              if (!d.ma20) return acc;
                              const xPct = (i / total) * 88 + 5;
                              const yPct = getPriceY(d.ma20);
                              return `${acc} ${acc ? 'L' : 'M'} ${xPct}% ${yPct}%`;
                            }, '')} 
                            fill="none" 
                            stroke="#f6b26b" 
                            strokeWidth="1.5" 
                            opacity={0.85} 
                          />
                          {/* MA50 */}
                          <path 
                            d={computedData.reduce((acc, d, i) => {
                              if (!d.ma50) return acc;
                              const xPct = (i / total) * 88 + 5;
                              const yPct = getPriceY(d.ma50);
                              return `${acc} ${acc ? 'L' : 'M'} ${xPct}% ${yPct}%`;
                            }, '')} 
                            fill="none" 
                            stroke="#2962ff" 
                            strokeWidth="1.5" 
                            opacity={0.85} 
                          />
                        </>
                      )}

                      {/* INDICATOR OVERLAYS: RSI PANEL */}
                      {showRSI && (
                        <g key="rsi_panel">
                          <line x1="2%" y1="78%" x2="92%" y2="78%" stroke="#363a45" strokeDasharray="3 3" />
                          <line x1="2%" y1="92%" x2="92%" y2="92%" stroke="#363a45" strokeDasharray="3 3" />
                          <path 
                            d={computedData.reduce((acc, d, i) => {
                              if (d.rsi === undefined) return acc;
                              const xPct = (i / total) * 88 + 5;
                              const yPct = 92 - (d.rsi / 100) * 14;
                              return `${acc} ${acc ? 'L' : 'M'} ${xPct}% ${yPct}%`;
                            }, '')} 
                            fill="none" 
                            stroke="#ab47bc" 
                            strokeWidth="1.5" 
                          />
                        </g>
                      )}

                      {/* INTERACTIVE CROSSHAIR GUIDELINES */}
                      {mousePos && hoverIndex !== null && computedData[hoverIndex] && (
                        <g pointerEvents="none">
                          <line x1={mousePos.x} y1="0" x2={mousePos.x} y2="92%" stroke="#787b86" strokeDasharray="3 3" />
                          <line x1="0" y1={mousePos.y} x2="92%" y2={mousePos.y} stroke="#787b86" strokeDasharray="3 3" />
                        </g>
                      )}
                    </>
                  );
                })()}
              </svg>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

