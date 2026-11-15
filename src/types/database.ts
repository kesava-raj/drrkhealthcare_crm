export type AppRole = 'admin' | 'pharmacist' | 'accountant';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
  phone?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact_person?: string | null;
  phone?: string | null;
  email?: string | null;
  gstin?: string | null;
  address?: string | null;
  dl_number?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Medicine {
  id: string;
  name: string;
  generic_name: string;
  manufacturer: string;
  category: string; // 'Tablet', 'Capsule', 'Syrup', 'Injection', 'Ointment', 'Drops', 'Inhaler', etc.
  strength: string;
  unit_pack_size: string;
  hsn_code: string;
  tax_gst_percentage: number;
  mrp: number;
  default_supplier_id?: string | null;
  reorder_level: number;
  prescription_required: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Computed / joined fields
  batches?: Batch[];
  total_stock?: number;
  has_expired?: boolean;
  has_expiring_soon?: boolean;
  is_low_stock?: boolean;
}

export interface Batch {
  id: string;
  medicine_id: string;
  batch_number: string;
  expiry_date: string; // YYYY-MM-DD
  quantity: number;
  purchase_price: number;
  mrp: number;
  supplier_id?: string | null;
  storage_location?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  // Computed helpers
  days_to_expiry?: number;
  expiry_status?: 'expired' | 'expiring_soon' | 'healthy';
}

export interface StockMovement {
  id: string;
  medicine_id: string;
  batch_id?: string | null;
  movement_type: 'initial' | 'purchase' | 'sale' | 'adjustment' | 'return' | 'expired_disposal';
  quantity_change: number;
  balance_after: number;
  reason?: string | null;
  reference_id?: string | null;
  created_by?: string | null;
  created_at: string;
  // Joined display fields
  medicine_name?: string;
  batch_number?: string;
  created_by_name?: string;
}

export interface AuditLogEntry {
  id: string;
  table_name: string;
  record_id: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'SOFT_DELETE';
  old_data?: Record<string, unknown> | null;
  new_data?: Record<string, unknown> | null;
  changed_by?: string | null;
  changed_by_name?: string | null;
  changed_at: string;
}

export interface AppSetting {
  key: string;
  value: string;
  description?: string;
}
