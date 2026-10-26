-- ============================================================
-- COURIER TRACKING SYSTEM - Complete Database Schema
-- RDBMS College Project
-- Database: MySQL 8.0
-- ============================================================

-- Create and select database
CREATE DATABASE IF NOT EXISTS courier_tracking
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE courier_tracking;

-- ============================================================
-- TABLE 1: customers
-- Stores sender and receiver contact details (1NF, 2NF, 3NF)
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  customer_id    INT            NOT NULL AUTO_INCREMENT,
  full_name      VARCHAR(100)   NOT NULL,
  email          VARCHAR(150)   NULL,
  phone          VARCHAR(20)    NOT NULL,
  address        TEXT           NULL,
  created_at     DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (customer_id),
  UNIQUE KEY uq_customer_phone (phone)
) ENGINE=InnoDB;

-- ============================================================
-- TABLE 2: courier_types
-- Reference table: Standard, Express, etc.
-- ============================================================
CREATE TABLE IF NOT EXISTS courier_types (
  type_id         INT           NOT NULL AUTO_INCREMENT,
  type_name       VARCHAR(50)   NOT NULL,
  description     VARCHAR(255)  NULL,
  base_price      DECIMAL(8,2)  NOT NULL DEFAULT 0.00,
  PRIMARY KEY (type_id),
  UNIQUE KEY uq_type_name (type_name)
) ENGINE=InnoDB;

-- Seed courier types
INSERT IGNORE INTO courier_types (type_name, description, base_price) VALUES
  ('Standard', 'Delivered in 5-7 business days', 50.00),
  ('Express',  'Delivered in 1-2 business days', 150.00),
  ('Overnight','Next business day delivery',      250.00);

-- ============================================================
-- TABLE 3: shipments
-- Core shipment/booking record
-- Foreign keys → customers (sender & receiver), courier_types
-- ============================================================
CREATE TABLE IF NOT EXISTS shipments (
  shipment_id         INT           NOT NULL AUTO_INCREMENT,
  tracking_number     VARCHAR(20)   NOT NULL,
  sender_id           INT           NOT NULL,
  receiver_id         INT           NOT NULL,
  type_id             INT           NOT NULL,
  weight_kg           DECIMAL(6,2)  NOT NULL,
  current_status      ENUM(
    'Booked','Picked Up','In Transit',
    'Out for Delivery','Delivered','Cancelled'
  ) NOT NULL DEFAULT 'Booked',
  booking_date        DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expected_delivery   DATE          NULL,
  actual_delivery     DATETIME      NULL,
  remarks             TEXT          NULL,
  PRIMARY KEY (shipment_id),
  UNIQUE KEY uq_tracking_number (tracking_number),
  CONSTRAINT fk_shipment_sender
    FOREIGN KEY (sender_id)   REFERENCES customers(customer_id),
  CONSTRAINT fk_shipment_receiver
    FOREIGN KEY (receiver_id) REFERENCES customers(customer_id),
  CONSTRAINT fk_shipment_type
    FOREIGN KEY (type_id)     REFERENCES courier_types(type_id),
  INDEX idx_current_status  (current_status),
  INDEX idx_booking_date    (booking_date)
) ENGINE=InnoDB;

-- ============================================================
-- TABLE 4: tracking_history
-- One shipment → many history events (1-to-many)
-- ============================================================
CREATE TABLE IF NOT EXISTS tracking_history (
  history_id      INT           NOT NULL AUTO_INCREMENT,
  shipment_id     INT           NOT NULL,
  status          ENUM(
    'Booked','Picked Up','In Transit',
    'Out for Delivery','Delivered','Cancelled'
  ) NOT NULL,
  location        VARCHAR(200)  NULL,
  remarks         TEXT          NULL,
  updated_at      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (history_id),
  CONSTRAINT fk_history_shipment
    FOREIGN KEY (shipment_id) REFERENCES shipments(shipment_id)
    ON DELETE CASCADE,
  INDEX idx_history_shipment (shipment_id),
  INDEX idx_history_updated  (updated_at)
) ENGINE=InnoDB;

-- ============================================================
-- TABLE 5: admins
-- Separate admin accounts (no hardcoded passwords in code)
-- Passwords stored as bcrypt hashes
-- ============================================================
CREATE TABLE IF NOT EXISTS admins (
  admin_id      INT           NOT NULL AUTO_INCREMENT,
  username      VARCHAR(50)   NOT NULL,
  password_hash VARCHAR(255)  NOT NULL,
  full_name     VARCHAR(100)  NULL,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login    DATETIME      NULL,
  is_active     TINYINT(1)    NOT NULL DEFAULT 1,
  PRIMARY KEY (admin_id),
  UNIQUE KEY uq_admin_username (username)
) ENGINE=InnoDB;

-- ============================================================
-- VIEWS
-- ============================================================

-- View 1: Full shipment details (INNER JOIN + LEFT JOIN)
CREATE OR REPLACE VIEW vw_shipment_details AS
SELECT
  s.shipment_id,
  s.tracking_number,
  s.current_status,
  s.weight_kg,
  s.booking_date,
  s.expected_delivery,
  s.actual_delivery,
  s.remarks AS shipment_remarks,
  -- Sender info
  sen.customer_id  AS sender_id,
  sen.full_name    AS sender_name,
  sen.email        AS sender_email,
  sen.phone        AS sender_phone,
  sen.address      AS sender_address,
  -- Receiver info
  rec.customer_id  AS receiver_id,
  rec.full_name    AS receiver_name,
  rec.phone        AS receiver_phone,
  rec.address      AS receiver_address,
  -- Courier type
  ct.type_name     AS courier_type,
  ct.base_price
FROM shipments s
  INNER JOIN customers  sen ON s.sender_id   = sen.customer_id
  INNER JOIN customers  rec ON s.receiver_id = rec.customer_id
  INNER JOIN courier_types ct ON s.type_id   = ct.type_id;

-- View 2: Active (non-delivered, non-cancelled) shipments
CREATE OR REPLACE VIEW vw_active_shipments AS
SELECT *
FROM vw_shipment_details
WHERE current_status NOT IN ('Delivered', 'Cancelled');

-- View 3: Dashboard statistics
CREATE OR REPLACE VIEW vw_dashboard_stats AS
SELECT
  COUNT(*)                                                       AS total_shipments,
  SUM(current_status = 'Delivered')                             AS delivered,
  SUM(current_status IN ('Booked','Picked Up','In Transit',
                         'Out for Delivery'))                   AS in_progress,
  SUM(current_status = 'Cancelled')                             AS cancelled,
  SUM(current_status = 'Booked')                                AS booked,
  SUM(current_status = 'In Transit')                            AS in_transit,
  SUM(current_status = 'Out for Delivery')                      AS out_for_delivery
FROM shipments;

-- View 4: Shipments per courier type (GROUP BY + COUNT)
CREATE OR REPLACE VIEW vw_shipments_by_type AS
SELECT
  ct.type_name,
  COUNT(s.shipment_id)  AS total_shipments,
  AVG(s.weight_kg)      AS avg_weight_kg,
  SUM(ct.base_price)    AS total_revenue
FROM courier_types ct
  LEFT JOIN shipments s ON ct.type_id = s.type_id
GROUP BY ct.type_id, ct.type_name;

-- View 5: Latest tracking event per shipment
CREATE OR REPLACE VIEW vw_latest_tracking AS
SELECT
  th.shipment_id,
  th.status    AS latest_status,
  th.location  AS latest_location,
  th.remarks   AS latest_remarks,
  th.updated_at AS latest_update
FROM tracking_history th
INNER JOIN (
  SELECT shipment_id, MAX(updated_at) AS max_time
  FROM tracking_history
  GROUP BY shipment_id
) latest ON th.shipment_id = latest.shipment_id
        AND th.updated_at  = latest.max_time;

-- ============================================================
-- SAMPLE DATA (safe to insert — uses INSERT IGNORE)
-- ============================================================
INSERT IGNORE INTO customers (full_name, email, phone, address) VALUES
  ('Arjun Sharma',  'arjun@example.com',  '9876543210', '12 MG Road, Bangalore 560001'),
  ('Priya Patel',   'priya@example.com',  '9876543211', '45 Linking Road, Mumbai 400050'),
  ('Rahul Gupta',   'rahul@example.com',  '9876543212', '78 Park Street, Kolkata 700016'),
  ('Sneha Reddy',   'sneha@example.com',  '9876543213', '23 Anna Salai, Chennai 600002'),
  ('Vikram Singh',  'vikram@example.com', '9876543214', '5 Connaught Place, Delhi 110001');

INSERT IGNORE INTO shipments
  (tracking_number, sender_id, receiver_id, type_id, weight_kg,
   current_status, expected_delivery)
VALUES
  ('CTS-2024-00001', 1, 2, 1, 2.50, 'Delivered',    DATE_ADD(CURDATE(), INTERVAL -2  DAY)),
  ('CTS-2024-00002', 3, 4, 2, 0.75, 'In Transit',   DATE_ADD(CURDATE(), INTERVAL  1  DAY)),
  ('CTS-2024-00003', 5, 1, 1, 5.00, 'Booked',       DATE_ADD(CURDATE(), INTERVAL  5  DAY)),
  ('CTS-2024-00004', 2, 5, 3, 1.20, 'Out for Delivery', CURDATE()),
  ('CTS-2024-00005', 4, 3, 2, 3.80, 'Picked Up',    DATE_ADD(CURDATE(), INTERVAL  2  DAY));

INSERT IGNORE INTO tracking_history (shipment_id, status, location, remarks) VALUES
  (1,'Booked',          'Bangalore Hub',    'Shipment booked successfully'),
  (1,'Picked Up',       'Bangalore Hub',    'Parcel collected from sender'),
  (1,'In Transit',      'Mumbai Transit',   'In transit to destination city'),
  (1,'Out for Delivery','Mumbai Central',   'Out for delivery'),
  (1,'Delivered',       'Mumbai Doorstep',  'Delivered successfully'),
  (2,'Booked',          'Kolkata Hub',      'Shipment booked'),
  (2,'Picked Up',       'Kolkata Hub',      'Picked up from sender'),
  (2,'In Transit',      'Hyderabad Transit','In transit'),
  (3,'Booked',          'Delhi Hub',        'Shipment booked'),
  (4,'Booked',          'Mumbai Hub',       'Shipment booked'),
  (4,'Picked Up',       'Mumbai Hub',       'Picked up'),
  (4,'In Transit',      'Kolkata Transit',  'In transit'),
  (4,'Out for Delivery','Kolkata Central',  'Out for last-mile delivery'),
  (5,'Booked',          'Chennai Hub',      'Shipment booked'),
  (5,'Picked Up',       'Chennai Hub',      'Picked up from sender');
