const fs = require('fs');
let code = fs.readFileSync('src/components/MomentumPaperView.tsx', 'utf8');

const regex = /\{\/\* Hard Stop Trigger Banners \*\/\}[\s\S]*?\{\/\* MOTOR DE REGLAJ PARAMETRI/;

code = code.replace(regex, `{/* MOTOR DE REGLAJ PARAMETRI`);

fs.writeFileSync('src/components/MomentumPaperView.tsx', code);
console.log('Removed banners and metrics');
