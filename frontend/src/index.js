import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { PublicClientApplication } from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';
import App from './App';
import './index.css';

// MSAL configuration
const msalConfig = {
  auth: {
    clientId: process.env.REACT_APP_CLIENT_ID || 'your-client-id',
    authority: process.env.REACT_APP_AUTHORITY || 'https://login.microsoftonline.com/your-tenant-id',
    redirectUri: process.env.REACT_APP_REDIRECT_URI || 'http://localhost:3000'
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  }
};

const msalInstance = new PublicClientApplication(msalConfig);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <MsalProvider instance={msalInstance}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </MsalProvider>
  </React.StrictMode>
);