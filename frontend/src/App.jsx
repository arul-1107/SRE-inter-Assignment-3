import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Activity, Database, ShieldCheck, Clock, Terminal, X, Info } from 'lucide-react';

const MetricCard = ({ title, value, sub, icon, color }) => (
  <div className="bg-[#0f172a] border border-slate-800 p-5 rounded-xl shadow-lg">
    <div className="flex items-center gap-3 mb-2 font-semibold text-slate-400 text-sm uppercase">
      <span className={color}>{icon}</span> {title}
    </div>
    <div className="text-3xl font-mono font-bold text-white">{value}</div>
    <div className="text-slate-500 text-xs mt-1 font-medium">{sub}</div>
  </div>
);

export default function App() {
  const [data, setData] = useState([]);
  const [metrics, setMetrics] = useState({ ingress: 0, persisted: 0, cache_active: 0, avg_mttr: "0s" });
  const [selectedItem, setSelectedItem] = useState(null);
  const [rcaItem, setRcaItem] = useState(null);
  const [rcaData, setRcaData] = useState({
    root_cause: '',
    action_taken: '',
    resolved_by: 'Admin User',
    impact_level: 'LOW'
  });

  const API_BASE = "http://localhost"; // Goes through Nginx Load Balancer

  // HELPER: Map DB Priority to P0-P2 Labels
  const getPriorityLabel = (priority) => {
    const map = {
      'HIGH': { label: 'P0 - HIGH', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
      'MEDIUM': { label: 'P1 - MED', color: 'bg-orange-500/10 text-orange-400 border-orange-500/20' },
      'LOW': { label: 'P2 - LOW', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' }
    };
    return map[priority] || { label: priority, color: 'bg-slate-500/10 text-slate-400 border-slate-500/20' };
  };

  // HELPER: Calculate individual MTT (Duration)
  const calculateMTT = (start, end) => {
    const startTime = new Date(start);
    const endTime = end ? new Date(end) : new Date();
    const diff = (endTime - startTime) / 1000;
    return diff.toFixed(1) + "s";
  };

  const refresh = async () => {
    try {
      const [sigRes, metRes] = await Promise.all([
        axios.get(`${API_BASE}/incidents`), // Matches your @app.get("/incidents")
        axios.get(`${API_BASE}/metrics`)    // Matches your @app.get("/metrics")
      ]);
      setData(sigRes.data);
      setMetrics(metRes.data);
    } catch (e) {
      console.error("Dashboard Sync Error", e);
    }
  };

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
  }, []);

  const submitRCA = async () => {
    if (!rcaItem || !rcaItem.id) return;
    try {
      // Matches your backend rca.get("incident_id")
      await axios.post(`${API_BASE}/rca`, {
        incident_id: rcaItem.id, 
        root_cause: rcaData.root_cause,
        action_taken: rcaData.action_taken,
        impact_level: rcaData.impact_level
      });
      
      setRcaItem(null);
      setRcaData({ root_cause: '', action_taken: '', resolved_by: 'Admin User', impact_level: 'LOW' });
      await refresh();
    } catch (e) {
      console.error("RCA Submission Error:", e);
      alert("Failed to resolve incident.");
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="mb-10 border-b border-slate-800 pb-6 flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-black text-white uppercase italic tracking-tighter">IMS Control Tower</h1>
            <p className="text-slate-400 text-sm font-medium italic">Resilient Incident Management Feed</p>
          </div>
          <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
            System Status: <span className="text-emerald-500 font-bold">Operational</span>
          </div>
        </header>

        {/* Real-time Metrics Card Section */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <MetricCard title="Ingress" value={metrics.ingress} sub="Kafka Signals" icon={<Activity size={20}/>} color="text-blue-500" />
          <MetricCard title="Persisted" value={metrics.persisted} sub="Postgres Events" icon={<Database size={20}/>} color="text-indigo-500" />
          <MetricCard title="Cache" value={metrics.cache_active} sub="Redis Sessions" icon={<ShieldCheck size={20}/>} color="text-emerald-500" />
          <MetricCard title="Avg MTTR" value={metrics.avg_mttr} sub="Global Resolution" icon={<Clock size={20}/>} color="text-orange-500" />
        </div>

        {/* Main Incident Feed Table */}
        <div className="bg-[#0f172a] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
          <table className="w-full text-left">
            <thead className="bg-slate-800/50 text-[10px] uppercase font-bold text-slate-500">
              <tr>
                <th className="p-5">Priority</th>
                <th className="p-5">Source ID</th>
                <th className="p-5">Type</th>
                <th className="p-5">Status</th>
                <th className="p-5">MTT (Duration)</th>
                <th className="p-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map(item => {
                const prio = getPriorityLabel(item.priority);
                return (
                  <tr key={item.id} onClick={() => setSelectedItem(item)} className="border-b border-slate-800/50 hover:bg-white/[0.02] cursor-pointer transition-colors">
                    <td className="p-5">
                      <span className={`px-2 py-1 rounded text-[10px] font-bold border ${prio.color}`}>
                        {prio.label}
                      </span>
                    </td>
                    <td className="p-5 font-mono text-sm text-indigo-300">{item.source_id}</td>
                    <td className="p-5 text-xs text-slate-400 font-mono uppercase">{item.type || 'N/A'}</td>
                    <td className="p-5 text-xs font-semibold uppercase">{item.status}</td>
                    <td className="p-5 font-mono text-xs text-orange-400">
                      {calculateMTT(item.created_at, item.resolved_at)}
                    </td>
                    <td className="p-5 text-right">
                      {item.status === 'OPEN' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setRcaItem(item); }}
                          className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded text-[10px] font-black uppercase tracking-widest transition-all shadow-lg"
                        >
                          Run RCA
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail JSON Modal */}
      {selectedItem && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 z-50">
          <div className="bg-[#0f172a] border border-slate-700 w-full max-w-2xl rounded-2xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2 text-white"><Terminal size={20}/> Signal Metadata</h2>
              <button onClick={() => setSelectedItem(null)} className="text-slate-400 hover:text-white"><X/></button>
            </div>
            <pre className="bg-black p-5 rounded-xl text-emerald-500 font-mono text-xs overflow-auto max-h-[500px] border border-emerald-500/20">
              {JSON.stringify(selectedItem, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {/* Enhanced RCA Form Modal */}
      {rcaItem && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[60] p-4">
          <div className="bg-[#0f172a] border border-indigo-500/30 w-full max-w-xl rounded-2xl p-8 shadow-2xl">
            <h2 className="text-2xl font-black text-white mb-2 uppercase italic tracking-tight">
              RCA Analysis: <span className="text-indigo-400">{rcaItem.source_id}</span>
            </h2>
            <div className="flex items-center gap-2 mb-6 text-slate-500 text-[10px] font-bold uppercase tracking-widest">
                <Info size={14}/> Active Latency: {calculateMTT(rcaItem.created_at, null)}
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500">System Impact</label>
                <select 
                   className="w-full bg-black p-3 rounded border border-slate-800 text-xs text-white outline-none focus:border-indigo-500"
                   onChange={e => setRcaData({...rcaData, impact_level: e.target.value})}
                >
                    <option value="LOW">P2 - Minor Variation</option>
                    <option value="MEDIUM">P1 - Partial Outage</option>
                    <option value="HIGH">P0 - Critical System Failure</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500">Root Cause Analysis</label>
                <textarea
                  placeholder="Identify source of failure..."
                  className="w-full bg-black p-3 rounded border border-slate-800 text-xs text-white h-20 outline-none focus:border-indigo-500"
                  onChange={e => setRcaData({...rcaData, root_cause: e.target.value})}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-slate-500">Remediation Steps</label>
                <textarea
                  placeholder="Describe resolution actions..."
                  className="w-full bg-black p-3 rounded border border-slate-800 text-xs text-white h-20 outline-none focus:border-indigo-500"
                  onChange={e => setRcaData({...rcaData, action_taken: e.target.value})}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button onClick={() => setRcaItem(null)} className="flex-1 border border-slate-700 py-3 rounded font-bold text-xs uppercase hover:bg-slate-800 transition-all">Cancel</button>
                <button onClick={submitRCA} className="flex-[2] bg-indigo-600 py-3 rounded font-black text-xs uppercase hover:bg-indigo-500 transition-all shadow-lg">Submit Resolution</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
