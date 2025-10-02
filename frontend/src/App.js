import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { AuthenticatedTemplate, UnauthenticatedTemplate } from '@azure/msal-react';
import Login from './pages/Login';
import ChatInterface from './components/ChatInterface';
import Dashboard from './components/Dashboard';
import ManagerDashboard from './pages/ManagerDashboard';
import AdminPanel from './pages/AdminPanel';
import Recommendations from './components/Recommendations';
import './App.css';

function App() {
  return (
    <div className="App">
      <AuthenticatedTemplate>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/chat" element={<ChatInterface />} />
          <Route path="/manager" element={<ManagerDashboard />} />
          <Route path="/admin" element={<AdminPanel />} />
          <Route path="/recommendations" element={<Recommendations />} />
        </Routes>
      </AuthenticatedTemplate>
      
      <UnauthenticatedTemplate>
        <Login />
      </UnauthenticatedTemplate>
    </div>
  );
}

export default App;