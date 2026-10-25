import { OASIS } from '@/lib/oasis';
import MapJourney, { type JourneyTarget } from './MapJourney.web';
import { LocateFixed, MapPin as PinIcon } from 'lucide-react-native';
import type { DeviceLocation } from '@/lib/deviceLocation';
import React, { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import { MAP_PIN_KINDS, type MapPin } from '@/lib/mapPins';
import type { NearbyPlace } from '@/lib/places';

type Center = { lat: number; lng: number } | null;
type Props = {
  myLocation?: DeviceLocation | null;
  destination?: JourneyTarget | null;
  onLocation?: (value: DeviceLocation) => void;
  pins: MapPin[];
  places: NearbyPlace[];
  center: Center;
  city: string | null;
  onSelectPin: (pin: MapPin) => void;
  onSelectPlace: (place: NearbyPlace) => void;
  onLocate: () => void;
};

const LEAFLET_ASSETS_STYLE_ID = 'leaflet-local-assets';

export default function NeighborhoodWebMap({ pins, places, center, city, onSelectPin, onSelectPlace, onLocate, myLocation, destination, onLocation }: Props) {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // Keep Leaflet's stylesheet but serve its image assets from this app's public folder.
    // The default-icon-path rule is also used by Leaflet to discover the marker image directory.
    if (!document.getElementById(LEAFLET_ASSETS_STYLE_ID)) {
      const style = document.createElement('style');
      style.id = LEAFLET_ASSETS_STYLE_ID;
      style.textContent = `
        .leaflet-default-icon-path {
          background-image: url('/leaflet/images/marker-icon.png');
        }
        .leaflet-control-layers-toggle {
          background-image: url('/leaflet/images/layers.png');
        }
        .leaflet-retina .leaflet-control-layers-toggle {
          background-image: url('/leaflet/images/layers-2x.png');
          background-size: 26px 26px;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  const mapCenter: [number, number] = center ? [center.lat, center.lng] : [24.7136, 46.6753];
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 360, borderRadius: 17, overflow: 'hidden', background: '#e8eee8' }}>
      <MapContainer center={mapCenter} zoom={city ? 12 : 5} scrollWheelZoom style={{ width: '100%', height: '100%', minHeight: 360 }}>
        <MapJourney center={center} location={myLocation} destination={destination} onLocation={onLocation} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {places.slice(0, 80).map(place => (
          <CircleMarker key={'place-' + place.id} center={[place.lat, place.lng]} radius={8} pathOptions={{ color: OASIS.colors.surface, weight: 3, fillColor: '#147D67', fillOpacity: 1 }} eventHandlers={{ click: () => onSelectPlace(place) }}>
            <Popup>
              <div dir="rtl" style={{ minWidth: 140, textAlign: 'right', fontFamily: 'system-ui, sans-serif' }}>
                <strong>{place.name}</strong>
                <div style={{ marginTop: 4, color: '#617168', fontSize: 12 }}>{place.categoryLabel}</div>
                <button style={{ marginTop: 8, border: 0, borderRadius: 8, background: '#173f35', color: OASIS.colors.surface, padding: '7px 10px', cursor: 'pointer' }} onClick={() => onSelectPlace(place)}>عرض التفاصيل</button>
              </div>
            </Popup>
          </CircleMarker>
        ))}
        {pins.slice(0, 300).map(pin => {
          const meta = MAP_PIN_KINDS[pin.kind];
          return (
            <CircleMarker key={pin.id} center={[pin.lat, pin.lng]} radius={pin.urgent ? 10 : 7} pathOptions={{ color: OASIS.colors.surface, weight: 2, fillColor: meta.color, fillOpacity: 0.95 }} eventHandlers={{ click: () => onSelectPin(pin) }}>
              <Popup>
                <div dir="rtl" style={{ minWidth: 150, textAlign: 'right', fontFamily: 'system-ui, sans-serif' }}>
                  <strong>{pin.title}</strong>
                  <div style={{ marginTop: 4, color: '#617168', fontSize: 12 }}>{meta.label} · {pin.area}</div>
                  {pin.body ? <div style={{ marginTop: 6, fontSize: 12 }}>{pin.body}</div> : null}
                  <button style={{ marginTop: 8, border: 0, borderRadius: 8, background: '#173f35', color: OASIS.colors.surface, padding: '7px 10px', cursor: 'pointer' }} onClick={() => onSelectPin(pin)}>عرض التفاصيل</button>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
      <div style={{ position: 'absolute', zIndex: 500, top: 12, right: 12, borderRadius: 12, padding: '9px 12px', background: '#ffffffed', color: '#23483b', fontSize: 12, fontWeight: 800, boxShadow: '0 3px 12px #173b3118', pointerEvents: 'none' }}>
        {city || 'المملكة العربية السعودية'}
      </div>
      <button onClick={onLocate} style={{ position: 'absolute', zIndex: 500, bottom: 14, right: 14, width: 42, height: 42, borderRadius: 13, background: OASIS.colors.surface, color: '#176b4d', border: '1px solid #dce5de', fontSize: 22, cursor: 'pointer', boxShadow: '0 3px 12px #173b3118' }} aria-label="تحديد موقعي"><LocateFixed size={21} color="#176b4d" /></button>
    </div>
  );
}
