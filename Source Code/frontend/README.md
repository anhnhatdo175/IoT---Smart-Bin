# Smart Bin Frontend

React-based dashboard for Smart Bin IoT system with real-time updates via MQTT WebSocket.

## 🎯 Features

- **Real-time Updates**: MQTT WebSocket connection for live bin status
- **Bin Monitoring**: Visual level indicators, status badges
- **Remote Control**: Send open/close commands to bins
- **Configuration**: Update bin mode (AUTO/AUTH) and thresholds
- **Event Logs**: View access logs, level updates, and alerts
- **Responsive Design**: Works on desktop, tablet, and mobile

## 📋 Prerequisites

- Node.js 18+ with npm
- Backend server running (see backend/README.md)
- MQTT broker accessible via WebSocket

## 🚀 Installation & Setup

### Step 1: Install Dependencies

```powershell
cd frontend
npm install
```

### Step 2: Configure Environment (Optional)

Create `.env` file in frontend root:

```env
# Backend API URL
REACT_APP_API_URL=http://localhost:5000/api

# MQTT WebSocket URL
REACT_APP_MQTT_URL=ws://broker.hivemq.com:8000/mqtt
```

**Default values** (if no .env file):
- API: `http://localhost:5000/api`
- MQTT: `ws://broker.hivemq.com:8000/mqtt`

### Step 3: Start Development Server

```powershell
npm start
```

This will:
- Compile the React app
- Open browser at `http://localhost:3000`
- Enable hot-reloading for development

### Step 4: Build for Production (Optional)

```powershell
npm run build
```

Creates optimized production build in `build/` folder.

## 📱 Using the Dashboard

### Main Dashboard View

1. **Bin Cards**: Display each bin with:
   - Name and location
   - Online/offline status
   - Visual level indicator (bar chart)
   - Current fill percentage and distance
   - Status badge (normal/warning/critical)
   - Control buttons (Open, Close, Configure)

2. **Real-time Updates**: 
   - Level updates every 10 seconds from devices
   - Status changes (online/offline)
   - Visual feedback with animations

3. **Event Logs**:
   - Chronological list of all events
   - Filter by bin (click bin card)
   - Event types: RFID scans, lid operations, level updates, alerts

### Bin Controls

**Open/Close Lid**:
- Click "Open" or "Close" button on bin card
- Requires authentication (login with admin/admin123)
- Only works when bin is online
- Backend publishes MQTT command to device

**Configure Bin**:
1. Click ⚙️ (gear icon) on bin card
2. Modify settings:
   - **Mode**: AUTO (proximity) or AUTH (RFID)
   - **Threshold**: Distance in cm for proximity trigger
3. Click "Update" to save
4. Configuration is published to device via MQTT (retained)

### Authentication

For protected actions (commands, configuration):

1. Browser will prompt for login if not authenticated
2. Default credentials:
   - Username: `admin`
   - Password: `admin123`
3. JWT token stored in localStorage
4. Token expires after 24 hours

## 🔌 MQTT WebSocket Connection

Frontend subscribes to:
- `smartbin/+/data/level` - Real-time level updates
- `smartbin/+/status` - Device online/offline status

Connection status shown in header:
- 🟢 **Connected** - Receiving real-time updates
- 🔴 **Connecting...** - Attempting connection

## 📊 Component Structure

```
src/
├── index.js              # Entry point
├── App.js                # Main app component
├── App.css               # App styles
├── index.css             # Global styles
├── api.js                # REST API client (axios)
├── mqttClient.js         # MQTT WebSocket client
├── pages/
│   ├── Dashboard.jsx     # Main dashboard page
│   └── Dashboard.css
└── components/
    ├── BinCard.jsx       # Individual bin card
    ├── BinCard.css
    ├── LogTable.jsx      # Event log table
    └── LogTable.css
```

## 🎨 UI Components

### BinCard

Displays bin status with:
- Header (name, location, online status)
- Visual level bar (color-coded: green→yellow→red)
- Numeric level (percentage and cm)
- Status badge and mode indicator
- Action buttons (Open, Close, Configure)
- Configuration panel (expandable)

**Props**:
- `bin`: Bin object from API
- `onSelect`: Callback when card clicked
- `selected`: Boolean for selected state

### LogTable

Displays event logs with:
- Timestamp (formatted)
- Bin ID badge
- Event type with icon
- Details (user, RFID, level, message)
- Success/failure indicator

**Props**:
- `logs`: Array of log objects from API

### Dashboard

Main page orchestrating:
- Fetching bins and logs from API
- MQTT subscription management
- State updates from real-time data
- Bin selection for filtered logs

## 🔧 API Integration

**REST API** (via `api.js`):
```javascript
import { getAllBins, sendCommand, updateBinConfig, getLogs } from './api';

// Get all bins
const bins = await getAllBins();

// Send command
await sendCommand('BIN_01', 'open');

// Update config
await updateBinConfig('BIN_01', { mode: 'AUTH', threshold_cm: 60 });

// Get logs
const logs = await getLogs('BIN_01', 50, 0);
```

**MQTT Client** (via `mqttClient.js`):
```javascript
import mqttClient from './mqttClient';

// Connect
mqttClient.connect(() => console.log('Connected'));

// Subscribe
mqttClient.subscribe('smartbin/+/data/level', (topic, payload) => {
  console.log('Level update:', payload);
});

// Publish (not typically used in frontend)
mqttClient.publish('smartbin/BIN_01/cmd', { action: 'open' });
```

## 🐛 Troubleshooting

### Frontend doesn't load bins

**Problem**: Dashboard shows "No bins found"

**Solutions**:
- Verify backend is running: `http://localhost:5000/api/health`
- Check browser console for API errors
- Confirm database has bins (run schema.sql)
- Check CORS settings in backend

### MQTT not connecting

**Problem**: Header shows "Connecting..." indefinitely

**Solutions**:
- Check browser console for WebSocket errors
- Verify MQTT broker URL in .env
- Try alternative broker: `ws://test.mosquitto.org:8080/mqtt`
- Check firewall/proxy blocking WebSocket
- Some corporate networks block WebSocket - use VPN or local Mosquitto

### Commands not working

**Problem**: "Access token required" or 401 error

**Solutions**:
- Click any command button to trigger login
- Enter admin/admin123 credentials
- Check localStorage has 'token' key (F12 → Application → Local Storage)
- Token may have expired - clear and login again

### Real-time updates not showing

**Problem**: Level doesn't update automatically

**Solutions**:
- Check MQTT connection status in header
- Verify mock publisher or ESP32 is sending data
- Open MQTT Explorer to confirm messages on broker
- Check browser console for subscription confirmations

## 🌐 Browser Compatibility

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

**Note**: MQTT WebSocket requires modern browser with WebSocket support.

## 📦 Production Deployment

### Build for Production

```powershell
npm run build
```

### Serve with Static Server

```powershell
# Install serve globally
npm install -g serve

# Serve build folder
serve -s build -p 3000
```

### Deploy to Hosting

**Vercel/Netlify**:
1. Connect GitHub repository
2. Set build command: `npm run build`
3. Set publish directory: `build`
4. Add environment variables (REACT_APP_API_URL, REACT_APP_MQTT_URL)

**Nginx**:
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    root /var/www/smartbin/build;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API requests
    location /api {
        proxy_pass http://localhost:5000;
    }
}
```

## 🔒 Security Considerations

⚠️ **This is a DEMO. For production:**

1. **HTTPS**: Use TLS for all traffic
2. **Authentication**: Implement proper user registration/login
3. **Token Storage**: Consider httpOnly cookies instead of localStorage
4. **Input Validation**: Sanitize all user inputs
5. **Rate Limiting**: Protect API endpoints
6. **MQTT Auth**: Use authenticated MQTT with TLS

## 🎓 Development Tips

### Hot Reloading

Development server auto-reloads on file changes. Edit components and see changes instantly.

### React DevTools

Install [React Developer Tools](https://react.devtools.org/) browser extension to inspect component state.

### Debug MQTT

Add console logs in `mqttClient.js` to debug message flow:

```javascript
client.on('message', (topic, message) => {
  console.log('MQTT Message:', topic, message.toString());
  // ... rest of handler
});
```

### Mock Data

For frontend-only development without backend:

```javascript
// In Dashboard.jsx
const mockBins = [
  {
    id: 1,
    bin_id: 'BIN_01',
    name: 'Test Bin',
    // ... other fields
  }
];
```

## 📚 Dependencies

- **react** (^18.2.0): UI framework
- **mqtt** (^5.3.4): MQTT client for WebSocket
- **axios** (^1.6.2): HTTP client for API calls
- **recharts** (^2.10.3): Charting library (for future graphs)

## 📝 Available Scripts

- `npm start`: Run development server
- `npm run build`: Build for production
- `npm test`: Run tests (if configured)
- `npm run eject`: Eject from create-react-app (irreversible)

---

**Dashboard ready!** Make sure backend is running, then test with mock publisher or ESP32 hardware.
