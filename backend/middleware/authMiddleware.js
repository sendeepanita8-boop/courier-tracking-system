'use strict';

/**
 * authMiddleware.js
 * Protects administrative routes.
 * Uses session-based authentication set by authController on login.
 */

function requireAuth(req, res, next) {
  if (req.session && req.session.adminId) {
    return next();
  }
  return res.status(401).json({ success: false, error: 'Authentication required. Please log in.' });
}

module.exports = { requireAuth };
