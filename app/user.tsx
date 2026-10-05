import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator, Alert, Image, Platform, Pressable, RefreshControl,
  ScrollView, StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import {
  ArrowRight, BadgeCheck, BriefcaseBusiness, ChevronLeft, Heart,
Lock, MapPin, MessageCircle, MoreHorizontal, Package, Plus,
  Search, ShieldCheck, ShoppingBag, Sparkles, Star, UserCheck,
  UserPlus, UserRound, UserRoundX, Users, Wrench, Zap,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
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
  const [stats, setStats] = useState({ market: 0, services: 0, requests: 0, questions: 0, followers: 0, following: 0, answers: 0 });
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

      const locked = (p.profile_privacy === 'private' && !isFollowing && me !== id) || iBlocked || blockedMe || (p.hide_name === true && me !== id);
      if (locked) {
        setItems([]); setServices([]); setRequests([]); setQuestions([]);
        setStats({ market: 0, services: 0, requests: 0, questions: 0, followers: 0, following: 0, answers: 0 });
        return;
      }

      const [
        marketCount, serviceCount, requestCount, questionCount, followerCount,
        followingCount, answerCount, itemRows, serviceRows, requestRows,
        questionRows,
      ] = await Promise.all([
        supabase.from('marketplace_items').select('id', { count: 'exact', head: true }).eq('seller_id', id),
        supabase.from('services').select('id', { count: 'exact', head: true }).eq('provider_id', id),
        supabase.from('requests').select('id', { count: 'exact', head: true }).eq('requester_id', id),
        supabase.from('questions').select('id', { count: 'exact', head: true }).eq('author_id', id),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', id),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', id),
        supabase.from('answers').select('id', { count: 'exact', head: true }).eq('author_id', id),
        supabase.from('marketplace_items').select('id,title,description,price,item_type,district,image_url,status,created_at').eq('seller_id', id).order('created_at', { ascending: false }).limit(18),
        supabase.from('services').select('id,name,description,category,district,price_from,price_to,available_now,is_verified,cover_url,created_at').eq('provider_id', id).order('created_at', { ascending: false }).limit(18),
        supabase.from('requests').select('id,title,description,status,request_type,budget,is_urgent,district,created_at').eq('requester_id', id).order('created_at', { ascending: false }).limit(18),
        supabase.from('questions').select('id,title,body,status,category,district,created_at,view_count').eq('author_id', id).order('created_at', { ascending: false }).limit(18),
      ]);
      setStats({
        market: marketCount.count || 0, services: serviceCount.count || 0,
        requests: requestCount.count || 0, questions: questionCount.count || 0,
        followers: followerCount.count || 0, following: followingCount.count || 0,
        answers: answerCount.count || 0,
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

  useEffect(() => { void load(); }, [id]);

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
    } finally { setBusy(false); }
  }

  async function openMessage() {
    if (!currentUserId) return Alert.alert('تسجيل الدخول مطلوب', 'سجّل دخولك أولاً للمراسلة.');
    if (currentUserId === id) return;
    if (blocked) return Alert.alert('الحساب محظور', 'ألغِ الحظر أولاً.');
    if (blockedByOther) return Alert.alert('لا يمكن المراسلة', 'هذا المستخدم حظرك.');
    if (!sameDistrict) return Alert.alert('المراسلة داخل الحي', 'المراسلة الخاصة متاحة بين سكان الحي نفسه.');
    if (profile?.allow_dms === 'nobody') return Alert.alert('الخاص مغلق', 'هذا المستخدم لا يستقبل رسائل خاصة.');
    if (profile?.allow_dms === 'followers' && !following) return Alert.alert('للمتابعين فقط', 'تابع المستخدم أولاً حتى تتمكن من مراسلته.');
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc('hayna_get_or_create_direct_conversation', { p_target: id });
      if (error) throw error;
      if (data) router.push({ pathname: '/conversation', params: { id: data } });
    } catch (e: any) {
      Alert.alert('تعذر فتح المحادثة', e?.message || 'حاول مرة أخرى.');
    } finally { setBusy(false); }
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
            } finally { setBusy(false); }
          },
        },
      ],
    );
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={C.accent} /><Text style={styles.loadingText}>جاري تجهيز الملف…</Text></View>;
  if (!profile) return <View style={styles.center}><UserRoundX size={42} color={C.muted} /><Text style={styles.emptyTitle}>الحساب غير موجود</Text><Pressable style={styles.primaryBtn} onPress={() => router.back()}><Text style={styles.primaryBtnText}>رجوع</Text></Pressable></View>;

  const own = currentUserId === id;
  const anonymous = profile.hide_name === true && !own;
  const displayName = anonymous ? 'جار مجهول' : profile.display_name || profile.username || 'مستخدم';
  const locked = (profile.profile_privacy === 'private' && !following && !own) || blocked || blockedByOther;

  const currentData = tab === 'market' ? items : tab === 'services' ? services : tab === 'requests' ? requests : questions;

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(true); }} tintColor={C.accent} />}
        contentContainerStyle={styles.page}
      >
        <View style={styles.shell}>
          <View style={styles.nav}>
            <Pressable style={styles.iconBtn} onPress={() => router.back()}><ArrowRight size={21} color={C.ink} /></Pressable>
            <View style={styles.navCenter}><Text style={styles.navTitle}>الملف الشخصي</Text><Text style={styles.navSub}>{profile.city || 'عرعر'} · {profile.district ? `حي ${profile.district}` : 'من المجتمع'}</Text></View>
            <Pressable style={styles.iconBtn} onPress={toggleBlock}><MoreHorizontal size={21} color={C.ink} /></Pressable>
          </View>

          <LinearGradient colors={['#064e3b','#047857','#059669']} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.hero}>
            <View style={styles.heroGlowOne} />
            <View style={styles.heroGlowTwo} />
            <View style={styles.heroTop}>
              <View style={styles.avatarRing}>
                {profile.avatar_url && !anonymous ? <Image source={{ uri: profile.avatar_url }} style={styles.avatar} /> : <View style={styles.avatarFallback}><UserRound size={38} color="#047857" /></View>}
                {profile.is_verified && <View style={styles.verified}><BadgeCheck size={15} color="#fff" /></View>}
              </View>
              <View style={styles.heroActions}>
                {!own && !blocked && !blockedByOther && <Pressable style={[styles.followBtn, following && styles.followBtnActive]} onPress={toggleFollow} disabled={busy}><UserCheck size={16} color={following ? C.accent : '#fff'} /><Text style={[styles.followText, following && { color: C.accent }]}>{following ? 'تتابعه' : 'متابعة'}</Text></Pressable>}
                {!own && <Pressable style={styles.messageBtn} onPress={openMessage} disabled={busy}><MessageCircle size={16} color="#fff" /><Text style={styles.messageText}>مراسلة</Text></Pressable>}
              </View>
            </View>
            <View style={styles.heroIdentity}>
              <View style={styles.nameRow}><Text style={styles.name}>{displayName}</Text>{profile.is_verified && !anonymous && <BadgeCheck size={19} color="#a7f3d0" />}</View>
              {!anonymous && profile.username && <Text style={styles.handle}>@{profile.username}</Text>}
              <View style={styles.heroLocation}><MapPin size={14} color="#d1fae5" /><Text style={styles.heroLocationText}>{[profile.district && `حي ${profile.district}`, profile.city].filter(Boolean).join('، ') || 'عرعر'}</Text></View>
            </View>
            {!anonymous && profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}
            <View style={styles.trustRow}>
              <View style={styles.trustPill}><ShieldCheck size={14} color="#a7f3d0" /><Text style={styles.trustText}>{profile.is_geoverified ? 'موثق بالحي' : 'عضو في الحي'}</Text></View>
            </View>
          </LinearGradient>

          <View style={styles.statsCard}>
            <Stat label="متابع" value={stats.followers} />
            <Stat label="يتابع" value={stats.following} />
          </View>

          <View style={styles.tabsCard}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
              {TABS.map(({ id: key, label, icon: Icon }) => {
                const count = key === 'market' ? stats.market : key === 'services' ? stats.services : key === 'requests' ? stats.requests : stats.questions;
                const active = tab === key;
                return <Pressable key={key} onPress={() => setTab(key)} style={[styles.tab, active && styles.tabActive]}><Icon size={16} color={active ? '#fff' : C.muted} /><Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text><Text style={[styles.tabCount, active && styles.tabCountActive]}>{count}</Text></Pressable>;
              })}
            </ScrollView>
          </View>

          {locked ? (
            <View style={styles.lockCard}>
              <View style={styles.lockIcon}><Lock size={28} color={C.accent} /></View>
              <Text style={styles.lockTitle}>{blocked || blockedByOther ? 'المحتوى غير متاح' : 'هذا الملف خاص'}</Text>
              <Text style={styles.lockText}>{blocked ? 'قمت بحظر هذا المستخدم.' : blockedByOther ? 'هذا المستخدم قام بحظرك.' : 'تابع المستخدم لعرض نشاطه ومحتواه.'}</Text>
              {!blocked && !blockedByOther && !following && <Pressable style={styles.primaryBtn} onPress={toggleFollow}><UserPlus size={17} color="#fff" /><Text style={styles.primaryBtnText}>متابعة لعرض المحتوى</Text></Pressable>}
            </View>
          ) : (
            <View style={styles.content}>
              <View style={styles.contentHead}>
                <View><Text style={styles.contentTitle}>{TABS.find(x => x.id === tab)?.label}</Text><Text style={styles.contentSub}>{currentData.length} نتيجة · من نشاط العضو</Text></View>
                <Pressable style={styles.marketLink} onPress={() => router.push('/market')}><Text style={styles.marketLinkText}>فتح السوق</Text><ChevronLeft size={15} color={C.accent} /></Pressable>
              </View>

              {currentData.length === 0 ? <Empty tab={tab} own={own} /> :
                <View style={[styles.grid, { gap: 12 }]}>
                  {currentData.map((item) => <ActivityCard key={item.id} type={tab} item={item} width={cardWidth} />)}
                </View>}
            </View>
          )}

          {!own && <View style={styles.footerHint}><Users size={16} color={C.muted} /><Text style={styles.footerHintText}>مجتمع الحي · تواصل باحترام وخصوصية</Text></View>}
        </View>
      </ScrollView>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value > 999 ? '999+' : value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function Empty({ tab, own }: { tab: Tab; own: boolean }) {
  const titles: Record<Tab, string> = { market: 'لا توجد إعلانات في السوق', services: 'لا توجد خدمات منشورة', requests: 'لا توجد طلبات منشورة', questions: 'لا توجد استفسارات' };
  return <View style={styles.empty}><View style={styles.emptyIcon}><Package size={28} color={C.accent} /></View><Text style={styles.emptyTitle}>{titles[tab]}</Text><Text style={styles.emptyText}>{own ? 'أضف أول إعلان أو خدمة من السوق وابدأ نشاطك.' : 'سيظهر نشاط العضو هنا عند نشر محتوى جديد.'}</Text>{own && <Pressable style={styles.primaryBtn} onPress={() => router.push('/market')}><Plus size={16} color="#fff" /><Text style={styles.primaryBtnText}>الذهاب للسوق</Text></Pressable>}</View>;
}

function ActivityCard({ type, item, width }: { type: Tab; item: any; width: number }) {
  const image = item.image_url || item.cover_url;
  const title = type === 'services' ? item.name : item.title || item.name;
  const subtitle = type === 'market'
    ? (item.description || 'إعلان من سوق الحي')
    : type === 'services'
      ? (item.description || item.category || 'خدمة محلية')
      : type === 'requests'
        ? (item.description || 'طلب مساعدة من الحي')
        : (item.body || item.category || 'استفسار مجتمعي');
  const price = type === 'market'
    ? (item.price != null ? `${Number(item.price).toLocaleString('ar-SA')} ر.س` : 'على السوم')
    : type === 'services'
      ? (item.price_from != null ? `من ${Number(item.price_from).toLocaleString('ar-SA')} ر.س` : 'السعر بالتواصل')
      : type === 'requests' && item.budget != null ? `ميزانية ${Number(item.budget).toLocaleString('ar-SA')} ر.س` : null;
  const status = type === 'market' ? item.status : type === 'requests' ? item.status : type === 'services' && item.available_now ? 'متاح الآن' : null;

  return (
    <Pressable style={[styles.activityCard, { width }]} onPress={() => type === 'market' ? router.push('/market') : undefined}>
      <View style={styles.cardVisual}>
        {image ? <Image source={{ uri: image }} style={styles.cardImage} /> : <View style={styles.cardPlaceholder}>{type === 'services' ? <Wrench size={30} color={C.accent} /> : type === 'market' ? <ShoppingBag size={30} color={C.accent} /> : type === 'requests' ? <Package size={30} color="#d97706" /> : <Search size={30} color="#2563eb" />}</View>}
        {status && <View style={styles.statusPill}><View style={[styles.statusDot, { backgroundColor: status === 'available' || status === 'open' || status === 'متاح الآن' ? '#22c55e' : '#94a3b8' }]} /><Text style={styles.statusText}>{status === 'available' ? 'متاح' : status === 'sold' ? 'تم البيع' : status === 'reserved' ? 'محجوز' : status}</Text></View>}
        {type === 'requests' && item.is_urgent && <View style={styles.urgent}><Text style={styles.urgentText}>عاجل</Text></View>}
      </View>
      <View style={styles.activityBody}>
        <Text style={styles.activityTitle} numberOfLines={2}>{title || 'بدون عنوان'}</Text>
        <Text style={styles.activitySub} numberOfLines={2}>{subtitle}</Text>
        <View style={styles.activityFooter}>
          {price ? <Text style={styles.price}>{price}</Text> : <Text style={styles.meta}>{item.district ? `حي ${item.district}` : 'عرعر'}</Text>}
          <View style={styles.metaRow}><MapPin size={12} color="#94a3b8" /><Text style={styles.meta}>{item.district || 'عرعر'}</Text></View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  page: { paddingBottom: 110 },
  shell: { width: '100%', maxWidth: 1080, alignSelf: 'center', paddingHorizontal: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg, padding: 24 },
  loadingText: { marginTop: 10, color: C.muted, fontWeight: '700' },
  nav: { height: 72, flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  navCenter: { flex: 1, alignItems: 'flex-end' },
  navTitle: { color: C.ink, fontSize: 20, fontWeight: '900' },
  navSub: { color: C.muted, fontSize: 11.5, marginTop: 2, fontWeight: '700' },
  iconBtn: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e8eef5', alignItems: 'center', justifyContent: 'center' },
  hero: { borderRadius: 28, padding: 20, overflow: 'hidden', minHeight: 270 },
  heroGlowOne: { position: 'absolute', width: 190, height: 190, borderRadius: 95, backgroundColor: 'rgba(255,255,255,0.06)', top: -90, left: -60 },
  heroGlowTwo: { position: 'absolute', width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(16,185,129,0.18)', bottom: -80, right: -30 },
  heroTop: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start' },
  avatarRing: { width: 84, height: 84, borderRadius: 26, padding: 3, backgroundColor: 'rgba(255,255,255,0.28)' },
  avatar: { width: 78, height: 78, borderRadius: 23 },
  avatarFallback: { flex: 1, borderRadius: 23, backgroundColor: '#ecfdf5', alignItems: 'center', justifyContent: 'center' },
  verified: { position: 'absolute', right: -3, bottom: -3, width: 24, height: 24, borderRadius: 12, backgroundColor: '#2563eb', borderWidth: 2, borderColor: '#047857', alignItems: 'center', justifyContent: 'center' },
  heroActions: { flexDirection: 'row-reverse', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '72%' },
  followBtn: { height: 40, paddingHorizontal: 14, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  followBtnActive: { backgroundColor: '#fff', borderColor: '#fff' },
  followText: { color: '#fff', fontWeight: '900', fontSize: 12.5 },
  messageBtn: { height: 40, paddingHorizontal: 14, borderRadius: 13, backgroundColor: '#0f172a', flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  messageText: { color: '#fff', fontWeight: '900', fontSize: 12.5 },
  heroIdentity: { marginTop: 22, alignItems: 'flex-end' },
  nameRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 7 },
  name: { color: '#fff', fontSize: 27, fontWeight: '900', textAlign: 'right' },
  handle: { color: '#d1fae5', fontSize: 13, fontWeight: '700', marginTop: 2 },
  heroLocation: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, marginTop: 8 },
  heroLocationText: { color: '#ecfdf5', fontSize: 12.5, fontWeight: '700' },
  bio: { color: '#ecfdf5', fontSize: 13.5, lineHeight: 21, textAlign: 'right', marginTop: 13 },
  trustRow: { flexDirection: 'row-reverse', gap: 7, flexWrap: 'wrap', marginTop: 16 },
  trustPill: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.12)' },
  trustText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  statsCard: { marginTop: -18, marginHorizontal: 12, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#eaf0f5', padding: 8, flexDirection: 'row-reverse', shadowColor: '#0f172a', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 9, borderLeftWidth: 1, borderLeftColor: '#f1f5f9' },
  statValue: { color: C.ink, fontSize: 18, fontWeight: '900' },
  statLabel: { color: C.muted, fontSize: 10.5, fontWeight: '700', marginTop: 2 },
  card: { marginTop: 12, backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#eaf0f5', padding: 15 },
  sectionHead: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sectionTitle: { color: C.ink, fontSize: 15, fontWeight: '900' },
  badgesRow: { flexDirection: 'row-reverse', gap: 8, paddingTop: 12 },
  badgeCard: { width: 108, padding: 10, borderRadius: 15, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#edf2f7', alignItems: 'center' },
  badgeIcon: { fontSize: 24 },
  badgeName: { color: C.ink, fontSize: 10.5, fontWeight: '800', marginTop: 5 },
  chips: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 7, marginTop: 11 },
  chip: { backgroundColor: C.accentSoft, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 7 },
  chipText: { color: C.accentDark, fontSize: 11.5, fontWeight: '800' },
  tabsCard: { marginTop: 14, backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#eaf0f5', padding: 5 },
  tabs: { flexDirection: 'row-reverse', gap: 5 },
  tab: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 13, backgroundColor: '#f8fafc' },
  tabActive: { backgroundColor: C.accent },
  tabText: { color: C.muted, fontSize: 11.5, fontWeight: '800' },
  tabTextActive: { color: '#fff' },
  tabCount: { color: '#94a3b8', fontSize: 10, fontWeight: '900' },
  tabCountActive: { color: '#d1fae5' },
  content: { marginTop: 18 },
  contentHead: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 10 },
  contentTitle: { color: C.ink, fontSize: 18, fontWeight: '900', textAlign: 'right' },
  contentSub: { color: C.muted, fontSize: 11, marginTop: 3, fontWeight: '600', textAlign: 'right' },
  marketLink: { flexDirection: 'row-reverse', alignItems: 'center', gap: 2 },
  marketLinkText: { color: C.accent, fontSize: 11.5, fontWeight: '900' },
  grid: { flexDirection: 'row-reverse', flexWrap: 'wrap' },
  activityCard: { backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: '#eaf0f5', overflow: 'hidden', ...(Platform.OS === 'web' ? ({ cursor: 'pointer', transition: 'transform .16s ease, box-shadow .16s ease' } as any) : {}) },
  cardVisual: { height: 145, backgroundColor: '#f1f5f9', position: 'relative', overflow: 'hidden' },
  cardImage: { width: '100%', height: '100%' },
  cardPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ecfdf5' },
  statusPill: { position: 'absolute', top: 9, right: 9, backgroundColor: 'rgba(255,255,255,.95)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { color: C.ink, fontSize: 9.5, fontWeight: '900' },
  urgent: { position: 'absolute', top: 9, left: 9, backgroundColor: '#dc2626', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 4 },
  urgentText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  activityBody: { padding: 11 },
  activityTitle: { color: C.ink, fontSize: 13.5, fontWeight: '900', textAlign: 'right', lineHeight: 19 },
  activitySub: { color: C.muted, fontSize: 11, lineHeight: 17, textAlign: 'right', marginTop: 4, minHeight: 32 },
  activityFooter: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8 },
  price: { color: C.accent, fontSize: 12.5, fontWeight: '900', flexShrink: 1 },
  metaRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 3, maxWidth: '52%' },
  meta: { color: '#94a3b8', fontSize: 9.5, fontWeight: '700' },
  lockCard: { marginTop: 18, padding: 35, backgroundColor: '#fff', borderRadius: 22, borderWidth: 1, borderColor: '#eaf0f5', alignItems: 'center' },
  lockIcon: { width: 64, height: 64, borderRadius: 22, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' },
  lockTitle: { color: C.ink, fontSize: 17, fontWeight: '900', marginTop: 13 },
  lockText: { color: C.muted, fontSize: 12.5, textAlign: 'center', lineHeight: 19, marginTop: 5, maxWidth: 420 },
  empty: { padding: 42, backgroundColor: '#fff', borderRadius: 22, borderWidth: 1, borderColor: '#eaf0f5', alignItems: 'center' },
  emptyIcon: { width: 62, height: 62, borderRadius: 21, backgroundColor: C.accentSoft, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: C.ink, fontSize: 15, fontWeight: '900', marginTop: 12 },
  emptyText: { color: C.muted, fontSize: 12, textAlign: 'center', lineHeight: 19, marginTop: 4, maxWidth: 440 },
  primaryBtn: { marginTop: 14, backgroundColor: C.accent, borderRadius: 13, paddingHorizontal: 16, paddingVertical: 11, flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  primaryBtnText: { color: '#fff', fontSize: 12.5, fontWeight: '900' },
  footerHint: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 20, paddingVertical: 18 },
  footerHintText: { color: C.muted, fontSize: 11, fontWeight: '700' },
});

