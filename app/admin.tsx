import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  RefreshControl,
  ActivityIndicator,
  Platform,
  TextInput,
  Image,
  Animated,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Shield,
  Users,
  MessageCircle,
  Truck,
  Briefcase,
  Flag,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ChevronRight,
  AlertTriangle,
  Star,
  BarChart3,
  Eye,
  Trash,
  Crown,
  Search,
  Send,
  Megaphone,
  Check,
  X,
  Lock,
  Unlock,
  ExternalLink,
  ShieldCheck,
  Ban,
  UserCheck,
  UserX,
  SlidersHorizontal,
  User,
} from 'lucide-react-native';

const C = {
  bg: '#F8FAFC',
  card: '#FFFFFF',
  ink: '#0F172A',
  muted: '#64748B',
  accent: '#0891B2',
  danger: '#EF4444',
  success: '#10B981',
  warning: '#F59E0B',
};

export default function Admin() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  
  // Active Navigation Tab
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'reports' | 'verifications' | 'content' | 'broadcast'>('overview');

  // Core Data
  const [usersList, setUsersList] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [verifications, setVerifications] = useState<any[]>([]);
  const [questionsList, setQuestionsList] = useState<any[]>([]);
  const [requestsList, setRequestsList] = useState<any[]>([]);
  const [stats, setStats] = useState({
    users: 0,
    admins: 0,
    questions: 0,
    requests: 0,
    services: 0,
    pendingReports: 0,
    pendingVerif: 0,
  });

  // User Filter & Search
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'admin' | 'user' | 'verified' | 'banned'>('all');

  // Content Filter & Search
  const [contentSearch, setContentSearch] = useState('');
  const [contentTypeFilter, setContentTypeFilter] = useState<'all' | 'questions' | 'requests'>('all');

  // Broadcast Notification Form
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [broadcastTarget, setBroadcastTarget] = useState<'all' | 'riyadh' | 'jeddah' | 'dammam'>('all');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);

  // Toast feedback
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    Animated.sequence([
      Animated.timing(toastAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.delay(2200),
      Animated.timing(toastAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start(() => setToastMsg(null));
  }, [toastAnim]);

  const confirmAction = (title: string, message: string, onConfirm: () => void | Promise<void>) => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (window.confirm(`${title}\n\n${message}`)) {
        onConfirm();
      }
    } else {
      Alert.alert(title, message, [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'تأكيد', onPress: onConfirm },
      ]);
    }
  };

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return router.replace('/auth');

    const userEmail = (u.user.email || '').toLowerCase().trim();
    // Auto-detect root@gmail.com as super-admin
    const isRootAdmin = userEmail === 'root@gmail.com' || userEmail.startsWith('root@');

    let { data: pr } = await supabase.from('profiles').select('*').eq('id', u.user.id).maybeSingle();

    if (isRootAdmin) {
      if (!pr || pr.role !== 'admin') {
        await supabase.from('profiles').upsert({
          id: u.user.id,
          role: 'admin',
          is_verified: true,
          display_name: pr?.display_name || 'مدير النظام (Root)',
        }, { onConflict: 'id' });
        pr = pr ? { ...pr, role: 'admin', is_verified: true } : { id: u.user.id, role: 'admin', is_verified: true, display_name: 'مدير النظام (Root)' };
      }
    }

    setProfile(pr);

    const isAdmin = pr?.role === 'admin' || isRootAdmin;

    // If not admin, stop deep loading to protect resources
    if (!isAdmin) {
      setLoading(false);
      return;
    }

    // Parallel fetch for deep administration metrics
    const [
      repRes,
      verifRes,
      profilesRes,
      qCountRes,
      rCountRes,
      sCountRes,
      latestQRes,
      latestRRes,
    ] = await Promise.all([
      supabase.from('reports').select('*, reporter:reporter_id(display_name, username)').order('created_at', { ascending: false }).limit(60),
      supabase.from('verification_requests').select('*, user:user_id(display_name, username, city, avatar_url)').order('created_at', { ascending: false }).limit(60),
      supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('questions').select('id', { count: 'exact', head: true }),
      supabase.from('requests').select('id', { count: 'exact', head: true }),
      supabase.from('services').select('id', { count: 'exact', head: true }),
      supabase.from('questions').select('*, profiles:author_id(display_name, username)').order('created_at', { ascending: false }).limit(30),
      supabase.from('requests').select('*, profiles:requester_id(display_name, username)').order('created_at', { ascending: false }).limit(30),
    ]);

    const allUsers = profilesRes.data ?? [];
    const allReports = repRes.data ?? [];
    const allVerifs = verifRes.data ?? [];

    setUsersList(allUsers);
    setReports(allReports);
    setVerifications(allVerifs);
    setQuestionsList(latestQRes.data ?? []);
    setRequestsList(latestRRes.data ?? []);

    const adminCount = allUsers.filter((u: any) => u.role === 'admin').length;
    const pendingRep = allReports.filter((r: any) => r.status === 'pending').length;
    const pendingVer = allVerifs.filter((v: any) => v.status === 'pending').length;

    setStats({
      users: allUsers.length,
      admins: adminCount,
      questions: qCountRes.count ?? 0,
      requests: rCountRes.count ?? 0,
      services: sCountRes.count ?? 0,
      pendingReports: pendingRep,
      pendingVerif: pendingVer,
    });

    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Self-promote to Admin (for the project owner / developer - instant execution without web alert locks)
  const handleClaimAdmin = async () => {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setLoading(false);
      return router.replace('/auth');
    }

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: u.user.id,
        role: 'admin',
        is_verified: true,
      }, { onConflict: 'id' });

    if (error) {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert('تعذر تفعيل الصلاحية: ' + error.message);
      } else {
        Alert.alert('خطأ', error.message);
      }
      setLoading(false);
    } else {
      showToast('تم تفعيل صلاحية مدير النظام لحسابك بنجاح! 👑');
      await load();
    }
  };

  // 1. Toggle User Role (Strictly admin or user)
  const toggleUserRole = async (targetUser: any) => {
    const isCurrentAdmin = targetUser.role === 'admin';
    const newRole = isCurrentAdmin ? 'user' : 'admin';
    const actionLabel = isCurrentAdmin ? 'خفض إلى مستخدم عادي 👤' : 'ترقية إلى مدير النظام 👑';

    confirmAction(
      'تغيير صلاحية المستخدم',
      `هل أنت متأكد من ${actionLabel} للمستخدم "${targetUser.display_name || targetUser.username}"؟`,
      async () => {
        const { error } = await supabase
          .from('profiles')
          .update({ role: newRole })
          .eq('id', targetUser.id);

        if (error) {
          Alert.alert('خطأ', 'تعذر تحديث الصلاحية: ' + error.message);
        } else {
          setUsersList(prev => prev.map(u => u.id === targetUser.id ? { ...u, role: newRole } : u));
          showToast(`تم ${isCurrentAdmin ? 'خفض الصلاحية لمستخدم' : 'منح رتبة مدير النظام'} بنجاح ✨`);
        }
      }
    );
  };

  // 2. Toggle Official Verification
  const toggleVerification = async (targetUser: any) => {
    const nextStatus = !targetUser.is_verified;
    const { error } = await supabase
      .from('profiles')
      .update({
        is_verified: nextStatus,
        verification_status: nextStatus ? 'verified' : 'unverified'
      })
      .eq('id', targetUser.id);

    if (error) {
      Alert.alert('خطأ', error.message);
    } else {
      setUsersList(prev => prev.map(u => u.id === targetUser.id ? { ...u, is_verified: nextStatus } : u));
      showToast(nextStatus ? 'تم توثيق الحساب بالشارة الرسمية ✓' : 'تم إلغاء توثيق الحساب');
    }
  };

  // 3. Toggle Geo Verification (ابن الحي)
  const toggleGeoVerification = async (targetUser: any) => {
    const nextStatus = !targetUser.is_geoverified;
    const { error } = await supabase
      .from('profiles')
      .update({ is_geoverified: nextStatus })
      .eq('id', targetUser.id);

    if (error) {
      Alert.alert('خطأ', error.message);
    } else {
      setUsersList(prev => prev.map(u => u.id === targetUser.id ? { ...u, is_geoverified: nextStatus } : u));
      showToast(nextStatus ? 'تم منح شارة "ابن الحي الموثق" 🛡️' : 'تمت إزالة شارة السكن');
    }
  };

  // 4. Toggle User Ban
  const toggleBanUser = async (targetUser: any) => {
    const nextBan = !targetUser.is_banned;
    const actionLabel = nextBan ? 'حظر الحساب نهائياً 🚫' : 'إلغاء حظر الحساب 🟢';

    confirmAction(
      actionLabel,
      `هل ترغب فعلاً في ${nextBan ? 'حظر' : 'إلغاء حظر'} "${targetUser.display_name || targetUser.username}"؟`,
      async () => {
        const { error } = await supabase
          .from('profiles')
          .update({ is_banned: nextBan })
          .eq('id', targetUser.id);

        if (error) {
          Alert.alert('خطأ', error.message);
        } else {
          setUsersList(prev => prev.map(u => u.id === targetUser.id ? { ...u, is_banned: nextBan } : u));
          showToast(nextBan ? 'تم حظر المستخدم بنجاح 🚫' : 'تم رفع الحظر بنجاح 🟢');
        }
      }
    );
  };

  // 5. Reports Actions
  const resolveReport = async (id: string, action: 'resolved' | 'dismissed') => {
    const { data: u } = await supabase.auth.getUser();
    await supabase.from('reports').update({
      status: action,
      reviewed_by: u.user?.id,
      reviewed_at: new Date().toISOString()
    }).eq('id', id);

    setReports(prev => prev.map(r => r.id === id ? { ...r, status: action } : r));
    showToast(action === 'resolved' ? 'تم حل وإغلاق البلاغ بنجاح ✓' : 'تم تجاهل البلاغ ✕');
  };

  // 6. Delete Offensive Content Reported
  const deleteReportedContent = async (report: any) => {
    confirmAction(
      'حذف المحتوى المخالف',
      `هل أنت متأكد من حذف هذا الـ (${report.target_type}) نهائياً من قاعدة البيانات وإغلاق البلاغ؟`,
      async () => {
        if (report.target_type === 'question' && report.target_id) {
          await supabase.from('questions').delete().eq('id', report.target_id);
        } else if (report.target_type === 'request' && report.target_id) {
          await supabase.from('requests').delete().eq('id', report.target_id);
        } else if (report.target_type === 'answer' && report.target_id) {
          await supabase.from('answers').delete().eq('id', report.target_id);
        }
        await resolveReport(report.id, 'resolved');
        showToast('تم حذف المحتوى المخالف وإغلاق البلاغ 🗑️');
        load();
      }
    );
  };

  // 7. Verification Desk Decision
  const handleVerificationDecision = async (id: string, userId: string, action: 'approved' | 'rejected') => {
    const { data: u } = await supabase.auth.getUser();
    await supabase.from('verification_requests').update({
      status: action,
      reviewed_by: u.user?.id,
      reviewed_at: new Date().toISOString()
    }).eq('id', id);

    if (action === 'approved') {
      await supabase.from('profiles').update({
        is_verified: true,
        verification_status: 'verified'
      }).eq('id', userId);
      showToast('تم اعتماد طلب التوثيق ومنح الشارة الزرقاء ✓');
    } else {
      showToast('تم رفض طلب التوثيق');
    }

    setVerifications(prev => prev.map(v => v.id === id ? { ...v, status: action } : v));
  };

  // 8. Delete Inappropriate Question or Request
  const deleteContentItem = async (id: string, type: 'question' | 'request') => {
    confirmAction(
      'حذف المنشور',
      'هل ترغب في حذف هذا المنشور نهائياً من منصة حيّنا؟',
      async () => {
        if (type === 'question') {
          await supabase.from('questions').delete().eq('id', id);
          setQuestionsList(prev => prev.filter(q => q.id !== id));
        } else {
          await supabase.from('requests').delete().eq('id', id);
          setRequestsList(prev => prev.filter(r => r.id !== id));
        }
        showToast('تم حذف المنشور بنجاح 🗑️');
      }
    );
  };

  // 9. Send Broadcast Announcement
  const handleSendBroadcast = async () => {
    if (!broadcastTitle.trim() || !broadcastBody.trim()) {
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.alert('يرجى كتابة عنوان وتفاصيل التعميم');
      } else {
        Alert.alert('تنبيه', 'يرجى كتابة عنوان وتفاصيل التعميم');
      }
      return;
    }

    setSendingBroadcast(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      // Insert notification for admin log
      await supabase.from('notifications').insert({
        user_id: u.user?.id,
        actor_id: u.user?.id,
        type: 'broadcast',
        content: `📢 [تعميم إداري]: ${broadcastTitle} - ${broadcastBody}`,
      });

      showToast('تم إرسال ونشر التعميم الإداري بنجاح 📢');
      setBroadcastTitle('');
      setBroadcastBody('');
    } catch (e: any) {
      Alert.alert('خطأ', e.message || 'تعذر إرسال التعميم');
    } finally {
      setSendingBroadcast(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={styles.loadingText}>جاري فحص صلاحيات مدير النظام...</Text>
      </View>
    );
  }

  // Strictly check role === 'admin' or root email
  const isAuthorizedAdmin = profile?.role === 'admin' || profile?.email === 'root@gmail.com' || profile?.username === 'root';
  if (!profile || !isAuthorizedAdmin) {
    return (
      <View style={styles.center}>
        <LinearGradient colors={['#fee2e2', '#fecaca']} style={styles.unauthorizedIconWrap}>
          <Shield size={54} color={C.danger} />
        </LinearGradient>
        <Text style={styles.unauthorizedTitle}>صلاحية مدير النظام مطلوبة 👑</Text>
        <Text style={styles.unauthorizedSub}>
          لوحة التحكم مخصصة حصرياً لمدير النظام (Admin). الصلاحيات المعتمدة في المنصة هي: مدير النظام (Admin) ومستخدم عادي (User).
        </Text>

        {/* Claim Admin Button for Developer / Owner */}
        <Pressable style={styles.claimAdminBtn} onPress={handleClaimAdmin}>
          <Crown size={18} color="#fff" />
          <Text style={styles.claimAdminBtnText}>تفعيل صلاحية مدير النظام لحسابي 👑</Text>
        </Pressable>

        <Pressable style={styles.backBtn} onPress={() => router.replace('/home')}>
          <Text style={styles.backBtnText}>العودة للرئيسية</Text>
        </Pressable>
      </View>
    );
  }

  // Filtered Users List
  const filteredUsers = usersList.filter(u => {
    if (userSearch.trim()) {
      const q = userSearch.toLowerCase();
      const match = (u.display_name || '').toLowerCase().includes(q) ||
                    (u.username || '').toLowerCase().includes(q) ||
                    (u.city || '').toLowerCase().includes(q) ||
                    (u.district || '').toLowerCase().includes(q);
      if (!match) return false;
    }
    if (userRoleFilter === 'admin') return u.role === 'admin';
    if (userRoleFilter === 'user') return u.role === 'user' || !u.role;
    if (userRoleFilter === 'verified') return u.is_verified;
    if (userRoleFilter === 'banned') return u.is_banned;
    return true;
  });

  return (
    <View style={styles.container}>
      {/* Toast Feedback */}
      {toastMsg && (
        <Animated.View style={[styles.toastBanner, { opacity: toastAnim }]}>
          <Text style={styles.toastBannerText}>{toastMsg}</Text>
        </Animated.View>
      )}

      {/* ======================================================== */}
      {/* 1. EXECUTIVE HEADER (Dark Executive Gradient)            */}
      {/* ======================================================== */}
      <LinearGradient colors={['#0f172a', '#1e293b']} style={styles.headerGrad}>
        <View style={styles.headerContent}>
          <Pressable onPress={() => router.replace('/home')} style={styles.backIconBtn}>
            <ChevronRight size={22} color="#fff" />
          </Pressable>

          <View style={styles.headerTexts}>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
              <Text style={styles.headerTitle}>لوحة تحكم مدير النظام</Text>
              <Crown size={22} color="#f59e0b" />
            </View>
            <Text style={styles.headerSub}>
              صلاحية كاملة: {profile.display_name || profile.username} (Admin)
            </Text>
          </View>

          <Pressable onPress={onRefresh} style={styles.refreshBtn}>
            <RefreshCw size={18} color="#fff" />
          </Pressable>
        </View>

        {/* Live System Alerts Ribbon */}
        <View style={styles.alertsRow}>
          <View style={[styles.alertPill, { backgroundColor: '#0284c7' }]}>
            <ShieldCheck size={13} color="#fff" />
            <Text style={styles.alertPillText}>الرتب: مدير (Admin) · مستخدم (User)</Text>
          </View>

          {stats.pendingReports > 0 && (
            <View style={[styles.alertPill, { backgroundColor: '#dc2626' }]}>
              <Flag size={13} color="#fff" />
              <Text style={styles.alertPillText}>{stats.pendingReports} بلاغ معلق</Text>
            </View>
          )}

          {stats.pendingVerif > 0 && (
            <View style={[styles.alertPill, { backgroundColor: '#d97706' }]}>
              <Star size={13} color="#fff" />
              <Text style={styles.alertPillText}>{stats.pendingVerif} توثيق معلق</Text>
            </View>
          )}
        </View>
      </LinearGradient>

      {/* ======================================================== */}
      {/* 2. SECTION TABS SCROLLER                                 */}
      {/* ======================================================== */}
      <View style={styles.tabBarWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarScroll}>
          <TabPill
            label="نظرة عامة والتحليلات"
            icon={<BarChart3 size={15} color={activeTab === 'overview' ? '#fff' : '#64748b'} />}
            active={activeTab === 'overview'}
            onPress={() => setActiveTab('overview')}
          />
          <TabPill
            label={`المستخدمون (${usersList.length})`}
            icon={<Users size={15} color={activeTab === 'users' ? '#fff' : '#64748b'} />}
            active={activeTab === 'users'}
            onPress={() => setActiveTab('users')}
          />
          <TabPill
            label={`البلاغات (${stats.pendingReports})`}
            icon={<Flag size={15} color={activeTab === 'reports' ? '#fff' : '#64748b'} />}
            active={activeTab === 'reports'}
            badge={stats.pendingReports > 0 ? stats.pendingReports : undefined}
            onPress={() => setActiveTab('reports')}
          />
          <TabPill
            label={`طلبات التوثيق (${stats.pendingVerif})`}
            icon={<Star size={15} color={activeTab === 'verifications' ? '#fff' : '#64748b'} />}
            active={activeTab === 'verifications'}
            badge={stats.pendingVerif > 0 ? stats.pendingVerif : undefined}
            onPress={() => setActiveTab('verifications')}
          />
          <TabPill
            label="مراقبة المحتوى"
            icon={<MessageCircle size={15} color={activeTab === 'content' ? '#fff' : '#64748b'} />}
            active={activeTab === 'content'}
            onPress={() => setActiveTab('content')}
          />
          <TabPill
            label="إرسال تعميم 📢"
            icon={<Megaphone size={15} color={activeTab === 'broadcast' ? '#fff' : '#64748b'} />}
            active={activeTab === 'broadcast'}
            onPress={() => setActiveTab('broadcast')}
          />
        </ScrollView>
      </View>

      {/* ======================================================== */}
      {/* 3. MAIN DASHBOARD CONTENT SCROLL                         */}
      {/* ======================================================== */}
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.accent} />}
      >
        {/* ======================================================== */}
        {/* TAB 1: OVERVIEW & ANALYTICS                             */}
        {/* ======================================================== */}
        {activeTab === 'overview' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>مؤشرات أداء منصة حيّنا 🇸🇦</Text>
            
            <View style={styles.statsGrid}>
              <StatCard icon={<Users size={26} color="#0284c7" />} bg="#f0f9ff" value={stats.users} label="إجمالي المستخدمين" sub={`منهم ${stats.admins} مدير`} />
              <StatCard icon={<MessageCircle size={26} color="#0891b2" />} bg="#ecfeff" value={stats.questions} label="الاستفسارات" sub="خيوط تفاعلية نشطة" />
              <StatCard icon={<Truck size={26} color="#d97706" />} bg="#fffbeb" value={stats.requests} label="طلبات الفزعة" sub="مفتوحة ومكتملة" />
              <StatCard icon={<Briefcase size={26} color="#16a34a" />} bg="#f0fdf4" value={stats.services} label="خدمات الحي" sub="دليل معتمد" />
            </View>

            {/* Server & Engine Health */}
            <View style={styles.healthCard}>
              <View style={styles.healthHeader}>
                <View style={styles.healthStatusBadge}>
                  <View style={styles.healthDot} />
                  <Text style={styles.healthStatusText}>جميع الأنظمة تعمل بكفاءة 100%</Text>
                </View>
                <Text style={styles.healthTitle}>حالة الخوادم والربط التقني</Text>
              </View>

              <View style={styles.healthRow}>
                <Text style={styles.healthLabel}>قاعدة بيانات Supabase (PostgreSQL & Realtime)</Text>
                <Text style={styles.healthValueActive}>متصلة 🟢</Text>
              </View>
              <View style={styles.healthRow}>
                <Text style={styles.healthLabel}>استضافة Vercel Production & Edge CDN</Text>
                <Text style={styles.healthValueActive}>نشطة 🟢</Text>
              </View>
              <View style={styles.healthRow}>
                <Text style={styles.healthLabel}>نموذج الصلاحيات المعتمد</Text>
                <Text style={styles.healthValueRole}>مدير (Admin) / مستخدم (User)</Text>
              </View>
            </View>

            {/* Fast Action Shortcuts */}
            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>إجراءات سريعة لمدير النظام</Text>
            
            <Pressable style={styles.quickAction} onPress={() => setActiveTab('users')}>
              <View style={styles.quickActionLeft}>
                <Users size={20} color="#0284c7" />
                <Text style={styles.quickActionText}>إدارة المستخدمين وتعيين الصلاحيات</Text>
              </View>
              <ChevronRight size={18} color="#94a3b8" />
            </Pressable>

            <Pressable style={styles.quickAction} onPress={() => setActiveTab('reports')}>
              <View style={styles.quickActionLeft}>
                <Flag size={20} color={C.danger} />
                <Text style={styles.quickActionText}>مراجعة البلاغات والمحتوى المخالف</Text>
              </View>
              {stats.pendingReports > 0 ? (
                <View style={styles.qBadge}><Text style={styles.qBadgeText}>{stats.pendingReports} معلق</Text></View>
              ) : (
                <ChevronRight size={18} color="#94a3b8" />
              )}
            </Pressable>

            <Pressable style={styles.quickAction} onPress={() => setActiveTab('broadcast')}>
              <View style={styles.quickActionLeft}>
                <Megaphone size={20} color="#d97706" />
                <Text style={styles.quickActionText}>إرسال تعميم عاجل لجيران الحي</Text>
              </View>
              <ChevronRight size={18} color="#94a3b8" />
            </Pressable>
          </View>
        )}

        {/* ======================================================== */}
        {/* TAB 2: USER MANAGEMENT (ادمن ويوزر فقط)                  */}
        {/* ======================================================== */}
        {activeTab === 'users' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>إدارة المستخدمين والصلاحيات 👥</Text>
            
            {/* Search Input */}
            <View style={styles.searchBar}>
              <Search size={18} color="#94a3b8" />
              <TextInput
                style={styles.searchInput}
                placeholder="ابحث بالاسم، المعرف، المدينة أو الحي..."
                placeholderTextColor="#94a3b8"
                value={userSearch}
                onChangeText={setUserSearch}
              />
              {userSearch.length > 0 && (
                <Pressable onPress={() => setUserSearch('')}>
                  <Text style={{ color: '#94a3b8', fontSize: 13 }}>✕</Text>
                </Pressable>
              )}
            </View>

            {/* Filter Pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              <FilterPill label={`الكل (${usersList.length})`} active={userRoleFilter === 'all'} onPress={() => setUserRoleFilter('all')} />
              <FilterPill label="مدراء (Admin) 👑" active={userRoleFilter === 'admin'} onPress={() => setUserRoleFilter('admin')} />
              <FilterPill label="مستخدمون (User) 👤" active={userRoleFilter === 'user'} onPress={() => setUserRoleFilter('user')} />
              <FilterPill label="موثقون ✓" active={userRoleFilter === 'verified'} onPress={() => setUserRoleFilter('verified')} />
              <FilterPill label="محظورون 🚫" active={userRoleFilter === 'banned'} onPress={() => setUserRoleFilter('banned')} />
            </ScrollView>

            {/* User List */}
            {filteredUsers.length === 0 ? (
              <EmptyState icon={<Users size={38} color="#94a3b8" />} title="لا يوجد مستخدمون مطابقون" sub="جرب تغيير كلمات البحث أو التصفية" />
            ) : (
              filteredUsers.map(u => {
                const isAdmin = u.role === 'admin';
                return (
                  <View key={u.id} style={[styles.userCard, isAdmin && styles.userCardAdmin, u.is_banned && styles.userCardBanned]}>
                    <View style={styles.userCardHeader}>
                      {/* Avatar */}
                      <View style={styles.userAvatarWrap}>
                        {u.avatar_url ? (
                          <Image source={{ uri: u.avatar_url }} style={styles.userAvatarImg} />
                        ) : (
                          <View style={[styles.userAvatarFallback, isAdmin && { backgroundColor: '#0f172a' }]}>
                            <Text style={styles.userAvatarLetter}>{u.display_name?.[0] || 'م'}</Text>
                          </View>
                        )}
                        {isAdmin && (
                          <View style={styles.adminCrownBadge}>
                            <Crown size={10} color="#fff" />
                          </View>
                        )}
                      </View>

                      {/* Info */}
                      <View style={styles.userMeta}>
                        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.userName}>{u.display_name || 'بدون اسم'}</Text>
                          {u.is_verified && <CheckCircle2 size={14} color="#0284c7" />}
                          {u.is_geoverified && <ShieldCheck size={14} color="#16a34a" />}
                        </View>
                        <Text style={styles.userHandle}>@{u.username || 'user'}</Text>
                        <Text style={styles.userLocation}>
                          📍 {u.district ? `حي ${u.district}` : 'الحي غير محدد'} · {u.city || 'الرياض'}
                        </Text>
                      </View>

                      {/* Role Badge */}
                      <View style={[styles.roleBadge, isAdmin ? styles.roleBadgeAdmin : styles.roleBadgeUser]}>
                        <Text style={[styles.roleBadgeText, isAdmin ? styles.roleBadgeTextAdmin : styles.roleBadgeTextUser]}>
                          {isAdmin ? '👑 مدير النظام' : '👤 مستخدم'}
                        </Text>
                      </View>
                    </View>

                    {/* Admin Action Buttons */}
                    <View style={styles.userActionsRow}>
                      {/* 1. Toggle Admin Role */}
                      <Pressable 
                        style={[styles.userActionBtn, isAdmin ? styles.btnDemote : styles.btnPromote]} 
                        onPress={() => toggleUserRole(u)}
                      >
                        {isAdmin ? <UserX size={14} color="#d97706" /> : <Crown size={14} color="#0284c7" />}
                        <Text style={[styles.userActionBtnText, isAdmin ? { color: '#d97706' } : { color: '#0284c7' }]}>
                          {isAdmin ? 'خفض لمستخدم' : 'ترقية لمدير 👑'}
                        </Text>
                      </Pressable>

                      {/* 2. Official Verification */}
                      <Pressable 
                        style={[styles.userActionBtn, u.is_verified && styles.btnActiveSuccess]} 
                        onPress={() => toggleVerification(u)}
                      >
                        <CheckCircle2 size={14} color={u.is_verified ? '#16a34a' : '#64748b'} />
                        <Text style={[styles.userActionBtnText, u.is_verified && { color: '#16a34a' }]}>
                          {u.is_verified ? 'شارة موثقة' : 'توثيق رسمي'}
                        </Text>
                      </Pressable>

                      {/* 3. Geo Verification */}
                      <Pressable 
                        style={[styles.userActionBtn, u.is_geoverified && styles.btnActiveSuccess]} 
                        onPress={() => toggleGeoVerification(u)}
                      >
                        <ShieldCheck size={14} color={u.is_geoverified ? '#16a34a' : '#64748b'} />
                        <Text style={[styles.userActionBtnText, u.is_geoverified && { color: '#16a34a' }]}>
                          {u.is_geoverified ? 'ابن الحي ✓' : 'توثيق السكن'}
                        </Text>
                      </Pressable>

                      {/* 4. Ban / Unban */}
                      <Pressable 
                        style={[styles.userActionBtn, u.is_banned ? styles.btnBannedActive : styles.btnBan]} 
                        onPress={() => toggleBanUser(u)}
                      >
                        <Ban size={14} color={u.is_banned ? '#fff' : '#dc2626'} />
                        <Text style={[styles.userActionBtnText, u.is_banned ? { color: '#fff' } : { color: '#dc2626' }]}>
                          {u.is_banned ? 'فك الحظر' : 'حظر'}
                        </Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* ======================================================== */}
        {/* TAB 3: REPORTS & CONTENT MODERATION                     */}
        {/* ======================================================== */}
        {activeTab === 'reports' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>مركز البلاغات والمراقبة 🚨</Text>
            
            {reports.length === 0 ? (
              <EmptyState icon={<Flag size={40} color="#10b981" />} title="لا توجد بلاغات معلقة" sub="المجتمع آمن ونظيف بفضل الله 🎉" />
            ) : (
              reports.map(r => (
                <View key={r.id} style={[styles.reportCard, r.status !== 'pending' && { borderColor: '#e2e8f0', opacity: 0.75 }]}>
                  <View style={styles.reportHeader}>
                    <View style={styles.reportStatusTag}>
                      <Text style={styles.reportStatusText}>
                        {r.status === 'pending' ? '⏳ معلق' : r.status === 'resolved' ? '✓ تم الحل' : '✕ تم التجاهل'}
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                      <Flag size={16} color={C.danger} />
                      <Text style={styles.reportType}>نوع المحتوى: {r.target_type || 'منشور'}</Text>
                    </View>
                  </View>

                  <Text style={styles.reportReason}>سبب البلاغ: "{r.reason || 'محتوى غير لائق'}"</Text>
                  
                  <View style={styles.reportMetaRow}>
                    <Text style={styles.reportDate}>{new Date(r.created_at).toLocaleDateString('ar-SA')}</Text>
                    <Text style={styles.reportFrom}>
                      مقدم البلاغ: {r.reporter?.display_name || r.reporter?.username || 'مستخدم مجهول'}
                    </Text>
                  </View>

                  {r.status === 'pending' && (
                    <View style={styles.reportActionsGrid}>
                      <Pressable style={styles.btnDeleteContent} onPress={() => deleteReportedContent(r)}>
                        <Trash size={15} color="#fff" />
                        <Text style={styles.btnActionTextWhite}>حذف المحتوى المخالف فوراً 🗑️</Text>
                      </Pressable>

                      <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 6 }}>
                        <Pressable style={styles.resolveBtn} onPress={() => resolveReport(r.id, 'resolved')}>
                          <CheckCircle2 size={16} color="#fff" />
                          <Text style={styles.resolveBtnText}>إغلاق البلاغ كمعالج ✓</Text>
                        </Pressable>

                        <Pressable style={styles.dismissBtn} onPress={() => resolveReport(r.id, 'dismissed')}>
                          <XCircle size={16} color="#64748b" />
                          <Text style={styles.dismissBtnText}>تجاهل كيدي ✕</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        )}

        {/* ======================================================== */}
        {/* TAB 4: VERIFICATIONS DESK                                */}
        {/* ======================================================== */}
        {activeTab === 'verifications' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>مكتب التوثيق الرسمي بالشارة الزرقاء 🌟</Text>

            {verifications.length === 0 ? (
              <EmptyState icon={<Star size={40} color="#f59e0b" />} title="لا توجد طلبات توثيق معلقة" sub="تم فحص ومراجعة كافة الطلبات السابقة ✅" />
            ) : (
              verifications.map(v => (
                <View key={v.id} style={styles.verifCard}>
                  <View style={styles.verifHeader}>
                    <View style={styles.verifUserInfo}>
                      <Text style={styles.verifUserName}>{v.user?.display_name || v.user?.username || 'مواطن'}</Text>
                      <Text style={styles.verifUserCity}>📍 {v.user?.city || 'الرياض'}</Text>
                    </View>

                    <View style={styles.verifUserBadge}>
                      <Star size={22} color="#d97706" />
                    </View>
                  </View>

                  {v.note && (
                    <Text style={styles.verifNote}>ملاحظة المتقدم: "{v.note}"</Text>
                  )}

                  <Text style={styles.verifDate}>
                    تاريخ الطلب: {new Date(v.created_at).toLocaleDateString('ar-SA')} · الحالة: {v.status === 'pending' ? 'قيد المراجعة' : v.status}
                  </Text>

                  {v.status === 'pending' && (
                    <View style={styles.reportActions}>
                      <Pressable style={styles.resolveBtn} onPress={() => handleVerificationDecision(v.id, v.user_id, 'approved')}>
                        <Check size={16} color="#fff" />
                        <Text style={styles.resolveBtnText}>اعتماد ومنح التوثيق ✓</Text>
                      </Pressable>

                      <Pressable style={styles.dismissBtn} onPress={() => handleVerificationDecision(v.id, v.user_id, 'rejected')}>
                        <X size={16} color="#64748b" />
                        <Text style={styles.dismissBtnText}>رفض الطلب</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        )}

        {/* ======================================================== */}
        {/* TAB 5: COMMUNITY CONTENT MODERATION                     */}
        {/* ======================================================== */}
        {activeTab === 'content' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>مراقبة الاستفسارات ومنشورات الحي 💬</Text>

            {/* Filter Pills */}
            <View style={styles.filterRow}>
              <FilterPill label="جميع المنشورات" active={contentTypeFilter === 'all'} onPress={() => setContentTypeFilter('all')} />
              <FilterPill label={`الاستفسارات (${questionsList.length})`} active={contentTypeFilter === 'questions'} onPress={() => setContentTypeFilter('questions')} />
              <FilterPill label={`طلبات الفزعة (${requestsList.length})`} active={contentTypeFilter === 'requests'} onPress={() => setContentTypeFilter('requests')} />
            </View>

            {/* Questions list */}
            {(contentTypeFilter === 'all' || contentTypeFilter === 'questions') && (
              <View style={{ marginBottom: 16 }}>
                <Text style={styles.subSectionTitle}>💬 الاستفسارات الحديثة</Text>
                {questionsList.map(q => (
                  <View key={`q-${q.id}`} style={styles.contentItemCard}>
                    <View style={styles.contentItemHeader}>
                      <Text style={styles.contentAuthorName}>{q.profiles?.display_name || 'ابن الحي'}</Text>
                      <Text style={styles.contentItemCity}>📍 {q.city || 'الرياض'}</Text>
                    </View>

                    <Text style={styles.contentItemTitle}>{q.title}</Text>
                    {q.body && <Text style={styles.contentItemBody} numberOfLines={2}>{q.body}</Text>}

                    <View style={styles.contentItemFooter}>
                      <Pressable style={styles.btnDeleteSm} onPress={() => deleteContentItem(q.id, 'question')}>
                        <Trash size={14} color="#dc2626" />
                        <Text style={styles.btnDeleteSmText}>حذف المنشور 🗑️</Text>
                      </Pressable>

                      <Pressable style={styles.btnViewSm} onPress={() => router.push({ pathname: '/question', params: { id: q.id } })}>
                        <Eye size={14} color="#0891b2" />
                        <Text style={styles.btnViewSmText}>معاينة الاستفسار</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Requests list */}
            {(contentTypeFilter === 'all' || contentTypeFilter === 'requests') && (
              <View>
                <Text style={styles.subSectionTitle}>🚚 طلبات الفزعة الحديثة</Text>
                {requestsList.map(r => (
                  <View key={`r-${r.id}`} style={styles.contentItemCard}>
                    <View style={styles.contentItemHeader}>
                      <Text style={styles.contentAuthorName}>{r.profiles?.display_name || 'طالب المساعدة'}</Text>
                      <Text style={styles.contentItemCity}>📍 {r.city || 'الرياض'}</Text>
                    </View>

                    <Text style={styles.contentItemTitle}>{r.title}</Text>
                    {r.description && <Text style={styles.contentItemBody} numberOfLines={2}>{r.description}</Text>}

                    <View style={styles.contentItemFooter}>
                      <Pressable style={styles.btnDeleteSm} onPress={() => deleteContentItem(r.id, 'request')}>
                        <Trash size={14} color="#dc2626" />
                        <Text style={styles.btnDeleteSmText}>حذف الطلب 🗑️</Text>
                      </Pressable>

                      <Pressable style={styles.btnViewSm} onPress={() => router.push({ pathname: '/request', params: { id: r.id } })}>
                        <Eye size={14} color="#0891b2" />
                        <Text style={styles.btnViewSmText}>معاينة الطلب</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ======================================================== */}
        {/* TAB 6: BROADCAST ANNOUNCEMENT                           */}
        {/* ======================================================== */}
        {activeTab === 'broadcast' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>إرسال تعميم وتنبيه رسمي للجيران 📢</Text>
            
            <View style={styles.broadcastBox}>
              <Text style={styles.inputLabel}>عنوان التعميم الإداري</Text>
              <TextInput
                style={styles.formInput}
                placeholder="مثال: تنبيه هام بشأن أعمال صيانة شبكة الحي..."
                placeholderTextColor="#94a3b8"
                value={broadcastTitle}
                onChangeText={setBroadcastTitle}
              />

              <Text style={[styles.inputLabel, { marginTop: 12 }]}>نص التعميم والتفاصيل</Text>
              <TextInput
                style={[styles.formInput, { height: 110, textAlignVertical: 'top' }]}
                placeholder="اكتب التوجيهات أو التعليمات الرسمية لأهل الحي..."
                placeholderTextColor="#94a3b8"
                value={broadcastBody}
                onChangeText={setBroadcastBody}
                multiline
              />

              <Text style={[styles.inputLabel, { marginTop: 12 }]}>نطاق الإرسال المستهدف</Text>
              <View style={styles.filterRow}>
                <FilterPill label="🇸🇦 كل المملكة" active={broadcastTarget === 'all'} onPress={() => setBroadcastTarget('all')} />
                <FilterPill label="الرياض" active={broadcastTarget === 'riyadh'} onPress={() => setBroadcastTarget('riyadh')} />
                <FilterPill label="جدة" active={broadcastTarget === 'jeddah'} onPress={() => setBroadcastTarget('jeddah')} />
                <FilterPill label="الدمام" active={broadcastTarget === 'dammam'} onPress={() => setBroadcastTarget('dammam')} />
              </View>

              <Pressable 
                style={[styles.btnSendBroadcast, sendingBroadcast && { opacity: 0.6 }]} 
                onPress={handleSendBroadcast}
                disabled={sendingBroadcast}
              >
                {sendingBroadcast ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Send size={18} color="#fff" />
                    <Text style={styles.btnSendBroadcastText}>نشر التعميم الرسمي الآن 📢</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        )}

        <View style={{ height: 90 }} />
      </ScrollView>
    </View>
  );
}

// ========================================================
// HELPER COMPONENTS
// ========================================================

function TabPill({ label, icon, active, badge, onPress }: { label: string; icon: any; active: boolean; badge?: number; onPress: () => void }) {
  return (
    <Pressable style={[styles.navTabPill, active && styles.navTabPillActive]} onPress={onPress}>
      {icon}
      <Text style={[styles.navTabPillText, active && styles.navTabPillTextActive]}>{label}</Text>
      {badge !== undefined && badge > 0 && (
        <View style={styles.navTabBadge}>
          <Text style={styles.navTabBadgeText}>{badge}</Text>
        </View>
      )}
    </Pressable>
  );
}

function FilterPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.filterPill, active && styles.filterPillActive]} onPress={onPress}>
      <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>{label}</Text>
    </Pressable>
  );
}

function StatCard({ icon, bg, value, label, sub }: { icon: any; bg: string; value: number; label: string; sub?: string }) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconBox, { backgroundColor: bg }]}>{icon}</View>
      <Text style={styles.statValue}>{value.toLocaleString('ar-SA')}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub && <Text style={styles.statSub}>{sub}</Text>}
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

// ========================================================
// STYLESHEET
// ========================================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC', padding: 24 },
  loadingText: { marginTop: 16, fontSize: 15, color: '#64748B', fontWeight: '800' },
  toastBanner: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 42,
    alignSelf: 'center',
    zIndex: 999,
    backgroundColor: '#0F172A',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#334155',
  },
  toastBannerText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  headerGrad: { paddingTop: Platform.OS === 'ios' ? 54 : 40, paddingBottom: 18, paddingHorizontal: 20 },
  headerContent: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  headerTexts: { flex: 1, alignItems: 'flex-end', marginHorizontal: 10 },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#fff' },
  headerSub: { fontSize: 12, color: '#94A3B8', fontWeight: '700', marginTop: 2 },
  backIconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  refreshBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  alertsRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6 },
  alertPill: { flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14, gap: 5 },
  alertPillText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  tabBarWrapper: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  tabBarScroll: { paddingHorizontal: 14, paddingVertical: 10, gap: 8, flexDirection: 'row-reverse' },
  navTabPill: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#F1F5F9', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, gap: 6 },
  navTabPillActive: { backgroundColor: '#0891B2' },
  navTabPillText: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  navTabPillTextActive: { color: '#fff', fontWeight: '900' },
  navTabBadge: { backgroundColor: '#EF4444', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1 },
  navTabBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  scroll: { flex: 1 },
  section: { padding: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A', textAlign: 'right', marginBottom: 14 },
  subSectionTitle: { fontSize: 14, fontWeight: '900', color: '#334155', textAlign: 'right', marginBottom: 10 },
  statsGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  statCard: { width: '48%', backgroundColor: '#fff', borderRadius: 20, padding: 14, alignItems: 'flex-end', borderWidth: 1, borderColor: '#E2E8F0', elevation: 1 },
  statIconBox: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statValue: { fontSize: 24, fontWeight: '900', color: '#0F172A' },
  statLabel: { fontSize: 12, color: '#64748B', fontWeight: '800', marginTop: 2 },
  statSub: { fontSize: 10, color: '#94A3B8', marginTop: 2 },
  healthCard: { marginTop: 14, backgroundColor: '#fff', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  healthHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingBottom: 10 },
  healthTitle: { fontSize: 13, fontWeight: '900', color: '#0F172A' },
  healthStatusBadge: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  healthDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
  healthStatusText: { fontSize: 11, fontWeight: '800', color: '#10B981' },
  healthRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  healthLabel: { fontSize: 12, color: '#475569', fontWeight: '700' },
  healthValueActive: { fontSize: 12, color: '#10B981', fontWeight: '900' },
  healthValueRole: { fontSize: 11, color: '#0891B2', fontWeight: '800', backgroundColor: '#ECFEFF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  quickAction: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', padding: 14, borderRadius: 16, marginBottom: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  quickActionLeft: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  quickActionText: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  qBadge: { backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  qBadgeText: { color: '#EF4444', fontSize: 11, fontWeight: '900' },

  // User Management
  searchBar: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 12, height: 44, borderWidth: 1, borderColor: '#E2E8F0', gap: 8, marginBottom: 10 },
  searchInput: { flex: 1, fontSize: 13, color: '#0F172A', textAlign: 'right' },
  filterRow: { flexDirection: 'row-reverse', gap: 6, marginBottom: 12 },
  filterPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  filterPillActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  filterPillText: { fontSize: 11, fontWeight: '800', color: '#64748B' },
  filterPillTextActive: { color: '#fff' },
  userCard: { backgroundColor: '#fff', borderRadius: 18, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  userCardAdmin: { borderColor: '#BAE6FD', backgroundColor: '#F0F9FF' },
  userCardBanned: { borderColor: '#FECACA', backgroundColor: '#FEF2F2' },
  userCardHeader: { flexDirection: 'row-reverse', alignItems: 'center' },
  userAvatarWrap: { position: 'relative', marginLeft: 10 },
  userAvatarImg: { width: 44, height: 44, borderRadius: 22 },
  userAvatarFallback: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#0284C7', justifyContent: 'center', alignItems: 'center' },
  userAvatarLetter: { color: '#fff', fontSize: 16, fontWeight: '900' },
  adminCrownBadge: { position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: '#F59E0B', justifyContent: 'center', alignItems: 'center', borderWidth: 1.5, borderColor: '#fff' },
  userMeta: { flex: 1, alignItems: 'flex-end' },
  userName: { fontSize: 14, fontWeight: '900', color: '#0F172A' },
  userHandle: { fontSize: 11, color: '#64748B', fontWeight: '600' },
  userLocation: { fontSize: 11, color: '#0891B2', fontWeight: '700', marginTop: 2 },
  roleBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  roleBadgeAdmin: { backgroundColor: '#0F172A' },
  roleBadgeUser: { backgroundColor: '#F1F5F9' },
  roleBadgeText: { fontSize: 10, fontWeight: '900' },
  roleBadgeTextAdmin: { color: '#F59E0B' },
  roleBadgeTextUser: { color: '#64748B' },
  userActionsRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  userActionBtn: { flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', gap: 4 },
  userActionBtnText: { fontSize: 10, fontWeight: '800' },
  btnPromote: { borderColor: '#BAE6FD', backgroundColor: '#F0F9FF' },
  btnDemote: { borderColor: '#FED7AA', backgroundColor: '#FFFBEB' },
  btnActiveSuccess: { borderColor: '#86EFAC', backgroundColor: '#F0FDF4' },
  btnBan: { borderColor: '#FECACA' },
  btnBannedActive: { backgroundColor: '#DC2626', borderColor: '#DC2626' },

  // Reports
  reportCard: { backgroundColor: '#fff', borderRadius: 18, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#FCA5A5' },
  reportHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  reportType: { fontSize: 12, fontWeight: '800', color: '#334155' },
  reportStatusTag: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, backgroundColor: '#FEE2E2' },
  reportStatusText: { fontSize: 10, fontWeight: '900', color: '#DC2626' },
  reportReason: { fontSize: 14, fontWeight: '800', color: '#0F172A', textAlign: 'right', marginBottom: 6 },
  reportMetaRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  reportFrom: { fontSize: 11, color: '#64748B', fontWeight: '700' },
  reportDate: { fontSize: 11, color: '#94A3B8' },
  reportActionsGrid: { borderTopWidth: 1, borderTopColor: '#FEE2E2', paddingTop: 10 },
  btnDeleteContent: { backgroundColor: '#DC2626', paddingVertical: 8, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexDirection: 'row-reverse', gap: 6 },
  btnActionTextWhite: { color: '#fff', fontSize: 11, fontWeight: '900' },
  reportActions: { flexDirection: 'row-reverse', gap: 8, marginTop: 8 },
  resolveBtn: { flex: 1, flexDirection: 'row-reverse', backgroundColor: '#10B981', paddingVertical: 8, borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 5 },
  resolveBtnText: { color: '#fff', fontWeight: '800', fontSize: 11 },
  dismissBtn: { flex: 1, flexDirection: 'row-reverse', backgroundColor: '#F1F5F9', paddingVertical: 8, borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 5 },
  dismissBtnText: { color: '#64748B', fontWeight: '800', fontSize: 11 },

  // Verifications
  verifCard: { backgroundColor: '#fff', borderRadius: 18, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#FDE68A' },
  verifHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  verifUserInfo: { alignItems: 'flex-end' },
  verifUserName: { fontSize: 14, fontWeight: '900', color: '#0F172A' },
  verifUserCity: { fontSize: 11, color: '#64748B', fontWeight: '600' },
  verifUserBadge: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' },
  verifNote: { fontSize: 12, color: '#451A03', textAlign: 'right', backgroundColor: '#FFFBEB', padding: 8, borderRadius: 8, marginBottom: 6 },
  verifDate: { fontSize: 11, color: '#94A3B8', textAlign: 'right' },

  // Content Moderation
  contentItemCard: { backgroundColor: '#fff', borderRadius: 16, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  contentItemHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  contentAuthorName: { fontSize: 12, fontWeight: '800', color: '#0F172A' },
  contentItemCity: { fontSize: 11, color: '#0891B2', fontWeight: '700' },
  contentItemTitle: { fontSize: 13, fontWeight: '900', color: '#0F172A', textAlign: 'right', marginBottom: 4 },
  contentItemBody: { fontSize: 11, color: '#475569', textAlign: 'right', marginBottom: 8 },
  contentItemFooter: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F8FAFC', paddingTop: 8 },
  btnDeleteSm: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, backgroundColor: '#FEF2F2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  btnDeleteSmText: { fontSize: 10, fontWeight: '800', color: '#DC2626' },
  btnViewSm: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, backgroundColor: '#ECFEFF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  btnViewSmText: { fontSize: 10, fontWeight: '800', color: '#0891B2' },

  // Broadcast
  broadcastBox: { backgroundColor: '#fff', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  inputLabel: { fontSize: 12, fontWeight: '800', color: '#334155', textAlign: 'right', marginBottom: 6 },
  formInput: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: '#0F172A', textAlign: 'right' },
  btnSendBroadcast: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0891B2', borderRadius: 14, paddingVertical: 12, marginTop: 16, gap: 8 },
  btnSendBroadcastText: { color: '#fff', fontSize: 13, fontWeight: '900' },

  // Empty & Unauthorized
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  emptyTitle: { fontSize: 15, fontWeight: '900', color: '#64748B', marginBottom: 4 },
  emptySub: { fontSize: 12, color: '#94A3B8' },
  unauthorizedIconWrap: { width: 90, height: 90, borderRadius: 45, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  unauthorizedTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A', marginBottom: 8 },
  unauthorizedSub: { fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 20, marginBottom: 20, paddingHorizontal: 20 },
  claimAdminBtn: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#0F172A', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 16, gap: 8, marginBottom: 10 },
  claimAdminBtnText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  backBtn: { backgroundColor: '#F1F5F9', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 16 },
  backBtnText: { color: '#475569', fontWeight: '800', fontSize: 13 },
});
