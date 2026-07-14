import React, { useState, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import { useNavigate } from 'react-router-dom';
import { getDashboardData, getChatHistory } from '../services/api';
import './Dashboard.css';

function Dashboard() {
  const [dashboardData, setDashboardData] = useState(null);
  const [recentChats, setRecentChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { instance, accounts } = useMsal();
  const navigate = useNavigate();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [dashboard, chats] = await Promise.all([
        getDashboardData(),
        getChatHistory(10) // Get last 10 chats
      ]);
      setDashboardData(dashboard);
      setRecentChats(chats);
    } catch (err) {
      setError('Failed to load dashboard data');
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    instance.logoutRedirect({
      postLogoutRedirectUri: '/'
    });
  };

  if (loading) {
    return (
      <div className="dashboard">
        <div className="loading">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard">
        <div className="error">{error}</div>
        <button onClick={loadDashboardData} className="btn">Retry</button>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>NPS Hero Dashboard</h1>
        <div className="user-info">
          <span>Welcome, {accounts[0]?.name || 'Agent'}</span>
          <button onClick={handleLogout} className="logout-btn">Logout</button>
        </div>
      </header>

      <nav className="navigation">
        <ul className="nav-links">
          <li><button onClick={() => navigate('/chat')} className="nav-btn">Start Chat</button></li>
          <li><button onClick={() => navigate('/manager')} className="nav-btn">Manager View</button></li>
          <li><button onClick={() => navigate('/admin')} className="nav-btn">Admin Panel</button></li>
          <li><button onClick={() => navigate('/recommendations')} className="nav-btn">Recommendations</button></li>
        </ul>
      </nav>

      <div className="dashboard-content">
        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-value">{dashboardData?.totalChats || 0}</div>
            <div className="metric-label">Total Chats</div>
          </div>
          <div className="metric-card">
            <div className="metric-value">{dashboardData?.averageNPS || 0}</div>
            <div className="metric-label">Average NPS</div>
          </div>
          <div className="metric-card">
            <div className="metric-value">{dashboardData?.positiveSentiment || 0}%</div>
            <div className="metric-label">Positive Sentiment</div>
          </div>
          <div className="metric-card">
            <div className="metric-value">{dashboardData?.detractors || 0}</div>
            <div className="metric-label">Detractors Today</div>
          </div>
        </div>

        <div className="dashboard-grid">
          <div className="card">
            <h3>Recent Chats</h3>
            <div className="chat-list">
              {recentChats.length === 0 ? (
                <p className="no-data">No recent chats</p>
              ) : (
                recentChats.map((chat) => (
                  <div key={chat.id} className="chat-item">
                    <div className="chat-info">
                      <div className="chat-customer">{chat.customer}</div>
                      <div className="chat-time">{new Date(chat.timestamp).toLocaleString()}</div>
                    </div>
                    <div className="chat-metrics">
                      <span className={`sentiment sentiment-${chat.sentiment?.toLowerCase()}`}>
                        {chat.sentiment}
                      </span>
                      <span className={`nps nps-${chat.npsType?.toLowerCase()}`}>
                        {chat.npsType}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card">
            <h3>Quick Actions</h3>
            <div className="quick-actions">
              <button onClick={() => navigate('/chat')} className="action-btn primary">
                Start New Chat
              </button>
              <button onClick={() => navigate('/recommendations')} className="action-btn secondary">
                View Recommendations
              </button>
              <button onClick={loadDashboardData} className="action-btn secondary">
                Refresh Data
              </button>
            </div>
          </div>

          <div className="card">
            <h3>Performance Summary</h3>
            <div className="performance-summary">
              <div className="performance-item">
                <label>Response Time:</label>
                <span>{dashboardData?.averageResponseTime || 'N/A'}</span>
              </div>
              <div className="performance-item">
                <label>Resolution Rate:</label>
                <span>{dashboardData?.resolutionRate || 0}%</span>
              </div>
              <div className="performance-item">
                <label>Customer Satisfaction:</label>
                <span>{dashboardData?.customerSatisfaction || 0}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;