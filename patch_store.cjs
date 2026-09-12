const fs = require('fs');
let content = fs.readFileSync('src/store.ts', 'utf8');

const target = `  equityProtectionConfig: {
    enabled: true,
    profitThresholdPct: 0.8,
    drawdownProtectionPct: 0.1
  },`;

const replacement = `  equityProtectionConfig: {
    enabled: true,
    trailingDistancePct: 0.40,
    highWaterMark: 0,
    isLocked: false
  },`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync('src/store.ts', content);
  console.log('Successfully patched store.ts');
} else {
  console.log('Target not found in store.ts');
}
