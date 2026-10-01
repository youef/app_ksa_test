export type StorySlideType = 'image' | 'text';

export interface StorySlide {
  id: string;
  type: StorySlideType;
  content: string;
  imageUri?: string | null;
  imageBase64?: string | null;
  bgGradId: number;
}

export interface StoryGradient {
  id: number;
  colors: [string, string];
  name: string;
}

export interface StoryInsertPayload {
  author_id: string;
  type: StorySlideType;
  bg_color: string;
  expires_at: string;
  content: string | null;
  image_url: string | null;
}

export type PublishPhase = 'idle' | 'publishing';

export interface PublishSuccess {
  ok: true;
  publishedCount: number;
  requestedCount: number;
  failures: string[];
  degradedUploads: number;
}

export interface PublishFailure {
  ok: false;
  reason: 'unauthenticated' | 'nothing_to_publish' | 'all_failed';
  message: string;
  failures: string[];
}

export type PublishResult = PublishSuccess | PublishFailure;

export const STORY_LIMITS = {
  maxSlides: 10,
  textMaxLength: 300,
  captionMaxLength: 150,
  pickerSelectionLimit: 10,
  ttlMs: 24 * 60 * 60 * 1000,
} as const;
