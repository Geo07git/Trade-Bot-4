const fs = require('fs');
let content = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

const targetBlock = `{/* Equity Cycle Protection Card */}
            {equityProtectionConfig?.enabled && (
              <div className={cn(
                "mt-4 p-4 rounded-xl border flex items-center justify-between",
              )}>
                <div className="flex items-center gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-zinc-200">Equity Cycle Protection</h4>
                    <p className="text-[10px] text-zinc-400">
                    </p>
                  </div>
                </div>
                <div className="flex gap-4 text-[10px] font-mono text-zinc-400">
                  <div className="text-center">
                    <span className="block text-zinc-500">Start</span>
                  </div>
                  <div className="text-center">
                    <span className="block text-zinc-500">Peak</span>
                  </div>
                  <div className="text-center">
                    <span className="block text-zinc-500">Drawdown</span>
                    <span className={cn(
                      "font-bold",
                    )}>
                    </span>
                  </div>
                </div>
              </div>
            )}`;

const replacementBlock = `{/* Equity Trailing & Capital Protection Status Card */}
            {equityProtectionConfig?.enabled && (() => {
              const hwm = equityProtectionConfig?.highWaterMark || initialBalance || 250;
              const eq = balance + positionsMargin; // or total equity
              const currentDrawdown = hwm > 0 ? Math.max(0, ((hwm - eq) / hwm) * 100) : 0;
              const trailingLimit = equityProtectionConfig?.trailingDistancePct ?? 0.40;
              const isLocked = equityProtectionConfig?.isLocked;

              return (
                <div className={cn(
                  "mt-4 p-4 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3",
                  isLocked ? "bg-rose-950/20 border-rose-500/30" : "bg-emerald-950/10 border-emerald-500/20"
                )}>
                  <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-xl border", isLocked ? "bg-rose-500/10 border-rose-500/30 text-rose-400" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400")}>
                      <ShieldAlert className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-zinc-200">Equity Trailing Protection</h4>
                        <span className={cn("text-[10px] px-2 py-0.5 rounded font-mono font-bold", isLocked ? "bg-rose-500/20 text-rose-300 border border-rose-500/30" : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30")}>
                          {isLocked ? "DECLANȘAT (LOCKED)" : "ACTIV (MONITORIZARE)"}
                        </span>
                      </div>
                      <p className="text-[10px] text-zinc-400">
                        Trailing Distanță: <strong className="text-zinc-200">{trailingLimit}%</strong> față de Peak HWM.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-6 text-[11px] font-mono">
                    <div className="text-center">
                      <span className="block text-[10px] text-zinc-500">High-Water Mark (Peak)</span>
                      <span className="font-bold text-zinc-200">\${hwm.toFixed(2)}</span>
                    </div>
                    <div className="text-center">
                      <span className="block text-[10px] text-zinc-500">Prag Declansare</span>
                      <span className="font-bold text-amber-400">\${(hwm * (1 - trailingLimit / 100)).toFixed(2)}</span>
                    </div>
                    <div className="text-center">
                      <span className="block text-[10px] text-zinc-500">Drawdown Curent</span>
                      <span className={cn("font-bold", currentDrawdown >= trailingLimit ? "text-rose-400" : "text-emerald-400")}>
                        {currentDrawdown.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}`;

if (content.includes(targetBlock)) {
  content = content.replace(targetBlock, replacementBlock);
  fs.writeFileSync('src/components/Dashboard.tsx', content);
  console.log('Successfully updated Dashboard.tsx equity protection card');
} else {
  console.log('Target block not found in Dashboard.tsx');
}
