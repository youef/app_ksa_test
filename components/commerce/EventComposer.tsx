import { useState } from 'react';
import { ActivityIndicator, Switch, Text, View } from 'react-native';
import { CalendarPlus, X } from 'lucide-react-native';
import { OASIS, useTheme } from '@/lib/oasis';
import { OasisPressable as Pressable, OasisTextInput as TextInput } from '@/components/oasis/OasisPrimitives';
import { CommunityEvent, EventDraft, eventError, saveEvent } from '@/lib/events';
import { commerceStyles } from './commerceStyles';
function dateInput(iso: string | null) { if (!iso) return ''; return new Date(Date.parse(iso) + 3 * 3600000).toISOString().slice(0, 16); }
export function EventComposer({ event, onSaved, onCancel }: { event?: CommunityEvent; onSaved: (id: string) => void; onCancel: () => void }) {
  useTheme(); const c = OASIS.colors, s = commerceStyles(c);
  const [draft, setDraft] = useState<EventDraft>(() => ({ title: event?.title || '', description: event?.description || '', location: event?.location_name || '', starts: dateInput(event?.starts_at || null), ends: dateInput(event?.ends_at || null), capacity: event?.capacity?.toString() || '', isFree: event?.is_free ?? true, showCount: event?.show_attendee_count ?? true, category: event?.category || 'community', guidelines: event?.guidelines || '' }));
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const field = (key: keyof EventDraft, label: string, placeholder: string, maxLength: number, multiline = false) => <View style={{ gap: 5 }}><Text style={s.hint}>{label}</Text><TextInput accessibilityLabel={label} value={String(draft[key] ?? '')} onChangeText={value => setDraft(current => ({ ...current, [key]: value }))} placeholder={placeholder} maxLength={maxLength} multiline={multiline} style={[s.input, multiline && { minHeight: 85, textAlignVertical: 'top' }]} /></View>;
  const dateFields = (key: 'starts' | 'ends', label: string) => { const [date = '', time = ''] = draft[key].split('T'); return <View style={{ gap: 5 }}><Text style={s.hint}>{label} · بتوقيت السعودية</Text><View style={s.row}><TextInput accessibilityLabel={`التاريخ الميلادي ${label}`} value={date} onChangeText={value => setDraft(p => ({ ...p, [key]: `${value}T${time}` }))} placeholder="2026-12-30" maxLength={10} style={[s.input, { flex: 3, textAlign: 'center' }]} /><TextInput accessibilityLabel={`الوقت ${label}`} value={time} onChangeText={value => setDraft(p => ({ ...p, [key]: `${date}T${value}` }))} placeholder="17:00" maxLength={5} style={[s.input, { flex: 2, textAlign: 'center' }]} /></View></View>; };
  const save = async () => { setBusy(true); setError(''); try { const id = await saveEvent(draft, event?.id); onSaved(id); } catch (e) { setError((e as Error).message?.match(/[\u0600-\u06ff]/) ? (e as Error).message : eventError(e)); } finally { setBusy(false); } };
  return <View style={s.card}>
    <View style={s.spread}><View style={s.row}><CalendarPlus size={20} color={c.primary} /><Text style={s.title}>{event ? 'تعديل الفعالية' : 'فعالية تجمع الجيران'}</Text></View><Pressable disabled={busy} accessibilityLabel="إغلاق نموذج الفعالية" style={s.icon} onPress={onCancel}><X size={20} color={c.muted} /></Pressable></View>
    <Text style={s.hint}>اختر مكانًا عامًا وتفاصيل واضحة. تُراجع الفعالية قبل ظهورها للجيران، والمدينة والحي من ملفك المعتمد.</Text>
    {field('title', 'عنوان الفعالية', 'مثل: لقاء المشي في الحديقة', 100)}
    <View style={[s.row, { flexWrap: 'wrap' }]}>{[{ id: 'community', label: 'لقاء الجيران' }, { id: 'volunteer', label: 'تطوع' }, { id: 'sports', label: 'رياضة' }, { id: 'family', label: 'عائلة' }, { id: 'culture', label: 'ثقافة' }].map(category => <Pressable key={category.id} accessibilityRole="radio" accessibilityState={{ selected: draft.category === category.id }} style={[s.button, draft.category === category.id && s.primary]} onPress={() => setDraft(p => ({ ...p, category: category.id }))}><Text style={draft.category === category.id ? s.primaryText : s.buttonText}>{category.label}</Text></Pressable>)}</View>
    {field('description', 'وصف الفعالية', 'ماذا سيفعل المشاركون؟', 3000, true)}
    {field('location', 'موقع التجمع العام', 'اسم حديقة أو مركز، دون عنوان منزل أو إحداثيات خاصة', 160)}
    {dateFields('starts', 'البداية')}
    {dateFields('ends', 'النهاية')}
    {field('capacity', 'عدد المقاعد (اختياري)', 'اتركه فارغًا للحضور دون حد', 5)}
    {field('guidelines', 'إرشادات المشاركة (اختياري)', 'الفئة المناسبة وما يحتاجه المشارك', 1500, true)}
    <View style={s.spread}><Text style={s.body}>الدخول مجاني</Text><Switch accessibilityLabel="الدخول مجاني" value={draft.isFree} onValueChange={value => setDraft(p => ({ ...p, isFree: value }))} trackColor={{ true: c.primary, false: c.line }} /></View>
    <View style={s.spread}><Text style={s.body}>عرض عدد المشاركين للجيران</Text><Switch accessibilityLabel="عرض عدد المشاركين" value={draft.showCount} onValueChange={value => setDraft(p => ({ ...p, showCount: value }))} trackColor={{ true: c.primary, false: c.line }} /></View>
    <Text style={s.hint}>أسماء الحضور تظهر لصاحب التسجيل والمنظم والمخولين فقط. لا يجمع هذا النموذج مدفوعات.</Text>
    {error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : null}
    <Pressable disabled={busy} style={[s.button, s.primary, busy && { opacity: .6 }]} onPress={() => void save()}>{busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.primaryText}>إرسال للمراجعة</Text>}</Pressable>
  </View>;
}
