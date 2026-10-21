import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { ArrowUpRight, CheckCircle2, ChevronLeft, Clock, Flag, MapPin, Megaphone, MessageCircle, ShieldCheck, Users, Wrench } from 'lucide-react-native';
import { TrendChart, TrendPoint } from './AdminInsights';
import { AdminPulse, CommunityMix, MiniTrend } from './AdminPulse';
import { AdminActivityLog, AdminProfile, AdminReport, AdminStats, AdminUrgentAlert, AdminVerificationRequest } from './adminTypes';

type Destination = 'users' | 'reports' | 'verifications' | 'platform' | 'broadcast' | 'analytics' | 'logs' | 'content' | 'tasks';
interface Props {
  stats: AdminStats;
  users: AdminProfile[];
  reports: AdminReport[];
  verifications: AdminVerificationRequest[];
  urgentAlerts: AdminUrgentAlert[];
  logs: AdminActivityLog[];
  analytics: { users: TrendPoint[]; reports: TrendPoint[]; questions: TrendPoint[] };
  onNavigate: (tab: Destination) => void;
  onOpenUser: (user: AdminProfile) => void;
  onCity: (city: string) => void;
}
const n = (value: number) => value.toLocaleString('ar-SA');
const percent = (value: number): `${number}%` => `${Math.max(0, Math.min(100, value))}%`;
function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'تاريخ غير متاح' : date.toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' });
}
const ACTION_LABELS: Record<string, string> = {
  ban_user: 'حظر حساب', unban_user: 'إلغاء حظر حساب', verify_user: 'توثيق حساب',
  approve_verification: 'اعتماد طلب توثيق', reject_verification: 'رفض طلب توثيق',
  resolve_report: 'معالجة بلاغ', dismiss_report: 'إغلاق بلاغ', update_user: 'تحديث حساب',
  broadcast: 'إرسال تعميم', delete_content: 'إزالة محتوى',
};

export function AdminOverview(p: Props) {
  const wide = useWindowDimensions().width >= 850;
  const [queueFilter, setQueueFilter] = useState<'all' | 'reports' | 'verifications' | 'platform'>('all');
  const [expandedQueue, setExpandedQueue] = useState(false);
  const [period, setPeriod] = useState<7 | 30>(7);
  const [series, setSeries] = useState<'users' | 'questions' | 'reports'>('users');
  const queue = useMemo(() => [
    ...p.reports.filter(r => r.status === 'pending').map(r => ({ id: `report-${r.id}`, title: r.reason || 'بلاغ يحتاج إلى مراجعة', detail: r.reporter?.display_name || 'بلاغ من أحد الأعضاء', date: r.created_at, tab: 'reports' as const, label: 'بلاغ', color: '#B45143' })),
    ...p.verifications.filter(v => v.status === 'pending').map(v => ({ id: `verify-${v.id}`, title: v.subject || 'طلب توثيق حساب', detail: v.user?.display_name || v.user?.username || 'عضو المجتمع', date: v.created_at, tab: 'verifications' as const, label: 'توثيق', color: '#7B692D' })),
    ...p.urgentAlerts.filter(a => a.status === 'active').map(a => ({ id: `alert-${a.id}`, title: a.title, detail: [a.city, a.district].filter(Boolean).join(' · ') || 'تنبيه مجتمعي', date: a.created_at, tab: 'platform' as const, label: 'عاجل', color: '#B45143' })),
  ].sort((a, b) => Number(b.tab === 'platform') - Number(a.tab === 'platform') || new Date(a.date).getTime() - new Date(b.date).getTime()), [p.reports, p.verifications, p.urgentAlerts]);
  const cities = useMemo(() => {
    const counts = new Map<string, number>();
    p.users.forEach(u => { if (u.city?.trim()) counts.set(u.city.trim(), (counts.get(u.city.trim()) || 0) + 1); });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [p.users]);
  const overdue = queue.filter(q => Date.now() - new Date(q.date).getTime() > 48 * 3600000).length;
  const filteredQueue = queue.filter(item => queueFilter === 'all' || item.tab === queueFilter);
  const chart = p.analytics[series].slice(-period);
  const chartTotal = chart.reduce((total, point) => total + point.value, 0);
  const metrics = [
    { key: 'users' as const, label: 'أعضاء المجتمع', value: p.stats.users, sub: `${n(p.stats.admins)} مدير · ${n(p.stats.bannedUsers)} حساب محظور`, icon: Users, color: '#316E55', bg: '#E9F2E9' },
    { key: 'verifications' as const, label: 'حسابات موثّقة', value: p.stats.verifiedUsers, sub: `${n(p.stats.pendingVerifications)} طلب بانتظار المراجعة`, icon: ShieldCheck, color: '#8B712D', bg: '#F7F1DF' },
    { key: 'platform' as const, label: 'الخدمات والإعارة', value: p.stats.services + p.stats.borrowItems, sub: `${n(p.stats.services)} خدمة · ${n(p.stats.borrowItems)} أداة`, icon: Wrench, color: '#567689', bg: '#EAF1F6' },
    { key: 'content' as const, label: 'مشاركات المجتمع', value: p.stats.questions + p.stats.requests, sub: `${n(p.stats.questions)} سؤال · ${n(p.stats.requests)} طلب مساعدة`, icon: MessageCircle, color: '#847097', bg: '#F1ECF6' },
  ];
  return <View style={s.layout}>
    <AdminPulse stats={p.stats} reports={p.reports} verifications={p.verifications} pending={queue.length} overdue={overdue} onTasks={() => p.onNavigate('tasks')} onBroadcast={() => p.onNavigate('broadcast')} />
    <View style={s.metrics}>{metrics.map(m => <Pressable accessibilityRole="button" key={m.label} onPress={() => p.onNavigate(m.key)} style={({ pressed }) => [s.metric, { flexBasis: wide ? '22%' : '45%' }, pressed && s.pressed]}>
      <View style={s.metricTop}><View style={[s.metricIcon, { backgroundColor: m.bg }]}><m.icon size={19} color={m.color} /></View><ArrowUpRight size={15} color="#A4AFA6" /></View>
      <Text style={s.metricLabel}>{m.label}</Text><Text style={s.metricValue}>{n(m.value)}</Text><Text style={s.metricSub}>{m.sub}</Text>
      <View style={s.metricBottom}>{m.key === 'users' || m.key === 'content' ? <MiniTrend points={m.key === 'users' ? p.analytics.users : p.analytics.questions} color={m.color} /> : <View style={s.metricTrack}><View style={[s.metricFill, { backgroundColor: m.color, width: percent(m.key === 'verifications' ? (p.stats.users ? p.stats.verifiedUsers / p.stats.users * 100 : 0) : (p.stats.services + p.stats.borrowItems ? p.stats.services / (p.stats.services + p.stats.borrowItems) * 100 : 0)) }]} /></View>}<Text style={s.metricFoot}>{m.key === 'users' || m.key === 'content' ? 'اتجاه ١٤ يومًا' : m.key === 'verifications' ? 'نسبة الموثّقين في الحسابات المحمّلة' : 'حصة الخدمات من الموارد'}</Text></View>
    </Pressable>)}</View>
    <View style={s.note}><Text style={s.noteText}>نطاق الملخص: أحدث {n(p.users.length)} حساب، وطلبات المراجعة المحمّلة. أعداد الخدمات والمشاركات من إجماليات المنصة؛ الاتجاهات من بيانات آخر ٣٠ يومًا.</Text></View>
    <View style={[s.columns, !wide && s.stack]}>
      <View style={[s.card, s.primaryColumn]}>
        <SectionTitle title="نمو المجتمع وتفاعله" subtitle="اختر المؤشر والفترة لاستعراض الاتجاه" />
        <View style={s.controls}>
          <View style={s.segment}>{([{ key: 'users', label: 'الأعضاء' }, { key: 'questions', label: 'الأسئلة' }, { key: 'reports', label: 'البلاغات' }] as const).map(t => <Pressable accessibilityRole="button" accessibilityState={{ selected: series === t.key }} key={t.key} onPress={() => setSeries(t.key)} style={[s.segmentItem, series === t.key && s.segmentActive]}><Text style={[s.segmentText, series === t.key && s.segmentTextActive]}>{t.label}</Text></Pressable>)}</View>
          <View style={s.segment}>{([7, 30] as const).map(d => <Pressable accessibilityRole="button" accessibilityState={{ selected: period === d }} key={d} onPress={() => setPeriod(d)} style={[s.segmentItem, period === d && s.segmentActive]}><Text style={[s.segmentText, period === d && s.segmentTextActive]}>{n(d)} {d === 7 ? 'أيام' : 'يومًا'}</Text></Pressable>)}</View>
        </View>
        <View style={s.chartSummary}><Text style={s.chartValue}>{n(chartTotal)}</Text><Text style={s.smallText}>خلال الفترة المحددة</Text></View>
        {chart.length ? <TrendChart data={chart} color="#38765A" height={165} /> : <Empty text="تظهر الاتجاهات هنا بعد تحميل بيانات النشاط." />}
        <Pressable accessibilityRole="button" onPress={() => p.onNavigate('analytics')} style={s.link}><Text style={s.linkText}>استعراض التحليلات التفصيلية</Text><ChevronLeft size={14} color="#38765A" /></Pressable>
      </View>
      <View style={[s.card, s.secondaryColumn]}>
        <SectionTitle title="أولويات اليوم" subtitle="انتقل مباشرة إلى العناصر المعلقة" />
        {[
          { title: 'البلاغات الواردة', value: p.stats.pendingReports, tab: 'reports' as const, icon: Flag, color: '#B45143', bg: '#FAEDE8' },
          { title: 'طلبات التوثيق', value: p.stats.pendingVerifications, tab: 'verifications' as const, icon: ShieldCheck, color: '#8B712D', bg: '#F7F1DF' },
          { title: 'التنبيهات العاجلة', value: p.stats.urgentAlerts, tab: 'platform' as const, icon: Clock, color: '#6A6393', bg: '#F0EDF6' },
        ].map(item => <Pressable accessibilityRole="button" key={item.tab} onPress={() => p.onNavigate(item.tab)} style={s.priorityRow}><View style={[s.metricIcon, { backgroundColor: item.bg }]}><item.icon size={17} color={item.color} /></View><Text style={s.rowTitle}>{item.title}</Text><Text style={[s.priorityCount, { color: item.color }]}>{n(item.value)}</Text><ChevronLeft size={14} color="#9BA89C" /></Pressable>)}
        <View style={s.overdue}><Clock size={16} color="#8B712D" /><Text style={s.overdueText}>{overdue ? `${n(overdue)} عنصرًا تجاوز انتظارها ٤٨ ساعة` : 'لا توجد عناصر محمّلة تجاوزت ٤٨ ساعة'}</Text></View>
        <Pressable accessibilityRole="button" onPress={() => p.onNavigate('broadcast')} style={s.announcement}><Megaphone size={19} color="#38765A" /><View style={{ flex: 1 }}><Text style={s.announcementTitle}>تواصل مع المجتمع</Text><Text style={s.smallText}>إنشاء تعميم أو جدولة إشعار</Text></View><ChevronLeft size={16} color="#38765A" /></Pressable>
      </View>
    </View>
    <CommunityMix stats={p.stats} />
    <View style={s.card}>
      <SectionTitle title="قائمة المراجعة" subtitle="العاجل أولًا، ثم الأقدم انتظارًا" action="جميع المهام" onAction={() => p.onNavigate('tasks')} />
      <View style={s.queueFilters}>{([{ key: 'all', label: 'الكل' }, { key: 'reports', label: 'البلاغات' }, { key: 'verifications', label: 'التوثيق' }, { key: 'platform', label: 'العاجل' }] as const).map(filter => <Pressable key={filter.key} accessibilityRole="button" accessibilityState={{ selected: queueFilter === filter.key }} onPress={() => { setQueueFilter(filter.key); setExpandedQueue(false); }} style={[s.queueFilter, queueFilter === filter.key && s.queueFilterActive]}><Text style={[s.queueFilterText, queueFilter === filter.key && s.queueFilterTextActive]}>{filter.label}</Text><Text style={s.filterCount}>{n(queue.filter(item => filter.key === 'all' || item.tab === filter.key).length)}</Text></Pressable>)}</View>
      {filteredQueue.length ? filteredQueue.slice(0, expandedQueue ? filteredQueue.length : 5).map(item => <Pressable accessibilityRole="button" key={item.id} onPress={() => p.onNavigate(item.tab)} style={s.queueRow}><View style={[s.queueDot, { backgroundColor: item.color }]} /><View style={s.rowCopy}><Text numberOfLines={1} style={s.rowTitle}>{item.title}</Text><Text numberOfLines={1} style={s.smallText}>{item.detail} · {dateLabel(item.date)}</Text></View><Text style={[s.typeBadge, { color: item.color }]}>{item.label}</Text><ChevronLeft size={16} color="#8DA08E" /></Pressable>) : <Empty text="لا توجد عناصر مطابقة في قائمة المراجعة." />}
      {filteredQueue.length > 5 ? <Pressable accessibilityRole="button" onPress={() => setExpandedQueue(value => !value)} style={s.expandQueue}><Text style={s.linkText}>{expandedQueue ? 'عرض أقل' : 'عرض ' + n(filteredQueue.length - 5) + ' عناصر إضافية'}</Text><ChevronLeft size={14} color="#38765A" /></Pressable> : null}
    </View>
    <View style={[s.columns, !wide && s.stack]}>
      <View style={[s.card, s.primaryColumn]}><SectionTitle title="أحدث أعضاء المجتمع" subtitle="ملفات الأعضاء الجدد، جاهزة للمراجعة" action="عرض الجميع" onAction={() => p.onNavigate('users')} />
        {p.users.length ? p.users.slice(0, 5).map(u => <Pressable accessibilityRole="button" accessibilityLabel={`فتح ملف ${u.display_name || u.username || 'العضو'}`} key={u.id} onPress={() => p.onOpenUser(u)} style={s.queueRow}><View style={s.userAvatar}><Text style={s.userInitial}>{(u.display_name || u.username || 'ع').slice(0, 1)}</Text></View><View style={s.rowCopy}><Text numberOfLines={1} style={s.rowTitle}>{u.display_name || u.username || 'عضو جديد'}</Text><Text numberOfLines={1} style={s.smallText}>{[u.city, u.district].filter(Boolean).join(' · ') || 'الموقع غير محدد'}</Text></View><Text style={[s.typeBadge, u.is_banned && { color: '#B45143' }]}>{u.is_banned ? 'محظور' : u.is_verified ? 'موثّق' : 'عضو'}</Text><Text style={s.date}>{dateLabel(u.created_at)}</Text></Pressable>) : <Empty text="لا توجد حسابات لعرضها." />}
      </View>
      <View style={[s.card, s.secondaryColumn]}><SectionTitle title="المجتمع على الخريطة" subtitle="أكثر المدن حضورًا في الحسابات المحمّلة" />
        {cities.length ? cities.map(([city, count], index) => <Pressable accessibilityRole="button" accessibilityLabel={`عرض أعضاء ${city}`} onPress={() => p.onCity(city)} key={city} style={s.city}><View style={s.cityHeader}><View style={s.cityName}><MapPin size={13} color="#68846A" /><Text style={s.rowTitle}>{city}</Text></View><Text style={s.smallText}>{n(count)} عضو</Text></View><View style={s.track}><View style={[s.bar, { width: `${count / Math.max(1, cities[0][1]) * 100}%`, opacity: 1 - index * 0.12 }]} /></View></Pressable>) : <Empty text="تظهر المدن عند إضافة الأعضاء لمواقعهم." />}
        <Text style={s.moreNote}>{n(p.users.filter(u => !u.city?.trim()).length)} حسابًا لم يحدد المدينة</Text>
      </View>
    </View>
    <View style={s.card}><SectionTitle title="آخر العمليات الإدارية" subtitle="سجل القرارات والتعديلات الأخيرة" action="فتح السجل" onAction={() => p.onNavigate('logs')} />
      {p.logs.length ? p.logs.slice(0, 4).map(log => <View key={log.id} style={s.queueRow}><View style={s.logIcon}><CheckCircle2 size={16} color="#68846A" /></View><View style={s.rowCopy}><Text style={s.rowTitle}>{ACTION_LABELS[log.action] || log.action}</Text><Text style={s.smallText}>{log.actor?.display_name || log.actor?.username || 'مدير المنصة'}{log.metadata?.target_name ? ` · ${log.metadata.target_name}` : ''}</Text></View><Text style={s.date}>{dateLabel(log.created_at)}</Text></View>) : <Empty text="لا توجد عمليات إدارية مسجّلة للعرض." />}
    </View>
  </View>;
}

function SectionTitle({ title, subtitle, action, onAction }: { title: string; subtitle: string; action?: string; onAction?: () => void }) {
  return <View style={s.sectionHeader}><View style={{ flex: 1 }}><Text accessibilityRole="header" style={s.cardTitle}>{title}</Text><Text style={s.cardSubtitle}>{subtitle}</Text></View>{action ? <Pressable accessibilityRole="button" onPress={onAction} style={s.link}><Text style={s.linkText}>{action}</Text><ChevronLeft size={13} color="#38765A" /></Pressable> : null}</View>;
}
function Empty({ text }: { text: string }) { return <View style={s.empty}><CheckCircle2 size={25} color="#94AF98" /><Text style={s.emptyText}>{text}</Text></View>; }

const s = StyleSheet.create({
  metricBottom: { marginTop: 16, minHeight: 60, justifyContent: 'flex-end', alignItems: 'flex-end', gap: 9, borderTopWidth: 1, borderColor: '#F0F4F0', paddingTop: 10 }, metricFoot: { color: '#8B9D91', fontSize: 8, textAlign: 'right' }, metricTrack: { width: '100%', height: 5, backgroundColor: '#EFF3ED', borderRadius: 5, overflow: 'hidden', alignItems: 'flex-end', marginVertical: 15 }, metricFill: { height: 5, borderRadius: 5 },
  queueFilters: { flexDirection: 'row-reverse', gap: 7, flexWrap: 'wrap', marginBottom: 16 }, queueFilter: { flexDirection: 'row-reverse', alignItems: 'center', gap: 7, paddingHorizontal: 11, minHeight: 36, borderRadius: 9, borderWidth: 1, borderColor: '#E6ECE5', backgroundColor: '#FAFCF8' }, queueFilterActive: { backgroundColor: '#244F3B', borderColor: '#244F3B' }, queueFilterText: { color: '#7E9485', fontSize: 10 }, queueFilterTextActive: { color: '#EAF7DF', fontWeight: '800' }, filterCount: { color: '#6C8F71', backgroundColor: '#E4EFDD', paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, fontSize: 9 }, expandQueue: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, marginTop: 10, backgroundColor: '#F3F7F0', borderRadius: 10 },
  layout: { gap: 22 },
  metrics: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 12 }, metric: { flexGrow: 1, minWidth: 130, padding: 18, backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#DFE8E0' }, metricTop: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }, metricIcon: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, metricLabel: { color: '#7C877C', fontSize: 12, textAlign: 'right' }, metricValue: { fontSize: 35, fontWeight: '900', color: '#233F2C', textAlign: 'right', marginVertical: 5 }, metricSub: { fontSize: 10, lineHeight: 18, color: '#849080', textAlign: 'right' },
  note: { paddingHorizontal: 4 }, noteText: { fontSize: 10, lineHeight: 18, color: '#899184', textAlign: 'right' },
  columns: { flexDirection: 'row-reverse', gap: 18, alignItems: 'stretch' }, stack: { flexDirection: 'column' }, primaryColumn: { flex: 1.65, minWidth: 0 }, secondaryColumn: { flex: 1, minWidth: 0 },
  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E1E7DE', borderRadius: 20, padding: 22, overflow: 'hidden' }, sectionHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, marginBottom: 18 }, cardTitle: { color: '#294632', fontSize: 15, fontWeight: '800', textAlign: 'right' }, cardSubtitle: { color: '#8B9486', fontSize: 10, textAlign: 'right', lineHeight: 18, marginTop: 5 },
  controls: { flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, segment: { backgroundColor: '#F4F6F1', borderRadius: 9, padding: 3, flexDirection: 'row-reverse', gap: 2 }, segmentItem: { borderRadius: 7, paddingHorizontal: 10, minHeight: 32, alignItems: 'center', justifyContent: 'center' }, segmentActive: { backgroundColor: '#FFFFFF' }, segmentText: { color: '#899281', fontSize: 10 }, segmentTextActive: { color: '#315B3E', fontWeight: '800' }, chartSummary: { flexDirection: 'row-reverse', gap: 9, alignItems: 'center', marginVertical: 16 }, chartValue: { fontSize: 26, color: '#315B3E', fontWeight: '800' },
  smallText: { color: '#8A9484', fontSize: 10, lineHeight: 19, textAlign: 'right' }, link: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, paddingVertical: 10 }, linkText: { color: '#38765A', fontWeight: '700', fontSize: 10 },
  priorityRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, paddingVertical: 13, borderBottomWidth: 1, borderColor: '#F0F3EC' }, rowTitle: { flexShrink: 1, color: '#3C503D', fontSize: 12, fontWeight: '600', textAlign: 'right' }, priorityCount: { fontSize: 20, fontWeight: '800', marginLeft: 'auto' },
  overdue: { flexDirection: 'row-reverse', gap: 7, alignItems: 'center', paddingVertical: 15 }, overdueText: { color: '#8B712D', fontSize: 10, textAlign: 'right', flex: 1, lineHeight: 18 }, announcement: { backgroundColor: '#F1F5ED', borderRadius: 11, padding: 14, flexDirection: 'row-reverse', gap: 10, alignItems: 'center' }, announcementTitle: { color: '#315B3E', fontSize: 12, fontWeight: '700', textAlign: 'right' },
  queueRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, borderTopWidth: 1, borderColor: '#EFF2EB', paddingVertical: 15 }, queueDot: { width: 7, height: 7, borderRadius: 4 }, rowCopy: { flex: 1, gap: 3, minWidth: 0 }, typeBadge: { fontSize: 10, color: '#51765B', backgroundColor: '#F5F6F0', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 6 }, date: { color: '#94A08D', fontSize: 9 },
  userAvatar: { backgroundColor: '#EDF2E7', width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, userInitial: { color: '#6C8866', fontWeight: '800', fontSize: 14 }, city: { paddingVertical: 11, gap: 9 }, cityHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }, cityName: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5 }, track: { height: 6, borderRadius: 4, backgroundColor: '#F1F4EC', alignItems: 'flex-end' }, bar: { height: 6, borderRadius: 4, backgroundColor: '#88A779' },
  moreNote: { color: '#8B9683', fontSize: 10, textAlign: 'right', marginTop: 12 }, logIcon: { width: 32, height: 32, backgroundColor: '#F2F6EE', borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, empty: { padding: 30, alignItems: 'center', gap: 12 }, emptyText: { textAlign: 'center', color: '#8A9681', fontSize: 12, lineHeight: 22 }, pressed: { opacity: 0.7 },
});
