import React, { useState, useEffect, useRef } from 'react';
import { Clock } from 'lucide-react';
import { Position } from '../types';

interface PositionTimerProps {
  pos: Position;
  maxHoldMinutes?: number;
  maxNegativeHoldMinutes?: number;
  enableMaxNegativeHold?: boolean;
}

export function PositionTimer({ pos, maxHoldMinutes = 15, maxNegativeHoldMinutes = 1.0, enableMaxNegativeHold = true }: PositionTimerProps) {
  const [now, setNow] = useState(Date.now());
  const fallbackRef = useRef<number>(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const parseMs = (val: any): number | null => {
    if (val === null || val === undefined) return null;
    if (typeof val === 'number' && !isNaN(val) && val > 0) return val;
    if (typeof val === 'string') {
      const t = new Date(val).getTime();
      if (!isNaN(t) && t > 0) return t;
      const n = Number(val);
      if (!isNaN(n) && n > 0) return n;
    }
    return null;
  };

  const effectiveBaseHold = maxHoldMinutes ?? 15;

  const currentPrice = pos.currentPrice || pos.entryPrice;
  const isProfit = pos.entryPrice > 0 ? currentPrice >= pos.entryPrice : true;

  const openedAt = parseMs(pos.openedAt) || (pos as any)._fallbackOpenedAt || fallbackRef.current;
  const negStart = parseMs(pos.negativeEnteredAt) || openedAt;

  // 1. Negative Drawdown Timer (Triggered when position goes negative PnL < 0)
  if (enableMaxNegativeHold && !isProfit && (maxNegativeHoldMinutes ?? 1.0) > 0) {
    const negElapsedMs = Math.max(0, now - negStart);
    const negTotalMs = (maxNegativeHoldMinutes ?? 1.0) * 60 * 1000;
    const negRemainingMs = Math.max(0, negTotalMs - negElapsedMs);

    const negTotalSec = Math.floor(negRemainingMs / 1000);
    const negMins = Math.floor(negTotalSec / 60);
    const negSecs = negTotalSec % 60;
    const formattedNegTime = `${negMins}:${negSecs < 10 ? '0' : ''}${negSecs}`;

    if (negRemainingMs <= 0) {
      return (
        <span 
          className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-rose-300 bg-rose-500/30 px-2 py-0.5 rounded-md border border-rose-500/60 shadow-sm animate-pulse"
          title={`Limita de timp pe minus (${maxNegativeHoldMinutes ?? 1} min) a fost atinsă! Vânzare automată în curs.`}
        >
          <Clock className="w-3 h-3 text-rose-400" />
          <span>⏳ Timp Minus Expirat</span>
        </span>
      );
    }

    return (
      <span 
        className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold text-rose-300 bg-rose-950/80 px-2 py-0.5 rounded-md border border-rose-500/50 shadow-sm animate-pulse"
        title={`Poziție pe minus! Regula de limită timp minus: mai ai ${formattedNegTime} din ${maxNegativeHoldMinutes ?? 1} min să revii în profit.`}
      >
        <Clock className="w-3 h-3 text-rose-400" />
        <span>⏳ Minus: {formattedNegTime}</span>
        <span className="text-[9px] text-rose-400 bg-rose-500/20 px-1 rounded border border-rose-500/30">Max {maxNegativeHoldMinutes ?? 1}m</span>
      </span>
    );
  }

  if (effectiveBaseHold <= 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono font-medium text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded-md border border-white/10" title="Expirare pe timp dezactivată (0 min)">
        <Clock className="w-3 h-3 text-zinc-400" />
        <span>Fără T.O.</span>
      </span>
    );
  }

  const elapsedMs = Math.max(0, now - openedAt);
  const totalHoldMs = effectiveBaseHold * 60 * 1000;
  const remainingMs = Math.max(0, totalHoldMs - elapsedMs);

  const totalSec = Math.floor(remainingMs / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  const formattedTime = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

  if (isProfit) {
    if (remainingMs > 0) {
      return (
        <span 
          className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded-md border border-emerald-500/30 shadow-sm"
          title={`Scalping pe profit! Rămas din timpul standard: ${formattedTime}. Trailing Stop & TP activat.`}
        >
          <Clock className="w-3 h-3 text-emerald-400" />
          <span>⏱️ {formattedTime}</span>
          <span className="text-[9px] text-emerald-400 font-semibold px-1 bg-emerald-500/20 rounded">Trailing</span>
        </span>
      );
    } else {
      return (
        <span 
          className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-md border border-emerald-500/40 shadow-sm animate-pulse"
          title="Poziție pe profit menținută sub protecția Trailing Stop / TP! Limita de timp nu închide tranzacțiile pe profit."
        >
          <Clock className="w-3 h-3 text-emerald-400" />
          <span>⏱️ Trailing Active</span>
        </span>
      );
    }
  }

  if (remainingMs <= 0) {
    return (
      <span 
        className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-md border border-amber-500/40 animate-pulse"
        title="Timpul maxim de deținere pe pierdere/stagnare a fost atins! Poziția va fi închisă automat."
      >
        <Clock className="w-3 h-3 text-amber-400" />
        <span>⏱️ Expirat</span>
      </span>
    );
  }

  const isCritical = remainingMs < 60000; // sub 1 minut

  return (
    <span 
      className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border shadow-sm ${
        isCritical 
          ? 'text-rose-300 bg-rose-500/20 border-rose-500/40 animate-pulse' 
          : 'text-amber-300 bg-amber-500/15 border-amber-500/30'
      }`}
      title={`Timp rămas din limita de ${effectiveBaseHold} min pe pierdere (Scalping)`}
    >
      <Clock className={`w-3 h-3 ${isCritical ? 'text-rose-400' : 'text-amber-400'}`} />
      <span>⏱️ {formattedTime}</span>
    </span>
  );
}
