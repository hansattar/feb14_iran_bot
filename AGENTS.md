# AGENTS.md — AI Agent Context

This file provides the context AI coding agents need to work on this project effectively.

## Project Summary

A Telegram bot (Telegraf v4 + PostgreSQL) that matches travelers needing financial help to attend protest rallies with supporters willing to fund their trips. The UI is entirely in Persian (Farsi) with RTL text handling.

## Tech Stack

- **Node.js 20**, **pnpm** package manager
- **Telegraf v4** — Telegram Bot API framework
- **pg** (node-postgres) — PostgreSQL client
- **dotenv** — environment variable loading
- **No TypeScript, no test framework, no ORM**

## Architecture

The bot uses long-polling (not webhooks). Entry point is `index.js` which starts a health HTTP server and launches the bot.

### Handler Registration Order (Critical)

In `src/bot.js`, handlers are registered in this order:

```
menuHandler → startHandler → statusHandler → supporterHandler → travelerHandler
```

**This order matters.** Text input middleware in `supporterHandler` and `travelerHandler` use `next()` to pass unhandled messages down the chain. Supporter text handlers must come before traveler text handlers because both listen on `bot.on("text")`.

### Session

Sessions are in-memory (Telegraf default). Session state tracks the user's current step in a flow via `ctx.session.step`. Key session fields:

- `step` — current flow step (e.g., `"origin"`, `"amount"`, `"pick_traveler"`, `"fund_amount"`)
- `editing` — which field is being edited during traveler info editing
- `editingTraveler` — traveler ID when editing existing registration
- `protestCity`, `city`, `numTravelers`, `currency`, `amount`, `message` — traveler registration data
- `supporterCity`, `supporterPage` — supporter list filter state
- `selectedTraveler` — traveler ID selected by supporter

### Database

PostgreSQL with two tables:

**travelers**: `id`, `telegram_id` (unique), `telegram_username`, `city`, `protest_city`, `num_travelers`, `currency`, `amount_needed`, `pending_amount`, `funded_amount`, `message`, `status`, `created_at`

**fundings**: `id`, `traveler_id` (FK → travelers), `supporter_id`, `supporter_username`, `amount`, `status` (pending/funded/cancelled), `created_at`

Funding operations use database transactions to keep `pending_amount` and `funded_amount` in sync on the traveler record.

Schema is auto-created on startup via `db.init()`. Migration columns are added with `ADD COLUMN IF NOT EXISTS`.

### File Responsibilities

| File | Purpose |
|------|---------|
| `index.js` | Entry point, health server on port 3000 |
| `src/bot.js` | Creates Telegraf instance, registers middleware and handlers |
| `src/config.js` | Constants (cities, currencies, page size), utility functions (labels, markdown escaping, contact links) |
| `src/database.js` | Pool management, schema init, all SQL queries with transaction support |
| `src/handlers/start.js` | `/start` command — resets session, shows menu |
| `src/handlers/menu.js` | Main menu UI, welcome text, `/menu` command, settings check |
| `src/handlers/traveler.js` | 6-step registration wizard with edit support |
| `src/handlers/supporter.js` | Traveler list browsing (paginated, filterable), funding flow |
| `src/handlers/status.js` | Status dashboards for both roles, confirm/cancel funding, edit/delete traveler |

### Patterns and Conventions

- **Callback data naming**: `role_traveler`, `city_Munich`, `numtrav_3`, `cur_USD`, `sfilter_all_0`, `tfconfirm_42`, `sfcancel_7`
- **Persian number parsing**: `parsePersianNum()` converts `۰-۹` to `0-9` before parsing
- **RTL text**: `RLM` (`\u200F`) is prepended to lines that mix Persian and English
- **Markdown**: Uses Telegraf's `parse_mode: "Markdown"` (v1, not MarkdownV2). Underscores are escaped with `escMd()`.
- **Contact links**: `contactLink()` generates `tg://user?id=` deep links with optional username display
- **Error handling**: Try/catch in action handlers with user-facing error messages in Persian
- **Notifications**: `notifyParty()` helper in status.js sends messages to other users with error suppression

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `BOT_TOKEN` | Yes | Telegram bot token from @BotFather |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `PORT` | No | Health server port (default: 3000) |

## Common Tasks

### Adding a new city

1. Add to `CITIES` array in `src/config.js`
2. Add emoji to `CITY_EMOJI`
3. Add Persian label to `CITY_LABEL`
4. Update welcome text in `src/handlers/menu.js`

### Adding a new currency

1. Add to `CURRENCIES` array in `src/config.js`
2. Add Persian label to `CURRENCY_LABEL`

### Adding a new handler

1. Create file in `src/handlers/`
2. Export a `register(bot)` function
3. Import and register in `src/bot.js` — place it **before** `travelerHandler` if it uses `bot.on("text")`

### Modifying the database schema

Add migration in `db.init()` using `ADD COLUMN IF NOT EXISTS` or similar idempotent DDL. The schema auto-applies on every startup.
