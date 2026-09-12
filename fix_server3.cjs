const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

// Replace duplicate `});` followed by `});` 
content = content.replace(/  \}\);\n  \}\);\n/g, '  });\n');

fs.writeFileSync('server.ts', content);
