# Smart Bin IoT System

A complete IoT solution for smart waste management using ESP32, Node.js backend, and React frontend.

## 🎯 Project Overview

This system demonstrates a real-world IoT pipeline with:
- **ESP32 Firmware**: Ultrasonic sensors (HC-SR04) for level detection and proximity, RFID (RC522) for access control, servo for lid automation
- **Backend**: Node.js + Express + MQTT + MySQL for data persistence and business logic
- **Frontend**: React dashboard with real-time MQTT updates via WebSocket

## 📁 Project Structure

```
smartbin-iot/
├── backend/          # Node.js REST API + MQTT broker client
├── frontend/         # React dashboard with real-time updates
├── esp32/            # Arduino firmware for ESP32
└── README.md         # This file
```

## 🚀 Quick Start (6 Steps)

### Step 1: Setup MySQL Database
```powershell
# Install MySQL if not already installed
# Create database and run schema
cd backend
# Import schema.sql (see backend/README.md)
```

### Step 2: Start Backend
```powershell
cd backend
npm install
# Copy .env.example to .env and configure
npm start
```

### Step 3: Start Frontend
```powershell
cd frontend
npm install
npm start
# Opens at http://localhost:3000
```

### Step 4: Upload ESP32 Firmware (Optional - Hardware)
```
# Open esp32/smart_bin_firmware.ino in Arduino IDE
# Configure WiFi credentials and MQTT broker
# Upload to ESP32 board
# See esp32/README.md for details
```

### Step 5: Test Without Hardware (Mock Publisher)
```powershell
cd backend/tools
node mock_pub.js
# Simulates sensor data and RFID scans
```

### Step 6: Open Dashboard
```
Navigate to http://localhost:3000
- View real-time bin level updates
- See RFID access logs
- Configure bin settings
- Send open/close commands
```

## 🔧 System Architecture

```
┌──────────┐         MQTT (TLS 8883)        ┌─────────────┐
│  ESP32   │────────────────────────────────>│   HiveMQ    │
│  Device  │<────────────────────────────────│   Broker    │
└──────────┘                                 └──────┬──────┘
                                                    │
                                                    │ MQTT
                                                    │
                                         ┌──────────▼──────────┐
                                         │   Backend Server    │
                                         │  (Node.js + MQTT)   │
                                         │                     │
                                         │  ┌───────────────┐  │
                                         │  │    MySQL DB   │  │
                                         │  └───────────────┘  │
                                         └──────────┬──────────┘
                                                    │
                                                    │ HTTP REST
                                                    │
                                         ┌──────────▼──────────┐
                                         │  React Frontend     │
                                         │  (+ MQTT WebSocket) │
                                         └─────────────────────┘
```

## 📡 MQTT Topics

| Topic | Direction | QoS | Description |
|-------|-----------|-----|-------------|
| `smartbin/{binId}/data/level` | Pub | 0 | Telemetry: level %, distance cm |
| `smartbin/{binId}/rfid_check` | Pub | 1 | RFID UID for authorization |
| `smartbin/{binId}/cmd` | Sub | 1 | Commands: open/close lid |
| `smartbin/{binId}/config` | Sub | 1 (retained) | Configuration updates |
| `smartbin/{binId}/alert` | Sub | 1 | System alerts |
| `smartbin/{binId}/status` | LWT | 1 | Device online/offline |

## 🔒 Security Notes (For Production)

⚠️ **This is a demo project. For production deployment:**

1. **MQTT**: Use authenticated MQTT with TLS (not public broker)
2. **Database**: Use environment-specific credentials, not hardcoded
3. **JWT**: Implement proper user authentication (not admin-only)
4. **API**: Add rate limiting, input validation, SQL injection prevention
5. **WiFi**: Use WiFiManager library for ESP32 credential management
6. **HTTPS**: Use TLS for all web traffic

## 📦 Dependencies

### Backend
- Node.js 18+
- MySQL 8.0+
- npm packages: express, mqtt, mysql2, jsonwebtoken, dotenv, cors

### Frontend
- Node.js 18+
- React 18+
- npm packages: react, mqtt, axios, recharts

### ESP32
- Arduino IDE 2.x
- ESP32 board support
- Libraries: PubSubClient, WiFi, ArduinoJson, MFRC522, Servo

## 🧪 Testing Flow

1. **Start all services** (MySQL, Backend, Frontend)
2. **Run mock publisher**: Simulates ESP32 sending level data
3. **Check dashboard**: See real-time level updates
4. **Simulate RFID**: Mock publisher sends RFID scan
5. **Backend processes**: Checks UID in DB, publishes open command
6. **Dashboard updates**: Shows access log and command sent

## 📚 Documentation

- [Backend README](./backend/README.md) - API endpoints, MQTT logic
- [Frontend README](./frontend/README.md) - Components, real-time updates
- [ESP32 README](./esp32/README.md) - Wiring, firmware configuration

## 🎓 Educational Notes

This project demonstrates:
- **IoT Communication**: MQTT pub/sub pattern with QoS levels
- **Real-time Updates**: WebSocket MQTT in browser
- **Data Persistence**: MySQL relational database
- **RESTful API**: Express.js backend
- **Modern Frontend**: React hooks and components
- **Embedded Programming**: ESP32 C++ firmware

## 📝 License

MIT License - Free for educational use

## 👤 Author

Created for IoT BTL Project - K67 HUST

---

**Questions?** Check individual README files in each folder for detailed setup instructions.
