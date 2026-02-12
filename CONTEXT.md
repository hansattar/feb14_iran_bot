# CONTEXT.md — Developer Guide

This document explains how the codebase is structured and how the different pieces fit together. Read this if you want to understand or contribute to the project.

## What This Bot Does

This is a Telegram bot for a specific event: the **February 14, 2026 Global Day of Action** supporting the Lion and Sun Revolution in Iran. Rallies are held in three cities (Los Angeles, Toronto, Munich). The bot connects people who want to attend but need financial help ("travelers") with people willing to fund their trip ("supporters").

The entire user interface is in **Persian (Farsi)**, which is a right-to-left language. This affects text formatting throughout the codebase.

## High-Level Flow

```
User sends /start
  → Main menu (choose role: traveler or supporter)

TRAVELER PATH:
  → 6-step registration: protest city → origin → group size → currency → amount → message
  → Confirmation screen (can edit any field)
  → Registered and visible to supporters
  → Can check status, confirm/cancel incoming funding, edit info, or delete registration

SUPPORTER PATH:
  → Browse paginated traveler list (filterable by city)
  → Select a traveler by ID → see details
  → Enter funding amount (or use "full remaining" shortcut)
  → Funding created as "pending"
  → Both parties notified with contact links
  → Traveler confirms receipt → funding becomes "funded"
  → Either party can cancel pending funding
```

## Entry Point

`index.js` does three things:
1. Validates environment variables (`BOT_TOKEN`, `DATABASE_URL`)
2. Starts an HTTP server on port 3000 with a `/healthz` endpoint (for container health checks)
3. Creates and launches the Telegraf bot

## Bot Setup (`src/bot.js`)

The bot is a standard Telegraf instance with in-memory session middleware. Handlers are registered in a specific order that matters:

```javascript
menuHandler.register(bot);      // Menu buttons, /menu command
startHandler.register(bot);     // /start command
statusHandler.register(bot);    // Status dashboards, confirm/cancel actions
supporterHandler.register(bot); // Supporter browsing + text input
travelerHandler.register(bot);  // Traveler registration + text input
```

**Why order matters:** Both `supporterHandler` and `travelerHandler` register `bot.on("text")` middleware. Each checks `ctx.session.step` to decide if the message belongs to them, and calls `next()` if not. Supporter must come first so its text handler runs before the traveler's.

## Configuration (`src/config.js`)

All hardcoded values live here:

- **CITIES**: Array of supported rally cities (`['Los Angeles', 'Toronto', 'Munich']`)
- **CITY_EMOJI / CITY_LABEL**: Maps city names to flag emojis and Persian translations
- **CURRENCIES**: Array of `{ key, label }` objects for supported currencies
- **PAGE_SIZE**: Number of travelers per page in the supporter list (10)
- **MAX_PENDING_FUNDINGS**: Max active funding pledges per supporter (5)
- **RLM**: Right-to-Left Mark character (`\u200F`) prepended to mixed-direction text lines

Utility functions: `cityLabel()`, `currencyLabel()`, `escMd()` (escapes underscores for Markdown v1), `contactLink()` (generates `tg://user?id=` links).

## Database (`src/database.js`)

Uses `pg` (node-postgres) directly — no ORM. The connection pool is configured with max 20 connections.

### Schema

**travelers** table stores registered travelers:
- Identity: `telegram_id` (unique), `telegram_username`
- Travel info: `city` (origin), `protest_city` (destination), `num_travelers`
- Financial: `currency`, `amount_needed`, `pending_amount`, `funded_amount`
- Other: `message`, `status`, `created_at`

**fundings** table stores individual funding pledges:
- Links: `traveler_id` (FK with CASCADE delete), `supporter_id`, `supporter_username`
- Financial: `amount`, `status` (pending → funded or cancelled)

### Transactions

Funding operations (`insertFunding`, `confirmFunding`, `cancelFunding`, `adjustFunding`) use explicit PostgreSQL transactions. When a funding is created, the traveler's `pending_amount` increases atomically. When confirmed, `pending_amount` decreases and `funded_amount` increases. This prevents race conditions.

### Schema Migrations

The schema is created on every startup with `CREATE TABLE IF NOT EXISTS`. New columns are added with `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. This means the database schema is always up to date without a separate migration tool.

## Handlers

### `start.js`
Minimal — resets session and calls `sendMenu()`.

### `menu.js`
Defines the main menu keyboard and welcome text. Also handles the "check settings" action that verifies whether the user has a Telegram username set (important for contact between parties).

### `traveler.js`
Implements a 6-step registration wizard:

1. **Protest city** — inline buttons for each city
2. **Origin** — free text input (city they're traveling from)
3. **Number of travelers** — buttons for 1-4, "5+" for custom input
4. **Currency** — inline buttons
5. **Amount** — free text number input (supports Persian numerals)
6. **Message** — free text (shown to supporters)

After all steps, a confirmation screen shows all data with edit buttons for each field. Editing a field re-asks that specific step, then returns to confirmation.

The text input handler checks `ctx.session.step` and `ctx.session.editing` to route messages to the correct field.

### `supporter.js`
The supporter flow:

1. **Traveler list** — paginated, sorted by remaining need (ascending, normalized by group size). City filter buttons at top.
2. **Traveler detail** — shows full info when supporter enters a traveler ID. If fully funded, shows a warning but allows proceeding.
3. **Amount input** — free text or "full remaining amount" button.
4. **Funding creation** — inserts funding, notifies both parties with contact links and instructions.

### `status.js`
Status dashboards for both roles:

**Traveler status** shows registration details, pending fundings (with confirm/cancel buttons), and a link to view confirmed fundings. Also offers edit and delete actions.

**Supporter status** shows active (pending) fundings with cancel buttons, and a link to view confirmed fundings.

The confirm/cancel actions update the database and notify the other party. Delete checks for confirmed fundings (blocks deletion) and auto-cancels pending ones.

## RTL Text Handling

Persian is right-to-left. When mixing Persian text with English/numbers (city names, amounts), the Unicode Right-to-Left Mark (`\u200F`, stored as `RLM`) is prepended to force correct display order. You'll see `${RLM}` throughout message templates.

## Telegram-Specific Notes

- **Callback queries**: Must always call `ctx.answerCbQuery()` first to dismiss the loading spinner
- **Session initialization**: Every handler uses `ctx.session ??= {}` as a guard since sessions start undefined
- **editMessageText vs reply**: `editMessageText` replaces the current message (used for inline button responses). `reply` sends a new message (used for text input responses).
- **Markdown v1**: The bot uses Telegram's legacy Markdown mode, not MarkdownV2. Only underscores need escaping (`\_`).
- **tg://user?id=**: Deep links that open a chat with a user by their Telegram ID. Works even without a username.

## Running Locally

```bash
pnpm install
cp .env.example .env  # fill in BOT_TOKEN and DATABASE_URL
pnpm dev              # starts with nodemon auto-reload
```

The bot connects to PostgreSQL on startup and auto-creates all tables. No separate migration step needed.
