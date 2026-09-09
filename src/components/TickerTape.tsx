import React from 'react';
import { motion } from 'motion/react';
import { useTradingStore } from '../store';

export function TickerTape() {
  const { logs } = useTradingStore();
  const latestLogs = logs.slice(-20).reverse();

  return (
    <div className="bg-black border-b border-emerald-900/30 py-2 overflow-hidden flex items-center relative w-full h-8">
      <div className="text-[10px] uppercase tracking-widest text-emerald-500 font-bold px-3 shrink-0 z-10 bg-black">Live Tape</div>
      <motion.div 
        className="flex gap-8 whitespace-nowrap absolute"
        initial={{ x: "100%" }}
        animate={{ x: "-100%" }}
        transition={{ duration: 30, ease: "linear", repeat: Infinity }}
      >
        {latestLogs.map((log, i) => (
          <div key={i} className="flex gap-2 text-[11px] font-mono">
            <span className="text-zinc-600">[{log.time}]</span>
            <span className={log.type === 'success' ? 'text-emerald-400' : log.type === 'warning' ? 'text-rose-400' : 'text-blue-400'}>
              {log.message}
            </span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
