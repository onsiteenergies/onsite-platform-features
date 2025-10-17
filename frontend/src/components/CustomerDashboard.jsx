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
import { Plus, Truck, Calendar, Fuel, MapPin, Clock, Package, LogOut, FileText, Settings } from 'lucide-react';
import TanksAndEquipment from '@/components/TanksAndEquipment';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function CustomerDashboard({ user, token, onLogout }) {
  const [bookings, setBookings] = useState([]);
  const [logs, setLogs] = useState({});
  const [pricing, setPricing] = useState(null);
  const [tanks, setTanks] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewBooking, setShowNewBooking] = useState(false);
  const [showTanksEquipment, setShowTanksEquipment] = useState(false);
  const [newBooking, setNewBooking] = useState({
    delivery_address: '',
    fuel_quantity_liters: '',
    fuel_type: 'diesel',
    preferred_date: '',
    preferred_time: '',
    special_instructions: '',
    multiple_locations: [],
    selected_tank_ids: [],
    selected_equipment_ids: []
  });
  const [locationInput, setLocationInput] = useState('');
  
  // New state for "Add to Order" functionality
  const [orderItems, setOrderItems] = useState([]); // [{id, type: 'tank'|'equipment', name, quantity, capacity}]
  const [showAddToOrderDialog, setShowAddToOrderDialog] = useState(false);
  const [currentOrderItem, setCurrentOrderItem] = useState(null);
  const [orderQuantity, setOrderQuantity] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    await Promise.all([fetchBookings(), fetchPricing(), fetchTanksAndEquipment()]);
  };

  const fetchPricing = async () => {
    try {
      const response = await axios.get(`${API}/pricing`);
      setPricing(response.data);
    } catch (error) {
      console.error('Failed to fetch pricing:', error);
    }
  };

  const fetchTanksAndEquipment = async () => {
    try {
      const [tanksRes, equipmentRes] = await Promise.all([
        axios.get(`${API}/fuel-tanks`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/equipment`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setTanks(tanksRes.data);
      setEquipment(equipmentRes.data);
    } catch (error) {
      console.error('Failed to fetch tanks/equipment:', error);
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

  const handleExportPDF = async (bookingId) => {
    try {
      const response = await axios.get(
        `${API}/invoices/${bookingId}/export-pdf`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `invoice_${bookingId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success('Invoice exported successfully');
    } catch (error) {
      toast.error('Failed to export invoice');
    }
  };

  const handleCreateBooking = async (e) => {
    e.preventDefault();
    try {
      // Calculate total quantity from order items
      const totalQuantity = orderItems.reduce((sum, item) => sum + parseFloat(item.quantity), 0);
      
      // Extract tank and equipment IDs from order items
      const tankIds = orderItems.filter(item => item.type === 'tank').map(item => item.id);
      const equipmentIds = orderItems.filter(item => item.type === 'equipment').map(item => item.id);
      
      const bookingData = {
        ...newBooking,
        fuel_quantity_liters: totalQuantity || parseFloat(newBooking.fuel_quantity_liters),
        multiple_locations: newBooking.multiple_locations.length > 0 ? newBooking.multiple_locations : null,
        selected_tank_ids: tankIds.length > 0 ? tankIds : null,
        selected_equipment_ids: equipmentIds.length > 0 ? equipmentIds : null
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
        selected_tank_ids: [],
        selected_equipment_ids: []
      });
      setOrderItems([]);
      fetchBookings();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create booking');
    }
  };

  const handleAddToOrder = (item, type) => {
    setCurrentOrderItem({ ...item, type });
    setOrderQuantity('');
    setShowAddToOrderDialog(true);
  };

  const handleConfirmAddToOrder = () => {
    if (!orderQuantity || parseFloat(orderQuantity) <= 0) {
      toast.error('Please enter a valid quantity');
      return;
    }

    const newItem = {
      id: currentOrderItem.id,
      type: currentOrderItem.type,
      name: currentOrderItem.name,
      identifier: currentOrderItem.identifier || currentOrderItem.unit_number,
      quantity: parseFloat(orderQuantity),
      capacity: currentOrderItem.capacity
    };

    // Check if item already in order
    const existingIndex = orderItems.findIndex(item => item.id === newItem.id && item.type === newItem.type);
    if (existingIndex >= 0) {
      // Update existing item
      const updated = [...orderItems];
      updated[existingIndex] = newItem;
      setOrderItems(updated);
    } else {
      // Add new item
      setOrderItems([...orderItems, newItem]);
    }

    setShowAddToOrderDialog(false);
    setCurrentOrderItem(null);
    setOrderQuantity('');
    toast.success('Added to order');
  };

  const handleFillToCapacity = () => {
    if (currentOrderItem && currentOrderItem.capacity) {
      setOrderQuantity(currentOrderItem.capacity.toString());
    } else {
      toast.error('No capacity information available');
    }
  };

  const handleRemoveFromOrder = (itemId, itemType) => {
    setOrderItems(orderItems.filter(item => !(item.id === itemId && item.type === itemType)));
    toast.success('Removed from order');
  };

  const handleEditOrderItem = (item) => {
    setCurrentOrderItem(item);
    setOrderQuantity(item.quantity.toString());
    setShowAddToOrderDialog(true);
  };

  const handleTankToggle = (tankId) => {
    setNewBooking(prev => {
      const isSelected = prev.selected_tank_ids.includes(tankId);
      return {
        ...prev,
        selected_tank_ids: isSelected
          ? prev.selected_tank_ids.filter(id => id !== tankId)
          : [...prev.selected_tank_ids, tankId]
      };
    });
  };

  const handleEquipmentToggle = (equipmentId) => {
    setNewBooking(prev => {
      const isSelected = prev.selected_equipment_ids.includes(equipmentId);
      return {
        ...prev,
        selected_equipment_ids: isSelected
          ? prev.selected_equipment_ids.filter(id => id !== equipmentId)
          : [...prev.selected_equipment_ids, equipmentId]
      };
    });
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
                {pricing && pricing.rack_price !== undefined && user.price_modifier !== undefined && (
                  <div className="flex items-center space-x-4 mt-1">
                    <div className="flex items-center space-x-2 text-xs">
                      <span className="text-gray-500">Daily Rack Price:</span>
                      <span className="font-semibold text-blue-600">${pricing.rack_price.toFixed(4)}/L</span>
                    </div>
                    <div className="flex items-center space-x-2 text-xs">
                      <span className="text-gray-500">Your Adjustment:</span>
                      <span className={`font-semibold ${user.price_modifier >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {user.price_modifier >= 0 ? '+' : ''}${user.price_modifier.toFixed(4)}/L
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 text-xs">
                      <span className="text-gray-500">Your Price:</span>
                      <span className="font-bold text-green-700">${(pricing.rack_price + user.price_modifier).toFixed(4)}/L</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex space-x-2">
              <Button
                onClick={() => setShowTanksEquipment(true)}
                variant="outline"
                data-testid="manage-tanks-button"
                className="flex items-center space-x-2"
              >
                <Settings className="w-4 h-4" />
                <span>Tanks & Equipment</span>
              </Button>
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
      </div>

      {/* Tanks & Equipment Dialog */}
      <Dialog open={showTanksEquipment} onOpenChange={setShowTanksEquipment}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" aria-describedby="tanks-equipment-description">
          <DialogHeader>
            <DialogTitle>Manage Tanks & Equipment</DialogTitle>
          </DialogHeader>
          <p id="tanks-equipment-description" className="sr-only">Manage your fuel tanks and equipment</p>
          <TanksAndEquipment token={token} onClose={() => setShowTanksEquipment(false)} />
        </DialogContent>
      </Dialog>

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
                    <Label>Preferred Date *</Label>
                    <Input
                      data-testid="booking-date"
                      type="date"
                      value={newBooking.preferred_date}
                      onChange={(e) => setNewBooking({ ...newBooking, preferred_date: e.target.value })}
                      required
                    />
                  </div>

                  <div className="col-span-2">
                    <Label>Preferred Time *</Label>
                    <Input
                      data-testid="booking-time"
                      type="time"
                      value={newBooking.preferred_time}
                      onChange={(e) => setNewBooking({ ...newBooking, preferred_time: e.target.value })}
                      required
                    />
                  </div>

                  {/* Tanks Section */}
                  <div className="col-span-2">
                    <div className="flex justify-between items-center mb-2">
                      <Label className="text-base font-semibold">Select Tanks to Refuel</Label>
                      {tanks.length === 0 && (
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          onClick={() => {
                            setShowNewBooking(false);
                            setShowTanksEquipment(true);
                          }}
                          className="text-blue-600"
                        >
                          + Add Tanks First
                        </Button>
                      )}
                    </div>
                    <div className="border rounded-lg p-3 bg-gray-50 max-h-60 overflow-y-auto">
                      {tanks.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">No tanks available. Add tanks first.</p>
                      ) : (
                        <div className="space-y-2">
                          {tanks.map((tank) => {
                            const inOrder = orderItems.find(item => item.id === tank.id && item.type === 'tank');
                            return (
                              <div key={tank.id} className="flex justify-between items-center bg-white p-3 rounded border">
                                <div className="flex-1">
                                  <p className="font-medium text-gray-900">{tank.name}</p>
                                  <p className="text-sm text-gray-600">ID: {tank.identifier}</p>
                                  {tank.capacity && (
                                    <p className="text-sm text-blue-600">Capacity: {tank.capacity}L</p>
                                  )}
                                  {tank.location_name && (
                                    <div className="flex items-center mt-1 text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded inline-flex">
                                      <MapPin className="w-3 h-3 mr-1" />
                                      <span className="font-medium">{tank.location_name}</span>
                                    </div>
                                  )}
                                  {tank.location_address && (
                                    <p className="text-xs text-gray-500 mt-1">📍 {tank.location_address}</p>
                                  )}
                                  {inOrder && (
                                    <p className="text-sm text-green-600 font-medium mt-1">
                                      ✓ In Order: {inOrder.quantity}L
                                    </p>
                                  )}
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => handleAddToOrder(tank, 'tank')}
                                  className={inOrder ? "bg-green-600" : "bg-blue-600"}
                                  data-testid={`add-tank-${tank.id}`}
                                >
                                  {inOrder ? 'Update' : '+ Add to Order'}
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Equipment Section */}
                  <div className="col-span-2">
                    <div className="flex justify-between items-center mb-2">
                      <Label className="text-base font-semibold">Select Equipment/Trucks to Refuel</Label>
                      {equipment.length === 0 && (
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          onClick={() => {
                            setShowNewBooking(false);
                            setShowTanksEquipment(true);
                          }}
                          className="text-blue-600"
                        >
                          + Add Equipment First
                        </Button>
                      )}
                    </div>
                    <div className="border rounded-lg p-3 bg-gray-50 max-h-60 overflow-y-auto">
                      {equipment.length === 0 ? (
                        <p className="text-sm text-gray-500 text-center py-4">No equipment available. Add equipment first.</p>
                      ) : (
                        <div className="space-y-2">
                          {equipment.map((equip) => {
                            const inOrder = orderItems.find(item => item.id === equip.id && item.type === 'equipment');
                            return (
                              <div key={equip.id} className="flex justify-between items-center bg-white p-3 rounded border">
                                <div className="flex-1">
                                  <p className="font-medium text-gray-900">{equip.name}</p>
                                  <p className="text-sm text-gray-600">Unit: {equip.unit_number} | License: {equip.license_plate}</p>
                                  {equip.capacity && (
                                    <p className="text-sm text-blue-600">Capacity: {equip.capacity}L</p>
                                  )}
                                  {inOrder && (
                                    <p className="text-sm text-green-600 font-medium mt-1">
                                      ✓ In Order: {inOrder.quantity}L
                                    </p>
                                  )}
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => handleAddToOrder(equip, 'equipment')}
                                  className={inOrder ? "bg-green-600" : "bg-blue-600"}
                                  data-testid={`add-equipment-${equip.id}`}
                                >
                                  {inOrder ? 'Update' : '+ Add to Order'}
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Order Summary */}
                  {orderItems.length > 0 && (
                    <div className="col-span-2 bg-green-50 border-2 border-green-300 rounded-lg p-4">
                      <div className="flex justify-between items-center mb-3">
                        <h4 className="font-bold text-green-900">Order Summary</h4>
                        <p className="text-lg font-bold text-green-700">
                          Total: {orderItems.reduce((sum, item) => sum + item.quantity, 0).toFixed(2)}L
                        </p>
                      </div>
                      <div className="space-y-2">
                        {orderItems.map((item, idx) => (
                          <div key={`${item.type}-${item.id}-${idx}`} className="flex justify-between items-center bg-white p-2 rounded">
                            <div className="flex-1">
                              <p className="font-medium text-sm">
                                {item.type === 'tank' ? '🛢️' : '🚚'} {item.name}
                              </p>
                              <p className="text-xs text-gray-600">{item.identifier}</p>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className="font-bold text-green-700">{item.quantity}L</span>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEditOrderItem(item)}
                                className="h-7 px-2"
                              >
                                Edit
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => handleRemoveFromOrder(item.id, item.type)}
                                className="h-7 px-2 text-red-600 hover:text-red-700"
                              >
                                ×
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

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

                <div className="flex justify-end space-x-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => {
                    setShowNewBooking(false);
                    setOrderItems([]);
                  }}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    data-testid="create-booking-submit"
                    className="bg-gradient-to-r from-blue-600 to-green-600"
                    disabled={orderItems.length === 0}
                  >
                    Create Booking ({orderItems.length} item{orderItems.length !== 1 ? 's' : ''})
                  </Button>
                </div>
              </form>

              {/* Add to Order Dialog */}
              <Dialog open={showAddToOrderDialog} onOpenChange={setShowAddToOrderDialog}>
                <DialogContent aria-describedby="add-to-order-description">
                  <DialogHeader>
                    <DialogTitle>Add to Order</DialogTitle>
                  </DialogHeader>
                  <p id="add-to-order-description" className="sr-only">Specify the quantity of fuel for this tank or equipment</p>
                  {currentOrderItem && (
                    <div className="space-y-4">
                      <div className="bg-blue-50 p-3 rounded">
                        <p className="font-bold text-lg">{currentOrderItem.name}</p>
                        <p className="text-sm text-gray-600">
                          {currentOrderItem.identifier || currentOrderItem.unit_number}
                        </p>
                        {currentOrderItem.capacity && (
                          <p className="text-sm text-blue-700 font-medium mt-1">
                            Max Capacity: {currentOrderItem.capacity}L
                          </p>
                        )}
                      </div>
                      
                      <div>
                        <Label>Fuel Quantity (Liters) *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={orderQuantity}
                          onChange={(e) => setOrderQuantity(e.target.value)}
                          placeholder="Enter liters"
                          data-testid="order-quantity-input"
                          autoFocus
                        />
                      </div>

                      {currentOrderItem.capacity && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={handleFillToCapacity}
                          className="w-full border-green-500 text-green-700 hover:bg-green-50"
                          data-testid="fill-to-capacity-button"
                        >
                          <Fuel className="w-4 h-4 mr-2" />
                          Fill to Full Capacity ({currentOrderItem.capacity}L)
                        </Button>
                      )}

                      <div className="flex justify-end space-x-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowAddToOrderDialog(false);
                            setCurrentOrderItem(null);
                            setOrderQuantity('');
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          onClick={handleConfirmAddToOrder}
                          className="bg-gradient-to-r from-blue-600 to-green-600"
                          data-testid="confirm-add-to-order"
                        >
                          {orderItems.find(item => item.id === currentOrderItem.id && item.type === currentOrderItem.type) ? 'Update Order' : 'Add to Order'}
                        </Button>
                      </div>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
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

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <Calendar className="w-4 h-4 mr-2 text-blue-600" />
                    {booking.preferred_date}
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Clock className="w-4 h-4 mr-2 text-blue-600" />
                    {booking.preferred_time}
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <FileText className="w-4 h-4 mr-2 text-blue-600" />
                    {logs[booking.id]?.length || 0} Log(s)
                  </div>
                </div>

                {/* Tank and Equipment Info */}
                {((booking.selected_tanks && booking.selected_tanks.length > 0) || 
                  (booking.selected_equipment && booking.selected_equipment.length > 0) ||
                  booking.tank_name || booking.equipment_name) && (
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                      {/* Display multiple tanks if available */}
                      {booking.selected_tanks && booking.selected_tanks.length > 0 ? (
                        <div>
                          <span className="text-gray-600 font-medium">Tanks:</span>
                          <div className="mt-1 space-y-1">
                            {booking.selected_tanks.map((tank, idx) => (
                              <div key={idx} className="text-gray-900 bg-blue-50 px-2 py-1 rounded">
                                {tank.name} ({tank.identifier})
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : booking.tank_name && (
                        <div>
                          <span className="text-gray-600">Tank:</span>
                          <span className="font-medium text-gray-900 ml-2">{booking.tank_name}</span>
                        </div>
                      )}
                      
                      {/* Display multiple equipment if available */}
                      {booking.selected_equipment && booking.selected_equipment.length > 0 ? (
                        <div>
                          <span className="text-gray-600 font-medium">Equipment:</span>
                          <div className="mt-1 space-y-1">
                            {booking.selected_equipment.map((equip, idx) => (
                              <div key={idx} className="text-gray-900 bg-green-50 px-2 py-1 rounded">
                                {equip.name} ({equip.unit_number})
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : booking.equipment_name && (
                        <div>
                          <span className="text-gray-600">Equipment:</span>
                          <span className="font-medium text-gray-900 ml-2">{booking.equipment_name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Invoice Details for Delivered Orders */}
                {booking.status === 'delivered' && (booking.ordered_amount || booking.dispensed_amount) && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="font-semibold text-green-900">Delivery Completed</h4>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleExportPDF(booking.id)}
                        data-testid={`customer-export-pdf-${booking.id}`}
                        className="border-green-600 text-green-700 hover:bg-green-100"
                      >
                        <FileText className="w-4 h-4 mr-1" />
                        Export Invoice PDF
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-700">Ordered Amount:</span>
                        <span className="font-bold text-green-900 ml-2">{booking.ordered_amount}L</span>
                      </div>
                      <div>
                        <span className="text-gray-700">Dispensed Amount:</span>
                        <span className="font-bold text-green-900 ml-2">{booking.dispensed_amount}L</span>
                      </div>
                      {booking.ordered_amount !== booking.dispensed_amount && (
                        <div className="col-span-2">
                          <span className="text-gray-700">Difference:</span>
                          <span className={`font-bold ml-2 ${booking.dispensed_amount > booking.ordered_amount ? 'text-blue-600' : 'text-orange-600'}`}>
                            {booking.dispensed_amount > booking.ordered_amount ? '+' : ''}
                            {(booking.dispensed_amount - booking.ordered_amount).toFixed(2)}L
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

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
                          
                          {/* Price with Carbon Taxes */}
                          <div className="flex justify-between pt-1 mt-1 border-t border-blue-200">
                            <span className="font-semibold">Fuel + Carbon Taxes:</span>
                            <span className="font-bold text-blue-900">
                              ${(booking.fuel_price_per_liter + booking.federal_carbon_tax + booking.quebec_carbon_tax).toFixed(4)}/L
                            </span>
                          </div>
                          
                          {/* Final Price per Liter (with all taxes) */}
                          <div className="flex justify-between pt-1 mt-1 border-t border-blue-300 bg-blue-100 -mx-3 px-3 py-2 rounded">
                            <span className="font-bold">Final Price per Liter (incl. all taxes):</span>
                            <span className="font-bold text-blue-950">
                              ${(() => {
                                const fuelWithCarbon = booking.fuel_price_per_liter + booking.federal_carbon_tax + booking.quebec_carbon_tax;
                                const withGST = fuelWithCarbon * (1 + booking.gst_rate);
                                const withQST = withGST * (1 + booking.qst_rate);
                                return withQST.toFixed(4);
                              })()}/L
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Line Items */}
                    <div className="space-y-2">
                      {/* Use dispensed amount if available, otherwise use fuel_quantity_liters */}
                      {(() => {
                        const quantityForPrice = booking.dispensed_amount || booking.fuel_quantity_liters;
                        const quantityLabel = booking.dispensed_amount ? `${quantityForPrice}L (Dispensed)` : `${quantityForPrice}L`;
                        
                        return (
                          <>
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-700">
                                <span className="font-medium">Fuel Price:</span> ${booking.fuel_price_per_liter.toFixed(4)}/L × {quantityLabel}
                              </span>
                              <span className="font-semibold text-gray-900">${(quantityForPrice * booking.fuel_price_per_liter).toFixed(2)}</span>
                            </div>

                            <div className="flex justify-between text-sm">
                              <span className="text-gray-700">
                                <span className="font-medium">Federal Carbon Tax:</span> ${booking.federal_carbon_tax.toFixed(4)}/L × {quantityLabel}
                              </span>
                              <span className="font-semibold text-gray-900">${(quantityForPrice * booking.federal_carbon_tax).toFixed(2)}</span>
                            </div>

                            <div className="flex justify-between text-sm">
                              <span className="text-gray-700">
                                <span className="font-medium">Quebec Carbon Tax:</span> ${booking.quebec_carbon_tax.toFixed(4)}/L × {quantityLabel}
                              </span>
                              <span className="font-semibold text-gray-900">${(quantityForPrice * booking.quebec_carbon_tax).toFixed(2)}</span>
                            </div>
                          </>
                        );
                      })()}

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