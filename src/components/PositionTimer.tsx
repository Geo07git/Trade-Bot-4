import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { Position } from '../types';

interface PositionTimerProps {
  pos: Position;
  maxHoldMinutes?: number;
}

export function PositionTimer({ pos, maxHoldMinutes = 5 }: PositionTimerProps) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (maxHoldMinutes <= 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono font-medium text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded-md border border-white/10" title="Expirare pe timp dezactivată (0 min)">
        <Clock className="w-3 h-3 text-zinc-400" />
        <span>Fără T.O.</span>
      </span>
    );
  }

  const currentPrice = pos.currentPrice || pos.entryPrice;
  const isProfit = pos.entryPrice > 0 ? currentPrice >= pos.entryPrice : true;
  const effectiveMaxHold = isProfit ? maxHoldMinutes * 1.5 : maxHoldMinutes;

  const openedAt = pos.openedAt || now;
  const elapsedMs = now - openedAt;
  const totalHoldMs = effectiveMaxHold * 60 * 1000;
  const remainingMs = Math.max(0, totalHoldMs - elapsedMs);

  const totalSec = Math.floor(remainingMs / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  const formattedTime = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

  if (remainingMs <= 0) {
    return (
      <span 
        className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-md border border-amber-500/40 animate-pulse"
        title="Timpul maxim de deținere a fost atins! Poziția va fi închisă automat."
      >
        <Clock className="w-3 h-3 text-amber-400" />
        <span>⏱️ Expirat</span>
      </span>
    );
  }

  if (isProfit) {
    return (
      <span 
        className="inline-flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-300 bg-emerald-500/15 px-2 py-0.5 rounded-md border border-emerald-500/30 shadow-sm"
        title={`Pe profit! Timp extins cu +50% (${effectiveMaxHold.toFixed(1)} min max)`}
      >
        <Clock className="w-3 h-3 text-emerald-400" />
        <span>⏱️ {formattedTime}</span>
        <span className="text-[9px] text-emerald-400 font-semibold px-1 bg-emerald-500/20 rounded">+50%</span>
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
      title={`Timp rămas din limita de ${maxHoldMinutes} min până la închiderea pe minus`}
    >
      <Clock className={`w-3 h-3 ${isCritical ? 'text-rose-400' : 'text-amber-400'}`} />
      <span>⏱️ {formattedTime}</span>
    </span>
  );
}
