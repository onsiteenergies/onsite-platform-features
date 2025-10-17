import requests
import sys
import json
from datetime import datetime

class FuelDeliveryAPITester:
    def __init__(self, base_url="https://tanker-track-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.admin_token = None
        self.customer_token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

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
            data={"email": "customer@fuel.com", "password": "customer123"}
        )
        if success and 'token' in response:
            self.customer_token = response['token']
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

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Fuel Delivery API Tests...")
        print(f"Testing against: {self.base_url}")
        print("=" * 60)

        # Authentication Tests
        print("\n📝 Authentication Tests")
        admin_login_success = self.test_admin_login()
        customer_login_success = self.test_customer_login()
        self.test_customer_registration()

        # Pricing Tests
        print("\n💰 Pricing Tests")
        pricing_success, pricing_data = self.test_get_pricing()
        if admin_login_success:
            self.test_update_pricing()

        # Booking Tests
        print("\n📦 Booking Tests")
        booking_id = None
        if customer_login_success:
            booking_success, booking_id = self.test_create_booking()
            self.test_get_bookings_customer()

        if admin_login_success:
            self.test_get_bookings_admin()
            if booking_id:
                self.test_update_booking_status(booking_id)

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

        # Print Summary
        print("\n" + "=" * 60)
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