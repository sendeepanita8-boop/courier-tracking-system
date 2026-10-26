'use strict';

const { pool } = require('../db');

/**
 * GET /api/track/:trackingNumber
 * Public: returns shipment details + tracking history.
 */
async function trackShipment(req, res, next) {
  try {
    const { trackingNumber } = req.params;

    // Basic format validation
    if (!trackingNumber || trackingNumber.trim().length < 3) {
      return res.status(400).json({ success: false, error: 'Please provide a valid tracking number.' });
    }

    const tn = trackingNumber.trim().toUpperCase();

    // Fetch shipment details via view (INNER JOIN under the hood)
    const [shipments] = await pool.execute(
      `SELECT
        shipment_id, tracking_number, current_status, weight_kg,
        booking_date, expected_delivery, actual_delivery,
        sender_name, sender_address,
        receiver_name, receiver_address,
        courier_type, base_price, shipment_remarks
       FROM vw_shipment_details
       WHERE tracking_number = ?`,
      [tn]
    );

    if (shipments.length === 0) {
      return res.status(404).json({
        success: false,
        error: `No shipment found with tracking number "${tn}". Please check and try again.`
      });
    }

    const shipment = shipments[0];

    // Fetch full tracking history (chronological)
    const [history] = await pool.execute(
      `SELECT status, location, remarks, updated_at
       FROM tracking_history
       WHERE shipment_id = ?
       ORDER BY updated_at ASC`,
      [shipment.shipment_id]
    );

    res.json({
      success:  true,
      shipment: {
        tracking_number:   shipment.tracking_number,
        current_status:    shipment.current_status,
        courier_type:      shipment.courier_type,
        weight_kg:         shipment.weight_kg,
        booking_date:      shipment.booking_date,
        expected_delivery: shipment.expected_delivery,
        actual_delivery:   shipment.actual_delivery,
        remarks:           shipment.shipment_remarks,
        sender: {
          name:    shipment.sender_name,
          address: shipment.sender_address
        },
        receiver: {
          name:    shipment.receiver_name,
          address: shipment.receiver_address
        }
      },
      history
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { trackShipment };
