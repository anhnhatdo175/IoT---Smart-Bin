/**
 * BinCard Component - Display individual bin status
 */

import React, { useState } from 'react';
import { updateBinConfig, sendCommand } from '../api';
import './BinCard.css';

function BinCard({ bin, onSelect, selected }) {
  const [showConfig, setShowConfig] = useState(false);
  const [mode, setMode] = useState(bin.mode);
  const [threshold, setThreshold] = useState(bin.threshold_cm);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState(null);

  const handleConfigUpdate = async (e) => {
    e.preventDefault();
    setUpdating(true);
    setMessage(null);

    try {
      await updateBinConfig(bin.bin_id, {
        mode,
        threshold_cm: parseInt(threshold)
      });
      setMessage({ type: 'success', text: 'Configuration updated successfully!' });
      setShowConfig(false);
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Config update error:', error);
      const errorMsg = error.response?.data?.error || 'Failed to update configuration';
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setUpdating(false);
    }
  };

  const handleCommand = async (action) => {
    try {
      await sendCommand(bin.bin_id, action);
      setMessage({ type: 'success', text: `Command "${action}" sent!` });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Command error:', error);
      const errorMsg = error.response?.data?.error || 'Failed to send command';
      setMessage({ type: 'error', text: errorMsg });
    }
  };

  const levelColor = bin.current_level_percent >= 80 ? '#f44336' :
                     bin.current_level_percent >= 60 ? '#ff9800' : '#4caf50';

  return (
    <div className={`bin-card ${selected ? 'selected' : ''}`} onClick={onSelect}>
      <div className="bin-card-header">
        <div>
          <h3 className="bin-name">{bin.name}</h3>
          <p className="bin-location">📍 {bin.location}</p>
        </div>
        <span className={`badge ${bin.is_online ? 'online' : 'offline'}`}>
          {bin.is_online ? 'Online' : 'Offline'}
        </span>
      </div>

      <div className="level-display">
        <div className="level-bar-container">
          <div
            className="level-bar"
            style={{
              height: `${bin.current_level_percent}%`,
              background: levelColor
            }}
          />
        </div>
        <div className="level-info">
          <div className="level-percent">
            {bin.current_level_percent}%
          </div>
          <div className="level-cm">
            {bin.current_distance_cm} cm
          </div>
        </div>
      </div>

      <div className="bin-status">
        <span className={`badge ${bin.status}`}>
          {bin.status}
        </span>
        <span className="bin-mode">
          Mode: <strong>{bin.mode}</strong>
        </span>
      </div>

      {message && (
        <div className={`alert alert-${message.type}`} style={{ marginTop: '10px', fontSize: '12px', padding: '8px' }}>
          {message.text}
        </div>
      )}

      <div className="bin-actions" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => handleCommand('open')}
          className="btn btn-success btn-sm"
          disabled={!bin.is_online}
          title={!bin.is_online ? 'Bin is offline' : 'Open lid'}
        >
          Open
        </button>
        <button
          onClick={() => handleCommand('close')}
          className="btn btn-danger btn-sm"
          disabled={!bin.is_online}
          title={!bin.is_online ? 'Bin is offline' : 'Close lid'}
        >
          Close
        </button>
        <button
          onClick={() => setShowConfig(!showConfig)}
          className="btn btn-secondary btn-sm"
          title="Configure bin"
        >
          ⚙️
        </button>
      </div>

      {showConfig && (
        <div className="config-panel" onClick={(e) => e.stopPropagation()}>
          <h4>Configuration</h4>
          <form onSubmit={handleConfigUpdate}>
            <div className="form-group">
              <label className="form-label">Mode</label>
              <select
                className="form-select"
                value={mode}
                onChange={(e) => setMode(e.target.value)}
              >
                <option value="AUTO">AUTO (Proximity)</option>
                <option value="AUTH">AUTH (RFID)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Threshold (cm)</label>
              <input
                type="number"
                className="form-input"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                min="10"
                max="200"
              />
            </div>
            <div className="config-actions">
              <button type="submit" className="btn btn-primary btn-sm" disabled={updating}>
                {updating ? 'Updating...' : 'Update'}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowConfig(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bin-footer">
        <small>ID: {bin.bin_id}</small>
        {bin.last_seen && (
          <small>Last seen: {new Date(bin.last_seen).toLocaleTimeString()}</small>
        )}
      </div>
    </div>
  );
}

export default BinCard;
