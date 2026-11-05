-- ==============================================================================
-- PHARMACY INVENTORY & ACCOUNTING SYSTEM (STAGE 1 DATABASE SCHEMA & SEED DATA)
-- Compatible with Next.js, Supabase RLS, and Future Stages (Invoices, Sales, Ledger)
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUMS & SETTINGS
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE app_role AS ENUM ('admin', 'pharmacist', 'accountant');
  END IF;
END $$;

-- 3. PROFILES TABLE (Linked to Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'pharmacist',
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index for profile lookup
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- 4. APP SETTINGS TABLE (Currency, Pharmacy Details)
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

INSERT INTO public.app_settings (key, value, description)
VALUES 
  ('currency_symbol', '₹', 'Currency symbol used across the system'),
  ('currency_code', 'INR', 'ISO currency code'),
  ('pharmacy_name', 'DRRK Healthcare Pharmacy', 'Registered business name'),
  ('pharmacy_dl_number', 'DL-TN-CH-12345/20', 'Drug License Number'),
  ('pharmacy_gstin', '33AAAAA0000A1Z5', 'GSTIN Number')
ON CONFLICT (key) DO NOTHING;

-- 5. SUPPLIERS TABLE
CREATE TABLE IF NOT EXISTS public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  gstin TEXT,
  address TEXT,
  dl_number TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_suppliers_active ON public.suppliers(is_active);

-- 6. MEDICINES MASTER TABLE
CREATE TABLE IF NOT EXISTS public.medicines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  generic_name TEXT NOT NULL,
  manufacturer TEXT NOT NULL,
  category TEXT NOT NULL, -- 'Tablet', 'Capsule', 'Syrup', 'Injection', 'Ointment', 'Drops', 'Inhaler', 'Powder', 'Suspension', 'Other'
  strength TEXT NOT NULL, -- e.g. '500mg', '10mg/5ml'
  unit_pack_size TEXT NOT NULL, -- e.g. '10 Tablets/Strip', '100ml Bottle'
  hsn_code TEXT DEFAULT '3004',
  tax_gst_percentage NUMERIC(5, 2) NOT NULL DEFAULT 12.00,
  mrp NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  default_supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  reorder_level INTEGER NOT NULL DEFAULT 20,
  prescription_required BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_medicines_name ON public.medicines(name);
CREATE INDEX IF NOT EXISTS idx_medicines_generic ON public.medicines(generic_name);
CREATE INDEX IF NOT EXISTS idx_medicines_active ON public.medicines(is_active);

-- 7. BATCHES TABLE (Stock per Batch, FEFO)
CREATE TABLE IF NOT EXISTS public.batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medicine_id UUID NOT NULL REFERENCES public.medicines(id) ON DELETE RESTRICT,
  batch_number TEXT NOT NULL,
  expiry_date DATE NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  purchase_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  mrp NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  storage_location TEXT, -- e.g. 'Rack A - Shelf 2'
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT unique_medicine_batch UNIQUE (medicine_id, batch_number)
);

CREATE INDEX IF NOT EXISTS idx_batches_expiry ON public.batches(expiry_date ASC);
CREATE INDEX IF NOT EXISTS idx_batches_medicine ON public.batches(medicine_id);
CREATE INDEX IF NOT EXISTS idx_batches_active ON public.batches(is_active);

-- 8. STOCK MOVEMENTS TABLE (Immutable audit for every stock change)
CREATE TABLE IF NOT EXISTS public.stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  medicine_id UUID NOT NULL REFERENCES public.medicines(id),
  batch_id UUID REFERENCES public.batches(id),
  movement_type TEXT NOT NULL CHECK (movement_type IN ('initial', 'purchase', 'sale', 'adjustment', 'return', 'expired_disposal')),
  quantity_change INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  reason TEXT,
  reference_id UUID,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_medicine ON public.stock_movements(medicine_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_created ON public.stock_movements(created_at DESC);

-- 9. AUDIT LOG TABLE (Tamper-proof record of data modifications)
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE', 'SOFT_DELETE')),
  old_data JSONB,
  new_data JSONB,
  changed_by UUID REFERENCES public.profiles(id),
  changed_by_name TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_audit_table_record ON public.audit_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_changed_at ON public.audit_log(changed_at DESC);

-- 10. STAGE 2 FORWARD COMPATIBILITY: INVOICE IMAGES (AI Import)
CREATE TABLE IF NOT EXISTS public.invoice_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'extracted', 'reviewed', 'rejected')),
  ocr_raw_text TEXT,
  parsed_data JSONB,
  reviewed_by UUID REFERENCES public.profiles(id),
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 11. STAGE 3 FORWARD COMPATIBILITY: PURCHASES & PURCHASE ITEMS
CREATE TABLE IF NOT EXISTS public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id),
  invoice_date DATE NOT NULL,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'partial')),
  notes TEXT,
  invoice_image_id UUID REFERENCES public.invoice_images(id),
  created_by UUID REFERENCES public.profiles(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  medicine_id UUID NOT NULL REFERENCES public.medicines(id),
  batch_number TEXT NOT NULL,
  expiry_date DATE NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  mrp NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  tax_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 12. STAGE 3 FORWARD COMPATIBILITY: SALES & SALE ITEMS
CREATE TABLE IF NOT EXISTS public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_number TEXT NOT NULL UNIQUE,
  customer_name TEXT,
  customer_phone TEXT,
  doctor_name TEXT,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  net_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  payment_method TEXT NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash', 'card', 'upi', 'credit')),
  created_by UUID REFERENCES public.profiles(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  medicine_id UUID NOT NULL REFERENCES public.medicines(id),
  batch_id UUID NOT NULL REFERENCES public.batches(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  mrp NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  tax_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 13. STAGE 3 FORWARD COMPATIBILITY: ACCOUNTING LEDGER
CREATE TABLE IF NOT EXISTS public.ledger_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_code TEXT NOT NULL UNIQUE,
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'revenue', 'expense')),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference_type TEXT CHECK (reference_type IN ('sale', 'purchase', 'manual', 'expense', 'payment')),
  reference_id UUID,
  description TEXT NOT NULL,
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.journal_entry_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.ledger_accounts(id),
  debit NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  credit NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 14. HELPER FUNCTION: GET USER ROLE
CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id UUID)
RETURNS app_role
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role FROM public.profiles WHERE id = p_user_id AND is_active = TRUE;
$$;

-- 15. AUTOMATIC AUDIT LOG TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.process_audit_log()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_user_name TEXT;
  v_record_id TEXT;
  v_action TEXT;
  v_old_data JSONB;
  v_new_data JSONB;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NOT NULL THEN
    SELECT full_name INTO v_user_name FROM public.profiles WHERE id = v_user_id;
  ELSE
    v_user_name := 'System';
  END IF;

  IF (TG_OP = 'DELETE') THEN
    v_record_id := OLD.id::TEXT;
    v_action := 'DELETE';
    v_old_data := to_jsonb(OLD);
    v_new_data := NULL;
  ELSIF (TG_OP = 'UPDATE') THEN
    v_record_id := NEW.id::TEXT;
    IF (OLD.is_active = TRUE AND NEW.is_active = FALSE) THEN
      v_action := 'SOFT_DELETE';
    ELSE
      v_action := 'UPDATE';
    END IF;
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
  ELSIF (TG_OP = 'INSERT') THEN
    v_record_id := NEW.id::TEXT;
    v_action := 'INSERT';
    v_old_data := NULL;
    v_new_data := to_jsonb(NEW);
  END IF;

  INSERT INTO public.audit_log (
    table_name,
    record_id,
    action,
    old_data,
    new_data,
    changed_by,
    changed_by_name,
    changed_at
  ) VALUES (
    TG_TABLE_NAME,
    v_record_id,
    v_action,
    v_old_data,
    v_new_data,
    v_user_id,
    v_user_name,
    timezone('utc'::text, now())
  );

  IF (TG_OP = 'DELETE') THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Attach Audit Log Triggers
DROP TRIGGER IF EXISTS audit_medicines ON public.medicines;
CREATE TRIGGER audit_medicines
AFTER INSERT OR UPDATE OR DELETE ON public.medicines
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

DROP TRIGGER IF EXISTS audit_batches ON public.batches;
CREATE TRIGGER audit_batches
AFTER INSERT OR UPDATE OR DELETE ON public.batches
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

DROP TRIGGER IF EXISTS audit_suppliers ON public.suppliers;
CREATE TRIGGER audit_suppliers
AFTER INSERT OR UPDATE OR DELETE ON public.suppliers
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

DROP TRIGGER IF EXISTS audit_profiles ON public.profiles;
CREATE TRIGGER audit_profiles
AFTER INSERT OR UPDATE OR DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.process_audit_log();

-- 16. AUTH NEW USER HOOK: AUTOMATIC PROFILE CREATION
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'pharmacist')
  )
  ON CONFLICT (id) DO UPDATE
  SET email = EXCLUDED.email,
      full_name = EXCLUDED.full_name;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 17. ROW LEVEL SECURITY (RLS) POLICIES
-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entry_lines ENABLE ROW LEVEL SECURITY;

-- Clean existing policies
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_all" ON public.profiles;
DROP POLICY IF EXISTS "medicines_read" ON public.medicines;
DROP POLICY IF EXISTS "medicines_write" ON public.medicines;
DROP POLICY IF EXISTS "batches_read" ON public.batches;
DROP POLICY IF EXISTS "batches_write" ON public.batches;
DROP POLICY IF EXISTS "suppliers_read" ON public.suppliers;
DROP POLICY IF EXISTS "suppliers_write" ON public.suppliers;
DROP POLICY IF EXISTS "stock_movements_read" ON public.stock_movements;
DROP POLICY IF EXISTS "stock_movements_insert" ON public.stock_movements;
DROP POLICY IF EXISTS "audit_read" ON public.audit_log;
DROP POLICY IF EXISTS "settings_read" ON public.app_settings;
DROP POLICY IF EXISTS "settings_write" ON public.app_settings;
DROP POLICY IF EXISTS "ledger_accounts_read" ON public.ledger_accounts;
DROP POLICY IF EXISTS "ledger_accounts_write" ON public.ledger_accounts;
DROP POLICY IF EXISTS "journal_entries_read" ON public.journal_entries;
DROP POLICY IF EXISTS "journal_entries_write" ON public.journal_entries;
DROP POLICY IF EXISTS "purchases_read" ON public.purchases;
DROP POLICY IF EXISTS "purchases_write" ON public.purchases;
DROP POLICY IF EXISTS "sales_read" ON public.sales;
DROP POLICY IF EXISTS "sales_write" ON public.sales;

-- 17.1 PROFILES POLICIES
-- Any authenticated user can read their own profile; Admin can read all
CREATE POLICY "profiles_select" ON public.profiles
FOR SELECT TO authenticated
USING (id = auth.uid() OR public.get_user_role(auth.uid()) = 'admin');

-- Only Admin can update or insert profiles
CREATE POLICY "profiles_admin_all" ON public.profiles
FOR ALL TO authenticated
USING (public.get_user_role(auth.uid()) = 'admin')
WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

-- 17.2 SETTINGS POLICIES
-- All authenticated users can view settings
CREATE POLICY "settings_read" ON public.app_settings
FOR SELECT TO authenticated
USING (true);

-- Only Admin can update settings
CREATE POLICY "settings_write" ON public.app_settings
FOR ALL TO authenticated
USING (public.get_user_role(auth.uid()) = 'admin')
WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

-- 17.3 SUPPLIERS POLICIES
-- Admin, Pharmacist, Accountant can view active suppliers
CREATE POLICY "suppliers_read" ON public.suppliers
FOR SELECT TO authenticated
USING (is_active = TRUE OR public.get_user_role(auth.uid()) = 'admin');

-- Admin & Pharmacist can add/edit suppliers
CREATE POLICY "suppliers_write" ON public.suppliers
FOR ALL TO authenticated
USING (public.get_user_role(auth.uid()) IN ('admin', 'pharmacist'))
WITH CHECK (public.get_user_role(auth.uid()) IN ('admin', 'pharmacist'));

-- 17.4 MEDICINES POLICIES
-- Admin, Pharmacist, and Accountant can VIEW medicines
CREATE POLICY "medicines_read" ON public.medicines
FOR SELECT TO authenticated
USING (is_active = TRUE OR public.get_user_role(auth.uid()) = 'admin');

-- Admin & Pharmacist can ADD and UPDATE medicines (Accountant cannot edit!)
CREATE POLICY "medicines_write" ON public.medicines
FOR INSERT TO authenticated
WITH CHECK (public.get_user_role(auth.uid()) IN ('admin', 'pharmacist'));

CREATE POLICY "medicines_update" ON public.medicines
FOR UPDATE TO authenticated
USING (public.get_user_role(auth.uid()) IN ('admin', 'pharmacist'))
WITH CHECK (public.get_user_role(auth.uid()) IN ('admin', 'pharmacist'));

-- Only Admin can soft-delete/delete medicines (Pharmacist cannot delete records!)
CREATE POLICY "medicines_delete" ON public.medicines
FOR DELETE TO authenticated
USING (public.get_user_role(auth.uid()) = 'admin');

-- 17.5 BATCHES POLICIES
-- Admin, Pharmacist, and Accountant can VIEW batches
CREATE POLICY "batches_read" ON public.batches
FOR SELECT TO authenticated
USING (is_active = TRUE OR public.get_user_role(auth.uid()) = 'admin');

-- Admin & Pharmacist can ADD and UPDATE batches (Accountant cannot edit!)
CREATE POLICY "batches_insert" ON public.batches
FOR INSERT TO authenticated
WITH CHECK (public.get_user_role(auth.uid()) IN ('admin', 'pharmacist'));

CREATE POLICY "batches_update" ON public.batches
FOR UPDATE TO authenticated
USING (public.get_user_role(auth.uid()) IN ('admin', 'pharmacist'))
WITH CHECK (public.get_user_role(auth.uid()) IN ('admin', 'pharmacist'));

-- Only Admin can delete batches
CREATE POLICY "batches_delete" ON public.batches
FOR DELETE TO authenticated
USING (public.get_user_role(auth.uid()) = 'admin');

-- 17.6 STOCK MOVEMENTS POLICIES
-- Admin, Pharmacist, Accountant can view stock movements
CREATE POLICY "stock_movements_read" ON public.stock_movements
FOR SELECT TO authenticated
USING (true);

-- Admin and Pharmacist can record movements
CREATE POLICY "stock_movements_insert" ON public.stock_movements
FOR INSERT TO authenticated
WITH CHECK (public.get_user_role(auth.uid()) IN ('admin', 'pharmacist'));

-- 17.7 AUDIT LOG POLICIES (IMMUTABLE)
-- Admin and Accountant can read audit logs. No one can INSERT, UPDATE or DELETE directly (Triggers bypass via SECURITY DEFINER)
CREATE POLICY "audit_read" ON public.audit_log
FOR SELECT TO authenticated
USING (public.get_user_role(auth.uid()) IN ('admin', 'accountant'));

-- 17.8 ACCOUNTS & LEDGER (STAGE 3)
-- Admin & Accountant can view and manage; Pharmacist CANNOT see accounts register!
CREATE POLICY "ledger_accounts_read" ON public.ledger_accounts
FOR SELECT TO authenticated
USING (public.get_user_role(auth.uid()) IN ('admin', 'accountant'));

CREATE POLICY "ledger_accounts_write" ON public.ledger_accounts
FOR ALL TO authenticated
USING (public.get_user_role(auth.uid()) IN ('admin', 'accountant'))
WITH CHECK (public.get_user_role(auth.uid()) IN ('admin', 'accountant'));

CREATE POLICY "journal_entries_read" ON public.journal_entries
FOR SELECT TO authenticated
USING (public.get_user_role(auth.uid()) IN ('admin', 'accountant'));

CREATE POLICY "journal_entries_write" ON public.journal_entries
FOR ALL TO authenticated
USING (public.get_user_role(auth.uid()) IN ('admin', 'accountant'))
WITH CHECK (public.get_user_role(auth.uid()) IN ('admin', 'accountant'));

CREATE POLICY "journal_entry_lines_read" ON public.journal_entry_lines
FOR SELECT TO authenticated
USING (public.get_user_role(auth.uid()) IN ('admin', 'accountant'));

CREATE POLICY "journal_entry_lines_write" ON public.journal_entry_lines
FOR ALL TO authenticated
USING (public.get_user_role(auth.uid()) IN ('admin', 'accountant'))
WITH CHECK (public.get_user_role(auth.uid()) IN ('admin', 'accountant'));

-- 17.9 PURCHASES & SALES
CREATE POLICY "purchases_read" ON public.purchases
FOR SELECT TO authenticated
USING (public.get_user_role(auth.uid()) IN ('admin', 'accountant', 'pharmacist'));

CREATE POLICY "purchases_write" ON public.purchases
FOR ALL TO authenticated
USING (public.get_user_role(auth.uid()) IN ('admin', 'pharmacist'))
WITH CHECK (public.get_user_role(auth.uid()) IN ('admin', 'pharmacist'));

CREATE POLICY "sales_read" ON public.sales
FOR SELECT TO authenticated
USING (public.get_user_role(auth.uid()) IN ('admin', 'accountant', 'pharmacist'));

CREATE POLICY "sales_write" ON public.sales
FOR ALL TO authenticated
USING (public.get_user_role(auth.uid()) IN ('admin', 'pharmacist'))
WITH CHECK (public.get_user_role(auth.uid()) IN ('admin', 'pharmacist'));

-- ==============================================================================
-- 18. REALISTIC SEED DATA (SUPPLIERS, 30 MEDICINES, BATCHES WITH ALERTS)
-- ==============================================================================

-- 18.1 SUPPLIERS SEED
INSERT INTO public.suppliers (id, name, contact_person, phone, email, gstin, address, dl_number)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'Sun Pharma Distributors', 'Ramesh Kumar', '+91 98765 43210', 'orders@sunpharma-dist.com', '33AAACS1234A1Z1', '12 Industrial Estate, Guindy, Chennai', 'DL-20B-112233'),
  ('22222222-2222-2222-2222-222222222222', 'Cipla Medline Agencies', 'Suresh Reddy', '+91 98450 11223', 'contact@medlineagencies.in', '33AACCC5678B2Z4', '45 North Usman Road, T. Nagar, Chennai', 'DL-20B-445566'),
  ('33333333-3333-3333-3333-333333333333', 'Apollo Pharma Logistics', 'Kavitha Mohan', '+91 94440 99887', 'supply@apollopharma.com', '33AABCA9012C1Z8', '88 Poonamallee High Road, Chennai', 'DL-21B-778899'),
  ('44444444-4444-4444-4444-444444444444', 'Torrent Pharma Wholesalers', 'Anand Verma', '+91 97890 55443', 'orders@torrentwholesale.com', '33AAACT3456D1Z2', '102 Mount Road, Anna Salai, Chennai', 'DL-20B-990011')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- 18.2 MEDICINES (30 REALISTIC PHARMACY MEDICINES)
INSERT INTO public.medicines (id, name, generic_name, manufacturer, category, strength, unit_pack_size, hsn_code, tax_gst_percentage, mrp, default_supplier_id, reorder_level, prescription_required)
VALUES
  -- 1 to 5: Analgesics & Antipyretics
  ('aaaaaaaa-0001-0000-0000-000000000000', 'Dolo 650', 'Paracetamol', 'Micro Labs Ltd', 'Tablet', '650mg', '15 Tablets/Strip', '30049060', 12.00, 34.00, '11111111-1111-1111-1111-111111111111', 50, false),
  ('aaaaaaaa-0002-0000-0000-000000000000', 'Zerodol-P', 'Aceclofenac + Paracetamol', 'Ipca Laboratories', 'Tablet', '100mg + 325mg', '10 Tablets/Strip', '30049060', 12.00, 72.50, '11111111-1111-1111-1111-111111111111', 30, true),
  ('aaaaaaaa-0003-0000-0000-000000000000', 'Meftal-Spas', 'Mefenamic Acid + Dicyclomine', 'Blue Cross Laboratories', 'Tablet', '250mg + 10mg', '10 Tablets/Strip', '30049060', 12.00, 56.00, '22222222-2222-2222-2222-222222222222', 20, true),
  ('aaaaaaaa-0004-0000-0000-000000000000', 'Brufen 400', 'Ibuprofen', 'Abbott India Ltd', 'Tablet', '400mg', '15 Tablets/Strip', '30049060', 12.00, 24.80, '22222222-2222-2222-2222-222222222222', 25, false),
  ('aaaaaaaa-0005-0000-0000-000000000000', 'Calpol 250 Pead', 'Paracetamol Suspension', 'GSK Pharmaceuticals', 'Syrup', '250mg/5ml', '60ml Bottle', '30049060', 12.00, 48.00, '33333333-3333-3333-3333-333333333333', 15, false),

  -- 6 to 10: Antibiotics & Anti-infectives
  ('aaaaaaaa-0006-0000-0000-000000000000', 'Augmentin 625 Duo', 'Amoxicillin + Clavulanic Acid', 'GSK Pharmaceuticals', 'Tablet', '500mg + 125mg', '10 Tablets/Strip', '30042010', 12.00, 223.50, '11111111-1111-1111-1111-111111111111', 20, true),
  ('aaaaaaaa-0007-0000-0000-000000000000', 'Azithral 500', 'Azithromycin', 'Alembic Pharmaceuticals', 'Tablet', '500mg', '5 Tablets/Strip', '30042099', 12.00, 131.00, '11111111-1111-1111-1111-111111111111', 25, true),
  ('aaaaaaaa-0008-0000-0000-000000000000', 'Taxim-O 200', 'Cefixime', 'Alkem Laboratories', 'Tablet', '200mg', '10 Tablets/Strip', '30042099', 12.00, 184.00, '22222222-2222-2222-2222-222222222222', 15, true),
  ('aaaaaaaa-0009-0000-0000-000000000000', 'Ciplox 500', 'Ciprofloxacin', 'Cipla Ltd', 'Tablet', '500mg', '10 Tablets/Strip', '30042099', 12.00, 45.20, '22222222-2222-2222-2222-222222222222', 20, true),
  ('aaaaaaaa-0010-0000-0000-000000000000', 'Doxt-SL', 'Doxycycline + Lactic Acid Bacillus', 'Dr. Reddy''s Laboratories', 'Capsule', '100mg', '10 Capsules/Strip', '30042099', 12.00, 115.00, '33333333-3333-3333-3333-333333333333', 15, true),

  -- 11 to 15: Gastrointestinal & Acidity
  ('aaaaaaaa-0011-0000-0000-000000000000', 'Pan 40', 'Pantoprazole', 'Alkem Laboratories', 'Tablet', '40mg', '15 Tablets/Strip', '30049099', 12.00, 155.00, '22222222-2222-2222-2222-222222222222', 40, false),
  ('aaaaaaaa-0012-0000-0000-000000000000', 'Pan-D', 'Pantoprazole + Domperidone', 'Alkem Laboratories', 'Capsule', '40mg + 30mg', '15 Capsules/Strip', '30049099', 12.00, 214.00, '22222222-2222-2222-2222-222222222222', 30, true),
  ('aaaaaaaa-0013-0000-0000-000000000000', 'Omez 20', 'Omeprazole', 'Dr. Reddy''s Laboratories', 'Capsule', '20mg', '20 Capsules/Strip', '30049099', 12.00, 74.00, '33333333-3333-3333-3333-333333333333', 25, false),
  ('aaaaaaaa-0014-0000-0000-000000000000', 'Digene Gel Mint', 'Magnesium Hydroxide + Simethicone', 'Abbott India Ltd', 'Syrup', 'Sugar Free', '200ml Bottle', '30049099', 12.00, 142.00, '33333333-3333-3333-3333-333333333333', 20, false),
  ('aaaaaaaa-0015-0000-0000-000000000000', 'Emeset 4', 'Ondansetron', 'Cipla Ltd', 'Tablet', '4mg', '10 Tablets/Strip', '30049099', 12.00, 48.50, '22222222-2222-2222-2222-222222222222', 15, true),

  -- 16 to 20: Antidiabetic
  ('aaaaaaaa-0016-0000-0000-000000000000', 'Glycomet 500', 'Metformin Hydrochloride', 'USV Private Ltd', 'Tablet', '500mg', '20 Tablets/Strip', '30049099', 12.00, 46.00, '44444444-4444-4444-4444-444444444444', 40, true),
  ('aaaaaaaa-0017-0000-0000-000000000000', 'Glycomet-GP 2', 'Metformin + Glimepiride', 'USV Private Ltd', 'Tablet', '500mg + 2mg', '15 Tablets/Strip', '30049099', 12.00, 162.00, '44444444-4444-4444-4444-444444444444', 35, true),
  ('aaaaaaaa-0018-0000-0000-000000000000', 'Galvus 50', 'Vildagliptin', 'Novartis India', 'Tablet', '50mg', '14 Tablets/Strip', '30049099', 12.00, 298.00, '11111111-1111-1111-1111-111111111111', 15, true),
  ('aaaaaaaa-0019-0000-0000-000000000000', 'Jardiance 10', 'Empagliflozin', 'Boehringer Ingelheim', 'Tablet', '10mg', '10 Tablets/Strip', '30049099', 12.00, 480.00, '11111111-1111-1111-1111-111111111111', 10, true),
  ('aaaaaaaa-0020-0000-0000-000000000000', 'Human Mixtard 30/70', 'Insulin Isophane + Soluble', 'Novo Nordisk', 'Injection', '100 IU/ml', '10ml Vial', '30043110', 5.00, 185.00, '33333333-3333-3333-3333-333333333333', 10, true),

  -- 21 to 25: Cardiovascular & Blood Pressure
  ('aaaaaaaa-0021-0000-0000-000000000000', 'Telma 40', 'Telmisartan', 'Glenmark Pharmaceuticals', 'Tablet', '40mg', '30 Tablets/Strip', '30049099', 12.00, 240.00, '44444444-4444-4444-4444-444444444444', 30, true),
  ('aaaaaaaa-0022-0000-0000-000000000000', 'Telma-H', 'Telmisartan + Hydrochlorothiazide', 'Glenmark Pharmaceuticals', 'Tablet', '40mg + 12.5mg', '15 Tablets/Strip', '30049099', 12.00, 215.00, '44444444-4444-4444-4444-444444444444', 20, true),
  ('aaaaaaaa-0023-0000-0000-000000000000', 'Amlong 5', 'Amlodipine Besylate', 'Micro Labs Ltd', 'Tablet', '5mg', '15 Tablets/Strip', '30049099', 12.00, 42.00, '44444444-4444-4444-4444-444444444444', 25, true),
  ('aaaaaaaa-0024-0000-0000-000000000000', 'Atorva 10', 'Atorvastatin', 'Zydus Cadila', 'Tablet', '10mg', '15 Tablets/Strip', '30049099', 12.00, 110.00, '11111111-1111-1111-1111-111111111111', 25, true),
  ('aaaaaaaa-0025-0000-0000-000000000000', 'Ecosprin 75', 'Aspirin (Gastro-resistant)', 'USV Private Ltd', 'Tablet', '75mg', '14 Tablets/Strip', '30049060', 12.00, 9.80, '44444444-4444-4444-4444-444444444444', 50, false),

  -- 26 to 30: Respiratory, Anti-Allergy & Vitamins
  ('aaaaaaaa-0026-0000-0000-000000000000', 'Montair-LC', 'Montelukast + Levocetirizine', 'Cipla Ltd', 'Tablet', '10mg + 5mg', '10 Tablets/Strip', '30049099', 12.00, 195.00, '22222222-2222-2222-2222-222222222222', 30, true),
  ('aaaaaaaa-0027-0000-0000-000000000000', 'Cetzine 10', 'Cetirizine Hydrochloride', 'Dr. Reddy''s Laboratories', 'Tablet', '10mg', '15 Tablets/Strip', '30049099', 12.00, 32.00, '33333333-3333-3333-3333-333333333333', 30, false),
  ('aaaaaaaa-0028-0000-0000-000000000000', 'Asthalin Inhaler', 'Salbutamol', 'Cipla Ltd', 'Inhaler', '100mcg/puff', '200 MDI Doses', '30049099', 12.00, 165.00, '22222222-2222-2222-2222-222222222222', 15, true),
  ('aaaaaaaa-0029-0000-0000-000000000000', 'Shelcal 500', 'Calcium + Vitamin D3', 'Torrent Pharmaceuticals', 'Tablet', '500mg + 250IU', '15 Tablets/Strip', '30049099', 12.00, 138.00, '44444444-4444-4444-4444-444444444444', 30, false),
  ('aaaaaaaa-0030-0000-0000-000000000000', 'Becosules Z', 'B-Complex Forte + Zinc + Vit C', 'Pfizer Ltd', 'Capsule', 'Standard Dose', '20 Capsules/Strip', '30045090', 12.00, 52.00, '33333333-3333-3333-3333-333333333333', 35, false)
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  generic_name = EXCLUDED.generic_name,
  mrp = EXCLUDED.mrp;

-- 18.3 BATCHES (WITH REALISTIC DATES: HEALTHY, EXPIRING WITHIN 90 DAYS, EXPIRED, LOW STOCK)
-- Note: Current date benchmark is late 2026.
-- Expired: Date prior to Current Date (e.g., 2026-08-15, 2026-10-01) -> RED ALERT
-- Expiring within 90 days: Nov 2026 to Jan 2027 -> AMBER ALERT
-- Healthy: Expiring mid-2027 to 2028 -> GREEN
INSERT INTO public.batches (medicine_id, batch_number, expiry_date, quantity, purchase_price, mrp, supplier_id, storage_location)
VALUES
  -- Dolo 650: 2 batches (FEFO sorting test)
  ('aaaaaaaa-0001-0000-0000-000000000000', 'DL-24A01', CURRENT_DATE + INTERVAL '45 days', 15, 24.50, 34.00, '11111111-1111-1111-1111-111111111111', 'Rack A - Shelf 1'), -- AMBER ALERT (Expiring soon) & Low stock
  ('aaaaaaaa-0001-0000-0000-000000000000', 'DL-24B02', CURRENT_DATE + INTERVAL '480 days', 120, 25.00, 34.00, '11111111-1111-1111-1111-111111111111', 'Rack A - Shelf 1'), -- Healthy

  -- Zerodol-P: 1 batch
  ('aaaaaaaa-0002-0000-0000-000000000000', 'ZD-8819', CURRENT_DATE + INTERVAL '300 days', 45, 52.00, 72.50, '11111111-1111-1111-1111-111111111111', 'Rack A - Shelf 2'),

  -- Meftal-Spas: 1 batch (Expiring within 60 days -> AMBER ALERT)
  ('aaaaaaaa-0003-0000-0000-000000000000', 'MF-5502', CURRENT_DATE + INTERVAL '55 days', 30, 40.00, 56.00, '22222222-2222-2222-2222-222222222222', 'Rack A - Shelf 3'),

  -- Brufen 400: EXPIRED BATCH -> RED ALERT!
  ('aaaaaaaa-0004-0000-0000-000000000000', 'BF-3321', CURRENT_DATE - INTERVAL '20 days', 12, 17.50, 24.80, '22222222-2222-2222-2222-222222222222', 'Quarantine Box 1'),
  ('aaaaaaaa-0004-0000-0000-000000000000', 'BF-3390', CURRENT_DATE + INTERVAL '360 days', 80, 18.00, 24.80, '22222222-2222-2222-2222-222222222222', 'Rack A - Shelf 4'),

  -- Calpol 250 Pead: Low stock warning (reorder level is 15, current is 8)
  ('aaaaaaaa-0005-0000-0000-000000000000', 'CP-7711', CURRENT_DATE + INTERVAL '240 days', 8, 34.00, 48.00, '33333333-3333-3333-3333-333333333333', 'Rack B - Syrup Bay 1'),

  -- Augmentin 625 Duo: 2 batches
  ('aaaaaaaa-0006-0000-0000-000000000000', 'AG-901', CURRENT_DATE + INTERVAL '75 days', 18, 165.00, 223.50, '11111111-1111-1111-1111-111111111111', 'Rack B - Antibiotics 1'), -- AMBER
  ('aaaaaaaa-0006-0000-0000-000000000000', 'AG-902', CURRENT_DATE + INTERVAL '540 days', 65, 170.00, 223.50, '11111111-1111-1111-1111-111111111111', 'Rack B - Antibiotics 1'),

  -- Azithral 500: Healthy
  ('aaaaaaaa-0007-0000-0000-000000000000', 'AZ-1022', CURRENT_DATE + INTERVAL '400 days', 50, 95.00, 131.00, '11111111-1111-1111-1111-111111111111', 'Rack B - Antibiotics 2'),

  -- Taxim-O 200: Healthy
  ('aaaaaaaa-0008-0000-0000-000000000000', 'TX-4040', CURRENT_DATE + INTERVAL '350 days', 40, 132.00, 184.00, '22222222-2222-2222-2222-222222222222', 'Rack B - Antibiotics 2'),

  -- Ciplox 500: Expired batch + Healthy batch
  ('aaaaaaaa-0009-0000-0000-000000000000', 'CX-OLD1', CURRENT_DATE - INTERVAL '45 days', 6, 32.00, 45.20, '22222222-2222-2222-2222-222222222222', 'Quarantine Box 1'), -- RED
  ('aaaaaaaa-0009-0000-0000-000000000000', 'CX-NEW2', CURRENT_DATE + INTERVAL '450 days', 55, 33.50, 45.20, '22222222-2222-2222-2222-222222222222', 'Rack B - Antibiotics 3'),

  -- Doxt-SL: Low stock (5 items left, reorder is 15)
  ('aaaaaaaa-0010-0000-0000-000000000000', 'DX-7182', CURRENT_DATE + INTERVAL '280 days', 5, 82.00, 115.00, '33333333-3333-3333-3333-333333333333', 'Rack B - Antibiotics 3'),

  -- Pan 40: Healthy ample stock
  ('aaaaaaaa-0011-0000-0000-000000000000', 'PN-6211', CURRENT_DATE + INTERVAL '500 days', 140, 110.00, 155.00, '22222222-2222-2222-2222-222222222222', 'Rack C - Gastro 1'),

  -- Pan-D: Healthy
  ('aaaaaaaa-0012-0000-0000-000000000000', 'PND-991', CURRENT_DATE + INTERVAL '390 days', 85, 152.00, 214.00, '22222222-2222-2222-2222-222222222222', 'Rack C - Gastro 1'),

  -- Omez 20: Expiring in 80 days -> AMBER
  ('aaaaaaaa-0013-0000-0000-000000000000', 'OM-3104', CURRENT_DATE + INTERVAL '80 days', 35, 52.00, 74.00, '33333333-3333-3333-3333-333333333333', 'Rack C - Gastro 2'),

  -- Digene Gel: Healthy
  ('aaaaaaaa-0014-0000-0000-000000000000', 'DG-2024', CURRENT_DATE + INTERVAL '320 days', 30, 102.00, 142.00, '33333333-3333-3333-3333-333333333333', 'Rack C - Syrup Bay 2'),

  -- Emeset 4: Healthy
  ('aaaaaaaa-0015-0000-0000-000000000000', 'EM-1100', CURRENT_DATE + INTERVAL '420 days', 40, 34.00, 48.50, '22222222-2222-2222-2222-222222222222', 'Rack C - Gastro 3'),

  -- Glycomet 500: Healthy
  ('aaaaaaaa-0016-0000-0000-000000000000', 'GM-501A', CURRENT_DATE + INTERVAL '600 days', 150, 32.50, 46.00, '44444444-4444-4444-4444-444444444444', 'Rack D - Diabetes 1'),

  -- Glycomet-GP 2: Healthy
  ('aaaaaaaa-0017-0000-0000-000000000000', 'GP-2099', CURRENT_DATE + INTERVAL '310 days', 60, 118.00, 162.00, '44444444-4444-4444-4444-444444444444', 'Rack D - Diabetes 1'),

  -- Galvus 50: Low stock (6 left, reorder is 15)
  ('aaaaaaaa-0018-0000-0000-000000000000', 'GV-8472', CURRENT_DATE + INTERVAL '260 days', 6, 220.00, 298.00, '11111111-1111-1111-1111-111111111111', 'Rack D - Diabetes 2'),

  -- Jardiance 10: Healthy
  ('aaaaaaaa-0019-0000-0000-000000000000', 'JD-4100', CURRENT_DATE + INTERVAL '450 days', 25, 360.00, 480.00, '11111111-1111-1111-1111-111111111111', 'Rack D - Diabetes 2'),

  -- Human Mixtard 30/70: Cold storage (expiring in 30 days -> AMBER)
  ('aaaaaaaa-0020-0000-0000-000000000000', 'MX-7030', CURRENT_DATE + INTERVAL '30 days', 14, 140.00, 185.00, '33333333-3333-3333-3333-333333333333', 'Cold Chain Fridge A'),

  -- Telma 40: Healthy
  ('aaaaaaaa-0021-0000-0000-000000000000', 'TL-4011', CURRENT_DATE + INTERVAL '520 days', 90, 172.00, 240.00, '44444444-4444-4444-4444-444444444444', 'Rack E - Cardiac 1'),

  -- Telma-H: Healthy
  ('aaaaaaaa-0022-0000-0000-000000000000', 'TLH-102', CURRENT_DATE + INTERVAL '380 days', 45, 155.00, 215.00, '44444444-4444-4444-4444-444444444444', 'Rack E - Cardiac 1'),

  -- Amlong 5: Expired batch -> RED ALERT
  ('aaaaaaaa-0023-0000-0000-000000000000', 'AM-EXP1', CURRENT_DATE - INTERVAL '15 days', 20, 29.00, 42.00, '44444444-4444-4444-4444-444444444444', 'Quarantine Box 2'),
  ('aaaaaaaa-0023-0000-0000-000000000000', 'AM-NEW1', CURRENT_DATE + INTERVAL '360 days', 70, 30.00, 42.00, '44444444-4444-4444-4444-444444444444', 'Rack E - Cardiac 2'),

  -- Atorva 10: Healthy
  ('aaaaaaaa-0024-0000-0000-000000000000', 'AT-8119', CURRENT_DATE + INTERVAL '410 days', 65, 78.00, 110.00, '11111111-1111-1111-1111-111111111111', 'Rack E - Cardiac 2'),

  -- Ecosprin 75: Healthy high volume
  ('aaaaaaaa-0025-0000-0000-000000000000', 'EC-3012', CURRENT_DATE + INTERVAL '600 days', 200, 6.80, 9.80, '44444444-4444-4444-4444-444444444444', 'Rack E - Cardiac 3'),

  -- Montair-LC: Healthy
  ('aaaaaaaa-0026-0000-0000-000000000000', 'ML-5021', CURRENT_DATE + INTERVAL '430 days', 55, 138.00, 195.00, '22222222-2222-2222-2222-222222222222', 'Rack F - Respiratory 1'),

  -- Cetzine 10: Expiring in 65 days -> AMBER
  ('aaaaaaaa-0027-0000-0000-000000000000', 'CZ-9910', CURRENT_DATE + INTERVAL '65 days', 25, 21.00, 32.00, '33333333-3333-3333-3333-333333333333', 'Rack F - Respiratory 1'),

  -- Asthalin Inhaler: Healthy
  ('aaaaaaaa-0028-0000-0000-000000000000', 'AS-2210', CURRENT_DATE + INTERVAL '300 days', 35, 118.00, 165.00, '22222222-2222-2222-2222-222222222222', 'Rack F - Respiratory 2'),

  -- Shelcal 500: Healthy
  ('aaaaaaaa-0029-0000-0000-000000000000', 'SC-1092', CURRENT_DATE + INTERVAL '450 days', 80, 96.00, 138.00, '44444444-4444-4444-4444-444444444444', 'Rack G - Vitamins 1'),

  -- Becosules Z: Healthy
  ('aaaaaaaa-0030-0000-0000-000000000000', 'BZ-4418', CURRENT_DATE + INTERVAL '380 days', 95, 36.50, 52.00, '33333333-3333-3333-3333-333333333333', 'Rack G - Vitamins 2')
ON CONFLICT (medicine_id, batch_number) DO UPDATE SET 
  expiry_date = EXCLUDED.expiry_date,
  quantity = EXCLUDED.quantity,
  purchase_price = EXCLUDED.purchase_price,
  mrp = EXCLUDED.mrp;

-- 18.4 RECORD INITIAL STOCK MOVEMENTS
INSERT INTO public.stock_movements (medicine_id, batch_id, movement_type, quantity_change, balance_after, reason)
SELECT 
  b.medicine_id,
  b.id,
  'initial',
  b.quantity,
  b.quantity,
  'Opening inventory batch initialization'
FROM public.batches b
ON CONFLICT DO NOTHING;

-- 18.5 STAGE 3 PRE-POPULATED CHART OF ACCOUNTS (LEDGER)
INSERT INTO public.ledger_accounts (account_code, account_name, account_type, description)
VALUES
  ('1001', 'Cash in Hand', 'asset', 'Main cash register drawer'),
  ('1002', 'Bank Current Account (HDFC)', 'asset', 'Operating bank account for POS and UPI receipts'),
  ('1010', 'Medicine Inventory Stock', 'asset', 'Total inventory asset value at cost'),
  ('2001', 'Accounts Payable (Suppliers)', 'liability', 'Outstanding amounts owed to drug distributors'),
  ('2010', 'GST Output Tax Payable', 'liability', 'Tax collected on medicine sales'),
  ('3001', 'Owner Equity / Capital', 'equity', 'Initial capital invested'),
  ('4001', 'Medicine Sales Revenue', 'revenue', 'Revenue earned from pharmacy OTC and prescription sales'),
  ('5001', 'Cost of Goods Sold (Purchases)', 'expense', 'Direct cost of medicine stock sold'),
  ('5010', 'Expired / Damaged Stock Loss', 'expense', 'Loss written off from expired medicines'),
  ('5020', 'Pharmacy Store Rent', 'expense', 'Monthly shop rental expense'),
  ('5030', 'Electricity & Cold Chain Refrigeration', 'expense', 'Utility costs for store and fridge')
ON CONFLICT (account_code) DO NOTHING;

-- ==============================================================================
-- 19. TEST USER CREATION HELPER
-- ==============================================================================
-- You can create your 3 users directly from the Supabase Authentication Dashboard:
-- 1. admin@pharmacy.com (Password: Admin@12345)
-- 2. pharmacist@pharmacy.com (Password: Pharma@12345)
-- 3. accountant@pharmacy.com (Password: Accounts@12345)
--
-- After creating them, run the following SQL block once to guarantee their roles:
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'admin@pharmacy.com';
-- UPDATE public.profiles SET role = 'pharmacist' WHERE email = 'pharmacist@pharmacy.com';
-- UPDATE public.profiles SET role = 'accountant' WHERE email = 'accountant@pharmacy.com';
-- ==============================================================================
