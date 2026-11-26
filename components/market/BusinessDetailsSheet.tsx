import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, Modal, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BadgeCheck, CalendarDays, ChevronDown, ChevronLeft, Clock3, ExternalLink, Globe2, MapPin, MessageCircle, Navigation, Package, Phone, RefreshCw, Share2, ShieldCheck, ShoppingBag, Star, Store, X } from 'lucide-react-native';
import { OasisPressable as Pressable } from '@/components/oasis/OasisPrimitives';
import { OASIS, useTheme } from '@/lib/oasis';
import { supabase } from '@/lib/supabase';
import { businessOpening, businessPhone, businessWebsite, type OpeningPeriod } from '@/lib/directoryPresentation';

type BusinessPreview = {
  id: string;
  name: string;
  categoryLabel?: string;
  city?: string;
  district?: string;
  description?: string | null;
  image_url?: string | null;
  cover_url?: string | null;
  logo_url?: string | null;
  is_verified?: boolean;
  rating?: number | null;
  reviews?: number;
  phone?: string;
  whatsapp?: string;
  features?: unknown;
  Icon?: React.ComponentType<{ size?: number; color?: string }>;
};
type BusinessPublic = {
  id: string; name: string; description: string | null; city: string | null;
  district: string | null; address: string | null; website: string | null;
  phone: string | null; whatsapp: string | null; cover_url: string | null;
  logo_url: string | null; is_verified: boolean; created_at: string | null;
};
type ServicePreview = { id: string; name: string; price_from: number | null; price_type: string | null };
type ProductPreview = { id: string; title: string; price: number | null; status: string };

const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const fmtTime = (value: string | null) => value && /^\d\d:\d\d/.test(value) ? value.slice(0,5) : '';
function scheduleForDay(periods: OpeningPeriod[], day: number): string {
  const list = periods.filter(p => p.day_of_week === day);
  if (!list.length) return 'لم تُحدد ساعات هذا اليوم';
  if (list.every(p => p.is_closed)) return 'مغلق';
  const spans = list.filter(p => !p.is_closed && fmtTime(p.opens_at) && fmtTime(p.closes_at)).map(p => fmtTime(p.opens_at) + ' – ' + fmtTime(p.closes_at));
  return spans.length ? spans.join('، ') : 'لم تُحدد ساعات هذا اليوم';
}
const sanitize = (value: unknown) => typeof value === 'string' ? value.trim() : '';

export function BusinessDetailsSheet({business, onClose}: {business: BusinessPreview; onClose: () => void}) {
  useTheme();
  const c = OASIS.colors;
  const insets = useSafeAreaInsets();
  const [details, setDetails] = useState<BusinessPublic | null>(null);
  const [periods, setPeriods] = useState<OpeningPeriod[]>([]);
  const [services, setServices] = useState<ServicePreview[]>([]);
  const [products, setProducts] = useState<ProductPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoursError, setHoursError] = useState(false);
  const [offersError, setOffersError] = useState(false);
  const [detailsError, setDetailsError] = useState(false);
  const [hoursExpanded, setHoursExpanded] = useState(false);
  const [now, setNow] = useState(new Date());
  const [retry, setRetry] = useState(0);
  const [actionError, setActionError] = useState('');
  const [imageFailed, setImageFailed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    let alive = true;
    setDetails(null); setPeriods([]); setServices([]); setProducts([]);
    setHoursError(false); setOffersError(false); setDetailsError(false);
    setLoading(true); setHoursExpanded(false); setImageFailed(false);
    async function read() {
      const [profile, hours, serviceRows, productRows] = await Promise.all([
        supabase.from('businesses')
          .select('id,name,description,city,district,address,website,phone,whatsapp,cover_url,logo_url,is_verified,created_at')
          .eq('id', business.id).eq('moderation_status', 'approved').is('archived_at', null).maybeSingle(),
        supabase.from('business_hours')
          .select('day_of_week,opens_at,closes_at,is_closed')
          .eq('business_id', business.id).order('day_of_week').order('opens_at'),
        supabase.from('services')
          .select('id,name,price_from,price_type')
          .eq('business_id', business.id).eq('moderation_status','approved')
          .order('created_at',{ascending:false}).limit(3),
        supabase.from('marketplace_items')
          .select('id,title,price,status')
          .eq('business_id', business.id).eq('status','available')
          .order('created_at',{ascending:false}).limit(3),
      ]);
      if (!alive) return;
      setDetails(profile.data as BusinessPublic | null);
      setDetailsError(!!profile.error || !profile.data);
      setPeriods((hours.data || []) as OpeningPeriod[]);
      setHoursError(!!hours.error);
      setServices((serviceRows.data || []) as ServicePreview[]);
      setProducts((productRows.data || []) as ProductPreview[]);
      setOffersError(!!serviceRows.error || !!productRows.error);
      setLoading(false);
    }
    void read().catch(() => {
      if (!alive) return;
      setLoading(false); setDetailsError(true); setHoursError(true); setOffersError(true);
    });
    return () => { alive = false; };
  }, [business.id, retry]);

  const opening = useMemo(() => businessOpening(periods, now), [periods, now]);
  const features = Array.isArray(business.features) ? business.features.filter((item):item is string=>typeof item==='string'&&item.trim().length>0).slice(0,8) : [];
  const location = [sanitize(details?.address), [sanitize(details?.district || business.district), sanitize(details?.city || business.city)].filter(Boolean).join(' · ')].filter(Boolean).join('، ');
  const locationSearch = [sanitize(details?.name || business.name), sanitize(details?.district || business.district), sanitize(details?.city || business.city)].filter(Boolean).join(' ');
  const description = sanitize(details?.description || business.description);
  const phone = businessPhone(details?.phone || business.phone);
  const whatsapp = businessPhone(details?.whatsapp || business.whatsapp);
  const website = businessWebsite(details?.website);
  const cover = details?.cover_url || business.cover_url || business.image_url;
  const logo = details?.logo_url || business.logo_url;
  useEffect(() => { setLogoFailed(false); }, [business.id, logo]);
  const verified = details ? details.is_verified === true : business.is_verified === true;
  const Icon = business.Icon || Store;
  const ratingCount = Number.isFinite(Number(business.reviews)) ? Math.max(0, Number(business.reviews)) : 0;
  const hasRating = ratingCount > 0 && typeof business.rating === 'number' && Number.isFinite(business.rating);
  const label = hoursError ? 'تعذر تحديث أوقات العمل' : loading ? 'جاري جلب أوقات العمل' : !opening.hasSchedule ? 'أوقات العمل غير محددة' : opening.open ? 'مفتوح الآن حسب الجدول' : 'مغلق الآن حسب الجدول';
  const statusColor = hoursError ? c.danger : opening.hasSchedule ? (opening.open ? c.primary : c.muted) : c.muted;

  async function open(url: string) {
    try { setActionError(''); await Linking.openURL(url); } catch { setActionError('تعذر فتح جهة التواصل. تحقق من توفر التطبيق أو جرّب وسيلة أخرى.'); }
  }
  function fullPage() {
    onClose();
    router.push({pathname:'/business',params:{id:business.id}});
  }
  function openService(id: string) {
    onClose();
    router.push({pathname:'/service',params:{id}});
  }
  function openProduct(id: string) {
    onClose();
    router.push({pathname:'/marketplace-item',params:{id}});
  }
  const contact = (name: string, IconComponent: React.ComponentType<{size?:number;color?:string}>, action: () => void, primary=false) =>
    <Pressable key={name} oasisKind="plain" accessibilityRole="button" accessibilityLabel={name}
      onPress={action} style={[styles.action,{borderColor:primary?c.primary:c.line,backgroundColor:primary?c.soft:c.surface}]}>
      <IconComponent size={19} color={c.primary}/>
      <Text numberOfLines={1} style={[styles.actionText,{color:c.ink}]}>{name}</Text>
    </Pressable>;

  const retryAction = (label: string) => (
    <Pressable oasisKind="plain" accessibilityRole="button" accessibilityLabel={label}
      accessibilityState={{disabled:loading,busy:loading}} disabled={loading}
      onPress={()=>setRetry(value=>value+1)}
      style={[styles.sectionRetry,{borderColor:c.line,backgroundColor:c.surface}]}>
      <RefreshCw size={14} color={c.primary}/>
      <Text style={[styles.sectionRetryText,{color:c.primary}]}>إعادة المحاولة</Text>
    </Pressable>
  );

  return <Modal transparent visible animationType="slide" onRequestClose={onClose}>
    <View style={styles.overlay}>
      <View accessibilityViewIsModal style={[styles.sheet,{backgroundColor:c.surface,maxHeight:'94%',paddingBottom:Math.max(insets.bottom,12)}]}>
        <View style={[styles.header,{borderBottomColor:c.line}]}>
          <Pressable oasisKind="icon" accessibilityRole="button" accessibilityLabel="إغلاق تفاصيل المنشأة" onPress={onClose} style={[styles.close,{backgroundColor:c.soft}]}>
            <X size={22} color={c.primary}/>
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={[styles.headerTitle,{color:c.ink}]}>تفاصيل المحل</Text>
            <Text numberOfLines={1} style={[styles.headerSubtitle,{color:c.muted}]}>{business.name}</Text>
          </View>
          <Store size={23} color={c.primary}/>
        </View>
        <ScrollView style={{flex:1}} showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.body}>
          <View style={[styles.hero,{borderColor:c.line,backgroundColor:c.soft}]}>
            {cover && !imageFailed
              ? <Image source={{uri:cover}} style={styles.cover} resizeMode="cover" onError={()=>setImageFailed(true)}/>
              : <View style={[styles.cover,{backgroundColor:c.soft,alignItems:'center',justifyContent:'center'}]}><Icon size={48} color={c.primary}/></View>}
            <View style={styles.identityRow}>
              <View style={[styles.logoBox,{borderColor:c.line,backgroundColor:c.surface}]}>
                {logo && !logoFailed
                  ? <Image source={{uri:logo}} style={styles.logo} resizeMode="contain" onError={()=>setLogoFailed(true)}/>
                  : <Icon size={27} color={c.primary}/>}
              </View>
              <View style={styles.identityCopy}>
                <Text accessibilityRole="header" numberOfLines={2} style={[styles.businessName,{color:c.ink}]}>{details?.name || business.name}</Text>
                <Text style={[styles.category,{color:c.primary}]}>{business.categoryLabel || 'منشأة محلية'}</Text>
              </View>
              {verified&&<View style={[styles.verifiedBadge,{backgroundColor:c.surface}]}><BadgeCheck size={17} color={c.primary}/><Text style={[styles.tiny,{color:c.primary}]}>موثقة</Text></View>}
            </View>
            <View style={styles.metaRow}>
              <View style={[styles.metaPill,{backgroundColor:c.surface}]}>
                <Star size={15} color={hasRating?'#B78321':c.muted} fill={hasRating?'#B78321':'none'}/>
                <Text style={[styles.tiny,{color:c.ink}]}>{hasRating ? business.rating!.toFixed(1)+' · '+ratingCount+' تقييم' : 'لم تُسجل تقييمات'}</Text>
              </View>
              <View style={[styles.metaPill,{backgroundColor:c.surface}]}>
                <ShieldCheck size={15} color={verified?c.primary:c.muted}/>
                <Text style={[styles.tiny,{color:c.ink}]}>{verified?'اعتماد موثق':'دون علامة توثيق'}</Text>
              </View>
            </View>
          </View>

          <View style={[styles.statusBox,{borderColor:c.line,backgroundColor:c.background}]}>
            <Clock3 size={19} color={statusColor}/>
            <View style={{flex:1,alignItems:'flex-end',gap:5}}>
              <Text style={[styles.statusText,{color:c.ink}]}>{label}</Text>
              {opening.nextOpening && !hoursError && !loading && opening.hasSchedule
                ? <Text style={[styles.subText,{color:c.muted}]}>أقرب افتتاح: {new Intl.DateTimeFormat('ar-SA',{timeZone:'Asia/Riyadh',weekday:'long',hour:'numeric',minute:'2-digit'}).format(new Date(opening.nextOpening))}</Text>
                : <Text style={[styles.subText,{color:c.muted}]}>تُحسب الحالة من ساعات العمل المعلنة بتوقيت السعودية</Text>}
            </View>
            <Pressable oasisKind="plain" accessibilityRole="button" accessibilityLabel={hoursExpanded?'إخفاء ساعات الأسبوع':'عرض ساعات الأسبوع'}
              accessibilityState={{expanded:hoursExpanded}} onPress={()=>setHoursExpanded(v=>!v)} style={styles.hoursToggle}>
              <ChevronDown size={18} color={c.primary} style={hoursExpanded?{transform:[{rotate:'180deg'}]}:undefined}/>
            </Pressable>
          </View>
          {hoursExpanded&&<View style={[styles.section,{borderColor:c.line}]}>
            <Text style={[styles.sectionTitle,{color:c.ink}]}>ساعات العمل الأسبوعية</Text>
            {loading?<ActivityIndicator color={c.primary}/>:hoursError?
              <View style={styles.errorRecoveryRow}>
                <Text style={[styles.subText,{color:c.danger,flex:1}]}>تعذر جلب الساعات. أعد المحاولة لتحديث بيانات أوقات العمل.</Text>
                {retryAction('إعادة تحميل أوقات العمل')}
              </View>:!periods.length?
              <Text style={[styles.subText,{color:c.muted}]}>لم تُنشر مواعيد عمل رسمية لهذه المنشأة بعد.</Text>:
              DAYS.map((day,index)=><View key={day} style={[styles.hourRow,{borderTopColor:c.line}]}>
                <Text style={[styles.hourTime,{color:c.muted}]}>{scheduleForDay(periods,index)}</Text>
                <Text style={[styles.hourDay,{color:c.ink}]}>{day}</Text>
              </View>)}
          </View>}

          <View style={styles.actionGrid}>
            {phone&&contact('اتصال',Phone,()=>void open('tel:+'+phone),true)}
            {whatsapp&&contact('واتساب',MessageCircle,()=>void open('https://wa.me/'+whatsapp+'?text='+encodeURIComponent('مرحبًا، وجدت منشأتكم في حيّنا وأرغب بالاستفسار.')),true)}
            {locationSearch&&contact('الخريطة',Navigation,()=>void open('https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(locationSearch)))}
            {website&&contact('الموقع الإلكتروني',Globe2,()=>void open(website))}
            {contact('مشاركة',Share2,()=>void Share.share({message:'تعرّف على '+(details?.name||business.name)+' في حيّنا: https://appksatest.vercel.app/business?id='+encodeURIComponent(business.id)}).catch(()=>{}))}
          </View>
          {!!actionError&&<Text accessibilityRole="alert" style={[styles.subText,{color:c.danger}]}>{actionError}</Text>}
          {!phone&&!whatsapp&&!website&&<Text style={[styles.subText,{color:c.muted,textAlign:'right'}]}>لم تُنشر بيانات اتصال تجارية مباشرة. يمكنك الاطلاع على صفحة المنشأة.</Text>}

          <View style={[styles.section,{borderColor:c.line}]}>
            <View style={styles.sectionHeader}><Store size={18} color={c.primary}/><Text style={[styles.sectionTitle,{color:c.ink}]}>عن المنشأة</Text></View>
            <Text style={[styles.description,{color:description?c.ink:c.muted}]}>{description||'لم تُضف المنشأة وصفًا تفصيليًا لنشاطها بعد.'}</Text>
            {details?.created_at&&<View style={styles.inlineInfo}>
              <CalendarDays size={15} color={c.muted}/>
              <Text style={[styles.subText,{color:c.muted}]}>منضمة إلى حيّنا منذ {new Date(details.created_at).toLocaleDateString('ar-SA',{timeZone:'Asia/Riyadh',year:'numeric',month:'long'})}</Text>
            </View>}
          </View>

          {!!features.length&&<View style={[styles.section,{borderColor:c.line}]}>
            <View style={styles.sectionHeader}><BadgeCheck size={18} color={c.primary}/><Text style={[styles.sectionTitle,{color:c.ink}]}>المزايا المعلنة</Text></View>
            <View style={styles.featuresList}>{features.map((feature,index)=><View key={index} style={[styles.featurePill,{backgroundColor:c.soft}]}>
              <ShieldCheck size={14} color={c.primary}/>
              <Text style={[styles.featureText,{color:c.ink}]}>{feature}</Text>
            </View>)}</View>
          </View>}
          <View style={[styles.section,{borderColor:c.line}]}>
            <View style={styles.sectionHeader}><MapPin size={18} color={c.primary}/><Text style={[styles.sectionTitle,{color:c.ink}]}>الموقع والعنوان</Text></View>
            <Text style={[styles.description,{color:c.ink}]}>{location||'لم يُنشر عنوان المنشأة بعد.'}</Text>
            {locationSearch&&<Pressable oasisKind="plain" accessibilityRole="button" onPress={()=>void open('https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(locationSearch))}
              style={styles.inlineAction}><Navigation size={16} color={c.primary}/><Text style={[styles.inlineText,{color:c.primary}]}>البحث عن المنشأة في الخرائط</Text></Pressable>}
          </View>

          <View style={[styles.section,{borderColor:c.line}]}>
            <View style={styles.sectionHeader}><Package size={18} color={c.primary}/><Text style={[styles.sectionTitle,{color:c.ink}]}>العروض والخدمات</Text></View>
            {loading?<ActivityIndicator color={c.primary}/>:offersError?
              <View style={styles.errorRecoveryRow}>
                <Text style={[styles.subText,{color:c.danger,flex:1}]}>تعذر تحميل بعض العروض والخدمات. أعد المحاولة لتحديثها.</Text>
                {retryAction('إعادة تحميل العروض والخدمات')}
              </View>:
              !services.length&&!products.length?<Text style={[styles.description,{color:c.muted}]}>لا توجد عروض منشورة مرتبطة بالمنشأة حاليًا.</Text>:null}
            {services.map(service=><Pressable key={'s'+service.id} oasisKind="plain" accessibilityRole="button" accessibilityLabel={'تفاصيل خدمة '+service.name} onPress={()=>openService(service.id)}
              style={[styles.offerRow,{borderColor:c.line,backgroundColor:c.background}]}>
              <View style={[styles.offerIcon,{backgroundColor:c.soft}]}><Store size={16} color={c.primary}/></View>
              <Text numberOfLines={2} style={[styles.offerTitle,{color:c.ink}]}>{service.name}</Text>
              <Text style={[styles.offerKind,{color:c.muted}]}>خدمة</Text>
              <ChevronLeft size={16} color={c.primary}/>
            </Pressable>)}
            {products.map(product=><Pressable key={'p'+product.id} oasisKind="plain" accessibilityRole="button" accessibilityLabel={'تفاصيل منتج '+product.title} onPress={()=>openProduct(product.id)}
              style={[styles.offerRow,{borderColor:c.line,backgroundColor:c.background}]}>
              <View style={[styles.offerIcon,{backgroundColor:c.soft}]}><ShoppingBag size={16} color={c.primary}/></View>
              <Text numberOfLines={2} style={[styles.offerTitle,{color:c.ink}]}>{product.title}</Text>
              <Text style={[styles.offerKind,{color:c.muted}]}>منتج</Text>
              <ChevronLeft size={16} color={c.primary}/>
            </Pressable>)}
            {(services.length>0||products.length>0)&&<Text style={[styles.subText,{color:c.muted}]}>المعروض أحدث الخدمات والمنتجات المتاحة. استعرض البقية في الصفحة الكاملة.</Text>}
          </View>

          <View style={[styles.section,{borderColor:c.line}]}>
            <View style={styles.sectionHeader}><Star size={18} color={c.primary}/><Text style={[styles.sectionTitle,{color:c.ink}]}>آراء وتقييمات الجيران</Text></View>
            <Text style={[styles.description,{color:c.muted}]}>{hasRating ? 'التقييم الظاهر في بطاقة السوق '+business.rating!.toFixed(1)+' من 5 بناءً على '+ratingCount+' تقييم. افتح صفحة المنشأة لقراءة الآراء وتقييمها.' : 'لم تُسجل تقييمات في بطاقة السوق. افتح الصفحة الكاملة للاطلاع على آخر التقييمات أو إضافة تقييم.'}</Text>
            <Pressable oasisKind="plain" accessibilityRole="button" accessibilityLabel="عرض تقييمات المنشأة" onPress={fullPage} style={styles.inlineAction}>
              <Star size={16} color={c.primary}/><Text style={[styles.inlineText,{color:c.primary}]}>عرض التقييمات والتفاصيل</Text>
            </Pressable>
          </View>
          {detailsError&&<View style={[styles.warning,{backgroundColor:c.dangerSoft}]}>
            <Text style={[styles.subText,{color:c.danger,flex:1}]}>بعض البيانات التفصيلية لم تتوفر. قد تكون المنشأة غير متاحة أو حدث خطأ اتصال.</Text>
            {retryAction('إعادة تحميل بيانات المنشأة')}
          </View>}
        </ScrollView>
        <View style={[styles.footer,{borderTopColor:c.line,backgroundColor:c.surface}]}>
          <Pressable oasisKind="plain" accessibilityRole="button" accessibilityLabel="فتح صفحة المنشأة الكاملة مع الصور والتقييمات وأوقات العمل" onPress={fullPage}
            style={[styles.primaryButton,{backgroundColor:c.primary}]}>
            <Text style={styles.primaryText}>عرض صفحة المنشأة الكاملة</Text>
            <ExternalLink size={18} color="#FFFFFF"/>
          </Pressable>
        </View>
      </View>
    </View>
  </Modal>;
}

const styles=StyleSheet.create({
  overlay:{flex:1,backgroundColor:'rgba(15,23,42,0.62)',justifyContent:'flex-end'},
  sheet:{width:'100%',maxWidth:840,alignSelf:'center',borderTopLeftRadius:27,borderTopRightRadius:27,overflow:'hidden'},
  header:{paddingHorizontal:17,paddingVertical:13,minHeight:68,borderBottomWidth:1,flexDirection:'row-reverse',alignItems:'center',gap:12},
  close:{width:44,height:44,borderRadius:15,alignItems:'center',justifyContent:'center'},
  headerCopy:{flex:1,minWidth:0,alignItems:'flex-end',gap:3},
  headerTitle:{fontSize:17,fontWeight:'800',textAlign:'right'},
  headerSubtitle:{fontSize:11.5,textAlign:'right'},
  body:{paddingHorizontal:14,paddingTop:13,paddingBottom:18,gap:12},
  hero:{borderWidth:1,borderRadius:21,overflow:'hidden',gap:10,paddingBottom:14},
  cover:{width:'100%',height:142},
  identityRow:{flexDirection:'row-reverse',alignItems:'center',gap:11,paddingHorizontal:13},
  logoBox:{width:56,height:56,borderRadius:17,borderWidth:1,alignItems:'center',justifyContent:'center',overflow:'hidden'},
  logo:{width:53,height:53},
  identityCopy:{flex:1,minWidth:0,alignItems:'flex-end',gap:4},
  businessName:{fontSize:18,fontWeight:'800',textAlign:'right'},
  category:{fontSize:12,fontWeight:'700',textAlign:'right'},
  verifiedBadge:{paddingHorizontal:8,paddingVertical:7,borderRadius:11,flexDirection:'row-reverse',alignItems:'center',gap:5},
  tiny:{fontSize:11,fontWeight:'700',textAlign:'right'},
  metaRow:{flexDirection:'row-reverse',flexWrap:'wrap',gap:7,paddingHorizontal:13},
  metaPill:{minHeight:32,paddingHorizontal:10,borderRadius:12,flexDirection:'row-reverse',alignItems:'center',gap:5},
  statusBox:{borderWidth:1,borderRadius:16,paddingHorizontal:12,paddingVertical:11,flexDirection:'row-reverse',alignItems:'center',gap:10},
  statusText:{fontSize:13,fontWeight:'800',textAlign:'right'},
  subText:{fontSize:11.5,lineHeight:19,textAlign:'right'},
  hoursToggle:{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center'},
  section:{borderWidth:1,borderRadius:17,padding:14,gap:10},
  sectionHeader:{flexDirection:'row-reverse',alignItems:'center',gap:8},
  sectionTitle:{fontSize:14,fontWeight:'800',textAlign:'right'},
  description:{fontSize:12.5,lineHeight:23,textAlign:'right'},
  hourRow:{paddingVertical:9,borderTopWidth:1,flexDirection:'row-reverse',alignItems:'center',justifyContent:'space-between',gap:12},
  featuresList:{flexDirection:'row-reverse',flexWrap:'wrap',gap:7},
  featurePill:{borderRadius:11,paddingHorizontal:9,paddingVertical:8,minHeight:35,flexDirection:'row-reverse',alignItems:'center',gap:6},
  featureText:{fontSize:11.5,fontWeight:'600',textAlign:'right'},
  hourDay:{fontSize:12,fontWeight:'700'},
  hourTime:{fontSize:11.5,textAlign:'left',flexShrink:1},
  actionGrid:{flexDirection:'row-reverse',flexWrap:'wrap',gap:8},
  action:{minHeight:47,borderWidth:1,borderRadius:14,flexGrow:1,flexBasis:'30%',flexDirection:'row-reverse',alignItems:'center',justifyContent:'center',gap:7,paddingHorizontal:9},
  actionText:{fontSize:12,fontWeight:'800',textAlign:'center'},
  inlineInfo:{flexDirection:'row-reverse',gap:6,alignItems:'center'},
  inlineAction:{minHeight:44,flexDirection:'row-reverse',gap:7,alignItems:'center',alignSelf:'flex-end'},
  inlineText:{fontSize:12.5,fontWeight:'800'},
  offerRow:{borderWidth:1,borderRadius:14,paddingHorizontal:9,paddingVertical:8,flexDirection:'row-reverse',alignItems:'center',gap:8,minHeight:50},
  offerIcon:{width:34,height:34,borderRadius:11,alignItems:'center',justifyContent:'center'},
  offerTitle:{flex:1,minWidth:0,fontSize:12.5,fontWeight:'700',textAlign:'right'},
  offerKind:{fontSize:11},
  warning:{padding:10,borderRadius:12,flexDirection:'row-reverse',alignItems:'center',gap:7},
  errorRecoveryRow:{flexDirection:'row-reverse',alignItems:'center',flexWrap:'wrap',gap:10},
  sectionRetry:{minHeight:44,borderWidth:1,borderRadius:12,paddingHorizontal:12,flexDirection:'row-reverse',alignItems:'center',justifyContent:'center',gap:7},
  sectionRetryText:{fontSize:11.5,fontWeight:'800'},
  footer:{borderTopWidth:1,paddingHorizontal:14,paddingVertical:10},
  primaryButton:{minHeight:52,borderRadius:15,flexDirection:'row-reverse',alignItems:'center',justifyContent:'center',gap:9,paddingHorizontal:12},
  primaryText:{color:'#FFFFFF',fontSize:14,fontWeight:'800',textAlign:'center'},
});
