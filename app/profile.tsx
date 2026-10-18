import { useBottomNavInset } from '@/lib/bottomNav';
import { AppHeader } from '@/components/shared/AppHeader';
import React, { useState, useCallback, useEffect } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Platform,
  ActivityIndicator,
  Share,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/ui';
import { savePermanentMyLocation, getLockedCity, type LockedCity } from '@/lib/locationSync';
import { getCurrentDeviceLocation, reverseGeocodeDeviceLocation } from '@/lib/deviceLocation';
import { NeighborBadgesCard } from '@/components/profile/NeighborBadgesCard';
import {
  Camera,
  MapPin,
  ChevronRight,
  ChevronLeft,
  User,
  Settings,
  Sparkles,
  ChevronDown,
  Users,
  X,
  Bookmark,
  MessageCircle,
  Sliders,
  ShieldCheck,
  CheckCircle2,
  Shield,
  Pencil,
  Share2,
  BadgeCheck,
  HelpCircle,
} from 'lucide-react-native';
import ActionSheet from '@/components/ActionSheet';
import LocationSelectorModal from '@/components/LocationSelectorModal';
import { generateSmartBioAI } from '@/lib/aiAssistant';

function formatDistrictLabel(value: string) {
  const districtName = value.trim();
  return /^حي(?:\s|$)/u.test(districtName) ? districtName : `حي ${districtName}`;
}

function nextMonthDate(value: string) {
  const date = new Date(value);
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + 1);
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, lastDay));
  return date;
}

export default function Profile() {
  const bottomNavInset = useBottomNavInset();
  const [p, setP] = useState<any>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [personalName, setPersonalName] = useState('');
  const [usernameDraft, setUsernameDraft] = useState('');
  const [usernameSaving, setUsernameSaving] = useState(false);
  const [usernameChangedAt, setUsernameChangedAt] = useState<string | null>(null);
  const usernameNextChangeAt = usernameChangedAt ? nextMonthDate(usernameChangedAt) : null;
  const usernameChangeLocked = Boolean(usernameNextChangeAt && usernameNextChangeAt.getTime() > Date.now());
  const [region, setRegion] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [bio, setBio] = useState('');
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [locating, setLocating] = useState(false);
  const [lockedCity, setLockedCity] = useState<LockedCity | null>(null);

  const [stats, setStats] = useState({ questions: 0, answers: 0, followers: 0, following: 0 });
  const [savedQuestions, setSavedQuestions] = useState<any[]>([]);
  const profileCompletion = Math.round(([
    Boolean(p.avatar_url),
    Boolean(personalName.trim()),
    Boolean(p.username),
    Boolean(region.trim() && city.trim() && district.trim()),
    Boolean(bio.trim()),
  ].filter(Boolean).length / 5) * 100);

  const [activeTab, setActiveTab] = useState<'posts' | 'replies' | 'saved'>('posts');
  const [myQuestions, setMyQuestions] = useState<any[]>([]);
  const [myAnswers, setMyAnswers] = useState<any[]>([]);

  // Follows modal state
  const [followsModalOpen, setFollowsModalOpen] = useState(false);
  const [followsModalType, setFollowsModalType] = useState<'followers' | 'following'>('followers');
  const [followsList, setFollowsList] = useState<any[]>([]);
  const [followsLoading, setFollowsLoading] = useState(false);

  const [reputationPoints, setReputationPoints] = useState(15);

  const loadProfile = useCallback(async () => {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return;
    const uid = authData.user.id;
    setUserId(uid);

    const r = await supabase.from('profiles').select('*').eq('id', uid).single();

    const [qCount, aCount, followersCount, followingCount, savedRes, postsRes, repliesRes, repRes] = await Promise.all([
      supabase.from('questions').select('id', { count: 'exact', head: true }).eq('author_id', uid),
      supabase.from('answers').select('id', { count: 'exact', head: true }).eq('author_id', uid),
      supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', uid),
      supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', uid),
      supabase.from('saved_questions').select('*, questions(id, title, body, created_at, city, district, author_id)').eq('user_id', uid).order('created_at', { ascending: false }).limit(20),
      supabase.from('questions').select('id, title, body, created_at, city, district').eq('author_id', uid).order('created_at', { ascending: false }).limit(50),
      supabase.from('answers').select('id, body, created_at, question_id, questions(title)').eq('author_id', uid).order('created_at', { ascending: false }).limit(50),
      supabase.from('reputation').select('points').eq('user_id', uid).maybeSingle(),
    ]);

    setReputationPoints(repRes.data?.points || 15);

    setStats({
      questions: qCount.count || 0,
      answers: aCount.count || 0,
      followers: followersCount.count || 0,
      following: followingCount.count || 0,
    });

    const savedItems = (savedRes.data || []).map((s: any) => s.questions).filter(Boolean);
    setSavedQuestions(savedItems);
    setMyQuestions(postsRes.data || []);
    setMyAnswers(repliesRes.data || []);

    if (r.data) {
      setP(r.data);
      setPersonalName(r.data.display_name || '');
      setUsernameDraft(r.data.username || '');
      setUsernameChangedAt(r.data.username_last_changed_at || null);
      setRegion(r.data.region || '');
      setCity(r.data.city || '');
      setDistrict(r.data.district || '');
      setBio(r.data.bio || '');
    }
  }, []);

  useEffect(() => {
    void getLockedCity().then(setLockedCity);
  }, []);

  const syncCurrentLocation = useCallback(async (showAlert = false) => {
    const location = await getCurrentDeviceLocation();
    if (!location) {
      if (showAlert) Alert.alert('تعذّر تحديد الموقع', 'اسمح لحيّنا باستخدام موقعك أثناء الاستخدام ثم حاول مرة أخرى.');
      return false;
    }

    const place = await reverseGeocodeDeviceLocation(location);
    const nextRegion = place?.region?.trim() || '';
    const nextCity = place?.city?.trim() || '';
    const nextDistrict = place?.district?.trim() || '';

    if (!nextRegion || !nextCity || !nextDistrict) {
      if (showAlert) Alert.alert('الموقع غير مكتمل', 'تم تحديد موقعك، لكن لم نستطع استخراج المنطقة والمدينة والحي بدقة. حاول مرة أخرى.');
      return false;
    }

    const next = { region: nextRegion, city: nextCity, district: nextDistrict };
    setRegion(nextRegion);
    setCity(nextCity);
    setDistrict(nextDistrict);

    await savePermanentMyLocation(next, true, { allowCityChange: true });
    setLockedCity({ region: nextRegion, city: nextCity });

    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) {
      const { error } = await supabase.from('profiles').update(next).eq('id', auth.user.id);
      if (error) throw error;
    }

    setP((current: any) => ({ ...(current || {}), ...next }));
    if (showAlert) {
      Alert.alert('تم تحديث موقعك الحالي', 'حيّنا الآن يتبع موقعك الحالي: ' + nextRegion + ' · ' + nextCity + ' · حي ' + nextDistrict);
    }
    return true;
  }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      const refreshProfileOnly = async () => {
        await loadProfile();
      };
      void refreshProfileOnly();
      return () => { cancelled = true; };
    }, [loadProfile])
  );

  async function useCurrentLocation() {
    if (locating) return;
    setLocating(true);
    try {
      await syncCurrentLocation(true);
    } catch (error: any) {
      Alert.alert('تعذّر حفظ الموقع', error?.message || 'حاول مرة أخرى.');
    } finally {
      setLocating(false);
    }
  }

  async function pickAvatar() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    if (!userId) return;
    const asset = result.assets[0];
    const response = await fetch(asset.uri);
    const blob = await response.arrayBuffer();
    const path = userId + '/avatar.jpg';
    const up = await supabase.storage.from('avatars').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
    if (up.error) return Alert.alert('خطأ', up.error.message);
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    const saved = await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', userId).select('id').maybeSingle();
    if (saved.error) return Alert.alert('تعذّر حفظ الصورة', saved.error.message);
    if (!saved.data) return Alert.alert('تعذّر حفظ الصورة', 'لم يتم تحديث ملف الحساب. أعد تسجيل الدخول ثم حاول مجدداً.');
    setP({ ...p, avatar_url: data.publicUrl });
  }

  async function save() {
    const uid = userId;
    if (!uid) return;
    if (!region.trim() || !city.trim() || !district.trim()) {
      return Alert.alert('الموقع مطلوب', 'لا يمكن حفظ الملف بدون المنطقة والمدينة والحي. استخدم «استخدام موقعي الحالي» للتعبئة تلقائياً.');
    }
    setSaving(true);

    const payload: any = {
      display_name: personalName.trim() || null,
      region: region.trim() || null,
      city: city.trim() || null,
      district: district.trim() || null,
      bio: bio.trim() || null,
    };

    try {
      const result = await supabase.from('profiles').update(payload).eq('id', uid).select('*').maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) throw new Error('لم يُحدّث أي سجل في قاعدة البيانات. أعد فتح الصفحة وحاول مرة أخرى.');

      setP((current: any) => ({ ...current, ...payload }));
      await savePermanentMyLocation({
        region: region.trim(),
        city: city.trim(),
        district: district.trim(),
      }, false);
      
      const { data: freshProfile } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
      if (freshProfile) {
        setP(freshProfile);
        setPersonalName(freshProfile.display_name || '');
        setRegion(freshProfile.region || '');
        setCity(freshProfile.city || '');
        setDistrict(freshProfile.district || '');
        setBio(freshProfile.bio || '');
      }
      setEditingProfile(false);
      Alert.alert('تم الحفظ', 'تم تحديث بيانات ملفك الشخصي بنجاح.');
    } catch (error: any) {
      Alert.alert('تعذّر الحفظ', error?.message || 'لم يتم تحديث الملف. تحقق من الاتصال وحاول مجدداً.');
    } finally {
      setSaving(false);
    }
  }

  async function changeUsername() {
    const nextUsername = usernameDraft.trim().toLowerCase();
    if (!/^[a-zA-Z0-9_]{3,30}$/.test(nextUsername)) {
      return Alert.alert('اسم المستخدم غير صالح', 'استخدم من 3 إلى 30 حرفاً إنجليزياً أو رقماً أو شرطة سفلية.');
    }
    if (nextUsername === String(p.username || '').toLowerCase()) {
      return Alert.alert('لا يوجد تغيير', 'هذا هو اسم المستخدم الحالي.');
    }

    setUsernameSaving(true);
    try {
      const { data, error } = await supabase.rpc('change_my_username', { p_username: nextUsername });
      if (error) throw error;
      const changedAt = typeof data === 'string' ? data : new Date().toISOString();
      setP((current: any) => ({ ...current, username: nextUsername, username_last_changed_at: changedAt }));
      setUsernameDraft(nextUsername);
      setUsernameChangedAt(changedAt);
      Alert.alert('تم تغيير اسم المستخدم', 'يمكنك تغييره مرة أخرى بعد شهر.');
    } catch (error: any) {
      const message = error?.message || '';
      const userMessage = message.includes('username_change_cooldown')
        ? 'لا يمكن تغيير اسم المستخدم إلا مرة واحدة كل شهر.'
        : message.includes('username_taken') || message.includes('duplicate key')
          ? 'اسم المستخدم مستخدم بالفعل، اختر اسماً آخر.'
          : message.includes('invalid_username')
            ? 'استخدم من 3 إلى 30 حرفاً إنجليزياً أو رقماً أو شرطة سفلية.'
            : message || 'تعذر تغيير اسم المستخدم.';
      Alert.alert('تعذّر تغيير الاسم', userMessage);
    } finally {
      setUsernameSaving(false);
    }
  }

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

  async function unfollowUser(targetId: string) {
    if (!userId) return;
    await supabase.from('follows').delete().eq('follower_id', userId).eq('following_id', targetId);
    setFollowsList(prev => prev.filter(u => u.id !== targetId));
    setStats(s => ({ ...s, following: Math.max(0, s.following - 1) }));
  }

  function handleGenerateAIBio() {
    const generated = generateSmartBioAI(city || 'الرياض', district || 'الياسمين');
    setBio(generated);
  }

  async function applyManualLocation(reg: string, c: string, d: string) {
    const nextRegion = reg === 'كل المملكة' ? '' : reg.trim();
    const nextCity = c === 'كل المدن' ? '' : c.trim();
    const nextDistrict = (d === 'كل أحياء المدينة' || d === 'كل الأحياء') ? '' : d.trim();

    if (!nextRegion || !nextCity || !nextDistrict) {
      Alert.alert('الموقع مطلوب', 'يجب تحديد المنطقة والمدينة والحي حتى يبقى حسابك مرتبطاً بموقعك الحالي.');
      return;
    }

    if (lockedCity && nextCity !== lockedCity.city) {
      Alert.alert(
        'المدينة مقفلة',
        `موقعك مُثبّت عبر GPS على مدينة ${lockedCity.city}. لا يمكن تغيير المدينة، لكن يمكنك اختيار أي حي داخل مدينتك.`,
      );
      return;
    }

    setRegion(nextRegion);
    setCity(nextCity);
    setDistrict(nextDistrict);
    try {
      await savePermanentMyLocation(
        { region: nextRegion, city: nextCity, district: nextDistrict },
        true
      );
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data: updated, error } = await supabase
        .from('profiles')
        .update({ region: nextRegion, city: nextCity, district: nextDistrict })
        .eq('id', auth.user.id)
        .select('*')
        .maybeSingle();
      if (error) throw error;
      if (!updated) throw new Error('لم يتم تحديث موقع الحساب.');
      setP((current: any) => ({ ...(current || {}), ...updated }));
    } catch (error: any) {
      Alert.alert('تعذّر حفظ الموقع', error?.message || 'حاول مرة أخرى.');
    }
  }

  const shareProfile = async () => {
    const text = `حسابي في تطبيق حيّنا: @${p.username || 'user'}\nتعال شارك معنا في مجتمع الحي!`;
    try {
      await Share.share({ message: text, title: personalName || 'الملف الشخصي' });
    } catch {}
  };

  return (
    <View style={styles.container}>
      <AppHeader
        variant="sub"
        title="الملف الشخصي"
        subtitle="هويتك وحضورك ومشاركاتك في الحي"
        fallbackRoute="/home"
        rightAction={
          <Pressable
            onPress={() => router.push('/settings')}
            style={styles.headerBtn}
            accessibilityRole="button"
            accessibilityLabel="مركز الإعدادات والتحكم"
          >
            <Settings size={18} color="#047857" />
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomNavInset + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ======================================================== */}
        {/* UNIFIED NAVIGATION SWITCHER (Profile ⇄ Settings)        */}
        {/* ======================================================== */}
        <View style={styles.navSegmentContainer}>
          <View style={styles.navSegmentWrap}>
            <Pressable
              style={[styles.navSegmentBtn, styles.navSegmentBtnActive]}
              onPress={() => {}}
            >
              <User size={14} color="#fff" />
              <Text style={[styles.navSegmentText, styles.navSegmentTextActive]}>
                الملف الشخصي
              </Text>
            </Pressable>

            <Pressable
              style={styles.navSegmentBtn}
              onPress={() => router.push('/settings')}
            >
              <Settings size={14} color="#64748b" />
              <Text style={styles.navSegmentText}>
                مركز الإعدادات والتحكم
              </Text>
            </Pressable>
          </View>
        </View>
        <Pressable
          onPress={() => router.push('/profile-customization')}
          style={{ marginHorizontal: 16, marginTop: 10, padding: 13, borderRadius: 14, borderWidth: 1, borderColor: '#a7f3d0', backgroundColor: '#ecfdf5', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          accessibilityRole="button"
          accessibilityLabel="تخصيص الملف وإدارة الأعمال المميزة"
        >
          <Sparkles size={16} color="#047857" />
          <Text style={{ color: '#047857', fontWeight: '800' }}>تخصيص الملف والأعمال المميزة</Text>
        </Pressable>

        {/* ======================================================== */}
        {/* EXECUTIVE PROFILE HERO CARD                              */}
        {/* ======================================================== */}
        <View style={styles.heroOuterWrap}>
          <View style={styles.heroCard}>
            <View style={styles.heroTopActions}>
              <Pressable style={styles.heroActionBtn} onPress={shareProfile}>
                <Share2 size={15} color="#128c7e" />
              </Pressable>
              <Pressable
                style={[styles.heroEditPill, editingProfile && styles.heroEditPillActive]}
                onPress={() => setEditingProfile(v => !v)}
              >
                <Pencil size={13} color="#128c7e" />
                <Text style={[styles.heroEditPillText, editingProfile && styles.heroEditPillTextActive]}>
                  {editingProfile ? 'إغلاق التعديل' : 'تعديل البيانات'}
                </Text>
              </Pressable>
            </View>

            {/* Avatar & Main Identity */}
            <View style={styles.identityRow}>
              <Pressable onPress={pickAvatar} style={styles.avatarWrap}>
                {p.avatar_url ? (
                  <Image source={{ uri: p.avatar_url }} style={styles.avatarImg} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarFallbackText}>
                      {(personalName || p.username || 'ج')[0]?.toUpperCase() || 'ج'}
                    </Text>
                  </View>
                )}
                <View style={styles.avatarCameraBadge}>
                  <Camera size={13} color="#fff" />
                </View>
              </Pressable>

              <View style={styles.identityTextCol}>
                <View style={styles.displayNameRow}>
                  <Text style={styles.displayNameText} numberOfLines={1}>
                    {personalName || 'أضف اسمك الكريم'}
                  </Text>
                  {p.is_verified && <BadgeCheck size={18} color="#128c7e" />}
                </View>

                <Text style={styles.usernameText}>@{p.username || 'username'}</Text>

                {(city || district) ? (
                  <View style={styles.locationPill}>
                    <MapPin size={11} color="#128c7e" />
                    <Text style={styles.locationPillText} numberOfLines={1}>
                      {[district && formatDistrictLabel(district), city].filter(Boolean).join(' · ')}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* Bio text */}
            {!!bio.trim() && (
              <View style={styles.bioContainer}>
                <Text style={styles.bioText}>{bio}</Text>
              </View>
            )}

            {/* High-Contrast Interactive Stats Ribbon */}
            <View style={styles.statsRibbon}>
              <Pressable onPress={() => openFollowsModal('followers')} style={styles.statBox}>
                <Text style={styles.statNumber}>{stats.followers}</Text>
                <Text style={styles.statLabel}>متابع</Text>
              </Pressable>
              <View style={styles.statDivider} />
              <Pressable onPress={() => openFollowsModal('following')} style={styles.statBox}>
                <Text style={styles.statNumber}>{stats.following}</Text>
                <Text style={styles.statLabel}>يتابع</Text>
              </Pressable>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>{stats.questions + stats.answers}</Text>
                <Text style={styles.statLabel}>مشاركات</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 2 }}>
                  <Text style={styles.statNumber}>{reputationPoints}</Text>
                  <Text style={{ fontSize: 11 }}>⭐</Text>
                </View>
                <Text style={styles.statLabel}>السمعة</Text>
              </View>
            </View>

            {/* Profile Completion Bar */}
            <View style={styles.completionSection}>
              <View style={styles.completionHeading}>
                <Text style={styles.completionTitle}>
                  {profileCompletion === 100 ? 'الملف الشخصي مكتمل بنجاح ✓' : 'اكتمال بيانات الحساب'}
                </Text>
                <Text style={styles.completionPercent}>{profileCompletion}%</Text>
              </View>
              <View style={styles.completionTrack}>
                <View style={[styles.completionFill, { width: `${profileCompletion}%` }]} />
              </View>
              {profileCompletion < 100 && !editingProfile && (
                <Pressable onPress={() => setEditingProfile(true)} style={styles.completePrompt}>
                  <Sparkles size={12} color="#fef08a" />
                  <Text style={styles.completePromptText}>أكمل بياناتك ليتعرف عليك جيران الحي بسهولة</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>

        {/* ======================================================== */}
        {/* EDIT PROFILE EXPANDABLE FORM                             */}
        {/* ======================================================== */}
        {editingProfile && (
          <View style={styles.editSectionOuter}>
            <View style={styles.editCard}>
              <View style={styles.editCardHeader}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                  <Pencil size={16} color="#059669" />
                  <Text style={styles.editCardTitle}>تعديل بيانات الملف الشخصي</Text>
                </View>
                <Pressable onPress={() => setEditingProfile(false)} style={styles.editCardCloseBtn}>
                  <X size={16} color="#64748b" />
                </Pressable>
              </View>

              <Text style={styles.inputLabel}>الاسم الشخصي (الظاهر للجيران)</Text>
              <TextInput
                style={styles.textInput}
                value={personalName}
                onChangeText={setPersonalName}
                placeholder="اسمك الذي يظهر للناس"
                placeholderTextColor="#94a3b8"
                maxLength={60}
              />

              <Text style={[styles.inputLabel, { marginTop: 12 }]}>اسم المستخدم (@username)</Text>
              <View style={styles.usernameRow}>
                <Text style={styles.usernameAt}>@</Text>
                <TextInput
                  style={[styles.textInput, styles.usernameField]}
                  value={usernameDraft}
                  onChangeText={setUsernameDraft}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={30}
                  placeholder="username"
                  placeholderTextColor="#94a3b8"
                />
              </View>
              <Text style={styles.fieldHint}>
                {usernameChangeLocked
                  ? `يمكنك تغيير اسم المستخدم مجدداً بعد ${usernameNextChangeAt?.toLocaleDateString('ar-SA')}`
                  : 'يمكنك تغيير اسم المستخدم مرة واحدة كل شهر.'}
              </Text>
              <Pressable
                style={[styles.usernameChangeBtn, usernameChangeLocked && styles.btnDisabled]}
                onPress={changeUsername}
                disabled={usernameSaving || usernameChangeLocked || usernameDraft.trim().toLowerCase() === String(p.username || '').toLowerCase()}
              >
                {usernameSaving ? <ActivityIndicator size="small" color="#047857" /> : <Text style={styles.usernameChangeBtnText}>تأكيد تغيير اسم المستخدم</Text>}
              </Pressable>

              <Text style={[styles.inputLabel, { marginTop: 14 }]}>
                {lockedCity ? `الحي المعتمد داخل ${lockedCity.city}` : 'المدينة والحي'}
              </Text>
              <Pressable style={styles.locationSelectorBtn} onPress={() => setShowLocationModal(true)}>
                <MapPin size={18} color="#059669" />
                <Text style={styles.locationSelectorValue} numberOfLines={1}>
                  {city ? `${region ? `${region} · ` : ''}${city}${district ? ` · ${formatDistrictLabel(district)}` : ''}` : (lockedCity ? 'اختر حياً داخل مدينتك' : 'اختر المنطقة والمدينة والحي')}
                </Text>
                <ChevronDown size={16} color="#64748b" />
              </Pressable>

              <Pressable style={styles.gpsSyncBtn} onPress={useCurrentLocation} disabled={locating}>
                <MapPin size={15} color="#059669" />
                <Text style={styles.gpsSyncBtnText}>{locating ? 'جارٍ تحديد موقعك الحالي...' : 'تحديث الموقع عبر GPS تلقائياً'}</Text>
              </Pressable>

              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
                <Text style={styles.inputLabel}>نبذة عنك (Bio)</Text>
                <Pressable onPress={handleGenerateAIBio} style={styles.aiBioBtn}>
                  <Sparkles size={13} color="#059669" />
                  <Text style={styles.aiBioBtnText}>اقتراح ذكي بالذكاء الاصطناعي</Text>
                </Pressable>
              </View>
              <TextInput
                style={[styles.textInput, styles.bioField]}
                value={bio}
                onChangeText={setBio}
                placeholder="اكتب نبذة مختصرة عن اهتماماتك أو مجالك ليتعرف عليك الجيران..."
                placeholderTextColor="#94a3b8"
                multiline
                maxLength={240}
              />

              <Pressable style={[styles.saveBtn, saving && styles.btnDisabled]} onPress={save} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <CheckCircle2 size={16} color="#fff" />
                    <Text style={styles.saveBtnText}>حفظ وتحديث الملف الشخصي</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        )}

        {/* ======================================================== */}
        {/* NEIGHBOR TRUST & BADGES CARD                             */}
        {/* ======================================================== */}
        <View style={styles.badgesWrapper}>
          <NeighborBadgesCard
            userId={userId || p?.id || ''}
            isVerifiedNeighbor={Boolean(p.is_verified_neighbor || p.is_geoverified)}
            city={city}
            district={district}
            reputationPoints={reputationPoints}
            badges={Array.isArray(p.badges) ? p.badges : ['جار جديد 👋', 'صاحب الفزعات 🤝']}
            onVerifiedSuccess={loadProfile}
          />
        </View>

        {/* ======================================================== */}
        {/* ACTIVITY FEED & POSTS TABS                               */}
        {/* ======================================================== */}
        <View style={styles.feedSectionOuter}>
          <View style={styles.tabsBar}>
            {([
              ['posts', 'المنشورات والاستفسارات', myQuestions.length],
              ['replies', 'الردود والمشاركات', myAnswers.length],
              ['saved', 'المحفوظات', savedQuestions.length],
            ] as const).map(([key, label, count]) => {
              const active = activeTab === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => setActiveTab(key)}
                  style={[styles.tabItem, active && styles.tabItemActive]}
                >
                  <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                    {label}
                  </Text>
                  <View style={[styles.tabCountPill, active && styles.tabCountPillActive]}>
                    <Text style={[styles.tabCountText, active && styles.tabCountTextActive]}>
                      {count}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* TAB 1: POSTS */}
          {activeTab === 'posts' && (
            myQuestions.length > 0 ? (
              <View style={styles.feedList}>
                {myQuestions.map(item => (
                  <Pressable
                    key={item.id}
                    style={styles.feedCard}
                    onPress={() => router.push({ pathname: '/question', params: { id: item.id } })}
                  >
                    <View style={styles.feedCardTop}>
                      <View style={styles.feedCardAvatar}>
                        {p.avatar_url ? (
                          <Image source={{ uri: p.avatar_url }} style={styles.feedCardAvatarImg} />
                        ) : (
                          <User size={16} color="#64748b" />
                        )}
                      </View>
                      <View style={{ flex: 1, alignItems: 'flex-end' }}>
                        <Text style={styles.feedAuthorName}>{personalName || 'مستخدم'}</Text>
                        <Text style={styles.feedCardTime}>
                          {new Date(item.created_at).toLocaleDateString('ar-SA')}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.feedCardTitle}>{item.title}</Text>
                    <Text style={styles.feedCardBody} numberOfLines={3}>{item.body}</Text>

                    {(item.district || item.city) && (
                      <View style={styles.feedCardFooter}>
                        <MapPin size={11} color="#059669" />
                        <Text style={styles.feedCardLocation}>
                          {[item.district && `حي ${item.district}`, item.city].filter(Boolean).join(' · ')}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={styles.emptyFeedBox}>
                <MessageCircle size={36} color="#cbd5e1" />
                <Text style={styles.emptyFeedTitle}>لا توجد منشورات أو استفسارات بعد</Text>
                <Text style={styles.emptyFeedDesc}>شارك جيرانك سؤالاً أو استفساراً في حيك الآن!</Text>
                <Pressable style={styles.emptyFeedBtn} onPress={() => router.push('/ask')}>
                  <Text style={styles.emptyFeedBtnText}>+ طرح استفسار بالحي</Text>
                </Pressable>
              </View>
            )
          )}

          {/* TAB 2: REPLIES */}
          {activeTab === 'replies' && (
            myAnswers.length > 0 ? (
              <View style={styles.feedList}>
                {myAnswers.map(item => (
                  <Pressable
                    key={item.id}
                    style={styles.feedCard}
                    onPress={() => router.push({ pathname: '/question', params: { id: item.question_id } })}
                  >
                    <View style={styles.feedCardTop}>
                      <View style={styles.feedCardAvatar}>
                        {p.avatar_url ? (
                          <Image source={{ uri: p.avatar_url }} style={styles.feedCardAvatarImg} />
                        ) : (
                          <User size={16} color="#64748b" />
                        )}
                      </View>
                      <View style={{ flex: 1, alignItems: 'flex-end' }}>
                        <Text style={styles.feedAuthorName}>ردّك على: {item.questions?.title || 'استفسار من الحي'}</Text>
                        <Text style={styles.feedCardTime}>
                          {new Date(item.created_at).toLocaleDateString('ar-SA')}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.feedCardBody}>{item.body}</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={styles.emptyFeedBox}>
                <MessageCircle size={36} color="#cbd5e1" />
                <Text style={styles.emptyFeedTitle}>لم تشارك بأي ردود بعد</Text>
                <Text style={styles.emptyFeedDesc}>تفاعل مع استفسارات الجيران وساعدهم بالمعلومات المفيدة.</Text>
              </View>
            )
          )}

          {/* TAB 3: SAVED */}
          {activeTab === 'saved' && (
            savedQuestions.length > 0 ? (
              <View style={styles.feedList}>
                {savedQuestions.map(item => (
                  <Pressable
                    key={item.id}
                    style={styles.feedCard}
                    onPress={() => router.push({ pathname: '/question', params: { id: item.id } })}
                  >
                    <View style={styles.feedCardTop}>
                      <View style={[styles.feedCardAvatar, { backgroundColor: '#ecfdf5' }]}>
                        <Bookmark size={16} color="#059669" />
                      </View>
                      <View style={{ flex: 1, alignItems: 'flex-end' }}>
                        <Text style={styles.feedAuthorName}>استفسار محفوظ</Text>
                        <Text style={styles.feedCardTime}>
                          {new Date(item.created_at).toLocaleDateString('ar-SA')}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.feedCardTitle}>{item.title}</Text>
                    <Text style={styles.feedCardBody} numberOfLines={3}>{item.body}</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <View style={styles.emptyFeedBox}>
                <Bookmark size={36} color="#cbd5e1" />
                <Text style={styles.emptyFeedTitle}>لا توجد استفسارات محفوظة</Text>
                <Text style={styles.emptyFeedDesc}>يمكنك حفظ الاستفسارات المهمة للرجوع إليها لاحقاً.</Text>
              </View>
            )
          )}
        </View>

        {/* ======================================================== */}
        {/* SEAMLESS JUMP TO SETTINGS CARD (Zero Duplication)        */}
        {/* ======================================================== */}
        <View style={styles.settingsPromoWrapper}>
          <Pressable style={styles.settingsPromoCard} onPress={() => router.push('/settings')}>
            <View style={styles.settingsPromoIcon}>
              <Shield size={22} color="#059669" />
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={styles.settingsPromoTitle}>مركز الإعدادات والتحكم والأمان</Text>
              <Text style={styles.settingsPromoDesc}>
                تغيير كلمة المرور، البريد، ساعات الصمت، توثيق الهوية، وإدارة الخصوصية
              </Text>
            </View>
            <View style={styles.settingsPromoArrow}>
              <ChevronLeft size={18} color="#059669" />
            </View>
          </Pressable>
        </View>
      </ScrollView>

      {/* ======================================================== */}
      {/* FOLLOWERS & FOLLOWING MODAL                             */}
      {/* ======================================================== */}
      <ActionSheet visible={followsModalOpen} onClose={() => setFollowsModalOpen(false)} height="55%">
        <View style={{ flex: 1 }}>
          <View style={styles.modalHeaderRow}>
            <Pressable onPress={() => setFollowsModalOpen(false)} style={styles.modalCloseBtn}>
              <X size={18} color="#64748b" />
            </Pressable>
            <Text style={styles.modalTitle}>
              {followsModalType === 'followers' ? 'المتابعون في الحي' : 'من تتابعهم في الحي'}
            </Text>
          </View>

          {followsLoading ? (
            <View style={styles.modalLoadingBox}>
              <ActivityIndicator size="large" color="#059669" />
              <Text style={styles.modalLoadingText}>جاري التحميل...</Text>
            </View>
          ) : followsList.length === 0 ? (
            <View style={styles.modalEmptyBox}>
              <Users size={44} color="#cbd5e1" />
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
                        <User size={18} color="#059669" />
                      </View>
                    )}
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </ActionSheet>

      {/* Location Selector Modal */}
      <LocationSelectorModal
        visible={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        selectedCity={city}
        selectedDistrict={district}
        lockedCity={lockedCity}
        onSelect={(reg, c, d) => {
          void applyManualLocation(reg, c, d);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    width: '100%',
  },
  scroll: {
    paddingBottom: 40,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Navigation Switcher Segment (Profile ⇄ Settings)
  navSegmentContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
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
    color: '#fff',
    fontWeight: '900',
  },

  // Executive Hero Card
  heroOuterWrap: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 10,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  heroCard: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e5eeea',
    shadowColor: '#0f172a',
    shadowOpacity: 0.055,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  heroTopActions: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  heroEditPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#e9f6f0',
    borderWidth: 1,
    borderColor: '#d1ebdd',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 14,
  },
  heroEditPillActive: {
    backgroundColor: '#d8f0e3',
    borderColor: '#b7e3c8',
  },
  heroEditPillText: {
    color: '#147d64',
    fontSize: 11.5,
    fontWeight: '800',
  },
  heroEditPillTextActive: {
    color: '#064e3b',
    fontWeight: '900',
  },
  heroActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f2f6f4',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e4ece8',
  },

  // Identity Row
  identityRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 14,
  },
  avatarWrap: {
    width: 82,
    height: 82,
    borderRadius: 41,
    position: 'relative',
    borderWidth: 3,
    borderColor: '#d8eee2',
    shadowColor: '#145b46',
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 38,
  },
  avatarFallback: {
    width: '100%',
    height: '100%',
    borderRadius: 38,
    backgroundColor: '#e3f4eb',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: '#128c7e',
    fontSize: 30,
    fontWeight: '900',
  },
  avatarCameraBadge: {
    position: 'absolute',
    bottom: -2,
    left: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#128c7e',
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityTextCol: {
    flex: 1,
    alignItems: 'flex-end',
  },
  displayNameRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  displayNameText: {
    color: '#18252d',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'right',
  },
  usernameText: {
    color: '#68777e',
    fontSize: 13.5,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'right',
  },
  locationPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#eef7f2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginTop: 6,
  },
  locationPillText: {
    color: '#26745f',
    fontSize: 11,
    fontWeight: '700',
  },

  // Bio
  bioContainer: {
    backgroundColor: '#f5f8f6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#e9efec',
  },
  bioText: {
    color: '#405159',
    fontSize: 12.5,
    lineHeight: 19,
    textAlign: 'right',
  },

  // Stats Ribbon
  statsRibbon: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f7faf8',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#e7efea',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statNumber: {
    color: '#183b31',
    fontSize: 14.5,
    fontWeight: '900',
  },
  statLabel: {
    color: '#66766f',
    fontSize: 10,
    fontWeight: '700',
  },
  statDivider: {
    width: 1,
    height: 22,
    backgroundColor: '#dce9e2',
  },

  // Completion Section
  completionSection: {
    marginTop: 14,
  },
  completionHeading: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  completionTitle: {
    color: '#66766f',
    fontSize: 11.5,
    fontWeight: '800',
  },
  completionPercent: {
    color: '#147d64',
    fontSize: 11.5,
    fontWeight: '900',
  },
  completionTrack: {
    height: 5,
    borderRadius: 3,
    backgroundColor: '#e1eee6',
    overflow: 'hidden',
  },
  completionFill: {
    height: '100%',
    backgroundColor: '#128c7e',
    borderRadius: 3,
  },
  completePrompt: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  completePromptText: {
    color: '#147d64',
    fontSize: 11,
    fontWeight: '700',
  },

  // Edit Section
  editSectionOuter: {
    paddingHorizontal: 16,
    marginBottom: 12,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  editCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  editCardHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
    paddingBottom: 10,
    marginBottom: 12,
  },
  editCardTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0f172a',
  },
  editCardCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
    textAlign: 'right',
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#0f172a',
    textAlign: 'right',
    fontSize: 13.5,
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  usernameAt: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '800',
  },
  usernameField: {
    flex: 1,
    borderWidth: 0,
    textAlign: 'left',
    backgroundColor: 'transparent',
  },
  fieldHint: {
    color: '#64748b',
    fontSize: 11,
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 8,
  },
  usernameChangeBtn: {
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    paddingVertical: 8,
    marginBottom: 4,
  },
  usernameChangeBtnText: {
    color: '#047857',
    fontSize: 12,
    fontWeight: '800',
  },
  locationSelectorBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  locationSelectorValue: {
    flex: 1,
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    marginHorizontal: 8,
  },
  gpsSyncBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 10,
    paddingVertical: 8,
    marginTop: 6,
  },
  gpsSyncBtnText: {
    color: '#047857',
    fontSize: 12,
    fontWeight: '800',
  },
  aiBioBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  aiBioBtnText: {
    color: '#059669',
    fontSize: 11.5,
    fontWeight: '800',
  },
  bioField: {
    minHeight: 74,
    textAlignVertical: 'top',
  },
  saveBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#059669',
    borderRadius: 14,
    paddingVertical: 12,
    marginTop: 14,
    shadowColor: '#059669',
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 13.5,
    fontWeight: '900',
  },
  btnDisabled: {
    opacity: 0.5,
  },

  // Badges wrapper
  badgesWrapper: {
    paddingHorizontal: 16,
    marginBottom: 8,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },

  // Feed Section
  feedSectionOuter: {
    paddingHorizontal: 16,
    marginTop: 6,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  tabsBar: {
    flexDirection: 'row-reverse',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 3,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 4,
    marginBottom: 10,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: 11,
  },
  tabItemActive: {
    backgroundColor: '#0f172a',
  },
  tabLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748b',
  },
  tabLabelActive: {
    color: '#fff',
    fontWeight: '900',
  },
  tabCountPill: {
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  tabCountPillActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  tabCountText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
  },
  tabCountTextActive: {
    color: '#fff',
  },

  // Feed Cards
  feedList: {
    gap: 8,
  },
  feedCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  feedCardTop: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  feedCardAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  feedCardAvatarImg: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  feedAuthorName: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'right',
  },
  feedCardTime: {
    fontSize: 10.5,
    color: '#94a3b8',
    marginTop: 1,
    textAlign: 'right',
  },
  feedCardTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'right',
    lineHeight: 20,
    marginBottom: 4,
  },
  feedCardBody: {
    fontSize: 12.5,
    color: '#475569',
    textAlign: 'right',
    lineHeight: 18,
  },
  feedCardFooter: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
  },
  feedCardLocation: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '700',
  },

  emptyFeedBox: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingVertical: 36,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  emptyFeedTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 4,
  },
  emptyFeedDesc: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  emptyFeedBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    marginTop: 8,
  },
  emptyFeedBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },

  // Promo card to jump smoothly to Settings
  settingsPromoWrapper: {
    paddingHorizontal: 16,
    marginTop: 14,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  settingsPromoCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  settingsPromoIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  settingsPromoTitle: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'right',
  },
  settingsPromoDesc: {
    fontSize: 11.5,
    color: '#64748b',
    textAlign: 'right',
    marginTop: 2,
    lineHeight: 16,
  },
  settingsPromoArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Modals
  modalHeaderRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
    paddingBottom: 10,
  },
  modalTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalLoadingBox: {
    paddingVertical: 36,
    alignItems: 'center',
    gap: 8,
  },
  modalLoadingText: {
    color: '#64748b',
    fontSize: 12.5,
  },
  modalEmptyBox: {
    paddingVertical: 40,
    alignItems: 'center',
    gap: 6,
  },
  modalEmptyTitle: {
    color: '#0f172a',
    fontSize: 15,
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
    paddingVertical: 10,
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
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  followAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  followUserName: {
    color: '#0f172a',
    fontSize: 13.5,
    fontWeight: '800',
  },
  followUserLocation: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
  unfollowBtn: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  unfollowBtnText: {
    color: '#64748b',
    fontSize: 11.5,
    fontWeight: '700',
  },
  viewProfileBtn: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  viewProfileBtnText: {
    color: '#059669',
    fontSize: 11.5,
    fontWeight: '800',
  },
});
