import { useState, useEffect } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import {
  ChevronRight,
  Sparkles,
  MapPin,
  Tag,
  Lightbulb,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  HelpCircle,
  AlertTriangle,
  Flame,
  Wrench,
  Gift,
  MessageSquare,
  Bot,
  ShieldAlert,
  HeartHandshake,
  Compass,
  Zap,
} from 'lucide-react-native';
import LocationSelectorModal from '@/components/LocationSelectorModal';
import { AppHeader } from '@/components/shared/AppHeader';
import { useBottomNavInset } from '@/lib/bottomNav';
import { getCurrentDeviceLocation, reverseGeocodeDeviceLocation } from '@/lib/deviceLocation';
import {
  getActiveLocation,
  getPermanentMyLocation,
  savePermanentMyLocation,
  subscribeLocation,
  isAllKingdom,
} from '@/lib/locationSync';
import {
  analyzeQuestionWithAI,
  enhanceQuestionContentAI,
  generateInstantResidentAnswerAI,
  detectEmergencyAndSafetyAI,
  AISmartAnalysis,
  InstantResidentAnswer,
  SafetyAndSpamCheck,
} from '@/lib/aiAssistant';

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

export default function AskScreen() {
  const bottomNavInset = useBottomNavInset();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [budget, setBudget] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [region, setRegion] = useState('');
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [locatingGps, setLocatingGps] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ title?: string; city?: string }>({});

  // Post category type
  const [postType, setPostType] = useState<'inquiry' | 'help' | 'tool_sharing' | 'donate' | 'emergency'>('inquiry');

  // AI analysis state
  const [aiAnalysis, setAiAnalysis] = useState<AISmartAnalysis | null>(null);
  const [instantAnswer, setInstantAnswer] = useState<InstantResidentAnswer | null>(null);
  const [safetyCheck, setSafetyCheck] = useState<SafetyAndSpamCheck | null>(null);
  const [similarQuestions, setSimilarQuestions] = useState<any[]>([]);

  // 1. Auto-link location immediately from device permanent storage / settings, and sync with profile
  useEffect(() => {
    let isMounted = true;

    async function initLocation() {
      // 1. Immediately populate from active location / permanent storage (Zero wait)
      try {
        const active = await getActiveLocation();
        if (isMounted && active?.city && !isAllKingdom(active.city)) {
          setCity(active.city);
          const d = (active.district && active.district !== 'كل الأحياء' && active.district !== 'كل أحياء المدينة') ? active.district : '';
          setDistrict(d);
          setRegion(active.region || 'المملكة');
        } else {
          const loc = await getPermanentMyLocation();
          if (isMounted && loc?.city && !isAllKingdom(loc.city)) {
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

          if (prof?.city && isMounted) {
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
          if (place?.region && place?.city && place?.district) {
            setRegion(place.region);
            setCity(place.city);
            setDistrict(place.district);
          }
        }
      } catch (e) {}
    }

    initLocation();

    const unsubscribe = subscribeLocation((newLoc) => {
      if (isMounted && newLoc?.city && !isAllKingdom(newLoc.city)) {
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

  // Quick GPS Refresh Handler
  const handleQuickGps = async () => {
    setLocatingGps(true);
    try {
      const device = await getCurrentDeviceLocation();
      if (device) {
        const place = await reverseGeocodeDeviceLocation(device as any);
        if (place?.city) {
          setCity(place.city);
          if (place.district) setDistrict(place.district);
          if (place.region) setRegion(place.region);
          await savePermanentMyLocation({
            region: place.region || 'المملكة',
            city: place.city,
            district: place.district || 'كل الأحياء',
          }, true);
          Alert.alert('تم التحديد بنجاح 🛰️', `تم ربط موقع السؤال بـ: ${place.city} · حي ${place.district || 'الحي'}`);
        }
      }
    } catch (err) {
      console.warn('GPS error', err);
    } finally {
      setLocatingGps(false);
    }
  };

  // 2. Real-time AI Analysis & Safety Check on title/body change
  useEffect(() => {
    const fullText = `${title} ${body}`.trim();
    if (title.trim().length >= 3) {
      const analysis = analyzeQuestionWithAI(title, body);
      setAiAnalysis(analysis);

      // Emergency & Anti-Spam Safety Check
      const safety = detectEmergencyAndSafetyAI(fullText);
      setSafetyCheck(safety);

      if (safety.isEmergency && postType !== 'emergency') {
        setPostType('emergency');
      }

      // Generate Instant Resident AI Answer if sufficient context
      if (title.trim().length >= 5) {
        const answer = generateInstantResidentAnswerAI(title, city, district);
        setInstantAnswer(answer);
      } else {
        setInstantAnswer(null);
      }

      findSimilarQuestions(title.trim());
    } else {
      setAiAnalysis(null);
      setInstantAnswer(null);
      setSafetyCheck(null);
      setSimilarQuestions([]);
    }
  }, [title, body, city, district]);

  async function findSimilarQuestions(queryText: string) {
    try {
      let q = supabase
        .from('questions')
        .select('id, title, city, district')
        .ilike('title', `%${queryText.split(' ')[0]}%`)
        .limit(3);

      if (city && city !== 'كل المدن') {
        q = q.eq('city', city);
      }

      const { data } = await q;
      setSimilarQuestions(data ?? []);
    } catch (e) {}
  }

  // 3. AI Question Enhancement
  function handleAIEnhance() {
    if (!title.trim()) {
      return Alert.alert('تنبيه', 'اكتب سؤالك أولاً وسيقوم الذكاء الاصطناعي بصياغته وتحسينه لك.');
    }

    setEnhancing(true);
    setTimeout(() => {
      const result = enhanceQuestionContentAI(title, body, city, district);
      setTitle(result.enhancedTitle);
      if (result.enhancedBody) {
        setBody(result.enhancedBody);
      }
      setEnhancing(false);
    }, 350);
  }

  // 4. Save & Publish
  async function save() {
    const nextErrors: { title?: string; city?: string } = {};
    if (!title.trim()) nextErrors.title = 'اكتب عنواناً مختصراً قبل النشر.';
    if (!city.trim()) nextErrors.city = 'اختر المدينة والحي حتى يصل المنشور للجيران المناسبين.';
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    if (!title.trim()) {
      return Alert.alert('مطلوب', postType === 'help' ? 'يرجى كتابة عنوان لطلب المساعدة.' : 'يرجى كتابة عنوان السؤال.');
    }
    if (!city) {
      return Alert.alert('تحديد الموقع', 'يرجى اختيار مدينتك وحيك لضمان وصول طلبك لجيرانك بدقة.');
    }

    if (safetyCheck?.isSpam) {
      return Alert.alert('تنبيه أمان المجتمع', safetyCheck.spamReason || 'المحتوى ترويجي أو عشوائي وغير مصرح به.');
    }

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

      let deviceLocation: any = null;
      try {
        deviceLocation = await Promise.race([
          getCurrentDeviceLocation(),
          new Promise((res) => setTimeout(() => res(null), 1200)),
        ]);
      } catch {}

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

      // 1. Direct Help Request branch
      if (postType === 'help') {
        const reqPayload: any = {
          requester_id: u.user.id,
          title: title.trim(),
          description: body.trim() || title.trim(),
          request_type: 'help',
          city: city.trim() || null,
          district: district.trim() || null,
          budget: budget ? Number(budget) : null,
          is_urgent: isEmergency,
          status: 'open',
          lat: deviceLocation?.latitude ?? null,
          lng: deviceLocation?.longitude ?? null,
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
        title: title.trim(),
        body: body.trim() || 'بدون تفاصيل إضافية',
        city: city.trim(),
        district: district.trim() || null,
        lat: deviceLocation?.latitude ?? null,
        lng: deviceLocation?.longitude ?? null,
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
        insertedQuestionId = data.id;
      } catch (errCol) {
        // Fallback for schema variations
        const { lat: _lat, lng: _lng, ...basicPayload } = payload;
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('questions')
          .insert(basicPayload)
          .select('id')
          .single();

        if (fallbackError) throw fallbackError;
        insertedQuestionId = fallbackData.id;
      }

      if (insertedQuestionId) {
        Alert.alert('تم النشر بنجاح', 'نُشر سؤالك لأهل الحي وسيصلك إشعار فور تفاعل الجيران معه.');
        router.replace({ pathname: '/question', params: { id: insertedQuestionId } });
      }
    } catch (err: any) {
      Alert.alert('خطأ', err.message || 'تعذر نشر السؤال، حاول ثانية.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <AppHeader
        variant="sub"
        title="اسأل أهل حيك"
        subtitle={[district && `حي ${district}`, city].filter(Boolean).join(' · ') || 'تواصل مع جيرانك'}
        fallbackRoute="/home"
      />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(bottomNavInset, 24) + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.introRow}>
          <View style={styles.introIcon}><MessageSquare size={21} color="#16865b" /></View>
          <View style={styles.introCopy}>
            <Text style={styles.introTitle}>وش تحتاج من جيرانك؟</Text>
            <Text style={styles.introSub}>اختر نوع المنشور واكتب التفاصيل باختصار.</Text>
          </View>
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel="تعديل المدينة والحي" onPress={() => setShowLocationModal(true)} style={styles.locationInline}>
          <View style={styles.locationInlineIcon}><MapPin size={17} color="#16865b" /></View>
          <View style={styles.locationInlineCopy}>
            <Text style={styles.locationInlineTitle}>{city ? [district, city].filter(Boolean).join("، ") : "حدد المدينة والحي"}</Text>
            <Text style={styles.locationInlineHint}>مكان ظهور منشورك للجيران · تعديل</Text>
          </View>
          <ChevronRight size={17} color="#64748b" />
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="اختيار نوع المنشور"
          onPress={() => Alert.alert('نوع المنشور', 'اختر التصنيف المناسب لمنشورك', [
            { text: 'استفسار', onPress: () => setPostType('inquiry') },
            { text: 'طلب فزعة', onPress: () => setPostType('help') },
            { text: 'إعارة أدوات', onPress: () => setPostType('tool_sharing') },
            { text: 'تبرّع', onPress: () => setPostType('donate') },
            { text: 'بلاغ طارئ', style: 'destructive', onPress: () => setPostType('emergency') },
            { text: 'إلغاء', style: 'cancel' },
          ])}
          style={styles.categorySelect}
        >
          <View style={styles.categorySelectLeading}>
            {postType === 'help' ? <HeartHandshake size={18} color="#16865b" /> :
             postType === 'tool_sharing' ? <Wrench size={18} color="#16865b" /> :
             postType === 'donate' ? <Gift size={18} color="#16865b" /> :
             postType === 'emergency' ? <Flame size={18} color="#b91c1c" /> :
             <MessageSquare size={18} color="#16865b" />}
            <View style={styles.categorySelectCopy}>
              <Text style={styles.categorySelectLabel}>نوع المنشور</Text>
              <Text style={styles.categorySelectValue}>{postType === 'help' ? 'طلب فزعة' : postType === 'tool_sharing' ? 'إعارة أدوات' : postType === 'donate' ? 'تبرّع' : postType === 'emergency' ? 'بلاغ طارئ' : 'استفسار'}</Text>
            </View>
          </View>
          <ChevronDown size={18} color="#64748b" />
        </Pressable>

        <View style={styles.templatesContainer}>
          <Text style={styles.templatesTitle}>ابدأ بقالب جاهز (اختياري)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.templatesScroll}>
            {QUICK_TEMPLATES.map((template, index) => {
              const TemplateIcon = index === 0 ? Zap : index === 1 ? Wrench : index === 2 ? Wrench : index === 3 ? HelpCircle : index === 4 ? HeartHandshake : index === 5 ? AlertTriangle : Gift;
              return <Pressable key={template.title} accessibilityRole="button" accessibilityLabel={`استخدام قالب ${template.label}`} onPress={() => { setTitle(template.title); setBody(template.body); setPostType(template.type as typeof postType); setFieldErrors(prev => ({ ...prev, title: undefined })); }} style={({ pressed }) => [styles.templateChip, pressed && { opacity: 0.7 }]}><TemplateIcon size={15} color="#16865b" /><Text style={styles.templateChipText}>{template.label}</Text></Pressable>;
            })}
          </ScrollView>
        </View>

        {/* Dedicated Notice Banner when adding a Help Request */}
        {postType === 'help' && (
          <View style={styles.helpNoticeCard}>
            <View style={styles.helpNoticeHeader}>
              <HeartHandshake size={18} color="#d97706" />
              <Text style={styles.helpNoticeTitle}>طلب فزعة وتعاون من أهل حيّك</Text>
            </View>
            <Text style={styles.helpNoticeText}>
              طلبك سيُنشر مباشرة لأهالي حيك في صفحة «فزعات وطلبات الحي» ويظهر على خريطة الحي ليتواصل معك الجيران القادرون على المساعدة فوراً.
            </Text>
          </View>
        )}

        {/* Emergency Alert Banner */}
        {(safetyCheck?.isEmergency || postType === 'emergency') && (
          <View style={styles.emergencyCard}>
            <View style={styles.emergencyHeader}>
              <Flame size={18} color="#dc2626" />
              <Text style={styles.emergencyTitle}>تنبيه حالة طارئة بأولوية قصوى لأهل الحي 🚨</Text>
            </View>
            <Text style={styles.emergencyDesc}>
              سيتم تثبيت هذا البلاغ في أعلى خلاصة الحي وإرسال إشعار فوري لجميع الجيران المتواجدين حالياً للمساعدة السريعة.
            </Text>
          </View>
        )}

        {/* Anti-Spam Warning if detected */}
        {safetyCheck?.isSpam && (
          <View style={styles.spamWarningCard}>
            <ShieldAlert size={18} color="#ea580c" />
            <View style={{ flex: 1 }}>
              <Text style={styles.spamWarningTitle}>تنبيه أمان المجتمع</Text>
              <Text style={styles.spamWarningDesc}>{safetyCheck.spamReason}</Text>
            </View>
          </View>
        )}

        {fieldErrors.city ? <Text accessibilityRole="alert" style={styles.fieldError}>{fieldErrors.city}</Text> : null}

        {/* Input: Title */}
        <View style={styles.inputGroup}>
          <View style={styles.labelRow}>
            <Text style={styles.charCounter}>{title.length}/120</Text>
            <Text style={styles.label}>
              {postType === 'help'
                ? 'عنوان طلب الفزعة والمساعدة *'
                : postType === 'tool_sharing'
                ? 'اسم الأداة أو المعدة المعارة *'
                : postType === 'donate'
                ? 'الشيء المعروض للتبادل المجاني *'
                : postType === 'emergency'
                ? 'عنوان البلاغ الطارئ *'
                : 'عنوان السؤال *'}
            </Text>
          </View>
          <TextInput
            accessibilityLabel="عنوان المنشور"
            returnKeyType="next"
            style={[styles.titleInput, fieldErrors.title && styles.inputInvalid]}
            value={title}
            onChangeText={(value) => { setTitle(value); if (value.trim()) setFieldErrors(prev => ({ ...prev, title: undefined })); }}
            placeholder={
              postType === 'help'
                ? 'مثال: أحتاج أحد يساعدني باشتراك بطارية سيارة، نقل غرض ثقيل، أو بنشر...'
                : postType === 'tool_sharing'
                ? 'مثال: دريل تخريم خرسانة للإعارة المجانية بالحي'
                : postType === 'emergency'
                ? 'مثال: طفل مفقود بالقرب من حديقة الحي'
                : 'مثال: وين أفضل ورشة صيانة سيارات أو سباك مجرب في الحي؟'
            }
            placeholderTextColor="#94a3b8"
            maxLength={120}
          />
          {fieldErrors.title ? <Text accessibilityRole="alert" style={styles.fieldError}>{fieldErrors.title}</Text> : null}
        </View>

        {/* Input: Body */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            {postType === 'help' ? 'تفاصيل المساعدة المطلوبة بدقة *' : 'التفاصيل والشرح (اختياري)'}
          </Text>
          <TextInput
            accessibilityLabel="تفاصيل المنشور"
            returnKeyType="default"
            style={[styles.titleInput, styles.bodyInput]}
            multiline
            scrollEnabled
            maxLength={1200}
            value={body}
            onChangeText={setBody}
            placeholder={
              postType === 'help'
                ? 'اشرح ما تحتاجه، موقعك التقريبي داخل الحي، والوقت المناسب لتلقي المساعدة...'
                : 'اكتب أي معلومات إضافية تفيد الجيران في مساعدتك أو الإجابة على سؤالك...'
            }
            placeholderTextColor="#94a3b8"
          />
        </View>

        {/* Optional Budget/Reward when postType === 'help' */}
        {postType === 'help' && (
          <View style={styles.inputGroup}>
            <Text style={styles.label}>مكافأة أو شكر رمزي للمساعد (اختياري)</Text>
            <TextInput
              accessibilityLabel="المكافأة الاختيارية بالريال السعودي"
              style={styles.titleInput}
              value={budget}
              onChangeText={setBudget}
              keyboardType="numeric"
              placeholder="مثال: 30 ر.س (اتركه فارغاً إذا كان فزعة وتطوع بدون مقابل)"
              placeholderTextColor="#94a3b8"
            />
          </View>
        )}

        {/* Submit Button */}
        <Pressable
          style={[styles.submitBtn, busy && { opacity: 0.7 }]}
          onPress={save}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <CheckCircle2 size={20} color="#fff" />
          )}
          <Text style={styles.submitBtnText}>{busy ? 'جارٍ النشر...' : 'نشر في الحي'}</Text>
        </Pressable>
      </ScrollView>

      {/* Location Selector Modal */}
      <LocationSelectorModal
        visible={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        selectedCity={city || 'كل المدن'}
        selectedDistrict={district || 'كل الأحياء'}
        onSelect={async (r, c, d) => {
          const cleanCity = c === 'كل المدن' ? '' : c;
          const cleanDist = (d === 'كل الأحياء' || d === 'كل أحياء المدينة') ? '' : d;
          setRegion(r);
          setCity(cleanCity);
          setDistrict(cleanDist);

          if (cleanCity) {
            await savePermanentMyLocation({
              region: r || 'المملكة',
              city: cleanCity,
              district: cleanDist || 'كل الأحياء',
            });
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  headerBadgeWrap: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  headerBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  introRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, marginBottom: 10, paddingVertical: 5 },
  introIcon: { width: 44, height: 44, borderRadius: 15, backgroundColor: '#eaf7f0', alignItems: 'center', justifyContent: 'center' },
  introCopy: { flex: 1, alignItems: 'flex-end', gap: 4 },
  introTitle: { fontSize: 18, fontWeight: '900', color: '#102a20', textAlign: 'right' },
  introSub: { fontSize: 12.5, color: '#64748b', textAlign: 'right', lineHeight: 19 },
  locationInline: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9, marginBottom: 12, minHeight: 54 },
  locationInlineIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#eaf7f0', alignItems: 'center', justifyContent: 'center' },
  locationInlineCopy: { flex: 1, alignItems: 'flex-end', gap: 3 },
  locationInlineTitle: { fontSize: 13, fontWeight: '800', color: '#0f172a', textAlign: 'right' },
  locationInlineHint: { fontSize: 11, color: '#64748b', textAlign: 'right' },
  fieldError: { color: '#b91c1c', fontSize: 12, textAlign: 'right', marginTop: 5, marginBottom: 8 },
  inputInvalid: { borderColor: '#dc2626', backgroundColor: '#fffafa' },
  welcomeCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#eff6ff',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#dbeafe',
    padding: 18,
    marginBottom: 18,
  },
  welcomeIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  welcomeCopy: { flex: 1, alignItems: 'flex-end', gap: 5 },
  welcomeTitle: { fontSize: 21, fontWeight: '900', color: '#0f172a', textAlign: 'right' },
  welcomeText: { fontSize: 13, lineHeight: 20, color: '#475569', textAlign: 'right' },
  welcomeLocation: { fontSize: 12, fontWeight: '800', color: '#059669', textAlign: 'right', marginTop: 2 },
  postTypeContainer: {
    marginBottom: 10,
  },
  postTypeTabs: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  typeTab: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    gap: 5,
  },
  typeTabActive: {
    backgroundColor: '#16865b',
    borderColor: '#16865b',
    shadowColor: '#16865b',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  typeTabActiveGreen: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  typeTabActiveAmber: {
    backgroundColor: '#d97706',
    borderColor: '#d97706',
  },
  typeTabActivePurple: {
    backgroundColor: '#9333ea',
    borderColor: '#9333ea',
  },
  typeTabActiveRed: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  typeTabText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
  },
  typeTabTextActive: {
    color: '#fff',
  },
  helpNoticeCard: {
    backgroundColor: '#fffbeb',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#fde68a',
  },
  helpNoticeHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  helpNoticeTitle: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#92400e',
    textAlign: 'right',
  },
  helpNoticeText: {
    fontSize: 12,
    lineHeight: 18,
    color: '#78350f',
    textAlign: 'right',
  },
  categorySelect: {
    minHeight: 62,
    paddingHorizontal: 13,
    paddingVertical: 10,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#dbe5e0',
    backgroundColor: '#f8fbf9',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categorySelectLeading: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 11,
  },
  categorySelectCopy: {
    alignItems: 'flex-end',
    gap: 3,
  },
  categorySelectLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
  },
  categorySelectValue: {
    color: '#102a20',
    fontSize: 14,
    fontWeight: '900',
  },
  templatesContainer: {
    marginBottom: 10,
  },
  templatesTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
    textAlign: 'right',
    marginBottom: 8,
  },
  templatesScroll: {
    flexDirection: 'row-reverse',
    gap: 8,
    paddingBottom: 2,
  },
  templateChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 7,
    minHeight: 42,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  templateChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  locationCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  locationCardHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  locationLabel: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#0f172a',
  },
  gpsAutoBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  gpsAutoBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
  },
  locationBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  locationValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'right',
  },
  locationHint: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'right',
    marginTop: 2,
  },
  mapPinWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#ecfdf5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emergencyCard: {
    backgroundColor: '#fef2f2',
    borderWidth: 1.5,
    borderColor: '#fca5a5',
    borderRadius: 16,
    padding: 12,
    marginBottom: 14,
  },
  emergencyHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  emergencyTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#b91c1c',
    textAlign: 'right',
  },
  emergencyDesc: {
    fontSize: 11.5,
    color: '#991b1b',
    textAlign: 'right',
    lineHeight: 17,
  },
  spamWarningCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#fff7ed',
    borderWidth: 1.5,
    borderColor: '#fed7aa',
    borderRadius: 16,
    padding: 12,
    marginBottom: 14,
    gap: 8,
  },
  spamWarningTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#c2410c',
    textAlign: 'right',
  },
  spamWarningDesc: {
    fontSize: 11.5,
    color: '#9a3412',
    textAlign: 'right',
    marginTop: 2,
  },
  aiBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#059669',
    borderRadius: 16,
    padding: 12,
    marginBottom: 14,
    gap: 10,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  aiBannerTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'right',
  },
  aiBannerSub: {
    fontSize: 11,
    color: '#ecfdf5',
    textAlign: 'right',
    marginTop: 2,
  },
  inputGroup: {
    marginBottom: 14,
  },
  labelRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'right',
  },
  charCounter: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  titleInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 13,
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    textAlign: 'right',
  },
  bodyInput: {
    height: 124,
    minHeight: 124,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  instantAnswerCard: {
    backgroundColor: '#f0fdfa',
    borderWidth: 1.5,
    borderColor: '#99f6e4',
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
  },
  instantAnswerHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  instantAnswerTitleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  instantAnswerTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0f766e',
  },
  confidenceBadge: {
    backgroundColor: '#ccfbf1',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#5eead4',
  },
  confidenceText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#0f766e',
  },
  instantAnswerSub: {
    fontSize: 11.5,
    color: '#115e59',
    textAlign: 'right',
    marginBottom: 8,
  },
  instantSummaryText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#134e4a',
    textAlign: 'right',
    lineHeight: 18,
    marginBottom: 8,
  },
  keyPointsBox: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    gap: 4,
  },
  pointRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 5,
  },
  bulletDot: {
    fontSize: 14,
    color: '#0d9488',
    lineHeight: 16,
  },
  pointText: {
    flex: 1,
    fontSize: 11.5,
    color: '#334155',
    textAlign: 'right',
    lineHeight: 16,
  },
  actionBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    padding: 8,
    borderRadius: 8,
    gap: 6,
  },
  actionText: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: '700',
    color: '#92400e',
    textAlign: 'right',
  },
  aiInsightCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  aiInsightHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  aiBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  aiBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#059669',
  },
  aiInsightCategory: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0f172a',
  },
  tagsRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  tagPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  tagPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  tipBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 8,
    borderRightWidth: 3,
    borderRightColor: '#059669',
  },
  tipText: {
    fontSize: 11.5,
    color: '#475569',
    textAlign: 'right',
    lineHeight: 16,
  },
  similarCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  similarHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  similarTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#9a3412',
  },
  similarItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  similarItemText: {
    flex: 1,
    fontSize: 12,
    color: '#0f172a',
    textAlign: 'right',
    marginLeft: 6,
  },
  submitBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#16865b',
    minHeight: 54,
    borderRadius: 14,
    gap: 8,
    marginTop: 8,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#fff',
  },
});
