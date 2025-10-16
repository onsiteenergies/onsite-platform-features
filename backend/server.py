from fastapi import FastAPI, APIRouter, HTTPException, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone
from passlib.context import CryptContext
import jwt
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT settings
SECRET_KEY = os.environ.get('JWT_SECRET', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"

security = HTTPBearer()

# Helper functions
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict) -> str:
    return jwt.encode(data, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = decode_token(token)
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.users.find_one({"id": user_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

# Models
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    role: str = "customer"  # customer or admin
    price_modifier: float = 0.0  # +/- per liter on top of rack price
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class UserRegister(BaseModel):
    email: str
    password: str
    name: str

class UserLogin(BaseModel):
    email: str
    password: str

class TruckDetails(BaseModel):
    license_plate: str
    driver_name: str
    capacity_liters: float

class Booking(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    user_name: str
    user_email: str
    delivery_address: str
    fuel_quantity_liters: float
    fuel_type: str  # diesel or gasoline
    preferred_date: str
    preferred_time: str
    special_instructions: Optional[str] = None
    multiple_locations: Optional[List[str]] = None
    trucks: List[TruckDetails]
    status: str = "pending"  # pending, confirmed, in_transit, delivered, cancelled
    rack_price: float
    customer_price_modifier: float
    fuel_price_per_liter: float
    federal_carbon_tax: float
    quebec_carbon_tax: float
    gst_rate: float
    qst_rate: float
    subtotal: float
    total_price: float
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class BookingCreate(BaseModel):
    delivery_address: str
    fuel_quantity_liters: float
    fuel_type: str
    preferred_date: str
    preferred_time: str
    special_instructions: Optional[str] = None
    multiple_locations: Optional[List[str]] = None
    trucks: List[TruckDetails]

class BookingUpdate(BaseModel):
    status: Optional[str] = None
    trucks: Optional[List[TruckDetails]] = None

class DeliveryLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    booking_id: str
    truck_license_plate: str
    driver_name: str
    liters_delivered: float
    delivery_time: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    notes: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class DeliveryLogCreate(BaseModel):
    booking_id: str
    truck_license_plate: str
    driver_name: str
    liters_delivered: float
    notes: Optional[str] = None

class PricingConfig(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    rack_price: float  # Daily base rate from pipeline
    federal_carbon_tax: float
    quebec_carbon_tax: float
    gst_rate: float = 0.05  # 5%
    qst_rate: float = 0.09975  # 9.975%
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class PricingConfigUpdate(BaseModel):
    rack_price: Optional[float] = None
    federal_carbon_tax: Optional[float] = None
    quebec_carbon_tax: Optional[float] = None
    gst_rate: Optional[float] = None
    qst_rate: Optional[float] = None

class CustomerPriceModifier(BaseModel):
    price_modifier: float  # +/- per liter on top of rack price

# Auth Routes
@api_router.post("/auth/register", response_model=User)
async def register(user_data: UserRegister):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user = User(
        email=user_data.email,
        name=user_data.name,
        role="customer"
    )
    
    doc = user.model_dump()
    doc['password'] = hash_password(user_data.password)
    
    await db.users.insert_one(doc)
    return user

@api_router.post("/auth/login")
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user['password']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_access_token({"user_id": user['id'], "role": user['role']})
    
    return {
        "token": token,
        "user": {
            "id": user['id'],
            "email": user['email'],
            "name": user['name'],
            "role": user['role']
        }
    }

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user

# Pricing Routes
@api_router.get("/pricing", response_model=PricingConfig)
async def get_pricing():
    pricing = await db.pricing.find_one({}, {"_id": 0})
    if not pricing:
        # Create default pricing
        default_pricing = PricingConfig(
            rack_price=1.50,
            federal_carbon_tax=0.14,
            quebec_carbon_tax=0.05,
            gst_rate=0.05,
            qst_rate=0.09975
        )
        await db.pricing.insert_one(default_pricing.model_dump())
        return default_pricing
    return pricing

@api_router.put("/pricing")
async def update_pricing(pricing_data: PricingConfigUpdate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    update_data = {k: v for k, v in pricing_data.model_dump().items() if v is not None}
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    await db.pricing.update_one({}, {"$set": update_data}, upsert=True)
    
    pricing = await db.pricing.find_one({}, {"_id": 0})
    return pricing

# Calculate price helper
async def calculate_booking_price(liters: float, customer_price_modifier: float = 0.0):
    pricing = await db.pricing.find_one({}, {"_id": 0})
    if not pricing:
        pricing = {
            'rack_price': 1.50,
            'federal_carbon_tax': 0.14,
            'quebec_carbon_tax': 0.05,
            'gst_rate': 0.05,
            'qst_rate': 0.09975
        }
    
    # Calculate customer's final fuel price: rack price + customer modifier
    customer_fuel_price = pricing['rack_price'] + customer_price_modifier
    
    fuel_cost = liters * customer_fuel_price
    federal_tax = liters * pricing['federal_carbon_tax']
    quebec_tax = liters * pricing['quebec_carbon_tax']
    
    subtotal = fuel_cost + federal_tax + quebec_tax
    gst = subtotal * pricing['gst_rate']
    qst = subtotal * pricing['qst_rate']
    
    total = subtotal + gst + qst
    
    return {
        'rack_price': pricing['rack_price'],
        'customer_price_modifier': customer_price_modifier,
        'fuel_price_per_liter': customer_fuel_price,
        'federal_carbon_tax': pricing['federal_carbon_tax'],
        'quebec_carbon_tax': pricing['quebec_carbon_tax'],
        'gst_rate': pricing['gst_rate'],
        'qst_rate': pricing['qst_rate'],
        'subtotal': round(subtotal, 2),
        'total_price': round(total, 2)
    }

# Booking Routes
@api_router.post("/bookings", response_model=Booking)
async def create_booking(booking_data: BookingCreate, current_user: dict = Depends(get_current_user)):
    price_info = await calculate_booking_price(booking_data.fuel_quantity_liters)
    
    booking = Booking(
        user_id=current_user['id'],
        user_name=current_user['name'],
        user_email=current_user['email'],
        **booking_data.model_dump(),
        **price_info
    )
    
    await db.bookings.insert_one(booking.model_dump())
    return booking

@api_router.get("/bookings", response_model=List[Booking])
async def get_bookings(current_user: dict = Depends(get_current_user)):
    if current_user['role'] == 'admin':
        bookings = await db.bookings.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    else:
        bookings = await db.bookings.find({"user_id": current_user['id']}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return bookings

@api_router.get("/bookings/{booking_id}", response_model=Booking)
async def get_booking(booking_id: str, current_user: dict = Depends(get_current_user)):
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if current_user['role'] != 'admin' and booking['user_id'] != current_user['id']:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return booking

@api_router.put("/bookings/{booking_id}")
async def update_booking(booking_id: str, booking_update: BookingUpdate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    update_data = {k: v for k, v in booking_update.model_dump().items() if v is not None}
    update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    result = await db.bookings.update_one({"id": booking_id}, {"$set": update_data})
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    return booking

# Delivery Logs Routes
@api_router.post("/logs", response_model=DeliveryLog)
async def create_log(log_data: DeliveryLogCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    log = DeliveryLog(**log_data.model_dump())
    await db.delivery_logs.insert_one(log.model_dump())
    return log

@api_router.get("/logs", response_model=List[DeliveryLog])
async def get_logs(booking_id: Optional[str] = None, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    query = {}
    if booking_id:
        query['booking_id'] = booking_id
    
    logs = await db.delivery_logs.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return logs

@api_router.get("/logs/booking/{booking_id}", response_model=List[DeliveryLog])
async def get_logs_by_booking(booking_id: str, current_user: dict = Depends(get_current_user)):
    # Check if user has access to this booking
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if current_user['role'] != 'admin' and booking['user_id'] != current_user['id']:
        raise HTTPException(status_code=403, detail="Access denied")
    
    logs = await db.delivery_logs.find({"booking_id": booking_id}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return logs

# Stats for admin dashboard
@api_router.get("/stats")
async def get_stats(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    total_bookings = await db.bookings.count_documents({})
    pending_bookings = await db.bookings.count_documents({"status": "pending"})
    completed_bookings = await db.bookings.count_documents({"status": "delivered"})
    total_customers = await db.users.count_documents({"role": "customer"})
    
    # Calculate total revenue
    bookings = await db.bookings.find({"status": "delivered"}, {"_id": 0}).to_list(10000)
    total_revenue = sum(b.get('total_price', 0) for b in bookings)
    
    # Total liters delivered
    total_liters = sum(b.get('fuel_quantity_liters', 0) for b in bookings)
    
    return {
        "total_bookings": total_bookings,
        "pending_bookings": pending_bookings,
        "completed_bookings": completed_bookings,
        "total_customers": total_customers,
        "total_revenue": round(total_revenue, 2),
        "total_liters_delivered": round(total_liters, 2)
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()