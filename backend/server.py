from fastapi import FastAPI, APIRouter, HTTPException, Depends, File, UploadFile
from fastapi.responses import FileResponse, Response
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
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image as RLImage
from reportlab.lib.units import inch
import io
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Create directories for uploads
UPLOAD_DIR = Path("/app/uploads")
UPLOAD_DIR.mkdir(exist_ok=True)
INVOICE_IMAGES_DIR = UPLOAD_DIR / "invoice_images"
INVOICE_IMAGES_DIR.mkdir(exist_ok=True)

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
class DeliverySite(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    address: str

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str
    role: str = "customer"  # customer or admin
    price_modifier: float = 0.0  # +/- per liter on top of rack price
    delivery_sites: Optional[List[dict]] = []  # List of saved delivery addresses
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class UserRegister(BaseModel):
    email: str
    password: str
    name: str

class UserLogin(BaseModel):
    email: str
    password: str

class FuelTank(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    identifier: str
    capacity: Optional[float] = None
    location_id: Optional[str] = None  # ID of delivery site
    location_name: Optional[str] = None  # Name of location
    location_address: Optional[str] = None  # Full address
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class CustomerEquipment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    unit_number: str
    license_plate: str
    capacity: Optional[float] = None
    location_id: Optional[str] = None  # ID of delivery site
    location_name: Optional[str] = None  # Name of location
    location_address: Optional[str] = None  # Full address
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class FuelTankCreate(BaseModel):
    name: str
    identifier: str
    capacity: Optional[float] = None
    location_id: Optional[str] = None
    location_name: Optional[str] = None
    location_address: Optional[str] = None

class CustomerEquipmentCreate(BaseModel):
    name: str
    unit_number: str
    license_plate: str
    capacity: Optional[float] = None
    location_id: Optional[str] = None
    location_name: Optional[str] = None
    location_address: Optional[str] = None

class Booking(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    user_name: str
    user_email: str
    delivery_address: str  # Primary/main delivery address (backward compatibility)
    delivery_locations: Optional[List[dict]] = []  # List of {location_id, location_name, address, items: [{id, type, name, quantity}]}
    fuel_quantity_liters: float
    fuel_type: str  # diesel or gasoline
    preferred_date: str
    preferred_time: str
    special_instructions: Optional[str] = None
    multiple_locations: Optional[List[str]] = None
    status: str = "pending"  # pending, confirmed, in_transit, delivered, cancelled
    selected_tanks: Optional[List[dict]] = []  # List of {id, name, identifier, capacity, location_address}
    selected_equipment: Optional[List[dict]] = []  # List of {id, name, unit_number, license_plate, capacity, location_address}
    rack_price: Optional[float] = None
    customer_price_modifier: Optional[float] = None
    fuel_price_per_liter: float
    federal_carbon_tax: float
    quebec_carbon_tax: float
    gst_rate: float
    qst_rate: float
    subtotal: float
    total_price: float
    ordered_amount: Optional[float] = None  # Ordered liters
    dispensed_amount: Optional[float] = None  # Actually dispensed liters
    invoice_images: Optional[List[str]] = []  # List of image file paths
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class BookingCreate(BaseModel):
    delivery_address: str
    delivery_locations: Optional[List[dict]] = None  # For multiple location bookings
    fuel_quantity_liters: float
    fuel_type: str
    preferred_date: str
    preferred_time: str
    special_instructions: Optional[str] = None
    multiple_locations: Optional[List[str]] = None
    selected_tank_ids: Optional[List[str]] = None
    selected_equipment_ids: Optional[List[str]] = None
    # Keep backward compatibility
    tank_id: Optional[str] = None
    tank_name: Optional[str] = None
    equipment_id: Optional[str] = None
    equipment_name: Optional[str] = None

class BookingUpdate(BaseModel):
    status: Optional[str] = None
    ordered_amount: Optional[float] = None
    dispensed_amount: Optional[float] = None

class InvoiceUpdate(BaseModel):
    ordered_amount: Optional[float] = None
    dispensed_amount: Optional[float] = None

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
    # Get customer's price modifier
    customer_price_modifier = current_user.get('price_modifier', 0.0)
    price_info = await calculate_booking_price(booking_data.fuel_quantity_liters, customer_price_modifier)
    
    # Fetch tank details if selected_tank_ids provided
    selected_tanks = []
    if booking_data.selected_tank_ids:
        tanks_cursor = db.fuel_tanks.find(
            {"id": {"$in": booking_data.selected_tank_ids}, "user_id": current_user['id']},
            {"_id": 0}
        )
        selected_tanks = await tanks_cursor.to_list(length=None)
    
    # Fetch equipment details if selected_equipment_ids provided
    selected_equipment = []
    if booking_data.selected_equipment_ids:
        equipment_cursor = db.customer_equipment.find(
            {"id": {"$in": booking_data.selected_equipment_ids}, "user_id": current_user['id']},
            {"_id": 0}
        )
        selected_equipment = await equipment_cursor.to_list(length=None)
    
    # Create booking dict
    booking_dict = booking_data.model_dump(exclude={'selected_tank_ids', 'selected_equipment_ids'})
    booking = Booking(
        user_id=current_user['id'],
        user_name=current_user['name'],
        user_email=current_user['email'],
        **booking_dict,
        selected_tanks=selected_tanks,
        selected_equipment=selected_equipment,
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

# Customer management routes for admin
@api_router.get("/customers", response_model=List[User])
async def get_customers(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    customers = await db.users.find({"role": "customer"}, {"_id": 0, "password": 0}).to_list(1000)
    return customers

@api_router.put("/customers/{customer_id}/pricing")
async def update_customer_pricing(
    customer_id: str, 
    pricing_update: CustomerPriceModifier, 
    current_user: dict = Depends(get_current_user)
):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.users.update_one(
        {"id": customer_id, "role": "customer"}, 
        {"$set": {"price_modifier": pricing_update.price_modifier}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    customer = await db.users.find_one({"id": customer_id}, {"_id": 0, "password": 0})
    return customer


# Delivery Sites Management
class DeliverySiteCreate(BaseModel):
    name: str
    address: str

@api_router.get("/delivery-sites")
async def get_delivery_sites(current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user['id']}, {"_id": 0})
    return user.get('delivery_sites', [])

@api_router.post("/delivery-sites")
async def add_delivery_site(site_data: DeliverySiteCreate, current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user['id']}, {"_id": 0})
    
    delivery_sites = user.get('delivery_sites', [])
    new_site = {
        "id": str(uuid.uuid4()),
        "name": site_data.name,
        "address": site_data.address
    }
    delivery_sites.append(new_site)
    
    await db.users.update_one(
        {"id": current_user['id']},
        {"$set": {"delivery_sites": delivery_sites}}
    )
    
    return new_site

@api_router.put("/delivery-sites/{site_id}")
async def update_delivery_site(site_id: str, site_data: DeliverySiteCreate, current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user['id']}, {"_id": 0})
    
    delivery_sites = user.get('delivery_sites', [])
    site_found = False
    
    for site in delivery_sites:
        if site['id'] == site_id:
            site['name'] = site_data.name
            site['address'] = site_data.address
            site_found = True
            break
    
    if not site_found:
        raise HTTPException(status_code=404, detail="Delivery site not found")
    
    await db.users.update_one(
        {"id": current_user['id']},
        {"$set": {"delivery_sites": delivery_sites}}
    )
    
    return {"id": site_id, "name": site_data.name, "address": site_data.address}

@api_router.delete("/delivery-sites/{site_id}")
async def delete_delivery_site(site_id: str, current_user: dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user['id']}, {"_id": 0})
    
    delivery_sites = user.get('delivery_sites', [])
    original_length = len(delivery_sites)
    delivery_sites = [site for site in delivery_sites if site['id'] != site_id]
    
    if len(delivery_sites) == original_length:
        raise HTTPException(status_code=404, detail="Delivery site not found")
    
    await db.users.update_one(
        {"id": current_user['id']},
        {"$set": {"delivery_sites": delivery_sites}}
    )
    
    return {"message": "Delivery site deleted successfully"}

# Fuel Tanks Management
@api_router.get("/fuel-tanks")
async def get_fuel_tanks(current_user: dict = Depends(get_current_user)):
    tanks = await db.fuel_tanks.find({"user_id": current_user['id']}, {"_id": 0}).to_list(1000)
    return tanks

@api_router.post("/fuel-tanks")
async def create_fuel_tank(tank_data: FuelTankCreate, current_user: dict = Depends(get_current_user)):
    tank = FuelTank(**tank_data.model_dump(), id=str(uuid.uuid4()))
    doc = tank.model_dump()
    doc['user_id'] = current_user['id']
    
    await db.fuel_tanks.insert_one(doc)
    return tank

@api_router.put("/fuel-tanks/{tank_id}")
async def update_fuel_tank(tank_id: str, tank_data: FuelTankCreate, current_user: dict = Depends(get_current_user)):
    result = await db.fuel_tanks.update_one(
        {"id": tank_id, "user_id": current_user['id']},
        {"$set": tank_data.model_dump()}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Fuel tank not found")
    
    tank = await db.fuel_tanks.find_one({"id": tank_id}, {"_id": 0})
    return tank

@api_router.delete("/fuel-tanks/{tank_id}")
async def delete_fuel_tank(tank_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.fuel_tanks.delete_one({"id": tank_id, "user_id": current_user['id']})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Fuel tank not found")
    
    return {"message": "Fuel tank deleted successfully"}

# Customer Equipment Management
@api_router.get("/equipment")
async def get_equipment(current_user: dict = Depends(get_current_user)):
    equipment = await db.customer_equipment.find({"user_id": current_user['id']}, {"_id": 0}).to_list(1000)
    return equipment

@api_router.post("/equipment")
async def create_equipment(equipment_data: CustomerEquipmentCreate, current_user: dict = Depends(get_current_user)):
    equipment = CustomerEquipment(**equipment_data.model_dump(), id=str(uuid.uuid4()))
    doc = equipment.model_dump()
    doc['user_id'] = current_user['id']
    
    await db.customer_equipment.insert_one(doc)
    return equipment

@api_router.put("/equipment/{equipment_id}")
async def update_equipment(equipment_id: str, equipment_data: CustomerEquipmentCreate, current_user: dict = Depends(get_current_user)):
    result = await db.customer_equipment.update_one(
        {"id": equipment_id, "user_id": current_user['id']},
        {"$set": equipment_data.model_dump()}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Equipment not found")
    
    equipment = await db.customer_equipment.find_one({"id": equipment_id}, {"_id": 0})
    return equipment

@api_router.delete("/equipment/{equipment_id}")
async def delete_equipment(equipment_id: str, current_user: dict = Depends(get_current_user)):
    result = await db.customer_equipment.delete_one({"id": equipment_id, "user_id": current_user['id']})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Equipment not found")
    
    return {"message": "Equipment deleted successfully"}

# Invoice Management Routes
@api_router.put("/invoices/{booking_id}")
async def update_invoice(
    booking_id: str,
    invoice_data: InvoiceUpdate,
    current_user: dict = Depends(get_current_user)
):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get current booking
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    update_fields = {k: v for k, v in invoice_data.model_dump().items() if v is not None}
    update_fields['updated_at'] = datetime.now(timezone.utc).isoformat()
    
    # If dispensed amount is provided, recalculate the total price
    if invoice_data.dispensed_amount is not None:
        dispensed_amount = invoice_data.dispensed_amount
        
        # Recalculate price based on dispensed amount
        fuel_cost = dispensed_amount * booking['fuel_price_per_liter']
        federal_tax = dispensed_amount * booking['federal_carbon_tax']
        quebec_tax = dispensed_amount * booking['quebec_carbon_tax']
        
        subtotal = fuel_cost + federal_tax + quebec_tax
        gst = subtotal * booking['gst_rate']
        qst = subtotal * booking['qst_rate']
        
        total = subtotal + gst + qst
        
        # Update price fields based on dispensed amount
        update_fields['subtotal'] = round(subtotal, 2)
        update_fields['total_price'] = round(total, 2)
    
    result = await db.bookings.update_one(
        {"id": booking_id},
        {"$set": update_fields}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    return booking

# Image Upload for Invoices
@api_router.post("/invoices/{booking_id}/upload-image")
async def upload_invoice_image(
    booking_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Check if booking exists
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Check image count
    current_images = booking.get('invoice_images', [])
    if len(current_images) >= 5:
        raise HTTPException(status_code=400, detail="Maximum 5 images allowed per invoice")
    
    # Save file
    file_ext = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
    file_name = f"{booking_id}_{uuid.uuid4()}.{file_ext}"
    file_path = INVOICE_IMAGES_DIR / file_name
    
    contents = await file.read()
    with open(file_path, "wb") as f:
        f.write(contents)
    
    # Update booking with image path
    current_images.append(file_name)
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {"invoice_images": current_images, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"filename": file_name, "message": "Image uploaded successfully"}

@api_router.delete("/invoices/{booking_id}/images/{image_filename}")
async def delete_invoice_image(
    booking_id: str,
    image_filename: str,
    current_user: dict = Depends(get_current_user)
):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    current_images = booking.get('invoice_images', [])
    if image_filename not in current_images:
        raise HTTPException(status_code=404, detail="Image not found")
    
    # Delete file
    file_path = INVOICE_IMAGES_DIR / image_filename
    if file_path.exists():
        file_path.unlink()
    
    # Update booking
    current_images.remove(image_filename)
    await db.bookings.update_one(
        {"id": booking_id},
        {"$set": {"invoice_images": current_images, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Image deleted successfully"}

@api_router.get("/invoices/{booking_id}/images/{image_filename}")
async def get_invoice_image(booking_id: str, image_filename: str):
    file_path = INVOICE_IMAGES_DIR / image_filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Image not found")
    return FileResponse(file_path)

# PDF Export
@api_router.get("/invoices/{booking_id}/export-pdf")
async def export_invoice_pdf(booking_id: str, current_user: dict = Depends(get_current_user)):
    booking = await db.bookings.find_one({"id": booking_id}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Check if user has access to this booking
    if current_user['role'] != 'admin' and booking['user_id'] != current_user['id']:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Create PDF
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    elements = []
    styles = getSampleStyleSheet()
    
    # Title
    title = Paragraph(f"<b>INVOICE - FuelTrack</b>", styles['Title'])
    elements.append(title)
    elements.append(Spacer(1, 0.3*inch))
    
    # Booking Info
    info_data = [
        ['Invoice Number:', booking['id']],
        ['Customer:', booking['user_name']],
        ['Email:', booking['user_email']],
        ['Date:', booking['created_at'][:10]],
        ['Status:', booking['status'].upper()],
    ]
    info_table = Table(info_data, colWidths=[2*inch, 4*inch])
    info_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(info_table)
    elements.append(Spacer(1, 0.3*inch))
    
    # Delivery Details
    delivery_data = [
        ['Delivery Address:', booking['delivery_address']],
        ['Fuel Type:', booking['fuel_type'].upper()],
        ['Preferred Date:', booking['preferred_date']],
        ['Preferred Time:', booking['preferred_time']],
    ]
    if booking.get('ordered_amount'):
        delivery_data.append(['Ordered Amount:', f"{booking['ordered_amount']} L"])
    if booking.get('dispensed_amount'):
        delivery_data.append(['Dispensed Amount:', f"{booking['dispensed_amount']} L"])
    
    delivery_table = Table(delivery_data, colWidths=[2*inch, 4*inch])
    delivery_table.setStyle(TableStyle([
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    elements.append(delivery_table)
    elements.append(Spacer(1, 0.3*inch))
    
    # Price Breakdown
    price_header = Paragraph("<b>Price Breakdown</b>", styles['Heading2'])
    elements.append(price_header)
    elements.append(Spacer(1, 0.1*inch))
    
    # Use dispensed amount if available, otherwise use fuel_quantity_liters
    quantity_for_price = booking.get('dispensed_amount', booking["fuel_quantity_liters"])
    quantity_label = f"Dispensed: {quantity_for_price}L" if booking.get('dispensed_amount') else f"{quantity_for_price}L"
    
    price_data = [
        ['Description', 'Rate/Amount', 'Total'],
        [f'Fuel Price ({quantity_label})', f'${booking["fuel_price_per_liter"]:.4f}/L', f'${quantity_for_price * booking["fuel_price_per_liter"]:.2f}'],
        [f'Federal Carbon Tax ({quantity_label})', f'${booking["federal_carbon_tax"]:.4f}/L', f'${quantity_for_price * booking["federal_carbon_tax"]:.2f}'],
        [f'Quebec Carbon Tax ({quantity_label})', f'${booking["quebec_carbon_tax"]:.4f}/L', f'${quantity_for_price * booking["quebec_carbon_tax"]:.2f}'],
        ['Subtotal', '', f'${booking["subtotal"]:.2f}'],
        [f'GST ({booking["gst_rate"]*100:.2f}%)', '', f'${booking["subtotal"] * booking["gst_rate"]:.2f}'],
        [f'QST ({booking["qst_rate"]*100:.4f}%)', '', f'${booking["subtotal"] * booking["qst_rate"]:.2f}'],
        ['TOTAL', '', f'${booking["total_price"]}'],
    ]
    
    price_table = Table(price_data, colWidths=[3*inch, 1.5*inch, 1.5*inch])
    price_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('LINEABOVE', (0, -1), (-1, -1), 2, colors.black),
        ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, -1), (-1, -1), 12),
    ]))
    elements.append(price_table)
    
    # Add images if they exist
    invoice_images = booking.get('invoice_images', [])
    if invoice_images:
        elements.append(Spacer(1, 0.3*inch))
        elements.append(Paragraph("<b>Attached Images</b>", styles['Heading2']))
        elements.append(Spacer(1, 0.1*inch))
        
        for img_name in invoice_images[:5]:
            img_path = INVOICE_IMAGES_DIR / img_name
            if img_path.exists():
                try:
                    img = RLImage(str(img_path), width=4*inch, height=3*inch)
                    elements.append(img)
                    elements.append(Spacer(1, 0.1*inch))
                except:
                    pass
    
    # Build PDF
    doc.build(elements)
    buffer.seek(0)
    
    return Response(
        content=buffer.read(),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=invoice_{booking_id}.pdf"}
    )


# Admin-only Tank and Equipment Management (for all customers)
class AdminTankCreate(BaseModel):
    user_id: str
    name: str
    identifier: str
    capacity: Optional[float] = None

class AdminEquipmentCreate(BaseModel):
    user_id: str
    name: str
    unit_number: str
    license_plate: str
    capacity: Optional[float] = None

@api_router.get("/admin/fuel-tanks")
async def admin_get_all_fuel_tanks(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    tanks = await db.fuel_tanks.find({}, {"_id": 0}).to_list(10000)
    return tanks

@api_router.post("/admin/fuel-tanks")
async def admin_create_fuel_tank(tank_data: AdminTankCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    tank = FuelTank(
        id=str(uuid.uuid4()),
        name=tank_data.name,
        identifier=tank_data.identifier,
        capacity=tank_data.capacity
    )
    doc = tank.model_dump()
    doc['user_id'] = tank_data.user_id
    
    await db.fuel_tanks.insert_one(doc)
    return tank

@api_router.put("/admin/fuel-tanks/{tank_id}")
async def admin_update_fuel_tank(tank_id: str, tank_data: FuelTankCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.fuel_tanks.update_one(
        {"id": tank_id},
        {"$set": tank_data.model_dump()}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Fuel tank not found")
    
    tank = await db.fuel_tanks.find_one({"id": tank_id}, {"_id": 0})
    return tank

@api_router.delete("/admin/fuel-tanks/{tank_id}")
async def admin_delete_fuel_tank(tank_id: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.fuel_tanks.delete_one({"id": tank_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Fuel tank not found")
    
    return {"message": "Fuel tank deleted successfully"}

@api_router.get("/admin/equipment")
async def admin_get_all_equipment(current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    equipment = await db.customer_equipment.find({}, {"_id": 0}).to_list(10000)
    return equipment

@api_router.post("/admin/equipment")
async def admin_create_equipment(equipment_data: AdminEquipmentCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    equipment = CustomerEquipment(
        id=str(uuid.uuid4()),
        name=equipment_data.name,
        unit_number=equipment_data.unit_number,
        license_plate=equipment_data.license_plate,
        capacity=equipment_data.capacity
    )
    doc = equipment.model_dump()
    doc['user_id'] = equipment_data.user_id
    
    await db.customer_equipment.insert_one(doc)
    return equipment

@api_router.put("/admin/equipment/{equipment_id}")
async def admin_update_equipment(equipment_id: str, equipment_data: CustomerEquipmentCreate, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.customer_equipment.update_one(
        {"id": equipment_id},
        {"$set": equipment_data.model_dump()}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Equipment not found")
    
    equipment = await db.customer_equipment.find_one({"id": equipment_id}, {"_id": 0})
    return equipment

@api_router.delete("/admin/equipment/{equipment_id}")
async def admin_delete_equipment(equipment_id: str, current_user: dict = Depends(get_current_user)):
    if current_user['role'] != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    result = await db.customer_equipment.delete_one({"id": equipment_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Equipment not found")
    
    return {"message": "Equipment deleted successfully"}

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