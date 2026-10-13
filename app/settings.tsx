import React, { useEffect, useState, useMemo } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
  ActivityIndicator,
  TextInput,
  Image,
  Modal,
  Platform,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { AppHeader } from '@/components/shared/AppHeader';
import { useBottomNavInset } from '@/lib/bottomNav';
import { registerPushToken, syncDndWithNotifications, unregisterPushToken } from '@/lib/notifications';
import { verifyGPSInDistrict } from '@/lib/nationalAddress';
import { getCurrentDeviceLocation, reverseGeocodeDeviceLocation } from '@/lib/deviceLocation';
import { savePermanentMyLocation } from '@/lib/locationSync';
import {
  DEFAULT_DND,
  DndSettings,
  checkChatControlsReady,
  displayName as getDisplayName,
  dndLabel,
  formatArabicTime,
  isDndActiveNow,
  loadBlockedUsers,
  loadDnd,
  saveDnd,
  setBlock,
} from '@/lib/chatControls';
import {
  Lock,
  Mail,
  KeyRound,
  Shield,
  ShieldCheck,
  Eye,
  MessageCircle,
  Sparkles,
  Bell,
  BellOff,
  Moon,
  Clock,
  Compass,
  MapPin,
  UserX,
  LogOut,
  CheckCircle2,
  Crown,
  ChevronLeft,
  ChevronDown,
  RefreshCw,
  FileText,
  Trash2,
  Info,
  BadgeCheck,
  User,
  Settings,
} from 'lucide-react-native';

type SettingsCategory = 'all' | 'security' | 'privacy' | 'location' | 'notifications' | 'blocked' | 'system';

export default function SettingsScreen() {
  const bottomNavInset = useBottomNavInset();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<SettingsCategory>('all');

  // User Profile
  const [profile, setProfile] = useState<any>(null);
  const [role, setRole] = useState<string>('user');

  // Security
  const [email, setEmail] = useState('');
  const [emailDraft, setEmailDraft] = useState('');
  const [showEmailChange, setShowEmailChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [accountSaving, setAccountSaving] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Privacy & Community
  const [profilePrivacy, setProfilePrivacy] = useState<'public' | 'private'>('public');
  const [allowDms, setAllowDms] = useState<'everyone' | 'followers' | 'nobody'>('everyone');
  const [allowStoryReplies, setAllowStoryReplies] = useState<'everyone' | 'followers' | 'nobody'>('everyone');
  const [hideName, setHideName] = useState(false);

  // Location & Verification
  const [region, setRegion] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [locating, setLocating] = useState(false);
  const [geoVerified, setGeoVerified] = useState(false);
  const [geoChecking, setGeoChecking] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'none' | 'pending' | 'verified' | 'rejected'>('none');
  const [verificationModalOpen, setVerificationModalOpen] = useState(false);
  const [verificationSubmitting, setVerificationSubmitting] = useState(false);
  const [documentType, setDocumentType] = useState<'national_id' | 'iqama' | 'freelance'>('national_id');

  // Do-Not-Disturb & Notifications
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [dnd, setDnd] = useState<DndSettings>(DEFAULT_DND);
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [draftStart, setDraftStart] = useState('22:00');
  const [draftEnd, setDraftEnd] = useState('07:00');
  const [showCustom, setShowCustom] = useState(false);
  const [controlsReady, setControlsReady] = useState<boolean | null>(null);

  // UI helpers
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData?.session?.user;
      if (!user) {
        setLoading(false);
        return;
      }
      setUserId(user.id);
      setEmail(user.email || '');
      setEmailDraft(user.email || '');

      const profRes = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
      const prof = profRes.data;
      if (prof) {
        setProfile(prof);
        setProfilePrivacy(prof.profile_privacy || 'public');
        setAllowDms(prof.allow_dms || 'everyone');
        setAllowStoryReplies(prof.allow_story_replies || 'everyone');
        setHideName(Boolean(prof.hide_name));
        setRole(prof.role || 'user');
        setRegion(prof.region || '');
        setCity(prof.city || '');
        setDistrict(prof.district || '');
        setGeoVerified(Boolean(prof.is_geoverified));
        if (prof.is_verified) setVerificationStatus('verified');
      }

      const pushRes = await supabase
        .from('push_tokens')
        .select('id')
        .eq('user_id', user.id)
        .eq('platform', Platform.OS)
        .limit(1);
      setPushEnabled(Boolean(pushRes.data?.length));

      try {
        const { data: verificationData } = await supabase
          .from('verification_requests')
          .select('status')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1);
        const latestRequest = verificationData?.[0];
        if (latestRequest && !prof?.is_verified) {
          setVerificationStatus(
            latestRequest.status === 'approved'
              ? 'verified'
              : latestRequest.status === 'rejected'
              ? 'rejected'
              : 'pending'
          );
        }
      } catch (e) {}

      try {
        const dndRes = await loadDnd(user.id);
        setDnd(dndRes);
        setDraftStart(dndRes.start || '22:00');
        setDraftEnd(dndRes.end || '07:00');
      } catch (e) {}

      try {
        const blockedRes = await loadBlockedUsers(user.id);
        setBlockedUsers((blockedRes || []).filter(Boolean));
      } catch (e) {}

      try {
        setControlsReady(await checkChatControlsReady());
      } catch (e) {
        setControlsReady(null);
      }
    } catch (err) {
      console.log('Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  }

  // 1. Change Email
  async function changeEmail() {
    const nextEmail = emailDraft.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(nextEmail)) return Alert.alert('البريد غير صالح', 'أدخل بريداً إلكترونياً صالحاً.');
    if (nextEmail === email.toLowerCase()) return Alert.alert('لا يوجد تغيير', 'هذا هو البريد المسجل حالياً.');
    setAccountSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: nextEmail });
      if (error) throw error;
      showToast('تم إرسال رابط تأكيد إلى بريدك الجديد');
      setShowEmailChange(false);
    } catch (error: any) {
      Alert.alert('تعذّر تغيير البريد', error?.message || 'حدث خطأ أثناء إرسال طلب التغيير.');
    } finally {
      setAccountSaving(false);
    }
  }

  // 2. Change Password
  async function changePassword() {
    if (newPassword.length < 8) return Alert.alert('كلمة المرور قصيرة', 'استخدم 8 أحرف على الأقل.');
    if (newPassword !== confirmPassword) return Alert.alert('كلمتا المرور غير متطابقتين', 'أعد كتابة كلمة المرور نفسها في الحقلين.');
    setAccountSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordChange(false);
      showToast('تم تحديث كلمة المرور بنجاح 🔒');
    } catch (error: any) {
      Alert.alert('تعذّر تغيير كلمة المرور', error?.message || 'حدث خطأ أثناء تحديث كلمة المرور.');
    } finally {
      setAccountSaving(false);
    }
  }

  // 3. Location update
  async function useCurrentLocation() {
    if (locating) return;
    setLocating(true);
    try {
      const location = await getCurrentDeviceLocation();
      if (!location) {
        Alert.alert('تعذّر تحديد الموقع', 'اسمح لحيّنا بالوصول إلى موقعك ثم حاول مرة أخرى.');
        return;
      }
      const place = await reverseGeocodeDeviceLocation(location);
      const nextRegion = place?.region || '';
      const nextCity = place?.city || '';
      const nextDistrict = place?.district || '';
      if (!nextRegion || !nextCity || !nextDistrict) {
        Alert.alert('الموقع غير مكتمل', 'يجب أن نستخرج المنطقة والمدينة والحي حتى يتم حفظ موقعك بشكل صحيح.');
        return;
      }
      if (!userId) return;
      await savePermanentMyLocation({ region: nextRegion, city: nextCity, district: nextDistrict }, true, { allowCityChange: true });
      const { data: updated, error } = await supabase
        .from('profiles')
        .update({ region: nextRegion, city: nextCity, district: nextDistrict })
        .eq('id', userId)
        .select('id, region, city, district')
        .maybeSingle();
      if (error) throw error;
      setRegion(nextRegion);
      setCity(nextCity);
      setDistrict(nextDistrict);
      showToast('تم تحديث موقعك المعتمد بنجاح 📍');
    } catch (error: any) {
      Alert.alert('تعذّر تحديث الموقع', error?.message || 'حاول مرة أخرى.');
    } finally {
      setLocating(false);
    }
  }

  // 4. Resident GPS check
  async function verifyResidentGPS() {
    if (!city || !district) return Alert.alert('حدد موقعك أولاً', 'اختر المدينة والحي من الملف الشخصي ثم أعد الفحص.');
    setGeoChecking(true);
    try {
      const location = await getCurrentDeviceLocation();
      if (!location) throw new Error('اسمح لحيّنا بالوصول إلى موقعك من إعدادات الجهاز ثم أعد المحاولة.');
      const result = verifyGPSInDistrict(location.latitude, location.longitude, city, district);
      if (!result.isVerified) return Alert.alert('لم ينجح الفحص', result.message);
      if (!userId) throw new Error('يلزم تسجيل الدخول.');
      const { error } = await supabase.from('profiles')
        .update({ is_geoverified: true, geoverified_at: new Date().toISOString() })
        .eq('id', userId);
      if (error) throw error;
      setGeoVerified(true);
      showToast('تم التحقق من موقعك بنجاح ✓');
    } catch (error: any) {
      Alert.alert('تعذّر التحقق من الموقع', error?.message || 'تحقق من خدمة الموقع ثم أعد المحاولة.');
    } finally {
      setGeoChecking(false);
    }
  }

  // 5. Submit Official ID Verification
  async function submitVerificationRequest() {
    if (!userId) return;
    const docLabels = { national_id: 'الهوية الوطنية', iqama: 'هوية مقيم', freelance: 'وثيقة العمل الحر / سجل تجاري' };
    setVerificationSubmitting(true);
    try {
      const { error } = await supabase.from('verification_requests').insert({
        user_id: userId,
        note: `نوع الوثيقة: ${docLabels[documentType]}`,
        status: 'pending',
      });
      if (error) throw error;
      setVerificationStatus('pending');
      setVerificationModalOpen(false);
      showToast('تم رفع طلب التوثيق للمراجعة الإدارية 🛡️');
    } catch (error: any) {
      Alert.alert('تعذّر إرسال الطلب', error?.message || 'لم يُسجل الطلب. حاول مجدداً.');
    } finally {
      setVerificationSubmitting(false);
    }
  }

  // 6. Generic privacy/DM save
  async function saveSettings(
    newPrivacy?: 'public' | 'private',
    newDms?: 'everyone' | 'followers' | 'nobody',
    newReplies?: 'everyone' | 'followers' | 'nobody',
    newHideName?: boolean
  ) {
    if (!userId) return false;
    setSaving(true);
    const updatePayload: any = {
      profile_privacy: newPrivacy ?? profilePrivacy,
      allow_dms: newDms ?? allowDms,
      allow_story_replies: newReplies ?? allowStoryReplies,
      hide_name: newHideName ?? hideName,
    };
    try {
      const { data, error } = await supabase.from('profiles').update(updatePayload).eq('id', userId).select('id').maybeSingle();
      if (error || !data) throw error || new Error('تعذر الحفظ');
      setProfilePrivacy(updatePayload.profile_privacy);
      setAllowDms(updatePayload.allow_dms);
      setAllowStoryReplies(updatePayload.allow_story_replies);
      setHideName(updatePayload.hide_name);
      setProfile((current: any) => current ? { ...current, ...updatePayload } : current);
      showToast('تم حفظ الإعداد ✓');
      return true;
    } catch (e: any) {
      Alert.alert('تعذّر حفظ الإعداد', e?.message || 'حدث خطأ أثناء حفظ التغيير.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  // 7. Toggle Private Account
  async function togglePrivateAccount(val: boolean) {
    const nextVal = val ? 'private' : 'public';
    setProfilePrivacy(nextVal);
    if (!(await saveSettings(nextVal))) setProfilePrivacy(val ? 'public' : 'private');
  }

  // 8. Toggle Anonymous Posts
  async function toggleHideName(val: boolean) {
    setHideName(val);
    if (!(await saveSettings(undefined, undefined, undefined, val))) setHideName(!val);
  }

  // 9. Push notifications
  async function activatePushNotifications() {
    try {
      const token = await registerPushToken();
      if (!token) {
        Alert.alert('تعذّر التفعيل', 'لم يتم منح إذن الإشعارات أو لا يدعم هذا الجهاز تسجيل الإشعارات الفورية.');
        return;
      }
      setPushEnabled(true);
      showToast('تم تفعيل إشعارات الجوال الفورية 🔔');
    } catch (error: any) {
      Alert.alert('تعذّر التفعيل', error?.message || 'تعذر تسجيل هذا الجهاز.');
    }
  }

  async function togglePushNotifications() {
    if (!pushEnabled) {
      await activatePushNotifications();
      return;
    }
    if (pushBusy) return;
    setPushBusy(true);
    try {
      await unregisterPushToken();
      setPushEnabled(false);
      showToast('تم إيقاف إشعارات هذا النوع من الأجهزة');
    } catch (error: any) {
      Alert.alert('تعذّر إيقاف الإشعارات', error?.message || 'حاول مرة أخرى.');
    } finally {
      setPushBusy(false);
    }
  }

  // 10. DND Schedule
  async function applyDnd(next: DndSettings, keepCustomOpen = false) {
    if (!userId) return;
    const result = await saveDnd(userId, next);
    if (!result.ok) {
      Alert.alert('تعذّر الحفظ', result.error);
      return;
    }
    setDnd(next);
    setShowCustom(keepCustomOpen);
    await syncDndWithNotifications(userId);
    showToast('تم تحديث جدول عدم الإزعاج 🔕');
  }

  // 11. Unblock User
  async function unblockUser(targetId: string, name: string) {
    if (!userId) return;
    Alert.alert('إلغاء الحظر', `هل تريد السماح لـ ${name} بمراسلتك والتفاعل معك؟`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'إلغاء الحظر',
        onPress: async () => {
          const result = await setBlock(userId, targetId, false);
          if (!result.ok) return Alert.alert('خطأ', result.error);
          setBlockedUsers((prev) => prev.filter((b: any) => b.id !== targetId));
          showToast('تم فك الحظر بنجاح');
        },
      },
    ]);
  }

  // 12. Sign Out
  const handleSignOut = () => {
    Alert.alert('تسجيل الخروج', 'هل أنت متأكد من رغبتك في تسجيل الخروج من تطبيق حيّنا؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'تسجيل الخروج',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/auth');
        },
      },
    ]);
  };

  function confirmAccountDeletion() {
    const confirmDelete = () => {
      if (deletingAccount) return;
      setDeletingAccount(true);
      void (async () => {
        try {
          const { error } = await supabase.functions.invoke('delete-account');
          if (error) throw error;
          await supabase.auth.signOut({ scope: 'local' });
          router.replace('/auth');
        } catch (error: any) {
          Alert.alert('تعذّر حذف الحساب', error?.message || 'لم يتم حذف الحساب. حاول مرة أخرى.');
        } finally {
          setDeletingAccount(false);
        }
      })();
    };

    const showFinalConfirmation = () => {
      if (Platform.OS === 'web' && typeof globalThis.confirm === 'function') {
        if (globalThis.confirm('سيتم حذف حسابك وبياناته نهائيًا ولا يمكن التراجع. هل تريد المتابعة؟')) confirmDelete();
        return;
      }
      Alert.alert('تأكيد حذف الحساب نهائيًا', 'سيتم حذف حسابك وبياناته نهائيًا ولا يمكن التراجع عن هذا الإجراء.', [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'حذف نهائيًا', style: 'destructive', onPress: confirmDelete },
      ]);
    };

    if (Platform.OS === 'web' && typeof globalThis.confirm === 'function') {
      if (globalThis.confirm('هل أنت متأكد من رغبتك في حذف حسابك نهائيًا؟')) showFinalConfirmation();
      return;
    }
    Alert.alert('حذف الحساب', 'سيؤدي هذا إلى حذف الحساب والملف الشخصي والبيانات المرتبطة به نهائيًا.', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'متابعة', style: 'destructive', onPress: showFinalConfirmation },
    ]);
  }

  const CATEGORIES: Array<{ key: Exclude<SettingsCategory, 'all'>; label: string; description: string; icon: any }> = [
    { key: 'security', label: 'الحساب والأمان', description: 'البريد الإلكتروني وكلمة المرور', icon: Lock },
    { key: 'privacy', label: 'الخصوصية', description: 'ظهور ملفك والرسائل والقصص', icon: Shield },
    { key: 'notifications', label: 'الإشعارات', description: 'تنبيهات الجوال وأوقات الهدوء', icon: Bell },
    { key: 'location', label: 'الموقع والتوثيق', description: 'المدينة والحي والتحقق من الحساب', icon: MapPin },
    { key: 'blocked', label: 'المحظورون', description: 'إدارة الحسابات التي حظرتها', icon: UserX },
    { key: 'system', label: 'حول حيّنا', description: 'معلومات التطبيق والخصوصية', icon: Info },
  ];

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#059669" />
        <Text style={styles.loadingText}>جاري تجهيز مركز الإعدادات والمميزات...</Text>
      </View>
    );
  }

  const isDndCurrentlyActive = dnd.enabled && isDndActiveNow(dnd);
  const showSec = (cat: SettingsCategory) => activeCategory === cat;
  const selectedCategory = CATEGORIES.find((category) => category.key === activeCategory);

  return (
    <View style={styles.screen}>
      <AppHeader
        variant="sub"
        title="مركز الإعدادات والتحكم"
        subtitle="الخصوصية، الأمان، وإدارة الحساب"
        fallbackRoute="/home"
        rightAction={
          <Pressable
            style={styles.headerBtn}
            onPress={() => router.push('/profile')}
            accessibilityRole="button"
            accessibilityLabel="الملف الشخصي"
          >
            <User size={18} color="#059669" />
          </Pressable>
        }
      />

      {/* Toast Alert Banner */}
      {toastMessage && (
        <View style={styles.toast}>
          <CheckCircle2 size={16} color="#ffffff" />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomNavInset + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {activeCategory === 'all' ? (
          <>
            <View style={styles.navSegmentContainer}>
              <View style={styles.navSegmentWrap}>
                <Pressable style={styles.navSegmentBtn} onPress={() => router.push('/profile')}>
                  <User size={14} color="#64748b" />
                  <Text style={styles.navSegmentText}>الملف الشخصي</Text>
                </Pressable>
                <Pressable style={[styles.navSegmentBtn, styles.navSegmentBtnActive]}>
                  <Settings size={14} color="#fff" />
                  <Text style={[styles.navSegmentText, styles.navSegmentTextActive]}>الإعدادات</Text>
                </Pressable>
              </View>
            </View>

            {profile && (
              <Pressable
                style={styles.settingsIdentityCard}
                onPress={() => router.push('/profile')}
                accessibilityRole="button"
                accessibilityLabel="عرض وتعديل الملف الشخصي"
              >
                <View style={styles.settingsAvatarWrap}>
                  {profile.avatar_url && !profile.avatar_url.includes('blank-profile-picture') ? (
                    <Image source={{ uri: profile.avatar_url }} style={styles.settingsAvatar} />
                  ) : (
                    <View style={styles.settingsAvatarFallback}>
                      <Text style={styles.settingsAvatarLetter}>
                        {(profile.display_name || profile.username || 'ح')[0].toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.settingsIdentityText}>
                  <View style={styles.settingsNameRow}>
                    <Text style={styles.settingsIdentityName} numberOfLines={1}>
                      {profile.display_name || profile.username || 'عضو حيّنا'}
                    </Text>
                    {profile.is_verified && <BadgeCheck size={16} color="#25a56a" />}
                  </View>
                  <Text style={styles.settingsIdentityAbout} numberOfLines={1}>
                    {profile.bio || `@${profile.username || 'neighbor'} · اضغط لتعديل ملفك`}
                  </Text>
                  <Text style={styles.settingsIdentityLocation} numberOfLines={1}>
                    {[profile.district && `حي ${profile.district}`, profile.city].filter(Boolean).join(' · ') || 'المملكة العربية السعودية'}
                  </Text>
                </View>
                <ChevronLeft size={18} color="#94a3b8" />
              </Pressable>
            )}

            <View style={styles.preferenceMenu}>
              <Text style={styles.preferenceSectionTitle}>إعدادات الحساب</Text>
              {CATEGORIES.map(({ key, label, description, icon: Icon }, index) => {
                const detail = key === 'blocked' && blockedUsers.length
                  ? `${blockedUsers.length} حساب محظور`
                  : key === 'notifications' && dnd.enabled
                    ? dndLabel(dnd)
                    : description;
                return (
                  <React.Fragment key={key}>
                    <Pressable
                      style={styles.preferenceRow}
                      onPress={() => setActiveCategory(key)}
                      accessibilityRole="button"
                    >
                      <View style={styles.preferenceIcon}>
                        <Icon size={19} color="#128c7e" />
                      </View>
                      <View style={styles.preferenceCopy}>
                        <Text style={styles.preferenceTitle}>{label}</Text>
                        <Text style={styles.preferenceDescription} numberOfLines={1}>{detail}</Text>
                      </View>
                      <ChevronLeft size={17} color="#a3adb7" />
                    </Pressable>
                    {index < CATEGORIES.length - 1 && <View style={styles.preferenceDivider} />}
                  </React.Fragment>
                );
              })}
            </View>
          </>
        ) : (
          <View style={styles.preferenceDetailHeader}>
            <Pressable
              style={styles.preferenceBackButton}
              onPress={() => setActiveCategory('all')}
              accessibilityRole="button"
              accessibilityLabel="العودة إلى الإعدادات"
            >
              <ChevronRight size={18} color="#128c7e" />
            </Pressable>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={styles.preferenceDetailTitle}>{selectedCategory?.label}</Text>
              <Text style={styles.preferenceDetailDescription}>{selectedCategory?.description}</Text>
            </View>
          </View>
        )}

        {/* 1. قسم الأمان والدخول (Security & Auth) */}
        {showSec('security') && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardHeaderIcon, { backgroundColor: '#eff6ff' }]}>
                <Lock size={18} color="#2563eb" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardHeaderTitle}>بيانات الدخول والأمان</Text>
                <Text style={styles.cardHeaderDesc}>البريد الإلكتروني، كلمة المرور، وتأمين الجلسة</Text>
              </View>
            </View>

            {/* Email Setting */}
            <View style={styles.settingBlock}>
              <View style={styles.settingBlockHead}>
                <View>
                  <Text style={styles.blockTitle}>البريد الإلكتروني المسجل</Text>
                  <Text style={styles.blockValue}>{email || 'لا يوجد بريد مسجل'}</Text>
                </View>
                <Pressable
                  style={styles.actionOutlineBtn}
                  onPress={() => setShowEmailChange(!showEmailChange)}
                >
                  <Text style={styles.actionOutlineText}>{showEmailChange ? 'إلغاء' : 'تغيير البريد'}</Text>
                </Pressable>
              </View>

              {showEmailChange && (
                <View style={styles.expandableBox}>
                  <Text style={styles.inputLabel}>أدخل البريد الإلكتروني الجديد</Text>
                  <TextInput
                    style={styles.textInput}
                    value={emailDraft}
                    onChangeText={setEmailDraft}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholder="example@hayna.app"
                    placeholderTextColor="#94a3b8"
                  />
                  <Pressable style={styles.primaryActionBtn} onPress={changeEmail} disabled={accountSaving}>
                    {accountSaving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <Mail size={15} color="#fff" />
                        <Text style={styles.primaryActionText}>إرسال رابط تأكيد التغيير</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              )}
            </View>

            <View style={styles.cardDivider} />

            {/* Password Setting */}
            <View style={styles.settingBlock}>
              <View style={styles.settingBlockHead}>
                <View>
                  <Text style={styles.blockTitle}>كلمة المرور والحماية</Text>
                  <Text style={styles.blockValue}>••••••••••••</Text>
                </View>
                <Pressable
                  style={styles.actionOutlineBtn}
                  onPress={() => setShowPasswordChange(!showPasswordChange)}
                >
                  <Text style={styles.actionOutlineText}>{showPasswordChange ? 'إلغاء' : 'تغيير كلمة المرور'}</Text>
                </Pressable>
              </View>

              {showPasswordChange && (
                <View style={styles.expandableBox}>
                  <Text style={styles.inputLabel}>كلمة المرور الجديدة (8 أحرف على الأقل)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    placeholder="كلمة مرور قوية جديدة"
                    placeholderTextColor="#94a3b8"
                  />
                  <Text style={styles.inputLabel}>تأكيد كلمة المرور</Text>
                  <TextInput
                    style={styles.textInput}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    placeholder="أعد إدخال كلمة المرور"
                    placeholderTextColor="#94a3b8"
                  />
                  <Pressable style={styles.primaryActionBtn} onPress={changePassword} disabled={accountSaving}>
                    {accountSaving ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <>
                        <KeyRound size={15} color="#fff" />
                        <Text style={styles.primaryActionText}>تحديث كلمة المرور</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        )}

        {/* 2. قسم الخصوصية والمجتمع (Privacy & Community) */}
        {showSec('privacy') && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardHeaderIcon, { backgroundColor: '#f0fdf4' }]}>
                <Shield size={18} color="#059669" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardHeaderTitle}>خصوصية الحساب والتواصل</Text>
                <Text style={styles.cardHeaderDesc}>التحكم في ظهور بياناتك والمراسلات بين الجيران</Text>
              </View>
            </View>

            {/* قفل الملف الشخصي */}
            <View style={styles.toggleRow}>
              <View style={{ flex: 1, paddingLeft: 12 }}>
                <Text style={styles.toggleTitle}>قفل الملف الشخصي (حساب خاص)</Text>
                <Text style={styles.toggleDesc}>
                  عند القفل، لا يمكن للغرباء مشاهدة قائمة نشاطك أو إسهاماتك إلا بعد متابعتهم لك.
                </Text>
              </View>
              <Switch
                value={profilePrivacy === 'private'}
                onValueChange={togglePrivateAccount}
                trackColor={{ false: '#e2e8f0', true: '#a7f3d0' }}
                thumbColor={profilePrivacy === 'private' ? '#059669' : '#94a3b8'}
              />
            </View>

            <View style={styles.cardDivider} />

            {/* المشاركة باسم مجهول */}
            <View style={styles.toggleRow}>
              <View style={{ flex: 1, paddingLeft: 12 }}>
                <Text style={styles.toggleTitle}>المشاركة باسم مجهول في الاستفسارات</Text>
                <Text style={styles.toggleDesc}>
                  يظهر اسمك كـ "جار مجهول" عند طرح الأسئلة والنقاشات لحفظ الخصوصية.
                </Text>
              </View>
              <Switch
                value={hideName}
                onValueChange={toggleHideName}
                trackColor={{ false: '#e2e8f0', true: '#a7f3d0' }}
                thumbColor={hideName ? '#059669' : '#94a3b8'}
              />
            </View>

            <View style={styles.cardDivider} />

            {/* من يراسلك بالخاص (DM) */}
            <View style={styles.optionsBlock}>
              <Text style={styles.optionsBlockTitle}>من يمكنه مراسلتك على الخاص (DM)؟</Text>
              <Text style={styles.optionsBlockDesc}>
                الرسائل الخاصة تعمل حصرياً بين سكان الحي والمدينة المتطابقين.
              </Text>
              <View style={styles.radioGroup}>
                {[
                  { id: 'everyone', title: 'الجميع', sub: 'أي جار من الحي يمكنه التواصل معك' },
                  { id: 'followers', title: 'المتابعون فقط', sub: 'فقط من يتابعك وتتابعه بالحي' },
                  { id: 'nobody', title: 'إيقاف الخاص تماماً', sub: 'لن يتمكن أي شخص من فتح محادثة جديدة' },
                ].map((opt) => (
                  <Pressable
                    key={opt.id}
                    style={[styles.radioCard, allowDms === opt.id && styles.radioCardActive]}
                    onPress={() => saveSettings(undefined, opt.id as any)}
                  >
                    <View style={styles.radioDotWrap}>
                      {allowDms === opt.id && <View style={styles.radioDot} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.radioLabel, allowDms === opt.id && styles.radioLabelActive]}>
                        {opt.title}
                      </Text>
                      <Text style={styles.radioSub}>{opt.sub}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.cardDivider} />

            {/* الردود على الستوري */}
            <View style={styles.optionsBlock}>
              <Text style={styles.optionsBlockTitle}>الردود على القصص والستوري</Text>
              <Text style={styles.optionsBlockDesc}>من يحق له كتابة ردود خاصة على قصصك المنشورة؟</Text>
              <View style={styles.radioGroup}>
                {[
                  { id: 'everyone', title: 'السماح للجميع بالرد' },
                  { id: 'followers', title: 'المتابعون فقط' },
                  { id: 'nobody', title: 'إيقاف الردود نهائياً' },
                ].map((opt) => (
                  <Pressable
                    key={opt.id}
                    style={[styles.radioCard, allowStoryReplies === opt.id && styles.radioCardActive]}
                    onPress={() => saveSettings(undefined, undefined, opt.id as any)}
                  >
                    <View style={styles.radioDotWrap}>
                      {allowStoryReplies === opt.id && <View style={styles.radioDot} />}
                    </View>
                    <Text style={[styles.radioLabel, allowStoryReplies === opt.id && styles.radioLabelActive]}>
                      {opt.title}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* 3. قسم الموقع والتوثيق (Location & Verification) */}
        {showSec('location') && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardHeaderIcon, { backgroundColor: '#ecfdf5' }]}>
                <Compass size={18} color="#059669" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardHeaderTitle}>الموقع الجغرافي والتوثيق</Text>
                <Text style={styles.cardHeaderDesc}>تثبيت موقع السكن الرسمي والتحقق من الهوية</Text>
              </View>
            </View>

            {/* Location Summary Box */}
            <View style={styles.locationSummaryBox}>
              <View style={styles.locItemRow}>
                <Text style={styles.locItemLabel}>المنطقة:</Text>
                <Text style={styles.locItemVal}>{region || 'المملكة العربية السعودية'}</Text>
              </View>
              <View style={styles.locItemRow}>
                <Text style={styles.locItemLabel}>المدينة:</Text>
                <Text style={styles.locItemVal}>{city || 'غير محددة'}</Text>
              </View>
              <View style={styles.locItemRow}>
                <Text style={styles.locItemLabel}>الحي المعتمد:</Text>
                <Text style={styles.locItemVal}>{district ? `حي ${district}` : 'غير محدد'}</Text>
              </View>
            </View>

            <Pressable style={styles.primaryActionBtn} onPress={useCurrentLocation} disabled={locating}>
              {locating ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <MapPin size={16} color="#fff" />
                  <Text style={styles.primaryActionText}>تحديث موقعي الفعلي عبر GPS</Text>
                </>
              )}
            </Pressable>

            <View style={styles.cardDivider} />

            {/* Resident GPS Verification */}
            <View style={styles.settingBlock}>
              <View style={styles.settingBlockHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.blockTitle}>فحص القرب الجغرافي للحي (GPS)</Text>
                  <Text style={styles.blockSubDesc}>
                    {geoVerified
                      ? 'تم التحقق من وجودك الجغرافي في الحي بنجاح ✓'
                      : 'فحص فوري يثبت تواجد جهازك الفعلي داخل النطاق الجغرافي للحي.'}
                  </Text>
                </View>
                <Pressable
                  style={[styles.actionOutlineBtn, geoVerified && { borderColor: '#10b981', backgroundColor: '#ecfdf5' }]}
                  onPress={verifyResidentGPS}
                  disabled={geoChecking || geoVerified}
                >
                  {geoChecking ? (
                    <ActivityIndicator size="small" color="#059669" />
                  ) : (
                    <Text style={[styles.actionOutlineText, geoVerified && { color: '#059669' }]}>
                      {geoVerified ? 'موثق ✓' : 'بدء الفحص'}
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>

            <View style={styles.cardDivider} />

            {/* Official ID Verification */}
            <View style={styles.settingBlock}>
              <View style={styles.settingBlockHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.blockTitle}>توثيق الهوية الرسمية 🛡️</Text>
                  <Text style={styles.blockSubDesc}>
                    {verificationStatus === 'verified'
                      ? 'حسابك موثّق بالهوية الوطنية المعتمدة من إدارة المنصة.'
                      : verificationStatus === 'pending'
                      ? 'طلب التوثيق قيد المراجعة والتدقيق الإداري حالياً.'
                      : 'توثيق الحساب بالهوية الوطنية أو وثيقة العمل الحر لرفع الثقة والمصداقية.'}
                  </Text>
                </View>
                <Pressable
                  style={[
                    styles.actionOutlineBtn,
                    verificationStatus === 'verified'
                      ? { borderColor: '#10b981', backgroundColor: '#ecfdf5' }
                      : verificationStatus === 'pending'
                      ? { borderColor: '#f59e0b', backgroundColor: '#fffbeb' }
                      : {},
                  ]}
                  onPress={() => setVerificationModalOpen(true)}
                  disabled={verificationStatus === 'verified' || verificationStatus === 'pending'}
                >
                  <Text
                    style={[
                      styles.actionOutlineText,
                      verificationStatus === 'verified'
                        ? { color: '#059669' }
                        : verificationStatus === 'pending'
                        ? { color: '#d97706' }
                        : {},
                    ]}
                  >
                    {verificationStatus === 'verified'
                      ? 'معتمد ✓'
                      : verificationStatus === 'pending'
                      ? 'قيد التدقيق ⏳'
                      : 'طلب التوثيق'}
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}

        {/* 4. قسم الإشعارات وعدم الإزعاج (Notifications & DND) */}
        {showSec('notifications') && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardHeaderIcon, { backgroundColor: '#fffbeb' }]}>
                <BellOff size={18} color="#d97706" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardHeaderTitle}>الإشعارات وعدم الإزعاج</Text>
                <Text style={styles.cardHeaderDesc}>التحكم في مواعيد صمت التنبيهات وإشعارات الجهاز</Text>
              </View>
            </View>

            {/* Push Notifications */}
            <View style={styles.toggleRow}>
              <View style={{ flex: 1, paddingLeft: 12 }}>
                <Text style={styles.toggleTitle}>إشعارات الجوال الفورية (Push)</Text>
                <Text style={styles.toggleDesc}>
                  {pushEnabled
                    ? 'الإشعارات مسجلة لهذا النوع من الأجهزة. يمكنك إيقاف إرسال التنبيهات إليه.'
                    : 'استقبل تنبيهات النداءات العاجلة والرسائل على هذا النوع من الأجهزة.'}
                </Text>
              </View>
              <Pressable
                style={[styles.actionOutlineBtn, pushEnabled && { borderColor: '#10b981', backgroundColor: '#ecfdf5' }]}
                onPress={togglePushNotifications}
                disabled={pushBusy}
              >
                {pushBusy ? <ActivityIndicator size="small" color="#059669" /> : (
                  <Text style={[styles.actionOutlineText, pushEnabled && { color: '#059669' }]}>
                    {pushEnabled ? 'إيقاف' : 'تفعيل'}
                  </Text>
                )}
              </Pressable>
            </View>

            <View style={styles.cardDivider} />

            {/* DND Master Switch */}
            <View style={styles.toggleRow}>
              <View style={{ flex: 1, paddingLeft: 12 }}>
                <Text style={styles.toggleTitle}>وضع عدم الإزعاج (DND) 🔕</Text>
                <Text style={styles.toggleDesc}>
                  {dndLabel(dnd)} {isDndCurrentlyActive ? '· صامت الآن 🌙' : ''}
                </Text>
              </View>
              <Switch
                value={dnd.enabled}
                onValueChange={(val) => applyDnd({ ...dnd, enabled: val })}
                trackColor={{ false: '#e2e8f0', true: '#fde68a' }}
                thumbColor={dnd.enabled ? '#d97706' : '#94a3b8'}
              />
            </View>

            {/* DND Modes */}
            {dnd.enabled && (
              <View style={styles.dndScheduleSection}>
                <View style={styles.dndPillsRow}>
                  <Pressable
                    style={[styles.dndPill, dnd.schedule === 'off' && styles.dndPillActive]}
                    onPress={() => applyDnd({ ...dnd, schedule: 'off' })}
                  >
                    <Text style={[styles.dndPillText, dnd.schedule === 'off' && styles.dndPillTextActive]}>
                      صامت دائماً
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[styles.dndPill, dnd.schedule === 'nightly' && styles.dndPillActive]}
                    onPress={() => applyDnd({ ...dnd, schedule: 'nightly' })}
                  >
                    <Moon size={13} color={dnd.schedule === 'nightly' ? '#fff' : '#64748b'} />
                    <Text style={[styles.dndPillText, dnd.schedule === 'nightly' && styles.dndPillTextActive]}>
                      ليلاً (22:00 - 07:00)
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[styles.dndPill, dnd.schedule === 'custom' && styles.dndPillActive]}
                    onPress={() => {
                      setShowCustom(!showCustom);
                      applyDnd({ ...dnd, schedule: 'custom' }, true);
                    }}
                  >
                    <Clock size={13} color={dnd.schedule === 'custom' ? '#fff' : '#64748b'} />
                    <Text style={[styles.dndPillText, dnd.schedule === 'custom' && styles.dndPillTextActive]}>
                      مخصص ⏱
                    </Text>
                  </Pressable>
                </View>

                {dnd.schedule === 'custom' && (
                  <View style={styles.customTimeBox}>
                    <View style={styles.customTimeInputs}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.timeLabel}>من الساعة:</Text>
                        <TextInput
                          style={styles.timeInput}
                          value={draftStart}
                          onChangeText={setDraftStart}
                          placeholder="22:00"
                          placeholderTextColor="#94a3b8"
                          maxLength={5}
                        />
                      </View>
                      <Text style={styles.timeSeparator}>إلى</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.timeLabel}>حتى الساعة:</Text>
                        <TextInput
                          style={styles.timeInput}
                          value={draftEnd}
                          onChangeText={setDraftEnd}
                          placeholder="07:00"
                          placeholderTextColor="#94a3b8"
                          maxLength={5}
                        />
                      </View>
                    </View>
                    <Pressable
                      style={styles.primaryActionBtn}
                      onPress={() => applyDnd({ enabled: true, schedule: 'custom', start: draftStart, end: draftEnd })}
                    >
                      <Text style={styles.primaryActionText}>حفظ الوقت المخصص</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* 5. قسم المحظورين (Blocked Users) */}
        {showSec('blocked') && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardHeaderIcon, { backgroundColor: '#fef2f2' }]}>
                <UserX size={18} color="#dc2626" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardHeaderTitle}>قائمة المستخدمين المحظورين</Text>
                <Text style={styles.cardHeaderDesc}>لن يتمكن المحظورون من مراسلتك أو التعليق على منشوراتك</Text>
              </View>
            </View>

            {blockedUsers.length === 0 ? (
              <View style={styles.emptyStateBox}>
                <ShieldCheck size={36} color="#a7f3d0" />
                <Text style={styles.emptyStateTitle}>لا يوجد مستخدمون محظورون</Text>
                <Text style={styles.emptyStateSub}>بيئة حيك نظيفة وآمنة بدون أي حسابات محظورة.</Text>
              </View>
            ) : (
              blockedUsers.map((b) => (
                <View key={b.id} style={styles.blockedRow}>
                  <View style={styles.blockedAvatar}>
                    {b.avatar_url && b.hide_name !== true ? (
                      <Image source={{ uri: b.avatar_url }} style={styles.blockedAvatarImg} />
                    ) : (
                      <Text style={styles.blockedAvatarTxt}>{(b.display_name || b.username || '؟')[0]}</Text>
                    )}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.blockedName}>{getDisplayName(b)}</Text>
                    <Text style={styles.blockedDate}>محظور منذ فترة</Text>
                  </View>
                  <Pressable
                    style={styles.unblockBtn}
                    onPress={() => unblockUser(b.id, getDisplayName(b))}
                  >
                    <Text style={styles.unblockBtnText}>إلغاء الحظر</Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>
        )}

        {/* 6. بوابة المشرفين والإدارة (Admin Operational Center) */}
        {role === 'admin' && activeCategory === 'system' && (
          <Pressable
            style={styles.adminBannerCard}
            onPress={() => router.push('/admin')}
          >
            <LinearGradient
              colors={['#1e1b4b', '#312e81', '#4338ca']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.adminBannerGrad}
            >
              <View style={styles.adminBannerIcon}>
                <Crown size={22} color="#f59e0b" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.adminBannerTitle}>مركز عمليات وإدارة حيّنا 👑</Text>
                <Text style={styles.adminBannerSub}>
                  مراقبة المنصة، البلاغات، التحقق، حوكمة الميزات، والبث المجتمعي
                </Text>
              </View>
              <ChevronLeft size={20} color="#c7d2fe" />
            </LinearGradient>
          </Pressable>
        )}

        {/* 7. معلومات النظام وحماية البيانات (System & Compliance) */}
        {showSec('system') && (
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={[styles.cardHeaderIcon, { backgroundColor: '#f1f5f9' }]}>
                <Info size={18} color="#475569" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardHeaderTitle}>معلومات المنصة والامتثال</Text>
                <Text style={styles.cardHeaderDesc}>الخصوصية، الإصدار، ونظام حماية البيانات</Text>
              </View>
            </View>

            <View style={styles.complianceBox}>
              <ShieldCheck size={18} color="#059669" />
              <Text style={styles.complianceText}>
                منصة حيّنا متوافقة مع ضوابط نظام حماية البيانات الشخصية (PDPL) بالمملكة العربية السعودية 🇸🇦
              </Text>
            </View>

            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>إصدار التطبيق:</Text>
              <Text style={styles.metaValue}>2.0.4 (Executive Release)</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>خادم البيانات:</Text>
              <Text style={styles.metaValue}>Supabase Cloud (المملكة والشرق الأوسط)</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>لغة الواجهة:</Text>
              <Text style={styles.metaValue}>العربية (المملكة العربية السعودية)</Text>
            </View>

            {/* Link to Dedicated About & Developer Page */}
            <Pressable
              style={{
                flexDirection: 'row-reverse',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: '#ecfdf5',
                borderWidth: 1,
                borderColor: '#a7f3d0',
                padding: 12,
                borderRadius: 14,
                marginTop: 12,
              }}
              onPress={() => router.push('/about')}
            >
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8 }}>
                <ShieldCheck size={18} color="#059669" />
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 13, fontWeight: '900', color: '#065f46' }}>
                    حول المنصة ومطور التطبيق
                  </Text>
                  <Text style={{ fontSize: 11, color: '#047857', marginTop: 1 }}>
                    م. يوسف الحازمي — الرؤية والاتصال المباشر (0538243481)
                  </Text>
                </View>
              </View>
              <ChevronLeft size={16} color="#059669" />
            </Pressable>
          </View>
        )}

        {/* 8. تسجيل الخروج (Sign Out) */}
        {(activeCategory === 'all' || activeCategory === 'security') && (
          <>
            <Pressable style={styles.signOutBtn} onPress={handleSignOut}>
              <LogOut size={18} color="#ef4444" />
              <Text style={styles.signOutText}>تسجيل الخروج من الحساب</Text>
            </Pressable>
            <Pressable
              style={[styles.deleteAccountBtn, deletingAccount && styles.deleteAccountBtnDisabled]}
              onPress={confirmAccountDeletion}
              disabled={deletingAccount}
              accessibilityRole="button"
              accessibilityLabel="حذف الحساب نهائيًا"
            >
              {deletingAccount ? <ActivityIndicator size="small" color="#b91c1c" /> : <Trash2 size={18} color="#b91c1c" />}
              <Text style={styles.deleteAccountText}>{deletingAccount ? 'جارٍ حذف الحساب...' : 'حذف الحساب نهائيًا'}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      {/* Verification Request Modal */}
      <Modal
        visible={verificationModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setVerificationModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ShieldCheck size={28} color="#059669" />
              <Text style={styles.modalTitle}>طلب توثيق الحساب بالهوية</Text>
              <Text style={styles.modalSub}>
                اختر نوع الوثيقة لرفع طلبك إلى إدارة المنصة. لا ترسل صورة الوثيقة أو أرقامها السرية هنا.
              </Text>
            </View>

            <View style={styles.docTypesList}>
              {[
                { id: 'national_id', label: 'الهوية الوطنية للمواطنين 🇸🇦' },
                { id: 'iqama', label: 'هوية مقيم 🛡️' },
                { id: 'freelance', label: 'وثيقة العمل الحر / سجل تجاري 💼' },
              ].map((dt) => (
                <Pressable
                  key={dt.id}
                  style={[styles.docTypeItem, documentType === dt.id && styles.docTypeItemActive]}
                  onPress={() => setDocumentType(dt.id as any)}
                >
                  <View style={styles.radioDotWrap}>
                    {documentType === dt.id && <View style={styles.radioDot} />}
                  </View>
                  <Text style={[styles.docTypeLabel, documentType === dt.id && styles.docTypeLabelActive]}>
                    {dt.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.modalCancelBtn}
                onPress={() => setVerificationModalOpen(false)}
              >
                <Text style={styles.modalCancelText}>إلغاء</Text>
              </Pressable>
              <Pressable
                style={styles.modalSubmitBtn}
                onPress={submitVerificationRequest}
                disabled={verificationSubmitting}
              >
                {verificationSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalSubmitText}>إرسال الطلب</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#059669',
    fontWeight: '800',
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toast: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 16,
    alignSelf: 'center',
    backgroundColor: '#065f46',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 30,
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  toastText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  scrollContent: {
    padding: 16,
    paddingTop: 12,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },

  /* Navigation Switcher Segment (Profile ⇄ Settings) */
  navSegmentContainer: {
    marginBottom: 12,
    width: '100%',
  },
  navSegmentWrap: {
    flexDirection: 'row-reverse',
    backgroundColor: '#e2e8f0',
    borderRadius: 14,
    padding: 3,
    gap: 4,
  },
  navSegmentBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 11,
  },
  navSegmentBtnActive: {
    backgroundColor: '#059669',
    shadowColor: '#059669',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  navSegmentText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#475569',
  },
  navSegmentTextActive: {
    color: '#ffffff',
    fontWeight: '900',
  },

  settingsIdentityCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e7edf0',
    borderRadius: 18,
    padding: 14,
    marginBottom: 20,
    shadowColor: '#0f172a',
    shadowOpacity: 0.035,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  settingsAvatarWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    overflow: 'hidden',
    backgroundColor: '#d8f3e6',
  },
  settingsAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 29,
  },
  settingsAvatarFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d8f3e6',
  },
  settingsAvatarLetter: {
    color: '#128c7e',
    fontSize: 24,
    fontWeight: '800',
  },
  settingsIdentityText: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 3,
  },
  settingsNameRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
  },
  settingsIdentityName: {
    color: '#18252d',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'right',
  },
  settingsIdentityAbout: {
    color: '#64747d',
    fontSize: 12,
    textAlign: 'right',
  },
  settingsIdentityLocation: {
    color: '#128c7e',
    fontSize: 10.5,
    fontWeight: '700',
    textAlign: 'right',
  },
  preferenceMenu: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e7edf0',
    borderRadius: 18,
    paddingHorizontal: 14,
    marginBottom: 18,
  },
  preferenceSectionTitle: {
    color: '#128c7e',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
    paddingTop: 15,
    paddingBottom: 7,
    paddingHorizontal: 2,
  },
  preferenceRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    minHeight: 68,
    paddingVertical: 10,
  },
  preferenceIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#e9f6f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  preferenceCopy: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 3,
  },
  preferenceTitle: {
    color: '#26343c',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
  },
  preferenceDescription: {
    color: '#78858c',
    fontSize: 11,
    textAlign: 'right',
  },
  preferenceDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#e7edf0',
    marginRight: 52,
  },
  preferenceDetailHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
    marginBottom: 12,
  },
  preferenceBackButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: '#e9f6f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  preferenceDetailTitle: {
    color: '#1a292f',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'right',
  },
  preferenceDetailDescription: {
    color: '#78858c',
    fontSize: 11,
    marginTop: 2,
    textAlign: 'right',
  },

  /* Hero Identity Card */
  heroCard: {
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    overflow: 'hidden',
  },
  heroGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.06)',
    top: -80,
    left: -60,
  },
  heroContentRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 14,
  },
  avatarWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2.5,
    borderColor: '#34d399',
    position: 'relative',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  avatarFallbackText: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '900',
  },
  crownBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#f59e0b',
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#064e3b',
  },
  heroInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  heroNameRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  heroName: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
  },
  adminPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(245, 158, 11, 0.22)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  adminPillText: {
    color: '#fde68a',
    fontSize: 10,
    fontWeight: '800',
  },
  heroHandle: {
    color: '#a7f3d0',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  heroLocRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    marginTop: 5,
  },
  heroLocText: {
    color: '#e2e8f0',
    fontSize: 11.5,
    fontWeight: '700',
  },
  editProfileQuickBtn: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  editProfileQuickText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  quickBadgesRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  quickBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  quickBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },

  /* Category Scroll Filter */
  categoryScroll: {
    flexDirection: 'row-reverse',
    gap: 8,
    paddingVertical: 4,
    marginBottom: 14,
  },
  categoryPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  categoryPillActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
  },
  categoryPillTextActive: {
    color: '#ffffff',
  },

  /* Cards */
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  cardHeaderIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderTitle: {
    fontSize: 15.5,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'right',
  },
  cardHeaderDesc: {
    fontSize: 11.5,
    color: '#64748b',
    textAlign: 'right',
    marginTop: 2,
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 14,
  },

  /* Setting Blocks */
  settingBlock: {
    gap: 8,
  },
  settingBlockHead: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  blockTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#1e293b',
    textAlign: 'right',
  },
  blockValue: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '600',
    textAlign: 'right',
    marginTop: 2,
  },
  blockSubDesc: {
    fontSize: 11.5,
    color: '#64748b',
    textAlign: 'right',
    marginTop: 4,
    lineHeight: 18,
  },
  actionOutlineBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#059669',
    backgroundColor: '#f0fdf4',
  },
  actionOutlineText: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '800',
  },
  expandableBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 14,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
    textAlign: 'right',
  },
  textInput: {
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13.5,
    color: '#0f172a',
    textAlign: 'left',
  },
  primaryActionBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 16,
    marginTop: 6,
  },
  primaryActionText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },

  /* Toggles */
  toggleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#1e293b',
    textAlign: 'right',
  },
  toggleDesc: {
    fontSize: 11.5,
    color: '#64748b',
    textAlign: 'right',
    marginTop: 3,
    lineHeight: 17,
  },

  /* Radio Group */
  optionsBlock: {
    gap: 8,
  },
  optionsBlockTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#1e293b',
    textAlign: 'right',
  },
  optionsBlockDesc: {
    fontSize: 11.5,
    color: '#64748b',
    textAlign: 'right',
    marginBottom: 4,
  },
  radioGroup: {
    gap: 8,
  },
  radioCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  radioCardActive: {
    backgroundColor: '#ecfdf5',
    borderColor: '#059669',
  },
  radioDotWrap: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#059669',
  },
  radioLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
    textAlign: 'right',
  },
  radioLabelActive: {
    color: '#065f46',
  },
  radioSub: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'right',
    marginTop: 2,
  },

  /* Location Box */
  locationSummaryBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
    marginBottom: 6,
  },
  locItemRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  locItemLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '700',
  },
  locItemVal: {
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '800',
  },

  /* DND Schedule */
  dndScheduleSection: {
    marginTop: 12,
    gap: 10,
  },
  dndPillsRow: {
    flexDirection: 'row-reverse',
    gap: 6,
  },
  dndPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  dndPillActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  dndPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },
  dndPillTextActive: {
    color: '#ffffff',
  },
  customTimeBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  customTimeInputs: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  timeLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    textAlign: 'right',
    marginBottom: 4,
  },
  timeInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
    color: '#0f172a',
    textAlign: 'center',
  },
  timeSeparator: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
    marginTop: 14,
  },

  /* Blocked Users */
  emptyStateBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptyStateTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
  },
  emptyStateSub: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  blockedRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  blockedAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockedAvatarImg: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  blockedAvatarTxt: {
    fontSize: 16,
    fontWeight: '800',
    color: '#64748b',
  },
  blockedName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'right',
  },
  blockedDate: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'right',
  },
  unblockBtn: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  unblockBtnText: {
    color: '#dc2626',
    fontSize: 11.5,
    fontWeight: '800',
  },

  /* Admin Center Banner */
  adminBannerCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 14,
  },
  adminBannerGrad: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    padding: 18,
  },
  adminBannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminBannerTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'right',
  },
  adminBannerSub: {
    color: '#c7d2fe',
    fontSize: 11,
    textAlign: 'right',
    marginTop: 2,
    lineHeight: 16,
  },

  /* Compliance & Meta */
  complianceBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ecfdf5',
    padding: 10,
    borderRadius: 12,
    marginBottom: 10,
  },
  complianceText: {
    flex: 1,
    color: '#065f46',
    fontSize: 11.5,
    fontWeight: '700',
    textAlign: 'right',
    lineHeight: 17,
  },
  metaRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  metaLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  metaValue: {
    fontSize: 12,
    color: '#0f172a',
    fontWeight: '800',
  },

  /* Sign Out Button */
  signOutBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 4,
    marginBottom: 20,
  },
  signOutText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '900',
  },
  deleteAccountBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#b91c1c',
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: -8,
    marginBottom: 24,
  },
  deleteAccountBtnDisabled: {
    opacity: 0.6,
  },
  deleteAccountText: {
    color: '#b91c1c',
    fontSize: 14,
    fontWeight: '900',
  },

  /* Modal */
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 22,
    gap: 14,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
  },
  modalHeader: {
    alignItems: 'center',
    gap: 6,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'center',
  },
  modalSub: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
  docTypesList: {
    gap: 8,
    marginVertical: 4,
  },
  docTypeItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  docTypeItemActive: {
    backgroundColor: '#ecfdf5',
    borderColor: '#059669',
  },
  docTypeLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
  },
  docTypeLabelActive: {
    color: '#065f46',
  },
  modalActions: {
    flexDirection: 'row-reverse',
    gap: 10,
    marginTop: 6,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
  },
  modalSubmitBtn: {
    flex: 2,
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#ffffff',
  },
});
