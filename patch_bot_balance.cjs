const fs = require('fs');
let content = fs.readFileSync('server/bot.ts', 'utf8');

// 1. Remove the bad realFreeUSDT assignment after trade
const target1 = `              if (realFreeUSDT !== null) {
                this.state.balance = realFreeUSDT;
              }`;
content = content.replace(target1, `              // Skipped setting balance to realFreeUSDT because it is the PRE-TRADE balance.`);

// 2. Always deduct balance for BUY
const target2 = `        if (this.state.binanceMode !== 'live') {
          this.state.balance = Math.max(0, this.state.balance - actualDeductCost - finalFee);
        }`;
content = content.replace(target2, `        // Deduct balance locally for all modes so Equity remains correct
        this.state.balance = Math.max(0, this.state.balance - actualDeductCost - finalFee);`);

fs.writeFileSync('server/bot.ts', content);
console.log('Patched bot.ts balance deduction');
