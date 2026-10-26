-- ============================================================
-- COURIER TRACKING SYSTEM – RDBMS Reporting & Demo Queries
-- Run these in MySQL Workbench to demonstrate RDBMS concepts
-- ============================================================

USE courier_tracking;

-- ─────────────────────────────────────────────────
-- 1. BASIC SELECT — all shipments
-- ─────────────────────────────────────────────────
SELECT * FROM shipments;

-- ─────────────────────────────────────────────────
-- 2. INNER JOIN — shipment + sender + receiver + type
-- ─────────────────────────────────────────────────
SELECT
  s.tracking_number,
  s.current_status,
  sen.full_name   AS sender,
  rec.full_name   AS receiver,
  ct.type_name    AS courier_type,
  s.weight_kg,
  s.booking_date
FROM shipments s
  INNER JOIN customers    sen ON s.sender_id   = sen.customer_id
  INNER JOIN customers    rec ON s.receiver_id = rec.customer_id
  INNER JOIN courier_types ct  ON s.type_id    = ct.type_id
ORDER BY s.booking_date DESC;

-- ─────────────────────────────────────────────────
-- 3. LEFT JOIN — all customers even without shipments
-- ─────────────────────────────────────────────────
SELECT
  c.full_name,
  c.phone,
  COUNT(s.shipment_id) AS shipments_sent
FROM customers c
  LEFT JOIN shipments s ON c.customer_id = s.sender_id
GROUP BY c.customer_id, c.full_name, c.phone
ORDER BY shipments_sent DESC;

-- ─────────────────────────────────────────────────
-- 4. WHERE + ORDER BY — active shipments
-- ─────────────────────────────────────────────────
SELECT tracking_number, current_status, booking_date, expected_delivery
FROM shipments
WHERE current_status NOT IN ('Delivered','Cancelled')
ORDER BY expected_delivery ASC;

-- ─────────────────────────────────────────────────
-- 5. GROUP BY + COUNT + HAVING — customers with >1 shipment
-- ─────────────────────────────────────────────────
SELECT
  c.full_name,
  COUNT(s.shipment_id) AS total_sent
FROM customers c
  INNER JOIN shipments s ON c.customer_id = s.sender_id
GROUP BY c.customer_id, c.full_name
HAVING COUNT(s.shipment_id) >= 1
ORDER BY total_sent DESC;

-- ─────────────────────────────────────────────────
-- 6. AGGREGATE FUNCTIONS — dashboard stats
-- ─────────────────────────────────────────────────
SELECT
  COUNT(*)                                       AS total,
  SUM(current_status = 'Delivered')             AS delivered,
  SUM(current_status = 'In Transit')            AS in_transit,
  SUM(current_status = 'Booked')                AS booked,
  SUM(current_status = 'Cancelled')             AS cancelled,
  AVG(weight_kg)                                AS avg_weight_kg,
  MAX(weight_kg)                                AS heaviest_parcel_kg,
  MIN(weight_kg)                                AS lightest_parcel_kg
FROM shipments;

-- ─────────────────────────────────────────────────
-- 7. SUBQUERY — shipments heavier than average
-- ─────────────────────────────────────────────────
SELECT tracking_number, weight_kg, current_status
FROM shipments
WHERE weight_kg > (SELECT AVG(weight_kg) FROM shipments)
ORDER BY weight_kg DESC;

-- ─────────────────────────────────────────────────
-- 8. TRACKING HISTORY timeline for one shipment
-- ─────────────────────────────────────────────────
SELECT
  th.status,
  th.location,
  th.remarks,
  th.updated_at
FROM tracking_history th
  INNER JOIN shipments s ON th.shipment_id = s.shipment_id
WHERE s.tracking_number = 'CTS-2024-00001'
ORDER BY th.updated_at ASC;

-- ─────────────────────────────────────────────────
-- 9. USE ALL VIEWS
-- ─────────────────────────────────────────────────
SELECT * FROM vw_shipment_details;
SELECT * FROM vw_active_shipments;
SELECT * FROM vw_dashboard_stats;
SELECT * FROM vw_shipments_by_type;
SELECT * FROM vw_latest_tracking;

-- ─────────────────────────────────────────────────
-- 10. REFERENTIAL INTEGRITY CHECK
-- ─────────────────────────────────────────────────
-- Shows all FK constraints in courier_tracking
SELECT
  TABLE_NAME,
  COLUMN_NAME,
  CONSTRAINT_NAME,
  REFERENCED_TABLE_NAME,
  REFERENCED_COLUMN_NAME
FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
WHERE TABLE_SCHEMA = 'courier_tracking'
  AND REFERENCED_TABLE_NAME IS NOT NULL;

-- ─────────────────────────────────────────────────
-- 11. NORMALIZATION PROOF — no repeating groups (1NF)
--     each column is atomic; no multi-valued attributes
-- ─────────────────────────────────────────────────
DESCRIBE customers;
DESCRIBE shipments;
DESCRIBE tracking_history;

-- ─────────────────────────────────────────────────
-- 12. Revenue by courier type (GROUP BY + SUM)
-- ─────────────────────────────────────────────────
SELECT
  ct.type_name,
  COUNT(s.shipment_id)         AS total_bookings,
  SUM(ct.base_price)           AS total_revenue,
  AVG(s.weight_kg)             AS avg_weight
FROM courier_types ct
  LEFT JOIN shipments s ON ct.type_id = s.type_id
GROUP BY ct.type_id, ct.type_name
ORDER BY total_revenue DESC;
