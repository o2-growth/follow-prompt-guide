// Healthcheck Edge Function
// Returns 200 if app + DB are reachable, 503 otherwise.
// Public — no auth required (UptimeRobot will hit it every 5 min).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_ANON_KEY");

  if (!url || !key) {
    return new Response(
      JSON.stringify({
        status: "down",
        error: "missing SUPABASE_URL or SUPABASE_ANON_KEY env",
        timestamp: new Date().toISOString(),
      }),
      {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  try {
    const sb = createClient(url, key);
    // Cheap read against a known seed table. RLS allows select.
    const { error } = await sb.from("ritual_templates").select("id").limit(1);
    const ok = !error;

    return new Response(
      JSON.stringify({
        status: ok ? "ok" : "degraded",
        timestamp: new Date().toISOString(),
        db: ok ? "up" : "down",
        error: error?.message ?? null,
      }),
      {
        status: ok ? 200 : 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({
        status: "down",
        error: String(e),
        timestamp: new Date().toISOString(),
      }),
      {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
