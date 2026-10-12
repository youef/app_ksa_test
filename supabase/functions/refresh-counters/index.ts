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
    // Get users who had activity in last 10 minutes (to limit scope)
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const { data: activeUsers, error } = await supabase
      .from('profiles')
      .select('id')
      .or(`updated_at.gte.${tenMinsAgo},notifications_unread_count.gt.0,services_count.gt.0,requests_count.gt.0`)
      .limit(500);

    if (error) throw error;

    const results = [];
    for (const user of activeUsers || []) {
      // Notifications unread count
      const { count: notifCount } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('read_at', null);

      // Services count
      const { count: svcCount } = await supabase
        .from('services')
        .select('*', { count: 'exact', head: true })
        .eq('provider_id', user.id);

      // Completed services
      const { count: svcDone } = await supabase
        .from('services')
        .select('*', { count: 'exact', head: true })
        .eq('provider_id', user.id)
        .eq('status', 'completed');

      // Requests count
      const { count: reqCount } = await supabase
        .from('requests')
        .select('*', { count: 'exact', head: true })
        .eq('requester_id', user.id);

      // Completed requests
      const { count: reqDone } = await supabase
        .from('requests')
        .select('*', { count: 'exact', head: true })
        .eq('requester_id', user.id)
        .eq('status', 'completed');

      // Reports against user
      const { count: repCount } = await supabase
        .from('reports')
        .select('*', { count: 'exact', head: true })
        .eq('target_id', user.id);

      // Questions
      const { count: qCount } = await supabase
        .from('questions')
        .select('*', { count: 'exact', head: true })
        .eq('author_id', user.id);

      // Answers
      const { count: aCount } = await supabase
        .from('answers')
        .select('*', { count: 'exact', head: true })
        .eq('author_id', user.id);

      await supabase.from('profiles').update({
        notifications_unread_count: notifCount || 0,
        services_count: svcCount || 0,
        completed_services_count: svcDone || 0,
        requests_count: reqCount || 0,
        completed_requests_count: reqDone || 0,
        reports_count: repCount || 0,
        questions_count: qCount || 0,
        answers_count: aCount || 0,
      }).eq('id', user.id);

      results.push(user.id);
    }

    return new Response(JSON.stringify({ updated: results.length, users: results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});