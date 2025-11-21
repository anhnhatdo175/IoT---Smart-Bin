/**
 * MQTT Client for Smart Bin Backend
 * Handles pub/sub with IoT devices and business logic
 */

import mqtt from 'mqtt';
import config from './config.js';
import * as db from './db.js';

let client;

/**
 * Initialize MQTT connection and subscriptions
 */
export async function initMQTT() {
  return new Promise((resolve, reject) => {
    console.log(`🔌 Connecting to MQTT broker: ${config.mqtt.brokerUrl}`);
    
    client = mqtt.connect(config.mqtt.brokerUrl, {
      ...config.mqtt.options,
      clientId: config.mqtt.clientId,
    });

    client.on('connect', () => {
      console.log('✅ MQTT connected successfully');
      console.log(`📡 Client ID: ${config.mqtt.clientId}`);

      // Subscribe to all bin topics using wildcards
      const topics = [
        'smartbin/+/data/level',      // Level telemetry (QoS 0)
        'smartbin/+/rfid_check',      // RFID authentication (QoS 1)
        'smartbin/+/status'           // Device status/LWT (QoS 1)
      ];

      topics.forEach(topic => {
        const qos = topic.includes('data/level') ? 0 : 1;
        client.subscribe(topic, { qos }, (err) => {
          if (err) {
            console.error(`❌ Subscribe error for ${topic}:`, err.message);
          } else {
            console.log(`📥 Subscribed to: ${topic} (QoS ${qos})`);
          }
        });
      });

      resolve(client);
    });

    client.on('error', (err) => {
      console.error('❌ MQTT error:', err.message);
      reject(err);
    });

    client.on('offline', () => {
      console.log('⚠️  MQTT client offline');
    });

    client.on('reconnect', () => {
      console.log('🔄 MQTT reconnecting...');
    });

    client.on('message', handleMessage);
  });
}

/**
 * Handle incoming MQTT messages
 */
async function handleMessage(topic, message) {
  try {
    const parts = topic.split('/');
    
    if (parts.length < 3) {
      console.warn('⚠️  Invalid topic format:', topic);
      return;
    }

    const binId = parts[1];
    const messageType = parts[2];

    // Parse JSON payload
    let payload;
    try {
      payload = JSON.parse(message.toString());
    } catch (e) {
      console.error('❌ Invalid JSON payload:', message.toString());
      return;
    }

    console.log(`📨 Received [${topic}]:`, payload);

    // Route to appropriate handler
    switch (messageType) {
      case 'data':
        if (parts[3] === 'level') {
          await handleLevelData(binId, payload);
        }
        break;
      
      case 'rfid_check':
        await handleRFIDCheck(binId, payload);
        break;
      
      case 'status':
        await handleStatusUpdate(binId, message.toString());
        break;
      
      default:
        console.warn('⚠️  Unknown message type:', messageType);
    }
  } catch (error) {
    console.error('❌ Error handling message:', error.message);
  }
}

/**
 * Handle level telemetry data
 */
async function handleLevelData(binId, payload) {
  const { level, cm, ts } = payload;

  if (typeof level !== 'number' || typeof cm !== 'number') {
    console.warn('⚠️  Invalid level data format');
    return;
  }

  // Update database
  await db.updateBinLevel(binId, level, cm);
  
  // Log event (only log significant changes to avoid spam)
  if (level >= 80) {
    await db.logEvent(binId, 'level_update', {
      levelPercent: level,
      distanceCm: cm,
      message: 'Bin is nearly full!'
    });

    // Send alert
    publishAlert(binId, {
      type: 'full_warning',
      level: level,
      message: `Bin ${binId} is ${level}% full`,
      ts: new Date().toISOString()
    });
  }

  console.log(`📊 ${binId}: Level ${level}% (${cm}cm) at ${ts}`);
}

/**
 * Handle RFID check request
 */
async function handleRFIDCheck(binId, payload) {
  const { uid, ts } = payload;

  if (!uid) {
    console.warn('⚠️  No UID in RFID check');
    return;
  }

  console.log(`🔐 RFID check for ${binId}: UID=${uid}`);

  // Check bin configuration
  const bin = await db.getBinById(binId);
  if (!bin) {
    console.error(`❌ Bin not found: ${binId}`);
    return;
  }

  // Look up user
  const user = await db.getUserByRFID(uid);

  if (user) {
    // Authorized
    console.log(`✅ Access granted: ${user.name} (${user.role})`);
    
    await db.logEvent(binId, 'rfid_scan', {
      rfidUid: uid,
      userName: user.name,
      success: true,
      message: `Access granted for ${user.name}`
    });

    // Send open command to device
    publishCommand(binId, {
      action: 'open',
      reason: 'rfid_authorized',
      user: user.name,
      ts: new Date().toISOString()
    });

  } else {
    // Unauthorized
    console.log(`❌ Access denied: Unknown UID ${uid}`);
    
    await db.logEvent(binId, 'rfid_scan', {
      rfidUid: uid,
      success: false,
      message: 'Access denied: Unknown RFID'
    });

    // Send alert
    publishAlert(binId, {
      type: 'unauthorized_access',
      uid: uid,
      message: `Unauthorized RFID attempt: ${uid}`,
      ts: new Date().toISOString()
    });
  }
}

/**
 * Handle device status updates (LWT)
 */
async function handleStatusUpdate(binId, status) {
  const isOnline = status === 'online';
  
  await db.updateBinStatus(binId, isOnline);
  
  console.log(`📡 ${binId} is now ${status}`);
  
  await db.logEvent(binId, 'alert', {
    message: `Device ${isOnline ? 'connected' : 'disconnected'}`,
    success: isOnline
  });
}

/**
 * Publish command to device
 */
export function publishCommand(binId, command) {
  const topic = `smartbin/${binId}/cmd`;
  const payload = JSON.stringify(command);
  
  client.publish(topic, payload, { qos: 1 }, (err) => {
    if (err) {
      console.error(`❌ Failed to publish command to ${topic}:`, err.message);
    } else {
      console.log(`📤 Published command to ${topic}:`, command);
    }
  });
}

/**
 * Publish alert
 */
export function publishAlert(binId, alert) {
  const topic = `smartbin/${binId}/alert`;
  const payload = JSON.stringify(alert);
  
  client.publish(topic, payload, { qos: 1 }, (err) => {
    if (err) {
      console.error(`❌ Failed to publish alert to ${topic}:`, err.message);
    } else {
      console.log(`🚨 Published alert to ${topic}:`, alert);
    }
  });
}

/**
 * Publish configuration update to device
 */
export function publishConfig(binId, config) {
  const topic = `smartbin/${binId}/config`;
  const payload = JSON.stringify({
    mode: config.mode,
    threshold: config.threshold_cm,
    ts: new Date().toISOString()
  });
  
  // Use retained flag so device gets config on connect
  client.publish(topic, payload, { qos: 1, retain: true }, (err) => {
    if (err) {
      console.error(`❌ Failed to publish config to ${topic}:`, err.message);
    } else {
      console.log(`⚙️  Published config to ${topic}:`, config);
    }
  });
}

/**
 * Close MQTT connection
 */
export function closeMQTT() {
  if (client) {
    client.end();
    console.log('MQTT connection closed');
  }
}

export default {
  initMQTT,
  publishCommand,
  publishAlert,
  publishConfig,
  closeMQTT
};
