import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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
  MessageSquare,
  ShieldCheck,
  CheckCircle2,
  Trash2,
  Flag,
  User,
  Share2,
  Tag,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function Service() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [service, setService] = useState<any>(null);
  const [provider, setProvider] = useState<any>(null);
  const [me, setMe] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [contacting, setContacting] = useState(false);

  useEffect(() => {
    async function load() {
      if (!id) return;
      setLoading(true);
      try {
        const { data: u } = await supabase.auth.getUser();
        setMe(u.user?.id || null);

        const { data: s } = await supabase.from('services').select('*').eq('id', id).single();
        if (s) {
          setService(s);
          if (s.provider_id) {
            const { data: p } = await supabase
              .from('profiles')
              .select('id, display_name, username, avatar_url, is_verified, is_geoverified, city, district')
              .eq('id', s.provider_id)
              .single();
            setProvider(p);
          }
        }
      } catch (e) {
        console.warn('Error loading service', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function remove() {
    if (!me || me !== service?.provider_id) {
      return Alert.alert('تنبيه', 'يمكن لمالك الخدمة فقط حذفها.');
    }
    Alert.alert('تأكيد الحذف', 'هل أنت متأكد من حذف هذه الخدمة نهائياً؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          const r = await supabase.from('services').delete().eq('id', id);
          if (r.error) Alert.alert('خطأ', r.error.message);
          else {
            Alert.alert('تم', 'تم حذف الخدمة بنجاح.');
            router.back();
          }
        },
      },
    ]);
  }

  async function contactProvider() {
    if (!me) {
      return router.push('/auth');
    }
    if (me === service?.provider_id) {
      return Alert.alert('تنبيه', 'أنت صاحب هذه الخدمة.');
    }

    setContacting(true);
    try {
      // Find or create conversation
      const { data: conv, error } = await supabase
        .from('conversations')
        .insert({ is_group: false })
        .select('id')
        .single();

      if (!error && conv) {
        await supabase.from('conversation_members').insert([
          { conversation_id: conv.id, user_id: me },
          { conversation_id: conv.id, user_id: service.provider_id },
        ]);

        // Send greeting message
        await supabase.from('messages').insert({
          conversation_id: conv.id,
          sender_id: me,
          content: `مرحباً! استفسر بخصوص خدمتك «${service.name}» المنشورة في حيّنا.`,
        });

        router.push({ pathname: '/conversation', params: { id: conv.id } });
      } else {
        router.push('/messages');
      }
    } catch (e) {
      router.push('/messages');
    } finally {
      setContacting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0891b2" />
        <Text style={styles.loadingText}>جاري تحميل تفاصيل الخدمة...</Text>
      </View>
    );
  }

  if (!service) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>الخدمة غير موجودة أو تم حذفها.</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtnAction}>
          <Text style={styles.backBtnActionText}>العودة للخدمات</Text>
        </Pressable>
      </View>
    );
  }

  const isOwner = me === service.provider_id;

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
            <Text style={styles.navTitle}>تفاصيل الخدمة</Text>
            <Pressable
              onPress={() => router.push({ pathname: '/report', params: { type: 'service', id: service.id } })}
              style={styles.iconBtn}
            >
              <Flag size={20} color="#fff" />
            </Pressable>
          </View>

          <View style={styles.heroContent}>
            <Text style={styles.heroTitle}>{service.name}</Text>
            <View style={styles.heroMetaRow}>
              <View style={styles.badgeItem}>
                <MapPin size={13} color="#fff" />
                <Text style={styles.heroMetaText}>
                  {service.city || 'السعودية'}{service.district ? ` · حي ${service.district}` : ''}
                </Text>
              </View>
              {service.available_now && (
                <View style={styles.heroAvailableBadge}>
                  <CheckCircle2 size={12} color="#15803d" />
                  <Text style={styles.heroAvailableText}>متاح للطلب الآن</Text>
                </View>
              )}
            </View>
          </View>
        </LinearGradient>

        <View style={styles.bodyContainer}>
          {/* Provider Card */}
          {provider && (
            <Pressable
              style={styles.providerCard}
              onPress={() => router.push({ pathname: '/user', params: { id: provider.id } })}
            >
              <View style={{ alignItems: 'flex-end', flex: 1 }}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }}>
                  <Text style={styles.providerName}>
                    {provider.display_name || `@${provider.username || 'مقدّم الخدمة'}`}
                  </Text>
                  {provider.is_verified && <ShieldCheck size={14} color="#0284c7" />}
                </View>
                <Text style={styles.providerSub}>
                  {provider.district ? `ساكن في حي ${provider.district}` : 'صاحب الخدمة في حيّنا'}
                </Text>
              </View>

              {provider.avatar_url ? (
                <Image source={{ uri: provider.avatar_url }} style={styles.providerAvatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <User size={22} color="#0891b2" />
                </View>
              )}
            </Pressable>
          )}

          {/* Details Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>وصف الخدمة والمهام</Text>
            <Text style={styles.cardDesc}>{service.description}</Text>

            <View style={styles.divider} />

            <View style={styles.infoRow}>
              <Text style={styles.infoVal}>{service.category || 'عام'}</Text>
              <Text style={styles.infoLabel}>التصنيف:</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoVal}>
                {service.price_from != null ? `${service.price_from} ر.س` : 'حسب الاتفاق'}
              </Text>
              <Text style={styles.infoLabel}>التسعيرة:</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={[styles.infoVal, { color: service.available_now ? '#16a34a' : '#94a3b8' }]}>
                {service.available_now ? 'جاهز للعمل ومتاح الآن 🟢' : 'غير متاح مؤقتاً 🔴'}
              </Text>
              <Text style={styles.infoLabel}>الحالة:</Text>
            </View>
          </View>

          {/* Actions */}
          {!isOwner ? (
            <Pressable
              style={[styles.contactBtn, contacting && { opacity: 0.6 }]}
              onPress={contactProvider}
              disabled={contacting}
            >
              {contacting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <MessageSquare size={20} color="#fff" />
                  <Text style={styles.contactBtnText}>مراسلة مقدّم الخدمة والاتفاق 💬</Text>
                </>
              )}
            </Pressable>
          ) : (
            <Pressable style={styles.deleteBtn} onPress={remove}>
              <Trash2 size={18} color="#ef4444" />
              <Text style={styles.deleteBtnText}>حذف هذه الخدمة</Text>
            </Pressable>
          )}
        </View>
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
  heroTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'right',
    marginBottom: 10,
  },
  heroMetaRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  badgeItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  heroMetaText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  heroAvailableBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  heroAvailableText: {
    color: '#15803d',
    fontSize: 11,
    fontWeight: '800',
  },
  bodyContainer: {
    padding: 18,
    marginTop: -10,
  },
  providerCard: {
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
  providerAvatar: {
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
  providerName: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
  },
  providerSub: {
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
  contactBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0891b2',
    paddingVertical: 15,
    borderRadius: 16,
    shadowColor: '#0891b2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  contactBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
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
