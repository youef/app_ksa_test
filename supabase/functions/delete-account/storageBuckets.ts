/** User-owned media only. Do not delete shared platform branding or announcement assets. */
export const ACCOUNT_MEDIA_BUCKETS = [
  'avatars',
  'chat-media',
  'service-images',
  'story-media',
  'question-media',
  'verification-documents',
] as const;

/** Scope deletion to the authenticated account, including legacy avatar-story paths. */
export function accountMediaPrefixes(bucket: string, userId: string): string[] {
  return bucket === 'avatars' ? [userId, `story_${userId}`] : [userId];
}
