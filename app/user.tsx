import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { OasisEmptyIllustration } from '@/components/oasis/OasisEmptyIllustration';
import { OasisPressable as Pressable, OasisSurface } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import { useTheme } from '@/context/ThemeContext';
import { ProfileConnections } from '@/components/profile/ProfileConnections';
import { bannerColors } from '@/lib/profileTheme';
import { profileCoverUrl } from '@/lib/profileCover';
import { HeaderAction, AppHeader } from '@/components/shared/AppHeader';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Platform, RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions, Share } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
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
  Star,
  User,
  Edit3,
  Palette,
  Settings,
  CalendarDays,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { ProfileCustomizationEntry } from '@/components/profile/ProfileCustomizationEntry';
import { AccountStatusMark, getAccountIdentityMeta } from '@/components/profile/AccountIdentityBadge';
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
  const { colors } = useTheme();
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [actionError, setActionError] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareNotice, setShareNotice] = useState('');
  const [connections, setConnections] = useState<'followers' | 'following' | null>(null);
  const params = useLocalSearchParams<{ id?: string; username?: string }>();
  const routeId = Array.isArray(params.id) ? params.id[0] : (params.id || '');
  const routeUsername = Array.isArray(params.username) ? params.username[0] : (params.username || '');
  const lookupKey = routeUsername || routeId;
  const [resolvedProfileId, setResolvedProfileId] = useState<string>('');
  const id = resolvedProfileId || routeId;
  const { width } = useWindowDimensions();
  const [coverVersion, setCoverVersion] = useState(Date.now());
  const [coverFailed, setCoverFailed] = useState(false);
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
  const tabsScrollRef=useRef<ScrollView>(null);
  const tabMetrics=useRef<Record<string,{x:number;width:number}>>({});
  const tabViewport=useRef(0);
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

  const visibleTabs = useMemo(() => TABS.filter(({id: key}) => {
    if (key === 'answers') return currentUserId === id;
    const section = key === 'market' ? 'products' : key;
    return profileCustomization?.section_visibility?.[section] !== false;
  }).sort((a,b) => {
    const order: string[] = profileCustomization?.section_order || [];
    const index = (key: Tab) => { const value = order.indexOf(key === 'market' ? 'products' : key === 'answers' ? 'questions' : key); return value < 0 ? 999 : value; };
    return index(a.id) - index(b.id);
  }), [currentUserId,id,profileCustomization]);
  useEffect(() => { if (!loading && visibleTabs.length && !visibleTabs.some(item => item.id === tab)) setTab(visibleTabs[0].id); }, [loading,visibleTabs,tab]);

  function revealActiveTab(key:Tab=tab) {
    const metrics=tabMetrics.current[key];
    if (metrics && tabViewport.current) tabsScrollRef.current?.scrollTo({x:Math.max(0,metrics.x-(tabViewport.current-metrics.width)/2),animated:false});
  }
  useEffect(() => {revealActiveTab();},[tab,visibleTabs]);

  const cardWidth = useMemo(() => {
    const max = Math.min(width, 820) - 32;
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
        const [ownedBusiness, ownedServices] = await Promise.all([
          supabase.from('businesses').select('id').eq('owner_id', profileId).maybeSingle(),
          supabase.from('services').select('id').eq('provider_id', profileId).limit(100),
        ]);
        const serviceIds = (ownedServices.data || []).map((row: any) => row.id).filter(Boolean);
        const reviewQueries: Promise<any>[] = [];
        if (ownedBusiness.data?.id) {
          reviewQueries.push(
            Promise.resolve(
              supabase.from('reviews')
                .select('id,reviewer_id,business_id,service_id,rating,body,created_at')
                .eq('business_id', ownedBusiness.data.id)
                .order('created_at', { ascending: false })
                .limit(30),
            ),
          );
        }
        if (serviceIds.length) {
          reviewQueries.push(
            Promise.resolve(
              supabase.from('reviews')
                .select('id,reviewer_id,business_id,service_id,rating,body,created_at')
                .in('service_id', serviceIds)
                .order('created_at', { ascending: false })
                .limit(30),
            ),
          );
        }
        const reviewResults = reviewQueries.length ? await Promise.all(reviewQueries) : [];
        for (const reviewResult of reviewResults) {
          if (reviewResult.error) throw reviewResult.error;
        }
        const deduped = new Map<string, any>();
        reviewResults.flatMap((reviewResult: any) => reviewResult.data || []).forEach((row: any) => deduped.set(row.id, row));
        const rows = [...deduped.values()]
          .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
          .slice(0, 30);
        const reviewerIds = [...new Set(rows.map((row: any) => row.reviewer_id).filter(Boolean))];
        let reviewers: any[] = [];
        if (reviewerIds.length) {
          const people = await supabase.from('profiles').select('id,username,display_name,avatar_url,is_verified,account_type').in('id', reviewerIds);
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
      const { data: p, error } = await supabase.from('profiles').select('id,username,display_name,avatar_url,role,is_verified,is_verified_merchant,verification_status,account_type,freelance_trade,city,district,bio,is_geoverified,badges,profile_privacy,hide_name,is_banned,allow_dms,created_at')
        .eq(isUuid ? 'id' : 'username', lookupKey).maybeSingle();
      if (error) throw error;
      setCurrentUserId(me);
      setProfile(p);
      setCoverFailed(false);
      setCoverVersion(Date.now());
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
      const initialTab: Tab =
        p.account_type === 'merchant'
          ? (marketCount.count || 0) > 0
            ? 'market'
            : (serviceCount.count || 0) > 0
              ? 'services'
              : (questionCount.count || 0) > 0
                ? 'questions'
                : 'market'
          : p.account_type === 'freelance' || p.account_type === 'provider'
            ? (serviceCount.count || 0) > 0
              ? 'services'
              : (questionCount.count || 0) > 0
                ? 'questions'
                : (marketCount.count || 0) > 0
                  ? 'market'
                  : 'services'
            : (questionCount.count || 0) > 0
              ? 'questions'
              : (serviceCount.count || 0) > 0
                ? 'services'
                : (requestCount.count || 0) > 0
                  ? 'requests'
                  : (marketCount.count || 0) > 0
                    ? 'market'
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

  useFocusEffect(useCallback(() => { void load(); }, [lookupKey]));

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
        setShareNotice('تم نسخ رابط الملف الشخصي');
        return;
      } catch {}
    }
    try {
      await Share.share({ message: text, url });
    } catch {}
  };

  function openOptionsMenu() { setMenuOpen(true); }

  function toggleBlock() {
    if (currentUserId && currentUserId !== id && !busy) setConfirmBlock(true);
  }
  async function confirmBlockChange() {
    if (!currentUserId || currentUserId === id || busy) return;
    setBusy(true); setActionError('');
    try {
      const result = await setBlock(currentUserId, id, !blocked);
      if (!result.ok) throw new Error(result.error);
      setConfirmBlock(false);
      await load(true);
    } catch (error: any) { setActionError(error?.message || 'تعذر تنفيذ العملية. حاول مرة أخرى.'); }
    finally { setBusy(false); }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={OASIS.colors.primary} />
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
          <Pressable oasisVariant="primary" oasisKind="action" style={styles.primaryBtn} onPress={() => void load()}><Text style={styles.primaryBtnText}>إعادة المحاولة</Text></Pressable>
        ) : (
          <Pressable oasisVariant="primary" oasisKind="action" style={styles.primaryBtn} onPress={() => router.back()}><Text style={styles.primaryBtnText}>رجوع</Text></Pressable>
        )}
      </View>
    );
  }

  const own = currentUserId === id;
  const anonymous = profile.hide_name === true && !own;
  const personalDisplayName = profile.display_name || profile.username || 'مستخدم';
  const displayName = anonymous
    ? 'جار مجهول'
    : profile.account_type === 'merchant' && profile.freelance_trade
      ? profile.freelance_trade
      : personalDisplayName;
  const locked = (profile.is_banned === true && !own) || (profile.profile_privacy === 'private' && !following && !own) || (profile.hide_name === true && !own) || blocked || blockedByOther;
  const isAdmin = profile.role === 'admin';
  const totalContributions = stats.market + stats.services + stats.requests + stats.questions + (own ? stats.answers : 0);
  const identityMeta = getAccountIdentityMeta(profile.role, profile.account_type, Boolean(profile.is_verified));
  const accentColor = profileCustomization?.accent_color || identityMeta.color;
  const heroColors: [string, string, string] = (profileCustomization?.banner_style || 'emerald') === 'emerald'
    ? identityMeta.heroColors
    : bannerColors(profileCustomization?.banner_style);
  const coverUrl = profileCoverUrl(id, coverVersion);
  const identityDescriptor =
    profile.freelance_trade ||
    (profile.account_type === 'merchant'
      ? 'نشاط تجاري محلي في مجتمع حيّنا'
      : profile.account_type === 'freelance'
        ? 'مستقل يقدم أعماله وخبراته للمجتمع'
        : profile.account_type === 'provider'
          ? 'مقدم خدمات محلية لسكان الحي'
          : profile.account_type === 'idea'
            ? 'مبادرة أو مشروع ناشئ في المجتمع'
            : 'عضو من أفراد مجتمع حيّنا');

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
    <View style={[styles.screen, {backgroundColor: colors.background}]}>
      <Modal visible={confirmBlock} transparent animationType="fade" onRequestClose={() => {if (!busy) setConfirmBlock(false);}}>
        <View style={social.menuOverlay}><View style={[social.menu,{backgroundColor:colors.surface}]} accessibilityViewIsModal>
          <Text style={[social.name,{fontSize:20,color:colors.ink}]}>{blocked ? 'إلغاء حظر المستخدم؟' : 'حظر المستخدم؟'}</Text>
          <Text style={{color:colors.muted,textAlign:'right',lineHeight:24}}>{blocked ? 'سيتمكن هذا المستخدم من التواصل معك وفق إعدادات الخصوصية.' : 'لن يتمكن المستخدم من مراسلتك أو متابعة حسابك.'}</Text>
          {!!actionError && <Text accessibilityRole="alert" style={{color:colors.danger}}>{actionError}</Text>}
          <Pressable oasisKind="action" oasisVariant="danger" disabled={busy} onPress={() => void confirmBlockChange()}><Text>{busy ? 'جارٍ التنفيذ…' : blocked ? 'إلغاء الحظر' : 'تأكيد الحظر'}</Text></Pressable>
          <Pressable oasisKind="plain" style={social.menuRow} disabled={busy} onPress={() => setConfirmBlock(false)}><Text style={{color:colors.muted}}>إلغاء</Text></Pressable>
        </View></View>
      </Modal>
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <View style={social.menuOverlay}><Pressable oasisKind="plain" style={StyleSheet.absoluteFillObject} onPress={() => setMenuOpen(false)} accessibilityLabel="إغلاق الخيارات" /><View style={[social.menu,{backgroundColor:colors.surface}]}>
          <Text style={[social.name,{fontSize:20,color:colors.ink}]}>خيارات الملف</Text>
          <Pressable oasisKind="plain" style={social.menuRow} onPress={() => {setMenuOpen(false);void handleShareProfile();}}><Share2 size={20} color={colors.ink}/><Text style={{color:colors.ink}}>مشاركة رابط الملف</Text></Pressable>
          {own && <Pressable oasisKind="plain" style={social.menuRow} onPress={() => {setMenuOpen(false);router.push('/profile?tab=settings');}}><Settings size={20} color={colors.ink}/><Text style={{color:colors.ink}}>الإعدادات والتخصيص</Text></Pressable>}
          {!!currentUserId && !own && <><Pressable oasisKind="plain" style={social.menuRow} onPress={() => {setMenuOpen(false);toggleBlock();}}><UserRoundX size={20} color={colors.danger}/><Text style={{color:colors.danger}}>{blocked ? 'إلغاء الحظر' : 'حظر المستخدم'}</Text></Pressable><Pressable oasisKind="plain" style={social.menuRow} onPress={() => {setMenuOpen(false);router.push({pathname:'/report',params:{type:'user',id}});}}><ShieldCheck size={20} color={colors.danger}/><Text style={{color:colors.danger}}>إبلاغ عن الحساب</Text></Pressable></>}
          <Pressable oasisKind="plain" style={social.menuRow} onPress={() => setMenuOpen(false)}><Text style={{color:colors.muted}}>إغلاق</Text></Pressable>
        </View></View>
      </Modal>
      {!!shareNotice && <Pressable oasisKind="plain" onPress={() => setShareNotice('')} style={{padding:12,backgroundColor:colors.soft}}><Text accessibilityRole="alert" style={{color:colors.primary,textAlign:'center'}}>{shareNotice} · إغلاق</Text></Pressable>}
      <ProfileConnections userId={id} kind={connections} onClose={() => setConnections(null)} />
      <AppHeader
        variant="sub"
        title={displayName}
        subtitle={[profile.district && `حي ${profile.district}`, profile.city || ''].filter(Boolean).join(' · ')}
        fallbackRoute="/home"
        rightAction={
          <HeaderAction
            style={{
              width: 36,
              height: 36,
              borderRadius: 14,
              backgroundColor: '#f1f5f9',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onPress={openOptionsMenu}
            accessibilityRole="button"
            accessibilityLabel="خيارات"
          >
            <MoreHorizontal size={18} color={OASIS.colors.muted} />
          </HeaderAction>
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
            tintColor={OASIS.colors.primary}
          />
        }
        contentContainerStyle={styles.page}
      >
        <View style={[styles.shell, { paddingTop: 14 }]}>
          <ProfileHeader profile={profile} customization={profileCustomization} displayName={displayName} coverUri={coverUrl} stats={{...stats, contributions:totalContributions}} own={own} anonymous={anonymous} locked={locked} following={following} followedBy={followedBy} busy={busy || blocked || blockedByOther} hideContactActions={blocked || blockedByOther} hasStories={hasActiveStories} onAvatarPress={openProfileStories} onEdit={() => router.push('/profile?section=edit')} onDesign={() => router.push('/profile?tab=settings&section=design')} onSettings={() => router.push('/profile?tab=settings')} onFollowers={() => setConnections('followers')} onFollowing={() => setConnections('following')} onFollow={() => void toggleFollow()} onMessage={() => void openMessage()} />
          {!locked && (featuredItems.length > 0 || own) && (
            <View style={styles.content}>
              {featuredItems.length > 0 && <View style={styles.contentHead}>
                <View>
                  <Text style={[styles.contentTitle, { color: accentColor }]}>{profileCustomization?.featured_title || 'أعمالي المميزة'}</Text>
                  <Text style={styles.contentSub}>{featuredItems.length ? 'اختيارات مثبتة من هذا الجار' : 'اختر أفضل مساهماتك لتظهر هنا'}</Text>
                </View>
                {own && featuredItems.length > 0 && <Pressable style={styles.marketLink} onPress={() => router.push({ pathname: '/profile', params: { tab: 'settings', section: 'design' } })}><Text style={[styles.marketLinkText, { color: accentColor }]}>إدارة</Text><Edit3 size={14} color={accentColor} /></Pressable>}
              </View>}
              {featuredItems.length > 0 ? (
                <View style={[styles.grid, { gap: 12 }]}>
                  {featuredItems.map(item => <ActivityCard key={item._featuredType + ':' + item.id} type={item._featuredType === 'question' ? 'questions' : item._featuredType === 'service' ? 'services' : item._featuredType === 'request' ? 'requests' : 'market'} item={item} width={cardWidth} />)}
                </View>
              ) : (
                <Pressable oasisKind="plain" onPress={() => router.push('/profile?tab=settings&section=design')} style={{flexDirection:'row-reverse',alignItems:'center',gap:12,padding:16,borderWidth:1,borderColor:colors.line,borderRadius:16,backgroundColor:colors.surface}}><Sparkles size={19} color={accentColor}/><View style={{flex:1,gap:4}}><Text style={{color:colors.ink,textAlign:'right',fontWeight:'700',fontSize:13}}>أبرز أفضل مشاركاتك</Text><Text style={{color:colors.muted,textAlign:'right',fontSize:12}}>اختر مساهمات لتثبيتها في ملفك</Text></View><ChevronLeft size={18} color={colors.muted}/></Pressable>
              )}
            </View>
          )}

          {/* Activity Category Tabs */}
          <OasisSurface oasisSurface="card" style={styles.tabsCard}>
            <ScrollView ref={tabsScrollRef} onLayout={event => {tabViewport.current=event.nativeEvent.layout.width;revealActiveTab();}} onContentSizeChange={() => revealActiveTab()} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
              {visibleTabs.map(({ id: key, label, icon: Icon }) => {
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
                  <Pressable oasisKind="plain" accessibilityRole="tab" accessibilityState={{selected: active}}
                    key={key}
                    onLayout={event => {tabMetrics.current[key]=event.nativeEvent.layout;if(key===tab) revealActiveTab(key);}}
                    onPress={() => { setTab(key); void loadTabData(key, id, currentUserId); }}
                    style={[styles.tab, active && {borderBottomColor: accentColor, borderBottomWidth: 3}]}
                  >
                    <Icon size={15} color={active ? accentColor : colors.muted} />
                    <Text style={[styles.tabText, active && {color: accentColor}]}>{label}</Text>
                    <Text style={[styles.tabCount, active && {color: accentColor}]}>({count})</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </OasisSurface>

          {/* Main Tab Content */}
          {locked ? (
            <OasisSurface oasisSurface="card" style={styles.lockCard}>
              <View style={styles.lockIcon}>
                <Lock size={28} color={OASIS.colors.primary} />
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
                <Pressable oasisVariant="primary" oasisKind="action" style={styles.primaryBtn} onPress={toggleFollow}>
                  <UserPlus size={16} color={OASIS.colors.surface} />
                  <Text style={styles.primaryBtnText}>متابعة لعرض المحتوى</Text>
                </Pressable>
              )}
            </OasisSurface>
          ) : !visibleTabs.length ? <View style={styles.empty}><Text style={styles.emptyTitle}>لا توجد أقسام ظاهرة</Text><Text style={styles.emptyText}>{own ? 'يمكنك إظهار أقسام ملفك من إعدادات التخصيص.' : 'اختار صاحب الحساب إخفاء أقسام نشاطه.'}</Text>{own && <ProfileCustomizationEntry accentColor={accentColor} compact />}</View> : (
            <View style={styles.content}>
              <View style={styles.contentHead}>
                <View>
                  <Text style={styles.contentTitle}>{TABS.find(x => x.id === tab)?.label}</Text>
                  <Text style={styles.contentSub}>{currentData.length} عنصر · من نشاط الجار</Text>
                </View>
                {tab === 'market' && (
                  <Pressable style={styles.marketLink} onPress={() => router.push('/market')}>
                    <Text style={styles.marketLinkText}>سوق الحي</Text>
                    <ChevronLeft size={14} color={OASIS.colors.primary} />
                  </Pressable>
                )}
              </View>

              {tabLoading && !loadedTabs.includes(tab) ? (
                <View style={styles.empty}><ActivityIndicator size="small" color={OASIS.colors.primary} /><Text style={styles.emptyText}>جارٍ تحميل القسم...</Text></View>
              ) : tabError && !loadedTabs.includes(tab) ? (
                <View style={styles.empty}><Text style={styles.emptyTitle}>تعذر تحميل القسم</Text><Text style={styles.emptyText}>تحقق من الاتصال ثم أعد المحاولة.</Text><Pressable oasisVariant="primary" oasisKind="action" style={styles.primaryBtn} onPress={() => void loadTabData(tab, id, currentUserId, true)}><Text style={styles.primaryBtnText}>إعادة المحاولة</Text></Pressable></View>
              ) : currentData.length === 0 ? (
                <Empty tab={tab} own={own} />
              ) : (
                <View style={[styles.grid, { gap: 12 }]}>
                  {tab === 'reviews' ? currentData.map((item: any) => (
                    <OasisSurface oasisSurface="card" key={item.id} style={styles.reviewCard}>
                      <Pressable style={styles.reviewAuthor} onPress={() => item.reviewer?.id && router.push({ pathname: '/user', params: { id: item.reviewer.id } })}>
                        {item.reviewer?.avatar_url ? <Image source={{ uri: item.reviewer.avatar_url }} style={styles.reviewAvatar} /> : <View style={styles.reviewAvatarFallback}><User size={16} color={OASIS.colors.primary} /></View>}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.reviewAuthorName}>{item.reviewer?.display_name || item.reviewer?.username || 'مستخدم'}</Text>
                          <Text style={styles.reviewDate}>{new Date(item.created_at).toLocaleDateString('ar-SA')}</Text>
                        </View>
                        <View style={styles.reviewStars}><Text style={styles.reviewRating}>{Math.max(0, Math.min(5, Number(item.rating) || 0))}/5</Text><Star size={15} color="#d97706" fill={OASIS.colors.warning} /></View>
                      </Pressable>
                      {!!item.body && <Text style={styles.reviewBody}>{item.body}</Text>}
                    </OasisSurface>
                  )) : currentData.map(item => (
                    <ActivityCard key={item.id} type={tab} item={item} width={cardWidth} author={profile} />
                  ))}
                </View>
              )}
            </View>
          )}

          {!own && (
            <View style={styles.footerHint}>
              <Users size={15} color={OASIS.colors.muted} />
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
    reviews: 'لا توجد تقييمات',
  };
  return (
    <View style={styles.empty}>
      <View style={{ alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}><OasisEmptyIllustration kind="empty-feed" /></View>
      <Text style={styles.emptyTitle}>{titles[tab]}</Text>
      <Text style={styles.emptyText}>
        {own
          ? 'أضف أول إعلان أو خدمة أو فزعة من الأقسام وابدأ تفاعلك.'
          : 'سيظهر نشاط هذا الجار هنا فور نشره لأي محتوى جديد.'}
      </Text>
      {own && (
        <Pressable oasisVariant="primary" oasisKind="action" style={styles.primaryBtn} onPress={() => router.push('/market')}>
          <Plus size={15} color={OASIS.colors.surface} />
          <Text style={styles.primaryBtnText}>الذهاب للسوق</Text>
        </Pressable>
      )}
    </View>
  );
}

function ActivityCard({ type, item, width, author }: { type: Tab; item: any; width: number; author?: any }) {
  const { colors } = useTheme();
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

  if (author && (type === 'questions' || type === 'answers' || type === 'requests')) {
    return <Pressable oasisKind="plain" style={[social.post,{backgroundColor:colors.surface,borderColor:colors.line}]} onPress={handleCardPress} accessibilityLabel={title || 'عرض المشاركة'}>
      {item.is_pinned && <View style={social.metaItem}><Star size={13} color={colors.muted}/><Text style={{color:colors.muted,fontSize:11}}>مشاركة مثبتة</Text></View>}
      <View style={{flexDirection:'row-reverse',gap:12}}>
        {author.avatar_url ? <Image source={{uri:author.avatar_url}} style={{width:40,height:40,borderRadius:20}} /> : <View style={{width:40,height:40,borderRadius:20,backgroundColor:colors.soft,alignItems:'center',justifyContent:'center'}}><User size={19} color={colors.primary}/></View>}
        <View style={{flex:1,gap:9,minWidth:0}}>
          <View style={{flexDirection:'row-reverse',flexWrap:'wrap',alignItems:'center',gap:6}}><Text style={{color:colors.ink,fontWeight:'800'}}>{author.display_name || author.username}</Text><AccountStatusMark role={author.role} accountType={author.account_type} isVerified={Boolean(author.is_verified)} size={15}/><Text style={{color:colors.muted,fontSize:12}}>@{author.username}</Text><Text style={{color:colors.muted,fontSize:11}}>{new Date(item.created_at).toLocaleDateString('ar-SA',{day:'numeric',month:'short'})}</Text></View>
          <Text style={{color:colors.ink,fontSize:16,lineHeight:25,textAlign:'right',fontWeight:'700'}}>{title}</Text>
          {!!subtitle && <Text style={{color:colors.ink,fontSize:14,lineHeight:25,textAlign:'right'}} numberOfLines={5}>{subtitle}</Text>}
          <View style={[social.metadata,{justifyContent:'space-between'}]}><View style={social.metaItem}><MapPin size={13} color={colors.muted}/><Text style={{color:colors.muted,fontSize:11}}>{itemDistrict || 'مجتمع حيّنا'}</Text></View>{(item.view_count != null || item.views_count != null) && <Text style={{color:colors.muted,fontSize:11}}>{Number(item.view_count ?? item.views_count ?? 0).toLocaleString('ar-SA')} مشاهدة</Text>}<Text style={{color:colors.primary,fontSize:12}}>عرض {type === 'answers' ? 'النقاش' : 'التفاصيل'} ←</Text></View>
        </View>
      </View>
    </Pressable>;
  }

  return (
    <Pressable oasisKind="card"
      style={[styles.activityCard, { width }]}
      onPress={handleCardPress}
    >
      <View style={styles.cardVisual}>
        {image ? (
          <Image source={{ uri: image }} style={styles.cardImage as any} />
        ) : (
          <View style={styles.cardPlaceholder}>
            {type === 'services' ? (
              <Wrench size={28} color={OASIS.colors.primary} />
            ) : type === 'market' ? (
              <ShoppingBag size={28} color={OASIS.colors.primary} />
            ) : type === 'requests' ? (
              <Package size={28} color="#ea580c" />
            ) : type === 'answers' ? (
              <MessageCircle size={28} color={OASIS.colors.primary} />
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
  screen: { flex: 1, backgroundColor: OASIS.colors.background },
  page: { paddingBottom: 110 },
  shell: { width: '100%', maxWidth: 820, alignSelf: 'center', paddingHorizontal: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: OASIS.colors.background, padding: 16 },
  loadingText: { marginTop: 10, color: OASIS.colors.primary, fontWeight: '600', fontSize: 13 },
  hero: { borderRadius: 14, padding: 18, overflow: 'hidden', minHeight: 250 },
  heroCompact: { padding: 14, minHeight: 220 },
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
  heroTop: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 },
  avatarRing: {
    position: 'relative', width: 104, height: 104, borderRadius: 52,
    padding: 4, marginTop: -52, backgroundColor: OASIS.colors.surface,
  },
  avatarRingHasStory: {
    backgroundColor: '#fbbf24',
    borderWidth: 2,
    borderColor: '#fde68a',
    shadowColor: OASIS.colors.warning,
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
    backgroundColor: OASIS.colors.warning,
    borderWidth: 2,
    borderColor: OASIS.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarFallback: {
    flex: 1,
    borderRadius: 48,
    backgroundColor: OASIS.colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#a7f3d0',
  },
  avatarLetter: {
    color: OASIS.colors.primary,
    fontSize: 30,
    fontWeight: '700',
  },
  verified: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: OASIS.colors.primary,
    borderWidth: 2,
    borderColor: OASIS.colors.surface,
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
    borderColor: OASIS.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroActions: {
    flexDirection: 'row-reverse',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    maxWidth: '100%',
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
  followBtnActive: { backgroundColor: OASIS.colors.surface, borderColor: OASIS.colors.surface },
  followText: { color: OASIS.colors.surface, fontWeight: '700', fontSize: 12.5 },
  messageBtn: {
    height: 38,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: OASIS.colors.ink,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  messageText: { color: OASIS.colors.surface, fontWeight: '700', fontSize: 12.5 },
  ownHeroActions: { flexDirection: 'row-reverse', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' },
  designProfileBtn: {
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
  editProfileText: { color: OASIS.colors.ink, fontWeight: '700', fontSize: 12.5 },
  heroIdentity: { marginTop: 18, alignItems: 'flex-end' },
  nameRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 7 },
  name: { color: OASIS.colors.surface, fontSize: 20, fontWeight: '700', textAlign: 'right' },
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
    fontSize: 11,
    fontWeight: '700',
  },
  handle: { color: OASIS.colors.soft, fontSize: 13, fontWeight: '700', marginTop: 2 },
  heroLocation: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, marginTop: 6 },
  heroLocationText: { color: OASIS.colors.soft, fontSize: 12, fontWeight: '700' },
  bioBox: {
    backgroundColor: 'rgba(0,0,0,0.12)',
    padding: 10,
    borderRadius: 12,
    marginTop: 10,
  },
  bio: { color: OASIS.colors.soft, fontSize: 12.5, lineHeight: 18, textAlign: 'right' },
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
  trustText: { color: OASIS.colors.surface, fontSize: 11, fontWeight: '600' },
  customBadgePill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  customBadgeText: { color: OASIS.colors.soft, fontSize: 11, fontWeight: '700' },
  accountOwnerLine: {
    color: OASIS.colors.soft,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
    marginTop: 3,
  },
  heroIdentityBadges: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  statsCard: {
    marginTop: -16,
    marginHorizontal: 10,
    backgroundColor: OASIS.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: OASIS.colors.line,
    padding: 6,
    flexDirection: 'row-reverse',
    shadowColor: OASIS.colors.ink,
    shadowOpacity: 0,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 8, borderLeftWidth: 1, borderLeftColor: '#f1f5f9' },
  statValue: { color: OASIS.colors.ink, fontSize: 17, fontWeight: '700' },
  statLabel: { color: OASIS.colors.muted, fontSize: 11, fontWeight: '700', marginTop: 2 },
  tabsCard: { marginTop: 16, backgroundColor: OASIS.colors.surface, borderRadius: 0, borderBottomWidth: 1, borderColor: OASIS.colors.line, padding: 0 },
  tabs: { flexDirection: 'row-reverse', gap: 6 },
  tab: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 17,
    borderRadius: 0,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabActive: { backgroundColor: OASIS.colors.primary },
  tabText: { color: OASIS.colors.muted, fontSize: 12, fontWeight: '600' },
  tabTextActive: { color: OASIS.colors.surface },
  tabCount: { color: '#94a3b8', fontSize: 11, fontWeight: '600' },
  tabCountActive: { color: OASIS.colors.soft },
  content: { marginTop: 16 },
  contentHead: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 },
  contentTitle: { color: OASIS.colors.ink, fontSize: 17, fontWeight: '700', textAlign: 'right' },
  featuredEmpty: { alignItems: 'center', gap: 10, paddingVertical: 18 },
  contentSub: { color: OASIS.colors.muted, fontSize: 11, marginTop: 2, fontWeight: '600', textAlign: 'right' },
  marketLink: { flexDirection: 'row-reverse', alignItems: 'center', gap: 2 },
  marketLinkText: { color: OASIS.colors.primary, fontSize: 12, fontWeight: '700' },
  grid: { flexDirection: 'row-reverse', flexWrap: 'wrap' },
  activityCard: {
    backgroundColor: OASIS.colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: OASIS.colors.line,
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },
  cardVisual: { height: 130, backgroundColor: '#f1f5f9', position: 'relative', overflow: 'hidden' },
  cardImage: { width: '100%', height: '100%' },
  cardPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: OASIS.colors.soft },
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
  statusText: { color: OASIS.colors.ink, fontSize: 11, fontWeight: '700' },
  urgent: { position: 'absolute', top: 8, left: 8, backgroundColor: OASIS.colors.danger, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  urgentText: { color: OASIS.colors.surface, fontSize: 11, fontWeight: '700' },
  activityBody: { padding: 10 },
  activityTitle: { color: OASIS.colors.ink, fontSize: 13, fontWeight: '700', textAlign: 'right', lineHeight: 18 },
  activitySub: { color: OASIS.colors.muted, fontSize: 11, lineHeight: 16, textAlign: 'right', marginTop: 3, minHeight: 30 },
  activityFooter: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginTop: 6 },
  price: { color: OASIS.colors.primary, fontSize: 12, fontWeight: '700', flexShrink: 1 },
  metaRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 3 },
  meta: { color: '#94a3b8', fontSize: 11, fontWeight: '700' },
  lockCard: {
    marginTop: 18,
    padding: 24,
    backgroundColor: OASIS.colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: OASIS.colors.line,
    alignItems: 'center',
  },
  lockIcon: { width: 56, height: 56, borderRadius: 14, backgroundColor: OASIS.colors.soft, alignItems: 'center', justifyContent: 'center' },
  lockTitle: { color: OASIS.colors.ink, fontSize: 16, fontWeight: '700', marginTop: 12 },
  lockText: { color: OASIS.colors.muted, fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 4, maxWidth: 380 },
  empty: { padding: 24, backgroundColor: OASIS.colors.surface, borderRadius: 14, borderWidth: 1, borderColor: OASIS.colors.line, alignItems: 'center' },
  emptyIcon: { width: 54, height: 54, borderRadius: 14, backgroundColor: OASIS.colors.soft, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: OASIS.colors.ink, fontSize: 15, fontWeight: '700', marginTop: 10 },
  emptyText: { color: OASIS.colors.muted, fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 4, maxWidth: 380 },
  primaryBtn: {
    marginTop: 14,
    backgroundColor: OASIS.colors.primary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  primaryBtnText: { color: OASIS.colors.surface, fontSize: 12.5, fontWeight: '700' },
  footerHint: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 18,
    paddingVertical: 16,
  },
  footerHintText: { color: OASIS.colors.muted, fontSize: 11, fontWeight: '700' },
  reviewCard: { backgroundColor: OASIS.colors.surface, borderRadius: 16, borderWidth: 1, borderColor: OASIS.colors.line, padding: 12, gap: 8, width: '100%' },
  reviewAuthor: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  reviewAvatar: { width: 36, height: 36, borderRadius: 18 },
  reviewAvatarFallback: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: OASIS.colors.soft },
  reviewAuthorName: { fontSize: 12, fontWeight: '600', color: OASIS.colors.ink, textAlign: 'right' },
  reviewDate: { fontSize: 11, color: '#94a3b8', textAlign: 'right', marginTop: 2 },
  reviewStars: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reviewRating: { fontSize: 12, fontWeight: '600', color: '#b45309' },
  reviewBody: { color: OASIS.colors.muted, fontSize: 12, lineHeight: 19, textAlign: 'right' },

  accountIdentityMark: {
    position: 'absolute',
    right: -5,
    bottom: -4,
    zIndex: 5,
  },

});

const social = StyleSheet.create({
post:{width:'100%',padding:18,borderBottomWidth:1,gap:10},menuOverlay:{flex:1,backgroundColor:'rgba(0,0,0,.4)',justifyContent:'center',alignItems:'center',padding:24},menu:{width:'100%',maxWidth:400,borderRadius:24,padding:24,gap:8},menuRow:{flexDirection:'row-reverse',alignItems:'center',gap:12,paddingVertical:14},profile:{borderWidth:1,borderRadius:20,overflow:'hidden'},cover:{width:'100%',overflow:'hidden'},identityBody:{paddingHorizontal:20,paddingBottom:24},topLine:{flexDirection:'row-reverse',justifyContent:'space-between',alignItems:'flex-start',gap:12,marginBottom:14},name:{fontSize:26,fontWeight:'800',textAlign:'right'},bio:{fontSize:15,lineHeight:26,textAlign:'right',marginVertical:6},metadata:{flexDirection:'row-reverse',flexWrap:'wrap',gap:14,marginTop:5},metaItem:{flexDirection:'row-reverse',alignItems:'center',gap:6},numbers:{flexDirection:'row-reverse',flexWrap:'wrap',gap:22,marginTop:12,marginBottom:6},followsYou:{paddingHorizontal:8,paddingVertical:3,borderRadius:5,fontSize:11},iconButton:{width:40,height:40,borderRadius:20,borderWidth:1,alignItems:'center',justifyContent:'center'},coverEdit:{position:'absolute',left:16,top:16,backgroundColor:'rgba(0,0,0,.4)',padding:10,borderRadius:24,flexDirection:'row-reverse',gap:8,alignItems:'center'}
});
