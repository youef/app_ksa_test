import { useCallback } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { StoryCarousel } from '@/components/story/StoryCarousel';
import { StoryControls } from '@/components/story/StoryControls';
import { StoryPreview } from '@/components/story/StoryPreview';
import { useStoryComposer } from '@/hooks/useStoryComposer';
import { useStoryPublisher } from '@/hooks/useStoryPublisher';
import { getGradient } from '@/lib/storyGradients';
import { SC } from '@/components/story/theme';

export default function CreateStory() {
  const composer = useStoryComposer();
  const publisher = useStoryPublisher();
  const { height: windowHeight } = useWindowDimensions();

  const { activeSlide } = composer;

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

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.previewWrap, { height: Math.max(280, windowHeight * 0.46) }]}>
        <StoryPreview
          slideType={activeSlide.type}
          content={activeSlide.content}
          imageUri={activeSlide.imageUri ?? null}
          autoFocus={composer.slides.length === 1 && !activeSlide.content}
          activeIdx={composer.activeIdx}
          slideCount={composer.slides.length}
          gradientColors={getGradient(activeSlide.bgGradId).colors}
          isReady={composer.isReady}
          publishing={publisher.publishing}
          status={publisher.status}
          onChangeContent={(text) => composer.patchActiveSlide({ content: text })}
          onClose={() => router.back()}
          onPublish={handlePublish}
          onPickImages={handlePickImages}
          onTakePhoto={handleTakePhoto}
        />
      </View>

      <StoryCarousel
        slides={composer.slides}
        activeIdx={composer.activeIdx}
        atCapacity={composer.atCapacity}
        onSelect={composer.selectSlide}
        onRemove={composer.removeSlide}
        onAddImages={handlePickImages}
        onAddText={composer.addTextSlide}
      />

      <StoryControls
        slide={activeSlide}
        activeIdx={composer.activeIdx}
        slideCount={composer.slides.length}
        validCount={composer.validCount}
        publishing={publisher.publishing}
        status={publisher.status}
        onChangeContent={(text) => composer.patchActiveSlide({ content: text })}
        onChangeType={composer.setActiveSlideType}
        onChangeGradient={(id) => composer.patchActiveSlide({ bgGradId: id })}
        onPickImages={handlePickImages}
        onTakePhoto={handleTakePhoto}
        onStep={composer.stepSlide}
        onPublish={handlePublish}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: SC.bg },
  previewWrap: { width: '100%' },
});
