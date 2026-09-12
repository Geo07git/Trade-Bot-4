const fs = require('fs');
let content = fs.readFileSync('src/types.ts', 'utf8');

const target = `export interface EquityProtectionConfig {
  enabled: boolean;
  profitThresholdPct: number; // e.g. 0.6%
  drawdownProtectionPct: number; // e.g. 0.2%
}`;

const replacement = `export interface EquityProtectionConfig {
  enabled: boolean;
  trailingDistancePct: number; // e.g. 0.40%
  highWaterMark?: number;
  isLocked?: boolean;
}`;

if (content.includes(target)) {
  content = content.replace(target, replacement);
  fs.writeFileSync('src/types.ts', content);
  console.log('Successfully updated types.ts');
} else {
  console.log('Target not found in types.ts');
}
