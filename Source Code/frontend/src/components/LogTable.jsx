/**
 * LogTable Component - Display event logs
 */

import React from 'react';
import './LogTable.css';

function LogTable({ logs }) {
  if (!logs || logs.length === 0) {
    return (
      <div className="no-logs">
        <p>No logs available</p>
      </div>
    );
  }

  const getEventIcon = (eventType) => {
    switch (eventType) {
      case 'rfid_scan': return '🏷️';
      case 'lid_open': return '🚪';
      case 'lid_close': return '🔒';
      case 'level_update': return '📊';
      case 'alert': return '🚨';
      case 'config_change': return '⚙️';
      default: return '📝';
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatEventType = (eventType) => {
    return eventType.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  return (
    <div className="log-table-container">
      <table className="table log-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Bin</th>
            <th>Event</th>
            <th>Details</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id} className={log.success ? '' : 'log-error'}>
              <td className="log-time">
                {formatTimestamp(log.timestamp)}
              </td>
              <td className="log-bin">
                <span className="bin-badge">{log.bin_id}</span>
              </td>
              <td className="log-event">
                <span className="event-icon">{getEventIcon(log.event_type)}</span>
                <span>{formatEventType(log.event_type)}</span>
              </td>
              <td className="log-details">
                {log.user_name && (
                  <div className="log-user">
                    👤 {log.user_name}
                  </div>
                )}
                {log.rfid_uid && !log.user_name && (
                  <div className="log-rfid">
                    🏷️ {log.rfid_uid}
                  </div>
                )}
                {log.level_percent !== null && (
                  <div className="log-level">
                    Level: {log.level_percent}% ({log.distance_cm}cm)
                  </div>
                )}
                {log.message && (
                  <div className="log-message">
                    {log.message}
                  </div>
                )}
              </td>
              <td className="log-status">
                <span className={`status-badge ${log.success ? 'success' : 'failed'}`}>
                  {log.success ? '✓' : '✗'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default LogTable;
