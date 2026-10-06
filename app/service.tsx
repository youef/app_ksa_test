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
  MessageCircle,
  Heart,
  Award,
  Info,
  Navigation,
  ArrowRight,
  PackageCheck,
  BadgeCheck,
  CircleAlert,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenHeader from '@/components/shared/ScreenHeader';
import { getListingType, getDeliveryMode, formatServicePrice } from '@/lib/serviceTypes';
import { relativeTime } from '@/lib/mapPins';
import { useBottomNavInset } from '@/lib/bottomNav';

export default function Service() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const bottomNavInset = useBottomNavInset();
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
  const isWide = winWidth > 768;
  const contentWidth = Math.min(winWidth, 800) - 32;

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
              .maybeSingle();
            setProvider(p);
          }

          // Load related services in the same city or category
          const { data: rel } = await supabase
            .from('services')
            .select('id, name, cover_url, images, price_from, price_to, price_type, listing_type, subcategory, city, district')
            .neq('id', id)
            .limit(6);
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
      return Alert.alert('تنبيه', 'يمكن لمالك العرض فقط حذفه.');
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
    const text = `شوف هذا العرض في سوق حيّنا: «${service.name}» — ${formatServicePrice(service)}\n${url}`;

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
    const rawNumber = service?.whatsapp || service?.phone;
    if (!rawNumber) {
      Alert.alert('تنبيه', 'رقم الواتساب غير مسجل لهذا العرض.');
      return;
    }
    const raw = String(rawNumber).replace(/\D/g, '');
    const intl = raw.startsWith('966') ? raw : raw.startsWith('0') ? '966' + raw.slice(1) : '966' + raw;
    const pageUrl = Platform.OS === 'web' && typeof window !== 'undefined'
      ? `\nرابط العرض: ${window.location.origin}/service?id=${service.id}`
      : '';
    const msg = encodeURIComponent(`مرحباً، شفت عرضك «${service.name}» في سوق الحي بتطبيق حيّنا وحاب أستفسر عنه.${pageUrl}`);
    Linking.openURL(`https://wa.me/${intl}?text=${msg}`).catch(() => Alert.alert('خطأ', 'تعذر فتح واتساب'));
  }

  function callPhone() {
    const number = service?.phone || service?.whatsapp;
    if (!number) {
      Alert.alert('تنبيه', 'رقم الاتصال غير مسجل.');
      return;
    }
    Linking.openURL(`tel:${String(number).replace(/\s+/g, '')}`).catch(() => Alert.alert('خطأ', 'تعذر إجراء المكالمة'));
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
        Alert.alert('خطأ', 'لا يوجد معلن صالح لهذا العرض.');
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

      const body = `مرحباً! أستفسر عن عرضك «${service.name}» في سوق الحي. هل هو متوفر الآن؟`;
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
        <Text style={styles.loadingText}>جاري تجهيز تفاصيل العرض من الحي...</Text>
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
    preorder: { label: 'حالة التوفر والطلب', icon: '⏳' },
    quantity: { label: 'الكمية المتاحة', icon: '📦' },
    condition: { label: 'حالة السلعة', icon: '✨' },
    warranty: { label: 'الضمان والموثوقية', icon: '🛡️' },
    experience: { label: 'سنوات الخبرة', icon: '⭐' },
    delivery_time: { label: 'مدة التسليم المتوقعة', icon: '⏱️' },
    level: { label: 'المرحلة التعليمية', icon: '🎓' },
    range: { label: 'نطاق الخدمة والتغطية', icon: '📍' },
    map_link: { label: 'رابط الخريطة', icon: '🗺️' },
  };

  const extraEntries = Object.entries(details).filter(([_, v]) => Boolean(v && String(v).trim()));
  const timeAgoText = relativeTime(service.created_at);

  return (
    <View style={styles.container}>
      {/* Top Navbar */}
      <View style={styles.topNavbar}>
        <View style={styles.topNavInner}>
          <Pressable onPress={() => router.back()} style={styles.navBackBtn} hitSlop={8}>
            <ChevronLeft size={22} color="#0f172a" />
          </Pressable>
          <Text style={styles.navTitle} numberOfLines={1}>
            {service.name}
          </Text>
          <View style={styles.navActions}>
            <Pressable onPress={shareOffer} style={styles.navIconBtn} hitSlop={8}>
              {copiedLink ? <Check size={18} color="#059669" /> : <Share2 size={18} color="#334155" />}
            </Pressable>
            <Pressable
              onPress={() => router.push({ pathname: '/report', params: { type: 'service', id: service.id } })}
              style={styles.navIconBtn}
              hitSlop={8}
            >
              <Flag size={17} color="#64748b" />
            </Pressable>
          </View>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomNavInset + 90 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.bodyWrap}>
          {/* 1. HERO MEDIA GALLERY */}
          {images.length > 0 ? (
            <View style={styles.galleryCard}>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={(e) => setActiveImage(Math.round(Math.abs(e.nativeEvent.contentOffset.x) / contentWidth))}
                scrollEventThrottle={32}
              >
                {images.map((uri, idx) => (
                  <Pressable key={idx} onPress={() => setFullscreenImage(uri)} style={{ width: contentWidth, height: contentWidth * 0.72 }}>
                    <Image source={{ uri }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                  </Pressable>
                ))}
              </ScrollView>

              {/* Floating badges on media */}
              <View style={styles.galleryTopRow}>
                {type && (
                  <View style={[styles.galleryTypePill, { backgroundColor: type.color || '#059669' }]}>
                    <Text style={styles.galleryTypePillText}>{type.short || type.label}</Text>
                  </View>
                )}
                <View style={styles.imageCounter}>
                  <Maximize2 size={11} color="#fff" />
                  <Text style={styles.imageCounterText}>{activeImage + 1} / {images.length}</Text>
                </View>
              </View>

              {images.length > 1 && (
                <View style={styles.dots}>
                  {images.map((_, i) => (
                    <View key={i} style={[styles.dot, i === activeImage && styles.dotActive]} />
                  ))}
                </View>
              )}
            </View>
          ) : (
            <View style={[styles.placeholderHero, { backgroundColor: type?.bg || '#ecfdf5' }]}>
              {type ? (
                <type.Icon size={48} color={type.color || '#059669'} />
              ) : (
                <Store size={48} color="#059669" />
              )}
              <Text style={[styles.placeholderHeroText, { color: type?.color || '#059669' }]}>
                {type?.label || 'عرض وسلعة من الحي'}
              </Text>
            </View>
          )}

          {/* 2. PRIMARY OFFERING INFO CARD */}
          <View style={styles.infoCard}>
            <View style={styles.titlePriceRow}>
              <View style={{ flex: 1, alignItems: 'flex-end', gap: 4 }}>
                <Text style={styles.mainTitle}>{service.name}</Text>
                <Text style={styles.subCategoryText}>
                  {service.subcategory || service.category || type?.label || 'عرض محلي'}
                  {service.shop_name ? ` · من متجر ${service.shop_name}` : ''}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-start', gap: 3 }}>
                <Text style={styles.mainPrice}>{formatServicePrice(service)}</Text>
                <View style={styles.priceTypePill}>
                  <Text style={styles.priceTypePillText}>
                    {service.price_type === 'negotiable'
                      ? 'قابل للتفاوض'
                      : service.price_type === 'range'
                      ? 'حسب الطلب'
                      : 'سعر محدد'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Badges / Meta row */}
            <View style={styles.badgesRow}>
              <View style={[styles.statusBadge, service.available_now ? styles.statusBadgeOpen : styles.statusBadgeClosed]}>
                <View style={[styles.statusDot, { backgroundColor: service.available_now ? '#10b981' : '#ef4444' }]} />
                <Text style={[styles.statusBadgeText, { color: service.available_now ? '#15803d' : '#b91c1c' }]}>
                  {service.available_now ? 'متاح للطلب الآن' : 'غير متوفر حالياً'}
                </Text>
              </View>

              <Pressable
                style={styles.locationBadge}
                onPress={() => router.push({ pathname: '/map', params: { city: service.city, district: service.district } })}
              >
                <MapPin size={13} color="#059669" />
                <Text style={styles.locationBadgeText}>
                  {service.city || 'المدينة'}{service.district ? ` · حي ${service.district}` : ''}
                </Text>
              </Pressable>

              {timeAgoText && (
                <View style={styles.timeBadge}>
                  <Clock size={12} color="#64748b" />
                  <Text style={styles.timeBadgeText}>{timeAgoText}</Text>
                </View>
              )}
            </View>
          </View>

          {/* 3. NEIGHBORHOOD TRUST & SAFETY BANNER */}
          <View style={styles.trustBanner}>
            <View style={styles.trustIconCircle}>
              <BadgeCheck size={22} color="#059669" />
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end', gap: 2 }}>
              <Text style={styles.trustTitle}>معاملة مباشرة وموثوقة بين الجيران 🛡️</Text>
              <Text style={styles.trustDesc}>
                هذا العرض منشور من أحد سكان {service.city ? `مدينة ${service.city}` : 'الحي'}{service.district ? ` (حي ${service.district})` : ''}. يتم الفحص والاستلام مباشرة باليد أو التوصيل بالاتفاق.
              </Text>
            </View>
          </View>

          {/* 4. SELLER / PROVIDER PROFILE CARD */}
          {provider && (
            <Pressable
              style={styles.sellerCard}
              onPress={() => router.push({ pathname: '/user', params: { id: provider.id } })}
            >
              <View style={styles.sellerActionBtn}>
                <Text style={styles.sellerActionBtnText}>عرض الملف</Text>
                <ChevronLeft size={14} color="#059669" />
              </View>

              <View style={{ flex: 1, alignItems: 'flex-end', gap: 3 }}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.sellerName}>
                    {provider.display_name || `@${provider.username || 'أحد الجيران'}`}
                  </Text>
                  {provider.is_verified && <ShieldCheck size={16} color="#059669" />}
                </View>
                <Text style={styles.sellerSub}>
                  {provider.district ? `سكان حي ${provider.district}` : 'صاحب الإعلان في حيّنا'}
                  {provider.city ? ` · ${provider.city}` : ''}
                </Text>
              </View>

              {provider.avatar_url ? (
                <Image source={{ uri: provider.avatar_url }} style={styles.sellerAvatar} />
              ) : (
                <View style={styles.sellerAvatarPlaceholder}>
                  <Text style={styles.sellerAvatarLetter}>
                    {provider.display_name?.[0] || 'ج'}
                  </Text>
                </View>
              )}
            </Pressable>
          )}

          {/* 5. DESCRIPTION */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionCardTitle}>تفاصيل ووصف العرض 📝</Text>
            <Text style={styles.sectionCardDesc}>{service.description || 'لا يوجد وصف مفصل لهذا العرض.'}</Text>
          </View>

          {/* 6. DELIVERY & RECEIPT MODES */}
          {modes.length > 0 && (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionCardTitle}>طرق الاستلام والتسليم المتاحة 🚗</Text>
              <View style={styles.modesContainer}>
                {modes.map((m) => {
                  const mode = getDeliveryMode(m);
                  if (!mode) return null;
                  const descriptions: Record<string, string> = {
                    delivery: 'توصيل مباشر إلى منزلك أو عنوانك داخل الحي',
                    pickup_home: 'استلام شخصي ومباشر من موقع الجار المعلن',
                    at_shop: 'متوفر للشراء والاستلام من المحل التجاري',
                    home_visit: 'زيارة منزلية وتقديم الخدمة في موقعك',
                    remote: 'تسليم إلكتروني أو تنفيذ الخدمة عن بُعد',
                  };
                  return (
                    <View key={m} style={styles.deliveryModeRow}>
                      <View style={styles.deliveryModeEmojiBox}>
                        <Text style={{ fontSize: 18 }}>{mode.emoji}</Text>
                      </View>
                      <View style={{ flex: 1, alignItems: 'flex-end' }}>
                        <Text style={styles.deliveryModeLabel}>{mode.label}</Text>
                        <Text style={styles.deliveryModeSub}>{descriptions[m] || 'متاح بالاتفاق'}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* 7. SPECIFICATIONS & DETAILS */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionCardTitle}>بيانات ومواصفات إضافية 📋</Text>
            <View style={styles.specsList}>
              <View style={styles.specRow}>
                <Text style={styles.specVal}>{service.subcategory || service.category || type?.label || 'عام'}</Text>
                <Text style={styles.specLabel}>التصنيف الأساسي:</Text>
              </View>

              {service.shop_name && (
                <View style={styles.specRow}>
                  <Text style={styles.specVal}>🏪 {service.shop_name}</Text>
                  <Text style={styles.specLabel}>المتجر / المحل:</Text>
                </View>
              )}

              {service.working_hours && (
                <View style={styles.specRow}>
                  <Text style={styles.specVal}>⏰ {service.working_hours}</Text>
                  <Text style={styles.specLabel}>أوقات التواجد والعمل:</Text>
                </View>
              )}

              {extraEntries.map(([k, v]) => {
                const meta = detailKeyLabels[k] || { label: k, icon: '📌' };
                if (k === 'map_link') {
                  return (
                    <View key={k} style={styles.specRow}>
                      <Pressable onPress={() => Linking.openURL(v).catch(() => {})}>
                        <Text style={[styles.specVal, { color: '#0284c7', textDecorationLine: 'underline' }]}>
                          فتح في خرائط Google 🗺️
                        </Text>
                      </Pressable>
                      <Text style={styles.specLabel}>{meta.label}:</Text>
                    </View>
                  );
                }
                return (
                  <View key={k} style={styles.specRow}>
                    <Text style={styles.specVal}>{meta.icon} {v}</Text>
                    <Text style={styles.specLabel}>{meta.label}:</Text>
                  </View>
                );
              })}

              <View style={styles.specRow}>
                <Pressable
                  onPress={() => router.push({ pathname: '/map', params: { city: service.city, district: service.district } })}
                  style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }}
                >
                  <Text style={[styles.specVal, { color: '#059669', textDecorationLine: 'underline' }]}>
                    {service.city || ''} {service.district ? `· حي ${service.district}` : ''} 📍
                  </Text>
                </Pressable>
                <Text style={styles.specLabel}>الموقع المحدد:</Text>
              </View>
            </View>
          </View>

          {/* 8. OWNER MANAGEMENT (IF VIEWER IS OWNER) */}
          {isOwner && (
            <View style={styles.ownerBox}>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
                <Sparkles size={18} color="#059669" />
                <Text style={styles.ownerBoxTitle}>أنت صاحب هذا العرض في سوق الحي</Text>
              </View>
              <Text style={styles.ownerBoxDesc}>يمكنك إدارة العرض أو حذفه في أي وقت.</Text>
              <Pressable style={styles.ownerDeleteBtn} onPress={remove}>
                <Trash2 size={16} color="#ef4444" />
                <Text style={styles.ownerDeleteBtnText}>حذف هذا العرض نهائياً</Text>
              </Pressable>
            </View>
          )}

          {/* 9. RELATED OFFERS */}
          {related.length > 0 && (
            <View style={styles.relatedBox}>
              <View style={styles.relatedHead}>
                <Pressable onPress={() => router.push('/market')}>
                  <Text style={styles.relatedSeeAll}>تصفح كل السوق</Text>
                </Pressable>
                <Text style={styles.relatedTitle}>عروض أخرى من الحي 🛍️</Text>
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
                      <View style={styles.relatedImgBox}>
                        {cover ? (
                          <Image source={{ uri: cover }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                        ) : (
                          <Store size={26} color="#94a3b8" />
                        )}
                      </View>
                      <View style={styles.relatedInfo}>
                        <Text style={styles.relatedName} numberOfLines={1}>{rel.name}</Text>
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

      {/* 10. STICKY BOTTOM ACTION BAR (INSTANT CONTACT) */}
      {!isOwner && (
        <View style={styles.bottomBar}>
          <View style={styles.bottomBarInner}>
            {/* WhatsApp Direct */}
            {Boolean(service.whatsapp || service.phone) && (
              <Pressable style={styles.barWaBtn} onPress={openWhatsApp}>
                <MessageCircle size={18} color="#fff" />
                <Text style={styles.barWaBtnText}>محادثة واتساب</Text>
              </Pressable>
            )}

            {/* Direct Phone Call */}
            {Boolean(service.phone || service.whatsapp) && (
              <Pressable style={styles.barPhoneBtn} onPress={callPhone}>
                <Phone size={17} color="#0284c7" />
                <Text style={styles.barPhoneBtnText}>اتصال</Text>
              </Pressable>
            )}

            {/* In-app Conversation */}
            <Pressable
              style={[styles.barMsgBtn, contacting && { opacity: 0.6 }]}
              onPress={contactProvider}
              disabled={contacting}
            >
              {contacting ? (
                <ActivityIndicator size="small" color="#059669" />
              ) : (
                <>
                  <MessageSquare size={17} color="#059669" />
                  <Text style={styles.barMsgBtnText}>رسالة</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      )}

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
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: '#f8fafc' },
  loadingText: { color: '#64748b', fontSize: 14, marginTop: 12, fontWeight: '700' },
  errorText: { color: '#0f172a', fontSize: 16, fontWeight: '900', marginTop: 12, marginBottom: 16 },
  backBtnAction: { backgroundColor: '#059669', paddingHorizontal: 22, paddingVertical: 12, borderRadius: 14 },
  backBtnActionText: { color: '#fff', fontWeight: '900' },

  // Navbar
  topNavbar: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingTop: Platform.OS === 'ios' ? 48 : 16,
    paddingBottom: 10,
    paddingHorizontal: 16,
    zIndex: 10,
  },
  topNavInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
  },
  navBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  navActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  navIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Body Layout
  scroll: { paddingTop: 14 },
  bodyWrap: { width: '100%', maxWidth: 800, alignSelf: 'center', paddingHorizontal: 16, gap: 14 },

  // Gallery
  galleryCard: {
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 3,
    position: 'relative',
  },
  galleryTopRow: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  galleryTypePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  galleryTypePillText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
  },
  imageCounter: {
    backgroundColor: 'rgba(15,23,42,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  imageCounterText: { color: '#fff', fontSize: 11, fontWeight: '900' },
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

  placeholderHero: {
    borderRadius: 22,
    padding: 36,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  placeholderHeroText: { fontSize: 15, fontWeight: '900' },

  // Info Card
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#eef2f7',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
    gap: 14,
  },
  titlePriceRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  mainTitle: { fontSize: 21, fontWeight: '900', color: '#0f172a', textAlign: 'right', lineHeight: 28 },
  subCategoryText: { fontSize: 12.5, color: '#64748b', textAlign: 'right', fontWeight: '700' },
  mainPrice: { fontSize: 24, fontWeight: '900', color: '#059669', textAlign: 'left' },
  priceTypePill: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  priceTypePillText: { color: '#047857', fontSize: 11, fontWeight: '800' },

  badgesRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
  },
  statusBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
  },
  statusBadgeOpen: { backgroundColor: '#dcfce7' },
  statusBadgeClosed: { backgroundColor: '#fee2e2' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusBadgeText: { fontSize: 11.5, fontWeight: '800' },
  locationBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  locationBadgeText: { fontSize: 11.5, fontWeight: '700', color: '#334155' },
  timeBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
  },
  timeBadgeText: { fontSize: 11, fontWeight: '600', color: '#64748b' },

  // Trust Banner
  trustBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 18,
    padding: 14,
  },
  trustIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustTitle: { fontSize: 13.5, fontWeight: '900', color: '#166534', textAlign: 'right' },
  trustDesc: { fontSize: 11.5, color: '#15803d', lineHeight: 17, textAlign: 'right' },

  // Seller Card
  sellerCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#eef2f7',
  },
  sellerAvatar: { width: 48, height: 48, borderRadius: 24 },
  sellerAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerAvatarLetter: { fontSize: 18, fontWeight: '900', color: '#047857' },
  sellerName: { fontSize: 15, fontWeight: '900', color: '#0f172a' },
  sellerSub: { fontSize: 11.5, color: '#64748b', fontWeight: '600' },
  sellerActionBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  sellerActionBtnText: { fontSize: 11.5, fontWeight: '800', color: '#059669' },

  // Section Cards
  sectionCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#eef2f7',
    gap: 10,
  },
  sectionCardTitle: { fontSize: 15, fontWeight: '900', color: '#0f172a', textAlign: 'right' },
  sectionCardDesc: { fontSize: 13.5, color: '#334155', lineHeight: 22, textAlign: 'right' },

  // Delivery Modes
  modesContainer: { gap: 8 },
  deliveryModeRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  deliveryModeEmojiBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  deliveryModeLabel: { fontSize: 13, fontWeight: '800', color: '#0f172a' },
  deliveryModeSub: { fontSize: 11.5, color: '#64748b', marginTop: 1 },

  // Specs List
  specsList: { gap: 6 },
  specRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  specLabel: { fontSize: 12.5, color: '#64748b', fontWeight: '700' },
  specVal: { fontSize: 13, color: '#0f172a', fontWeight: '800', textAlign: 'left' },

  // Owner Box
  ownerBox: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    alignItems: 'flex-end',
    gap: 6,
  },
  ownerBoxTitle: { fontSize: 14, fontWeight: '900', color: '#059669' },
  ownerBoxDesc: { fontSize: 12, color: '#64748b' },
  ownerDeleteBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fee2e2',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    marginTop: 6,
  },
  ownerDeleteBtnText: { color: '#dc2626', fontSize: 12.5, fontWeight: '800' },

  // Related
  relatedBox: { gap: 10, marginTop: 4 },
  relatedHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  relatedTitle: { fontSize: 15, fontWeight: '900', color: '#0f172a' },
  relatedSeeAll: { fontSize: 12, fontWeight: '800', color: '#059669' },
  relatedRow: { flexDirection: 'row-reverse', gap: 10 },
  relatedCard: {
    width: 145,
    backgroundColor: '#fff',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  relatedImgBox: { width: '100%', height: 95, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  relatedInfo: { padding: 8, gap: 2 },
  relatedName: { fontSize: 12, fontWeight: '800', color: '#0f172a', textAlign: 'right' },
  relatedPrice: { fontSize: 12, fontWeight: '900', color: '#059669', textAlign: 'right' },

  // Sticky Bottom Bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingVertical: 10,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 8,
  },
  bottomBarInner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
  },
  barWaBtn: {
    flex: 2,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#25D366',
    borderRadius: 14,
    paddingVertical: 13,
    shadowColor: '#25D366',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  barWaBtnText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  barPhoneBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 14,
    paddingVertical: 13,
  },
  barPhoneBtnText: { color: '#0284c7', fontSize: 13, fontWeight: '800' },
  barMsgBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 14,
    paddingVertical: 13,
  },
  barMsgBtnText: { color: '#059669', fontSize: 13, fontWeight: '800' },

  // Lightbox
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
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
  modalImage: { width: '92%', height: '80%' },
});
