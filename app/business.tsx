import { useEffect, useState } from 'react';
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
        supabase.from('business_directory').select('*').eq('id', id).single(),
        supabase
          .from('reviews')
          .select('id, rating, body, created_at, profiles:reviewer_id(display_name, username, avatar_url)')
          .eq('business_id', id)
          .order('created_at', { ascending: false }),
      ]);
      setBusiness(bData.data);
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
        <ActivityIndicator size="large" color="#0891b2" />
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

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header Hero */}
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
            <Text style={styles.navTitle}>دليل المحلات</Text>
            <Pressable
              onPress={() => router.push({ pathname: '/report', params: { type: 'business', id: business.id } })}
              style={styles.iconBtn}
            >
              <Flag size={20} color="#fff" />
            </Pressable>
          </View>

          <View style={styles.heroContent}>
            <View style={styles.ratingBadge}>
              <Star size={14} color="#f59e0b" fill="#f59e0b" />
              <Text style={styles.ratingText}>
                {Number(business.rating || 5.0).toFixed(1)} ({business.review_count || 0} تقييم)
              </Text>
            </View>

            <Text style={styles.heroTitle}>{business.name}</Text>

            <View style={styles.metaRow}>
              <MapPin size={13} color="#fff" />
              <Text style={styles.metaText}>
                {business.city || 'السعودية'}{business.district ? ` · حي ${business.district}` : ''}
              </Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.bodyContainer}>
          {/* Info Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>عن النشاط التجاري</Text>
            <Text style={styles.cardDesc}>
              {business.description || 'نشاط تجاري معتمد يقدم خدماته ومنتجاته لسكان الحي.'}
            </Text>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <Text style={styles.infoVal}>{business.category || 'متجر'}</Text>
              <Text style={styles.infoLabel}>النشاط:</Text>
            </View>

            {business.phone && (
              <View style={styles.infoRow}>
                <Text style={styles.infoVal}>{business.phone}</Text>
                <Text style={styles.infoLabel}>رقم التواصل:</Text>
              </View>
            )}
          </View>

          {/* Add Review Card */}
          <View style={styles.reviewFormCard}>
            <Text style={styles.reviewFormTitle}>أضف تجربتك وتقييمك ⭐</Text>
            <Text style={styles.reviewFormSub}>شارك جيرانك رأيك في جودة وسرعة وأسعار هذا المحل.</Text>

            <Text style={styles.label}>اختر عدد النجوم:</Text>
            <View style={styles.starsRow}>
              {['1', '2', '3', '4', '5'].map(star => (
                <Pressable
                  key={star}
                  style={[styles.starBtn, rating === star && styles.starBtnActive]}
                  onPress={() => setRating(star)}
                >
                  <Star size={16} color={rating === star ? '#f59e0b' : '#94a3b8'} fill={rating === star ? '#f59e0b' : 'none'} />
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

            <Pressable
              style={[styles.sendReviewBtn, submitting && { opacity: 0.6 }]}
              onPress={sendReview}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Send size={16} color="#fff" />
                  <Text style={styles.sendReviewBtnText}>إرسال التقييم</Text>
                </>
              )}
            </Pressable>
          </View>

          {/* Reviews List */}
          <View style={styles.card}>
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
                      <Star size={12} color="#f59e0b" fill="#f59e0b" />
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
          </View>
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
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    color: '#64748b',
    fontSize: 14,
    marginTop: 10,
  },
  errorText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 16,
  },
  backBtnAction: {
    backgroundColor: '#0891b2',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  backBtnActionText: {
    color: '#fff',
    fontWeight: '800',
  },
  hero: {
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
    paddingHorizontal: 20,
    paddingBottom: 28,
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
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
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
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  heroTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
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
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'right',
    marginBottom: 10,
  },
  cardDesc: {
    color: '#334155',
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
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
  },
  infoVal: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '800',
  },
  reviewFormCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  reviewFormTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'right',
    marginBottom: 4,
  },
  reviewFormSub: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'right',
    marginBottom: 14,
  },
  label: {
    color: '#334155',
    fontSize: 12,
    fontWeight: '800',
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
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  starBtnActive: {
    borderColor: '#f59e0b',
    backgroundColor: '#fef3c7',
  },
  starBtnText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },
  starBtnTextActive: {
    color: '#b45309',
    fontWeight: '900',
  },
  reviewInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    height: 80,
    textAlignVertical: 'top',
    color: '#0f172a',
    fontSize: 13,
    textAlign: 'right',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  sendReviewBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0891b2',
    paddingVertical: 12,
    borderRadius: 14,
  },
  sendReviewBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  noReviewsBox: {
    paddingVertical: 20,
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
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '800',
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
    fontWeight: '800',
  },
  reviewBody: {
    color: '#475569',
    fontSize: 12,
    textAlign: 'right',
    lineHeight: 18,
  },
});
