import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Klipport: missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. " +
    "Copy client/.env.example to client/.env and fill in the values, then restart the dev server."
  );
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey);
