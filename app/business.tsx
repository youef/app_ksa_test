import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ArrowUpLeft, CalendarDays, ChevronDown, ChevronLeft, Clock3, ExternalLink, Flag, Globe, MapPin, MessageCircle, Phone, Send, Share2, ShieldCheck, Star, Store, Wrench } from 'lucide-react-native';
import { AppHeader, HeaderAction } from '@/components/shared/AppHeader';
import { OasisPressable as Pressable, OasisSurface, OasisTextInput as TextInput } from '@/components/oasis/OasisPrimitives';
import { ImagePreviewModal } from '@/components/shared/ImagePreviewModal';
import { OASIS, useTheme } from '@/lib/oasis';
import { supabase } from '@/lib/supabase';
import { getNeighborAccess } from '@/lib/neighborAccess';
import { businessOpening, businessPhone, businessWebsite, OpeningPeriod } from '@/lib/directoryPresentation';
import { BusinessSettingsSheet } from '@/components/market/BusinessSettingsSheet';
import { ProductEditorSheet } from '@/components/market/ProductEditorSheet';
import { ConfirmActionModal } from '@/components/shared/ConfirmActionModal';
import { productDisplayPrice } from '@/lib/productDetails';
import { Settings2, Plus, ShoppingBag, Archive, RotateCcw, Pencil } from 'lucide-react-native';
import { useBottomNavInset } from '@/lib/bottomNav';

const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const PAGE = 12;
const dateText = (date: string) => new Date(date).toLocaleDateString('ar-SA', { timeZone: 'Asia/Riyadh', year: 'numeric', month: 'short', day: 'numeric' });
export default function Business() {
  useTheme();
  const { id } = useLocalSearchParams<{ id: string }>(), c = OASIS.colors, bottom = useBottomNavInset(24);
  const [business, setBusiness] = useState<any>(null), [owner, setOwner] = useState<any>(null), [me, setMe] = useState<string | null>(null), [canMessage, setCanMessage] = useState(false);
  const [loading, setLoading] = useState(true), [refreshing, setRefreshing] = useState(false), [error, setError] = useState(''), [contactBusy, setContactBusy] = useState(false);
  const [periods, setPeriods] = useState<OpeningPeriod[]>([]), [hoursError, setHoursError] = useState(false), [hoursExpanded, setHoursExpanded] = useState(false), [now, setNow] = useState(new Date());
  const [reviews, setReviews] = useState<any[]>([]), [reviewCount, setReviewCount] = useState(0), [average, setAverage] = useState(0), [mine, setMine] = useState(false), [reviewsError, setReviewsError] = useState(false), [moreBusy, setMoreBusy] = useState(false);
  const [services, setServices] = useState<any[]>([]), [servicesError, setServicesError] = useState(false);
  const [rating, setRating] = useState(0), [body, setBody] = useState(''), [submitting, setSubmitting] = useState(false), [reviewError, setReviewError] = useState(''), [success, setSuccess] = useState(false);
  const [preview, setPreview] = useState<{ uri: string; title: string } | null>(null), [failedCover, setFailedCover] = useState(false), [failedLogo, setFailedLogo] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false), [canManage, setCanManage] = useState(false), [products, setProducts] = useState<any[]>([]), [productsError, setProductsError] = useState(false), [editingProduct, setEditingProduct] = useState<any>(null), [archiveConfirm, setArchiveConfirm] = useState(false), [archiveBusy, setArchiveBusy] = useState(false), [archiveError, setArchiveError] = useState(''), [managementNotice, setManagementNotice] = useState('');
  const request = useRef(0), reviewPage = useRef(0), saveLock = useRef(false), moreLock = useRef(false);

  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 30000); return () => clearInterval(timer); }, []);
  const load = useCallback(async (refresh = false) => {
    const ticket = ++request.current;
    setLoading(!refresh); setRefreshing(refresh); setError(''); setOwner(null); setCanMessage(false); setPreview(null); setCanManage(false); setSettingsOpen(false); setEditingProduct(null);
    if (!refresh) { setBusiness(null); setReviews([]); setServices([]); setPeriods([]); setMine(false); setReviewCount(0); setAverage(0); setReviewsError(false); setHoursError(false); setServicesError(false); setFailedCover(false); setFailedLogo(false); }
    setMoreBusy(false); moreLock.current = false; reviewPage.current = 0;
    try {
      if (!id) throw new Error('رابط المنشأة غير مكتمل.');
      const auth = await supabase.auth.getUser();
      if (ticket !== request.current) return;
      const userId = auth.data.user?.id || null; setMe(userId);
      let query = supabase.from('businesses').select('id,owner_id,name,description,city,district,address,phone,whatsapp,website,logo_url,cover_url,is_verified,moderation_status,archived_at,created_at').eq('id', id);
      query = userId ? query.or('moderation_status.eq.approved,owner_id.eq.' + userId) : query.eq('moderation_status', 'approved');
      const result = await query.maybeSingle();
      if (result.error) throw result.error;
      if (ticket !== request.current) return;
      const b = result.data; setBusiness(b);
      if (!b) return;
      const accessPromise = getNeighborAccess(b.owner_id).catch(() => null);
      let productQuery = supabase.from('marketplace_items').select('id,seller_id,business_id,title,description,price,item_type,status,city,district,region,image_url,created_at').eq('business_id', id).order('created_at',{ascending:false}).limit(24);
      if (b.owner_id !== userId) productQuery = productQuery.eq('status','available');
      const [hours, rows, summary, offers, ownReview, access, productRows, capability] = await Promise.all([
        supabase.from('business_hours').select('day_of_week,opens_at,closes_at,is_closed').eq('business_id', id).order('day_of_week').order('opens_at'),
        supabase.from('reviews').select('id,reviewer_id,rating,body,created_at').eq('business_id', id).order('created_at', { ascending: false }).order('id').range(0, PAGE - 1),
        supabase.from('reviews').select('rating', { count: 'exact' }).eq('business_id', id).order('created_at', { ascending: false }).order('id').limit(500),
        supabase.from('services').select('id,name,cover_url,subcategory,price_from,price_type').eq('business_id', id).eq('moderation_status', 'approved').order('created_at', { ascending: false }).limit(6),
        userId ? supabase.from('reviews').select('id').eq('business_id', id).eq('reviewer_id', userId).limit(1) : Promise.resolve({ data: [] }),
        accessPromise,
        productQuery,
        userId ? supabase.rpc('hayna_my_account_capabilities') : Promise.resolve({data:null}),
      ]);
      if (ticket !== request.current) return;
      setCanManage(b.owner_id === userId && capability.data?.can_manage_business === true);
      setProducts(productRows.data || []); setProductsError(!!productRows.error);
      setPeriods(hours.data || []); setHoursError(!!hours.error);
      setReviews(rows.data || []); setReviewsError(!!rows.error || !!summary.error || !!('error' in ownReview && ownReview.error));
      setReviewCount(summary.count || 0);
      const validRatings = (summary.data || []).filter(row => Number.isInteger(row.rating) && row.rating >= 1 && row.rating <= 5);
      setAverage(validRatings.length ? validRatings.reduce((sum, row) => sum + row.rating, 0) / validRatings.length : 0);
      setMine(!!ownReview.data?.length); setServices(offers.data || []); setServicesError(!!offers.error);
      setCanMessage(access?.can_message === true && b.owner_id !== userId);
      if (access?.can_view) {
        const profile = await supabase.from('profiles').select('id,display_name,username,avatar_url').eq('id', b.owner_id).maybeSingle();
        if (ticket === request.current) setOwner(profile.data);
      }
    } catch { if (ticket === request.current) setError('تعذر تحميل بيانات المنشأة. تحقق من اتصالك وأعد المحاولة.'); }
    finally { if (ticket === request.current) { setLoading(false); setRefreshing(false); } }
  }, [id]);
  useFocusEffect(useCallback(() => { void load(); return () => { request.current++; }; }, [load]));

  async function archiveBusiness() {
    if (archiveBusy || !business) return;
    setArchiveBusy(true); setArchiveError('');
    try {
      const auth=await supabase.auth.getUser(), uid=auth.data.user?.id;
      const cap=await supabase.rpc('hayna_my_account_capabilities');
      if(!uid||uid!==business.owner_id||cap.error||cap.data?.can_manage_business!==true)throw new Error('يلزم حساب مالك معتمد.');
      const result=await supabase.from('businesses').update({archived_at:business.archived_at?null:new Date().toISOString()}).eq('id',business.id).eq('owner_id',uid).select('id,archived_at,moderation_status').single();
      if(result.error||!result.data)throw new Error('لم يتم حفظ حالة المنشأة. تحقق من الاتصال والصلاحيات.');
      setArchiveConfirm(false);setManagementNotice(result.data.archived_at?'أُخفيت صفحة المنشأة من الدليل. بقيت المنتجات والطلبات محفوظة.':result.data.moderation_status==='approved'?'استعيدت صفحة المنشأة.':'أُعيدت المنشأة للمراجعة قبل إظهارها.');
      await load(true);
    }catch(cause){setArchiveError((cause as Error).message);}finally{setArchiveBusy(false);}
  }
  async function moreReviews() {
    if (moreLock.current || !id) return;
    moreLock.current = true; setMoreBusy(true); const ticket = request.current;
    try {
      const next = reviewPage.current + 1;
      const result = await supabase.from('reviews').select('id,reviewer_id,rating,body,created_at').eq('business_id', id).order('created_at', { ascending: false }).order('id').range(next * PAGE, (next + 1) * PAGE - 1);
      if (result.error) throw result.error;
      if (ticket !== request.current) return;
      setReviews(old => [...old, ...(result.data || [])].filter((row, index, all) => all.findIndex(other => other.id === row.id) === index)); reviewPage.current = next;
    } catch { if (ticket === request.current) Alert.alert('تعذر تحميل التقييمات', 'أعد المحاولة لاحقًا.'); }
    finally { if (ticket === request.current) { setMoreBusy(false); moreLock.current = false; } }
  }
  async function sendReview() {
    if (saveLock.current || !business || !id) return;
    if (!rating || body.trim().length > 1000) { setReviewError('اختر عدد النجوم، واكتب تعليقًا لا يتجاوز ١٠٠٠ حرف.'); return; }
    saveLock.current = true; setSubmitting(true); setReviewError('');
    try {
      const auth = await supabase.auth.getUser(), userId = auth.data.user?.id;
      if (!userId) { router.push('/auth'); return; }
      const [freshBusiness, existing] = await Promise.all([
        supabase.from('businesses').select('owner_id,moderation_status').eq('id', id).maybeSingle(),
        supabase.from('reviews').select('id').eq('business_id', id).eq('reviewer_id', userId).limit(1),
      ]);
      if (freshBusiness.error || existing.error) throw new Error('تعذر التحقق من أهلية التقييم. حاول لاحقًا.');
      if (!freshBusiness.data || freshBusiness.data.owner_id === userId || freshBusiness.data.moderation_status !== 'approved') throw new Error('لا يمكنك تقييم منشأتك أو منشأة غير معتمدة.');
      if (existing.data?.length) { setMine(true); throw new Error('سبق أن أضفت تقييمك لهذه المنشأة.'); }
      const result = await supabase.from('reviews').insert({ reviewer_id: userId, business_id: id, rating, body: body.trim() || null }).select('id').single();
      if (result.error || !result.data) throw new Error('لم يُحفظ التقييم. تحقق من الاتصال وأعد المحاولة.');
      setBody(''); setRating(0); setSuccess(true); await load(true);
    } catch (e) { setReviewError((e as Error).message || 'تعذر إرسال التقييم.'); }
    finally { saveLock.current = false; setSubmitting(false); }
  }
  async function message() {
    if (contactBusy || !business) return;
    setContactBusy(true);
    try {
      const access = await getNeighborAccess(business.owner_id); setCanMessage(access.can_message);
      if (!access.can_message) throw new Error('إعدادات الخاص أو نطاق الحي لا تسمح بالمراسلة.');
      const result = await supabase.rpc('hayna_get_or_create_direct_conversation', { p_target: business.owner_id });
      if (result.error || !result.data) throw new Error('تعذر فتح المحادثة.');
      router.push({ pathname: '/conversation', params: { id: result.data } });
    } catch (e) { Alert.alert('التواصل غير متاح', (e as Error).message); }
    finally { setContactBusy(false); }
  }
  const openLink = (url: string) => { void Linking.openURL(url).catch(() => Alert.alert('تعذر فتح الرابط', 'جرّب لاحقًا أو تحقق من توفر التطبيق المناسب.')); };
  const share = async () => { try { await Share.share({ message: business.name + '\nhttps://appksatest.vercel.app/business?id=' + encodeURIComponent(id || '') }); } catch { Alert.alert('المشاركة غير متاحة', 'أعد المحاولة من متصفح أو جهاز آخر.'); } };
  const own = !!me && business?.owner_id === me, opening = businessOpening(periods, now);
  const phone = businessPhone(business?.phone), whatsapp = businessPhone(business?.whatsapp), website = businessWebsite(business?.website);
  const area = [business?.district && 'حي ' + business.district, business?.city].filter(Boolean).join(' · ');
  const remaining = reviews.length < reviewCount;
  const section = (title: string, Icon: typeof Store) => <View style={s.sectionTitle}><Icon size={19} color={c.primary} /><Text style={[s.heading, { color: c.ink }]}>{title}</Text></View>;
  return <View style={s.screen}>
    <AppHeader variant="sub" title="تفاصيل المنشأة" subtitle={area} fallbackRoute="/directory" rightAction={business ? <HeaderAction accessibilityLabel="مشاركة المنشأة" onPress={() => void share()}><Share2 size={19} color={c.primary} /></HeaderAction> : undefined} />
    {loading ? <View style={s.state}><ActivityIndicator color={c.primary} size="large" /><Text style={[s.secondary, { color: c.muted }]}>جارٍ تحميل المنشأة…</Text></View> : error || !business ? <View style={s.state}><Store size={38} color={c.primary} /><Text style={[s.heading, { color: c.ink }]}>{error ? 'تعذر تحميل المنشأة' : 'المنشأة غير متاحة'}</Text><Text style={[s.secondary, { color: c.muted }]}>{error || 'قد تكون قيد المراجعة أو لم تعد متاحة للعرض.'}</Text><Pressable onPress={() => error ? void load() : router.replace('/directory')} style={[s.primary, { backgroundColor: c.primary }]}><Text style={s.white}>{error ? 'إعادة المحاولة' : 'العودة للدليل'}</Text></Pressable></View> :
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.page, { paddingBottom: bottom }]} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={c.primary} />}>
      <OasisSurface oasisSurface="card" style={[s.hero, { borderColor: c.line }]}>
        <Pressable disabled={!business.cover_url || failedCover} accessibilityRole="button" accessibilityLabel="عرض غلاف المنشأة" onPress={() => setPreview({ uri: business.cover_url, title: 'غلاف المنشأة' })} style={[s.cover, { backgroundColor: c.soft }]}>{business.cover_url && !failedCover ? <Image source={{ uri: business.cover_url }} style={s.image} resizeMode="cover" onError={() => setFailedCover(true)} /> : <View style={s.coverFallback}><Store size={48} color={c.primary} /><Text style={[s.coverCaption, { color: c.primary }]}>منشأة في مجتمع حيّنا</Text></View>}</Pressable>
        <View style={s.heroBody}>
          <View style={[s.row, { justifyContent: 'space-between' }]}><Pressable disabled={!business.logo_url || failedLogo} accessibilityRole="button" accessibilityLabel="عرض شعار المنشأة" onPress={() => setPreview({ uri: business.logo_url, title: 'شعار المنشأة' })} style={[s.logo, { backgroundColor: c.surface, borderColor: c.line }]}>{business.logo_url && !failedLogo ? <Image source={{ uri: business.logo_url }} style={s.image} resizeMode="contain" onError={() => setFailedLogo(true)} /> : <Store size={32} color={c.primary} />}</Pressable><View style={s.row}>{business.is_verified && <View style={[s.badge, { backgroundColor: c.soft }]}><ShieldCheck size={14} color={c.primary} /><Text style={[s.small, { color: c.primary }]}>منشأة موثّقة</Text></View>}{own && business.moderation_status !== 'approved' && <Text style={{ color: c.muted }}>قيد المراجعة</Text>}</View></View>
          <Text style={[s.name, { color: c.ink }]}>{business.name}</Text>
          {!!area && <View style={s.row}><MapPin size={14} color={c.muted} /><Text style={[s.secondary, { color: c.muted }]}>{area}</Text></View>}
          <View style={s.summary}><View style={[s.stat, { borderColor: c.line }]}><Star size={19} color="#D69D2F" fill={reviewCount ? '#D69D2F' : 'none'} /><Text style={[s.statNumber, { color: c.ink }]}>{reviewsError ? '—' : reviewCount ? average.toLocaleString('ar-SA', { maximumFractionDigits: 1, minimumFractionDigits: 1 }) : 'جديد'}</Text><Text style={[s.small, { color: c.muted }]}>{reviewCount > 500 ? 'متوسط أحدث ٥٠٠ تقييم' : 'متوسط التقييم'}</Text></View><View style={[s.stat, { borderColor: c.line }]}><MessageCircle size={19} color={c.primary} /><Text style={[s.statNumber, { color: c.ink }]}>{reviewsError ? '—' : reviewCount.toLocaleString('ar-SA')}</Text><Text style={[s.small, { color: c.muted }]}>تقييم من الجيران</Text></View><View style={[s.stat, { borderColor: c.line }]}><Clock3 size={19} color={c.primary} /><Text style={[s.statNumber, { color: c.ink, fontSize: 14 }]}>{hoursError || !opening.hasSchedule ? 'غير محدد' : opening.open ? 'مفتوح' : 'مغلق'}</Text><Text style={[s.small, { color: c.muted }]}>حسب جدول العمل</Text></View></View>
        </View>
      </OasisSurface>
      <OasisSurface oasisSurface="card" style={s.card}>{section('عن المنشأة', Store)}<Text style={[s.description, { color: c.ink }]}>{business.description?.trim() || 'لم تُضف المنشأة نبذة عن نشاطها بعد.'}</Text>{!!business.created_at && <View style={s.row}><CalendarDays size={14} color={c.muted} /><Text style={[s.small, { color: c.muted }]}>انضمت للدليل في {dateText(business.created_at)}</Text></View>}</OasisSurface>
      <OasisSurface oasisSurface="card" style={s.card}>{section('التواصل والموقع', MapPin)}
        <Text style={[s.secondary, { color: c.muted }]}>{business.address || area || 'لم يُضف عنوان عام بعد.'}</Text>
        <View style={s.actions}>
          {phone && <Action label="اتصال" Icon={Phone} onPress={() => openLink('tel:+' + phone)} />}
          {whatsapp && <Action label="واتساب" Icon={MessageCircle} onPress={() => openLink('https://wa.me/' + whatsapp)} />}
          {canMessage && <Action label={contactBusy ? 'جارٍ الفتح…' : 'مراسلة المالك'} Icon={Send} disabled={contactBusy} onPress={() => void message()} />}
          {website && <Action label="الموقع الإلكتروني" Icon={Globe} onPress={() => openLink(website)} />}
          {!!area && <Action label="بحث في الخرائط" Icon={ExternalLink} onPress={() => openLink('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent([business.name, business.city, business.district].filter(Boolean).join(' ')))} />}
        </View>
        <Text style={[s.small, { color: c.muted }]}>التواصل التجاري حسب البيانات التي نشرتها المنشأة. بحث الخرائط بالاسم والمنطقة ولا يمثل دبوسًا دقيقًا.</Text>
      </OasisSurface>
      <OasisSurface oasisSurface="card" style={s.card}>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: hoursExpanded }} onPress={() => setHoursExpanded(value => !value)} style={[s.row, { justifyContent: 'space-between', minHeight: 44 }]}>{section('أوقات العمل', Clock3)}<ChevronDown size={19} color={c.muted} /></Pressable>
        <Text style={[s.description, { color: hoursError || !opening.hasSchedule ? c.muted : opening.open ? c.primary : c.ink }]}>{hoursError ? 'تعذر تحميل أوقات العمل.' : !opening.hasSchedule ? 'لم تُضف المنشأة أوقات العمل بعد.' : opening.open ? 'مفتوح الآن حسب الجدول' : 'مغلق الآن حسب الجدول'}</Text>
        {opening.nextOpening && !hoursError && <Text style={[s.secondary, { color: c.muted }]}>الافتتاح القادم: {new Date(opening.nextOpening).toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh', weekday: 'long', hour: 'numeric', minute: '2-digit' })}</Text>}
        {hoursExpanded && !hoursError && DAYS.map((day, index) => { const rows = periods.filter(period => period.day_of_week === index); return <View key={day} style={[s.hoursRow, { borderColor: c.line }]}><Text style={[s.secondary, { color: c.ink }]}>{day}</Text><Text style={[s.secondary, { color: c.muted, flex: 1 }]}>{!rows.length ? 'غير مضاف' : rows.every(row => row.is_closed) ? 'إجازة' : rows.filter(row => !row.is_closed).map(row => (row.opens_at?.slice(0, 5) || '—') + ' – ' + (row.closes_at?.slice(0, 5) || '—') + (row.closes_at && row.opens_at && row.closes_at < row.opens_at ? ' (اليوم التالي)' : '')).join(' / ')}</Text></View>; })}
        <Text style={[s.small, { color: c.muted }]}>جميع المواعيد بتوقيت السعودية. يُفضّل التأكد من المنشأة قبل الزيارة.</Text>
      </OasisSurface>
      {own && !!business.archived_at && <OasisSurface oasisSurface="card" style={s.card}><View style={s.row}><Archive size={20} color={c.primary}/><Text style={[s.heading,{color:c.ink}]}>هذه المنشأة مخفية من الدليل</Text></View><Text style={[s.secondary,{color:c.muted}]}>يمكنك استعادتها من إعدادات المالك. تبقى بياناتها وطلباتها محفوظة.</Text></OasisSurface>}
      {!!managementNotice && <OasisSurface oasisSurface="card" style={s.card}><Text accessibilityRole="alert" style={[s.secondary,{color:c.primary}]}>{managementNotice}</Text></OasisSurface>}
      {own && canManage && <OasisSurface oasisSurface="card" style={s.card}>{section('إدارة منشأتك',Settings2)}<View style={s.actions}><Action label="تعديل البيانات والصور" Icon={Pencil} onPress={()=>setSettingsOpen(true)}/><Action label="إضافة منتج" Icon={Plus} onPress={()=>router.push('/new-listing?kind=product')}/><Action label="إضافة خدمة" Icon={Wrench} onPress={()=>router.push('/new-service')}/><Action label="الترويج والطلبات" Icon={ShoppingBag} onPress={()=>router.push('/marketplace-dashboard')}/><Action label={business.archived_at?'استعادة المنشأة':'حذف من الدليل'} Icon={business.archived_at?RotateCcw:Archive} onPress={()=>{setArchiveError('');setArchiveConfirm(true);}}/></View><Text style={[s.small,{color:c.muted}]}>هذه الأدوات متاحة للمالك المعتمد فقط. التعديل قد يتطلب اعتماد الإدارة مجددًا.</Text></OasisSurface>}
      {(products.length>0||productsError||own)&&<OasisSurface oasisSurface="card" style={s.card}>{section('منتجات المنشأة',ShoppingBag)}{productsError?<Text style={[s.secondary,{color:c.muted}]}>تعذر تحميل المنتجات. اسحب للتحديث.</Text>:products.length?products.map(product=><View key={product.id} style={[s.product,{borderColor:c.line}]}><Pressable accessibilityRole="button" accessibilityLabel={'عرض '+product.title} onPress={()=>router.push({pathname:'/marketplace-item',params:{id:product.id}})} style={[s.row,{flex:1,flexWrap:'nowrap'}]}>{product.image_url?<Image source={{uri:product.image_url}} resizeMode="contain" style={{width:64,height:64,borderRadius:13,backgroundColor:c.soft}}/>:<ShoppingBag size={28} color={c.primary}/>}<View style={s.grow}><Text numberOfLines={2} style={[s.heading,{color:c.ink}]}>{product.title}</Text><Text style={[s.secondary,{color:c.primary}]}>{productDisplayPrice(product.price,product.item_type)}</Text><Text style={[s.small,{color:c.muted}]}>{product.status==='available'?'متاح':product.status==='sold'?'تم البيع':'غير متاح'}</Text></View><ChevronLeft size={18} color={c.muted}/></Pressable>{own&&canManage&&product.seller_id===me&&<Action label="تعديل أو حذف" Icon={Pencil} onPress={()=>setEditingProduct(product)}/>}</View>):<Text style={[s.secondary,{color:c.muted}]}>لم تُضف منتجات لهذه المنشأة بعد.</Text>}<Text style={[s.small,{color:c.muted}]}>تعرض الصفحة أحدث ٢٤ منتجًا مرتبطًا بالمنشأة.</Text></OasisSurface>}
      {owner && <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/user', params: { id: owner.id } })} style={[s.owner, { backgroundColor: c.surface, borderColor: c.line }]}><View style={s.grow}><Text style={[s.small, { color: c.muted }]}>مالك المنشأة</Text><Text style={[s.heading, { color: c.ink }]}>{owner.display_name || owner.username}</Text></View><ChevronLeft size={20} color={c.primary} /></Pressable>}
      {(services.length > 0 || servicesError) && <OasisSurface oasisSurface="card" style={s.card}>{section('خدمات المنشأة', Wrench)}{servicesError ? <Text style={[s.secondary, { color: c.muted }]}>تعذر تحميل الخدمات. اسحب للتحديث.</Text> : services.map(service => <Pressable key={service.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/service', params: { id: service.id } })} style={[s.service, { borderColor: c.line }]}><Wrench size={18} color={c.primary} /><View style={s.grow}><Text style={[s.heading, { color: c.ink }]}>{service.name}</Text>{!!service.subcategory && <Text style={[s.small, { color: c.muted }]}>{service.subcategory}</Text>}</View><ArrowUpLeft size={18} color={c.primary} /></Pressable>)}</OasisSurface>}
      <OasisSurface oasisSurface="card" style={s.card}>
        {section('تجارب الجيران', Star)}
        {reviewsError ? <Text style={[s.secondary, { color: c.muted }]}>تعذر تحميل التقييمات. اسحب لتحديث الصفحة.</Text> : !reviews.length ? <Text style={[s.secondary, { color: c.muted }]}>لا توجد تجارب منشورة بعد. شارك تجربتك الفعلية بعد التعامل مع المنشأة.</Text> : reviews.map(review => <View key={review.id} style={[s.review, { borderColor: c.line }]}><View style={[s.row, { justifyContent: 'space-between' }]}><Text style={[s.heading, { color: c.ink }]}>{review.reviewer_id === me ? 'تقييمك' : 'أحد الجيران'}</Text><View accessibilityLabel={String(review.rating) + ' من خمس نجوم'} style={s.row}>{[1, 2, 3, 4, 5].map(star => <Star key={star} size={13} color="#D69D2F" fill={star <= review.rating ? '#D69D2F' : 'none'} />)}</View></View>{!!review.body && <Text style={[s.description, { color: c.ink }]}>{review.body}</Text>}<Text style={[s.small, { color: c.muted }]}>{dateText(review.created_at)}</Text></View>)}
        {remaining && !reviewsError && <Pressable disabled={moreBusy} onPress={() => void moreReviews()} style={[s.outline, { borderColor: c.line }]}>{moreBusy ? <ActivityIndicator color={c.primary} /> : <Text style={{ color: c.primary }}>المزيد من التقييمات</Text>}</Pressable>}
      </OasisSurface>
      <OasisSurface oasisSurface="card" style={s.card}>{section('شارك تجربتك', MessageCircle)}
        {success && <Text accessibilityRole="alert" style={[s.description, { color: c.primary }]}>شكرًا لك، حُفظ تقييمك بنجاح.</Text>}
        {!me ? <Action label="سجّل الدخول للتقييم" Icon={ArrowUpLeft} onPress={() => router.push('/auth')} /> : own ? <Text style={[s.secondary, { color: c.muted }]}>تظهر هنا تجارب عملائك. لا يمكنك تقييم منشأتك.</Text> : mine ? <Text style={[s.secondary, { color: c.muted }]}>سبق أن شاركت تقييمك لهذه المنشأة، شكرًا لمساهمتك.</Text> : reviewsError ? <Text style={[s.secondary, { color: c.muted }]}>أعد تحميل التقييمات قبل إرسال تجربة جديدة.</Text> : <>
          <Text style={[s.secondary, { color: c.muted }]}>اختر تقييمك بناءً على تعامل فعلي. التعليق اختياري.</Text>
          <View style={[s.row, { justifyContent: 'center', paddingVertical: 6 }]}>{[1, 2, 3, 4, 5].map(star => <Pressable key={star} accessibilityRole="radio" accessibilityLabel={String(star) + ' من خمس نجوم'} accessibilityState={{ checked: rating === star }} onPress={() => setRating(star)} disabled={submitting} style={[s.star, { backgroundColor: rating >= star ? c.soft : c.surface, borderColor: rating >= star ? c.primary : c.line }]}><Star size={22} color={rating >= star ? '#D69D2F' : c.muted} fill={rating >= star ? '#D69D2F' : 'none'} /></Pressable>)}</View>
          <TextInput accessibilityLabel="تفاصيل تجربتك مع المنشأة" value={body} onChangeText={setBody} maxLength={1000} editable={!submitting} multiline placeholder="ما الذي أعجبك؟ وما الذي يمكن تحسينه؟" style={[s.input, { color: c.ink, borderColor: c.line, backgroundColor: c.surface }]} />
          <Text style={[s.small, { color: c.muted }]}>{body.length.toLocaleString('ar-SA')} / ١٠٠٠</Text>
          {!!reviewError && <Text accessibilityRole="alert" style={[s.secondary, { color: c.danger }]}>{reviewError}</Text>}
          <Pressable accessibilityRole="button" disabled={submitting || !rating} onPress={() => void sendReview()} style={[s.primary, { backgroundColor: c.primary, opacity: submitting || !rating ? .5 : 1 }]}>{submitting ? <ActivityIndicator color="#fff" /> : <><Send size={17} color="#fff" /><Text style={s.white}>نشر التقييم</Text></>}</Pressable>
        </>}
      </OasisSurface>
      {own && <Action label="إدارة أعمالي" Icon={Store} onPress={() => router.push('/marketplace-dashboard')} />}
      <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/report', params: { type: 'business', id: business.id } })} style={s.report}><Flag size={15} color={c.muted} /><Text style={[s.small, { color: c.muted }]}>الإبلاغ عن بيانات المنشأة</Text></Pressable>
    </ScrollView>}
    <BusinessSettingsSheet visible={settingsOpen} business={business} onClose={()=>setSettingsOpen(false)} onSaved={status=>{setManagementNotice(status==='approved'?'حُفظت بيانات المنشأة.':'حُفظت البيانات وأُرسلت للمراجعة.');void load(true);}}/>
    <ProductEditorSheet item={editingProduct} onClose={()=>setEditingProduct(null)} onSaved={()=>void load(true)}/>
    <ConfirmActionModal visible={archiveConfirm} title={business?.archived_at?'استعادة المنشأة؟':'حذف المنشأة من الدليل؟'} description={business?.archived_at?'ستُعاد الصفحة للمراجعة وفق صلاحيات حسابك.':'ستُخفى صفحة المنشأة من الدليل ويمكنك استعادتها. المنتجات والتقييمات والطلبات والمحادثات تبقى محفوظة؛ إدارة ظهور المنتجات مستقلة.'} confirmLabel={business?.archived_at?'استعادة':'إخفاء من الدليل'} destructive={!business?.archived_at} busy={archiveBusy} error={archiveError} onCancel={()=>setArchiveConfirm(false)} onConfirm={()=>void archiveBusiness()}/>
    <ImagePreviewModal uri={preview?.uri || null} title={preview?.title || ''} onClose={() => setPreview(null)} />
  </View>;
}
function Action({ label, Icon, onPress, disabled = false }: { label: string; Icon: typeof Store; onPress: () => void; disabled?: boolean }) {
  const c = OASIS.colors;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress} style={[s.action, { backgroundColor: c.soft, borderColor: c.line, opacity: disabled ? .5 : 1 }]}><Icon size={18} color={c.primary} /><Text style={{ color: c.primary, fontWeight: '700', fontSize: 12 }}>{label}</Text></Pressable>;
}
const s = StyleSheet.create({
  product:{gap:12,borderWidth:1,borderRadius:18,padding:12},
  screen: { flex: 1, backgroundColor: 'transparent' }, page: { width: '100%', maxWidth: 820, alignSelf: 'center', padding: 16, gap: 14 },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 }, hero: { borderRadius: 24, overflow: 'hidden', borderWidth: 1 }, cover: { height: 170 }, image: { width: '100%', height: '100%' }, coverFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 }, coverCaption: { fontSize: 12, fontWeight: '700' }, heroBody: { padding: 18, gap: 12 }, logo: { marginTop: -48, width: 78, height: 78, borderRadius: 22, borderWidth: 3, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, name: { fontSize: 25, lineHeight: 36, fontWeight: '800', textAlign: 'right' }, badge: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, padding: 8, borderRadius: 12 },
  row: { flexDirection: 'row-reverse', alignItems: 'center', gap: 7, flexWrap: 'wrap' }, small: { fontSize: 11, lineHeight: 18, textAlign: 'right' }, secondary: { fontSize: 13, lineHeight: 23, textAlign: 'right' }, heading: { fontSize: 15, lineHeight: 24, fontWeight: '700', textAlign: 'right' }, description: { fontSize: 14, lineHeight: 26, textAlign: 'right' }, grow: { flex: 1, minWidth: 0, gap: 4 },
  summary: { flexDirection: 'row-reverse', gap: 8, marginTop: 4 }, stat: { flex: 1, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 4, borderRadius: 16, alignItems: 'center', gap: 5 }, statNumber: { fontSize: 18, lineHeight: 26, fontWeight: '800', textAlign: 'center' },
  card: { padding: 18, gap: 14, borderRadius: 22 }, sectionTitle: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }, actions: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 }, action: { minHeight: 46, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 7, borderWidth: 1, paddingHorizontal: 14, borderRadius: 14 }, primary: { minHeight: 48, paddingHorizontal: 22, borderRadius: 15, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8 }, white: { color: '#fff', fontWeight: '700', fontSize: 13 },
  hoursRow: { flexDirection: 'row-reverse', gap: 14, alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 }, owner: { flexDirection: 'row-reverse', alignItems: 'center', borderWidth: 1, borderRadius: 20, padding: 17, gap: 10 }, service: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, borderWidth: 1, padding: 13, borderRadius: 15 }, review: { gap: 9, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth }, outline: { minHeight: 44, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, star: { width: 44, height: 44, borderWidth: 1, borderRadius: 14, alignItems: 'center', justifyContent: 'center' }, input: { minHeight: 110, borderWidth: 1, borderRadius: 16, padding: 13, fontSize: 14, textAlign: 'right', textAlignVertical: 'top' }, report: { flexDirection: 'row-reverse', justifyContent: 'center', gap: 7, alignItems: 'center', minHeight: 44 },
});
