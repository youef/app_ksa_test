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
    <AppHeader variant="sub" title="طلبات سوق الحي" subtitle="حالة الطلب والتسليم والدفع عند الاستلام" fallbackRoute="/market"/>
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);void load();}}/>}
      contentContainerStyle={[styles.wrap,{paddingBottom:bottom+48}]}>
      <View style={[styles.banner,{backgroundColor:c.soft,borderColor:c.line}]}>
        <Wallet size={24} color={c.primary}/>
        <View style={{flex:1,gap:4}}><Text style={[styles.title,{color:c.ink}]}>طلبات المنتجات · الدفع عند الاستلام</Text>
          <Text style={[styles.hint,{color:c.muted}]}>لا تُحصَّل مبالغ عند إنشاء الطلب. حالة الطلب والتوصيل متاحة لك وللطرف الآخر، ويمكن التواصل من داخل كل طلب.</Text>
        </View>
      </View>
      <View style={styles.tabs}>
        <Pressable accessibilityRole="tab" accessibilityState={{selected:mode==='outgoing'}} onPress={()=>setMode('outgoing')} style={[styles.tab,{backgroundColor:mode==='outgoing'?c.primary:c.surface,borderColor:c.line}]}>
          <ShoppingBag size={18} color={mode==='outgoing'?'#fff':c.primary}/><Text style={[styles.tabText,{color:mode==='outgoing'?'#fff':c.ink}]}>مشترياتي ({outgoing.length.toLocaleString('ar-SA')})</Text>
        </Pressable>
        <Pressable accessibilityRole="tab" accessibilityState={{selected:mode==='incoming'}} onPress={()=>setMode('incoming')} style={[styles.tab,{backgroundColor:mode==='incoming'?c.primary:c.surface,borderColor:c.line}]}>
          <PackageCheck size={18} color={mode==='incoming'?'#fff':c.primary}/><Text style={[styles.tabText,{color:mode==='incoming'?'#fff':c.ink}]}>طلبات العملاء ({incoming.length.toLocaleString('ar-SA')})</Text>
        </Pressable>
      </View>
      <View style={styles.between}><Text style={[styles.label,{color:c.muted}]}>{visible.length.toLocaleString('ar-SA')} طلب · {active.toLocaleString('ar-SA')} قيد المتابعة</Text>
        <Pressable accessibilityRole="button" onPress={()=>router.push('/market-cart')} style={[styles.cartButton,{backgroundColor:c.soft}]}><ShoppingCart size={18} color={c.primary}/><Text style={{color:c.primary,fontSize:12,fontWeight:'800'}}>السلة</Text></Pressable>
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
          <View style={styles.between}><Text numberOfLines={2} style={[styles.title,{color:c.ink,flex:1}]}>{row.item_title}</Text><ChevronLeft size={20} color={c.primary}/></View>
          <View style={[styles.statusBadge,{backgroundColor:closed?c.dangerSoft:c.soft}]}>
            {closed?<Clock3 size={16} color={c.danger}/>:step>=3?<CheckCircle2 size={16} color={c.primary}/>:<Truck size={16} color={c.primary}/>}
            <Text style={{color:closed?c.danger:c.primary,fontWeight:'800',fontSize:13}}>{productOrderStatus(row.status)}</Text>
          </View>
          <View style={styles.progressRow}>{productOrderStages.map((st,i)=><View key={st.status} style={[styles.progressPart,{backgroundColor:!closed&&step>=i?c.primary:c.line}]}/>)}</View>
          <View style={styles.between}><Text style={[styles.hint,{color:c.muted}]}>الكمية: {row.quantity.toLocaleString('ar-SA')} · {row.fulfillment}</Text>
            <Text style={[styles.price,{color:c.primary}]}>{total==null?'السعر بالاتفاق':formatCartMoney(total)}</Text>
          </View>
          <View style={styles.between}><Text style={[styles.hint,{color:c.muted}]}>{new Date(row.created_at).toLocaleDateString('ar-SA')}</Text>
            <Text style={[styles.hint,{color:row.cash_collected_at?c.primary:c.muted,fontWeight:'700'}]}>{row.cash_collected_at?'سُجّل التحصيل النقدي':'نقدًا عند الاستلام'}</Text>
          </View>
          <Text style={[styles.hint,{color:c.primary,fontWeight:'800'}]}>عرض التفاصيل والمحادثة وموعد التسليم</Text>
        </Pressable>;
      })}
    </ScrollView>
  </View>;
}
const styles=StyleSheet.create({
  wrap:{padding:16,gap:14,maxWidth:880,width:'100%',alignSelf:'center'},
  banner:{padding:16,borderWidth:1,borderRadius:20,flexDirection:'row-reverse',gap:12,alignItems:'flex-start'},
  title:{fontSize:16,fontWeight:'800',textAlign:'right',lineHeight:25},
  label:{fontSize:13,fontWeight:'700',textAlign:'right'},
  hint:{fontSize:12.5,lineHeight:21,textAlign:'right'},
  price:{fontSize:14,fontWeight:'800',textAlign:'right'},
  tabs:{flexDirection:'row-reverse',gap:9},
  tab:{flex:1,minHeight:50,borderWidth:1,borderRadius:16,flexDirection:'row-reverse',alignItems:'center',justifyContent:'center',gap:7,paddingHorizontal:7},
  tabText:{fontSize:12.5,fontWeight:'800'},
  between:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'space-between',gap:10},
  cartButton:{minHeight:44,paddingHorizontal:15,borderRadius:15,flexDirection:'row-reverse',alignItems:'center',justifyContent:'center',gap:7},
  card:{padding:17,borderWidth:1,borderRadius:21,gap:13},
  statusBadge:{minHeight:39,alignSelf:'flex-end',paddingHorizontal:14,borderRadius:15,flexDirection:'row-reverse',alignItems:'center',gap:8},
  progressRow:{flexDirection:'row-reverse',gap:5},
  progressPart:{height:6,borderRadius:4,flex:1},
  center:{alignItems:'center',justifyContent:'center',gap:11,minHeight:160},
});
