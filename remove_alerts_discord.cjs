const fs = require('fs');

let alertsCode = fs.readFileSync('src/components/Alerts.tsx', 'utf8');

const target1 = `                  <label className="flex items-center gap-2 cursor-pointer group/chk">
                    <input type="checkbox" checked={reportConfig?.channels?.discord ?? true} onChange={(e) => setReportConfig({ channels: { ...reportConfig.channels, discord: e.target.checked } })} className="accent-indigo-500 w-4 h-4 rounded border-white/10 bg-black" />
                    <span className="text-sm text-zinc-300 group-hover/chk:text-white transition-colors">Discord Webhook</span>
                  </label>`;
alertsCode = alertsCode.replace(target1, '');
fs.writeFileSync('src/components/Alerts.tsx', alertsCode);
console.log('Removed Discord checkbox from Alerts.tsx');

