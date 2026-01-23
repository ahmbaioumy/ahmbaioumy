import React, { useState } from 'react';
import api from '../api';

interface AuthProps {
  onLogin: () => void;
}

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (isRegister) {
        // Get location
        navigator.geolocation.getCurrentPosition(async (pos) => {
          try {
            const res = await api.post('/register', {
              username,
              password,
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
              timezone,
            });
            localStorage.setItem('token', res.data.token);
            onLogin();
          } catch (err: any) {
            setError(err.response?.data || 'Registration failed');
          }
        }, (err) => {
           // Fallback or error if location denied
           console.error(err);
           // Default to simple location (e.g. 0,0 or ask user)
           // For prototype, we fail if no location
           setError("Location access required for prayer times.");
        });
      } else {
        const res = await api.post('/login', { username, password });
        localStorage.setItem('token', res.data.token);
        onLogin();
      }
    } catch (err: any) {
      setError(err.response?.data || 'Login failed');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div className="p-6 bg-white rounded shadow-md w-80">
        <h2 className="mb-4 text-xl font-bold">{isRegister ? 'Register' : 'Login'}</h2>
        {error && <p className="mb-2 text-red-500 text-sm">{error}</p>}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            className="p-2 border rounded"
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
          />
          <input
            className="p-2 border rounded"
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          <button className="p-2 bg-blue-500 text-white rounded hover:bg-blue-600">
            {isRegister ? 'Sign Up' : 'Login'}
          </button>
        </form>
        <button
          className="mt-4 text-sm text-blue-500 underline"
          onClick={() => setIsRegister(!isRegister)}
        >
          {isRegister ? 'Already have an account? Login' : 'Need an account? Register'}
        </button>
      </div>
    </div>
  );
};

export default Auth;
