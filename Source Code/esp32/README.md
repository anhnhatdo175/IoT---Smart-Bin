# ESP32 Smart Bin Firmware

Arduino firmware for ESP32-based Smart Bin device with ultrasonic sensors, RFID reader, and servo motor.

## 🔧 Hardware Requirements

### Components

1. **ESP32 Development Board** (NodeMCU-32S, DevKit v1, or similar)
2. **2x HC-SR04 Ultrasonic Sensors**
   - One for level measurement (inside bin)
   - One for proximity detection (outside bin)
3. **MFRC522 RFID Reader Module** (13.56MHz, SPI interface)
4. **SG90 Servo Motor** (for lid control)
5. **LEDs** (optional, for status indicators)
   - Green LED (connected)
   - Red LED (error/alert)
6. **Power Supply**: 5V 2A recommended
7. **Jumper wires and breadboard**

### Wiring Diagram

```
ESP32 Pin Connections:

HC-SR04 Level Sensor:
  VCC  → 5V
  GND  → GND
  TRIG → GPIO 13
  ECHO → GPIO 12

HC-SR04 Proximity Sensor:
  VCC  → 5V
  GND  → GND
  TRIG → GPIO 14
  ECHO → GPIO 27

MFRC522 RFID (SPI):
  3.3V → 3.3V
  GND  → GND
  RST  → GPIO 22
  SS   → GPIO 5
  MOSI → GPIO 23
  MISO → GPIO 19
  SCK  → GPIO 18

SG90 Servo:
  VCC  → 5V
  GND  → GND
  PWM  → GPIO 18

LEDs (Optional):
  Green LED → GPIO 2 (built-in)
  Red LED   → GPIO 4 (+ 220Ω resistor)
```

### Important Notes

- **Power**: HC-SR04 sensors need 5V, RFID needs 3.3V
- **Level shifting**: ESP32 GPIO is 3.3V tolerant, HC-SR04 echo pin outputs 5V - use level shifter or voltage divider (2 resistors: 1kΩ + 2kΩ)
- **Servo**: Can draw significant current, consider separate power supply for multiple servos
- **RFID antenna**: Keep away from metal surfaces

## 📚 Required Libraries

Install via Arduino IDE Library Manager:

1. **WiFi** (built-in with ESP32 board support)
2. **PubSubClient** by Nick O'Leary (v2.8+)
   - `Sketch → Include Library → Manage Libraries`
   - Search "PubSubClient"
3. **ArduinoJson** by Benoit Blanchon (v6.21+)
   - Search "ArduinoJson"
4. **MFRC522** by GithubCommunity (v1.4+)
   - Search "MFRC522"
5. **ESP32Servo** by Kevin Harrington (v0.13+)
   - Search "ESP32Servo"

## 🚀 Installation & Upload

### Step 1: Install Arduino IDE

Download and install [Arduino IDE 2.x](https://www.arduino.cc/en/software)

### Step 2: Install ESP32 Board Support

1. Open Arduino IDE
2. Go to `File → Preferences`
3. Add to "Additional Board Manager URLs":
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
4. Go to `Tools → Board → Boards Manager`
5. Search "esp32" and install "esp32 by Espressif Systems" (v2.0.14+)

### Step 3: Configure Board

1. `Tools → Board → ESP32 Arduino → ESP32 Dev Module`
2. `Tools → Port → COM X` (select your ESP32 port)
3. `Tools → Upload Speed → 115200`
4. Other settings: default

### Step 4: Configure Firmware

Open `smart_bin_firmware.ino` and update:

```cpp
// WiFi credentials
const char* WIFI_SSID = "YourWiFiSSID";
const char* WIFI_PASSWORD = "YourWiFiPassword";

// MQTT broker (default: public HiveMQ)
const char* MQTT_BROKER = "broker.hivemq.com";

// Device ID (must match database)
const char* BIN_ID = "BIN_01";
```

### Step 5: Upload Firmware

1. Connect ESP32 via USB
2. Click `Upload` button (→) or `Sketch → Upload`
3. Wait for compilation and upload
4. Open Serial Monitor: `Tools → Serial Monitor` (115200 baud)

### Step 6: Verify Operation

You should see in Serial Monitor:
```
========================================
  Smart Bin ESP32 Firmware v1.0
========================================

🔧 Initializing hardware...
✅ RFID initialized
✅ Servo initialized
📡 Connecting to WiFi: YourWiFiSSID
....
✅ WiFi connected
   IP Address: 192.168.1.100
🔌 MQTT Broker: broker.hivemq.com:1883
🔄 Connecting to MQTT broker... ✅ Connected!
📥 Subscribed to: smartbin/BIN_01/cmd
📥 Subscribed to: smartbin/BIN_01/config

✨ Setup complete! Starting main loop...

📊 Level: 25% (150 cm)
```

## 🎯 Operation Modes

### AUTO Mode (Proximity-Based)

- **Default mode**
- Ultrasonic proximity sensor detects hand/object within threshold (default 50cm)
- Lid opens automatically
- No authentication required
- Use case: Public areas, cafeterias

### AUTH Mode (RFID-Based)

- Requires RFID card scan
- Device publishes UID to backend via MQTT
- Backend validates user and responds with open/close command
- Lid only opens for authorized users
- Use case: Restricted areas, employee-only bins

## 📡 MQTT Topics

### Published by Device

| Topic | QoS | Payload | Frequency |
|-------|-----|---------|-----------|
| `smartbin/BIN_01/data/level` | 0 | `{"level":45,"cm":110,"ts":"2025-11-18T10:00:00Z"}` | Every 10s |
| `smartbin/BIN_01/rfid_check` | 1 | `{"uid":"04A1B2C3D4","ts":"..."}` | On scan |
| `smartbin/BIN_01/status` | 1 | `online` / `offline` (LWT) | On connect/disconnect |

### Subscribed by Device

| Topic | QoS | Payload | Action |
|-------|-----|---------|--------|
| `smartbin/BIN_01/cmd` | 1 | `{"action":"open","reason":"rfid_authorized"}` | Opens/closes lid |
| `smartbin/BIN_01/config` | 1 (retained) | `{"mode":"AUTH","threshold":60}` | Updates config |

## 🧪 Testing

### Test 1: Level Measurement

1. Place sensor at top of bin
2. Measure distance to bottom
3. Verify readings in Serial Monitor
4. Check backend dashboard for updates

### Test 2: Proximity Trigger (AUTO Mode)

1. Wave hand in front of proximity sensor
2. Lid should open automatically
3. Lid auto-closes after 5 seconds

### Test 3: RFID Authentication (AUTH Mode)

1. Send config update via backend API:
   ```bash
   PUT /api/bins/BIN_01/config
   {"mode": "AUTH"}
   ```
2. Scan RFID card
3. Check Serial Monitor for UID
4. Backend validates and sends open command
5. Lid opens if authorized

### Test 4: Remote Commands

Use MQTT Explorer or backend API:
```
Topic: smartbin/BIN_01/cmd
Payload: {"action":"open","reason":"test"}
```

## 🔍 Troubleshooting

### WiFi Connection Issues

**Problem**: `❌ WiFi connection failed!`

**Solutions**:
- Verify SSID and password
- Check WiFi signal strength
- Use 2.4GHz network (ESP32 doesn't support 5GHz)
- Disable MAC filtering or add ESP32 MAC address

### MQTT Connection Issues

**Problem**: `❌ Failed, rc=-2` (connection failed)

**Solutions**:
- Check internet connectivity
- Try alternative broker: `test.mosquitto.org`
- Verify broker URL and port
- Check firewall settings

### Sensor Reading Issues

**Problem**: Invalid distance readings

**Solutions**:
- Check wiring, especially GND connections
- Ensure sensors have stable 5V power
- Avoid obstacles in sensor path
- Add small delay between measurements

### RFID Not Detecting

**Problem**: Cards not detected

**Solutions**:
- Check SPI wiring (MOSI, MISO, SCK, SS)
- Verify 3.3V power to RFID module
- Try different RFID cards (13.56MHz ISO14443A)
- Increase antenna distance to 1-3cm

### Servo Not Moving

**Problem**: Servo doesn't respond

**Solutions**:
- Check PWM pin connection
- Verify 5V power supply
- Adjust servo angles in code (0-180°)
- Test servo separately with sweep example

## 📊 Serial Monitor Commands

The firmware outputs detailed logs:

```
📡 WiFi connected - Network info
🔌 MQTT Connected - Broker info
📊 Level: XX% - Telemetry data
👋 Proximity detected - Trigger event
🏷️ RFID detected: XXXX - Card scan
📨 Received [topic]: {...} - MQTT message
🚪 Opening/Closing lid - Actuator control
⚙️ Configuration update - Config change
```

## ⚙️ Configuration Constants

Adjust in firmware as needed:

```cpp
const int BIN_HEIGHT_CM = 200;              // Total bin depth
int PROXIMITY_THRESHOLD_CM = 50;            // Trigger distance
const unsigned long LID_AUTO_CLOSE_MS = 5000;  // Auto-close time
const unsigned long TELEMETRY_INTERVAL_MS = 10000;  // Publish interval
```

## 🔐 Security Considerations

⚠️ **Production Recommendations**:

1. **MQTT Authentication**: Use username/password or client certificates
2. **TLS/SSL**: Enable encrypted MQTT connection (port 8883)
3. **OTA Updates**: Implement over-the-air firmware updates
4. **WiFi Manager**: Use WiFiManager library for credential management
5. **Watchdog Timer**: Enable to auto-recover from crashes

## 📝 Pinout Reference

| Function | ESP32 Pin | Alternative Pins |
|----------|-----------|------------------|
| Level Trig | 13 | Any GPIO |
| Level Echo | 12 | Any GPIO (with level shift) |
| Prox Trig | 14 | Any GPIO |
| Prox Echo | 27 | Any GPIO (with level shift) |
| RFID SS | 5 | Any GPIO |
| RFID RST | 22 | Any GPIO |
| RFID MOSI | 23 | Fixed (VSPI) |
| RFID MISO | 19 | Fixed (VSPI) |
| RFID SCK | 18 | Fixed (VSPI) |
| Servo PWM | 18 | Any GPIO (PWM capable) |

## 🆘 Common Error Codes

| Error | Meaning | Solution |
|-------|---------|----------|
| rc=-4 | Connection timeout | Check broker URL |
| rc=-2 | Network failed | Check WiFi connection |
| rc=5 | Unauthorized | Add MQTT credentials |

## 📚 Additional Resources

- [ESP32 Pinout Reference](https://randomnerdtutorials.com/esp32-pinout-reference-gpios/)
- [PubSubClient Documentation](https://pubsubclient.knolleary.net/)
- [MFRC522 Library Examples](https://github.com/miguelbalboa/rfid)
- [HC-SR04 Tutorial](https://randomnerdtutorials.com/esp32-hc-sr04-ultrasonic-arduino/)

---

**Hardware assembled? Firmware uploaded? Now test with the backend!**
