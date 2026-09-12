const fs = require('fs');
let content = fs.readFileSync('src/components/Settings.tsx', 'utf8');

if (!content.includes('ShieldCheck')) {
  content = content.replace('ShieldAlert,', 'ShieldAlert,\n  ShieldCheck,');
}

const targetStoreDestructure = `    watchlist,
    equityProtectionConfig,
    setEquityProtectionConfig,
  } = useTradingStore();`;

const replacementCard = `    watchlist,
    equityProtectionConfig,
    setEquityProtectionConfig,
  } = useTradingStore();`;

// Let's find where to insert the card in Settings.tsx, e.g. before the execution engine card or bottom of grid
const targetCardAnchor = `{/* Execution Engine Selector Card (Both / Grid / Scalping) */}`;

const cardMarkup = `{/* Equity Trailing / Capital Protection Card */}
          <div className="bg-gradient-to-br from-zinc-900/90 via-zinc-900/50 to-emerald-950/20 border border-emerald-500/20 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Equity Trailing / Capital Protection</h3>
                  <p className="text-xs text-zinc-400">Protejează câștigurile acumulate bazat pe High-Water Mark și Trailing Drawdown.</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={equityProtectionConfig?.enabled ?? true}
                  onChange={(e) => setEquityProtectionConfig({ enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>

            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-300">Trailing Distance Drawdown (%)</span>
                <span className="text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 px-2.5 py-1 rounded border border-emerald-500/40">
                  {equityProtectionConfig?.trailingDistancePct ?? 0.40}%
                </span>
              </div>
              <input 
                type="range" 
                min="0.10" 
                max="3.00" 
                step="0.05"
                value={equityProtectionConfig?.trailingDistancePct ?? 0.40}
                onChange={(e) => setEquityProtectionConfig({ trailingDistancePct: parseFloat(e.target.value) })}
                className="w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
              <p className="text-xs text-zinc-400 leading-relaxed">
                Dacă equity-ul atinge un nou maxim (High-Water Mark) și apoi scade cu mai mult de <strong>{equityProtectionConfig?.trailingDistancePct ?? 0.40}%</strong>, botul va închide pozițiile active și va bloca temporar deschiderea de noi poziții pentru a proteja câștigul.
              </p>
            </div>
          </div>

          {/* Execution Engine Selector Card (Both / Grid / Scalping) */}`;

if (content.includes(targetCardAnchor) && !content.includes('Equity Trailing / Capital Protection')) {
  content = content.replace(targetCardAnchor, cardMarkup);
  fs.writeFileSync('src/components/Settings.tsx', content);
  console.log('Successfully patched Settings.tsx');
} else {
  console.log('Target card anchor not found or already added in Settings.tsx');
}
