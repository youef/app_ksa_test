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
      const viewerId = authResult.user?.id || '';
      if (viewerId && valid.length > 0) {
        const { data: views, error: viewsError } = await supabase
          .from('story_views')
          .select('story_id')
          .eq('viewer_id', viewerId)
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
          <View style={styles.storiesGrid}>
            {filtered
              .slice()
              .sort((a, b) => Number(seenStoryIds.includes(a.id)) - Number(seenStoryIds.includes(b.id)) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .map((story) => {
              const isSeen = seenStoryIds.includes(story.id);
              const author = story.profiles;
              const name = author?.display_name || author?.username || 'جار الحي';
              const verified = author?.is_verified || author?.is_geoverified;
              const bg = story.bg_color || '#059669';
              const hasMedia = story.type === 'image' && Boolean(story.image_url);

              return (
                <Pressable
                  key={story.id}
                  style={[styles.storyCard, isSeen ? styles.storyCardSeen : styles.storyCardNew]}
                  onPress={() => router.push({ pathname: '/story', params: { id: story.id } })}
                  accessibilityRole="button"
                >
                  {/* Story Preview Media / Color Box */}
                  <View style={[styles.storyCardMedia, { backgroundColor: bg }, isSeen && styles.storyCardMediaSeen]}>
                    {hasMedia ? (
                      <Image source={{ uri: story.image_url }} style={styles.storyCardImage} resizeMode="cover" />
                    ) : (
                      <View style={styles.storyTextCard}>
                        <Text style={styles.storyTextQuote}>“</Text>
                        <Text style={styles.storyTextSnippet} numberOfLines={4}>
                          {story.content || 'يوميات جديدة'}
                        </Text>
                      </View>
                    )}

                    {/* Gradient Overlay for Readability */}
                    <LinearGradient
                      colors={['rgba(0,0,0,0.55)', 'transparent', 'rgba(0,0,0,0.8)']}
                      style={StyleSheet.absoluteFillObject}
                    />

                    {/* Top User Info Bar */}
                    <View style={styles.storyCardTopRow}>
                      <View style={styles.cardAvatarWrap}>
                        {author?.avatar_url ? (
                          <Image source={{ uri: author.avatar_url }} style={styles.cardAvatar} />
                        ) : (
                          <View style={styles.cardAvatarFallback}>
                            <Text style={styles.cardAvatarLetter}>{name[0]}</Text>
                          </View>
                        )}
                        {verified && (
                          <View style={styles.cardVerifyBadge}>
                            <ShieldCheck size={9} color="#fff" />
                          </View>
                        )}
                      </View>
                      <View style={{ flex: 1, alignItems: 'flex-end' }}>
                        <Text style={styles.cardAuthorName} numberOfLines={1}>
                          {name}
                        </Text>
                        <Text style={styles.cardTimeText}>
                          {story.created_at ? relativeTime(story.created_at) : 'الآن'}
                        </Text>
                        <Text style={[styles.storySeenLabel, isSeen ? styles.storySeenLabelSeen : styles.storySeenLabelNew]}>
                          {isSeen ? 'تمت المشاهدة' : 'جديدة'}
                        </Text>
                      </View>
                    </View>

                    {/* Bottom District & Type Pill */}
                    <View style={styles.storyCardBottomRow}>
                      {(author?.district || author?.city) ? (
                        <View style={styles.districtBadge}>
                          <MapPin size={9} color="#fff" />
                          <Text style={styles.districtBadgeText} numberOfLines={1}>
                            {[author.district, author.city].filter(Boolean).join(' · ')}
                          </Text>
                        </View>
                      ) : null}

                      {hasMedia && (
                        <View style={styles.mediaTypeBadge}>
                          <Camera size={10} color="#fff" />
                        </View>
                      )}
                    </View>
                  </View>
                </Pressable>
              );
            })}
          </View>
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
