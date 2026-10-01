import { useEffect, useState } from 'react';
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
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { registerPushToken, syncDndWithNotifications } from '@/lib/notifications';
import { C } from '@/lib/ui';
import {
  ChevronRight,
  Shield,
  Lock,
  MessageCircle,
  Eye,
  Bell,
  Sparkles,
  LogOut,
  Check,
  CheckCircle2,
  ShieldCheck,
  Sliders,
  Smartphone,
  ChevronLeft,
  BellOff,
  Moon,
  UserX,
  Compass,
} from 'lucide-react-native';
import BottomNav from '@/components/BottomNav';
import { verifyGPSInDistrict } from '@/lib/nationalAddress';
import {
  DEFAULT_DND,
  DndSettings,
  checkChatControlsReady,
  displayName,
  dndLabel,
  formatArabicTime,
  isDndActiveNow,
  loadBlockedUsers,
  loadDnd,
  saveDnd,
  setBlock,
} from '@/lib/chatControls';

export default function SettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Settings State
  const [profilePrivacy, setProfilePrivacy] = useState<'public' | 'private'>('public');
  const [allowDms, setAllowDms] = useState<'everyone' | 'followers' | 'nobody'>('everyone');
  const [allowStoryReplies, setAllowStoryReplies] = useState<'everyone' | 'followers' | 'nobody'>('everyone');
  const [hideName, setHideName] = useState(false);
  const [role, setRole] = useState<string>('user');
  const [pushEnabled, setPushEnabled] = useState(false);
  const [email, setEmail] = useState('');
  const [emailDraft, setEmailDraft] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accountSaving, setAccountSaving] = useState(false);
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [geoVerified, setGeoVerified] = useState(false);
  const [geoChecking, setGeoChecking] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<'none' | 'pending' | 'verified' | 'rejected'>('none');
  const [verificationModalOpen, setVerificationModalOpen] = useState(false);
  const [verificationSubmitting, setVerificationSubmitting] = useState(false);
  const [documentType, setDocumentType] = useState<'national_id' | 'iqama' | 'freelance'>('national_id');

  // Do-Not-Disturb
  const [dnd, setDnd] = useState<DndSettings>(DEFAULT_DND);
  const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
  const [draftStart, setDraftStart] = useState('22:00');
  const [draftEnd, setDraftEnd] = useState('07:00');
  const [showCustom, setShowCustom] = useState(false);
  const [controlsReady, setControlsReady] = useState<boolean | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        setLoading(false);
        return;
      }
      setUserId(u.user.id);
      setEmail(u.user.email || '');
      setEmailDraft(u.user.email || '');

      const [profRes, dndRes, blockedRes, verificationRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', u.user.id).single(),
        loadDnd(u.user.id),
        loadBlockedUsers(u.user.id),
        supabase.from('verification_requests').select('status').eq('user_id', u.user.id).order('created_at', { ascending: false }).limit(1),
      ]);

      const prof = profRes.data;
      if (prof) {
        setProfilePrivacy(prof.profile_privacy || 'public');
        setAllowDms(prof.allow_dms || 'everyone');
        setAllowStoryReplies(prof.allow_story_replies || 'everyone');
        setHideName(prof.hide_name || false);
        setRole(prof.role || 'user');
        setCity(prof.city || '');
        setDistrict(prof.district || '');
        if (prof.is_verified) setVerificationStatus('verified');
      }
      const latestRequest = verificationRes.data?.[0];
      if (latestRequest && !profRes.data?.is_verified) {
        setVerificationStatus(latestRequest.status === 'approved' ? 'verified' : latestRequest.status === 'rejected' ? 'rejected' : 'pending');
      }

      setDnd(dndRes);
      setDraftStart(dndRes.start || '22:00');
      setDraftEnd(dndRes.end || '07:00');
      setBlockedUsers((blockedRes || []).filter(Boolean));
      setControlsReady(await checkChatControlsReady());
    } catch (err) {
      console.log('Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  }

  async function changeEmail() {
    const nextEmail = emailDraft.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(nextEmail)) return Alert.alert('البريد غير صالح', 'أدخل بريداً إلكترونياً صالحاً.');
    if (nextEmail === email.toLowerCase()) return Alert.alert('لا يوجد تغيير', 'هذا هو البريد المسجل حالياً.');
    setAccountSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: nextEmail });
      if (error) throw error;
      Alert.alert('تحقق من بريدك', 'أرسلنا رسالة تأكيد لإكمال تغيير البريد. سيبقى البريد الحالي فعالاً حتى تأكيد الطلب.');
    } catch (error: any) {
      Alert.alert('تعذّر تغيير البريد', error?.message || 'حدث خطأ أثناء إرسال طلب التغيير.');
    } finally {
      setAccountSaving(false);
    }
  }

  async function changePassword() {
    if (newPassword.length < 8) return Alert.alert('كلمة المرور قصيرة', 'استخدم 8 أحرف على الأقل.');
    if (newPassword !== confirmPassword) return Alert.alert('كلمتا المرور غير متطابقتين', 'أعد كتابة كلمة المرور نفسها في الحقلين.');
    setAccountSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('تم تغيير كلمة المرور', 'تم تحديث كلمة المرور لحسابك.');
    } catch (error: any) {
      Alert.alert('تعذّر تغيير كلمة المرور', error?.message || 'حدث خطأ أثناء تحديث كلمة المرور.');
    } finally {
      setAccountSaving(false);
    }
  }

  async function verifyResidentGPS() {
    if (!city || !district) return Alert.alert('حدد موقعك أولاً', 'اختر المدينة والحي من الملف الشخصي ثم أعد الفحص.');
    if (Platform.OS !== 'web' || typeof navigator === 'undefined' || !navigator.geolocation) {
      return Alert.alert('تحديد الموقع غير متاح', 'الفحص متاح حالياً عبر متصفح يدعم تحديد الموقع.');
    }
    setGeoChecking(true);
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const result = verifyGPSInDistrict(coords.latitude, coords.longitude, city, district);
        if (!result.isVerified) {
          Alert.alert('لم ينجح الفحص', result.message);
          return;
        }
        if (!userId) throw new Error('يلزم تسجيل الدخول.');
        const { error } = await supabase.from('profiles').update({ is_geoverified: true, geoverified_at: new Date().toISOString() }).eq('id', userId);
        if (error) throw error;
        setGeoVerified(true);
        Alert.alert('اكتمل الفحص', result.message);
      } catch (error: any) {
        Alert.alert('تعذّر حفظ نتيجة الفحص', error?.message || 'حاول مرة أخرى.');
      } finally {
        setGeoChecking(false);
      }
    }, error => {
      setGeoChecking(false);
      Alert.alert('تعذّر تحديد الموقع', error.code === 1 ? 'اسمح للموقع بالوصول إلى موقعك ثم أعد المحاولة.' : 'تحقق من خدمة الموقع ثم أعد المحاولة.');
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
  }

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
      Alert.alert('تم إرسال الطلب', 'سُجل طلبك للمراجعة الإدارية. لا ترسل رقم الهوية أو صورة الوثيقة عبر هذه الصفحة.');
    } catch (error: any) {
      Alert.alert('تعذّر إرسال الطلب', error?.message || 'لم يُسجل الطلب. حاول مجدداً.');
    } finally {
      setVerificationSubmitting(false);
    }
  }

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
      const { data, error } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', userId)
        .select('id')
        .maybeSingle();

      if (error) {
        Alert.alert('تعذّر حفظ الإعداد', `${error.message}\nتحقق من إعداد قاعدة البيانات ثم أعد المحاولة.`);
        return false;
      }
      if (!data) {
        Alert.alert('تعذّر حفظ الإعداد', 'لم يتم تحديث ملف الحساب. أعد تسجيل الدخول ثم حاول مجدداً.');
        return false;
      }
      return true;
    } catch (e: any) {
      console.log('Save error:', e);
      Alert.alert('تعذّر حفظ الإعداد', e?.message || 'حدث خطأ أثناء حفظ التغيير.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function togglePrivateAccount(val: boolean) {
    const nextVal = val ? 'private' : 'public';
    setProfilePrivacy(nextVal);
    if (!(await saveSettings(nextVal))) setProfilePrivacy(val ? 'public' : 'private');
  }

  async function changeDmSetting(val: 'everyone' | 'followers' | 'nobody') {
    setAllowDms(val);
    if (!(await saveSettings(undefined, val))) setAllowDms(allowDms);
  }

  async function changeStoryRepliesSetting(val: 'everyone' | 'followers' | 'nobody') {
    setAllowStoryReplies(val);
    if (!(await saveSettings(undefined, undefined, val))) setAllowStoryReplies(allowStoryReplies);
  }

  async function toggleHideName(val: boolean) {
    setHideName(val);
    if (!(await saveSettings(undefined, undefined, undefined, val))) setHideName(!val);
  }

  async function activatePushNotifications() {
    try {
      const token = await registerPushToken();
      if (!token) {
        Alert.alert('تعذّر التفعيل', 'لم يتم منح إذن الإشعارات أو لا يدعم هذا الجهاز تسجيل الإشعارات الفورية.');
        return;
      }
      setPushEnabled(true);
      Alert.alert('تم التفعيل', 'تم منح الإذن وتسجيل هذا الجهاز لاستقبال الإشعارات.');
    } catch (error: any) {
      Alert.alert('تعذّر التفعيل', error?.message || 'تعذر تسجيل هذا الجهاز.');
    }
  }

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
  }

  async function toggleDnd(val: boolean) {
    await applyDnd({ ...dnd, enabled: val });
  }

  async function saveCustomSchedule() {
    if (!userId) return;
    await applyDnd({ enabled: true, schedule: 'custom', start: draftStart, end: draftEnd });
  }

  async function unblockUser(targetId: string, name: string) {
    if (!userId) return;
    Alert.alert('إلغاء الحظر', `هل تريد السماح لـ ${name} بمراسلتك مرة أخرى؟`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'إلغاء الحظر',
        onPress: async () => {
          const result = await setBlock(userId, targetId, false);
          if (!result.ok) return Alert.alert('خطأ', result.error);
          setBlockedUsers(prev => prev.filter((b: any) => b.id !== targetId));
          Alert.alert('تم ✓', 'أُزيل المستخدم من قائمة المحظورين.');
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={styles.loadingText}>جاري تحميل الإعدادات...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Top Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ChevronRight size={26} color="#059669" />
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>الإعدادات والمميزات</Text>
          <Text style={styles.headerSubtitle}>الخصوصية، الرسائل، والميزات الحصرية</Text>
        </View>
        <View style={styles.headerIconWrap}>
          <Sliders size={22} color="#059669" />
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {saving && (
          <View style={styles.savingBanner}>
            <ActivityIndicator size="small" color="#059669" />
            <Text style={styles.savingText}>جاري حفظ التغييرات...</Text>
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: '#eff6ff' }]}><Lock size={18} color="#2563eb" /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>البريد وكلمة المرور</Text>
              <Text style={styles.sectionDesc}>تحديث بيانات دخول حسابك</Text>
            </View>
          </View>
          <Text style={styles.accountLabel}>البريد الحالي</Text>
          <Text style={styles.currentEmail}>{email || 'لا يوجد بريد مسجل'}</Text>
          <Text style={styles.accountLabel}>البريد الجديد</Text>
          <TextInput style={styles.accountInput} value={emailDraft} onChangeText={setEmailDraft} autoCapitalize="none" keyboardType="email-address" placeholder="name@example.com" placeholderTextColor="#94a3b8" />
          <Pressable style={styles.accountButton} onPress={changeEmail} disabled={accountSaving}>
            <Text style={styles.accountButtonText}>إرسال رابط تأكيد البريد</Text>
          </Pressable>
          <View style={styles.accountDivider} />
          <Text style={styles.accountLabel}>كلمة المرور الجديدة</Text>
          <TextInput style={styles.accountInput} value={newPassword} onChangeText={setNewPassword} secureTextEntry autoCapitalize="none" placeholder="8 أحرف على الأقل" placeholderTextColor="#94a3b8" />
          <Text style={styles.accountLabel}>تأكيد كلمة المرور</Text>
          <TextInput style={styles.accountInput} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoCapitalize="none" placeholder="أعد كتابة كلمة المرور" placeholderTextColor="#94a3b8" />
          <Pressable style={styles.accountButton} onPress={changePassword} disabled={accountSaving}>
            {accountSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.accountButtonText}>تغيير كلمة المرور</Text>}
          </Pressable>
        </View>

        {/* 1. قسم الخصوصية وقفل الحساب */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: '#f0fdf4' }]}>
              <Lock size={18} color="#16a34a" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>خصوصية الحساب والملف</Text>
              <Text style={styles.sectionDesc}>التحكم في ظهور بياناتك للآخرين</Text>
            </View>
          </View>

          {/* حساب خاص */}
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>قفل الملف الشخصي (حساب خاص)</Text>
              <Text style={styles.rowDesc}>
                عند تفعيل هذا الخيار، لا يمكن للغرباء مشاهدة معلومات ملفك أو قصصك إلا بعد متابعتهم لك.
              </Text>
            </View>
            <Switch
              value={profilePrivacy === 'private'}
              onValueChange={togglePrivateAccount}
              trackColor={{ false: '#e5e7eb', true: '#a7f3d0' }}
              thumbColor={profilePrivacy === 'private' ? '#059669' : '#9ca3af'}
            />
          </View>

          {/* إخفاء الاسم */}
          <View style={[styles.toggleRow, { borderBottomWidth: 0, paddingBottom: 0 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>إخفاء اسمي في المشاركات</Text>
              <Text style={styles.rowDesc}>
                يظهر اسمك كـ "مستخدم مجهول" عند طرح الأسئلة والنقاشات
              </Text>
            </View>
            <Switch
              value={hideName}
              onValueChange={toggleHideName}
              trackColor={{ false: '#e5e7eb', true: '#a7f3d0' }}
              thumbColor={hideName ? '#059669' : '#9ca3af'}
            />
          </View>
        </View>

        {/* 2. قسم الرسائل الخاصة */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: '#ecfdf5' }]}>
              <MessageCircle size={18} color="#059669" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>الرسائل الخاصة (DM)</Text>
              <Text style={styles.sectionDesc}>الرسائل لا تعمل إلا بين حسابين محددي المدينة والحي نفسيهما.</Text>
            </View>
          </View>

          <View style={styles.optionsList}>
            {/* الجميع */}
            <Pressable
              style={[styles.optionItem, allowDms === 'everyone' && styles.optionItemActive]}
              onPress={() => changeDmSetting('everyone')}
            >
              <View style={styles.optionRadio}>
                {allowDms === 'everyone' && <View style={styles.optionRadioDot} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitle}>الجميع</Text>
                <Text style={styles.optionSubtitle}>أي حساب من الحي المطابق لك يمكنه مراسلتك</Text>
              </View>
            </Pressable>

            {/* المتابعون فقط */}
            <Pressable
              style={[styles.optionItem, allowDms === 'followers' && styles.optionItemActive]}
              onPress={() => changeDmSetting('followers')}
            >
              <View style={styles.optionRadio}>
                {allowDms === 'followers' && <View style={styles.optionRadioDot} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitle}>المتابعون فقط</Text>
                <Text style={styles.optionSubtitle}>فقط الحسابات التي تتابعها من الحي المطابق</Text>
              </View>
            </Pressable>

            {/* لا أحد / قفل الخاص */}
            <Pressable
              style={[styles.optionItem, allowDms === 'nobody' && styles.optionItemActive]}
              onPress={() => changeDmSetting('nobody')}
            >
              <View style={styles.optionRadio}>
                {allowDms === 'nobody' && <View style={styles.optionRadioDot} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitle}>إيقاف الخاص تماماً (لا أحد)</Text>
                <Text style={styles.optionSubtitle}>لن يستطيع أي شخص إرسال رسائل خاصة لك</Text>
              </View>
            </Pressable>
          </View>
        </View>

        {/* 3. قسم الردود على الستوري */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: '#fdf2f8' }]}>
              <Sparkles size={18} color="#db2777" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>الردود على الستوري والقصص</Text>
              <Text style={styles.sectionDesc}>من يمكنه إرسال ردود خاصة على قصصك؟</Text>
            </View>
          </View>

          <View style={styles.optionsList}>
            {/* الجميع */}
            <Pressable
              style={[styles.optionItem, allowStoryReplies === 'everyone' && styles.optionItemActive]}
              onPress={() => changeStoryRepliesSetting('everyone')}
            >
              <View style={styles.optionRadio}>
                {allowStoryReplies === 'everyone' && <View style={styles.optionRadioDot} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitle}>السماح بالرد للجميع</Text>
                <Text style={styles.optionSubtitle}>أي شخص يشاهد الستوري يمكنه الرد بالخاص</Text>
              </View>
            </Pressable>

            {/* المتابعون فقط */}
            <Pressable
              style={[styles.optionItem, allowStoryReplies === 'followers' && styles.optionItemActive]}
              onPress={() => changeStoryRepliesSetting('followers')}
            >
              <View style={styles.optionRadio}>
                {allowStoryReplies === 'followers' && <View style={styles.optionRadioDot} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitle}>المتابعون فقط</Text>
                <Text style={styles.optionSubtitle}>الرد متاح فقط للأشخاص المتابعين لك</Text>
              </View>
            </Pressable>

            {/* إيقاف الردود */}
            <Pressable
              style={[styles.optionItem, allowStoryReplies === 'nobody' && styles.optionItemActive]}
              onPress={() => changeStoryRepliesSetting('nobody')}
            >
              <View style={styles.optionRadio}>
                {allowStoryReplies === 'nobody' && <View style={styles.optionRadioDot} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitle}>إيقاف الردود نهائياً</Text>
                <Text style={styles.optionSubtitle}>لا يمكن لأحد كتابة ردود على قصصك</Text>
              </View>
            </Pressable>
          </View>
        </View>

        {/* 3.5. حالة حماية المحادثات */}
        <View style={[styles.card, controlsReady === false && { borderColor: '#fca5a5' }]}>
          <View style={styles.sectionHeader}>
            <View
              style={[
                styles.sectionIcon,
                controlsReady === false ? { backgroundColor: '#fef2f2' } : { backgroundColor: '#ecfdf5' },
              ]}
            >
              {controlsReady === false ? (
                <ShieldCheck size={18} color="#dc2626" />
              ) : (
                <Shield size={18} color="#059669" />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>حالة حماية المحادثات</Text>
              <Text style={styles.sectionDesc}>هل الحظر والكتم وعدم الإزعاج مفعّلان فعلاً؟</Text>
            </View>
          </View>

          {controlsReady === false ? (
            <>
              <View style={styles.readyBadge}>
                <Text style={styles.readyBadgeText}>
                  ⚠️ إعدادات قاعدة البيانات لم تُفعَّل بعد — الحظر والكتم يعملان جزئياً من الواجهة فقط.
                </Text>
              </View>
              <Text style={styles.readyHint}>
                افتح Supabase → SQL Editor → ألصق محتوى ملف setup_chat_controls.sql من المشروع ثم Run.
                يعيد التشغيل بشكل آمن (idempotent) — لا لزوم لحذف أي شيء.
              </Text>
            </>
          ) : (
            <View style={[styles.readyBadge, { backgroundColor: '#ecfdf5' }]}>
              <Text style={[styles.readyBadgeText, { color: '#065f46' }]}>
                ✓ الحماية مفعّلة على الخادم: الحظر يمنع المحظور فعلياً، والكتم وعدم الإزعاج يُسكتان الإشعارات.
              </Text>
            </View>
          )}
        </View>

        {/* 4. قسم الرسائل وعدم الإزعاج */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: '#fffbeb' }]}>
              <BellOff size={18} color="#d97706" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>عدم الإزعاج والرسائل</Text>
              <Text style={styles.sectionDesc}>تحكم في وقت صمت الإشعارات وكتم المحادثات</Text>
            </View>
          </View>

          {/* DND master switch */}
          <View style={styles.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>تفعيل عدم الإزعاج 🔕</Text>
              <Text style={styles.rowDesc}>
                {dndLabel(dnd)}
                {dnd.enabled && isDndActiveNow(dnd) ? ' — صامت الآن' : ' — يُصمت كل الإشعارات عند تفعيله'}
              </Text>
            </View>
            <Switch
              value={dnd.enabled}
              onValueChange={toggleDnd}
              trackColor={{ false: '#e5e7eb', true: '#fde68a' }}
              thumbColor={dnd.enabled ? '#d97706' : '#9ca3af'}
            />
          </View>

          {dnd.enabled && (
            <View style={styles.scheduleSection}>
              <Pressable
                style={[styles.schedulePill, dnd.schedule === 'off' && styles.schedulePillActive]}
                onPress={() => applyDnd({ ...dnd, schedule: 'off' })}
              >
                <Text style={[styles.schedulePillText, dnd.schedule === 'off' && { color: '#fff' }]}>دائماً</Text>
              </Pressable>
              <Pressable
                style={[styles.schedulePill, dnd.schedule === 'nightly' && styles.schedulePillActive]}
                onPress={() => applyDnd({ ...dnd, schedule: 'nightly' })}
              >
                <Text style={[styles.schedulePillText, dnd.schedule === 'nightly' && { color: '#fff' }]}>
                  ليلاً 🌙
                </Text>
              </Pressable>
              <Pressable
                style={[styles.schedulePill, dnd.schedule === 'custom' && styles.schedulePillActive]}
                onPress={() => {
                  const opening = !showCustom;
                  setShowCustom(opening);
                  if (opening) void applyDnd({ ...dnd, schedule: 'custom' }, true);
                }}
              >
                <Text style={[styles.schedulePillText, dnd.schedule === 'custom' && { color: '#fff' }]}>
                  مخصص ⏱
                </Text>
              </Pressable>
            </View>
          )}

          {dnd.enabled && dnd.schedule === 'custom' && (
            <View style={styles.customRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.customLabel}>من</Text>
                <TextInput
                  style={styles.customInput}
                  value={draftStart}
                  onChangeText={setDraftStart}
                  placeholder="22:00"
                  placeholderTextColor="#94a3b8"
                  maxLength={5}
                />
              </View>
              <Text style={styles.customArrow}>إلى</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.customLabel}>إلى</Text>
                <TextInput
                  style={styles.customInput}
                  value={draftEnd}
                  onChangeText={setDraftEnd}
                  placeholder="07:00"
                  placeholderTextColor="#94a3b8"
                  maxLength={5}
                />
              </View>
              <Pressable style={styles.customSave} onPress={saveCustomSchedule}>
                <Text style={styles.customSaveText}>حفظ</Text>
              </Pressable>
            </View>
          )}

          <Text style={styles.schedHint}>
            الفترة الحالية: {formatArabicTime(dnd.start)} — {formatArabicTime(dnd.end)} (نص الليل حتى الصباح)
          </Text>
        </View>

        {/* 5. قائمة المحظورين */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: '#fef2f2' }]}>
              <UserX size={18} color="#dc2626" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>المستخدمون المحظورون 🚫</Text>
              <Text style={styles.sectionDesc}>لن يتمكنوا من مراسلتك حتى تُزيل الحظر</Text>
            </View>
          </View>

          {blockedUsers.length === 0 ? (
            <Text style={styles.emptyBlocked}>لا يوجد محظورون حالياً.</Text>
          ) : (
            blockedUsers.map(b => (
              <View key={b.id} style={styles.blockedRow}>
                <View style={styles.blockedAvatarWrap}>
                  {b.avatar_url && b.hide_name !== true ? (
                    <Image source={{ uri: b.avatar_url }} style={styles.blockedAvatar} />
                  ) : (
                    <View style={styles.blockedAvatarFallback}>
                      <Text style={styles.blockedAvatarLetter}>
                        {(b.display_name || b.username || '؟')[0]}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.blockedName}>{displayName(b)}</Text>
                  <Text style={styles.blockedDate}>محظور منذ {b.blockedAt ? new Date(b.blockedAt).toLocaleDateString('ar-SA') : '—'}</Text>
                </View>
                <Pressable style={styles.unblockBtn} onPress={() => unblockUser(b.id, displayName(b))}>
                  <Text style={styles.unblockBtnText}>إلغاء الحظر</Text>
                </Pressable>
              </View>
            ))
          )}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: '#ecfdf5' }]}><ShieldCheck size={18} color="#059669" /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>التوثيق وفحص الموقع</Text>
              <Text style={styles.sectionDesc}>حالة طلب الهوية وفحص تقريبي للموقع</Text>
            </View>
          </View>
          <Pressable style={styles.actionBtn} onPress={verifyResidentGPS} disabled={geoChecking}>
            {geoChecking ? <ActivityIndicator size="small" color="#059669" /> : <Compass size={20} color={geoVerified ? '#059669' : C.ink} />}
            <View style={{ flex: 1 }}>
              <Text style={styles.actionBtnText}>{geoVerified ? 'اجتاز موقعك الفحص الآن ✓' : 'فحص قرب الموقع من المدينة'}</Text>
              <Text style={styles.sectionDesc}>فحص GPS تقريبي ضمن 7 كم؛ لا يثبت السكن في حي محدد.</Text>
            </View>
          </Pressable>
          <Pressable
            style={[styles.actionBtn, { borderBottomWidth: 0 }]}
            disabled={verificationStatus === 'pending' || verificationStatus === 'verified'}
            onPress={() => setVerificationModalOpen(true)}
          >
            <ShieldCheck size={20} color={verificationStatus === 'verified' ? '#059669' : verificationStatus === 'pending' ? '#d97706' : C.ink} />
            <View style={{ flex: 1 }}>
              <Text style={styles.actionBtnText}>
                {verificationStatus === 'verified' ? 'حسابك موثّق بالهوية الرسمية ✓' : verificationStatus === 'pending' ? 'طلب توثيق الهوية قيد المراجعة' : verificationStatus === 'rejected' ? 'رُفض الطلب؛ اضغط لإرسال طلب جديد' : 'طلب توثيق الحساب بالهوية'}
              </Text>
              <Text style={styles.sectionDesc}>
                {verificationStatus === 'verified' ? 'تم اعتماد الهوية من إدارة المنصة.' : verificationStatus === 'pending' ? 'انتظر مراجعة إدارة المنصة.' : 'يُسجل الطلب للمراجعة؛ لا يتم التوثيق تلقائياً.'}
              </Text>
            </View>
            {verificationStatus !== 'pending' && verificationStatus !== 'verified' && <ChevronLeft size={18} color="#94a3b8" />}
          </Pressable>
        </View>

        {/* إشعارات الجوال ولوحة الإدارة */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: '#fef3c7' }]}>
              <Bell size={18} color="#d97706" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>إشعارات الجوال</Text>
              <Text style={styles.sectionDesc}>سجّل هذا الجهاز لاستقبال التنبيهات</Text>
            </View>
          </View>

          <Pressable style={styles.actionBtn} onPress={activatePushNotifications}>
            <Smartphone size={20} color={C.ink} />
            <Text style={styles.actionBtnText}>{pushEnabled ? 'تم تسجيل هذا الجهاز ✓ (اضغط لإعادة المحاولة)' : 'تفعيل إشعارات الجوال الفورية'}</Text>
          </Pressable>

          {role === 'admin' && (
            <Pressable
              style={[styles.actionBtn, { borderBottomWidth: 0 }]}
              onPress={() => router.push('/admin')}
            >
              <Shield size={20} color={C.accent} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.actionBtnText, { color: C.accent }]}>لوحة تحكم مدير النظام 👑</Text>
                <Text style={styles.sectionDesc}>خاص بمسؤول المنصة والرقابة فقط</Text>
              </View>
            </Pressable>
          )}
        </View>

        <View style={{ height: 90 }} />
      </ScrollView>

      <Modal visible={verificationModalOpen} transparent animationType="fade" onRequestClose={() => setVerificationModalOpen(false)}>
        <View style={styles.verifyModalShade}>
          <View style={styles.verifyModalCard}>
            <Text style={styles.verifyModalTitle}>طلب توثيق الحساب</Text>
            <Text style={styles.sectionDesc}>اختر نوع الوثيقة للمراجعة الإدارية. لا ترفق رقم الهوية أو صورتها.</Text>
            {([
              ['national_id', 'الهوية الوطنية'], ['iqama', 'هوية مقيم'], ['freelance', 'وثيقة العمل الحر / سجل تجاري'],
            ] as const).map(([value, label]) => (
              <Pressable key={value} onPress={() => setDocumentType(value)} style={[styles.verifyOption, documentType === value && styles.verifyOptionActive]}>
                <Text style={[styles.optionTitle, documentType === value && { color: '#059669' }]}>{label}</Text>
              </Pressable>
            ))}
            <View style={styles.verifyModalActions}>
              <Pressable style={styles.verifyCancelButton} onPress={() => setVerificationModalOpen(false)}><Text style={styles.verifyCancelText}>إلغاء</Text></Pressable>
              <Pressable style={styles.accountButton} onPress={submitVerificationRequest} disabled={verificationSubmitting}>
                {verificationSubmitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.accountButtonText}>إرسال الطلب</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* شريط التنقل السفلي */}
      <View style={styles.bottomNavWrapper}>
        <BottomNav />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  accountLabel: { color: '#475569', fontSize: 13, fontWeight: '800', textAlign: 'right', marginTop: 8, marginBottom: 5 },
  currentEmail: { color: '#64748b', fontSize: 14, textAlign: 'left', paddingVertical: 8 },
  accountInput: { minHeight: 46, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 12, backgroundColor: '#fff', color: '#0f172a', paddingHorizontal: 12, textAlign: 'left', fontSize: 14 },
  accountButton: { minHeight: 44, flex: 1, borderRadius: 12, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center', marginTop: 10, paddingHorizontal: 14 },
  accountButtonText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  accountDivider: { height: 1, backgroundColor: '#e2e8f0', marginVertical: 17 },
  verifyModalShade: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'center', padding: 20 },
  verifyModalCard: { backgroundColor: '#fff', borderRadius: 20, padding: 20, gap: 8 },
  verifyModalTitle: { color: '#0f172a', fontSize: 18, fontWeight: '900', textAlign: 'right' },
  verifyOption: { padding: 13, borderRadius: 12, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'flex-end' },
  verifyOptionActive: { borderColor: '#059669', backgroundColor: '#ecfdf5' },
  verifyModalActions: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginTop: 8 },
  verifyCancelButton: { minHeight: 44, borderRadius: 12, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, marginTop: 10 },
  verifyCancelText: { color: '#475569', fontSize: 13, fontWeight: '800' },
  screen: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#64748b',
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 54,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  headerIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#ecfdf5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
  },
  savingBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ecfdf5',
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 16,
    gap: 8,
  },
  savingText: {
    color: '#059669',
    fontSize: 13,
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 12,
  },
  sectionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'right',
  },
  sectionDesc: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'right',
    marginTop: 2,
  },
  toggleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 12,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1e293b',
    textAlign: 'right',
  },
  rowDesc: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'right',
    marginTop: 3,
    lineHeight: 18,
  },
  optionsList: {
    gap: 10,
  },
  optionItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#f1f5f9',
    gap: 12,
  },
  optionItemActive: {
    borderColor: '#059669',
    backgroundColor: '#ecfdf5',
  },
  optionRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionRadioDot: {
    width: 11,
    height: 11,
    borderRadius: 5.5,
    backgroundColor: '#059669',
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'right',
  },
  optionSubtitle: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'right',
    marginTop: 2,
  },
  actionBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 12,
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1e293b',
    textAlign: 'right',
  },
  logoutBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#fee2e2',
    borderRadius: 16,
    height: 54,
    marginTop: 8,
  },
  logoutText: {
    color: '#dc2626',
    fontWeight: '900',
    fontSize: 15,
  },

  // DND
  readyBadge: {
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  readyBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#b91c1c',
    lineHeight: 18,
    textAlign: 'right',
  },
  readyHint: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 17,
    textAlign: 'right',
  },
  scheduleSection: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginTop: 4,
    marginBottom: 10,
  },
  schedulePill: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  schedulePillActive: {
    backgroundColor: '#d97706',
    borderColor: '#f59e0b',
  },
  schedulePillText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
  },
  customRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 8,
  },
  customLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 4,
  },
  customInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    height: 44,
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  customArrow: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '800',
    paddingBottom: 14,
  },
  customSave: {
    backgroundColor: '#059669',
    borderRadius: 12,
    height: 44,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customSaveText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
  schedHint: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
    textAlign: 'center',
  },

  // Blocked users
  emptyBlocked: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'right',
    paddingVertical: 6,
  },
  blockedRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
    gap: 12,
  },
  blockedAvatarWrap: { position: 'relative' },
  blockedAvatar: { width: 44, height: 44, borderRadius: 22 },
  blockedAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockedAvatarLetter: { fontSize: 16, fontWeight: '900', color: '#dc2626' },
  blockedName: { fontSize: 14, fontWeight: '800', color: '#0f172a', textAlign: 'right' },
  blockedDate: { fontSize: 11, color: '#94a3b8', marginTop: 2 },
  unblockBtn: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  unblockBtnText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  bottomNavWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});
