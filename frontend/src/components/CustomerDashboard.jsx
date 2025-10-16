import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Truck, Calendar, Fuel, MapPin, Clock, Package, LogOut, FileText } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function CustomerDashboard({ user, token, onLogout }) {
  const [bookings, setBookings] = useState([]);
  const [logs, setLogs] = useState({});
  const [pricing, setPricing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showNewBooking, setShowNewBooking] = useState(false);
  const [newBooking, setNewBooking] = useState({
    delivery_address: '',
    fuel_quantity_liters: '',
    fuel_type: 'diesel',
    preferred_date: '',
    preferred_time: '',
    special_instructions: '',
    multiple_locations: [],
    trucks: [{ license_plate: '', driver_name: '', capacity_liters: '' }]
  });
  const [locationInput, setLocationInput] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    await Promise.all([fetchBookings(), fetchPricing()]);
  };

  const fetchPricing = async () => {
    try {
      const response = await axios.get(`${API}/pricing`);
      setPricing(response.data);
    } catch (error) {
      console.error('Failed to fetch pricing:', error);
    }
  };

  const fetchBookings = async () => {
    try {
      const response = await axios.get(`${API}/bookings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBookings(response.data);
      
      // Fetch logs for each booking
      for (const booking of response.data) {
        fetchLogsForBooking(booking.id);
      }
    } catch (error) {
      toast.error('Failed to fetch bookings');
    } finally {
      setLoading(false);
    }
  };

  const fetchLogsForBooking = async (bookingId) => {
    try {
      const response = await axios.get(`${API}/logs/booking/${bookingId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLogs(prev => ({ ...prev, [bookingId]: response.data }));
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    }
  };

  const handleCreateBooking = async (e) => {
    e.preventDefault();
    try {
      const bookingData = {
        ...newBooking,
        fuel_quantity_liters: parseFloat(newBooking.fuel_quantity_liters),
        multiple_locations: newBooking.multiple_locations.length > 0 ? newBooking.multiple_locations : null,
        trucks: newBooking.trucks.map(t => ({
          ...t,
          capacity_liters: parseFloat(t.capacity_liters)
        }))
      };

      await axios.post(`${API}/bookings`, bookingData, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Booking created successfully!');
      setShowNewBooking(false);
      setNewBooking({
        delivery_address: '',
        fuel_quantity_liters: '',
        fuel_type: 'diesel',
        preferred_date: '',
        preferred_time: '',
        special_instructions: '',
        multiple_locations: [],
        trucks: [{ license_plate: '', driver_name: '', capacity_liters: '' }]
      });
      fetchBookings();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create booking');
    }
  };

  const addTruck = () => {
    setNewBooking({
      ...newBooking,
      trucks: [...newBooking.trucks, { license_plate: '', driver_name: '', capacity_liters: '' }]
    });
  };

  const removeTruck = (index) => {
    setNewBooking({
      ...newBooking,
      trucks: newBooking.trucks.filter((_, i) => i !== index)
    });
  };

  const updateTruck = (index, field, value) => {
    const updatedTrucks = [...newBooking.trucks];
    updatedTrucks[index][field] = value;
    setNewBooking({ ...newBooking, trucks: updatedTrucks });
  };

  const addLocation = () => {
    if (locationInput.trim()) {
      setNewBooking({
        ...newBooking,
        multiple_locations: [...newBooking.multiple_locations, locationInput.trim()]
      });
      setLocationInput('');
    }
  };

  const removeLocation = (index) => {
    setNewBooking({
      ...newBooking,
      multiple_locations: newBooking.multiple_locations.filter((_, i) => i !== index)
    });
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
                <h1 className="text-2xl font-bold text-gray-900">FuelTrack</h1>
                <p className="text-sm text-gray-600">Welcome, {user.name}</p>
              </div>
            </div>
            <Button
              onClick={onLogout}
              variant="outline"
              data-testid="logout-button"
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
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-3xl font-bold text-gray-900">My Bookings</h2>
          <Dialog open={showNewBooking} onOpenChange={setShowNewBooking}>
            <DialogTrigger asChild>
              <Button
                data-testid="new-booking-button"
                className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 flex items-center space-x-2"
              >
                <Plus className="w-5 h-5" />
                <span>New Booking</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" aria-describedby="booking-dialog-description">
              <DialogHeader>
                <DialogTitle>Create New Booking</DialogTitle>
              </DialogHeader>
              <p id="booking-dialog-description" className="sr-only">Fill out the form to create a new fuel delivery booking</p>
              <form onSubmit={handleCreateBooking} className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label>Delivery Address *</Label>
                    <Input
                      data-testid="booking-address"
                      value={newBooking.delivery_address}
                      onChange={(e) => setNewBooking({ ...newBooking, delivery_address: e.target.value })}
                      placeholder="123 Main St, Montreal, QC"
                      required
                    />
                  </div>

                  <div>
                    <Label>Fuel Type *</Label>
                    <Select
                      value={newBooking.fuel_type}
                      onValueChange={(value) => setNewBooking({ ...newBooking, fuel_type: value })}
                    >
                      <SelectTrigger data-testid="booking-fuel-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="diesel">Diesel</SelectItem>
                        <SelectItem value="gasoline">Gasoline</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Quantity (Liters) *</Label>
                    <Input
                      data-testid="booking-quantity"
                      type="number"
                      step="0.01"
                      value={newBooking.fuel_quantity_liters}
                      onChange={(e) => setNewBooking({ ...newBooking, fuel_quantity_liters: e.target.value })}
                      placeholder="1000"
                      required
                    />
                  </div>

                  <div>
                    <Label>Preferred Date *</Label>
                    <Input
                      data-testid="booking-date"
                      type="date"
                      value={newBooking.preferred_date}
                      onChange={(e) => setNewBooking({ ...newBooking, preferred_date: e.target.value })}
                      required
                    />
                  </div>

                  <div>
                    <Label>Preferred Time *</Label>
                    <Input
                      data-testid="booking-time"
                      type="time"
                      value={newBooking.preferred_time}
                      onChange={(e) => setNewBooking({ ...newBooking, preferred_time: e.target.value })}
                      required
                    />
                  </div>

                  <div className="col-span-2">
                    <Label>Special Instructions</Label>
                    <Textarea
                      data-testid="booking-instructions"
                      value={newBooking.special_instructions}
                      onChange={(e) => setNewBooking({ ...newBooking, special_instructions: e.target.value })}
                      placeholder="Any special requirements..."
                    />
                  </div>

                  <div className="col-span-2">
                    <Label>Additional Delivery Locations</Label>
                    <div className="flex space-x-2">
                      <Input
                        data-testid="additional-location-input"
                        value={locationInput}
                        onChange={(e) => setLocationInput(e.target.value)}
                        placeholder="Add another delivery location"
                      />
                      <Button type="button" onClick={addLocation} data-testid="add-location-button">
                        Add
                      </Button>
                    </div>
                    {newBooking.multiple_locations.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {newBooking.multiple_locations.map((loc, idx) => (
                          <div key={idx} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                            <span className="text-sm">{loc}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeLocation(idx)}
                              data-testid={`remove-location-${idx}`}
                            >
                              Remove
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <div className="flex justify-between items-center mb-3">
                    <Label className="text-lg">Trucks</Label>
                    <Button type="button" onClick={addTruck} size="sm" data-testid="add-truck-button">
                      <Plus className="w-4 h-4 mr-1" /> Add Truck
                    </Button>
                  </div>

                  {newBooking.trucks.map((truck, idx) => (
                    <div key={idx} className="border rounded-lg p-4 mb-3 bg-gray-50">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="font-semibold">Truck {idx + 1}</h4>
                        {newBooking.trucks.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeTruck(idx)}
                            data-testid={`remove-truck-${idx}`}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <div>
                          <Label>License Plate *</Label>
                          <Input
                            data-testid={`truck-${idx}-plate`}
                            value={truck.license_plate}
                            onChange={(e) => updateTruck(idx, 'license_plate', e.target.value)}
                            placeholder="ABC-1234"
                            required
                          />
                        </div>
                        <div>
                          <Label>Driver Name *</Label>
                          <Input
                            data-testid={`truck-${idx}-driver`}
                            value={truck.driver_name}
                            onChange={(e) => updateTruck(idx, 'driver_name', e.target.value)}
                            placeholder="John Doe"
                            required
                          />
                        </div>
                        <div>
                          <Label>Capacity (L) *</Label>
                          <Input
                            data-testid={`truck-${idx}-capacity`}
                            type="number"
                            step="0.01"
                            value={truck.capacity_liters}
                            onChange={(e) => updateTruck(idx, 'capacity_liters', e.target.value)}
                            placeholder="5000"
                            required
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setShowNewBooking(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    data-testid="create-booking-submit"
                    className="bg-gradient-to-r from-blue-600 to-green-600"
                  >
                    Create Booking
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Bookings Grid */}
        {bookings.length === 0 ? (
          <Card className="p-12 text-center">
            <Package className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No bookings yet</h3>
            <p className="text-gray-500 mb-4">Create your first fuel delivery booking to get started</p>
            <Button onClick={() => setShowNewBooking(true)} data-testid="empty-state-new-booking">
              Create Booking
            </Button>
          </Card>
        ) : (
          <div className="grid gap-6">
            {bookings.map((booking) => (
              <Card key={booking.id} className="p-6 hover:shadow-xl transition-shadow" data-testid={`booking-${booking.id}`}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 mb-1">
                      {booking.fuel_quantity_liters}L {booking.fuel_type}
                    </h3>
                    <div className="text-gray-600 flex items-center">
                      <MapPin className="w-4 h-4 mr-1" />
                      {booking.delivery_address}
                    </div>
                  </div>
                  <div className="text-right">
                    {getStatusBadge(booking.status)}
                    <p className="text-2xl font-bold text-green-600 mt-2">${booking.total_price}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <Calendar className="w-4 h-4 mr-2 text-blue-600" />
                    {booking.preferred_date}
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Clock className="w-4 h-4 mr-2 text-blue-600" />
                    {booking.preferred_time}
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Truck className="w-4 h-4 mr-2 text-green-600" />
                    {booking.trucks.length} Truck(s)
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <FileText className="w-4 h-4 mr-2 text-blue-600" />
                    {logs[booking.id]?.length || 0} Log(s)
                  </div>
                </div>

                {/* Price Breakdown */}
                <div className="border-t pt-4 mb-4">
                  <h4 className="font-semibold mb-3">Price Breakdown</h4>
                  <div className="space-y-3">
                    {/* Fuel Price Calculation */}
                    {booking.rack_price && booking.customer_price_modifier !== undefined && (
                      <div className="bg-blue-50 p-3 rounded-lg">
                        <div className="text-sm font-semibold text-blue-900 mb-2">Fuel Price Calculation:</div>
                        <div className="text-sm text-blue-800 space-y-1">
                          <div className="flex justify-between">
                            <span>Rack Price (Daily Refinery Rate):</span>
                            <span className="font-medium">${booking.rack_price.toFixed(4)}/L</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Rack Price Adjustment:</span>
                            <span className={`font-medium ${booking.customer_price_modifier >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                              {booking.customer_price_modifier >= 0 ? '+' : ''}${booking.customer_price_modifier.toFixed(4)}/L
                            </span>
                          </div>
                          <div className="flex justify-between border-t border-blue-200 pt-1 mt-1">
                            <span className="font-semibold">Your Fuel Price:</span>
                            <span className="font-bold text-blue-900">${booking.fuel_price_per_liter.toFixed(4)}/L</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Line Items */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-700">
                          <span className="font-medium">Fuel Price:</span> ${booking.fuel_price_per_liter.toFixed(4)}/L × {booking.fuel_quantity_liters}L
                        </span>
                        <span className="font-semibold text-gray-900">${(booking.fuel_quantity_liters * booking.fuel_price_per_liter).toFixed(2)}</span>
                      </div>

                      <div className="flex justify-between text-sm">
                        <span className="text-gray-700">
                          <span className="font-medium">Federal Carbon Tax:</span> ${booking.federal_carbon_tax.toFixed(4)}/L × {booking.fuel_quantity_liters}L
                        </span>
                        <span className="font-semibold text-gray-900">${(booking.fuel_quantity_liters * booking.federal_carbon_tax).toFixed(2)}</span>
                      </div>

                      <div className="flex justify-between text-sm">
                        <span className="text-gray-700">
                          <span className="font-medium">Quebec Carbon Tax:</span> ${booking.quebec_carbon_tax.toFixed(4)}/L × {booking.fuel_quantity_liters}L
                        </span>
                        <span className="font-semibold text-gray-900">${(booking.fuel_quantity_liters * booking.quebec_carbon_tax).toFixed(2)}</span>
                      </div>

                      <div className="flex justify-between text-sm pt-2 border-t">
                        <span className="text-gray-700">
                          <span className="font-medium">Subtotal:</span>
                        </span>
                        <span className="font-semibold text-gray-900">${booking.subtotal.toFixed(2)}</span>
                      </div>

                      <div className="flex justify-between text-sm">
                        <span className="text-gray-700">
                          <span className="font-medium">GST:</span> {(booking.gst_rate * 100).toFixed(2)}% on subtotal
                        </span>
                        <span className="font-semibold text-gray-900">${(booking.subtotal * booking.gst_rate).toFixed(2)}</span>
                      </div>

                      <div className="flex justify-between text-sm">
                        <span className="text-gray-700">
                          <span className="font-medium">QST:</span> {(booking.qst_rate * 100).toFixed(4)}% on subtotal
                        </span>
                        <span className="font-semibold text-gray-900">${(booking.subtotal * booking.qst_rate).toFixed(2)}</span>
                      </div>

                      <div className="flex justify-between text-base pt-3 border-t-2 border-gray-300">
                        <span className="font-bold text-gray-900">Total Amount:</span>
                        <span className="font-bold text-green-600 text-lg">${booking.total_price}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Trucks */}
                <div className="border-t pt-4 mb-4">
                  <h4 className="font-semibold mb-2">Assigned Trucks</h4>
                  <div className="space-y-2">
                    {booking.trucks.map((truck, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
                        <div>
                          <p className="font-medium">{truck.license_plate}</p>
                          <p className="text-sm text-gray-600">Driver: {truck.driver_name}</p>
                        </div>
                        <div className="text-sm text-gray-600">
                          Capacity: {truck.capacity_liters}L
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Delivery Logs */}
                {logs[booking.id] && logs[booking.id].length > 0 && (
                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-2">Delivery Logs</h4>
                    <div className="space-y-2">
                      {logs[booking.id].map((log) => (
                        <div key={log.id} className="bg-green-50 p-3 rounded-lg">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">{log.truck_license_plate} - {log.driver_name}</p>
                              <p className="text-sm text-gray-600">{log.liters_delivered}L delivered</p>
                              {log.notes && <p className="text-sm text-gray-500 mt-1">{log.notes}</p>}
                            </div>
                            <p className="text-xs text-gray-500">{new Date(log.delivery_time).toLocaleString()}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}