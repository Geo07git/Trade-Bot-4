const fs = require('fs');
let content = fs.readFileSync('src/components/BloombergTerminal.tsx', 'utf8');

const regex = /const eq = balance \|\| 250;/;
if (regex.test(content)) {
  content = content.replace(regex, 'const eq = equity;');
  fs.writeFileSync('src/components/BloombergTerminal.tsx', content);
  console.log('Fixed eq to use total equity');
}
