import { useState, useCallback } from 'react';
import {
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from 'react-native';
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
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
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

const QUICK_EMOJIS = ['👋', '☕', '🕌', '🇸🇦', '🌙', '📍', '🌧️', '✨', '🚗', '🏡', '🤝', '🔥'];
const STORY_TEXT_COLORS = ['#FFFFFF', '#111827', '#F87171', '#FBBF24', '#34D399', '#60A5FA', '#C084FC', '#FB7185'];

export default function CreateStory() {
  const composer = useStoryComposer();
  const publisher = useStoryPublisher();
  const { activeSlide } = composer;

  const [fontIndex, setFontIndex] = useState(0); // default bold
  const [textAlign, setTextAlign] = useState<'center' | 'right' | 'left'>('center');
  const [showPalette, setShowPalette] = useState(false);
  const [showStoryOptions, setShowStoryOptions] = useState(false);
  const [audience, setAudience] = useState<'public' | 'followers' | 'custom'>('public');
  const [audienceCandidates, setAudienceCandidates] = useState<Array<{ id: string; display_name: string | null; username: string | null }>>([]);
  const [allowedUserIds, setAllowedUserIds] = useState<string[]>([]);
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [interactiveType, setInteractiveType] = useState<'none' | 'poll' | 'question'>('none');
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptionA, setPollOptionA] = useState('نعم');
  const [pollOptionB, setPollOptionB] = useState('لا');
  const [questionPrompt, setQuestionPrompt] = useState('');
  const [textColor, setTextColor] = useState('#FFFFFF');
  const [fontSize, setFontSize] = useState(28);
  const [textRotation, setTextRotation] = useState(0);
  const [textOffset, setTextOffset] = useState({ x: 0, y: 0 });

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

  const handleInsertEmoji = useCallback((emoji: string) => {
    if (!activeSlide) return;
    const current = activeSlide.content || '';
    if (current.length >= 300) return;
    composer.patchActiveSlide({ content: current + emoji });
  }, [activeSlide, composer]);

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

    let outcome: Awaited<ReturnType<typeof publisher.publish>>;
    try {
      outcome = await publisher.publish(composer.slides, {
        audience,
        allowedUserIds,
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

    const noun = outcome.publishedCount === 1 ? 'قصة' : 'قصص';
    const body = [
      outcome.failures.length > 0
        ? `تم نشر ${outcome.publishedCount} ${noun} من ${outcome.requestedCount}. تعذر نشر: ${outcome.failures.join('، ')}`
        : `تم نشر ${outcome.publishedCount} ${noun} في يوميات الحي وتختفي بعد 24 ساعة.`,
      outcome.degradedUploads > 0
        ? `تنبيه: تعذر رفع ${outcome.degradedUploads} صورة إلى التخزين السحابي؛ قد لا تظهر للآخرين.`
        : '',
    ].filter(Boolean).join('\n');

    Alert.alert('تم النشر بنجاح! 🎉', body, [
      { text: 'مشاهدة في الحي', onPress: () => router.replace('/stories') },
    ]);
  }, [composer, publisher, audience, allowedUserIds, interactiveType, pollQuestion, pollOptionA, pollOptionB, questionPrompt, textColor, fontSize, fontIndex, textRotation, textOffset]);

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
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
          <View style={s.topBar}>
            <Pressable
              onPress={() => router.back()}
              style={s.circleIconBtn}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="إغلاق"
            >
              <X size={20} color="#fff" />
            </Pressable>

            {/* Mode Toggle: Text status vs Image status */}
            <View style={s.modeSwitcherPill}>
              <Pressable
                onPress={() => composer.setActiveSlideType('text')}
                style={[s.modeOption, !isImageSlide && s.modeOptionActive]}
              >
                <Text style={[s.modeOptionText, !isImageSlide && s.modeOptionTextActive]}>
                  ✏️ نص
                </Text>
              </Pressable>
              <Pressable
                onPress={() => composer.setActiveSlideType('image')}
                style={[s.modeOption, isImageSlide && s.modeOptionActive]}
              >
                <Text style={[s.modeOptionText, isImageSlide && s.modeOptionTextActive]}>
                  📷 صورة
                </Text>
              </Pressable>
            </View>

            {/* Creative Top Tools */}
            <View style={s.topToolsRow}>
              {!isImageSlide ? (
                <>
                  <Pressable
                    onPress={() => setShowPalette(!showPalette)}
                    style={[s.toolIconBtn, showPalette && s.toolIconBtnActive]}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="تغيير لون الخلفية"
                  >
                    <Palette size={19} color="#fff" />
                  </Pressable>
                  <Pressable
                    onPress={handleCycleFont}
                    style={s.toolIconBtn}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="تغيير نمط الخط"
                  >
                    <Type size={19} color="#fff" />
                  </Pressable>
                  <Pressable
                    onPress={handleCycleAlign}
                    style={s.toolIconBtn}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="محاذاة النص"
                  >
                    {textAlign === 'center' ? (
                      <AlignCenter size={18} color="#fff" />
                    ) : textAlign === 'right' ? (
                      <AlignRight size={18} color="#fff" />
                    ) : (
                      <AlignLeft size={18} color="#fff" />
                    )}
                  </Pressable>
                </>
              ) : (
                <>
                  <Pressable
                    onPress={handlePickImages}
                    style={s.toolIconBtn}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="اختيار صورة"
                  >
                    <ImageIcon size={19} color="#fff" />
                  </Pressable>
                  <Pressable
                    onPress={handleTakePhoto}
                    style={s.toolIconBtn}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="التقاط بالكاميرا"
                  >
                    <Camera size={19} color="#fff" />
                  </Pressable>
                </>
              )}
              <Pressable
                onPress={() => setShowStoryOptions((value) => !value)}
                style={[s.toolIconBtn, showStoryOptions && s.toolIconBtnActive]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="خيارات القصة والخصوصية"
              >
                <SlidersHorizontal size={18} color="#fff" />
              </Pressable>
            </View>
          </View>

          {/* 24H Badge & Slide Info Notice */}
          <View style={s.badge24hRow}>
            <View style={s.badge24h}>
              <Clock size={11} color="#d1fae5" />
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
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.paletteScroll}>
                {BG_GRADIENTS.map((g) => {
                  const isSelected = activeSlide.bgGradId === g.id;
                  return (
                    <Pressable
                      key={g.id}
                      onPress={() => handleSelectGradient(g.id)}
                      style={[s.paletteCircleWrap, isSelected && s.paletteCircleWrapActive]}
                    >
                      <LinearGradient colors={g.colors} style={s.paletteCircle}>
                        {isSelected && <Check size={14} color="#fff" strokeWidth={3} />}
                      </LinearGradient>
                      <Text style={[s.paletteName, isSelected && s.paletteNameActive]}>{g.name}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Central Content Area */}
          <View style={s.centralCanvas}>
            {!isImageSlide ? (
              <View style={[s.textCanvasCard, currentFont.isPill && s.textCanvasCardPill]}>
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
                  placeholder="اكتب حالتك أو استفسارك لأهل حيك هنا..."
                  placeholderTextColor="rgba(255,255,255,0.65)"
                  multiline
                  maxLength={300}
                  autoFocus
                />
              </View>
            ) : hasImage ? (
              <View style={s.imageCenterPlaceholder} />
            ) : (
              <View style={s.emptyPhotoCard}>
                <View style={s.emptyPhotoIconWrap}>
                  <UploadCloud size={34} color="#059669" />
                </View>
                <Text style={s.emptyPhotoTitle}>أضف صورة ليومياتك</Text>
                <Text style={s.emptyPhotoSub}>
                  شارك صور مشاريع، معالم الحي، أو نشاطاتك اليومية مع جيرانك
                </Text>

                <Text style={s.emptyPhotoSub}>استخدم زر المعرض أو الكاميرا في الشريط العلوي للمتابعة.</Text>
              </View>
            )}
          </View>

          {/* Quick Saudi Emojis Bar (Text Mode) */}
          {!isImageSlide && (
            <View style={s.emojiBarWrapper}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.emojiScroll}>
                {QUICK_EMOJIS.map((emoji) => (
                  <Pressable
                    key={emoji}
                    onPress={() => handleInsertEmoji(emoji)}
                    style={s.emojiBtn}
                  >
                    <Text style={s.emojiBtnText}>{emoji}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {showStoryOptions && (
            <ScrollView style={s.storyOptionsPanel} contentContainerStyle={s.storyOptionsContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
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
                  <Pressable key={value} onPress={() => handleAudienceChange(value)}
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
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.optionsChipRow}>
                        {audienceCandidates.map((person) => {
                          const selected = allowedUserIds.includes(person.id);
                          return (
                            <Pressable key={person.id}
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

              <Text style={s.optionsSectionTitle}>إضافة تفاعل</Text>
              <View style={s.optionsChipRow}>
                {([
                  ['none', 'بدون'],
                  ['poll', 'استطلاع'],
                  ['question', 'سؤال'],
                ] as const).map(([value, label]) => (
                  <Pressable key={value} onPress={() => setInteractiveType(value)}
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

              <Text style={s.optionsSectionTitle}>تنسيق النص</Text>
              <View style={s.optionsChipRow}>
                {STORY_TEXT_COLORS.map((color) => (
                  <Pressable key={color} onPress={() => setTextColor(color)}
                    style={[s.storyTextColorDot, { backgroundColor: color }, textColor === color && s.storyTextColorDotActive]} />
                ))}
                <Pressable style={s.optionsChip} onPress={() => setFontSize((n) => Math.max(16, n - 2))}>
                  <Text style={s.optionsChipText}>A−</Text>
                </Pressable>
                <Text style={s.optionsChipText}>{fontSize}</Text>
                <Pressable style={s.optionsChip} onPress={() => setFontSize((n) => Math.min(48, n + 2))}>
                  <Text style={s.optionsChipText}>A+</Text>
                </Pressable>
                <Pressable style={s.optionsChip} onPress={() => setTextRotation((n) => (n + 5) % 360)}>
                  <Text style={s.optionsChipText}>تدوير ↻</Text>
                </Pressable>
                <Pressable style={s.optionsChip} onPress={() => setTextRotation((n) => (n - 5 + 360) % 360)}>
                  <Text style={s.optionsChipText}>↺</Text>
                </Pressable>
              </View>
              <View style={s.optionsChipRow}>
                {([
                  ['↑', 0, -12], ['↓', 0, 12], ['←', -12, 0], ['→', 12, 0],
                ] as const).map(([label, dx, dy]) => (
                  <Pressable key={label} style={s.optionsChip}
                    onPress={() => setTextOffset((pos) => ({ x: Math.max(-140, Math.min(140, pos.x + dx)), y: Math.max(-260, Math.min(260, pos.y + dy)) }))}>
                    <Text style={s.optionsChipText}>{label}</Text>
                  </Pressable>
                ))}
                <Pressable style={s.optionsChip} onPress={() => { setTextRotation(0); setTextOffset({ x: 0, y: 0 }); }}>
                  <Text style={s.optionsChipText}>إعادة ضبط الموضع</Text>
                </Pressable>
              </View>
            </ScrollView>
          )}

          {/* Multi-slide carousel indicator strip */}
          {composer.slides.length > 1 && (
            <View style={s.slideIndicatorStrip}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.thumbsScroll}>
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
                        <Text style={s.thumbTextLetter}>{sItem.content?.[0] || '✏️'}</Text>
                      </View>
                    )}
                    {idx === composer.activeIdx && composer.slides.length > 1 && (
                      <Pressable
                        style={s.thumbDeleteBadge}
                        onPress={() => composer.removeSlide(idx)}
                        hitSlop={6}
                      >
                        <Trash2 size={10} color="#fff" />
                      </Pressable>
                    )}
                  </Pressable>
                ))}
                {!composer.atCapacity && (
                  <Pressable
                    style={s.thumbAddBtn}
                    onPress={isImageSlide ? handlePickImages : composer.addTextSlide}
                  >
                    <Plus size={16} color="#fff" />
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
                  placeholder="إضافة شرح وتفاصيل... 💬"
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
              disabled={!composer.isReady || publisher.publishing}
              accessibilityRole="button"
              accessibilityLabel="نشر الحالة"
            >
              <LinearGradient
                colors={composer.isReady ? ['#059669', '#10b981'] : ['#475569', '#334155']}
                style={s.whatsAppSendFabGrad}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                {publisher.publishing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Send size={22} color="#fff" />
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
            <ActivityIndicator size="large" color="#059669" />
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
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeSwitcherPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 24,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  modeOption: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  modeOptionActive: {
    backgroundColor: '#059669',
  },
  modeOptionText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontWeight: '700',
  },
  modeOptionTextActive: {
    color: '#fff',
    fontWeight: '900',
  },
  topToolsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  toolIconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  toolIconBtnActive: {
    backgroundColor: '#059669',
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
    color: '#d1fae5',
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
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
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
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  paletteName: {
    color: '#94a3b8',
    fontSize: 9.5,
    fontWeight: '700',
  },
  paletteNameActive: {
    color: '#34d399',
    fontWeight: '900',
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
    color: '#fff',
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
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyPhotoTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 6,
  },
  emptyPhotoSub: {
    color: '#94a3b8',
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  emptyPhotoActionsRow: {
    flexDirection: 'row-reverse',
    gap: 10,
    width: '100%',
  },
  emptyPhotoBtnPrimary: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 14,
  },
  emptyPhotoBtnPrimaryText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  emptyPhotoBtnSecondary: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fff',
    paddingVertical: 12,
    borderRadius: 14,
  },
  emptyPhotoBtnSecondaryText: {
    color: '#059669',
    fontSize: 13,
    fontWeight: '800',
  },
  emojiBarWrapper: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingVertical: 6,
  },
  emojiScroll: {
    flexDirection: 'row-reverse',
    paddingHorizontal: 16,
    gap: 10,
    alignItems: 'center',
  },
  emojiBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiBtnText: {
    fontSize: 18,
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
    borderColor: '#059669',
    transform: [{ scale: 1.08 }],
  },
  thumbImg: {
    width: '100%',
    height: '100%',
  },
  thumbTextPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbTextLetter: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  thumbDeleteBadge: {
    position: 'absolute',
    top: 2,
    left: 2,
    backgroundColor: '#dc2626',
    borderRadius: 7,
    padding: 2,
  },
  thumbAddBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#fff',
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
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  whatsAppCaptionInput: {
    color: '#fff',
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
    borderRadius: 26,
    overflow: 'hidden',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
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
    maxHeight: 190,
    marginHorizontal: 12,
    marginVertical: 4,
    padding: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(15,23,42,0.94)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  storyOptionsContent: { padding: 10, gap: 7 },
  optionsSectionHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  optionsSectionTitle: { color: '#fff', fontSize: 11, fontWeight: '900', textAlign: 'right' },
  optionsChipRow: { flexDirection: 'row-reverse', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
  optionsChip: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10, backgroundColor: '#334155', flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  optionsChipActive: { backgroundColor: '#065f46', borderWidth: 1, borderColor: '#34d399' },
  optionsChipText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  optionsHint: { color: '#cbd5e1', fontSize: 10, textAlign: 'right' },
  audiencePicker: { maxHeight: 42 },
  personChip: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10, backgroundColor: '#334155', flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  optionsFields: { gap: 5 },
  optionsInput: { minHeight: 32, color: '#fff', backgroundColor: 'rgba(255,255,255,0.08)', borderColor: 'rgba(255,255,255,0.2)', borderWidth: 1, borderRadius: 9, paddingHorizontal: 9, paddingVertical: 5, fontSize: 12, textAlign: 'right' },
  storyTextColorDot: { width: 19, height: 19, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)' },
  storyTextColorDotActive: { borderWidth: 3, borderColor: '#34d399' },
  publishProgressTrack: { height: 5, width: '100%', backgroundColor: '#e2e8f0', borderRadius: 5, overflow: 'hidden', marginTop: 4 },
  publishProgressFill: { height: '100%', backgroundColor: '#059669', borderRadius: 5 },
  publishingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  publishingModal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    width: 260,
  },
  publishingTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'center',
  },
  publishingStatus: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
});
