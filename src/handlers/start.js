const { sendMenu } = require('./menu');

function register(bot) {
    bot.command('start', async (ctx) => {
        ctx.session = {};
        await sendMenu(ctx);
    });
}

module.exports = { register };
