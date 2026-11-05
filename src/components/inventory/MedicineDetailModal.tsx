'use client';

import React, { useState } from 'react';
import { Medicine, Batch, Supplier } from '@/types/database';
import { useAuth } from '@/lib/auth-context';
import ExpiryBadge from './ExpiryBadge';
import AddEditBatchModal from './AddEditBatchModal';
import { 
  X, 
  Plus, 
  Edit, 
  Trash2, 
  AlertTriangle, 
  MapPin, 
  Layers, 
  ShieldAlert, 
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface MedicineDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  medicine: Medicine | null;
  suppliers: Supplier[];
  onRefresh: () => void;
  onEditMedicine: (med: Medicine) => void;
  onDeleteMedicine: (id: string) => Promise<void>;
  onSaveBatch: (data: Partial<Batch>) => Promise<{ success: boolean; error?: string }>;
  onDeleteBatch: (id: string) => Promise<void>;
}

export default function MedicineDetailModal({
  isOpen,
  onClose,
  medicine,
  suppliers,
  onRefresh,
  onEditMedicine,
  onDeleteMedicine,
  onSaveBatch,
  onDeleteBatch,
}: MedicineDetailModalProps) {
  const { canEditInventory, canDelete, role } = useAuth();
  const currencySymbol = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || '₹';

  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !medicine) return null;

  const batches = medicine.batches || [];
  // Batches are already sorted in FEFO order (earliest expiry first)
  const firstUsableBatch = batches.find((b) => (b.days_to_expiry ?? 1) > 0 && b.quantity > 0);

  const getSupplierName = (id?: string | null) => {
    if (!id) return 'Not Specified';
    const s = suppliers.find((sup) => sup.id === id);
    return s ? s.name : 'Standard Supplier';
  };

  const handleDeleteMed = async () => {
    if (!canDelete) return;
    if (confirm(`Are you sure you want to soft-delete "${medicine.name}"? It will be marked inactive.`)) {
      setIsDeleting(true);
      await onDeleteMedicine(medicine.id);
      setIsDeleting(false);
      onClose();
    }
  };

  const handleDeleteBatch = async (batchId: string, batchNo: string) => {
    if (!canDelete) return;
    if (confirm(`Soft-delete batch "${batchNo}"? It will be removed from active stock.`)) {
      await onDeleteBatch(batchId);
      onRefresh();
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs overflow-y-auto">
        <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          
          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b border-gray-100 bg-gray-50/70">
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <h2 className="text-xl font-bold text-gray-900 tracking-tight">
                  {medicine.name}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-200 text-gray-800">
                  {medicine.category}
                </span>
                {medicine.prescription_required && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
                    <ShieldAlert className="w-3 h-3 text-rose-600" />
                    <span>Rx Schedule H</span>
                  </span>
                )}
                {medicine.is_low_stock && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                    <AlertTriangle className="w-3 h-3 text-amber-700" />
                    <span>Low Stock Alert</span>
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 font-medium">
                {medicine.generic_name} • <span className="text-gray-500">{medicine.manufacturer}</span>
              </p>
            </div>

            <div className="flex items-center gap-2">
              {canEditInventory && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onEditMedicine(medicine);
                  }}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-1.5 shadow-xs transition"
                >
                  <Edit className="w-3.5 h-3.5 text-gray-500" />
                  <span>Edit Master</span>
                </button>
              )}

              {canDelete && (
                <button
                  type="button"
                  onClick={handleDeleteMed}
                  disabled={isDeleting}
                  className="px-3 py-1.5 rounded-xl border border-red-200 bg-red-50 text-xs font-semibold text-red-700 hover:bg-red-100 flex items-center gap-1.5 transition"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  <span>Delete</span>
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition ml-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Active Stock</p>
                <p className={`text-xl font-bold mt-1 ${medicine.is_low_stock ? 'text-amber-600' : 'text-gray-900'}`}>
                  {medicine.total_stock} <span className="text-xs font-normal text-gray-500">packs</span>
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">Reorder level: {medicine.reorder_level}</p>
              </div>

              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Standard MRP</p>
                <p className="text-xl font-bold mt-1 text-gray-900 font-mono">
                  {currencySymbol}{medicine.mrp.toFixed(2)}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">Pack: {medicine.unit_pack_size}</p>
              </div>

              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Strength / Form</p>
                <p className="text-sm font-bold mt-1 text-gray-900">{medicine.strength}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{medicine.category}</p>
              </div>

              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">GST & HSN</p>
                <p className="text-sm font-bold mt-1 text-gray-900">{medicine.tax_gst_percentage}% GST</p>
                <p className="text-[11px] text-gray-400 mt-0.5">HSN: {medicine.hsn_code || '3004'}</p>
              </div>
            </div>

            {/* Batches Section (FEFO - First Expiry First Out) */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-teal-600" />
                  <h3 className="text-base font-bold text-gray-900">
                    Stock Batches (First-Expiry-First-Out)
                  </h3>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                    {batches.length} batch{batches.length === 1 ? '' : 'es'}
                  </span>
                </div>

                {canEditInventory && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingBatch(null);
                      setBatchModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm shadow-teal-100 transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Batch</span>
                  </button>
                )}
              </div>

              {batches.length === 0 ? (
                <div className="p-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                  <p className="text-sm font-semibold text-gray-600">No stock batches recorded yet</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Add a batch with batch number, expiry date, and quantity to begin tracking stock.
                  </p>
                  {canEditInventory && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingBatch(null);
                        setBatchModalOpen(true);
                      }}
                      className="mt-3 px-4 py-2 bg-teal-600 text-white rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-teal-700 transition"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add First Batch</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {batches.map((batch, idx) => {
                    const isFefoPick = firstUsableBatch && firstUsableBatch.id === batch.id;
                    const isExpired = (batch.days_to_expiry ?? 1) <= 0;

                    return (
                      <div
                        key={batch.id}
                        className={`p-4 rounded-xl border transition ${
                          isFefoPick
                            ? 'bg-teal-50/40 border-teal-300 ring-1 ring-teal-200'
                            : isExpired
                            ? 'bg-red-50/30 border-red-200'
                            : 'bg-white border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          
                          {/* Batch Title & Flags */}
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-sm font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded">
                                {batch.batch_number}
                              </span>

                              {isFefoPick && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-600 text-white shadow-xs">
                                  <Sparkles className="w-3 h-3 text-amber-300" />
                                  <span>USE FIRST (FEFO)</span>
                                </span>
                              )}

                              <ExpiryBadge
                                expiryDate={batch.expiry_date}
                                daysToExpiry={batch.days_to_expiry}
                              />
                            </div>

                            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 pt-1">
                              {batch.storage_location && (
                                <span className="flex items-center gap-1 font-medium text-gray-700">
                                  <MapPin className="w-3.5 h-3.5 text-teal-600" />
                                  <span>{batch.storage_location}</span>
                                </span>
                              )}
                              <span>Supplier: {getSupplierName(batch.supplier_id)}</span>
                            </div>
                          </div>

                          {/* Quantities & Pricing */}
                          <div className="flex items-center gap-4 text-right">
                            <div>
                              <p className="text-xs text-gray-400 font-medium">Quantity</p>
                              <p className={`text-base font-bold font-mono ${isExpired ? 'text-red-600 line-through' : 'text-gray-900'}`}>
                                {batch.quantity} <span className="text-xs font-normal">packs</span>
                              </p>
                            </div>

                            <div>
                              <p className="text-xs text-gray-400 font-medium">MRP / Purchase</p>
                              <p className="text-xs font-bold font-mono text-gray-800">
                                {currencySymbol}{batch.mrp.toFixed(2)}
                              </p>
                              <p className="text-[11px] font-mono text-gray-400">
                                Buy: {currencySymbol}{batch.purchase_price.toFixed(2)}
                              </p>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 pl-2">
                              {canEditInventory && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingBatch(batch);
                                    setBatchModalOpen(true);
                                  }}
                                  title="Edit batch"
                                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                              )}

                              {canDelete && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteBatch(batch.id, batch.batch_number)}
                                  title="Delete batch"
                                  className="p-1.5 text-red-400 hover:text-red-700 hover:bg-red-50 rounded-lg transition"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>

                          </div>

                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Note on Role Restrictions */}
            {role === 'accountant' && (
              <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-800">
                <span className="font-bold">Accountant View:</span> You have view-only access to audit inventory levels and batches. To edit medicines or stock, please log in as Pharmacist or Admin.
              </div>
            )}
            {role === 'pharmacist' && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800">
                <span className="font-bold">Pharmacist View:</span> You can add/edit medicines and batches. Deletion is restricted to Admin.
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="px-6 py-3.5 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              Primary Supplier: <strong>{getSupplierName(medicine.default_supplier_id)}</strong>
            </span>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-100 transition"
            >
              Close
            </button>
          </div>

        </div>
      </div>

      {/* Nested Add/Edit Batch Modal */}
      {batchModalOpen && (
        <AddEditBatchModal
          isOpen={batchModalOpen}
          onClose={() => setBatchModalOpen(false)}
          onSaved={() => {
            onRefresh();
            setBatchModalOpen(false);
          }}
          medicine={medicine}
          batch={editingBatch}
          suppliers={suppliers}
          onSaveBatch={onSaveBatch}
        />
      )}
    </>
  );
}
