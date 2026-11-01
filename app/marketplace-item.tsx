import { OasisPressable as Pressable, OasisSurface } from '@/components/oasis/OasisPrimitives';
import { OASIS, useTheme } from '@/lib/oasis';
import { HeaderAction, AppHeader } from '@/components/shared/AppHeader';
import React, { useCallback, useEffect, useState, useRef } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ArrowUpRight, MapPin, Package, Share2, ShoppingBag, UserRound, Heart, MessageCircle, ShieldCheck, Flag, CalendarDays, Tag, Ruler, Truck, Info, ZoomIn } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { AccountIdentityBadge } from '@/components/profile/AccountIdentityBadge';
import { ImagePreviewModal } from '@/components/shared/ImagePreviewModal';
import { getNeighborAccess } from '@/lib/neighborAccess';
import { parseProductDetails, productDisplayPrice } from '@/lib/productDetails';
import { ProductRequestSheet } from '@/components/market/ProductRequestSheet';
import { ProductEditorSheet } from '@/components/market/ProductEditorSheet';
import { useBottomNavInset } from '@/lib/bottomNav';
import {productContactState} from '@/lib/productContact';

export default function MarketplaceItemPage() {
  useTheme();const styles=createStyles();const revision=useRef(0);
  const bottom = useBottomNavInset(8);
  const [orderOpen, setOrderOpen] = useState(false), [imageFailed, setImageFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const params = useLocalSearchParams<{ id?: string }>();
  const itemId = Array.isArray(params.id) ? params.id[0] : params.id || '';
  const [item, setItem] = useState<any>(null);
  const [seller, setSeller] = useState<any>(null);
  const [business, setBusiness] = useState<any>(null);
  const [trust,setTrust]=useState<{verified:boolean;review_count:number;rating:number|null;review_subject:string|null}|null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [canMessage,setCanMessage]=useState(false),[canView,setCanView]=useState(false),[contactFailed,setContactFailed]=useState(false);
  const [imageOpen,setImageOpen]=useState(false);
  const [favorite,setFavorite]=useState(false);
  const [actionBusy,setActionBusy]=useState(false);
  const [actionError,setActionError]=useState('');

  const load = useCallback(async () => {
    const ticket=++revision.current;
    if (!itemId) { setLoading(false); setError(true); return; }
    setLoading(true); setError(false);
    setTrust(null);setSeller(null);setBusiness(null);setCanMessage(false);setCanView(false);setContactFailed(false);setImageOpen(false);setFavorite(false);setActionError('');setOrderOpen(false);setImageFailed(false);
    try {
      const { data, error: itemError } = await supabase
        .from('marketplace_items')
        .select('id,seller_id,business_id,title,description,price,item_type,city,district,image_url,status,created_at,updated_at,region')
        .eq('id', itemId)
        .maybeSingle();
      if(ticket!==revision.current)return;
      if (itemError) throw itemError;
      if (!data) { setItem(null); return; }
      setItem(data);
      const { data: auth } = await supabase.auth.getUser();
      setMe(auth.user?.id || null);
      if(ticket!==revision.current)return;
      const trustResult=auth.user?await supabase.rpc('hayna_product_trust',{p_item:data.id}):null;
      if(ticket!==revision.current)return;setTrust(trustResult?.error?null:trustResult?.data||null);
      let access={can_view:false,can_message:false,target_id:null as string|null};
      try{access=await getNeighborAccess(data.seller_id);}catch{if(ticket===revision.current)setContactFailed(true);}
      if(ticket!==revision.current)return;setCanView(access.can_view);
      setCanMessage(access.can_message);
      if(auth.user){const saved=await supabase.from('favorite_items').select('target_id').eq('user_id',auth.user.id).eq('target_type','product').eq('target_id',data.id).maybeSingle();if(!saved.error)setFavorite(!!saved.data);}
      if (data.business_id && access.can_view) {
        const { data: businessRow } = await supabase.from('businesses')
          .select('id,name,logo_url,is_verified,city,district')
          .eq('id', data.business_id).maybeSingle();
        if(ticket!==revision.current)return;setBusiness(businessRow || null);
      } else {
        setBusiness(null);
      }
      if (data.seller_id && access.can_view) {
        const { data: profile } = await supabase.from('profiles')
          .select('id,username,display_name,avatar_url,is_verified,account_type,freelance_trade,role,city,district')
          .eq('id', data.seller_id).maybeSingle();
        if(ticket!==revision.current)return;setSeller(profile || null);
      }
    } catch (e) {
      if(ticket!==revision.current)return;
      console.error('marketplace item load', e);
      setError(true);
    } finally { if(ticket===revision.current)setLoading(false); }
  }, [itemId]);

  useFocusEffect(useCallback(()=>{void load();return()=>{revision.current++;};},[load]));

  useEffect(()=>{
    if(!itemId)return;
    const channel=supabase.channel('product:'+itemId).on('postgres_changes',{event:'UPDATE',schema:'public',table:'marketplace_items',filter:'id=eq.'+itemId},payload=>{setItem((old:any)=>old?.id===itemId?{...old,...payload.new}:old);setOrderOpen(false);}).subscribe();
    const timer=setInterval(()=>{void supabase.from('marketplace_items').select('status,updated_at,price').eq('id',itemId).maybeSingle().then(({data,error})=>{if(!error)setItem((old:any)=>old?.id===itemId?(data?{...old,...data}:null):old);});},30000);
    return()=>{clearInterval(timer);void supabase.removeChannel(channel);};
  },[itemId]);

  async function toggleFavorite(){
    if(!me){router.push('/auth');return;}
    if(actionBusy)return;setActionBusy(true);setActionError('');
    try{const result=favorite?await supabase.from('favorite_items').delete().eq('user_id',me).eq('target_type','product').eq('target_id',itemId):await supabase.from('favorite_items').upsert({user_id:me,target_type:'product',target_id:itemId},{onConflict:'user_id,target_type,target_id',ignoreDuplicates:true});if(result.error)throw result.error;setFavorite(!favorite);}
    catch{setActionError('تعذر تحديث المفضلة. تحقق من الاتصال وأعد المحاولة.');}finally{setActionBusy(false);}
  }
  async function messageSeller(){
    if(actionBusy)return;setActionBusy(true);setActionError('');
    try{const access=await getNeighborAccess(item.seller_id);setCanMessage(access.can_message);if(!access.can_message)throw new Error('التواصل غير متاح حسب إعدادات صاحب الإعلان أو نطاق المنطقة.');const result=await supabase.rpc('hayna_get_or_create_direct_conversation',{p_target:item.seller_id});if(result.error||typeof result.data!=='string'||!result.data)throw new Error('تعذر تجهيز المحادثة. أعد المحاولة.');router.push({pathname:'/conversation',params:{id:result.data}});}
    catch(cause){setActionError((cause as Error).message||'تعذر فتح المحادثة.');}finally{setActionBusy(false);}
  }

  const share = async () => {
    if (!item) return;
    const url = `https://appksatest.vercel.app/marketplace-item?id=${encodeURIComponent(item.id)}`;
    try { await Share.share({ title: item.title || 'إعلان من سوق حيّنا', message: [item.title, item.description, url].filter(Boolean).join('\n') }); } catch {}
  };

  if (loading) return <View style={[styles.center, { backgroundColor: 'transparent' }]}><ActivityIndicator size="large" color={OASIS.colors.primary} /><Text style={styles.muted}>جارٍ تحميل الإعلان...</Text></View>;
  if (error || !item) return <View style={[styles.center, { backgroundColor: 'transparent' }]}><Package size={42} color="#94a3b8" /><Text style={styles.title}>{error ? 'تعذّر تحميل الإعلان' : 'الإعلان غير موجود'}</Text><Text style={styles.muted}>قد يكون الإعلان حُذف أو لم يعد متاحاً.</Text><Pressable oasisVariant="primary" oasisKind="action" style={styles.primary} onPress={() => error ? void load() : router.back()}><Text style={styles.primaryText}>{error ? 'إعادة المحاولة' : 'رجوع'}</Text></Pressable></View>;

  const details=parseProductDetails(item.description);
  const contact=productContactState({signedIn:!!me,own:me===item.seller_id,available:item.status==='available',canView,canMessage,failed:contactFailed});
  return <View style={[styles.screen, { backgroundColor: 'transparent' }]}>
    <ImagePreviewModal uri={imageOpen?item.image_url:null} title={item.title||'صورة المنتج'} onClose={()=>setImageOpen(false)}/>
    <AppHeader variant="sub" title="تفاصيل المنتج" fallbackRoute="/market" rightAction={<HeaderAction onPress={share} accessibilityRole="button" accessibilityLabel="مشاركة الإعلان" style={styles.share}><Share2 size={18} color={OASIS.colors.primary} /></HeaderAction>} />
    <ProductRequestSheet visible={orderOpen} item={item} userId={me} onClose={()=>setOrderOpen(false)}/>
    <ProductEditorSheet item={editing?item:null} onClose={()=>setEditing(false)} onSaved={()=>void load()}/>
    <ScrollView contentContainerStyle={[styles.page,{paddingBottom:bottom+120}]}>
      {item.image_url && !imageFailed ? <Pressable accessibilityRole="button" accessibilityLabel="عرض صورة المنتج كاملة" onPress={()=>setImageOpen(true)} style={styles.imageFrame}><Image source={{ uri: item.image_url }} style={styles.image} onError={()=>setImageFailed(true)} resizeMode="contain"/><View style={styles.zoomBadge}><ZoomIn size={16} color="#fff"/><Text style={{color:'#fff',fontSize:11}}>عرض الصورة كاملة</Text></View></Pressable> : <View style={styles.imageFallback}><ShoppingBag size={42} color={OASIS.colors.primary} /><Text style={styles.muted}>إعلان من سوق الحي</Text></View>}
      <OasisSurface oasisSurface="card" style={styles.card}>
        <View style={styles.row}><View style={styles.typePill}><Text style={styles.typeText}>{item.item_type || 'إعلان'}</Text></View><Text style={[styles.status,{color:item.status==='available'?OASIS.colors.primary:OASIS.colors.muted}]}>{item.status === 'available' ? 'متاح' : item.status === 'reserved' ? 'محجوز' : item.status === 'sold' ? 'تم البيع' : 'غير متاح'}</Text></View>
        <Text style={styles.title}>{item.title || 'إعلان بدون عنوان'}</Text>
        <Text style={styles.price}>{productDisplayPrice(item.price,item.item_type)}</Text>
        {item.updated_at&&<Text style={styles.muted}>آخر تحديث: {new Date(item.updated_at).toLocaleDateString('ar-SA')}</Text>}
        <View style={styles.location}><CalendarDays size={15} color={OASIS.colors.muted}/><Text style={styles.muted}>{new Date(item.created_at).toLocaleDateString('ar-SA',{day:'numeric',month:'long',year:'numeric'})}</Text></View>
        {(item.city || item.district) && <View style={styles.location}><MapPin size={16} color={OASIS.colors.muted} /><Text style={styles.muted}>{[item.district && `حي ${item.district}`, item.city].filter(Boolean).join(' · ')}</Text></View>}
      </OasisSurface>
      <OasisSurface oasisSurface="card" style={styles.card}><View style={styles.location}><MessageCircle size={22} color={OASIS.colors.primary}/><Text style={styles.sellerTitle}>التواصل وطلب المنتج</Text></View><Text accessibilityLiveRegion="polite" style={styles.description}>{contact.reason}</Text>{contact.action==='request'?<View style={styles.actions}><Pressable accessibilityRole="button" disabled={actionBusy} onPress={()=>void messageSeller()} style={styles.messageAction}><MessageCircle size={19} color="#fff"/><Text style={{color:'#fff',fontWeight:'700'}}>مراسلة البائع</Text></Pressable><Pressable accessibilityRole="button" onPress={()=>setOrderOpen(true)} style={styles.secondaryAction}><ShoppingBag size={19} color={OASIS.colors.primary}/><Text style={styles.manageBtnText}>إرسال طلب المنتج</Text></Pressable></View>:contact.action==='signin'?<Pressable accessibilityRole="button" onPress={()=>router.push('/auth')} style={styles.messageAction}><UserRound size={19} color="#fff"/><Text style={{color:'#fff',fontWeight:'700'}}>تسجيل الدخول للتواصل</Text></Pressable>:contact.action==='retry'||contact.action==='restricted'?<Pressable accessibilityRole="button" onPress={()=>void load()} style={styles.secondaryAction}><ShieldCheck size={18} color={OASIS.colors.primary}/><Text style={styles.manageBtnText}>إعادة التحقق من الصلاحية</Text></Pressable>:null}</OasisSurface>
      <OasisSurface oasisSurface="card" style={styles.card}><View style={styles.location}><Package size={18} color={OASIS.colors.primary}/><Text style={styles.sellerTitle}>عن المنتج</Text></View><Text style={styles.description}>{details.body||'لم يضف صاحب الإعلان وصفًا تفصيليًا.'}</Text>{details.specs.map((spec,index)=><View key={spec.label+index} style={styles.specRow}>{spec.label==='المقاسات'?<Ruler size={17} color={OASIS.colors.primary}/>:spec.label==='الاستلام'?<Truck size={17} color={OASIS.colors.primary}/>:<Tag size={17} color={OASIS.colors.primary}/>}<Text style={styles.muted}>{spec.label}</Text><Text style={[styles.description,{flex:1}]}>{spec.value}</Text></View>)}</OasisSurface>
      <View style={styles.actions}>{me!==item.seller_id&&<Pressable accessibilityRole="button" accessibilityLabel={favorite?'إزالة المنتج من المفضلة':'حفظ المنتج في المفضلة'} disabled={actionBusy} onPress={()=>void toggleFavorite()} style={styles.secondaryAction}><Heart size={18} color={favorite?OASIS.colors.danger:OASIS.colors.primary} fill={favorite?OASIS.colors.danger:'none'}/><Text style={styles.manageBtnText}>{favorite?'محفوظ':'حفظ الإعلان'}</Text></Pressable>}</View>
      {!!actionError&&<Text accessibilityRole="alert" style={[styles.muted,{color:OASIS.colors.danger}]}>{actionError}</Text>}

      <OasisSurface oasisSurface="card" style={styles.card}><View style={styles.location}><ShieldCheck size={20} color={OASIS.colors.primary}/><Text style={styles.sellerTitle}>موثوقية البائع</Text></View><Text style={styles.description}>{trust?.verified?'حساب موثّق في حيّنا':trust?'الحساب غير موثّق':'تعذر التحقق من التوثيق حاليًا'}</Text><Text style={styles.muted}>{trust?.review_subject==='business'?(trust.review_count>0?`تقييم المنشأة: ${trust.rating} من ٥ · ${trust.review_count.toLocaleString('ar-SA')} مراجعة فعلية`:'لا توجد تقييمات للمنشأة بعد'):'لا يتوفر سجل تقييمات مرتبط بهذا المنتج؛ لا يمثل التوثيق ضمانًا للمنتج.'}</Text>{item.business_id&&trust?.review_subject==='business'&&<Pressable accessibilityRole="button" onPress={()=>router.push({pathname:'/business',params:{id:item.business_id}})} style={styles.secondaryAction}><Text style={styles.manageBtnText}>عرض المنشأة ومراجعاتها</Text></Pressable>}</OasisSurface>
      {business && <Pressable oasisKind="card" style={styles.sellerCard} onPress={() => router.push({ pathname: '/business', params: { id: business.id } })}>
        {business.logo_url ? <Image source={{ uri: business.logo_url }} style={styles.avatar} /> : <View style={styles.avatarFallback}><ShoppingBag size={20} color="#b7791f" /></View>}
        <View style={styles.sellerCopy}><Text style={styles.sellerTitle}>{business.name}</Text><Text style={styles.muted}>{business.is_verified ? 'منشأة موثقة في حيّنا' : 'عرض صفحة المنشأة'}</Text></View>
        <ArrowUpRight size={18} color="#b7791f" />
      </Pressable>}
      {seller && <Pressable oasisKind="card" style={styles.sellerCard} onPress={() => router.push({ pathname: '/user', params: { id: seller.id } })}>
        {seller.avatar_url ? <Image source={{ uri: seller.avatar_url }} style={styles.avatar} /> : <View style={styles.avatarFallback}><UserRound size={20} color={OASIS.colors.primary} /></View>}
        <View style={styles.sellerCopy}>
          <Text style={styles.sellerTitle}>{seller.account_type === 'merchant' && seller.freelance_trade ? seller.freelance_trade : seller.display_name || seller.username || 'صاحب الإعلان'}</Text>
          <View style={styles.sellerBadges}>
            <AccountIdentityBadge role={seller.role} accountType={seller.account_type} isVerified={Boolean(seller.is_verified)} compact />
          </View>
        </View>
        <ArrowUpRight size={18} color={OASIS.colors.primary} />
      </Pressable>}
      {me === item.seller_id && <Pressable oasisKind="action" style={styles.manageBtn} onPress={() => router.push({ pathname: '/profile', params: { tab: 'content' } })}><Text style={styles.manageBtnText}>إدارة من حسابي</Text></Pressable>}
      <OasisSurface oasisSurface="card" style={styles.card}><View style={styles.location}><Info size={17} color={OASIS.colors.primary}/><Text style={[styles.muted,{flex:1}]}>الموقع المعروض عام: المدينة والحي فقط. اتفق على نقطة التسليم الدقيقة داخل المحادثة الخاصة، ولا تنشر عنوان منزلك في الإعلان.</Text></View></OasisSurface>
      <OasisSurface oasisSurface="card" style={styles.card}><View style={styles.location}><ShoppingBag size={18} color={OASIS.colors.primary}/><Text style={styles.sellerTitle}>كيف أطلب المنتج؟</Text></View><Text style={styles.description}>١. أرسل الكمية والملاحظات للبائع.{"\n"}٢. اتفقا على التوفر والسعر والتسليم.{"\n"}٣. تأكد من المنتج قبل إتمام الاتفاق.</Text><Text style={styles.muted}>الطلب عبر المحادثة، ولا يمثل حجزًا للمخزون أو عملية دفع داخل التطبيق.</Text></OasisSurface>
      <Pressable accessibilityRole="button" onPress={()=>router.push({pathname:'/report',params:{type:'product',id:item.id}})} style={{minHeight:44,flexDirection:'row-reverse',alignItems:'center',justifyContent:'center',gap:7}}><Flag size={15} color={OASIS.colors.muted}/><Text style={styles.muted}>الإبلاغ عن الإعلان</Text></Pressable>
    </ScrollView>
    <View pointerEvents="box-none" style={{position:'absolute',left:0,right:0,bottom,alignItems:'center'}}>
      <OasisSurface oasisSurface="card" style={{width:'92%',maxWidth:828,borderRadius:22,borderWidth:1,borderColor:OASIS.colors.line,padding:12,flexDirection:'row-reverse',alignItems:'center',gap:12}}>
        <View style={{flex:1,gap:4}}><Text style={styles.muted}>{me===item.seller_id?'هذا منتجك':'السعر المعلن'}</Text><Text style={[styles.price,{fontSize:16}]}>{productDisplayPrice(item.price,item.item_type)}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel={contact.label} accessibilityHint={contact.reason} disabled={contact.action==='restricted'||contact.action==='unavailable'} onPress={()=>{if(me===item.seller_id)setEditing(true);else if(!me)router.push('/auth');else if(contact.action==='retry')void load();else setOrderOpen(true);}} style={[styles.messageAction,{flex:1,opacity:contact.action==='restricted'||contact.action==='unavailable'? .45:1,borderRadius:16}]}><ShoppingBag size={19} color="#fff"/><Text style={{color:'#fff',fontWeight:'800',fontSize:13,flexShrink:1,textAlign:'center'}}>{contact.label}</Text></Pressable>
      </OasisSurface>
    </View>
  </View>;
}

const createStyles = () => StyleSheet.create({
  imageFrame:{position:'relative',borderRadius:22,overflow:'hidden',backgroundColor:OASIS.colors.surface,borderWidth:1,borderColor:OASIS.colors.line},
  zoomBadge:{position:'absolute',bottom:12,left:12,borderRadius:16,backgroundColor:'rgba(4,45,32,.85)',paddingHorizontal:10,paddingVertical:7,flexDirection:'row-reverse',alignItems:'center',gap:6},
  specRow:{flexDirection:'row-reverse',alignItems:'center',gap:10,paddingVertical:10,borderTopWidth:1,borderTopColor:OASIS.colors.line},
  actions:{flexDirection:'row-reverse',flexWrap:'wrap',gap:10},
  secondaryAction:{minHeight:48,borderRadius:24,paddingHorizontal:18,flexDirection:'row-reverse',gap:8,alignItems:'center',justifyContent:'center',backgroundColor:OASIS.colors.surface,borderWidth:1,borderColor:OASIS.colors.line},
  messageAction:{minHeight:48,borderRadius:24,paddingHorizontal:18,flex:1,flexDirection:'row-reverse',gap:8,alignItems:'center',justifyContent:'center',backgroundColor:OASIS.colors.primary},
  screen:{flex:1,backgroundColor:OASIS.colors.background},page:{padding:16,paddingBottom:24,gap:14,width:'100%',maxWidth:860,alignSelf:'center'},
  center:{flex:1,alignItems:'center',justifyContent:'center',gap:10,padding:16,backgroundColor:OASIS.colors.background},muted:{fontSize:12,color:OASIS.colors.muted,textAlign:'right',lineHeight:19},
  title:{fontSize:21,fontWeight:'700',color:OASIS.colors.ink,textAlign:'right',lineHeight:31},image:{width:'100%',height:260,borderRadius:18,backgroundColor:OASIS.colors.line},imageFallback:{height:190,borderRadius:18,backgroundColor:OASIS.colors.soft,alignItems:'center',justifyContent:'center',gap:8},
  card:{backgroundColor:OASIS.colors.surface,borderRadius:14,borderWidth:1,borderColor:OASIS.colors.line,padding:18,gap:12},row:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'space-between'},typePill:{backgroundColor:OASIS.colors.soft,paddingHorizontal:10,paddingVertical:5,borderRadius:9},typeText:{fontSize:11,fontWeight:'600',color:OASIS.colors.primary},status:{fontSize:11,color:OASIS.colors.muted,fontWeight:'700'},
  price:{fontSize:19,fontWeight:'700',color:OASIS.colors.primary,textAlign:'right'},description:{fontSize:14,lineHeight:25,color:OASIS.colors.ink,textAlign:'right'},location:{flexDirection:'row-reverse',alignItems:'center',gap:7,paddingTop:6},
  sellerCard:{flexDirection:'row-reverse',alignItems:'center',gap:12,padding:14,borderRadius:16,backgroundColor:OASIS.colors.surface,borderWidth:1,borderColor:OASIS.colors.line},avatar:{width:44,height:44,borderRadius:22},avatarFallback:{width:44,height:44,borderRadius:22,backgroundColor:OASIS.colors.soft,alignItems:'center',justifyContent:'center'},sellerCopy:{flex:1,gap:4,alignItems:'flex-end'},sellerTitle:{fontSize:14,fontWeight:'700',color:OASIS.colors.ink,textAlign:'right'},sellerBadges:{flexDirection:'row-reverse',gap:4,flexWrap:'wrap'},manageBtn:{paddingVertical:12,borderRadius:13,backgroundColor:OASIS.colors.soft,alignItems:'center'},manageBtnText:{color:OASIS.colors.primary,fontWeight:'700',fontSize:12},share:{width:38,height:38,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:OASIS.colors.soft},primary:{paddingHorizontal:20,paddingVertical:12,borderRadius:12,backgroundColor:OASIS.colors.primary},primaryText:{color:OASIS.colors.surface,fontWeight:'700'}
});
