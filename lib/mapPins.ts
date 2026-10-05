import { supabase } from './supabase';
import {
  SAUDI_REGIONS,
  isInsideSaudiArabia,
  normalizeSaudiLocationName,
} from './saudiLocations';
import { areaLabel, distanceMeters, obfuscateCoordinate } from './privacy';

export type MapPinKind = 'question' | 'tool' | 'emergency' | 'request' | 'business';

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
  question: { label: 'أسئلة واستفسارات', short: 'أسئلة', color: '#2563EB', emoji: '؟' },
  tool: { label: 'إعارة أدوات', short: 'إعارة', color: '#7C3AED', emoji: '🧰' },
  emergency: { label: 'تنبيهات طارئة', short: 'طارئ', color: '#DC2626', emoji: '🚨' },
  request: { label: 'طلبات مساعدة', short: 'طلبات', color: '#F59E0B', emoji: '🤝' },
  business: { label: 'محلات وخدمات', short: 'محلات', color: '#059669', emoji: '🏪' },
};

export const MAP_PIN_ORDER: MapPinKind[] = [
  'question',
  'tool',
  'request',
  'emergency',
  'business',
];

const ALL_KINDS: MapPinKind = 'question';

type Center = { lat: number; lng: number; label: string; regionId: string; regionName: string };

const CITY_INDEX: Center[] = [];
SAUDI_REGIONS.forEach((region) => {
  CITY_INDEX.push({
    lat: region.lat,
    lng: region.lng,
    label: region.name,
    regionId: region.id,
    regionName: region.name,
  });
  region.cities.forEach((city) => {
    if (city.lat == null || city.lng == null) return;
    CITY_INDEX.push({
      lat: city.lat,
      lng: city.lng,
      label: city.name,
      regionId: region.id,
      regionName: region.name,
    });
    city.districts.forEach((district) => {
      if (district.lat == null || district.lng == null) return;
      CITY_INDEX.push({
        lat: district.lat,
        lng: district.lng,
        label: district.name,
        regionId: region.id,
        regionName: region.name,
      });
    });
  });
});

const INDEXED_CENTERS = CITY_INDEX.map((center) => ({
  key: normalizeSaudiLocationName(center.label),
  center,
}));

/** Best known centre for a city / district name, preferring the most specific match. */
export function findPlaceCenter(
  city?: string | null,
  district?: string | null,
): Center | null {
  const districtKey = normalizeSaudiLocationName(district || '');
  if (districtKey) {
    const districtHit = INDEXED_CENTERS.find((entry) => entry.key === districtKey);
    if (districtHit) return districtHit.center;
  }
  const cityKey = normalizeSaudiLocationName(city || '');
  if (cityKey) {
    const cityHit = INDEXED_CENTERS.find((entry) => entry.key === cityKey);
    if (cityHit) return cityHit.center;
  }
  return null;
}

export function regionOfCity(city?: string | null): { id: string; name: string } | null {
  const center = findPlaceCenter(city, null);
  return center ? { id: center.regionId, name: center.regionName } : null;
}

/** Deterministic scatter so several rows in one city do not land on the same pixel. */
function hashScatter(seed: string, spread: number) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const a = ((h >>> 0) % 10000) / 10000 - 0.5;
  const b = ((h >>> 7) % 10000) / 10000 - 0.5;
  return { dLat: a * spread, dLng: b * spread * 1.35 };
}

const CITY_SPREAD = 0.05;
const DISTRICT_SPREAD = 0.016;

/**
 * Position of a pin on the shared map.
 *
 * A stored fix is never published as-is: it is snapped onto a coarse privacy grid so a
 * pin lands in the right neighbourhood without pointing at a door. Without a fix we fall
 * back to a stable position derived from the district centre.
 */
export function resolvePinPosition(
  row: { id: string; lat?: unknown; lng?: unknown; city?: string | null; district?: string | null },
  fallbacks: { lat?: unknown; lng?: unknown } = {},
  options: { blur?: boolean } = {},
): { lat: number; lng: number; approximate: boolean } | null {
  const blur = options.blur !== false;
  const pairs: Array<[unknown, unknown]> = [
    [row.lat, row.lng],
    [fallbacks.lat, fallbacks.lng],
  ];
  for (const [rawLat, rawLng] of pairs) {
    const lat = Number(rawLat);
    const lng = Number(rawLng);
    if (!isNaN(lat) && !isNaN(lng) && isInsideSaudiArabia(lat, lng)) {
      if (!blur) return { lat, lng, approximate: false };
      const blurred = obfuscateCoordinate(lat, lng, row.id);
      return { lat: blurred.lat, lng: blurred.lng, approximate: true };
    }
  }

  const center = findPlaceCenter(row.city, row.district);
  if (!center) return null;
  const spread = normalizeSaudiLocationName(row.district || '') ? DISTRICT_SPREAD : CITY_SPREAD;
  const { dLat, dLng } = hashScatter(`${row.id}:${row.city || ''}`, spread);
  return {
    lat: Number((center.lat + dLat).toFixed(5)),
    lng: Number((center.lng + dLng).toFixed(5)),
    approximate: true,
  };
}

function cleanText(value: unknown, max = 220): string {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function toNumber(value: unknown): number | null {
  const num = Number(value);
  return isNaN(num) ? null : num;
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
    return result?.data ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * Real neighbourhood feed: questions, help requests and shops straight from Supabase.
 * Every query is defensive, so a missing column or table degrades instead of breaking.
 */
export async function loadMapPins(limit = 220): Promise<MapPin[]> {
  const [questionRows, requestRows, businessRows, directoryRows, servicesRows] = await Promise.all([
    safeRows(() =>
      supabase.from('questions').select('*').order('created_at', { ascending: false }).limit(limit),
    ),
    safeRows(() =>
      supabase
        .from('requests')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(limit),
    ),
    safeRows(() =>
      supabase.from('businesses').select('*').not('latitude', 'is', null).limit(limit),
    ),
    safeRows(() =>
      supabase.from('business_directory').select('*').limit(limit),
    ),
    safeRows(() =>
      supabase.from('services').select('*').order('created_at', { ascending: false }).limit(limit),
    ),
  ]);

  const pins: MapPin[] = [];

  questionRows.forEach((row: any) => {
    if (row?.status === 'closed' || row?.is_hidden) return;
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
      price: toNumber(row.budget),
      phone: cleanText(row.phone, 30),
    });
  });

  const shops = [
    ...businessRows.map((row: any) => ({ row, table: 'businesses' })),
    ...directoryRows
      .filter((row: any) => !businessRows.some((b: any) => b.id === row?.id))
      .map((row: any) => ({ row, table: 'business_directory' })),
  ];

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
      isOpen: row.is_open_now != null ? Boolean(row.is_open_now) : true,
      urgent: false,
      rating: toNumber(row.rating),
      price: toNumber(row.price ?? row.budget),
      phone: cleanText(row.phone ?? row.contact_phone, 30),
    });
  });

  servicesRows.forEach((row: any) => {
    if (!row?.id) return;
    const position = resolvePinPosition(
      {
        id: `service-${row.id}`,
        city: row.city,
        district: row.district,
      },
      {},
      { blur: false },
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
      approximate: position.approximate,
      exact: !position.approximate,
      href: `/service?id=${row.id}`,
      createdAt: row.created_at || '',
      author: '',
      ownerId: row.provider_id || '',
      category: cleanText(row.subcategory || row.category || row.listing_type || 'خدمة', 40),
      verified: Boolean(row.is_verified),
      isOpen: row.available_now != null ? Boolean(row.available_now) : true,
      urgent: false,
      rating: null,
      price: toNumber(row.price_from),
      phone: cleanText(row.whatsapp, 30),
    });
  });

  const seen = new Set<string>();
  return pins.filter((pin) => {
    const key = `${pin.lat.toFixed(4)},${pin.lng.toFixed(4)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function filterPins(
  pins: MapPin[],
  options: { kind?: MapPinKind | 'all'; city?: string | null; query?: string },
): MapPin[] {
  const kind = options.kind ?? ALL_KINDS;
  const query = (options.query || '').trim().toLowerCase();
  const cityKey = options.city ? normalizeSaudiLocationName(options.city) : '';

  return pins.filter((pin) => {
    if (kind !== 'all' && pin.kind !== kind) return false;
    if (cityKey && normalizeSaudiLocationName(pin.city) !== cityKey) return false;
    if (!query) return true;
    const haystack = [pin.title, pin.body, pin.city, pin.district, pin.category, pin.author]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(query);
  });
}

/** Nearest pins first, with the walking distance filled in. */
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