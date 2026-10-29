import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { uuid } from 'expo-modules-core';
import { router } from 'expo-router';
import { Minus, Plus, Send, ShieldCheck, ShoppingBag, X } from 'lucide-react-native';
import { OasisPressable as Pressable, OasisTextInput as TextInput } from '@/components/oasis/OasisPrimitives';
import { OASIS, useTheme } from '@/lib/oasis';
import { productRequestTotal, sendProductRequest } from '@/lib/productRequest';
import { supabase } from '@/lib/supabase';

export function ProductRequestSheet({ visible, item, userId, onClose }: { visible: boolean; item: any; userId: string | null; onClose: () => void }) {
  useTheme(); const c = OASIS.colors;
  const [quantity, setQuantity] = useState(1), [note, setNote] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [ready, setReady] = useState(false);
  const reference = useRef(''), lock = useRef(false);
  const storageKey = '@hayna_product_request:' + userId + ':' + item?.id;
  useEffect(() => {
    if (!visible) return;
    let active = true; setReady(false); setQuantity(1); setNote(''); setError('');
    void (async () => {
      try {
        const pending = await AsyncStorage.getItem(storageKey);
        const id = pending && /^[0-9a-f-]{36}$/i.test(pending) ? pending : uuid.v4();
        await AsyncStorage.setItem(storageKey, id);
        if (active) { reference.current = id; setReady(true); }
      } catch { if (active) setError('تعذر تجهيز مرجع الطلب. أعد فتح النموذج.'); }
    })();
    return () => { active = false; };
  }, [visible, storageKey]);
  let total: number | null = null;
  try { total = productRequestTotal(item?.price, quantity); } catch { /* Submission also validates the actual server price. */ }
  async function submit() {
    if (lock.current || !ready || !item || !userId) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const result = await sendProductRequest(supabase, { itemId: item.id, requestId: reference.current, quantity, note, expectedPrice: item.price });
      await AsyncStorage.removeItem(storageKey).catch(() => {});
      onClose(); router.push({ pathname: '/conversation', params: { id: result.conversationId } });
    } catch (cause) { setError((cause as Error).message || 'تعذر إرسال الطلب.'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { if (!busy) onClose(); }}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.backdrop}>
      <View style={[s.sheet, { backgroundColor: c.surface }]} accessibilityViewIsModal>
        <View style={s.header}><ShoppingBag size={23} color={c.primary} /><Text style={[s.title, { color: c.ink }]}>اطلب المنتج</Text><Pressable accessibilityRole="button" accessibilityLabel="إغلاق طلب المنتج" disabled={busy} onPress={onClose} style={s.close}><X size={22} color={c.muted} /></Pressable></View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
          <Text style={[s.title, { color: c.ink }]}>{item?.title}</Text>
          <Text style={[s.hint, { color: c.muted }]}>راجع طلبك، ثم أرسله إلى البائع في محادثة خاصة. لا يُخصم مبلغ ولا يُحجز المنتج بهذه الخطوة.</Text>
          <View style={s.between}><Text style={[s.label, { color: c.ink }]}>الكمية المطلوبة</Text><View style={s.row}><Pressable accessibilityLabel="زيادة الكمية" accessibilityRole="button" disabled={busy || quantity >= 20} onPress={() => setQuantity(value => Math.min(20, value + 1))} style={[s.step, { backgroundColor: c.soft }]}><Plus size={19} color={c.primary} /></Pressable><Text style={[s.quantity, { color: c.ink }]}>{quantity.toLocaleString('ar-SA')}</Text><Pressable accessibilityLabel="تقليل الكمية" accessibilityRole="button" disabled={busy || quantity <= 1} onPress={() => setQuantity(value => Math.max(1, value - 1))} style={[s.step, { backgroundColor: c.soft }]}><Minus size={19} color={c.primary} /></Pressable></View></View>
          <Text style={[s.label, { color: c.ink }]}>ملاحظات للبائع · اختياري</Text><TextInput accessibilityLabel="ملاحظات طلب المنتج" value={note} onChangeText={setNote} maxLength={400} editable={!busy} multiline placeholder="اسأل عن المقاس أو اللون أو موعد الاستلام…" style={[s.input, { color: c.ink, borderColor: c.line }]} /><Text style={[s.hint, { color: c.muted }]}>{note.length.toLocaleString('ar-SA')} / ٤٠٠</Text>
          <View style={[s.summary, { backgroundColor: c.soft }]}><Text style={[s.label, { color: c.ink }]}>الإجمالي التقديري</Text><Text style={[s.total, { color: c.primary }]}>{total === null ? 'بالاتفاق مع البائع' : new Intl.NumberFormat('ar-SA', { style: 'currency', currency: 'SAR' }).format(total / 100)}</Text><Text style={[s.hint, { color: c.muted }]}>لا يشمل تكلفة التسليم. الكمية والتوفر والسعر النهائي يؤكدها البائع.</Text></View>
          <View style={s.row}><ShieldCheck size={19} color={c.primary} /><Text style={[s.hint, { flex: 1, color: c.muted }]}>لا ترسل عنوان منزلك الدقيق أو بيانات دفعك داخل الملاحظات.</Text></View>
          {!!error && <Text accessibilityRole="alert" style={[s.hint, { color: c.danger }]}>{error}</Text>}
          <Pressable accessibilityRole="button" disabled={busy || !ready} onPress={() => void submit()} style={[s.send, { backgroundColor: c.primary, opacity: busy || !ready ? .5 : 1 }]}>{busy ? <ActivityIndicator color="#fff" /> : <><Send size={18} color="#fff" /><Text style={s.white}>إرسال الطلب إلى البائع</Text></>}</Pressable>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}
const s = StyleSheet.create({ backdrop: { flex: 1, backgroundColor: 'rgba(0,20,15,.55)', justifyContent: 'flex-end' }, sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: '90%', width: '100%', maxWidth: 620, alignSelf: 'center', paddingBottom: 24 }, header: { flexDirection: 'row-reverse', gap: 10, alignItems: 'center', padding: 18 }, title: { flex: 1, fontSize: 17, fontWeight: '800', textAlign: 'right', lineHeight: 27 }, close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, content: { paddingHorizontal: 20, paddingBottom: 18, gap: 13 }, hint: { fontSize: 12, lineHeight: 22, textAlign: 'right' }, label: { fontSize: 13, fontWeight: '700', textAlign: 'right' }, between: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', gap: 10 }, row: { flexDirection: 'row-reverse', alignItems: 'center', gap: 9 }, step: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, quantity: { minWidth: 30, textAlign: 'center', fontWeight: '800', fontSize: 19 }, input: { minHeight: 100, borderWidth: 1, borderRadius: 16, padding: 13, fontSize: 14, textAlign: 'right', textAlignVertical: 'top' }, summary: { padding: 16, gap: 9, borderRadius: 18 }, total: { fontSize: 21, fontWeight: '800', textAlign: 'right' }, send: { minHeight: 50, borderRadius: 16, flexDirection: 'row-reverse', gap: 8, alignItems: 'center', justifyContent: 'center' }, white: { color: '#fff', fontSize: 14, fontWeight: '700' } });
