import {ProductRequestPanel} from './ProductRequestPanel';
import {ProductEditorSheet} from '@/components/market/ProductEditorSheet';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ShoppingBag, ExternalLink } from 'lucide-react-native';
import { OasisPressable as Pressable } from '@/components/oasis/OasisPrimitives';
import { OASIS, useTheme } from '@/lib/oasis';
import { supabase } from '@/lib/supabase';
import { productDisplayPrice } from '@/lib/productDetails';
import { productStatusLabel } from '@/lib/productMessage';

export function ProductMessageCard({ itemId, body,messageId,userId,isBuyerMessage }: { itemId: string; body: string;messageId:string;userId:string;isBuyerMessage:boolean }) {
  useTheme(); const c=OASIS.colors;
  const [product,setProduct]=useState<any|null>(null);
  const [original,setOriginal]=useState(false),[editing,setEditing]=useState(false),[reload,setReload]=useState(0);
  const [loading,setLoading]=useState(true),[failed,setFailed]=useState(false),[imageFailed,setImageFailed]=useState(false);
  useEffect(()=>{
    let active=true;setLoading(true);setFailed(false);setImageFailed(false);setProduct(null);
    const load=async()=>{try{const {data,error}=await supabase.from('marketplace_items').select('id,seller_id,business_id,title,description,price,item_type,status,image_url,city,district,region,updated_at').eq('id',itemId).maybeSingle();if(active){setProduct(error?null:data);setFailed(!!error);}}catch{if(active)setFailed(true);}finally{if(active)setLoading(false);}};
    void load();
    const channel=supabase.channel('chat-product:'+itemId+':'+Math.random().toString(36).slice(2)).on('postgres_changes',{event:'UPDATE',schema:'public',table:'marketplace_items',filter:'id=eq.'+itemId},()=>void load()).subscribe();
    return()=>{active=false;void supabase.removeChannel(channel);};
  },[itemId,reload]);
  return <View style={{gap:10,maxWidth:300}}>
    <View style={{flexDirection:'row-reverse',gap:8,alignItems:'center'}}><ShoppingBag size={19} color={c.primary}/><Text style={{color:c.ink,fontWeight:'800'}}>طلب منتج من السوق</Text></View>
    {loading?<ActivityIndicator color={c.primary}/>:product?<>
      {!!product.image_url&&!imageFailed&&<Image source={{uri:product.image_url}} onError={()=>setImageFailed(true)} style={{width:'100%',height:130,borderRadius:14}} resizeMode="contain"/>}
      <Text style={{color:c.ink,textAlign:'right',fontWeight:'700'}}>{product.title}</Text>
      <Text accessibilityLiveRegion="polite" style={{color:c.primary,textAlign:'right'}}>{productDisplayPrice(product.price,product.item_type)} · {productStatusLabel(product.status)}</Text>
      <Text style={{color:c.muted,textAlign:'right',fontSize:11}}>السعر والحالة أعلاه حاليان. إرسال الطلب لا يعني الحجز أو الدفع.</Text>
    </>:<Text style={{color:c.muted,textAlign:'right'}}>{failed?'تعذر تحديث بيانات المنتج. افتح الإعلان لإعادة المحاولة.':'المنتج محذوف أو غير متاح لك حاليًا؛ مرجع الطلب محفوظ أدناه.'}</Text>}
    <ProductRequestPanel messageId={messageId} userId={userId} isBuyerMessage={isBuyerMessage} product={product}/>
    <Pressable accessibilityRole="button" accessibilityState={{expanded:original}} onPress={()=>setOriginal(!original)} style={{minHeight:40,justifyContent:'center'}}><Text style={{color:c.muted,fontSize:11,textAlign:'right'}}>{original?'إخفاء الرسالة الأصلية':'عرض الرسالة الأصلية ومرجع الطلب'}</Text></Pressable>
    {original&&<Text selectable style={{color:c.ink,textAlign:'right',lineHeight:23,fontSize:12}}>{body}</Text>}
    {product?.seller_id===userId&&<Pressable accessibilityRole="button" onPress={()=>setEditing(true)} style={{minHeight:44,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:c.line,borderRadius:12}}><Text style={{color:c.primary,fontWeight:'700'}}>تعديل المنتج والصورة والحالة</Text></Pressable>}
    <ProductEditorSheet item={editing?product:null} onClose={()=>setEditing(false)} onSaved={()=>setReload(value=>value+1)}/>
    <Pressable accessibilityRole="button" accessibilityLabel="فتح المنتج المرتبط بالطلب" onPress={()=>router.push({pathname:'/marketplace-item',params:{id:itemId}})} style={{minHeight:44,borderRadius:14,backgroundColor:c.soft,flexDirection:'row-reverse',gap:7,justifyContent:'center',alignItems:'center'}}><ExternalLink size={17} color={c.primary}/><Text style={{color:c.primary,fontWeight:'700'}}>عرض المنتج وحالته الحالية</Text></Pressable>
  </View>;
}
