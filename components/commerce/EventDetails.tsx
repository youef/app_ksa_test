import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Share, Switch, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Bell, CalendarDays, Flag, MapPin, Share2, Users, X } from 'lucide-react-native';
import { OasisPressable as Pressable, OasisTextInput as TextInput } from '@/components/oasis/OasisPrimitives';
import { OASIS, useTheme } from '@/lib/oasis';
import { supabase } from '@/lib/supabase';
import { formatSaudiDate } from '@/lib/businessHours';
import { CommunityEvent, eventError, eventPhase, setEventAttendance } from '@/lib/events';
import { reportCommerce } from '@/lib/reviews';
import { commerceStyles } from './commerceStyles';
const phaseNames = { upcoming: 'قادمة', ongoing: 'جارية الآن', ended: 'انتهت', cancelled: 'ملغاة' };
export function EventDetails({ event, onClose, onAttendanceChange }: { event: CommunityEvent; onClose?: () => void; onAttendanceChange?: (count: number | null) => void }) {
  useTheme(); const c = OASIS.colors, s = commerceStyles(c);
  const [identity, setIdentity] = useState<string | null>(null), [going, setGoing] = useState(false), [remind, setRemind] = useState(true), [count, setCount] = useState<number | null>(event.attendee_count ?? null), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState(''), [notice, setNotice] = useState(''), [reporting, setReporting] = useState(false), [reason, setReason] = useState(''), [now, setNow] = useState(Date.now());
  const [participants, setParticipants] = useState<{ user_id: string; profile: { display_name?: string; username?: string } | null }[]>([]), [canViewParticipants, setCanViewParticipants] = useState(false), [participantsBusy, setParticipantsBusy] = useState(false);
  const phase = eventPhase(event, now);
  const load = useCallback(async () => { setLoading(true); try { const { data } = await supabase.auth.getUser(); const id = data.user?.id || null; setIdentity(id); if (id) { const response = await supabase.from('event_attendees').select('status,reminder_enabled').eq('event_id', event.id).eq('user_id', id).maybeSingle(); if (response.error) throw response.error; setGoing(response.data?.status === 'going'); setRemind(response.data?.reminder_enabled ?? true); } const counts = await supabase.rpc('hayna_event_counts', { p_event_ids: [event.id] }); if (counts.error) throw counts.error; setCount(counts.data?.[0]?.attendee_count ?? null); } catch { setError('تعذر تحميل حالة الحضور. أعد المحاولة.'); } finally { setLoading(false); } }, [event.id]);
  useEffect(() => { void load(); const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer); }, [load]);
  useEffect(() => { let active = true; if (!identity) { setCanViewParticipants(false); return; } void supabase.rpc('hayna_has_permission', { p_permission: 'events' }).then(response => { if (active) setCanViewParticipants(identity === event.organizer_id || response.data === true); }); return () => { active = false; }; }, [identity, event.organizer_id]);
  const showParticipants = async () => { setParticipantsBusy(true); setError(''); try { const response = await supabase.from('event_attendees').select('user_id,profile:profiles!event_attendees_user_id_fkey(display_name,username)').eq('event_id', event.id).eq('status', 'going').order('created_at').limit(100); if (response.error) throw response.error; setParticipants((response.data || []) as unknown as typeof participants); } catch { setError('تعذر تحميل المشاركين. تحقق من الصلاحية والاتصال.'); } finally { setParticipantsBusy(false); } };
  const attend = async (nextGoing: boolean, nextRemind = remind) => { if (!identity) { router.push('/auth'); return; } setBusy(true); setError(''); try { const result = await setEventAttendance(event.id, nextGoing, nextRemind); setGoing(result.going); setRemind(nextRemind); setCount(result.count); onAttendanceChange?.(result.count); setNotice(nextGoing ? 'تم حفظ حضورك وتفضيل التذكير.' : 'أُلغي تسجيل حضورك.'); } catch (e) { setError(eventError(e)); } finally { setBusy(false); } };
  const report = async () => { setBusy(true); try { await reportCommerce('event', event.id, reason); setNotice('وصل البلاغ للإدارة.'); setReporting(false); } catch { setError('تعذر إرسال البلاغ. تحقق من الاتصال.'); } finally { setBusy(false); } };
  return <View style={s.card}>
    <View style={s.spread}><View style={s.badge}><Text style={s.badgeText}>{phaseNames[phase]}</Text></View>{onClose ? <Pressable accessibilityLabel="إغلاق تفاصيل الفعالية" style={s.icon} onPress={onClose}><X size={20} color={c.muted} /></Pressable> : null}</View>
    <Text style={s.title}>{event.title}</Text><Text style={s.body}>{event.description}</Text>
    {event.moderation_status !== 'approved' ? <Text style={s.badgeText}>{event.moderation_status === 'pending' ? 'قيد مراجعة الإدارة؛ لم تظهر للعلن بعد.' : 'لم تعتمد الفعالية للنشر.'}</Text> : null}
    <View style={s.row}><CalendarDays size={18} color={c.primary} /><Text style={[s.body, { flex: 1 }]}>{formatSaudiDate(event.starts_at)}{event.ends_at ? `\nحتى ${formatSaudiDate(event.ends_at)}` : ''}</Text></View>
    <View style={s.row}><MapPin size={18} color={c.primary} /><Text style={[s.body, { flex: 1 }]}>{event.location_name} · {event.district ? `حي ${event.district} · ` : ''}{event.city}</Text></View>
    <Text style={s.hint}>{event.is_free ? 'الدخول مجاني' : 'قد تتطلب الفعالية رسومًا لدى المنظم؛ لا يتم تحصيلها هنا.'}</Text>
    {count !== null ? <View style={s.row}><Users size={17} color={c.primary} /><Text style={s.hint}>{count} مشارك{event.capacity ? ` · ${Math.max(0, event.capacity - count)} مقعد متبقٍ` : ''}</Text></View> : <Text style={s.hint}>اختار المنظم إخفاء عدد المشاركين.</Text>}
    {event.guidelines ? <View style={s.divider}><Text style={s.body}>إرشادات المشاركة</Text><Text style={s.hint}>{event.guidelines}</Text></View> : null}
    {loading ? <ActivityIndicator color={c.primary} /> : <>
      {((event.moderation_status === 'approved' && (phase === 'upcoming' || phase === 'ongoing')) || going) ? <Pressable disabled={busy || (!going && !['upcoming', 'ongoing'].includes(phase))} style={[s.button, !going && s.primary, busy && { opacity: .6 }]} onPress={() => void attend(!going)}><Text style={going ? s.buttonText : s.primaryText}>{busy ? 'جارٍ الحفظ…' : going ? 'إلغاء تسجيل الحضور' : 'تسجيل الحضور'}</Text></Pressable> : <Text style={s.hint}>التسجيل مغلق لهذه الفعالية.</Text>}
      {going && phase === 'upcoming' ? <View style={s.spread}><View style={s.row}><Bell size={16} color={c.primary} /><Text style={s.hint}>تذكير قبل الفعالية</Text></View><Switch disabled={busy} accessibilityLabel="تذكير بالفعالية" value={remind} onValueChange={value => void attend(true, value)} /></View> : null}
    </>}
    <View style={s.row}><Pressable style={[s.button, { flex: 1 }]} onPress={() => void Share.share({ title: event.title, message: `${event.title}\n${formatSaudiDate(event.starts_at)}\n${event.location_name} · ${event.district || event.city}\n${event.is_free ? 'الدخول مجاني' : 'تواصل مع المنظم لمعرفة الرسوم'}` })}><Share2 size={16} color={c.primary} /><Text style={s.buttonText}>مشاركة</Text></Pressable>{identity && identity !== event.organizer_id ? <Pressable accessibilityLabel="الإبلاغ عن الفعالية" style={s.icon} onPress={() => setReporting(!reporting)}><Flag size={17} color={c.muted} /></Pressable> : null}</View>
    {reporting ? <><TextInput accessibilityLabel="سبب الإبلاغ عن الفعالية" value={reason} onChangeText={setReason} placeholder="سبب البلاغ (5 أحرف على الأقل)" maxLength={1000} multiline style={s.input} /><Pressable disabled={busy || reason.trim().length < 5} style={s.button} onPress={() => void report()}><Text style={s.buttonText}>إرسال البلاغ</Text></Pressable></> : null}
    <Text style={s.hint}>الحضور خاص؛ لا تظهر هويتك في قائمة عامة. الوقت بتوقيت السعودية.</Text>
    {canViewParticipants ? <View style={s.divider}><Pressable disabled={participantsBusy} style={s.button} onPress={() => void showParticipants()}><Text style={s.buttonText}>{participantsBusy ? 'جارٍ التحميل…' : 'عرض المشاركين للمنظم والمخولين'}</Text></Pressable>{participants.map(participant => <Text key={participant.user_id} style={s.body}>{participant.profile?.display_name || participant.profile?.username || 'جار مسجل'}</Text>)}{participants.length === 100 ? <Text style={s.hint}>تُعرض أول 100 مشاركة؛ العدد الكامل موضح في الأعلى عند إتاحته.</Text> : null}</View> : null}
    {notice ? <Text accessibilityLiveRegion="polite" style={s.badgeText}>{notice}</Text> : null}
    {error ? <><Text accessibilityRole="alert" style={s.error}>{error}</Text><Pressable style={s.button} onPress={() => { setError(''); void load(); }}><Text style={s.buttonText}>إعادة المحاولة</Text></Pressable></> : null}
  </View>;
}
