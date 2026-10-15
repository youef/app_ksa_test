import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type LiveModerationSettings = {
  slow_mode_seconds: number;
  block_links: boolean;
  blocked_terms: string[];
  adaptive_enabled: boolean;
};
export type LiveModerator = {
  user_id: string;
  username: string;
  display_name: string | null;
  can_hide_comments: boolean;
  can_timeout_users: boolean;
  can_manage_filters: boolean;
};
const DEFAULT_SETTINGS: LiveModerationSettings = {
  slow_mode_seconds: 0,
  block_links: true,
  blocked_terms: [],
  adaptive_enabled: true,
};

export function useLiveModeration(streamId: string | undefined, enabled: boolean) {
  const [settings, setSettings] = useState<LiveModerationSettings>(DEFAULT_SETTINGS);
  const [moderators, setModerators] = useState<LiveModerator[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!streamId || !enabled) return;
    setLoading(true);
    try {
      const [settingsResult, moderatorsResult] = await Promise.all([
        supabase.from('live_stream_moderation_settings')
          .select('slow_mode_seconds,block_links,blocked_terms,adaptive_enabled')
          .eq('stream_id', streamId).maybeSingle(),
        supabase.from('live_stream_moderators')
          .select('user_id,can_hide_comments,can_timeout_users,can_manage_filters')
          .eq('stream_id', streamId),
      ]);
      if (settingsResult.error) throw settingsResult.error;
      if (moderatorsResult.error) throw moderatorsResult.error;
      const row = settingsResult.data;
      setSettings(row ? {
        slow_mode_seconds: Number(row.slow_mode_seconds) || 0,
        block_links: row.block_links !== false,
        blocked_terms: Array.isArray(row.blocked_terms) ? row.blocked_terms : [],
        adaptive_enabled: row.adaptive_enabled !== false,
      } : DEFAULT_SETTINGS);
      const ids = (moderatorsResult.data || []).map((item) => item.user_id);
      const profilesResult = ids.length
        ? await supabase.from('profiles').select('id,username,display_name').in('id', ids)
        : { data: [], error: null };
      if (profilesResult.error) throw profilesResult.error;
      const profileMap = new Map((profilesResult.data || []).map((p) => [p.id, p]));
      setModerators((moderatorsResult.data || []).map((item) => {
        const profile = profileMap.get(item.user_id);
        return {
          user_id: item.user_id,
          username: profile?.username || item.user_id.slice(0, 8),
          display_name: profile?.display_name || null,
          can_hide_comments: Boolean(item.can_hide_comments),
          can_timeout_users: Boolean(item.can_timeout_users),
          can_manage_filters: Boolean(item.can_manage_filters),
        };
      }));
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تحميل إعدادات الإشراف.');
    } finally {
      setLoading(false);
    }
  }, [streamId, enabled]);

  useEffect(() => { void refresh(); }, [refresh]);

  const saveSettings = useCallback(async (next: LiveModerationSettings) => {
    if (!streamId) throw new Error('البث غير محدد.');
    const { error: saveError } = await supabase.rpc('update_live_moderation_settings', {
      p_stream_id: streamId,
      p_slow_mode_seconds: next.slow_mode_seconds,
      p_block_links: next.block_links,
      p_blocked_terms: next.blocked_terms,
      p_adaptive_enabled: next.adaptive_enabled,
    });
    if (saveError) throw new Error(saveError.message);
    setSettings(next);
  }, [streamId]);

  const manageModerator = useCallback(async (username: string, action: 'add' | 'remove', permissions?: {
    can_hide_comments: boolean; can_timeout_users: boolean; can_manage_filters: boolean;
  }) => {
    if (!streamId) throw new Error('البث غير محدد.');
    const { error: actionError } = await supabase.rpc('manage_live_moderator', {
      p_stream_id: streamId, p_username: username.trim().replace(/^@/, ''), p_action: action,
      p_can_hide_comments: permissions?.can_hide_comments ?? true,
      p_can_timeout_users: permissions?.can_timeout_users ?? false,
      p_can_manage_filters: permissions?.can_manage_filters ?? false,
    });
    if (actionError) throw new Error(actionError.message);
    await refresh();
  }, [streamId, refresh]);

  const timeoutUser = useCallback(async (userId: string, minutes: number, reason = 'مخالفة قواعد البث') => {
    if (!streamId) throw new Error('البث غير محدد.');
    const { error: timeoutError } = await supabase.rpc('timeout_live_chat_user', {
      p_stream_id: streamId, p_user_id: userId, p_minutes: minutes, p_reason: reason,
    });
    if (timeoutError) throw new Error(timeoutError.message);
  }, [streamId]);

  return { settings, moderators, loading, error, refresh, saveSettings, manageModerator, timeoutUser };
}
