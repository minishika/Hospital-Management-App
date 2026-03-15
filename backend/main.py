from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from sqlalchemy.sql import func
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
import os
from dotenv import load_dotenv
from twilio.rest import Client
from sqlalchemy import create_engine
import pytz
import heapq

load_dotenv()

account_sid = os.getenv("TWILIO_ACCOUNT_SID")
auth_token = os.getenv("TWILIO_AUTH_TOKEN")
twilio_phone = os.getenv("TWILIO_PHONE")

client = Client(account_sid, auth_token)

SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./hospital.db")

# 1. Fix Render's default postgres:// prefix so SQLAlchemy doesn't crash
if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)

# 2. Create the engine correctly based on which database is being used
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    # Local SQLite setup
    engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
else:
    # Render PostgreSQL setup (does not need the thread check)
    engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# ---------------- DEPARTMENT TRIAGE RULES ----------------

DEPARTMENT_TRIAGE = {

    "Cardiology": {
        "Severe chest pain": 5,
        "Suspected heart attack": 5,
        "Very high BP (>180/120)": 5,
        "Irregular heartbeat": 3,
        "Moderate chest discomfort": 3,
        "High BP (controlled)": 1,
        "Routine ECG": 1,
        "Regular heart checkup": 1
    },

    "Neurology": {
        "Stroke symptoms": 5,
        "Seizure attack": 5,
        "Sudden unconsciousness": 5,
        "Severe migraine": 3,
        "Numbness in limbs": 3,
        "Chronic headache": 1,
        "Memory issues": 1,
        "Follow-up visit": 1
    },

    "Pediatrics": {
        "High fever (>103°F)": 5,
        "Severe breathing difficulty": 5,
        "Convulsions": 5,
        "Persistent vomiting": 3,
        "Moderate fever": 3,
        "Ear pain": 1,
        "Mild cold": 1,
        "Vaccination visit": 1
    },

    "Orthopedics": {
        "Open fracture": 5,
        "Severe accident injury": 5,
        "Closed fracture": 3,
        "Severe joint swelling": 3,
        "Back pain (moderate)": 3,
        "Sprain": 1,
        "Mild joint pain": 1,
        "Follow-up visit": 1
    },

    "General Surgery": {
        "Severe abdominal pain": 5,
        "Internal bleeding": 5,
        "Appendix rupture suspicion": 5,
        "Moderate abdominal pain": 3,
        "Hernia pain": 3,
        "Minor wound dressing": 1,
        "Suture removal": 1,
        "Post-surgery review": 1
    },

    "Dermatology": {
        "Severe allergic reaction": 5,
        "Rapid spreading infection": 5,
        "Painful skin abscess": 3,
        "Severe eczema": 3,
        "Chronic acne": 1,
        "Skin rash": 1,
        "Hair fall issue": 1,
        "Routine skin consultation": 1
    },

    "Oncology": {
        "Severe chemotherapy reaction": 5,
        "Uncontrolled tumor bleeding": 5,
        "Severe cancer pain": 3,
        "New tumor symptom": 3,
        "Routine chemo session": 1,
        "Cancer follow-up": 1,
        "Biopsy review": 1,
        "Lab report consultation": 1
    },

    "Radiology": {
        "Emergency trauma scan": 5,
        "Internal injury scan": 5,
        "Urgent MRI/CT required": 3,
        "Severe pain imaging": 3,
        "Routine X-ray": 1,
        "Scheduled MRI": 1,
        "Ultrasound check": 1,
        "Report collection": 1
    }
}


# --- 2. ADVANCED DATABASE MODELS ---
class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password = Column(String) 
    role = Column(String)
    department = Column(String, nullable=True)
    name = Column(String)

class Appointment(Base):
    __tablename__ = "appointments"
    id = Column(Integer, primary_key=True, index=True)
    patient_name = Column(String)
    phone_number = Column(String)
    doctor_id = Column(Integer, ForeignKey("users.id"))
    urgency_level = Column(Integer)
    wait_time_mins = Column(Integer, default=0)

    token_number = Column(Integer)
    status = Column(String, default="Pending Triage")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    appointment_time = Column(DateTime(timezone=True), nullable=True)
    
class Vitals(Base):
    __tablename__ = "vitals"
    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"))
    blood_pressure = Column(String)
    temperature = Column(Float)
    weight = Column(Float)
    oxygen_level = Column(Integer)

class MedicalRecord(Base):
    __tablename__ = "medical_records"
    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"))
    symptoms = Column(String)
    diagnosis = Column(String)
    prescription = Column(String)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class Bill(Base):
    __tablename__ = "bills"
    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"))
    consultation_fee = Column(Float, default=500.0)
    medicine_fee = Column(Float, default=0.0)
    total_amount = Column(Float)
    payment_status = Column(String, default="Unpaid")
    paid_at = Column(DateTime(timezone=True), nullable=True)

Base.metadata.create_all(bind=engine)

class TriageData(BaseModel):
    blood_pressure: str  
    temperature: float   
    weight: float        
    oxygen_level: int

def send_sms(phone, message):
    client.messages.create(
        body=message,
        from_=twilio_phone,  # Twilio number
        to=phone
    )

def send_whatsapp(phone, message):
    client.messages.create(
        body=message,
        from_="whatsapp:+14155238886",  # Twilio sandbox number
        to=f"whatsapp:{phone}"
    )

def allocate_appointment_time(db, doctor_id, urgency):

    ist = ZoneInfo("Asia/Kolkata")
    now = datetime.now(ist)

    start_time = now.replace(hour=9, minute=0, second=0, microsecond=0)

    if now > start_time:
        start_time = now

    slot_time = start_time

    # Emergency
    if urgency == 5:
        pass # Keep slot_time as is

    # Intermediate
    elif urgency == 3:
        slot_time = slot_time + timedelta(minutes=15)

    # Routine
    else:
        slot_time = slot_time + timedelta(minutes=30)
        
    # CRITICAL FIX: Convert the final IST time back to UTC before saving!
    return slot_time.astimezone(timezone.utc)

def get_urgency_label(level: int):
    mapping = {
        1: "Routine",
        3: "Intermediate",
        5: "Emergency"
    }
    return mapping.get(level, "Unknown")

def init_db():
    db = SessionLocal()
    # If no users exist, create our 8 department doctors AND a Triage Nurse
    if not db.query(User).first():
        doctors = [
            ("Dr. Heart", "Cardiology", "doc_cardio"),
            ("Dr. Brain", "Neurology", "doc_neuro"),
            ("Dr. Child", "Pediatrics", "doc_peds"),
            ("Dr. Bone", "Orthopedics", "doc_ortho"),
            ("Dr. Cut", "General Surgery", "doc_surg"),
            ("Dr. Skin", "Dermatology", "doc_derm"),
            ("Dr. Cell", "Oncology", "doc_onco"),
            ("Dr. Ray", "Radiology", "doc_radio")
        ]
        
        # Add Doctors
        for name, dept, uname in doctors:
            user = User(username=uname, password="password123", role="Doctor", department=dept, name=name)
            db.add(user)
            
        # Add Triage Nurse
        nurse = User(username="nurse_triage", password="password123", role="Nurse", department="Triage", name="Nurse Joy")
        db.add(nurse)

        # Add Admin
        admin = User(username="admin", password="admin123", role="Admin", department="Administration", name="System Admin")
        db.add(admin)
        
        db.commit()
    db.close()

init_db() # Run seeder on startup

# --- 3. FASTAPI SETUP ---
app = FastAPI(title="Smart Hospital Management System")

allowed_origins = os.getenv("FRONTEND_URL", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],  
    allow_headers=["*"],  
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()



# --- 4. PYDANTIC SCHEMAS ---
class AppointmentCreate(BaseModel):
    patient_name: str
    phone_number: str
    doctor_id: int
    condition: str
    wait_time_mins: int = 0

class ConsultationData(BaseModel):
    symptoms: str
    diagnosis: str
    prescription: str
    medicine_cost: float

class LoginRequest(BaseModel):
    username: str
    password: str

# --- 5. ALGORITHM ---
def calculate_priority(urgency, wait_time, doctor_load):
    W1, W2, W3 = 10, 2, 5
    return (urgency * W1) + (wait_time * W2) - (doctor_load * W3)

# --- 6. API ENDPOINTS ---
@app.post("/login")
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == data.username, User.password == data.password).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return {"id": user.id, "name": user.name, "department": user.department, "role": user.role}

@app.get("/triage-options/{department}")
def get_triage_options(department: str):

    if department not in DEPARTMENT_TRIAGE:
        return {"error": "Invalid department"}

    return {
        "department": department,
        "conditions": list(DEPARTMENT_TRIAGE[department].keys())
    }

@app.get("/doctors")
def get_doctors(db: Session = Depends(get_db)):
    return db.query(User).filter(User.role == "Doctor").all()

@app.get("/admin/appointments")
def admin_all_appointments(db: Session = Depends(get_db)):
    appointments = db.query(Appointment).all()
    return appointments

@app.get("/admin/full-history")
def admin_full_history(db: Session = Depends(get_db)):
    ist = ZoneInfo("Asia/Kolkata") # Standardize on ZoneInfo
    data = db.query(
        Appointment,
        User,
        Vitals,
        MedicalRecord,
        Bill
    )\
    .join(User, Appointment.doctor_id == User.id)\
    .outerjoin(Vitals, Appointment.id == Vitals.appointment_id)\
    .outerjoin(MedicalRecord, Appointment.id == MedicalRecord.appointment_id)\
    .outerjoin(Bill, Appointment.id == Bill.appointment_id)\
    .all()

    result = []
    for a, doctor, v, m, b in data:
        # Helper to safely convert SQLite time to IST
        reg_date = a.created_at.replace(tzinfo=timezone.utc).astimezone(ist) if a.created_at else None
        diss_date = b.paid_at.replace(tzinfo=timezone.utc).astimezone(ist) if b and b.paid_at else None

        result.append({
            "appointment_id": a.id,
            "patient_name": a.patient_name,
            "doctor_name": doctor.name,
            "department": doctor.department,
            "status": a.status,
            "diagnosis": m.diagnosis if m else None,
            "bill_total": b.total_amount if b else None,
            "payment_status": b.payment_status if b else None,
            "timeline": {
                "registered_date": reg_date.strftime("%Y-%m-%d %I:%M %p") if reg_date else "—",
                "dismissed_date": diss_date.strftime("%Y-%m-%d %I:%M %p") if diss_date else "—"
            }
        })
    return result

@app.post("/book-appointment/")
def book_appointment(appt: AppointmentCreate, db: Session = Depends(get_db)):

    # 1️⃣ Get doctor first
    doctor = db.query(User).filter(User.id == appt.doctor_id).first()

    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    department = doctor.department
    condition = appt.condition

    # 2️⃣ Validate Department
    if department not in DEPARTMENT_TRIAGE:
        raise HTTPException(status_code=400, detail="Invalid department")

    # 3️⃣ Validate Condition
    if condition not in DEPARTMENT_TRIAGE[department]:
        raise HTTPException(status_code=400, detail="Invalid condition")

    # 4️⃣ Assign urgency FIRST ✅
    urgency_level = DEPARTMENT_TRIAGE[department][condition]

    # 5️⃣ NOW allocate time (after urgency exists)
    allocated_time = allocate_appointment_time(
        db,
        appt.doctor_id,
        urgency_level
    )

    # 6️⃣ Token generation
    ist = ZoneInfo("Asia/Kolkata")
    today_start = datetime.now(ist).replace(hour=0, minute=0, second=0, microsecond=0)

    dept_count = (
        db.query(Appointment)
        .join(User, Appointment.doctor_id == User.id)
        .filter(
            User.department == doctor.department,
            Appointment.created_at >= today_start
        )
        .count()
    )

    new_token = dept_count + 1

    # 7️⃣ Create appointment
    new_appt = Appointment(
        patient_name=appt.patient_name,
        phone_number=appt.phone_number,
        doctor_id=appt.doctor_id,
        urgency_level=urgency_level,
        wait_time_mins=appt.wait_time_mins,
        appointment_time=allocated_time,
        token_number=new_token
    )

    db.add(new_appt)
    db.commit()
    db.refresh(new_appt)

    urgency_label = get_urgency_label(urgency_level)

    message = f"""
CityCare Hospital
Department: {doctor.department}
Doctor: {doctor.name}
Token No: {new_token}
Urgency: {urgency_label}
Time: {allocated_time.strftime("%Y-%m-%d %I:%M %p")}
"""

    try:
        send_sms(appt.phone_number, message)
        send_whatsapp(appt.phone_number, message)
    except Exception as e:
        print("Notification failed:", e)

    return {
        "message": "Appointment booked successfully!",
        "appointment_id": new_appt.id,
        "token_number": new_token,
        "department": doctor.department,
        "appointment_time": allocated_time.astimezone(ist).strftime("%Y-%m-%d %I:%M %p")
    }

@app.get("/nurse/appointments")
def nurse_schedule(db: Session = Depends(get_db)):

    ist = ZoneInfo("Asia/Kolkata")

    appts = (
        db.query(Appointment, User)
        .join(User, Appointment.doctor_id == User.id)
        .order_by(Appointment.appointment_time.asc())
        .all()
    )

    result = []
    for a, doctor in appts:
        # Helper to safely convert SQLite time to IST
        appt_time = a.appointment_time.replace(tzinfo=timezone.utc).astimezone(ist) if a.appointment_time else None

        result.append({
            "patient_name": a.patient_name,
            "appointment_time": appt_time.strftime("%Y-%m-%d %I:%M %p") if appt_time else "—",
            "doctor_name": doctor.name,
            "urgency_level": get_urgency_label(a.urgency_level)
        })
        
    return result

@app.get("/doctor/{doc_id}/appointments")
def doctor_schedule(doc_id: int, db: Session = Depends(get_db)):

    ist = ZoneInfo("Asia/Kolkata")

    appts = db.query(Appointment)\
        .filter(Appointment.doctor_id == doc_id, Appointment.status.in_(["Pending Triage","Waiting for Doctor"]))\
        .order_by(Appointment.appointment_time.asc())\
        .all()

    return [
        {
            "patient_name": a.patient_name,
            "appointment_time": a.appointment_time.astimezone(ist).strftime("%Y-%m-%d %I:%M %p") if a.appointment_time else None,
            "urgency_level": get_urgency_label(a.urgency_level)
        }
        for a in appts
    ]

@app.get("/doctor/{doc_id}/queue")
def get_doctor_queue(doc_id: int, db: Session = Depends(get_db)):

    queue = db.query(Appointment, Vitals)\
        .outerjoin(Vitals, Appointment.id == Vitals.appointment_id)\
        .filter(
            Appointment.doctor_id == doc_id,
            Appointment.status == "Waiting for Doctor"
        )\
        .all()

    # --- Calculate doctor load ONCE ---
    doctor_load = db.query(Appointment)\
        .filter(
            Appointment.doctor_id == doc_id,
            Appointment.status.in_(["Waiting for Doctor", "In Consultation"])
        )\
        .count()

    prioritized = []

    for appt, vitals in queue:

        wait_time = (
            datetime.now(timezone.utc) -
            appt.created_at.replace(tzinfo=timezone.utc)
        ).total_seconds() / 60

        urgency=appt.urgency_level

        if wait_time <10:
            effective_load = doctor_load
        else:
            effective_load = 0

        score = calculate_priority(
            urgency,
            wait_time,
            effective_load
        )

        prioritized.append((score, appt, vitals))

    # Highest priority first
    prioritized.sort(key=lambda x: -x[0])

    result = []

    for _, appt, vitals in prioritized:
        result.append({
            "appointment_id": appt.id,
            "patient_name": appt.patient_name,
            "urgency_level": appt.urgency_level,
            "status": appt.status,
            "vitals": {
                "blood_pressure": vitals.blood_pressure if vitals else None,
                "temperature": vitals.temperature if vitals else None,
                "weight": vitals.weight if vitals else None,
                "oxygen_level": vitals.oxygen_level if vitals else None,
            } if vitals else None
        })

    return {"smart_queue": result}


@app.get("/doctor/{doc_id}/compare-models")
def compare_models(doc_id: int, db: Session = Depends(get_db)):

    queue = db.query(Appointment)\
        .filter(
            Appointment.doctor_id == doc_id,
            Appointment.status == "Waiting for Doctor"
        )\
        .all()

    if not queue:
        return {"message": "No active patients to compare"}

    # ---------------- FIFO MODEL ----------------
    fifo_sorted = sorted(queue, key=lambda x: x.created_at)

    # ---------------- SMART MODEL ----------------
    doctor_load = len(queue)

    smart_list = []

    for appt in queue:

        wait_time = (
            datetime.now(timezone.utc) -
            appt.created_at.replace(tzinfo=timezone.utc)
        ).total_seconds() / 60

        # load affects only new patients (<10 min)
        effective_load = doctor_load if wait_time < 10 else 0

        score = calculate_priority(
            appt.urgency_level,
            wait_time,
            effective_load
        )

        smart_list.append((score, appt))

    smart_sorted = sorted(smart_list, key=lambda x: -x[0])

    def avg_position(order_list):
        total = 0
        for i, appt in enumerate(order_list):
            total += (i + 1)
        return total / len(order_list)


    fifo_avg_position = avg_position(fifo_sorted)
    smart_avg_position = avg_position([x[1] for x in smart_sorted])


# ---- Emergency Position Average ----

    def avg_emergency_position(order_list):
        positions = []
        for i, appt in enumerate(order_list):
            if appt.urgency_level == 5:
                positions.append(i + 1)
        return sum(positions) / len(positions) if positions else 0


    fifo_emergency_avg = avg_emergency_position(fifo_sorted)
    smart_emergency_avg = avg_emergency_position([x[1] for x in smart_sorted])

    # ---------------- METRICS ----------------
    fifo_emergency_positions = []
    smart_emergency_positions = []

    for i, appt in enumerate(fifo_sorted):
        if appt.urgency_level == 5:
            fifo_emergency_positions.append(i + 1)

    for i, (score, appt) in enumerate(smart_sorted):
        if appt.urgency_level == 5:
            smart_emergency_positions.append(i + 1)

    return {
        "total_patients": len(queue),

        "fifo_order": [
            {
                "position": i + 1,
                "patient": appt.patient_name,
                "urgency": appt.urgency_level
            }
            for i, appt in enumerate(fifo_sorted)
        ],

        "smart_order": [
            {
                "position": i + 1,
                "patient": appt.patient_name,
                "urgency": appt.urgency_level
            }
            for i, (score, appt) in enumerate(smart_sorted)
        ],

        "emergency_positions": {
            "fifo": fifo_emergency_positions,
            "smart": smart_emergency_positions
        },

        "metrics": {
            "fifo_average_position": fifo_avg_position,
            "smart_average_position": smart_avg_position,
            "fifo_emergency_avg_position": fifo_emergency_avg,
            "smart_emergency_avg_position": smart_emergency_avg,
            "emergency_improvement": (
                ((fifo_emergency_avg - smart_emergency_avg) / fifo_emergency_avg) * 100
                if fifo_emergency_avg != 0 else 0
            )
        }
    }

@app.post("/attend-patient/{appointment_id}")
def attend_patient(appointment_id: int, data: ConsultationData, db: Session = Depends(get_db)):

    appt = db.query(Appointment).filter(Appointment.id == appointment_id).first()

    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    appt.status = "Completed"

    record = MedicalRecord(
        appointment_id=appointment_id,
        symptoms=data.symptoms,
        diagnosis=data.diagnosis,
        prescription=data.prescription
    )
    db.add(record)

    total = 500.0 + data.medicine_cost
    new_bill = Bill(
        appointment_id=appointment_id,
        medicine_fee=data.medicine_cost,
        total_amount=total
    )
    db.add(new_bill)

    db.commit()

    return {"message": "Consultation complete."}

@app.get("/pharmacy/prescriptions")
def get_prescriptions(db: Session = Depends(get_db)):
    ist = ZoneInfo("Asia/Kolkata")
    records = db.query(MedicalRecord, Appointment)\
        .join(Appointment, MedicalRecord.appointment_id == Appointment.id)\
        .order_by(MedicalRecord.created_at.desc())\
        .all()
    
    return [
        {
            "record_id": r.id, 
            "patient_name": a.patient_name, 
            "diagnosis": r.diagnosis, 
            "prescription": r.prescription, 
            # Force UTC then convert to IST
            "date": r.created_at.replace(tzinfo=timezone.utc).astimezone(ist).strftime("%Y-%m-%d %I:%M %p") 
        } 
        for r, a in records
    ]

@app.get("/billing/invoices")
def get_bills(db: Session = Depends(get_db)):
    bills = db.query(Bill, Appointment).join(Appointment, Bill.appointment_id == Appointment.id).all()
    return [{"bill_id": b.id, "patient_name": a.patient_name, "consultation_fee": b.consultation_fee, "medicine_fee": b.medicine_fee, "total_amount": b.total_amount, "payment_status": b.payment_status} for b, a in bills]

@app.post("/billing/pay/{bill_id}")
def pay_bill(bill_id: int, db: Session = Depends(get_db)):
    bill = db.query(Bill).filter(Bill.id == bill_id).first()
    bill.payment_status = "Paid"
    bill.paid_at = datetime.now(timezone.utc)
    db.commit()
    return {"message": "Payment successful!"}

# --- NURSE / TRIAGE MODULE ---

@app.get("/triage/queue")
def get_triage_queue(db: Session = Depends(get_db)):
    patients = db.query(Appointment)\
        .filter(Appointment.status == "Pending Triage")\
        .all()

    return patients

@app.post("/triage/vitals/{appointment_id}")
def submit_triage(
    appointment_id: int,
    vitals: TriageData,
    db: Session = Depends(get_db)
):
    """Saves the patient's vitals and moves them to the Doctor's queue."""

    # Check appointment exists
    appt = db.query(Appointment).filter(Appointment.id == appointment_id).first()

    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    # Save vitals using SQLAlchemy
    new_vitals = Vitals(
        appointment_id=appointment_id,
        blood_pressure=vitals.blood_pressure,
        temperature=vitals.temperature,
        weight=vitals.weight,
        oxygen_level=vitals.oxygen_level
    )

    db.add(new_vitals)

    # Update status
    appt.status = "Waiting for Doctor"

    db.commit()

    return {
        "status": "success",
        "message": f"Patient #{appointment_id} triaged and sent to doctor."
    }