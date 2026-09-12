const fs = require('fs');
let content = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');

content = content.replace(/    accumulationBalance = 0,\n/g, '');
content = content.replace(/    sessionCycleCount = 1\n/g, '');

const regexVault = /<div className="pt-1\.5 border-t border-white\/5 flex items-center justify-between text-\[10px\]">\s*<span className="text-amber-400\/90 font-medium">Vault:<\/span>\s*<span className="text-amber-300 font-bold">\s*\$\{accumulationBalance\.toFixed\(2\)\} USDT <span className="text-\[9px\] text-zinc-500">\(\#\{sessionCycleCount\}\)<\/span>\s*<\/span>\s*<\/div>\n/g;
content = content.replace(regexVault, '');

fs.writeFileSync('src/components/Sidebar.tsx', content);
