const fs = require('fs');

// 1. Fix BloombergTerminal.tsx
let btCode = fs.readFileSync('src/components/BloombergTerminal.tsx', 'utf8');
const btTarget = `  const totalProfit = equity - initialBalance;
  const totalProfitPct = initialBalance > 0 ? (totalProfit / initialBalance) * 100 : 0;`;

const btReplacement = `  const effectiveBase = (initialBalance && initialBalance > 0) ? initialBalance : (equity - unrealizedPnL);
  const totalProfit = equity - effectiveBase;
  const totalProfitPct = effectiveBase > 0 ? (totalProfit / effectiveBase) * 100 : 0;`;

if (btCode.includes(btTarget)) {
  btCode = btCode.replace(btTarget, btReplacement);
  fs.writeFileSync('src/components/BloombergTerminal.tsx', btCode);
  console.log('BloombergTerminal.tsx patched for robust profit calculation');
}

// 2. Fix SuperDashboard.tsx
let sdCode = fs.readFileSync('src/components/SuperDashboard.tsx', 'utf8');
const sdTarget = `  const totalPnL = equity - initialBalance;
  const totalPnLPercent = initialBalance > 0 ? (totalPnL / initialBalance) * 100 : 0;`;

const sdReplacement = `  const effectiveBase = (initialBalance && initialBalance > 0) ? initialBalance : (equity - unrealizedPnL);
  const totalPnL = equity - effectiveBase;
  const totalPnLPercent = effectiveBase > 0 ? (totalPnL / effectiveBase) * 100 : 0;`;

if (sdCode.includes(sdTarget)) {
  sdCode = sdCode.replace(sdTarget, sdReplacement);
  fs.writeFileSync('src/components/SuperDashboard.tsx', sdCode);
  console.log('SuperDashboard.tsx patched for robust profit calculation');
}

// 3. Fix Dashboard.tsx
let dCode = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');
const dTarget = `  const dayChange = equity - initialBalance;
  const dayChangePercent = initialBalance > 0 ? (dayChange / initialBalance) * 100 : 0;`;

const dReplacement = `  const effectiveBase = (initialBalance && initialBalance > 0) ? initialBalance : (equity - unrealizedPnL);
  const dayChange = equity - effectiveBase;
  const dayChangePercent = effectiveBase > 0 ? (dayChange / effectiveBase) * 100 : 0;`;

if (dCode.includes(dTarget)) {
  dCode = dCode.replace(dTarget, dReplacement);
  fs.writeFileSync('src/components/Dashboard.tsx', dCode);
  console.log('Dashboard.tsx patched for robust profit calculation');
}
