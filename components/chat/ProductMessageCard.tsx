import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ShoppingBag, ExternalLink } from 'lucide-react-native';
import { OasisPressable as Pressable } from '@/components/oasis/OasisPrimitives';
import { OASIS, useTheme } from '@/lib/oasis';
import { supabase } from '@/lib/supabase';
import { productDisplayPrice } from '@/lib/productDetails';
import { productStatusLabel } from '@/lib/productMessage';

export function ProductMessageCard({ itemId, body }: { itemId: string; body: string }) {
  useTheme(); const c=OASIS.colors;
  const [product,setProduct]=useState<{title:string;price:number|null;item_type:string;status:string;image_url:string|null}|null>(null);
  const [loading,setLoading]=useState(true),[failed,setFailed]=useState(false),[imageFailed,setImageFailed]=useState(false);
  useEffect(()=>{
    let active=true;setLoading(true);setFailed(false);setImageFailed(false);setProduct(null);
    const load=async()=>{try{const {data,error}=await supabase.from('marketplace_items').select('title,price,item_type,status,image_url').eq('id',itemId).maybeSingle();if(active){setProduct(error?null:data);setFailed(!!error);}}catch{if(active)setFailed(true);}finally{if(active)setLoading(false);}};
    void load();
    const channel=supabase.channel('chat-product:'+itemId+':'+Math.random().toString(36).slice(2)).on('postgres_changes',{event:'UPDATE',schema:'public',table:'marketplace_items',filter:'id=eq.'+itemId},()=>void load()).subscribe();
    return()=>{active=false;void supabase.removeChannel(channel);};
  },[itemId]);
  return <View style={{gap:10,maxWidth:300}}>
    <View style={{flexDirection:'row-reverse',gap:8,alignItems:'center'}}><ShoppingBag size={19} color={c.primary}/><Text style={{color:c.ink,fontWeight:'800'}}>طلب منتج · للمراجعة مع البائع</Text></View>
    {loading?<ActivityIndicator color={c.primary}/>:product?<>
      {!!product.image_url&&!imageFailed&&<Image source={{uri:product.image_url}} onError={()=>setImageFailed(true)} style={{width:'100%',height:130,borderRadius:14}} resizeMode="contain"/>}
      <Text style={{color:c.ink,textAlign:'right',fontWeight:'700'}}>{product.title}</Text>
      <Text accessibilityLiveRegion="polite" style={{color:c.primary,textAlign:'right'}}>{productDisplayPrice(product.price,product.item_type)} · {productStatusLabel(product.status)}</Text>
      <Text style={{color:c.muted,textAlign:'right',fontSize:11}}>السعر والحالة أعلاه حاليان. إرسال الطلب لا يعني الحجز أو الدفع.</Text>
    </>:<Text style={{color:c.muted,textAlign:'right'}}>{failed?'تعذر تحديث بيانات المنتج. افتح الإعلان لإعادة المحاولة.':'المنتج محذوف أو غير متاح لك حاليًا؛ مرجع الطلب محفوظ أدناه.'}</Text>}
    <Text selectable style={{color:c.ink,textAlign:'right',lineHeight:23}}>{body}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="فتح المنتج المرتبط بالطلب" onPress={()=>router.push({pathname:'/marketplace-item',params:{id:itemId}})} style={{minHeight:44,borderRadius:14,backgroundColor:c.soft,flexDirection:'row-reverse',gap:7,justifyContent:'center',alignItems:'center'}}><ExternalLink size={17} color={c.primary}/><Text style={{color:c.primary,fontWeight:'700'}}>عرض المنتج وحالته الحالية</Text></Pressable>
  </View>;
}
