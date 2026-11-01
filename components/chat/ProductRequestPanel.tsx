import React,{useCallback,useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Text,View} from 'react-native';
import {CheckCircle2,Clock,Edit3,History,PackageCheck,RefreshCw,ShieldCheck,XCircle} from 'lucide-react-native';
import {router} from 'expo-router';
import {OasisPressable as Pressable} from '@/components/oasis/OasisPrimitives';
import {OASIS,useTheme} from '@/lib/oasis';
import {supabase} from '@/lib/supabase';
import {ProductRequestRecord,productRequestActions,productRequestError,productRequestLabels,productRequestEventLabels} from '@/lib/productRequestWorkflow';
import {productRequestTotal} from '@/lib/productRequest';
import {ConfirmActionModal} from '@/components/shared/ConfirmActionModal';
import {ProductRequestSheet} from '@/components/market/ProductRequestSheet';

const actionLabels:Record<string,string>={revise:'مراجعة وتعديل',accept:'قبول وحجز المنتج',reject:'الاعتذار عن الطلب',ready:'جاهز للاستلام',complete:'تأكيد استلام المنتج',cancel:'إلغاء الطلب'};
const explanations:Record<string,string>={accept:'سيُحجز المنتج لهذا الطلب ويُمنع قبول طلب آخر عليه. راجع الكمية وطريقة التسليم والمبلغ مع المشتري؛ هذا ليس تأكيدًا للدفع.',reject:'سيُغلق هذا الطلب مع حفظ المحادثة وسجل المراجعة. لن تتغير حالة المنتج.',ready:'أكّد هذه الخطوة عندما يكون المنتج جاهزًا للتسليم حسب اتفاقكما. يؤكد المشتري الاستلام بنفسه.',complete:'أكّد فقط بعد استلام المنتج فعلًا وفحصه. ستُغلق المتابعة وتصبح حالة المنتج مباعًا، دون تسجيل دفعة.',cancel:'سيُغلق الطلب مع حفظ سجلّه. يُرفع حجز هذا الطلب إن كان محجوزًا. الإلغاء لا ينفّذ استردادًا ماليًا.'};
type RequestEvent={id:string;action:string;version:number;created_at:string;snapshot:{quantity:number;unit_price:number|null;fulfillment:string;note:string;status:string}};
export function ProductRequestPanel({messageId,userId,isBuyerMessage,product,requestId,onRefreshProduct}:{messageId:string;userId:string;isBuyerMessage:boolean;product:any|null;requestId?:string;onRefreshProduct?:()=>void}){
 useTheme();const c=OASIS.colors;
 const [record,setRecord]=useState<ProductRequestRecord|null>(null),[events,setEvents]=useState<RequestEvent[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(false),[confirm,setConfirm]=useState<string|null>(null),[editing,setEditing]=useState(false),[history,setHistory]=useState(false);
 const lock=useRef(false),revision=useRef(0);
 const load=useCallback(async()=>{
  const ticket=++revision.current;
  if(!/^[0-9a-f-]{36}$/i.test(messageId)){setLoading(false);return;}
  try{
   const result=await supabase.from('marketplace_product_requests').select('*').eq(requestId?'id':'message_id',requestId||messageId).maybeSingle();
   if(ticket!==revision.current)return;if(result.error)throw result.error;setRecord(result.data);setError('');
   if(result.data){const changes=await supabase.from('marketplace_product_request_events').select('id,action,version,created_at,snapshot').eq('request_id',result.data.id).order('version',{ascending:false}).limit(12);if(ticket!==revision.current)return;if(changes.error)setError('تعذر تحديث سجل التغييرات. حدّث البطاقة.');else setEvents(changes.data||[]);}
  }catch{if(ticket===revision.current)setError('تعذر تحميل متابعة الطلب. تحقق من الاتصال وحدّث البطاقة.');}
  finally{if(ticket===revision.current)setLoading(false);}
 },[messageId,requestId]);
 useEffect(()=>{
  setRecord(null);setEvents([]);setLoading(true);void load();
  const channel=supabase.channel('product-request:'+messageId).on('postgres_changes',{event:'*',schema:'public',table:'marketplace_product_requests',filter:requestId?'id=eq.'+requestId:'message_id=eq.'+messageId},()=>void load()).subscribe();
  // Reconnect and inactive tabs can miss updates; version checking still protects every action.
  const timer=setInterval(()=>void load(),30000);
  return()=>{revision.current++;clearInterval(timer);void supabase.removeChannel(channel);};
 },[load,messageId,requestId]);
 async function act(){
  if(!record||!confirm||lock.current)return;lock.current=true;setBusy(true);setError('');
  try{const result=await supabase.rpc('hayna_update_product_request',{p_request:record.id,p_version:record.version,p_action:confirm});if(result.error)throw result.error;setConfirm(null);await load();}
  catch(cause){setError(productRequestError(cause));}
  finally{lock.current=false;setBusy(false);}
 }
 const button=(label:string,onPress:()=>void,Icon:any=RefreshCw,primary=false,danger=false)=><Pressable key={label} disabled={busy} accessibilityRole="button" onPress={onPress} style={{minHeight:44,borderRadius:12,paddingHorizontal:12,paddingVertical:9,flexDirection:'row-reverse',gap:7,alignItems:'center',justifyContent:'center',backgroundColor:primary?c.primary:danger?c.dangerSoft:c.soft}}><Icon size={16} color={primary?'#fff':danger?c.danger:c.primary}/><Text style={{color:primary?'#fff':danger?c.danger:c.primary,fontSize:12,fontWeight:'700'}}>{label}</Text></Pressable>;
 if(loading)return <ActivityIndicator accessibilityLabel="تحميل متابعة الطلب" color={c.primary}/>;
 if(!record)return <View style={{gap:8}}>{!!error&&<Text accessibilityRole="alert" style={{color:c.danger,fontSize:12,textAlign:'right'}}>{error}</Text>}{error?button('إعادة تحميل المتابعة',()=>void load()):isBuyerMessage&&product?.status==='available'?<><Text style={{color:c.muted,fontSize:12,textAlign:'right',lineHeight:21}}>هذا الطلب أُرسل قبل تفعيل المتابعة. راجع تفاصيله لتحويله إلى طلب قابل للتعديل والمتابعة دون تكرار الرسالة.</Text>{button('مراجعة وتنظيم الطلب السابق',()=>setEditing(true),Edit3,true)}</>:<Text style={{color:c.muted,fontSize:11,textAlign:'right'}}>رسالة طلب سابقة؛ الاتفاق محفوظ في المحادثة.</Text>}<ProductRequestSheet visible={editing} item={product} userId={userId} requestIdOverride={messageId} onClose={()=>setEditing(false)} onSubmitted={()=>void load()}/></View>;
 const actions=productRequestActions(record,userId),terminal=['completed','rejected','cancelled'].includes(record.status);
 const total=productRequestTotal(record.unit_price,record.quantity);
 const priceChanged=product&&((record.unit_price==null)!==(product.price==null)||record.unit_price!=null&&Number(record.unit_price)!==Number(product.price));
 return <View style={{gap:12,borderTopWidth:1,borderTopColor:c.line,paddingTop:12}}>
  <View style={{flexDirection:'row-reverse',gap:7,alignItems:'center'}}>{terminal?<CheckCircle2 size={19} color={c.primary}/>:<Clock size={19} color={c.primary}/>}<Text accessibilityLiveRegion="polite" style={{flex:1,color:c.ink,fontWeight:'800',textAlign:'right'}}>{productRequestLabels[record.status]}</Text></View>
  {!['cancelled','rejected'].includes(record.status)&&<View style={{flexDirection:'row-reverse',gap:5}}>{(['pending','accepted','ready','completed'] as const).map((step,index)=>{const reached=index<=['pending','accepted','ready','completed'].indexOf(record.status);return <View key={step} style={{flex:1,height:4,borderRadius:3,backgroundColor:reached?c.primary:c.line}}/>;})}</View>}
  <View style={{backgroundColor:c.soft,borderRadius:13,padding:11,gap:7}}><Text style={{color:c.ink,textAlign:'right'}}>الكمية: {record.quantity.toLocaleString('ar-SA')} · {record.fulfillment}</Text><Text style={{color:c.primary,fontWeight:'800',textAlign:'right'}}>{total==null?'السعر بالاتفاق':new Intl.NumberFormat('ar-SA',{style:'currency',currency:'SAR'}).format(total/100)} · قبل رسوم التسليم</Text>{!!record.note&&<Text selectable style={{color:c.ink,fontSize:12,lineHeight:22,textAlign:'right'}}>ملاحظات المشتري: {record.note}</Text>}<Text style={{color:c.muted,fontSize:10,textAlign:'right'}}>نسخة {record.version.toLocaleString('ar-SA')} · آخر تحديث {new Date(record.updated_at).toLocaleString('ar-SA')}</Text></View>
  {priceChanged&&!terminal&&<Text style={{color:c.danger,fontSize:12,lineHeight:22,textAlign:'right'}}>تغيّر سعر الإعلان. المبلغ أعلاه هو مبلغ نسخة الطلب؛ يجب على المشتري مراجعة السعر قبل قبول طلب معلّق.</Text>}
  <View style={{flexDirection:'row-reverse',gap:7,alignItems:'center'}}><ShieldCheck size={16} color={c.primary}/><Text style={{flex:1,color:c.muted,fontSize:11,textAlign:'right',lineHeight:20}}>متابعة الطلب لا تمثل تأكيد دفع. اتفقا على تكلفة التسليم ونقطة الالتقاء بالخاص.</Text></View>
  {actions.map(action=>button(actionLabels[action],()=>{setError('');if(action==='revise'){if(product)setEditing(true);else setError('تعذر تحميل المنتج للمراجعة. حدّث البطاقة أولًا.');}else setConfirm(action);},action==='revise'?Edit3:action==='cancel'||action==='reject'?XCircle:PackageCheck,['accept','ready','complete'].includes(action),['cancel','reject'].includes(action)))}
  {!!error&&<Text accessibilityRole="alert" style={{color:c.danger,fontSize:12,textAlign:'right'}}>{error}</Text>}
  <View style={{flexDirection:'row-reverse',gap:8}}>{button(history?'إخفاء السجل':'سجل التغييرات',()=>setHistory(!history),History)}{button('تحديث',()=>{void load();onRefreshProduct?.();})}</View>
  {history&&events.map(event=><View key={event.id} style={{borderRightWidth:2,borderRightColor:c.line,paddingRight:9,gap:3}}><Text style={{color:c.ink,fontSize:12,textAlign:'right'}}>{productRequestEventLabels[event.action]||'تحديث الطلب'} · نسخة {event.version}</Text><Text style={{color:c.muted,fontSize:10,textAlign:'right'}}>{new Date(event.created_at).toLocaleString('ar-SA')}</Text>{event.action==='revise'&&<Text style={{color:c.muted,fontSize:11,textAlign:'right'}}>الكمية {event.snapshot.quantity} · {event.snapshot.fulfillment}{event.snapshot.note?' · '+event.snapshot.note:''}</Text>}</View>)}
  {record.status==='completed'&&product?.business_id&&record.buyer_id===userId&&button('عرض المنشأة وتقييم تجربتك',()=>router.push({pathname:'/business',params:{id:product.business_id}}),CheckCircle2)}
  <ProductRequestSheet visible={editing} item={product} userId={userId} existingRequest={record} onClose={()=>setEditing(false)} onSubmitted={()=>void load()}/>
  <ConfirmActionModal visible={!!confirm} title={actionLabels[confirm||'']||'تحديث الطلب'} description={(explanations[confirm||'']||'')+'\nالكمية: '+record.quantity+' · '+record.fulfillment} confirmLabel={actionLabels[confirm||'']||'تأكيد'} destructive={confirm==='cancel'||confirm==='reject'} busy={busy} error={error} onCancel={()=>{if(!busy)setConfirm(null);}} onConfirm={()=>void act()}/>
 </View>;
}
