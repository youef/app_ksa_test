import AsyncStorage from '@react-native-async-storage/async-storage';

const cache = new Map<string, Record<string, number>>();
const loads = new Map<string, Promise<void>>();
const writes = new Map<string, Promise<void>>();
const key = (viewerId: string) => `hayna:story-seen:v1:${viewerId}`;
const cutoff = () => Date.now() - 2 * 86400000;

export function getCachedSeenStoryIds(viewerId: string): string[] {
  return Object.keys(cache.get(viewerId) || {});
}

export async function getLocalSeenStoryIds(viewerId: string): Promise<string[]> {
  if (!viewerId) return [];
  if (!loads.has(viewerId)) {
    loads.set(viewerId, (async () => {
      try {
        const stored = JSON.parse(await AsyncStorage.getItem(key(viewerId)) || '{}');
        const valid = Object.fromEntries(Object.entries(stored).filter(([, time]) => typeof time === 'number' && time > cutoff()));
        cache.set(viewerId, { ...valid, ...cache.get(viewerId) } as Record<string, number>);
      } catch { /* Session memory still works if device storage is unavailable. */ }
    })());
  }
  await loads.get(viewerId);
  return Object.keys(cache.get(viewerId) || {});
}

/** Update memory synchronously so returning from the viewer never waits for the view RPC. */
export function rememberSeenStories(viewerId: string, storyIds: string[]) {
  if (!viewerId || !storyIds.length) return;
  const records = cache.get(viewerId) || {};
  for (const id of storyIds) records[id] = Date.now();
  cache.set(viewerId, records);
  const previous = writes.get(viewerId) || Promise.resolve();
  const pending = previous.catch(() => {}).then(async () => {
    await getLocalSeenStoryIds(viewerId);
    const recent = Object.fromEntries(Object.entries(cache.get(viewerId) || {}).filter(([, time]) => time > cutoff()));
    await AsyncStorage.setItem(key(viewerId), JSON.stringify(recent));
  }).catch(() => {});
  writes.set(viewerId, pending);
}
