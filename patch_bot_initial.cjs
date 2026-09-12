const fs = require('fs');
let content = fs.readFileSync('server/bot.ts', 'utf8');

content = content.replace('const initial = (this.state.initialBalance', 'const initBal = (this.state.initialBalance');
content = content.replace('if (!config.highWaterMark || config.highWaterMark < initial)', 'if (!config.highWaterMark || config.highWaterMark < initBal)');

fs.writeFileSync('server/bot.ts', content);
console.log('Fixed initial variable collision in bot.ts');
