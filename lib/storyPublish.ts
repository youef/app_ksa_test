import { supabase } from './supabase';
import { getGradient } from './storyGradients';
import { selectPublishableSlides } from './storySlides';
import { STORY_LIMITS, type StoryInsertPayload, type StorySlide } from './storyTypes';
import { uploadStoryImage } from './storyUpload';

function buildPayload(
  slide: StorySlide,
  authorId: string,
  imageUrl: string | null,
): StoryInsertPayload {
  const gradient = getGradient(slide.bgGradId);
  return {
    author_id: authorId,
    type: slide.type,
    bg_color: gradient.colors[0],
    expires_at: new Date(Date.now() + STORY_LIMITS.ttlMs).toISOString(),
    content: slide.content.trim() || (slide.type === 'text' ? 'حالة' : null),
    image_url: imageUrl,
  };
}

async function resolveImageUrls(
  slides: StorySlide[],
  authorId: string,
  onProgress?: (done: number, total: number) => void,
): Promise<{ urls: (string | null)[]; degraded: number }> {
  const urls: (string | null)[] = [];
  let degraded = 0;

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    if (slide.type === 'image' && slide.imageUri) {
      const result = await uploadStoryImage({
        uri: slide.imageUri,
        base64: slide.imageBase64,
        userId: authorId,
        index: i,
      });
      urls.push(result.url);
      if (result.strategy !== 'bucket') degraded += 1;
      if (result.strategy === 'local' && __DEV__) {
        console.warn(`[story] شريحة ${i + 1}: تعذر رفع الصورة، تم حفظ مسارها المحلي فقط`);
      }
    } else {
      urls.push(null);
    }
    onProgress?.(i + 1, slides.length);
  }

  return { urls, degraded };
}

export interface PublishOutcome {
  publishedCount: number;
  requestedCount: number;
  failures: string[];
  degradedUploads: number;
  unauthenticated: boolean;
}

export async function publishStorySlides(
  slides: StorySlide[],
  onProgress?: (done: number, total: number) => void,
): Promise<PublishOutcome> {
  const publishable = selectPublishableSlides(slides);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      publishedCount: 0,
      requestedCount: 0,
      failures: ['يجب تسجيل الدخول لنشر القصة.'],
      degradedUploads: 0,
      unauthenticated: true,
    };
  }

  if (publishable.length === 0) {
    return {
      publishedCount: 0,
      requestedCount: 0,
      failures: ['لا توجد شرائح صالحة للنشر.'],
      degradedUploads: 0,
      unauthenticated: false,
    };
  }

  const { urls, degraded } = await resolveImageUrls(publishable, user.id, onProgress);
  const payloads = publishable.map((slide, i) => buildPayload(slide, user.id, urls[i]));

  const { error } = await supabase.from('stories').insert(payloads);

  if (!error) {
    return {
      publishedCount: payloads.length,
      requestedCount: payloads.length,
      failures: [],
      degradedUploads: degraded,
      unauthenticated: false,
    };
  }

  if (__DEV__) console.warn('[story] batch insert rejected, retrying row by row:', error.message);

  // Batch insert rejected: retry row by row so one bad slide cannot block the rest.
  const failures: string[] = [];
  let publishedCount = 0;

  for (let i = 0; i < payloads.length; i++) {
    const { error: rowError } = await supabase.from('stories').insert(payloads[i]);
    if (rowError) {
      failures.push(`الشرريحة ${i + 1}: ${rowError.message}`);
      if (__DEV__) console.error(`[story] insert failed for slide ${i + 1}:`, rowError.message);
    } else {
      publishedCount += 1;
    }
  }

  return {
    publishedCount,
    requestedCount: payloads.length,
    failures,
    degradedUploads: degraded,
    unauthenticated: false,
  };
}
