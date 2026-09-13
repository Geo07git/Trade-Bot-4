const fs = require('fs');
let code = fs.readFileSync('src/components/MomentumPaperView.tsx', 'utf8');

// 1. Remove the Top Badge:
const badgeTarget = `{isHardStopDrawdown || isHardStopProfit ? (
                <span className={cn(
                  "px-2.5 py-0.5 rounded-full text-xs font-mono font-bold border",
                  isHardStopDrawdown 
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/50" 
                    : "bg-emerald-500/20 text-emerald-300 border-emerald-500/50"
                )}>
                  {isHardStopDrawdown ? "🛑 HARD STOP (-50%)" : "🏆 TARGET PROFIT (+100%)"}
                </span>
              ) : (`;

const badgeEndStr = `                </span>
              )}`;

let idx1 = code.indexOf(`{isHardStopDrawdown || isHardStopProfit ? (`);
if (idx1 !== -1) {
    let idx2 = code.indexOf(`</span>\n              )}`, idx1);
    if (idx2 !== -1) {
        code = code.substring(0, idx1) + code.substring(idx2 + `</span>\n              )}`.length);
    }
}

// 2. Remove the paragraph mentioning "exact balance accounting, deducted fees and Hard Stop protection (-50% / +100%)"
const paraRegex = /<p className="text-xs text-zinc-400 mt-0\.5">[\s\S]*?<\/p>/;
code = code.replace(paraRegex, `<p className="text-xs text-zinc-400 mt-0.5">
              {language === 'ro'
                ? 'Scanare automată de momentum și breakout cu execuție în modul global.'
                : 'Automated momentum and breakout scanning feeding the global execution module.'}
            </p>`);

// 3. Remove "Reset Global Capital" button
const btnRegex = /<button\s*onClick=\{handleReset\}[\s\S]*?<\/button>/;
code = code.replace(btnRegex, '');

// 4. Remove Hard Stop Banners & Metrics Grid
// They start with {/* Hard Stop Trigger Banners */}
// and end with {/* Main Paper Trading Area: Table & Logs */}
const metricsStart = `{/* Hard Stop Trigger Banners */}`;
const metricsEnd = `{/* Main Paper Trading Area: Table & Logs */}`;

idx1 = code.indexOf(metricsStart);
let idx2 = code.indexOf(metricsEnd);

if (idx1 !== -1 && idx2 !== -1) {
    code = code.substring(0, idx1) + code.substring(idx2);
}

fs.writeFileSync('src/components/MomentumPaperView.tsx', code);
console.log('Fixed Momentum Paper View');
