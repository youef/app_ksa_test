import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
const Map = Platform.OS !== 'web' ? require('@maplibre/maplibre-react-native').Map : View;
const Camera = Platform.OS !== 'web' ? require('@maplibre/maplibre-react-native').Camera : View;
const Marker = Platform.OS !== 'web' ? require('@maplibre/maplibre-react-native').Marker : View;
import { router } from 'expo-router';
import { AppHeader } from '@/components/shared/AppHeader';
import NeighborhoodWebMap from '@/components/shared/NeighborhoodWebMap';
import { C, S } from '@/lib/ui';
import { getCurrentDeviceLocation, type DeviceLocation } from '@/lib/deviceLocation';
import {
  MAP_PIN_KINDS,
  MAP_PIN_ORDER,
  countByKind,
  filterPins,
  findPlaceCenter,
  loadMapPins,
  type MapPin,
  type MapPinKind,
} from '@/lib/mapPins';
import {
  ALL_PLACES_KEY,
  PLACE_CATEGORIES,
  searchNearbyPlaces,
  type NearbyPlace,
} from '@/lib/places';
import { formatDistance, navigationUrl } from '@/lib/privacy';
import { getActiveLocation, isAllKingdom, subscribeLocation } from '@/lib/locationSync';

const STYLE_URL = 'https://demotiles.maplibre.org/style.json';
const DEFAULT_CENTER = [46.6753, 24.7136];

type KindFilter = MapPinKind | 'all';

export default function MapScreen() {
  const [pins, setPins] = useState<MapPin[]>([]);
  const [kind, setKind] = useState<KindFilter>('all');
  const [city, setCity] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<MapPin | null>(null);
  const [myLocation, setMyLocation] = useState<DeviceLocation | null>(null);
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [placeCategory, setPlaceCategory] = useState<string>(ALL_PLACES_KEY);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [sortMode, setSortMode] = useState<'distance' | 'open' | 'rating'>('distance');
  const [openOnly, setOpenOnly] = useState(false);
  const [ratedOnly, setRatedOnly] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<NearbyPlace | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getActiveLocation().then((location) => {
      if (!cancelled) setCity(isAllKingdom(location.city) ? null : location.city);
    });
    const unsubscribe = subscribeLocation((location) => {
      setCity(isAllKingdom(location.city) ? null : location.city);
    });
    return () => { cancelled = true; unsubscribe(); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await loadMapPins();
        if (!cancelled) { setPins(loaded); setLastUpdated(new Date()); }
      } catch (error) {
        console.warn('map pins failed', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const runPlaceSearch = async (category: string) => {
    const active = await getActiveLocation();
    if (isAllKingdom(active.city)) return;
    const center = findPlaceCenter(active.city);
    const origin = center
      ? { latitude: center.lat, longitude: center.lng }
      : myLocation ?? (await getCurrentDeviceLocation());
    if (!origin) return;
    setPlacesLoading(true);
    const results = await searchNearbyPlaces({
      lat: origin.latitude,
      lng: origin.longitude,
      category: category === ALL_PLACES_KEY ? null : category,
    });
    setPlaces(results);
    setLastUpdated(new Date());
    setPlacesLoading(false);
  };

  const locateMe = async () => {
    setLocating(true);
    const location = await getCurrentDeviceLocation();
    setLocating(false);
    if (!location) return;
    setMyLocation(location);
    void runPlaceSearch(placeCategory);
  };

  useEffect(() => {
    void runPlaceSearch(ALL_PLACES_KEY);
    // Searches the neighbourhood once when the screen opens.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = setInterval(() => {
      void loadMapPins().then((fresh) => { setPins(fresh); setLastUpdated(new Date()); }).catch(() => {});
      void runPlaceSearch(placeCategory);
    }, 60_000);
    return () => clearInterval(timer);
  }, [placeCategory]);

  const visiblePlaces = useMemo(() => {
    let result = [...places];
    if (openOnly) result = result.filter((place) => place.openNow === true);
    if (ratedOnly) result = result.filter((place) => place.rating != null);
    if (sortMode === 'open') result.sort((a, b) => Number(b.openNow === true) - Number(a.openNow === true) || a.distance - b.distance);
    else if (sortMode === 'rating') result.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || a.distance - b.distance);
    else result.sort((a, b) => a.distance - b.distance);
    return result;
  }, [places, openOnly, ratedOnly, sortMode]);

  const visiblePins = useMemo(
    () => city ? filterPins(pins, { kind, city, query }) : [],
    [pins, kind, city, query],
  );
  const scopedPins = useMemo(() => city ? filterPins(pins, { city }) : [], [pins, city]);
  const kindCounts = useMemo(() => countByKind(scopedPins), [scopedPins]);

  const chip = (value: KindFilter, label: string, color: string, count: number) => {
    const active = kind === value;
    return (
      <Pressable
        key={value}
        onPress={() => setKind(value)}
        style={[styles.chip, active && { backgroundColor: color, borderColor: color }]}
      >
        <Text style={[styles.chipText, active && { color: '#fff' }]}>
          {label} ({count})
        </Text>
      </Pressable>
    );
  };

  const placeChip = (key: string, label: string) => {
    const active = placeCategory === key;
    return (
      <Pressable
        key={key}
        onPress={() => {
          setPlaceCategory(key);
          void runPlaceSearch(key);
        }}
        style={[styles.placeChip, active && styles.placeChipActive]}
      >
        <Text style={[styles.placeChipText, active && { color: '#fff' }]}>{label}</Text>
      </Pressable>
    );
  };

  const filters = (
    <View style={styles.filters}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {chip('all', 'الكل', C.ink, kindCounts.all || 0)}
        {MAP_PIN_ORDER.map((value) => {
          const meta = MAP_PIN_KINDS[value];
          return chip(value, `${meta.emoji} ${meta.short}`, meta.color, kindCounts[value] || 0);
        })}
      </ScrollView>

      <Text style={styles.cityScope}>{city ? `يعرض محتوى ${city}` : 'اختر مدينتك من إعدادات الموقع لعرض محتوى منطقتك'}</Text>
    </View>
  );

  const placeCard = (place: NearbyPlace) => (
    <Pressable key={place.id} style={styles.placeCard} onPress={() => { setSelectedPlace(place); setSelected(null); }}>
      <View style={styles.placeBadge}>
        <Text style={{ fontSize: 17 }}>{PLACE_CATEGORIES.find((c) => c.key === place.categoryKey)?.emoji ?? '🏬'}</Text>
      </View>
      <View style={styles.placeBody}>
        <Text style={styles.placeName} numberOfLines={1}>{place.name}</Text>
        <Text style={styles.placeMeta} numberOfLines={2}>
          {place.categoryLabel} · {formatDistance(place.distance)}{place.address ? ` · ${place.address}` : ''}
        </Text>
        <View style={styles.placeChips}>
          {place.openNow != null ? <Text style={[styles.miniChip, place.openNow ? { color: '#15803d', backgroundColor: '#dcfce7' } : { color: '#b91c1c', backgroundColor: '#fee2e2' }]}>{place.openNow ? 'مفتوح' : 'مغلق'}</Text> : null}
          {place.rating != null ? <Text style={styles.miniChip}>★ {place.rating.toFixed(1)} ({place.reviews})</Text> : null}
          {place.phone ? <Text style={[styles.miniChip, { color: '#1d4ed8', backgroundColor: '#eff6ff' }]}>اتصال متاح</Text> : null}
        </View>
      </View>
    </Pressable>
  );

  const addAction = (label: string, emoji: string, route: string) => (
    <Pressable key={route} style={styles.addAction} onPress={() => { setAddMenuOpen(false); router.push(route as never); }}>
      <Text style={styles.addActionText}>{emoji}  {label}</Text>
    </Pressable>
  );

  if (Platform.OS === 'web') {
    const webPins = visiblePins.slice(0, 12);
    return (
      <View style={{ flex: 1, backgroundColor: '#F4F7F5', minHeight: '100vh' as never }}>
        <View style={{ backgroundColor: '#123F35', paddingHorizontal: 24, paddingTop: 22, paddingBottom: 22, borderBottomLeftRadius: 26, borderBottomRightRadius: 26 }}>
          <View style={{ maxWidth: 1240, width: '100%', alignSelf: 'center' }}>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 48, height: 48, borderRadius: 16, backgroundColor: '#FFFFFF20', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 26, color: '#fff' }}>⌖</Text></View>
                <View><Text style={{ color: '#fff', fontSize: 25, fontWeight: '900', textAlign: 'right' }}>خريطة الحي</Text><Text style={{ color: '#D1E6DD', fontSize: 12, marginTop: 3, textAlign: 'right' }}>كل ما حولك، في مكان واحد</Text></View>
              </View>
              <View style={{ flexDirection: 'row-reverse', gap: 8, flexWrap: 'wrap' }}>
                <Pressable onPress={locateMe} disabled={locating} style={{ backgroundColor: '#FFFFFF18', borderWidth: 1, borderColor: '#FFFFFF50', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 11 }}><Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{locating ? 'جارٍ تحديد الموقع…' : '◎ موقعي الحالي'}</Text></Pressable>
                <Pressable onPress={() => setAddMenuOpen(v => !v)} style={{ backgroundColor: '#E4B76A', borderRadius: 14, paddingHorizontal: 18, paddingVertical: 11 }}><Text style={{ color: '#173B31', fontWeight: '900', fontSize: 13 }}>＋ إضافة للحي</Text></Pressable>
              </View>
            </View>
            <View style={{ marginTop: 22, flexDirection: 'row-reverse', alignItems: 'center', gap: 10, backgroundColor: '#FFFFFF', borderRadius: 16, paddingHorizontal: 15, paddingVertical: 3, maxWidth: 700, alignSelf: 'flex-end', width: '100%', boxShadow: '0 8px 25px #092c2015' as never }}>
              <Text style={{ color: '#648076', fontSize: 20 }}>⌕</Text>
              <TextInput value={query} onChangeText={setQuery} placeholder="ابحث عن فعالية، متجر، خدمة أو تنبيه..." placeholderTextColor="#82928C" style={{ flex: 1, color: '#173B31', textAlign: 'right', fontSize: 14, paddingVertical: 13, outlineStyle: 'none' as never }} />
              <Text style={{ color: '#82928C' }}>☷</Text>
            </View>
          </View>
        </View>

        <View style={{ maxWidth: 1240, width: '100%', alignSelf: 'center', paddingHorizontal: 18, paddingTop: 20, paddingBottom: 40 }}>
          <View style={{ flexDirection: 'row-reverse', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
            {[
              { label: 'منشورات الحي', value: String(visiblePins.length), icon: '✦', bg: '#E7F4ED' },
              { label: 'أماكن قريبة', value: String(visiblePlaces.length), icon: '⌖', bg: '#E8F0FB' },
              { label: 'تنبيهات عاجلة', value: String(scopedPins.filter(p => p.urgent || p.kind === 'alert' || p.kind === 'emergency').length), icon: '!', bg: '#FCE9E7' },
              { label: 'آخر تحديث', value: lastUpdated ? lastUpdated.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : 'الآن', icon: '↻', bg: '#FFF2D9' },
            ].map((stat) => <View key={stat.label} style={{ flexGrow: 1, minWidth: 145, backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#E4EBE6', padding: 15, flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }}><View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: stat.bg, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 20, fontWeight: '900', color: '#174A3B' }}>{stat.icon}</Text></View><View><Text style={{ fontSize: 20, fontWeight: '900', color: '#173B31', textAlign: 'right' }}>{stat.value}</Text><Text style={{ fontSize: 11, color: '#77877F', marginTop: 3, textAlign: 'right' }}>{stat.label}</Text></View></View>)}
          </View>

          <View style={{ flexDirection: 'row-reverse', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <View style={{ flex: 2, minWidth: 320, gap: 14 }}>
              <View style={{ backgroundColor: '#fff', borderRadius: 22, borderWidth: 1, borderColor: '#E2EAE4', padding: 15 }}>
                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 13, flexWrap: 'wrap' }}>
                  <View><Text style={{ fontSize: 17, fontWeight: '900', color: '#173B31', textAlign: 'right' }}>استكشف على الخريطة</Text><Text style={{ color: '#788980', fontSize: 11, marginTop: 4, textAlign: 'right' }}>{city ? 'المحتوى القريب من ' + city : 'عرض عام للمحتوى المنشور'}</Text></View>
                  <View style={{ backgroundColor: '#E8F5ED', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 7 }}><Text style={{ color: '#19704E', fontSize: 11, fontWeight: '800' }}>● بيانات الحي</Text></View>
                </View>
                <View style={{ height: 390, borderRadius: 17, overflow: 'hidden', borderWidth: 1, borderColor: '#D8E3DA' }}>
                  <NeighborhoodWebMap
                    pins={webPins}
                    places={visiblePlaces}
                    center={findPlaceCenter(city)}
                    city={city}
                    onSelectPin={(pin) => setSelected(pin)}
                    onSelectPlace={(place) => { setSelectedPlace(place); setSelected(null); }}
                    onLocate={locateMe}
                  />
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row-reverse', gap: 7, paddingTop: 13 }}>
                  {chip('all', 'الكل', '#173B31', kindCounts.all || 0)}
                  {MAP_PIN_ORDER.map(value => { const meta = MAP_PIN_KINDS[value]; return chip(value, meta.emoji + ' ' + meta.short, meta.color, kindCounts[value] || 0); })}
                </ScrollView>
              </View>

              <View style={{ backgroundColor: '#fff', borderRadius: 22, borderWidth: 1, borderColor: '#E2EAE4', padding: 16 }}>
                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}><Text style={{ fontSize: 17, fontWeight: '900', color: '#173B31' }}>الأماكن القريبة</Text><Text style={{ fontSize: 12, color: '#6B8176' }}>{visiblePlaces.length} نتيجة</Text></View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row-reverse', gap: 8, paddingBottom: 12 }}>
                  {placeChip(ALL_PLACES_KEY, 'كل الأماكن')}
                  {PLACE_CATEGORIES.map(category => placeChip(category.key, category.emoji + ' ' + category.label))}
                </ScrollView>
                <View style={{ flexDirection: 'row-reverse', gap: 7, flexWrap: 'wrap', marginBottom: 13 }}>
                  {([['distance','الأقرب'],['open','مفتوح أولاً'],['rating','الأعلى تقييماً']] as const).map(([value,label]) => <Pressable key={value} onPress={() => setSortMode(value)} style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: sortMode === value ? '#173B31' : '#F0F4F1' }}><Text style={{ color: sortMode === value ? '#fff' : '#53675D', fontSize: 11, fontWeight: '800' }}>{label}</Text></Pressable>)}
                  <Pressable onPress={() => setOpenOnly(v => !v)} style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: openOnly ? '#173B31' : '#F0F4F1' }}><Text style={{ color: openOnly ? '#fff' : '#53675D', fontSize: 11, fontWeight: '800' }}>مفتوح الآن</Text></Pressable>
                  <Pressable onPress={() => setRatedOnly(v => !v)} style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: ratedOnly ? '#173B31' : '#F0F4F1' }}><Text style={{ color: ratedOnly ? '#fff' : '#53675D', fontSize: 11, fontWeight: '800' }}>له تقييم</Text></Pressable>
                </View>
                {visiblePlaces.slice(0, 8).map(placeCard)}
                {!visiblePlaces.length && <Text style={{ color: '#829188', textAlign: 'center', padding: 22, fontSize: 13 }}>{placesLoading ? 'جارٍ تحميل الأماكن القريبة…' : 'لا توجد أماكن مطابقة. اختر مدينة أو حدّث الموقع.'}</Text>}
              </View>
            </View>

            <View style={{ flex: 1, minWidth: 280, gap: 14 }}>
              {addMenuOpen ? <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#E0E9E2' }}><View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}><Text style={{ fontSize: 16, color: '#173B31', fontWeight: '900' }}>أضف للحي</Text><Pressable onPress={() => setAddMenuOpen(false)}><Text style={{ color: '#7A8A81' }}>إغلاق ✕</Text></Pressable></View>{addAction('محل أو خدمة', '🏪', '/new-service')}{addAction('تنبيه طارئ', '🚨', '/emergency-alert')}{addAction('إعلان أو منتج', '🛍️', '/marketplace-dashboard')}{addAction('فعالية للحي', '🎉', '/market?section=events')}</View> : null}
              {selectedPlace ? <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#DDE7E0' }}><View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}><View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: '#E8F5ED', alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 22 }}>{PLACE_CATEGORIES.find(c => c.key === selectedPlace.categoryKey)?.emoji ?? '🏬'}</Text></View><View style={{ flex: 1 }}><Text style={{ color: '#173B31', fontSize: 15, fontWeight: '900', textAlign: 'right' }}>{selectedPlace.name}</Text><Text style={{ color: '#73847A', fontSize: 11, textAlign: 'right', marginTop: 4 }}>{selectedPlace.categoryLabel} · {formatDistance(selectedPlace.distance)}</Text></View><Pressable onPress={() => setSelectedPlace(null)}><Text>✕</Text></Pressable></View>{selectedPlace.address ? <Text style={{ color: '#66786E', fontSize: 12, textAlign: 'right', marginTop: 12 }}>{selectedPlace.address}</Text> : null}{selectedPlace.hoursText ? <Text style={{ color: '#66786E', fontSize: 12, textAlign: 'right', marginTop: 8 }}>◷ {selectedPlace.hoursText}</Text> : null}<View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 14 }}><Pressable onPress={() => Linking.openURL(selectedPlace.mapsUrl)} style={{ backgroundColor: '#173B31', borderRadius: 12, padding: 11, flex: 1, alignItems: 'center' }}><Text style={{ color: '#fff', fontWeight: '800' }}>الاتجاهات ↗</Text></Pressable>{selectedPlace.phone ? <Pressable onPress={() => Linking.openURL('tel:' + selectedPlace.phone)} style={{ backgroundColor: '#EEF4EF', borderRadius: 12, padding: 11, alignItems: 'center' }}><Text style={{ color: '#173B31', fontWeight: '800' }}>اتصال</Text></Pressable> : null}</View></View> : null}
              {selected ? <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#DDE7E0' }}><Text style={{ fontSize: 16, color: '#173B31', fontWeight: '900', textAlign: 'right' }}>{MAP_PIN_KINDS[selected.kind].emoji} {selected.title}</Text><Text style={{ fontSize: 12, color: '#6C8075', textAlign: 'right', marginTop: 7 }}>{MAP_PIN_KINDS[selected.kind].label} · {selected.area}</Text>{selected.body ? <Text style={{ fontSize: 13, color: '#53675D', textAlign: 'right', lineHeight: 21, marginTop: 9 }}>{selected.body}</Text> : null}{selected.approximate ? <Text style={{ color: '#9A6B22', fontSize: 11, textAlign: 'right', marginTop: 8 }}>الموقع تقريبي لحماية الخصوصية</Text> : null}<View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 13 }}><Pressable onPress={() => router.push(selected.href as never)} style={{ backgroundColor: '#173B31', borderRadius: 12, padding: 11, flex: 1, alignItems: 'center' }}><Text style={{ color: '#fff', fontWeight: '800' }}>فتح التفاصيل</Text></Pressable><Pressable onPress={() => setSelected(null)} style={{ backgroundColor: '#EEF4EF', borderRadius: 12, padding: 11 }}><Text style={{ color: '#173B31', fontWeight: '800' }}>إغلاق</Text></Pressable></View></View> : null}
              <View style={{ backgroundColor: '#173F35', borderRadius: 22, padding: 20 }}><Text style={{ fontSize: 20, color: '#fff', fontWeight: '900', textAlign: 'right' }}>خلّ الحي أفضل ✨</Text><Text style={{ fontSize: 12, color: '#D0E2D9', lineHeight: 21, textAlign: 'right', marginTop: 7 }}>شارك جيرانك خدمة أو فعالية أو بلاغًا يفيد المجتمع.</Text><Pressable onPress={() => setAddMenuOpen(v => !v)} style={{ backgroundColor: '#E4B76A', borderRadius: 13, padding: 13, alignItems: 'center', marginTop: 14 }}><Text style={{ color: '#173B31', fontWeight: '900' }}>＋ أضف محتوى للحي</Text></Pressable></View>
              <View style={{ backgroundColor: '#fff', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#E1E9E3' }}><Text style={{ fontSize: 15, color: '#173B31', fontWeight: '900', textAlign: 'right', marginBottom: 12 }}>تصفّح حسب النوع</Text>{MAP_PIN_ORDER.map(value => { const meta = MAP_PIN_KINDS[value]; return <Pressable key={value} onPress={() => setKind(value)} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0F3F0' }}><View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: meta.color + '18', alignItems: 'center', justifyContent: 'center' }}><Text>{meta.emoji}</Text></View><Text style={{ flex: 1, color: '#43584D', fontSize: 12, fontWeight: '700', textAlign: 'right' }}>{meta.label}</Text><Text style={{ color: '#839087', fontSize: 11 }}>{kindCounts[value] || 0}</Text></Pressable>})}</View>
            </View>
          </View>
          <Text style={{ textAlign: 'center', color: '#94A198', fontSize: 11, marginTop: 22 }}>تُعرض مواقع المنشورات بشكل تقريبي لحماية خصوصية أصحابها.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <AppHeader
        variant="sub"
        title="خريطة الحي"
        subtitle={`${visiblePins.length} نشاط · ${places.length} محل قريب`}
        fallbackRoute="/home"
        rightAction={
          <Pressable
            style={{
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 14,
              backgroundColor: '#ecfdf5',
              borderWidth: 1,
              borderColor: '#a7f3d0',
            }}
            onPress={locateMe}
            disabled={locating}
          >
            <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#059669' }}>
              {locating ? 'جارٍ التحديد…' : 'موقعي 📍'}
            </Text>
          </Pressable>
        }
      />
      <Map style={styles.map} mapStyle={STYLE_URL}>
        <Camera
          key={city || 'location-required'}
          defaultSettings={{
            centerCoordinate: findPlaceCenter(city)
              ? [findPlaceCenter(city)!.lng, findPlaceCenter(city)!.lat]
                : DEFAULT_CENTER,
            zoomLevel: city ? 11 : 5.5,
          }}
        />

        {myLocation ? (
          <Marker id="my-location" lngLat={[myLocation.longitude, myLocation.latitude]} anchor="center">
            <View style={styles.myLocationDot}>
              <View style={styles.myLocationInner} />
            </View>
          </Marker>
        ) : null}

        {places.slice(0, 60).map((place) => (
          <Marker key={`place-${place.id}`} id={`place-${place.id}`} lngLat={[place.lng, place.lat]} anchor="bottom" onPress={() => { setSelectedPlace(place); setSelected(null); }}>
            <View style={styles.pinWrap}>
              <View style={[styles.pin, { backgroundColor: '#0F766E' }]}>
                <Text style={styles.pinEmoji}>🏬</Text>
              </View>
            </View>
          </Marker>
        ))}

        {visiblePins.slice(0, 300).map((pin) => {
          const meta = MAP_PIN_KINDS[pin.kind];
          return (
            <Marker
              key={pin.id}
              id={pin.id}
              lngLat={[pin.lng, pin.lat]}
              anchor="bottom"
              onPress={() => setSelected(pin)}
            >
              <View style={styles.pinWrap}>
                {pin.urgent ? <View style={[styles.pinPulse, { borderColor: meta.color }]} /> : null}
                <View style={[styles.pin, { backgroundColor: meta.color }]}>
                  <Text style={styles.pinEmoji}>{meta.emoji}</Text>
                </View>
              </View>
            </Marker>
          );
        })}
      </Map>

      <View style={styles.overlay}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="ابحث عن نشاط في حيّك..."
          placeholderTextColor={C.muted}
          style={styles.search}
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {placeChip(ALL_PLACES_KEY, 'الكل')}
          {PLACE_CATEGORIES.map((category) =>
            placeChip(category.key, `${category.emoji} ${category.label}`),
          )}
        </ScrollView>
        {filters}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <Pressable onPress={() => setSortMode('distance')} style={[styles.sortChip, sortMode === 'distance' && styles.sortChipActive]}><Text style={[styles.sortText, sortMode === 'distance' && styles.sortTextActive]}>الأقرب</Text></Pressable>
          <Pressable onPress={() => setSortMode('open')} style={[styles.sortChip, sortMode === 'open' && styles.sortChipActive]}><Text style={[styles.sortText, sortMode === 'open' && styles.sortTextActive]}>مفتوح أولاً</Text></Pressable>
          <Pressable onPress={() => setSortMode('rating')} style={[styles.sortChip, sortMode === 'rating' && styles.sortChipActive]}><Text style={[styles.sortText, sortMode === 'rating' && styles.sortTextActive]}>الأعلى تقييماً</Text></Pressable>
          <Pressable onPress={() => setOpenOnly((v) => !v)} style={[styles.sortChip, openOnly && styles.sortChipActive]}><Text style={[styles.sortText, openOnly && styles.sortTextActive]}>مفتوح الآن</Text></Pressable>
          <Pressable onPress={() => setRatedOnly((v) => !v)} style={[styles.sortChip, ratedOnly && styles.sortChipActive]}><Text style={[styles.sortText, ratedOnly && styles.sortTextActive]}>له تقييم</Text></Pressable>
        </ScrollView>
        <View style={styles.filtersRow}>
          <Text style={styles.count}>{visiblePins.length} نشاط · {visiblePlaces.length} مكان قريب</Text>
          <Pressable style={styles.addButton} onPress={() => setAddMenuOpen((v) => !v)}><Text style={styles.addButtonText}>＋ إضافة موقع</Text></Pressable>
          <Pressable style={styles.locationButton} onPress={locateMe} disabled={locating}>
            <Text style={styles.locationButtonText}>
              {locating ? 'جارٍ تحديد موقعي…' : 'موقعي'}
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.placesSheet}>
        <View style={styles.placesHead}>
          <Text style={styles.placesTitle}>
            {placesLoading ? 'جارٍ تحديث خريطة الحي…' : `أماكن قريبة (${visiblePlaces.length})`}
          </Text>
          {placesLoading ? <ActivityIndicator size="small" color={C.accent} /> : null}
        </View>
        <ScrollView
          style={styles.placesScroll}
          contentContainerStyle={styles.placesContent}
          showsVerticalScrollIndicator={false}
        >
          {visiblePlaces.map(placeCard)}
          {!places.length && !placesLoading ? (
            <Text style={styles.empty}>فعّل الموقع لعرض المحلات القريبة.</Text>
          ) : null}
        </ScrollView>
      </View>

      {addMenuOpen ? (
        <View style={styles.addMenu}>
          <View style={styles.addMenuHead}><Text style={styles.addMenuTitle}>وش حاب تضيف للخريطة؟</Text><Pressable onPress={() => setAddMenuOpen(false)}><Text style={styles.closeMenuText}>إغلاق ✕</Text></Pressable></View>
          {addAction('محل أو خدمة', '🏪', '/new-service')}
          {addAction('تنبيه طارئ', '🚨', '/emergency-alert')}
          {addAction('طلب مساعدة', '🤝', '/new-request')}
          {addAction('إعلان أو منتج', '🛍️', '/marketplace-dashboard')}
          {addAction('فعالية للحي', '🎉', '/market?section=events')}
        </View>
      ) : null}

      {selectedPlace ? (
        <View style={styles.placeDetailSheet}>
          <View style={styles.detailHead}><View style={styles.placeBadge}><Text style={{ fontSize: 20 }}>{PLACE_CATEGORIES.find((c) => c.key === selectedPlace.categoryKey)?.emoji ?? '🏬'}</Text></View><View style={{ flex: 1 }}><Text style={styles.selectedTitle}>{selectedPlace.name}</Text><Text style={styles.selectedMeta}>{selectedPlace.categoryLabel} · {formatDistance(selectedPlace.distance)}</Text></View><Pressable onPress={() => setSelectedPlace(null)}><Text style={styles.closeMenuText}>✕</Text></Pressable></View>
          {selectedPlace.address ? <Text style={styles.description}>{selectedPlace.address}</Text> : null}
          <View style={styles.detailFacts}>
            {selectedPlace.openNow != null ? <Text style={[styles.miniChip, selectedPlace.openNow ? { color: '#15803d', backgroundColor: '#dcfce7' } : { color: '#b91c1c', backgroundColor: '#fee2e2' }]}>{selectedPlace.openNow ? 'مفتوح الآن' : 'مغلق حالياً'}</Text> : null}
            {selectedPlace.rating != null ? <Text style={styles.miniChip}>★ {selectedPlace.rating.toFixed(1)} · {selectedPlace.reviews} تقييم</Text> : null}
          </View>
          {selectedPlace.hoursText ? <Text style={styles.description}>🕒 {selectedPlace.hoursText}</Text> : null}
          <View style={styles.actions}>
            <Pressable style={styles.primaryAction} onPress={() => Linking.openURL(selectedPlace.mapsUrl)}><Text style={styles.primaryActionText}>الاتجاهات ↗</Text></Pressable>
            {selectedPlace.phone ? <Pressable style={styles.secondaryAction} onPress={() => Linking.openURL(`tel:${selectedPlace.phone}`)}><Text style={styles.secondaryActionText}>اتصال</Text></Pressable> : null}
            <Pressable style={styles.secondaryAction} onPress={() => setSelectedPlace(null)}><Text style={styles.secondaryActionText}>إغلاق</Text></Pressable>
          </View>
        </View>
      ) : null}

      {selected ? (
        <View style={styles.selectedPanel}>
          <Text style={styles.selectedTitle}>{selected.title}</Text>
          <Text style={styles.selectedMeta}>
            {MAP_PIN_KINDS[selected.kind].label} · {selected.area}
          </Text>
          {selected.body ? (
            <Text style={styles.description} numberOfLines={3}>{selected.body}</Text>
          ) : null}
          {selected.approximate ? (
            <Text style={styles.privacyHint}>
              موقع تقريبي — يُعرض الحي فقط. الإحداثي الدقيق يُرسل بالخاص.
            </Text>
          ) : null}
          <View style={styles.actions}>
            {selected.href ? (
              <Pressable style={styles.primaryAction} onPress={() => router.push(selected.href as never)}>
                <Text style={styles.primaryActionText}>فتح التفاصيل</Text>
              </Pressable>
            ) : null}
            <Pressable
              style={styles.secondaryAction}
              onPress={() => Linking.openURL(navigationUrl(selected.lat, selected.lng))}
            >
              <Text style={styles.secondaryActionText}>الاتجاهات ↗</Text>
            </Pressable>
            {selected.phone ? (
              <Pressable
                style={styles.secondaryAction}
                onPress={() => Linking.openURL(`tel:${selected.phone}`)}
              >
                <Text style={styles.secondaryActionText}>اتصال</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.secondaryAction} onPress={() => setSelected(null)}>
              <Text style={styles.secondaryActionText}>إغلاق</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <Pressable style={styles.close} onPress={() => router.back()}>
        <Text style={styles.closeText}>رجوع</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  map: { flex: 1 },
  overlay: {
    position: 'absolute',
    top: 42,
    left: 12,
    right: 12,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 10,
    elevation: 5,
  },
  search: {
    backgroundColor: C.bg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    color: C.ink,
    textAlign: 'right',
    fontSize: 14,
  },
  filters: { marginTop: 8, gap: 6 },
  chipRow: { flexDirection: 'row-reverse', gap: 6, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: C.line,
  },
  chipText: { fontSize: 11, fontWeight: '800', color: C.muted },
  cityChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: C.accentSoft,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  cityChipActive: { backgroundColor: C.accent, borderColor: C.accent },
  cityChipText: { fontSize: 11.5, fontWeight: '800', color: C.accent },
  cityScope: { fontSize: 12, fontWeight: '800', color: C.muted, textAlign: 'right', paddingHorizontal: 8 },
  placeChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#5eead4',
  },
  placeChipActive: { backgroundColor: '#134e4a', borderColor: '#134e4a' },
  placeChipText: { fontSize: 11.5, fontWeight: '800', color: '#0F766E' },
  filtersRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginTop: 4 },
  count: { flex: 1, color: C.muted, fontSize: 12, fontWeight: '800' },
  locationButton: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: '#eef6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  locationButtonText: { color: '#1769aa', fontSize: 12, fontWeight: '800' },
  pinWrap: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  pin: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#fff',
  },
  pinEmoji: { fontSize: 13 },
  pinPulse: {
    position: 'absolute',
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    opacity: 0.7,
  },
  myLocationDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(37,99,235,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  myLocationInner: { width: 11, height: 11, borderRadius: 6, backgroundColor: '#2563eb' },
  listCard: {
    flexDirection: 'row-reverse',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.line,
    padding: 12,
    marginBottom: 8,
  },
  listBadge: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  listBody: { flex: 1 },
  listTitle: { fontSize: 13.5, fontWeight: '800', color: C.ink, lineHeight: 20 },
  listMeta: { fontSize: 11.5, color: C.muted, marginTop: 3, fontWeight: '600' },
  sortChip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 14, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: C.line },
  sortChipActive: { backgroundColor: '#134e4a', borderColor: '#134e4a' },
  sortText: { fontSize: 11, fontWeight: '800', color: C.muted },
  sortTextActive: { color: '#fff' },
  addButton: { borderRadius: 11, paddingHorizontal: 11, paddingVertical: 8, backgroundColor: '#0f766e' },
  addButtonText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  addMenuWeb: { backgroundColor: '#fff', borderRadius: 16, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: C.line },
  placeDetailWeb: { backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.line },
  addMenu: { position: 'absolute', left: 14, right: 14, bottom: 70, backgroundColor: '#fff', borderRadius: 20, padding: 14, elevation: 12, zIndex: 20, borderWidth: 1, borderColor: C.line },
  addMenuHead: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  addMenuTitle: { fontSize: 15, fontWeight: '900', color: C.ink, textAlign: 'right' },
  closeMenuText: { color: C.muted, fontSize: 12, fontWeight: '800', padding: 5 },
  addAction: { paddingVertical: 12, paddingHorizontal: 12, backgroundColor: '#f8fafc', borderRadius: 12, marginTop: 6 },
  addActionText: { color: C.ink, fontWeight: '800', textAlign: 'right' },
  placeDetailSheet: { position: 'absolute', left: 12, right: 12, bottom: 250, backgroundColor: '#fff', borderRadius: 20, padding: 16, elevation: 12, zIndex: 10, borderWidth: 1, borderColor: C.line },
  detailHead: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  detailFacts: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  selectedPanel: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 250,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    elevation: 8,
  },
  privacyHint: { fontSize: 11.5, color: '#b45309', fontWeight: '700', textAlign: 'right', marginTop: 7 },
  placesSheet: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 62,
    maxHeight: 240,
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    elevation: 7,
  },
  placesHead: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 6 },
  placesTitle: { flex: 1, fontSize: 12.5, fontWeight: '900', color: C.ink, textAlign: 'right' },
  placesScroll: { maxHeight: 190 },
  placesContent: { gap: 8, paddingBottom: 4 },
  placeCard: {
    flexDirection: 'row-reverse',
    gap: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.line,
    padding: 10,
  },
  placeBadge: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#ccfbf1', alignItems: 'center', justifyContent: 'center' },
  placeBody: { flex: 1, gap: 3 },
  placeName: { fontSize: 13.5, fontWeight: '900', color: C.ink },
  placeMeta: { fontSize: 11.5, color: C.muted, fontWeight: '600' },
  placeChips: { flexDirection: 'row-reverse', gap: 5, marginTop: 2 },
  miniChip: {
    fontSize: 10.5,
    fontWeight: '800',
    color: C.muted,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  selectedTitle: { fontSize: 16, fontWeight: '900', color: C.ink, textAlign: 'right' },
  selectedMeta: { fontSize: 12, color: C.accent, fontWeight: '800', marginTop: 4, textAlign: 'right' },
  description: { fontSize: 13, color: C.muted, textAlign: 'right', marginTop: 7, lineHeight: 20 },
  actions: { flexDirection: 'row-reverse', gap: 8, marginTop: 12 },
  primaryAction: { flex: 1, backgroundColor: C.accent, borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  primaryActionText: { color: '#fff', fontWeight: '800' },
  secondaryAction: { paddingHorizontal: 14, borderRadius: 12, paddingVertical: 11, backgroundColor: '#f1f5f9', alignItems: 'center' },
  secondaryActionText: { color: C.ink, fontWeight: '800' },
  empty: { textAlign: 'center', color: C.muted, paddingVertical: 30 },
  close: {
    position: 'absolute',
    bottom: 12,
    right: 16,
    backgroundColor: C.ink,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
    elevation: 6,
  },
  closeText: { color: '#fff', fontWeight: '800' },
});
