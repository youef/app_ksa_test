import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AccessToken, RoomServiceClient } from 'npm:livekit-server-sdk@2.19.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function respond(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return respond({ error: 'Method not allowed' }, 405);

  const authorization = req.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return respond({ error: 'سجّل الدخول للانضمام إلى البث.' }, 401);
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
  const livekitUrl = Deno.env.get('LIVEKIT_URL');
  const livekitKey = Deno.env.get('LIVEKIT_API_KEY');
  const livekitSecret = Deno.env.get('LIVEKIT_API_SECRET');
  if (!supabaseUrl || !supabaseKey || !livekitUrl || !livekitKey || !livekitSecret) {
    return respond({ error: 'خدمة البث غير مكتملة الإعداد. أضف إعدادات LiveKit إلى الخادم.' }, 503);
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await supabase.auth.getUser();
    const user = userData.user;
    if (userError || !user) return respond({ error: 'انتهت الجلسة. سجّل الدخول مجددًا.' }, 401);

    const body = await req.json();
    const streamId = typeof body.stream_id === 'string' ? body.stream_id : '';
    const intent = body.intent;
    if (!streamId) return respond({ error: 'طلب غير صالح.' }, 400);

    const { data: stream, error: streamError } = await supabase.from('live_streams')
      .select('id,host_id,room_name,status,audience,updated_at,started_at').eq('id', streamId).maybeSingle();
    if (streamError || !stream || stream.status !== 'live') return respond({ error: 'انتهى هذا البث أو لم يعد متاحًا.' }, 404);
    if (stream.host_id !== user.id && Date.now() - new Date(stream.updated_at || stream.started_at).getTime() > 90_000) {
      return respond({ error: 'انقطع اتصال المضيف وانتهى البث.' }, 404);
    }

    if (body.action === 'remove_guest') {
      const guestId = typeof body.guest_id === 'string' ? body.guest_id : '';
      if (stream.host_id !== user.id || !guestId || guestId === user.id) return respond({ error: 'غير مصرح بإزالة هذا المستخدم.' }, 403);
      const { data: guestRequest } = await supabase.from('live_guest_requests').select('id')
        .eq('stream_id', stream.id).eq('guest_id', guestId).eq('status', 'accepted').maybeSingle();
      if (!guestRequest) return respond({ error: 'هذا المستخدم ليس ضيفًا مقبولًا في البث.' }, 404);
      const adminRoom = new RoomServiceClient(livekitUrl, livekitKey, livekitSecret);
      try { await adminRoom.removeParticipant(stream.room_name, guestId); } catch { /* A guest may already have disconnected. */ }
      const { error: removeError } = await supabase.from('live_guest_requests')
        .update({ status: 'removed', decided_at: new Date().toISOString() }).eq('id', guestRequest.id);
      if (removeError) throw removeError;
      return respond({ removed: true });
    }

    if (!['host', 'viewer', 'guest'].includes(intent)) return respond({ error: 'طلب غير صالح.' }, 400);

    const { data: profile } = await supabase.from('profiles')
      .select('display_name,username,city').eq('id', user.id).maybeSingle();
    const name = profile?.display_name || profile?.username || 'جارٍ';
    let canPublish = false;
    if (intent === 'host') {
      if (stream.host_id !== user.id) return respond({ error: 'هذه الغرفة متاحة للمضيف فقط.' }, 403);
      canPublish = true;
    } else if (intent === 'guest') {
      const { data: request } = await supabase.from('live_guest_requests').select('id')
        .eq('stream_id', stream.id).eq('guest_id', user.id).eq('status', 'accepted').maybeSingle();
      if (!request) return respond({ error: 'لم يقبل المضيف طلب الصعود بعد.' }, 403);
      canPublish = true;
    } else if (stream.audience === 'followers') {
      const { data: follow } = await supabase.from('follows').select('id')
        .eq('follower_id', user.id).eq('following_id', stream.host_id).maybeSingle();
      if (!follow && stream.host_id !== user.id) return respond({ error: 'هذا البث للمتابعين فقط.' }, 403);
    } else if (stream.audience === 'city' && stream.host_id !== user.id) {
      const { data: hostProfile } = await supabase.from('profiles').select('city').eq('id', stream.host_id).maybeSingle();
      if (!profile?.city || !hostProfile?.city || profile.city.toLocaleLowerCase() !== hostProfile.city.toLocaleLowerCase()) {
        return respond({ error: 'هذا البث مخصص لأهالي مدينة المضيف.' }, 403);
      }
    }

    const { data: blocked } = await supabase.from('live_user_blocks').select('stream_id')
      .eq('stream_id', stream.id).eq('blocked_user_id', user.id).maybeSingle();
    if (blocked) return respond({ error: 'لا يمكنك الانضمام إلى هذا البث.' }, 403);

    const accessToken = new AccessToken(livekitKey, livekitSecret, {
      identity: user.id,
      name,
      ttl: '15m',
      attributes: { hayna_user_id: user.id, stream_id: stream.id, role: intent },
    });
    accessToken.addGrant({
      roomJoin: true,
      room: stream.room_name,
      canSubscribe: true,
      canPublish,
      canPublishData: canPublish,
    });
    return respond({ token: await accessToken.toJwt(), url: livekitUrl, identity: user.id });
  } catch (error) {
    console.error('livekit-token failed', error);
    return respond({ error: 'تعذر تجهيز الدخول للبث. حاول مرة أخرى.' }, 500);
  }
});
