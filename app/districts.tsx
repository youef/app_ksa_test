import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { S } from '@/lib/ui';
export default function Districts(){const {cityId}=useLocalSearchParams<{cityId:string}>();const [items,setItems]=useState<any[]>([]);useEffect(()=>{if(cityId)supabase.from('saudi_districts').select('*').eq('city_id',cityId).order('name').then(({data})=>setItems(data??[]))},[cityId]);async function choose(name:string){const {data:u}=await supabase.auth.getUser();if(!u.user)return router.replace('/auth');await supabase.from('profiles').update({district:name}).eq('id',u.user.id);Alert.alert('تم','تم اختيار الحي.');router.replace('/home')}return <ScrollView contentContainerStyle={S.page}><Text style={S.title}>اختر الحي</Text>{items.map(d=><Pressable key={d.id} style={S.card} onPress={()=>choose(d.name)}><Text style={{fontSize:17,fontWeight:'800',textAlign:'right'}}>{d.name}</Text></Pressable>)}</ScrollView>}
