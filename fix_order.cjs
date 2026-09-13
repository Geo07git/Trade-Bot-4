const fs = require('fs');
let code = fs.readFileSync('src/components/BloombergTerminal.tsx', 'utf8');

const regex = /<div className="flex items-center gap-1\.5 shrink-0 overflow-x-auto text-\[10px\]">([\s\S]*?){\/\* Language Toggle \*\/}/;

const sortedButtons = `
          <button 
            onClick={() => setCurrentView('dashboard')}
            className="px-2 py-0.5 rounded border bg-zinc-900/80 text-amber-400 border-amber-500/30 hover:bg-amber-500/10 font-bold"
          >
            F1 {t.overviewView || 'Overview'}
          </button>
          <button 
            onClick={() => setActiveTab('matrix')}
            className={cn(
              "px-2 py-0.5 rounded border transition-all font-bold",
              activeTab === 'matrix' ? "bg-amber-500 text-black border-amber-400" : "bg-zinc-900/80 text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
            )}
          >
            F2 {t.cmdMatrix}
          </button>
          <button 
            onClick={() => setCurrentView('momentumPaper')}
            className="px-2 py-0.5 rounded border bg-zinc-900/80 text-amber-400 border-amber-500/30 hover:bg-amber-500/10 font-bold"
          >
            F3 {t.momentumView || 'Momentum'}
          </button>
          <button 
            onClick={() => setActiveTab('blotter')}
            className={cn(
              "px-2 py-0.5 rounded border transition-all font-bold",
              activeTab === 'blotter' ? "bg-amber-500 text-black border-amber-400" : "bg-zinc-900/80 text-amber-400 border-amber-500/30 hover:bg-amber-500/10"
            )}
          >
            F4 {t.cmdPort}
          </button>
          <button 
            onClick={() => setCurrentView('audit')}
            className="px-2 py-0.5 rounded border bg-zinc-900/80 text-amber-400 border-amber-500/30 hover:bg-amber-500/10 font-bold"
          >
            F5 {t.cmdAudit}
          </button>
          <button 
            onClick={handleManualReconcile}
            disabled={isReconciling}
            className="px-2 py-0.5 rounded border bg-emerald-950/60 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/60 font-bold flex items-center gap-1"
          >
            <RefreshCw className={cn("w-2.5 h-2.5", isReconciling && "animate-spin")} />
            F6 {t.reconcileNow}
          </button>
          <button 
            onClick={() => setCurrentView('strategy')}
            className="px-2 py-0.5 rounded border bg-zinc-900/80 text-amber-400 border-amber-500/30 hover:bg-amber-500/10 font-bold"
          >
            F7 {t.cmdScalp}
          </button>
          <button 
            onClick={() => setCurrentView('backtest')}
            className="px-2 py-0.5 rounded border bg-zinc-900/80 text-amber-400 border-amber-500/30 hover:bg-amber-500/10 font-bold"
          >
            F8 {t.backtestView || 'Backtest'}
          </button>
          <button 
            onClick={() => setCurrentView('journal')}
            className="px-2 py-0.5 rounded border bg-zinc-900/80 text-amber-400 border-amber-500/30 hover:bg-amber-500/10 font-bold"
          >
            F9 {t.journalView || 'Journal'}
          </button>
          <button 
            onClick={() => setCurrentView('logs')}
            className="px-2 py-0.5 rounded border bg-zinc-900/80 text-amber-400 border-amber-500/30 hover:bg-amber-500/10 font-bold"
          >
            F10 {t.logsView || 'Logs'}
          </button>
          <button 
            onClick={() => setCurrentView('settings')}
            className="px-2 py-0.5 rounded border bg-zinc-900/80 text-amber-400 border-amber-500/30 hover:bg-amber-500/10 font-bold"
          >
            F12 {t.settingsView || 'Settings'}
          </button>
`;

code = code.replace(regex, '<div className="flex items-center gap-1.5 shrink-0 overflow-x-auto text-[10px]">\n' + sortedButtons + '\n          {/* Language Toggle */}');

fs.writeFileSync('src/components/BloombergTerminal.tsx', code);
console.log('Order patched');
