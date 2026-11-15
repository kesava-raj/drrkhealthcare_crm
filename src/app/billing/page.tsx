'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Medicine, Batch, Sale, SaleItem } from '@/types/database';
import { fetchMedicines, fetchSales, recordSale } from '@/lib/data-service';
import ReceiptModal from '@/components/billing/ReceiptModal';
import {
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  User,
  Phone,
  Stethoscope,
  CreditCard,
  Banknote,
  Smartphone,
  BookOpen,
  ArrowRight,
  Clock,
  Printer,
  Sparkles,
  RefreshCw,
  Package,
  Layers,
  X,
  History
} from 'lucide-react';

interface CartItem {
  medicine: Medicine;
  batch: Batch;
  quantity: number;
  unit_price: number;
  mrp: number;
  tax_percentage: number;
}

export default function BillingPOSPage() {
  const { user, role } = useAuth();

  // State
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  
  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [doctorName, setDoctorName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'upi' | 'credit'>('cash');
  const [discountAmount, setDiscountAmount] = useState<number>(0);

  // Submitting & receipt state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);

  // Recent sales history drawer
  const [showHistory, setShowHistory] = useState(false);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Load active inventory medicines
  const loadInventory = async () => {
    try {
      setLoading(true);
      const data = await fetchMedicines();
      setMedicines(data);
    } catch (err) {
      console.error('Failed to load inventory for billing:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, []);

  const loadPastSales = async () => {
    setLoadingHistory(true);
    try {
      const sales = await fetchSales();
      setRecentSales(sales);
    } catch (err) {
      console.error('Failed to load sales history:', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    medicines.forEach((m) => {
      if (m.category) set.add(m.category);
    });
    return ['All', ...Array.from(set)];
  }, [medicines]);

  // Filtered medicines
  const filteredMedicines = useMemo(() => {
    return medicines.filter((m) => {
      const matchesSearch =
        m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.generic_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.manufacturer.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCat = categoryFilter === 'All' || m.category === categoryFilter;

      return matchesSearch && matchesCat;
    });
  }, [medicines, searchQuery, categoryFilter]);

  // Helper: Get best FEFO batch for a medicine (earliest non-expired batch with quantity > 0)
  const getFefoBatch = (medicine: Medicine): Batch | null => {
    if (!medicine.batches || medicine.batches.length === 0) return null;
    
    // Sort batches by expiry ascending
    const availableBatches = medicine.batches
      .filter((b) => (b.quantity || 0) > 0 && b.expiry_status !== 'expired')
      .sort((a, b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime());

    return availableBatches[0] || null;
  };

  // Add medicine to cart using FEFO batch
  const handleAddToCart = (medicine: Medicine, specificBatch?: Batch) => {
    const targetBatch = specificBatch || getFefoBatch(medicine);

    if (!targetBatch) {
      setErrorMsg(`No active in-stock batches available for ${medicine.name}.`);
      return;
    }

    if (targetBatch.expiry_status === 'expired') {
      setErrorMsg(`Cannot dispense Batch ${targetBatch.batch_number} because it has expired.`);
      return;
    }

    setCart((prev) => {
      const existingIdx = prev.findIndex(
        (item) => item.medicine.id === medicine.id && item.batch.id === targetBatch.id
      );

      if (existingIdx >= 0) {
        const item = prev[existingIdx];
        if (item.quantity + 1 > targetBatch.quantity) {
          setErrorMsg(`Cannot add more. Only ${targetBatch.quantity} units available in Batch ${targetBatch.batch_number}.`);
          return prev;
        }
        const updated = [...prev];
        updated[existingIdx] = { ...item, quantity: item.quantity + 1 };
        return updated;
      } else {
        return [
          ...prev,
          {
            medicine,
            batch: targetBatch,
            quantity: 1,
            unit_price: Number(medicine.mrp || targetBatch.mrp || 0),
            mrp: Number(medicine.mrp || targetBatch.mrp || 0),
            tax_percentage: Number(medicine.tax_gst_percentage || 0),
          },
        ];
      }
    });

    setErrorMsg(null);
  };

  // Change quantity in cart
  const handleUpdateQuantity = (idx: number, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(idx);
      return;
    }

    const item = cart[idx];
    if (newQty > item.batch.quantity) {
      setErrorMsg(`Cannot exceed batch stock of ${item.batch.quantity} units for Batch ${item.batch.batch_number}.`);
      return;
    }

    setCart((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], quantity: newQty };
      return updated;
    });
    setErrorMsg(null);
  };

  const handleRemoveItem = (idx: number) => {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleClearCart = () => {
    setCart([]);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  // Calculations
  const { subtotal, totalTax, grandTotal } = useMemo(() => {
    let sub = 0;
    let tax = 0;

    cart.forEach((item) => {
      const itemSub = item.quantity * item.unit_price;
      const itemTax = (itemSub * item.tax_percentage) / 100;
      sub += itemSub;
      tax += itemTax;
    });

    const net = Math.max(0, sub + tax - (discountAmount || 0));

    return {
      subtotal: sub,
      totalTax: tax,
      grandTotal: net,
    };
  }, [cart, discountAmount]);

  // Handle Bill Submission
  const handleGenerateBill = async () => {
    if (cart.length === 0) {
      setErrorMsg('Please add at least one medicine to the bill cart.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const payload = {
        customer_name: customerName.trim() || 'Counter Patient',
        customer_phone: customerPhone.trim() || undefined,
        doctor_name: doctorName.trim() || undefined,
        payment_method: paymentMethod,
        discount_amount: discountAmount,
        items: cart.map((item) => ({
          medicine_id: item.medicine.id,
          batch_id: item.batch.id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          mrp: item.mrp,
          tax_percentage: item.tax_percentage,
          medicine_name: item.medicine.name,
        })),
        user: {
          id: user?.id || 'counter-user',
          name: user?.full_name || 'Counter Pharmacist',
        },
      };

      const res = await recordSale(payload);

      if (!res.success || !res.sale) {
        setErrorMsg(res.error || 'Failed to complete sale bill.');
        return;
      }

      // Successful sale
      setCompletedSale(res.sale);
      setReceiptOpen(true);
      setSuccessMsg(`Bill #${res.bill_number} generated successfully! Stock automatically updated.`);

      // Reset cart
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setDoctorName('');
      setDiscountAmount(0);

      // Refresh inventory in background
      loadInventory();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error generating bill';
      setErrorMsg(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/70 pb-16 font-sans">
      
      {/* Top Banner / Breadcrumb */}
      <div className="bg-white border-b border-gray-200 sticky top-16 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-wrap items-center justify-between gap-3">
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center text-white shadow-md shadow-teal-100">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-gray-900 tracking-tight">
                  POS Counter Sales &amp; Billing
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                  FEFO Enabled
                </span>
              </div>
              <p className="text-xs text-gray-500">
                First-Expiry-First-Out dispensing • Instant Stock Deduction • Balanced Double-Entry Ledgers
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setShowHistory(true);
                loadPastSales();
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-xs font-bold transition shadow-xs"
            >
              <History className="w-4 h-4 text-gray-500" />
              <span>Past Bills</span>
            </button>

            <button
              type="button"
              onClick={loadInventory}
              disabled={loading}
              className="p-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 text-xs font-medium transition"
              title="Refresh inventory"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-teal-600' : ''}`} />
            </button>
          </div>

        </div>
      </div>

      {/* Main Split Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        
        {/* Alerts */}
        {errorMsg && (
          <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-rose-800 text-xs animate-shake">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="font-semibold">{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-emerald-800 text-xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* ============================================================== */}
          {/* LEFT COLUMN: MEDICINE CATALOG & FEFO SELECTION (7 Cols)         */}
          {/* ============================================================== */}
          <div className="lg:col-span-7 space-y-4">
            
            {/* Search & Categories Bar */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search medicines by brand name, generic formula, or company..."
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50/70 border border-gray-200 rounded-xl text-sm focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 text-gray-900"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Category Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    className={`px-3 py-1.5 rounded-xl whitespace-nowrap font-medium transition ${
                      categoryFilter === cat
                        ? 'bg-teal-600 text-white shadow-xs'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Medicine Cards List */}
            <div className="space-y-3">
              {loading ? (
                <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400">
                  <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-teal-600" />
                  <p className="text-xs font-medium">Loading pharmacy catalogue...</p>
                </div>
              ) : filteredMedicines.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400 space-y-2">
                  <Package className="w-8 h-8 mx-auto text-gray-300" />
                  <p className="text-sm font-semibold text-gray-700">No matching medicines found</p>
                  <p className="text-xs text-gray-400">Try searching with a different brand or generic keyword.</p>
                </div>
              ) : (
                filteredMedicines.map((med) => {
                  const fefoBatch = getFefoBatch(med);
                  const totalStock = med.total_stock || 0;
                  const isOutOfStock = totalStock <= 0 || !fefoBatch;

                  return (
                    <div
                      key={med.id}
                      className={`bg-white rounded-2xl border p-4 transition shadow-xs hover:border-teal-300 ${
                        isOutOfStock ? 'opacity-60 bg-gray-50/50 border-gray-200' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-extrabold text-gray-900 leading-tight">
                              {med.name}
                            </h3>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-gray-100 text-gray-700">
                              {med.strength || med.category}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 font-medium">
                            {med.generic_name} • <span className="text-gray-400">{med.manufacturer}</span>
                          </p>
                        </div>

                        {/* Price & Stock Badge */}
                        <div className="text-right shrink-0">
                          <div className="text-sm font-black text-teal-700 font-mono">
                            ₹{(med.mrp || 0).toFixed(2)}
                          </div>
                          <div className="text-[10px] text-gray-400">
                            GST {med.tax_gst_percentage || 0}%
                          </div>
                        </div>
                      </div>

                      {/* FEFO Dispatch Recommendation Bar */}
                      <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                        {fefoBatch ? (
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase font-bold text-gray-400 flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-teal-600" />
                              Auto FEFO:
                            </span>
                            <span className="font-mono text-xs font-bold text-gray-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-lg">
                              B.No {fefoBatch.batch_number}
                            </span>
                            <span className="text-[11px] text-gray-500 font-mono">
                              Exp: {fefoBatch.expiry_date.slice(0, 7)}
                            </span>
                            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg">
                              {fefoBatch.quantity} in batch
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-rose-600 font-semibold flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5" /> Out of Stock / Expired
                          </span>
                        )}

                        {/* Add to Bill Button */}
                        <button
                          type="button"
                          disabled={isOutOfStock}
                          onClick={() => handleAddToCart(med)}
                          className={`flex items-center gap-1 px-3.5 py-1.5 rounded-xl text-xs font-bold transition shadow-xs ${
                            isOutOfStock
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : 'bg-teal-600 hover:bg-teal-700 text-white shadow-teal-100'
                          }`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add to Bill</span>
                        </button>
                      </div>

                    </div>
                  );
                })
              )}
            </div>

          </div>

          {/* ============================================================== */}
          {/* RIGHT COLUMN: PATIENT DETAILS & BILL CART (5 Cols)             */}
          {/* ============================================================== */}
          <div className="lg:col-span-5 space-y-4 sticky top-36">
            
            {/* Customer Details Card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-xs space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-teal-600" /> Patient &amp; Prescriber Info
              </h2>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[10px] font-bold text-gray-600 uppercase">Patient Name</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Walk-in Patient"
                    className="w-full mt-1 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-teal-500 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-600 uppercase">Phone Number</label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="9876543210"
                    className="w-full mt-1 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-teal-500 focus:outline-hidden"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] font-bold text-gray-600 uppercase">Doctor / Prescriber</label>
                  <input
                    type="text"
                    value={doctorName}
                    onChange={(e) => setDoctorName(e.target.value)}
                    placeholder="Dr. Self / Clinic Physician"
                    className="w-full mt-1 px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:ring-1 focus:ring-teal-500 focus:outline-hidden"
                  />
                </div>
              </div>
            </div>

            {/* Cart Items List */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden flex flex-col">
              
              <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <div className="flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-teal-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                    Current Bill Items ({cart.length})
                  </h3>
                </div>
                {cart.length > 0 && (
                  <button
                    onClick={handleClearCart}
                    className="text-[11px] font-semibold text-rose-600 hover:text-rose-800 transition"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {/* Items Scrollable List */}
              <div className="p-3 divide-y divide-gray-100 max-h-[320px] overflow-y-auto">
                {cart.length === 0 ? (
                  <div className="py-12 text-center text-gray-400 space-y-2">
                    <ShoppingCart className="w-8 h-8 mx-auto text-gray-300" />
                    <p className="text-xs font-medium text-gray-600">The counter cart is empty</p>
                    <p className="text-[11px] text-gray-400">Click &quot;Add to Bill&quot; on any medicine on the left.</p>
                  </div>
                ) : (
                  cart.map((item, idx) => (
                    <div key={`${item.medicine.id}-${item.batch.id}`} className="py-2.5 flex items-center justify-between gap-3">
                      
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-bold text-gray-900 truncate">{item.medicine.name}</h4>
                        <div className="flex items-center gap-2 text-[10px] text-gray-500 font-mono mt-0.5">
                          <span className="bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded font-semibold">
                            B.No: {item.batch.batch_number}
                          </span>
                          <span>Exp: {item.batch.expiry_date.slice(0, 7)}</span>
                        </div>
                      </div>

                      {/* Qty Controls */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(idx, item.quantity - 1)}
                          className="w-6 h-6 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center transition"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="w-7 text-center font-mono font-bold text-xs text-gray-900">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(idx, item.quantity + 1)}
                          className="w-6 h-6 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 flex items-center justify-center transition"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {/* Total */}
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold text-gray-900 font-mono">
                          ₹{(item.quantity * item.unit_price).toFixed(2)}
                        </p>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="text-[10px] text-gray-400 hover:text-rose-600 transition"
                        >
                          <Trash2 className="w-3 h-3 ml-auto" />
                        </button>
                      </div>

                    </div>
                  ))
                )}
              </div>

              {/* Payment Method Selector */}
              {cart.length > 0 && (
                <div className="p-4 border-t border-gray-100 bg-gray-50/30 space-y-3">
                  <div className="text-[10px] uppercase font-bold text-gray-500">
                    Payment Mode
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[
                      { id: 'cash', label: 'Cash', icon: Banknote },
                      { id: 'upi', label: 'UPI / GPay', icon: Smartphone },
                      { id: 'card', label: 'Card', icon: CreditCard },
                      { id: 'credit', label: 'Credit', icon: BookOpen },
                    ].map((p) => {
                      const Icon = p.icon;
                      const active = paymentMethod === p.id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setPaymentMethod(p.id as any)}
                          className={`p-2 rounded-xl flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition border ${
                            active
                              ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          <span>{p.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Discount Field */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-gray-600 font-medium">Special Discount (₹):</span>
                    <input
                      type="number"
                      min="0"
                      value={discountAmount || ''}
                      onChange={(e) => setDiscountAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                      placeholder="0.00"
                      className="w-24 px-2 py-1 bg-white border border-gray-200 rounded-lg text-right font-mono text-xs focus:ring-1 focus:ring-teal-500 focus:outline-hidden"
                    />
                  </div>

                  {/* Bill Financial Summary */}
                  <div className="pt-2 border-t border-gray-200 space-y-1.5 text-xs">
                    <div className="flex justify-between text-gray-500">
                      <span>Items Subtotal:</span>
                      <span className="font-mono text-gray-800">₹{subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>GST Output Tax:</span>
                      <span className="font-mono text-gray-800">+ ₹{totalTax.toFixed(2)}</span>
                    </div>
                    {discountAmount > 0 && (
                      <div className="flex justify-between text-emerald-600 font-semibold">
                        <span>Discount:</span>
                        <span className="font-mono">- ₹{discountAmount.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-black text-gray-900 pt-2 border-t border-gray-200">
                      <span>NET AMOUNT PAYABLE:</span>
                      <span className="text-base text-teal-700 font-mono">₹{grandTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Primary Action Button */}
                  <button
                    type="button"
                    disabled={isSubmitting || cart.length === 0}
                    onClick={handleGenerateBill}
                    className="w-full mt-2 py-3 px-4 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-extrabold transition shadow-lg shadow-teal-100 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Deducting Stock &amp; Generating Bill...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Complete Sale &amp; Print Bill (₹{grandTotal.toFixed(2)})</span>
                      </>
                    )}
                  </button>

                </div>
              )}

            </div>

          </div>

        </div>

      </main>

      {/* Printable Receipt Modal */}
      <ReceiptModal
        isOpen={receiptOpen}
        onClose={() => setReceiptOpen(false)}
        sale={completedSale}
        onNewSale={() => {
          setCart([]);
          setCompletedSale(null);
        }}
      />

      {/* Past Sales History Drawer */}
      {showHistory && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end">
          <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col p-6 space-y-4 animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-teal-600" />
                <h3 className="text-base font-bold text-gray-900">Recent Pharmacy Bills</h3>
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 divide-y divide-gray-100">
              {loadingHistory ? (
                <div className="py-12 text-center text-gray-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-teal-600" />
                  <p className="text-xs">Loading sales history...</p>
                </div>
              ) : recentSales.length === 0 ? (
                <div className="py-12 text-center text-gray-400 text-xs">
                  No sales bills generated yet today.
                </div>
              ) : (
                recentSales.map((s) => (
                  <div key={s.id} className="pt-3 first:pt-0 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-gray-900">{s.bill_number}</span>
                      <span className="font-mono text-xs font-bold text-teal-700">₹{s.net_amount.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-gray-500">
                      <span>{s.customer_name || 'Walk-in'} • {s.payment_method.toUpperCase()}</span>
                      <span>{new Date(s.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div className="pt-1 flex justify-end">
                      <button
                        onClick={() => {
                          setCompletedSale(s);
                          setReceiptOpen(true);
                        }}
                        className="text-[11px] font-bold text-teal-700 hover:text-teal-900 flex items-center gap-1"
                      >
                        <Printer className="w-3 h-3" />
                        <span>View / Reprint Bill</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
