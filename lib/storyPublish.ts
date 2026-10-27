import { supabase } from './supabase';
import { getGradient } from './storyGradients';
import { selectPublishableSlides } from './storySlides';
import { STORY_LIMITS, type StoryInsertPayload, type StoryPublishOptions, type StorySlide } from './storyTypes';
import { uploadStoryImage } from './storyUpload';

function buildPayload(
  slide: StorySlide,
  authorId: string,
  imageUrl: string | null,
  options: StoryPublishOptions,
): StoryInsertPayload {
  const gradient = getGradient(slide.bgGradId);
  return {
    author_id: authorId,
    type: slide.type,
    bg_color: gradient.colors[0],
    expires_at: new Date(Date.now() + STORY_LIMITS.ttlMs).toISOString(),
    content: slide.content.trim() || (slide.type === 'text' ? 'حالة' : null),
    image_url: imageUrl,
    visibility: options.audience,
    allowed_user_ids: options.audience === 'custom' ? options.allowedUserIds : [],
    hidden_user_ids: options.hiddenUserIds || [],
    allow_replies: options.allowReplies !== false,
    interactive_type: options.interactiveType,
    poll_question: options.interactiveType === 'poll' ? options.pollQuestion.trim() : null,
    poll_options: options.interactiveType === 'poll' ? options.pollOptions : ['نعم', 'لا'],
    question_prompt: options.interactiveType === 'question' ? options.questionPrompt.trim() : null,
    text_color: options.textColor,
    font_size: options.fontSize,
    font_family: options.fontFamily,
    text_rotation: options.textRotation,
    text_offset_x: options.textOffsetX,
    text_offset_y: options.textOffsetY,
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
  /** ID of the first successfully published story (for direct navigation). */
  firstPublishedId?: string;
}

export async function publishStorySlides(
  slides: StorySlide[],
  onProgress?: (done: number, total: number) => void,
  options: StoryPublishOptions = {
    audience: 'public',
    allowedUserIds: [],
    hiddenUserIds: [],
    allowReplies: true,
    interactiveType: 'none',
    pollQuestion: '',
    pollOptions: ['نعم', 'لا'],
    questionPrompt: '',
    textColor: '#FFFFFF',
    fontSize: 28,
    fontFamily: 'System',
    textRotation: 0,
    textOffsetX: 0,
    textOffsetY: 0,
  },
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

  // Cooldown is enforced in PostgreSQL; avoid uploading files when publishing is blocked.
  const recent = await supabase.from('stories').select('created_at').eq('author_id', user.id)
    .order('created_at', { ascending: false }).limit(1);
  if (!recent.error && recent.data?.[0]?.created_at &&
      Date.now() - new Date(recent.data[0].created_at).getTime() < 3 * 60 * 60 * 1000) {
    return { publishedCount: 0, requestedCount: publishable.length,
      failures: ['يمكنك نشر ستوري جديدة بعد مرور ثلاث ساعات من آخر نشر.'],
      degradedUploads: 0, unauthenticated: false };
  }
  if (publishable.length > 1) {
    return { publishedCount: 0, requestedCount: publishable.length,
      failures: ['يمكنك نشر ستوري واحدة كل ثلاث ساعات. اختر شريحة واحدة للنشر.'],
      degradedUploads: 0, unauthenticated: false };
  }

  const account = await supabase.from('profiles').select('allow_story_replies').eq('id', user.id).single();
  if (account.error) throw account.error;
  if (account.data.allow_story_replies === 'nobody') options = { ...options, allowReplies: false };
  const { urls, degraded } = await resolveImageUrls(publishable, user.id, onProgress);
  const payloads = publishable.map((slide, i) => buildPayload(slide, user.id, urls[i], options));

  const insertResult = await supabase.from('stories').insert(payloads).select('id');
  if (insertResult.error) {
    // Prevent orphaned media when a database guard rejects the story.
    const paths = urls.filter((url): url is string => Boolean(url))
      .map(url => url.split('/storage/v1/object/public/story-media/')[1]?.split('?')[0])
      .filter((path): path is string => Boolean(path));
    if (paths.length) await supabase.storage.from('story-media').remove(paths);
  }

  if (!insertResult.error) {
    const firstId = insertResult.data?.[0]?.id as string | undefined;
    const insertedCount = insertResult.data?.length ?? 0;
    return {
      publishedCount: insertedCount,
      requestedCount: payloads.length,
      failures: insertedCount < payloads.length ? ['تم رفض يومية أو أكثر بسبب محتوى مخالف أو صلاحيات النشر.'] : [],
      degradedUploads: degraded,
      unauthenticated: false,
      firstPublishedId: firstId,
    };
  }
  const error = insertResult.error;

  // Uploaded objects were already removed after the failed insert; do not retry with broken URLs.
  return { publishedCount: 0, requestedCount: payloads.length, failures: [error.message], degradedUploads: degraded, unauthenticated: false };

}
