import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  ImageBackground,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Animated,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { AppHeader } from '@/components/shared/AppHeader';
import { useBottomNavInset } from '@/lib/bottomNav';
import { Plus, ShieldCheck, Sparkles, ChevronDown, UserPlus, Check } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getActiveLocation, isAllKingdom } from '@/lib/locationSync';
import { isActiveStory, storyDiscoveryMembership } from '@/lib/storyActivity';
import { relativeTime } from '@/lib/mapPins';

export default function StoriesScreen() {
  const bottomNavInset = useBottomNavInset();
  const [viewerId, setViewerId] = useState('');
  const [errorText, setErrorText] = useState('');
  const [needsLogin, setNeedsLogin] = useState(false);
  const [stories, setStories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [seenStoryIds, setSeenStoryIds] = useState<string[]>([]);
  const [currentCity, setCurrentCity] = useState<string>('');
  const [currentDistrict, setCurrentDistrict] = useState<string>('');
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [followerCounts, setFollowerCounts] = useState<Record<string, number>>({});
  const [visibleTrendingCount, setVisibleTrendingCount] = useState(8);
  const storyRingPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(storyRingPulse, { toValue: 1.06, duration: 850, useNativeDriver: true }),
      Animated.timing(storyRingPulse, { toValue: 1, duration: 850, useNativeDriver: true }),
    ]));
    pulse.start();
    return () => pulse.stop();
  }, [storyRingPulse]);

  useFocusEffect(useCallback(() => { void loadAllStories(); }, []));

  async function loadAllStories() {
    try {
      setLoading(true); setErrorText('');
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const nowIso = new Date().toISOString();

      const { data: authResult, error: authError } = await supabase.auth.getUser();
      const activeViewerId = authResult.user?.id || '';
      if (authError) throw authError;
      setViewerId(activeViewerId); setNeedsLogin(!activeViewerId);
      if (!activeViewerId) { setStories([]); return; }
      let city = '';
      let district = '';
      let followedIds: string[] = [];
      if (activeViewerId) {
        const [{ data: me, error: meError }, { data: follows, error: followsError }] = await Promise.all([
          supabase.from('profiles').select('city,district').eq('id', activeViewerId).maybeSingle(),
          supabase.from('follows').select('following_id').eq('follower_id', activeViewerId),
        ]);
        if (meError) throw meError;
        if (followsError) throw followsError;
        const location = await getActiveLocation();
        city = String(me?.city || (!isAllKingdom(location.city) ? location.city : '')).trim();
        district = String(me?.district || (location.city === city ? location.district : '')).trim();
        followedIds = (follows || []).map((row: any) => String(row.following_id));
      }
      setCurrentCity(city);
      setCurrentDistrict(district);
      setFollowingIds(followedIds);
      let mutedAuthorIds: string[] = [];
      if (activeViewerId) {
        const { data: authorPrefs, error: prefsError } = await supabase.from('story_author_preferences').select('author_id').eq('user_id', activeViewerId).eq('muted', true);
        if (prefsError) throw prefsError;
        mutedAuthorIds = (authorPrefs || []).map((row: any) => String(row.author_id));
      }

      const { data, error } = await supabase
        .from('stories')
        .select(`
          id,
          author_id,
          type,
          content,
          image_url,
          bg_color,
          created_at,
          expires_at,
          view_count,
          profiles:profiles!stories_author_id_fkey (
            id,
            display_name,
            username,
            avatar_url,
            is_verified,
            is_geoverified,
            city,
            district,
            hide_name,
            account_type,
            role
          )
        `)
        .or(`expires_at.gt.${nowIso},and(expires_at.is.null,created_at.gte.${yesterday})`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const cityRows = (data || []) as any[];
      const valid = cityRows.filter((story: any) => isActiveStory(story) && !mutedAuthorIds.includes(String(story.author_id)));
      setStories(valid);
      const storyIds = valid.map((row: any) => row.id);
      const authorIds = [...new Set(valid.map((row: any) => String(row.author_id)))];
      const [likesResult, followersResult] = await Promise.all([
        storyIds.length ? supabase.from('story_likes').select('story_id').in('story_id', storyIds) : Promise.resolve({ data: [], error: null }),
        authorIds.length ? supabase.from('follows').select('following_id').in('following_id', authorIds) : Promise.resolve({ data: [], error: null }),
      ]);
      const likes: Record<string, number> = {};
      for (const row of likesResult.data || []) likes[row.story_id] = (likes[row.story_id] || 0) + 1;
      setLikeCounts(likes);
      const followers: Record<string, number> = {};
      for (const row of followersResult.data || []) followers[row.following_id] = (followers[row.following_id] || 0) + 1;
      setFollowerCounts(followers);
      if (activeViewerId && valid.length > 0) {
        const { data: views, error: viewsError } = await supabase
          .from('story_views')
          .select('story_id')
          .eq('viewer_id', activeViewerId)
          .in('story_id', valid.map((story) => story.id));
        if (!viewsError) setSeenStoryIds([...new Set((views || []).map((view: { story_id: string }) => view.story_id))]);
        else setSeenStoryIds([]);
      } else {
        setSeenStoryIds([]);
      }

    } catch (e) {
      setStories([]);
      setErrorText(e instanceof Error ? e.message : 'تعذر تحميل اليوميات');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const filtered = stories;

  const groupedAuthors = Object.values(filtered.reduce((groups: Record<string, any>, story: any) => {
    const key = story.author_id;
    if (!groups[key]) groups[key] = { authorId: key, author: story.profiles, stories: [], totalViews: 0, totalLikes: 0, newestAt: story.created_at };
    groups[key].stories.push(story);
    groups[key].totalViews += Math.max(0, Number(story.view_count) || 0);
    groups[key].totalLikes += likeCounts[story.id] || 0;
    if (new Date(story.created_at).getTime() > new Date(groups[key].newestAt).getTime()) groups[key].newestAt = story.created_at;
    return groups;
  }, {})).map((group: any) => {
    const ordered = group.stories.slice().sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return { ...group, stories: ordered, latestStory: ordered[ordered.length - 1], hasUnseen: ordered.some((story: any) => !seenStoryIds.includes(story.id)) };
  });

  const membership = (group: any) => storyDiscoveryMembership(group.author, group.authorId, viewerId, followingIds, currentCity, currentDistrict);
  const neighborhoodAndFollowing = groupedAuthors.filter((group: any) => membership(group).ring);
  const storyRings = neighborhoodAndFollowing.slice().sort((a: any, b: any) => {
    const aFollowed = followingIds.includes(String(a.authorId));
    const bFollowed = followingIds.includes(String(b.authorId));
    const aSameDistrict = membership(a).ring && !aFollowed;
    const bSameDistrict = membership(b).ring && !bFollowed;
    return Number(bFollowed) - Number(aFollowed) || Number(bSameDistrict) - Number(aSameDistrict) || Number(b.hasUnseen) - Number(a.hasUnseen) || new Date(b.newestAt).getTime() - new Date(a.newestAt).getTime();
  });
  const trendingScore = (group: any) => {
    const ageHours = Math.max(0, (Date.now() - new Date(group.newestAt).getTime()) / 3600000);
    const engagement = group.totalViews + group.totalLikes * 4 + (followerCounts[group.authorId] || 0) * 0.15;
    return (engagement + (group.hasUnseen ? 2 : 0)) / Math.pow(1 + ageHours / 8, 1.35);
  };
  const trendingAuthors = groupedAuthors.filter((group: any) => membership(group).trending).slice().sort((a: any, b: any) =>
    trendingScore(b) - trendingScore(a) || new Date(b.newestAt).getTime() - new Date(a.newestAt).getTime()
  );
  const ringColor = (author: any) => author?.account_type === 'freelance' ? '#8B5CF6' : ['business', 'merchant'].includes(author?.account_type) ? '#F59E0B' : author?.role === 'admin' ? '#065F46' : '#10B981';
  const displayName = (author: any) => author?.hide_name ? 'مجهول' : (author?.display_name?.trim() || 'جار الحي');
  async function toggleFollow(authorId: string) {
    if (!viewerId || authorId === viewerId) return;
    const following = followingIds.includes(authorId);
    const result = following
      ? await supabase.from('follows').delete().eq('follower_id', viewerId).eq('following_id', authorId)
      : await supabase.from('follows').insert({ follower_id: viewerId, following_id: authorId });
    if (!result.error) setFollowingIds(prev => following ? prev.filter(id => id !== authorId) : [...prev, authorId]);
  }

  function openAuthorStories(authorStories: any[], collection: any[] = storyRings) {
    const firstUnseen = authorStories.find((story: any) => !seenStoryIds.includes(story.id));
    const target = firstUnseen || authorStories[0];
    if (target?.id) {
      const pos = collection.findIndex((group: any) => group.authorId === target.author_id);
      const queue = [...collection.slice(pos + 1), ...collection.slice(0, Math.max(0, pos))]
        .filter((group: any) => group.authorId !== target.author_id)
        .map((group: any) => (group.stories.find((story: any) => !seenStoryIds.includes(story.id)) || group.stories[0])?.id)
        .filter(Boolean);
      router.push({ pathname: '/story', params: { id: target.id, resume: '1', next: queue.join(',') } });
    }
  }

  return (
    <View style={styles.container}>
      
      <AppHeader
        variant="sub"
        title="اليوميات"
        fallbackRoute="/home"
        rightAction={
          <Pressable
            onPress={() => router.push('/create-story')}
            style={styles.addStoryBtn}
            accessibilityRole="button"
            accessibilityLabel="نشر قصة جديدة"
          >
            <Plus size={15} color="#fff" strokeWidth={2.5} />
          </Pressable>
        }
      />

      <View style={styles.ringsSection}>
        <Image source={{ uri: Platform.OS === 'web' ? '/welcome/hayna-stories-background.png' : 'https://appksatest.vercel.app/welcome/hayna-stories-background.png' }} resizeMode="cover" pointerEvents="none" style={[StyleSheet.absoluteFillObject, { width: '100%', height: '100%', opacity: 0.55 }]} />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ringsScroll}>
            <Pressable style={styles.ringItem} accessibilityRole="button" accessibilityLabel="أضف يومياتك" onPress={() => router.push(needsLogin ? '/auth' : '/create-story')}><View style={[styles.ringOuter, styles.ringSeen]}><Plus size={27} color="#059669" /></View><Text style={styles.ringName}>أضف يومياتك</Text></Pressable>
            {storyRings.map((group: any) => {
              const author = group.author;
              const name = displayName(author);
              return (
                <Pressable key={group.authorId} style={styles.ringItem}
                  onPress={() => openAuthorStories(group.stories, storyRings)}
                  accessibilityRole="button" accessibilityLabel={`عرض يوميات ${name}`}>
                  <Animated.View style={[styles.ringOuter, group.hasUnseen ? { borderColor: ringColor(author), borderWidth: 3.5 } : styles.ringSeen, group.stories.length > 1 && { transform: [{ scale: storyRingPulse }] }]}>
                    <View style={styles.ringInner}>
                      {!author?.hide_name && author?.avatar_url ? <Image source={{ uri: author.avatar_url }} style={styles.ringAvatar} /> :
                        <View style={styles.ringAvatarFallback}><Text style={styles.ringInitial}>{author?.hide_name ? '؟' : name[0]}</Text></View>}
                    </View>
                    <View style={styles.ringCount}><Text style={styles.ringCountText}>{group.stories.length}</Text></View>
                  </Animated.View>
                  <Text style={styles.ringName} numberOfLines={1}>{name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {!loading && !errorText && !storyRings.length ? <Text style={[styles.sectionSubheading, { paddingHorizontal: 16, textAlign: 'right', marginTop: 10 }]}>{needsLogin ? 'سجل الدخول لمشاهدة اليوميات' : 'لا توجد يوميات نشطة لأهل حيّك أو من تتابعهم الآن'}</Text> : null}
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomNavInset + 30 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadAllStories();
            }}
            tintColor="#059669"
            colors={['#059669']}
          />
        }
      >
        <View style={styles.trendingSectionTitleRow}><View style={styles.trendingSectionAccent} /><View style={{ flex: 1, alignItems: 'flex-end' }}><Text style={styles.sectionHeading}>ترند المدينة</Text></View></View>
        {errorText ? <Pressable accessibilityRole="button" onPress={() => void loadAllStories()} style={{ padding: 16 }}><Text style={{ color: '#A65A49', textAlign: 'right' }}>تعذر تحميل اليوميات. اضغط لإعادة المحاولة.</Text></Pressable> : null}
        {loading && !refreshing ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#059669" />
            <Text style={styles.loadingText}>جارٍ جلب يوميات جيرانك...</Text>
          </View>
        ) : errorText ? null : trendingAuthors.length === 0 ? (
          <View style={styles.emptyBox}>
            <View style={styles.emptyIconCircle}>
              <Sparkles size={36} color="#059669" />
            </View>
            <Text style={styles.emptyTitle}>{needsLogin ? 'سجل الدخول لمشاهدة اليوميات' : !currentCity ? 'حدد مدينتك أولاً' : 'لا توجد يوميات نشطة في مدينتك حالياً'}</Text>
            <Text style={styles.emptySub}>
              كن أول من يشارك أهل حيه يومياته وتحديثاته اليوم! تظل اليوميات ظاهرة لمدة 24 ساعة.
            </Text>
            <Pressable
              style={styles.emptyActionBtn}
              onPress={() => router.push(needsLogin ? '/auth' : !currentCity ? '/profile' : '/create-story')}
            >
              <Plus size={16} color="#fff" strokeWidth={2.5} />
              <Text style={styles.emptyActionBtnText}>{needsLogin ? 'تسجيل الدخول' : !currentCity ? 'تحديث ملفي' : 'شارك يومياتك'}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.storiesGrid}>
              {trendingAuthors.slice(0, visibleTrendingCount).map((group: any) => {
                const story = group.latestStory;
                const author = group.author;
                const name = displayName(author);
                const verified = author?.is_verified || author?.is_geoverified;
                const bg = story.bg_color || '#059669';
                const hasMedia = story.type === 'image' && Boolean(story.image_url);
                const allSeen = !group.hasUnseen;
                return (
                  <Pressable key={group.authorId}
                    style={[styles.storyCard, { borderWidth: allSeen ? 1 : 2.5, borderColor: allSeen ? '#94A3B8' : ringColor(author) }]}
                    onPress={() => openAuthorStories(group.stories, trendingAuthors)}
                    accessibilityRole="button" accessibilityLabel={"فتح يوميات " + name}>
                    <View style={[styles.storyCardMedia, { backgroundColor: bg }, allSeen && styles.storyCardMediaSeen]}>
                      {hasMedia ? <Image source={{ uri: story.image_url }} style={styles.storyCardImage} resizeMode="cover" /> :
                        <View style={styles.storyTextCard}>
                          <Text style={styles.storyTextQuote}>“</Text>
                          <Text style={styles.storyTextSnippet} numberOfLines={4}>{story.content || 'يوميات جديدة'}</Text>
                        </View>}
                      <LinearGradient colors={['rgba(0,0,0,0.55)', 'transparent', 'rgba(0,0,0,0.82)']} style={StyleSheet.absoluteFillObject} />
                      <View style={styles.storyCardTopRow}>
                        <View style={styles.cardAvatarWrap}>
                          {!author?.hide_name && author?.avatar_url ? <Image source={{ uri: author.avatar_url }} style={styles.cardAvatar} /> :
                            <View style={styles.cardAvatarFallback}><Text style={styles.cardAvatarLetter}>{author?.hide_name ? '؟' : name[0]}</Text></View>}
                          {verified && <View style={styles.cardVerifyBadge}><ShieldCheck size={9} color="#fff" /></View>}
                        </View>
                        <View style={{ flex: 1, alignItems: 'flex-end' }}>
                          <Text style={styles.cardAuthorName} numberOfLines={1}>{name}</Text>
                          <Text style={styles.cardTimeText}>{relativeTime(story.created_at)}</Text>
                          {group.authorId !== viewerId && <Pressable accessibilityRole="button" accessibilityLabel={followingIds.includes(group.authorId) ? 'إلغاء المتابعة' : 'متابعة'} onPress={(event) => { event.stopPropagation(); void toggleFollow(group.authorId); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 }}>
                            {followingIds.includes(group.authorId) ? <Check size={13} color="#D1FAE5" /> : <UserPlus size={13} color="#D1FAE5" />}
                            <Text style={{ color: '#D1FAE5', fontSize: 11, fontWeight: '800' }}>{followingIds.includes(group.authorId) ? 'تتابعه' : 'متابعة'}</Text>
                          </Pressable>}
                          <Text style={[styles.storySeenLabel, allSeen ? styles.storySeenLabelSeen : styles.storySeenLabelNew]}>
                            {allSeen ? 'تمت المشاهدة' : 'يوميات جديدة'}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
            {trendingAuthors.length > visibleTrendingCount && (
              <Pressable style={styles.loadMoreButton} onPress={() => setVisibleTrendingCount((count) => count + 8)} accessibilityRole="button" accessibilityLabel="عرض المزيد من ترند المدينة">
                <Text style={styles.loadMoreButtonText}>عرض المزيد</Text>
                <ChevronDown size={16} color="#047857" />
              </Pressable>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  homeStoriesSection: { marginHorizontal: 12, marginTop: 14, marginBottom: 18, borderRadius: 20, overflow: 'hidden', backgroundColor: '#eaf5ed' },
  homeStoriesBackground: { minHeight: 142, paddingTop: 15, paddingBottom: 14 },
  homeStoriesHeading: { color: '#064e3b', textAlign: 'right', fontSize: 14, fontWeight: '900', marginHorizontal: 16, marginBottom: 12 },
  homeStoriesScroll: { flexDirection: 'row-reverse', alignItems: 'center', gap: 14, paddingHorizontal: 15 },
  homeStoryItem: { width: 72, alignItems: 'center', gap: 6 },
  homeStoryRing: { width: 62, height: 62, borderRadius: 31, borderWidth: 3, padding: 3, backgroundColor: 'rgba(255,255,255,0.85)' },
  homeStoryInner: { flex: 1, borderRadius: 28, overflow: 'hidden' },
  homeStoryImage: { width: '100%', height: '100%' },
  homeStoryFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#d1fae5' },
  homeStoryInitial: { color: '#047857', fontSize: 24, fontWeight: '900' },
  homeStoryName: { color: '#064e3b', fontSize: 11, fontWeight: '800', textAlign: 'center', maxWidth: 72 },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  addStoryBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#059669',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  addStoryBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  scroll: {
    padding: 16,
  },
  loadingBox: {
    paddingVertical: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '700',
  },
  emptyBox: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 20,
    gap: 12,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0f172a',
  },
  emptySub: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyActionBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 14,
    marginTop: 6,
  },
  emptyActionBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
  storyNotificationToggle: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 8, marginBottom: 4, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 13, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  storyNotificationToggleText: { flex: 1, textAlign: 'right', color: '#334155', fontSize: 11, fontWeight: '800' },
  storyNotificationToggleAction: { color: '#047857', fontSize: 11, fontWeight: '900' },
  ringsSection: { position: 'relative', overflow: 'hidden', backgroundColor: '#f0f8f1', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingTop: 14, paddingBottom: 12 },
  sectionHeadingRow: { flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 16, gap: 10, marginBottom: 10 },
  sectionHeading: { color: '#0f172a', fontSize: 16, fontWeight: '900' },
  sectionSubheading: { color: '#64748b', fontSize: 11, marginTop: 2, fontWeight: '600' },
  livePill: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 12, backgroundColor: '#ecfdf5' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },
  livePillText: { color: '#047857', fontSize: 10, fontWeight: '900' },
  ringsScroll: { flexDirection: 'row-reverse', paddingHorizontal: 14, gap: 14 },
  ringItem: { width: 66, alignItems: 'center', gap: 5 },
  ringOuter: { width: 62, height: 62, borderRadius: 31, padding: 3, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  ringUnseen: { borderColor: '#D4A72C', borderWidth: 3.5, shadowColor: '#D4A72C', shadowOpacity: 0.38, shadowRadius: 5, elevation: 5 },
  ringSeen: { borderColor: '#94a3b8', borderWidth: 2 },
  ringInner: { width: 50, height: 50, borderRadius: 25, overflow: 'hidden', backgroundColor: '#f1f5f9' },
  ringAvatar: { width: '100%', height: '100%' },
  ringAvatarFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#d1fae5' },
  ringInitial: { color: '#047857', fontSize: 20, fontWeight: '900' },
  ringCount: { position: 'absolute', bottom: -3, right: -2, minWidth: 19, height: 19, borderRadius: 10, backgroundColor: '#D4A72C', borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  ringCountText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  ringName: { color: '#334155', fontSize: 10, fontWeight: '800', maxWidth: 66 },
  trendingSectionTitleRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 9, marginBottom: 13 },
  trendingSectionAccent: { width: 4, height: 30, borderRadius: 3, backgroundColor: '#10B981' },
  trendingBadge: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 10, backgroundColor: '#0f172a' },
  trendingBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  storiesGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  storyCard: {
    width: '48%',
    aspectRatio: 0.78,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#059669',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  storyCardNew: { borderColor: '#10b981' },
  storyCardSeen: { borderColor: '#94a3b8', opacity: 0.72 },
  storyCardMediaSeen: { opacity: 0.82 },
  storySeenLabel: { fontSize: 9, fontWeight: '900', marginTop: 3, textAlign: 'right' },
  storySeenLabelNew: { color: '#a7f3d0' },
  storySeenLabelSeen: { color: '#e2e8f0' },
  loadMoreButton: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 7, alignSelf: 'center', marginTop: 18, marginBottom: 8, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 14, backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0' },
  loadMoreButtonText: { color: '#047857', fontSize: 12, fontWeight: '900' },
  storyCardMedia: {
    flex: 1,
    position: 'relative',
    justifyContent: 'space-between',
    padding: 10,
  },
  storyCardImage: {
    ...StyleSheet.absoluteFillObject,
  },
  storyTextCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  storyTextSnippet: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    lineHeight: 20,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowRadius: 4,
  },
  storyCardTopRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    zIndex: 2,
  },
  cardAvatarWrap: {
    position: 'relative',
  },
  cardAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  cardAvatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  cardAvatarLetter: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
  cardVerifyBadge: {
    position: 'absolute',
    bottom: -2,
    left: -2,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fff',
  },
  cardAuthorName: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 4,
  },
  cardTimeText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 9.5,
    fontWeight: '700',
    marginTop: 1,
  },
  storyCardBottomRow: {
    zIndex: 2,
    alignItems: 'flex-start',
  },
  districtBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    maxWidth: '100%',
  },
  districtBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  storyTextQuote: {
    fontSize: 28,
    lineHeight: 28,
    color: 'rgba(255,255,255,0.4)',
    fontWeight: '900',
    marginBottom: -4,
  },
  mediaTypeBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
