import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Switch, Text, View } from 'react-native';
import { Lock, Phone, Save, Trash2 } from 'lucide-react-native';
import { OasisPressable as Pressable, OasisTextInput as TextInput } from '@/components/oasis/OasisPrimitives';
import { useTheme } from '@/context/ThemeContext';
import { CONTACT_PHONE_ERROR, normalizeContactPhone } from '@/lib/contactPhone';
import { loadProfileContact, saveProfileContact, type ProfileContact } from '@/lib/profileContact';

type Props = { userId: string; restricted: boolean; onSaved: (message: string) => void };

export function ProfileContactSettings({ userId, restricted, onSaved }: Props) {
  const { colors } = useTheme();
  const [phone, setPhone] = useState('');
  const [visible, setVisible] = useState(false);
  const [saved, setSaved] = useState<ProfileContact | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const sequence = useRef(0);
  const writePending = useRef(false);

  const load = useCallback(async () => {
    const request = ++sequence.current;
    setLoading(true); setLoaded(false); setError('');
    try {
      const contact = await loadProfileContact(userId);
      if (request !== sequence.current) return;
      setSaved(contact); setPhone(contact?.phone || ''); setVisible(contact?.is_visible || false); setLoaded(true);
    } catch {
      if (request === sequence.current) setError('تعذر تحميل رقم التواصل. أعد المحاولة.');
    } finally { if (request === sequence.current) setLoading(false); }
  }, [userId]);

  useEffect(() => { void load(); return () => { sequence.current++; }; }, [load]);
  const normalized = normalizeContactPhone(phone);
  const validation = normalized === null ? CONTACT_PHONE_ERROR : '';
  const dirty = normalized !== (saved?.phone || '') || visible !== (saved?.is_visible || false);
  const busy = loading || saving || !loaded;

  async function save(remove = false) {
    if (busy || writePending.current || (!remove && validation)) return;
    writePending.current = true;
    const request = ++sequence.current;
    setSaving(true); setError('');
    try {
      const contact = await saveProfileContact(userId, remove ? '' : phone, remove ? false : visible);
      if (request !== sequence.current) return;
      setSaved(contact); setPhone(contact?.phone || ''); setVisible(contact?.is_visible || false);
      onSaved(!contact ? 'تم حذف رقم التواصل.' : contact.is_visible && !restricted ? 'رقم التواصل ظاهر في ملفك العام.' : 'رقم التواصل محفوظ ومخفي عن الآخرين.');
    } catch {
      if (request === sequence.current) setError('تعذر حفظ رقم التواصل. لم يتم تأكيد التغيير؛ أعد المحاولة.');
    } finally {
      writePending.current = false;
      if (request === sequence.current) setSaving(false);
    }
  }

  return <View testID="profile-contact-settings" style={[styles.card, { borderColor: colors.line }]}>
    <View style={styles.row}><Phone size={20} color={colors.primary} /><Text style={[styles.title, { color: colors.ink }]}>رقم التواصل الاختياري</Text></View>
    <Text style={[styles.hint, { color: colors.muted }]}>أضف رقمًا ليتمكن الآخرون من الاتصال بك. الرقم اختياري ومخفي افتراضيًا، ولا يغيّر بيانات تسجيل الدخول.</Text>
    {loading ? <ActivityIndicator accessibilityLabel="تحميل رقم التواصل" color={colors.primary} /> : <>
      <TextInput accessibilityLabel="رقم التواصل" value={phone} onChangeText={value => { setPhone(value); setError(''); if (!value.trim()) setVisible(false); }} keyboardType="phone-pad" autoComplete="tel" autoCorrect={false} autoCapitalize="none" maxLength={30} editable={!busy} placeholder="05xxxxxxxx أو +9665xxxxxxxx" placeholderTextColor={colors.muted} style={[styles.input, { color: colors.ink, backgroundColor: colors.background, borderColor: validation ? colors.danger : colors.line }]} />
      {!!validation && <Text accessibilityRole="alert" style={[styles.hint, { color: colors.danger }]}>{validation}</Text>}
      <View style={styles.row}>
        <View style={{ flex: 1, gap: 4 }}><Text style={[styles.label, { color: colors.ink }]}>إظهار رقم التواصل</Text><Text style={[styles.hint, { color: colors.muted }]}>يظهر في ملفك العام بعد الحفظ.</Text></View>
        <Switch accessibilityLabel="إظهار رقم التواصل" disabled={busy || !normalized} value={visible} onValueChange={value => { setVisible(value); setError(''); }} trackColor={{ false: colors.line, true: '#A7F3D0' }} thumbColor={visible ? colors.primary : colors.muted} />
      </View>
      <View style={styles.row}><Lock size={15} color={colors.muted} /><Text style={[styles.hint, { flex: 1, color: colors.muted }]}>{restricted ? 'حسابك خاص أو اسمك مخفي؛ سيبقى الرقم مخفيًا عن الآخرين حتى يصبح ملفك عامًا.' : 'إيقاف الإظهار يمنع الآخرين من قراءة الرقم، ويظل متاحًا لك في إعداداتك.'}</Text></View>
      {!!error && <Text accessibilityRole="alert" style={[styles.hint, { color: colors.danger }]}>{error}</Text>}
      {!loaded ? <Pressable onPress={() => void load()} style={styles.button}><Text style={{ color: colors.primary }}>إعادة المحاولة</Text></Pressable> : <View style={styles.row}>
        <Pressable accessibilityLabel="حفظ رقم التواصل" onPress={() => void save()} disabled={busy || !dirty || !!validation} style={[styles.button, { flex: 1, backgroundColor: colors.primary }]}>{saving ? <ActivityIndicator color={colors.surface} /> : <Save size={17} color={colors.surface} />}<Text style={{ color: colors.surface, fontWeight: '700' }}>{saving ? 'جارٍ الحفظ…' : 'حفظ رقم التواصل'}</Text></Pressable>
        {!!saved && <Pressable accessibilityLabel="حذف رقم التواصل" onPress={() => void save(true)} disabled={busy} style={styles.button}><Trash2 size={17} color={colors.danger} /><Text style={{ color: colors.danger }}>حذف الرقم</Text></Pressable>}
      </View>}
      {loaded && <Text style={[styles.hint, { color: colors.muted }]}>{dirty ? 'لديك تغييرات غير محفوظة.' : saved?.is_visible && !restricted ? 'الحالة المحفوظة: ظاهر في ملفك العام.' : saved ? 'الحالة المحفوظة: مخفي عن الآخرين.' : 'لم تُضف رقم تواصل بعد.'}</Text>}
    </>}
  </View>;
}

const styles = StyleSheet.create({
  card: { borderTopWidth: 1, paddingTop: 18, gap: 12 },
  row: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  title: { fontSize: 15, fontWeight: '700', textAlign: 'right' },
  label: { fontSize: 13, fontWeight: '700', textAlign: 'right' },
  hint: { fontSize: 12, lineHeight: 20, textAlign: 'right' },
  input: { borderWidth: 1, borderRadius: 12, minHeight: 48, paddingHorizontal: 12, fontSize: 16, textAlign: 'left', writingDirection: 'ltr' },
  button: { minHeight: 44, borderRadius: 12, paddingHorizontal: 12, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6 },
});
