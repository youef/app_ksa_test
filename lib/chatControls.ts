import { supabase } from './supabase';

export type DndSchedule = 'off' | 'nightly' | 'custom';

export type DndSettings = {
  enabled: boolean;
  schedule: DndSchedule;
  start: string | null;
  end: string | null;
};

export type ConvSettings = {
  muted: boolean;
  archived: boolean;
  clearedAt: string | null;
};

export type MutationResult = { ok: true } | { ok: false; error: string };

const MISSING_FN = ['PGRST202', '42883', '404', 'does not exist', 'not found'];

function isMissingFunction(error: any): boolean {
  if (!error) return false;
  const text = `${error.code || ''} ${error.message || ''}`.toLowerCase();
  return MISSING_FN.some(token => text.includes(token.toLowerCase()));
}

/**
 * Prefer the database function; fall back to a direct table write so the
 * feature still works if setup_chat_controls.sql has not been run yet.
 */
async function rpcOr(rpc: string, args: Record<string, any>, fallback: () => Promise<void>): Promise<void> {
  const { error } = await supabase.rpc(rpc, args);
  if (!error) return;
  if (isMissingFunction(error)) {
    await fallback();
    return;
  }
  throw new Error(error.message);
}

export function fail(error: unknown): MutationResult {
  const message = error instanceof Error ? error.message : String(error);
  return { ok: false, error: message };
}

// ---------------------------------------------------------------- DND

export const DEFAULT_DND: DndSettings = {
  enabled: false,
  schedule: 'off',
  start: '22:00',
  end: '07:00',
};

export async function loadDnd(userId: string): Promise<DndSettings> {
  const { data } = await supabase
    .from('profiles')
    .select('dnd_enabled, dnd_schedule, dnd_start, dnd_end')
    .eq('id', userId)
    .maybeSingle();

  if (!data) return DEFAULT_DND;

  return {
    enabled: !!data.dnd_enabled,
    schedule: (data.dnd_schedule as DndSchedule) || 'off',
    start: toTimeString(data.dnd_start) || DEFAULT_DND.start,
    end: toTimeString(data.dnd_end) || DEFAULT_DND.end,
  };
}

function toTimeString(value: string | null): string | null {
  if (!value) return null;
  return String(value).slice(0, 5);
}

export async function saveDnd(userId: string, next: DndSettings): Promise<MutationResult> {
  try {
    if (next.schedule === 'custom' && (!isValidTime(next.start) || !isValidTime(next.end) || next.start === next.end)) {
      return { ok: false, error: 'أدخل وقتين صالحين ومختلفين بصيغة HH:MM.' };
    }
    await rpcOr(
      'set_dnd',
      {
        p_enabled: next.enabled,
        p_schedule: next.schedule,
        p_start: next.start ? `${next.start}:00` : null,
        p_end: next.end ? `${next.end}:00` : null,
      },
      async () => {
        const { error } = await supabase
          .from('profiles')
          .update({
            dnd_enabled: next.enabled,
            dnd_schedule: next.schedule,
            dnd_start: next.start ? `${next.start}:00` : null,
            dnd_end: next.end ? `${next.end}:00` : null,
          })
          .eq('id', userId);
        if (error) throw new Error(error.message);
      }
    );
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Mirrors public.is_dnd_active() so the UI shows the truth immediately. */
export function isDndActiveNow(dnd: DndSettings, now: Date = new Date()): boolean {
  if (!dnd.enabled) return false;
  if (dnd.schedule === 'off') return true;
  const start = dnd.schedule === 'nightly' ? '22:00' : dnd.start;
  const end = dnd.schedule === 'nightly' ? '07:00' : dnd.end;
  if (!start || !end) return true;

  const current = now.getHours() * 60 + now.getMinutes();
  const from = toMinutes(start);
  const to = toMinutes(end);

  if (from > to) return current >= from || current < to;
  return current >= from && current < to;
}

function isValidTime(time: string | null): time is string {
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return false;
  const [hours, minutes] = time.split(':').map(Number);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}

export function dndLabel(dnd: DndSettings): string {
  if (!dnd.enabled) return 'إشعارات عادية';
  if (dnd.schedule === 'off') return 'عدم الإزعاج مفعّل';
  if (dnd.schedule === 'nightly') return 'صامت من 10 م إلى 7 ص';
  return `صامت من ${formatArabicTime(dnd.start)} إلى ${formatArabicTime(dnd.end)}`;
}

export function formatArabicTime(time: string | null): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const period = (h || 0) < 12 ? 'ص' : 'م';
  const hour12 = (h || 0) % 12 === 0 ? 12 : (h || 0) % 12;
  return `${hour12}:${String(m || 0).padStart(2, '0')} ${period}`;
}

// ---------------------------------------------------- conversation settings

export async function loadConvSettings(
  userId: string,
  conversationIds: string[]
): Promise<Record<string, ConvSettings>> {
  if (conversationIds.length === 0) return {};

  const { data } = await supabase
    .from('conversation_member_settings')
    .select('conversation_id, muted, archived, cleared_at')
    .eq('user_id', userId)
    .in('conversation_id', conversationIds);

  const map: Record<string, ConvSettings> = {};
  (data || []).forEach((row: any) => {
    map[row.conversation_id] = {
      muted: !!row.muted,
      archived: !!row.archived,
      clearedAt: row.cleared_at || null,
    };
  });
  return map;
}

export async function setMute(
  userId: string,
  conversationId: string,
  muted: boolean
): Promise<MutationResult> {
  try {
    await rpcOr(
      'set_conversation_mute',
      { p_conversation_id: conversationId, p_muted: muted },
      async () => {
        const { error } = await supabase
          .from('conversation_member_settings')
          .upsert(
            { conversation_id: conversationId, user_id: userId, muted, updated_at: new Date().toISOString() },
            { onConflict: 'conversation_id,user_id' }
          );
        if (error) throw new Error(error.message);
      }
    );
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** "مسح عندي" — hides every message for me only. The other side keeps their copy. */
export async function clearForMe(userId: string, conversationId: string): Promise<MutationResult> {
  try {
    await rpcOr('clear_conversation_for_me', { p_conversation_id: conversationId }, async () => {
      const { error } = await supabase
        .from('conversation_member_settings')
        .upsert(
          {
            conversation_id: conversationId,
            user_id: userId,
            cleared_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'conversation_id,user_id' }
        );
      if (error) throw new Error(error.message);
    });
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** "حذف المحادثة للجميع" — removes the conversation and every message in it. */
export async function deleteConversationForEveryone(conversationId: string): Promise<MutationResult> {
  try {
    await rpcOr('delete_conversation', { p_conversation_id: conversationId }, async () => {
      const { error } = await supabase.from('conversations').delete().eq('id', conversationId);
      if (error) throw new Error(error.message);
    });
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------- blocks

export async function setBlock(userId: string, targetId: string, blocked: boolean): Promise<MutationResult> {
  try {
    await rpcOr(
      'set_block',
      { p_user_id: targetId, p_blocked: blocked },
      async () => {
        if (blocked) {
          const { error } = await supabase
            .from('blocks')
            .upsert({ blocker_id: userId, blocked_id: targetId }, { onConflict: 'blocker_id,blocked_id' });
          if (error) throw new Error(error.message);
          await supabase
            .from('follows')
            .delete()
            .or(`and(follower_id.eq.${userId},following_id.eq.${targetId}),and(follower_id.eq.${targetId},following_id.eq.${userId})`);
        } else {
          const { error } = await supabase
            .from('blocks')
            .delete()
            .eq('blocker_id', userId)
            .eq('blocked_id', targetId);
          if (error) throw new Error(error.message);
        }
      }
    );
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function getBlockStatus(
  myId: string,
  targetId: string
): Promise<{ iBlocked: boolean; blockedMe: boolean }> {
  try {
    const { data: rows } = await supabase
      .from('blocks')
      .select('blocker_id, blocked_id')
      .or(
        `and(blocker_id.eq.${myId},blocked_id.eq.${targetId}),and(blocker_id.eq.${targetId},blocked_id.eq.${myId})`
      );

    let iBlocked = false;
    let blockedMe = false;
    (rows || []).forEach((r: any) => {
      if (r.blocker_id === myId && r.blocked_id === targetId) iBlocked = true;
      if (r.blocker_id === targetId && r.blocked_id === myId) blockedMe = true;
    });
    return { iBlocked, blockedMe };
  } catch (e) {
    return { iBlocked: false, blockedMe: false };
  }
}

export async function loadBlockedUsers(userId: string) {
  const { data } = await supabase
    .from('blocks')
    .select('blocked_id, created_at')
    .eq('blocker_id', userId)
    .order('created_at', { ascending: false });

  const ids = (data || []).map((b: any) => b.blocked_id);
  if (ids.length === 0) return [];

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, username, avatar_url, hide_name')
    .in('id', ids);

  const byId: Record<string, any> = {};
  (profiles || []).forEach((p: any) => {
    byId[p.id] = p;
  });

  return (data || []).map((b: any) => ({ ...byId[b.blocked_id], blockedAt: b.created_at }));
}

/** Runtime probe: are the chat-controls tables/functions deployed to Supabase? */
export async function checkChatControlsReady(): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('conversation_member_settings')
      .select('conversation_id')
      .limit(1);
    return !error;
  } catch (e) {
    return false;
  }
}

export function displayName(profile: any, fallback = 'جار'): string {
  if (!profile) return fallback;
  if (profile.hide_name === true) return 'جار مجهول 🕶️';
  return profile.display_name || profile.username || fallback;
}

// ---------------------------------------------------------------- messages

export async function markConversationRead(conversationId: string, userId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_messages_read', {
    p_conversation_id: conversationId,
    p_user_id: userId,
  });

  // Fallback for databases without the RPC.
  if (error && isMissingFunction(error)) {
    const { data: msgs } = await supabase
      .from('messages')
      .select('id, read_by, sender_id')
      .eq('conversation_id', conversationId)
      .neq('sender_id', userId);

    for (const msg of msgs || []) {
      const readBy: string[] = msg.read_by || [];
      if (readBy.includes(userId)) continue;
      await supabase
        .from('messages')
        .update({ read_by: [...readBy, userId] })
        .eq('id', msg.id);
    }
  }
}
