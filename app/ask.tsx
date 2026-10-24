import { ImageBackground, useState, useEffect, useMemo, useRef } from 'react';
import { Alert, BackHandler, KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View, StyleSheet, ActivityIndicator, Platform } from 'react-native';
const HAYNA_ACTION_ART = { uri: Platform.OS === 'web' ? '/images/buttons/hayna-login-button-bg.png' : 'https://appksatest.vercel.app/images/buttons/hayna-login-button-bg.png' };
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MessageSquare, HeartHandshake, Wrench, Gift, AlertTriangle, Check, ArrowLeft, Users, ShieldAlert } from 'lucide-react-native';
import { AppHeader } from '@/components/shared/AppHeader';
import { supabase } from '@/lib/supabase';
import { getCurrentDeviceLocation, reverseGeocodeDeviceLocation } from '@/lib/deviceLocation';
import { getActiveLocation, getPermanentMyLocation, savePermanentMyLocation, subscribeLocation, isAllKingdom } from '@/lib/locationSync';
import { detectEmergencyAndSafetyAI } from '@/lib/aiAssistant';

const POST_TYPES = [
  { key: 'inquiry', label: 'استفسار', hint: 'اسأل أهل الخبرة في حيّك', icon: MessageSquare },
  { key: 'help', label: 'فزعة', hint: 'اطلب مساعدة من جيرانك', icon: HeartHandshake },
  { key: 'tool_sharing', label: 'إعارة', hint: 'استعر أداة أو شاركها', icon: Wrench },
  { key: 'donate', label: 'تبرع', hint: 'شارك ما يزيد عن حاجتك', icon: Gift },
  { key: 'emergency', label: 'طارئ', hint: 'بلّغ جيرانك عن حالة عاجلة', icon: AlertTriangle },
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

export default function AskScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const submittingRef = useRef(false);
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
  const safetyCheck = useMemo(() => detectEmergencyAndSafetyAI(`${title} ${body}`.trim()), [title, body]);
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

  // 4. Save & Publish
  async function save() {
    if (submittingRef.current || step !== 2) return;
    const nextErrors: { title?: string; city?: string; budget?: string } = {};
    if (!title.trim()) nextErrors.title = 'اكتب عنواناً مختصراً قبل النشر.';
    if (!city.trim()) nextErrors.city = 'لم نتمكن من تحديد موقعك تلقائيًا. فعّل إذن الموقع أو راجع موقعك في إعدادات الحساب ثم أعد المحاولة.';
    if (postType === 'help' && budget.trim() && (!Number.isFinite(Number(budget)) || Number(budget) < 0)) nextErrors.budget = 'اكتب مبلغًا صحيحًا بالريال أو اتركه فارغًا.';
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
        <Text accessibilityRole="header" style={styles.heading}>{step === 1 ? 'وش ودّك تشارك؟' : 'اكتب التفاصيل'}</Text>
        <Text style={styles.subtitle}>{step === 1 ? 'اختر نوع المنشور المناسب لك.' : 'عنوان واضح وتفاصيل بسيطة توصل طلبك.'}</Text>

        {step === 1 ? (
          <View style={styles.typeGrid}>
            {POST_TYPES.map(type => {
              const active = type.key === postType;
              const Icon = type.icon;
              return (
                <Pressable key={type.key} testID={`post-type-${type.key}`} accessibilityRole="button" accessibilityLabel={`${type.label}، ${type.hint}`} accessibilityState={{ selected: active }} onPress={() => setPostType(type.key)} style={({ pressed }) => [styles.typeCard, type.key === 'emergency' && styles.emergencyType, active && styles.typeSelected, pressed && styles.pressed]}>
                  <View style={styles.typeTop}><View style={[styles.typeIcon, active && styles.typeIconSelected]}><Icon size={25} color={active ? '#047857' : '#52685d'} strokeWidth={1.8} /></View><View style={[styles.selection, active && styles.selectionActive]}>{active ? <Check size={13} color="#ffffff" strokeWidth={3} /> : null}</View></View>
                  <Text style={[styles.typeLabel, active && styles.selectedText]}>{type.label}</Text>
                  <Text style={styles.typeHint}>{type.hint}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.details}>
            <Pressable accessibilityRole="button" accessibilityLabel={`نوع المنشور ${selectedType.label}، تغيير`} onPress={() => changeStep(1)} disabled={busy} style={styles.selectedRow}>
              <View style={styles.selectedIdentity}><selectedType.icon size={19} color="#047857" /><Text style={styles.selectedName}>{selectedType.label}</Text></View>
              <Text style={styles.changeText}>تغيير</Text>
            </Pressable>
            <View style={styles.field}>
              <View style={styles.labelRow}><Text style={styles.label}>العنوان</Text><Text style={styles.count}>{title.length.toLocaleString('ar-SA')} / ١٢٠</Text></View>
              <TextInput testID="post-title" accessibilityLabel="عنوان المنشور" editable={!busy} maxLength={120} value={title} onChangeText={value => { setTitle(value); setFieldErrors(previous => ({ ...previous, title: undefined })); }} placeholder={postType === 'help' ? 'مثال: أحتاج فزعة لاشتراك بطارية' : postType === 'tool_sharing' ? 'مثال: أحتاج استعارة دريل اليوم' : postType === 'donate' ? 'مثال: أثاث بحالة جيدة للتبرع' : postType === 'emergency' ? 'اكتب وصفًا مختصرًا للحالة' : 'وش تبي تسأل جيرانك؟'} placeholderTextColor="#8a9b91" style={[styles.titleInput, fieldErrors.title && styles.invalidInput]} returnKeyType="next" />
              {fieldErrors.title ? <Text accessibilityRole="alert" style={styles.error}>{fieldErrors.title}</Text> : null}
            </View>
            <View style={styles.field}>
              <View style={styles.labelRow}><Text style={styles.label}>التفاصيل <Text style={styles.optional}>(اختياري)</Text></Text><Text style={styles.count}>{body.length.toLocaleString('ar-SA')} / ١٢٠٠</Text></View>
              <TextInput testID="post-body" accessibilityLabel="تفاصيل المنشور" editable={!busy} multiline maxLength={1200} value={body} onChangeText={setBody} placeholder="اكتب التفاصيل اللي تساعد جيرانك يفهمون طلبك…" placeholderTextColor="#8a9b91" style={styles.bodyInput} textAlignVertical="top" />
            </View>
            {postType === 'help' ? <View style={styles.field}><Text style={styles.label}>مكافأة رمزية بالريال <Text style={styles.optional}>(اختياري)</Text></Text><TextInput testID="post-budget" accessibilityLabel="مكافأة اختيارية بالريال السعودي" editable={!busy} keyboardType="decimal-pad" value={budget} onChangeText={value => { setBudget(value); setFieldErrors(previous => ({ ...previous, budget: undefined })); }} placeholder="بدون مقابل" placeholderTextColor="#8a9b91" style={[styles.budgetInput, fieldErrors.budget && styles.invalidInput]} />{fieldErrors.budget ? <Text accessibilityRole="alert" style={styles.error}>{fieldErrors.budget}</Text> : null}</View> : null}
            <View style={styles.templates}>
              <Text style={styles.templatesLabel}>ابدأ بقالب جاهز</Text>
              <View style={styles.templateList}>{QUICK_TEMPLATES.filter(template => template.type === postType).map(template => <Pressable key={template.title} accessibilityRole="button" accessibilityLabel={`استخدام قالب ${template.label}`} disabled={busy} onPress={() => { setTitle(template.title); setBody(template.body); setFieldErrors(previous => ({ ...previous, title: undefined })); }} style={({ pressed }) => [styles.templateChip, pressed && styles.pressed]}><Text style={styles.templateText}>{template.label}</Text></Pressable>)}</View>
            </View>
            {safetyCheck?.isEmergency || postType === 'emergency' ? <View style={styles.notice}><AlertTriangle size={18} color="#9a5b12" /><Text style={styles.noticeText}>إذا كانت هناك خطورة مباشرة، تواصل مع الجهة المختصة أولًا.</Text></View> : null}
            {safetyCheck?.isSpam ? <View style={styles.notice}><ShieldAlert size={18} color="#9a5b12" /><Text style={styles.noticeText}>{safetyCheck.spamReason || 'راجع المحتوى قبل النشر.'}</Text></View> : null}
            {fieldErrors.city ? <Text accessibilityRole="alert" style={styles.error}>{fieldErrors.city}</Text> : null}
          </View>
        )}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.footerContent}>
          <View style={styles.audience}><Users size={15} color="#73877a" /><Text style={styles.audienceText}>لجيران حيّك</Text></View>
          <Pressable testID="ask-primary" accessibilityRole="button" accessibilityLabel={step === 1 ? 'التالي، كتابة التفاصيل' : 'نشر في الحي'} accessibilityState={{ disabled: busy, busy }} disabled={busy} onPress={() =>
            <ImageBackground source={HAYNA_ACTION_ART} resizeMode="stretch" pointerEvents="none" style={StyleSheet.absoluteFillObject} /> { if (step === 1) changeStep(2); else void save(); }} style={({ pressed }) => [styles.primary, (busy || pressed) && styles.pressed]}>
            {busy ? <ActivityIndicator color="#ffffff" size="small" /> : null}
            <Text style={styles.primaryText}>{busy ? 'جارٍ النشر…' : step === 1 ? 'التالي' : 'نشر في الحي'}</Text>
            {!busy && step === 1 ? <ArrowLeft size={18} color="#ffffff" /> : null}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#ffffff' },
  scroll: { flex: 1 },
  content: { flexGrow: 1, padding: 22, paddingBottom: 28, width: '100%', maxWidth: 560, alignSelf: 'center' },
  progress: { direction: 'ltr', flexDirection: 'row-reverse', gap: 7, marginBottom: 27 },
  progressSegment: { flex: 1, height: 4, borderRadius: 4, backgroundColor: '#eaf0ec' },
  progressActive: { backgroundColor: '#047857' },
  heading: { color: '#17372a', fontSize: 28, lineHeight: 39, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl' },
  subtitle: { color: '#74867a', fontSize: 14, lineHeight: 23, textAlign: 'right', marginTop: 5, marginBottom: 26, writingDirection: 'rtl' },
  typeGrid: { direction: 'ltr', flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 12 },
  typeCard: { width: '48%', minHeight: 147, backgroundColor: '#f6f8f6', borderRadius: 22, borderWidth: 1.5, borderColor: '#f0f4f1', padding: 16, alignItems: 'flex-end' },
  emergencyType: { width: '100%', minHeight: 132 },
  typeSelected: { backgroundColor: '#edf7f1', borderColor: '#047857' },
  typeTop: { direction: 'ltr', flexDirection: 'row-reverse', width: '100%', justifyContent: 'space-between', alignItems: 'center', marginBottom: 13 },
  typeIcon: { width: 42, height: 42, backgroundColor: '#eaf0ec', borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  typeIconSelected: { backgroundColor: '#d7eddf' },
  selection: { width: 19, height: 19, borderRadius: 10, borderWidth: 1, borderColor: '#cedbd2', alignItems: 'center', justifyContent: 'center' },
  selectionActive: { backgroundColor: '#047857', borderColor: '#047857' },
  typeLabel: { color: '#254333', fontSize: 17, fontWeight: '600', textAlign: 'right' },
  selectedText: { color: '#047857' },
  typeHint: { fontSize: 11, lineHeight: 18, color: '#74867a', textAlign: 'right', marginTop: 4, writingDirection: 'rtl' },
  details: { gap: 22 },
  selectedRow: { direction: 'ltr', flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#edf7f1', borderRadius: 15, paddingHorizontal: 14, minHeight: 52 },
  selectedIdentity: { direction: 'ltr', flexDirection: 'row-reverse', gap: 8, alignItems: 'center' },
  selectedName: { fontSize: 14, fontWeight: '600', color: '#047857' },
  changeText: { fontSize: 12, color: '#047857' },
  field: { gap: 9 },
  labelRow: { direction: 'ltr', flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  label: { fontSize: 13, fontWeight: '600', color: '#254333', textAlign: 'right' },
  optional: { fontWeight: '400', color: '#839287', fontSize: 11 },
  count: { fontSize: 11, color: '#839287' },
  titleInput: { fontSize: 17, lineHeight: 27, minHeight: 56, borderBottomWidth: 1, borderColor: '#e1e9e3', paddingVertical: 12, color: '#17372a', textAlign: 'right', writingDirection: 'rtl' },
  bodyInput: { minHeight: 156, borderRadius: 17, backgroundColor: '#f6f8f6', padding: 14, fontSize: 16, lineHeight: 27, color: '#17372a', textAlign: 'right', writingDirection: 'rtl' },
  budgetInput: { borderWidth: 1, borderColor: '#e1e9e3', borderRadius: 14, minHeight: 50, padding: 12, fontSize: 16, color: '#17372a', textAlign: 'right' },
  invalidInput: { borderColor: '#c2413a' },
  templates: { gap: 10 },
  templatesLabel: { fontSize: 12, color: '#74867a', textAlign: 'right' },
  templateList: { direction: 'ltr', flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  templateChip: { minHeight: 44, borderWidth: 1, borderColor: '#e1e9e3', borderRadius: 13, paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'center' },
  templateText: { fontSize: 12, color: '#52685d', textAlign: 'right' },
  notice: { direction: 'ltr', flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 9, backgroundColor: '#fff8eb', borderRadius: 14, padding: 13 },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 21, color: '#855d25', textAlign: 'right', writingDirection: 'rtl' },
  error: { fontSize: 12, lineHeight: 21, color: '#b73535', textAlign: 'right', writingDirection: 'rtl' },
  footer: { borderTopWidth: 1, borderTopColor: '#eef2ef', backgroundColor: '#ffffff', paddingHorizontal: 22, paddingTop: 12 },
  footerContent: { width: '100%', maxWidth: 516, alignSelf: 'center', gap: 11 },
  audience: { direction: 'ltr', flexDirection: 'row-reverse', gap: 5, alignItems: 'center', justifyContent: 'center' },
  audienceText: { fontSize: 11, color: '#73877a' },
  primary: { direction: 'ltr', flexDirection: 'row-reverse', gap: 9, alignItems: 'center', justifyContent: 'center', minHeight: 52, padding: 14, backgroundColor: 'transparent', borderRadius: 0 },
  primaryText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  pressed: { opacity: 0.65 },
});
