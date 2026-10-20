import React, { useEffect, useState } from 'react';
import { Circle, CircleMarker, Polyline, useMap } from 'react-leaflet';
import { LocateFixed, Navigation, X, ExternalLink } from 'lucide-react-native';
import { distanceMeters, formatDistance } from '@/lib/privacy';
import type { DeviceLocation } from '@/lib/deviceLocation';
export type JourneyTarget = { lat: number; lng: number; name?: string; title?: string; approximate?: boolean };
export default function MapJourney({ center, location, destination, onLocation }: { center: {lat:number;lng:number}|null; location?: DeviceLocation|null; destination?: JourneyTarget|null; onLocation?: (value: DeviceLocation)=>void }) {
  const map = useMap();
  const [following, setFollowing] = useState(false);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  useEffect(() => { if (center) map.flyTo([center.lat, center.lng], 12, { duration: 1 }); }, [center?.lat, center?.lng, map]);
  useEffect(() => { if (destination) { setFollowing(false); map.flyTo([destination.lat, destination.lng], 16, {duration: 1}); } }, [destination, map]);
  useEffect(() => { if (location && (following || (!destination && tick === 0))) map.flyTo([location.latitude, location.longitude], 16, { duration: 0.7 }); }, [location, following, tick, map]);
  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize()); observer.observe(map.getContainer());
    const stop = () => setFollowing(false); map.on('dragstart', stop);
    return () => { observer.disconnect(); map.off('dragstart', stop); };
  }, [map]);
  useEffect(() => {
    if (!following) return;
    if (!navigator.geolocation) { setError('المتصفح لا يدعم الموقع'); setFollowing(false); return; }
    let watch: number | undefined;
    const start = () => { if (document.hidden) return; watch = navigator.geolocation.watchPosition(p => { setError(''); onLocation?.({latitude:p.coords.latitude, longitude:p.coords.longitude, accuracy:p.coords.accuracy}); }, () => { setError('تعذر متابعة موقعك. تحقق من إذن الموقع.'); setFollowing(false); }, { enableHighAccuracy:true, timeout:15000, maximumAge:3000 }); };
    const stop = () => { if (watch !== undefined) navigator.geolocation.clearWatch(watch); watch = undefined; };
    const visibility = () => { stop(); start(); }; start(); document.addEventListener('visibilitychange', visibility);
    return () => { stop(); document.removeEventListener('visibilitychange', visibility); };
  }, [following, onLocation]);
  const remaining = location && destination ? distanceMeters({lat:location.latitude,lng:location.longitude},destination) : null;
  const arrived = remaining !== null && remaining < 40 && (location?.accuracy ?? Infinity) <= 40 && !destination?.approximate;
  useEffect(() => { if (arrived) setFollowing(false); }, [arrived]);
  return <>
    {location && <><Circle center={[location.latitude,location.longitude]} radius={Math.min(location.accuracy ?? 15, 2000)} pathOptions={{color:'#2563eb',weight:1,fillOpacity:0.08}}/><CircleMarker center={[location.latitude,location.longitude]} radius={8} pathOptions={{color:'#fff',weight:3,fillColor:'#2563eb',fillOpacity:1}}/></>}
    {destination && <CircleMarker center={[destination.lat,destination.lng]} radius={13} pathOptions={{color:'#0f766e',weight:3,fillOpacity:0.2}}/>}
    {location && destination && <Polyline positions={[[location.latitude,location.longitude],[destination.lat,destination.lng]]} pathOptions={{color:'#0f766e',dashArray:'6 9',weight:3}}/>}
    <div className="leaflet-bottom leaflet-left" style={{pointerEvents:'auto',margin:12,maxWidth:'calc(100% - 80px)',background:'#fff',borderRadius:16,padding:12,boxShadow:'0 5px 22px #123f3530',direction:'rtl',fontFamily:'system-ui',color:'#123f35'}} onPointerDown={e=>e.stopPropagation()} onDoubleClick={e=>e.stopPropagation()}>
      {destination && <><strong>{destination.name || destination.title}</strong><div style={{fontSize:12,margin:'6px 0'}}>{arrived ? 'أنت بالقرب من الوجهة' : remaining === null ? 'فعّل موقعك لحساب المسافة' : formatDistance(remaining) + ' بخط مستقيم'}{destination.approximate ? ' · موقع تقريبي للحي' : ''}</div><div style={{fontSize:11,color:'#64746b',marginBottom:8}}>الخط مؤشر للوجهة؛ افتح الملاحة لاتباع الطرق.</div><a href={`https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}&travelmode=driving&dir_action=navigate`} target="_blank" rel="noopener noreferrer" style={{color:'#0f766e',fontWeight:700,fontSize:13}}>فتح الملاحة عبر الطرق</a></>}
      <button onClick={()=>{setFollowing(v=>!v);setTick(v=>v+1);}} style={{display:'flex',alignItems:'center',gap:8,marginTop:8,border:0,borderRadius:10,background:following?'#e9f1ee':'#0f766e',color:following?'#123f35':'#fff',padding:'10px 14px',cursor:'pointer'}}>{following?<X size={17}/>:<LocateFixed size={17} color="#fff"/>}{following?'إيقاف المتابعة':'متابعة موقعي مباشرة'}</button>
      {error && <div role="alert" style={{color:'#b91c1c',fontSize:12,marginTop:8}}>{error}</div>}
    </div>
  </>;
}
