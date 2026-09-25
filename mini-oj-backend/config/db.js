require('./env');
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'mini_oj',
    port: Number(process.env.DB_PORT) || 5432,
    max: 10,
    idleTimeoutMillis: 30000,
});

const runQuery = async (client, sql, params) => {
    let index = 1;
    const pgSql = params?.length ? sql.replace(/\?/g, () => `$${index++}`) : sql;
    const result = await client.query(pgSql, params);
    return [result.rows, result.fields];
};

module.exports = {
    query: (sql, params) => runQuery(pool, sql, params),
    withTransaction: async (callback) => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const result = await callback({ query: (sql, params) => runQuery(client, sql, params) });
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
};
