const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

content = content.replace(/          if \(data.accumulationBalance !== undefined && data.accumulationBalance !== currentStore.accumulationBalance\) updates.accumulationBalance = data.accumulationBalance;\n/g, '');
content = content.replace(/          if \(data.accumulationTargetPercent !== undefined && data.accumulationTargetPercent !== currentStore.accumulationTargetPercent\) updates.accumulationTargetPercent = data.accumulationTargetPercent;\n/g, '');
content = content.replace(/          if \(data.sessionCycleCount !== undefined && data.sessionCycleCount !== currentStore.sessionCycleCount\) updates.sessionCycleCount = data.sessionCycleCount;\n/g, '');
content = content.replace(/          if \(data.accumulationTargetEnabled !== undefined && data.accumulationTargetEnabled !== currentStore.accumulationTargetEnabled\) updates.accumulationTargetEnabled = data.accumulationTargetEnabled;\n/g, '');

fs.writeFileSync('src/App.tsx', content);
