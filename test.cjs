const fs = require('fs');
console.log(fs.readFileSync('server/bot.ts', 'utf8').includes('public checkCircuitBreaker(): boolean {'));
