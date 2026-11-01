import React,{useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,RefreshControl,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {router} from 'expo-router';
import {AppHeader} from '@/components/shared/AppHeader';
import {OasisPressable as Pressable} from '@/components/oasis/OasisPrimitives';
import {useTheme} from '@/context/ThemeContext';
import {supabase} from '@/lib/supabase';

type Ticket={id:string;ticket_number:number;requester_id:string;status:string;category:string;description:string;admin_note:string|null;created_at:string};
type Report={id:string;review_id:string;reporter_id:string;reason:string;status:string;created_at:string};
type Msg={id:string;body:string;sender_id:string;is_admin:boolean;created_at:string};
const states=['open','reviewing','awaiting_customer','resolved','closed'];
const reportStates=['open','reviewing','resolved','dismissed'];
const arStatus:Record<string,string>={open:'جديد',reviewing:'قيد المعالجة',awaiting_customer:'بانتظار العميل',resolved:'تم الحل',closed:'مغلق',dismissed:'مرفوض'};
export default function AdminOrderDisputes(){
 const {colors:c}=useTheme();
 const [allowed,setAllowed]=useState(false),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[refreshing,setRefreshing]=useState(false);
 const [tickets,setTickets]=useState<Ticket[]>([]),[reports,setReports]=useState<Report[]>([]),[selected,setSelected]=useState<Ticket|null>(null),[messages,setMessages]=useState<Msg[]>([]);
 const [reply,setReply]=useState(''),[note,setNote]=useState(''),[notice,setNotice]=useState(''),[error,setError]=useState('');
 const load=useCallback(async()=>{
  try{
   const a=await supabase.auth.getUser();if(!a.data.user){router.replace('/auth');return;}
   const role=await supabase.rpc('hayna_marketplace_can_review');
   if(role.error||role.data!==true){setError('لا تملك صلاحية مراجعة بلاغات السوق.');setAllowed(false);return;}
   setAllowed(true);
   const [ticketsResult,reportsResult]=await Promise.all([
    supabase.from('order_disputes').select('id,ticket_number,requester_id,status,category,description,admin_note,created_at').order('created_at',{ascending:false}).limit(100),
    supabase.from('review_reports').select('id,review_id,reporter_id,reason,status,created_at').order('created_at',{ascending:false}).limit(100)
   ]);
   if(ticketsResult.error||reportsResult.error)throw ticketsResult.error||reportsResult.error;
   setTickets((ticketsResult.data||[]) as Ticket[]);setReports((reportsResult.data||[]) as Report[]);
  }catch(e:any){setError(e?.message||'تعذر تحميل مركز البلاغات.');}
  finally{setLoading(false);setRefreshing(false);}
 },[]);
 useEffect(()=>{void load();},[load]);
 async function openTicket(t:Ticket){
  setSelected(t);setNote(t.admin_note||'');const result=await supabase.from('dispute_messages').select('id,body,sender_id,is_admin,created_at').eq('dispute_id',t.id).order('created_at',{ascending:true});
  if(result.error)setError(result.error.message);else setMessages((result.data||[]) as Msg[]);
 }
 async function run(task:()=>Promise<void>){if(busy)return;setBusy(true);setError('');setNotice('');try{await task();await load();}catch(e:any){setError(e?.message||'تعذر تحديث البلاغ.');}finally{setBusy(false);}}
 async function changeStatus(value:string){
  if(!selected)return;
  await run(async()=>{
   const r=await supabase.from('order_disputes').update({status:value,admin_note:note.trim()||null}).eq('id',selected.id);
   if(r.error)throw r.error;
   setSelected({...selected,status:value,admin_note:note.trim()||null});setNotice('تم تحديث حالة التذكرة.');
  });
 }
 async function sendReply(){
  if(!selected||!reply.trim())return;
  await run(async()=>{
   const a=await supabase.auth.getUser();if(!a.data.user)throw new Error('انتهت جلسة الإدارة.');
   const r=await supabase.from('dispute_messages').insert({dispute_id:selected.id,sender_id:a.data.user.id,is_admin:true,body:reply.trim()});
   if(r.error)throw r.error;setReply('');await openTicket(selected);setNotice('تم إرسال الرد الخاص إلى مقدم البلاغ.');
  });
 }
 async function reviewReport(report:Report,state:string){
  await run(async()=>{
   const a=await supabase.from('review_reports').update({status:state}).eq('id',report.id);
   if(a.error)throw a.error;
   if(state==='resolved'){
    const b=await supabase.from('order_reviews').update({moderation_status:'hidden'}).eq('id',report.review_id);
    if(b.error)throw b.error;
   }
   setNotice('تم تحديث بلاغ التقييم.');
  });
 }
 const card=(children:React.ReactNode)=><View style={[s.card,{backgroundColor:c.surface,borderColor:c.line}]}>{children}</View>;
 const title=(v:string)=><Text style={[s.title,{color:c.ink}]}>{v}</Text>;
 const hint=(v:string)=><Text style={[s.muted,{color:c.muted}]}>{v}</Text>;
 const button=(v:string,cb:()=>void)=><Pressable accessibilityRole="button" accessibilityLabel={v} disabled={busy} onPress={cb} style={[s.button,{backgroundColor:c.primary,opacity:busy?.5:1}]}><Text style={{color:'white',fontWeight:'700'}}>{v}</Text></Pressable>;
 return <View style={{flex:1,backgroundColor:'transparent'}}><AppHeader title="مشكلات طلبات السوق" subtitle="مركز الإدارة الخاص" fallbackRoute="/admin-marketplace"/><ScrollView contentContainerStyle={s.wrap} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={()=>{setRefreshing(true);void load();}}/>}>
  {loading?<ActivityIndicator color={c.primary}/>:null}
  {!!error&&<Text style={{color:'#b91c1c',textAlign:'right'}}>{error}</Text>}
  {!!notice&&hint(notice)}
  {allowed?<>
   {card(<>{title('تذاكر الطلبات · '+tickets.length)}{tickets.length===0?hint('لا توجد تذاكر حتى الآن.'):null}
    {tickets.map(t=><Pressable key={t.id} style={s.line} onPress={()=>void openTicket(t)}><Text style={{textAlign:'right',color:c.primary,fontWeight:'700'}}>تذكرة #{t.ticket_number} · {arStatus[t.status]||t.status}</Text>{hint(t.description)}{hint(new Date(t.created_at).toLocaleString('ar-SA'))}</Pressable>)}</>)}
   {selected?card(<>{title('معالجة التذكرة #'+selected.ticket_number)}
    {hint(selected.description)}{states.map(k=>button((arStatus[k]||k)+(selected.status===k?' ✓':''),()=>void changeStatus(k)))}
    <TextInput placeholder="ملاحظة داخلية للإدارة" value={note} onChangeText={setNote} multiline style={[s.input,{color:c.ink,borderColor:c.line}]}/>
    {button('حفظ الحالة والملاحظة',()=>void changeStatus(selected.status))}
    {title('المحادثة الخاصة')}
    {messages.map(m=><View key={m.id} style={s.line}>{hint((m.is_admin?'الإدارة: ':'مقدم البلاغ: ')+m.body)}{hint(new Date(m.created_at).toLocaleString('ar-SA'))}</View>)}
    <TextInput placeholder="اكتب ردك لصاحب التذكرة" value={reply} onChangeText={setReply} multiline style={[s.input,{color:c.ink,borderColor:c.line}]}/>
    {button('إرسال الرد',()=>void sendReply())}{button('إغلاق تفاصيل التذكرة',()=>setSelected(null))}
   </>):null}
   {card(<>{title('بلاغات التقييمات · '+reports.length)}{reports.length===0?hint('لا توجد بلاغات تقييمات.'):null}
    {reports.map(r=><View style={s.line} key={r.id}><Text style={{color:c.ink,textAlign:'right',fontWeight:'700'}}>{arStatus[r.status]||r.status}</Text>{hint(r.reason)}
     {r.status==='open'||r.status==='reviewing'?<>{button('إخفاء التقييم ومعالجة البلاغ',()=>void reviewReport(r,'resolved'))}{button('رفض البلاغ',()=>void reviewReport(r,'dismissed'))}</>:null}
    </View>)}</>)}
  </>:null}
 </ScrollView></View>;
}
const s=StyleSheet.create({wrap:{padding:16,gap:14,maxWidth:850,alignSelf:'center',width:'100%',paddingBottom:60},card:{padding:16,borderRadius:16,borderWidth:1,gap:10},title:{fontSize:17,fontWeight:'700',textAlign:'right'},muted:{fontSize:12,lineHeight:19,textAlign:'right'},button:{minHeight:42,padding:10,borderRadius:11,alignItems:'center',justifyContent:'center'},line:{paddingVertical:10,borderBottomWidth:.5,borderColor:'#cbd5e1',gap:6},input:{textAlign:'right',padding:12,borderWidth:1,borderRadius:12,minHeight:65,textAlignVertical:'top'}});
