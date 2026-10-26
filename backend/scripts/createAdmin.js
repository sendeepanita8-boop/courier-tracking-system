'use strict';

/**
 * createAdmin.js
 * Securely creates an administrator account with a bcrypt-hashed password.
 * Reads credentials from command-line arguments — never from source code.
 *
 * Usage:
 *   node backend/scripts/createAdmin.js <username> <password> [full_name]
 *
 * Example:
 *   node backend/scripts/createAdmin.js admin MySecurePass123 "Admin User"
 */

const bcrypt = require('bcryptjs');
const mysql  = require('mysql2/promise');
const path   = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

async function main() {
  const [,, username, password, fullName] = process.argv;

  if (!username || !password) {
    console.error('Usage: node backend/scripts/createAdmin.js <username> <password> [full_name]');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('Error: password must be at least 8 characters.');
    process.exit(1);
  }

  const saltRounds  = 12;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  const conn = await mysql.createConnection({
    host:     process.env.DB_HOST     || 'localhost',
    port:     Number(process.env.DB_PORT) || 3306,
    user:     process.env.DB_USER     || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME     || 'courier_tracking',
    ssl:      process.env.DB_SSL === 'true' ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } : undefined
  });

  try {
    const [result] = await conn.execute(
      'INSERT INTO admins (username, password_hash, full_name) VALUES (?, ?, ?)',
      [username.trim(), passwordHash, fullName?.trim() || null]
    );
    console.log(`\n✅  Admin account created successfully.`);
    console.log(`    Username:  ${username}`);
    console.log(`    Full Name: ${fullName || '(not set)'}`);
    console.log(`    Admin ID:  ${result.insertId}\n`);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      console.error(`Error: Username "${username}" already exists.`);
    } else {
      console.error('Error creating admin:', err.message);
    }
    process.exit(1);
  } finally {
    await conn.end();
  }
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
