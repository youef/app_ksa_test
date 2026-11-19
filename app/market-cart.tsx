import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { uuid } from 'expo-modules-core';
import { router, useFocusEffect } from 'expo-router';
import { CheckCircle2, ChevronLeft, Minus, Package, Plus, RefreshCw, ShoppingBag, Trash2, Truck, Wallet } from 'lucide-react-native';
import { AppHeader } from '@/components/shared/AppHeader';
import { OasisPressable as Pressable, OasisTextInput as TextInput } from '@/components/oasis/OasisPrimitives';
import { useTheme } from '@/context/ThemeContext';
import { useBottomNavInset } from '@/lib/bottomNav';
import { supabase } from '@/lib/supabase';
import { availableProductFulfillments, marketCartTotals, formatCartMoney, type MarketCartLine } from '@/lib/marketCart';
import { productDisplayPrice } from '@/lib/productDetails';

type Product = { id: string; seller_id: string; title: string; description: string; price: number | null; item_type: string; image_url: string | null; status: string; city: string; district: string | null };

export default function MarketCart() {
  const { colors: c } = useTheme(), bottom = useBottomNavInset();
  const [uid,setUid] = useState('');
  const [lines,setLines] = useState<MarketCartLine[]>([]);
  const [products,setProducts] = useState<Record<string,Product>>({});
  const [notes,setNotes] = useState<Record<string,string>>({});
  const [editingNote,setEditingNote] = useState<string | null>(null);
  const [loading,setLoading] = useState(true), [refreshing,setRefreshing] = useState(false), [busy,setBusy] = useState('');
  const [error,setError] = useState(''), [notice,setNotice] = useState('');
  const [orders,setOrders] = useState<Array<{id:string;item_id:string}>>([]);
  const batchKey = '@hayna_cod_checkout:' + uid;
  const load = useCallback(async () => {
    try {
      const auth = await supabase.auth.getUser();
      if (!auth.data.user) { router.replace('/auth'); return; }
      const id=auth.data.user.id;setUid(id);
      const cart = await supabase.from('hayna_market_cart_items')
        .select('item_id,quantity,expected_price,fulfillment,note').eq('buyer_id',id).order('created_at');
      if(cart.error) throw cart.error;
      const rows=(cart.data||[]) as MarketCartLine[];
      let map:Record<string,Product>={};
      if(rows.length){
        const items=await supabase.from('marketplace_items')
          .select('id,seller_id,title,description,price,item_type,image_url,status,city,district')
          .in('id',rows.map(x=>x.item_id));
        if(items.error)throw items.error;
        map=Object.fromEntries(((items.data||[]) as Product[]).map(row=>[row.id,row]));
      }
      setLines(rows);setProducts(map);
      setNotes(Object.fromEntries(rows.map(row=>[row.item_id,row.note||''])));
      setError('');
    } catch(cause){setError((cause as Error).message||'تعذر تحميل السلة. أعد المحاولة.');}
    finally{setLoading(false);setRefreshing(false);}
  },[]);
  useFocusEffect(useCallback(()=>{void load();},[load]));

  async function update(item:MarketCartLine,quantity=item.quantity,fulfillment=item.fulfillment,note=notes[item.item_id]??''){
    if(busy)return;setBusy(item.item_id);setError('');setNotice('');
    try {
      const res=await supabase.rpc('hayna_market_cart_set',{p_item:item.item_id,p_quantity:quantity,p_fulfillment:fulfillment,p_note:note});
      if(res.error)throw res.error;
      await AsyncStorage.removeItem(batchKey).catch(()=>{});
      await load();
    }catch(cause){setError((cause as Error).message||'تعذر تحديث المنتج في السلة.');}
    finally{setBusy('');}
  }
  async function remove(itemId:string){
    if(busy)return;setBusy(itemId);setError('');setNotice('');
    try {
      const res=await supabase.rpc('hayna_market_cart_remove',{p_item:itemId});
      if(res.error)throw res.error;
      await AsyncStorage.removeItem(batchKey).catch(()=>{});
      await load();
    }catch(cause){setError((cause as Error).message||'تعذر حذف المنتج من السلة.');}
    finally{setBusy('');}
  }
  async function checkout(){
    if(busy||!uid||!lines.length)return;
    setBusy('checkout');setError('');setNotice('');
    try {
      const stored=await AsyncStorage.getItem(batchKey);
      const batch=stored && /^[0-9a-f-]{36}$/i.test(stored)?stored:uuid.v4();
      if(!stored||stored!==batch)await AsyncStorage.setItem(batchKey,batch);
      const response=await supabase.rpc('hayna_market_cart_checkout',{p_batch:batch});
      if(response.error)throw response.error;
      const created=(response.data?.orders||[]) as Array<{id:string;item_id:string}>;
      if(!created.length)throw new Error('تعذر تأكيد تسجيل الطلبات. أعد المحاولة بنفس مرجع السلة.');
      await AsyncStorage.removeItem(batchKey).catch(()=>{});
      setOrders(created);setLines([]);setProducts({});
      setNotice('تم إرسال الطلبات بنجاح، وسيؤكد كل تاجر التوفر وموعد الاستلام.');
    }catch(cause){setError((cause as Error).message||'تعذر إرسال السلة. راجع المنتجات ثم أعد المحاولة.');}
    finally{setBusy('');}
  }

  const totals=marketCartTotals(lines);
  const unavailable=lines.filter(line=>products[line.item_id]?.status!=='available');
  const unsavedNotes=lines.some(line=>(notes[line.item_id]??'')!==(line.note||''));
  const changedPrices=lines.filter(line=>{
    const item=products[line.item_id];
    return item && (item.price==null?null:Number(item.price))!==(line.expected_price==null?null:Number(line.expected_price));
  });
  const changing=busy!=='';
  return <View style={{flex:1,backgroundColor:'transparent'}}>
    <AppHeader variant="sub" title="سلة سوق الحي" subtitle="كل الطلبات · الدفع عند الاستلام" fallbackRoute="/market"/>
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);void load();}}/>}
      contentContainerStyle={[styles.wrap,{paddingBottom:bottom+36}]}>
      <View style={[styles.banner,{backgroundColor:c.soft,borderColor:c.line}]}>
        <Wallet size={20} color={c.primary}/>
        <View style={{flex:1,gap:2}}>
          <Text style={[styles.label,{color:c.ink}]}>الدفع نقدًا عند الاستلام</Text>
          <Text style={[styles.hint,{color:c.muted}]}>لا رسوم مسبقة. تكلفة التوصيل بالتنسيق مع التاجر.</Text>
        </View>
      </View>
      {loading&&<View style={styles.center}><ActivityIndicator color={c.primary}/><Text style={{color:c.muted}}>جارٍ تحميل سلتك…</Text></View>}
      {!!error&&<View accessibilityRole="alert" style={[styles.notice,{borderColor:c.danger}]}><Text style={[styles.hint,{color:c.danger}]}>{error}</Text><Pressable onPress={()=>void load()} style={styles.link}><RefreshCw size={16} color={c.primary}/><Text style={{color:c.primary}}>تحديث السلة</Text></Pressable></View>}
      {!!notice&&<Text accessibilityRole="alert" style={[styles.hint,{color:c.primary,fontWeight:'700'}]}>{notice}</Text>}
      {!!orders.length&&<View style={[styles.card,{backgroundColor:c.surface,borderColor:c.line}]}>
        <CheckCircle2 size={36} color={c.primary}/><Text style={[styles.heading,{color:c.ink}]}>تم إرسال {orders.length.toLocaleString('ar-SA')} طلب</Text>
        <Text style={[styles.hint,{color:c.muted}]}>سيتابع كل تاجر طلبه، وستظهر التحديثات في صفحة طلبات المنتجات ومحادثة الطلب.</Text>
        <Pressable accessibilityRole="button" onPress={()=>router.replace('/product-orders')} style={[styles.primary,{backgroundColor:c.primary}]}><Text style={styles.white}>متابعة طلباتي</Text><ChevronLeft size={18} color="#fff"/></Pressable>
      </View>}
      {!loading&&!orders.length&&!lines.length&&<View style={[styles.card,styles.center,{backgroundColor:c.surface,borderColor:c.line}]}>
        <ShoppingBag size={43} color={c.primary}/><Text style={[styles.heading,{color:c.ink}]}>سلتك فارغة</Text><Text style={[styles.hint,{color:c.muted}]}>أضف منتجات من سوق الحي؛ وسنحتفظ بها في حسابك حتى تجهز لطلبها.</Text>
        <Pressable accessibilityRole="button" onPress={()=>router.push('/market')} style={[styles.primary,{backgroundColor:c.primary}]}><Text style={styles.white}>تصفح السوق</Text></Pressable>
      </View>}
      {lines.map(line=>{
        const item=products[line.item_id];
        const options=availableProductFulfillments(item?.description);
        const listed=item?.status==='available';
        return <View key={line.item_id} style={[styles.card,{backgroundColor:c.surface,borderColor:c.line}]}>
          <Pressable accessibilityRole="button" onPress={()=>item&&router.push({pathname:'/marketplace-item',params:{id:item.id}})} style={styles.productRow}>
            {item?.image_url?<Image source={{uri:item.image_url}} style={styles.thumbnail}/>:<View style={[styles.thumbnail,styles.center,{backgroundColor:c.soft}]}><Package size={23} color={c.primary}/></View>}
            <View style={{flex:1,gap:6}}><Text numberOfLines={2} style={[styles.heading,{color:c.ink}]}>{item?.title||'هذا المنتج لم يعد متاحًا'}</Text>
              <Text style={[styles.price,{color:c.primary}]}>{item?productDisplayPrice(item.price,item.item_type):'غير متاح'}</Text>
              <Text style={[styles.hint,{color:c.muted}]}>{item?.district?('حي '+item.district+' · '):''}{item?.city||''}</Text>
            </View>
          </Pressable>
          {!listed&&<Text accessibilityRole="alert" style={[styles.hint,{color:c.danger}]}>المنتج غير متاح. أزله من السلة قبل الإرسال.</Text>}
          {listed&&changedPrices.some(row=>row.item_id===line.item_id)&&<View style={[styles.notice,{borderColor:c.danger}]}>
            <Text accessibilityRole="alert" style={[styles.hint,{color:c.danger}]}>تغيّر سعر المنتج منذ إضافته للسلة. راجع السعر الجديد قبل الطلب.</Text>
            <Pressable accessibilityRole="button" disabled={changing} onPress={()=>void update(line)} style={styles.link}><RefreshCw size={16} color={c.primary}/><Text style={{color:c.primary,fontWeight:'700'}}>تحديث السعر بعد المراجعة</Text></Pressable>
          </View>}
          <View style={styles.between}>
            <Text style={[styles.label,{color:c.ink}]}>الكمية</Text>
            <View style={styles.buttons}>
              <Pressable accessibilityRole="button" accessibilityLabel="زيادة الكمية" disabled={changing||line.quantity>=20||!listed} onPress={()=>void update(line,line.quantity+1)} style={[styles.iconButton,{backgroundColor:c.soft}]}><Plus size={19} color={c.primary}/></Pressable>
              <Text style={[styles.heading,{color:c.ink,minWidth:28,textAlign:'center'}]}>{line.quantity.toLocaleString('ar-SA')}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="تقليل الكمية" disabled={changing||line.quantity<=1||!listed} onPress={()=>void update(line,line.quantity-1)} style={[styles.iconButton,{backgroundColor:c.soft}]}><Minus size={19} color={c.primary}/></Pressable>
            </View>
          </View>
          <View style={[styles.deliveryRow,{borderTopColor:c.line}]}>
            <Text style={[styles.label,{color:c.ink}]}>التسليم</Text>
            <View style={styles.buttons}>{options.map(option=><Pressable key={option} disabled={changing||!listed} accessibilityRole="button" accessibilityState={{selected:line.fulfillment===option}} onPress={()=>void update(line,line.quantity,option)} style={[styles.chip,{borderColor:line.fulfillment===option?c.primary:c.line,backgroundColor:line.fulfillment===option?c.soft:c.surface}]}>
              <Text style={{color:line.fulfillment===option?c.primary:c.muted,fontSize:12,fontWeight:'700'}}>{option}</Text>
            </Pressable>)}</View>
          </View>
          {editingNote===line.item_id ? <>
            <TextInput value={notes[line.item_id]??''} onChangeText={v=>setNotes(old=>({...old,[line.item_id]:v}))} maxLength={400} multiline textAlign="right" accessibilityLabel="ملاحظة خاصة بالتاجر" placeholder="اكتب ملاحظة للتاجر (اختياري)" placeholderTextColor={c.muted} style={[styles.input,{borderColor:c.line,color:c.ink,backgroundColor:c.soft}]} />
            <Pressable disabled={changing||!listed} accessibilityRole="button" onPress={()=>{void (async()=>{await update(line);setEditingNote(null);})();}} style={[styles.link,{alignSelf:'flex-start'}]}><Text style={{color:c.primary,fontWeight:'700'}}>حفظ الملاحظة</Text></Pressable>
          </> : <Pressable accessibilityRole="button" accessibilityLabel={(line.note?'تعديل الملاحظة: ':'إضافة ملاحظة للتاجر')+ (line.note||'')} onPress={()=>setEditingNote(line.item_id)} style={styles.optionalNote}>
            <Text style={[styles.hint,{color:c.primary}]} numberOfLines={1}>{line.note?('ملاحظتك: '+line.note):'+ إضافة ملاحظة للتاجر (اختياري)'}</Text>
          </Pressable>}
          <Pressable accessibilityRole="button" accessibilityLabel="إزالة المنتج من السلة" disabled={changing} onPress={()=>void remove(line.item_id)} style={[styles.link,{alignSelf:'flex-start'}]}><Trash2 size={16} color={c.danger}/><Text style={{color:c.danger,fontWeight:'700'}}>إزالة المنتج</Text></Pressable>
        </View>;
      })}
      {!!lines.length&&<View style={[styles.card,{backgroundColor:c.surface,borderColor:c.line}]}>
        <View style={styles.between}><Text style={[styles.heading,{color:c.ink}]}>ملخص السلة</Text><Text style={[styles.label,{color:c.muted}]}>{totals.count.toLocaleString('ar-SA')} قطعة · {lines.length.toLocaleString('ar-SA')} منتج</Text></View>
        <View style={styles.between}><Text style={[styles.label,{color:c.ink}]}>إجمالي الأسعار المحددة</Text><Text style={[styles.price,{color:c.primary}]}>{formatCartMoney(totals.halalas)}</Text></View>
        {totals.unknown>0&&<Text style={[styles.hint,{color:c.muted}]}>{totals.unknown.toLocaleString('ar-SA')} منتج بسعر يُتفق عليه أو بدون مقابل؛ لا يُحتسب في المجموع المعروض.</Text>}
        <Text style={[styles.hint,{color:c.muted}]}>لا تشمل الأسعار رسوم التوصيل، وتُؤكد مع كل تاجر.</Text>
        {unsavedNotes&&<Text accessibilityRole="alert" style={[styles.hint,{color:c.danger}]}>هناك ملاحظات لم تُحفظ بعد. احفظها على كل منتج قبل تأكيد الطلب.</Text>}
        <Pressable accessibilityRole="button" accessibilityLabel="إرسال طلبات السلة والدفع فقط عند الاستلام" disabled={changing||unavailable.length>0||changedPrices.length>0||unsavedNotes} onPress={()=>void checkout()} style={[styles.primary,{backgroundColor:c.primary,opacity:changing||unavailable.length>0||changedPrices.length>0||unsavedNotes?0.5:1}]}>
          {busy==='checkout'?<ActivityIndicator color="#fff"/>:<ShoppingBag size={19} color="#fff"/>}<Text style={styles.white}>تأكيد الطلبات · الدفع عند الاستلام</Text>
        </Pressable>
        <Text style={[styles.hint,{color:c.muted,textAlign:'center'}]}>ستظهر حالة كل طلب في «طلباتي» بعد إرساله.</Text>
      </View>}
    </ScrollView>
  </View>;
}
const styles=StyleSheet.create({
  wrap:{width:'100%',maxWidth:760,alignSelf:'center',paddingHorizontal:14,paddingTop:14,gap:11},
  banner:{paddingHorizontal:14,paddingVertical:12,borderWidth:1,borderRadius:16,flexDirection:'row-reverse',alignItems:'center',gap:10},
  card:{borderWidth:1,borderRadius:19,padding:14,gap:10},
  heading:{fontSize:16,fontWeight:'800',textAlign:'right',lineHeight:24},
  label:{fontSize:13,fontWeight:'700',textAlign:'right'},
  hint:{fontSize:12.5,lineHeight:22,textAlign:'right'},
  price:{fontSize:17,fontWeight:'800',textAlign:'right'},
  white:{color:'#fff',fontSize:14,fontWeight:'800',textAlign:'center'},
  productRow:{flexDirection:'row-reverse',alignItems:'center',gap:13,minHeight:90},
  thumbnail:{width:78,height:78,borderRadius:14,overflow:'hidden'},
  between:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'space-between',gap:10},
  buttons:{flexDirection:'row-reverse',alignItems:'center',flexWrap:'wrap',gap:8},
  iconButton:{width:44,height:44,borderRadius:14,alignItems:'center',justifyContent:'center'},
  chip:{minHeight:44,borderWidth:1,borderRadius:15,paddingHorizontal:13,paddingVertical:10,justifyContent:'center'},
  input:{borderWidth:1,borderRadius:12,minHeight:54,maxHeight:130,padding:12,textAlignVertical:'top',fontSize:14},
  optionalNote:{minHeight:44,justifyContent:'center',alignSelf:'stretch'},
  deliveryRow:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:8,paddingTop:10,borderTopWidth:1},
  link:{minHeight:44,flexDirection:'row-reverse',alignItems:'center',gap:7,paddingHorizontal:10,justifyContent:'center'},
  primary:{minHeight:52,borderRadius:16,flexDirection:'row-reverse',alignItems:'center',justifyContent:'center',gap:10,paddingHorizontal:14},
  center:{alignItems:'center',justifyContent:'center',gap:12,minHeight:120},
  notice:{padding:13,borderWidth:1,borderRadius:15,gap:9},
});
