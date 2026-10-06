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
  Sparkles,
  Layers,
  UploadCloud,
} from 'lucide-react-native';
import { useStoryComposer } from '@/hooks/useStoryComposer';
import { useStoryPublisher } from '@/hooks/useStoryPublisher';
import { BG_GRADIENTS, getGradient } from '@/lib/storyGradients';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const WHATSAPP_FONTS = [
  { id: 'normal', name: 'عادي', fontWeight: '600' as const, fontStyle: 'normal' as const },
  { id: 'bold', name: 'عريض', fontWeight: '900' as const, fontStyle: 'normal' as const },
  { id: 'italic', name: 'مائل', fontWeight: '700' as const, fontStyle: 'italic' as const },
];

export default function CreateStory() {
  const composer = useStoryComposer();
  const publisher = useStoryPublisher();
  const { activeSlide } = composer;

  const [fontIndex, setFontIndex] = useState(1); // default bold

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

  // WhatsApp-style Color Palette cycler
  const handleCycleColor = useCallback(() => {
    if (!activeSlide) return;
    const currentId = activeSlide.bgGradId || 1;
    const nextId = (currentId % BG_GRADIENTS.length) + 1;
    composer.patchActiveSlide({ bgGradId: nextId });
  }, [activeSlide, composer]);

  // WhatsApp-style Font styler
  const handleCycleFont = useCallback(() => {
    setFontIndex((prev) => (prev + 1) % WHATSAPP_FONTS.length);
  }, []);

  const handlePublish = useCallback(async () => {
    if (!composer.isReady) {
      return Alert.alert(
        'تنبيه',
        'يرجى كتابة نص أو اختيار صورة واحدة على الأقل لنشرها في القصة.',
      );
    }

    const outcome = await publisher.publish(composer.slides);

    if (outcome.unauthenticated) {
      publisher.reset();
      return router.replace('/auth');
    }

    if (outcome.publishedCount === 0) {
      publisher.reset();
      return Alert.alert('خطأ', outcome.failures[0] ?? 'تعذر نشر القصص، يرجى المحاولة مرة أخرى.');
    }

    const noun = outcome.publishedCount === 1 ? 'قصة' : 'قصص';
    const body =
      outcome.failures.length > 0
        ? `تم نشر ${outcome.publishedCount} ${noun} من ${outcome.requestedCount}. تعذر نشر: ${outcome.failures.join('، ')}`
        : `تم نشر ${outcome.publishedCount} ${noun} في يوميات الحي وتختفي بعد 24 ساعة.`;

    Alert.alert('تم النشر بنجاح! 🎉', body, [
      { text: 'رائع', onPress: () => router.replace('/home') },
    ]);
  }, [composer, publisher]);

  if (!activeSlide) return null;

  const currentGradient = getGradient(activeSlide.bgGradId).colors;
  const currentFont = WHATSAPP_FONTS[fontIndex];
  const isImageSlide = activeSlide.type === 'image';
  const hasImage = isImageSlide && Boolean(activeSlide.imageUri);
  const textLength = activeSlide.content?.length || 0;
  // WhatsApp adaptive font size based on text length
  const adaptiveFontSize = textLength > 120 ? 20 : textLength > 60 ? 24 : 30;

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Immersive WhatsApp Status Canvas */}
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
              <X size={22} color="#fff" />
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

            {/* WhatsApp Tool Icons */}
            <View style={s.topToolsRow}>
              {!isImageSlide ? (
                <>
                  <Pressable
                    onPress={handleCycleColor}
                    style={s.toolIconBtn}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="تغيير لون الخلفية"
                  >
                    <Palette size={20} color="#fff" />
                  </Pressable>
                  <Pressable
                    onPress={handleCycleFont}
                    style={s.toolIconBtn}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="تغيير نمط الخط"
                  >
                    <Type size={20} color="#fff" />
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
                    <ImageIcon size={20} color="#fff" />
                  </Pressable>
                  <Pressable
                    onPress={handleTakePhoto}
                    style={s.toolIconBtn}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="التقاط بالكاميرا"
                  >
                    <Camera size={20} color="#fff" />
                  </Pressable>
                </>
              )}
            </View>
          </View>

          {/* 24H Badge Notice */}
          <View style={s.badge24h}>
            <Clock size={11} color="#d1fae5" />
            <Text style={s.badge24hText}>تختفي تلقائياً بعد 24 ساعة في الحي</Text>
          </View>

          {/* Central Content Area */}
          <View style={s.centralCanvas}>
            {!isImageSlide ? (
              <TextInput
                style={[
                  s.whatsAppTextInput,
                  {
                    fontSize: adaptiveFontSize,
                    fontWeight: currentFont.fontWeight,
                    fontStyle: currentFont.fontStyle,
                  },
                ]}
                value={activeSlide.content}
                onChangeText={(text) => composer.patchActiveSlide({ content: text })}
                placeholder="اكتب حالتك في الحي هنا..."
                placeholderTextColor="rgba(255,255,255,0.6)"
                multiline
                textAlign="center"
                maxLength={300}
                autoFocus
              />
            ) : hasImage ? (
              <View style={s.imageCenterPlaceholder} />
            ) : (
              <View style={s.emptyPhotoCard}>
                <View style={s.emptyPhotoIconWrap}>
                  <UploadCloud size={36} color="#059669" />
                </View>
                <Text style={s.emptyPhotoTitle}>أضف صورة ليومياتك</Text>
                <Text style={s.emptyPhotoSub}>
                  شارك صور مشاريع، معالم الحي، أو نشاطاتك مع جيرانك
                </Text>

                <View style={s.emptyPhotoActionsRow}>
                  <Pressable style={s.emptyPhotoBtnPrimary} onPress={handlePickImages}>
                    <ImageIcon size={18} color="#fff" />
                    <Text style={s.emptyPhotoBtnPrimaryText}>معرض الصور</Text>
                  </Pressable>
                  <Pressable style={s.emptyPhotoBtnSecondary} onPress={handleTakePhoto}>
                    <Camera size={18} color="#059669" />
                    <Text style={s.emptyPhotoBtnSecondaryText}>الكاميرا</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </View>

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
                  style={s.whatsAppCaptionInput}
                  value={activeSlide.content}
                  onChangeText={(text) => composer.patchActiveSlide({ content: text })}
                  placeholder="إضافة شرح... 💬"
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

            {/* WhatsApp Iconic Green Circular Send Button */}
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
                colors={composer.isReady ? ['#059669', '#10b981'] : ['#64748b', '#475569']}
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeSwitcherPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 24,
    padding: 3,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
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
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  badge24h: {
    alignSelf: 'center',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginTop: 8,
  },
  badge24hText: {
    color: '#d1fae5',
    fontSize: 11,
    fontWeight: '700',
  },
  centralCanvas: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  whatsAppTextInput: {
    color: '#fff',
    textAlign: 'center',
    lineHeight: 38,
    width: '100%',
    paddingHorizontal: 16,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  imageCenterPlaceholder: {
    flex: 1,
  },
  emptyPhotoCard: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
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
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  whatsAppCaptionInput: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'right',
  },
  charCounterWrap: {
    backgroundColor: 'rgba(0,0,0,0.35)',
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
});
