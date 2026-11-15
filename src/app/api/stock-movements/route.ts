import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const medicineId = searchParams.get('medicine_id');

    const supabase = createAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase admin client not initialized' }, { status: 500 });
    }

    let query = supabase
      .from('stock_movements')
      .select(`
        id,
        medicine_id,
        batch_id,
        movement_type,
        quantity_change,
        balance_after,
        reason,
        reference_id,
        created_by,
        created_at,
        medicines ( name ),
        batches ( batch_number ),
        profiles ( full_name )
      `)
      .order('created_at', { ascending: false });

    if (medicineId) {
      query = query.eq('medicine_id', medicineId);
    } else {
      query = query.limit(200);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Format the joined fields
    const formatted = (data || []).map((row: any) => ({
      id: row.id,
      medicine_id: row.medicine_id,
      batch_id: row.batch_id,
      movement_type: row.movement_type,
      quantity_change: row.quantity_change,
      balance_after: row.balance_after,
      reason: row.reason,
      reference_id: row.reference_id,
      created_by: row.created_by,
      created_at: row.created_at,
      medicine_name: row.medicines?.name || 'Unknown Medicine',
      batch_number: row.batches?.batch_number || 'General Batch',
      created_by_name: row.profiles?.full_name || 'Pharmacy Staff',
    }));

    // If medicine_id was specified, compute totals
    let totalIn = 0;
    let totalOut = 0;
    formatted.forEach((m) => {
      if (m.quantity_change > 0) {
        totalIn += m.quantity_change;
      } else {
        totalOut += Math.abs(m.quantity_change);
      }
    });

    return NextResponse.json({
      success: true,
      movements: formatted,
      summary: {
        total_in: totalIn,
        total_out: totalOut,
        net_balance: totalIn - totalOut,
      },
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
      medicine_id,
      batch_id,
      movement_type,
      quantity_change,
      reason,
      created_by,
      user_name,
    } = body;

    if (!medicine_id || !quantity_change || !movement_type) {
      return NextResponse.json(
        { error: 'Missing required fields: medicine_id, movement_type, quantity_change' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase admin client not initialized' }, { status: 500 });
    }

    // 1. Fetch current batch or medicine stock to compute new balance
    let currentQty = 0;
    if (batch_id) {
      const { data: batch } = await supabase
        .from('batches')
        .select('id, quantity')
        .eq('id', batch_id)
        .single();
      currentQty = batch?.quantity || 0;
    } else {
      // Find default or first active batch for medicine
      const { data: batches } = await supabase
        .from('batches')
        .select('id, quantity')
        .eq('medicine_id', medicine_id)
        .eq('is_active', true)
        .order('expiry_date', { ascending: true })
        .limit(1);

      if (batches && batches.length > 0) {
        currentQty = batches[0].quantity;
      }
    }

    const newBalance = Math.max(0, currentQty + quantity_change);

    // 2. Update batch quantity
    if (batch_id) {
      await supabase
        .from('batches')
        .update({ quantity: newBalance, updated_at: new Date().toISOString() })
        .eq('id', batch_id);
    }

    // 3. Insert stock movement record
    const { data: movement, error: moveError } = await supabase
      .from('stock_movements')
      .insert({
        medicine_id,
        batch_id: batch_id || null,
        movement_type,
        quantity_change,
        balance_after: newBalance,
        reason: reason || 'Manual stock adjustment',
        created_by: created_by || null,
      })
      .select()
      .single();

    if (moveError) {
      return NextResponse.json({ error: moveError.message }, { status: 500 });
    }

    // 4. Record in audit log
    await supabase.from('audit_log').insert({
      table_name: 'stock_movements',
      record_id: movement.id,
      action: quantity_change >= 0 ? 'INSERT' : 'UPDATE',
      new_data: {
        movement_type,
        quantity_change,
        balance_after: newBalance,
        reason,
      },
      changed_by: created_by || null,
      changed_by_name: user_name || 'Staff Member',
      changed_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      movement,
      new_balance: newBalance,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
