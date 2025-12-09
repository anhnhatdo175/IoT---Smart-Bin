/**
 * Dashboard Page - Main view
 */

import React, { useState, useEffect } from 'react';
import BinCard from '../components/BinCard';
import LogTable from '../components/LogTable';
import { getAllBins, getLogs } from '../api';
import mqttClient from '../mqttClient';
import './Dashboard.css';

function Dashboard({ mqttConnected }) {
  const [bins, setBins] = useState([]);
  const [logs, setLogs] = useState([]);
  const [selectedBin, setSelectedBin] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch initial data
  useEffect(() => {
    fetchBins();
    fetchLogs();
  }, []);

  // Subscribe to MQTT updates
  useEffect(() => {
    if (!mqttConnected) return;

    // Subscribe to level updates for all bins
    mqttClient.subscribe('smartbin/+/data/level', handleLevelUpdate, 0);

    // Subscribe to status updates
    mqttClient.subscribe('smartbin/+/status', handleStatusUpdate, 1);

    return () => {
      mqttClient.unsubscribe('smartbin/+/data/level');
      mqttClient.unsubscribe('smartbin/+/status');
    };
  }, [mqttConnected]);

  /**
   * Fetch bins from API
   */
  const fetchBins = async () => {
    try {
      setLoading(true);
      const response = await getAllBins();
      setBins(response.data || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching bins:', err);
      setError('Failed to load bins. Please check backend connection.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Fetch logs from API
   */
  const fetchLogs = async (binId = null) => {
    try {
      const response = await getLogs(binId, 50, 0);
      setLogs(response.data || []);
    } catch (err) {
      console.error('Error fetching logs:', err);
    }
  };

  /**
   * Handle MQTT level update
   */
  const handleLevelUpdate = (topic, payload) => {
    const binId = topic.split('/')[1];
    const { level, cm } = payload;

    // Update bin state
    setBins(prevBins =>
      prevBins.map(bin => {
        if (bin.bin_id === binId) {
          return {
            ...bin,
            current_level_percent: level,
            current_distance_cm: cm,
            last_seen: new Date().toISOString(),
            status: level >= 80 ? 'critical' : level >= 60 ? 'warning' : 'normal'
          };
        }
        return bin;
      })
    );
  };

  /**
   * Handle MQTT status update
   */
  const handleStatusUpdate = (topic, payload) => {
    const binId = topic.split('/')[1];
    const isOnline = payload === 'online' || payload.toString() === 'online';

    setBins(prevBins =>
      prevBins.map(bin => {
        if (bin.bin_id === binId) {
          return {
            ...bin,
            is_online: isOnline,
            last_seen: new Date().toISOString()
          };
        }
        return bin;
      })
    );
  };

  /**
   * Handle bin selection for filtered logs
   */
  const handleBinSelect = (binId) => {
    setSelectedBin(binId);
    fetchLogs(binId);
  };

  /**
   * Handle config update from BinCard
   */
  const handleConfigUpdate = (binId, updatedBin) => {
    setBins(prevBins =>
      prevBins.map(bin => {
        if (bin.bin_id === binId) {
          return {
            ...bin,
            mode: updatedBin.mode,
            threshold_cm: updatedBin.threshold_cm
          };
        }
        return bin;
      })
    );
  };

  /**
   * Refresh data
   */
  const handleRefresh = () => {
    fetchBins();
    fetchLogs(selectedBin);
  };

  if (loading && bins.length === 0) {
    return (
      <div className="container">
        <div className="loading">
          <div className="spinner"></div>
          <p style={{ marginLeft: '15px' }}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container dashboard">
      {error && (
        <div className="alert alert-error">
          {error}
        </div>
      )}

      {!mqttConnected && (
        <div className="alert alert-warning">
          ⚠️ Real-time updates unavailable. Connecting to MQTT broker...
        </div>
      )}

      <div className="dashboard-header">
        <h2>Bin Overview</h2>
        <div className="header-buttons">
          <button onClick={handleRefresh} className="btn btn-secondary">
            🔄 Refresh
          </button>
          <button 
            onClick={() => window.open('http://192.168.210.149/update', '_blank')}
            className="btn btn-secondary"
          >
            🔧 Update Firmware
          </button>
        </div>
      </div>

      {bins.length === 0 ? (
        <div className="alert alert-info">
          No bins found. Please check backend configuration and database.
        </div>
      ) : (
        <>
          <div className="grid">
            {bins.map(bin => (
              <BinCard
                key={bin.id}
                bin={bin}
                onSelect={() => handleBinSelect(bin.bin_id)}
                selected={selectedBin === bin.bin_id}
                onConfigUpdate={handleConfigUpdate}
              />
            ))}
          </div>

          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                📋 Event Logs
                {selectedBin && ` - ${selectedBin}`}
              </h3>
              {selectedBin && (
                <button
                  onClick={() => {
                    setSelectedBin(null);
                    fetchLogs();
                  }}
                  className="btn btn-secondary"
                >
                  Show All
                </button>
              )}
            </div>
            <LogTable logs={logs} />
          </div>
        </>
      )}
    </div>
  );
}

export default Dashboard;
