import { supabase } from '@/lib/supabase';

export const PLATFORM_NAME = 'منصة حيّنا';
export type PlatformMessage = {
  id: string;
  title: string | null;
  body: string;
  type: 'welcome' | 'update' | 'announcement' | 'system';
  read: boolean;
  created_at: string;
};

export async function loadPlatformMessages(userId: string, before?: Pick<PlatformMessage, 'created_at' | 'id'>) {
  let query = supabase.from('platform_messages').select('id,title,body,type,read,created_at')
    .eq('recipient_id', userId).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(40);
  if (before) query = query.or(`created_at.lt.${before.created_at},and(created_at.eq.${before.created_at},id.lt.${before.id})`);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as PlatformMessage[];
}

export async function markPlatformMessagesRead(userId: string, ids: string[]) {
  if (!ids.length) return;
  const { error } = await supabase.from('platform_messages').update({ read: true })
    .eq('recipient_id', userId).in('id', ids);
  if (error) throw error;
}
