const fs = require('fs');
const data = JSON.parse(fs.readFileSync('server/data/backtests/bt_2025-07-30_to_2026-08-29_lot_0_to_50_1788009364368.json'));

const SL_ARR = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 6.0];
const TACT_ARR = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 5.0];
const TDIST_ARR = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0];

const results = [];

let mfeSum = 0, maeSum = 0;
for(let r of data) { mfeSum += r.MFE_Pct; maeSum += r.MAE_Pct; }
const avgMFE = (mfeSum/data.length).toFixed(2);
const avgMAE = (maeSum/data.length).toFixed(2);

for (let sl of SL_ARR) {
  for (let tact of TACT_ARR) {
    for (let tdist of TDIST_ARR) {
      if (tdist >= tact + sl) continue; 

      let netPnL = 0;
      let wins = 0;
      let losses = 0;
      let grossProfit = 0;
      let grossLoss = 0;
      let peak = 0;
      let maxDD = 0;
      let currentPnL = 0;

      for (const r of data) {
        let ret = r.netPnL_at_24h_Pct;
        if (r.path) {
          let maxHigh = 0; 
          let trailingActive = false;
          for (const k of r.path) {
            if (sl > 0 && k.lowPct <= -sl) { 
              ret = -sl - r.totalTradingCostPct; 
              break; 
            }
            if (tact > 0 && tdist > 0) {
               if (trailingActive && k.lowPct <= (maxHigh - tdist)) {
                 ret = (maxHigh - tdist) - r.totalTradingCostPct; 
                 break;
               }
               if (k.highPct >= tact) trailingActive = true;
               maxHigh = Math.max(maxHigh, k.highPct);
            }
          }
        }
        
        netPnL += ret;
        currentPnL += ret;
        if (currentPnL > peak) peak = currentPnL;
        let dd = peak - currentPnL;
        if (dd > maxDD) maxDD = dd;

        if (ret > 0) {
          wins++;
          grossProfit += ret;
        } else {
          losses++;
          grossLoss += Math.abs(ret);
        }
      }

      let winRate = (wins / data.length) * 100;
      let pf = grossLoss > 0 ? (grossProfit / grossLoss) : 999;
      let avgWin = wins > 0 ? grossProfit / wins : 0;
      let avgLoss = losses > 0 ? grossLoss / losses : 0;
      
      // Robustness Score: (Net PnL / Max Drawdown) * Profit Factor
      // Penalize configurations with negative PnL or crazy drawdowns
      let score = (netPnL > 0 && maxDD > 0) ? (netPnL / maxDD) * pf : 0;

      results.push({
        sl, tact, tdist, 
        netPnL, winRate, pf, maxDD,
        avgWin, avgLoss, score
      });
    }
  }
}

results.sort((a, b) => b.score - a.score);

console.log(`Avg MFE: ${avgMFE}%, Avg MAE: ${avgMAE}%, Total Trades: ${data.length}`);
console.log("Top 15 Most Robust Configurations (Sorted by Robustness Score):");
console.log("SL\tT_ACT\tT_DST\tNetPnL\tWin%\tPF\tMaxDD\tAvgWin\tAvgLoss\tScore");
for(let i=0; i<15; i++) {
  let x = results[i];
  if (!x) break;
  console.log(`${x.sl.toFixed(1)}\t${x.tact.toFixed(1)}\t${x.tdist.toFixed(1)}\t${x.netPnL.toFixed(1)}%\t${x.winRate.toFixed(1)}%\t${x.pf.toFixed(2)}\t${x.maxDD.toFixed(1)}%\t${x.avgWin.toFixed(2)}%\t${x.avgLoss.toFixed(2)}%\t${x.score.toFixed(2)}`);
}

// Print worst 3 just for context
console.log("\nWorst 3 (For reference):");
let worst = results.slice().sort((a, b) => a.netPnL - b.netPnL);
for(let i=0; i<3; i++) {
  let x = worst[i];
  console.log(`${x.sl.toFixed(1)}\t${x.tact.toFixed(1)}\t${x.tdist.toFixed(1)}\t${x.netPnL.toFixed(1)}%\t${x.winRate.toFixed(1)}%\t${x.pf.toFixed(2)}\t${x.maxDD.toFixed(1)}%\t${x.avgWin.toFixed(2)}%\t${x.avgLoss.toFixed(2)}%\t${x.score.toFixed(2)}`);
}

