import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ScheduledBroadcast {
  id: string;
  title: string;
  body: string;
  broadcast_type: 'official' | 'emergency' | 'weather' | 'maintenance';
  target: { scope: string; segment: string };
  scheduled_at: string;
  created_by: string;
}

async function deliverBroadcast(
  supabase: any,
  payload: { title: string; body: string; type: string; target: string; segment: string }
): Promise<{ recipients: number; pushed: number }> {
  // Get all users matching target + segment
  let query = supabase.from('profiles').select('id, city, is_verified, role');

  if (payload.target !== 'all') {
    query = query.ilike('city', `%${payload.target}%`);
  }

  const { data: users, error: usersErr } = await query.limit(500);
  if (usersErr) throw usersErr;

  let filtered = users || [];
  if (payload.segment === 'verified') {
    filtered = filtered.filter((u: any) => u.is_verified);
  } else if (payload.segment === 'unverified') {
    filtered = filtered.filter((u: any) => !u.is_verified);
  } else if (payload.segment === 'admins') {
    filtered = filtered.filter((u: any) => u.role === 'admin');
  }

  const recipientIds = filtered.map((u: any) => u.id).filter(Boolean);
  if (!recipientIds.length) throw new Error('لا يوجد مستخدمون مطابقون');

  const badgeIcon =
    payload.type === 'emergency' ? '🚨' :
    payload.type === 'weather' ? '⛈️' :
    payload.type === 'maintenance' ? '🔧' : '📢';

  const fullTitle = `${badgeIcon} ${payload.title.trim()}`;
  const fullBody = payload.body.trim();

  // Bulk insert notifications
  const rows = recipientIds.map((uid: string) => ({
    user_id: uid,
    type: 'broadcast',
    title: fullTitle,
    body: fullBody,
    data: { broadcast_type: payload.type, target: payload.target, segment: payload.segment },
  }));

  for (let i = 0; i < rows.length; i += 400) {
    const { error } = await supabase.from('notifications').insert(rows.slice(i, i + 400));
    if (error) throw error;
  }

  // Push via web-push (Edge Function has service role)
  const pushResult = await sendPushToUsers(supabase, recipientIds, {
    title: fullTitle,
    body: fullBody,
    data: { type: 'broadcast', broadcast_type: payload.type, target: payload.target, segment: payload.segment },
  });

  return { recipients: recipientIds.length, pushed: pushResult.sentCount || 0 };
}

async function sendPushToUsers(supabase: any, userIds: string[], payload: any): Promise<{ sentCount: number }> {
  // Get push tokens for these users (Expo + Web)
  const { data: tokens, error } = await supabase
    .from('push_tokens')
    .select('token, platform')
    .in('user_id', userIds);
  if (error) throw error;

  const expoTokens = (tokens || []).filter((t: any) => t.platform === 'expo').map((t: any) => t.token);
  const webTokens = (tokens || []).filter((t: any) => t.platform === 'web').map((t: any) => t.token);

  let sentCount = 0;

  // Expo push
  if (expoTokens.length) {
    const chunks = chunkArray(expoTokens, 100);
    for (const chunk of chunks) {
      try {
        const res = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(chunk.map((token: string) => ({ to: token, ...payload }))),
        });
        const data = await res.json();
        sentCount += data.data?.filter((d: any) => d.status === 'ok').length || 0;
      } catch (e) {
        console.error('Expo push error:', e);
      }
    }
  }

  // Web push (VAPID)
  if (webTokens.length) {
    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@hayna.app';
    if (vapidPublic && vapidPrivate) {
      // Use web-push logic here (simplified)
      for (const token of webTokens) {
        try {
          await sendWebPush(token, payload, vapidPublic, vapidPrivate, vapidSubject);
          sentCount++;
        } catch (e) {
          console.error('Web push error:', e);
        }
      }
    }
  }

  return { sentCount };
}

async function sendWebPush(token: string, payload: any, publicKey: string, privateKey: string, subject: string) {
  // Simplified web-push implementation using crypto.subtle
  // In production, use a proper web-push library
  const endpoint = token;
  const subscription = JSON.parse(token); // Expecting {endpoint, keys: {p256dh, auth}}
  const vapidHeaders = generateVapidHeaders(endpoint, publicKey, privateKey, subject);

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'TTL': '86400',
      ...vapidHeaders,
    },
    body: encryptPayload(JSON.stringify(payload), subscription.keys),
  });

  if (!res.ok) throw new Error(`Web push failed: ${res.status}`);
}

function generateVapidHeaders(endpoint: string, publicKey: string, privateKey: string, subject: string) {
  // Simplified - in real implementation use proper JWT signing
  return {};
}

function encryptPayload(payload: string, keys: any): Uint8Array {
  // Simplified - real implementation needs proper encryption
  return new TextEncoder().encode(payload);
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
    const now = new Date().toISOString();

    // Fetch pending broadcasts due now
    const { data: pending, error } = await supabase
      .from('scheduled_broadcasts')
      .select('*')
      .eq('status', 'pending')
      .lte('scheduled_at', now)
      .order('scheduled_at', { ascending: true });

    if (error) throw error;

    const results = [];
    for (const broadcast of pending || []) {
      try {
        const res = await deliverBroadcast(supabase, {
          title: broadcast.title,
          body: broadcast.body,
          type: broadcast.broadcast_type,
          target: broadcast.target?.scope || 'all',
          segment: broadcast.target?.segment || 'all',
        });

        await supabase
          .from('scheduled_broadcasts')
          .update({ status: 'sent', sent_at: new Date().toISOString() })
          .eq('id', broadcast.id);

        // Audit log
        await supabase.from('admin_activity_logs').insert({
          actor_id: broadcast.created_by,
          action: 'إرسال تعميم مجدول',
          target_type: 'broadcast',
          target_id: broadcast.id,
          metadata: { ...res, title: broadcast.title },
        });

        results.push({ id: broadcast.id, ...res, status: 'sent' });
      } catch (e: any) {
        await supabase
          .from('scheduled_broadcasts')
          .update({ status: 'failed', metadata: { error: e.message } })
          .eq('id', broadcast.id);
        results.push({ id: broadcast.id, status: 'failed', error: e.message });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});