import React, { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../api';

const Stats: React.FC = () => {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
        // Fetch last 30 days by default
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - 30);
        
        const startStr = start.toISOString().split('T')[0];
        const endStr = end.toISOString().split('T')[0];

        try {
            const res = await api.get(`/stats?start_date=${startStr}&end_date=${endStr}`);
            // Convert map to array
            const chartData = Object.entries(res.data).map(([date, count]) => ({
                date,
                completed: count
            })).sort((a, b) => a.date.localeCompare(b.date));
            setData(chartData);
        } catch (err) {
            console.error(err);
        }
    };
    fetchStats();
  }, []);

  return (
    <div className="p-4 h-64 w-full bg-white rounded shadow border mt-6">
        <h3 className="text-lg font-semibold mb-4">Monthly Performance</h3>
        <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{fontSize: 10}} />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="completed" stroke="#3b82f6" strokeWidth={2} />
            </LineChart>
        </ResponsiveContainer>
    </div>
  );
};

export default Stats;
