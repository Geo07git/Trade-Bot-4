const fs = require('fs');
const data = JSON.parse(fs.readFileSync('server/data/backtests/bt_2025-07-30_to_2026-08-29_lot_0_to_50_1788009364368.json'));

for (let sl of [1, 1.5, 2, 2.5, 3, 3.5, 4, 5]) {
  for (let tact of [1, 1.5, 2, 2.5, 3, 3.5, 4, 5]) {
    for (let tdist of [0.5, 1, 1.5, 2, 2.5, 3]) {
      let pnl = 0;
      for (const r of data) {
        let ret = r.netPnL_at_24h_Pct;
        if (r.path) {
          let maxHigh = 0; let trailingActive = false;
          for (const k of r.path) {
            if (sl > 0 && k.lowPct <= -sl) { ret = -sl - r.totalTradingCostPct; break; }
            if (tact > 0 && tdist > 0) {
               if (trailingActive && k.lowPct <= (maxHigh - tdist)) {
                 ret = (maxHigh - tdist) - r.totalTradingCostPct; break;
               }
               if (k.highPct >= tact) trailingActive = true;
               maxHigh = Math.max(maxHigh, k.highPct);
            }
          }
        }
        pnl += ret;
      }
      if (Math.abs(pnl - (-212.78)) < 1.0) {
         console.log(`FOUND NEW: SL=${sl}, TACT=${tact}, TDIST=${tdist} -> PnL=${pnl.toFixed(2)}`);
      }
    }
  }
}
