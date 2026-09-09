import React, { useMemo } from 'react';
import { useTradingStore } from '../store';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

interface MarketTickerMarqueeProps {
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  ticker24hMap?: Record<string, any>;
}

export const MarketTickerMarquee = React.memo(function MarketTickerMarquee({
  selectedSymbol,
  onSelectSymbol,
  ticker24hMap = {}
}: MarketTickerMarqueeProps) {
  const watchlist = useTradingStore(state => state.watchlist);
  const marketOpportunities = useTradingStore(state => state.marketOpportunities);
  const positions = useTradingStore(state => state.positions);

  const securities = useMemo(() => {
    const symbols = new Set<string>();
    watchlist.forEach(w => symbols.add(w.symbol));
    marketOpportunities.forEach(o => symbols.add(o.symbol));
    positions.forEach(p => symbols.add(p.symbol));

    return Array.from(symbols).map(sym => {
      const ticker = ticker24hMap[sym];
      const opp = marketOpportunities.find(o => o.symbol === sym);
      const watch = watchlist.find(w => w.symbol === sym);
      const pos = positions.find(p => p.symbol === sym);
      
      const price = ticker?.price || opp?.price || watch?.price || pos?.currentPrice || pos?.entryPrice || 0;
      const change24h = ticker ? ticker.priceChangePercent : (opp?.priceChangePercent ?? (watch?.price && price > 0 ? ((price - watch.price) / watch.price) * 100 : 0));
      
      return {
        symbol: sym,
        price,
        change24h
      };
    });
  }, [watchlist, marketOpportunities, positions, ticker24hMap]);

  return (
    <div className="relative bg-[#090b0f] border-b border-white/5 py-1 px-3 flex items-center text-[11px] font-mono shrink-0 overflow-hidden">
      {/* Fixed Left Header / Indicator */}
      <div className="absolute left-3 z-10 bg-[#090b0f] pr-4 flex items-center gap-1.5 text-amber-500 font-bold tracking-wider text-[10px] pointer-events-none">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping"></span>
        REAL-TIME TAPE:
      </div>

      {/* Infinite Marquee Container */}
      <div className="overflow-hidden w-full pl-32">
        <div className="animate-marquee flex items-center gap-6">
          {[...securities, ...securities].map((sec, i) => (
            <button
              key={`${sec.symbol}-${i}`}
              onClick={() => onSelectSymbol(sec.symbol)}
              className={cn(
                "flex items-center gap-1.5 px-2 py-0.5 rounded cursor-pointer transition-all border shrink-0",
                selectedSymbol === sec.symbol 
                  ? "bg-amber-500/20 border-amber-500/60 text-amber-300" 
                  : "border-transparent text-zinc-300 hover:text-white hover:bg-white/5"
              )}
            >
              <span className="font-bold">{sec.symbol}</span>
              <span className="text-zinc-100">${sec.price > 100 ? sec.price.toFixed(2) : sec.price.toFixed(4)}</span>
              <span className={cn(
                "text-[10px] font-bold flex items-center",
                sec.change24h >= 0 ? "text-emerald-400" : "text-rose-400"
              )}>
                {sec.change24h >= 0 ? '+' : ''}{sec.change24h.toFixed(2)}%
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
});
