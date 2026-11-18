import { OasisPressable as Pressable, OasisTextInput as TextInput, OasisSurface } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, ActivityIndicator, RefreshControl, Alert, Linking } from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { AppHeader } from '@/components/shared/AppHeader';
import {
  ChevronRight,
  ChevronDown,
  ChevronUp,
  MapPin,
  RefreshCw,
  Search,
  Sun,
  Cloud,
  CloudSun,
  CloudFog,
  CloudRain,
  Wind,
  Droplets,
  Thermometer,
  Waves,
  Sunrise,
  Sunset,
  Gauge,
  Activity,
  Info,
  Compass,
  Navigation,
  Umbrella,
  Eye,
  TriangleAlert,
  HeartPulse,
  Satellite,
  Megaphone,
  Bell,
  Send,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useBottomNavInset } from '@/lib/bottomNav';
import { sendPushToMultipleUsers } from '@/lib/pushSender';
import { getActiveLocation } from '@/lib/locationSync';
import { SAUDI_WEATHER_REGIONS, SAUDI_WEATHER_CITIES, findSaudiWeatherCity, saudiWeatherTimeKey, formatSaudiWeatherTime } from '@/lib/saudiWeather';

// Short-lived in-memory cache keeps switching between cities instant without persisting coordinates.
const WEATHER_CACHE_TTL_MS = 10 * 60 * 1000;
const weatherCache = new Map<string, { data: WeatherData; fetchedAt: number }>();

type WeatherData = {
  city: string;
  region: string;
  district: string;
  latitude: number;
  longitude: number;
  current: any;
  hourly: any;
  minute?: any;
  daily: any;
  air?: any | null;
};

function weatherDescription(code: number) {
  if (code === 0) return 'سماء صافية';
  if ([1, 2].includes(code)) return 'غائم جزئياً';
  if (code === 3) return 'غائم';
  if ([45, 48].includes(code)) return 'ضباب';
  if ([51, 53, 55, 56, 57].includes(code)) return 'رذاذ';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'أمطار';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'ثلوج';
  if ([95, 96, 99].includes(code)) return 'عواصف رعدية';
  return 'حالة جوية متغيرة';
}

function WeatherGlyph({ code, size = 28, color = '#d97706' }: { code: number; size?: number; color?: string }) {
  if (code === 0) return <Sun size={size} color={color} />;
  if ([1, 2].includes(code)) return <CloudSun size={size} color={color} />;
  if ([45, 48].includes(code)) return <CloudFog size={size} color={color} />;
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code)) return <CloudRain size={size} color={color} />;
  return <Cloud size={size} color={color} />;
}

function windDir(deg?: number) {
  if (deg == null) return '';
  const dirs = ['شمال', 'شمال شرق', 'شرق', 'جنوب شرق', 'جنوب', 'جنوب غرب', 'غرب', 'شمال غرب'];
  return dirs[Math.round(((deg % 360) / 45)) % 8];
}

async function reverseGeocode(latitude: number, longitude: number): Promise<{ region: string; city: string; district: string } | null> {
  try {
    const response = await fetch('https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=' + latitude + '&longitude=' + longitude + '&localityLanguage=ar');
    if (!response.ok) return null;
    const data = await response.json();
    const admin: any[] = data?.localityInfo?.administrative || [];
    const pick = (re: RegExp) => {
      const hit = admin.find((a) => re.test(String(a?.description || '') + ' ' + String(a?.name || '')));
      return hit?.name || '';
    };
    const region = data?.principalSubdivision || pick(/region|governorate|state|منطقة/i);
    const city = data?.city || data?.locality || pick(/city|town|village|municipality|مدينة|بلدية/i);
    const adminNames = admin.map((a) => a?.name).filter(Boolean);
    const lastAdmin = adminNames.length ? adminNames[adminNames.length - 1] : '';
    let district = '';
    const districtHit = [...admin].reverse().find((a) => /suburb|district|neighbourhood|neighborhood|quarter|حي|ضاحية/i.test(String(a?.description || '') + ' ' + String(a?.name || '')));
    if (districtHit?.name) district = districtHit.name;
    else if (lastAdmin && lastAdmin !== city && lastAdmin !== region && lastAdmin !== data?.countryName) district = lastAdmin;
    if (!district && data?.locality && data.locality !== city) district = data.locality;
    return { region: region || '', city: city || '', district };
  } catch {
    return null;
  }
}

async function resolvePlace(latitude: number, longitude: number): Promise<{ region: string; city: string; district: string }> {
  let region = '';
  let city = '';
  let district = '';
  // Native device geocoder (best on iOS/Android)
  try {
    const addresses = await Location.reverseGeocodeAsync({ latitude, longitude });
    const a: any = addresses && addresses[0];
    if (a) {
      region = a.region || a.subregion || '';
      city = a.city || a.subregion || a.district || a.name || '';
      district = a.district || a.name || '';
    }
  } catch {}
  // BigDataCloud (works on web too, Arabic names)
  const bdc = await reverseGeocode(latitude, longitude);
  if (bdc) {
    region = bdc.region || region;
    city = bdc.city || city;
    district = bdc.district || district;
  }
  // OpenStreetMap Nominatim for neighborhood granularity
  if (!district) {
    try {
      const response = await fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=ar&addressdetails=1&zoom=18&lat=' + latitude + '&lon=' + longitude);
      if (response.ok) {
        const data = await response.json();
        const address = data?.address || {};
        district = address.suburb || address.neighbourhood || address.quarter || address.city_district || address.hamlet || district;
        if (!city) city = address.city || address.town || address.village || address.municipality || '';
        if (!region) region = address.state || address.region || '';
      }
    } catch {}
  }
  return { region: region || '', city: city || '', district: district || '' };
}

function aqiInfo(aqi?: number | null) {
  const value = aqi ?? 0;
  if (value <= 50) return { label: 'هواء نظيف', color: OASIS.colors.primary, bg: '#dcfce7', bar: OASIS.colors.primary };
  if (value <= 100) return { label: 'هواء مقبول', color: '#b45309', bg: '#fef3c7', bar: OASIS.colors.warning };
  if (value <= 150) return { label: 'غير صحي للفئات الحساسة', color: '#c2410c', bg: '#ffedd5', bar: '#f97316' };
  if (value <= 200) return { label: 'غير صحي', color: OASIS.colors.danger, bg: '#fee2e2', bar: OASIS.colors.danger };
  return { label: 'ضار بالصحة', color: '#7f1d1d', bg: '#fecaca', bar: OASIS.colors.danger };
}

function formatClock(value?: string | null) { return formatSaudiWeatherTime(value); }

function round(value: any): string {
  return value == null || Number.isNaN(Number(value)) ? '--' : String(Math.round(Number(value)));
}

type WeatherAlert = { id: string; severity: 'danger' | 'warning' | 'info'; icon: string; title: string; message: string };

function buildAlerts(weather: WeatherData | null): WeatherAlert[] {
  if (!weather) return [];
  const alerts: WeatherAlert[] = [];
  const cur = weather.current || {};
  const day = weather.daily || {};
  const air = weather.air || {};
  const temp = Number(cur.temperature_2m);
  const feels = Number(cur.apparent_temperature);
  const wind = Number(cur.wind_speed_10m);
  const gusts = Number(cur.wind_gusts_10m);
  const uv = Number(day.uv_index_max?.[0]);
  const rainProb = Number(day.precipitation_probability_max?.[0]);
  const rainSum = Number(day.precipitation_sum?.[0]);
  const nowRain = Number(cur.precipitation);
  const dust = Number(air.dust);
  const pm25 = Number(air.pm2_5);
  const pm10 = Number(air.pm10);
  const aqi = Number(air.us_aqi);

  if (Number.isFinite(temp) && (temp >= 45 || feels >= 48)) alerts.push({ id: 'heat', severity: 'danger', icon: 'heat', title: 'موجة حر شديدة', message: 'تجنّب التعرّض المباشر للشمس، واشرب الماء بكثرة، وابقَ في أماكن مبرّدة.' });
  else if (Number.isFinite(temp) && (temp >= 42 || feels >= 45)) alerts.push({ id: 'heat', severity: 'warning', icon: 'heat', title: 'حرارة مرتفعة جداً', message: 'قلّل الأنشطة الخارجية وقت الظهيرة.' });
  else if (Number.isFinite(temp) && temp >= 38) alerts.push({ id: 'heat', severity: 'info', icon: 'heat', title: 'أجواء حارة', message: 'خذ قسطاً من الراحة في الظل واشرب الماء.' });

  if (nowRain >= 5 || rainSum >= 40) alerts.push({ id: 'rain', severity: 'danger', icon: 'rain', title: 'هطول كثيف متوقع من النموذج', message: 'احتمال تجمّع المياه؛ تجنّب الأودية والمناطق المنخفضة.' });
  else if (rainProb >= 60 || rainSum >= 5) alerts.push({ id: 'rain', severity: 'warning', icon: 'rain', title: 'احتمال هطول قوي', message: 'خذ مظلتك وتابع تحديثات الطقس.' });
  else if (rainProb >= 40 || nowRain > 0) alerts.push({ id: 'rain', severity: 'info', icon: 'rain', title: 'احتمال هطول', message: 'قد تظهر أمطار متفرقة.' });

  if (wind >= 45 || gusts >= 65) alerts.push({ id: 'wind', severity: 'danger', icon: 'wind', title: 'رياح شديدة', message: 'احذر أثناء القيادة وثبّت الأجسام الخفيفة.' });
  else if (wind >= 30 || gusts >= 45) alerts.push({ id: 'wind', severity: 'warning', icon: 'wind', title: 'رياح نشطة', message: 'توخّ الحذر، خصوصاً على الطرق المفتوحة.' });

  if ((Number.isFinite(dust) && dust >= 200) || (Number.isFinite(pm10) && pm10 >= 300) || (Number.isFinite(aqi) && aqi >= 150)) alerts.push({ id: 'dust', severity: 'danger', icon: 'dust', title: 'غبار كثيف / هواء غير صحي', message: 'أبقِ النوافذ مغلقة، شغّل أجهزة التنقية، وارتدِ كمامة عند الخروج.' });
  else if ((Number.isFinite(dust) && dust >= 100) || (Number.isFinite(pm10) && pm10 >= 150) || (Number.isFinite(aqi) && aqi >= 100)) alerts.push({ id: 'dust', severity: 'warning', icon: 'dust', title: 'تصاعد غبار / جودة هواء متأثرة', message: 'الفئات الحساسة يفضّل تقليل الأنشطة الخارجية.' });

  if (uv >= 11) alerts.push({ id: 'uv', severity: 'danger', icon: 'uv', title: 'أشعة فوق بنفسجية شديدة', message: 'تجنّب الشمس وقت الذروة واستخدم واقياً بمعامل عالٍ.' });
  else if (uv >= 8) alerts.push({ id: 'uv', severity: 'warning', icon: 'uv', title: 'أشعة فوق بنفسجية مرتفعة', message: 'استخدم واقي الشمس والقبعة.' });

  if ((Number.isFinite(pm25) && pm25 >= 35) || (Number.isFinite(dust) && dust >= 100)) alerts.push({ id: 'health', severity: 'info', icon: 'health', title: 'تنبيه لمن لديهم ربو أو حساسية', message: 'احمل بخّاخك وتجنّب الجهد الخارجي عند تدهور الهواء.' });

  if (!alerts.length) alerts.push({ id: 'ok', severity: 'info', icon: 'ok', title: 'لا مؤشرات جوية بارزة في النموذج', message: 'تقييم آلي وليس تأكيداً لعدم وجود إنذارات رسمية.' });
  return alerts;
}

function severityTheme(severity: string) {
  if (severity === 'danger') return { bg: OASIS.colors.dangerSoft, border: '#fecaca', text: '#991b1b', accent: OASIS.colors.danger, label: 'تحذير' };
  if (severity === 'warning') return { bg: '#fff7ed', border: '#fed7aa', text: '#9a3412', accent: '#ea580c', label: 'تنبيه' };
  return { bg: OASIS.colors.soft, border: '#a7f3d0', text: OASIS.colors.deep, accent: OASIS.colors.primary, label: 'معلومة' };
}

function AlertIcon({ kind, size, color }: { kind: string; size: number; color: string }) {
  if (kind === 'heat') return <Thermometer size={size} color={color} />;
  if (kind === 'rain') return <CloudRain size={size} color={color} />;
  if (kind === 'wind') return <Wind size={size} color={color} />;
  if (kind === 'dust') return <Waves size={size} color={color} />;
  if (kind === 'uv') return <Sun size={size} color={color} />;
  if (kind === 'health') return <HeartPulse size={size} color={color} />;
  if (kind === 'ok') return <CloudSun size={size} color={color} />;
  return <TriangleAlert size={size} color={color} />;
}

export default function WeatherScreen() {
  const bottomNavInset = useBottomNavInset();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [cityInput, setCityInput] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [sharing, setSharing] = useState(false);
  const [regionSelection, setRegionSelection] = useState('كل المناطق');
  const [viewHourCount, setViewHourCount] = useState<12 | 48>(12);
  const [cityPickerOpen, setCityPickerOpen] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [locationDetailsOpen, setLocationDetailsOpen] = useState(false);
  const [showAllDays, setShowAllDays] = useState(false);
  const [showExtraMetrics, setShowExtraMetrics] = useState(false);
  const [showOtherAlerts, setShowOtherAlerts] = useState(false);
  const [sourcesExpanded, setSourcesExpanded] = useState(false);
  const weatherRequestId = useRef(0);

  const fetchWeather = async (
    latitude: number, longitude: number,
    meta: { city: string; region: string; district: string },
    force = false,
  ) => {
    const requestId = ++weatherRequestId.current;
    const key = latitude.toFixed(3) + ':' + longitude.toFixed(3);
    const cached = weatherCache.get(key);
    if (!force && cached && Date.now() - cached.fetchedAt < WEATHER_CACHE_TTL_MS) {
      setWeather({ ...cached.data, ...meta, latitude, longitude });
      setLastUpdated(new Date(cached.fetchedAt));
      setError('');
      return;
    }

    const query = new URLSearchParams({
      latitude: String(latitude), longitude: String(longitude),
      timezone: 'Asia/Riyadh', forecast_days: '16',
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl,cloud_cover,visibility,dew_point_2m',
      hourly: 'temperature_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,relative_humidity_2m,visibility,uv_index',
      minutely_15: 'temperature_2m,precipitation,weather_code,wind_speed_10m',
      forecast_minutely_15: '24',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max',
    });

    // Air-quality requests are independent. Show forecast as soon as it arrives.
    const airPromise = fetch('https://air-quality-api.open-meteo.com/v1/air-quality?latitude=' + latitude + '&longitude=' + longitude + '&current=us_aqi,pm10,pm2_5,dust&timezone=Asia%2FRiyadh')
      .then(async response => response.ok ? (await response.json()).current || null : null)
      .catch(() => null);
    const response = await fetch('https://api.open-meteo.com/v1/forecast?' + query.toString());
    if (!response.ok) throw new Error('خدمة الطقس غير متاحة حالياً (' + response.status + ').');
    const data = await response.json();
    if (!data.current || !data.daily?.time?.length || !data.hourly?.time?.length) throw new Error('وصلت بيانات طقس غير مكتملة.');
    if (requestId !== weatherRequestId.current) return;

    const updatedAt = Date.now();
    const next: WeatherData = {
      city: meta.city || 'موقعك الحالي', region: meta.region || '', district: meta.district || '',
      latitude, longitude, current: data.current, hourly: data.hourly,
      minute: data.minutely_15 || null, daily: data.daily, air: cached?.data.air || null,
    };
    weatherCache.set(key, { data: next, fetchedAt: updatedAt });
    if (weatherCache.size > 16) weatherCache.delete(weatherCache.keys().next().value!);
    setWeather(next);
    setLastUpdated(new Date(updatedAt));
    setError('');

    void airPromise.then(air => {
      if (!air || requestId !== weatherRequestId.current) return;
      setWeather(previous => previous && previous.latitude === latitude && previous.longitude === longitude
        ? { ...previous, air } : previous);
      const entry = weatherCache.get(key);
      if (entry) weatherCache.set(key, { ...entry, data: { ...entry.data, air } });
    });
  };

  const loadWeatherForCity = async (cityName: string) => {
    const trimmed = cityName.trim();
    if (!trimmed) {
      setError('اكتب اسم المدينة أو فعّل موقع الجهاز لعرض الطقس.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const known = findSaudiWeatherCity(trimmed);
      if (known) {
        setRegionSelection(known.region);
        await fetchWeather(known.latitude, known.longitude, { city: known.name, region: known.region, district: '' });
      } else {
        const geoResponse = await fetch('https://geocoding-api.open-meteo.com/v1/search?name=' +
          encodeURIComponent(trimmed) + '&count=10&countryCode=SA&language=ar&format=json');
        if (!geoResponse.ok) throw new Error('تعذّر الاتصال بخدمة تحديد المدينة.');
        const geo = await geoResponse.json();
        const place = (geo.results || []).find((p: any) => p.country_code === 'SA');
        if (!place) throw new Error('لم نجد مدينة بهذا الاسم داخل المملكة. جرّب اسمها بالعربية أو الإنجليزية.');
        await fetchWeather(place.latitude, place.longitude, { city: place.name || trimmed, region: place.admin1 || '', district: '' });
      }
    } catch (err: any) {
      setError(err?.message || 'تعذّر تحميل بيانات الطقس. حاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  const useDeviceLocation = async () => {
    setLoading(true);
    setError('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') throw new Error('اسمح باستخدام موقعك أثناء الاستخدام، أو اكتب اسم المدينة يدوياً.');
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;
      // Get the weather immediately; the optional place name can resolve afterward.
      const placePromise = resolvePlace(latitude, longitude);
      await fetchWeather(latitude, longitude, { city: 'موقعك الحالي', region: '', district: '' }, true);
      const currentRequest = weatherRequestId.current;
      void placePromise.then(meta => {
        if (currentRequest !== weatherRequestId.current) return;
        const city = meta.city || 'موقعك الحالي';
        setCityInput(city === 'موقعك الحالي' ? '' : city);
        const known = findSaudiWeatherCity(city);
        if (known) setRegionSelection(known.region);
        setWeather(previous => previous && previous.latitude === latitude && previous.longitude === longitude
          ? { ...previous, city, region: meta.region, district: meta.district } : previous);
        const key = latitude.toFixed(3) + ':' + longitude.toFixed(3);
        const entry = weatherCache.get(key);
        if (entry) weatherCache.set(key, { ...entry, data: { ...entry.data, city, region: meta.region, district: meta.district } });
      }).catch(() => {});

    } catch (err: any) {
      setError(err?.message || 'تعذّر تحديد موقعك.');
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      if (weather) await fetchWeather(weather.latitude, weather.longitude, { city: weather.city, region: weather.region, district: weather.district }, true);
      else if (cityInput.trim()) await loadWeatherForCity(cityInput);
    } catch (err: any) {
      setError(err?.message || 'تعذّر تحديث الطقس.');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [sessionResult, saved] = await Promise.all([
          supabase.auth.getSession(), getActiveLocation().catch(() => null),
        ]);
        const user = sessionResult.data.session?.user;
        let city = saved?.city && !saved.city.startsWith('كل ') ? saved.city : '';
        if (!city && user) {
          const { data: profile } = await supabase.from('profiles').select('city').eq('id', user.id).maybeSingle();
          city = profile?.city || '';
        }
        if (active) {
          const selected = city || 'الرياض';
          setCityInput(selected);
          void loadWeatherForCity(selected);
        }
      } catch {}
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!weather) return;
    const timer = setInterval(() => {
      void fetchWeather(weather.latitude, weather.longitude, {
        city: weather.city, region: weather.region, district: weather.district,
      }).catch(() => setError('تعذّر التحديث التلقائي؛ ما زال آخر توقع متاحاً.'));
    }, 15 * 60 * 1000);
    return () => clearInterval(timer);
  }, [weather?.latitude, weather?.longitude, weather?.city, weather?.region, weather?.district]);

  const hourlyIndices = (() => {
    if (!weather?.hourly?.time) return [];
    const nowHour = saudiWeatherTimeKey().slice(0, 13);
    const found = weather.hourly.time.findIndex((time: string) => time.slice(0, 13) >= nowHour);
    const start = Math.max(0, found);
    return Array.from({ length: viewHourCount }, (_, i) => start + i).filter(i => i < weather.hourly.time.length);
  })();

  const minuteIndices = (() => {
    if (!weather?.minute?.time?.length) return [];
    const now = saudiWeatherTimeKey();
    const found = weather.minute.time.findIndex((time: string) => time >= now);
    const start = Math.max(0, found);
    return Array.from({ length: 12 }, (_, i) => start + i).filter(i => i < weather.minute.time.length);
  })();

  const next24Hours = (() => {
    if (!weather?.hourly?.time?.length) return [];
    const found = weather.hourly.time.findIndex((time: string) => time.slice(0, 13) >= saudiWeatherTimeKey().slice(0, 13));
    const start = Math.max(0, found);
    return Array.from({ length: 24 }, (_, i) => start + i).filter(i => i < weather.hourly.time.length);
  })();
  const maxRainChance = next24Hours.length ? Math.max(...next24Hours.map(i => Number(weather?.hourly?.precipitation_probability?.[i] || 0))) : 0;
  const nextRainIndex = next24Hours.find(i => Number(weather?.hourly?.precipitation_probability?.[i] || 0) >= 50);
  const rainAmount24 = next24Hours.reduce((total, i) => total + Number(weather?.hourly?.precipitation?.[i] || 0), 0);
  const maxGust24 = next24Hours.length ? Math.max(...next24Hours.map(i => Number(weather?.hourly?.wind_gusts_10m?.[i] || 0))) : 0;

  const dayLabel = (value: string, index: number) => {
    if (index === 0) return 'اليوم';
    if (index === 1) return 'غداً';
    return new Intl.DateTimeFormat('ar-SA', { weekday: 'short', timeZone: 'Asia/Riyadh' }).format(new Date(value + 'T12:00:00+03:00'));
  };

  const weekMin = weather?.daily?.temperature_2m_min ? Math.min(...weather.daily.temperature_2m_min) : 0;
  const weekMax = weather?.daily?.temperature_2m_max ? Math.max(...weather.daily.temperature_2m_max) : 1;
  const weekSpan = Math.max(1, weekMax - weekMin);
  const todayHigh = weather?.daily?.temperature_2m_max?.[0];
  const todayLow = weather?.daily?.temperature_2m_min?.[0];
  const aqi = weather?.air?.us_aqi;
  const aqiMeta = aqiInfo(aqi);
  const alerts = buildAlerts(weather);
  const severityRank: Record<string, number> = { danger: 3, warning: 2, info: 1 };
  const sortedAlerts = [...alerts].sort((a, b) => (severityRank[b.severity] || 0) - (severityRank[a.severity] || 0));
  const topAlert = sortedAlerts[0];
  const bannerMeta = severityTheme(topAlert?.severity || 'info');

  const heroSubtitle = weather
    ? 'الآن ' + round(weather.current.temperature_2m) + '° · ' + weatherDescription(weather.current.weather_code) + ' في ' + weather.city
    : 'الآن وتوقعات الأيام القادمة لمدينتك';

  const tips: string[] = [];
  if ((weather?.daily?.uv_index_max?.[0] ?? 0) >= 6) tips.push('الأشعة فوق البنفسجية مرتفعة؛ استخدم الوقاية من الشمس.');
  if ((weather?.current?.wind_speed_10m ?? 0) >= 30) tips.push('الرياح نشطة؛ توخّ الحذر أثناء القيادة.');
  if ((aqi ?? 0) > 100) tips.push('جودة الهواء قد تؤثر على الفئات الحساسة؛ راجع الإرشادات المحلية.');
  if ((weather?.daily?.precipitation_probability_max?.[0] ?? 0) >= 40) tips.push('احتمال هطول مرتفع اليوم؛ خذ مظلتك معك.');
  if (!tips.length && weather) tips.push('الأجواء مستقرة اليوم؛ استمتع بوقتك في الحي.');

  const getSessionUser = async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.user || null;
  };

  const weatherSummary = weather
    ? weatherDescription(weather.current.weather_code) + '، ' + round(weather.current.temperature_2m) + '° (المحسوسة ' + round(weather.current.apparent_temperature) + '°)، الرطوبة ' + round(weather.current.relative_humidity_2m) + '%، الرياح ' + round(weather.current.wind_speed_10m) + ' كم/س'
    : '';

  const shareWeatherPost = async () => {
    if (!weather) return;
    setSharing(true);
    try {
      const user = await getSessionUser();
      if (!user) {
        Alert.alert('تنبيه', 'يرجى تسجيل الدخول لمشاركة حالة الطقس في حيّك.');
        return;
      }
      const { data: profile } = await supabase.from('profiles').select('city, district, region').eq('id', user.id).maybeSingle();
      const city = profile?.city || weather.city || '';
      const district = profile?.district || weather.district || '';
      const top = sortedAlerts.find((a) => a.severity === 'danger') || sortedAlerts.find((a) => a.severity === 'warning');
      const title = 'حالة الطقس في ' + (district || city || 'حيّنا') + ' الآن ☁️';
      const body = weatherSummary + (top ? ' — تنبيه: ' + top.title + '. ' + top.message : '');
      const base = {
        author_id: user.id,
        title,
        body,
        city: city || null,
        district: district || null,
      };
      const { error } = await supabase.from('questions').insert({
        ...base,
        is_emergency: false,
        urgency_level: 'normal',
        is_tool_sharing: false,
        item_type: 'inquiry',
        lat: weather.latitude ?? null,
        lng: weather.longitude ?? null,
      });
      if (error) {
        const { error: fallbackError } = await supabase.from('questions').insert(base);
        if (fallbackError) throw fallbackError;
      }
      Alert.alert('تم النشر ✅', 'نُشرت حالة الطقس في مجتمع حيّك.');
    } catch (err: any) {
      Alert.alert('تعذّر النشر', err?.message || 'حاول مرة أخرى.');
    } finally {
      setSharing(false);
    }
  };

  const notifyNeighbors = () => {
    if (!weather) return;
    Alert.alert(
      'تنبيه الجيران',
      'سيتم إرسال إشعار لجيرانك في ' + (weather.district || weather.city || 'حيّك') + '. متابعة؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'إرسال',
          style: 'destructive',
          onPress: async () => {
            setSharing(true);
            try {
              const user = await getSessionUser();
              if (!user) {
                Alert.alert('تنبيه', 'يرجى تسجيل الدخول أولًا.');
                return;
              }
              let query = supabase.from('profiles').select('id').eq('city', weather.city).limit(300);
              if (weather.district) query = query.eq('district', weather.district);
              const { data: neighbors } = await query;
              const ids = (neighbors || []).map((n: any) => n.id).filter((id: string) => id && id !== user.id);
              if (!ids.length) {
                Alert.alert('لا يوجد جيران', 'لم نجد جيرانًا مطابقين في منطقتك.');
                return;
              }
              const title = 'تنبيه طقس' + (topAlert ? ': ' + topAlert.title : '');
              const body = weatherSummary;
              const rows = ids.map((id: string) => ({ user_id: id, type: 'weather', title, body, data: { kind: 'weather', city: weather.city, district: weather.district, url: '/weather' } }));
              for (let i = 0; i < rows.length; i += 300) {
                await supabase.from('notifications').insert(rows.slice(i, i + 300));
              }
              await sendPushToMultipleUsers(ids, { title, body, data: { url: '/weather' } });
              Alert.alert('تم الإرسال ✅', 'تم تنبيه ' + ids.length + ' من الجيران.');
            } catch (err: any) {
              Alert.alert('تعذّر الإرسال', err?.message || 'حاول مرة أخرى.');
            } finally {
              setSharing(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={screenStyles.container}>
      <AppHeader
        variant="sub"
        title="طقس الحي"
        subtitle={weather ? `${weather.city} · ${round(weather.current.temperature_2m)}°` : 'توقعات الطقس المباشرة'}
        fallbackRoute="/home"
        rightAction={
          weather ? (
            <View style={{
              flexDirection: 'row-reverse',
              alignItems: 'center',
              gap: 4,
              backgroundColor: OASIS.colors.soft,
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 14,
            }}>
              <Sun size={14} color={OASIS.colors.primary} />
              <Text style={{ fontSize: 13, fontWeight: '700', color: OASIS.colors.primary }}>{round(weather.current.temperature_2m)}°</Text>
            </View>
          ) : undefined
        }
      />

      <ScrollView
        contentContainerStyle={[screenStyles.scroll, { paddingBottom: bottomNavInset + 28 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={OASIS.colors.primary} colors={[OASIS.colors.primary]} />}
      >
        <View style={screenStyles.content}>
          <OasisSurface oasisSurface="card" style={[styles.card, styles.weatherHeroCard]}>
            <LinearGradient
              colors={weather?.current?.is_day ? ['#0f766e', '#0e7490', '#155e75'] : ['#1e3a5f', OASIS.colors.ink, OASIS.colors.muted]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.currentPanel}
            >
              {weather ? (
                <>
                  <View style={styles.panelTop}>
                    <Pressable oasisKind="icon" onPress={refresh} disabled={loading} style={styles.refreshButton} accessibilityLabel="تحديث الطقس">
                      {loading ? <ActivityIndicator size="small" color={OASIS.colors.surface} /> : <RefreshCw size={16} color={OASIS.colors.surface} />}
                    </Pressable>
                    <Text style={styles.panelUpdated}>وقت النموذج {formatSaudiWeatherTime(weather.current.time)} · جلب {lastUpdated ? lastUpdated.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Riyadh' }) : '--'}</Text>
                  </View>
                  <View style={styles.panelLocation}>
                    <MapPin size={13} color={OASIS.colors.soft} />
                    <Text style={styles.panelLocationText}>{[weather.district, weather.city, weather.region].filter(Boolean).join(' · ')}</Text>
                  </View>
                  <View style={styles.currentMain}>
                    <View style={styles.tempCopy}>
                      <Text style={styles.conditionText}>{weatherDescription(weather.current.weather_code)}</Text>
                      <Text style={styles.feelsLike}>المحسوسة {round(weather.current.apparent_temperature)}°</Text>
                      <Text style={styles.hiLo}>العظمى {round(todayHigh)}° · الصغرى {round(todayLow)}°</Text>
                    </View>
                    <View style={styles.tempAndIcon}>
                      <WeatherGlyph code={weather.current.weather_code} size={46} color="#fde68a" />
                      <Text style={styles.temperature}>{round(weather.current.temperature_2m)}°</Text>
                    </View>
                  </View>
                  <View style={styles.sunTimes}>
                    <View style={styles.sunTimeItem}><Sunset size={15} color="#fde68a" /><Text style={styles.sunTimeText}>الغروب</Text><Text style={styles.sunTimeValue}>{formatClock(weather.daily.sunset?.[0])}</Text></View>
                    <View style={styles.sunTimeDivider} />
                    <View style={styles.sunTimeItem}><Sunrise size={15} color="#fde68a" /><Text style={styles.sunTimeText}>الشروق</Text><Text style={styles.sunTimeValue}>{formatClock(weather.daily.sunrise?.[0])}</Text></View>
                  </View>
                </>
              ) : (
                <View style={styles.emptyWeather}>
                  {loading ? <ActivityIndicator size="large" color={OASIS.colors.surface} /> : <><CloudSun size={40} color="#fde68a" /><Text style={styles.emptyTitle}>اعرف أجواء مدينتك</Text><Text style={styles.emptySub}>توقعات نموذجية محدثة من Open-Meteo</Text></>}
                </View>
              )}
            </LinearGradient>
          </OasisSurface>

          {weather && (
            <View style={styles.snapshotGrid}>
              <View style={styles.snapshotTile}>
                <Droplets size={17} color="#0891b2"/>
                <Text style={styles.snapshotLabel}>الرطوبة</Text>
                <Text style={styles.snapshotValue}>{round(weather.current.relative_humidity_2m)}%</Text>
              </View>
              <View style={styles.snapshotTile}>
                <Wind size={17} color={OASIS.colors.primary}/>
                <Text style={styles.snapshotLabel}>الرياح</Text>
                <Text style={styles.snapshotValue}>{round(weather.current.wind_speed_10m)} <Text style={styles.snapshotUnit}>كم/س</Text></Text>
              </View>
              <View style={styles.snapshotTile}>
                <Umbrella size={17} color="#0284c7"/>
                <Text style={styles.snapshotLabel}>فرصة المطر</Text>
                <Text style={styles.snapshotValue}>{round(weather.daily.precipitation_probability_max?.[0])}%</Text>
              </View>
              <View style={styles.snapshotTile}>
                <Activity size={17} color="#7c3aed"/>
                <Text style={styles.snapshotLabel}>جودة الهواء</Text>
                <Text style={styles.snapshotValue}>{weather.air?.us_aqi == null ? '—' : round(weather.air.us_aqi)}</Text>
              </View>
            </View>
          )}

          {weather && topAlert ? (topAlert.id === 'ok' ? (
            <View style={styles.okStrip}>
              <View style={styles.okStripIcon}><CloudSun size={17} color={OASIS.colors.primary}/></View>
              <View style={styles.okStripCopy}>
                <Text style={styles.okStripTitle}>أجواء مستقرة بحسب النموذج</Text>
                <Text style={styles.okStripDesc}>تقدير آلي وليس بديلًا عن الإنذارات الرسمية</Text>
              </View>
            </View>
          ) : (
            <View style={[styles.alertBanner, { backgroundColor: bannerMeta.bg, borderColor: bannerMeta.border }]}>
              <View style={styles.alertBannerTop}>
                <View style={[styles.alertIconWrap, { backgroundColor: bannerMeta.accent }]}>
                  <AlertIcon kind={topAlert.icon} size={16} color={OASIS.colors.surface} />
                </View>
                <View style={styles.alertBannerCopy}>
                  <Text style={[styles.alertBadge, { color: bannerMeta.accent }]}>تقدير آلي · {bannerMeta.label} · {alerts.length}</Text>
                  <Text style={[styles.alertTitle, { color: bannerMeta.text }]}>{topAlert.title}</Text>
                </View>
              </View>
              <Text style={[styles.alertMessage, { color: bannerMeta.text }]}>{topAlert.message}</Text>
              {sortedAlerts.length > 1 && (
                <Pressable oasisKind="plain" accessibilityRole="button"
                  accessibilityLabel={showOtherAlerts ? 'إخفاء المؤشرات الجوية الأخرى' : 'عرض المؤشرات الجوية الأخرى'}
                  accessibilityState={{ expanded: showOtherAlerts }} style={styles.alertExtraToggle}
                  onPress={() => setShowOtherAlerts(v => !v)}>
                  <Text style={[styles.alertExtraText, { color: bannerMeta.text }]}>{showOtherAlerts ? 'إخفاء التفاصيل' : `مؤشرات أخرى (${sortedAlerts.length - 1})`}</Text>
                  {showOtherAlerts ? <ChevronUp size={15} color={bannerMeta.text}/> : <ChevronDown size={15} color={bannerMeta.text}/>}
                </Pressable>
              )}
              {showOtherAlerts && sortedAlerts.length > 1 ? (
                <View style={styles.alertList}>
                  {sortedAlerts.slice(1).map((a) => (
                    <View key={a.id} style={styles.alertRow}>
                      <AlertIcon kind={a.icon} size={13} color={bannerMeta.accent} />
                      <Text style={[styles.alertRowText, { color: bannerMeta.text }]}>{a.title}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          )) : null}

          {/* City search */}
          <OasisSurface oasisSurface="card" style={styles.searchCard}>
            <View style={styles.citySearchRow}>
              <Pressable oasisKind="plain" accessibilityRole="button" accessibilityLabel="حساب الطقس حسب موقع الجهاز" style={styles.locationButton} onPress={useDeviceLocation} disabled={loading}>
                <Navigation size={15} color={OASIS.colors.primary} />
                <Text style={styles.locationButtonText}>موقعي</Text>
              </Pressable>
              <Pressable oasisKind="plain" accessibilityRole="button" accessibilityLabel="البحث عن طقس المدينة" style={styles.searchButton} onPress={() => loadWeatherForCity(cityInput)} disabled={loading || !cityInput.trim()}>
                <Search size={15} color={OASIS.colors.surface} />
              </Pressable>
              <TextInput
                accessibilityLabel="اسم مدينة سعودية"
                value={cityInput}
                onChangeText={setCityInput}
                placeholder="اكتب اسم المدينة"
                placeholderTextColor="#94a3b8"
                style={styles.cityInput}
                textAlign="right"
                returnKeyType="search"
                onSubmitEditing={() => loadWeatherForCity(cityInput)}
              />
            </View>
            <Pressable oasisKind="plain" accessibilityRole="button" accessibilityLabel="اختيار مدينة من مناطق السعودية"
              accessibilityState={{ expanded: cityPickerOpen }}
              onPress={() => setCityPickerOpen(v => !v)} style={styles.cityPickerToggle}>
              <MapPin size={15} color={OASIS.colors.primary}/>
              <Text style={styles.cityPickerTitle}>تصفح مناطق ومدن السعودية</Text>
              <View style={styles.cityPickerSide}><SaudiLiveClock />{cityPickerOpen ? <ChevronUp size={17} color={OASIS.colors.primary}/> : <ChevronDown size={17} color={OASIS.colors.primary}/>}</View>
            </Pressable>
            {cityPickerOpen && (<>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row-reverse', gap: 7, paddingHorizontal: 12, paddingBottom: 9 }}>
              {['كل المناطق', ...SAUDI_WEATHER_REGIONS].map(region => (
                <Pressable key={region} onPress={() => setRegionSelection(region)}
                  style={{ backgroundColor: regionSelection === region ? OASIS.colors.primary : OASIS.colors.background, borderRadius: 13, paddingHorizontal: 10, paddingVertical: 9, borderWidth: 1, borderColor: OASIS.colors.line }}>
                  <Text style={{ color: regionSelection === region ? OASIS.colors.surface : OASIS.colors.ink, fontSize: 11, fontWeight: '700' }}>{region}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row-reverse', gap: 7, paddingHorizontal: 12 }}>
              {SAUDI_WEATHER_CITIES.filter(city => regionSelection === 'كل المناطق'
                ? ['الرياض', 'مكة المكرمة', 'جدة', 'المدينة المنورة', 'الدمام', 'بريدة', 'عرعر', 'أبها', 'تبوك', 'جازان', 'نجران', 'حائل', 'سكاكا', 'الباحة'].includes(city.name)
                : city.region === regionSelection).map(city => (
                <Pressable key={city.name} disabled={loading} onPress={() => { setCityInput(city.name); setCityPickerOpen(false); void loadWeatherForCity(city.name); }}
                  style={{ flexDirection: 'row-reverse', gap: 4, alignItems: 'center', padding: 9, borderRadius: 11, backgroundColor: weather?.city === city.name ? OASIS.colors.deep : OASIS.colors.soft }}>
                  <MapPin size={12} color={weather?.city === city.name ? '#fff' : OASIS.colors.primary} />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: weather?.city === city.name ? '#fff' : OASIS.colors.deep }}>{city.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
            </>)}
            {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
          </OasisSurface>

          {/* Radar and official warnings remain accessible without loading a map on this page. */}
          <View style={styles.quickLinks}>
            <Pressable oasisKind="plain" accessibilityRole="button" accessibilityLabel="فتح رادار الأمطار والسحب"
              onPress={() => router.push({
                pathname: '/weather-radar' as any,
                params: weather ? { city: weather.city, lat: weather.latitude.toFixed(4), lon: weather.longitude.toFixed(4) } : { city: cityInput || 'الرياض' },
              })}
              style={styles.radarShortcut}>
              <Satellite size={21} color="#0f766e"/>
              <View style={styles.radarText}>
                <Text style={styles.radarTitle}>رادار الأمطار</Text>
                <Text style={styles.radarSub}>السحب والهطول · خريطة تفاعلية</Text>
              </View>
              <ChevronRight size={17} color={OASIS.colors.primary}/>
            </Pressable>
            <Pressable oasisKind="plain" accessibilityRole="button" accessibilityLabel="فتح إنذارات المركز الوطني للأرصاد"
              onPress={() => void Linking.openURL('https://www.ncm.gov.sa/en/early-warning')}
              style={styles.officialShortcut}>
              <TriangleAlert size={19} color="#b45309"/>
              <Text style={styles.officialTitle}>الإنذارات الرسمية</Text>
            </Pressable>
          </View>

          {weather && (
            <View style={styles.locationAccordion}>
              <Pressable oasisKind="plain" accessibilityRole="button" accessibilityLabel="تفاصيل موقع حساب الطقس"
                accessibilityState={{ expanded: locationDetailsOpen }}
                onPress={() => setLocationDetailsOpen(v => !v)} style={styles.locationCompactRow}>
                <MapPin size={16} color={OASIS.colors.primary}/>
                <Text style={styles.locationCompactText} numberOfLines={1}>توقعات {weather.city}{weather.district ? ' · ' + weather.district : ''}</Text>
                {locationDetailsOpen ? <ChevronUp size={16} color={OASIS.colors.muted}/> : <ChevronDown size={16} color={OASIS.colors.muted}/>}
              </Pressable>
              {locationDetailsOpen && (
                <View style={styles.locationGrid}>
                  <LocationItem label="المنطقة" value={weather.region} />
                  <LocationItem label="المدينة" value={weather.city} />
                  <LocationItem label="الحي" value={weather.district} />
                  <LocationItem label="الإحداثيات" value={weather.latitude.toFixed(3) + '، ' + weather.longitude.toFixed(3)} />
                </View>
              )}
            </View>
          )}

          {weather && (
            <Pressable oasisKind="plain" accessibilityRole="button" accessibilityLabel="عرض تفاصيل التوقعات والساعات والأيام"
              accessibilityState={{ expanded: detailsExpanded }} onPress={() => setDetailsExpanded(v => !v)}
              style={styles.detailsToggle}>
              <View style={styles.detailsToggleCopy}>
                <Text style={styles.detailsToggleTitle}>التوقعات والتفاصيل</Text>
                <Text style={styles.detailsToggleHint}>الساعات القادمة · 16 يومًا · جودة الهواء</Text>
              </View>
              <Text style={styles.detailsToggleAction}>{detailsExpanded ? 'إخفاء' : 'عرض التفاصيل'}</Text>
              {detailsExpanded ? <ChevronUp size={17} color={OASIS.colors.primary}/> : <ChevronDown size={17} color={OASIS.colors.primary}/>}
            </Pressable>
          )}

          {/* Expanded forecast details are mounted only when requested. */}
          {weather && detailsExpanded && (
          <OasisSurface oasisSurface="card" style={styles.card}>

            {weather && (
              <>
                <View style={styles.metricsGrid}>
                  <Metric icon={<Thermometer size={17} color="#2563eb" />} bg={OASIS.colors.infoSoft} label="المحسوسة" value={round(weather.current.apparent_temperature)} unit="°" />
                  <Metric icon={<Droplets size={17} color="#0891b2" />} bg="#ecfeff" label="الرطوبة" value={round(weather.current.relative_humidity_2m)} unit="%" />
                  <Metric icon={<Wind size={17} color={OASIS.colors.primary} />} bg={OASIS.colors.soft} label={'الرياح' + (windDir(weather.current.wind_direction_10m) ? ' · ' + windDir(weather.current.wind_direction_10m) : '')} value={round(weather.current.wind_speed_10m)} unit="كم/س" />
                  <Metric icon={<Gauge size={17} color="#7c3aed" />} bg="#f5f3ff" label="هبّات الرياح" value={round(weather.current.wind_gusts_10m)} unit="كم/س" />
                  {showExtraMetrics && <>
                  <Metric icon={<Cloud size={17} color="#0891b2" />} bg={OASIS.colors.infoSoft} label="الغيوم" value={round(weather.current.cloud_cover)} unit="%" />
                  <Metric icon={<Gauge size={17} color="#b45309" />} bg={OASIS.colors.warningSoft} label="الضغط" value={round(weather.current.pressure_msl)} unit="hPa" />
                  <Metric icon={<Sun size={17} color="#d97706" />} bg="#fff7ed" label="مؤشر UV" value={round(weather.daily.uv_index_max?.[0])} unit="" />
                  <Metric icon={<Umbrella size={17} color="#ea580c" />} bg="#fff7ed" label="احتمال الهطول" value={round(weather.daily.precipitation_probability_max?.[0])} unit="%" />
                  <Metric icon={<Eye size={17} color="#0e7490" />} bg={OASIS.colors.infoSoft} label="مدى الرؤية" value={weather.current.visibility == null ? '--' : (Number(weather.current.visibility) / 1000).toFixed(1)} unit="كم" />
                  <Metric icon={<Droplets size={17} color="#0891b2" />} bg="#ecfeff" label="نقطة الندى" value={round(weather.current.dew_point_2m)} unit="°" />
                  </>}
                </View>
                <Pressable oasisKind="plain" accessibilityRole="button"
                  accessibilityLabel={showExtraMetrics ? 'إخفاء المؤشرات الجوية التفصيلية' : 'عرض كل المؤشرات الجوية'}
                  accessibilityState={{ expanded: showExtraMetrics }} onPress={() => setShowExtraMetrics(v => !v)} style={styles.metricToggle}>
                  <Text style={styles.metricToggleText}>{showExtraMetrics ? 'إخفاء المؤشرات الإضافية' : 'عرض بقية المؤشرات'}</Text>
                  {showExtraMetrics ? <ChevronUp size={15} color={OASIS.colors.primary}/> : <ChevronDown size={15} color={OASIS.colors.primary}/>}
                </Pressable>

                {/* Outlook for the next 24 hours */}
                <View style={styles.blockHeader}><Text style={styles.blockTitle}>ملخص الـ24 ساعة القادمة</Text><Text style={styles.blockHint}>توقع آلي</Text></View>
                <View style={{ flexDirection: 'row-reverse', gap: 6, paddingHorizontal: 12, paddingBottom: 8 }}>
                  {[
                    { label: 'فرصة المطر', value: round(maxRainChance) + '%' },
                    { label: 'مجموع الهطول', value: rainAmount24.toFixed(1) + ' مم' },
                    { label: 'هبّات الرياح', value: round(maxGust24) + ' كم/س' },
                  ].map(item => (
                    <View key={item.label} style={{ flex: 1, alignItems: 'flex-end', padding: 10, gap: 6, backgroundColor: OASIS.colors.background, borderRadius: 12 }}>
                      <Text style={{ color: OASIS.colors.muted, fontSize: 10 }}>{item.label}</Text>
                      <Text style={{ color: OASIS.colors.ink, fontSize: 15, fontWeight: '800' }}>{item.value}</Text>
                    </View>
                  ))}
                </View>
                <Text style={{ color: OASIS.colors.muted, fontSize: 10.5, lineHeight: 18, paddingHorizontal: 14, textAlign: 'right', paddingBottom: 8 }}>
                  {nextRainIndex == null ? 'لا توجد ساعة تتجاوز فيها فرصة المطر 50% خلال 24 ساعة بحسب النموذج.' : 'أول فرصة مطر 50% فأعلى: ' + formatSaudiWeatherTime(weather.hourly.time[nextRainIndex])}
                </Text>
                {minuteIndices.length ? (
                  <>
                    <View style={styles.blockHeader}><Text style={styles.blockTitle}>كل 15 دقيقة</Text><Text style={styles.blockHint}>توقعات قصيرة المدى</Text></View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hourlyList}>
                      {minuteIndices.map(index => (
                        <View key={weather.minute.time[index]} style={{ minWidth: 80, alignItems: 'center', gap: 6, paddingVertical: 12, paddingHorizontal: 9, borderRadius: 13, backgroundColor: '#eff6ff' }}>
                          <Text style={styles.hourText}>{formatSaudiWeatherTime(weather.minute.time[index])}</Text>
                          <WeatherGlyph code={weather.minute.weather_code?.[index] ?? 0} size={21} />
                          <Text style={styles.hourTemp}>{round(weather.minute.temperature_2m?.[index])}°</Text>
                          <Text style={{ color: '#0369a1', fontSize: 10 }}>{weather.minute.precipitation?.[index] == null ? '--' : Number(weather.minute.precipitation[index]).toFixed(1)} مم</Text>
                        </View>
                      ))}
                    </ScrollView>
                    <Text style={{ color: OASIS.colors.muted, fontSize: 10.5, lineHeight: 17, textAlign: 'right', paddingHorizontal: 14, paddingBottom: 9 }}>هذه تقديرات مستوفاة من بيانات كل ساعة في السعودية، وليست قياسات أو راداراً مباشراً.</Text>
                  </>
                ) : null}
                {/* Hourly */}
                <View style={styles.blockHeader}>
                  <Text style={styles.blockTitle}>توقعات الساعة</Text>
                  <Pressable onPress={() => setViewHourCount(count => count === 12 ? 48 : 12)} style={{ backgroundColor: OASIS.colors.soft, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 9 }}>
                    <Text style={{ color: OASIS.colors.primary, fontWeight: '700', fontSize: 11 }}>{viewHourCount === 12 ? 'عرض 48 ساعة' : 'عرض 12 ساعة'}</Text>
                  </Pressable>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hourlyList}>
                  {hourlyIndices.map((index) => (
                    <OasisSurface oasisSurface="card" key={weather.hourly.time[index]} style={styles.hourCard}>
                      <Text style={styles.hourText}>{formatSaudiWeatherTime(weather.hourly.time[index])}</Text>
                      <WeatherGlyph code={weather.hourly.weather_code[index]} size={23} />
                      <Text style={styles.hourTemp}>{round(weather.hourly.temperature_2m[index])}°</Text>
                      <View style={styles.hourMeta}><Droplets size={10} color={OASIS.colors.info} /><Text style={styles.hourMetaText}>{weather.hourly.precipitation_probability[index] ?? 0}%</Text></View>
                      <View style={styles.hourMeta}><Wind size={10} color={OASIS.colors.primary} /><Text style={styles.hourMetaText}>{round(weather.hourly.wind_speed_10m?.[index])}</Text></View>
                    </OasisSurface>
                  ))}
                </ScrollView>

                <View style={styles.divider} />

                {/* Daily with range bars */}
                <View style={styles.blockHeader}><Text style={styles.blockTitle}>توقعات حتى 16 يوماً</Text><Text style={styles.blockHint}>العظمى / الصغرى</Text></View>
                {weather.daily.time.slice(0, showAllDays ? 16 : 7).map((date: string, index: number) => {
                  const low = weather.daily.temperature_2m_min[index];
                  const high = weather.daily.temperature_2m_max[index];
                  const left = Math.max(0, Math.min(100, ((low - weekMin) / weekSpan) * 100));
                  const width = Math.max(6, Math.min(100 - left, ((high - low) / weekSpan) * 100));
                  return (
                    <View key={date} style={styles.dayRow}>
                      <Text style={styles.dayLow}>{round(low)}°</Text>
                      <Text style={styles.dayHigh}>{round(high)}°</Text>
                      <View style={styles.dayTrack}>
                        <View style={[styles.dayRangeBar, { marginLeft: (left + '%') as any, width: (width + '%') as any }]} />
                      </View>
                      <View style={styles.dayCondition}>
                        <Text style={styles.dayConditionText}>{weatherDescription(weather.daily.weather_code[index])} · {round(weather.daily.precipitation_probability_max?.[index])}% مطر</Text>
                        <WeatherGlyph code={weather.daily.weather_code[index]} size={21} />
                      </View>
                      <Text style={styles.dayName}>{dayLabel(date, index)}</Text>
                    </View>
                  );
                })}

                <Pressable oasisKind="plain" accessibilityRole="button" accessibilityLabel={showAllDays ? 'عرض أول سبعة أيام' : 'عرض جميع الأيام الستة عشر'}
                  onPress={() => setShowAllDays(v => !v)} style={styles.daysToggle}>
                  <Text style={styles.daysToggleText}>{showAllDays ? 'عرض أول 7 أيام' : 'عرض توقعات 16 يومًا'}</Text>
                  {showAllDays ? <ChevronUp size={15} color={OASIS.colors.primary}/> : <ChevronDown size={15} color={OASIS.colors.primary}/>}
                </Pressable>

                <View style={styles.divider} />

                {/* Air quality */}
                <View style={styles.blockHeader}>
                  <Text style={styles.blockTitle}>جودة الهواء والغبار</Text>
                  <View style={styles.sectionTag}><Activity size={12} color="#0f766e" /><Text style={styles.sectionTagText}>بيانات تقديرية</Text></View>
                </View>
                {weather.air ? (
                  <>
                    <View style={[styles.airSummary, { backgroundColor: aqiMeta.bg }]}>
                      <View style={[styles.aqiBadge, { backgroundColor: '#ffffffcc' }]}>
                        <Text style={[styles.aqiNumber, { color: aqiMeta.color }]}>{round(aqi)}</Text>
                        <Text style={styles.aqiLabel}>US AQI</Text>
                      </View>
                      <View style={styles.airCopy}>
                        <Text style={[styles.airTitle, { color: aqiMeta.color }]}>{aqiMeta.label}</Text>
                        <View style={styles.aqiTrack}><View style={[styles.aqiFill, { width: (Math.min(100, ((aqi ?? 0) / 300) * 100) + '%') as any, backgroundColor: aqiMeta.bar }]} /></View>
                        <Text style={styles.airDescription}>مؤشر تقديري لجودة الهواء، وليس تنبيهاً رسمياً.</Text>
                      </View>
                    </View>
                    <View style={styles.metricsGrid}>
                      <Metric icon={<Gauge size={17} color="#0f766e" />} bg="#f0fdfa" label="PM2.5 · جسيمات دقيقة" value={weather.air.pm2_5 == null ? '--' : Number(weather.air.pm2_5).toFixed(1)} unit="µg/m³" />
                      <Metric icon={<Gauge size={17} color="#0f766e" />} bg="#f0fdfa" label="PM10 · جسيمات عالقة" value={weather.air.pm10 == null ? '--' : Number(weather.air.pm10).toFixed(1)} unit="µg/m³" />
                      <Metric icon={<Waves size={17} color="#b45309" />} bg={OASIS.colors.warningSoft} label="الغبار" value={weather.air.dust == null ? '--' : Number(weather.air.dust).toFixed(1)} unit="µg/m³" />
                      <Metric icon={<Sun size={17} color="#d97706" />} bg="#fff7ed" label="ذروة UV اليوم" value={round(weather.daily.uv_index_max?.[0])} unit="" />
                    </View>
                  </>
                ) : (
                  <View style={styles.airUnavailable}><Info size={17} color={OASIS.colors.muted} /><Text style={styles.airDescription}>بيانات جودة الهواء غير متاحة حالياً لهذا الموقع.</Text></View>
                )}

                {/* Guidance */}
                <OasisSurface oasisSurface="card" style={styles.tipsCard}>
                  <View style={styles.tipsHeader}><Eye size={16} color={OASIS.colors.deep} /><Text style={styles.tipsTitle}>إرشادات عامة</Text></View>
                  {tips.map((tip, i) => <Text key={i} style={styles.tipText}>• {tip}</Text>)}
                  <Text style={styles.disclaimer}>البيانات والإرشادات تقديرية ولا تغني عن التنبيهات الرسمية.</Text>
                </OasisSurface>

                {/* Share / notify neighbors */}
                <OasisSurface oasisSurface="card" style={styles.actionsCard}>
                  <View style={styles.actionsHeader}>
                    <Megaphone size={16} color={OASIS.colors.deep} />
                    <Text style={styles.actionsTitle}>شارك حالة الطقس مع جيرانك</Text>
                  </View>
                  <Pressable style={[styles.actionPrimary, sharing && styles.actionDisabled]} onPress={shareWeatherPost} disabled={sharing}>
                    {sharing ? (
                      <ActivityIndicator size="small" color={OASIS.colors.surface} />
                    ) : (
                      <>
                        <Send size={16} color={OASIS.colors.surface} />
                        <Text style={styles.actionPrimaryText}>انشر حالة الطقس في حيّك</Text>
                      </>
                    )}
                  </Pressable>
                  <Pressable style={[styles.actionSecondary, sharing && styles.actionDisabled]} onPress={notifyNeighbors} disabled={sharing}>
                    <Bell size={16} color={OASIS.colors.danger} />
                    <Text style={styles.actionSecondaryText}>نبّه جيرانك بإشعار</Text>
                  </Pressable>
                </OasisSurface>

                <View style={styles.weatherFooter}>
                  <Text style={styles.sourceText}>المصدر: Open-Meteo · وقت النموذج {formatSaudiWeatherTime(weather.current.time)} · آخر جلب {lastUpdated ? lastUpdated.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Riyadh' }) : ''}</Text>
                  <Text style={styles.uvText}>مؤشر الأشعة فوق البنفسجية اليوم: {round(weather.daily.uv_index_max?.[0])}</Text>
                </View>
              </>
            )}
          </OasisSurface>
          )}

          <Pressable oasisKind="plain" accessibilityRole="button" accessibilityLabel="مصادر الطقس والتنبيهات الرسمية"
            accessibilityState={{ expanded: sourcesExpanded }} onPress={() => setSourcesExpanded(v => !v)}
            style={styles.sourcesToggle}>
            <Info size={16} color={OASIS.colors.primary}/>
            <Text style={styles.sourcesLabel}>مصادر الطقس والتنبيهات الرسمية</Text>
            {sourcesExpanded ? <ChevronUp size={17} color={OASIS.colors.primary}/> : <ChevronDown size={17} color={OASIS.colors.primary}/>}
          </Pressable>
          {sourcesExpanded && (
          <OasisSurface oasisSurface="card" style={styles.infoCard}>
            <Text style={styles.infoTitle}>تنبيهات المركز الوطني للأرصاد</Text>
            <Text style={styles.infoText}>التنبيهات المعروضة في الصفحة ناتجة عن معايير آلية وليست تحذيرات رسمية. عند تقلبات الطقس تأكد من المركز الوطني للأرصاد.</Text>
            <Pressable onPress={() => void Linking.openURL('https://www.ncm.gov.sa/en/early-warning')}
              style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12, backgroundColor: OASIS.colors.deep, borderRadius: 12 }}>
              <TriangleAlert size={16} color={OASIS.colors.surface} />
              <Text style={{ color: OASIS.colors.surface, fontSize: 12, fontWeight: '700' }}>فتح خريطة الإنذار المبكر الرسمية</Text>
            </Pressable>
            <Text style={styles.infoTitle}>مصدر البيانات ودقة التحديث</Text>
            <Text style={styles.infoText}>البيانات النموذجية من Open-Meteo وجودة الهواء من Open-Meteo Air Quality. الساعة المحلية تتحدث كل دقيقة، ويُعاد جلب توقعات مزود الخدمة كل 15 دقيقة أثناء فتح الصفحة، وليس رصداً جوياً كل ثانية. تقل موثوقية التوقع كلما طالت المدة، وتوقيت العرض هو السعودية.</Text>
          </OasisSurface>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function SaudiLiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 5, borderRadius: 15, backgroundColor: OASIS.colors.soft, paddingHorizontal: 8, paddingVertical: 5 }}>
      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: OASIS.colors.primary }} />
      <Text style={{ color: OASIS.colors.primary, fontSize: 10, fontWeight: '700' }}>
        {now.toLocaleTimeString('ar-SA', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );
}

function Metric({ icon, bg, label, value, unit }: { icon: any; bg: string; label: string; value: string; unit: string }) {
  return (
    <OasisSurface oasisSurface="card" style={styles.metricCard}>
      <View style={[styles.metricIcon, { backgroundColor: bg }]}>{icon}</View>
      <Text style={styles.metricLabel} numberOfLines={1}>{label}</Text>
      <Text style={styles.metricValue}>{value}{unit ? <Text style={styles.metricUnit}> {unit}</Text> : null}</Text>
    </OasisSurface>
  );
}

function LocationItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.locationItem}>
      <Text style={styles.locationItemLabel}>{label}</Text>
      <Text style={styles.locationItemValue} numberOfLines={2}>{value && value.trim() ? value : '—'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  weatherHeroCard: { borderRadius: 18, borderWidth: 0, elevation: 0, shadowOpacity: 0 },
  alertExtraToggle: { minHeight: 34, borderRadius: 10, paddingHorizontal: 10, flexDirection: 'row-reverse', alignItems: 'center', alignSelf: 'flex-end', justifyContent: 'center', gap: 6 },
  alertExtraText: { fontSize: 10.5, fontWeight: '800' },
  metricToggle: { alignSelf: 'center', minHeight: 37, marginBottom: 10, paddingHorizontal: 12, borderRadius: 11, backgroundColor: OASIS.colors.soft, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6 },
  metricToggleText: { color: OASIS.colors.primary, fontWeight: '800', fontSize: 11.5 },
  snapshotGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 7 },
  snapshotTile: { flexGrow: 1, flexBasis: '21%', minWidth: 72, minHeight: 78, justifyContent: 'center', alignItems: 'center', gap: 4, paddingHorizontal: 5, paddingVertical: 8, borderRadius: 13, borderWidth: 1, borderColor: OASIS.colors.line, backgroundColor: OASIS.colors.surface },
  snapshotLabel: { color: OASIS.colors.muted, fontSize: 10, fontWeight: '600', textAlign: 'center' },
  snapshotValue: { color: OASIS.colors.ink, fontSize: 16, fontWeight: '800', textAlign: 'center' },
  snapshotUnit: { color: OASIS.colors.muted, fontSize: 9.5, fontWeight: '600' },
  okStrip: { flexDirection: 'row-reverse', alignItems: 'center', gap: 9, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 13, backgroundColor: OASIS.colors.soft },
  okStripIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: OASIS.colors.surface, alignItems: 'center', justifyContent: 'center' },
  okStripCopy: { flex: 1, alignItems: 'flex-end', gap: 2 },
  okStripTitle: { color: OASIS.colors.deep, fontSize: 12, fontWeight: '800', textAlign: 'right' },
  okStripDesc: { color: OASIS.colors.muted, fontSize: 10, textAlign: 'right' },
  searchCard: { backgroundColor: OASIS.colors.surface, borderRadius: 15, borderWidth: 1, borderColor: OASIS.colors.line, overflow: 'hidden', elevation: 0 }, 
  cityPickerToggle: { minHeight: 40, flexDirection: 'row-reverse', alignItems: 'center', gap: 7, marginHorizontal: 11, paddingVertical: 6, borderTopWidth: 1, borderTopColor: OASIS.colors.line },
  cityPickerTitle: { color: OASIS.colors.deep, fontSize: 11.5, fontWeight: '700', flex: 1, textAlign: 'right' },
  cityPickerSide: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5 },
  quickLinks: { flexDirection: 'row-reverse', alignItems: 'stretch', gap: 8 },
  radarShortcut: { flex: 1.5, minWidth: 0, minHeight: 67, borderWidth: 1, borderColor: '#BDE7D7', borderRadius: 15, paddingHorizontal: 10, flexDirection: 'row-reverse', alignItems: 'center', gap: 8, backgroundColor: '#E9F7F0' },
  radarText: { flex: 1, minWidth: 0, alignItems: 'flex-end', gap: 3 },
  radarTitle: { color: OASIS.colors.deep, fontSize: 12.5, fontWeight: '800', textAlign: 'right' },
  radarSub: { color: OASIS.colors.muted, fontSize: 10, textAlign: 'right' },
  officialShortcut: { flex: 0.8, minWidth: 0, minHeight: 67, alignItems: 'center', justifyContent: 'center', gap: 4, paddingHorizontal: 8, borderWidth: 1, borderColor: '#F2DFC4', borderRadius: 15, backgroundColor: '#FFF8EB' },
  officialTitle: { color: '#945A1C', fontSize: 10.5, fontWeight: '700', textAlign: 'center' },
  locationAccordion: { borderWidth: 1, borderColor: OASIS.colors.line, backgroundColor: OASIS.colors.surface, borderRadius: 13, paddingHorizontal: 11, paddingVertical: 6, gap: 5 },
  locationCompactRow: { minHeight: 33, flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  locationCompactText: { flex: 1, minWidth: 0, fontSize: 11.5, fontWeight: '600', color: OASIS.colors.ink, textAlign: 'right' },
  detailsToggle: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, minHeight: 64, borderRadius: 15, paddingHorizontal: 13, paddingVertical: 10, backgroundColor: OASIS.colors.surface, borderWidth: 1, borderColor: OASIS.colors.line },
  detailsToggleCopy: { flex: 1, minWidth: 0, alignItems: 'flex-end', gap: 4 },
  detailsToggleTitle: { color: OASIS.colors.ink, fontSize: 13.5, fontWeight: '800', textAlign: 'right' },
  detailsToggleHint: { color: OASIS.colors.muted, fontSize: 10.5, textAlign: 'right' },
  detailsToggleAction: { color: OASIS.colors.primary, fontSize: 11, fontWeight: '700' },
  daysToggle: { minHeight: 38, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12, margin: 9, borderRadius: 11, backgroundColor: OASIS.colors.soft },
  daysToggleText: { fontSize: 11, fontWeight: '700', color: OASIS.colors.primary },
  sourcesToggle: { flexDirection: 'row-reverse', alignItems: 'center', gap: 7, borderRadius: 13, paddingHorizontal: 11, minHeight: 41, backgroundColor: OASIS.colors.surface, borderWidth: 1, borderColor: OASIS.colors.line },
  sourcesLabel: { flex: 1, textAlign: 'right', color: OASIS.colors.muted, fontSize: 11, fontWeight: '700' },

  citySearchRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, paddingVertical: 9 },
  locationButton: { flexDirection: 'row-reverse', minHeight: 42, alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: OASIS.colors.soft, borderRadius: 11, paddingHorizontal: 9, paddingVertical: 7 },
  locationButtonText: { color: OASIS.colors.primary, fontSize: 11.5, fontWeight: '700' },
  searchButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: OASIS.colors.primary, borderRadius: 11 },
  cityInput: { flex: 1, minWidth: 0, minHeight: 42, backgroundColor: OASIS.colors.background, borderWidth: 1, borderColor: OASIS.colors.line, borderRadius: 11, paddingHorizontal: 10, paddingVertical: 8, color: OASIS.colors.ink, fontSize: 13 },
  errorText: { color: OASIS.colors.danger, fontSize: 11.5, textAlign: 'right', paddingHorizontal: 14, paddingBottom: 10, lineHeight: 17 },

  locationCard: { backgroundColor: OASIS.colors.surface, borderRadius: 14, borderWidth: 1, borderColor: OASIS.colors.line, padding: 14, gap: 10 },
  locationCardHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  locationCardTitle: { color: OASIS.colors.ink, fontSize: 12.5, fontWeight: '700', textAlign: 'right' },
  locationGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  locationItem: { flexGrow: 1, flexBasis: '44%', backgroundColor: OASIS.colors.background, borderRadius: 13, padding: 10, gap: 3, alignItems: 'flex-end' },
  locationItemLabel: { color: OASIS.colors.muted, fontSize: 11, fontWeight: '700' },
  locationItemValue: { color: OASIS.colors.ink, fontSize: 12.5, fontWeight: '700', textAlign: 'right' },
  panelLocation: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, marginTop: 8 },
  panelLocationText: { color: OASIS.colors.soft, fontSize: 11, fontWeight: '700', textAlign: 'right' },

  card: { backgroundColor: OASIS.colors.surface, borderRadius: 16, borderWidth: 1, borderColor: OASIS.colors.line, overflow: 'hidden', shadowOpacity: 0, elevation: 0 },
  currentPanel: { paddingHorizontal: 15, paddingTop: 13, paddingBottom: 14, minHeight: 182 },
  panelTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  panelUpdated: { color: OASIS.colors.soft, fontSize: 11, fontWeight: '700' },
  refreshButton: { width: 34, height: 34, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  currentMain: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11 },
  tempAndIcon: { flexDirection: 'row-reverse', alignItems: 'center', gap: 9 },
  temperature: { color: OASIS.colors.surface, fontSize: 50, fontWeight: '600', letterSpacing: -1.5 },
  tempCopy: { alignItems: 'flex-end', gap: 5 },
  conditionText: { color: OASIS.colors.surface, fontSize: 16, fontWeight: '700' },
  feelsLike: { color: '#dbeafe', fontSize: 11.5 },
  hiLo: { color: '#c7f9e5', fontSize: 11, fontWeight: '700' },
  sunTimes: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.13)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, gap: 9 },
  sunTimeItem: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', gap: 5 },
  sunTimeText: { color: OASIS.colors.line, fontSize: 11 },
  sunTimeValue: { color: OASIS.colors.surface, fontSize: 11, fontWeight: '600' },
  sunTimeDivider: { width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.25)' },
  emptyWeather: { alignItems: 'center', justifyContent: 'center', gap: 9, paddingVertical: 16 },
  emptyTitle: { color: OASIS.colors.surface, fontSize: 16, fontWeight: '700' },
  emptySub: { color: '#e0f2fe', fontSize: 11, textAlign: 'center', lineHeight: 17 },

  metricsGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', padding: 11, gap: 8 },
  metricCard: { width: '48%', flexGrow: 1, flexBasis: '44%', backgroundColor: OASIS.colors.surface, borderWidth: 1, borderColor: OASIS.colors.line, borderRadius: 12, padding: 10, alignItems: 'flex-end', gap: 5 },
  metricIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  metricLabel: { color: OASIS.colors.muted, fontSize: 11, fontWeight: '700' },
  metricValue: { color: OASIS.colors.ink, fontSize: 18, fontWeight: '700' },
  metricUnit: { color: OASIS.colors.muted, fontSize: 11, fontWeight: '700' },

  blockHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 8, paddingBottom: 10 },
  blockTitle: { color: OASIS.colors.ink, fontSize: 13.5, fontWeight: '700' },
  blockHint: { color: '#94a3b8', fontSize: 11 },

  hourlyList: { flexDirection: 'row-reverse', gap: 8, paddingHorizontal: 12, paddingBottom: 14 },
  hourCard: { minWidth: 68, alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, paddingHorizontal: 8, borderRadius: 14, backgroundColor: OASIS.colors.background, borderWidth: 1, borderColor: '#f1f5f9' },
  hourText: { color: OASIS.colors.muted, fontSize: 11 },
  hourTemp: { color: OASIS.colors.ink, fontSize: 15, fontWeight: '700' },
  hourMeta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  hourMetaText: { color: OASIS.colors.muted, fontSize: 11, fontWeight: '600' },

  divider: { height: 1, backgroundColor: OASIS.colors.line, marginTop: 6, marginBottom: 4 },

  dayRow: { flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: OASIS.colors.line, gap: 7 },
  dayName: { color: OASIS.colors.ink, fontSize: 11.5, fontWeight: '600', width: 44, textAlign: 'right' },
  dayCondition: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', gap: 7 },
  dayConditionText: { color: OASIS.colors.muted, fontSize: 11 },
  dayHigh: { color: OASIS.colors.ink, fontSize: 12, fontWeight: '700', width: 26, textAlign: 'center' },
  dayLow: { color: '#94a3b8', fontSize: 12, fontWeight: '700', width: 26, textAlign: 'center' },
  dayTrack: { width: 74, height: 6, borderRadius: 3, backgroundColor: '#eef2f7', overflow: 'hidden' },
  dayRangeBar: { height: 6, borderRadius: 3, backgroundColor: OASIS.colors.warning },

  sectionTag: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, backgroundColor: '#f0fdfa', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10 },
  sectionTagText: { color: '#0f766e', fontSize: 11, fontWeight: '600' },
  airSummary: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginHorizontal: 12, marginBottom: 6, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: OASIS.colors.line },
  aqiBadge: { width: 62, height: 62, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  aqiNumber: { fontSize: 22, fontWeight: '700' },
  aqiLabel: { color: OASIS.colors.muted, fontSize: 11, fontWeight: '600' },
  airCopy: { flex: 1, alignItems: 'flex-end', gap: 6 },
  airTitle: { fontSize: 12.5, fontWeight: '700', textAlign: 'right' },
  aqiTrack: { width: '100%', height: 6, borderRadius: 3, backgroundColor: '#ffffffaa', overflow: 'hidden' },
  aqiFill: { height: 6, borderRadius: 3 },
  airDescription: { color: OASIS.colors.muted, fontSize: 11, lineHeight: 18, textAlign: 'right', flex: 1 },
  airUnavailable: { flexDirection: 'row-reverse', alignItems: 'center', gap: 9, padding: 14, marginHorizontal: 12, backgroundColor: OASIS.colors.background, borderRadius: 13 },

  tipsCard: { marginHorizontal: 12, marginTop: 10, marginBottom: 12, padding: 13, backgroundColor: OASIS.colors.soft, borderRadius: 15, borderWidth: 1, borderColor: '#dcfce7', gap: 8 },
  tipsHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  tipsTitle: { color: OASIS.colors.deep, fontSize: 12.5, fontWeight: '700', textAlign: 'right' },
  tipText: { color: OASIS.colors.ink, fontSize: 11.5, textAlign: 'right', lineHeight: 18 },
  disclaimer: { color: OASIS.colors.muted, fontSize: 11, textAlign: 'right', lineHeight: 19, borderTopWidth: 1, borderTopColor: '#bbf7d0', paddingTop: 8 },
  weatherFooter: { paddingHorizontal: 14, paddingVertical: 12, backgroundColor: OASIS.colors.background, gap: 4, borderTopWidth: 1, borderTopColor: OASIS.colors.line },
  sourceText: { color: '#94a3b8', fontSize: 11, textAlign: 'right' },
  uvText: { color: OASIS.colors.muted, fontSize: 11, textAlign: 'right', fontWeight: '700' },

  alertBanner: { borderRadius: 15, borderWidth: 1, padding: 11, gap: 6 },
  alertBannerTop: { flexDirection: 'row-reverse', alignItems: 'center', gap: 9 },
  alertIconWrap: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  alertBannerCopy: { flex: 1, alignItems: 'flex-end', gap: 2 },
  alertBadge: { fontSize: 11, fontWeight: '700' },
  alertTitle: { fontSize: 13.5, fontWeight: '800', textAlign: 'right' },
  alertMessage: { fontSize: 11, lineHeight: 18, textAlign: 'right' },
  alertList: { gap: 6, marginTop: 4, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)', paddingTop: 8 },
  alertRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 7 },
  alertRowText: { fontSize: 11, fontWeight: '700', textAlign: 'right', flex: 1 },

  actionsCard: { marginHorizontal: 12, marginTop: 0, marginBottom: 12, padding: 14, backgroundColor: OASIS.colors.surface, borderRadius: 14, borderWidth: 1, borderColor: OASIS.colors.line, gap: 10 },
  actionsHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  actionsTitle: { color: OASIS.colors.ink, fontSize: 13, fontWeight: '700', textAlign: 'right' },
  actionPrimary: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: OASIS.colors.primary, borderRadius: 13, paddingVertical: 12 },
  actionPrimaryText: { color: OASIS.colors.surface, fontSize: 13, fontWeight: '700' },
  actionSecondary: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: OASIS.colors.dangerSoft, borderWidth: 1, borderColor: '#fecaca', borderRadius: 13, paddingVertical: 12 },
  actionSecondaryText: { color: OASIS.colors.danger, fontSize: 13, fontWeight: '700' },
  actionDisabled: { opacity: 0.55 },

  infoCard: { backgroundColor: OASIS.colors.surface, borderRadius: 16, padding: 15, borderWidth: 1, borderColor: OASIS.colors.line, gap: 6 },
  infoTitle: { color: OASIS.colors.ink, fontSize: 13, fontWeight: '700', textAlign: 'right' },
  infoText: { color: OASIS.colors.muted, fontSize: 11.5, lineHeight: 19, textAlign: 'right' },
});

const screenStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: OASIS.colors.background },
  hero: {
    paddingTop: Platform.OS === 'ios' ? 54 : 40,
    paddingHorizontal: 16,
    paddingBottom: 14,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: { flex: 1, alignItems: 'flex-end', gap: 4 },
  livePill: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.16)', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 14 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#6ee7b7' },
  liveText: { color: OASIS.colors.soft, fontSize: 11, fontWeight: '600' },
  title: { color: OASIS.colors.surface, fontSize: 20, fontWeight: '700' },
  subtitle: { color: OASIS.colors.soft, fontSize: 12, fontWeight: '600', textAlign: 'right' },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTemp: { color: OASIS.colors.surface, fontSize: 24, fontWeight: '700' },
  scroll: { paddingTop: 11 },
  content: { width: '100%', maxWidth: 800, alignSelf: 'center', paddingHorizontal: 13, gap: 11 },
});
