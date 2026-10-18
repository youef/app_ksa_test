import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Alert,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  RefreshControl,
  Platform,
  Animated,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { AppHeader } from '@/components/shared/AppHeader';
import { useBottomNavInset } from '@/lib/bottomNav';
import { Plus, ShieldCheck, Sparkles, Settings2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { relativeTime } from '@/lib/mapPins';

export default function StoriesScreen() {
  const bottomNavInset = useBottomNavInset();
  const [stories, setStories] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [seenStoryIds, setSeenStoryIds] = useState<string[]>([]);
  const [currentCity, setCurrentCity] = useState<string>('');
  const [currentDistrict, setCurrentDistrict] = useState<string>('');
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [storyNotificationsEnabled, setStoryNotificationsEnabled] = useState(true);
  const [notificationSettingsBusy, setNotificationSettingsBusy] = useState(false);
  const storyRingPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(Animated.sequence([
      Animated.timing(storyRingPulse, { toValue: 1.06, duration: 850, useNativeDriver: true }),
      Animated.timing(storyRingPulse, { toValue: 1, duration: 850, useNativeDriver: true }),
    ]));
    pulse.start();
    return () => pulse.stop();
  }, [storyRingPulse]);

  useEffect(() => {
    loadAllStories();
  }, []);

  async function loadAllStories() {
    try {
      setLoading(true);
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const nowIso = new Date().toISOString();

      const { data: authResult } = await supabase.auth.getUser();
      const activeViewerId = authResult.user?.id || '';
      setCurrentUserId(activeViewerId);
      let city = '';
      let district = '';
      let followedIds: string[] = [];
      if (activeViewerId) {
        const [{ data: me }, { data: follows }] = await Promise.all([
          supabase.from('profiles').select('city,district').eq('id', activeViewerId).maybeSingle(),
          supabase.from('follows').select('following_id').eq('follower_id', activeViewerId),
        ]);
        city = String(me?.city || '').trim();
        district = String(me?.district || '').trim();
        followedIds = (follows || []).map((row: any) => String(row.following_id));
      }
      setCurrentCity(city);
      setCurrentDistrict(district);
      setFollowingIds(followedIds);
      if (activeViewerId) {
        const { data: notificationSettings } = await supabase.from('story_notification_settings').select('enabled').eq('user_id', activeViewerId).maybeSingle();
        setStoryNotificationsEnabled(notificationSettings?.enabled !== false);
      }

      let mutedAuthorIds: string[] = [];
      if (activeViewerId) {
        const { data: authorPrefs } = await supabase.from('story_author_preferences').select('author_id').eq('user_id', activeViewerId).eq('muted', true);
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
          profiles (
            id,
            display_name,
            username,
            avatar_url,
            is_verified,
            is_geoverified,
            city,
            district
          )
        `)
        .or(`expires_at.gt.${nowIso},and(expires_at.is.null,created_at.gte.${yesterday})`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const cityRows = (data || []) as any[];
      const normalize = (value: any) => String(value || '').trim().toLocaleLowerCase('ar');
      const valid = city ? cityRows.filter((story: any) => normalize(story.profiles?.city) === normalize(city) && !mutedAuthorIds.includes(String(story.author_id))) : [];
      setStories(valid);
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
      console.warn('loadAllStories error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const filtered = stories;

  const groupedAuthors = Object.values(filtered.reduce((groups: Record<string, any>, story: any) => {
    const key = story.author_id;
    if (!groups[key]) groups[key] = { authorId: key, author: story.profiles, stories: [], totalViews: 0, newestAt: story.created_at };
    groups[key].stories.push(story);
    groups[key].totalViews += Math.max(0, Number(story.view_count) || 0);
    if (new Date(story.created_at).getTime() > new Date(groups[key].newestAt).getTime()) groups[key].newestAt = story.created_at;
    return groups;
  }, {})).map((group: any) => {
    const ordered = group.stories.slice().sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return { ...group, stories: ordered, latestStory: ordered[ordered.length - 1], hasUnseen: ordered.some((story: any) => !seenStoryIds.includes(story.id)) };
  });

  const normalizeLocation = (value: any) => String(value || '').trim().toLocaleLowerCase('ar');
  const neighborhoodAndFollowing = groupedAuthors.filter((group: any) => {
    const sameDistrict = !!currentDistrict && normalizeLocation(group.author?.district) === normalizeLocation(currentDistrict);
    const followed = followingIds.includes(String(group.authorId));
    return sameDistrict || followed;
  });
  const storyRings = neighborhoodAndFollowing.slice().sort((a: any, b: any) => {
    const aFollowed = followingIds.includes(String(a.authorId));
    const bFollowed = followingIds.includes(String(b.authorId));
    const aSameDistrict = !!currentDistrict && normalizeLocation(a.author?.district) === normalizeLocation(currentDistrict);
    const bSameDistrict = !!currentDistrict && normalizeLocation(b.author?.district) === normalizeLocation(currentDistrict);
    return Number(bFollowed) - Number(aFollowed) || Number(bSameDistrict) - Number(aSameDistrict) || Number(b.hasUnseen) - Number(a.hasUnseen) || new Date(b.newestAt).getTime() - new Date(a.newestAt).getTime();
  });
  const trendingAuthors = groupedAuthors.slice().sort((a: any, b: any) =>
    b.totalViews - a.totalViews || new Date(b.newestAt).getTime() - new Date(a.newestAt).getTime()
  );

  async function toggleStoryNotifications() {
    const { data: auth } = await supabase.auth.getUser();
    const userId = auth.user?.id;
    if (!userId) {
      Alert.alert('تسجيل الدخول مطلوب', 'سجّل الدخول للتحكم في تنبيهات القصص.');
      return;
    }
    if (notificationSettingsBusy) return;
    const next = !storyNotificationsEnabled;
    setNotificationSettingsBusy(true);
    try {
      const { error } = await supabase.from('story_notification_settings').upsert({
        user_id: userId, enabled: next, updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      if (error) throw error;
      setStoryNotificationsEnabled(next);
      Alert.alert(next ? 'تم تفعيل التنبيهات' : 'تم إيقاف التنبيهات', next ? 'ستصلك تنبيهات عند نشر من تتابعهم قصة جديدة.' : 'لن تصلك تنبيهات القصص الجديدة من الأشخاص الذين تتابعهم.');
    } catch (error: any) {
      Alert.alert('تعذر تحديث التنبيهات', error?.message || 'حاول مرة أخرى.');
    } finally {
      setNotificationSettingsBusy(false);
    }
  }

  function openAuthorStories(authorStories: any[]) {
    const firstUnseen = authorStories.find((story: any) => !seenStoryIds.includes(story.id));
    const target = firstUnseen || authorStories[0];
    if (target?.id) router.push({ pathname: '/story', params: { id: target.id, resume: '1' } });
  }

  return (
    <View style={styles.container}>
      <AppHeader
        variant="sub"
        title="يوميات أهل الحي"
        subtitle={`${filtered.length} قصة مباشرة خلال 24 ساعة`}
        fallbackRoute="/home"
        rightAction={
          <Pressable
            onPress={() => router.push('/create-story')}
            style={styles.addStoryBtn}
            accessibilityRole="button"
            accessibilityLabel="نشر قصة جديدة"
          >
            <Plus size={15} color="#fff" strokeWidth={2.5} />
            <Text style={styles.addStoryBtnText}>إضافة</Text>
          </Pressable>
        }
      />

      <Pressable
        onPress={() => router.push('/story-settings')}
        style={styles.storyNotificationToggle}
        accessibilityRole="button"
        accessibilityLabel="إعدادات تنبيهات القصص وكتم الحسابات"
      >
        <Settings2 size={16} color="#059669" />
        <Text style={styles.storyNotificationToggleText}>إعدادات تنبيهات القصص وكتم الحسابات</Text>
        <Text style={styles.storyNotificationToggleAction}>إدارة</Text>
      </Pressable>

      <Pressable
        style={styles.storyNotificationToggle}
        onPress={toggleStoryNotifications}
        disabled={notificationSettingsBusy}
        accessibilityRole="button"
        accessibilityLabel={storyNotificationsEnabled ? 'إيقاف تنبيهات القصص الجديدة' : 'تفعيل تنبيهات القصص الجديدة'}
      >
        <Sparkles size={15} color={storyNotificationsEnabled ? '#D4A72C' : '#64748b'} />
        <Text style={styles.storyNotificationToggleText}>
          {storyNotificationsEnabled ? 'تنبيهات قصص المتابَعين مفعّلة' : 'تنبيهات قصص المتابَعين متوقفة'}
        </Text>
        <Text style={styles.storyNotificationToggleAction}>{storyNotificationsEnabled ? 'إيقاف' : 'تفعيل'}</Text>
      </Pressable>

      {storyRings.length > 0 && (
        <View style={styles.ringsSection}>
          <View style={styles.sectionHeadingRow}>
            <View style={{ alignItems: 'flex-end', flex: 1 }}>
              <Text style={styles.sectionHeading}>يوميات الجيران</Text>
              <Text style={styles.sectionSubheading}>{currentDistrict ? `أهل ${currentDistrict} ومن تتابعهم` : 'الأشخاص الذين تتابعهم في مدينتك'}</Text>
            </View>
            <View style={styles.livePill}><View style={styles.liveDot} /><Text style={styles.livePillText}>مباشر</Text></View>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ringsScroll}>
            {storyRings.map((group: any) => {
              const author = group.author;
              const name = author?.display_name || author?.username || 'جار الحي';
              return (
                <Pressable key={group.authorId} style={styles.ringItem}
                  onPress={() => openAuthorStories(group.stories)}
                  accessibilityRole="button" accessibilityLabel={`عرض يوميات ${name}`}>
                  <Animated.View style={[styles.ringOuter, group.hasUnseen ? styles.ringUnseen : styles.ringSeen, group.stories.length > 1 && { transform: [{ scale: storyRingPulse }] }]}>
                    <View style={styles.ringInner}>
                      {author?.avatar_url ? <Image source={{ uri: author.avatar_url }} style={styles.ringAvatar} /> :
                        <View style={styles.ringAvatarFallback}><Text style={styles.ringInitial}>{name[0]}</Text></View>}
                    </View>
                    <View style={styles.ringCount}><Text style={styles.ringCountText}>{group.stories.length}</Text></View>
                  </Animated.View>
                  <Text style={styles.ringName} numberOfLines={1}>{name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      )}

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
        {loading && !refreshing ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#059669" />
            <Text style={styles.loadingText}>جارٍ جلب يوميات جيرانك...</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyBox}>
            <View style={styles.emptyIconCircle}>
              <Sparkles size={36} color="#059669" />
            </View>
            <Text style={styles.emptyTitle}>لا توجد يوميات نشطة حالياً</Text>
            <Text style={styles.emptySub}>
              كن أول من يشارك أهل حيه يومياته وتحديثاته اليوم! تظل اليوميات ظاهرة لمدة 24 ساعة.
            </Text>
            <Pressable
              style={styles.emptyActionBtn}
              onPress={() => router.push('/create-story')}
            >
              <Plus size={16} color="#fff" strokeWidth={2.5} />
              <Text style={styles.emptyActionBtnText}>نشر أول يوميات في حيك</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.trendingHeading}>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={styles.sectionHeading}>ترند المدينة</Text>
                <Text style={styles.sectionSubheading}>{currentCity ? `الأكثر مشاهدة في مدينة ${currentCity} من جميع الأحياء` : 'الأكثر مشاهدة في المدينة'}</Text>
              </View>
              <View style={styles.trendingBadge}><Text style={styles.trendingBadgeText}>TRENDING</Text></View>
            </View>
            <View style={styles.storiesGrid}>
              {trendingAuthors.map((group: any, index: number) => {
                const story = group.latestStory;
                const author = group.author;
                const name = author?.display_name || author?.username || 'جار الحي';
                const verified = author?.is_verified || author?.is_geoverified;
                const bg = story.bg_color || '#059669';
                const hasMedia = story.type === 'image' && Boolean(story.image_url);
                const allSeen = !group.hasUnseen;
                return (
                  <Pressable key={group.authorId}
                    style={[styles.storyCard, allSeen ? styles.storyCardSeen : styles.storyCardNew]}
                    onPress={() => openAuthorStories(group.stories)}
                    accessibilityRole="button" accessibilityLabel={`فتح يوميات ${name}`}>
                    <View style={[styles.storyCardMedia, { backgroundColor: bg }, allSeen && styles.storyCardMediaSeen]}>
                      {hasMedia ? <Image source={{ uri: story.image_url }} style={styles.storyCardImage} resizeMode="cover" /> :
                        <View style={styles.storyTextCard}>
                          <Text style={styles.storyTextQuote}>“</Text>
                          <Text style={styles.storyTextSnippet} numberOfLines={4}>{story.content || 'يوميات جديدة'}</Text>
                        </View>}
                      <LinearGradient colors={['rgba(0,0,0,0.55)', 'transparent', 'rgba(0,0,0,0.82)']} style={StyleSheet.absoluteFillObject} />
                      <View style={styles.storyCardTopRow}>
                        <View style={styles.cardAvatarWrap}>
                          {author?.avatar_url ? <Image source={{ uri: author.avatar_url }} style={styles.cardAvatar} /> :
                            <View style={styles.cardAvatarFallback}><Text style={styles.cardAvatarLetter}>{name[0]}</Text></View>}
                          {verified && <View style={styles.cardVerifyBadge}><ShieldCheck size={9} color="#fff" /></View>}
                        </View>
                        <View style={{ flex: 1, alignItems: 'flex-end' }}>
                          <Text style={styles.cardAuthorName} numberOfLines={1}>{name}</Text>
                          <Text style={styles.cardTimeText}>{relativeTime(story.created_at)}</Text>
                          <Text style={[styles.storySeenLabel, allSeen ? styles.storySeenLabelSeen : styles.storySeenLabelNew]}>
                            {allSeen ? 'تمت المشاهدة' : 'يوميات جديدة'}
                          </Text>
                        </View>
                      </View>
                      <View style={styles.trendFooter}>
                        <View style={styles.trendMetric}><Text style={styles.trendMetricText}>#{index + 1} ترند</Text></View>
                        {String(group.authorId) === currentUserId && (
                          <View style={styles.trendMetric}><Text style={styles.trendMetricText}>{group.totalViews.toLocaleString('ar-SA')} مشاهدة</Text></View>
                        )}
                        <Text style={styles.trendStoryCount}>{group.stories.length} يوميات</Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
  ringsSection: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingTop: 14, paddingBottom: 12 },
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
  trendingHeading: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginBottom: 12, marginTop: 6 },
  trendingBadge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 9, backgroundColor: '#0f172a' },
  trendingBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900', letterSpacing: 0.5 },
  trendFooter: { zIndex: 2, alignItems: 'flex-start', gap: 5 },
  trendMetric: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, backgroundColor: 'rgba(0,0,0,0.48)', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10 },
  trendMetricText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  trendStoryCount: { color: '#fff', fontSize: 10, fontWeight: '800', textShadowColor: '#000', textShadowRadius: 4 },
  storiesGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 12,
  },
  storyCard: {
    width: '48%',
    aspectRatio: 0.72,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#059669',
    borderWidth: 2,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  storyCardNew: { borderColor: '#10b981' },
  storyCardSeen: { borderColor: '#94a3b8', opacity: 0.72 },
  storyCardMediaSeen: { opacity: 0.82 },
  storySeenLabel: { fontSize: 9, fontWeight: '900', marginTop: 3, textAlign: 'right' },
  storySeenLabelNew: { color: '#a7f3d0' },
  storySeenLabelSeen: { color: '#e2e8f0' },
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
