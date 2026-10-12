import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendPushToAdmins(supabase: any, adminIds: string[], payload: any) {
  const { data: tokens } = await supabase
    .from('push_tokens')
    .select('token, platform')
    .in('user_id', adminIds);

  const expoTokens = (tokens || []).filter((t: any) => t.platform === 'expo').map((t: any) => t.token);

  if (expoTokens.length) {
    const chunks = chunkArray(expoTokens, 100);
    for (const chunk of chunks) {
      try {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(chunk.map((token: string) => ({ to: token, ...payload }))),
        });
      } catch (e) {
        console.error('Expo push error:', e);
      }
    }
  }
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Determine last Monday
    const now = new Date();
    const day = now.getDay(); // 0=Sun
    const diff = day === 0 ? -6 : 1 - day; // Monday
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    const weekMonday = monday.toISOString().split('T')[0];

    // Generate report via RPC
    const { data: report, error: rpcErr } = await supabase.rpc('generate_weekly_report', {
      p_week_monday: weekMonday,
    });
    if (rpcErr) throw rpcErr;

    // Get admin user IDs
    const { data: admins } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
      .eq('is_banned', false);
    const adminIds = (admins || []).map((a: any) => a.id);

    // Send push to admins
    await sendPushToAdmins(supabase, adminIds, {
      title: `📊 التقرير الأسبوعي - ${report.week}`,
      body: `مستخدمون جدد: ${report.summary.new_users} · بلاغات: ${report.summary.reports_total} · خدمات: ${report.summary.services_new}`,
      data: { type: 'weekly_report', week: report.week, report },
    });

    // Also create in-app notifications for admins
    if (adminIds.length) {
      const notifRows = adminIds.map((uid: string) => ({
        user_id: uid,
        type: 'weekly_report',
        title: `📊 التقرير الأسبوعي - ${report.week}`,
        body: `ملخص الأسبوع: ${report.summary.new_users} مستخدم جديد، ${report.summary.reports_total} بلاغ، ${report.summary.services_new} خدمة جديدة.`,
        data: { type: 'weekly_report', week: report.week },
      }));

      for (let i = 0; i < notifRows.length; i += 400) {
        await supabase.from('notifications').insert(notifRows.slice(i, i + 400));
      }
    }

    return new Response(JSON.stringify({ week: weekMonday, sentTo: adminIds.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});