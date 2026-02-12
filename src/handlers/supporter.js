const { Markup } = require("telegraf");
const {
  CITIES,
  CITY_EMOJI,
  PAGE_SIZE,
  MAX_PENDING_FUNDINGS,
  RLM,
  cityLabel,
  currencyLabel,
  contactLink,
} = require("../config");
const db = require("../database");

const parsePersianNum = (text) =>
  text.replace(/[۰-۹]/g, (c) => c.charCodeAt(0) - 0x06f0);

function remaining(t) {
  return Math.max(
    Number(t.amount_needed) -
      Number(t.funded_amount) -
      Number(t.pending_amount),
    0,
  );
}
const LRM = "\u200E";
function buildTravelerListEntry(t) {
  const emoji = CITY_EMOJI[t.protest_city] || "🌍";
  const rem = remaining(t);

  return (
    `${RLM} \`[ID: ${t.id}]\` ${t.city} به ${cityLabel(t.protest_city)}${emoji}\n` +
    `${RLM}   ${LRM}👥${LRM} ${t.num_travelers} نفر - ${LRM}💰${LRM} ${rem} ${currencyLabel(t.currency)}`
  );
}

function buildTravelerDetail(t) {
  const emoji = CITY_EMOJI[t.protest_city] || "🌍";
  const rem = remaining(t);
  const funded = Number(t.funded_amount);
  const pending = Number(t.pending_amount);
  const needed = Number(t.amount_needed);
  const cur = currencyLabel(t.currency);

  return (
    `📋 *مشخصات مسافر #${t.id}*\n\n` +
    `${RLM}🏙️ تظاهرات: ${emoji} ${cityLabel(t.protest_city)}\n` +
    `${RLM}📍 مبدأ: ${t.city}\n` +
    `${RLM}👥 تعداد مسافران: ${t.num_travelers} نفر\n` +
    `${RLM}💰 مبلغ مورد نیاز: ${needed} ${cur}\n` +
    `${RLM}✅ تأمین شده: ${funded} ${cur}\n` +
    `${RLM}⏳ در انتظار تأیید: ${pending} ${cur}\n` +
    `${RLM}📊 باقیمانده: ${rem} ${cur}\n` +
    `📝 پیام: ${t.message}`
  );
}

async function showTravelerList(ctx, city, page) {
  const offset = page * PAGE_SIZE;
  const { rows, total } = await db.getTravelersPaginated(
    city,
    PAGE_SIZE,
    offset,
  );
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  if (rows.length === 0) {
    const text =
      city && city !== "all"
        ? `مسافری برای ${CITY_EMOJI[city] || ""} ${cityLabel(city)} یافت نشد.`
        : "مسافری یافت نشد.";
    return ctx.reply(
      text,
      Markup.inlineKeyboard([
        [Markup.button.callback("🔙 منوی اصلی", "main_menu")],
      ]),
    );
  }

  let text = "📋 *لیست مسافران*\n";
  text += "مسافران بر اساس مبلغ باقیمانده مرتب شده‌اند. شناسه مسافر را وارد کنید تا جزئیات را ببینید و بتوانید کمک کنید.\n\n";
  for (const t of rows) {
    text += buildTravelerListEntry(t) + "\n\n";
  }
  text += `صفحه ${page + 1} از ${totalPages}`;

  // City filter buttons
  const filterRow = CITIES.map((c) => {
    const active = city === c;
    const label = `${active ? "✓ " : ""}${CITY_EMOJI[c]}`;
    return Markup.button.callback(label, `sfilter_${c}_0`);
  });
  filterRow.push(
    Markup.button.callback(city === "all" ? "✓ همه" : "همه", "sfilter_all_0"),
  );

  // Pagination buttons
  const navRow = [];
  if (page > 0) {
    navRow.push(
      Markup.button.callback("⬅️ قبلی", `sfilter_${city}_${page - 1}`),
    );
  }
  if (page < totalPages - 1) {
    navRow.push(
      Markup.button.callback("بعدی ➡️", `sfilter_${city}_${page + 1}`),
    );
  }

  const buttons = [filterRow];
  if (navRow.length > 0) buttons.push(navRow);
  buttons.push([Markup.button.callback("🔙 منوی اصلی", "main_menu")]);

  text += "\n\nشناسه مسافر (عدد داخل براکت) را وارد کنید:";

  return ctx.reply(text, {
    parse_mode: "Markdown",
    ...Markup.inlineKeyboard(buttons),
  });
}

function register(bot) {
  // ── Entry point ──
  bot.action("role_supporter", async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session ??= {};

    ctx.session.step = "pick_traveler";
    ctx.session.supporterCity = "all";
    ctx.session.supporterPage = 0;
    await showTravelerList(ctx, "all", 0);
  });

  // ── City filter + pagination ──
  bot.action(/^sfilter_(.+)_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session ??= {};
    const city = ctx.match[1];
    const page = parseInt(ctx.match[2], 10);
    ctx.session.supporterCity = city;
    ctx.session.supporterPage = page;
    ctx.session.step = "pick_traveler";
    await showTravelerList(ctx, city, page);
  });

  // ── Full amount shortcut ──
  bot.action(/^full_amount_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session ??= {};
    const travelerId = parseInt(ctx.match[1], 10);
    const traveler = await db.getTravelerById(travelerId);
    if (!traveler) {
      return ctx.reply(
        "مسافر یافت نشد.",
        Markup.inlineKeyboard([
          [Markup.button.callback("🔙 منوی اصلی", "main_menu")],
        ]),
      );
    }

    const rem = remaining(traveler);
    if (rem <= 0) {
      return ctx.reply(
        "این مسافر نیاز مالی باقیمانده‌ای ندارد.",
        Markup.inlineKeyboard([
          [Markup.button.callback("🔙 منوی اصلی", "main_menu")],
        ]),
      );
    }

    ctx.session.selectedTraveler = travelerId;
    // Process as if they entered the amount
    await processAmount(ctx, rem, traveler);
  });

  // ── Soft validation proceed ──
  bot.action(/^proceed_fund_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session ??= {};
    ctx.session.selectedTraveler = parseInt(ctx.match[1], 10);
    ctx.session.step = "fund_amount";
    const traveler = await db.getTravelerById(ctx.session.selectedTraveler);
    if (!traveler)
      return ctx.reply(
        "مسافر یافت نشد.",
        Markup.inlineKeyboard([
          [Markup.button.callback("🔙 منوی اصلی", "main_menu")],
        ]),
      );

    const rem = remaining(traveler);
    const buttons = [];
    if (rem > 0) {
      buttons.push([
        Markup.button.callback(
          `💰 کل مبلغ باقیمانده (${rem})`,
          `full_amount_${traveler.id}`,
        ),
      ]);
    }
    await ctx.reply(
      `چقدر می‌خواهید کمک کنید؟ (${currencyLabel(traveler.currency)})`,
      buttons.length > 0 ? Markup.inlineKeyboard(buttons) : undefined,
    );
  });

  bot.action(/^cancel_pick$/, async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session ??= {};
    ctx.session.step = "pick_traveler";
    const city = ctx.session.supporterCity || "all";
    const page = ctx.session.supporterPage || 0;
    await showTravelerList(ctx, city, page);
  });

  // ── Text input: pick_traveler and fund_amount ──
  bot.on("text", async (ctx, next) => {
    ctx.session ??= {};
    const step = ctx.session.step;

    if (step === "pick_traveler") {
      const raw = parsePersianNum(ctx.message.text.trim());
      const id = parseInt(raw, 10);
      if (isNaN(id) || id <= 0) {
        return ctx.reply("لطفاً شناسه معتبر وارد کنید:");
      }

      const traveler = await db.getTravelerById(id);
      if (!traveler) {
        return ctx.reply(
          "مسافر با این شناسه یافت نشد. لطفاً دوباره تلاش کنید:",
        );
      }

      if (Number(traveler.telegram_id) === ctx.from.id) {
        return ctx.reply(
          "شما نمی‌توانید از سفر خودتان حمایت کنید.",
          Markup.inlineKeyboard([
            [Markup.button.callback("🔙 بازگشت به لیست", "cancel_pick")],
          ]),
        );
      }

      ctx.session.selectedTraveler = id;
      const detail = buildTravelerDetail(traveler);
      const rem = remaining(traveler);

      if (rem <= 0) {
        // Soft validation: warn but allow
        await ctx.reply(
          detail + "\n\n⚠️ *این مسافر پوشش مالی کافی دارد.* آیا ادامه می‌دهید؟",
          {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard([
              [Markup.button.callback("✅ بله، ادامه", `proceed_fund_${id}`)],
              [Markup.button.callback("🔙 بازگشت به لیست", "cancel_pick")],
            ]),
          },
        );
        return;
      }

      ctx.session.step = "fund_amount";
      const buttons = [
        [
          Markup.button.callback(
            `💰 کل مبلغ باقیمانده (${rem})`,
            `full_amount_${traveler.id}`,
          ),
        ],
      ];
      await ctx.reply(
        detail +
          `\n\nچقدر می‌خواهید کمک کنید؟ (${currencyLabel(traveler.currency)})`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard(buttons),
        },
      );
      return;
    }

    if (step === "fund_amount") {
      const traveler = await db.getTravelerById(ctx.session.selectedTraveler);
      if (!traveler) {
        ctx.session.step = null;
        return ctx.reply(
          "مسافر یافت نشد. لطفاً دوباره شروع کنید.",
          Markup.inlineKeyboard([
            [Markup.button.callback("🔙 منوی اصلی", "main_menu")],
          ]),
        );
      }

      const raw = parsePersianNum(ctx.message.text.trim());
      const amount = Number(raw);
      if (isNaN(amount) || amount <= 0) {
        return ctx.reply("لطفاً یک مبلغ معتبر وارد کنید:");
      }

      await processAmount(ctx, amount, traveler);
      return;
    }

    return next();
  });
}

async function processAmount(ctx, amount, traveler) {
  // Check pending count (soft)
  const pendingCount = await db.countPendingBySupporter(ctx.from.id);
  if (pendingCount >= MAX_PENDING_FUNDINGS) {
    await ctx.reply(
      `⚠️ شما ${pendingCount} حمایت فعال دارید (حداکثر ${MAX_PENDING_FUNDINGS}). لطفاً ابتدا حمایت‌های قبلی را تأیید یا لغو کنید.`,
      Markup.inlineKeyboard([
        [Markup.button.callback("🔙 منوی اصلی", "main_menu")],
      ]),
    );
    ctx.session.step = null;
    return;
  }

  try {
    const supporterUsername = ctx.from.username ? `@${ctx.from.username}` : null;
    await db.insertFunding(
      traveler.id,
      ctx.from.id,
      supporterUsername,
      amount,
    );

    ctx.session.step = null;
    ctx.session.selectedTraveler = null;

    const cur = currencyLabel(traveler.currency);
    const emoji = CITY_EMOJI[traveler.protest_city] || "🌍";
    const travelerLink = contactLink('پیام به مسافر', traveler.telegram_id, traveler.telegram_username);
    const supporterLink = contactLink('پیام به حامی', ctx.from.id, supporterUsername);

    // Notification to supporter
    await ctx.reply(
      `✅ *حمایت شما ثبت شد!* (وضعیت: در انتظار تأیید)\n\n` +
        `${RLM}مسافر #${traveler.id} — ${emoji} ${cityLabel(traveler.protest_city)}\n` +
        `${RLM}مبلغ: ${amount} ${cur}\n\n` +
        `⚠️ *نکات مهم:*\n` +
        `• وجه را از طریق روش‌های امن ارسال کنید\n` +
        `• مشروعیت مسافر را بررسی کنید\n` +
        `• در صورت نیاز مدارک سفر یا بلیط بخواهید\n\n` +
        `${RLM}${travelerLink}\n\n` +
        `⏳ حمایت شما «در انتظار تأیید» است. با مسافر تماس بگیرید و پس از ارسال وجه، مسافر باید از منوی وضعیت خود دریافت را تأیید کند.\n` +
        `از منوی «📋 وضعیت حامی» می‌توانید حمایت‌های خود را پیگیری یا لغو کنید.`,
      {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("🔙 منوی اصلی", "main_menu")],
        ]),
      },
    );

    // Notification to traveler
    if (traveler.telegram_id) {
      try {
        await ctx.telegram.sendMessage(
          traveler.telegram_id,
          `🎉 *یک حامی می‌خواهد به شما کمک کند!*\n\n` +
            `${RLM}مبلغ: ${amount} ${cur}\n\n` +
            `⚠️ *نکات مهم:*\n` +
            `• مدارک مربوط به نیاز مالی خود را ارائه دهید\n` +
            `• به حامی اطمینان دهید که وجه مسئولانه استفاده می‌شود\n` +
            `• پس از سفر، مدرک استفاده از کمک مالی ارائه دهید\n\n` +
            `${RLM}${supporterLink}\n\n` +
            `پس از دریافت وجه، حتماً از منوی «📋 وضعیت مسافر» دکمه «تأیید» را بزنید تا حامی مطلع شود.`,
          {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard([
              [Markup.button.callback("📋 وضعیت مسافر", "status_traveler")],
              [Markup.button.callback("🔙 منوی اصلی", "main_menu")],
            ]),
          },
        );
      } catch (e) {
        console.error("Could not notify traveler:", e.message);
      }
    }
  } catch (error) {
    console.error("Error creating funding:", error);
    await ctx.reply(
      "خطایی رخ داد. لطفاً دوباره تلاش کنید.",
      Markup.inlineKeyboard([
        [Markup.button.callback("🔙 منوی اصلی", "main_menu")],
      ]),
    );
  }
}

module.exports = { register };
