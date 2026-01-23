import React, { useState, useEffect } from 'react';
import Auth from './components/Auth';
import Dashboard from './components/Dashboard';
import Stats from './components/Stats';
import { BarChart3, Home, LogOut } from 'lucide-react';

function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [view, setView] = useState<'dashboard' | 'stats'>('dashboard');

  useEffect(() => {
    // Check if token is valid? For now rely on 401 interceptor or simple existence
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
  };

  if (!token) {
    return <Auth onLogin={() => setToken(localStorage.getItem('token'))} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {view === 'dashboard' ? (
        <>
            <Dashboard />
            <Stats />
        </>
      ) : (
        <Stats />
      )}

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around p-3">
        <button 
            onClick={() => setView('dashboard')}
            className={`flex flex-col items-center ${view === 'dashboard' ? 'text-blue-600' : 'text-gray-500'}`}
        >
            <Home size={24} />
            <span className="text-xs">Home</span>
        </button>
        <button 
            onClick={() => setView('stats')}
            className={`flex flex-col items-center ${view === 'stats' ? 'text-blue-600' : 'text-gray-500'}`}
        >
            <BarChart3 size={24} />
            <span className="text-xs">Stats</span>
        </button>
        <button 
            onClick={handleLogout}
            className="flex flex-col items-center text-gray-500"
        >
            <LogOut size={24} />
            <span className="text-xs">Logout</span>
        </button>
      </div>
    </div>
  );
}

export default App;
