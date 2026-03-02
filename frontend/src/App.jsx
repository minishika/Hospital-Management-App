import { useState, useEffect } from "react";
import axios from "axios";
import baby from "./assets/baby.jpg";
import emergency from "./assets/emergency.jpg";
import home from "./assets/home.jpg";
import walk from "./assets/walkway.jpg";
import hospital from "./assets/Untitled.png";
import TriageStation from "./components/TriageStation";
import DoctorDashboard from "./components/DoctorDashboard";
// import Login from "../Login/Login"; // Ensure you are using the embedded login below or the component

const API_URL = "http://127.0.0.1:8000";

// Array of images for the slider
const sliderImages = [home, emergency, walk, baby];

function App() {
  const [view, setView] = useState("home");

  // App State
  const [doctorsList, setDoctorsList] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);

  // Slider State
  const [currentSlide, setCurrentSlide] = useState(0);

  // Registration State
  const [patientData, setPatientData] = useState({
    patient_name: "",
    doctor_id: "",
    urgency_level: 1,
    wait_time_mins: 0,
  });
  const [bookingMessage, setBookingMessage] = useState("");

  // Login State
  const [loginData, setLoginData] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");

  // Module States
  const [prescriptions, setPrescriptions] = useState([]);
  const [bills, setBills] = useState([]);

  // --- INITIAL LOAD & SLIDER TIMER ---
  useEffect(() => {
    // Fetch doctors
    axios
      .get(`${API_URL}/doctors`)
      .then((res) => {
        setDoctorsList(res.data);
        if (res.data.length > 0)
          setPatientData((prev) => ({ ...prev, doctor_id: res.data[0].id }));
      })
      .catch((err) => console.error("Error fetching doctors", err));

    // Background Slider Interval (Slides every 4 seconds)
    const slideInterval = setInterval(() => {
      setCurrentSlide((prev) =>
        prev === sliderImages.length - 1 ? 0 : prev + 1,
      );
    }, 4000);

    return () => clearInterval(slideInterval); // Cleanup on unmount
  }, []);

  // --- HANDLERS ---
  const handleLoginSubmit = async (e) => {
    e.preventDefault();

    // --- TEMPORARY MOCK LOGIN LOGIC ---
    // Since we don't know your exact FastAPI login route, this assigns a role based on the username typed.
    // E.g., typing "nurse_triage" makes you a Nurse. Typing "dr_smith" makes you a Doctor.
    let assignedRole = "Admin"; // Default role
    const typedUser = loginData.username.toLowerCase();

    if (typedUser.includes("nurse")) assignedRole = "Nurse";
    else if (typedUser.includes("doc") || typedUser.includes("dr"))
      assignedRole = "Doctor";
    else if (typedUser.includes("pharm")) assignedRole = "Pharmacist";
    else if (typedUser.includes("reception")) assignedRole = "Receptionist";

    // Simulate successful login data
    const userData = {
      username: loginData.username,
      role: assignedRole,
      id: 1,
    };

    handleLoginSuccess(userData);
  };

  const handleLoginSuccess = (userData) => {
    setCurrentUser(userData);

    // Route based on role automatically after login
    if (userData.role === "Nurse") {
      setView("triage");
    } else if (userData.role === "Doctor") {
      setView("doctor");
    } else if (userData.role === "Pharmacist") {
      setView("pharmacy");
      loadPharmacy();
    } else if (userData.role === "Receptionist" || userData.role === "Admin") {
      setView("billing");
      loadBills();
    } else {
      setView("home");
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setLoginData({ username: "", password: "" }); // Clear form
    setView("home");
  };

  const handleBookPatient = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(
        `${API_URL}/book-appointment/`,
        patientData,
      );
      setBookingMessage(`Success! Token ID: #${response.data.appointment_id}`);
      setPatientData({ ...patientData, patient_name: "", wait_time_mins: 0 });
      setTimeout(() => setBookingMessage(""), 5000);
    } catch (error) {
      console.error("Booking failed", error);
    }
  };

  const loadPharmacy = async () => {
    try {
      const response = await axios.get(`${API_URL}/pharmacy/prescriptions`);
      setPrescriptions(response.data);
    } catch (error) {
      console.error("Error loading pharmacy", error);
    }
  };

  const loadBills = async () => {
    try {
      const response = await axios.get(`${API_URL}/billing/invoices`);
      setBills(response.data);
    } catch (error) {
      console.error("Error loading bills", error);
    }
  };

  const handlePayment = async (bill_id) => {
    try {
      await axios.post(`${API_URL}/billing/pay/${bill_id}`);
      alert("Payment processed successfully!");
      loadBills();
    } catch (error) {
      console.error("Payment failed", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* TOP NAVIGATION HEADER */}
      <nav className="bg-slate-900 text-white shadow-lg sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-32">
            {/* LOGO AREA */}
            <div
              className="flex items-center cursor-pointer"
              onClick={() => setView("home")}
            >
              <img
                src={hospital}
                className="text-3xl mr-2 h-16 w-16"
                alt="Hospital Logo"
              />
              <div className="flex flex-col mr-2">
                <span className="font-bold text-6xl tracking-wide">MAX</span>
                <span className="font-bold text-sm tracking-wide text-blue-400">
                  Healthcare
                </span>
              </div>
            </div>

            {/* DYNAMIC NAVIGATION LINKS */}
            <div className="hidden md:flex space-x-2 items-center">
              {/* Home is visible to everyone */}
              <button
                onClick={() => setView("home")}
                className={`px-4 py-2 rounded-md font-medium transition ${
                  view === "home"
                    ? "bg-blue-600 text-white"
                    : "hover:bg-slate-700 text-gray-200"
                }`}
              >
                🏠 Home
              </button>

              {/* Public or Admin/Receptionist can see Register */}
              {(!currentUser ||
                currentUser?.role === "Admin" ||
                currentUser?.role === "Receptionist" ||
                currentUser?.role === "Nurse") && (
                <button
                  onClick={() => setView("patient")}
                  className={`px-4 py-2 rounded-md font-medium transition ${
                    view === "patient"
                      ? "bg-blue-600 text-white"
                      : "hover:bg-slate-700 text-gray-200"
                  }`}
                >
                  🩺 Register
                </button>
              )}

              {/* RESTRICTED PANELS FOR LOGGED IN STAFF */}
              {currentUser && (
                <>
                  {/* DOCTORS ONLY */}
                  {currentUser.role === "Doctor" && (
                    <button
                      onClick={() => setView("doctor")}
                      className={`px-4 py-2 rounded-md font-medium transition ${
                        view === "doctor"
                          ? "bg-blue-600 text-white"
                          : "hover:bg-slate-700 text-gray-200"
                      }`}
                    >
                      👨‍⚕️ My Console
                    </button>
                  )}

                  {/* PHARMACISTS ONLY */}
                  {/* PHARMACY: Visible to Pharmacist AND Nurse */}
                  {(currentUser.role === "Pharmacist" ||
                    currentUser.role === "Nurse") && (
                    <button
                      onClick={() => {
                        setView("pharmacy");
                        loadPharmacy();
                      }}
                      className={`px-4 py-2 rounded-md font-medium ${view === "pharmacy" ? "bg-blue-600" : "hover:bg-slate-700"}`}
                    >
                      💊 Pharmacy
                    </button>
                  )}

                  {/* BILLING: Visible to Admin, Receptionist, AND Nurse */}
                  {(currentUser.role === "Admin" ||
                    currentUser.role === "Receptionist" ||
                    currentUser.role === "Nurse") && (
                    <button
                      onClick={() => {
                        setView("billing");
                        loadBills();
                      }}
                      className={`px-4 py-2 rounded-md font-medium ${view === "billing" ? "bg-blue-600" : "hover:bg-slate-700"}`}
                    >
                      💳 Billing
                    </button>
                  )}

                  {/* NURSES ONLY */}
                  {currentUser.role === "Nurse" && (
                    <button
                      onClick={() => setView("triage")}
                      className={`px-4 py-2 rounded-md font-medium transition ${
                        view === "triage"
                          ? "bg-blue-600 text-white"
                          : "hover:bg-slate-700 text-gray-200"
                      }`}
                    >
                      🌡️ Triage
                    </button>
                  )}

                  {currentUser.role === "Doctor" && (
                    <div className="flex items-center ml-6 border-l border-slate-600 pl-6">
                      <span className="text-gray-300 mr-2">
                        Nurse Logged in
                      </span>
                      <span className="text-green-400 font-bold mr-4">
                        {currentUser.name}
                      </span>
                      <button
                        onClick={handleLogout}
                        className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-md text-sm font-bold transition text-white shadow-md"
                      >
                        Logout
                      </button>
                    </div>
                  )}

                  {/* LOGGED IN USER INFO TRAY */}
                  {currentUser.role === "Nurse" && (
                    <div className="flex items-center ml-6 border-l border-slate-600 pl-6">
                      <span className="text-gray-300 mr-2">Logged in as:</span>
                      <span className="text-green-400 font-bold mr-4">
                        Nurse
                      </span>
                      <button
                        onClick={handleLogout}
                        className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-md text-sm font-bold transition text-white shadow-md"
                      >
                        Logout
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* STAFF LOGIN BUTTON (Only visible when logged out) */}
              {!currentUser && (
                <button
                  onClick={() => setView("login")}
                  className="ml-4 bg-slate-700 hover:bg-slate-600 px-4 py-2 rounded-md font-bold transition border border-slate-500"
                >
                  Staff Login
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* VIEW 0: HOME */}
        {view === "home" && (
          <div className="space-y-12">
            <div className="relative rounded-3xl overflow-hidden shadow-2xl h-[70vh] min-h-[500px] flex items-center justify-center">
              <div
                className="absolute inset-0 flex transition-transform duration-1000 ease-in-out z-0"
                style={{ transform: `translateX(-${currentSlide * 100}%)` }}
              >
                {sliderImages.map((img, index) => (
                  <img
                    key={index}
                    src={img}
                    alt={`Slide ${index}`}
                    className="w-full h-full flex-shrink-0 object-cover"
                  />
                ))}
              </div>

              <div
                className="absolute inset-0 z-10 pointer-events-none"
                style={{ backgroundColor: "rgba(15, 23, 42, 0.6)" }}
              ></div>

              <div className="relative z-20 text-center p-8 md:p-12 max-w-3xl mx-auto bg-slate-900/40 backdrop-blur-sm rounded-2xl border border-white/10 shadow-2xl text-white">
                <h1 className="text-4xl md:text-5xl font-extrabold mb-4 font-serif leading-tight">
                  Transformative Care <br /> for over 125 Years
                </h1>
                <p className="text-lg md:text-xl text-gray-200 mb-8 max-w-2xl mx-auto">
                  Providing world-class healthcare with smart queue management,
                  expert doctors, and seamless patient experiences.
                </p>
                <button
                  onClick={() => setView("patient")}
                  className="bg-yellow-500 text-slate-900 font-bold text-lg px-8 py-3 rounded-md shadow-lg hover:bg-yellow-400 transition transform hover:scale-105"
                >
                  Book an Appointment
                </button>
              </div>
            </div>

            {/* About & Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center mt-12">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 transition hover:shadow-md">
                <div className="text-4xl mb-3">🚑</div>
                <h3 className="text-xl font-bold text-gray-800">
                  24/7 Emergency
                </h3>
                <p className="text-gray-500 mt-2">
                  Always ready to handle critical care situations.
                </p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 transition hover:shadow-md">
                <div className="text-4xl mb-3">👨‍⚕️</div>
                <h3 className="text-xl font-bold text-gray-800">
                  Expert Specialists
                </h3>
                <p className="text-gray-500 mt-2">
                  Top-tier medical professionals.
                </p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 transition hover:shadow-md">
                <div className="text-4xl mb-3">⚡</div>
                <h3 className="text-xl font-bold text-gray-800">
                  Zero Wait Time
                </h3>
                <p className="text-gray-500 mt-2">
                  Smart Queue algorithm ensures you are seen on time.
                </p>
              </div>
            </div>

            {/* Departments Grid */}
            <div>
              <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">
                Our Departments & Doctors
              </h2>
              {doctorsList.length === 0 ? (
                <p className="text-center text-red-500 bg-red-50 p-4 rounded-lg border border-red-200">
                  No departments found. Please ensure the backend is running.
                </p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {doctorsList.map((doc) => (
                    <div
                      key={doc.id}
                      className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 text-center hover:shadow-md transition"
                    >
                      <p className="font-bold text-slate-800">
                        {doc.department}
                      </p>
                      <p className="text-sm text-gray-500">{doc.name}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* VIEW 0.5: LOGIN */}
        {view === "login" && (
          <div className="max-w-md mx-auto mt-10 bg-white p-8 rounded-xl shadow-lg border border-gray-100">
            <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">
              Staff Secure Portal
            </h2>
            {loginError && (
              <div className="bg-red-100 text-red-700 p-3 rounded mb-4 text-center text-sm">
                {loginError}
              </div>
            )}
            {/* FIXED: We now call handleLoginSubmit so it passes the correct data instead of a blank event */}
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  required
                  className="w-full border rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500"
                  value={loginData.username}
                  onChange={(e) =>
                    setLoginData({ ...loginData, username: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  className="w-full border rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500"
                  value={loginData.password}
                  onChange={(e) =>
                    setLoginData({ ...loginData, password: e.target.value })
                  }
                />
              </div>
              <button
                type="submit"
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-lg transition"
              >
                Log In
              </button>
            </form>
          </div>
        )}

        {/* VIEW 1: REGISTRATION */}
        {view === "patient" && (
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold text-gray-800 mb-6">
              Register New Patient
            </h2>
            {bookingMessage && (
              <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-6 rounded shadow-sm font-bold">
                {bookingMessage}
              </div>
            )}
            <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
              <form onSubmit={handleBookPatient} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Patient Full Name
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full border rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500"
                    value={patientData.patient_name}
                    onChange={(e) =>
                      setPatientData({
                        ...patientData,
                        patient_name: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Department / Doctor
                    </label>
                    <select
                      required
                      className="w-full border rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500"
                      value={patientData.doctor_id}
                      onChange={(e) =>
                        setPatientData({
                          ...patientData,
                          doctor_id: parseInt(e.target.value),
                        })
                      }
                    >
                      <option value="" disabled>
                        Select a department
                      </option>
                      {doctorsList.map((doc) => (
                        <option key={doc.id} value={doc.id}>
                          {doc.department} ({doc.name})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Triage Urgency
                    </label>
                    <select
                      className="w-full border rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500"
                      value={patientData.urgency_level}
                      onChange={(e) =>
                        setPatientData({
                          ...patientData,
                          urgency_level: parseInt(e.target.value),
                        })
                      }
                    >
                      <option value={1}>1 - Routine</option>
                      <option value={3}>3 - Moderate</option>
                      <option value={5}>5 - Emergency</option>
                    </select>
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition"
                >
                  Add to Queue
                </button>
              </form>
            </div>
          </div>
        )}

        {/* VIEW 2: DOCTOR CONSOLE */}
        {view === "doctor" && currentUser?.role === "Doctor" && (
          <DoctorDashboard doctorId={currentUser.id} />
        )}

        {/* VIEW 3: PHARMACY */}
        {view === "pharmacy" &&
          (currentUser?.role === "Pharmacist" ||
            currentUser?.role === "Nurse") && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-gray-800">
                  Pharmacy Hub
                </h2>
                <button
                  className="border-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white font-semibold py-2 px-4 rounded-lg transition"
                  onClick={loadPharmacy}
                >
                  🔄 Refresh Scripts
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {prescriptions.length === 0 ? (
                  <p className="text-gray-500">No active prescriptions.</p>
                ) : (
                  prescriptions.map((script) => (
                    <div
                      key={script.record_id}
                      className="bg-white p-6 rounded-xl shadow-md border-l-4 border-blue-500"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="text-xl font-bold text-gray-800">
                          {script.patient_name}
                        </h3>
                        <span className="text-sm text-gray-500">
                          {script.date}
                        </span>
                      </div>
                      <div className="mb-4">
                        <p className="text-sm text-gray-500 uppercase font-semibold">
                          Diagnosis
                        </p>
                        <p className="bg-gray-50 p-2 rounded mt-1 border">
                          {script.diagnosis}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-500 uppercase font-semibold">
                          Prescribed
                        </p>
                        <p className="bg-blue-50 p-3 rounded mt-1 border border-blue-100 font-mono text-sm whitespace-pre-wrap">
                          {script.prescription}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        {/* VIEW 4: BILLING */}
        {view === "billing" &&
          (currentUser?.role === "Admin" ||
            currentUser?.role === "Receptionist" ||
            currentUser?.role === "Nurse") && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-gray-800">
                  Billing & Finance
                </h2>
                <button
                  className="border-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white font-semibold py-2 px-4 rounded-lg transition"
                  onClick={loadBills}
                >
                  🔄 Refresh
                </button>
              </div>
              <div className="bg-white rounded-xl shadow-md overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-800 text-white">
                    <tr>
                      <th className="py-4 px-6 font-semibold text-sm">
                        Invoice ID
                      </th>
                      <th className="py-4 px-6 font-semibold text-sm">
                        Patient
                      </th>
                      <th className="py-4 px-6 font-semibold text-sm">Total</th>
                      <th className="py-4 px-6 font-semibold text-sm">
                        Status
                      </th>
                      <th className="py-4 px-6 font-semibold text-sm">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {bills.length === 0 ? (
                      <tr>
                        <td
                          colSpan="5"
                          className="py-8 text-center text-gray-500"
                        >
                          No invoices.
                        </td>
                      </tr>
                    ) : (
                      bills.map((bill) => (
                        <tr key={bill.bill_id} className="hover:bg-gray-50">
                          <td className="py-4 px-6 font-bold">
                            INV-{1000 + bill.bill_id}
                          </td>
                          <td className="py-4 px-6">{bill.patient_name}</td>
                          <td className="py-4 px-6 font-bold">
                            ${bill.total_amount}
                          </td>
                          <td className="py-4 px-6">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-bold ${
                                bill.payment_status === "Paid"
                                  ? "bg-green-100 text-green-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {bill.payment_status}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            {bill.payment_status === "Unpaid" ? (
                              <button
                                className="bg-blue-600 hover:bg-blue-700 text-white py-1 px-4 rounded-md transition shadow-sm"
                                onClick={() => handlePayment(bill.bill_id)}
                              >
                                Pay
                              </button>
                            ) : (
                              <button
                                className="bg-gray-200 text-gray-500 py-1 px-4 rounded-md cursor-not-allowed"
                                disabled
                              >
                                Receipt Issued
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        {/* VIEW 5: TRIAGE */}
        {view === "triage" && currentUser?.role === "Nurse" && (
          <TriageStation />
        )}
      </main>
    </div>
  );
}

export default App;
