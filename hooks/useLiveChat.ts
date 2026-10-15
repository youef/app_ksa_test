import { useCallback, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { sendLiveMessage, type LiveChatMessage } from '@/lib/lives';

const CHAT_BASE_FIELDS = 'id,stream_id,sender_id,body,created_at,profiles!live_chat_messages_sender_id_fkey(display_name,username,avatar_url,is_verified)';

export function useLiveChat(streamId?: string) {
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [pinnedMessage, setPinnedMessage] = useState<LiveChatMessage | null>(null);
  const [sending, setSending] = useState(false);
  const chatExtrasRef = useRef(true);

  const loadMessages = useCallback(async (streamIdOverride?: string) => {
    const targetId = streamIdOverride || streamId;
    if (!targetId) return;
    const withExtras = `${CHAT_BASE_FIELDS},is_pinned,sender_role`;
    let rows: LiveChatMessage[] = [];
    let queryError: unknown = null;

    if (chatExtrasRef.current) {
      const result = await supabase.from('live_chat_messages')
        .select(withExtras)
        .eq('stream_id', targetId).eq('is_hidden', false)
        .order('created_at', { ascending: false }).limit(10);
      if (result.error) chatExtrasRef.current = false;
      else rows = ((result.data || []).reverse()) as unknown as LiveChatMessage[];
      queryError = result.error;
    }

    if (!chatExtrasRef.current) {
      const result = await supabase.from('live_chat_messages')
        .select(CHAT_BASE_FIELDS)
        .eq('stream_id', targetId).eq('is_hidden', false)
        .order('created_at', { ascending: false }).limit(10);
      if (result.error) throw result.error;
      rows = ((result.data || []).reverse()) as unknown as LiveChatMessage[];
      setPinnedMessage(null);
    } else if (queryError) {
      throw queryError;
    }

    setMessages(rows);
    if (chatExtrasRef.current) {
      const { data: pin } = await supabase.from('live_chat_messages')
        .select(withExtras)
        .eq('stream_id', targetId).eq('is_hidden', false).eq('is_pinned', true).maybeSingle();
      setPinnedMessage((pin as unknown as LiveChatMessage) || null);
    }
  }, [streamId]);

  const sendMessage = useCallback(async (body: string) => {
    const cleanBody = body.trim().slice(0, 300);
    if (!streamId || !cleanBody || sending) return false;
    setSending(true);
    try {
      await sendLiveMessage(streamId, cleanBody);
      return true;
    } finally {
      setSending(false);
    }
  }, [streamId, sending]);

  return { messages, pinnedMessage, sending, loadMessages, sendMessage };
}
