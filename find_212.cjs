const fs = require('fs');
const data = JSON.parse(fs.readFileSync('server/data/backtests/bt_2025-07-30_to_2026-08-29_lot_0_to_50_1788009364368.json'));

function testConfig(sl, tp, tact, tdist) {
  let pnl = 0;
  for (const r of data) {
    let ret = r.netPnL_at_24h_Pct;
    if (r.path) {
      let maxHigh = 0; let trailingActive = false;
      for (const k of r.path) {
        if (sl > 0 && k.lowPct <= -sl) { ret = -sl - r.totalTradingCostPct; break; }
        if (tp > 0 && k.highPct >= tp) { ret = tp - r.totalTradingCostPct; break; }
        if (tact > 0 && tdist > 0) {
           if (k.highPct >= tact) trailingActive = true;
           maxHigh = Math.max(maxHigh, k.highPct);
           if (trailingActive && k.lowPct <= (maxHigh - tdist)) {
             ret = (maxHigh - tdist) - r.totalTradingCostPct; break;
           }
        }
      }
    }
    pnl += ret;
  }
  return pnl.toFixed(2);
}

console.log("SL=2.0, TP=0, TACT=0, TDIST=0 : ", testConfig(2.0, 0, 0, 0));
console.log("SL=0, TP=0, TACT=3, TDIST=1 : ", testConfig(0, 0, 3.0, 1.0));
console.log("SL=2.0, TP=0, TACT=3, TDIST=1 : ", testConfig(2.0, 0, 3.0, 1.0));
