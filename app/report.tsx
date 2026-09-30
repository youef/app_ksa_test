import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/ui';
import {
  ChevronRight,
  AlertTriangle,
  ShieldAlert,
  CheckCircle2,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function Report() {
  const { type, id } = useLocalSearchParams<{ type: string; id: string }>();
  const [selectedReason, setSelectedReason] = useState('محتوى غير لائق أو مخالف');
  const [reasonDetails, setReasonDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const reasons = [
    'محتوى غير لائق أو مخالف',
    'احتيال أو نشاط مشبوه',
    'معلومات مضللة أو خاطئة',
    'إساءة أو مضايقة',
    'انتحال شخصية أو حساب مزيف',
    'أخرى',
  ];

  async function send() {
    setSubmitting(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return router.replace('/auth');

      const fullReason = `${selectedReason}${reasonDetails.trim() ? ` - تفاصيل: ${reasonDetails.trim()}` : ''}`;

      const r = await supabase.from('reports').insert({
        reporter_id: u.user.id,
        target_type: type || 'unknown',
        target_id: id,
        reason: fullReason,
      });

      setSubmitting(false);
      if (r.error) {
        Alert.alert('خطأ', r.error.message);
      } else {
        Alert.alert(
          'تم استلام البلاغ! 🛡️',
          'شكراً لحرصك على أمان وموثوقية مجتمع حيّنا. ستتم مراجعة البلاغ واتخاذ الإجراء اللازم فوراً.',
          [{ text: 'حسناً', onPress: () => router.back() }]
        );
      }
    } catch (e: any) {
      setSubmitting(false);
      Alert.alert('خطأ', e.message || 'تعذر إرسال البلاغ');
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <LinearGradient
          colors={['#0891b2', '#0e7490', '#0f172a']}
          style={styles.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.navBar}>
            <Pressable onPress={() => router.back()} style={styles.iconBtn}>
              <ChevronRight size={28} color="#fff" />
            </Pressable>
            <Text style={styles.navTitle}>إبلاغ الإدارة 🛡️</Text>
            <View style={{ width: 28 }} />
          </View>
          <Text style={styles.heroSub}>
            حفاظاً على سلامة مجتمع الحي، يرجى توضيح سبب الإبلاغ بدقة.
          </Text>
        </LinearGradient>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>اختر سبب البلاغ:</Text>

          <View style={styles.reasonsList}>
            {reasons.map(r => (
              <Pressable
                key={r}
                style={[styles.reasonOption, selectedReason === r && styles.reasonOptionActive]}
                onPress={() => setSelectedReason(r)}
              >
                <View style={[styles.radioCircle, selectedReason === r && styles.radioCircleActive]}>
                  {selectedReason === r && <View style={styles.radioInner} />}
                </View>
                <Text style={[styles.reasonText, selectedReason === r && styles.reasonTextActive]}>
                  {r}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>تفاصيل إضافية (اختياري):</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              multiline
              value={reasonDetails}
              onChangeText={setReasonDetails}
              placeholder="اكتب أي ملاحظات أو روابط تساعد فريق الرقابة..."
              placeholderTextColor="#9ca3af"
            />
          </View>

          <Pressable
            style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
            onPress={send}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.submitBtnText}>إرسال البلاغ للإدارة</Text>
            )}
          </Pressable>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scroll: {
    paddingBottom: 20,
  },
  hero: {
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  navBar: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconBtn: {
    padding: 6,
  },
  navTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
  },
  heroSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    textAlign: 'right',
    lineHeight: 18,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 22,
    marginHorizontal: 16,
    marginTop: -10,
    padding: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'right',
    marginBottom: 12,
  },
  reasonsList: {
    gap: 8,
    marginBottom: 16,
  },
  reasonOption: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  reasonOptionActive: {
    borderColor: '#0891b2',
    backgroundColor: '#ecfeff',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: '#0891b2',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#0891b2',
  },
  reasonText: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
  },
  reasonTextActive: {
    color: '#0891b2',
    fontWeight: '800',
  },
  label: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
    marginBottom: 8,
  },
  inputContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 12,
    height: 100,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 20,
  },
  input: {
    color: '#0f172a',
    fontSize: 13,
    textAlign: 'right',
    height: 80,
    textAlignVertical: 'top',
  },
  submitBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
});
