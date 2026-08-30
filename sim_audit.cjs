const fs = require('fs');
const data = JSON.parse(fs.readFileSync('server/data/backtests/bt_2025-07-30_to_2026-08-29_lot_0_to_50_1788009364368.json'));

const SL = 2.0;
const T_ACT = 3.0;
const T_DIST = 1.0;

function run(simType, tpPct) {
  let simPnL = 0;
  let simWins = 0;
  let totalTrades = 0;
  let totalFees = 0;
  let counts = { SL: 0, TP: 0, Trailing: 0, '24h': 0 };

  for (const r of data) {
    totalTrades++;
    let simulatedReturn = r.netPnL_at_24h_Pct;
    let exitReason = '24h';
    totalFees += r.totalTradingCostPct;

    if (r.path && r.path.length > 0) {
      let maxHigh = 0;
      let trailingActive = false;

      for (const k of r.path) {
        // 1. SL Check
        if (SL > 0 && k.lowPct <= -SL) {
          simulatedReturn = -SL - r.totalTradingCostPct;
          exitReason = 'SL';
          break;
        }
        // 2. TP Check
        if (tpPct > 0 && k.highPct >= tpPct) {
          simulatedReturn = tpPct - r.totalTradingCostPct;
          exitReason = 'TP';
          break;
        }
        // 3. Trailing Check
        if (simType === 'OLD') {
           if (k.highPct >= T_ACT) trailingActive = true;
           maxHigh = Math.max(maxHigh, k.highPct);
           if (trailingActive && k.lowPct <= (maxHigh - T_DIST)) {
             simulatedReturn = (maxHigh - T_DIST) - r.totalTradingCostPct;
             exitReason = 'Trailing';
             break;
           }
        } else {
           // NEW: Evaluate using PREVIOUS maxHigh
           if (trailingActive && k.lowPct <= (maxHigh - T_DIST)) {
             simulatedReturn = (maxHigh - T_DIST) - r.totalTradingCostPct;
             exitReason = 'Trailing';
             break;
           }
           // NEW: Update for NEXT iteration
           if (k.highPct >= T_ACT) trailingActive = true;
           maxHigh = Math.max(maxHigh, k.highPct);
        }
      }
    }
    simPnL += simulatedReturn;
    if (simulatedReturn > 0) simWins++;
    counts[exitReason]++;
  }
  return {
    tpPct,
    simPnL: parseFloat(simPnL.toFixed(2)),
    winRate: parseFloat(((simWins / totalTrades) * 100).toFixed(2)),
    counts,
    fees: parseFloat(totalFees.toFixed(2))
  };
}

const tps = [0, 5, 15, 20, 25];
console.log("=== OLD RESULTS (With Look-Ahead Bias) ===");
tps.forEach(tp => console.log(JSON.stringify(run('OLD', tp))));
console.log("\n=== NEW RESULTS (Corrected Intrabar Logic) ===");
tps.forEach(tp => console.log(JSON.stringify(run('NEW', tp))));

