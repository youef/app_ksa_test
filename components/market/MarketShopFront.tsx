import React,{useState} from 'react';
import { View,Text,ScrollView,StyleSheet,Platform } from 'react-native';
import { ShoppingBag,ShieldCheck,MapPin,Heart,Package,SlidersHorizontal } from 'lucide-react-native';
import { OasisPressable as Pressable } from '@/components/oasis/OasisPrimitives';
import { OASIS,useTheme } from '@/lib/oasis';
import { LISTING_TYPES,ListingTypeId } from '@/lib/serviceTypes';
import type { MarketPriceBand } from '@/lib/marketShopping';

export function MarketShopFront({activeType,onType,source,onSource,priceBand,onPrice,savedOnly,onSaved}:{activeType:string;onType:(id:ListingTypeId|'all')=>void;source:string;onSource:(v:'all'|'product'|'service')=>void;priceBand:MarketPriceBand;onPrice:(v:MarketPriceBand)=>void;savedOnly:boolean;onSaved:()=>void}) {
 useTheme();const c=OASIS.colors;const [expanded,setExpanded]=useState(false);
 return <View style={{gap:16,marginBottom:20}}>
  <View style={s.heading}><Text style={[s.title,{color:c.ink}]}>تسوّق على ذوقك</Text><Pressable accessibilityRole="button" accessibilityState={{expanded}} onPress={()=>setExpanded(!expanded)} style={{minHeight:40,flexDirection:'row-reverse',gap:5,alignItems:'center'}}><SlidersHorizontal size={15} color={c.primary}/><Text style={{color:c.primary,fontSize:12,fontWeight:'700'}}>خيارات التسوّق{source!=='all'||priceBand!=='all'||savedOnly?' •':''}</Text></Pressable></View>
  <ScrollView horizontal {...(Platform.OS==='web'?{dir:'rtl' as const}:{})} showsHorizontalScrollIndicator={false} contentContainerStyle={s.categories}>
   {[{id:'all',short:'الكل',Icon:ShoppingBag},...LISTING_TYPES].map(({id,short,Icon})=><Pressable key={id} accessibilityRole="button" accessibilityState={{selected:activeType===id}} onPress={()=>onType(id as ListingTypeId|'all')} style={s.category}><View style={[s.circle,{backgroundColor:activeType===id?c.primary:c.surface,borderColor:activeType===id?c.primary:c.line}]}><Icon size={25} strokeWidth={1.6} color={activeType===id?'#fff':c.primary}/></View><Text style={{color:activeType===id?c.primary:c.ink,fontWeight:activeType===id?'800':'500',fontSize:11,textAlign:'center'}}>{short}</Text></Pressable>)}
  </ScrollView>
  {expanded&&<><View style={[s.heading,{gap:8}]}>{([{id:'all',label:'كل السوق',Icon:ShoppingBag},{id:'product',label:'المنتجات',Icon:Package},{id:'service',label:'الخدمات',Icon:SlidersHorizontal}] as const).map(({id,label,Icon})=><Pressable key={id} accessibilityRole="button" accessibilityState={{selected:source===id}} onPress={()=>onSource(id)} style={[s.source,{backgroundColor:source===id?c.primary:c.surface,borderColor:c.line}]}><Icon size={15} color={source===id?'#fff':c.primary}/><Text style={{color:source===id?'#fff':c.ink,fontSize:12,fontWeight:'700'}}>{label}</Text></Pressable>)}</View>
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.prices}>
   <Pressable accessibilityRole="button" accessibilityState={{selected:savedOnly}} onPress={onSaved} style={[s.price,{borderColor:savedOnly?c.primary:c.line,backgroundColor:c.surface}]}><Heart size={15} color={savedOnly?c.primary:c.muted} fill={savedOnly?c.primary:'none'}/><Text style={{color:c.ink,fontSize:12}}>محفوظاتي</Text></Pressable>
   {([{id:'all',label:'كل الأسعار'},{id:'under100',label:'أقل من ١٠٠ ر.س'},{id:'100to500',label:'١٠٠ – ٥٠٠ ر.س'},{id:'over500',label:'أكثر من ٥٠٠ ر.س'}] as const).map(({id,label})=><Pressable key={id} accessibilityRole="button" accessibilityState={{selected:priceBand===id}} onPress={()=>onPrice(id)} style={[s.price,{borderColor:priceBand===id?c.primary:c.line,backgroundColor:priceBand===id?c.soft:c.surface}]}><Text style={{color:priceBand===id?c.primary:c.muted,fontSize:12,fontWeight:'600'}}>{label}</Text></Pressable>)}
  </ScrollView>
  </>}
  {expanded&&<View style={[s.trust,{backgroundColor:c.soft}]}><ShieldCheck size={16} color={c.primary}/><Text style={{color:c.primary,fontSize:11,flex:1,textAlign:'right'}}>راجع تفاصيل البائع والمنتج قبل تأكيد طلبك</Text><MapPin size={15} color={c.primary}/></View>}
 </View>;
}
const s=StyleSheet.create({heading:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'space-between'},title:{fontSize:18,fontWeight:'800'},categories:{flexDirection:'row-reverse',gap:12,paddingVertical:2},category:{width:68,gap:8,alignItems:'center'},circle:{height:62,width:62,borderRadius:22,borderWidth:1,alignItems:'center',justifyContent:'center'},source:{flex:1,minHeight:44,borderRadius:13,borderWidth:1,flexDirection:'row-reverse',gap:7,justifyContent:'center',alignItems:'center'},prices:{flexDirection:'row-reverse',gap:8},price:{minHeight:40,paddingHorizontal:12,borderRadius:20,borderWidth:1,flexDirection:'row-reverse',gap:6,alignItems:'center'},trust:{padding:10,borderRadius:12,flexDirection:'row-reverse',gap:8,alignItems:'center'}});
