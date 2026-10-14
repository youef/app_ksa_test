import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, ImageBackground, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { AppHeader } from '@/components/shared/AppHeader';
import { useBottomNavInset } from '@/lib/bottomNav';
import { C } from '@/lib/ui';
import { supabase } from '@/lib/supabase';
import { fetchLiveHostAchievements, fetchLiveHostLeaderboard, fetchLiveStreams, type LiveAchievement, type LiveHostLeader, type LiveLeaderboardPeriod, type LiveStream } from '@/lib/lives';
import { BadgeCheck, ChevronLeft, MapPin, Radio, Trophy, Users, Video, Sparkles } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

type Filter = 'all' | 'following' | 'nearby';

export default function LivesScreen() {
  const bottomNavInset = useBottomNavInset();
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [topHosts, setTopHosts] = useState<LiveHostLeader[]>([]);
  const [achievements, setAchievements] = useState<LiveAchievement[]>([]);
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<LiveLeaderboardPeriod>('monthly');
  const [leaderboardError, setLeaderboardError] = useState('');
  const [following, setFollowing] = useState<string[]>([]);
  const [city, setCity] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (period: LiveLeaderboardPeriod = leaderboardPeriod) => {
    try {
      setError('');
      const { data: auth } = await supabase.auth.getUser();
      const [rows, profile, follows] = await Promise.all([
        fetchLiveStreams(),
        auth.user ? supabase.from('profiles').select('city').eq('id', auth.user.id).maybeSingle() : Promise.resolve({ data: null }),
        auth.user ? supabase.from('follows').select('following_id').eq('follower_id', auth.user.id) : Promise.resolve({ data: [] }),
      ]);
      setStreams(rows);
      setCity(profile.data?.city || null);
      setFollowing((follows.data || []).map((row: any) => row.following_id));
      setCurrentUserId(auth.user?.id || null);
      if (auth.user?.id) {
        try { setAchievements(await fetchLiveHostAchievements(auth.user.id)); }
        catch { setAchievements([]); }
      } else { setAchievements([]); }
      try {
        setTopHosts(await fetchLiveHostLeaderboard(period));
        setLeaderboardError('');
      } catch (leaderError) {
        setTopHosts([]);
        setLeaderboardError('قائمة نجوم البث تحتاج إلى تحديث قاعدة البيانات.');
        console.error('Unable to load live host leaderboard.', leaderError);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحميل البثوث.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [leaderboardPeriod]);

  useEffect(() => { void load(leaderboardPeriod); }, [leaderboardPeriod, load]);
  useFocusEffect(useCallback(() => {
    const channel = supabase.channel('live-directory-refresh')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_streams' }, () => { void load(leaderboardPeriod); })
      .subscribe();
    const timer = setInterval(() => { void load(leaderboardPeriod); }, 20_000);
    return () => { clearInterval(timer); void supabase.removeChannel(channel); };
  }, [load, leaderboardPeriod]));

  const filtered = useMemo(() => streams.filter((stream) => {
    if (filter === 'following') return following.includes(stream.host_id);
    if (filter === 'nearby') return Boolean(city && stream.profiles?.city?.toLocaleLowerCase() === city.toLocaleLowerCase());
    return true;
  }), [streams, following, filter, city]);

  const trending = useMemo(() => {
    if (streams.length < 4) return [];
    return [...streams]
      .sort((a, b) => ((b.viewer_count || 0) - (a.viewer_count || 0)) || ((b.peak_viewer_count || 0) - (a.peak_viewer_count || 0)))
      .slice(0, 6);
  }, [streams]);

  return (
    <View style={styles.screen}>
      <AppHeader variant="sub" title="البثوث المباشرة" subtitle="كن قريبًا من مجتمع حيّك" fallbackRoute="/more" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomNavInset + 28 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(leaderboardPeriod); }} tintColor={C.accent} />}
      >
        <Pressable accessibilityRole="button" style={styles.createCard} onPress={() => router.push('/live/create')}>
          <LinearGradient colors={['#065f46', '#059669', '#10b981']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.createGradient}>
            <View style={styles.createIcon}><Video size={25} color="#059669" /></View>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={styles.createTitle}>ابدأ بثًا مباشرًا</Text>
              <Text style={styles.createSubtitle}>شارك جيرانك لحظتك واصعد بضيوفك</Text>
            </View>
            <ChevronLeft color="#fff" size={22} />
          </LinearGradient>
        </Pressable>

        {achievements.length > 0 && (
          <View style={styles.achievementSection}>
            <View style={styles.achievementHeading}>
              <Text style={styles.achievementTitle}>إنجازاتك في البث</Text>
              <View style={styles.achievementCaption}><Sparkles size={14} color="#7c3aed" /><Text style={styles.achievementCaptionText}>تُمنح وفق معايير واضحة، لا بعدد النقرات</Text></View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.achievementRow}>
              {achievements.map((item) => (
                <View key={item.key} style={[styles.achievementCard, item.earned ? styles.achievementEarned : styles.achievementLocked]}>
                  <Text style={styles.achievementEmoji}>{item.emoji}</Text>
                  <Text style={styles.achievementCardTitle}>{item.title}</Text>
                  <Text numberOfLines={2} style={styles.achievementDesc}>{item.description}</Text>
                  <Text style={styles.achievementStatus}>{item.earned ? 'أُحرِز' : 'قيد التقدم'} · {item.metric}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.starsCard}>
          <View style={styles.starsHeader}>
            <View style={styles.starsHeading}>
              <Text style={styles.starsTitle}>نجوم البث</Text>
              <Text style={styles.starsCaption}>{leaderboardPeriod === 'weekly' ? 'الأكثر بثًا خلال 7 أيام' : 'الأكثر بثًا خلال 30 يومًا'} · يُقاس بعدد بثوث والدقائق وذروة المشاهدين</Text>
            </View>
            <View style={styles.periodSwitch}>
              <Pressable onPress={() => setLeaderboardPeriod('monthly')} style={[styles.periodTab, leaderboardPeriod === 'monthly' && styles.periodTabActive]}><Text style={[styles.periodTabText, leaderboardPeriod === 'monthly' && styles.periodTabTextActive]}>شهري</Text></Pressable>
              <Pressable onPress={() => setLeaderboardPeriod('weekly')} style={[styles.periodTab, leaderboardPeriod === 'weekly' && styles.periodTabActive]}><Text style={[styles.periodTabText, leaderboardPeriod === 'weekly' && styles.periodTabTextActive]}>أسبوعي</Text></Pressable>
            </View>
          </View>
          {topHosts.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topHostsRow}>
              {topHosts.slice(0, 5).map((host, index) => (
                <View key={host.host_id} style={styles.topHostCard}>
                  <View style={styles.topHostRank}><Text style={styles.topHostRankText}>{index + 1}</Text></View>
                  {host.avatar_url ? <Image source={{ uri: host.avatar_url }} style={styles.topHostAvatar} /> : <View style={styles.topHostAvatarFallback}><Text style={styles.topHostInitial}>{host.display_name.slice(0, 1)}</Text></View>}
                  <View style={styles.topHostNameRow}><Text numberOfLines={1} style={styles.topHostName}>{host.display_name}</Text>{host.is_verified && <BadgeCheck color="#059669" size={14} />}</View>
                  <Text style={styles.topHostStats}>{host.stream_count} بث · {host.total_minutes} دقيقة</Text>
                </View>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.leaderboardEmpty}>لم يُحدد نجم بث بعد. ابدأ بثك الأول لتبدأ الترتيب.</Text>
          )}
        </View>
        {leaderboardError !== '' && <Text style={styles.leaderboardError}>{leaderboardError}</Text>}

        {trending.length > 0 && (
          <View style={styles.trendingSection}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>بثوث رائجة</Text>
              <View style={styles.liveCount}><View style={styles.liveDot} /><Text style={styles.liveCountText}>{trending.length} بث</Text></View>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.trendingRow}>
              {trending.map((stream) => <LiveCard key={`t-${stream.id}`} stream={stream} compact onPress={() => router.push({ pathname: '/live/[id]', params: { id: stream.id } })} />)}
            </ScrollView>
          </View>
        )}

        <View style={styles.filterRow}>
          {([
            ['all', 'لك'], ['following', 'أتابعهم'], ['nearby', 'قريب مني'],
          ] as [Filter, string][]).map(([key, label]) => (
            <Pressable key={key} onPress={() => setFilter(key)} style={[styles.filter, filter === key && styles.filterActive]}>
              <Text style={[styles.filterText, filter === key && styles.filterTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>على الهواء الآن</Text>
          <View style={styles.liveCount}><View style={styles.liveDot} /><Text style={styles.liveCountText}>{filtered.length} بث</Text></View>
        </View>

        {loading ? (
          <View style={styles.state}><ActivityIndicator size="large" color={C.accent} /><Text style={styles.stateText}>جارٍ البحث عن بثوث جيرانك…</Text></View>
        ) : error ? (
          <View style={styles.empty}><Radio color="#dc2626" size={32} /><Text style={styles.emptyTitle}>تعذر تحميل البثوث</Text><Text style={styles.emptyText}>{error}</Text><Pressable onPress={() => { setLoading(true); void load(leaderboardPeriod); }} style={styles.retry}><Text style={styles.retryText}>إعادة المحاولة</Text></Pressable></View>
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <Radio color="#059669" size={34} />
            <Text style={styles.emptyTitle}>{filter === 'following' ? 'لا يوجد بث لمتابَعيك الآن' : filter === 'nearby' ? 'لا يوجد بث قريب الآن' : 'ما فيه بث مباشر الآن'}</Text>
            <Text style={styles.emptyText}>ابدأ بثك الأول وخل جيرانك ينضمون لك.</Text>
            <Pressable onPress={() => router.push('/live/create')} style={styles.emptyCreate}><Text style={styles.emptyCreateText}>ابدأ بثك الأول</Text></Pressable>
          </View>
        ) : (
          <View style={styles.grid}>
            {filtered.map((stream) => <LiveCard key={stream.id} stream={stream} onPress={() => router.push({ pathname: '/live/[id]', params: { id: stream.id } })} />)}
          </View>
        )}
        <View style={styles.privacyHint}><MapPin size={15} color="#64748b" /><Text style={styles.privacyText}>نُظهر المدينة والحي فقط بحسب إعدادات البث، ولا نشارك موقعك الدقيق.</Text></View>
      </ScrollView>
    </View>
  );
}

function LiveCard({ stream, compact = false, onPress }: { stream: LiveStream; compact?: boolean; onPress: () => void }) {
  const profile = stream.profiles;
  const coverUri = profile?.avatar_url || null;
  const width = compact ? 176 : undefined;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`مشاهدة بث ${profile?.display_name || 'مستخدم'}`} onPress={onPress} style={[styles.card, compact && styles.cardCompact, compact && width ? { width } : null]}>
      {coverUri ? (
        <ImageBackground source={{ uri: coverUri }} style={[styles.cardCover, compact && styles.cardCoverCompact]} imageStyle={{ resizeMode: 'cover' }}>
          <View style={styles.cardCoverShade} />
          <View style={styles.cardCoverContent}>
            <View style={styles.cardTop}><View style={styles.onAir}><View style={styles.liveDot} /><Text style={styles.onAirText}>مباشر</Text></View><Text style={styles.category}>{stream.category}</Text></View>
            <View style={styles.cardCenter}><View style={styles.avatarRing}>{profile?.avatar_url ? <Image source={{ uri: profile.avatar_url }} style={styles.avatar} /> : <Text style={styles.avatarLetter}>{profile?.display_name?.slice(0, 1) || 'ح'}</Text>}</View><Text style={styles.streamTitle} numberOfLines={2}>{stream.title}</Text></View>
            <View style={styles.cardBottom}><View style={styles.viewers}><Users size={13} color="#fff" /><Text style={styles.viewerText}>{stream.viewer_count || 0}</Text></View><View style={styles.joinText}><Text style={styles.joinLabel}>انضم للبث</Text><ChevronLeft size={14} color="#fff" /></View></View>
          </View>
        </ImageBackground>
      ) : (
        <LinearGradient colors={['#052e26', '#065f46', '#047857']} style={[styles.cardCover, compact && styles.cardCoverCompact]}>
          <View style={styles.cardTop}><View style={styles.onAir}><View style={styles.liveDot} /><Text style={styles.onAirText}>مباشر</Text></View><Text style={styles.category}>{stream.category}</Text></View>
          <View style={styles.cardCenter}><View style={styles.avatarRing}>{profile?.avatar_url ? <Image source={{ uri: profile.avatar_url }} style={styles.avatar} /> : <Text style={styles.avatarLetter}>{profile?.display_name?.slice(0, 1) || 'ح'}</Text>}</View><Text style={styles.streamTitle} numberOfLines={2}>{stream.title}</Text></View>
          <View style={styles.cardBottom}><View style={styles.viewers}><Users size={13} color="#fff" /><Text style={styles.viewerText}>{stream.viewer_count || 0}</Text></View><View style={styles.joinText}><Text style={styles.joinLabel}>انضم للبث</Text><ChevronLeft size={14} color="#fff" /></View></View>
        </LinearGradient>
      )}
      <View style={styles.hostRow}>
        <View style={{ flex: 1, alignItems: 'flex-end' }}><Text numberOfLines={1} style={styles.hostName}>{profile?.display_name || profile?.username || 'جارٍ'}</Text><Text numberOfLines={1} style={styles.hostArea}>{profile?.district ? `حي ${profile.district}` : profile?.city || 'من حيّنا'}</Text></View>
        {profile?.avatar_url ? <Image source={{ uri: profile.avatar_url }} style={styles.smallAvatar} /> : <View style={styles.smallAvatarFallback}><Text style={styles.smallAvatarLetter}>ح</Text></View>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f0fdf4' }, content: { padding: 16, paddingTop: 8 },
  createCard: { borderRadius: 24, overflow: 'hidden', marginBottom: 18, elevation: 6, shadowColor: '#059669', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } }, createGradient: { minHeight: 104, padding: 16, flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }, createIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }, createTitle: { color: '#fff', fontSize: 18, fontWeight: '900' }, createSubtitle: { color: '#d1fae5', fontSize: 12, marginTop: 4, textAlign: 'right' },
  achievementSection: { marginBottom: 20, padding: 14, borderRadius: 22, backgroundColor: '#f3f0ff', borderWidth: 1, borderColor: '#ddd6fe' }, achievementHeading: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }, achievementTitle: { color: '#4c1d95', fontSize: 15, fontWeight: '900' }, achievementCaption: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }, achievementCaptionText: { color: '#6d28d9', fontSize: 10, fontWeight: '700' }, achievementRow: { flexDirection: 'row-reverse', gap: 9 }, achievementCard: { width: 164, minHeight: 118, padding: 12, borderRadius: 18, borderWidth: 1 }, achievementEarned: { backgroundColor: '#fff', borderColor: '#c4b5fd' }, achievementLocked: { backgroundColor: 'rgba(255,255,255,0.55)', borderColor: '#e9d5ff', opacity: 0.86 }, achievementEmoji: { fontSize: 22 }, achievementCardTitle: { color: '#4c1d95', fontSize: 12, fontWeight: '900', marginTop: 6 }, achievementDesc: { color: '#6b21a8', fontSize: 10, marginTop: 4, lineHeight: 15, textAlign: 'right' }, achievementStatus: { color: '#7c3aed', fontSize: 9, fontWeight: '800', marginTop: 6 },
  starsCard: { marginBottom: 20, padding: 14, borderRadius: 22, backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a' }, starsHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8 }, starsHeading: { flex: 1, alignItems: 'flex-end' }, starsTitle: { color: '#78350f', fontSize: 15, fontWeight: '900' }, starsCaption: { color: '#92400e', fontSize: 10, fontWeight: '700', marginTop: 3, textAlign: 'right', lineHeight: 16 }, periodSwitch: { flexDirection: 'row', borderRadius: 30, overflow: 'hidden', borderWidth: 1, borderColor: '#fde68a', backgroundColor: '#fff' }, periodTab: { paddingHorizontal: 12, paddingVertical: 7 }, periodTabActive: { backgroundColor: '#b45309' }, periodTabText: { color: '#92400e', fontSize: 11, fontWeight: '800' }, periodTabTextActive: { color: '#fff' }, topHostsRow: { flexDirection: 'row-reverse', gap: 9 }, topHostCard: { width: 132, minHeight: 130, alignItems: 'center', justifyContent: 'center', padding: 10, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: '#fef3c7' }, topHostRank: { position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fef3c7' }, topHostRankText: { color: '#92400e', fontSize: 11, fontWeight: '900' }, topHostAvatar: { width: 48, height: 48, borderRadius: 24, marginBottom: 7 }, topHostAvatarFallback: { width: 48, height: 48, borderRadius: 24, marginBottom: 7, backgroundColor: '#d1fae5', alignItems: 'center', justifyContent: 'center' }, topHostInitial: { color: '#047857', fontSize: 18, fontWeight: '900' }, topHostNameRow: { maxWidth: '100%', flexDirection: 'row-reverse', alignItems: 'center', gap: 3 }, topHostName: { color: '#0f172a', fontSize: 12, fontWeight: '900', maxWidth: 90 }, topHostStats: { color: '#78716c', fontSize: 10, marginTop: 5 },
  leaderboardEmpty: { color: '#92400e', fontSize: 11, textAlign: 'center', paddingVertical: 10 },
  leaderboardError: { color: '#9a3412', fontSize: 11, textAlign: 'right', marginTop: -12, marginBottom: 16 },
  trendingSection: { marginBottom: 16 }, trendingRow: { flexDirection: 'row-reverse', gap: 10, paddingBottom: 6 },
  filterRow: { flexDirection: 'row-reverse', gap: 8, marginBottom: 20 }, filter: { paddingHorizontal: 17, paddingVertical: 9, borderRadius: 30, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#0f172a', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } }, filterActive: { backgroundColor: '#065f46', borderColor: '#065f46' }, filterText: { fontSize: 13, color: '#64748b', fontWeight: '700' }, filterTextActive: { color: '#fff' },
  sectionRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }, sectionTitle: { color: '#0f172a', fontSize: 19, fontWeight: '900', textAlign: 'right' }, liveCount: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, backgroundColor: '#ecfdf5', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }, liveCountText: { color: '#047857', fontSize: 12, fontWeight: '700' }, liveDot: { width: 7, height: 7, borderRadius: 5, backgroundColor: '#fb3a4b' },
  grid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 12 }, card: { width: '48%', flexGrow: 1, maxWidth: '49%', backgroundColor: '#fff', borderRadius: 22, overflow: 'hidden', marginBottom: 4, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#0f172a', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 3 }, cardCompact: { width: 176, minWidth: 170, maxWidth: 180 }, cardCover: { minHeight: 190, padding: 12, justifyContent: 'space-between', position: 'relative' }, cardCoverCompact: { minHeight: 178 }, cardCoverShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(2,6,23,0.48)' }, cardCoverContent: { flex: 1, justifyContent: 'space-between' }, cardTop: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }, onAir: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, backgroundColor: '#dc2626', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 }, onAirText: { color: '#fff', fontSize: 10, fontWeight: '900' }, category: { color: '#d1fae5', fontSize: 11, fontWeight: '700' }, cardCenter: { alignItems: 'center', gap: 8 }, avatarRing: { width: 70, height: 70, borderRadius: 36, borderWidth: 2, borderColor: '#34d399', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#047857' }, avatar: { width: '100%', height: '100%' }, avatarLetter: { color: '#fff', fontWeight: '900', fontSize: 25 }, streamTitle: { color: '#fff', textAlign: 'center', fontWeight: '900', fontSize: 14, minHeight: 36 }, cardBottom: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }, viewers: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.3)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }, viewerText: { color: '#fff', fontSize: 11, fontWeight: '800' }, joinText: { flexDirection: 'row-reverse', alignItems: 'center', gap: 1 }, joinLabel: { color: '#d1fae5', fontSize: 11, fontWeight: '800' },
  hostRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, padding: 10 }, hostName: { color: '#0f172a', fontSize: 12, fontWeight: '800' }, hostArea: { color: '#64748b', fontSize: 10, marginTop: 2, textAlign: 'right' }, smallAvatar: { width: 30, height: 30, borderRadius: 15 }, smallAvatarFallback: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#d1fae5', alignItems: 'center', justifyContent: 'center' }, smallAvatarLetter: { color: '#047857', fontWeight: '900' },
  state: { paddingVertical: 50, alignItems: 'center', gap: 12 }, stateText: { color: '#64748b', fontSize: 13 }, empty: { backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', padding: 28, alignItems: 'center', gap: 9, shadowColor: '#0f172a', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }, emptyTitle: { color: '#0f172a', fontSize: 16, fontWeight: '900', textAlign: 'center' }, emptyText: { color: '#64748b', fontSize: 13, textAlign: 'center', lineHeight: 21 }, retry: { paddingVertical: 9, paddingHorizontal: 18, backgroundColor: '#ecfdf5', borderRadius: 15, marginTop: 5 }, retryText: { color: '#047857', fontWeight: '800' }, emptyCreate: { marginTop: 6, backgroundColor: '#059669', borderRadius: 14, paddingHorizontal: 18, paddingVertical: 10 }, emptyCreateText: { color: '#fff', fontWeight: '900' },
  privacyHint: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 7, padding: 12, marginTop: 16, backgroundColor: '#f1f5f9', borderRadius: 14 }, privacyText: { flex: 1, color: '#64748b', fontSize: 11, textAlign: 'right', lineHeight: 17 },
});
