import { OasisPressable as Pressable, OasisTextInput as TextInput, OasisSurface } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import AppHeader from '@/components/shared/AppHeader';
import { useBottomNavInset } from '@/lib/bottomNav';
import { useTheme } from '@/context/ThemeContext';
import { Send, Megaphone, Mail, Users, CheckCircle2 } from 'lucide-react-native';

type MsgType = 'welcome' | 'update' | 'announcement' | 'system';

export default function AdminBroadcastScreen() {
  const bottomInset = useBottomNavInset();
  const { colors, isDark } = useTheme();
  const [type, setType] = useState<MsgType>('update');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetUsername, setTargetUsername] = useState('');
  const [sending, setSending] = useState(false);
  const [savingTpl, setSavingTpl] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const sendToAll = async () => {
    if (!body.trim()) return Alert.alert('النص مطلوب', 'اكتب نص الرسالة.');
    setSending(true);
    setResult(null);
    try {
      const { data: users, error: uErr } = await supabase.from('profiles').select('id');
      if (uErr) throw uErr;
      const ids = (users || []).map((u: any) => u.id);
      if (!ids.length) throw new Error('لا يوجد مستخدمون.');
      const rows = ids.map((id: string) => ({
        recipient_id: id,
        sender_label: 'فريق حيّنا',
        title: title.trim() || null,
        body: body.trim(),
        type,
      }));
      // insert in chunks
      const chunkSize = 500;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const { error } = await supabase.from('platform_messages').insert(rows.slice(i, i + chunkSize));
        if (error) throw error;
      }
      setResult(`تم إرسال ${rows.length} رسالة.`);
    } catch (e: any) {
      Alert.alert('تعذر الإرسال', e?.message || 'حاول مرة أخرى.');
    } finally {
      setSending(false);
    }
  };

  const sendToUser = async () => {
    const u = targetUsername.trim().toLowerCase();
    if (!u) return Alert.alert('اسم المستخدم مطلوب', 'أدخل username.');
    if (!body.trim()) return Alert.alert('النص مطلوب', 'اكتب نص الرسالة.');
    setSending(true);
    setResult(null);
    try {
      const { data: prof, error: pErr } = await supabase.from('profiles').select('id').eq('username', u).maybeSingle();
      if (pErr) throw pErr;
      if (!prof?.id) throw new Error('المستخدم غير موجود.');
      const { error } = await supabase.from('platform_messages').insert({
        recipient_id: prof.id,
        sender_label: 'فريق حيّنا',
        title: title.trim() || null,
        body: body.trim(),
        type,
      });
      if (error) throw error;
      setResult(`تم الإرسال إلى @${u}.`);
      setTargetUsername('');
    } catch (e: any) {
      Alert.alert('تعذر الإرسال', e?.message || 'حاول مرة أخرى.');
    } finally {
      setSending(false);
    }
  };

  const sendToNewUsers = async () => {
    if (!body.trim()) return Alert.alert('النص مطلوب', 'اكتب نص الرسالة.');
    setSending(true);
    setResult(null);
    try {
      const since = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data: users, error: uErr } = await supabase.from('profiles').select('id').gte('created_at', since);
      if (uErr) throw uErr;
      const ids = (users || []).map((u: any) => u.id);
      if (!ids.length) throw new Error('لا يوجد مستخدمون جدد خلال 7 أيام.');
      const rows = ids.map((id: string) => ({
        recipient_id: id,
        sender_label: 'فريق حيّنا',
        title: title.trim() || null,
        body: body.trim(),
        type,
      }));
      const { error } = await supabase.from('platform_messages').insert(rows);
      if (error) throw error;
      setResult(`تم إرسال ${rows.length} رسالة للمستخدمين الجدد.`);
    } catch (e: any) {
      Alert.alert('تعذر الإرسال', e?.message || 'حاول مرة أخرى.');
    } finally {
      setSending(false);
    }
  };

  const saveWelcomeTemplate = async () => {
    if (!body.trim()) return Alert.alert('النص مطلوب', 'اكتب نص رسالة الترحيب.');
    setSavingTpl(true);
    try {
      // remove old welcome templates
      await supabase.from('platform_messages').delete().is('recipient_id', null).eq('type', 'welcome');
      const { error } = await supabase.from('platform_messages').insert({
        recipient_id: null,
        sender_label: 'فريق حيّنا',
        title: title.trim() || 'مرحبًا بك في حيّنا',
        body: body.trim(),
        type: 'welcome',
      });
      if (error) throw error;
      setResult('تم حفظ رسالة الترحيب (للحسابات الجديدة).');
    } catch (e: any) {
      Alert.alert('تعذر الحفظ', e?.message || 'حاول مرة أخرى.');
    } finally {
      setSavingTpl(false);
    }
  };

  const TYPES: { key: MsgType; label: string }[] = [
    { key: 'welcome', label: 'ترحيب' },
    { key: 'update', label: 'تحديث' },
    { key: 'announcement', label: 'إعلان' },
    { key: 'system', label: 'نظام' },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <AppHeader variant="sub" title="رسائل المنصة (Broadcast)" subtitle="إرسال رسائل داخلية للجميع" fallbackRoute="/admin" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomInset + 28 }]} showsVerticalScrollIndicator={false}>
        <OasisSurface oasisSurface="card" style={[styles.card, isDark && { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <View style={styles.cardHeader}>
            <Megaphone size={18} color={OASIS.colors.primary} />
            <Text style={[styles.cardTitle, isDark && { color: colors.ink }]}>نوع الرسالة</Text>
          </View>
          <View style={styles.typeRow}>
            {TYPES.map((t) => (
              <Pressable key={t.key} style={[styles.typeBtn, type === t.key && styles.typeBtnActive]} onPress={() => setType(t.key)}>
                <Text style={[styles.typeBtnText, type === t.key && styles.typeBtnTextActive]}>{t.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.label, isDark && { color: colors.muted }]}>العنوان (اختياري)</Text>
          <TextInput value={title} onChangeText={setTitle} placeholder="عنوان الرسالة" placeholderTextColor="#94A3B8" style={[styles.input, isDark && { backgroundColor: colors.background, borderColor: colors.line, color: colors.ink }]} />

          <Text style={[styles.label, isDark && { color: colors.muted }]}>النص</Text>
          <TextInput value={body} onChangeText={setBody} placeholder="نص الرسالة..." placeholderTextColor="#94A3B8" multiline style={[styles.input, styles.textarea, isDark && { backgroundColor: colors.background, borderColor: colors.line, color: colors.ink }]} />

          <Text style={[styles.label, isDark && { color: colors.muted }]}>إرسال لمستخدم محدد (username)</Text>
          <View style={styles.targetRow}>
            <TextInput value={targetUsername} onChangeText={setTargetUsername} placeholder="username" placeholderTextColor="#94A3B8" autoCapitalize="none" style={[styles.input, isDark && { backgroundColor: colors.background, borderColor: colors.line, color: colors.ink }]} />
            <Pressable oasisKind="action" style={styles.smallBtn} onPress={() => void sendToUser()} disabled={sending}>
              <Text style={styles.smallBtnText}>إرسال</Text>
            </Pressable>
          </View>

          <Pressable oasisKind="action" style={styles.secondaryWide} onPress={() => void sendToNewUsers()} disabled={sending}>
            <Text style={styles.secondaryWideText}>إرسال للمستخدمين الجدد (آخر 7 أيام)</Text>
          </Pressable>

          <View style={styles.actions}>
            <Pressable oasisKind="action" oasisVariant="primary" style={styles.actionBtn} onPress={() => void sendToAll()} disabled={sending}>
              {sending ? <ActivityIndicator size="small" color={OASIS.colors.surface} /> : <Send size={16} color={OASIS.colors.surface} />}
              <Text style={styles.actionBtnText}>إرسال للجميع</Text>
            </Pressable>
            <Pressable oasisKind="action" style={styles.actionBtnSecondary} onPress={() => void saveWelcomeTemplate()} disabled={savingTpl}>
              {savingTpl ? <ActivityIndicator size="small" color={OASIS.colors.primary} /> : <Mail size={16} color={OASIS.colors.primary} />}
              <Text style={styles.actionBtnSecondaryText}>حفظ كرسالة ترحيب</Text>
            </Pressable>
          </View>

          {result ? (
            <View style={styles.resultRow}>
              <CheckCircle2 size={16} color={OASIS.colors.primary} />
              <Text style={styles.resultText}>{result}</Text>
            </View>
          ) : null}
        </OasisSurface>

        <OasisSurface oasisSurface="card" style={[styles.card, isDark && { backgroundColor: colors.surface, borderColor: colors.line }]}>
          <View style={styles.cardHeader}>
            <Users size={18} color={OASIS.colors.primary} />
            <Text style={[styles.cardTitle, isDark && { color: colors.ink }]}>ملاحظات</Text>
          </View>
          <Text style={[styles.note, isDark && { color: colors.muted }]}>
            • "إرسال للجميع" يُدرج رسالة لكل مستخدم (platform_messages).
            {'\n'}• "حفظ كرسالة ترحيب" يحفظ قالبًا (recipient_id = null، type=welcome) يُرسل تلقائيًا للحسابات الجديدة.
            {'\n'}• رسائل المنصة تظهر في صفحة "الرسائل" (قسم منفصل).
          </Text>
        </OasisSurface>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F9F8' },
  content: { padding: 14, gap: 12, maxWidth: 820, width: '100%', alignSelf: 'center' },
  card: { padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#DDEAE4', backgroundColor: '#FFFFFF', gap: 10 },
  cardHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  cardTitle: { color: '#1C1C1E', fontSize: 15, fontWeight: '800', textAlign: 'right', flex: 1 },
  typeRow: { flexDirection: 'row-reverse', gap: 6, flexWrap: 'wrap' },
  typeBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: '#F1F5F9' },
  typeBtnActive: { backgroundColor: OASIS.colors.primary },
  typeBtnText: { color: OASIS.colors.muted, fontSize: 11, fontWeight: '700' },
  typeBtnTextActive: { color: OASIS.colors.surface },
  label: { color: '#636366', fontSize: 11, fontWeight: '700', textAlign: 'right' },
  input: { minHeight: 42, borderWidth: 1, borderColor: '#DDEAE4', borderRadius: 10, paddingHorizontal: 10, color: '#1C1C1E', fontSize: 12, fontWeight: '700', backgroundColor: '#FFFFFF' },
  textarea: { minHeight: 110, textAlignVertical: 'top', paddingTop: 10 },
  targetRow: { flexDirection: 'row-reverse', gap: 8, alignItems: 'center' },
  smallBtn: { paddingHorizontal: 14, minHeight: 42, borderRadius: 10, backgroundColor: OASIS.colors.soft, borderWidth: 1, borderColor: OASIS.colors.primary, alignItems: 'center', justifyContent: 'center' },
  smallBtnText: { color: OASIS.colors.primary, fontSize: 12, fontWeight: '800' },
  secondaryWide: { minHeight: 42, borderRadius: 10, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: OASIS.colors.primary, backgroundColor: OASIS.colors.soft },
  secondaryWideText: { color: OASIS.colors.primary, fontSize: 12, fontWeight: '800' },
  actions: { flexDirection: 'row-reverse', gap: 8, flexWrap: 'wrap' },
  actionBtn: { flex: 1, minHeight: 44, borderRadius: 12, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: OASIS.colors.primary },
  actionBtnText: { color: OASIS.colors.surface, fontSize: 12, fontWeight: '800' },
  actionBtnSecondary: { flex: 1, minHeight: 44, borderRadius: 12, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: OASIS.colors.primary, backgroundColor: OASIS.colors.soft },
  actionBtnSecondaryText: { color: OASIS.colors.primary, fontSize: 12, fontWeight: '800' },
  resultRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  resultText: { color: OASIS.colors.primary, fontSize: 12, fontWeight: '700' },
  note: { color: '#636366', fontSize: 11, lineHeight: 18, textAlign: 'right' },
});
