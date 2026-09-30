import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { S } from '@/lib/ui';

export default function NewService(){
 const [name,setName]=useState(''),[description,setDescription]=useState(''),[category,setCategory]=useState('خدمات أخرى'),[city,setCity]=useState(''),[district,setDistrict]=useState(''),[price,setPrice]=useState(''),[available,setAvailable]=useState(true),[busy,setBusy]=useState(false);
 async function save(){if(!name.trim()||!description.trim()){Alert.alert('ناقص','اكتب اسم الخدمة ووصفها.');return}setBusy(true);const {data:u}=await supabase.auth.getUser();if(!u.user){router.replace('/auth');return}const r=await supabase.from('services').insert({provider_id:u.user.id,name:name.trim(),description:description.trim(),category:category.trim()||'خدمات أخرى',city:city.trim()||null,district:district.trim()||null,price_from:price?Number(price):null,available_now:available});setBusy(false);if(r.error)Alert.alert('تعذر الحفظ',r.error.message);else{Alert.alert('تم','تم نشر خدمتك.');router.back()}}
 return <ScrollView contentContainerStyle={S.page}><Text style={S.title}>أضف خدمتك</Text><TextInput style={S.input} value={name} onChangeText={setName} placeholder="اسم الخدمة"/><TextInput style={[S.input,{height:110}]} multiline value={description} onChangeText={setDescription} placeholder="وش تقدم؟"/><TextInput style={S.input} value={category} onChangeText={setCategory} placeholder="التصنيف"/><TextInput style={S.input} value={city} onChangeText={setCity} placeholder="المدينة"/><TextInput style={S.input} value={district} onChangeText={setDistrict} placeholder="الحي"/><TextInput style={S.input} value={price} onChangeText={setPrice} keyboardType="numeric" placeholder="السعر يبدأ من (اختياري)"/><Pressable style={S.button} onPress={()=>setAvailable(v=>!v)}><Text style={S.buttonText}>{available?'متاح الآن 🟢':'غير متاح 🔴'}</Text></Pressable><Pressable style={S.button} disabled={busy} onPress={save}><Text style={S.buttonText}>{busy?'جارٍ النشر...':'نشر الخدمة'}</Text></Pressable></ScrollView>
}
