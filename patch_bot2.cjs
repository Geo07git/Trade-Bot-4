const fs = require('fs');
let content = fs.readFileSync('server/bot.ts', 'utf8');

content = content.replace(/                `• Ciclu Activ: #\$\{this\.state\.sessionCycleCount \|\| 1\}\\n` \+\n/g, '');

const regexAcumulare = /      case '\/acumulare':\n      case '\/vault': \{[\s\S]*?break;\n      \}\n/g;
content = content.replace(regexAcumulare, '');

fs.writeFileSync('server/bot.ts', content);
