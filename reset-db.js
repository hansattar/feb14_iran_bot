require('dotenv').config();
const { Pool } = require('pg');

async function reset() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    console.log('Dropping old tables...');
    await pool.query('DROP TABLE IF EXISTS fundings, withdrawals, matches, supporters, protesters, travelers CASCADE');
    console.log('Done. Old tables removed.');

    await pool.end();
    process.exit(0);
}

reset().catch((err) => {
    console.error('Reset failed:', err);
    process.exit(1);
});
