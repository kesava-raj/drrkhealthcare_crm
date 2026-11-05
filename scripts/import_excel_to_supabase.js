const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables from .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...values] = trimmed.split('=');
      if (key && values.length > 0) {
        process.env[key.trim()] = values.join('=').trim();
      }
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('ERROR: Supabase URL or Service Key is missing in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

const EXCEL_PATH = path.join(__dirname, '..', 'reference', 'consolidated_supplier_medicine_data.xlsx');

if (!fs.existsSync(EXCEL_PATH)) {
  console.error('ERROR: Excel file not found at:', EXCEL_PATH);
  process.exit(1);
}

// Helper: Convert MM/YY to YYYY-MM-DD (End of month)
function parseExpiryDate(mm_yy) {
  if (!mm_yy || typeof mm_yy !== 'string') {
    return '2028-12-31';
  }
  const parts = mm_yy.trim().split('/');
  if (parts.length === 2) {
    const month = parseInt(parts[0], 10);
    let year = parseInt(parts[1], 10);
    if (year < 100) year += 2000;
    
    // Find last day of the month
    const lastDay = new Date(year, month, 0).getDate();
    const mmStr = month < 10 ? '0' + month : '' + month;
    const ddStr = lastDay < 10 ? '0' + lastDay : '' + lastDay;
    return `${year}-${mmStr}-${ddStr}`;
  }
  return '2028-12-31';
}

// Helper: Guess medicine category from name
function guessCategory(name) {
  const upper = (name || '').toUpperCase();
  if (upper.includes('TAB')) return 'Tablet';
  if (upper.includes('CAP')) return 'Capsule';
  if (upper.includes('SY') || upper.includes('SYRUP')) return 'Syrup';
  if (upper.includes('DROPS')) return 'Drops';
  if (upper.includes('CREAM') || upper.includes('GEL') || upper.includes('OINT')) return 'Ointment';
  if (upper.includes('INJ')) return 'Injection';
  if (upper.includes('POWDER')) return 'Powder';
  if (upper.includes('SPRAY')) return 'Inhaler / Spray';
  if (upper.includes('SOAP')) return 'Hygiene / Soap';
  if (upper.includes('SYRINGE') || upper.includes('SWAB')) return 'Medical Device';
  return 'Other';
}

async function runImport() {
  console.log('====================================================');
  console.log('DRRK HEALTHCARE PHARMACY - EXCEL DATA IMPORT');
  console.log('====================================================');
  console.log('Reading Excel file from: reference/consolidated_supplier_medicine_data.xlsx\n');

  const wb = xlsx.readFile(EXCEL_PATH);
  const invoiceRows = xlsx.utils.sheet_to_json(wb.Sheets['Invoice Register'] || {});
  const lineItemRows = xlsx.utils.sheet_to_json(wb.Sheets['Medicine Line Items'] || {});

  console.log(`Found ${invoiceRows.length} invoices and ${lineItemRows.length} medicine line items.\n`);

  // 1. IMPORT SUPPLIERS
  console.log('--- Step 1: Importing Suppliers ---');
  const supplierMap = new Map(); // Name -> Supabase Supplier ID

  // Collect suppliers from both sheets
  const supplierMeta = new Map();
  invoiceRows.forEach(inv => {
    const name = (inv['Supplier name'] || '').trim();
    if (name && !supplierMeta.has(name)) {
      supplierMeta.set(name, {
        name,
        gstin: inv['Supplier GSTIN'] || null,
        dl_number: inv['Supplier drug licence number'] || null,
        address: inv['Place of supply'] || null,
      });
    }
  });

  lineItemRows.forEach(item => {
    const name = (item['Supplier name'] || '').trim();
    if (name && !supplierMeta.has(name)) {
      supplierMeta.set(name, { name, gstin: null, dl_number: null, address: null });
    }
  });

  for (const [sName, sData] of supplierMeta.entries()) {
    // Check if supplier already exists
    const { data: existing } = await supabase
      .from('suppliers')
      .select('id, name')
      .ilike('name', sName)
      .maybeSingle();

    if (existing) {
      supplierMap.set(sName, existing.id);
      console.log(`✓ Supplier exists: "${sName}" (ID: ${existing.id})`);
    } else {
      const { data: inserted, error: sErr } = await supabase
        .from('suppliers')
        .insert({
          name: sData.name,
          gstin: sData.gstin,
          dl_number: sData.dl_number,
          address: sData.address,
          is_active: true,
        })
        .select()
        .single();

      if (sErr) {
        console.error(`Failed to insert supplier "${sName}":`, sErr.message);
      } else {
        supplierMap.set(sName, inserted.id);
        console.log(`+ Inserted new supplier: "${sName}" (ID: ${inserted.id})`);
      }
    }
  }

  // 2. IMPORT MEDICINES & BATCHES
  console.log('\n--- Step 2: Importing Medicines & Batches ---');
  let medsCount = 0;
  let batchCount = 0;

  for (let i = 0; i < lineItemRows.length; i++) {
    const row = lineItemRows[i];
    const medName = (row['Medicine name'] || '').trim();
    if (!medName) continue;

    const supplierName = (row['Supplier name'] || '').trim();
    const supplierId = supplierMap.get(supplierName) || null;
    const category = guessCategory(medName);
    const manufacturer = row['Manufacturer'] || 'Standard Pharma';
    const hsnCode = row['HSN code'] || '30049099';
    const gstRate = parseFloat(String(row['GST %'] || '12').replace('%', '')) || 12;
    const purchaseRate = parseFloat(row['Rate (PTR/PTS)']) || 0;
    const mrp = parseFloat(row['MRP']) || (purchaseRate > 0 ? Number((purchaseRate * 1.3).toFixed(2)) : 50.00);
    const packSize = row['Pack size'] || '1 Unit';

    // 2.1 Check or Insert Medicine
    let medicineId = null;
    const { data: existingMed } = await supabase
      .from('medicines')
      .select('id, name')
      .ilike('name', medName)
      .maybeSingle();

    if (existingMed) {
      medicineId = existingMed.id;
    } else {
      const { data: newMed, error: medErr } = await supabase
        .from('medicines')
        .insert({
          name: medName,
          generic_name: medName, // default to brand name if generic composition not separated
          manufacturer: manufacturer,
          category: category,
          strength: 'Standard',
          unit_pack_size: packSize,
          hsn_code: hsnCode,
          tax_gst_percentage: gstRate,
          mrp: mrp,
          default_supplier_id: supplierId,
          reorder_level: 20,
          prescription_required: true,
          is_active: true,
        })
        .select()
        .single();

      if (medErr) {
        console.error(`  Error creating medicine "${medName}":`, medErr.message);
        continue;
      }
      medicineId = newMed.id;
      medsCount++;
      console.log(`  + Medicine added: "${medName}" (${category})`);
    }

    // 2.2 Insert Batch
    const rawBatch = (row['Batch number'] || '').trim();
    const batchNumber = rawBatch && rawBatch !== 'DEFAULT' ? rawBatch : `BT-${Date.now().toString().slice(-5)}-${i}`;
    const expiryDate = parseExpiryDate(row['Expiry (MM/YY)']);
    const quantity = parseInt(row['Quantity'], 10) || 10;

    // Check if batch already exists
    const { data: existingBatch } = await supabase
      .from('batches')
      .select('id')
      .eq('medicine_id', medicineId)
      .eq('batch_number', batchNumber)
      .maybeSingle();

    if (!existingBatch) {
      const { data: newBatch, error: batchErr } = await supabase
        .from('batches')
        .insert({
          medicine_id: medicineId,
          batch_number: batchNumber,
          expiry_date: expiryDate,
          quantity: quantity,
          purchase_price: purchaseRate,
          mrp: mrp,
          supplier_id: supplierId,
          storage_location: 'Main Rack A',
          is_active: true,
        })
        .select()
        .single();

      if (batchErr) {
        console.error(`    Error creating batch "${batchNumber}":`, batchErr.message);
      } else {
        batchCount++;
        console.log(`    ✓ Batch created: ${batchNumber} | Exp: ${expiryDate} | Qty: ${quantity} | Rate: ₹${purchaseRate}`);

        // Record stock movement
        await supabase.from('stock_movements').insert({
          medicine_id: medicineId,
          batch_id: newBatch.id,
          movement_type: 'initial',
          quantity_change: quantity,
          balance_after: quantity,
          reason: `Imported from supplier invoice ${row['Invoice number'] || ''}`,
        });
      }
    }
  }

  // 3. IMPORT PURCHASES (INVOICE REGISTER)
  console.log('\n--- Step 3: Importing Purchase Invoices ---');
  let invoicesCount = 0;

  for (const inv of invoiceRows) {
    const invNo = (inv['Invoice number'] || '').trim();
    if (!invNo) continue;

    const supplierName = (inv['Supplier name'] || '').trim();
    const supplierId = supplierMap.get(supplierName) || null;
    if (!supplierId) continue;

    // Date parsing DD/MM/YYYY
    let invDate = new Date().toISOString().split('T')[0];
    if (inv['Invoice date'] && typeof inv['Invoice date'] === 'string') {
      const dParts = inv['Invoice date'].split('/');
      if (dParts.length === 3) {
        invDate = `${dParts[2]}-${dParts[1].padStart(2, '0')}-${dParts[0].padStart(2, '0')}`;
      }
    }

    const grandTotal = parseFloat(inv['Grand total']) || parseFloat(inv['Taxable amount']) || 0;
    const taxTotal = (parseFloat(inv['CGST']) || 0) + (parseFloat(inv['SGST']) || 0) + (parseFloat(inv['IGST']) || 0);

    const { data: existingPurch } = await supabase
      .from('purchases')
      .select('id')
      .eq('invoice_number', invNo)
      .eq('supplier_id', supplierId)
      .maybeSingle();

    if (!existingPurch) {
      const { error: purchErr } = await supabase.from('purchases').insert({
        invoice_number: invNo,
        supplier_id: supplierId,
        invoice_date: invDate,
        total_amount: grandTotal,
        tax_amount: taxTotal,
        payment_status: 'paid',
        notes: `Consolidated import. Source: ${inv['Source image(s)'] || 'Excel reference'}`,
        is_active: true,
      });

      if (!purchErr) {
        invoicesCount++;
        console.log(`+ Purchase invoice recorded: #${invNo} (${supplierName}) - ₹${grandTotal}`);
      }
    }
  }

  console.log('\n====================================================');
  console.log('IMPORT COMPLETE SUMMARY');
  console.log('====================================================');
  console.log(`• Suppliers Linked/Created : ${supplierMap.size}`);
  console.log(`• Medicines Added          : ${medsCount}`);
  console.log(`• Batches Created          : ${batchCount}`);
  console.log(`• Purchase Invoices Added  : ${invoicesCount}`);
  console.log('====================================================\n');
}

runImport().catch(err => {
  console.error('Import failed with error:', err);
});
