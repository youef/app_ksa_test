import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Activity, AlertTriangle, ArrowUpLeft, BarChart3, CheckCircle2, Clock3, MapPin, ShieldCheck, TrendingUp, Users, Zap } from 'lucide-react-native';

type Props = {
  stats: any;
  users: any[];
  reports: any[];
  verifications: any[];
  questions: any[];
  requests: any[];
  businesses: any[];
  marketplace: any[];
  events: any[];
  onTab: (tab: any) => void;
};

const COLORS = {
  ink: '#0F172A',
  muted: '#64748B',
  line: '#E2E8F0',
  soft: '#F8FAFC',
  green: '#059669',
  blue: '#0284C7',
  amber: '#D97706',
  red: '#DC2626',
  purple: '#7C3AED',
};

function MiniBar({ value, max, label, meta }: { value: number; max: number; label: string; meta: string }) {
  const pct = max > 0 ? Math.max(4, Math.min(100, (value / max) * 100)) : 4;
  return (
    <View style={s.barRow}>
      <View style={s.barMeta}><Text style={s.barLabel}>{label}</Text><Text style={s.barValue}>{meta}</Text></View>
      <View style={s.barTrack}><View style={[s.barFill, { width: pct + '%' }]} /></View>
    </View>
  );
}

function Kpi({ icon, value, label, sub, tone }: any) {
  return (
    <View style={s.kpi}>
      <View style={[s.kpiIcon, { backgroundColor: tone + '16' }]}>{icon}</View>
      <Text style={s.kpiValue}>{value}</Text>
      <Text style={s.kpiLabel}>{label}</Text>
      <Text style={s.kpiSub}>{sub}</Text>
    </View>
  );
}

export default function AdminCommandCenter({ stats, users, reports, verifications, questions, requests, businesses, marketplace, events, onTab }: Props) {
  const pendingReports = reports.filter(r => r.status === 'pending');
  const pendingVerifications = verifications.filter(v => v.status === 'pending');
  const banned = users.filter(u => u.is_banned).length;
  const verified = users.filter(u => u.is_verified).length;
  const geoVerified = users.filter(u => u.is_geoverified).length;
  const activeRecent = users.filter(u => {
    const d = u.updated_at || u.created_at;
    if (!d) return false;
    return Date.now() - new Date(d).getTime() < 7 * 86400000;
  }).length;

  const cityStats = useMemo(() => {
    const map: Record<string, number> = {};
    users.forEach(u => { const c = String(u.city || 'غير محدد').trim() || 'غير محدد'; map[c] = (map[c] || 0) + 1; });
    return Object.entries(map).sort((a,b) => b[1] - a[1]).slice(0, 6);
  }, [users]);

  const maxCity = Math.max(1, ...cityStats.map(x => x[1]));
  const totalPending = pendingReports.length + pendingVerifications.length;
  const healthScore = Math.max(72, 100 - Math.min(24, pendingReports.length * 2) - Math.min(16, pendingVerifications.length));

  const priorities = [
    pendingReports.length > 0 ? { icon: <AlertTriangle size={17} color={COLORS.red}/>, title: 'بلاغات تحتاج قراراً', value: pendingReports.length, tab: 'reports', tone: COLORS.red } : null,
    pendingVerifications.length > 0 ? { icon: <ShieldCheck size={17} color={COLORS.amber}/>, title: 'طلبات توثيق بانتظار المراجعة', value: pendingVerifications.length, tab: 'verifications', tone: COLORS.amber } : null,
    banned > 0 ? { icon: <Users size={17} color={COLORS.purple}/>, title: 'حسابات محظورة', value: banned, tab: 'users', tone: COLORS.purple } : null,
  ].filter(Boolean) as any[];

  return (
    <View>
      <View style={s.hero}>
        <View style={s.heroTop}>
          <View>
            <Text style={s.eyebrow}>COMMAND CENTER · LIVE</Text>
            <Text style={s.heroTitle}>الصورة الكاملة للمنصة</Text>
            <Text style={s.heroSub}>قراءة تشغيلية سريعة + مؤشرات تساعدك على اتخاذ القرار الآن.</Text>
          </View>
          <View style={s.score}><Text style={s.scoreValue}>{healthScore}</Text><Text style={s.scoreLabel}>صحة التشغيل</Text></View>
        </View>
        <View style={s.heroStats}>
          <View><Text style={s.heroStatValue}>{activeRecent}</Text><Text style={s.heroStatLabel}>نشاط خلال 7 أيام*</Text></View>
          <View><Text style={s.heroStatValue}>{totalPending}</Text><Text style={s.heroStatLabel}>مهام تحتاج قراراً</Text></View>
          <View><Text style={s.heroStatValue}>{verified}</Text><Text style={s.heroStatLabel}>توثيق رسمي</Text></View>
          <View><Text style={s.heroStatValue}>{geoVerified}</Text><Text style={s.heroStatLabel}>توثيق سكن</Text></View>
        </View>
        <Text style={s.footnote}>* محسوب من آخر تحديث/إنشاء متاح في بيانات الحسابات، وليس جلسات الدخول.</Text>
      </View>

      <View style={s.grid}>
        <Kpi icon={<Users size={19} color={COLORS.blue}/>} value={stats.users} label="المستخدمون" sub={stats.admins + ' مدير'} tone={COLORS.blue}/>
        <Kpi icon={<TrendingUp size={19} color={COLORS.green}/>} value={stats.questions} label="الاستفسارات" sub={questions.length + ' معروض الآن'} tone={COLORS.green}/>
        <Kpi icon={<Zap size={19} color={COLORS.amber}/>} value={stats.requests} label="الفزعات" sub={requests.length + ' معروض الآن'} tone={COLORS.amber}/>
        <Kpi icon={<BarChart3 size={19} color={COLORS.purple}/>} value={stats.businesses + stats.marketplace + stats.events} label="موارد المنصة" sub="أعمال + سوق + فعاليات" tone={COLORS.purple}/>
      </View>

      <View style={s.card}>
        <View style={s.cardHead}><View><Text style={s.cardTitle}>مركز الأولويات</Text><Text style={s.cardSub}>ابدأ بما قد يؤثر على الثقة والسلامة.</Text></View><Activity size={19} color={COLORS.green}/></View>
        {priorities.length ? priorities.map((p, i) => (
          <Pressable key={i} onPress={() => onTab(p.tab)} style={s.priority}>
            <View style={[s.priorityIcon, { backgroundColor: p.tone + '12' }]}>{p.icon}</View>
            <View style={{ flex: 1 }}><Text style={s.priorityTitle}>{p.title}</Text><Text style={s.prioritySub}>فتح القسم ومراجعة العناصر فوراً</Text></View>
            <View style={s.priorityCount}><Text style={{ color: p.tone, fontWeight: '900', fontSize: 14 }}>{p.value}</Text><ArrowUpLeft size={14} color={COLORS.muted}/></View>
          </Pressable>
        )) : (
          <View style={s.clear}><CheckCircle2 size={22} color={COLORS.green}/><View><Text style={s.priorityTitle}>لا توجد مهام حرجة حالياً</Text><Text style={s.prioritySub}>مركز العمليات نظيف — استمر بالمراقبة.</Text></View></View>
        )}
      </View>

      <View style={s.twoCol}>
        <View style={[s.card, s.flexCard]}>
          <View style={s.cardHead}><View><Text style={s.cardTitle}>التوزيع الجغرافي</Text><Text style={s.cardSub}>أكثر المدن حضوراً في البيانات الحالية.</Text></View><MapPin size={18} color={COLORS.blue}/></View>
          {cityStats.length ? cityStats.map(([city, count]) => <MiniBar key={city} value={count} max={maxCity} label={city} meta={String(count)}/>) : <Text style={s.empty}>لا توجد بيانات مدن.</Text>}
        </View>

        <View style={[s.card, s.flexCard]}>
          <View style={s.cardHead}><View><Text style={s.cardTitle}>صحة المجتمع</Text><Text style={s.cardSub}>مؤشرات الثقة والإدارة.</Text></View><ShieldCheck size={18} color={COLORS.green}/></View>
          <MiniBar value={verified} max={Math.max(1, users.length)} label="توثيق رسمي" meta={users.length ? Math.round(verified / users.length * 100) + '%' : '0%'}/>
          <MiniBar value={geoVerified} max={Math.max(1, users.length)} label="توثيق السكن" meta={users.length ? Math.round(geoVerified / users.length * 100) + '%' : '0%'}/>
          <MiniBar value={banned} max={Math.max(1, users.length)} label="حسابات محظورة" meta={users.length ? Math.round(banned / users.length * 100) + '%' : '0%'}/>
          <MiniBar value={pendingReports.length} max={Math.max(1, users.length)} label="ضغط البلاغات" meta={String(pendingReports.length)}/>
        </View>
      </View>

      <View style={s.card}>
        <View style={s.cardHead}><View><Text style={s.cardTitle}>تشغيل المنصة</Text><Text style={s.cardSub}>لقطة واحدة لكل مورد رئيسي.</Text></View><Clock3 size={18} color={COLORS.muted}/></View>
        <View style={s.opsGrid}>
          {[['الأعمال', businesses.length, COLORS.blue, 'platform'], ['السوق', marketplace.length, COLORS.green, 'platform'], ['الفعاليات', events.length, COLORS.purple, 'platform'], ['البلاغات', pendingReports.length, COLORS.red, 'reports']].map(([label, value, tone, tab]: any) => (
            <Pressable key={label} onPress={() => onTab(tab)} style={s.opItem}>
              <View style={[s.opDot, { backgroundColor: tone }]} />
              <Text style={s.opValue}>{value}</Text><Text style={s.opLabel}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Text style={s.note}>ملاحظة: لا توجد أرقام وهمية أو اتصال اصطناعي؛ هذه اللوحة تعيد تنظيم البيانات التي تم تحميلها بالفعل من قاعدة بيانات الإدارة.</Text>
    </View>
  );
}

const s = StyleSheet.create({
  hero:{backgroundColor:'#0B1220',borderRadius:22,padding:18,marginBottom:12},
  heroTop:{flexDirection:'row-reverse',justifyContent:'space-between',alignItems:'flex-start',gap:12},
  eyebrow:{color:'#5EEAD4',fontSize:9,fontWeight:'900',letterSpacing:1.2,textAlign:'right'},
  heroTitle:{color:'#fff',fontSize:20,fontWeight:'900',textAlign:'right',marginTop:4},
  heroSub:{color:'#94A3B8',fontSize:11,lineHeight:18,textAlign:'right',marginTop:4,maxWidth:420},
  score:{width:72,height:72,borderRadius:20,borderWidth:1,borderColor:'rgba(94,234,212,.3)',backgroundColor:'rgba(16,185,129,.08)',alignItems:'center',justifyContent:'center'},
  scoreValue:{color:'#5EEAD4',fontSize:22,fontWeight:'900'},scoreLabel:{color:'#CBD5E1',fontSize:8,fontWeight:'800'},
  heroStats:{flexDirection:'row-reverse',justifyContent:'space-between',marginTop:18,paddingTop:14,borderTopWidth:1,borderTopColor:'#1E293B'},
  heroStatValue:{color:'#fff',fontSize:17,fontWeight:'900',textAlign:'center'},heroStatLabel:{color:'#94A3B8',fontSize:9,textAlign:'center',marginTop:2},
  footnote:{color:'#64748B',fontSize:8,textAlign:'right',marginTop:12},
  grid:{flexDirection:'row-reverse',flexWrap:'wrap',gap:8,marginBottom:12},
  kpi:{flexGrow:1,flexBasis:150,backgroundColor:'#fff',borderWidth:1,borderColor:COLORS.line,borderRadius:18,padding:12,minWidth:145},
  kpiIcon:{width:36,height:36,borderRadius:12,alignItems:'center',justifyContent:'center',marginBottom:7},kpiValue:{fontSize:21,fontWeight:'900',color:COLORS.ink},kpiLabel:{fontSize:11,fontWeight:'900',color:'#334155',marginTop:2,textAlign:'right'},kpiSub:{fontSize:9,color:'#94A3B8',marginTop:2,textAlign:'right'},
  card:{backgroundColor:'#fff',borderWidth:1,borderColor:COLORS.line,borderRadius:18,padding:14,marginBottom:12},
  cardHead:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'space-between',marginBottom:11},
  cardTitle:{fontSize:14,fontWeight:'900',color:COLORS.ink,textAlign:'right'},cardSub:{fontSize:10,color:COLORS.muted,textAlign:'right',marginTop:2},
  priority:{flexDirection:'row-reverse',alignItems:'center',gap:10,paddingVertical:10,borderTopWidth:1,borderTopColor:'#F1F5F9'},
  priorityIcon:{width:36,height:36,borderRadius:12,alignItems:'center',justifyContent:'center'},priorityTitle:{fontSize:12,fontWeight:'900',color:COLORS.ink,textAlign:'right'},prioritySub:{fontSize:9,color:COLORS.muted,textAlign:'right',marginTop:2},
  priorityCount:{flexDirection:'row-reverse',alignItems:'center',gap:4,paddingHorizontal:8,paddingVertical:6,borderRadius:10,backgroundColor:'#F8FAFC'},
  clear:{flexDirection:'row-reverse',alignItems:'center',gap:10,paddingVertical:10},
  twoCol:{flexDirection:'row-reverse',gap:12},flexCard:{flex:1,minWidth:280},
  barRow:{marginBottom:10}.barMeta:{flexDirection:'row-reverse',justifyContent:'space-between',marginBottom:5}.barLabel:{fontSize:10,color:'#475569',fontWeight:'800'}.barValue:{fontSize:10,color:'#0F172A',fontWeight:'900'},
  barTrack:{height:7,backgroundColor:'#F1F5F9',borderRadius:7,overflow:'hidden'},barFill:{height:7,backgroundColor:'#0EA5A4',borderRadius:7},
  empty:{color:'#94A3B8',fontSize:11,textAlign:'right',paddingVertical:10},
  opsGrid:{flexDirection:'row-reverse',flexWrap:'wrap',gap:8},
  opItem:{flexGrow:1,flexBasis:120,backgroundColor:'#F8FAFC',borderRadius:14,padding:12,alignItems:'flex-end',borderWidth:1,borderColor:'#EEF2F7'},
  opDot:{width:7,height:7,borderRadius:4,marginBottom:7},opValue:{fontSize:18,fontWeight:'900',color:COLORS.ink},opLabel:{fontSize:10,fontWeight:'800',color:COLORS.muted,marginTop:2},
  note:{fontSize:9,color:'#94A3B8',textAlign:'right',lineHeight:15,marginBottom:18}
});
