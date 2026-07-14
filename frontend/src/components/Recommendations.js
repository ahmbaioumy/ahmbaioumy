import React, { useState, useEffect } from 'react';
import { getRecommendations, getChatHistory } from '../services/api';
import './Recommendations.css';

function Recommendations() {
  const [recommendations, setRecommendations] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedChat, setSelectedChat] = useState(null);

  useEffect(() => {
    loadRecommendations();
    loadChatHistory();
  }, []);

  const loadRecommendations = async () => {
    try {
      const data = await getRecommendations();
      setRecommendations(data);
    } catch (err) {
      setError('Failed to load recommendations');
      console.error('Recommendations error:', err);
    }
  };

  const loadChatHistory = async () => {
    try {
      const data = await getChatHistory(50); // Get more chats for analysis
      setChatHistory(data);
    } catch (err) {
      console.error('Chat history error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getRecommendationType = (sentiment, npsType) => {
    if (npsType === 'Detractor') {
      return 'urgent';
    } else if (sentiment === 'negative') {
      return 'warning';
    } else if (npsType === 'Promoter') {
      return 'opportunity';
    }
    return 'standard';
  };

  const getRecommendationIcon = (type) => {
    switch (type) {
      case 'urgent':
        return '🚨';
      case 'warning':
        return '⚠️';
      case 'opportunity':
        return '💡';
      default:
        return '📋';
    }
  };

  const applyRecommendation = async (recommendationId, chatId) => {
    try {
      // This would typically send the recommendation to the agent
      alert(`Recommendation applied to chat ${chatId}`);
      // In a real implementation, this would update the chat with the recommendation
    } catch (err) {
      console.error('Failed to apply recommendation:', err);
    }
  };

  if (loading) {
    return (
      <div className="recommendations">
        <div className="loading">Loading recommendations...</div>
      </div>
    );
  }

  return (
    <div className="recommendations">
      <header className="recommendations-header">
        <h1>AI Recommendations</h1>
        <p>Smart suggestions to improve customer satisfaction and NPS scores</p>
      </header>

      <div className="recommendations-content">
        <div className="recommendations-grid">
          {recommendations.map((rec) => {
            const type = getRecommendationType(rec.sentiment, rec.npsType);
            return (
              <div key={rec.id} className={`recommendation-card ${type}`}>
                <div className="recommendation-header">
                  <span className="recommendation-icon">
                    {getRecommendationIcon(type)}
                  </span>
                  <div className="recommendation-meta">
                    <h3>{rec.title}</h3>
                    <div className="recommendation-tags">
                      <span className={`sentiment sentiment-${rec.sentiment}`}>
                        {rec.sentiment}
                      </span>
                      <span className={`nps nps-${rec.npsType.toLowerCase()}`}>
                        {rec.npsType}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="recommendation-content">
                  <p className="recommendation-description">
                    {rec.description}
                  </p>
                  
                  <div className="recommendation-actions">
                    <h4>Suggested Actions:</h4>
                    <ul>
                      {rec.actions.map((action, index) => (
                        <li key={index}>{action}</li>
                      ))}
                    </ul>
                  </div>
                  
                  <div className="recommendation-metrics">
                    <div className="metric">
                      <label>Confidence:</label>
                      <span>{Math.round(rec.confidence * 100)}%</span>
                    </div>
                    <div className="metric">
                      <label>Impact:</label>
                      <span>{rec.impact}</span>
                    </div>
                  </div>
                </div>
                
                <div className="recommendation-footer">
                  <button 
                    onClick={() => applyRecommendation(rec.id, rec.chatId)}
                    className="apply-btn"
                  >
                    Apply to Chat
                  </button>
                  <span className="recommendation-time">
                    {new Date(rec.timestamp).toLocaleString()}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="chat-analysis">
          <h2>Chat Analysis</h2>
          <div className="analysis-summary">
            <div className="summary-item">
              <label>Total Chats Analyzed:</label>
              <span>{chatHistory.length}</span>
            </div>
            <div className="summary-item">
              <label>Detractors Identified:</label>
              <span>{chatHistory.filter(c => c.npsType === 'Detractor').length}</span>
            </div>
            <div className="summary-item">
              <label>Negative Sentiment:</label>
              <span>{chatHistory.filter(c => c.sentiment === 'negative').length}</span>
            </div>
            <div className="summary-item">
              <label>Recommendations Generated:</label>
              <span>{recommendations.length}</span>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="error">
          {error}
          <button onClick={loadRecommendations} className="btn">Retry</button>
        </div>
      )}
    </div>
  );
}

export default Recommendations;