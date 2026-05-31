import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, Legend
} from 'recharts';
import './AdminDashboard.css';

const fetchSummary = async (token) => {
  const res = await fetch('/api/admin/metrics/summary', {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Failed to fetch summary');
  return res.json();
};

const fetchTimeseries = async (token) => {
  const res = await fetch('/api/admin/metrics/timeseries', {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error('Failed to fetch timeseries');
  return res.json();
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        background: 'rgba(20, 25, 40, 0.9)',
        border: '1px solid rgba(255,255,255,0.1)',
        padding: '10px',
        borderRadius: '8px',
        color: '#fff'
      }}>
        <p style={{ margin: '0 0 5px 0', fontWeight: 'bold' }}>{label}</p>
        {payload.map((entry, index) => (
          <p key={index} style={{ color: entry.color, margin: 0 }}>
            {entry.name}: {entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const AdminDashboard = () => {
  const token = localStorage.getItem('token');

  const { 
    data: summaryData, 
    isLoading: summaryLoading, 
    isError: summaryError,
    refetch: refetchSummary
  } = useQuery({
    queryKey: ['adminSummary'],
    queryFn: () => fetchSummary(token),
    refetchInterval: 60000,
  });

  const { 
    data: timeseriesData, 
    isLoading: timeseriesLoading, 
    isError: timeseriesError,
    refetch: refetchTimeseries
  } = useQuery({
    queryKey: ['adminTimeseries'],
    queryFn: () => fetchTimeseries(token),
    refetchInterval: 60000,
  });

  const isLoading = summaryLoading || timeseriesLoading;
  const isError = summaryError || timeseriesError;

  const handleRefresh = () => {
    refetchSummary();
    refetchTimeseries();
  };

  // Transform Timeseries Data for Recharts
  const chartData = useMemo(() => {
    if (!timeseriesData?.data?.tokenTrends) return [];
    
    // Group by date
    const dateMap = {};
    timeseriesData.data.tokenTrends.forEach(item => {
      const date = item._id.date;
      if (!dateMap[date]) dateMap[date] = { date };
      dateMap[date][`${item._id.provider}_tokens`] = item.totalTokens;
    });

    timeseriesData.data.latencyTrends.forEach(item => {
      const date = item._id.date;
      if (!dateMap[date]) dateMap[date] = { date };
      dateMap[date][`${item._id.provider}_latency`] = item.averageLatency;
    });

    return Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));
  }, [timeseriesData]);

  const totalTokensGlobal = useMemo(() => {
    if (!summaryData?.data?.tokenStats) return 0;
    return summaryData.data.tokenStats.reduce((acc, curr) => acc + curr.totalTokens, 0);
  }, [summaryData]);

  const avgLatencyGlobal = useMemo(() => {
    if (!summaryData?.data?.latencyStats || summaryData.data.latencyStats.length === 0) return 0;
    const total = summaryData.data.latencyStats.reduce((acc, curr) => acc + curr.averageLatency, 0);
    return Math.round(total / summaryData.data.latencyStats.length);
  }, [summaryData]);

  if (isLoading) return <div className="admin-loading">Loading telemetry...</div>;
  if (isError) return <div className="admin-error">Error fetching telemetry data. Ensure you have admin privileges.</div>;

  return (
    <div className="admin-dashboard-container">
      <div className="admin-header">
        <h1>LexGuard Super-Admin</h1>
        <button className="refresh-button" onClick={handleRefresh}>
          Refresh Metrics
        </button>
      </div>

      <div className="summary-cards">
        <div className="summary-card">
          <h3>Total LLM Tokens (7d)</h3>
          <p className="value" style={{ color: '#00f2fe' }}>
            {totalTokensGlobal.toLocaleString()}
          </p>
        </div>
        <div className="summary-card">
          <h3>Average Pipeline Latency (7d)</h3>
          <p className="value" style={{ color: avgLatencyGlobal > 10000 ? '#ff4d4f' : '#4facfe' }}>
            {avgLatencyGlobal.toLocaleString()} ms
          </p>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-container">
          <h2>Token Consumption (30d)</h2>
          {chartData.length === 0 ? (
            <p style={{ color: 'rgba(255,255,255,0.5)' }}>No metrics available for this timeframe.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorGemini" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorGroq" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#82ca9d" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#82ca9d" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="rgba(255,255,255,0.5)" />
                <YAxis stroke="rgba(255,255,255,0.5)" />
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <RechartsTooltip content={<CustomTooltip />} />
                <Legend />
                <Area type="monotone" dataKey="gemini_tokens" name="Gemini" stroke="#8884d8" fillOpacity={1} fill="url(#colorGemini)" />
                <Area type="monotone" dataKey="groq-large_tokens" name="Groq (Large)" stroke="#82ca9d" fillOpacity={1} fill="url(#colorGroq)" />
                <Area type="monotone" dataKey="groq_tokens" name="Groq (Fast)" stroke="#ffc658" fillOpacity={0.5} fill="#ffc658" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="chart-container">
          <h2>Agent Pipeline Latency (30d)</h2>
          {chartData.length === 0 ? (
            <p style={{ color: 'rgba(255,255,255,0.5)' }}>No metrics available for this timeframe.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="date" stroke="rgba(255,255,255,0.5)" />
                <YAxis stroke="rgba(255,255,255,0.5)" />
                <RechartsTooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="gemini_latency" name="Gemini (ms)" fill="#8884d8" />
                <Bar dataKey="groq-large_latency" name="Groq Large (ms)" fill="#82ca9d" />
                <Bar dataKey="groq_latency" name="Groq Fast (ms)" fill="#ffc658" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
