import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { S } from '@/lib/ui';
export default function Report(){
 const {type,id}=useLocalSearchParams<{type:string;id:string}>(); const [reason,setReason]=useState('');
 async function send(){if(!reason.trim())return Alert.alert('ناقص','اكتب سبب البلاغ.');const {data:u}=await supabase.auth.getUser();if(!u.user)return router.replace('/auth');const r=await supabase.from('reports').insert({reporter_id:u.user.id,target_type:type||'unknown',target_id:id,reason:reason.trim()});if(r.error)Alert.alert('خطأ',r.error.message);else{Alert.alert('تم','وصل البلاغ للإدارة.');router.back()}}
 return <ScrollView contentContainerStyle={S.page}><Text style={S.title}>إبلاغ الإدارة</Text><Text style={S.subtitle}>إذا شفت محتوى مخالف أو مضلل، اشرح السبب.</Text><TextInput style={[S.input,{height:140}]} multiline value={reason} onChangeText={setReason} placeholder="سبب البلاغ..."/><Pressable style={S.button} onPress={send}><Text style={S.buttonText}>إرسال البلاغ</Text></Pressable></ScrollView>
}
