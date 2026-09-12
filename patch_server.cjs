const fs = require('fs');
let content = fs.readFileSync('server.ts', 'utf8');

const regexEndpoints = /  app\.post\('\/api\/bot\/consolidate-accumulation', requireAdminAuth, \(req, res\) => \{[\s\S]*?\}\);\n\n  app\.post\('\/api\/bot\/reset-accumulation', requireAdminAuth, \(req, res\) => \{[\s\S]*?\}\);\n/g;
content = content.replace(regexEndpoints, '');

const regexReset = /  app\.post\('\/api\/bot\/reset-accumulation', requireAdminAuth, \(req, res\) => \{[\s\S]*?\}\);\n/g;
content = content.replace(regexReset, '');

fs.writeFileSync('server.ts', content);
