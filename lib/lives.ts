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

export type LiveChatMessage = {
  id: string;
  stream_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  profiles?: { display_name: string | null; username: string | null; avatar_url: string | null } | null;
};

const STREAM_FIELDS = `id,host_id,title,category,audience,room_name,status,viewer_count,peak_viewer_count,started_at,updated_at,
  profiles!live_streams_host_id_fkey(id,display_name,username,avatar_url,is_verified,city,district)`;

export async function fetchLiveStreams() {
  const { data, error } = await supabase
    .from('live_streams')
    .select(STREAM_FIELDS)
    .eq('status', 'live')
    .gt('updated_at', new Date(Date.now() - 90_000).toISOString())
    .order('started_at', { ascending: false })
    .limit(80);
  if (error) throw error;
  const streams = (data || []) as unknown as LiveStream[];
  if (!streams.length) return streams;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return streams;
  const { data: sessions } = await supabase.from('live_viewer_sessions').select('stream_id')
    .in('stream_id', streams.map((stream) => stream.id))
    .gt('last_seen_at', new Date(Date.now() - 45_000).toISOString());
  const counts = new Map<string, number>();
  for (const session of sessions || []) counts.set(session.stream_id, (counts.get(session.stream_id) || 0) + 1);
  return streams.map((stream) => ({ ...stream, viewer_count: (counts.get(stream.id) || 0) + 1 }));
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
  const { error } = await supabase.from('live_streams')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', streamId).eq('status', 'live');
  if (error) throw error;
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

