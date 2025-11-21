/**
 * Database connection and query functions
 * Uses mysql2/promise for async/await support
 */

import mysql from 'mysql2/promise';
import config from './config.js';

let pool;

/**
 * Initialize database connection pool
 */
export async function initDB() {
  try {
    pool = mysql.createPool(config.mysql);
    
    // Test connection
    const connection = await pool.getConnection();
    console.log('✅ MySQL connected successfully');
    connection.release();
    
    return pool;
  } catch (error) {
    console.error('❌ MySQL connection error:', error.message);
    throw error;
  }
}

/**
 * Get user by RFID UID
 */
export async function getUserByRFID(rfidUid) {
  const [rows] = await pool.query(
    'SELECT * FROM users WHERE rfid_uid = ? AND is_active = TRUE',
    [rfidUid]
  );
  return rows[0] || null;
}

/**
 * Get bin by bin_id
 */
export async function getBinById(binId) {
  const [rows] = await pool.query(
    'SELECT * FROM bins WHERE bin_id = ?',
    [binId]
  );
  return rows[0] || null;
}

/**
 * Get all bins with status
 */
export async function getAllBins() {
  const [rows] = await pool.query(
    'SELECT * FROM v_bin_status ORDER BY bin_id'
  );
  return rows;
}

/**
 * Update bin online status
 */
export async function updateBinStatus(binId, isOnline) {
  await pool.query(
    'UPDATE bins SET is_online = ?, last_seen = NOW() WHERE bin_id = ?',
    [isOnline, binId]
  );
}

/**
 * Update bin level data
 */
export async function updateBinLevel(binId, levelPercent, distanceCm) {
  await pool.query(
    `UPDATE bins 
     SET current_level_percent = ?, 
         current_distance_cm = ?, 
         last_seen = NOW() 
     WHERE bin_id = ?`,
    [levelPercent, distanceCm, binId]
  );
}

/**
 * Update bin configuration
 */
export async function updateBinConfig(binId, updates) {
  const allowedFields = ['mode', 'threshold_cm', 'capacity_cm', 'name', 'location'];
  const setClause = [];
  const values = [];

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      setClause.push(`${key} = ?`);
      values.push(value);
    }
  }

  if (setClause.length === 0) {
    throw new Error('No valid fields to update');
  }

  values.push(binId);
  
  const [result] = await pool.query(
    `UPDATE bins SET ${setClause.join(', ')}, updated_at = NOW() WHERE bin_id = ?`,
    values
  );

  return result.affectedRows > 0;
}

/**
 * Log an event
 */
export async function logEvent(binId, eventType, data = {}) {
  const {
    rfidUid = null,
    userName = null,
    levelPercent = null,
    distanceCm = null,
    success = true,
    message = null
  } = data;

  await pool.query(
    `INSERT INTO logs 
     (bin_id, event_type, rfid_uid, user_name, level_percent, distance_cm, success, message) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [binId, eventType, rfidUid, userName, levelPercent, distanceCm, success, message]
  );
}

/**
 * Get logs for a bin with pagination
 */
export async function getLogs(binId = null, limit = 100, offset = 0) {
  let query = `
    SELECT 
      l.*,
      DATE_FORMAT(l.timestamp, '%Y-%m-%d %H:%i:%s') as formatted_time
    FROM logs l
  `;
  const params = [];

  if (binId) {
    query += ' WHERE l.bin_id = ?';
    params.push(binId);
  }

  query += ' ORDER BY l.timestamp DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const [rows] = await pool.query(query, params);
  return rows;
}

/**
 * Close database connection
 */
export async function closeDB() {
  if (pool) {
    await pool.end();
    console.log('MySQL connection pool closed');
  }
}

export default {
  initDB,
  getUserByRFID,
  getBinById,
  getAllBins,
  updateBinStatus,
  updateBinLevel,
  updateBinConfig,
  logEvent,
  getLogs,
  closeDB
};
