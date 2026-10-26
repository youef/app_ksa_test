import { OasisPressable as Pressable, OasisTextInput as TextInput, OasisSurface } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import { useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { AppHeader } from '@/components/shared/AppHeader';
import { useBottomNavInset } from '@/lib/bottomNav';
import { supabase } from '@/lib/supabase';
import { Mail, Send } from 'lucide-react-native';

export default function ContactUsScreen() {
  const bottomNavInset = useBottomNavInset();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!name.trim() || !subject.trim() || !message.trim()) { Alert.alert('تنبيه', 'أكمل الحقول.'); return; }
    setSending(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from('support_tickets').insert({ user_id: auth.user?.id || null, name: name.trim(), email: email.trim() || null, subject: subject.trim(), message: message.trim() });
      if (error) throw error;
      Alert.alert('تم الإرسال', 'تم إرسال طلبك إلى فريق حيّنا.');
      setName(''); setEmail(''); setSubject(''); setMessage('');
    } catch (e) { Alert.alert('تعذّر الإرسال', e instanceof Error ? e.message : 'حاول مرة أخرى.'); }
    finally { setSending(false); }
  };

  return (
    <View style={styles.screen}>
      <AppHeader variant="sub" title="اتصل بنا" subtitle="الرسائل تصل إدارة حيّنا" fallbackRoute="/more" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomNavInset + 24 }]}>
        <OasisSurface oasisSurface="card" style={styles.card}>
          <Mail size={22} color={OASIS.colors.primary} />
          <Text style={styles.title}>نموذج الدعم</Text>
          <Field label="الاسم" value={name} onChange={setName} placeholder="اسمك" />
          <Field label="البريد (اختياري)" value={email} onChange={setEmail} placeholder="email@domain.com" keyboard="email-address" />
          <Field label="الموضوع" value={subject} onChange={setSubject} placeholder="موضوع الرسالة" />
          <TextInput style={styles.textArea} placeholder="اكتب الرسالة" placeholderTextColor="#94a3b8" value={message} onChangeText={setMessage} multiline textAlign="right" textAlignVertical="top" />
          <Pressable style={[styles.btn, sending && { opacity: 0.7 }]} onPress={submit} disabled={sending}>
            {sending ? <ActivityIndicator color={OASIS.colors.surface} /> : (<View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Send size={14} color={OASIS.colors.surface} /><Text style={styles.btnText}>إرسال</Text></View>)}
          </Pressable>
        </OasisSurface>
      </ScrollView>
    </View>
  );
}

function Field({ label, value, onChange, placeholder, keyboard = 'default' }: any) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor="#94a3b8" style={styles.input} textAlign="right" keyboardType={keyboard} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: OASIS.colors.background },
  content: { padding: 14 },
  card: { backgroundColor: OASIS.colors.surface, borderWidth: 1, borderColor: OASIS.colors.line, borderRadius: 14, padding: 14, gap: 10 },
  title: { fontSize: 15, fontWeight: '700', color: OASIS.colors.ink, textAlign: 'right' },
  label: { fontSize: 11.5, fontWeight: '700', color: OASIS.colors.muted, textAlign: 'right' },
  input: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, color: OASIS.colors.ink, textAlign: 'right' },
  textArea: { minHeight: 110, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, color: OASIS.colors.ink, textAlign: 'right', textAlignVertical: 'top' },
  btn: { backgroundColor: OASIS.colors.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 6 },
  btnText: { color: OASIS.colors.surface, fontWeight: '700', fontSize: 13 },
});
