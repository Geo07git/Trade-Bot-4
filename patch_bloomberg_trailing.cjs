const fs = require('fs');
let content = fs.readFileSync('src/components/BloombergTerminal.tsx', 'utf8');

if (!content.includes('ShieldAlert')) {
  content = content.replace('TerminalIcon,', 'TerminalIcon,\n  ShieldAlert,');
}

const targetAnchor = `{/* Table Content */}`;

const trailingCardMarkup = `{/* Equity Trailing Protection Matrix Card */}
            {equityProtectionConfig?.enabled && (() => {
              const hwm = equityProtectionConfig?.highWaterMark || initialBalance || 250;
              const eq = balance || 250;
              const currentDrawdown = hwm > 0 ? Math.max(0, ((hwm - eq) / hwm) * 100) : 0;
              const trailingLimit = equityProtectionConfig?.trailingDistancePct ?? 0.40;
              const isLocked = equityProtectionConfig?.isLocked;

              return (
                <div className={cn(
                  "m-3 p-3 rounded border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-mono text-xs",
                  isLocked ? "bg-rose-950/30 border-rose-500/40 text-rose-300" : "bg-[#0c0e12] border-amber-500/30 text-amber-300"
                )}>
                  <div className="flex items-center gap-2.5">
                    <div className={cn("p-1.5 rounded border", isLocked ? "bg-rose-500/20 border-rose-500/40 text-rose-400" : "bg-amber-500/10 border-amber-500/30 text-amber-400")}>
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold tracking-wider uppercase text-white">EQUITY TRAILING PROTECTION [MATRIX]</span>
                        <span className={cn("text-[9px] px-1.5 py-0.5 rounded font-bold", isLocked ? "bg-rose-500/20 text-rose-300 border border-rose-500/40" : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40")}>
                          {isLocked ? "LOCKED (TRIGGERED)" : "ACTIVE (MONITORING)"}
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-400">
                        Trailing: <strong className="text-amber-400">{trailingLimit}%</strong> | Oprește trading-ul și închide pozițiile la depășirea pragului de retragere din HWM.
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-4 text-[11px] font-mono shrink-0">
                    <div className="text-right">
                      <span className="block text-[9px] text-zinc-500 uppercase">High-Water Mark (Peak)</span>
                      <span className="font-bold text-white">\${hwm.toFixed(2)}</span>
                    </div>
                    <div className="text-right">
                      <span className="block text-[9px] text-zinc-500 uppercase">Prag Declanșare</span>
                      <span className="font-bold text-amber-400">\${(hwm * (1 - trailingLimit / 100)).toFixed(2)}</span>
                    </div>
                    <div className="text-right">
                      <span className="block text-[9px] text-zinc-500 uppercase">Drawdown Curent</span>
                      <span className={cn("font-bold", currentDrawdown >= trailingLimit ? "text-rose-400" : "text-emerald-400")}>
                        {currentDrawdown.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Table Content */}`;

if (content.includes(targetAnchor) && !content.includes('EQUITY TRAILING PROTECTION [MATRIX]')) {
  content = content.replace(targetAnchor, trailingCardMarkup);
  fs.writeFileSync('src/components/BloombergTerminal.tsx', content);
  console.log('Successfully added Equity Trailing card to BloombergTerminal.tsx');
} else {
  console.log('Target anchor not found or already added in BloombergTerminal.tsx');
}
