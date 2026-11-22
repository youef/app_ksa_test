import { OasisPressable as Pressable, OasisTextInput as TextInput, OasisSurface } from '@/components/oasis/OasisPrimitives';
import { useTheme, type OasisColors } from '@/lib/oasis';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppHeader } from '@/components/shared/AppHeader';
import { useBottomNavInset } from '@/lib/bottomNav';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { Star, HeartHandshake, Lightbulb, ShieldCheck, Send, CheckCircle2, MessageSquareText, Sparkles, RefreshCw } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

const REASONS = ['سهولة الاستخدام','الخدمات المحلية','مجتمع الحي','الأداء والسرعة','أحتاج تحسينات'];
const REVIEW_LIMIT = 1500;

const ratingMeta = (rating: number, colors: OasisColors) => {
  if (rating === 5) return { title: 'تجربة ممتازة!', subtitle: 'يسعدنا أن حيّنا نال إعجابك.', color: colors.primary };
  if (rating === 4) return { title: 'تجربة جميلة', subtitle: 'اقتربنا من توقعاتك، أخبرنا كيف نتحسن.', color: colors.deep };
  if (rating === 3) return { title: 'تجربة مقبولة', subtitle: 'ملاحظاتك تساعدنا على التطوير.', color: colors.warning };
  if (rating === 2) return { title: 'هناك ما يحتاج للتحسين', subtitle: 'شاركنا ما واجهته حتى نصلحه.', color: colors.info };
  return { title: 'نريد أن نسمعك', subtitle: 'أخبرنا بما لم يعمل كما توقعت.', color: colors.danger };
};

export default function RateAppScreen() {
  const bottomNavInset = useBottomNavInset(20);
  const safeAreaInsets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createStyles(colors, isDark), [colors, isDark]);
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState('');
  const [reasons, setReasons] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [hasReview, setHasReview] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!auth.user) {
        setUserId(null);
        setHasReview(false);
        setRating(5);
        setBody('');
        setReasons([]);
        return;
      }
      setUserId(auth.user.id);
      const { data, error } = await supabase.from('app_reviews').select('rating,body').eq('user_id', auth.user.id).maybeSingle();
      if (error) throw error;
      if (data) {
        setHasReview(true);
        setRating(Math.max(1, Math.min(5, Number(data.rating) || 5)));
        setBody(data.body || '');
        setReasons([]);
      } else {
        setHasReview(false);
        setRating(5);
        setBody('');
        setReasons([]);
      }
    } catch {
      setLoadError(true);
      setUserId(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const submit = async () => {
    if (!userId) { router.push('/auth'); return; }
    setSaving(true);
    try {
      const cleanBody = body.trim();
      const fullBody = [reasons.length ? 'محاور التقييم: ' + reasons.join('، ') : '', cleanBody].filter(Boolean).join('\n\n');
      const { error } = await supabase.from('app_reviews').upsert({ user_id: userId, rating, body: fullBody || null, published: true }, { onConflict: 'user_id' });
      if (error) throw error;
      setHasReview(true);
      Alert.alert('شكرًا لمشاركتك', 'تم حفظ تقييمك وملاحظاتك. نستخدمها لتحسين تجربة حيّنا.');
    } catch (e) {
      Alert.alert('تعذر حفظ التقييم', e instanceof Error ? e.message : 'حاول مرة أخرى.');
    } finally {
      setSaving(false);
    }
  };

  const meta = ratingMeta(rating, colors);
  const actionTextColor = isDark ? colors.background : '#FFFFFF';

  return (
    <View style={styles.screen}>
      <AppHeader variant="sub" title="قيّم تجربتك" subtitle="صوتك يساعدنا على التطوير" fallbackRoute="/more" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(bottomNavInset + 16, safeAreaInsets.bottom + 92) }]}
      >
        <LinearGradient colors={[colors.live, colors.deep]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View style={styles.heroTop}>
            <View style={styles.heroIcon} accessible={false}><HeartHandshake size={26} color="#E8F5EF" /></View>
            <View style={styles.heroPill}><Sparkles size={12} color="#E8F5EF" /><Text style={styles.heroPillText}>صوتك يصنع الفرق</Text></View>
          </View>
          <Text style={styles.heroTitle} accessibilityRole="header">كيف كانت تجربتك مع حيّنا؟</Text>
          <Text style={styles.heroDesc}>كل تقييم يساعدنا على تحسين الخدمات وتجربة الجيران في مجتمعهم المحلي.</Text>
          <View style={styles.heroFoot}><ShieldCheck size={14} color="#D7EDE3" /><Text style={styles.heroFootText}>نستخدم ملاحظاتك لتطوير المنصة باستمرار.</Text></View>
        </LinearGradient>

        {loading ? (
          <View style={styles.loading} accessibilityRole="progressbar" accessibilityLabel="جارٍ تحميل تقييمك">
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>جارٍ تحميل تقييمك...</Text>
          </View>
        ) : loadError ? (
          <OasisSurface oasisSurface="card" style={styles.recoveryCard}>
            <View style={styles.recoveryIcon}><RefreshCw size={22} color={colors.primary} /></View>
            <Text style={styles.errorTitle} accessibilityRole="header">تعذّر تحميل تقييمك السابق</Text>
            <Text style={styles.errorText}>تحقق من اتصالك بالإنترنت ثم حاول مرة أخرى.</Text>
            <Pressable oasisKind="action" oasisVariant="secondary" onPress={() => void load()} style={styles.retryButton} accessibilityRole="button" accessibilityLabel="إعادة تحميل التقييم">
              <RefreshCw size={15} color={colors.primary} />
              <Text style={styles.retryText}>إعادة المحاولة</Text>
            </Pressable>
          </OasisSurface>
        ) : !userId ? (
          <OasisSurface oasisSurface="card" style={styles.loginCard}>
            <View style={styles.loginIcon}><MessageSquareText size={24} color={colors.primary} /></View>
            <Text style={styles.cardTitle} accessibilityRole="header">سجّل الدخول لتقييم تجربتك</Text>
            <Text style={styles.cardSub}>يمكنك حفظ تقييمك ومتابعة تحديثه من حسابك.</Text>
            <Pressable oasisKind="plain" onPress={() => router.push('/auth')} style={styles.loginButton} accessibilityRole="button" accessibilityLabel="تسجيل الدخول لتقييم حيّنا">
              <Text style={[styles.submitText, { color: actionTextColor }]}>تسجيل الدخول</Text>
              <Send size={15} color={actionTextColor} />
            </Pressable>
          </OasisSurface>
        ) : (
          <>
            {hasReview && (
              <View style={styles.savedBanner} accessibilityRole="text">
                <CheckCircle2 size={17} color={colors.primary} />
                <Text style={styles.savedText}>لديك تقييم سابق — يمكنك تحديثه وإرسال ملاحظات جديدة.</Text>
              </View>
            )}
            <OasisSurface oasisSurface="card" style={styles.ratingCard}>
              <View style={styles.cardEyebrow}><Star size={15} color={colors.warning} /><Text style={styles.eyebrowText}>تقييمك العام</Text></View>
              <Text style={styles.cardTitle} accessibilityRole="header">اختر عدد النجوم</Text>
              <View style={styles.starsRow}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable
                    oasisKind="icon"
                    key={n}
                    onPress={() => setRating(n)}
                    accessibilityRole="button"
                    accessibilityLabel={'تقييم ' + n + ' من 5'}
                    accessibilityState={{ selected: n === rating }}
                    accessibilityHint="تحديد هذا التقييم"
                    style={styles.starButton}
                  >
                    <Star size={28} color={n <= rating ? colors.warning : colors.line} fill={n <= rating ? colors.warning : 'transparent'} />
                  </Pressable>
                ))}
              </View>
              <Text style={[styles.ratingTitle, { color: meta.color }]}>{meta.title}</Text>
              <Text style={styles.ratingSub}>{meta.subtitle}</Text>
              <View style={styles.score}>
                <Text style={styles.scoreValue}>{rating}</Text>
                <Text style={styles.scoreOutOf}>/ 5</Text>
                <View style={styles.scoreStars} accessibilityElementsHidden>
                  {[1, 2, 3, 4, 5].map((n) => <View key={n} style={[styles.scoreDot, n <= rating && styles.scoreDotActive]} />)}
                </View>
              </View>
            </OasisSurface>

            <OasisSurface oasisSurface="card" style={styles.feedbackCard}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionIcon}><Lightbulb size={18} color={colors.primary} /></View>
                <View style={styles.sectionCopy}>
                  <Text style={styles.cardTitle} accessibilityRole="header">ما الذي نركز عليه؟</Text>
                  <Text style={styles.cardSub}>اختر كل ما ينطبق (اختياري).</Text>
                </View>
              </View>
              <View style={styles.reasonGrid}>
                {REASONS.map((reason) => {
                  const selected = reasons.includes(reason);
                  return (
                    <Pressable
                      oasisKind="plain"
                      key={reason}
                      onPress={() => setReasons((prev) => selected ? prev.filter((r) => r !== reason) : [...prev, reason])}
                      accessibilityRole="checkbox"
                      accessibilityLabel={reason}
                      accessibilityState={{ checked: selected }}
                      accessibilityHint="اختيار أو إلغاء هذا المحور"
                      style={[styles.reasonChip, selected && styles.reasonChipActive]}
                    >
                      <Text style={[styles.reasonText, selected && styles.reasonTextActive]}>{reason}</Text>
                      {selected ? <CheckCircle2 size={15} color={colors.primary} /> : null}
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.messageGroup}>
                <Text style={styles.fieldLabel}>ملاحظاتك واقتراحاتك</Text>
                <TextInput
                  value={body}
                  onChangeText={setBody}
                  maxLength={REVIEW_LIMIT}
                  placeholder="ما الذي أعجبك؟ وما الذي تتمنى تحسينه؟"
                  multiline
                  style={styles.textArea}
                  textAlign="right"
                  textAlignVertical="top"
                  accessibilityLabel="ملاحظاتك واقتراحاتك"
                  accessibilityHint="حقل اختياري متعدد الأسطر، حتى 1500 حرف"
                />
                <View style={styles.counterRow}>
                  <Text style={styles.charCount} accessibilityLiveRegion="polite">{body.length} / {REVIEW_LIMIT} حرف</Text>
                  <Text style={styles.counterHint}>مشاركة التفاصيل اختيارية</Text>
                </View>
              </View>
            </OasisSurface>

            <Pressable
              oasisKind="plain"
              disabled={saving}
              onPress={() => void submit()}
              style={[styles.submitButton, saving && styles.submitButtonBusy]}
              accessibilityRole="button"
              accessibilityLabel={saving ? 'جارٍ حفظ التقييم' : hasReview ? 'تحديث التقييم' : 'إرسال التقييم'}
              accessibilityState={{ disabled: saving, busy: saving }}
              accessibilityHint="حفظ تقييمك وملاحظاتك"
            >
              {saving ? <ActivityIndicator color={actionTextColor} /> : <><Text style={[styles.submitText, { color: actionTextColor }]}>{hasReview ? 'تحديث التقييم' : 'إرسال التقييم'}</Text><Send size={15} color={actionTextColor} /></>}
            </Pressable>
            <Text style={styles.footnote}>يُحفظ تقييم واحد لكل حساب، ويمكنك تعديله لاحقًا.</Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function createStyles(colors: OasisColors, isDark: boolean) {
  const actionText = isDark ? colors.background : '#FFFFFF';
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: 'transparent' },
    content: { width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 12, gap: 14 },
    hero: { borderRadius: 20, padding: 18, gap: 12 },
    heroTop: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
    heroIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
    heroPill: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 14 },
    heroPillText: { fontSize: 12, fontWeight: '700', color: '#E8F5EF' },
    heroTitle: { fontSize: 21, lineHeight: 30, fontWeight: '800', color: '#F4FBF7', textAlign: 'right' },
    heroDesc: { fontSize: 13, lineHeight: 21, color: '#E8F5EF', textAlign: 'right' },
    heroFoot: { flexDirection: 'row-reverse', alignItems: 'center', gap: 7, marginTop: 3 },
    heroFootText: { fontSize: 12, lineHeight: 18, color: '#D7EDE3', fontWeight: '600', textAlign: 'right' },
    loading: { minHeight: 132, paddingVertical: 26, alignItems: 'center', justifyContent: 'center', gap: 10 },
    loadingText: { fontSize: 13, color: colors.muted },
    recoveryCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 20, padding: 18, alignItems: 'center', gap: 10 },
    recoveryIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' },
    errorTitle: { fontSize: 15, lineHeight: 22, fontWeight: '800', color: colors.ink, textAlign: 'center' },
    errorText: { fontSize: 13, lineHeight: 20, color: colors.muted, textAlign: 'center' },
    retryButton: { minHeight: 44, paddingHorizontal: 14, flexDirection: 'row-reverse', gap: 7, borderRadius: 12, marginTop: 3 },
    retryText: { fontSize: 13, fontWeight: '700', color: colors.primary },
    savedBanner: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, minHeight: 48, padding: 12, borderRadius: 14, backgroundColor: colors.soft, borderWidth: 1, borderColor: colors.line },
    savedText: { flex: 1, fontSize: 12, lineHeight: 18, color: colors.deep, fontWeight: '600', textAlign: 'right' },
    ratingCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 20, padding: 16, alignItems: 'center', gap: 10 },
    cardEyebrow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, alignSelf: 'flex-end' },
    eyebrowText: { fontSize: 12, lineHeight: 18, fontWeight: '700', color: colors.warning },
    cardTitle: { fontSize: 15, lineHeight: 22, fontWeight: '800', color: colors.ink, textAlign: 'right' },
    starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 7, marginTop: 3, marginBottom: 2 },
    starButton: { minWidth: 44, minHeight: 44, padding: 4 },
    ratingTitle: { fontSize: 16, lineHeight: 23, fontWeight: '800', textAlign: 'center' },
    ratingSub: { fontSize: 12.5, lineHeight: 19, color: colors.muted, textAlign: 'center' },
    score: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, minHeight: 36, backgroundColor: colors.warningSoft, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, marginTop: 3 },
    scoreValue: { fontSize: 17, fontWeight: '800', color: colors.warning, fontVariant: ['tabular-nums'] },
    scoreOutOf: { fontSize: 12, color: colors.warning, fontWeight: '700' },
    scoreStars: { flexDirection: 'row', gap: 3, marginRight: 5 },
    scoreDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.line },
    scoreDotActive: { backgroundColor: colors.warning },
    feedbackCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 20, padding: 16, gap: 14 },
    sectionHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
    sectionIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' },
    sectionCopy: { flex: 1, minWidth: 0, alignItems: 'flex-end', gap: 3 },
    cardSub: { fontSize: 12, lineHeight: 18, color: colors.muted, textAlign: 'right' },
    reasonGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
    reasonChip: { minHeight: 44, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.background, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12 },
    reasonChipActive: { backgroundColor: colors.soft, borderColor: colors.primary },
    reasonText: { fontSize: 12, lineHeight: 18, fontWeight: '600', color: colors.muted },
    reasonTextActive: { color: colors.primary },
    messageGroup: { gap: 8 },
    fieldLabel: { fontSize: 13, lineHeight: 19, fontWeight: '800', color: colors.ink, textAlign: 'right' },
    textArea: { minHeight: 124, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.background, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 12, fontSize: 14, lineHeight: 21, color: colors.ink },
    counterRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    charCount: { fontSize: 12, lineHeight: 18, color: colors.muted, textAlign: 'left', fontVariant: ['tabular-nums'] },
    counterHint: { fontSize: 12, lineHeight: 18, color: colors.muted, textAlign: 'right' },
    submitButton: { minHeight: 52, borderRadius: 15, backgroundColor: colors.primary, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
    submitButtonBusy: { opacity: 0.72 },
    submitText: { fontSize: 14, lineHeight: 20, fontWeight: '800', color: actionText },
    footnote: { fontSize: 12, lineHeight: 18, color: colors.muted, textAlign: 'center' },
    loginCard: { backgroundColor: colors.surface, borderRadius: 20, padding: 18, alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.line },
    loginIcon: { width: 52, height: 52, borderRadius: 17, backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' },
    loginButton: { minHeight: 48, width: '100%', borderRadius: 14, backgroundColor: colors.primary, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
  });
}
