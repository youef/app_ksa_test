import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type LiveEffect = {
  id: string;
  emoji: string;
  name?: string;
  kind: 'heart' | 'gift';
};

const MAX_EFFECTS = 6;

export function useLiveEffects(streamId?: string, enabled = true) {
  const [effects, setEffects] = useState<LiveEffect[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const pushEffect = useCallback((input: Omit<LiveEffect, 'id'>) => {
    const entry: LiveEffect = { id: `${Date.now()}-${Math.random()}`, ...input };
    setEffects((items) => [...items, entry].slice(-MAX_EFFECTS));
    const timer = setTimeout(() => {
      timersRef.current.delete(entry.id);
      setEffects((items) => items.filter((item) => item.id !== entry.id));
    }, 2400);
    timersRef.current.set(entry.id, timer);
  }, []);

  useEffect(() => {
    if (!streamId || !enabled) return;
    const channel = supabase.channel(`live-effects:${streamId}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'heart' }, ({ payload }) => {
        pushEffect({
          emoji: typeof payload?.emoji === 'string' ? payload.emoji : '💚',
          name: typeof payload?.name === 'string' ? payload.name : undefined,
          kind: 'heart',
        });
      })
      .on('broadcast', { event: 'gift' }, ({ payload }) => {
        pushEffect({
          emoji: typeof payload?.emoji === 'string' ? payload.emoji : '🎁',
          name: typeof payload?.name === 'string' ? payload.name : undefined,
          kind: 'gift',
        });
      })
      .subscribe();
    channelRef.current = channel;

    return () => {
      if (channelRef.current === channel) channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [streamId, enabled, pushEffect]);

  useEffect(() => () => {
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current.clear();
  }, []);

  return { effects, pushEffect, channelRef };
}
