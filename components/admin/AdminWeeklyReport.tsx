import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import {
  FileText,
  CalendarDays,
  RefreshCw,
  Play,
  DatabaseZap,
  Users,
  Flag,
  ShieldCheck,
  Store,
  HandHeart,
  MessageSquare,
  Wallet,
  Download,
  TrendingUp,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { exportCsv } from '@/lib/csvExport';
import { ADMIN_COLORS as C } from './adminStyles';

interface ReportRow {
  id: number;
  report_week: string;
  payload: any;
  sent_to: string[] | null;
  status: string;
  error_message: string | null;
  created_at: string;
}

function money(n: number): string {
  return `${Math.round(n || 0).toLocaleString('ar-EG')} ر.س`;
}

export function AdminWeeklyReport({ onSaved }: { onSaved: (msg: string) => void }) {
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [selected, setSelected] = useState<ReportRow | null>(null);
  const [generating, setGenerating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('weekly_report_log')
        .select('*')
        .order('report_week', { ascending: false })
        .limit(12);
      if (error) {
        setUnavailable(true);
        setReports([]);
        setSelected(null);
      } else {
        setUnavailable(false);
        const rows = (data || []) as ReportRow[];
        setReports(rows);
        setSelected(rows[0] || null);
      }
    } catch {
      setUnavailable(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generate = async () => {
    setGenerating(true);
    try {
      const { error } = await supabase.rpc('admin_generate_weekly_report');
      if (error) {
        onSaved('تعذّر إنشاء التقرير: ' + error.message);
      } else {
        onSaved('تم إنشاء التقرير الأسبوعي وحفظه ✅');
        await load();
      }
    } finally {
      setGenerating(false);
    }
  };

  const payload = selected?.payload || null;
  const summary = payload?.summary || {};
  const topCities: Array<{ city: string; count: number }> = payload?.top_cities || [];
  const funnel: Array<{ step: string; count: number }> = payload?.funnel || [];
  const retention: Array<{ week: number; rate: number }> = payload?.retention || [];
  const revenue = payload?.revenue_estimate || {};

  const funnelMax = useMemo(() => Math.max(1, ...funnel.map((f) => f.count || 0)), [funnel]);
  const cityMax = useMemo(() => Math.max(1, ...topCities.map((c) => c.count || 0)), [topCities]);

  const exportReport = () => {
    if (!payload) return;
    const ok = exportCsv(
      `weekly-report-${selected?.report_week || 'latest'}`,
      ['metric', 'value'],
      [
        ['week', payload.week || ''],
        ['new_users', summary.new_users || 0],
        ['total_users', summary.total_users || 0],
        ['active_users_7d', summary.active_users_7d || 0],
        ['reports_total', summary.reports_total || 0],
        ['reports_pending', summary.reports_pending || 0],
        ['verifications_pending', summary.verifications_pending || 0],
        ['services_new', summary.services_new || 0],
        ['requests_new', summary.requests_new || 0],
        ['questions_new', summary.questions_new || 0],
        ['revenue_services', revenue.services || 0],
        ['revenue_requests', revenue.requests || 0],
      ]
    );
    onSaved(ok ? 'تم تصدير التقرير الأسبوعي (CSV) 📄' : 'التصدير غير مدعوم على هذا الجهاز');
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={C.accent} />
        <Text style={styles.loadingText}>جارٍ تحميل التقارير الأسبوعية...</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.headRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>التقرير الأسبوعي 📅</Text>
          <Text style={styles.sectionSub}>
            ملخّص أسبوعي للنمو والمحتوى والإيرادات التقديرية، يُرسل للمدراء ويُحفظ في قاعدة البيانات.
          </Text>
        </View>
        <Pressable style={styles.refreshBtn} onPress={() => void load()}>
          <RefreshCw size={15} color={C.accentDark} />
        </Pressable>
      </View>

      {unavailable ? (
        <View style={styles.notice}>
          <DatabaseZap size={24} color={C.warning} />
          <Text style={styles.noticeTitle}>جدول التقارير غير مفعّل بعد</Text>
          <Text style={styles.noticeText}>
            نفّذ ملف الترحيل <Text style={styles.code}>supabase/migrations/202610130006_weekly_report_log.sql</Text> ثم{' '}
            <Text style={styles.code}>202610140003_admin_redesign.sql</Text> لتفعيل إنشاء التقارير من التطبيق.
          </Text>
        </View>
      ) : null}

      <View style={styles.actionsRow}>
        <Pressable style={[styles.generateBtn, generating && { opacity: 0.6 }]} onPress={() => void generate()} disabled={generating}>
          {generating ? <ActivityIndicator color="#fff" size="small" /> : <Play size={15} color="#fff" />}
          <Text style={styles.generateText}>إنشاء تقرير هذا الأسبوع</Text>
        </Pressable>
        <Pressable style={styles.exportBtn} onPress={exportReport} disabled={!payload}>
          <Download size={15} color={C.accentDark} />
          <Text style={styles.exportText}>تصدير CSV</Text>
        </Pressable>
      </View>

      {/* History chips */}
      {reports.length > 1 ? (
        <View style={styles.historyWrap}>
          {reports.map((r) => (
            <Pressable
              key={r.id}
              style={[styles.historyChip, selected?.id === r.id && styles.historyChipActive]}
              onPress={() => setSelected(r)}
            >
              <CalendarDays size={12} color={selected?.id === r.id ? '#fff' : C.muted} />
              <Text style={[styles.historyText, selected?.id === r.id && styles.historyTextActive]}>
                {r.report_week}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {!payload ? (
        <View style={styles.card}>
          <FileText size={30} color={C.subtle} />
          <Text style={styles.emptyHint}>لا يوجد تقرير محفوظ بعد. اضغط «إنشاء تقرير هذا الأسبوع».</Text>
        </View>
      ) : (
        <>
          <View style={styles.heroCard}>
            <View style={styles.heroTop}>
              <Text style={styles.heroWeek}>أسبوع {payload.week}</Text>
              <View style={[styles.statusChip, { backgroundColor: selected?.status === 'sent' ? C.successLight : C.warningLight }]}>
                <Text style={[styles.statusText, { color: selected?.status === 'sent' ? C.accentDark : '#B45309' }]}>
                  {selected?.status === 'sent' ? 'مُرسل' : selected?.status || 'محفوظ'}
                </Text>
              </View>
            </View>
            <Text style={styles.heroRange}>
              {payload.week_start} ← {payload.week_end}
            </Text>
            <View style={styles.heroRevenueRow}>
              <Wallet size={16} color="#fff" />
              <Text style={styles.heroRevenue}>
                إيراد تقديري: {money((revenue.services || 0) + (revenue.requests || 0))}
              </Text>
            </View>
          </View>

          {/* Summary grid */}
          <View style={styles.metricGrid}>
            <Metric icon={<Users size={15} color={C.info} />} label="مستخدمون جدد" value={summary.new_users || 0} />
            <Metric icon={<TrendingUp size={15} color={C.accent} />} label="نشطون (7 أيام)" value={summary.active_users_7d || 0} />
            <Metric icon={<Users size={15} color={C.royal} />} label="إجمالي المستخدمين" value={summary.total_users || 0} />
            <Metric icon={<Flag size={15} color={C.danger} />} label="بلاغات جديدة" value={summary.reports_total || 0} />
            <Metric icon={<ShieldCheck size={15} color={C.warning} />} label="توثيق معلّق" value={summary.verifications_pending || 0} />
            <Metric icon={<Store size={15} color={C.purple} />} label="خدمات جديدة" value={summary.services_new || 0} />
            <Metric icon={<HandHeart size={15} color={C.teal} />} label="فزعات جديدة" value={summary.requests_new || 0} />
            <Metric icon={<MessageSquare size={15} color={C.muted} />} label="استفسارات جديدة" value={summary.questions_new || 0} />
          </View>

          {/* Top cities */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>أعلى المدن نموًا</Text>
            {topCities.length ? (
              topCities.map((c) => (
                <View key={c.city} style={styles.miniBarRow}>
                  <Text style={styles.miniBarLabel} numberOfLines={1}>{c.city}</Text>
                  <View style={styles.miniBarTrack}>
                    <View style={[styles.miniBarFill, { width: `${Math.max(3, (c.count / cityMax) * 100)}%`, backgroundColor: C.teal }]} />
                  </View>
                  <Text style={styles.miniBarVal}>{c.count}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyHint}>لا توجد بيانات مدن في هذا التقرير.</Text>
            )}
          </View>

          {/* Funnel */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>مسار التحويل الأسبوعي</Text>
            {funnel.length ? (
              funnel.map((f) => (
                <View key={f.step} style={styles.miniBarRow}>
                  <Text style={styles.miniBarLabel} numberOfLines={1}>{FUNNEL_LABEL[f.step] || f.step}</Text>
                  <View style={styles.miniBarTrack}>
                    <View style={[styles.miniBarFill, { width: `${Math.max(3, (f.count / funnelMax) * 100)}%`, backgroundColor: C.royal }]} />
                  </View>
                  <Text style={styles.miniBarVal}>{f.count}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyHint}>لا توجد بيانات مسار في هذا التقرير.</Text>
            )}
          </View>

          {/* Retention */}
          {retention.length ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>الاحتفاظ (Retention)</Text>
              {retention.map((r) => (
                <View key={r.week} style={styles.retentionRow}>
                  <Text style={styles.retentionWeek}>الأسبوع {r.week}</Text>
                  <View style={styles.miniBarTrack}>
                    <View style={[styles.miniBarFill, { width: `${Math.min(100, Math.round((r.rate || 0) * 100))}%`, backgroundColor: C.accent }]} />
                  </View>
                  <Text style={styles.miniBarVal}>{Math.round((r.rate || 0) * 100)}%</Text>
                </View>
              ))}
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

const FUNNEL_LABEL: Record<string, string> = {
  landing: 'زيارة الواجهة',
  search: 'بحث',
  service_view: 'استعراض خدمة',
  request_start: 'بدء طلب',
  service_book: 'حجز خدمة',
  request_complete: 'إكمال طلب',
};

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <View style={styles.metricTile}>
      <View style={styles.metricTileHead}>
        {icon}
        <Text style={styles.metricTileLabel}>{label}</Text>
      </View>
      <Text style={styles.metricTileNum}>{Number(value || 0).toLocaleString('ar-EG')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 14, paddingBottom: 48, gap: 2 },
  center: { paddingVertical: 60, alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 12.5, color: C.muted, fontWeight: '700' },
  headRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginBottom: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '900', color: C.ink, textAlign: 'right' },
  sectionSub: { fontSize: 11, color: C.muted, textAlign: 'right', lineHeight: 17, marginTop: 3 },
  refreshBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.accentLight, alignItems: 'center', justifyContent: 'center' },

  actionsRow: { flexDirection: 'row-reverse', gap: 8, marginBottom: 12 },
  generateBtn: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.accent, borderRadius: 14, paddingVertical: 12 },
  generateText: { color: '#fff', fontWeight: '900', fontSize: 12.5 },
  exportBtn: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: C.accentLight, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12 },
  exportText: { color: C.accentDark, fontWeight: '900', fontSize: 12 },

  historyWrap: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  historyChip: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 11, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: C.border },
  historyChipActive: { backgroundColor: C.navyMid, borderColor: C.navyMid },
  historyText: { fontSize: 11, fontWeight: '800', color: C.muted },
  historyTextActive: { color: '#fff' },

  heroCard: { backgroundColor: C.navyMid, borderRadius: 18, padding: 16, marginBottom: 12 },
  heroTop: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  heroWeek: { fontSize: 16, fontWeight: '900', color: '#fff' },
  statusChip: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 9 },
  statusText: { fontSize: 10, fontWeight: '900' },
  heroRange: { fontSize: 11, color: '#CBD5E1', fontWeight: '700', textAlign: 'right', marginTop: 4 },
  heroRevenueRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginTop: 10 },
  heroRevenue: { fontSize: 14, fontWeight: '900', color: '#6EE7B7' },

  metricGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  metricTile: { flexGrow: 1, flexBasis: 150, minWidth: 140, backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14 },
  metricTileHead: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginBottom: 6 },
  metricTileLabel: { flex: 1, fontSize: 11, fontWeight: '800', color: C.muted, textAlign: 'right' },
  metricTileNum: { fontSize: 22, fontWeight: '900', color: C.ink, textAlign: 'right' },

  card: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 12, gap: 4 },
  cardTitle: { fontSize: 13.5, fontWeight: '900', color: C.ink, textAlign: 'right', marginBottom: 6 },

  miniBarRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 8 },
  miniBarLabel: { width: 110, fontSize: 11, fontWeight: '800', color: C.inkMuted, textAlign: 'right' },
  miniBarTrack: { flex: 1, height: 10, borderRadius: 6, backgroundColor: '#F1F5F9', overflow: 'hidden' },
  miniBarFill: { height: '100%', borderRadius: 6 },
  miniBarVal: { width: 44, fontSize: 11, fontWeight: '900', color: C.ink, textAlign: 'left' },
  retentionRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 8 },
  retentionWeek: { width: 78, fontSize: 11, fontWeight: '800', color: C.inkMuted, textAlign: 'right' },

  emptyHint: { fontSize: 11.5, color: C.subtle, textAlign: 'center', lineHeight: 18, paddingVertical: 12 },
  notice: { backgroundColor: C.warningLight, borderRadius: 16, padding: 18, alignItems: 'center', gap: 8, marginBottom: 14 },
  noticeTitle: { fontSize: 14, fontWeight: '900', color: '#92400E', textAlign: 'center' },
  noticeText: { fontSize: 12, color: '#92400E', textAlign: 'center', lineHeight: 20 },
  code: { fontWeight: '900', color: '#7C2D12' },
});
