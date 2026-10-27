import type { SupabaseClient } from '@supabase/supabase-js';

type FeedLocation = { city: string; district: string };
const ALL_CITIES = new Set(['', 'كل المدن', 'كل المملكة', 'الكل', 'جميع المدن']);
const ALL_DISTRICTS = new Set(['', 'كل الأحياء', 'كل أحياء المدينة', 'جميع الأحياء', 'الكل']);
const GUEST_LIMIT = 100; // The existing guest RPCs enforce this cap.

/** Anchored names preserve Arabic spelling variants without matching another neighborhood. */
export function feedLocationPattern(value: string, prefix: 'مدينة' | 'حي'): string {
  const name = value.trim().replace(/^(مدينة|حي|منطقة)\s+/g, '').replace(/\s+/g, ' ');
  const escaped = Array.from(name).map(char => {
    if (/[أإآا]/.test(char)) return '[أإآا]';
    if (/\s/.test(char)) return '\\s+';
    return char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }).join('');
  return `^\\s*(${prefix}\\s+)?${escaped}\\s*$`;
}

/** Scope first, then order/limit. Never fetch the whole platform for an unset location. */
export async function queryHomePosts(
  client: Pick<SupabaseClient, 'from' | 'rpc'>,
  table: 'questions' | 'requests',
  location: FeedLocation,
  userId: string | null,
  limit: number,
  ownPosts = false,
) {
  if ((!ownPosts && ALL_CITIES.has(location.city.trim())) || (ownPosts && !userId)) {
    return { data: [], error: null, hasMore: false };
  }
  if (!userId) {
    const response = await client.rpc(table === 'questions' ? 'hayna_guest_questions' : 'hayna_guest_requests', {
      p_city: location.city,
      p_district: location.district,
      p_limit: Math.min(limit + 1, GUEST_LIMIT),
    });
    const rows = response.data ?? [];
    return { data: rows.slice(0, limit), error: response.error, hasMore: rows.length > limit && limit < GUEST_LIMIT };
  }

  let query = client.from(table).select('*');
  if (ownPosts) {
    // Keep the explicitly selected "my posts" view independent of the current neighborhood.
    query = query.eq(table === 'questions' ? 'author_id' : 'requester_id', userId);
  } else {
    query = query.filter('city', 'imatch', feedLocationPattern(location.city, 'مدينة'));
    if (!ALL_DISTRICTS.has(location.district.trim())) {
      query = query.filter('district', 'imatch', feedLocationPattern(location.district, 'حي'));
    }
  }
  if (table === 'requests') query = query.eq('status', 'open');
  const response = await query.order('created_at', { ascending: false }).order('id', { ascending: false }).limit(limit + 1);
  const rows = response.data ?? [];
  return { data: rows.slice(0, limit), error: response.error, hasMore: rows.length > limit };
}
