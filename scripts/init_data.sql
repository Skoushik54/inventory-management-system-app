-- Admin user (username: admin, password: password123)
-- BCrypt hash for "password123": $2a$10$vU8L.2t6T6pA/YFvE.Y.eu0.6z5hNqV/Xy.t9L8U1.5h8.O.P.P.P (Example hash, replace with real bcrypt)

INSERT INTO admins (username, password_hash, failed_attempts, account_locked, created_at) 
VALUES ('admin', '$2a$10$8.UnVuG9HHgffUDAlk8qfOuVGkqRzgVymGe07xd00dm8eK861xq7O', 0, false, NOW());

-- Sample Officers
INSERT INTO officers (name, badge_number, department, phone, created_at)
VALUES ('John Doe', 'P12345', 'Workshop A', '555-0101', NOW());

INSERT INTO officers (name, badge_number, department, phone, created_at)
VALUES ('Jane Smith', 'P67890', 'Logistics', '555-0202', NOW());

-- Sample Products
INSERT INTO products (name, barcode, total_quantity, available_quantity, status, created_at)
VALUES ('Tactical Vest', 'TV001', 50, 50, 'ACTIVE', NOW());

INSERT INTO products (name, barcode, total_quantity, available_quantity, status, created_at)
VALUES ('Police Baton', 'PB505', 100, 100, 'ACTIVE', NOW());
