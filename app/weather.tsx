import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Platform, ActivityIndicator, TextInput } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { ChevronRight, MapPin, RefreshCw, Sun, Cloud, CloudRain, CloudSun, CloudFog, Wind, Droplets, Thermometer, Sunrise, Sunset, Search } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useBottomNavInset } from '@/lib/bottomNav';

export default function WeatherScreen() {
  const bottomNavInset = useBottomNavInset();
  const [initialCity, setInitialCity] = useState('');
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const user = data.session?.user;
        if (!user) return;
        const { data: profile } = await supabase.from('profiles').select('city').eq('id', user.id).maybeSingle();
        if (active && profile?.city) setInitialCity(profile.city);
      } catch {}
    })();
    return () => { active = false; };
  }, []);

  return (
    <View style={screenStyles.container}>
      <LinearGradient colors={['#064e3b', '#047857', '#0e7490']} start={{x:0,y:0}} end={{x:1,y:1}} style={screenStyles.hero}>
        <Pressable onPress={() => router.back()} style={screenStyles.backButton} accessibilityRole="button" accessibilityLabel="رجوع">
          <ChevronRight size={22} color="#fff" />
        </Pressable>
        <View style={screenStyles.heroCopy}>
          <Text style={screenStyles.eyebrow}>حيّنا · معلومات جوية</Text>
          <Text style={screenStyles.title}>الطقس</Text>
          <Text style={screenStyles.subtitle}>تابع حالة الجو والتوقعات في مدينتك بالتفصيل</Text>
        </View>
        <View style={screenStyles.heroIcon}><Sun size={30} color="#fde68a" /></View>
      </LinearGradient>
      <ScrollView contentContainerStyle={[screenStyles.scroll, { paddingBottom: bottomNavInset + 28 }]} showsVerticalScrollIndicator={false}>
        <View style={screenStyles.content}>
          <WeatherSection initialCity={initialCity} />
          <View style={screenStyles.infoCard}>
            <Text style={screenStyles.infoTitle}>عن بيانات الطقس</Text>
            <Text style={screenStyles.infoText}>تعرض هذه الصفحة بيانات الطقس والتوقعات من Open-Meteo. قد تختلف التوقعات عن الظروف الفعلية، ويظهر وقت آخر تحديث أسفل البيانات.</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

type WeatherData = { city: string; current: any; hourly: any; daily: any };

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

function WeatherSection({ initialCity }: { initialCity: string }) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [weatherError, setWeatherError] = useState('');
  const [cityInput, setCityInput] = useState(initialCity);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    if (initialCity.trim()) {
      setCityInput(initialCity);
      loadWeatherForCity(initialCity);
    }
  }, [initialCity]);

  const fetchWeather = async (latitude: number, longitude: number, city: string) => {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + latitude +
      '&longitude=' + longitude +
      '&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m' +
      '&hourly=temperature_2m,precipitation_probability,weather_code' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max&forecast_days=5&timezone=auto';
    const response = await fetch(url);
    if (!response.ok) throw new Error('خدمة الطقس غير متاحة حالياً.');
    const data = await response.json();
    if (!data.current || !data.daily) throw new Error('وصلت بيانات طقس غير مكتملة.');
    setWeather({ city: city, current: data.current, hourly: data.hourly, daily: data.daily });
    setLastUpdated(new Date());
    setWeatherError('');
  };

  const loadWeatherForCity = async (cityName: string) => {
    const trimmed = cityName.trim();
    if (!trimmed) {
      setWeatherError('اكتب اسم المدينة أو فعّل موقع الجهاز لعرض الطقس.');
      return;
    }
    setLoadingWeather(true);
    setWeatherError('');
    try {
      const geoResponse = await fetch('https://geocoding-api.open-meteo.com/v1/search?name=' +
        encodeURIComponent(trimmed) + '&count=1&language=ar&format=json');
      if (!geoResponse.ok) throw new Error('تعذّر الاتصال بخدمة تحديد المدينة.');
      const geo = await geoResponse.json();
      const place = geo.results && geo.results[0];
      if (!place) throw new Error('لم نعثر على المدينة. جرّب كتابة اسمها بالعربية أو الإنجليزية.');
      await fetchWeather(place.latitude, place.longitude, place.name || trimmed);
    } catch (error: any) {
      setWeatherError(error?.message || 'تعذّر تحميل بيانات الطقس. حاول مرة أخرى.');
    } finally {
      setLoadingWeather(false);
    }
  };

  const useDeviceLocation = async () => {
    setLoadingWeather(true);
    setWeatherError('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') throw new Error('اسمح باستخدام موقعك أثناء الاستخدام، أو اكتب اسم المدينة يدوياً.');
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      let city = 'موقعك الحالي';
      try {
        const addresses = await Location.reverseGeocodeAsync({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        const address = addresses[0];
        city = address?.city || address?.district || address?.region || city;
      } catch {}
      setCityInput(city === 'موقعك الحالي' ? '' : city);
      await fetchWeather(position.coords.latitude, position.coords.longitude, city);
    } catch (error: any) {
      setWeatherError(error?.message || 'تعذّر تحديد موقعك.');
    } finally {
      setLoadingWeather(false);
    }
  };

  const hourlyIndices = (() => {
    if (!weather?.hourly?.time) return [];
    const now = new Date();
    let start = weather.hourly.time.findIndex((time: string) => new Date(time).getTime() >= now.getTime() - 3600000);
    if (start < 0) start = 0;
    return Array.from({ length: 6 }, (_, i) => start + i).filter((index) => index < weather.hourly.time.length);
  })();

  const dayLabel = (value: string, index: number) => {
    if (index === 0) return 'اليوم';
    if (index === 1) return 'غداً';
    return new Intl.DateTimeFormat('ar-SA', { weekday: 'short' }).format(new Date(value + 'T12:00:00'));
  };

  return (
    <View style={weatherStyles.section}>
      <View style={weatherStyles.sectionHeading}>
        <View style={weatherStyles.livePill}><View style={weatherStyles.liveDot} /><Text style={weatherStyles.liveText}>بيانات مباشرة</Text></View>
        <View style={weatherStyles.headingCopy}>
          <Text style={weatherStyles.sectionTitle}>الطقس حولك</Text>
          <Text style={weatherStyles.sectionSubtitle}>الآن وتوقعات الأيام القادمة</Text>
        </View>
        <View style={weatherStyles.headingIcon}><Sun size={21} color="#d97706" /></View>
      </View>

      <View style={weatherStyles.card}>
        <LinearGradient
          colors={weather?.current?.is_day ? ['#0f766e', '#0e7490', '#155e75'] : ['#1e3a5f', '#334155', '#475569']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={weatherStyles.currentPanel}
        >
          <View style={weatherStyles.weatherTopLine}>
            <Pressable onPress={() => loadWeatherForCity(cityInput || weather?.city || '')} disabled={loadingWeather} style={weatherStyles.refreshButton} accessibilityLabel="تحديث الطقس">
              {loadingWeather ? <ActivityIndicator size="small" color="#fff" /> : <RefreshCw size={16} color="#fff" />}
            </Pressable>
            <View style={weatherStyles.cityLine}><MapPin size={14} color="#d1fae5" /><Text style={weatherStyles.cityName}>{weather?.city || 'اختر مدينتك'}</Text></View>
          </View>
          {weather ? (
            <>
              <View style={weatherStyles.currentMain}>
                <View style={weatherStyles.tempCopy}>
                  <Text style={weatherStyles.conditionText}>{weatherDescription(weather.current.weather_code)}</Text>
                  <Text style={weatherStyles.feelsLike}>المحسوسة {Math.round(weather.current.apparent_temperature)}°</Text>
                </View>
                <View style={weatherStyles.tempAndIcon}>
                  <WeatherGlyph code={weather.current.weather_code} size={43} color="#fde68a" />
                  <Text style={weatherStyles.temperature}>{Math.round(weather.current.temperature_2m)}°</Text>
                </View>
              </View>
              <View style={weatherStyles.sunTimes}>
                <View style={weatherStyles.sunTimeItem}><Sunset size={15} color="#fde68a" /><Text style={weatherStyles.sunTimeText}>الغروب</Text><Text style={weatherStyles.sunTimeValue}>{weather.daily.sunset?.[0] ? new Date(weather.daily.sunset[0]).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : '--'}</Text></View>
                <View style={weatherStyles.sunTimeDivider} />
                <View style={weatherStyles.sunTimeItem}><Sunrise size={15} color="#fde68a" /><Text style={weatherStyles.sunTimeText}>الشروق</Text><Text style={weatherStyles.sunTimeValue}>{weather.daily.sunrise?.[0] ? new Date(weather.daily.sunrise[0]).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : '--'}</Text></View>
              </View>
            </>
          ) : (
            <View style={weatherStyles.emptyWeather}>
              {loadingWeather ? <ActivityIndicator size="large" color="#fff" /> : <><CloudSun size={40} color="#fde68a" /><Text style={weatherStyles.emptyTitle}>اعرف أجواء مدينتك</Text><Text style={weatherStyles.emptySub}>طقس فعلي وتوقعات محدثة من Open-Meteo</Text></>}
            </View>
          )}
        </LinearGradient>

        <View style={weatherStyles.citySearchRow}>
          <Pressable style={weatherStyles.locationButton} onPress={useDeviceLocation} disabled={loadingWeather}><MapPin size={15} color="#047857" /><Text style={weatherStyles.locationButtonText}>موقعي</Text></Pressable>
          <Pressable style={weatherStyles.searchButton} onPress={() => loadWeatherForCity(cityInput)} disabled={loadingWeather || !cityInput.trim()}><Search size={15} color="#fff" /></Pressable>
          <TextInput value={cityInput} onChangeText={setCityInput} placeholder="اكتب اسم المدينة" placeholderTextColor="#94a3b8" style={weatherStyles.cityInput} textAlign="right" returnKeyType="search" onSubmitEditing={() => loadWeatherForCity(cityInput)} />
        </View>

        {weatherError ? <Text style={weatherStyles.errorText}>{weatherError}</Text> : null}

        {weather && (
          <>
            <View style={weatherStyles.metricsGrid}>
              <View style={weatherStyles.metricCard}><View style={[weatherStyles.metricIcon, { backgroundColor: '#eff6ff' }]}><Thermometer size={17} color="#2563eb" /></View><Text style={weatherStyles.metricLabel}>المحسوسة</Text><Text style={weatherStyles.metricValue}>{Math.round(weather.current.apparent_temperature)}°</Text></View>
              <View style={weatherStyles.metricCard}><View style={[weatherStyles.metricIcon, { backgroundColor: '#ecfeff' }]}><Droplets size={17} color="#0891b2" /></View><Text style={weatherStyles.metricLabel}>الرطوبة</Text><Text style={weatherStyles.metricValue}>{weather.current.relative_humidity_2m}%</Text></View>
              <View style={weatherStyles.metricCard}><View style={[weatherStyles.metricIcon, { backgroundColor: '#f0fdf4' }]}><Wind size={17} color="#16a34a" /></View><Text style={weatherStyles.metricLabel}>الرياح</Text><Text style={weatherStyles.metricValue}>{Math.round(weather.current.wind_speed_10m)} <Text style={weatherStyles.metricUnit}>كم/س</Text></Text></View>
              <View style={weatherStyles.metricCard}><View style={[weatherStyles.metricIcon, { backgroundColor: '#fff7ed' }]}><CloudRain size={17} color="#ea580c" /></View><Text style={weatherStyles.metricLabel}>الهطول</Text><Text style={weatherStyles.metricValue}>{weather.current.precipitation} <Text style={weatherStyles.metricUnit}>مم</Text></Text></View>
            </View>
            <View style={weatherStyles.forecastHeader}><Text style={weatherStyles.forecastTitle}>توقعات الساعات القادمة</Text><Text style={weatherStyles.forecastHint}>6 ساعات</Text></View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={weatherStyles.hourlyList}>
              {hourlyIndices.map((index) => (
                <View key={weather.hourly.time[index]} style={weatherStyles.hourCard}>
                  <Text style={weatherStyles.hourText}>{new Date(weather.hourly.time[index]).toLocaleTimeString('ar-SA', { hour: '2-digit', hour12: true })}</Text>
                  <WeatherGlyph code={weather.hourly.weather_code[index]} size={23} />
                  <Text style={weatherStyles.hourTemp}>{Math.round(weather.hourly.temperature_2m[index])}°</Text>
                  <View style={weatherStyles.rainChance}><Droplets size={10} color="#0284c7" /><Text style={weatherStyles.rainText}>{weather.hourly.precipitation_probability[index] ?? 0}%</Text></View>
                </View>
              ))}
            </ScrollView>
            <View style={weatherStyles.forecastHeader}><Text style={weatherStyles.forecastTitle}>توقعات 5 أيام</Text><Text style={weatherStyles.forecastHint}>العظمى / الصغرى</Text></View>
            {weather.daily.time.map((date: string, index: number) => (
              <View key={date} style={weatherStyles.dayRow}>
                <Text style={weatherStyles.dayLow}>{Math.round(weather.daily.temperature_2m_min[index])}°</Text>
                <Text style={weatherStyles.dayHigh}>{Math.round(weather.daily.temperature_2m_max[index])}°</Text>
                <View style={weatherStyles.dayCondition}><Text style={weatherStyles.dayConditionText}>{weatherDescription(weather.daily.weather_code[index])}</Text><WeatherGlyph code={weather.daily.weather_code[index]} size={21} /></View>
                <Text style={weatherStyles.dayName}>{dayLabel(date, index)}</Text>
              </View>
            ))}
            <View style={weatherStyles.weatherFooter}>
              <Text style={weatherStyles.sourceText}>المصدر: Open-Meteo · آخر تحديث {lastUpdated ? lastUpdated.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : ''}</Text>
              <Text style={weatherStyles.uvText}>مؤشر الأشعة فوق البنفسجية: {weather.daily.uv_index_max?.[0] ?? '--'}</Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const weatherStyles = StyleSheet.create({
  section: { gap: 10, marginBottom: 2 },
  sectionHeading: { flexDirection: 'row-reverse', alignItems: 'center', gap: 9, paddingHorizontal: 2 },
  headingCopy: { flex: 1, alignItems: 'flex-end', gap: 2 },
  sectionTitle: { fontSize: 17, fontWeight: '900', color: '#0f172a', textAlign: 'right' },
  sectionSubtitle: { fontSize: 11.5, color: '#64748b', textAlign: 'right' },
  headingIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#fffbeb', alignItems: 'center', justifyContent: 'center' },
  livePill: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, backgroundColor: '#ecfdf5', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 20 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },
  liveText: { color: '#047857', fontSize: 10, fontWeight: '800' },
  card: { backgroundColor: '#fff', borderRadius: 23, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden', shadowColor: '#0f172a', shadowOpacity: 0.05, shadowRadius: 12, elevation: 2 },
  currentPanel: { padding: 17, minHeight: 190 },
  weatherTopLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  refreshButton: { width: 34, height: 34, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  cityLine: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5 },
  cityName: { color: '#fff', fontSize: 13, fontWeight: '800' },
  currentMain: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16 },
  tempAndIcon: { flexDirection: 'row-reverse', alignItems: 'center', gap: 9 },
  temperature: { color: '#fff', fontSize: 51, fontWeight: '300', letterSpacing: -2 },
  tempCopy: { alignItems: 'flex-end', gap: 5 },
  conditionText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  feelsLike: { color: '#dbeafe', fontSize: 11.5 },
  sunTimes: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 13, padding: 10, gap: 13 },
  sunTimeItem: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', gap: 5 },
  sunTimeText: { color: '#e2e8f0', fontSize: 10 },
  sunTimeValue: { color: '#fff', fontSize: 10.5, fontWeight: '800' },
  sunTimeDivider: { width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.25)' },
  emptyWeather: { alignItems: 'center', justifyContent: 'center', gap: 9, paddingVertical: 21 },
  emptyTitle: { color: '#fff', fontSize: 16, fontWeight: '900' },
  emptySub: { color: '#e0f2fe', fontSize: 11, textAlign: 'center', lineHeight: 17 },
  citySearchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  locationButton: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, backgroundColor: '#ecfdf5', borderRadius: 11, paddingHorizontal: 10, paddingVertical: 10 },
  locationButtonText: { color: '#047857', fontSize: 11, fontWeight: '900' },
  searchButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: '#047857', borderRadius: 11 },
  cityInput: { flex: 1, minWidth: 80, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 11, paddingHorizontal: 11, paddingVertical: 9, color: '#0f172a', fontSize: 12.5 },
  errorText: { color: '#b91c1c', fontSize: 11.5, textAlign: 'right', paddingHorizontal: 14, paddingTop: 8, lineHeight: 17 },
  metricsGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', padding: 11, gap: 8 },
  metricCard: { width: '48%', flexGrow: 1, flexBasis: '44%', backgroundColor: '#fff', borderWidth: 1, borderColor: '#f1f5f9', borderRadius: 15, padding: 11, alignItems: 'flex-end', gap: 5 },
  metricIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  metricLabel: { color: '#64748b', fontSize: 10.5, fontWeight: '700' },
  metricValue: { color: '#0f172a', fontSize: 18, fontWeight: '900' },
  metricUnit: { color: '#64748b', fontSize: 9.5, fontWeight: '700' },
  forecastHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 7, paddingBottom: 10 },
  forecastTitle: { color: '#0f172a', fontSize: 13, fontWeight: '900' },
  forecastHint: { color: '#94a3b8', fontSize: 10.5 },
  hourlyList: { flexDirection: 'row-reverse', gap: 8, paddingHorizontal: 12, paddingBottom: 15 },
  hourCard: { minWidth: 66, alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 11, paddingHorizontal: 8, borderRadius: 14, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#f1f5f9' },
  hourText: { color: '#64748b', fontSize: 10 },
  hourTemp: { color: '#0f172a', fontSize: 15, fontWeight: '900' },
  rainChance: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  rainText: { color: '#0284c7', fontSize: 9.5, fontWeight: '800' },
  dayRow: { flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9', gap: 11 },
  dayName: { color: '#334155', fontSize: 11.5, fontWeight: '800', width: 42, textAlign: 'right' },
  dayCondition: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', gap: 7 },
  dayConditionText: { color: '#64748b', fontSize: 11 },
  dayHigh: { color: '#0f172a', fontSize: 12, fontWeight: '900', width: 28, textAlign: 'center' },
  dayLow: { color: '#94a3b8', fontSize: 12, fontWeight: '700', width: 28, textAlign: 'center' },
  weatherFooter: { paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#f8fafc', gap: 4, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  sourceText: { color: '#94a3b8', fontSize: 9.5, textAlign: 'right' },
  uvText: { color: '#64748b', fontSize: 10.5, textAlign: 'right', fontWeight: '700' },
});




const screenStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  hero: { paddingTop: Platform.OS === 'ios' ? 56 : 38, paddingHorizontal: 18, paddingBottom: 23, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  backButton: { width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
  heroCopy: { flex: 1, alignItems: 'flex-end', gap: 4 },
  eyebrow: { color: '#a7f3d0', fontSize: 11, fontWeight: '800' },
  title: { color: '#fff', fontSize: 27, fontWeight: '900' },
  subtitle: { color: '#d1fae5', fontSize: 12, textAlign: 'right', lineHeight: 18 },
  heroIcon: { width: 52, height: 52, borderRadius: 17, backgroundColor: 'rgba(255,255,255,0.13)', alignItems: 'center', justifyContent: 'center' },
  scroll: { paddingTop: 18 },
  content: { width: '100%', maxWidth: 800, alignSelf: 'center', paddingHorizontal: 16, gap: 16 },
  infoCard: { backgroundColor: '#fff', borderRadius: 16, padding: 15, borderWidth: 1, borderColor: '#e2e8f0', gap: 6 },
  infoTitle: { color: '#0f172a', fontSize: 13, fontWeight: '900', textAlign: 'right' },
  infoText: { color: '#64748b', fontSize: 11.5, lineHeight: 19, textAlign: 'right' },
});
