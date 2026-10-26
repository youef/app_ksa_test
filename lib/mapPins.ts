import { OASIS } from './oasis';
import { supabase } from './supabase';
import {
  SAUDI_REGIONS,
  isInsideSaudiArabia,
  normalizeSaudiLocationName,
} from './saudiLocations';
import { areaLabel, distanceMeters, obfuscateCoordinate } from './privacy';

export type MapPinKind = 'question' | 'tool' | 'emergency' | 'request' | 'business' | 'carpool' | 'event' | 'marketplace' | 'alert';

export interface MapPin {
  id: string;
  kind: MapPinKind;
  title: string;
  body: string;
  city: string;
  district: string;
  /** Neighbourhood-level label. Never an address. */
  area: string;
  lat: number;
  lng: number;
  /** true whenever the pin is blurred or district-derived rather than the author's own fix. */
  approximate: boolean;
  /** true only when this is the author's own post and they chose to reveal the fix. */
  exact: boolean;
  href: string;
  createdAt: string;
  author: string;
  ownerId: string;
  category: string;
  verified: boolean;
  isOpen: boolean;
  urgent: boolean;
  rating: number | null;
  price: number | null;
  phone: string;
}

export const MAP_PIN_KINDS: Record<
  MapPinKind,
  { label: string; short: string; color: string; emoji: string }
> = {
  question: { label: 'أسئلة واستفسارات', short: 'أسئلة', color: OASIS.colors.info, emoji: '؟' },
  tool: { label: 'إعارة أدوات', short: 'إعارة', color: '#7C3AED', emoji: '🧰' },
  emergency: { label: 'تنبيهات طارئة', short: 'طارئ', color: OASIS.colors.danger, emoji: '🚨' },
  request: { label: 'طلبات مساعدة', short: 'طلبات', color: OASIS.colors.warning, emoji: '🤝' },
  business: { label: 'محلات وخدمات', short: 'محلات', color: OASIS.colors.primary, emoji: '🏪' },
  carpool: { label: 'توصيل مدارس', short: 'توصيل', color: OASIS.colors.primary, emoji: '🚗' },
  event: { label: 'فعاليات الحي', short: 'فعاليات', color: '#DB2777', emoji: '🎉' },
  marketplace: { label: 'إعلانات وسوق الحي', short: 'السوق', color: OASIS.colors.gold, emoji: '🛍️' },
  alert: { label: 'تنبيهات الحي', short: 'تنبيهات', color: OASIS.colors.danger, emoji: '⚠️' },
};

export const MAP_PIN_ORDER: MapPinKind[] = [
  'question',
  'tool',
  'request',
  'emergency',
  'business',
  'carpool',
  'event',
  'marketplace',
  'alert',
];

type Center = { lat: number; lng: number; label: string; regionId: string; regionName: string };

// District names are not unique across Saudi cities. Scope them by city.
const cityCenters = new Map<string, Center>();
const regionCenters = new Map<string, Center>();
const districtCenters = new Map<string, Center>();
const uniqueDistrictCenters = new Map<string, Center | null>();
for (const region of SAUDI_REGIONS) {
  regionCenters.set(normalizeSaudiLocationName(region.name), {
    lat: region.lat, lng: region.lng, label: region.name, regionId: region.id, regionName: region.name,
  });
  for (const city of region.cities) {
    if (city.lat == null || city.lng == null) continue;
    const cityKey = normalizeSaudiLocationName(city.name);
    if (!cityKey) continue;
    const cityCenter = { lat: city.lat, lng: city.lng, label: city.name, regionId: region.id, regionName: region.name };
    if (!cityCenters.has(cityKey)) cityCenters.set(cityKey, cityCenter);
    for (const district of city.districts) {
      if (district.lat == null || district.lng == null) continue;
      const districtKey = normalizeSaudiLocationName(district.name);
      if (!districtKey) continue;
      const center = { lat: district.lat, lng: district.lng, label: district.name, regionId: region.id, regionName: region.name };
      districtCenters.set(`${cityKey}:${districtKey}`, center);
      if (!uniqueDistrictCenters.has(districtKey)) uniqueDistrictCenters.set(districtKey, center);
      else uniqueDistrictCenters.set(districtKey, null);
    }
  }
}

/** Prevent an حي العزيزية in one city matching a different city's حي العزيزية. */
export function findPlaceCenter(city?: string | null, district?: string | null): Center | null {
  const cityKey = normalizeSaudiLocationName(city || '');
  const districtKey = normalizeSaudiLocationName(district || '');
  if (cityKey) {
    const parent = cityCenters.get(cityKey) ?? regionCenters.get(cityKey) ?? null;
    return parent ? ((districtKey ? districtCenters.get(`${cityKey}:${districtKey}`) : null) ?? parent) : null;
  }
  return districtKey ? (uniqueDistrictCenters.get(districtKey) ?? null) : null;
}

export function regionOfCity(city?: string | null): { id: string; name: string } | null {
  const center = findPlaceCenter(city);
  return center ? { id: center.regionId, name: center.regionName } : null;
}

function validCoordinates(a: unknown, b: unknown): { lat: number; lng: number } | null {
  if (a == null || b == null || a === '' || b === '') return null;
  const lat = Number(a), lng = Number(b);
  return Number.isFinite(lat) && Number.isFinite(lng) && isInsideSaudiArabia(lat, lng) ? { lat, lng } : null;
}

/**
 * Personal posts never publish raw fixes. Ungeocoded pins use a known locality
 * centre labelled approximate; no scattered locations pretending to be addresses.
 * Public destinations need explicit real coordinates.
 */
export function resolvePinPosition(
  row: { id: string; lat?: unknown; lng?: unknown; city?: string | null; district?: string | null },
  fallbacks: { lat?: unknown; lng?: unknown } = {},
  options: { blur?: boolean } = {},
): { lat: number; lng: number; approximate: boolean } | null {
  const blur = options.blur !== false;
  const coordinates = validCoordinates(row.lat, row.lng) ?? validCoordinates(fallbacks.lat, fallbacks.lng);
  if (coordinates) {
    if (!blur) return { ...coordinates, approximate: false };
    const safe = obfuscateCoordinate(coordinates.lat, coordinates.lng, row.id);
    if (isInsideSaudiArabia(safe.lat, safe.lng)) return { ...safe, approximate: true };
    // Never fall back to raw personal GPS near a country border.
  } else if (!blur) return null;
  if (!blur) return null;
  const center = findPlaceCenter(row.city, row.district);
  return center ? { lat: center.lat, lng: center.lng, approximate: true } : null;
}

function cleanText(value: unknown, max = 220): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function toNumber(value: unknown): number | null {
  if (value == null || value === '' || typeof value === 'boolean') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function toPrice(value: unknown): number | null {
  const n = toNumber(value);
  return n != null && n >= 0 ? n : null;
}
function toRating(value: unknown): number | null {
  const n = toNumber(value);
  return n != null && n >= 0 && n <= 5 ? n : null;
}
const DEMO_MARKERS = /بيانات تجريبية|متجر محلي تجريبي|خدمة تجريبية|شبه واقعية|synthetic|mock data|demo data/i;
function isPublishable(row: any): boolean {
  if (!row || row.id == null || row.is_hidden === true || row.is_deleted === true ||
      row.is_demo === true || row.is_test === true || row.is_active === false) return false;
  const moderation = String(row.moderation_status ?? '').toLowerCase();
  if (moderation && !['approved', 'published', 'active'].includes(moderation)) return false;
  if (['private', 'hidden', 'draft'].includes(String(row.visibility ?? '').toLowerCase())) return false;
  return !DEMO_MARKERS.test([row.title, row.name, row.body, row.description]
    .map((value) => typeof value === 'string' ? value : '').join(' '));
}
function isExpired(value: unknown): boolean {
  if (typeof value !== 'string' || !value.trim()) return false;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp < Date.now();
}

function relativeTime(value?: string | null): string {
  if (!value) return '';
  const then = new Date(value).getTime();
  if (isNaN(then)) return '';
  const diff = Date.now() - then;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return 'الآن';
  if (diff < hour) return `قبل ${Math.floor(diff / minute)} دقيقة`;
  if (diff < day) return `قبل ${Math.floor(diff / hour)} ساعة`;
  if (diff < day * 30) return `قبل ${Math.floor(diff / day)} يوم`;
  return `قبل ${Math.floor(diff / (day * 30))} شهر`;
}

async function safeRows(
  build: () => PromiseLike<{ data: any } | null>,
  fallback: any[] = [],
): Promise<any[]> {
  try {
    const result = await build();
    if (result && 'error' in result && (result as { error?: { message?: string } }).error) {
      console.warn('Map data query failed:', (result as { error?: { message?: string } }).error?.message);
      return fallback;
    }
    const rows = result?.data ?? fallback;
    return Array.isArray(rows) ? rows.filter(isPublishable) : fallback;
  } catch (error) {
    console.warn('Map data source unavailable:', error);
    return fallback;
  }
}

/**
 * Real neighbourhood feed: questions, help requests and shops straight from Supabase.
 * Every query is defensive, so a missing column or table degrades instead of breaking.
 */
export async function loadMapPins(limit = 220): Promise<MapPin[]> {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(400, Math.floor(limit))) : 220;
  // One query covers carpool and ordinary requests. NULL request types are included.
  const [questionRows, allRequestRows, businessRows, servicesRows, eventRows, marketplaceRows, alertRows] = await Promise.all([
    safeRows(() => supabase.from('questions').select('*').order('created_at', { ascending: false }).limit(safeLimit)),
    safeRows(() => supabase.from('requests').select('*').eq('status', 'open').order('created_at', { ascending: false }).limit(safeLimit)),
    safeRows(() => supabase.from('businesses').select('*').limit(safeLimit)),
    safeRows(() => supabase.from('services').select('*').eq('moderation_status', 'approved').order('created_at', { ascending: false }).limit(safeLimit)),
    safeRows(() => supabase.from('events').select('*').eq('status', 'published').eq('moderation_status', 'approved').order('starts_at', { ascending: true }).limit(safeLimit)),
    safeRows(() => supabase.from('marketplace_items').select('*').eq('status', 'available').order('created_at', { ascending: false }).limit(safeLimit)),
    safeRows(() => supabase.from('urgent_alerts').select('*').eq('status', 'active').order('created_at', { ascending: false }).limit(safeLimit)),
  ]);
  const requestRows = allRequestRows.filter((row: any) => row.request_type !== 'carpooling');
  const carpoolRows = allRequestRows.filter((row: any) => row.request_type === 'carpooling');

  const pins: MapPin[] = [];

  questionRows.forEach((row: any) => {
    if (row.status === 'closed') return;
    const position = resolvePinPosition({
      id: `question-${row.id}`,
      lat: row.lat,
      lng: row.lng,
      city: row.city,
      district: row.district,
    });
    if (!position) return;

    const isEmergency = Boolean(row.is_emergency) || row.urgency_level === 'emergency';
    const isTool = Boolean(row.is_tool_sharing) || row.item_type === 'tool_sharing';
    const kind: MapPinKind = isEmergency ? 'emergency' : isTool ? 'tool' : 'question';
    pins.push({
      id: `question-${row.id}`,
      kind,
      title: cleanText(row.title, 90) || 'سؤال بدون عنوان',
      body: cleanText(row.body),
      city: row.city || 'كل المملكة',
      district: row.district || '',
      area: areaLabel({ district: row.district, city: row.city }),
      lat: position.lat,
      lng: position.lng,
      approximate: true,
      exact: false,
      href: `/question?id=${row.id}`,
      createdAt: row.created_at || '',
      author: '',
      ownerId: row.author_id || '',
      category: cleanText(row.category, 40),
      verified: false,
      isOpen: row.status !== 'closed',
      urgent: Boolean(row.is_urgent) || isEmergency,
      rating: null,
      price: null,
      phone: '',
    });
  });

  requestRows.forEach((row: any) => {
    const position = resolvePinPosition({
      id: `request-${row.id}`,
      lat: row.lat,
      lng: row.lng,
      city: row.city,
      district: row.district,
    });
    if (!position) return;

    pins.push({
      id: `request-${row.id}`,
      kind: 'request',
      title: cleanText(row.title, 90) || 'طلب مساعدة',
      body: cleanText(row.description),
      city: row.city || 'كل المملكة',
      district: row.district || '',
      area: areaLabel({ district: row.district, city: row.city }),
      lat: position.lat,
      lng: position.lng,
      approximate: true,
      exact: false,
      href: `/request?id=${row.id}`,
      createdAt: row.created_at || '',
      author: '',
      ownerId: row.requester_id || '',
      category: cleanText(row.request_type, 40),
      verified: false,
      isOpen: row.status === 'open',
      urgent: Boolean(row.is_urgent),
      rating: null,
      price: toPrice(row.budget),
      phone: '', // Do not reveal private contact info in public map data.
    });
  });

  // Carpool pins (requests with request_type = 'carpooling')
  carpoolRows.forEach((row: any) => {
    const position = resolvePinPosition({
      id: `carpool-${row.id}`,
      lat: row.lat,
      lng: row.lng,
      city: row.city,
      district: row.district,
    });
    if (!position) return;

    pins.push({
      id: `carpool-${row.id}`,
      kind: 'carpool',
      title: cleanText(row.title, 90) || 'توصيل مدرسة',
      body: cleanText(row.description),
      city: row.city || 'كل المملكة',
      district: row.district || '',
      area: areaLabel({ district: row.district, city: row.city }),
      lat: position.lat,
      lng: position.lng,
      approximate: true,
      exact: false,
      href: `/request?id=${row.id}`,
      createdAt: row.created_at || '',
      author: '',
      ownerId: row.requester_id || '',
      category: 'توصيل مدارس',
      verified: false,
      isOpen: row.status === 'open',
      urgent: false,
      rating: null,
      price: toPrice(row.price_per_seat),
      phone: '', // School transport contact stays in the listing.
    });
  });

  const shops = businessRows.map((row: any) => ({ row, table: 'businesses' }));

  shops.forEach(({ row, table }: { row: any; table: string }) => {
    if (!row?.id) return;
    // A storefront is a public address, so shop pins keep their exact position.
    const position = resolvePinPosition(
      {
        id: `${table}-${row.id}`,
        lat: row.latitude ?? row.lat,
        lng: row.longitude ?? row.lng,
        city: row.city,
        district: row.district,
      },
      {},
      { blur: false },
    );
    if (!position) return;

    pins.push({
      id: `${table}-${row.id}`,
      kind: 'business',
      title: cleanText(row.name, 90) || 'محل مسجّل',
      body: cleanText(row.description),
      city: row.city || 'كل المملكة',
      district: row.district || '',
      area: areaLabel({ district: row.district, city: row.city }),
      lat: position.lat,
      lng: position.lng,
      approximate: position.approximate,
      exact: !position.approximate,
      href: `/business?id=${row.id}`,
      createdAt: row.created_at || '',
      author: '',
      ownerId: row.owner_id || row.provider_id || '',
      category: cleanText(row.category, 40),
      verified: Boolean(row.is_verified),
      isOpen: row.is_open_now === true,
      urgent: false,
      rating: toRating(row.rating),
      price: toPrice(row.price ?? row.budget),
      phone: row.is_verified === true && row.show_phone !== false ? cleanText(row.phone ?? row.contact_phone, 30) : '',
    });
  });

  servicesRows.forEach((row: any) => {
    if (!row?.id) return;
    const position = resolvePinPosition(
      {
        id: `service-${row.id}`,
        lat: row.latitude ?? row.lat ?? row.details?.latitude,
        lng: row.longitude ?? row.lng ?? row.details?.longitude,
        city: row.city,
        district: row.district,
      },
      {},
      // Providers may work from home; never expose their exact location.
      { blur: true },
    );
    if (!position) return;

    pins.push({
      id: `service-${row.id}`,
      kind: 'business',
      title: cleanText(row.name, 90) || 'خدمة الحي',
      body: cleanText(row.description),
      city: row.city || 'كل المملكة',
      district: row.district || '',
      area: areaLabel({ district: row.district, city: row.city }),
      lat: position.lat,
      lng: position.lng,
      approximate: true,
      exact: false,
      href: `/service?id=${row.id}`,
      createdAt: row.created_at || '',
      author: '',
      ownerId: row.provider_id || '',
      category: cleanText(row.subcategory || row.category || row.listing_type || 'خدمة', 40),
      verified: Boolean(row.is_verified),
      isOpen: row.available_now === true,
      urgent: false,
      rating: null,
      price: toPrice(row.price_from),
      phone: '', // The listing controls access to provider contact details.
    });
  });

  eventRows.forEach((row: any) => {
    if (!row?.id || isExpired(row.ends_at)) return;
    const position = resolvePinPosition({ id: `event-${row.id}`, lat: row.latitude, lng: row.longitude, city: row.city, district: row.district }, {}, { blur: false });
    if (!position) return;
    pins.push({ id: `event-${row.id}`, kind: 'event', title: cleanText(row.title, 90) || 'فعالية في الحي', body: cleanText(row.description), city: row.city || 'كل المملكة', district: row.district || '', area: areaLabel({ district: row.district, city: row.city }), lat: position.lat, lng: position.lng, approximate: position.approximate, exact: !position.approximate, href: '/market?section=events', createdAt: row.starts_at || row.created_at || '', author: '', ownerId: row.organizer_id || '', category: cleanText(row.category || 'فعالية', 40), verified: row.moderation_status === 'approved', isOpen: row.status === 'published', urgent: false, rating: null, price: row.is_free ? 0 : null, phone: '' });
  });

  marketplaceRows.forEach((row: any) => {
    if (!row?.id) return;
    const position = resolvePinPosition({ id: `marketplace-${row.id}`, city: row.city, district: row.district });
    if (!position) return;
    pins.push({ id: `marketplace-${row.id}`, kind: 'marketplace', title: cleanText(row.title, 90) || 'عرض في سوق الحي', body: cleanText(row.description), city: row.city || 'كل المملكة', district: row.district || '', area: areaLabel({ district: row.district, city: row.city }), lat: position.lat, lng: position.lng, approximate: true, exact: false, href: '/market?section=market', createdAt: row.created_at || '', author: '', ownerId: row.seller_id || '', category: cleanText(row.item_type || 'إعلان', 40), verified: false, isOpen: row.status === 'available', urgent: false, rating: null, price: toPrice(row.price), phone: '' });
  });

  alertRows.forEach((row: any) => {
    if (!row?.id || isExpired(row.expires_at)) return;
    const position = resolvePinPosition({ id: `alert-${row.id}`, lat: row.location_lat, lng: row.location_lng, city: row.city, district: row.district });
    if (!position) return;
    pins.push({ id: `alert-${row.id}`, kind: 'alert', title: cleanText(row.title, 90) || 'تنبيه في الحي', body: cleanText(row.description), city: row.city || 'كل المملكة', district: row.district || '', area: areaLabel({ district: row.district, city: row.city }), lat: position.lat, lng: position.lng, approximate: true, exact: false, href: '/notifications', createdAt: row.created_at || '', author: '', ownerId: row.creator_id || '', category: cleanText(row.alert_type || 'تنبيه', 40), verified: false, isOpen: row.status === 'active', urgent: true, rating: null, price: null, phone: '' });
  });

  // Keep distinct listings even when they share a building or approximate neighbourhood centre.
  // The map renderer may cluster overlapping coordinates; dropping records here loses content.
  const seen = new Set<string>();
  return pins.filter((pin) => {
    if (seen.has(pin.id)) return false;
    seen.add(pin.id);
    return true;
  });
}

export function filterPins(
  pins: MapPin[],
  options: {
    kind?: MapPinKind | 'all';
    city?: string | null;
    district?: string | null;
    query?: string;
    verifiedOnly?: boolean;
    openOnly?: boolean;
    urgentOnly?: boolean;
  },
): MapPin[] {
  const kind = options.kind ?? 'all';
  const query = normalizeSaudiLocationName((options.query || '').trim());
  const cityKey = normalizeSaudiLocationName(options.city || '');
  const districtKey = normalizeSaudiLocationName(options.district || '');
  return pins.filter((pin) => {
    if (kind !== 'all' && pin.kind !== kind) return false;
    if (cityKey && normalizeSaudiLocationName(pin.city) !== cityKey) return false;
    if (districtKey && normalizeSaudiLocationName(pin.district) !== districtKey) return false;
    if (options.verifiedOnly && !pin.verified) return false;
    if (options.openOnly && !pin.isOpen) return false;
    if (options.urgentOnly && !pin.urgent) return false;
    return !query || normalizeSaudiLocationName(
      [pin.title, pin.body, pin.city, pin.district, pin.category, pin.author].filter(Boolean).join(' '),
    ).includes(query);
  });
}

/** Straight-line distance only; road/walking distance requires a routing engine. */
export function sortByDistance(
  pins: MapPin[],
  origin: { lat: number; lng: number },
): MapPin[] {
  return [...pins].sort(
    (a, b) => distanceMeters(origin, a) - distanceMeters(origin, b),
  );
}

export function countByKind(pins: MapPin[]): Record<string, number> {
  return pins.reduce<Record<string, number>>((acc, pin) => {
    acc[pin.kind] = (acc[pin.kind] || 0) + 1;
    return acc;
  }, { all: pins.length });
}

export function countByCity(pins: MapPin[]): Array<{ city: string; count: number }> {
  const counts = new Map<string, number>();
  pins.forEach((pin) => {
    const key = pin.city || 'غير محدد';
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return [...counts.entries()]
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count);
}

export { relativeTime };

/** Google Maps directions link, works from web and native. */
export function directionsUrl(pin: MapPin) {
  return `https://www.google.com/maps/dir/?api=1&destination=${pin.lat},${pin.lng}`;
}
