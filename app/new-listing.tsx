import { OasisPressable as Pressable, OasisTextInput as TextInput, OasisSurface } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ImageBackground, ActivityIndicator, Alert, Image, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  Camera,
  Check,
  ChevronLeft,
  Gift,
  ImagePlus,
  Package,
  ShoppingBag,
  Store,
  Wrench,
  X,
  MapPin, Navigation, ShieldCheck, RefreshCw, Tag, Truck, ClipboardCheck, Info,
} from 'lucide-react-native';

import { AppHeader } from '@/components/shared/AppHeader';
import { supabase } from '@/lib/supabase';
import { containsProfanity, findProfanity, banAccountOnViolation } from '@/lib/profanity';
import { reverseGeocodeDeviceLocation } from '@/lib/deviceLocation';
import { normalizeSaudiLocationName } from '@/lib/saudiLocations';
import { readCurrentProductPosition } from '@/lib/productDeviceLocation';
import { confirmProductPosition, parseProductPrice, productPositionError, type ProductPosition } from '@/lib/productLocationRules';
import {
  type LocalServiceImage,
  pickServiceImages,
  uploadServiceImages,
} from '@/lib/serviceUpload';

type Kind = 'product' | 'service';
type ProductMode = 'بيع' | 'تبرع' | 'إعارة';

export default function NewListing() {
  const params = useLocalSearchParams<{ kind?: string }>();
  const requestedKind = Array.isArray(params.kind) ? params.kind[0] : params.kind;
  const [loading, setLoading] = useState(true);
  const [capabilities, setCapabilities] = useState<any>({});
  const [profile, setProfile] = useState<any>(null);
  const [kind, setKind] = useState<Kind | null>(requestedKind === 'product' || requestedKind === 'service' ? requestedKind : null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [mode, setMode] = useState<ProductMode>('بيع');
  const [image, setImage] = useState<LocalServiceImage | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyMessage, setBusyMessage] = useState('جارٍ التحقق من الموقع…');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [category, setCategory] = useState('أثاث ومنزل');
  const [condition, setCondition] = useState('جديد');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [dimensions, setDimensions] = useState('');
  const [delivery, setDelivery] = useState('استلام من الموقع');
  const [negotiable, setNegotiable] = useState(false);
  const [position, setPosition] = useState<ProductPosition | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [productPresent, setProductPresent] = useState(false);
  const [formError, setFormError] = useState('');
  const [preview, setPreview] = useState(false);
  const saveLock = useRef(false);
  const locationSequence = useRef(0);
  const alive = useRef(true);
  useEffect(() => {alive.current=true;return () => {alive.current=false;locationSequence.current++;};}, []);

  useEffect(() => {
    void (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) {
          router.replace('/auth');
          return;
        }
        const [p, caps] = await Promise.all([
          supabase.from('profiles').select('id,account_type,is_verified,is_verified_merchant,display_name,freelance_trade,city,district').eq('id', auth.user.id).maybeSingle(),
          supabase.rpc('hayna_my_account_capabilities'),
        ]);
        if(!alive.current)return;
        if(p.error)throw p.error;
        if(caps.error)throw caps.error;
        setProfile(p.data || null);
        setCapabilities(caps.data || {});

        if (requestedKind === 'service') {
          if (!caps.data?.can_publish_services) {
            Alert.alert('يتطلب حسابًا مهنيًا', 'الخدمات متاحة للحساب التجاري أو العمل الحر أو مقدم الخدمة بعد اعتماد الإدارة.');
            router.replace({ pathname: '/profile', params: { tab: 'profile' } });
            return;
          }
          router.replace('/new-service');
          return;
        }
      } catch(cause) {
        if(alive.current)setFormError((cause as Error)?.message || 'تعذر تجهيز بيانات الحساب. أعد فتح الصفحة.');
      } finally {
        if(alive.current)setLoading(false);
      }
    })();
  }, [requestedKind]);

  const isMerchant = profile?.account_type === 'merchant' && profile?.is_verified && profile?.is_verified_merchant;
  const ownerLabel = useMemo(() => {
    if (isMerchant) return profile?.freelance_trade || profile?.display_name || 'المنشأة';
    return profile?.display_name || 'حسابك';
  }, [isMerchant, profile]);

  function chooseKind(next: Kind) {
    if (next === 'service') {
      if (!capabilities.can_publish_services) {
        Alert.alert('الخدمات للحسابات المهنية', 'حوّل نوع حسابك إلى عمل حر أو مقدم خدمة أو تجاري من مركز الحساب، ثم انتظر اعتماد الإدارة.');
        return;
      }
      router.replace('/new-service');
      return;
    }
    if (!capabilities.can_publish_products) {
      Alert.alert('يتطلب حسابًا تجاريًا معتمدًا', 'راجع توثيق حسابك وصلاحية نشر المنتجات من مركز الحساب.');
      return;
    }
    setKind('product');
  }

  async function currentProductLocation(expectedProfile = profile) {
    const fix = await readCurrentProductPosition();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let place;
    try {
      place = await Promise.race([
        reverseGeocodeDeviceLocation(fix),
        new Promise<never>((_,reject) => {timeout=setTimeout(()=>reject(new Error('تعذر جلب اسم الحي. تحقق من الاتصال ثم أعد المحاولة.')),20000);}),
      ]);
    } finally {if(timeout)clearTimeout(timeout);}
    if (!place?.city || !place.district || place.isOutsideKSA) throw new Error('لم نتمكن من تحديد مدينة وحي داخل المملكة بدقة. لن نستخدم عنوان الحساب بدل الموقع الفعلي.');
    if (normalizeSaudiLocationName(place.city) !== normalizeSaudiLocationName(expectedProfile?.city || '') || normalizeSaudiLocationName(place.district) !== normalizeSaudiLocationName(expectedProfile?.district || '')) {
      throw new Error(`موقع الجهاز في ${place.city} · ${place.district} يختلف عن حي النشر المسجل. حدّث موقع حسابك من إعدادات الموقع ثم أعد التحقق، حتى لا يُنشر المنتج في حي آخر.`);
    }
    const qualityError = productPositionError(fix);
    if(qualityError)throw new Error(qualityError);
    return {fix,place};
  }

  async function locateProduct() {
    if(locating || busy)return;
    const request=++locationSequence.current;
    setLocating(true); setLocationError(''); setPosition(null); setProductPresent(false); setPreview(false);
    try {
      const location=await supabase.from('profiles').select('city,district').eq('id',profile.id).single();
      if(location.error)throw location.error;
      const {fix,place}=await currentProductLocation(location.data);
      if(alive.current && request===locationSequence.current){setPosition(fix);setCity(place.city);setDistrict(place.district);setProfile((previous:any)=>({...previous,...location.data}));}
    } catch(cause) {if(alive.current && request===locationSequence.current)setLocationError((cause as Error).message);}
    finally {if(alive.current && request===locationSequence.current)setLocating(false);}
  }

  function validateProduct() {
    if(!capabilities.can_publish_products)return 'نشر المنتجات يتطلب حسابًا تجاريًا معتمدًا.';
    if(title.trim().length<4)return 'اكتب اسمًا واضحًا للمنتج من ٤ أحرف على الأقل.';
    if(description.trim().length<20)return 'أضف وصفًا من ٢٠ حرفًا على الأقل يوضح حالة المنتج ومحتوياته وأي عيوب.';
    if(!image)return 'أضف صورة واضحة للمنتج قبل النشر.';
    if(mode==='بيع' && !negotiable && (parseProductPrice(price)==null || Number.isNaN(parseProductPrice(price))))return 'أدخل سعرًا موجبًا بالريال أو اختر السعر بالتفاوض.';
    if(!position)return 'حدّد موقعك الحالي وأنت بجانب المنتج.';
    const quality=productPositionError(position);if(quality)return quality;
    if(!productPresent)return 'أكّد أنك موجود الآن مع المنتج في الموقع المحدد.';
    return '';
  }

  const detailDescription = [description.trim(), '\nتفاصيل المنتج', `التصنيف: ${category}`, `الحالة: ${condition}`, brand.trim() && `العلامة التجارية: ${brand.trim()}`, model.trim() && `الموديل: ${model.trim()}`, dimensions.trim() && `المقاسات: ${dimensions.trim()}`, `الاستلام: ${delivery}`].filter(Boolean).join('\n');

  async function chooseImage(fromCamera = false) {
    if(busy)return;
    try {
      const result = await pickServiceImages(1, fromCamera);
      if (result[0]) {setImage(result[0]);setPreview(false);}
    } catch (error: any) {
      Alert.alert('الصورة', error?.message || 'تعذر اختيار الصورة.');
    }
  }

  async function saveProduct() {
    if (!profile?.id || saveLock.current || locating) return;
    const validation=validateProduct();if(validation){setFormError(validation);return;}

    const detected = findProfanity(`${title} ${detailDescription}`);
    if (detected) {
      await banAccountOnViolation(profile.id, 'product', `${title} ${description}`, detected);
      Alert.alert('تم حظر الحساب', 'تم اكتشاف محتوى مخالف. تم إغلاق حسابك.');
      router.replace('/banned');
      return;
    }
    saveLock.current=true;setBusy(true);setFormError('');setBusyMessage('جارٍ التحقق من الحساب وموقع المنتج…');
    try {
      const {data:auth,error:authError}=await supabase.auth.getUser();
      if(authError || auth.user?.id!==profile.id)throw new Error('انتهت جلسة الحساب. سجّل الدخول مجددًا.');
      const [permissions,freshProfile]=await Promise.all([
        supabase.rpc('hayna_my_account_capabilities'),
        supabase.from('profiles').select('city,district').eq('id',profile.id).single(),
      ]);
      if(permissions.error || !permissions.data?.can_publish_products)throw new Error('لا تملك صلاحية نشر المنتجات حاليًا. راجع توثيق حسابك.');
      if(freshProfile.error)throw freshProfile.error;
      const current=await currentProductLocation(freshProfile.data);
      confirmProductPosition(position!,current.fix);
      if(permissions.data?.can_manage_business){const business=await supabase.rpc('hayna_ensure_my_business');if(business.error)throw business.error;}
      setBusyMessage('جارٍ رفع صورة المنتج…');
      const urls = image ? await uploadServiceImages(profile.id, [image]) : [];
      setBusyMessage('جارٍ تأكيد وجودك في الموقع قبل النشر…');
      const finalFix=await readCurrentProductPosition();
      confirmProductPosition(position!,finalFix);
      setBusyMessage('جارٍ حفظ الإعلان…');
      const inserted = await supabase.from('marketplace_items').insert({
        seller_id: profile.id,
        title: title.trim(),
        description: detailDescription,
        price: mode === 'بيع' && !negotiable ? parseProductPrice(price) : null,
        item_type: isMerchant ? 'منتج تجاري' : mode,
        city: freshProfile.data.city,
        district: freshProfile.data.district,
        image_url: urls[0] || null,
        status: 'available',
      }).select('id').single();
      if (inserted.error) throw inserted.error;

      Alert.alert('تم النشر', isMerchant ? 'تم ربط المنتج بمنشأتك وحسابك تلقائيًا.' : 'تم ربط الإعلان بملفك الشخصي.');
      router.replace({ pathname: '/profile', params: { tab: 'content' } });
    } catch (error: any) {
      setFormError(error?.message || 'تعذر نشر المنتج. حاول مرة أخرى.');
      setProductPresent(false);setPosition(null);setPreview(false);
    } finally {
      saveLock.current=false;if(alive.current)setBusy(false);
    }
  }

  if (loading) {
    return <View style={[styles.center, { backgroundColor: 'transparent' }]}><ActivityIndicator size="large" color={OASIS.colors.primary} /><Text style={styles.loading}>جاري تجهيز الإضافة...</Text></View>;
  }

  if (!kind) {
    return (
      <View style={[styles.screen, { backgroundColor: 'transparent' }]}>
        <AppHeader variant="sub" title="إضافة جديدة" subtitle="اختر نوع ما تريد نشره" fallbackRoute="/profile?tab=content" />
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.heroTitle}>ماذا تريد أن تضيف؟</Text>
          <Text style={styles.heroSub}>كل عنصر ينشر من هنا يرتبط بملفك تلقائيًا، وبمنشأتك إذا كان حسابك تجاريًا.</Text>

          <Pressable oasisKind="card" style={styles.kindCard} onPress={() => chooseKind('product')}>
            <View style={[styles.kindIcon, { backgroundColor: OASIS.colors.soft }]}><ShoppingBag size={26} color={OASIS.colors.primary} /></View>
            <View style={styles.kindCopy}>
              <Text style={styles.kindTitle}>منتج أو سلعة</Text>
              <Text style={styles.kindSub}>{isMerchant ? 'منتج تجاري باسم منشأتك' : 'بيع شخصي أو تبرع أو إعارة'}</Text>
            </View>
            <ChevronLeft size={20} color="#94A3B8" />
          </Pressable>

          <Pressable oasisKind="card" style={[styles.kindCard, !capabilities.can_publish_services && styles.kindDisabled]} onPress={() => chooseKind('service')}>
            <View style={[styles.kindIcon, { backgroundColor: OASIS.colors.infoSoft }]}><Wrench size={26} color="#2563EB" /></View>
            <View style={styles.kindCopy}>
              <Text style={styles.kindTitle}>خدمة مهنية</Text>
              <Text style={styles.kindSub}>{capabilities.can_publish_services ? 'أضف خدمة وربطها بحسابك المهني' : 'تتطلب حسابًا مهنيًا معتمدًا'}</Text>
            </View>
            <ChevronLeft size={20} color="#94A3B8" />
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: 'transparent' }]}>
      <AppHeader variant="sub" title="إضافة منتج" subtitle={isMerchant ? 'سيظهر باسم المنشأة في السوق' : 'إعلان شخصي مرتبط بملفك'} fallbackRoute="/profile?tab=content" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.intro}>
          <View style={styles.introIcon}><Package size={24} color={OASIS.colors.primary}/></View>
          <Text style={styles.heroTitle}>عرض واضح، وتفاصيل موثوقة</Text>
          <Text style={styles.heroSub}>صوّر المنتج، أضف تفاصيله، ثم أكّد وجودك معه قبل النشر.</Text>
          <View style={styles.steps}>{[['١','التفاصيل'],['٢','الموقع الحالي'],['٣','المراجعة']].map(([n,label])=><View key={n} style={styles.step}><Text style={styles.stepNumber}>{n}</Text><Text style={styles.hint}>{label}</Text></View>)}</View>
        </View>
        {!capabilities.can_publish_products && <View style={styles.errorBox}><Text style={styles.errorText}>نشر المنتجات للحساب التجاري المعتمد. يمكنك مراجعة حالة التوثيق في ملفك الشخصي.</Text></View>}
        <OasisSurface oasisSurface="card" style={styles.ownerCard}>
          <View style={styles.ownerIcon}>{isMerchant ? <Store size={19} color={OASIS.colors.primary} /> : <Package size={19} color={OASIS.colors.primary} />}</View>
          <View style={styles.ownerCopy}>
            <Text style={styles.ownerLabel}>{isMerchant ? 'ينشر بواسطة المنشأة' : 'ينشر بواسطة الحساب'}</Text>
            <Text style={styles.ownerName}>{ownerLabel}</Text>
          </View>
          <Check size={18} color={OASIS.colors.primary} />
        </OasisSurface>

        <OasisSurface oasisSurface="card" style={styles.card}>
          <View style={styles.sectionHeading}><Camera size={18} color={OASIS.colors.primary}/><Text style={styles.sectionTitle}>صورة الغلاف</Text></View>
          <Text style={styles.hint}>اختر صورة فعلية وواضحة للمنتج تُظهر حالته. الصورة مطلوبة للنشر.</Text>
          {image ? (
            <View style={styles.imagePreview}>
              <Image source={{ uri: image.uri }} style={styles.image} />
              <Pressable accessibilityLabel="حذف صورة المنتج" disabled={busy} style={styles.removeImage} onPress={() => {setImage(null);setPreview(false);}}><X size={15} color={OASIS.colors.danger} /></Pressable>
            </View>
          ) : (
            <View style={styles.imageActions}>
              <Pressable style={styles.imageButton} onPress={() => void chooseImage(false)}><ImagePlus size={20} color="#0F766E" /><Text style={styles.imageButtonText}>اختيار صورة</Text></Pressable>
              <Pressable style={styles.imageButton} onPress={() => void chooseImage(true)}><Camera size={20} color="#0F766E" /><Text style={styles.imageButtonText}>الكاميرا</Text></Pressable>
            </View>
          )}
        </OasisSurface>

        {!isMerchant ? (
          <OasisSurface oasisSurface="card" style={styles.card}>
            <Text style={styles.sectionTitle}>نوع الإعلان</Text>
            <View style={styles.modeRow}>
              {([
                ['بيع', ShoppingBag],
                ['تبرع', Gift],
                ['إعارة', Package],
              ] as const).map(([value, Icon]) => (
                <Pressable key={value} disabled={busy} style={[styles.mode, mode === value && styles.modeActive]} onPress={() => setMode(value)}>
                  <Icon size={16} color={mode === value ? OASIS.colors.surface : OASIS.colors.muted} />
                  <Text style={[styles.modeText, mode === value && styles.modeTextActive]}>{value}</Text>
                </Pressable>
              ))}
            </View>
          </OasisSurface>
        ) : null}

        <OasisSurface oasisSurface="card" style={styles.card}>
          <View style={styles.sectionHeading}><Tag size={18} color={OASIS.colors.primary}/><Text style={styles.sectionTitle}>معلومات المنتج</Text></View>
          <Field label="اسم المنتج *" maxLength={100} editable={!busy} value={title} onChangeText={setTitle} placeholder="مثال: طاولة قهوة خشبية بحالة ممتازة" />
          <Text style={styles.label}>التصنيف</Text>
          <View style={styles.choices}>{['أثاث ومنزل','إلكترونيات','أجهزة منزلية','ملابس وإكسسوارات','رياضة وهوايات','أطفال','أخرى'].map(value=><Choice key={value} label={value} selected={category===value} disabled={busy} onPress={()=>setCategory(value)}/>)}</View>
          <Text style={styles.label}>حالة المنتج</Text>
          <View style={styles.choices}>{['جديد','كالجديد','مستعمل بحالة جيدة','يحتاج صيانة'].map(value=><Choice key={value} label={value} selected={condition===value} disabled={busy} onPress={()=>setCondition(value)}/>)}</View>
          <Field label="وصف المنتج *" maxLength={2000} editable={!busy} value={description} onChangeText={setDescription} placeholder="اذكر مدة الاستخدام، المحتويات والملحقات، وأي عيوب أو إصلاحات سابقة..." multiline />
          <View style={styles.twoColumns}><View style={{flex:1}}><Field label="العلامة التجارية — اختياري" maxLength={60} editable={!busy} value={brand} onChangeText={setBrand} placeholder="مثال: سامسونج"/></View><View style={{flex:1}}><Field label="الموديل — اختياري" maxLength={60} editable={!busy} value={model} onChangeText={setModel} placeholder="اسم أو رقم الموديل"/></View></View>
          <Field label="المقاسات — اختياري" maxLength={100} editable={!busy} value={dimensions} onChangeText={setDimensions} placeholder="مثال: العرض ١٢٠ × العمق ٦٠ سم"/>
        </OasisSurface>

        <OasisSurface oasisSurface="card" style={styles.card}>
          <View style={styles.sectionHeading}><Truck size={18} color={OASIS.colors.primary}/><Text style={styles.sectionTitle}>السعر والاستلام</Text></View>
          {mode === 'بيع' || isMerchant ? <>
            <View style={styles.choices}><Choice label="سعر محدد" selected={!negotiable} disabled={busy} onPress={()=>setNegotiable(false)}/><Choice label="بالتفاوض" selected={negotiable} disabled={busy} onPress={()=>setNegotiable(true)}/></View>
            {!negotiable && <Field label="السعر بالريال السعودي *" maxLength={12} editable={!busy} value={price} onChangeText={setPrice} placeholder="مثال: ١٥٠ أو 150.50" keyboardType="decimal-pad"/>}
          </> : <Text style={styles.hint}>لا يُطلب سعر لهذا النوع من الإعلانات.</Text>}
          <Text style={styles.label}>طريقة تسليم المنتج</Text>
          <View style={styles.choices}>{['استلام من الموقع','توصيل بالتنسيق','استلام أو توصيل'].map(value=><Choice key={value} label={value} selected={delivery===value} disabled={busy} onPress={()=>setDelivery(value)}/>)}</View>
          <Text style={styles.hint}>يُنسّق وقت الاستلام والتوصيل والتكلفة عبر المحادثة. لا تُضف رقم منزلك أو بياناتك الخاصة في الوصف.</Text>
        </OasisSurface>

        <OasisSurface oasisSurface="card" style={styles.card}>
          <View style={styles.sectionHeading}><MapPin size={18} color={OASIS.colors.primary}/><Text style={styles.sectionTitle}>مكان المنتج الحالي *</Text></View>
          <Text style={styles.hint}>قف بجانب المنتج ثم حدّد موقعك. نطلب قراءة حديثة بدقة ١٠٠ متر أو أفضل، ونعيد التحقق قبل النشر.</Text>
          <Pressable oasisKind="plain" accessibilityRole="button" accessibilityLabel="تحديد موقعي الحالي عند المنتج" disabled={locating || busy || !capabilities.can_publish_products} onPress={()=>void locateProduct()} style={styles.locateButton}>
            {locating ? <ActivityIndicator color={OASIS.colors.primary}/> : position ? <RefreshCw size={18} color={OASIS.colors.primary}/> : <Navigation size={18} color={OASIS.colors.primary}/>}
            <Text style={styles.locateText}>{locating ? 'جارٍ تحديد الموقع الفعلي…' : position ? 'تحديث الموقع الحالي' : 'تحديد موقعي الآن'}</Text>
          </Pressable>
          {position ? <View style={styles.locationResult}><ShieldCheck size={20} color={OASIS.colors.primary}/><View style={{flex:1,gap:5}}><Text style={styles.sectionTitle}>{city} · حي {district.replace(/^حي\s+/u,'')}</Text><Text style={styles.hint}>دقة الجهاز نحو {Math.ceil(position.accuracy).toLocaleString('ar-SA')} متر · وقت القراءة {new Date(position.timestamp).toLocaleTimeString('ar-SA',{hour:'2-digit',minute:'2-digit'})}</Text></View></View> : <Text style={styles.hint}>لم يتم تأكيد الموقع الحالي بعد. عنوان الحساب وحده لا يكفي للنشر.</Text>}
          {!!locationError && <Text accessibilityRole="alert" style={styles.errorText}>{locationError}</Text>}
          <Pressable oasisKind="plain" accessibilityRole="checkbox" accessibilityState={{checked:productPresent,disabled:!position||busy}} disabled={!position || busy} onPress={()=>{setProductPresent(!productPresent);setPreview(false);}} style={styles.confirmRow}><View style={[styles.checkbox,productPresent && styles.checked]}>{productPresent && <Check size={15} color="#ffffff"/>}</View><Text style={[styles.hint,{flex:1,color:OASIS.colors.ink}]}>أؤكد أن المنتج معي الآن في هذا الموقع، وأن تفاصيل حالته صحيحة.</Text></Pressable>
          <View style={styles.privacyNote}><Info size={16} color={OASIS.colors.muted}/><Text style={[styles.hint,{flex:1}]}>تُستخدم خدمات OpenStreetMap وArcGIS لتحديد المدينة والحي. لا نحفظ إحداثيات الجهاز في الإعلان؛ يظهر للعموم اسم المدينة والحي فقط. قراءة الجهاز لا تثبت وجود المنتج وحدها.</Text></View>
          <Pressable disabled={busy || locating} onPress={()=>router.push('/locations')}><Text style={styles.locateText}>مراجعة موقع الحساب إذا اختلف عن موقعك الحالي</Text></Pressable>
        </OasisSurface>

        {!!formError && <View accessibilityRole="alert" style={styles.errorBox}><Text style={styles.errorText}>{formError}</Text></View>}
        {preview && <OasisSurface oasisSurface="card" style={styles.card}><View style={styles.sectionHeading}><ClipboardCheck size={18} color={OASIS.colors.primary}/><Text style={styles.sectionTitle}>مراجعة الإعلان</Text></View>{image && <Image source={{uri:image.uri}} style={styles.reviewImage}/>}<Text style={styles.heroTitle}>{title.trim()}</Text><Text style={styles.ownerName}>{negotiable ? 'السعر بالتفاوض' : `${parseProductPrice(price)?.toLocaleString('ar-SA')} ر.س`}</Text><Text style={styles.hint}>{detailDescription}</Text><Text style={styles.hint}>{city} · {district} · يظهر الموقع العام فقط</Text></OasisSurface>}
        {!preview && <Pressable oasisKind="plain" style={styles.locateButton} disabled={busy||locating} onPress={()=>{const error=validateProduct();setFormError(error);if(!error)setPreview(true);}}><ClipboardCheck size={18} color={OASIS.colors.primary}/><Text style={styles.locateText}>معاينة الإعلان قبل النشر</Text></Pressable>}

        <Pressable oasisVariant="primary" oasisKind="action" accessibilityLabel="تأكيد الموقع ونشر المنتج" style={[styles.submit,(!position || !productPresent || !capabilities.can_publish_products) && {opacity:.5}]} onPress={() => void saveProduct()} disabled={busy || locating || !position || !productPresent || !capabilities.can_publish_products}>

          {busy ? <ActivityIndicator color={OASIS.colors.surface} /> : <ShoppingBag size={18} color={OASIS.colors.surface} />}
          <Text style={styles.submitText}>{busy ? busyMessage : 'تأكيد الموقع ونشر المنتج'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Field({ label, multiline, ...props }: any) {
  return (
    <View style={styles.field}>
      <View style={styles.fieldLabel}><Text style={styles.label}>{label}</Text>{props.maxLength && <Text style={styles.hint}>{(props.value?.length||0).toLocaleString('ar-SA')} / {props.maxLength.toLocaleString('ar-SA')}</Text>}</View>
      <TextInput {...props} accessibilityLabel={label} multiline={multiline} textAlign="right" placeholderTextColor="#94A3B8" style={[styles.input, multiline && styles.multiline]} />
    </View>
  );
}

function Choice({label,selected,disabled,onPress}:{label:string;selected:boolean;disabled?:boolean;onPress:()=>void}){
  return <Pressable oasisKind="plain" accessibilityRole="button" accessibilityState={{selected,disabled}} disabled={disabled} onPress={onPress} style={[styles.choice,selected&&styles.choiceSelected]}><Text style={[styles.choiceText,selected&&{color:OASIS.colors.primary}]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F9F8' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#F7F9F8' },
  loading: { color: OASIS.colors.muted, fontSize: 12, fontWeight: '700' },
  content: { padding: 15, paddingBottom: 24, maxWidth: 720, width: '100%', alignSelf: 'center', gap: 12 },
  intro:{padding:16,borderRadius:22,backgroundColor:OASIS.colors.surface,borderWidth:1,borderColor:OASIS.colors.line,alignItems:'flex-end',gap:6},
  introIcon:{width:46,height:46,borderRadius:16,backgroundColor:OASIS.colors.soft,alignItems:'center',justifyContent:'center'},
  steps:{flexDirection:'row-reverse',gap:14,marginTop:8,width:'100%',justifyContent:'space-between'},
  step:{flexDirection:'row-reverse',alignItems:'center',gap:5},
  stepNumber:{fontSize:11,fontWeight:'700',color:OASIS.colors.primary,backgroundColor:OASIS.colors.soft,borderRadius:12,paddingHorizontal:7,paddingVertical:4},
  sectionHeading:{flexDirection:'row-reverse',alignItems:'center',gap:8},
  twoColumns:{flexDirection:'row-reverse',gap:10},
  choices:{flexDirection:'row-reverse',flexWrap:'wrap',gap:8},
  choice:{minHeight:40,paddingHorizontal:12,paddingVertical:9,borderRadius:20,borderWidth:1,borderColor:OASIS.colors.line,backgroundColor:OASIS.colors.surface,justifyContent:'center'},
  choiceSelected:{borderColor:OASIS.colors.primary,backgroundColor:OASIS.colors.soft},
  choiceText:{fontSize:12,color:OASIS.colors.muted,fontWeight:'600'},
  fieldLabel:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'space-between',gap:6},
  locateButton:{flexDirection:'row-reverse',gap:8,minHeight:48,alignItems:'center',justifyContent:'center',borderRadius:16,padding:12,backgroundColor:OASIS.colors.soft,borderWidth:1,borderColor:OASIS.colors.line},
  locateText:{color:OASIS.colors.primary,fontSize:12,fontWeight:'600',textAlign:'right'},
  locationResult:{flexDirection:'row-reverse',gap:10,alignItems:'center',padding:12,borderRadius:14,backgroundColor:OASIS.colors.soft},
  confirmRow:{flexDirection:'row-reverse',gap:9,alignItems:'center',paddingVertical:10,minHeight:48},
  checkbox:{width:24,height:24,borderRadius:7,borderWidth:1,borderColor:OASIS.colors.muted,alignItems:'center',justifyContent:'center'},
  checked:{backgroundColor:OASIS.colors.primary,borderColor:OASIS.colors.primary},
  privacyNote:{flexDirection:'row-reverse',gap:7,alignItems:'flex-start'},
  errorBox:{padding:13,borderRadius:14,borderWidth:1,borderColor:OASIS.colors.danger,backgroundColor:OASIS.colors.dangerSoft},
  errorText:{fontSize:12,color:OASIS.colors.danger,textAlign:'right',lineHeight:22},
  reviewImage:{width:'100%',height:210,borderRadius:14},
  heroTitle: { color: OASIS.colors.ink, fontSize: 22, fontWeight: '700', textAlign: 'right', marginTop: 4 },
  heroSub: { color: OASIS.colors.muted, fontSize: 11.5, lineHeight: 19, textAlign: 'right', marginBottom: 5 },
  kindCard: { minHeight: 78, borderRadius: 14, backgroundColor: OASIS.colors.surface, borderWidth: 1, borderColor: OASIS.colors.line, padding: 12, flexDirection: 'row-reverse', alignItems: 'center', gap: 11 },
  kindDisabled: { opacity: 0.55 },
  kindIcon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  kindCopy: { flex: 1, alignItems: 'flex-end' },
  kindTitle: { color: OASIS.colors.ink, fontSize: 14, fontWeight: '700' },
  kindSub: { color: OASIS.colors.muted, fontSize: 11, marginTop: 3, textAlign: 'right' },
  ownerCard: { minHeight: 64, borderRadius: 16, backgroundColor: OASIS.colors.soft, borderWidth: 1, borderColor: OASIS.colors.soft, padding: 11, flexDirection: 'row-reverse', alignItems: 'center', gap: 9 },
  ownerIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: OASIS.colors.surface, alignItems: 'center', justifyContent: 'center' },
  ownerCopy: { flex: 1, alignItems: 'flex-end' },
  ownerLabel: { color: OASIS.colors.muted, fontSize: 11, fontWeight: '700' },
  ownerName: { color: OASIS.colors.deep, fontSize: 12.5, fontWeight: '700', marginTop: 2 },
  card: { backgroundColor: OASIS.colors.surface, borderRadius: 20, borderWidth: 1, borderColor: OASIS.colors.line, padding: 16, gap: 13 },
  sectionTitle: { color: OASIS.colors.ink, fontSize: 13, fontWeight: '700', textAlign: 'right' },
  imageActions: { flexDirection: 'row-reverse', gap: 8 },
  imageButton: { flex: 1, minHeight: 72, borderRadius: 14, backgroundColor: OASIS.colors.soft, borderWidth: 1, borderStyle: 'dashed', borderColor: '#A7F3D0', alignItems: 'center', justifyContent: 'center', gap: 5 },
  imageButtonText: { color: '#0F766E', fontSize: 11, fontWeight: '700' },
  imagePreview: { height: 210, borderRadius: 15, overflow: 'hidden', position: 'relative', backgroundColor: '#F1F5F9' },
  image: { width: '100%', height: '100%' },
  removeImage: { position: 'absolute', top: 8, left: 8, width: 32, height: 32, borderRadius: 16, backgroundColor: OASIS.colors.surface, alignItems: 'center', justifyContent: 'center' },
  modeRow: { flexDirection: 'row-reverse', gap: 7 },
  mode: { flex: 1, minHeight: 42, borderRadius: 12, backgroundColor: '#F1F5F9', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 5 },
  modeActive: { backgroundColor: '#0F766E' },
  modeText: { color: OASIS.colors.muted, fontSize: 11, fontWeight: '700' },
  modeTextActive: { color: OASIS.colors.surface },
  field: { gap: 5 },
  label: { color: OASIS.colors.muted, fontSize: 11, fontWeight: '700', textAlign: 'right' },
  input: { minHeight: 48, borderRadius: 13, backgroundColor: OASIS.colors.background, borderWidth: 1, borderColor: OASIS.colors.line, paddingHorizontal: 12, color: OASIS.colors.ink, fontSize: 16 },
  multiline: { minHeight: 96, textAlignVertical: 'top', paddingTop: 10 },
  hint: { color: '#94A3B8', fontSize: 11, lineHeight: 17, textAlign: 'right' },
  submit: { minHeight: 52, borderRadius: 26, backgroundColor: OASIS.colors.primary, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 7 },
  submitText: { color: OASIS.colors.surface, fontSize: 13, fontWeight: '700' },
});
