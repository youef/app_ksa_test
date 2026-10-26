import { OasisPressable as Pressable, OasisTextInput as TextInput, OasisSurface } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Alert, ScrollView, Text, View, ActivityIndicator, Platform, Image, Linking, Animated } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import {
  getBrandingLogo,
  broadcastLogoUpdate,
  withVersion,
  getCachedBrandingLogo,
  subscribeBrandingLogo,
} from '@/lib/branding';
import { sendAdminBroadcastPush } from '@/lib/pushSender';
import { useAdminRealtime } from '@/hooks/useAdminRealtime';
import { bucketByDay, TrendPoint } from '@/components/admin/AdminInsights';
import { AdminTaskCenter } from '@/components/admin/AdminTaskCenter';
import { AdminWorkspace } from '@/components/admin/AdminWorkspace';
import { AdminOverview } from '@/components/admin/AdminOverview';
import { AdminGlobalSearch } from '@/components/admin/AdminGlobalSearch';
import { AdminFeatureFlags } from '@/components/admin/AdminFeatureFlags';
import { AdminRbacPanel } from '@/components/admin/AdminRbacPanel';
import { AdminAnalytics } from '@/components/admin/AdminAnalytics';
import { AdminSecurityCenter } from '@/components/admin/AdminSecurityCenter';
import { AdminBadges } from '@/components/admin/AdminBadges';
import { AdminWeeklyReport } from '@/components/admin/AdminWeeklyReport';
import { AdminSupportCenter } from '@/components/admin/AdminSupportCenter';
import {
  Shield,
  Users,
  MessageCircle,
  Truck,
  Wrench,
  Flag,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
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
  ShieldCheck,
  Ban,
  UserX,
  Download,
  Sparkles,
  Clock,
  MapPin,
  Activity,
  Archive,
  Phone,
  ListChecks,
  Settings,
  LayoutDashboard,
  CalendarDays,
  Award,
  Lock,
  LifeBuoy,
  TrendingUp,
  Store,
  Building2,
  UserCog,
} from 'lucide-react-native';

import {
  AdminProfile,
  AdminVerificationRequest,
  AdminReport,
  AdminService,
  AdminBorrowItem,
  AdminUrgentAlert,
  AdminQuestion,
  AdminRequest,
  AdminActivityLog,
  AdminStats,
} from '@/components/admin/adminTypes';
import { adminStyles as styles, ADMIN_COLORS as C } from '@/components/admin/adminStyles';

function verificationAccountLabel(value?: string | null): string {
  switch (value) {
    case 'merchant': return 'مؤسسة أو نشاط تجاري';
    case 'freelance': return 'عمل حر';
    case 'provider': return 'مقدم خدمة';
    case 'idea': return 'مبادرة أو مشروع ناشئ';
    default: return 'حساب فردي';
  }
}

function accountAgeLabel(iso?: string | null): string {
  if (!iso) return '—';
  const days = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000));
  if (days < 30) return `${days} يوم`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} شهر`;
  return `${Math.floor(months / 12)} سنة`;
}

// Cross-platform alert confirmation
function confirmAction(title: string, message: string, onConfirm: () => void | Promise<void>) {
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
}

// ============================================================
// Navigation model (v2 command center) — grouped two-level nav
// ============================================================
type AdminTabKey =
  | 'overview'
  | 'tasks'
  | 'search'
  | 'analytics'
  | 'users'
  | 'verifications'
  | 'support'
  | 'reports'
  | 'content'
  | 'platform'
  | 'broadcast'
  | 'locations'
  | 'branding'
  | 'weekly'
  | 'badges'
  | 'config'
  | 'roles'
  | 'security'
  | 'logs';

interface AdminTabMeta {
  key: AdminTabKey;
  label: string;
  icon: (active: boolean) => React.ReactNode;
}

interface AdminNavGroup {
  key: string;
  label: string;
  emoji: string;
  tabs: AdminTabMeta[];
}

const ADMIN_NAV: AdminNavGroup[] = [
  {
    key: 'command',
    label: 'الرئيسية',
    emoji: '🎯',
    tabs: [
      { key: 'overview', label: 'نظرة عامة', icon: (a) => <LayoutDashboard size={15} color={a ? C.accentDark : OASIS.colors.muted} /> },
      { key: 'tasks', label: 'مركز المهام', icon: (a) => <ListChecks size={15} color={a ? C.accentDark : OASIS.colors.muted} /> },
      { key: 'search', label: 'البحث الشامل', icon: (a) => <Search size={15} color={a ? C.accentDark : OASIS.colors.muted} /> },
    ],
  },
  {
    key: 'community',
    label: 'المجتمع',
    emoji: '👥',
    tabs: [
      { key: 'users', label: 'المستخدمون', icon: (a) => <Users size={15} color={a ? C.accentDark : OASIS.colors.muted} /> },
      { key: 'verifications', label: 'التوثيق', icon: (a) => <Star size={15} color={a ? C.accentDark : OASIS.colors.muted} /> },
      { key: 'support', label: 'الدعم والتذاكر', icon: (a) => <LifeBuoy size={15} color={a ? C.accentDark : OASIS.colors.muted} /> },
      { key: 'reports', label: 'البلاغات', icon: (a) => <Flag size={15} color={a ? C.accentDark : OASIS.colors.muted} /> },
      { key: 'content', label: 'المحتوى', icon: (a) => <MessageCircle size={15} color={a ? C.accentDark : OASIS.colors.muted} /> },
    ],
  },
  {
    key: 'platform',
    label: 'المنصة',
    emoji: '🏢',
    tabs: [
      { key: 'platform', label: 'الموارد والخدمات', icon: (a) => <Truck size={15} color={a ? C.accentDark : OASIS.colors.muted} /> },
      { key: 'broadcast', label: 'البث والتعاميم', icon: (a) => <Megaphone size={15} color={a ? C.accentDark : OASIS.colors.muted} /> },
      { key: 'locations', label: 'المواقع', icon: (a) => <MapPin size={15} color={a ? C.accentDark : OASIS.colors.muted} /> },
      { key: 'branding', label: 'الهوية والشعار', icon: (a) => <Sparkles size={15} color={a ? C.accentDark : OASIS.colors.muted} /> },
    ],
  },
  {
    key: 'insights',
    label: 'التحليلات',
    emoji: '📊',
    tabs: [
      { key: 'analytics', label: 'تحليلات متقدمة', icon: (a) => <BarChart3 size={15} color={a ? C.accentDark : OASIS.colors.muted} /> },
      { key: 'weekly', label: 'التقرير الأسبوعي', icon: (a) => <CalendarDays size={15} color={a ? C.accentDark : OASIS.colors.muted} /> },
      { key: 'badges', label: 'الأوسمة والتحفيز', icon: (a) => <Award size={15} color={a ? C.accentDark : OASIS.colors.muted} /> },
    ],
  },
  {
    key: 'system',
    label: 'النظام',
    emoji: '⚙️',
    tabs: [
      { key: 'config', label: 'الميزات والإعدادات', icon: (a) => <Settings size={15} color={a ? C.accentDark : OASIS.colors.muted} /> },
      { key: 'roles', label: 'الأدوار والصلاحيات', icon: (a) => <ShieldCheck size={15} color={a ? C.accentDark : OASIS.colors.muted} /> },
      { key: 'security', label: 'الأمان والجلسات', icon: (a) => <Lock size={15} color={a ? C.accentDark : OASIS.colors.muted} /> },
      { key: 'logs', label: 'سجل العمليات', icon: (a) => <Clock size={15} color={a ? C.accentDark : OASIS.colors.muted} /> },
    ],
  },
];

export default function AdminScreen() {
  // Auth and loading state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [currentAdmin, setCurrentAdmin] = useState<AdminProfile | null>(null);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<AdminTabKey>('overview');

  // Core relational data sets
  const [usersList, setUsersList] = useState<AdminProfile[]>([]);
  const [verifications, setVerifications] = useState<AdminVerificationRequest[]>([]);
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [servicesList, setServicesList] = useState<AdminService[]>([]);
  const [borrowItemsList, setBorrowItemsList] = useState<AdminBorrowItem[]>([]);
  const [urgentAlertsList, setUrgentAlertsList] = useState<AdminUrgentAlert[]>([]);
  const [questionsList, setQuestionsList] = useState<AdminQuestion[]>([]);
  const [requestsList, setRequestsList] = useState<AdminRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminActivityLog[]>([]);
  const [customLocations, setCustomLocations] = useState<any[]>([]);

  // 30-day analytics series for the insights dashboard
  const [analytics, setAnalytics] = useState<{ users: TrendPoint[]; reports: TrendPoint[]; questions: TrendPoint[] }>({
    users: [],
    reports: [],
    questions: [],
  });

  // Platform statistics
  const [stats, setStats] = useState<AdminStats>({
    users: 0,
    admins: 0,
    verifiedUsers: 0,
    geoverifiedUsers: 0,
    bannedUsers: 0,
    pendingVerifications: 0,
    pendingReports: 0,
    services: 0,
    borrowItems: 0,
    urgentAlerts: 0,
    questions: 0,
    requests: 0,
  });

  // Selected User Inspector Modal State
  const [inspectedUser, setInspectedUser] = useState<AdminProfile | null>(null);
  const [userActivityStats, setUserActivityStats] = useState<{ qCount: number; aCount: number; reqCount: number }>({
    qCount: 0,
    aCount: 0,
    reqCount: 0,
  });
  const [userDevices, setUserDevices] = useState(0);
  const [userExtras, setUserExtras] = useState<{
    services: number;
    reportsAgainst: number;
    recent: Array<{ id: string; title: string; created_at: string }>;
  }>({ services: 0, reportsAgainst: 0, recent: [] });
  const [directNoticeText, setDirectNoticeText] = useState('');
  const [sendingDirectNotice, setSendingDirectNotice] = useState(false);

  // Filters & Search
  const [userSearch, setUserSearch] = useState('');
  const [userSort, setUserSort] = useState<'recent' | 'oldest' | 'name'>('recent');
  const [loadWarning, setLoadWarning] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | 'admin' | 'user' | 'verified' | 'geoverified' | 'banned'>('all');
  const [selectedCityFilter, setSelectedCityFilter] = useState<string>('all');
  const [platformTabSub, setPlatformTabSub] = useState<'services' | 'borrow' | 'urgent'>('services');
  const [contentFilter, setContentFilter] = useState<'all' | 'questions' | 'requests'>('all');
  const [reportStatusFilter, setReportStatusFilter] = useState<'all' | 'pending' | 'resolved' | 'dismissed'>('pending');

  // Broadcast Center State
  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastBody, setBroadcastBody] = useState('');
  const [broadcastTarget, setBroadcastTarget] = useState<'all' | 'الرياض' | 'جدة' | 'الدمام' | 'مكة' | 'المدينة'>('all');
  const [broadcastType, setBroadcastType] = useState<'official' | 'emergency' | 'weather' | 'maintenance'>('official');
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [broadcastSegment, setBroadcastSegment] = useState<'all' | 'verified' | 'unverified' | 'admins'>('all');
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [scheduleAt, setScheduleAt] = useState('');
  const [scheduledList, setScheduledList] = useState<any[]>([]);
  const [lastDelivery, setLastDelivery] = useState<{ recipients: number; pushed: number; label: string } | null>(null);

  // Custom Locations Form
  const [locationName, setLocationName] = useState('');
  const [locationCity, setLocationCity] = useState('');
  const [locationRegion, setLocationRegion] = useState('');
  const [savingLocation, setSavingLocation] = useState(false);

  // Branding Logo State
  const [brandingLogo, setBrandingLogo] = useState(getCachedBrandingLogo());
  const [brandingUploading, setBrandingUploading] = useState(false);

  // Toast feedback
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;

  const showToast = useCallback(
    (msg: string) => {
      setToastMsg(msg);
      Animated.sequence([
        Animated.timing(toastAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.delay(2400),
        Animated.timing(toastAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start(() => setToastMsg(null));
    },
    [toastAnim]
  );

  // Audit Log Recorder
  const recordAuditLog = useCallback(
    async (action: string, targetName: string, targetType?: string, targetId?: string) => {
      try {
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) return;
        await supabase.from('admin_activity_logs').insert({
          actor_id: u.user.id,
          action,
          target_type: targetType || null,
          target_id: targetId || null,
          metadata: { target_name: targetName },
        });
      } catch (err: any) {
        console.warn('Audit record warning:', err?.message);
      }
    },
    []
  );

  // Core Data Fetcher
  const loadDashboardData = useCallback(async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        router.replace('/auth');
        return;
      }

      // 1. Strict database role check - NO MOCK OR HARDCODED EMAIL BYPASS
      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (profileErr) throw profileErr;

      const isAdmin = profileData?.role === 'admin';
      if (!isAdmin) {
        setLoading(false);
        router.replace('/home');
        return;
      }

      setCurrentAdmin(profileData as AdminProfile);

      // 2. Parallel relational fetching with explicit Foreign Keys
      const [
        profilesRes,
        verifRes,
        reportsRes,
        servicesRes,
        borrowRes,
        urgentRes,
        questionsRes,
        requestsRes,
        auditRes,
        locationsRes,
        qCountRes,
        rCountRes,
        sCountRes,
        bCountRes,
        uCountRes,
      ] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(200),
        supabase
          .from('verification_requests')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(60),
        supabase
          .from('reports')
          .select('*, reporter:reporter_id(id, display_name, username, avatar_url, city, district)')
          .order('created_at', { ascending: false })
          .limit(60),
        supabase
          .from('services')
          .select('*, provider:provider_id(id, display_name, username, avatar_url, phone)')
          .order('created_at', { ascending: false })
          .limit(60),
        supabase
          .from('borrow_items')
          .select('*, owner:owner_id(id, display_name, username, avatar_url)')
          .order('created_at', { ascending: false })
          .limit(60),
        supabase
          .from('urgent_alerts')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(60),
        supabase
          .from('questions')
          .select('*, author:author_id(id, display_name, username, avatar_url)')
          .order('created_at', { ascending: false })
          .limit(60),
        supabase
          .from('requests')
          .select('*, requester:requester_id(id, display_name, username, avatar_url)')
          .order('created_at', { ascending: false })
          .limit(40),
        supabase
          .from('admin_activity_logs')
          .select('*, actor:actor_id(id, display_name, username)')
          .order('created_at', { ascending: false })
          .limit(80),
        supabase.from('saudi_custom_locations').select('*').order('created_at', { ascending: false }).limit(60),
        supabase.from('questions').select('id', { count: 'exact', head: true }),
        supabase.from('requests').select('id', { count: 'exact', head: true }),
        supabase.from('services').select('id', { count: 'exact', head: true }),
        supabase.from('borrow_items').select('id', { count: 'exact', head: true }),
        supabase.from('urgent_alerts').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      ]);

      const allUsers = (profilesRes.data || []) as AdminProfile[];
      const userMap = new Map<string, AdminProfile>();
      allUsers.forEach(u => userMap.set(u.id, u));

      const allVerifs = ((verifRes.data || []) as any[]).map(v => ({
        ...v,
        user: v.user || userMap.get(v.user_id) || { id: v.user_id, display_name: 'مواطن' },
      })) as AdminVerificationRequest[];

      const allReports = (reportsRes.data || []) as AdminReport[];

      const allServices = ((servicesRes.data || []) as any[]).map(s => ({
        ...s,
        title: s.title || s.name || 'خدمة محلية',
        price: s.price ?? s.price_from ?? null,
      })) as AdminService[];

      const allBorrow = (borrowRes.data || []) as AdminBorrowItem[];

      const allUrgent = ((urgentRes.data || []) as any[]).map(u => ({
        ...u,
        user: u.user || userMap.get(u.creator_id || u.user_id) || { id: u.creator_id || u.user_id, display_name: 'أحد الجيران' },
      })) as AdminUrgentAlert[];

      const allQuestions = (questionsRes.data || []) as AdminQuestion[];
      const allRequests = (requestsRes.data || []) as AdminRequest[];
      const allLogs = (auditRes.data || []) as AdminActivityLog[];
      const allLocations = locationsRes.data || [];

      setUsersList(allUsers);
      setVerifications(allVerifs);
      setReports(allReports);
      setServicesList(allServices);
      setBorrowItemsList(allBorrow);
      setUrgentAlertsList(allUrgent);
      setQuestionsList(allQuestions);
      setRequestsList(allRequests);
      setAuditLogs(allLogs);
      setCustomLocations(allLocations);

      // Calculate KPI metrics
      const adminsCount = allUsers.filter(u => u.role === 'admin').length;
      const verifiedCount = allUsers.filter(u => u.is_verified).length;
      const geoCount = allUsers.filter(u => u.is_geoverified).length;
      const bannedCount = allUsers.filter(u => u.is_banned).length;
      const pendingVerifsCount = allVerifs.filter(v => v.status === 'pending').length;
      const pendingReportsCount = allReports.filter(r => r.status === 'pending').length;

      setStats({
        users: allUsers.length,
        admins: adminsCount,
        verifiedUsers: verifiedCount,
        geoverifiedUsers: geoCount,
        bannedUsers: bannedCount,
        pendingVerifications: pendingVerifsCount,
        pendingReports: pendingReportsCount,
        services: sCountRes.count ?? allServices.length,
        borrowItems: bCountRes.count ?? allBorrow.length,
        urgentAlerts: uCountRes.count ?? allUrgent.length,
        questions: qCountRes.count ?? allQuestions.length,
        requests: rCountRes.count ?? allRequests.length,
      });

      // 3. 30-day trend series for the analytics dashboard
      const since = new Date(Date.now() - 29 * 86400000);
      since.setHours(0, 0, 0, 0);
      const sinceIso = since.toISOString();
      const [trendUsers, trendReports, trendQuestions] = await Promise.all([
        supabase.from('profiles').select('created_at').gte('created_at', sinceIso).limit(3000),
        supabase.from('reports').select('created_at').gte('created_at', sinceIso).limit(3000),
        supabase.from('questions').select('created_at').gte('created_at', sinceIso).limit(3000),
      ]);
      setAnalytics({
        users: bucketByDay(trendUsers.data as any, 30),
        reports: bucketByDay(trendReports.data as any, 30),
        questions: bucketByDay(trendQuestions.data as any, 30),
      });
      const failedSections = [profilesRes, verifRes, reportsRes, servicesRes, borrowRes, urgentRes, questionsRes, requestsRes, auditRes, locationsRes, qCountRes, rCountRes, sCountRes, bCountRes, uCountRes, trendUsers, trendReports, trendQuestions].filter(result => result.error).length;
      setLoadWarning(failedSections ? `تعذر تحميل ${failedSections} من مصادر البيانات. قد تظهر بعض الأقسام ناقصة؛ أعد المحاولة قبل الاعتماد على الملخص.` : '');
      if (!failedSections) setUpdatedAt(new Date());
    } catch (err: any) {
      console.error('Error loading admin dashboard:', err);
      setLoadWarning('تعذر تحديث البيانات. تحقق من الاتصال وأعد المحاولة.');
      showToast('تعذر تحميل بيانات لوحة التحكم: ' + (err?.message || 'خطأ في الاتصال'));
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Live moderation signals (Realtime) + auto refresh on new activity.
  const rt = useAdminRealtime(!loading && !!currentAdmin);
  useEffect(() => {
    if (rt.refreshTick > 0) {
      void loadDashboardData();
      rt.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rt.refreshTick]);

  // Load scheduled broadcasts once the admin session is ready.
  useEffect(() => {
    if (currentAdmin) void loadScheduledBroadcasts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAdmin]);

  // Handle Pull-to-Refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  // Inspect User Relations and Activity (360° dossier)
  const inspectUser = async (target: AdminProfile) => {
    setInspectedUser(target);
    setUserDevices(0);
    setUserExtras({ services: 0, reportsAgainst: 0, recent: [] });
    try {
      const [qRes, aRes, rRes, devRes, svcRes, myQ, repRes] = await Promise.all([
        supabase.from('questions').select('id', { count: 'exact', head: true }).eq('author_id', target.id),
        supabase.from('answers').select('id', { count: 'exact', head: true }).eq('author_id', target.id),
        supabase.from('requests').select('id', { count: 'exact', head: true }).eq('requester_id', target.id),
        supabase.from('push_tokens').select('id', { count: 'exact', head: true }).eq('user_id', target.id),
        supabase.from('services').select('id', { count: 'exact', head: true }).eq('provider_id', target.id),
        supabase
          .from('questions')
          .select('id,title,created_at')
          .eq('author_id', target.id)
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('reports')
          .select('id', { count: 'exact', head: true })
          .eq('target_id', target.id)
          .eq('target_type', 'user'),
      ]);
      setUserActivityStats({
        qCount: qRes.count || 0,
        aCount: aRes.count || 0,
        reqCount: rRes.count || 0,
      });
      setUserDevices(devRes.count || 0);
      setUserExtras({
        services: svcRes.count || 0,
        reportsAgainst: repRes.count || 0,
        recent: (myQ.data || []) as Array<{ id: string; title: string; created_at: string }>,
      });
    } catch (e) {
      console.warn('Could not inspect user stats:', e);
    }
  };

  // User Administration RPC
  const adminUpdateUser = async (
    targetUser: AdminProfile,
    patch: { role?: 'admin' | 'user'; is_verified?: boolean; is_geoverified?: boolean; is_banned?: boolean }
  ) => {
    const nextRole = patch.role ?? targetUser.role;
    const nextVerified = patch.is_verified ?? Boolean(targetUser.is_verified);
    const nextGeo = patch.is_geoverified ?? Boolean(targetUser.is_geoverified);
    const nextBanned = patch.is_banned ?? Boolean(targetUser.is_banned);

    const { data, error } = await supabase.rpc('admin_update_user', {
      p_target_user: targetUser.id,
      p_role: nextRole,
      p_is_verified: nextVerified,
      p_is_geoverified: nextGeo,
      p_is_banned: nextBanned,
    });

    if (error) throw error;

    // Update in local state
    setUsersList(prev => prev.map(u => (u.id === targetUser.id ? { ...u, ...data } : u)));
    if (inspectedUser?.id === targetUser.id) {
      setInspectedUser(prev => (prev ? { ...prev, ...data } : null));
    }
    return data;
  };

  // Bulk user administration (used by the global search tab)
  const handleBulkUserPatch = async (
    targets: AdminProfile[],
    patch: { is_verified?: boolean; is_banned?: boolean }
  ) => {
    let ok = 0;
    for (const t of targets) {
      try {
        await adminUpdateUser(t, patch);
        ok += 1;
      } catch (e) {
        console.warn('Bulk update failed for', t.id, e);
      }
    }
    await recordAuditLog('تحديث جماعي للمستخدمين', `${ok} مستخدم`, 'user');
    showToast(`تم تحديث ${ok} من ${targets.length} مستخدم ✅`);
  };

  // Action 1: Toggle Admin / User Role
  const toggleUserRole = (targetUser: AdminProfile) => {
    const isCurrentAdmin = targetUser.role === 'admin';
    const newRole = isCurrentAdmin ? 'user' : 'admin';
    const actionLabel = isCurrentAdmin ? 'خفض إلى مستخدم عادي 👤' : 'ترقية إلى مدير النظام 👑';

    confirmAction(
      'تغيير صلاحية المستخدم',
      `هل أنت متأكد من ${actionLabel} للمستخدم "${targetUser.display_name || targetUser.username}"؟`,
      async () => {
        try {
          await adminUpdateUser(targetUser, { role: newRole });
          await recordAuditLog(
            `تغيير الصلاحية إلى ${newRole === 'admin' ? 'مدير' : 'مستخدم'}`,
            targetUser.display_name || targetUser.username || targetUser.id,
            'user',
            targetUser.id
          );
          showToast(`تم ${isCurrentAdmin ? 'خفض الصلاحية لمستخدم' : 'منح رتبة مدير النظام'} بنجاح ✨`);
        } catch (e: any) {
          Alert.alert('خطأ في الترقية', e?.message || 'تعذر تغيير الصلاحية');
        }
      }
    );
  };

  // Action 2: Toggle Official Verification Badge
  const toggleVerification = async (targetUser: AdminProfile) => {
    const nextStatus = !targetUser.is_verified;
    try {
      await adminUpdateUser(targetUser, { is_verified: nextStatus });
      await recordAuditLog(
        nextStatus ? 'منح الشارة الزرقاء الرسمية' : 'إلغاء التوثيق الرسمي',
        targetUser.display_name || targetUser.username || targetUser.id,
        'user',
        targetUser.id
      );
      showToast(nextStatus ? 'تم توثيق الحساب بالشارة الرسمية ✓' : 'تم إلغاء توثيق الحساب');
    } catch (e: any) {
      Alert.alert('خطأ', e?.message || 'تعذر تحديث التوثيق');
    }
  };

  // Action 3: Toggle Geo Verification Badge (ابن الحي)
  const toggleGeoVerification = async (targetUser: AdminProfile) => {
    const nextStatus = !targetUser.is_geoverified;
    try {
      await adminUpdateUser(targetUser, { is_geoverified: nextStatus });
      await recordAuditLog(
        nextStatus ? 'منح شارة ابن الحي الموثق' : 'إزالة شارة ابن الحي',
        targetUser.display_name || targetUser.username || targetUser.id,
        'user',
        targetUser.id
      );
      showToast(nextStatus ? 'تم منح شارة ابن الحي الموثق 🛡️' : 'تمت إزالة شارة السكن');
    } catch (e: any) {
      Alert.alert('خطأ', e?.message || 'تعذر تحديث إثبات السكن');
    }
  };

  // Action 4: Ban / Unban User
  const toggleBanUser = (targetUser: AdminProfile) => {
    const nextBan = !targetUser.is_banned;
    const actionLabel = nextBan ? 'حظر الحساب نهائياً 🚫' : 'إلغاء حظر الحساب 🟢';

    confirmAction(
      actionLabel,
      `هل ترغب فعلاً في ${nextBan ? 'حظر' : 'إلغاء حظر'} "${targetUser.display_name || targetUser.username}"؟`,
      async () => {
        try {
          await adminUpdateUser(targetUser, { is_banned: nextBan });
          await recordAuditLog(
            nextBan ? 'حظر حساب المستخدم' : 'رفع الحظر عن الحساب',
            targetUser.display_name || targetUser.username || targetUser.id,
            'user',
            targetUser.id
          );
          showToast(nextBan ? 'تم حظر المستخدم بنجاح 🚫' : 'تم رفع الحظر بنجاح 🟢');
        } catch (e: any) {
          Alert.alert('خطأ', e?.message || 'تعذر تغيير حالة الحظر');
        }
      }
    );
  };

  // Action 5: Send Direct Admin Notice to Inspecting User
  const handleSendDirectNotice = async () => {
    if (!inspectedUser || !directNoticeText.trim()) return;
    setSendingDirectNotice(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error('انتهت جلسة تسجيل الدخول.');

      const text = directNoticeText.trim();

      // 1. In-app notification
      const { error: notifErr } = await supabase.from('notifications').insert({
        user_id: inspectedUser.id,
        type: 'admin_notice',
        title: 'إشعار من إدارة حيّنا 🇸🇦',
        body: text,
        data: { actor_id: u.user.id },
      });
      if (notifErr) throw notifErr;

      // 2. Real Push notification dispatch
      await sendAdminBroadcastPush([inspectedUser.id], {
        title: 'إشعار من إدارة حيّنا 🇸🇦',
        body: text,
        data: { type: 'admin_notice' },
      });

      await recordAuditLog(
        'إرسال تنبيه إداري خاص للمواطن',
        inspectedUser.display_name || inspectedUser.username || inspectedUser.id,
        'user',
        inspectedUser.id
      );

      showToast('تم إرسال التنبيه الإداري للمواطن بنجاح 📨');
      setDirectNoticeText('');
    } catch (e: any) {
      Alert.alert('خطأ', e?.message || 'تعذر إرسال التنبيه');
    } finally {
      setSendingDirectNotice(false);
    }
  };

  const openVerificationAttachment = async (request: AdminVerificationRequest) => {
    const attachment = request.attachment_url || request.document_url || null;
    if (!attachment) {
      Alert.alert('لا يوجد مستند', 'لم يرفق صاحب الطلب مستندًا مع هذا الطلب.');
      return;
    }

    try {
      if (/^https?:\/\//i.test(attachment)) {
        await Linking.openURL(attachment);
        return;
      }
      const signed = await supabase.storage.from('verification-documents').createSignedUrl(attachment, 600);
      if (signed.error) throw signed.error;
      if (!signed.data?.signedUrl) throw new Error('تعذر إنشاء رابط آمن للمستند.');
      await Linking.openURL(signed.data.signedUrl);
    } catch (error: any) {
      Alert.alert('تعذر فتح المستند', error?.message || 'حاول مرة أخرى.');
    }
  };

  // Action 6: Verification Request Decision (Approve / Reject)
  const handleVerificationDecision = async (
    reqId: string,
    userId: string,
    action: 'approved' | 'rejected',
    userName: string
  ) => {
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;

      const { data: verificationRequest, error: verificationLoadError } = await supabase
        .from('verification_requests')
        .select('subject,note,attachment_url,document_url,verification_type')
        .eq('id', reqId)
        .maybeSingle();
      if (verificationLoadError) throw verificationLoadError;
      if (!verificationRequest) throw new Error('طلب التوثيق غير موجود.');

      const { data: decision, error: decisionError } = await supabase.rpc('admin_review_verification', {
        p_request_id: reqId,
        p_status: action,
      });
      if (decisionError) throw decisionError;

      const decisionData = decision as any;
      const requestedLabel = verificationAccountLabel(
        decisionData?.requested_account_type || verificationRequest.subject,
      );

      if (action === 'approved') {
        setUsersList(prev => prev.map(usr => (
          usr.id === userId
            ? {
                ...usr,
                is_verified: Boolean(decisionData?.is_verified),
                verification_status: decisionData?.verification_status || 'verified',
                account_type: decisionData?.account_type || usr.account_type,
                is_verified_merchant: Boolean(decisionData?.is_verified_merchant),
              }
            : usr
        )));
      }

      const notifTitle = action === 'approved' ? 'تم اعتماد توثيق حسابك' : 'تحديث بشأن طلب التوثيق';
      const notifBody =
        action === 'approved'
          ? 'وافقت الإدارة على طلب ' + requestedLabel + ' وتم تحديث صفة الحساب وشارة التوثيق تلقائيًا.'
          : 'تمت مراجعة طلب ' + requestedLabel + ' ولم يعتمد حاليًا. راجع البيانات ثم يمكنك التقديم مجددًا.';

      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'verification',
        title: notifTitle,
        body: notifBody,
        data: { actor_id: u.user.id, request_id: reqId, status: action },
      });

      await sendAdminBroadcastPush([userId], {
        title: notifTitle,
        body: notifBody,
        data: { type: 'verification', status: action },
      });

      const privateAttachment = verificationRequest.attachment_url || null;
      if (privateAttachment && !/^https?:\/\//i.test(privateAttachment)) {
        const cleanup = await supabase.storage.from('verification-documents').remove([privateAttachment]);
        if (!cleanup.error) {
          await supabase.from('verification_requests').update({ attachment_url: null }).eq('id', reqId);
        } else {
          console.warn('Could not remove reviewed verification evidence:', cleanup.error.message);
        }
      }

      setVerifications(prev => prev.map(v => (
        v.id === reqId
          ? {
              ...v,
              status: action,
              reviewed_by: decisionData?.reviewed_by || u.user?.id || null,
              reviewed_at: decisionData?.reviewed_at || new Date().toISOString(),
              attachment_url:
                privateAttachment && !/^https?:\/\//i.test(privateAttachment)
                  ? null
                  : v.attachment_url,
            }
          : v
      )));

      showToast(action === 'approved' ? 'تم اعتماد الصفة والتوثيق الرسمي' : 'تم رفض طلب التوثيق');
    } catch (e: any) {
      Alert.alert('خطأ', e?.message || 'تعذر البت في طلب التوثيق');
    }
  };

  // Action 7: Moderate Reports (Resolve / Dismiss / Delete Offensive Content)
  const handleModerateReport = async (report: AdminReport, action: 'resolved' | 'dismissed', deleteContent: boolean) => {
    try {
      const { data, error } = await supabase.rpc('admin_moderate_report', {
        p_report_id: report.id,
        p_action: action,
        p_delete_content: deleteContent,
      });

      if (error) throw error;

      setReports(prev => prev.map(r => (r.id === report.id ? { ...r, ...data } : r)));

      if (deleteContent) {
        showToast('تم حذف المحتوى المخالف وإغلاق البلاغ 🗑️');
        // Refresh live resources
        loadDashboardData();
      } else {
        showToast(action === 'resolved' ? 'تم حل وإغلاق البلاغ بنجاح ✓' : 'تم تجاهل البلاغ ✕');
      }
    } catch (e: any) {
      Alert.alert('خطأ', e?.message || 'تعذر معالجة البلاغ');
    }
  };

  // Action 8: Platform Resources Control (Services, Borrow Items, Urgent Alerts)
  const updatePlatformEntity = async (
    entity: 'service' | 'borrow_item' | 'urgent_alert' | 'request' | 'question',
    targetId: string,
    action: string,
    entityName: string
  ) => {
    try {
      const { data, error } = await supabase.rpc('admin_update_platform_entity', {
        p_entity: entity,
        p_target_id: targetId,
        p_action: action,
      });

      if (error) throw error;

      if (entity === 'service') {
        setServicesList(prev => prev.map(s => (s.id === targetId ? { ...s, ...data } : s)));
      } else if (entity === 'borrow_item') {
        setBorrowItemsList(prev => prev.map(b => (b.id === targetId ? { ...b, ...data } : b)));
      } else if (entity === 'urgent_alert') {
        if (action === 'delete') {
          setUrgentAlertsList(prev => prev.filter(u => u.id !== targetId));
        } else {
          setUrgentAlertsList(prev => prev.map(u => (u.id === targetId ? { ...u, ...data } : u)));
        }
      }

      await recordAuditLog(`تعديل مورد المنصة (${action})`, entityName, entity, targetId);
      showToast('تم تحديث مورد المنصة بنجاح ✓');
    } catch (e: any) {
      Alert.alert('خطأ', e?.message || 'تعذر تحديث المورد');
    }
  };

  // Action 9: Delete Inappropriate Community Content
  const deleteContentItem = (id: string, type: 'question' | 'request', title: string) => {
    confirmAction(
      'حذف المنشور المخالف',
      `هل أنت متأكد من حذف منشور «${title}» نهائياً من منصة حيّنا؟`,
      async () => {
        try {
          const table = type === 'question' ? 'questions' : 'requests';
          const { error } = await supabase.from(table).delete().eq('id', id);
          if (error) throw error;

          if (type === 'question') setQuestionsList(prev => prev.filter(q => q.id !== id));
          else setRequestsList(prev => prev.filter(r => r.id !== id));

          await recordAuditLog('حذف منشور مخالف من المجتمع', title, type, id);
          showToast('تم حذف المنشور بنجاح 🗑️');
        } catch (e: any) {
          Alert.alert('خطأ', e?.message || 'تعذر حذف المنشور');
        }
      }
    );
  };

  // Deliver a broadcast to the target audience (segment-aware). Reused by the
  // immediate send and by scheduled dispatches.
  const deliverBroadcast = async (payload: {
    title: string;
    body: string;
    type: 'official' | 'emergency' | 'weather' | 'maintenance';
    target: string;
    segment: string;
  }) => {
    const { data, error } = await supabase.rpc('admin_send_broadcast', {
      p_title: payload.title, p_body: payload.body, p_type: payload.type,
      p_scope: payload.target, p_segment: payload.segment,
    });
    if (error || !data) throw error || new Error('تعذر إرسال التعميم.');
    return data;
  };

  const loadScheduledBroadcasts = async () => {
    try {
      const { data, error } = await supabase
        .from('scheduled_broadcasts')
        .select('*')
        .eq('status', 'pending')
        .order('scheduled_at', { ascending: true });
      if (!error) setScheduledList(data || []);
    } catch {
      /* table not migrated yet — ignore */
    }
  };

  const cancelScheduledBroadcast = async (id: string) => {
    try {
      const { data, error } = await supabase.from('scheduled_broadcasts')
        .update({ status: 'canceled' }).eq('id', id).eq('status', 'pending').select('id');
      if (error) throw error;
      if (!data?.length) throw new Error('سبق إرسال هذا التعميم أو إلغاؤه.');
      await loadScheduledBroadcasts();
      showToast('تم إلغاء التعميم المجدول');
    } catch (e: any) {
      Alert.alert('خطأ', e?.message || 'تعذر الإلغاء');
    }
  };

  const sendScheduledNow = async (item: any) => {
    setSendingBroadcast(true);
    try {
      const { data: res, error } = await supabase.rpc('admin_dispatch_scheduled_broadcast', { p_id: item.id });
      if (error || !res) throw error || new Error('تعذر إرسال التعميم المجدول.');
      setLastDelivery({ recipients: res.recipients, pushed: res.pushed, label: item.title });
      showToast(res.already_sent ? 'سبق إرسال هذا التعميم' : 'تم إرسال التعميم المجدول ✅');
      await loadScheduledBroadcasts();
    } catch (e: any) {
      Alert.alert('خطأ', e?.message || 'تعذر الإرسال');
    } finally {
      setSendingBroadcast(false);
    }
  };

  // Action 10: Broadcast Official Announcement
  const handleSendBroadcast = async () => {
    if (!broadcastTitle.trim() || !broadcastBody.trim()) {
      Alert.alert('تنبيه', 'يرجى كتابة عنوان وتفاصيل التعميم الإداري');
      return;
    }

    setSendingBroadcast(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error('انتهت جلسة تسجيل الدخول.');

      // Scheduled path: queue for later instead of sending now.
      if (scheduleEnabled) {
        const when = new Date(scheduleAt);
        if (isNaN(when.getTime())) throw new Error('صيغة وقت الجدولة غير صحيحة. مثال: 2026-10-20 09:30');
        const { error: schedErr } = await supabase.from('scheduled_broadcasts').insert({
          title: broadcastTitle.trim(),
          body: broadcastBody.trim(),
          broadcast_type: broadcastType,
          target: { scope: broadcastTarget, segment: broadcastSegment },
          scheduled_at: when.toISOString(),
          status: 'pending',
          created_by: u.user.id,
        });
        if (schedErr) throw schedErr;
        await recordAuditLog('جدولة تعميم للحي', broadcastTitle.trim(), 'broadcast');
        showToast('تمت جدولة التعميم بنجاح ⏰');
        setBroadcastTitle('');
        setBroadcastBody('');
        setScheduleEnabled(false);
        setScheduleAt('');
        await loadScheduledBroadcasts();
        return;
      }

      const res = await deliverBroadcast({
        title: broadcastTitle,
        body: broadcastBody,
        type: broadcastType,
        target: broadcastTarget,
        segment: broadcastSegment,
      });

      await recordAuditLog('بث تعميم رسمي لسكان الحي', broadcastTitle.trim(), 'broadcast');
      setLastDelivery({ recipients: res.recipients, pushed: res.pushed, label: broadcastTitle.trim() });
      if (res.pushed > 0) {
        showToast(`تم حفظ التعميم وإرسال إشعار فوري إلى ${res.pushed} جهاز 📢`);
      } else {
        Alert.alert(
          'تم حفظ التعميم',
          `تم حفظ التعميم داخل التطبيق وإظهاره في صفحة الإشعارات، لكن لم يصل إشعار فوري لأي جهاز مسجّل. ${res.pushError || 'تحقق من إعدادات مفاتيح الإشعارات في Vercel ومن تسجيل الأجهزة.'}`
        );
      }
      setBroadcastTitle('');
      setBroadcastBody('');
    } catch (e: any) {
      Alert.alert('خطأ في البث', e?.message || 'تعذر إرسال التعميم');
    } finally {
      setSendingBroadcast(false);
    }
  };

  // Broadcast Template Presets
  const applyBroadcastTemplate = (type: 'emergency' | 'weather' | 'maintenance' | 'welcome') => {
    if (type === 'emergency') {
      setBroadcastTitle('تنبيه أمني وإرشادي عاجل لسكان الحي');
      setBroadcastBody('يرجى أخذ الحيطة والتعاون مع الجهات المختصة في إخلاء الممرات وتسهيل حركة مركبات الطوارئ.');
      setBroadcastType('emergency');
    } else if (type === 'weather') {
      setBroadcastTitle('تنبيه بشأن الحالة المطرية وتقلبات الطقس');
      setBroadcastBody('وفقاً لتحذيرات الأرصاد، يرجى تجنب مجاري السيول وتوخي الحذر أثناء القيادة وتأمين الممتلكات.');
      setBroadcastType('weather');
    } else if (type === 'maintenance') {
      setBroadcastTitle('إشعار بأعمال صيانة وتطوير البنية التحتية');
      setBroadcastBody('تعلن إدارة الحي عن بدء أعمال صيانة شبكة المياه والإنارة في الشوارع الفرعية اعتباراً من الغد.');
      setBroadcastType('maintenance');
    } else {
      setBroadcastTitle('أهلاً بكم في حيّنا - مجتمع الجيران الرقمي');
      setBroadcastBody('نرحب بجميع السكان الجدد وندعوكم لتوثيق السكن والمشاركة في تبادل الخدمات وإعارة الأدوات.');
      setBroadcastType('official');
    }
  };

  // Action 11: Export Data as JSON Report
  const handleExportData = () => {
    const exportPayload = {
      exportedAt: new Date().toISOString(),
      platform: 'حيّنا (Hayna KSA)',
      stats,
      usersCount: usersList.length,
      users: usersList.map(u => ({
        id: u.id,
        name: u.display_name,
        username: u.username,
        role: u.role,
        is_verified: u.is_verified,
        is_geoverified: u.is_geoverified,
        city: u.city,
        district: u.district,
      })),
      servicesCount: servicesList.length,
      borrowItemsCount: borrowItemsList.length,
      urgentAlertsCount: urgentAlertsList.length,
      reportsCount: reports.length,
      verificationsCount: verifications.length,
    };

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportPayload, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `hayna_admin_report_${Date.now()}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast('تم تصدير وحفظ تقرير المنصة بنجاح 📥');
    } else {
      showToast('تم توليد التقرير بنجاح');
    }
  };

  // Action 12: Custom Saudi Location Manager
  const handleAddLocation = async () => {
    if (!locationName.trim() || !locationCity.trim()) {
      Alert.alert('تنبيه', 'يرجى كتابة اسم الحي والمدينة');
      return;
    }
    setSavingLocation(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('saudi_custom_locations')
        .insert({
          region_name: locationRegion.trim() || 'منطقة الرياض',
          city_name: locationCity.trim(),
          district_name: locationName.trim(),
          created_by: u.user?.id || null,
        })
        .select()
        .single();

      if (error) throw error;
      setCustomLocations(prev => [data, ...prev]);
      setLocationName('');
      setLocationCity('');
      setLocationRegion('');
      await recordAuditLog('إضافة موقع جغرافي جديد', locationName.trim(), 'location');
      showToast('تمت إضافة الحي إلى قاعدة المواقع بنجاح 📍');
    } catch (e: any) {
      Alert.alert('خطأ', e?.message || 'تعذر إضافة الموقع');
    } finally {
      setSavingLocation(false);
    }
  };

  const handleDeleteLocation = async (id: string, name: string) => {
    confirmAction('حذف الموقع', `هل ترغب في حذف «${name}» من قائمة المواقع المخصصة؟`, async () => {
      try {
        const { error } = await supabase.from('saudi_custom_locations').delete().eq('id', id);
        if (error) throw error;
        setCustomLocations(prev => prev.filter(l => l.id !== id));
        await recordAuditLog('حذف موقع جغرافي', name, 'location', id);
        showToast('تم حذف الموقع بنجاح 🗑️');
      } catch (e: any) {
        Alert.alert('خطأ', e?.message || 'تعذر حذف الموقع');
      }
    });
  };

  // Action 13: Branding Logo Central Manager
  const changeGlobalLogo = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showToast('اسمح بالوصول للصور لاختيار الشعار');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });
      if (result.canceled || !result.assets?.[0]?.uri) return;

      setBrandingUploading(true);
      const asset = result.assets[0];
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const path = 'global/logo.png';

      const { error: uploadError } = await supabase.storage.from('branding').upload(path, blob, {
        contentType: asset.mimeType || 'image/png',
        upsert: true,
        cacheControl: '0',
      });
      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage.from('branding').getPublicUrl(path);
      const logoUrl = publicData.publicUrl;
      const versionedUrl = withVersion(logoUrl, Date.now());

      try {
        const { data: me } = await supabase.auth.getUser();
        await supabase.from('app_branding').upsert({
          id: 'global',
          logo_url: logoUrl,
          updated_at: new Date().toISOString(),
          updated_by: me.user?.id || null,
        });
      } catch (err) {
        console.warn('DB upsert exception:', err);
      }

      await broadcastLogoUpdate(versionedUrl);
      setBrandingLogo(versionedUrl);
      await recordAuditLog('تحديث شعار المنصة الرسمي', 'الهوية البصرية', 'branding');
      showToast('تم تحديث الشعار وتعميمه على المنصة بالكامل ✨');
    } catch (e: any) {
      showToast('تعذر تغيير الشعار: ' + (e?.message || 'خطأ غير متوقع'));
    } finally {
      setBrandingUploading(false);
    }
  };

  // Filtered Users computation
  const filteredUsers = useMemo(() => {
    return usersList.filter(u => {
      if (userSearch.trim()) {
        const q = userSearch.toLowerCase();
        const match =
          (u.display_name || '').toLowerCase().includes(q) ||
          (u.username || '').toLowerCase().includes(q) ||
          (u.city || '').toLowerCase().includes(q) ||
          (u.district || '').toLowerCase().includes(q);
        if (!match) return false;
      }
      if (selectedCityFilter !== 'all') {
        if (!u.city || !u.city.includes(selectedCityFilter)) return false;
      }
      if (userRoleFilter === 'admin') return u.role === 'admin';
      if (userRoleFilter === 'user') return u.role === 'user';
      if (userRoleFilter === 'verified') return u.is_verified;
      if (userRoleFilter === 'geoverified') return u.is_geoverified;
      if (userRoleFilter === 'banned') return u.is_banned;
      return true;
    }).sort((a, b) => userSort === 'name'
      ? (a.display_name || a.username || '').localeCompare(b.display_name || b.username || '', 'ar')
      : (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * (userSort === 'oldest' ? 1 : -1));
  }, [usersList, userSearch, selectedCityFilter, userRoleFilter, userSort]);

  // Filtered Reports computation
  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      if (reportStatusFilter === 'all') return true;
      return r.status === reportStatusFilter;
    });
  }, [reports, reportStatusFilter]);

  // ============================================================
  // Derived navigation helpers (grouped command center)
  // NOTE: these hooks must run before any early return so the
  // Rules of Hooks stay valid on every render.
  // ============================================================
  const totalPending = stats.pendingReports + stats.pendingVerifications + stats.urgentAlerts;

  const tabBadge = useCallback(
    (key: AdminTabKey): number => {
      switch (key) {
        case 'tasks':
          return totalPending;
        case 'verifications':
          return stats.pendingVerifications;
        case 'reports':
          return stats.pendingReports;
        case 'platform':
          return stats.urgentAlerts;
        default:
          return 0;
      }
    },
    [totalPending, usersList.length, stats.pendingVerifications, stats.pendingReports, stats.urgentAlerts]
  );

  // Loading Screen
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={styles.loadingText}>جاري فتح مركز العمليات والرقابة الشاملة...</Text>
      </View>
    );
  }

  // Unauthorized Fallback
  if (!currentAdmin || currentAdmin.role !== 'admin') {
    return (
      <View style={styles.center}>
        <LinearGradient colors={['#FEE2E2', '#FECACA']} style={styles.unauthorizedIconWrap}>
          <Shield size={50} color={C.danger} />
        </LinearGradient>
        <Text style={styles.unauthorizedTitle}>صلاحية مدير النظام مطلوبة 👑</Text>
        <Text style={styles.unauthorizedSub}>
          لوحة التحكم مخصصة حصرياً للمدراء المعتمدين في قاعدة البيانات. صلاحيات المنصة محصورة في: مدير (Admin) ومستخدم عادي (User).
        </Text>
        <Pressable oasisKind="action" style={styles.backBtn} onPress={() => router.replace('/home')}>
          <Text style={styles.backBtnText}>العودة للرئيسية</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <AdminWorkspace
        groups={ADMIN_NAV}
        active={activeTab}
        onNavigate={setActiveTab}
        badge={tabBadge}
        name={currentAdmin.display_name || currentAdmin.username || 'مدير المنصة'}
        refreshing={refreshing}
        updatedAt={updatedAt}
        onRefresh={onRefresh}
        onExport={handleExportData}
        onExit={() => router.replace('/more')}
        updates={rt.total}
        warning={loadWarning}
        toast={toastMsg ? <Animated.View style={[styles.toastBanner, { opacity: toastAnim }]}><Text style={styles.toastBannerText}>{toastMsg}</Text></Animated.View> : null}
      >
        {(activeTab === 'overview' || activeTab === 'broadcast' || activeTab === 'content') && <Pressable oasisKind="card" accessibilityRole="button" onPress={() => router.push('/admin-announcements')} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12, padding: 16, marginBottom: 12, backgroundColor: OASIS.colors.soft, borderRadius: 14 }}>
          <Megaphone size={24} color={OASIS.colors.primary} />
          <View style={{ flex: 1, gap: 5 }}><Text style={{ fontSize: 16, fontWeight: '700', color: OASIS.colors.deep, textAlign: 'right' }}>إعلانات الصفحة الرئيسية</Text><Text style={{ fontSize: 12, lineHeight: 20, color: OASIS.colors.muted, textAlign: 'right' }}>إنشاء إعلان نصي أو صورة أو نص وصورة · إدارة الإعلانات النشطة</Text></View>
          <ChevronLeft size={18} color={OASIS.colors.primary} />
        </Pressable>}
        {(activeTab === 'overview' || activeTab === 'broadcast') && <Pressable oasisKind="card" accessibilityRole="button" onPress={() => router.push('/admin-broadcast')} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12, padding: 16, marginBottom: 16, backgroundColor: OASIS.colors.soft, borderRadius: 14 }}>
          <Megaphone size={24} color={OASIS.colors.primary} />
          <View style={{ flex: 1, gap: 5 }}><Text style={{ fontSize: 16, fontWeight: '700', color: OASIS.colors.deep, textAlign: 'right' }}>مركز تواصل منصة حيّنا</Text><Text style={{ fontSize: 12, lineHeight: 20, color: OASIS.colors.muted, textAlign: 'right' }}>الترحيب التلقائي · التحديثات الرسمية · معاينة الرسائل وسجل التسليم</Text></View>
          <ChevronLeft size={18} color={OASIS.colors.primary} />
        </Pressable>}
        {/* TAB 0: UNIFIED TASK CENTER */}
        {activeTab === 'tasks' && (
          <AdminTaskCenter
            reports={reports}
            verifications={verifications}
            urgentAlerts={urgentAlertsList}
            questions={questionsList}
            onNavigate={(tab) => setActiveTab(tab as any)}
            onResolveAll={() => void loadDashboardData()}
          />
        )}

        {/* TAB: GLOBAL SEARCH */}
        {activeTab === 'search' && (
          <AdminGlobalSearch
            onOpenUser={(u) => void inspectUser(u as AdminProfile)}
            onBulkUsers={(users, patch) => handleBulkUserPatch(users as AdminProfile[], patch)}
          />
        )}

        {/* TAB: PLATFORM CONFIG (feature flags / maintenance) */}
        {activeTab === 'config' && <AdminFeatureFlags onSaved={showToast} />}

        {/* TAB: RBAC (roles & permissions) */}
        {activeTab === 'roles' && <AdminRbacPanel onSaved={showToast} />}

        {/* TAB 1: OVERVIEW & ANALYTICS */}
        {activeTab === 'overview' && <AdminOverview
          stats={stats}
          users={usersList}
          reports={reports}
          verifications={verifications}
          urgentAlerts={urgentAlertsList}
          logs={auditLogs}
          analytics={analytics}
          onNavigate={setActiveTab}
          onOpenUser={(user) => void inspectUser(user)}
          onCity={(city) => { setSelectedCityFilter(city); setActiveTab('users'); }}
        />}

        {/* TAB 2: USERS MANAGEMENT & SECURITY */}
        {activeTab === 'users' && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>إدارة المستخدمين والصلاحيات 👥</Text>
              <Text style={styles.countBadgeText}>
                {filteredUsers.length} من {usersList.length}
              </Text>
            </View>
            <Text style={styles.sectionSubDesc}>
              إدارة حسابات السكان، ترقية المدراء، توثيق الهوية الوطنية والسكن، وحظر الحسابات المخالفة.
            </Text>
            {selectedCityFilter !== 'all' ? <Pressable oasisKind="chip" accessibilityRole="button" accessibilityLabel="إلغاء تصفية المدينة" onPress={() => setSelectedCityFilter('all')} style={[styles.filterPill, { alignSelf: 'flex-end', flexDirection: 'row-reverse', gap: 8, marginBottom: 12 }]}><MapPin size={14} color={C.accent} /><Text style={styles.filterPillText}>{selectedCityFilter}</Text><X size={14} color={C.muted} /></Pressable> : null}
            <View style={[styles.filterRow, { flexWrap: 'wrap' }]}>
              {([{ key: 'recent', label: 'الأحدث تسجيلًا' }, { key: 'oldest', label: 'الأقدم تسجيلًا' }, { key: 'name', label: 'حسب الاسم' }] as const).map(option => <FilterPill key={option.key} label={option.label} active={userSort === option.key} onPress={() => setUserSort(option.key)} />)}
            </View>

            {/* Search Input */}
            <View style={styles.searchBar}>
              <Search size={18} color="#94A3B8" />
              <TextInput
                style={styles.searchInput}
                placeholder="ابحث بالاسم، المعرف، المدينة أو الحي..."
                placeholderTextColor="#94A3B8"
                value={userSearch}
                onChangeText={setUserSearch}
              />
              {userSearch.length > 0 && (
                <Pressable onPress={() => setUserSearch('')}>
                  <Text style={{ color: '#94A3B8', fontSize: 13 }}>✕</Text>
                </Pressable>
              )}
            </View>

            {/* Filter Pills */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              <FilterPill label={`الكل (${usersList.length})`} active={userRoleFilter === 'all'} onPress={() => setUserRoleFilter('all')} />
              <FilterPill label={`مدراء (${stats.admins}) 👑`} active={userRoleFilter === 'admin'} onPress={() => setUserRoleFilter('admin')} />
              <FilterPill label="مستخدمون (User) 👤" active={userRoleFilter === 'user'} onPress={() => setUserRoleFilter('user')} />
              <FilterPill label={`موثقون (${stats.verifiedUsers}) ✓`} active={userRoleFilter === 'verified'} onPress={() => setUserRoleFilter('verified')} />
              <FilterPill label={`أبناء الحي (${stats.geoverifiedUsers}) 🛡️`} active={userRoleFilter === 'geoverified'} onPress={() => setUserRoleFilter('geoverified')} />
              <FilterPill label={`محظورون (${stats.bannedUsers}) 🚫`} active={userRoleFilter === 'banned'} onPress={() => setUserRoleFilter('banned')} />
            </ScrollView>

            {/* User Cards List */}
            {filteredUsers.length === 0 ? (
              <EmptyState icon={<Users size={38} color="#94A3B8" />} title="لا يوجد مستخدمون مطابقون" sub="جرب تغيير معايير البحث أو التصفية" />
            ) : (
              filteredUsers.map(u => {
                const isAdmin = u.role === 'admin';
                return (
                  <OasisSurface oasisSurface="card" key={u.id} style={[styles.userCard, isAdmin && styles.userCardAdmin, u.is_banned && styles.userCardBanned]}>
                    <Pressable oasisKind="card" style={styles.userCardHeader} onPress={() => inspectUser(u)}>
                      <View style={styles.userAvatarWrap}>
                        {u.avatar_url ? (
                          <Image source={{ uri: u.avatar_url }} style={styles.userAvatarImg} />
                        ) : (
                          <View style={[styles.userAvatarFallback, isAdmin && { backgroundColor: C.navyMid }]}>
                            <Text style={styles.userAvatarLetter}>{u.display_name?.[0] || 'م'}</Text>
                          </View>
                        )}
                        {isAdmin && (
                          <View style={styles.adminCrownBadge}>
                            <Crown size={10} color={OASIS.colors.surface} />
                          </View>
                        )}
                      </View>

                      <View style={styles.userMeta}>
                        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.userName}>{u.display_name || 'بدون اسم'}</Text>
                          {u.is_verified && <CheckCircle2 size={14} color={OASIS.colors.info} />}
                          {u.is_geoverified && <ShieldCheck size={14} color={OASIS.colors.primary} />}
                        </View>
                        <Text style={styles.userHandle}>@{u.username || 'user'}</Text>
                        <Text style={styles.userLocation}>
                          📍 {u.district ? `حي ${u.district} · ` : ''}
                          {u.city || 'الرياض'}
                        </Text>
                      </View>

                      <View style={[styles.roleBadge, isAdmin ? styles.roleBadgeAdmin : styles.roleBadgeUser]}>
                        <Text style={[styles.roleBadgeText, isAdmin ? styles.roleBadgeTextAdmin : styles.roleBadgeTextUser]}>
                          {isAdmin ? '👑 مدير النظام' : '👤 مستخدم'}
                        </Text>
                      </View>
                    </Pressable>

                    {/* Admin Actions Bar */}
                    <View style={styles.userActionsRow}>
                      <Pressable oasisKind="action"
                        style={[styles.userActionBtn, isAdmin ? styles.btnDemote : styles.btnPromote]}
                        onPress={() => toggleUserRole(u)}
                      >
                        {isAdmin ? <UserX size={14} color="#D97706" /> : <Crown size={14} color={OASIS.colors.info} />}
                        <Text style={[styles.userActionBtnText, isAdmin ? { color: '#D97706' } : { color: OASIS.colors.info }]}>
                          {isAdmin ? 'خفض لمستخدم' : 'ترقية لمدير 👑'}
                        </Text>
                      </Pressable>

                      <Pressable oasisKind="action"
                        style={[styles.userActionBtn, u.is_verified && styles.btnActiveSuccess]}
                        onPress={() => toggleVerification(u)}
                      >
                        <CheckCircle2 size={14} color={u.is_verified ? OASIS.colors.primary : OASIS.colors.muted} />
                        <Text style={[styles.userActionBtnText, u.is_verified && { color: OASIS.colors.primary }]}>
                          {u.is_verified ? 'شارة موثقة' : 'توثيق رسمي'}
                        </Text>
                      </Pressable>

                      <Pressable oasisKind="action"
                        style={[styles.userActionBtn, u.is_geoverified && styles.btnActiveSuccess]}
                        onPress={() => toggleGeoVerification(u)}
                      >
                        <ShieldCheck size={14} color={u.is_geoverified ? OASIS.colors.primary : OASIS.colors.muted} />
                        <Text style={[styles.userActionBtnText, u.is_geoverified && { color: OASIS.colors.primary }]}>
                          {u.is_geoverified ? 'ابن الحي ✓' : 'توثيق السكن'}
                        </Text>
                      </Pressable>

                      <Pressable oasisKind="action"
                        style={[styles.userActionBtn, u.is_banned ? styles.btnBannedActive : styles.btnBan]}
                        onPress={() => toggleBanUser(u)}
                      >
                        <Ban size={14} color={u.is_banned ? OASIS.colors.surface : OASIS.colors.danger} />
                        <Text style={[styles.userActionBtnText, u.is_banned ? { color: OASIS.colors.surface } : { color: OASIS.colors.danger }]}>
                          {u.is_banned ? 'فك الحظر' : 'حظر'}
                        </Text>
                      </Pressable>

                      <Pressable oasisKind="action" style={styles.userActionBtn} onPress={() => inspectUser(u)}>
                        <Eye size={14} color="#0891B2" />
                        <Text style={[styles.userActionBtnText, { color: '#0891B2' }]}>الملف الكامل</Text>
                      </Pressable>
                    </View>
                  </OasisSurface>
                );
              })
            )}
          </View>
        )}

        {/* TAB 3: RELATIONAL VERIFICATION DESK */}
        {activeTab === 'verifications' && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>مكتب التوثيق الرسمي والشارة الزرقاء 🌟</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{stats.pendingVerifications} طلب معلق</Text>
              </View>
            </View>
            <Text style={styles.sectionSubDesc}>
              مراجعة طلبات التوثيق وتدقيق السكن مع إرسال إشعارات فورية وتنبيهات push تلقائية للمواطنين.
            </Text>

            {verifications.length === 0 ? (
              <EmptyState icon={<Star size={42} color={OASIS.colors.warning} />} title="لا توجد طلبات توثيق معلقة" sub="تم فحص واعتماد كافة الطلبات المقدمة سابقاً بنجاح ✅" />
            ) : (
              verifications.map(v => {
                const u = v.user || {};
                const isPending = v.status === 'pending';
                return (
                  <View key={v.id} style={[styles.verifCardDossier, !isPending && { borderColor: OASIS.colors.line, opacity: 0.8 }]}>
                    <View style={styles.dossierTop}>
                      <View style={styles.dossierAvatarWrap}>
                        {u.avatar_url ? (
                          <Image source={{ uri: u.avatar_url }} style={styles.dossierAvatarImg} />
                        ) : (
                          <View style={styles.dossierAvatarFallback}>
                            <Text style={styles.dossierAvatarLetter}>{u.display_name?.[0] || 'م'}</Text>
                          </View>
                        )}
                        {u.is_verified && (
                          <View style={styles.verifiedCheckBadge}>
                            <Check size={9} color={OASIS.colors.surface} />
                          </View>
                        )}
                      </View>

                      <View style={styles.dossierUserMeta}>
                        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.dossierUserName}>{u.display_name || 'بدون اسم'}</Text>
                          {u.is_verified && <CheckCircle2 size={14} color={OASIS.colors.info} />}
                          {u.is_geoverified && <ShieldCheck size={14} color={OASIS.colors.primary} />}
                        </View>
                        <Text style={styles.dossierHandle}>@{u.username || 'citizen'}</Text>
                        <Text style={styles.dossierLocation}>
                          📍 {u.district ? `حي ${u.district}` : 'الحي غير محدد'} · {u.city || 'الرياض'}
                        </Text>
                      </View>

                      <View style={[styles.verifStatusPill, isPending ? styles.verifPending : v.status === 'approved' ? styles.verifApproved : styles.verifRejected]}>
                        <Text style={[isPending ? styles.verifPendingText : v.status === 'approved' ? styles.verifApprovedText : styles.verifRejectedText]}>
                          {isPending ? '⏳ قيد المراجعة' : v.status === 'approved' ? '✓ تم الاعتماد' : '✕ مرفوض'}
                        </Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 4 }}>
                      <View style={{ flex: 1, alignItems: 'flex-end', gap: 3 }}>
                        <Text style={{ color: OASIS.colors.muted, fontSize: 11, fontWeight: '600' }}>نوع الطلب</Text>
                        <Text style={{ color: OASIS.colors.ink, fontSize: 12.5, fontWeight: '700', textAlign: 'right' }}>
                          {verificationAccountLabel(v.subject)}
                        </Text>
                      </View>
                      {(v.attachment_url || v.document_url) ? (
                        <Pressable
                          onPress={() => void openVerificationAttachment(v)}
                          style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6, backgroundColor: OASIS.colors.soft, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 8, borderWidth: 1, borderColor: OASIS.colors.soft }}
                        >
                          <Eye size={15} color={OASIS.colors.primary} />
                          <Text style={{ color: OASIS.colors.primary, fontSize: 11, fontWeight: '700' }}>عرض المستند الخاص</Text>
                        </Pressable>
                      ) : null}
                    </View>

                    {v.note ? (
                      <View style={styles.dossierNoteBox}>
                        <Text style={styles.dossierNoteTitle}>بيانات المتقدم:</Text>
                        <Text style={styles.dossierNoteText}>{v.note}</Text>
                      </View>
                    ) : null}

                    <View style={styles.dossierFootprintRow}>
                      <View style={styles.footprintItem}>
                        <Text style={styles.footprintLabel}>تاريخ التقديم</Text>
                        <Text style={styles.footprintVal}>{new Date(v.created_at).toLocaleDateString('ar-SA')}</Text>
                      </View>
                      <View style={styles.footprintItem}>
                        <Text style={styles.footprintLabel}>إثبات السكن</Text>
                        <Text style={[styles.footprintVal, { color: u.is_geoverified ? OASIS.colors.primary : '#D97706' }]}>
                          {u.is_geoverified ? 'ابن الحي موثق 🛡️' : 'غير مثبت'}
                        </Text>
                      </View>
                      <View style={styles.footprintItem}>
                        <Text style={styles.footprintLabel}>الرتبة</Text>
                        <Text style={styles.footprintVal}>{u.role === 'admin' ? 'مدير 👑' : 'مستخدم 👤'}</Text>
                      </View>
                    </View>

                    {isPending ? (
                      <View style={styles.dossierActionsRow}>
                        <Pressable
                          style={styles.btnApproveVerif}
                          onPress={() => handleVerificationDecision(v.id, v.user_id, 'approved', u.display_name || u.username || 'مواطن')}
                        >
                          <Check size={16} color={OASIS.colors.surface} />
                          <Text style={styles.btnApproveVerifText}>اعتماد الصفة والتوثيق</Text>
                        </Pressable>

                        <Pressable
                          style={styles.btnRejectVerif}
                          onPress={() => handleVerificationDecision(v.id, v.user_id, 'rejected', u.display_name || u.username || 'مواطن')}
                        >
                          <X size={15} color={OASIS.colors.danger} />
                          <Text style={styles.btnRejectVerifText}>رفض الطلب ✕</Text>
                        </Pressable>

                        <Pressable style={styles.btnInspectCitizen} onPress={() => inspectUser(u as AdminProfile)}>
                          <Eye size={15} color="#0891B2" />
                        </Pressable>
                      </View>
                    ) : (
                      <View style={styles.dossierCompletedFooter}>
                        <Text style={styles.dossierCompletedText}>
                          تمت المراجعة والبت بتاريخ {new Date(v.reviewed_at || v.created_at).toLocaleDateString('ar-SA')}
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* TAB 4: REPORTS MODERATION */}
        {activeTab === 'reports' && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>مركز البلاغات والمراقبة 🚨</Text>
              <View style={[styles.countBadge, { backgroundColor: '#FEE2E2' }]}>
                <Text style={[styles.countBadgeText, { color: OASIS.colors.danger }]}>{stats.pendingReports} بلاغ معلق</Text>
              </View>
            </View>
            <Text style={styles.sectionSubDesc}>
              مراقبة البلاغات المقدمة من الجيران والتعامل مع المحتوى المخالف فوراً عبر الحذف الذري أو الإغلاق.
            </Text>

            {/* Status Filter Pills */}
            <View style={styles.filterRow}>
              <FilterPill label="معلقة (بحاجة لإجراء)" active={reportStatusFilter === 'pending'} onPress={() => setReportStatusFilter('pending')} />
              <FilterPill label="تم الحل ✓" active={reportStatusFilter === 'resolved'} onPress={() => setReportStatusFilter('resolved')} />
              <FilterPill label="تم التجاهل ✕" active={reportStatusFilter === 'dismissed'} onPress={() => setReportStatusFilter('dismissed')} />
              <FilterPill label="الكل" active={reportStatusFilter === 'all'} onPress={() => setReportStatusFilter('all')} />
            </View>

            {filteredReports.length === 0 ? (
              <EmptyState icon={<Flag size={40} color={OASIS.colors.primary} />} title="لا توجد بلاغات في هذا التبويب" sub="مجتمع الجيران آمن ومستقر بإذن الله 🎉" />
            ) : (
              filteredReports.map(r => (
                <OasisSurface oasisSurface="card" key={r.id} style={[styles.reportCard, r.status !== 'pending' && { borderColor: OASIS.colors.line, opacity: 0.75 }]}>
                  <View style={styles.reportHeader}>
                    <View style={[styles.reportStatusTag, r.status === 'pending' ? styles.repPendingTag : styles.repDoneTag]}>
                      <Text style={[styles.reportStatusText, r.status === 'pending' ? styles.repPendingText : styles.repDoneText]}>
                        {r.status === 'pending' ? '⏳ بحاجة لاتخاذ إجراء' : r.status === 'resolved' ? '✓ تم الحل' : '✕ تم التجاهل'}
                      </Text>
                    </View>

                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                      <Flag size={16} color={C.danger} />
                      <Text style={styles.reportType}>نوع المحتوى: {r.target_type}</Text>
                    </View>
                  </View>

                  <Text style={styles.reportReason}>سبب البلاغ: "{r.reason || 'محتوى مخالف لقواعد الحي'}"</Text>

                  <View style={styles.reportMetaRow}>
                    <Text style={styles.reportDate}>التاريخ: {new Date(r.created_at).toLocaleDateString('ar-SA')}</Text>
                    <Text style={styles.reportFrom}>
                      مقدم البلاغ: {r.reporter?.display_name || r.reporter?.username || 'مستخدم مجهول'}
                    </Text>
                  </View>

                  {r.status === 'pending' && (
                    <View style={styles.reportActionsGrid}>
                      <Pressable style={styles.btnDeleteContent} onPress={() => handleModerateReport(r, 'resolved', true)}>
                        <Trash size={15} color={OASIS.colors.surface} />
                        <Text style={styles.btnActionTextWhite}>حذف المحتوى المخالف فوراً وإغلاق البلاغ 🗑️</Text>
                      </Pressable>

                      <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 8 }}>
                        <Pressable oasisKind="action" style={styles.resolveBtn} onPress={() => handleModerateReport(r, 'resolved', false)}>
                          <CheckCircle2 size={16} color={OASIS.colors.surface} />
                          <Text style={styles.resolveBtnText}>إغلاق البلاغ كمعالج ✓</Text>
                        </Pressable>

                        <Pressable oasisKind="action" style={styles.dismissBtn} onPress={() => handleModerateReport(r, 'dismissed', false)}>
                          <XCircle size={16} color={OASIS.colors.muted} />
                          <Text style={styles.dismissBtnText}>تجاهل كيدي ✕</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}
                </OasisSurface>
              ))
            )}
          </View>
        )}

        {/* TAB 5: REAL PLATFORM RESOURCES (Services, Borrow Items, Urgent Alerts) */}
        {activeTab === 'platform' && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>موارد المنصة والخدمات الحقيقية 🏢</Text>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{servicesList.length + borrowItemsList.length + urgentAlertsList.length} مورد</Text>
              </View>
            </View>
            <Text style={styles.sectionSubDesc}>
              إدارة خدمات الحي المحلية، خزانة إعارة الأدوات، وتنبيهات الطوارئ النشطة من مصدر موحد.
            </Text>

            {/* Platform Sub-tabs */}
            <View style={styles.filterRow}>
              <FilterPill label={`دليل الخدمات (${servicesList.length})`} active={platformTabSub === 'services'} onPress={() => setPlatformTabSub('services')} />
              <FilterPill label={`خزانة الأدوات (${borrowItemsList.length})`} active={platformTabSub === 'borrow'} onPress={() => setPlatformTabSub('borrow')} />
              <FilterPill label={`تنبيهات الطوارئ (${urgentAlertsList.length})`} active={platformTabSub === 'urgent'} onPress={() => setPlatformTabSub('urgent')} />
            </View>

            {/* Sub-tab 1: Services */}
            {platformTabSub === 'services' && (
              <View>
                <Text style={styles.subSectionTitle}>دليل خدمات وحرفيي الحي</Text>
                {servicesList.length === 0 ? (
                  <EmptyState icon={<Truck size={36} color="#94A3B8" />} title="لا توجد خدمات مسجلة" sub="ستظهر الخدمات التي يقدمها الجيران هنا." />
                ) : (
                  servicesList.map(s => (
                    <OasisSurface oasisSurface="card" key={s.id} style={styles.platformItemCard}>
                      <View style={styles.platformItemTop}>
                        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8, flex: 1 }}>
                          <Truck size={18} color={s.is_verified ? C.accent : C.muted} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.platformItemTitle}>{s.title}</Text>
                            <Text style={styles.platformItemSub}>
                              {[s.city, s.district].filter(Boolean).join(' · ') || 'الموقع غير محدد'} · المقدم: {s.provider?.display_name || s.provider?.username || 'جار'}
                            </Text>
                          </View>
                        </View>
                        {s.price != null && (
                          <Text style={{ fontWeight: '600', color: C.accent, fontSize: 12 }}>{s.price} ر.س</Text>
                        )}
                      </View>

                      <View style={styles.platformItemActions}>
                        <Pressable oasisKind="action"
                          style={[styles.smallActionBtn, s.is_verified && { backgroundColor: '#DCFCE7' }]}
                          onPress={() => updatePlatformEntity('service', s.id, 'toggle_verified', s.title)}
                        >
                          <CheckCircle2 size={15} color={s.is_verified ? OASIS.colors.primary : OASIS.colors.muted} />
                          <Text style={[styles.smallActionText, s.is_verified && { color: OASIS.colors.primary }]}>
                            {s.is_verified ? 'خدمة معتمدة ✓' : 'اعتماد وتوثيق'}
                          </Text>
                        </Pressable>

                        <Pressable oasisKind="action"
                          style={styles.smallActionBtn}
                          onPress={() => updatePlatformEntity('service', s.id, 'toggle_available', s.title)}
                        >
                          <Activity size={15} color={s.available_now ? OASIS.colors.info : OASIS.colors.muted} />
                          <Text style={styles.smallActionText}>{s.available_now ? 'متاح الآن' : 'غير متفرغ'}</Text>
                        </Pressable>
                      </View>
                    </OasisSurface>
                  ))
                )}
              </View>
            )}

            {/* Sub-tab 2: Borrow Items */}
            {platformTabSub === 'borrow' && (
              <View>
                <Text style={styles.subSectionTitle}>خزانة إعارة أدوات الجيران</Text>
                {borrowItemsList.length === 0 ? (
                  <EmptyState icon={<Wrench size={36} color="#94A3B8" />} title="لا توجد أدوات معروضة للإعارة" sub="ستظهر الأدوات المتاحة للإعارة هنا." />
                ) : (
                  borrowItemsList.map(item => (
                    <OasisSurface oasisSurface="card" key={item.id} style={styles.platformItemCard}>
                      <View style={styles.platformItemTop}>
                        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8, flex: 1 }}>
                          <Wrench size={18} color={item.status === 'available' ? C.accent : C.muted} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.platformItemTitle}>{item.title}</Text>
                            <Text style={styles.platformItemSub}>
                              المالك: {item.owner?.display_name || item.owner?.username || 'جار'} · الحالة: {item.status === 'available' ? 'جاهزة للإعارة 🟢' : item.status === 'borrowed' ? 'مستعارة حالياً ⏳' : 'غير متاحة 🔴'}
                            </Text>
                          </View>
                        </View>
                      </View>

                      <View style={styles.platformItemActions}>
                        <Pressable oasisKind="action"
                          style={styles.smallActionBtn}
                          onPress={() => updatePlatformEntity('borrow_item', item.id, 'toggle_status', item.title)}
                        >
                          <Archive size={15} color={OASIS.colors.muted} />
                          <Text style={styles.smallActionText}>
                            {item.status === 'available' ? 'تعطيل الإتاحة' : 'تفعيل الإتاحة'}
                          </Text>
                        </Pressable>
                      </View>
                    </OasisSurface>
                  ))
                )}
              </View>
            )}

            {/* Sub-tab 3: Urgent Alerts */}
            {platformTabSub === 'urgent' && (
              <View>
                <Text style={styles.subSectionTitle}>تنبيهات الطوارئ والفزعات العاجلة</Text>
                {urgentAlertsList.length === 0 ? (
                  <EmptyState icon={<AlertTriangle size={36} color={OASIS.colors.primary} />} title="لا توجد تنبيهات طوارئ نشطة" sub="الحي يعيش في أمان وسلام تام 🛡️" />
                ) : (
                  urgentAlertsList.map(alert => (
                    <OasisSurface oasisSurface="card" key={alert.id} style={[styles.platformItemCard, { borderColor: alert.status === 'active' ? '#FECACA' : OASIS.colors.line }]}>
                      <View style={styles.platformItemTop}>
                        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8, flex: 1 }}>
                          <AlertTriangle size={18} color={alert.status === 'active' ? OASIS.colors.danger : OASIS.colors.primary} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.platformItemTitle}>{alert.title}</Text>
                            <Text style={styles.platformItemSub}>
                              {[alert.city, alert.district].filter(Boolean).join(' · ') || 'حي غير محدد'} · صاحب التنبيه: {alert.user?.display_name || 'مواطن'}
                            </Text>
                          </View>
                        </View>
                      </View>

                      <View style={styles.platformItemActions}>
                        {alert.status === 'active' && (
                          <Pressable oasisKind="action"
                            style={[styles.smallActionBtn, { backgroundColor: '#DCFCE7' }]}
                            onPress={() => updatePlatformEntity('urgent_alert', alert.id, 'resolve', alert.title)}
                          >
                            <CheckCircle2 size={15} color={OASIS.colors.primary} />
                            <Text style={[styles.smallActionText, { color: OASIS.colors.primary }]}>تمت الاستجابة وحل الطارئ ✓</Text>
                          </Pressable>
                        )}

                        <Pressable oasisKind="action"
                          style={[styles.smallActionBtn, { backgroundColor: '#FEE2E2' }]}
                          onPress={() => updatePlatformEntity('urgent_alert', alert.id, 'delete', alert.title)}
                        >
                          <Trash size={15} color={OASIS.colors.danger} />
                          <Text style={[styles.smallActionText, { color: OASIS.colors.danger }]}>حذف التنبيه</Text>
                        </Pressable>
                      </View>
                    </OasisSurface>
                  ))
                )}
              </View>
            )}
          </View>
        )}

        {/* TAB 6: COMMUNITY CONTENT MODERATION */}
        {activeTab === 'content' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>مراقبة الاستفسارات والطلبات المجتمعية 💬</Text>
            <Text style={styles.sectionSubDesc}>متابعة منشورات الجيران والاستفسارات وحذف أي محتوى يخالف معايير الحي.</Text>

            <View style={styles.filterRow}>
              <FilterPill label="جميع المنشورات" active={contentFilter === 'all'} onPress={() => setContentFilter('all')} />
              <FilterPill label={`الاستفسارات (${questionsList.length})`} active={contentFilter === 'questions'} onPress={() => setContentFilter('questions')} />
              <FilterPill label={`طلبات الفزعة (${requestsList.length})`} active={contentFilter === 'requests'} onPress={() => setContentFilter('requests')} />
            </View>

            {/* Questions List */}
            {(contentFilter === 'all' || contentFilter === 'questions') && (
              <View style={{ marginBottom: 16 }}>
                <Text style={styles.subSectionTitle}>💬 استفسارات الجيران</Text>
                {questionsList.map(q => (
                  <OasisSurface oasisSurface="card" key={`q-${q.id}`} style={styles.contentItemCard}>
                    <View style={styles.contentItemHeader}>
                      <Text style={styles.contentAuthorName}>{q.author?.display_name || 'ابن الحي'}</Text>
                      <Text style={styles.contentItemCity}>
                        📍 {q.district ? `حي ${q.district} · ` : ''}
                        {q.city || 'الرياض'}
                      </Text>
                    </View>

                    <Text style={styles.contentItemTitle}>{q.title}</Text>
                    {q.body && (
                      <Text style={styles.contentItemBody} numberOfLines={2}>
                        {q.body}
                      </Text>
                    )}

                    <View style={styles.contentItemFooter}>
                      <Pressable style={styles.btnDeleteSm} onPress={() => deleteContentItem(q.id, 'question', q.title)}>
                        <Trash size={14} color={OASIS.colors.danger} />
                        <Text style={styles.btnDeleteSmText}>حذف المنشور 🗑️</Text>
                      </Pressable>

                      <Pressable
                        style={styles.btnViewSm}
                        onPress={() => router.push({ pathname: '/question', params: { id: q.id } })}
                      >
                        <Eye size={14} color="#0891B2" />
                        <Text style={styles.btnViewSmText}>معاينة الاستفسار</Text>
                      </Pressable>
                    </View>
                  </OasisSurface>
                ))}
              </View>
            )}

            {/* Requests List */}
            {(contentFilter === 'all' || contentFilter === 'requests') && (
              <View>
                <Text style={styles.subSectionTitle}>🚚 طلبات الفزعة والمساعدة</Text>
                {requestsList.map(r => (
                  <OasisSurface oasisSurface="card" key={`r-${r.id}`} style={styles.contentItemCard}>
                    <View style={styles.contentItemHeader}>
                      <Text style={styles.contentAuthorName}>{r.requester?.display_name || 'طالب المساعدة'}</Text>
                      <Text style={styles.contentItemCity}>
                        📍 {r.district ? `حي ${r.district} · ` : ''}
                        {r.city || 'الرياض'}
                      </Text>
                    </View>

                    <Text style={styles.contentItemTitle}>{r.title}</Text>
                    {r.description && (
                      <Text style={styles.contentItemBody} numberOfLines={2}>
                        {r.description}
                      </Text>
                    )}

                    <View style={styles.contentItemFooter}>
                      <Pressable style={styles.btnDeleteSm} onPress={() => deleteContentItem(r.id, 'request', r.title)}>
                        <Trash size={14} color={OASIS.colors.danger} />
                        <Text style={styles.btnDeleteSmText}>حذف الطلب 🗑️</Text>
                      </Pressable>

                      <Pressable
                        style={styles.btnViewSm}
                        onPress={() => router.push({ pathname: '/request', params: { id: r.id } })}
                      >
                        <Eye size={14} color="#0891B2" />
                        <Text style={styles.btnViewSmText}>معاينة الطلب</Text>
                      </Pressable>
                    </View>
                  </OasisSurface>
                ))}
              </View>
            )}
          </View>
        )}

        {/* TAB 7: BROADCAST HUB */}
        {activeTab === 'broadcast' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>مركز البث والتعاميم الإدارية 📢</Text>
            <Text style={styles.sectionSubDesc}>
              إرسال تعميم رسمي يصل كتنبيهات داخل التطبيق وإشعارات push حقيقية لجميع السكان في الحي أو المملكة.
            </Text>

            {/* Quick Presets */}
            <Text style={styles.inputLabel}>نماذج سريعة جاهزة للتعميم:</Text>
            <View style={styles.templatePillsRow}>
              <Pressable oasisKind="chip" style={styles.templatePill} onPress={() => applyBroadcastTemplate('emergency')}>
                <Text style={styles.templatePillText}>🚨 طارئ أمني</Text>
              </Pressable>
              <Pressable oasisKind="chip" style={styles.templatePill} onPress={() => applyBroadcastTemplate('weather')}>
                <Text style={styles.templatePillText}>⛈️ تنبيه طقس</Text>
              </Pressable>
              <Pressable oasisKind="chip" style={styles.templatePill} onPress={() => applyBroadcastTemplate('maintenance')}>
                <Text style={styles.templatePillText}>🔧 صيانة خدمات</Text>
              </Pressable>
              <Pressable oasisKind="chip" style={styles.templatePill} onPress={() => applyBroadcastTemplate('welcome')}>
                <Text style={styles.templatePillText}>✨ ترحيب بالسكان</Text>
              </Pressable>
            </View>

            <View style={styles.broadcastBox}>
              <Text style={styles.inputLabel}>عنوان التعميم الإداري</Text>
              <TextInput
                style={styles.formInput}
                placeholder="مثال: تنبيه هام بشأن أعمال صيانة شبكة الحي..."
                placeholderTextColor="#94A3B8"
                value={broadcastTitle}
                onChangeText={setBroadcastTitle}
              />

              <Text style={[styles.inputLabel, { marginTop: 12 }]}>نص التعميم والتوجيهات</Text>
              <TextInput
                style={[styles.formInput, { height: 95, textAlignVertical: 'top' }]}
                placeholder="اكتب التوجيهات أو التعليمات الرسمية لأهل الحي..."
                placeholderTextColor="#94A3B8"
                value={broadcastBody}
                onChangeText={setBroadcastBody}
                multiline
              />

              <Text style={[styles.inputLabel, { marginTop: 12 }]}>نطاق الإرسال المستهدف</Text>
              <View style={styles.filterRow}>
                <FilterPill label="🇸🇦 كل المملكة" active={broadcastTarget === 'all'} onPress={() => setBroadcastTarget('all')} />
                <FilterPill label="الرياض" active={broadcastTarget === 'الرياض'} onPress={() => setBroadcastTarget('الرياض')} />
                <FilterPill label="جدة" active={broadcastTarget === 'جدة'} onPress={() => setBroadcastTarget('جدة')} />
                <FilterPill label="الدمام" active={broadcastTarget === 'الدمام'} onPress={() => setBroadcastTarget('الدمام')} />
              </View>

              <Text style={[styles.inputLabel, { marginTop: 12 }]}>شريحة الجمهور:</Text>
              <View style={styles.filterRow}>
                <FilterPill label="الجميع" active={broadcastSegment === 'all'} onPress={() => setBroadcastSegment('all')} />
                <FilterPill label="الموثّقون" active={broadcastSegment === 'verified'} onPress={() => setBroadcastSegment('verified')} />
                <FilterPill label="غير الموثّقين" active={broadcastSegment === 'unverified'} onPress={() => setBroadcastSegment('unverified')} />
                <FilterPill label="المديرون" active={broadcastSegment === 'admins'} onPress={() => setBroadcastSegment('admins')} />
              </View>

              <Pressable
                style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginTop: 12, paddingVertical: 8 }}
                onPress={() => setScheduleEnabled((v) => !v)}
              >
                <Text style={{ fontSize: 13, color: C.ink, fontWeight: '600' }}>
                  {scheduleEnabled ? '☑️' : '⬜️'} جدولة الإرسال لوقت لاحق
                </Text>
              </Pressable>
              {scheduleEnabled ? (
                <TextInput
                  style={styles.formInput}
                  placeholder="مثال: 2026-10-20 09:30"
                  placeholderTextColor="#94A3B8"
                  value={scheduleAt}
                  onChangeText={setScheduleAt}
                />
              ) : null}

              {/* Live Preview Notification Card */}
              {broadcastTitle.length > 0 && (
                <View style={styles.previewBox}>
                  <Text style={styles.previewHeading}>معاينة الإشعار كما سيصل للجيران 🔔</Text>
                  <OasisSurface oasisSurface="card" style={styles.previewNotificationCard}>
                    <View style={styles.previewCardHeader}>
                      <Text style={styles.previewAppName}>منصة حيّنا · الآن</Text>
                      <Crown size={12} color={OASIS.colors.warning} />
                    </View>
                    <Text style={styles.previewTitleText}>
                      {broadcastType === 'emergency' ? '🚨 ' : broadcastType === 'weather' ? '⛈️ ' : '📢 '}
                      {broadcastTitle}
                    </Text>
                    <Text style={styles.previewBodyText}>{broadcastBody || 'تفاصيل التعميم الإداري...'}</Text>
                  </OasisSurface>
                </View>
              )}

              <Pressable
                style={[styles.btnSendBroadcast, sendingBroadcast && { opacity: 0.6 }]}
                onPress={handleSendBroadcast}
                disabled={sendingBroadcast}
              >
                {sendingBroadcast ? (
                  <ActivityIndicator size="small" color={OASIS.colors.surface} />
                ) : (
                  <>
                    <Send size={18} color={OASIS.colors.surface} />
                    <Text style={styles.btnSendBroadcastText}>نشر وبث التعميم الآن 📢</Text>
                  </>
                )}
              </Pressable>

              {/* Delivery report */}
              {lastDelivery ? (
                <View style={{ marginTop: 12, backgroundColor: C.accentLight, borderRadius: 12, padding: 12, gap: 4 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: C.accentDark, textAlign: 'right' }}>تقرير آخر بث ✅</Text>
                  <Text style={{ fontSize: 11, color: C.inkMuted, textAlign: 'right', lineHeight: 18 }}>
                    «{lastDelivery.label}» — {lastDelivery.recipients} مستلم · {lastDelivery.pushed} إشعار فوري مُرسَل
                  </Text>
                </View>
              ) : null}

              {/* Scheduled broadcasts */}
              {scheduledList.length > 0 ? (
                <View style={{ marginTop: 16, gap: 8 }}>
                  <Text style={styles.inputLabel}>التعاميم المجدولة ({scheduledList.length})</Text>
                  {scheduledList.map((s) => (
                    <View
                      key={s.id}
                      style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 12, gap: 6 }}
                    >
                      <Text style={{ fontSize: 12.5, fontWeight: '700', color: C.ink, textAlign: 'right' }}>{s.title}</Text>
                      <Text style={{ fontSize: 11, color: C.muted, textAlign: 'right' }}>
                        {new Date(s.scheduled_at).toLocaleString('ar-SA')}
                      </Text>
                      <View style={{ flexDirection: 'row-reverse', gap: 8 }}>
                        <Pressable
                          style={{ backgroundColor: C.accent, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 6 }}
                          onPress={() => sendScheduledNow(s)}
                          disabled={sendingBroadcast}
                        >
                          <Text style={{ color: OASIS.colors.surface, fontSize: 11, fontWeight: '700' }}>إرسال الآن</Text>
                        </Pressable>
                        <Pressable
                          style={{ backgroundColor: C.dangerLight, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 6 }}
                          onPress={() => cancelScheduledBroadcast(s.id)}
                        >
                          <Text style={{ color: C.danger, fontSize: 11, fontWeight: '700' }}>إلغاء</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          </View>
        )}

        {/* TAB: INTEGRATED SUPPORT OPERATIONS */}
        {activeTab === 'support' && <AdminSupportCenter onToast={showToast} />}

        {/* TAB 8: AUDIT LOGS */}
        {activeTab === 'logs' && (
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>سجل العمليات والتدقيق الإداري 📜</Text>
              <Text style={styles.countBadgeText}>{auditLogs.length} عملية مسجلة</Text>
            </View>
            <Text style={styles.sectionSubDesc}>
              سجل رقابي لحظي يوثق كافة القرارات الإدارية، الترقيات، التوثيق، وحذف المحتوى من قبل المدراء.
            </Text>

            {auditLogs.length === 0 ? (
              <EmptyState icon={<Clock size={40} color="#94A3B8" />} title="لا توجد عمليات مسجلة حتى الآن" sub="سيتم توثيق أي إجراء رقابي تتخذه كمدير للنظام تلقائياً هنا." />
            ) : (
              auditLogs.map(log => (
                <OasisSurface oasisSurface="card" key={log.id} style={styles.auditLogCard}>
                  <View style={styles.auditLogIconBox}>
                    <ShieldCheck size={18} color="#0891B2" />
                  </View>
                  <View style={styles.auditLogMeta}>
                    <Text style={styles.auditLogAction}>{log.action}</Text>
                    <Text style={styles.auditLogTarget}>
                      الهدف: {log.metadata?.target_name || log.target_type || 'النظام'} · المنفذ: {log.actor?.display_name || log.actor?.username || 'مدير'}
                    </Text>
                  </View>
                  <Text style={styles.auditLogTime}>{new Date(log.created_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</Text>
                </OasisSurface>
              ))
            )}
          </View>
        )}

        {/* TAB 9: SAUDI CUSTOM LOCATIONS */}
        {activeTab === 'locations' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>إدارة المواقع والأحياء السعودية 📍</Text>
            <Text style={styles.sectionSubDesc}>إضافة أحياء ومدن جديدة تظهر في قوائم التسجيل وتصفية الجيران.</Text>

            <View style={styles.broadcastBox}>
              <Text style={styles.inputLabel}>اسم الحي</Text>
              <TextInput
                style={styles.formInput}
                placeholder="مثال: حي النرجس، حي الملقا، حي الياسمين..."
                placeholderTextColor="#94A3B8"
                value={locationName}
                onChangeText={setLocationName}
              />

              <Text style={[styles.inputLabel, { marginTop: 10 }]}>المدينة</Text>
              <TextInput
                style={styles.formInput}
                placeholder="مثال: الرياض، جدة، الدمام، الخبر..."
                placeholderTextColor="#94A3B8"
                value={locationCity}
                onChangeText={setLocationCity}
              />

              <Text style={[styles.inputLabel, { marginTop: 10 }]}>المنطقة (اختياري)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="مثال: منطقة الرياض، المنطقة الشرقية، منطقة مكة المكرمة..."
                placeholderTextColor="#94A3B8"
                value={locationRegion}
                onChangeText={setLocationRegion}
              />

              <Pressable
                style={[styles.btnSendBroadcast, savingLocation && { opacity: 0.6 }]}
                onPress={handleAddLocation}
                disabled={savingLocation}
              >
                {savingLocation ? (
                  <ActivityIndicator color={OASIS.colors.surface} />
                ) : (
                  <>
                    <MapPin size={18} color={OASIS.colors.surface} />
                    <Text style={styles.btnSendBroadcastText}>حفظ وإضافة الحي للقاعدة 📍</Text>
                  </>
                )}
              </Pressable>
            </View>

            <Text style={[styles.subSectionTitle, { marginTop: 16 }]}>الأحياء المضافة ({customLocations.length})</Text>
            {customLocations.map(loc => {
              const fullLocName = [loc.region_name, loc.city_name, loc.district_name].filter(Boolean).join(' · ');
              return (
                <View key={loc.id} style={styles.quickAction}>
                  <View style={styles.quickActionLeft}>
                    <MapPin size={16} color={C.accent} />
                    <Text style={styles.quickActionText}>{fullLocName}</Text>
                  </View>
                  <Pressable oasisKind="icon" style={styles.trashActionBtn} onPress={() => handleDeleteLocation(loc.id, fullLocName)}>
                    <Trash size={14} color={OASIS.colors.danger} />
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}

        {/* TAB 10: BRANDING LOGO */}
        {activeTab === 'branding' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>الهوية البصرية والشعار الرسمي 🇸🇦</Text>
            <Text style={styles.sectionSubDesc}>
              تحديث الشعار المركزي للمنصة؛ ينعكس فورياً في شاشات تسجيل الدخول، هيدر التطبيق، وأيقونة الويب.
            </Text>

            <View style={{ alignItems: 'center', backgroundColor: OASIS.colors.deep, borderRadius: 14, padding: 16, marginVertical: 12 }}>
              <View
                style={{
                  width: 140,
                  height: 140,
                  borderRadius: 14,
                  backgroundColor: 'rgba(255,255,255,0.14)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.28)',
                }}
              >
                <Image source={{ uri: brandingLogo }} style={{ width: 115, height: 115 }} resizeMode="contain" />
              </View>
              <Text style={{ color: OASIS.colors.surface, fontSize: 17, fontWeight: '700', marginTop: 12 }}>شعار حيّنا المعتمد</Text>
              <Text style={{ color: '#A7F3D0', fontSize: 11, fontWeight: '700', marginTop: 4 }}>
                تحديث الشعار يطبق مركزياً في النظام بالكامل
              </Text>
            </View>

            <Pressable
              style={[styles.btnSendBroadcast, brandingUploading && { opacity: 0.6 }]}
              onPress={changeGlobalLogo}
              disabled={brandingUploading}
            >
              {brandingUploading ? <ActivityIndicator color={OASIS.colors.surface} /> : <Sparkles size={18} color={OASIS.colors.surface} />}
              <Text style={styles.btnSendBroadcastText}>
                {brandingUploading ? 'جارٍ رفع الشعار...' : 'اختيار ورفع شعار جديد'}
              </Text>
            </Pressable>
          </View>
        )}

        {/* TAB: ADVANCED ANALYTICS */}
        {activeTab === 'analytics' && <AdminAnalytics onSaved={showToast} />}

        {/* TAB: WEEKLY REPORT */}
        {activeTab === 'weekly' && <AdminWeeklyReport onSaved={showToast} />}

        {/* TAB: BADGES & REWARDS */}
        {activeTab === 'badges' && <AdminBadges onSaved={showToast} />}

        {/* TAB: SECURITY & SESSIONS */}
        {activeTab === 'security' && <AdminSecurityCenter onSaved={showToast} />}

      </AdminWorkspace>

      {/* ======================================================== */}
      {/* 4. USER DOSSIER INSPECTOR MODAL                          */}
      {/* ======================================================== */}
      {inspectedUser && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalDossierBox}>
            <View style={styles.modalDossierHeader}>
              <Pressable oasisKind="icon" onPress={() => setInspectedUser(null)} style={styles.modalCloseBtn}>
                <X size={18} color={C.ink} />
              </Pressable>
              <Text style={styles.modalDossierTitle}>الملف الإداري الشامل للمواطن 📁</Text>
            </View>

            <ScrollView style={styles.modalDossierScroll} showsVerticalScrollIndicator={false}>
              <OasisSurface oasisSurface="card" style={styles.modalProfileCard}>
                <View style={styles.modalAvatarWrap}>
                  {inspectedUser.avatar_url ? (
                    <Image source={{ uri: inspectedUser.avatar_url }} style={styles.modalAvatarImg} />
                  ) : (
                    <View style={styles.modalAvatarFallback}>
                      <Text style={styles.modalAvatarLetter}>{inspectedUser.display_name?.[0] || 'م'}</Text>
                    </View>
                  )}
                  {inspectedUser.role === 'admin' && (
                    <View style={styles.modalAdminBadge}>
                      <Crown size={12} color={OASIS.colors.surface} />
                    </View>
                  )}
                </View>

                <View style={styles.modalUserInfo}>
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.modalName}>{inspectedUser.display_name || 'بدون اسم'}</Text>
                    {inspectedUser.is_verified && <CheckCircle2 size={16} color={OASIS.colors.info} />}
                    {inspectedUser.is_geoverified && <ShieldCheck size={16} color={OASIS.colors.primary} />}
                  </View>
                  <Text style={styles.modalHandle}>@{inspectedUser.username || 'user'}</Text>
                  <Text style={styles.modalCity}>
                    📍 {inspectedUser.district ? `حي ${inspectedUser.district} · ` : ''}
                    {inspectedUser.city || 'الرياض'}
                  </Text>
                </View>
              </OasisSurface>

              {/* Activity metrics */}
              <View style={styles.modalFootprintRow}>
                <View style={styles.modalFootprintBox}>
                  <Text style={styles.modalFootprintNum}>{userActivityStats.qCount}</Text>
                  <Text style={styles.modalFootprintLabel}>الاستفسارات</Text>
                </View>
                <View style={styles.modalFootprintBox}>
                  <Text style={styles.modalFootprintNum}>{userActivityStats.aCount}</Text>
                  <Text style={styles.modalFootprintLabel}>الإجابات</Text>
                </View>
                <View style={styles.modalFootprintBox}>
                  <Text style={styles.modalFootprintNum}>{userActivityStats.reqCount}</Text>
                  <Text style={styles.modalFootprintLabel}>الفزعات</Text>
                </View>
                <View style={styles.modalFootprintBox}>
                  <Text style={[styles.modalFootprintNum, { color: inspectedUser.role === 'admin' ? OASIS.colors.warning : OASIS.colors.info }]}>
                    {inspectedUser.role === 'admin' ? 'مدير 👑' : 'مستخدم 👤'}
                  </Text>
                  <Text style={styles.modalFootprintLabel}>الرتبة</Text>
                </View>
              </View>

              {/* 360° Dossier */}
              <Text style={styles.modalSectionLabel}>الملف الموسّع 360°:</Text>
              <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 }}>
                {[
                  { label: 'عمر الحساب', value: accountAgeLabel(inspectedUser.created_at), color: C.info },
                  { label: 'الأجهزة المسجّلة', value: String(userDevices), color: C.accent },
                  { label: 'الخدمات المقدّمة', value: String(userExtras.services), color: C.purple },
                  { label: 'بلاغات ضدّه', value: String(userExtras.reportsAgainst), color: userExtras.reportsAgainst > 0 ? C.danger : C.muted },
                ].map((m) => (
                  <View
                    key={m.label}
                    style={{ flexBasis: '48%', flexGrow: 1, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 12, padding: 10, gap: 3 }}
                  >
                    <Text style={{ fontSize: 15, fontWeight: '700', color: m.color, textAlign: 'right' }}>{m.value}</Text>
                    <Text style={{ fontSize: 11, color: C.muted, fontWeight: '700', textAlign: 'right' }}>{m.label}</Text>
                  </View>
                ))}
              </View>

              {userExtras.recent.length > 0 ? (
                <View style={{ marginTop: 10, gap: 6 }}>
                  <Text style={styles.modalSectionLabel}>آخر النشاطات:</Text>
                  {userExtras.recent.map((r) => (
                    <View
                      key={r.id}
                      style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8, backgroundColor: C.bg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 }}
                    >
                      <MessageCircle size={13} color={C.info} />
                      <Text style={{ flex: 1, fontSize: 11.5, color: C.ink, textAlign: 'right' }} numberOfLines={1}>{r.title}</Text>
                      <Text style={{ fontSize: 11, color: C.subtle, fontWeight: '700' }}>{new Date(r.created_at).toLocaleDateString('ar-SA')}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <Text style={styles.modalSectionLabel}>إجراءات الإدارة المباشرة:</Text>

              {/* Toggle Role */}
              <Pressable
                style={[styles.modalActionItem, inspectedUser.role === 'admin' ? styles.itemDemote : styles.itemPromote]}
                onPress={() => toggleUserRole(inspectedUser)}
              >
                <Crown size={18} color={inspectedUser.role === 'admin' ? '#D97706' : OASIS.colors.info} />
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={[styles.modalActionTitle, inspectedUser.role === 'admin' ? { color: '#D97706' } : { color: OASIS.colors.info }]}>
                    {inspectedUser.role === 'admin' ? 'خفض الرتبة إلى مستخدم عادي 👤' : 'ترقية إلى مدير النظام (Admin) 👑'}
                  </Text>
                  <Text style={styles.modalActionSub}>
                    {inspectedUser.role === 'admin' ? 'سحب صلاحية لوحة التحكم' : 'منح صلاحيات الإدارة والرقابة'}
                  </Text>
                </View>
              </Pressable>

              {/* Toggle Blue Badge */}
              <Pressable
                style={[styles.modalActionItem, inspectedUser.is_verified && styles.itemSuccess]}
                onPress={() => toggleVerification(inspectedUser)}
              >
                <CheckCircle2 size={18} color={inspectedUser.is_verified ? OASIS.colors.primary : OASIS.colors.muted} />
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={[styles.modalActionTitle, inspectedUser.is_verified && { color: OASIS.colors.primary }]}>
                    {inspectedUser.is_verified ? 'سحب التوثيق الرسمي' : 'منح التوثيق الرسمي بالشارة الزرقاء ✓'}
                  </Text>
                  <Text style={styles.modalActionSub}>اعتماد الهوية الوطنية والاسم الحقيقي في حيّنا</Text>
                </View>
              </Pressable>

              {/* Toggle Geo Badge */}
              <Pressable
                style={[styles.modalActionItem, inspectedUser.is_geoverified && styles.itemSuccess]}
                onPress={() => toggleGeoVerification(inspectedUser)}
              >
                <ShieldCheck size={18} color={inspectedUser.is_geoverified ? OASIS.colors.primary : OASIS.colors.muted} />
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={[styles.modalActionTitle, inspectedUser.is_geoverified && { color: OASIS.colors.primary }]}>
                    {inspectedUser.is_geoverified ? 'إلغاء إثبات السكن' : 'توثيق السكن "ابن الحي الموثق" 🛡️'}
                  </Text>
                  <Text style={styles.modalActionSub}>تأكيد إقامة المواطن وسكنه الفعلي داخل الحي</Text>
                </View>
              </Pressable>

              {/* Toggle Ban */}
              <Pressable
                style={[styles.modalActionItem, inspectedUser.is_banned ? styles.itemBanned : styles.itemBan]}
                onPress={() => toggleBanUser(inspectedUser)}
              >
                <Ban size={18} color={inspectedUser.is_banned ? OASIS.colors.surface : OASIS.colors.danger} />
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={[styles.modalActionTitle, inspectedUser.is_banned ? { color: OASIS.colors.surface } : { color: OASIS.colors.danger }]}>
                    {inspectedUser.is_banned ? 'رفع الحظر عن الحساب 🟢' : 'حظر الحساب نهائياً 🚫'}
                  </Text>
                  <Text style={[styles.modalActionSub, inspectedUser.is_banned && { color: '#FEE2E2' }]}>
                    منع المستخدم من التفاعل والنشر داخل المنصة
                  </Text>
                </View>
              </Pressable>

              {/* Send Direct Notice */}
              <Text style={[styles.modalSectionLabel, { marginTop: 14 }]}>إرسال تنبيه إداري خاص للمواطن:</Text>
              <TextInput
                style={styles.modalDirectMsgInput}
                placeholder="اكتب التنبيه الإداري الخاص بالمواطن..."
                placeholderTextColor="#94A3B8"
                value={directNoticeText}
                onChangeText={setDirectNoticeText}
                multiline
              />
              <Pressable
                style={[styles.btnSendNotice, (!directNoticeText.trim() || sendingDirectNotice) && { opacity: 0.5 }]}
                onPress={handleSendDirectNotice}
                disabled={!directNoticeText.trim() || sendingDirectNotice}
              >
                {sendingDirectNotice ? (
                  <ActivityIndicator size="small" color={OASIS.colors.surface} />
                ) : (
                  <>
                    <Send size={15} color={OASIS.colors.surface} />
                    <Text style={styles.btnSendNoticeText}>إرسال التنبيه الآن</Text>
                  </>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
}

// Helper Subcomponents

function FilterPill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable oasisVariant={active ? 'primary' : 'secondary'} oasisKind="chip" style={[styles.filterPill, active && styles.filterPillActive]} onPress={onPress}>
      <Text style={[styles.filterPillText, active && styles.filterPillTextActive]}>{label}</Text>
    </Pressable>
  );
}


function EmptyState({ icon, title, sub }: { icon: React.ReactNode; title: string; sub?: string }) {
  return (
    <View style={styles.emptyState}>
      {icon}
      <Text style={styles.emptyTitle}>{title}</Text>
      {sub ? <Text style={styles.emptySub}>{sub}</Text> : null}
    </View>
  );
}
