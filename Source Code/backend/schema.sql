-- Smart Bin IoT Database Schema
-- MySQL 8.0+

-- Create database
CREATE DATABASE IF NOT EXISTS smartbin_iot CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE smartbin_iot;

-- Users table (for RFID authentication)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    rfid_uid VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100),
    role ENUM('admin', 'user') DEFAULT 'user',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_rfid (rfid_uid),
    INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bins table (smart bin devices)
CREATE TABLE IF NOT EXISTS bins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bin_id VARCHAR(50) UNIQUE NOT NULL COMMENT 'MQTT topic identifier e.g. BIN_01',
    name VARCHAR(100) NOT NULL,
    location VARCHAR(200),
    capacity_cm INT DEFAULT 200 COMMENT 'Total height in cm',
    mode ENUM('AUTO', 'AUTH') DEFAULT 'AUTO' COMMENT 'AUTO=proximity, AUTH=RFID required',
    threshold_cm INT DEFAULT 50 COMMENT 'Proximity threshold for AUTO mode',
    is_online BOOLEAN DEFAULT FALSE,
    last_seen TIMESTAMP NULL,
    current_level_percent INT DEFAULT 0,
    current_distance_cm INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_bin_id (bin_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Logs table (access logs and events)
CREATE TABLE IF NOT EXISTS logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bin_id VARCHAR(50) NOT NULL,
    event_type ENUM('rfid_scan', 'lid_open', 'lid_close', 'level_update', 'alert', 'config_change') NOT NULL,
    rfid_uid VARCHAR(50) NULL COMMENT 'If RFID event',
    user_name VARCHAR(100) NULL COMMENT 'Resolved user name',
    level_percent INT NULL COMMENT 'If level event',
    distance_cm INT NULL COMMENT 'If level event',
    success BOOLEAN DEFAULT TRUE,
    message TEXT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_bin_id (bin_id),
    INDEX idx_event_type (event_type),
    INDEX idx_timestamp (timestamp),
    INDEX idx_rfid (rfid_uid),
    FOREIGN KEY (bin_id) REFERENCES bins(bin_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert sample admin user
INSERT INTO users (rfid_uid, name, email, role, is_active) VALUES
('04A1B2C3D4E5F6', 'Admin User', 'admin@smartbin.local', 'admin', TRUE),
('A1B2C3D4', 'John Doe', 'john@example.com', 'user', TRUE),
('E5F6A7B8', 'Jane Smith', 'jane@example.com', 'user', TRUE);

-- Insert sample bin
INSERT INTO bins (bin_id, name, location, capacity_cm, mode, threshold_cm) VALUES
('BIN_01', 'Main Entrance Bin', 'Building A - Floor 1', 200, 'AUTO', 50),
('BIN_02', 'Cafeteria Bin', 'Building B - Cafeteria', 180, 'AUTH', 50);

-- Create view for latest bin status
CREATE OR REPLACE VIEW v_bin_status AS
SELECT 
    b.id,
    b.bin_id,
    b.name,
    b.location,
    b.capacity_cm,
    b.mode,
    b.threshold_cm,
    b.is_online,
    b.last_seen,
    b.current_level_percent,
    b.current_distance_cm,
    CASE 
        WHEN b.current_level_percent >= 80 THEN 'critical'
        WHEN b.current_level_percent >= 60 THEN 'warning'
        ELSE 'normal'
    END AS status,
    b.created_at,
    b.updated_at
FROM bins b;

-- Grant privileges (adjust user as needed)
-- GRANT ALL PRIVILEGES ON smartbin_iot.* TO 'root'@'localhost';
-- FLUSH PRIVILEGES;

SELECT 'Database schema created successfully!' AS message;
