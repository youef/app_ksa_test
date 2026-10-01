import { useState, useCallback } from 'react';
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
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/ui';
import { savePermanentMyLocation } from '@/lib/locationSync';
import {
  Camera,
  MapPin,
  LogOut,
  ChevronRight,
  User,
  Settings,
  Sparkles,
  ChevronDown,
  Users,
  X,
  Bookmark,
  MessageCircle,
} from 'lucide-react-native';
import BottomNav from '@/components/BottomNav';
import ActionSheet from '@/components/ActionSheet';
import LocationSelectorModal from '@/components/LocationSelectorModal';
import { generateSmartBioAI } from '@/lib/aiAssistant';

export default function Profile() {
  const [p, setP] = useState<any>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [personalName, setPersonalName] = useState('');
  const [region, setRegion] = useState('');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [bio, setBio] = useState('');
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);

  const [stats, setStats] = useState({ questions: 0, answers: 0, followers: 0, following: 0 });
  const [savedQuestions, setSavedQuestions] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'posts' | 'replies' | 'saved'>('posts');
  const [myQuestions, setMyQuestions] = useState<any[]>([]);
  const [myAnswers, setMyAnswers] = useState<any[]>([]);

  // Follows modal state
  const [followsModalOpen, setFollowsModalOpen] = useState(false);
  const [followsModalType, setFollowsModalType] = useState<'followers' | 'following'>('followers');
  const [followsList, setFollowsList] = useState<any[]>([]);
  const [followsLoading, setFollowsLoading] = useState(false);


  const loadProfile = useCallback(async () => {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) return;
    const uid = authData.user.id;
    setUserId(uid);

    // Fetch the current profile and its activity from Supabase.
    const r = await supabase.from('profiles').select('*').eq('id', uid).single();

    const [qCount, aCount, followersCount, followingCount, savedRes, postsRes, repliesRes] = await Promise.all([
      supabase.from('questions').select('id', { count: 'exact', head: true }).eq('author_id', uid),
      supabase.from('answers').select('id', { count: 'exact', head: true }).eq('author_id', uid),
      supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', uid),
      supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', uid),
      supabase.from('saved_questions').select('*, questions(id, title, body, created_at, city, district, author_id)').eq('user_id', uid).order('created_at', { ascending: false }).limit(20),
      supabase.from('questions').select('id, title, body, created_at, city, district').eq('author_id', uid).order('created_at', { ascending: false }).limit(50),
      supabase.from('answers').select('id, body, created_at, question_id, questions(title)').eq('author_id', uid).order('created_at', { ascending: false }).limit(50),
    ]);

    setStats({
      questions: qCount.count || 0,
      answers: aCount.count || 0,
      followers: followersCount.count || 0,
      following: followingCount.count || 0,
    });

    // Load saved questions
    const savedItems = (savedRes.data || []).map((s: any) => s.questions).filter(Boolean);
    setSavedQuestions(savedItems);
    setMyQuestions(postsRes.data || []);
    setMyAnswers(repliesRes.data || []);

    if (r.data) {
      setP(r.data);
      setPersonalName(r.data.display_name || '');
      setRegion(r.data.region || '');
      setCity(r.data.city || '');
      setDistrict(r.data.district || '');
      setBio(r.data.bio || '');
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
    const saved = await supabase.from('profiles').update({ avatar_url: data.publicUrl }).eq('id', u.user.id).select('id').maybeSingle();
    if (saved.error) return Alert.alert('تعذّر حفظ الصورة', saved.error.message);
    if (!saved.data) return Alert.alert('تعذّر حفظ الصورة', 'لم يتم تحديث ملف الحساب. أعد تسجيل الدخول ثم حاول مجدداً.');
    setP({ ...p, avatar_url: data.publicUrl });
  }

  // Toggle Handlers with Instant Persistence
  async function save() {
    if (!userId) return;
    if ((region.trim() || city.trim() || district.trim()) && (!city.trim() || !district.trim())) {
      return Alert.alert('أكمل بيانات الحي', 'لإظهار محتوى الحي وحماية الخصوصية، اختر مدينة وحيّاً محدداً. اترك الموقع كله فارغاً إذا كنت تريد حفظ الاسم فقط.');
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
      const result = await supabase.from('profiles').update(payload).eq('id', userId).select('id').maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) throw new Error('لم يُحدّث أي سجل. سجّل الخروج ثم الدخول وحاول مرة أخرى.');

      setP((current: any) => ({ ...current, ...payload }));
      await savePermanentMyLocation({
        region: region.trim() || 'المملكة',
        city: city.trim() || 'كل المدن',
        district: district.trim() || 'كل الأحياء',
      }, false);
      setEditingProfile(false);
      Alert.alert('تم الحفظ', 'تم تحديث الاسم والمدينة والحي والنبذة في حسابك.');
    } catch (error: any) {
      Alert.alert('تعذّر الحفظ', error?.message || 'لم يتم تحديث الملف. تحقق من الاتصال وإعدادات قاعدة البيانات ثم حاول مجدداً.');
    } finally {
      setSaving(false);
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

  function handleGenerateAIBio() {
    const generated = generateSmartBioAI(city || 'الرياض', district || 'الياسمين');
    setBio(generated);
  }


  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ======================================================== */}
        {/* 1. PROFILE HERO HEADER & AVATAR                          */}
        {/* ======================================================== */}
        <View style={styles.profileHero}>
          <View style={styles.profileTopBar}>
            <Pressable onPress={() => router.back()} style={styles.profileTopButton}>
              <ChevronRight size={22} color="#0f172a" />
            </Pressable>
            <Text style={styles.profileTopTitle}>الملف الشخصي</Text>
            <Pressable onPress={() => router.push('/settings')} style={styles.profileTopButton}>
              <Settings size={21} color="#0f172a" />
            </Pressable>
          </View>

          <View style={styles.profileSummary}>
            <Pressable onPress={pickAvatar} style={styles.twitterAvatarWrap}>
              {p.avatar_url ? <Image source={{ uri: p.avatar_url }} style={styles.twitterAvatar} /> :
                <View style={styles.twitterAvatarFallback}><User size={38} color="#64748b" /></View>}
              <View style={styles.twitterAvatarEdit}><Camera size={15} color="#fff" /></View>
            </Pressable>
            <Pressable style={styles.editProfileButton} onPress={() => setEditingProfile(v => !v)}>
              <Text style={styles.editProfileButtonText}>{editingProfile ? 'إغلاق التعديل' : 'تعديل الملف الشخصي'}</Text>
            </Pressable>
          </View>

          <Text style={styles.twitterDisplayName}>{personalName || 'أضف اسمك الشخصي'}</Text>
          <Text style={styles.twitterHandle}>@{p.username || 'username'}</Text>
          {!!bio.trim() && <Text style={styles.twitterBio}>{bio}</Text>}
          {(city || district) ? (
            <View style={styles.twitterLocation}><MapPin size={14} color="#64748b" />
              <Text style={styles.twitterLocationText}>{[region, district && `حي ${district}`, city].filter(Boolean).join('، ')}</Text>
            </View>
          ) : null}

          <View style={styles.twitterStats}>
            <Pressable onPress={() => openFollowsModal('following')} style={styles.twitterStat}>
              <Text style={styles.twitterStatNum}>{stats.following}</Text><Text style={styles.twitterStatLabel}>يتابع</Text>
            </Pressable>
            <Pressable onPress={() => openFollowsModal('followers')} style={styles.twitterStat}>
              <Text style={styles.twitterStatNum}>{stats.followers}</Text><Text style={styles.twitterStatLabel}>متابع</Text>
            </Pressable>
            <Text style={styles.twitterStat}><Text style={styles.twitterStatNum}>{stats.questions + stats.answers}</Text><Text style={styles.twitterStatLabel}> منشور</Text></Text>
          </View>
        </View>

        <View style={styles.contentArea}>
          {editingProfile && (
            <View style={styles.editProfileCard}>
              <Text style={styles.editProfileHeading}>تعديل الملف الشخصي</Text>
              <Text style={styles.label}>الاسم الشخصي</Text>
              <TextInput
                style={styles.profileInput}
                value={personalName}
                onChangeText={setPersonalName}
                placeholder="اسمك الذي يظهر للناس"
                placeholderTextColor="#94a3b8"
                maxLength={60}
              />
              <Text style={styles.label}>اسم المستخدم</Text>
              <TextInput style={[styles.profileInput, styles.readOnlyInput]} value={`@${p.username || ''}`} editable={false} />
              <Text style={styles.label}>المدينة والحي</Text>
              <Pressable style={styles.locationSelectorCard} onPress={() => setShowLocationModal(true)}>
                <View style={styles.locationSelectorContent}>
                  <MapPin size={20} color={C.accent} />
                  <Text style={[styles.twitterLocationText, { flex: 1, textAlign: 'right' }]}>
                    {city ? `${region ? `${region} · ` : ''}${city}${district ? ` · حي ${district}` : ''}` : 'اختر المنطقة والمدينة والحي'}
                  </Text>
                  <ChevronDown size={18} color={C.muted} />
                </View>
              </Pressable>
              <Text style={styles.label}>نبذة</Text>
              <TextInput
                style={[styles.profileInput, styles.bioInput]}
                value={bio}
                onChangeText={setBio}
                placeholder="اكتب نبذة قصيرة عنك"
                placeholderTextColor="#94a3b8"
                multiline
                maxLength={240}
              />
              <Pressable style={styles.saveProfileButton} onPress={save} disabled={saving}>
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveProfileButtonText}>حفظ التغييرات</Text>}
              </Pressable>
            </View>
          )}

          <View style={styles.profileTabs}>
            {([
              ['posts', 'المنشورات'], ['replies', 'الردود'], ['saved', 'المحفوظات'],
            ] as const).map(([key, label]) => (
              <Pressable key={key} onPress={() => setActiveTab(key)} style={styles.profileTab}>
                <Text style={[styles.profileTabText, activeTab === key && styles.profileTabTextActive]}>{label}</Text>
                {activeTab === key && <View style={styles.profileTabIndicator} />}
              </Pressable>
            ))}
          </View>

          {activeTab === 'posts' && (myQuestions.length ? myQuestions.map(item => (
            <Pressable key={item.id} style={styles.feedItem} onPress={() => router.push({ pathname: '/question', params: { id: item.id } })}>
              <View style={styles.feedAvatarSmall}>{p.avatar_url ? <Image source={{ uri: p.avatar_url }} style={styles.feedAvatarImage} /> : <User size={18} color="#64748b" />}</View>
              <View style={styles.feedBody}>
                <Text style={styles.feedAuthor}>{personalName || 'مستخدم'} <Text style={styles.feedHandle}>@{p.username || 'username'} · {new Date(item.created_at).toLocaleDateString('ar-SA')}</Text></Text>
                <Text style={styles.feedTitle}>{item.title}</Text>
                <Text style={styles.feedText} numberOfLines={4}>{item.body}</Text>
                {(item.district || item.city) && <Text style={styles.feedMeta}>{[item.district && `حي ${item.district}`, item.city].filter(Boolean).join(' · ')}</Text>}
              </View>
            </Pressable>
          )) : <Text style={styles.emptyFeed}>لا توجد منشورات بعد.</Text>)}

          {activeTab === 'replies' && (myAnswers.length ? myAnswers.map(item => (
            <Pressable key={item.id} style={styles.feedItem} onPress={() => router.push({ pathname: '/question', params: { id: item.question_id } })}>
              <View style={styles.feedAvatarSmall}>{p.avatar_url ? <Image source={{ uri: p.avatar_url }} style={styles.feedAvatarImage} /> : <User size={18} color="#64748b" />}</View>
              <View style={styles.feedBody}>
                <Text style={styles.feedAuthor}>{personalName || 'مستخدم'} <Text style={styles.feedHandle}>@{p.username || 'username'} · ردّ على</Text></Text>
                <Text style={styles.feedTitle}>{item.questions?.title || 'سؤال من الحي'}</Text>
                <Text style={styles.feedText}>{item.body}</Text>
              </View>
            </Pressable>
          )) : <Text style={styles.emptyFeed}>لا توجد ردود بعد.</Text>)}

          {activeTab === 'saved' && (savedQuestions.length ? savedQuestions.map(item => (
            <Pressable key={item.id} style={styles.feedItem} onPress={() => router.push({ pathname: '/question', params: { id: item.id } })}>
              <View style={styles.feedAvatarSmall}><Bookmark size={18} color="#059669" /></View>
              <View style={styles.feedBody}>
                <Text style={styles.feedAuthor}>استفسار محفوظ</Text>
                <Text style={styles.feedTitle}>{item.title}</Text>
                <Text style={styles.feedText} numberOfLines={3}>{item.body}</Text>
              </View>
            </Pressable>
          )) : <Text style={styles.emptyFeed}>لا توجد عناصر محفوظة بعد.</Text>)}
        </View>

          <Pressable style={styles.logoutBtn} onPress={logout}>
            <LogOut size={18} color={C.danger} style={{ marginLeft: 8 }} />
            <Text style={styles.logoutText}>تسجيل الخروج</Text>
          </Pressable>

          <View style={{ height: 90 }} />
      </ScrollView>

      {/* ======================================================== */}
      {/* 6. FOLLOWERS & FOLLOWING MODAL                           */}
      {/* ======================================================== */}
      <ActionSheet visible={followsModalOpen} onClose={() => setFollowsModalOpen(false)} height="50%">
        <View style={{ flex: 1 }}>
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
                <ActivityIndicator size="large" color="#059669" />
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
                          <User size={20} color="#059669" />
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
        onSelect={(reg, c, d) => {
          const newCity = c === 'كل المدن' ? '' : c;
          const newDist = (d === 'كل أحياء المدينة' || d === 'كل الأحياء') ? '' : d;
          setRegion(reg === 'كل المملكة' ? '' : reg);
          setCity(newCity);
          setDistrict(newDist);
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
  profileHero: {
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 52 : 28,
    paddingHorizontal: 18,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  profileTopBar: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', height: 42, marginBottom: 8 },
  profileTopButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f1f5f9' },
  profileTopTitle: { color: '#0f172a', fontSize: 18, fontWeight: '900' },
  profileSummary: { flexDirection: 'row-reverse', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 8, marginBottom: 12 },
  twitterAvatarWrap: { width: 84, height: 84, borderRadius: 42, position: 'relative' },
  twitterAvatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#e2e8f0' },
  twitterAvatarFallback: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  twitterAvatarEdit: { position: 'absolute', bottom: 0, left: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: '#059669', borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  editProfileButton: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 22, paddingVertical: 8, paddingHorizontal: 15, marginBottom: 4 },
  editProfileButtonText: { color: '#0f172a', fontSize: 13, fontWeight: '800' },
  twitterDisplayName: { color: '#0f172a', fontSize: 21, fontWeight: '900', textAlign: 'right' },
  twitterHandle: { color: '#64748b', fontSize: 14, textAlign: 'right', marginTop: 2 },
  twitterBio: { color: '#1e293b', fontSize: 14, lineHeight: 22, textAlign: 'right', marginTop: 12 },
  twitterLocation: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, marginTop: 9 },
  twitterLocationText: { color: '#64748b', fontSize: 13 },
  twitterStats: { flexDirection: 'row-reverse', gap: 20, marginTop: 14 },
  twitterStat: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  twitterStatNum: { color: '#0f172a', fontSize: 14, fontWeight: '900' },
  twitterStatLabel: { color: '#64748b', fontSize: 13 },
  editProfileCard: { backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#e2e8f0', padding: 16, gap: 8 },
  editProfileHeading: { fontSize: 17, color: '#0f172a', fontWeight: '900', textAlign: 'right', marginBottom: 6 },
  profileInput: { borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, color: '#0f172a', textAlign: 'right', fontSize: 14 },
  readOnlyInput: { color: '#64748b', backgroundColor: '#f8fafc', textAlign: 'left' },
  bioInput: { minHeight: 82, textAlignVertical: 'top' },
  saveProfileButton: { backgroundColor: '#0f172a', borderRadius: 22, minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  saveProfileButtonText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  profileTabs: { flexDirection: 'row-reverse', borderBottomWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff' },
  profileTab: { flex: 1, minHeight: 50, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  profileTabText: { color: '#64748b', fontSize: 13, fontWeight: '700' },
  profileTabTextActive: { color: '#059669', fontWeight: '900' },
  profileTabIndicator: { position: 'absolute', bottom: 0, width: 46, height: 3, borderRadius: 2, backgroundColor: '#059669' },
  feedItem: { flexDirection: 'row-reverse', gap: 10, backgroundColor: '#fff', padding: 15, borderBottomWidth: 1, borderColor: '#e2e8f0' },
  feedAvatarSmall: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  feedAvatarImage: { width: 40, height: 40, borderRadius: 20 },
  feedBody: { flex: 1, alignItems: 'flex-end' },
  feedAuthor: { width: '100%', color: '#0f172a', fontSize: 13, fontWeight: '800', textAlign: 'right' },
  feedHandle: { color: '#64748b', fontSize: 12, fontWeight: '400' },
  feedTitle: { color: '#0f172a', fontSize: 15, fontWeight: '800', lineHeight: 22, textAlign: 'right', width: '100%', marginTop: 7 },
  feedText: { color: '#334155', fontSize: 14, lineHeight: 21, textAlign: 'right', width: '100%', marginTop: 4 },
  feedMeta: { color: '#059669', fontSize: 12, marginTop: 8, textAlign: 'right', width: '100%' },
  emptyFeed: { backgroundColor: '#fff', color: '#64748b', fontSize: 14, textAlign: 'center', paddingVertical: 42 },
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
  pendingTag: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(245,158,11,0.2)',
    borderWidth: 1,
    borderColor: '#f59e0b',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  pendingTagText: {
    color: '#fef3c7',
    fontSize: 11,
    fontWeight: '800',
  },
  verifiedIdTag: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(5,150,105,0.2)',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  verifiedIdTagText: {
    color: '#ecfdf5',
    fontSize: 11,
    fontWeight: '800',
  },
  privateTag: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(6,95,70,0.6)',
    borderWidth: 1,
    borderColor: '#a7f3d0',
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
    backgroundColor: '#ecfdf5',
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
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  aiBioBtnText: {
    color: '#059669',
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
  smallVerifiedBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  smallVerifiedBadgeText: {
    color: '#15803d',
    fontSize: 10,
    fontWeight: '800',
  },
  smallPendingBadge: {
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  smallPendingBadgeText: {
    color: '#d97706',
    fontSize: 10,
    fontWeight: '800',
  },
  smallActiveBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  smallActiveBadgeText: {
    color: '#15803d',
    fontSize: 10,
    fontWeight: '800',
  },
  saveBtn: {
    backgroundColor: '#059669',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#059669',
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
  savedQCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  savedQTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'right',
    lineHeight: 20,
  },

  // ID Verification Modal
  idModalNotice: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'right',
    marginBottom: 16,
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 12,
  },
  idModalSectionTitle: {
    color: '#0f172a',
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
    marginBottom: 10,
  },
  idOptionsRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginBottom: 16,
  },
  idOptionCard: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  idOptionCardActive: {
    borderColor: '#059669',
    backgroundColor: '#ecfdf5',
  },
  idOptionText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
  },
  idOptionTextActive: {
    color: '#059669',
    fontWeight: '900',
  },
  securityNoticeBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0fdf4',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  securityNoticeText: {
    flex: 1,
    color: '#166534',
    fontSize: 11,
    textAlign: 'right',
    lineHeight: 16,
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
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  viewProfileBtnText: {
    color: '#059669',
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
