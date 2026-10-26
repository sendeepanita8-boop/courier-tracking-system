'use strict';

const express  = require('express');
const router   = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const {
  createShipment,
  listShipments,
  updateShipmentStatus,
  getShipmentById
} = require('../controllers/shipmentController');

// Public: book a shipment
router.post('/',   createShipment);

// Admin only: list all shipments
router.get('/',    requireAuth, listShipments);

// Admin only: get one shipment
router.get('/:id', requireAuth, getShipmentById);

// Admin only: update status (PATCH + transaction)
router.patch('/:id/status', requireAuth, updateShipmentStatus);

module.exports = router;
