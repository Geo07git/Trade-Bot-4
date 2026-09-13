const fs = require('fs');
let code = fs.readFileSync('src/components/BloombergTerminal.tsx', 'utf8');

const startTag = `<div className="flex items-center gap-1.5 shrink-0 overflow-x-auto text-[10px]">`;
const endTag = `      {/* 2. REAL-TIME TICKER TAPE (INFINITE SCROLL) */}`;

const idx1 = code.indexOf(startTag);
const idx2 = code.indexOf(endTag, idx1);

if (idx1 !== -1 && idx2 !== -1) {
    code = code.substring(0, idx1) + code.substring(idx2);
    fs.writeFileSync('src/components/BloombergTerminal.tsx', code);
    console.log("Removed shortcut bar from BloombergTerminal.");
} else {
    console.log("Could not find boundaries.");
}
