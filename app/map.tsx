import { useEffect, useMemo, useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
const Map = Platform.OS !== 'web' ? require('@maplibre/maplibre-react-native').Map : View;
const Camera = Platform.OS !== 'web' ? require('@maplibre/maplibre-react-native').Camera : View;
const PointAnnotation = Platform.OS !== 'web' ? require('@maplibre/maplibre-react-native').PointAnnotation : View;
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { C, S } from '@/lib/ui';
import { isInsideSaudiArabia } from '@/lib/saudiLocations';

const STYLE_URL = 'https://demotiles.maplibre.org/style.json';
const DEFAULT_CENTER = [46.6753, 24.7136];

export default function MapScreen() {
  const [places, setPlaces] = useState<any[]>([]);
  const [query, setQuery] = useState('');
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [onlyVerified, setOnlyVerified] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('businesses')
        .select('id,name,description,city,district,latitude,longitude,is_open_now,is_verified')
        .not('latitude','is',null).not('longitude','is',null).limit(200);
      const list = (data ?? []).filter((p: any) => {
        const lat = Number(p.latitude), lng = Number(p.longitude);
        return !isNaN(lat) && !isNaN(lng) && isInsideSaudiArabia(lat, lng);
      });
      setPlaces(list);
    })();
  }, []);

  const filteredPlaces = useMemo(() => {
    const q = query.trim().toLowerCase();
    return places.filter((p: any) => {
      const text = [p.name, p.description, p.city, p.district].filter(Boolean).join(' ').toLowerCase();
      return (!q || text.includes(q)) && (!onlyOpen || p.is_open_now) && (!onlyVerified || p.is_verified);
    });
  }, [places, query, onlyOpen, onlyVerified]);

  const directions = (p: any) =>
    Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}`);

  const filters = (
    <View style={styles.filters}>
      <Pressable style={[styles.filter, onlyOpen && styles.filterActive]} onPress={() => setOnlyOpen(v => !v)}>
        <Text style={onlyOpen ? styles.filterTextActive : styles.filterText}>مفتوح</Text>
      </Pressable>
      <Pressable style={[styles.filter, onlyVerified && styles.filterActive]} onPress={() => setOnlyVerified(v => !v)}>
        <Text style={onlyVerified ? styles.filterTextActive : styles.filterText}>موثّق</Text>
      </Pressable>
      <Text style={styles.count}>{filteredPlaces.length} مكان</Text>
    </View>
  );

  const card = (p: any) => (
    <Pressable key={p.id} style={[S.card, selected?.id === p.id && styles.selectedCard]} onPress={() => setSelected(p)}>
      <View style={styles.row}>
        <View style={styles.badges}>
          {p.is_verified ? <Text style={styles.verified}>موثّق</Text> : null}
          {p.is_open_now ? <Text style={styles.open}>مفتوح</Text> : null}
        </View>
        <View style={styles.info}>
          <Text style={styles.name}>{p.name}</Text>
          <Text style={S.meta}>{p.city} · {p.district || 'عام'}</Text>
        </View>
      </View>
      {selected?.id === p.id ? (
        <View style={styles.actions}>
          <Pressable style={styles.primaryAction} onPress={() => directions(p)}>
            <Text style={styles.primaryActionText}>الاتجاهات ↗</Text>
          </Pressable>
          <Pressable style={styles.secondaryAction} onPress={() => setSelected(null)}>
            <Text style={styles.secondaryActionText}>إغلاق</Text>
          </Pressable>
        </View>
      ) : null}
    </Pressable>
  );

  if (Platform.OS === 'web') {
    return (
      <ScrollView contentContainerStyle={S.page}>
        <Text style={S.title}>الخريطة</Text>
        <Text style={S.subtitle}>ابحث عن الأماكن وفلتر المفتوح والموثّق.</Text>
        <TextInput value={query} onChangeText={setQuery} placeholder="ابحث باسم المكان أو المدينة..."
          placeholderTextColor={C.muted} style={styles.search} />
        {filters}
        {filteredPlaces.map(card)}
        {!filteredPlaces.length ? <Text style={styles.empty}>ما لقينا أماكن مطابقة.</Text> : null}
        <Pressable style={S.ghost} onPress={() => router.back()}><Text>رجوع</Text></Pressable>
      </ScrollView>
    );
  }

  return (
    <View style={styles.root}>
      <Map style={styles.map} mapStyle={STYLE_URL}>
        <Camera defaultSettings={{ centerCoordinate: DEFAULT_CENTER, zoomLevel: 5 }} />
        {filteredPlaces.map((p: any) => (
          <PointAnnotation key={p.id} id={p.id} coordinate={[Number(p.longitude), Number(p.latitude)]}
            title={p.name} onSelected={() => setSelected(p)} />
        ))}
      </Map>

      <View style={styles.overlay}>
        <TextInput value={query} onChangeText={setQuery} placeholder="ابحث عن مكان..."
          placeholderTextColor={C.muted} style={styles.search} />
        {filters}
      </View>

      {selected ? (
        <View style={styles.selectedPanel}>
          <Text style={styles.name}>{selected.name}</Text>
          <Text style={S.meta}>{selected.city} · {selected.district || 'عام'}</Text>
          {selected.description ? <Text style={styles.description}>{selected.description}</Text> : null}
          <View style={styles.actions}>
            <Pressable style={styles.primaryAction} onPress={() => directions(selected)}>
              <Text style={styles.primaryActionText}>الاتجاهات ↗</Text>
            </Pressable>
            <Pressable style={styles.secondaryAction} onPress={() => setSelected(null)}>
              <Text style={styles.secondaryActionText}>إغلاق</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      <Pressable style={styles.close} onPress={() => router.back()}><Text style={styles.closeText}>رجوع</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root:{flex:1,backgroundColor:C.bg}, map:{flex:1},
  overlay:{position:'absolute',top:45,left:14,right:14,backgroundColor:'#fff',borderRadius:18,padding:10,elevation:5},
  search:{backgroundColor:'#f5f5f5',borderRadius:12,paddingHorizontal:14,paddingVertical:11,color:C.ink,textAlign:'right',fontSize:14},
  filters:{flexDirection:'row',alignItems:'center',gap:8,marginTop:8},
  filter:{borderWidth:1,borderColor:'#ddd',borderRadius:10,paddingHorizontal:12,paddingVertical:7},
  filterActive:{backgroundColor:C.accent,borderColor:C.accent},
  filterText:{color:C.ink,fontWeight:'700'}, filterTextActive:{color:'#fff',fontWeight:'800'},
  count:{marginLeft:'auto',color:C.muted,fontSize:12,fontWeight:'700'},
  row:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}, info:{flex:1},
  badges:{flexDirection:'row',gap:6,marginRight:10},
  verified:{backgroundColor:'#eef6ff',color:'#1769aa',paddingHorizontal:7,paddingVertical:4,borderRadius:8,fontSize:11,fontWeight:'800'},
  open:{backgroundColor:'#edf9f0',color:'#19733a',paddingHorizontal:7,paddingVertical:4,borderRadius:8,fontSize:11,fontWeight:'800'},
  selectedCard:{borderWidth:1,borderColor:C.accent},
  selectedPanel:{position:'absolute',left:14,right:14,bottom:90,backgroundColor:'#fff',borderRadius:18,padding:16,elevation:8},
  name:{fontSize:18,fontWeight:'900',color:C.ink,textAlign:'right'},
  description:{fontSize:13,color:C.muted,textAlign:'right',marginTop:7,lineHeight:20},
  actions:{flexDirection:'row',gap:8,marginTop:12},
  primaryAction:{flex:1,backgroundColor:C.accent,borderRadius:12,paddingVertical:11,alignItems:'center'},
  primaryActionText:{color:'#fff',fontWeight:'800'},
  secondaryAction:{paddingHorizontal:16,borderRadius:12,paddingVertical:11,backgroundColor:'#f2f2f2',alignItems:'center'},
  secondaryActionText:{color:C.ink,fontWeight:'800'},
  empty:{textAlign:'center',color:C.muted,paddingVertical:30},
  close:{position:'absolute',bottom:25,right:18,backgroundColor:C.accent,borderRadius:14,paddingHorizontal:18,paddingVertical:12},
  closeText:{color:'#fff',fontWeight:'800'}
});