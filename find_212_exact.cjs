const fs = require('fs');
const data = JSON.parse(fs.readFileSync('server/data/backtests/bt_2025-07-30_to_2026-08-29_lot_0_to_50_1788009364368.json'));

for (let sl of [0, 1, 1.5, 2, 2.5, 3, 4, 5, 2.5, 3.5, 4.5, 5.5, 6, 7, 8, 9, 10]) {
  for (let tact of [0, 1, 2, 3, 4, 5, 6]) {
    for (let tdist of [0, 0.5, 1, 1.5, 2, 3, 4]) {
      let pnl = 0;
      for (const r of data) {
        let ret = r.netPnL_at_24h_Pct;
        if (r.path) {
          let maxHigh = 0; let trailingActive = false;
          for (const k of r.path) {
            if (sl > 0 && k.lowPct <= -sl) { ret = -sl - r.totalTradingCostPct; break; }
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
      if (Math.abs(pnl - (-212.78)) < 1.0) {
         console.log(`FOUND! SL=${sl}, TACT=${tact}, TDIST=${tdist} -> PnL=${pnl.toFixed(2)}`);
      }
    }
  }
}
