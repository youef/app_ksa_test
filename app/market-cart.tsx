import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Image, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { uuid } from 'expo-modules-core';
import { router, useFocusEffect } from 'expo-router';
import { CheckCircle2, ChevronLeft, Minus, Package, Plus, RefreshCw, ShoppingBag, Trash2, Truck, Wallet, MapPin } from 'lucide-react-native';
import { AppHeader } from '@/components/shared/AppHeader';
import { OasisPressable as Pressable, OasisTextInput as TextInput } from '@/components/oasis/OasisPrimitives';
import { useTheme } from '@/context/ThemeContext';
import { useBottomNavInset } from '@/lib/bottomNav';
import { supabase } from '@/lib/supabase';
import { availableProductFulfillments, marketCartTotals, formatCartMoney, marketCartPriceChanged, marketCartDeliveryChanged, type MarketCartLine } from '@/lib/marketCart';
import { productDisplayPrice } from '@/lib/productDetails';

type Product = { id: string; seller_id: string; title: string; description: string; price: number | null; item_type: string; image_url: string | null; status: string; city: string; district: string | null };

export default function MarketCart() {
  const { colors: c, isDark } = useTheme(), bottom = useBottomNavInset();
  const {width}=useWindowDimensions();
  const wide=width>=900;
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

  // The previous UI refetched both cart and products after every tap.
  // Update optimistically and use the validated server response instead.
  async function update(item:MarketCartLine,quantity=item.quantity,fulfillment=item.fulfillment,note=item.note||''):Promise<boolean>{
    if(busy)return false;
    const previous=lines.find(line=>line.item_id===item.item_id)||item;
    setBusy(item.item_id);setError('');setNotice('');
    setLines(current=>current.map(line=>line.item_id===item.item_id
      ? {...line,quantity,fulfillment,note}
      : line));
    try {
      const res=await supabase.rpc('hayna_market_cart_set',{
        p_item:item.item_id,p_quantity:quantity,p_fulfillment:fulfillment,p_note:note
      });
      if(res.error)throw res.error;
      const confirmed=res.data as MarketCartLine | null;
      if(!confirmed||confirmed.item_id!==item.item_id)throw new Error('تعذر تأكيد تحديث السلة.');
      setLines(current=>current.map(line=>line.item_id===item.item_id?confirmed:line));
      setProducts(current=>{
        const product=current[item.item_id];
        if(!product)return current;
        const price=confirmed.expected_price==null?null:Number(confirmed.expected_price);
        return {...current,[item.item_id]:{...product,price}};
      });
      if(note!==(item.note||''))setNotes(current=>({...current,[item.item_id]:note}));
      await AsyncStorage.removeItem(batchKey).catch(()=>{});
      return true;
    }catch(cause){
      setLines(current=>current.map(line=>line.item_id===item.item_id?previous:line));
      setError((cause as Error).message||'تعذر تحديث المنتج. حاول مجددًا.');
      return false;
    }finally{setBusy('');}
  }

  async function remove(itemId:string){
    if(busy)return;
    const previous=lines;
    setBusy(itemId);setError('');setNotice('');
    setLines(current=>current.filter(line=>line.item_id!==itemId));
    try {
      const res=await supabase.rpc('hayna_market_cart_remove',{p_item:itemId});
      if(res.error)throw res.error;
      setProducts(current=>{const next={...current};delete next[itemId];return next;});
      setNotes(current=>{const next={...current};delete next[itemId];return next;});
      if(editingNote===itemId)setEditingNote(null);
      await AsyncStorage.removeItem(batchKey).catch(()=>{});
    }catch(cause){
      setLines(previous);
      setError((cause as Error).message||'تعذر إزالة المنتج. حاول مجددًا.');
    }finally{setBusy('');}
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
      setOrders(created);setLines([]);setProducts({});setNotes({});setEditingNote(null);
      setNotice('تم إرسال الطلبات بنجاح، وسيؤكد كل تاجر التوفر وموعد الاستلام.');
    }catch(cause){setError((cause as Error).message||'تعذر إرسال السلة. راجع المنتجات ثم أعد المحاولة.');}
    finally{setBusy('');}
  }

  const totals=marketCartTotals(lines);
  const unavailable=lines.filter(line=>products[line.item_id]?.status!=='available');
  const unsavedNotes=lines.some(line=>(notes[line.item_id]??'')!==(line.note||''));
  const changedPrices=lines.filter(line=>{
    const item=products[line.item_id];
    return item && marketCartPriceChanged(item.price,line.expected_price);
  });
  const deliveryChanges=lines.some(line=>{const product=products[line.item_id];return product?.status==='available'&&marketCartDeliveryChanged(product.description,line.fulfillment);});
  const changing=busy!=='';
  const sellersCount=new Set(lines.map(line=>products[line.item_id]?.seller_id).filter(Boolean)).size;
  return <View style={{flex:1,backgroundColor:c.background}}>
    <AppHeader variant="sub" title="سلة سوق الحي" subtitle="راجع منتجاتك وأرسل طلبك" fallbackRoute="/market"/>
    <ScrollView keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);void load();}} tintColor={c.primary}/>}
      contentContainerStyle={[styles.wrap,{paddingBottom:bottom+28}]}>
      {!!lines.length&&<View style={[styles.banner,{backgroundColor:c.soft,borderColor:c.line}]}>
        <Wallet size={19} color={c.primary}/>
        <View style={{flex:1,gap:2}}>
          <Text style={[styles.label,{color:c.ink}]}>الدفع عند الاستلام فقط</Text>
          <Text style={[styles.hint,{color:c.muted}]}>لا دفع مسبق · التوصيل بالاتفاق مع التاجر</Text>
        </View>
        <Text style={[styles.bannerCount,{color:c.primary}]}>{lines.length.toLocaleString('ar-SA')} منتجات</Text>
      </View>}
      {loading&&<View accessibilityLabel="جارٍ تحميل سلة المشتريات" style={styles.skeletonList}>
        {[0,1].map(index=><View key={index} style={[styles.card,{backgroundColor:c.surface,borderColor:c.line,minHeight:142,gap:14}]}>
          <View style={styles.productRow}><View style={[styles.thumbnail,{backgroundColor:c.soft}]}/>
            <View style={{flex:1,gap:10,alignItems:'flex-end'}}>
              <View style={[styles.skeletonBar,{width:'67%',backgroundColor:c.line}]}/>
              <View style={[styles.skeletonBar,{width:'41%',backgroundColor:c.soft}]}/>
            </View>
          </View>
          <View style={[styles.skeletonBar,{width:'55%',backgroundColor:c.line}]}/>
        </View>)}
      </View>}
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
      <View style={styles.cards}>
      {lines.map(line=>{
        const item=products[line.item_id];
        const options=availableProductFulfillments(item?.description);
        const listed=item?.status==='available';
        const priceChanged=listed&&changedPrices.some(row=>row.item_id===line.item_id);
        const deliveryChanged=listed&&!options.includes(line.fulfillment);
        const working=busy===line.item_id;
        const lineTotal=line.expected_price==null?null:Math.round(Number(line.expected_price)*100)*line.quantity;
        return <View key={line.item_id} style={[styles.card,{backgroundColor:c.surface,borderColor:c.line,width:wide?'49%':'100%'}]}>
          <Pressable accessibilityRole="button" accessibilityLabel={'عرض '+(item?.title||'المنتج')} onPress={()=>item&&router.push({pathname:'/marketplace-item',params:{id:item.id}})} style={styles.productRow}>
            {item?.image_url?<Image source={{uri:item.image_url}} resizeMode="cover" style={styles.thumbnail}/>:<View style={[styles.thumbnail,{backgroundColor:c.soft,alignItems:"center",justifyContent:"center"}]}><Package size={22} color={c.primary}/></View>}
            <View style={styles.productInfo}>
              <Text numberOfLines={1} style={[styles.heading,{color:c.ink}]}>{item?.title||'المنتج لم يعد متاحًا'}</Text>
              <Text style={[styles.price,{color:c.primary}]}>{item?productDisplayPrice(item.price,item.item_type):'غير متاح'}</Text>
              {!!item&&<View style={styles.locationRow}><MapPin size={13} color={c.muted}/><Text numberOfLines={1} style={[styles.locationText,{color:c.muted}]}>{item.district?'حي '+item.district+' · ':''}{item.city||''}</Text></View>}
            </View>
            <ChevronLeft size={17} color={c.muted}/>
          </Pressable>
          {!listed&&<Text accessibilityRole="alert" style={[styles.hint,{color:c.danger}]}>هذا المنتج لم يعد متاحًا. أزله من السلة للمتابعة.</Text>}
          {priceChanged&&<View style={[styles.notice,{borderColor:c.warning,backgroundColor:c.warningSoft}]}>
            <Text accessibilityRole="alert" style={[styles.hint,{color:c.ink}]}>تغيّر سعر هذا المنتج. راجع السعر الجديد قبل إتمام الطلب.</Text>
            <Pressable accessibilityRole="button" disabled={changing} onPress={()=>void update(line)} style={styles.inlineAction}>
              <RefreshCw size={15} color={c.primary}/><Text style={[styles.actionText,{color:c.primary}]}>اعتماد السعر بعد المراجعة</Text>
            </Pressable>
          </View>}
          <View style={[styles.itemControls,{borderTopColor:c.line}]}>
            <Text style={[styles.label,{color:c.ink}]}>الكمية</Text>
            <View style={[styles.stepper,{borderColor:c.line,backgroundColor:c.soft}]}>
              <Pressable accessibilityRole="button" accessibilityLabel={'زيادة كمية '+(item?.title||'المنتج')} accessibilityState={{disabled:changing||line.quantity>=20||!listed||priceChanged}} disabled={changing||line.quantity>=20||!listed||priceChanged}
                onPress={()=>void update(line,line.quantity+1)} style={styles.qtyButton}>
                <Plus size={20} color={line.quantity>=20||!listed||priceChanged||changing?c.muted:c.primary}/>
              </Pressable>
              <Text accessibilityLabel={'الكمية '+line.quantity} style={[styles.qtyValue,{color:c.ink}]}>{line.quantity.toLocaleString('ar-SA')}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={'تقليل كمية '+(item?.title||'المنتج')} accessibilityState={{disabled:changing||line.quantity<=1||!listed||priceChanged}} disabled={changing||line.quantity<=1||!listed||priceChanged}
                onPress={()=>void update(line,line.quantity-1)} style={styles.qtyButton}>
                <Minus size={20} color={line.quantity<=1||!listed||priceChanged||changing?c.muted:c.primary}/>
              </Pressable>
            </View>
            {working?<ActivityIndicator size="small" color={c.primary}/>:line.quantity>1&&lineTotal!==null&&!priceChanged?
              <Text style={[styles.unitTotal,{color:c.primary}]}>{formatCartMoney(lineTotal)}</Text>:null}
          </View>
          <View style={styles.deliveryRow}>
            <Text style={[styles.label,{color:c.ink}]}>التسليم</Text>
            {options.length===1?<View style={[styles.singleDelivery,{backgroundColor:c.soft}]}>
              <Truck size={16} color={c.primary}/>
              <Text style={[styles.deliveryLabel,{color:c.primary}]} numberOfLines={1}>{deliveryChanged?'طريقة التسليم تغيّرت':line.fulfillment}</Text>
              {deliveryChanged&&<Pressable accessibilityRole="button" disabled={changing} onPress={()=>void update(line,line.quantity,options[0])} style={styles.inlineAction}>
                <Text style={[styles.actionText,{color:c.primary}]}>تحديث</Text>
              </Pressable>}
            </View>:<View style={styles.buttons}>{options.map(option=><Pressable key={option} disabled={changing||!listed||priceChanged} accessibilityRole="button" accessibilityState={{selected:line.fulfillment===option}}
              onPress={()=>void update(line,line.quantity,option)}
              style={[styles.chip,{borderColor:line.fulfillment===option?c.primary:c.line,backgroundColor:line.fulfillment===option?c.soft:c.surface}]}>
              <Text style={[styles.actionText,{color:line.fulfillment===option?c.primary:c.muted}]}>{option}</Text>
            </Pressable>)}</View>}
          </View>
          <View style={[styles.cardActions,{borderTopColor:c.line}]}>
            <Pressable accessibilityRole="button" accessibilityLabel={line.note?'تعديل ملاحظة التاجر':'إضافة ملاحظة اختيارية للتاجر'} accessibilityState={{expanded:editingNote===line.item_id}}
              disabled={changing} onPress={()=>{
                if(editingNote){
                  const previous=lines.find(row=>row.item_id===editingNote);
                  setNotes(current=>({...current,[editingNote]:previous?.note||''}));
                }
                setEditingNote(editingNote===line.item_id?null:line.item_id);
              }} style={styles.inlineAction}>
              <Plus size={15} color={c.primary}/>
              <Text numberOfLines={1} style={[styles.actionText,{color:c.primary}]}>{line.note?'تعديل الملاحظة':'ملاحظة للتاجر'}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={'إزالة '+(item?.title||'المنتج')+' من السلة'} disabled={changing} onPress={()=>void remove(line.item_id)}
              style={styles.inlineAction}><Trash2 size={16} color={c.danger}/><Text style={[styles.actionText,{color:c.danger}]}>إزالة</Text></Pressable>
          </View>
          {line.note&&editingNote!==line.item_id?<Text numberOfLines={2} style={[styles.savedNote,{color:c.muted}]}>{line.note}</Text>:null}
          {editingNote===line.item_id&&<View style={styles.noteEditor}>
            <TextInput value={notes[line.item_id]??''} onChangeText={value=>setNotes(current=>({...current,[line.item_id]:value}))}
              maxLength={400} multiline editable={!changing} textAlign="right" accessibilityLabel="ملاحظة خاصة بالتاجر" placeholder="مثلاً: المقاس أو الوقت المناسب للاستلام"
              placeholderTextColor={c.muted} style={[styles.input,{borderColor:c.line,color:c.ink,backgroundColor:c.soft}]}/>
            <View style={styles.noteActions}>
              <Pressable accessibilityRole="button" disabled={changing||!listed||priceChanged} onPress={()=>void (async()=>{
                const saved=await update(line,line.quantity,line.fulfillment,notes[line.item_id]??'');
                if(saved)setEditingNote(null);
              })()} style={[styles.noteSave,{backgroundColor:c.primary,opacity:changing||!listed||priceChanged?0.5:1}]}>
                <Text style={[styles.actionText,{color:isDark?c.background:'#fff'}]}>حفظ الملاحظة</Text>
              </Pressable>
              <Pressable accessibilityRole="button" disabled={changing} onPress={()=>{
                setNotes(current=>({...current,[line.item_id]:line.note||''}));
                setEditingNote(null);
              }} style={styles.noteCancel}><Text style={[styles.actionText,{color:c.muted}]}>إلغاء</Text></Pressable>
            </View>
          </View>}
        </View>;
      })}
      </View>
      {!!lines.length&&<View style={[styles.summaryCard,{backgroundColor:c.surface,borderColor:c.line}]}>
        <View style={styles.between}>
          <Text accessibilityRole="header" style={[styles.heading,{color:c.ink}]}>ملخص السلة</Text>
          <Text style={[styles.hint,{color:c.muted}]}>{totals.count.toLocaleString('ar-SA')} قطعة · {lines.length.toLocaleString('ar-SA')} منتج</Text>
        </View>
        <View style={[styles.summaryMain,{borderTopColor:c.line}]}>
          <View style={{flex:1,gap:3}}>
            <Text style={[styles.hint,{color:c.muted}]}>إجمالي المنتجات</Text>
            <Text style={[styles.summaryPrice,{color:c.primary}]}>{formatCartMoney(totals.halalas)}</Text>
          </View>
          <View style={[styles.summaryTag,{backgroundColor:c.soft}]}>
            <Wallet size={16} color={c.primary}/>
            <Text style={[styles.actionText,{color:c.primary}]}>عند الاستلام</Text>
          </View>
        </View>
        {totals.unknown>0&&<Text style={[styles.hint,{color:c.muted}]}>{totals.unknown.toLocaleString('ar-SA')} منتج بدون سعر محدد، لا يدخل في الإجمالي.</Text>}
        {sellersCount>1&&<Text style={[styles.hint,{color:c.muted}]}>{sellersCount.toLocaleString('ar-SA')} تجار · يُرسل لكل تاجر طلب مستقل.</Text>}
        <Text style={[styles.hint,{color:c.muted}]}>رسوم التوصيل غير مشمولة، ويتم الاتفاق عليها مع التاجر.</Text>
        {unavailable.length>0&&<Text accessibilityRole="alert" style={[styles.hint,{color:c.danger}]}>أزل المنتجات غير المتاحة للمتابعة.</Text>}
        {changedPrices.length>0&&<Text accessibilityRole="alert" style={[styles.hint,{color:c.danger}]}>راجع الأسعار الجديدة قبل تأكيد الطلب.</Text>}
        {deliveryChanges&&<Text accessibilityRole="alert" style={[styles.hint,{color:c.danger}]}>تغيّرت خيارات التسليم لمنتج. حدّثها قبل الطلب.</Text>}
        {unsavedNotes&&<Text accessibilityRole="alert" style={[styles.hint,{color:c.danger}]}>احفظ ملاحظاتك أو ألغِ التعديل قبل إرسال الطلب.</Text>}
        <Pressable accessibilityRole="button" accessibilityLabel="تأكيد طلبات السلة والدفع عند الاستلام" accessibilityState={{disabled:changing||!!error||unavailable.length>0||changedPrices.length>0||deliveryChanges||unsavedNotes}}
          disabled={changing||!!error||unavailable.length>0||changedPrices.length>0||deliveryChanges||unsavedNotes} onPress={()=>void checkout()}
          style={[styles.primary,{backgroundColor:c.primary,opacity:changing||!!error||unavailable.length>0||changedPrices.length>0||deliveryChanges||unsavedNotes?0.5:1}]}>
          {busy==='checkout'?<ActivityIndicator color={isDark?c.background:'#fff'}/>:<ShoppingBag size={19} color={isDark?c.background:'#fff'}/>}
          <Text style={[styles.white,{color:isDark?c.background:'#fff'}]}>{busy==='checkout'?'جارٍ تأكيد الطلب…':'تأكيد الطلبات'}</Text>
          {busy!=='checkout'&&<ChevronLeft size={19} color={isDark?c.background:'#fff'}/>}
        </Pressable>
        <Text style={[styles.hint,{color:c.muted,textAlign:'center'}]}>يمكنك متابعة كل طلب ومحادثته من صفحة «طلباتي».</Text>
      </View>}
    </ScrollView>
  </View>;
}
const styles=StyleSheet.create({
  wrap:{width:'100%',maxWidth:900,alignSelf:'center',paddingHorizontal:14,paddingTop:12,gap:13},
  banner:{paddingHorizontal:13,paddingVertical:11,borderWidth:1,borderRadius:16,flexDirection:'row-reverse',alignItems:'center',gap:10},
  bannerCount:{fontSize:11,fontWeight:'800'},
  cards:{width:'100%',flexDirection:'row-reverse',flexWrap:'wrap',justifyContent:'space-between',gap:12},
  skeletonList:{width:'100%',gap:12},
  skeletonBar:{height:13,borderRadius:8},
  card:{borderWidth:1,borderRadius:19,padding:14,gap:11},
  summaryCard:{borderWidth:1,borderRadius:19,padding:15,gap:13},
  summaryMain:{borderTopWidth:1,paddingTop:11,flexDirection:'row-reverse',alignItems:'center',justifyContent:'space-between',gap:10},
  summaryPrice:{fontSize:22,fontWeight:'800',textAlign:'right'},
  summaryTag:{flexDirection:'row-reverse',alignItems:'center',gap:6,paddingHorizontal:10,minHeight:34,borderRadius:12},
  heading:{fontSize:16,fontWeight:'800',textAlign:'right',lineHeight:24},
  label:{fontSize:13,fontWeight:'800',textAlign:'right'},
  hint:{fontSize:12,lineHeight:20,textAlign:'right'},
  price:{fontSize:17,fontWeight:'800',textAlign:'right'},
  white:{fontSize:14,fontWeight:'800',textAlign:'center'},
  productRow:{flexDirection:'row-reverse',alignItems:'center',gap:11,minHeight:70},
  productInfo:{flex:1,minWidth:0,gap:4,alignItems:'flex-end'},
  thumbnail:{width:70,height:70,borderRadius:15,overflow:'hidden'},
  locationRow:{flexDirection:'row-reverse',alignItems:'center',gap:4,width:'100%'},
  locationText:{fontSize:11.5,textAlign:'right',flexShrink:1},
  between:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'space-between',gap:10},
  itemControls:{borderTopWidth:1,paddingTop:10,flexDirection:'row-reverse',alignItems:'center',justifyContent:'space-between',gap:9},
  stepper:{borderWidth:1,borderRadius:14,flexDirection:'row-reverse',alignItems:'center',overflow:'hidden'},
  qtyButton:{width:44,minHeight:44,alignItems:'center',justifyContent:'center'},
  qtyValue:{fontSize:15,fontWeight:'800',minWidth:23,textAlign:'center'},
  unitTotal:{fontSize:12,fontWeight:'800',textAlign:'left'},
  buttons:{flexDirection:'row-reverse',alignItems:'center',flexWrap:'wrap',gap:7},
  chip:{minHeight:40,borderWidth:1,borderRadius:13,paddingHorizontal:12,paddingVertical:8,justifyContent:'center'},
  deliveryRow:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:9},
  singleDelivery:{minHeight:39,paddingHorizontal:10,borderRadius:13,flexDirection:'row-reverse',alignItems:'center',justifyContent:'center',gap:7,maxWidth:'77%'},
  deliveryLabel:{fontSize:12,fontWeight:'700',textAlign:'right',flexShrink:1},
  cardActions:{borderTopWidth:1,paddingTop:8,flexDirection:'row-reverse',alignItems:'center',justifyContent:'space-between',gap:9},
  inlineAction:{minHeight:44,flexDirection:'row-reverse',alignItems:'center',justifyContent:'center',gap:5,paddingHorizontal:5},
  link:{minHeight:44,flexDirection:'row-reverse',alignItems:'center',gap:7,paddingHorizontal:10,justifyContent:'center'},
  actionText:{fontSize:12,fontWeight:'800',textAlign:'center'},
  savedNote:{fontSize:11.5,lineHeight:20,textAlign:'right'},
  noteEditor:{gap:9},
  noteActions:{flexDirection:'row-reverse',alignItems:'center',gap:10},
  noteSave:{minHeight:44,borderRadius:13,paddingHorizontal:16,alignItems:'center',justifyContent:'center'},
  noteCancel:{minHeight:44,borderRadius:13,paddingHorizontal:14,alignItems:'center',justifyContent:'center'},
  input:{borderWidth:1,borderRadius:13,minHeight:65,maxHeight:124,padding:12,textAlignVertical:'top',fontSize:14},
  primary:{minHeight:53,borderRadius:16,flexDirection:'row-reverse',alignItems:'center',justifyContent:'center',gap:10,paddingHorizontal:14},
  center:{alignItems:'center',justifyContent:'center',gap:12,minHeight:112},
  notice:{padding:12,borderWidth:1,borderRadius:13,gap:8},
});
