import { OasisPressable as Pressable, OasisTextInput as TextInput, OasisSurface } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import { HeaderAction } from '@/components/shared/AppHeader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Alert, Dimensions, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View, ActivityIndicator, PanResponder } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  X,
  Send,
  Camera,
  Image as ImageIcon,
  Palette,
  Type,
  Trash2,
  Plus,
  Clock,
  UploadCloud,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Check,
  SlidersHorizontal,
  ShieldCheck,
  Move,
  Crop,
  LayoutTemplate,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { containsProfanity, findProfanity, banAccountOnViolation } from '@/lib/profanity';
import { useStoryComposer } from '@/hooks/useStoryComposer';
import { useStoryPublisher } from '@/hooks/useStoryPublisher';
import { BG_GRADIENTS, getGradient } from '@/lib/storyGradients';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const WHATSAPP_FONTS = [
  { id: 'bold', name: 'عريض', fontWeight: '900' as const, fontStyle: 'normal' as const, isPill: false },
  { id: 'normal', name: 'عادي', fontWeight: '600' as const, fontStyle: 'normal' as const, isPill: false },
  { id: 'pill', name: 'كبسولة', fontWeight: '800' as const, fontStyle: 'normal' as const, isPill: true },
  { id: 'italic', name: 'مائل', fontWeight: '700' as const, fontStyle: 'italic' as const, isPill: false },
];

const STORY_TEMPLATES = [
  { label: 'إعلان', text: 'إعلان لأهل الحي\n\nاكتب تفاصيل الإعلان هنا', gradient: 0, color: OASIS.colors.surface, size: 30 },
  { label: 'مناسبة', text: 'مناسبة سعيدة\n\nشارك أهل الحي فرحتك', gradient: 2, color: OASIS.colors.surface, size: 32 },
  { label: 'استفسار', text: 'عندي استفسار لأهل الحي\n\n', gradient: 3, color: OASIS.colors.surface, size: 28 },
  { label: 'تنبيه', text: 'تنبيه مهم لأهل الحي\n\n', gradient: 1, color: OASIS.colors.surface, size: 30 },
] as const;
const STORY_TEXT_COLORS = [OASIS.colors.surface, OASIS.colors.ink, '#F87171', '#FBBF24', '#34D399', '#60A5FA', '#C084FC', '#FB7185'];

export default function CreateStory() {
  const safeInsets = useSafeAreaInsets();
  const composer = useStoryComposer();
  const publisher = useStoryPublisher();
  const { activeSlide } = composer;

  const [fontIndex, setFontIndex] = useState(0); // default bold
  const [textAlign, setTextAlign] = useState<'center' | 'right' | 'left'>('center');
  const [showPalette, setShowPalette] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showStoryOptions, setShowStoryOptions] = useState(false);
  const [settingsSection, setSettingsSection] = useState<'privacy' | 'interactive' | 'format'>('privacy');
  const [audience, setAudience] = useState<'public' | 'followers' | 'custom'>('public');
  const [audienceCandidates, setAudienceCandidates] = useState<Array<{ id: string; display_name: string | null; username: string | null }>>([]);
  const [allowedUserIds, setAllowedUserIds] = useState<string[]>([]);
  const [hiddenUserIds, setHiddenUserIds] = useState<string[]>([]);
  const [allowStoryReplies, setAllowStoryReplies] = useState(true);
  const [defaultsReady, setDefaultsReady] = useState(false);
  const [accountRepliesDisabled, setAccountRepliesDisabled] = useState(false);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const auth = await supabase.auth.getUser();
        if (auth.error) throw auth.error;
        if (!auth.data.user) { router.replace('/auth'); return; }
        const result = await supabase.from('profiles').select('profile_privacy,allow_story_replies').eq('id', auth.data.user.id).single();
        if (result.error) throw result.error;
        if (!active) return;
        setAudience(result.data.profile_privacy === 'private' ? 'followers' : 'public');
        setAllowStoryReplies(result.data.allow_story_replies !== 'nobody');
        setAccountRepliesDisabled(result.data.allow_story_replies === 'nobody');
        setDefaultsReady(true);
      } catch { if (active) Alert.alert('تعذر تحميل إعدادات حسابك', 'أعد فتح الصفحة بعد التحقق من الاتصال.'); }
    })();
    return () => { active = false; };
  }, []);
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [interactiveType, setInteractiveType] = useState<'none' | 'poll' | 'question'>('none');
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptionA, setPollOptionA] = useState('نعم');
  const [pollOptionB, setPollOptionB] = useState('لا');
  const [questionPrompt, setQuestionPrompt] = useState('');
  const [textColor, setTextColor] = useState<string>(OASIS.colors.surface);
  const [fontSize, setFontSize] = useState(28);
  const [textRotation, setTextRotation] = useState(0);
  const [textOffset, setTextOffset] = useState({ x: 0, y: 0 });
  const offsetRef = useRef(textOffset);
  offsetRef.current = textOffset;
  const dragStart = useRef({ x: 0, y: 0 });
  const dragResponder = useMemo(() => Platform.OS === 'web' ? null : PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) + Math.abs(gesture.dy) > 6,
    onPanResponderGrant: () => { dragStart.current = { ...offsetRef.current }; },
    onPanResponderMove: (_event, gesture) => {
      setTextOffset({
        x: Math.max(-140, Math.min(140, dragStart.current.x + gesture.dx)),
        y: Math.max(-260, Math.min(260, dragStart.current.y + gesture.dy)),
      });
    },
  }), []);
  const applyTemplate = (template: typeof STORY_TEMPLATES[number]) => {
    composer.patchActiveSlide({
      type: 'text',
      content: template.text,
      bgGradId: BG_GRADIENTS[template.gradient]?.id || BG_GRADIENTS[0].id,
    });
    setTextColor(template.color);
    setFontSize(template.size);
    setTextOffset({ x: 0, y: 0 });
    setTextRotation(0);
    setShowTemplates(false);
  };

  const withAssetErrors = useCallback(async (fn: () => Promise<unknown>, label: string) => {
    try {
      await fn();
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      Alert.alert('خطأ', `تعذر ${label}${message ? `: ${message}` : ''}`);
    }
  }, []);

  const handlePickImages = useCallback(
    () => withAssetErrors(composer.pickImages, 'فتح ألبوم الصور'),
    [composer, withAssetErrors],
  );

  const handleTakePhoto = useCallback(async () => {
    await withAssetErrors(composer.takePhoto, 'فتح الكاميرا');
  }, [composer, withAssetErrors]);

  const handleCycleFont = useCallback(() => {
    setFontIndex((prev) => (prev + 1) % WHATSAPP_FONTS.length);
  }, []);

  const handleCycleAlign = useCallback(() => {
    setTextAlign((prev) => {
      if (prev === 'center') return 'right';
      if (prev === 'right') return 'left';
      return 'center';
    });
  }, []);

  const handleSelectGradient = useCallback((gradId: number) => {
    composer.patchActiveSlide({ bgGradId: gradId });
  }, [composer]);

  const loadAudienceCandidates = useCallback(async () => {
    setAudienceLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const user = authData.user;
      if (!user) return;
      const { data: follows, error: followsError } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', user.id);
      if (followsError) throw followsError;
      const ids = [...new Set((follows || []).map((row: { follower_id: string }) => row.follower_id))];
      if (ids.length === 0) {
        setAudienceCandidates([]);
        return;
      }
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, display_name, username')
        .in('id', ids);
      if (profilesError) throw profilesError;
      setAudienceCandidates((profiles || []) as Array<{ id: string; display_name: string | null; username: string | null }>);
    } catch (error) {
      Alert.alert('تعذر تحميل القائمة', error instanceof Error ? error.message : 'حاول مجددًا.');
    } finally {
      setAudienceLoading(false);
    }
  }, []);

  const handleAudienceChange = useCallback((value: 'public' | 'followers' | 'custom') => {
    setAudience(value);
    if (value === 'custom' && audienceCandidates.length === 0) void loadAudienceCandidates();
  }, [audienceCandidates.length, loadAudienceCandidates]);

  const handlePublish = useCallback(async () => {
    if (!defaultsReady) return;
    if (!composer.isReady) {
      return Alert.alert(
        'تنبيه',
        'يرجى كتابة نص أو اختيار صورة واحدة على الأقل لنشرها في القصة.',
      );
    }

    if (audience === 'custom' && allowedUserIds.length === 0) {
      return Alert.alert('اختر الجمهور', 'حدد شخصًا واحدًا على الأقل للقائمة المخصصة.');
    }
    if (interactiveType === 'poll' && (!pollQuestion.trim() || !pollOptionA.trim() || !pollOptionB.trim())) {
      return Alert.alert('استطلاع غير مكتمل', 'أدخل سؤال الاستطلاع والخيارين.');
    }
    if (interactiveType === 'question' && !questionPrompt.trim()) {
      return Alert.alert('السؤال غير مكتمل', 'اكتب السؤال الذي سيظهر للمتابعين.');
    }

    const storyText = [
      ...composer.slides.map((s: any) => s?.content || ''),
      pollQuestion, pollOptionA, pollOptionB, questionPrompt,
    ].join(' ');
    const detected = findProfanity(storyText);
    if (detected) {
      const auth = await supabase.auth.getUser();
      if (auth.data.user) await banAccountOnViolation(auth.data.user.id, 'story', storyText, detected);
      Alert.alert('تم حظر الحساب', 'تم اكتشاف محتوى مخالف في القصة. تم إغلاق حسابك.');
      router.replace('/banned');
      return;
    }

    let outcome: Awaited<ReturnType<typeof publisher.publish>>;
    try {
      outcome = await publisher.publish(composer.slides, {
        audience,
        allowedUserIds,
        hiddenUserIds,
        allowReplies: allowStoryReplies,
        interactiveType,
        pollQuestion,
        pollOptions: [pollOptionA, pollOptionB],
        questionPrompt,
        textColor,
        fontSize,
        fontFamily: WHATSAPP_FONTS[fontIndex].id,
        textRotation,
        textOffsetX: textOffset.x,
        textOffsetY: textOffset.y,
      });
    } catch (error) {
      publisher.reset();
      Alert.alert('تعذر النشر', error instanceof Error ? error.message : 'تحقق من الاتصال ثم أعد المحاولة.');
      return;
    }

    if (outcome.unauthenticated) {
      publisher.reset();
      return router.replace('/auth');
    }

    if (outcome.publishedCount === 0) {
      publisher.reset();
      return Alert.alert('خطأ', outcome.failures[0] ?? 'تعذر نشر القصص، يرجى المحاولة مرة أخرى.');
    }

    // انتقل مباشرة لعارض اليومية المنشورة إن توفّر ID
    if (outcome.firstPublishedId) {
      const degradeNote = outcome.degradedUploads > 0
        ? `\nتنبيه: تعذر رفع ${outcome.degradedUploads} صورة إلى التخزين السحابي.`
        : '';
      if (degradeNote) Alert.alert('تنبيه رفع الصورة', degradeNote.trim());
      router.replace({ pathname: '/story', params: { id: outcome.firstPublishedId, resume: '1', next: '' } });
      return;
    }

    const noun = outcome.publishedCount === 1 ? 'قصة' : 'قصص';
    const body = [
      outcome.failures.length > 0
        ? `تم نشر ${outcome.publishedCount} ${noun} من ${outcome.requestedCount}. تعذر نشر: ${outcome.failures.join('، ')}`
        : `تم نشر ${outcome.publishedCount} ${noun} في يوميات الحي وتختفي بعد 24 ساعة.`,
      outcome.degradedUploads > 0
        ? `تنبيه: تعذر رفع ${outcome.degradedUploads} صورة إلى التخزين السحابي؛ قد لا تظهر للآخرين.`
        : '',
    ].filter(Boolean).join('\n');

    Alert.alert('تم النشر بنجاح!', body, [
      { text: 'مشاهدة في الحي', onPress: () => router.replace('/stories') },
    ]);
  }, [composer, publisher, defaultsReady, audience, allowedUserIds, hiddenUserIds, allowStoryReplies, interactiveType, pollQuestion, pollOptionA, pollOptionB, questionPrompt, textColor, fontSize, fontIndex, textRotation, textOffset]);

  if (!activeSlide) return null;

  const currentGradObj = getGradient(activeSlide.bgGradId);
  const currentGradient = currentGradObj.colors;
  const currentFont = WHATSAPP_FONTS[fontIndex];
  const isImageSlide = activeSlide.type === 'image';
  const hasImage = isImageSlide && Boolean(activeSlide.imageUri);
  const textLength = activeSlide.content?.length || 0;
  const adaptiveFontSize = textLength > 120 ? 19 : textLength > 60 ? 23 : 28;

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
    >
      {/* Immersive Creative Canvas */}
      <View style={s.canvasWrapper}>
        <LinearGradient
          colors={hasImage ? ['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.85)'] : currentGradient}
          style={s.gradientCanvas}
        >
          {hasImage && (
            <Image
              source={{ uri: activeSlide.imageUri! }}
              style={s.fullImage}
              resizeMode="cover"
            />
          )}

          {/* Top WhatsApp Status Bar */}
          <View style={[s.composerTopBar, { paddingTop: Math.max(12, safeInsets.top + 4) }]}>
            <Pressable oasisKind="icon" onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="إغلاق إنشاء اليومية" style={s.composerCloseButton}>
              <X size={24} color={OASIS.colors.surface} />
            </Pressable>
            <View style={s.modeSwitcherPill}>
              <Pressable onPress={() => composer.setActiveSlideType('text')} style={[s.modeOption, !isImageSlide && s.modeOptionActive]} accessibilityRole="button" accessibilityLabel="يومية نصية">
                <Text style={[s.modeOptionText, !isImageSlide && s.modeOptionTextActive]}>نص</Text>
              </Pressable>
              <Pressable onPress={() => composer.setActiveSlideType('image')} style={[s.modeOption, isImageSlide && s.modeOptionActive]} accessibilityRole="button" accessibilityLabel="يومية مصورة">
                <Text style={[s.modeOptionText, isImageSlide && s.modeOptionTextActive]}>صورة</Text>
              </Pressable>
            </View>
            <View style={s.composerTopSpacer} />
          </View>
          <View style={{paddingHorizontal: 16, alignItems: 'flex-end'}}><View style={s.topToolsRow}>
              {!isImageSlide ? (
                <>
                  <HeaderAction tone="overlay"
                    onPress={() => setShowPalette(!showPalette)}
                    style={[s.toolIconBtn, showPalette && s.toolIconBtnActive]}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="تغيير لون الخلفية"
                  >
                    <Palette size={19} color={OASIS.colors.surface} />
                  </HeaderAction>
                  <HeaderAction tone="overlay" onPress={() => setShowTemplates(v => !v)} style={[s.toolIconBtn, showTemplates && s.toolIconBtnActive]} accessibilityRole="button" accessibilityLabel="قوالب جاهزة">
                    <LayoutTemplate size={19} color={OASIS.colors.surface} />
                  </HeaderAction>
                  <HeaderAction tone="overlay"
                    onPress={handleCycleFont}
                    style={s.toolIconBtn}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="تغيير نمط الخط"
                  >
                    <Type size={19} color={OASIS.colors.surface} />
                  </HeaderAction>
                  <HeaderAction tone="overlay"
                    onPress={handleCycleAlign}
                    style={s.toolIconBtn}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="محاذاة النص"
                  >
                    {textAlign === 'center' ? (
                      <AlignCenter size={18} color={OASIS.colors.surface} />
                    ) : textAlign === 'right' ? (
                      <AlignRight size={18} color={OASIS.colors.surface} />
                    ) : (
                      <AlignLeft size={18} color={OASIS.colors.surface} />
                    )}
                  </HeaderAction>
                </>
              ) : (
                <>
                  <HeaderAction tone="overlay"
                    onPress={handlePickImages}
                    style={s.toolIconBtn}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="اختيار صورة"
                  >
                    <ImageIcon size={19} color={OASIS.colors.surface} />
                  </HeaderAction>
                  {hasImage && <HeaderAction tone="overlay" onPress={() => void withAssetErrors(composer.cropActiveImage, 'قص الصورة')} style={s.toolIconBtn} accessibilityRole="button" accessibilityLabel="قص الصورة بنسبة تسعة إلى ستة عشر">
                    <Crop size={19} color={OASIS.colors.surface} />
                  </HeaderAction>}
                  <HeaderAction tone="overlay"
                    onPress={handleTakePhoto}
                    style={s.toolIconBtn}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="التقاط بالكاميرا"
                  >
                    <Camera size={19} color={OASIS.colors.surface} />
                  </HeaderAction>
                </>
              )}
              <HeaderAction tone="overlay"
                onPress={() => setShowStoryOptions((value) => !value)}
                style={[s.toolIconBtn, showStoryOptions && s.toolIconBtnActive]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="خيارات القصة والخصوصية"
              >
                <SlidersHorizontal size={18} color={OASIS.colors.surface} />
              </HeaderAction>
            </View></View>

          {/* 24H Badge & Slide Info Notice */}
          <View style={s.badge24hRow}>
            <View style={s.badge24h}>
              <Clock size={11} color={OASIS.colors.soft} />
              <Text style={s.badge24hText}>تختفي تلقائياً بعد 24 ساعة في الحي</Text>
            </View>
            {!isImageSlide && (
              <View style={s.fontBadge}>
                <Text style={s.fontBadgeText}>{currentFont.name}</Text>
              </View>
            )}
          </View>

          {/* Expandable Palette Selector Bar */}
          {!isImageSlide && showPalette && (
            <View style={s.paletteSelectorBox}>
              <ScrollView style={{ direction: 'rtl' }} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.paletteScroll, { direction: 'ltr' }]}>
                {BG_GRADIENTS.map((g) => {
                  const isSelected = activeSlide.bgGradId === g.id;
                  return (
                    <Pressable
                      key={g.id}
                      onPress={() => handleSelectGradient(g.id)}
                      style={[s.paletteCircleWrap, isSelected && s.paletteCircleWrapActive]}
                    >
                      <LinearGradient colors={g.colors} style={s.paletteCircle}>
                        {isSelected && <Check size={14} color={OASIS.colors.surface} strokeWidth={3} />}
                      </LinearGradient>
                      <Text style={[s.paletteName, isSelected && s.paletteNameActive]}>{g.name}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {showTemplates && !isImageSlide && (
            <View style={s.templatePanel}>
              <Text style={s.templateHeading}>قوالب جاهزة</Text>
              <ScrollView style={{ direction: 'rtl' }} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.templateRow, { direction: 'ltr' }]}>
                {STORY_TEMPLATES.map(template => (
                  <Pressable oasisKind="chip" key={template.label} onPress={() => applyTemplate(template)} style={s.templateChip} accessibilityRole="button" accessibilityLabel={`قالب ${template.label}`}>
                    <Text style={s.templateChipText}>{template.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
          {/* Central Content Area */}
          <View style={s.centralCanvas}>
            {!isImageSlide ? (
              <OasisSurface oasisSurface="card" style={[s.textCanvasCard, currentFont.isPill && s.textCanvasCardPill]}>
                <View {...(dragResponder?.panHandlers ?? {})} style={[s.dragHandle, { transform: [{ translateX: textOffset.x }, { translateY: textOffset.y }] }]}>
                  <Move size={16} color={OASIS.colors.surface} />
                  <Text style={s.dragHandleText}>{Platform.OS === 'web' ? 'حرّك النص من إعدادات التنسيق' : 'اسحب لتحريك النص'}</Text>
                </View>
                <TextInput
                  style={[
                    s.whatsAppTextInput,
                    {
                      fontSize: fontSize || adaptiveFontSize,
                      color: textColor,
                      fontWeight: currentFont.fontWeight,
                      fontStyle: currentFont.fontStyle,
                      textAlign: textAlign,
                      transform: [
                        { translateX: textOffset.x },
                        { translateY: textOffset.y },
                        { rotate: `${textRotation}deg` },
                      ],
                    },
                  ]}
                  value={activeSlide.content}
                  onChangeText={(text) => composer.patchActiveSlide({ content: text })}
                  onFocus={() => { setShowStoryOptions(false); setShowPalette(false); }}
                  placeholder="اكتب حالتك أو استفسارك لأهل حيك هنا..."
                  placeholderTextColor="rgba(255,255,255,0.65)"
                  multiline
                  maxLength={300}
                />
              </OasisSurface>
            ) : hasImage ? (
              <View style={s.imageCenterPlaceholder} />
            ) : (
              <OasisSurface oasisSurface="card" style={s.emptyPhotoCard}>
                <View style={s.emptyPhotoIconWrap}>
                  <UploadCloud size={34} color={OASIS.colors.primary} />
                </View>
                <Text style={s.emptyPhotoTitle}>أضف صورة ليومياتك</Text>
                <Text style={s.emptyPhotoSub}>
                  شارك صور مشاريع، معالم الحي، أو نشاطاتك اليومية مع جيرانك
                </Text>

              </OasisSurface>
            )}
          </View>

          {showStoryOptions && (
            <View style={s.storyOptionsPanel}>
              <View style={s.settingsTabs}>
                {([
                  ['privacy', 'الخصوصية'],
                  ['interactive', 'التفاعل'],
                  ['format', 'تنسيق النص'],
                ] as const).map(([key, label]) => (
                  <Pressable key={key} onPress={() => setSettingsSection(key)}
                    style={[s.settingsTab, settingsSection === key && s.settingsTabActive]}>
                    <Text style={[s.settingsTabText, settingsSection === key && s.settingsTabTextActive]}>{label}</Text>
                  </Pressable>
                ))}
              </View>
              <ScrollView style={s.settingsSectionScroll} contentContainerStyle={s.storyOptionsContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {settingsSection === 'privacy' && <>
              <View style={s.optionsSectionHeader}>
                <ShieldCheck size={15} color="#a7f3d0" />
                <Text style={s.optionsSectionTitle}>الجمهور والخصوصية</Text>
              </View>
              <View style={s.optionsChipRow}>
                {([
                  ['public', 'الجميع'],
                  ['followers', 'المتابعون'],
                  ['custom', 'قائمة مخصصة'],
                ] as const).map(([value, label]) => (
                  <Pressable oasisKind="chip" key={value} onPress={() => handleAudienceChange(value)}
                    style={[s.optionsChip, audience === value && s.optionsChipActive]}>
                    <Text style={s.optionsChipText}>{label}</Text>
                  </Pressable>
                ))}
              </View>
              {audience === 'custom' && (
                <View style={s.audiencePicker}>
                  {audienceLoading ? <ActivityIndicator size="small" color="#34d399" /> :
                    audienceCandidates.length === 0 ? (
                      <Text style={s.optionsHint}>لا يوجد متابعون متاحون للاختيار حاليًا.</Text>
                    ) : (
                      <ScrollView style={{ direction: 'rtl' }} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.optionsChipRow, { direction: 'ltr' }]}>
                        {audienceCandidates.map((person) => {
                          const selected = allowedUserIds.includes(person.id);
                          return (
                            <Pressable oasisKind="chip" key={person.id}
                              onPress={() => setAllowedUserIds((ids) => selected ? ids.filter((id) => id !== person.id) : [...ids, person.id])}
                              style={[s.personChip, selected && s.optionsChipActive]}>
                              <Text style={s.optionsChipText}>{person.display_name || person.username || 'مستخدم'}</Text>
                              {selected ? <Check size={12} color="#a7f3d0" /> : null}
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    )}
                </View>
              )}

              <View style={s.optionsSectionHeader}>
                <ShieldCheck size={15} color="#a7f3d0" />
                <Text style={s.optionsSectionTitle}>الردود على القصة</Text>
              </View>
              <Pressable oasisKind="chip" disabled={accountRepliesDisabled} onPress={() => setAllowStoryReplies((value) => !value)} style={[s.optionsChip, allowStoryReplies && s.optionsChipActive]}>
                <Text style={s.optionsChipText}>{allowStoryReplies ? 'الردود مسموحة' : 'الردود مغلقة'}</Text>
                <Text style={s.optionsHint}>{accountRepliesDisabled ? 'الردود مغلقة من إعدادات حسابك. غيّرها من إعدادات اليوميات.' : allowStoryReplies ? 'تطبق صلاحيات الرد من إعدادات حسابك' : 'لن يتمكن أحد من الرد على هذه القصة'}</Text>
              </Pressable>

              <View style={s.optionsSectionHeader}>
                <ShieldCheck size={15} color="#fbbf24" />
                <Text style={s.optionsSectionTitle}>إخفاء القصة عن أشخاص محددين</Text>
              </View>
              <Text style={s.optionsHint}>الأشخاص المحددون هنا لن تظهر لهم هذه القصة، حتى لو كانوا ضمن جمهورها.</Text>
              {audienceCandidates.length === 0 ? (
                <Pressable oasisKind="chip" onPress={loadAudienceCandidates} style={s.personChip}>
                  <Text style={s.optionsChipText}>تحميل قائمة المتابعين</Text>
                </Pressable>
              ) : (
                <ScrollView style={{ direction: 'rtl' }} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.optionsChipRow, { direction: 'ltr' }]}>
                  {audienceCandidates.map((person) => {
                    const selected = hiddenUserIds.includes(person.id);
                    return (
                      <Pressable oasisKind="chip" key={`hidden-${person.id}`}
                        onPress={() => setHiddenUserIds((ids) => selected ? ids.filter((id) => id !== person.id) : [...ids, person.id])}
                        style={[s.personChip, selected && s.optionsChipActive]}>
                        <Text style={s.optionsChipText}>{person.display_name || person.username || 'مستخدم'}</Text>
                        {selected ? <Check size={12} color="#fbbf24" /> : null}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}

              </>}
              {settingsSection === 'interactive' && <>
              <Text style={s.optionsSectionTitle}>إضافة تفاعل</Text>
              <View style={s.optionsChipRow}>
                {([
                  ['none', 'بدون'],
                  ['poll', 'استطلاع'],
                  ['question', 'سؤال'],
                ] as const).map(([value, label]) => (
                  <Pressable oasisKind="chip" key={value} onPress={() => setInteractiveType(value)}
                    style={[s.optionsChip, interactiveType === value && s.optionsChipActive]}>
                    <Text style={s.optionsChipText}>{label}</Text>
                  </Pressable>
                ))}
              </View>
              {interactiveType === 'poll' ? (
                <View style={s.optionsFields}>
                  <TextInput style={s.optionsInput} value={pollQuestion} onChangeText={setPollQuestion}
                    placeholder="سؤال الاستطلاع" placeholderTextColor="#94a3b8" maxLength={120} />
                  <TextInput style={s.optionsInput} value={pollOptionA} onChangeText={setPollOptionA}
                    placeholder="الخيار الأول" placeholderTextColor="#94a3b8" maxLength={50} />
                  <TextInput style={s.optionsInput} value={pollOptionB} onChangeText={setPollOptionB}
                    placeholder="الخيار الثاني" placeholderTextColor="#94a3b8" maxLength={50} />
                </View>
              ) : interactiveType === 'question' ? (
                <TextInput style={s.optionsInput} value={questionPrompt} onChangeText={setQuestionPrompt}
                  placeholder="السؤال للمتابعين" placeholderTextColor="#94a3b8" maxLength={180} />
              ) : null}

              </>}
              {settingsSection === 'format' && <>
              <Text style={s.optionsSectionTitle}>تنسيق النص</Text>
              <View style={s.optionsChipRow}>
                {STORY_TEXT_COLORS.map((color) => (
                  <Pressable key={color} onPress={() => setTextColor(color)}
                    style={[s.storyTextColorDot, { backgroundColor: color }, textColor === color && s.storyTextColorDotActive]} />
                ))}
                <Pressable oasisKind="chip" style={s.optionsChip} onPress={() => setFontSize((n) => Math.max(16, n - 2))}>
                  <Text style={s.optionsChipText}>A−</Text>
                </Pressable>
                <Text style={s.optionsChipText}>{fontSize}</Text>
                <Pressable oasisKind="chip" style={s.optionsChip} onPress={() => setFontSize((n) => Math.min(48, n + 2))}>
                  <Text style={s.optionsChipText}>A+</Text>
                </Pressable>
                <Pressable oasisKind="chip" style={s.optionsChip} onPress={() => setTextRotation((n) => (n + 5) % 360)}>
                  <Text style={s.optionsChipText}>تدوير ↻</Text>
                </Pressable>
                <Pressable oasisKind="chip" style={s.optionsChip} onPress={() => setTextRotation((n) => (n - 5 + 360) % 360)}>
                  <Text style={s.optionsChipText}>↺</Text>
                </Pressable>
              </View>
              <View style={s.optionsChipRow}>
                {([
                  ['↑', 0, -12], ['↓', 0, 12], ['←', -12, 0], ['→', 12, 0],
                ] as const).map(([label, dx, dy]) => (
                  <Pressable oasisKind="chip" key={label} style={s.optionsChip}
                    onPress={() => setTextOffset((pos) => ({ x: Math.max(-140, Math.min(140, pos.x + dx)), y: Math.max(-260, Math.min(260, pos.y + dy)) }))}>
                    <Text style={s.optionsChipText}>{label}</Text>
                  </Pressable>
                ))}
                <Pressable oasisKind="chip" style={s.optionsChip} onPress={() => { setTextRotation(0); setTextOffset({ x: 0, y: 0 }); }}>
                  <Text style={s.optionsChipText}>إعادة ضبط الموضع</Text>
                </Pressable>
              </View>
              </>}
              </ScrollView>
            </View>
          )}

          {/* Multi-slide carousel indicator strip */}
          {composer.slides.length > 1 && (
            <View style={s.slideIndicatorStrip}>
              <ScrollView style={{ direction: 'rtl' }} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.thumbsScroll, { direction: 'ltr' }]}>
                {composer.slides.map((sItem, idx) => (
                  <Pressable
                    key={idx}
                    onPress={() => composer.selectSlide(idx)}
                    style={[s.thumbItem, idx === composer.activeIdx && s.thumbItemActive]}
                  >
                    {sItem.type === 'image' && sItem.imageUri ? (
                      <Image source={{ uri: sItem.imageUri }} style={s.thumbImg} />
                    ) : (
                      <View style={s.thumbTextPlaceholder}>
                        <Text style={s.thumbTextLetter}>{sItem.content?.[0] || 'ن'}</Text>
                      </View>
                    )}
                    {idx === composer.activeIdx && composer.slides.length > 1 && (
                      <Pressable
                        style={s.thumbDeleteBadge}
                        onPress={() => composer.removeSlide(idx)}
                        hitSlop={6}
                      >
                        <Trash2 size={10} color={OASIS.colors.surface} />
                      </Pressable>
                    )}
                  </Pressable>
                ))}
                {!composer.atCapacity && (
                  <Pressable oasisKind="icon"
                    style={s.thumbAddBtn}
                    onPress={isImageSlide ? handlePickImages : composer.addTextSlide}
                  >
                    <Plus size={16} color={OASIS.colors.surface} />
                  </Pressable>
                )}
              </ScrollView>
            </View>
          )}

          {/* Bottom WhatsApp Control & Send Bar */}
          <View style={s.bottomWhatsAppBar}>
            {/* Caption Input for Image Mode */}
            {isImageSlide && hasImage ? (
              <View style={s.whatsAppCaptionInputWrap}>
                <TextInput
                  style={[s.whatsAppCaptionInput, {
                    color: textColor,
                    fontSize: Math.min(fontSize, 30),
                    transform: [
                      { translateX: textOffset.x },
                      { translateY: textOffset.y },
                      { rotate: `${textRotation}deg` },
                    ],
                  }]}
                  value={activeSlide.content}
                  onChangeText={(text) => composer.patchActiveSlide({ content: text })}
                  onFocus={() => { setShowStoryOptions(false); setShowPalette(false); }}
                  placeholder="إضافة شرح وتفاصيل..."
                  placeholderTextColor="#94a3b8"
                  maxLength={150}
                />
              </View>
            ) : !isImageSlide ? (
              <View style={s.charCounterWrap}>
                <Text style={s.charCounterText}>{textLength}/300</Text>
              </View>
            ) : (
              <View style={{ flex: 1 }} />
            )}

            {/* Glowing Circular Send Button */}
            <Pressable
              style={[
                s.whatsAppSendFab,
                (!composer.isReady || publisher.publishing) && s.whatsAppSendFabDisabled,
              ]}
              onPress={handlePublish}
              disabled={!defaultsReady || !composer.isReady || publisher.publishing}
              accessibilityRole="button"
              accessibilityLabel="نشر الحالة"
            >
              <LinearGradient
                colors={composer.isReady ? [OASIS.colors.primary, OASIS.colors.primary] : [OASIS.colors.muted, OASIS.colors.ink]}
                style={s.whatsAppSendFabGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                {publisher.publishing ? (
                  <ActivityIndicator size="small" color={OASIS.colors.surface} />
                ) : (
                  <Send size={22} color={OASIS.colors.surface} />
                )}
              </LinearGradient>
            </Pressable>
          </View>
        </LinearGradient>
      </View>

      {/* Publishing Progress Overlay */}
      {publisher.publishing && (
        <View style={s.publishingOverlay}>
          <View style={s.publishingModal}>
            <ActivityIndicator size="large" color={OASIS.colors.primary} />
            <Text style={s.publishingTitle}>جارٍ نشر يومياتك في الحي...</Text>
            {publisher.status ? (
              <Text style={s.publishingStatus}>{publisher.status}</Text>
            ) : null}
            {publisher.total > 0 ? (
              <View style={s.publishProgressTrack}>
                <View style={[s.publishProgressFill, { width: `${Math.round((publisher.done / publisher.total) * 100)}%` }]} />
              </View>
            ) : null}
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  templatePanel: { marginHorizontal: 14, padding: 10, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.42)', zIndex: 30 },
  templateHeading: { color: OASIS.colors.surface, fontSize: 12, fontWeight: '600', textAlign: 'right', marginBottom: 7 },
  templateRow: { flexDirection: 'row-reverse', gap: 8 },
  templateChip: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.18)' },
  templateChipText: { color: OASIS.colors.surface, fontSize: 12, fontWeight: '700' },
  dragHandle: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 13, paddingVertical: 8, borderRadius: 14, backgroundColor: 'rgba(0,0,0,0.35)', zIndex: 12 },
  dragHandleText: { color: OASIS.colors.surface, fontSize: 11, fontWeight: '700' },
  composerTopBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingBottom: 8, backgroundColor: 'transparent', zIndex: 20 },
  composerCloseButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  composerTopSpacer: { width: 40, height: 40 },
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  canvasWrapper: {
    flex: 1,
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  gradientCanvas: {
    flex: 1,
    width: '100%',
    height: '100%',
    justifyContent: 'space-between',
  },
  fullImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  topBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
    paddingHorizontal: 16,
    zIndex: 20,
  },
  circleIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeSwitcherPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 14,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  modeOption: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  modeOptionActive: {
    backgroundColor: OASIS.colors.primary,
  },
  modeOptionText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '700',
  },
  modeOptionTextActive: {
    color: OASIS.colors.surface,
    fontWeight: '700',
  },
  topToolsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  toolIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  toolIconBtnActive: {
    backgroundColor: OASIS.colors.primary,
    borderColor: '#34d399',
  },
  badge24hRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  badge24h: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 12,
    paddingVertical: 4.5,
    borderRadius: 20,
  },
  badge24hText: {
    color: OASIS.colors.soft,
    fontSize: 11,
    fontWeight: '700',
  },
  fontBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  fontBadgeText: {
    color: OASIS.colors.surface,
    fontSize: 11,
    fontWeight: '600',
  },
  paletteSelectorBox: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  paletteScroll: {
    flexDirection: 'row-reverse',
    paddingHorizontal: 16,
    gap: 12,
    alignItems: 'center',
  },
  paletteCircleWrap: {
    alignItems: 'center',
    gap: 3,
  },
  paletteCircleWrapActive: {
    transform: [{ scale: 1.08 }],
  },
  paletteCircle: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: OASIS.colors.surface,
  },
  paletteName: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
  },
  paletteNameActive: {
    color: '#34d399',
    fontWeight: '700',
  },
  centralCanvas: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  textCanvasCard: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCanvasCardPill: {
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 24,
    paddingVertical: 18,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  whatsAppTextInput: {
    color: OASIS.colors.surface,
    lineHeight: 38,
    width: '100%',
    paddingHorizontal: 10,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1.5 },
    textShadowRadius: 4,
  },
  imageCenterPlaceholder: {
    flex: 1,
  },
  emptyPhotoCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
  },
  emptyPhotoIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: OASIS.colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyPhotoTitle: {
    color: OASIS.colors.surface,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyPhotoSub: {
    color: '#94a3b8',
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  slideIndicatorStrip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  thumbsScroll: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  thumbItem: {
    width: 48,
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    position: 'relative',
  },
  thumbItemActive: {
    borderColor: OASIS.colors.primary,
    transform: [{ scale: 1.08 }],
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },
  thumbTextPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: OASIS.colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbTextLetter: {
    color: OASIS.colors.surface,
    fontSize: 16,
    fontWeight: '700',
  },
  thumbDeleteBadge: {
    position: 'absolute',
    top: 2,
    left: 2,
    backgroundColor: OASIS.colors.danger,
    borderRadius: 7,
    padding: 2,
  },
  thumbAddBtn: {
    width: 48,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: OASIS.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomWhatsAppBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 36 : 18,
    paddingTop: 10,
    gap: 12,
  },
  whatsAppCaptionInputWrap: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  whatsAppCaptionInput: {
    color: OASIS.colors.surface,
    fontSize: 14,
    textAlign: 'right',
  },
  charCounterWrap: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  charCounterText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '700',
  },
  whatsAppSendFab: {
    width: 52,
    height: 52,
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: OASIS.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0,
    shadowRadius: 8,
    elevation: 6,
  },
  whatsAppSendFabGrad: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  whatsAppSendFabDisabled: {
    opacity: 0.5,
  },
  storyOptionsPanel: {
    maxHeight: 210,
    marginHorizontal: 12,
    marginVertical: 4,
    padding: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(15,23,42,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  settingsTabs: { flexDirection: 'row-reverse', gap: 6, marginBottom: 6 },
  settingsTab: { flex: 1, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center' },
  settingsTabActive: { backgroundColor: OASIS.colors.deep, borderWidth: 1, borderColor: '#34d399' },
  settingsTabText: { color: '#cbd5e1', fontSize: 11, fontWeight: '700' },
  settingsTabTextActive: { color: OASIS.colors.surface, fontWeight: '700' },
  settingsSectionScroll: { maxHeight: 150 },
  storyOptionsContent: { paddingHorizontal: 4, paddingVertical: 5, gap: 9 },
  optionsSectionHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  optionsSectionTitle: { color: OASIS.colors.surface, fontSize: 11, fontWeight: '700', textAlign: 'right' },
  optionsChipRow: { flexDirection: 'row-reverse', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  optionsChip: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10, backgroundColor: OASIS.colors.ink, flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  optionsChipActive: { backgroundColor: OASIS.colors.deep, borderWidth: 1, borderColor: '#34d399' },
  optionsChipText: { color: OASIS.colors.surface, fontSize: 11, fontWeight: '600' },
  optionsHint: { color: '#cbd5e1', fontSize: 11, textAlign: 'right' },
  audiencePicker: { maxHeight: 42 },
  personChip: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10, backgroundColor: OASIS.colors.ink, flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  optionsFields: { gap: 5 },
  optionsInput: { minHeight: 32, color: OASIS.colors.surface, backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.2)', borderWidth: 1, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 5, fontSize: 12, textAlign: 'right' },
  storyTextColorDot: { width: 19, height: 19, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  storyTextColorDotActive: { borderWidth: 3, borderColor: '#34d399' },
  publishProgressTrack: { height: 5, width: '100%', backgroundColor: OASIS.colors.line, borderRadius: 5, overflow: 'hidden', marginTop: 4 },
  publishProgressFill: { height: '100%', backgroundColor: OASIS.colors.primary, borderRadius: 5 },
  publishingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  publishingModal: {
    backgroundColor: OASIS.colors.surface,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    gap: 12,
    width: 260,
  },
  publishingTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: OASIS.colors.ink,
    textAlign: 'center',
  },
  publishingStatus: {
    fontSize: 12,
    color: OASIS.colors.muted,
    textAlign: 'center',
  },
});
