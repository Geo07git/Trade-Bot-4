const fs = require('fs');
let code = fs.readFileSync('src/components/BloombergTerminal.tsx', 'utf8');

// replace local activeTab state with zustand
const target1 = `  const [activeTab, setActiveTab] = useState<'matrix' | 'blotter' | 'intelligence' | 'audit'>('matrix');`;
const replacement1 = `  const { terminalActiveTab: activeTab, setTerminalActiveTab: setActiveTab } = useTradingStore();`;
code = code.replace(target1, replacement1);

// We also need to remove the top bar from BloombergTerminal
// The top bar starts at <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto text-[10px]">
// And ends at {/* Language Toggle */}

const topBarRegex = /<div className="flex items-center gap-1\.5 shrink-0 overflow-x-auto text-\[10px\]">([\s\S]*?){\/\* Language Toggle \*\/}/;
// Wait, we still need the language toggle to stay, or we can move it to ShortcutBar too. 
// Let's remove the entire Shortcut Bar from BloombergTerminal.tsx.
const startTag = `<div className="flex items-center gap-1.5 shrink-0 overflow-x-auto text-[10px]">`;
const endStr = `        </div>
      </div>

      <div className="flex-1 overflow-hidden relative">`;

const idx1 = code.indexOf(startTag);
const idx2 = code.indexOf(endStr, idx1);

if (idx1 !== -1 && idx2 !== -1) {
    code = code.substring(0, idx1) + code.substring(idx2);
} else {
    console.log("Could not find the shortcut bar in BloombergTerminal to remove");
}

fs.writeFileSync('src/components/BloombergTerminal.tsx', code);
console.log('BloombergTerminal.tsx patched');
