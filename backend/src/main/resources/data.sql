-- Admin user (username: admin, password: password123)
-- BCrypt hash for "password123"
INSERT INTO admins (username, password_hash, failed_attempts, account_locked, created_at) 
VALUES ('admin', 'password123', 0, false, CURRENT_TIMESTAMP);

-- Sample Officers
INSERT INTO officers (name, badge_number, department, phone, created_at)
VALUES ('John Doe', 'P12345', 'Workshop A', '555-0101', CURRENT_TIMESTAMP);

INSERT INTO officers (name, badge_number, department, phone, created_at)
VALUES ('Jane Smith', 'P67890', 'Logistics', '555-0202', CURRENT_TIMESTAMP);

-- Sample Products
INSERT INTO products (name, barcode, total_quantity, available_quantity, status, created_at)
VALUES ('Tactical Vest', 'TV001', 50, 50, 'ACTIVE', CURRENT_TIMESTAMP);

INSERT INTO products (name, barcode, total_quantity, available_quantity, status, created_at)
VALUES ('Police Baton', 'PB505', 100, 100, 'ACTIVE', CURRENT_TIMESTAMP);
