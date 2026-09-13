const fs = require('fs');
let code = fs.readFileSync('src/components/ShortcutBar.tsx', 'utf8');

const importTarget = `import { cn } from '../utils/cn';`;
const replacement = `function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(' ');
}`;

code = code.replace(importTarget, replacement);
fs.writeFileSync('src/components/ShortcutBar.tsx', code);
