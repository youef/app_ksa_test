import { OasisPressable as Pressable, OasisTextInput as TextInput, OasisSurface } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View, ActivityIndicator, Platform } from 'react-native';
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
import { AppHeader } from '@/components/shared/AppHeader';

export default function Report() {
  const { type, id } = useLocalSearchParams<{ type: string; id: string }>();
  const [selectedReason, setSelectedReason] = useState('محتوى غير لائق أو مخالف');
  const [reasonDetails, setReasonDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [myReports, setMyReports] = useState<any[]>([]);
  const reportStatusLabels: Record<string, string> = { pending: 'قيد المراجعة', reviewing: 'جارٍ الفحص', resolved: 'تمت المعالجة', dismissed: 'لم تثبت المخالفة', rejected: 'مرفوض' };

  useEffect(() => {
    let active = true;
    async function loadMyReports() {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) return;
      const { data, error } = await supabase.from('reports')
        .select('id,target_type,target_id,reason,status,created_at')
        .eq('reporter_id', authData.user.id)
        .order('created_at', { ascending: false })
        .limit(6);
      if (!error && active) setMyReports(data || []);
    }
    void loadMyReports();
    return () => { active = false; };
  }, []);

  const reasons = [
    'محتوى غير لائق أو مخالف',
    'احتيال أو نشاط مشبوه',
    'معلومات مضللة أو خاطئة',
    'إعلان مكرر أو ترويجي',
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
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <AppHeader
        variant="sub"
        title="إبلاغ الإدارة"
        subtitle="حفاظاً على سلامة مجتمع الحي"
        fallbackRoute="/home"
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <OasisSurface oasisSurface="card" style={styles.card}>
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

          <Pressable oasisVariant="primary" oasisKind="action"
            style={[styles.submitBtn, submitting && { opacity: 0.6 }]}
            onPress={send}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={OASIS.colors.surface} />
            ) : (
              <Text style={styles.submitBtnText}>إرسال البلاغ للإدارة</Text>
            )}
          </Pressable>
        </OasisSurface>

        {myReports.length > 0 && (
          <OasisSurface oasisSurface="card" style={[styles.card, { marginTop: 16 }]}>
            <Text style={styles.sectionTitle}>متابعة بلاغاتي</Text>
            <Text style={{ color: OASIS.colors.muted, fontSize: 12, textAlign: 'right', marginBottom: 12 }}>حالة آخر البلاغات التي أرسلتها، ولا تظهر هذه القائمة للآخرين.</Text>
            {myReports.map(report => (
              <View key={report.id} style={{ paddingVertical: 11, borderTopWidth: 1, borderTopColor: OASIS.colors.line, gap: 5 }}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <Text style={{ color: OASIS.colors.ink, fontSize: 12, fontWeight: '600', flex: 1, textAlign: 'right' }} numberOfLines={2}>{String(report.reason || '').split(' - تفاصيل:')[0]}</Text>
                  <View style={{ backgroundColor: report.status === 'resolved' ? '#dcfce7' : report.status === 'dismissed' || report.status === 'rejected' ? '#fee2e2' : '#fef3c7', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5 }}>
                    <Text style={{ color: OASIS.colors.ink, fontSize: 11, fontWeight: '700' }}>{reportStatusLabels[report.status] || report.status || 'قيد المراجعة'}</Text>
                  </View>
                </View>
                <Text style={{ color: '#94a3b8', fontSize: 11, textAlign: 'right' }}>{new Date(report.created_at).toLocaleDateString('ar-SA')}</Text>
              </View>
            ))}
          </OasisSurface>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: OASIS.colors.background,
  },
  scroll: {
    paddingBottom: 14,
  },
  hero: {
    paddingTop: Platform.OS === 'ios' ? 52 : 40,
    paddingHorizontal: 20,
    paddingBottom: 16,
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
    color: OASIS.colors.surface,
    fontSize: 18,
    fontWeight: '700',
  },
  heroSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    textAlign: 'right',
    lineHeight: 18,
  },
  card: {
    backgroundColor: OASIS.colors.surface,
    borderRadius: 14,
    marginHorizontal: 16,
    marginTop: -10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionTitle: {
    color: OASIS.colors.ink,
    fontSize: 15,
    fontWeight: '700',
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
    backgroundColor: OASIS.colors.background,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: OASIS.colors.line,
  },
  reasonOptionActive: {
    borderColor: OASIS.colors.primary,
    backgroundColor: OASIS.colors.soft,
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
    borderColor: OASIS.colors.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: OASIS.colors.primary,
  },
  reasonText: {
    color: OASIS.colors.muted,
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
  },
  reasonTextActive: {
    color: OASIS.colors.primary,
    fontWeight: '600',
  },
  label: {
    color: OASIS.colors.ink,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
    marginBottom: 8,
  },
  inputContainer: {
    backgroundColor: OASIS.colors.background,
    borderRadius: 14,
    padding: 12,
    height: 100,
    borderWidth: 1,
    borderColor: OASIS.colors.line,
    marginBottom: 14,
  },
  input: {
    color: OASIS.colors.ink,
    fontSize: 13,
    textAlign: 'right',
    height: 80,
    textAlignVertical: 'top',
  },
  submitBtn: {
    backgroundColor: OASIS.colors.danger,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: OASIS.colors.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnText: {
    color: OASIS.colors.surface,
    fontSize: 15,
    fontWeight: '700',
  },
});
