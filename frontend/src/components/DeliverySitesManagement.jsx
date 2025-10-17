import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MapPin, Plus, Edit2, Trash2 } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function DeliverySitesManagement({ token, onSitesUpdate }) {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingSite, setEditingSite] = useState(null);
  const [siteForm, setSiteForm] = useState({
    name: '',
    address: ''
  });

  useEffect(() => {
    fetchSites();
  }, []);

  const fetchSites = async () => {
    try {
      const response = await axios.get(`${API}/delivery-sites`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSites(response.data || []);
      if (onSitesUpdate) onSitesUpdate(response.data || []);
    } catch (error) {
      console.error('Failed to fetch delivery sites:', error);
      toast.error('Failed to load delivery sites');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingSite) {
        await axios.put(
          `${API}/delivery-sites/${editingSite.id}`,
          siteForm,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Delivery site updated');
      } else {
        await axios.post(
          `${API}/delivery-sites`,
          siteForm,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        toast.success('Delivery site added');
      }
      
      setShowDialog(false);
      resetForm();
      fetchSites();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save delivery site');
    }
  };

  const handleDelete = async (siteId) => {
    if (!window.confirm('Are you sure you want to delete this delivery site?')) return;
    
    try {
      await axios.delete(`${API}/delivery-sites/${siteId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Delivery site deleted');
      fetchSites();
    } catch (error) {
      toast.error('Failed to delete delivery site');
    }
  };

  const openEditDialog = (site) => {
    setEditingSite(site);
    setSiteForm({
      name: site.name,
      address: site.address
    });
    setShowDialog(true);
  };

  const resetForm = () => {
    setEditingSite(null);
    setSiteForm({ name: '', address: '' });
  };

  if (loading) {
    return <div className="text-center py-4">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold">Delivery Sites</h3>
          <p className="text-sm text-gray-600">Manage your saved delivery addresses</p>
        </div>
        <Button
          onClick={() => {
            resetForm();
            setShowDialog(true);
          }}
          className="bg-gradient-to-r from-blue-600 to-green-600"
          data-testid="add-site-button"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Site
        </Button>
      </div>

      {sites.length === 0 ? (
        <Card className="p-8 text-center">
          <MapPin className="w-12 h-12 mx-auto text-gray-400 mb-3" />
          <p className="text-gray-600">No delivery sites yet</p>
          <p className="text-sm text-gray-500 mt-1">Add locations where your tanks and equipment are located</p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {sites.map((site) => (
            <Card key={site.id} className="p-4" data-testid={`site-${site.id}`}>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4 text-blue-600" />
                    <h4 className="font-bold text-lg">{site.name}</h4>
                  </div>
                  <p className="text-sm text-gray-600 mt-1 ml-6">{site.address}</p>
                </div>
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openEditDialog(site)}
                    data-testid={`edit-site-${site.id}`}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(site.id)}
                    data-testid={`delete-site-${site.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={(open) => {
        setShowDialog(open);
        if (!open) resetForm();
      }}>
        <DialogContent aria-describedby="site-dialog-description">
          <DialogHeader>
            <DialogTitle>{editingSite ? 'Edit Delivery Site' : 'Add Delivery Site'}</DialogTitle>
          </DialogHeader>
          <p id="site-dialog-description" className="sr-only">
            {editingSite ? 'Edit delivery site information' : 'Add a new delivery site'}
          </p>
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div>
              <Label>Site Name *</Label>
              <Input
                value={siteForm.name}
                onChange={(e) => setSiteForm({ ...siteForm, name: e.target.value })}
                placeholder="e.g., Main Facility, East Warehouse"
                data-testid="site-name-input"
                required
              />
            </div>
            <div>
              <Label>Full Address *</Label>
              <Input
                value={siteForm.address}
                onChange={(e) => setSiteForm({ ...siteForm, address: e.target.value })}
                placeholder="123 Main St, Montreal, QC H1A 1A1"
                data-testid="site-address-input"
                required
              />
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowDialog(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-gradient-to-r from-blue-600 to-green-600"
                data-testid="save-site-button"
              >
                {editingSite ? 'Update' : 'Add'} Site
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
