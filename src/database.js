const { Pool } = require('pg');

let pool;

async function init(connectionString) {
    pool = new Pool({
        connectionString: connectionString || process.env.DATABASE_URL,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    });

    await pool.query(`
        CREATE TABLE IF NOT EXISTS travelers (
            id SERIAL PRIMARY KEY,
            telegram_id BIGINT UNIQUE,
            telegram_username TEXT,
            city TEXT,
            protest_city TEXT,
            num_travelers INTEGER DEFAULT 1,
            currency TEXT,
            amount_needed NUMERIC(10,2),
            pending_amount NUMERIC(10,2) DEFAULT 0,
            funded_amount NUMERIC(10,2) DEFAULT 0,
            message TEXT,
            status TEXT DEFAULT 'available',
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    `);

    // Migration columns for existing DBs
    await pool.query(`ALTER TABLE travelers ADD COLUMN IF NOT EXISTS num_travelers INTEGER DEFAULT 1`);
    await pool.query(`ALTER TABLE travelers ADD COLUMN IF NOT EXISTS pending_amount NUMERIC(10,2) DEFAULT 0`);
    await pool.query(`ALTER TABLE travelers ADD COLUMN IF NOT EXISTS funded_amount NUMERIC(10,2) DEFAULT 0`);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS fundings (
            id SERIAL PRIMARY KEY,
            traveler_id INTEGER REFERENCES travelers(id) ON DELETE CASCADE,
            supporter_id BIGINT NOT NULL,
            supporter_username TEXT,
            amount NUMERIC(10,2) NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    `);

    await pool.query(`CREATE INDEX IF NOT EXISTS idx_travelers_status ON travelers(status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_fundings_traveler ON fundings(traveler_id, status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_fundings_supporter ON fundings(supporter_id, status)`);

    return pool;
}

function getPool() {
    if (!pool) throw new Error('Database not initialized. Call init() first.');
    return pool;
}

// ── Traveler queries ──

async function insertTraveler({ telegramId, telegramUsername, city, protestCity, numTravelers, currency, amount, message }) {
    const { rows } = await getPool().query(
        `INSERT INTO travelers
         (telegram_id, telegram_username, city, protest_city, num_travelers, currency, amount_needed, message, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id`,
        [telegramId, telegramUsername, city, protestCity, numTravelers || 1, currency, amount, message, 'available']
    );
    return rows[0].id;
}

async function getTravelerById(travelerId) {
    const { rows } = await getPool().query('SELECT * FROM travelers WHERE id = $1', [travelerId]);
    return rows[0];
}

async function getTravelerByTelegramId(telegramId) {
    const { rows } = await getPool().query('SELECT * FROM travelers WHERE telegram_id = $1', [telegramId]);
    return rows[0];
}

async function updateTraveler(travelerId, { city, protestCity, numTravelers, currency, amount, message }) {
    return getPool().query(
        `UPDATE travelers
         SET city = $1, protest_city = $2, num_travelers = $3, currency = $4, amount_needed = $5, message = $6
         WHERE id = $7`,
        [city, protestCity, numTravelers || 1, currency, amount, message, travelerId]
    );
}

async function updateTravelerStatus(travelerId, status) {
    return getPool().query('UPDATE travelers SET status = $1 WHERE id = $2', [status, travelerId]);
}

async function deleteTraveler(travelerId) {
    return getPool().query('DELETE FROM travelers WHERE id = $1', [travelerId]);
}

async function getTravelersPaginated(city, limit, offset) {
    const hasCity = city && city !== 'all';

    const where = `WHERE (amount_needed - funded_amount - pending_amount) > 0${hasCity ? ' AND protest_city = $3' : ''}`;

    const countQuery = `SELECT COUNT(*) as total FROM travelers ${where.replace('$3', '$1')}`;
    const dataQuery = `SELECT id, telegram_username, city, protest_city, num_travelers, currency,
                              amount_needed, pending_amount, funded_amount, message
                       FROM travelers ${where}
                       ORDER BY (amount_needed - funded_amount - pending_amount) / GREATEST(num_travelers, 1) ASC
                       LIMIT $1 OFFSET $2`;

    const [countResult, dataResult] = await Promise.all([
        getPool().query(countQuery, hasCity ? [city] : []),
        getPool().query(dataQuery, hasCity ? [limit, offset, city] : [limit, offset]),
    ]);

    return {
        rows: dataResult.rows,
        total: Number(countResult.rows[0].total),
    };
}

// ── Funding queries ──

async function insertFunding(travelerId, supporterId, supporterUsername, amount) {
    const client = await getPool().connect();
    try {
        await client.query('BEGIN');
        const { rows } = await client.query(
            `INSERT INTO fundings (traveler_id, supporter_id, supporter_username, amount, status)
             VALUES ($1, $2, $3, $4, 'pending') RETURNING id`,
            [travelerId, supporterId, supporterUsername, amount]
        );
        await client.query(
            `UPDATE travelers SET pending_amount = pending_amount + $1 WHERE id = $2`,
            [amount, travelerId]
        );
        await client.query('COMMIT');
        return rows[0].id;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

async function confirmFunding(fundingId) {
    const client = await getPool().connect();
    try {
        await client.query('BEGIN');
        const { rows } = await client.query(
            `UPDATE fundings SET status = 'funded' WHERE id = $1 AND status = 'pending'
             RETURNING traveler_id, amount`,
            [fundingId]
        );
        if (rows.length === 0) throw new Error('Funding not found or not pending');
        const { traveler_id, amount } = rows[0];
        await client.query(
            `UPDATE travelers
             SET pending_amount = GREATEST(pending_amount - $1, 0),
                 funded_amount = funded_amount + $1
             WHERE id = $2`,
            [amount, traveler_id]
        );
        await client.query('COMMIT');
        return { traveler_id, amount };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

async function cancelFunding(fundingId) {
    const client = await getPool().connect();
    try {
        await client.query('BEGIN');
        const { rows } = await client.query(
            `UPDATE fundings SET status = 'cancelled' WHERE id = $1 AND status = 'pending'
             RETURNING traveler_id, amount`,
            [fundingId]
        );
        if (rows.length === 0) throw new Error('Funding not found or not pending');
        const { traveler_id, amount } = rows[0];
        await client.query(
            `UPDATE travelers SET pending_amount = GREATEST(pending_amount - $1, 0) WHERE id = $2`,
            [amount, traveler_id]
        );
        await client.query('COMMIT');
        return { traveler_id, amount };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

async function adjustFunding(fundingId, newAmount) {
    const client = await getPool().connect();
    try {
        await client.query('BEGIN');
        const { rows } = await client.query(
            `SELECT amount, traveler_id FROM fundings WHERE id = $1 AND status = 'pending' FOR UPDATE`,
            [fundingId]
        );
        if (rows.length === 0) throw new Error('Funding not found or not pending');
        const oldAmount = Number(rows[0].amount);
        const travelerId = rows[0].traveler_id;
        const diff = newAmount - oldAmount;

        await client.query(`UPDATE fundings SET amount = $1 WHERE id = $2`, [newAmount, fundingId]);
        await client.query(
            `UPDATE travelers SET pending_amount = GREATEST(pending_amount + $1, 0) WHERE id = $2`,
            [diff, travelerId]
        );
        await client.query('COMMIT');
        return { traveler_id: travelerId, oldAmount, newAmount };
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}

async function getFundingById(fundingId) {
    const { rows } = await getPool().query(
        `SELECT f.*, t.telegram_id as traveler_telegram_id, t.telegram_username as traveler_username,
                t.city, t.protest_city, t.num_travelers, t.currency, t.amount_needed,
                t.pending_amount, t.funded_amount, t.message as traveler_message
         FROM fundings f
         JOIN travelers t ON f.traveler_id = t.id
         WHERE f.id = $1`,
        [fundingId]
    );
    return rows[0];
}

async function getFundingsBySupporter(supporterId, status) {
    const statusFilter = status ? `AND f.status = $2` : '';
    const params = status ? [supporterId, status] : [supporterId];
    const { rows } = await getPool().query(
        `SELECT f.*, t.telegram_id as traveler_telegram_id,
                t.telegram_username as traveler_username, t.city, t.protest_city,
                t.num_travelers, t.currency, t.amount_needed, t.pending_amount, t.funded_amount
         FROM fundings f
         JOIN travelers t ON f.traveler_id = t.id
         WHERE f.supporter_id = $1 ${statusFilter}
         ORDER BY f.created_at DESC`,
        params
    );
    return rows;
}

async function getFundingsByTraveler(travelerId, status) {
    const statusFilter = status ? `AND status = $2` : '';
    const params = status ? [travelerId, status] : [travelerId];
    const { rows } = await getPool().query(
        `SELECT * FROM fundings WHERE traveler_id = $1 ${statusFilter} ORDER BY created_at DESC`,
        params
    );
    return rows;
}

async function countPendingBySupporter(supporterId) {
    const { rows } = await getPool().query(
        `SELECT COUNT(*) as count FROM fundings WHERE supporter_id = $1 AND status = 'pending'`,
        [supporterId]
    );
    return Number(rows[0].count);
}

module.exports = {
    init,
    getPool,
    // travelers
    insertTraveler,
    getTravelerById,
    getTravelerByTelegramId,
    updateTraveler,
    updateTravelerStatus,
    deleteTraveler,
    getTravelersPaginated,
    // fundings
    insertFunding,
    confirmFunding,
    cancelFunding,
    adjustFunding,
    getFundingById,
    getFundingsBySupporter,
    getFundingsByTraveler,
    countPendingBySupporter,
};
