import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { C, S } from '@/lib/ui';

export default function Services() {
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  async function load(q = '') {
    const query = supabase.from('services').select('id,name,description,category,city,district,price_from,price_to,available_now,is_verified,provider_id').order('created_at',{ascending:false}).limit(60);
    const r = q.trim() ? await query.or('name.ilike.%'+q.trim()+'%,description.ilike.%'+q.trim()+'%') : await query;
    setItems(r.data ?? []);
  }
  useEffect(()=>{load()},[]);
  return <ScrollView contentContainerStyle={S.page}>
    <View style={S.row}><Text style={S.title}>خدمات الناس 🛠️</Text><Pressable onPress={()=>router.push('/new-service')}><Text style={styles.add}>+ خدمة</Text></Pressable></View>
    <Text style={S.subtitle}>اعرض خدمتك أو دور على شخص يساعدك.</Text>
    <TextInput style={S.input} value={search} onChangeText={setSearch} onSubmitEditing={()=>load(search)} placeholder="ابحث عن خدمة..." />
    {items.map(x=><Pressable key={x.id} style={S.card} onPress={()=>router.push({pathname:'/service',params:{id:x.id}})}>
      <Text style={styles.t}>{x.name} {x.available_now?'🟢':''}</Text>
      <Text style={S.body} numberOfLines={2}>{x.description}</Text>
      <Text style={S.meta}>{x.city||'السعودية'} · {x.district||'عام'} {x.price_from!=null?' · من '+x.price_from+' ر.س':''}</Text>
    </Pressable>)}
  </ScrollView>
}
const styles=StyleSheet.create({add:{fontWeight:'900',color:C.ink},t:{fontSize:18,fontWeight:'900',textAlign:'right',marginBottom:5}});
