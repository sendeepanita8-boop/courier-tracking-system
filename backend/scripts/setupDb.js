'use strict';

/**
 * setupDb.js  — runs schema.sql safely against the configured database.
 * Uses query() (not execute()) to support USE, multi-value INSERTs, and DDL.
 */

const fs    = require('fs');
const path  = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

async function main() {
  const schemaPath = path.join(__dirname, '..', '..', 'sql', 'schema.sql');
  const rawSql     = fs.readFileSync(schemaPath, 'utf8');

  // Remove comment-only lines, then split on semicolons
  const statements = rawSql
    .split('\n')
    .filter(line => !line.trim().startsWith('--') && line.trim() !== '')
    .join('\n')
    .split(/;\s*(?:\n|$)/)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  // Connect WITHOUT specifying a database first (CREATE DATABASE needs this)
  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     Number(process.env.DB_PORT) || 3306,
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: false
  });

  console.log('Connected to MySQL. Setting up database...\n');

  for (const stmt of statements) {
    const preview = stmt.split('\n')[0].substring(0, 70);
    try {
      await conn.query(stmt);          // query() — not execute() — supports DDL + USE
      console.log(`  ✓ ${preview}`);
    } catch (err) {
      // Some errors are acceptable (e.g. "already exists" handled by IF NOT EXISTS)
      if (
        err.code === 'ER_TABLE_EXISTS_ERROR' ||
        err.code === 'ER_DB_CREATE_EXISTS'
      ) {
        console.log(`  ℹ  (already exists, skipping) ${preview}`);
      } else {
        console.error(`  ✗ Error: ${err.message}`);
        console.error(`    Statement: ${preview}…`);
      }
    }
  }

  await conn.end();
  console.log('\n✅  Database setup complete.\n');
}

main().catch(err => {
  console.error('Fatal error during setup:', err.message);
  process.exit(1);
});
