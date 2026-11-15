'use client';

import React, { useState, useEffect } from 'react';
import { Medicine, Batch, Supplier, StockMovement } from '@/types/database';
import { useAuth } from '@/lib/auth-context';
import { fetchStockMovements, recordStockMovement } from '@/lib/data-service';
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
  ArrowDownLeft,
  ArrowUpRight,
  History,
  TrendingUp,
  TrendingDown,
  Package,
  Calendar,
  Clock,
  User,
  FileText
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
  const { canEditInventory, canDelete, role, user } = useAuth();
  const currencySymbol = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || '₹';

  // Navigation tabs inside modal
  const [activeTab, setActiveTab] = useState<'batches' | 'ledger'>('batches');

  // Batches state
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Stock In / Out Movements state
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [summary, setSummary] = useState({ total_in: 0, total_out: 0, net_balance: 0 });
  const [loadingMovements, setLoadingMovements] = useState(false);

  // Quick Adjustment modal state
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [adjustBatchId, setAdjustBatchId] = useState('');
  const [adjustType, setAdjustType] = useState<'purchase' | 'sale' | 'adjustment' | 'return' | 'expired_disposal'>('purchase');
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [isSubmittingAdjust, setIsSubmittingAdjust] = useState(false);

  useEffect(() => {
    if (isOpen && medicine) {
      loadMovementLedger();
    }
  }, [isOpen, medicine?.id]);

  const loadMovementLedger = async () => {
    if (!medicine) return;
    setLoadingMovements(true);
    try {
      const res = await fetchStockMovements(medicine.id);
      setMovements(res.movements);
      setSummary(res.summary);
    } catch (e) {
      console.error('Error fetching stock movements:', e);
    } finally {
      setLoadingMovements(false);
    }
  };

  if (!isOpen || !medicine) return null;

  const batches = medicine.batches || [];
  // Batches are FEFO sorted
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
      loadMovementLedger();
    }
  };

  const handleRecordAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditInventory || !medicine) return;

    const parsedQty = parseInt(adjustQty, 10);
    if (isNaN(parsedQty) || parsedQty === 0) {
      alert('Please enter a valid non-zero quantity.');
      return;
    }

    // Determine sign: stock OUT types are negative
    let signedQty = parsedQty;
    if (['sale', 'expired_disposal'].includes(adjustType) && signedQty > 0) {
      signedQty = -signedQty;
    }

    setIsSubmittingAdjust(true);
    const res = await recordStockMovement({
      medicine_id: medicine.id,
      batch_id: adjustBatchId || null,
      movement_type: adjustType,
      quantity_change: signedQty,
      reason: adjustReason.trim() || `Manual ${adjustType} adjustment`,
      created_by: user?.id,
      user_name: user?.full_name || 'Staff',
    });
    setIsSubmittingAdjust(false);

    if (res.success) {
      setIsAdjustModalOpen(false);
      setAdjustQty('');
      setAdjustReason('');
      onRefresh();
      loadMovementLedger();
    } else {
      alert(res.error || 'Failed to record movement');
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

          {/* Quick Stats Grid */}
          <div className="px-6 pt-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Current Shelf Stock</p>
                <p className={`text-lg font-bold mt-0.5 ${medicine.is_low_stock ? 'text-amber-600' : 'text-gray-900'}`}>
                  {medicine.total_stock} <span className="text-xs font-normal text-gray-500">packs</span>
                </p>
                <p className="text-[10px] text-gray-400">Reorder at: {medicine.reorder_level}</p>
              </div>

              <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Standard MRP</p>
                <p className="text-lg font-bold mt-0.5 text-gray-900 font-mono">
                  {currencySymbol}{medicine.mrp.toFixed(2)}
                </p>
                <p className="text-[10px] text-gray-400">{medicine.unit_pack_size}</p>
              </div>

              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100">
                <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
                  <ArrowDownLeft className="w-3 h-3 text-emerald-600" />
                  <span>Total In (Came In)</span>
                </p>
                <p className="text-lg font-bold mt-0.5 text-emerald-700 font-mono">
                  +{summary.total_in} <span className="text-xs font-normal text-emerald-600">packs</span>
                </p>
                <p className="text-[10px] text-emerald-600/80">Received / Opening</p>
              </div>

              <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-100">
                <p className="text-[10px] font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1">
                  <ArrowUpRight className="w-3 h-3 text-rose-600" />
                  <span>Total Out (Went Out)</span>
                </p>
                <p className="text-lg font-bold mt-0.5 text-rose-700 font-mono">
                  -{summary.total_out} <span className="text-xs font-normal text-rose-600">packs</span>
                </p>
                <p className="text-[10px] text-rose-600/80">Dispensed / Adjusted</p>
              </div>
            </div>
          </div>

          {/* Tab Switcher: Batches vs Stock In/Out Ledger */}
          <div className="px-6 pt-4 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('batches')}
                className={`flex items-center gap-2 px-4 py-2 border-b-2 text-xs font-bold transition ${
                  activeTab === 'batches'
                    ? 'border-teal-600 text-teal-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Active Batches (FEFO)</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-gray-100 text-gray-700">
                  {batches.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('ledger')}
                className={`flex items-center gap-2 px-4 py-2 border-b-2 text-xs font-bold transition ${
                  activeTab === 'ledger'
                    ? 'border-teal-600 text-teal-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Stock In / Out Ledger (Audit)</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-teal-100 text-teal-800">
                  {movements.length}
                </span>
              </button>
            </div>

            {canEditInventory && (
              <div className="flex items-center gap-2 pb-1.5">
                {activeTab === 'batches' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingBatch(null);
                      setBatchModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Batch</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsAdjustModalOpen(true)}
                    className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Record Stock Movement</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Body Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            
            {/* TAB 1: BATCHES */}
            {activeTab === 'batches' && (
              <div>
                {batches.length === 0 ? (
                  <div className="p-8 text-center bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                    <p className="text-sm font-semibold text-gray-600">No stock batches recorded yet</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Add a batch with batch number, expiry date, and quantity to track stock.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {batches.map((batch) => {
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

                            <div className="flex items-center gap-4 text-right">
                              <div>
                                <p className="text-xs text-gray-400 font-medium">Quantity</p>
                                <p className={`text-base font-bold font-mono ${isExpired ? 'text-red-600 line-through' : 'text-gray-900'}`}>
                                  {batch.quantity} <span className="text-xs font-normal">packs</span>
                                </p>
                              </div>

                              <div>
                                <p className="text-xs text-gray-400 font-medium">MRP / Buy</p>
                                <p className="text-xs font-bold font-mono text-gray-800">
                                  {currencySymbol}{batch.mrp.toFixed(2)}
                                </p>
                                <p className="text-[11px] font-mono text-gray-400">
                                  {currencySymbol}{batch.purchase_price.toFixed(2)}
                                </p>
                              </div>

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
            )}

            {/* TAB 2: STOCK IN / OUT LEDGER */}
            {activeTab === 'ledger' && (
              <div className="space-y-4">
                <div className="p-3 bg-teal-50/70 border border-teal-200 rounded-xl flex items-center justify-between text-xs text-teal-900">
                  <span>
                    <strong>Stock Movement Ledger:</strong> Shows all stock arrivals, dispensing, and physical adjustments for <strong>{medicine.name}</strong>.
                  </span>
                  <span className="font-mono font-bold text-teal-800">
                    Net Balance: {summary.net_balance} packs
                  </span>
                </div>

                {loadingMovements ? (
                  <div className="p-8 text-center text-xs text-gray-400">Loading stock movement ledger...</div>
                ) : movements.length === 0 ? (
                  <div className="p-8 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
                    <History className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-gray-600">No stock movements recorded yet</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Movements are logged automatically when stock arrives or is dispensed.
                    </p>
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100 bg-white">
                    <div className="grid grid-cols-12 bg-gray-50 px-4 py-2.5 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                      <span className="col-span-3">Date / Time</span>
                      <span className="col-span-3">Movement Type</span>
                      <span className="col-span-2">Batch</span>
                      <span className="col-span-2 text-right">In / Out Qty</span>
                      <span className="col-span-2 text-right">Balance After</span>
                    </div>

                    {movements.map((m) => {
                      const isPositive = m.quantity_change > 0;
                      return (
                        <div key={m.id} className="grid grid-cols-12 px-4 py-3 items-center text-xs hover:bg-gray-50/60 transition">
                          <div className="col-span-3 space-y-0.5">
                            <span className="font-medium text-gray-900 block">
                              {new Date(m.created_at).toLocaleDateString()}
                            </span>
                            <span className="text-[10px] text-gray-400 block">
                              {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>

                          <div className="col-span-3 space-y-0.5">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isPositive
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {isPositive ? <ArrowDownLeft className="w-3 h-3 text-emerald-600" /> : <ArrowUpRight className="w-3 h-3 text-rose-600" />}
                              <span className="capitalize">{m.movement_type.replace('_', ' ')}</span>
                            </span>
                            {m.reason && (
                              <p className="text-[11px] text-gray-500 truncate" title={m.reason}>
                                {m.reason}
                              </p>
                            )}
                          </div>

                          <div className="col-span-2 font-mono text-xs text-gray-700">
                            {m.batch_number || 'Batch -'}
                          </div>

                          <div className={`col-span-2 text-right font-mono font-bold ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {isPositive ? `+${m.quantity_change}` : m.quantity_change}
                          </div>

                          <div className="col-span-2 text-right font-mono font-bold text-gray-900">
                            {m.balance_after}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
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
            loadMovementLedger();
            setBatchModalOpen(false);
          }}
          medicine={medicine}
          batch={editingBatch}
          suppliers={suppliers}
          onSaveBatch={onSaveBatch}
        />
      )}

      {/* Quick Record Stock In/Out Modal */}
      {isAdjustModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900">Record Stock Movement</h3>
                <p className="text-xs text-gray-500">{medicine.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setIsAdjustModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordAdjustment} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Movement Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={adjustType}
                  onChange={(e) => setAdjustType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                >
                  <option value="purchase">🟢 Stock In: Received Fresh Shipment</option>
                  <option value="return">🟢 Stock In: Return from Customer</option>
                  <option value="sale">🔴 Stock Out: Dispensed / Sale</option>
                  <option value="expired_disposal">🔴 Stock Out: Expired / Damaged Disposal</option>
                  <option value="adjustment">🟡 Physical Count Adjustment</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Target Batch
                </label>
                <select
                  value={adjustBatchId}
                  onChange={(e) => setAdjustBatchId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs font-bold text-gray-900 bg-white focus:ring-2 focus:ring-teal-500 focus:outline-hidden"
                >
                  <option value="">-- Earliest Batch (Auto FEFO) --</option>
                  {batches.map((b) => (
                    <option key={b.id} value={b.id}>
                      Batch {b.batch_number} (Exp: {b.expiry_date}, Current Qty: {b.quantity})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Quantity (Packs) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={adjustQty}
                  onChange={(e) => setAdjustQty(e.target.value)}
                  placeholder="Number of packs"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:outline-hidden font-mono text-gray-900 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  Reason / Reference Note
                </label>
                <input
                  type="text"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. Supplier Invoice #4003 or Counter Sale"
                  className="w-full px-3 py-2 border border-gray-300 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-hidden text-gray-900 bg-white"
                />
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-4 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingAdjust}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-100 transition"
                >
                  {isSubmittingAdjust ? 'Saving...' : 'Record Movement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
