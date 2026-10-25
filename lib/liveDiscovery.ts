export type DiscoverableLive = {
  id: string; title: string; category: string; host_id: string; viewer_count: number; started_at: string;
  profiles?: { display_name: string | null; username: string | null; city: string | null } | null;
};
export function normalizeLiveSearch(value: string) {
  return value.normalize('NFKC').toLocaleLowerCase().replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').trim();
}
export function discoverLives<T extends DiscoverableLive>(streams: T[], query: string, sort: 'popular' | 'newest') {
  const terms = normalizeLiveSearch(query).replace(/^@/, '').split(/\s+/).filter(Boolean);
  return streams.filter(stream => {
    const text = normalizeLiveSearch([stream.title, stream.category, stream.profiles?.display_name, stream.profiles?.username, stream.profiles?.city].filter(Boolean).join(' '));
    return terms.every(term => text.includes(term));
  }).sort((a, b) => (sort === 'popular' ? (b.viewer_count || 0) - (a.viewer_count || 0) : 0)
    || (Date.parse(b.started_at) || 0) - (Date.parse(a.started_at) || 0) || a.id.localeCompare(b.id));
}
