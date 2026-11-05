import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, full_name, role, phone } = body;

    if (!email || !full_name || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const adminClient = createAdminClient();

    if (!adminClient) {
      // In demo mode or keys not set, respond with demo success
      return NextResponse.json({
        success: true,
        message: 'Saved in offline demo mode',
        user: { email, full_name, role, phone },
      });
    }

    // Generate random secure temporary password
    const temporaryPassword = 'Staff@' + Math.floor(100000 + Math.random() * 900000);

    // Create user via Supabase Admin Auth API (bypasses public signup restriction)
    const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        full_name,
        role,
      },
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    // Ensure profile row exists with correct role
    if (authUser.user) {
      await adminClient.from('profiles').upsert({
        id: authUser.user.id,
        email,
        full_name,
        role,
        phone: phone || null,
        is_active: true,
        updated_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      userId: authUser.user?.id,
      temporaryPassword,
      message: `User created. Temporary password: ${temporaryPassword}`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
