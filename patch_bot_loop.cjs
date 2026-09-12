const fs = require('fs');
let content = fs.readFileSync('server/bot.ts', 'utf8');

const regex = /this\.intervalTimer\s*=\s*setInterval\s*\(\s*async\s*\(\)\s*=>\s*\{([\s\S]*?)(try\s*\{)/;

if (regex.test(content)) {
  content = content.replace(regex, 'this.intervalTimer = setInterval(async () => {$1$2\n        this.checkCircuitBreaker();');
  fs.writeFileSync('server/bot.ts', content);
  console.log('Successfully patched intervalTimer via regex');
} else {
  console.log('Regex did not match');
}
