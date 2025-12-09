/**
 * Smart Bin Firmware for ESP32
 * 
 * Hardware Requirements:
 * - ESP32 Dev Board
 * - 2x HC-SR04 Ultrasonic Sensors (level, proximity)
 * - RFID RC522 Module (SPI)
 * - SG90 Servo Motor (lid control)
 * - LED indicators (optional)
 * 
 * Features:
 * - WiFi connectivity
 * - MQTT communication with backend
 * - AUTO mode: Proximity-based lid opening
 * - AUTH mode: RFID-based access control
 * - Real-time level monitoring
 * - Remote configuration via MQTT
 * - OTA (Over-The-Air) firmware update
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <MFRC522.h>
#include <ESP32Servo.h>


#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include "iot47_wifi_ota.h"
 
// ===== WiFi Configuration =====
const char* WIFI_SSID = "realme";         
const char* WIFI_PASSWORD = "12345678"; 

// ===== MQTT Configuration =====
const char* MQTT_BROKER = "broker.hivemq.com";  // Public HiveMQ broker
const int MQTT_PORT = 1883;
const char* MQTT_CLIENT_ID = "ESP32_BIN_01";    // Unique per device
const char* BIN_ID = "BIN_01";                   // Must match backend database

// ===== MQTT Topics =====
String TOPIC_LEVEL = "smartbin/" + String(BIN_ID) + "/data/level";
String TOPIC_RFID = "smartbin/" + String(BIN_ID) + "/rfid_check";
String TOPIC_CMD = "smartbin/" + String(BIN_ID) + "/cmd";
String TOPIC_CONFIG = "smartbin/" + String(BIN_ID) + "/config";
String TOPIC_ALERT = "smartbin/" + String(BIN_ID) + "/alert";
String TOPIC_STATUS = "smartbin/" + String(BIN_ID) + "/status";

// ===== Pin Definitions =====
// HC-SR04 Level Sensor
#define LEVEL_TRIG_PIN 13
#define LEVEL_ECHO_PIN 12

// HC-SR04 Proximity Sensor
#define PROX_TRIG_PIN 14
#define PROX_ECHO_PIN 27

// RFID RC522 (SPI)
#define RFID_SS_PIN 5
#define RFID_RST_PIN 22

// Servo Motor
#define SERVO_PIN 25  // Changed from 26 to 25 (more reliable)

// LED Indicators (optional)
#define LED_GREEN_PIN 2   // Built-in LED
#define LED_RED_PIN 4

// ===== Bin Configuration =====
const int BIN_HEIGHT_CM = 30;         // Total bin height
int PROXIMITY_THRESHOLD_CM = 50;       // Distance to trigger lid
String BIN_MODE = "AUTO";              // AUTO or AUTH

// ===== Hardware Objects =====
WiFiClient espClient;
PubSubClient mqttClient(espClient);
MFRC522 rfid(RFID_SS_PIN, RFID_RST_PIN);
Servo lidServo;

// ===== State Variables =====
bool isLidOpen = false;
unsigned long lidOpenTime = 0;
const unsigned long LID_AUTO_CLOSE_MS = 7000;  // 7 seconds
unsigned long lastTelemetryTime = 0;
const unsigned long TELEMETRY_INTERVAL_MS = 10000;  // 10 seconds
unsigned long lastProximityCheck = 0;
const unsigned long PROXIMITY_DEBOUNCE_MS = 2000;  // 2 seconds debounce
int currentLevelPercent = 0;
int currentDistanceCm = 0;

// ===== Function Prototypes =====
void setupWiFi();
void setupMQTT();
void reconnectMQTT();
void mqttCallback(char* topic, byte* payload, unsigned int length);
long measureDistance(int trigPin, int echoPin);
void publishLevelData();
void checkProximity();
void checkRFID();
void openLid(String reason);
void closeLid();
void handleCommand(JsonDocument& doc);
void handleConfig(JsonDocument& doc);
String getRFIDString(byte* buffer, byte bufferSize);


AsyncWebServer server(80);

// ===== Setup =====
void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n\n");
  Serial.println("========================================");
  Serial.println("  Smart Bin ESP32 Firmware v1.0");
  Serial.println("========================================");
  Serial.println();

  // Pin modes
  pinMode(LEVEL_TRIG_PIN, OUTPUT);
  pinMode(LEVEL_ECHO_PIN, INPUT);
  pinMode(PROX_TRIG_PIN, OUTPUT);
  pinMode(PROX_ECHO_PIN, INPUT);
  pinMode(LED_GREEN_PIN, OUTPUT);
  pinMode(LED_RED_PIN, OUTPUT);

  // Initialize hardware
  Serial.println("Initializing hardware...");
  
  SPI.begin();
  rfid.PCD_Init();
  Serial.println(" RFID initialized");

  // ESP32Servo requires timer configuration
  Serial.println(" Configuring servo...");
  
  // Try simpler attach without manual timer allocation
  Serial.print("   Attaching to pin " + String(SERVO_PIN) + "... ");
  
  // Method 1: Let library auto-allocate timer
  int channel = lidServo.attach(SERVO_PIN);  // Auto-allocate
  
  if (channel >= 0) {
    Serial.println("OK (channel " + String(channel) + ")");
    Serial.println(" Servo attached successfully!");
    delay(100);
    
    Serial.print("   Moving to 0° (closed)... ");
    closeLid();
    Serial.println("Done");
    Serial.println("Servo initialized at 0°");
  } else {
    Serial.println("FAILED!");
    Serial.println(" Servo attach FAILED! Trying alternative method...");
    
    // Method 2: Manual timer with different configuration
    ESP32PWM::allocateTimer(0);
    lidServo.setPeriodHertz(50);
    bool attachResult = lidServo.attach(SERVO_PIN, 500, 2400);
    
    if (attachResult) {
      Serial.println(" Servo attached with manual config!");
      delay(100);
      closeLid();
    } else {
      Serial.println(" Both methods FAILED! Check:");
      Serial.println("   - Pin " + String(SERVO_PIN) + " wiring");
      Serial.println("   - Servo power (5V, 500mA+)");
      Serial.println("   - ESP32Servo library version");
      Serial.println("   - Try different GPIO (32, 33, 25)");
      digitalWrite(LED_RED_PIN, HIGH);
    }
  }

  // Connect to WiFi
  setupWiFi();

  // Setup OTA (Over-The-Air Update)
  setupOTA();

  // Setup MQTT
  setupMQTT();




  Serial.println(WiFi.localIP());
  iot47_wifi_ota_begin(&server);
  server.begin();

  Serial.println("\n Setup complete! Starting main loop...\n");

}

// ===== Main Loop =====
void loop() {
  // Handle OTA updates
  ArduinoOTA.handle();
  
  // Maintain MQTT connection
  if (!mqttClient.connected()) {
    reconnectMQTT();
  }
  mqttClient.loop();

  // Publish telemetry periodically
  if (millis() - lastTelemetryTime >= TELEMETRY_INTERVAL_MS) {
    publishLevelData();
    lastTelemetryTime = millis();
  }

  // Check for proximity trigger (AUTO mode)
  if (BIN_MODE.equals("AUTO") && !isLidOpen) {
    checkProximity();
  }

  // Check for RFID scan (AUTH mode)
  if (BIN_MODE.equals("AUTH") && !isLidOpen) {
    checkRFID();
  }

  // Auto-close lid after timeout
  if (isLidOpen && (millis() - lidOpenTime >= LID_AUTO_CLOSE_MS)) {
    Serial.println("  Auto-closing lid after timeout");
    closeLid();
  }
  iot47_wifi_ota_loop();
  delay(100);  // Small delay to prevent CPU overload
}

// ===== OTA Setup =====
void setupOTA() {
  Serial.println("🔧 Configuring OTA update...");
  
  // Hostname for OTA (will appear as "SmartBin-BIN01" in Arduino IDE)
  ArduinoOTA.setHostname(BIN_ID);
  
  // Password protection (optional but recommended)
  ArduinoOTA.setPassword("smartbin123");
  
  // Port (default 3232)
  ArduinoOTA.setPort(3232);
  
  // Callback when OTA starts
  ArduinoOTA.onStart([]() {
    String type;
    if (ArduinoOTA.getCommand() == U_FLASH) {
      type = "sketch";
    } else { // U_SPIFFS
      type = "filesystem";
    }
    
    Serial.println("\n🔄 OTA Update Starting...");
    Serial.println("   Type: " + type);
    
    // Đóng nắp an toàn trước khi update
    if (isLidOpen) {
      closeLid();
    }
    
    // Detach servo để tránh nhiễu
    if (lidServo.attached()) {
      lidServo.detach();
    }
  });
  
  // Callback when OTA ends
  ArduinoOTA.onEnd([]() {
    Serial.println("\n✅ OTA Update Complete!");
    Serial.println("   Rebooting...");
  });
  
  // Callback for progress
  ArduinoOTA.onProgress([](unsigned int progress, unsigned int total) {
    static unsigned int lastPercent = 0;
    unsigned int percent = (progress / (total / 100));
    
    // Chỉ in khi thay đổi 10%
    if (percent >= lastPercent + 10) {
      Serial.printf("   Progress: %u%%\n", percent);
      lastPercent = percent;
      
      // Nhấp nháy LED để báo hiệu
      digitalWrite(LED_GREEN_PIN, !digitalRead(LED_GREEN_PIN));
    }
  });
  
  // Callback for errors
  ArduinoOTA.onError([](ota_error_t error) {
    Serial.printf("\n❌ OTA Error[%u]: ", error);
    
    if (error == OTA_AUTH_ERROR) {
      Serial.println("Auth Failed");
    } else if (error == OTA_BEGIN_ERROR) {
      Serial.println("Begin Failed");
    } else if (error == OTA_CONNECT_ERROR) {
      Serial.println("Connect Failed");
    } else if (error == OTA_RECEIVE_ERROR) {
      Serial.println("Receive Failed");
    } else if (error == OTA_END_ERROR) {
      Serial.println("End Failed");
    }
    
    // Báo lỗi bằng LED đỏ
    digitalWrite(LED_RED_PIN, HIGH);
    delay(3000);
    digitalWrite(LED_RED_PIN, LOW);
  });
  
  // Start OTA service
  ArduinoOTA.begin();
  
  Serial.println("✅ OTA Ready!");
  Serial.print("   Hostname: ");
  Serial.println(BIN_ID);
  Serial.println("   Password: smartbin123");
  Serial.print("   IP Address: ");
  Serial.println(WiFi.localIP());
  Serial.println();
}

// ===== WiFi Setup =====
void setupWiFi() {
  Serial.print(" Connecting to WiFi: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n WiFi connected");
    Serial.print("   IP Address: ");
    Serial.println(WiFi.localIP());
    Serial.print("   RSSI: ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
  } else {
    Serial.println("\n WiFi connection failed!");
    Serial.println("   Please check SSID and password");
    while (1) {
      delay(1000);  // Halt execution
    }
  }
}

// ===== MQTT Setup =====
void setupMQTT() {
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  
  Serial.print(" MQTT Broker: ");
  Serial.print(MQTT_BROKER);
  Serial.print(":");
  Serial.println(MQTT_PORT);
  
  reconnectMQTT();
}

// ===== MQTT Reconnect =====
void reconnectMQTT() {
  while (!mqttClient.connected()) {
    Serial.print("Connecting to MQTT broker... ");

    // Set Last Will and Testament (LWT)
    if (mqttClient.connect(MQTT_CLIENT_ID, TOPIC_STATUS.c_str(), 1, false, "offline")) {
      Serial.println(" Connected!");

      // Publish online status
      mqttClient.publish(TOPIC_STATUS.c_str(), "online", true);

      // Subscribe to topics
      mqttClient.subscribe(TOPIC_CMD.c_str(), 1);
      Serial.print(" Subscribed to: ");
      Serial.println(TOPIC_CMD);

      mqttClient.subscribe(TOPIC_CONFIG.c_str(), 1);
      Serial.print(" Subscribed to: ");
      Serial.println(TOPIC_CONFIG);

      digitalWrite(LED_GREEN_PIN, HIGH);  // Indicate connection
    } else {
      Serial.print(" Failed, rc=");
      Serial.print(mqttClient.state());
      Serial.println(" - retrying in 5 seconds");
      digitalWrite(LED_RED_PIN, HIGH);
      delay(5000);
      digitalWrite(LED_RED_PIN, LOW);
    }
  }
}

// ===== MQTT Callback =====
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  Serial.print(" Received [");
  Serial.print(topic);
  Serial.print("]: ");

  // Convert payload to string
  char message[length + 1];
  memcpy(message, payload, length);
  message[length] = '\0';
  Serial.println(message);

  // Parse JSON
  StaticJsonDocument<256> doc;
  DeserializationError error = deserializeJson(doc, message);

  if (error) {
    Serial.print(" JSON parse error: ");
    Serial.println(error.c_str());
    return;
  }

  // Route to handler
  String topicStr = String(topic);
  if (topicStr.endsWith("/cmd")) {
    handleCommand(doc);
  } else if (topicStr.endsWith("/config")) {
    handleConfig(doc);
  }
}

// ===== Measure Distance (HC-SR04) =====
long measureDistance(int trigPin, int echoPin) {
  digitalWrite(trigPin, LOW);
  delayMicroseconds(2);
  digitalWrite(trigPin, HIGH);
  delayMicroseconds(10);
  digitalWrite(trigPin, LOW);

  long duration = pulseIn(echoPin, HIGH, 30000);  // 30ms timeout
  long distance = duration * 0.034 / 2;  // Speed of sound: 340 m/s

  return distance;
}

// ===== Publish Level Telemetry =====
void publishLevelData() {
  long distanceCm = measureDistance(LEVEL_TRIG_PIN, LEVEL_ECHO_PIN);

  // Validate reading
  if (distanceCm <= 0 || distanceCm > BIN_HEIGHT_CM) {
    Serial.println("  Invalid level sensor reading");
    return;
  }

  // Calculate level percentage
  int levelPercent = ((BIN_HEIGHT_CM - distanceCm) * 100) / BIN_HEIGHT_CM;
  levelPercent = constrain(levelPercent, 0, 100);

  currentLevelPercent = levelPercent;
  currentDistanceCm = distanceCm;

  // Build JSON payload
  StaticJsonDocument<128> doc;
  doc["level"] = levelPercent;
  doc["cm"] = distanceCm;
  
  // ISO8601 timestamp (simplified)
  char timestamp[25];
  unsigned long seconds = millis() / 1000;
  sprintf(timestamp, "2025-11-18T%02lu:%02lu:%02luZ", 
          (seconds / 3600) % 24, (seconds / 60) % 60, seconds % 60);
  doc["ts"] = timestamp;

  String payload;
  serializeJson(doc, payload);

  // Publish
  mqttClient.publish(TOPIC_LEVEL.c_str(), payload.c_str(), false);

  Serial.print(" Level: ");
  Serial.print(levelPercent);
  Serial.print("% (");
  Serial.print(distanceCm);
  Serial.println(" cm)");
}

// ===== Check Proximity (AUTO Mode) =====
void checkProximity() {
  // Debounce: chỉ check sau 2s kể từ lần check trước
  if (millis() - lastProximityCheck < PROXIMITY_DEBOUNCE_MS) {
    return;
  }

  long distance = measureDistance(PROX_TRIG_PIN, PROX_ECHO_PIN);

  if (distance > 0 && distance <= PROXIMITY_THRESHOLD_CM) {
    Serial.print(" Proximity detected: ");
    Serial.print(distance);
    Serial.println(" cm");
    openLid("proximity_trigger");
    lastProximityCheck = millis();  // Update debounce timer
  }
}

// ===== Check RFID (AUTH Mode) =====
void checkRFID() {
  // Look for new cards
  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) {
    return;
  }

  // Read UID
  String uid = getRFIDString(rfid.uid.uidByte, rfid.uid.size);
  
  Serial.print("  RFID detected: ");
  Serial.println(uid);

  // Build JSON payload
  StaticJsonDocument<128> doc;
  doc["uid"] = uid;
  
  char timestamp[25];
  unsigned long seconds = millis() / 1000;
  sprintf(timestamp, "2025-11-18T%02lu:%02lu:%02luZ", 
          (seconds / 3600) % 24, (seconds / 60) % 60, seconds % 60);
  doc["ts"] = timestamp;

  String payload;
  serializeJson(doc, payload);

  // Publish RFID check request
  mqttClient.publish(TOPIC_RFID.c_str(), payload.c_str(), false);
  Serial.println(" RFID check sent to backend");

  // Visual feedback
  digitalWrite(LED_GREEN_PIN, HIGH);
  delay(200);
  digitalWrite(LED_GREEN_PIN, LOW);

  // Halt PICC
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
}

// ===== Convert RFID UID to String =====
String getRFIDString(byte* buffer, byte bufferSize) {
  String uid = "";
  for (byte i = 0; i < bufferSize; i++) {
    if (buffer[i] < 0x10) uid += "0";
    uid += String(buffer[i], HEX);
  }
  uid.toUpperCase();
  return uid;
}

// ===== Open Lid =====
void openLid(String reason) {
  if (isLidOpen) return;

  Serial.print(" Opening lid (");
  Serial.print(reason);
  Serial.println(")");

  // Check if servo is attached, re-attach if needed
  if (!lidServo.attached()) {
    ESP32PWM::allocateTimer(0);
    lidServo.setPeriodHertz(50);
    lidServo.attach(SERVO_PIN, 500, 2400);
    delay(50);
  }

  lidServo.write(120);  // Open position (120° for wider opening)
  delay(600);  // Wait for servo to reach position + stabilize
  
  // Detach to stop PWM signal and prevent jitter/noise
  lidServo.detach();
  
  isLidOpen = true;
  lidOpenTime = millis();
  digitalWrite(LED_GREEN_PIN, HIGH);
  Serial.println("   Servo moved to 120° (detached)");
}

// ===== Close Lid =====
void closeLid() {
  Serial.println(" Closing lid");

  // Re-attach servo if needed
  if (!lidServo.attached()) {
    ESP32PWM::allocateTimer(0);
    lidServo.setPeriodHertz(50);
    lidServo.attach(SERVO_PIN, 500, 2400);
    delay(50);
  }

  lidServo.write(0);   // Close position (0° for SG90)
  delay(600);  // Wait for servo to reach position + stabilize
  
  // Detach to stop PWM signal and save power
  lidServo.detach();
  
  isLidOpen = false;
  digitalWrite(LED_GREEN_PIN, LOW);
  Serial.println("   Servo moved to 0° (detached)");
}

// ===== Handle Command =====
void handleCommand(JsonDocument& doc) {
  String action = doc["action"] | "";
  String reason = doc["reason"] | "unknown";

  Serial.print(" Command: ");
  Serial.print(action);
  Serial.print(" (reason: ");
  Serial.print(reason);
  Serial.println(")");

  if (action == "open") {
    openLid(reason);
  } else if (action == "close") {
    closeLid();
  }
}

// ===== Handle Config Update =====
void handleConfig(JsonDocument& doc) {
  Serial.println("  Configuration update received");

  // Update mode
  if (doc.containsKey("mode")) {
    String newMode = doc["mode"].as<String>();
    // Validate mode
    if (newMode.equals("AUTO") || newMode.equals("AUTH")) {
      BIN_MODE = newMode;
      Serial.print("   Mode: ");
      Serial.println(BIN_MODE);
    } else {
      Serial.print("     Invalid mode: ");
      Serial.println(newMode);
    }
  }

  // Update threshold
  if (doc.containsKey("threshold")) {
    PROXIMITY_THRESHOLD_CM = doc["threshold"];
    Serial.print("   Threshold: ");
    Serial.print(PROXIMITY_THRESHOLD_CM);
    Serial.println(" cm");
  }

  // Visual feedback
  for (int i = 0; i < 3; i++) {
    digitalWrite(LED_RED_PIN, HIGH);
    delay(100);
    digitalWrite(LED_RED_PIN, LOW);
    delay(100);
  }
}
