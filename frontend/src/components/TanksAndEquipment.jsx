import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Edit, Trash2, Fuel as FuelIcon, Truck } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function TanksAndEquipment({ token, onClose }) {
  const [tanks, setTanks] = useState([]);
  const [equipment, setEquipment] = useState([]);
  const [showTankDialog, setShowTankDialog] = useState(false);
  const [showEquipmentDialog, setShowEquipmentDialog] = useState(false);
  const [editingTank, setEditingTank] = useState(null);
  const [editingEquipment, setEditingEquipment] = useState(null);
  const [tankForm, setTankForm] = useState({ name: '', identifier: '', capacity: '' });
  const [equipmentForm, setEquipmentForm] = useState({ name: '', unit_number: '', license_plate: '', capacity: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [tanksRes, equipmentRes] = await Promise.all([
        axios.get(`${API}/fuel-tanks`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API}/equipment`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      setTanks(tanksRes.data);
      setEquipment(equipmentRes.data);
    } catch (error) {
      toast.error('Failed to fetch data');
    }
  };

  // Tank Management
  const handleSaveTank = async (e) => {
    e.preventDefault();
    try {
      const data = {
        name: tankForm.name,
        identifier: tankForm.identifier,
        capacity: tankForm.capacity ? parseFloat(tankForm.capacity) : null
      };

      if (editingTank) {
        await axios.put(`${API}/fuel-tanks/${editingTank.id}`, data, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Tank updated successfully');
      } else {
        await axios.post(`${API}/fuel-tanks`, data, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Tank added successfully');
      }

      setShowTankDialog(false);
      setEditingTank(null);
      setTankForm({ name: '', identifier: '', capacity: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save tank');
    }
  };

  const handleEditTank = (tank) => {
    setEditingTank(tank);
    setTankForm({
      name: tank.name,
      identifier: tank.identifier,
      capacity: tank.capacity || ''
    });
    setShowTankDialog(true);
  };

  const handleDeleteTank = async (tankId) => {
    if (!confirm('Are you sure you want to delete this tank?')) return;

    try {
      await axios.delete(`${API}/fuel-tanks/${tankId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Tank deleted successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete tank');
    }
  };

  // Equipment Management
  const handleSaveEquipment = async (e) => {
    e.preventDefault();
    try {
      const data = {
        name: equipmentForm.name,
        unit_number: equipmentForm.unit_number,
        license_plate: equipmentForm.license_plate,
        capacity: equipmentForm.capacity ? parseFloat(equipmentForm.capacity) : null
      };

      if (editingEquipment) {
        await axios.put(`${API}/equipment/${editingEquipment.id}`, data, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Equipment updated successfully');
      } else {
        await axios.post(`${API}/equipment`, data, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Equipment added successfully');
      }

      setShowEquipmentDialog(false);
      setEditingEquipment(null);
      setEquipmentForm({ name: '', unit_number: '', license_plate: '', capacity: '' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save equipment');
    }
  };

  const handleEditEquipment = (equip) => {
    setEditingEquipment(equip);
    setEquipmentForm({
      name: equip.name,
      unit_number: equip.unit_number,
      license_plate: equip.license_plate
    });
    setShowEquipmentDialog(true);
  };

  const handleDeleteEquipment = async (equipmentId) => {
    if (!confirm('Are you sure you want to delete this equipment?')) return;

    try {
      await axios.delete(`${API}/equipment/${equipmentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Equipment deleted successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete equipment');
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="tanks">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="tanks" data-testid="tanks-tab">Fuel Tanks</TabsTrigger>
          <TabsTrigger value="equipment" data-testid="equipment-tab">Equipment/Trucks</TabsTrigger>
        </TabsList>

        {/* Fuel Tanks Tab */}
        <TabsContent value="tanks">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Your Fuel Tanks</h3>
              <Button
                onClick={() => {
                  setEditingTank(null);
                  setTankForm({ name: '', identifier: '', capacity: '' });
                  setShowTankDialog(true);
                }}
                data-testid="add-tank-button"
                className="bg-gradient-to-r from-blue-600 to-green-600"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Tank
              </Button>
            </div>

            {tanks.length === 0 ? (
              <Card className="p-8 text-center">
                <FuelIcon className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                <p className="text-gray-600">No fuel tanks added yet</p>
              </Card>
            ) : (
              <div className="grid gap-4">
                {tanks.map((tank) => (
                  <Card key={tank.id} className="p-4" data-testid={`tank-${tank.id}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-lg">{tank.name}</h4>
                        <p className="text-sm text-gray-600">ID: {tank.identifier}</p>
                        {tank.capacity && (
                          <p className="text-sm text-gray-600">Capacity: {tank.capacity}L</p>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditTank(tank)}
                          data-testid={`edit-tank-${tank.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteTank(tank.id)}
                          data-testid={`delete-tank-${tank.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
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
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Your Equipment/Trucks</h3>
              <Button
                onClick={() => {
                  setEditingEquipment(null);
                  setEquipmentForm({ name: '', unit_number: '', license_plate: '' });
                  setShowEquipmentDialog(true);
                }}
                data-testid="add-equipment-button"
                className="bg-gradient-to-r from-blue-600 to-green-600"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Equipment
              </Button>
            </div>

            {equipment.length === 0 ? (
              <Card className="p-8 text-center">
                <Truck className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                <p className="text-gray-600">No equipment added yet</p>
              </Card>
            ) : (
              <div className="grid gap-4">
                {equipment.map((equip) => (
                  <Card key={equip.id} className="p-4" data-testid={`equipment-${equip.id}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-bold text-lg">{equip.name}</h4>
                        <p className="text-sm text-gray-600">Unit #: {equip.unit_number}</p>
                        <p className="text-sm text-gray-600">License: {equip.license_plate}</p>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditEquipment(equip)}
                          data-testid={`edit-equipment-${equip.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteEquipment(equip.id)}
                          data-testid={`delete-equipment-${equip.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-red-600" />
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

      {/* Tank Dialog */}
      <Dialog open={showTankDialog} onOpenChange={setShowTankDialog}>
        <DialogContent aria-describedby="tank-dialog-description">
          <DialogHeader>
            <DialogTitle>{editingTank ? 'Edit Tank' : 'Add Fuel Tank'}</DialogTitle>
          </DialogHeader>
          <p id="tank-dialog-description" className="sr-only">Add or edit fuel tank information</p>
          <form onSubmit={handleSaveTank} className="space-y-4 mt-4">
            <div>
              <Label>Tank Name *</Label>
              <Input
                value={tankForm.name}
                onChange={(e) => setTankForm({ ...tankForm, name: e.target.value })}
                placeholder="e.g., Main Storage Tank"
                data-testid="tank-name"
                required
              />
            </div>
            <div>
              <Label>Identifier/Serial Number *</Label>
              <Input
                value={tankForm.identifier}
                onChange={(e) => setTankForm({ ...tankForm, identifier: e.target.value })}
                placeholder="e.g., TANK-001"
                data-testid="tank-identifier"
                required
              />
            </div>
            <div>
              <Label>Capacity (Liters)</Label>
              <Input
                type="number"
                step="0.01"
                value={tankForm.capacity}
                onChange={(e) => setTankForm({ ...tankForm, capacity: e.target.value })}
                placeholder="e.g., 10000"
                data-testid="tank-capacity"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setShowTankDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" data-testid="save-tank">
                {editingTank ? 'Update' : 'Add'} Tank
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Equipment Dialog */}
      <Dialog open={showEquipmentDialog} onOpenChange={setShowEquipmentDialog}>
        <DialogContent aria-describedby="equipment-dialog-description">
          <DialogHeader>
            <DialogTitle>{editingEquipment ? 'Edit Equipment' : 'Add Equipment/Truck'}</DialogTitle>
          </DialogHeader>
          <p id="equipment-dialog-description" className="sr-only">Add or edit equipment information</p>
          <form onSubmit={handleSaveEquipment} className="space-y-4 mt-4">
            <div>
              <Label>Equipment Name *</Label>
              <Input
                value={equipmentForm.name}
                onChange={(e) => setEquipmentForm({ ...equipmentForm, name: e.target.value })}
                placeholder="e.g., Delivery Truck"
                data-testid="equipment-name"
                required
              />
            </div>
            <div>
              <Label>Unit Number *</Label>
              <Input
                value={equipmentForm.unit_number}
                onChange={(e) => setEquipmentForm({ ...equipmentForm, unit_number: e.target.value })}
                placeholder="e.g., UNIT-123"
                data-testid="equipment-unit-number"
                required
              />
            </div>
            <div>
              <Label>License Plate *</Label>
              <Input
                value={equipmentForm.license_plate}
                onChange={(e) => setEquipmentForm({ ...equipmentForm, license_plate: e.target.value })}
                placeholder="e.g., ABC-1234"
                data-testid="equipment-license-plate"
                required
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => setShowEquipmentDialog(false)}>
                Cancel
              </Button>
              <Button type="submit" data-testid="save-equipment">
                {editingEquipment ? 'Update' : 'Add'} Equipment
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
