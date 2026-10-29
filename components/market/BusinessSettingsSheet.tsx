import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ImagePlus, Save, Store, Trash2, X } from 'lucide-react-native';
import { OasisPressable as Pressable, OasisTextInput as TextInput } from '@/components/oasis/OasisPrimitives';
import { OASIS, useTheme } from '@/lib/oasis';
import { BusinessDraft, businessSettingsPayload } from '@/lib/businessSettings';
import { LocalServiceImage, pickServiceImages, uploadServiceImages } from '@/lib/serviceUpload';
import { supabase } from '@/lib/supabase';
export function BusinessSettingsSheet({ visible, business, onClose, onSaved }: { visible: boolean; business: any; onClose: () => void; onSaved: (status: string) => void }) {
  useTheme(); const c = OASIS.colors;
  const [draft, setDraft] = useState<BusinessDraft>({ name: '', description: '', address: '', phone: '', whatsapp: '', website: '' });
  const [logo, setLogo] = useState<LocalServiceImage | null | undefined>(), [cover, setCover] = useState<LocalServiceImage | null | undefined>();
  const [busy, setBusy] = useState(false), [picking, setPicking] = useState(false), [error, setError] = useState('');
  const lock = useRef(false);
  useEffect(() => { if (visible && business) { setDraft(Object.fromEntries(['name', 'description', 'address', 'phone', 'whatsapp', 'website'].map(key => [key, business[key] || ''])) as BusinessDraft); setLogo(undefined); setCover(undefined); setError(''); } }, [visible, business?.id]);
  async function pick(kind: 'logo' | 'cover') {
    if (busy || picking) return; setPicking(true); setError('');
    try { const images = await pickServiceImages(1); if (images[0]) (kind === 'logo' ? setLogo : setCover)(images[0]); }
    catch { setError('تعذر اختيار الصورة. راجع إذن الصور ثم أعد المحاولة.'); }
    finally { setPicking(false); }
  }
  async function save() {
    if (lock.current || picking) return; lock.current = true; setBusy(true); setError('');
    try {
      const payload = businessSettingsPayload(draft);
      const auth = await supabase.auth.getUser(), userId = auth.data.user?.id;
      const cap = await supabase.rpc('hayna_my_account_capabilities');
      if (!userId || business.owner_id !== userId || cap.error || cap.data?.can_manage_business !== true) throw new Error('يلزم حساب مالك معتمد لإدارة المنشأة.');
      const fresh = await supabase.from('businesses').select('owner_id').eq('id', business.id).eq('owner_id', userId).maybeSingle();
      if (fresh.error || !fresh.data) throw new Error('لم تعد المنشأة متاحة لإدارتك.');
      const media: Record<string, string | null> = {};
      if (logo !== undefined) media.logo_url = logo ? (await uploadServiceImages(userId, [logo]))[0] : null;
      if (cover !== undefined) media.cover_url = cover ? (await uploadServiceImages(userId, [cover]))[0] : null;
      const result = await supabase.from('businesses').update({ ...payload, ...media }).eq('id', business.id).eq('owner_id', userId).select('id,moderation_status').single();
      if (result.error || !result.data) throw new Error('لم تُحفظ التعديلات. تحقق من الاتصال وأعد المحاولة.');
      onSaved(result.data.moderation_status); onClose();
    } catch (cause) { setError((cause as Error).message || 'تعذر حفظ بيانات المنشأة.'); }
    finally { lock.current = false; setBusy(false); }
  }
  const field = (key: keyof BusinessDraft, label: string, maxLength: number, multiline = false) => <View key={key} style={{ gap: 7 }}><Text style={[s.label, { color: c.ink }]}>{label}</Text><TextInput accessibilityLabel={label} value={draft[key]} editable={!busy} onChangeText={value => setDraft(current => ({ ...current, [key]: value }))} maxLength={maxLength} multiline={multiline} keyboardType={key === 'phone' || key === 'whatsapp' ? 'phone-pad' : 'default'} style={[s.input, { color: c.ink, borderColor: c.line, minHeight: multiline ? 100 : 48 }]} /></View>;
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { if (!busy && !picking) onClose(); }}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.backdrop}><View accessibilityViewIsModal style={[s.sheet, { backgroundColor: c.surface }]}><View style={s.header}><Store size={22} color={c.primary} /><Text style={[s.title, { color: c.ink }]}>إعدادات المنشأة</Text><Pressable accessibilityRole="button" accessibilityLabel="إغلاق إعدادات المنشأة" disabled={busy || picking} onPress={onClose} style={s.close}><X size={21} color={c.muted} /></Pressable></View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
    <Text style={[s.hint, { color: c.muted }]}>بيانات نشاطك العامة وصوره. قد تعاد التعديلات للمراجعة قبل ظهورها للزوار.</Text>
    <View style={s.mediaRow}>{(['logo', 'cover'] as const).map(kind => { const selected = kind === 'logo' ? logo : cover, uri = selected === undefined ? business?.[kind === 'logo' ? 'logo_url' : 'cover_url'] : selected?.uri; return <View key={kind} style={[s.media, { borderColor: c.line }]}>{uri ? <Image source={{ uri }} resizeMode={kind === 'logo' ? 'contain' : 'cover'} style={{ width: '100%', height: 90 }} /> : <ImagePlus size={29} color={c.primary} />}<Pressable disabled={busy || picking} accessibilityRole="button" onPress={() => void pick(kind)} style={s.mediaAction}><Text style={{ color: c.primary, fontWeight: '700', fontSize: 12 }}>{kind === 'logo' ? 'تغيير الشعار' : 'تغيير الغلاف'}</Text></Pressable>{!!uri && <Pressable disabled={busy || picking} accessibilityRole="button" accessibilityLabel={kind === 'logo' ? 'إزالة الشعار' : 'إزالة الغلاف'} onPress={() => (kind === 'logo' ? setLogo : setCover)(null)} style={s.mediaAction}><Trash2 size={15} color={c.danger} /><Text style={{ color: c.danger, fontSize: 11 }}>إزالة الصورة</Text></Pressable>}</View>; })}</View>
    {field('name', 'اسم المنشأة', 100)}{field('description', 'نبذة عن النشاط', 2000, true)}{field('address', 'العنوان التجاري العام', 250)}{field('phone', 'رقم الاتصال التجاري', 24)}{field('whatsapp', 'رقم واتساب التجاري', 24)}{field('website', 'الموقع الإلكتروني · HTTPS', 300)}
    <Text style={[s.hint, { color: c.muted }]}>المدينة والحي والمنطقة مرتبطة بموقع حساب المالك. الصور والمعلومات هنا ستظهر للعامة بعد اعتمادها.</Text>
    {!!error && <Text accessibilityRole="alert" style={[s.hint, { color: c.danger }]}>{error}</Text>}
    <Pressable accessibilityRole="button" disabled={busy || picking} onPress={() => void save()} style={[s.save, { backgroundColor: c.primary, opacity: busy || picking ? .5 : 1 }]}>{busy ? <ActivityIndicator color="#fff" /> : <><Save size={18} color="#fff" /><Text style={{ color: '#fff', fontWeight: '700' }}>حفظ بيانات المنشأة</Text></>}</Pressable>
  </ScrollView></View></KeyboardAvoidingView></Modal>;
}
const s = StyleSheet.create({ backdrop: { flex: 1, backgroundColor: 'rgba(0,20,15,.5)', justifyContent: 'flex-end' }, sheet: { maxHeight: '92%', width: '100%', maxWidth: 650, alignSelf: 'center', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingBottom: 24 }, header: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, padding: 18 }, title: { flex: 1, fontSize: 17, fontWeight: '800', textAlign: 'right' }, close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, content: { paddingHorizontal: 20, gap: 16, paddingBottom: 20 }, label: { fontSize: 13, fontWeight: '700', textAlign: 'right' }, hint: { fontSize: 12, lineHeight: 23, textAlign: 'right' }, input: { borderWidth: 1, padding: 12, borderRadius: 15, textAlign: 'right', textAlignVertical: 'top', fontSize: 14 }, mediaRow: { flexDirection: 'row-reverse', gap: 12 }, media: { flex: 1, borderWidth: 1, borderRadius: 16, padding: 10, alignItems: 'center', justifyContent: 'center', gap: 6 }, mediaAction: { minHeight: 40, flexDirection: 'row-reverse', gap: 6, alignItems: 'center', justifyContent: 'center' }, save: { minHeight: 50, borderRadius: 16, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8 } });
