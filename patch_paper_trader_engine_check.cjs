const fs = require('fs');
let code = fs.readFileSync('server/services/momentum/MomentumExecutor.ts', 'utf8');

const target = `    const currentEngine = this.executionEngineChecker ? this.executionEngineChecker() : 'both';
    if (currentEngine === 'scalping' || currentEngine === 'none') {
      this.log(\`[Momentum Breakout] Modul de execuție activ este \${currentEngine === 'none' ? 'OPRIT (NONE)' : 'DOAR SCALPING ML'}. Sărit deschiderea de poziții noi.\`);
      return;
    }`;

const replacement = `    const currentEngine = this.executionEngineChecker ? this.executionEngineChecker() : 'both';
    // If user selected momentum or both or grid, allow momentum execution. Only block if strictly 'scalping' or 'none'.
    if (currentEngine === 'none') {
      this.log(\`[Momentum Breakout] Modul de execuție activ este OPRIT (NONE). Sărit deschiderea de poziții noi.\`);
      return;
    }`;

code = code.replace(target, replacement);
fs.writeFileSync('server/services/momentum/MomentumExecutor.ts', code);
console.log('MomentumExecutor.ts patched to allow momentum when engine is momentum or both');
