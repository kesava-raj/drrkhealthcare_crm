import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const supabase = createAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase admin client not initialized' }, { status: 500 });
    }

    // Fetch active medicines
    const { data: medicines, error: medError } = await supabase
      .from('medicines')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (medError) {
      return NextResponse.json({ error: medError.message }, { status: 500 });
    }

    // Fetch active batches
    const { data: batches, error: batchError } = await supabase
      .from('batches')
      .select('*')
      .eq('is_active', true)
      .order('expiry_date', { ascending: true });

    if (batchError) {
      return NextResponse.json({ error: batchError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      medicines: medicines || [],
      batches: batches || [],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const supabase = createAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase admin client not initialized' }, { status: 500 });
    }

    const { action, medicine, batch, id, userId, userName } = body;

    if (action === 'save_medicine') {
      if (medicine.id) {
        const { data, error } = await supabase
          .from('medicines')
          .update({
            name: medicine.name,
            generic_name: medicine.generic_name,
            manufacturer: medicine.manufacturer,
            category: medicine.category,
            strength: medicine.strength,
            unit_pack_size: medicine.unit_pack_size,
            hsn_code: medicine.hsn_code,
            tax_gst_percentage: medicine.tax_gst_percentage,
            mrp: medicine.mrp,
            default_supplier_id: medicine.default_supplier_id || null,
            reorder_level: medicine.reorder_level,
            prescription_required: medicine.prescription_required,
            updated_at: new Date().toISOString(),
          })
          .eq('id', medicine.id)
          .select()
          .single();

        if (error) throw error;
        return NextResponse.json({ success: true, data });
      } else {
        const { data, error } = await supabase
          .from('medicines')
          .insert({
            name: medicine.name,
            generic_name: medicine.generic_name,
            manufacturer: medicine.manufacturer,
            category: medicine.category,
            strength: medicine.strength,
            unit_pack_size: medicine.unit_pack_size,
            hsn_code: medicine.hsn_code || '30049099',
            tax_gst_percentage: medicine.tax_gst_percentage || 12,
            mrp: medicine.mrp || 0,
            default_supplier_id: medicine.default_supplier_id || null,
            reorder_level: medicine.reorder_level ?? 20,
            prescription_required: medicine.prescription_required || false,
            is_active: true,
          })
          .select()
          .single();

        if (error) throw error;
        return NextResponse.json({ success: true, data });
      }
    } else if (action === 'delete_medicine') {
      const { error } = await supabase
        .from('medicines')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      return NextResponse.json({ success: true });
    } else if (action === 'save_batch') {
      if (batch.id) {
        const { data, error } = await supabase
          .from('batches')
          .update({
            batch_number: batch.batch_number,
            expiry_date: batch.expiry_date,
            quantity: batch.quantity,
            purchase_price: batch.purchase_price,
            mrp: batch.mrp,
            supplier_id: batch.supplier_id || null,
            storage_location: batch.storage_location || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', batch.id)
          .select()
          .single();

        if (error) throw error;
        return NextResponse.json({ success: true, data });
      } else {
        const { data, error } = await supabase
          .from('batches')
          .insert({
            medicine_id: batch.medicine_id,
            batch_number: batch.batch_number,
            expiry_date: batch.expiry_date,
            quantity: batch.quantity || 0,
            purchase_price: batch.purchase_price || 0,
            mrp: batch.mrp || 0,
            supplier_id: batch.supplier_id || null,
            storage_location: batch.storage_location || null,
            is_active: true,
          })
          .select()
          .single();

        if (error) throw error;

        // Record stock movement
        if (data && batch.quantity) {
          await supabase.from('stock_movements').insert({
            medicine_id: batch.medicine_id,
            batch_id: data.id,
            movement_type: 'initial',
            quantity_change: batch.quantity,
            balance_after: batch.quantity,
            reason: 'Batch creation',
            created_by: userId || null,
          });
        }

        return NextResponse.json({ success: true, data });
      }
    } else if (action === 'delete_batch') {
      const { error } = await supabase
        .from('batches')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
