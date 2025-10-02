import axios from 'axios';

// Base API URL - will be replaced with actual Azure Functions URL in production
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:7071/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  async (config) => {
    // In a real implementation, you would get the token from MSAL
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized - redirect to login
      localStorage.removeItem('accessToken');
      window.location.href = '/';
    }
    return Promise.reject(error);
  }
);

// Sentiment Analysis API
export const analyzeSentiment = async (text) => {
  try {
    const response = await api.post('/analyze-sentiment', { text });
    return response.data;
  } catch (error) {
    console.error('Sentiment analysis error:', error);
    throw new Error('Failed to analyze sentiment');
  }
};

// NPS Prediction API
export const getNPSPrediction = async (message, sentimentData) => {
  try {
    const response = await api.post('/predict-nps', {
      message,
      sentiment: sentimentData
    });
    return response.data;
  } catch (error) {
    console.error('NPS prediction error:', error);
    throw new Error('Failed to predict NPS');
  }
};

// Chat Storage API
export const saveChatLog = async (chatData) => {
  try {
    const response = await api.post('/save-chat', chatData);
    return response.data;
  } catch (error) {
    console.error('Chat save error:', error);
    throw new Error('Failed to save chat');
  }
};

// Get Chat History
export const getChatHistory = async (limit = 50) => {
  try {
    const response = await api.get(`/chat-history?limit=${limit}`);
    return response.data;
  } catch (error) {
    console.error('Chat history error:', error);
    throw new Error('Failed to load chat history');
  }
};

// Dashboard Data API
export const getDashboardData = async () => {
  try {
    const response = await api.get('/dashboard-data');
    return response.data;
  } catch (error) {
    console.error('Dashboard data error:', error);
    throw new Error('Failed to load dashboard data');
  }
};

// Manager Dashboard Data API
export const getManagerDashboardData = async (timeRange = '7d') => {
  try {
    const response = await api.get(`/manager-dashboard?timeRange=${timeRange}`);
    return response.data;
  } catch (error) {
    console.error('Manager dashboard error:', error);
    throw new Error('Failed to load manager dashboard data');
  }
};

// Team Performance API
export const getTeamPerformance = async (timeRange = '7d') => {
  try {
    const response = await api.get(`/team-performance?timeRange=${timeRange}`);
    return response.data;
  } catch (error) {
    console.error('Team performance error:', error);
    throw new Error('Failed to load team performance data');
  }
};

// NPS Trends API
export const getNpsTrends = async (timeRange = '7d') => {
  try {
    const response = await api.get(`/nps-trends?timeRange=${timeRange}`);
    return response.data;
  } catch (error) {
    console.error('NPS trends error:', error);
    throw new Error('Failed to load NPS trends');
  }
};

// Recommendations API
export const getRecommendations = async () => {
  try {
    const response = await api.get('/recommendations');
    return response.data;
  } catch (error) {
    console.error('Recommendations error:', error);
    throw new Error('Failed to load recommendations');
  }
};

// Admin Data API
export const getAdminData = async () => {
  try {
    const response = await api.get('/admin-data');
    return response.data;
  } catch (error) {
    console.error('Admin data error:', error);
    throw new Error('Failed to load admin data');
  }
};

// User Management APIs
export const getUsers = async () => {
  try {
    const response = await api.get('/users');
    return response.data;
  } catch (error) {
    console.error('Users error:', error);
    throw new Error('Failed to load users');
  }
};

export const updateUserRole = async (userId, newRole) => {
  try {
    const response = await api.put(`/users/${userId}/role`, { role: newRole });
    return response.data;
  } catch (error) {
    console.error('Update user role error:', error);
    throw new Error('Failed to update user role');
  }
};

// System Settings APIs
export const getSystemSettings = async () => {
  try {
    const response = await api.get('/system-settings');
    return response.data;
  } catch (error) {
    console.error('System settings error:', error);
    throw new Error('Failed to load system settings');
  }
};

export const updateSystemSettings = async (settings) => {
  try {
    const response = await api.put('/system-settings', settings);
    return response.data;
  } catch (error) {
    console.error('Update settings error:', error);
    throw new Error('Failed to update system settings');
  }
};

// Real-time Communication APIs
export const sendMessage = async (message, chatId) => {
  try {
    const response = await api.post('/send-message', {
      message,
      chatId
    });
    return response.data;
  } catch (error) {
    console.error('Send message error:', error);
    throw new Error('Failed to send message');
  }
};

// Notification APIs
export const subscribeToNotifications = async (userId) => {
  try {
    const response = await api.post('/notifications/subscribe', { userId });
    return response.data;
  } catch (error) {
    console.error('Notification subscription error:', error);
    throw new Error('Failed to subscribe to notifications');
  }
};

export const getNotifications = async (userId) => {
  try {
    const response = await api.get(`/notifications/${userId}`);
    return response.data;
  } catch (error) {
    console.error('Get notifications error:', error);
    throw new Error('Failed to load notifications');
  }
};

// Export/Import APIs
export const exportChatLogs = async (dateRange, format = 'csv') => {
  try {
    const response = await api.get(`/export/chat-logs?startDate=${dateRange.start}&endDate=${dateRange.end}&format=${format}`, {
      responseType: 'blob'
    });
    return response.data;
  } catch (error) {
    console.error('Export error:', error);
    throw new Error('Failed to export chat logs');
  }
};

export const exportNpsData = async (dateRange, format = 'csv') => {
  try {
    const response = await api.get(`/export/nps-data?startDate=${dateRange.start}&endDate=${dateRange.end}&format=${format}`, {
      responseType: 'blob'
    });
    return response.data;
  } catch (error) {
    console.error('Export error:', error);
    throw new Error('Failed to export NPS data');
  }
};

// Health Check API
export const healthCheck = async () => {
  try {
    const response = await api.get('/health');
    return response.data;
  } catch (error) {
    console.error('Health check error:', error);
    throw new Error('Health check failed');
  }
};

export default api;