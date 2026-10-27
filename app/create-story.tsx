import { OasisPressable as Pressable } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View, ActivityIndicator, PanResponder } from 'react-native';
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
import { loadBannedWords } from '@/lib/profanity';
import { findProhibitedStoryWord } from '@/lib/storyModeration';
import { useStoryComposer } from '@/hooks/useStoryComposer';
import { useStoryPublisher } from '@/hooks/useStoryPublisher';
import { BG_GRADIENTS, getGradient } from '@/lib/storyGradients';
import { storyComposerStyles as s } from '@/components/story/composerStyles';

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
    const detected = findProhibitedStoryWord({ content: storyText }, await loadBannedWords());
    if (detected) {
      Alert.alert('تعذر نشر اليومية', 'تحتوي اليومية على كلمات ممنوعة. عدّل النص أو خيارات الاستطلاع ثم حاول مجددًا.');
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
      style={[s.container, { backgroundColor: 'transparent' }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
    >
      {Platform.OS === 'web' && <style>{`[data-testid="story-text-editor"], [data-testid="story-text-editor"]:focus {font-size:${fontSize}px !important;line-height:${Math.round(fontSize * 1.5)}px !important;outline:none !important;}`}</style>}
      <View style={[s.editorHeader, { paddingTop: Math.max(12, safeInsets.top + 8) }]}>
        <Pressable oasisKind="plain" disabled={publisher.publishing} onPress={() => router.canGoBack() ? router.back() : router.replace('/home')} accessibilityRole="button" accessibilityLabel="إغلاق إنشاء اليومية" style={s.composerCloseButton}>
          <X size={21} color="#17664F" />
        </Pressable>
        <View style={s.editorHeading}><Text style={s.editorTitle}>يومية جديدة</Text><Text style={s.editorSubtitle}>لحظة منك، وحكاية لأهل حيّك</Text></View>
        <View style={s.editorBrand}><Type size={20} color="#17664F" /></View>
      </View>
      <View style={s.modeBar}>
        <View style={s.modeSwitcherPill}>
          <Pressable oasisKind="plain" onPress={() => composer.patchActiveSlide({ type: 'text' })} style={[s.modeOption, !isImageSlide && s.modeOptionActive]} accessibilityRole="button" accessibilityLabel="يومية نصية" accessibilityState={{ selected: !isImageSlide }}>
            <Type size={16} color={!isImageSlide ? '#17664F' : '#819087'} /><Text style={[s.modeOptionText, !isImageSlide && s.modeOptionTextActive]}>نص</Text>
          </Pressable>
          <Pressable oasisKind="plain" onPress={() => composer.patchActiveSlide({ type: 'image' })} style={[s.modeOption, isImageSlide && s.modeOptionActive]} accessibilityRole="button" accessibilityLabel="يومية مصورة" accessibilityState={{ selected: isImageSlide }}>
            <ImageIcon size={16} color={isImageSlide ? '#17664F' : '#819087'} /><Text style={[s.modeOptionText, isImageSlide && s.modeOptionTextActive]}>صورة</Text>
          </Pressable>
        </View>
        <View style={s.expiryNote}><Clock size={12} color="#7A8E81" /><Text style={s.expiryText}>تظهر لمدة ٢٤ ساعة</Text></View>
      </View>
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

          <View style={s.composerTopBar}>
            <View style={s.previewHeading}><View style={s.previewDot} /><Text style={s.previewTitle}>معاينة اليومية</Text><Text style={s.previewCount}>{composer.activeIdx + 1} / {composer.slides.length}</Text></View>
            <Pressable oasisKind="plain" accessibilityLabel="إضافة شريحة" disabled={composer.atCapacity} onPress={isImageSlide ? handlePickImages : composer.addTextSlide} style={s.addSlideButton}><Plus size={16} color="#FFFFFF" /></Pressable>
          </View>
          <View style={{paddingHorizontal: 16, alignItems: 'flex-end'}}><View style={s.topToolsRow}>
              {!isImageSlide ? (
                <>
                  <Pressable oasisKind="plain"
                    onPress={() => { setShowPalette(v => !v); setShowTemplates(false); setShowStoryOptions(false); }}
                    style={[s.toolIconBtn, showPalette && s.toolIconBtnActive]}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="تغيير لون الخلفية"
                  >
                    <Palette size={19} color={OASIS.colors.surface} />
                  </Pressable>
                  <Pressable oasisKind="plain" onPress={() => { setShowTemplates(v => !v); setShowPalette(false); setShowStoryOptions(false); }} style={[s.toolIconBtn, showTemplates && s.toolIconBtnActive]} accessibilityRole="button" accessibilityLabel="قوالب جاهزة">
                    <LayoutTemplate size={19} color={OASIS.colors.surface} />
                  </Pressable>
                  <Pressable oasisKind="plain"
                    onPress={handleCycleFont}
                    style={s.toolIconBtn}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="تغيير نمط الخط"
                  >
                    <Type size={19} color={OASIS.colors.surface} />
                  </Pressable>
                  <Pressable oasisKind="plain"
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
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable oasisKind="plain"
                    onPress={handlePickImages}
                    style={s.toolIconBtn}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="اختيار صورة"
                  >
                    <ImageIcon size={19} color={OASIS.colors.surface} />
                  </Pressable>
                  {hasImage && <Pressable oasisKind="plain" onPress={() => void withAssetErrors(composer.cropActiveImage, 'قص الصورة')} style={s.toolIconBtn} accessibilityRole="button" accessibilityLabel="قص الصورة بنسبة تسعة إلى ستة عشر">
                    <Crop size={19} color={OASIS.colors.surface} />
                  </Pressable>}
                  <Pressable oasisKind="plain"
                    onPress={handleTakePhoto}
                    style={s.toolIconBtn}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="التقاط بالكاميرا"
                  >
                    <Camera size={19} color={OASIS.colors.surface} />
                  </Pressable>
                </>
              )}
              <Pressable oasisKind="plain"
                onPress={() => { setShowStoryOptions(v => !v); setShowPalette(false); setShowTemplates(false); }}
                style={[s.toolIconBtn, showStoryOptions && s.toolIconBtnActive]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="خيارات القصة والخصوصية"
              >
                <SlidersHorizontal size={18} color={OASIS.colors.surface} />
              </Pressable>
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
              <ScrollView  horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.paletteScroll]}>
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
              <ScrollView  horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.templateRow]}>
                {STORY_TEMPLATES.map(template => (
                  <Pressable oasisKind="plain" key={template.label} onPress={() => applyTemplate(template)} style={s.templateChip} accessibilityRole="button" accessibilityLabel={`قالب ${template.label}`}>
                    <Text style={s.templateChipText}>{template.label}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}
          {/* Central Content Area */}
          <View style={s.centralCanvas}>
            {!isImageSlide ? (
              <View style={[s.textCanvasCard, currentFont.isPill && s.textCanvasCardPill]}>
                <View {...(dragResponder?.panHandlers ?? {})} style={[s.dragHandle, { transform: [{ translateX: textOffset.x }, { translateY: textOffset.y }] }]}>
                  <Move size={16} color={OASIS.colors.surface} />
                  <Text style={s.dragHandleText}>{Platform.OS === 'web' ? 'حرّك النص من إعدادات التنسيق' : 'اسحب لتحريك النص'}</Text>
                </View>
                <TextInput
                  testID="story-text-editor"
                  accessibilityLabel="نص اليومية"
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
                  placeholder="وش حاب تشارك أهل حيّك؟"
                  placeholderTextColor="rgba(255,255,255,0.75)"
                  multiline
                  maxLength={300}
                />
              </View>
            ) : hasImage ? (
              <View style={s.imageCenterPlaceholder} />
            ) : (
              <View style={s.emptyPhotoCard}>
                <View style={s.emptyPhotoIconWrap}>
                  <UploadCloud size={34} color={OASIS.colors.primary} />
                </View>
                <Text style={s.emptyPhotoTitle}>أضف صورة ليومياتك</Text>
                <Text style={s.emptyPhotoSub}>
                  شارك صور مشاريع، معالم الحي، أو نشاطاتك اليومية مع جيرانك
                </Text>
                <Pressable oasisKind="plain" onPress={handlePickImages} accessibilityLabel="اختيار صورة من الألبوم" style={s.photoPickButton}><ImageIcon size={17} color="#17664F" /><Text style={s.photoPickText}>اختيار من الألبوم</Text></Pressable>
                <Pressable oasisKind="plain" onPress={handleTakePhoto} accessibilityLabel="التقاط صورة بالكاميرا" style={s.photoCameraButton}><Camera size={16} color="#FFFFFF" /><Text style={s.photoCameraText}>التقاط صورة</Text></Pressable>
              </View>
            )}
          </View>

          {showStoryOptions && (
            <View style={s.storyOptionsPanel}>
              <View style={s.settingsHeading}><Text style={s.settingsTitle}>إعدادات اليومية</Text><Pressable oasisKind="plain" onPress={() => setShowStoryOptions(false)} accessibilityLabel="إغلاق إعدادات اليومية" style={s.settingsClose}><X size={18} color="#17664F" /></Pressable></View>
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
                  <Pressable oasisKind="plain" key={value} onPress={() => handleAudienceChange(value)}
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
                      <ScrollView  horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.optionsChipRow]}>
                        {audienceCandidates.map((person) => {
                          const selected = allowedUserIds.includes(person.id);
                          return (
                            <Pressable oasisKind="plain" key={person.id}
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
              <Pressable oasisKind="plain" disabled={accountRepliesDisabled} onPress={() => setAllowStoryReplies((value) => !value)} style={[s.optionsChip, allowStoryReplies && s.optionsChipActive]}>
                <Text style={s.optionsChipText}>{allowStoryReplies ? 'الردود مسموحة' : 'الردود مغلقة'}</Text>
                <Text style={s.optionsHint}>{accountRepliesDisabled ? 'الردود مغلقة من إعدادات حسابك. غيّرها من إعدادات اليوميات.' : allowStoryReplies ? 'تطبق صلاحيات الرد من إعدادات حسابك' : 'لن يتمكن أحد من الرد على هذه القصة'}</Text>
              </Pressable>

              <View style={s.optionsSectionHeader}>
                <ShieldCheck size={15} color="#fbbf24" />
                <Text style={s.optionsSectionTitle}>إخفاء القصة عن أشخاص محددين</Text>
              </View>
              <Text style={s.optionsHint}>الأشخاص المحددون هنا لن تظهر لهم هذه القصة، حتى لو كانوا ضمن جمهورها.</Text>
              {audienceCandidates.length === 0 ? (
                <Pressable oasisKind="plain" onPress={loadAudienceCandidates} style={s.personChip}>
                  <Text style={s.optionsChipText}>تحميل قائمة المتابعين</Text>
                </Pressable>
              ) : (
                <ScrollView  horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.optionsChipRow]}>
                  {audienceCandidates.map((person) => {
                    const selected = hiddenUserIds.includes(person.id);
                    return (
                      <Pressable oasisKind="plain" key={`hidden-${person.id}`}
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
                  <Pressable oasisKind="plain" key={value} onPress={() => setInteractiveType(value)}
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
                <Pressable oasisKind="plain" style={s.optionsChip} onPress={() => setFontSize((n) => Math.max(16, n - 2))}>
                  <Text style={s.optionsChipText}>A−</Text>
                </Pressable>
                <Text style={s.optionsChipText}>{fontSize}</Text>
                <Pressable oasisKind="plain" style={s.optionsChip} onPress={() => setFontSize((n) => Math.min(48, n + 2))}>
                  <Text style={s.optionsChipText}>A+</Text>
                </Pressable>
                <Pressable oasisKind="plain" style={s.optionsChip} onPress={() => setTextRotation((n) => (n + 5) % 360)}>
                  <Text style={s.optionsChipText}>تدوير ↻</Text>
                </Pressable>
                <Pressable oasisKind="plain" style={s.optionsChip} onPress={() => setTextRotation((n) => (n - 5 + 360) % 360)}>
                  <Text style={s.optionsChipText}>↺</Text>
                </Pressable>
              </View>
              <View style={s.optionsChipRow}>
                {([
                  ['↑', 0, -12], ['↓', 0, 12], ['←', -12, 0], ['→', 12, 0],
                ] as const).map(([label, dx, dy]) => (
                  <Pressable oasisKind="plain" key={label} style={s.optionsChip}
                    onPress={() => setTextOffset((pos) => ({ x: Math.max(-140, Math.min(140, pos.x + dx)), y: Math.max(-260, Math.min(260, pos.y + dy)) }))}>
                    <Text style={s.optionsChipText}>{label}</Text>
                  </Pressable>
                ))}
                <Pressable oasisKind="plain" style={s.optionsChip} onPress={() => { setTextRotation(0); setTextOffset({ x: 0, y: 0 }); }}>
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
              <ScrollView  horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[s.thumbsScroll]}>
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
                  <Pressable oasisKind="plain"
                    style={s.thumbAddBtn}
                    onPress={isImageSlide ? handlePickImages : composer.addTextSlide}
                  >
                    <Plus size={16} color={OASIS.colors.surface} />
                  </Pressable>
                )}
              </ScrollView>
            </View>
          )}

        </LinearGradient>
      </View>
          <View style={[s.bottomWhatsAppBar, { paddingBottom: Math.max(12, safeInsets.bottom + 8) }]}>
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
                <Text style={s.footerAudience}>{audience === 'public' ? 'الجميع' : audience === 'followers' ? 'المتابعون' : 'قائمة مخصصة'}</Text><Text style={s.charCounterText}>{textLength} / 300 حرف</Text>
              </View>
            ) : (
              <View style={{ flex: 1 }} />
            )}

            {/* Glowing Circular Send Button */}
            <Pressable
              oasisKind="plain"
              style={[
                s.whatsAppSendFab,
                (!defaultsReady || !composer.isReady || publisher.publishing) && s.whatsAppSendFabDisabled,
              ]}
              onPress={handlePublish}
              disabled={!defaultsReady || !composer.isReady || publisher.publishing}
              accessibilityRole="button"
              accessibilityLabel="نشر اليومية"
            >
                {publisher.publishing ? (
                  <ActivityIndicator size="small" color="#17664F" />
                ) : (
                  <Send size={18} color={defaultsReady && composer.isReady ? '#FFFFFF' : '#789383'} />
                )}
                <Text style={[s.publishLabel, (!defaultsReady || !composer.isReady || publisher.publishing) && s.publishLabelDisabled]}>{publisher.publishing ? 'جارٍ النشر…' : 'نشر اليومية'}</Text>
            </Pressable>
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
