/**
 * Neighbourhood-level privacy for public posts and map pins.
 *
 * Rule of the app: a question or a help request is always shown as "حي X".
 * The exact GPS fix is never published on a feed, a search result or a map pin.
 * Only the owner sees it, and only the owner can hand it over — in a private chat.
 */

export const ALL_DISTRICTS = [
  'كل الأحياء',
  'كل أحياء المدينة',
  'جميع الأحياء',
  'الكل',
];

export function isUnsetDistrict(value?: string | null): boolean {
  if (!value) return true;
  return ALL_DISTRICTS.includes(value.trim());
}

function clean(value?: string | null): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed || isUnsetDistrict(trimmed)) return '';
  return trimmed.replace(/^(حي|منطقة)\s+/i, '').trim();
}

/** Never returns an exact address: district at most, then city, then a neutral label. */
export function areaLabel(row?: {
  district?: string | null;
  city?: string | null;
}): string {
  const district = clean(row?.district);
  const city = clean(row?.city);
  if (district && city) return `${district} · ${city}`;
  if (district) return district;
  if (city) return `${city} · كل الأحياء`;
  return 'نطاق عام';
}

/** Short label for chips and dense rows. */
export function areaShortLabel(row?: { district?: string | null; city?: string | null }): string {
  const district = clean(row?.district);
  if (district) return `حي ${district}`;
  const city = clean(row?.city);
  if (city) return city;
  return 'نطاق عام';
}

export function isOwnPost(
  row: { author_id?: string | null; requester_id?: string | null },
  userId?: string | null,
): boolean {
  if (!userId) return false;
  return row.author_id === userId || row.requester_id === userId;
}

/** Deterministic 0..1 hash so a row always lands on the same privacy cell. */
function privacyOffset(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

/**
 * Snaps any coordinate onto a coarse grid so a public pin can never reveal the
 * building it came from. Cells are roughly 500 m, then nudged deterministically
 * so two posts in the same cell do not stack on one pixel.
 */
export function obfuscateCoordinate(
  lat: number,
  lng: number,
  seed: string,
): { lat: number; lng: number } {
  const CELL = 0.0045;
  const cellLat = Math.round(lat / CELL);
  const cellLng = Math.round(lng / CELL);
  const jitterLat = (privacyOffset(`${seed}:lat`) - 0.5) * CELL * 0.85;
  const jitterLng = (privacyOffset(`${seed}:lng`) - 0.5) * CELL * 1.2;
  return {
    lat: Number((cellLat * CELL + jitterLat).toFixed(5)),
    lng: Number((cellLng * CELL + jitterLng).toFixed(5)),
  };
}

/** Distance in metres between two coordinates. */
export function distanceMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return Math.round(2 * R * Math.asin(Math.min(1, Math.sqrt(h))));
}

export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '';
  if (meters < 950) return `${meters} م`;
  if (meters < 10000) return `${(meters / 1000).toFixed(1)} كم`;
  return `${Math.round(meters / 1000)} كم`;
}

/** Maps link that opens straight in turn-by-turn navigation. */
export function navigationUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}