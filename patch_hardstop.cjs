const fs = require('fs');
let code = fs.readFileSync('server/services/momentum/MomentumExecutor.ts', 'utf8');

const target = `  public checkHardStopCircuitBreaker(): boolean {
    const openPositionsValue = this.state.positions.reduce((sum, p) => {
      const curPrice = p.currentPrice || p.entryPrice;
      const curVal = (curPrice / p.entryPrice) * p.sizeUSDT;
      return sum + curVal;
    }, 0);
    const totalEquity = this.getEffectiveBalance() + openPositionsValue;
    const startBal = this.externalStartingBalanceProvider ? this.externalStartingBalanceProvider() : (this.state.startingBalanceUSDT || 10000);

    // 1. Hard Stop at -50% from initial balance
    if (totalEquity <= startBal * 0.50) {
      if (this.state.hardStopTriggered !== 'DRAWDOWN_50') {
        this.state.hardStopTriggered = 'DRAWDOWN_50';
        this.state.active = false;
        if (this.timer) { clearInterval(this.timer); this.timer = null; }
        if (this.hourTimer) { clearInterval(this.hourTimer); this.hourTimer = null; }
        if (this.positionTimer) { clearInterval(this.positionTimer); this.positionTimer = null; }
        this.log(\`[HARD STOP CIRCUIT BREAKER 🛑] Balanța totală ($\${totalEquity.toFixed(2)}) a scăzut la -50% din capitalul inițial ($\${startBal.toFixed(2)}). Tranzacționarea a fost OPRITĂ automat.\`);
        this.saveState();
      }
      return true;
    }

    // 2. Hard Stop at +100% from initial balance (target doubled)
    if (totalEquity >= startBal * 2.00) {
      if (this.state.hardStopTriggered !== 'PROFIT_100') {
        this.state.hardStopTriggered = 'PROFIT_100';
        this.state.active = false;
        if (this.timer) { clearInterval(this.timer); this.timer = null; }
        if (this.hourTimer) { clearInterval(this.hourTimer); this.hourTimer = null; }
        if (this.positionTimer) { clearInterval(this.positionTimer); this.positionTimer = null; }
        this.log(\`[TARGET PROFIT REACHED 🏆] Țintă atinsă! Balanța totală ($\${totalEquity.toFixed(2)}) a crescut cu +100% față de capitalul inițial ($\${startBal.toFixed(2)}). Tranzacționarea a fost OPRITĂ cu succes.\`);
        this.saveState();
      }
      return true;
    }

    return false;
  }`;

const replacement = `  public checkHardStopCircuitBreaker(): boolean {
    // Disabled per user request - Paper trading runs uninterrupted without hard stops
    return false;
  }`;

code = code.replace(target, replacement);
fs.writeFileSync('server/services/momentum/MomentumExecutor.ts', code);
console.log('Hard stop disabled successfully');
