# Smart Bin Backend

Node.js backend server for Smart Bin IoT system. Handles MQTT communication with ESP32 devices, REST API for frontend, and MySQL data persistence.

## 🎯 Features

- **MQTT Integration**: Subscribe to device telemetry, publish commands/configs
- **REST API**: Manage bins, view logs, send commands
- **Authentication**: JWT-based API security (demo implementation)
- **Database**: MySQL with connection pooling
- **Real-time Processing**: RFID authorization, level monitoring, alerts

## 📋 Prerequisites

- Node.js 18+ (with ESM support)
- MySQL 8.0+
- MQTT Broker access (using public HiveMQ broker for demo)

## 🚀 Installation & Setup

### Step 1: Install Dependencies

```powershell
cd backend
npm install
```

### Step 2: Setup MySQL Database

Create database and import schema:

```powershell
# Login to MySQL
mysql -u root -p

# Or use MySQL Workbench to run schema.sql
```

```sql
source schema.sql
-- Or copy-paste the contents of schema.sql
```

This creates:
- Database: `smartbin_iot`
- Tables: `users`, `bins`, `logs`
- Sample data: 3 users, 2 bins

### Step 3: Configure Environment

Copy `.env.example` to `.env` and update values:

```powershell
cp .env.example .env
# Edit .env with your settings
```

**Important variables:**
```env
MQTT_BROKER_URL=mqtt://broker.hivemq.com:8884
MYSQL_HOST=localhost
MYSQL_USER=root
MYSQL_PASS=yourpassword
MYSQL_DB=smartbin_iot
JWT_SECRET=change-this-secret
```

### Step 4: Start Server

```powershell
npm start
```

You should see:
```
✅ MySQL connected successfully
✅ MQTT connected successfully
📥 Subscribed to: smartbin/+/data/level (QoS 0)
📥 Subscribed to: smartbin/+/rfid_check (QoS 1)
✅ Server running on http://localhost:5000
```

## 📡 MQTT Topics

Backend subscribes to:
- `smartbin/+/data/level` (QoS 0) - Level telemetry from devices
- `smartbin/+/rfid_check` (QoS 1) - RFID scans for authorization
- `smartbin/+/status` (QoS 1) - Device online/offline status (LWT)

Backend publishes to:
- `smartbin/{binId}/cmd` (QoS 1) - Commands (open/close)
- `smartbin/{binId}/alert` (QoS 1) - Alerts (full bin, unauthorized)
- `smartbin/{binId}/config` (QoS 1, retained) - Configuration updates

## 🔌 REST API Endpoints

### Authentication

**POST `/api/auth/login`**
```json
Request:
{
  "username": "admin",
  "password": "admin123"
}

Response:
{
  "success": true,
  "token": "eyJhbGc...",
  "user": { "username": "admin", "role": "admin" }
}
```

### Bins

**GET `/api/bins`** - Get all bins
```json
Response:
{
  "success": true,
  "data": [
    {
      "id": 1,
      "bin_id": "BIN_01",
      "name": "Main Entrance Bin",
      "location": "Building A - Floor 1",
      "capacity_cm": 200,
      "mode": "AUTO",
      "threshold_cm": 50,
      "is_online": true,
      "current_level_percent": 45,
      "current_distance_cm": 110,
      "status": "normal"
    }
  ]
}
```

**GET `/api/bins/:id`** - Get specific bin
```json
Response:
{
  "success": true,
  "data": { /* bin details */ }
}
```

**PUT `/api/bins/:id/config`** - Update bin config (requires JWT)
```json
Headers:
Authorization: Bearer <jwt-token>

Request:
{
  "mode": "AUTH",
  "threshold_cm": 60
}

Response:
{
  "success": true,
  "message": "Configuration updated",
  "data": { /* updated bin */ }
}
```

**POST `/api/bins/:id/command`** - Send command (requires JWT)
```json
Headers:
Authorization: Bearer <jwt-token>

Request:
{
  "action": "open"  // or "close"
}

Response:
{
  "success": true,
  "message": "Command 'open' sent to BIN_01"
}
```

### Logs

**GET `/api/logs?bin={binId}&limit=100&offset=0`** - Get event logs
```json
Response:
{
  "success": true,
  "data": [
    {
      "id": 1,
      "bin_id": "BIN_01",
      "event_type": "rfid_scan",
      "rfid_uid": "04A1B2C3D4E5F6",
      "user_name": "Admin User",
      "success": true,
      "message": "Access granted for Admin User",
      "timestamp": "2025-11-18T10:30:45"
    }
  ]
}
```

### Health Check

**GET `/api/health`**
```json
Response:
{
  "success": true,
  "status": "healthy",
  "timestamp": "2025-11-18T10:00:00Z",
  "uptime": 123.45
}
```

## 🧪 Testing with Mock Publisher

Test the system without hardware using the mock publisher:

```powershell
cd backend/tools
node mock_pub.js
```

This simulates:
- Level telemetry updates every 10s
- RFID scans (authorized and unauthorized)
- Device status changes

## 🔐 Security Notes

⚠️ **This is a DEMO implementation. For production:**

1. **JWT**: Implement proper user registration and login
2. **MQTT**: Use authenticated MQTT broker with TLS
3. **Database**: Use prepared statements (already done), environment-specific credentials
4. **Input Validation**: Add comprehensive validation (partially implemented)
5. **Rate Limiting**: Add API rate limiting
6. **HTTPS**: Use TLS for all HTTP traffic

## 📁 File Structure

```
backend/
├── src/
│   ├── index.js         # Main server entry point
│   ├── config.js        # Configuration management
│   ├── db.js            # Database functions
│   ├── mqttClient.js    # MQTT pub/sub logic
│   └── api.js           # REST API routes
├── tools/
│   └── mock_pub.js      # Testing tool (simulates ESP32)
├── package.json         # Dependencies
├── .env.example         # Environment template
├── schema.sql           # Database schema
└── README.md            # This file
```

## 🔧 Troubleshooting

**MQTT connection fails:**
- Check internet connection (using public broker)
- Try alternative: `mqtt://test.mosquitto.org:8884`

**MySQL connection error:**
- Verify MySQL is running: `mysql -u root -p`
- Check credentials in `.env`
- Ensure database exists: `SHOW DATABASES;`

**Port 5000 already in use:**
- Change `PORT` in `.env` file
- Or stop conflicting service

**No messages received:**
- Check MQTT topics in console logs
- Use MQTT Explorer to verify broker connectivity
- Ensure ESP32/mock publisher is running

## 📊 Business Logic Flow

### RFID Authorization Flow

1. **Device publishes** RFID UID to `smartbin/{binId}/rfid_check`
2. **Backend receives** message and queries database for user
3. **If authorized**: Backend publishes `open` command to `smartbin/{binId}/cmd`
4. **If unauthorized**: Backend publishes alert to `smartbin/{binId}/alert`
5. **Log event** in database for audit trail

### Level Monitoring Flow

1. **Device publishes** level data to `smartbin/{binId}/data/level` every 10s
2. **Backend receives** and updates database
3. **If level >= 80%**: Backend publishes alert
4. **Frontend** receives updates via MQTT WebSocket in real-time

## 🌐 MQTT Broker Options

**Public HiveMQ (default - no auth):**
```
mqtt://broker.hivemq.com:1883
ws://broker.hivemq.com:8000/mqtt (for frontend)
```

**Local Mosquitto:**
```powershell
# Install Mosquitto
# Start broker
mosquitto -v

# Update .env
MQTT_BROKER_URL=mqtt://localhost:8884
```

## 📝 Sample Test Requests

### Login and Get Token
```powershell
curl -X POST http://localhost:5000/api/auth/login -H "Content-Type: application/json" -d '{\"username\":\"admin\",\"password\":\"admin123\"}'
```

### Get All Bins
```powershell
curl http://localhost:5000/api/bins
```

### Send Open Command (with JWT)
```powershell
curl -X POST http://localhost:5000/api/bins/BIN_01/command -H "Authorization: Bearer YOUR_TOKEN" -H "Content-Type: application/json" -d '{\"action\":\"open\"}'
```

---

**Ready to test!** Start the backend, then proceed to frontend setup.
