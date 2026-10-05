/**
 * Nearby shops and services around the user, with the details a neighbour actually
 * needs: phone number, opening hours, rating and walking distance.
 *
 * Google Places (New) web service backs the search. Every request degrades to an empty
 * list on failure so the map never breaks because the API is unreachable.
 */

import { distanceMeters } from './privacy';

const PLACES_ENDPOINT = 'https://places.googleapis.com/v1/places:searchNearby';

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.primaryType',
  'places.primaryTypeDisplayName',
  'places.rating',
  'places.userRatingCount',
  'places.regularOpeningHours',
  'places.currentOpeningHours',
  'places.businessStatus',
].join(',');

export interface PlaceCategory {
  key: string;
  label: string;
  emoji: string;
  /** Google Places type used for the nearby search. */
  type: string;
  /** Extra keywords so Arabic searches hit the right shops. */
  keywords: string[];
}

export const PLACE_CATEGORIES: PlaceCategory[] = [
  { key: 'grocery', label: 'بقالة', emoji: '🛒', type: 'supermarket', keywords: ['بقالة', 'سوبرماركت', 'مول'] },
  { key: 'pharmacy', label: 'صيدلية', emoji: '💊', type: 'pharmacy', keywords: ['صيدلية', 'دواء'] },
  { key: 'clothing', label: 'ملابس', emoji: '👕', type: 'clothing_store', keywords: ['ملابس', 'كواي', 'أزياء'] },
  { key: 'salon', label: 'حلاق', emoji: '✂️', type: 'hair_care', keywords: ['حلاق', 'صالون', 'تصفيف'] },
  { key: 'hardware', label: 'أدوات سباكة', emoji: '🔧', type: 'hardware_store', keywords: ['سباكة', 'أدوات', 'حديد'] },
  { key: 'cafe', label: 'كافيه', emoji: '☕', type: 'cafe', keywords: ['كافيه', 'قهوة'] },
  { key: 'restaurant', label: 'مطعم', emoji: '🍽️', type: 'restaurant', keywords: ['مطعم', 'أكل'] },
  { key: 'laundry', label: 'مغسلة', emoji: '🧺', type: 'laundry', keywords: ['مغسلة', 'تنظيف', 'كي'] },
  { key: 'bakery', label: 'مخبز', emoji: '🥐', type: 'bakery', keywords: ['مخبز', 'حلويات'] },
  { key: 'market', label: 'سوق', emoji: '🏬', type: 'market', keywords: ['سوق', 'مركز تجاري'] },
];

export const ALL_PLACES_KEY = 'all';

export function findPlaceCategory(key?: string | null): PlaceCategory | null {
  if (!key) return null;
  return PLACE_CATEGORIES.find((entry) => entry.key === key) ?? null;
}

/** Maps a typed query onto a known category, or null for a free-text search. */
export function matchCategoryByText(text: string): PlaceCategory | null {
  const query = text.trim().toLowerCase();
  if (!query) return null;
  const direct = PLACE_CATEGORIES.find(
    (entry) => entry.key === query || entry.label === query,
  );
  if (direct) return direct;
  return (
    PLACE_CATEGORIES.find((entry) =>
      entry.keywords.some((keyword) => query.includes(keyword)),
    ) ?? null
  );
}

export interface NearbyPlace {
  id: string;
  name: string;
  categoryKey: string;
  categoryLabel: string;
  address: string;
  lat: number;
  lng: number;
  phone: string;
  rating: number | null;
  reviews: number;
  openNow: boolean | null;
  /** Human readable hours, e.g. "مفتوح · 10 ص – 11 م". */
  hoursText: string;
  distance: number;
  mapsUrl: string;
  permanent: boolean;
}

interface RawPlace {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  primaryType?: string;
  primaryTypeDisplayName?: { text?: string };
  rating?: number;
  userRatingCount?: number;
  businessStatus?: string;
  regularOpeningHours?: { weekdayDescriptions?: string[]; openNow?: boolean };
  currentOpeningHours?: { weekdayDescriptions?: string[]; openNow?: boolean };
}

const DAY_ORDER = [
  'الأحد',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
];

const DAY_ALIASES: Record<string, string> = {
  sunday: 'الأحد',
  monday: 'الإثنين',
  tuesday: 'الثلاثاء',
  wednesday: 'الأربعاء',
  thursday: 'الخميس',
  friday: 'الجمعة',
  saturday: 'السبت',
};

/** Turns "Monday: 9:00 AM – 10:00 PM" into "الإثنين: 9:00 ص – 10:00 م". */
function localizeDayDescription(raw: string): string {
  const [left, right] = raw.split(':');
  if (right === undefined) return raw;
  const day = (left || '').trim().toLowerCase();
  const localizedDay = DAY_ALIASES[day] ?? left.trim();
  return `${localizedDay}: ${right.trim()}`;
}

function parseHours(place: RawPlace): { openNow: boolean | null; hoursText: string } {
  const hours = place.currentOpeningHours ?? place.regularOpeningHours;
  if (!hours) return { openNow: null, hoursText: '' };
  const descriptions = (hours.weekdayDescriptions ?? [])
    .map(localizeDayDescription)
    .filter(Boolean);
  const today = descriptions.find((line) => line.startsWith(DAY_ORDER[new Date().getDay()]));
  const window = (today ?? descriptions[0] ?? '').split(':').slice(1).join(':').trim();
  const openNow = typeof hours.openNow === 'boolean' ? hours.openNow : null;
  const state = openNow === null ? '' : openNow ? 'مفتوح الآن' : 'مغلق حالياً';
  const parts = [state, window].filter(Boolean);
  return { openNow, hoursText: parts.join(' · ') };
}

function normalize(raw: RawPlace, category: PlaceCategory | null, origin: { lat: number; lng: number }): NearbyPlace | null {
  const lat = raw.location?.latitude;
  const lng = raw.location?.longitude;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  const { openNow, hoursText } = parseHours(raw);
  const name = raw.displayName?.text?.trim() || 'محل قريب';
  return {
    id: raw.id || `${lat}:${lng}:${name}`,
    name,
    categoryKey: category?.key || '',
    categoryLabel: category?.label || raw.primaryTypeDisplayName?.text?.trim() || 'محل',
    address: raw.formattedAddress?.trim() || '',
    lat,
    lng,
    phone: (raw.nationalPhoneNumber || raw.internationalPhoneNumber || '').trim(),
    rating: typeof raw.rating === 'number' ? raw.rating : null,
    reviews: typeof raw.userRatingCount === 'number' ? raw.userRatingCount : 0,
    openNow,
    hoursText,
    distance: distanceMeters(origin, { lat, lng }),
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}&query_place_id=${raw.id || ''}`,
    permanent: raw.businessStatus !== 'CLOSED_PERMANENTLY',
  };
}

function apiKey(): string {
  return (
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    'AIzaSyD3dbOJXEPgG1qyNi4Z_sLO46kj6c5bnY8'
  );
}

/**
 * Nearby places around a point. `category` narrows to one Place type, `text`
 * is an extra keyword so "بقالة مفتوحة" still finds grocery stores.
 */
export async function searchNearbyPlaces(options: {
  lat: number;
  lng: number;
  category?: string | null;
  text?: string | null;
  radiusMeters?: number;
  maxResults?: number;
}): Promise<NearbyPlace[]> {
  const {
    lat,
    lng,
    category,
    text,
    radiusMeters = 3000,
    maxResults = 25,
  } = options;

  const known = findPlaceCategory(category) ?? (text ? matchCategoryByText(text) : null);
  const keyword = (text || '').trim();

  const body: Record<string, unknown> = {
    includedTypes: known ? [known.type] : undefined,
    maxResultCount: Math.min(Math.max(maxResults, 1), 25),
    locationRestriction: {
      circle: { center: { latitude: lat, longitude: lng }, radius: Math.min(radiusMeters, 5000) },
    },
    languageCode: 'ar',
    regionCode: 'SA',
  };
  if (keyword) body.textQuery = keyword;

  try {
    const response = await fetch(PLACES_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey(),
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) return [];
    const payload = await response.json();
    const places: RawPlace[] = payload?.places ?? [];
    return places
      .map((raw) => normalize(raw, known, { lat, lng }))
      .filter((place): place is NearbyPlace => place !== null)
      .sort((a, b) => a.distance - b.distance);
  } catch (error) {
    console.warn('searchNearbyPlaces failed', error);
    return [];
  }
}

export function isOpenNowLabel(openNow: boolean | null): string {
  if (openNow === null) return '';
  return openNow ? 'مفتوح' : 'مغلق';
}

export function mapsUrlForPlace(place: NearbyPlace): string {
  return place.mapsUrl;
}