/**
 * Main App Component
 */

import React, { useState, useEffect } from 'react';
import Dashboard from './pages/Dashboard';
import mqttClient from './mqttClient';
import './App.css';

function App() {
  const [mqttConnected, setMqttConnected] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Connect to MQTT broker
    mqttClient.connect(
      () => {
        setMqttConnected(true);
        setError(null);
      },
      (err) => {
        setMqttConnected(false);
        setError(`MQTT connection failed: ${err.message}`);
      }
    );

    // Cleanup on unmount
    return () => {
      mqttClient.disconnect();
    };
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <div className="container">
          <div className="header-content">
            <div>
              <h1>🗑️ Smart Bin IoT Dashboard</h1>
              <p className="subtitle">Real-time monitoring and control</p>
            </div>
            <div className="header-status">
              <div className={`status-indicator ${mqttConnected ? 'connected' : 'disconnected'}`}>
                <span className="status-dot"></span>
                <span className="status-text">
                  {mqttConnected ? 'Connected' : 'Connecting...'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {error && (
        <div className="container">
          <div className="alert alert-error">
            {error}
          </div>
        </div>
      )}

      <main className="app-main">
        <Dashboard mqttConnected={mqttConnected} />
      </main>

      <footer className="app-footer">
        <div className="container">
          <p>Smart Bin IoT System © 2025 </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
