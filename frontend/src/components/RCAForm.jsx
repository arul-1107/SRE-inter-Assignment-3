import React, { useState } from 'react';

const RCAForm = ({ incidentId, onSubmited }) => {
  const [formData, setFormData] = useState({
    category: 'CODE_BUG',
    fixApplied: '',
    preventionSteps: '',
    endTime: new Date().toISOString()
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Requirement 3.2: Submission to move status to CLOSED
    const response = await fetch(`/api/incidents/${incidentId}/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    
    if (response.ok) onSubmited();
    else alert("Cannot close: RCA incomplete!"); // PDF Mandatory check
  };

  return (
    <form onSubmit={handleSubmit} className="bg-gray-900 p-6 rounded-lg text-white">
      <h3 className="text-xl font-bold mb-4">Root Cause Analysis</h3>
      
      <label className="block mb-2">Category</label>
      <select 
        className="w-full bg-gray-800 p-2 mb-4"
        onChange={(e) => setFormData({...formData, category: e.target.value})}
      >
        <option value="RDBMS_OUTAGE">RDBMS Outage</option>
        <option value="CACHE_EVIVAL">Cache Eviction</option>
        <option value="API_LATENCY">API Latency</option>
      </select>

      <label className="block mb-2">Fix Applied</label>
      <textarea 
        className="w-full bg-gray-800 p-2 mb-4" 
        onChange={(e) => setFormData({...formData, fixApplied: e.target.value})}
        required 
      />

      <button type="submit" className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded">
        Submit RCA & Close Incident
      </button>
    </form>
  );
};
