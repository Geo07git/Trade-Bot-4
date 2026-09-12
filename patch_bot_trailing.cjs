const fs = require('fs');
let content = fs.readFileSync('server/bot.ts', 'utf8');

// Default config update
const targetDefaultConfig = `      equityProtectionConfig: {
        enabled: true,
        profitThresholdPct: 0.8,
        drawdownProtectionPct: 0.1
      },`;

const replacementDefaultConfig = `      equityProtectionConfig: {
        enabled: true,
        trailingDistancePct: 0.40,
        highWaterMark: 0,
        isLocked: false
      },`;

if (content.includes(targetDefaultConfig)) {
  content = content.replace(targetDefaultConfig, replacementDefaultConfig);
}

// Update checkCircuitBreaker
const targetCB = `  public checkCircuitBreaker(): boolean {
    const equity = this.calculateEquity();`;

const replacementCB = `  public checkCircuitBreaker(): boolean {
    const equity = this.calculateEquity();
    const initial = (this.state.initialBalance && this.state.initialBalance > 0) ? this.state.initialBalance : 250;

    // Equity Trailing / Capital Protection Check (Risk Engine Level)
    if (this.state.equityProtectionConfig && this.state.equityProtectionConfig.enabled) {
      const config = this.state.equityProtectionConfig;
      if (!config.highWaterMark || config.highWaterMark < initial) {
        config.highWaterMark = initial;
      }
      if (equity > config.highWaterMark) {
        config.highWaterMark = equity;
      }

      const trailingPct = config.trailingDistancePct ?? 0.40;
      const protectionThreshold = config.highWaterMark * (1 - trailingPct / 100);

      if (equity < protectionThreshold && !config.isLocked && this.state.autoTradingActive) {
        config.isLocked = true;
        this.state.autoTradingActive = false;
        this.state.circuitBreakerTriggered = true;
        const reason = \`🛡️ [EQUITY TRAILING PROTECTION] HWM: $\${config.highWaterMark.toFixed(2)} | Equity: $\${equity.toFixed(2)} (Scădere > \${trailingPct}%). Poziții închise și auto-trading oprit.\`;
        this.state.circuitBreakerReason = reason;

        this.addLog(\`[EQUITY TRAILING PROTECTION] Prag trailing atins! HWM: $\${config.highWaterMark.toFixed(2)}, Curent: $\${equity.toFixed(2)} (Drop > \${trailingPct}%). Auto-trading blocat și poziții închise pentru protecția câștigurilor.\`, 'warning', equity);
        db.logEvent('EQUITY_TRAILING_ACTIVATED', { highWaterMark: config.highWaterMark, equity, trailingPct, threshold: protectionThreshold }, undefined, 'RiskEngine', 'EMERGENCY');

        this.closeAllPositionsForProtection();

        const telegramMsg = \`🛡️ **[EQUITY TRAILING PROTECTION ACTIVAT]**\\n\\n\` +
          \`Sistemul a detectat o retragere față de maximul de capital atins (High-Water Mark).\\n\\n\` +
          \`• **High-Water Mark (Vârf):** $\${config.highWaterMark.toFixed(2)} USDT\\n\` +
          \`• **Equity Curent:** $\${equity.toFixed(2)} USDT\\n\` +
          \`• **Trailing Prag:** \${trailingPct}%\\n\` +
          \`• **Acțiune:** Pozițiile active au fost închise și auto-trading-ul a fost oprit pentru a securiza câștigurile.\`;
        this.sendNotification(telegramMsg);
        this.savePersistedState();
        return true;
      }
    }`;

if (content.includes(targetCB)) {
  content = content.replace(targetCB, replacementCB);
}

// Add closeAllPositionsForProtection method before resetCircuitBreaker
const targetReset = `  public resetCircuitBreaker() {`;
const helperAndReset = `  private async closeAllPositionsForProtection() {
    try {
      const positions = [...this.state.positions];
      for (const pos of positions) {
        await this.executeTrade(pos.symbol, 'SELL', pos.currentPrice || pos.entryPrice, pos.amount);
      }
      this.addLog(\`[RISK ENGINE] Toate cele \${positions.length} poziții active au fost închise de protecția de equity trailing.\`, 'warning');
      db.logEvent('EQUITY_TRAILING_POSITIONS_CLOSED', { closedCount: positions.length }, undefined, 'RiskEngine', 'WARNING');
    } catch (err: any) {
      logger.error(\`[Equity Trailing] Error closing positions: \${err?.message || err}\`);
    }
  }

  public resetCircuitBreaker() {
    this.state.circuitBreakerTriggered = false;
    this.state.circuitBreakerReason = null;
    this.state.autoTradingActive = true;
    const currentEquity = this.calculateEquity();
    this.state.initialBalance = currentEquity > 0 ? currentEquity : 250;
    if (this.state.equityProtectionConfig) {
      this.state.equityProtectionConfig.highWaterMark = this.state.initialBalance;
      this.state.equityProtectionConfig.isLocked = false;
    }
    this.addLog(\`[CIRCUIT BREAKER & TRAILING RESETAT] Capital re-ancorat la $\${this.state.initialBalance.toFixed(2)} USDT. HWM re-setat. Auto-trading reluat.\`, 'info', this.state.initialBalance);
    db.logEvent('CIRCUIT_BREAKER_RESET', { initialBalance: this.state.initialBalance }, undefined, 'TradeBot', 'RESET');
    this.savePersistedState();
  }`;

if (content.includes(targetReset) && !content.includes('closeAllPositionsForProtection')) {
  content = content.replace(targetReset, helperAndReset);
}

fs.writeFileSync('server/bot.ts', content);
console.log('Successfully patched bot.ts for Equity Trailing');
