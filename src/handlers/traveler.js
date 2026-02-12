const { Markup } = require("telegraf");
const {
  CITIES,
  CITY_EMOJI,
  CURRENCIES,
  RLM,
  cityLabel,
  currencyLabel,
} = require("../config");
const db = require("../database");

const parsePersianNum = (text) =>
  text.replace(/[۰-۹]/g, (c) => c.charCodeAt(0) - 0x06f0);

function confirmKeyboard(isEditing) {
  const editButtons = [
    [
      Markup.button.callback("✏️ شهر تظاهرات", "edit_protest_city"),
      Markup.button.callback("✏️ مبدأ", "edit_origin"),
    ],
    [
      Markup.button.callback("✏️ تعداد", "edit_num_travelers"),
      Markup.button.callback("✏️ واحد پول", "edit_currency"),
    ],
    [
      Markup.button.callback("✏️ مبلغ", "edit_amount"),
      Markup.button.callback("✏️ پیام", "edit_message"),
    ],
  ];
  if (isEditing) {
    editButtons.push([Markup.button.callback("✅ ذخیره تغییرات", "save_edit")]);
    editButtons.push([Markup.button.callback("🔙 بازگشت", "status_traveler")]);
  } else {
    editButtons.push([
      Markup.button.callback("✅ تأیید و ثبت", "confirm_traveler"),
    ]);
  }
  return Markup.inlineKeyboard(editButtons);
}

function showConfirm(ctx) {
  const s = ctx.session;
  const isEditing = !!s.editingTraveler;
  const header = isEditing ? "✏️ *ویرایش اطلاعات:*" : "📋 *اطلاعات شما:*";
  const emoji = CITY_EMOJI[s.protestCity] || "🌍";
  const msg =
    header +
    "\n\n" +
    `${RLM}🏙️ تظاهرات: ${emoji} ${cityLabel(s.protestCity)}\n` +
    `${RLM}📍 مبدأ: ${s.city}\n` +
    `${RLM}👥 تعداد مسافران: ${s.numTravelers} نفر\n` +
    `${RLM}💰 مبلغ: ${s.amount} ${currencyLabel(s.currency)}\n` +
    `📝 پیام: ${s.message}`;
  return ctx.reply(msg, {
    parse_mode: "Markdown",
    ...confirmKeyboard(isEditing),
  });
}

// ── Step handlers ──

function askProtestCity(ctx) {
  const buttons = CITIES.map((c) =>
    Markup.button.callback(`${CITY_EMOJI[c]} ${cityLabel(c)}`, `city_${c}`),
  );
  return ctx.reply(
    "📍 *مرحله ۱ از ۶ — شهر تظاهرات*\n\nکدام شهر را برای شرکت در تظاهرات انتخاب می‌کنید؟",
    { parse_mode: "Markdown", ...Markup.inlineKeyboard([buttons]) },
  );
}

function askOrigin(ctx) {
  return ctx.reply(
    "📍 *مرحله ۲ از ۶ — شهر مبدأ*\n\nاز کجا سفر می‌کنید؟ نام شهر و کشور خود را بنویسید:",
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("🔙 بازگشت", "back_to_step_1")],
      ]),
    },
  );
}

function askNumTravelers(ctx) {
  return ctx.reply(
    "📍 *مرحله ۳ از ۶ — تعداد مسافران*\n\nچند نفر با هم سفر می‌کنید؟ (مبلغ درخواستی باید کل گروه را پوشش دهد)",
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [1, 2, 3, 4].map((n) => Markup.button.callback(`${n}`, `numtrav_${n}`)),
        [Markup.button.callback("۵+", "numtrav_more")],
      ]),
    },
  );
}

function askCurrency(ctx) {
  const buttons = CURRENCIES.map((c) =>
    Markup.button.callback(c.label, `cur_${c.key}`),
  );
  return ctx.reply(
    "📍 *مرحله ۴ از ۶ — واحد پول*\n\nمبلغ مورد نیاز خود را با کدام ارز می‌خواهید اعلام کنید؟",
    { parse_mode: "Markdown", ...Markup.inlineKeyboard([buttons.slice(0, 2), buttons.slice(2)]) },
  );
}

function askAmount(ctx) {
  return ctx.reply(
    "📍 *مرحله ۵ از ۶ — مبلغ مورد نیاز*\n\nکل مبلغی که برای سفر نیاز دارید را وارد کنید (بلیط، اقامت، غذا و ...):",
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("🔙 بازگشت", "back_to_step_4")],
      ]),
    },
  );
}

function askMessage(ctx) {
  return ctx.reply(
    "📍 *مرحله ۶ از ۶ — پیام به حامیان*\n\nاین پیام را حامیان مالی می‌بینند. برنامه سفر و نحوه استفاده از کمک مالی را توضیح دهید:",
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("🔙 بازگشت", "back_to_step_5")],
      ]),
    },
  );
}

function register(bot) {
  // ── Entry point ──
  bot.action("role_traveler", async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session ??= {};

    const existing = await db.getTravelerByTelegramId(ctx.from.id);
    if (existing) {
      await ctx.editMessageText(
        "شما قبلاً ثبت‌نام کرده‌اید. برای مشاهده یا ویرایش اطلاعات، از «وضعیت مسافر» استفاده کنید.",
        Markup.inlineKeyboard([
          [Markup.button.callback("🔙 منوی اصلی", "main_menu")],
        ]),
      );
      return;
    }

    ctx.session.step = "protest_city";
    ctx.session.editing = null;
    await askProtestCity(ctx);
  });

  // ── City selection ──
  bot.action(/^city_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session ??= {};
    const city = ctx.match[1];
    if (!CITIES.includes(city)) return;

    ctx.session.protestCity = city;

    if (ctx.session.editing === "protest_city") {
      ctx.session.editing = null;
      ctx.session.step = "confirm";
      return showConfirm(ctx);
    }

    ctx.session.step = "origin";
    await askOrigin(ctx);
  });

  // ── Num travelers selection ──
  bot.action(/^numtrav_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session ??= {};
    ctx.session.numTravelers = parseInt(ctx.match[1], 10);

    if (ctx.session.editing === "num_travelers") {
      ctx.session.editing = null;
      ctx.session.step = "confirm";
      return showConfirm(ctx);
    }

    ctx.session.step = "currency";
    await askCurrency(ctx);
  });

  bot.action("numtrav_more", async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session ??= {};
    ctx.session.step = "num_travelers_text";
    await ctx.reply("تعداد مسافران را وارد کنید:", Markup.inlineKeyboard([
      [Markup.button.callback("🔙 بازگشت", "back_to_step_3")],
    ]));
  });

  // ── Currency selection ──
  bot.action(/^cur_(.+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session ??= {};
    const key = ctx.match[1];
    if (!CURRENCIES.find((c) => c.key === key)) return;

    ctx.session.currency = key;

    if (ctx.session.editing === "currency") {
      ctx.session.editing = null;
      ctx.session.step = "confirm";
      return showConfirm(ctx);
    }

    ctx.session.step = "amount";
    await askAmount(ctx);
  });

  // ── Edit buttons from confirm screen ──
  bot.action("edit_protest_city", async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session ??= {};
    ctx.session.editing = "protest_city";
    ctx.session.step = "protest_city";
    await askProtestCity(ctx);
  });

  bot.action("edit_origin", async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session ??= {};
    ctx.session.editing = "origin";
    ctx.session.step = "origin";
    await askOrigin(ctx);
  });

  bot.action("edit_num_travelers", async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session ??= {};
    ctx.session.editing = "num_travelers";
    ctx.session.step = "num_travelers";
    await askNumTravelers(ctx);
  });

  bot.action("edit_currency", async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session ??= {};
    ctx.session.editing = "currency";
    ctx.session.step = "currency";
    await askCurrency(ctx);
  });

  bot.action("edit_amount", async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session ??= {};
    ctx.session.editing = "amount";
    ctx.session.step = "amount";
    await askAmount(ctx);
  });

  bot.action("edit_message", async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session ??= {};
    ctx.session.editing = "message";
    ctx.session.step = "message";
    await askMessage(ctx);
  });

  // ── Back buttons ──
  bot.action("back_to_step_1", async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session ??= {};
    ctx.session.step = "protest_city";
    await askProtestCity(ctx);
  });

  bot.action("back_to_step_3", async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session ??= {};
    ctx.session.step = "num_travelers";
    await askNumTravelers(ctx);
  });

  bot.action("back_to_step_4", async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session ??= {};
    ctx.session.step = "currency";
    await askCurrency(ctx);
  });

  bot.action("back_to_step_5", async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session ??= {};
    ctx.session.step = "amount";
    await askAmount(ctx);
  });

  // ── Confirm & save ──
  bot.action("confirm_traveler", async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session ??= {};
    const s = ctx.session;

    if (
      !s.protestCity ||
      !s.city ||
      !s.currency ||
      !s.amount ||
      !s.message ||
      !s.numTravelers
    ) {
      await ctx.reply(
        "اطلاعات ناقص است. لطفاً دوباره شروع کنید.",
        Markup.inlineKeyboard([
          [Markup.button.callback("🔙 منوی اصلی", "main_menu")],
        ]),
      );
      return;
    }

    try {
      const id = await db.insertTraveler({
        telegramId: ctx.from.id,
        telegramUsername: ctx.from.username ? `@${ctx.from.username}` : null,
        city: s.city,
        protestCity: s.protestCity,
        numTravelers: s.numTravelers,
        currency: s.currency,
        amount: s.amount,
        message: s.message,
      });

      const emoji = CITY_EMOJI[s.protestCity] || "🌍";
      ctx.session = {};
      await ctx.editMessageText(
        `✅ *ثبت‌نام با موفقیت انجام شد!*\n\n` +
          `${RLM}شناسه شما: \`${id}\`\n` +
          `${RLM}مسیر: ${s.city}${RLM} به ${emoji} ${cityLabel(s.protestCity)}\n` +
          `${RLM}👥 تعداد: ${s.numTravelers} نفر\n` +
          `${RLM}مبلغ: ${s.amount} ${currencyLabel(s.currency)}\n\n` +
          `درخواست شما در لیست مسافران قرار گرفت. وقتی حامی‌ای تصمیم به کمک بگیرد، پیامی از طرف ربات دریافت خواهید کرد.\n` +
          `از منوی «📋 وضعیت مسافر» می‌توانید وضعیت خود را پیگیری کنید.`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [Markup.button.callback("🔙 منوی اصلی", "main_menu")],
          ]),
        },
      );
    } catch (error) {
      console.error("Error creating traveler:", error);
      await ctx.reply(
        "خطایی رخ داد. لطفاً دوباره تلاش کنید.",
        Markup.inlineKeyboard([
          [Markup.button.callback("🔙 منوی اصلی", "main_menu")],
        ]),
      );
    }
  });

  // ── Free-text input handler (must be registered last as middleware) ──
  bot.on("text", async (ctx, next) => {
    ctx.session ??= {};
    const step = ctx.session.step;

    if (step === "origin") {
      ctx.session.city = ctx.message.text.trim();
      if (ctx.session.editing === "origin") {
        ctx.session.editing = null;
        ctx.session.step = "confirm";
        return showConfirm(ctx);
      }
      ctx.session.step = "num_travelers";
      return askNumTravelers(ctx);
    }

    if (step === "num_travelers_text") {
      const raw = parsePersianNum(ctx.message.text.trim());
      const num = parseInt(raw, 10);
      if (isNaN(num) || num <= 0) {
        return ctx.reply("لطفاً یک عدد معتبر وارد کنید:");
      }
      ctx.session.numTravelers = num;
      if (ctx.session.editing === "num_travelers") {
        ctx.session.editing = null;
        ctx.session.step = "confirm";
        return showConfirm(ctx);
      }
      ctx.session.step = "currency";
      return askCurrency(ctx);
    }

    if (step === "amount") {
      const raw = parsePersianNum(ctx.message.text.trim());
      const num = Number(raw);
      if (isNaN(num) || num <= 0) {
        return ctx.reply("لطفاً یک عدد معتبر وارد کنید:");
      }
      ctx.session.amount = num;
      if (ctx.session.editing === "amount") {
        ctx.session.editing = null;
        ctx.session.step = "confirm";
        return showConfirm(ctx);
      }
      ctx.session.step = "message";
      return askMessage(ctx);
    }

    if (step === "message") {
      ctx.session.message = ctx.message.text.trim();
      if (ctx.session.editing === "message") {
        ctx.session.editing = null;
      }
      ctx.session.step = "confirm";
      return showConfirm(ctx);
    }

    return next();
  });
}

module.exports = { register, showConfirm };
