import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { S } from '@/lib/ui';

export default function Service(){
 const {id}=useLocalSearchParams<{id:string}>(); const [x,setX]=useState<any>(null);
 useEffect(()=>{if(id) supabase.from('services').select('*').eq('id',id).single().then(({data})=>setX(data))},[id]);
 if(!x)return <ScrollView contentContainerStyle={S.page}><Text style={S.title}>جاري التحميل...</Text></ScrollView>;
 async function remove(){const {data:u}=await supabase.auth.getUser();if(!u.user||u.user.id!==x.provider_id)return Alert.alert('تنبيه','هذه الخدمة ليست لك.');const r=await supabase.from('services').delete().eq('id',id);if(r.error)Alert.alert('خطأ',r.error.message);else router.back()}
 return <ScrollView contentContainerStyle={S.page}><Text style={S.title}>{x.name}</Text><Text style={S.subtitle}>{x.city||'السعودية'} · {x.district||'عام'}</Text><Text style={S.body}>{x.description}</Text><Text style={S.meta}>التصنيف: {x.category}</Text>{x.price_from!=null&&<Text style={S.meta}>السعر من {x.price_from} ر.س</Text>}<Text style={S.meta}>{x.available_now?'متاح الآن 🟢':'غير متاح حالياً'}</Text><Pressable style={S.ghost} onPress={remove}><Text>حذف خدمتي</Text></Pressable></ScrollView>
}
