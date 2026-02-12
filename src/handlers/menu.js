const { Markup } = require('telegraf');
const db = require('../database');
const { escMd } = require('../config');

function menuKeyboard() {
    return Markup.inlineKeyboard([
        [Markup.button.callback('🧳 من مسافر هستم', 'role_traveler')],
        [Markup.button.callback('💰 من حامی هستم', 'role_supporter')],
        [Markup.button.callback('📋 وضعیت مسافر', 'status_traveler'), Markup.button.callback('📋 وضعیت حامی', 'status_supporter')],
        [Markup.button.callback('⚙️ بررسی تنظیمات', 'check_settings')],
    ]);
}

const WELCOME_TEXT =
    '🦁☀️ *روز جهانی اقدام*\n' +
    '*در همبستگی با انقلاب شیر و خورشید در ایران*\n' +
    '📅 ۱۴ فوریه ۲۰۲۶\n\n' +
    '🇺🇸 لس‌آنجلس  •  🇨🇦 تورنتو  •  🇩🇪 مونیخ\n\n' +
    'این ربات مسافرانی که برای شرکت در تظاهرات نیاز به کمک مالی دارند را با حامیان مالی متصل می‌کند.\n\n' +
    '🧳 مسافر — برای سفر به تظاهرات نیاز به کمک مالی دارید\n' +
    '💰 حامی — می‌خواهید هزینه سفر کسی را تأمین کنید\n\n' +
    '💡 توصیه: برای ارتباط بهتر، نام‌کاربری تلگرام خود را تنظیم کنید.\n\n' +
    'نقش خود را انتخاب کنید:';

async function sendMenu(ctx) {
    await ctx.reply(WELCOME_TEXT, {
        parse_mode: 'Markdown',
        ...menuKeyboard(),
    });
}

function register(bot) {
    bot.action('main_menu', async (ctx) => {
        await ctx.answerCbQuery();
        await ctx.editMessageText(WELCOME_TEXT, {
            parse_mode: 'Markdown',
            ...menuKeyboard(),
        });
    });

    bot.action('check_settings', async (ctx) => {
        await ctx.answerCbQuery();
        const username = ctx.from.username ? `@${ctx.from.username}` : null;

        if (username) {
            // Update DB record if they are a traveler
            const traveler = await db.getTravelerByTelegramId(ctx.from.id);
            if (traveler && traveler.telegram_username !== username) {
                await db.getPool().query(
                    'UPDATE travelers SET telegram_username = $1 WHERE telegram_id = $2',
                    [username, ctx.from.id]
                );
            }

            await ctx.editMessageText(
                `✅ *تنظیمات شما:*\n\n` +
                `نام‌کاربری: ${escMd(username)}\n\n` +
                `نام‌کاربری شما به طرف مقابل نمایش داده می‌شود تا بتوانند مستقیماً با شما ارتباط بگیرند.`,
                {
                    parse_mode: 'Markdown',
                    ...Markup.inlineKeyboard([
                        [Markup.button.callback('🔄 بررسی مجدد', 'check_settings')],
                        [Markup.button.callback('🔙 منوی اصلی', 'main_menu')],
                    ]),
                },
            );
        } else {
            await ctx.editMessageText(
                `⚠️ *نام‌کاربری تنظیم نشده است*\n\n` +
                `بدون نام‌کاربری، طرف مقابل فقط از طریق لینک مستقیم می‌تواند با شما ارتباط بگیرد.\n\n` +
                `*نحوه تنظیم:*\n` +
                `۱. به تنظیمات تلگرام بروید\n` +
                `۲. روی «نام‌کاربری» (Username) بزنید\n` +
                `۳. یک نام‌کاربری انتخاب کنید\n` +
                `۴. برگردید و دکمه «بررسی مجدد» را بزنید`,
                {
                    parse_mode: 'Markdown',
                    ...Markup.inlineKeyboard([
                        [Markup.button.callback('🔄 بررسی مجدد', 'check_settings')],
                        [Markup.button.callback('🔙 منوی اصلی', 'main_menu')],
                    ]),
                },
            );
        }
    });

    bot.command('menu', async (ctx) => {
        ctx.session = { ...ctx.session, step: null };
        await sendMenu(ctx);
    });
}

module.exports = { register, sendMenu, menuKeyboard, WELCOME_TEXT };
