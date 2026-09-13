const fs = require('fs');
let code = fs.readFileSync('src/components/MomentumPaperView.tsx', 'utf8');

const target = /\{state\.hardStopTriggered && \([\s\S]*?<\/span>\s*\)\}/;
code = code.replace(target, '');

fs.writeFileSync('src/components/MomentumPaperView.tsx', code);
console.log('Fixed momentum badge');
