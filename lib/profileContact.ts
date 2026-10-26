import { supabase } from '@/lib/supabase';
import { CONTACT_PHONE_ERROR, normalizeContactPhone } from '@/lib/contactPhone';

export type ProfileContact = { user_id: string; phone: string; is_visible: boolean };
const CONTACT_FIELDS = 'user_id,phone,is_visible';

export async function loadProfileContact(userId: string, publicOnly = false): Promise<ProfileContact | null> {
  let query = supabase.from('profile_contact_numbers').select(CONTACT_FIELDS).eq('user_id', userId);
  if (publicOnly) query = query.eq('is_visible', true);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

export async function saveProfileContact(userId: string, input: string, visible: boolean): Promise<ProfileContact | null> {
  const phone = normalizeContactPhone(input);
  if (phone === null) throw new Error(CONTACT_PHONE_ERROR);
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (auth.user?.id !== userId) throw new Error('انتهت جلسة الحساب. سجّل الدخول ثم أعد المحاولة.');
  if (!phone) {
    const result = await supabase.from('profile_contact_numbers').delete().eq('user_id', userId);
    if (result.error) throw result.error;
    if (await loadProfileContact(userId)) throw new Error('لم يُحذف الرقم. أعد المحاولة.');
    return null;
  }
  const { data, error } = await supabase.from('profile_contact_numbers')
    .upsert({ user_id: userId, phone, is_visible: visible, updated_at: new Date().toISOString() })
    .select(CONTACT_FIELDS).single();
  if (error) throw error;
  if (!data || data.phone !== phone || data.is_visible !== visible) throw new Error('تعذر التأكد من حفظ الرقم. أعد المحاولة.');
  return data;
}
