import { supabase } from '@/lib/supabase';

export type LiveStream = {
  id: string;
  host_id: string;
  title: string;
  category: string;
  audience: 'public' | 'followers' | 'city';
  room_name: string;
  status: 'live' | 'ended';
  viewer_count: number;
  peak_viewer_count: number;
  started_at: string;
  updated_at?: string;
  guest_limit?: number;
  profiles?: {
    id: string;
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
    is_verified: boolean | null;
    city: string | null;
    district: string | null;
  } | null;
};

export type LiveChatRole = 'host' | 'guest' | 'viewer';

export type LiveChatMessage = {
  id: string;
  stream_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  is_pinned?: boolean;
  sender_role?: LiveChatRole;
  profiles?: { display_name: string | null; username: string | null; avatar_url: string | null; is_verified?: boolean | null } | null;
};

export type LiveGiftEvent = {
  id: string;
  stream_id: string;
  sender_id: string;
  emoji: '🎁' | '💎' | '🌟' | '🔥';
  created_at: string;
  profiles?: { display_name: string | null; username: string | null; avatar_url: string | null; is_verified: boolean | null } | null;
};

export type LiveHostLeader = {
  host_id: string;
  display_name: string;
  avatar_url: string | null;
  is_verified: boolean;
  stream_count: number;
  total_minutes: number;
  peak_viewers: number;
};

export type LiveLeaderboardPeriod = 'weekly' | 'monthly';

export type LiveAchievement = {
  key: string;
  title: string;
  description: string;
  emoji: string;
  earned: boolean;
  metric: number;
};

export const LIVE_ACHIEVEMENT_META: Record<string, { title: string; description: string; emoji: string }> = {
  first_stream: { title: 'أول بث', description: 'أكملت أول بث مباشر لك.', emoji: '🎬' },
  active_host: { title: 'مضيف نشط', description: 'قدّمت 4 بثوث خلال آخر 30 يومًا.', emoji: '🔥' },
  community_voice: { title: 'صوت المجتمع', description: 'بلغ مجموع بثك 60 دقيقة خلال شهر.', emoji: '🎙️' },
  neighborhood_star: { title: 'نجم الحي', description: 'وصل بثك إلى 25 مشاهدًا في وقت واحد.', emoji: '🌟' },
  consistent_host: { title: 'مضيف منتظم', description: 'بثثت في 5 أيام مختلفة خلال شهر.', emoji: '📅' },
};

export const LIVE_LEADERBOARD_PERIOD_LABEL: Record<LiveLeaderboardPeriod, string> = {
  weekly: 'هذا الأسبوع',
  monthly: 'هذا الشهر',
};


export type LiveSupporter = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  is_verified: boolean;
  gifts_count: number;
};

const STREAM_FIELDS = `id,host_id,title,category,audience,room_name,status,viewer_count,peak_viewer_count,started_at,updated_at,
  profiles!live_streams_host_id_fkey(id,display_name,username,avatar_url,is_verified,city,district)`;

export async function fetchLiveStreams() {
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user) {
    try {
      const { error: expiryError } = await supabase.rpc('expire_stale_live_streams');
      if (expiryError) {
        if (expiryError.code === 'PGRST202') {
          console.warn('Live-stream cleanup is not active until the lifecycle migration is applied.');
        } else {
          console.warn('Live-stream cleanup was skipped:', expiryError.message);
        }
      }
    } catch (e) {
      console.warn('Live-stream cleanup was skipped (unavailable).');
    }
  }
  const { data, error } = await supabase
    .from('live_streams')
    .select(STREAM_FIELDS)
    .eq('status', 'live')
    .gt('updated_at', new Date(Date.now() - 90_000).toISOString())
    .order('started_at', { ascending: false })
    .limit(80);
  if (error) throw error;
  const streams = (data || []) as unknown as LiveStream[];
  if (!streams.length || !auth.user) return streams;
  const { data: sessions } = await supabase.from('live_viewer_sessions').select('stream_id')
    .in('stream_id', streams.map((stream) => stream.id))
    .gt('last_seen_at', new Date(Date.now() - 45_000).toISOString());
  const counts = new Map<string, number>();
  for (const session of sessions || []) counts.set(session.stream_id, (counts.get(session.stream_id) || 0) + 1);
  return streams.map((stream) => ({ ...stream, viewer_count: (counts.get(stream.id) || 0) + 1 }));
}

export async function fetchLiveHostLeaderboard(period: LiveLeaderboardPeriod = 'monthly') {
  const { data, error } = await supabase.rpc('get_live_host_leaderboard', { p_period: period });
  if (error) throw error;
  return ((data || []) as LiveHostLeader[]) .map((host) => ({
    ...host,
    stream_count: Number(host.stream_count),
    total_minutes: Number(host.total_minutes),
    peak_viewers: Number(host.peak_viewers),
  }));
}

export async function fetchLiveHostAchievements(hostId: string) {
  const { data, error } = await supabase.rpc('get_live_host_achievements', { p_host_id: hostId });
  if (error) throw error;
  const rows = (data || []) as { key: string; earned: boolean; metric: number }[];
  return rows.map((row) => {
    const meta = LIVE_ACHIEVEMENT_META[row.key] || { title: row.key, description: '', emoji: '🏅' };
    return { key: row.key, ...meta, earned: Boolean(row.earned), metric: Number(row.metric) } as LiveAchievement;
  });
}

export async function fetchLiveSupporters(streamId: string) {
  const { data, error } = await supabase.rpc('get_live_supporters', { p_stream_id: streamId });
  if (error) throw error;
  return ((data || []) as LiveSupporter[]).map((supporter) => ({
    ...supporter,
    gifts_count: Number(supporter.gifts_count),
  }));
}

export async function createLiveStream(input: { title: string; category: string; audience: LiveStream['audience'] }) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('سجّل الدخول قبل بدء البث.');
  const { data, error } = await supabase
    .from('live_streams')
    .insert({ host_id: auth.user.id, ...input })
    .select('id,host_id,title,category,audience,room_name,status,viewer_count,peak_viewer_count,started_at')
    .single();
  if (error) throw error;
  return data as LiveStream;
}

export async function endLiveStream(streamId: string) {
  const { data, error } = await supabase.from('live_streams')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', streamId).eq('status', 'live').select('id').maybeSingle();
  if (error) throw error;
  if (data) return;
  const { data: existing, error: lookupError } = await supabase.from('live_streams')
    .select('status').eq('id', streamId).maybeSingle();
  if (lookupError) throw lookupError;
  if (existing?.status === 'ended') return;
  throw new Error('تعذر العثور على بث نشط تملكه لإنهائه.');
}

export async function getLiveToken(streamId: string, intent: 'host' | 'viewer' | 'guest') {
  const { data, error } = await supabase.functions.invoke('livekit-token', {
    body: { stream_id: streamId, intent },
  });
  if (error) throw new Error(error.message || 'تعذر الاتصال بخدمة البث.');
  if (!data?.token || !data?.url) throw new Error(data?.error || 'لم تصل بيانات الاتصال بالبث.');
  return data as { token: string; url: string; identity: string };
}

export async function requestLiveGuest(streamId: string) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('سجّل الدخول أولاً.');
  const { error } = await supabase.from('live_guest_requests').upsert(
    { stream_id: streamId, guest_id: auth.user.id, status: 'pending', decided_at: null },
    { onConflict: 'stream_id,guest_id' },
  );
  if (error) throw error;
}

export async function sendLiveMessage(streamId: string, body: string) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('سجّل الدخول للتعليق.');
  const { error } = await supabase.from('live_chat_messages').insert({
    stream_id: streamId,
    sender_id: auth.user.id,
    body: body.trim(),
  });
  if (error) throw new Error(error.message.includes('live_chat_messages') ? 'قاعدة البثوث غير مفعّلة بعد.' : 'تعذر إرسال التعليق.');
}

export async function reportLiveStream(streamId: string, reason: string) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error('سجّل الدخول للإبلاغ.');
  const { error } = await supabase.from('live_reports').insert({ stream_id: streamId, reporter_id: auth.user.id, reason });
  if (error) throw error;
}

export async function addLiveBlock(streamId: string, hostId: string, blockedUserId: string) {
  const { data, error } = await supabase.functions.invoke('livekit-token', {
    body: { action: 'remove_guest', stream_id: streamId, guest_id: blockedUserId },
  });
  if (error || data?.error) throw new Error(data?.error || error?.message || 'تعذر إزالة الضيف.');
  const { error: blockError } = await supabase.from('live_user_blocks').upsert({
    stream_id: streamId, host_id: hostId, blocked_user_id: blockedUserId,
  }, { onConflict: 'stream_id,blocked_user_id' });
  if (blockError) throw blockError;
}

export async function setLiveMessagePinned(streamId: string, messageId: string, pinned: boolean) {
  const { error } = await supabase.from('live_chat_messages')
    .update({ is_pinned: pinned }).eq('id', messageId).eq('stream_id', streamId);
  if (error) throw error;
}

export async function hideLiveMessage(streamId: string, messageId: string) {
  const { error } = await supabase.from('live_chat_messages')
    .update({ is_hidden: true }).eq('id', messageId).eq('stream_id', streamId);
  if (error) throw error;
}

export async function setLiveGuestMuted(streamId: string, guestId: string, muted: boolean) {
  const { error } = await supabase.from('live_guest_requests')
    .update({ is_muted: muted })
    .eq('stream_id', streamId).eq('guest_id', guestId).eq('status', 'accepted');
  if (error) throw error;
}
