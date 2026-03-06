import { useState, useEffect } from "react";
import axios from "axios";
import baby from "./assets/baby.jpg";
import emergency from "./assets/emergency.jpg";
import home from "./assets/home.jpg";
import walk from "./assets/walkway.jpg";
import hospital from "./assets/Untitled.png";
import appt from "./assets/appointment.png";
import trg from "./assets/triage.png";
import hom from "./assets/home.png";
import phar from "./assets/pharmacy.png";
import bill from "./assets/bill.png";
import reg from "./assets/register.png";
import mycon from "./assets/myconsloe.png";
import schedule from "./assets/calendar.png";
import logout from "./assets/switch.png";
import ser from "./assets/service.png";
import exp from "./assets/experts.png";
import thu from "./assets/thunder.png";
import TriageStation from "./components/TriageStation";
import DoctorDashboard from "./components/DoctorDashboard";
// import Login from "../Login/Login"; // Ensure you are using the embedded login below or the component

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

// Array of images for the slider
const sliderImages = [home, emergency, walk, baby];

function App() {
  const [view, setView] = useState("home");

  // App State
  const [doctorsList, setDoctorsList] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [adminHistory, setAdminHistory] = useState([]);

  // Slider State
  const [currentSlide, setCurrentSlide] = useState(0);

  // Registration State
  const [patientData, setPatientData] = useState({
    patient_name: "",
    phone_number: "",
    doctor_id: "",
    condition: "",
    wait_time_mins: 0,
  });
  const [bookingMessage, setBookingMessage] = useState("");

  //Doctor Shedule

  //nurse Shedule
  const [nurseSchedule, setNurseSchedule] = useState([]);

  // Login State
  const [loginData, setLoginData] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");

  // Module States
  const [prescriptions, setPrescriptions] = useState([]);
  const [bills, setBills] = useState([]);

  const [conditions, setConditions] = useState([]);

  // --- INITIAL LOAD & SLIDER TIMER ---
  useEffect(() => {
    // Fetch doctors
    axios
      .get(`${API_URL}/doctors`)
      .then(async (res) => {
        setDoctorsList(res.data);

        if (res.data.length > 0) {
          const firstDoctor = res.data[0];

          // Set first doctor as default
          setPatientData((prev) => ({
            ...prev,
            doctor_id: Number(firstDoctor.id),
            condition: "",
          }));

          // 🔥 Fetch conditions for first doctor's department
          try {
            const conditionRes = await axios.get(
              `${API_URL}/triage-options/${firstDoctor.department}`,
            );
            setConditions(conditionRes.data.conditions);
          } catch (err) {
            console.error("Error fetching conditions", err);
          }
        }
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

  useEffect(() => {
    if (!patientData.doctor_id || doctorsList.length === 0) return;

    const selectedDoc = doctorsList.find(
      (doc) => doc.id === patientData.doctor_id,
    );

    if (selectedDoc) {
      axios
        .get(`${API_URL}/triage-options/${selectedDoc.department}`)
        .then((res) => {
          setConditions(res.data.conditions);

          // Reset condition when doctor changes
          setPatientData((prev) => ({
            ...prev,
            condition: "",
          }));
        })
        .catch((err) => console.error("Error fetching conditions", err));
    }
  }, [patientData.doctor_id, doctorsList]);

  //Doctor Schedule Loading

  //Nurse Schedule Loading
  const loadNurseSchedule = async () => {
    try {
      const response = await axios.get(`${API_URL}/nurse/appointments`);
      setNurseSchedule(response.data);
    } catch (error) {
      console.error("Error loading nurse schedule", error);
    }
  };

  // --- HANDLERS ---
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError("");

    try {
      const response = await axios.post(`${API_URL}/login`, loginData);

      handleLoginSuccess(response.data);
    } catch (error) {
      setLoginError("Invalid username or password");
    }
  };

  const loadAdminHistory = async () => {
    try {
      const response = await axios.get(`${API_URL}/admin/full-history`);
      setAdminHistory(response.data);
    } catch (error) {
      console.error("Error loading admin history", error);
    }
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
    } else if (userData.role === "Admin") {
      setView("admin");
      loadAdminHistory();
    } else if (userData.role === "Receptionist") {
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
      setBookingMessage(
        `Success! Token ID: #${response.data.appointment_id} | Time: ${response.data.appointment_time}`,
      );
      setPatientData((prev) => ({
        ...prev,
        patient_name: "",
        phone_number: "",
        condition: "",
        wait_time_mins: 0,
      }));

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
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-slate-800 text-gray-200 font-sans">
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
                className={`px-4 py-2 flex hover:scale-110 transition duration-250 rounded-md justify-center
                  cursor-pointer font-medium ${
                    view === "home"
                      ? "bg-purple-600 text-white"
                      : "hover:bg-purple-600 text-gray-200"
                  }`}
              >
                <img src={hom} className="w-6 h-6 mr-2" />
                Home
              </button>

              {/* Public or Admin/Receptionist can see Register */}
              {(!currentUser ||
                currentUser?.role === "Admin" ||
                currentUser?.role === "Receptionist" ||
                currentUser?.role === "Nurse") && (
                <button
                  onClick={() => setView("patient")}
                  className={`px-4 py-2 flex hover:scale-110 justify-center cursor-pointer transition duration-250 rounded-md font-medium ${
                    view === "patient"
                      ? "bg-purple-600 text-white"
                      : "hover:bg-purple-600 text-gray-200"
                  }`}
                >
                  <img src={reg} className="w-6 h-6 mr-2" />
                  Register
                </button>
              )}

              {/* RESTRICTED PANELS FOR LOGGED IN STAFF */}
              {currentUser && (
                <>
                  {/* DOCTORS ONLY */}
                  {currentUser.role === "Doctor" && (
                    <>
                      <button
                        onClick={() => setView("doctor")}
                        className={`px-4 py-2 rounded-md flex hover:scale-110 transition duration-250 cursor-pointer font-medium ${
                          view === "doctor"
                            ? "bg-purple-600 text-white"
                            : "hover:bg-purple-600 text-gray-200"
                        }`}
                      >
                        {" "}
                        <img src={mycon} className="w-6 h-6 mr-2" />
                        My Console
                      </button>

                      <button
                        onClick={() => {
                          setView("schedule");
                        }}
                        className={`px-4 py-2 flex hover:scale-110 cursor-pointer transition duration-250 rounded-md font-medium ${
                          view === "schedule"
                            ? "bg-purple-600 text-white"
                            : "hover:bg-purple-600 text-gray-200"
                        }`}
                      >
                        {" "}
                        <img src={schedule} className="w-6 h-6 mr-2" />
                        My Schedule
                      </button>
                    </>
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
                      className={`px-4 py-2 rounded-md flex cursor-pointer justify-center hover:scale-110 transition duration-250 font-medium ${view === "pharmacy" ? "bg-purple-600" : "hover:bg-purple-600"}`}
                    >
                      <img src={phar} className="w-6 h-6 mr-2" />
                      Pharmacy
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
                      className={`px-4 py-2 rounded-md flex cursor-pointer justify-center hover:scale-110 transition duration-250 font-medium ${view === "billing" ? "bg-purple-600" : "hover:bg-purple-600"}`}
                    >
                      <img src={bill} className="w-6 h-6 mr-2" />
                      Billing
                    </button>
                  )}

                  {/* NURSES ONLY */}
                  {currentUser.role === "Nurse" && (
                    <>
                      <button
                        onClick={() => setView("triage")}
                        className={`px-4 py-2 flex justify-center rounded-md cursor-pointer hover:scale-110 font-medium transition duration-250 ${
                          view === "triage"
                            ? "bg-purple-600 text-white"
                            : "hover:bg-purple-600 text-gray-200"
                        }`}
                      >
                        <img
                          src={trg}
                          className="w-6 h-6 mr-2 bg-white rounded"
                        />
                        Triage
                      </button>

                      <button
                        onClick={() => {
                          setView("nurseSchedule");
                          loadNurseSchedule();
                        }}
                        className={`px-4 py-2 flex justify-center rounded-md cursor-pointer hover:scale-110 transition duration-250 ${
                          view === "nurseSchedule"
                            ? "bg-purple-600"
                            : "hover:bg-purple-600"
                        }`}
                      >
                        <img src={appt} className="w-6 h-6 mr-2" />
                        Appointments
                      </button>
                    </>
                  )}

                  {currentUser.role === "Doctor" && (
                    <div className="flex items-center ml-6 border-l border-slate-600 pl-6">
                      <span className="text-gray-300 mr-2">Logged in as:</span>
                      <span className="text-green-400 font-bold mr-4">
                        {currentUser.name}
                      </span>
                      <button
                        onClick={handleLogout}
                        className="bg-red-600 hover:bg-red-700 hover:scale-110 px-4 py-2 rounded-md text-sm flex font-bold transition duration-250 cursor-pointer text-white shadow-md"
                      >
                        Logout
                        <img
                          src={logout}
                          className="w-4 h-4 ml-2 inline-block"
                        />
                      </button>
                    </div>
                  )}

                  {currentUser.role === "Admin" && (
                    <button
                      onClick={() => {
                        setView("admin");
                        loadAdminHistory();
                      }}
                      className={`px-4 py-2 rounded-md font-medium cursor-pointer hover:scale-110 transition duration-250 ${
                        view === "admin"
                          ? "bg-purple-600"
                          : "hover:bg-slate-700"
                      }`}
                    >
                      Admin Panel
                    </button>
                  )}

                  {/* LOGGED IN USER INFO TRAY */}
                  {currentUser.role === "Nurse" && (
                    <div className="flex items-center ml-6 border-l border-slate-600 pl-6">
                      <span className="text-gray-300 mr-2 text-sm">
                        Logged in as:
                      </span>
                      <span className="text-green-400 font-bold mr-4">
                        Nurse
                      </span>
                      <button
                        onClick={handleLogout}
                        className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-md cursor-pointer flex hover:scale-110 transition duration-250 text-sm font-bold text-white shadow-md"
                      >
                        Logout
                        <img
                          src={logout}
                          className="w-6 h-6 mx-2 inline-block"
                        />
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* STAFF LOGIN BUTTON (Only visible when logged out) */}
              {!currentUser && (
                <button
                  onClick={() => setView("login")}
                  className="ml-4 bg-slate-700 hover:bg-slate-200 hover:scale-110 cursor-pointer hover:text-violet-500 px-4 py-2 rounded-md font-bold transition duration-250 border border-slate-500"
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
            <div className="relative rounded-3xl overflow-hidden shadow-2xl h-[70vh] min-h-125 flex items-center justify-center">
              <div
                className="absolute inset-0 flex transition-transform duration-1000 ease-in-out z-0"
                style={{ transform: `translateX(-${currentSlide * 100}%)` }}
              >
                {sliderImages.map((img, index) => (
                  <img
                    key={index}
                    src={img}
                    alt={`Slide ${index}`}
                    className="w-full h-full shrink-0 object-cover"
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
                  className="bg-yellow-500 text-slate-900 font-bold text-lg px-8 py-3 rounded-md shadow-lg hover:bg-yellow-400 transition transform duration-200 hover:scale-105 cursor-pointer"
                >
                  Book an Appointment
                </button>
              </div>
            </div>

            {/* About & Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center mt-12">
              <div className="bg-slate-900/70 hover:scale-110 hover:bg-orange-900/25 hover:shadow-orange-300/50 hover:shadow-2xl backdrop-blur-lg border border-slate-700 p-6 rounded-xl shadow-sm transition duration-250 cursor-pointer">
                <div className="text-4xl mb-3 flex justify-center">
                  <img src={ser} className="w-25" />
                </div>
                <h3 className="text-xl font-bold text-white">24/7 Emergency</h3>
                <p className="text-orange-500 mt-2">
                  Always ready to handle critical care situations.
                </p>
              </div>
              <div className="bg-slate-900/70 hover:scale-110 hover:bg-orange-900/25 hover:shadow-orange-300/50 hover:shadow-2xl backdrop-blur-lg border border-slate-700 p-6 rounded-xl shadow-sm transition duration-250 cursor-pointer">
                <div className="text-4xl mb-3 flex justify-center">
                  <img src={exp} className="w-25" />
                </div>
                <h3 className="text-xl font-bold text-white">
                  Expert Specialists
                </h3>
                <p className="text-orange-500 mt-2">
                  Top-tier medical professionals.
                </p>
              </div>
              <div className="bg-slate-900/70 backdrop-blur-lg border hover:bg-orange-900/25 hover:shadow-orange-300/50 hover:shadow-2xl cursor-pointer border-slate-700 p-6 rounded-xl shadow-sm hover:scale-110 transition duration-300">
                <div className="text-4xl mb-3 flex justify-center">
                  <img src={thu} className="w-25" />
                </div>
                <h3 className="text-xl font-bold text-white">Zero Wait Time</h3>
                <p className="text-orange-500 mt-2">
                  Smart Queue algorithm ensures you are seen on time.
                </p>
              </div>
            </div>

            {/* Departments Grid */}
            <div>
              <h2 className="text-3xl font-bold text-white mb-6 text-center">
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
                      onClick={() => {
                        setPatientData((prev) => ({
                          ...prev,
                          doctor_id: Number(doc.id),
                        }));
                        setView("patient");
                      }}
                      className="bg-slate-900/70 backdrop-blur-lg border border-slate-700 p-4 rounded-lg shadow-sm text-center hover:shadow-md transition hover:bg-violet-400/30 cursor-pointer hover:scale-105"
                    >
                      <p className="font-bold text-green-400">
                        {doc.department}
                      </p>
                      <p className="text-sm text-gray-300">{doc.name}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {view === "nurseSchedule" && currentUser?.role === "Nurse" && (
          <div>
            <h2 className="text-3xl font-bold mb-6">All Appointments</h2>

            {nurseSchedule.length === 0 ? (
              <p>No scheduled appointments.</p>
            ) : (
              <div className="bg-slate-900/70 backdrop-blur-lg border border-slate-700 shadow rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-900 text-orange-400 border-b border-slate-700">
                    <tr className="hover:bg-slate-800/60 text-orange-500 transition border-b">
                      <th className="py-3 px-6 text-left">Patient</th>
                      <th className="py-3 px-6 text-center">Doctor</th>
                      <th className="py-3 px-6 text-center">Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nurseSchedule.map((item, index) => (
                      <tr
                        key={index}
                        className="hover:bg-slate-800/60 transition border-b"
                      >
                        <td className="py-3 px-6 text-left">
                          {item.patient_name}
                        </td>
                        <td className="py-3 px-6 text-center">
                          {item.doctor_name}
                        </td>
                        <td className="py-3 px-6 font-semibold text-purple-600 text-center">
                          {item.appointment_time}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* VIEW 0.5: LOGIN */}
        {view === "login" && (
          <div className="max-w-md mx-auto mt-10  p-8 rounded-xl shadow-lg border border-slate-700 bg-slate-900/70 backdrop-blur-lg">
            <h2 className="text-2xl font-bold text-center text-gray-200 mb-6">
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
                <label className="block text-sm font-medium text-violet-300 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  required
                  className="w-full border rounded-lg p-3 outline-none focus:ring-2 focus:ring-purple-500"
                  value={loginData.username}
                  onChange={(e) =>
                    setLoginData({ ...loginData, username: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-violet-300 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  className="w-full border rounded-lg p-3 outline-none focus:ring-2 focus:ring-purple-500"
                  value={loginData.password}
                  onChange={(e) =>
                    setLoginData({ ...loginData, password: e.target.value })
                  }
                />
              </div>
              <button
                type="submit"
                className="w-full bg-slate-900 hover:bg-green-500 cursor-pointer text-white font-bold py-3 rounded-lg transition"
              >
                Log In
              </button>
            </form>
          </div>
        )}

        {/* VIEW 1: REGISTRATION */}
        {view === "patient" && (
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold text-white mb-6">
              Register New Patient
            </h2>
            {bookingMessage && (
              <div className="bg-green-100 border-l-4 border-green-500 text-green-700 p-4 mb-6 rounded shadow-sm font-bold">
                {bookingMessage}
              </div>
            )}
            <div className="bg-slate-900/70 backdrop-blur-lg rounded-xl shadow-md p-6 border border-slate-700">
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number (with country code)
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+919876543210"
                    className="w-full border rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500"
                    value={patientData.phone_number}
                    onChange={(e) =>
                      setPatientData({
                        ...patientData,
                        phone_number: e.target.value,
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
                        <option
                          className="bg-slate-800"
                          key={doc.id}
                          value={doc.id}
                        >
                          {doc.department} ({doc.name})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Condition
                    </label>
                    <select
                      required
                      className="w-full border rounded-lg p-3 outline-none focus:ring-2 focus:ring-blue-500"
                      value={patientData.condition}
                      onChange={(e) =>
                        setPatientData({
                          ...patientData,
                          condition: e.target.value,
                        })
                      }
                    >
                      <option value="" disabled>
                        Select condition
                      </option>
                      {conditions.map((cond, index) => (
                        <option
                          className="bg-slate-800"
                          key={index}
                          value={cond}
                        >
                          {cond}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <button
                  type="submit"
                  className="w-full bg-slate-800 border border-slate-700 p-3 outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-white font-bold py-3 rounded-lg transition"
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
        {view === "schedule" && currentUser?.role === "Doctor" && (
          <DoctorDashboard doctorId={currentUser.id} showSchedule={true} />
        )}

        {/* VIEW 3: PHARMACY */}
        {view === "pharmacy" &&
          (currentUser?.role === "Pharmacist" ||
            currentUser?.role === "Nurse") && (
            <div>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-white">Pharmacy Hub</h2>
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
                      className="bg-slate-900/70 backdrop-blur-lg p-6 rounded-xl shadow-md border-l-4 border-purple-500"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="text-xl font-bold text-white">
                          {script.patient_name}
                        </h3>
                        <span className="text-sm text-gray-500">
                          {script.date}
                        </span>
                      </div>
                      <div className="mb-4">
                        <p className="text-sm text-green-500 uppercase font-semibold">
                          Diagnosis
                        </p>
                        <p className="bg-gray-700 text-white p-2 rounded mt-1 border border-gray-500 font-mono text-sm whitespace-pre-wrap">
                          {script.diagnosis}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-red-500 uppercase font-semibold">
                          Prescribed
                        </p>
                        <p className="bg-gray-700 p-3 rounded mt-1 border border-gray-500 font-mono text-sm text-white whitespace-pre-wrap">
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
                <h2 className="text-3xl font-bold text-white">
                  Billing & Finance
                </h2>
                <button
                  className="border-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white font-semibold py-2 px-4 rounded-lg transition"
                  onClick={loadBills}
                >
                  🔄 Refresh
                </button>
              </div>
              <div className="bg-slate-900/70 backdrop-blur-lg border border-slate-700 rounded-xl shadow-md overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-900 text-blue-400 border-b border-slate-700">
                    <tr className="hover:bg-slate-800/60 transition">
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
                      <tr className="hover:bg-slate-800/60 transition">
                        <td
                          colSpan="5"
                          className="py-8 text-center text-gray-500"
                        >
                          No invoices.
                        </td>
                      </tr>
                    ) : (
                      bills.map((bill) => (
                        <tr
                          key={bill.bill_id}
                          className="hover:bg-slate-800/60 transition"
                        >
                          <td className="py-4 px-6 font-bold">
                            INV-{1000 + bill.bill_id}
                          </td>
                          <td className="py-4 px-6">{bill.patient_name}</td>
                          <td className="py-4 px-6 font-bold">
                            ₹{bill.total_amount}
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
                                className="bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-900/40 text-white py-1 px-4 rounded-md transition shadow-sm"
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

        {view === "admin" && currentUser?.role === "Admin" && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-3xl font-bold text-white">
                Admin – Full Patient History
              </h2>
              <button
                className="border-2 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white font-semibold py-2 px-4 rounded-lg transition"
                onClick={loadAdminHistory}
              >
                🔄 Refresh
              </button>
            </div>

            <div className="bg-slate-900/70 backdrop-blur-lg rounded-xl shadow-md overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-900 text-blue-400 border-b border-slate-700">
                  <tr className="hover:bg-slate-800/60 transition">
                    <th className="py-4 px-6">ID</th>
                    <th className="py-4 px-6">Timeline</th>
                    <th className="py-4 px-6">Patient</th>
                    <th className="py-4 px-6">Doctor</th>
                    <th className="py-4 px-6">Department</th>
                    <th className="py-4 px-6">Status</th>
                    <th className="py-4 px-6">Diagnosis</th>
                    <th className="py-4 px-6">Bill</th>
                    <th className="py-4 px-6">Payment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {adminHistory.length === 0 ? (
                    <tr className="hover:bg-slate-800/60 transition">
                      <td
                        colSpan="8"
                        className="py-8 text-center text-gray-500"
                      >
                        No records found.
                      </td>
                    </tr>
                  ) : (
                    adminHistory.map((item) => (
                      <tr
                        className="hover:bg-slate-800/60 transition"
                        key={item.appointment_id}
                      >
                        <td className="py-4 px-6 font-bold">
                          #{item.appointment_id}
                        </td>
                        <td>
                          <div>
                            <strong>Registered:</strong>{" "}
                            {item.timeline?.registered_date || "—"}
                          </div>
                          <div>
                            <strong>Dismissed:</strong>{" "}
                            {item.timeline?.dismissed_date || "—"}
                          </div>
                        </td>
                        <td className="py-4 px-6">{item.patient_name}</td>
                        <td className="py-4 px-6 font-semibold text-blue-700">
                          {item.doctor_name}
                        </td>
                        <td className="py-4 px-6">{item.department}</td>
                        <td className="py-4 px-6">{item.status}</td>
                        <td className="py-4 px-6">{item.diagnosis || "—"}</td>
                        <td className="py-4 px-6">
                          {item.bill_total ? `₹${item.bill_total}` : "—"}
                        </td>
                        <td className="py-4 px-6">
                          {item.payment_status || "—"}
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
