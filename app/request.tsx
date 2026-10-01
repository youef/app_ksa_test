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
  Image,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/ui';
import {
  ChevronRight,
  MapPin,
  HeartHandshake,
  AlertCircle,
  Banknote,
  CheckCircle2,
  Trash2,
  Flag,
  User,
  MessageSquare,
  Clock,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function Request() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [request, setRequest] = useState<any>(null);
  const [requester, setRequester] = useState<any>(null);
  const [offers, setOffers] = useState<any[]>([]);
  const [message, setMessage] = useState('');
  const [me, setMe] = useState('');
  const [loading, setLoading] = useState(true);
  const [submittingOffer, setSubmittingOffer] = useState(false);

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      setMe(u.user?.id || '');

      const [rData, oData] = await Promise.all([
        supabase.from('requests').select('*').eq('id', id).single(),
        supabase
          .from('help_matches')
          .select('id, helper_id, message, status, created_at, profiles:helper_id(id, display_name, username, avatar_url, is_verified, district)')
          .eq('request_id', id)
          .order('created_at', { ascending: false }),
      ]);

      if (rData.data) {
        setRequest(rData.data);
        if (rData.data.requester_id) {
          const { data: p } = await supabase
            .from('profiles')
            .select('id, display_name, username, avatar_url, is_verified, is_geoverified, city, district')
            .eq('id', rData.data.requester_id)
            .single();
          setRequester(p);
        }
      }
      setOffers(oData.data ?? []);
    } catch (e) {
      console.warn('Load request error', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function sendOffer() {
    if (!me) return router.push('/auth');
    if (me === request?.requester_id) return Alert.alert('تنبيه', 'أنت صاحب هذا الطلب.');

    setSubmittingOffer(true);
    try {
      const r = await supabase.from('help_matches').insert({
        request_id: id,
        helper_id: me,
        message: message.trim() || 'أقدر أساعدك في هذا الطلب 🤝',
        status: 'proposed',
      });

      if (r.error) {
        Alert.alert('خطأ', r.error.message);
      } else {
        setMessage('');
        Alert.alert('تم إرسال عرضك بنجاح! 🤝', 'تم إشعار صاحب الطلب، وبإمكانه قبول عرضك لبدء المحادثة.');
        load();
      }
    } catch (e: any) {
      Alert.alert('خطأ', e.message || 'تعذر إرسال العرض');
    } finally {
      setSubmittingOffer(false);
    }
  }

  async function acceptOffer(match: any) {
    if (me !== request?.requester_id) return;

    try {
      await supabase.from('requests').update({ accepted_by: match.helper_id, status: 'accepted' }).eq('id', id);
      await supabase.from('help_matches').update({ status: 'accepted' }).eq('id', match.id);

      // Create or find conversation
      const { data: conv } = await supabase
        .from('conversations')
        .insert({ is_group: false, request_id: id })
        .select('id')
        .single();

      if (conv) {
        await supabase.from('conversation_members').insert([
          { conversation_id: conv.id, user_id: me },
          { conversation_id: conv.id, user_id: match.helper_id },
        ]);

        await supabase.from('messages').insert({
          conversation_id: conv.id,
          sender_id: me,
          content: `تم قبول عرض مساعدتك بخصوص طلب: «${request.title}». شكراً لك وجزاك الله خيراً!`,
        });

        Alert.alert('تم قبول العرض! 🎉', 'تم فتح المحادثة الخاصة للاتفاق على التفاصيل.');
        router.push({ pathname: '/conversation', params: { id: conv.id } });
      } else {
        router.push('/messages');
      }
      load();
    } catch (e) {
      router.push('/messages');
    }
  }

  async function deleteRequest() {
    if (me !== request?.requester_id) return;
    Alert.alert('تأكيد الحذف', 'هل أنت متأكد من حذف هذا الطلب؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          const r = await supabase.from('requests').delete().eq('id', id);
          if (r.error) Alert.alert('خطأ', r.error.message);
          else {
            Alert.alert('تم', 'تم حذف الطلب.');
            router.back();
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#059669" />
        <Text style={styles.loadingText}>جاري تحميل تفاصيل الطلب...</Text>
      </View>
    );
  }

  if (!request) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>الطلب غير موجود أو تم إغلاقه.</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtnAction}>
          <Text style={styles.backBtnActionText}>العودة للطلبات</Text>
        </Pressable>
      </View>
    );
  }

  const isOwner = me === request.requester_id;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header Hero */}
        <LinearGradient
          colors={['#065f46', '#059669', '#10b981']}
          style={styles.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.navBar}>
            <Pressable onPress={() => router.back()} style={styles.iconBtn}>
              <ChevronRight size={28} color="#fff" />
            </Pressable>
            <Text style={styles.navTitle}>تفاصيل طلب الفزعة</Text>
            <Pressable
              onPress={() => router.push({ pathname: '/report', params: { type: 'request', id: request.id } })}
              style={styles.iconBtn}
            >
              <Flag size={20} color="#fff" />
            </Pressable>
          </View>

          <View style={styles.heroContent}>
            <View style={styles.heroBadgeRow}>
              {request.is_urgent && (
                <View style={styles.urgentBadge}>
                  <AlertCircle size={12} color="#dc2626" />
                  <Text style={styles.urgentBadgeText}>عاجل</Text>
                </View>
              )}
              {request.status === 'accepted' ? (
                <View style={styles.acceptedBadge}>
                  <CheckCircle2 size={12} color="#15803d" />
                  <Text style={styles.acceptedBadgeText}>تم قبول مساعدة</Text>
                </View>
              ) : (
                <View style={styles.openBadge}>
                  <Text style={styles.openBadgeText}>مفتوح للمساعدة</Text>
                </View>
              )}
            </View>

            <Text style={styles.heroTitle}>{request.title}</Text>

            <View style={styles.metaRow}>
              <MapPin size={13} color="#fff" />
              <Text style={styles.metaText}>
                {request.city || 'السعودية'}{request.district ? ` · حي ${request.district}` : ''}
              </Text>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.bodyContainer}>
          {/* Requester Profile Card */}
          {requester && (
            <Pressable
              style={styles.requesterCard}
              onPress={() => router.push({ pathname: '/user', params: { id: requester.id } })}
            >
              <View style={{ alignItems: 'flex-end', flex: 1 }}>
                <Text style={styles.requesterName}>
                  {requester.display_name || `@${requester.username || 'صاحب الطلب'}`}
                </Text>
                <Text style={styles.requesterSub}>
                  {requester.district ? `ساكن في حي ${requester.district}` : 'صاحب الطلب في حيّنا'}
                </Text>
              </View>

              {requester.avatar_url ? (
                <Image source={{ uri: requester.avatar_url }} style={styles.requesterAvatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <User size={22} color="#0891b2" />
                </View>
              )}
            </Pressable>
          )}

          {/* Description Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>تفاصيل الطلب والمطلوب</Text>
            <Text style={styles.cardDesc}>{request.description}</Text>

            {request.budget && (
              <View style={styles.budgetBox}>
                <Banknote size={18} color="#15803d" />
                <Text style={styles.budgetValue}>الميزانية المقترحة / المكافأة: {request.budget} ر.س</Text>
              </View>
            )}
          </View>

          {/* Offers Section */}
          <View style={styles.card}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>عروض المساعدة المقدمة ({offers.length})</Text>
              <HeartHandshake size={20} color="#0891b2" />
            </View>

            {offers.length === 0 ? (
              <View style={styles.noOffersBox}>
                <Text style={styles.noOffersText}>لا توجد عروض مساعدة بعد. كن أول من يفزع!</Text>
              </View>
            ) : (
              offers.map(o => (
                <View key={o.id} style={styles.offerItem}>
                  <View style={styles.offerHeader}>
                    <View style={styles.offerStatusBadge}>
                      <Text style={styles.offerStatusText}>
                        {o.status === 'accepted' ? 'تم القبول ✓' : 'عرض جديد'}
                      </Text>
                    </View>
                    <Text style={styles.offerHelperName}>
                      {o.profiles?.display_name || `@${o.profiles?.username || 'فاعل خير'}`}
                    </Text>
                  </View>

                  <Text style={styles.offerMessage}>{o.message}</Text>

                  {isOwner && o.status === 'proposed' && (
                    <Pressable style={styles.acceptBtn} onPress={() => acceptOffer(o)}>
                      <CheckCircle2 size={16} color="#fff" />
                      <Text style={styles.acceptBtnText}>قبول العرض وفتح المحادثة 💬</Text>
                    </Pressable>
                  )}
                </View>
              ))
            )}
          </View>

          {/* Help Form (For non-owners if request is open) */}
          {!isOwner && request.status === 'open' && (
            <View style={styles.offerFormCard}>
              <Text style={styles.offerFormTitle}>تقديم فزعة ومساعدة 🤝</Text>
              <Text style={styles.offerFormSub}>اكتب رسالة سريعة لصاحب الطلب لتخبره كيف تقدر تساعده.</Text>

              <TextInput
                style={styles.offerInput}
                value={message}
                onChangeText={setMessage}
                placeholder="مثال: أقدر أساعدك الليلة أو في طريقي للحي..."
                placeholderTextColor="#9ca3af"
              />

              <Pressable
                style={[styles.sendOfferBtn, submittingOffer && { opacity: 0.6 }]}
                onPress={sendOffer}
                disabled={submittingOffer}
              >
                {submittingOffer ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <HeartHandshake size={18} color="#fff" />
                    <Text style={styles.sendOfferBtnText}>إرسال عرض المساعدة</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}

          {/* Owner Delete Button */}
          {isOwner && (
            <Pressable style={styles.deleteBtn} onPress={deleteRequest}>
              <Trash2 size={18} color="#ef4444" />
              <Text style={styles.deleteBtnText}>إلغاء وحذف هذا الطلب</Text>
            </Pressable>
          )}
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
  heroBadgeRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginBottom: 8,
  },
  urgentBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  urgentBadgeText: {
    color: '#dc2626',
    fontSize: 11,
    fontWeight: '800',
  },
  openBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  openBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  acceptedBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  acceptedBadgeText: {
    color: '#15803d',
    fontSize: 11,
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
  requesterCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  requesterAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ecfeff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  requesterName: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
  },
  requesterSub: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
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
  budgetBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0fdf4',
    padding: 12,
    borderRadius: 12,
    marginTop: 14,
  },
  budgetValue: {
    color: '#15803d',
    fontSize: 13,
    fontWeight: '800',
  },
  sectionHeaderRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
    paddingBottom: 10,
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
  },
  noOffersBox: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  noOffersText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  offerItem: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  offerHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  offerHelperName: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
  },
  offerStatusBadge: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  offerStatusText: {
    color: '#0284c7',
    fontSize: 11,
    fontWeight: '800',
  },
  offerMessage: {
    color: '#475569',
    fontSize: 13,
    textAlign: 'right',
    lineHeight: 18,
    marginBottom: 10,
  },
  acceptBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#15803d',
    paddingVertical: 8,
    borderRadius: 10,
  },
  acceptBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  offerFormCard: {
    backgroundColor: '#ecfdf5',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  offerFormTitle: {
    color: '#065f46',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'right',
    marginBottom: 4,
  },
  offerFormSub: {
    color: '#059669',
    fontSize: 12,
    textAlign: 'right',
    marginBottom: 12,
  },
  offerInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#0f172a',
    fontSize: 13,
    textAlign: 'right',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  sendOfferBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 14,
  },
  sendOfferBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
  deleteBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#fca5a5',
    paddingVertical: 14,
    borderRadius: 16,
  },
  deleteBtnText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '800',
  },
});
