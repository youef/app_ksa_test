export type StoryScope = 'city' | 'following' | 'district' | 'unseen' | 'mine';
export function isActiveStory(story: { expires_at?: string | null; created_at: string }, now = Date.now()) {
  const end = story.expires_at ? Date.parse(story.expires_at) : Date.parse(story.created_at) + 86400000;
  return Number.isFinite(end) && end > now;
}
export function storyExpiryFilter(archived = false, now = Date.now()) {
  const comparison = archived ? 'lte' : 'gt';
  return `expires_at.${comparison}.${new Date(now).toISOString()},and(expires_at.is.null,created_at.${archived ? 'lte' : 'gt'}.${new Date(now - 86400000).toISOString()})`;
}
export function matchesStoryScope(story: { id: string; author_id: string; profiles?: { district?: string | null } | null }, scope: StoryScope, viewerId: string, following: string[], seen: string[], district: string) {
  if (scope === 'mine') return story.author_id === viewerId;
  if (scope === 'following') return following.includes(story.author_id);
  if (scope === 'unseen') return story.author_id !== viewerId && !seen.includes(story.id);
  if (scope === 'district') return Boolean(district.trim()) && (story.profiles?.district || '').trim().toLocaleLowerCase('ar') === district.trim().toLocaleLowerCase('ar');
  return true;
}

export function storyDiscoveryMembership(author: { city?: string | null; district?: string | null } | null | undefined, authorId: string, viewerId: string, following: string[], city: string, district: string) {
  const normalize = (value?: string | null) => (value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('ar');
  const knownCity = Boolean(normalize(city)) && !['كل المدن', 'كل المملكة', 'جميع المدن'].includes(city.trim());
  const inCity = knownCity && normalize(author?.city) === normalize(city);
  const knownDistrict = Boolean(normalize(district)) && !['كل الأحياء', 'كل أحياء المدينة', 'جميع الأحياء'].includes(district.trim());
  const inDistrict = inCity && knownDistrict && normalize(author?.district) === normalize(district);
  return { ring: authorId === viewerId || following.includes(authorId) || inDistrict, trending: inCity };
}
