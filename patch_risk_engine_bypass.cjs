const fs = require('fs');
let code = fs.readFileSync('server/engine/risk/RiskEngine.ts', 'utf8');

const target = `    // 2. Active Config Check
    if (!scalpConfig.active) {
      return { decision: 'BLOCK', reason: 'Motor Scalping Dezactivat din Setări', vetoType: 'CONFIG' };
    }`;

const replacement = `    // 2. Active Config Check - bypassed for momentum strategy
    if (signal.strategy !== 'momentum' && !scalpConfig.active) {
      return { decision: 'BLOCK', reason: 'Motor Scalping Dezactivat din Setări', vetoType: 'CONFIG' };
    }`;

code = code.replace(target, replacement);
fs.writeFileSync('server/engine/risk/RiskEngine.ts', code);
console.log('RiskEngine.ts patched to allow momentum orders');
