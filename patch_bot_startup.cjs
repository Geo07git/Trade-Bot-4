const fs = require('fs');
let content = fs.readFileSync('server/bot.ts', 'utf8');

const targetStartup = `        if (!this.state.testnetApiKey && process.env.BINANCE_TESTNET_API_KEY) this.state.testnetApiKey = process.env.BINANCE_TESTNET_API_KEY;`;

const replaceStartup = `        if (!this.state.testnetApiKey && process.env.BINANCE_TESTNET_API_KEY) this.state.testnetApiKey = process.env.BINANCE_TESTNET_API_KEY;
        
      // SANITY CHECK: Correct corrupted balance if margin wasn't deducted
      const marginSum = this.state.positions.reduce((acc, pos) => acc + (pos.margin || 0), 0);
      if (marginSum > 0 && Math.abs(this.state.balance - (this.state.initialBalance || 0)) < 10) {
         this.state.balance = Math.max(0, this.state.balance - marginSum);
         logger.info(\`[SANITATION] Corrected corrupted balance by subtracting margin. New balance: \${this.state.balance}\`);
         if (this.state.equityProtectionConfig) {
            const currentEq = this.calculateEquity();
            this.state.equityProtectionConfig.highWaterMark = currentEq;
            logger.info(\`[SANITATION] Recalculated HWM to \${currentEq}\`);
         }
      }`;

if (content.includes(targetStartup)) {
  content = content.replace(targetStartup, replaceStartup);
  fs.writeFileSync('server/bot.ts', content);
  console.log('Patched bot.ts startup sanity check');
} else {
  console.log('Failed to patch startup check');
}
