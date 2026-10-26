import { OasisPressable as Pressable, OasisTextInput as TextInput, OasisSurface } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import { HeaderAction, AppHeader } from '@/components/shared/AppHeader';
import { useEffect, useState, useMemo } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View, ActivityIndicator, Platform, Image, Modal, Share, Linking, useWindowDimensions, KeyboardAvoidingView } from 'react-native';
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
  Pencil,
  GraduationCap,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getListingType, getDeliveryMode, formatServicePrice } from '@/lib/serviceTypes';
import { relativeTime } from '@/lib/mapPins';
import { useBottomNavInset } from '@/lib/bottomNav';
import { AccountIdentityBadge } from '@/components/profile/AccountIdentityBadge';

export default function Service() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const bottomNavInset = useBottomNavInset();
  const [service, setService] = useState<any>(null);
  const [provider, setProvider] = useState<any>(null);
  const [business, setBusiness] = useState<any>(null);
  const [related, setRelated] = useState<any[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [contacting, setContacting] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingService, setDeletingService] = useState(false);

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
              .select('id, display_name, username, avatar_url, is_verified, is_geoverified, account_type, freelance_trade, role, city, district, created_at')
              .eq('id', s.provider_id)
              .maybeSingle();
            setProvider(p);
          }

          if (s.business_id) {
            const { data: b } = await supabase.from('businesses')
              .select('id,name,logo_url,is_verified,city,district')
              .eq('id', s.business_id).maybeSingle();
            setBusiness(b || null);
          } else {
            setBusiness(null);
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


  const MAX_EDITS = 2;

  function handleOpenEdit() {
    const svc = service;
    if (!svc || !me || me !== svc.provider_id) return;
    const ec = svc.edit_count || 0;
    const remaining = Math.max(0, MAX_EDITS - ec);
    if (remaining <= 0) {
      Alert.alert('استنفاد محاولات التعديل ⚠️', 'تم استنفاد الحد الأقصى المسموح للتعديل (محاولتان فقط).');
      return;
    }
    setEditName(svc.name || '');
    setEditDescription(svc.description || '');
    setIsEditModalOpen(true);
  }

  async function handleSaveEdit() {
    if (!editName.trim()) return Alert.alert('بيانات ناقصة', 'يرجى كتابة اسم العرض.');
    const ec = service?.edit_count || 0;
    const remaining = Math.max(0, MAX_EDITS - ec);
    if (remaining <= 0) return Alert.alert('تنبيه', 'تم استنفاد الحد الأقصى للتعديل.');
    setSavingEdit(true);
    try {
      const nextEditCount = ec + 1;
      const { error } = await supabase.from('services').update({
        name: editName.trim(),
        description: editDescription.trim() || null,
        edit_count: nextEditCount,
        updated_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) throw error;
      setIsEditModalOpen(false);
      Alert.alert('تم حفظ التعديل بنجاح ✅', `متبقي لك ${MAX_EDITS - nextEditCount} من أصل ${MAX_EDITS} محاولات تعديل.`);
      const { data: updated } = await supabase.from('services').select('*').eq('id', id).single();
      if (updated) setService(updated);
    } catch (err: any) {
      Alert.alert('خطأ', err?.message || 'تعذر تعديل العرض.');
    } finally {
      setSavingEdit(false);
    }
  }

  async function remove() {
    if (!me || me !== service?.provider_id) {
      return Alert.alert('تنبيه', 'يمكن لمالك العرض فقط حذفه.');
    }
    Alert.alert('تأكيد الحذف ⚠️', 'هل أنت متأكد من حذف هذا العرض نهائياً من سوق الحي؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف العرض',
        style: 'destructive',
        onPress: async () => {
          setDeletingService(true);
          const r = await supabase.from('services').delete().eq('id', id);
          if (r.error) { Alert.alert('خطأ', r.error.message); setDeletingService(false); }
          else { Alert.alert('تم بنجاح', 'تم حذف العرض بنجاح.'); router.replace('/market'); }
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

      const { data: convId, error: conversationError } = await supabase.rpc('hayna_get_or_create_direct_conversation', { p_target: providerId });
      if (conversationError || !convId) throw conversationError || new Error('تعذر إنشاء المحادثة.');

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
        <ActivityIndicator size="large" color={OASIS.colors.primary} />
        <Text style={styles.loadingText}>جاري تجهيز تفاصيل العرض من الحي...</Text>
      </View>
    );
  }

  if (!service) {
    return (
      <View style={styles.center}>
        <AlertCircle size={48} color={OASIS.colors.danger} />
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
  const detailKeyLabels: Record<string, { label: string; Icon: typeof Info }> = {
    preorder: { label: 'حالة التوفر والطلب', Icon: Clock },
    quantity: { label: 'الكمية المتاحة', Icon: PackageCheck },
    condition: { label: 'حالة السلعة', Icon: Sparkles },
    warranty: { label: 'الضمان والموثوقية', Icon: ShieldCheck },
    experience: { label: 'سنوات الخبرة', Icon: Award },
    delivery_time: { label: 'مدة التسليم المتوقعة', Icon: Clock },
    level: { label: 'المرحلة التعليمية', Icon: GraduationCap },
    range: { label: 'نطاق الخدمة والتغطية', Icon: MapPin },
    map_link: { label: 'رابط الخريطة', Icon: MapPin },
  };

  const extraEntries = Object.entries(details).filter(([_, v]) => Boolean(v && String(v).trim()));
  const timeAgoText = relativeTime(service.created_at);

  return (
    <View style={styles.container}>
      <AppHeader
        variant="sub"
        title={service.name}
        subtitle={[service.city, service.district ? `حي ${service.district}` : null].filter(Boolean).join(' · ')}
        fallbackRoute="/market"
        rightAction={
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
            <HeaderAction
              accessibilityLabel="مشاركة العرض" onPress={shareOffer}
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: '#f1f5f9',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {copiedLink ? <Check size={16} color={OASIS.colors.primary} /> : <Share2 size={16} color={OASIS.colors.muted} />}
            </HeaderAction>
            <HeaderAction
              accessibilityLabel="الإبلاغ عن العرض" onPress={() => router.push({ pathname: '/report', params: { type: 'service', id: service.id } })}
              style={{
                width: 34,
                height: 34,
                borderRadius: 17,
                backgroundColor: '#f1f5f9',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Flag size={15} color={OASIS.colors.muted} />
            </HeaderAction>
          </View>
        }
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomNavInset + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.bodyWrap}>
          {/* 1. HERO MEDIA GALLERY */}
          {images.length > 0 ? (
            <OasisSurface oasisSurface="card" style={styles.galleryCard}>
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
                  <View style={[styles.galleryTypePill, { backgroundColor: type.color || OASIS.colors.primary }]}>
                    <Text style={styles.galleryTypePillText}>{type.short || type.label}</Text>
                  </View>
                )}
                <View style={styles.imageCounter}>
                  <Maximize2 size={11} color={OASIS.colors.surface} />
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
            </OasisSurface>
          ) : (
            <View style={[styles.placeholderHero, { backgroundColor: type?.bg || OASIS.colors.soft }]}>
              {type ? (
                <type.Icon size={48} color={type.color || OASIS.colors.primary} />
              ) : (
                <Store size={48} color={OASIS.colors.primary} />
              )}
              <Text style={[styles.placeholderHeroText, { color: type?.color || OASIS.colors.primary }]}>
                {type?.label || 'عرض وسلعة من الحي'}
              </Text>
            </View>
          )}

          {/* 2. PRIMARY OFFERING INFO CARD */}
          <OasisSurface oasisSurface="card" style={styles.infoCard}>
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
                <View style={[styles.statusDot, { backgroundColor: service.available_now ? OASIS.colors.primary : OASIS.colors.danger }]} />
                <Text style={[styles.statusBadgeText, { color: service.available_now ? '#15803d' : OASIS.colors.danger }]}>
                  {service.available_now ? 'متاح للطلب الآن' : 'غير متوفر حالياً'}
                </Text>
              </View>

              <Pressable
                style={styles.locationBadge}
                onPress={() => router.push({ pathname: '/map', params: { city: service.city, district: service.district } })}
              >
                <MapPin size={13} color={OASIS.colors.primary} />
                <Text style={styles.locationBadgeText}>
                  {service.city || 'المدينة'}{service.district ? ` · حي ${service.district}` : ''}
                </Text>
              </Pressable>

              {timeAgoText && (
                <View style={styles.timeBadge}>
                  <Clock size={12} color={OASIS.colors.muted} />
                  <Text style={styles.timeBadgeText}>{timeAgoText}</Text>
                </View>
              )}
            </View>
          </OasisSurface>

          {/* 3. NEIGHBORHOOD TRUST & SAFETY BANNER */}
          <View style={styles.trustBanner}>
            <View style={styles.trustIconCircle}>
              <BadgeCheck size={22} color={OASIS.colors.primary} />
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end', gap: 2 }}>
              <Text style={styles.trustTitle}>معاملة مباشرة وموثوقة بين الجيران</Text>
              <Text style={styles.trustDesc}>
                هذا العرض منشور من أحد سكان {service.city ? `مدينة ${service.city}` : 'الحي'}{service.district ? ` (حي ${service.district})` : ''}. يتم الفحص والاستلام مباشرة باليد أو التوصيل بالاتفاق.
              </Text>
            </View>
          </View>

          {/* 4. BUSINESS + PROVIDER IDENTITY */}
          {business && (
            <Pressable oasisKind="card"
              style={[styles.sellerCard, { borderColor: '#fde68a', backgroundColor: OASIS.colors.warningSoft }]}
              onPress={() => router.push({ pathname: '/business', params: { id: business.id } })}
            >
              <View style={styles.sellerActionBtn}>
                <Text style={[styles.sellerActionBtnText, { color: '#b7791f' }]}>المنشأة</Text>
                <ChevronLeft size={14} color="#b7791f" />
              </View>
              <View style={{ flex: 1, alignItems: 'flex-end', gap: 3 }}>
                <Text style={[styles.sellerName, { color: '#78350f' }]}>{business.name}</Text>
                <Text style={styles.sellerSub}>{business.is_verified ? 'منشأة موثقة مرتبطة بصاحب الخدمة' : 'منشأة مرتبطة بالخدمة'}</Text>
              </View>
              <View style={[styles.sellerAvatarPlaceholder, { backgroundColor: '#fff7ed' }]}>
                <Store size={20} color="#b7791f" />
              </View>
            </Pressable>
          )}

          {provider && (
            <Pressable oasisKind="card"
              style={styles.sellerCard}
              onPress={() => router.push({ pathname: '/user', params: { id: provider.id } })}
            >
              <View style={styles.sellerActionBtn}>
                <Text style={styles.sellerActionBtnText}>عرض الملف</Text>
                <ChevronLeft size={14} color={OASIS.colors.primary} />
              </View>

              <View style={{ flex: 1, alignItems: 'flex-end', gap: 4 }}>
                <Text style={styles.sellerName}>
                  {provider.account_type === 'merchant' && provider.freelance_trade
                    ? provider.freelance_trade
                    : provider.display_name || `@${provider.username || 'أحد الجيران'}`}
                </Text>
                <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 4 }}>
                  <AccountIdentityBadge role={provider.role} accountType={provider.account_type} isVerified={Boolean(provider.is_verified)} compact />
                </View>
                <Text style={styles.sellerSub}>
                  {provider.district ? `حي ${provider.district}` : 'مقدم الخدمة'}
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

          {!isOwner && (
            <OasisSurface oasisSurface="card" style={styles.inlineContactCard}>
              <Text style={styles.inlineContactTitle}>التواصل مع صاحب العرض</Text>
              <View style={styles.inlineContactActions}>
                <Pressable oasisKind="action" style={styles.inlineMessageBtn} onPress={contactProvider} disabled={contacting}>
                  {contacting ? <ActivityIndicator size="small" color={OASIS.colors.surface} /> : <MessageSquare size={16} color={OASIS.colors.surface} />}
                  <Text style={styles.inlineMessageText}>رسالة داخل التطبيق</Text>
                </Pressable>
                {Boolean(service.whatsapp || service.phone) && <Pressable oasisKind="action" style={styles.inlineWhatsAppBtn} onPress={openWhatsApp}><MessageCircle size={16} color={OASIS.colors.primary} /><Text style={styles.inlineWhatsAppText}>واتساب</Text></Pressable>}
                {Boolean(service.phone || service.whatsapp) && <Pressable oasisKind="action" style={styles.inlinePhoneBtn} onPress={callPhone}><Phone size={16} color="#0369a1" /><Text style={styles.inlinePhoneText}>اتصال</Text></Pressable>}
              </View>
            </OasisSurface>
          )}

          {/* 5. DESCRIPTION */}
          <OasisSurface oasisSurface="card" style={styles.sectionCard}>
            <Text style={styles.sectionCardTitle}>تفاصيل ووصف العرض</Text>
            <Text style={styles.sectionCardDesc}>{service.description || 'لا يوجد وصف مفصل لهذا العرض.'}</Text>
          </OasisSurface>

          {/* 6. DELIVERY & RECEIPT MODES */}
          {modes.length > 0 && (
            <OasisSurface oasisSurface="card" style={styles.sectionCard}>
              <View style={styles.sectionTitleWithIcon}><Truck size={17} color={OASIS.colors.primary} /><Text style={styles.sectionCardTitle}>طرق الاستلام والتسليم المتاحة</Text></View>
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
                        {m === 'delivery' ? <Truck size={18} color={OASIS.colors.primary} /> : m === 'remote' ? <ExternalLink size={18} color={OASIS.colors.primary} /> : m === 'home_visit' ? <User size={18} color={OASIS.colors.primary} /> : m === 'at_shop' ? <Store size={18} color={OASIS.colors.primary} /> : <PackageCheck size={18} color={OASIS.colors.primary} />}
                      </View>
                      <View style={{ flex: 1, alignItems: 'flex-end' }}>
                        <Text style={styles.deliveryModeLabel}>{mode.label}</Text>
                        <Text style={styles.deliveryModeSub}>{descriptions[m] || 'متاح بالاتفاق'}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </OasisSurface>
          )}

          {/* 7. SPECIFICATIONS & DETAILS */}
          <OasisSurface oasisSurface="card" style={styles.sectionCard}>
            <Text style={styles.sectionCardTitle}>بيانات ومواصفات إضافية</Text>
            <View style={styles.specsList}>
              <View style={styles.specRow}>
                <Text style={styles.specVal}>{service.subcategory || service.category || type?.label || 'عام'}</Text>
                <Text style={styles.specLabel}>التصنيف الأساسي:</Text>
              </View>

              {service.shop_name && (
                <View style={styles.specRow}>
                  <View style={styles.specValueWithIcon}><Store size={14} color={OASIS.colors.muted} /><Text style={styles.specVal}>{service.shop_name}</Text></View>
                  <Text style={styles.specLabel}>المتجر / المحل:</Text>
                </View>
              )}

              {service.working_hours && (
                <View style={styles.specRow}>
                  <View style={styles.specValueWithIcon}><Clock size={14} color={OASIS.colors.muted} /><Text style={styles.specVal}>{service.working_hours}</Text></View>
                  <Text style={styles.specLabel}>أوقات التواجد والعمل:</Text>
                </View>
              )}

              {extraEntries.map(([k, v]) => {
                const meta = detailKeyLabels[k] || { label: k, Icon: Info };
                if (k === 'map_link') {
                  return (
                    <View key={k} style={styles.specRow}>
                      <Pressable onPress={() => Linking.openURL(v).catch(() => {})}>
                        <Text style={[styles.specVal, { color: OASIS.colors.info, textDecorationLine: 'underline' }]}>
                          فتح في خرائط Google
                        </Text>
                      </Pressable>
                      <Text style={styles.specLabel}>{meta.label}:</Text>
                    </View>
                  );
                }
                return (
                  <View key={k} style={styles.specRow}>
                    <View style={styles.specValueWithIcon}><meta.Icon size={14} color={OASIS.colors.muted} /><Text style={styles.specVal}>{v}</Text></View>
                    <Text style={styles.specLabel}>{meta.label}:</Text>
                  </View>
                );
              })}

              <View style={styles.specRow}>
                <Pressable
                  onPress={() => router.push({ pathname: '/map', params: { city: service.city, district: service.district } })}
                  style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }}
                >
                  <Text style={[styles.specVal, { color: OASIS.colors.primary, textDecorationLine: 'underline' }]}>
                    {service.city || ''} {service.district ? `· حي ${service.district}` : ''}
                  </Text>
                </Pressable>
                <Text style={styles.specLabel}>الموقع المحدد:</Text>
              </View>
            </View>
          </OasisSurface>

          {/* 8. OWNER MANAGEMENT (IF VIEWER IS OWNER) */}
          {isOwner && (
            <View style={styles.ownerBox}>
              <View style={styles.ownerBoxHeaderRow}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={18} color={OASIS.colors.primary} />
                  <Text style={styles.ownerBoxTitle}>أنت صاحب هذا العرض</Text>
                </View>
                <View style={[(service?.edit_count || 0) >= MAX_EDITS ? styles.editLimitBadgeExpired : styles.editLimitBadgeActive, styles.editLimitBadgeBase]}>
                  <Text style={(service?.edit_count || 0) >= MAX_EDITS ? styles.editLimitBadgeTextExpired : styles.editLimitBadgeTextActive}>
                    {Math.max(0, MAX_EDITS - (service?.edit_count || 0))}/{MAX_EDITS} محاولات تعديل
                  </Text>
                </View>
              </View>
              <Text style={styles.ownerBoxDesc}>يمكنك تعديل أو حذف هذا العرض في أي وقت.</Text>

              <View style={styles.ownerActionsRow}>
                <Pressable oasisKind="action"
                  style={[styles.ownerEditBtn, (service?.edit_count || 0) >= MAX_EDITS && styles.ownerEditBtnDisabled]}
                  onPress={handleOpenEdit}
                  disabled={(service?.edit_count || 0) >= MAX_EDITS}
                >
                  <Pencil size={15} color={(service?.edit_count || 0) >= MAX_EDITS ? '#94a3b8' : OASIS.colors.primary} />
                  <Text style={[(service?.edit_count || 0) >= MAX_EDITS ? styles.ownerEditBtnTextDisabled : styles.ownerEditBtnText]}>
                    {(service?.edit_count || 0) >= MAX_EDITS ? 'انتهت محاولات التعديل' : 'تعديل العرض'}
                  </Text>
                </Pressable>

                <Pressable oasisKind="action"
                  style={[styles.ownerDeleteBtn, deletingService && { opacity: 0.6 }]}
                  onPress={remove}
                  disabled={deletingService}
                >
                  {deletingService ? (
                    <ActivityIndicator size="small" color={OASIS.colors.danger} />
                  ) : (
                    <>
                      <Trash2 size={15} color={OASIS.colors.danger} />
                      <Text style={styles.ownerDeleteBtnText}>حذف العرض</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          )}

          {/* 9. RELATED OFFERS */}
          {related.length > 0 && (
            <View style={styles.relatedBox}>
              <View style={styles.relatedHead}>
                <Pressable onPress={() => router.push('/market')}>
                  <Text style={styles.relatedSeeAll}>تصفح كل السوق</Text>
                </Pressable>
                <Text style={styles.relatedTitle}>عروض أخرى من الحي</Text>
              </View>
              <ScrollView style={{ direction: 'rtl' }} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.relatedRow, { direction: 'ltr' }]}>
                {related.map((rel) => {
                  const cover = rel.cover_url || (Array.isArray(rel.images) && rel.images[0]);
                  return (
                    <Pressable oasisKind="card"
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

      {/* Fullscreen Lightbox Modal */}
      <Modal visible={Boolean(fullscreenImage)} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <Pressable oasisKind="icon" style={styles.modalCloseBtn} onPress={() => setFullscreenImage(null)}>
            <X size={26} color={OASIS.colors.surface} />
          </Pressable>
          {fullscreenImage && (
            <Image source={{ uri: fullscreenImage }} style={styles.modalImage} resizeMode="contain" />
          )}
        </View>
      </Modal>

      {/* Edit Service Modal */}
      <Modal
        visible={isEditModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsEditModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.editModalOverlay}
        >
          <OasisSurface oasisSurface="card" style={styles.editModalCard}>
            <View style={styles.editModalHeader}>
              <View>
                <Text style={styles.editModalTitle}>تعديل العرض</Text>
                <Text style={styles.editModalSubtitle}>
                  محاولة {(service?.edit_count || 0) + 1} من {MAX_EDITS} (متبقي بعدها {Math.max(0, MAX_EDITS - ((service?.edit_count || 0) + 1))})
                </Text>
              </View>
              <Pressable oasisKind="icon"
                style={styles.editModalCloseBtn}
                onPress={() => setIsEditModalOpen(false)}
                disabled={savingEdit}
              >
                <X size={18} color={OASIS.colors.muted} />
              </Pressable>
            </View>

            <View style={styles.editModalBody}>
              <Text style={styles.editModalLabel}>اسم العرض</Text>
              <TextInput
                style={styles.editModalInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="اسم العرض في سوق الحي..."
                placeholderTextColor="#94a3b8"
                textAlign="right"
                maxLength={120}
              />

              <Text style={styles.editModalLabel}>وصف العرض (اختياري)</Text>
              <TextInput
                style={[styles.editModalInput, styles.editModalTextArea]}
                value={editDescription}
                onChangeText={setEditDescription}
                placeholder="وصف مختصر للعرض والخدمة المقدمة..."
                placeholderTextColor="#94a3b8"
                textAlign="right"
                multiline
                numberOfLines={4}
                maxLength={500}
              />

              <View style={styles.editWarningBox}>
                <Info size={14} color="#d97706" />
                <Text style={styles.editWarningText}>
                  تنبيه: يُسمح بتعديل العرض مرتين كحد أقصى حفاظاً على مصداقية العروض في سوق الحي.
                </Text>
              </View>
            </View>

            <View style={styles.editModalFooter}>
              <Pressable oasisKind="action"
                style={[styles.editModalCancelBtn, savingEdit && { opacity: 0.6 }]}
                onPress={() => setIsEditModalOpen(false)}
                disabled={savingEdit}
              >
                <Text style={styles.editModalCancelBtnText}>إلغاء</Text>
              </Pressable>
              <Pressable oasisKind="action"
                style={[styles.editModalSubmitBtn, (!editName.trim() || savingEdit) && styles.editModalSubmitBtnDisabled]}
                onPress={handleSaveEdit}
                disabled={!editName.trim() || savingEdit}
              >
                {savingEdit ? (
                  <ActivityIndicator size="small" color={OASIS.colors.surface} />
                ) : (
                  <Text style={styles.editModalSubmitBtnText}>حفظ التعديلات</Text>
                )}
              </Pressable>
            </View>
          </OasisSurface>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: OASIS.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: OASIS.colors.background },
  loadingText: { color: OASIS.colors.muted, fontSize: 14, marginTop: 12, fontWeight: '700' },
  errorText: { color: OASIS.colors.ink, fontSize: 16, fontWeight: '700', marginTop: 12, marginBottom: 16 },
  backBtnAction: { backgroundColor: OASIS.colors.primary, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 14 },
  backBtnActionText: { color: OASIS.colors.surface, fontWeight: '700' },

  // Navbar
  topNavbar: {
    backgroundColor: OASIS.colors.surface,
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
    fontWeight: '700',
    color: OASIS.colors.ink,
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
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: OASIS.colors.line,
    shadowColor: '#000',
    shadowOpacity: 0,
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
    shadowOpacity: 0,
    shadowRadius: 4,
    elevation: 2,
  },
  galleryTypePillText: {
    color: OASIS.colors.surface,
    fontSize: 11,
    fontWeight: '700',
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
  imageCounterText: { color: OASIS.colors.surface, fontSize: 11, fontWeight: '700' },
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
  dotActive: { backgroundColor: OASIS.colors.surface, width: 18 },

  placeholderHero: {
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: OASIS.colors.line,
  },
  placeholderHeroText: { fontSize: 15, fontWeight: '700' },

  // Info Card
  infoCard: {
    backgroundColor: OASIS.colors.surface,
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#eef2f7',
    shadowColor: '#000',
    shadowOpacity: 0,
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
  mainTitle: { fontSize: 21, fontWeight: '700', color: OASIS.colors.ink, textAlign: 'right', lineHeight: 28 },
  subCategoryText: { fontSize: 12.5, color: OASIS.colors.muted, textAlign: 'right', fontWeight: '700' },
  mainPrice: { fontSize: 24, fontWeight: '700', color: OASIS.colors.primary, textAlign: 'left' },
  priceTypePill: {
    backgroundColor: OASIS.colors.soft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  priceTypePillText: { color: OASIS.colors.primary, fontSize: 11, fontWeight: '600' },

  badgesRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: OASIS.colors.background,
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
  statusBadgeText: { fontSize: 11.5, fontWeight: '600' },
  locationBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  locationBadgeText: { fontSize: 11.5, fontWeight: '700', color: OASIS.colors.ink },
  timeBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: OASIS.colors.background,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
  },
  timeBadgeText: { fontSize: 11, fontWeight: '600', color: OASIS.colors.muted },

  // Trust Banner
  trustBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    backgroundColor: OASIS.colors.soft,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 14,
    padding: 14,
  },
  trustIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustTitle: { fontSize: 13.5, fontWeight: '700', color: '#166534', textAlign: 'right' },
  trustDesc: { fontSize: 11.5, color: '#15803d', lineHeight: 17, textAlign: 'right' },

  // Seller Card
  sellerCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    backgroundColor: OASIS.colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#eef2f7',
  },
  sellerAvatar: { width: 48, height: 48, borderRadius: 24 },
  sellerAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: OASIS.colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sellerAvatarLetter: { fontSize: 18, fontWeight: '700', color: OASIS.colors.primary },
  sellerName: { fontSize: 15, fontWeight: '700', color: OASIS.colors.ink },
  sellerSub: { fontSize: 11.5, color: OASIS.colors.muted, fontWeight: '600' },
  sellerActionBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 2,
    backgroundColor: OASIS.colors.soft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  sellerActionBtnText: { fontSize: 11.5, fontWeight: '600', color: OASIS.colors.primary },

  // Section Cards
  sectionCard: {
    backgroundColor: OASIS.colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#eef2f7',
    gap: 10,
  },
  sectionCardTitle: { fontSize: 15, fontWeight: '700', color: OASIS.colors.ink, textAlign: 'right' },
  sectionCardDesc: { fontSize: 13.5, color: OASIS.colors.ink, lineHeight: 22, textAlign: 'right' },

  // Delivery Modes
  sectionTitleWithIcon: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  specValueWithIcon: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'flex-start' },
  inlineContactCard: { backgroundColor: OASIS.colors.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: OASIS.colors.line, gap: 10 },
  inlineContactTitle: { fontSize: 14, fontWeight: '700', color: OASIS.colors.ink, textAlign: 'right' },
  inlineContactActions: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  inlineMessageBtn: { flexGrow: 1, flexBasis: 140, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: OASIS.colors.primary, borderRadius: 11, paddingVertical: 11, paddingHorizontal: 12 },
  inlineMessageText: { color: OASIS.colors.surface, fontSize: 12, fontWeight: '700' },
  inlineWhatsAppBtn: { flexGrow: 1, flexBasis: 85, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: OASIS.colors.soft, borderRadius: 11, paddingVertical: 11, paddingHorizontal: 12 },
  inlineWhatsAppText: { color: OASIS.colors.primary, fontSize: 12, fontWeight: '600' },
  inlinePhoneBtn: { flexGrow: 1, flexBasis: 75, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: OASIS.colors.infoSoft, borderRadius: 11, paddingVertical: 11, paddingHorizontal: 12 },
  inlinePhoneText: { color: '#0369a1', fontSize: 12, fontWeight: '600' },
  modesContainer: { gap: 8 },
  deliveryModeRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    backgroundColor: OASIS.colors.background,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  deliveryModeEmojiBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: OASIS.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: OASIS.colors.line,
  },
  deliveryModeLabel: { fontSize: 13, fontWeight: '600', color: OASIS.colors.ink },
  deliveryModeSub: { fontSize: 11.5, color: OASIS.colors.muted, marginTop: 1 },

  // Specs List
  specsList: { gap: 6 },
  specRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: OASIS.colors.background,
  },
  specLabel: { fontSize: 12.5, color: OASIS.colors.muted, fontWeight: '700' },
  specVal: { fontSize: 13, color: OASIS.colors.ink, fontWeight: '600', textAlign: 'left' },

  // Owner Box
  ownerBox: {
    backgroundColor: OASIS.colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    alignItems: 'flex-end',
    gap: 6,
  },
  ownerBoxTitle: { fontSize: 14, fontWeight: '700', color: OASIS.colors.primary },
  ownerBoxDesc: { fontSize: 12, color: OASIS.colors.muted },
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
  ownerDeleteBtnText: { color: OASIS.colors.danger, fontSize: 12.5, fontWeight: '600' },

  // Related
  relatedBox: { gap: 10, marginTop: 4 },
  relatedHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  relatedTitle: { fontSize: 15, fontWeight: '700', color: OASIS.colors.ink },
  relatedSeeAll: { fontSize: 12, fontWeight: '600', color: OASIS.colors.primary },
  relatedRow: { flexDirection: 'row-reverse', gap: 10 },
  relatedCard: {
    width: 145,
    backgroundColor: OASIS.colors.surface,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: OASIS.colors.line,
  },
  relatedImgBox: { width: '100%', height: 95, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  relatedInfo: { padding: 8, gap: 2 },
  relatedName: { fontSize: 12, fontWeight: '600', color: OASIS.colors.ink, textAlign: 'right' },
  relatedPrice: { fontSize: 12, fontWeight: '700', color: OASIS.colors.primary, textAlign: 'right' },

  // Sticky Bottom Bar
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: OASIS.colors.surface,
    borderTopWidth: 1,
    borderTopColor: OASIS.colors.line,
    paddingVertical: 10,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOpacity: 0,
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
    shadowOpacity: 0,
    shadowRadius: 6,
    elevation: 3,
  },
  barWaBtnText: { color: OASIS.colors.surface, fontSize: 14, fontWeight: '700' },
  barPhoneBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: OASIS.colors.infoSoft,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 14,
    paddingVertical: 13,
  },
  barPhoneBtnText: { color: OASIS.colors.info, fontSize: 13, fontWeight: '600' },
  barMsgBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: OASIS.colors.soft,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 14,
    paddingVertical: 13,
  },
  barMsgBtnText: { color: OASIS.colors.primary, fontSize: 13, fontWeight: '600' },

  // Lightbox
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' },
  modalCloseBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 30,
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalImage: { width: '92%', height: '80%' },

  // Owner Management Box
  ownerBoxHeaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ownerActionsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  ownerEditBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: OASIS.colors.soft,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  ownerEditBtnText: { fontSize: 13, fontWeight: '600', color: OASIS.colors.primary },
  ownerEditBtnDisabled: { backgroundColor: '#f1f5f9', borderColor: OASIS.colors.line },
  ownerEditBtnTextDisabled: { fontSize: 13, fontWeight: '600', color: '#94a3b8' },

  // Edit limit badges
  editLimitBadgeBase: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1 },
  editLimitBadgeActive: { backgroundColor: OASIS.colors.soft, borderColor: '#a7f3d0' },
  editLimitBadgeExpired: { backgroundColor: OASIS.colors.dangerSoft, borderColor: '#fecaca' },
  editLimitBadgeTextActive: { fontSize: 11, fontWeight: '700', color: OASIS.colors.primary },
  editLimitBadgeTextExpired: { fontSize: 11, fontWeight: '700', color: OASIS.colors.danger },

  // Edit modal
  editModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  editModalCard: {
    backgroundColor: OASIS.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 14,
    gap: 16,
    maxHeight: '90%',
  },
  editModalHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  editModalTitle: { fontSize: 17, fontWeight: '700', color: OASIS.colors.ink, textAlign: 'right' },
  editModalSubtitle: { fontSize: 12, color: OASIS.colors.primary, fontWeight: '700', textAlign: 'right', marginTop: 2 },
  editModalCloseBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center',
  },
  editModalBody: { gap: 10 },
  editModalLabel: { fontSize: 12.5, fontWeight: '600', color: OASIS.colors.ink, textAlign: 'right' },
  editModalInput: {
    backgroundColor: OASIS.colors.background,
    borderWidth: 1.5, borderColor: OASIS.colors.line,
    borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 10,
    fontSize: 14, color: OASIS.colors.ink, textAlign: 'right',
  },
  editModalTextArea: { minHeight: 100, textAlignVertical: 'top' },
  editWarningBox: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 8,
    backgroundColor: OASIS.colors.warningSoft, padding: 10,
    borderRadius: 12, borderWidth: 1, borderColor: '#fde68a',
  },
  editWarningText: {
    fontSize: 11.5, color: '#92400e', fontWeight: '700',
    flex: 1, textAlign: 'right', lineHeight: 17,
  },
  editModalFooter: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 10, paddingTop: 8,
  },
  editModalSubmitBtn: {
    flex: 2, backgroundColor: OASIS.colors.primary,
    paddingVertical: 12, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  editModalSubmitBtnDisabled: { backgroundColor: '#94a3b8', opacity: 0.6 },
  editModalSubmitBtnText: { color: OASIS.colors.surface, fontSize: 14, fontWeight: '700' },
  editModalCancelBtn: {
    flex: 1, backgroundColor: '#f1f5f9',
    paddingVertical: 12, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  editModalCancelBtnText: { color: OASIS.colors.muted, fontSize: 14, fontWeight: '600' },
});
