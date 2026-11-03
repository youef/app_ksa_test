import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Linking, Platform, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CloudRain, CloudSun, ExternalLink, MapPin, Pause, Play, RefreshCw, Satellite, ChevronRight, Clock, ZoomIn, ZoomOut } from 'lucide-react-native';
import { AppHeader } from '@/components/shared/AppHeader';
import { OasisPressable as Pressable, OasisSurface } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import { useBottomNavInset } from '@/lib/bottomNav';
import { SAUDI_WEATHER_CITIES, SAUDI_WEATHER_REGIONS, findSaudiWeatherCity } from '@/lib/saudiWeather';

type RadarLayer = 'radar' | 'satellite' | 'nasa';
const NCM_INFO = 'https://www.ncm.gov.sa/en/e-services/anwaa-application';
const NASA_INFO = 'https://gpm.nasa.gov/data/imerg';
const EMBED_ORIGIN = 'https://weatherscope.app';
const BASE_ZOOM = 7;
const HISTORY_FRAMES = 12;

// IMERG is satellite-estimated precipitation, not a ground-based live radar product.
// The Early product usually has a multi-hour delay. Conservative anchor avoids missing latest tiles.
function imergFrames() {
  const latest = Math.floor((Date.now() - 7 * 60 * 60 * 1000) / (30 * 60 * 1000)) * (30 * 60 * 1000);
  return Array.from({ length: HISTORY_FRAMES }, (_, i) => new Date(latest - (HISTORY_FRAMES - 1 - i) * 30 * 60 * 1000));
}
function saudiTime(date: Date) {
  return date.toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });
}
function nasaMapUrl(lat: number, lon: number, zoom: number, date: Date) {
  const lonSpan = Math.min(35, 23 / Math.pow(1.65, zoom - 5));
  const latSpan = lonSpan * 0.72;
  const south = Math.max(-85, lat - latSpan / 2);
  const north = Math.min(85, lat + latSpan / 2);
  const west = Math.max(-180, lon - lonSpan / 2);
  const east = Math.min(180, lon + lonSpan / 2);
  const params = new URLSearchParams({
    SERVICE: 'WMS', REQUEST: 'GetMap', VERSION: '1.3.0', CRS: 'EPSG:4326',
    // EPSG:4326 axis order in WMS 1.3.0 is latitude,longitude.
    BBOX: [south, west, north, east].join(','),
    LAYERS: 'BlueMarble_ShadedRelief_Bathymetry,IMERG_Precipitation_Rate_30min,Reference_Features,Reference_Labels',
    STYLES: ',,,', FORMAT: 'image/png', TRANSPARENT: 'FALSE', WIDTH: '1024', HEIGHT: '700',
    TIME: date.toISOString().slice(0, 19) + 'Z',
  });
  return 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?' + params.toString();
}
function actionStyle(active: boolean) {
  return {
    flexDirection: 'row-reverse' as const, alignItems: 'center' as const, gap: 6,
    backgroundColor: active ? OASIS.colors.deep : OASIS.colors.soft,
    borderRadius: 13, paddingHorizontal: 12, paddingVertical: 10,
  };
}

export default function SaudiWeatherRadarScreen() {
  const params = useLocalSearchParams<{ city?: string; lat?: string; lon?: string }>();
  const bottomInset = useBottomNavInset();
  const { width } = useWindowDimensions();
  const initialCity = findSaudiWeatherCity(typeof params.city === 'string' ? params.city : '') || SAUDI_WEATHER_CITIES[0];
  const [selectedCity, setSelectedCity] = useState(initialCity);
  const [region, setRegion] = useState(initialCity.region);
  const [layer, setLayer] = useState<RadarLayer>('radar');
  const [mapZoom, setMapZoom] = useState(BASE_ZOOM);
  const [frames, setFrames] = useState(imergFrames);
  const [frameIndex, setFrameIndex] = useState(HISTORY_FRAMES - 1);
  const [playing, setPlaying] = useState(false);
  const [nasaLoading, setNasaLoading] = useState(false);
  const [nasaError, setNasaError] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  // Use coordinates of explicitly selected weather location only while it corresponds to selected city.
  const suppliedLat = Number(params.lat);
  const suppliedLon = Number(params.lon);
  const userProvided = typeof params.lat === 'string' && typeof params.lon === 'string' &&
    Number.isFinite(suppliedLat) && Number.isFinite(suppliedLon) &&
    suppliedLat >= 16 && suppliedLat <= 33 && suppliedLon >= 34 && suppliedLon <= 56;
  const [useSelectedWeatherLocation, setUseSelectedWeatherLocation] = useState(userProvided);
  const lat = useSelectedWeatherLocation ? suppliedLat : selectedCity.latitude;
  const lon = useSelectedWeatherLocation ? suppliedLon : selectedCity.longitude;

  const embedUrl = useMemo(() => {
    const url = new URL('/embed/map', EMBED_ORIGIN);
    url.searchParams.set('lat', lat.toFixed(4));
    url.searchParams.set('lon', lon.toFixed(4));
    url.searchParams.set('zoom', String(mapZoom));
    url.searchParams.set('layer', layer === 'satellite' ? 'satellite' : 'radar');
    url.searchParams.set('theme', 'light');
    url.searchParams.set('controls', '1');
    url.searchParams.set('timeline', '1');
    return url.toString();
  }, [lat, lon, layer, mapZoom]);

  useEffect(() => {
    if (!playing || layer !== 'nasa') return;
    const timer = setInterval(() => setFrameIndex(i => (i + 1) % HISTORY_FRAMES), 1800);
    return () => clearInterval(timer);
  }, [playing, layer]);

  useEffect(() => {
    setNasaError(false);
    setNasaLoading(layer === 'nasa');
  }, [layer, frameIndex, selectedCity, mapZoom, refreshToken]);

  const selectCity = (city: typeof selectedCity) => {
    setSelectedCity(city);
    setRegion(city.region);
    setUseSelectedWeatherLocation(false);
    setPlaying(false);
  };
  const refresh = () => {
    setFrames(imergFrames());
    setFrameIndex(HISTORY_FRAMES - 1);
    setRefreshToken(v => v + 1);
  };
  const openUrl = (url: string) => { void Linking.openURL(url).catch(() => {}); };

  return (
    <View style={{ flex: 1, backgroundColor: OASIS.colors.background }}>
      <AppHeader variant="sub" title="رادار أمطار السعودية" subtitle="خرائط الهطول والسحب · المدن السعودية" fallbackRoute="/weather" />
      <ScrollView contentContainerStyle={{ padding: 15, paddingBottom: bottomInset + 28, gap: 13 }}>
        <OasisSurface oasisSurface="card" style={{ padding: 14, gap: 9, borderRadius: 19 }}>
          <View style={{ flexDirection: 'row-reverse', gap: 9, alignItems: 'center' }}>
            <View style={{ backgroundColor: '#dcfce7', borderRadius: 13, padding: 9 }}><CloudRain size={20} color={OASIS.colors.primary} /></View>
            <View style={{ flex: 1, alignItems: 'flex-end', gap: 4 }}>
              <Text style={{ color: OASIS.colors.ink, fontSize: 17, fontWeight: '800' }}>مراقبة المطر والسحب</Text>
              <Text style={{ color: OASIS.colors.muted, fontSize: 11 }}>اختر المدينة، ثم حرّك الخريطة أو ارجع إلى الرصد السابق</Text>
            </View>
            <Pressable onPress={refresh} accessibilityLabel="تحديث الخرائط" style={{ padding: 9, backgroundColor: OASIS.colors.soft, borderRadius: 12 }}>
              <RefreshCw size={17} color={OASIS.colors.primary} />
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row-reverse', gap: 7 }}>
            {['كل المناطق', ...SAUDI_WEATHER_REGIONS].map(item => (
              <Pressable key={item} onPress={() => setRegion(item)}
                style={{ paddingHorizontal: 11, paddingVertical: 9, borderRadius: 12, backgroundColor: region === item ? OASIS.colors.primary : OASIS.colors.soft }}>
                <Text style={{ color: region === item ? '#fff' : OASIS.colors.ink, fontWeight: '700', fontSize: 11 }}>{item}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row-reverse', gap: 7 }}>
            {SAUDI_WEATHER_CITIES.filter(city => region === 'كل المناطق' || city.region === region).map(city => (
              <Pressable key={city.name} onPress={() => selectCity(city)}
                style={{ paddingHorizontal: 11, paddingVertical: 10, gap: 5, alignItems: 'center', flexDirection: 'row-reverse', borderRadius: 12, backgroundColor: selectedCity.name === city.name && !useSelectedWeatherLocation ? OASIS.colors.deep : OASIS.colors.background }}>
                <MapPin size={13} color={selectedCity.name === city.name && !useSelectedWeatherLocation ? '#fff' : OASIS.colors.primary} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: selectedCity.name === city.name && !useSelectedWeatherLocation ? '#fff' : OASIS.colors.ink }}>{city.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
          {userProvided && !useSelectedWeatherLocation ? (
            <Pressable onPress={() => setUseSelectedWeatherLocation(true)} style={actionStyle(false)}>
              <MapPin size={14} color={OASIS.colors.primary} /><Text style={{ color: OASIS.colors.primary, fontSize: 12, fontWeight: '700' }}>العودة لموقع الطقس المحدد</Text>
            </Pressable>
          ) : null}
        </OasisSurface>

        <OasisSurface oasisSurface="card" style={{ padding: 12, gap: 11, borderRadius: 19 }}>
          <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', gap: 6, alignItems: 'center' }}>
            <Text style={{ color: OASIS.colors.deep, fontSize: 13, fontWeight: '800' }}>{useSelectedWeatherLocation ? 'موقع الطقس' : selectedCity.name}</Text>
            <View style={{ flexDirection: 'row-reverse', gap: 5, alignItems: 'center' }}><Clock size={13} color={OASIS.colors.muted} /><Text style={{ color: OASIS.colors.muted, fontSize: 10 }}>الأوقات بتوقيت السعودية</Text></View>
          </View>
          <View style={{ flexDirection: 'row-reverse', gap: 6, flexWrap: 'wrap' }}>
            {([
              ['radar', 'رادار الأمطار', CloudRain],
              ['satellite', 'السحب والأقمار', CloudSun],
              ['nasa', 'هطول NASA', Satellite],
            ] as const).map(([value, label, Icon]) => (
              <Pressable key={value} onPress={() => { setLayer(value); setPlaying(false); }}
                style={actionStyle(layer === value)}>
                <Icon size={15} color={layer === value ? '#fff' : OASIS.colors.primary} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: layer === value ? '#fff' : OASIS.colors.ink }}>{label}</Text>
              </Pressable>
            ))}
          </View>

          {layer !== 'nasa' ? (
            <>
              {Platform.OS === 'web' ? (
                <View style={{ width: '100%', height: width < 600 ? 440 : 550, borderRadius: 15, overflow: 'hidden', backgroundColor: '#dce9ef' }}>
                  {React.createElement('iframe', {
                    key: embedUrl + ':' + refreshToken,
                    src: embedUrl,
                    title: 'خريطة الطقس التفاعلية من WeatherScope',
                    loading: 'lazy',
                    allowFullScreen: true,
                    referrerPolicy: 'strict-origin-when-cross-origin',
                    style: { width: '100%', height: '100%', border: 0, display: 'block' },
                  })}
                </View>
              ) : (
                <View style={{ borderRadius: 13, backgroundColor: OASIS.colors.soft, padding: 24, alignItems: 'center', gap: 12 }}>
                  <CloudRain size={36} color={OASIS.colors.primary} />
                  <Text style={{ color: OASIS.colors.deep, textAlign: 'center', fontWeight: '800' }}>الخريطة المتحركة متاحة في المتصفح</Text>
                  <Text style={{ color: OASIS.colors.muted, textAlign: 'center', fontSize: 12 }}>افتح الخريطة التفاعلية للتكبير وتحريك السحب ومراجعة الرصد السابق.</Text>
                  <Pressable onPress={() => openUrl(embedUrl)} style={actionStyle(true)}>
                    <ExternalLink size={16} color="#fff" /><Text style={{ color: '#fff', fontWeight: '700' }}>عرض الخريطة</Text>
                  </Pressable>
                </View>
              )}
              <Text style={{ textAlign: 'right', fontSize: 11, lineHeight: 19, color: OASIS.colors.muted }}>
                المصدر: WeatherScope (خدمة مستقلة غير حكومية). استخدم شريط الوقت داخل الخريطة للرجوع بالرصد والتشغيل المتحرك. قد تختلف تغطية الرادار بحسب المنطقة؛ غياب اللون لا يثبت عدم وجود مطر.
              </Text>
              <Pressable onPress={() => openUrl(embedUrl)} style={{ flexDirection: 'row-reverse', gap: 5, alignItems: 'center', alignSelf: 'flex-end', padding: 6 }}>
                <ExternalLink size={13} color={OASIS.colors.primary} />
                <Text style={{ color: OASIS.colors.primary, fontSize: 11 }}>فتح الخريطة كاملة من المصدر</Text>
              </Pressable>
            </>
          ) : (
            <>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 9 }}>
                <Text style={{ color: OASIS.colors.ink, fontSize: 12, fontWeight: '800' }}>{saudiTime(frames[frameIndex])}</Text>
                <View style={{ flexDirection: 'row-reverse', gap: 7 }}>
                  <Pressable onPress={() => setMapZoom(z => Math.min(10, z + 1))} accessibilityLabel="تكبير" style={actionStyle(false)}><ZoomIn size={16} color={OASIS.colors.primary} /></Pressable>
                  <Pressable onPress={() => setMapZoom(z => Math.max(4, z - 1))} accessibilityLabel="تصغير" style={actionStyle(false)}><ZoomOut size={16} color={OASIS.colors.primary} /></Pressable>
                </View>
              </View>
              <View style={{ width: '100%', aspectRatio: 1024 / 700, minHeight: 200, overflow: 'hidden', borderRadius: 14, backgroundColor: '#cbd5e1', alignItems: 'center', justifyContent: 'center' }}>
                <Image key={nasaMapUrl(lat, lon, mapZoom, frames[frameIndex])}
                  source={{ uri: nasaMapUrl(lat, lon, mapZoom, frames[frameIndex]) }}
                  resizeMode="stretch" style={{ width: '100%', height: '100%' }}
                  onLoadStart={() => setNasaLoading(true)}
                  onLoadEnd={() => setNasaLoading(false)}
                  onError={() => { setNasaError(true); setNasaLoading(false); }} />
                {nasaLoading && !nasaError ? <View style={{ position: 'absolute', alignSelf: 'center', backgroundColor: '#ffffffcc', borderRadius: 12, padding: 11 }}><ActivityIndicator color={OASIS.colors.primary} /></View> : null}
                {nasaError ? (
                  <View style={{ position: 'absolute', backgroundColor: '#ffffffee', padding: 12, borderRadius: 13, maxWidth: 240 }}>
                    <Text style={{ textAlign: 'center', color: OASIS.colors.deep, fontSize: 11 }}>الصورة غير متاحة لهذا التوقيت. اختر وقتاً أقدم أو حدث الصفحة.</Text>
                  </View>
                ) : null}
              </View>
              <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', gap: 7 }}>
                <Pressable onPress={() => setPlaying(v => !v)} style={actionStyle(true)}>
                  {playing ? <Pause size={15} color="#fff" /> : <Play size={15} color="#fff" />}
                  <Text style={{ fontWeight: '700', fontSize: 11, color: '#fff' }}>{playing ? 'إيقاف' : 'تشغيل'}</Text>
                </Pressable>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row-reverse', gap: 5 }}>
                  {frames.map((date, i) => (
                    <Pressable key={date.toISOString()} onPress={() => { setFrameIndex(i); setPlaying(false); }}
                      style={{ paddingHorizontal: 8, paddingVertical: 9, borderRadius: 10, backgroundColor: frameIndex === i ? OASIS.colors.primary : OASIS.colors.soft }}>
                      <Text style={{ fontSize: 10, fontWeight: '700', color: frameIndex === i ? '#fff' : OASIS.colors.deep }}>
                        {date.toLocaleTimeString('ar-SA', { timeZone: 'Asia/Riyadh', hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
              <Text style={{ textAlign: 'right', fontSize: 11, lineHeight: 19, color: OASIS.colors.muted }}>
                NASA GPM IMERG: تقدير هطول بالأقمار الصناعية بدقة تقارب 10 كم وفاصل زمني 30 دقيقة، مع تأخر نشر عدة ساعات. ليس راداراً أرضياً أو تتبعاً حيّاً للسحب، ولا يحدد مطر الحي بدقة.
              </Text>
              <Pressable onPress={() => openUrl(NASA_INFO)} style={{ alignSelf: 'flex-end', flexDirection: 'row-reverse', alignItems: 'center', gap: 5 }}>
                <ExternalLink size={13} color={OASIS.colors.primary} />
                <Text style={{ color: OASIS.colors.primary, fontSize: 11 }}>المصدر العلمي: NASA GPM</Text>
              </Pressable>
            </>
          )}
        </OasisSurface>

        <OasisSurface oasisSurface="card" style={{ padding: 14, gap: 8, borderRadius: 17 }}>
          <Text style={{ textAlign: 'right', fontWeight: '800', fontSize: 14, color: OASIS.colors.deep }}>الرصد الرسمي السعودي</Text>
          <Text style={{ textAlign: 'right', fontSize: 12, lineHeight: 21, color: OASIS.colors.muted }}>
            يوفر المركز الوطني للأرصاد رادارات وأقماراً صناعية عبر «أنواء». لم يتم الربط المباشر ببياناته الخاصة داخل حيّنا؛ هذا يتطلب الاشتراك والتصريح. في الحالات الخطرة اعتمد على الإنذارات الرسمية لا على الخرائط البديلة.
          </Text>
          <Pressable onPress={() => openUrl(NCM_INFO)} style={{ alignSelf: 'flex-end', flexDirection: 'row-reverse', alignItems: 'center', gap: 7, padding: 9, backgroundColor: OASIS.colors.soft, borderRadius: 10 }}>
            <ChevronRight size={15} color={OASIS.colors.primary} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: OASIS.colors.primary }}>المركز الوطني للأرصاد — أنواء</Text>
          </Pressable>
        </OasisSurface>
      </ScrollView>
    </View>
  );
}
