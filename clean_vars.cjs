const fs = require('fs');
let code = fs.readFileSync('src/components/MomentumPaperView.tsx', 'utf8');

const regex = /\s*\/\/ Exact mark-to-market total equity[\s\S]*?const isHardStopProfit = state\.hardStopTriggered === 'PROFIT_100';/;

code = code.replace(regex, `
  const totalFeesPaid = state.totalFeesPaid || 0;`);

fs.writeFileSync('src/components/MomentumPaperView.tsx', code);
