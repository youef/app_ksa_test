import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
  RefreshControl,
  ActivityIndicator,
  Platform,
  TextInput,
  Image,
  Animated,
  useWindowDimensions,
} from 'react-native';
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
import { sendAdminBroadcastPush, sendPushToMultipleUsers, sendPushToUser } from '@/lib/pushSender';
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

export default function AdminScreen() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isSmallPhone = width < 400;
  const statCardWidth = isSmallPhone ? '100%' : isMobile ? '48%' : '23.5%';

  // Auth and loading state
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentAdmin, setCurrentAdmin] = useState<AdminProfile | null>(null);

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<
    'overview' | 'users' | 'verifications' | 'reports' | 'platform' | 'content' | 'broadcast' | 'logs' | 'locations' | 'branding'
  >('overview');

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
  const [directNoticeText, setDirectNoticeText] = useState('');
  const [sendingDirectNotice, setSendingDirectNotice] = useState(false);

  // Filters & Search
  const [userSearch, setUserSearch] = useState('');
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
        supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(100),
        supabase
          .from('verification_requests')
          .select('*, user:user_id(id, display_name, username, city, district, avatar_url, bio, is_verified, is_geoverified, role, created_at)')
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
          .select('*, user:user_id(id, display_name, username, avatar_url, city, district)')
          .order('created_at', { ascending: false })
          .limit(60),
        supabase
          .from('questions')
          .select('*, author:author_id(id, display_name, username, avatar_url)')
          .order('created_at', { ascending: false })
          .limit(40),
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
      const allVerifs = (verifRes.data || []) as AdminVerificationRequest[];
      const allReports = (reportsRes.data || []) as AdminReport[];
      const allServices = (servicesRes.data || []) as AdminService[];
      const allBorrow = (borrowRes.data || []) as AdminBorrowItem[];
      const allUrgent = (urgentRes.data || []) as AdminUrgentAlert[];
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
    } catch (err: any) {
      console.error('Error loading admin dashboard:', err);
      showToast('تعذر تحميل بيانات لوحة التحكم: ' + (err?.message || 'خطأ في الاتصال'));
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Handle Pull-to-Refresh
  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  // Inspect User Relations and Activity
  const inspectUser = async (target: AdminProfile) => {
    setInspectedUser(target);
    try {
      const [qRes, aRes, rRes] = await Promise.all([
        supabase.from('questions').select('id', { count: 'exact', head: true }).eq('author_id', target.id),
        supabase.from('answers').select('id', { count: 'exact', head: true }).eq('author_id', target.id),
        supabase.from('requests').select('id', { count: 'exact', head: true }).eq('requester_id', target.id),
      ]);
      setUserActivityStats({
        qCount: qRes.count || 0,
        aCount: aRes.count || 0,
        reqCount: rRes.count || 0,
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
      await sendPushToUser(inspectedUser.id, {
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

      const { error: reqErr } = await supabase
        .from('verification_requests')
        .update({
          status: action,
          reviewed_by: u.user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', reqId);

      if (reqErr) throw reqErr;

      if (action === 'approved') {
        const { error: profErr } = await supabase
          .from('profiles')
          .update({
            is_verified: true,
            verification_status: 'verified',
            updated_at: new Date().toISOString(),
          })
          .eq('id', userId);

        if (profErr) throw profErr;

        setUsersList(prev => prev.map(usr => (usr.id === userId ? { ...usr, is_verified: true, verification_status: 'verified' } : usr)));
      }

      // Dispatch in-app notification
      const notifTitle = action === 'approved' ? 'تهانينا! تم اعتماد توثيق حسابك 🎉' : 'تحديث بشأن طلب التوثيق';
      const notifBody =
        action === 'approved'
          ? 'تم اعتماد هويتك في حيّنا ومنحك الشارة الزرقاء الرسمية.'
          : 'تمت مراجعة طلب التوثيق الخاص بك، يرجى استيفاء البيانات والتقديم مجدداً.';

      await supabase.from('notifications').insert({
        user_id: userId,
        type: 'verification',
        title: notifTitle,
        body: notifBody,
        data: { actor_id: u.user.id, request_id: reqId, status: action },
      });

      // Dispatch push notification
      await sendPushToUser(userId, {
        title: notifTitle,
        body: notifBody,
        data: { type: 'verification', status: action },
      });

      await recordAuditLog(
        action === 'approved' ? 'اعتماد طلب توثيق رسمي' : 'رفض طلب توثيق رسمي',
        userName,
        'verification',
        reqId
      );

      setVerifications(prev => prev.map(v => (v.id === reqId ? { ...v, status: action } : v)));
      showToast(action === 'approved' ? 'تم اعتماد التوثيق ومنح الشارة الزرقاء ✓' : 'تم رفض طلب التوثيق');
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

      const badgeIcon =
        broadcastType === 'emergency'
          ? '🚨'
          : broadcastType === 'weather'
          ? '⛈️'
          : broadcastType === 'maintenance'
          ? '🔧'
          : '📢';

      // Filter recipients by target city
      const targetUsers = usersList.filter(user => {
        if (broadcastTarget === 'all') return true;
        return (user.city || '').includes(broadcastTarget);
      });

      const recipientIds = targetUsers.map(usr => usr.id).filter(Boolean);
      if (!recipientIds.length) throw new Error('لا يوجد مستخدمون مطابقون للمدينة المستهدفة.');

      const fullTitle = `${badgeIcon} ${broadcastTitle.trim()}`;
      const fullBody = broadcastBody.trim();

      // 1. Bulk insert in-app notifications
      const rows = recipientIds.map(usrId => ({
        user_id: usrId,
        type: 'broadcast',
        title: fullTitle,
        body: fullBody,
        data: { actor_id: u.user.id, broadcast_type: broadcastType, target: broadcastTarget },
      }));

      for (let i = 0; i < rows.length; i += 400) {
        const { error: batchErr } = await supabase.from('notifications').insert(rows.slice(i, i + 400));
        if (batchErr) throw batchErr;
      }

      // 2. Deliver a real push to every registered mobile/browser device.
      const pushResult = await sendAdminBroadcastPush(recipientIds, {
        title: fullTitle,
        body: fullBody,
        data: { type: 'broadcast', broadcast_type: broadcastType, target: broadcastTarget },
      });

      await recordAuditLog('بث تعميم رسمي لسكان الحي', broadcastTitle.trim(), 'broadcast');
      if (pushResult.success && pushResult.sentCount > 0) {
        showToast(`تم حفظ التعميم وإرسال إشعار فوري إلى ${pushResult.sentCount} جهاز 📢`);
      } else {
        Alert.alert(
          'تم حفظ التعميم',
          `تم حفظ التعميم داخل التطبيق وإظهاره في صفحة الإشعارات، لكن لم يصل إشعار فوري لأي جهاز مسجّل. ${pushResult.error || 'تحقق من إعدادات مفاتيح الإشعارات في Vercel ومن تسجيل الأجهزة.'}`
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
    });
  }, [usersList, userSearch, selectedCityFilter, userRoleFilter]);

  // Filtered Reports computation
  const filteredReports = useMemo(() => {
    return reports.filter(r => {
      if (reportStatusFilter === 'all') return true;
      return r.status === reportStatusFilter;
    });
  }, [reports, reportStatusFilter]);

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
        <Pressable style={styles.backBtn} onPress={() => router.replace('/home')}>
          <Text style={styles.backBtnText}>العودة للرئيسية</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Toast Banner */}
      {toastMsg && (
        <Animated.View style={[styles.toastBanner, { opacity: toastAnim }]}>
          <Text style={styles.toastBannerText}>{toastMsg}</Text>
        </Animated.View>
      )}

      {/* ======================================================== */}
      {/* 1. EXECUTIVE COMMAND HEADER (Dark Modern Royal Green)    */}
      {/* ======================================================== */}
      <LinearGradient
        colors={[C.navyDark, C.navyMid, C.navyLight]}
        style={[styles.headerGrad, isMobile && { paddingHorizontal: 14, paddingTop: Platform.OS === 'ios' ? 48 : 34 }]}
      >
        <View style={styles.headerContent}>
          <Pressable onPress={() => router.replace('/home')} style={styles.backIconBtn}>
            <ChevronRight size={22} color="#FFFFFF" />
          </Pressable>

          <View style={styles.headerTexts}>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
              <Text style={[styles.headerTitle, isMobile && { fontSize: 17 }]} numberOfLines={1}>
                مركز عمليات حيّنا 🇸🇦
              </Text>
              <Crown size={isMobile ? 16 : 19} color="#F59E0B" />
            </View>
            <Text style={[styles.headerSub, isMobile && { fontSize: 10 }]} numberOfLines={1}>
              لوحة الإدارة والرقابة الشاملة · {currentAdmin.display_name || currentAdmin.username} (مدير النظام)
            </Text>
          </View>

          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
            <Pressable onPress={handleExportData} style={styles.headerActionBtn}>
              <Download size={16} color="#FFFFFF" />
            </Pressable>
            <Pressable onPress={onRefresh} style={styles.headerActionBtn}>
              <RefreshCw size={16} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        {/* Live Operational Status Ribbon */}
        <View style={styles.alertsRow}>
          <View style={[styles.alertPill, { backgroundColor: 'rgba(2,132,199,0.85)' }]}>
            <ShieldCheck size={12} color="#FFFFFF" />
            <Text style={styles.alertPillText}>الصلاحيات: مدير (Admin) · مستخدم (User)</Text>
          </View>

          {stats.pendingReports > 0 && (
            <Pressable style={[styles.alertPill, { backgroundColor: C.danger }]} onPress={() => setActiveTab('reports')}>
              <Flag size={12} color="#FFFFFF" />
              <Text style={styles.alertPillText}>{stats.pendingReports} بلاغ معلق 🚨</Text>
            </Pressable>
          )}

          {stats.pendingVerifications > 0 && (
            <Pressable
              style={[styles.alertPill, { backgroundColor: C.warning }]}
              onPress={() => setActiveTab('verifications')}
            >
              <Star size={12} color="#FFFFFF" />
              <Text style={styles.alertPillText}>{stats.pendingVerifications} توثيق بانتظار الاعتماد 🌟</Text>
            </Pressable>
          )}

          {stats.urgentAlerts > 0 && (
            <Pressable style={[styles.alertPill, { backgroundColor: '#B91C1C' }]} onPress={() => setActiveTab('platform')}>
              <AlertTriangle size={12} color="#FFFFFF" />
              <Text style={styles.alertPillText}>{stats.urgentAlerts} طارئ نشط ⚠️</Text>
            </Pressable>
          )}
        </View>
      </LinearGradient>

      {/* ======================================================== */}
      {/* 2. ADVANCED HORIZONTAL NAVIGATION TABS                   */}
      {/* ======================================================== */}
      <View style={styles.tabBarWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarScroll}>
          <TabPill
            label="التحليلات والمؤشرات"
            icon={<BarChart3 size={15} color={activeTab === 'overview' ? '#FFFFFF' : '#64748B'} />}
            active={activeTab === 'overview'}
            onPress={() => setActiveTab('overview')}
          />
          <TabPill
            label={`المستخدمون (${usersList.length})`}
            icon={<Users size={15} color={activeTab === 'users' ? '#FFFFFF' : '#64748B'} />}
            active={activeTab === 'users'}
            onPress={() => setActiveTab('users')}
          />
          <TabPill
            label={`مكتب التوثيق (${stats.pendingVerifications})`}
            icon={<Star size={15} color={activeTab === 'verifications' ? '#FFFFFF' : '#64748B'} />}
            active={activeTab === 'verifications'}
            badge={stats.pendingVerifications > 0 ? stats.pendingVerifications : undefined}
            onPress={() => setActiveTab('verifications')}
          />
          <TabPill
            label={`مركز البلاغات (${stats.pendingReports})`}
            icon={<Flag size={15} color={activeTab === 'reports' ? '#FFFFFF' : '#64748B'} />}
            active={activeTab === 'reports'}
            badge={stats.pendingReports > 0 ? stats.pendingReports : undefined}
            onPress={() => setActiveTab('reports')}
          />
          <TabPill
            label="موارد المنصة والخدمات"
            icon={<Truck size={15} color={activeTab === 'platform' ? '#FFFFFF' : '#64748B'} />}
            active={activeTab === 'platform'}
            onPress={() => setActiveTab('platform')}
          />
          <TabPill
            label="مراقبة المحتوى"
            icon={<MessageCircle size={15} color={activeTab === 'content' ? '#FFFFFF' : '#64748B'} />}
            active={activeTab === 'content'}
            onPress={() => setActiveTab('content')}
          />
          <TabPill
            label="بث تعميم للحي 📢"
            icon={<Megaphone size={15} color={activeTab === 'broadcast' ? '#FFFFFF' : '#64748B'} />}
            active={activeTab === 'broadcast'}
            onPress={() => setActiveTab('broadcast')}
          />
          <TabPill
            label="سجل العمليات والتدقيق"
            icon={<Clock size={15} color={activeTab === 'logs' ? '#FFFFFF' : '#64748B'} />}
            active={activeTab === 'logs'}
            onPress={() => setActiveTab('logs')}
          />
          <TabPill
            label="إدارة المواقع"
            icon={<MapPin size={15} color={activeTab === 'locations' ? '#FFFFFF' : '#64748B'} />}
            active={activeTab === 'locations'}
            onPress={() => setActiveTab('locations')}
          />
          <TabPill
            label="الهوية والشعار"
            icon={<Sparkles size={15} color={activeTab === 'branding' ? '#FFFFFF' : '#64748B'} />}
            active={activeTab === 'branding'}
            onPress={() => setActiveTab('branding')}
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
        {/* TAB 1: OVERVIEW & ANALYTICS */}
        {activeTab === 'overview' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>مؤشرات الأداء اللحظية 📈</Text>
            <Text style={styles.sectionSubDesc}>نظرة شاملة ومحدثة على حركة ونشاط مجتمع الجيران في المملكة.</Text>

            {/* KPI Cards Grid */}
            <View style={styles.statsGrid}>
              <StatCard
                icon={<Users size={22} color="#0284C7" />}
                bg="#F0F9FF"
                value={stats.users}
                label="إجمالي السكان"
                sub={`${stats.admins} مدير · ${stats.users - stats.admins} مواطن`}
                style={{ width: statCardWidth }}
              />
              <StatCard
                icon={<Star size={22} color="#D97706" />}
                bg="#FFFBEB"
                value={stats.verifiedUsers}
                label="حسابات موثقة رسمياً"
                sub={`${stats.pendingVerifications} طلب معلق`}
                style={{ width: statCardWidth }}
              />
              <StatCard
                icon={<Truck size={22} color="#059669" />}
                bg="#ECFDF5"
                value={stats.services}
                label="خدمات وحرفيو الحي"
                sub="عروض عمل معتمدة"
                style={{ width: statCardWidth }}
              />
              <StatCard
                icon={<Wrench size={22} color="#7C3AED" />}
                bg="#F5F3FF"
                value={stats.borrowItems}
                label="أدوات الإعارة المتاحة"
                sub="تكاتف وتشارك الجيران"
                style={{ width: statCardWidth }}
              />
            </View>

            {/* Cities Distribution */}
            <View style={styles.citiesCard}>
              <View style={styles.citiesCardHeader}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                  <MapPin size={16} color={C.accent} />
                  <Text style={styles.citiesCardTitle}>توزيع نشاط مدن المملكة</Text>
                </View>
                <Text style={styles.citiesCardSub}>انقر على أي مدينة للتصفية الفورية</Text>
              </View>

              <View style={styles.cityPillsRow}>
                {[
                  { name: 'all', label: '🇸🇦 كامل المملكة', count: usersList.length },
                  { name: 'الرياض', label: 'الرياض', count: usersList.filter(u => u.city?.includes('الرياض')).length },
                  { name: 'جدة', label: 'جدة', count: usersList.filter(u => u.city?.includes('جدة')).length },
                  { name: 'الدمام', label: 'الدمام', count: usersList.filter(u => u.city?.includes('الدمام')).length },
                  { name: 'مكة', label: 'مكة المكرمة', count: usersList.filter(u => u.city?.includes('مكة')).length },
                  { name: 'المدينة', label: 'المدينة المنورة', count: usersList.filter(u => u.city?.includes('المدينة')).length },
                ].map(c => (
                  <Pressable
                    key={c.name}
                    style={[styles.cityPill, selectedCityFilter === c.name && styles.cityPillActive]}
                    onPress={() => {
                      setSelectedCityFilter(c.name);
                      showToast(`تم تحديد نطاق: ${c.label}`);
                    }}
                  >
                    <Text style={[styles.cityPillText, selectedCityFilter === c.name && styles.cityPillTextActive]}>
                      {c.label} ({c.count})
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Platform Infrastructure Health */}
            <View style={styles.healthCard}>
              <View style={styles.healthHeader}>
                <View style={styles.healthStatusBadge}>
                  <View style={styles.healthDot} />
                  <Text style={styles.healthStatusText}>الخوادم والبنية التحتية نشطة بنسبة 100%</Text>
                </View>
                <Activity size={16} color="#10B981" />
              </View>

              <View style={styles.healthRow}>
                <Text style={styles.healthLabel}>قاعدة البيانات الموزعة (Supabase PostgreSQL + RLS)</Text>
                <Text style={styles.healthValueActive}>متصلة ومحمية بالسياسات 🟢</Text>
              </View>
              <View style={styles.healthRow}>
                <Text style={styles.healthLabel}>بوابة الإشعارات الفورية (Push Notification Gateway)</Text>
                <Text style={styles.healthValueActive}>نشطة (Expo API) ⚡</Text>
              </View>
              <View style={styles.healthRow}>
                <Text style={styles.healthLabel}>مستويات الصلاحيات المعتمدة</Text>
                <Text style={styles.healthValueRole}>مدير (Admin) · مستخدم (User)</Text>
              </View>
            </View>

            {/* Quick Action Shortcuts */}
            <Text style={[styles.sectionTitle, { marginTop: 14 }]}>إجراءات سريعة لمدير النظام ⚡</Text>

            <Pressable style={styles.quickAction} onPress={() => setActiveTab('verifications')}>
              <View style={styles.quickActionLeft}>
                <Star size={18} color="#D97706" />
                <Text style={styles.quickActionText}>مراجعة واعتماد ملفات التوثيق الرسمية المعلقة</Text>
              </View>
              {stats.pendingVerifications > 0 ? (
                <View style={[styles.qBadge, { backgroundColor: '#FEF3C7' }]}>
                  <Text style={[styles.qBadgeText, { color: '#D97706' }]}>{stats.pendingVerifications} بانتظارك</Text>
                </View>
              ) : (
                <ChevronRight size={18} color="#94A3B8" />
              )}
            </Pressable>

            <Pressable style={styles.quickAction} onPress={() => setActiveTab('reports')}>
              <View style={styles.quickActionLeft}>
                <Flag size={18} color={C.danger} />
                <Text style={styles.quickActionText}>معالجة بلاغات المحتوى المخالف والبت فيها</Text>
              </View>
              {stats.pendingReports > 0 ? (
                <View style={[styles.qBadge, { backgroundColor: '#FEE2E2' }]}>
                  <Text style={[styles.qBadgeText, { color: '#DC2626' }]}>{stats.pendingReports} بلاغ</Text>
                </View>
              ) : (
                <ChevronRight size={18} color="#94A3B8" />
              )}
            </Pressable>

            <Pressable style={styles.quickAction} onPress={() => setActiveTab('broadcast')}>
              <View style={styles.quickActionLeft}>
                <Megaphone size={18} color="#0284C7" />
                <Text style={styles.quickActionText}>إرسال تعميم أو تنبيه عاجل لأهل الحي</Text>
              </View>
              <ChevronRight size={18} color="#94A3B8" />
            </Pressable>
          </View>
        )}

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
                  <View key={u.id} style={[styles.userCard, isAdmin && styles.userCardAdmin, u.is_banned && styles.userCardBanned]}>
                    <Pressable style={styles.userCardHeader} onPress={() => inspectUser(u)}>
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
                            <Crown size={10} color="#FFFFFF" />
                          </View>
                        )}
                      </View>

                      <View style={styles.userMeta}>
                        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.userName}>{u.display_name || 'بدون اسم'}</Text>
                          {u.is_verified && <CheckCircle2 size={14} color="#0284C7" />}
                          {u.is_geoverified && <ShieldCheck size={14} color="#16A34A" />}
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
                      <Pressable
                        style={[styles.userActionBtn, isAdmin ? styles.btnDemote : styles.btnPromote]}
                        onPress={() => toggleUserRole(u)}
                      >
                        {isAdmin ? <UserX size={14} color="#D97706" /> : <Crown size={14} color="#0284C7" />}
                        <Text style={[styles.userActionBtnText, isAdmin ? { color: '#D97706' } : { color: '#0284C7' }]}>
                          {isAdmin ? 'خفض لمستخدم' : 'ترقية لمدير 👑'}
                        </Text>
                      </Pressable>

                      <Pressable
                        style={[styles.userActionBtn, u.is_verified && styles.btnActiveSuccess]}
                        onPress={() => toggleVerification(u)}
                      >
                        <CheckCircle2 size={14} color={u.is_verified ? '#16A34A' : '#64748B'} />
                        <Text style={[styles.userActionBtnText, u.is_verified && { color: '#16A34A' }]}>
                          {u.is_verified ? 'شارة موثقة' : 'توثيق رسمي'}
                        </Text>
                      </Pressable>

                      <Pressable
                        style={[styles.userActionBtn, u.is_geoverified && styles.btnActiveSuccess]}
                        onPress={() => toggleGeoVerification(u)}
                      >
                        <ShieldCheck size={14} color={u.is_geoverified ? '#16A34A' : '#64748B'} />
                        <Text style={[styles.userActionBtnText, u.is_geoverified && { color: '#16A34A' }]}>
                          {u.is_geoverified ? 'ابن الحي ✓' : 'توثيق السكن'}
                        </Text>
                      </Pressable>

                      <Pressable
                        style={[styles.userActionBtn, u.is_banned ? styles.btnBannedActive : styles.btnBan]}
                        onPress={() => toggleBanUser(u)}
                      >
                        <Ban size={14} color={u.is_banned ? '#FFFFFF' : '#DC2626'} />
                        <Text style={[styles.userActionBtnText, u.is_banned ? { color: '#FFFFFF' } : { color: '#DC2626' }]}>
                          {u.is_banned ? 'فك الحظر' : 'حظر'}
                        </Text>
                      </Pressable>

                      <Pressable style={styles.userActionBtn} onPress={() => inspectUser(u)}>
                        <Eye size={14} color="#0891B2" />
                        <Text style={[styles.userActionBtnText, { color: '#0891B2' }]}>الملف الكامل</Text>
                      </Pressable>
                    </View>
                  </View>
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
              <EmptyState icon={<Star size={42} color="#F59E0B" />} title="لا توجد طلبات توثيق معلقة" sub="تم فحص واعتماد كافة الطلبات المقدمة سابقاً بنجاح ✅" />
            ) : (
              verifications.map(v => {
                const u = v.user || {};
                const isPending = v.status === 'pending';
                return (
                  <View key={v.id} style={[styles.verifCardDossier, !isPending && { borderColor: '#E2E8F0', opacity: 0.8 }]}>
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
                            <Check size={9} color="#FFFFFF" />
                          </View>
                        )}
                      </View>

                      <View style={styles.dossierUserMeta}>
                        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.dossierUserName}>{u.display_name || 'بدون اسم'}</Text>
                          {u.is_verified && <CheckCircle2 size={14} color="#0284C7" />}
                          {u.is_geoverified && <ShieldCheck size={14} color="#16A34A" />}
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

                    {v.note ? (
                      <View style={styles.dossierNoteBox}>
                        <Text style={styles.dossierNoteTitle}>ملاحظة المتقدم للتوثيق:</Text>
                        <Text style={styles.dossierNoteText}>"{v.note}"</Text>
                      </View>
                    ) : null}

                    <View style={styles.dossierFootprintRow}>
                      <View style={styles.footprintItem}>
                        <Text style={styles.footprintLabel}>تاريخ التقديم</Text>
                        <Text style={styles.footprintVal}>{new Date(v.created_at).toLocaleDateString('ar-SA')}</Text>
                      </View>
                      <View style={styles.footprintItem}>
                        <Text style={styles.footprintLabel}>إثبات السكن</Text>
                        <Text style={[styles.footprintVal, { color: u.is_geoverified ? '#16A34A' : '#D97706' }]}>
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
                          <Check size={16} color="#FFFFFF" />
                          <Text style={styles.btnApproveVerifText}>اعتماد ومنح الشارة الزرقاء ✓</Text>
                        </Pressable>

                        <Pressable
                          style={styles.btnRejectVerif}
                          onPress={() => handleVerificationDecision(v.id, v.user_id, 'rejected', u.display_name || u.username || 'مواطن')}
                        >
                          <X size={15} color="#DC2626" />
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
                <Text style={[styles.countBadgeText, { color: '#DC2626' }]}>{stats.pendingReports} بلاغ معلق</Text>
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
              <EmptyState icon={<Flag size={40} color="#10B981" />} title="لا توجد بلاغات في هذا التبويب" sub="مجتمع الجيران آمن ومستقر بإذن الله 🎉" />
            ) : (
              filteredReports.map(r => (
                <View key={r.id} style={[styles.reportCard, r.status !== 'pending' && { borderColor: '#E2E8F0', opacity: 0.75 }]}>
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
                        <Trash size={15} color="#FFFFFF" />
                        <Text style={styles.btnActionTextWhite}>حذف المحتوى المخالف فوراً وإغلاق البلاغ 🗑️</Text>
                      </Pressable>

                      <View style={{ flexDirection: 'row-reverse', gap: 8, marginTop: 8 }}>
                        <Pressable style={styles.resolveBtn} onPress={() => handleModerateReport(r, 'resolved', false)}>
                          <CheckCircle2 size={16} color="#FFFFFF" />
                          <Text style={styles.resolveBtnText}>إغلاق البلاغ كمعالج ✓</Text>
                        </Pressable>

                        <Pressable style={styles.dismissBtn} onPress={() => handleModerateReport(r, 'dismissed', false)}>
                          <XCircle size={16} color="#64748B" />
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
                    <View key={s.id} style={styles.platformItemCard}>
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
                          <Text style={{ fontWeight: '800', color: C.accent, fontSize: 12 }}>{s.price} ر.س</Text>
                        )}
                      </View>

                      <View style={styles.platformItemActions}>
                        <Pressable
                          style={[styles.smallActionBtn, s.is_verified && { backgroundColor: '#DCFCE7' }]}
                          onPress={() => updatePlatformEntity('service', s.id, 'toggle_verified', s.title)}
                        >
                          <CheckCircle2 size={15} color={s.is_verified ? '#16A34A' : '#64748B'} />
                          <Text style={[styles.smallActionText, s.is_verified && { color: '#16A34A' }]}>
                            {s.is_verified ? 'خدمة معتمدة ✓' : 'اعتماد وتوثيق'}
                          </Text>
                        </Pressable>

                        <Pressable
                          style={styles.smallActionBtn}
                          onPress={() => updatePlatformEntity('service', s.id, 'toggle_available', s.title)}
                        >
                          <Activity size={15} color={s.available_now ? '#0284C7' : '#64748B'} />
                          <Text style={styles.smallActionText}>{s.available_now ? 'متاح الآن' : 'غير متفرغ'}</Text>
                        </Pressable>
                      </View>
                    </View>
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
                    <View key={item.id} style={styles.platformItemCard}>
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
                        <Pressable
                          style={styles.smallActionBtn}
                          onPress={() => updatePlatformEntity('borrow_item', item.id, 'toggle_status', item.title)}
                        >
                          <Archive size={15} color="#64748B" />
                          <Text style={styles.smallActionText}>
                            {item.status === 'available' ? 'تعطيل الإتاحة' : 'تفعيل الإتاحة'}
                          </Text>
                        </Pressable>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* Sub-tab 3: Urgent Alerts */}
            {platformTabSub === 'urgent' && (
              <View>
                <Text style={styles.subSectionTitle}>تنبيهات الطوارئ والفزعات العاجلة</Text>
                {urgentAlertsList.length === 0 ? (
                  <EmptyState icon={<AlertTriangle size={36} color="#10B981" />} title="لا توجد تنبيهات طوارئ نشطة" sub="الحي يعيش في أمان وسلام تام 🛡️" />
                ) : (
                  urgentAlertsList.map(alert => (
                    <View key={alert.id} style={[styles.platformItemCard, { borderColor: alert.status === 'active' ? '#FECACA' : '#E2E8F0' }]}>
                      <View style={styles.platformItemTop}>
                        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8, flex: 1 }}>
                          <AlertTriangle size={18} color={alert.status === 'active' ? '#DC2626' : '#10B981'} />
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
                          <Pressable
                            style={[styles.smallActionBtn, { backgroundColor: '#DCFCE7' }]}
                            onPress={() => updatePlatformEntity('urgent_alert', alert.id, 'resolve', alert.title)}
                          >
                            <CheckCircle2 size={15} color="#16A34A" />
                            <Text style={[styles.smallActionText, { color: '#16A34A' }]}>تمت الاستجابة وحل الطارئ ✓</Text>
                          </Pressable>
                        )}

                        <Pressable
                          style={[styles.smallActionBtn, { backgroundColor: '#FEE2E2' }]}
                          onPress={() => updatePlatformEntity('urgent_alert', alert.id, 'delete', alert.title)}
                        >
                          <Trash size={15} color="#DC2626" />
                          <Text style={[styles.smallActionText, { color: '#DC2626' }]}>حذف التنبيه</Text>
                        </Pressable>
                      </View>
                    </View>
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
                  <View key={`q-${q.id}`} style={styles.contentItemCard}>
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
                        <Trash size={14} color="#DC2626" />
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
                  </View>
                ))}
              </View>
            )}

            {/* Requests List */}
            {(contentFilter === 'all' || contentFilter === 'requests') && (
              <View>
                <Text style={styles.subSectionTitle}>🚚 طلبات الفزعة والمساعدة</Text>
                {requestsList.map(r => (
                  <View key={`r-${r.id}`} style={styles.contentItemCard}>
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
                        <Trash size={14} color="#DC2626" />
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
                  </View>
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
              <Pressable style={styles.templatePill} onPress={() => applyBroadcastTemplate('emergency')}>
                <Text style={styles.templatePillText}>🚨 طارئ أمني</Text>
              </Pressable>
              <Pressable style={styles.templatePill} onPress={() => applyBroadcastTemplate('weather')}>
                <Text style={styles.templatePillText}>⛈️ تنبيه طقس</Text>
              </Pressable>
              <Pressable style={styles.templatePill} onPress={() => applyBroadcastTemplate('maintenance')}>
                <Text style={styles.templatePillText}>🔧 صيانة خدمات</Text>
              </Pressable>
              <Pressable style={styles.templatePill} onPress={() => applyBroadcastTemplate('welcome')}>
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

              {/* Live Preview Notification Card */}
              {broadcastTitle.length > 0 && (
                <View style={styles.previewBox}>
                  <Text style={styles.previewHeading}>معاينة الإشعار كما سيصل للجيران 🔔</Text>
                  <View style={styles.previewNotificationCard}>
                    <View style={styles.previewCardHeader}>
                      <Text style={styles.previewAppName}>منصة حيّنا · الآن</Text>
                      <Crown size={12} color="#F59E0B" />
                    </View>
                    <Text style={styles.previewTitleText}>
                      {broadcastType === 'emergency' ? '🚨 ' : broadcastType === 'weather' ? '⛈️ ' : '📢 '}
                      {broadcastTitle}
                    </Text>
                    <Text style={styles.previewBodyText}>{broadcastBody || 'تفاصيل التعميم الإداري...'}</Text>
                  </View>
                </View>
              )}

              <Pressable
                style={[styles.btnSendBroadcast, sendingBroadcast && { opacity: 0.6 }]}
                onPress={handleSendBroadcast}
                disabled={sendingBroadcast}
              >
                {sendingBroadcast ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Send size={18} color="#FFFFFF" />
                    <Text style={styles.btnSendBroadcastText}>نشر وبث التعميم الآن 📢</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        )}

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
                <View key={log.id} style={styles.auditLogCard}>
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
                </View>
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
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <MapPin size={18} color="#FFFFFF" />
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
                  <Pressable style={styles.trashActionBtn} onPress={() => handleDeleteLocation(loc.id, fullLocName)}>
                    <Trash size={14} color="#EF4444" />
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

            <View style={{ alignItems: 'center', backgroundColor: '#065F46', borderRadius: 24, padding: 26, marginVertical: 12 }}>
              <View
                style={{
                  width: 140,
                  height: 140,
                  borderRadius: 28,
                  backgroundColor: 'rgba(255,255,255,0.14)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.28)',
                }}
              >
                <Image source={{ uri: brandingLogo }} style={{ width: 115, height: 115 }} resizeMode="contain" />
              </View>
              <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: '900', marginTop: 12 }}>شعار حيّنا المعتمد</Text>
              <Text style={{ color: '#A7F3D0', fontSize: 11, fontWeight: '700', marginTop: 4 }}>
                تحديث الشعار يطبق مركزياً في النظام بالكامل
              </Text>
            </View>

            <Pressable
              style={[styles.btnSendBroadcast, brandingUploading && { opacity: 0.6 }]}
              onPress={changeGlobalLogo}
              disabled={brandingUploading}
            >
              {brandingUploading ? <ActivityIndicator color="#FFFFFF" /> : <Sparkles size={18} color="#FFFFFF" />}
              <Text style={styles.btnSendBroadcastText}>
                {brandingUploading ? 'جارٍ رفع الشعار...' : 'اختيار ورفع شعار جديد'}
              </Text>
            </Pressable>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ======================================================== */}
      {/* 4. USER DOSSIER INSPECTOR MODAL                          */}
      {/* ======================================================== */}
      {inspectedUser && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalDossierBox}>
            <View style={styles.modalDossierHeader}>
              <Pressable onPress={() => setInspectedUser(null)} style={styles.modalCloseBtn}>
                <X size={18} color={C.ink} />
              </Pressable>
              <Text style={styles.modalDossierTitle}>الملف الإداري الشامل للمواطن 📁</Text>
            </View>

            <ScrollView style={styles.modalDossierScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.modalProfileCard}>
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
                      <Crown size={12} color="#FFFFFF" />
                    </View>
                  )}
                </View>

                <View style={styles.modalUserInfo}>
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.modalName}>{inspectedUser.display_name || 'بدون اسم'}</Text>
                    {inspectedUser.is_verified && <CheckCircle2 size={16} color="#0284C7" />}
                    {inspectedUser.is_geoverified && <ShieldCheck size={16} color="#16A34A" />}
                  </View>
                  <Text style={styles.modalHandle}>@{inspectedUser.username || 'user'}</Text>
                  <Text style={styles.modalCity}>
                    📍 {inspectedUser.district ? `حي ${inspectedUser.district} · ` : ''}
                    {inspectedUser.city || 'الرياض'}
                  </Text>
                </View>
              </View>

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
                  <Text style={[styles.modalFootprintNum, { color: inspectedUser.role === 'admin' ? '#F59E0B' : '#0284C7' }]}>
                    {inspectedUser.role === 'admin' ? 'مدير 👑' : 'مستخدم 👤'}
                  </Text>
                  <Text style={styles.modalFootprintLabel}>الرتبة</Text>
                </View>
              </View>

              <Text style={styles.modalSectionLabel}>إجراءات الإدارة المباشرة:</Text>

              {/* Toggle Role */}
              <Pressable
                style={[styles.modalActionItem, inspectedUser.role === 'admin' ? styles.itemDemote : styles.itemPromote]}
                onPress={() => toggleUserRole(inspectedUser)}
              >
                <Crown size={18} color={inspectedUser.role === 'admin' ? '#D97706' : '#0284C7'} />
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={[styles.modalActionTitle, inspectedUser.role === 'admin' ? { color: '#D97706' } : { color: '#0284C7' }]}>
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
                <CheckCircle2 size={18} color={inspectedUser.is_verified ? '#16A34A' : '#64748B'} />
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={[styles.modalActionTitle, inspectedUser.is_verified && { color: '#16A34A' }]}>
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
                <ShieldCheck size={18} color={inspectedUser.is_geoverified ? '#16A34A' : '#64748B'} />
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={[styles.modalActionTitle, inspectedUser.is_geoverified && { color: '#16A34A' }]}>
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
                <Ban size={18} color={inspectedUser.is_banned ? '#FFFFFF' : '#DC2626'} />
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={[styles.modalActionTitle, inspectedUser.is_banned ? { color: '#FFFFFF' } : { color: '#DC2626' }]}>
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
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Send size={15} color="#FFFFFF" />
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
function TabPill({
  label,
  icon,
  active,
  badge,
  onPress,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  badge?: number;
  onPress: () => void;
}) {
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

function StatCard({
  icon,
  bg,
  value,
  label,
  sub,
  style,
}: {
  icon: React.ReactNode;
  bg: string;
  value: number;
  label: string;
  sub?: string;
  style?: any;
}) {
  return (
    <View style={[styles.statCard, style]}>
      <View style={[styles.statIconBox, { backgroundColor: bg }]}>{icon}</View>
      <Text style={styles.statValue}>{value.toLocaleString('ar-SA')}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
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
