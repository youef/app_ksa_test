import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import {
  BarChart3,
  Users,
  Repeat,
  TrendingUp,
  Wallet,
  MapPin,
  DatabaseZap,
  RefreshCw,
  Filter,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { ADMIN_COLORS as C } from './adminStyles';
import { TrendChart, bucketByDay, type TrendPoint } from './AdminInsights';

type Range = 7 | 14 | 30;

interface DauRow {
  date: string;
  dau: number;
  mau: number;
  new_users: number;
  returning_users: number;
}

interface FunnelRow {
  date: string;
  step: string;
  count: number;
}

interface RetentionRow {
  cohort_week: string;
  week_number: number;
  cohort_size: number;
  retained_count: number;
  retention_rate: number;
}

interface RevenueRow {
  date: string;
  services_estimated_revenue: number;
  requests_estimated_budget: number;
  total_estimated: number;
}

interface HeatRow {
  date: string;
  city: string;
  district: string | null;
  entity_type: string;
  count: number;
}

const FUNNEL_STEPS: Array<{ key: string; label: string; color: string }> = [
  { key: 'landing', label: 'زيارة الواجهة', color: C.info },
  { key: 'search', label: 'بحث', color: C.royal },
  { key: 'service_view', label: 'استعراض خدمة', color: C.purple },
  { key: 'request_start', label: 'بدء طلب', color: C.warning },
  { key: 'service_book', label: 'حجز خدمة', color: C.teal },
  { key: 'request_complete', label: 'إكمال طلب', color: C.accent },
];

function money(n: number): string {
  return `${Math.round(n).toLocaleString('ar-EG')} ر.س`;
}

export function AdminAnalytics({ onSaved }: { onSaved: (msg: string) => void }) {
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [range, setRange] = useState<Range>(30);
  const [dau, setDau] = useState<DauRow[]>([]);
  const [funnel, setFunnel] = useState<FunnelRow[]>([]);
  const [retention, setRetention] = useState<RetentionRow[]>([]);
  const [revenue, setRevenue] = useState<RevenueRow[]>([]);
  const [heat, setHeat] = useState<HeatRow[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const sinceIso = new Date(Date.now() - (range - 1) * 86400000).toISOString().slice(0, 10);
      const [dauRes, funnelRes, retRes, revRes, heatRes] = await Promise.all([
        supabase.from('analytics_dau').select('*').order('date', { ascending: true }).limit(120),
        supabase.from('analytics_funnel_daily').select('*').gte('date', sinceIso).limit(400),
        supabase.from('analytics_retention_weekly').select('*').order('cohort_week', { ascending: false }).limit(80),
        supabase.from('analytics_revenue_daily').select('*').gte('date', sinceIso).limit(120),
        supabase.from('analytics_heatmap_daily').select('*').gte('date', sinceIso).limit(800),
      ]);

      // The first failure almost always means the migration was not applied.
      if (dauRes.error && funnelRes.error && revRes.error) {
        setUnavailable(true);
        return;
      }
      setUnavailable(false);

      setDau(((dauRes.data || []) as DauRow[]).slice(-range));
      setFunnel((funnelRes.data || []) as FunnelRow[]);
      setRetention((retRes.data || []) as RetentionRow[]);
      setRevenue(((revRes.data || []) as RevenueRow[]).slice(-range));
      setHeat((heatRes.data || []) as HeatRow[]);
    } catch {
      setUnavailable(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  // Falling back to live profile data when aggregates are still empty.
  const [liveUsers, setLiveUsers] = useState<TrendPoint[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const since = new Date(Date.now() - 29 * 86400000);
        since.setHours(0, 0, 0, 0);
        const { data } = await supabase
          .from('profiles')
          .select('created_at')
          .gte('created_at', since.toISOString())
          .limit(3000);
        setLiveUsers(bucketByDay(data as any, 30));
      } catch {
        /* ignore */
      }
    })();
  }, []);

  const dauSeries: TrendPoint[] = useMemo(
    () => dau.map((d) => ({ label: String(d.date).slice(5), value: d.dau })),
    [dau]
  );
  const revSeries: TrendPoint[] = useMemo(
    () => revenue.map((d) => ({ label: String(d.date).slice(5), value: Math.round(d.total_estimated || 0) })),
    [revenue]
  );

  const latestDau = dau.length ? dau[dau.length - 1] : null;
  const funnelTotals = useMemo(() => {
    const map = new Map<string, number>();
    funnel.forEach((f) => map.set(f.step, (map.get(f.step) || 0) + f.count));
    return map;
  }, [funnel]);
  const funnelMax = Math.max(1, ...FUNNEL_STEPS.map((s) => funnelTotals.get(s.key) || 0));
  const landing = funnelTotals.get('landing') || 0;

  const topCities = useMemo(() => {
    const map = new Map<string, number>();
    heat.forEach((h) => map.set(h.city || 'غير محدد', (map.get(h.city || 'غير محدد') || 0) + h.count));
    return Array.from(map.entries())
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [heat]);
  const cityMax = Math.max(1, ...topCities.map((c) => c.count));

  const revTotal = revenue.reduce((s, r) => s + (r.total_estimated || 0), 0);
  const newUsersRange = dau.reduce((s, d) => s + (d.new_users || 0), 0);
  const retentionLatest = retention.find((r) => r.week_number === 1);
  const hasData = dau.length > 0 || funnel.length > 0 || revenue.length > 0;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={C.accent} />
        <Text style={styles.loadingText}>جارٍ تحميل التحليلات المتقدمة...</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.headRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>التحليلات ومؤشرات النمو 📊</Text>
          <Text style={styles.sectionSub}>
            مستخدمون نشطون، مسار التحويل، الاحتفاظ، الإيرادات التقديرية والخريطة الحرارية للمدن.
          </Text>
        </View>
        <Pressable style={styles.refreshBtn} onPress={() => void load()}>
          <RefreshCw size={15} color={C.accentDark} />
        </Pressable>
      </View>

      <View style={styles.rangeRow}>
        {([7, 14, 30] as Range[]).map((r) => (
          <Pressable
            key={r}
            style={[styles.rangeChip, range === r && styles.rangeChipActive]}
            onPress={() => setRange(r)}
          >
            <Text style={[styles.rangeText, range === r && styles.rangeTextActive]}>آخر {r} يوم</Text>
          </Pressable>
        ))}
      </View>

      {unavailable ? (
        <View style={styles.notice}>
          <DatabaseZap size={24} color={C.warning} />
          <Text style={styles.noticeTitle}>جداول التحليلات غير مفعّلة بعد</Text>
          <Text style={styles.noticeText}>
            نفّذ ملف الترحيل{' '}
            <Text style={styles.code}>supabase/migrations/202610130005_analytics_events.sql</Text> في محرّر SQL
            بمشروع Supabase، ثم شغّل دالات الحساب (compute_dau / compute_funnel_daily) لعرض البيانات.
          </Text>
        </View>
      ) : null}

      {/* KPI tiles */}
      <View style={styles.metricGrid}>
        <Metric icon={<Users size={16} color={C.info} />} label="مستخدمون نشطون يوميًا (DAU)" value={latestDau?.dau ?? 0} sub="اليوم / آخر تسجيل" />
        <Metric icon={<BarChart3 size={16} color={C.royal} />} label="مستخدمون نشطون شهريًا (MAU)" value={latestDau?.mau ?? 0} sub="آخر 30 يومًا" />
        <Metric icon={<TrendingUp size={16} color={C.accent} />} label="مستخدمون جدد" value={newUsersRange} sub={`خلال ${range} يوم`} />
        <Metric icon={<Wallet size={16} color={C.warning} />} label="إيرادات تقديرية" value={revTotal} sub={`خلال ${range} يوم`} money />
        <Metric
          icon={<Repeat size={16} color={C.purple} />}
          label="احتفاظ الأسبوع الأول"
          value={retentionLatest ? Math.round((retentionLatest.retention_rate || 0) * 100) : 0}
          sub={retentionLatest ? `دفعة ${retentionLatest.cohort_week}` : 'لا بيانات'}
          suffix="%"
        />
      </View>

      {/* DAU trend */}
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>نشاط المستخدمين اليومي (DAU) 📈</Text>
          <Text style={styles.cardSub}>{dauSeries.length} نقطة</Text>
        </View>
        {dauSeries.length ? (
          <TrendChart data={dauSeries} color={C.info} height={150} />
        ) : (
          <Text style={styles.emptyHint}>لا توجد بيانات DAU محسوبة بعد.</Text>
        )}
      </View>

      {/* Funnel */}
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>مسار التحويل (Funnel) 🔻</Text>
          <Text style={styles.cardSub}>آخر {range} يوم</Text>
        </View>
        {landing > 0 ? (
          FUNNEL_STEPS.map((s) => {
            const val = funnelTotals.get(s.key) || 0;
            const pct = Math.round((val / funnelMax) * 100);
            const conv = landing > 0 ? Math.round((val / landing) * 100) : 0;
            return (
              <View key={s.key} style={styles.miniBarRow}>
                <Text style={styles.miniBarLabel}>{s.label}</Text>
                <View style={styles.miniBarTrack}>
                  <View style={[styles.miniBarFill, { width: `${Math.max(2, pct)}%`, backgroundColor: s.color }]} />
                </View>
                <Text style={styles.miniBarVal}>{val.toLocaleString('ar-EG')}</Text>
                <Text style={styles.funnelConv}>{conv}%</Text>
              </View>
            );
          })
        ) : (
          <Text style={styles.emptyHint}>لا توجد أحداث مسار محسوبة بعد. تأكد من تشغيل compute_funnel_daily.</Text>
        )}
      </View>

      {/* Revenue + growth fallback */}
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>الإيرادات التقديرية 💰</Text>
          <Text style={styles.cardSub}>إجمالي {money(revTotal)}</Text>
        </View>
        {revSeries.length ? (
          <TrendChart data={revSeries} color={C.warning} height={130} />
        ) : liveUsers.length ? (
          <>
            <Text style={styles.emptyHint}>لا توجد بيانات إيرادات؛ نعرض نمو التسجيل بدلاً منها.</Text>
            <TrendChart data={liveUsers} color={C.accent} height={130} />
          </>
        ) : (
          <Text style={styles.emptyHint}>لا توجد بيانات بعد.</Text>
        )}
      </View>

      {/* Heatmap top cities */}
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>الخريطة الحرارية — أعلى المدن نشاطًا 🗺️</Text>
          <Text style={styles.cardSub}>آخر {range} يوم</Text>
        </View>
        {topCities.length ? (
          topCities.map((c) => (
            <View key={c.city} style={styles.miniBarRow}>
              <View style={styles.cityLabelRow}>
                <MapPin size={11} color={C.muted} />
                <Text style={styles.miniBarLabel} numberOfLines={1}>{c.city}</Text>
              </View>
              <View style={styles.miniBarTrack}>
                <View style={[styles.miniBarFill, { width: `${Math.max(3, (c.count / cityMax) * 100)}%`, backgroundColor: C.teal }]} />
              </View>
              <Text style={styles.miniBarVal}>{c.count.toLocaleString('ar-EG')}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.emptyHint}>لا توجد بيانات خريطة حرارية بعد.</Text>
        )}
      </View>

      {/* Retention */}
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>الاحتفاظ الأسبوعي (Retention) 🔁</Text>
          <Text style={styles.cardSub}>{retention.length} سجل</Text>
        </View>
        {retention.length ? (
          <>
            <View style={styles.tableHead}>
              <Text style={styles.tableHeadText}>الدفعة (الأسبوع)</Text>
              <Text style={styles.tableHeadText}>الأسبوع</Text>
              <Text style={styles.tableHeadText}>الحجم</Text>
              <Text style={styles.tableHeadText}>النسبة</Text>
            </View>
            {retention.slice(0, 10).map((r) => (
              <View key={`${r.cohort_week}-${r.week_number}`} style={styles.tableRow}>
                <Text style={styles.tableCell}>{r.cohort_week}</Text>
                <Text style={styles.tableCell}>W{r.week_number}</Text>
                <Text style={styles.tableCell}>{r.cohort_size}</Text>
                <Text style={[styles.tableCell, { color: C.accentDark }]}>
                  {Math.round((r.retention_rate || 0) * 100)}%
                </Text>
              </View>
            ))}
          </>
        ) : (
          <Text style={styles.emptyHint}>لا توجد بيانات احتفاظ بعد.</Text>
        )}
      </View>

      {!hasData && !unavailable ? (
        <Text style={styles.emptyHint}>لا توجد بيانات تحليلات مسجّلة بعد. ابدأ بتسجيل الأحداث عبر log_analytics_event.</Text>
      ) : null}

      <Pressable style={styles.exportRow} onPress={() => onSaved('استخدم زر التصدير أعلى الصفحة لتقرير JSON كامل.')}>
        <Filter size={14} color={C.muted} />
        <Text style={styles.exportText}>البيانات محسوبة يوميًا عبر دالات Supabase المجدولة</Text>
      </Pressable>
    </View>
  );
}

function Metric({
  icon,
  label,
  value,
  sub,
  money,
  suffix,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub?: string;
  money?: boolean;
  suffix?: string;
}) {
  return (
    <View style={styles.metricTile}>
      <View style={styles.metricTileHead}>
        {icon}
        <Text style={styles.metricTileLabel}>{label}</Text>
      </View>
      <Text style={styles.metricTileNum}>
        {money ? money_(value) : value.toLocaleString('ar-EG')}
        {suffix ? <Text style={styles.metricSuffix}> {suffix}</Text> : null}
      </Text>
      {sub ? <Text style={styles.metricTileSub}>{sub}</Text> : null}
    </View>
  );
}

function money_(n: number): string {
  return Math.round(n).toLocaleString('ar-EG');
}

const styles = StyleSheet.create({
  wrap: { padding: 14, paddingBottom: 48, gap: 2 },
  center: { paddingVertical: 60, alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 12.5, color: C.muted, fontWeight: '700' },
  headRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginBottom: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '900', color: C.ink, textAlign: 'right' },
  sectionSub: { fontSize: 11, color: C.muted, textAlign: 'right', lineHeight: 17, marginTop: 3 },
  refreshBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.accentLight, alignItems: 'center', justifyContent: 'center' },

  rangeRow: { flexDirection: 'row-reverse', gap: 8, marginBottom: 14 },
  rangeChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: C.border },
  rangeChipActive: { backgroundColor: C.navyMid, borderColor: C.navyMid },
  rangeText: { fontSize: 11.5, fontWeight: '800', color: '#64748B' },
  rangeTextActive: { color: '#fff' },

  metricGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  metricTile: { flexGrow: 1, flexBasis: 150, minWidth: 140, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14 },
  metricTileHead: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginBottom: 6 },
  metricTileLabel: { flex: 1, fontSize: 11, fontWeight: '800', color: C.muted, textAlign: 'right' },
  metricTileNum: { fontSize: 22, fontWeight: '900', color: C.ink, textAlign: 'right' },
  metricSuffix: { fontSize: 12, color: C.muted },
  metricTileSub: { fontSize: 10.5, color: C.subtle, fontWeight: '700', textAlign: 'right', marginTop: 2 },

  card: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 12 },
  cardHead: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  cardTitle: { fontSize: 13.5, fontWeight: '900', color: C.ink, textAlign: 'right' },
  cardSub: { fontSize: 10.5, color: C.subtle, fontWeight: '700' },

  miniBarRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 8 },
  miniBarLabel: { flex: 1, fontSize: 11, fontWeight: '800', color: C.inkMuted, textAlign: 'right' },
  miniBarTrack: { flex: 2, height: 10, borderRadius: 6, backgroundColor: '#F1F5F9', overflow: 'hidden' },
  miniBarFill: { height: '100%', borderRadius: 6 },
  miniBarVal: { width: 52, fontSize: 11, fontWeight: '900', color: C.ink, textAlign: 'left' },
  funnelConv: { width: 38, fontSize: 10.5, fontWeight: '800', color: C.subtle, textAlign: 'left' },
  cityLabelRow: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },

  tableHead: { flexDirection: 'row-reverse', paddingVertical: 8, paddingHorizontal: 10, backgroundColor: '#F8FAFC', borderRadius: 10, marginBottom: 4 },
  tableHeadText: { flex: 1, fontSize: 10.5, fontWeight: '900', color: '#64748B', textAlign: 'right' },
  tableRow: { flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: 9, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  tableCell: { flex: 1, fontSize: 11.5, color: C.ink, fontWeight: '700', textAlign: 'right' },

  emptyHint: { fontSize: 11.5, color: C.subtle, textAlign: 'right', lineHeight: 18, paddingVertical: 6 },
  notice: { backgroundColor: C.warningLight, borderRadius: 16, padding: 18, alignItems: 'center', gap: 8, marginBottom: 14 },
  noticeTitle: { fontSize: 14, fontWeight: '900', color: '#92400E', textAlign: 'center' },
  noticeText: { fontSize: 12, color: '#92400E', textAlign: 'center', lineHeight: 20 },
  code: { fontWeight: '900', color: '#7C2D12' },
  exportRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 },
  exportText: { fontSize: 10.5, color: C.subtle, fontWeight: '700', textAlign: 'center' },
});
