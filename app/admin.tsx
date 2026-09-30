import { useEffect, useState, useCallback } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View, RefreshControl, ActivityIndicator, Platform } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Shield, Users, MessageCircle, Truck, Briefcase, Flag, CheckCircle, XCircle, RefreshCw, ChevronRight, AlertTriangle, Star, BarChart3, Eye
} from 'lucide-react-native';

const C = {
  bg: '#F3F4F6',
  card: '#fff',
  ink: '#111827',
  muted: '#6b7280',
  accent: '#0891b2',
  danger: '#ef4444',
  success: '#10b981',
  warning: '#f59e0b',
};

export default function Admin() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [verifications, setVerifications] = useState<any[]>([]);
  const [stats, setStats] = useState({ users: 0, questions: 0, requests: 0, services: 0, pendingReports: 0, pendingVerif: 0 });
  const [activeSection, setActiveSection] = useState<'overview' | 'reports' | 'verifications'>('overview');

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return router.replace('/auth');

    const { data: pr } = await supabase.from('profiles').select('*').eq('id', u.user.id).single();
    setProfile(pr);

    if (!pr || !['admin', 'moderator'].includes(pr.role)) {
      setLoading(false);
      return;
    }

    // Fetch in parallel
    const [r, v, users, questions, requests, services] = await Promise.all([
      supabase.from('reports').select('*, reporter:reporter_id(display_name, username)').eq('status', 'pending').order('created_at', { ascending: false }).limit(50),
      supabase.from('verification_requests').select('*, user:user_id(display_name, username, city)').eq('status', 'pending').order('created_at', { ascending: false }).limit(50),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('questions').select('id', { count: 'exact', head: true }),
      supabase.from('requests').select('id', { count: 'exact', head: true }),
      supabase.from('services').select('id', { count: 'exact', head: true }),
    ]);

    setReports(r.data ?? []);
    setVerifications(v.data ?? []);
    setStats({
      users: users.count ?? 0,
      questions: questions.count ?? 0,
      requests: requests.count ?? 0,
      services: services.count ?? 0,
      pendingReports: r.data?.length ?? 0,
      pendingVerif: v.data?.length ?? 0,
    });
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, []);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const resolveReport = async (id: string, action: 'resolved' | 'dismissed') => {
    await supabase.from('reports').update({ status: action, reviewed_by: (await supabase.auth.getUser()).data.user?.id, reviewed_at: new Date().toISOString() }).eq('id', id);
    load();
  };

  const handleVerification = async (id: string, userId: string, action: 'approved' | 'rejected') => {
    const { data: u } = await supabase.auth.getUser();
    await supabase.from('verification_requests').update({
      status: action,
      reviewed_by: u.user?.id,
      reviewed_at: new Date().toISOString()
    }).eq('id', id);

    if (action === 'approved') {
      await supabase.from('profiles').update({ is_verified: true, verification_status: 'verified' }).eq('id', userId);
    }
    load();
  };

  // Loading
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={styles.loadingText}>جاري التحقق من الصلاحيات...</Text>
      </View>
    );
  }

  // Unauthorized
  if (!profile || !['admin', 'moderator'].includes(profile.role)) {
    return (
      <View style={styles.center}>
        <View style={styles.unauthorizedIcon}>
          <Shield size={48} color={C.danger} />
        </View>
        <Text style={styles.unauthorizedTitle}>غير مصرح</Text>
        <Text style={styles.unauthorizedSub}>ليس لديك صلاحية الوصول لهذه الصفحة</Text>
        <Pressable style={styles.backBtn} onPress={() => router.replace('/home')}>
          <Text style={styles.backBtnText}>العودة للرئيسية</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#1e293b', '#0f172a']} style={styles.headerGrad}>
        <View style={styles.headerContent}>
          <Pressable onPress={() => router.back()} style={styles.backIconBtn}>
            <ChevronRight size={24} color="#fff" />
          </Pressable>
          <View style={styles.headerTexts}>
            <Text style={styles.headerTitle}>لوحة التحكم</Text>
            <Text style={styles.headerSub}>{profile.role === 'admin' ? '👑 مدير النظام' : '🛡️ مشرف'}</Text>
          </View>
          <Pressable onPress={onRefresh} style={styles.refreshBtn}>
            <RefreshCw size={20} color="#fff" />
          </Pressable>
        </View>

        {/* Alert Badges */}
        {(stats.pendingReports > 0 || stats.pendingVerif > 0) && (
          <View style={styles.alertsRow}>
            {stats.pendingReports > 0 && (
              <View style={styles.alertBadge}>
                <Flag size={14} color="#fff" />
                <Text style={styles.alertBadgeText}>{stats.pendingReports} بلاغ معلق</Text>
              </View>
            )}
            {stats.pendingVerif > 0 && (
              <View style={[styles.alertBadge, { backgroundColor: '#d97706' }]}>
                <Star size={14} color="#fff" />
                <Text style={styles.alertBadgeText}>{stats.pendingVerif} طلب توثيق</Text>
              </View>
            )}
          </View>
        )}
      </LinearGradient>

      {/* Section Tabs */}
      <View style={styles.sectionTabs}>
        {[
          { key: 'overview', label: 'نظرة عامة', icon: <BarChart3 size={16} color={activeSection === 'overview' ? '#0891b2' : '#9ca3af'} /> },
          { key: 'reports', label: `بلاغات (${stats.pendingReports})`, icon: <Flag size={16} color={activeSection === 'reports' ? '#ef4444' : '#9ca3af'} /> },
          { key: 'verifications', label: `توثيق (${stats.pendingVerif})`, icon: <Star size={16} color={activeSection === 'verifications' ? '#d97706' : '#9ca3af'} /> },
        ].map(tab => (
          <Pressable
            key={tab.key}
            style={[styles.sectionTab, activeSection === tab.key && styles.sectionTabActive]}
            onPress={() => setActiveSection(tab.key as any)}
          >
            {tab.icon}
            <Text style={[styles.sectionTabText, activeSection === tab.key && styles.sectionTabTextActive]}>{tab.label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
      >
        {/* OVERVIEW */}
        {activeSection === 'overview' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>إحصائيات المنصة</Text>
            <View style={styles.statsGrid}>
              <StatCard icon={<Users size={28} color="#3b82f6" />} bg="#eff6ff" value={stats.users} label="المستخدمون" />
              <StatCard icon={<MessageCircle size={28} color="#0891b2" />} bg="#ecfeff" value={stats.questions} label="الأسئلة" />
              <StatCard icon={<Truck size={28} color="#f59e0b" />} bg="#fffbeb" value={stats.requests} label="الطلبات" />
              <StatCard icon={<Briefcase size={28} color="#10b981" />} bg="#ecfdf5" value={stats.services} label="الخدمات" />
            </View>

            <Text style={[styles.sectionTitle, { marginTop: 32 }]}>إجراءات سريعة</Text>
            <Pressable style={styles.quickAction} onPress={() => setActiveSection('reports')}>
              <View style={styles.quickActionLeft}>
                <Flag size={20} color={C.danger} />
                <Text style={styles.quickActionText}>مراجعة البلاغات</Text>
              </View>
              {stats.pendingReports > 0 && <View style={styles.qBadge}><Text style={styles.qBadgeText}>{stats.pendingReports}</Text></View>}
            </Pressable>
            <Pressable style={styles.quickAction} onPress={() => setActiveSection('verifications')}>
              <View style={styles.quickActionLeft}>
                <CheckCircle size={20} color={C.warning} />
                <Text style={styles.quickActionText}>طلبات التوثيق</Text>
              </View>
              {stats.pendingVerif > 0 && <View style={[styles.qBadge, { backgroundColor: '#fef3c7' }]}><Text style={[styles.qBadgeText, { color: '#d97706' }]}>{stats.pendingVerif}</Text></View>}
            </Pressable>
            <Pressable style={styles.quickAction} onPress={() => router.push('/search')}>
              <View style={styles.quickActionLeft}>
                <Eye size={20} color={C.accent} />
                <Text style={styles.quickActionText}>استعراض المستخدمين</Text>
              </View>
            </Pressable>
          </View>
        )}

        {/* REPORTS */}
        {activeSection === 'reports' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>البلاغات المعلقة</Text>
            {reports.length === 0 ? (
              <EmptyState icon={<Flag size={40} color="#d1d5db" />} title="لا توجد بلاغات معلقة" sub="المجتمع بخير 🎉" />
            ) : (
              reports.map(r => (
                <View key={r.id} style={styles.reportCard}>
                  <View style={styles.reportHeader}>
                    <Flag size={18} color={C.danger} />
                    <Text style={styles.reportType}>{r.target_type}</Text>
                    <Text style={styles.reportDate}>{new Date(r.created_at).toLocaleDateString('ar-SA')}</Text>
                  </View>
                  <Text style={styles.reportReason}>{r.reason}</Text>
                  <Text style={styles.reportFrom}>من: {r.reporter?.display_name || r.reporter?.username || 'مجهول'}</Text>
                  <View style={styles.reportActions}>
                    <Pressable style={styles.resolveBtn} onPress={() => resolveReport(r.id, 'resolved')}>
                      <CheckCircle size={18} color="#fff" />
                      <Text style={styles.resolveBtnText}>إغلاق</Text>
                    </Pressable>
                    <Pressable style={styles.dismissBtn} onPress={() => resolveReport(r.id, 'dismissed')}>
                      <XCircle size={18} color={C.muted} />
                      <Text style={styles.dismissBtnText}>تجاهل</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* VERIFICATIONS */}
        {activeSection === 'verifications' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>طلبات التوثيق</Text>
            {verifications.length === 0 ? (
              <EmptyState icon={<CheckCircle size={40} color="#d1d5db" />} title="لا توجد طلبات معلقة" sub="تمت مراجعة جميع الطلبات ✅" />
            ) : (
              verifications.map(v => (
                <View key={v.id} style={styles.verifCard}>
                  <View style={styles.verifHeader}>
                    <View style={styles.verifUserBadge}>
                      <Star size={20} color="#d97706" />
                    </View>
                    <View style={styles.verifUserInfo}>
                      <Text style={styles.verifUserName}>{v.user?.display_name || v.user?.username || 'مستخدم'}</Text>
                      <Text style={styles.verifUserCity}>{v.user?.city || '—'}</Text>
                    </View>
                  </View>
                  {v.note && <Text style={styles.verifNote}>"{v.note}"</Text>}
                  <Text style={styles.verifDate}>{new Date(v.created_at).toLocaleDateString('ar-SA')}</Text>
                  <View style={styles.reportActions}>
                    <Pressable style={styles.resolveBtn} onPress={() => handleVerification(v.id, v.user_id, 'approved')}>
                      <CheckCircle size={18} color="#fff" />
                      <Text style={styles.resolveBtnText}>اعتماد</Text>
                    </Pressable>
                    <Pressable style={styles.dismissBtn} onPress={() => handleVerification(v.id, v.user_id, 'rejected')}>
                      <XCircle size={18} color={C.muted} />
                      <Text style={styles.dismissBtnText}>رفض</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        <View style={{ height: 80 }} />
      </ScrollView>
    </View>
  );
}

function StatCard({ icon, bg, value, label }: { icon: any; bg: string; value: number; label: string }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconBox, { backgroundColor: bg }]}>{icon}</View>
      <Text style={styles.statValue}>{value.toLocaleString('ar-SA')}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function EmptyState({ icon, title, sub }: { icon: any; title: string; sub: string }) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>{icon}</View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySub}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F3F4F6', padding: 24 },
  loadingText: { marginTop: 16, fontSize: 16, color: '#6b7280', fontWeight: '700' },
  headerGrad: { paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingBottom: 24, paddingHorizontal: 24 },
  headerContent: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  headerTexts: { flex: 1, alignItems: 'flex-end', marginRight: 12 },
  headerTitle: { fontSize: 26, fontWeight: '900', color: '#fff' },
  headerSub: { fontSize: 14, color: '#94a3b8', fontWeight: '700', marginTop: 2 },
  backIconBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  refreshBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' },
  alertsRow: { flexDirection: 'row-reverse', gap: 8 },
  alertBadge: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#ef4444', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 6 },
  alertBadgeText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  sectionTabs: { flexDirection: 'row-reverse', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6', paddingHorizontal: 8 },
  sectionTab: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderBottomWidth: 3, borderBottomColor: 'transparent', gap: 6 },
  sectionTabActive: { borderBottomColor: '#0891b2' },
  sectionTabText: { fontSize: 13, fontWeight: '700', color: '#9ca3af' },
  sectionTabTextActive: { color: '#111827', fontWeight: '900' },
  scroll: { flex: 1 },
  section: { padding: 20 },
  sectionTitle: { fontSize: 20, fontWeight: '900', color: '#111827', textAlign: 'right', marginBottom: 16 },
  statsGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 12 },
  statCard: { width: '47%', backgroundColor: '#fff', borderRadius: 24, padding: 20, alignItems: 'flex-end', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  statIconBox: { width: 56, height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  statValue: { fontSize: 32, fontWeight: '900', color: '#111827', marginBottom: 4 },
  statLabel: { fontSize: 13, color: '#6b7280', fontWeight: '700' },
  quickAction: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', padding: 20, borderRadius: 20, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },
  quickActionLeft: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  quickActionText: { fontSize: 16, fontWeight: '800', color: '#111827' },
  qBadge: { backgroundColor: '#fee2e2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  qBadgeText: { color: '#ef4444', fontSize: 13, fontWeight: '900' },
  reportCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#fee2e2', shadowColor: '#ef4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  reportHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 12 },
  reportType: { flex: 1, fontSize: 14, fontWeight: '800', color: '#374151', textAlign: 'right' },
  reportDate: { fontSize: 12, color: '#9ca3af', fontWeight: '600' },
  reportReason: { fontSize: 16, fontWeight: '700', color: '#111827', textAlign: 'right', marginBottom: 8, lineHeight: 24 },
  reportFrom: { fontSize: 13, color: '#6b7280', textAlign: 'right', marginBottom: 16, fontWeight: '600' },
  reportActions: { flexDirection: 'row-reverse', gap: 10 },
  resolveBtn: { flex: 1, flexDirection: 'row-reverse', backgroundColor: '#10b981', paddingVertical: 12, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 6 },
  resolveBtnText: { color: '#fff', fontWeight: '900', fontSize: 15 },
  dismissBtn: { flex: 1, flexDirection: 'row-reverse', backgroundColor: '#f3f4f6', paddingVertical: 12, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 6 },
  dismissBtnText: { color: '#6b7280', fontWeight: '900', fontSize: 15 },
  verifCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#fef3c7', shadowColor: '#f59e0b', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  verifHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, marginBottom: 12 },
  verifUserBadge: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#fef3c7', alignItems: 'center', justifyContent: 'center' },
  verifUserInfo: { flex: 1, alignItems: 'flex-end' },
  verifUserName: { fontSize: 16, fontWeight: '900', color: '#111827' },
  verifUserCity: { fontSize: 13, color: '#6b7280', fontWeight: '600' },
  verifNote: { fontSize: 15, color: '#4b5563', textAlign: 'right', fontStyle: 'italic', marginBottom: 8, lineHeight: 24, backgroundColor: '#fffbeb', padding: 12, borderRadius: 12 },
  verifDate: { fontSize: 12, color: '#9ca3af', textAlign: 'right', marginBottom: 16, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#f3f4f6', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: '#6b7280', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#9ca3af', fontWeight: '600' },
  unauthorizedIcon: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  unauthorizedTitle: { fontSize: 24, fontWeight: '900', color: '#111827', marginBottom: 8 },
  unauthorizedSub: { fontSize: 15, color: '#6b7280', fontWeight: '600', marginBottom: 32, textAlign: 'center' },
  backBtn: { backgroundColor: '#0891b2', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 16 },
  backBtnText: { color: '#fff', fontWeight: '900', fontSize: 16 },
});
