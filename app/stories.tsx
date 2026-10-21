import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { AppHeader } from '@/components/shared/AppHeader';
import { useBottomNavInset } from '@/lib/bottomNav';
import { Plus, Camera, ShieldCheck, Clock, MapPin, Sparkles, MessageCircle } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { relativeTime } from '@/lib/mapPins';

export default function StoriesScreen() {
  const bottomNavInset = useBottomNavInset();
  const [stories, setStories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterDistrict, setFilterDistrict] = useState<string>('all');
  const [districts, setDistricts] = useState<string[]>([]);
  const [seenStoryIds, setSeenStoryIds] = useState<string[]>([]);

  useEffect(() => {
    loadAllStories();
  }, []);

  async function loadAllStories() {
    try {
      setLoading(true);
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const nowIso = new Date().toISOString();

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
      const valid = (data || []) as any[];
      setStories(valid);

      const { data: authResult } = await supabase.auth.getUser();
      const activeViewerId = authResult.user?.id || '';
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

      const dSet = new Set<string>();
      valid.forEach((s: any) => {
        if (s.profiles?.district) dSet.add(s.profiles.district);
      });
      setDistricts(Array.from(dSet));
    } catch (e) {
      console.warn('loadAllStories error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const filtered = filterDistrict === 'all'
    ? stories
    : stories.filter((s: any) => s.profiles?.district === filterDistrict);

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

  const storyRings = groupedAuthors.slice().sort((a: any, b: any) =>
    Number(b.hasUnseen) - Number(a.hasUnseen) || new Date(b.newestAt).getTime() - new Date(a.newestAt).getTime()
  );
  const trendingAuthors = groupedAuthors.slice().sort((a: any, b: any) =>
    b.totalViews - a.totalViews || new Date(b.newestAt).getTime() - new Date(a.newestAt).getTime()
  );

  function openAuthorStories(authorStories: any[]) {
    const firstUnseen = authorStories.find((story: any) => !seenStoryIds.includes(story.id));
    const target = firstUnseen || authorStories[0];
    if (target?.id) router.push({ pathname: '/story', params: { id: target.id } });
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

      {/* Filter Chips by District */}
      {districts.length > 0 && (
        <View style={styles.filterBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
            <Pressable
              onPress={() => setFilterDistrict('all')}
              style={[styles.filterChip, filterDistrict === 'all' && styles.filterChipActive]}
            >
              <Text style={[styles.filterChipText, filterDistrict === 'all' && styles.filterChipTextActive]}>
                كل الأحياء ({stories.length})
              </Text>
            </Pressable>
            {districts.map((d) => (
              <Pressable
                key={d}
                onPress={() => setFilterDistrict(d)}
                style={[styles.filterChip, filterDistrict === d && styles.filterChipActive]}
              >
                <Text style={[styles.filterChipText, filterDistrict === d && styles.filterChipTextActive]}>
                  {d}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {storyRings.length > 0 && (
        <View style={styles.ringsSection}>
          <View style={styles.sectionHeadingRow}>
            <View style={{ alignItems: 'flex-end', flex: 1 }}>
              <Text style={styles.sectionHeading}>يوميات الجيران</Text>
              <Text style={styles.sectionSubheading}>كل جار في دائرة واحدة</Text>
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
                  <View style={[styles.ringOuter, group.hasUnseen ? styles.ringUnseen : styles.ringSeen]}>
                    <View style={styles.ringInner}>
                      {author?.avatar_url ? <Image source={{ uri: author.avatar_url }} style={styles.ringAvatar} /> :
                        <View style={styles.ringAvatarFallback}><Text style={styles.ringInitial}>{name[0]}</Text></View>}
                    </View>
                    <View style={styles.ringCount}><Text style={styles.ringCountText}>{group.stories.length}</Text></View>
                  </View>
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
        {/* Quick Add Story Interactive Hero Banner */}
        <Pressable
          style={styles.heroAddBanner}
          onPress={() => router.push('/create-story')}
        >
          <LinearGradient
            colors={['#059669', '#047857', '#064e3b']}
            style={styles.heroAddGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <View style={styles.heroAddContent}>
              <View style={styles.heroAddIconWrap}>
                <Camera size={22} color="#fff" />
              </View>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={styles.heroAddTitle}>شارك يومياتك مع جيرانك الآن</Text>
                <Text style={styles.heroAddSub}>
                  انشر حالة أو صورة تظهر لأهل حيك لمدة 24 ساعة وتختفي تلقائياً
                </Text>
              </View>
            </View>
            <View style={styles.heroAddBtn}>
              <Plus size={14} color="#059669" strokeWidth={3} />
              <Text style={styles.heroAddBtnText}>أضف الآن</Text>
            </View>
          </LinearGradient>
        </Pressable>

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
                <Text style={styles.sectionHeading}>الأكثر مشاهدة</Text>
                <Text style={styles.sectionSubheading}>ترند أهل الحي حسب إجمالي المشاهدات</Text>
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
                        <View style={styles.trendMetric}><Text style={styles.trendMetricText}>{group.totalViews.toLocaleString('ar-SA')} مشاهدة</Text></View>
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
  filterBar: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingVertical: 8,
  },
  filterScroll: {
    flexDirection: 'row-reverse',
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterChipActive: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  filterChipTextActive: {
    color: '#047857',
    fontWeight: '900',
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
  ringUnseen: { borderColor: '#10b981' },
  ringSeen: { borderColor: '#cbd5e1' },
  ringInner: { width: 50, height: 50, borderRadius: 25, overflow: 'hidden', backgroundColor: '#f1f5f9' },
  ringAvatar: { width: '100%', height: '100%' },
  ringAvatarFallback: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#d1fae5' },
  ringInitial: { color: '#047857', fontSize: 20, fontWeight: '900' },
  ringCount: { position: 'absolute', bottom: -3, right: -2, minWidth: 19, height: 19, borderRadius: 10, backgroundColor: '#0f172a', borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
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
  heroAddBanner: {
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  heroAddGradient: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    gap: 12,
  },
  heroAddContent: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  heroAddIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  heroAddTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 3,
  },
  heroAddSub: {
    fontSize: 11,
    fontWeight: '600',
    color: '#d1fae5',
    lineHeight: 16,
  },
  heroAddBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  heroAddBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#059669',
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
