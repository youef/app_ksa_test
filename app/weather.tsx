import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { AppHeader } from '@/components/shared/AppHeader';
import {
  ChevronRight,
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
  Megaphone,
  Bell,
  Send,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useBottomNavInset } from '@/lib/bottomNav';
import { sendPushToMultipleUsers } from '@/lib/pushSender';

type WeatherData = {
  city: string;
  region: string;
  district: string;
  latitude: number;
  longitude: number;
  current: any;
  hourly: any;
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
  if (value <= 50) return { label: 'هواء نظيف', color: '#047857', bg: '#dcfce7', bar: '#10b981' };
  if (value <= 100) return { label: 'هواء مقبول', color: '#b45309', bg: '#fef3c7', bar: '#f59e0b' };
  if (value <= 150) return { label: 'غير صحي للفئات الحساسة', color: '#c2410c', bg: '#ffedd5', bar: '#f97316' };
  if (value <= 200) return { label: 'غير صحي', color: '#b91c1c', bg: '#fee2e2', bar: '#ef4444' };
  return { label: 'ضار بالصحة', color: '#7f1d1d', bg: '#fecaca', bar: '#dc2626' };
}

function formatClock(value?: string | null) {
  if (!value) return '--';
  return new Date(value).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
}

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

  if (nowRain >= 0.5 || rainSum >= 20) alerts.push({ id: 'rain', severity: 'danger', icon: 'rain', title: 'أمطار غزيرة', message: 'احتمال تجمّع المياه؛ تجنّب الأودية والمناطق المنخفضة.' });
  else if (rainProb >= 60 || rainSum >= 5) alerts.push({ id: 'rain', severity: 'warning', icon: 'rain', title: 'احتمال هطول قوي', message: 'خذ مظلتك وتابع تحديثات الطقس.' });
  else if (rainProb >= 40 || nowRain > 0) alerts.push({ id: 'rain', severity: 'info', icon: 'rain', title: 'احتمال هطول', message: 'قد تظهر أمطار متفرقة.' });

  if (wind >= 45 || gusts >= 65) alerts.push({ id: 'wind', severity: 'danger', icon: 'wind', title: 'رياح شديدة', message: 'احذر أثناء القيادة وثبّت الأجسام الخفيفة.' });
  else if (wind >= 30 || gusts >= 45) alerts.push({ id: 'wind', severity: 'warning', icon: 'wind', title: 'رياح نشطة', message: 'توخّ الحذر، خصوصاً على الطرق المفتوحة.' });

  if ((Number.isFinite(dust) && dust >= 200) || (Number.isFinite(pm10) && pm10 >= 300) || (Number.isFinite(aqi) && aqi >= 150)) alerts.push({ id: 'dust', severity: 'danger', icon: 'dust', title: 'غبار كثيف / هواء غير صحي', message: 'أبقِ النوافذ مغلقة، شغّل أجهزة التنقية، وارتدِ كمامة عند الخروج.' });
  else if ((Number.isFinite(dust) && dust >= 100) || (Number.isFinite(pm10) && pm10 >= 150) || (Number.isFinite(aqi) && aqi >= 100)) alerts.push({ id: 'dust', severity: 'warning', icon: 'dust', title: 'تصاعد غبار / جودة هواء متأثرة', message: 'الفئات الحساسة يفضّل تقليل الأنشطة الخارجية.' });

  if (uv >= 11) alerts.push({ id: 'uv', severity: 'danger', icon: 'uv', title: 'أشعة فوق بنفسجية شديدة', message: 'تجنّب الشمس وقت الذروة واستخدم واقياً بمعامل عالٍ.' });
  else if (uv >= 8) alerts.push({ id: 'uv', severity: 'warning', icon: 'uv', title: 'أشعة فوق بنفسجية مرتفعة', message: 'استخدم واقي الشمس والقبعة.' });

  if ((Number.isFinite(pm25) && pm25 >= 35) || (Number.isFinite(dust) && dust >= 100)) alerts.push({ id: 'health', severity: 'info', icon: 'health', title: 'تنبيه لمن لديهم ربو أو حساسية', message: 'احمل بخّاخك وتجنّب الجهد الخارجي عند تدهور الهواء.' });

  if (!alerts.length) alerts.push({ id: 'ok', severity: 'info', icon: 'ok', title: 'الأجواء مستقرّة', message: 'لا توجد تنبيهات جوّية مهمة الآن.' });
  return alerts;
}

function severityTheme(severity: string) {
  if (severity === 'danger') return { bg: '#fef2f2', border: '#fecaca', text: '#991b1b', accent: '#dc2626', label: 'تحذير' };
  if (severity === 'warning') return { bg: '#fff7ed', border: '#fed7aa', text: '#9a3412', accent: '#ea580c', label: 'تنبيه' };
  return { bg: '#ecfdf5', border: '#a7f3d0', text: '#065f46', accent: '#059669', label: 'معلومة' };
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

  const fetchWeather = async (latitude: number, longitude: number, meta: { city: string; region: string; district: string }) => {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + latitude +
      '&longitude=' + longitude +
      '&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl,cloud_cover' +
      '&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m,relative_humidity_2m' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_sum,precipitation_probability_max,wind_speed_10m_max&forecast_days=7&timezone=auto';
    const response = await fetch(url);
    if (!response.ok) throw new Error('خدمة الطقس غير متاحة حالياً.');
    const data = await response.json();
    if (!data.current || !data.daily) throw new Error('وصلت بيانات طقس غير مكتملة.');
    let air: any = null;
    try {
      const airResponse = await fetch('https://air-quality-api.open-meteo.com/v1/air-quality?latitude=' + latitude + '&longitude=' + longitude + '&current=us_aqi,pm10,pm2_5,dust&timezone=auto');
      if (airResponse.ok) {
        const airData = await airResponse.json();
        air = airData.current || null;
      }
    } catch {}
    setWeather({ city: meta.city || 'موقعك الحالي', region: meta.region || '', district: meta.district || '', latitude, longitude, current: data.current, hourly: data.hourly, daily: data.daily, air });
    setLastUpdated(new Date());
    setError('');
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
      const geoResponse = await fetch('https://geocoding-api.open-meteo.com/v1/search?name=' +
        encodeURIComponent(trimmed) + '&count=1&language=ar&format=json');
      if (!geoResponse.ok) throw new Error('تعذّر الاتصال بخدمة تحديد المدينة.');
      const geo = await geoResponse.json();
      const place = geo.results && geo.results[0];
      if (!place) throw new Error('لم نعثر على المدينة. جرّب كتابة اسمها بالعربية أو الإنجليزية.');
      await fetchWeather(place.latitude, place.longitude, { city: place.name || trimmed, region: place.admin1 || '', district: '' });
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
      const meta = await resolvePlace(latitude, longitude);
      if (!meta.city) meta.city = 'موقعك الحالي';
      setCityInput(meta.city === 'موقعك الحالي' ? '' : meta.city);
      await fetchWeather(latitude, longitude, meta);
    } catch (err: any) {
      setError(err?.message || 'تعذّر تحديد موقعك.');
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      if (weather) await fetchWeather(weather.latitude, weather.longitude, { city: weather.city, region: weather.region, district: weather.district });
      else if (cityInput.trim()) await loadWeatherForCity(cityInput);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const user = data.session?.user;
        if (!user) return;
        const { data: profile } = await supabase.from('profiles').select('city').eq('id', user.id).maybeSingle();
        if (active && profile?.city) {
          setCityInput(profile.city);
          loadWeatherForCity(profile.city);
        }
      } catch {}
    })();
    return () => {
      active = false;
    };
  }, []);

  const hourlyIndices = (() => {
    if (!weather?.hourly?.time) return [];
    const now = new Date();
    let start = weather.hourly.time.findIndex((time: string) => new Date(time).getTime() >= now.getTime() - 3600000);
    if (start < 0) start = 0;
    return Array.from({ length: 12 }, (_, i) => start + i).filter((index) => index < weather.hourly.time.length);
  })();

  const dayLabel = (value: string, index: number) => {
    if (index === 0) return 'اليوم';
    if (index === 1) return 'غداً';
    return new Intl.DateTimeFormat('ar-SA', { weekday: 'short' }).format(new Date(value + 'T12:00:00'));
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
              backgroundColor: '#ecfdf5',
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 14,
            }}>
              <Sun size={14} color="#059669" />
              <Text style={{ fontSize: 13, fontWeight: '900', color: '#059669' }}>{round(weather.current.temperature_2m)}°</Text>
            </View>
          ) : undefined
        }
      />

      <ScrollView
        contentContainerStyle={[screenStyles.scroll, { paddingBottom: bottomNavInset + 28 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#047857" colors={['#047857']} />}
      >
        <View style={screenStyles.content}>
          {weather && topAlert ? (
            <View style={[styles.alertBanner, { backgroundColor: bannerMeta.bg, borderColor: bannerMeta.border }]}>
              <View style={styles.alertBannerTop}>
                <View style={[styles.alertIconWrap, { backgroundColor: bannerMeta.accent }]}>
                  <AlertIcon kind={topAlert.icon} size={16} color="#fff" />
                </View>
                <View style={styles.alertBannerCopy}>
                  <Text style={[styles.alertBadge, { color: bannerMeta.accent }]}>{bannerMeta.label} · {alerts.length}</Text>
                  <Text style={[styles.alertTitle, { color: bannerMeta.text }]}>{topAlert.title}</Text>
                </View>
              </View>
              <Text style={[styles.alertMessage, { color: bannerMeta.text }]}>{topAlert.message}</Text>
              {sortedAlerts.length > 1 ? (
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
          ) : null}

          {/* City search */}
          <View style={styles.searchCard}>
            <View style={styles.citySearchRow}>
              <Pressable style={styles.locationButton} onPress={useDeviceLocation} disabled={loading}>
                <Navigation size={15} color="#047857" />
                <Text style={styles.locationButtonText}>موقعي</Text>
              </Pressable>
              <Pressable style={styles.searchButton} onPress={() => loadWeatherForCity(cityInput)} disabled={loading || !cityInput.trim()}>
                <Search size={15} color="#fff" />
              </Pressable>
              <TextInput
                value={cityInput}
                onChangeText={setCityInput}
                placeholder="اكتب اسم المدينة"
                placeholderTextColor="#94a3b8"
                style={styles.cityInput}
                textAlign="right"
                returnKeyType="search"
                onSubmitEditing={() => loadWeatherForCity(cityInput)}
              />
              <MapPin size={16} color="#94a3b8" />
            </View>
            {error ? <Text style={styles.errorText}>{error}</Text> : null}
          </View>

          {weather ? (
            <View style={styles.locationCard}>
              <View style={styles.locationCardHeader}>
                <MapPin size={15} color="#047857" />
                <Text style={styles.locationCardTitle}>الموقع المستخدم لحساب الطقس</Text>
              </View>
              <View style={styles.locationGrid}>
                <LocationItem label="المنطقة" value={weather.region} />
                <LocationItem label="المدينة" value={weather.city} />
                <LocationItem label="الحي" value={weather.district} />
                <LocationItem label="الإحداثيات" value={weather.latitude.toFixed(3) + '، ' + weather.longitude.toFixed(3)} />
              </View>
            </View>
          ) : null}

          {/* Current conditions */}
          <View style={styles.card}>
            <LinearGradient
              colors={weather?.current?.is_day ? ['#0f766e', '#0e7490', '#155e75'] : ['#1e3a5f', '#334155', '#475569']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.currentPanel}
            >
              {weather ? (
                <>
                  <View style={styles.panelTop}>
                    <Pressable onPress={refresh} disabled={loading} style={styles.refreshButton} accessibilityLabel="تحديث الطقس">
                      {loading ? <ActivityIndicator size="small" color="#fff" /> : <RefreshCw size={16} color="#fff" />}
                    </Pressable>
                    <Text style={styles.panelUpdated}>آخر تحديث {lastUpdated ? lastUpdated.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : ''}</Text>
                  </View>
                  <View style={styles.panelLocation}>
                    <MapPin size={13} color="#d1fae5" />
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
                  {loading ? <ActivityIndicator size="large" color="#fff" /> : <><CloudSun size={40} color="#fde68a" /><Text style={styles.emptyTitle}>اعرف أجواء مدينتك</Text><Text style={styles.emptySub}>طقس فعلي وتوقعات محدثة من Open-Meteo</Text></>}
                </View>
              )}
            </LinearGradient>

            {weather && (
              <>
                <View style={styles.metricsGrid}>
                  <Metric icon={<Thermometer size={17} color="#2563eb" />} bg="#eff6ff" label="المحسوسة" value={round(weather.current.apparent_temperature)} unit="°" />
                  <Metric icon={<Droplets size={17} color="#0891b2" />} bg="#ecfeff" label="الرطوبة" value={round(weather.current.relative_humidity_2m)} unit="%" />
                  <Metric icon={<Wind size={17} color="#16a34a" />} bg="#f0fdf4" label={'الرياح' + (windDir(weather.current.wind_direction_10m) ? ' · ' + windDir(weather.current.wind_direction_10m) : '')} value={round(weather.current.wind_speed_10m)} unit="كم/س" />
                  <Metric icon={<Gauge size={17} color="#7c3aed" />} bg="#f5f3ff" label="هبّات الرياح" value={round(weather.current.wind_gusts_10m)} unit="كم/س" />
                  <Metric icon={<Cloud size={17} color="#0891b2" />} bg="#f0f9ff" label="الغيوم" value={round(weather.current.cloud_cover)} unit="%" />
                  <Metric icon={<Gauge size={17} color="#b45309" />} bg="#fffbeb" label="الضغط" value={round(weather.current.pressure_msl)} unit="hPa" />
                  <Metric icon={<Sun size={17} color="#d97706" />} bg="#fff7ed" label="مؤشر UV" value={round(weather.daily.uv_index_max?.[0])} unit="" />
                  <Metric icon={<Umbrella size={17} color="#ea580c" />} bg="#fff7ed" label="احتمال الهطول" value={round(weather.daily.precipitation_probability_max?.[0])} unit="%" />
                </View>

                {/* Hourly */}
                <View style={styles.blockHeader}><Text style={styles.blockTitle}>توقعات الساعات القادمة</Text><Text style={styles.blockHint}>12 ساعة</Text></View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hourlyList}>
                  {hourlyIndices.map((index) => (
                    <View key={weather.hourly.time[index]} style={styles.hourCard}>
                      <Text style={styles.hourText}>{new Date(weather.hourly.time[index]).toLocaleTimeString('ar-SA', { hour: '2-digit', hour12: true })}</Text>
                      <WeatherGlyph code={weather.hourly.weather_code[index]} size={23} />
                      <Text style={styles.hourTemp}>{round(weather.hourly.temperature_2m[index])}°</Text>
                      <View style={styles.hourMeta}><Droplets size={10} color="#0284c7" /><Text style={styles.hourMetaText}>{weather.hourly.precipitation_probability[index] ?? 0}%</Text></View>
                      <View style={styles.hourMeta}><Wind size={10} color="#16a34a" /><Text style={styles.hourMetaText}>{round(weather.hourly.wind_speed_10m?.[index])}</Text></View>
                    </View>
                  ))}
                </ScrollView>

                <View style={styles.divider} />

                {/* Daily with range bars */}
                <View style={styles.blockHeader}><Text style={styles.blockTitle}>توقعات 7 أيام</Text><Text style={styles.blockHint}>العظمى / الصغرى</Text></View>
                {weather.daily.time.map((date: string, index: number) => {
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
                        <Text style={styles.dayConditionText}>{weatherDescription(weather.daily.weather_code[index])}</Text>
                        <WeatherGlyph code={weather.daily.weather_code[index]} size={21} />
                      </View>
                      <Text style={styles.dayName}>{dayLabel(date, index)}</Text>
                    </View>
                  );
                })}

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
                      <Metric icon={<Waves size={17} color="#b45309" />} bg="#fffbeb" label="الغبار" value={weather.air.dust == null ? '--' : Number(weather.air.dust).toFixed(1)} unit="µg/m³" />
                      <Metric icon={<Sun size={17} color="#d97706" />} bg="#fff7ed" label="ذروة UV اليوم" value={round(weather.daily.uv_index_max?.[0])} unit="" />
                    </View>
                  </>
                ) : (
                  <View style={styles.airUnavailable}><Info size={17} color="#64748b" /><Text style={styles.airDescription}>بيانات جودة الهواء غير متاحة حالياً لهذا الموقع.</Text></View>
                )}

                {/* Guidance */}
                <View style={styles.tipsCard}>
                  <View style={styles.tipsHeader}><Eye size={16} color="#065f46" /><Text style={styles.tipsTitle}>إرشادات عامة</Text></View>
                  {tips.map((tip, i) => <Text key={i} style={styles.tipText}>• {tip}</Text>)}
                  <Text style={styles.disclaimer}>البيانات والإرشادات تقديرية ولا تغني عن التنبيهات الرسمية.</Text>
                </View>

                {/* Share / notify neighbors */}
                <View style={styles.actionsCard}>
                  <View style={styles.actionsHeader}>
                    <Megaphone size={16} color="#065f46" />
                    <Text style={styles.actionsTitle}>شارك حالة الطقس مع جيرانك</Text>
                  </View>
                  <Pressable style={[styles.actionPrimary, sharing && styles.actionDisabled]} onPress={shareWeatherPost} disabled={sharing}>
                    {sharing ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Send size={16} color="#fff" />
                        <Text style={styles.actionPrimaryText}>انشر حالة الطقس في حيّك</Text>
                      </>
                    )}
                  </Pressable>
                  <Pressable style={[styles.actionSecondary, sharing && styles.actionDisabled]} onPress={notifyNeighbors} disabled={sharing}>
                    <Bell size={16} color="#b91c1c" />
                    <Text style={styles.actionSecondaryText}>نبّه جيرانك بإشعار</Text>
                  </Pressable>
                </View>

                <View style={styles.weatherFooter}>
                  <Text style={styles.sourceText}>المصدر: Open-Meteo · آخر تحديث {lastUpdated ? lastUpdated.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : ''}</Text>
                  <Text style={styles.uvText}>مؤشر الأشعة فوق البنفسجية اليوم: {round(weather.daily.uv_index_max?.[0])}</Text>
                </View>
              </>
            )}
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>عن بيانات الطقس</Text>
            <Text style={styles.infoText}>تعرض هذه الصفحة بيانات الطقس والتوقعات من Open-Meteo، وجودة الهواء من Open-Meteo Air Quality. قد تختلف التوقعات عن الظروف الفعلية، ويظهر وقت آخر تحديث أعلى البطاقة.</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

function Metric({ icon, bg, label, value, unit }: { icon: any; bg: string; label: string; value: string; unit: string }) {
  return (
    <View style={styles.metricCard}>
      <View style={[styles.metricIcon, { backgroundColor: bg }]}>{icon}</View>
      <Text style={styles.metricLabel} numberOfLines={1}>{label}</Text>
      <Text style={styles.metricValue}>{value}{unit ? <Text style={styles.metricUnit}> {unit}</Text> : null}</Text>
    </View>
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
  searchCard: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
  citySearchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  locationButton: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, backgroundColor: '#ecfdf5', borderRadius: 11, paddingHorizontal: 11, paddingVertical: 10 },
  locationButtonText: { color: '#047857', fontSize: 11.5, fontWeight: '900' },
  searchButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: '#047857', borderRadius: 11 },
  cityInput: { flex: 1, minWidth: 80, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 11, paddingHorizontal: 11, paddingVertical: 9, color: '#0f172a', fontSize: 12.5 },
  errorText: { color: '#b91c1c', fontSize: 11.5, textAlign: 'right', paddingHorizontal: 14, paddingBottom: 10, lineHeight: 17 },

  locationCard: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#e2e8f0', padding: 14, gap: 10 },
  locationCardHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  locationCardTitle: { color: '#0f172a', fontSize: 12.5, fontWeight: '900', textAlign: 'right' },
  locationGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  locationItem: { flexGrow: 1, flexBasis: '44%', backgroundColor: '#f8fafc', borderRadius: 13, padding: 10, gap: 3, alignItems: 'flex-end' },
  locationItemLabel: { color: '#64748b', fontSize: 10.5, fontWeight: '700' },
  locationItemValue: { color: '#0f172a', fontSize: 12.5, fontWeight: '900', textAlign: 'right' },
  panelLocation: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, marginTop: 8 },
  panelLocationText: { color: '#d1fae5', fontSize: 11, fontWeight: '700', textAlign: 'right' },

  card: { backgroundColor: '#fff', borderRadius: 23, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden', shadowColor: '#0f172a', shadowOpacity: 0.05, shadowRadius: 12, elevation: 2 },
  currentPanel: { padding: 17, minHeight: 196 },
  panelTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  panelUpdated: { color: '#d1fae5', fontSize: 10.5, fontWeight: '700' },
  refreshButton: { width: 34, height: 34, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  currentMain: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16 },
  tempAndIcon: { flexDirection: 'row-reverse', alignItems: 'center', gap: 9 },
  temperature: { color: '#fff', fontSize: 51, fontWeight: '300', letterSpacing: -2 },
  tempCopy: { alignItems: 'flex-end', gap: 5 },
  conditionText: { color: '#fff', fontSize: 16, fontWeight: '900' },
  feelsLike: { color: '#dbeafe', fontSize: 11.5 },
  hiLo: { color: '#c7f9e5', fontSize: 11, fontWeight: '700' },
  sunTimes: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 13, padding: 10, gap: 13 },
  sunTimeItem: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', gap: 5 },
  sunTimeText: { color: '#e2e8f0', fontSize: 10 },
  sunTimeValue: { color: '#fff', fontSize: 10.5, fontWeight: '800' },
  sunTimeDivider: { width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.25)' },
  emptyWeather: { alignItems: 'center', justifyContent: 'center', gap: 9, paddingVertical: 24 },
  emptyTitle: { color: '#fff', fontSize: 16, fontWeight: '900' },
  emptySub: { color: '#e0f2fe', fontSize: 11, textAlign: 'center', lineHeight: 17 },

  metricsGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', padding: 11, gap: 8 },
  metricCard: { width: '48%', flexGrow: 1, flexBasis: '44%', backgroundColor: '#fff', borderWidth: 1, borderColor: '#f1f5f9', borderRadius: 15, padding: 11, alignItems: 'flex-end', gap: 5 },
  metricIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  metricLabel: { color: '#64748b', fontSize: 10.5, fontWeight: '700' },
  metricValue: { color: '#0f172a', fontSize: 18, fontWeight: '900' },
  metricUnit: { color: '#64748b', fontSize: 9.5, fontWeight: '700' },

  blockHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 8, paddingBottom: 10 },
  blockTitle: { color: '#0f172a', fontSize: 13.5, fontWeight: '900' },
  blockHint: { color: '#94a3b8', fontSize: 10.5 },

  hourlyList: { flexDirection: 'row-reverse', gap: 8, paddingHorizontal: 12, paddingBottom: 14 },
  hourCard: { minWidth: 68, alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, paddingHorizontal: 8, borderRadius: 14, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#f1f5f9' },
  hourText: { color: '#64748b', fontSize: 10 },
  hourTemp: { color: '#0f172a', fontSize: 15, fontWeight: '900' },
  hourMeta: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  hourMetaText: { color: '#64748b', fontSize: 9.5, fontWeight: '800' },

  divider: { height: 1, backgroundColor: '#e2e8f0', marginTop: 6, marginBottom: 4 },

  dayRow: { flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9', gap: 9 },
  dayName: { color: '#334155', fontSize: 11.5, fontWeight: '800', width: 44, textAlign: 'right' },
  dayCondition: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', gap: 7 },
  dayConditionText: { color: '#64748b', fontSize: 11 },
  dayHigh: { color: '#0f172a', fontSize: 12, fontWeight: '900', width: 26, textAlign: 'center' },
  dayLow: { color: '#94a3b8', fontSize: 12, fontWeight: '700', width: 26, textAlign: 'center' },
  dayTrack: { width: 74, height: 6, borderRadius: 3, backgroundColor: '#eef2f7', overflow: 'hidden' },
  dayRangeBar: { height: 6, borderRadius: 3, backgroundColor: '#f59e0b' },

  sectionTag: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, backgroundColor: '#f0fdfa', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10 },
  sectionTagText: { color: '#0f766e', fontSize: 9.5, fontWeight: '800' },
  airSummary: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginHorizontal: 12, marginBottom: 6, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0' },
  aqiBadge: { width: 62, height: 62, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  aqiNumber: { fontSize: 22, fontWeight: '900' },
  aqiLabel: { color: '#64748b', fontSize: 9, fontWeight: '800' },
  airCopy: { flex: 1, alignItems: 'flex-end', gap: 6 },
  airTitle: { fontSize: 12.5, fontWeight: '900', textAlign: 'right' },
  aqiTrack: { width: '100%', height: 6, borderRadius: 3, backgroundColor: '#ffffffaa', overflow: 'hidden' },
  aqiFill: { height: 6, borderRadius: 3 },
  airDescription: { color: '#64748b', fontSize: 10.5, lineHeight: 17, textAlign: 'right', flex: 1 },
  airUnavailable: { flexDirection: 'row-reverse', alignItems: 'center', gap: 9, padding: 14, marginHorizontal: 12, backgroundColor: '#f8fafc', borderRadius: 13 },

  tipsCard: { marginHorizontal: 12, marginTop: 10, marginBottom: 12, padding: 13, backgroundColor: '#f0fdf4', borderRadius: 15, borderWidth: 1, borderColor: '#dcfce7', gap: 8 },
  tipsHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  tipsTitle: { color: '#065f46', fontSize: 12.5, fontWeight: '900', textAlign: 'right' },
  tipText: { color: '#334155', fontSize: 11.5, textAlign: 'right', lineHeight: 18 },
  disclaimer: { color: '#64748b', fontSize: 9.5, textAlign: 'right', lineHeight: 16, borderTopWidth: 1, borderTopColor: '#bbf7d0', paddingTop: 8 },
  weatherFooter: { paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#f8fafc', gap: 4, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  sourceText: { color: '#94a3b8', fontSize: 9.5, textAlign: 'right' },
  uvText: { color: '#64748b', fontSize: 10.5, textAlign: 'right', fontWeight: '700' },

  alertBanner: { marginHorizontal: 12, marginTop: 10, marginBottom: 2, borderRadius: 18, borderWidth: 1, padding: 14, gap: 8 },
  alertBannerTop: { flexDirection: 'row-reverse', alignItems: 'center', gap: 9 },
  alertIconWrap: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  alertBannerCopy: { flex: 1, alignItems: 'flex-end', gap: 2 },
  alertBadge: { fontSize: 10, fontWeight: '900' },
  alertTitle: { fontSize: 14.5, fontWeight: '900', textAlign: 'right' },
  alertMessage: { fontSize: 11.5, lineHeight: 18, textAlign: 'right' },
  alertList: { gap: 6, marginTop: 4, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)', paddingTop: 8 },
  alertRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 7 },
  alertRowText: { fontSize: 11, fontWeight: '700', textAlign: 'right', flex: 1 },

  actionsCard: { marginHorizontal: 12, marginTop: 0, marginBottom: 12, padding: 14, backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#e2e8f0', gap: 10 },
  actionsHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  actionsTitle: { color: '#0f172a', fontSize: 13, fontWeight: '900', textAlign: 'right' },
  actionPrimary: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#047857', borderRadius: 13, paddingVertical: 12 },
  actionPrimaryText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  actionSecondary: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 13, paddingVertical: 12 },
  actionSecondaryText: { color: '#b91c1c', fontSize: 13, fontWeight: '900' },
  actionDisabled: { opacity: 0.55 },

  infoCard: { backgroundColor: '#fff', borderRadius: 16, padding: 15, borderWidth: 1, borderColor: '#e2e8f0', gap: 6 },
  infoTitle: { color: '#0f172a', fontSize: 13, fontWeight: '900', textAlign: 'right' },
  infoText: { color: '#64748b', fontSize: 11.5, lineHeight: 19, textAlign: 'right' },
});

const screenStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  hero: {
    paddingTop: Platform.OS === 'ios' ? 54 : 40,
    paddingHorizontal: 16,
    paddingBottom: 22,
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
  livePill: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.16)', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#6ee7b7' },
  liveText: { color: '#d1fae5', fontSize: 10, fontWeight: '800' },
  title: { color: '#fff', fontSize: 27, fontWeight: '900' },
  subtitle: { color: '#d1fae5', fontSize: 12, fontWeight: '600', textAlign: 'right' },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTemp: { color: '#fff', fontSize: 24, fontWeight: '900' },
  scroll: { paddingTop: 16 },
  content: { width: '100%', maxWidth: 800, alignSelf: 'center', paddingHorizontal: 16, gap: 16 },
});
