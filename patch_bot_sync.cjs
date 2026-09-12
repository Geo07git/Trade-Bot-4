const fs = require('fs');
let content = fs.readFileSync('server/bot.ts', 'utf8');

const target = `        if (this.secondsCounter % 60 === 0) {
          this.checkAndSendReports();
        }`;

const replacement = `        if (this.secondsCounter % 60 === 0) {
          this.checkAndSendReports();
          if (this.state.binanceMode === 'live' || this.state.binanceMode === 'testnet') {
             this.syncBinanceBalance().catch(() => {});
          }
        }`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync('server/bot.ts', content);
  console.log('Patched heartbeat to include syncBinanceBalance');
} else {
  console.log('Failed to patch heartbeat sync');
}
