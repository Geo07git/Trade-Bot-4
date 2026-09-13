const fs = require('fs');
let code = fs.readFileSync('src/components/MomentumPaperView.tsx', 'utf8');

const target = `            <button
              onClick={handleStart}
              disabled={actionLoading === 'start' || !!state.hardStopTriggered}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg cursor-pointer",
                state.hardStopTriggered 
                  ? "bg-zinc-800 text-zinc-500 cursor-not-allowed border border-white/10"
                  : "bg-emerald-500 hover:bg-emerald-600 text-black shadow-emerald-500/20"
              )}
            >`;

const replacement = `            <button
              onClick={handleStart}
              disabled={actionLoading === 'start'}
              className="px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg cursor-pointer bg-emerald-500 hover:bg-emerald-600 text-black shadow-emerald-500/20"
            >`;

code = code.replace(target, replacement);
fs.writeFileSync('src/components/MomentumPaperView.tsx', code);
console.log('MomentumPaperView.tsx button patched');
