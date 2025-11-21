/**
 * Mock MQTT Publisher
 * Simulates ESP32 device for testing without hardware
 * 
 * Usage: node mock_pub.js [bin_id]
 * Example: node mock_pub.js BIN_01
 */

import mqtt from 'mqtt';

// Configuration
const BROKER_URL = process.env.MQTT_BROKER_URL || 'mqtt://broker.hivemq.com:1883';
const BIN_ID = process.argv[2] || 'BIN_01';
const CLIENT_ID = `mock_device_${BIN_ID}_${Math.random().toString(16).slice(2, 8)}`;

// Simulate RFID UIDs
const RFID_UIDS = [
  { uid: '04A1B2C3D4E5F6', name: 'Admin User (authorized)' },
  { uid: 'A1B2C3D4', name: 'John Doe (authorized)' },
  { uid: 'E5F6A7B8', name: 'Jane Smith (authorized)' },
  { uid: 'DEADBEEF', name: 'Unknown (unauthorized)' }
];

// Bin parameters
const BIN_HEIGHT_CM = 200;
let currentDistanceCm = 150; // Start at 25% full
let isLidOpen = false;

console.log('🤖 Mock ESP32 Device Starting...');
console.log(`📡 Broker: ${BROKER_URL}`);
console.log(`🗑️  Bin ID: ${BIN_ID}`);
console.log(`🆔 Client ID: ${CLIENT_ID}\n`);

// Connect to MQTT
const client = mqtt.connect(BROKER_URL, {
  clientId: CLIENT_ID,
  clean: true,
  connectTimeout: 4000,
  reconnectPeriod: 1000,
  will: {
    topic: `smartbin/${BIN_ID}/status`,
    payload: 'offline',
    qos: 1,
    retain: false
  }
});

client.on('connect', () => {
  console.log('✅ Connected to MQTT broker\n');

  // Publish online status
  client.publish(`smartbin/${BIN_ID}/status`, 'online', { qos: 1 });

  // Subscribe to command and config topics
  client.subscribe(`smartbin/${BIN_ID}/cmd`, { qos: 1 }, (err) => {
    if (!err) {
      console.log(`📥 Subscribed to: smartbin/${BIN_ID}/cmd`);
    }
  });

  client.subscribe(`smartbin/${BIN_ID}/config`, { qos: 1 }, (err) => {
    if (!err) {
      console.log(`📥 Subscribed to: smartbin/${BIN_ID}/config`);
    }
  });

  client.subscribe(`smartbin/${BIN_ID}/alert`, { qos: 1 }, (err) => {
    if (!err) {
      console.log(`📥 Subscribed to: smartbin/${BIN_ID}/alert\n`);
    }
  });

  // Start publishing telemetry
  startTelemetry();

  // Start interactive menu
  setTimeout(showMenu, 2000);
});

client.on('message', (topic, message) => {
  const payload = message.toString();
  console.log(`\n📨 Received [${topic}]: ${payload}`);

  try {
    const data = JSON.parse(payload);

    if (topic.endsWith('/cmd')) {
      handleCommand(data);
    } else if (topic.endsWith('/config')) {
      handleConfig(data);
    } else if (topic.endsWith('/alert')) {
      handleAlert(data);
    }
  } catch (e) {
    console.log('   (Not JSON or handled differently)');
  }
});

client.on('error', (err) => {
  console.error('❌ MQTT Error:', err.message);
});

client.on('offline', () => {
  console.log('⚠️  MQTT client offline');
});

client.on('reconnect', () => {
  console.log('🔄 Reconnecting to MQTT broker...');
});

/**
 * Handle incoming commands
 */
function handleCommand(data) {
  const { action, reason, user } = data;

  console.log(`   🔧 Command: ${action}`);
  if (reason) console.log(`   📝 Reason: ${reason}`);
  if (user) console.log(`   👤 User: ${user}`);

  if (action === 'open') {
    console.log('   🚪 Opening lid...');
    isLidOpen = true;

    // Auto-close after 5 seconds
    setTimeout(() => {
      console.log('\n   ⏱️  Auto-closing lid after 5s');
      isLidOpen = false;
      
      // Publish close event
      client.publish(
        `smartbin/${BIN_ID}/cmd`,
        JSON.stringify({
          action: 'close',
          reason: 'auto_close',
          ts: new Date().toISOString()
        }),
        { qos: 1 }
      );
    }, 5000);

  } else if (action === 'close') {
    console.log('   🚪 Closing lid...');
    isLidOpen = false;
  }
}

/**
 * Handle config updates
 */
function handleConfig(data) {
  console.log('   ⚙️  Configuration update:');
  console.log(`      Mode: ${data.mode || 'unchanged'}`);
  console.log(`      Threshold: ${data.threshold || 'unchanged'} cm`);
}

/**
 * Handle alerts
 */
function handleAlert(data) {
  console.log(`   🚨 Alert: ${data.type}`);
  console.log(`      Message: ${data.message}`);
}

/**
 * Publish level telemetry periodically
 */
function startTelemetry() {
  setInterval(() => {
    // Simulate gradual filling
    currentDistanceCm = Math.max(10, currentDistanceCm - Math.random() * 2);
    
    // Reset when nearly full
    if (currentDistanceCm < 20) {
      console.log('\n🗑️  Bin emptied! Resetting level...\n');
      currentDistanceCm = 180;
    }

    const levelPercent = Math.round(((BIN_HEIGHT_CM - currentDistanceCm) / BIN_HEIGHT_CM) * 100);

    const payload = {
      level: levelPercent,
      cm: Math.round(currentDistanceCm),
      ts: new Date().toISOString()
    };

    client.publish(
      `smartbin/${BIN_ID}/data/level`,
      JSON.stringify(payload),
      { qos: 0 }
    );

    console.log(`📊 Published level: ${levelPercent}% (${Math.round(currentDistanceCm)}cm)`);
  }, 10000); // Every 10 seconds
}

/**
 * Simulate RFID scan
 */
function simulateRFIDScan(index = null) {
  if (index === null) {
    // Random RFID
    index = Math.floor(Math.random() * RFID_UIDS.length);
  }

  const rfid = RFID_UIDS[index];
  console.log(`\n🏷️  Simulating RFID scan: ${rfid.name}`);
  console.log(`   UID: ${rfid.uid}`);

  const payload = {
    uid: rfid.uid,
    ts: new Date().toISOString()
  };

  client.publish(
    `smartbin/${BIN_ID}/rfid_check`,
    JSON.stringify(payload),
    { qos: 1 }
  );

  console.log('   📤 RFID check sent to backend\n');
}

/**
 * Simulate proximity trigger (AUTO mode)
 */
function simulateProximity() {
  console.log('\n👋 Simulating proximity detection (AUTO mode)');
  console.log('   📤 Sending open command (simulating proximity trigger)\n');

  // In real device, proximity would trigger local open
  // Here we simulate by publishing a command back to ourselves
  client.publish(
    `smartbin/${BIN_ID}/cmd`,
    JSON.stringify({
      action: 'open',
      reason: 'proximity_triggered',
      ts: new Date().toISOString()
    }),
    { qos: 1 }
  );
}

/**
 * Show interactive menu
 */
function showMenu() {
  console.log('\n' + '='.repeat(50));
  console.log('🎮 Interactive Test Menu');
  console.log('='.repeat(50));
  console.log('Commands:');
  console.log('  1 - Scan Admin RFID (authorized)');
  console.log('  2 - Scan User RFID (authorized)');
  console.log('  3 - Scan Unknown RFID (unauthorized)');
  console.log('  4 - Trigger Proximity (AUTO mode)');
  console.log('  5 - Simulate bin full (80%+)');
  console.log('  6 - Empty bin (reset to 10%)');
  console.log('  q - Quit');
  console.log('='.repeat(50));
  console.log('Type a command and press Enter:\n');

  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (input) => {
    const command = input.trim();

    switch (command) {
      case '1':
        simulateRFIDScan(0); // Admin
        break;
      case '2':
        simulateRFIDScan(1); // User 1
        break;
      case '3':
        simulateRFIDScan(3); // Unknown
        break;
      case '4':
        simulateProximity();
        break;
      case '5':
        console.log('\n🗑️  Setting bin to 85% full...\n');
        currentDistanceCm = 30;
        break;
      case '6':
        console.log('\n🗑️  Emptying bin to 10%...\n');
        currentDistanceCm = 180;
        break;
      case 'q':
      case 'Q':
        console.log('\n👋 Shutting down mock device...');
        client.publish(`smartbin/${BIN_ID}/status`, 'offline', { qos: 1 });
        setTimeout(() => {
          client.end();
          process.exit(0);
        }, 500);
        break;
      default:
        if (command) {
          console.log('⚠️  Invalid command. Try 1-6 or q to quit.');
        }
    }
  });
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n\n🛑 Received SIGINT, shutting down...');
  client.publish(`smartbin/${BIN_ID}/status`, 'offline', { qos: 1 });
  setTimeout(() => {
    client.end();
    process.exit(0);
  }, 500);
});
