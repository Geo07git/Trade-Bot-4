const fs = require('fs');
let code = fs.readFileSync('src/store.ts', 'utf8');

// interface TradingStore {
const interfaceTarget = `  autoTradingActive: boolean;`;
const interfaceReplacement = `  autoTradingActive: boolean;
  terminalActiveTab: 'matrix' | 'blotter' | 'intelligence' | 'audit';
  setTerminalActiveTab: (tab: 'matrix' | 'blotter' | 'intelligence' | 'audit') => void;`;
code = code.replace(interfaceTarget, interfaceReplacement);

// const initialState = {
const initialTarget = `  autoTradingActive: false,`;
const initialReplacement = `  autoTradingActive: false,
  terminalActiveTab: 'matrix' as const,`;
code = code.replace(initialTarget, initialReplacement);

// setAutoTradingActive: (active) => set({ autoTradingActive: active }),
const actionTarget = `  setAutoTradingActive: (active) => set({ autoTradingActive: active }),`;
const actionReplacement = `  setAutoTradingActive: (active) => set({ autoTradingActive: active }),
  setTerminalActiveTab: (tab) => set({ terminalActiveTab: tab }),`;
code = code.replace(actionTarget, actionReplacement);

fs.writeFileSync('src/store.ts', code);
console.log('store.ts patched');
