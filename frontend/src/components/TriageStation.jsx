import React, { useState, useEffect } from "react";
import axios from "axios";

export default function TriageStation() {
  const [queue, setQueue] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [vitals, setVitals] = useState({
    blood_pressure: "",
    temperature: "",
    weight: "",
    oxygen_level: "",
  });

  // Fetch the pending patients when the component loads
  useEffect(() => {
    fetchQueue();
  }, []);

  const fetchQueue = async () => {
    try {
      const res = await axios.get("http://127.0.0.1:8000/triage/queue");
      setQueue(res.data);
    } catch (error) {
      console.error("Failed to fetch triage queue", error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // 1. Changed 'payload' to 'vitals'
      // 2. Safely grab the ID whether the backend calls it 'id' or 'appointment_id'
      const idToUse = selectedPatient.appointment_id || selectedPatient.id;

      await axios.post(
        `http://127.0.0.1:8000/triage/vitals/${idToUse}`,
        vitals,
      );

      alert("Vitals saved successfully! Patient forwarded to doctor.");
      setSelectedPatient(null);
      setVitals({
        blood_pressure: "",
        temperature: "",
        weight: "",
        oxygen_level: "",
      });
      fetchQueue();
    } catch (error) {
      console.error("Error saving vitals", error);
      alert("Failed to save vitals.");
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-800">
          Nurse Triage Station
        </h2>
        <button
          onClick={fetchQueue}
          className="border-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white font-semibold py-2 px-4 rounded-lg transition"
        >
          🔄 Refresh Queue
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-800 text-white">
            <tr>
              <th className="py-4 px-6 font-semibold text-sm">Token #</th>
              <th className="py-4 px-6 font-semibold text-sm">Patient Name</th>
              <th className="py-4 px-6 font-semibold text-sm">Status</th>
              <th className="py-4 px-6 font-semibold text-sm">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {queue.length === 0 ? (
              <tr>
                <td colSpan="4" className="py-8 text-center text-gray-500">
                  No patients waiting for triage.
                </td>
              </tr>
            ) : (
              queue.map((p) => (
                <tr key={p.appointment_id} className="hover:bg-gray-50">
                  <td className="py-4 px-6 font-bold">#{p.appointment_id}</td>
                  <td className="py-4 px-6">{p.patient_name}</td>
                  <td className="py-4 px-6">
                    <span className="px-3 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700">
                      Pending Vitals
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <button
                      className="bg-blue-500 hover:bg-blue-600 text-white py-1 px-4 rounded-md shadow-sm transition"
                      onClick={() => setSelectedPatient(p)}
                    >
                      Take Vitals
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* VITALS MODAL */}
      {selectedPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-slate-800 px-6 py-4 flex justify-between items-center">
              <h5 className="text-xl font-bold text-white">
                Vitals: {selectedPatient.patient_name}
              </h5>
              <button
                className="text-gray-300 hover:text-white text-3xl font-light leading-none"
                onClick={() => setSelectedPatient(null)}
              >
                &times;
              </button>
            </div>
            <div className="p-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Blood Pressure (mmHg)
                  </label>
                  <input
                    type="text"
                    placeholder="120/80"
                    required
                    className="w-full border rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500"
                    value={vitals.blood_pressure}
                    onChange={(e) =>
                      setVitals({ ...vitals, blood_pressure: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Temperature (°F)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="98.6"
                    required
                    className="w-full border rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500"
                    value={vitals.temperature}
                    onChange={(e) =>
                      setVitals({ ...vitals, temperature: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Weight (kg)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    placeholder="70"
                    required
                    className="w-full border rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500"
                    value={vitals.weight}
                    onChange={(e) =>
                      setVitals({ ...vitals, weight: e.target.value })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    SpO2 (%)
                  </label>
                  <input
                    type="number"
                    placeholder="99"
                    required
                    className="w-full border rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500"
                    value={vitals.oxygen_level}
                    onChange={(e) =>
                      setVitals({ ...vitals, oxygen_level: e.target.value })
                    }
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 rounded-lg transition shadow-md"
                >
                  Save & Forward to Doctor
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
