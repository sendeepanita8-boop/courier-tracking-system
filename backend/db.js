'use strict';

const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

// TiDB Cloud requires SSL; local MySQL does not
const sslConfig = process.env.DB_SSL === 'true'
  ? { minVersion: 'TLSv1.2', rejectUnauthorized: true }
  : undefined;

// Use a single pool — lazily created so it works in both serverless and long-running modes
let pool;

function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host:               process.env.DB_HOST     || 'localhost',
      port:               Number(process.env.DB_PORT) || 3306,
      user:               process.env.DB_USER     || 'root',
      password:           process.env.DB_PASSWORD || '',
      database:           process.env.DB_NAME     || 'courier_tracking',
      ssl:                sslConfig,
      waitForConnections: true,
      connectionLimit:    5,          // keep low for serverless
      queueLimit:         0,
      enableKeepAlive:    true,
      keepAliveInitialDelay: 0,
      connectTimeout:     15000
    });
  }
  return pool;
}

/**
 * Test the database connection.
 * Returns { ok: true, latency_ms } or throws.
 */
async function checkConnection() {
  const start = Date.now();
  const conn  = await getPool().getConnection();
  await conn.ping();
  conn.release();
  return { ok: true, latency_ms: Date.now() - start };
}

// Export the pool getter so controllers use: const { pool } = require('./db'); pool.query(...)
// We proxy it so existing code still works with `pool.query()` / `pool.execute()`
module.exports = {
  get pool() { return getPool(); },
  checkConnection
};
