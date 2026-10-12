import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    const cutoffISO = cutoff.toISOString();

    // Delete read notifications older than 90 days
    const { count, error } = await supabase
      .from('notifications')
      .delete()
      .lt('created_at', cutoffISO)
      .not('read_at', 'is', null);

    if (error) throw error;

    // Also delete unread notifications older than 180 days (spam protection)
    const cutoff180 = new Date();
    cutoff180.setDate(cutoff180.getDate() - 180);
    const cutoff180ISO = cutoff180.toISOString();

    const { count: count180, error: err180 } = await supabase
      .from('notifications')
      .delete()
      .lt('created_at', cutoff180ISO)
      .is('read_at', null);

    if (err180) throw err180;

    return new Response(JSON.stringify({
      deleted_read_90d: count || 0,
      deleted_unread_180d: count180 || 0,
      cutoff_90d: cutoffISO,
      cutoff_180d: cutoff180ISO,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});