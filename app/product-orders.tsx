import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { CheckCircle2, ChevronLeft, Clock3, Package, PackageCheck, ShoppingBag, ShoppingCart, Truck, Wallet } from 'lucide-react-native';
import { AppHeader } from '@/components/shared/AppHeader';
import { OasisPressable as Pressable } from '@/components/oasis/OasisPrimitives';
import { useTheme } from '@/context/ThemeContext';
import { useBottomNavInset } from '@/lib/bottomNav';
import { supabase } from '@/lib/supabase';
import { formatCartMoney, productOrderStages } from '@/lib/marketCart';
import {
  prioritizeProductOrders,
  productOrderAudienceHint,
  productOrderAudienceLabel,
  productOrderIsClosed,
  productOrderNeedsAttention,
  productOrderStageIndex,
  type ProductOrderAudience,
} from '@/lib/productOrdersPresentation';

type OrderRow = {
  id: string;
  buyer_id: string;
  seller_id: string;
  item_title: string;
  quantity: number;
  unit_price: number | null;
  status: string;
  created_at: string;
  fulfillment: string;
};
type OrderFilter = 'all' | 'active' | 'closed';
const filters: Array<{key:OrderFilter;label:string}> = [
  {key:'all',label:'الكل'},
  {key:'active',label:'الجارية'},
  {key:'closed',label:'المنتهية'},
];
const digit = (value:number) => value.toLocaleString('ar-SA');
function shortDate(value:string):string {
  const date=new Date(value);
  return Number.isNaN(date.getTime())?'—':date.toLocaleDateString('ar-SA',{day:'numeric',month:'short'});
}

export default function ProductOrders(){
  const {colors:c}=useTheme();
  const bottom=useBottomNavInset();
  const {width}=useWindowDimensions();
  const [uid,setUid]=useState('');
  const [rows,setRows]=useState<OrderRow[]>([]);
  const [mode,setMode]=useState<ProductOrderAudience>('outgoing');
  const [filter,setFilter]=useState<OrderFilter>('all');
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [error,setError]=useState('');

  const load=useCallback(async()=>{
    try {
      const auth=await supabase.auth.getUser();
      if(!auth.data.user){router.replace('/auth');return;}
      const id=auth.data.user.id;
      setUid(id);
      const result=await supabase.from('marketplace_product_requests')
        .select('id,buyer_id,seller_id,item_title,quantity,unit_price,status,created_at,fulfillment')
        .or('buyer_id.eq.'+id+',seller_id.eq.'+id)
        .order('created_at',{ascending:false}).limit(100);
      if(result.error)throw result.error;
      setRows((result.data||[]) as OrderRow[]);
      setError('');
    }catch(cause){
      setError((cause as Error).message||'تعذّر تحميل الطلبات. أعد المحاولة.');
    }finally{
      setLoading(false);
      setRefreshing(false);
    }
  },[]);
  useFocusEffect(useCallback(()=>{void load();},[load]));

  const outgoing=useMemo(()=>rows.filter(row=>row.buyer_id===uid),[rows,uid]);
  const incoming=useMemo(()=>rows.filter(row=>row.seller_id===uid),[rows,uid]);
  const orders=mode==='outgoing'?outgoing:incoming;
  const activeCount=orders.filter(row=>!productOrderIsClosed(row.status)).length;
  const closedCount=orders.length-activeCount;
  const attentionCount=orders.filter(row=>productOrderNeedsAttention(row.status,mode)).length;
  const hasMixedStates=activeCount>0&&closedCount>0;
  const visible=useMemo(
    ()=>prioritizeProductOrders(orders.filter(row=>filter==='all'||(filter==='closed' ? productOrderIsClosed(row.status) : !productOrderIsClosed(row.status))),mode),
    [orders,mode,filter]
  );
  const wide=width>=880;
  const showEmpty=!loading&&!error&&visible.length===0;

  function changeTab(next:ProductOrderAudience){
    setMode(next);
    setFilter('all');
  }

  return <View style={[styles.screen,{backgroundColor:c.background}]}>
    <AppHeader variant="sub" title="طلبات سوق الحي" subtitle="مشترياتي · طلبات العملاء" fallbackRoute="/market"/>
    <ScrollView
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);void load();}} tintColor={c.primary}/>}
      contentContainerStyle={[styles.wrap,{paddingBottom:bottom+32}]}>
      <View style={[styles.codStrip,{backgroundColor:c.soft,borderColor:c.line}]}>
        <Wallet size={18} color={c.primary}/>
        <Text style={[styles.codText,{color:c.ink}]}>الدفع نقدًا عند الاستلام</Text>
        <Text style={[styles.codAside,{color:c.muted}]} numberOfLines={1}>بلا دفع مسبق</Text>
      </View>

      <View accessibilityRole="tablist" style={[styles.tabShell,{borderColor:c.line,backgroundColor:c.surface}]}>
        <Pressable accessibilityRole="tab" accessibilityState={{selected:mode==='outgoing'}} onPress={()=>changeTab('outgoing')}
          style={[styles.tab,mode==='outgoing'&&{backgroundColor:c.primary}]}>
          <ShoppingBag size={18} color={mode==='outgoing'?'#fff':c.primary}/>
          <Text style={[styles.tabText,{color:mode==='outgoing'?'#fff':c.ink}]} numberOfLines={1}>مشترياتي</Text>
          <Text style={[styles.tabCount,{color:mode==='outgoing'?'#fff':c.muted}]}>{digit(outgoing.length)}</Text>
        </Pressable>
        <Pressable accessibilityRole="tab" accessibilityState={{selected:mode==='incoming'}} onPress={()=>changeTab('incoming')}
          style={[styles.tab,mode==='incoming'&&{backgroundColor:c.primary}]}>
          <PackageCheck size={18} color={mode==='incoming'?'#fff':c.primary}/>
          <Text style={[styles.tabText,{color:mode==='incoming'?'#fff':c.ink}]} numberOfLines={1}>طلبات العملاء</Text>
          <Text style={[styles.tabCount,{color:mode==='incoming'?'#fff':c.muted}]}>{digit(incoming.length)}</Text>
        </Pressable>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCopy}>
          <Text accessibilityRole="header" style={[styles.summaryTitle,{color:c.ink}]}>
            {attentionCount>0?mode==='outgoing'?'لديك طلبات جاهزة للاستلام':'طلبات تنتظر موافقتك':activeCount>0?'طلبات قيد المتابعة':orders.length>0?'سجل الطلبات':'متابعة الطلبات'}
          </Text>
          <Text style={[styles.smallText,{color:c.muted}]}>
            {loading?'جارٍ التحميل…':error?'تعذّر تحديث الحالة':attentionCount>0?digit(attentionCount)+' يتطلب إجراء منك':digit(activeCount)+' جارية · '+digit(closedCount)+' منتهية'}
          </Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="فتح سلة المشتريات" onPress={()=>router.push('/market-cart')}
          style={[styles.cartShortcut,{backgroundColor:c.surface,borderColor:c.line}]}>
          <ShoppingCart size={19} color={c.primary}/>
          <Text style={[styles.cartLabel,{color:c.primary}]}>السلة</Text>
        </Pressable>
      </View>

      {hasMixedStates&&<View style={styles.filterRow} accessibilityLabel="تصفية الطلبات">
        {filters.map(item=><Pressable key={item.key} accessibilityRole="button"
          accessibilityState={{selected:filter===item.key}}
          onPress={()=>setFilter(item.key)}
          style={[styles.filterChip,{borderColor:filter===item.key?c.primary:c.line,backgroundColor:filter===item.key?c.soft:c.surface}]}>
          <Text style={[styles.filterText,{color:filter===item.key?c.primary:c.muted}]}>{item.label}</Text>
        </Pressable>)}
      </View>}

      {loading&&<View accessibilityLabel="جارٍ تحميل طلبات السوق" style={styles.cards}>
        {[0,1,2].map(index=><View key={index} style={[styles.card,styles.skeletonCard,{backgroundColor:c.surface,borderColor:c.line,width:wide?'48.9%':'100%'}]}>
          <View style={styles.cardTop}>
            <View style={[styles.thumb,{backgroundColor:c.soft}]}/>
            <View style={{flex:1,gap:10,alignItems:'flex-end'}}>
              <View style={[styles.skeletonLine,{backgroundColor:c.line,width:'59%'}]}/>
              <View style={[styles.skeletonLine,{backgroundColor:c.line,width:'32%'}]}/>
            </View>
          </View>
          <View style={[styles.skeletonLine,{backgroundColor:c.soft,width:'45%'}]}/>
          <View style={[styles.progressRow,{marginVertical:3}]}>{[0,1,2,3].map(n=><View key={n} style={[styles.progressPart,{backgroundColor:c.line}]}/>)}</View>
          <View style={[styles.skeletonLine,{backgroundColor:c.line,width:'70%'}]}/>
        </View>)}
      </View>}

      {!!error&&<View accessibilityRole="alert" style={[styles.errorCard,{backgroundColor:c.surface,borderColor:c.danger}]}>
        <Text style={[styles.smallText,{color:c.danger,flex:1}]}>{error}</Text>
        <Pressable accessibilityRole="button" onPress={()=>{setLoading(true);void load();}} style={[styles.retryButton,{backgroundColor:c.soft}]}>
          <Text style={[styles.retryText,{color:c.primary}]}>إعادة المحاولة</Text>
        </Pressable>
      </View>}

      {showEmpty&&<View style={[styles.emptyCard,{backgroundColor:c.surface,borderColor:c.line}]}>
        <View style={[styles.emptyIcon,{backgroundColor:c.soft}]}><Package size={28} color={c.primary}/></View>
        <Text style={[styles.summaryTitle,{color:c.ink}]}>{orders.length===0?(mode==='outgoing'?'ما عندك طلبات بعد':'ما وصلك أي طلب بعد'):'لا توجد طلبات في هذا التصنيف'}</Text>
        <Text style={[styles.smallText,{color:c.muted,textAlign:'center',lineHeight:22}]}>
          {orders.length>0?'جرّب عرض جميع الطلبات.':mode==='outgoing'?'تصفّح السوق وأضف ما يعجبك للسلة، وستظهر طلباتك هنا.':'ستظهر طلبات العملاء هنا بمجرد وصولها.'}
        </Text>
        <Pressable accessibilityRole="button" onPress={()=>orders.length?setFilter('all'):router.push('/market')}
          style={[styles.emptyAction,{backgroundColor:c.soft}]}>
          <Text style={[styles.actionText,{color:c.primary}]}>{orders.length?'عرض كل الطلبات':'تصفّح السوق'}</Text>
          <ChevronLeft size={16} color={c.primary}/>
        </Pressable>
      </View>}

      {!loading&&visible.length>0&&<View style={styles.cards}>
        {visible.map(row=>{
          const attention=productOrderNeedsAttention(row.status,mode);
          const closed=productOrderIsClosed(row.status);
          const stage=productOrderStageIndex(row.status);
          const statusText=productOrderAudienceLabel(row.status,mode);
          const hintText=productOrderAudienceHint(row.status,mode);
          const statusColor=row.status==='cancelled'||row.status==='rejected'?c.danger
            :row.status==='pending'&&mode==='outgoing'?c.warning:c.primary;
          const statusBg=row.status==='cancelled'||row.status==='rejected'?c.dangerSoft
            :row.status==='pending'&&mode==='outgoing'?c.warningSoft:c.soft;
          const total=row.unit_price==null?null:Math.round(Number(row.unit_price)*100)*row.quantity;
          return <Pressable key={row.id} accessibilityRole="button"
            accessibilityLabel={row.item_title+'، '+statusText+'، '+(total==null?'السعر بالاتفاق':formatCartMoney(total))}
            accessibilityHint="فتح تفاصيل الطلب ومحادثة التاجر أو العميل"
            onPress={()=>router.push({pathname:'/order-details',params:{id:row.id,kind:'product'}})}
            style={[styles.card,{backgroundColor:c.surface,borderColor:attention?c.primary:c.line,width:wide?'48.9%':'100%'}]}>
            <View style={styles.cardTop}>
              <View style={[styles.thumb,{backgroundColor:c.soft}]}><Package size={20} color={c.primary}/></View>
              <View style={styles.cardHeadCopy}>
                <Text style={[styles.cardTitle,{color:c.ink}]} numberOfLines={1}>{row.item_title}</Text>
                <Text style={[styles.smallText,{color:c.muted}]} numberOfLines={1}>{mode==='incoming'?'طلب عميل':'طلب شراء'} · #{row.id.slice(0,6)}</Text>
              </View>
              <ChevronLeft size={18} color={c.muted}/>
            </View>
            <View style={styles.statusRow}>
              <View style={[styles.statusBadge,{backgroundColor:statusBg}]}>
                {closed?row.status==='completed'?<CheckCircle2 size={15} color={statusColor}/>:<Clock3 size={15} color={statusColor}/>:attention?<Clock3 size={15} color={statusColor}/>:<Truck size={15} color={statusColor}/>}
                <Text numberOfLines={1} style={[styles.statusText,{color:statusColor}]}>{statusText}</Text>
              </View>
              <Text style={[styles.dateText,{color:c.muted}]}>{shortDate(row.created_at)}</Text>
            </View>
            <View accessibilityLabel={'مراحل الطلب، '+statusText+', '+(stage>=0?'المرحلة '+digit(stage+1)+' من ٤':'الطلب مغلق')}
              style={styles.progressRow}>
              {productOrderStages.map((step,i)=><View key={step.status} style={[styles.progressPart,{backgroundColor:stage>=i&&stage>=0?c.primary:c.line}]}/>)}
            </View>
            <View style={styles.valueRow}>
              <Text style={[styles.smallText,{color:c.muted,flex:1}]} numberOfLines={1}>{digit(row.quantity)} {row.quantity===1?'قطعة':'قطع'} · {row.fulfillment||'التسليم بالتنسيق'}</Text>
              <Text style={[styles.price,{color:c.primary}]}>{total==null?'السعر بالاتفاق':formatCartMoney(total)}</Text>
            </View>
            <View style={[styles.cardBottom,{borderTopColor:c.line}]}>
              <Text style={[styles.footerHint,{color:attention?c.primary:c.muted}]} numberOfLines={1}>{hintText}</Text>
              <View style={styles.detailsLink}><Text style={[styles.detailsText,{color:c.primary}]}>تفاصيل الطلب</Text><ChevronLeft size={16} color={c.primary}/></View>
            </View>
          </Pressable>;
        })}
      </View>}
    </ScrollView>
  </View>;
}
const styles=StyleSheet.create({
  screen:{flex:1},
  wrap:{width:'100%',maxWidth:960,alignSelf:'center',paddingHorizontal:15,paddingTop:13,gap:15},
  codStrip:{flexDirection:'row-reverse',alignItems:'center',gap:10,paddingHorizontal:14,minHeight:46,borderRadius:15,borderWidth:1},
  codText:{fontSize:12.5,fontWeight:'800',textAlign:'right',flex:1},
  codAside:{fontSize:11.5,textAlign:'left'},
  tabShell:{padding:4,borderWidth:1,borderRadius:18,flexDirection:'row-reverse',gap:4},
  tab:{flex:1,minWidth:0,minHeight:46,borderRadius:14,flexDirection:'row-reverse',alignItems:'center',justifyContent:'center',gap:6,paddingHorizontal:8},
  tabText:{fontSize:13,fontWeight:'800',textAlign:'center',flexShrink:1},
  tabCount:{fontSize:12,fontWeight:'800'},
  summaryRow:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'space-between',gap:11},
  summaryCopy:{flex:1,alignItems:'flex-end',gap:3},
  summaryTitle:{fontSize:17,fontWeight:'800',textAlign:'right',lineHeight:25},
  smallText:{fontSize:12.5,lineHeight:20,textAlign:'right'},
  cartShortcut:{minHeight:45,borderRadius:15,borderWidth:1,flexDirection:'row-reverse',alignItems:'center',justifyContent:'center',gap:7,paddingHorizontal:13},
  cartLabel:{fontSize:12,fontWeight:'800'},
  filterRow:{flexDirection:'row-reverse',flexWrap:'wrap',gap:8},
  filterChip:{minHeight:44,borderRadius:13,borderWidth:1,paddingHorizontal:16,alignItems:'center',justifyContent:'center'},
  filterText:{fontSize:12.5,fontWeight:'800'},
  cards:{width:'100%',flexDirection:'row-reverse',flexWrap:'wrap',justifyContent:'space-between',gap:12},
  card:{borderWidth:1,borderRadius:20,padding:14,gap:11},
  cardTop:{minHeight:43,flexDirection:'row-reverse',alignItems:'center',gap:10},
  thumb:{width:43,height:43,borderRadius:14,alignItems:'center',justifyContent:'center'},
  cardHeadCopy:{flex:1,minWidth:0,alignItems:'flex-end',gap:2},
  cardTitle:{fontSize:16,fontWeight:'800',lineHeight:24,textAlign:'right'},
  statusRow:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'space-between',gap:9},
  statusBadge:{minHeight:32,borderRadius:11,paddingHorizontal:11,flexDirection:'row-reverse',alignItems:'center',gap:7,flexShrink:1},
  statusText:{fontSize:12,fontWeight:'800',textAlign:'right',flexShrink:1},
  dateText:{fontSize:12,fontWeight:'600',textAlign:'left'},
  progressRow:{flexDirection:'row-reverse',gap:5},
  progressPart:{height:5,borderRadius:4,flex:1},
  valueRow:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'space-between',gap:12},
  price:{fontSize:15,fontWeight:'800',textAlign:'left'},
  cardBottom:{borderTopWidth:1,paddingTop:10,flexDirection:'row-reverse',alignItems:'center',justifyContent:'space-between',gap:8},
  footerHint:{fontSize:11.5,fontWeight:'600',flex:1,minWidth:0,textAlign:'right'},
  detailsLink:{flexDirection:'row-reverse',alignItems:'center',gap:2,minHeight:25},
  detailsText:{fontSize:12,fontWeight:'800'},
  emptyCard:{borderWidth:1,borderRadius:20,alignItems:'center',padding:24,gap:12},
  emptyIcon:{width:58,height:58,borderRadius:19,alignItems:'center',justifyContent:'center'},
  emptyAction:{flexDirection:'row-reverse',alignItems:'center',gap:8,minHeight:46,paddingHorizontal:20,borderRadius:14},
  actionText:{fontSize:13,fontWeight:'800'},
  errorCard:{borderWidth:1,borderRadius:17,padding:13,flexDirection:'row-reverse',alignItems:'center',gap:10},
  retryButton:{minHeight:44,borderRadius:12,paddingHorizontal:14,justifyContent:'center'},
  retryText:{fontSize:12,fontWeight:'800'},
  skeletonCard:{minHeight:185,justifyContent:'space-between'},
  skeletonLine:{height:13,borderRadius:9},
});
