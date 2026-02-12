require('dotenv').config();
const db = require('./src/database');

const travelers = [
    // Los Angeles (USD)
    { telegramId: 100001, username: '@sara_tehran',     city: 'تهران، ایران',         protestCity: 'Los Angeles', numTravelers: 1, currency: 'USD', amount: 850, message: 'من دانشجوی ایرانی هستم و می‌خواهم در تظاهرات لس‌آنجلس شرکت کنم. بلیط هواپیما نیاز دارم.' },
    { telegramId: 100002, username: '@ali_vancouver',   city: 'ونکوور، کانادا',       protestCity: 'Los Angeles', numTravelers: 2, currency: 'USD', amount: 320, message: 'از ونکوور به لس‌آنجلس پرواز دارم. کمک مالی برای بلیط و اقامت.' },
    { telegramId: 100003, username: '@mina_sf',         city: 'سانفرانسیسکو، آمریکا', protestCity: 'Los Angeles', numTravelers: 1, currency: 'USD', amount: 75,  message: 'با ماشین از سانفرانسیسکو می‌آیم. فقط هزینه بنزین.' },
    { telegramId: 100004, username: '@reza_phoenix',    city: 'فینیکس، آمریکا',       protestCity: 'Los Angeles', numTravelers: 3, currency: 'USD', amount: 45,  message: 'با اتوبوس گری‌هاوند از فینیکس. بلیط رفت و برگشت.' },
    { telegramId: 100005, username: '@neda_sandiego',   city: 'سن‌دیگو، آمریکا',      protestCity: 'Los Angeles', numTravelers: 1, currency: 'USD', amount: 30,  message: 'فاصله کمی دارم. فقط هزینه قطار.' },

    // Toronto (CAD)
    { telegramId: 100006, username: '@dariush_london',  city: 'لندن، انگلستان',       protestCity: 'Toronto', numTravelers: 1, currency: 'GBP', amount: 600, message: 'از لندن به تورنتو پرواز می‌کنم. کمک برای بلیط هواپیما و هتل.' },
    { telegramId: 100007, username: '@shirin_montreal', city: 'مونترال، کانادا',      protestCity: 'Toronto', numTravelers: 2, currency: 'CAD', amount: 120, message: 'با قطار VIA Rail از مونترال. بلیط رفت و برگشت و غذا.' },
    { telegramId: 100008, username: '@kaveh_ottawa',    city: 'اتاوا، کانادا',        protestCity: 'Toronto', numTravelers: 1, currency: 'CAD', amount: 55,  message: 'با اتوبوس از اتاوا می‌آیم. فقط هزینه حمل‌ونقل.' },
    { telegramId: 100009, username: '@leila_detroit',   city: 'دیترویت، آمریکا',      protestCity: 'Toronto', numTravelers: 4, currency: 'USD', amount: 90,  message: 'از دیترویت با ماشین. هزینه عبور از مرز و بنزین.' },
    { telegramId: 100010, username: '@omid_calgary',    city: 'کلگری، کانادا',        protestCity: 'Toronto', numTravelers: 1, currency: 'CAD', amount: 450, message: 'پرواز داخلی از کلگری. بلیط و اقامت دو شب در تورنتو.' },

    // Munich (EUR)
    { telegramId: 100011, username: '@parsa_berlin',    city: 'برلین، آلمان',         protestCity: 'Munich', numTravelers: 2, currency: 'EUR', amount: 80,  message: 'با قطار ICE از برلین به مونیخ. بلیط رفت و برگشت.' },
    { telegramId: 100012, username: '@yasmin_paris',    city: 'پاریس، فرانسه',        protestCity: 'Munich', numTravelers: 1, currency: 'EUR', amount: 150, message: 'از پاریس با قطار TGV. بلیط و یک شب اقامت.' },
    { telegramId: 100013, username: '@arman_vienna',    city: 'وین، اتریش',           protestCity: 'Munich', numTravelers: 1, currency: 'EUR', amount: 35,  message: 'مونیخ خیلی نزدیک وین است. فقط هزینه اتوبوس.' },
    { telegramId: 100014, username: '@golnaz_istanbul', city: 'استانبول، ترکیه',      protestCity: 'Munich', numTravelers: 3, currency: 'EUR', amount: 280, message: 'از استانبول پرواز می‌کنم. بلیط هواپیما ارزان‌قیمت پیدا کردم.' },
    { telegramId: 100015, username: '@babak_zurich',    city: 'زوریخ، سوئیس',         protestCity: 'Munich', numTravelers: 1, currency: 'EUR', amount: 60,  message: 'با ماشین از زوریخ. فقط بنزین و عوارض اتوبان.' },
];

async function seed() {
    await db.init();
    console.log('Database initialized.');

    for (const t of travelers) {
        const id = await db.insertTraveler({
            telegramId: t.telegramId,
            telegramUsername: t.username,
            city: t.city,
            protestCity: t.protestCity,
            numTravelers: t.numTravelers,
            currency: t.currency,
            amount: t.amount,
            message: t.message,
        });
        console.log(`  ✓ #${id} — ${t.username} — ${t.city} → ${t.protestCity} — ${t.numTravelers} نفر — ${t.amount} ${t.currency}`);
    }

    console.log(`\nDone! Inserted ${travelers.length} travelers.`);
    process.exit(0);
}

seed().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
});
