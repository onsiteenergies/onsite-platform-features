import requests
import sys
import json
from datetime import datetime
import uuid

class FuelDeliveryAPITester:
    def __init__(self, base_url="https://tanker-track-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.admin_token = None
        self.customer_token = None
        self.customer_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        self.created_tank_ids = []
        self.created_equipment_ids = []

    def log_test(self, name, success, details=""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
        
        result = {
            "test": name,
            "status": "PASS" if success else "FAIL",
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        
        status_icon = "✅" if success else "❌"
        print(f"{status_icon} {name}: {details}")

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        default_headers = {'Content-Type': 'application/json'}
        if headers:
            default_headers.update(headers)

        try:
            if method == 'GET':
                response = requests.get(url, headers=default_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=default_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=default_headers)

            success = response.status_code == expected_status
            details = f"Status: {response.status_code}"
            
            if success:
                try:
                    response_data = response.json()
                    details += f", Response: {json.dumps(response_data, indent=2)[:200]}..."
                    self.log_test(name, True, details)
                    return True, response_data
                except:
                    self.log_test(name, True, details)
                    return True, {}
            else:
                try:
                    error_data = response.json()
                    details += f", Error: {error_data}"
                except:
                    details += f", Error: {response.text[:200]}"
                self.log_test(name, False, details)
                return False, {}

        except Exception as e:
            self.log_test(name, False, f"Exception: {str(e)}")
            return False, {}

    def test_admin_login(self):
        """Test admin login"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"email": "admin@fuel.com", "password": "admin123"}
        )
        if success and 'token' in response:
            self.admin_token = response['token']
            return True
        return False

    def test_customer_login(self):
        """Test customer login"""
        success, response = self.run_test(
            "Customer Login",
            "POST",
            "auth/login",
            200,
            data={"email": "test@fuel.com", "password": "password123"}
        )
        if success and 'token' in response:
            self.customer_token = response['token']
            self.customer_id = response['user']['id']
            return True
        return False

    def test_customer_registration(self):
        """Test customer registration"""
        test_email = f"test_customer_{datetime.now().strftime('%H%M%S')}@test.com"
        success, response = self.run_test(
            "Customer Registration",
            "POST",
            "auth/register",
            200,
            data={
                "email": test_email,
                "password": "testpass123",
                "name": "Test Customer"
            }
        )
        return success

    def test_get_pricing(self):
        """Test get pricing configuration"""
        success, response = self.run_test(
            "Get Pricing Configuration",
            "GET",
            "pricing",
            200
        )
        return success, response

    def test_update_pricing(self):
        """Test update pricing (admin only)"""
        if not self.admin_token:
            self.log_test("Update Pricing", False, "No admin token available")
            return False

        success, response = self.run_test(
            "Update Pricing Configuration",
            "PUT",
            "pricing",
            200,
            data={
                "fuel_price_per_liter": 1.55,
                "federal_carbon_tax": 0.15
            },
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        return success

    def test_create_booking(self):
        """Test create booking (customer)"""
        if not self.customer_token:
            self.log_test("Create Booking", False, "No customer token available")
            return False, None

        booking_data = {
            "delivery_address": "123 Test Street, Montreal, QC",
            "fuel_quantity_liters": 1000.0,
            "fuel_type": "diesel",
            "preferred_date": "2024-12-31",
            "preferred_time": "10:00",
            "special_instructions": "Test booking instructions",
            "multiple_locations": ["456 Second St, Montreal, QC"],
            "trucks": [
                {
                    "license_plate": "TEST-123",
                    "driver_name": "Test Driver",
                    "capacity_liters": 5000.0
                }
            ]
        }

        success, response = self.run_test(
            "Create Booking",
            "POST",
            "bookings",
            200,
            data=booking_data,
            headers={"Authorization": f"Bearer {self.customer_token}"}
        )
        
        if success and 'id' in response:
            return True, response['id']
        return False, None

    def test_get_bookings_customer(self):
        """Test get bookings as customer"""
        if not self.customer_token:
            self.log_test("Get Customer Bookings", False, "No customer token available")
            return False

        success, response = self.run_test(
            "Get Customer Bookings",
            "GET",
            "bookings",
            200,
            headers={"Authorization": f"Bearer {self.customer_token}"}
        )
        return success

    def test_get_bookings_admin(self):
        """Test get all bookings as admin"""
        if not self.admin_token:
            self.log_test("Get Admin Bookings", False, "No admin token available")
            return False

        success, response = self.run_test(
            "Get All Bookings (Admin)",
            "GET",
            "bookings",
            200,
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        return success

    def test_update_booking_status(self, booking_id):
        """Test update booking status (admin only)"""
        if not self.admin_token or not booking_id:
            self.log_test("Update Booking Status", False, "No admin token or booking ID available")
            return False

        success, response = self.run_test(
            "Update Booking Status",
            "PUT",
            f"bookings/{booking_id}",
            200,
            data={"status": "confirmed"},
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        return success

    def test_create_delivery_log(self, booking_id):
        """Test create delivery log (admin only)"""
        if not self.admin_token or not booking_id:
            self.log_test("Create Delivery Log", False, "No admin token or booking ID available")
            return False

        log_data = {
            "booking_id": booking_id,
            "truck_license_plate": "TEST-123",
            "driver_name": "Test Driver",
            "liters_delivered": 1000.0,
            "notes": "Test delivery completed successfully"
        }

        success, response = self.run_test(
            "Create Delivery Log",
            "POST",
            "logs",
            200,
            data=log_data,
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        return success

    def test_get_delivery_logs(self):
        """Test get delivery logs (admin only)"""
        if not self.admin_token:
            self.log_test("Get Delivery Logs", False, "No admin token available")
            return False

        success, response = self.run_test(
            "Get Delivery Logs",
            "GET",
            "logs",
            200,
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        return success

    def test_get_logs_by_booking(self, booking_id):
        """Test get logs by booking ID"""
        if not self.customer_token or not booking_id:
            self.log_test("Get Logs by Booking", False, "No customer token or booking ID available")
            return False

        success, response = self.run_test(
            "Get Logs by Booking",
            "GET",
            f"logs/booking/{booking_id}",
            200,
            headers={"Authorization": f"Bearer {self.customer_token}"}
        )
        return success

    def test_get_admin_stats(self):
        """Test get admin statistics"""
        if not self.admin_token:
            self.log_test("Get Admin Stats", False, "No admin token available")
            return False

        success, response = self.run_test(
            "Get Admin Statistics",
            "GET",
            "stats",
            200,
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        return success

    # New Multi-Select and Admin Resource Management Tests
    
    def test_create_customer_tanks(self):
        """Test creating tanks for customer"""
        if not self.customer_token:
            self.log_test("Create Customer Tanks", False, "No customer token available")
            return False

        tank_data = {
            "name": "Main Storage Tank",
            "identifier": "TANK-001",
            "capacity": 5000.0
        }

        success, response = self.run_test(
            "Create Customer Tank",
            "POST",
            "fuel-tanks",
            200,
            data=tank_data,
            headers={"Authorization": f"Bearer {self.customer_token}"}
        )
        
        if success and 'id' in response:
            self.created_tank_ids.append(response['id'])
            
        # Create second tank
        tank_data2 = {
            "name": "Secondary Tank",
            "identifier": "TANK-002", 
            "capacity": 3000.0
        }
        
        success2, response2 = self.run_test(
            "Create Second Customer Tank",
            "POST",
            "fuel-tanks",
            200,
            data=tank_data2,
            headers={"Authorization": f"Bearer {self.customer_token}"}
        )
        
        if success2 and 'id' in response2:
            self.created_tank_ids.append(response2['id'])
            
        return success and success2

    def test_create_customer_equipment(self):
        """Test creating equipment for customer"""
        if not self.customer_token:
            self.log_test("Create Customer Equipment", False, "No customer token available")
            return False

        equipment_data = {
            "name": "Excavator CAT 320",
            "unit_number": "EX-001",
            "license_plate": "QC-123-ABC",
            "capacity": 200.0
        }

        success, response = self.run_test(
            "Create Customer Equipment",
            "POST",
            "equipment",
            200,
            data=equipment_data,
            headers={"Authorization": f"Bearer {self.customer_token}"}
        )
        
        if success and 'id' in response:
            self.created_equipment_ids.append(response['id'])
            
        # Create second equipment
        equipment_data2 = {
            "name": "Bulldozer D6T",
            "unit_number": "BD-001",
            "license_plate": "QC-456-DEF",
            "capacity": 300.0
        }
        
        success2, response2 = self.run_test(
            "Create Second Customer Equipment",
            "POST",
            "equipment",
            200,
            data=equipment_data2,
            headers={"Authorization": f"Bearer {self.customer_token}"}
        )
        
        if success2 and 'id' in response2:
            self.created_equipment_ids.append(response2['id'])
            
        return success and success2

    def test_multi_select_booking_tanks_only(self):
        """Test creating booking with multiple tanks selected"""
        if not self.customer_token or len(self.created_tank_ids) < 2:
            self.log_test("Multi-Select Booking (Tanks Only)", False, "No customer token or insufficient tanks")
            return False, None

        booking_data = {
            "delivery_address": "789 Multi Tank Street, Montreal, QC",
            "fuel_quantity_liters": 2000.0,
            "fuel_type": "diesel",
            "preferred_date": "2024-12-31",
            "preferred_time": "14:00",
            "special_instructions": "Multi-tank delivery test",
            "selected_tank_ids": self.created_tank_ids
        }

        success, response = self.run_test(
            "Create Multi-Select Booking (Tanks Only)",
            "POST",
            "bookings",
            200,
            data=booking_data,
            headers={"Authorization": f"Bearer {self.customer_token}"}
        )
        
        # Verify selected_tanks array is populated
        if success and 'selected_tanks' in response:
            if len(response['selected_tanks']) == len(self.created_tank_ids):
                self.log_test("Multi-Select Tanks Verification", True, f"Found {len(response['selected_tanks'])} tanks in booking")
            else:
                self.log_test("Multi-Select Tanks Verification", False, f"Expected {len(self.created_tank_ids)} tanks, got {len(response['selected_tanks'])}")
        
        if success and 'id' in response:
            return True, response['id']
        return False, None

    def test_multi_select_booking_equipment_only(self):
        """Test creating booking with multiple equipment selected"""
        if not self.customer_token or len(self.created_equipment_ids) < 2:
            self.log_test("Multi-Select Booking (Equipment Only)", False, "No customer token or insufficient equipment")
            return False, None

        booking_data = {
            "delivery_address": "456 Multi Equipment Ave, Montreal, QC",
            "fuel_quantity_liters": 1500.0,
            "fuel_type": "gasoline",
            "preferred_date": "2024-12-30",
            "preferred_time": "09:00",
            "special_instructions": "Multi-equipment delivery test",
            "selected_equipment_ids": self.created_equipment_ids
        }

        success, response = self.run_test(
            "Create Multi-Select Booking (Equipment Only)",
            "POST",
            "bookings",
            200,
            data=booking_data,
            headers={"Authorization": f"Bearer {self.customer_token}"}
        )
        
        # Verify selected_equipment array is populated
        if success and 'selected_equipment' in response:
            if len(response['selected_equipment']) == len(self.created_equipment_ids):
                self.log_test("Multi-Select Equipment Verification", True, f"Found {len(response['selected_equipment'])} equipment in booking")
            else:
                self.log_test("Multi-Select Equipment Verification", False, f"Expected {len(self.created_equipment_ids)} equipment, got {len(response['selected_equipment'])}")
        
        if success and 'id' in response:
            return True, response['id']
        return False, None

    def test_multi_select_booking_both(self):
        """Test creating booking with both multiple tanks AND equipment selected"""
        if not self.customer_token or len(self.created_tank_ids) < 1 or len(self.created_equipment_ids) < 1:
            self.log_test("Multi-Select Booking (Both)", False, "No customer token or insufficient resources")
            return False, None

        booking_data = {
            "delivery_address": "321 Combined Resources Blvd, Montreal, QC",
            "fuel_quantity_liters": 3000.0,
            "fuel_type": "diesel",
            "preferred_date": "2024-12-29",
            "preferred_time": "11:00",
            "special_instructions": "Combined tanks and equipment delivery test",
            "selected_tank_ids": self.created_tank_ids,
            "selected_equipment_ids": self.created_equipment_ids
        }

        success, response = self.run_test(
            "Create Multi-Select Booking (Both Tanks & Equipment)",
            "POST",
            "bookings",
            200,
            data=booking_data,
            headers={"Authorization": f"Bearer {self.customer_token}"}
        )
        
        # Verify both arrays are populated
        if success:
            tanks_ok = 'selected_tanks' in response and len(response['selected_tanks']) == len(self.created_tank_ids)
            equipment_ok = 'selected_equipment' in response and len(response['selected_equipment']) == len(self.created_equipment_ids)
            
            if tanks_ok and equipment_ok:
                self.log_test("Multi-Select Both Verification", True, f"Found {len(response['selected_tanks'])} tanks and {len(response['selected_equipment'])} equipment")
            else:
                self.log_test("Multi-Select Both Verification", False, f"Tanks OK: {tanks_ok}, Equipment OK: {equipment_ok}")
        
        if success and 'id' in response:
            return True, response['id']
        return False, None

    def test_backward_compatibility_booking(self):
        """Test backward compatibility with old tank_name/equipment_name fields"""
        if not self.customer_token:
            self.log_test("Backward Compatibility Booking", False, "No customer token available")
            return False, None

        booking_data = {
            "delivery_address": "999 Legacy Street, Montreal, QC",
            "fuel_quantity_liters": 500.0,
            "fuel_type": "diesel",
            "preferred_date": "2024-12-28",
            "preferred_time": "16:00",
            "special_instructions": "Legacy booking format test",
            "tank_name": "Legacy Tank",
            "equipment_name": "Legacy Equipment"
        }

        success, response = self.run_test(
            "Create Backward Compatible Booking",
            "POST",
            "bookings",
            200,
            data=booking_data,
            headers={"Authorization": f"Bearer {self.customer_token}"}
        )
        
        if success and 'id' in response:
            return True, response['id']
        return False, None

    def test_admin_get_all_tanks(self):
        """Test admin can get all customers' tanks"""
        if not self.admin_token:
            self.log_test("Admin Get All Tanks", False, "No admin token available")
            return False

        success, response = self.run_test(
            "Admin Get All Fuel Tanks",
            "GET",
            "admin/fuel-tanks",
            200,
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        return success

    def test_admin_create_tank(self):
        """Test admin can create tank for any customer"""
        if not self.admin_token or not self.customer_id:
            self.log_test("Admin Create Tank", False, "No admin token or customer ID available")
            return False

        tank_data = {
            "user_id": self.customer_id,
            "name": "Admin Created Tank",
            "identifier": "ADMIN-TANK-001",
            "capacity": 8000.0
        }

        success, response = self.run_test(
            "Admin Create Tank for Customer",
            "POST",
            "admin/fuel-tanks",
            200,
            data=tank_data,
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        
        if success and 'id' in response:
            self.created_tank_ids.append(response['id'])
            
        return success

    def test_admin_update_tank(self):
        """Test admin can update any tank"""
        if not self.admin_token or len(self.created_tank_ids) == 0:
            self.log_test("Admin Update Tank", False, "No admin token or tank ID available")
            return False

        tank_id = self.created_tank_ids[0]
        update_data = {
            "name": "Updated Tank Name",
            "identifier": "UPDATED-001",
            "capacity": 6000.0
        }

        success, response = self.run_test(
            "Admin Update Tank",
            "PUT",
            f"admin/fuel-tanks/{tank_id}",
            200,
            data=update_data,
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        return success

    def test_admin_get_all_equipment(self):
        """Test admin can get all customers' equipment"""
        if not self.admin_token:
            self.log_test("Admin Get All Equipment", False, "No admin token available")
            return False

        success, response = self.run_test(
            "Admin Get All Equipment",
            "GET",
            "admin/equipment",
            200,
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        return success

    def test_admin_create_equipment(self):
        """Test admin can create equipment for any customer"""
        if not self.admin_token or not self.customer_id:
            self.log_test("Admin Create Equipment", False, "No admin token or customer ID available")
            return False

        equipment_data = {
            "user_id": self.customer_id,
            "name": "Admin Created Loader",
            "unit_number": "ADMIN-LD-001",
            "license_plate": "QC-ADMIN-001",
            "capacity": 400.0
        }

        success, response = self.run_test(
            "Admin Create Equipment for Customer",
            "POST",
            "admin/equipment",
            200,
            data=equipment_data,
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        
        if success and 'id' in response:
            self.created_equipment_ids.append(response['id'])
            
        return success

    def test_admin_update_equipment(self):
        """Test admin can update any equipment"""
        if not self.admin_token or len(self.created_equipment_ids) == 0:
            self.log_test("Admin Update Equipment", False, "No admin token or equipment ID available")
            return False

        equipment_id = self.created_equipment_ids[0]
        update_data = {
            "name": "Updated Equipment Name",
            "unit_number": "UPDATED-EQ-001",
            "license_plate": "QC-UPDATED-001",
            "capacity": 250.0
        }

        success, response = self.run_test(
            "Admin Update Equipment",
            "PUT",
            f"admin/equipment/{equipment_id}",
            200,
            data=update_data,
            headers={"Authorization": f"Bearer {self.admin_token}"}
        )
        return success

    def test_customer_access_admin_endpoints(self):
        """Test that customer cannot access admin endpoints (should get 403)"""
        if not self.customer_token:
            self.log_test("Customer Access Admin Endpoints", False, "No customer token available")
            return False

        # Test customer trying to access admin tank endpoint
        success1, response1 = self.run_test(
            "Customer Access Admin Tanks (Should Fail)",
            "GET",
            "admin/fuel-tanks",
            403,
            headers={"Authorization": f"Bearer {self.customer_token}"}
        )

        # Test customer trying to access admin equipment endpoint
        success2, response2 = self.run_test(
            "Customer Access Admin Equipment (Should Fail)",
            "GET",
            "admin/equipment",
            403,
            headers={"Authorization": f"Bearer {self.customer_token}"}
        )

        return success1 and success2

    def test_edge_cases(self):
        """Test edge cases for multi-select functionality"""
        if not self.customer_token:
            self.log_test("Edge Cases", False, "No customer token available")
            return False

        # Test booking with empty arrays
        booking_data1 = {
            "delivery_address": "123 Empty Arrays St, Montreal, QC",
            "fuel_quantity_liters": 1000.0,
            "fuel_type": "diesel",
            "preferred_date": "2024-12-27",
            "preferred_time": "10:00",
            "selected_tank_ids": [],
            "selected_equipment_ids": []
        }

        success1, response1 = self.run_test(
            "Booking with Empty Arrays",
            "POST",
            "bookings",
            200,
            data=booking_data1,
            headers={"Authorization": f"Bearer {self.customer_token}"}
        )

        # Test booking with invalid tank IDs
        booking_data2 = {
            "delivery_address": "456 Invalid IDs Ave, Montreal, QC",
            "fuel_quantity_liters": 1000.0,
            "fuel_type": "diesel",
            "preferred_date": "2024-12-26",
            "preferred_time": "12:00",
            "selected_tank_ids": ["invalid-tank-id-1", "invalid-tank-id-2"],
            "selected_equipment_ids": ["invalid-equipment-id-1"]
        }

        success2, response2 = self.run_test(
            "Booking with Invalid IDs",
            "POST",
            "bookings",
            200,  # Should still create booking but with empty selected arrays
            data=booking_data2,
            headers={"Authorization": f"Bearer {self.customer_token}"}
        )

        return success1 and success2

    def test_admin_delete_resources(self):
        """Test admin can delete tanks and equipment"""
        if not self.admin_token:
            self.log_test("Admin Delete Resources", False, "No admin token available")
            return False

        success_count = 0
        total_tests = 0

        # Delete a tank if we have any
        if len(self.created_tank_ids) > 0:
            tank_id = self.created_tank_ids.pop()
            total_tests += 1
            success, response = self.run_test(
                "Admin Delete Tank",
                "DELETE",
                f"admin/fuel-tanks/{tank_id}",
                200,
                headers={"Authorization": f"Bearer {self.admin_token}"}
            )
            if success:
                success_count += 1

        # Delete an equipment if we have any
        if len(self.created_equipment_ids) > 0:
            equipment_id = self.created_equipment_ids.pop()
            total_tests += 1
            success, response = self.run_test(
                "Admin Delete Equipment",
                "DELETE",
                f"admin/equipment/{equipment_id}",
                200,
                headers={"Authorization": f"Bearer {self.admin_token}"}
            )
            if success:
                success_count += 1

        return success_count == total_tests if total_tests > 0 else True

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Fuel Delivery Multi-Select & Admin Resource Management API Tests...")
        print(f"Testing against: {self.base_url}")
        print("=" * 80)

        # Authentication Tests
        print("\n📝 Authentication Tests")
        admin_login_success = self.test_admin_login()
        customer_login_success = self.test_customer_login()
        self.test_customer_registration()

        # Customer Resource Creation Tests (Prerequisites for multi-select)
        print("\n🏗️ Customer Resource Creation Tests")
        tanks_created = False
        equipment_created = False
        if customer_login_success:
            tanks_created = self.test_create_customer_tanks()
            equipment_created = self.test_create_customer_equipment()

        # Multi-Select Booking Tests
        print("\n📦 Multi-Select Booking Tests")
        multi_booking_ids = []
        if customer_login_success and tanks_created:
            success, booking_id = self.test_multi_select_booking_tanks_only()
            if success:
                multi_booking_ids.append(booking_id)
                
        if customer_login_success and equipment_created:
            success, booking_id = self.test_multi_select_booking_equipment_only()
            if success:
                multi_booking_ids.append(booking_id)
                
        if customer_login_success and tanks_created and equipment_created:
            success, booking_id = self.test_multi_select_booking_both()
            if success:
                multi_booking_ids.append(booking_id)

        # Backward Compatibility Tests
        print("\n🔄 Backward Compatibility Tests")
        if customer_login_success:
            success, booking_id = self.test_backward_compatibility_booking()
            if success:
                multi_booking_ids.append(booking_id)

        # Admin Resource Management Tests
        print("\n👑 Admin Resource Management Tests")
        if admin_login_success:
            self.test_admin_get_all_tanks()
            self.test_admin_create_tank()
            self.test_admin_update_tank()
            self.test_admin_get_all_equipment()
            self.test_admin_create_equipment()
            self.test_admin_update_equipment()

        # Security Tests
        print("\n🔒 Security Tests")
        if customer_login_success:
            self.test_customer_access_admin_endpoints()

        # Edge Cases Tests
        print("\n⚠️ Edge Cases Tests")
        if customer_login_success:
            self.test_edge_cases()

        # Standard Booking Tests
        print("\n📦 Standard Booking Tests")
        booking_id = None
        if customer_login_success:
            self.test_get_bookings_customer()

        if admin_login_success:
            self.test_get_bookings_admin()
            if len(multi_booking_ids) > 0:
                self.test_update_booking_status(multi_booking_ids[0])
                booking_id = multi_booking_ids[0]

        # Delivery Log Tests
        print("\n🚛 Delivery Log Tests")
        if admin_login_success and booking_id:
            self.test_create_delivery_log(booking_id)
            self.test_get_delivery_logs()
            
        if customer_login_success and booking_id:
            self.test_get_logs_by_booking(booking_id)

        # Admin Stats Tests
        print("\n📊 Admin Statistics Tests")
        if admin_login_success:
            self.test_get_admin_stats()

        # Cleanup Tests
        print("\n🧹 Cleanup Tests")
        if admin_login_success:
            self.test_admin_delete_resources()

        # Print Summary
        print("\n" + "=" * 80)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} tests passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
            return 0
        else:
            print("❌ Some tests failed!")
            failed_tests = [r for r in self.test_results if r['status'] == 'FAIL']
            print("\nFailed Tests:")
            for test in failed_tests:
                print(f"  - {test['test']}: {test['details']}")
            return 1

def main():
    tester = FuelDeliveryAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())