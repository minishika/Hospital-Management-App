import React, { useState, useEffect } from "react";
import axios from "axios";

const API_URL = "http://127.0.0.1:8000";

export default function DoctorDashboard({ doctorId }) {
  // Local State for the Doctor Dashboard
  const [queue, setQueue] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [consultData, setConsultData] = useState({
    symptoms: "",
    diagnosis: "",
    prescription: "",
    medicine_cost: 0,
  });

  // Fetch the queue as soon as the component loads or the doctorId changes
  useEffect(() => {
    if (doctorId) {
      loadQueue();
    }
  }, [doctorId]);

  const loadQueue = async () => {
    try {
      const response = await axios.get(`${API_URL}/doctor/${doctorId}/queue`);
      setQueue(response.data.smart_queue || []);
    } catch (error) {
      console.error("Error loading queue", error);
    }
  };

  const handleAttend = async (e) => {
    e.preventDefault();
    try {
      await axios.post(
        `${API_URL}/attend-patient/${selectedPatient.appointment_id}`,
        consultData,
      );
      alert("Consultation complete! Prescriptions and Bills forwarded.");

      // Reset state and refresh queue
      setSelectedPatient(null);
      setConsultData({
        symptoms: "",
        diagnosis: "",
        prescription: "",
        medicine_cost: 0,
      });
      loadQueue();
    } catch (error) {
      console.error("Error saving record", error);
    }
  };

  return (
    <div>
      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">My Console</h2>
          <p className="text-blue-600 font-medium">Doctor ID: {doctorId}</p>
        </div>
        <button
          className="border-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white font-semibold py-2 px-4 rounded-lg transition"
          onClick={loadQueue}
        >
          🔄 Refresh Queue
        </button>
      </div>

      {/* QUEUE TABLE */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-800 text-white">
            <tr>
              <th className="py-4 px-6 font-semibold text-sm">Token #</th>
              <th className="py-4 px-6 font-semibold text-sm">Patient Name</th>
              <th className="py-4 px-6 font-semibold text-sm">Urgency</th>
              <th className="py-4 px-6 font-semibold text-sm">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {queue.length === 0 ? (
              <tr>
                <td colSpan="4" className="py-8 text-center text-gray-500">
                  Queue is empty.
                </td>
              </tr>
            ) : (
              queue.map((p) => (
                <tr key={p.appointment_id} className="hover:bg-gray-50">
                  <td className="py-4 px-6 font-bold">#{p.appointment_id}</td>
                  <td className="py-4 px-6">{p.patient_name}</td>
                  <td className="py-4 px-6">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        p.urgency_level >= 4
                          ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      Level {p.urgency_level}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <button
                      className="bg-green-500 hover:bg-green-600 text-white py-1 px-4 rounded-md shadow-sm transition"
                      onClick={() => setSelectedPatient(p)}
                    >
                      Attend
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* CONSULTATION MODAL */}
      {selectedPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="bg-blue-600 px-6 py-4 flex justify-between items-center">
              <h5 className="text-xl font-bold text-white">
                Consultation: {selectedPatient.patient_name}
              </h5>
              <button
                className="text-blue-100 hover:text-white text-3xl font-light leading-none"
                onClick={() => setSelectedPatient(null)}
              >
                &times;
              </button>
            </div>
            <div className="p-6">
              <form onSubmit={handleAttend} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Symptoms
                  </label>
                  <textarea
                    className="w-full border rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500"
                    rows="2"
                    value={consultData.symptoms}
                    onChange={(e) =>
                      setConsultData({
                        ...consultData,
                        symptoms: e.target.value,
                      })
                    }
                    required
                  ></textarea>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Diagnosis
                  </label>
                  <input
                    type="text"
                    className="w-full border rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500"
                    value={consultData.diagnosis}
                    onChange={(e) =>
                      setConsultData({
                        ...consultData,
                        diagnosis: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prescription
                  </label>
                  <textarea
                    className="w-full border rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500"
                    rows="3"
                    value={consultData.prescription}
                    onChange={(e) =>
                      setConsultData({
                        ...consultData,
                        prescription: e.target.value,
                      })
                    }
                    required
                  ></textarea>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Medicine Cost ($)
                  </label>
                  <input
                    type="number"
                    className="w-full border rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500"
                    value={consultData.medicine_cost}
                    onChange={(e) =>
                      setConsultData({
                        ...consultData,
                        medicine_cost: parseFloat(e.target.value) || 0,
                      })
                    }
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-lg transition shadow-md"
                >
                  Complete Consultation & Dispatch Records
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
