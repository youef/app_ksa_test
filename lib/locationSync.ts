import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';

export interface HaynaLocation {
  region: string;
  city: string;
  district: string;
}

const STORAGE_KEY = '@hayna_active_location_v2';

let cachedLocation: HaynaLocation = {
  region: 'كل المملكة',
  city: 'كل المدن',
  district: 'كل الأحياء',
};

type LocationListener = (loc: HaynaLocation) => void;
const listeners = new Set<LocationListener>();

export function isAllKingdom(city?: string | null): boolean {
  if (!city) return true;
  const c = city.trim();
  return c === '' || c === 'كل المدن' || c === 'كل المملكة' || c === 'الكل' || c === 'جميع المدن';
}

function normalizeLoc(str?: string | null): string {
  if (!str) return '';
  return str
    .trim()
    .replace(/^(مدينة|حي|منطقة)\s+/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة\b/g, 'ه')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * Strict location filter:
 * 1. If All Kingdom is selected, returns true.
 * 2. If a specific city is selected, items without a city are strictly excluded.
 * 3. If a specific district is selected, items without a district or with a different district are excluded.
 */
export function isLocationMatching(
  item: { city?: string | null; district?: string | null },
  activeCity: string,
  activeDistrict: string
): boolean {
  if (isAllKingdom(activeCity)) {
    return true;
  }

  // Must have a city
  if (!item.city || !item.city.trim()) {
    return false;
  }

  const itemC = normalizeLoc(item.city);
  const actC = normalizeLoc(activeCity);

  if (!itemC.includes(actC) && !actC.includes(itemC)) {
    return false;
  }

  // District filter
  if (
    activeDistrict &&
    activeDistrict !== 'كل الأحياء' &&
    activeDistrict !== 'كل أحياء المدينة' &&
    activeDistrict !== 'جميع الأحياء'
  ) {
    if (!item.district || !item.district.trim()) {
      return false;
    }
    const itemD = normalizeLoc(item.district);
    const actD = normalizeLoc(activeDistrict);
    if (!itemD.includes(actD) && !actD.includes(itemD)) {
      return false;
    }
  }

  return true;
}

/** Privacy gate: only records with a complete exact city + district match are visible. */
export function isExactDistrictMatching(
  item: { city?: string | null; district?: string | null },
  activeCity: string,
  activeDistrict: string
): boolean {
  if (isAllKingdom(activeCity) || !activeDistrict || ['كل الأحياء', 'كل أحياء المدينة', 'جميع الأحياء', 'الكل'].includes(activeDistrict.trim())) return false;
  return normalizeLoc(item.city) === normalizeLoc(activeCity) &&
    normalizeLoc(item.district) === normalizeLoc(activeDistrict);
}

export const PERMANENT_MY_LOCATION_KEY = '@hayna_permanent_my_location';

/**
 * Retrieve permanent user location (survives logout and app restarts)
 */
export async function getPermanentMyLocation(): Promise<HaynaLocation> {
  // 1. Try permanent storage key
  try {
    const raw = await AsyncStorage.getItem(PERMANENT_MY_LOCATION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.city && !isAllKingdom(parsed.city)) {
        cachedLocation = parsed;
        return parsed;
      }
    }
  } catch {}

  // 2. Try active location storage
  try {
    const rawActive = await AsyncStorage.getItem(STORAGE_KEY);
    if (rawActive) {
      const parsed = JSON.parse(rawActive);
      if (parsed && parsed.city && !isAllKingdom(parsed.city)) {
        await AsyncStorage.setItem(PERMANENT_MY_LOCATION_KEY, JSON.stringify(parsed));
        cachedLocation = parsed;
        return parsed;
      }
    }
  } catch {}

  // 3. Check user profile if logged in
  try {
    const { data: u } = await supabase.auth.getUser();
    if (u?.user) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('region, city, district')
        .eq('id', u.user.id)
        .maybeSingle();
      if (prof?.city && !isAllKingdom(prof.city)) {
        const loc: HaynaLocation = {
          region: prof.region?.trim() || 'المملكة',
          city: prof.city.trim(),
          district: prof.district?.trim() || 'كل الأحياء',
        };
        cachedLocation = loc;
        await AsyncStorage.setItem(PERMANENT_MY_LOCATION_KEY, JSON.stringify(loc));
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
        return loc;
      }
    }
  } catch {}

  return cachedLocation;
}

/**
 * Save permanent user location across logout and update global state
 */
export async function savePermanentMyLocation(
  loc: {
    region?: string | null;
    city?: string | null;
    district?: string | null;
  },
  syncRemote = true
): Promise<void> {
  const current = await getPermanentMyLocation();
  const updated: HaynaLocation = {
    region: loc.region || current?.region || 'المملكة',
    city: loc.city || current?.city || 'كل المدن',
    district: loc.district || current?.district || 'كل الأحياء',
  };

  try {
    await AsyncStorage.setItem(PERMANENT_MY_LOCATION_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Failed to save permanent location:', e);
  }

  // Update active location cache and notify listeners
  await setActiveLocation(updated.region, updated.city, updated.district, syncRemote);
}

/**
 * Retrieve current location (from memory or storage, falling back to permanent storage and profile)
 */
export async function getActiveLocation(): Promise<HaynaLocation> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.city) {
        cachedLocation = parsed;
        return cachedLocation;
      }
    }
  } catch {
    // fallback
  }

  // If active location not found, try permanent location
  try {
    const perm = await getPermanentMyLocation();
    if (perm && perm.city && !isAllKingdom(perm.city)) {
      cachedLocation = perm;
      return cachedLocation;
    }
  } catch {}

  return cachedLocation;
}

/**
 * Update location globally across the app and sync with user's profile
 */
export async function setActiveLocation(
  region: string,
  city: string,
  district: string,
  syncRemote = true
): Promise<void> {
  cachedLocation = {
    region: region || 'كل المملكة',
    city: city || 'كل المدن',
    district: district || 'كل الأحياء',
  };

  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cachedLocation));
    if (city && !isAllKingdom(city)) {
      await AsyncStorage.setItem(PERMANENT_MY_LOCATION_KEY, JSON.stringify(cachedLocation));
    }
  } catch {
    // ignore
  }

  // Sync to Supabase profile if logged in
  if (syncRemote) {
    try {
      const { data: u } = await supabase.auth.getUser();
      if (u?.user) {
        const updatePayload: any = {};
        if (isAllKingdom(city)) {
          updatePayload.region = null;
          updatePayload.city = null;
          updatePayload.district = null;
        } else {
          updatePayload.region = region?.trim() || null;
          updatePayload.city = city.trim();
          updatePayload.district = (district && district !== 'كل الأحياء' && district !== 'كل أحياء المدينة')
            ? district.trim()
            : null;
        }
        const { data: updatedProfile, error } = await supabase
          .from('profiles')
          .update(updatePayload)
          .eq('id', u.user.id)
          .select('id, region, city, district')
          .maybeSingle();
        if (error) throw error;
        if (!updatedProfile) throw new Error('لم يتم تحديث موقع الحساب في Supabase.');
      }
    } catch (e) {
      console.warn('Failed to sync location to profile:', e);
      throw e;
    }
  }

  // Notify all active screen listeners
  listeners.forEach((fn) => {
    try {
      fn(cachedLocation);
    } catch (e) {
      console.error('Error notifying location listener:', e);
    }
  });
}

/**
 * Subscribe to location changes
 */
export function subscribeLocation(listener: LocationListener): () => void {
  listeners.add(listener);
  // Call immediately with current cache
  listener(cachedLocation);
  return () => {
    listeners.delete(listener);
  };
}
