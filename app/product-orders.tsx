import React,{useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,RefreshControl,ScrollView,StyleSheet,Text,View} from 'react-native';
import {router} from 'expo-router';
import {AppHeader} from '@/components/shared/AppHeader';
import {OasisPressable as Pressable} from '@/components/oasis/OasisPrimitives';
import {useTheme} from '@/context/ThemeContext';
import {supabase} from '@/lib/supabase';
const ar:Record<string,string>={pending:'بانتظار قبول البائع',accepted:'مقبول',ready:'جاهز للاستلام',completed:'مكتمل',rejected:'مرفوض',cancelled:'ملغي'};
export default function ProductOrders(){
 const {colors:c}=useTheme();const [rows,setRows]=useState<any[]>([]),[loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false),[error,setError]=useState('');
 const load=useCallback(async()=>{
  try{
   const a=await supabase.auth.getUser();if(!a.data.user){router.replace('/auth');return;}
   const uid=a.data.user.id;
   const r=await supabase.from('marketplace_product_requests').select('id,buyer_id,seller_id,item_title,quantity,unit_price,status,version,created_at').or('buyer_id.eq.'+uid+',seller_id.eq.'+uid).order('created_at',{ascending:false}).limit(100);
   if(r.error)throw r.error;setRows(r.data||[]);setError('');
  }catch(e:any){setError(e?.message||'تعذر تحميل الطلبات.');}
  finally{setLoading(false);setRefreshing(false);}
 },[]);
 useEffect(()=>{void load();},[load]);
 return <View style={{flex:1,backgroundColor:'transparent'}}><AppHeader title="طلبات المنتجات" subtitle="طلباتي والطلبات الواردة" fallbackRoute="/marketplace-dashboard?tab=services"/>
 <ScrollView contentContainerStyle={s.wrap} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);void load();}}/>}>
  {loading?<ActivityIndicator color={c.primary}/>:null}
  {error?<Text style={{textAlign:'right',color:'#b91c1c'}}>{error}</Text>:null}
  {!loading&&!rows.length?<Text style={{textAlign:'right',color:c.muted}}>لا توجد طلبات منتجات حتى الآن.</Text>:null}
  {rows.map(x=><Pressable key={x.id} accessibilityRole="button" accessibilityLabel={'تفاصيل طلب '+x.item_title} onPress={()=>router.push({pathname:'/order-details',params:{id:x.id,kind:'product'}})} style={[s.card,{backgroundColor:c.surface,borderColor:c.line}]}>
   <Text style={[s.title,{color:c.ink}]}>{x.item_title}</Text>
   <Text style={{color:c.primary,textAlign:'right'}}>{ar[x.status]||x.status}</Text>
   <Text style={{color:c.muted,textAlign:'right',fontSize:12}}>الكمية: {x.quantity} · {new Date(x.created_at).toLocaleDateString('ar-SA')}</Text>
   <Text style={{color:c.primary,fontWeight:'700',textAlign:'right',fontSize:12}}>عرض تفاصيل الطلب والتقييم وبلاغات المشكلة</Text>
  </Pressable>)}
 </ScrollView></View>;
}
const s=StyleSheet.create({wrap:{padding:15,gap:12,width:'100%',maxWidth:780,alignSelf:'center',paddingBottom:65},card:{padding:15,borderWidth:1,borderRadius:16,gap:9},title:{fontSize:16,fontWeight:'700',textAlign:'right'}});
