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
  try {
    if (Platform.OS === 'web') {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(location.latitude)}&lon=${encodeURIComponent(location.longitude)}&zoom=18&addressdetails=1&accept-language=ar`;
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!response.ok) return null;
      const data = await response.json();
      const a = data?.address || {};
      const region = a.state || a.region || a.province || a.state_district || '';
      const city = a.city || a.town || a.village || a.municipality || a.county || a.city_district || '';
      const district =
        a.neighbourhood ||
        a.suburb ||
        a.quarter ||
        a.city_district ||
        a.residential ||
        a.hamlet ||
        '';
      return { region, city, district };
    }

    const rows = await Location.reverseGeocodeAsync({ latitude: location.latitude, longitude: location.longitude });
    const place: any = rows[0];
    if (!place) return null;
    const region = place.region || place.subregion || '';
    const city = place.city || place.subregion || place.district || '';
    const district = place.district || place.suburb || place.name || '';
    return { region, city, district };
  } catch (error) {
    console.warn('reverseGeocodeDeviceLocation error', error);
    return null;
  }
}
