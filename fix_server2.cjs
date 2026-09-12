const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

content = content.replace(/  \}\);\n  \}\);\n  app\.post\('\/api\/bot\/add-funds'/g, '  });\n  app.post(\'/api/bot/add-funds\'');
content = content.replace(/  \}\);\n  \}\);\n  app\.post\('\/api\/bot\/trade'/g, '  });\n  app.post(\'/api/bot/trade\'');

fs.writeFileSync('server.ts', content);
