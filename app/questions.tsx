import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  HelpCircle,
  Search,
  Plus,
  MapPin,
  MessageCircle,
  Sparkles,
  ChevronDown,
  X,
  Clock,
  ShieldCheck,
  Award,
  ArrowRight,
  Flame,
} from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import { useBottomNavInset } from '@/lib/bottomNav';
import ScreenHeader from '@/components/shared/ScreenHeader';
import LocationSelectorModal from '@/components/LocationSelectorModal';
import {
  getActiveLocation,
  subscribeLocation,
  savePermanentMyLocation,
  isExactDistrictMatching,
  isLocationMatching,
  isAllKingdom,
  type HaynaLocation,
} from '@/lib/locationSync';
import { relativeTime } from '@/lib/mapPins';

type QuestionFilter = 'all' | 'solved' | 'hot' | 'district';

export default function Questions() {
  const bottomNavInset = useBottomNavInset();
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [activeFilter, setActiveFilter] = useState<QuestionFilter>('all');
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [activeLoc, setActiveLoc] = useState<HaynaLocation>({
    region: 'كل المملكة',
    city: 'كل المدن',
    district: 'كل الأحياء',
  });

  async function load(q = '', location = activeLoc) {
    setLoading(true);
    setLoadError('');
    try {
      const { data: session } = await supabase.auth.getSession();
      const user = session.session?.user;
      setHasSession(Boolean(user));

      let fetchedQuestions: any[] = [];
      if (user) {
        let query = supabase
          .from('questions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(60);
        if (q.trim()) query = query.or(`title.ilike.%${q.trim()}%,body.ilike.%${q.trim()}%`);
        const result = await query;
        fetchedQuestions = result.data ?? [];
      } else {
        const result = await supabase.rpc('hayna_guest_questions', {
          p_city: location.city,
          p_district: location.district,
          p_limit: 60,
        });
        if (result.error) throw result.error;
        const searchTerm = q.trim().toLocaleLowerCase('ar');
        fetchedQuestions = (result.data ?? []).filter((item: any) =>
          !searchTerm || `${item.title} ${item.body}`.toLocaleLowerCase('ar').includes(searchTerm)
        );
      }

      // Fetch authors profiles and answer counts
      if (fetchedQuestions.length > 0) {
        const authorIds = Array.from(new Set(fetchedQuestions.map(x => x.author_id).filter(Boolean)));
        const qIds = fetchedQuestions.map(x => x.id);

        const [profilesRes, answersRes] = await Promise.all([
          authorIds.length > 0
            ? supabase.from('profiles').select('id, display_name, username, avatar_url, is_geoverified, is_verified, district').in('id', authorIds)
            : Promise.resolve({ data: [] }),
          supabase.from('answers').select('id, question_id').in('question_id', qIds),
        ]);

        const pMap = (profilesRes.data || []).reduce((acc: any, p: any) => ({ ...acc, [p.id]: p }), {});
        const countMap = (answersRes.data || []).reduce((acc: any, a: any) => {
          acc[a.question_id] = (acc[a.question_id] || 0) + 1;
          return acc;
        }, {});

        fetchedQuestions.forEach(item => {
          item.profiles = pMap[item.author_id] || null;
          item.answers_count = countMap[item.id] || 0;
        });
      }

      setItems(fetchedQuestions);
    } catch (e: any) {
      console.warn('Load questions error', e);
      setLoadError(e?.code === 'PGRST202' ? 'يلزم تحديث قاعدة البيانات لعرض أسئلة الحي للزوار.' : 'تعذر تحميل الأسئلة. حاول مرة أخرى.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setHasSession(Boolean(data.session?.user)));
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(Boolean(session?.user));
      if (session?.user) void load(search, activeLoc);
    });
    getActiveLocation().then(location => {
      setActiveLoc(location);
      void load(search, location);
    });
    const unsub = subscribeLocation(location => {
      setActiveLoc(location);
      void load(search, location);
    });
    return () => {
      unsub();
      authListener.subscription.unsubscribe();
    };
  }, []);

  const locationFilteredItems = useMemo(() => {
    return items.filter(q =>
      hasSession
        ? isExactDistrictMatching(q, activeLoc.city, activeLoc.district)
        : isLocationMatching(q, activeLoc.city, activeLoc.district)
    );
  }, [items, hasSession, activeLoc]);

  // Tab Filtering
  const displayedItems = useMemo(() => {
    return locationFilteredItems.filter(q => {
      if (activeFilter === 'solved') return q.status === 'solved' || Boolean(q.best_answer_id);
      if (activeFilter === 'hot') return (q.answers_count || 0) >= 2;
      if (activeFilter === 'district') return Boolean(q.district);
      return true;
    });
  }, [locationFilteredItems, activeFilter]);

  const counts = useMemo(() => {
    return {
      all: locationFilteredItems.length,
      solved: locationFilteredItems.filter(q => q.status === 'solved' || Boolean(q.best_answer_id)).length,
      hot: locationFilteredItems.filter(q => (q.answers_count || 0) >= 2).length,
      district: locationFilteredItems.filter(q => Boolean(q.district)).length,
    };
  }, [locationFilteredItems]);

  const locationLabel = !isAllKingdom(activeLoc.city)
    ? `${activeLoc.city}${activeLoc.district && activeLoc.district !== 'كل الأحياء' ? ` · حي ${activeLoc.district}` : ''}`
    : 'كل مناطق المملكة';

  const onSelectLocation = async (loc: HaynaLocation) => {
    await savePermanentMyLocation(loc, true);
    setActiveLoc(loc);
    setShowLocationModal(false);
    load(search, loc);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomNavInset + 24 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load(search, activeLoc);
            }}
            tintColor="#059669"
            colors={['#059669']}
          />
        }
      >
        {/* Unified Luxury Header (matching home) */}
        <LinearGradient
          colors={['#064e3b', '#065f46', '#047857']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <ScreenHeader
            title="أسئلة واستفسارات الحي ❓"
            subtitle="مجتمع حيّنا • تواصل الجيران"
            fallbackRoute="/home"
            rightAction={
              hasSession ? (
                <Pressable
                  onPress={() => router.push('/ask')}
                  style={styles.addBtn}
                  accessibilityRole="button"
                  accessibilityLabel="اسأل جارك"
                >
                  <Plus size={16} color="#064e3b" />
                  <Text style={styles.addBtnText}>اسأل جارك</Text>
                </Pressable>
              ) : undefined
            }
          />

          <Text style={styles.heroSubtitle}>
            استفسر عن أي شيء في حيك وتلقى إجابات موثوقة من جيرانك وسكان منطقتك.
          </Text>

          {/* Interactive Neighborhood Selector Pill (matching home) */}
          <View style={styles.locationRow}>
            <Pressable
              style={styles.locationSelectorPill}
              onPress={() => setShowLocationModal(true)}
              accessibilityRole="button"
              accessibilityLabel={`الموقع الحالي: ${locationLabel}، اضغط للتغيير`}
            >
              <ChevronDown size={14} color="#a7f3d0" />
              <Text style={styles.locationSelectorText} numberOfLines={1}>
                {locationLabel}
              </Text>
              <MapPin size={13} color="#6ee7b7" />
            </Pressable>
          </View>

          {/* Search Bar */}
          <View style={styles.searchBar}>
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={() => load(search)}
              placeholder="ابحث في الأسئلة والتوصيات..."
              placeholderTextColor="#94a3b8"
              returnKeyType="search"
            />
            {search.length > 0 ? (
              <Pressable
                onPress={() => {
                  setSearch('');
                  load('', activeLoc);
                }}
                style={styles.searchIconBtn}
              >
                <X size={17} color="#64748b" />
              </Pressable>
            ) : (
              <Pressable onPress={() => load(search)} style={styles.searchIconBtn}>
                <Search size={18} color="#059669" />
              </Pressable>
            )}
          </View>
        </LinearGradient>

        {/* Filter Pills Tabs (matching home FeedTabs) */}
        <View style={styles.filtersWrapper}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersScroll}>
            <Pressable
              style={[styles.filterChip, activeFilter === 'all' && styles.filterChipActive]}
              onPress={() => setActiveFilter('all')}
            >
              <Text style={[styles.filterChipText, activeFilter === 'all' && styles.filterChipTextActive]}>
                كل الأسئلة ({counts.all})
              </Text>
            </Pressable>

            <Pressable
              style={[styles.filterChip, activeFilter === 'solved' && styles.filterChipSolvedActive]}
              onPress={() => setActiveFilter('solved')}
            >
              <Award size={14} color={activeFilter === 'solved' ? '#fff' : '#d97706'} />
              <Text style={[styles.filterChipText, activeFilter === 'solved' && styles.filterChipTextActive]}>
                إجابات معتمدة ⭐ ({counts.solved})
              </Text>
            </Pressable>

            <Pressable
              style={[styles.filterChip, activeFilter === 'hot' && styles.filterChipHotActive]}
              onPress={() => setActiveFilter('hot')}
            >
              <Flame size={14} color={activeFilter === 'hot' ? '#fff' : '#dc2626'} />
              <Text style={[styles.filterChipText, activeFilter === 'hot' && styles.filterChipTextActive]}>
                تفاعل عالي 🔥 ({counts.hot})
              </Text>
            </Pressable>

            <Pressable
              style={[styles.filterChip, activeFilter === 'district' && styles.filterChipActive]}
              onPress={() => setActiveFilter('district')}
            >
              <MapPin size={14} color={activeFilter === 'district' ? '#fff' : '#059669'} />
              <Text style={[styles.filterChipText, activeFilter === 'district' && styles.filterChipTextActive]}>
                داخل الحي 📍 ({counts.district})
              </Text>
            </Pressable>
          </ScrollView>
        </View>

        {/* Questions Feed */}
        <View style={styles.content}>
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#059669" />
              <Text style={styles.loadingText}>جاري تحميل أسئلة الجيران...</Text>
            </View>
          ) : loadError ? (
            <View style={styles.emptyCard}>
              <HelpCircle size={44} color="#f59e0b" />
              <Text style={styles.emptyTitle}>{loadError}</Text>
              <Pressable style={styles.emptyAddBtn} onPress={() => load(search, activeLoc)}>
                <Text style={styles.emptyAddBtnText}>إعادة المحاولة</Text>
              </Pressable>
            </View>
          ) : displayedItems.length === 0 ? (
            <View style={styles.emptyCard}>
              <HelpCircle size={50} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>لا توجد أسئلة مطابقة</Text>
              <Text style={styles.emptySub}>
                {!isAllKingdom(activeLoc.city)
                  ? `لم يتم طرح أسئلة بعد في ${activeLoc.city}${activeLoc.district !== 'كل الأحياء' ? ` (حي ${activeLoc.district})` : ''}. كن أول من يشارك أهل حيّه!`
                  : 'عندك استفسار عن خدمات الحي أو تجربة شخصية؟ اطرح سؤالك الآن!'}
              </Text>
              {hasSession && (
                <Pressable style={styles.emptyAddBtn} onPress={() => router.push('/ask')}>
                  <Plus size={18} color="#fff" />
                  <Text style={styles.emptyAddBtnText}>طرح سؤال جديد</Text>
                </Pressable>
              )}
            </View>
          ) : (
            displayedItems.map(q => {
              const authorName = q.profiles?.display_name || (q.profiles?.username ? `@${q.profiles.username}` : 'أحد الجيران');
              const isSolved = q.status === 'solved' || Boolean(q.best_answer_id);
              const timeLabel = q.created_at ? relativeTime(q.created_at) : '';

              return (
                <Pressable
                  key={q.id}
                  style={({ pressed }) => [
                    styles.card,
                    pressed && { transform: [{ scale: 0.99 }] },
                  ]}
                  onPress={() => router.push({ pathname: '/question', params: { id: q.id } })}
                >
                  {/* Author Row & Status Badges */}
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.cardAuthorWrap}>
                      {q.profiles?.avatar_url ? (
                        <Image source={{ uri: q.profiles.avatar_url }} style={styles.cardAvatar} />
                      ) : (
                        <View style={styles.cardAvatarPlaceholder}>
                          <Text style={styles.cardAvatarLetter}>{authorName[0] || 'ح'}</Text>
                        </View>
                      )}
                      <View style={styles.authorNameCol}>
                        <View style={styles.authorNameRow}>
                          <Text style={styles.authorNameText}>{authorName}</Text>
                          {q.profiles?.is_geoverified && <ShieldCheck size={12} color="#10b981" />}
                        </View>
                        {Boolean(timeLabel) && (
                          <Text style={styles.timeLabelText}>{timeLabel}</Text>
                        )}
                      </View>
                    </View>

                    {isSolved && (
                      <View style={styles.solvedBadge}>
                        <Award size={12} color="#92400e" />
                        <Text style={styles.solvedBadgeText}>تمت الإجابة ⭐</Text>
                      </View>
                    )}
                  </View>

                  {/* Title & Body Snippet */}
                  <Text style={styles.questionTitle} numberOfLines={2}>
                    {q.title}
                  </Text>
                  {Boolean(q.body) && (
                    <Text style={styles.questionBody} numberOfLines={2}>
                      {q.body}
                    </Text>
                  )}

                  {/* Card Footer Pills & Action */}
                  <View style={styles.cardFooter}>
                    <View style={styles.metaPillsRow}>
                      <View style={styles.metaPill}>
                        <MapPin size={11} color="#059669" />
                        <Text style={styles.metaPillText} numberOfLines={1}>
                          {q.district ? `حي ${q.district}` : q.city || 'المنطقة'}
                        </Text>
                      </View>

                      <View style={styles.metaPill}>
                        <MessageCircle size={11} color="#059669" />
                        <Text style={styles.metaPillText}>
                          {q.answers_count ? `${q.answers_count} ردود` : 'بدون ردود'}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.cardCtaRow}>
                      <Text style={styles.cardCtaText}>تفاعل</Text>
                      <ArrowRight size={13} color="#059669" />
                    </View>
                  </View>
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Location Selector Modal */}
      <LocationSelectorModal
        visible={showLocationModal}
        currentLocation={activeLoc}
        onSelect={onSelectLocation}
        onClose={() => setShowLocationModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f8f7',
  },
  scroll: {
    flexGrow: 1,
  },
  hero: {
    paddingTop: Platform.OS === 'ios' ? 44 : 20,
    paddingHorizontal: 20,
    paddingBottom: 22,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroSubtitle: {
    color: '#d1fae5',
    fontSize: 13,
    textAlign: 'right',
    lineHeight: 19,
    marginTop: 6,
    marginBottom: 12,
  },
  addBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  addBtnText: {
    color: '#064e3b',
    fontSize: 12,
    fontWeight: '900',
  },
  locationRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 12,
  },
  locationSelectorPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  locationSelectorText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  searchBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingHorizontal: 14,
    height: 48,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    color: '#0f172a',
    fontSize: 13.5,
    textAlign: 'right',
  },
  searchIconBtn: {
    padding: 4,
  },
  filtersWrapper: {
    marginTop: 14,
    marginBottom: 6,
  },
  filtersScroll: {
    paddingHorizontal: 18,
    flexDirection: 'row-reverse',
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterChipActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  filterChipSolvedActive: {
    backgroundColor: '#d97706',
    borderColor: '#d97706',
  },
  filterChipHotActive: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  loadingBox: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    color: '#059669',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 32,
    alignItems: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    gap: 10,
  },
  emptyTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
    marginTop: 6,
  },
  emptySub: {
    color: '#64748b',
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 19,
    paddingHorizontal: 12,
  },
  emptyAddBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
    marginTop: 6,
  },
  emptyAddBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardAuthorWrap: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  cardAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ecfdf5',
  },
  cardAvatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  cardAvatarLetter: {
    fontSize: 13,
    fontWeight: '900',
    color: '#047857',
  },
  authorNameCol: {
    alignItems: 'flex-end',
  },
  authorNameRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  authorNameText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#1e293b',
  },
  timeLabelText: {
    fontSize: 10.5,
    color: '#94a3b8',
    marginTop: 1,
  },
  solvedBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fde68a',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  solvedBadgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#92400e',
  },
  questionTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'right',
    lineHeight: 22,
    marginBottom: 6,
  },
  questionBody: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'right',
    lineHeight: 20,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: '#f8fafc',
    paddingTop: 10,
  },
  metaPillsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  metaPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  metaPillText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
  },
  cardCtaRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  cardCtaText: {
    color: '#059669',
    fontSize: 11.5,
    fontWeight: '800',
  },
});
