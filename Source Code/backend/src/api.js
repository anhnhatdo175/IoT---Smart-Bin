/**
 * REST API Routes
 * Express router for bin management and monitoring
 */

import express from 'express';
import jwt from 'jsonwebtoken';
import config from './config.js';
import * as db from './db.js';
import * as mqttClient from './mqttClient.js';

const router = express.Router();

/**
 * Middleware: Simple JWT authentication
 * For demo purposes - in production, implement proper user auth
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, config.jwt.secret, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

/**
 * POST /api/auth/login
 * Demo login endpoint - returns JWT
 * In production: verify actual credentials
 */
router.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // DEMO ONLY: Accept admin/admin123
    if (username === 'admin' && password === 'admin123') {
      const token = jwt.sign(
        { username: 'admin', role: 'admin' },
        config.jwt.secret,
        { expiresIn: config.jwt.expiresIn }
      );

      return res.json({
        success: true,
        token,
        user: { username: 'admin', role: 'admin' }
      });
    }

    res.status(401).json({ error: 'Invalid credentials' });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * GET /api/bins
 * Get all bins with current status
 */
router.get('/bins', async (req, res) => {
  try {
    const bins = await db.getAllBins();
    res.json({ success: true, data: bins });
  } catch (error) {
    console.error('Error fetching bins:', error);
    res.status(500).json({ error: 'Failed to fetch bins' });
  }
});

/**
 * GET /api/bins/:id
 * Get specific bin details
 */
router.get('/bins/:id', async (req, res) => {
  try {
    const bin = await db.getBinById(req.params.id);
    
    if (!bin) {
      return res.status(404).json({ error: 'Bin not found' });
    }

    res.json({ success: true, data: bin });
  } catch (error) {
    console.error('Error fetching bin:', error);
    res.status(500).json({ error: 'Failed to fetch bin' });
  }
});

/**
 * PUT /api/bins/:id/config
 * Update bin configuration (no auth for demo)
 */
router.put('/bins/:id/config', async (req, res) => {
  try {
    const binId = req.params.id;
    const { mode, threshold_cm, capacity_cm, name, location } = req.body;

    // Validate bin exists
    const bin = await db.getBinById(binId);
    if (!bin) {
      return res.status(404).json({ error: 'Bin not found' });
    }

    // Validate mode
    if (mode && !['AUTO', 'AUTH'].includes(mode)) {
      return res.status(400).json({ error: 'Invalid mode. Must be AUTO or AUTH' });
    }

    // Prepare updates
    const updates = {};
    if (mode) updates.mode = mode;
    if (threshold_cm !== undefined) updates.threshold_cm = threshold_cm;
    if (capacity_cm !== undefined) updates.capacity_cm = capacity_cm;
    if (name) updates.name = name;
    if (location) updates.location = location;

    // Update database
    await db.updateBinConfig(binId, updates);

    // Publish config to device via MQTT
    const updatedBin = await db.getBinById(binId);
    mqttClient.publishConfig(binId, updatedBin);

    // Log the change
    await db.logEvent(binId, 'config_change', {
      message: `Configuration updated`,
      success: true
    });

    console.log(`⚙️  ${binId} config updated:`, updates);

    res.json({
      success: true,
      message: 'Configuration updated',
      data: updatedBin
    });
  } catch (error) {
    console.error('Error updating bin config:', error);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

/**
 * POST /api/bins/:id/command
 * Send command to bin (no auth for demo)
 */
router.post('/bins/:id/command', async (req, res) => {
  try {
    const binId = req.params.id;
    const { action } = req.body;

    if (!['open', 'close'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action. Must be "open" or "close"' });
    }

    // Validate bin exists
    const bin = await db.getBinById(binId);
    if (!bin) {
      return res.status(404).json({ error: 'Bin not found' });
    }

    // Publish command
    mqttClient.publishCommand(binId, {
      action,
      reason: 'manual_control',
      user: 'admin',
      ts: new Date().toISOString()
    });

    // Log the command
    await db.logEvent(binId, action === 'open' ? 'lid_open' : 'lid_close', {
      message: `Manual ${action}`,
      success: true
    });

    res.json({
      success: true,
      message: `Command "${action}" sent to ${binId}`
    });
  } catch (error) {
    console.error('Error sending command:', error);
    res.status(500).json({ error: 'Failed to send command' });
  }
});

/**
 * GET /api/logs
 * Get event logs with optional bin filter
 */
router.get('/logs', async (req, res) => {
  try {
    const binId = req.query.bin || null;
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    const logs = await db.getLogs(binId, limit, offset);

    res.json({
      success: true,
      data: logs,
      pagination: {
        limit,
        offset,
        count: logs.length
      }
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

/**
 * GET /api/users/:rfid
 * Check if RFID is authorized (for testing)
 */
router.get('/users/:rfid', async (req, res) => {
  try {
    const user = await db.getUserByRFID(req.params.rfid);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

export default router;
