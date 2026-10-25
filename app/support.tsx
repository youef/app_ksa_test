import { OasisPressable as Pressable, OasisTextInput as TextInput } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import { AppHeader, HeaderAction } from '@/components/shared/AppHeader';
import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import { ActivityIndicator, Alert, ScrollView, Text, View } from 'react-native';
import {router} from 'expo-router';
import {ArrowRight,LifeBuoy,Plus,Search,Send,MessageCircle} from 'lucide-react-native';
import {supabase} from '@/lib/supabase';
import { SUPPORT_STATUSES, SupportEmptyState, SupportStatusBadge, type SupportStatus } from '@/components/shared/SupportUI';
import { AdminSupportCenter } from '@/components/admin/AdminSupportCenter';
import { AdminTaskCenter } from '@/components/admin/AdminTaskCenter';
type Status=SupportStatus;
type Ticket={id:string;user_id:string|null;name:string;email:string|null;subject:string;message:string;status:Status;created_at:string;resolved_at:string|null};
type Reply={id:string;ticket_id:string;user_id:string|null;author_name:string;message:string;is_admin:boolean;created_at:string};
const S=SUPPORT_STATUSES;
const inp:any={borderWidth:1,borderColor:'#DCE5ED',backgroundColor:OASIS.colors.background,borderRadius:13,padding:12,textAlign:'right',color:OASIS.colors.ink,fontSize:13};
const dt=(v:string)=>new Date(v).toLocaleString('ar-SA',{dateStyle:'medium',timeStyle:'short'});
function UserSupportPage(){
 const [uid,setUid]=useState<string|null>(null),[name,setName]=useState('مستخدم حيّنا'),[email,setEmail]=useState(''),[tickets,setTickets]=useState<Ticket[]>([]),[replies,setReplies]=useState<Reply[]>([]);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[search,setSearch]=useState(''),[selected,setSelected]=useState<string|null>(null),[form,setForm]=useState(false),[subject,setSubject]=useState(''),[message,setMessage]=useState(''),[reply,setReply]=useState(''),[statusFilter,setStatusFilter]=useState<'all'|'open'|'reviewing'|'resolved'>('all');
 const load=useCallback(async()=>{setLoading(true);try{const {data:auth}=await supabase.auth.getUser();if(!auth.user){router.replace('/auth');return;}setUid(auth.user.id);setEmail(auth.user.email||'');const {data:p}=await supabase.from('profiles').select('display_name,username').eq('id',auth.user.id).maybeSingle();setName(p?.display_name||p?.username||auth.user.email||'مستخدم حيّنا');const {data,error}=await supabase.from('support_tickets').select('id,user_id,name,email,subject,message,status,created_at,resolved_at').eq('user_id',auth.user.id).order('created_at',{ascending:false}).limit(200);if(error)throw error;const ownTickets=(data||[]) as Ticket[];setTickets(ownTickets);if(ownTickets.length){const {data:rs,error:re}=await supabase.from('support_ticket_replies').select('id,ticket_id,user_id,author_name,message,is_admin,created_at').in('ticket_id',ownTickets.map(t=>t.id)).order('created_at').limit(1000);if(re)throw re;setReplies((rs||[]) as Reply[]);}else{setReplies([]);}}catch(e:any){Alert.alert('تعذر تحميل التذاكر',e?.message||'تحقق من الاتصال');}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();},[load]);
 const visible=useMemo(()=>{const q=search.trim().toLowerCase();return tickets.filter(t=>{const matchesStatus=statusFilter==='all'||(statusFilter==='resolved'?(t.status==='resolved'||t.status==='closed'):t.status===statusFilter);return matchesStatus&&(!q||[t.subject,t.message,t.id,t.status].some(v=>v.toLowerCase().includes(q)));});},[tickets,search,statusFilter]);
 const openCount=tickets.filter(t=>t.status==='open').length,reviewCount=tickets.filter(t=>t.status==='reviewing').length,doneCount=tickets.filter(t=>t.status==='resolved'||t.status==='closed').length;
 const create=async()=>{if(subject.trim().length<3||message.trim().length<3){Alert.alert('بيانات ناقصة','اكتب عنواناً ووصفاً واضحين.');return;}if(!uid)return;setBusy(true);try{const {data,error}=await supabase.from('support_tickets').insert({user_id:uid,name,email:email||null,subject:subject.trim(),message:message.trim()}).select().single();if(error)throw error;setTickets(p=>[data as Ticket,...p]);setSelected(data.id);setSubject('');setMessage('');setForm(false);Alert.alert('تم إنشاء التذكرة','يمكنك متابعة الردود من هذه الصفحة.');}catch(e:any){Alert.alert('تعذر إرسال الطلب',e?.message||'حاول مرة أخرى');}finally{setBusy(false);}};
 const send=async(t:Ticket)=>{if(!reply.trim()||!uid)return;if(t.status==='resolved'||t.status==='closed'){Alert.alert('التذكرة مكتملة','افتح تذكرة جديدة إذا استمرت المشكلة.');return;}setBusy(true);try{const {data,error}=await supabase.from('support_ticket_replies').insert({ticket_id:t.id,user_id:uid,author_name:name,message:reply.trim(),is_admin:false}).select().single();if(error)throw error;setReplies(p=>[...p,data as Reply]);setReply('');Alert.alert('تم إرسال الرد','وصلت رسالتك إلى فريق الدعم.');}catch(e:any){Alert.alert('تعذر إرسال الرد',e?.message||'تحقق من الصلاحيات');}finally{setBusy(false);}};
 const btn=(bg:string)=>({backgroundColor:bg,borderRadius:12,paddingHorizontal:13,paddingVertical:11,flexDirection:'row' as const,alignItems:'center' as const,justifyContent:'center' as const,gap:7});
 return <View style={{flex:1,backgroundColor:'#F4F7FB'}}><AppHeader title="مركز الدعم والمساعدة" fallbackRoute="/more" rightAction={<HeaderAction accessibilityLabel={form?'إلغاء التذكرة':'تذكرة جديدة'} onPress={()=>setForm(v=>!v)}><Plus size={20} color={OASIS.colors.primary}/></HeaderAction>}/><ScrollView contentContainerStyle={{padding:16,paddingBottom:120,gap:14}}>

 <View style={{flexDirection:'row-reverse',gap:8}}>
  {[{key:'all',label:'كل التذاكر',value:tickets.length,color:OASIS.colors.ink,bg:'#F1F5F9'},{key:'open',label:'جديدة',value:openCount,color:'#92400E',bg:'#FEF3C7'},{key:'reviewing',label:'قيد المعالجة',value:reviewCount,color:'#1D4ED8',bg:'#DBEAFE'},{key:'resolved',label:'مكتملة',value:doneCount,color:OASIS.colors.primary,bg:OASIS.colors.soft}].map((item:any)=><Pressable key={item.key} onPress={()=>setStatusFilter(item.key)} style={{flex:1,minWidth:0,backgroundColor:statusFilter===item.key?item.bg:OASIS.colors.surface,borderWidth:1,borderColor:statusFilter===item.key?item.color:OASIS.colors.line,borderRadius:13,paddingVertical:10,paddingHorizontal:4,alignItems:'center',gap:4}}><Text numberOfLines={1} style={{fontSize:11,fontWeight:'600',color:item.color}}>{item.label}</Text><Text style={{fontSize:16,fontWeight:'700',color:item.color}}>{item.value}</Text></Pressable>)}
 </View>
 {form&&<View style={{backgroundColor:OASIS.colors.surface,borderRadius:14,padding:15,gap:10,borderWidth:1,borderColor:'#DCE5ED'}}><Text style={{fontSize:16,fontWeight:'700',color:OASIS.colors.ink,textAlign:'right'}}>ما الذي تحتاج المساعدة فيه؟</Text><TextInput value={subject} onChangeText={setSubject} maxLength={120} placeholder="عنوان الطلب" style={inp}/><TextInput value={message} onChangeText={setMessage} multiline maxLength={2000} placeholder="اشرح المشكلة أو الاستفسار" style={[inp,{minHeight:110,textAlignVertical:'top'}]}/><Text style={{fontSize:11,color:'#94A3B8',textAlign:'right'}}>{message.length}/2000 حرف</Text><Pressable disabled={busy} onPress={()=>void create()} style={[btn('#0F766E'),{opacity:busy?0.6:1}]}>{busy?<ActivityIndicator color={OASIS.colors.surface}/>:<Send size={15} color={OASIS.colors.surface}/>}<Text style={{color:OASIS.colors.surface,fontWeight:'700'}}>إرسال التذكرة</Text></Pressable></View>}
 <View style={{backgroundColor:OASIS.colors.surface,borderRadius:17,padding:12,borderWidth:1,borderColor:OASIS.colors.line,gap:9}}><View style={{flexDirection:'row-reverse',alignItems:'center',gap:8}}><Search size={17} color={OASIS.colors.muted}/><Text style={{fontSize:15,fontWeight:'700',color:OASIS.colors.ink}}>تذاكري</Text></View><TextInput value={search} onChangeText={setSearch} placeholder="ابحث بالموضوع أو نص الرسالة أو رقم التذكرة..." style={inp}/></View>
 {loading?<View style={{padding:24,alignItems:'center'}}><ActivityIndicator size="large" color="#0F766E"/></View>:visible.length===0?<SupportEmptyState title="لا توجد تذاكر مطابقة" description="افتح تذكرة جديدة أو جرّب عبارة بحث مختلفة." icon={<MessageCircle size={29} color="#94A3B8" />}/>:visible.map(t=>{const st=S[t.status],open=selected===t.id,rs=replies.filter(r=>r.ticket_id===t.id);return <View key={t.id} style={{backgroundColor:OASIS.colors.surface,borderRadius:14,borderWidth:1,borderColor:open?'#99F6E4':OASIS.colors.line,padding:15,gap:11}}><View style={{flexDirection:'row-reverse',alignItems:'flex-start',gap:9}}><View style={{flex:1,gap:5}}><Text style={{fontSize:14,fontWeight:'700',color:OASIS.colors.ink,textAlign:'right'}}>{t.subject}</Text><Text style={{fontSize:11,color:'#94A3B8',textAlign:'right'}}>#{t.id.slice(0,8).toUpperCase()} · {dt(t.created_at)}</Text></View><SupportStatusBadge status={t.status} compact /></View><Text numberOfLines={open?undefined:2} style={{fontSize:12,lineHeight:20,color:OASIS.colors.muted,textAlign:'right'}}>{t.message}</Text><Pressable onPress={()=>setSelected(open?null:t.id)} style={btn('#F0FDFA')}><MessageCircle size={14} color="#0F766E"/><Text style={{fontSize:11,fontWeight:'700',color:'#0F766E'}}>{open?'إخفاء المحادثة':'عرض المحادثة ('+rs.length+' رد)'}</Text></Pressable>{open&&<View style={{borderTopWidth:1,borderTopColor:OASIS.colors.line,paddingTop:11,gap:10}}>{rs.map(r=><View key={r.id} style={{alignSelf:r.is_admin?'flex-start':'flex-end',width:'94%',backgroundColor:r.is_admin?'#F0FDFA':OASIS.colors.background,borderWidth:1,borderColor:r.is_admin?'#99F6E4':OASIS.colors.line,borderRadius:13,padding:11,gap:5}}><Text style={{fontSize:11,fontWeight:'700',color:r.is_admin?'#0F766E':OASIS.colors.ink,textAlign:'right'}}>{(r.is_admin?'فريق دعم حيّنا':r.author_name)+' · '+dt(r.created_at)}</Text><Text style={{fontSize:12,lineHeight:20,color:OASIS.colors.ink,textAlign:'right'}}>{r.message}</Text></View>)}{t.status!=='closed'&&t.status!=='resolved'?<><TextInput value={reply} onChangeText={setReply} multiline maxLength={2000} placeholder="اكتب ردك أو أضف معلومات..." style={[inp,{minHeight:75,textAlignVertical:'top'}]}/><Pressable disabled={busy} onPress={()=>void send(t)} style={[btn('#0F766E'),{opacity:busy?0.5:1}]}>{busy?<ActivityIndicator color={OASIS.colors.surface}/>:<Send size={15} color={OASIS.colors.surface}/>}<Text style={{color:OASIS.colors.surface,fontWeight:'700'}}>إرسال الرد</Text></Pressable></>:<Text style={{color:OASIS.colors.muted,fontSize:11,textAlign:'right'}}>التذكرة مكتملة. افتح تذكرة جديدة إذا احتجت مساعدة إضافية.</Text>}</View>}</View>})}
 <Text style={{fontSize:11,color:'#94A3B8',textAlign:'center'}}>تذاكرك خاصة بحسابك ولا يستطيع الآخرون الاطلاع عليها.</Text></ScrollView></View>;
}

function AdminSupportPage() {
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [verifications, setVerifications] = useState<any[]>([]);
  const [urgentAlerts, setUrgentAlerts] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const loadTaskData = useCallback(async () => {
    try {
      const [reportsRes, verifRes, urgentRes, questionsRes] = await Promise.all([
        supabase.from('reports').select('*, reporter:reporter_id(id, display_name, username)').order('created_at', { ascending: false }).limit(60),
        supabase.from('verification_requests').select('*').order('created_at', { ascending: false }).limit(60),
        supabase.from('urgent_alerts').select('*').order('created_at', { ascending: false }).limit(60),
        supabase.from('questions').select('*, author:author_id(id, display_name, username)').order('created_at', { ascending: false }).limit(60),
      ]);
      setReports((reportsRes.data || []) as any[]);
      setVerifications((verifRes.data || []) as any[]);
      setUrgentAlerts((urgentRes.data || []) as any[]);
      setQuestions((questionsRes.data || []) as any[]);
    } catch {
      // Ignore errors in task aggregation; support ticket management remains available.
    }
  }, []);
  useEffect(() => {
    void loadTaskData();
  }, [loadTaskData]);
  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2600);
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: '#F4F7FB' }}>
      {toast ? (
        <View style={{ backgroundColor: OASIS.colors.ink, marginHorizontal: 14, marginTop: 10, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 }}>
          <Text style={{ color: OASIS.colors.surface, fontSize: 12, fontWeight: '600', textAlign: 'right' }}>{toast}</Text>
        </View>
      ) : null}
      <AppHeader title="دعم الإدارة" subtitle="التذاكر والبلاغات" fallbackRoute="/admin" />
      <AdminTaskCenter
        reports={reports as any}
        verifications={verifications as any}
        urgentAlerts={urgentAlerts as any}
        questions={questions as any}
        onNavigate={(tab: string) => router.push('/admin')}
        onResolveAll={() => void loadTaskData()}
      />
      <AdminSupportCenter onToast={showToast} />
    </View>
  );
}

export default function SupportScreen() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) {
          router.replace('/auth');
          return;
        }
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', auth.user.id).maybeSingle();
        if (mounted) setIsAdmin(profile?.role === 'admin');
      } catch {
        // Keep user view as the safe default when role cannot be determined.
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F4F7FB' }}>
        <ActivityIndicator size="large" color="#0F766E" />
      </View>
    );
  }
  if (isAdmin) return <AdminSupportPage />;
  return <UserSupportPage />;
}
