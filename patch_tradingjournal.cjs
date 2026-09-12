const fs = require('fs');
let content = fs.readFileSync('src/components/TradingJournal.tsx', 'utf8');

const regexVaultCard = /        \{\/\* Card Vault: Sold "Acumulare" \(Profit Conservat 3%\) \*\/\}\n[\s\S]*?<\/button>\n          <\/div>\n        <\/div>\n/g;
content = content.replace(regexVaultCard, '');

content = content.replace(/    accumulationBalance = 0,\n/g, '');
content = content.replace(/    sessionCycleCount = 1,\n/g, '');
content = content.replace(/    consolidateAccumulation,\n/g, '');
content = content.replace(/    resetAccumulationVault\n/g, '');

fs.writeFileSync('src/components/TradingJournal.tsx', content);
