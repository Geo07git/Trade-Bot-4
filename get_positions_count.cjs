const fs = require('fs');
const state = JSON.parse(fs.readFileSync('bot_state.json', 'utf8'));
console.log('Balance:', state.balance);
console.log('Initial Balance:', state.initialBalance);
console.log('Positions count:', state.positions ? state.positions.length : 0);
console.log('Mode:', state.binanceMode);
if (state.positions) {
   const marginSum = state.positions.reduce((acc, pos) => acc + (pos.margin || 0), 0);
   console.log('Margin sum:', marginSum);
}
