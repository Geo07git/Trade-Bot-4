const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const target = `      const currentEngine = botEngine.state.executionEngine || 'both';
      if (currentEngine === 'scalping' || currentEngine === 'none') return false;`;

const replacement = `      // Allow execution regardless of engine mode filter if user triggers momentum signals
      const currentEngine = botEngine.state.executionEngine || 'both';`;

code = code.replace(target, replacement);
fs.writeFileSync('server.ts', code);
console.log('server.ts engine filter relaxed');
