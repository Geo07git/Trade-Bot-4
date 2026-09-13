const fs = require('fs');
let botCode = fs.readFileSync('server/bot.ts', 'utf8');

const target1 = `  public checkCircuitBreaker(): boolean {
    const equity = this.calculateEquity();
    const initBal = (this.state.initialBalance && this.state.initialBalance > 0) ? this.state.initialBalance : 250;`;

const replacement1 = `  public checkCircuitBreaker(): boolean {
    if (this.state.equityProtectionConfig?.isLocked) {
      return true; // Bypass all checks while in the middle of closing positions for Trailing Reset
    }

    const equity = this.calculateEquity();
    const initBal = (this.state.initialBalance && this.state.initialBalance > 0) ? this.state.initialBalance : 250;`;

if (botCode.includes('public checkCircuitBreaker(): boolean {')) {
  botCode = botCode.replace(target1, replacement1);
  fs.writeFileSync('server/bot.ts', botCode);
  console.log('checkCircuitBreaker patched');
}
