import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

export function getSupabase() {
  if (client !== undefined) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  client = url && publishableKey
    ? createClient(url, publishableKey, {
        auth: {
          persistSession: true,
          detectSessionInUrl: true,
          autoRefreshToken: true,
        },
      })
    : null;

  return client;
}
