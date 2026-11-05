'use client';

import React, { useState, useEffect } from 'react';
import { Batch, Medicine, Supplier } from '@/types/database';
import { useAuth } from '@/lib/auth-context';
import { X, Save, AlertCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface AddEditBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  medicine: Medicine;
  batch?: Batch | null;
  suppliers: Supplier[];
  onSaveBatch: (data: Partial<Batch>) => Promise<{ success: boolean; error?: string }>;
}

export default function AddEditBatchModal({
  isOpen,
  onClose,
  onSaved,
  medicine,
  batch,
  suppliers,
  onSaveBatch,
}: AddEditBatchModalProps) {
  const { canEditInventory } = useAuth();
  const currencySymbol = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || '₹';

  const [batchNumber, setBatchNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [quantity, setQuantity] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [mrp, setMRP] = useState('');
  const [storageLocation, setStorageLocation] = useState('');
  const [supplierId, setSupplierId] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (batch) {
      setBatchNumber(batch.batch_number || '');
      setExpiryDate(batch.expiry_date || '');
      setQuantity(String(batch.quantity ?? 0));
      setPurchasePrice(String(batch.purchase_price ?? ''));
      setMRP(String(batch.mrp ?? medicine.mrp ?? ''));
      setStorageLocation(batch.storage_location || '');
      setSupplierId(batch.supplier_id || medicine.default_supplier_id || '');
    } else {
      setBatchNumber('');
      setExpiryDate('');
      setQuantity('');
      setPurchasePrice('');
      setMRP(String(medicine.mrp || ''));
      setStorageLocation('Rack A - Shelf 1');
      setSupplierId(medicine.default_supplier_id || '');
    }
    setError(null);
  }, [batch, medicine, isOpen]);

  if (!isOpen) return null;

  // Real-time calculation of expiry status preview
  let daysUntilExpiry: number | null = null;
  if (expiryDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(expiryDate);
    exp.setHours(0, 0, 0, 0);
    daysUntilExpiry = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditInventory) {
      setError('Permission denied: You cannot add or edit stock batches.');
      return;
    }

    if (!batchNumber.trim() || !expiryDate) {
      setError('Batch Number and Expiry Date are mandatory.');
      return;
    }

    const parsedQty = parseInt(quantity, 10);
    if (isNaN(parsedQty) || parsedQty < 0) {
      setError('Please enter a valid stock quantity (0 or greater).');
      return;
    }

    const parsedPurchase = parseFloat(purchasePrice) || 0;
    const parsedMRP = parseFloat(mrp) || medicine.mrp || 0;

    setIsSubmitting(true);
    setError(null);

    const payload: Partial<Batch> = {
      ...(batch?.id ? { id: batch.id } : {}),
      medicine_id: medicine.id,
      batch_number: batchNumber.trim().toUpperCase(),
      expiry_date: expiryDate,
      quantity: parsedQty,
      purchase_price: parsedPurchase,
      mrp: parsedMRP,
      storage_location: storageLocation.trim() || 'General Shelf',
      supplier_id: supplierId || null,
    };

    const res = await onSaveBatch(payload);
    setIsSubmitting(false);

    if (res.success) {
      onSaved();
      onClose();
    } else {
      setError(res.error || 'Failed to save batch');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-teal-50/40">
          <div>
            <h3 className="text-base font-bold text-gray-900">
              {batch ? 'Edit Batch Details' : 'Add Stock Batch'}
            </h3>
            <p className="text-xs text-teal-700 font-medium">
              {medicine.name} • {medicine.strength} ({medicine.unit_pack_size})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Batch Number */}
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Batch Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={batchNumber}
                onChange={(e) => setBatchNumber(e.target.value)}
                placeholder="e.g. DL-24A01"
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:outline-hidden uppercase font-mono text-gray-900 bg-white"
              />
            </div>

            {/* Expiry Date */}
            <div className="col-span-2 sm:col-span-1">
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Expiry Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:outline-hidden text-gray-900 bg-white"
              />
            </div>

            {/* Expiry Alert Preview Banner */}
            {daysUntilExpiry !== null && (
              <div className="col-span-2">
                {daysUntilExpiry <= 0 ? (
                  <div className="p-2.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700 font-bold">
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                    <span>Warning: This batch is EXPIRED ({Math.abs(daysUntilExpiry)} days ago). It will be flagged red!</span>
                  </div>
                ) : daysUntilExpiry <= 90 ? (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-xs text-amber-800 font-semibold">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                    <span>Expiring Soon ({daysUntilExpiry} days left). It will be flagged amber and prioritized for First-Expiry-First-Out!</span>
                  </div>
                ) : (
                  <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs text-emerald-700">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                    <span>Good expiry date ({daysUntilExpiry} days remaining).</span>
                  </div>
                )}
              </div>
            )}

            {/* Quantity */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Quantity in Stock <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Number of packs"
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:outline-hidden text-gray-900 bg-white font-mono"
              />
            </div>

            {/* Storage Location */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Storage / Shelf Location
              </label>
              <input
                type="text"
                value={storageLocation}
                onChange={(e) => setStorageLocation(e.target.value)}
                placeholder="e.g. Rack A - Shelf 2"
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:outline-hidden text-gray-900 bg-white"
              />
            </div>

            {/* Purchase Price */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Purchase Price ({currencySymbol})
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:outline-hidden text-gray-900 bg-white font-mono"
              />
            </div>

            {/* Batch MRP */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Batch MRP ({currencySymbol})
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={mrp}
                onChange={(e) => setMRP(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:outline-hidden text-gray-900 bg-white font-mono"
              />
            </div>

            {/* Supplier */}
            <div className="col-span-2">
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Batch Supplier / Distributor
              </label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:outline-hidden text-gray-900 bg-white"
              >
                <option value="">-- Select Supplier --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !canEditInventory}
              className="px-5 py-2 rounded-xl text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 disabled:opacity-50 shadow-md shadow-teal-100 flex items-center gap-2 transition"
            >
              <Save className="w-4 h-4" />
              <span>{isSubmitting ? 'Saving...' : batch ? 'Update Batch' : 'Add Batch'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
