'use strict';

const express  = require('express');
const router   = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const { getDashboardStats } = require('../controllers/dashboardController');

// GET /api/dashboard/stats — admin only
router.get('/stats', requireAuth, getDashboardStats);

module.exports = router;
