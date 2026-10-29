import { OasisPressable as Pressable, OasisTextInput as TextInput, OasisSurface } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View, Switch, ActivityIndicator, Platform, Image } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import {
  MapPin,
  Camera,
  ImagePlus,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  Star,
  Phone,
  Clock3,
  Navigation, ShieldCheck, ClipboardCheck, FileText, Wrench, Truck, Tag,
} from 'lucide-react-native';
import { AppHeader } from '@/components/shared/AppHeader';
import { readCurrentProductPosition } from '@/lib/productDeviceLocation';
import { reverseGeocodeDeviceLocation } from '@/lib/deviceLocation';
import { normalizeSaudiLocationName } from '@/lib/saudiLocations';
import { safeServiceMapUrl } from '@/lib/servicePublishingRules';
import { confirmProductPosition, normalizeProductNumber, parseProductPrice, productPositionError, type ProductPosition } from '@/lib/productLocationRules';
import {
  LISTING_TYPES,
  DELIVERY_MODES,
  ListingTypeId,
  DeliveryModeId,
  formatServicePrice,
} from '@/lib/serviceTypes';
import {
  LocalServiceImage,
  MAX_SERVICE_IMAGES,
  pickServiceImages,
  uploadServiceImages,
} from '@/lib/serviceUpload';

type PriceType = 'fixed' | 'range' | 'negotiable';
const STEPS = ['نوع النشاط', 'الصور والتفاصيل', 'السعر والتواصل'];

export default function NewService() {
  const [step, setStep] = useState(0);
  const [authChecking, setAuthChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [capabilities, setCapabilities] = useState<any>({});

  const [typeId, setTypeId] = useState<ListingTypeId | null>(null);
  const [subcategory, setSubcategory] = useState('');
  const [images, setImages] = useState<LocalServiceImage[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [shopName, setShopName] = useState('');
  const [extra, setExtra] = useState<Record<string, string>>({});

  const [priceType, setPriceType] = useState<PriceType>('fixed');
  const [price, setPrice] = useState('');
  const [priceTo, setPriceTo] = useState('');
  const [modes, setModes] = useState<DeliveryModeId[]>([]);
  const [workingHours, setWorkingHours] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [available, setAvailable] = useState(true);
  const [servicePosition,setServicePosition]=useState<ProductPosition|null>(null);
  const [locating,setLocating]=useState(false);
  const [locationError,setLocationError]=useState('');
  const [serviceConditions,setServiceConditions]=useState('');
  const [duration,setDuration]=useState('');
  const [responseTime,setResponseTime]=useState('');
  const [includes,setIncludes]=useState('');
  const [termsAccepted,setTermsAccepted]=useState(false);
  const [saveError,setSaveError]=useState('');
  const saveLock=useRef(false);
  const locationRevision=useRef(0);
  const mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;locationRevision.current++;};},[]);

  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');

  const type = useMemo(() => LISTING_TYPES.find((t) => t.id === typeId) || null, [typeId]);

  useEffect(() => {
    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        setAuthChecking(false);
        router.replace('/auth');
        return;
      }
      const [profileRes, capsRes] = await Promise.all([
        supabase.from('profiles').select('region,city,district,account_type,is_verified,freelance_trade,display_name').eq('id', authData.user.id).maybeSingle(),
        supabase.rpc('hayna_my_account_capabilities'),
      ]);
      if(profileRes.error)throw profileRes.error;
      if(capsRes.error)throw capsRes.error;
      if (!capsRes.data?.can_publish_services) {
        setAuthChecking(false);
        Alert.alert('يتطلب حسابًا مهنيًا معتمدًا', 'إضافة الخدمات متاحة للحساب التجاري أو العمل الحر أو مقدم الخدمة بعد موافقة الإدارة.');
        router.replace({ pathname: '/profile', params: { tab: 'profile' } });
        return;
      }
      setCapabilities(capsRes.data || {});
      const p = profileRes.data;
      if (p?.city) {
        setCity(p.city);
        if (p?.district) setDistrict(p.district);
      }
      if (p?.account_type === 'merchant' && p?.freelance_trade) setShopName(p.freelance_trade);
      setAuthChecking(false);
    })().catch(cause=>{setAuthChecking(false);setSaveError((cause as Error)?.message || 'تعذر التحقق من الحساب.');});
  }, []);

  function chooseType(id: ListingTypeId) {
    if(!capabilities.can_manage_business && ['home_family','home_sale','shop','product_in_shop'].includes(id))return;
    if (id !== typeId) {
      const t = LISTING_TYPES.find((x) => x.id === id)!;
      setTypeId(id);
      setSubcategory('');
      setExtra({});
      setModes(t.defaultModes);
      locationRevision.current++;setLocating(false);setServicePosition(null);setTermsAccepted(false);
    }
    setStep(1);
  }

  async function addImages(fromCamera: boolean) {
    try {
      const picked = await pickServiceImages(MAX_SERVICE_IMAGES - images.length, fromCamera);
      if (picked.length) setImages((prev) => [...prev, ...picked].slice(0, MAX_SERVICE_IMAGES));
    } catch (e: any) {
      Alert.alert('الصور', e.message || 'تعذر اختيار الصور');
    }
  }

  function makeCover(index: number) {
    setImages((prev) => [prev[index], ...prev.filter((_, i) => i !== index)]);
  }

  function toggleMode(id: DeliveryModeId) {
    if(type?.nationwide && id!=='remote')return;
    setModes((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));
  }

  const validPrice = (v: string) => parseProductPrice(v)!==null && !Number.isNaN(parseProductPrice(v));

  async function locateService(){
    if(locating || busy)return;
    const revision=++locationRevision.current;
    setLocating(true);setLocationError('');setServicePosition(null);
    try{
      const auth=await supabase.auth.getUser();if(!auth.data.user)throw new Error('سجّل الدخول لتأكيد موقع الخدمة.');
      const expected=await supabase.from('profiles').select('city,district').eq('id',auth.data.user.id).single();if(expected.error)throw expected.error;
      const fix=await readCurrentProductPosition();
      let timeout:ReturnType<typeof setTimeout>|undefined;
      let place;
      try{place=await Promise.race([reverseGeocodeDeviceLocation(fix),new Promise<never>((_,reject)=>{timeout=setTimeout(()=>reject(new Error('تعذر جلب اسم الحي. تحقق من الاتصال وأعد المحاولة.')),20000);})]);}finally{if(timeout)clearTimeout(timeout);}
      if(!place?.city || !place.district || place.isOutsideKSA)throw new Error('تعذر تحديد مدينة وحي داخل المملكة. أعد المحاولة بالموقع الدقيق.');
      if(normalizeSaudiLocationName(place.city)!==normalizeSaudiLocationName(expected.data.city||'') || normalizeSaudiLocationName(place.district)!==normalizeSaudiLocationName(expected.data.district||''))throw new Error('موقع الجهاز يختلف عن حي الحساب. حدّث موقع الحساب ثم أعد التحقق، ولا تختر عنوانًا يدويًا للخدمة.');
      const error=productPositionError(fix);if(error)throw new Error(error);
      if(mounted.current&&revision===locationRevision.current){setServicePosition(fix);setCity(expected.data.city);setDistrict(expected.data.district);}
    }catch(cause){if(mounted.current&&revision===locationRevision.current)setLocationError((cause as Error).message);}finally{if(mounted.current&&revision===locationRevision.current)setLocating(false);}
  }

  function validateStep(s: number): string | null {
    if (s === 0 && !type) return 'اختر نوع نشاطك أولاً.';
    if (s === 1) {
      if (name.trim().length<4) return 'اكتب عنوانًا واضحًا من ٤ أحرف على الأقل.';
      if (description.trim().length<20) return 'أضف وصفًا من ٢٠ حرفًا على الأقل يوضح ما تقدمه وحدود الخدمة.';
      if(!images.length)return 'أضف صورة تعبّر عن الخدمة قبل النشر.';
      if(!subcategory)return 'اختر التصنيف المناسب للخدمة.';
      if(extra.map_link?.trim()&&!safeServiceMapUrl(extra.map_link))return 'استخدم رابط خرائط HTTPS صحيحًا من خرائط Google أو Apple أو OpenStreetMap.';
      if (type?.showShopName && !shopName.trim()) return 'اكتب اسم المحل.';
    }
    if (s === 2) {
      if (priceType !== 'negotiable' && !validPrice(price)) return 'اكتب سعراً صحيحاً مثل 50 أو 75.50.';
      if (priceType === 'range' && (!validPrice(priceTo) || Number(parseProductPrice(priceTo)) < Number(parseProductPrice(price)))) return 'السعر "إلى" يجب أن يكون أكبر من "من".';
      if (!modes.length) return 'اختر طريقة تقديم واحدة على الأقل.';
      if (whatsapp.trim() && !/^(\+?966|0)?5\d{8}$/.test(normalizeProductNumber(whatsapp).replace(/\s/g, ''))) return 'رقم الواتساب غير صحيح (مثال: 05xxxxxxxx).';
      if(!type?.nationwide && !servicePosition)return 'حدّد موقعك الحالي للتحقق من حي تقديم الخدمة.';
      if(!type?.nationwide && servicePosition){const error=productPositionError(servicePosition);if(error)return error;}
      if(!termsAccepted)return 'راجع شروط تقديم الخدمة وأكّد صحة البيانات قبل النشر.';
    }
    return null;
  }

  function next() {
    const err = validateStep(step);
    if (err) {setSaveError(err);return;}
    setSaveError('');
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function back() {
    setSaveError('');
    if (step === 0) return router.canGoBack() ? router.back() : router.replace('/market');
    setStep((s) => s - 1);
  }

  async function save() {
    if(saveLock.current || locating)return;
    for (const s of [0, 1, 2]) {
      const err = validateStep(s);
      if (err) { setStep(s);setSaveError(err);return; }
    }
    saveLock.current=true;setBusy(true);setSaveError('');
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { setBusy(false); return router.replace('/auth'); }
      const providerId = u.user.id;
      const [access,location]=await Promise.all([supabase.rpc('hayna_my_account_capabilities'),supabase.from('profiles').select('city,district').eq('id',providerId).single()]);
      if(access.error || !access.data?.can_publish_services)throw new Error('صلاحية نشر الخدمات غير متاحة حاليًا. راجع توثيق حسابك.');
      if(location.error)throw location.error;
      if(!type!.nationwide && (normalizeSaudiLocationName(location.data.city||'')!==normalizeSaudiLocationName(city) || normalizeSaudiLocationName(location.data.district||'')!==normalizeSaudiLocationName(district)))throw new Error('تغير موقع الحساب. حدّث الصفحة وأعد التحقق من الموقع.');
      if(access.data.can_manage_business){const result=await supabase.rpc('hayna_ensure_my_business');if(result.error)throw result.error;}
      if(!type!.nationwide)confirmProductPosition(servicePosition!,await readCurrentProductPosition());

      const imageUrls = images.length ? await uploadServiceImages(providerId, images) : [];

      const details: Record<string, string> = {};
      Object.entries(extra).forEach(([k, v]) => { if (v && v.trim()) details[k] = v.trim(); });
      if(serviceConditions.trim())details.service_conditions=serviceConditions.trim();
      if(duration.trim())details.estimated_duration=duration.trim();
      if(responseTime.trim())details.response_time=responseTime.trim();
      if(includes.trim())details.included=includes.trim();
      details.terms_accepted_at=new Date().toISOString();

      const payload: Record<string, any> = {
        provider_id: providerId,
        moderation_status: 'pending',
        name: name.trim(),
        description: description.trim(),
        category: subcategory || type!.label,
        city: location.data.city || null,
        district: location.data.district || null,
        price_from: priceType === 'negotiable' ? null : parseProductPrice(price),
        price_to: priceType === 'range' ? parseProductPrice(priceTo) : null,
        price_type: priceType,
        available_now: available,
        listing_type: type!.id,
        subcategory: subcategory || null,
        images: imageUrls,
        cover_url: imageUrls[0] || null,
        delivery_modes: modes,
        details,
        shop_name: shopName.trim() || null,
        working_hours: workingHours.trim() || null,
        whatsapp: normalizeProductNumber(whatsapp).replace(/\s/g, '') || null,
      };

      if(!type!.nationwide)confirmProductPosition(servicePosition!,await readCurrentProductPosition());
      const result = await supabase.from('services').insert(payload).select('id').single();

      setBusy(false);
      if (result.error) {
        console.error('services insert failed:', result.error);
        Alert.alert('تعذر نشر العرض', result.error.message);
      } else {
        Alert.alert('تم استلام العرض للمراجعة', 'سيظهر في سوق الحي بعد اعتماده من الإدارة.');
        router.replace({ pathname: '/profile', params: { tab: 'content' } });
      }
    } catch (e: any) {
      setBusy(false);
      console.error('new service save error:', e);
      setSaveError(e.message || 'حدث خطأ أثناء حفظ العرض.');
    } finally {
      saveLock.current=false;setBusy(false);
    }
  }

  if (authChecking) {
    return (
      <View style={[styles.loadingScreen, { backgroundColor: 'transparent' }]}>
        <ActivityIndicator size="large" color={OASIS.colors.primary} />
        <Text style={styles.loadingText}>نجهز صفحة إضافة العرض…</Text>
      </View>
    );
  }
  if(!capabilities.can_publish_services)return <View style={styles.loadingScreen}><ShieldCheck size={34} color={OASIS.colors.primary}/><Text style={styles.stepTitle}>الخدمات للحساب المهني المعتمد</Text><Text style={styles.sectionHint}>{saveError || 'راجع توثيق الحساب وصلاحياته قبل إضافة خدمة.'}</Text><Pressable onPress={()=>router.replace('/profile?tab=verification')} style={styles.nextAction}><Text style={styles.nextActionText}>مراجعة التوثيق</Text></Pressable></View>;

  const previewPrice = formatServicePrice({
    price_type: priceType,
    price_from: price && validPrice(price) ? parseProductPrice(price) : null,
    price_to: priceTo && validPrice(priceTo) ? parseProductPrice(priceTo) : null,
  });

  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <AppHeader
        variant="sub"
        title="إضافة خدمة"
        subtitle={`خطوة ${step + 1} من ${STEPS.length}: ${STEPS[step]}`}
        fallbackRoute="/profile?tab=content"
      />
      <View style={styles.header}>
        <View style={styles.stepper}>
          {STEPS.map((label, i) => (
            <Pressable
              key={label}
              style={styles.stepItem}
              onPress={() => { if (i < step) setStep(i); }}
            >
              <View style={[styles.stepDot, i <= step && styles.stepDotActive]}>
                {i < step ? <Check size={12} color={OASIS.colors.surface} /> : <Text style={[styles.stepNum, i <= step && { color: OASIS.colors.surface }]}>{i + 1}</Text>}
              </View>
              <Text style={[styles.stepLabel, i === step && styles.stepLabelActive]} numberOfLines={1}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${((step + 1) / STEPS.length) * 100}%` }]} /></View>
      </View>

      {!!saveError&&<Text accessibilityRole="alert" style={{color:OASIS.colors.danger,textAlign:'right',paddingHorizontal:18,paddingVertical:10,lineHeight:20}}>{saveError}</Text>}
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {step === 0 && (
          <View>
            <Text style={styles.stepTitle}>وش نوع نشاطك؟</Text>
            <Text style={styles.stepHint}>اختر الأقرب لك، ونجهز لك الحقول المناسبة.</Text>
            <View style={styles.typeGrid}>
              {LISTING_TYPES.filter(t=>capabilities.can_manage_business || !['home_family','home_sale','shop','product_in_shop'].includes(t.id)).map((t) => {
                const active = t.id === typeId;
                return (
                  <Pressable oasisKind="card"
                    key={t.id}
                    id={`type-${t.id}`}
                    style={({ pressed }) => [styles.typeCard, active && { borderColor: t.color, backgroundColor: t.bg }, pressed && { transform: [{ scale: 0.97 }] }]}
                    onPress={() => chooseType(t.id)}
                  >
                    <View style={[styles.typeIcon, { backgroundColor: t.bg }]}><t.Icon size={22} color={t.color} /></View>
                    <Text style={styles.typeLabel}>{t.label}</Text>
                    <Text style={styles.typeHint} numberOfLines={2}>{t.hint}</Text>
                    {active && <View style={[styles.typeCheck, { backgroundColor: t.color }]}><Check size={11} color={OASIS.colors.surface} /></View>}
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {step === 1 && type && (
          <View>
            <View style={[styles.typeBanner, { backgroundColor: type.bg }]}>
              <type.Icon size={18} color={type.color} />
              <Text style={[styles.typeBannerText, { color: type.color }]}>{type.label}</Text>
              <Pressable onPress={() => setStep(0)}><Text style={styles.changeLink}>تغيير</Text></Pressable>
            </View>

            <Section title={`الصور (${images.length}/${MAX_SERVICE_IMAGES})`} hint="أول صورة هي الغلاف. أضف صورًا حقيقية توضح الخدمة أو نماذج أعمالك.">
              <ScrollView style={{ direction: 'rtl' }} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.imagesRow, { direction: 'ltr' }]}>
                {images.length < MAX_SERVICE_IMAGES && (
                  <View style={styles.addImageCol}>
                    <Pressable id="add-images-gallery" style={styles.addImageBtn} onPress={() => addImages(false)}>
                      <ImagePlus size={22} color={OASIS.colors.primary} />
                      <Text style={styles.addImageText}>من المعرض</Text>
                    </Pressable>
                    {Platform.OS !== 'web' && (
                      <Pressable oasisKind="action" style={styles.cameraBtn} onPress={() => addImages(true)}>
                        <Camera size={14} color={OASIS.colors.primary} />
                        <Text style={styles.cameraText}>كاميرا</Text>
                      </Pressable>
                    )}
                  </View>
                )}
                {images.map((img, i) => (
                  <View key={img.uri + i} style={styles.thumbWrap}>
                    <Image source={{ uri: img.uri }} style={styles.thumb} />
                    <Pressable style={styles.thumbRemove} onPress={() => setImages((p) => p.filter((_, x) => x !== i))}>
                      <X size={12} color={OASIS.colors.surface} />
                    </Pressable>
                    {i === 0 ? (
                      <View style={styles.coverBadge}><Text style={styles.coverBadgeText}>الغلاف</Text></View>
                    ) : (
                      <Pressable oasisKind="action" style={styles.makeCoverBtn} onPress={() => makeCover(i)}>
                        <Star size={10} color={OASIS.colors.surface} />
                        <Text style={styles.coverBadgeText}>غلاف</Text>
                      </Pressable>
                    )}
                  </View>
                ))}
              </ScrollView>
            </Section>

            <Section title="التصنيف">
              <View style={styles.chipsWrap}>
                {type.subcategories.map((c) => (
                  <Chip key={c} label={c} active={subcategory === c} color={type.color} onPress={() => setSubcategory(subcategory === c ? '' : c)} />
                ))}
              </View>
            </Section>

            <Section title="عنوان العرض *">
              <Field accessibilityLabel="عنوان الخدمة" value={name} onChangeText={setName} placeholder={type.titlePlaceholder} maxLength={80} />
              <Text style={styles.counter}>{name.trim().length}/80</Text>
            </Section>

            {type.showShopName && (
              <Section title="اسم المحل *">
                <Field value={shopName} onChangeText={setShopName} placeholder="مثال: بقالة النخيل" maxLength={60} />
              </Section>
            )}

            {type.extraFields.map((f) => (
              <Section key={f.key} title={f.label}>
                {f.kind === 'choice' ? (
                  <View style={styles.chipsWrap}>
                    {f.options!.map((o) => (
                      <Chip key={o} label={o} active={extra[f.key] === o} color={type.color}
                        onPress={() => setExtra((p) => ({ ...p, [f.key]: p[f.key] === o ? '' : o }))} />
                    ))}
                  </View>
                ) : (
                  <Field value={extra[f.key] || ''} onChangeText={(v) => setExtra((p) => ({ ...p, [f.key]: v }))} placeholder={f.placeholder} maxLength={200} />
                )}
              </Section>
            ))}

            <Section title="التفاصيل *">
              <Field
                value={description}
                onChangeText={setDescription}
                placeholder="اشرح ما تقدمه، المكونات أو المواصفات، وأي شروط..."
                maxLength={800}
                multiline
              />
              <Text style={styles.counter}>{description.trim().length}/800</Text>
            </Section>
            <Section title="ما الذي تتضمنه الخدمة؟" hint="وضّح الأعمال والمواد أو عدد الزيارات المشمولة؛ وتجنب الوعود غير المحددة.">
              <Field accessibilityLabel="الأعمال المشمولة بالخدمة" value={includes} onChangeText={setIncludes} placeholder="مثال: فحص الجهاز وتشخيص العطل؛ قطع الغيار غير مشمولة" maxLength={400} multiline/>
            </Section>
            <Section title="المدة المتوقعة والرد" hint="اكتب تقديرًا واقعيًا. اتفق مع العميل على الموعد النهائي قبل بدء العمل.">
              <Field accessibilityLabel="مدة تنفيذ الخدمة" value={duration} onChangeText={setDuration} placeholder="مثال: من ساعتين إلى أربع ساعات" maxLength={100} icon={<Clock3 size={16} color={OASIS.colors.muted}/>}/>
              <View style={{height:10}}/>
              <Field accessibilityLabel="وقت الرد المتوقع" value={responseTime} onChangeText={setResponseTime} placeholder="مثال: خلال يوم عمل" maxLength={100}/>
            </Section>
            <Section title="شروط الخدمة والاستثناءات" hint="وضّح رسوم الزيارة والإلغاء والضمان إن وُجد. لا تُضف شروطًا تخالف حقوق العميل.">
              <Field accessibilityLabel="شروط الخدمة" value={serviceConditions} onChangeText={setServiceConditions} placeholder="المتطلبات قبل الزيارة، ما لا يشمله السعر، سياسة تغيير الموعد..." maxLength={800} multiline/>
            </Section>
          </View>
        )}

        {step === 2 && type && (
          <View>
            <Section title="السعر">
              <View style={styles.segment}>
                {([['fixed', 'سعر ثابت'], ['range', 'من - إلى'], ['negotiable', 'حسب الاتفاق']] as [PriceType, string][]).map(([id, label]) => (
                  <Pressable key={id} style={[styles.segmentItem, priceType === id && styles.segmentItemActive]} onPress={() => setPriceType(id)}>
                    <Text style={[styles.segmentText, priceType === id && styles.segmentTextActive]}>{label}</Text>
                  </Pressable>
                ))}
              </View>
              {priceType !== 'negotiable' && (
                <View style={styles.priceRow}>
                  <View style={{ flex: 1 }}>
                    <Field value={price} onChangeText={setPrice} placeholder={priceType === 'range' ? 'من' : 'السعر'} keyboardType="numeric" maxLength={8} suffix="ر.س" />
                  </View>
                  {priceType === 'range' && (
                    <View style={{ flex: 1 }}>
                      <Field value={priceTo} onChangeText={setPriceTo} placeholder="إلى" keyboardType="numeric" maxLength={8} suffix="ر.س" />
                    </View>
                  )}
                </View>
              )}
            </Section>

            <Section title="طريقة التقديم *" hint="اختر كل ما ينطبق">
              <View style={styles.chipsWrap}>
                {DELIVERY_MODES.filter(m=>!type.nationwide || m.id==='remote').map((m) => (
                  <Chip key={m.id} label={`${m.emoji}  ${m.label}`} active={modes.includes(m.id)} color={OASIS.colors.primary} onPress={() => toggleMode(m.id)} />
                ))}
              </View>
            </Section>

            <Section title={type.nationwide ? 'موقعك (الخدمة تظهر لكل المملكة)' : 'الموقع والحي'}>
              <View style={styles.locationBtn}>
                <MapPin size={18} color={OASIS.colors.primary} />
                <Text style={styles.locationBtnText}>{city ? `${city}${district ? ` · حي ${district}` : ''}` : 'موقع الحساب غير مكتمل'}</Text>
                {servicePosition && <ShieldCheck size={18} color={OASIS.colors.primary}/>}
              </View>
              {type.nationwide ? <Text style={[styles.sectionHint,{marginTop:10}]}>خدمة عن بُعد؛ لا نطلب موقع تواجدك الدقيق، ويظل عنوان الحساب عامًا.</Text> : <>
                <Pressable oasisKind="plain" accessibilityLabel="تأكيد موقعي الحالي للخدمة" disabled={busy||locating} style={[styles.locationBtn,{marginTop:10}]} onPress={()=>void locateService()}>{locating?<ActivityIndicator color={OASIS.colors.primary}/>:<Navigation size={18} color={OASIS.colors.primary}/>}<Text style={styles.locationBtnText}>{locating?'جارٍ تحديد موقع الجهاز…':servicePosition?`تم التحقق · الدقة نحو ${Math.ceil(servicePosition.accuracy).toLocaleString('ar-SA')} متر`:'تأكيد حي الخدمة من موقعي الحالي'}</Text></Pressable>
                <Text style={[styles.sectionHint,{marginTop:8}]}>يُعاد القياس قبل النشر. نستخدم OpenStreetMap وArcGIS لتحديد المدينة والحي، دون حفظ إحداثيات الجهاز في الخدمة.</Text>
                {!!locationError&&<Text accessibilityRole="alert" style={[styles.sectionHint,{color:OASIS.colors.danger}]}>{locationError}</Text>}
                <Pressable disabled={busy||locating} onPress={()=>router.push('/locations')}><Text style={[styles.sectionHint,{color:OASIS.colors.primary,marginTop:10}]}>مراجعة موقع الحساب ثم العودة لإعادة التحقق</Text></Pressable>
              </>}
            </Section>

            <Section title="أوقات العمل (اختياري)">
              <Field value={workingHours} onChangeText={setWorkingHours} placeholder="مثال: يومياً 4م - 11م" maxLength={60} icon={<Clock3 size={16} color="#94a3b8" />} />
            </Section>

            <Section title="رقم واتساب (اختياري)" hint="بإضافته توافق على عرضه مع الخدمة. تركه فارغًا يتيح التواصل داخل التطبيق وفق إعدادات الخاص ونطاق الحي.">
              <Field value={whatsapp} onChangeText={setWhatsapp} placeholder="05xxxxxxxx" keyboardType="phone-pad" maxLength={14} icon={<Phone size={16} color="#94a3b8" />} />
            </Section>

            <View style={styles.switchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchTitle}>متاح الآن</Text>
                <Text style={styles.switchSub}>يظهر وسم "متاح" على بطاقتك</Text>
              </View>
              <Switch value={available} onValueChange={setAvailable} trackColor={{ false: OASIS.colors.line, true: '#a7f3d0' }} thumbColor={available ? OASIS.colors.primary : '#9ca3af'} />
            </View>

            <Text style={styles.previewTitle}>معاينة البطاقة</Text>
            <OasisSurface oasisSurface="card" style={styles.previewCard}>
              <View style={[styles.previewImage, { backgroundColor: type.bg }]}>
                {images[0] ? <Image source={{ uri: images[0].uri }} style={StyleSheet.absoluteFillObject} /> : <type.Icon size={34} color={type.color} />}
                <View style={styles.previewTypeBadge}><Text style={[styles.previewTypeText, { color: type.color }]}>{type.short}</Text></View>
              </View>
              <View style={{ padding: 12 }}>
                <Text style={styles.previewName} numberOfLines={1}>{name || 'عنوان العرض'}</Text>
                <Text style={styles.previewPrice}>{previewPrice}</Text>
                <Text style={styles.previewModes}>{modes.map((m) => DELIVERY_MODES.find((d) => d.id === m)?.emoji).join(' ')}</Text>
              </View>
            </OasisSurface>
            <Pressable oasisKind="plain" accessibilityRole="checkbox" accessibilityState={{checked:termsAccepted}} disabled={busy} onPress={()=>setTermsAccepted(!termsAccepted)} style={[styles.switchRow,{marginTop:14}]}><View style={[styles.stepDot,termsAccepted&&styles.stepDotActive]}>{termsAccepted&&<Check size={14} color="#fff"/>}</View><Text style={[styles.sectionHint,{flex:1,color:OASIS.colors.ink}]}>أؤكد صحة بيانات الخدمة والسعر والشروط، وأن لدي الصلاحية والمؤهلات اللازمة لتقديمها. العرض يخضع لمراجعة الإدارة قبل ظهوره.</Text></Pressable>
          </View>
        )}
      </ScrollView>

      <View style={styles.actionBar}>
        <Pressable
          disabled={busy}
          style={({ pressed }) => [styles.backAction, pressed && !busy && styles.actionPressed]}
          onPress={back}
        >
          <ChevronRight size={18} color={OASIS.colors.muted} />
          <Text style={styles.backActionText}>{step === 0 ? 'إلغاء' : 'رجوع'}</Text>
        </Pressable>

        {step < STEPS.length - 1 ? (
          <Pressable
            disabled={busy}
            style={({ pressed }) => [styles.nextAction, pressed && !busy && styles.actionPressed]}
            onPress={next}
          >
            <Text style={styles.nextActionText}>التالي</Text>
            <ChevronLeft size={19} color={OASIS.colors.surface} />
          </Pressable>
        ) : (
          <Pressable
            disabled={busy}
            style={({ pressed }) => [styles.nextAction, busy && styles.actionDisabled, pressed && !busy && styles.actionPressed]}
            onPress={() => void save()}
          >
            {busy ? <ActivityIndicator size="small" color={OASIS.colors.surface} /> : <Check size={19} color={OASIS.colors.surface} />}
            <Text style={styles.nextActionText}>{busy ? 'جارٍ التحقق والحفظ…' : 'إرسال الخدمة للمراجعة'}</Text>
          </Pressable>
        )}
      </View>

    </View>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={{flexDirection:'row-reverse',alignItems:'center',gap:8}}>{title.includes('السعر')?<Tag size={17} color={OASIS.colors.primary}/>:title.includes('الموقع')||title.includes('موقعك')?<MapPin size={17} color={OASIS.colors.primary}/>:title.includes('صور')?<Camera size={17} color={OASIS.colors.primary}/>:title.includes('المدة')||title.includes('أوقات')?<Clock3 size={17} color={OASIS.colors.primary}/>:title.includes('طريقة')?<Truck size={17} color={OASIS.colors.primary}/>:<FileText size={17} color={OASIS.colors.primary}/>}<Text style={styles.sectionTitle}>{title}</Text></View>
      {hint ? <Text style={styles.sectionHint}>{hint}</Text> : null}
      <View style={{ marginTop: 10 }}>{children}</View>
    </View>
  );
}

function Chip({ label, active, color, onPress }: { label: string; active: boolean; color: string; onPress: () => void }) {
  return (
    <Pressable oasisKind="chip" onPress={onPress} style={[styles.chip, active && { backgroundColor: color, borderColor: color }]}>
      <Text style={[styles.chipText, active && { color: OASIS.colors.surface }]}>{label}</Text>
    </Pressable>
  );
}

function Field({ multiline, suffix, icon, ...props }: React.ComponentProps<typeof TextInput> & { suffix?: string; icon?: React.ReactNode }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.field, multiline && { minHeight: 120, alignItems: 'flex-start' }, focused && styles.fieldFocused]}>
      {icon}
      <TextInput
        {...props}
        accessibilityLabel={props.accessibilityLabel || props.placeholder || 'تفاصيل الخدمة'}
        multiline={multiline}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholderTextColor="#9ca3af"
        textAlign="right"
        style={[styles.input, multiline && { minHeight: 100, textAlignVertical: 'top' }]}
      />
      {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: OASIS.colors.background, gap: 12 },
  loadingText: { color: OASIS.colors.muted, fontSize: 13, fontWeight: '700' },
  container: { flex: 1, backgroundColor: OASIS.colors.background },
  header: {
    backgroundColor: OASIS.colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: OASIS.colors.line,
  },
  stepper: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 2, gap: 6 },
  stepItem: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  stepDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  stepDotActive: { backgroundColor: OASIS.colors.primary },
  stepNum: { color: OASIS.colors.muted, fontSize: 11, fontWeight: '700' },
  stepLabel: { color: '#94a3b8', fontSize: 11, fontWeight: '700', flexShrink: 1 },
  stepLabelActive: { color: OASIS.colors.primary, fontWeight: '700' },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: '#f1f5f9', marginTop: 10, overflow: 'hidden', flexDirection: 'row-reverse' },
  progressFill: { height: 4, backgroundColor: OASIS.colors.primary, borderRadius: 2 },
  scroll: { padding: 16, paddingBottom: 112, width: '100%', maxWidth: 720, alignSelf: 'center' },
  actionBar: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingTop: 10, paddingBottom: Platform.OS === 'ios' ? 22 : 14, backgroundColor: OASIS.colors.surface, borderTopWidth: 1, borderTopColor: OASIS.colors.line },
  nextAction: { flex: 1, minHeight: 50, borderRadius: 15, backgroundColor: OASIS.colors.primary, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
  nextActionText: { color: OASIS.colors.surface, fontSize: 14, fontWeight: '700' },
  backAction: { minWidth: 104, minHeight: 50, borderRadius: 15, backgroundColor: '#f1f5f9', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 14 },
  backActionText: { color: OASIS.colors.muted, fontSize: 13, fontWeight: '700' },
  actionPressed: { opacity: 0.78 },
  actionDisabled: { opacity: 0.6 },

  stepTitle: { fontSize: 20, fontWeight: '700', color: OASIS.colors.ink, textAlign: 'right' },
  stepHint: { fontSize: 13, color: OASIS.colors.muted, textAlign: 'right', marginTop: 4, marginBottom: 16 },
  typeGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  typeCard: {
    width: '48.5%', backgroundColor: OASIS.colors.surface, borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: '#eef2f7',
    alignItems: 'flex-end', minHeight: 128, position: 'relative',
  },
  typeIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  typeLabel: { fontSize: 15, fontWeight: '700', color: OASIS.colors.ink, textAlign: 'right' },
  typeHint: { fontSize: 11.5, color: OASIS.colors.muted, textAlign: 'right', marginTop: 4, lineHeight: 17 },
  typeCheck: { position: 'absolute', top: 10, left: 10, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },

  typeBanner: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, marginBottom: 14 },
  typeBannerText: { flex: 1, fontSize: 14, fontWeight: '700', textAlign: 'right' },
  changeLink: { color: OASIS.colors.muted, fontSize: 12, fontWeight: '600', textDecorationLine: 'underline' },

  section: { backgroundColor: OASIS.colors.surface, borderRadius: 20, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: OASIS.colors.line },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: OASIS.colors.ink, textAlign: 'right' },
  sectionHint: { fontSize: 11.5, color: '#94a3b8', textAlign: 'right', marginTop: 3 },

  imagesRow: { flexDirection: 'row-reverse', gap: 10 },
  addImageCol: { gap: 6 },
  addImageBtn: { width: 96, height: 96, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: '#6ee7b7', backgroundColor: OASIS.colors.soft, alignItems: 'center', justifyContent: 'center', gap: 6 },
  addImageText: { fontSize: 11, color: OASIS.colors.primary, fontWeight: '600' },
  cameraBtn: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 5, borderRadius: 10, backgroundColor: OASIS.colors.soft },
  cameraText: { fontSize: 11, color: OASIS.colors.primary, fontWeight: '600' },
  thumbWrap: { width: 96, height: 96, borderRadius: 16, overflow: 'hidden', backgroundColor: '#f1f5f9' },
  thumb: { width: '100%', height: '100%' },
  thumbRemove: { position: 'absolute', top: 6, left: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(15,23,42,0.65)', alignItems: 'center', justifyContent: 'center' },
  coverBadge: { position: 'absolute', bottom: 6, right: 6, backgroundColor: OASIS.colors.primary, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  makeCoverBtn: { position: 'absolute', bottom: 6, right: 6, flexDirection: 'row-reverse', alignItems: 'center', gap: 3, backgroundColor: 'rgba(15,23,42,0.6)', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  coverBadgeText: { color: OASIS.colors.surface, fontSize: 11, fontWeight: '700' },

  chipsWrap: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 12, backgroundColor: OASIS.colors.background, borderWidth: 1, borderColor: OASIS.colors.line },
  chipText: { fontSize: 12.5, color: OASIS.colors.muted, fontWeight: '700' },

  field: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, backgroundColor: OASIS.colors.background, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, borderWidth: 1, borderColor: OASIS.colors.line },
  fieldFocused: { borderColor: OASIS.colors.primary, backgroundColor: OASIS.colors.surface },
  input: { flex: 1, color: OASIS.colors.ink, fontSize: 14, padding: 0, ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as any) : {}) },
  suffix: { color: OASIS.colors.muted, fontSize: 12, fontWeight: '600' },
  counter: { color: '#cbd5e1', fontSize: 11, fontWeight: '700', textAlign: 'left', marginTop: 5 },

  segment: { flexDirection: 'row-reverse', backgroundColor: '#f1f5f9', borderRadius: 12, padding: 3, marginBottom: 10 },
  segmentItem: { flex: 1, paddingVertical: 9, borderRadius: 10, alignItems: 'center' },
  segmentItemActive: { backgroundColor: OASIS.colors.surface, shadowColor: '#000', shadowOpacity: 0, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  segmentText: { fontSize: 12.5, color: OASIS.colors.muted, fontWeight: '700' },
  segmentTextActive: { color: OASIS.colors.primary, fontWeight: '700' },
  priceRow: { flexDirection: 'row-reverse', gap: 10 },

  locationBtn: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, backgroundColor: OASIS.colors.background, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, borderWidth: 1, borderColor: OASIS.colors.line },
  locationBtnText: { flex: 1, color: OASIS.colors.ink, fontSize: 13.5, fontWeight: '700', textAlign: 'right' },

  switchRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, backgroundColor: OASIS.colors.surface, borderRadius: 14, padding: 14, marginBottom: 18, borderWidth: 1, borderColor: '#f1f5f9' },
  switchTitle: { color: OASIS.colors.ink, fontSize: 14, fontWeight: '700', textAlign: 'right' },
  switchSub: { color: OASIS.colors.muted, fontSize: 11.5, textAlign: 'right', marginTop: 2 },

  previewTitle: { fontSize: 13, fontWeight: '700', color: OASIS.colors.muted, textAlign: 'right', marginBottom: 8 },
  previewCard: { width: 180, alignSelf: 'flex-end', backgroundColor: OASIS.colors.surface, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#eef2f7' },
  previewImage: { height: 130, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  previewTypeBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: OASIS.colors.surface, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  previewTypeText: { fontSize: 11, fontWeight: '700' },
  previewName: { fontSize: 13.5, fontWeight: '700', color: OASIS.colors.ink, textAlign: 'right' },
  previewPrice: { fontSize: 13, fontWeight: '700', color: OASIS.colors.primary, textAlign: 'right', marginTop: 4 },
  previewModes: { fontSize: 12, textAlign: 'right', marginTop: 4 },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row-reverse', gap: 10,
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 30 : 16,
    backgroundColor: 'rgba(255,255,255,0.96)', borderTopWidth: 1, borderTopColor: '#eef2f7',
  },
  backBtn: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 14, backgroundColor: '#f1f5f9' },
  backBtnText: { color: OASIS.colors.ink, fontSize: 14, fontWeight: '600' },
  nextBtn: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 14, backgroundColor: OASIS.colors.primary },
  nextBtnText: { color: OASIS.colors.surface, fontSize: 15, fontWeight: '700' },
});
