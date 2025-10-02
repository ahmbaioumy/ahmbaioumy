import React, { useState, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import { useNavigate } from 'react-router-dom';
import { getManagerDashboardData, getTeamPerformance, getNpsTrends } from '../services/api';
import './ManagerDashboard.css';

function ManagerDashboard() {
  const [dashboardData, setDashboardData] = useState(null);
  const [teamPerformance, setTeamPerformance] = useState([]);
  const [npsTrends, setNpsTrends] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTimeRange, setSelectedTimeRange] = useState('7d');
  const { instance, accounts } = useMsal();
  const navigate = useNavigate();

  useEffect(() => {
    loadManagerData();
  }, [selectedTimeRange]);

  const loadManagerData = async () => {
    try {
      setLoading(true);
      const [dashboard, team, trends] = await Promise.all([
        getManagerDashboardData(selectedTimeRange),
        getTeamPerformance(selectedTimeRange),
        getNpsTrends(selectedTimeRange)
      ]);
      setDashboardData(dashboard);
      setTeamPerformance(team);
      setNpsTrends(trends);
    } catch (err) {
      setError('Failed to load manager dashboard data');
      console.error('Manager dashboard error:', err);
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
      <div className="manager-dashboard">
        <div className="loading">Loading manager dashboard...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="manager-dashboard">
        <div className="error">{error}</div>
        <button onClick={loadManagerData} className="btn">Retry</button>
      </div>
    );
  }

  return (
    <div className="manager-dashboard">
      <header className="dashboard-header">
        <h1>Manager Dashboard</h1>
        <div className="user-info">
          <span>Welcome, {accounts[0]?.name || 'Manager'}</span>
          <button onClick={handleLogout} className="logout-btn">Logout</button>
        </div>
      </header>

      <nav className="navigation">
        <ul className="nav-links">
          <li><button onClick={() => navigate('/')} className="nav-btn">Agent Dashboard</button></li>
          <li><button onClick={() => navigate('/chat')} className="nav-btn">Start Chat</button></li>
          <li><button onClick={() => navigate('/admin')} className="nav-btn">Admin Panel</button></li>
          <li><button onClick={() => navigate('/recommendations')} className="nav-btn">Recommendations</button></li>
        </ul>
      </nav>

      <div className="dashboard-content">
        <div className="time-range-selector">
          <label>Time Range:</label>
          <select 
            value={selectedTimeRange} 
            onChange={(e) => setSelectedTimeRange(e.target.value)}
            className="time-select"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
          </select>
        </div>

        <div className="metrics-grid">
          <div className="metric-card">
            <div className="metric-value">{dashboardData?.totalChats || 0}</div>
            <div className="metric-label">Total Chats</div>
            <div className="metric-change positive">+{dashboardData?.chatGrowth || 0}%</div>
          </div>
          <div className="metric-card">
            <div className="metric-value">{dashboardData?.averageNPS || 0}</div>
            <div className="metric-label">Average NPS</div>
            <div className={`metric-change ${dashboardData?.npsChange >= 0 ? 'positive' : 'negative'}`}>
              {dashboardData?.npsChange >= 0 ? '+' : ''}{dashboardData?.npsChange || 0}%
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-value">{dashboardData?.detractors || 0}</div>
            <div className="metric-label">Detractors</div>
            <div className="metric-change negative">{dashboardData?.detractorRate || 0}%</div>
          </div>
          <div className="metric-card">
            <div className="metric-value">{dashboardData?.promoters || 0}</div>
            <div className="metric-label">Promoters</div>
            <div className="metric-change positive">{dashboardData?.promoterRate || 0}%</div>
          </div>
        </div>

        <div className="dashboard-grid">
          <div className="card">
            <h3>Team Performance</h3>
            <div className="team-performance">
              {teamPerformance.length === 0 ? (
                <p className="no-data">No team data available</p>
              ) : (
                teamPerformance.map((agent) => (
                  <div key={agent.id} className="agent-performance">
                    <div className="agent-info">
                      <div className="agent-name">{agent.name}</div>
                      <div className="agent-role">{agent.role}</div>
                    </div>
                    <div className="agent-metrics">
                      <div className="metric">
                        <span className="metric-label">Chats:</span>
                        <span className="metric-value">{agent.totalChats}</span>
                      </div>
                      <div className="metric">
                        <span className="metric-label">NPS:</span>
                        <span className="metric-value">{agent.averageNPS}</span>
                      </div>
                      <div className="metric">
                        <span className="metric-label">Satisfaction:</span>
                        <span className="metric-value">{agent.satisfaction}%</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="card">
            <h3>NPS Trends</h3>
            <div className="nps-trends">
              {npsTrends.length === 0 ? (
                <p className="no-data">No trend data available</p>
              ) : (
                <div className="trend-chart">
                  {npsTrends.map((trend) => (
                    <div key={trend.date} className="trend-item">
                      <div className="trend-date">{new Date(trend.date).toLocaleDateString()}</div>
                      <div className="trend-bar">
                        <div 
                          className="trend-fill"
                          style={{ 
                            width: `${Math.max(0, Math.min(100, (trend.nps + 100) / 2))}%`,
                            backgroundColor: trend.nps >= 0 ? '#4caf50' : '#f44336'
                          }}
                        ></div>
                      </div>
                      <div className="trend-value">{trend.nps}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <h3>Sentiment Analysis</h3>
            <div className="sentiment-analysis">
              <div className="sentiment-item">
                <div className="sentiment-label">Positive</div>
                <div className="sentiment-bar">
                  <div 
                    className="sentiment-fill positive"
                    style={{ width: `${dashboardData?.positiveSentiment || 0}%` }}
                  ></div>
                </div>
                <div className="sentiment-value">{dashboardData?.positiveSentiment || 0}%</div>
              </div>
              <div className="sentiment-item">
                <div className="sentiment-label">Neutral</div>
                <div className="sentiment-bar">
                  <div 
                    className="sentiment-fill neutral"
                    style={{ width: `${dashboardData?.neutralSentiment || 0}%` }}
                  ></div>
                </div>
                <div className="sentiment-value">{dashboardData?.neutralSentiment || 0}%</div>
              </div>
              <div className="sentiment-item">
                <div className="sentiment-label">Negative</div>
                <div className="sentiment-bar">
                  <div 
                    className="sentiment-fill negative"
                    style={{ width: `${dashboardData?.negativeSentiment || 0}%` }}
                  ></div>
                </div>
                <div className="sentiment-value">{dashboardData?.negativeSentiment || 0}%</div>
              </div>
            </div>
          </div>

          <div className="card">
            <h3>Quick Actions</h3>
            <div className="quick-actions">
              <button onClick={() => navigate('/recommendations')} className="action-btn primary">
                View Recommendations
              </button>
              <button onClick={loadManagerData} className="action-btn secondary">
                Refresh Data
              </button>
              <button className="action-btn secondary">
                Export Report
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ManagerDashboard;