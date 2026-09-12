const fs = require('fs');
let content = fs.readFileSync('server/bot.ts', 'utf8');

const target = `        // Ensure HWM is never randomly inflated
        if (this.state.equityProtectionConfig) {
           const currentEq = this.state.balance + marginSum; // Base equity without unclosed PnL to anchor it
           if (this.state.equityProtectionConfig.highWaterMark > currentEq + 50) {
              logger.info(\`[SANITATION] HWM was artificially high (\${this.state.equityProtectionConfig.highWaterMark}). Resetting to \${currentEq}\`);
              this.state.equityProtectionConfig.highWaterMark = currentEq;
           }
        }`;

const replacement = `        // Ensure HWM is never randomly inflated
        if (this.state.equityProtectionConfig) {
           const mSum = this.state.positions.reduce((acc, pos) => acc + (pos.margin || 0), 0);
           const currentEq = this.state.balance + mSum; // Base equity without unclosed PnL to anchor it
           if (this.state.equityProtectionConfig.highWaterMark > currentEq + 50) {
              logger.info(\`[SANITATION] HWM was artificially high (\${this.state.equityProtectionConfig.highWaterMark}). Resetting to \${currentEq}\`);
              this.state.equityProtectionConfig.highWaterMark = currentEq;
           }
        }`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync('server/bot.ts', content);
  console.log('Fixed marginSum reference');
} else {
  console.log('Could not find target');
}
