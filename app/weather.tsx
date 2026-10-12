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
} from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
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
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useBottomNavInset } from '@/lib/bottomNav';

type WeatherData = {
  city: string;
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

export default function WeatherScreen() {
  const bottomNavInset = useBottomNavInset();
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [cityInput, setCityInput] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchWeather = async (latitude: number, longitude: number, city: string) => {
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
    setWeather({ city, latitude, longitude, current: data.current, hourly: data.hourly, daily: data.daily, air });
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
      await fetchWeather(place.latitude, place.longitude, place.name || trimmed);
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
      let city = 'موقعك الحالي';
      try {
        const addresses = await Location.reverseGeocodeAsync({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        const address = addresses[0];
        city = address?.city || address?.district || address?.region || city;
      } catch {}
      setCityInput(city === 'موقعك الحالي' ? '' : city);
      await fetchWeather(position.coords.latitude, position.coords.longitude, city);
    } catch (err: any) {
      setError(err?.message || 'تعذّر تحديد موقعك.');
    } finally {
      setLoading(false);
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    try {
      if (weather) await fetchWeather(weather.latitude, weather.longitude, weather.city);
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

  const heroSubtitle = weather
    ? 'الآن ' + round(weather.current.temperature_2m) + '° · ' + weatherDescription(weather.current.weather_code) + ' في ' + weather.city
    : 'الآن وتوقعات الأيام القادمة لمدينتك';

  const tips: string[] = [];
  if ((weather?.daily?.uv_index_max?.[0] ?? 0) >= 6) tips.push('الأشعة فوق البنفسجية مرتفعة؛ استخدم الوقاية من الشمس.');
  if ((weather?.current?.wind_speed_10m ?? 0) >= 30) tips.push('الرياح نشطة؛ توخّ الحذر أثناء القيادة.');
  if ((aqi ?? 0) > 100) tips.push('جودة الهواء قد تؤثر على الفئات الحساسة؛ راجع الإرشادات المحلية.');
  if ((weather?.daily?.precipitation_probability_max?.[0] ?? 0) >= 40) tips.push('احتمال هطول مرتفع اليوم؛ خذ مظلتك معك.');
  if (!tips.length && weather) tips.push('الأجواء مستقرة اليوم؛ استمتع بوقتك في الحي.');

  return (
    <View style={screenStyles.container}>
      <LinearGradient
        colors={['#064e3b', '#047857', '#0e7490']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={screenStyles.hero}
      >
        <Pressable
          onPress={() => router.back()}
          style={screenStyles.backButton}
          accessibilityRole="button"
          accessibilityLabel="رجوع"
        >
          <ChevronRight size={22} color="#fff" />
        </Pressable>
        <View style={screenStyles.heroCopy}>
          <View style={screenStyles.livePill}>
            <View style={screenStyles.liveDot} />
            <Text style={screenStyles.liveText}>بيانات مباشرة</Text>
          </View>
          <Text style={screenStyles.title}>الطقس</Text>
          <Text style={screenStyles.subtitle} numberOfLines={1}>{heroSubtitle}</Text>
        </View>
        <View style={screenStyles.heroIcon}>
          {weather ? (
            <Text style={screenStyles.heroTemp}>{round(weather.current.temperature_2m)}°</Text>
          ) : (
            <Sun size={30} color="#fde68a" />
          )}
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[screenStyles.scroll, { paddingBottom: bottomNavInset + 28 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#047857" colors={['#047857']} />}
      >
        <View style={screenStyles.content}>
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

const styles = StyleSheet.create({
  searchCard: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
  citySearchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  locationButton: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, backgroundColor: '#ecfdf5', borderRadius: 11, paddingHorizontal: 11, paddingVertical: 10 },
  locationButtonText: { color: '#047857', fontSize: 11.5, fontWeight: '900' },
  searchButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: '#047857', borderRadius: 11 },
  cityInput: { flex: 1, minWidth: 80, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 11, paddingHorizontal: 11, paddingVertical: 9, color: '#0f172a', fontSize: 12.5 },
  errorText: { color: '#b91c1c', fontSize: 11.5, textAlign: 'right', paddingHorizontal: 14, paddingBottom: 10, lineHeight: 17 },

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
