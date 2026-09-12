const fs = require('fs');
let content = fs.readFileSync('server/bot.ts', 'utf8');

const targetReset = `  public resetCircuitBreaker() {
    this.state.circuitBreakerTriggered = false;
    this.state.circuitBreakerReason = null;
    this.state.autoTradingActive = true;
    const currentEquity = this.calculateEquity();
    this.state.initialBalance = currentEquity > 0 ? currentEquity : 250;
    this.addLog(\`[CIRCUIT BREAKER RESETAT] Circuit breaker eliberat. Capital re-ancorat la \$\${this.state.initialBalance.toFixed(2)} USDT. Auto-trading reluat.\`, 'info', this.state.initialBalance);
    this.savePersistedState();
  }`;

const replaceReset = `  public resetCircuitBreaker() {
    this.state.circuitBreakerTriggered = false;
    this.state.circuitBreakerReason = null;
    this.state.autoTradingActive = true;
    const currentEquity = this.calculateEquity();
    this.state.initialBalance = currentEquity > 0 ? currentEquity : 250;
    
    // Also reset Equity Trailing protection state
    if (this.state.equityProtectionConfig) {
      this.state.equityProtectionConfig.isLocked = false;
      this.state.equityProtectionConfig.highWaterMark = currentEquity > 0 ? currentEquity : 250;
    }

    this.addLog(\`[CIRCUIT BREAKER RESETAT] Circuit breaker și Equity Trailing eliberate. Capital re-ancorat la \$\${this.state.initialBalance.toFixed(2)} USDT. Auto-trading reluat.\`, 'info', this.state.initialBalance);
    this.savePersistedState();
  }`;

if (content.includes(targetReset)) {
  content = content.replace(targetReset, replaceReset);
  fs.writeFileSync('server/bot.ts', content);
  console.log('Patched resetCircuitBreaker');
} else {
  console.log('Failed to patch resetCircuitBreaker');
}
