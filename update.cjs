const fs = require('fs');
let code = fs.readFileSync('server/bot.ts', 'utf8');

const target = `
      // Trigger ONLY when armed (profit reached) and equity retreats below protectionThreshold
      if (isArmed && equity < protectionThreshold && !config.isLocked && this.state.autoTradingActive) {
        config.isLocked = true;
        this.state.autoTradingActive = false;
        this.state.circuitBreakerTriggered = true;
        const reason = \`🛡️ [EQUITY TRAILING PROTECTION] HWM: \${config.highWaterMark.toFixed(2)} | Equity: \${equity.toFixed(2)} (Scădere > \${trailingPct}% după profit > \${profitThresholdPct}%). Poziții închise și auto-trading oprit.\`;
        this.state.circuitBreakerReason = reason;
        this.addLog(\`[EQUITY TRAILING PROTECTION] Prag trailing atins! HWM: \${config.highWaterMark.toFixed(2)}, Curent: \${equity.toFixed(2)} (Drop > \${trailingPct}% după profit > \${profitThresholdPct}%). Auto-trading blocat și poziții închise pentru protecția câștigurilor.\`, 'warning', equity);
        db.logEvent('EQUITY_TRAILING_ACTIVATED', { highWaterMark: config.highWaterMark, equity, trailingPct, profitThresholdPct, threshold: protectionThreshold }, undefined, 'RiskEngine', 'EMERGENCY');
        this.closeAllPositionsForProtection();
        const telegramMsg = \`🛡️ **[EQUITY TRAILING PROTECTION ACTIVAT]**\\n\\n\` +
          \`Sistemul a securizat profitul după atingerea pragului de activare (+\${profitThresholdPct}%).\\n\\n\` +
          \`• **High-Water Mark (Vârf):** \${config.highWaterMark.toFixed(2)} USDT\\n\` +
          \`• **Equity Curent:** \${equity.toFixed(2)} USDT\\n\` +
          \`• **Trailing Prag:** \${trailingPct}%\\n\` +
          \`• **Prag Minim Profit:** +\${profitThresholdPct}%\\n\` +
          \`• **Acțiune:** Toate pozițiile au fost închise la piață și profitul net a fost securizat în balanță.\`;
        this.sendNotification(telegramMsg);
        this.savePersistedState();
        return true;
      }
`;

const replacement = `
      // Trigger ONLY when armed (profit reached) and equity retreats below protectionThreshold
      if (isArmed && equity < protectionThreshold && !config.isLocked && this.state.autoTradingActive) {
        // We do NOT lock or stop auto-trading. We restart a new cycle immediately.
        const oldHwm = config.highWaterMark;
        config.highWaterMark = equity; // Temporarily reset to avoid re-triggering while selling
        
        const reason = \`🛡️ [EQUITY TRAILING - CICLU COMPLETAT] Profit securizat! HWM: \${oldHwm.toFixed(2)} | Equity curent: \${equity.toFixed(2)}. Poziții închise, se relansează un nou ciclu automat.\`;
        
        this.addLog(reason, 'success', equity);
        db.logEvent('EQUITY_TRAILING_AUTO_RESTART', { highWaterMark: oldHwm, equity, trailingPct, profitThresholdPct }, undefined, 'RiskEngine', 'SYSTEM');
        
        // Asynchronously close positions and restart
        this.closeAllPositionsForProtection(false).then(() => {
           const newEquity = this.calculateEquity();
           this.state.initialBalance = newEquity > 0 ? newEquity : 250;
           if (this.state.equityProtectionConfig) {
               this.state.equityProtectionConfig.highWaterMark = this.state.initialBalance;
           }
           this.addLog(\`🔄 [REPORNIRE AUTOMATĂ] Capital re-ancorat la \${this.state.initialBalance.toFixed(2)} USDT. Noul ciclu de tranzacționare a început.\`, 'info', this.state.initialBalance);
           
           const telegramMsg = \`🛡️ 🔄 **[EQUITY TRAILING: PROFIT SECURIZAT & REPORNIRE AUTOMATĂ]**\\n\\n\` +
             \`Sistemul a securizat profitul după atingerea pragului (+\${profitThresholdPct}%).\\n\\n\` +
             \`• **Vârf atins (HWM):** \${oldHwm.toFixed(2)} USDT\\n\` +
             \`• **Balanță NOUĂ (Securizată):** \${this.state.initialBalance.toFixed(2)} USDT\\n\\n\` +
             \`✅ Toate pozițiile au fost închise cu succes.\\n\` +
             \`🤖 **Auto-Trading continuă automat** cu noul capital de start de \${this.state.initialBalance.toFixed(2)} USDT.\`;
           this.sendNotification(telegramMsg);
           this.savePersistedState(true);
        });

        return true;
      }
`;

code = code.replace(target.trim(), replacement.trim());
fs.writeFileSync('server/bot.ts', code);
