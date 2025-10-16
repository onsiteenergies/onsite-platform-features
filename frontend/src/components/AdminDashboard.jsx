import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { DollarSign, TrendingUp, Users, Package, Fuel, LogOut, FileText, Plus } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function AdminDashboard({ user, token, onLogout }) {
  const [stats, setStats] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [logs, setLogs] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [pricing, setPricing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showNewLog, setShowNewLog] = useState(false);
  const [showCustomerPricing, setShowCustomerPricing] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [newLog, setNewLog] = useState({
    booking_id: '',
    truck_license_plate: '',
    driver_name: '',
    liters_delivered: '',
    notes: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, bookingsRes, logsRes, pricingRes, customersRes] = await Promise.all([
        axios.get(`${API}/stats`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/bookings`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/logs`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/pricing`),
        axios.get(`${API}/customers`, { headers: { Authorization: `Bearer ${token}` } })
      ]);

      setStats(statsRes.data);
      setBookings(bookingsRes.data);
      setLogs(logsRes.data);
      setPricing(pricingRes.data);
      setCustomers(customersRes.data);
    } catch (error) {
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (bookingId, newStatus) => {
    try {
      await axios.put(
        `${API}/bookings/${bookingId}`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Booking status updated');
      fetchData();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleUpdatePricing = async (e) => {
    e.preventDefault();
    try {
      await axios.put(`${API}/pricing`, pricing, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Pricing updated successfully');
    } catch (error) {
      toast.error('Failed to update pricing');
    }
  };

  const handleCreateLog = async (e) => {
    e.preventDefault();
    try {
      const logData = {
        ...newLog,
        liters_delivered: parseFloat(newLog.liters_delivered)
      };

      await axios.post(`${API}/logs`, logData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Delivery log created successfully');
      setShowNewLog(false);
      setNewLog({
        booking_id: '',
        truck_license_plate: '',
        driver_name: '',
        liters_delivered: '',
        notes: ''
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create log');
    }
  };

  const getStatusBadge = (status) => {
    return <span className={`status-badge status-${status}`}>{status.replace('_', ' ').toUpperCase()}</span>;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-green-50 to-blue-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-green-50 to-blue-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-green-600 rounded-xl flex items-center justify-center">
                <Fuel className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">FuelTrack Admin</h1>
                <p className="text-sm text-gray-600">Welcome, {user.name}</p>
              </div>
            </div>
            <Button
              onClick={onLogout}
              variant="outline"
              data-testid="admin-logout-button"
              className="flex items-center space-x-2"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-3xl font-bold text-green-600" data-testid="stat-revenue">${stats.total_revenue}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Bookings</p>
                <p className="text-3xl font-bold text-blue-600" data-testid="stat-bookings">{stats.total_bookings}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Package className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Liters Delivered</p>
                <p className="text-3xl font-bold text-indigo-600" data-testid="stat-liters">{stats.total_liters_delivered}L</p>
              </div>
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-indigo-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Customers</p>
                <p className="text-3xl font-bold text-purple-600" data-testid="stat-customers">{stats.total_customers}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </Card>
        </div>

        {/* Tabs */}
        <Card className="p-6">
          <Tabs defaultValue="bookings">
            <TabsList className="mb-6">
              <TabsTrigger value="bookings" data-testid="tab-bookings">Bookings</TabsTrigger>
              <TabsTrigger value="logs" data-testid="tab-logs">Delivery Logs</TabsTrigger>
              <TabsTrigger value="pricing" data-testid="tab-pricing">Pricing</TabsTrigger>
            </TabsList>

            {/* Bookings Tab */}
            <TabsContent value="bookings">
              <div className="space-y-4">
                <h3 className="text-xl font-bold mb-4">All Bookings</h3>
                {bookings.map((booking) => (
                  <Card key={booking.id} className="p-4" data-testid={`admin-booking-${booking.id}`}>
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-bold text-lg">{booking.user_name}</h4>
                        <p className="text-sm text-gray-600">{booking.user_email}</p>
                        <p className="text-gray-700 mt-1">{booking.delivery_address}</p>
                      </div>
                      <div className="text-right">
                        {getStatusBadge(booking.status)}
                        <p className="text-xl font-bold text-green-600 mt-2">${booking.total_price}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-3 text-sm">
                      <div>
                        <span className="text-gray-600">Fuel Type:</span>
                        <span className="font-medium ml-2">{booking.fuel_type}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Quantity:</span>
                        <span className="font-medium ml-2">{booking.fuel_quantity_liters}L</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Date:</span>
                        <span className="font-medium ml-2">{booking.preferred_date}</span>
                      </div>
                    </div>

                    <div className="border-t pt-3">
                      <Label>Update Status</Label>
                      <Select
                        value={booking.status}
                        onValueChange={(value) => handleUpdateStatus(booking.id, value)}
                      >
                        <SelectTrigger data-testid={`booking-status-${booking.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="confirmed">Confirmed</SelectItem>
                          <SelectItem value="in_transit">In Transit</SelectItem>
                          <SelectItem value="delivered">Delivered</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Logs Tab */}
            <TabsContent value="logs">
              <div className="space-y-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-xl font-bold">Delivery Logs</h3>
                  <Dialog open={showNewLog} onOpenChange={setShowNewLog}>
                    <DialogTrigger asChild>
                      <Button
                        data-testid="new-log-button"
                        className="bg-gradient-to-r from-blue-600 to-green-600"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Log
                      </Button>
                    </DialogTrigger>
                    <DialogContent aria-describedby="log-dialog-description">
                      <DialogHeader>
                        <DialogTitle>Create Delivery Log</DialogTitle>
                      </DialogHeader>
                      <p id="log-dialog-description" className="sr-only">Record a delivery log for a completed fuel delivery</p>
                      <form onSubmit={handleCreateLog} className="space-y-4 mt-4">
                        <div>
                          <Label>Booking ID *</Label>
                          <Select
                            value={newLog.booking_id}
                            onValueChange={(value) => setNewLog({ ...newLog, booking_id: value })}
                            required
                          >
                            <SelectTrigger data-testid="log-booking-select">
                              <SelectValue placeholder="Select booking" />
                            </SelectTrigger>
                            <SelectContent>
                              {bookings.map((booking) => (
                                <SelectItem key={booking.id} value={booking.id}>
                                  {booking.user_name} - {booking.delivery_address}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>Truck License Plate *</Label>
                          <Input
                            data-testid="log-truck-plate"
                            value={newLog.truck_license_plate}
                            onChange={(e) => setNewLog({ ...newLog, truck_license_plate: e.target.value })}
                            placeholder="ABC-1234"
                            required
                          />
                        </div>

                        <div>
                          <Label>Driver Name *</Label>
                          <Input
                            data-testid="log-driver-name"
                            value={newLog.driver_name}
                            onChange={(e) => setNewLog({ ...newLog, driver_name: e.target.value })}
                            placeholder="John Doe"
                            required
                          />
                        </div>

                        <div>
                          <Label>Liters Delivered *</Label>
                          <Input
                            data-testid="log-liters"
                            type="number"
                            step="0.01"
                            value={newLog.liters_delivered}
                            onChange={(e) => setNewLog({ ...newLog, liters_delivered: e.target.value })}
                            placeholder="1000"
                            required
                          />
                        </div>

                        <div>
                          <Label>Notes</Label>
                          <Textarea
                            data-testid="log-notes"
                            value={newLog.notes}
                            onChange={(e) => setNewLog({ ...newLog, notes: e.target.value })}
                            placeholder="Additional notes..."
                          />
                        </div>

                        <div className="flex justify-end space-x-2">
                          <Button type="button" variant="outline" onClick={() => setShowNewLog(false)}>
                            Cancel
                          </Button>
                          <Button type="submit" data-testid="create-log-submit">
                            Create Log
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>

                {logs.length === 0 ? (
                  <Card className="p-8 text-center">
                    <FileText className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                    <p className="text-gray-600">No delivery logs yet</p>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {logs.map((log) => (
                      <Card key={log.id} className="p-4" data-testid={`log-${log.id}`}>
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold">{log.truck_license_plate} - {log.driver_name}</h4>
                            <p className="text-sm text-gray-600 mt-1">
                              Delivered: <span className="font-medium text-green-600">{log.liters_delivered}L</span>
                            </p>
                            {log.notes && (
                              <p className="text-sm text-gray-500 mt-2">{log.notes}</p>
                            )}
                          </div>
                          <div className="text-right text-xs text-gray-500">
                            {new Date(log.delivery_time).toLocaleString()}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Pricing Tab */}
            <TabsContent value="pricing">
              <div className="max-w-2xl">
                <h3 className="text-xl font-bold mb-4">Pricing Configuration</h3>
                <form onSubmit={handleUpdatePricing} className="space-y-4">
                  <div>
                    <Label>Fuel Price per Liter ($)</Label>
                    <Input
                      data-testid="pricing-fuel-price"
                      type="number"
                      step="0.01"
                      value={pricing.fuel_price_per_liter}
                      onChange={(e) => setPricing({ ...pricing, fuel_price_per_liter: parseFloat(e.target.value) })}
                      required
                    />
                  </div>

                  <div>
                    <Label>Federal Carbon Tax per Liter ($)</Label>
                    <Input
                      data-testid="pricing-federal-tax"
                      type="number"
                      step="0.01"
                      value={pricing.federal_carbon_tax}
                      onChange={(e) => setPricing({ ...pricing, federal_carbon_tax: parseFloat(e.target.value) })}
                      required
                    />
                  </div>

                  <div>
                    <Label>Quebec Carbon Tax per Liter ($)</Label>
                    <Input
                      data-testid="pricing-quebec-tax"
                      type="number"
                      step="0.01"
                      value={pricing.quebec_carbon_tax}
                      onChange={(e) => setPricing({ ...pricing, quebec_carbon_tax: parseFloat(e.target.value) })}
                      required
                    />
                  </div>

                  <div>
                    <Label>GST Rate (decimal)</Label>
                    <Input
                      data-testid="pricing-gst"
                      type="number"
                      step="0.0001"
                      value={pricing.gst_rate}
                      onChange={(e) => setPricing({ ...pricing, gst_rate: parseFloat(e.target.value) })}
                      required
                    />
                    <p className="text-sm text-gray-600 mt-1">Current: {(pricing.gst_rate * 100).toFixed(2)}%</p>
                  </div>

                  <div>
                    <Label>QST Rate (decimal)</Label>
                    <Input
                      data-testid="pricing-qst"
                      type="number"
                      step="0.0001"
                      value={pricing.qst_rate}
                      onChange={(e) => setPricing({ ...pricing, qst_rate: parseFloat(e.target.value) })}
                      required
                    />
                    <p className="text-sm text-gray-600 mt-1">Current: {(pricing.qst_rate * 100).toFixed(3)}%</p>
                  </div>

                  <Button
                    type="submit"
                    data-testid="update-pricing-submit"
                    className="bg-gradient-to-r from-blue-600 to-green-600"
                  >
                    Update Pricing
                  </Button>
                </form>
              </div>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}