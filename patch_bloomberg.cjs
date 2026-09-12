const fs = require('fs');
let content = fs.readFileSync('src/components/BloombergTerminal.tsx', 'utf8');

const regexECPBlock = /                <div className="bg-zinc-950 p-2 sm:p-3 border-b border-zinc-800">[\s\S]*?Net Worth Total<\/span>\n                <span className="text-cyan-400 font-bold">\$\{\(equity \+ \(protectedPiggyBank \|\| 0\)\)\.toFixed\(2\)\}<\/span>\n              <\/div>\n            <\/div>\n          <\/div>/g;
content = content.replace(regexECPBlock, '');

content = content.replace(/    protectedPiggyBank,\n/g, '');

fs.writeFileSync('src/components/BloombergTerminal.tsx', content);
