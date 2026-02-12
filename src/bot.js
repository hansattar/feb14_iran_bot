const { Telegraf, session } = require('telegraf');
const db = require('./database');
const startHandler = require('./handlers/start');
const travelerHandler = require('./handlers/traveler');
const supporterHandler = require('./handlers/supporter');
const menuHandler = require('./handlers/menu');
const statusHandler = require('./handlers/status');

function createBot(token) {
    const bot = new Telegraf(token);

    // Session middleware (in-memory, swap for Redis in production)
    bot.use(session());

    // Register all handlers (order matters — text middleware handlers must come last)
    menuHandler.register(bot);
    startHandler.register(bot);
    statusHandler.register(bot);
    supporterHandler.register(bot);
    travelerHandler.register(bot);

    return bot;
}

async function launch(bot) {
    await db.init();
    console.log('Database connected.');

    bot.launch();
    console.log('Bot is running...');

    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

module.exports = { createBot, launch };
