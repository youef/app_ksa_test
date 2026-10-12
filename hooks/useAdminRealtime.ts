import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface AdminRealtimeSignals {
  /** Tables that had an INSERT since the last reset. */
  pending: string[];
  /** Total number of realtime events observed since mount/reset. */
  total: number;
  /** Human-readable label of the most recent event. */
  lastLabel: string | null;
  /** Increments whenever the admin should re-fetch dashboard data. */
  refreshTick: number;
  reset: () => void;
}

const TABLE_LABELS: Record<string, string> = {
  reports: 'بلاغ جديد',
  verification_requests: 'طلب توثيق جديد',
  urgent_alerts: 'تنبيه طارئ جديد',
  questions: 'منشور جديد في الحي',
  requests: 'طلب مساعدة جديد',
};

/**
 * Subscribes to moderation-relevant INSERTs so the admin dashboard can update
 * live. Falls back silently when Realtime is unavailable for a table.
 */
export function useAdminRealtime(enabled: boolean): AdminRealtimeSignals {
  const [pending, setPending] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [lastLabel, setLastLabel] = useState<string | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);
  const channelRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = () => {
    setPending([]);
    setTotal(0);
    setLastLabel(null);
  };

  useEffect(() => {
    if (!enabled) return;
    let disposed = false;

    const onEvent = (table: string) => {
      setTotal((t) => t + 1);
      setLastLabel(TABLE_LABELS[table] || 'تحديث جديد');
      setPending((prev) => (prev.includes(table) ? prev : [...prev, table]));
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setRefreshTick((n) => n + 1), 1500);
    };

    const setup = async () => {
      if (channelRef.current) await supabase.removeChannel(channelRef.current);
      if (disposed) return;
      const suffix = Math.random().toString(36).slice(2);
      const channel = supabase
        .channel(`admin-live-${suffix}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reports' }, () => onEvent('reports'))
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'verification_requests' }, () => onEvent('verification_requests'))
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'urgent_alerts' }, () => onEvent('urgent_alerts'))
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'questions' }, () => onEvent('questions'))
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'requests' }, () => onEvent('requests'));
      channel.subscribe();
      if (disposed) {
        void supabase.removeChannel(channel);
        return;
      }
      channelRef.current = channel;
    };

    void setup();

    return () => {
      disposed = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      const channel = channelRef.current;
      channelRef.current = null;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [enabled]);

  return { pending, total, lastLabel, refreshTick, reset };
}
