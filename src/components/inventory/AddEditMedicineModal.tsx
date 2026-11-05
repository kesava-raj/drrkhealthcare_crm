'use client';

import React, { useState, useEffect } from 'react';
import { Medicine, Supplier } from '@/types/database';
import { useAuth } from '@/lib/auth-context';
import { X, Save, AlertCircle } from 'lucide-react';

interface AddEditMedicineModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  medicine?: Medicine | null;
  suppliers: Supplier[];
  onSaveMedicine: (data: Partial<Medicine>) => Promise<{ success: boolean; error?: string }>;
}

const CATEGORIES = [
  'Tablet',
  'Capsule',
  'Syrup',
  'Suspension',
  'Injection',
  'Ointment / Gel',
  'Eye / Ear Drops',
  'Inhaler / Rotacap',
  'Powder / Sachet',
  'IV Infusion',
  'Other',
];

export default function AddEditMedicineModal({
  isOpen,
  onClose,
  onSaved,
  medicine,
  suppliers,
  onSaveMedicine,
}: AddEditMedicineModalProps) {
  const { canEditInventory } = useAuth();
  const currencySymbol = process.env.NEXT_PUBLIC_CURRENCY_SYMBOL || '₹';

  const [name, setName] = useState('');
  const [genericName, setGenericName] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [category, setCategory] = useState('Tablet');
  const [strength, setStrength] = useState('');
  const [unitPackSize, setUnitPackSize] = useState('');
  const [hsnCode, setHSNCode] = useState('30049099');
  const [taxGstPercentage, setTaxGstPercentage] = useState(12);
  const [mrp, setMRP] = useState('');
  const [defaultSupplierId, setDefaultSupplierId] = useState('');
  const [reorderLevel, setReorderLevel] = useState(20);
  const [prescriptionRequired, setPrescriptionRequired] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (medicine) {
      setName(medicine.name || '');
      setGenericName(medicine.generic_name || '');
      setManufacturer(medicine.manufacturer || '');
      setCategory(medicine.category || 'Tablet');
      setStrength(medicine.strength || '');
      setUnitPackSize(medicine.unit_pack_size || '');
      setHSNCode(medicine.hsn_code || '30049099');
      setTaxGstPercentage(medicine.tax_gst_percentage ?? 12);
      setMRP(medicine.mrp !== undefined ? String(medicine.mrp) : '');
      setDefaultSupplierId(medicine.default_supplier_id || '');
      setReorderLevel(medicine.reorder_level ?? 20);
      setPrescriptionRequired(medicine.prescription_required ?? false);
    } else {
      setName('');
      setGenericName('');
      setManufacturer('');
      setCategory('Tablet');
      setStrength('');
      setUnitPackSize('10 Tablets/Strip');
      setHSNCode('30049099');
      setTaxGstPercentage(12);
      setMRP('');
      setDefaultSupplierId('');
      setReorderLevel(20);
      setPrescriptionRequired(false);
    }
    setError(null);
  }, [medicine, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditInventory) {
      setError('Permission denied: Your role cannot edit medicine records.');
      return;
    }

    if (!name.trim() || !genericName.trim() || !manufacturer.trim()) {
      setError('Please fill in Brand Name, Generic Composition, and Manufacturer.');
      return;
    }

    const parsedMRP = parseFloat(mrp);
    if (isNaN(parsedMRP) || parsedMRP < 0) {
      setError('Please enter a valid MRP (maximum retail price).');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const payload: Partial<Medicine> = {
      ...(medicine?.id ? { id: medicine.id } : {}),
      name: name.trim(),
      generic_name: genericName.trim(),
      manufacturer: manufacturer.trim(),
      category,
      strength: strength.trim() || 'Standard',
      unit_pack_size: unitPackSize.trim() || '1 Unit',
      hsn_code: hsnCode.trim(),
      tax_gst_percentage: Number(taxGstPercentage),
      mrp: parsedMRP,
      default_supplier_id: defaultSupplierId || null,
      reorder_level: Number(reorderLevel),
      prescription_required: prescriptionRequired,
    };

    const res = await onSaveMedicine(payload);
    setIsSubmitting(false);

    if (res.success) {
      onSaved();
      onClose();
    } else {
      setError(res.error || 'Failed to save medicine');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div>
            <h3 className="text-lg font-bold text-gray-900">
              {medicine ? 'Edit Medicine Master' : 'Add New Medicine'}
            </h3>
            <p className="text-xs text-gray-500">
              Master catalog entry. Specific batch quantities are added next.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Brand / Trade Name */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Brand / Trade Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Dolo 650, Augmentin 625"
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:outline-hidden transition text-gray-900 bg-white"
              />
            </div>

            {/* Generic / Chemical Name */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Generic Composition <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={genericName}
                onChange={(e) => setGenericName(e.target.value)}
                placeholder="e.g. Paracetamol, Amoxicillin"
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:outline-hidden transition text-gray-900 bg-white"
              />
            </div>

            {/* Manufacturer */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Manufacturer / Pharma Company <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
                placeholder="e.g. Micro Labs, GSK, Cipla"
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:outline-hidden transition text-gray-900 bg-white"
              />
            </div>

            {/* Category */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Dosage Form / Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:outline-hidden transition text-gray-900 bg-white"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* Strength */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Strength / Potency
              </label>
              <input
                type="text"
                value={strength}
                onChange={(e) => setStrength(e.target.value)}
                placeholder="e.g. 650mg, 500mg/5ml, 100mcg"
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:outline-hidden transition text-gray-900 bg-white"
              />
            </div>

            {/* Unit / Pack Size */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Unit / Pack Size
              </label>
              <input
                type="text"
                value={unitPackSize}
                onChange={(e) => setUnitPackSize(e.target.value)}
                placeholder="e.g. 15 Tablets/Strip, 100ml Bottle"
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:outline-hidden transition text-gray-900 bg-white"
              />
            </div>

            {/* MRP */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Standard MRP ({currencySymbol}) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={mrp}
                onChange={(e) => setMRP(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:outline-hidden transition text-gray-900 bg-white font-mono"
              />
            </div>

            {/* Tax / GST % */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                GST / Tax Rate (%)
              </label>
              <select
                value={taxGstPercentage}
                onChange={(e) => setTaxGstPercentage(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:outline-hidden transition text-gray-900 bg-white"
              >
                <option value="0">0% (Nil / Exempt)</option>
                <option value="5">5% (Essential Drugs & Devices)</option>
                <option value="12">12% (Standard Medicines)</option>
                <option value="18">18% (Supplements & Disinfectants)</option>
                <option value="28">28% (Luxury / Cosmetics)</option>
              </select>
            </div>

            {/* HSN Code */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                HSN Code
              </label>
              <input
                type="text"
                value={hsnCode}
                onChange={(e) => setHSNCode(e.target.value)}
                placeholder="3004"
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:outline-hidden transition text-gray-900 bg-white"
              />
            </div>

            {/* Reorder Level */}
            <div>
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Reorder Alert Threshold
              </label>
              <input
                type="number"
                min="1"
                value={reorderLevel}
                onChange={(e) => setReorderLevel(Number(e.target.value))}
                placeholder="20"
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:outline-hidden transition text-gray-900 bg-white"
              />
            </div>

            {/* Default Supplier */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-gray-700 mb-1">
                Primary / Default Supplier
              </label>
              <select
                value={defaultSupplierId}
                onChange={(e) => setDefaultSupplierId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-teal-500 focus:outline-hidden transition text-gray-900 bg-white"
              >
                <option value="">-- Select Preferred Distributor --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.contact_person ? `(${s.contact_person})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Prescription Required Toggle */}
            <div className="sm:col-span-2 flex items-center gap-3 p-3 bg-teal-50/50 border border-teal-100 rounded-xl">
              <input
                type="checkbox"
                id="prescriptionRequired"
                checked={prescriptionRequired}
                onChange={(e) => setPrescriptionRequired(e.target.checked)}
                className="w-4 h-4 text-teal-600 rounded-sm border-gray-300 focus:ring-teal-500"
              />
              <label htmlFor="prescriptionRequired" className="text-xs text-gray-700 select-none cursor-pointer">
                <span className="font-bold text-teal-900 block">Schedule H / H1 / Rx Prescription Required</span>
                Check this if a registered medical practitioner prescription is mandated by law before dispensing.
              </label>
            </div>
          </div>

          {/* Modal Footer */}
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
              <span>{isSubmitting ? 'Saving...' : medicine ? 'Save Changes' : 'Create Medicine'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
