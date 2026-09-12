const fs = require('fs');
let content = fs.readFileSync('server/bot.ts', 'utf8');

content = content.replace('config.highWaterMark = initial;', 'config.highWaterMark = initBal;');

fs.writeFileSync('server/bot.ts', content);
console.log('Fixed initial to initBal in bot.ts');
