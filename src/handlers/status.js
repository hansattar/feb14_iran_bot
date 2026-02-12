const { Markup } = require("telegraf");
const {
  CITY_EMOJI,
  MAX_PENDING_FUNDINGS,
  RLM,
  cityLabel,
  currencyLabel,
  contactLink,
} = require("../config");
const db = require("../database");
const { showConfirm } = require("./traveler");

function remaining(t) {
  return Math.max(
    Number(t.amount_needed) -
      Number(t.funded_amount) -
      Number(t.pending_amount),
    0,
  );
}

// ── Traveler Status ──

async function showTravelerStatus(ctx, editMessage = false) {
  const traveler = await db.getTravelerByTelegramId(ctx.from.id);

  if (!traveler) {
    const text = "شما به عنوان مسافر ثبت‌نام نکرده‌اید.";
    const kb = Markup.inlineKeyboard([
      [Markup.button.callback("🔙 منوی اصلی", "main_menu")],
    ]);
    return editMessage ? ctx.editMessageText(text, kb) : ctx.reply(text, kb);
  }

  const emoji = CITY_EMOJI[traveler.protest_city] || "🌍";
  const needed = Number(traveler.amount_needed);
  const funded = Number(traveler.funded_amount);
  const pending = Number(traveler.pending_amount);
  const rem = remaining(traveler);
  const cur = currencyLabel(traveler.currency);

  let text = "📋 *وضعیت مسافر*\n\n";
  text += `${RLM}🆔 شناسه: \`${traveler.id}\`\n`;
  text += `${RLM}🏙️ تظاهرات: ${emoji} ${cityLabel(traveler.protest_city)}\n`;
  text += `${RLM}📍 مبدأ: ${traveler.city}\n`;
  text += `${RLM}👥 تعداد: ${traveler.num_travelers} نفر\n`;
  text += `${RLM}💰 مبلغ مورد نیاز: ${needed} ${cur}\n`;
  text += `${RLM}✅ تأمین شده: ${funded} ${cur}\n`;
  text += `${RLM}⏳ در انتظار تأیید: ${pending} ${cur}\n`;
  text += `${RLM}📊 باقیمانده: ${rem} ${cur}\n`;
  text += `📝 پیام: ${traveler.message}\n`;

  // Pending fundings
  const pendingFundings = await db.getFundingsByTraveler(
    traveler.id,
    "pending",
  );

  if (pendingFundings.length > 0) {
    text += "\n*حمایت‌های در انتظار تأیید:*\n";
    text += "پس از دریافت وجه از حامی، دکمه تأیید را بزنید.\n\n";
    pendingFundings.forEach((f, i) => {
      const n = i + 1;
      const supporterLink = contactLink('پیام به حامی', f.supporter_id, f.supporter_username);
      text += `${RLM}${n}) 💰 ${Number(f.amount)} ${cur} — ${supporterLink}\n\n`;
    });
  } else {
    text += "\nحمایت در انتظار تأییدی ندارید.\n";
  }

  const buttons = [];
  if (pendingFundings.length > 0) {
    text += "✅ تأیید: وجه را دریافت کرده‌اید — حامی مطلع می‌شود\n";
    text += "❌ لغو: وجه دریافت نشده — حمایت لغو و حامی مطلع می‌شود\n";
    pendingFundings.forEach((f, i) => {
      const n = i + 1;
      buttons.push([
        Markup.button.callback(`تأیید✅ ${n}`, `tfconfirm_${f.id}`),
        Markup.button.callback(`لغو❌ ${n}`, `tfcancel_${f.id}`),
      ]);
    });
  }
  buttons.push([
    Markup.button.callback("📜 مشاهده تأیید شده‌ها", "confirmed_traveler"),
  ]);
  buttons.push([Markup.button.callback("✏️ ویرایش اطلاعات", "edit_entry")]);
  buttons.push([Markup.button.callback("🗑️ حذف ثبت‌نام", "remove_entry")]);
  buttons.push([Markup.button.callback("🔙 منوی اصلی", "main_menu")]);

  const opts = { parse_mode: "Markdown", ...Markup.inlineKeyboard(buttons) };
  return editMessage ? ctx.editMessageText(text, opts) : ctx.reply(text, opts);
}

async function showTravelerConfirmed(ctx) {
  const traveler = await db.getTravelerByTelegramId(ctx.from.id);
  if (!traveler) return;

  const cur = currencyLabel(traveler.currency);
  const fundings = await db.getFundingsByTraveler(traveler.id, "funded");

  let text = "📜 *حمایت‌های تأیید شده*\n\n";
  if (fundings.length === 0) {
    text += "هنوز حمایت تأیید شده‌ای ندارید.";
  } else {
    fundings.forEach((f, i) => {
      const supporterLink = contactLink('پیام به حامی', f.supporter_id, f.supporter_username);
      text += `${RLM}${i + 1}) 💰 ${Number(f.amount)} ${cur} — ${supporterLink}\n\n`;
    });
  }

  await ctx.reply(text, {
    parse_mode: "Markdown",
    ...Markup.inlineKeyboard([
      [Markup.button.callback("🔙 بازگشت", "status_traveler")],
    ]),
  });
}

// ── Supporter Status ──

async function showSupporterStatus(ctx, editMessage = false) {
  const fundings = await db.getFundingsBySupporter(ctx.from.id, "pending");

  if (fundings.length === 0) {
    const text = "شما هنوز حمایتی ثبت نکرده‌اید.";
    const kb = Markup.inlineKeyboard([
      [Markup.button.callback("📜 مشاهده تأیید شده‌ها", "confirmed_supporter")],
      [Markup.button.callback("🔙 منوی اصلی", "main_menu")],
    ]);
    return editMessage ? ctx.editMessageText(text, kb) : ctx.reply(text, kb);
  }

  let text = `📊 *حمایت‌های فعال: ${fundings.length} از ${MAX_PENDING_FUNDINGS}*\n`;
  text += `با مسافران تماس بگیرید و وجه را ارسال کنید. پس از ارسال، مسافر باید دریافت را تأیید کند.\n\n`;

  fundings.forEach((f, i) => {
    const n = i + 1;
    const emoji = CITY_EMOJI[f.protest_city] || "🌍";
    const cur = currencyLabel(f.currency);
    const travelerLink = contactLink('پیام به مسافر', f.traveler_telegram_id, f.traveler_username);
    text += `${RLM}${n}) مسافر از ${f.city} به ${cityLabel(f.protest_city)} ${emoji}\n`;
    text += `${RLM}   💰 ${Number(f.amount)} ${cur} — ${travelerLink}\n\n`;
  });

  text += "❌ لغو: حمایت لغو می‌شود و مسافر مطلع می‌شود\n";

  const buttons = [];
  fundings.forEach((f, i) => {
    const n = i + 1;
    buttons.push([
      Markup.button.callback(`لغو❌ ${n}`, `sfcancel_${f.id}`),
    ]);
  });
  buttons.push([
    Markup.button.callback("📜 مشاهده تأیید شده‌ها", "confirmed_supporter"),
  ]);
  buttons.push([Markup.button.callback("🔙 منوی اصلی", "main_menu")]);

  const opts = { parse_mode: "Markdown", ...Markup.inlineKeyboard(buttons) };
  return editMessage ? ctx.editMessageText(text, opts) : ctx.reply(text, opts);
}

async function showSupporterConfirmed(ctx) {
  const fundings = await db.getFundingsBySupporter(ctx.from.id, "funded");

  let text = "📜 *حمایت‌های تأیید شده*\n\n";
  if (fundings.length === 0) {
    text += "هنوز حمایت تأیید شده‌ای ندارید.";
  } else {
    fundings.forEach((f, i) => {
      const emoji = CITY_EMOJI[f.protest_city] || "🌍";
      const cur = currencyLabel(f.currency);
      const travelerLink = contactLink('پیام به مسافر', f.traveler_telegram_id, f.traveler_username);
      text += `${RLM}${i + 1}) مسافر از ${f.city} به ${cityLabel(f.protest_city)} ${emoji}\n`;
      text += `${RLM}   💰 ${Number(f.amount)} ${cur} — ${travelerLink}\n\n`;
    });
  }

  await ctx.reply(text, {
    parse_mode: "Markdown",
    ...Markup.inlineKeyboard([
      [Markup.button.callback("🔙 بازگشت", "status_supporter")],
    ]),
  });
}

// ── Notify helper ──

async function notifyParty(ctx, telegramId, message, keyboard) {
  if (!telegramId) return;
  try {
    await ctx.telegram.sendMessage(telegramId, message, {
      parse_mode: "Markdown",
      ...(keyboard || Markup.inlineKeyboard([
        [Markup.button.callback("🔙 منوی اصلی", "main_menu")],
      ])),
    });
  } catch (e) {
    console.error("Could not notify user:", e.message);
  }
}

// ── Register ──

function register(bot) {
  // ── Traveler status ──
  bot.action("status_traveler", async (ctx) => {
    await ctx.answerCbQuery();
    await showTravelerStatus(ctx, false);
  });

  bot.action("confirmed_traveler", async (ctx) => {
    await ctx.answerCbQuery();
    await showTravelerConfirmed(ctx);
  });

  // Traveler confirms a funding
  bot.action(/^tfconfirm_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const fundingId = parseInt(ctx.match[1], 10);
    try {
      const funding = await db.getFundingById(fundingId);
      if (!funding || Number(funding.traveler_telegram_id) !== ctx.from.id) {
        return ctx.reply(
          "این حمایت متعلق به شما نیست.",
          Markup.inlineKeyboard([
            [Markup.button.callback("🔙 منوی اصلی", "main_menu")],
          ]),
        );
      }
      const { traveler_id, amount } = await db.confirmFunding(fundingId);
      const traveler = await db.getTravelerById(traveler_id);
      const cur = traveler ? currencyLabel(traveler.currency) : "";

      await ctx.reply(
        `✅ حمایت #${fundingId} تأیید شد. (${Number(amount)} ${cur})`,
      );

      // Notify supporter
      await notifyParty(
        ctx,
        funding.supporter_id,
        `✅ مسافر #${traveler_id} حمایت #${fundingId} شما را تأیید کرد.\n` +
          `${RLM}مبلغ: ${Number(amount)} ${cur}`,
        Markup.inlineKeyboard([
          [Markup.button.callback("📋 وضعیت حامی", "status_supporter")],
          [Markup.button.callback("🔙 منوی اصلی", "main_menu")],
        ]),
      );

      await showTravelerStatus(ctx, false);
    } catch (error) {
      console.error("Error confirming funding:", error);
      await ctx.reply(
        "خطایی رخ داد. لطفاً دوباره تلاش کنید.",
        Markup.inlineKeyboard([
          [Markup.button.callback("🔙 منوی اصلی", "main_menu")],
        ]),
      );
    }
  });

  // Traveler cancels a funding
  bot.action(/^tfcancel_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const fundingId = parseInt(ctx.match[1], 10);
    try {
      const funding = await db.getFundingById(fundingId);
      if (!funding || Number(funding.traveler_telegram_id) !== ctx.from.id) {
        return ctx.reply(
          "این حمایت متعلق به شما نیست.",
          Markup.inlineKeyboard([
            [Markup.button.callback("🔙 منوی اصلی", "main_menu")],
          ]),
        );
      }
      const { traveler_id, amount } = await db.cancelFunding(fundingId);
      const traveler = await db.getTravelerById(traveler_id);
      const cur = traveler ? currencyLabel(traveler.currency) : "";

      await ctx.reply(
        `❌ حمایت #${fundingId} لغو شد. (${Number(amount)} ${cur})`,
      );

      // Notify supporter
      await notifyParty(
        ctx,
        funding.supporter_id,
        `❌ مسافر #${traveler_id} حمایت #${fundingId} شما را لغو کرد.\n` +
          `${RLM}مبلغ: ${Number(amount)} ${cur}`,
        Markup.inlineKeyboard([
          [Markup.button.callback("📋 وضعیت حامی", "status_supporter")],
          [Markup.button.callback("🔙 منوی اصلی", "main_menu")],
        ]),
      );

      await showTravelerStatus(ctx, false);
    } catch (error) {
      console.error("Error cancelling funding:", error);
      await ctx.reply(
        "خطایی رخ داد. لطفاً دوباره تلاش کنید.",
        Markup.inlineKeyboard([
          [Markup.button.callback("🔙 منوی اصلی", "main_menu")],
        ]),
      );
    }
  });

  // ── Supporter status ──
  bot.action("status_supporter", async (ctx) => {
    await ctx.answerCbQuery();
    await showSupporterStatus(ctx, false);
  });

  bot.action("confirmed_supporter", async (ctx) => {
    await ctx.answerCbQuery();
    await showSupporterConfirmed(ctx);
  });

  // Supporter cancels a funding
  bot.action(/^sfcancel_(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const fundingId = parseInt(ctx.match[1], 10);
    try {
      const funding = await db.getFundingById(fundingId);
      if (!funding || Number(funding.supporter_id) !== ctx.from.id) {
        return ctx.reply(
          "این حمایت متعلق به شما نیست.",
          Markup.inlineKeyboard([
            [Markup.button.callback("🔙 منوی اصلی", "main_menu")],
          ]),
        );
      }
      const { traveler_id, amount } = await db.cancelFunding(fundingId);
      const traveler = await db.getTravelerById(traveler_id);
      const cur = traveler ? currencyLabel(traveler.currency) : "";

      await ctx.reply(
        `❌ حمایت #${fundingId} لغو شد. (${Number(amount)} ${cur})`,
      );

      // Notify traveler
      await notifyParty(
        ctx,
        funding.traveler_telegram_id,
        `❌ حامی حمایت #${fundingId} را لغو کرد.\n` +
          `${RLM}مبلغ: ${Number(amount)} ${cur}`,
        Markup.inlineKeyboard([
          [Markup.button.callback("📋 وضعیت مسافر", "status_traveler")],
          [Markup.button.callback("🔙 منوی اصلی", "main_menu")],
        ]),
      );

      await showSupporterStatus(ctx, false);
    } catch (error) {
      console.error("Error cancelling funding:", error);
      await ctx.reply(
        "خطایی رخ داد. لطفاً دوباره تلاش کنید.",
        Markup.inlineKeyboard([
          [Markup.button.callback("🔙 منوی اصلی", "main_menu")],
        ]),
      );
    }
  });

  // ── Edit traveler info (from status) ──
  bot.action("edit_entry", async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session ??= {};
    const traveler = await db.getTravelerByTelegramId(ctx.from.id);
    if (!traveler) return;

    // Load traveler data into session for editing
    ctx.session.editingTraveler = traveler.id;
    ctx.session.protestCity = traveler.protest_city;
    ctx.session.city = traveler.city;
    ctx.session.numTravelers = traveler.num_travelers;
    ctx.session.currency = traveler.currency;
    ctx.session.amount = Number(traveler.amount_needed);
    ctx.session.message = traveler.message;
    ctx.session.step = "confirm";

    await showConfirm(ctx);
  });

  bot.action("save_edit", async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session ??= {};
    const s = ctx.session;
    if (!s.editingTraveler) return;

    try {
      await db.updateTraveler(s.editingTraveler, {
        city: s.city,
        protestCity: s.protestCity,
        numTravelers: s.numTravelers,
        currency: s.currency,
        amount: s.amount,
        message: s.message,
      });
      ctx.session.editingTraveler = null;
      ctx.session.step = null;
      await ctx.reply("✅ اطلاعات شما بروزرسانی شد.");
      await showTravelerStatus(ctx, false);
    } catch (error) {
      console.error("Error updating traveler:", error);
      await ctx.reply(
        "خطایی رخ داد. لطفاً دوباره تلاش کنید.",
        Markup.inlineKeyboard([
          [Markup.button.callback("🔙 منوی اصلی", "main_menu")],
        ]),
      );
    }
  });

  // Delete traveler — block only if confirmed fundings exist
  bot.action("remove_entry", async (ctx) => {
    await ctx.answerCbQuery();
    const traveler = await db.getTravelerByTelegramId(ctx.from.id);
    if (!traveler) return;

    const confirmedFundings = await db.getFundingsByTraveler(traveler.id, "funded");
    if (confirmedFundings.length > 0) {
      return ctx.reply(
        "⚠️ امکان حذف ثبت‌نام وجود ندارد.\nشما حمایت‌های تأیید شده دارید. می‌توانید اطلاعات خود را ویرایش کنید.",
        Markup.inlineKeyboard([
          [Markup.button.callback("🔙 بازگشت", "status_traveler")],
        ]),
      );
    }

    const pendingFundings = await db.getFundingsByTraveler(traveler.id, "pending");
    let warningText = "⚠️ آیا مطمئن هستید که می‌خواهید ثبت‌نام خود را حذف کنید؟\nاین عمل قابل بازگشت نیست.";
    if (pendingFundings.length > 0) {
      warningText += `\n\n${pendingFundings.length} حمایت در انتظار تأیید دارید که به‌صورت خودکار لغو خواهند شد.`;
    }

    await ctx.reply(
      warningText,
      Markup.inlineKeyboard([
        [Markup.button.callback("🗑️ بله، حذف کن", "confirm_remove")],
        [Markup.button.callback("🔙 بازگشت", "status_traveler")],
      ]),
    );
  });

  bot.action("confirm_remove", async (ctx) => {
    await ctx.answerCbQuery();
    const traveler = await db.getTravelerByTelegramId(ctx.from.id);
    if (!traveler) return;

    // Double-check no confirmed fundings exist
    const confirmedFundings = await db.getFundingsByTraveler(traveler.id, "funded");
    if (confirmedFundings.length > 0) {
      return ctx.reply(
        "⚠️ امکان حذف ثبت‌نام وجود ندارد.\nشما حمایت‌های تأیید شده دارید.",
        Markup.inlineKeyboard([
          [Markup.button.callback("🔙 بازگشت", "status_traveler")],
        ]),
      );
    }

    // Auto-cancel any pending fundings before deleting
    const pendingFundings = await db.getFundingsByTraveler(traveler.id, "pending");
    for (const f of pendingFundings) {
      try {
        const { amount } = await db.cancelFunding(f.id);
        const cur = currencyLabel(traveler.currency);
        await notifyParty(
          ctx,
          f.supporter_id,
          `❌ مسافر #${traveler.id} ثبت‌نام خود را حذف کرد. حمایت #${f.id} لغو شد.\n` +
            `${RLM}مبلغ: ${Number(amount)} ${cur}`,
          Markup.inlineKeyboard([
            [Markup.button.callback("📋 وضعیت حامی", "status_supporter")],
            [Markup.button.callback("🔙 منوی اصلی", "main_menu")],
          ]),
        );
      } catch (e) {
        console.error("Error cancelling funding on delete:", e.message);
      }
    }

    await db.deleteTraveler(traveler.id);
    ctx.session = {};
    await ctx.editMessageText(
      "🗑️ ثبت‌نام شما حذف شد.",
      Markup.inlineKeyboard([
        [Markup.button.callback("🔙 منوی اصلی", "main_menu")],
      ]),
    );
  });

  bot.command("status", async (ctx) => {
    await ctx.reply(
      "برای مشاهده وضعیت، از دکمه‌های زیر استفاده کنید:",
      Markup.inlineKeyboard([
        [
          Markup.button.callback("📋 وضعیت مسافر", "status_traveler"),
          Markup.button.callback("📋 وضعیت حامی", "status_supporter"),
        ],
      ]),
    );
  });
}

module.exports = { register };
