/**
 * Smart Bin IoT Backend Server
 * Main entry point - Express + MQTT + MySQL
 */

import express from 'express';
import cors from 'cors';
import config from './config.js';
import * as db from './db.js';
import * as mqttClient from './mqttClient.js';
import apiRouter from './api.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// API routes
app.use('/api', apiRouter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Smart Bin IoT Backend',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/api/health',
      bins: '/api/bins',
      logs: '/api/logs',
      login: '/api/auth/login'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

/**
 * Initialize all services and start server
 */
async function startServer() {
  try {
    console.log('🚀 Starting Smart Bin Backend...\n');

    // 1. Initialize Database
    console.log('📦 Initializing database...');
    await db.initDB();

    // 2. Initialize MQTT
    console.log('\n📡 Initializing MQTT client...');
    await mqttClient.initMQTT();

    // 3. Start Express server
    console.log(`\n🌐 Starting HTTP server on port ${config.port}...`);
    app.listen(config.port, () => {
      console.log(`✅ Server running on http://localhost:${config.port}`);
      console.log(`\n📋 API Endpoints:`);
      console.log(`   - Health Check: http://localhost:${config.port}/api/health`);
      console.log(`   - Get Bins: http://localhost:${config.port}/api/bins`);
      console.log(`   - Get Logs: http://localhost:${config.port}/api/logs`);
      console.log(`\n💡 Demo Login Credentials:`);
      console.log(`   - Username: admin`);
      console.log(`   - Password: admin123`);
      console.log(`\n🔧 MQTT Broker: ${config.mqtt.brokerUrl}`);
      console.log(`📊 Database: ${config.mysql.database}@${config.mysql.host}`);
      console.log(`\n✨ Backend is ready! Press Ctrl+C to stop.\n`);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

/**
 * Graceful shutdown
 */
async function shutdown() {
  console.log('\n\n🛑 Shutting down gracefully...');
  
  try {
    mqttClient.closeMQTT();
    await db.closeDB();
    console.log('✅ Cleanup complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start the server
startServer();
