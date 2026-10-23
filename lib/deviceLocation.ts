import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { isInsideSaudiArabia, isKnownSaudiCity } from '@/lib/saudiLocations';

export interface DeviceLocation { latitude: number; longitude: number; accuracy?: number | null; }
export interface GeocodedDeviceLocation {
  region: string;
  city: string;
  district: string;
  isOutsideKSA?: boolean;
}

const KEY = '@hayna_device_location_v1';

export async function getCurrentDeviceLocation(): Promise<DeviceLocation | null> {
  try {
    if (Platform.OS === 'web') {
      if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
      return await new Promise((resolve) => navigator.geolocation.getCurrentPosition(
        (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 25000, maximumAge: 0 },
      ));
    }
    const current = await Location.getForegroundPermissionsAsync();
    const permission = current.granted ? current : await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return null;
    const result = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
    const location = { latitude: result.coords.latitude, longitude: result.coords.longitude, accuracy: result.coords.accuracy };
    await AsyncStorage.setItem(KEY, JSON.stringify(location));
    return location;
  } catch (error) { console.warn('getCurrentDeviceLocation error', error); return null; }
}

export async function reverseGeocodeDeviceLocation(location: DeviceLocation): Promise<GeocodedDeviceLocation | null> {
  // 1. Strict Saudi Arabia geographic bounding box check
  if (!isInsideSaudiArabia(location.latitude, location.longitude)) {
    return {
      region: '',
      city: '',
      district: '',
      isOutsideKSA: true,
    };
  }

  const clean = (value: unknown) => typeof value === 'string' ? value.trim() : '';
  const pick = (...values: unknown[]) => values.map(clean).find(Boolean) || '';
  const cleanNeighborhood = (value: unknown) => {
    const name = clean(value);
    // Geocoder administrative/continental labels are not residential neighborhoods.
    if (!name || /^(آسيا|asia|asia\/riyadh|السعودية|المملكة العربية السعودية|منطقة الحدود الشمالية|northern borders|saudi arabia)$/i.test(name)) return '';
    return name;
  };
  const pickNeighborhood = (...values: unknown[]) => values.map(cleanNeighborhood).find(Boolean) || '';

  try {
    if (Platform.OS === 'web') {
      const nominatim = fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(location.latitude)}&lon=${encodeURIComponent(location.longitude)}&zoom=18&addressdetails=1&accept-language=ar`,
        { headers: { Accept: 'application/json' } },
      ).then(async (r) => r.ok ? r.json() : null).catch(() => null);

      const arcgis = fetch(
        `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode?location=${encodeURIComponent(location.longitude)},${encodeURIComponent(location.latitude)}&distance=100&f=json&langCode=ARA`,
        { headers: { Accept: 'application/json' } },
      ).then(async (r) => r.ok ? r.json() : null).catch(() => null);

      const [nData, aData] = await Promise.all([nominatim, arcgis]);
      const na = nData?.address || {};
      const aa = aData?.address || {};

      // Country verification
      const countryCode = String(na.country_code || aa.CountryCode || '').toLowerCase();
      if (countryCode && countryCode !== 'sa' && countryCode !== 'sau') {
        return { region: '', city: '', district: '', isOutsideKSA: true };
      }

      const region = pick(
        na.state, na.region, na.province, na.state_district,
        aa.Region, aa.RegionAbbr,
      );
      const city = pick(
        na.city, na.town, na.village, na.municipality, aa.City, aa.Subregion,
      );
      const district = pickNeighborhood(
        na.neighbourhood, na.suburb, na.quarter, na.residential,
        na.city_district, aa.Neighborhood,
      );

      if (city && !isKnownSaudiCity(city)) {
        return { region: '', city: '', district: '', isOutsideKSA: true };
      }

      return {
        region,
        city,
        district,
        isOutsideKSA: false,
      };
    }

    const rows = await Location.reverseGeocodeAsync({
      latitude: location.latitude,
      longitude: location.longitude,
    });
    const place: any = rows[0];
    if (!place) return null;

    const iso = String(place.isoCountryCode || '').toUpperCase();
    if (iso && iso !== 'SA') {
      return { region: '', city: '', district: '', isOutsideKSA: true };
    }

    // Keep administrative levels separate: a street or landmark is not a neighborhood.
    let region = pick(place.region);
    let city = pick(place.city, place.subregion);
    let district = pickNeighborhood(place.district, place.suburb);

    // Native reverse geocoders often return a street/landmark instead of a
    // neighborhood. Ask two address providers for administrative neighborhood
    // data when the device result is incomplete; never treat a street as a district.
    if (!region || !city || !district) {
      const [nData, aData] = await Promise.all([
        fetch(
          `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(location.latitude)}&lon=${encodeURIComponent(location.longitude)}&zoom=18&addressdetails=1&accept-language=ar`,
          { headers: { Accept: 'application/json' } },
        ).then(async (r) => r.ok ? r.json() : null).catch(() => null),
        fetch(
          `https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode?location=${encodeURIComponent(location.longitude)},${encodeURIComponent(location.latitude)}&distance=100&f=json&langCode=ARA`,
          { headers: { Accept: 'application/json' } },
        ).then(async (r) => r.ok ? r.json() : null).catch(() => null),
      ]);
      const na = nData?.address || {};
      const aa = aData?.address || {};
      const countryCode = String(na.country_code || aa.CountryCode || '').toLowerCase();
      if (countryCode && countryCode !== 'sa' && countryCode !== 'sau') {
        return { region: '', city: '', district: '', isOutsideKSA: true };
      }
      region = region || pick(na.state, na.region, na.province, na.state_district, aa.Region);
      city = city || pick(na.city, na.town, na.village, na.municipality, aa.City, aa.Subregion);
      district = district || pickNeighborhood(
        na.neighbourhood, na.suburb, na.quarter, na.residential,
        na.city_district, aa.Neighborhood,
      );
    }

    if (city && !isKnownSaudiCity(city)) {
      return { region: '', city: '', district: '', isOutsideKSA: true };
    }

    return { region, city, district, isOutsideKSA: false };
  } catch (error) {
    console.warn('reverseGeocodeDeviceLocation error', error);
    return null;
  }
}
