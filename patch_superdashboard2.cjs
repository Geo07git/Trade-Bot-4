const fs = require('fs');
let content = fs.readFileSync('src/components/SuperDashboard.tsx', 'utf8');

const regexVaultCard = /        \{\/\* Sold Acumulare \(Vault Profit Conservat\) \*\/\}\n[\s\S]*?<\/button>\n            \)\}\n          <\/div>\n        <\/div>\n/g;
content = content.replace(regexVaultCard, '');

content = content.replace(/    accumulationBalance = 0,\n/g, '');
content = content.replace(/    sessionCycleCount = 1,\n/g, '');
content = content.replace(/    accumulationTargetPercent = 3\.0,\n/g, '');
content = content.replace(/    consolidateAccumulation,\n/g, '');
content = content.replace(/    resetAccumulationVault,\n/g, '');

fs.writeFileSync('src/components/SuperDashboard.tsx', content);
