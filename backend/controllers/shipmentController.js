'use strict';

const { pool } = require('../db');

// Valid statuses in progression order
const VALID_STATUSES = [
  'Booked', 'Picked Up', 'In Transit',
  'Out for Delivery', 'Delivered', 'Cancelled'
];

/** Generate a unique tracking number */
function generateTrackingNumber() {
  const year = new Date().getFullYear();
  const rand = Math.floor(10000 + Math.random() * 90000);
  return `CTS-${year}-${rand}`;
}

/** Validate required booking fields */
function validateBookingBody(body) {
  const errors = [];
  if (!body.sender_name?.trim())     errors.push('Sender name is required.');
  if (!body.sender_phone?.trim())    errors.push('Sender phone is required.');
  if (!body.receiver_name?.trim())   errors.push('Receiver name is required.');
  if (!body.receiver_phone?.trim())  errors.push('Receiver phone is required.');
  if (!body.weight_kg || isNaN(Number(body.weight_kg)) || Number(body.weight_kg) <= 0)
    errors.push('Weight must be a positive number.');
  if (!body.courier_type)            errors.push('Courier type is required.');
  return errors;
}

/**
 * POST /api/shipments
 * Public: create a new shipment booking.
 */
async function createShipment(req, res, next) {
  const conn = await pool.getConnection();
  try {
    const errors = validateBookingBody(req.body);
    if (errors.length) {
      conn.release();
      return res.status(400).json({ success: false, errors });
    }

    const {
      sender_name, sender_email, sender_phone, sender_address,
      receiver_name, receiver_phone, receiver_address,
      weight_kg, courier_type, expected_delivery
    } = req.body;

    await conn.beginTransaction();

    // Resolve courier type id
    const [types] = await conn.execute(
      'SELECT type_id FROM courier_types WHERE type_name = ?',
      [courier_type.trim()]
    );
    if (types.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(400).json({ success: false, error: 'Invalid courier type.' });
    }
    const type_id = types[0].type_id;

    // Upsert sender (use phone as unique identifier)
    let sender_id;
    const [existingSender] = await conn.execute(
      'SELECT customer_id FROM customers WHERE phone = ?',
      [sender_phone.trim()]
    );
    if (existingSender.length > 0) {
      sender_id = existingSender[0].customer_id;
    } else {
      const [sRes] = await conn.execute(
        'INSERT INTO customers (full_name, email, phone, address) VALUES (?, ?, ?, ?)',
        [sender_name.trim(), sender_email?.trim() || null, sender_phone.trim(), sender_address?.trim() || null]
      );
      sender_id = sRes.insertId;
    }

    // Upsert receiver
    let receiver_id;
    const [existingReceiver] = await conn.execute(
      'SELECT customer_id FROM customers WHERE phone = ?',
      [receiver_phone.trim()]
    );
    if (existingReceiver.length > 0) {
      receiver_id = existingReceiver[0].customer_id;
    } else {
      const [rRes] = await conn.execute(
        'INSERT INTO customers (full_name, phone, address) VALUES (?, ?, ?)',
        [receiver_name.trim(), receiver_phone.trim(), receiver_address?.trim() || null]
      );
      receiver_id = rRes.insertId;
    }

    // Generate unique tracking number (retry up to 5 times)
    let tracking_number;
    for (let i = 0; i < 5; i++) {
      const candidate = generateTrackingNumber();
      const [check] = await conn.execute(
        'SELECT shipment_id FROM shipments WHERE tracking_number = ?',
        [candidate]
      );
      if (check.length === 0) { tracking_number = candidate; break; }
    }
    if (!tracking_number) throw new Error('Failed to generate a unique tracking number.');

    // Insert shipment
    const [sRes] = await conn.execute(
      `INSERT INTO shipments
        (tracking_number, sender_id, receiver_id, type_id, weight_kg,
         current_status, expected_delivery)
       VALUES (?, ?, ?, ?, ?, 'Booked', ?)`,
      [
        tracking_number, sender_id, receiver_id, type_id,
        Number(weight_kg),
        expected_delivery || null
      ]
    );
    const shipment_id = sRes.insertId;

    // Insert initial tracking history
    await conn.execute(
      `INSERT INTO tracking_history (shipment_id, status, location, remarks)
       VALUES (?, 'Booked', 'Origin Hub', 'Shipment booked successfully')`,
      [shipment_id]
    );

    await conn.commit();
    conn.release();

    res.status(201).json({
      success: true,
      message: 'Shipment booked successfully!',
      tracking_number,
      shipment_id
    });
  } catch (err) {
    await conn.rollback().catch(() => {});
    conn.release();
    next(err);
  }
}

/**
 * GET /api/shipments
 * Admin only: list all shipments with pagination & filtering.
 */
async function listShipments(req, res, next) {
  try {
    const page     = Math.max(1, parseInt(req.query.page)  || 1);
    const limit    = Math.min(100, parseInt(req.query.limit) || 20);
    const offset   = (page - 1) * limit;
    const status   = req.query.status  || null;
    const search   = req.query.search  || null;

    let whereClause = '';
    const params = [];

    const conditions = [];
    if (status)  { conditions.push('current_status = ?');                     params.push(status); }
    if (search)  { conditions.push('(tracking_number LIKE ? OR receiver_name LIKE ?)');
                   params.push(`%${search}%`, `%${search}%`); }

    if (conditions.length) whereClause = 'WHERE ' + conditions.join(' AND ');

    const [rows] = await pool.execute(
      `SELECT shipment_id, tracking_number, current_status, weight_kg,
              booking_date, expected_delivery,
              sender_name, receiver_name, courier_type
       FROM vw_shipment_details
       ${whereClause}
       ORDER BY booking_date DESC
       LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) AS total FROM vw_shipment_details ${whereClause}`,
      params
    );

    res.json({
      success: true,
      data:    rows,
      pagination: { page, limit, total: Number(total), pages: Math.ceil(Number(total) / limit) }
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/shipments/:id/status
 * Admin only: update shipment status + insert tracking history.
 */
async function updateShipmentStatus(req, res, next) {
  const conn = await pool.getConnection();
  try {
    const shipment_id = parseInt(req.params.id);
    if (!shipment_id || isNaN(shipment_id)) {
      conn.release();
      return res.status(400).json({ success: false, error: 'Invalid shipment ID.' });
    }

    const { status, location, remarks } = req.body;
    if (!status || !VALID_STATUSES.includes(status)) {
      conn.release();
      return res.status(400).json({
        success: false,
        error:   `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}`
      });
    }

    await conn.beginTransaction();

    // Fetch current shipment
    const [rows] = await conn.execute(
      'SELECT shipment_id, current_status FROM shipments WHERE shipment_id = ?',
      [shipment_id]
    );
    if (rows.length === 0) {
      await conn.rollback();
      conn.release();
      return res.status(404).json({ success: false, error: 'Shipment not found.' });
    }

    const { current_status } = rows[0];
    if (current_status === 'Delivered' || current_status === 'Cancelled') {
      await conn.rollback();
      conn.release();
      return res.status(400).json({
        success: false,
        error:   `Cannot update a shipment that is already "${current_status}".`
      });
    }

    // Update shipment status
    const actualDelivery = status === 'Delivered' ? new Date() : null;
    await conn.execute(
      `UPDATE shipments
       SET current_status = ?, actual_delivery = COALESCE(?, actual_delivery)
       WHERE shipment_id = ?`,
      [status, actualDelivery, shipment_id]
    );

    // Insert tracking history entry
    await conn.execute(
      `INSERT INTO tracking_history (shipment_id, status, location, remarks)
       VALUES (?, ?, ?, ?)`,
      [shipment_id, status, location?.trim() || null, remarks?.trim() || null]
    );

    await conn.commit();
    conn.release();

    res.json({
      success: true,
      message: `Shipment status updated to "${status}".`
    });
  } catch (err) {
    await conn.rollback().catch(() => {});
    conn.release();
    next(err);
  }
}

/**
 * GET /api/shipments/:id
 * Admin only: get single shipment detail.
 */
async function getShipmentById(req, res, next) {
  try {
    const shipment_id = parseInt(req.params.id);
    if (!shipment_id || isNaN(shipment_id)) {
      return res.status(400).json({ success: false, error: 'Invalid shipment ID.' });
    }

    const [rows] = await pool.execute(
      'SELECT * FROM vw_shipment_details WHERE shipment_id = ?',
      [shipment_id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Shipment not found.' });
    }

    const [history] = await pool.execute(
      'SELECT status, location, remarks, updated_at FROM tracking_history WHERE shipment_id = ? ORDER BY updated_at ASC',
      [shipment_id]
    );

    res.json({ success: true, shipment: rows[0], history });
  } catch (err) {
    next(err);
  }
}

module.exports = { createShipment, listShipments, updateShipmentStatus, getShipmentById };
