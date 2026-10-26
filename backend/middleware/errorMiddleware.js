'use strict';

/**
 * Centralized error handler.
 * Logs internally, never leaks stack traces to the client.
 */
function errorHandler(err, req, res, next) {          // eslint-disable-line no-unused-vars
  const statusCode = err.status || 500;
  console.error(`[ERROR] ${req.method} ${req.path} → ${statusCode}: ${err.message}`);

  // Never send db internals to the client
  const message =
    statusCode === 500
      ? 'An internal server error occurred. Please try again later.'
      : err.message;

  res.status(statusCode).json({ success: false, error: message });
}

/**
 * 404 handler — must come after all routes.
 */
function notFound(req, res) {
  res.status(404).json({ success: false, error: `Route not found: ${req.method} ${req.path}` });
}

module.exports = { errorHandler, notFound };
