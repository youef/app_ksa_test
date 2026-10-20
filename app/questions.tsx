import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Sparkles, SlidersHorizontal } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import AppHeader from '@/components/shared/AppHeader';
import QuestionFilterSheet from '@/components/QuestionFilterSheet';
import { DEFAULT_QUESTION_FILTERS, filterQuestions, type QuestionFilters } from '@/lib/questionFilters';
import LocationScopeBar from '@/components/LocationScopeBar';
import TwitterInquiryCard from '@/components/TwitterInquiryCard';
import { getActiveLocation, subscribeLocation, isLocationMatching, type HaynaLocation } from '@/lib/locationSync';
import { useBottomNavInset } from '@/lib/bottomNav';

export default function Questions() {
  const bottomNavInset = useBottomNavInset();
  const [items, setItems] = useState<any[]>([]);
  const [visibleCount, setVisibleCount] = useState(10);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [sortBy, setSortBy] = useState<'newest' | 'engaged' | 'nearby'>('newest');
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<QuestionFilters>(DEFAULT_QUESTION_FILTERS);
  const [draftFilters, setDraftFilters] = useState<QuestionFilters>(DEFAULT_QUESTION_FILTERS);
  const [queryLimit, setQueryLimit] = useState(80);
  const [hasMore, setHasMore] = useState(false);
  const [activeLoc, setActiveLoc] = useState<HaynaLocation>({
    region: 'كل المملكة',
    city: 'كل المدن',
    district: 'كل الأحياء',
  });

  const loadQuestions = useCallback(async (location: HaynaLocation = activeLoc) => {
    setLoading(true);
    setLoadError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user ?? null;
      setCurrentUserId(user?.id ?? null);

      if (user) {
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('id, display_name, username, avatar_url, is_geoverified, is_verified, role, district, city')
          .eq('id', user.id)
          .maybeSingle();
        setProfile(userProfile ?? null);
      } else {
        setProfile(null);
      }

      let questions: any[] = [];
      const result = user
        ? await supabase.from('questions').select('*').order('created_at', { ascending: false }).limit(queryLimit)
        : await supabase.rpc('hayna_guest_questions', { p_city: location.city, p_district: location.district, p_limit: queryLimit });
      if (result.error) throw result.error;
      questions = result.data ?? [];
      setHasMore(questions.length >= queryLimit);

      if (questions.length) {
        const authorIds = Array.from(new Set(questions.map(q => q.author_id).filter(Boolean)));
        const questionIds = questions.map(q => q.id);
        const [profilesResult, answersResult] = await Promise.all([
          authorIds.length
            ? supabase.from('profiles')
                .select('id, display_name, username, avatar_url, is_geoverified, is_verified, hide_name')
                .in('id', authorIds)
            : Promise.resolve({ data: [] } as any),
          supabase.from('answers')
            .select('id, question_id, author_id, body, created_at')
            .in('question_id', questionIds)
            .order('created_at', { ascending: true }),
        ]);

        const profileMap = (profilesResult.data ?? []).reduce((map: any, row: any) => {
          map[row.id] = row;
          return map;
        }, {});
        const answersByQuestion = (answersResult.data ?? []).reduce((map: any, answer: any) => {
          (map[answer.question_id] ||= []).push(answer);
          return map;
        }, {});

        questions = questions.map(question => {
          const answers = answersByQuestion[question.id] ?? [];
          return {
            ...question,
            profiles: profileMap[question.author_id] ?? null,
            answers,
            answers_count: answers.length,
          };
        });
      }

      questions = questions
        .filter(question => isLocationMatching(question, location.city, location.district))
        .sort((a, b) => {
          const pinned = Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned));
          if (pinned) return pinned;
          const featured = Number(Boolean(b.is_featured)) - Number(Boolean(a.is_featured));
          if (featured) return featured;
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        });
      setItems(questions);
      setVisibleCount(10);
    } catch (error: any) {
      console.warn('Load questions error', error);
      setLoadError('تعذر تحميل الاستفسارات حالياً. حاول التحديث مرة أخرى.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeLoc, queryLimit]);

  const activeLocRef = useRef(activeLoc);
  activeLocRef.current = activeLoc;
  const loadRef = useRef(loadQuestions);
  loadRef.current = loadQuestions;

  useEffect(() => {
    let active = true;
    void getActiveLocation().then(location => {
      if (!active) return;
      setActiveLoc(location);
      void loadQuestions(location);
    });
    const unsubscribeLocation = subscribeLocation(location => {
      setActiveLoc(location);
      void loadQuestions(location);
    });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setCurrentUserId(session?.user?.id ?? null);
      setTimeout(() => { if (active) void loadRef.current(activeLocRef.current); }, 0);
    });
    return () => {
      active = false;
      unsubscribeLocation();
      authListener.subscription.unsubscribe();
    };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadQuestions(activeLoc);
  }, [activeLoc, loadQuestions]);

  // Keep the questions screen fresh without requiring a manual page reload.
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refreshSoon = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (!disposed) void loadQuestions(activeLoc);
      }, 900);
    };
    const channel = supabase
      .channel(`questions-live-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'questions' }, refreshSoon)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'answers' }, refreshSoon);
    channel.subscribe();
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [activeLoc, loadQuestions]);

  const onQuickReply = useCallback(async (questionId: string, text: string) => {
    const body = text.trim();
    if (!body) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) {
      Alert.alert('تسجيل الدخول مطلوب', 'سجّل الدخول لتتمكن من الرد على استفسارات الجيران.');
      return;
    }
    const { error } = await supabase.from('answers').insert({
      question_id: questionId,
      author_id: user.id,
      body,
    });
    if (error) {
      Alert.alert('تعذر إرسال الرد', error.message || 'حاول مرة أخرى.');
      return;
    }
    await loadQuestions(activeLoc);
    Alert.alert('تم بنجاح', 'تم نشر ردك في النقاش.');
  }, [activeLoc, loadQuestions]);

  const showToast = useCallback((message: string) => {
    Alert.alert('حيّنا', message);
  }, []);

  const filteredItems = useMemo(() => filterQuestions(items, filters, currentUserId, sortBy, activeLoc.district), [items, filters, currentUserId, sortBy, activeLoc.district]);
  const filtersActive = Object.keys(DEFAULT_QUESTION_FILTERS).some(key => filters[key as keyof QuestionFilters] !== DEFAULT_QUESTION_FILTERS[key as keyof QuestionFilters]);
  useEffect(() => { setVisibleCount(10); }, [filters, sortBy]);
  useEffect(() => { if (queryLimit > 80) void loadQuestions(activeLoc); }, [queryLimit]);

  return (
    <View style={styles.container}>
      <AppHeader
        variant="sub"
        title="استفسارات الجيران"
        fallbackRoute="/home"

      />

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.feedContent, { paddingBottom: bottomNavInset + 24 }]}
        onMomentumScrollEnd={({ nativeEvent }) => {
          const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
          const nearBottom = contentOffset.y + layoutMeasurement.height >= contentSize.height - 180;
          if (nearBottom && visibleCount < filteredItems.length) {
            setVisibleCount(current => Math.min(current + 10, filteredItems.length));
          }
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#059669"
            colors={['#059669']}
            progressBackgroundColor="#ecfdf5"
          />
        }
      >
        <LocationScopeBar location={activeLoc} />
        <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', alignItems: 'center', gap: 7, marginTop: 8, marginBottom: 12 }}>
          {([['newest', 'الأحدث'], ['engaged', 'الأكثر تفاعلاً'], ['nearby', 'الأقرب']] as const).map(([key, label]) => (
            <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: sortBy === key }} onPress={() => setSortBy(key)} style={{ paddingHorizontal: 13, paddingVertical: 8, borderRadius: 18, backgroundColor: sortBy === key ? '#176b52' : '#ffffff', borderWidth: 1, borderColor: sortBy === key ? '#176b52' : '#dbe5df' }}>
              <Text style={{ color: sortBy === key ? '#ffffff' : '#475569', fontSize: 12, fontWeight: '800' }}>{label}</Text>
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" accessibilityLabel="تصفية المنشورات" onPress={() => { setDraftFilters(filters); setFilterOpen(true); }} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 9, borderRadius: 14, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#b7d8c8' }}>
            {filtersActive && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#176b52' }} />}
            <SlidersHorizontal size={15} color='#176b52' />
            <Text style={{ color: '#176b52', fontSize: 12, fontWeight: '900' }}>تصفية</Text>
          </Pressable>
        </View>
        {loading && items.length === 0 ? (
          <View style={styles.stateBox}>
            <ActivityIndicator size="large" color="#16845f" />
            <Text style={styles.stateText}>جاري تحميل استفسارات الجيران...</Text>
          </View>
        ) : loadError ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateTitle}>{loadError}</Text>
            <Text onPress={() => void loadQuestions(activeLoc)} style={styles.retryText}>إعادة المحاولة</Text>
          </View>
        ) : filteredItems.length === 0 ? (
          <View style={styles.stateBox}>
            <View style={styles.emptyIcon}>
              <Sparkles size={28} color="#16845f" />
            </View>
            <Text style={styles.stateTitle}>{filtersActive ? 'لا توجد نتائج تطابق التصفية' : 'كن أول من يبدأ النقاش'}</Text>
            <Text style={styles.stateText}>{filtersActive ? 'جرّب تغيير الخيارات أو مسح التصفية.' : 'شارك استفسارك مع جيرانك.'}</Text>
            {filtersActive && <Pressable accessibilityRole="button" onPress={() => setFilters(DEFAULT_QUESTION_FILTERS)}><Text style={styles.askLink}>مسح التصفية</Text></Pressable>}
            <Text onPress={() => router.push('/ask')} style={styles.askLink}>+ اطرح استفسارك</Text>
          </View>
        ) : (
          <View style={styles.posts}>
            {filteredItems.slice(0, visibleCount).map(question => (
              <TwitterInquiryCard
                key={String(question.id)}
                type="question"
                data={question}
                currentUserProfile={profile}
                currentUserId={currentUserId}
                isGuest={!currentUserId}
                onQuickReply={onQuickReply}
                onToast={showToast}
                onDeleted={() => { void loadQuestions(activeLoc); }}
              />
            ))}
            {visibleCount < filteredItems.length && (
              <View style={styles.moreLoading}>
                <ActivityIndicator size="small" color="#16845f" />
                <Text style={styles.moreLoadingText}>اسحب للأسفل لعرض المزيد</Text>
              </View>
            )}
          </View>
        )}
        {hasMore && <Pressable disabled={loading} accessibilityRole="button" onPress={() => setQueryLimit(limit => limit + 80)} style={styles.moreLoading}><Text style={styles.askLink}>{loading ? 'جارٍ التحميل...' : 'تحميل منشورات أقدم'}</Text></Pressable>}
      </ScrollView>

      <QuestionFilterSheet visible={filterOpen} value={draftFilters} isMember={Boolean(currentUserId)} onChange={setDraftFilters} onClose={() => setFilterOpen(false)} onApply={() => { setFilters(draftFilters); setFilterOpen(false); }} onReset={() => { setFilters(DEFAULT_QUESTION_FILTERS); setDraftFilters(DEFAULT_QUESTION_FILTERS); setFilterOpen(false); }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f7f5',
  },
  feedContent: {
    flexGrow: 1,
    width: '100%', maxWidth: 760, alignSelf: 'center',
    paddingTop: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f4f7f5',
  },
  locationButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eaf7ef',
    borderWidth: 1,
    borderColor: '#d8eee0',
  },
  posts: {
    backgroundColor: 'transparent',
  },
  moreLoading: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 18,
  },
  moreLoadingText: {
    color: '#728178',
    fontSize: 12,
    fontWeight: '600',
  },
  stateBox: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 28,
    paddingVertical: 44,
    marginHorizontal: 2,
    borderRadius: 22,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e0ebe4',
  },
  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e6f5ec',
  },
  stateTitle: {
    color: '#17382c',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'center',
  },
  stateText: {
    color: '#728178',
    fontSize: 12,
    lineHeight: 20,
    textAlign: 'center',
  },
  retryText: {
    color: '#087f5b',
    fontSize: 13,
    fontWeight: '900',
    padding: 8,
  },
  askLink: {
    color: '#087f5b',
    fontSize: 13,
    fontWeight: '900',
    padding: 8,
  },
});
