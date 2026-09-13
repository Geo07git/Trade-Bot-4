const fs = require('fs');
let code = fs.readFileSync('server/services/momentum/MomentumExecutor.ts', 'utf8');

const target = `  public start(intervalMinutes: number = 15) {
    // Clear any previous hard stop on manual start
    this.state.hardStopTriggered = null;`;

const replacement = `  public start(intervalMinutes: number = 15) {
    // Clear any previous hard stop on manual start
    this.state.hardStopTriggered = null;
    
    // Re-anchor starting balance if equity is out of sync
    const openPositionsValue = this.state.positions.reduce((sum, p) => {
      const curPrice = p.currentPrice || p.entryPrice;
      return sum + ((curPrice / p.entryPrice) * p.sizeUSDT);
    }, 0);
    const totalEquity = this.getEffectiveBalance() + openPositionsValue;
    if (totalEquity > 0 && totalEquity < (this.state.startingBalanceUSDT || 1000) * 0.5) {
      this.state.startingBalanceUSDT = totalEquity;
      this.log(\`[RE-ANCHOR] Capitalul inițial a fost re-ancorat la valoarea curentă de $\${totalEquity.toFixed(2)} pentru a evita falsul Hard Stop.\`);
    }`;

code = code.replace(target, replacement);
fs.writeFileSync('server/services/momentum/MomentumExecutor.ts', code);
console.log('MomentumExecutor.ts start patched successfully');
