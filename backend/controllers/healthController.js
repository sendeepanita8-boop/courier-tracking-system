'use strict';

const { checkConnection } = require('../db');

/**
 * GET /api/health
 * Returns server and database status.
 * Does NOT expose credentials.
 */
async function healthCheck(req, res, next) {
  try {
    const db = await checkConnection();
    res.json({
      success:    true,
      server:     'online',
      database:   'connected',
      latency_ms: db.latency_ms,
      timestamp:  new Date().toISOString()
    });
  } catch (err) {
    res.status(503).json({
      success:   false,
      server:    'online',
      database:  'unreachable',
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = { healthCheck };
