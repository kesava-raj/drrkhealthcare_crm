import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const search = searchParams.get('search')?.trim();

    const supabase = createAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase admin client not initialized' }, { status: 500 });
    }

    let query = supabase
      .from('sales')
      .select(`
        id,
        bill_number,
        customer_name,
        customer_phone,
        doctor_name,
        total_amount,
        discount_amount,
        tax_amount,
        net_amount,
        payment_method,
        created_by,
        is_active,
        created_at,
        profiles ( full_name ),
        sale_items (
          id,
          sale_id,
          medicine_id,
          batch_id,
          quantity,
          unit_price,
          mrp,
          tax_percentage,
          total_amount,
          medicines ( name ),
          batches ( batch_number, expiry_date )
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (search) {
      query = query.or(`bill_number.ilike.%${search}%,customer_name.ilike.%${search}%,customer_phone.ilike.%${search}%`);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Format results
    const formatted = (data || []).map((sale: any) => ({
      id: sale.id,
      bill_number: sale.bill_number,
      customer_name: sale.customer_name,
      customer_phone: sale.customer_phone,
      doctor_name: sale.doctor_name,
      total_amount: Number(sale.total_amount),
      discount_amount: Number(sale.discount_amount),
      tax_amount: Number(sale.tax_amount),
      net_amount: Number(sale.net_amount),
      payment_method: sale.payment_method,
      created_by: sale.created_by,
      created_by_name: sale.profiles?.full_name || 'Counter Staff',
      is_active: sale.is_active,
      created_at: sale.created_at,
      items: (sale.sale_items || []).map((item: any) => ({
        id: item.id,
        sale_id: item.sale_id,
        medicine_id: item.medicine_id,
        batch_id: item.batch_id,
        quantity: item.quantity,
        unit_price: Number(item.unit_price),
        mrp: Number(item.mrp),
        tax_percentage: Number(item.tax_percentage),
        total_amount: Number(item.total_amount),
        medicine_name: item.medicines?.name || 'Unknown Medicine',
        batch_number: item.batches?.batch_number || 'Unknown Batch',
        expiry_date: item.batches?.expiry_date || '',
      })),
    }));

    return NextResponse.json({
      success: true,
      sales: formatted,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      customer_name,
      customer_phone,
      doctor_name,
      payment_method = 'cash',
      discount_amount = 0,
      items = [],
      created_by = null,
      user_name = 'Counter Staff',
    } = body;

    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Please add at least one medicine item to generate a bill' }, { status: 400 });
    }

    const supabase = createAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase admin client not initialized' }, { status: 500 });
    }

    // 1. Validate stock availability for each item's batch
    const batchIds = items.map((i: any) => i.batch_id);
    const { data: batchesData, error: batchErr } = await supabase
      .from('batches')
      .select('id, batch_number, quantity, purchase_price, medicine_id')
      .in('id', batchIds);

    if (batchErr || !batchesData) {
      return NextResponse.json({ error: 'Failed to verify batch stock: ' + (batchErr?.message || 'Not found') }, { status: 400 });
    }

    const batchMap = new Map<string, any>();
    batchesData.forEach((b: any) => batchMap.set(b.id, b));

    for (const item of items) {
      const batch = batchMap.get(item.batch_id);
      if (!batch) {
        return NextResponse.json({ error: `Selected batch for item was not found in database.` }, { status: 400 });
      }
      if (batch.quantity < item.quantity) {
        return NextResponse.json({
          error: `Insufficient stock in Batch ${batch.batch_number}. Available: ${batch.quantity}, Requested: ${item.quantity}.`
        }, { status: 400 });
      }
    }

    // 2. Generate sequential Bill Number: DRRK-YYYYMMDD-XXXX
    const today = new Date();
    const datePrefix = today.toISOString().slice(0, 10).replace(/-/g, '');
    const { count } = await supabase
      .from('sales')
      .select('id', { count: 'exact', head: true });
    const billNumber = `DRRK-${datePrefix}-${String((count || 0) + 1).padStart(4, '0')}`;

    // 3. Calculate Totals
    let subtotal = 0;
    let totalTax = 0;
    let totalCogs = 0;

    const validatedItems = items.map((item: any) => {
      const batch = batchMap.get(item.batch_id);
      const qty = parseInt(item.quantity, 10);
      const unitPrice = parseFloat(item.unit_price || item.mrp || 0);
      const mrp = parseFloat(item.mrp || unitPrice);
      const taxRate = parseFloat(item.tax_percentage || 0);
      const itemTotal = parseFloat((qty * unitPrice).toFixed(2));
      
      // Calculate inclusive/exclusive tax breakdown
      // Formula: Tax amount = itemTotal * (taxRate / 100)
      const itemTax = parseFloat(((itemTotal * taxRate) / 100).toFixed(2));
      
      subtotal += itemTotal;
      totalTax += itemTax;

      const unitCost = Number(batch?.purchase_price || 0);
      totalCogs += unitCost * qty;

      return {
        medicine_id: item.medicine_id,
        batch_id: item.batch_id,
        quantity: qty,
        unit_price: unitPrice,
        mrp: mrp,
        tax_percentage: taxRate,
        total_amount: itemTotal,
        medicine_name: item.medicine_name,
        batch_number: batch?.batch_number,
      };
    });

    const parsedDiscount = parseFloat(discount_amount || 0);
    const netAmount = parseFloat((subtotal + totalTax - parsedDiscount).toFixed(2));

    // 4. Insert into `sales`
    const { data: saleData, error: saleErr } = await supabase
      .from('sales')
      .insert({
        bill_number: billNumber,
        customer_name: customer_name?.trim() || 'Counter Patient',
        customer_phone: customer_phone?.trim() || null,
        doctor_name: doctor_name?.trim() || null,
        total_amount: subtotal,
        discount_amount: parsedDiscount,
        tax_amount: totalTax,
        net_amount: netAmount,
        payment_method: payment_method,
        created_by: created_by,
        is_active: true,
      })
      .select()
      .single();

    if (saleErr || !saleData) {
      return NextResponse.json({ error: 'Failed to record sale: ' + saleErr?.message }, { status: 500 });
    }

    const saleId = saleData.id;

    // 5. Insert into `sale_items`
    const saleItemsToInsert = validatedItems.map((vi) => ({
      sale_id: saleId,
      medicine_id: vi.medicine_id,
      batch_id: vi.batch_id,
      quantity: vi.quantity,
      unit_price: vi.unit_price,
      mrp: vi.mrp,
      tax_percentage: vi.tax_percentage,
      total_amount: vi.total_amount,
    }));

    const { error: itemsErr } = await supabase
      .from('sale_items')
      .insert(saleItemsToInsert);

    if (itemsErr) {
      console.error('Error inserting sale items:', itemsErr);
    }

    // 6. Deduct Stock & Record Stock Movements
    for (const vi of validatedItems) {
      const batch = batchMap.get(vi.batch_id);
      const newQty = Math.max(0, batch.quantity - vi.quantity);

      // Update batch quantity
      await supabase
        .from('batches')
        .update({ quantity: newQty })
        .eq('id', vi.batch_id);

      // Record Stock OUT movement
      await supabase
        .from('stock_movements')
        .insert({
          medicine_id: vi.medicine_id,
          batch_id: vi.batch_id,
          movement_type: 'sale',
          quantity_change: -vi.quantity,
          balance_after: newQty,
          reason: `Sold in Counter Bill #${billNumber} to ${customer_name || 'Patient'}`,
          reference_id: saleId,
          created_by: created_by,
        });
    }

    // 7. Auto Double-Entry Journal Records
    try {
      const { data: accounts } = await supabase
        .from('ledger_accounts')
        .select('id, account_code');

      const accMap = new Map<string, string>();
      (accounts || []).forEach((a: any) => accMap.set(a.account_code, a.id));

      // Determine payment account: 1001 (Cash) or 1002 (Bank for card/upi)
      const paymentAccCode = (payment_method === 'cash') ? '1001' : '1002';
      const paymentAccId = accMap.get(paymentAccCode) || accMap.get('1001');
      const salesRevAccId = accMap.get('4001'); // Medicine Sales Revenue
      const gstPayableAccId = accMap.get('2010'); // GST Output Tax Payable
      const cogsAccId = accMap.get('5001'); // Cost of Goods Sold
      const inventoryAccId = accMap.get('1010'); // Medicine Inventory Stock

      if (paymentAccId && salesRevAccId) {
        // Create parent journal entry
        const { data: journalEntry } = await supabase
          .from('journal_entries')
          .insert({
            entry_date: today.toISOString().slice(0, 10),
            reference_type: 'sale',
            reference_id: saleId,
            description: `Sale Bill #${billNumber} [${payment_method.toUpperCase()}] - ${customer_name || 'Counter Patient'}`,
            total_amount: netAmount,
            created_by: created_by,
          })
          .select()
          .single();

        if (journalEntry?.id) {
          const lines = [];

          // Line 1: Debit Cash or Bank (Total Received)
          lines.push({
            entry_id: journalEntry.id,
            account_id: paymentAccId,
            debit: netAmount,
            credit: 0.00,
          });

          // Line 2: Credit Sales Revenue (Net without tax)
          const netRevenue = Math.max(0, netAmount - totalTax);
          lines.push({
            entry_id: journalEntry.id,
            account_id: salesRevAccId,
            debit: 0.00,
            credit: netRevenue,
          });

          // Line 3: Credit GST Output Tax Payable (if tax > 0)
          if (totalTax > 0 && gstPayableAccId) {
            lines.push({
              entry_id: journalEntry.id,
              account_id: gstPayableAccId,
              debit: 0.00,
              credit: totalTax,
            });
          }

          // Line 4 & 5: Inventory reduction & COGS (if purchase costs known)
          if (totalCogs > 0 && cogsAccId && inventoryAccId) {
            lines.push({
              entry_id: journalEntry.id,
              account_id: cogsAccId,
              debit: parseFloat(totalCogs.toFixed(2)),
              credit: 0.00,
            });
            lines.push({
              entry_id: journalEntry.id,
              account_id: inventoryAccId,
              debit: 0.00,
              credit: parseFloat(totalCogs.toFixed(2)),
            });
          }

          await supabase.from('journal_entry_lines').insert(lines);
        }
      }
    } catch (accError) {
      console.warn('Journal posting warning:', accError);
    }

    // 8. Log into `audit_log`
    try {
      await supabase.from('audit_log').insert({
        table_name: 'sales',
        record_id: saleId,
        action: 'INSERT',
        new_data: {
          bill_number: billNumber,
          customer_name: customer_name || 'Counter Patient',
          payment_method,
          net_amount: netAmount,
          items_count: items.length,
        },
        changed_by: created_by,
        changed_by_name: user_name,
      });
    } catch (auditErr) {
      console.warn('Audit logging warning:', auditErr);
    }

    return NextResponse.json({
      success: true,
      sale: {
        ...saleData,
        items: validatedItems,
      },
      bill_number: billNumber,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
