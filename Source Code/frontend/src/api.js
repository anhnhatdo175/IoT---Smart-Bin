/**
 * REST API client for backend communication
 */

import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Unauthorized - clear token
      localStorage.removeItem('token');
      // Could redirect to login page here
    }
    return Promise.reject(error);
  }
);

/**
 * Authentication
 */
export const login = async (username, password) => {
  const response = await api.post('/auth/login', { username, password });
  return response.data;
};

/**
 * Bins
 */
export const getAllBins = async () => {
  const response = await api.get('/bins');
  return response.data;
};

export const getBin = async (binId) => {
  const response = await api.get(`/bins/${binId}`);
  return response.data;
};

export const updateBinConfig = async (binId, config) => {
  const response = await api.put(`/bins/${binId}/config`, config);
  return response.data;
};

export const sendCommand = async (binId, action) => {
  const response = await api.post(`/bins/${binId}/command`, { action });
  return response.data;
};

/**
 * Logs
 */
export const getLogs = async (binId = null, limit = 100, offset = 0) => {
  const params = { limit, offset };
  if (binId) params.bin = binId;
  
  const response = await api.get('/logs', { params });
  return response.data;
};

/**
 * Health check
 */
export const checkHealth = async () => {
  const response = await api.get('/health');
  return response.data;
};

export default api;
