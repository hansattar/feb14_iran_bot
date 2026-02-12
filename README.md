# Protest Match Bot

A Telegram bot that connects travelers who need financial support to attend protest rallies with supporters willing to fund their trips.

Built for the **Global Day of Action on February 14, 2026** in solidarity with the Lion and Sun Revolution in Iran, covering rallies in Los Angeles, Toronto, and Munich.

## How It Works

The bot serves two roles:

**Travelers** register with their travel details (origin city, destination rally, group size, budget, and a message to supporters). They receive a public listing that supporters can browse.

**Supporters** browse the traveler list, pick someone to fund, and pledge an amount. Both parties are notified and connected via Telegram so they can coordinate the transfer directly. The traveler confirms receipt, completing the funding cycle.

### Flow

```
Traveler registers → Listed publicly → Supporter pledges amount
    → Both notified with contact links → Traveler confirms receipt
```

Funding has three states: **pending** (pledged, not yet sent), **funded** (confirmed by traveler), and **cancelled**.

## Tech Stack

- **Runtime**: Node.js 20
- **Bot Framework**: [Telegraf](https://telegraf.js.org/) v4
- **Database**: PostgreSQL
- **Package Manager**: pnpm

## Development

### With Docker (recommended)

The dev setup includes a PostgreSQL instance — no external database needed.

1. Set your bot token:

```bash
export BOT_TOKEN=your_telegram_bot_token
```

2. Start everything:

```bash
pnpm docker:dev
```

This starts PostgreSQL and the bot with nodemon (auto-reload on file changes). Source files are mounted into the container so edits are picked up immediately.

If `BOT_TOKEN` is not set, compose will refuse to start with an error message.

### Without Docker

If you prefer running outside Docker, you'll need Node.js 20+, pnpm, and your own PostgreSQL database.

```bash
pnpm install
```

Create a `.env` file:

```
BOT_TOKEN=your_telegram_bot_token
DATABASE_URL=postgresql://user:pass@host/dbname
```

```bash
pnpm dev
```

## Production Deployment

1. Create a `.env` file on your server:

```
BOT_TOKEN=your_telegram_bot_token
DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require
```

2. Run the production compose:

```bash
pnpm docker:prod
```

The production compose expects an external PostgreSQL database (via `DATABASE_URL`). Both `BOT_TOKEN` and `DATABASE_URL` are required — compose will fail if either is missing from `.env`.

The bot exposes a health check at `http://localhost:3000/healthz`.

## Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Show the main menu |
| `/menu`  | Return to main menu (resets current flow) |

All other interaction happens through inline buttons.

## Project Structure

```
index.js              Entry point, health server
src/
  bot.js              Telegraf setup, middleware, handler registration
  config.js           Cities, currencies, constants, text utilities
  database.js         PostgreSQL schema, queries, transactions
  handlers/
    start.js          /start command
    menu.js           Main menu, welcome text, settings check
    traveler.js       6-step traveler registration wizard
    supporter.js      Traveler browsing, funding flow
    status.js         Status dashboards, confirm/cancel/edit/delete
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
