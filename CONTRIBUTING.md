# Contributing

This project is open to contributions. Whether you want to fix a bug, add a feature, or improve the documentation — pull requests are welcome.

## Getting Started

1. **Read [CONTEXT.md](CONTEXT.md)** to understand how the code is structured
2. **If using an AI coding tool**, add [AGENTS.md](AGENTS.md) to your tool's context so it understands the project architecture
3. Fork the repo and create a branch for your changes
4. Make your changes
5. Open a pull request with a clear description of what you changed and why

## Setup

```bash
pnpm install
cp .env.example .env  # add your BOT_TOKEN and DATABASE_URL
pnpm dev
```

You'll need a Telegram bot token (from [@BotFather](https://t.me/BotFather)) and a PostgreSQL database to run the bot locally.

## Guidelines

- Keep the UI language in Persian (Farsi). If you add new user-facing text, follow the existing style.
- Handler registration order in `src/bot.js` matters — see CONTEXT.md for details.
- Database schema changes should use `ADD COLUMN IF NOT EXISTS` or similar idempotent statements in `src/database.js`.
- The bot uses Markdown v1 for message formatting. Escape underscores with `escMd()` from config.

## Questions?

Open an issue if something is unclear or you need guidance on where to make a change.
