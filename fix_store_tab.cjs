const fs = require('fs');
let code = fs.readFileSync('src/store.ts', 'utf8');

const target = `  setAutoTradingActive: (active) => {`;
const replacement = `  setTerminalActiveTab: (tab) => set({ terminalActiveTab: tab }),

  setAutoTradingActive: (active) => {`;

code = code.replace(target, replacement);
fs.writeFileSync('src/store.ts', code);
