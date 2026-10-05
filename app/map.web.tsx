import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import {
  Flame,
  MapPin as MapPinIcon,
  Navigation,
  Phone,
  Search,
  Star,
  Store,
  X,
} from 'lucide-react-native';

import { C } from '@/lib/ui';
import { supabase } from '@/lib/supabase';
import { getCurrentDeviceLocation, type DeviceLocation } from '@/lib/deviceLocation';
import { loadGoogleMaps, pinElement, pinSvg } from '@/lib/googleMaps';
import {
  MAP_PIN_KINDS,
  MAP_PIN_ORDER,
  countByCity,
  countByKind,
  directionsUrl,
  filterPins,
  loadMapPins,
  relativeTime,
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

const KSA_CENTER = { lat: 23.9, lng: 45.5 };
const KSA_BOUNDS = { north: 32.6, south: 15.9, east: 56.1, west: 34.4 };
const MAP_ID = process.env.EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID || '';

const MAP_STYLES: any[] = [
  { elementType: 'geometry', stylers: [{ color: '#eef2f6' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#475569' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f8fafc' }] },
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#dcfce7' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#f1f5f9' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#dbeafe' }] },
];

type KindFilter = MapPinKind | 'all';

interface RenderedMarker {
  id: string;
  advanced: boolean;
  marker: any;
}

/** Info window for a community post: neighbourhood only, never an exact fix. */
function buildPinInfoWindow(pin: MapPin, onOpen: () => void, onClose: () => void) {
  const kind = MAP_PIN_KINDS[pin.kind];
  const wrap = document.createElement('div');
  wrap.dir = 'rtl';
  wrap.style.cssText =
    'font-family:inherit;min-width:230px;max-width:280px;padding:2px 4px;direction:rtl;';

  const tag = document.createElement('div');
  tag.textContent = `${kind.emoji} ${kind.short}`;
  tag.style.cssText = `display:inline-block;background:${kind.color}1a;color:${kind.color};font-weight:800;font-size:11px;padding:3px 9px;border-radius:999px;margin-bottom:6px;`;
  wrap.appendChild(tag);

  const title = document.createElement('div');
  title.textContent = pin.title;
  title.style.cssText =
    'font-size:15px;font-weight:800;color:#0f172a;line-height:1.35;margin-bottom:5px;';
  wrap.appendChild(title);

  const area = document.createElement('div');
  area.textContent = `📍 ${pin.area}`;
  area.style.cssText = 'font-size:12px;font-weight:700;color:#059669;';
  wrap.appendChild(area);

if (pin.approximate) {
    const hint = document.createElement('div');
    hint.textContent = 'موقع تقريبي على الخريطة — يُعرض الحي فقط حفاظاً على الخصوصية.';
    hint.style.cssText = 'font-size:10px;color:#b45309;font-weight:700;margin-top:3px;';
    wrap.appendChild(hint);
  }

  if (pin.body) {
    const body = document.createElement('div');
    body.textContent = pin.body;
    body.style.cssText = 'font-size:12px;color:#475569;line-height:1.5;margin-top:5px;';
    wrap.appendChild(body);
  }

  const badges = document.createElement('div');
  badges.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;';
  const chips: string[] = [];
  if (pin.category) chips.push(pin.category);
  if (pin.verified) chips.push('موثّق');
  if (pin.isOpen) chips.push('مفتوح');
  if (pin.urgent) chips.push('عاجل');
  if (pin.rating != null) chips.push(`★ ${pin.rating.toFixed(1)}`);
  if (pin.price != null && pin.price > 0) chips.push(`${pin.price} ر.س`);
  const when = relativeTime(pin.createdAt);
  if (when) chips.push(when);
  chips.forEach((text) => {
    const chip = document.createElement('span');
    chip.textContent = text;
    chip.style.cssText =
      'font-size:10.5px;font-weight:700;color:#334155;background:#f1f5f9;border-radius:8px;padding:2px 7px;';
    badges.appendChild(chip);
  });
  wrap.appendChild(badges);

  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:6px;margin-top:10px;';

  const openButton = document.createElement('button');
  openButton.textContent = 'فتح التفاصيل';
  openButton.style.cssText = `flex:1;border:none;border-radius:10px;padding:9px;background:${C.accent};color:#fff;font-weight:800;font-size:13px;cursor:pointer;font-family:inherit;`;
  openButton.onclick = () => {
    onOpen();
    onClose();
  };

  if (pin.kind === 'business') {
    const dirButton = document.createElement('button');
    dirButton.textContent = pin.phone ? 'الاتصال' : 'الاتجاهات';
    dirButton.style.cssText =
      'border:1px solid #e2e8f0;border-radius:10px;padding:9px 12px;background:#fff;color:#0f172a;font-weight:800;font-size:13px;cursor:pointer;font-family:inherit;';
    dirButton.onclick = () => {
      if (pin.phone) window.open(`tel:${pin.phone}`, '_self');
      else window.open(directionsUrl(pin), '_blank', 'noopener');
    };
    actions.appendChild(openButton);
    actions.appendChild(dirButton);
  } else {
    const chatButton = document.createElement('button');
    chatButton.textContent = 'تواصل بالحي';
    chatButton.style.cssText =
      'border:1px solid #e2e8f0;border-radius:10px;padding:9px 12px;background:#fff;color:#0f172a;font-weight:800;font-size:13px;cursor:pointer;font-family:inherit;';
    chatButton.onclick = () => {
      onOpen();
      onClose();
    };
    actions.appendChild(openButton);
    actions.appendChild(chatButton);
  }

  wrap.appendChild(actions);
  return { content: wrap, anchor: { lat: pin.lat, lng: pin.lng } };
}

/** Rich info window for a nearby shop, with phone and opening state. */
function buildPlaceInfoWindow(place: NearbyPlace, onClose: () => void) {
  const wrap = document.createElement('div');
  wrap.dir = 'rtl';
  wrap.style.cssText =
    'font-family:inherit;min-width:240px;max-width:290px;padding:2px 4px;direction:rtl;';

  const tag = document.createElement('div');
  tag.textContent = `${place.categoryLabel} · ${formatDistance(place.distance)}`;
  tag.style.cssText =
    'display:inline-block;background:#0596691a;color:#059669;font-weight:800;font-size:11px;padding:3px 9px;border-radius:999px;margin-bottom:6px;';
  wrap.appendChild(tag);

  const title = document.createElement('div');
  title.textContent = place.name;
  title.style.cssText =
    'font-size:15px;font-weight:800;color:#0f172a;line-height:1.35;margin-bottom:4px;';
  wrap.appendChild(title);

  if (place.address) {
    const address = document.createElement('div');
    address.textContent = place.address;
    address.style.cssText = 'font-size:12px;color:#475569;line-height:1.45;';
    wrap.appendChild(address);
  }

  const chips = document.createElement('div');
  chips.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;';
  const entries: Array<{ text: string; style: string }> = [];
  if (place.openNow != null) {
    entries.push({
      text: place.openNow ? 'مفتوح الآن' : 'مغلق حالياً',
      style: place.openNow
        ? 'background:#dcfce7;color:#15803d'
        : 'background:#fee2e2;color:#b91c1c',
    });
  }
  if (place.rating != null) {
    entries.push({ text: `★ ${place.rating.toFixed(1)} (${place.reviews})`, style: 'background:#fef3c7;color:#b45309' });
  }
  entries.forEach((entry) => {
    const chip = document.createElement('span');
    chip.textContent = entry.text;
    chip.style.cssText =
      `font-size:10.5px;font-weight:800;border-radius:8px;padding:2px 7px;${entry.style}`;
    chips.appendChild(chip);
  });
  wrap.appendChild(chips);

  if (place.hoursText) {
    const hours = document.createElement('div');
    hours.textContent = `🕒 ${place.hoursText}`;
    hours.style.cssText = 'font-size:11px;color:#334155;font-weight:700;margin-top:6px;';
    wrap.appendChild(hours);
  }

  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:6px;margin-top:10px;';

  const dirButton = document.createElement('button');
  dirButton.textContent = 'الاتجاهات';
  dirButton.style.cssText = `flex:1;border:none;border-radius:10px;padding:9px;background:${C.accent};color:#fff;font-weight:800;font-size:13px;cursor:pointer;font-family:inherit;`;
  dirButton.onclick = () => {
    window.open(navigationUrl(place.lat, place.lng), '_blank', 'noopener');
    onClose();
  };
  actions.appendChild(dirButton);

  if (place.phone) {
    const callButton = document.createElement('button');
    callButton.textContent = 'اتصال';
    callButton.style.cssText =
      'border:1px solid #e2e8f0;border-radius:10px;padding:9px 14px;background:#fff;color:#0f172a;font-weight:800;font-size:13px;cursor:pointer;font-family:inherit;';
    callButton.onclick = () => window.open(`tel:${place.phone}`, '_self');
    actions.appendChild(callButton);
  }

  wrap.appendChild(actions);
  return { content: wrap, anchor: { lat: place.lat, lng: place.lng } };
}

export default function WebMap() {
  const { width } = useWindowDimensions();
  const isWide = width >= 980;

  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const apiRef = useRef<any>(null);
  const pinMarkersRef = useRef<RenderedMarker[]>([]);
  const placeMarkersRef = useRef<RenderedMarker[]>([]);
  const openInfoRef = useRef<((pin: MapPin) => void) | null>(null);
  const heatRef = useRef<any>(null);
  const infoRef = useRef<any>(null);
  const myMarkerRef = useRef<any>(null);

  const [pins, setPins] = useState<MapPin[]>([]);
  const [kind, setKind] = useState<KindFilter>('all');
  const [city, setCity] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [heatOn, setHeatOn] = useState(false);
  const [locating, setLocating] = useState(false);
  const [myLocation, setMyLocation] = useState<DeviceLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [placeCategory, setPlaceCategory] = useState<string>(ALL_PLACES_KEY);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const refreshPins = useCallback(async () => {
    try {
      const loaded = await loadMapPins();
      setPins(loaded);
    } catch (error: any) {
      console.warn('map pins failed', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // ---------------------------------------------------------------- map bootstrap
  useEffect(() => {
    let cancelled = false;

    loadGoogleMaps()
      .then((api) => {
        if (cancelled || !mapElRef.current) return;
        apiRef.current = api;
        const map = new api.Map(mapElRef.current, {
          center: KSA_CENTER,
          zoom: 6,
          minZoom: 5,
          maxZoom: 18,
          restriction: { latLngBounds: KSA_BOUNDS },
          clickableIcons: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: 'greedy',
          styles: MAP_ID ? undefined : MAP_STYLES,
          mapTypeControl: false,
          zoomControl: true,
          ...(MAP_ID ? { mapId: MAP_ID } : {}),
        });
        mapRef.current = map;
        infoRef.current = new api.InfoWindow({ disableAutoPan: false });
        setMapReady(true);
        map.addListener('idle', () => {
          const center = map.getCenter();
          if (center && !isInsideSaudi(center.lat(), center.lng())) {
            map.panTo(KSA_CENTER);
          }
        });
      })
      .catch((error: any) => {
        if (!cancelled) setMapError(error?.message || 'تعذّر تحميل الخريطة.');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void refreshPins();
  }, [refreshPins]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const channel = supabase
      .channel(`map-live-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'questions' }, schedule)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'requests' }, schedule);
    channel.subscribe();

    function schedule() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void refreshPins(), 1500);
    }

    return () => {
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [refreshPins]);

  const visiblePins = useMemo(
    () => filterPins(pins, { kind, city: city === 'all' ? null : city, query }),
    [pins, kind, city, query],
  );
  const kindCounts = useMemo(() => countByKind(pins), [pins]);
  const cityCounts = useMemo(() => countByCity(pins).slice(0, 8), [pins]);

  // ---------------------------------------------------------------- marker plumbing
  const clearGroup = useCallback((group: 'pin' | 'place') => {
    const api = apiRef.current;
    const list = group === 'pin' ? pinMarkersRef.current : placeMarkersRef.current;
    list.forEach((entry) => {
      if (!api) return;
      if (entry.advanced) entry.marker.map = null;
      else entry.marker.setMap(null);
    });
    if (group === 'pin') pinMarkersRef.current = [];
    else placeMarkersRef.current = [];
  }, []);

  const makeMarker = useCallback(
    (position: { lat: number; lng: number }, title: string, color: string, emoji: string, onClick: () => void) => {
      const api = apiRef.current;
      const map = mapRef.current;
      if (!api || !map) return null;
      const useAdvanced = Boolean(MAP_ID) && Boolean(api.marker?.AdvancedMarkerElement);
      if (useAdvanced) {
        const marker = new api.marker.AdvancedMarkerElement({
          map,
          position,
          title,
          zIndex: 20,
          content: pinElement(color, emoji, false),
        });
        marker.addListener('click', onClick);
        return { advanced: true, marker } as Omit<RenderedMarker, 'id'>;
      }
      const marker = new api.Marker({
        map,
        position,
        title,
        icon: {
          url: pinSvg(color, emoji),
          scaledSize: new api.Size(38, 50),
          anchor: new api.Point(19, 48),
        },
        zIndex: 20,
      });
      marker.addListener('click', onClick);
      return { advanced: false, marker } as Omit<RenderedMarker, 'id'>;
    },
    [],
  );

  useEffect(() => {
    if (!mapReady) return;
    clearGroup('pin');

    const openPin = (pin: MapPin) => {
      if (infoRef.current) {
        const { content, anchor } = buildPinInfoWindow(
          pin,
          () => router.push(pin.href as never),
          () => infoRef.current?.close(),
        );
        infoRef.current.setContent(content);
        infoRef.current.open({ map: mapRef.current, anchor });
      }
    };
    openInfoRef.current = openPin;

    visiblePins.forEach((pin) => {
      const kindMeta = MAP_PIN_KINDS[pin.kind];
      const entry = makeMarker(
        { lat: pin.lat, lng: pin.lng },
        pin.title,
        kindMeta.color,
        kindMeta.emoji,
        () => openPin(pin),
      );
      if (entry) pinMarkersRef.current.push({ id: pin.id, ...entry });
    });

    return () => {
      openInfoRef.current = null;
    };
  }, [visiblePins, clearGroup, mapReady, makeMarker]);

  useEffect(() => {
    if (!mapReady) return;
    clearGroup('place');

    places.forEach((place) => {
      const entry = makeMarker(
        { lat: place.lat, lng: place.lng },
        place.name,
        '#0F766E',
        '🏬',
        () => {
          if (infoRef.current) {
            const { content, anchor } = buildPlaceInfoWindow(place, () =>
              infoRef.current?.close(),
            );
            infoRef.current.setContent(content);
            infoRef.current.open({ map: mapRef.current, anchor });
          }
        },
      );
      if (entry) placeMarkersRef.current.push({ id: place.id, ...entry });
    });
  }, [places, clearGroup, mapReady, makeMarker]);

  useEffect(
    () => () => {
      clearGroup('pin');
      clearGroup('place');
    },
    [clearGroup],
  );

  // ---------------------------------------------------------------- heatmap
  useEffect(() => {
    const api = apiRef.current;
    const map = mapRef.current;
    if (!api || !map || !mapReady) return;

    if (heatRef.current) {
      heatRef.current.setMap(null);
      heatRef.current = null;
    }
    if (!heatOn) return;

    let cancelled = false;
    const build = api.visualization
      ? Promise.resolve(api.visualization)
      : api.importLibrary('visualization');

    build
      .then((visualization: any) => {
        if (cancelled || !visualization?.HeatmapLayer) return;
        heatRef.current = new visualization.HeatmapLayer({
          data: visiblePins.map((pin) => ({ location: { lat: pin.lat, lng: pin.lng } })),
          radius: 42,
          opacity: 0.5,
          dissipating: true,
          gradient: ['rgba(5,150,105,0)', '#34d399', '#059669', '#065f46'],
        });
        heatRef.current.setMap(map);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [heatOn, visiblePins, mapReady]);

  // ---------------------------------------------------------------- nearby places
  const runPlaceSearch = useCallback(
    async (nextCategory: string, nextQuery: string) => {
      const origin = myLocation ?? (await getCurrentDeviceLocation());
      if (!origin) {
        setSheetOpen(true);
        return;
      }
      if (!myLocation) setMyLocation(origin);
      setPlacesLoading(true);
      setSheetOpen(true);
      const results = await searchNearbyPlaces({
        lat: origin.latitude,
        lng: origin.longitude,
        category: nextCategory === ALL_PLACES_KEY ? null : nextCategory,
        text: nextQuery,
      });
      setPlaces(results);
      setPlacesLoading(false);
    },
    [myLocation],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (places.length || placesLoading) return;
      void runPlaceSearch(placeCategory, query);
    }, 900);
    return () => clearTimeout(timer);
    // Auto-runs once on first load so the map is useful immediately.
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------- actions
  const focusCity = useCallback(
    (targetCity: string) => {
      const map = mapRef.current;
      const api = apiRef.current;
      if (!map || !api) return;
      if (targetCity === 'all') {
        if (pins.length) {
          const bounds = new api.LatLngBounds();
          pins.forEach((pin) => bounds.extend({ lat: pin.lat, lng: pin.lng }));
          map.fitBounds(bounds, 60);
        } else {
          map.setZoom(6);
        }
        return;
      }
      const target = pins.filter((pin) => pin.city === targetCity);
      if (!target.length) return;
      const bounds = new api.LatLngBounds();
      target.forEach((pin) => bounds.extend({ lat: pin.lat, lng: pin.lng }));
      map.fitBounds(bounds, 70);
    },
    [pins],
  );

  const locateMe = useCallback(async () => {
    setLocating(true);
    const location = await getCurrentDeviceLocation();
    setLocating(false);
    if (!location) return;
    setMyLocation(location);

    const api = apiRef.current;
    const map = mapRef.current;
    if (!api || !map || !mapReady) return;
    if (myMarkerRef.current) {
      if (myMarkerRef.current.setMap) myMarkerRef.current.setMap(null);
      else myMarkerRef.current.map = null;
      myMarkerRef.current = null;
    }
    const entry = makeMarker(
      { lat: location.latitude, lng: location.longitude },
      'موقعي',
      '#2563EB',
      '📍',
      () => undefined,
    );
    if (entry) myMarkerRef.current = entry.marker;
    map.panTo({ lat: location.latitude, lng: location.longitude });
    map.setZoom(14);
    void runPlaceSearch(placeCategory, query);
  }, [mapReady, makeMarker, placeCategory, query, runPlaceSearch]);

  const focusPlace = useCallback((place: NearbyPlace) => {
    const map = mapRef.current;
    if (!map) return;
    map.panTo({ lat: place.lat, lng: place.lng });
    map.setZoom(16);
    if (infoRef.current) {
      const { content, anchor } = buildPlaceInfoWindow(place, () => infoRef.current?.close());
      infoRef.current.setContent(content);
      infoRef.current.open({ map, anchor });
    }
  }, []);

  // ---------------------------------------------------------------- render
  const kindChip = (value: KindFilter, label: string, color: string, count: number) => {
    const active = kind === value;
    return (
      <Pressable
        key={value}
        onPress={() => setKind(value)}
        style={[styles.chip, active && { backgroundColor: color, borderColor: color }]}
      >
        <Text style={[styles.chipText, active && styles.chipTextActive]}>
          {label} ({count})
        </Text>
      </Pressable>
    );
  };

  const placeRow = (place: NearbyPlace) => {
    const open = place.openNow;
    return (
      <Pressable
        key={place.id}
        onPress={() => focusPlace(place)}
        style={styles.placeRow}
      >
        <View style={styles.placeBadge}>
          <Text style={{ fontSize: 17 }}>
            {PLACE_CATEGORIES.find((c) => c.key === place.categoryKey)?.emoji ?? '🏬'}
          </Text>
        </View>
        <View style={styles.placeBody}>
          <Text style={styles.placeName} numberOfLines={1}>
            {place.name}
          </Text>
          <Text style={styles.placeMeta} numberOfLines={1}>
            {place.categoryLabel} · {formatDistance(place.distance)}
            {place.address ? ` · ${place.address}` : ''}
          </Text>
          <View style={styles.placeChips}>
            {open != null ? (
              <Text
                style={[
                  styles.miniChip,
                  open
                    ? { color: '#15803d', backgroundColor: '#dcfce7' }
                    : { color: '#b91c1c', backgroundColor: '#fee2e2' },
                ]}
              >
                {open ? 'مفتوح' : 'مغلق'}
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
        <View style={styles.placeActions}>
          <Pressable
            hitSlop={8}
            onPress={() => window.open(navigationUrl(place.lat, place.lng), '_blank', 'noopener')}
            style={styles.placeActionBtn}
          >
            <Navigation size={15} color={C.accent} />
          </Pressable>
          {place.phone ? (
            <Pressable
              hitSlop={8}
              onPress={() => window.open(`tel:${place.phone}`, '_self')}
              style={styles.placeActionBtn}
            >
              <Phone size={15} color={C.accent} />
            </Pressable>
          ) : null}
        </View>
      </Pressable>
    );
  };

  const placesSheet = (
    <View style={[styles.sheet, isWide ? styles.sheetWide : styles.sheetMobile]}>
      <View style={styles.sheetHandle} />
      <View style={styles.sheetHead}>
        <Store size={17} color={C.accent} />
        <Text style={styles.sheetTitle}>
          {placesLoading ? 'جارٍ البحث عن المحلات القريبة…' : `أقرب المحلات (${places.length})`}
        </Text>
        {placesLoading ? (
          <ActivityIndicator size="small" color={C.accent} />
        ) : (
          <Pressable onPress={() => setSheetOpen(false)} hitSlop={8}>
            <X size={16} color={C.muted} />
          </Pressable>
        )}
      </View>
      <ScrollView
        style={styles.sheetScroll}
        contentContainerStyle={styles.sheetContent}
        showsVerticalScrollIndicator={false}
      >
        {places.map(placeRow)}
        {!places.length && !placesLoading ? (
          <Text style={styles.emptyText}>
            لا توجد نتائج قريبة. فعّل الموقع أو جرّب فئة أخرى.
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.root}>
      {/* @ts-ignore raw div hosts the Google Maps canvas */}
      <div ref={(node) => { mapElRef.current = node; }} style={{ width: '100%', height: '100%' }} />

      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <MapPinIcon size={20} color={C.accent} />
          </Pressable>
          <View style={styles.topTitleWrap}>
            <Text style={styles.topTitle}>خريطة الجيران</Text>
            <Text style={styles.topSubtitle}>
              {visiblePins.length} نشاط · {places.length} محل قريب
            </Text>
          </View>
          <Pressable
            onPress={() => setHeatOn((value) => !value)}
            style={[styles.iconBtn, heatOn && styles.iconBtnActive]}
          >
            <Flame size={18} color={heatOn ? '#fff' : C.accent} />
          </Pressable>
          <Pressable
            onPress={() => void locateMe()}
            style={[styles.iconBtn, locating && { opacity: 0.6 }]}
          >
            <Navigation size={18} color={C.accent} />
          </Pressable>
        </View>

        <View style={styles.searchRow}>
          <Search size={17} color={C.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => void runPlaceSearch(placeCategory, query)}
            placeholder="ابحث عن بقالة، صيدلية، حلاق، سباك..."
            placeholderTextColor={C.muted}
            style={styles.search}
            returnKeyType="search"
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8}>
              <X size={16} color={C.muted} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipScroll}
          style={styles.chipBar}
        >
          <Pressable
            onPress={() => {
              setPlaceCategory(ALL_PLACES_KEY);
              void runPlaceSearch(ALL_PLACES_KEY, query);
            }}
            style={[
              styles.placeChip,
              placeCategory === ALL_PLACES_KEY && styles.placeChipActive,
            ]}
          >
            <Text
              style={[
                styles.placeChipText,
                placeCategory === ALL_PLACES_KEY && styles.placeChipTextActive,
              ]}
            >
              الكل
            </Text>
          </Pressable>
          {PLACE_CATEGORIES.map((category) => (
            <Pressable
              key={category.key}
              onPress={() => {
                setPlaceCategory(category.key);
                void runPlaceSearch(category.key, '');
              }}
              style={[
                styles.placeChip,
                placeCategory === category.key && styles.placeChipActive,
              ]}
            >
              <Text style={styles.placeChipText}>
                {category.emoji} {category.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipScroll}
          style={styles.chipBar}
        >
          {kindChip('all', 'كل النشاط', C.ink, kindCounts.all || 0)}
          {MAP_PIN_ORDER.map((value) => {
            const meta = MAP_PIN_KINDS[value];
            return kindChip(value, `${meta.emoji} ${meta.short}`, meta.color, kindCounts[value] || 0);
          })}
          <View style={styles.divider} />
          <Pressable
            onPress={() => {
              setCity('all');
              focusCity('all');
            }}
            style={[styles.cityChip, city === 'all' && styles.cityChipActive]}
          >
            <Text style={[styles.cityChipText, city === 'all' && styles.cityChipTextActive]}>
              كل المملكة
            </Text>
          </Pressable>
          {cityCounts.map((entry) => (
            <Pressable
              key={entry.city}
              onPress={() => {
                setCity(entry.city);
                focusCity(entry.city);
              }}
              style={[styles.cityChip, city === entry.city && styles.cityChipActive]}
            >
              <Text style={[styles.cityChipText, city === entry.city && styles.cityChipTextActive]}>
                {entry.city} ({entry.count})
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {mapError ? (
        <View style={styles.mapError}>
          <Text style={styles.mapErrorText}>{mapError}</Text>
          <Text style={styles.mapErrorHint}>
            تأكد من تفعيل Maps JavaScript API للمفتاح في Google Cloud Console.
          </Text>
        </View>
      ) : null}

      {!loading && !pins.length && !mapError && !sheetOpen ? (
        <View style={styles.mapHint}>
          <Text style={styles.mapHintText}>
            لا يوجد نشاط مسجّل بعد — أنشئ سؤالاً أو طلب مساعدة وسيظهر هنا.
          </Text>
        </View>
      ) : null}

      {sheetOpen ? placesSheet : null}

      <View style={styles.legend}>
        <Text style={styles.legendText}>📍лощаيات الحي فقط — الموقع الدقيق بالخاص</Text>
      </View>
    </View>
  );
}

function isInsideSaudi(lat: number, lng: number): boolean {
  return lat >= KSA_BOUNDS.south && lat <= KSA_BOUNDS.north && lng >= KSA_BOUNDS.west && lng <= KSA_BOUNDS.east;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    paddingTop: 46,
    paddingBottom: 8,
    paddingHorizontal: 14,
    gap: 8,
  },
  topRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  topTitleWrap: { flex: 1, alignItems: 'center' },
  topTitle: { fontSize: 16, fontWeight: '900', color: C.ink },
  topSubtitle: { fontSize: 11, fontWeight: '700', color: C.accent },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.accentSoft,
  },
  iconBtnActive: { backgroundColor: C.accent },
  searchRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 42,
  },
  search: { flex: 1, textAlign: 'right', color: C.ink, fontSize: 13 },
  chipBar: { marginHorizontal: -14 },
  chipScroll: { flexDirection: 'row-reverse', gap: 6, paddingHorizontal: 14 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: C.line,
  },
  chipText: { fontSize: 11, fontWeight: '800', color: C.muted },
  chipTextActive: { color: '#fff' },
  placeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: C.line,
  },
  placeChipActive: { backgroundColor: C.accent, borderColor: C.accent },
  placeChipText: { fontSize: 11.5, fontWeight: '800', color: C.ink },
  placeChipTextActive: { color: '#fff' },
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
  cityChipTextActive: { color: '#fff' },
  divider: { width: 1, height: 18, backgroundColor: C.line, alignSelf: 'center' },
  mapError: {
    position: 'absolute',
    top: 180,
    left: 24,
    right: 24,
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
    padding: 16,
    alignItems: 'center',
    gap: 6,
  },
  mapErrorText: { color: C.danger, fontWeight: '800', textAlign: 'center' },
  mapErrorHint: { color: C.muted, fontSize: 12, textAlign: 'center' },
  mapHint: {
    position: 'absolute',
    top: 210,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 14,
    padding: 12,
  },
  mapHintText: { color: C.ink, fontSize: 12.5, fontWeight: '700', textAlign: 'center' },
  sheet: {
    backgroundColor: '#fff',
    borderColor: C.line,
    overflow: 'hidden',
  },
  sheetWide: {
    position: 'absolute',
    top: 200,
    left: 12,
    bottom: 12,
    width: 340,
    borderRadius: 18,
    borderWidth: 1,
  },
  sheetMobile: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '52%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: C.line,
    marginTop: 8,
  },
  sheetHead: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  sheetTitle: { flex: 1, fontSize: 13, fontWeight: '900', color: C.ink },
  sheetScroll: { flex: 1 },
  sheetContent: { padding: 10, paddingBottom: 24, gap: 8 },
  placeRow: {
    flexDirection: 'row-reverse',
    gap: 10,
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.line,
    backgroundColor: '#fff',
  },
  placeBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeBody: { flex: 1 },
  placeName: { fontSize: 13.5, fontWeight: '800', color: C.ink },
  placeMeta: { fontSize: 11, color: C.muted, marginTop: 2, fontWeight: '600' },
  placeChips: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 5, marginTop: 6 },
  placeActions: { justifyContent: 'center', gap: 8 },
  placeActionBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: C.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniChip: {
    fontSize: 10,
    fontWeight: '800',
    color: C.muted,
    backgroundColor: C.bg,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  emptyText: { textAlign: 'center', color: C.muted, paddingVertical: 26, fontSize: 12.5 },
  legend: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.line,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  legendText: { fontSize: 10.5, fontWeight: '800', color: C.muted },
});