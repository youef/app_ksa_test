import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type RoomRole = 'host' | 'viewer' | 'guest';

export function useLiveRoomHeartbeat(streamId: string | undefined, userId: string, role: RoomRole, startedAt?: string) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!streamId || !userId) return;
    let active = true;
    const heartbeat = async () => {
      if (!active) return;
      const now = new Date().toISOString();
      if (role === 'host') {
        const { error } = await supabase.from('live_streams').update({ updated_at: now })
          .eq('id', streamId).eq('host_id', userId).eq('status', 'live');
        if (error) console.warn('Live host heartbeat failed:', error.message);
      } else {
        const { error } = await supabase.from('live_viewer_sessions')
          .upsert({ stream_id: streamId, viewer_id: userId, last_seen_at: now }, { onConflict: 'stream_id,viewer_id' });
        if (error) console.warn('Live viewer heartbeat failed:', error.message);
      }
    };
    void heartbeat();
    const timer = setInterval(() => { void heartbeat(); }, 20_000);
    return () => {
      active = false;
      clearInterval(timer);
      if (role !== 'host') {
        void supabase.from('live_viewer_sessions').delete().eq('stream_id', streamId).eq('viewer_id', userId);
      }
    };
  }, [streamId, userId, role]);

  useEffect(() => {
    if (!startedAt) { setElapsedSeconds(0); return; }
    const update = () => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)));
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  return elapsedSeconds;
}
