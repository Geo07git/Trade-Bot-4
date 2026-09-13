const bot = require('./server/bot.js'); // Assuming compiled path or use require for the bot engine
// Actually I need to access the botEngine instance, but it's likely a singleton in the bundled server
// Since I can't easily import the running instance, I will add a log to botEngine in server/bot.ts
