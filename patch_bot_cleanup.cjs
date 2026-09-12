const fs = require('fs');
let content = fs.readFileSync('server/bot.ts', 'utf8');

const targetStartup = `      // SANITY CHECK: Correct corrupted balance if margin wasn't deducted
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

const replaceStartup = ``;

const appendTarget = `        if (typeof parsed === 'object' && parsed !== null && Array.isArray(parsed.positions)) {
          this.state.positions = parsed.positions;
        } else {
          this.state.positions = [];
        }`;

const appendReplacement = `        if (typeof parsed === 'object' && parsed !== null && Array.isArray(parsed.positions)) {
          this.state.positions = parsed.positions;
        } else {
          this.state.positions = [];
        }

        // HARD SANITATION: Fix balance and equity issues right after positions are loaded
        const marginSum = this.state.positions.reduce((acc, pos) => acc + (pos.margin || 0), 0);
        if (marginSum > 0 && Math.abs(this.state.balance - (this.state.initialBalance || 0)) < 10) {
          this.state.balance = Math.max(0, this.state.balance - marginSum);
          logger.info(\`[SANITATION] Deducted missing margin (\${marginSum}) from balance. New balance: \${this.state.balance}\`);
        }
        
        // Ensure HWM is never randomly inflated
        if (this.state.equityProtectionConfig) {
           const currentEq = this.state.balance + marginSum; // Base equity without unclosed PnL to anchor it
           if (this.state.equityProtectionConfig.highWaterMark > currentEq + 50) {
              logger.info(\`[SANITATION] HWM was artificially high (\${this.state.equityProtectionConfig.highWaterMark}). Resetting to \${currentEq}\`);
              this.state.equityProtectionConfig.highWaterMark = currentEq;
           }
        }`;

if (content.includes(targetStartup)) {
  content = content.replace(targetStartup, replaceStartup);
}

if (content.includes(appendTarget)) {
  content = content.replace(appendTarget, appendReplacement);
  fs.writeFileSync('server/bot.ts', content);
  console.log('Patched bot.ts hard sanity check properly');
} else {
  console.log('Failed to patch hard startup check properly');
}
