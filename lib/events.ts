import { supabase } from './supabase';
import { saudiDateTimeToISO } from './businessHours';
export type CommunityEvent = { id: string; organizer_id: string; title: string; description: string; city: string; district: string | null; starts_at: string; ends_at: string | null; location_name: string | null; moderation_status: string; status: string; capacity: number | null; show_attendee_count: boolean; is_free: boolean; category: string | null; guidelines: string | null; attendee_count?: number | null; };
export type EventDraft = { title: string; description: string; location: string; starts: string; ends: string; capacity: string; isFree: boolean; showCount: boolean; category?: string; guidelines?: string };
export function eventPhase(event: Pick<CommunityEvent, 'status' | 'starts_at' | 'ends_at'>, now = Date.now()): 'upcoming' | 'ongoing' | 'ended' | 'cancelled' {
  if (event.status === 'cancelled') return 'cancelled';
  if (event.status === 'ended' || new Date(event.ends_at || event.starts_at).getTime() <= now) return 'ended';
  return new Date(event.starts_at).getTime() <= now ? 'ongoing' : 'upcoming';
}
export function validateEventDraft(draft: EventDraft, now = Date.now()) {
  const starts = saudiDateTimeToISO(draft.starts), ends = saudiDateTimeToISO(draft.ends);
  if (draft.title.trim().length < 3 || draft.title.trim().length > 100 || draft.location.trim().length < 3 || draft.location.trim().length > 160) throw new Error('اكتب عنوانًا واضحًا وموقع تجمع عامًا دون عنوان منزلك.');
  if (!starts || !ends || Date.parse(starts) <= now || Date.parse(ends) <= Date.parse(starts) || Date.parse(ends) - Date.parse(starts) > 14 * 86400000) throw new Error('حدد بداية مستقبلية ونهاية بعدها بتوقيت السعودية، بحد أقصى 14 يومًا.');
  const capacity = draft.capacity.trim() ? Number(draft.capacity) : null;
  if (capacity !== null && (!Number.isInteger(capacity) || capacity < 1 || capacity > 10000)) throw new Error('المقاعد من 1 إلى 10000، أو اتركها دون حد.');
  return { starts, ends, capacity };
}
export async function loadEvents(city: string | null, district: string | null, offset = 0, includePast = false, organizerId?: string | null) {
  if (!city || ['كل المدن', 'كل المملكة', 'الكل', 'جميع المدن'].includes(city.trim())) return [];
  let query = supabase.from('events').select('id,organizer_id,title,description,city,district,starts_at,ends_at,location_name,moderation_status,status,capacity,show_attendee_count,is_free,category,guidelines').eq('city', city);
  if (organizerId) query = query.eq('organizer_id', organizerId);
  else query = query.eq('moderation_status', 'approved');
  if (district) query = query.eq('district', district);
  if (!includePast && !organizerId) query = query.eq('status', 'published').gt('ends_at', new Date().toISOString());
  const { data, error } = await query.order('starts_at', { ascending: !includePast }).order('id').range(offset, offset + 19);
  if (error) throw error;
  const rows = (data || []) as CommunityEvent[];
  if (!rows.length) return rows;
  const counts = await supabase.rpc('hayna_event_counts', { p_event_ids: rows.map(row => row.id) });
  if (counts.error) throw counts.error;
  const byId = new Map<string, number | null>((counts.data || []).map((row: { event_id: string; attendee_count: number | null }) => [row.event_id, row.attendee_count]));
  return rows.map(row => ({ ...row, attendee_count: byId.get(row.id) ?? null }));
}
export async function saveEvent(draft: EventDraft, eventId?: string) {
  const valid = validateEventDraft(draft);
  const { data: identity } = await supabase.auth.getUser();
  if (!identity.user) throw new Error('سجل الدخول لإضافة فعالية.');
  const { data: profile, error: profileError } = await supabase.from('profiles').select('city,district').eq('id', identity.user.id).single();
  if (profileError) throw profileError;
  const patch = { title: draft.title.trim(), description: draft.description.trim(), location_name: draft.location.trim(), starts_at: valid.starts, ends_at: valid.ends, capacity: valid.capacity, show_attendee_count: draft.showCount, is_free: draft.isFree, category: draft.category || 'community', guidelines: draft.guidelines?.trim() || null };
  const query = eventId ? supabase.from('events').update(patch).eq('id', eventId) : supabase.from('events').insert({ ...patch, organizer_id: identity.user.id, city: profile.city, district: profile.district, moderation_status: 'pending' });
  const { data, error } = await query.select('id').single();
  if (error || !data) throw error || new Error('لم تُحفظ الفعالية.');
  return data.id;
}
export async function setEventAttendance(eventId: string, going: boolean, remind = true) {
  const { data, error } = await supabase.rpc('hayna_event_attendance', { p_event_id: eventId, p_going: going, p_remind: remind });
  if (error) throw error;
  return data as { going: boolean; count: number | null };
}
export async function cancelEvent(eventId: string) {
  const { data, error } = await supabase.from('events').update({ status: 'cancelled' }).eq('id', eventId).select('id').single();
  if (error || !data) throw error || new Error('لم تُلغَ الفعالية.');
}
export async function loadEventById(eventId: string) {
  const { data, error } = await supabase.from('events').select('id,organizer_id,title,description,city,district,starts_at,ends_at,location_name,moderation_status,status,capacity,show_attendee_count,is_free,category,guidelines').eq('id', eventId).maybeSingle();
  if (error) throw error;
  return data as CommunityEvent | null;
}
export function eventError(error: unknown): string {
  const message = (error as { message?: string })?.message || '';
  if (message.includes('event_full')) return 'اكتملت مقاعد الفعالية. جرّب لاحقًا إذا أُلغي تسجيل أحد المشاركين.';
  if (message.includes('event_unavailable')) return 'التسجيل غير متاح لهذه الفعالية الآن.';
  if (message.includes('verified_event_organizer_required')) return 'إنشاء الفعاليات متاح للحسابات المهنية الموثقة والمخولين.';
  if (message.includes('content_not_allowed')) return 'راجع النص؛ يتضمن محتوى غير مسموح.';
  return 'تعذر حفظ التغيير. تحقق من الاتصال وحاول مجددًا.';
}
