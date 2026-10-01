import { DEFAULT_GRADIENT, nextGradientId } from './storyGradients';
import { STORY_LIMITS, type StorySlide } from './storyTypes';

let seq = 0;

export function nextSlideId(prefix: string): string {
  seq += 1;
  return `${prefix}_${Date.now().toString(36)}_${seq}`;
}

export function createTextSlide(currentCount: number): StorySlide {
  return {
    id: nextSlideId('text'),
    type: 'text',
    content: '',
    bgGradId: nextGradientId(currentCount),
  };
}

export function createImageSlide(uri: string, base64?: string | null): StorySlide {
  return {
    id: nextSlideId('img'),
    type: 'image',
    content: '',
    imageUri: uri,
    imageBase64: base64 ?? null,
    bgGradId: DEFAULT_GRADIENT.id,
  };
}

export function isInitialState(slides: StorySlide[]): boolean {
  if (slides.length !== 1) return false;
  const only = slides[0];
  return (
    (only.type === 'text' && only.content.trim().length === 0) ||
    (only.type === 'image' && !only.imageUri)
  );
}

export function isSlideValid(slide: StorySlide): boolean {
  return slide.type === 'text'
    ? slide.content.trim().length > 0
    : typeof slide.imageUri === 'string' && slide.imageUri.length > 0;
}

export function isSlideEmpty(slide: StorySlide): boolean {
  return (
    slide.content.trim().length === 0 &&
    (slide.type !== 'image' || !slide.imageUri)
  );
}

export function selectPublishableSlides(slides: StorySlide[]): StorySlide[] {
  return slides.filter(isSlideValid).slice(0, STORY_LIMITS.maxSlides);
}

export function hasRoomForMore(slides: StorySlide[]): boolean {
  return slides.length < STORY_LIMITS.maxSlides;
}
