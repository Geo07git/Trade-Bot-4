const fs = require('fs');
let content = fs.readFileSync('server/bot.ts', 'utf8');

const target1 = `        // HARD SANITATION: Fix balance and equity issues right after positions are loaded
        const marginSum = this.state.positions.reduce((acc, pos) => acc + (pos.margin || 0), 0);
        if (marginSum > 0 && Math.abs(this.state.balance - (this.state.initialBalance || 0)) < 10) {
          this.state.balance = Math.max(0, this.state.balance - marginSum);
          logger.info(\`[SANITATION] Deducted missing margin (\${marginSum}) from balance. New balance: \${this.state.balance}\`);
        }`;

if (content.includes(target1)) {
  content = content.replace(target1, '');
  fs.writeFileSync('server/bot.ts', content);
  console.log('Reverted hard sanitation');
}
