const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target = `      if (!botEngine.state.autoTradingActive) return false;
      const currentEngine = botEngine.state.executionEngine || 'both';
      if (currentEngine === 'scalping' || currentEngine === 'none') return false;`;

const replacement = `      // Bypass strict autonomous trading check for paper signals if user wants live execution
      const currentEngine = botEngine.state.executionEngine || 'both';
      if (currentEngine === 'scalping' || currentEngine === 'none') return false;`;

code = code.replace(target, replacement);
fs.writeFileSync('server.ts', code);
console.log('server.ts patched');
