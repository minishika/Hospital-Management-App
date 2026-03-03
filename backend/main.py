from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from sqlalchemy.sql import func
from pydantic import BaseModel
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
import pytz
import heapq

# --- 1. DATABASE SETUP ---
SQLALCHEMY_DATABASE_URL = "sqlite:///./hospital.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


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
    doctor_id = Column(Integer, ForeignKey("users.id"))
    urgency_level = Column(Integer)
    wait_time_mins = Column(Integer, default=0)
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

def allocate_appointment_time(db, doctor_id, urgency):
    ist = ZoneInfo("Asia/Kolkata")
    now = datetime.now(ist)

    # Doctor day start
    start_time = now.replace(hour=9, minute=0, second=0, microsecond=0)

    if now > start_time:
        start_time = now

    # Get today's appointments for this doctor
    appointments = db.query(Appointment)\
        .filter(Appointment.doctor_id == doctor_id)\
        .filter(Appointment.appointment_time != None)\
        .order_by(Appointment.appointment_time.asc())\
        .all()

    slot_time = start_time

    # Emergency = immediate next slot
    if urgency == 3:
        return slot_time

    # Intermediate = after emergencies
    if urgency == 2:
        slot_time += timedelta(minutes=15)
        return slot_time

    # Normal = after emergency + intermediate
    slot_time += timedelta(minutes=30)
    return slot_time

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
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
    doctor_id: int
    urgency_level: int
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

    allocated_time = allocate_appointment_time(
        db,
        appt.doctor_id,
        appt.urgency_level
    )

    new_appt = Appointment(
        patient_name=appt.patient_name,
        doctor_id=appt.doctor_id,
        urgency_level=appt.urgency_level,
        wait_time_mins=appt.wait_time_mins,
        appointment_time=allocated_time   # ✅ SAVE IT HERE
    )

    db.add(new_appt)
    db.commit()
    db.refresh(new_appt)

    ist = ZoneInfo("Asia/Kolkata")

    return {
        "message": "Appointment booked successfully!",
        "appointment_id": new_appt.id,
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

    return [
        {
            "patient_name": a.patient_name,
            "appointment_time": a.appointment_time.astimezone(ist).strftime("%Y-%m-%d %I:%M %p") if a.appointment_time else None,
            "doctor_name": doctor.name,
            "urgency_level": get_urgency_label(a.urgency_level)
        }
        for a, doctor in appts
    ]

@app.get("/doctor/{doc_id}/appointments")
def doctor_schedule(doc_id: int, db: Session = Depends(get_db)):

    ist = ZoneInfo("Asia/Kolkata")

    appts = db.query(Appointment)\
        .filter(Appointment.doctor_id == doc_id)\
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
    queue = db.query(Appointment, Vitals).outerjoin(Vitals, Appointment.id == Vitals.appointment_id)\
        .filter(Appointment.doctor_id == doc_id, Appointment.status == "Waiting for Doctor")\
        .all()

    # Compute priority dynamically
    prioritized = []
    for appt, vitals in queue:
        wait_time = (datetime.now(timezone.utc) - appt.created_at.replace(tzinfo=timezone.utc)).total_seconds() / 60
        doctor_load = 0  # could be computed from today's completed appointments
        score = calculate_priority(appt.urgency_level, wait_time, doctor_load)
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