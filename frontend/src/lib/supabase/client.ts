import { createClient } from '@supabase/supabase-js';
import { PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY } from '$env/static/public';

/**
 * Single Supabase client for the whole app. Only the public URL and the
 * publishable (anon) key are used here — both are meant to be public (spec
 * section 49). Real data protection comes from RLS + column privileges +
 * SECURITY DEFINER RPCs on the Postgres side, not from hiding this key.
 */
export const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
