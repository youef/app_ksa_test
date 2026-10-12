import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ArrowRight,
  BadgeCheck,
  ChevronLeft,
  Lock,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Package,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  UserCheck,
  UserPlus,
  UserRoundX,
  Users,
  Wrench,
  Share2,
  Crown,
  Edit3,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { AppHeader } from '@/components/shared/AppHeader';
import { C } from '@/lib/ui';
import { getBlockStatus, setBlock } from '@/lib/chatControls';
import { isExactDistrictMatching } from '@/lib/locationSync';

type Tab = 'market' | 'services' | 'requests' | 'questions';

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: 'market', label: 'السوق', icon: ShoppingBag },
  { id: 'services', label: 'الخدمات', icon: Wrench },
  { id: 'requests', label: 'الطلبات', icon: Package },
  { id: 'questions', label: 'الاستفسارات', icon: Search },
];

export default function UserProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const [profile, setProfile] = useState<any>(null);
  const [stats, setStats] = useState({
    market: 0,
    services: 0,
    requests: 0,
    questions: 0,
    followers: 0,
    following: 0,
    answers: 0,
    reputation: 0,
  });
  const [items, setItems] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [followedBy, setFollowedBy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [blockedByOther, setBlockedByOther] = useState(false);
  const [sameDistrict, setSameDistrict] = useState(true);
  const [tab, setTab] = useState<Tab>('market');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);

  const cardWidth = useMemo(() => {
    const max = Math.min(width - 32, 1080);
    if (max >= 900) return (max - 32) / 3;
    if (max >= 620) return (max - 16) / 2;
    return max;
  }, [width]);

  const load = async (silent = false) => {
    if (!id) return;
    if (!silent) setLoading(true);
    try {
      const [{ data: auth }, { data: p, error }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
      ]);
      if (error) throw error;
      const me = auth.user?.id || null;
      setCurrentUserId(me);
      setProfile(p);
      if (!p) return;

      let isFollowing = false;
      let isFollowedBy = false;
      let iBlocked = false;
      let blockedMe = false;
      if (me && me !== id) {
        const [a, b, c] = await Promise.all([
          supabase.from('follows').select('id').eq('follower_id', me).eq('following_id', id).maybeSingle(),
          supabase.from('follows').select('id').eq('follower_id', id).eq('following_id', me).maybeSingle(),
          getBlockStatus(me, id),
        ]);
        isFollowing = !!a.data;
        isFollowedBy = !!b.data;
        iBlocked = c.iBlocked;
        blockedMe = c.blockedMe;
        const { data: mine } = await supabase.from('profiles').select('city,district').eq('id', me).maybeSingle();
        setSameDistrict(!!mine && isExactDistrictMatching(p, mine.city, mine.district));
      } else {
        setSameDistrict(true);
      }
      setFollowing(isFollowing);
      setFollowedBy(isFollowedBy);
      setBlocked(iBlocked);
      setBlockedByOther(blockedMe);

      const locked =
        (p.profile_privacy === 'private' && !isFollowing && me !== id) ||
        iBlocked ||
        blockedMe ||
        (p.hide_name === true && me !== id);
      if (locked) {
        setItems([]);
        setServices([]);
        setRequests([]);
        setQuestions([]);
        setStats({
          market: 0,
          services: 0,
          requests: 0,
          questions: 0,
          followers: 0,
          following: 0,
          answers: 0,
          reputation: 0,
        });
        return;
      }

      const [
        marketCount,
        serviceCount,
        requestCount,
        questionCount,
        followerCount,
        followingCount,
        answerCount,
        repRes,
        itemRows,
        serviceRows,
        requestRows,
        questionRows,
      ] = await Promise.all([
        supabase.from('marketplace_items').select('id', { count: 'exact', head: true }).eq('seller_id', id),
        supabase.from('services').select('id', { count: 'exact', head: true }).eq('provider_id', id),
        supabase.from('requests').select('id', { count: 'exact', head: true }).eq('requester_id', id),
        supabase.from('questions').select('id', { count: 'exact', head: true }).eq('author_id', id),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', id),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', id),
        supabase.from('answers').select('id', { count: 'exact', head: true }).eq('author_id', id),
        supabase.from('reputation').select('points').eq('user_id', id).maybeSingle(),
        supabase
          .from('marketplace_items')
          .select('id,title,description,price,item_type,district,image_url,status,created_at')
          .eq('seller_id', id)
          .order('created_at', { ascending: false })
          .limit(18),
        supabase
          .from('services')
          .select('id,name,description,category,district,price_from,price_to,available_now,is_verified,cover_url,created_at')
          .eq('provider_id', id)
          .order('created_at', { ascending: false })
          .limit(18),
        supabase
          .from('requests')
          .select('id,title,description,status,request_type,budget,is_urgent,district,created_at')
          .eq('requester_id', id)
          .order('created_at', { ascending: false })
          .limit(18),
        supabase
          .from('questions')
          .select('id,title,body,status,category,district,created_at,view_count')
          .eq('author_id', id)
          .order('created_at', { ascending: false })
          .limit(18),
      ]);

      setStats({
        market: marketCount.count || 0,
        services: serviceCount.count || 0,
        requests: requestCount.count || 0,
        questions: questionCount.count || 0,
        followers: followerCount.count || 0,
        following: followingCount.count || 0,
        answers: answerCount.count || 0,
        reputation: repRes?.data?.points || 0,
      });
      setItems(itemRows.data || []);
      setServices(serviceRows.data || []);
      setRequests(requestRows.data || []);
      setQuestions(questionRows.data || []);
    } catch (e) {
      console.error('profile load', e);
      setProfile(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
  }, [id]);

  async function toggleFollow() {
    if (!currentUserId) return Alert.alert('تسجيل الدخول مطلوب', 'سجّل دخولك أولاً لمتابعة المستخدمين.');
    if (currentUserId === id || blocked || blockedByOther || busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('hayna_toggle_follow', { p_target: id });
      if (error) throw error;
      setFollowing(data === true);
      setStats(s => ({ ...s, followers: data === true ? s.followers + 1 : Math.max(0, s.followers - 1) }));
    } catch (e: any) {
      Alert.alert('تعذر تحديث المتابعة', e?.message || 'حاول مرة أخرى.');
    } finally {
      setBusy(false);
    }
  }

  async function openMessage() {
    if (!currentUserId) return Alert.alert('تسجيل الدخول مطلوب', 'سجّل دخولك أولاً للمراسلة.');
    if (currentUserId === id) return;
    if (blocked) return Alert.alert('الحساب محظور', 'ألغِ الحظر أولاً.');
    if (blockedByOther) return Alert.alert('لا يمكن المراسلة', 'هذا المستخدم حظرك.');

    const isPlatformAdmin = profile?.role === 'admin';
    const allowDms = profile?.allow_dms === 'everyone' || isPlatformAdmin;

    if (!allowDms && !sameDistrict) {
      return Alert.alert('المراسلة داخل الحي', 'المراسلة الخاصة مخصصة لسكان الحي نفسه.');
    }
    if (profile?.allow_dms === 'nobody' && !isPlatformAdmin) {
      return Alert.alert('الخاص مغلق', 'هذا المستخدم لا يستقبل رسائل خاصة.');
    }
    if (profile?.allow_dms === 'followers' && !following && !isPlatformAdmin) {
      return Alert.alert('للمتابعين فقط', 'تابع المستخدم أولاً حتى تتمكن من مراسلته.');
    }

    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('hayna_get_or_create_direct_conversation', { p_target: id });
      if (error) throw error;
      if (data) router.push({ pathname: '/conversation', params: { id: data } });
    } catch (e: any) {
      Alert.alert('تعذر فتح المحادثة', e?.message || 'حاول مرة أخرى.');
    } finally {
      setBusy(false);
    }
  }

  const handleShareProfile = async () => {
    const url = typeof window !== 'undefined' ? window.location.href : `https://hayna.app/user?id=${id}`;
    const text = `ملف الجار ${displayName} على منصة حيّنا:\n${url}`;
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
        Alert.alert('تم نسخ الرابط 📋', 'تم نسخ رابط الملف الشخصي للمشاركة.');
        return;
      } catch {}
    }
    try {
      await Share.share({ message: text, url });
    } catch {}
  };

  function openOptionsMenu() {
    if (!currentUserId || currentUserId === id) {
      handleShareProfile();
      return;
    }

    Alert.alert(
      displayName,
      'اختر إجراءً:',
      [
        { text: 'مشاركة الملف 📋', onPress: handleShareProfile },
        {
          text: blocked ? 'إلغاء الحظر ✓' : 'حظر المستخدم 🚫',
          style: blocked ? 'default' : 'destructive',
          onPress: toggleBlock,
        },
        {
          text: 'إبلاغ عن الحساب 🚩',
          onPress: () => router.push({ pathname: '/report', params: { type: 'user', id } }),
        },
        { text: 'إلغاء', style: 'cancel' },
      ]
    );
  }

  function toggleBlock() {
    if (!currentUserId || currentUserId === id || busy) return;
    Alert.alert(
      blocked ? 'إلغاء الحظر' : 'حظر المستخدم',
      blocked ? 'هل تريد إلغاء حظر هذا المستخدم؟' : 'لن يتمكن المستخدم من مراسلتك أو متابعة حسابك.',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: blocked ? 'إلغاء الحظر' : 'حظر',
          style: blocked ? 'default' : 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              const r = await setBlock(currentUserId, id, !blocked);
              if (!r.ok) throw new Error(r.error);
              setBlocked(!blocked);
              if (!blocked) setFollowing(false);
              await load(true);
            } catch (e: any) {
              Alert.alert('تعذر تنفيذ العملية', e?.message || 'حاول مرة أخرى.');
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#059669" />
        <Text style={styles.loadingText}>جاري تجهيز الملف الشخصي...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.center}>
        <UserRoundX size={48} color="#94a3b8" />
        <Text style={styles.emptyTitle}>الحساب غير موجود</Text>
        <Pressable style={styles.primaryBtn} onPress={() => router.back()}>
          <Text style={styles.primaryBtnText}>رجوع</Text>
        </Pressable>
      </View>
    );
  }

  const own = currentUserId === id;
  const anonymous = profile.hide_name === true && !own;
  const displayName = anonymous ? 'جار مجهول' : profile.display_name || profile.username || 'مستخدم';
  const locked = (profile.profile_privacy === 'private' && !following && !own) || blocked || blockedByOther;
  const isAdmin = profile.role === 'admin';
  const totalContributions = stats.market + stats.services + stats.requests + stats.questions;

  const currentData =
    tab === 'market' ? items : tab === 'services' ? services : tab === 'requests' ? requests : questions;

  return (
    <View style={styles.screen}>
      <AppHeader
        variant="sub"
        title={displayName}
        subtitle={[profile.district && `حي ${profile.district}`, profile.city || ''].filter(Boolean).join(' · ')}
        fallbackRoute="/home"
        rightAction={
          <Pressable
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: '#f1f5f9',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onPress={openOptionsMenu}
            accessibilityRole="button"
            accessibilityLabel="خيارات"
          >
            <MoreHorizontal size={18} color="#475569" />
          </Pressable>
        }
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load(true);
            }}
            tintColor="#059669"
          />
        }
        contentContainerStyle={styles.page}
      >
        <View style={[styles.shell, { paddingTop: 14 }]}>
          {/* Executive Hero Banner */}
          <LinearGradient
            colors={['#064e3b', '#047857', '#059669']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroGlowOne} />
            <View style={styles.heroGlowTwo} />

            <View style={styles.heroTop}>
              {/* Avatar with Status Ring */}
              <View style={styles.avatarRing}>
                {profile.avatar_url && !anonymous ? (
                  <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarLetter}>
                      {(profile.display_name || profile.username || 'ج')[0].toUpperCase()}
                    </Text>
                  </View>
                )}
                {isAdmin ? (
                  <View style={styles.adminBadgeCircle}>
                    <Crown size={12} color="#ffffff" />
                  </View>
                ) : profile.is_verified ? (
                  <View style={styles.verified}>
                    <BadgeCheck size={14} color="#ffffff" />
                  </View>
                ) : null}
              </View>

              {/* Action Buttons in Hero */}
              <View style={styles.heroActions}>
                {own ? (
                  <Pressable
                    style={styles.editProfileBtn}
                    onPress={() => router.push('/profile')}
                  >
                    <Edit3 size={15} color="#ffffff" />
                    <Text style={styles.editProfileText}>تعديل ملفي</Text>
                  </Pressable>
                ) : (
                  <>
                    {!blocked && !blockedByOther && (
                      <Pressable
                        style={[styles.followBtn, following && styles.followBtnActive]}
                        onPress={toggleFollow}
                        disabled={busy}
                      >
                        <UserCheck size={15} color={following ? '#059669' : '#ffffff'} />
                        <Text style={[styles.followText, following && { color: '#059669' }]}>
                          {following ? 'تتابعه' : 'متابعة'}
                        </Text>
                      </Pressable>
                    )}

                    <Pressable
                      style={styles.messageBtn}
                      onPress={openMessage}
                      disabled={busy}
                    >
                      <MessageCircle size={15} color="#ffffff" />
                      <Text style={styles.messageText}>مراسلة</Text>
                    </Pressable>
                  </>
                )}
              </View>
            </View>

            {/* Identity & Details */}
            <View style={styles.heroIdentity}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{displayName}</Text>
                {isAdmin && (
                  <View style={styles.adminPill}>
                    <Crown size={11} color="#f59e0b" />
                    <Text style={styles.adminPillText}>مشرف المنصة</Text>
                  </View>
                )}
              </View>

              {!anonymous && profile.username && (
                <Text style={styles.handle}>@{profile.username}</Text>
              )}

              <View style={styles.heroLocation}>
                <MapPin size={13} color="#a7f3d0" />
                <Text style={styles.heroLocationText}>
                  {[profile.district && `حي ${profile.district}`, profile.city].filter(Boolean).join(' · ') ||
                    'المملكة العربية السعودية'}
                </Text>
              </View>
            </View>

            {!anonymous && profile.bio && (
              <View style={styles.bioBox}>
                <Text style={styles.bio}>{profile.bio}</Text>
              </View>
            )}

            {/* Trust and Badges Pills */}
            <View style={styles.trustRow}>
              <View style={styles.trustPill}>
                <ShieldCheck size={13} color="#a7f3d0" />
                <Text style={styles.trustText}>
                  {profile.is_geoverified ? 'جار موثق بالحي' : 'عضو في الحي'}
                </Text>
              </View>

              <View
                style={[
                  styles.trustPill,
                  { backgroundColor: 'rgba(253, 230, 138, 0.22)', borderColor: 'rgba(253, 230, 138, 0.45)' },
                ]}
              >
                <Sparkles size={13} color="#fde68a" />
                <Text style={[styles.trustText, { color: '#fde68a' }]}>
                  {stats.reputation || 0} نقطة سمعة ⭐
                </Text>
              </View>

              {Array.isArray(profile.badges) &&
                profile.badges.map((b: string, i: number) => (
                  <View key={i} style={styles.customBadgePill}>
                    <Text style={styles.customBadgeText}>{b}</Text>
                  </View>
                ))}
            </View>
          </LinearGradient>

          {/* Elevated Stats Bar */}
          <View style={styles.statsCard}>
            <Stat label="سمعة الحي ⭐" value={stats.reputation} />
            <Stat label="متابعين" value={stats.followers} />
            <Stat label="يتابع" value={stats.following} />
            <Stat label="إسهامات" value={totalContributions} />
          </View>

          {/* Activity Category Tabs */}
          <View style={styles.tabsCard}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
              {TABS.map(({ id: key, label, icon: Icon }) => {
                const count =
                  key === 'market'
                    ? stats.market
                    : key === 'services'
                    ? stats.services
                    : key === 'requests'
                    ? stats.requests
                    : stats.questions;
                const active = tab === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => setTab(key)}
                    style={[styles.tab, active && styles.tabActive]}
                  >
                    <Icon size={15} color={active ? '#fff' : '#64748b'} />
                    <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
                    <Text style={[styles.tabCount, active && styles.tabCountActive]}>({count})</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Main Tab Content */}
          {locked ? (
            <View style={styles.lockCard}>
              <View style={styles.lockIcon}>
                <Lock size={28} color="#059669" />
              </View>
              <Text style={styles.lockTitle}>
                {blocked || blockedByOther ? 'المحتوى غير متاح' : 'هذا الملف خاص'}
              </Text>
              <Text style={styles.lockText}>
                {blocked
                  ? 'قمت بحظر هذا المستخدم.'
                  : blockedByOther
                  ? 'هذا المستخدم قام بحظرك.'
                  : 'تابع المستخدم لعرض نشاطه ومحتواه.'}
              </Text>
              {!blocked && !blockedByOther && !following && (
                <Pressable style={styles.primaryBtn} onPress={toggleFollow}>
                  <UserPlus size={16} color="#fff" />
                  <Text style={styles.primaryBtnText}>متابعة لعرض المحتوى</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <View style={styles.content}>
              <View style={styles.contentHead}>
                <View>
                  <Text style={styles.contentTitle}>{TABS.find(x => x.id === tab)?.label}</Text>
                  <Text style={styles.contentSub}>{currentData.length} عنصر · من نشاط الجار</Text>
                </View>
                {tab === 'market' && (
                  <Pressable style={styles.marketLink} onPress={() => router.push('/market')}>
                    <Text style={styles.marketLinkText}>سوق الحي</Text>
                    <ChevronLeft size={14} color="#059669" />
                  </Pressable>
                )}
              </View>

              {currentData.length === 0 ? (
                <Empty tab={tab} own={own} />
              ) : (
                <View style={[styles.grid, { gap: 12 }]}>
                  {currentData.map(item => (
                    <ActivityCard key={item.id} type={tab} item={item} width={cardWidth} />
                  ))}
                </View>
              )}
            </View>
          )}

          {!own && (
            <View style={styles.footerHint}>
              <Users size={15} color="#64748b" />
              <Text style={styles.footerHintText}>مجتمع حيّنا · تواصل باحترام وأخلاق الجيرة</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value > 999 ? '999+' : value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Empty({ tab, own }: { tab: Tab; own: boolean }) {
  const titles: Record<Tab, string> = {
    market: 'لا توجد إعلانات في السوق',
    services: 'لا توجد خدمات منشورة',
    requests: 'لا توجد طلبات فزعة',
    questions: 'لا توجد استفسارات',
  };
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Package size={26} color="#059669" />
      </View>
      <Text style={styles.emptyTitle}>{titles[tab]}</Text>
      <Text style={styles.emptyText}>
        {own
          ? 'أضف أول إعلان أو خدمة أو فزعة من الأقسام وابدأ تفاعلك.'
          : 'سيظهر نشاط هذا الجار هنا فور نشره لأي محتوى جديد.'}
      </Text>
      {own && (
        <Pressable style={styles.primaryBtn} onPress={() => router.push('/market')}>
          <Plus size={15} color="#fff" />
          <Text style={styles.primaryBtnText}>الذهاب للسوق</Text>
        </Pressable>
      )}
    </View>
  );
}

function ActivityCard({ type, item, width }: { type: Tab; item: any; width: number }) {
  const image = item.image_url || item.cover_url;
  const title = type === 'services' ? item.name : item.title || item.name;
  const subtitle =
    type === 'market'
      ? item.description || 'إعلان من سوق الحي'
      : type === 'services'
      ? item.description || item.category || 'خدمة محلية'
      : type === 'requests'
      ? item.description || 'طلب مساعدة من الحي'
      : item.body || item.category || 'استفسار مجتمعي';
  const price =
    type === 'market'
      ? item.price != null
        ? `${Number(item.price).toLocaleString('ar-SA')} ر.س`
        : 'على السوم'
      : type === 'services'
      ? item.price_from != null
        ? `من ${Number(item.price_from).toLocaleString('ar-SA')} ر.س`
        : 'السعر بالتواصل'
      : type === 'requests' && item.budget != null
      ? `ميزانية ${Number(item.budget).toLocaleString('ar-SA')} ر.س`
      : null;
  const status =
    type === 'market'
      ? item.status
      : type === 'requests'
      ? item.status
      : type === 'services' && item.available_now
      ? 'متاح الآن'
      : null;

  const handleCardPress = () => {
    if (type === 'market') {
      router.push({ pathname: '/market' });
    } else if (type === 'services') {
      router.push({ pathname: '/service', params: { id: item.id } });
    } else if (type === 'requests') {
      router.push({ pathname: '/request', params: { id: item.id } });
    } else if (type === 'questions') {
      router.push({ pathname: '/question', params: { id: item.id } });
    }
  };

  return (
    <Pressable
      style={[styles.activityCard, { width }]}
      onPress={handleCardPress}
    >
      <View style={styles.cardVisual}>
        {image ? (
          <Image source={{ uri: image }} style={styles.cardImage} />
        ) : (
          <View style={styles.cardPlaceholder}>
            {type === 'services' ? (
              <Wrench size={28} color="#059669" />
            ) : type === 'market' ? (
              <ShoppingBag size={28} color="#059669" />
            ) : type === 'requests' ? (
              <Package size={28} color="#ea580c" />
            ) : (
              <Search size={28} color="#2563eb" />
            )}
          </View>
        )}
        {status && (
          <View style={styles.statusPill}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor:
                    status === 'available' || status === 'open' || status === 'متاح الآن'
                      ? '#22c55e'
                      : '#94a3b8',
                },
              ]}
            />
            <Text style={styles.statusText}>
              {status === 'available'
                ? 'متاح'
                : status === 'sold'
                ? 'تم البيع'
                : status === 'reserved'
                ? 'محجوز'
                : status}
            </Text>
          </View>
        )}
        {type === 'requests' && item.is_urgent && (
          <View style={styles.urgent}>
            <Text style={styles.urgentText}>عاجل</Text>
          </View>
        )}
      </View>
      <View style={styles.activityBody}>
        <Text style={styles.activityTitle} numberOfLines={2}>
          {title || 'بدون عنوان'}
        </Text>
        <Text style={styles.activitySub} numberOfLines={2}>
          {subtitle}
        </Text>
        <View style={styles.activityFooter}>
          {price ? (
            <Text style={styles.price}>{price}</Text>
          ) : (
            <Text style={styles.meta}>{item.district ? `حي ${item.district}` : 'الحي'}</Text>
          )}
          <View style={styles.metaRow}>
            <MapPin size={11} color="#94a3b8" />
            <Text style={styles.meta}>{item.district || 'الحي'}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  page: { paddingBottom: 110 },
  shell: { width: '100%', maxWidth: 1080, alignSelf: 'center', paddingHorizontal: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', padding: 24 },
  loadingText: { marginTop: 10, color: '#059669', fontWeight: '800', fontSize: 13 },
  hero: { borderRadius: 24, padding: 18, overflow: 'hidden', minHeight: 250 },
  heroGlowOne: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255,255,255,0.06)',
    top: -90,
    left: -60,
  },
  heroGlowTwo: {
    position: 'absolute',
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(16,185,129,0.18)',
    bottom: -80,
    right: -30,
  },
  heroTop: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start' },
  avatarRing: {
    position: 'relative',
    width: 80,
    height: 80,
    borderRadius: 26,
    padding: 3,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  avatar: { width: 74, height: 74, borderRadius: 23 },
  avatarFallback: {
    flex: 1,
    borderRadius: 23,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#a7f3d0',
  },
  avatarLetter: {
    color: '#047857',
    fontSize: 30,
    fontWeight: '900',
  },
  verified: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#059669',
    borderWidth: 2,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminBadgeCircle: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#b45309',
    borderWidth: 2,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroActions: {
    flexDirection: 'row-reverse',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    maxWidth: '72%',
  },
  followBtn: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  followBtnActive: { backgroundColor: '#ffffff', borderColor: '#ffffff' },
  followText: { color: '#ffffff', fontWeight: '900', fontSize: 12.5 },
  messageBtn: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#0f172a',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  messageText: { color: '#ffffff', fontWeight: '900', fontSize: 12.5 },
  editProfileBtn: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  editProfileText: { color: '#ffffff', fontWeight: '900', fontSize: 12.5 },
  heroIdentity: { marginTop: 18, alignItems: 'flex-end' },
  nameRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 7 },
  name: { color: '#ffffff', fontSize: 24, fontWeight: '900', textAlign: 'right' },
  adminPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(254, 243, 199, 0.25)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(254, 243, 199, 0.4)',
  },
  adminPillText: {
    color: '#fef3c7',
    fontSize: 10.5,
    fontWeight: '900',
  },
  handle: { color: '#d1fae5', fontSize: 13, fontWeight: '700', marginTop: 2 },
  heroLocation: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, marginTop: 6 },
  heroLocationText: { color: '#ecfdf5', fontSize: 12, fontWeight: '700' },
  bioBox: {
    backgroundColor: 'rgba(0,0,0,0.12)',
    padding: 10,
    borderRadius: 12,
    marginTop: 10,
  },
  bio: { color: '#ecfdf5', fontSize: 12.5, lineHeight: 18, textAlign: 'right' },
  trustRow: { flexDirection: 'row-reverse', gap: 6, flexWrap: 'wrap', marginTop: 14 },
  trustPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  trustText: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
  customBadgePill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  customBadgeText: { color: '#ecfdf5', fontSize: 10.5, fontWeight: '700' },
  statsCard: {
    marginTop: -16,
    marginHorizontal: 10,
    backgroundColor: '#ffffff',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 6,
    flexDirection: 'row-reverse',
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 8, borderLeftWidth: 1, borderLeftColor: '#f1f5f9' },
  statValue: { color: '#0f172a', fontSize: 17, fontWeight: '900' },
  statLabel: { color: '#64748b', fontSize: 10.5, fontWeight: '700', marginTop: 2 },
  tabsCard: { marginTop: 14, backgroundColor: '#ffffff', borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', padding: 5 },
  tabs: { flexDirection: 'row-reverse', gap: 6 },
  tab: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
  },
  tabActive: { backgroundColor: '#059669' },
  tabText: { color: '#64748b', fontSize: 12, fontWeight: '800' },
  tabTextActive: { color: '#ffffff' },
  tabCount: { color: '#94a3b8', fontSize: 10.5, fontWeight: '850' },
  tabCountActive: { color: '#d1fae5' },
  content: { marginTop: 16 },
  contentHead: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 },
  contentTitle: { color: '#0f172a', fontSize: 17, fontWeight: '900', textAlign: 'right' },
  contentSub: { color: '#64748b', fontSize: 11, marginTop: 2, fontWeight: '600', textAlign: 'right' },
  marketLink: { flexDirection: 'row-reverse', alignItems: 'center', gap: 2 },
  marketLinkText: { color: '#059669', fontSize: 12, fontWeight: '900' },
  grid: { flexDirection: 'row-reverse', flexWrap: 'wrap' },
  activityCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  cardVisual: { height: 130, backgroundColor: '#f1f5f9', position: 'relative', overflow: 'hidden' },
  cardImage: { width: '100%', height: '100%' },
  cardPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0fdf4' },
  statusPill: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(255,255,255,.95)',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { color: '#0f172a', fontSize: 9.5, fontWeight: '900' },
  urgent: { position: 'absolute', top: 8, left: 8, backgroundColor: '#dc2626', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  urgentText: { color: '#ffffff', fontSize: 9, fontWeight: '900' },
  activityBody: { padding: 10 },
  activityTitle: { color: '#0f172a', fontSize: 13, fontWeight: '900', textAlign: 'right', lineHeight: 18 },
  activitySub: { color: '#64748b', fontSize: 11, lineHeight: 16, textAlign: 'right', marginTop: 3, minHeight: 30 },
  activityFooter: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginTop: 6 },
  price: { color: '#059669', fontSize: 12, fontWeight: '900', flexShrink: 1 },
  metaRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 3 },
  meta: { color: '#94a3b8', fontSize: 10, fontWeight: '700' },
  lockCard: {
    marginTop: 18,
    padding: 32,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  lockIcon: { width: 56, height: 56, borderRadius: 20, backgroundColor: '#ecfdf5', alignItems: 'center', justifyContent: 'center' },
  lockTitle: { color: '#0f172a', fontSize: 16, fontWeight: '900', marginTop: 12 },
  lockText: { color: '#64748b', fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 4, maxWidth: 380 },
  empty: { padding: 36, backgroundColor: '#ffffff', borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center' },
  emptyIcon: { width: 54, height: 54, borderRadius: 18, backgroundColor: '#ecfdf5', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: '#0f172a', fontSize: 15, fontWeight: '900', marginTop: 10 },
  emptyText: { color: '#64748b', fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 4, maxWidth: 380 },
  primaryBtn: {
    marginTop: 14,
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  primaryBtnText: { color: '#ffffff', fontSize: 12.5, fontWeight: '900' },
  footerHint: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 18,
    paddingVertical: 16,
  },
  footerHintText: { color: '#64748b', fontSize: 11, fontWeight: '700' },
});
