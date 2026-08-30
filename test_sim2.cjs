const fs = require('fs');
const data = JSON.parse(fs.readFileSync('server/data/backtests/bt_2025-07-30_to_2026-08-29_lot_0_to_50_1788009364368.json'));

function simulate(tpPct, slPct, trailingAct, trailingDist) {
  let simPnL = 0;
  let simWins = 0;
  let totalTrades = 0;

  for (const r of data) {
    totalTrades++;
    let simulatedReturn = r.netPnL_at_24h_Pct;
    if (r.path && r.path.length > 0) {
      let maxHigh = 0;
      let trailingActive = false;

      for (const k of r.path) {
        if (slPct > 0 && k.lowPct <= -slPct) {
          simulatedReturn = -slPct - r.totalTradingCostPct;
          break;
        }
        if (tpPct > 0 && k.highPct >= tpPct) {
          simulatedReturn = tpPct - r.totalTradingCostPct;
          break;
        }
        if (trailingAct > 0 && trailingDist > 0) {
           if (k.highPct >= trailingAct) trailingActive = true;
           maxHigh = Math.max(maxHigh, k.highPct);
           if (trailingActive && k.lowPct <= (maxHigh - trailingDist)) {
             simulatedReturn = (maxHigh - trailingDist) - r.totalTradingCostPct;
             break;
           }
        }
      }
    }
    simPnL += simulatedReturn;
    if (simulatedReturn > 0) simWins++;
  }
  return { simPnL: simPnL.toFixed(2), simWinRate: ((simWins / totalTrades) * 100).toFixed(2) };
}

console.log("Original: ", simulate(0, 0, 0, 0));
console.log("SL 5%, TP 20%: ", simulate(20, 5, 0, 0));
console.log("SL 5%, TP 25%: ", simulate(25, 5, 0, 0));
