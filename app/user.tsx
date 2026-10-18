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
import { ProfileCustomizationEntry } from '@/components/profile/ProfileCustomizationEntry';
import { C } from '@/lib/ui';
import { getBlockStatus, setBlock } from '@/lib/chatControls';
import { isExactDistrictMatching } from '@/lib/locationSync';

type Tab = 'questions' | 'answers' | 'services' | 'requests' | 'market' | 'reviews';

const TABS: { id: Tab; label: string; icon: any }[] = [
  { id: 'questions', label: 'الاستفسارات', icon: Search },
  { id: 'answers', label: 'الإجابات', icon: MessageCircle },
  { id: 'services', label: 'الخدمات', icon: Wrench },
  { id: 'requests', label: 'الطلبات', icon: Package },
  { id: 'market', label: 'السوق', icon: ShoppingBag },
  { id: 'reviews', label: 'التقييمات', icon: Star },
];

export default function UserProfile() {
  const params = useLocalSearchParams<{ id?: string; username?: string }>();
  const routeId = Array.isArray(params.id) ? params.id[0] : (params.id || '');
  const routeUsername = Array.isArray(params.username) ? params.username[0] : (params.username || '');
  const lookupKey = routeUsername || routeId;
  const [resolvedProfileId, setResolvedProfileId] = useState<string>('');
  const id = resolvedProfileId || routeId;
  const { width } = useWindowDimensions();
  const [profile, setProfile] = useState<any>(null);
  const [hasActiveStories, setHasActiveStories] = useState(false);
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
  const [reviews, setReviews] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [followedBy, setFollowedBy] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [blockedByOther, setBlockedByOther] = useState(false);
  const [sameDistrict, setSameDistrict] = useState(true);
  const [tab, setTab] = useState<Tab>('questions');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadedTabs, setLoadedTabs] = useState<Tab[]>([]);
  const [tabLoading, setTabLoading] = useState(false);
  const [tabError, setTabError] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [featuredItems, setFeaturedItems] = useState<any[]>([]);
  const [profileCustomization, setProfileCustomization] = useState<any>(null);

  const cardWidth = useMemo(() => {
    const max = Math.min(width - 32, 1080);
    if (max >= 900) return (max - 32) / 3;
    if (max >= 620) return (max - 16) / 2;
    return max;
  }, [width]);

  const loadTabData = async (tabToLoad: Tab, profileId: string, viewerId: string | null, force = false) => {
    if (loadedTabs.includes(tabToLoad) && !force) return;
    if (tabToLoad === 'answers' && viewerId !== profileId) return;
    setTabLoading(true);
    setTabError(false);
    try {
      let result: any;
      if (tabToLoad === 'market') {
        result = await supabase.from('marketplace_items').select('id,title,description,price,item_type,district,image_url,status,created_at').eq('seller_id', profileId).order('created_at', { ascending: false }).limit(18);
        if (result.error) throw result.error;
        setItems(result.data || []);
      } else if (tabToLoad === 'services') {
        result = await supabase.from('services').select('id,name,description,category,district,price_from,price_to,available_now,is_verified,cover_url,created_at').eq('provider_id', profileId).order('created_at', { ascending: false }).limit(18);
        if (result.error) throw result.error;
        setServices(result.data || []);
      } else if (tabToLoad === 'requests') {
        result = await supabase.from('requests').select('id,title,description,status,resolution_status,is_pinned,request_type,budget,is_urgent,district,created_at').eq('requester_id', profileId).order('is_pinned', { ascending: false }).order('created_at', { ascending: false }).limit(18);
        if (result.error) throw result.error;
        setRequests(result.data || []);
      } else if (tabToLoad === 'questions') {
        result = await supabase.from('questions').select('id,title,body,status,resolution_status,is_pinned,category,district,created_at,view_count,views_count,is_emergency,item_type').eq('author_id', profileId).order('is_pinned', { ascending: false }).order('created_at', { ascending: false }).limit(18);
        if (result.error) throw result.error;
        setQuestions(result.data || []);
      } else if (tabToLoad === 'reviews') {
        result = await supabase.from('reviews').select('id,reviewer_id,business_id,service_id,rating,body,created_at').eq('business_id', profileId).order('created_at', { ascending: false }).limit(30);
        if (result.error) throw result.error;
        const rows = result.data || [];
        const reviewerIds = [...new Set(rows.map((row: any) => row.reviewer_id).filter(Boolean))];
        let reviewers: any[] = [];
        if (reviewerIds.length) {
          const people = await supabase.from('profiles').select('id,username,display_name,avatar_url,is_verified').in('id', reviewerIds);
          reviewers = people.data || [];
        }
        const byId = new Map(reviewers.map(person => [person.id, person]));
        setReviews(rows.map((row: any) => ({ ...row, reviewer: byId.get(row.reviewer_id) || null })));
      } else {
        result = await supabase.from('answers').select('id,body,created_at,question_id,questions(id,title,city,district)').eq('author_id', profileId).order('created_at', { ascending: false }).limit(18);
        if (result.error) throw result.error;
        setAnswers(result.data || []);
      }
      setLoadedTabs(previous => previous.includes(tabToLoad) ? previous : [...previous, tabToLoad]);
    } catch (e) {
      console.error('profile tab load', tabToLoad, e);
      setTabError(true);
    } finally {
      setTabLoading(false);
    }
  };

  const load = async (silent = false) => {
    if (!lookupKey) return;
    if (!silent) setLoading(true);
    setLoadError(false);
    setResolvedProfileId('');
    setFeaturedItems([]);
    setProfileCustomization(null);
    setLoadedTabs([]);
    setTabError(false);
    setBlocked(false); setBlockedByOther(false); setFollowing(false); setFollowedBy(false);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const me = sessionData?.session?.user?.id || null;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(lookupKey);
      const { data: p, error } = await supabase.from('profiles').select('id,username,display_name,avatar_url,role,is_verified,city,district,bio,is_geoverified,badges,profile_privacy,hide_name,is_banned,allow_dms')
        .eq(isUuid ? 'id' : 'username', lookupKey).maybeSingle();
      if (error) throw error;
      setCurrentUserId(me);
      setProfile(p);
      if (!p) return;
      setResolvedProfileId(p.id);
      if (p.is_banned === true && me !== p.id) {
        setItems([]); setServices([]); setRequests([]); setQuestions([]); setAnswers([]);
        setStats({ market: 0, services: 0, requests: 0, questions: 0, followers: 0, following: 0, answers: 0, reputation: 0 });
        return;
      }

      const nowIso = new Date().toISOString();
      const yesterdayIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: activeStoryRows, error: activeStoryError } = await supabase
        .from('stories')
        .select('id')
        .eq('author_id', p.id)
        .or(`expires_at.gt.${nowIso},and(expires_at.is.null,created_at.gte.${yesterdayIso})`)
        .limit(1);
      setHasActiveStories(!activeStoryError && !!activeStoryRows?.length);

      let isFollowing = false;
      let isFollowedBy = false;
      let iBlocked = false;
      let blockedMe = false;
      if (me && me !== p.id) {
        const [a, b, c] = await Promise.all([
          supabase.from('follows').select('id').eq('follower_id', me).eq('following_id', p.id).maybeSingle(),
          supabase.from('follows').select('id').eq('follower_id', p.id).eq('following_id', me).maybeSingle(),
          getBlockStatus(me, p.id),
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
        (p.profile_privacy === 'private' && !isFollowing && me !== p.id) ||
        (p.hide_name === true && me !== p.id) ||
        iBlocked ||
        blockedMe ||
        (p.hide_name === true && me !== p.id);
      if (locked) {
        setItems([]);
        setServices([]);
        setRequests([]);
        setQuestions([]);
        setAnswers([]);
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

      const [customizationResult, featuredResult] = await Promise.all([
        supabase.from('profile_customizations').select('accent_color,banner_style,show_stats,show_badges,featured_title,profile_type,section_visibility,section_order').eq('user_id', p.id).maybeSingle(),
        supabase.from('profile_featured_items').select('item_type,item_id,position').eq('user_id', p.id).order('position', { ascending: true }).limit(10),
      ]);
      setProfileCustomization(customizationResult.data || null);
      const featuredRows = featuredResult.data || [];
      const resolvedFeatured = await Promise.all(featuredRows.map(async (featured: any) => {
        let query: any;
        if (featured.item_type === 'question') query = await supabase.from('questions').select('id,title,body,district,created_at,category').eq('id', featured.item_id).maybeSingle();
        else if (featured.item_type === 'service') query = await supabase.from('services').select('id,name,description,district,created_at,category,cover_url,price_from,price_to,available_now').eq('id', featured.item_id).maybeSingle();
        else if (featured.item_type === 'request') query = await supabase.from('requests').select('id,title,description,district,created_at,status,budget,is_urgent').eq('id', featured.item_id).maybeSingle();
        else if (featured.item_type === 'market') query = await supabase.from('marketplace_items').select('id,title,description,district,created_at,status,price,image_url,item_type').eq('id', featured.item_id).maybeSingle();
        return query?.data ? { ...query.data, _featuredType: featured.item_type } : null;
      }));
      setFeaturedItems(resolvedFeatured.filter(Boolean));

      const [
        marketCount,
        serviceCount,
        requestCount,
        questionCount,
        followerCount,
        followingCount,
        answerCount,
        repRes,
      ] = await Promise.all([
        supabase.from('marketplace_items').select('id', { count: 'exact', head: true }).eq('seller_id', p.id),
        supabase.from('services').select('id', { count: 'exact', head: true }).eq('provider_id', p.id),
        supabase.from('requests').select('id', { count: 'exact', head: true }).eq('requester_id', p.id),
        supabase.from('questions').select('id', { count: 'exact', head: true }).eq('author_id', p.id),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', p.id),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', p.id),
        me === p.id ? supabase.from('answers').select('id', { count: 'exact', head: true }).eq('author_id', p.id) : Promise.resolve({ count: 0, error: null }),
        supabase.from('reputation').select('points').eq('user_id', p.id).maybeSingle(),
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
      setItems([]); setServices([]); setRequests([]); setQuestions([]); setAnswers([]);
      setLoadedTabs([]);
      const initialTab: Tab = (questionCount.count || 0) > 0 ? 'questions'
        : (serviceCount.count || 0) > 0 ? 'services'
        : (requestCount.count || 0) > 0 ? 'requests'
        : (marketCount.count || 0) > 0 ? 'market'
        : 'questions';
      if (me === p.id && (answerCount.count || 0) > 0 && !(questionCount.count || serviceCount.count || requestCount.count || marketCount.count)) {
        setTab('answers');
        await loadTabData('answers', p.id, me, true);
      } else {
        setTab(initialTab);
        await loadTabData(initialTab, p.id, me, true);
      }
    } catch (e) {
      console.error('profile load', e);
      setLoadError(true);
      setProfile(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
  }, [lookupKey]);

  useEffect(() => {
    if (!id || !profile || loading) return;
    if (profile.is_banned === true && currentUserId !== id) return;
    if (tab === 'answers' && currentUserId !== id) return;
    if ((profile.profile_privacy === 'private' && !following && currentUserId !== id) || blocked || blockedByOther) return;
    void loadTabData(tab, id, currentUserId);
  }, [tab, id, currentUserId, loading, profile, following, blocked, blockedByOther]);

  async function openProfileStories() {
    if (!id || blocked || blockedByOther) return;
    try {
      const nowIso = new Date().toISOString();
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('stories')
        .select('id')
        .eq('author_id', id)
        .or(`expires_at.gt.${nowIso},and(expires_at.is.null,created_at.gte.${yesterday})`)
        .order('created_at', { ascending: true })
        .limit(1);
      if (error) throw error;
      if (data?.[0]?.id) router.push({ pathname: '/story', params: { id: data[0].id } });
      else Alert.alert('لا توجد يوميات نشطة', 'هذا المستخدم لا يملك يوميات متاحة حالياً.');
    } catch {
      Alert.alert('تعذر فتح اليوميات', 'تحقق من اتصالك وحاول مرة أخرى.');
    }
  }

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
    const profileUrl = `https://appksatest.vercel.app/user?username=${encodeURIComponent(profile.username || id)}`;
    const url = typeof window !== 'undefined' ? `${window.location.origin}/user?username=${encodeURIComponent(profile.username || id)}` : profileUrl;
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
        <Text style={styles.emptyTitle}>{loadError ? 'تعذر تحميل الملف' : 'الحساب غير موجود'}</Text>
        <Text style={styles.emptyText}>{loadError ? 'تحقق من اتصالك ثم أعد المحاولة.' : 'تأكد من اسم المستخدم أو الرابط وحاول مرة أخرى.'}</Text>
        {loadError ? (
          <Pressable style={styles.primaryBtn} onPress={() => void load()}><Text style={styles.primaryBtnText}>إعادة المحاولة</Text></Pressable>
        ) : (
          <Pressable style={styles.primaryBtn} onPress={() => router.back()}><Text style={styles.primaryBtnText}>رجوع</Text></Pressable>
        )}
      </View>
    );
  }

  const own = currentUserId === id;
  const anonymous = profile.hide_name === true && !own;
  const displayName = anonymous ? 'جار مجهول' : profile.display_name || profile.username || 'مستخدم';
  const locked = (profile.is_banned === true && !own) || (profile.profile_privacy === 'private' && !following && !own) || (profile.hide_name === true && !own) || blocked || blockedByOther;
  const isAdmin = profile.role === 'admin';
  const totalContributions = stats.market + stats.services + stats.requests + stats.questions + (own ? stats.answers : 0);
  const accentColor = profileCustomization?.accent_color || '#059669';
  const heroColors: [string, string, string] = profileCustomization?.banner_style === 'ocean' ? ['#0c4a6e', '#0369a1', '#0ea5e9'] : profileCustomization?.banner_style === 'sunset' ? ['#7c2d12', '#c2410c', '#f97316'] : profileCustomization?.banner_style === 'midnight' ? ['#111827', '#1e293b', '#334155'] : ['#064e3b', '#047857', '#059669'];

  const currentData =
    tab === 'market'
      ? items
      : tab === 'services'
      ? services
      : tab === 'requests'
      ? requests
      : tab === 'questions'
      ? questions
      : tab === 'reviews'
      ? reviews
      : answers;

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
            colors={heroColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <View style={styles.heroGlowOne} />
            <View style={styles.heroGlowTwo} />

            <View style={styles.heroTop}>
              {/* Avatar with Status Ring */}
              <Pressable style={[styles.avatarRing, hasActiveStories && styles.avatarRingHasStory]} onPress={openProfileStories} accessibilityRole="button" accessibilityLabel={hasActiveStories ? "عرض يوميات هذا المستخدم، لديه قصة نشطة" : "عرض يوميات هذا المستخدم"}>
                {profile.avatar_url && !anonymous && !profile.avatar_url.includes('blank-profile-picture') ? (
                  <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarLetter}>
                      {(profile.display_name || profile.username || 'ج')[0].toUpperCase()}
                    </Text>
                  </View>
                )}
                {hasActiveStories && (
                  <View style={styles.storyAvailableBadge}>
                    <Sparkles size={11} color="#ffffff" />
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
              </Pressable>

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
                        style={[styles.followBtn, { backgroundColor: accentColor }, following && styles.followBtnActive]}
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
                      style={[styles.messageBtn, { backgroundColor: accentColor }]}
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

            {!anonymous && profile.bio && profileCustomization?.section_visibility?.bio !== false && (
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

              {profileCustomization?.show_badges !== false && profileCustomization?.section_visibility?.achievements !== false && Array.isArray(profile.badges) &&
                profile.badges.map((b: string, i: number) => (
                  <View key={i} style={styles.customBadgePill}>
                    <Text style={styles.customBadgeText}>{b}</Text>
                  </View>
                ))}
            </View>
          </LinearGradient>

          {/* Elevated Stats Bar */}
          {profileCustomization?.show_stats !== false && <View style={[styles.statsCard, { borderColor: `${accentColor}30` }]}>
            <Stat label="سمعة الحي ⭐" value={stats.reputation} />
            <Stat label="متابعين" value={stats.followers} />
            <Stat label="يتابع" value={stats.following} />
            <Stat label="إسهامات" value={totalContributions} />
          </View>}

          {!locked && (featuredItems.length > 0 || own) && (
            <View style={styles.content}>
              <View style={styles.contentHead}>
                <View>
                  <Text style={[styles.contentTitle, { color: accentColor }]}>{profileCustomization?.featured_title || 'أعمالي المميزة'}</Text>
                  <Text style={styles.contentSub}>{featuredItems.length ? 'اختيارات مثبتة من هذا الجار' : 'اختر أفضل مساهماتك لتظهر هنا'}</Text>
                </View>
                {own && featuredItems.length > 0 && <Pressable style={styles.marketLink} onPress={() => router.push('/profile-customization')}><Text style={[styles.marketLinkText, { color: accentColor }]}>إدارة</Text><Edit3 size={14} color={accentColor} /></Pressable>}
              </View>
              {featuredItems.length > 0 ? (
                <View style={[styles.grid, { gap: 12 }]}>
                  {featuredItems.map(item => <ActivityCard key={item._featuredType + ':' + item.id} type={item._featuredType === 'question' ? 'questions' : item._featuredType === 'service' ? 'services' : item._featuredType === 'request' ? 'requests' : 'market'} item={item} width={cardWidth} />)}
                </View>
              ) : (
                <View style={styles.featuredEmpty}>
                  <Sparkles size={22} color={accentColor} />
                  <Text style={styles.contentSub}>لم تثبّت أي عمل بعد. ثبّت الاستفسارات أو الخدمات أو الطلبات أو إعلانات السوق التي تفتخر بها.</Text>
                  <ProfileCustomizationEntry accentColor={accentColor} compact />
                </View>
              )}
            </View>
          )}

          {/* Activity Category Tabs */}
          <View style={styles.tabsCard}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
              {TABS.filter(({ id: key }) => (key !== 'answers' || own) && (key !== 'services' || (profileCustomization && profileCustomization.section_visibility && profileCustomization.section_visibility.services !== false)) && (key !== 'questions' || !(profileCustomization && profileCustomization.section_visibility && profileCustomization.section_visibility.questions === false)) && (key !== 'market' || !(profileCustomization && profileCustomization.section_visibility && profileCustomization.section_visibility.products === false)) && (key !== 'requests' || !(profileCustomization && profileCustomization.section_visibility && profileCustomization.section_visibility.services === false)) && (key !== 'reviews' || !(profileCustomization && profileCustomization.section_visibility && profileCustomization.section_visibility.reviews === false))).sort((a, b) => { const order = (profileCustomization && profileCustomization.section_order) || []; const aKey = a.id === 'market' ? 'products' : a.id === 'answers' ? 'questions' : a.id === 'requests' ? 'services' : a.id; const bKey = b.id === 'market' ? 'products' : b.id === 'answers' ? 'questions' : b.id === 'requests' ? 'services' : b.id; return order.indexOf(aKey) - order.indexOf(bKey); }).map(({ id: key, label, icon: Icon }) => {
                const count =
                  key === 'market'
                    ? stats.market
                    : key === 'services'
                    ? stats.services
                    : key === 'requests'
                    ? stats.requests
                    : key === 'questions'
                    ? stats.questions
                    : key === 'reviews'
                    ? reviews.length
                    : stats.answers;
                const active = tab === key;
                return (
                  <Pressable
                    key={key}
                    onPress={() => { setTab(key); void loadTabData(key, id, currentUserId); }}
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
                {profile.is_banned === true && !own ? 'هذا الحساب موقوف' : blocked || blockedByOther ? 'المحتوى غير متاح' : profile.hide_name === true && !own ? 'هذا الملف غير متاح' : 'هذا الملف خاص'}
              </Text>
              <Text style={styles.lockText}>
                {profile.is_banned === true && !own
                  ? 'لا يمكن عرض محتوى هذا الحساب حالياً.'
                  : blocked
                  ? 'قمت بحظر هذا المستخدم.'
                  : blockedByOther
                  ? 'هذا المستخدم قام بحظرك.'
                  : profile.hide_name === true && !own
                  ? 'صاحب الحساب اختار إخفاء ملفه عن الزوار.'
                  : 'تابع المستخدم لعرض نشاطه ومحتواه.'}
              </Text>
              {!profile.is_banned && profile.profile_privacy !== 'hidden' && profile.hide_name !== true && !blocked && !blockedByOther && !following && (
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

              {tabLoading && !loadedTabs.includes(tab) ? (
                <View style={styles.empty}><ActivityIndicator size="small" color="#059669" /><Text style={styles.emptyText}>جارٍ تحميل القسم...</Text></View>
              ) : tabError && !loadedTabs.includes(tab) ? (
                <View style={styles.empty}><Text style={styles.emptyTitle}>تعذر تحميل القسم</Text><Text style={styles.emptyText}>تحقق من الاتصال ثم أعد المحاولة.</Text><Pressable style={styles.primaryBtn} onPress={() => void loadTabData(tab, id, currentUserId, true)}><Text style={styles.primaryBtnText}>إعادة المحاولة</Text></Pressable></View>
              ) : currentData.length === 0 ? (
                <Empty tab={tab} own={own} />
              ) : (
                <View style={[styles.grid, { gap: 12 }]}>
                  {tab === 'reviews' ? currentData.map((item: any) => (
                    <View key={item.id} style={styles.reviewCard}>
                      <Pressable style={styles.reviewAuthor} onPress={() => item.reviewer?.id && router.push({ pathname: '/user', params: { id: item.reviewer.id } })}>
                        {item.reviewer?.avatar_url ? <Image source={{ uri: item.reviewer.avatar_url }} style={styles.reviewAvatar} /> : <View style={styles.reviewAvatarFallback}><User size={16} color="#059669" /></View>}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.reviewAuthorName}>{item.reviewer?.display_name || item.reviewer?.username || 'مستخدم'}</Text>
                          <Text style={styles.reviewDate}>{formatTimeAgo(item.created_at)}</Text>
                        </View>
                        <View style={styles.reviewStars}><Text style={styles.reviewRating}>{Math.max(0, Math.min(5, Number(item.rating) || 0))}/5</Text><Star size={15} color="#d97706" fill="#f59e0b" /></View>
                      </Pressable>
                      {!!item.body && <Text style={styles.reviewBody}>{item.body}</Text>}
                    </View>
                  )) : currentData.map(item => (
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
    questions: 'لا توجد استفسارات',
    answers: 'لا توجد إجابات منشورة',
    services: 'لا توجد خدمات منشورة',
    requests: 'لا توجد طلبات فزعة',
    market: 'لا توجد إعلانات في السوق',
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
  const title =
    type === 'services'
      ? item.name
      : type === 'answers'
      ? item.questions?.title || 'إجابة على استفسار بالحي'
      : item.title || item.name;
  const itemDistrict = type === 'answers' ? (item.questions?.district || item.district) : item.district;
  const subtitle =
    type === 'market'
      ? item.description || 'إعلان من سوق الحي'
      : type === 'services'
      ? item.description || item.category || 'خدمة محلية'
      : type === 'requests'
      ? item.description || 'طلب مساعدة من الحي'
      : type === 'answers'
      ? item.body || 'مشاركة الجار'
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
      router.push({ pathname: '/marketplace-item', params: { id: item.id } });
    } else if (type === 'services') {
      router.push({ pathname: '/service', params: { id: item.id } });
    } else if (type === 'requests') {
      router.push({ pathname: '/request', params: { id: item.id } });
    } else if (type === 'questions') {
      router.push({ pathname: '/question', params: { id: item.id } });
    } else if (type === 'answers') {
      router.push({ pathname: '/question', params: { id: item.question_id } });
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
            ) : type === 'answers' ? (
              <MessageCircle size={28} color="#059669" />
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
            <Text style={styles.meta}>{itemDistrict ? `حي ${itemDistrict}` : 'الحي'}</Text>
          )}
          <View style={styles.metaRow}>
            <MapPin size={11} color="#94a3b8" />
            <Text style={styles.meta}>{itemDistrict || 'الحي'}</Text>
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
  avatarRingHasStory: {
    backgroundColor: '#fbbf24',
    borderWidth: 2,
    borderColor: '#fde68a',
    shadowColor: '#f59e0b',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 8,
    elevation: 6,
  },
  storyAvailableBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#f59e0b',
    borderWidth: 2,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
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
  featuredEmpty: { alignItems: 'center', gap: 10, paddingVertical: 18 },
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
