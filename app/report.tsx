import { OasisPressable as Pressable, OasisTextInput as TextInput, OasisSurface } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { AlertCircle, Check, Clock3, RefreshCw, Send, ShieldCheck } from 'lucide-react-native';
import { AppHeader } from '@/components/shared/AppHeader';
import { useBottomNavInset } from '@/lib/bottomNav';

type ReportHistoryItem = {
  id: string;
  reason?: string | null;
  status?: string | null;
  created_at: string;
};

const REPORT_REASONS = [
  'محتوى غير لائق أو مخالف',
  'احتيال أو نشاط مشبوه',
  'معلومات مضللة أو خاطئة',
  'إعلان مكرر أو ترويجي',
  'إساءة أو مضايقة',
  'انتحال شخصية أو حساب مزيف',
  'أخرى',
];

const REPORT_STATUS_LABELS: Record<string, string> = {
  pending: 'قيد المراجعة',
  reviewing: 'جارٍ الفحص',
  resolved: 'تمت المعالجة',
  dismissed: 'لم تثبت المخالفة',
  rejected: 'مرفوض',
};

export default function Report() {
  const { type, id } = useLocalSearchParams<{ type: string; id: string }>();
  const bottomNavInset = useBottomNavInset(24);
  const { width } = useWindowDimensions();
  const wideLayout = width >= 680;

  const [selectedReason, setSelectedReason] = useState(REPORT_REASONS[0]);
  const [reasonDetails, setReasonDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [myReports, setMyReports] = useState<ReportHistoryItem[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [reportsError, setReportsError] = useState('');
  const [historySignedIn, setHistorySignedIn] = useState<boolean | null>(null);
  const mountedRef = useRef(true);

  const loadMyReports = useCallback(async () => {
    if (!mountedRef.current) return;
    setReportsLoading(true);
    setReportsError('');
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (!mountedRef.current) return;
      if (authError) throw authError;
      if (!authData.user) {
        setHistorySignedIn(false);
        setMyReports([]);
        return;
      }

      setHistorySignedIn(true);
      const { data, error } = await supabase.from('reports')
        .select('id,target_type,target_id,reason,status,created_at')
        .eq('reporter_id', authData.user.id)
        .order('created_at', { ascending: false })
        .limit(6);
      if (!mountedRef.current) return;
      if (error) throw error;
      setMyReports((data || []) as ReportHistoryItem[]);
    } catch {
      if (mountedRef.current) setReportsError('تعذر تحميل سجل البلاغات الآن. تحقق من اتصالك وحاول مرة أخرى.');
    } finally {
      if (mountedRef.current) setReportsLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void loadMyReports();
    return () => { mountedRef.current = false; };
  }, [loadMyReports]);

  async function send() {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const { data: userData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!userData.user) {
        router.replace('/auth');
        return;
      }

      const fullReason = selectedReason + (reasonDetails.trim() ? ' - تفاصيل: ' + reasonDetails.trim() : '');
      const result = await supabase.from('reports').insert({
        reporter_id: userData.user.id,
        target_type: type || 'unknown',
        target_id: id,
        reason: fullReason,
      });

      if (result.error) throw result.error;

      setReasonDetails('');
      void loadMyReports();
      Alert.alert(
        'تم استلام البلاغ! 🛡️',
        'شكراً لحرصك على أمان وموثوقية مجتمع حيّنا. ستتم مراجعة البلاغ واتخاذ الإجراء اللازم.',
        [{ text: 'حسناً', onPress: () => router.back() }],
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'تعذر إرسال البلاغ. تحقق من اتصالك وحاول مجددًا.';
      setSubmitError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.container}>
      <AppHeader
        variant="sub"
        title="إبلاغ الإدارة"
        subtitle="حفاظاً على سلامة مجتمع الحي"
        fallbackRoute="/home"
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomNavInset }]}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.contentWrap}>
          <View style={styles.introCard}>
            <View style={styles.introIcon}>
              <ShieldCheck size={25} color={OASIS.colors.primary} />
            </View>
            <View style={styles.introCopy}>
              <Text style={styles.introEyebrow}>سلامة المجتمع</Text>
              <Text style={styles.introTitle} accessibilityRole="header">ساعدنا نحافظ على حيّنا</Text>
              <Text style={styles.introText}>
                اختر السبب الأقرب، وأضف ما يساعد فريق المراجعة على فهم البلاغ. ستبقى تفاصيل بلاغاتك خاصة بحسابك.
              </Text>
            </View>
          </View>

          <OasisSurface oasisSurface="card" style={styles.formCard}>
            <View style={styles.sectionHeading}>
              <View style={styles.sectionHeadingCopy}>
                <Text style={styles.sectionTitle} accessibilityRole="header">ما سبب البلاغ؟</Text>
                <Text style={styles.sectionHint}>اختر سبباً واحداً يصف المشكلة بشكل أدق.</Text>
              </View>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>١ / ٢</Text>
              </View>
            </View>

            <View style={styles.reasonGrid}>
              {REPORT_REASONS.map(reason => {
                const selected = selectedReason === reason;
                return (
                  <Pressable
                    key={reason}
                    oasisKind="plain"
                    style={[
                      styles.reasonOption,
                      wideLayout && styles.reasonOptionWide,
                      selected && styles.reasonOptionActive,
                    ]}
                    onPress={() => setSelectedReason(reason)}
                    accessibilityRole="radio"
                    accessibilityLabel={reason}
                    accessibilityHint="اختر هذا السبب لتوضيح طبيعة البلاغ"
                    accessibilityState={{ checked: selected }}
                  >
                    <View style={[styles.radioCircle, selected && styles.radioCircleActive]}>
                      {selected ? <Check size={13} color={OASIS.colors.surface} /> : null}
                    </View>
                    <Text style={[styles.reasonText, selected && styles.reasonTextActive]}>{reason}</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.fieldHeading}>
              <Text style={styles.label}>تفاصيل إضافية</Text>
              <Text style={styles.optionalLabel}>اختياري</Text>
            </View>
            <Text style={styles.fieldHint}>لا تشارك معلومات شخصية غير ضرورية. أضف وصفاً مختصراً أو رابطاً عند الحاجة.</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                multiline
                value={reasonDetails}
                onChangeText={setReasonDetails}
                placeholder="اكتب التفاصيل التي تساعد فريق المراجعة..."
                placeholderTextColor={OASIS.colors.muted}
                accessibilityLabel="تفاصيل إضافية للبلاغ"
                accessibilityHint="حقل اختياري متعدد الأسطر"
                textAlign="right"
                textAlignVertical="top"
              />
            </View>

            {submitError ? (
              <View style={styles.errorBanner} accessibilityRole="alert" accessibilityLiveRegion="assertive">
                <AlertCircle size={18} color={OASIS.colors.danger} />
                <Text style={styles.errorText}>{submitError}</Text>
              </View>
            ) : null}

            <Pressable
              oasisVariant="primary"
              oasisKind="action"
              style={[styles.submitBtn, submitting && styles.submitBtnBusy]}
              onPress={send}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel={submitting ? 'جارٍ إرسال البلاغ' : 'إرسال البلاغ للإدارة'}
              accessibilityState={{ disabled: submitting, busy: submitting }}
            >
              {submitting ? (
                <>
                  <ActivityIndicator size="small" color={OASIS.colors.surface} />
                  <Text style={styles.submitBtnText}>جارٍ الإرسال</Text>
                </>
              ) : (
                <>
                  <Send size={17} color={OASIS.colors.surface} />
                  <Text style={styles.submitBtnText}>إرسال البلاغ للإدارة</Text>
                </>
              )}
            </Pressable>
            <Text style={styles.privacyHint}>تُستخدم المعلومات لمراجعة البلاغ فقط، ولا تظهر للآخرين.</Text>
          </OasisSurface>

          <OasisSurface oasisSurface="card" style={styles.historyCard}>
            <View style={styles.historyHeader}>
              <View style={styles.historyTitleGroup}>
                <Text style={styles.historyTitle} accessibilityRole="header">متابعة بلاغاتي</Text>
                <Text style={styles.historySubtitle}>آخر البلاغات المرتبطة بحسابك</Text>
              </View>
              <View style={styles.historyIcon}>
                <Clock3 size={19} color={OASIS.colors.primary} />
              </View>
            </View>

            {reportsLoading ? (
              <View style={styles.stateCard}>
                <ActivityIndicator size="small" color={OASIS.colors.primary} />
                <Text style={styles.stateText}>جارٍ تحميل سجل البلاغات...</Text>
              </View>
            ) : reportsError ? (
              <View style={styles.stateCard}>
                <AlertCircle size={22} color={OASIS.colors.danger} />
                <Text style={styles.stateText}>{reportsError}</Text>
                <Pressable
                  oasisKind="plain"
                  style={styles.retryButton}
                  onPress={() => void loadMyReports()}
                  accessibilityRole="button"
                  accessibilityLabel="إعادة تحميل سجل البلاغات"
                  accessibilityState={{ disabled: reportsLoading, busy: reportsLoading }}
                  disabled={reportsLoading}
                >
                  <RefreshCw size={15} color={OASIS.colors.primary} />
                  <Text style={styles.retryText}>إعادة المحاولة</Text>
                </Pressable>
              </View>
            ) : historySignedIn === false ? (
              <View style={styles.stateCard}>
                <Text style={styles.stateText}>سجّل الدخول لمتابعة البلاغات المرتبطة بحسابك.</Text>
                <Pressable
                  oasisKind="action"
                  oasisVariant="secondary"
                  style={styles.loginButton}
                  onPress={() => router.push('/auth')}
                  accessibilityRole="button"
                  accessibilityLabel="تسجيل الدخول لمتابعة البلاغات"
                >
                  <Text style={styles.retryText}>تسجيل الدخول</Text>
                </Pressable>
              </View>
            ) : myReports.length === 0 ? (
              <View style={styles.stateCard}>
                <View style={styles.emptyHistoryIcon}>
                  <ShieldCheck size={22} color={OASIS.colors.primary} />
                </View>
                <Text style={styles.emptyHistoryTitle}>لا توجد بلاغات سابقة</Text>
                <Text style={styles.stateText}>ستظهر هنا حالة آخر البلاغات التي ترسلها من حسابك.</Text>
              </View>
            ) : (
              <View style={styles.historyList}>
                {myReports.map(report => {
                  const status = report.status || 'pending';
                  const resolved = status === 'resolved';
                  const rejected = status === 'dismissed' || status === 'rejected';
                  return (
                    <View key={report.id} style={styles.reportItem}>
                      <View style={styles.reportItemTop}>
                        <Text style={styles.reportReason} numberOfLines={2}>
                          {String(report.reason || '').split(' - تفاصيل:')[0]}
                        </Text>
                        <View style={[styles.statusChip, resolved && styles.statusChipResolved, rejected && styles.statusChipRejected]}>
                          <Text style={[styles.statusText, resolved && styles.statusTextResolved, rejected && styles.statusTextRejected]}>
                            {REPORT_STATUS_LABELS[status] || status}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.reportDate}>{new Date(report.created_at).toLocaleDateString('ar-SA')}</Text>
                    </View>
                  );
                })}
              </View>
            )}
          </OasisSurface>
        </View>
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
    paddingTop: 14,
  },
  contentWrap: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 16,
    gap: 14,
  },
  introCard: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 13,
    backgroundColor: OASIS.colors.soft,
    borderWidth: 1,
    borderColor: OASIS.colors.line,
    borderRadius: 20,
    padding: 17,
  },
  introIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: OASIS.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  introCopy: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-end',
    gap: 4,
  },
  introEyebrow: {
    color: OASIS.colors.primary,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
  },
  introTitle: {
    color: OASIS.colors.ink,
    fontSize: 17,
    lineHeight: 25,
    fontWeight: '800',
    textAlign: 'right',
  },
  introText: {
    color: OASIS.colors.muted,
    fontSize: 12.5,
    lineHeight: 20,
    textAlign: 'right',
  },
  formCard: {
    width: '100%',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: OASIS.colors.line,
    gap: 14,
  },
  sectionHeading: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionHeadingCopy: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 4,
  },
  sectionTitle: {
    color: OASIS.colors.ink,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'right',
  },
  sectionHint: {
    color: OASIS.colors.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'right',
  },
  stepBadge: {
    minWidth: 48,
    minHeight: 32,
    borderRadius: 11,
    backgroundColor: OASIS.colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 9,
  },
  stepBadgeText: {
    color: OASIS.colors.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  reasonGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
  },
  reasonOption: {
    width: '100%',
    minHeight: 56,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: OASIS.colors.background,
    borderWidth: 1,
    borderColor: OASIS.colors.line,
  },
  reasonOptionWide: {
    width: '48%',
  },
  reasonOptionActive: {
    backgroundColor: OASIS.colors.soft,
    borderColor: OASIS.colors.primary,
    borderWidth: 1.5,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: OASIS.colors.line,
    backgroundColor: OASIS.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {
    borderColor: OASIS.colors.primary,
    backgroundColor: OASIS.colors.primary,
  },
  reasonText: {
    flex: 1,
    minWidth: 0,
    color: OASIS.colors.ink,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    textAlign: 'right',
  },
  reasonTextActive: {
    color: OASIS.colors.primary,
    fontWeight: '700',
  },
  fieldHeading: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  label: {
    color: OASIS.colors.ink,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
  },
  optionalLabel: {
    color: OASIS.colors.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  fieldHint: {
    color: OASIS.colors.muted,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'right',
    marginTop: -8,
  },
  inputContainer: {
    minHeight: 136,
    backgroundColor: OASIS.colors.background,
    borderRadius: 16,
    padding: 13,
    borderWidth: 1,
    borderColor: OASIS.colors.line,
  },
  input: {
    minHeight: 108,
    color: OASIS.colors.ink,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'right',
    textAlignVertical: 'top',
  },
  errorBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 9,
    padding: 12,
    borderRadius: 14,
    backgroundColor: OASIS.colors.dangerSoft,
    borderWidth: 1,
    borderColor: OASIS.colors.danger,
  },
  errorText: {
    flex: 1,
    color: OASIS.colors.danger,
    fontSize: 12.5,
    lineHeight: 19,
    textAlign: 'right',
  },
  submitBtn: {
    minHeight: 52,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  submitBtnBusy: {
    opacity: 0.75,
  },
  submitBtnText: {
    color: OASIS.colors.surface,
    fontSize: 14,
    fontWeight: '800',
  },
  privacyHint: {
    color: OASIS.colors.muted,
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: -4,
  },
  historyCard: {
    width: '100%',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: OASIS.colors.line,
    gap: 12,
  },
  historyHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: OASIS.colors.line,
  },
  historyTitleGroup: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 3,
  },
  historyTitle: {
    color: OASIS.colors.ink,
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'right',
  },
  historySubtitle: {
    color: OASIS.colors.muted,
    fontSize: 11.5,
    textAlign: 'right',
  },
  historyIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: OASIS.colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateCard: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 22,
    paddingHorizontal: 14,
  },
  stateText: {
    color: OASIS.colors.muted,
    fontSize: 12.5,
    lineHeight: 19,
    textAlign: 'center',
  },
  retryButton: {
    minHeight: 44,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: 13,
    backgroundColor: OASIS.colors.soft,
  },
  retryText: {
    color: OASIS.colors.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  loginButton: {
    minHeight: 44,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 13,
  },
  emptyHistoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: OASIS.colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyHistoryTitle: {
    color: OASIS.colors.ink,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
  },
  historyList: {
    gap: 0,
  },
  reportItem: {
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: OASIS.colors.line,
    gap: 7,
  },
  reportItemTop: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 10,
  },
  reportReason: {
    flex: 1,
    minWidth: 0,
    color: OASIS.colors.ink,
    fontSize: 12.5,
    lineHeight: 19,
    fontWeight: '600',
    textAlign: 'right',
  },
  statusChip: {
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: OASIS.colors.background,
    borderWidth: 1,
    borderColor: OASIS.colors.line,
  },
  statusChipResolved: {
    backgroundColor: OASIS.colors.soft,
    borderColor: OASIS.colors.primary,
  },
  statusChipRejected: {
    backgroundColor: OASIS.colors.dangerSoft,
    borderColor: OASIS.colors.danger,
  },
  statusText: {
    color: OASIS.colors.muted,
    fontSize: 10.5,
    fontWeight: '700',
  },
  statusTextResolved: {
    color: OASIS.colors.primary,
  },
  statusTextRejected: {
    color: OASIS.colors.danger,
  },
  reportDate: {
    color: OASIS.colors.muted,
    fontSize: 10.5,
    textAlign: 'right',
  },
});
