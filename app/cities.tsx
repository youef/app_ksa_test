import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { S } from '@/lib/ui';
export default function Cities(){const {regionId}=useLocalSearchParams<{regionId:string}>();const [items,setItems]=useState<any[]>([]);useEffect(()=>{if(regionId)supabase.from('saudi_cities').select('*').eq('region_id',regionId).order('name').then(({data})=>setItems(data??[]))},[regionId]);return <ScrollView contentContainerStyle={S.page}><Text style={S.title}>اختر المدينة</Text>{items.map(c=><Pressable key={c.id} style={S.card} onPress={()=>router.push({pathname:'/districts',params:{cityId:c.id}})}><Text style={{fontSize:18,fontWeight:'900',textAlign:'right'}}>{c.name}</Text></Pressable>)}</ScrollView>}
