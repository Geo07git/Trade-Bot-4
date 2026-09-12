const fs = require('fs');
let content = fs.readFileSync('src/components/BloombergTerminal.tsx', 'utf8');

const regexECPBlock = /          \{\/\* EQUITY MONITOR \/ PUSCULITA CARD \*\/\}\n[\s\S]*?          \{\/\* MAIN MATRIX \/ BLOTTER TABLE \*\/\}/g;
content = content.replace(regexECPBlock, '          {/* MAIN MATRIX / BLOTTER TABLE */}');

fs.writeFileSync('src/components/BloombergTerminal.tsx', content);
