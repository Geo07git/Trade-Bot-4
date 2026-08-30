const fs = require('fs');

function runEvaluation() {
  const oosFile = 'server/data/backtests/bt_OOS.json';
  if (!fs.existsSync(oosFile)) {
    console.log("Waiting for OOS file...");
    return;
  }
  const data = JSON.parse(fs.readFileSync(oosFile));
  if (data.length === 0) {
     console.log("No trades in OOS");
     return;
  }

  const CONFIGS = [
    { name: "Apex (Top 1)", sl: 1.0, tact: 5.0, tdist: 0.5, tp: 0 },
    { name: "Top 2", sl: 1.0, tact: 4.0, tdist: 0.5, tp: 0 }
  ];

  let mfeSum = 0, maeSum = 0;
  for(let r of data) { mfeSum += r.MFE_Pct; maeSum += r.MAE_Pct; }
  const avgMFE = (mfeSum/data.length).toFixed(2);
  const avgMAE = (maeSum/data.length).toFixed(2);

  console.log(`=== OOS METRICS ===`);
  console.log(`Total Trades: ${data.length}`);
  console.log(`Avg MFE: ${avgMFE}%`);
  console.log(`Avg MAE: ${avgMAE}%`);
  console.log(`\nConfig\tNetPnL\tWin%\tPF\tMaxDD\tAvgWin\tAvgLoss\tScore`);

  for (let c of CONFIGS) {
    let netPnL = 0, wins = 0, losses = 0, grossProfit = 0, grossLoss = 0, peak = 0, maxDD = 0, currentPnL = 0;

    for (const r of data) {
      let ret = r.netPnL_at_24h_Pct;
      if (r.path) {
        let maxHigh = 0; 
        let trailingActive = false;
        for (const k of r.path) {
          if (c.sl > 0 && k.lowPct <= -c.sl) { 
            ret = -c.sl - r.totalTradingCostPct; 
            break; 
          }
          if (c.tp > 0 && k.highPct >= c.tp) {
            ret = c.tp - r.totalTradingCostPct;
            break;
          }
          if (c.tact > 0 && c.tdist > 0) {
             if (trailingActive && k.lowPct <= (maxHigh - c.tdist)) {
               ret = (maxHigh - c.tdist) - r.totalTradingCostPct; 
               break;
             }
             if (k.highPct >= c.tact) trailingActive = true;
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

    console.log(`${c.name}\t${netPnL.toFixed(1)}%\t${winRate.toFixed(1)}%\t${pf.toFixed(2)}\t${maxDD.toFixed(1)}%\t${avgWin.toFixed(2)}%\t${avgLoss.toFixed(2)}%\t${score.toFixed(2)}`);
    
    // Distribution of returns
    let rets = data.map(r => {
      let ret = r.netPnL_at_24h_Pct;
      if (r.path) {
        let maxHigh = 0; let trailingActive = false;
        for (const k of r.path) {
          if (c.sl > 0 && k.lowPct <= -c.sl) { ret = -c.sl - r.totalTradingCostPct; break; }
          if (c.tp > 0 && k.highPct >= c.tp) { ret = c.tp - r.totalTradingCostPct; break; }
          if (c.tact > 0 && c.tdist > 0) {
             if (trailingActive && k.lowPct <= (maxHigh - c.tdist)) { ret = (maxHigh - c.tdist) - r.totalTradingCostPct; break; }
             if (k.highPct >= c.tact) trailingActive = true;
             maxHigh = Math.max(maxHigh, k.highPct);
          }
        }
      }
      return ret;
    }).sort((a,b)=>a-b);
    
    let p10 = rets[Math.floor(rets.length*0.1)].toFixed(2);
    let p50 = rets[Math.floor(rets.length*0.5)].toFixed(2);
    let p90 = rets[Math.floor(rets.length*0.9)].toFixed(2);
    let p99 = rets[Math.floor(rets.length*0.99)].toFixed(2);
    console.log(`   Distribution: P10=${p10}%, Median=${p50}%, P90=${p90}%, P99=${p99}%`);
  }
}

runEvaluation();
