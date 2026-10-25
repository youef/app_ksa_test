import { OasisPressable as Pressable, OasisSurface } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Linking } from 'react-native';
import {
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Fingerprint,
  DatabaseZap,
  RefreshCw,
  Lock,
  LogIn,
  History,
  RotateCcw,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { ADMIN_COLORS as C } from './adminStyles';

interface AdminRow {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  totp_enabled: boolean | null;
  failed_login_attempts: number | null;
  last_failed_login_at: string | null;
  admin_session_expires_at: string | null;
  password_changed_at: string | null;
}

interface AccessLog {
  id: number;
  user_id: string | null;
  ip: string | null;
  user_agent: string | null;
  path: string;
  success: boolean;
  error_message: string | null;
  created_at: string;
}

interface ConfigChange {
  id: number;
  config_key: string;
  old_value: any;
  new_value: any;
  changed_by: string | null;
  changed_at: string;
  description: string | null;
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'غير معروف';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'غير معروف';
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `منذ ${days} يوم`;
  return d.toLocaleDateString('ar-EG');
}

function passwordAgeDays(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

export function AdminSecurityCenter({ onSaved }: { onSaved: (msg: string) => void }) {
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [access, setAccess] = useState<AccessLog[]>([]);
  const [changes, setChanges] = useState<ConfigChange[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [adminsRes, accessRes, changesRes] = await Promise.all([
        supabase
          .from('profiles')
          .select(
            'id, display_name, username, avatar_url, totp_enabled, failed_login_attempts, last_failed_login_at, admin_session_expires_at, password_changed_at'
          )
          .eq('role', 'admin')
          .limit(200),
        supabase.from('admin_access_logs').select('*').order('created_at', { ascending: false }).limit(40),
        supabase.from('admin_config_changes').select('*').order('changed_at', { ascending: false }).limit(30),
      ]);

      if (adminsRes.error) {
        onSaved('تعذّر تحميل بيانات الأمان: ' + adminsRes.error.message);
      }
      setAdmins((adminsRes.data || []) as AdminRow[]);
      setAccess((accessRes.data || []) as AccessLog[]);
      setChanges((changesRes.data || []) as ConfigChange[]);
      // Access/config logs may legitimately be empty but tables should exist.
      if (accessRes.error && changesRes.error) setUnavailable(true);
      else setUnavailable(false);
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

  const kpis = useMemo(() => {
    const total = admins.length;
    const with2fa = admins.filter((a) => a.totp_enabled).length;
    const failed = admins.reduce((s, a) => s + (a.failed_login_attempts || 0), 0);
    const stale = admins.filter((a) => {
      const age = passwordAgeDays(a.password_changed_at);
      return age !== null && age > 180;
    }).length;
    return { total, with2fa, failed, stale };
  }, [admins]);

  const resetAttempts = async (id: string) => {
    setBusyId(id);
    try {
      const { error } = await supabase.rpc('admin_reset_user_login_attempts', { p_user_id: id });
      if (error) {
        onSaved('تعذّر تصفير المحاولات: ' + error.message);
      } else {
        setAdmins((prev) => prev.map((a) => (a.id === id ? { ...a, failed_login_attempts: 0 } : a)));
        onSaved('تم تصفير محاولات الدخول الفاشلة ✅');
      }
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={C.accent} />
        <Text style={styles.loadingText}>جارٍ تحميل مركز الأمان...</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.headRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>الأمان والجلسات 🔐</Text>
          <Text style={styles.sectionSub}>
            مراقبة التحقق بخطوتين، محاولات الدخول، صلاحية كلمات المرور، وسجل الوصول وتغييرات الإعدادات.
          </Text>
        </View>
        <Pressable oasisKind="icon" style={styles.refreshBtn} onPress={() => void load()}>
          <RefreshCw size={15} color={C.accentDark} />
        </Pressable>
      </View>

      {unavailable ? (
        <View style={styles.notice}>
          <DatabaseZap size={24} color={C.warning} />
          <Text style={styles.noticeTitle}>سجلات الأمان غير مفعّلة بعد</Text>
          <Text style={styles.noticeText}>
            نفّذ ملف الترحيل{' '}
            <Text style={styles.code}>supabase/migrations/202610130003_admin_security.sql</Text> في محرّر SQL
            بمشروع Supabase لتفعيل سجلات الوصول وتغييرات الإعدادات.
          </Text>
        </View>
      ) : null}

      <View style={styles.metricGrid}>
        <Metric icon={<ShieldCheck size={16} color={C.accent} />} label="عدد المدراء" value={kpis.total} />
        <Metric icon={<Fingerprint size={16} color={C.info} />} label="مفعّل التحقق بخطوتين" value={kpis.with2fa} sub={`${kpis.total ? Math.round((kpis.with2fa / kpis.total) * 100) : 0}%`} />
        <Metric icon={<ShieldAlert size={16} color={C.danger} />} label="محاولات دخول فاشلة" value={kpis.failed} />
        <Metric icon={<KeyRound size={16} color={C.warning} />} label="كلمات مرور قديمة (+180 يوم)" value={kpis.stale} />
      </View>

      {/* Admins security posture */}
      <OasisSurface oasisSurface="card" style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle}>وضع المدراء أمنيًا 🛡️</Text>
          <Text style={styles.cardSub}>{admins.length} حساب</Text>
        </View>
        {admins.length === 0 ? (
          <Text style={styles.emptyHint}>لا يوجد مدراء مسجّلون.</Text>
        ) : (
          admins.map((a) => {
            const age = passwordAgeDays(a.password_changed_at);
            const stale = age !== null && age > 180;
            return (
              <View key={a.id} style={styles.adminRow}>
                <View style={styles.adminInfo}>
                  <View style={styles.avatarBox}>
                    <Text style={styles.avatarText}>{(a.display_name || a.username || 'A').slice(0, 1)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.adminName}>{a.display_name || a.username || 'مدير'}</Text>
                    <Text style={styles.adminMeta}>
                      كلمة المرور: {age === null ? 'غير معروف' : `${age} يوم`}
                      {a.last_failed_login_at ? ` · آخر فشل ${timeAgo(a.last_failed_login_at)}` : ''}
                    </Text>
                  </View>
                </View>
                <View style={styles.chipCol}>
                  <View style={[styles.chip, { backgroundColor: a.totp_enabled ? C.successLight : C.dangerLight }]}>
                    {a.totp_enabled ? <Fingerprint size={11} color={C.accentDark} /> : <Lock size={11} color={C.danger} />}
                    <Text style={[styles.chipText, { color: a.totp_enabled ? C.accentDark : C.danger }]}>
                      {a.totp_enabled ? '2FA مفعّل' : '2FA معطّل'}
                    </Text>
                  </View>
                  {stale ? (
                    <View style={[styles.chip, { backgroundColor: C.warningLight }]}>
                      <KeyRound size={11} color={C.warning} />
                      <Text style={[styles.chipText, { color: '#B45309' }]}>جدّد كلمة المرور</Text>
                    </View>
                  ) : null}
                  {(a.failed_login_attempts || 0) > 0 ? (
                    <Pressable oasisKind="chip"
                      style={[styles.chip, { backgroundColor: C.roseLight }]}
                      onPress={() => void resetAttempts(a.id)}
                      disabled={busyId === a.id}
                    >
                      <RotateCcw size={11} color={C.rose} />
                      <Text style={[styles.chipText, { color: C.rose }]}>
                        {busyId === a.id ? 'جارٍ...' : `تصفير (${a.failed_login_attempts})`}
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            );
          })
        )}
      </OasisSurface>

      {/* Access log */}
      <OasisSurface oasisSurface="card" style={styles.card}>
        <View style={styles.cardHead}>
          <LogIn size={14} color={C.muted} />
          <Text style={styles.cardTitle}>سجل الوصول الأخير</Text>
          <Text style={styles.cardSub}>{access.length} سجل</Text>
        </View>
        {access.length === 0 ? (
          <Text style={styles.emptyHint}>لا توجد سجلات وصول بعد.</Text>
        ) : (
          access.slice(0, 20).map((l) => (
            <View key={l.id} style={styles.logRow}>
              <View style={[styles.logDot, { backgroundColor: l.success ? C.success : C.danger }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.logPath} numberOfLines={1}>{l.path}</Text>
                <Text style={styles.logMeta} numberOfLines={1}>
                  {l.ip || 'IP غير معروف'} · {timeAgo(l.created_at)}
                  {l.error_message ? ` · ${l.error_message}` : ''}
                </Text>
              </View>
              <Text style={[styles.logStatus, { color: l.success ? C.accentDark : C.danger }]}>
                {l.success ? 'ناجح' : 'فشل'}
              </Text>
            </View>
          ))
        )}
      </OasisSurface>

      {/* Config changes */}
      <OasisSurface oasisSurface="card" style={styles.card}>
        <View style={styles.cardHead}>
          <History size={14} color={C.muted} />
          <Text style={styles.cardTitle}>سجل تعديلات الإعدادات</Text>
          <Text style={styles.cardSub}>{changes.length} تغيير</Text>
        </View>
        {changes.length === 0 ? (
          <Text style={styles.emptyHint}>لا توجد تغييرات مسجّلة بعد.</Text>
        ) : (
          changes.slice(0, 20).map((c) => (
            <View key={c.id} style={styles.changeRow}>
              <Text style={styles.changeKey}>{c.config_key}</Text>
              <Text style={styles.changeMeta}>
                {c.description || 'تعديل'} · {timeAgo(c.changed_at)}
              </Text>
            </View>
          ))
        )}
      </OasisSurface>

      <Pressable
        style={styles.helpRow}
        onPress={() => {
          void Linking.openURL('https://supabase.com/dashboard/project/vkeuyompnddqfvulalkk/auth/providers');
        }}
      >
        <ShieldCheck size={14} color={C.muted} />
        <Text style={styles.helpText}>إدارة سياسات الدخول والحماية من لوحة Supabase</Text>
      </Pressable>
    </View>
  );
}

function Metric({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <View style={styles.metricTile}>
      <View style={styles.metricTileHead}>
        {icon}
        <Text style={styles.metricTileLabel}>{label}</Text>
      </View>
      <Text style={styles.metricTileNum}>{value.toLocaleString('ar-EG')}</Text>
      {sub ? <Text style={styles.metricTileSub}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 14, paddingBottom: 24, gap: 2 },
  center: { paddingVertical: 60, alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 12.5, color: C.muted, fontWeight: '700' },
  headRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginBottom: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: C.ink, textAlign: 'right' },
  sectionSub: { fontSize: 11, color: C.muted, textAlign: 'right', lineHeight: 17, marginTop: 3 },
  refreshBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.accentLight, alignItems: 'center', justifyContent: 'center' },

  metricGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  metricTile: { flexGrow: 1, flexBasis: 150, minWidth: 140, backgroundColor: OASIS.colors.surface, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14 },
  metricTileHead: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginBottom: 6 },
  metricTileLabel: { flex: 1, fontSize: 11, fontWeight: '600', color: C.muted, textAlign: 'right' },
  metricTileNum: { fontSize: 22, fontWeight: '700', color: C.ink, textAlign: 'right' },
  metricTileSub: { fontSize: 11, color: C.subtle, fontWeight: '700', textAlign: 'right', marginTop: 2 },

  card: { backgroundColor: OASIS.colors.surface, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 12 },
  cardHead: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginBottom: 10 },
  cardTitle: { flex: 1, fontSize: 13.5, fontWeight: '700', color: C.ink, textAlign: 'right' },
  cardSub: { fontSize: 11, color: C.subtle, fontWeight: '700' },

  adminRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', gap: 8 },
  adminInfo: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, flex: 1 },
  avatarBox: { width: 34, height: 34, borderRadius: 11, backgroundColor: C.navyMid, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: OASIS.colors.surface, fontWeight: '700', fontSize: 14 },
  adminName: { fontSize: 12.5, fontWeight: '700', color: C.ink, textAlign: 'right' },
  adminMeta: { fontSize: 11, color: C.subtle, fontWeight: '700', textAlign: 'right', marginTop: 1 },
  chipCol: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 5, maxWidth: 190, justifyContent: 'flex-start' },
  chip: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 9 },
  chipText: { fontSize: 11, fontWeight: '700' },

  logRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  logDot: { width: 8, height: 8, borderRadius: 4 },
  logPath: { fontSize: 11.5, fontWeight: '600', color: C.ink, textAlign: 'right' },
  logMeta: { fontSize: 11, color: C.subtle, fontWeight: '700', textAlign: 'right', marginTop: 1 },
  logStatus: { fontSize: 11, fontWeight: '700' },

  changeRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  changeKey: { fontSize: 11.5, fontWeight: '700', color: C.ink, textAlign: 'right' },
  changeMeta: { fontSize: 11, color: C.subtle, fontWeight: '700', textAlign: 'right', marginTop: 2 },

  emptyHint: { fontSize: 11.5, color: C.subtle, textAlign: 'right', lineHeight: 18, paddingVertical: 6 },
  notice: { backgroundColor: C.warningLight, borderRadius: 16, padding: 18, alignItems: 'center', gap: 8, marginBottom: 14 },
  noticeTitle: { fontSize: 14, fontWeight: '700', color: '#92400E', textAlign: 'center' },
  noticeText: { fontSize: 12, color: '#92400E', textAlign: 'center', lineHeight: 20 },
  code: { fontWeight: '700', color: '#7C2D12' },
  helpRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 },
  helpText: { fontSize: 11, color: C.subtle, fontWeight: '700', textAlign: 'center' },
});
