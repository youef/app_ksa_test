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
import { C, S } from '@/lib/ui';
import { getCurrentDeviceLocation, type DeviceLocation } from '@/lib/deviceLocation';
import {
  MAP_PIN_KINDS,
  MAP_PIN_ORDER,
  countByCity,
  countByKind,
  filterPins,
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

const STYLE_URL = 'https://demotiles.maplibre.org/style.json';
const DEFAULT_CENTER = [46.6753, 24.7136];

type KindFilter = MapPinKind | 'all';

export default function MapScreen() {
  const [pins, setPins] = useState<MapPin[]>([]);
  const [kind, setKind] = useState<KindFilter>('all');
  const [city, setCity] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<MapPin | null>(null);
  const [myLocation, setMyLocation] = useState<DeviceLocation | null>(null);
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [placeCategory, setPlaceCategory] = useState<string>(ALL_PLACES_KEY);
  const [placesLoading, setPlacesLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await loadMapPins();
        if (!cancelled) setPins(loaded);
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
    const origin = myLocation ?? (await getCurrentDeviceLocation());
    if (!origin) return;
    setMyLocation(origin);
    setPlacesLoading(true);
    const results = await searchNearbyPlaces({
      lat: origin.latitude,
      lng: origin.longitude,
      category: category === ALL_PLACES_KEY ? null : category,
    });
    setPlaces(results);
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

  const visiblePins = useMemo(
    () => filterPins(pins, { kind, city: city === 'all' ? null : city, query }),
    [pins, kind, city, query],
  );
  const kindCounts = useMemo(() => countByKind(pins), [pins]);
  const cityCounts = useMemo(() => countByCity(pins).slice(0, 8), [pins]);

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

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        <Pressable
          onPress={() => setCity('all')}
          style={[styles.cityChip, city === 'all' && styles.cityChipActive]}
        >
          <Text style={[styles.cityChipText, city === 'all' && { color: '#fff' }]}>كل المملكة</Text>
        </Pressable>
        {cityCounts.map((entry) => (
          <Pressable
            key={entry.city}
            onPress={() => setCity(entry.city)}
            style={[styles.cityChip, city === entry.city && styles.cityChipActive]}
          >
            <Text style={[styles.cityChipText, city === entry.city && { color: '#fff' }]}>
              {entry.city} ({entry.count})
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );

  const placeCard = (place: NearbyPlace) => (
    <Pressable
      key={place.id}
      style={styles.placeCard}
      onPress={() => setSelected({
        id: place.id,
        kind: 'business',
        title: place.name,
        body: [place.address, place.hoursText].filter(Boolean).join(' · '),
        city: '',
        district: '',
        area: `${place.categoryLabel} · ${formatDistance(place.distance)}`,
        lat: place.lat,
        lng: place.lng,
        approximate: false,
        exact: true,
        href: '',
        createdAt: '',
        author: '',
        ownerId: '',
        category: place.categoryLabel,
        verified: false,
        isOpen: place.openNow ?? true,
        urgent: false,
        rating: place.rating,
        price: null,
        phone: place.phone,
      })}
    >
      <View style={styles.placeBadge}>
        <Text style={{ fontSize: 17 }}>
          {PLACE_CATEGORIES.find((c) => c.key === place.categoryKey)?.emoji ?? '🏬'}
        </Text>
      </View>
      <View style={styles.placeBody}>
        <Text style={styles.placeName} numberOfLines={1}>{place.name}</Text>
        <Text style={styles.placeMeta} numberOfLines={1}>
          {place.categoryLabel} · {formatDistance(place.distance)}
          {place.address ? ` · ${place.address}` : ''}
        </Text>
        <View style={styles.placeChips}>
          {place.openNow != null ? (
            <Text style={[styles.miniChip, place.openNow
              ? { color: '#15803d', backgroundColor: '#dcfce7' }
              : { color: '#b91c1c', backgroundColor: '#fee2e2' }]}>
              {place.openNow ? 'مفتوح' : 'مغلق'}
            </Text>
          ) : null}
          {place.rating != null ? <Text style={styles.miniChip}>★ {place.rating.toFixed(1)}</Text> : null}
          {place.phone ? (
            <Text style={[styles.miniChip, { color: '#1d4ed8', backgroundColor: '#eff6ff' }]}>
              {place.phone}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );

  if (Platform.OS === 'web') {
    return (
      <ScrollView contentContainerStyle={S.page}>
        <Text style={S.title}>الخريطة</Text>
        <Text style={S.subtitle}>الأسئلة وطلبات المساعدة والمحلات حول موقعك.</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="ابحث..."
          placeholderTextColor={C.muted}
          style={styles.search}
        />
        {filters}
        {visiblePins.map((pin) => (
          <Pressable key={pin.id} style={styles.listCard} onPress={() => router.push(pin.href as never)}>
            <Text style={styles.listTitle} numberOfLines={2}>
              {MAP_PIN_KINDS[pin.kind].emoji} {pin.title}
            </Text>
            <Text style={styles.listMeta} numberOfLines={1}>{pin.area}</Text>
          </Pressable>
        ))}
        <Pressable style={S.ghost} onPress={() => router.back()}><Text>رجوع</Text></Pressable>
      </ScrollView>
    );
  }

  return (
    <View style={styles.root}>
      <Map style={styles.map} mapStyle={STYLE_URL}>
        <Camera
          key={myLocation ? `${myLocation.latitude}:${myLocation.longitude}` : 'default'}
          defaultSettings={{
            centerCoordinate: myLocation ? [myLocation.longitude, myLocation.latitude] : DEFAULT_CENTER,
            zoomLevel: myLocation ? 13 : 5.5,
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
          <Marker key={`place-${place.id}`} id={`place-${place.id}`} lngLat={[place.lng, place.lat]} anchor="bottom">
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
          {placeChip(ALL_PLACES_KEY, 'كل المحلات')}
          {PLACE_CATEGORIES.map((category) =>
            placeChip(category.key, `${category.emoji} ${category.label}`),
          )}
        </ScrollView>
        {filters}
        <View style={styles.filtersRow}>
          <Text style={styles.count}>
            {visiblePins.length} نشاط · {places.length} محل قريب
          </Text>
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
            {placesLoading ? 'جارٍ البحث عن المحلات القريبة…' : `أقرب المحلات (${places.length})`}
          </Text>
          {placesLoading ? <ActivityIndicator size="small" color={C.accent} /> : null}
        </View>
        <ScrollView
          style={styles.placesScroll}
          contentContainerStyle={styles.placesContent}
          showsVerticalScrollIndicator={false}
        >
          {places.map(placeCard)}
          {!places.length && !placesLoading ? (
            <Text style={styles.empty}>فعّل الموقع لعرض المحلات القريبة.</Text>
          ) : null}
        </ScrollView>
      </View>

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