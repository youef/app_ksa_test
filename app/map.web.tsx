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
  Globe,
  ShoppingBasket,
  Pill,
  Shirt,
  Scissors,
  Wrench,
  Coffee,
  Utensils,
  Croissant,
  MapPinned,
  Layers,
  MapPin as MapPinIcon,
  Navigation,
  Phone,
  Search,
  Star,
  Store,
  X,
} from 'lucide-react-native';

import { C } from '@/lib/ui';
import { AppHeader } from '@/components/shared/AppHeader';
import { supabase } from '@/lib/supabase';
import { getCurrentDeviceLocation, type DeviceLocation } from '@/lib/deviceLocation';
import { loadGoogleMaps, pinElement, pinSvg } from '@/lib/googleMaps';
import {
  MAP_PIN_KINDS,
  MAP_PIN_ORDER,
  countByKind,
  directionsUrl,
  filterPins,
  findPlaceCenter,
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
import { getActiveLocation, isAllKingdom, subscribeLocation } from '@/lib/locationSync';

const KSA_CENTER = { lat: 24.7136, lng: 46.6753 };
const KSA_BOUNDS = { north: 32.6, south: 15.9, east: 56.1, west: 34.4 };
const MAP_ID = process.env.EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID || '';

function CategoryIcon({ categoryKey, size = 16, color = '#059669' }: { categoryKey: string; size?: number; color?: string }) {
  const props = { size, color, strokeWidth: 2.2 };
  switch (categoryKey) {
    case 'grocery': return <ShoppingBasket {...props} />;
    case 'pharmacy': return <Pill {...props} />;
    case 'clothing': return <Shirt {...props} />;
    case 'salon': return <Scissors {...props} />;
    case 'hardware': return <Wrench {...props} />;
    case 'cafe': return <Coffee {...props} />;
    case 'restaurant': return <Utensils {...props} />;
    case 'bakery': return <Croissant {...props} />;
    case 'market': return <Store {...props} />;
    default: return <MapPinned {...props} />;
  }
}

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
type MapEngine = 'leaflet' | 'google';

interface RenderedMarker {
  id: string;
  advanced: boolean;
  marker: any;
}

function injectLeafletAssets() {
  if (typeof document === 'undefined') return;
  if (!document.getElementById('leaflet-css')) {
    const link = document.createElement('link');
    link.id = 'leaflet-css';
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
  }
  if (!document.getElementById('hayna-leaflet-custom-style')) {
    const style = document.createElement('style');
    style.id = 'hayna-leaflet-custom-style';
    style.textContent = `
      .leaflet-popup-content-wrapper {
        border-radius: 16px !important;
        box-shadow: 0 12px 30px -6px rgba(15, 23, 42, 0.2) !important;
        padding: 4px !important;
        direction: rtl !important;
      }
      .leaflet-popup-content {
        margin: 8px 12px !important;
        line-height: 1.4 !important;
      }
      .leaflet-container {
        font-family: inherit !important;
      }
      .leaflet-div-icon {
        background: transparent !important;
        border: none !important;
      }
    `;
    document.head.appendChild(style);
  }
}

async function getLeafletModule(): Promise<any> {
  if (typeof window === 'undefined') return null;
  const scope = window as any;
  if (scope.L && typeof scope.L.map === 'function') return scope.L;
  try {
    const mod = require('leaflet');
    const L = mod.default || mod;
    if (L && typeof L.map === 'function') {
      scope.L = L;
      return L;
    }
  } catch {}
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => resolve((window as any).L);
    script.onerror = () => reject(new Error('تعذّر تحميل مكتبة الخرائط.'));
    document.head.appendChild(script);
  });
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
  const leafletInstanceRef = useRef<any>(null);
  const leafletPinLayerRef = useRef<any>(null);
  const leafletPlaceLayerRef = useRef<any>(null);
  const leafletMyMarkerRef = useRef<any>(null);

  const googleMapRef = useRef<any>(null);
  const googleApiRef = useRef<any>(null);
  const googlePinMarkersRef = useRef<RenderedMarker[]>([]);
  const googlePlaceMarkersRef = useRef<RenderedMarker[]>([]);
  const googleInfoRef = useRef<any>(null);
  const googleMyMarkerRef = useRef<any>(null);

  const [engine, setEngine] = useState<MapEngine>('leaflet');
  const [pins, setPins] = useState<MapPin[]>([]);
  const [kind, setKind] = useState<KindFilter>('all');
  const [city, setCity] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [heatOn, setHeatOn] = useState(false);
  const [locating, setLocating] = useState(false);
  const [myLocation, setMyLocation] = useState<DeviceLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [mapNotice, setMapNotice] = useState<string | null>(null);

  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [placeCategory, setPlaceCategory] = useState<string>(ALL_PLACES_KEY);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

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

  // ---------------------------------------------------------------- Leaflet Engine Setup
  const initLeafletMap = useCallback(async () => {
    if (!mapElRef.current) return;
    injectLeafletAssets();
    const L = await getLeafletModule();
    if (!L || !mapElRef.current) return;

    // Cleanup previous map if exists
    if (leafletInstanceRef.current) {
      try { leafletInstanceRef.current.remove(); } catch {}
      leafletInstanceRef.current = null;
    }

    mapElRef.current.innerHTML = '';
    const map = L.map(mapElRef.current, {
      center: [KSA_CENTER.lat, KSA_CENTER.lng],
      zoom: 6,
      minZoom: 5,
      maxZoom: 19,
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© خريطة حيّنا · OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    leafletPinLayerRef.current = L.layerGroup().addTo(map);
    leafletPlaceLayerRef.current = L.layerGroup().addTo(map);
    leafletInstanceRef.current = map;
    setMapReady(true);
  }, []);

  // ---------------------------------------------------------------- Google Maps Engine Setup
  const initGoogleMap = useCallback(async () => {
    if (!mapElRef.current) return;

    // Handle Google auth failures gracefully
    if (typeof window !== 'undefined') {
      (window as any).gm_authFailure = () => {
        setMapNotice('تعذّر تفعيل خرائط Google (تحتاج تفعيل Maps API والفوترة في Google Cloud). تم التبديل تلقائياً لخريطة حيّنا المباشرة.');
        setEngine('leaflet');
      };
    }

    try {
      mapElRef.current.innerHTML = '';
      const api = await loadGoogleMaps();
      googleApiRef.current = api;
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
      googleMapRef.current = map;
      googleInfoRef.current = new api.InfoWindow({ disableAutoPan: false });
      setMapReady(true);
    } catch (err: any) {
      setMapNotice('تعذّر الاتصال بخوادم خرائط Google. تم الرجوع لخريطة حيّنا المباشرة.');
      setEngine('leaflet');
    }
  }, []);

  // ---------------------------------------------------------------- Bootstrap Map Engine
  useEffect(() => {
    setMapReady(false);
    if (engine === 'leaflet') {
      void initLeafletMap();
    } else {
      void initGoogleMap();
    }

    return () => {
      if (leafletInstanceRef.current) {
        try { leafletInstanceRef.current.remove(); } catch {}
        leafletInstanceRef.current = null;
      }
    };
  }, [engine, initLeafletMap, initGoogleMap]);

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
    () => city ? filterPins(pins, { kind, city, query }) : [],
    [pins, kind, city, query],
  );
  const scopedPins = useMemo(() => city ? filterPins(pins, { city }) : [], [pins, city]);
  const kindCounts = useMemo(() => countByKind(scopedPins), [scopedPins]);
  useEffect(() => {
    if (!city) return;
    const center = findPlaceCenter(city);
    if (!center) return;
    if (leafletInstanceRef.current) leafletInstanceRef.current.setView([center.lat, center.lng], 11);
    if (googleMapRef.current) {
      googleMapRef.current.setCenter({ lat: center.lat, lng: center.lng });
      googleMapRef.current.setZoom(11);
    }
  }, [city, mapReady]);

  // ---------------------------------------------------------------- Update Pins on Active Engine
  useEffect(() => {
    if (!mapReady) return;

    if (engine === 'leaflet') {
      const L = (window as any).L;
      const pinLayer = leafletPinLayerRef.current;
      if (!L || !pinLayer) return;

      pinLayer.clearLayers();
      visiblePins.forEach((pin) => {
        const kindMeta = MAP_PIN_KINDS[pin.kind];
        const icon = L.divIcon({
          className: 'hayna-custom-pin',
          html: pinElement(kindMeta.color, kindMeta.emoji, pin.urgent).outerHTML,
          iconSize: [40, 52],
          iconAnchor: [20, 50],
          popupAnchor: [0, -45],
        });
        const marker = L.marker([pin.lat, pin.lng], { icon });
        const { content } = buildPinInfoWindow(
          pin,
          () => router.push(pin.href as never),
          () => marker.closePopup(),
        );
        marker.bindPopup(content, { maxWidth: 300, minWidth: 230 });
        marker.addTo(pinLayer);
      });
    } else {
      // Google Maps pin rendering
      const api = googleApiRef.current;
      const map = googleMapRef.current;
      if (!api || !map) return;

      googlePinMarkersRef.current.forEach((m) => {
        if (m.advanced) m.marker.map = null;
        else m.marker.setMap(null);
      });
      googlePinMarkersRef.current = [];

      visiblePins.forEach((pin) => {
        const kindMeta = MAP_PIN_KINDS[pin.kind];
        const marker = new api.Marker({
          map,
          position: { lat: pin.lat, lng: pin.lng },
          title: pin.title,
          icon: {
            url: pinSvg(kindMeta.color, kindMeta.emoji),
            scaledSize: new api.Size(38, 50),
            anchor: new api.Point(19, 48),
          },
        });
        marker.addListener('click', () => {
          if (googleInfoRef.current) {
            const { content, anchor } = buildPinInfoWindow(
              pin,
              () => router.push(pin.href as never),
              () => googleInfoRef.current?.close(),
            );
            googleInfoRef.current.setContent(content);
            googleInfoRef.current.open({ map, anchor });
          }
        });
        googlePinMarkersRef.current.push({ id: pin.id, advanced: false, marker });
      });
    }
  }, [visiblePins, mapReady, engine]);

  // ---------------------------------------------------------------- Update Places on Active Engine
  useEffect(() => {
    if (!mapReady) return;

    if (engine === 'leaflet') {
      const L = (window as any).L;
      const placeLayer = leafletPlaceLayerRef.current;
      if (!L || !placeLayer) return;

      placeLayer.clearLayers();
      places.forEach((place) => {
        const icon = L.divIcon({
          className: 'hayna-custom-place',
          html: pinElement('#0F766E', '🏬', false).outerHTML,
          iconSize: [40, 52],
          iconAnchor: [20, 50],
          popupAnchor: [0, -45],
        });
        const marker = L.marker([place.lat, place.lng], { icon });
        const { content } = buildPlaceInfoWindow(place, () => marker.closePopup());
        marker.bindPopup(content, { maxWidth: 310, minWidth: 240 });
        marker.addTo(placeLayer);
      });
    } else {
      const api = googleApiRef.current;
      const map = googleMapRef.current;
      if (!api || !map) return;

      googlePlaceMarkersRef.current.forEach((m) => {
        if (m.advanced) m.marker.map = null;
        else m.marker.setMap(null);
      });
      googlePlaceMarkersRef.current = [];

      places.forEach((place) => {
        const marker = new api.Marker({
          map,
          position: { lat: place.lat, lng: place.lng },
          title: place.name,
          icon: {
            url: pinSvg('#0F766E', '🏬'),
            scaledSize: new api.Size(38, 50),
            anchor: new api.Point(19, 48),
          },
        });
        marker.addListener('click', () => {
          if (googleInfoRef.current) {
            const { content, anchor } = buildPlaceInfoWindow(place, () =>
              googleInfoRef.current?.close(),
            );
            googleInfoRef.current.setContent(content);
            googleInfoRef.current.open({ map, anchor });
          }
        });
        googlePlaceMarkersRef.current.push({ id: place.id, advanced: false, marker });
      });
    }
  }, [places, mapReady, engine]);

  // ---------------------------------------------------------------- Nearby Places Search
  const runPlaceSearch = useCallback(
    async (nextCategory: string, nextQuery: string) => {
      let origin: { latitude: number; longitude: number };
      const active = await getActiveLocation();
      if (isAllKingdom(active.city)) return;
      const center = findPlaceCenter(active.city);
      if (center) {
        origin = { latitude: center.lat, longitude: center.lng };
      } else if (myLocation) {
        origin = myLocation;
      } else {
        const device = await getCurrentDeviceLocation();
        origin = device ?? { latitude: KSA_CENTER.lat, longitude: KSA_CENTER.lng };
        setMyLocation(origin);
      }

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
    }, 600);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------- Actions
  const focusCity = useCallback(
    (targetCity: string) => {
      if (targetCity === 'all') {
        if (engine === 'leaflet' && leafletInstanceRef.current) {
          leafletInstanceRef.current.setView([KSA_CENTER.lat, KSA_CENTER.lng], 6);
        } else if (googleMapRef.current) {
          googleMapRef.current.setCenter(KSA_CENTER);
          googleMapRef.current.setZoom(6);
        }
        return;
      }

      const target = pins.filter((pin) => pin.city === targetCity);
      if (!target.length) return;

      if (engine === 'leaflet' && leafletInstanceRef.current) {
        const L = (window as any).L;
        const bounds = L.latLngBounds(target.map((p) => [p.lat, p.lng]));
        leafletInstanceRef.current.fitBounds(bounds, { padding: [50, 50] });
      } else if (googleMapRef.current && googleApiRef.current) {
        const bounds = new googleApiRef.current.LatLngBounds();
        target.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
        googleMapRef.current.fitBounds(bounds, 70);
      }
    },
    [pins, engine],
  );

  const locateMe = useCallback(async () => {
    setLocating(true);
    const location = await getCurrentDeviceLocation();
    setLocating(false);
    if (!location) return;
    setMyLocation(location);

    if (engine === 'leaflet' && leafletInstanceRef.current) {
      const L = (window as any).L;
      if (leafletMyMarkerRef.current) {
        leafletMyMarkerRef.current.remove();
      }
      const myIcon = L.divIcon({
        className: 'hayna-my-pin',
        html: pinElement('#2563EB', '📍', true).outerHTML,
        iconSize: [40, 52],
        iconAnchor: [20, 50],
      });
      leafletMyMarkerRef.current = L.marker([location.latitude, location.longitude], { icon: myIcon }).addTo(
        leafletInstanceRef.current,
      );
      const active = await getActiveLocation();
      const center = findPlaceCenter(active.city);
      leafletInstanceRef.current.flyTo(center ? [center.lat, center.lng] : [location.latitude, location.longitude], center ? 11 : 6, { duration: 1.2 });
    } else if (googleMapRef.current && googleApiRef.current) {
      if (googleMyMarkerRef.current) {
        googleMyMarkerRef.current.setMap(null);
      }
      googleMyMarkerRef.current = new googleApiRef.current.Marker({
        map: googleMapRef.current,
        position: { lat: location.latitude, lng: location.longitude },
        title: 'موقعي',
        icon: {
          url: pinSvg('#2563EB', '📍'),
          scaledSize: new googleApiRef.current.Size(38, 50),
          anchor: new googleApiRef.current.Point(19, 48),
        },
      });
      const active = await getActiveLocation();
      const center = findPlaceCenter(active.city);
      googleMapRef.current.panTo(center ? { lat: center.lat, lng: center.lng } : KSA_CENTER);
      googleMapRef.current.setZoom(center ? 11 : 6);
    }

    void runPlaceSearch(placeCategory, query);
  }, [engine, placeCategory, query, runPlaceSearch]);

  const startNavigation = useCallback(async (place: NearbyPlace) => {
    let origin = '';
    try {
      const current = myLocation ?? await getCurrentDeviceLocation();
      if (current) {
        setMyLocation(current);
        origin = `&origin=${current.latitude},${current.longitude}`;
      }
    } catch {}
    const url = `https://www.google.com/maps/dir/?api=1${origin}&destination=${place.lat},${place.lng}&travelmode=driving&dir_action=navigate`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [myLocation]);

  const focusPlace = useCallback(
    (place: NearbyPlace) => {
      if (engine === 'leaflet' && leafletInstanceRef.current) {
        leafletInstanceRef.current.flyTo([place.lat, place.lng], 16, { duration: 1 });
      } else if (googleMapRef.current) {
        googleMapRef.current.panTo({ lat: place.lat, lng: place.lng });
        googleMapRef.current.setZoom(16);
      }
    },
    [engine],
  );

  // ---------------------------------------------------------------- Render Helpers
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
          <CategoryIcon categoryKey={place.categoryKey} size={19} />
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
            onPress={() => void startNavigation(place)}
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
      {/* 1. FIXED APP HEADER */}
      <AppHeader
        variant="sub"
        title="خريطة حيّنا 🗺️"
        subtitle={`${visiblePins.length} نشاط · ${places.length} محل قريب`}
        fallbackRoute="/home"
        rightAction={
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
            <Pressable
              onPress={() => {
                setMapNotice(null);
                setEngine((prev) => (prev === 'leaflet' ? 'google' : 'leaflet'));
              }}
              style={[styles.engineBtn, engine === 'google' && styles.engineBtnGoogle]}
            >
              {engine === 'leaflet' ? (
                <>
                  <Layers size={13} color="#059669" />
                  <Text style={styles.engineBtnText}>خريطة حيّنا</Text>
                </>
              ) : (
                <>
                  <Globe size={13} color="#2563eb" />
                  <Text style={[styles.engineBtnText, { color: '#2563eb' }]}>Google</Text>
                </>
              )}
            </Pressable>
          </View>
        }
      />

      {/* 2. MAP CANVAS (Full screen behind floating controls) */}
      <div
        ref={(node) => {
          mapElRef.current = node;
        }}
        style={{
          position: 'absolute',
          top: 52,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: 'calc(100% - 52px)',
          zIndex: 1,
        }}
      />

      {/* 3. FLOATING GOOGLE MAPS SEARCH & CATEGORIES */}
      <View pointerEvents="box-none" style={styles.floatingTopContainer}>
        {/* Google Maps Search Capsule */}
        <View style={styles.floatingSearchCapsule}>
          <Search size={18} color="#059669" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => void runPlaceSearch(placeCategory, query)}
            placeholder="ابحث في الخريطة عن بقالة، صيدلية، سباك..."
            placeholderTextColor="#94a3b8"
            style={styles.floatingSearchInput}
            returnKeyType="search"
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery('')} hitSlop={8} style={{ padding: 4 }}>
              <X size={15} color="#94a3b8" />
            </Pressable>
          ) : null}
        </View>

        {/* Floating Google Maps Category Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.floatingChipsScroll}
          style={styles.floatingChipsRow}
        >
          <Pressable
            onPress={() => {
              setPlaceCategory(ALL_PLACES_KEY);
              void runPlaceSearch(ALL_PLACES_KEY, query);
            }}
            style={[
              styles.floatingChip,
              placeCategory === ALL_PLACES_KEY && styles.floatingChipActive,
            ]}
          >
            <Text
              style={[
                styles.floatingChipText,
                placeCategory === ALL_PLACES_KEY && styles.floatingChipTextActive,
              ]}
            >
              <Globe size={14} color={placeCategory === ALL_PLACES_KEY ? '#fff' : '#059669'} /> الكل ({places.length})
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
                styles.floatingChip,
                placeCategory === category.key && styles.floatingChipActive,
              ]}
            >
              <Text
                style={[
                  styles.floatingChipText,
                  placeCategory === category.key && styles.floatingChipTextActive,
                ]}
              >
                <CategoryIcon categoryKey={category.key} size={14} color={placeCategory === category.key ? '#fff' : '#059669'} /> {category.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* 4. FLOATING GOOGLE MAPS ACTION BUTTONS (BOTTOM-RIGHT FABs) */}
      <View style={styles.floatingFabCol}>
        <Pressable
          onPress={() => void locateMe()}
          style={styles.floatingFabBtn}
          accessibilityRole="button"
          accessibilityLabel="تحديد موقعي"
        >
          <Navigation size={18} color={locating ? '#94a3b8' : '#059669'} />
        </Pressable>
        <Pressable
          onPress={() => setHeatOn((v) => !v)}
          style={[styles.floatingFabBtn, heatOn && { backgroundColor: '#ea580c' }]}
          accessibilityRole="button"
          accessibilityLabel="خريطة التفاعل"
        >
          <Flame size={18} color={heatOn ? '#fff' : '#ea580c'} />
        </Pressable>
      </View>

      {/* Engine Notice banner if Google fails */}
      {mapNotice ? (
        <View style={styles.mapNotice}>
          <Text style={styles.mapNoticeText}>{mapNotice}</Text>
          <Pressable onPress={() => setMapNotice(null)} hitSlop={8}>
            <X size={15} color="#b45309" />
          </Pressable>
        </View>
      ) : null}

      {!loading && !pins.length && !sheetOpen ? (
        <View style={styles.mapHint}>
          <Text style={styles.mapHintText}>
            لا يوجد نشاط مسجّل بعد — أنشئ سؤالاً أو طلب مساعدة وسيظهر هنا.
          </Text>
        </View>
      ) : null}

      {/* Floating Button to Re-open Nearby Places */}
      {!sheetOpen && (
        <Pressable
          style={styles.openSheetBtn}
          onPress={() => setSheetOpen(true)}
          accessibilityRole="button"
        >
          <Store size={17} color="#fff" />
          <Text style={styles.openSheetBtnText}>
            أقرب المحلات ({places.length})
          </Text>
        </Pressable>
      )}

      {sheetOpen ? placesSheet : null}

      <View style={styles.legend}>
        <Text style={styles.legendText}>📍 نطاق الحي فقط — الموقع الدقيق بالخاص</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#e2e8f0',
    position: 'relative',
    overflow: 'hidden',
  },
  floatingTopContainer: {
    position: 'absolute',
    top: 62,
    left: 12,
    right: 12,
    zIndex: 90,
    gap: 8,
    maxWidth: 600,
    alignSelf: 'center',
  },
  floatingSearchCapsule: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingHorizontal: 16,
    height: 48,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 6,
  },
  floatingSearchInput: {
    flex: 1,
    textAlign: 'right',
    fontSize: 13.5,
    fontWeight: '600',
    color: '#0f172a',
    height: 44,
    padding: 0,
  },
  floatingChipsRow: {
    marginHorizontal: -4,
  },
  floatingChipsScroll: {
    flexDirection: 'row-reverse',
    gap: 6,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  floatingChip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  floatingChipActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  floatingChipText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#334155',
  },
  floatingChipTextActive: {
    color: '#ffffff',
  },
  floatingFabCol: {
    position: 'absolute',
    bottom: 90,
    right: 16,
    zIndex: 85,
    gap: 10,
  },
  floatingFabBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  placeChipText: { fontSize: 11.5, fontWeight: '800', color: C.ink },
  placeChipTextActive: { color: '#fff' },
  cityChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: C.accentSoft,
  },
  cityChipActive: { backgroundColor: C.accent },
  cityChipText: { fontSize: 11, fontWeight: '800', color: C.accent },
  cityChipTextActive: { color: '#fff' },
  divider: { width: 1, height: 20, backgroundColor: C.line, alignSelf: 'center', marginHorizontal: 2 },
  sheet: {
    position: 'absolute',
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 12,
    zIndex: 998,
  },
  sheetMobile: {
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '44%',
  },
  sheetWide: {
    left: 20,
    bottom: 20,
    width: 380,
    maxHeight: '65%',
    borderRadius: 24,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  sheetHead: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  sheetTitle: { flex: 1, fontSize: 14, fontWeight: '800', color: C.ink, textAlign: 'right' },
  sheetScroll: { flex: 1 },
  sheetContent: { padding: 12, gap: 10 },
  placeRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  placeBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeBody: { flex: 1, gap: 2 },
  placeName: { fontSize: 13.5, fontWeight: '800', color: C.ink, textAlign: 'right' },
  placeMeta: { fontSize: 11, color: C.muted, fontWeight: '600', textAlign: 'right' },
  placeChips: { flexDirection: 'row-reverse', gap: 5, flexWrap: 'wrap', marginTop: 4 },
  miniChip: {
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  placeActions: { flexDirection: 'row', gap: 6 },
  placeActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { textAlign: 'center', fontSize: 12, color: C.muted, fontWeight: '700', paddingVertical: 20 },
  openSheetBtn: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.accent,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 997,
  },
  openSheetBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 13,
  },
  legend: {
    position: 'absolute',
    bottom: 6,
    left: 12,
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    zIndex: 996,
  },
  legendText: { fontSize: 10, color: C.muted, fontWeight: '700' },
  mapNotice: {
    position: 'absolute',
    top: 185,
    left: 14,
    right: 14,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    zIndex: 1000,
  },
  mapNoticeText: { flex: 1, fontSize: 11.5, color: '#92400e', fontWeight: '700', textAlign: 'right' },
  mapHint: {
    position: 'absolute',
    bottom: 80,
    alignSelf: 'center',
    backgroundColor: 'rgba(15,23,42,0.8)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 995,
  },
  mapHintText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  chip: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 18, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: '#fff' },
  chipText: { color: '#475569', fontSize: 11, fontWeight: '700' },
  chipTextActive: { color: '#fff' },
  engineBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0' },
  engineBtnGoogle: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  engineBtnText: { color: '#047857', fontSize: 11, fontWeight: '800' },
});
