import { createClient } from '@supabase/supabase-js';

// WARNING: This client uses the Supabase service role key.
// It bypasses Row Level Security and MUST ONLY be used on the server in secure API routes or Server Actions.
// NEVER expose this client or SUPABASE_SERVICE_ROLE_KEY to the browser!
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
