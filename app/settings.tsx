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
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { registerPushToken } from '@/lib/notifications';
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
} from 'lucide-react-native';
import BottomNav from '@/components/BottomNav';

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
  const [isVerified, setIsVerified] = useState(false);

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

      const { data: prof } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', u.user.id)
        .single();

      if (prof) {
        setProfilePrivacy(prof.profile_privacy || 'public');
        setAllowDms(prof.allow_dms || 'everyone');
        setAllowStoryReplies(prof.allow_story_replies || 'everyone');
        setHideName(prof.hide_name || false);
        setRole(prof.role || 'user');
        setIsVerified(prof.is_verified || false);
      }
    } catch (err) {
      console.log('Error loading settings:', err);
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings(
    newPrivacy?: 'public' | 'private',
    newDms?: 'everyone' | 'followers' | 'nobody',
    newReplies?: 'everyone' | 'followers' | 'nobody',
    newHideName?: boolean
  ) {
    if (!userId) return;
    setSaving(true);

    const updatePayload: any = {
      profile_privacy: newPrivacy ?? profilePrivacy,
      allow_dms: newDms ?? allowDms,
      allow_story_replies: newReplies ?? allowStoryReplies,
      hide_name: newHideName ?? hideName,
    };

    try {
      const { error } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', userId);

      if (error) {
        Alert.alert('تنبيه', 'تم الحفظ محلياً. تأكد من تشغيل ملف setup_privacy.sql في Supabase لتفعيل كل الأعمدة في قاعدة البيانات.');
      }
    } catch (e: any) {
      console.log('Save error:', e);
    } finally {
      setSaving(false);
    }
  }

  async function togglePrivateAccount(val: boolean) {
    const nextVal = val ? 'private' : 'public';
    setProfilePrivacy(nextVal);
    await saveSettings(nextVal);
  }

  async function changeDmSetting(val: 'everyone' | 'followers' | 'nobody') {
    setAllowDms(val);
    await saveSettings(undefined, val);
  }

  async function changeStoryRepliesSetting(val: 'everyone' | 'followers' | 'nobody') {
    setAllowStoryReplies(val);
    await saveSettings(undefined, undefined, val);
  }

  async function toggleHideName(val: boolean) {
    setHideName(val);
    await saveSettings(undefined, undefined, undefined, val);
  }

  async function requestVerification() {
    if (!userId) return;
    try {
      const { error } = await supabase.from('verification_requests').insert({
        user_id: userId,
        note: 'طلب توثيق الحساب',
      });
      if (error) Alert.alert('ملاحظة', error.message);
      else Alert.alert('تم الإرسال', 'تم إرسال طلب التوثيق، سنراجع طلبك قريباً.');
    } catch (e: any) {
      Alert.alert('خطأ', e.message);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace('/auth');
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
            <View style={[styles.sectionIcon, { backgroundColor: '#eff6ff' }]}>
              <MessageCircle size={18} color="#2563eb" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>الرسائل الخاصة (DM)</Text>
              <Text style={styles.sectionDesc}>من يمكنه إرسال رسائل خاصة لك؟</Text>
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
                <Text style={styles.optionSubtitle}>أي جار في الحي يمكنه مراسلتك</Text>
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
                <Text style={styles.optionSubtitle}>فقط الأشخاص الذين تتابعهم ويتابعونك</Text>
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

        {/* 4. قسم الإشعارات والتوثيق */}
        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionIcon, { backgroundColor: '#fef3c7' }]}>
              <Bell size={18} color="#d97706" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>التنبيهات وتوثيق الحساب</Text>
              <Text style={styles.sectionDesc}>إشعارات الجوال والشارة الزرقاء</Text>
            </View>
          </View>

          <Pressable style={styles.actionBtn} onPress={registerPushToken}>
            <Smartphone size={20} color={C.ink} />
            <Text style={styles.actionBtnText}>تفعيل إشعارات الجوال الفورية</Text>
          </Pressable>

          <Pressable style={styles.actionBtn} onPress={requestVerification}>
            <ShieldCheck size={20} color={isVerified ? '#16a34a' : C.ink} />
            <Text style={[styles.actionBtnText, isVerified && { color: '#16a34a' }]}>
              {isVerified ? 'حسابك موثق بالشارة الرسمية ✓' : 'طلب توثيق الحساب بالشارة الرسمية ✓'}
            </Text>
          </Pressable>

          {role === 'admin' && (
            <Pressable
              style={[styles.actionBtn, { borderBottomWidth: 0 }]}
              onPress={() => router.push('/admin')}
            >
              <Shield size={20} color={C.accent} />
              <Text style={[styles.actionBtnText, { color: C.accent }]}>
                لوحة تحكم مدير النظام 👑
              </Text>
            </Pressable>
          )}
        </View>

        {/* 5. زر تسجيل الخروج */}
        <Pressable style={styles.logoutBtn} onPress={handleLogout}>
          <LogOut size={20} color={C.danger} style={{ marginLeft: 8 }} />
          <Text style={styles.logoutText}>تسجيل الخروج من الحساب</Text>
        </Pressable>

        <View style={{ height: 90 }} />
      </ScrollView>

      {/* شريط التنقل السفلي */}
      <View style={styles.bottomNavWrapper}>
        <BottomNav />
      </View>
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
  bottomNavWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});
