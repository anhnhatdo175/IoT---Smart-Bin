/**
 * MQTT Client for real-time updates
 * Uses MQTT.js over WebSocket
 */

import mqtt from 'mqtt';

const BROKER_URL = process.env.REACT_APP_MQTT_URL || 'ws://broker.hivemq.com:8000/mqtt';
const CLIENT_ID = `smartbin_web_${Math.random().toString(16).slice(2, 8)}`;

class MQTTClient {
  constructor() {
    this.client = null;
    this.connected = false;
    this.subscribers = new Map();
  }

  /**
   * Connect to MQTT broker
   */
  connect(onConnected, onError) {
    console.log('🔌 Connecting to MQTT broker:', BROKER_URL);

    this.client = mqtt.connect(BROKER_URL, {
      clientId: CLIENT_ID,
      clean: true,
      connectTimeout: 4000,
      reconnectPeriod: 1000,
    });

    this.client.on('connect', () => {
      console.log('✅ MQTT connected');
      this.connected = true;
      if (onConnected) onConnected();
    });

    this.client.on('error', (err) => {
      console.error('❌ MQTT error:', err.message);
      this.connected = false;
      if (onError) onError(err);
    });

    this.client.on('offline', () => {
      console.log('⚠️  MQTT offline');
      this.connected = false;
    });

    this.client.on('reconnect', () => {
      console.log('🔄 MQTT reconnecting...');
    });

    this.client.on('message', (topic, message) => {
      this.handleMessage(topic, message);
    });
  }

  /**
   * Subscribe to a topic
   */
  subscribe(topic, callback, qos = 0) {
    if (!this.client) {
      console.error('MQTT client not initialized');
      return;
    }

    this.client.subscribe(topic, { qos }, (err) => {
      if (err) {
        console.error(`❌ Subscribe error for ${topic}:`, err.message);
      } else {
        console.log(`📥 Subscribed to: ${topic}`);
        
        // Store callback
        if (!this.subscribers.has(topic)) {
          this.subscribers.set(topic, []);
        }
        this.subscribers.get(topic).push(callback);
      }
    });
  }

  /**
   * Unsubscribe from a topic
   */
  unsubscribe(topic) {
    if (!this.client) return;

    this.client.unsubscribe(topic, (err) => {
      if (err) {
        console.error(`❌ Unsubscribe error for ${topic}:`, err.message);
      } else {
        console.log(`📤 Unsubscribed from: ${topic}`);
        this.subscribers.delete(topic);
      }
    });
  }

  /**
   * Handle incoming message
   */
  handleMessage(topic, message) {
    try {
      const payload = JSON.parse(message.toString());
      console.log(`📨 Received [${topic}]:`, payload);

      // Find matching subscribers (support wildcards)
      this.subscribers.forEach((callbacks, subscribedTopic) => {
        if (this.topicMatch(subscribedTopic, topic)) {
          callbacks.forEach(callback => callback(topic, payload));
        }
      });
    } catch (error) {
      console.error('Error handling MQTT message:', error);
    }
  }

  /**
   * Check if topic matches subscription (with wildcard support)
   */
  topicMatch(subscription, topic) {
    const subParts = subscription.split('/');
    const topicParts = topic.split('/');

    if (subParts.length !== topicParts.length) {
      // Handle multi-level wildcard
      if (subParts[subParts.length - 1] === '#') {
        return topic.startsWith(subParts.slice(0, -1).join('/'));
      }
      return false;
    }

    for (let i = 0; i < subParts.length; i++) {
      if (subParts[i] === '#') return true;
      if (subParts[i] === '+') continue;
      if (subParts[i] !== topicParts[i]) return false;
    }

    return true;
  }

  /**
   * Publish a message
   */
  publish(topic, payload, options = {}) {
    if (!this.client) {
      console.error('MQTT client not initialized');
      return;
    }

    const message = typeof payload === 'string' ? payload : JSON.stringify(payload);
    
    this.client.publish(topic, message, options, (err) => {
      if (err) {
        console.error(`❌ Publish error for ${topic}:`, err.message);
      } else {
        console.log(`📤 Published to ${topic}:`, payload);
      }
    });
  }

  /**
   * Disconnect from broker
   */
  disconnect() {
    if (this.client) {
      this.client.end();
      this.connected = false;
      this.subscribers.clear();
      console.log('MQTT disconnected');
    }
  }

  /**
   * Check connection status
   */
  isConnected() {
    return this.connected;
  }
}

// Export singleton instance
const mqttClient = new MQTTClient();
export default mqttClient;
