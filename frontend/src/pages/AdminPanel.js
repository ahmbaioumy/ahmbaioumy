import React, { useState, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import { useNavigate } from 'react-router-dom';
import { getAdminData, getUsers, updateUserRole, getSystemSettings, updateSystemSettings } from '../services/api';
import './AdminPanel.css';

function AdminPanel() {
  const [adminData, setAdminData] = useState(null);
  const [users, setUsers] = useState([]);
  const [systemSettings, setSystemSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const { instance, accounts } = useMsal();
  const navigate = useNavigate();

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    try {
      setLoading(true);
      const [admin, userList, settings] = await Promise.all([
        getAdminData(),
        getUsers(),
        getSystemSettings()
      ]);
      setAdminData(admin);
      setUsers(userList);
      setSystemSettings(settings);
    } catch (err) {
      setError('Failed to load admin panel data');
      console.error('Admin panel error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    instance.logoutRedirect({
      postLogoutRedirectUri: '/'
    });
  };

  const handleRoleUpdate = async (userId, newRole) => {
    try {
      await updateUserRole(userId, newRole);
      setUsers(users.map(user => 
        user.id === userId ? { ...user, role: newRole } : user
      ));
    } catch (err) {
      console.error('Failed to update user role:', err);
    }
  };

  const handleSettingUpdate = async (key, value) => {
    try {
      await updateSystemSettings({ [key]: value });
      setSystemSettings({ ...systemSettings, [key]: value });
    } catch (err) {
      console.error('Failed to update setting:', err);
    }
  };

  if (loading) {
    return (
      <div className="admin-panel">
        <div className="loading">Loading admin panel...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-panel">
        <div className="error">{error}</div>
        <button onClick={loadAdminData} className="btn">Retry</button>
      </div>
    );
  }

  return (
    <div className="admin-panel">
      <header className="dashboard-header">
        <h1>Admin Panel</h1>
        <div className="user-info">
          <span>Welcome, {accounts[0]?.name || 'Admin'}</span>
          <button onClick={handleLogout} className="logout-btn">Logout</button>
        </div>
      </header>

      <nav className="navigation">
        <ul className="nav-links">
          <li><button onClick={() => navigate('/')} className="nav-btn">Agent Dashboard</button></li>
          <li><button onClick={() => navigate('/manager')} className="nav-btn">Manager Dashboard</button></li>
          <li><button onClick={() => navigate('/chat')} className="nav-btn">Start Chat</button></li>
          <li><button onClick={() => navigate('/recommendations')} className="nav-btn">Recommendations</button></li>
        </ul>
      </nav>

      <div className="admin-content">
        <div className="admin-tabs">
          <button 
            className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button 
            className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            User Management
          </button>
          <button 
            className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            System Settings
          </button>
          <button 
            className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            Analytics
          </button>
        </div>

        <div className="tab-content">
          {activeTab === 'overview' && (
            <div className="overview-tab">
              <div className="metrics-grid">
                <div className="metric-card">
                  <div className="metric-value">{adminData?.totalUsers || 0}</div>
                  <div className="metric-label">Total Users</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value">{adminData?.activeUsers || 0}</div>
                  <div className="metric-label">Active Users</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value">{adminData?.totalChats || 0}</div>
                  <div className="metric-label">Total Chats</div>
                </div>
                <div className="metric-card">
                  <div className="metric-value">{adminData?.systemUptime || '99.9%'}</div>
                  <div className="metric-label">System Uptime</div>
                </div>
              </div>

              <div className="dashboard-grid">
                <div className="card">
                  <h3>User Roles Distribution</h3>
                  <div className="role-distribution">
                    <div className="role-item">
                      <span className="role-label">Agents:</span>
                      <span className="role-count">{adminData?.roleCounts?.agents || 0}</span>
                    </div>
                    <div className="role-item">
                      <span className="role-label">Managers:</span>
                      <span className="role-count">{adminData?.roleCounts?.managers || 0}</span>
                    </div>
                    <div className="role-item">
                      <span className="role-label">Admins:</span>
                      <span className="role-count">{adminData?.roleCounts?.admins || 0}</span>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <h3>System Health</h3>
                  <div className="health-metrics">
                    <div className="health-item">
                      <span className="health-label">API Status:</span>
                      <span className={`health-status ${adminData?.apiStatus === 'healthy' ? 'healthy' : 'unhealthy'}`}>
                        {adminData?.apiStatus || 'Unknown'}
                      </span>
                    </div>
                    <div className="health-item">
                      <span className="health-label">Database:</span>
                      <span className={`health-status ${adminData?.dbStatus === 'connected' ? 'healthy' : 'unhealthy'}`}>
                        {adminData?.dbStatus || 'Unknown'}
                      </span>
                    </div>
                    <div className="health-item">
                      <span className="health-label">SignalR:</span>
                      <span className={`health-status ${adminData?.signalRStatus === 'connected' ? 'healthy' : 'unhealthy'}`}>
                        {adminData?.signalRStatus || 'Unknown'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="users-tab">
              <div className="card">
                <h3>User Management</h3>
                <div className="users-table">
                  <div className="table-header">
                    <div className="header-cell">Name</div>
                    <div className="header-cell">Email</div>
                    <div className="header-cell">Role</div>
                    <div className="header-cell">Status</div>
                    <div className="header-cell">Last Active</div>
                    <div className="header-cell">Actions</div>
                  </div>
                  {users.map((user) => (
                    <div key={user.id} className="table-row">
                      <div className="table-cell">{user.name}</div>
                      <div className="table-cell">{user.email}</div>
                      <div className="table-cell">
                        <select 
                          value={user.role} 
                          onChange={(e) => handleRoleUpdate(user.id, e.target.value)}
                          className="role-select"
                        >
                          <option value="agent">Agent</option>
                          <option value="manager">Manager</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                      <div className="table-cell">
                        <span className={`status ${user.status}`}>{user.status}</span>
                      </div>
                      <div className="table-cell">{new Date(user.lastActive).toLocaleDateString()}</div>
                      <div className="table-cell">
                        <button className="action-btn">Edit</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="settings-tab">
              <div className="card">
                <h3>System Settings</h3>
                <div className="settings-form">
                  <div className="setting-item">
                    <label>NPS Threshold (Detractor):</label>
                    <input 
                      type="number" 
                      value={systemSettings.npsDetractorThreshold || 6}
                      onChange={(e) => handleSettingUpdate('npsDetractorThreshold', parseInt(e.target.value))}
                      className="setting-input"
                    />
                  </div>
                  <div className="setting-item">
                    <label>NPS Threshold (Promoter):</label>
                    <input 
                      type="number" 
                      value={systemSettings.npsPromoterThreshold || 9}
                      onChange={(e) => handleSettingUpdate('npsPromoterThreshold', parseInt(e.target.value))}
                      className="setting-input"
                    />
                  </div>
                  <div className="setting-item">
                    <label>Sentiment Confidence Threshold:</label>
                    <input 
                      type="number" 
                      step="0.1"
                      min="0"
                      max="1"
                      value={systemSettings.sentimentThreshold || 0.7}
                      onChange={(e) => handleSettingUpdate('sentimentThreshold', parseFloat(e.target.value))}
                      className="setting-input"
                    />
                  </div>
                  <div className="setting-item">
                    <label>Auto-notification for Detractors:</label>
                    <input 
                      type="checkbox" 
                      checked={systemSettings.autoNotifyDetractors || false}
                      onChange={(e) => handleSettingUpdate('autoNotifyDetractors', e.target.checked)}
                      className="setting-checkbox"
                    />
                  </div>
                  <div className="setting-item">
                    <label>Chat Retention Days:</label>
                    <input 
                      type="number" 
                      value={systemSettings.chatRetentionDays || 90}
                      onChange={(e) => handleSettingUpdate('chatRetentionDays', parseInt(e.target.value))}
                      className="setting-input"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="analytics-tab">
              <div className="card">
                <h3>System Analytics</h3>
                <div className="analytics-grid">
                  <div className="analytics-item">
                    <h4>Performance Metrics</h4>
                    <div className="metric-list">
                      <div className="metric-row">
                        <span>Average Response Time:</span>
                        <span>{adminData?.avgResponseTime || 'N/A'}</span>
                      </div>
                      <div className="metric-row">
                        <span>API Calls per Minute:</span>
                        <span>{adminData?.apiCallsPerMinute || 0}</span>
                      </div>
                      <div className="metric-row">
                        <span>Error Rate:</span>
                        <span>{adminData?.errorRate || '0%'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="analytics-item">
                    <h4>Usage Statistics</h4>
                    <div className="metric-list">
                      <div className="metric-row">
                        <span>Daily Active Users:</span>
                        <span>{adminData?.dailyActiveUsers || 0}</span>
                      </div>
                      <div className="metric-row">
                        <span>Monthly Chats:</span>
                        <span>{adminData?.monthlyChats || 0}</span>
                      </div>
                      <div className="metric-row">
                        <span>Peak Concurrent Users:</span>
                        <span>{adminData?.peakConcurrentUsers || 0}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AdminPanel;