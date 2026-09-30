import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Dimensions,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import {
  X,
  Type,
  Image as ImageIcon,
  Check,
  Camera,
  UploadCloud,
  Plus,
  Trash2,
  Sparkles,
  Layers,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react-native';

const { width, height } = Dimensions.get('window');

const BG_GRADIENTS = [
  { id: 1, colors: ['#0891b2', '#0369a1'] as [string, string], name: 'سماء' },
  { id: 2, colors: ['#7c3aed', '#4f46e5'] as [string, string], name: 'بنفسجي' },
  { id: 3, colors: ['#dc2626', '#ea580c'] as [string, string], name: 'غروب' },
  { id: 4, colors: ['#059669', '#0891b2'] as [string, string], name: 'طبيعة' },
  { id: 5, colors: ['#d97706', '#dc2626'] as [string, string], name: 'ذهبي' },
  { id: 6, colors: ['#1e293b', '#334155'] as [string, string], name: 'ليلي' },
  { id: 7, colors: ['#be185d', '#7c3aed'] as [string, string], name: 'وردي' },
  { id: 8, colors: ['#065f46', '#047857'] as [string, string], name: 'أخضر' },
];

export interface StorySlide {
  id: string;
  type: 'image' | 'text';
  content: string; // text body or image caption
  imageUri?: string | null;
  imageBase64?: string | null;
  bgGradId: number;
}

export default function CreateStory() {
  const [slides, setSlides] = useState<StorySlide[]>([
    {
      id: `slide_${Date.now()}`,
      type: 'text',
      content: '',
      bgGradId: 1,
    },
  ]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');

  const currentSlide = slides[activeIdx] || slides[0];

  // Helper to update current slide
  function updateCurrentSlide(patch: Partial<StorySlide>) {
    setSlides(prev =>
      prev.map((s, idx) => (idx === activeIdx ? { ...s, ...patch } : s))
    );
  }

  // Pick one or multiple images from device
  async function pickImagesFromDevice() {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: 10,
        quality: 0.85,
        base64: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const newImageSlides: StorySlide[] = res.assets.map((asset, i) => ({
          id: `img_${Date.now()}_${i}`,
          type: 'image',
          content: '',
          imageUri: asset.uri,
          imageBase64: asset.base64 || null,
          bgGradId: 1,
        }));

        setSlides(prev => {
          // If the only existing slide is an empty text or image slide, replace it
          const isInitialEmpty =
            prev.length === 1 &&
            ((prev[0].type === 'text' && !prev[0].content.trim()) ||
             (prev[0].type === 'image' && !prev[0].imageUri));

          if (isInitialEmpty) {
            return newImageSlides;
          }
          return [...prev, ...newImageSlides];
        });

        // Focus first new slide
        setActiveIdx(prev => {
          const isInitialEmpty =
            slides.length === 1 &&
            ((slides[0].type === 'text' && !slides[0].content.trim()) ||
             (slides[0].type === 'image' && !slides[0].imageUri));
          return isInitialEmpty ? 0 : slides.length;
        });
      }
    } catch (err: any) {
      Alert.alert('خطأ', 'تعذر فتح ألبوم الصور: ' + (err.message || ''));
    }
  }

  // Capture single photo using camera
  async function takePhotoWithCamera() {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        return Alert.alert('إذن الكاميرا', 'يرجى السماح للتطبيق باستخدام الكاميرا لالتقاط صورة للقصة.');
      }

      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [9, 16],
        quality: 0.85,
        base64: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const asset = res.assets[0];
        const newSlide: StorySlide = {
          id: `cam_${Date.now()}`,
          type: 'image',
          content: '',
          imageUri: asset.uri,
          imageBase64: asset.base64 || null,
          bgGradId: 1,
        };

        setSlides(prev => {
          const isInitialEmpty =
            prev.length === 1 &&
            ((prev[0].type === 'text' && !prev[0].content.trim()) ||
             (prev[0].type === 'image' && !prev[0].imageUri));
          if (isInitialEmpty) return [newSlide];
          return [...prev, newSlide];
        });
      }
    } catch (err: any) {
      Alert.alert('خطأ', 'تعذر فتح الكاميرا: ' + (err.message || ''));
    }
  }

  // Add a new empty text status slide
  function addTextSlide() {
    const nextGradId = ((slides.length) % BG_GRADIENTS.length) + 1;
    const newSlide: StorySlide = {
      id: `text_${Date.now()}`,
      type: 'text',
      content: '',
      bgGradId: nextGradId,
    };
    setSlides(prev => [...prev, newSlide]);
    setActiveIdx(slides.length);
  }

  // Remove a slide
  function removeSlide(idxToRemove: number) {
    if (slides.length <= 1) {
      // Reset the only slide to empty text
      setSlides([
        {
          id: `slide_${Date.now()}`,
          type: 'text',
          content: '',
          bgGradId: 1,
        },
      ]);
      setActiveIdx(0);
      return;
    }

    setSlides(prev => prev.filter((_, idx) => idx !== idxToRemove));
    if (activeIdx >= idxToRemove && activeIdx > 0) {
      setActiveIdx(activeIdx - 1);
    }
  }

  // Validate if all slides are ready
  const validSlides = slides.filter(s =>
    s.type === 'text' ? s.content.trim().length > 0 : !!s.imageUri
  );
  const isReady = validSlides.length > 0;

  // Publish all slides to Supabase
  async function publish() {
    if (validSlides.length === 0) {
      return Alert.alert('تنبيه', 'يرجى كتابة نص أو اختيار صورة واحدة على الأقل لنشرها في القصة.');
    }

    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setLoading(false);
      return router.replace('/auth');
    }

    const userId = u.user.id;
    let publishedCount = 0;

    for (let i = 0; i < validSlides.length; i++) {
      const slide = validSlides[i];
      setUploadStatus(`جاري نشر الشريحة (${i + 1} من ${validSlides.length})...`);

      let finalImageUrl: string | null = null;

      if (slide.type === 'image' && slide.imageUri) {
        try {
          const response = await fetch(slide.imageUri);
          const blob = await response.arrayBuffer();
          const path = `${userId}/${Date.now()}_${i}.jpg`;

          // 1. Try 'stories' bucket
          const { error: storyErr } = await supabase.storage
            .from('stories')
            .upload(path, blob, { contentType: 'image/jpeg', upsert: true });

          if (!storyErr) {
            const { data: pubData } = supabase.storage.from('stories').getPublicUrl(path);
            finalImageUrl = pubData.publicUrl;
          } else {
            // 2. Fallback to 'avatars' bucket
            const { error: avatarErr } = await supabase.storage
              .from('avatars')
              .upload(`story_${path}`, blob, { contentType: 'image/jpeg', upsert: true });

            if (!avatarErr) {
              const { data: avData } = supabase.storage.from('avatars').getPublicUrl(`story_${path}`);
              finalImageUrl = avData.publicUrl;
            } else if (slide.imageBase64) {
              // 3. Base64 data URI fallback
              finalImageUrl = `data:image/jpeg;base64,${slide.imageBase64}`;
            } else {
              finalImageUrl = slide.imageUri;
            }
          }
        } catch (uploadError) {
          if (slide.imageBase64) {
            finalImageUrl = `data:image/jpeg;base64,${slide.imageBase64}`;
          } else {
            finalImageUrl = slide.imageUri;
          }
        }
      }

      const grad = BG_GRADIENTS.find(g => g.id === slide.bgGradId) || BG_GRADIENTS[0];

      const payload: any = {
        author_id: userId,
        type: slide.type,
        bg_color: grad.colors[0],
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        content: slide.content.trim() || (slide.type === 'text' ? 'حالة' : null),
        image_url: finalImageUrl,
      };

      const { error: insertErr } = await supabase.from('stories').insert(payload);
      if (insertErr) {
        console.error('Failed to insert story item:', insertErr.message);
      } else {
        publishedCount++;
      }
    }

    setLoading(false);
    setUploadStatus('');

    if (publishedCount > 0) {
      Alert.alert(
        'تم النشر بنجاح! 🎉',
        `تم نشر ${publishedCount} ${publishedCount === 1 ? 'قصة' : 'قصص'} في يوميات الحي وتختفي بعد 24 ساعة.`,
        [{ text: 'رائع', onPress: () => router.replace('/home') }]
      );
    } else {
      Alert.alert('خطأ', 'تعذر نشر القصص، يرجى المحاولة مرة أخرى.');
    }
  }

  const activeGrad = BG_GRADIENTS.find(g => g.id === currentSlide.bgGradId) || BG_GRADIENTS[0];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container}>
        {/* Story Live Preview Screen */}
        <LinearGradient
          colors={currentSlide.type === 'image' && currentSlide.imageUri ? ['#0f172a', '#1e293b'] : activeGrad.colors}
          style={styles.preview}
        >
          {/* If Image mode with image */}
          {currentSlide.type === 'image' && currentSlide.imageUri ? (
            <Image source={{ uri: currentSlide.imageUri }} style={styles.previewActualImage} resizeMode="cover" />
          ) : null}

          {/* Top Floating Header & Nav */}
          <View style={styles.toolbar}>
            <Pressable onPress={() => router.back()} style={styles.toolBtn}>
              <X size={22} color="#fff" />
            </Pressable>

            {/* Slide Index Badge */}
            <View style={styles.slideCounterBadge}>
              <Layers size={14} color="#0891b2" />
              <Text style={styles.slideCounterText}>
                شريحة {activeIdx + 1} من {slides.length}
              </Text>
            </View>

            {/* Publish Action Button */}
            <Pressable
              style={[styles.publishBtn, !isReady && styles.publishBtnDisabled]}
              onPress={publish}
              disabled={!isReady || loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <View style={styles.publishBtnInner}>
                  <Check size={18} color="#fff" />
                  <Text style={styles.publishBtnLabel}>نشر</Text>
                </View>
              )}
            </Pressable>
          </View>

          {/* Center Canvas */}
          <View style={styles.previewContent}>
            {currentSlide.type === 'text' ? (
              <TextInput
                style={styles.textInput}
                value={currentSlide.content}
                onChangeText={txt => updateCurrentSlide({ content: txt })}
                placeholder="اكتب حالتك أو فكرتك هنا..."
                placeholderTextColor="rgba(255,255,255,0.65)"
                multiline
                textAlign="center"
                maxLength={300}
                autoFocus={slides.length === 1 && !currentSlide.content}
              />
            ) : currentSlide.imageUri ? (
              <View style={styles.imageOverlayContainer}>
                {currentSlide.content ? (
                  <View style={styles.captionBubble}>
                    <Text style={styles.imageCaption}>{currentSlide.content}</Text>
                  </View>
                ) : null}
              </View>
            ) : (
              /* No Image picked for this slide yet */
              <View style={styles.pickPromptCard}>
                <View style={styles.promptIconCircle}>
                  <UploadCloud size={32} color="#0891b2" />
                </View>
                <Text style={styles.promptTitle}>اختر صورة لهذه الشريحة</Text>
                <Text style={styles.promptSub}>
                  يمكنك رفع صور متعددة دفعة واحدة من جهازك
                </Text>

                <Pressable style={styles.pickButton} onPress={pickImagesFromDevice}>
                  <ImageIcon size={18} color="#fff" />
                  <Text style={styles.pickButtonText}>معرض الصور / ملفات الجهاز 🖼️</Text>
                </Pressable>

                <Pressable style={styles.cameraButton} onPress={takePhotoWithCamera}>
                  <Camera size={18} color="#0891b2" />
                  <Text style={styles.cameraButtonText}>التقاط بالكاميرا 📷</Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* Slide Progress Dots on Top */}
          <View style={styles.multiProgressRow}>
            {slides.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.multiProgressSegment,
                  i === activeIdx && styles.multiProgressSegmentActive,
                ]}
              />
            ))}
          </View>
        </LinearGradient>

        {/* ======================================================== */}
        {/* SLIDES THUMBNAIL CAROUSEL BAR                            */}
        {/* ======================================================== */}
        <View style={styles.carouselContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.carouselScroll}
          >
            {/* Add More Photos / Text Slide Action Buttons */}
            <Pressable style={styles.carouselAddBtn} onPress={pickImagesFromDevice}>
              <ImageIcon size={18} color="#0891b2" />
              <Text style={styles.carouselAddText}>+ صور</Text>
            </Pressable>

            <Pressable style={styles.carouselAddBtn} onPress={addTextSlide}>
              <Type size={18} color="#0891b2" />
              <Text style={styles.carouselAddText}>+ نص</Text>
            </Pressable>

            {/* List of current slides */}
            {slides.map((slide, idx) => {
              const isActive = idx === activeIdx;
              const grad = BG_GRADIENTS.find(g => g.id === slide.bgGradId) || BG_GRADIENTS[0];

              return (
                <Pressable
                  key={slide.id}
                  style={[styles.thumbCard, isActive && styles.thumbCardActive]}
                  onPress={() => setActiveIdx(idx)}
                >
                  {slide.type === 'image' && slide.imageUri ? (
                    <Image source={{ uri: slide.imageUri }} style={styles.thumbImage} />
                  ) : (
                    <LinearGradient colors={grad.colors} style={styles.thumbGradient}>
                      <Text style={styles.thumbTextPreview} numberOfLines={2}>
                        {slide.content || '✍️ نص'}
                      </Text>
                    </LinearGradient>
                  )}

                  {/* Slide number pill */}
                  <View style={styles.thumbNumberBadge}>
                    <Text style={styles.thumbNumberText}>{idx + 1}</Text>
                  </View>

                  {/* Delete button (if more than 1 slide or non-empty) */}
                  <Pressable
                    style={styles.thumbDeleteBtn}
                    onPress={e => {
                      e.stopPropagation();
                      removeSlide(idx);
                    }}
                  >
                    <Trash2 size={11} color="#fff" />
                  </Pressable>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* ======================================================== */}
        {/* BOTTOM CONTROLS & EDITING                                */}
        {/* ======================================================== */}
        <ScrollView style={styles.controls} showsVerticalScrollIndicator={false}>
          {/* Mode Switcher for Current Slide */}
          <View style={styles.modeRow}>
            <Text style={styles.sectionHeader}>نوع الشريحة الحالية:</Text>
            <View style={styles.modeToggleGroup}>
              <Pressable
                style={[styles.modeToggleItem, currentSlide.type === 'text' && styles.modeToggleItemActive]}
                onPress={() => updateCurrentSlide({ type: 'text' })}
              >
                <Type size={15} color={currentSlide.type === 'text' ? '#0891b2' : '#9ca3af'} />
                <Text style={[styles.modeToggleText, currentSlide.type === 'text' && styles.modeToggleTextActive]}>
                  حالة نصية
                </Text>
              </Pressable>

              <Pressable
                style={[styles.modeToggleItem, currentSlide.type === 'image' && styles.modeToggleItemActive]}
                onPress={() => {
                  updateCurrentSlide({ type: 'image' });
                  if (!currentSlide.imageUri) pickImagesFromDevice();
                }}
              >
                <ImageIcon size={15} color={currentSlide.type === 'image' ? '#0891b2' : '#9ca3af'} />
                <Text style={[styles.modeToggleText, currentSlide.type === 'image' && styles.modeToggleTextActive]}>
                  صورة
                </Text>
              </Pressable>
            </View>
          </View>

          {/* If Image slide: caption & replace actions */}
          {currentSlide.type === 'image' && (
            <View style={styles.slideOptionBox}>
              {currentSlide.imageUri ? (
                <>
                  <View style={styles.captionInputContainer}>
                    <TextInput
                      style={styles.captionInput}
                      value={currentSlide.content}
                      onChangeText={txt => updateCurrentSlide({ content: txt })}
                      placeholder="أضف تعليقاً على هذه الصورة (اختياري)..."
                      placeholderTextColor="#9ca3af"
                      maxLength={150}
                    />
                  </View>

                  <View style={styles.imageActionsRow}>
                    <Pressable style={styles.actionPillBtn} onPress={pickImagesFromDevice}>
                      <UploadCloud size={15} color="#38bdf8" />
                      <Text style={styles.actionPillText}>تغيير / إضافة صور</Text>
                    </Pressable>

                    <Pressable style={styles.actionPillBtn} onPress={takePhotoWithCamera}>
                      <Camera size={15} color="#38bdf8" />
                      <Text style={styles.actionPillText}>التقاط بالكاميرا</Text>
                    </Pressable>
                  </View>
                </>
              ) : null}
            </View>
          )}

          {/* If Text slide: gradient background selector */}
          {currentSlide.type === 'text' && (
            <View style={styles.slideOptionBox}>
              <Text style={styles.bgLabel}>لون خلفية الحالة النصية:</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.gradsScroll}
              >
                {BG_GRADIENTS.map(g => (
                  <Pressable
                    key={g.id}
                    onPress={() => updateCurrentSlide({ bgGradId: g.id })}
                    style={styles.gradOption}
                  >
                    <LinearGradient
                      colors={g.colors}
                      style={[
                        styles.gradPreview,
                        currentSlide.bgGradId === g.id && styles.gradPreviewSelected,
                      ]}
                    />
                    <Text style={styles.gradName}>{g.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Navigation between slides */}
          {slides.length > 1 && (
            <View style={styles.slideNavRow}>
              <Pressable
                style={[styles.navArrowBtn, activeIdx === 0 && styles.navArrowBtnDisabled]}
                onPress={() => setActiveIdx(prev => Math.max(0, prev - 1))}
                disabled={activeIdx === 0}
              >
                <ChevronRight size={20} color={activeIdx === 0 ? '#4b5563' : '#fff'} />
                <Text style={[styles.navArrowText, activeIdx === 0 && { color: '#4b5563' }]}>السابقة</Text>
              </Pressable>

              <Text style={styles.slideCounterCenter}>
                {activeIdx + 1} / {slides.length}
              </Text>

              <Pressable
                style={[styles.navArrowBtn, activeIdx === slides.length - 1 && styles.navArrowBtnDisabled]}
                onPress={() => setActiveIdx(prev => Math.min(slides.length - 1, prev + 1))}
                disabled={activeIdx === slides.length - 1}
              >
                <Text style={[styles.navArrowText, activeIdx === slides.length - 1 && { color: '#4b5563' }]}>التالية</Text>
                <ChevronLeft size={20} color={activeIdx === slides.length - 1 ? '#4b5563' : '#fff'} />
              </Pressable>
            </View>
          )}

          {/* Info pill */}
          <View style={styles.infoBanner}>
            <Sparkles size={16} color="#0891b2" />
            <Text style={styles.infoBannerText}>
              يمكنك نشر عدة صور وحالات نصية معاً في يوميات الحي لتظهر لأهل حيك لمدة 24 ساعة.
            </Text>
          </View>

          {/* Big Publish Button */}
          <Pressable
            style={[styles.publishFullBtn, (!isReady || loading) && styles.publishFullBtnDisabled]}
            onPress={publish}
            disabled={!isReady || loading}
          >
            {loading ? (
              <View style={styles.uploadingContainer}>
                <ActivityIndicator size="small" color="#fff" />
                <Text style={styles.uploadingText}>{uploadStatus || 'جاري النشر...'}</Text>
              </View>
            ) : (
              <Text style={styles.publishFullBtnText}>
                نشر {validSlides.length > 1 ? `${validSlides.length} شرائح` : 'القصة'} الآن ✨
              </Text>
            )}
          </Pressable>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1d',
  },
  preview: {
    height: height * 0.46,
    position: 'relative',
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  previewActualImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  toolbar: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
    paddingHorizontal: 16,
    zIndex: 10,
  },
  toolBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  slideCounterBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  slideCounterText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  publishBtn: {
    backgroundColor: '#0891b2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  publishBtnInner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
  },
  publishBtnLabel: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  publishBtnDisabled: {
    opacity: 0.5,
  },
  previewContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  textInput: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    width: '100%',
    lineHeight: 38,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  imageOverlayContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    width: '100%',
    paddingBottom: 16,
  },
  captionBubble: {
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignSelf: 'center',
    maxWidth: '90%',
  },
  imageCaption: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
  },
  pickPromptCard: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    width: '88%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 14,
    elevation: 8,
  },
  promptIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#ecfeff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  promptTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 4,
  },
  promptSub: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 16,
  },
  pickButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#0891b2',
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  pickButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  cameraButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f0fdfa',
    borderWidth: 1.5,
    borderColor: '#99f6e4',
    width: '100%',
    paddingVertical: 11,
    borderRadius: 12,
  },
  cameraButtonText: {
    color: '#0891b2',
    fontSize: 13,
    fontWeight: '800',
  },
  multiProgressRow: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 16,
    marginBottom: 10,
    zIndex: 10,
  },
  multiProgressSegment: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
  },
  multiProgressSegmentActive: {
    backgroundColor: '#fff',
  },

  // Carousel Thumbnails
  carouselContainer: {
    backgroundColor: '#111827',
    borderBottomWidth: 1,
    borderColor: '#1f2937',
    paddingVertical: 12,
  },
  carouselScroll: {
    paddingHorizontal: 16,
    flexDirection: 'row-reverse',
    gap: 10,
    alignItems: 'center',
  },
  carouselAddBtn: {
    width: 68,
    height: 84,
    borderRadius: 14,
    backgroundColor: '#1e293b',
    borderWidth: 1.5,
    borderColor: '#334155',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  carouselAddText: {
    color: '#38bdf8',
    fontSize: 11,
    fontWeight: '800',
  },
  thumbCard: {
    width: 64,
    height: 84,
    borderRadius: 14,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: '#1f2937',
  },
  thumbCardActive: {
    borderColor: '#0891b2',
    transform: [{ scale: 1.05 }],
  },
  thumbImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  thumbGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  thumbTextPreview: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '800',
    textAlign: 'center',
  },
  thumbNumberBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbNumberText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },
  thumbDeleteBtn: {
    position: 'absolute',
    top: 4,
    left: 4,
    backgroundColor: 'rgba(239,68,68,0.85)',
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Controls Section
  controls: {
    flex: 1,
    backgroundColor: '#0a0f1d',
    padding: 16,
  },
  modeRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  sectionHeader: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
  },
  modeToggleGroup: {
    flexDirection: 'row-reverse',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 3,
    gap: 4,
  },
  modeToggleItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9,
  },
  modeToggleItemActive: {
    backgroundColor: '#0f172a',
  },
  modeToggleText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  modeToggleTextActive: {
    color: '#0891b2',
    fontWeight: '800',
  },
  slideOptionBox: {
    marginBottom: 14,
  },
  captionInputContainer: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  captionInput: {
    color: '#fff',
    height: 44,
    fontSize: 13,
    textAlign: 'right',
  },
  imageActionsRow: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  actionPillBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingVertical: 9,
  },
  actionPillText: {
    color: '#38bdf8',
    fontSize: 12,
    fontWeight: '700',
  },
  bgLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
    marginBottom: 8,
  },
  gradsScroll: {
    flexDirection: 'row-reverse',
    gap: 10,
    paddingBottom: 4,
  },
  gradOption: { alignItems: 'center' },
  gradPreview: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2.5,
    borderColor: 'transparent',
  },
  gradPreviewSelected: {
    borderColor: '#fff',
    transform: [{ scale: 1.1 }],
  },
  gradName: { color: '#64748b', fontSize: 10, marginTop: 4, fontWeight: '700' },
  slideNavRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
  },
  navArrowBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  navArrowBtnDisabled: {
    opacity: 0.4,
  },
  navArrowText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  slideCounterCenter: {
    color: '#38bdf8',
    fontSize: 13,
    fontWeight: '900',
  },
  infoBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(8,145,178,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(8,145,178,0.3)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  infoBannerText: {
    flex: 1,
    color: '#67e8f9',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
    lineHeight: 18,
  },
  publishFullBtn: {
    backgroundColor: '#0891b2',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    shadowColor: '#0891b2',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  publishFullBtnDisabled: {
    backgroundColor: '#334155',
    shadowOpacity: 0,
    elevation: 0,
  },
  publishFullBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
  uploadingContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  uploadingText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
  },
});
