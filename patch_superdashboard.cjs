const fs = require('fs');
let content = fs.readFileSync('src/components/SuperDashboard.tsx', 'utf8');

content = content.replace(/    accumulationBalance = 0,\n/g, '');
content = content.replace(/    sessionCycleCount = 1,\n/g, '');
content = content.replace(/    accumulationTargetPercent = 3\.0,\n/g, '');
content = content.replace(/    consolidateAccumulation,\n/g, '');
content = content.replace(/    resetAccumulationVault,\n/g, '');

const regexVaultCard = /        \{\/\* Vault Acumulare \*\/\}\n        <div className="bg-zinc-950\/80 border border-white\/10 rounded-xl p-3 shadow-lg flex flex-col justify-between">[\s\S]*?<\/button>\n            \)\}\n          <\/div>\n        <\/div>\n/g;
content = content.replace(regexVaultCard, '');

fs.writeFileSync('src/components/SuperDashboard.tsx', content);
