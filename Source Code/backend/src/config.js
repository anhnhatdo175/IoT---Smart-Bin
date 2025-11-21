/**
 * Configuration management
 * Loads environment variables and exports config object
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../.env') });

const config = {
  // Server
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // MQTT
  mqtt: {
    brokerUrl: process.env.MQTT_BROKER_URL || 'mqtt://broker.hivemq.com:1883',
    clientId: `smartbin_backend_${Math.random().toString(16).slice(2, 8)}`,
    options: {
      clean: true,
      connectTimeout: 4000,
      reconnectPeriod: 1000,
    }
  },

  // MySQL
  mysql: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASS || '',
    database: process.env.MYSQL_DB || 'smartbin_iot',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
    expiresIn: '24h'
  },

  // Admin
  adminUid: process.env.ADMIN_UID || '04A1B2C3D4E5F6'
};

export default config;
