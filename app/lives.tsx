import { OasisPressable as Pressable, OasisSurface, OasisTextInput as TextInput } from '@/components/oasis/OasisPrimitives';
import { discoverLives } from '@/lib/liveDiscovery';
import { OASIS } from '@/lib/oasis';
import { HeaderAction, AppHeader } from '@/components/shared/AppHeader';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Animated, Image, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useBottomNavInset } from '@/lib/bottomNav';
import { useNoCopy } from '@/lib/noCopy';
import { C } from '@/lib/ui';
import { supabase } from '@/lib/supabase';
import {
  fetchLiveHostAchievements,
  fetchLiveHostLeaderboard,
  fetchLiveStreams,
  type LiveAchievement,
  type LiveHostLeader,
  type LiveLeaderboardPeriod,
  type LiveStream,
} from '@/lib/lives';
import {
  BadgeCheck,
  ChevronLeft,
  Clock,
  Crown,
  Eye,
  Flame,
  MapPin,
  Medal,
  Radio,
  Sparkles,
  Trophy,
  Users,
  Video,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

type Filter = 'all' | 'following' | 'nearby';
type TabKey = 'live' | 'trending' | 'stars' | 'achievements';

const AUDIENCE_LABEL: Record<LiveStream['audience'], string> = {
  public: 'عام',
  followers: 'لمتابعيك',
  city: 'لمدينتك',
};

// Achievement progress targets — mirror the descriptions in LIVE_ACHIEVEMENT_META.
const ACHIEVEMENT_TARGET: Record<string, number> = {
  first_stream: 1,
  active_host: 4,
  community_voice: 60,
  neighborhood_star: 25,
  consistent_host: 5,
};

const ACHIEVEMENT_UNIT: Record<string, string> = {
  first_stream: 'بث',
  active_host: 'بث',
  community_voice: 'دقيقة',
  neighborhood_star: 'مشاهد',
  consistent_host: 'أيام',
};

function compactCount(value: number): string {
  const n = Number(value) || 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)} م`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)} ألف`;
  return String(n);
}

function liveDuration(startedAt: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 60_000));
  if (minutes < 1) return 'الآن';
  if (minutes < 60) return `${minutes} د`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}س ${rest}د` : `${hours} س`;
}

function LivePulse({ size = 8, color = '#fb3a4b' }: { size?: number; color?: string }) {
  const value = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(value, { toValue: 1, duration: 1300, useNativeDriver: true }),
        Animated.timing(value, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [value]);
  const scale = value.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] });
  const opacity = value.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] });
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color, transform: [{ scale }], opacity }}
      />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </View>
  );
}

export default function LivesScreen() {
  const bottomNavInset = useBottomNavInset();
  useNoCopy();
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [topHosts, setTopHosts] = useState<LiveHostLeader[]>([]);
  const [achievements, setAchievements] = useState<LiveAchievement[]>([]);
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<LiveLeaderboardPeriod>('monthly');
  const [leaderboardError, setLeaderboardError] = useState('');
  const [following, setFollowing] = useState<string[]>([]);
  const [city, setCity] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [category, setCategory] = useState<string>('all');
  const [tab, setTab] = useState<TabKey>('live');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sort, setSort] = useState<'popular' | 'newest'>('popular');
  const [gridWidth, setGridWidth] = useState(0);
  const generation = useRef(0);

  const load = useCallback(async (period: LiveLeaderboardPeriod = leaderboardPeriod) => {
    const request = ++generation.current;
    try {
      setError('');
      const { data: auth } = await supabase.auth.getUser();
      const [rows, profile, follows] = await Promise.all([
        fetchLiveStreams(),
        auth.user ? supabase.from('profiles').select('city').eq('id', auth.user.id).maybeSingle() : Promise.resolve({ data: null }),
        auth.user ? supabase.from('follows').select('following_id').eq('follower_id', auth.user.id) : Promise.resolve({ data: [] }),
      ]);
      if (request !== generation.current) return;
      setStreams(rows);
      setCity(profile.data?.city || null);
      setFollowing((follows.data || []).map((row: any) => row.following_id));
      setCurrentUserId(auth.user?.id || null);
      if (auth.user?.id) {
        try { const awards = await fetchLiveHostAchievements(auth.user.id); if (request !== generation.current) return; setAchievements(awards); }
        catch { if (request !== generation.current) return; setAchievements([]); }
      } else { setAchievements([]); }
      if (auth.user?.id) {
        try {
          const leaders = await fetchLiveHostLeaderboard(period);
          if (request !== generation.current) return;
          setTopHosts(leaders);
          setLeaderboardError('');
        } catch (leaderError) {
          if (request !== generation.current) return;
          setTopHosts([]);
          setLeaderboardError('قائمة نجوم البث تحتاج إلى تحديث قاعدة البيانات.');
          console.error('Unable to load live host leaderboard.', leaderError);
        }
      } else {
        setTopHosts([]);
        setLeaderboardError('');
      }
    } catch (e) {
      if (request !== generation.current) return;
      setError(e instanceof Error ? e.message : 'تعذر تحميل البثوث.');
    } finally {
      if (request === generation.current) { setLoading(false); setRefreshing(false); }
    }
  }, [leaderboardPeriod]);

  useFocusEffect(useCallback(() => {
    void load(leaderboardPeriod);
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const channel = supabase.channel('live-directory-refresh')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_streams' }, () => { clearTimeout(debounce); debounce = setTimeout(() => { void load(leaderboardPeriod); }, 800); })
      .subscribe();
    const timer = setInterval(() => { void load(leaderboardPeriod); }, 30_000);
    return () => { ++generation.current; clearTimeout(debounce); clearInterval(timer); void supabase.removeChannel(channel); };
  }, [load, leaderboardPeriod]));

  // Do not advertise a restricted stream to somebody who cannot obtain its token.
  // The Edge Function remains the source of truth for actual entry permissions.
  const accessibleStreams = useMemo(() => streams.filter((stream) => {
    if (stream.host_id === currentUserId) return true;
    if (stream.audience === 'public') return true;
    if (stream.audience === 'followers') return following.includes(stream.host_id);
    if (stream.audience === 'city') return Boolean(city && stream.profiles?.city &&
      city.toLocaleLowerCase('ar') === stream.profiles.city.toLocaleLowerCase('ar'));
    return false;
  }), [streams, currentUserId, following, city]);

  const isFollowing = useCallback((stream: LiveStream) => following.includes(stream.host_id), [following]);
  const isNearby = useCallback(
    (stream: LiveStream) => Boolean(city && stream.profiles?.city?.toLocaleLowerCase() === city.toLocaleLowerCase()),
    [city],
  );

  const baseCounts = useMemo(() => ({
    all: accessibleStreams.length,
    following: accessibleStreams.filter(isFollowing).length,
    nearby: accessibleStreams.filter(isNearby).length,
  }), [accessibleStreams, isFollowing, isNearby]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    accessibleStreams.forEach((stream) => { if (stream.category) set.add(stream.category); });
    return ['all', ...Array.from(set)];
  }, [accessibleStreams]);

  const visible = useMemo(() => discoverLives(accessibleStreams.filter((stream) => {
    if (category !== 'all' && stream.category !== category) return false;
    if (filter === 'following') return isFollowing(stream);
    if (filter === 'nearby') return isNearby(stream);
    return true;
  }), searchQuery, sort), [accessibleStreams, filter, category, isFollowing, isNearby, searchQuery, sort]);

  const trending = useMemo(() => {
    if (!accessibleStreams.length) return [];
    return [...accessibleStreams]
      .sort((a, b) => ((b.viewer_count || 0) - (a.viewer_count || 0)) || ((b.peak_viewer_count || 0) - (a.peak_viewer_count || 0)))
      .slice(0, 8);
  }, [accessibleStreams]);

  const totalViewers = useMemo(() => accessibleStreams.reduce((sum, stream) => sum + (stream.viewer_count || 0), 0), [accessibleStreams]);
  const hostCount = useMemo(() => new Set(accessibleStreams.map((stream) => stream.host_id)).size, [accessibleStreams]);
  const earnedAchievements = useMemo(() => achievements.filter((item) => item.earned).length, [achievements]);

  const badges: Record<TabKey, number> = {
    live: accessibleStreams.length,
    trending: trending.length,
    stars: topHosts.length,
    achievements: earnedAchievements,
  };

  const reload = useCallback(() => {
    setLoading(true);
    void load(leaderboardPeriod);
  }, [load, leaderboardPeriod]);

  const spotlight = tab === 'live' ? visible[0] : undefined;
  const gridStreams = spotlight ? visible.slice(1) : visible;

  const openStream = (stream: LiveStream) => router.push({ pathname: '/live/[id]', params: { id: stream.id } });

  return (
    <View style={styles.screen}>
      <AppHeader
        variant="tab"
        title="البثوث المباشرة"
        subtitle={accessibleStreams.length > 0 ? `${compactCount(accessibleStreams.length)} على الهواء · ${compactCount(totalViewers)} مشاهد` : 'كن قريبًا من مجتمع حيّك'}
        fallbackRoute="/more"
        rightAction={(
          <HeaderAction
            accessibilityRole="button"
            accessibilityLabel="ابدأ بثًا مباشرًا"
            onPress={() => router.push('/live/create')}
            style={styles.headerCta}
          >
            <Video size={15} color={OASIS.colors.surface} />
            <Text style={styles.headerCtaText}>بث</Text>
          </HeaderAction>
        )}
      />

      {/* ============ Segmented tab bar (fixed) ============ */}
      <View style={styles.tabBarWrap}>
        <View style={styles.tabBar}>
          {TABS.map((item) => {
            const active = tab === item.key;
            const count = badges[item.key];
            const color = active ? OASIS.colors.surface : OASIS.colors.muted;
            return (
              <Pressable oasisVariant={active ? 'primary' : 'secondary'} oasisKind="chip"
                key={item.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setTab(item.key)}
                style={[styles.tabItem, active && styles.tabItemActive]}
              >
                <View style={styles.tabIconWrap}>
                  {item.icon(color)}
                  {count > 0 ? (
                    <View style={[styles.tabBadge, active && styles.tabBadgeActive]}>
                      <Text style={[styles.tabBadgeText, active && styles.tabBadgeTextActive]}>{count > 99 ? '99+' : count}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]} numberOfLines={1}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomNavInset + 28 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(leaderboardPeriod); }} tintColor={C.accent} />}
      >
        {tab === 'live' ? <View style={{ gap: 10, marginBottom: 14 }}>
          <TextInput accessibilityLabel="ابحث عن بث أو مضيف" value={searchQuery} onChangeText={setSearchQuery} placeholder="ابحث عن بث، مضيف، أو مدينة…" style={{ minHeight: 44, borderRadius: 12, borderWidth: 1, borderColor: OASIS.colors.line, backgroundColor: OASIS.colors.surface, paddingHorizontal: 12, textAlign: 'right', color: OASIS.colors.ink }} />
          <View style={{ flexDirection: 'row-reverse', gap: 8 }}>{([['popular', 'الأكثر مشاهدة'], ['newest', 'بدأ حديثًا']] as const).map(([key, label]) => <Pressable key={key} oasisKind="chip" oasisVariant={sort === key ? 'primary' : 'secondary'} accessibilityState={{ selected: sort === key }} onPress={() => setSort(key)}><Text style={{ color: sort === key ? '#fff' : OASIS.colors.primary, fontSize: 12 }}>{label}</Text></Pressable>)}</View>
        </View> : null}
        {/* ================= LIVE TAB ================= */}
        {tab === 'live' && (
          <View>
            <LinearGradient colors={[OASIS.colors.deep, OASIS.colors.primary, OASIS.colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
              <View style={styles.heroTop}>
                <View style={styles.heroLive}>
                  <LivePulse size={9} color="#fecdd3" />
                  <Text style={styles.heroLiveText}>على الهواء الآن</Text>
                </View>
                <Text style={styles.heroCaption}>شاهد، تفاعل، وادعم مبدعي حيّنا</Text>
              </View>

              <View style={styles.heroStats}>
                <HeroStat icon={<Radio size={15} color={OASIS.colors.soft} />} value={compactCount(accessibleStreams.length)} label="بث مباشر" />
                <View style={styles.heroDivider} />
                <HeroStat icon={<Eye size={15} color={OASIS.colors.soft} />} value={compactCount(totalViewers)} label="مشاهد" />
                <View style={styles.heroDivider} />
                <HeroStat icon={<Users size={15} color={OASIS.colors.soft} />} value={compactCount(hostCount)} label="مضيف" />
              </View>

              <Pressable accessibilityRole="button" style={styles.heroCta} onPress={() => router.push('/live/create')}>
                <View style={styles.heroCtaIcon}><Video size={18} color={OASIS.colors.primary} /></View>
                <Text style={styles.heroCtaText}>ابدأ بثًا مباشرًا</Text>
                <ChevronLeft size={18} color={OASIS.colors.deep} />
              </Pressable>
            </LinearGradient>

            {categories.length > 1 && (
              <ScrollView style={{ direction: 'rtl' }} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chipsRow, { direction: 'ltr' }]}>
                {categories.map((key) => (
                  <Chip key={key} label={key === 'all' ? 'كل الفئات' : key} active={category === key} onPress={() => setCategory(key)} />
                ))}
              </ScrollView>
            )}

            <View style={styles.segRow}>
              {([
                ['all', 'الكل'], ['following', 'أتابعهم'], ['nearby', 'قريب مني'],
              ] as [Filter, string][]).map(([key, label]) => (
                <Pressable key={key} onPress={() => setFilter(key)} style={[styles.seg, filter === key && styles.segActive]}>
                  <Text style={[styles.segText, filter === key && styles.segTextActive]}>{label}</Text>
                  <View style={[styles.segCount, filter === key && styles.segCountActive]}>
                    <Text style={[styles.segCountText, filter === key && styles.segCountTextActive]}>{baseCounts[key]}</Text>
                  </View>
                </Pressable>
              ))}
            </View>

            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>اكتشف البثوث المباشرة</Text>
              <View style={styles.countPill}><LivePulse size={7} /><Text style={styles.countPillText}>{visible.length} بث</Text></View>
            </View>

            {loading ? (
              <View style={styles.state}><ActivityIndicator size="large" color={C.accent} /><Text style={styles.stateText}>جارٍ البحث عن بثوث جيرانك…</Text></View>
            ) : error ? (
              <View style={styles.empty}><Radio color={OASIS.colors.danger} size={32} /><Text style={styles.emptyTitle}>تعذر تحميل البثوث</Text><Text style={styles.emptyText}>{error}</Text><Pressable onPress={reload} style={styles.retry}><Text style={styles.retryText}>إعادة المحاولة</Text></Pressable></View>
            ) : visible.length === 0 ? (
              <View style={styles.empty}>
                <Radio color={OASIS.colors.primary} size={34} />
                <Text style={styles.emptyTitle}>{searchQuery.trim() ? 'لا توجد بثوث تطابق بحثك' : filter === 'following' ? 'لا يوجد بث لمتابَعيك الآن' : filter === 'nearby' ? 'لا يوجد بث قريب الآن' : 'ما فيه بث مباشر الآن'}</Text>
                <Text style={styles.emptyText}>{searchQuery.trim() || category !== 'all' ? 'جرّب كلمات أخرى أو أعد ضبط الفلاتر.' : 'ابدأ بثك الأول وخل جيرانك ينضمون لك.'}</Text>
                {searchQuery.trim() || category !== 'all' || filter !== 'all' ? <Pressable oasisKind="action" onPress={() => { setSearchQuery(''); setCategory('all'); setFilter('all'); }}><Text style={{ color: OASIS.colors.primary }}>عرض كل البثوث</Text></Pressable> : null}
                <Pressable onPress={() => router.push('/live/create')} style={styles.emptyCreate}><Text style={styles.emptyCreateText}>ابدأ بثك الأول</Text></Pressable>
              </View>
            ) : (
              <View>
                {spotlight && <SpotlightCard stream={spotlight} onPress={() => openStream(spotlight)} />}
                {gridStreams.length > 0 && (
                  <View style={styles.grid} onLayout={event => setGridWidth(event.nativeEvent.layout.width)}>
                    {gridStreams.map((stream) => <View key={stream.id} style={{ width: gridWidth ? Math.floor((gridWidth - (gridWidth >= 700 ? 24 : 12) - 1) / (gridWidth >= 700 ? 3 : 2)) : '48%' }}><LiveCard stream={stream} onPress={() => openStream(stream)} /></View>)}
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* ================= TRENDING TAB ================= */}
        {tab === 'trending' && (
          <View>
            <View style={styles.sectionRow}>
              <View style={styles.sectionHeading}>
                <Text style={styles.sectionTitle}>بثوث رائجة</Text>
                <Text style={styles.sectionSub}>الأكثر مشاهدةً في هذه اللحظة</Text>
              </View>
              {trending.length > 0 && <View style={styles.countPill}><Flame size={12} color="#f97316" /><Text style={[styles.countPillText, { color: '#c2410c' }]}>{trending.length}</Text></View>}
            </View>

            {loading ? (
              <View style={styles.state}><ActivityIndicator size="large" color={C.accent} /></View>
            ) : trending.length === 0 ? (
              <View style={styles.empty}><Flame color="#f97316" size={32} /><Text style={styles.emptyTitle}>لا توجد بثوث رائجة بعد</Text><Text style={styles.emptyText}>عندما يجتمع المشاهدون حول بث، سيظهر هنا في مقدمة الرائج.</Text></View>
            ) : (
              <View style={{ gap: 12 }}>
                {trending.map((stream, index) => (
                  <TrendingCard key={stream.id} stream={stream} rank={index + 1} onPress={() => openStream(stream)} />
                ))}
              </View>
            )}
          </View>
        )}

        {/* ================= STARS TAB ================= */}
        {tab === 'stars' && (
          <View>
            <View style={styles.starsHero}>
              <LinearGradient colors={['#78350f', '#b45309', OASIS.colors.warning]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.starsHeroGradient}>
                <Trophy size={26} color="#fef3c7" />
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <Text style={styles.starsHeroTitle}>نجوم البث</Text>
                  <Text style={styles.starsHeroSub}>يُقاس الترتيب بعدد البثوث والدقائق وذروة المشاهدين</Text>
                </View>
              </LinearGradient>
            </View>

            <View style={styles.periodSwitch}>
              {(['monthly', 'weekly'] as LiveLeaderboardPeriod[]).map((period) => (
                <Pressable key={period} onPress={() => setLeaderboardPeriod(period)} style={[styles.periodTab, leaderboardPeriod === period && styles.periodTabActive]}>
                  <Text style={[styles.periodTabText, leaderboardPeriod === period && styles.periodTabTextActive]}>{period === 'monthly' ? 'هذا الشهر' : 'هذا الأسبوع'}</Text>
                </Pressable>
              ))}
            </View>

            {leaderboardError !== '' && <Text style={styles.leaderboardError}>{leaderboardError}</Text>}

            {topHosts.length > 0 ? (
              <View>
                <View style={styles.podiumRow}>
                  {[topHosts[1], topHosts[0], topHosts[2]].map((host, position) => {
                    if (!host) return <View key={`gap-${position}`} style={{ flex: 1 }} />;
                    const rank = position === 1 ? 1 : position === 0 ? 2 : 3;
                    return <PodiumCard key={host.host_id} host={host} rank={rank} />;
                  })}
                </View>
                {topHosts.length > 3 && (
                  <View style={{ gap: 9, marginTop: 6 }}>
                    {topHosts.slice(3).map((host, index) => (
                      <HostRow key={host.host_id} host={host} rank={index + 4} />
                    ))}
                  </View>
                )}
              </View>
            ) : currentUserId ? (
              <View style={styles.empty}><Trophy color="#b45309" size={32} /><Text style={styles.emptyTitle}>لم يُحدد نجم بث بعد</Text><Text style={styles.emptyText}>ابدأ بثك الأول لتظهر في قائمة النجوم.</Text></View>
            ) : (
              <View style={styles.empty}><Crown color="#b45309" size={32} /><Text style={styles.emptyTitle}>سجّل الدخول لمتابعة النجوم</Text><Text style={styles.emptyText}>تابع ترتيب أشهر المضيفين في حيّك أسبوعيًا وشهريًا.</Text><Pressable onPress={() => router.push('/auth')} style={styles.retry}><Text style={styles.retryText}>تسجيل الدخول</Text></Pressable></View>
            )}
          </View>
        )}

        {/* ================= ACHIEVEMENTS TAB ================= */}
        {tab === 'achievements' && (
          <View>
            <View style={styles.sectionRow}>
              <View style={styles.sectionHeading}>
                <Text style={styles.sectionTitle}>إنجازاتك في البث</Text>
                <Text style={styles.sectionSub}>تُمنح وفق معايير واضحة، لا بعدد النقرات</Text>
              </View>
              <View style={styles.countPill}><Sparkles size={12} color="#7c3aed" /><Text style={[styles.countPillText, { color: '#6d28d9' }]}>{earnedAchievements}/{achievements.length || 5}</Text></View>
            </View>

            {achievements.length > 0 ? (
              <View>
                <View style={styles.achSummary}>
                  <Text style={styles.achSummaryValue}>{earnedAchievements}</Text>
                  <View style={{ flex: 1, alignItems: 'flex-end' }}>
                    <Text style={styles.achSummaryTitle}>إنجازات مُحرَزة</Text>
                    <Text style={styles.achSummarySub}>من أصل {achievements.length} إنجاز متاح</Text>
                  </View>
                  <View style={styles.achSummaryPercent}>
                    <Text style={styles.achSummaryPercentText}>{Math.round((earnedAchievements / achievements.length) * 100)}%</Text>
                  </View>
                </View>
                <View style={styles.achGrid}>
                  {achievements.map((item) => <AchievementCard key={item.key} item={item} />)}
                </View>
              </View>
            ) : currentUserId ? (
              <View style={styles.empty}><Sparkles color="#7c3aed" size={32} /><Text style={styles.emptyTitle}>لا توجد إنجازات بعد</Text><Text style={styles.emptyText}>ابدأ بثك الأول لتحصل على أول إنجاز في رحلتك.</Text><Pressable onPress={() => router.push('/live/create')} style={styles.emptyCreate}><Text style={styles.emptyCreateText}>ابدأ بثك الأول</Text></Pressable></View>
            ) : (
              <View style={styles.empty}><Sparkles color="#7c3aed" size={32} /><Text style={styles.emptyTitle}>سجّل الدخول لعرض إنجازاتك</Text><Text style={styles.emptyText}>تابع تقدّمك وافتح الأوسمة كلما قدّمت بثوثًا أكثر.</Text><Pressable onPress={() => router.push('/auth')} style={styles.retry}><Text style={styles.retryText}>تسجيل الدخول</Text></Pressable></View>
            )}
          </View>
        )}

        <View style={styles.privacyHint}><MapPin size={15} color={OASIS.colors.muted} /><Text style={styles.privacyText}>نُظهر المدينة والحي فقط بحسب إعدادات البث، ولا نشارك موقعك الدقيق.</Text></View>
      </ScrollView>
    </View>
  );
}

const TABS: { key: TabKey; label: string; icon: (color: string) => ReactNode }[] = [
  { key: 'live', label: 'مباشر', icon: (color) => <Radio size={18} color={color} /> },
  { key: 'trending', label: 'الرائج', icon: (color) => <Flame size={18} color={color} /> },
  { key: 'stars', label: 'النجوم', icon: (color) => <Trophy size={18} color={color} /> },
  { key: 'achievements', label: 'إنجازاتي', icon: (color) => <Sparkles size={18} color={color} /> },
];

function HeroStat({ icon, value, label }: { icon: ReactNode; value: string; label: string }) {
  return (
    <View style={styles.heroStat}>
      {icon}
      <Text style={styles.heroStatValue}>{value}</Text>
      <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable oasisVariant={active ? 'primary' : 'secondary'} oasisKind="chip" onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

function StreamCover({ stream, tall = false }: { stream: LiveStream; tall?: boolean }) {
  const profile = stream.profiles;
  return (
    <View style={[styles.cover, tall && styles.coverTall]}>
      <LinearGradient colors={['#041b15', '#064e3b', '#042a20']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      {profile?.avatar_url ? <Image source={{ uri: profile.avatar_url }} style={StyleSheet.absoluteFillObject} resizeMode="cover" blurRadius={18} /> : null}
      <LinearGradient colors={['rgba(4,25,20,0.10)', 'rgba(4,28,23,0.45)', 'rgba(1,13,11,0.96)']} locations={[0,0.45,1]} style={StyleSheet.absoluteFill} />
      <View style={styles.coverOrbA} />
      <View style={styles.coverOrbB} />
      <View style={styles.coverAvatarRing}>
        {profile?.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.coverAvatar} />
        ) : (
          <Text style={styles.coverAvatarLetter}>{profile?.display_name?.slice(0, 1) || 'ح'}</Text>
        )}
      </View>
    </View>
  );
}

function SpotlightCard({ stream, onPress }: { stream: LiveStream; onPress: () => void }) {
  const profile = stream.profiles;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.spotlight}>
      <StreamCover stream={stream} tall />
      <View style={styles.spotlightTopRow}>
        <View style={styles.onAir}><LivePulse size={7} color={OASIS.colors.surface} /><Text style={styles.onAirText}>مباشر الآن</Text></View>
        <View style={styles.audienceChip}><Text style={styles.audienceChipText}>{AUDIENCE_LABEL[stream.audience]}</Text></View>
      </View>
      <View style={styles.spotlightBottom}>
        <Text style={styles.spotlightTitle} numberOfLines={1}>{stream.title}</Text>
        <View style={styles.spotlightMetaRow}>
          <Text style={styles.spotlightHost} numberOfLines={1}>{profile?.display_name || profile?.username || 'جارٍ'}</Text>
          {profile?.is_verified && <BadgeCheck size={14} color="#a7f3d0" />}
        </View>
        <View style={styles.spotlightChips}>
          <View style={styles.metaChip}><Users size={12} color={OASIS.colors.line} /><Text style={styles.metaChipText}>{compactCount(stream.viewer_count || 0)} مشاهد</Text></View>
          <View style={styles.metaChip}><Clock size={12} color={OASIS.colors.line} /><Text style={styles.metaChipText}>{liveDuration(stream.started_at)}</Text></View>
          <View style={styles.metaChip}><Text style={styles.metaChipText}>{stream.category}</Text></View>
          <View style={styles.spotlightJoin}><Text style={styles.spotlightJoinText}>شاهد البث</Text><ChevronLeft size={14} color={OASIS.colors.deep} /></View>
        </View>
      </View>
    </Pressable>
  );
}

function LiveCard({ stream, onPress }: { stream: LiveStream; onPress: () => void }) {
  const profile = stream.profiles;
  return (
    <Pressable oasisKind="card" accessibilityRole="button" accessibilityLabel={`مشاهدة بث ${profile?.display_name || 'مستخدم'}`} onPress={onPress} style={styles.card}>
      <StreamCover stream={stream} />
      <View style={styles.cardTopRow}>
        <View style={styles.onAir}><LivePulse size={6} color={OASIS.colors.surface} /><Text style={styles.onAirText}>مباشر</Text></View>
        <View style={styles.viewersPill}><Users size={11} color={OASIS.colors.surface} /><Text style={styles.viewersPillText}>{compactCount(stream.viewer_count || 0)}</Text></View>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={2}>{stream.title}</Text>
        <View style={styles.cardMetaRow}>
          <Text style={styles.cardCategory} numberOfLines={1}>{stream.category} · {AUDIENCE_LABEL[stream.audience]}</Text>
          <Text style={styles.cardDot}>·</Text>
          <Text style={styles.cardDuration}>{liveDuration(stream.started_at)}</Text>
        </View>
        <View style={styles.cardHostRow}>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <View style={styles.cardHostNameRow}>
              <Text numberOfLines={1} style={styles.cardHostName}>{profile?.display_name || profile?.username || 'جارٍ'}</Text>
              {profile?.is_verified && <BadgeCheck size={13} color={OASIS.colors.primary} />}
            </View>
            <Text numberOfLines={1} style={styles.cardHostArea}>{profile?.district ? `حي ${profile.district}` : profile?.city || 'من حيّنا'}</Text>
          </View>
          {profile?.avatar_url ? <Image source={{ uri: profile.avatar_url }} style={styles.cardHostAvatar} /> : <View style={styles.cardHostAvatarFallback}><Text style={styles.cardHostAvatarLetter}>ح</Text></View>}
        </View>
      </View>
    </Pressable>
  );
}

function TrendingCard({ stream, rank, onPress }: { stream: LiveStream; rank: number; onPress: () => void }) {
  const profile = stream.profiles;
  const rankColor = rank === 1 ? OASIS.colors.warning : rank === 2 ? '#94a3b8' : rank === 3 ? '#c084fc' : OASIS.colors.muted;
  return (
    <Pressable oasisKind="card" accessibilityRole="button" onPress={onPress} style={styles.trendingCard}>
      <View style={[styles.trendingRank, { backgroundColor: rankColor }]}><Text style={styles.trendingRankText}>{rank}</Text></View>
      <View style={styles.trendingCover}><StreamCover stream={stream} /></View>
      <View style={styles.trendingInfo}>
        <Text numberOfLines={1} style={styles.trendingTitle}>{stream.title}</Text>
        <View style={styles.trendingHostRow}>
          <Text numberOfLines={1} style={styles.trendingHost}>{profile?.display_name || 'جارٍ'}</Text>
          {profile?.is_verified && <BadgeCheck size={12} color={OASIS.colors.primary} />}
        </View>
        <View style={styles.trendingMeta}>
          <View style={styles.trendingMetaItem}><Eye size={12} color={OASIS.colors.primary} /><Text style={styles.trendingMetaText}>{compactCount(stream.viewer_count || 0)}</Text></View>
          <View style={styles.trendingMetaItem}><Flame size={12} color="#f97316" /><Text style={styles.trendingMetaText}>ذروة {compactCount(stream.peak_viewer_count || 0)}</Text></View>
        </View>
      </View>
      <ChevronLeft size={18} color="#94a3b8" />
    </Pressable>
  );
}

function PodiumCard({ host, rank }: { host: LiveHostLeader; rank: number }) {
  const tones = rank === 1
    ? { ring: OASIS.colors.warning, bg: OASIS.colors.warningSoft, border: '#fde68a' }
    : rank === 2
      ? { ring: '#cbd5e1', bg: OASIS.colors.background, border: OASIS.colors.line }
      : { ring: '#d8b4fe', bg: '#faf5ff', border: '#e9d5ff' };
  const first = rank === 1;
  return (
    <OasisSurface oasisSurface="card" style={[styles.podiumCard, { backgroundColor: tones.bg, borderColor: tones.border }, first && styles.podiumCardFirst]}>
      {first && <Crown size={20} color={OASIS.colors.warning} style={styles.podiumCrown} />}
      <View style={[styles.podiumAvatarWrap, { borderColor: tones.ring }, first && styles.podiumAvatarFirst]}>
        {host.avatar_url ? <Image source={{ uri: host.avatar_url }} style={styles.podiumAvatar} /> : <Text style={styles.podiumInitial}>{host.display_name.slice(0, 1)}</Text>}
      </View>
      <View style={[styles.podiumRankBadge, { backgroundColor: tones.ring }]}><Text style={styles.podiumRankText}>{rank}</Text></View>
      <View style={styles.podiumNameRow}>
        <Text numberOfLines={1} style={styles.podiumName}>{host.display_name}</Text>
        {host.is_verified && <BadgeCheck size={13} color={OASIS.colors.primary} />}
      </View>
      <Text style={styles.podiumStats}>{host.stream_count} بث · {host.total_minutes} د</Text>
    </OasisSurface>
  );
}

function HostRow({ host, rank }: { host: LiveHostLeader; rank: number }) {
  return (
    <View style={styles.hostRow}>
      <View style={styles.hostRank}><Text style={styles.hostRankText}>{rank}</Text></View>
      {host.avatar_url ? <Image source={{ uri: host.avatar_url }} style={styles.hostAvatar} /> : <View style={styles.hostAvatarFallback}><Text style={styles.hostInitial}>{host.display_name.slice(0, 1)}</Text></View>}
      <View style={styles.hostInfo}>
        <View style={styles.hostNameRow}>
          <Text numberOfLines={1} style={styles.hostName}>{host.display_name}</Text>
          {host.is_verified && <BadgeCheck size={13} color={OASIS.colors.primary} />}
        </View>
        <Text style={styles.hostMeta}>{host.stream_count} بث · {host.total_minutes} دقيقة</Text>
      </View>
      <View style={styles.hostMetric}><Medal size={13} color="#b45309" /><Text style={styles.hostMetricText}>{compactCount(host.peak_viewers)} ذروة</Text></View>
    </View>
  );
}

function AchievementCard({ item }: { item: LiveAchievement }) {
  const target = ACHIEVEMENT_TARGET[item.key] || 1;
  const progress = Math.min(1, (Number(item.metric) || 0) / target);
  const unit = ACHIEVEMENT_UNIT[item.key] || '';
  return (
    <OasisSurface oasisSurface="card" style={[styles.achCard, item.earned ? styles.achEarned : styles.achLocked]}>
      <View style={styles.achTopRow}>
        <Text style={styles.achEmoji}>{item.emoji}</Text>
        {item.earned && <View style={styles.achBadge}><Text style={styles.achBadgeText}>أُحرِز</Text></View>}
      </View>
      <Text style={styles.achTitle}>{item.title}</Text>
      <Text numberOfLines={2} style={styles.achDesc}>{item.description}</Text>
      <View style={styles.achBarBg}>
        <View style={[styles.achBarFill, { width: `${Math.round(progress * 100)}%` }, item.earned && { backgroundColor: '#7c3aed' }]} />
      </View>
      <Text style={styles.achProgressText}>
        {Math.min(Number(item.metric) || 0, target)}{target > 1 ? `/${target}` : ''} {unit}
      </Text>
    </OasisSurface>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: 12, paddingTop: 14 },

  headerCta: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, backgroundColor: OASIS.colors.primary, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  headerCtaText: { color: OASIS.colors.surface, fontSize: 12.5, fontWeight: '700' },

  // Tab bar
  tabBarWrap: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 10, backgroundColor: OASIS.colors.soft },
  tabBar: { flexDirection: 'row-reverse', gap: 6, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 5, borderWidth: 1, borderColor: '#E1EDE6', shadowColor: OASIS.colors.deep, shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 9, borderRadius: 15 },
  tabItemActive: { backgroundColor: OASIS.colors.deep },
  tabIconWrap: { position: 'relative' },
  tabLabel: { fontSize: 11.5, fontWeight: '600', color: OASIS.colors.muted },
  tabLabelActive: { color: OASIS.colors.surface },
  tabBadge: { position: 'absolute', top: -6, left: -10, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3, backgroundColor: OASIS.colors.soft, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#a7f3d0' },
  tabBadgeActive: { backgroundColor: OASIS.colors.primary, borderColor: OASIS.colors.deep },
  tabBadgeText: { color: OASIS.colors.primary, fontSize: 11, fontWeight: '700' },
  tabBadgeTextActive: { color: OASIS.colors.surface },

  // Hero
  hero: { borderRadius: 22, padding: 18, marginBottom: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#0F6B4F' },
  heroTop: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  heroLive: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  heroLiveText: { color: OASIS.colors.surface, fontSize: 14, fontWeight: '700' },
  heroCaption: { color: OASIS.colors.soft, fontSize: 11.5, fontWeight: '700' },
  heroStats: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(2,44,34,0.28)', borderRadius: 14, paddingVertical: 12, paddingHorizontal: 8, marginBottom: 14 },
  heroStat: { flex: 1, alignItems: 'center', gap: 3 },
  heroStatValue: { color: OASIS.colors.surface, fontSize: 19, fontWeight: '700' },
  heroStatLabel: { color: OASIS.colors.soft, fontSize: 11, fontWeight: '700' },
  heroDivider: { width: 1, height: 34, backgroundColor: 'rgba(209,250,229,0.25)' },
  heroCta: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, backgroundColor: OASIS.colors.surface, borderRadius: 16, paddingVertical: 11, paddingHorizontal: 12 },
  heroCtaIcon: { width: 34, height: 34, borderRadius: 12, backgroundColor: OASIS.colors.soft, alignItems: 'center', justifyContent: 'center' },
  heroCtaText: { flex: 1, color: OASIS.colors.deep, fontSize: 14.5, fontWeight: '700', textAlign: 'right' },

  // Chips
  chipsRow: { flexDirection: 'row-reverse', gap: 8, paddingBottom: 14 },
  chip: { paddingHorizontal: 15, paddingVertical: 8, borderRadius: 999, backgroundColor: OASIS.colors.surface, borderWidth: 1, borderColor: OASIS.colors.line },
  chipActive: { backgroundColor: OASIS.colors.deep, borderColor: OASIS.colors.deep },
  chipText: { color: OASIS.colors.muted, fontSize: 12.5, fontWeight: '600' },
  chipTextActive: { color: OASIS.colors.surface },

  // Sub-filter segmented
  segRow: { flexDirection: 'row-reverse', gap: 8, marginBottom: 18 },
  seg: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 14, backgroundColor: OASIS.colors.surface, borderWidth: 1, borderColor: OASIS.colors.line },
  segActive: { backgroundColor: OASIS.colors.soft, borderColor: '#a7f3d0' },
  segText: { color: OASIS.colors.muted, fontSize: 12.5, fontWeight: '600' },
  segTextActive: { color: OASIS.colors.primary },
  segCount: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  segCountActive: { backgroundColor: OASIS.colors.primary },
  segCountText: { color: OASIS.colors.muted, fontSize: 11, fontWeight: '700' },
  segCountTextActive: { color: OASIS.colors.surface },

  // Sections
  sectionRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionHeading: { flex: 1, alignItems: 'flex-end' },
  sectionTitle: { color: OASIS.colors.ink, fontSize: 19, fontWeight: '700', textAlign: 'right' },
  sectionSub: { color: OASIS.colors.muted, fontSize: 11.5, fontWeight: '700', marginTop: 2, textAlign: 'right' },
  countPill: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, backgroundColor: OASIS.colors.soft, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 },
  countPillText: { color: OASIS.colors.primary, fontSize: 12, fontWeight: '600' },

  // Covers
  cover: { height: 295, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#061E16' },
  coverTall: { height: 225 },
  coverOrbA: { position: 'absolute', top: -30, left: -20, width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(16,185,129,0.28)' },
  coverOrbB: { position: 'absolute', bottom: -40, right: -24, width: 130, height: 130, borderRadius: 65, backgroundColor: 'rgba(4,120,87,0.35)' },
  coverAvatarRing: { width: 78, height: 78, borderRadius: 39, borderWidth: 2, borderColor: '#6ee7b7', backgroundColor: OASIS.colors.primary, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  coverAvatar: { width: '100%', height: '100%' },
  coverAvatarLetter: { color: OASIS.colors.surface, fontWeight: '700', fontSize: 30 },

  // Spotlight
  spotlight: { borderRadius: 24, overflow: 'hidden', marginBottom: 16, backgroundColor: '#082f25', borderWidth: 1, borderColor: '#24694f' },
  spotlightTopRow: { position: 'absolute', top: 12, right: 12, left: 12, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  spotlightBottom: { padding: 16, gap: 7 },
  spotlightTitle: { color: OASIS.colors.surface, fontSize: 17, fontWeight: '700', textAlign: 'right' },
  spotlightMetaRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5 },
  spotlightHost: { color: '#a7f3d0', fontSize: 12, fontWeight: '600', maxWidth: '80%' },
  spotlightChips: { flexDirection: 'row-reverse', alignItems: 'center', gap: 7, marginTop: 4, flexWrap: 'wrap' },
  metaChip: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  metaChipText: { color: OASIS.colors.line, fontSize: 11, fontWeight: '600' },
  spotlightJoin: { flexDirection: 'row-reverse', alignItems: 'center', gap: 2, backgroundColor: '#6ee7b7', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  spotlightJoinText: { color: OASIS.colors.deep, fontSize: 12, fontWeight: '700' },

  // Live grid card
  grid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 12, alignItems: 'flex-start' },
  card: { width: '100%', height: 295, backgroundColor: '#08241c', borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: '#255941', shadowColor: '#052318', shadowOpacity: 0.12, shadowRadius: 15, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  cardTopRow: { position: 'absolute', top: 12, right: 10, left: 10, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  viewersPill: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, backgroundColor: 'rgba(2,6,23,0.42)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  viewersPillText: { color: OASIS.colors.surface, fontSize: 11, fontWeight: '700' },
  cardBody: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 13, paddingTop: 14, paddingBottom: 15, gap: 5, backgroundColor: 'rgba(1,20,15,0.76)' },
  cardTitle: { color: '#FFFFFF', fontSize: 14.5, fontWeight: '800', textAlign: 'right', minHeight: 34 },
  cardMetaRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5 },
  cardCategory: { color: '#A7F3D0', fontSize: 11, fontWeight: '600', maxWidth: '60%' },
  cardDot: { color: '#cbd5e1', fontSize: 11 },
  cardDuration: { color: '#d2e7de', fontSize: 11, fontWeight: '700' },
  cardHostRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginTop: 2 },
  cardHostNameRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 3 },
  cardHostName: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', maxWidth: 96 },
  cardHostArea: { color: '#b4d5c4', fontSize: 11, marginTop: 1, textAlign: 'right' },
  cardHostAvatar: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: '#6ee7b7' },
  cardHostAvatarFallback: { width: 30, height: 30, borderRadius: 15, backgroundColor: OASIS.colors.soft, alignItems: 'center', justifyContent: 'center' },
  cardHostAvatarLetter: { color: OASIS.colors.primary, fontWeight: '700' },

  // On-air badges
  onAir: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, backgroundColor: '#E11D48', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  onAirText: { color: OASIS.colors.surface, fontSize: 11, fontWeight: '700' },
  audienceChip: { backgroundColor: 'rgba(2,6,23,0.42)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  audienceChipText: { color: OASIS.colors.line, fontSize: 11, fontWeight: '600' },

  // Trending
  trendingCard: { flexDirection: 'row-reverse', alignItems: 'center', gap: 11, backgroundColor: OASIS.colors.surface, borderRadius: 14, padding: 10, borderWidth: 1, borderColor: OASIS.colors.line, shadowColor: OASIS.colors.ink, shadowOpacity: 0, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  trendingRank: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  trendingRankText: { color: OASIS.colors.surface, fontSize: 12.5, fontWeight: '700' },
  trendingCover: { width: 78, height: 78, borderRadius: 14, overflow: 'hidden' },
  trendingInfo: { flex: 1, gap: 3 },
  trendingTitle: { color: OASIS.colors.ink, fontSize: 13.5, fontWeight: '700', textAlign: 'right' },
  trendingHostRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  trendingHost: { color: OASIS.colors.muted, fontSize: 11.5, fontWeight: '600', maxWidth: '75%' },
  trendingMeta: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, marginTop: 2 },
  trendingMetaItem: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  trendingMetaText: { color: OASIS.colors.muted, fontSize: 11, fontWeight: '600' },

  // Stars / leaderboard
  starsHero: { borderRadius: 14, overflow: 'hidden', marginBottom: 12 },
  starsHeroGradient: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, padding: 14 },
  starsHeroTitle: { color: OASIS.colors.surface, fontSize: 18, fontWeight: '700' },
  starsHeroSub: { color: '#fef3c7', fontSize: 11, fontWeight: '700', marginTop: 3, textAlign: 'right' },
  periodSwitch: { flexDirection: 'row-reverse', gap: 8, marginBottom: 16 },
  periodTab: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 14, backgroundColor: OASIS.colors.surface, borderWidth: 1, borderColor: '#fde68a' },
  periodTabActive: { backgroundColor: '#b45309', borderColor: '#b45309' },
  periodTabText: { color: '#92400e', fontSize: 12.5, fontWeight: '600' },
  periodTabTextActive: { color: OASIS.colors.surface },
  leaderboardError: { color: '#9a3412', fontSize: 11.5, textAlign: 'right', marginBottom: 14 },
  podiumRow: { flexDirection: 'row-reverse', alignItems: 'flex-end', gap: 8, marginBottom: 14 },
  podiumCard: { flex: 1, alignItems: 'center', padding: 10, borderRadius: 14, borderWidth: 1, gap: 4 },
  podiumCardFirst: { paddingTop: 14 },
  podiumCrown: { position: 'absolute', top: 4 },
  podiumAvatarWrap: { width: 50, height: 50, borderRadius: 25, borderWidth: 2, backgroundColor: OASIS.colors.surface, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  podiumAvatarFirst: { width: 62, height: 62, borderRadius: 31 },
  podiumAvatar: { width: '100%', height: '100%' },
  podiumInitial: { color: OASIS.colors.primary, fontSize: 18, fontWeight: '700' },
  podiumRankBadge: { position: 'absolute', top: 8, left: 8, width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  podiumRankText: { color: OASIS.colors.surface, fontSize: 11, fontWeight: '700' },
  podiumNameRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 3, maxWidth: '100%' },
  podiumName: { color: OASIS.colors.ink, fontSize: 12, fontWeight: '700', maxWidth: 82 },
  podiumStats: { color: '#78716c', fontSize: 11, fontWeight: '700' },
  hostRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, backgroundColor: OASIS.colors.surface, borderRadius: 16, padding: 10, borderWidth: 1, borderColor: '#fef3c7' },
  hostRank: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#fef3c7', alignItems: 'center', justifyContent: 'center' },
  hostRankText: { color: '#92400e', fontSize: 12, fontWeight: '700' },
  hostAvatar: { width: 40, height: 40, borderRadius: 20 },
  hostAvatarFallback: { width: 40, height: 40, borderRadius: 20, backgroundColor: OASIS.colors.soft, alignItems: 'center', justifyContent: 'center' },
  hostInitial: { color: OASIS.colors.primary, fontSize: 15, fontWeight: '700' },
  hostInfo: { flex: 1, gap: 2 },
  hostNameRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  hostName: { color: OASIS.colors.ink, fontSize: 13, fontWeight: '700', maxWidth: '75%' },
  hostMeta: { color: '#78716c', fontSize: 11, fontWeight: '700', textAlign: 'right' },
  hostMetric: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, backgroundColor: OASIS.colors.warningSoft, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  hostMetricText: { color: '#92400e', fontSize: 11, fontWeight: '600' },

  // Achievements
  achSummary: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, backgroundColor: '#f3f0ff', borderWidth: 1, borderColor: '#ddd6fe', borderRadius: 14, padding: 15, marginBottom: 14 },
  achSummaryValue: { color: '#6d28d9', fontSize: 34, fontWeight: '700' },
  achSummaryTitle: { color: '#4c1d95', fontSize: 15, fontWeight: '700' },
  achSummarySub: { color: '#7c3aed', fontSize: 11.5, fontWeight: '700', marginTop: 2 },
  achSummaryPercent: { width: 54, height: 54, borderRadius: 14, borderWidth: 3, borderColor: '#c4b5fd', alignItems: 'center', justifyContent: 'center' },
  achSummaryPercentText: { color: '#6d28d9', fontSize: 13, fontWeight: '700' },
  achGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 12 },
  achCard: { width: '48%', flexGrow: 1, maxWidth: '49%', padding: 13, borderRadius: 14, borderWidth: 1, gap: 5 },
  achEarned: { backgroundColor: OASIS.colors.surface, borderColor: '#c4b5fd' },
  achLocked: { backgroundColor: 'rgba(255,255,255,0.6)', borderColor: '#e9d5ff' },
  achTopRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  achEmoji: { fontSize: 24 },
  achBadge: { backgroundColor: '#7c3aed', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  achBadgeText: { color: OASIS.colors.surface, fontSize: 11, fontWeight: '700' },
  achTitle: { color: '#4c1d95', fontSize: 13, fontWeight: '700', textAlign: 'right' },
  achDesc: { color: '#6b21a8', fontSize: 11, lineHeight: 16, textAlign: 'right', minHeight: 30 },
  achBarBg: { height: 7, borderRadius: 4, backgroundColor: '#ede9fe', overflow: 'hidden', marginTop: 3 },
  achBarFill: { height: '100%', borderRadius: 4, backgroundColor: '#a78bfa' },
  achProgressText: { color: '#7c3aed', fontSize: 11, fontWeight: '600', textAlign: 'right' },

  // States
  state: { paddingVertical: 50, alignItems: 'center', gap: 12 },
  stateText: { color: OASIS.colors.muted, fontSize: 13 },
  empty: { backgroundColor: OASIS.colors.surface, borderRadius: 14, borderWidth: 1, borderColor: OASIS.colors.line, padding: 16, alignItems: 'center', gap: 9, shadowColor: OASIS.colors.ink, shadowOpacity: 0, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  emptyTitle: { color: OASIS.colors.ink, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  emptyText: { color: OASIS.colors.muted, fontSize: 13, textAlign: 'center', lineHeight: 21 },
  retry: { paddingVertical: 9, paddingHorizontal: 18, backgroundColor: OASIS.colors.soft, borderRadius: 15, marginTop: 5 },
  retryText: { color: OASIS.colors.primary, fontWeight: '600' },
  emptyCreate: { marginTop: 6, backgroundColor: OASIS.colors.primary, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 10 },
  emptyCreateText: { color: OASIS.colors.surface, fontWeight: '700' },

  privacyHint: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 7, padding: 12, marginTop: 18, backgroundColor: '#f1f5f9', borderRadius: 14 },
  privacyText: { flex: 1, color: OASIS.colors.muted, fontSize: 11, textAlign: 'right', lineHeight: 17 },
});
