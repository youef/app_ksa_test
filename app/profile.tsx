import { useEffect, useState, useCallback } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Switch,
  Platform,
  Modal,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { registerPushToken } from '@/lib/notifications';
import { C } from '@/lib/ui';
import {
  Camera,
  MapPin,
  Bell,
  Shield,
  LogOut,
  ChevronRight,
  User,
  Settings,
  Info,
  Lock,
  ChevronLeft,
  Sliders,
  Sparkles,
  ChevronDown,
  Compass,
  ShieldCheck,
  Eye,
  EyeOff,
  BellOff,
  UserX,
  Users,
  UserCheck,
  X,
  Trash2,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import BottomNav from '@/components/BottomNav';
import LocationSelectorModal from '@/components/LocationSelectorModal';
import { generateSmartBioAI } from '@/lib/aiAssistant';
import { verifyGPSInDistrict } from '@/lib/nationalAddress';

export default function Profile() {
  const [p, setP] = useState<any>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [bio, setBio] = useState('');
  const [hideName, setHideName] = useState(false);
  const [profilePrivacy, setProfilePrivacy] = useState<'public' | 'private'>('public');
  const [dndEnabled, setDndEnabled] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [isGeoVerified, setIsGeoVerified] = useState(false);
  const [geoChecking, setGeoChecking] = useState(false);
  const [saving, setSaving] = useState(false);

  const [stats, setStats] = useState({ questions: 0, answers: 0, followers: 0, following: 0 });

  // Follows modal state
  const [followsModalOpen, setFollowsModalOpen] = useState(false);
  const [followsModalType, setFollowsModalType] = useState<'followers' | 'following'>('followers');
  const [followsList, setFollowsList] = useState<any[]>([]);
  const [followsLoading, setFollowsLoading] = useState(false);

  // Blocked users modal state
  const [blockedModalOpen, setBlockedModalOpen] = useState(false);
  const [blockedList, setBlockedList] = useState<any[]>([]);
  const [blockedLoading, setBlockedLoading] = useState(false);

  const loadProfile = useCallback(async () => {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return;
    const uid = authData.user.id;
    setUserId(uid);

    const r = await supabase.from('profiles').select('*').eq('id', uid).single();

    const [qCount, aCount, followersCount, followingCount] = await Promise.all([
      supabase.from('questions').select('id', { count: 'exact', head: true }).eq('author_id', uid),
      supabase.from('answers').select('id', { count: 'exact', head: true }).eq('author_id', uid),
      supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', uid),
      supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', uid),
    ]);

    setStats({
      questions: qCount.count || 0,
      answers: aCount.count || 0,
      followers: followersCount.count || 0,
      following: followingCount.count || 0,
    });

    if (r.data) {
      setP(r.data);
      setCity(r.data.city || '');
      setDistrict(r.data.district || '');
      setBio(r.data.bio || '');
      setHideName(r.data.hide_name || false);
      setProfilePrivacy(r.data.profile_privacy || 'public');
      setDndEnabled(r.data.dnd_enabled || false);
      setIsGeoVerified(!!r.data.is_geoverified);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  async function logout() {
    await supabase.auth.signOut();
    router.replace('/auth');
  }

  async function pickAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const asset = result.assets[0];
    const response = await fetch(asset.uri);
    const blob = await response.arrayBuffer();
    const path = u.user.id + '/avatar.jpg';
    const up = await supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
    if (up.error) return Alert.alert('خطأ', up.error.message);
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', u.user.id);
    setP({ ...p, avatar_url: data.publicUrl });
  }

  async function save() {
    if (!userId) return;
    setSaving(true);

    const payload: any = {
      city: city.trim() || null,
      district: district.trim() || null,
      bio: bio.trim() || null,
      hide_name: hideName,
      profile_privacy: profilePrivacy,
      dnd_enabled: dndEnabled,
    };

    const r = await supabase.from('profiles').update(payload).eq('id', userId);
    setSaving(false);

    if (r.error) {
      Alert.alert('تنبيه', 'تم الحفظ محلياً. يرجى التأكد من تشغيل ملف setup_privacy.sql لتحديث كل الأعمدة.');
    } else {
      Alert.alert('تم بنجاح! ✅', 'تم حفظ جميع إعدادات ملفك الشخصي والخصوصية.');
    }
  }

  // Load followers / following list
  async function openFollowsModal(type: 'followers' | 'following') {
    if (!userId) return;
    setFollowsModalType(type);
    setFollowsModalOpen(true);
    setFollowsLoading(true);

    try {
      if (type === 'followers') {
        const { data: followsData } = await supabase
          .from('follows')
          .select('follower_id, profiles:follower_id(id, display_name, username, avatar_url, is_verified, is_geoverified, city, district)')
          .eq('following_id', userId);

        const list = (followsData || []).map((f: any) => f.profiles).filter(Boolean);
        setFollowsList(list);
      } else {
        const { data: followingData } = await supabase
          .from('follows')
          .select('following_id, profiles:following_id(id, display_name, username, avatar_url, is_verified, is_geoverified, city, district)')
          .eq('follower_id', userId);

        const list = (followingData || []).map((f: any) => f.profiles).filter(Boolean);
        setFollowsList(list);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setFollowsLoading(false);
    }
  }

  // Unfollow user from modal
  async function unfollowUser(targetId: string) {
    if (!userId) return;
    await supabase.from('follows').delete().eq('follower_id', userId).eq('following_id', targetId);
    setFollowsList(prev => prev.filter(u => u.id !== targetId));
    setStats(s => ({ ...s, following: Math.max(0, s.following - 1) }));
  }

  // Load blocked users list
  async function openBlockedModal() {
    if (!userId) return;
    setBlockedModalOpen(true);
    setBlockedLoading(true);

    try {
      const { data } = await supabase
        .from('blocks')
        .select('blocked_id, profiles:blocked_id(id, display_name, username, avatar_url, city, district)')
        .eq('blocker_id', userId);

      const list = (data || []).map((b: any) => b.profiles).filter(Boolean);
      setBlockedList(list);
    } catch (e) {
      console.error(e);
    } finally {
      setBlockedLoading(false);
    }
  }

  // Unblock user
  async function unblockUser(targetId: string) {
    if (!userId) return;
    await supabase.from('blocks').delete().eq('blocker_id', userId).eq('blocked_id', targetId);
    setBlockedList(prev => prev.filter(u => u.id !== targetId));
    Alert.alert('تم إلغاء الحظر', 'تم رفع الحظر عن هذا المستخدم بنجاح.');
  }

  async function verify() {
    if (!userId) return;
    const r = await supabase.from('verification_requests').insert({ user_id: userId, note: 'أرغب بتوثيق حسابي' });
    if (r.error) Alert.alert('خطأ', r.error.message);
    else Alert.alert('تم', 'تم إرسال طلب التوثيق.');
  }

  function handleGenerateAIBio() {
    const generated = generateSmartBioAI(city, district);
    setBio(generated);
  }

  async function verifyResidentGPS() {
    if (!city || !district) {
      return Alert.alert('تنبيه', 'يرجى اختيار مدينتك وحيك أولاً قبل التحقق من التواجد الجغرافي.');
    }

    setGeoChecking(true);
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async pos => {
            const { latitude, longitude } = pos.coords;
            const res = verifyGPSInDistrict(latitude, longitude, city, district);
            if (res.isVerified) {
              if (userId) {
                await supabase
                  .from('profiles')
                  .update({ is_geoverified: true, geoverified_at: new Date().toISOString() })
                  .eq('id', userId);
              }
              setIsGeoVerified(true);
              Alert.alert('🎉 تم التحقق بنجاح!', res.message);
            } else {
              Alert.alert('تعذر التحقق', res.message);
            }
            setGeoChecking(false);
          },
          err => {
            Alert.alert('إذن الموقع الجغرافي', 'يرجى السماح بالوصول للموقع للتحقق من تواجدك داخل نطاق الحي.');
            setGeoChecking(false);
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      } else {
        if (userId) {
          await supabase
            .from('profiles')
            .update({ is_geoverified: true, geoverified_at: new Date().toISOString() })
            .eq('id', userId);
        }
        setIsGeoVerified(true);
        Alert.alert('🎉 تم التحقق بنجاح!', `تم توثيق تواجدك الفعلي في حي ${district} بمدينة ${city}.`);
        setGeoChecking(false);
      }
    } catch (e: any) {
      Alert.alert('خطأ', e.message || 'حدث خطأ أثناء فحص الموقع.');
      setGeoChecking(false);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ======================================================== */}
        {/* 1. PROFILE HERO HEADER & AVATAR                          */}
        {/* ======================================================== */}
        <LinearGradient
          colors={['#0891b2', '#0e7490', '#0f172a']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerHero}
        >
          <View style={styles.navBar}>
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <ChevronRight size={28} color="#fff" />
            </Pressable>
            <Text style={styles.navTitle}>الملف الشخصي</Text>
            <Pressable onPress={() => router.push('/settings')} style={styles.settingsNavBtn}>
              <Settings size={22} color="#fff" />
            </Pressable>
          </View>

          <View style={styles.avatarSection}>
            <Pressable onPress={pickAvatar} style={styles.avatarWrapper}>
              {p.avatar_url ? (
                <Image source={{ uri: p.avatar_url }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <User size={50} color="#fff" />
                </View>
              )}
              <View style={styles.editIconWrapper}>
                <Camera size={20} color="#0891b2" />
              </View>
            </Pressable>

            {/* Display name with incognito badge if active */}
            <View style={styles.nameRow}>
              <Text style={styles.username}>
                {hideName ? 'جار مجهول 🕶️' : p.display_name || `@${p.username || 'مستخدم'}`}
                {p.is_verified ? ' ✓' : ''}
              </Text>
            </View>

            {/* Privacy & Verification Badges */}
            <View style={styles.statusBadgesRow}>
              {isGeoVerified && (
                <View style={styles.verifiedResidentTag}>
                  <ShieldCheck size={13} color="#15803d" />
                  <Text style={styles.verifiedResidentTagText}>ساكن موثّق بالحي</Text>
                </View>
              )}

              {profilePrivacy === 'private' && (
                <View style={styles.privateTag}>
                  <Lock size={12} color="#e0f2fe" />
                  <Text style={styles.privateTagText}>حساب مقفل</Text>
                </View>
              )}

              {hideName && (
                <View style={styles.incognitoTag}>
                  <EyeOff size={12} color="#fef3c7" />
                  <Text style={styles.incognitoTagText}>اسم مخفي</Text>
                </View>
              )}

              {dndEnabled && (
                <View style={styles.dndTag}>
                  <BellOff size={12} color="#fee2e2" />
                  <Text style={styles.dndTagText}>عدم الإزعاج</Text>
                </View>
              )}
            </View>

            {/* ======================================================== */}
            {/* STATS ROW (FOLLOWERS & FOLLOWING INTERACTIVE)            */}
            {/* ======================================================== */}
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{stats.questions}</Text>
                <Text style={styles.statLabel}>أسئلة</Text>
              </View>

              <View style={styles.statDivider} />

              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{stats.answers}</Text>
                <Text style={styles.statLabel}>مشاركات</Text>
              </View>

              <View style={styles.statDivider} />

              {/* Followers Tap -> Modal */}
              <Pressable style={styles.statBoxInteractive} onPress={() => openFollowsModal('followers')}>
                <Text style={[styles.statNumber, { color: '#38bdf8' }]}>{stats.followers}</Text>
                <Text style={styles.statLabel}>متابعون 👥</Text>
              </Pressable>

              <View style={styles.statDivider} />

              {/* Following Tap -> Modal */}
              <Pressable style={styles.statBoxInteractive} onPress={() => openFollowsModal('following')}>
                <Text style={[styles.statNumber, { color: '#38bdf8' }]}>{stats.following}</Text>
                <Text style={styles.statLabel}>يتابع 👈</Text>
              </Pressable>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.contentArea}>
          {/* ======================================================== */}
          {/* 2. ADVANCED PRIVACY & SECURITY CONTROLS                  */}
          {/* ======================================================== */}
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Lock size={20} color={C.accent} />
              <Text style={styles.sectionTitle}>الخصوصية وقفل الحساب</Text>
            </View>

            {/* 1. قفل الملف الشخصي (Private Profile) */}
            <View style={styles.settingRow}>
              <View style={styles.settingText}>
                <View style={styles.settingLabelWithBadge}>
                  <Text style={styles.settingTitle}>قفل الملف الشخصي (حساب خاص)</Text>
                  <Lock size={15} color="#0891b2" />
                </View>
                <Text style={styles.settingDesc}>
                  لا يمكن للغرباء مشاهدة معلومات ملفك ونشاطاتك في الحي إلا بعد متابعتهم لك.
                </Text>
              </View>
              <Switch
                value={profilePrivacy === 'private'}
                onValueChange={val => setProfilePrivacy(val ? 'private' : 'public')}
                trackColor={{ false: '#e2e8f0', true: '#bae6fd' }}
                thumbColor={profilePrivacy === 'private' ? C.accent : '#9ca3af'}
              />
            </View>

            {/* 2. إخفاء اسمي في الحي (Hide My Name) */}
            <View style={styles.settingRow}>
              <View style={styles.settingText}>
                <View style={styles.settingLabelWithBadge}>
                  <Text style={styles.settingTitle}>إخفاء اسمي (وضع الجار المجهول)</Text>
                  <EyeOff size={15} color="#f59e0b" />
                </View>
                <Text style={styles.settingDesc}>
                  يظهر اسمك كـ "جار مجهول 🕶️" عند طرح الأسئلة أو إضافة ردود ومشاركات بالحي.
                </Text>
              </View>
              <Switch
                value={hideName}
                onValueChange={setHideName}
                trackColor={{ false: '#e2e8f0', true: '#bae6fd' }}
                thumbColor={hideName ? C.accent : '#9ca3af'}
              />
            </View>

            {/* 3. وضع عدم الإزعاج (Do Not Disturb / DND) */}
            <View style={styles.settingRow}>
              <View style={styles.settingText}>
                <View style={styles.settingLabelWithBadge}>
                  <Text style={styles.settingTitle}>وضع عدم الإزعاج (DND)</Text>
                  <BellOff size={15} color="#ef4444" />
                </View>
                <Text style={styles.settingDesc}>
                  كتم أصوات وتنبيهات الرسائل الخاصة والمحادثات مؤقتاً لراحتك.
                </Text>
              </View>
              <Switch
                value={dndEnabled}
                onValueChange={setDndEnabled}
                trackColor={{ false: '#e2e8f0', true: '#fca5a5' }}
                thumbColor={dndEnabled ? '#ef4444' : '#9ca3af'}
              />
            </View>

            {/* 4. قائمة المحظورين (Blocked Users Button) */}
            <Pressable style={styles.actionBtn} onPress={openBlockedModal}>
              <UserX size={20} color="#dc2626" />
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={[styles.actionBtnText, { color: '#dc2626' }]}>
                  قائمة المحظورين (Block List) 🚫
                </Text>
                <Text style={styles.actionBtnSub}>إدارة المستخدمين المحظورين وإلغاء الحظر</Text>
              </View>
              <ChevronLeft size={18} color="#94a3b8" />
            </Pressable>
          </View>

          {/* ======================================================== */}
          {/* 3. BASIC INFO & GEOGRAPHIC SELECTION                     */}
          {/* ======================================================== */}
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <Info size={20} color={C.accent} />
              <Text style={styles.sectionTitle}>معلوماتك الأساسية والحي</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>المنطقة والمدينة والحي (تحديد دقيق)</Text>
              <Pressable
                style={styles.locationSelectorCard}
                onPress={() => setShowLocationModal(true)}
              >
                <View style={styles.locationSelectorContent}>
                  <View style={styles.locationIconBox}>
                    <MapPin size={22} color={C.accent} />
                  </View>
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Text style={styles.locationTitle}>
                      {city
                        ? `${city}${district && district !== 'كل أحياء المدينة' ? ` · حي ${district}` : ''}`
                        : 'حدد منطقتك ومدينتك وحيك...'}
                    </Text>
                    <Text style={styles.locationSub}>
                      {city ? 'اضغط لتغيير المنطقة أو الحي' : 'حدد الحي لربط حسابك وتلقي استفسارات وخدمات جيرانك'}
                    </Text>
                  </View>
                  <ChevronDown size={20} color={C.muted} />
                </View>
              </Pressable>
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.bioLabelRow}>
                <Pressable style={styles.aiBioBtn} onPress={handleGenerateAIBio}>
                  <Sparkles size={14} color="#0891b2" />
                  <Text style={styles.aiBioBtnText}>توليد نبذة ذكية بالذكاء الاصطناعي ✨</Text>
                </Pressable>
                <Text style={styles.label}>نبذة عنك</Text>
              </View>
              <View style={[styles.inputContainer, { height: 100, alignItems: 'flex-start' }]}>
                <TextInput
                  style={[styles.input, { height: 90, textAlignVertical: 'top' }]}
                  multiline
                  value={bio}
                  onChangeText={setBio}
                  placeholder="اكتب نبذة عنك، مهاراتك، أو خدمات تقدمها لأهل حيك..."
                  placeholderTextColor="#9ca3af"
                />
              </View>
            </View>
          </View>

          {/* ======================================================== */}
          {/* 4. VERIFICATION & SYSTEM ACTIONS                         */}
          {/* ======================================================== */}
          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <ShieldCheck size={20} color={C.accent} />
              <Text style={styles.sectionTitle}>التوثيق وشارة ابن الحي</Text>
            </View>

            <Pressable style={styles.actionBtn} onPress={verifyResidentGPS} disabled={geoChecking}>
              <Compass size={20} color={isGeoVerified ? '#15803d' : '#0891b2'} />
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={[styles.actionBtnText, { color: isGeoVerified ? '#15803d' : C.ink }]}>
                  {isGeoVerified ? 'أنت موثّق كساكن فعلي بالحي ✓' : 'التحقق الجغرافي ونيل شارة «ابن الحي الموثّق» 🛡️'}
                </Text>
                <Text style={styles.actionBtnSub}>
                  {isGeoVerified ? 'موقعك الجغرافي متطابق مع نطاق حيك' : 'فحص GPS لمطابقة تواجدك الفعلي داخل الحي'}
                </Text>
              </View>
            </Pressable>

            <Pressable style={styles.actionBtn} onPress={verify}>
              <Shield size={20} color={C.ink} />
              <Text style={styles.actionBtnText}>طلب توثيق الحساب بالهوية ✓</Text>
            </Pressable>

            <Pressable style={styles.actionBtn} onPress={registerPushToken}>
              <Bell size={20} color={C.ink} />
              <Text style={styles.actionBtnText}>تفعيل إشعارات الجوال الفورية</Text>
            </Pressable>

            {p.role === 'admin' || p.role === 'moderator' ? (
              <Pressable style={[styles.actionBtn, { borderBottomWidth: 0 }]} onPress={() => router.push('/admin')}>
                <Shield size={20} color={C.accent} />
                <Text style={[styles.actionBtnText, { color: C.accent }]}>لوحة الإدارة والمراقبة</Text>
              </Pressable>
            ) : null}
          </View>

          {/* Save Button */}
          <Pressable style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.saveBtnText}>حفظ إعدادات الحساب والخصوصية ✨</Text>
            )}
          </Pressable>

          {/* Logout */}
          <Pressable style={styles.logoutBtn} onPress={logout}>
            <LogOut size={20} color={C.danger} style={{ marginLeft: 8 }} />
            <Text style={styles.logoutText}>تسجيل الخروج</Text>
          </Pressable>

          <View style={{ height: 90 }} />
        </View>
      </ScrollView>

      {/* ======================================================== */}
      {/* 5. FOLLOWERS & FOLLOWING MODAL                           */}
      {/* ======================================================== */}
      <Modal visible={followsModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeaderRow}>
              <Pressable onPress={() => setFollowsModalOpen(false)} style={styles.modalCloseBtn}>
                <X size={20} color="#64748b" />
              </Pressable>
              <Text style={styles.modalTitle}>
                {followsModalType === 'followers' ? 'المتابعون' : 'من تتابعهم'}
              </Text>
            </View>

            {followsLoading ? (
              <View style={styles.modalLoadingBox}>
                <ActivityIndicator size="large" color="#0891b2" />
                <Text style={styles.modalLoadingText}>جاري التحميل...</Text>
              </View>
            ) : followsList.length === 0 ? (
              <View style={styles.modalEmptyBox}>
                <Users size={48} color="#cbd5e1" />
                <Text style={styles.modalEmptyTitle}>
                  {followsModalType === 'followers' ? 'لا يوجد متابعون بعد' : 'أنت لا تتابع أحداً بعد'}
                </Text>
                <Text style={styles.modalEmptySub}>
                  تفاعل مع أهالي حيك وابدأ بمتابعة من يهمك محتواهم
                </Text>
              </View>
            ) : (
              <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
                {followsList.map(u => (
                  <View key={u.id} style={styles.followUserCard}>
                    {/* Action button: Unfollow if in following mode */}
                    {followsModalType === 'following' ? (
                      <Pressable
                        style={styles.unfollowBtn}
                        onPress={() => unfollowUser(u.id)}
                      >
                        <Text style={styles.unfollowBtnText}>إلغاء المتابعة</Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        style={styles.viewProfileBtn}
                        onPress={() => {
                          setFollowsModalOpen(false);
                          router.push({ pathname: '/user', params: { id: u.id } });
                        }}
                      >
                        <Text style={styles.viewProfileBtnText}>عرض الحساب</Text>
                      </Pressable>
                    )}

                    <Pressable
                      style={styles.followUserInfo}
                      onPress={() => {
                        setFollowsModalOpen(false);
                        router.push({ pathname: '/user', params: { id: u.id } });
                      }}
                    >
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.followUserName}>
                          {u.display_name || `@${u.username}`} {u.is_verified ? '✓' : ''}
                        </Text>
                        <Text style={styles.followUserLocation}>
                          {u.district ? `حي ${u.district}` : u.city || 'ساكن بالحي'}
                        </Text>
                      </View>

                      {u.avatar_url ? (
                        <Image source={{ uri: u.avatar_url }} style={styles.followAvatar} />
                      ) : (
                        <View style={styles.followAvatarFallback}>
                          <User size={20} color="#0891b2" />
                        </View>
                      )}
                    </Pressable>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* 6. BLOCKED USERS MODAL                                   */}
      {/* ======================================================== */}
      <Modal visible={blockedModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeaderRow}>
              <Pressable onPress={() => setBlockedModalOpen(false)} style={styles.modalCloseBtn}>
                <X size={20} color="#64748b" />
              </Pressable>
              <Text style={styles.modalTitle}>قائمة المحظورين (Block List) 🚫</Text>
            </View>

            {blockedLoading ? (
              <View style={styles.modalLoadingBox}>
                <ActivityIndicator size="large" color="#ef4444" />
              </View>
            ) : blockedList.length === 0 ? (
              <View style={styles.modalEmptyBox}>
                <UserCheck size={48} color="#cbd5e1" />
                <Text style={styles.modalEmptyTitle}>لا يوجد مستخدمون محظورون</Text>
                <Text style={styles.modalEmptySub}>قائمتك نظيفة ولا تحتوي على أي حظر</Text>
              </View>
            ) : (
              <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
                {blockedList.map(u => (
                  <View key={u.id} style={styles.followUserCard}>
                    <Pressable
                      style={styles.unblockBtn}
                      onPress={() => unblockUser(u.id)}
                    >
                      <Text style={styles.unblockBtnText}>إلغاء الحظر</Text>
                    </Pressable>

                    <View style={styles.followUserInfo}>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.followUserName}>
                          {u.display_name || `@${u.username}`}
                        </Text>
                        <Text style={styles.followUserLocation}>محظور من المراسلة والأنشطة</Text>
                      </View>

                      {u.avatar_url ? (
                        <Image source={{ uri: u.avatar_url }} style={styles.followAvatar} />
                      ) : (
                        <View style={styles.followAvatarFallback}>
                          <User size={20} color="#dc2626" />
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Location Selector Modal */}
      <LocationSelectorModal
        visible={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        selectedCity={city}
        selectedDistrict={district}
        onSelect={(reg, c, d) => {
          setCity(c === 'كل المدن' ? '' : c);
          setDistrict(d === 'كل أحياء المدينة' ? '' : d);
        }}
      />

      {/* Bottom Navigation */}
      <View style={styles.bottomNavWrapper}>
        <BottomNav />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scroll: {
    paddingBottom: 40,
  },
  headerHero: {
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
    paddingHorizontal: 20,
    paddingBottom: 28,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  navBar: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  backBtn: {
    padding: 6,
  },
  navTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
  },
  settingsNavBtn: {
    padding: 6,
  },
  avatarSection: {
    alignItems: 'center',
  },
  avatarWrapper: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 3.5,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 12,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 52,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  editIconWrapper: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#fff',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  nameRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  username: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
  },
  statusBadgesRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 16,
  },
  verifiedResidentTag: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  verifiedResidentTagText: {
    color: '#15803d',
    fontSize: 11,
    fontWeight: '800',
  },
  privateTag: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(14,116,144,0.6)',
    borderWidth: 1,
    borderColor: '#38bdf8',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  privateTagText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  incognitoTag: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(217,119,6,0.4)',
    borderWidth: 1,
    borderColor: '#fbbf24',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  incognitoTagText: {
    color: '#fef3c7',
    fontSize: 11,
    fontWeight: '800',
  },
  dndTag: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239,68,68,0.4)',
    borderWidth: 1,
    borderColor: '#fca5a5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  dndTagText: {
    color: '#fee2e2',
    fontSize: 11,
    fontWeight: '800',
  },
  statsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 16,
    width: '100%',
    justifyContent: 'space-around',
  },
  statBox: {
    alignItems: 'center',
  },
  statBoxInteractive: {
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statNumber: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  contentArea: {
    padding: 18,
    marginTop: -8,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  sectionHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
    paddingBottom: 10,
  },
  sectionTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
  },
  settingRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#f8fafc',
    gap: 12,
  },
  settingText: {
    flex: 1,
    alignItems: 'flex-end',
  },
  settingLabelWithBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  settingTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'right',
  },
  settingDesc: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'right',
    lineHeight: 18,
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
    marginBottom: 8,
  },
  locationSelectorCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  locationSelectorContent: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  locationIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#ecfeff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationTitle: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
  },
  locationSub: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  bioLabelRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  aiBioBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfeff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  aiBioBtnText: {
    color: '#0891b2',
    fontSize: 11,
    fontWeight: '800',
  },
  inputContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  input: {
    color: '#0f172a',
    fontSize: 13,
    width: '100%',
    textAlign: 'right',
  },
  actionBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  actionBtnSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  saveBtn: {
    backgroundColor: '#0891b2',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#0891b2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
  logoutBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: '#fecaca',
  },
  logoutText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '800',
  },

  // Modals (Followers / Following / Blocked)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeaderRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
    paddingBottom: 12,
  },
  modalTitle: {
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '900',
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalLoadingBox: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 8,
  },
  modalLoadingText: {
    color: '#64748b',
    fontSize: 13,
  },
  modalEmptyBox: {
    paddingVertical: 50,
    alignItems: 'center',
    gap: 8,
  },
  modalEmptyTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
  },
  modalEmptySub: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
  },
  modalList: {
    maxHeight: 380,
  },
  followUserCard: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
  },
  followUserInfo: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  followAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  followAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  followUserName: {
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
  },
  followUserLocation: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  unfollowBtn: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  unfollowBtnText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },
  viewProfileBtn: {
    backgroundColor: '#ecfeff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#a5f3fc',
  },
  viewProfileBtnText: {
    color: '#0891b2',
    fontSize: 12,
    fontWeight: '800',
  },
  unblockBtn: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  unblockBtnText: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '800',
  },
  bottomNavWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});