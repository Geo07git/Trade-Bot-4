const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(/  \}\);\n  \}\);\n/g, '  });\n');

fs.writeFileSync('server.ts', content);
