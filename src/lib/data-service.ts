import { Medicine, Batch, Supplier, Profile, AuditLogEntry, StockMovement } from '@/types/database';
import { createClient } from './supabase/client';
import { INITIAL_MEDICINES, INITIAL_BATCHES, INITIAL_SUPPLIERS, INITIAL_TEST_PROFILES, INITIAL_AUDIT_LOGS } from './mockData';

// Local storage key for offline persistence when Supabase keys are not set yet
const STORAGE_KEY_MEDICINES = 'drrk_pharmacy_medicines';
const STORAGE_KEY_BATCHES = 'drrk_pharmacy_batches';
const STORAGE_KEY_SUPPLIERS = 'drrk_pharmacy_suppliers';
const STORAGE_KEY_AUDIT = 'drrk_pharmacy_audit';
const STORAGE_KEY_USERS = 'drrk_pharmacy_users';
const STORAGE_KEY_MOVEMENTS = 'drrk_pharmacy_stock_movements';

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_URL.startsWith('http') &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length > 20
  );
}

// In-browser local storage helpers for demo mode
function getLocal<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
}

function setLocal<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn('LocalStorage error:', e);
  }
}

// ----------------------------------------------------------------------
// MEDICINES & BATCHES
// ----------------------------------------------------------------------

export async function fetchMedicines(): Promise<Medicine[]> {
  const configured = isSupabaseConfigured();

  if (configured) {
    // In browser, call our secure server API route which uses service role key
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch('/api/inventory');
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.medicines) && json.medicines.length > 0) {
            return processMedicinesWithBatches(json.medicines, json.batches || []);
          }
        }
      } catch (e) {
        console.warn('API /api/inventory fetch failed, trying direct client:', e);
      }
    }

    const supabase = createClient();
    if (supabase) {
      try {
        const { data: medicinesData, error: medError } = await supabase
          .from('medicines')
          .select('*')
          .eq('is_active', true)
          .order('name');

        if (!medError && medicinesData && medicinesData.length > 0) {
          const { data: batchesData } = await supabase
            .from('batches')
            .select('*')
            .eq('is_active', true)
            .order('expiry_date', { ascending: true });

          return processMedicinesWithBatches(medicinesData, batchesData || []);
        }
      } catch (err) {
        console.error('Supabase fetch failed, falling back to local data:', err);
      }
    }
  }

  // Fallback to local storage or initial seed
  const localMeds = getLocal<Medicine[]>(STORAGE_KEY_MEDICINES, INITIAL_MEDICINES);
  const localBatches = getLocal<Batch[]>(STORAGE_KEY_BATCHES, INITIAL_BATCHES);
  return processMedicinesWithBatches(localMeds, localBatches);
}

export async function fetchMedicineById(id: string): Promise<Medicine | null> {
  const all = await fetchMedicines();
  return all.find((m) => m.id === id) || null;
}

export async function saveMedicine(
  medicineData: Partial<Medicine>,
  currentUser?: { id: string; name: string }
): Promise<{ success: boolean; data?: Medicine; error?: string }> {
  const configured = isSupabaseConfigured();
  const supabase = configured ? createClient() : null;

  if (supabase) {
    try {
      if (medicineData.id) {
        // Update
        const { data, error } = await supabase
          .from('medicines')
          .update({
            name: medicineData.name,
            generic_name: medicineData.generic_name,
            manufacturer: medicineData.manufacturer,
            category: medicineData.category,
            strength: medicineData.strength,
            unit_pack_size: medicineData.unit_pack_size,
            hsn_code: medicineData.hsn_code,
            tax_gst_percentage: medicineData.tax_gst_percentage,
            mrp: medicineData.mrp,
            default_supplier_id: medicineData.default_supplier_id || null,
            reorder_level: medicineData.reorder_level,
            prescription_required: medicineData.prescription_required,
            updated_at: new Date().toISOString(),
          })
          .eq('id', medicineData.id)
          .select()
          .single();

        if (error) throw error;
        return { success: true, data };
      } else {
        // Insert
        const { data, error } = await supabase
          .from('medicines')
          .insert({
            name: medicineData.name,
            generic_name: medicineData.generic_name,
            manufacturer: medicineData.manufacturer,
            category: medicineData.category,
            strength: medicineData.strength,
            unit_pack_size: medicineData.unit_pack_size,
            hsn_code: medicineData.hsn_code || '3004',
            tax_gst_percentage: medicineData.tax_gst_percentage || 12,
            mrp: medicineData.mrp || 0,
            default_supplier_id: medicineData.default_supplier_id || null,
            reorder_level: medicineData.reorder_level ?? 20,
            prescription_required: medicineData.prescription_required || false,
            is_active: true,
          })
          .select()
          .single();

        if (error) throw error;
        return { success: true, data };
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Database error';
      return { success: false, error: message };
    }
  }

  // Local storage fallback
  const meds = getLocal<Medicine[]>(STORAGE_KEY_MEDICINES, INITIAL_MEDICINES);
  let updatedMed: Medicine;

  if (medicineData.id) {
    const idx = meds.findIndex((m) => m.id === medicineData.id);
    if (idx >= 0) {
      updatedMed = { ...meds[idx], ...medicineData, updated_at: new Date().toISOString() };
      meds[idx] = updatedMed;
      recordMockAudit('medicines', updatedMed.id, 'UPDATE', meds[idx], updatedMed, currentUser);
    } else {
      return { success: false, error: 'Medicine not found' };
    }
  } else {
    updatedMed = {
      id: 'med-' + Date.now(),
      name: medicineData.name || '',
      generic_name: medicineData.generic_name || '',
      manufacturer: medicineData.manufacturer || '',
      category: medicineData.category || 'Tablet',
      strength: medicineData.strength || '',
      unit_pack_size: medicineData.unit_pack_size || '',
      hsn_code: medicineData.hsn_code || '3004',
      tax_gst_percentage: medicineData.tax_gst_percentage || 12,
      mrp: medicineData.mrp || 0,
      default_supplier_id: medicineData.default_supplier_id || null,
      reorder_level: medicineData.reorder_level ?? 20,
      prescription_required: medicineData.prescription_required || false,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    meds.unshift(updatedMed);
    recordMockAudit('medicines', updatedMed.id, 'INSERT', null, updatedMed, currentUser);
  }

  setLocal(STORAGE_KEY_MEDICINES, meds);
  return { success: true, data: updatedMed };
}

export async function softDeleteMedicine(
  id: string,
  currentUser?: { id: string; name: string }
): Promise<{ success: boolean; error?: string }> {
  const configured = isSupabaseConfigured();
  const supabase = configured ? createClient() : null;

  if (supabase) {
    try {
      const { error } = await supabase
        .from('medicines')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Delete error';
      return { success: false, error: message };
    }
  }

  // Local storage fallback
  const meds = getLocal<Medicine[]>(STORAGE_KEY_MEDICINES, INITIAL_MEDICINES);
  const med = meds.find((m) => m.id === id);
  if (med) {
    med.is_active = false;
    setLocal(STORAGE_KEY_MEDICINES, meds);
    recordMockAudit('medicines', id, 'SOFT_DELETE', { is_active: true }, { is_active: false }, currentUser);
  }
  return { success: true };
}

// ----------------------------------------------------------------------
// BATCH MANAGEMENT
// ----------------------------------------------------------------------

export async function saveBatch(
  batchData: Partial<Batch>,
  currentUser?: { id: string; name: string }
): Promise<{ success: boolean; data?: Batch; error?: string }> {
  const configured = isSupabaseConfigured();
  const supabase = configured ? createClient() : null;

  if (supabase) {
    try {
      if (batchData.id) {
        // Update batch
        const { data, error } = await supabase
          .from('batches')
          .update({
            batch_number: batchData.batch_number,
            expiry_date: batchData.expiry_date,
            quantity: batchData.quantity,
            purchase_price: batchData.purchase_price,
            mrp: batchData.mrp,
            supplier_id: batchData.supplier_id || null,
            storage_location: batchData.storage_location || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', batchData.id)
          .select()
          .single();

        if (error) throw error;
        return { success: true, data };
      } else {
        // Insert batch
        const { data, error } = await supabase
          .from('batches')
          .insert({
            medicine_id: batchData.medicine_id,
            batch_number: batchData.batch_number,
            expiry_date: batchData.expiry_date,
            quantity: batchData.quantity || 0,
            purchase_price: batchData.purchase_price || 0,
            mrp: batchData.mrp || 0,
            supplier_id: batchData.supplier_id || null,
            storage_location: batchData.storage_location || null,
            is_active: true,
          })
          .select()
          .single();

        if (error) throw error;

        // Record stock movement
        if (data && batchData.quantity) {
          await supabase.from('stock_movements').insert({
            medicine_id: batchData.medicine_id,
            batch_id: data.id,
            movement_type: 'initial',
            quantity_change: batchData.quantity,
            balance_after: batchData.quantity,
            reason: 'Batch creation',
            created_by: currentUser?.id || null,
          });
        }

        return { success: true, data };
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Database error';
      return { success: false, error: message };
    }
  }

  // Local storage fallback
  const batches = getLocal<Batch[]>(STORAGE_KEY_BATCHES, INITIAL_BATCHES);
  let updatedBatch: Batch;

  if (batchData.id) {
    const idx = batches.findIndex((b) => b.id === batchData.id);
    if (idx >= 0) {
      updatedBatch = { ...batches[idx], ...batchData, updated_at: new Date().toISOString() };
      batches[idx] = updatedBatch;
      recordMockAudit('batches', updatedBatch.id, 'UPDATE', batches[idx], updatedBatch, currentUser);
    } else {
      return { success: false, error: 'Batch not found' };
    }
  } else {
    updatedBatch = {
      id: 'batch-' + Date.now(),
      medicine_id: batchData.medicine_id!,
      batch_number: batchData.batch_number || '',
      expiry_date: batchData.expiry_date || new Date().toISOString().split('T')[0],
      quantity: batchData.quantity || 0,
      purchase_price: batchData.purchase_price || 0,
      mrp: batchData.mrp || 0,
      supplier_id: batchData.supplier_id || null,
      storage_location: batchData.storage_location || 'General Shelf',
      is_active: true,
      created_at: new Date().toISOString(),
    };
    batches.push(updatedBatch);
    recordMockAudit('batches', updatedBatch.id, 'INSERT', null, updatedBatch, currentUser);
  }

  setLocal(STORAGE_KEY_BATCHES, batches);
  return { success: true, data: updatedBatch };
}

export async function softDeleteBatch(
  id: string,
  currentUser?: { id: string; name: string }
): Promise<{ success: boolean; error?: string }> {
  const configured = isSupabaseConfigured();
  const supabase = configured ? createClient() : null;

  if (supabase) {
    try {
      const { error } = await supabase
        .from('batches')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Delete error';
      return { success: false, error: message };
    }
  }

  // Local fallback
  const batches = getLocal<Batch[]>(STORAGE_KEY_BATCHES, INITIAL_BATCHES);
  const b = batches.find((item) => item.id === id);
  if (b) {
    b.is_active = false;
    setLocal(STORAGE_KEY_BATCHES, batches);
    recordMockAudit('batches', id, 'SOFT_DELETE', { is_active: true }, { is_active: false }, currentUser);
  }
  return { success: true };
}

// ----------------------------------------------------------------------
// SUPPLIERS
// ----------------------------------------------------------------------

export async function fetchSuppliers(): Promise<Supplier[]> {
  const configured = isSupabaseConfigured();

  if (configured) {
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch('/api/suppliers');
        if (res.ok) {
          const json = await res.json();
          if (json.success && Array.isArray(json.suppliers) && json.suppliers.length > 0) {
            return json.suppliers;
          }
        }
      } catch (e) {
        console.warn('API /api/suppliers fetch failed:', e);
      }
    }

    const supabase = createClient();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('suppliers')
          .select('*')
          .eq('is_active', true)
          .order('name');

        if (!error && data && data.length > 0) return data;
      } catch (e) {
        console.error('Fetch suppliers failed:', e);
      }
    }
  }

  return getLocal<Supplier[]>(STORAGE_KEY_SUPPLIERS, INITIAL_SUPPLIERS);
}

// ----------------------------------------------------------------------
// USERS MANAGEMENT (Admin only)
// ----------------------------------------------------------------------

export async function fetchUsers(): Promise<Profile[]> {
  const configured = isSupabaseConfigured();
  const supabase = configured ? createClient() : null;

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) return data;
    } catch (e) {
      console.error('Fetch users error:', e);
    }
  }

  return getLocal<Profile[]>(STORAGE_KEY_USERS, INITIAL_TEST_PROFILES);
}

export async function updateUserRole(
  userId: string,
  role: 'admin' | 'pharmacist' | 'accountant',
  currentUser?: { id: string; name: string }
): Promise<{ success: boolean; error?: string }> {
  const configured = isSupabaseConfigured();
  const supabase = configured ? createClient() : null;

  if (supabase) {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (error) throw error;
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Role update error';
      return { success: false, error: message };
    }
  }

  // Local fallback
  const users = getLocal<Profile[]>(STORAGE_KEY_USERS, INITIAL_TEST_PROFILES);
  const u = users.find((item) => item.id === userId);
  if (u) {
    const oldRole = u.role;
    u.role = role;
    setLocal(STORAGE_KEY_USERS, users);
    recordMockAudit('profiles', userId, 'UPDATE', { role: oldRole }, { role }, currentUser);
  }
  return { success: true };
}

// ----------------------------------------------------------------------
// AUDIT LOG
// ----------------------------------------------------------------------

export async function fetchAuditLogs(): Promise<AuditLogEntry[]> {
  const configured = isSupabaseConfigured();
  const supabase = configured ? createClient() : null;

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .order('changed_at', { ascending: false })
        .limit(100);

      if (!error && data) return data;
    } catch (e) {
      console.error('Fetch audit log error:', e);
    }
  }

  return getLocal<AuditLogEntry[]>(STORAGE_KEY_AUDIT, INITIAL_AUDIT_LOGS);
}

function recordMockAudit(
  table: string,
  recordId: string,
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'SOFT_DELETE',
  oldData: unknown,
  newData: unknown,
  user?: { id: string; name: string }
) {
  const logs = getLocal<AuditLogEntry[]>(STORAGE_KEY_AUDIT, INITIAL_AUDIT_LOGS);
  logs.unshift({
    id: 'aud-' + Date.now(),
    table_name: table,
    record_id: recordId,
    action,
    old_data: oldData as Record<string, unknown> | null,
    new_data: newData as Record<string, unknown> | null,
    changed_by: user?.id,
    changed_by_name: user?.name || 'Local Staff',
    changed_at: new Date().toISOString(),
  });
  setLocal(STORAGE_KEY_AUDIT, logs.slice(0, 100));
}

// ----------------------------------------------------------------------
// STOCK IN / OUT MOVEMENTS (STOCK LEDGER)
// ----------------------------------------------------------------------

export interface StockMovementSummary {
  movements: StockMovement[];
  summary: {
    total_in: number;
    total_out: number;
    net_balance: number;
  };
}

export async function fetchStockMovements(medicineId?: string): Promise<StockMovementSummary> {
  const configured = isSupabaseConfigured();

  if (configured && typeof window !== 'undefined') {
    try {
      const url = medicineId
        ? `/api/stock-movements?medicine_id=${encodeURIComponent(medicineId)}`
        : '/api/stock-movements';
      const res = await fetch(url);
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          return {
            movements: json.movements || [],
            summary: json.summary || { total_in: 0, total_out: 0, net_balance: 0 },
          };
        }
      }
    } catch (e) {
      console.warn('API /api/stock-movements fetch failed:', e);
    }
  }

  // Fallback to local data
  const allMovements = getLocal<StockMovement[]>(STORAGE_KEY_MOVEMENTS, []);
  const filtered = medicineId ? allMovements.filter((m) => m.medicine_id === medicineId) : allMovements;
  let totalIn = 0;
  let totalOut = 0;
  filtered.forEach((m) => {
    if (m.quantity_change > 0) totalIn += m.quantity_change;
    else totalOut += Math.abs(m.quantity_change);
  });

  return {
    movements: filtered,
    summary: { total_in: totalIn, total_out: totalOut, net_balance: totalIn - totalOut },
  };
}

export async function recordStockMovement(data: {
  medicine_id: string;
  batch_id?: string | null;
  movement_type: 'initial' | 'purchase' | 'sale' | 'adjustment' | 'return' | 'expired_disposal';
  quantity_change: number;
  reason?: string;
  created_by?: string;
  user_name?: string;
}): Promise<{ success: boolean; movement?: StockMovement; error?: string }> {
  const configured = isSupabaseConfigured();

  if (configured && typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/stock-movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          return { success: true, movement: json.movement };
        }
      }
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  // Local fallback
  const allMovements = getLocal<StockMovement[]>(STORAGE_KEY_MOVEMENTS, []);
  const newMovement: StockMovement = {
    id: 'sm-' + Date.now(),
    medicine_id: data.medicine_id,
    batch_id: data.batch_id || null,
    movement_type: data.movement_type,
    quantity_change: data.quantity_change,
    balance_after: Math.max(0, data.quantity_change),
    reason: data.reason || 'Manual movement',
    created_by: data.created_by,
    created_by_name: data.user_name || 'Staff',
    created_at: new Date().toISOString(),
  };
  allMovements.unshift(newMovement);
  setLocal(STORAGE_KEY_MOVEMENTS, allMovements);

  return { success: true, movement: newMovement };
}

// ----------------------------------------------------------------------
// FEFO & ALERT COMPUTATION LOGIC
// ----------------------------------------------------------------------

function processMedicinesWithBatches(medicines: Medicine[], batches: Batch[]): Medicine[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Group active batches by medicine_id
  const batchMap: Record<string, Batch[]> = {};
  for (const b of batches) {
    if (b.is_active === false) continue;

    const expDate = new Date(b.expiry_date);
    expDate.setHours(0, 0, 0, 0);
    const diffTime = expDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    b.days_to_expiry = diffDays;
    if (diffDays <= 0) {
      b.expiry_status = 'expired'; // RED
    } else if (diffDays <= 90) {
      b.expiry_status = 'expiring_soon'; // AMBER
    } else {
      b.expiry_status = 'healthy';
    }

    if (!batchMap[b.medicine_id]) {
      batchMap[b.medicine_id] = [];
    }
    batchMap[b.medicine_id].push(b);
  }

  return medicines
    .filter((m) => m.is_active !== false)
    .map((m) => {
      // First-Expiry-First-Out (FEFO): sort ascending by expiry_date
      const medBatches = (batchMap[m.id] || []).sort(
        (a, b) => new Date(a.expiry_date).getTime() - new Date(b.expiry_date).getTime()
      );

      // Compute total active non-expired stock
      const totalStock = medBatches.reduce((acc, curr) => acc + (curr.quantity || 0), 0);
      const hasExpired = medBatches.some((b) => b.expiry_status === 'expired');
      const hasExpiringSoon = medBatches.some((b) => b.expiry_status === 'expiring_soon');
      const isLowStock = totalStock <= m.reorder_level;

      return {
        ...m,
        batches: medBatches,
        total_stock: totalStock,
        has_expired: hasExpired,
        has_expiring_soon: hasExpiringSoon,
        is_low_stock: isLowStock,
      };
    });
}
