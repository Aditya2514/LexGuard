import { useMemo } from 'react';
import { 
  PieChart, Pie, Cell, 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line
} from 'recharts';

export default function AnalyticsDashboard({ contracts }) {
  const stats = useMemo(() => {
    if (!contracts || contracts.length === 0) return null;

    const totalContracts = contracts.length;
    let totalClauses = 0;
    const riskCounts = { critical: 0, high: 0, medium: 0, low: 0 };
    const categoryCounts = {};
    const timelineDataMap = {};

    contracts.forEach(c => {
      totalClauses += (c.totalClauses || 0);

      const risk = c.overallRiskLevel || 'low';
      if (riskCounts[risk] !== undefined) riskCounts[risk]++;

      const cat = c.contractCategory || 'other';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;

      if (c.uploadedAt) {
        const dateStr = new Date(c.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        timelineDataMap[dateStr] = (timelineDataMap[dateStr] || 0) + 1;
      }
    });

    const riskData = [
      { name: 'Critical', value: riskCounts.critical, color: '#dc2626' },
      { name: 'High', value: riskCounts.high, color: '#ea580c' },
      { name: 'Medium', value: riskCounts.medium, color: '#ca8a04' },
      { name: 'Low', value: riskCounts.low, color: '#16a34a' }
    ].filter(d => d.value > 0);

    const categoryData = Object.entries(categoryCounts).map(([name, value]) => ({ name, value })).sort((a,b) => b.value - a.value);
    
    // Sort timeline chronologically by actual dates if we parsed them, but since we grouped by M-D strings, 
    // we should ideally keep the original order (contracts are usually sorted by uploadedAt DESC).
    // Let's just reverse the map keys to approximate chronological if contracts was DESC.
    const timelineData = Object.keys(timelineDataMap).reverse().map(date => ({
      date,
      count: timelineDataMap[date]
    }));

    return { totalContracts, totalClauses, riskData, categoryData, timelineData };
  }, [contracts]);

  if (!stats) return null;

  return (
    <div style={{ marginBottom: '2rem' }}>
      <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--text-primary)' }}>📊 Legal Analytics Overview</h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--accent)' }}>{stats.totalContracts}</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Contracts Analyzed</div>
        </div>
        <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#10b981' }}>{stats.totalClauses}</div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Clauses Parsed</div>
        </div>
        <div className="glass-card" style={{ padding: '1.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#dc2626' }}>
            {stats.riskData.find(d => d.name === 'Critical')?.value || 0}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Critical Risk Contracts</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        {/* Risk Distribution */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-secondary)', textAlign: 'center' }}>Overall Risk Distribution</h3>
          <div style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stats.riskData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {stats.riskData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Upload Activity Timeline */}
        <div className="glass-card" style={{ padding: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '1rem', color: 'var(--text-secondary)', textAlign: 'center' }}>Upload Activity</h3>
          <div style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="date" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff' }} 
                  itemStyle={{ color: '#10b981' }}
                />
                <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
