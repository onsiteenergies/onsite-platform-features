import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Download, Upload, X, FileText, Image as ImageIcon } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function InvoiceManagement({ booking, token, onUpdate }) {
  const [showInvoiceDialog, setShowInvoiceDialog] = useState(false);
  const [invoiceData, setInvoiceData] = useState({
    ordered_amount: booking.ordered_amount || booking.fuel_quantity_liters,
    dispensed_amount: booking.dispensed_amount || booking.fuel_quantity_liters
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const [images, setImages] = useState(booking.invoice_images || []);

  const handleUpdateInvoice = async (e) => {
    e.preventDefault();
    try {
      await axios.put(
        `${API}/invoices/${booking.id}`,
        invoiceData,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Invoice updated successfully');
      onUpdate();
      setShowInvoiceDialog(false);
    } catch (error) {
      toast.error('Failed to update invoice');
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (images.length >= 5) {
      toast.error('Maximum 5 images allowed');
      return;
    }

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      await axios.post(
        `${API}/invoices/${booking.id}/upload-image`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      toast.success('Image uploaded successfully');
      onUpdate();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDeleteImage = async (imageFilename) => {
    try {
      await axios.delete(
        `${API}/invoices/${booking.id}/images/${imageFilename}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Image deleted');
      setImages(images.filter(img => img !== imageFilename));
      onUpdate();
    } catch (error) {
      toast.error('Failed to delete image');
    }
  };

  const handleExportPDF = async () => {
    try {
      const response = await axios.get(
        `${API}/invoices/${booking.id}/export-pdf`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `invoice_${booking.id}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success('Invoice exported successfully');
    } catch (error) {
      toast.error('Failed to export invoice');
    }
  };

  return (
    <>
      <div className="flex space-x-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowInvoiceDialog(true)}
          data-testid={`edit-invoice-${booking.id}`}
        >
          <FileText className="w-4 h-4 mr-1" />
          Edit Invoice
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={handleExportPDF}
          data-testid={`export-pdf-${booking.id}`}
        >
          <Download className="w-4 h-4 mr-1" />
          Export PDF
        </Button>
      </div>

      <Dialog open={showInvoiceDialog} onOpenChange={setShowInvoiceDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" aria-describedby="invoice-dialog-description">
          <DialogHeader>
            <DialogTitle>Manage Invoice - {booking.user_name}</DialogTitle>
          </DialogHeader>
          <p id="invoice-dialog-description" className="sr-only">Edit invoice details and manage images</p>

          <div className="space-y-6 mt-4">
            {/* Invoice Details */}
            <div className="border-b pb-4">
              <h3 className="font-semibold mb-3">Invoice Details</h3>
              <form onSubmit={handleUpdateInvoice} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Ordered Amount (L)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={invoiceData.ordered_amount}
                      onChange={(e) => setInvoiceData({ ...invoiceData, ordered_amount: parseFloat(e.target.value) })}
                      data-testid="ordered-amount"
                      required
                    />
                  </div>
                  <div>
                    <Label>Dispensed Amount (L)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={invoiceData.dispensed_amount}
                      onChange={(e) => setInvoiceData({ ...invoiceData, dispensed_amount: parseFloat(e.target.value) })}
                      data-testid="dispensed-amount"
                      required
                    />
                  </div>
                </div>
                <Button type="submit" data-testid="update-invoice-submit">
                  Update Invoice Details
                </Button>
              </form>
            </div>

            {/* Image Management */}
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-semibold">Invoice Images ({images.length}/5)</h3>
                {images.length < 5 && (
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      style={{ display: 'none' }}
                      id="image-upload"
                      disabled={uploadingImage}
                    />
                    <Button
                      size="sm"
                      onClick={() => document.getElementById('image-upload').click()}
                      disabled={uploadingImage}
                      data-testid="upload-image-button"
                    >
                      <Upload className="w-4 h-4 mr-1" />
                      {uploadingImage ? 'Uploading...' : 'Upload Image'}
                    </Button>
                  </div>
                )}
              </div>

              {images.length === 0 ? (
                <Card className="p-8 text-center">
                  <ImageIcon className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                  <p className="text-gray-600">No images uploaded yet</p>
                </Card>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {images.map((img, idx) => (
                    <div key={idx} className="relative group">
                      <img
                        src={`${API}/invoices/${booking.id}/images/${img}`}
                        alt={`Invoice ${idx + 1}`}
                        className="w-full h-48 object-cover rounded-lg border"
                      />
                      <Button
                        size="sm"
                        variant="destructive"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDeleteImage(img)}
                        data-testid={`delete-image-${idx}`}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Booking Summary */}
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-2">Booking Summary</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-gray-600">Delivery Address:</div>
                <div>{booking.delivery_address}</div>
                <div className="text-gray-600">Fuel Type:</div>
                <div>{booking.fuel_type}</div>
                <div className="text-gray-600">Status:</div>
                <div className="capitalize">{booking.status}</div>
                <div className="text-gray-600">Total Price:</div>
                <div className="font-bold text-green-600">${booking.total_price}</div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
