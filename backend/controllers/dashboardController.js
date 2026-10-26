'use strict';

const { pool } = require('../db');

/**
 * GET /api/dashboard/stats
 * Admin only: returns summary counts from vw_dashboard_stats.
 */
async function getDashboardStats(req, res, next) {
  try {
    const [[stats]] = await pool.execute('SELECT * FROM vw_dashboard_stats');
    const [recentRows] = await pool.execute(
      `SELECT shipment_id, tracking_number, current_status, booking_date,
              receiver_name, courier_type
       FROM vw_shipment_details
       ORDER BY booking_date DESC
       LIMIT 5`
    );
    const [typeRows] = await pool.execute('SELECT * FROM vw_shipments_by_type');

    res.json({
      success: true,
      stats:   {
        total_shipments:  Number(stats.total_shipments),
        delivered:        Number(stats.delivered),
        in_progress:      Number(stats.in_progress),
        cancelled:        Number(stats.cancelled),
        booked:           Number(stats.booked),
        in_transit:       Number(stats.in_transit),
        out_for_delivery: Number(stats.out_for_delivery)
      },
      recent_shipments:  recentRows,
      by_courier_type:   typeRows
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getDashboardStats };
