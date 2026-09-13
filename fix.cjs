const fs = require('fs');

// 1. Fix server.ts startup sync bug
let serverCode = fs.readFileSync('server.ts', 'utf8');
const serverTarget = `
    if (openPaperPositions.length > 0) {
      console.log(\`[Startup Sync] Sincronizare portofoliu: \${openPaperPositions.length} poziții deschise în Momentum Simulator. Balanță numerar: $\${paperState.paperBalanceUSDT} USDT.\`);
      botEngine.state.balance = paperState.paperBalanceUSDT;
      botEngine.state.initialBalance = paperState.startingBalanceUSDT || 1000;
      botEngine.savePersistedState(true);
    }
`;
const serverReplacement = `
    if (openPaperPositions.length > 0) {
      console.log(\`[Startup Sync] Sincronizare portofoliu: \${openPaperPositions.length} poziții deschise în Momentum Simulator. Equity total unificat: $\${botEngine.calculateEquity()} USDT.\`);
    }
`;
if (serverCode.includes('botEngine.state.balance = paperState.paperBalanceUSDT;')) {
    serverCode = serverCode.replace(serverTarget.trim(), serverReplacement.trim());
    fs.writeFileSync('server.ts', serverCode);
    console.log('server.ts patched');
}

// 2. Fix bot.ts locking logic for Equity Trailing Restart
let botCode = fs.readFileSync('server/bot.ts', 'utf8');
const botTarget = `
      if (isArmed && equity < protectionThreshold && !config.isLocked && this.state.autoTradingActive) {
        // We do NOT lock or stop auto-trading. We restart a new cycle immediately.
        const oldHwm = config.highWaterMark;
        config.highWaterMark = equity; // Temporarily reset to avoid re-triggering while selling
`;
const botReplacement = `
      if (isArmed && equity < protectionThreshold && !config.isLocked && this.state.autoTradingActive) {
        // We do NOT lock or stop auto-trading. We restart a new cycle immediately.
        config.isLocked = true; // Lock execution during the restart process
        const oldHwm = config.highWaterMark;
        config.highWaterMark = equity; // Temporarily reset to avoid re-triggering while selling
`;
if (botCode.includes(botTarget.trim())) {
    botCode = botCode.replace(botTarget.trim(), botReplacement.trim());
}

const botTarget2 = `
           if (this.state.equityProtectionConfig) {
               this.state.equityProtectionConfig.highWaterMark = this.state.initialBalance;
           }
           this.addLog(\`🔄 [REPORNIRE AUTOMATĂ] Capital re-ancorat la \${this.state.initialBalance.toFixed(2)} USDT. Noul ciclu de tranzacționare a început.\`, 'info', this.state.initialBalance);
`;
const botReplacement2 = `
           if (this.state.equityProtectionConfig) {
               this.state.equityProtectionConfig.highWaterMark = this.state.initialBalance;
               this.state.equityProtectionConfig.isLocked = false; // Unlock for the new cycle
           }
           this.addLog(\`🔄 [REPORNIRE AUTOMATĂ] Capital re-ancorat la \${this.state.initialBalance.toFixed(2)} USDT. Noul ciclu de tranzacționare a început.\`, 'info', this.state.initialBalance);
`;
if (botCode.includes(botTarget2.trim())) {
    botCode = botCode.replace(botTarget2.trim(), botReplacement2.trim());
    fs.writeFileSync('server/bot.ts', botCode);
    console.log('bot.ts patched');
}
