import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ImagePlus, Package, Save, Trash2, X } from 'lucide-react-native';
import { OasisPressable as Pressable, OasisTextInput as TextInput } from '@/components/oasis/OasisPrimitives';
import { ConfirmActionModal } from '@/components/shared/ConfirmActionModal';
import { OASIS, useTheme } from '@/lib/oasis';
import { supabase } from '@/lib/supabase';
import { parseProductDetails } from '@/lib/productDetails';
import { parseProductPrice } from '@/lib/productLocationRules';
import { normalizeSaudiLocationName } from '@/lib/saudiLocations';
import { LocalServiceImage, pickServiceImages, uploadServiceImages } from '@/lib/serviceUpload';
export function ProductEditorSheet({ item, onClose, onSaved }: { item: any | null; onClose: () => void; onSaved: () => void }) {
  useTheme(); const c = OASIS.colors;
  const [title, setTitle] = useState(''), [description, setDescription] = useState(''), [price, setPrice] = useState(''), [image, setImage] = useState<LocalServiceImage | null>(null), [busy, setBusy] = useState(false), [picking, setPicking] = useState(false), [error, setError] = useState(''), [confirmDelete, setConfirmDelete] = useState(false);
  const lock = useRef(false);
  useEffect(() => { if (item) { setTitle(item.title || ''); setDescription(parseProductDetails(item.description).body); setPrice(item.price == null ? '' : String(item.price)); setImage(null); setError(''); setConfirmDelete(false); } }, [item?.id]);
  async function identity() {
    const auth = await supabase.auth.getUser(), uid = auth.data.user?.id;
    const cap = await supabase.rpc('hayna_my_account_capabilities');
    if (!uid || uid !== item?.seller_id || cap.error || cap.data?.can_publish_products !== true) throw new Error('يلزم حساب المالك المعتمد لإدارة المنتج.');
    return uid;
  }
  async function save() {
    if (lock.current || !item || picking) return; lock.current = true; setBusy(true); setError('');
    try {
      if (title.trim().length < 4 || title.trim().length > 100 || description.trim().length < 20 || description.trim().length > 2000) throw new Error('العنوان من ٤ إلى ١٠٠ حرف، والوصف من ٢٠ إلى ٢٠٠٠ حرف.');
      const amount = /^[0٠۰]+$/.test(price.trim()) ? 0 : parseProductPrice(price);
      if (Number.isNaN(amount)) throw new Error('راجع السعر أو اتركه فارغًا للتفاوض.');
      const uid = await identity();
      const profile = await supabase.from('profiles').select('city,district,region').eq('id', uid).maybeSingle();
      if (profile.error || !profile.data || normalizeSaudiLocationName(profile.data.city || '') !== normalizeSaudiLocationName(item.city || '') || normalizeSaudiLocationName(profile.data.district || '') !== normalizeSaudiLocationName(item.district || '') || item.region && normalizeSaudiLocationName(profile.data.region || '') !== normalizeSaudiLocationName(item.region)) throw new Error('موقع حسابك تغيّر عن موقع هذا المنتج. راجع بيانات الموقع قبل التعديل لتجنب نقل الإعلان تلقائيًا.');
      const specs = parseProductDetails(item.description).specs;
      const fullDescription = description.trim() + (specs.length ? '\n\nتفاصيل المنتج\n' + specs.map(spec => spec.label + ': ' + spec.value).join('\n') : '');
      const imageUrl = image ? (await uploadServiceImages(uid, [image]))[0] : item.image_url;
      const result = await supabase.from('marketplace_items').update({ title: title.trim(), description: fullDescription, price: amount, image_url: imageUrl }).eq('id', item.id).eq('seller_id', uid).select('id').single();
      if (result.error || !result.data) throw new Error('لم تُحفظ التعديلات. تحقق من الاتصال والصلاحيات.');
      onClose(); onSaved();
    } catch (cause) { setError((cause as Error).message); }
    finally { lock.current = false; setBusy(false); }
  }
  async function remove() {
    if (lock.current || !item) return; lock.current = true; setBusy(true); setError('');
    try { const uid = await identity(); const result = await supabase.from('marketplace_items').delete().eq('id', item.id).eq('seller_id', uid).select('id').single(); if (result.error || !result.data) throw new Error('لم يُحذف الإعلان. تحقق من الاتصال والصلاحيات.'); setConfirmDelete(false); onClose(); onSaved(); }
    catch (cause) { setError((cause as Error).message); }
    finally { lock.current = false; setBusy(false); }
  }
  async function chooseImage() {
    if (busy || picking) return; setPicking(true); setError('');
    try { const images = await pickServiceImages(1); if (images[0]) setImage(images[0]); } catch { setError('تعذر اختيار الصورة.'); } finally { setPicking(false); }
  }
  return <><Modal visible={!!item && !confirmDelete} transparent animationType="slide" onRequestClose={() => { if (!busy && !picking) onClose(); }}><View style={s.backdrop}><View accessibilityViewIsModal style={[s.sheet, { backgroundColor: c.surface }]}><View style={s.row}><Package size={23} color={c.primary} /><Text style={[s.title, { color: c.ink }]}>إدارة المنتج</Text><Pressable accessibilityRole="button" accessibilityLabel="إغلاق إدارة المنتج" disabled={busy || picking} onPress={onClose} style={s.close}><X size={21} color={c.muted} /></Pressable></View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 14, paddingBottom: 24 }}>
    <Text style={[s.label, { color: c.ink }]}>اسم المنتج</Text><TextInput accessibilityLabel="اسم المنتج" value={title} editable={!busy} onChangeText={setTitle} maxLength={100} style={[s.input, { color: c.ink, borderColor: c.line }]} />
    <Text style={[s.label, { color: c.ink }]}>وصف المنتج</Text><TextInput accessibilityLabel="وصف المنتج" value={description} editable={!busy} onChangeText={setDescription} maxLength={2000} multiline style={[s.input, { color: c.ink, borderColor: c.line, minHeight: 110 }]} />
    <Text style={[s.label, { color: c.ink }]}>السعر بالريال · فارغ للتفاوض</Text><TextInput accessibilityLabel="سعر المنتج" value={price} editable={!busy} onChangeText={setPrice} maxLength={12} keyboardType="decimal-pad" style={[s.input, { color: c.ink, borderColor: c.line }]} />
    <Pressable disabled={busy || picking} accessibilityRole="button" onPress={() => void chooseImage()} style={[s.action, { backgroundColor: c.soft }]}><ImagePlus size={19} color={c.primary} /><Text style={{ color: c.primary }}>{image ? 'تم اختيار صورة بديلة' : 'تغيير صورة المنتج'}</Text></Pressable>
    {!!error && <Text accessibilityRole="alert" style={[s.hint, { color: c.danger }]}>{error}</Text>}
    <Pressable disabled={busy || picking} accessibilityRole="button" onPress={() => void save()} style={[s.action, { backgroundColor: c.primary }]}>{busy ? <ActivityIndicator color="#fff" /> : <><Save size={18} color="#fff" /><Text style={{ color: '#fff', fontWeight: '700' }}>حفظ التعديلات</Text></>}</Pressable>
    <Pressable disabled={busy || picking} accessibilityRole="button" onPress={() => { setError(''); setConfirmDelete(true); }} style={s.action}><Trash2 size={18} color={c.danger} /><Text style={{ color: c.danger }}>حذف إعلان المنتج</Text></Pressable>
  </ScrollView></View></View></Modal><ConfirmActionModal visible={confirmDelete} title="حذف إعلان المنتج؟" description="سيُحذف إعلان المنتج نهائيًا. تبقى المحادثات والطلبات المالية السابقة محفوظة." destructive confirmLabel="حذف الإعلان" busy={busy} error={error} onCancel={() => setConfirmDelete(false)} onConfirm={() => void remove()} /></>;
}
const s = StyleSheet.create({ backdrop: { flex: 1, backgroundColor: 'rgba(0,20,15,.5)', justifyContent: 'flex-end' }, sheet: { maxHeight: '90%', padding: 20, gap: 16, width: '100%', maxWidth: 620, alignSelf: 'center', borderTopLeftRadius: 26, borderTopRightRadius: 26 }, row: { flexDirection: 'row-reverse', alignItems: 'center', gap: 9 }, title: { flex: 1, fontSize: 17, fontWeight: '800', textAlign: 'right' }, close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, label: { fontSize: 13, fontWeight: '700', textAlign: 'right' }, hint: { fontSize: 12, lineHeight: 22, textAlign: 'right' }, input: { borderWidth: 1, borderRadius: 15, padding: 12, minHeight: 48, textAlign: 'right', textAlignVertical: 'top', fontSize: 14 }, action: { minHeight: 48, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', borderRadius: 15, gap: 8 } });
