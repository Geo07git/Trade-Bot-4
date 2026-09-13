const fs = require('fs');

let settingsCode = fs.readFileSync('src/components/Settings.tsx', 'utf8');

const discordCardStart = `          {/* Discord Webhook Card */}`;
const endStr = `          {/* Desktop Push Card */}`;

const idx1 = settingsCode.indexOf(discordCardStart);
const idx2 = settingsCode.indexOf(endStr, idx1);

if (idx1 !== -1 && idx2 !== -1) {
    settingsCode = settingsCode.substring(0, idx1) + settingsCode.substring(idx2);
    fs.writeFileSync('src/components/Settings.tsx', settingsCode);
    console.log('Removed Discord Card from Settings.tsx');
} else {
    console.log('Could not find Discord block in Settings.tsx');
}

let alertsCode = fs.readFileSync('src/components/Alerts.tsx', 'utf8');

const alertsTarget = `<span className="px-2 py-1 bg-indigo-500/20 border border-indigo-500/50 text-indigo-400 rounded text-[10px] font-bold tracking-wider">DISCORD</span>`;
alertsCode = alertsCode.replace(alertsTarget, '');
fs.writeFileSync('src/components/Alerts.tsx', alertsCode);

