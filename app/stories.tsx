import { HeaderAction, AppHeader } from '@/components/shared/AppHeader';
import { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { requireAccount } from '@/lib/authGate';
import { supabase } from '@/lib/supabase';
import { useBottomNavInset } from '@/lib/bottomNav';
import { Plus, ShieldCheck, Sparkles, Settings2, Flame, ChevronDown } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ProfileStories } from '@/components/profile/ProfileStories';
import { isSameStoryLocation, isActiveStory, type StoryScope } from '@/lib/storyActivity';
import { relativeTime } from '@/lib/mapPins';

export default function StoriesScreen() {
  const bottomNavInset = useBottomNavInset();
  const [stories, setStories] = useState<any[]>([]);
  const [viewerId, setViewerId] = useState('');
  const [scope, setScope] = useState<StoryScope>('district');
  const [errorText, setErrorText] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [seenStoryIds, setSeenStoryIds] = useState<string[]>([]);
  const [currentCity, setCurrentCity] = useState<string>('');
  const [currentDistrict, setCurrentDistrict] = useState<string>('');
  const [visibleTrendingCount, setVisibleTrendingCount] = useState(8);
  useFocusEffect(useCallback(() => { void loadAllStories(); }, []));

  async function loadAllStories() {
    try {
      setLoading(true); setErrorText('');
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const nowIso = new Date().toISOString();

      const { data: authResult } = await supabase.auth.getUser();
      const activeViewerId = authResult.user?.id || '';
      setViewerId(activeViewerId);
      if (!activeViewerId) {
        setStories([]);
        requireAccount('سجّل الدخول أو أنشئ حساباً لمشاهدة يوميات أهل الحي.');
        router.replace('/auth');
        return;
      }
      let city = '';
      let district = '';
      if (activeViewerId) {
        const { data: me, error: profileError } = await supabase.from('profiles').select('city,district').eq('id', activeViewerId).maybeSingle();
        if (profileError) throw profileError;
        city = String(me?.city || '').trim();
        district = String(me?.district || '').trim();
      }
      setCurrentCity(city);
      setCurrentDistrict(district);
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
          hidden_user_ids,
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
      const valid = cityRows.filter((story: any) => isActiveStory(story) && (story.author_id === activeViewerId || (isSameStoryLocation(story.profiles, city) && !mutedAuthorIds.includes(String(story.author_id)) && !(story.hidden_user_ids || []).includes(activeViewerId))));
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
      setStories([]);
      setErrorText(e instanceof Error ? e.message : 'تعذر تحميل اليوميات.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const filtered = stories.filter(story => scope === 'mine' ? story.author_id === viewerId : story.author_id !== viewerId && isSameStoryLocation(story.profiles, currentCity, scope === 'district' ? currentDistrict : undefined) && (scope !== 'district' || Boolean(currentDistrict)));

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

  const trendingAuthors = groupedAuthors.slice().sort((a: any, b: any) =>
    (scope === 'city' ? b.totalViews - a.totalViews : Number(b.hasUnseen) - Number(a.hasUnseen)) || new Date(b.newestAt).getTime() - new Date(a.newestAt).getTime()
  );

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
        fallbackRoute="/home"
        rightAction={
          <HeaderAction
            onPress={() => router.push('/create-story')}
            style={styles.addStoryBtn}
            accessibilityRole="button"
            accessibilityLabel="نشر قصة جديدة"
          >
            <Plus size={15} color="#fff" strokeWidth={2.5} />
            <Text style={styles.addStoryBtnText}>إضافة</Text>
          </HeaderAction>
        }
      />

      <View style={styles.discoveryHeader}>
        <View style={{ flex: 1, alignItems: 'flex-end', gap: 5 }}>
          <Text style={styles.discoveryTitle}>لحظات قريبة منك</Text>
          <Text style={styles.sectionSubheading}>{currentCity ? `${currentCity}${currentDistrict ? ` · ${currentDistrict}` : ''}` : 'حدد مدينتك وحيّك في ملفك الشخصي'}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="إعدادات اليوميات" onPress={() => router.push('/story-settings')} style={styles.settingsButton}><Settings2 size={21} color="#166044" /></Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, flexShrink: 0 }} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row-reverse', gap: 8 }}>{([{ key: 'district', label: 'أهل حيّي' }, { key: 'city', label: 'ترند مدينتي' }, { key: 'mine', label: 'يومياتي' }] as const).map(item => <Pressable accessibilityRole="button" accessibilityState={{ selected: scope === item.key }} key={item.key} onPress={() => { setScope(item.key); setVisibleTrendingCount(8); }} style={{ backgroundColor: scope === item.key ? '#166044' : '#FFFFFF', borderWidth: 1, borderColor: '#DDEAE1', borderRadius: 13, minHeight: 40, paddingHorizontal: 15, justifyContent: 'center' }}><Text style={{ color: scope === item.key ? '#FFFFFF' : '#668373', fontWeight: '700', fontSize: 12 }}>{item.label}</Text></Pressable>)}</ScrollView>
      {errorText ? <Pressable accessibilityRole="button" onPress={() => void loadAllStories()} style={{ padding: 16 }}><Text style={{ color: '#A65A49', textAlign: 'right' }}>تعذر تحديث اليوميات. اضغط لإعادة المحاولة.</Text></Pressable> : null}
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
        {scope === 'mine' && viewerId ? <ProfileStories userId={viewerId} own /> : loading && !refreshing ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#059669" />
            <Text style={styles.loadingText}>جارٍ جلب يوميات جيرانك...</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyBox}>
            <View style={styles.emptyIconCircle}>
              <Sparkles size={36} color="#059669" />
            </View>
            <Text style={styles.emptyTitle}>{!currentCity || (scope === 'district' && !currentDistrict) ? 'أكمل موقعك أولاً' : scope === 'district' ? 'حيّك ينتظر أول لحظة' : 'لا توجد يوميات في مدينتك الآن'}</Text>
            <Text style={styles.emptySub}>
              {!currentCity || (scope === 'district' && !currentDistrict) ? 'أضف المدينة والحي في ملفك الشخصي لعرض أهل منطقتك فقط.' : 'شارك صورة أو لحظة من يومك. تختفي اليوميات بعد ٢٤ ساعة.'}
            </Text>
            <Pressable
              style={styles.emptyActionBtn}
              onPress={() => router.push(!currentCity || (scope === 'district' && !currentDistrict) ? '/profile' : '/create-story')}
            >
              <Plus size={16} color="#fff" strokeWidth={2.5} />
              <Text style={styles.emptyActionBtnText}>{!currentCity || (scope === 'district' && !currentDistrict) ? 'تحديث ملفي الشخصي' : 'شارك لحظتك'}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.trendingSectionTitleRow}>
              <View style={styles.trendingSectionAccent} />
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={styles.sectionHeading}>{scope === 'city' ? `ترند ${currentCity}` : `أهل ${currentDistrict}`}</Text>
                <Text style={styles.sectionSubheading}>{scope === 'city' ? 'الأكثر مشاهدة خلال آخر ٢٤ ساعة في مدينتك فقط' : 'جيرانك في الحي نفسه · الجديد أولاً'}</Text>
              </View>
              <View style={styles.trendingBadge}><Flame size={13} color="#fff" /><Text style={styles.trendingBadgeText}>{scope === 'city' ? 'رائج' : 'حيّك'}</Text></View>
            </View>
            <View style={styles.storiesGrid}>
              {trendingAuthors.slice(0, visibleTrendingCount).map((group: any) => {
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
                          {author?.avatar_url ? <Image source={{ uri: author.avatar_url }} style={styles.cardAvatar} /> :
                            <View style={styles.cardAvatarFallback}><Text style={styles.cardAvatarLetter}>{name[0]}</Text></View>}
                          {verified && <View style={styles.cardVerifyBadge}><ShieldCheck size={9} color="#fff" /></View>}
                        </View>
                        <View style={{ flex: 1, alignItems: 'flex-end' }}>
                          <Text style={styles.cardAuthorName} numberOfLines={1}>{name}</Text>
                          <Text style={styles.cardTimeText}>{relativeTime(story.created_at)} · {group.stories.length} لحظات</Text>
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
  discoveryHeader: { flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 20, paddingTop: 22, paddingBottom: 12, gap: 12 },
  discoveryTitle: { fontSize: 27, fontWeight: '900', color: '#173F2F', textAlign: 'right' },
  settingsButton: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#E7EFE9', alignItems: 'center', justifyContent: 'center' },
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
    aspectRatio: 0.63,
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
    marginTop: 'auto',
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
