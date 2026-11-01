import React,{useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,Alert,Image,RefreshControl,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {useLocalSearchParams,router} from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import {AppHeader} from '@/components/shared/AppHeader';
import {OasisPressable as Pressable} from '@/components/oasis/OasisPrimitives';
import {supabase} from '@/lib/supabase';
import {useTheme} from '@/context/ThemeContext';

type OrderKind='service'|'product';
type Ticket={id:string;ticket_number:number;category:string;status:string;description:string;created_at:string};
type Message={id:string;sender_id:string;is_admin:boolean;body:string;created_at:string};
type Attachment={id:string;storage_path:string};
const statusNames:Record<string,string>={pending:'بانتظار موافقة البائع',pending_payment:'بانتظار الدفع',paid:'تم الدفع',accepted:'مقبول',in_progress:'قيد التنفيذ',ready:'جاهز للاستلام',completed:'مكتمل',rejected:'مرفوض',cancelled:'ملغي',refunded:'مسترد',payment_failed:'فشل الدفع'};
const disputeKinds:Record<string,string>={delay:'تأخير التسليم',quality:'جودة المنتج أو الخدمة',not_received:'لم أستلم الطلب',incorrect_details:'اختلاف التفاصيل',payment:'مشكلة دفع',other:'مشكلة أخرى'};
const steps:Record<OrderKind,string[]>={service:['paid','accepted','in_progress','ready','completed'],product:['pending','accepted','ready','completed']};
const date=(value:string)=>new Date(value).toLocaleString('ar-SA',{dateStyle:'medium',timeStyle:'short'});
function bytesFromBase64(value:string):Uint8Array{
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
 const clean=value.replace(/[^A-Za-z0-9+/]/g,'');
 const out:number[]=[];let buffer=0,bits=0;
 for(const c of clean){const n=alphabet.indexOf(c);if(n<0)continue;buffer=(buffer<<6)|n;bits+=6;if(bits>=8){bits-=8;out.push((buffer>>bits)&255);}}
 return new Uint8Array(out);
}
async function uploadPhoto(bucket:string,path:string,asset:ImagePicker.ImagePickerAsset){
 if(!asset.base64)throw new Error('تعذرت قراءة الصورة. اختر صورة أخرى.');
 const data=bytesFromBase64(asset.base64);
 if(data.byteLength>5242880)throw new Error('حجم الصورة يجب ألا يتجاوز 5 ميجابايت.');
 const type=asset.mimeType==='image/png'?'image/png':asset.mimeType==='image/webp'?'image/webp':'image/jpeg';
 const {error}=await supabase.storage.from(bucket).upload(path,data,{contentType:type,upsert:false});
 if(error)throw error;
 return path;
}
export default function OrderDetails(){
 const {id,kind:rawKind}=useLocalSearchParams<{id?:string;kind?:string}>();
 const kind:OrderKind=rawKind==='product'?'product':'service';
 const {colors:c}=useTheme();
 const [uid,setUid]=useState(''),[order,setOrder]=useState<any>(null),[review,setReview]=useState<any>(null),[reply,setReply]=useState<any>(null);
 const [tickets,setTickets]=useState<Ticket[]>([]),[history,setHistory]=useState<any[]>([]);
 const [messages,setMessages]=useState<Message[]>([]),[attachments,setAttachments]=useState<Attachment[]>([]);
 const [ticket,setTicket]=useState<Ticket|null>(null),[signed,setSigned]=useState<Record<string,string>>({});
 const [loading,setLoading]=useState(true),[refreshing,setRefreshing]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [stars,setStars]=useState(5),[comment,setComment]=useState(''),[photos,setPhotos]=useState<ImagePicker.ImagePickerAsset[]>([]);
 const [sellerReply,setSellerReply]=useState(''),[reportReason,setReportReason]=useState('');
 const [editingReply,setEditingReply]=useState(false),[deliveryWhen,setDeliveryWhen]=useState(''),[deliveryNote,setDeliveryNote]=useState('');
 const [inApp,setInApp]=useState(true),[push,setPush]=useState(true);
 const [category,setCategory]=useState('delay'),[description,setDescription]=useState(''),[message,setMessage]=useState(''),[casePhotos,setCasePhotos]=useState<ImagePicker.ImagePickerAsset[]>([]);
 const field=kind==='service'?'service_order_id':'product_request_id';
 const load=useCallback(async()=>{
  if(!id)return;
  setError('');
  try{
   const {data:auth,error:authError}=await supabase.auth.getUser();
   if(authError||!auth.user){router.replace('/auth');return;}
   setUid(auth.user.id);
   const table=kind==='service'?'marketplace_service_orders':'marketplace_product_requests';
   const {data:orderRow,error:orderError}=await supabase.from(table).select('*').eq('id',id).maybeSingle();
   if(orderError)throw orderError;
   if(!orderRow){setError('الطلب غير موجود أو ليس لديك صلاحية عرضه.');setOrder(null);return;}
   setOrder(orderRow);
   setDeliveryWhen(orderRow.scheduled_delivery_at?new Date(orderRow.scheduled_delivery_at).toISOString().slice(0,16):'');setDeliveryNote(orderRow.delivery_note||'');
   const prefs=await supabase.from('order_notification_preferences').select('in_app_enabled,push_enabled').eq('user_id',auth.user.id).maybeSingle();
   if(!prefs.error){setInApp(prefs.data?.in_app_enabled!==false);setPush(prefs.data?.push_enabled!==false);}
   const [rv,ds,hs]=await Promise.all([
    supabase.from('order_reviews').select('*').eq(field,id).maybeSingle(),
    supabase.from('order_disputes').select('id,ticket_number,category,status,description,created_at').eq(field,id).order('created_at',{ascending:false}),
    supabase.from('order_status_history').select('id,old_status,new_status,created_at').eq(field,id).order('created_at',{ascending:true})
   ]);
   if(rv.error||ds.error||hs.error)throw rv.error||ds.error||hs.error;
   setReview(rv.data);setTickets((ds.data||[]) as Ticket[]);setHistory(hs.data||[]);
   if(rv.data){
    const rr=await supabase.from('review_replies').select('*').eq('review_id',rv.data.id).maybeSingle();
    if(rr.error)throw rr.error;setReply(rr.data);
   }else setReply(null);
  }catch(e:any){setError(e?.message||'تعذر تحميل تفاصيل الطلب.');}
  finally{setLoading(false);setRefreshing(false);}
 },[id,kind,field]);
 const loadTicket=useCallback(async(t:Ticket)=>{
  setTicket(t);setSigned({});const [m,a]=await Promise.all([
   supabase.from('dispute_messages').select('id,sender_id,is_admin,body,created_at').eq('dispute_id',t.id).order('created_at',{ascending:true}),
   supabase.from('dispute_attachments').select('id,storage_path').eq('dispute_id',t.id).order('created_at')
  ]);
  if(m.error||a.error){setError(m.error?.message||a.error?.message||'تعذر تحميل التذكرة.');return;}
  setMessages((m.data||[]) as Message[]);setAttachments((a.data||[]) as Attachment[]);
  const files=await Promise.all((a.data||[]).map(async x=>{
   const result=await supabase.storage.from('order-dispute-files').createSignedUrl(x.storage_path,300);
   return [x.storage_path,result.data?.signedUrl||''] as const;
  }));
  setSigned(Object.fromEntries(files));
 },[]);
 useEffect(()=>{void load();},[load]);
 async function run(action:()=>Promise<void>){
  if(busy)return;setBusy(true);setError('');setNotice('');
  try{await action();await load();}catch(e:any){setError(e?.message||'تعذر تنفيذ العملية.');}
  finally{setBusy(false);}
 }
 const buyerId=order?.buyer_id;
 const sellerId=kind==='service'?order?.provider_id:order?.seller_id;
 const isBuyer=uid!==''&&uid===buyerId;
 const isSeller=uid!==''&&uid===sellerId;
 const completed=order?.status==='completed';
 const label=order?.service_name||order?.item_title||'طلب السوق';
 async function changeStatus(action:string){
  await run(async()=>{
   const res=action==='ready'?await supabase.rpc('hayna_order_mark_ready',{p_order:id}):
    action==='received'?await supabase.rpc('hayna_order_confirm_received',{p_order:id}):
    await supabase.rpc('hayna_manage_marketplace',{p_kind:'service_order',p_id:id,p_action:action});
   if(res.error)throw res.error;
   setNotice('تم تحديث حالة الطلب.');
  });
 }
 async function productAction(next:'accept'|'ready'|'complete'|'reject'|'cancel'){
  await run(async()=>{
   const result=await supabase.rpc('hayna_update_product_request',{p_request:id,p_version:order.version,p_action:next});
   if(result.error)throw result.error;
   setNotice('تم تحديث حالة طلب المنتج.');
  });
 }
 async function chooseImages(dispute=false){
  const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],allowsMultipleSelection:true,selectionLimit:3,quality:0.7,base64:true});
  if(!result.canceled){const items=result.assets.slice(0,3);if(dispute)setCasePhotos(items);else setPhotos(items);}
 }
 async function submitReview(){
  await run(async()=>{
   const paths:string[]=[];
   for(const a of photos){
    const ext=a.mimeType==='image/png'?'png':a.mimeType==='image/webp'?'webp':'jpg';
    paths.push(await uploadPhoto('order-review-images',uid+'/'+Date.now()+'-'+Math.random().toString(36).slice(2)+'.'+ext,a));
   }
   const {error:e}=await supabase.from('order_reviews').insert({[field]:id,buyer_id:uid,seller_id:sellerId,rating:stars,body:comment.trim(),photo_paths:paths});
   if(e)throw e;setPhotos([]);setComment('');setNotice('تم إرسال تقييمك المرتبط بالاستلام.');
  });
 }
 async function saveDelivery(){
  await run(async()=>{
   const ts=deliveryWhen.trim()?new Date(deliveryWhen.trim()):null;
   if(ts&&(!Number.isFinite(ts.getTime())||ts.getTime()<Date.now()))throw new Error('أدخل موعدًا مستقبليًا بصيغة 2026-11-05T18:00');
   const r=await supabase.rpc('hayna_order_update_delivery',{p_order:id,p_delivery_at:ts?ts.toISOString():null,p_note:deliveryNote.trim()});
   if(r.error)throw r.error;setNotice('حُفظ موعد التسليم وأُرسل تنبيه إلى المشتري.');
  });
 }
 async function savePreferences(inAppValue:boolean,pushValue:boolean){
  await run(async()=>{
   const r=await supabase.from('order_notification_preferences').upsert({user_id:uid,in_app_enabled:inAppValue,push_enabled:pushValue,updated_at:new Date().toISOString()},{onConflict:'user_id'});
   if(r.error)throw r.error;setInApp(inAppValue);setPush(pushValue);setNotice('تم تحديث تفضيلات إشعارات الطلبات.');
  });
 }
 async function sendReply(){
  await run(async()=>{
   if(!review)return;
   const result=reply?await supabase.from('review_replies').update({body:sellerReply.trim()}).eq('id',reply.id):
    await supabase.from('review_replies').insert({review_id:review.id,seller_id:uid,body:sellerReply.trim()});
   if(result.error)throw result.error;setSellerReply('');setEditingReply(false);setNotice('تم حفظ رد البائع.');
  });
 }
 async function reportReview(){
  await run(async()=>{
   if(!review)return;
   const {error:e}=await supabase.from('review_reports').insert({review_id:review.id,reporter_id:uid,reason:reportReason.trim()});
   if(e)throw e;setReportReason('');setNotice('أُرسل بلاغ التقييم للإدارة.');
  });
 }
 async function createTicket(){
  await run(async()=>{
   const {data,error:e}=await supabase.from('order_disputes').insert({[field]:id,requester_id:uid,category,description:description.trim()}).select('id,ticket_number,category,status,description,created_at').single();
   if(e||!data)throw e||new Error('تعذر إنشاء التذكرة.');
   for(const a of casePhotos){
    const ext=a.mimeType==='image/png'?'png':a.mimeType==='image/webp'?'webp':'jpg';
    const path=data.id+'/'+uid+'/'+Date.now()+'-'+Math.random().toString(36).slice(2)+'.'+ext;
    await uploadPhoto('order-dispute-files',path,a);
    const r=await supabase.from('dispute_attachments').insert({dispute_id:data.id,uploader_id:uid,storage_path:path});
    if(r.error)throw r.error;
   }
   setDescription('');setCasePhotos([]);setTicket(data as Ticket);setNotice('تم فتح تذكرة رقم '+data.ticket_number);
   await loadTicket(data as Ticket);
  });
 }
 async function sendMessage(){
  if(!ticket||!message.trim())return;
  await run(async()=>{
   const {error:e}=await supabase.from('dispute_messages').insert({dispute_id:ticket.id,sender_id:uid,is_admin:false,body:message.trim()});
   if(e)throw e;setMessage('');await loadTicket(ticket);
  });
 }
 const S=styles;const box=(child:React.ReactNode)=><View style={[S.card,{backgroundColor:c.surface,borderColor:c.line}]}>{child}</View>;
 const title=(txt:string)=><Text style={[S.title,{color:c.ink}]}>{txt}</Text>;
 const hint=(txt:string)=><Text style={[S.hint,{color:c.muted}]}>{txt}</Text>;
 const input=(v:string,set:(v:string)=>void,placeholder:string,multi=false)=><TextInput value={v} onChangeText={set} placeholder={placeholder} placeholderTextColor={c.muted} multiline={multi} textAlign="right" style={[S.input,{color:c.ink,borderColor:c.line,backgroundColor:c.soft,minHeight:multi?90:44}]} />;
 const button=(txt:string,cb:()=>void,disabled=false)=><Pressable accessibilityRole="button" accessibilityLabel={txt} disabled={busy||disabled} onPress={cb} style={[S.button,{backgroundColor:c.primary,opacity:busy||disabled?.5:1}]}><Text style={S.buttonText}>{txt}</Text></Pressable>;
 return <View style={{flex:1,backgroundColor:'transparent'}}><AppHeader title="تفاصيل الطلب" subtitle="السوق · حيّنا" fallbackRoute="/marketplace-dashboard?tab=services"/>
  <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);void load();}}/>} contentContainerStyle={S.wrap}>
   {loading?<ActivityIndicator color={c.primary}/>:null}
   {!!error&&<Text accessibilityRole="alert" style={S.error}>{error}</Text>}
   {!!notice&&<Text style={[S.notice,{color:c.primary}]}>{notice}</Text>}
   {order?<>
    {box(<>{title(label)}{hint('رقم الطلب: '+String(order.id))}{title(statusNames[order.status]||order.status)}
     <View style={S.stepRow}>{steps[kind].map((step,i)=><View key={step} style={[S.step,{backgroundColor:steps[kind].indexOf(order.status)>=i?c.primary:c.soft}]}><Text style={{fontSize:10,color:steps[kind].indexOf(order.status)>=i?'#fff':c.ink,textAlign:'center'}}>{statusNames[step]}</Text></View>)}</View>
     {order.amount_halalas!=null?hint('قيمة الطلب: '+(Number(order.amount_halalas)/100).toFixed(2)+' ر.س'):null}
     {isSeller&&kind==='service'&&order.status==='paid'?button('قبول الطلب',()=>void changeStatus('accept')):null}
     {isSeller&&kind==='service'&&order.status==='accepted'?button('بدء التنفيذ',()=>void changeStatus('start')):null}
     {isSeller&&kind==='service'&&order.status==='in_progress'?button('جاهز للاستلام',()=>void changeStatus('ready')):null}
     {isBuyer&&kind==='service'&&order.status==='ready'?button('تأكيد الاستلام الفعلي',()=>Alert.alert('تأكيد الاستلام','هل استلمت الخدمة بالفعل؟ لا يمكن التراجع عن هذا الإجراء.',[{text:'إلغاء',style:'cancel'},{text:'تأكيد',onPress:()=>void changeStatus('received')}])):null}
     {kind==='product'&&isSeller&&order.status==='pending'?<>{button('قبول طلب المنتج',()=>void productAction('accept'))}{button('رفض الطلب',()=>void productAction('reject'))}</>:null}
     {kind==='product'&&isSeller&&order.status==='accepted'?button('المنتج جاهز للاستلام',()=>void productAction('ready')):null}
     {kind==='product'&&isBuyer&&order.status==='ready'?button('تأكيد استلام المنتج',()=>Alert.alert('تأكيد الاستلام','هل استلمت المنتج بالفعل؟',[{text:'إلغاء',style:'cancel'},{text:'تأكيد',onPress:()=>void productAction('complete')}])):null}
     {kind==='product'&&isBuyer&&order.status==='pending'?button('إلغاء الطلب',()=>void productAction('cancel')):null}
     {kind==='product'&&order.conversation_id?button('فتح محادثة البائع والمشتري',()=>router.push({pathname:'/conversation',params:{id:order.conversation_id}})):null}
     {kind==='service'&&order.scheduled_delivery_at?hint('موعد التسليم: '+date(order.scheduled_delivery_at)):null}
     {kind==='service'&&order.delivery_note?hint('تفاصيل التسليم: '+order.delivery_note):null}
     {kind==='service'&&isSeller&&['accepted','in_progress'].includes(order.status)?<>{title('تعديل موعد وتفاصيل التسليم')}{input(deliveryWhen,setDeliveryWhen,'الموعد: 2026-11-05T18:00 (اختياري)')}{input(deliveryNote,setDeliveryNote,'تفاصيل التسليم',true)}{button('حفظ الموعد وإبلاغ المشتري',()=>void saveDelivery())}</>:null}
    </>)}
    {history.length?box(<>{title('سجل حالة الطلب')}{history.map(x=><View key={x.id} style={S.line}>{hint((statusNames[x.old_status]||x.old_status)+' ← '+(statusNames[x.new_status]||x.new_status))}{hint(date(x.created_at))}</View>)}</>):null}
    {completed?box(<>{title('التقييم بعد الاستلام')}
     {review?<>{hint('التقييم: '+review.rating+' من 5')}{hint(review.body||'بدون تعليق')}{review.photo_paths?.map((path:string)=><Image key={path} source={{uri:supabase.storage.from('order-review-images').getPublicUrl(path).data.publicUrl}} style={S.photo}/>)}
      {reply?<>{title('رد البائع')}{hint(reply.body)}{isSeller&&!editingReply?button('تعديل ردي',()=>{setSellerReply(reply.body);setEditingReply(true);}):null}</>:null}
      {isSeller&&(!reply||editingReply)?<>{input(sellerReply,setSellerReply,'رد البائع',true)}{button(reply?'حفظ تعديل الرد':'نشر الرد',()=>void sendReply(),!sellerReply.trim())}</>:null}
      {isSeller||isBuyer?<>{input(reportReason,setReportReason,'سبب الإبلاغ عن هذا التقييم',true)}{button('الإبلاغ عن التقييم',()=>void reportReview(),reportReason.trim().length<5)}</>:null}
     </>:isBuyer?<>{hint('يمكن إضافة تقييم واحد فقط لهذا الطلب المكتمل.')}<View style={S.stepRow}>{[1,2,3,4,5].map(n=><Pressable key={n} accessibilityLabel={'تقييم '+n} onPress={()=>setStars(n)}><Text style={{fontSize:25,color:n<=stars?'#E4A11B':c.muted}}>★</Text></Pressable>)}</View>{input(comment,setComment,'اكتب تجربتك (اختياري)',true)}{button('إضافة صور للتقييم (3 كحد أقصى)',()=>void chooseImages())}{photos.length?hint('تم اختيار '+photos.length+' صورة'):null}{button('نشر التقييم',()=>void submitReview())}</>:hint('التقييم متاح للمشتري فقط بعد تأكيد الاستلام.')}
    </>):null}
    {box(<>{title('تفضيلات إشعارات الطلبات')}{hint('يمكنك تحديد إشعارات الطلبات داخل التطبيق وإشعارات الهاتف بصورة مستقلة.')}{button(inApp?'إيقاف إشعارات الطلبات داخل التطبيق':'تفعيل إشعارات الطلبات داخل التطبيق',()=>void savePreferences(!inApp,push))}{button(push?'إيقاف إشعارات الهاتف للطلبات':'تفعيل إشعارات الهاتف للطلبات',()=>void savePreferences(inApp,!push))}</>)}
    {box(<>{title('مركز مشكلات الطلبات')}{hint('تذاكر خاصة بين مقدم البلاغ والإدارة، مرتبطة بالطلب نفسه.')}
     {tickets.map(t=><Pressable key={t.id} onPress={()=>void loadTicket(t)} style={S.line}><Text style={{color:c.primary,fontWeight:'700',textAlign:'right'}}>تذكرة #{t.ticket_number} · {t.status}</Text>{hint(t.description)}</Pressable>)}
     {!ticket?<>{title('فتح بلاغ جديد')}<View style={S.stepRow}>{Object.entries(disputeKinds).map(([k,v])=><Pressable key={k} onPress={()=>setCategory(k)} style={[S.choice,{backgroundColor:category===k?c.primary:c.soft}]}><Text style={{fontSize:11,color:category===k?'white':c.ink}}>{v}</Text></Pressable>)}</View>
      {input(description,setDescription,'اشرح المشكلة والتفاصيل',true)}
      {button('إرفاق صور المشكلة',()=>void chooseImages(true))}{casePhotos.length?hint('تم اختيار '+casePhotos.length+' صورة'):null}
      {button('إرسال البلاغ',()=>void createTicket(),description.trim().length<10)}</>:<>
       {title('تذكرة #'+ticket.ticket_number+' · '+ticket.status)}
       {messages.map(m=><View key={m.id} style={[S.message,{backgroundColor:m.is_admin?c.soft:c.surface,borderColor:c.line}]}>{hint(m.is_admin?'رد الإدارة':'رسالتي')}{hint(m.body)}{hint(date(m.created_at))}</View>)}
       {attachments.map(a=>signed[a.storage_path]?<Image key={a.id} style={S.photo} source={{uri:signed[a.storage_path]}}/>:null)}
       {input(message,setMessage,'اكتب ردك للإدارة',true)}{button('إرسال رسالة',()=>void sendMessage(),!message.trim())}
       {button('العودة إلى قائمة البلاغات',()=>setTicket(null))}
      </>}
    </>)}
   </>:!loading?hint('تعذر عرض الطلب. تحقق من الرابط أو صلاحية الحساب.'):null}
  </ScrollView>
 </View>;
}
const styles=StyleSheet.create({
 wrap:{padding:14,paddingBottom:56,gap:14,width:'100%',maxWidth:760,alignSelf:'center'},
 card:{borderWidth:1,borderRadius:17,padding:16,gap:12},
 title:{fontSize:17,fontWeight:'700',textAlign:'right'},
 hint:{fontSize:12,lineHeight:20,textAlign:'right'},
 line:{paddingVertical:9,borderBottomWidth:0.5,borderColor:'#DDE7E4',gap:4},
 stepRow:{flexDirection:'row-reverse',flexWrap:'wrap',gap:7,alignItems:'center'},
 step:{paddingVertical:9,paddingHorizontal:10,borderRadius:10},
 choice:{padding:9,borderRadius:10},
 input:{borderWidth:1,borderRadius:12,padding:12,fontSize:13,textAlignVertical:'top'},
 button:{borderRadius:12,padding:12,minHeight:43,alignItems:'center',justifyContent:'center'},
 buttonText:{color:'white',fontWeight:'700',fontSize:13},
 message:{borderWidth:1,borderRadius:11,padding:12,gap:5},
 photo:{width:100,height:100,borderRadius:12},
 error:{color:'#b91c1c',fontSize:12,textAlign:'right'},
 notice:{fontSize:12,textAlign:'right'}
});
