const fs = require('fs');
const data = JSON.parse(fs.readFileSync('server/data/backtests/bt_2025-07-30_to_2026-08-29_lot_0_to_50_1788009364368.json'));

const TP_ARR = [0, 5, 10, 15, 20, 25];
const SL_ARR = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 6.0];
const TACT_ARR = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 5.0];
const TDIST_ARR = [0.5, 1.0, 1.5, 2.0, 2.5, 3.0];

const results = [];

for (let tp of TP_ARR) {
  for (let sl of SL_ARR) {
    for (let tact of TACT_ARR) {
      for (let tdist of TDIST_ARR) {
        if (tdist >= tact + sl) continue; 

        let netPnL = 0, wins = 0, losses = 0, grossProfit = 0, grossLoss = 0, peak = 0, maxDD = 0, currentPnL = 0;

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
              if (tp > 0 && k.highPct >= tp) {
                ret = tp - r.totalTradingCostPct;
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

          if (ret > 0) { wins++; grossProfit += ret; } 
          else { losses++; grossLoss += Math.abs(ret); }
        }

        let winRate = (wins / data.length) * 100;
        let pf = grossLoss > 0 ? (grossProfit / grossLoss) : 999;
        let avgWin = wins > 0 ? grossProfit / wins : 0;
        let avgLoss = losses > 0 ? grossLoss / losses : 0;
        let score = (netPnL > 0 && maxDD > 0) ? (netPnL / maxDD) * pf : 0;

        results.push({ tp, sl, tact, tdist, netPnL, winRate, pf, maxDD, avgWin, avgLoss, score });
      }
    }
  }
}

results.sort((a, b) => b.score - a.score);

console.log("=== Top 15 Most Robust Configurations Overall ===");
console.log("TP\tSL\tT_ACT\tT_DST\tNetPnL\tWin%\tPF\tMaxDD\tAvgWin\tAvgLoss\tScore");
for(let i=0; i<15; i++) {
  let x = results[i];
  if(!x) break;
  console.log(`${x.tp}%\t${x.sl.toFixed(1)}\t${x.tact.toFixed(1)}\t${x.tdist.toFixed(1)}\t${x.netPnL.toFixed(1)}%\t${x.winRate.toFixed(1)}%\t${x.pf.toFixed(2)}\t${x.maxDD.toFixed(1)}%\t${x.avgWin.toFixed(2)}%\t${x.avgLoss.toFixed(2)}%\t${x.score.toFixed(2)}`);
}

console.log("\n=== Best Configuration Per TP Value ===");
console.log("TP\tSL\tT_ACT\tT_DST\tNetPnL\tWin%\tPF\tMaxDD\tAvgWin\tAvgLoss\tScore");
for (let tp of TP_ARR) {
   let bestForTp = results.find(r => r.tp === tp);
   if (bestForTp) {
     let x = bestForTp;
     console.log(`${x.tp}%\t${x.sl.toFixed(1)}\t${x.tact.toFixed(1)}\t${x.tdist.toFixed(1)}\t${x.netPnL.toFixed(1)}%\t${x.winRate.toFixed(1)}%\t${x.pf.toFixed(2)}\t${x.maxDD.toFixed(1)}%\t${x.avgWin.toFixed(2)}%\t${x.avgLoss.toFixed(2)}%\t${x.score.toFixed(2)}`);
   }
}
