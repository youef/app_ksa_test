import {useEffect,useState}from'react';
import {Text,View}from'react-native';
import {router}from'expo-router';
import {Megaphone,ChevronLeft}from'lucide-react-native';
import {OasisPressable as Pressable}from'@/components/oasis/OasisPrimitives';
import {useTheme}from'@/context/ThemeContext';
import {supabase}from'@/lib/supabase';
type Promotion={id:string;title:string;description:string;service_id:string|null;owner_id:string;ends_at:string};
export function MarketPromotions({city,district}:{city:string;district:string}){
 const {colors:c}=useTheme(),[rows,setRows]=useState<Promotion[]>([]);
 useEffect(()=>{let active=true;setRows([]);if(!city||/^كل|^جميع/.test(city))return;const load=async()=>{const response=await supabase.rpc('hayna_marketplace_promotions',{p_city:city,p_district:district&&!/^كل|^جميع/.test(district)?district:null});if(active&&!response.error)setRows(response.data||[]);};void load();const timer=setInterval(()=>{void load();},60000);return()=>{active=false;clearInterval(timer);};},[city,district]);
 const visible=rows.filter(row=>Date.parse(row.ends_at)>Date.now());
 if(!visible.length)return null;
 return <View style={{gap:10,marginBottom:16}}>{visible.map(row=><View key={row.id} style={{padding:15,borderRadius:18,borderWidth:1,borderColor:c.line,backgroundColor:c.surface,gap:9}}><View style={{flexDirection:'row-reverse',gap:6,alignItems:'center'}}><Megaphone size={14} color={c.primary}/><Text style={{color:c.primary,fontSize:10,fontWeight:'600'}}>إعلان ممول · {city}</Text></View><Text style={{textAlign:'right',fontSize:15,fontWeight:'700',color:c.ink}}>{row.title}</Text>{row.description?<Text style={{textAlign:'right',fontSize:12,lineHeight:23,color:c.muted}}>{row.description}</Text>:null}<Pressable oasisKind="plain" accessibilityRole="button" accessibilityLabel="تفاصيل الإعلان الممول" onPress={()=>router.push({pathname:row.service_id?'/service':'/user',params:{id:row.service_id||row.owner_id}})} style={{minHeight:44,alignSelf:'flex-end',paddingHorizontal:12,borderRadius:22,backgroundColor:c.soft,flexDirection:'row-reverse',gap:6,alignItems:'center'}}><Text style={{color:c.primary,fontSize:12,fontWeight:'600'}}>{row.service_id?'تفاصيل الخدمة':'التواصل مع المعلن'}</Text><ChevronLeft size={15} color={c.primary}/></Pressable></View>)}</View>;
}
