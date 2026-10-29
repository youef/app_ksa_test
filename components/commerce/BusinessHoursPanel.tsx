import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Clock3, Pencil, Plus, Trash2, X } from 'lucide-react-native';
import { OasisPressable as Pressable, OasisTextInput as TextInput } from '@/components/oasis/OasisPrimitives';
import { OASIS, useTheme } from '@/lib/oasis';
import { supabase } from '@/lib/supabase';
import { BusinessPeriod, BusinessStatus, WEEK_DAYS, formatSaudiDate, loadBusinessHours, saudiDateTimeToISO, saveBusinessHours } from '@/lib/businessHours';
import { commerceStyles } from './commerceStyles';

export function BusinessHoursPanel({ businessId, ownerId }: { businessId: string; ownerId?: string }) {
  useTheme(); const c = OASIS.colors; const s = commerceStyles(c);
  const [periods, setPeriods] = useState<BusinessPeriod[]>([]), [status, setStatus] = useState<BusinessStatus | null>(null);
  const [canEdit, setCanEdit] = useState(false), [editing, setEditing] = useState(false), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState(''), [closure, setClosure] = useState('');
  const reload = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [hours, identity] = await Promise.all([loadBusinessHours(businessId), supabase.auth.getUser()]);
      setPeriods(hours.periods); setStatus(hours.status);
      const userId = identity.data.user?.id;
      if (userId) {
        const [capability, permission] = await Promise.all([supabase.rpc('hayna_my_account_capabilities'), supabase.rpc('hayna_has_permission', { p_permission: 'market' })]);
        setCanEdit(Boolean(permission.data || (userId === ownerId && capability.data?.can_manage_business)));
      } else setCanEdit(false);
    } catch { setError('تعذر تحميل أوقات العمل. تحقق من الاتصال وأعد المحاولة.'); }
    finally { setLoading(false); }
  }, [businessId, ownerId]);
  useEffect(() => { void reload(); const timer = setInterval(() => { if (!editing) void reload(); }, 60000); return () => clearInterval(timer); }, [reload, editing]);
  const update = (index: number, patch: Partial<BusinessPeriod>) => setPeriods(rows => rows.map((p, i) => i === index ? { ...p, ...patch } : p));
  const add = (day: number) => setPeriods(rows => [...rows.filter(p => p.day_of_week !== day || !p.is_closed), { day_of_week: day, period_index: Math.max(-1, ...rows.filter(p => p.day_of_week === day).map(p => p.period_index)) + 1, opens_at: '09:00', closes_at: '17:00', is_closed: false }]);
  const save = async () => {
    setBusy(true); setError('');
    try {
      const closedUntil = closure.trim() ? saudiDateTimeToISO(closure.trim()) : null;
      if (closure.trim() && !closedUntil) throw new Error('اكتب موعد انتهاء الإغلاق مثل 2026-12-30T18:00 بتوقيت السعودية.');
      const week = WEEK_DAYS.flatMap((_, day) => { const rows = periods.filter(p => p.day_of_week === day); return rows.length ? rows.map((p, i) => ({ ...p, period_index: i })) : [{ day_of_week: day, period_index: 0, opens_at: null, closes_at: null, is_closed: true }]; });
      await saveBusinessHours(businessId, week, closedUntil); setEditing(false); await reload();
    } catch (e) { setError((e as Error).message?.match(/[\u0600-\u06ff]/) ? (e as Error).message : 'تعذر حفظ الساعات. تحقق من تداخل الفترات وصلاحية إدارة المنشأة.'); }
    finally { setBusy(false); }
  };
  return <View style={s.card}>
    <View style={s.spread}><View style={s.row}><Clock3 size={19} color={c.primary} /><Text style={s.title}>أوقات العمل</Text></View>{canEdit ? <Pressable accessibilityLabel={editing ? 'إغلاق تعديل أوقات العمل' : 'تعديل أوقات العمل'} style={s.icon} onPress={() => { if (editing) void reload(); setEditing(!editing); setClosure(status?.temporary_closed_until && Date.parse(status.temporary_closed_until) > Date.now() ? new Date(Date.parse(status.temporary_closed_until) + 10800000).toISOString().slice(0, 16) : ''); }}>{editing ? <X size={18} color={c.muted} /> : <Pencil size={17} color={c.primary} />}</Pressable> : null}</View>
    {loading ? <ActivityIndicator color={c.primary} /> : <>
      <View style={s.badge}><Text style={s.badgeText}>{!status?.has_schedule ? 'لم تُحدد أوقات العمل بعد' : status.is_open ? 'مفتوح الآن' : 'مغلق الآن'}</Text></View>
      {!editing && status?.next_opens_at ? <Text style={s.hint}>الافتتاح القادم: {formatSaudiDate(status.next_opens_at)}</Text> : null}
      {!editing && status?.temporary_closed_until && Date.parse(status.temporary_closed_until) > Date.now() ? <Text style={s.hint}>إغلاق مؤقت حتى {formatSaudiDate(status.temporary_closed_until)}</Text> : null}
      {WEEK_DAYS.map((label, day) => {
        const daily = periods.map((p, index) => ({ p, index })).filter(({ p }) => p.day_of_week === day && !p.is_closed);
        return <View key={day} style={s.divider}><View style={s.spread}><Text style={s.body}>{label}</Text>{editing && daily.length < 6 ? <Pressable accessibilityLabel={`إضافة فترة يوم ${label}`} style={s.icon} onPress={() => add(day)}><Plus size={17} color={c.primary} /></Pressable> : null}</View>
          {!daily.length ? <Text style={s.hint}>{status?.has_schedule || editing ? 'إجازة / مغلق' : 'غير محدد'}</Text> : daily.map(({ p, index }) => editing ? <View key={index} style={s.row}><TextInput accessibilityLabel={`فتح ${label} الفترة ${p.period_index + 1}`} value={p.opens_at?.slice(0, 5) || ''} onChangeText={value => update(index, { opens_at: value })} placeholder="09:00" maxLength={5} style={[s.input, { flex: 1, textAlign: 'center' }]} /><Text style={s.hint}>إلى</Text><TextInput accessibilityLabel={`إغلاق ${label} الفترة ${p.period_index + 1}`} value={p.closes_at?.slice(0, 5) || ''} onChangeText={value => update(index, { closes_at: value })} placeholder="17:00" maxLength={5} style={[s.input, { flex: 1, textAlign: 'center' }]} /><Pressable accessibilityLabel={`حذف فترة ${label}`} style={s.icon} onPress={() => setPeriods(rows => rows.filter((_, i) => i !== index))}><Trash2 size={16} color={c.danger} /></Pressable></View> : <Text key={index} style={s.hint}>{p.opens_at?.slice(0, 5)} — {p.closes_at?.slice(0, 5)}{(p.closes_at || '') < (p.opens_at || '') ? ' (اليوم التالي)' : ''}</Text>)}
        </View>;
      })}
      {editing ? <><Text style={s.hint}>كل الأوقات بتوقيت السعودية. لإنهاء إغلاق مؤقت اترك الموعد فارغًا.</Text><TextInput accessibilityLabel="انتهاء الإغلاق المؤقت بتوقيت السعودية" value={closure} onChangeText={setClosure} placeholder="2026-12-30T18:00 (اختياري)" style={s.input} /><Pressable disabled={busy} style={[s.button, s.primary, busy && { opacity: .6 }]} onPress={() => void save()}>{busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={s.primaryText}>حفظ جدول العمل</Text>}</Pressable></> : null}
    </>}
    {error ? <><Text accessibilityRole="alert" style={s.error}>{error}</Text>{!editing ? <Pressable style={s.button} onPress={() => void reload()}><Text style={s.buttonText}>إعادة المحاولة</Text></Pressable> : null}</> : null}
  </View>;
}
