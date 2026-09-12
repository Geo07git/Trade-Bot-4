const fs = require('fs');
let content = fs.readFileSync('src/components/Settings.tsx', 'utf8');
const search = `          {/* Equity Cycle Protection */}
          <div className="bg-gradient-to-br from-zinc-900/90 via-zinc-900/50 to-indigo-950/20 border border-indigo-500/20 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-serif text-white">Equity Cycle Protection</h3>
                <p className="text-xs text-indigo-400/90">
                  Protejează profitul acumulat prin închiderea ciclului dacă equity-ul scade sub un prag după atingerea țintei.
                </p>
              </div>
              <div className="ml-auto">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={equityProtectionConfig.enabled} 
                    onChange={(e) => setEquityProtectionConfig({ enabled: e.target.checked })}
                    className="sr-only peer" 
                  />
                  <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-300">Prag Profit Activare (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={equityProtectionConfig.profitThresholdPct}
                  onChange={(e) => setEquityProtectionConfig({ profitThresholdPct: parseFloat(e.target.value) })}
                  className="w-full bg-zinc-950/60 border border-white/5 rounded-lg p-2 text-sm text-white focus:border-indigo-500/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-300">Drawdown Protecție (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={equityProtectionConfig.drawdownProtectionPct}
                  onChange={(e) => setEquityProtectionConfig({ drawdownProtectionPct: parseFloat(e.target.value) })}
                  className="w-full bg-zinc-950/60 border border-white/5 rounded-lg p-2 text-sm text-white focus:border-indigo-500/50"
                />
              </div>
            </div>
          </div>`;

const replace = `          {/* Auto-Accumulation Vault Protection */}
          <div className="bg-gradient-to-br from-zinc-900/90 via-zinc-900/50 to-amber-950/20 border border-amber-500/20 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-serif text-white">Conservare Profit (Vault Acumulare)</h3>
                <p className="text-xs text-amber-400/90">
                  Protejează profitul acumulat prin închiderea tuturor pozițiilor și mutarea profitului în Pușculiță la atingerea unei ținte.
                </p>
              </div>
              <div className="ml-auto">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={accumulationTargetEnabled} 
                    onChange={(e) => toggleAccumulationTarget(e.target.checked)}
                    className="sr-only peer" 
                  />
                  <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                </label>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-300">Țintă Profit Ciclu (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={accumulationTargetPercent}
                  onChange={(e) => setAccumulationTargetPercent(parseFloat(e.target.value))}
                  className="w-full bg-zinc-950/60 border border-white/5 rounded-lg p-2 text-sm text-white focus:border-amber-500/50"
                />
              </div>
            </div>
          </div>`;

content = content.replace(search, replace);
fs.writeFileSync('src/components/Settings.tsx', content);
