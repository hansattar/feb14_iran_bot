require('dotenv').config();
const http = require('http');
const { createBot, launch } = require('./src/bot');

const TOKEN = process.env.BOT_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL;

if (!TOKEN) {
    console.error('BOT_TOKEN is required.');
    process.exit(1);
}

if (!DATABASE_URL) {
    console.error('DATABASE_URL is required.');
    process.exit(1);
}

const PORT = Number(process.env.PORT || 3000);

const server = http.createServer((req, res) => {
    if (req.url === '/healthz') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok');
        return;
    }
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('bot online');
});

server.listen(PORT, () => {
    console.log(`Health server listening on port ${PORT}`);
});

const bot = createBot(TOKEN);
launch(bot).catch((err) => {
    console.error('Failed to start bot:', err);
    process.exit(1);
});
