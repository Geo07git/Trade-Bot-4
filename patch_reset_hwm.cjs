const fs = require('fs');
let content = fs.readFileSync('server/bot.ts', 'utf8');

const resetTarget = `  public resetPortfolio(newBalance = 10000) {
    this.state.balance = newBalance;
    this.state.initialBalance = newBalance;
    this.state.positions = [];
    this.state.logs = [];
    this.state.circuitBreakerTriggered = false;
    this.state.circuitBreakerReason = null;`;

const resetReplacement = `  public resetPortfolio(newBalance = 10000) {
    this.state.balance = newBalance;
    this.state.initialBalance = newBalance;
    this.state.positions = [];
    this.state.logs = [];
    this.state.circuitBreakerTriggered = false;
    this.state.circuitBreakerReason = null;
    if (this.state.equityProtectionConfig) {
      this.state.equityProtectionConfig.isLocked = false;
      this.state.equityProtectionConfig.highWaterMark = newBalance;
    }`;

if (content.includes(resetTarget)) {
  content = content.replace(resetTarget, resetReplacement);
  fs.writeFileSync('server/bot.ts', content);
  console.log('Patched resetPortfolio');
}

const autoTarget = `      if (isStarting) {
        this.state.circuitBreakerTriggered = false;
        this.state.circuitBreakerReason = null;
        const currentEq = this.calculateEquity();
        if (this.state.equityProtectionConfig) {
           this.state.equityProtectionConfig.isLocked = false;
           this.state.equityProtectionConfig.highWaterMark = currentEq > 0 ? currentEq : 250;
        }`;

// We also need to fix checkCircuitBreaker logic so it doesn't instantly snap HWM back if it's somehow out of sync.
const circuitTarget = `      if (!config.highWaterMark || config.highWaterMark < initBal) {
        config.highWaterMark = initBal;
      }
      if (equity > config.highWaterMark) {
        config.highWaterMark = equity;
      }`;

const circuitReplace = `      if (!config.highWaterMark || config.highWaterMark < initBal) {
        config.highWaterMark = initBal;
      }
      // If HWM is absurdly higher than equity (e.g. from an old bug), pull it down.
      if (config.highWaterMark > equity + 50) {
         config.highWaterMark = equity;
      }
      if (equity > config.highWaterMark) {
        config.highWaterMark = equity;
      }`;

if (content.includes(circuitTarget)) {
  content = content.replace(circuitTarget, circuitReplace);
  fs.writeFileSync('server/bot.ts', content);
  console.log('Patched checkCircuitBreaker absured HWM fallback');
} else {
  console.log('circuit breaker target not found');
}
