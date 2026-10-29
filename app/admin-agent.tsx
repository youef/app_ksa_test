import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AppHeader } from '@/components/shared/AppHeader';
import { supabase } from '@/lib/supabase';
import { OasisPressable as Pressable } from '@/components/oasis/OasisPrimitives';
import { AlertTriangle, Bot, CheckCircle2, ChevronLeft, Clock3, ExternalLink, GitPullRequest, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react-native';

type Run = { id: string; status: string; summary: string; source: string; source_url: string | null; started_at: string; details?: { checks?: Array<{ id: string; status: string; message: string }> } };
type AgentEvent = { id: string; component: string; phase: string; status: string; severity: string; summary: string; decision: string; plan: unknown; details: unknown; result: unknown; cost_tier: string; source_url: string | null; created_at: string };
type Proposal = { id: string; title: string; category: string; risk: string; status: string; rationale: string; source_url: string | null; created_at: string };
const AUDIT_URL = 'https://github.com/youef/app_ksa_test/actions/workflows/hayna-ai-audit.yml';
const SAFE_URL = /^https:\/\/github\.com\/youef\/app_ksa_test\/(?:actions|pull|issues)\//;
function openTrustedUrl(url?: string | null) {
  if (url && SAFE_URL.test(url)) void Linking.openURL(url);
}
function formatDate(value: string) {
  try { return new Date(value).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' }); }
  catch { return value; }
}
export default function AdminAgent() {
  const [busy, setBusy] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState('');
  const [runs, setRuns] = useState<Run[]>([]);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const load = useCallback(async () => {
    try {
      setError('');
      const { data: userData, error: authError } = await supabase.auth.getUser();
      if (authError || !userData.user) { router.replace('/auth'); return; }
      const { data: profile, error: profileError } = await supabase.from('profiles')
        .select('role').eq('id', userData.user.id).maybeSingle();
      if (profileError || profile?.role !== 'admin') { router.replace('/home'); return; }
      setAuthorized(true);
      const [runResult, proposalResult, eventsResult] = await Promise.all([
        supabase.from('ai_agent_runs').select('id,status,summary,source,source_url,started_at,details').order('started_at',{ ascending:false }).limit(25),
        supabase.from('ai_agent_proposals').select('id,title,category,risk,status,rationale,source_url,created_at').order('created_at',{ ascending:false }).limit(25),
        supabase.from('ai_agent_events').select('id,component,phase,status,severity,summary,decision,plan,details,result,cost_tier,source_url,created_at').order('created_at',{ ascending:false }).limit(50),
      ]);
      if (runResult.error) throw runResult.error;
      if (proposalResult.error) throw proposalResult.error;
      if (eventsResult.error) throw eventsResult.error;
      setRuns((runResult.data || []) as Run[]);
      setProposals((proposalResult.data || []) as Proposal[]);
      setEvents((eventsResult.data || []) as AgentEvent[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحميل تقارير الوكيل');
    } finally { setBusy(false); setRefreshing(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const refresh = () => { setRefreshing(true); void load(); };
  const count = (status: string) => runs.filter(run => run.status === status).length;
  return <View style={s.screen}>
    <AppHeader variant="sub" title="وكيل حيّنا الذكي" subtitle="غرفة العمليات الهندسية · HAYNA AI" fallbackRoute="/admin" />
    {busy ? <View style={s.center}><ActivityIndicator color="#08744E" /><Text style={s.muted}>جاري التحقق من صلاحية الإدارة...</Text></View> :
    authorized ? <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#08744E" />}>
      <View style={s.hero}>
        <View style={s.heroIcon}><Bot size={26} color="#FFFFFF" /></View>
        <Text style={s.heroTitle}>مركز قيادة الوكيل الهندسي</Text>
        <Text style={s.heroBody}>يراجع المشروع كل ساعة، ويعرض هنا سجل الفحص والقرارات والخطط والنتائج. تُنفَّذ الإصلاحات منخفضة المخاطر بعد الاختبار؛ وتُحمى بيانات المستخدمين والتغييرات الحساسة.</Text>
        <Pressable style={s.heroButton} onPress={() => openTrustedUrl(AUDIT_URL)}>
          <ExternalLink size={15} color="#065F46" /><Text style={s.heroButtonText}>عرض الفحوصات في GitHub</Text>
        </Pressable>
      </View>
      <View style={s.stats}>
        <View style={s.stat}><CheckCircle2 color="#047857" size={19}/><Text style={s.statNumber}>{count('passed')}</Text><Text style={s.statLabel}>ناجحة</Text></View>
        <View style={s.stat}><AlertTriangle color="#B45309" size={19}/><Text style={s.statNumber}>{count('warning')+count('failed')}</Text><Text style={s.statLabel}>تحتاج مراجعة</Text></View>
        <View style={s.stat}><GitPullRequest color="#0F766E" size={19}/><Text style={s.statNumber}>{proposals.length}</Text><Text style={s.statLabel}>مقترحات</Text></View>
      </View>
      {error ? <View style={s.notice}><AlertTriangle color="#B45309" size={20}/><View style={{flex:1}}><Text style={s.noticeTitle}>تقارير قاعدة البيانات غير متاحة</Text><Text style={s.muted}>تحقق من تطبيق ترحيل ai_agent_runs و ai_agent_proposals وصلاحيات القراءة. {error}</Text></View></View> : null}
      <View style={s.sectionHeader}><Text style={s.sectionTitle}>آخر عمليات الفحص</Text><Pressable onPress={refresh}><RefreshCw size={18} color="#08744E" /></Pressable></View>
      {runs.length ? runs.map(run => <View key={run.id} style={s.item}>
        <View style={s.itemTop}><Text style={s.itemTitle}>{run.summary}</Text><View style={[s.pill,run.status==='passed'?s.good:s.warn]}><Text style={s.pillText}>{run.status==='passed'?'مكتمل':run.status==='warning'?'تحذير':run.status==='failed'?'فشل':'قيد التنفيذ'}</Text></View></View>
        <Text style={s.muted}>{formatDate(run.started_at)} · {run.source}</Text>
        {Array.isArray(run.details?.checks) ? run.details.checks.slice(0, 8).map((check, idx) => <Text key={idx} style={s.checkLine}>{check.status === 'passed' ? '✓' : check.status === 'failed' ? '✕' : '•'} {check.id}: {check.message}</Text>) : null}
        {run.source_url && SAFE_URL.test(run.source_url) ? <Pressable style={s.link} onPress={() => openTrustedUrl(run.source_url)}><Text style={s.linkText}>التفاصيل وسجل البناء</Text><ChevronLeft color="#047857" size={15}/></Pressable> : null}
      </View>) : <View style={s.empty}><Clock3 size={22} color="#94A3B8"/><Text style={s.muted}>لا توجد نتائج محفوظة بعد. ستظهر عند تشغيل الفحص وربط بياناته بشكل آمن.</Text></View>}
      <View style={s.sectionHeader}><Text style={s.sectionTitle}>سجل القرارات والتنفيذ</Text><Clock3 size={18} color="#08744E" /></View>
      <Text style={s.muted}>آخر 50 حدثًا محفوظًا · الخطة، السبب، التصحيح، الاختبار والنتيجة</Text>
      {events.length ? events.map(ev => <View key={ev.id} style={s.item}>
        <View style={s.itemTop}>
          <Text style={s.itemTitle}>{ev.summary}</Text>
          <View style={[s.pill,ev.status === 'verified' || ev.status === 'fixed' ? s.good : s.warn]}><Text style={s.pillText}>{ev.status === 'verified' ? 'تم التحقق' : ev.status === 'fixed' ? 'تم الإصلاح' : ev.status === 'detected' ? 'اكتُشفت' : ev.status === 'failed' ? 'فشل' : ev.status === 'blocked' ? 'متوقف' : ev.status === 'planned' ? 'مخطط' : ev.status}</Text></View>
        </View>
        <Text style={s.muted}>{formatDate(ev.created_at)} · {ev.component} · {ev.phase} · {ev.severity} · {ev.cost_tier}</Text>
        {ev.decision ? <Text style={s.itemBody}>**القرار:** {ev.decision}</Text> : null}
        {Array.isArray(ev.plan) && ev.plan.length ? <View style={s.plan}>
          <Text style={s.planTitle}>خطة التنفيذ</Text>
          {ev.plan.slice(0,10).map((step, i) => <Text key={i} style={s.itemBody}>{i + 1}. {String(step)}</Text>)}
        </View> : null}
        {ev.details && typeof ev.details === 'object' && !Array.isArray(ev.details) && Object.keys(ev.details).length ? <Text style={s.itemBody}>التفاصيل: {JSON.stringify(ev.details).slice(0,1200)}</Text> : null}
        {ev.result && typeof ev.result === 'object' && !Array.isArray(ev.result) && Object.keys(ev.result).length ? <Text style={s.itemBody}>النتيجة والاختبارات: {JSON.stringify(ev.result).slice(0,1200)}</Text> : null}
        {ev.source_url && SAFE_URL.test(ev.source_url) ? <Pressable onPress={() => openTrustedUrl(ev.source_url)} style={s.link}><Text style={s.linkText}>الدليل ومصدر التنفيذ</Text><ChevronLeft color="#047857" size={15}/></Pressable> : null}
      </View>) : <View style={s.empty}><Clock3 size={22} color="#94A3B8" /><Text style={s.muted}>السجل فارغ. يمكن حفظ النتائج من التشغيل الآلي عند توفير بيانات اعتماد الخادم الخاصة بالمهمة.</Text></View>}
      <View style={s.sectionHeader}><Text style={s.sectionTitle}>مقترحات التحسين</Text><Sparkles size={19} color="#08744E" /></View>
      {proposals.length ? proposals.map(item => <View key={item.id} style={s.item}>
        <View style={s.itemTop}><Text style={s.itemTitle}>{item.title}</Text><Text style={s.risk}>{item.risk.toUpperCase()}</Text></View>
        <Text style={s.itemBody}>{item.rationale}</Text><Text style={s.muted}>{item.category} · {item.status} · {formatDate(item.created_at)}</Text>
        {item.source_url && SAFE_URL.test(item.source_url) ? <Pressable onPress={() => openTrustedUrl(item.source_url)} style={s.link}><Text style={s.linkText}>افتح المقترح للمراجعة</Text><ChevronLeft color="#047857" size={15}/></Pressable> : null}
      </View>) : <View style={s.empty}><ShieldCheck size={22} color="#94A3B8"/><Text style={s.muted}>لم تُسجل مقترحات بعد. عدم وجود مقترحات لا يعني عدم وجود مشاكل.</Text></View>}
      <View style={s.footer}><Text style={s.footerText}>نظام المراجعة في هذه المرحلة لا يملك صلاحية حذف الجداول أو تجاوز سياسات RLS أو النشر المباشر.</Text></View>
    </ScrollView> : <View style={s.center}><Text style={s.muted}>يلزم تسجيل الدخول بحساب مدير المنصة.</Text></View>}
  </View>;
}
const s = StyleSheet.create({
  screen:{flex:1,backgroundColor:'transparent'}, center:{flex:1,alignItems:'center',justifyContent:'center',gap:12},
  content:{padding:16,paddingBottom:40,gap:14,maxWidth:840,width:'100%',alignSelf:'center'},
  hero:{backgroundColor:'#07583E',borderRadius:22,padding:22,alignItems:'flex-end',gap:10},
  heroIcon:{backgroundColor:'#127653',borderRadius:16,padding:11},heroTitle:{color:'#FFFFFF',fontSize:21,fontWeight:'800',textAlign:'right'},
  heroBody:{fontSize:13,lineHeight:22,color:'#E4F8EA',textAlign:'right'},heroButton:{backgroundColor:'#FFFFFF',padding:11,borderRadius:12,flexDirection:'row-reverse',alignItems:'center',gap:7,marginTop:4},
  heroButtonText:{color:'#065F46',fontWeight:'700',fontSize:13},stats:{flexDirection:'row-reverse',gap:9},
  stat:{flex:1,backgroundColor:'#FFFFFF',borderWidth:1,borderColor:'#D7EAE0',borderRadius:15,minHeight:110,padding:12,alignItems:'center',justifyContent:'center',gap:5},
  statNumber:{color:'#123D2D',fontSize:22,fontWeight:'800'},statLabel:{fontSize:11,color:'#516B5E'},
  sectionHeader:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'space-between',paddingHorizontal:3,paddingTop:8},
  sectionTitle:{color:'#154B35',fontWeight:'800',fontSize:17},item:{backgroundColor:'#FFFFFF',borderRadius:16,borderColor:'#DDEAE4',borderWidth:1,padding:14,gap:8},
  itemTop:{flexDirection:'row-reverse',justifyContent:'space-between',alignItems:'center',gap:8},
  itemTitle:{fontWeight:'700',fontSize:14,textAlign:'right',color:'#123D2D',flex:1},
  checkLine:{fontSize:11,color:'#465E52',textAlign:'right',lineHeight:18},
  plan:{gap:5,padding:10,backgroundColor:'#F0FDF4',borderRadius:10},
  planTitle:{fontWeight:'700',fontSize:12,color:'#047857',textAlign:'right'},
  pill:{borderRadius:20,paddingHorizontal:10,paddingVertical:5},good:{backgroundColor:'#D1FAE5'},warn:{backgroundColor:'#FEF3C7'},
  pillText:{color:'#475569',fontSize:10,fontWeight:'700'},muted:{color:'#64748B',fontSize:12,textAlign:'right',lineHeight:20},
  notice:{flexDirection:'row-reverse',gap:10,backgroundColor:'#FFF7ED',borderRadius:14,padding:14},noticeTitle:{fontWeight:'700',textAlign:'right',color:'#92400E'},
  link:{flexDirection:'row-reverse',gap:6,alignItems:'center',alignSelf:'flex-end',paddingVertical:4},
  linkText:{color:'#047857',fontSize:12,fontWeight:'700'},risk:{color:'#9A6700',fontWeight:'700',fontSize:11},itemBody:{color:'#334155',fontSize:12,lineHeight:20,textAlign:'right'},
  empty:{backgroundColor:'#F8FAFC',borderRadius:16,padding:23,alignItems:'center',gap:10},
  footer:{padding:14},footerText:{textAlign:'center',fontSize:11,color:'#64748B',lineHeight:19}
});
