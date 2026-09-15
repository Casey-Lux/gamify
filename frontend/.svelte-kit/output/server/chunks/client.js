import { createClient } from "@supabase/supabase-js";
const PUBLIC_SUPABASE_URL = "https://your-project-ref.supabase.co";
const PUBLIC_SUPABASE_PUBLISHABLE_KEY = "your-anon-public-key";
const supabase = createClient(PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});
export {
  supabase as s
};
