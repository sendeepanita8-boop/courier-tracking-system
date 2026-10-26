'use strict';

const express  = require('express');
const router   = express.Router();
const rateLimit = require('express-rate-limit');
const { login, logout, me } = require('../controllers/authController');

// Limit login attempts: 10 per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      10,
  message:  { success: false, error: 'Too many login attempts. Try again in 15 minutes.' }
});

router.post('/login',  loginLimiter, login);
router.post('/logout', logout);
router.get('/me',      me);

module.exports = router;
