import React, { useEffect, useState } from 'react';

const Dashboard = () => {
  const [metrics, setMetrics] = useState({
    total_ingress: 0,
    persisted: 0,
    active_cache: 0,
    avg_mttr: 0.0
  });

  const fetchMetrics = async () => {
    try {
      const response = await fetch('http://localhost:8000/metrics');
      const data = await response.json();
      setMetrics(data);
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000); // Auto-refresh every 5s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-6 bg-gray-900 min-h-screen text-white">
      <h1 className="text-2xl font-bold mb-6">IMS Control Tower</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Ingress Card */}
        <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
          <p className="text-gray-400 text-sm">TOTAL INGRESS</p>
          <p className="text-3xl font-mono">{metrics.total_ingress}</p>
        </div>

        {/* Persisted Card */}
        <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
          <p className="text-gray-400 text-sm">PERSISTED</p>
          <p className="text-3xl font-mono">{metrics.persisted}</p>
        </div>

        {/* Active Cache Card */}
        <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
          <p className="text-gray-400 text-sm">ACTIVE CACHE</p>
          <p className="text-3xl font-mono">{metrics.active_cache}</p>
        </div>

        {/* AVG. MTTR Card - THE FIX IS HERE */}
        <div className="p-4 bg-blue-900 bg-opacity-20 rounded-lg border border-blue-500">
          <p className="text-blue-400 text-sm font-bold">AVG. MTTR</p>
          <p className="text-3xl font-mono text-blue-300">
            {metrics.avg_mttr > 0 ? `${metrics.avg_mttr}s` : '0.00s'}
          </p>
          <p className="text-xs text-blue-500 mt-1">Mean Time to Repair</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
