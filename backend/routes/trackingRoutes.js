'use strict';

const express  = require('express');
const router   = express.Router();
const { trackShipment } = require('../controllers/trackingController');

// GET /api/track/:trackingNumber
router.get('/:trackingNumber', trackShipment);

module.exports = router;
