import { OasisPressable as Pressable } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Image, ActivityIndicator, RefreshControl, Platform, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { AppHeader } from '@/components/shared/AppHeader';
import { useBottomNavInset } from '@/lib/bottomNav';
import { Plus, ShieldCheck, UserPlus, Check, Eye, Radio, Sparkles } from 'lucide-react-native';
import { getActiveLocation, isAllKingdom } from '@/lib/locationSync';
import { isActiveStory, storyDiscoveryMembership } from '@/lib/storyActivity';
import { getCachedSeenStoryIds, getLocalSeenStoryIds, rememberSeenStories } from '@/lib/storySeen';
import { prioritizeUnseenStoryGroups, unseenStories } from '@/lib/storyActivity';
import { relativeTime } from '@/lib/mapPins';
import { useTheme } from '@/context/ThemeContext';

export default function StoriesScreen() {
  const { colors } = useTheme();
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
  const [storyFilter, setStoryFilter] = useState<'all' | 'unseen' | 'following'>('all');
  const [gridWidth, setGridWidth] = useState(0);
  const columns = gridWidth >= 640 ? 3 : 2;
  // Reserve one pixel for onLayout rounding on fractional browser viewports.
  const cardWidth = gridWidth ? Math.floor((gridWidth - 10 * (columns - 1) - 1) / columns) : undefined;
  const mediaHeight = cardWidth ? Math.min(166, Math.round(cardWidth * .93)) : 142;

  const loadInFlight = useRef(false);
  const lastRefreshAt = useRef(0);
  const viewerRef = useRef(viewerId);
  viewerRef.current = viewerId;
  const discoveryScroll = useRef<ScrollView>(null);
  const loadMoreRef = useRef(() => {});
  useFocusEffect(useCallback(() => {
    if (viewerRef.current) setSeenStoryIds(getCachedSeenStoryIds(viewerRef.current));
    void loadAllStories(true);
  }, []));

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = discoveryScroll.current?.getScrollableNode?.() as HTMLElement | undefined;
    if (!node?.addEventListener) return;
    const onWheel = (event: WheelEvent) => {
      if (event.deltaY > 0 && node.scrollTop + node.clientHeight >= node.scrollHeight - 240) loadMoreRef.current();
      if (event.deltaY < -40 && node.scrollTop <= 0 && Date.now() - lastRefreshAt.current > 3000) void loadAllStories(true);
    };
    node.addEventListener('wheel', onWheel, { passive: true });
    return () => node.removeEventListener('wheel', onWheel);
  }, []);

  async function loadAllStories(quiet = false) {
    if (loadInFlight.current) return;
    loadInFlight.current = true;
    lastRefreshAt.current = Date.now();
    try {
      if (!quiet) setLoading(true);
      setErrorText('');
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const nowIso = new Date().toISOString();

      const { data: authResult, error: authError } = await supabase.auth.getUser();
      const activeViewerId = authResult.user?.id || '';
      if (authError) throw authError;
      setViewerId(activeViewerId); setNeedsLogin(!activeViewerId);
      if (!activeViewerId) { setStories([]); return; }
      const localSeen = await getLocalSeenStoryIds(activeViewerId);
      setSeenStoryIds(localSeen);
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
        if (!viewsError) {
          const ids = [...new Set([...await getLocalSeenStoryIds(activeViewerId), ...(views || []).map((view: { story_id: string }) => view.story_id)])];
          rememberSeenStories(activeViewerId, ids);
          setSeenStoryIds(ids);
        }
      } else {
        setSeenStoryIds([]);
      }

    } catch (e) {
      if (!quiet) setStories([]);
      setErrorText(e instanceof Error ? e.message : 'تعذر تحميل اليوميات');
    } finally {
      loadInFlight.current = false;
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
    const unseen = unseenStories(ordered, seenStoryIds);
    return { ...group, stories: ordered, latestStory: unseen[unseen.length - 1] || ordered[ordered.length - 1], hasUnseen: unseen.length > 0 };
  });

  const membership = (group: any) => storyDiscoveryMembership(group.author, group.authorId, viewerId, followingIds, currentCity, currentDistrict);
  const neighborhoodAndFollowing = groupedAuthors.filter((group: any) => membership(group).ring);
  const storyRings = prioritizeUnseenStoryGroups(neighborhoodAndFollowing, (a: any, b: any) => {
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
  // عرض الجميع في الترند: الجديد (غير المشاهَد) في الأعلى بإطار أخضر، المشاهَد في الأسفل بإطار رمادي
  const trendingAuthors = groupedAuthors.filter((group: any) => membership(group).trending).slice().sort((a: any, b: any) => {
    // الجديد أولاً، ثم حسب نقاط الترند
    const aUnseen = a.hasUnseen ? 1 : 0;
    const bUnseen = b.hasUnseen ? 1 : 0;
    return bUnseen - aUnseen || trendingScore(b) - trendingScore(a) || new Date(b.newestAt).getTime() - new Date(a.newestAt).getTime();
  });
  // ألوان الإطار: أخضر للجديد، رمادي للمشاهَد
  const trendBorderColor = (hasUnseen: boolean) => hasUnseen ? '#74C99B' : colors.line;
  const ringColor = (hasUnseen: boolean) => hasUnseen ? colors.primary : colors.line;
  const unseenCount = trendingAuthors.filter((g: any) => g.hasUnseen).length;
  const followedCount = trendingAuthors.filter((g: any) => followingIds.includes(String(g.authorId))).length;
  const visibleAuthors = trendingAuthors.filter((g: any) =>
    storyFilter === 'all' || (storyFilter === 'unseen' && g.hasUnseen) ||
    (storyFilter === 'following' && followingIds.includes(String(g.authorId)))
  );
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
        .filter((group: any) => group.authorId !== target.author_id && group.hasUnseen)
        .map((group: any) => (group.stories.find((story: any) => !seenStoryIds.includes(story.id)) || group.stories[0])?.id)
        .filter(Boolean);
      router.push({ pathname: '/story', params: { id: target.id, resume: '0', next: queue.join(',') } });
    }
  }

  function handleDiscoveryScroll({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) {
    const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
    if (contentOffset.y + layoutMeasurement.height < contentSize.height - 240 || loadInFlight.current) return;
    loadMoreRef.current();
  }
  loadMoreRef.current = () => {
    if (loadInFlight.current) return;
    if (visibleTrendingCount < visibleAuthors.length) setVisibleTrendingCount(count => Math.min(count + 8, visibleAuthors.length));
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        variant="sub"
        title="اليوميات"
        fallbackRoute="/home"

      />

      <View style={[styles.ringsSection, { backgroundColor: colors.surface, borderBottomColor: colors.line }]}>
          <View style={styles.ringsHeadingRow}>
            <View style={styles.ringsHeadingCopy}>
              <Text style={[styles.ringsHeading, { color: colors.ink }]}>يوميات أهل حيّنا</Text>
              <Text style={[styles.ringsSubtitle, { color: colors.muted }]}>تختفي بعد 24 ساعة</Text>
            </View>
            <Pressable oasisKind="plain" accessibilityRole="button" accessibilityLabel="إنشاء يومية جديدة"
              onPress={() => router.push(needsLogin ? '/auth' : '/create-story')}
              style={[styles.createShortcut, { backgroundColor: colors.soft }]}>
              <Plus size={16} color={colors.primary}/>
              <Text style={[styles.createShortcutText, { color: colors.primary }]}>إضافة يومية</Text>
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}
            {...(Platform.OS === 'web' ? { dir: 'rtl' } : {})} contentContainerStyle={styles.ringsScroll}>
            <Pressable style={styles.ringItem} accessibilityRole="button" accessibilityLabel="أضف يومياتك" onPress={() => router.push(needsLogin ? '/auth' : '/create-story')}><View style={[styles.ringOuter, styles.ringSeen, { borderColor: colors.line, backgroundColor: colors.soft }]}><Plus size={21} color={colors.primary} /></View><Text numberOfLines={1} style={[styles.ringName, isDark && { color: colors.ink }]}>يومياتك</Text></Pressable>
            {storyRings.map((group: any) => {
              const author = group.author;
              const name = displayName(author);
              return (
                <Pressable key={group.authorId} style={styles.ringItem}
                  onPress={() => openAuthorStories(group.stories, storyRings)}
                  accessibilityRole="button" accessibilityLabel={`عرض يوميات ${name}`} accessibilityHint={group.hasUnseen ? 'توجد يوميات لم تشاهدها' : 'سبق أن شاهدت هذه اليوميات'}>
                  <View style={[styles.ringOuter, { borderColor: ringColor(group.hasUnseen) }]}>
                    <View style={styles.ringInner}>
                      {!author?.hide_name && author?.avatar_url ? <Image source={{ uri: author.avatar_url }} style={styles.ringAvatar} /> :
                        <View style={styles.ringAvatarFallback}><Text style={styles.ringInitial}>{author?.hide_name ? '؟' : name[0]}</Text></View>}
                    </View>
                    
                  </View>
                  <Text style={[styles.ringName, { color: colors.ink }]} numberOfLines={1}>{name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {!loading && !errorText && !storyRings.length ? <Text style={[styles.sectionSubheading, { paddingHorizontal: 16, textAlign: 'right', marginTop: 10 }]}>{needsLogin ? 'سجل الدخول لمشاهدة اليوميات' : 'لا توجد يوميات نشطة لأهل حيّك أو من تتابعهم الآن'}</Text> : null}
      </View>

      <ScrollView
        ref={discoveryScroll}
        onScroll={handleDiscoveryScroll}
        scrollEventThrottle={200}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomNavInset + 12 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              setVisibleTrendingCount(8);
              void loadAllStories(true);
            }}
            tintColor={OASIS.colors.primary}
            colors={[OASIS.colors.primary]}
          />
        }
      >
        <View style={styles.trendingSectionTitleRow}>
          <View style={styles.trendingSectionAccent} />
          <View style={styles.trendingHeadingCopy}>
            <Text style={[styles.sectionHeading, { color: colors.ink }]}>اكتشف يوميات مدينتك</Text>
            <Text style={[styles.sectionSubheading, { color: colors.muted }]}>{trendingAuthors.length} حساب لديه يوميات نشطة</Text>
          </View>
          <Pressable oasisKind="plain" accessibilityRole="button" accessibilityLabel="استكشف البث المباشر"
            onPress={() => router.push('/lives')} style={[styles.liveShortcut, { backgroundColor: colors.soft }]}>
            <Radio size={16} color={colors.primary}/>
          </Pressable>
        </View>
        <View style={styles.filtersRow}>
          {([
            ['all', 'الكل', trendingAuthors.length],
            ['unseen', 'الجديد', unseenCount],
            ['following', 'أتابعهم', followedCount],
          ] as const).map(([key,label,count]) => (
            <Pressable oasisKind="plain" key={key} accessibilityRole="button"
              accessibilityState={{ selected: storyFilter === key }}
              accessibilityLabel={`${label}، ${count} حساب`}
              onPress={() => { setStoryFilter(key); setVisibleTrendingCount(8); }}
              style={[styles.filterButton, { borderColor: storyFilter === key ? colors.primary : colors.line, backgroundColor: storyFilter === key ? colors.primary : colors.surface }]}>
              <Text style={[styles.filterLabel, { color: storyFilter === key ? '#FFFFFF' : colors.muted }]}>{label}</Text>
              <Text style={[styles.filterCount, { color: storyFilter === key ? '#FFFFFF' : colors.primary }]}>{count}</Text>
            </Pressable>
          ))}
        </View>
        {errorText ? <Pressable accessibilityRole="button" onPress={() => void loadAllStories()} style={{ padding: 16 }}><Text style={{ color: '#A65A49', textAlign: 'right' }}>تعذر تحميل اليوميات. اضغط لإعادة المحاولة.</Text></Pressable> : null}
        {loading && !refreshing ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={OASIS.colors.primary} />
            <Text style={styles.loadingText}>جارٍ جلب يوميات جيرانك...</Text>
          </View>
        ) : errorText ? null : visibleAuthors.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <Text style={[styles.emptyTitle, { color: colors.ink }]}>{needsLogin ? 'سجّل الدخول لمشاهدة اليوميات' : storyFilter === 'unseen' ? 'شاهدت اليوميات الجديدة' : storyFilter === 'following' ? 'ما فيه يوميات لمن تتابعهم' : !currentCity ? 'حدد مدينتك أولًا' : 'لا توجد يوميات نشطة حاليًا'}</Text>
            <Text style={[styles.emptySub, { color: colors.muted }]}>
              {storyFilter === 'all' ? 'عندما ينشر جيرانك يوميات جديدة ستظهر هنا. اسحب للتحديث.' : 'اختر الكل لعرض اليوميات الأخرى أو اسحب للتحديث.'}
            </Text>
            <Pressable oasisKind="action"
              style={styles.emptyActionBtn}
              onPress={() => storyFilter !== 'all' ? setStoryFilter('all') : router.push(needsLogin ? '/auth' : !currentCity ? '/profile' : '/create-story')}
            >
              <Plus size={16} color={OASIS.colors.surface} strokeWidth={2.5} />
              <Text style={styles.emptyActionBtnText}>{storyFilter !== 'all' ? 'عرض كل اليوميات' : needsLogin ? 'تسجيل الدخول' : !currentCity ? 'تحديث ملفي' : 'شارك يومياتك'}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.storiesGrid} onLayout={event => setGridWidth(event.nativeEvent.layout.width)}>
              {visibleAuthors.slice(0, visibleTrendingCount).map((group: any) => {
                const story = group.latestStory;
                const author = group.author;
                const name = displayName(author);
                const verified = author?.is_verified || author?.is_geoverified;
                const bg = story.bg_color || OASIS.colors.primary;
                const hasMedia = story.type === 'image' && Boolean(story.image_url);
                const isSeen = !group.hasUnseen;
                const cardBorder = trendBorderColor(group.hasUnseen);
                return (
                  <Pressable oasisKind="plain" key={group.authorId}
                    style={[styles.storyCard, { backgroundColor: colors.surface, width: cardWidth || '48%', borderColor: cardBorder }]}
                    onPress={() => openAuthorStories(group.stories, visibleAuthors)}
                    accessibilityRole="button" accessibilityLabel={"فتح يوميات " + name}>
                    <View style={[styles.storyCardMedia, { backgroundColor: bg, height: mediaHeight }]}>
                      {hasMedia ? <Image accessible={false} source={{ uri: story.image_url }} style={styles.storyCardImage} resizeMode="cover" /> :
                        <View style={styles.storyTextCard}>
                          <Text style={[styles.storyTextSnippet, { color: previewTextColor(bg) }]} numberOfLines={4}>{story.content || '…'}</Text>
                        </View>}
                      {/* شارة الحالة: جديد/مشاهَد */}
                      <View style={[styles.seenBadge, { backgroundColor: isSeen ? 'rgba(142,142,147,0.85)' : 'rgba(34,197,94,0.92)' }]}>
                        <Text style={styles.seenBadgeText}>{isSeen ? 'شاهدته' : 'جديد'}</Text>
                      </View>
                    </View>
                    {/* عدد المشاهدات */}
                    <View style={[styles.viewCountRow, { backgroundColor: colors.surface, borderBottomColor: colors.line }]}>
                      <Eye size={11} color={OASIS.colors.muted} />
                      <Text style={[styles.viewCountText, { color: colors.muted }]}>{group.totalViews > 0 ? group.totalViews.toLocaleString('ar-SA') : '٠'} مشاهدة</Text>
                    </View>
                    <View style={styles.cardFooter}>
                      <View style={styles.cardAvatarWrap}>
                        {!author?.hide_name && author?.avatar_url ? <Image source={{ uri: author.avatar_url }} style={styles.cardAvatar} /> :
                          <View style={styles.cardAvatarFallback}><Text style={styles.cardAvatarLetter}>{author?.hide_name ? '؟' : name[0]}</Text></View>}
                        {verified && <View style={styles.cardVerifyBadge}><ShieldCheck size={9} color={OASIS.colors.surface} /></View>}
                      </View>
                      <View style={styles.cardCopy}>
                        <Text style={[styles.cardAuthorName, { color: colors.ink }]} numberOfLines={1}>{name}</Text>
                        <Text style={[styles.cardTimeText, { color: colors.muted }]} numberOfLines={1}>{relativeTime(story.created_at)}</Text>
                      </View>
                      {group.authorId !== viewerId ? <Pressable oasisKind="plain" accessibilityRole="button" accessibilityState={{ selected: followingIds.includes(group.authorId) }} accessibilityLabel={(followingIds.includes(group.authorId) ? 'إلغاء متابعة ' : 'متابعة ') + name} onPress={event => { event.stopPropagation(); void toggleFollow(group.authorId); }} style={styles.followButton}>
                        {followingIds.includes(group.authorId) ? <Check size={17} color={OASIS.colors.primary} /> : <UserPlus size={17} color={OASIS.colors.primary} />}
                      </Pressable> : null}
                    </View>
                  </Pressable>
                );
              })}
            </View>

          </>
        )}
        {!loading && !errorText && visibleAuthors.length > visibleTrendingCount && (
          <Pressable oasisKind="plain" accessibilityRole="button" onPress={() => setVisibleTrendingCount(n => Math.min(n + 8, visibleAuthors.length))}
            style={[styles.loadMoreButton, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <Sparkles size={15} color={colors.primary}/>
            <Text style={[styles.loadMoreText, { color: colors.primary }]}>عرض المزيد من اليوميات</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

/** Keep text readable on the author's chosen story background. */
function previewTextColor(background: string) {
  const hex = background.replace('#', '');
  const normalized = hex.length === 3 ? hex.split('').map(c => c + c).join('') : hex;
  if (!/^[0-9a-f]{6}$/i.test(normalized)) return '#FFFFFF';
  const rgb = [0, 2, 4].map(i => parseInt(normalized.slice(i, i + 2), 16) / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722 > .179 ? '#1C1C1E' : '#FFFFFF';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: OASIS.colors.background },
  scroll: { paddingHorizontal: 13, paddingTop: 13, paddingBottom: 10 },
  ringsHeadingRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 13, marginBottom: 9 },
  ringsHeadingCopy: { flex: 1, alignItems: 'flex-end', gap: 2 },
  ringsHeading: { fontSize: 13.5, fontWeight: '800', textAlign: 'right' },
  ringsSubtitle: { fontSize: 10.5, textAlign: 'right' },
  createShortcut: { minHeight: 35, borderRadius: 11, paddingHorizontal: 10, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 5 },
  createShortcutText: { fontSize: 11, fontWeight: '700' },
  trendingHeadingCopy: { flex: 1, alignItems: 'flex-end', gap: 3 },
  liveShortcut: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  filtersRow: { flexDirection: 'row-reverse', gap: 7, marginBottom: 13 },
  filterButton: { flex: 1, minWidth: 0, minHeight: 36, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 12, borderWidth: 1, paddingHorizontal: 8 },
  filterLabel: { fontSize: 11.5, fontWeight: '700' },
  filterCount: { fontSize: 10.5, fontWeight: '800' },
  loadMoreButton: { minHeight: 40, marginTop: 14, borderWidth: 1, borderRadius: 13, flexDirection: 'row-reverse', gap: 7, alignItems: 'center', justifyContent: 'center' },
  loadMoreText: { fontSize: 12, fontWeight: '700' },
  loadingBox: { paddingVertical: 36, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { fontSize: 13, color: OASIS.colors.muted },
  emptyBox: { backgroundColor: OASIS.colors.surface, borderRadius: 14, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: OASIS.colors.line, gap: 10 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: OASIS.colors.ink, textAlign: 'center' },
  emptySub: { fontSize: 13, color: OASIS.colors.muted, textAlign: 'center', lineHeight: 20 },
  emptyActionBtn: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, backgroundColor: OASIS.colors.primary, paddingHorizontal: 16, marginTop: 4 },
  emptyActionBtnText: { color: OASIS.colors.surface, fontSize: 14, fontWeight: '600' },
  ringsSection: { backgroundColor: OASIS.colors.surface, borderBottomWidth: 1, borderBottomColor: OASIS.colors.line, paddingTop: 12, paddingBottom: 10 },
  sectionHeading: { color: OASIS.colors.ink, fontSize: 15, fontWeight: '800' },
  sectionSubheading: { color: OASIS.colors.muted, fontSize: 12, lineHeight: 18 },
  ringsScroll: { flexDirection: 'row-reverse', paddingHorizontal: 12, gap: 12, paddingVertical: 2 },
  ringItem: { width: 62, alignItems: 'center', gap: 5 },
  ringOuter: { width: 48, height: 48, borderRadius: 24, padding: 2, borderWidth: 2, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  ringSeen: { borderColor: OASIS.colors.line },
  ringInner: { width: 40, height: 40, borderRadius: 20, overflow: 'hidden', backgroundColor: OASIS.colors.background },
  ringAvatar: { width: '100%', height: '100%' },
  ringAvatarFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: OASIS.colors.soft },
  ringInitial: { color: OASIS.colors.primary, fontSize: 17, fontWeight: '600' },
  ringName: { color: OASIS.colors.ink, fontSize: 11, textAlign: 'center', maxWidth: 60 },
  trendingSectionTitleRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 12 },
  trendingSectionAccent: { width: 3, height: 18, borderRadius: 2, backgroundColor: OASIS.colors.primary },
  storiesGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  storyCard: { borderRadius: 15, overflow: 'hidden', backgroundColor: OASIS.colors.surface, borderWidth: 1, borderColor: OASIS.colors.line },
  storyCardMedia: { position: 'relative', overflow: 'hidden' },
  storyCardImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  storyTextCard: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, paddingVertical: 12 },
  storyTextSnippet: { fontSize: 14, fontWeight: '500', textAlign: 'center', lineHeight: 21 },
  seenBadge: { position: 'absolute', top: 8, right: 8, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  seenBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  viewCountRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: OASIS.colors.background, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: OASIS.colors.line },
  viewCountText: { color: OASIS.colors.muted, fontSize: 11, fontWeight: '600' },
  cardFooter: { flexDirection: 'row-reverse', alignItems: 'center', paddingRight: 9, paddingLeft: 4, gap: 6, minHeight: 47 },
  cardAvatarWrap: { position: 'relative' },
  cardAvatar: { width: 26, height: 26, borderRadius: 13 },
  cardAvatarFallback: { width: 26, height: 26, borderRadius: 13, backgroundColor: OASIS.colors.soft, alignItems: 'center', justifyContent: 'center' },
  cardAvatarLetter: { color: OASIS.colors.primary, fontSize: 12, fontWeight: '600' },
  cardVerifyBadge: { position: 'absolute', bottom: -2, left: -2, width: 12, height: 12, borderRadius: 6, backgroundColor: OASIS.colors.primary, alignItems: 'center', justifyContent: 'center' },
  cardCopy: { flex: 1, minWidth: 0, alignItems: 'flex-end' },
  cardAuthorName: { color: OASIS.colors.ink, fontSize: 12, fontWeight: '600' },
  cardTimeText: { color: OASIS.colors.muted, fontSize: 11, marginTop: 2 },
  followButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
