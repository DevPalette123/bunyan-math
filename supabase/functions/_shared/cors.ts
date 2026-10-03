// Shared by every function in supabase/functions/*. Supabase Edge Functions
// are invoked directly from the browser via supabase.functions.invoke(), so
// each one needs to answer CORS preflight (OPTIONS) requests itself — there
// is no separate API gateway doing this for us.
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
