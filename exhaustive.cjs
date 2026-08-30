const fs = require('fs');
const data = JSON.parse(fs.readFileSync('server/data/backtests/bt_2025-07-30_to_2026-08-29_lot_0_to_50_1788009364368.json'));

for (let sl = 0; sl <= 10; sl += 0.5) {
  for (let tact = 0; tact <= 10; tact += 0.5) {
    for (let tdist = 0; tdist <= 5; tdist += 0.5) {
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
      if (Math.abs(pnl - (-212.78)) < 0.1) {
         console.log(`FOUND OLD: SL=${sl}, TACT=${tact}, TDIST=${tdist} -> PnL=${pnl.toFixed(2)}`);
      }
    }
  }
}
