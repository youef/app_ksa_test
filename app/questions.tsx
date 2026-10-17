import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Share,
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
  Pin,
  TrendingUp,
  Bookmark,
  BookmarkCheck,
  Share2,
} from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import { AppHeader } from '@/components/shared/AppHeader';
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
import { requireAccount } from '@/lib/authGate';

type QuestionFilter = 'all' | 'solved' | 'hot' | 'district';
type QuestionSort = 'newest' | 'answers';

export default function Questions() {
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [savedQuestionIds, setSavedQuestionIds] = useState<Set<string>>(new Set());
  const [savingQuestionId, setSavingQuestionId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');
  const [activeFilter, setActiveFilter] = useState<QuestionFilter>('all');
  const [activeSort, setActiveSort] = useState<QuestionSort>('newest');
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
      setCurrentUserId(user?.id ?? null);

      let fetchedQuestions: any[] = [];
      let query = supabase
        .from('questions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(80);

      if (q.trim()) {
        query = query.or(`title.ilike.%${q.trim()}%,body.ilike.%${q.trim()}%`);
      }

      const { data, error } = await query;
      if (!error && data) {
        fetchedQuestions = data;
      } else {
        // Fallback for guests or specific RLS configurations
        const result = await supabase.rpc('hayna_guest_questions', {
          p_city: location.city,
          p_district: location.district,
          p_limit: 60,
        });
        const searchTerm = q.trim().toLocaleLowerCase('ar');
        fetchedQuestions = (result.data ?? []).filter((item: any) =>
          !searchTerm || `${item.title} ${item.body}`.toLocaleLowerCase('ar').includes(searchTerm)
        );
      }

      // Fetch authors profiles and answer counts
      if (fetchedQuestions.length > 0) {
        const authorIds = Array.from(new Set(fetchedQuestions.map(x => x.author_id).filter(Boolean)));
        const qIds = fetchedQuestions.map(x => x.id);

        const [profilesRes, answersRes, favoritesRes] = await Promise.all([
          authorIds.length > 0
            ? supabase.from('profiles').select('id, display_name, username, avatar_url, is_geoverified, is_verified, district').in('id', authorIds)
            : Promise.resolve({ data: [] }),
          supabase.from('answers').select('id, question_id').in('question_id', qIds),
          user
            ? supabase.from('favorite_items').select('target_id').eq('user_id', user.id).eq('target_type', 'question').in('target_id', qIds)
            : Promise.resolve({ data: [] }),
        ]);

        setSavedQuestionIds(new Set((favoritesRes.data || []).map((favorite: any) => favorite.target_id)));

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

      fetchedQuestions.sort((a: any, b: any) => {
        const pinPriority = Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned));
        if (pinPriority !== 0) return pinPriority;
        const featuredPriority = Number(Boolean(b.is_featured)) - Number(Boolean(a.is_featured));
        if (featuredPriority !== 0) return featuredPriority;
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      });
      if (fetchedQuestions.length === 0) setSavedQuestionIds(new Set());
      setItems(fetchedQuestions);
    } catch (e: any) {
      console.warn('Load questions error', e);
      setLoadError('تعذر تحميل الأسئلة. حاول مرة أخرى.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setHasSession(Boolean(data.session?.user)));
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(Boolean(session?.user));
      setCurrentUserId(session?.user?.id ?? null);
      if (session?.user) void load(search, activeLoc);
      else setSavedQuestionIds(new Set());
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
    return items.filter(q => isLocationMatching(q, activeLoc.city, activeLoc.district));
  }, [items, activeLoc]);

  // Tab Filtering
  const displayedItems = useMemo(() => {
    const filtered = locationFilteredItems.filter(q => {
      if (activeFilter === 'solved') return q.status === 'solved' || Boolean(q.best_answer_id);
      if (activeFilter === 'hot') return (q.answers_count || 0) >= 2;
      if (activeFilter === 'district') return Boolean(q.district);
      return true;
    });
    return [...filtered].sort((a: any, b: any) => {
      const pin = Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned));
      if (pin) return pin;
      const featured = Number(Boolean(b.is_featured)) - Number(Boolean(a.is_featured));
      if (featured) return featured;
      if (activeSort === 'answers') return (b.answers_count || 0) - (a.answers_count || 0);
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
  }, [locationFilteredItems, activeFilter, activeSort]);

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

  async function toggleSavedQuestion(questionId: string) {
    if (!currentUserId) return requireAccount('سجّل الدخول لحفظ الاستفسار والرجوع إليه لاحقاً.');
    if (savingQuestionId) return;
    const wasSaved = savedQuestionIds.has(questionId);
    setSavingQuestionId(questionId);
    try {
      if (wasSaved) {
        const { error } = await supabase.from('favorite_items').delete().eq('user_id', currentUserId).eq('target_type', 'question').eq('target_id', questionId);
        if (error) throw error;
        setSavedQuestionIds(previous => {
          const next = new Set(previous);
          next.delete(questionId);
          return next;
        });
      } else {
        const { error } = await supabase.from('favorite_items').insert({ user_id: currentUserId, target_type: 'question', target_id: questionId });
        if (error) throw error;
        setSavedQuestionIds(previous => new Set(previous).add(questionId));
      }
    } catch {
      Alert.alert('تعذر الحفظ', 'لم نتمكن من تحديث قائمة المحفوظات. حاول مجدداً.');
    } finally {
      setSavingQuestionId(null);
    }
  }

  async function shareQuestion(question: any) {
    const link = `https://appksatest.vercel.app/question?id=${encodeURIComponent(String(question.id))}`;
    try {
      await Share.share({ message: `${question.title || 'استفسار من حيّنا'}\n\n${question.body || ''}\n\nشارك في النقاش عبر حيّنا: ${link}` });
    } catch {
      Alert.alert('تعذر المشاركة', 'لم نتمكن من فتح خيارات المشاركة الآن.');
    }
  }

  const onSelectLocation = async (region: string, city: string, district: string) => {
    const loc: HaynaLocation = { region, city, district };
    await savePermanentMyLocation(loc, true);
    setActiveLoc(loc);
    setShowLocationModal(false);
    load(search, loc);
  };

  return (
    <View style={styles.container}>
      <AppHeader
        variant="sub"
        title="استفسارات الحي"
        subtitle={locationLabel}
        fallbackRoute="/home"
        rightAction={
          hasSession ? (
            <Pressable
              onPress={() => router.push('/ask')}
              style={{
                flexDirection: 'row-reverse',
                alignItems: 'center',
                gap: 4,
                backgroundColor: '#ecfdf5',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 16,
                borderWidth: 1,
                borderColor: '#a7f3d0',
              }}
              accessibilityRole="button"
              accessibilityLabel="اسأل جارك"
            >
              <Plus size={14} color="#059669" />
              <Text style={{ fontSize: 12, fontWeight: '800', color: '#059669' }}>اسأل جارك</Text>
            </Pressable>
          ) : undefined
        }
      />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 24 }]}
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
        <View style={styles.introWrap}>
          <LinearGradient colors={['#075b43', '#0b8f63', '#22a06b']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.introCard}>
            <View style={styles.introDecorOne} /><View style={styles.introDecorTwo} />
            <View style={styles.introTopRow}>
              <View style={styles.introIcon}><MessageCircle size={22} color="#ffffff" /></View>
              <View style={{ flex: 1 }}><Text style={styles.introEyebrow}>مجتمع حيّنا</Text><Text style={styles.introTitle}>سؤالك يقرّب الجيران</Text></View>
              <View style={styles.livePill}><View style={styles.liveDot} /><Text style={styles.liveText}>مجتمع نشط</Text></View>
            </View>
            <Text style={styles.introDescription}>اسأل، شارك خبرتك، واستفد من تجارب أهل الحي.</Text>
            <View style={styles.introStats}>
              <View style={styles.introStat}><Text style={styles.introStatValue}>{counts.all.toLocaleString('ar-SA')}</Text><Text style={styles.introStatLabel}>استفسار</Text></View>
              <View style={styles.introStatDivider} />
              <View style={styles.introStat}><Text style={styles.introStatValue}>{counts.solved.toLocaleString('ar-SA')}</Text><Text style={styles.introStatLabel}>تمت الإجابة</Text></View>
              <View style={styles.introStatDivider} />
              <View style={styles.introStat}><Text style={styles.introStatValue}>{counts.hot.toLocaleString('ar-SA')}</Text><Text style={styles.introStatLabel}>تفاعل نشط</Text></View>
            </View>
            {hasSession && <Pressable style={styles.introCta} onPress={() => router.push('/ask')}><Plus size={17} color="#08734f" /><Text style={styles.introCtaText}>اطرح استفسارك الآن</Text><ArrowRight size={15} color="#08734f" /></Pressable>}
          </LinearGradient>
          <Pressable style={styles.locationBar} onPress={() => setShowLocationModal(true)} accessibilityRole="button" accessibilityLabel="تغيير نطاق الأسئلة">
            <View style={styles.locationIcon}><MapPin size={17} color="#087f5b" /></View>
            <View style={{ flex: 1 }}><Text style={styles.locationEyebrow}>تتصفح الأسئلة في</Text><Text style={styles.locationValue} numberOfLines={1}>{locationLabel}</Text></View>
            <View style={styles.changeLocation}><Text style={styles.changeLocationText}>تغيير</Text><ChevronDown size={14} color="#087f5b" /></View>
          </Pressable>
        </View>

        {/* Search & Location Bar */}
        <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 }}>
          <View style={[styles.searchBar, { borderWidth: 1, borderColor: '#e2e8f0' }]}>
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
        </View>

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

        <View style={styles.listToolbar}>
          <View style={styles.listHeading}><Text style={styles.listTitle}>أسئلة الجيران</Text><Text style={styles.listCount}>{displayedItems.length.toLocaleString('ar-SA')} نتيجة</Text></View>
          <View style={styles.sortSwitch}>
            <Pressable onPress={() => setActiveSort('newest')} style={[styles.sortOption, activeSort === 'newest' && styles.sortOptionActive]}><Clock size={13} color={activeSort === 'newest' ? '#087f5b' : '#84918a'} /><Text style={[styles.sortOptionText, activeSort === 'newest' && styles.sortOptionTextActive]}>الأحدث</Text></Pressable>
            <Pressable onPress={() => setActiveSort('answers')} style={[styles.sortOption, activeSort === 'answers' && styles.sortOptionActive]}><TrendingUp size={13} color={activeSort === 'answers' ? '#087f5b' : '#84918a'} /><Text style={[styles.sortOptionText, activeSort === 'answers' && styles.sortOptionTextActive]}>الأكثر ردودًا</Text></Pressable>
          </View>
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
              {!isAllKingdom(activeLoc.city) && activeLoc.district !== 'كل الأحياء' && (
                <Pressable
                  style={[styles.emptyAddBtn, { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#86efac', marginTop: 10 }]}
                  onPress={() => onSelectLocation(activeLoc.region, activeLoc.city, 'كل الأحياء')}
                >
                  <MapPin size={16} color="#059669" />
                  <Text style={[styles.emptyAddBtnText, { color: '#059669' }]}>
                    عرض أسئلة كل أحياء {activeLoc.city}
                  </Text>
                </Pressable>
              )}
              {!isAllKingdom(activeLoc.city) && (
                <Pressable
                  style={[styles.emptyAddBtn, { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', marginTop: 8 }]}
                  onPress={() => onSelectLocation('كل المملكة', 'كل المدن', 'كل الأحياء')}
                >
                  <Text style={[styles.emptyAddBtnText, { color: '#475569' }]}>
                    عرض كل مناطق المملكة 🇸🇦
                  </Text>
                </Pressable>
              )}
              <Pressable style={[styles.emptyAddBtn, { marginTop: 10 }]} onPress={() => router.push('/ask')}>
                <Plus size={18} color="#fff" />
                <Text style={styles.emptyAddBtnText}>طرح سؤال جديد</Text>
              </Pressable>
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

                  {Boolean(q.is_pinned || q.is_featured) && <View style={styles.cardFlagsRow}>{Boolean(q.is_pinned) && <View style={styles.pinnedBadge}><Pin size={11} color="#8a5a0a" /><Text style={styles.pinnedBadgeText}>مثبّت</Text></View>}{Boolean(q.is_featured) && <View style={styles.featuredBadge}><Sparkles size={11} color="#047857" /><Text style={styles.featuredBadgeText}>مميّز</Text></View>}</View>}

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

                    <View style={styles.cardActionsRow}>
                      <Pressable style={[styles.socialAction, savedQuestionIds.has(q.id) && styles.socialActionSaved]} onPress={() => void toggleSavedQuestion(q.id)} accessibilityRole="button" accessibilityLabel={savedQuestionIds.has(q.id) ? 'إزالة من المحفوظات' : 'حفظ السؤال'} hitSlop={6}>
                        {savedQuestionIds.has(q.id) ? <BookmarkCheck size={15} color="#087f5b" /> : <Bookmark size={15} color="#64748b" />}
                        <Text style={[styles.socialActionText, savedQuestionIds.has(q.id) && styles.socialActionTextSaved]}>{savingQuestionId === q.id ? 'جارٍ الحفظ' : savedQuestionIds.has(q.id) ? 'محفوظ' : 'حفظ'}</Text>
                      </Pressable>
                      <Pressable style={styles.socialAction} onPress={() => void shareQuestion(q)} accessibilityRole="button" accessibilityLabel="مشاركة السؤال" hitSlop={6}>
                        <Share2 size={15} color="#64748b" />
                        <Text style={styles.socialActionText}>مشاركة</Text>
                      </Pressable>
                      <View style={styles.cardCtaRow}>
                        <Text style={styles.cardCtaText}>شارك برأيك</Text>
                        <ArrowRight size={13} color="#059669" />
                      </View>
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
        selectedCity={activeLoc.city}
        selectedDistrict={activeLoc.district}
        onSelect={onSelectLocation}
        onClose={() => setShowLocationModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f7f5',
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
  introWrap: { paddingHorizontal: 16, paddingTop: 10, gap: 10 },
  introCard: { borderRadius: 26, padding: 18, overflow: 'hidden', gap: 13, shadowColor: '#064e3b', shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.14, shadowRadius: 16, elevation: 4 },
  introDecorOne: { position: 'absolute', width: 170, height: 170, borderRadius: 85, backgroundColor: 'rgba(255,255,255,0.07)', top: -95, right: -45 },
  introDecorTwo: { position: 'absolute', width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.05)', bottom: -75, left: -28 },
  introTopRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  introIcon: { width: 43, height: 43, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  introEyebrow: { color: '#c6f5dc', textAlign: 'right', fontSize: 10.5, fontWeight: '800', marginBottom: 3 },
  introTitle: { color: '#ffffff', textAlign: 'right', fontSize: 19, fontWeight: '900', letterSpacing: -0.3 },
  livePill: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.13)' },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#86efac' },
  liveText: { color: '#e7fff1', fontSize: 9.5, fontWeight: '800' },
  introDescription: { color: '#e0f8eb', textAlign: 'right', fontSize: 12.5, lineHeight: 19 },
  introStats: { flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 5, borderRadius: 17, backgroundColor: 'rgba(0,45,32,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  introStat: { flex: 1, alignItems: 'center', gap: 3 },
  introStatValue: { color: '#ffffff', fontSize: 19, fontWeight: '900', fontVariant: ['tabular-nums'] },
  introStatLabel: { color: '#d1fae5', fontSize: 10, fontWeight: '700' },
  introStatDivider: { width: 1, height: 31, backgroundColor: 'rgba(255,255,255,0.2)' },
  introCta: { minHeight: 43, borderRadius: 14, backgroundColor: '#ffffff', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12 },
  introCtaText: { color: '#08734f', fontSize: 12.5, fontWeight: '900' },
  locationBar: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, padding: 12, borderRadius: 18, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#e1ebe5' },
  locationIcon: { width: 37, height: 37, borderRadius: 13, backgroundColor: '#eaf8f0', alignItems: 'center', justifyContent: 'center' },
  locationEyebrow: { textAlign: 'right', color: '#87958d', fontSize: 10, fontWeight: '700' },
  locationValue: { textAlign: 'right', color: '#17382c', fontSize: 12.5, fontWeight: '900', marginTop: 2 },
  changeLocation: { flexDirection: 'row-reverse', alignItems: 'center', gap: 3, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 10, backgroundColor: '#f0faf4' },
  changeLocationText: { color: '#087f5b', fontSize: 11, fontWeight: '900' },
  listToolbar: { marginHorizontal: 18, marginTop: 10, marginBottom: 4, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  listHeading: { flexDirection: 'row-reverse', alignItems: 'baseline', gap: 7 },
  listTitle: { color: '#17382c', fontSize: 15, fontWeight: '900' },
  listCount: { color: '#84918a', fontSize: 10.5, fontWeight: '700' },
  sortSwitch: { flexDirection: 'row-reverse', padding: 3, borderRadius: 12, backgroundColor: '#e9efeb', gap: 2 },
  sortOption: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 9 },
  sortOptionActive: { backgroundColor: '#ffffff', shadowColor: '#164e3b', shadowOpacity: 0.06, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  sortOptionText: { color: '#84918a', fontSize: 10.5, fontWeight: '700' },
  sortOptionTextActive: { color: '#087f5b', fontWeight: '900' },
  cardFlagsRow: { flexDirection: 'row-reverse', gap: 6, marginBottom: 8 },
  pinnedBadge: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 9, backgroundColor: '#fff7df', borderWidth: 1, borderColor: '#f4e2af' },
  pinnedBadgeText: { color: '#8a5a0a', fontSize: 10, fontWeight: '900' },
  featuredBadge: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 9, backgroundColor: '#eaf8f0', borderWidth: 1, borderColor: '#c8ead7' },
  featuredBadgeText: { color: '#047857', fontSize: 10, fontWeight: '900' },
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
    borderRadius: 22,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e8efea',
    shadowColor: '#164e3b',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.045,
    shadowRadius: 9,
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
  cardActionsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  socialAction: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
    paddingHorizontal: 3,
  },
  socialActionSaved: {
    backgroundColor: '#ecfdf5',
    borderRadius: 9,
    paddingHorizontal: 8,
  },
  socialActionText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '800',
  },
  socialActionTextSaved: {
    color: '#087f5b',
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
