const fs = require('fs');
let lines = fs.readFileSync('server/bot.ts', 'utf8').split('\n');

const startStr = '      if (isArmed && equity < protectionThreshold && !config.isLocked && this.state.autoTradingActive) {';
let startIdx = lines.findIndex(l => l.includes(startStr));
let endIdx = -1;
for (let i = startIdx + 1; i < lines.length; i++) {
    if (lines[i].includes('      }')) {
        endIdx = i;
        break;
    }
}

const replacement = `      if (isArmed && equity < protectionThreshold && !config.isLocked && this.state.autoTradingActive) {
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
      }`;

if (startIdx !== -1 && endIdx !== -1) {
    lines.splice(startIdx, endIdx - startIdx + 1, replacement);
    fs.writeFileSync('server/bot.ts', lines.join('\n'));
    console.log("Success");
} else {
    console.log("Could not find boundaries");
}
