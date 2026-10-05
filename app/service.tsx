import { useEffect, useState, useMemo } from 'react';
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
  Modal,
  Share,
  Linking,
  useWindowDimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import {
  MapPin,
  MessageSquare,
  ShieldCheck,
  CheckCircle2,
  Trash2,
  Flag,
  User,
  Share2,
  Clock,
  Sparkles,
  Truck,
  ExternalLink,
  Copy,
  Check,
  Maximize2,
  X,
  Phone,
  Store,
  ChevronLeft,
  Calendar,
  AlertCircle,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenHeader from '@/components/shared/ScreenHeader';
import { getListingType, getDeliveryMode, formatServicePrice } from '@/lib/serviceTypes';
import { relativeTime } from '@/lib/mapPins';

export default function Service() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [service, setService] = useState<any>(null);
  const [provider, setProvider] = useState<any>(null);
  const [related, setRelated] = useState<any[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [contacting, setContacting] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const { width: winWidth } = useWindowDimensions();
  const galleryWidth = Math.min(winWidth, 720) - 36;

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

          // Load provider profile
          if (s.provider_id) {
            const { data: p } = await supabase
              .from('profiles')
              .select('id, display_name, username, avatar_url, is_verified, is_geoverified, city, district, created_at')
              .eq('id', s.provider_id)
              .single();
            setProvider(p);
          }

          // Load related services in the same city or category
          const { data: rel } = await supabase
            .from('services')
            .select('id, name, cover_url, images, price_from, price_to, price_type, listing_type, subcategory, city, district')
            .neq('id', id)
            .limit(4);
          setRelated(rel || []);
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
    Alert.alert('تأكيد الحذف', 'هل أنت متأكد من حذف هذا العرض نهائياً من سوق الحي؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف العرض',
        style: 'destructive',
        onPress: async () => {
          const r = await supabase.from('services').delete().eq('id', id);
          if (r.error) Alert.alert('خطأ', r.error.message);
          else {
            Alert.alert('تم بنجاح', 'تم حذف العرض بنجاح.');
            router.replace('/market');
          }
        },
      },
    ]);
  }

  async function shareOffer() {
    if (!service) return;
    const url = Platform.OS === 'web' && typeof window !== 'undefined'
      ? `${window.location.origin}/service?id=${service.id}`
      : `https://hayna.app/service?id=${service.id}`;
    const text = `شوف هذا العرض في حيّنا: «${service.name}» — ${formatServicePrice(service)}\n${url}`;

    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
      }
      await Share.share({
        message: text,
        title: service.name,
      });
    } catch {}
  }

  function openWhatsApp() {
    if (!service?.whatsapp) return;
    const raw = String(service.whatsapp || '').replace(/\D/g, '');
    const intl = raw.startsWith('966') ? raw : raw.startsWith('0') ? '966' + raw.slice(1) : '966' + raw;
    const pageUrl = Platform.OS === 'web' && typeof window !== 'undefined'
      ? `\nرابط العرض: ${window.location.origin}/service?id=${service.id}`
      : '';
    const msg = encodeURIComponent(`مرحباً، شفت عرضك «${service.name}» في تطبيق حيّنا وحاب أستفسر عنه.${pageUrl}`);
    Linking.openURL(`https://wa.me/${intl}?text=${msg}`).catch(() => Alert.alert('خطأ', 'تعذر فتح واتساب'));
  }

  function callPhone() {
    if (!service?.phone && !service?.whatsapp) return;
    const number = service.phone || service.whatsapp;
    Linking.openURL(`tel:${number}`).catch(() => Alert.alert('خطأ', 'تعذر إجراء المكالمة'));
  }

  async function contactProvider() {
    if (!me) {
      return router.push('/auth');
    }
    if (me === service?.provider_id) {
      return Alert.alert('تنبيه', 'أنت صاحب هذا العرض.');
    }

    setContacting(true);
    try {
      const providerId = service?.provider_id;
      if (!providerId) {
        Alert.alert('خطأ', 'لا يوجد مزوّد خدمة صالح لهذا العرض.');
        return;
      }

      let convId: string | null = null;
      const { data: existingMembers } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', me)
        .order('conversation_id');

      if (existingMembers && existingMembers.length > 0) {
        const myConversations = existingMembers.map(m => m.conversation_id);
        if (myConversations.length > 0) {
          const { data: partnerMatches } = await supabase
            .from('conversation_members')
            .select('conversation_id, user_id')
            .in('conversation_id', myConversations)
            .eq('user_id', providerId)
            .maybeSingle();

          if (partnerMatches?.conversation_id) {
            convId = partnerMatches.conversation_id;
          }
        }
      }

      if (!convId) {
        const { data: conv, error: convError } = await supabase
          .from('conversations')
          .insert({})
          .select('id')
          .single();

        if (convError || !conv) {
          throw convError ?? new Error('تعذّر إنشاء محادثة جديدة.');
        }

        convId = conv.id;

        const membersPayload = [
          { conversation_id: convId, user_id: me },
          { conversation_id: convId, user_id: providerId },
        ];

        const { error: membersError } = await supabase
          .from('conversation_members')
          .insert(membersPayload);

        if (membersError) {
          throw membersError;
        }
      }

      const body = `مرحباً! أريد الاستفسار عن عرضك «${service.name}» في سوق الحي. هل هو متوفر الآن؟`;
      const { error: messageError } = await supabase.from('messages').insert({
        conversation_id: convId,
        sender_id: me,
        body,
      });

      if (messageError) {
        throw messageError;
      }

      router.push({ pathname: '/conversation', params: { id: convId } });
    } catch (e) {
      console.warn('contactProvider error', e);
      router.push('/messages');
    } finally {
      setContacting(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#059669" />
        <Text style={styles.loadingText}>جاري تحميل تفاصيل العرض...</Text>
      </View>
    );
  }

  if (!service) {
    return (
      <View style={styles.center}>
        <AlertCircle size={48} color="#ef4444" />
        <Text style={styles.errorText}>العرض غير موجود أو تم حذفه.</Text>
        <Pressable onPress={() => router.replace('/market')} style={styles.backBtnAction}>
          <Text style={styles.backBtnActionText}>العودة لسوق الحي</Text>
        </Pressable>
      </View>
    );
  }

  const isOwner = me === service.provider_id;
  const type = getListingType(service.listing_type, service.category);
  const images: string[] = Array.isArray(service.images) && service.images.length
    ? service.images
    : service.cover_url ? [service.cover_url] : [];
  const modes: string[] = service.delivery_modes || [];
  const details: Record<string, string> = service.details || {};

  // Standard details mapping
  const detailKeyLabels: Record<string, { label: string; icon: string }> = {
    preorder: { label: 'الطلب المسبق', icon: '⏳' },
    quantity: { label: 'الكمية المتاحة', icon: '📦' },
    condition: { label: 'حالة المنتج', icon: '✨' },
    warranty: { label: 'الضمان', icon: '🛡️' },
    experience: { label: 'سنوات الخبرة', icon: '⭐' },
    delivery_time: { label: 'مدة التسليم', icon: '⏱️' },
    level: { label: 'المرحلة التعليمية', icon: '🎓' },
    range: { label: 'نطاق الخدمة', icon: '📍' },
    map_link: { label: 'رابط الخريطة', icon: '🗺️' },
  };

  const extraEntries = Object.entries(details).filter(([_, v]) => Boolean(v && String(v).trim()));
  const timeAgoText = relativeTime(service.created_at);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Top Hero Gradient */}
        <LinearGradient
          colors={['#065f46', '#059669', '#10b981']}
          style={styles.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <ScreenHeader
            title="تفاصيل العرض"
            fallbackRoute="/market"
            rightAction={(
              <View style={styles.headerTopIcons}>
                <Pressable onPress={shareOffer} style={styles.iconBtn} hitSlop={8}>
                  {copiedLink ? <Check size={18} color="#86efac" /> : <Share2 size={18} color="#fff" />}
                </Pressable>
                <Pressable
                  onPress={() => router.push({ pathname: '/report', params: { type: 'service', id: service.id } })}
                  style={styles.iconBtn}
                  hitSlop={8}
                >
                  <Flag size={18} color="#fff" />
                </Pressable>
              </View>
            )}
          />

          <View style={styles.heroContent}>
            {/* Type badge */}
            <View style={styles.heroBadgeRow}>
              {type && (
                <View style={[styles.typeHeroPill, { backgroundColor: 'rgba(255,255,255,0.22)' }]}>
                  <type.Icon size={14} color="#fff" />
                  <Text style={styles.typeHeroPillText}>{type.label}</Text>
                </View>
              )}
              {service.subcategory && (
                <View style={styles.subCategoryPill}>
                  <Text style={styles.subCategoryPillText}>{service.subcategory}</Text>
                </View>
              )}
            </View>

            <Text style={styles.heroTitle}>{service.name}</Text>

            <View style={styles.heroMetaRow}>
              <View style={styles.badgeItem}>
                <MapPin size={13} color="#fff" />
                <Text style={styles.heroMetaText}>
                  {service.city || 'السعودية'}{service.district ? ` · حي ${service.district}` : ''}
                </Text>
              </View>

              {timeAgoText ? (
                <View style={styles.badgeItem}>
                  <Clock size={12} color="#fff" />
                  <Text style={styles.heroMetaText}>{timeAgoText}</Text>
                </View>
              ) : null}

              <View style={[styles.heroAvailableBadge, !service.available_now && styles.heroUnavailableBadge]}>
                <CheckCircle2 size={12} color={service.available_now ? '#15803d' : '#b91c1c'} />
                <Text style={[styles.heroAvailableText, !service.available_now && styles.heroUnavailableText]}>
                  {service.available_now ? 'متاح للطلب الآن 🟢' : 'غير متاح حالياً 🔴'}
                </Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.bodyContainer}>
          {/* Gallery with counter and full-screen view */}
          {images.length > 0 && (
            <View style={styles.gallery}>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={(e) => setActiveImage(Math.round(Math.abs(e.nativeEvent.contentOffset.x) / galleryWidth))}
                scrollEventThrottle={32}
              >
                {images.map((uri) => (
                  <Pressable key={uri} onPress={() => setFullscreenImage(uri)}>
                    <Image source={{ uri }} style={{ width: galleryWidth, height: galleryWidth * 0.72 }} resizeMode="cover" />
                  </Pressable>
                ))}
              </ScrollView>

              {/* Image counter indicator */}
              <View style={styles.imageCounter}>
                <Maximize2 size={11} color="#fff" style={{ marginLeft: 4 }} />
                <Text style={styles.imageCounterText}>{activeImage + 1} / {images.length}</Text>
              </View>

              {images.length > 1 && (
                <View style={styles.dots}>
                  {images.map((uri, i) => <View key={uri} style={[styles.dot, i === activeImage && styles.dotActive]} />)}
                </View>
              )}
            </View>
          )}

          {/* Pricing Highlight Card */}
          <View style={styles.priceCard}>
            <View style={styles.priceCol}>
              <Text style={styles.priceLabel}>التسعيرة المقدرة</Text>
              <Text style={styles.priceMain}>{formatServicePrice(service)}</Text>
            </View>
            <View style={styles.priceBadgePill}>
              <Text style={styles.priceBadgePillText}>
                {service.price_type === 'negotiable' ? 'اتفاق مباشر بين الجيران' : service.price_type === 'range' ? 'حسب متطلبات الطلب' : 'سعر ثابت محدد'}
              </Text>
            </View>
          </View>

          {/* Provider Card with verified trust */}
          {provider && (
            <Pressable
              style={styles.providerCard}
              onPress={() => router.push({ pathname: '/user', params: { id: provider.id } })}
            >
              <View style={{ alignItems: 'flex-end', flex: 1 }}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.providerName}>
                    {provider.display_name || `@${provider.username || 'مقدّم الخدمة'}`}
                  </Text>
                  {provider.is_verified && (
                    <View style={styles.verifiedBadge}>
                      <ShieldCheck size={13} color="#059669" />
                      <Text style={styles.verifiedBadgeText}>موثق</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.providerSub}>
                  {provider.district ? `ساكن في حي ${provider.district}` : 'صاحب العرض في حيّنا'}
                </Text>
              </View>

              {provider.avatar_url ? (
                <Image source={{ uri: provider.avatar_url }} style={styles.providerAvatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <User size={22} color="#059669" />
                </View>
              )}
            </Pressable>
          )}

          {/* Description Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>وصف العرض والمهام</Text>
            <Text style={styles.cardDesc}>{service.description || 'لا يوجد وصف إضافي.'}</Text>
          </View>

          {/* Delivery & Receipt Modes */}
          {modes.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>طرق الاستلام والتسليم المتاحة</Text>
              <View style={styles.modesGrid}>
                {modes.map((m) => {
                  const mode = getDeliveryMode(m);
                  if (!mode) return null;
                  const descriptions: Record<string, string> = {
                    delivery: 'توصيل مباشر إلى عنوانك داخل الحي أو المدينة',
                    pickup_home: 'استلام شخصي من موقع صاحب العرض بالحي',
                    at_shop: 'متوفر للشراء والاستلام من المحل التجاري',
                    home_visit: 'زيارة منزلية وفحص أو إنجاز العمل في موقعك',
                    remote: 'تنفيذ وتسليم الخدمة إلكترونياً عن بُعد',
                  };
                  return (
                    <View key={m} style={styles.modeCard}>
                      <View style={styles.modeIconRow}>
                        <Text style={styles.modeEmoji}>{mode.emoji}</Text>
                        <Text style={styles.modeName}>{mode.label}</Text>
                      </View>
                      <Text style={styles.modeDesc}>{descriptions[m] || 'متاح حسب الاتفاق'}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Specifications & Details Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>مواصفات وبيانات الخدمة</Text>

            <View style={styles.infoRow}>
              <Text style={styles.infoVal}>{service.subcategory || service.category || type?.label || 'عام'}</Text>
              <Text style={styles.infoLabel}>التصنيف الأساسي:</Text>
            </View>

            {service.shop_name ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoVal}>🏪 {service.shop_name}</Text>
                <Text style={styles.infoLabel}>اسم المحل / المتجر:</Text>
              </View>
            ) : null}

            {service.working_hours ? (
              <View style={styles.infoRow}>
                <Text style={styles.infoVal}>⏰ {service.working_hours}</Text>
                <Text style={styles.infoLabel}>أوقات العمل والتواجد:</Text>
              </View>
            ) : null}

            {extraEntries.map(([k, v]) => {
              const meta = detailKeyLabels[k] || { label: k, icon: '📌' };
              if (k === 'map_link') {
                return (
                  <View key={k} style={styles.infoRow}>
                    <Pressable onPress={() => Linking.openURL(v).catch(() => {})}>
                      <Text style={[styles.infoVal, { color: '#0284c7', textDecorationLine: 'underline' }]}>
                        فتح في خرائط قوقل 🗺️
                      </Text>
                    </Pressable>
                    <Text style={styles.infoLabel}>{meta.label}:</Text>
                  </View>
                );
              }
              return (
                <View key={k} style={styles.infoRow}>
                  <Text style={styles.infoVal}>{meta.icon} {v}</Text>
                  <Text style={styles.infoLabel}>{meta.label}:</Text>
                </View>
              );
            })}

            <View style={styles.infoRow}>
              <Text style={[styles.infoVal, { color: service.available_now ? '#16a34a' : '#dc2626' }]}>
                {service.available_now ? 'متاح وجاهز للتنفيذ 🟢' : 'غير متاح مؤقتاً 🔴'}
              </Text>
              <Text style={styles.infoLabel}>الحالة الحالية:</Text>
            </View>

            <View style={styles.infoRow}>
              <Pressable
                onPress={() => router.push({ pathname: '/map', params: { city: service.city, district: service.district } })}
                style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }}
              >
                <Text style={[styles.infoVal, { color: '#059669', textDecorationLine: 'underline' }]}>
                  عرض على خريطة الحي 📍
                </Text>
              </Pressable>
              <Text style={styles.infoLabel}>الموقع بالحي:</Text>
            </View>
          </View>

          {/* Action CTAs */}
          {!isOwner ? (
            <View style={styles.actionsBox}>
              {service.whatsapp && (
                <Pressable style={styles.whatsappBtn} onPress={openWhatsApp}>
                  <Text style={styles.whatsappBtnText}>تواصل فوري عبر واتساب 💬</Text>
                  <Text style={styles.whatsappBtnSub}>{service.whatsapp}</Text>
                </Pressable>
              )}

              <Pressable
                style={[styles.contactBtn, contacting && { opacity: 0.6 }]}
                onPress={contactProvider}
                disabled={contacting}
              >
                {contacting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <MessageSquare size={19} color="#fff" />
                    <Text style={styles.contactBtnText}>محادثة داخل التطبيق 💬</Text>
                  </>
                )}
              </Pressable>

              {Boolean(service.phone && service.phone !== service.whatsapp) && (
                <Pressable style={styles.phoneBtn} onPress={callPhone}>
                  <Phone size={18} color="#059669" />
                  <Text style={styles.phoneBtnText}>اتصال هاتفي ({service.phone})</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <View style={styles.actionsBox}>
              <View style={styles.ownerNotice}>
                <Sparkles size={16} color="#059669" />
                <Text style={styles.ownerNoticeText}>هذا عرضك الخاص المنشور في سوق الحي.</Text>
              </View>
              <Pressable style={styles.deleteBtn} onPress={remove}>
                <Trash2 size={18} color="#ef4444" />
                <Text style={styles.deleteBtnText}>حذف هذا العرض نهائياً</Text>
              </Pressable>
            </View>
          )}

          {/* Related services in neighborhood */}
          {related.length > 0 && (
            <View style={styles.relatedSection}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>عروض أخرى من الحي</Text>
                <Pressable onPress={() => router.push('/market')}>
                  <Text style={styles.seeAllText}>عرض كل السوق</Text>
                </Pressable>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.relatedRow}>
                {related.map((rel) => {
                  const cover = rel.cover_url || (Array.isArray(rel.images) && rel.images[0]);
                  return (
                    <Pressable
                      key={rel.id}
                      style={styles.relatedCard}
                      onPress={() => router.push({ pathname: '/service', params: { id: rel.id } })}
                    >
                      <View style={styles.relatedImageWrap}>
                        {cover ? (
                          <Image source={{ uri: cover }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                        ) : (
                          <Store size={26} color="#94a3b8" />
                        )}
                      </View>
                      <View style={styles.relatedBody}>
                        <Text style={styles.relatedTitle} numberOfLines={1}>{rel.name}</Text>
                        <Text style={styles.relatedPrice}>{formatServicePrice(rel)}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Fullscreen Lightbox Modal */}
      <Modal visible={Boolean(fullscreenImage)} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalCloseBtn} onPress={() => setFullscreenImage(null)}>
            <X size={26} color="#fff" />
          </Pressable>
          {fullscreenImage && (
            <Image source={{ uri: fullscreenImage }} style={styles.modalImage} resizeMode="contain" />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scroll: {
    paddingBottom: 50,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    color: '#64748b',
    fontSize: 14,
    marginTop: 12,
    fontWeight: '700',
  },
  errorText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 12,
    marginBottom: 16,
  },
  backBtnAction: {
    backgroundColor: '#059669',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 14,
  },
  backBtnActionText: {
    color: '#fff',
    fontWeight: '900',
  },
  hero: {
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
    paddingHorizontal: 18,
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTopIcons: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroContent: {
    alignItems: 'flex-end',
    marginTop: 8,
  },
  heroBadgeRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  typeHeroPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  typeHeroPillText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
  subCategoryPill: {
    backgroundColor: '#fff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  subCategoryPillText: {
    color: '#065f46',
    fontSize: 12,
    fontWeight: '900',
  },
  heroTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'right',
    marginBottom: 10,
    lineHeight: 30,
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
    paddingVertical: 5,
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
    paddingVertical: 5,
    borderRadius: 10,
  },
  heroUnavailableBadge: {
    backgroundColor: '#fee2e2',
  },
  heroAvailableText: {
    color: '#15803d',
    fontSize: 11,
    fontWeight: '800',
  },
  heroUnavailableText: {
    color: '#b91c1c',
  },
  bodyContainer: {
    padding: 16,
    marginTop: -12,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  gallery: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#e2e8f0',
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
  },
  imageCounter: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(15,23,42,0.65)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  imageCounterText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
  },
  dots: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 6,
    backgroundColor: 'rgba(15,23,42,0.4)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { backgroundColor: '#fff', width: 18 },

  priceCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  priceCol: {
    alignItems: 'flex-end',
  },
  priceLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '700',
    marginBottom: 2,
  },
  priceMain: {
    fontSize: 22,
    fontWeight: '900',
    color: '#059669',
  },
  priceBadgePill: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  priceBadgePillText: {
    color: '#047857',
    fontSize: 11.5,
    fontWeight: '800',
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
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerName: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '900',
  },
  providerSub: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  verifiedBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  verifiedBadgeText: {
    color: '#059669',
    fontSize: 10,
    fontWeight: '900',
  },

  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#eef2f7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'right',
    marginBottom: 12,
  },
  cardDesc: {
    color: '#334155',
    fontSize: 14,
    lineHeight: 23,
    textAlign: 'right',
  },

  modesGrid: {
    gap: 8,
  },
  modeCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  modeIconRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  modeEmoji: {
    fontSize: 16,
  },
  modeName: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#0f172a',
  },
  modeDesc: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'right',
  },

  infoRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
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
    textAlign: 'left',
  },

  actionsBox: {
    gap: 10,
    marginTop: 4,
    marginBottom: 20,
  },
  whatsappBtn: {
    backgroundColor: '#25D366',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#25D366',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  whatsappBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
  whatsappBtnSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    marginTop: 2,
    fontWeight: '700',
  },
  contactBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: 16,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  contactBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
  phoneBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#059669',
    paddingVertical: 13,
    borderRadius: 16,
  },
  phoneBtnText: {
    color: '#059669',
    fontSize: 14,
    fontWeight: '800',
  },
  ownerNotice: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ecfdf5',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  ownerNoticeText: {
    color: '#047857',
    fontSize: 12.5,
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
    paddingVertical: 13,
    borderRadius: 16,
  },
  deleteBtnText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '800',
  },

  relatedSection: {
    marginTop: 10,
    marginBottom: 10,
  },
  sectionHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },
  seeAllText: {
    fontSize: 12.5,
    color: '#059669',
    fontWeight: '800',
  },
  relatedRow: {
    flexDirection: 'row-reverse',
    gap: 10,
  },
  relatedCard: {
    width: 140,
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  relatedImageWrap: {
    width: '100%',
    height: 90,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  relatedBody: {
    padding: 8,
  },
  relatedTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'right',
  },
  relatedPrice: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#059669',
    textAlign: 'right',
    marginTop: 3,
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalImage: {
    width: '92%',
    height: '80%',
  },
});
