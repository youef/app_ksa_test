import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { CheckCircle2, ChevronLeft, Clock3, PackageCheck, ShoppingBag, ShoppingCart, Truck, Wallet } from 'lucide-react-native';
import { AppHeader } from '@/components/shared/AppHeader';
import { OasisPressable as Pressable } from '@/components/oasis/OasisPrimitives';
import { useTheme } from '@/context/ThemeContext';
import { useBottomNavInset } from '@/lib/bottomNav';
import { supabase } from '@/lib/supabase';
import { formatCartMoney, productOrderStages, productOrderStatus } from '@/lib/marketCart';

type OrderRow={id:string;buyer_id:string;seller_id:string;item_title:string;quantity:number;unit_price:number|null;status:string;version:number;created_at:string;fulfillment:string;cash_collected_at:string|null;payment_method:string};
type ViewMode='outgoing'|'incoming';
export default function ProductOrders(){
  const {colors:c}=useTheme(),bottom=useBottomNavInset();
  const [uid,setUid]=useState(''),[rows,setRows]=useState<OrderRow[]>([]),[mode,setMode]=useState<ViewMode>('outgoing');
  const [loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false),[error,setError]=useState('');
  const load=useCallback(async()=>{
    try{
      const auth=await supabase.auth.getUser();
      if(!auth.data.user){router.replace('/auth');return;}
      const id=auth.data.user.id;setUid(id);
      const result=await supabase.from('marketplace_product_requests')
        .select('id,buyer_id,seller_id,item_title,quantity,unit_price,status,version,created_at,fulfillment,cash_collected_at,payment_method')
        .or('buyer_id.eq.'+id+',seller_id.eq.'+id).order('created_at',{ascending:false}).limit(100);
      if(result.error)throw result.error;
      setRows((result.data||[]) as OrderRow[]);setError('');
    }catch(cause){setError((cause as Error).message||'تعذر تحميل طلبات المنتجات.');}
    finally{setLoading(false);setRefreshing(false);}
  },[]);
  useFocusEffect(useCallback(()=>{void load();},[load]));
  const outgoing=useMemo(()=>rows.filter(x=>x.buyer_id===uid),[rows,uid]);
  const incoming=useMemo(()=>rows.filter(x=>x.seller_id===uid),[rows,uid]);
  const visible=mode==='outgoing'?outgoing:incoming;
  const active=visible.filter(x=>!['completed','cancelled','rejected'].includes(x.status)).length;
  return <View style={{flex:1,backgroundColor:'transparent'}}>
    <AppHeader variant="sub" title="طلبات سوق الحي" subtitle="المشتريات · طلبات العملاء" fallbackRoute="/market"/>
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);void load();}}/>}
      contentContainerStyle={[styles.wrap,{paddingBottom:bottom+48}]}>
      <View style={[styles.banner,{backgroundColor:c.soft,borderColor:c.line}]}>
        <Wallet size={19} color={c.primary}/>
        <Text style={[styles.hint,{flex:1,color:c.ink,fontWeight:'700'}]}>الدفع عند الاستلام · تتبّع التجهيز والتوصيل من هنا</Text>
      </View>
      <View style={styles.tabs}>
        <Pressable accessibilityRole="tab" accessibilityState={{selected:mode==='outgoing'}} onPress={()=>setMode('outgoing')} style={[styles.tab,{backgroundColor:mode==='outgoing'?c.primary:c.surface,borderColor:c.line}]}>
          <ShoppingBag size={18} color={mode==='outgoing'?'#fff':c.primary}/><Text style={[styles.tabText,{color:mode==='outgoing'?'#fff':c.ink}]}>مشترياتي ({outgoing.length.toLocaleString('ar-SA')})</Text>
        </Pressable>
        <Pressable accessibilityRole="tab" accessibilityState={{selected:mode==='incoming'}} onPress={()=>setMode('incoming')} style={[styles.tab,{backgroundColor:mode==='incoming'?c.primary:c.surface,borderColor:c.line}]}>
          <PackageCheck size={18} color={mode==='incoming'?'#fff':c.primary}/><Text style={[styles.tabText,{color:mode==='incoming'?'#fff':c.ink}]}>طلبات العملاء ({incoming.length.toLocaleString('ar-SA')})</Text>
        </Pressable>
      </View>
      <View style={styles.between}><Text style={[styles.label,{color:c.muted}]}>{active.toLocaleString('ar-SA')} قيد المتابعة من {visible.length.toLocaleString('ar-SA')} طلب</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="العودة إلى السلة" onPress={()=>router.push('/market-cart')} style={[styles.cartButton,{backgroundColor:c.soft}]}><ShoppingCart size={19} color={c.primary}/></Pressable>
      </View>
      {loading&&<View style={styles.center}><ActivityIndicator color={c.primary}/><Text style={[styles.hint,{color:c.muted}]}>جارٍ تحميل الطلبات…</Text></View>}
      {!!error&&<View accessibilityRole="alert" style={[styles.card,{borderColor:c.danger,backgroundColor:c.surface}]}><Text style={[styles.hint,{color:c.danger}]}>{error}</Text><Pressable style={[styles.cartButton,{backgroundColor:c.soft}]} onPress={()=>void load()}><Text style={{color:c.primary}}>إعادة المحاولة</Text></Pressable></View>}
      {!loading&&!error&&!visible.length&&<View style={[styles.card,styles.center,{backgroundColor:c.surface,borderColor:c.line}]}>
        <ShoppingBag size={42} color={c.primary}/>
        <Text style={[styles.title,{color:c.ink}]}>{mode==='outgoing'?'لا توجد مشتريات بعد':'لم تصلك طلبات منتجات بعد'}</Text>
        <Text style={[styles.hint,{color:c.muted,textAlign:'center'}]}>{mode==='outgoing'?'أضف منتجات إلى السلة، ثم تابع مراحل تجهيزها واستلامها من هنا.':'عندما يطلب عميل أحد منتجاتك، ستظهر التفاصيل ومراحل التوصيل هنا.'}</Text>
        <Pressable onPress={()=>router.push('/market')} style={[styles.cartButton,{backgroundColor:c.soft}]}><Text style={{color:c.primary}}>فتح السوق</Text></Pressable>
      </View>}
      {visible.map(row=>{
        const step=Math.max(0,productOrderStages.findIndex(x=>x.status===row.status));
        const closed=['rejected','cancelled'].includes(row.status);
        const total=row.unit_price==null?null:Math.round(Number(row.unit_price)*100)*row.quantity;
        return <Pressable key={row.id} accessibilityRole="button" accessibilityLabel={'تفاصيل الطلب '+row.item_title+'، '+productOrderStatus(row.status)} onPress={()=>router.push({pathname:'/order-details',params:{id:row.id,kind:'product'}})}
          style={[styles.card,{backgroundColor:c.surface,borderColor:c.line}]}>
          <View style={styles.between}>
            <Text numberOfLines={1} style={[styles.title,{color:c.ink,flex:1}]}>{row.item_title}</Text>
            <View style={[styles.statusBadge,{backgroundColor:closed?c.dangerSoft:c.soft}]}>
              {closed?<Clock3 size={14} color={c.danger}/>:step>=3?<CheckCircle2 size={14} color={c.primary}/>:<Truck size={14} color={c.primary}/>}
              <Text numberOfLines={1} style={{color:closed?c.danger:c.primary,fontWeight:'700',fontSize:11.5}}>{productOrderStatus(row.status)}</Text>
            </View>
          </View>
          <View accessibilityLabel={'تقدم الطلب: '+productOrderStatus(row.status)} style={styles.progressRow}>
            {productOrderStages.map((st,i)=><View key={st.status} style={[styles.progressPart,{backgroundColor:!closed&&step>=i?c.primary:c.line}]}/>)}
          </View>
          <View style={styles.between}>
            <Text numberOfLines={1} style={[styles.hint,{color:c.muted,flex:1}]}>{row.quantity.toLocaleString('ar-SA')} قطعة · {row.fulfillment}</Text>
            <Text style={[styles.price,{color:c.primary}]}>{total==null?'بالإتفاق':formatCartMoney(total)}</Text>
          </View>
          <View style={[styles.between,{paddingTop:4,borderTopWidth:1,borderTopColor:c.line}]}>
            <Text style={[styles.hint,{color:c.muted}]}>{new Date(row.created_at).toLocaleDateString('ar-SA')}</Text>
            <View style={{flexDirection:'row-reverse',gap:5,alignItems:'center'}}><Text style={[styles.hint,{color:c.primary,fontWeight:'700'}]}>تفاصيل ومحادثة الطلب</Text><ChevronLeft size={16} color={c.primary}/></View>
          </View>
        </Pressable>;
      })}
    </ScrollView>
  </View>;
}
const styles=StyleSheet.create({
  wrap:{paddingHorizontal:14,paddingTop:13,gap:11,maxWidth:760,width:'100%',alignSelf:'center'},
  banner:{padding:12,borderWidth:1,borderRadius:15,flexDirection:'row-reverse',gap:9,alignItems:'center'},
  title:{fontSize:16,fontWeight:'800',textAlign:'right',lineHeight:25},
  label:{fontSize:13,fontWeight:'700',textAlign:'right'},
  hint:{fontSize:12.5,lineHeight:21,textAlign:'right'},
  price:{fontSize:14,fontWeight:'800',textAlign:'right'},
  tabs:{flexDirection:'row-reverse',gap:9},
  tab:{flex:1,minHeight:46,borderWidth:1,borderRadius:14,flexDirection:'row-reverse',alignItems:'center',justifyContent:'center',gap:7,paddingHorizontal:7},
  tabText:{fontSize:12.5,fontWeight:'800'},
  between:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'space-between',gap:10},
  cartButton:{minHeight:44,paddingHorizontal:15,borderRadius:15,flexDirection:'row-reverse',alignItems:'center',justifyContent:'center',gap:7},
  card:{padding:14,borderWidth:1,borderRadius:18,gap:10},
  statusBadge:{minHeight:32,alignSelf:'flex-end',maxWidth:'57%',paddingHorizontal:10,borderRadius:12,flexDirection:'row-reverse',alignItems:'center',gap:8},
  progressRow:{flexDirection:'row-reverse',gap:5},
  progressPart:{height:5,borderRadius:4,flex:1},
  center:{alignItems:'center',justifyContent:'center',gap:11,minHeight:160},
});
