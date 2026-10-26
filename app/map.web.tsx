import { OASIS } from '@/lib/oasis';
import { useAppHeaderHeight } from '@/components/shared/AppHeader';
import { HeaderAction } from '@/components/shared/AppHeader';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import {
  Flame,
  LocateFixed,
  Coffee,
  Pill,
  ShoppingCart,
  Shirt,
  Scissors,
  Wrench,
  Utensils,
  WashingMachine,
  Croissant,
  ChevronDown,
  ChevronUp,
  Layers,
  MapPin as MapPinIcon,
  Navigation,
  Phone,
  Search,
  Star,
  Store,
  X,
  Plus, Minus, Compass, ShieldCheck, ArrowUpRight, RefreshCw, ListFilter, Map as MapIcon, Check, ChevronRight,
} from 'lucide-react-native';

import { mapSymbolSvg } from '@/lib/mapSymbols';
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
import { mapExplorerCss } from '@/components/map/mapExplorerStyles';
import { distanceMeters } from '@/lib/privacy';

const KSA_CENTER = { lat: 24.7136, lng: 46.6753 };
const KSA_BOUNDS = { north: 32.6, south: 15.9, east: 56.1, west: 34.4 };
const MAP_ID = process.env.EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID || '';

const MAP_STYLES: any[] = [
  { elementType: 'geometry', stylers: [{ color: OASIS.colors.background }] },
  { elementType: 'labels.text.fill', stylers: [{ color: OASIS.colors.muted }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: OASIS.colors.background }] },
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#dcfce7' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: OASIS.colors.surface }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#EFE9D9' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#DDEBDD' }] },
];

const categoryIcons: Record<string, typeof Store> = { grocery: ShoppingCart, pharmacy: Pill, clothing: Shirt, salon: Scissors, hardware: Wrench, cafe: Coffee, restaurant: Utensils, laundry: WashingMachine, bakery: Croissant, market: Store };

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
    link.href = '/leaflet/leaflet.css';
    document.head.appendChild(link);
  }
  if (!document.getElementById('hayna-leaflet-custom-style')) {
    const style = document.createElement('style');
    style.id = 'hayna-leaflet-custom-style';
    style.textContent = `
      .leaflet-popup-content-wrapper {
        border-radius: 20px !important; background: #FFFEFA !important; color: #173F30 !important;
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
  tag.innerHTML = mapSymbolSvg(pin.kind, kind.color);
  tag.appendChild(document.createTextNode(' ' + kind.short));
  tag.style.display = 'inline-flex';
  tag.style.alignItems = 'center';
  tag.style.cssText = `display:inline-block;background:${kind.color}1a;color:${kind.color};font-weight:800;font-size:11px;padding:3px 9px;border-radius:999px;margin-bottom:6px;`;
  wrap.appendChild(tag);

  const title = document.createElement('div');
  title.textContent = pin.title;
  title.style.cssText =
    'font-size:15px;font-weight:800;color:#0f172a;line-height:1.35;margin-bottom:5px;';
  wrap.appendChild(title);

  const area = document.createElement('div');
  area.textContent = pin.area;
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

  if (pin.kind === 'business' && (pin.phone || pin.exact)) {
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
    hours.textContent = place.hoursText;
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
  const appHeaderHeight = useAppHeaderHeight();

  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapGenerationRef = useRef(0);
  const leafletInstanceRef = useRef<any>(null);
  const leafletPinLayerRef = useRef<any>(null);
  const leafletPlaceLayerRef = useRef<any>(null);
  const leafletMyMarkerRef = useRef<any>(null);
  const densityLayerRef = useRef<any>(null);
  const placeMarkersRef = useRef(new Map<string, any>());
  const [mapMoved, setMapMoved] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(6);
  const [tab, setTab] = useState<'places' | 'community'>('community');
  const [openOnly, setOpenOnly] = useState(false);
  const [sort, setSort] = useState('distance');
  const [selectedPlace, setSelectedPlace] = useState<string | null>(null);
  const [searchOrigin, setSearchOrigin] = useState<{ lat: number; lng: number; label: string } | null>(null);
  const [searched, setSearched] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [retry, setRetry] = useState(0);

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
  const searchSequence = useRef(0);
  const [sheetOpen, setSheetOpen] = useState(true);

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
  const initLeafletMap = useCallback(async (generation: number) => {
    if (!mapElRef.current) return;
    injectLeafletAssets();
    const L = await getLeafletModule();
    if (!L || !mapElRef.current || mapGenerationRef.current !== generation) return;

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

    L.control.scale({ position: 'bottomleft', imperial: false }).addTo(map);
    map.on('moveend', () => { setMapMoved(true); setZoomLevel(map.getZoom()); });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    leafletPinLayerRef.current = L.layerGroup().addTo(map);
    leafletPlaceLayerRef.current = L.layerGroup().addTo(map);
    densityLayerRef.current = L.layerGroup().addTo(map);
    leafletInstanceRef.current = map;
    setMapReady(true);
  }, []);

  // ---------------------------------------------------------------- Google Maps Engine Setup
  const initGoogleMap = useCallback(async (generation: number) => {
    if (!mapElRef.current) return;

    // Handle Google auth failures gracefully
    if (typeof window !== 'undefined') {
      (window as any).gm_authFailure = () => {
        if (mapGenerationRef.current !== generation) return;
        setMapNotice('تعذر تحميل الخريطة البديلة. تم استعادة الخريطة الأساسية.');
        setEngine('leaflet');
      };
    }

    try {
      mapElRef.current.innerHTML = '';
      const api = await loadGoogleMaps();
      if (!mapElRef.current || mapGenerationRef.current !== generation) return;
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
        zoomControl: false,
        ...(MAP_ID ? { mapId: MAP_ID } : {}),
      });
      googleMapRef.current = map;
      map.addListener('idle', () => { setMapMoved(true); setZoomLevel(map.getZoom()); });
      googleInfoRef.current = new api.InfoWindow({ disableAutoPan: false });
      setMapReady(true);
    } catch (err: any) {
      if (mapGenerationRef.current !== generation) return;
      setMapNotice('تعذّر الاتصال بخوادم خرائط Google. تم الرجوع لخريطة حيّنا المباشرة.');
      setEngine('leaflet');
    }
  }, []);

  // ---------------------------------------------------------------- Bootstrap Map Engine
  useEffect(() => {
    setMapReady(false);
    setMapError(false);
    let cancelled = false;
    const generation = ++mapGenerationRef.current;
    if (engine === 'leaflet') {
      void initLeafletMap(generation).catch(() => { if (!cancelled) { setMapError(true); setMapNotice('تعذر تحميل الخريطة. تحقق من الاتصال وأعد المحاولة.'); } });
    } else {
      void initGoogleMap(generation);
    }

    return () => {
      cancelled = true;
      ++mapGenerationRef.current;
      googleInfoRef.current?.close();
      if (googleMapRef.current && googleApiRef.current) googleApiRef.current.event.clearInstanceListeners(googleMapRef.current);
      googleMapRef.current = null;
      googlePinMarkersRef.current = [];
      googlePlaceMarkersRef.current = [];
      if (leafletInstanceRef.current) {
        try { leafletInstanceRef.current.remove(); } catch {}
        leafletInstanceRef.current = null;
      }
    };
  }, [engine, retry, initLeafletMap, initGoogleMap]);

  useEffect(() => {
    if (!mapReady || !mapElRef.current) return;
    const observer = new ResizeObserver(() => {
      leafletInstanceRef.current?.invalidateSize();
      if (googleMapRef.current && googleApiRef.current) googleApiRef.current.event.trigger(googleMapRef.current, 'resize');
    });
    observer.observe(mapElRef.current);
    return () => observer.disconnect();
  }, [mapReady]);

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
    () => city ? filterPins(pins, { kind, city, query: tab === 'community' ? query : '' }) : [],
    [pins, kind, city, query, tab],
  );
  const scopedPins = useMemo(() => city ? filterPins(pins, { city }) : [], [pins, city]);
  const kindCounts = useMemo(() => countByKind(scopedPins), [scopedPins]);
  useEffect(() => {
    const center = city ? findPlaceCenter(city) : KSA_CENTER;
    if (!center) return;
    if (leafletInstanceRef.current) leafletInstanceRef.current.setView([center.lat, center.lng], city ? 12 : 6);
    if (googleMapRef.current) {
      googleMapRef.current.setCenter({ lat: center.lat, lng: center.lng });
      googleMapRef.current.setZoom(city ? 12 : 6);
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
      const groups = new Map<string, MapPin[]>();
      (tab === 'community' ? visiblePins : []).forEach(pin => {
        const point = leafletInstanceRef.current.project([pin.lat, pin.lng], zoomLevel);
        const key = `${Math.floor(point.x / 54)}:${Math.floor(point.y / 54)}`;
        groups.set(key, [...(groups.get(key) || []), pin]);
      });
      groups.forEach((group) => {
        if (group.length > 1) {
          const lat = group.reduce((sum, p) => sum + p.lat, 0) / group.length;
          const lng = group.reduce((sum, p) => sum + p.lng, 0) / group.length;
          const cluster = L.marker([lat, lng], { title: `${group.length} منشورًا، اضغط للتكبير`, icon: L.divIcon({ className: 'hayna-cluster', html: `<span>${group.length}</span>`, iconSize: [46, 46], iconAnchor: [23, 23] }) });
          const list = document.createElement('div');
          list.dir = 'rtl';
          list.style.cssText = 'max-height:240px;overflow:auto;min-width:210px;font-family:inherit';
          group.forEach(pin => {
            const button = document.createElement('button');
            button.textContent = pin.title;
            button.style.cssText = 'display:block;width:100%;border:0;border-bottom:1px solid #e5eae2;background:transparent;color:#17664f;padding:10px;text-align:right;font:inherit;cursor:pointer';
            button.onclick = () => router.push(pin.href as never);
            list.appendChild(button);
          });
          cluster.bindPopup(list, { maxWidth: 280 });
          cluster.on('click', () => { if (zoomLevel < 19) { cluster.closePopup(); leafletInstanceRef.current.fitBounds(L.latLngBounds(group.map(p => [p.lat, p.lng])), { padding: [65, 65], maxZoom: Math.min(19, zoomLevel + 3) }); } });
          cluster.addTo(pinLayer);
          return;
        }
        const pin = group[0];
        const kindMeta = MAP_PIN_KINDS[pin.kind];
        const icon = L.divIcon({
          className: 'hayna-custom-pin',
          html: pinElement(kindMeta.color, pin.kind, pin.urgent).outerHTML,
          iconSize: [40, 52],
          iconAnchor: [20, 50],
          popupAnchor: [0, -45],
        });
        const marker = L.marker([pin.lat, pin.lng], { icon, title: pin.title });
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

      (tab === 'community' ? visiblePins : []).forEach((pin) => {
        const kindMeta = MAP_PIN_KINDS[pin.kind];
        const marker = new api.Marker({
          map,
          position: { lat: pin.lat, lng: pin.lng },
          title: pin.title,
          icon: {
            url: pinSvg(kindMeta.color, pin.kind),
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
            googleInfoRef.current.setPosition(anchor);
            googleInfoRef.current.open({ map, anchor: marker });
          }
        });
        googlePinMarkersRef.current.push({ id: pin.id, advanced: false, marker });
      });
    }
  }, [visiblePins, mapReady, engine, zoomLevel, tab]);

  useEffect(() => {
    const layer = densityLayerRef.current;
    layer?.clearLayers();
    if (!heatOn || !mapReady || engine !== 'leaflet' || tab !== 'community') return;
    const L = (window as any).L;
    visiblePins.forEach(pin => L.circle([pin.lat, pin.lng], { radius: 350, color: '#C58C43', weight: 0, fillColor: '#E6A34F', fillOpacity: .12, interactive: false }).addTo(layer));
  }, [heatOn, visiblePins, mapReady, engine, tab]);

  // ---------------------------------------------------------------- Update Places on Active Engine
  const displayedPlaces = useMemo(() => places.filter(p => !openOnly || p.openNow === true)
    .sort((a, b) => sort === 'rating' ? (b.rating ?? -1) - (a.rating ?? -1) || a.distance - b.distance : a.distance - b.distance), [places, openOnly, sort]);

  useEffect(() => {
    if (!mapReady) return;

    if (engine === 'leaflet') {
      const L = (window as any).L;
      const placeLayer = leafletPlaceLayerRef.current;
      if (!L || !placeLayer) return;

      placeLayer.clearLayers();
      placeMarkersRef.current.clear();
      (tab === 'places' ? displayedPlaces : []).forEach((place) => {
        const icon = L.divIcon({
          className: 'hayna-custom-place',
          html: pinElement('#0F766E', 'business', false).outerHTML,
          iconSize: [40, 52],
          iconAnchor: [20, 50],
          popupAnchor: [0, -45],
        });
        const marker = L.marker([place.lat, place.lng], { icon, title: place.name });
        marker.on('click', () => setSelectedPlace(place.id));
        placeMarkersRef.current.set(place.id, marker);
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

      (tab === 'places' ? displayedPlaces : []).forEach((place) => {
        const marker = new api.Marker({
          map,
          position: { lat: place.lat, lng: place.lng },
          title: place.name,
          icon: {
            url: pinSvg('#0F766E', 'business'),
            scaledSize: new api.Size(38, 50),
            anchor: new api.Point(19, 48),
          },
        });
        marker.addListener('click', () => {
          setSelectedPlace(place.id);
          if (googleInfoRef.current) {
            const { content, anchor } = buildPlaceInfoWindow(place, () =>
              googleInfoRef.current?.close(),
            );
            googleInfoRef.current.setContent(content);
            googleInfoRef.current.setPosition(anchor);
            googleInfoRef.current.open({ map, anchor: marker });
          }
        });
        googlePlaceMarkersRef.current.push({ id: place.id, advanced: false, marker });
      });
    }
  }, [displayedPlaces, mapReady, engine, tab]);

  // ---------------------------------------------------------------- Nearby Places Search
  const runPlaceSearch = useCallback(
    async (nextCategory: string, nextQuery: string, useViewport = false) => {
      const sequence = ++searchSequence.current;
      const center = findPlaceCenter(city);
      const viewCenter = engine === 'leaflet' ? leafletInstanceRef.current?.getCenter() : googleMapRef.current?.getCenter();
      const viewport = viewCenter ? { lat: typeof viewCenter.lat === 'function' ? viewCenter.lat() : viewCenter.lat, lng: typeof viewCenter.lng === 'function' ? viewCenter.lng() : viewCenter.lng } : null;
      const origin = useViewport && viewport ? { ...viewport, label: 'مركز الخريطة' }
        : myLocation ? { lat: myLocation.latitude, lng: myLocation.longitude, label: 'موقعك' }
        : center ? { lat: center.lat, lng: center.lng, label: `مركز ${city}` } : null;
      if (!origin) { setMapNotice('كبّر الخريطة إلى المنطقة المطلوبة، ثم اضغط «ابحث في هذه المنطقة».'); return; }
      setTab('places');
      setSheetOpen(true);
      setMapNotice(null);
      setSelectedPlace(null);
      setSearched(true);
      setPlacesLoading(true);
      setPlaces([]);
      setSearchOrigin(origin);
      try {
      const results = await searchNearbyPlaces({
        lat: origin.lat,
        lng: origin.lng,
        category: nextCategory === ALL_PLACES_KEY ? null : nextCategory,
        text: nextQuery,
        radiusMeters: 5000,
      });
      if (sequence === searchSequence.current) {
        // Apply the same geographic radius to every data-source fallback.
        setPlaces(results.filter(p => Number.isFinite(p.lat) && Number.isFinite(p.lng) && distanceMeters(origin, p) <= 5000));
        setMapMoved(false);
      }
      } catch { if (sequence === searchSequence.current) setMapNotice('تعذر تحميل الأماكن. حاول مجددًا.'); }
      finally { if (sequence === searchSequence.current) setPlacesLoading(false); }
    },
    [myLocation, city, engine],
  );

  useEffect(() => {
    ++searchSequence.current;
    setPlaces([]);
    setSearched(false);
    setPlacesLoading(false);
    setSelectedPlace(null);
    setSearchOrigin(null);
  }, [city, myLocation]);

  useEffect(() => () => { ++searchSequence.current; }, []);


  // ---------------------------------------------------------------- Actions
  const locateMe = useCallback(async () => {
    setLocating(true);
    const location = await getCurrentDeviceLocation();
    setLocating(false);
    if (!location) { setMapNotice('اسمح بالوصول إلى موقعك ثم أعد المحاولة.'); return; }
    setMyLocation(location);
    setMapNotice(null);
    setTab('places');
    setSheetOpen(true);
  }, []);

  // Recreate the private device marker when the map engine changes.
  useEffect(() => {
    if (!myLocation || !mapReady) return;
    const location = myLocation;
    let accuracyCircle: any = null;

    if (engine === 'leaflet' && leafletInstanceRef.current) {
      const L = (window as any).L;
      if (leafletMyMarkerRef.current) {
        leafletMyMarkerRef.current.remove();
      }
      const myIcon = L.divIcon({
        className: 'hayna-my-pin',
        html: pinElement('#2563EB', 'location', true).outerHTML,
        iconSize: [40, 52],
        iconAnchor: [20, 50],
      });
      leafletMyMarkerRef.current = L.marker([location.latitude, location.longitude], { icon: myIcon }).addTo(
        leafletInstanceRef.current,
      );
      if (location.accuracy != null && location.accuracy > 0) {
        accuracyCircle = L.circle([location.latitude, location.longitude], { radius: location.accuracy, color: '#2563EB', weight: 1, fillOpacity: .07, interactive: false }).addTo(leafletInstanceRef.current);
      }
      leafletInstanceRef.current.flyTo([location.latitude, location.longitude], 16, { duration: 1.2 });
    } else if (googleMapRef.current && googleApiRef.current) {
      if (googleMyMarkerRef.current) {
        googleMyMarkerRef.current.setMap(null);
      }
      googleMyMarkerRef.current = new googleApiRef.current.Marker({
        map: googleMapRef.current,
        position: { lat: location.latitude, lng: location.longitude },
        title: 'موقعي',
        icon: {
          url: pinSvg('#2563EB', 'location'),
          scaledSize: new googleApiRef.current.Size(38, 50),
          anchor: new googleApiRef.current.Point(19, 48),
        },
      });
      googleMapRef.current.panTo({lat:location.latitude,lng:location.longitude});
      googleMapRef.current.setZoom(16);
    }
    return () => { accuracyCircle?.remove(); };
  }, [myLocation, mapReady, engine]);

  useEffect(() => {
    if (myLocation) void runPlaceSearch(placeCategory, query);
    // A fresh GPS fix is the explicit trigger; category and query have their own controls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myLocation]);

  const focusPlace = useCallback(
    (place: NearbyPlace) => {
      setSelectedPlace(place.id);
      if (engine === 'leaflet' && leafletInstanceRef.current) {
        leafletInstanceRef.current.flyTo([place.lat, place.lng], 16, { duration: 1 });
        placeMarkersRef.current.get(place.id)?.openPopup();
      } else if (googleMapRef.current) {
        googleMapRef.current.panTo({ lat: place.lat, lng: place.lng });
        googleMapRef.current.setZoom(16);
        const marker = googlePlaceMarkersRef.current.find(m => m.id === place.id)?.marker;
        if (marker) googleApiRef.current.event.trigger(marker, 'click');
      }
    },
    [engine],
  );

  const zoom = (delta: number) => {
    if (engine === 'leaflet') leafletInstanceRef.current?.setZoom(leafletInstanceRef.current.getZoom() + delta);
    else if (googleMapRef.current) googleMapRef.current.setZoom(googleMapRef.current.getZoom() + delta);
  };
  const resetView = () => {
    const center = findPlaceCenter(city) || KSA_CENTER;
    if (engine === 'leaflet') leafletInstanceRef.current?.flyTo([center.lat, center.lng], city ? 12 : 6);
    else if (googleMapRef.current) { googleMapRef.current.panTo(center); googleMapRef.current.setZoom(city ? 12 : 6); }
  };
  const chooseCategory = (category: string) => {
    setPlaceCategory(category);
    setQuery('');
    void runPlaceSearch(category, '');
  };
  const number = (value: number) => value.toLocaleString('ar-SA');
  const resultsCount = tab === 'places' ? displayedPlaces.length : visiblePins.length;
  const busy = tab === 'places' ? placesLoading : loading;

  return (
    <View style={{ flex: 1, position: 'relative', backgroundColor: '#F5F6F2' }}>
      <AppHeader variant="sub" title="خريطة الحي" subtitle={city || 'استكشف المملكة'} fallbackRoute="/home"
        rightAction={<HeaderAction onPress={resetView} accessibilityLabel="العودة إلى نطاق المدينة"><Compass size={19} color="#17664F" /></HeaderAction>} />
      <style>{mapExplorerCss}</style>
      <main className="mx" dir="rtl" style={{ top: appHeaderHeight }}>
        <div className="mx-heading">
          <div><div className="mx-eyebrow"><span /> دليلك إلى ما حولك</div><h1>حيّك، من زاوية أقرب<span>.</span></h1><p>اكتشف الأماكن والخدمات، وتابع ما يحدث في محيطك.</p></div>
          <button className="mx-location" onClick={resetView} aria-label="العودة إلى مركز المدينة المحددة"><MapPinIcon size={17} color="#17664F" /><span>{city || 'كل المملكة'}</span><span className="mx-location-sub">نطاق الاستكشاف</span><Compass size={14} color="#7A8D82" /></button>
        </div>
        <div className="mx-workspace">
          <aside className={`mx-panel ${sheetOpen ? '' : 'mx-panel-collapsed'}`} aria-label="لوحة استكشاف الحي">
            <div className="mx-panel-head">
              <div className="mx-panel-title"><span className="mx-square"><Compass size={22} color="#17664F" /></span><div><h2>اكتشف حولك</h2><p>{city ? `أماكن وحكايات من ${city}` : 'كل ما يقرّبك من حيّك'}</p></div><button className="mx-icon mx-mobile-only" aria-label={sheetOpen ? 'طي لوحة النتائج' : 'عرض لوحة النتائج'} onClick={() => setSheetOpen(v => !v)}>{sheetOpen ? <ChevronDown size={18} color="#17664F" /> : <ChevronUp size={18} color="#17664F" />}</button></div>
              <form className="mx-search" onSubmit={e => { e.preventDefault(); if (tab === 'places') void runPlaceSearch(placeCategory, query); }}>
                <Search size={19} color="#17664F" />
                <input aria-label={tab === 'places' ? 'البحث عن مكان أو خدمة' : 'البحث في نشاط الحي'} placeholder={tab === 'places' ? 'مكان، مقهى، أو خدمة…' : 'ابحث في منشورات حيّك…'} value={query} onChange={e => setQuery(e.target.value)} />
                {query && <button type="button" aria-label="مسح البحث" onClick={() => setQuery('')}><X size={15} color="#71837B" /></button>}
                <button type="submit" aria-label="بحث" className="mx-search-submit"><ArrowUpRight size={17} color="#fff" /></button>
              </form>
              <div className="mx-tabs" role="tablist" aria-label="نوع الاستكشاف">
                <button role="tab" aria-selected={tab === 'community'} onClick={() => { setTab('community'); setQuery(''); }}><MapIcon size={16} color={tab === 'community' ? '#17664F' : '#85938B'} />نبض الحي<span>{number(scopedPins.length)}</span></button>
                <button role="tab" aria-selected={tab === 'places'} onClick={() => { setTab('places'); setQuery(''); if (!searched) void runPlaceSearch(placeCategory, ''); }}><Store size={16} color={tab === 'places' ? '#17664F' : '#85938B'} />الأماكن القريبة</button>
              </div>
            </div>
            <div className="mx-panel-details">
              <div className="mx-section-label"><span>{tab === 'places' ? 'ماذا تبحث عنه؟' : 'استكشف حسب الاهتمام'}</span><ListFilter size={15} color="#819087" /></div>
              <div className="mx-categories">
                {tab === 'places' ? <>
                  <button className={placeCategory === ALL_PLACES_KEY ? 'active' : ''} onClick={() => chooseCategory(ALL_PLACES_KEY)}><Layers size={15} color={placeCategory === ALL_PLACES_KEY ? '#fff' : '#72877A'} />الكل</button>
                  {PLACE_CATEGORIES.map(c => { const Icon = categoryIcons[c.key] || Store; return <button key={c.key} className={placeCategory === c.key ? 'active' : ''} onClick={() => chooseCategory(c.key)}><Icon size={15} color={placeCategory === c.key ? '#fff' : '#72877A'} />{c.label}</button>; })}
                </> : <>
                  <button className={kind === 'all' ? 'active' : ''} onClick={() => setKind('all')}><Layers size={15} color={kind === 'all' ? '#fff' : '#72877A'} />الكل<span>{number(scopedPins.length)}</span></button>
                  {MAP_PIN_ORDER.map(k => <button key={k} className={kind === k ? 'active' : ''} onClick={() => setKind(k)}><i style={{ background: kind === k ? '#D7EBCB' : MAP_PIN_KINDS[k].color }} />{MAP_PIN_KINDS[k].short}<span>{number(kindCounts[k] || 0)}</span></button>)}
                </>}
              </div>
              {tab === 'places' && <div className="mx-filters"><button className={openOnly ? 'active' : ''} aria-pressed={openOnly} onClick={() => setOpenOnly(v => !v)}><span className="mx-status-dot" />مفتوح الآن{openOnly && <Check size={13} color="#17664F" />}</button><label>الترتيب<select aria-label="ترتيب الأماكن" value={sort} onChange={e => setSort(e.target.value)}><option value="distance">الأقرب أولًا</option><option value="rating">الأعلى تقييمًا</option></select></label></div>}
              <div className="mx-results-heading"><h3>{tab === 'places' ? 'أماكن تستحق الاكتشاف' : 'من حولك في الحي'}</h3><span aria-live="polite">{busy ? 'جارٍ التحميل…' : `${number(resultsCount)} نتيجة`}</span></div>
              {tab === 'places' && searchOrigin && <p className="mx-distance-note">المسافات بخط مستقيم من {searchOrigin.label} · ضمن ٥ كم</p>}
            </div>
            <div className="mx-results" role="tabpanel" aria-label={tab === 'places' ? 'نتائج الأماكن القريبة' : 'نتائج نشاط الحي'} aria-busy={busy}>
              {busy ? <div className="mx-skeletons" role="status" aria-label="جارٍ تحميل النتائج">{[0, 1, 2].map(i => <div className="mx-skeleton" key={i}><span /><div><i /><i /><i /></div></div>)}</div> : tab === 'places' ? displayedPlaces.map(place => {
                const Icon = categoryIcons[place.categoryKey] || Store;
                return <article key={place.id} className={`mx-card ${selectedPlace === place.id ? 'selected' : ''}`}>
                  <button className="mx-card-main" onClick={() => focusPlace(place)} aria-label={`عرض ${place.name} على الخريطة`}>
                    <span className="mx-place-icon"><Icon size={23} color="#237056" /></span><div className="mx-card-copy"><h4>{place.name}</h4><p>{place.categoryLabel} <span>·</span> {formatDistance(place.distance)}</p><div className="mx-card-tags">{place.openNow !== null && <span className={place.openNow ? 'mx-open' : 'mx-closed'}>{place.openNow ? 'مفتوح الآن' : 'مغلق الآن'}</span>}{place.rating != null && <span className="mx-rating"><Star size={12} color="#B68C45" fill="#B68C45" />{place.rating.toFixed(1)} <small>({number(place.reviews)})</small></span>}</div></div><ChevronRight size={15} color="#9BA99F" />
                  </button>
                  {place.address && <p className="mx-address">{place.address}</p>}
                  <div className="mx-card-actions"><a href={navigationUrl(place.lat, place.lng)} target="_blank" rel="noopener noreferrer"><Navigation size={14} color="#17664F" />الاتجاهات</a>{place.phone && <a href={`tel:${place.phone}`} aria-label={`اتصال بـ ${place.name}`}><Phone size={14} color="#17664F" />اتصال</a>}<button onClick={() => focusPlace(place)}>على الخريطة<ArrowUpRight size={13} color="#8A9C91" /></button></div>
                </article>;
              }) : visiblePins.map(pin => <article key={pin.id} className="mx-card mx-community-card"><button className="mx-card-main" onClick={() => { const point = [pin.lat, pin.lng]; if (engine === 'leaflet') leafletInstanceRef.current?.flyTo(point, 16); else { googleMapRef.current?.panTo({ lat: pin.lat, lng: pin.lng }); googleMapRef.current?.setZoom(16); } }} aria-label={`عرض ${pin.title} على الخريطة`}><span className="mx-place-icon" style={{ background: `${MAP_PIN_KINDS[pin.kind].color}12` }}><MapPinIcon size={22} color={MAP_PIN_KINDS[pin.kind].color} /></span><div className="mx-card-copy"><div className="mx-pin-category" style={{ color: MAP_PIN_KINDS[pin.kind].color }}>{MAP_PIN_KINDS[pin.kind].label}{pin.urgent && <span className="mx-closed">عاجل</span>}</div><h4>{pin.title}</h4><p>{pin.area}</p></div></button>{pin.body && <p className="mx-post-body">{pin.body}</p>}<div className="mx-card-actions"><span className="mx-time">{relativeTime(pin.createdAt)}{pin.approximate ? ' · موقع تقريبي' : ''}</span><button onClick={() => router.push(pin.href as never)}>عرض التفاصيل<ArrowUpRight size={14} color="#17664F" /></button></div></article>)}
              {!busy && !resultsCount && <div className="mx-empty"><span><MapPinIcon size={30} color="#6D9278" /></span><h3>{tab === 'community' && !city ? 'ابدأ من مدينتك' : tab === 'places' && !searched ? 'وجهتك التالية، قريبة منك' : 'لنوسّع دائرة الاكتشاف'}</h3><p>{tab === 'community' && !city ? 'حدد مدينتك من الصفحة الرئيسية لعرض نشاط الجيران، أو استكشف الأماكن بتحريك الخريطة.' : tab === 'places' && !searched ? 'ابحث عن مكان أو اختر فئة. يمكنك أيضًا تحريك الخريطة والبحث في المنطقة المعروضة.' : 'لا توجد نتائج مطابقة حاليًا. جرّب فئة أخرى أو منطقة قريبة.'}</p><button className="mx-primary" onClick={() => { if (tab === 'community') { if (!city) router.push('/home'); else { setKind('all'); setQuery(''); void refreshPins(); } } else { setOpenOnly(false); void runPlaceSearch(placeCategory, query, true); } }}>{tab === 'community' && !city ? 'تحديد مدينتي' : tab === 'community' ? 'تحديث النشاط' : 'البحث في هذه المنطقة'}<ArrowUpRight size={15} color="#fff" /></button></div>}
            </div>
            <div className="mx-panel-footer"><ShieldCheck size={17} color="#678773" /><p>قريبون منك، وخصوصيتك محفوظة<span>مواقع منشورات الجيران تقريبية دائمًا.</span></p></div>
          </aside>
          <section className="mx-map" aria-label="الخريطة التفاعلية">
            <div ref={node => { mapElRef.current = node; }} className="mx-canvas" />
            <div className="mx-map-top"><div className="mx-map-badge"><span className="mx-status-dot" /><strong>{city || 'المملكة العربية السعودية'}</strong><span>منظور الحي</span></div><button className="mx-map-layer" onClick={() => { setMapNotice(null); setHeatOn(false); setEngine(v => v === 'leaflet' ? 'google' : 'leaflet'); }} aria-label="تبديل مصدر الخريطة"><Layers size={17} color="#17664F" /><span>{engine === 'leaflet' ? 'الخريطة الأساسية' : 'خرائط Google'}</span></button></div>
            {mapMoved && mapReady && <button className="mx-search-area" disabled={placesLoading} onClick={() => { if (tab === 'community') setQuery(''); void runPlaceSearch(placeCategory, tab === 'places' ? query : '', true); }}><RefreshCw size={15} color="#17664F" />{placesLoading ? 'جارٍ البحث…' : 'ابحث في هذه المنطقة'}</button>}
            {(!mapReady || mapError) && <div className="mx-map-loading" role="status"><Compass size={32} color="#17664F" /><strong>{mapError ? 'الخريطة غير متاحة حاليًا' : 'نجهّز لك صورة أوضح للحي…'}</strong>{mapError && <button className="mx-primary" onClick={() => setRetry(v => v + 1)}>إعادة المحاولة</button>}</div>}
            <div className="mx-map-tools"><button aria-label="العودة إلى نطاق المدينة" onClick={resetView}><Compass size={20} color="#17664F" /></button><span /><button aria-label="تكبير الخريطة" onClick={() => zoom(1)} disabled={!mapReady}><Plus size={20} color="#334E40" /></button><button aria-label="تصغير الخريطة" onClick={() => zoom(-1)} disabled={!mapReady}><Minus size={20} color="#334E40" /></button><span /><button aria-label="تحديد موقعي" disabled={locating} onClick={() => void locateMe()}><LocateFixed size={20} color="#17664F" /></button>{engine === 'leaflet' && tab === 'community' && <button aria-label="إظهار كثافة نشاط الحي" aria-pressed={heatOn} className={heatOn ? 'active' : ''} onClick={() => setHeatOn(v => !v)}><Flame size={19} color={heatOn ? '#B27128' : '#71867A'} /></button>}</div>
            <div className="mx-map-bottom"><div className="mx-map-key"><strong>دليل الخريطة</strong><span><i style={{ background: '#17664F' }} />نشاط الحي</span><span><i style={{ background: '#0F766E' }} />أماكن وخدمات</span>{heatOn && <span><i style={{ background: '#E6A34F' }} />كثافة النشاط</span>}</div><button className="mx-my-location" disabled={locating} onClick={() => void locateMe()}><LocateFixed size={17} color="#fff" />{locating ? 'جارٍ تحديد موقعك…' : 'اكتشف بالقرب مني'}</button></div>
            {myLocation && <div className="mx-accuracy">دقة الجهاز: {myLocation.accuracy != null ? `± ${Math.round(myLocation.accuracy)} م` : 'غير متاحة'}</div>}
          </section>
        </div>
        {mapNotice && <div className="mx-notice" role="status"><MapPinIcon size={17} color="#8B6A32" /><p>{mapNotice}</p><button aria-label="إغلاق التنبيه" onClick={() => setMapNotice(null)}><X size={17} color="#8B6A32" /></button></div>}
      </main>
    </View>
  );
}
