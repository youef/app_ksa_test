import { SAUDI_REGIONS, normalizeSaudiLocationName } from '@/lib/saudiLocations';
import { supabase } from '@/lib/supabase';

export interface CurrentWeather {
  temperature: number;
  apparentTemperature: number;
  relativeHumidity: number;
  precipitation: number;
  windSpeed: number;
  weatherCode: number;
  isDay: boolean;
  locationName: string;
  observedAt: string;
}

interface Coordinates {
  latitude: number;
  longitude: number;
  locationName: string;
}

interface GeocodingResult {
  name: string;
  latitude: number;
  longitude: number;
  country_code?: string;
  admin1?: string;
}

const WEATHER_CACHE_MS = 10 * 60 * 1000;
const weatherCache = new Map<string, { expiresAt: number; value: CurrentWeather }>();

function withoutCityPrefix(value: string): string {
  return value.trim().replace(/^(مدينة|محافظة)\s+/u, '');
}

async function findCustomCoordinates(regionName: string, cityName: string, districtName: string): Promise<Coordinates | null> {
  const { data, error } = await supabase
    .from('saudi_custom_locations')
    .select('region_name, city_name, district_name, latitude, longitude')
    .limit(2000);

  if (error || !data) return null;
  const key = normalizeSaudiLocationName;
  const matches = data.filter((location: any) =>
    key(location.region_name) === key(regionName) &&
    key(location.city_name || '') === key(cityName) &&
    (!location.district_name || key(location.district_name) === key(districtName)),
  );
  const exactDistrict = matches.find((location: any) => location.district_name && key(location.district_name) === key(districtName));
  const city = exactDistrict || matches.find((location: any) => location.city_name && !location.district_name);
  const region = matches.find((location: any) => !location.city_name && !location.district_name);
  const selected = city || region;
  if (selected?.latitude !== null && selected?.latitude !== undefined && selected?.longitude !== null && selected?.longitude !== undefined) {
    return {
      latitude: Number(selected.latitude),
      longitude: Number(selected.longitude),
      locationName: exactDistrict && selected === exactDistrict ? districtName : cityName || regionName,
    };
  }
  return null;
}

async function resolveCoordinates(regionName: string, cityName: string, districtName: string): Promise<Coordinates | null> {
  const custom = await findCustomCoordinates(regionName, cityName, districtName);
  if (custom) return custom;

  const region = SAUDI_REGIONS.find(item => normalizeSaudiLocationName(item.name) === normalizeSaudiLocationName(regionName));
  if (cityName && cityName !== 'كل المدن') {
    const city = region?.cities.find(item => normalizeSaudiLocationName(item.name) === normalizeSaudiLocationName(cityName));
    const district = city?.districts.find(item => normalizeSaudiLocationName(item.name) === normalizeSaudiLocationName(districtName));
    if (district?.lat !== undefined && district?.lng !== undefined) {
      return { latitude: district.lat, longitude: district.lng, locationName: districtName };
    }
    if (districtName && districtName !== 'كل الأحياء') {
      const districtQuery = new URLSearchParams({ name: `${withoutCityPrefix(districtName)}, ${withoutCityPrefix(cityName)}, Saudi Arabia`, count: '10', language: 'ar', countryCode: 'SA' });
      const districtResponse = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${districtQuery.toString()}`);
      if (districtResponse.ok) {
        const districtBody = await districtResponse.json();
        const districtResults = (districtBody.results || []) as GeocodingResult[];
        const districtKey = normalizeSaudiLocationName(withoutCityPrefix(districtName));
        const districtResult = districtResults.find(item => item.country_code === 'SA' && normalizeSaudiLocationName(item.name) === districtKey);
        if (districtResult) return { latitude: districtResult.latitude, longitude: districtResult.longitude, locationName: districtName };
      }
    }

    if (city?.lat !== undefined && city?.lng !== undefined) {
      return { latitude: city.lat, longitude: city.lng, locationName: cityName };
    }

    const query = new URLSearchParams({ name: `${withoutCityPrefix(cityName)}, Saudi Arabia`, count: '10', language: 'ar', countryCode: 'SA' });
    const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${query.toString()}`);
    if (response.ok) {
      const body = await response.json();
      const results = (body.results || []) as GeocodingResult[];
      const cityKey = normalizeSaudiLocationName(withoutCityPrefix(cityName));
      const regionKey = normalizeSaudiLocationName(regionName);
      const selected = results.find(item => normalizeSaudiLocationName(item.name) === cityKey && (!item.admin1 || normalizeSaudiLocationName(item.admin1).includes(regionKey.replace(/^منطقة\s*/u, ''))))
        || results.find(item => normalizeSaudiLocationName(item.name) === cityKey)
        || results[0];
      if (selected && selected.country_code === 'SA') {
        return { latitude: selected.latitude, longitude: selected.longitude, locationName: selected.name };
      }
    }
  }

  if (region && region.lat > 0 && region.lng > 0) {
    return { latitude: region.lat, longitude: region.lng, locationName: regionName };
  }
  return null;
}

export async function loadCurrentWeather(region: string, city: string, district: string): Promise<CurrentWeather | null> {
  const coordinates = await resolveCoordinates(region, city, district);
  if (!coordinates) return null;

  const cacheKey = `${coordinates.latitude.toFixed(3)},${coordinates.longitude.toFixed(3)}`;
  const cached = weatherCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const query = new URLSearchParams({
    latitude: String(coordinates.latitude),
    longitude: String(coordinates.longitude),
    current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m',
    timezone: 'auto',
    forecast_days: '1',
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${query.toString()}`);
  if (!response.ok) throw new Error(`Weather service returned ${response.status}`);
  const body = await response.json();
  const current = body.current;
  if (!current || typeof current.temperature_2m !== 'number') return null;

  const result: CurrentWeather = {
    temperature: current.temperature_2m,
    apparentTemperature: current.apparent_temperature,
    relativeHumidity: current.relative_humidity_2m,
    precipitation: current.precipitation,
    windSpeed: current.wind_speed_10m,
    weatherCode: current.weather_code,
    isDay: current.is_day === 1,
    locationName: coordinates.locationName,
    observedAt: current.time,
  };
  weatherCache.set(cacheKey, { expiresAt: Date.now() + WEATHER_CACHE_MS, value: result });
  return result;
}

export function describeWeatherCode(code: number): string {
  if (code === 0) return 'صافٍ';
  if (code === 1) return 'غائم جزئياً';
  if (code === 2) return 'غائم جزئياً';
  if (code === 3) return 'غائم';
  if (code === 45 || code === 48) return 'ضباب';
  if (code >= 51 && code <= 57) return 'رذاذ';
  if (code >= 61 && code <= 67) return 'أمطار';
  if (code >= 71 && code <= 77) return 'ثلوج';
  if (code >= 80 && code <= 82) return 'زخات مطر';
  if (code >= 85 && code <= 86) return 'زخات ثلج';
  if (code >= 95) return 'عواصف رعدية';
  return 'الطقس الحالي';
}
