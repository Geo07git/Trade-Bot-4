const fs = require('fs');
const file = './bot_state.json';
const state = JSON.parse(fs.readFileSync(file));
state.scalpingConfig.stopLossPercent = 1.0;
state.scalpingConfig.targetTakeProfit = 0;
state.scalpingConfig.trailingStopActivation = 5.0;
state.scalpingConfig.trailingStopDistance = 0.5;
fs.writeFileSync(file, JSON.stringify(state, null, 2));
console.log('patched');
