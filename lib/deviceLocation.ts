import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

export interface DeviceLocation { latitude: number; longitude: number; accuracy?: number | null; }
const KEY = '@hayna_device_location_v1';

export async function getCurrentDeviceLocation(): Promise<DeviceLocation | null> {
  try {
    if (Platform.OS === 'web') {
      if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
      return await new Promise((resolve) => navigator.geolocation.getCurrentPosition(
        (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy }),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
      ));
    }
    const current = await Location.getForegroundPermissionsAsync();
    const permission = current.granted ? current : await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return null;
    const result = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const location = { latitude: result.coords.latitude, longitude: result.coords.longitude, accuracy: result.coords.accuracy };
    await AsyncStorage.setItem(KEY, JSON.stringify(location));
    return location;
  } catch (error) { console.warn('getCurrentDeviceLocation error', error); return null; }
}

export async function reverseGeocodeDeviceLocation(location: DeviceLocation) {
  const clean = (value: unknown) => typeof value === 'string' ? value.trim() : '';
  const pick = (...values: unknown[]) => values.map(clean).find(Boolean) || '';

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

      const region = pick(
        na.state, na.region, na.province, na.state_district,
        aa.Region, aa.RegionAbbr,
      );
      const city = pick(
        na.city, na.town, na.village, na.municipality, aa.City, aa.Subregion,
      );
      const district = pick(
        na.neighbourhood, na.suburb, na.quarter, na.residential, na.hamlet,
        na.city_district, na.district, aa.Neighborhood, aa.District,
      );

      return {
        region,
        city,
        district,
      };
    }

    const rows = await Location.reverseGeocodeAsync({
      latitude: location.latitude,
      longitude: location.longitude,
    });
    const place: any = rows[0];
    if (!place) return null;
    const region = pick(place.region, place.subregion);
    const city = pick(place.city, place.subregion, place.district);
    const district = pick(place.district, place.suburb, place.name, place.street);
    return { region, city, district };
  } catch (error) {
    console.warn('reverseGeocodeDeviceLocation error', error);
    return null;
  }
}
