import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { S } from '@/lib/ui';
export default function Locations(){
 const [regions,setRegions]=useState<any[]>([]);
 useEffect(()=>{supabase.from('saudi_regions').select('*').order('name').then(({data})=>setRegions(data??[]))},[]);
 return <ScrollView contentContainerStyle={S.page}><Text style={S.title}>اختر منطقتك 🇸🇦</Text><Text style={S.subtitle}>نستخدمها لتقريب الأسئلة والطلبات والخدمات منك.</Text>{regions.map(r=><Pressable key={r.id} style={S.card} onPress={()=>router.push({pathname:'/cities',params:{regionId:r.id}})}><Text style={{fontSize:18,fontWeight:'900',textAlign:'right'}}>{r.name}</Text></Pressable>)}</ScrollView>
}
