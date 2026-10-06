import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { BarChart3, Building2, CalendarDays, Flag, MapPin, RefreshCw, ShieldCheck, Store, Users, Zap } from 'lucide-react-native';
import AdminCommandCenter from '@/components/AdminCommandCenter';

export default function AdminPro() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState<any>({ users:0, admins:0, questions:0, requests:0, businesses:0, marketplace:0, events:0 });
  const [users, setUsers] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [verifications, setVerifications] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [marketplace, setMarketplace] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);

  const load = async () => {
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { router.replace('/auth'); return; }
    const { data: pr } = await supabase.from('profiles').select('*').eq('id', auth.user.id).maybeSingle();
    if (!pr || pr.role !== 'admin') { router.replace('/home'); return; }
    setProfile(pr);

    const [u,r,v,q,req,b,m,e] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at',{ascending:false}).limit(1000),
      supabase.from('reports').select('*').order('created_at',{ascending:false}).limit(1000),
      supabase.from('verification_requests').select('*').order('created_at',{ascending:false}).limit(1000),
      supabase.from('questions').select('id').order('created_at',{ascending:false}).limit(100),
      supabase.from('requests').select('id').order('created_at',{ascending:false}).limit(100),
      supabase.from('businesses').select('*').order('created_at',{ascending:false}).limit(500),
      supabase.from('marketplace_items').select('*').order('created_at',{ascending:false}).limit(500),
      supabase.from('events').select('*').order('created_at',{ascending:false}).limit(500),
    ]);
    const usersData=u.data||[], reportsData=r.data||[], verifData=v.data||[];
    setUsers(usersData); setReports(reportsData); setVerifications(verifData); setQuestions(q.data||[]); setRequests(req.data||[]);
    setBusinesses(b.data||[]); setMarketplace(m.data||[]); setEvents(e.data||[]);
    setStats({
      users:usersData.length, admins:usersData.filter(x=>x.role==='admin').length,
      questions:q.data?.length||0, requests:req.data?.length||0,
      businesses:b.data?.length||0, marketplace:m.data?.length||0, events:e.data?.length||0,
      pendingReports:reportsData.filter(x=>x.status==='pending').length,
      pendingVerif:verifData.filter(x=>x.status==='pending').length,
    });
    setLoading(false);
  };

  useEffect(()=>{load();},[]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color="#059669"/><Text style={s.loading}>جاري تجهيز مركز العمليات المتقدم...</Text></View>;

  return (
    <View style={s.page}>
      <View style={s.top}>
        <Pressable onPress={()=>router.replace('/home')} style={s.back}><Text style={s.backText}>الرئيسية</Text></Pressable>
        <View style={{flex:1,alignItems:'flex-end'}}>
          <Text style={s.kicker}>HAYNA · ADMIN PRO</Text>
          <Text style={s.title}>مركز عمليات حيّنا</Text>
          <Text style={s.sub}>{profile?.display_name || profile?.username || 'مدير النظام'} · لوحة تفصيلية متقدمة</Text>
        </View>
        <Pressable onPress={onRefresh} style={s.refresh}><RefreshCw size={18} color="#fff"/></Pressable>
      </View>

      <ScrollView
        style={{flex:1}}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#059669"/>}
      >
        <AdminCommandCenter
          stats={stats} users={users} reports={reports} verifications={verifications}
          questions={questions} requests={requests} businesses={businesses}
          marketplace={marketplace} events={events}
          onTab={(tab)=>{}}
        />

        <Text style={s.sectionTitle}>خريطة التحكم السريعة</Text>
        <View style={s.quickGrid}>
          <Quick icon={<Users size={19} color="#0284C7"/>} value={users.length} label="المستخدمون"/>
          <Quick icon={<Flag size={19} color="#DC2626"/>} value={reports.filter(x=>x.status==='pending').length} label="بلاغات معلقة"/>
          <Quick icon={<ShieldCheck size={19} color="#D97706"/>} value={verifications.filter(x=>x.status==='pending').length} label="توثيق معلق"/>
          <Quick icon={<Building2 size={19} color="#0284C7"/>} value={businesses.length} label="الأعمال"/>
          <Quick icon={<Store size={19} color="#059669"/>} value={marketplace.length} label="السوق"/>
          <Quick icon={<CalendarDays size={19} color="#7C3AED"/>} value={events.length} label="الفعاليات"/>
        </View>
        <View style={s.tip}><Zap size={17} color="#059669"/><Text style={s.tipText}>هذه النسخة مبنية فوق البيانات الحقيقية المحملة من Supabase، بدون أرقام تجريبية.</Text></View>
      </ScrollView>
    </View>
  );
}

function Quick({icon,value,label}:any){
  return <View style={s.quick}><View style={s.qIcon}>{icon}</View><Text style={s.qValue}>{value}</Text><Text style={s.qLabel}>{label}</Text></View>;
}

const s=StyleSheet.create({
 page:{flex:1,backgroundColor:'#F1F5F9'},
 top:{paddingTop:48,paddingHorizontal:16,paddingBottom:14,backgroundColor:'#08111F',flexDirection:'row-reverse',alignItems:'center',gap:10},
 kicker:{fontSize:9,fontWeight:'900',color:'#5EEAD4',letterSpacing:1.2},title:{fontSize:21,fontWeight:'900',color:'#fff',marginTop:2},sub:{fontSize:10,color:'#94A3B8',marginTop:3},
 back:{paddingHorizontal:11,paddingVertical:8,borderRadius:11,backgroundColor:'#1E293B'},backText:{fontSize:10,fontWeight:'800',color:'#CBD5E1'},
 refresh:{width:38,height:38,borderRadius:12,backgroundColor:'#059669',alignItems:'center',justifyContent:'center'},
 content:{padding:14,paddingBottom:40},center:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:'#F8FAFC'},loading:{marginTop:12,fontSize:13,fontWeight:'800',color:'#475569'},
 sectionTitle:{fontSize:16,fontWeight:'900',color:'#0F172A',textAlign:'right',marginTop:5,marginBottom:10},
 quickGrid:{flexDirection:'row-reverse',flexWrap:'wrap',gap:8},quick:{flexGrow:1,flexBasis:145,minWidth:140,backgroundColor:'#fff',borderRadius:17,padding:13,borderWidth:1,borderColor:'#E2E8F0'},qIcon:{width:36,height:36,borderRadius:12,backgroundColor:'#F8FAFC',alignItems:'center',justifyContent:'center',marginBottom:8},qValue:{fontSize:20,fontWeight:'900',color:'#0F172A'},qLabel:{fontSize:10,fontWeight:'800',color:'#64748B',marginTop:2,textAlign:'right'},tip:{marginTop:12,backgroundColor:'#ECFDF5',borderRadius:14,padding:12,flexDirection:'row-reverse',alignItems:'center',gap:8,borderWidth:1,borderColor:'#A7F3D0'},tipText:{flex:1,fontSize:10,fontWeight:'700',color:'#047857',textAlign:'right',lineHeight:16}
});
