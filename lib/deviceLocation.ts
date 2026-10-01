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
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
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

function stripPrefix(value?: string) {
  return (value || '').replace(/^(حي|مدينة|منطقة)\s+/, '').trim();
}

async function reverseGeocodeWeb(location: DeviceLocation) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&accept-language=ar&lat=${location.latitude}&lon=${location.longitude}`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const json = await res.json();
    const a = json?.address || {};
    const city = stripPrefix(a.city || a.town || a.village || a.county);
    if (!city) return null;
    return {
      region: stripPrefix(a.state || a.region),
      city,
      district: stripPrefix(a.suburb || a.neighbourhood || a.quarter || a.city_district || a.residential),
    };
  } catch (error) { console.warn('reverseGeocodeWeb error', error); return null; }
}

export async function reverseGeocodeDeviceLocation(location: DeviceLocation) {
  if (Platform.OS === 'web') return reverseGeocodeWeb(location);
  try {
    const rows = await Location.reverseGeocodeAsync({ latitude: location.latitude, longitude: location.longitude });
    const place = rows[0];
    if (!place) return null;
    return { region: place.region || place.subregion || '', city: place.city || place.subregion || '', district: place.district || place.name || '' };
  } catch (error) { console.warn('reverseGeocodeDeviceLocation error', error); return null; }
}
