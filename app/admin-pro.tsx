import { OasisPressable as Pressable, OasisSurface } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import { HeaderAction, AppHeader } from '@/components/shared/AppHeader';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { BarChart3, Building2, CalendarDays, Check, Flag, MapPin, RefreshCw, ShieldCheck, Store, Users, X, Zap } from 'lucide-react-native';
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
  const [services, setServices] = useState<any[]>([]);
  const [reviewBusy, setReviewBusy] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { router.replace('/auth'); return; }
    const { data: pr } = await supabase.from('profiles').select('*').eq('id', auth.user.id).maybeSingle();
    if (!pr || pr.role !== 'admin') { router.replace('/home'); return; }
    setProfile(pr);

    const [u,r,v,q,req,b,m,e,srv] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at',{ascending:false}).limit(1000),
      supabase.from('reports').select('*').order('created_at',{ascending:false}).limit(1000),
      supabase.from('verification_requests').select('*').order('created_at',{ascending:false}).limit(1000),
      supabase.from('questions').select('id').order('created_at',{ascending:false}).limit(100),
      supabase.from('requests').select('id').order('created_at',{ascending:false}).limit(100),
      supabase.from('businesses').select('*').order('created_at',{ascending:false}).limit(500),
      supabase.from('marketplace_items').select('*').order('created_at',{ascending:false}).limit(500),
      supabase.from('events').select('*').order('created_at',{ascending:false}).limit(500),
      supabase.from('services').select('*, provider:provider_id(display_name, username)').order('created_at',{ascending:false}).limit(500),
    ]);
    const usersData=u.data||[], reportsData=r.data||[], verifData=v.data||[];
    setUsers(usersData); setReports(reportsData); setVerifications(verifData); setQuestions(q.data||[]); setRequests(req.data||[]);
    setBusinesses(b.data||[]); setMarketplace(m.data||[]); setEvents(e.data||[]);
    setServices(srv.data||[]);
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

  const reviewEntry = async (table: 'services' | 'businesses' | 'events', row: any, approve: boolean) => {
    const key = `${table}:${row.id}`;
    setReviewBusy(key);
    try {
      const { error } = await supabase.from(table).update({ moderation_status: approve ? 'approved' : 'rejected' }).eq('id', row.id);
      if (error) throw error;
      await load();
    } catch (error: any) {
      Alert.alert('تعذر تحديث الاعتماد', error?.message || 'تعذر تحديث حالة الطلب.');
    } finally {
      setReviewBusy(null);
    }
  };

  if (loading) return <View style={s.center}><ActivityIndicator size="large" color={OASIS.colors.primary}/><Text style={s.loading}>جاري تجهيز مركز العمليات المتقدم...</Text></View>;

  return (
    <View style={s.page}>
      <AppHeader
        variant="sub"
        title="مركز عمليات حيّنا المتقدم"
        subtitle={`${profile?.display_name || profile?.username || 'مدير النظام'} · ADMIN PRO`}
        fallbackRoute="/home"
        rightAction={
          <HeaderAction
            accessibilityLabel="تحديث البيانات" onPress={onRefresh}
            style={{
              width: 36,
              height: 36,
              borderRadius: 14,
              backgroundColor: '#f1f5f9',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <RefreshCw size={16} color={OASIS.colors.primary} />
          </HeaderAction>
        }
      />

      <ScrollView
        style={{flex:1}}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={OASIS.colors.primary}/>}
      >
        <AdminCommandCenter
          stats={stats} users={users} reports={reports} verifications={verifications}
          questions={questions} requests={requests} businesses={businesses}
          marketplace={marketplace} events={events}
          onTab={(tab)=>{}}
        />

        <Text style={s.sectionTitle}>مراجعة محتوى السوق والفعاليات</Text>
        <Text style={s.reviewHint}>لن يظهر المحتوى للناس حتى يعتمد من هنا.</Text>
        <View style={s.reviewList}>
          {[
            ...services.filter((x) => x.moderation_status === 'pending').map((row) => ({ table: 'services' as const, row, title: row.name || row.title, owner: row.provider?.display_name || 'مستخدم' })),
            ...businesses.filter((x) => x.moderation_status === 'pending').map((row) => ({ table: 'businesses' as const, row, title: row.name || 'منشأة', owner: row.owner_name || 'مستخدم' })),
            ...events.filter((x) => x.moderation_status === 'pending').map((row) => ({ table: 'events' as const, row, title: row.title || 'فعالية', owner: row.organizer_name || 'منظم' })),
          ].map(({ table, row, title, owner }) => {
            const key = `${table}:${row.id}`;
            return (
              <OasisSurface oasisSurface="card" key={key} style={s.reviewCard}>
                <View style={s.reviewCopy}>
                  <Text style={s.reviewTitle}>{title}</Text>
                  <Text style={s.reviewMeta}>{table === 'services' ? 'عرض سوق' : table === 'businesses' ? 'منشأة' : 'فعالية'} · {owner}</Text>
                </View>
                <Pressable disabled={reviewBusy === key} onPress={() => void reviewEntry(table, row, false)} style={[s.reviewAction, s.reject]}><X size={16} color={OASIS.colors.danger} /></Pressable>
                <Pressable disabled={reviewBusy === key} onPress={() => void reviewEntry(table, row, true)} style={[s.reviewAction, s.approve]}><Check size={16} color={OASIS.colors.primary} /></Pressable>
              </OasisSurface>
            );
          })}
          {!services.some((x) => x.moderation_status === 'pending') && !businesses.some((x) => x.moderation_status === 'pending') && !events.some((x) => x.moderation_status === 'pending') ? <Text style={s.emptyReview}>لا توجد طلبات اعتماد معلقة.</Text> : null}
        </View>

        <Text style={s.sectionTitle}>خريطة التحكم السريعة</Text>
        <View style={s.quickGrid}>
          <Quick icon={<Users size={19} color={OASIS.colors.info}/>} value={users.length} label="المستخدمون"/>
          <Quick icon={<Flag size={19} color={OASIS.colors.danger}/>} value={reports.filter(x=>x.status==='pending').length} label="بلاغات معلقة"/>
          <Quick icon={<ShieldCheck size={19} color="#D97706"/>} value={verifications.filter(x=>x.status==='pending').length} label="توثيق معلق"/>
          <Quick icon={<Building2 size={19} color={OASIS.colors.info}/>} value={businesses.length} label="الأعمال"/>
          <Quick icon={<Store size={19} color={OASIS.colors.primary}/>} value={marketplace.length} label="السوق"/>
          <Quick icon={<CalendarDays size={19} color="#7C3AED"/>} value={events.length} label="الفعاليات"/>
        </View>
        <View style={s.tip}><Zap size={17} color={OASIS.colors.primary}/><Text style={s.tipText}>هذه النسخة مبنية فوق البيانات الحقيقية المحملة من Supabase، بدون أرقام تجريبية.</Text></View>
      </ScrollView>
    </View>
  );
}

function Quick({icon,value,label}:any){
  return <View style={s.quick}><View style={s.qIcon}>{icon}</View><Text style={s.qValue}>{value}</Text><Text style={s.qLabel}>{label}</Text></View>;
}

const s=StyleSheet.create({
 page:{flex:1,backgroundColor:'#F1F5F9'},
 top:{paddingTop:24,paddingHorizontal:16,paddingBottom:14,backgroundColor:'#08111F',flexDirection:'row-reverse',alignItems:'center',gap:10},
 kicker:{fontSize:11,fontWeight:'700',color:'#5EEAD4',letterSpacing:1.2},title:{fontSize:21,fontWeight:'700',color:OASIS.colors.surface,marginTop:2},sub:{fontSize:11,color:'#94A3B8',marginTop:3},
 back:{paddingHorizontal:11,paddingVertical:8,borderRadius:11,backgroundColor:OASIS.colors.ink},backText:{fontSize:11,fontWeight:'600',color:'#CBD5E1'},
 refresh:{width:38,height:38,borderRadius:12,backgroundColor:OASIS.colors.primary,alignItems:'center',justifyContent:'center'},
 content:{padding:14,paddingBottom:24},center:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:OASIS.colors.background},loading:{marginTop:12,fontSize:13,fontWeight:'600',color:OASIS.colors.muted},
 reviewHint:{fontSize:12,color:OASIS.colors.muted,textAlign:'right',marginTop:-5,marginBottom:10},reviewList:{gap:8},reviewCard:{flexDirection:'row-reverse',alignItems:'center',gap:8,backgroundColor:OASIS.colors.surface,padding:12,borderRadius:16,borderWidth:1,borderColor:OASIS.colors.line},reviewCopy:{flex:1},reviewTitle:{fontSize:14,fontWeight:'700',color:OASIS.colors.ink,textAlign:'right'},reviewMeta:{fontSize:11,color:OASIS.colors.muted,textAlign:'right',marginTop:3},reviewAction:{width:36,height:36,borderRadius:12,alignItems:'center',justifyContent:'center'},approve:{backgroundColor:OASIS.colors.soft},reject:{backgroundColor:OASIS.colors.dangerSoft},emptyReview:{fontSize:12,color:OASIS.colors.muted,textAlign:'center',padding:14,backgroundColor:OASIS.colors.surface,borderRadius:14},
 sectionTitle:{fontSize:16,fontWeight:'700',color:OASIS.colors.ink,textAlign:'right',marginTop:5,marginBottom:10},
 quickGrid:{flexDirection:'row-reverse',flexWrap:'wrap',gap:8},quick:{flexGrow:1,flexBasis:145,minWidth:140,backgroundColor:OASIS.colors.surface,borderRadius:17,padding:13,borderWidth:1,borderColor:OASIS.colors.line},qIcon:{width:36,height:36,borderRadius:12,backgroundColor:OASIS.colors.background,alignItems:'center',justifyContent:'center',marginBottom:8},qValue:{fontSize:20,fontWeight:'700',color:OASIS.colors.ink},qLabel:{fontSize:11,fontWeight:'600',color:OASIS.colors.muted,marginTop:2,textAlign:'right'},tip:{marginTop:12,backgroundColor:OASIS.colors.soft,borderRadius:14,padding:12,flexDirection:'row-reverse',alignItems:'center',gap:8,borderWidth:1,borderColor:'#A7F3D0'},tipText:{flex:1,fontSize:11,fontWeight:'700',color:OASIS.colors.primary,textAlign:'right',lineHeight:18}
});
