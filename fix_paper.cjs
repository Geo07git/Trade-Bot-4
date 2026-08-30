const fs = require('fs');
let code = fs.readFileSync('server/services/momentum/PaperTrader.ts', 'utf8');

code = code.replace(`    this.timer = setInterval(() => {
      this.runCycle();
    }, intervalMinutes * 60 * 1000);
  }`, `    this.timer = setInterval(() => {
      this.runCycle();
    }, intervalMinutes * 60 * 1000);

    // Fast loop for MFE/MAE and current price updates
    this.updatePositionsFast();
    this.positionTimer = setInterval(() => {
      this.updatePositionsFast();
    }, 15000); // 15 seconds
  }`);

code = code.replace(`  public stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.state.active = false;
    this.log('Paper trading stopped.');
    this.saveState();
  }`, `  public stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.positionTimer) {
      clearInterval(this.positionTimer);
      this.positionTimer = null;
    }
    this.state.active = false;
    this.log('Paper trading stopped.');
    this.saveState();
  }

  private async updatePositionsFast() {
    if (!this.state.active || this.state.positions.length === 0) return;
    try {
      const res = await fetch('https://api.binance.com/api/v3/ticker/price');
      const tickers = await res.json();
      const priceMap = new Map<string, number>();
      for (const t of tickers) {
        priceMap.set(t.symbol, parseFloat(t.price));
      }
      
      let stateChanged = false;
      for (const pos of this.state.positions) {
        if (pos.status === 'OPEN') {
           const currentPrice = priceMap.get(pos.symbol);
           if (currentPrice) {
             const pctMove = ((currentPrice / pos.entryPrice) - 1) * 100;
             pos.currentPrice = currentPrice;
             pos.currentPnLPct = pctMove;
             
             if (pctMove > pos.maxFavorableExcursion || pctMove < pos.maxAdverseExcursion) {
                pos.maxFavorableExcursion = Math.max(pos.maxFavorableExcursion, pctMove);
                pos.maxAdverseExcursion = Math.min(pos.maxAdverseExcursion, pctMove);
             }
             stateChanged = true;
           }
        }
      }
      if (stateChanged) this.saveState();
    } catch (err) {
      this.log('Eroare la actualizarea rapida a preturilor: ' + String(err));
    }
  }`);

fs.writeFileSync('server/services/momentum/PaperTrader.ts', code);
