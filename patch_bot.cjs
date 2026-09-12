const fs = require('fs');
let content = fs.readFileSync('server/bot.ts', 'utf8');

// Properties in interface
content = content.replace(/  accumulationBalance\?: number;\n/g, '');
content = content.replace(/  accumulationTargetPercent\?: number;\n/g, '');
content = content.replace(/  sessionCycleCount\?: number;\n/g, '');
content = content.replace(/  accumulationTargetEnabled\?: boolean;\n/g, '');
content = content.replace(/  currentCyclePeakEquity\?: number;\n/g, '');
content = content.replace(/  cycleStartEquity\?: number;\n/g, '');
content = content.replace(/  isEquityProtectionActivated\?: boolean;\n/g, '');

// Initial states
content = content.replace(/      accumulationBalance: 0,\n/g, '');
content = content.replace(/      accumulationTargetPercent: 3\.0,\n/g, '');
content = content.replace(/      sessionCycleCount: 1,\n/g, '');
content = content.replace(/      accumulationTargetEnabled: true,\n/g, '');

// Sanitized
content = content.replace(/      accumulationBalance: this\.state\.accumulationBalance \|\| 0,\n/g, '');
content = content.replace(/      accumulationTargetPercent: this\.state\.accumulationTargetPercent \|\| 3\.0,\n/g, '');
content = content.replace(/      sessionCycleCount: this\.state\.sessionCycleCount \|\| 1,\n/g, '');
content = content.replace(/      accumulationTargetEnabled: this\.state\.accumulationTargetEnabled !== false,\n/g, '');

// Parser
content = content.replace(/          if \(parsed\.accumulationBalance !== undefined\) this\.state\.accumulationBalance = parsed\.accumulationBalance;\n/g, '');
content = content.replace(/          if \(parsed\.accumulationTargetPercent !== undefined\) this\.state\.accumulationTargetPercent = parsed\.accumulationTargetPercent;\n/g, '');
content = content.replace(/          if \(parsed\.sessionCycleCount !== undefined\) this\.state\.sessionCycleCount = parsed\.sessionCycleCount;\n/g, '');
content = content.replace(/          if \(parsed\.accumulationTargetEnabled !== undefined\) this\.state\.accumulationTargetEnabled = parsed\.accumulationTargetEnabled;\n/g, '');

// Reset
content = content.replace(/    this\.state\.accumulationBalance = 0;\n/g, '');
content = content.replace(/    this\.state\.sessionCycleCount = 1;\n/g, '');
content = content.replace(/Sold Acumulare resetat\./g, '');

// Logs / Strings
content = content.replace(/                `• 🏦 Sold "Acumulare": \$\{\(this\.state\.accumulationBalance \|\| 0\)\.toFixed\(2\)\} USDT\\n` \+\n/g, '');
content = content.replace(/                `• 🔄 Ciclu Curent: #\$\{this\.state\.sessionCycleCount\}\\n` \+\n/g, '');
const regexSummaryVault = /        const accumBal = \[\s\S\]*?DEZACTIVATĂ';\n/g;
content = content.replace(regexSummaryVault, '');
const regexSummaryVault2 = /                `• <b>Sold Acumulare:<\/b> \$\{accumBal\} USDT\\n` \+\n                `• <b>Ciclu:<\/b> #\$\{this\.state\.sessionCycleCount\}\\n` \+\n                `• <b>Țintă Profit Conservare:<\/b> \+\$\{target\}% \$\{enabled\}\\n` \+\n/g;
content = content.replace(regexSummaryVault2, '');

// checkCircuitBreaker accumulation rule
content = content.replace(/    \/\/ 1\. Check Accumulation Target \(\+3% cycle profit rule\)\n    this\.checkAccumulationTarget\(\);\n\n/g, '');

// updateConfig rules
const regexUpdateAccTgtPct = /    if \(newConfig\.accumulationTargetPercent !== undefined\) \{\n      this\.state\.accumulationTargetPercent = Math\.max\(0\.5, Math\.min\(50, Number\(newConfig\.accumulationTargetPercent\)\)\);\n    \}\n/g;
content = content.replace(regexUpdateAccTgtPct, '');

const regexUpdateAccTgtEn = /    if \(newConfig\.accumulationTargetEnabled !== undefined\) \{\n      this\.state\.accumulationTargetEnabled = Boolean\(newConfig\.accumulationTargetEnabled\);\n    \}\n/g;
content = content.replace(regexUpdateAccTgtEn, '');

const regexUpdateAccBal = /    if \(newConfig\.accumulationBalance !== undefined\) \{\n      this\.state\.accumulationBalance = Math\.max\(0, Number\(newConfig\.accumulationBalance\)\);\n    \}\n/g;
content = content.replace(regexUpdateAccBal, '');

const regexUpdateSessCycle = /    if \(newConfig\.sessionCycleCount !== undefined\) \{\n      this\.state\.sessionCycleCount = Math\.max\(1, Number\(newConfig\.sessionCycleCount\)\);\n    \}\n/g;
content = content.replace(regexUpdateSessCycle, '');

// Delete methods checkAccumulationTarget, consolidateAccumulation, resetAccumulationVault
const regexMethods = /  public checkAccumulationTarget\(\): boolean \{[\s\S]*?  public checkCircuitBreaker\(\): boolean \{/g;
content = content.replace(regexMethods, '  public checkCircuitBreaker(): boolean {');

fs.writeFileSync('server/bot.ts', content);
