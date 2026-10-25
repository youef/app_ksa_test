import { OasisPressable as Pressable, OasisTextInput as TextInput, OasisSurface } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import { HeaderAction, AppHeader } from '@/components/shared/AppHeader';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View, ActivityIndicator, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { AccountIdentityBadge, AccountVerificationBadge } from '@/components/profile/AccountIdentityBadge';
import { C } from '@/lib/ui';
import {
  ChevronRight,
  MapPin,
  Star,
  Store,
  Phone,
  Clock,
  MessageSquare,
  Send,
  Flag,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function Business() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [business, setBusiness] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [rating, setRating] = useState('5');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      const [bData, rData] = await Promise.all([
        supabase
          .from('businesses')
          .select('*, owner:owner_id(id,display_name,username,avatar_url,role,account_type,freelance_trade,is_verified)')
          .eq('id', id)
          .maybeSingle(),
        supabase
          .from('reviews')
          .select('id, rating, body, created_at, profiles:reviewer_id(display_name, username, avatar_url)')
          .eq('business_id', id)
          .order('created_at', { ascending: false }),
      ]);
      if (bData.error) throw bData.error;
      if (rData.error) throw rData.error;
      setBusiness(bData.data ?? null);
      setReviews(rData.data ?? []);
    } catch (e) {
      console.warn('Load business error', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function sendReview() {
    if (!rating) return Alert.alert('تنبيه', 'يرجى اختيار التقييم.');
    setSubmitting(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return router.push('/auth');

      const r = await supabase.from('reviews').insert({
        reviewer_id: u.user.id,
        business_id: id,
        rating: Number(rating),
        body: body.trim() || null,
      });

      if (r.error) {
        Alert.alert('خطأ', r.error.message);
      } else {
        setBody('');
        Alert.alert('شكراً لك! ⭐', 'تم إضافة تقييمك للمحل بنجاح.');
        load();
      }
    } catch (e: any) {
      Alert.alert('خطأ', e.message || 'تعذر إرسال التقييم');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={OASIS.colors.primary} />
        <Text style={styles.loadingText}>جاري تحميل تفاصيل المحل...</Text>
      </View>
    );
  }

  if (!business) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>المحل التجاري غير موجود.</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtnAction}>
          <Text style={styles.backBtnActionText}>العودة للدليل</Text>
        </Pressable>
      </View>
    );
  }

  const averageRating = reviews.length
    ? reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviews.length
    : 0;

  return (
    <View style={styles.container}>
      <AppHeader
        variant="sub"
        title={business.name || 'دليل المحلات'}
        subtitle={[business.district && `حي ${business.district}`, business.city].filter(Boolean).join(' · ')}
        fallbackRoute="/directory"
        rightAction={
          <HeaderAction
            accessibilityLabel="الإبلاغ عن النشاط" onPress={() => router.push({ pathname: '/report', params: { type: 'business', id: business.id } })}
            style={{
              width: 36,
              height: 36,
              borderRadius: 14,
              backgroundColor: '#f1f5f9',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Flag size={18} color={OASIS.colors.muted} />
          </HeaderAction>
        }
      />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header Hero */}
        <LinearGradient
          colors={[OASIS.colors.deep, OASIS.colors.primary, OASIS.colors.primary]}
          style={styles.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >

          <View style={styles.heroContent}>
            <View style={styles.ratingBadge}>
              <Star size={14} color={OASIS.colors.warning} fill={OASIS.colors.warning} />
              <Text style={styles.ratingText}>
                {reviews.length ? averageRating.toFixed(1) : 'جديد'} ({reviews.length} تقييم)
              </Text>
            </View>

            <Text style={styles.heroTitle}>{business.name}</Text>

            <View style={styles.metaRow}>
              <MapPin size={13} color={OASIS.colors.surface} />
              <Text style={styles.metaText}>
                {business.city || 'السعودية'}{business.district ? ` · حي ${business.district}` : ''}
              </Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.bodyContainer}>
          {/* Info Card */}
          <OasisSurface oasisSurface="card" style={styles.card}>
            <Text style={styles.cardTitle}>عن النشاط التجاري</Text>
            <Text style={styles.cardDesc}>
              {business.description || 'نشاط تجاري معتمد يقدم خدماته ومنتجاته لسكان الحي.'}
            </Text>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <Text style={styles.infoVal}>منشأة محلية</Text>
              <Text style={styles.infoLabel}>النشاط:</Text>
            </View>

            {business.phone && (
              <View style={styles.infoRow}>
                <Text style={styles.infoVal}>{business.phone}</Text>
                <Text style={styles.infoLabel}>رقم التواصل:</Text>
              </View>
            )}
          </OasisSurface>

          {business.owner ? (
            <Pressable oasisKind="card"
              style={styles.ownerCard}
              onPress={() => router.push({ pathname: '/user', params: { id: business.owner.id } })}
            >
              <View style={styles.ownerCopy}>
                <Text style={styles.ownerEyebrow}>مالك النشاط</Text>
                <Text style={styles.ownerName}>
                  {business.owner.account_type === 'merchant' && business.owner.freelance_trade
                    ? business.owner.freelance_trade
                    : business.owner.display_name || business.owner.username}
                </Text>
                <View style={styles.ownerBadges}>
                  <AccountIdentityBadge role={business.owner.role} accountType={business.owner.account_type} isVerified={Boolean(business.owner.is_verified)} compact />
                  <AccountVerificationBadge role={business.owner.role} accountType={business.owner.account_type} isVerified={Boolean(business.owner.is_verified)} compact />
                </View>
              </View>
              <ChevronRight size={18} color="#94A3B8" />
            </Pressable>
          ) : null}

          {/* Add Review Card */}
          <OasisSurface oasisSurface="card" style={styles.reviewFormCard}>
            <Text style={styles.reviewFormTitle}>أضف تجربتك وتقييمك ⭐</Text>
            <Text style={styles.reviewFormSub}>شارك جيرانك رأيك في جودة وسرعة وأسعار هذا المحل.</Text>

            <Text style={styles.label}>اختر عدد النجوم:</Text>
            <View style={styles.starsRow}>
              {['1', '2', '3', '4', '5'].map(star => (
                <Pressable oasisKind="action"
                  key={star}
                  style={[styles.starBtn, rating === star && styles.starBtnActive]}
                  onPress={() => setRating(star)}
                >
                  <Star size={16} color={rating === star ? OASIS.colors.warning : '#94a3b8'} fill={rating === star ? OASIS.colors.warning : 'none'} />
                  <Text style={[styles.starBtnText, rating === star && styles.starBtnTextActive]}>{star}</Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              style={styles.reviewInput}
              value={body}
              onChangeText={setBody}
              placeholder="اكتب تفاصيل تجربتك (اختياري)..."
              placeholderTextColor="#9ca3af"
              multiline
            />

            <Pressable oasisKind="action"
              style={[styles.sendReviewBtn, submitting && { opacity: 0.6 }]}
              onPress={sendReview}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={OASIS.colors.surface} />
              ) : (
                <>
                  <Send size={16} color={OASIS.colors.surface} />
                  <Text style={styles.sendReviewBtnText}>إرسال التقييم</Text>
                </>
              )}
            </Pressable>
          </OasisSurface>

          {/* Reviews List */}
          <OasisSurface oasisSurface="card" style={styles.card}>
            <Text style={styles.cardTitle}>تقييمات الجيران ({reviews.length})</Text>

            {reviews.length === 0 ? (
              <View style={styles.noReviewsBox}>
                <Text style={styles.noReviewsText}>لا توجد تقييمات بعد. كن أول من يقيّم هذا المحل!</Text>
              </View>
            ) : (
              reviews.map(r => (
                <View key={r.id} style={styles.reviewItem}>
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewStarBadge}>
                      <Star size={12} color={OASIS.colors.warning} fill={OASIS.colors.warning} />
                      <Text style={styles.reviewStarText}>{r.rating}</Text>
                    </View>
                    <Text style={styles.reviewerName}>
                      {r.profiles?.display_name || `@${r.profiles?.username || 'جار'}`}
                    </Text>
                  </View>
                  {r.body && <Text style={styles.reviewBody}>{r.body}</Text>}
                </View>
              ))
            )}
          </OasisSurface>
        </View>

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
    paddingBottom: 24,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    backgroundColor: OASIS.colors.background,
  },
  loadingText: {
    color: OASIS.colors.muted,
    fontSize: 14,
    marginTop: 10,
  },
  errorText: {
    color: OASIS.colors.ink,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  backBtnAction: {
    backgroundColor: '#0891b2',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  backBtnActionText: {
    color: OASIS.colors.surface,
    fontWeight: '600',
  },
  hero: {
    paddingTop: 18,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  navBar: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconBtn: {
    padding: 6,
  },
  navTitle: {
    color: OASIS.colors.surface,
    fontSize: 18,
    fontWeight: '700',
  },
  heroContent: {
    alignItems: 'flex-end',
  },
  ratingBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginBottom: 8,
  },
  ratingText: {
    color: OASIS.colors.surface,
    fontSize: 12,
    fontWeight: '600',
  },
  heroTitle: {
    color: OASIS.colors.surface,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'right',
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '700',
  },
  bodyContainer: {
    padding: 18,
    marginTop: -10,
  },
  card: {
    backgroundColor: OASIS.colors.surface,
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0,
    shadowRadius: 6,
    elevation: 2,
  },
  ownerCard: {
    backgroundColor: OASIS.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: OASIS.colors.line,
    padding: 13,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  ownerCopy: { flex: 1, alignItems: 'flex-end', gap: 3 },
  ownerEyebrow: { color: '#94a3b8', fontSize: 11, fontWeight: '700' },
  ownerName: { color: OASIS.colors.ink, fontSize: 13, fontWeight: '700', textAlign: 'right' },
  ownerBadges: { flexDirection: 'row-reverse', gap: 4, flexWrap: 'wrap', marginTop: 3 },
  cardTitle: {
    color: OASIS.colors.ink,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'right',
    marginBottom: 10,
  },
  cardDesc: {
    color: OASIS.colors.ink,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 14,
  },
  infoRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  infoLabel: {
    color: OASIS.colors.muted,
    fontSize: 13,
    fontWeight: '700',
  },
  infoVal: {
    color: OASIS.colors.ink,
    fontSize: 13,
    fontWeight: '600',
  },
  reviewFormCard: {
    backgroundColor: OASIS.colors.surface,
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: OASIS.colors.line,
  },
  reviewFormTitle: {
    color: OASIS.colors.ink,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'right',
    marginBottom: 4,
  },
  reviewFormSub: {
    color: OASIS.colors.muted,
    fontSize: 12,
    textAlign: 'right',
    marginBottom: 14,
  },
  label: {
    color: OASIS.colors.ink,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
    marginBottom: 8,
  },
  starsRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginBottom: 12,
  },
  starBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: OASIS.colors.background,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: OASIS.colors.line,
  },
  starBtnActive: {
    borderColor: OASIS.colors.warning,
    backgroundColor: '#fef3c7',
  },
  starBtnText: {
    color: OASIS.colors.muted,
    fontSize: 12,
    fontWeight: '700',
  },
  starBtnTextActive: {
    color: '#b45309',
    fontWeight: '700',
  },
  reviewInput: {
    backgroundColor: OASIS.colors.background,
    borderRadius: 12,
    padding: 12,
    height: 80,
    textAlignVertical: 'top',
    color: OASIS.colors.ink,
    fontSize: 13,
    textAlign: 'right',
    borderWidth: 1,
    borderColor: OASIS.colors.line,
    marginBottom: 12,
  },
  sendReviewBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: OASIS.colors.primary,
    paddingVertical: 12,
    borderRadius: 14,
  },
  sendReviewBtnText: {
    color: OASIS.colors.surface,
    fontSize: 14,
    fontWeight: '600',
  },
  noReviewsBox: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  noReviewsText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  reviewItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
  },
  reviewHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  reviewerName: {
    color: OASIS.colors.ink,
    fontSize: 13,
    fontWeight: '600',
  },
  reviewStarBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  reviewStarText: {
    color: '#b45309',
    fontSize: 11,
    fontWeight: '600',
  },
  reviewBody: {
    color: OASIS.colors.muted,
    fontSize: 12,
    textAlign: 'right',
    lineHeight: 18,
  },
});
