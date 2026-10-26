import { OasisPressable as Pressable, OasisTextInput as TextInput } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import { useState, useEffect, useMemo, useRef } from 'react';
import { ImageBackground, Alert, BackHandler, KeyboardAvoidingView, ScrollView, Text, View, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MessageSquare, HeartHandshake, Wrench, Gift, AlertTriangle, Check, ArrowLeft, Users, ShieldAlert, GraduationCap, MapPin, Clock3, CalendarDays, ShieldCheck, Eye, ChevronLeft, Sparkles } from 'lucide-react-native';
import { AppHeader } from '@/components/shared/AppHeader';
import { supabase } from '@/lib/supabase';
import { containsProfanity, findProfanity, banAccountOnViolation } from '@/lib/profanity';
import { getCurrentDeviceLocation, reverseGeocodeDeviceLocation } from '@/lib/deviceLocation';
import { getActiveLocation, getPermanentMyLocation, savePermanentMyLocation, subscribeLocation, isAllKingdom } from '@/lib/locationSync';
import { detectEmergencyAndSafetyAI } from '@/lib/aiAssistant';
import PublishLocationEditor from '@/components/location/PublishLocationEditor';
import { isKnownSaudiCity } from '@/lib/saudiLocations';

const POST_TYPES = [
  { key: 'inquiry', label: 'استفسار', hint: 'اسأل أهل الخبرة في حيّك', icon: MessageSquare },
  { key: 'help', label: 'فزعة', hint: 'اطلب مساعدة من جيرانك', icon: HeartHandshake },
  { key: 'tool_sharing', label: 'إعارة', hint: 'استعر أداة أو شاركها', icon: Wrench },
  { key: 'donate', label: 'تبرع', hint: 'شارك ما يزيد عن حاجتك', icon: Gift },
  { key: 'emergency', label: 'طارئ', hint: 'بلّغ جيرانك عن حالة عاجلة', icon: AlertTriangle },
  { key: 'school_transport', label: 'توصيل المدارس', hint: 'اطلب توصيلًا أو اعرض مقاعد متاحة', icon: GraduationCap },
] as const;
type PostType = typeof POST_TYPES[number]['key'];

const QUICK_TEMPLATES = [
  {
    label: 'اشتراك بطارية سيارة',
    type: 'help',
    title: 'فزعة اشتراك بطارية سيارة بالحي',
    body: 'السلام عليكم يا جيران، سيارتي متوقفة وتحتاج اشتراك بطارية سريع، متواجد عند المربع وسأكون شاكراً لمن يفزع لي.',
  },
  {
    label: 'مفتاح عجل وبنشر',
    type: 'help',
    title: 'طلب مساعدة مفتاح عجل أو منفاخ كفرات بالحي',
    body: 'السلام عليكم، معي بنشر وأحتاج مفتاح عجل مقاس مناسب أو منفاخ سفري لدقائق معدودة.',
  },
  {
    label: 'استعارة دريل أو سلّم',
    type: 'tool_sharing',
    title: 'طلب استعارة سلّم ألمنيوم أو دريل تخريم لساعات',
    body: 'أحتاج سلّم طويل أو دريل لتركيب رف بالبيت وسأعيده بنفس اليوم بإذن الله ونظيفاً كما كان.',
  },
  {
    label: 'فني تكييف أو سباكة',
    type: 'inquiry',
    title: 'استفسار عن فني تكييف وسباكة مجرب وأمين بالحي',
    body: 'من منكم جرب فني تكييف ممتاز وأسعاره معقولة ويخدم حيّنا؟ أرجو تزويدي بالرقم وتجربتكم معه.',
  },
  {
    label: 'نقل غرض ثقيل',
    type: 'help',
    title: 'مساعدة في نقل غرض ثقيل لمدة 10 دقائق',
    body: 'أحتاج فزعة من أحد الجيران لمساعدتي في حمل ونقل دولاب لـ 10 دقائق فقط وله جزيل الشكر.',
  },
  {
    label: 'حيوان أليف مفقود',
    type: 'emergency',
    title: 'قطة مفقودة بالحي اليوم - أرجو التواصل لمن رآها',
    body: 'فقدنا قطة أليفة بيضاء بالقرب من الحديقة، يرجى ممن شاهدها مراسلتي أو التواصل سريعاً.',
  },
  {
    label: 'أغراض مجانية',
    type: 'donate',
    title: 'أغراض وأثاث بحالة جيدة متاح مجاناً لمن يحتاجه بالحي',
    body: 'لدينا بعض القطع المنزلية الصالحة للاستخدام، متاحة مجاناً لأي جار أو أسرة محتاجة بالحي.',
  },
];

type SchoolMode = 'need' | 'offer';
type SchoolTrip = 'morning' | 'return' | 'both';
type SchoolLevel = 'رياض أطفال' | 'ابتدائي' | 'متوسط' | 'ثانوي';

const SCHOOL_MODES: { key: SchoolMode; label: string; hint: string }[] = [
  { key: 'need', label: 'أحتاج توصيلًا', hint: 'أبحث عن جهة مناسبة' },
  { key: 'offer', label: 'لدي مقاعد متاحة', hint: 'أعرض المشاركة في المشوار' },
];
const SCHOOL_LEVELS: SchoolLevel[] = ['رياض أطفال', 'ابتدائي', 'متوسط', 'ثانوي'];
const SCHOOL_TRIPS: { key: SchoolTrip; label: string }[] = [
  { key: 'morning', label: 'ذهاب للمدرسة' },
  { key: 'return', label: 'عودة من المدرسة' },
  { key: 'both', label: 'ذهاب وعودة' },
];
const SCHOOL_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس'] as const;

function schoolTitle(mode: SchoolMode, level: SchoolLevel, trip: SchoolTrip, district: string) {
  const prefix = mode === 'need' ? 'مطلوب توصيل مدرسي' : 'مقاعد لتوصيل مدرسي';
  const type = SCHOOL_TRIPS.find(item => item.key === trip)?.label || 'ذهاب وعودة';
  return `${prefix} - ${level} - ${type}${district.trim() ? ` - حي ${district.trim()}` : ''}`;
}

function includesPrivateSchoolDetails(text: string) {
  // Avoid exposing direct contact numbers, exact pickup times, or home addresses
  // in a listing viewable by other platform users.
  return /(?:\+?966|05)\s*[- ]?\d[\d\s-]{7,}|(?:\d{1,2}[:٫]\d{2})|(?:منزل|بيتنا|عنوان المنزل|رقم البيت|رقم العمارة|رقم الشارع|رقم المبنى)/i.test(text);
}

export default function AskScreen() {
  const { type: initialType } = useLocalSearchParams<{ type?: string }>();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const submittingRef = useRef(false);
  const locationManuallySelectedRef = useRef(false);
  const [editingLocation, setEditingLocation] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [budget, setBudget] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [region, setRegion] = useState('');
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; city?: string; budget?: string }>({});
  const [postType, setPostType] = useState<PostType>('inquiry');
  const [schoolMode, setSchoolMode] = useState<SchoolMode>('need');
  const [schoolLevel, setSchoolLevel] = useState<SchoolLevel>('ابتدائي');
  const [schoolTrip, setSchoolTrip] = useState<SchoolTrip>('both');
  const [schoolDays, setSchoolDays] = useState<string[]>([...SCHOOL_DAYS]);
  const [schoolSeats, setSchoolSeats] = useState('2');
  const composedSchoolTitle = useMemo(() => schoolTitle(schoolMode, schoolLevel, schoolTrip, district), [schoolMode, schoolLevel, schoolTrip, district]);
  const publishTitle = postType === 'school_transport' ? composedSchoolTitle : title.trim();
  const safetyCheck = useMemo(() => detectEmergencyAndSafetyAI(`${publishTitle} ${body}`.trim()), [publishTitle, body]);

  useEffect(() => {
    if (initialType === 'school_transport' || initialType === 'carpooling') setPostType('school_transport');
  }, [initialType]);
  const selectedType = POST_TYPES.find(type => type.key === postType)!;

  function changeStep(next: 1 | 2) {
    setStep(next);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }

  function goBack() {
    if (busy) return;
    if (step === 2) changeStep(1);
    else if (router.canGoBack()) router.back();
    else router.replace('/home');
  }

  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (busy) return true;
      if (step === 2) { changeStep(1); return true; }
      return false;
    });
    return () => listener.remove();
  }, [step, busy]);

  // 1. Auto-link location immediately from device permanent storage / settings, and sync with profile
  useEffect(() => {
    let isMounted = true;

    async function initLocation() {
      // 1. Immediately populate from active location / permanent storage (Zero wait)
      try {
        const active = await getActiveLocation();
        if (isMounted && !locationManuallySelectedRef.current && active?.city && !isAllKingdom(active.city) && isKnownSaudiCity(active.city)) {
          setCity(active.city);
          const d = (active.district && active.district !== 'كل الأحياء' && active.district !== 'كل أحياء المدينة') ? active.district : '';
          setDistrict(d);
          setRegion(active.region || 'المملكة');
        } else {
          const loc = await getPermanentMyLocation();
          if (isMounted && !locationManuallySelectedRef.current && loc?.city && !isAllKingdom(loc.city) && isKnownSaudiCity(loc.city)) {
            setCity(loc.city);
            const d = (loc.district && loc.district !== 'كل الأحياء' && loc.district !== 'كل أحياء المدينة') ? loc.district : '';
            setDistrict(d);
            setRegion(loc.region || 'المملكة');
          }
        }
      } catch (e) {
        console.warn('init location read error', e);
      }

      // 2. Synchronize with profile if user is logged in
      try {
        const { data: u } = await supabase.auth.getUser();
        if (u?.user) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('region, city, district')
            .eq('id', u.user.id)
            .maybeSingle();

          if (prof?.city && isMounted && !locationManuallySelectedRef.current && isKnownSaudiCity(prof.city)) {
            const cleanCity = prof.city.trim();
            const cleanDist = (prof.district && prof.district !== 'كل الأحياء' && prof.district !== 'كل أحياء المدينة')
              ? prof.district.trim()
              : '';
            setCity(cleanCity);
            setDistrict(cleanDist);
            await savePermanentMyLocation({
              region: prof.region?.trim() || 'المملكة',
              city: cleanCity,
              district: cleanDist || 'كل الأحياء',
            });
          }
        }
      } catch (err) {}

      // 3. Fast non-blocking GPS refinement in background
      try {
        const device = await Promise.race([
          getCurrentDeviceLocation(),
          new Promise((res) => setTimeout(() => res(null), 2000)),
        ]);
        if (device && isMounted) {
          const place = await reverseGeocodeDeviceLocation(device as any);
          if (isMounted && !locationManuallySelectedRef.current && place?.region && place?.city && place?.district && isKnownSaudiCity(place.city)) {
            setRegion(place.region);
            setCity(place.city);
            setDistrict(place.district);
          }
        }
      } catch (e) {}
    }

    initLocation();

    const unsubscribe = subscribeLocation((newLoc) => {
      if (isMounted && !locationManuallySelectedRef.current && newLoc?.city && !isAllKingdom(newLoc.city) && isKnownSaudiCity(newLoc.city)) {
        setCity(newLoc.city);
        const d = (newLoc.district && newLoc.district !== 'كل الأحياء' && newLoc.district !== 'كل أحياء المدينة') ? newLoc.district : '';
        setDistrict(d);
        if (newLoc.region) setRegion(newLoc.region);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // 4. Save & Publish
  async function save() {
    if (submittingRef.current || step !== 2) return;
    const nextErrors: { title?: string; city?: string; budget?: string } = {};
    if (!publishTitle.trim() || publishTitle.trim().length < 5) nextErrors.title = 'اكتب عنوانًا واضحًا لا يقل عن خمسة أحرف.';
    if (!city.trim()) nextErrors.city = 'لم نتمكن من تحديد موقعك تلقائيًا. فعّل إذن الموقع أو راجع موقعك في إعدادات الحساب ثم أعد المحاولة.';
    if (postType === 'help' && budget.trim() && (!Number.isFinite(Number(budget)) || Number(budget) < 0)) nextErrors.budget = 'اكتب مبلغًا صحيحًا بالريال أو اتركه فارغًا.';
    if (postType === 'school_transport') {
      if (!district.trim()) nextErrors.city = 'اختر الحي في إعدادات موقعك قبل نشر طلب التوصيل.';
      if (!schoolDays.length) nextErrors.title = 'اختر يومًا واحدًا على الأقل للتوصيل.';
      if (schoolMode === 'offer' && (!Number.isInteger(Number(schoolSeats)) || Number(schoolSeats) < 1 || Number(schoolSeats) > 8)) {
        nextErrors.budget = 'عدد المقاعد يجب أن يكون بين ١ و٨.';
      }
      if (includesPrivateSchoolDetails(body)) nextErrors.title = 'احذف رقم الهاتف، العنوان الدقيق وأوقات الالتقاء من التفاصيل؛ نسّقها داخل المحادثة الخاصة.';
    }
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    if (!publishTitle.trim()) {
      return Alert.alert('مطلوب', 'يرجى كتابة عنوان للمنشور.');
    }
    if (!city) {
      return Alert.alert('تحديد الموقع', 'يرجى اختيار مدينتك وحيك لضمان وصول طلبك لجيرانك بدقة.');
    }

    if (safetyCheck?.isSpam) {
      return Alert.alert('تنبيه أمان المجتمع', safetyCheck.spamReason || 'المحتوى ترويجي أو عشوائي وغير مصرح به.');
    }

    const combinedText = `${publishTitle} ${body}`.trim();
    const detected = findProfanity(combinedText);
    if (detected) {
      const { data: u } = await supabase.auth.getUser();
      if (u.user) await banAccountOnViolation(u.user.id, 'question', combinedText, detected);
      Alert.alert('محتوى غير مسموح', 'لا يمكن نشر هذا المحتوى. راجع النص أو تواصل مع الإدارة عند وجود خطأ.');
      return;
    }

    submittingRef.current = true;
    setBusy(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        Alert.alert('تسجيل الدخول مطلوب', 'يرجى تسجيل الدخول أولاً لتتمكن من نشر السؤال وحفظه.', [
          { text: 'تسجيل الدخول', onPress: () => router.push('/auth') },
          { text: 'إلغاء', style: 'cancel' },
        ]);
        return;
      }

      const isEmergency = safetyCheck?.isEmergency || postType === 'emergency';
      const isToolSharing = postType === 'tool_sharing';

      // Public questions and help requests never need precise user coordinates.
      // Keeping only city and district here matches the publishing privacy notice.
      if (city) {
        await savePermanentMyLocation({
          region: region || 'المملكة',
          city: city.trim(),
          district: district.trim() || 'كل الأحياء',
        }, true);
        await supabase.from('profiles').update({
          region: region || null,
          city: city.trim(),
          district: district.trim() || null,
        }).eq('id', u.user.id);
      }

      // School transport uses the existing carpool request flow. Only general
      // neighbourhood + school stage are public: never persist child details,
      // phone numbers, exact meeting points, or raw GPS here.
      if (postType === 'school_transport') {
        const direction = SCHOOL_TRIPS.find(item => item.key === schoolTrip)?.label || 'ذهاب وعودة';
        const detailLines = [
          schoolMode === 'need' ? 'نوع المشاركة: طلب توصيل مدرسي' : 'نوع المشاركة: عرض مقاعد توصيل مدرسي',
          `المرحلة: ${schoolLevel}`,
          `المشوار: ${direction}`,
          `الأيام: ${schoolDays.join('، ')}`,
          schoolMode === 'offer' ? `المقاعد المتاحة: ${schoolSeats}` : null,
          body.trim() ? `تفاصيل عامة: ${body.trim()}` : null,
          'لتنسيق تفاصيل المدرسة ونقطة الالتقاء يرجى التواصل داخل المحادثة الخاصة بعد التحقق من مقدم الخدمة.',
        ].filter(Boolean).join('\n');
        const { data: schoolRequest, error: schoolError } = await supabase.from('requests')
          .insert({
            requester_id: u.user.id,
            request_type: 'carpooling',
            title: publishTitle.slice(0, 120),
            description: detailLines,
            city: city.trim(),
            district: district.trim(),
            status: 'open',
            is_urgent: false,
            max_participants: schoolMode === 'offer' ? Number(schoolSeats) : null,
            available_seats: schoolMode === 'offer' ? Number(schoolSeats) : null,
            is_recurring: schoolDays.length > 1,
          })
          .select('id')
          .single();
        if (schoolError || !schoolRequest) throw schoolError || new Error('تعذر نشر طلب توصيل المدارس.');
        Alert.alert('تم النشر', 'تم نشر طلب التوصيل دون مشاركة بيانات الطلاب أو موقع المنزل.');
        router.replace({ pathname: '/request', params: { id: schoolRequest.id } });
        return;
      }

      // 1. Direct Help Request branch
      if (postType === 'help') {
        const reqPayload: any = {
          requester_id: u.user.id,
          title: publishTitle.trim(),
          description: body.trim() || title.trim(),
          request_type: 'help',
          city: city.trim() || null,
          district: district.trim() || null,
          budget: budget ? Number(budget) : null,
          is_urgent: isEmergency,
          status: 'open',
        };

        let reqResult = await supabase.from('requests').insert(reqPayload).select('id').single();
        if (reqResult.error && (reqResult.error.code === 'PGRST204' || /column .* does not exist/i.test(reqResult.error.message))) {
          const { lat: _l1, lng: _l2, ...legacyReq } = reqPayload;
          reqResult = await supabase.from('requests').insert(legacyReq).select('id').single();
        }

        if (reqResult.error || !reqResult.data) {
          throw reqResult.error || new Error('تعذر نشر طلب المساعدة.');
        }

        Alert.alert('تم النشر بنجاح', 'تم نشر طلبك لأهالي الحي وسيتواصل معك من يقدر على المساعدة فوراً.');
        return router.replace({ pathname: '/request', params: { id: reqResult.data.id } });
      }

      // 2. Questions / Tools / Donate / Emergency branch
      const payload: any = {
        author_id: u.user.id,
        title: publishTitle.trim(),
        body: body.trim() || 'بدون تفاصيل إضافية',
        city: city.trim(),
        district: district.trim() || null,
      };

      let insertedQuestionId: string | null = null;
      try {
        const { data, error } = await supabase
          .from('questions')
          .insert({
            ...payload,
            is_emergency: isEmergency,
            urgency_level: isEmergency ? 'emergency' : 'normal',
            is_tool_sharing: isToolSharing,
            item_type: postType === 'donate' ? 'donate' : isToolSharing ? 'tool' : null,
            category: postType === 'emergency' ? 'طوارئ' : postType === 'tool_sharing' ? 'أدوات' : 'عام',
          })
          .select('id')
          .single();

        if (error) throw error;
        if (!data?.id) throw new Error('لم يُنشر المنشور. قد يكون المحتوى مرفوضًا وفق سياسة المجتمع.');
        insertedQuestionId = data.id;
      } catch (errCol: any) {
        // Never retry an insert after a moderation rejection or a single-row coercion error.
        if (errCol?.code === 'PGRST116' || errCol?.code === 'PGRST204' && !/column/i.test(errCol?.message || '')) throw errCol;
        if (!/column .* does not exist|could not find .* column|schema cache/i.test(errCol?.message || '')) throw errCol;
        // Fallback for schema variations
        const { lat: _lat, lng: _lng, ...basicPayload } = payload;
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('questions')
          .insert(basicPayload)
          .select('id')
          .single();

        if (fallbackError) throw fallbackError;
        if (!fallbackData?.id) throw new Error('لم يُنشر المنشور. راجع سياسة المحتوى ثم حاول مجددًا.');
        insertedQuestionId = fallbackData.id;
      }

      if (insertedQuestionId) {
        Alert.alert('تم النشر بنجاح', 'نُشر سؤالك لأهل الحي وسيصلك إشعار فور تفاعل الجيران معه.');
        router.replace({ pathname: '/question', params: { id: insertedQuestionId } });
      }
    } catch (err: any) {
      const moderationRejected = err?.code === 'PGRST116' || /Cannot coerce the result to a single JSON object/i.test(err?.message || '');
      Alert.alert(moderationRejected ? 'تعذر نشر المنشور' : 'خطأ', moderationRejected ? 'لم تُنشأ أي بيانات للمنشور. قد يكون المحتوى مخالفًا أو تم رفضه. راجع النص وحالة الحساب.' : (err?.message || 'تعذر نشر السؤال، حاول ثانية.'));
    } finally {
      submittingRef.current = false;
      setBusy(false);
    }
  }
  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppHeader variant="sub" title="منشور جديد" subtitle={`الخطوة ${step === 1 ? '١' : '٢'} من ٢`} fallbackRoute="/home" onBackPress={goBack} />
      <ScrollView ref={scrollRef} style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} showsVerticalScrollIndicator={false}>
        <View style={styles.progress} accessible accessibilityLabel={`الخطوة ${step} من 2`}>
          <View style={[styles.progressSegment, styles.progressActive]} />
          <View style={[styles.progressSegment, step === 2 && styles.progressActive]} />
        </View>
        <Text accessibilityRole="header" style={styles.heading}>{step === 1 ? 'وش ودّك تشارك اليوم؟' : postType === 'school_transport' ? 'رتّب توصيل المدارس' : 'اكتب منشورك'}</Text>
        <Text style={styles.subtitle}>{step === 1 ? 'اختر التصنيف؛ سنجهز لك النموذج المناسب بخطوتين.' : postType === 'school_transport' ? 'انشر طلبًا أو عرضًا واضحًا دون معلومات الطلاب الخاصة.' : 'اكتب عنوانًا واضحًا ووصفًا يساعد جيرانك على التفاعل.'}</Text>

        {step === 1 ? (
          <>
            <View style={styles.introNote}>
              <View style={styles.introIcon}><Sparkles size={17} color={OASIS.colors.primary} /></View>
              <View style={{ flex: 1 }}><Text style={styles.introTitle}>شارك مجتمعك بخطوتين</Text><Text style={styles.introDesc}>استفسارات، فزعات، إعارة، تبرعات، وتنظيم رحلات المدارس في مكان واحد.</Text></View>
            </View>
            <View style={styles.typeGrid}>
            {POST_TYPES.map(type => {
              const active = type.key === postType;
              const Icon = type.icon;
              return (
                <Pressable oasisKind="card" key={type.key} testID={`post-type-${type.key}`} accessibilityRole="button" accessibilityLabel={`${type.label}، ${type.hint}`} accessibilityState={{ selected: active }} onPress={() => setPostType(type.key)} style={({ pressed }) => [styles.typeCard, (type.key === 'emergency' || type.key === 'school_transport') && styles.wideType, active && styles.typeSelected, pressed && styles.pressed]}>
                  <View style={styles.typeTop}><View style={[styles.typeIcon, active && styles.typeIconSelected]}><Icon size={25} color={active ? OASIS.colors.primary : '#52685d'} strokeWidth={1.8} /></View><View style={[styles.selection, active && styles.selectionActive]}>{active ? <Check size={13} color={OASIS.colors.surface} strokeWidth={3} /> : null}</View></View>
                  <Text style={[styles.typeLabel, active && styles.selectedText]}>{type.label}</Text>
                  <Text style={styles.typeHint}>{type.hint}</Text>
                </Pressable>
              );
            })}
          </View>
          </>
        ) : (
          <View style={styles.details}>
            <Pressable accessibilityRole="button" accessibilityLabel={`نوع المنشور ${selectedType.label}، تغيير`} onPress={() => changeStep(1)} disabled={busy} style={styles.selectedRow}>
              <View style={styles.selectedIdentity}><selectedType.icon size={19} color={OASIS.colors.primary} /><Text style={styles.selectedName}>{selectedType.label}</Text></View>
              <Text style={styles.changeText}>تغيير</Text>
            </Pressable>
            {postType !== 'school_transport' ? <View style={styles.field}>
              <View style={styles.labelRow}><Text style={styles.label}>العنوان</Text><Text style={styles.count}>{title.length.toLocaleString('ar-SA')} / ١٢٠</Text></View>
              <TextInput testID="post-title" accessibilityLabel="عنوان المنشور" editable={!busy} maxLength={120} value={title} onChangeText={value => { setTitle(value); setFieldErrors(previous => ({ ...previous, title: undefined })); }} placeholder={postType === 'help' ? 'مثال: أحتاج فزعة لاشتراك بطارية' : postType === 'tool_sharing' ? 'مثال: أحتاج استعارة دريل اليوم' : postType === 'donate' ? 'مثال: أثاث بحالة جيدة للتبرع' : postType === 'emergency' ? 'اكتب وصفًا مختصرًا للحالة' : 'وش تبي تسأل جيرانك؟'} placeholderTextColor="#8a9b91" style={[styles.titleInput, fieldErrors.title && styles.invalidInput]} returnKeyType="next" />
              {fieldErrors.title ? <Text accessibilityRole="alert" style={styles.error}>{fieldErrors.title}</Text> : null}
            </View> : (
              <View style={styles.schoolHeading}>
                <GraduationCap size={22} color={OASIS.colors.primary} />
                <View style={{ flex: 1 }}><Text style={styles.schoolHeadingTitle}>نشر توصيل مدرسي</Text><Text style={styles.schoolHeadingDesc}>اختيارات محددة تسهّل البحث والتوافق بين أولياء الأمور.</Text></View>
              </View>
            )}
            {postType === 'school_transport' ? (
              <View style={styles.schoolPanel}>
                <Text style={styles.label}>تبي توصيل أو عندك مقاعد؟</Text>
                <View style={styles.schoolRow}>
                  {SCHOOL_MODES.map(item => <Pressable key={item.key} accessibilityRole="button" accessibilityState={{ selected: schoolMode === item.key }} onPress={() => setSchoolMode(item.key)} style={[styles.modeCard, schoolMode === item.key && styles.modeActive]}>
                    <Text style={[styles.modeTitle, schoolMode === item.key && styles.modeTitleActive]}>{item.label}</Text>
                    <Text style={styles.modeHint}>{item.hint}</Text>
                  </Pressable>)}
                </View>
                <Text style={styles.label}>المرحلة الدراسية</Text>
                <View style={styles.optionWrap}>
                  {SCHOOL_LEVELS.map(level => <Pressable key={level} accessibilityRole="button" accessibilityState={{ selected: schoolLevel === level }} onPress={() => setSchoolLevel(level)} style={[styles.optionChip, schoolLevel === level && styles.optionActive]}><Text style={[styles.optionText, schoolLevel === level && styles.optionTextActive]}>{level}</Text></Pressable>)}
                </View>
                <Text style={styles.label}>اتجاه المشوار</Text>
                <View style={styles.optionWrap}>
                  {SCHOOL_TRIPS.map(item => <Pressable key={item.key} accessibilityRole="button" accessibilityState={{ selected: schoolTrip === item.key }} onPress={() => setSchoolTrip(item.key)} style={[styles.optionChip, schoolTrip === item.key && styles.optionActive]}><Text style={[styles.optionText, schoolTrip === item.key && styles.optionTextActive]}>{item.label}</Text></Pressable>)}
                </View>
                <Text style={styles.label}>أيام التوصيل</Text>
                <View style={styles.optionWrap}>
                  {SCHOOL_DAYS.map(day => <Pressable key={day} accessibilityRole="checkbox" accessibilityState={{ checked: schoolDays.includes(day) }} onPress={() => setSchoolDays(days => days.includes(day) ? days.filter(d => d !== day) : [...days, day])} style={[styles.optionChip, schoolDays.includes(day) && styles.optionActive]}><Text style={[styles.optionText, schoolDays.includes(day) && styles.optionTextActive]}>{day}</Text></Pressable>)}
                </View>
                {schoolMode === 'offer' ? <View style={styles.field}><Text style={styles.label}>المقاعد المتاحة (1–8)</Text><TextInput accessibilityLabel="عدد المقاعد المتاحة" editable={!busy} value={schoolSeats} onChangeText={setSchoolSeats} keyboardType="number-pad" maxLength={1} style={styles.budgetInput} placeholder="2" />{fieldErrors.budget ? <Text accessibilityRole="alert" style={styles.error}>{fieldErrors.budget}</Text> : null}</View> : null}
                <View style={styles.schoolSafety}>
                  <ShieldCheck size={18} color="#047857" />
                  <Text style={styles.schoolSafetyText}>لا تكتب اسم طالب، اسم مدرسة محددة، رقم جوال، عنوان منزل أو وقت الالتقاء الدقيق. نسّقها برسالة خاصة مع طرف موثوق، وتحقق من التصاريح المناسبة قبل الاتفاق.</Text>
                </View>
              </View>
            ) : null}
            <View style={styles.field}>
              <View style={styles.labelRow}><Text style={styles.label}>{postType === 'school_transport' ? 'ملاحظات عامة آمنة' : 'التفاصيل'} <Text style={styles.optional}>(اختياري)</Text></Text><Text style={styles.count}>{body.length.toLocaleString('ar-SA')} / ١٢٠٠</Text></View>
              <TextInput testID="post-body" accessibilityLabel="تفاصيل المنشور" editable={!busy} multiline maxLength={1200} value={body} onChangeText={setBody} placeholder={postType === 'school_transport' ? 'مثال: الأفضل سيارة عائلية، والتنسيق برسائل حيّنا فقط.' : 'اكتب التفاصيل اللي تساعد جيرانك يفهمون طلبك…'} placeholderTextColor="#8a9b91" style={styles.bodyInput} textAlignVertical="top" />
            </View>
            {postType === 'help' ? <View style={styles.field}><Text style={styles.label}>مكافأة رمزية بالريال <Text style={styles.optional}>(اختياري)</Text></Text><TextInput testID="post-budget" accessibilityLabel="مكافأة اختيارية بالريال السعودي" editable={!busy} keyboardType="decimal-pad" value={budget} onChangeText={value => { setBudget(value); setFieldErrors(previous => ({ ...previous, budget: undefined })); }} placeholder="بدون مقابل" placeholderTextColor="#8a9b91" style={[styles.budgetInput, fieldErrors.budget && styles.invalidInput]} />{fieldErrors.budget ? <Text accessibilityRole="alert" style={styles.error}>{fieldErrors.budget}</Text> : null}</View> : null}
            {postType !== 'school_transport' ? <View style={styles.templates}>
              <Text style={styles.templatesLabel}>ابدأ بقالب جاهز</Text>
              <View style={styles.templateList}>{QUICK_TEMPLATES.filter(template => template.type === postType).map(template => <Pressable oasisKind="chip" key={template.title} accessibilityRole="button" accessibilityLabel={`استخدام قالب ${template.label}`} disabled={busy} onPress={() => { setTitle(template.title); setBody(template.body); setFieldErrors(previous => ({ ...previous, title: undefined })); }} style={({ pressed }) => [styles.templateChip, pressed && styles.pressed]}><Text style={styles.templateText}>{template.label}</Text></Pressable>)}</View>
            </View> : null}
            {safetyCheck?.isEmergency || postType === 'emergency' ? <View style={styles.notice}><AlertTriangle size={18} color="#9a5b12" /><Text style={styles.noticeText}>إذا كانت هناك خطورة مباشرة، تواصل مع الجهة المختصة أولًا.</Text></View> : null}
            {safetyCheck?.isSpam ? <View style={styles.notice}><ShieldAlert size={18} color="#9a5b12" /><Text style={styles.noticeText}>{safetyCheck.spamReason || 'راجع المحتوى قبل النشر.'}</Text></View> : null}
            <View style={styles.locationCard}>
              <View style={styles.locationText}>
                <Text style={styles.locationTitle}>منطقة النشر</Text>
                <Text style={styles.locationValue}>{city ? [city, district && `حي ${district}`].filter(Boolean).join(' · ') : 'لم يتم تحديد المدينة'}</Text>
                <Text style={styles.locationHint}>نشارك المدينة والحي فقط، وليس إحداثياتك الدقيقة.</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="تحديث الموقع" onPress={() => setEditingLocation(true)} style={styles.locationChange}><MapPin size={17} color={OASIS.colors.primary} /><Text style={styles.locationChangeText}>تحديث</Text></Pressable>
            </View>
            <View style={styles.previewCard}>
              <View style={styles.previewHeader}><Eye size={16} color={OASIS.colors.primary} /><Text style={styles.previewHeaderText}>معاينة المنشور</Text></View>
              <Text style={styles.previewTitle}>{publishTitle || 'عنوان منشورك يظهر هنا'}</Text>
              <Text style={styles.previewBody} numberOfLines={4}>{postType === 'school_transport' ? `${schoolMode === 'need' ? 'طلب توصيل' : 'عرض مقاعد'} · ${schoolLevel} · ${SCHOOL_TRIPS.find(item => item.key === schoolTrip)?.label} · ${schoolDays.join('، ')}${schoolMode === 'offer' ? ` · ${schoolSeats} مقعد` : ''}` : body.trim() || 'تفاصيل المنشور تظهر هنا'}</Text>
              <Text style={styles.previewLocation}>{city || 'المدينة'}{district ? ` · ${district}` : ''}</Text>
            </View>
            {fieldErrors.title ? <Text accessibilityRole="alert" style={styles.error}>{fieldErrors.title}</Text> : null}
            {fieldErrors.city ? <Text accessibilityRole="alert" style={styles.error}>{fieldErrors.city}</Text> : null}
          </View>
        )}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.footerContent}>
          <View style={styles.audience}><Users size={15} color="#73877a" /><Text style={styles.audienceText}>{postType === 'school_transport' ? 'توصيل المدارس · بدون بيانات أطفال' : 'لجيران حيّك'}</Text></View>
          <Pressable oasisVariant="primary" oasisKind="action" testID="ask-primary" accessibilityRole="button" accessibilityLabel={step === 1 ? 'التالي، كتابة التفاصيل' : 'نشر في الحي'} accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={() => { if (step === 1) changeStep(2); else void save(); }} style={({ pressed }) => [styles.primary, (busy || pressed) && styles.pressed]}>

            {busy ? <ActivityIndicator color={OASIS.colors.surface} size="small" /> : null}
            <Text style={styles.primaryText}>{busy ? 'جارٍ النشر…' : step === 1 ? 'التالي · تفاصيل المنشور' : postType === 'school_transport' ? 'نشر طلب التوصيل' : 'نشر في الحي'}</Text>
            {!busy && step === 1 ? <ArrowLeft size={18} color={OASIS.colors.surface} /> : null}
          </Pressable>
        </View>
      </View>
      <PublishLocationEditor
        visible={editingLocation}
        city={city}
        district={district}
        region={region}
        onClose={() => setEditingLocation(false)}
        onSaved={location => {
          locationManuallySelectedRef.current = true;
          setCity(location.city);
          setDistrict(location.district === 'كل الأحياء' ? '' : location.district);
          setRegion(location.region);
          setFieldErrors(previous => ({ ...previous, city: undefined }));
        }}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  scroll: { flex: 1 },
  content: { flexGrow: 1, padding: 14, paddingBottom: 16, width: '100%', maxWidth: 560, alignSelf: 'center' },
  progress: { direction: 'ltr', flexDirection: 'row-reverse', gap: 7, marginBottom: 16 },
  progressSegment: { flex: 1, height: 4, borderRadius: 4, backgroundColor: '#eaf0ec' },
  progressActive: { backgroundColor: OASIS.colors.primary },
  heading: { color: '#17372a', fontSize: 22, lineHeight: 31, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl' },
  subtitle: { color: '#74867a', fontSize: 14, lineHeight: 23, textAlign: 'right', marginTop: 5, marginBottom: 16, writingDirection: 'rtl' },
  typeGrid: { direction: 'ltr', flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  typeCard: { width: '48%', minHeight: 116, backgroundColor: '#f6f8f6', borderRadius: 14, borderWidth: 1.5, borderColor: '#f0f4f1', padding: 14, alignItems: 'flex-end' },
  emergencyType: { width: '100%', minHeight: 104 },
  wideType: { width: '100%', minHeight: 96 },
  typeSelected: { backgroundColor: '#edf7f1', borderColor: OASIS.colors.primary },
  typeTop: { direction: 'ltr', flexDirection: 'row-reverse', width: '100%', justifyContent: 'space-between', alignItems: 'center', marginBottom: 13 },
  typeIcon: { width: 32, height: 32, backgroundColor: '#eaf0ec', borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  typeIconSelected: { backgroundColor: '#d7eddf' },
  selection: { width: 19, height: 19, borderRadius: 10, borderWidth: 1, borderColor: '#cedbd2', alignItems: 'center', justifyContent: 'center' },
  selectionActive: { backgroundColor: OASIS.colors.primary, borderColor: OASIS.colors.primary },
  typeLabel: { color: '#254333', fontSize: 17, fontWeight: '600', textAlign: 'right' },
  selectedText: { color: OASIS.colors.primary },
  typeHint: { fontSize: 11, lineHeight: 18, color: '#74867a', textAlign: 'right', marginTop: 4, writingDirection: 'rtl' },
  details: { gap: 14 },
  selectedRow: { direction: 'ltr', flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#edf7f1', borderRadius: 15, paddingHorizontal: 14, minHeight: 52 },
  selectedIdentity: { direction: 'ltr', flexDirection: 'row-reverse', gap: 8, alignItems: 'center' },
  selectedName: { fontSize: 14, fontWeight: '600', color: OASIS.colors.primary },
  changeText: { fontSize: 12, color: OASIS.colors.primary },
  field: { gap: 9 },
  labelRow: { direction: 'ltr', flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: '#254333', textAlign: 'right' },
  optional: { fontWeight: '400', color: '#839287', fontSize: 11 },
  count: { fontSize: 11, color: '#839287' },
  titleInput: { fontSize: 17, lineHeight: 27, minHeight: 44, borderBottomWidth: 1, borderColor: '#e1e9e3', paddingVertical: 12, color: '#17372a', textAlign: 'right', writingDirection: 'rtl' },
  bodyInput: { minHeight: 120, borderRadius: 17, backgroundColor: '#f6f8f6', padding: 14, fontSize: 16, lineHeight: 27, color: '#17372a', textAlign: 'right', writingDirection: 'rtl' },
  budgetInput: { borderWidth: 1, borderColor: '#e1e9e3', borderRadius: 14, minHeight: 44, padding: 12, fontSize: 16, color: '#17372a', textAlign: 'right' },
  invalidInput: { borderColor: '#c2413a' },
  templates: { gap: 10 },
  templatesLabel: { fontSize: 12, color: '#74867a', textAlign: 'right' },
  templateList: { direction: 'ltr', flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  templateChip: { minHeight: 44, borderWidth: 1, borderColor: '#e1e9e3', borderRadius: 13, paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'center' },
  templateText: { fontSize: 12, color: '#52685d', textAlign: 'right' },
  notice: { direction: 'ltr', flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 9, backgroundColor: '#fff8eb', borderRadius: 14, padding: 13 },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 21, color: '#855d25', textAlign: 'right', writingDirection: 'rtl' },
  error: { fontSize: 12, lineHeight: 21, color: '#b73535', textAlign: 'right', writingDirection: 'rtl' },
  footer: { borderTopWidth: 1, borderTopColor: '#eef2ef', backgroundColor: OASIS.colors.surface, paddingHorizontal: 22, paddingTop: 12 },
  footerContent: { width: '100%', maxWidth: 516, alignSelf: 'center', gap: 11 },
  audience: { direction: 'ltr', flexDirection: 'row-reverse', gap: 5, alignItems: 'center', justifyContent: 'center' },
  audienceText: { fontSize: 11, color: '#73877a' },
  primary: { direction: 'ltr', flexDirection: 'row-reverse', gap: 9, alignItems: 'center', justifyContent: 'center', minHeight: 52, padding: 14, backgroundColor: 'transparent', borderRadius: 0 },
  primaryText: { color: OASIS.colors.surface, fontSize: 16, fontWeight: '600' },
  introNote: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, borderRadius: 18, backgroundColor: '#ECF7F0', padding: 15, marginBottom: 17, borderWidth: 1, borderColor: '#D4EBDC' },
  introIcon: { width: 39, height: 39, borderRadius: 14, backgroundColor: '#D5EFDD', justifyContent: 'center', alignItems: 'center' },
  introTitle: { color: OASIS.colors.deep, fontSize: 14, fontWeight: '800', textAlign: 'right' },
  introDesc: { color: '#547263', fontSize: 11.5, lineHeight: 20, textAlign: 'right', marginTop: 3 },
  schoolHeading: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, padding: 13, borderRadius: 16, backgroundColor: '#EDF8F0' },
  schoolHeadingTitle: { textAlign: 'right', color: '#064E3B', fontWeight: '800', fontSize: 15 },
  schoolHeadingDesc: { textAlign: 'right', color: '#567467', fontSize: 11.5, lineHeight: 19, marginTop: 2 },
  schoolPanel: { borderRadius: 20, borderColor: '#DDEBE2', borderWidth: 1, backgroundColor: '#FAFCFA', padding: 15, gap: 13 },
  schoolRow: { flexDirection: 'row-reverse', gap: 9 },
  modeCard: { flex: 1, minHeight: 76, borderRadius: 14, borderColor: '#DFE8E2', borderWidth: 1, backgroundColor: '#FFFFFF', padding: 11, alignItems: 'flex-end', justifyContent: 'center' },
  modeActive: { borderColor: '#059669', backgroundColor: '#E8F7EF', borderWidth: 2 },
  modeTitle: { color: '#3B5548', textAlign: 'right', fontSize: 12.5, fontWeight: '700' },
  modeTitleActive: { color: '#047857' },
  modeHint: { fontSize: 10, color: '#6B8174', lineHeight: 17, textAlign: 'right', marginTop: 3 },
  optionWrap: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 7 },
  optionChip: { minHeight: 39, borderRadius: 12, borderWidth: 1, borderColor: '#E0E9E2', paddingHorizontal: 13, paddingVertical: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' },
  optionActive: { backgroundColor: '#047857', borderColor: '#047857' },
  optionText: { color: '#496255', fontSize: 12, fontWeight: '600' },
  optionTextActive: { color: '#FFFFFF' },
  schoolSafety: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 9, backgroundColor: '#EAF8F1', borderRadius: 13, padding: 13 },
  schoolSafetyText: { flex: 1, color: '#16553F', fontSize: 11.5, lineHeight: 20, textAlign: 'right' },
  locationCard: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F1F6F2', borderWidth: 1, borderColor: '#E1E9E3', borderRadius: 15, padding: 13, gap: 9 },
  locationText: { alignItems: 'flex-end', flex: 1 },
  locationTitle: { color: '#506C5A', textAlign: 'right', fontSize: 11, fontWeight: '600' },
  locationValue: { color: '#143F2C', fontSize: 13, textAlign: 'right', fontWeight: '800', marginTop: 4 },
  locationHint: { color: '#718777', textAlign: 'right', fontSize: 10.5, marginTop: 4 },
  locationChange: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, minHeight: 40, backgroundColor: '#DCF3E5', paddingHorizontal: 11, borderRadius: 12 },
  locationChangeText: { color: '#047857', fontWeight: '700', fontSize: 11.5 },
  previewCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 15, borderWidth: 1, borderColor: '#D7E7DC', gap: 8 },
  previewHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 7, paddingBottom: 4 },
  previewHeaderText: { color: '#047857', fontWeight: '800', fontSize: 12 },
  previewTitle: { textAlign: 'right', color: '#103B27', fontSize: 15, fontWeight: '800', lineHeight: 25 },
  previewBody: { textAlign: 'right', color: '#4A6254', fontSize: 12, lineHeight: 21 },
  previewLocation: { textAlign: 'right', color: '#799083', fontSize: 11 },
  pressed: { opacity: 0.65 },
});
