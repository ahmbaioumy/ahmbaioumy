import React, { useEffect, useState } from 'react';
import api from '../api';
import { CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';

interface Prayer {
  prayer_name: string;
  status: 'PENDING' | 'FIRST_HOUR' | 'SECOND_HOUR' | 'THIRD_HOUR' | 'MISSED';
  scheduled_time: string;
}

interface Deed {
  type: string;
  completed: boolean;
  value: number;
}

interface Overview {
  date: string;
  prayers: Prayer[];
  deeds: Deed[];
  score: number;
}

const Dashboard: React.FC = () => {
  const [data, setData] = useState<Overview | null>(null);
  const [notification, setNotification] = useState<any>(null);

  const fetchDashboard = async () => {
    try {
      const res = await api.get('/dashboard');
      setData(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchNotification = async () => {
    try {
      const res = await api.get('/notifications');
      if (res.data.type !== 'NONE') {
        setNotification(res.data);
      } else {
        setNotification(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchDashboard();
    fetchNotification();
    const interval = setInterval(() => {
        fetchDashboard(); // Update times/status logic
        fetchNotification();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleMark = async (prayer: string, status?: string) => {
    await api.post('/prayer/mark', {
      date: data?.date,
      prayer_name: prayer,
      status: status || '', // Empty to auto-calc
    });
    fetchDashboard();
  };

  const handleDeed = async (type: string, current: boolean) => {
    await api.post('/deed/toggle', {
      date: data?.date,
      type: type,
      completed: !current,
      value: 1, // Default value
    });
    fetchDashboard();
  };

  if (!data) return <div className="p-4">Loading...</div>;

  return (
    <div className="p-4 max-w-md mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Worship Tracker</h1>
        <div className="text-lg font-semibold bg-green-100 px-3 py-1 rounded">
          Score: {data.score}
        </div>
      </div>

      {notification && (
        <div className={clsx(
          "p-4 rounded border flex items-center gap-2",
          notification.type === 'CRITICAL' ? "bg-red-100 border-red-400 text-red-700" : "bg-yellow-100 border-yellow-400 text-yellow-700"
        )}>
          <AlertTriangle size={20} />
          <div>
            <p className="font-bold">{notification.message}</p>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Prayers</h2>
        {data.prayers.map((p) => (
          <div key={p.prayer_name} className="flex items-center justify-between p-3 bg-white border rounded shadow-sm">
            <div>
              <p className="font-medium">{p.prayer_name}</p>
              <p className="text-sm text-gray-500">{new Date(p.scheduled_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
            </div>
            
            <div className="flex gap-2">
              {p.status === 'PENDING' || p.status === 'MISSED' ? (
                 <>
                   <button onClick={() => handleMark(p.prayer_name)} className="px-3 py-1 bg-blue-500 text-white rounded text-sm">Done</button>
                   {/* Manual Override Options could be a dropdown, simplified here */}
                 </>
              ) : (
                <span className={clsx(
                    "px-2 py-1 rounded text-xs font-bold",
                    p.status === 'FIRST_HOUR' && "bg-green-200 text-green-800",
                    p.status === 'SECOND_HOUR' && "bg-yellow-200 text-yellow-800",
                    p.status === 'THIRD_HOUR' && "bg-orange-200 text-orange-800",
                    p.status === 'MISSED' && "bg-red-200 text-red-800",
                )}>
                    {p.status.replace('_', ' ')}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Daily Deeds</h2>
        <div className="grid grid-cols-2 gap-3">
            {data.deeds.map((d) => (
                <button
                    key={d.type}
                    onClick={() => handleDeed(d.type, d.completed)}
                    className={clsx(
                        "p-3 rounded border text-left flex items-center justify-between transition-colors",
                        d.completed ? "bg-green-50 border-green-500" : "bg-white border-gray-200 hover:bg-gray-50"
                    )}
                >
                    <span className="text-sm font-medium capitalize">{d.type.replace(/_/g, ' ').toLowerCase()}</span>
                    {d.completed ? <CheckCircle size={18} className="text-green-500" /> : <div className="w-4 h-4 rounded-full border border-gray-300" />}
                </button>
            ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
