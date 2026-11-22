import { OasisPressable as Pressable, OasisTextInput as TextInput, OasisSurface } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import { useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { AppHeader } from '@/components/shared/AppHeader';
import { useBottomNavInset } from '@/lib/bottomNav';
import { supabase } from '@/lib/supabase';
import { Mail, Send } from 'lucide-react-native';

const MESSAGE_LIMIT = 2000;

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  accessibilityLabel: string;
  maxLength: number;
  keyboard?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
};

export default function ContactUsScreen() {
  const bottomNavInset = useBottomNavInset();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!name.trim() || !subject.trim() || !message.trim()) {
      Alert.alert('تنبيه', 'أكمل الحقول.');
      return;
    }
    setSending(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase.from('support_tickets').insert({
        user_id: auth.user?.id || null,
        name: name.trim(),
        email: email.trim() || null,
        subject: subject.trim(),
        message: message.trim(),
      });
      if (error) throw error;
      Alert.alert('تم الإرسال', 'تم إرسال طلبك إلى فريق حيّنا.');
      setName('');
      setEmail('');
      setSubject('');
      setMessage('');
    } catch (e) {
      Alert.alert('تعذّر الإرسال', e instanceof Error ? e.message : 'حاول مرة أخرى.');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.screen}>
      <AppHeader variant="sub" title="اتصل بنا" subtitle="الرسائل تصل إدارة حيّنا" fallbackRoute="/more" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomNavInset + 12 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <OasisSurface oasisSurface="card" style={styles.card}>
          <View style={styles.intro}>
            <View style={styles.introIcon} accessible={false}>
              <Mail size={22} color={OASIS.colors.primary} />
            </View>
            <View style={styles.introCopy}>
              <Text style={styles.title} accessibilityRole="header">رسالتك لفريق حيّنا</Text>
              <Text style={styles.introText}>اقتراح أو استفسار أو ملاحظة؟ اكتبها هنا وسنستقبلها عبر نموذج التواصل.</Text>
            </View>
          </View>

          <View style={styles.fields}>
            <Field label="الاسم" value={name} onChange={setName} placeholder="اسمك" accessibilityLabel="الاسم" maxLength={80} />
            <Field
              label="البريد الإلكتروني (اختياري)"
              value={email}
              onChange={setEmail}
              placeholder="email@domain.com"
              accessibilityLabel="البريد الإلكتروني، اختياري"
              keyboard="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={254}
            />
            <Field label="الموضوع" value={subject} onChange={setSubject} placeholder="عنوان مختصر للرسالة" accessibilityLabel="موضوع الرسالة" maxLength={120} />
            <View style={styles.messageGroup}>
              <Text style={styles.label} accessibilityRole="text">نص الرسالة</Text>
              <TextInput
                style={styles.textArea}
                placeholder="اكتب تفاصيل رسالتك..."
                value={message}
                onChangeText={setMessage}
                multiline
                maxLength={MESSAGE_LIMIT}
                accessibilityLabel="نص الرسالة"
                accessibilityHint="اكتب تفاصيل الاستفسار أو الاقتراح"
                textAlign="right"
                textAlignVertical="top"
              />
              <View style={styles.counterRow}>
                <Text style={styles.counter} accessibilityLiveRegion="polite">{message.length} / {MESSAGE_LIMIT}</Text>
                <Text style={styles.counterHint}>حد الرسالة 2000 حرف</Text>
              </View>
            </View>
          </View>

          <Pressable
            oasisKind="action"
            oasisVariant="primary"
            style={[styles.btn, sending && styles.btnBusy]}
            onPress={submit}
            disabled={sending}
            accessibilityRole="button"
            accessibilityLabel={sending ? 'جارٍ إرسال الرسالة' : 'إرسال الرسالة إلى فريق حيّنا'}
            accessibilityState={{ disabled: sending, busy: sending }}
            accessibilityHint="إرسال نموذج التواصل"
          >
            {sending
              ? <><ActivityIndicator color={OASIS.colors.surface} /><Text style={styles.btnText}>جارٍ الإرسال...</Text></>
              : <><Send size={16} color={OASIS.colors.surface} /><Text style={styles.btnText}>إرسال الرسالة</Text></>}
          </Pressable>
        </OasisSurface>
      </ScrollView>
    </View>
  );
}

function Field({ label, value, onChange, placeholder, accessibilityLabel, maxLength, keyboard = 'default', autoCapitalize, autoCorrect }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label} accessibilityRole="text">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        style={styles.input}
        textAlign="right"
        keyboardType={keyboard}
        accessibilityLabel={accessibilityLabel}
        maxLength={maxLength}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { width: '100%', maxWidth: 560, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 12 },
  card: { backgroundColor: OASIS.colors.surface, borderWidth: 1, borderColor: OASIS.colors.line, borderRadius: 18, padding: 16, gap: 16 },
  intro: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 12 },
  introIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: OASIS.colors.soft, alignItems: 'center', justifyContent: 'center' },
  introCopy: { flex: 1, alignItems: 'flex-end', gap: 5, minWidth: 0 },
  title: { fontSize: 16, lineHeight: 23, fontWeight: '800', color: OASIS.colors.ink, textAlign: 'right' },
  introText: { fontSize: 12.5, lineHeight: 20, color: OASIS.colors.muted, textAlign: 'right' },
  fields: { gap: 14 },
  field: { gap: 7 },
  messageGroup: { gap: 7 },
  label: { fontSize: 12, lineHeight: 18, fontWeight: '700', color: OASIS.colors.muted, textAlign: 'right' },
  input: { minHeight: 44, borderWidth: 1, borderColor: OASIS.colors.line, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: OASIS.colors.background, color: OASIS.colors.ink, textAlign: 'right', fontSize: 14 },
  textArea: { minHeight: 120, borderWidth: 1, borderColor: OASIS.colors.line, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 12, backgroundColor: OASIS.colors.background, color: OASIS.colors.ink, textAlign: 'right', textAlignVertical: 'top', fontSize: 14 },
  counterRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  counter: { color: OASIS.colors.muted, fontSize: 11, fontVariant: ['tabular-nums'] },
  counterHint: { color: OASIS.colors.muted, fontSize: 11, textAlign: 'right' },
  btn: { minHeight: 48, borderRadius: 14, backgroundColor: OASIS.colors.primary, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16, marginTop: 2 },
  btnBusy: { opacity: 0.72 },
  btnText: { color: OASIS.colors.surface, fontWeight: '800', fontSize: 13 },
});
