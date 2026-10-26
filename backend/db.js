'use strict';

const mysql = require('mysql2/promise');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

// TiDB Cloud requires SSL; local MySQL does not
const sslConfig = process.env.DB_SSL === 'true'
  ? { minVersion: 'TLSv1.2', rejectUnauthorized: true }
  : false;

const pool = mysql.createPool({
  host:               process.env.DB_HOST     || 'localhost',
  port:               Number(process.env.DB_PORT) || 3306,
  user:               process.env.DB_USER     || 'root',
  password:           process.env.DB_PASSWORD || '',
  database:           process.env.DB_NAME     || 'courier_tracking',
  ssl:                sslConfig,
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  enableKeepAlive:    true,
  keepAliveInitialDelay: 0
});

/**
 * Test the database connection.
 * Returns { ok: true, latency_ms } or throws.
 */
async function checkConnection() {
  const start = Date.now();
  const conn  = await pool.getConnection();
  await conn.ping();
  conn.release();
  return { ok: true, latency_ms: Date.now() - start };
}

module.exports = { pool, checkConnection };
