const fs = require('fs');
let code = fs.readFileSync('src/components/BloombergTerminal.tsx', 'utf8');

const target = `<button 
            onClick={() => setCurrentView('audit')}
            className="px-2 py-0.5 rounded border bg-zinc-900/80 text-amber-400 border-amber-500/30 hover:bg-amber-500/10 font-bold"
          >
            F5 {t.cmdAudit}
          </button>`;

const replacement = `<button 
            onClick={() => setCurrentView('dashboard')}
            className="px-2 py-0.5 rounded border bg-zinc-900/80 text-amber-400 border-amber-500/30 hover:bg-amber-500/10 font-bold"
          >
            F1 {t.overviewView || 'Overview'}
          </button>
          <button 
            onClick={() => setCurrentView('momentumPaper')}
            className="px-2 py-0.5 rounded border bg-zinc-900/80 text-amber-400 border-amber-500/30 hover:bg-amber-500/10 font-bold"
          >
            F3 {t.momentumView || 'Momentum'}
          </button>
          <button 
            onClick={() => setCurrentView('audit')}
            className="px-2 py-0.5 rounded border bg-zinc-900/80 text-amber-400 border-amber-500/30 hover:bg-amber-500/10 font-bold"
          >
            F5 {t.cmdAudit}
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
          </button>`;

code = code.replace(target, replacement);
fs.writeFileSync('src/components/BloombergTerminal.tsx', code);
console.log('Shortcuts patched');
