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
import { Plus, Edit2, Trash2, Fuel, Truck } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function AdminResourcesManagement({ token }) {
  const [tanks, setTanks] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCustomer, setFilterCustomer] = useState('all');
  
  // Tank state
  const [showTankDialog, setShowTankDialog] = useState(false);
  const [editingTank, setEditingTank] = useState(null);
  const [tankForm, setTankForm] = useState({
    user_id: '',
    name: '',
    identifier: '',
    capacity: ''
  });
  
  // Equipment state
  const [showEquipmentDialog, setShowEquipmentDialog] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState(null);
  const [equipmentForm, setEquipmentForm] = useState({
    user_id: '',
    name: '',
    unit_number: '',
    license_plate: '',
    capacity: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [tanksRes, equipmentRes, customersRes] = await Promise.all([
        axios.get(`${API}/admin/fuel-tanks`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/admin/equipment`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/customers`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setTanks(tanksRes.data);
      setEquipment(equipmentRes.data);
      setCustomers(customersRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to fetch resources');
    } finally {
      setLoading(false);
    }
  };

  // Tank CRUD operations
  const handleTankSubmit = async (e) => {
    e.preventDefault();
    try {
      const tankData = {
        name: tankForm.name,
        identifier: tankForm.identifier,
        capacity: tankForm.capacity ? parseFloat(tankForm.capacity) : null
      };

      if (editingTank) {
        await axios.put(
          `${API}/admin/fuel-tanks/${editingTank.id}`,
          tankData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Tank updated successfully');
      } else {
        await axios.post(
          `${API}/admin/fuel-tanks`,
          { ...tankData, user_id: tankForm.user_id },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Tank created successfully');
      }

      setShowTankDialog(false);
      resetTankForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save tank');
    }
  };

  const handleDeleteTank = async (tankId) => {
    if (!window.confirm('Are you sure you want to delete this tank?')) return;
    
    try {
      await axios.delete(`${API}/admin/fuel-tanks/${tankId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Tank deleted successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete tank');
    }
  };

  const openEditTank = (tank) => {
    setEditingTank(tank);
    setTankForm({
      user_id: tank.user_id,
      name: tank.name,
      identifier: tank.identifier,
      capacity: tank.capacity || ''
    });
    setShowTankDialog(true);
  };

  const resetTankForm = () => {
    setEditingTank(null);
    setTankForm({
      user_id: '',
      name: '',
      identifier: '',
      capacity: ''
    });
  };

  // Equipment CRUD operations
  const handleEquipmentSubmit = async (e) => {
    e.preventDefault();
    try {
      const equipData = {
        name: equipmentForm.name,
        unit_number: equipmentForm.unit_number,
        license_plate: equipmentForm.license_plate,
        capacity: equipmentForm.capacity ? parseFloat(equipmentForm.capacity) : null
      };

      if (editingEquipment) {
        await axios.put(
          `${API}/admin/equipment/${editingEquipment.id}`,
          equipData,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Equipment updated successfully');
      } else {
        await axios.post(
          `${API}/admin/equipment`,
          { ...equipData, user_id: equipmentForm.user_id },
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Equipment created successfully');
      }

      setShowEquipmentDialog(false);
      resetEquipmentForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save equipment');
    }
  };

  const handleDeleteEquipment = async (equipId) => {
    if (!window.confirm('Are you sure you want to delete this equipment?')) return;
    
    try {
      await axios.delete(`${API}/admin/equipment/${equipId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Equipment deleted successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete equipment');
    }
  };

  const openEditEquipment = (equip) => {
    setEditingEquipment(equip);
    setEquipmentForm({
      user_id: equip.user_id,
      name: equip.name,
      unit_number: equip.unit_number,
      license_plate: equip.license_plate,
      capacity: equip.capacity || ''
    });
    setShowEquipmentDialog(true);
  };

  const resetEquipmentForm = () => {
    setEditingEquipment(null);
    setEquipmentForm({
      user_id: '',
      name: '',
      unit_number: '',
      license_plate: '',
      capacity: ''
    });
  };

  const getCustomerName = (userId) => {
    const customer = customers.find(c => c.id === userId);
    return customer ? customer.name : 'Unknown';
  };

  const filteredTanks = filterCustomer === 'all' 
    ? tanks 
    : tanks.filter(t => t.user_id === filterCustomer);

  const filteredEquipment = filterCustomer === 'all' 
    ? equipment 
    : equipment.filter(e => e.user_id === filterCustomer);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold">Customer Resources Management</h3>
        <div className="flex items-center space-x-2">
          <Label className="text-sm">Filter by Customer:</Label>
          <Select value={filterCustomer} onValueChange={setFilterCustomer}>
            <SelectTrigger className="w-48" data-testid="filter-customer">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Customers</SelectItem>
              {customers.map((customer) => (
                <SelectItem key={customer.id} value={customer.id}>
                  {customer.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Tabs defaultValue="tanks">
        <TabsList>
          <TabsTrigger value="tanks" data-testid="admin-tanks-tab">Fuel Tanks</TabsTrigger>
          <TabsTrigger value="equipment" data-testid="admin-equipment-tab">Equipment/Trucks</TabsTrigger>
        </TabsList>

        {/* Tanks Tab */}
        <TabsContent value="tanks">
          <div className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={showTankDialog} onOpenChange={(open) => {
                setShowTankDialog(open);
                if (!open) resetTankForm();
              }}>
                <DialogTrigger asChild>
                  <Button
                    data-testid="add-tank-button"
                    className="bg-gradient-to-r from-blue-600 to-green-600"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Tank
                  </Button>
                </DialogTrigger>
                <DialogContent aria-describedby="tank-dialog-description">
                  <DialogHeader>
                    <DialogTitle>{editingTank ? 'Edit Tank' : 'Add New Tank'}</DialogTitle>
                  </DialogHeader>
                  <p id="tank-dialog-description" className="sr-only">
                    {editingTank ? 'Edit fuel tank details' : 'Create a new fuel tank for a customer'}
                  </p>
                  <form onSubmit={handleTankSubmit} className="space-y-4 mt-4">
                    {!editingTank && (
                      <div>
                        <Label>Customer *</Label>
                        <Select
                          value={tankForm.user_id}
                          onValueChange={(value) => setTankForm({ ...tankForm, user_id: value })}
                          required
                        >
                          <SelectTrigger data-testid="tank-customer-select">
                            <SelectValue placeholder="Select customer" />
                          </SelectTrigger>
                          <SelectContent>
                            {customers.map((customer) => (
                              <SelectItem key={customer.id} value={customer.id}>
                                {customer.name} ({customer.email})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div>
                      <Label>Tank Name *</Label>
                      <Input
                        data-testid="tank-name-input"
                        value={tankForm.name}
                        onChange={(e) => setTankForm({ ...tankForm, name: e.target.value })}
                        placeholder="Main Tank"
                        required
                      />
                    </div>
                    <div>
                      <Label>Identifier *</Label>
                      <Input
                        data-testid="tank-identifier-input"
                        value={tankForm.identifier}
                        onChange={(e) => setTankForm({ ...tankForm, identifier: e.target.value })}
                        placeholder="TANK-001"
                        required
                      />
                    </div>
                    <div>
                      <Label>Maximum Capacity (Liters)</Label>
                      <Input
                        data-testid="tank-capacity-input"
                        type="number"
                        step="0.01"
                        value={tankForm.capacity}
                        onChange={(e) => setTankForm({ ...tankForm, capacity: e.target.value })}
                        placeholder="10000"
                      />
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button type="button" variant="outline" onClick={() => {
                        setShowTankDialog(false);
                        resetTankForm();
                      }}>
                        Cancel
                      </Button>
                      <Button type="submit" data-testid="save-tank-button">
                        {editingTank ? 'Update' : 'Create'} Tank
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {filteredTanks.length === 0 ? (
              <Card className="p-8 text-center">
                <Fuel className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                <p className="text-gray-600">No tanks found</p>
              </Card>
            ) : (
              <div className="grid gap-3">
                {filteredTanks.map((tank) => (
                  <Card key={tank.id} className="p-4" data-testid={`admin-tank-${tank.id}`}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-bold text-lg">{tank.name}</h4>
                        <p className="text-sm text-gray-600">Identifier: {tank.identifier}</p>
                        {tank.capacity && (
                          <p className="text-sm text-gray-600">Capacity: {tank.capacity}L</p>
                        )}
                        <p className="text-sm text-blue-600 mt-1">
                          Customer: {getCustomerName(tank.user_id)}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditTank(tank)}
                          data-testid={`edit-tank-${tank.id}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteTank(tank.id)}
                          data-testid={`delete-tank-${tank.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Equipment Tab */}
        <TabsContent value="equipment">
          <div className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={showEquipmentDialog} onOpenChange={(open) => {
                setShowEquipmentDialog(open);
                if (!open) resetEquipmentForm();
              }}>
                <DialogTrigger asChild>
                  <Button
                    data-testid="add-equipment-button"
                    className="bg-gradient-to-r from-blue-600 to-green-600"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Equipment
                  </Button>
                </DialogTrigger>
                <DialogContent aria-describedby="equipment-dialog-description">
                  <DialogHeader>
                    <DialogTitle>{editingEquipment ? 'Edit Equipment' : 'Add New Equipment'}</DialogTitle>
                  </DialogHeader>
                  <p id="equipment-dialog-description" className="sr-only">
                    {editingEquipment ? 'Edit equipment/truck details' : 'Create new equipment/truck for a customer'}
                  </p>
                  <form onSubmit={handleEquipmentSubmit} className="space-y-4 mt-4">
                    {!editingEquipment && (
                      <div>
                        <Label>Customer *</Label>
                        <Select
                          value={equipmentForm.user_id}
                          onValueChange={(value) => setEquipmentForm({ ...equipmentForm, user_id: value })}
                          required
                        >
                          <SelectTrigger data-testid="equipment-customer-select">
                            <SelectValue placeholder="Select customer" />
                          </SelectTrigger>
                          <SelectContent>
                            {customers.map((customer) => (
                              <SelectItem key={customer.id} value={customer.id}>
                                {customer.name} ({customer.email})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div>
                      <Label>Equipment Name *</Label>
                      <Input
                        data-testid="equipment-name-input"
                        value={equipmentForm.name}
                        onChange={(e) => setEquipmentForm({ ...equipmentForm, name: e.target.value })}
                        placeholder="Delivery Truck 1"
                        required
                      />
                    </div>
                    <div>
                      <Label>Unit Number *</Label>
                      <Input
                        data-testid="equipment-unit-input"
                        value={equipmentForm.unit_number}
                        onChange={(e) => setEquipmentForm({ ...equipmentForm, unit_number: e.target.value })}
                        placeholder="UNIT-001"
                        required
                      />
                    </div>
                    <div>
                      <Label>License Plate *</Label>
                      <Input
                        data-testid="equipment-license-input"
                        value={equipmentForm.license_plate}
                        onChange={(e) => setEquipmentForm({ ...equipmentForm, license_plate: e.target.value })}
                        placeholder="ABC-1234"
                        required
                      />
                    </div>
                    <div>
                      <Label>Maximum Capacity (Liters)</Label>
                      <Input
                        data-testid="equipment-capacity-input"
                        type="number"
                        step="0.01"
                        value={equipmentForm.capacity}
                        onChange={(e) => setEquipmentForm({ ...equipmentForm, capacity: e.target.value })}
                        placeholder="5000"
                      />
                    </div>
                    <div className="flex justify-end space-x-2">
                      <Button type="button" variant="outline" onClick={() => {
                        setShowEquipmentDialog(false);
                        resetEquipmentForm();
                      }}>
                        Cancel
                      </Button>
                      <Button type="submit" data-testid="save-equipment-button">
                        {editingEquipment ? 'Update' : 'Create'} Equipment
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {filteredEquipment.length === 0 ? (
              <Card className="p-8 text-center">
                <Truck className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                <p className="text-gray-600">No equipment found</p>
              </Card>
            ) : (
              <div className="grid gap-3">
                {filteredEquipment.map((equip) => (
                  <Card key={equip.id} className="p-4" data-testid={`admin-equipment-${equip.id}`}>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-bold text-lg">{equip.name}</h4>
                        <p className="text-sm text-gray-600">Unit: {equip.unit_number}</p>
                        <p className="text-sm text-gray-600">License: {equip.license_plate}</p>
                        {equip.capacity && (
                          <p className="text-sm text-gray-600">Capacity: {equip.capacity}L</p>
                        )}
                        <p className="text-sm text-green-600 mt-1">
                          Customer: {getCustomerName(equip.user_id)}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openEditEquipment(equip)}
                          data-testid={`edit-equipment-${equip.id}`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteEquipment(equip.id)}
                          data-testid={`delete-equipment-${equip.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
