'use strict';

const bcrypt = require('bcryptjs');
const { pool } = require('../db');

/**
 * POST /api/auth/login
 * Verifies admin credentials and creates a session.
 */
async function login(req, res, next) {
  try {
    const { username, password } = req.body;

    if (!username?.trim() || !password) {
      return res.status(400).json({ success: false, error: 'Username and password are required.' });
    }

    const [rows] = await pool.execute(
      'SELECT admin_id, username, password_hash, full_name, is_active FROM admins WHERE username = ?',
      [username.trim()]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid username or password.' });
    }

    const admin = rows[0];

    if (!admin.is_active) {
      return res.status(401).json({ success: false, error: 'Account is disabled. Contact system administrator.' });
    }

    const passwordMatch = await bcrypt.compare(password, admin.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, error: 'Invalid username or password.' });
    }

    // Update last login time
    await pool.execute(
      'UPDATE admins SET last_login = NOW() WHERE admin_id = ?',
      [admin.admin_id]
    );

    // Create session
    req.session.adminId   = admin.admin_id;
    req.session.adminName = admin.full_name || admin.username;

    res.json({
      success:  true,
      message:  'Login successful.',
      admin:    { username: admin.username, full_name: admin.full_name }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/logout
 * Destroys the admin session.
 */
function logout(req, res) {
  req.session.destroy((err) => {
    if (err) console.error('[LOGOUT] Session destroy error:', err.message);
    res.clearCookie('courier.sid');
    res.json({ success: true, message: 'Logged out successfully.' });
  });
}

/**
 * GET /api/auth/me
 * Returns the currently logged-in admin info (for frontend session check).
 */
function me(req, res) {
  if (req.session && req.session.adminId) {
    return res.json({
      success:    true,
      admin_id:   req.session.adminId,
      admin_name: req.session.adminName
    });
  }
  res.status(401).json({ success: false, error: 'Not authenticated.' });
}

module.exports = { login, logout, me };
