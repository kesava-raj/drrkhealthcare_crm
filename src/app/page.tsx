'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Medicine, Supplier, Batch } from '@/types/database';
import { 
  fetchMedicines, 
  fetchSuppliers, 
  saveMedicine, 
  softDeleteMedicine, 
  saveBatch, 
  softDeleteBatch,
  isSupabaseConfigured 
} from '@/lib/data-service';
import { useAuth } from '@/lib/auth-context';
import ExpiryBadge from '@/components/inventory/ExpiryBadge';
import AddEditMedicineModal from '@/components/inventory/AddEditMedicineModal';
import MedicineDetailModal from '@/components/inventory/MedicineDetailModal';
import { 
  Search, 
  Plus, 
  Filter, 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle2, 
  Package, 
  ShieldAlert, 
  Layers, 
  ChevronRight,
  RefreshCw,
  ExternalLink,
  Database,
  ArrowUpDown
} from 'lucide-react';

export default function InventoryPage() {
  const { canEditInventory, role, user } = useAuth();
  const currencySymbol = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || '₹';

  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'EXPIRING_SOON' | 'EXPIRED' | 'LOW_STOCK' | 'RX_ONLY'>('ALL');

  // Modals
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [selectedMedicineForEdit, setSelectedMedicineForEdit] = useState<Medicine | null>(null);
  const [selectedMedicineForDetail, setSelectedMedicineForDetail] = useState<Medicine | null>(null);
  const [showSetupGuide, setShowSetupGuide] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [medsData, supsData] = await Promise.all([
        fetchMedicines(),
        fetchSuppliers(),
      ]);
      setMedicines(medsData);
      setSuppliers(supsData);
      
      // Update open detail modal if needed
      if (selectedMedicineForDetail) {
        const refreshedMed = medsData.find((m) => m.id === selectedMedicineForDetail.id);
        if (refreshedMed) setSelectedMedicineForDetail(refreshedMed);
      }
    } catch (err) {
      console.error('Error loading inventory data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Summary Metrics
  const metrics = useMemo(() => {
    let totalStockPacks = 0;
    let expiredCount = 0;
    let expiringSoonCount = 0;
    let lowStockCount = 0;

    for (const m of medicines) {
      totalStockPacks += m.total_stock || 0;
      if (m.has_expired) expiredCount++;
      if (m.has_expiring_soon) expiringSoonCount++;
      if (m.is_low_stock) lowStockCount++;
    }

    return {
      totalMeds: medicines.length,
      totalStockPacks,
      expiredCount,
      expiringSoonCount,
      lowStockCount,
    };
  }, [medicines]);

  // Categories list for filter dropdown
  const categories = useMemo(() => {
    const set = new Set(medicines.map((m) => m.category).filter(Boolean));
    return ['ALL', ...Array.from(set)];
  }, [medicines]);

  // Filtered medicines
  const filteredMedicines = useMemo(() => {
    return medicines.filter((med) => {
      // Search filter
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        med.name.toLowerCase().includes(q) ||
        med.generic_name.toLowerCase().includes(q) ||
        med.manufacturer.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      // Category filter
      if (selectedCategory !== 'ALL' && med.category !== selectedCategory) {
        return false;
      }

      // Status filter
      if (statusFilter === 'EXPIRING_SOON') return med.has_expiring_soon;
      if (statusFilter === 'EXPIRED') return med.has_expired;
      if (statusFilter === 'LOW_STOCK') return med.is_low_stock;
      if (statusFilter === 'RX_ONLY') return med.prescription_required;

      return true;
    });
  }, [medicines, searchQuery, selectedCategory, statusFilter]);

  // Handlers
  const handleSaveMedicine = async (data: Partial<Medicine>) => {
    const res = await saveMedicine(data, { id: user?.id || 'unknown', name: user?.full_name || 'Staff' });
    if (res.success) {
      await loadData();
    }
    return res;
  };

  const handleDeleteMedicine = async (id: string) => {
    await softDeleteMedicine(id, { id: user?.id || 'unknown', name: user?.full_name || 'Staff' });
    await loadData();
  };

  const handleSaveBatch = async (data: Partial<Batch>) => {
    const res = await saveBatch(data, { id: user?.id || 'unknown', name: user?.full_name || 'Staff' });
    if (res.success) {
      await loadData();
    }
    return res;
  };

  const handleDeleteBatch = async (id: string) => {
    await softDeleteBatch(id, { id: user?.id || 'unknown', name: user?.full_name || 'Staff' });
    await loadData();
  };

  return (
    <div className="min-h-screen bg-gray-50/50 pb-16">
      
      {/* Offline Demo Banner / Guide Trigger */}
      {!isSupabaseConfigured() && (
        <div className="bg-linear-to-r from-amber-500/10 via-amber-500/5 to-teal-500/10 border-b border-amber-200/60 px-4 py-2.5">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-amber-900">
              <Database className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Offline Demo Mode:</strong> Viewing 30 sample medicines & batches. Connect your free Supabase database whenever you are ready!
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowSetupGuide(true)}
              className="text-xs font-bold text-amber-800 hover:text-amber-900 underline underline-offset-2 flex items-center gap-1"
            >
              <span>View 3-Step Setup Instructions</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        
        {/* Page Title & Main Action Button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
              Pharmacy Medicine Inventory
            </h1>
            <p className="text-xs sm:text-sm text-gray-500">
              Real-time batch tracking, First-Expiry-First-Out (FEFO), and automatic safety alerts.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={loadData}
              title="Refresh inventory"
              className="p-2 bg-white border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 shadow-xs transition"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-teal-600' : ''}`} />
            </button>

            {canEditInventory ? (
              <button
                type="button"
                onClick={() => {
                  setSelectedMedicineForEdit(null);
                  setIsAddEditModalOpen(true);
                }}
                className="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 shadow-md shadow-teal-100 flex items-center gap-2 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Add Medicine</span>
              </button>
            ) : (
              <div className="text-xs text-sky-800 bg-sky-50 px-3 py-1.5 rounded-xl border border-sky-200 font-medium">
                👁️ View-Only (Accountant)
              </div>
            )}
          </div>
        </div>

        {/* 4 Summary Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          
          {/* Total Medicines */}
          <button
            type="button"
            onClick={() => {
              setStatusFilter('ALL');
              setSelectedCategory('ALL');
            }}
            className={`p-4 rounded-2xl border text-left transition ${
              statusFilter === 'ALL'
                ? 'bg-white border-teal-500 shadow-md ring-1 ring-teal-500'
                : 'bg-white border-gray-200 hover:border-gray-300 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between text-gray-500 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider">Total Medicines</span>
              <Package className="w-4 h-4 text-teal-600" />
            </div>
            <p className="text-2xl font-black text-gray-900">{metrics.totalMeds}</p>
            <p className="text-xs text-gray-400 mt-1">{metrics.totalStockPacks} total packs in stock</p>
          </button>

          {/* Expiring Soon (<90 Days) - Amber */}
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'EXPIRING_SOON' ? 'ALL' : 'EXPIRING_SOON')}
            className={`p-4 rounded-2xl border text-left transition ${
              statusFilter === 'EXPIRING_SOON'
                ? 'bg-amber-50/80 border-amber-500 shadow-md ring-1 ring-amber-500'
                : 'bg-white border-gray-200 hover:border-amber-300 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between text-amber-700 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider">Expiring &lt;90 Days</span>
              <AlertTriangle className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-2xl font-black text-amber-600">{metrics.expiringSoonCount}</p>
            <p className="text-xs text-amber-700/80 mt-1">🟡 Amber alert (dispense first)</p>
          </button>

          {/* Expired - Red */}
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'EXPIRED' ? 'ALL' : 'EXPIRED')}
            className={`p-4 rounded-2xl border text-left transition ${
              statusFilter === 'EXPIRED'
                ? 'bg-red-50/80 border-red-500 shadow-md ring-1 ring-red-500'
                : 'bg-white border-gray-200 hover:border-red-300 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between text-red-700 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider">Expired Stock</span>
              <AlertCircle className="w-4 h-4 text-red-500" />
            </div>
            <p className="text-2xl font-black text-red-600">{metrics.expiredCount}</p>
            <p className="text-xs text-red-700/80 mt-1">🔴 Red alert (block sale)</p>
          </button>

          {/* Low Stock Warning */}
          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === 'LOW_STOCK' ? 'ALL' : 'LOW_STOCK')}
            className={`p-4 rounded-2xl border text-left transition ${
              statusFilter === 'LOW_STOCK'
                ? 'bg-orange-50/80 border-orange-500 shadow-md ring-1 ring-orange-500'
                : 'bg-white border-gray-200 hover:border-orange-300 shadow-xs'
            }`}
          >
            <div className="flex items-center justify-between text-orange-700 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider">Below Reorder Level</span>
              <AlertTriangle className="w-4 h-4 text-orange-500" />
            </div>
            <p className="text-2xl font-black text-orange-600">{metrics.lowStockCount}</p>
            <p className="text-xs text-orange-700/80 mt-1">⚠️ Restock required</p>
          </button>

        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xs space-y-3">
          
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by brand name (e.g. Dolo), generic name (Paracetamol), or manufacturer..."
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden text-gray-900 bg-white placeholder-gray-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Category Dropdown */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400 shrink-0" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-hidden text-gray-900 bg-white"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c === 'ALL' ? 'All Dosage Forms' : c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Filter Status Tabs */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-100">
            <span className="text-xs font-semibold text-gray-400">Quick Filters:</span>

            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                statusFilter === 'ALL'
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All Items ({medicines.length})
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('EXPIRING_SOON')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition flex items-center gap-1 ${
                statusFilter === 'EXPIRING_SOON'
                  ? 'bg-amber-600 text-white'
                  : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
              }`}
            >
              <span>🟡 Expiring &lt;90d</span>
              <span>({metrics.expiringSoonCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('EXPIRED')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition flex items-center gap-1 ${
                statusFilter === 'EXPIRED'
                  ? 'bg-red-600 text-white'
                  : 'bg-red-50 text-red-800 hover:bg-red-100 border border-red-200'
              }`}
            >
              <span>🔴 Expired</span>
              <span>({metrics.expiredCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter('LOW_STOCK')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition flex items-center gap-1 ${
                statusFilter === 'LOW_STOCK'
                  ? 'bg-orange-600 text-white'
                  : 'bg-orange-50 text-orange-800 hover:bg-orange-100 border border-orange-200'
              }`}
            >
              <span>⚠️ Low Stock</span>
              <span>({metrics.lowStockCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter(statusFilter === 'RX_ONLY' ? 'ALL' : 'RX_ONLY')}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition flex items-center gap-1 ${
                statusFilter === 'RX_ONLY'
                  ? 'bg-rose-600 text-white'
                  : 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
              }`}
            >
              <span>💊 Rx Only</span>
            </button>

            {(statusFilter !== 'ALL' || selectedCategory !== 'ALL' || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter('ALL');
                  setSelectedCategory('ALL');
                  setSearchQuery('');
                }}
                className="text-xs text-gray-500 hover:text-gray-800 font-semibold underline ml-auto"
              >
                Reset All Filters
              </button>
            )}
          </div>

        </div>

        {/* Medicines List / Table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          
          <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              Showing {filteredMedicines.length} of {medicines.length} Medicines
            </span>
            <span className="text-xs text-gray-400">
              Click any medicine to view batches &amp; FEFO details
            </span>
          </div>

          {loading ? (
            <div className="p-12 text-center text-gray-400">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-teal-600" />
              <p className="text-sm">Loading pharmacy inventory...</p>
            </div>
          ) : filteredMedicines.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-base font-bold text-gray-700">No medicines found</p>
              <p className="text-xs text-gray-400 mt-1">
                Try adjusting your search query or clearing your filter criteria.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredMedicines.map((med) => {
                const batches = med.batches || [];
                const nearestBatch = batches[0]; // Batches are FEFO sorted

                return (
                  <div
                    key={med.id}
                    onClick={() => setSelectedMedicineForDetail(med)}
                    className="p-4 sm:p-5 hover:bg-teal-50/30 transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                  >
                    
                    {/* Left: Brand name, generic composition, badges */}
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-bold text-gray-900 group-hover:text-teal-700 transition">
                          {med.name}
                        </h3>
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-100 text-gray-700">
                          {med.strength}
                        </span>
                        <span className="text-xs text-gray-400">({med.category})</span>

                        {med.prescription_required && (
                          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            <ShieldAlert className="w-3 h-3 text-rose-600" />
                            <span>Rx</span>
                          </span>
                        )}

                        {med.is_low_stock && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-900 border border-orange-200">
                            <AlertTriangle className="w-3 h-3 text-orange-600" />
                            <span>Low: {med.total_stock}/{med.reorder_level}</span>
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-gray-600 font-medium">
                        {med.generic_name} • <span className="text-gray-400">{med.manufacturer}</span>
                      </p>

                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-400 pt-0.5">
                        <span>Pack: {med.unit_pack_size}</span>
                        <span>•</span>
                        <span>HSN: {med.hsn_code}</span>
                        <span>•</span>
                        <span>GST: {med.tax_gst_percentage}%</span>
                      </div>
                    </div>

                    {/* Middle: Nearest Expiry (FEFO) */}
                    <div className="sm:text-right shrink-0">
                      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1">
                        Earliest Batch (FEFO)
                      </p>
                      {nearestBatch ? (
                        <div className="flex sm:justify-end items-center gap-2">
                          <span className="font-mono text-xs text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                            {nearestBatch.batch_number}
                          </span>
                          <ExpiryBadge
                            expiryDate={nearestBatch.expiry_date}
                            daysToExpiry={nearestBatch.days_to_expiry}
                          />
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">No active batches</span>
                      )}
                    </div>

                    {/* Right: Total Stock & MRP */}
                    <div className="flex items-center justify-between sm:justify-end gap-6 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0">
                      
                      <div className="text-left sm:text-right">
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                          Stock
                        </p>
                        <p className={`text-base font-black font-mono ${med.is_low_stock ? 'text-orange-600' : 'text-gray-900'}`}>
                          {med.total_stock} <span className="text-xs font-normal text-gray-400">packs</span>
                        </p>
                        <span className="text-[10px] text-teal-600 font-medium">
                          {batches.length} batch{batches.length === 1 ? '' : 'es'}
                        </span>
                      </div>

                      <div className="text-right">
                        <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                          MRP
                        </p>
                        <p className="text-base font-black font-mono text-gray-900">
                          {currencySymbol}{med.mrp.toFixed(2)}
                        </p>
                      </div>

                      <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-teal-600 group-hover:translate-x-1 transition hidden sm:block" />

                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>

      </main>

      {/* Add / Edit Medicine Master Modal */}
      {isAddEditModalOpen && (
        <AddEditMedicineModal
          isOpen={isAddEditModalOpen}
          onClose={() => setIsAddEditModalOpen(false)}
          onSaved={() => {
            loadData();
            setIsAddEditModalOpen(false);
          }}
          medicine={selectedMedicineForEdit}
          suppliers={suppliers}
          onSaveMedicine={handleSaveMedicine}
        />
      )}

      {/* Medicine Detail & Batches Modal */}
      {selectedMedicineForDetail && (
        <MedicineDetailModal
          isOpen={Boolean(selectedMedicineForDetail)}
          onClose={() => setSelectedMedicineForDetail(null)}
          medicine={selectedMedicineForDetail}
          suppliers={suppliers}
          onRefresh={loadData}
          onEditMedicine={(med) => {
            setSelectedMedicineForDetail(null);
            setSelectedMedicineForEdit(med);
            setIsAddEditModalOpen(true);
          }}
          onDeleteMedicine={handleDeleteMedicine}
          onSaveBatch={handleSaveBatch}
          onDeleteBatch={handleDeleteBatch}
        />
      )}

      {/* Supabase 3-Step Setup Guide Modal */}
      {showSetupGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  How to Connect Supabase (In 3 Simple Steps)
                </h3>
                <p className="text-xs text-gray-500">
                  You can explore the offline demo right now, or connect Supabase anytime:
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSetupGuide(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <ol className="space-y-3 text-xs text-gray-700">
              <li className="flex gap-2">
                <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center shrink-0">1</span>
                <div>
                  <strong>Create a Free Supabase Project:</strong> Go to{' '}
                  <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-teal-600 underline font-semibold">
                    supabase.com
                  </a>
                  , create an account, and click <em>"New Project"</em>.
                </div>
              </li>
              <li className="flex gap-2">
                <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center shrink-0">2</span>
                <div>
                  <strong>Paste the Database SQL:</strong> In your Supabase Dashboard, click <strong>SQL Editor</strong> on the left, paste the contents of the file{' '}
                  <code className="bg-gray-100 px-1 py-0.5 rounded font-mono text-[11px]">supabase/schema.sql</code>, and click <strong>Run</strong>.
                </div>
              </li>
              <li className="flex gap-2">
                <span className="w-5 h-5 rounded-full bg-teal-100 text-teal-800 font-bold flex items-center justify-center shrink-0">3</span>
                <div>
                  <strong>Copy Your API Keys:</strong> In Supabase, go to <strong>Project Settings &gt; API</strong>. Copy the <em>Project URL</em> and <em>anon public key</em> into your local{' '}
                  <code className="bg-gray-100 px-1 py-0.5 rounded font-mono text-[11px]">.env.local</code> file!
                </div>
              </li>
            </ol>

            <div className="pt-3 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={() => setShowSetupGuide(false)}
                className="px-4 py-2 bg-teal-600 text-white font-bold rounded-xl text-xs hover:bg-teal-700 transition"
              >
                Got It! Back to Inventory
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
