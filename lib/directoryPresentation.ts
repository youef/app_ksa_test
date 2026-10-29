export const DIRECTORY_PAGE_SIZE = 12;
export type DirectoryKind = 'all' | 'business' | 'service';
export type DirectorySort = 'recent' | 'name';
export type OpeningPeriod = { day_of_week: number; opens_at: string | null; closes_at: string | null; is_closed: boolean };

export function directorySearch(value: string) {
  return value.replace(/[^\p{L}\p{N}\s-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
}

/** Only public commercial contact fields belong here, never device coordinates. */
export function businessWebsite(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim().includes('://') ? value.trim() : 'https://' + value.trim());
    return url.protocol === 'https:' && !url.username && !url.password && url.hostname.includes('.') ? url.href : null;
  } catch { return null; }
}

export function businessPhone(value: unknown): string | null {
  if (typeof value !== 'string' || /[^\d+\s()\-\u0660-\u0669\u06f0-\u06f9]/.test(value)) return null;
  let digits = value.replace(/[٠-٩۰-۹]/g, char => String('٠١٢٣٤٥٦٧٨٩'.includes(char) ? '٠١٢٣٤٥٦٧٨٩'.indexOf(char) : '۰۱۲۳۴۵۶۷۸۹'.indexOf(char))).replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 10 && digits.startsWith('0')) digits = '966' + digits.slice(1);
  return /^[1-9]\d{8,14}$/.test(digits) ? digits : null;
}

/** Saudi Arabia is UTC+03 year round. Overnight intervals include last week's Saturday. */
export function businessOpening(periods: OpeningPeriod[], now = new Date()) {
  const local = new Date(now.getTime() + 3 * 3600000);
  const minute = local.getUTCDay() * 1440 + local.getUTCHours() * 60 + local.getUTCMinutes();
  const intervals = periods.flatMap(period => {
    if (period.is_closed || !Number.isInteger(period.day_of_week) || period.day_of_week < 0 || period.day_of_week > 6) return [];
    const valid = (time: string | null) => !!time && /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(time);
    if (!valid(period.opens_at) || !valid(period.closes_at)) return [];
    const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
    const start = period.day_of_week * 1440 + minutes(period.opens_at!);
    let end = period.day_of_week * 1440 + minutes(period.closes_at!);
    if (end === start) return [];
    if (end < start) end += 1440;
    return [-10080, 0, 10080].map(offset => ({ start: start + offset, end: end + offset }));
  });
  const open = intervals.some(interval => interval.start <= minute && minute < interval.end);
  const next = intervals.filter(interval => interval.start > minute).sort((a, b) => a.start - b.start)[0];
  const minuteStart = now.getTime() - now.getUTCSeconds() * 1000 - now.getUTCMilliseconds();
  return { hasSchedule: periods.length > 0, open, nextOpening: !open && next ? new Date(minuteStart + (next.start - minute) * 60000).toISOString() : null };
}

export async function fetchDirectoryPage(client: any, options: { location: { city?: string; district?: string }; kind: DirectoryKind; search: string; verified: boolean; sort: DirectorySort; page: number }) {
  const all = (value?: string) => !value?.trim() || ['كل المملكة', 'كل المدن', 'جميع المدن', 'كل الأحياء', 'كل أحياء المدينة', 'جميع الأحياء', 'الكل'].includes(value.trim());
  const read = async (table: 'businesses' | 'services') => {
    if (options.kind === 'business' && table === 'services' || options.kind === 'service' && table === 'businesses') return [];
    const fields = table === 'businesses' ? 'id,name,description,city,district,logo_url,cover_url,is_verified,created_at' : 'id,name,description,city,district,cover_url,subcategory,is_verified,created_at';
    let query = client.from(table).select(fields).eq('moderation_status', 'approved');
    if (!all(options.location.city)) query = query.eq('city', options.location.city);
    if (!all(options.location.district) && !all(options.location.city)) query = query.eq('district', options.location.district);
    if (options.verified) query = query.eq('is_verified', true);
    const search = directorySearch(options.search);
    if (search) query = query.or('name.ilike.%' + search + '%,description.ilike.%' + search + '%');
    const start = options.page * DIRECTORY_PAGE_SIZE;
    const response = await query.order(options.sort === 'name' ? 'name' : 'created_at', { ascending: options.sort === 'name' }).order('id', { ascending: true }).range(start, start + DIRECTORY_PAGE_SIZE);
    if (response.error) throw response.error;
    return response.data || [];
  };
  const [businesses, services] = await Promise.all([read('businesses'), read('services')]);
  const items = [...businesses.slice(0, DIRECTORY_PAGE_SIZE).map((row: any) => ({ ...row, kind: 'business' as const, image: row.logo_url || row.cover_url })), ...services.slice(0, DIRECTORY_PAGE_SIZE).map((row: any) => ({ ...row, kind: 'service' as const, image: row.cover_url }))];
  items.sort((a, b) => options.sort === 'name' ? String(a.name).localeCompare(String(b.name), 'ar') || a.id.localeCompare(b.id) : String(b.created_at).localeCompare(String(a.created_at)) || a.id.localeCompare(b.id));
  return { items, hasMore: businesses.length > DIRECTORY_PAGE_SIZE || services.length > DIRECTORY_PAGE_SIZE };
}
