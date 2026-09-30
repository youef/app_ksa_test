import { useEffect, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
// MapLibre is imported conditionally below
const Map = Platform.OS !== 'web' ? require('@maplibre/maplibre-react-native').Map : View;
const Camera = Platform.OS !== 'web' ? require('@maplibre/maplibre-react-native').Camera : View;
const PointAnnotation = Platform.OS !== 'web' ? require('@maplibre/maplibre-react-native').PointAnnotation : View;
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { C, S } from '@/lib/ui';

const STYLE_URL = 'https://demotiles.maplibre.org/style.json';
const DEFAULT_CENTER = [46.6753, 24.7136];

import { SAUDI_REGIONS, isInsideSaudiArabia } from '@/lib/saudiLocations';

export default function MapScreen() {
  const [places, setPlaces] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('businesses')
        .select('id,name,description,city,district,latitude,longitude,is_open_now,is_verified')
        .not('latitude','is',null).not('longitude','is',null).limit(200);
      const list = (data ?? []).filter((p: any) => {
        const lat = Number(p.latitude);
        const lng = Number(p.longitude);
        return !isNaN(lat) && !isNaN(lng) && isInsideSaudiArabia(lat, lng);
      });
      setPlaces(list);
    })();
  }, []);

  if (Platform.OS === 'web') {
    return (
      <ScrollView contentContainerStyle={S.page}>
        <Text style={S.title}>الخريطة</Text>
        <Text style={S.subtitle}>الأماكن المسجلة في حيّنا. اختر مكانًا لفتح موقعه في الخرائط.</Text>
        {places.map((p:any) => (
          <Pressable key={p.id} style={S.card} onPress={() => Linking.openURL(`https://www.openstreetmap.org/?mlat=${p.latitude}&mlon=${p.longitude}#map=17/${p.latitude}/${p.longitude}`)}>
            <Text style={styles.name}>{p.name}</Text>
            <Text style={S.meta}>{p.city} · {p.district || 'عام'}</Text>
            <Text style={styles.link}>فتح الموقع ↗</Text>
          </Pressable>
        ))}
        <Pressable style={S.ghost} onPress={() => router.back()}><Text>رجوع</Text></Pressable>
      </ScrollView>
    );
  }

  return (
    <View style={styles.root}>
      <Map style={styles.map} mapStyle={STYLE_URL}>
        <Camera defaultSettings={{ centerCoordinate: DEFAULT_CENTER, zoomLevel: 5 }} />
        {places.map((p:any) => (
          <PointAnnotation
            key={p.id}
            id={p.id}
            coordinate={[Number(p.longitude), Number(p.latitude)]}
            title={p.name}
          />
        ))}
      </Map>
      <View style={styles.top}>
        <Text style={styles.mapTitle}>أماكن حيّنا</Text>
        <Text style={styles.mapMeta}>{places.length} مكان</Text>
      </View>
      <Pressable style={styles.close} onPress={() => router.back()}><Text style={styles.closeText}>رجوع</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root:{flex:1,backgroundColor:C.bg},
  map:{flex:1},
  top:{position:'absolute',top:55,left:18,right:18,backgroundColor:'#fff',borderRadius:18,padding:14,elevation:4},
  mapTitle:{fontSize:18,fontWeight:'900',textAlign:'right',color:C.ink},
  mapMeta:{fontSize:12,color:C.muted,textAlign:'right',marginTop:3},
  close:{position:'absolute',bottom:35,right:18,backgroundColor:C.accent,borderRadius:14,paddingHorizontal:18,paddingVertical:12},
  closeText:{color:'#fff',fontWeight:'800'},
  name:{fontSize:18,fontWeight:'900',color:C.ink,textAlign:'right'},
  link:{color:C.accent,fontWeight:'800',textAlign:'right',marginTop:8}
});