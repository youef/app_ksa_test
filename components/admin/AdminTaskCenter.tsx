import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Flag, Star, AlertTriangle, MessageCircle, ChevronLeft, Inbox } from 'lucide-react-native';
import { ADMIN_COLORS as C } from './adminStyles';
import { SupportEmptyState } from '@/components/shared/SupportUI';
import type {
  AdminReport,
  AdminVerificationRequest,
  AdminUrgentAlert,
  AdminQuestion,
} from './adminTypes';

type Severity = 'critical' | 'high' | 'medium' | 'low';

const SEVERITY_META: Record<Severity, { color: string; bg: string; label: string; weight: number }> = {
  critical: { color: C.danger, bg: C.dangerLight, label: 'حرج', weight: 4 },
  high: { color: C.warning, bg: C.warningLight, label: 'عالي', weight: 3 },
  medium: { color: C.info, bg: C.infoLight, label: 'متوسط', weight: 2 },
  low: { color: C.muted, bg: C.borderLight, label: 'منخفض', weight: 1 },
};

interface TaskItem {
  id: string;
  kind: 'report' | 'verification' | 'urgent' | 'content';
  title: string;
  subtitle: string;
  severity: Severity;
  createdAt: string;
  tab: string;
}

function ageLabel(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return 'الآن';
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `منذ ${mins} د`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `منذ ${hrs} س`;
  const days = Math.floor(hrs / 24);
  return `منذ ${days} ي`;
}

function nameOf(u?: { display_name?: string | null; username?: string | null } | null): string {
  return u?.display_name || u?.username || 'أحد الجيران';
}

export function AdminTaskCenter({
  reports,
  verifications,
  urgentAlerts,
  questions,
  onNavigate,
  onResolveAll,
}: {
  reports: AdminReport[];
  verifications: AdminVerificationRequest[];
  urgentAlerts: AdminUrgentAlert[];
  questions: AdminQuestion[];
  onNavigate: (tab: string) => void;
  onResolveAll: () => void;
}) {
  const tasks = useMemo<TaskItem[]>(() => {
    const list: TaskItem[] = [];

    reports
      .filter((r) => r.status === 'pending')
      .forEach((r) => {
        const ageHrs = (Date.now() - new Date(r.created_at).getTime()) / 3600000;
        list.push({
          id: `report-${r.id}`,
          kind: 'report',
          title: r.reason || 'بلاغ محتوى',
          subtitle: `بلاغ من ${nameOf(r.reporter)} · ${r.target_type}`,
          severity: ageHrs > 24 ? 'critical' : 'high',
          createdAt: r.created_at,
          tab: 'reports',
        });
      });

    verifications
      .filter((v) => v.status === 'pending')
      .forEach((v) => {
        const ageHrs = (Date.now() - new Date(v.created_at).getTime()) / 3600000;
        list.push({
          id: `verif-${v.id}`,
          kind: 'verification',
          title: nameOf(v.user),
          subtitle: 'طلب توثيق رسمي بانتظار الاعتماد',
          severity: ageHrs > 48 ? 'high' : 'medium',
          createdAt: v.created_at,
          tab: 'verifications',
        });
      });

    urgentAlerts
      .filter((a) => a.status === 'active')
      .forEach((a) => {
        list.push({
          id: `urgent-${a.id}`,
          kind: 'urgent',
          title: a.title || 'تنبيه طارئ',
          subtitle: `${nameOf(a.user)} · ${a.city || 'غير محدد'}${a.district ? ' · ' + a.district : ''}`,
          severity: 'critical',
          createdAt: a.created_at,
          tab: 'platform',
        });
      });

    // Recent neighborhood content (last 48h) as a low-priority review queue.
    const cutoff = Date.now() - 48 * 3600000;
    questions
      .filter((q) => new Date(q.created_at).getTime() >= cutoff)
      .slice(0, 12)
      .forEach((q) => {
        list.push({
          id: `question-${q.id}`,
          kind: 'content',
          title: q.title || 'منشور جديد',
          subtitle: `بقلم ${nameOf(q.author)} · ${q.city || 'غير محدد'}`,
          severity: 'low',
          createdAt: q.created_at,
          tab: 'content',
        });
      });

    return list.sort((a, b) => {
      const w = SEVERITY_META[b.severity].weight - SEVERITY_META[a.severity].weight;
      if (w !== 0) return w;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }, [reports, verifications, urgentAlerts, questions]);

  const counts = useMemo(() => {
    return tasks.reduce(
      (acc, t) => {
        acc[t.severity] = (acc[t.severity] || 0) + 1;
        return acc;
      },
      {} as Record<Severity, number>
    );
  }, [tasks]);

  const criticalCount = counts.critical || 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>مركز المهام الموحّد 🎯</Text>
            <Text style={styles.headerSub}>
              كل ما يحتاج انتباهك في مكان واحد، مرتّب حسب الأولوية وعمر الطلب.
            </Text>
          </View>
          <View style={[styles.totalBadge, { backgroundColor: criticalCount ? C.dangerLight : C.successLight }]}>
            <Text style={[styles.totalBadgeNum, { color: criticalCount ? C.danger : C.accentDark }]}>{tasks.length}</Text>
            <Text style={[styles.totalBadgeLabel, { color: criticalCount ? C.danger : C.accentDark }]}>مهمة</Text>
          </View>
        </View>

        <View style={styles.chipsRow}>
          {(['critical', 'high', 'medium', 'low'] as Severity[]).map((s) => (
            <View key={s} style={[styles.chip, { backgroundColor: SEVERITY_META[s].bg }]}>
              <View style={[styles.chipDot, { backgroundColor: SEVERITY_META[s].color }]} />
              <Text style={[styles.chipText, { color: SEVERITY_META[s].color }]}>
                {SEVERITY_META[s].label} {counts[s] || 0}
              </Text>
            </View>
          ))}
        </View>

        {criticalCount > 0 ? (
          <View style={styles.slaWarning}>
            <AlertTriangle size={14} color={C.danger} />
            <Text style={styles.slaWarningText}>
              لديك {criticalCount} مهمة حرجة متأخرة عن مؤقّت الاستجابة (SLA) — يُنصح بمعالجتها أولاً.
            </Text>
          </View>
        ) : null}
      </View>

      {tasks.length === 0 ? (
        <SupportEmptyState
          title="لا مهام معلّقة 🎉"
          description="كل البلاغات والتوثيقات والطوارئ معالجة. الحي بأمان."
          icon={<Inbox size={40} color={C.subtle} />}
        />
      ) : (
        tasks.map((t) => {
          const meta = SEVERITY_META[t.severity];
          return (
            <Pressable
              key={t.id}
              style={styles.taskRow}
              onPress={() => onNavigate(t.tab)}
            >
              <View style={[styles.taskBar, { backgroundColor: meta.color }]} />
              <View style={[styles.taskIcon, { backgroundColor: meta.bg }]}>
                {t.kind === 'report' ? (
                  <Flag size={16} color={meta.color} />
                ) : t.kind === 'verification' ? (
                  <Star size={16} color={meta.color} />
                ) : t.kind === 'urgent' ? (
                  <AlertTriangle size={16} color={meta.color} />
                ) : (
                  <MessageCircle size={16} color={meta.color} />
                )}
              </View>
              <View style={styles.taskCopy}>
                <Text style={styles.taskTitle} numberOfLines={1}>{t.title}</Text>
                <Text style={styles.taskSub} numberOfLines={1}>{t.subtitle}</Text>
              </View>
              <View style={styles.taskRight}>
                <View style={[styles.sevPill, { backgroundColor: meta.bg }]}>
                  <Text style={[styles.sevPillText, { color: meta.color }]}>{meta.label}</Text>
                </View>
                <Text style={styles.taskAge}>{ageLabel(t.createdAt)}</Text>
              </View>
              <ChevronLeft size={16} color={C.subtle} />
            </Pressable>
          );
        })
      )}

      {tasks.length > 0 ? (
        <Pressable style={styles.resolveAll} onPress={onResolveAll}>
          <Text style={styles.resolveAllText}>تحديث قائمة المهام</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 14, paddingTop: 12, gap: 10 },
  headerCard: {
    backgroundColor: C.navyMid,
    borderRadius: 18,
    padding: 16,
    gap: 12,
  },
  headerTop: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  headerTitle: { fontSize: 16, fontWeight: '900', color: '#FFFFFF', textAlign: 'right' },
  headerSub: { fontSize: 11, color: '#94A3B8', textAlign: 'right', marginTop: 3, lineHeight: 17 },
  totalBadge: { width: 62, height: 62, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  totalBadgeNum: { fontSize: 22, fontWeight: '900' },
  totalBadgeLabel: { fontSize: 10, fontWeight: '800' },
  chipsRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 9 },
  chipDot: { width: 7, height: 7, borderRadius: 4 },
  chipText: { fontSize: 10.5, fontWeight: '900' },
  slaWarning: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderRadius: 12,
    padding: 10,
  },
  slaWarningText: { flex: 1, color: '#FECACA', fontSize: 11, textAlign: 'right', lineHeight: 17 },

  empty: { alignItems: 'center', paddingVertical: 44, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '900', color: C.ink },
  emptySub: { fontSize: 12, color: C.muted, textAlign: 'center' },

  taskRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    paddingVertical: 11,
    paddingLeft: 12,
    paddingRight: 0,
    overflow: 'hidden',
  },
  taskBar: { position: 'absolute', right: 0, top: 0, bottom: 0, width: 4 },
  taskIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  taskCopy: { flex: 1, gap: 2, alignItems: 'flex-end', paddingRight: 4 },
  taskTitle: { fontSize: 12.5, fontWeight: '900', color: C.ink, textAlign: 'right' },
  taskSub: { fontSize: 10.5, color: C.muted, textAlign: 'right' },
  taskRight: { alignItems: 'center', gap: 4 },
  sevPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 7 },
  sevPillText: { fontSize: 9.5, fontWeight: '900' },
  taskAge: { fontSize: 9.5, color: C.subtle, fontWeight: '700' },

  resolveAll: {
    alignSelf: 'center',
    backgroundColor: C.accentLight,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginTop: 4,
    marginBottom: 24,
  },
  resolveAllText: { color: C.accentDark, fontSize: 12, fontWeight: '900' },
});
