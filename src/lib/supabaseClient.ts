import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
  // We don't throw here — the app still renders (with a clear notice on the
  // login page) so the homepage/demo keeps working even before Supabase is
  // connected. Anything that actually calls `supabase.auth...` will fail
  // loudly, which is what we want instead of a silent mock.
  // eslint-disable-next-line no-console
  console.warn(
    "[بنيان الرياضيات] لم يتم ضبط VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. " +
      "أنشئ ملف .env بالقيم الصحيحة (راجع .env.example)."
  );
}

export const supabase = createClient<Database>(
  supabaseUrl ?? "https://placeholder.supabase.co",
  supabaseAnonKey ?? "placeholder-anon-key"
);
