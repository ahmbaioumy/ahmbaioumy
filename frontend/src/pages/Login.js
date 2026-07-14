import React from 'react';
import { useMsal } from '@azure/msal-react';
import './Login.css';

function Login() {
  const { instance } = useMsal();

  const handleLogin = () => {
    instance.loginRedirect({
      scopes: ['user.read'],
      prompt: 'select_account'
    });
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1>NPS Hero</h1>
          <p>Customer Service AI Chat System</p>
        </div>
        
        <div className="login-content">
          <div className="login-features">
            <h2>Features</h2>
            <ul>
              <li>🤖 Real-time AI sentiment analysis</li>
              <li>📊 NPS prediction and scoring</li>
              <li>💬 Live chat interface</li>
              <li>📈 Performance dashboards</li>
              <li>🔔 Real-time notifications</li>
              <li>🎯 AI-powered recommendations</li>
            </ul>
          </div>
          
          <div className="login-form">
            <h2>Sign In</h2>
            <p>Use your Azure Active Directory account to access the system</p>
            
            <button onClick={handleLogin} className="login-btn">
              Sign in with Microsoft
            </button>
            
            <div className="login-info">
              <p>Secure authentication powered by Azure Active Directory</p>
            </div>
          </div>
        </div>
        
        <div className="login-footer">
          <p>&copy; 2024 NPS Hero. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}

export default Login;