const fs = require('fs');
let content = fs.readFileSync('server/bot.ts', 'utf8');

const targetStart = `      if (isStarting) {
        this.state.circuitBreakerTriggered = false;
        this.state.circuitBreakerReason = null;
        const currentEq = this.calculateEquity();`;

const replaceStart = `      if (isStarting) {
        this.state.circuitBreakerTriggered = false;
        this.state.circuitBreakerReason = null;
        const currentEq = this.calculateEquity();
        if (this.state.equityProtectionConfig) {
           this.state.equityProtectionConfig.isLocked = false;
           this.state.equityProtectionConfig.highWaterMark = currentEq > 0 ? currentEq : 250;
        }`;

if (content.includes(targetStart)) {
  content = content.replace(targetStart, replaceStart);
  fs.writeFileSync('server/bot.ts', content);
  console.log('Patched autoTradingActive reset');
} else {
  console.log('Failed to patch autoTradingActive reset');
}
