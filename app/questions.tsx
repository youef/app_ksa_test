import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { Plus, Search, SlidersHorizontal, X } from 'lucide-react-native';
import { OasisEmptyIllustration } from '@/components/oasis/OasisEmptyIllustration';
import { OasisPressable as Pressable, OasisTextInput as TextInput } from '@/components/oasis/OasisPrimitives';
import { useTheme } from '@/context/ThemeContext';
import { useDynamicIsland } from '@/context/DynamicIslandContext';
import { supabase } from '@/lib/supabase';
import AppHeader, { HeaderAction } from '@/components/shared/AppHeader';
import QuestionFilterSheet from '@/components/QuestionFilterSheet';
import { DEFAULT_QUESTION_FILTERS, filterQuestions, type QuestionFilters } from '@/lib/questionFilters';
import LocationScopeBar from '@/components/LocationScopeBar';
import TwitterInquiryCard from '@/components/TwitterInquiryCard';
import { getActiveLocation, subscribeLocation, isLocationMatching, type HaynaLocation } from '@/lib/locationSync';
import { useBottomNavInset } from '@/lib/bottomNav';

const QuestionCard = memo(TwitterInquiryCard);
const PAGE_SIZE = 80;
const SORT_OPTIONS = [['newest', 'الأحدث'], ['engaged', 'الأكثر تفاعلاً'], ['nearby', 'الأقرب']] as const;
const DEFAULT_LOCATION = { region: 'كل المملكة', city: 'كل المدن', district: 'كل الأحياء' };

function normalizeSearch(text: string) {
  return text.normalize('NFKC').replace(/[\u0640\u064B-\u065F\u0670]/g, '').replace(/[أإآٱ]/g, 'ا').toLowerCase().trim();
}

function mergeAnswers(answers: any[], incoming: any[]) {
  const byId = new Map(answers.map(answer => [answer.id, answer]));
  for (const answer of incoming) if (!byId.has(answer.id)) byId.set(answer.id, answer);
  return Array.from(byId.values());
}

export default function Questions() {
  const { colors } = useTheme();
  const { showIsland } = useDynamicIsland();
  const bottomNavInset = useBottomNavInset();
  const focused = useIsFocused();
  const [feed, setFeed] = useState<{ key: string; items: any[] }>({ key: '', items: [] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null | undefined>(undefined);
  const [profile, setProfile] = useState<any>(null);
  const [sortBy, setSortBy] = useState<(typeof SORT_OPTIONS)[number][0]>('newest');
  const [search, setSearch] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<QuestionFilters>(DEFAULT_QUESTION_FILTERS);
  const [draftFilters, setDraftFilters] = useState<QuestionFilters>(DEFAULT_QUESTION_FILTERS);
  const [queryLimit, setQueryLimit] = useState(PAGE_SIZE);
  const [hasMore, setHasMore] = useState(false);
  const [location, setLocation] = useState<HaynaLocation | null>(null);
  const activeLoc = location ?? DEFAULT_LOCATION;
  const ready = location !== null && currentUserId !== undefined;
  const scopeKey = ready ? JSON.stringify([currentUserId, activeLoc.region, activeLoc.city, activeLoc.district]) : '';
  const items = feed.key === scopeKey ? feed.items : [];
  const request = useRef(0);
  const inFlight = useRef(false);
  const questionIds = useRef('');
  const visibleIds = useRef(new Set<string>());
  const liveAnswers = useRef(new Map<string, any>());

  useEffect(() => {
    let active = true;
    const acceptLocation = (next: HaynaLocation) => {
      if (active) setLocation(previous => previous && previous.region === next.region && previous.city === next.city && previous.district === next.district ? previous : next);
    };
    const unsubscribeLocation = subscribeLocation(acceptLocation);
    void getActiveLocation().then(acceptLocation, () => acceptLocation(DEFAULT_LOCATION));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setCurrentUserId(session?.user.id ?? null);
    });
    return () => {
      active = false;
      unsubscribeLocation();
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!currentUserId) return;
    let active = true;
    void supabase.from('profiles').select('id, role').eq('id', currentUserId).maybeSingle().then(({ data }) => {
      if (active) setProfile(data);
    });
    return () => { active = false; };
  }, [currentUserId]);

  const loadQuestions = useCallback(async (mode: 'load' | 'refresh' | 'live' | 'poll' = 'load') => {
    if (!scopeKey || (mode === 'poll' && inFlight.current)) return;
    const version = ++request.current;
    inFlight.current = true;
    if (mode === 'load') { setLoading(true); setLoadError(''); }
    if (mode === 'refresh') setRefreshing(true);
    try {
      const result = currentUserId
        ? await supabase.from('questions').select('*').order('created_at', { ascending: false }).limit(queryLimit)
        : await supabase.rpc('hayna_guest_questions', { p_city: activeLoc.city, p_district: activeLoc.district, p_limit: queryLimit });
      if (version !== request.current) return;
      if (result.error) throw result.error;
      const rows = result.data ?? [];
      const questions: any[] = rows.filter((row: any) => isLocationMatching(row, activeLoc.city, activeLoc.district));
      const ids = questions.map(row => row.id);
      const pageIds = ids.join(',');
      if (mode === 'poll' && questionIds.current === pageIds) return;
      questionIds.current = pageIds;
      visibleIds.current = new Set(ids);
      setHasMore(rows.length >= queryLimit);
      setFeed(previous => {
        const existing = new Map((previous.key === scopeKey ? previous.items : []).map(row => [row.id, row]));
        return { key: scopeKey, items: questions.map(row => {
          const old = existing.get(row.id);
          return { ...old, ...row, profiles: old?.profiles, answers: old?.answers, answers_count: old?.answers_count ?? row.answers_count };
        }) };
      });
      setLoadError('');
      setLoading(false);
      setRefreshing(false);
      if (!ids.length) return;

      const authors = Array.from(new Set(questions.map(row => row.author_id).filter(Boolean)));
      const [profiles, replies] = await Promise.all([
        authors.length ? supabase.from('profiles').select('id, display_name, username, avatar_url, is_geoverified, is_verified, hide_name').in('id', authors) : { data: [] },
        supabase.from('answers').select('id, question_id, author_id, body, created_at').in('question_id', ids).order('created_at'),
      ]);
      if (version !== request.current) return;
      const profilesById = new Map((profiles.data ?? []).map(row => [row.id, row]));
      const repliesByQuestion = new Map<string, any[]>();
      for (const reply of [...(replies.data ?? []), ...liveAnswers.current.values()]) {
        const group = repliesByQuestion.get(reply.question_id) ?? [];
        group.push(reply);
        repliesByQuestion.set(reply.question_id, group);
      }
      for (const reply of replies.data ?? []) liveAnswers.current.delete(reply.id);
      setFeed(previous => previous.key === scopeKey ? { key: scopeKey, items: previous.items.map(row => {
        const answers = mergeAnswers(replies.error ? row.answers ?? [] : [], repliesByQuestion.get(row.id) ?? []);
        return { ...row, profiles: profilesById.get(row.author_id) ?? row.profiles, answers, answers_count: answers.length };
      }) } : previous);
    } catch {
      if (version === request.current && mode !== 'live' && mode !== 'poll') setLoadError('تعذّر تحميل الأسئلة. حاول مرة أخرى.');
    } finally {
      if (version === request.current) {
        inFlight.current = false;
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [activeLoc.city, activeLoc.district, currentUserId, queryLimit, scopeKey]);

  const loadRef = useRef(loadQuestions);
  loadRef.current = loadQuestions;

  useEffect(() => {
    inFlight.current = false;
    questionIds.current = '';
    visibleIds.current.clear();
    liveAnswers.current.clear();
    return () => { ++request.current; };
  }, [scopeKey]);

  useEffect(() => {
    void loadQuestions();
  }, [loadQuestions]);

  const wasAway = useRef(false);
  useEffect(() => {
    if (!focused) { wasAway.current = true; return; }
    if (!scopeKey) return;
    if (wasAway.current) {
      wasAway.current = false;
      void loadRef.current('live');
    }
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      void loadRef.current('poll');
    }, 10000);
    return () => clearInterval(timer);
  }, [focused, scopeKey]);

  const applyReply = useCallback((reply: any) => {
    if (!reply?.id || !visibleIds.current.has(reply.question_id)) return;
    liveAnswers.current.set(reply.id, reply);
    setFeed(previous => previous.key === scopeKey ? { ...previous, items: previous.items.map(row => {
      if (row.id !== reply.question_id || row.answers?.some((answer: any) => answer.id === reply.id)) return row;
      const answers = [...(row.answers ?? []), reply];
      return { ...row, answers, answers_count: Math.max(answers.length, Number(row.answers_count ?? 0) + 1) };
    }) } : previous);
  }, [scopeKey]);

  useEffect(() => {
    if (!scopeKey) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refreshSoon = () => {
      if (timer) return;
      timer = setTimeout(() => { timer = undefined; void loadRef.current('live'); }, 150);
    };
    let connectedBefore = false;
    const channel = supabase
      .channel('questions-live-' + Math.random().toString(36).slice(2))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'answers' }, ({ new: reply }) => applyReply(reply))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'answers' }, refreshSoon)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'answers' }, ({ old }) => {
        liveAnswers.current.delete(old.id);
        refreshSoon();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'questions' }, refreshSoon)
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'questions' }, ({ old }) => {
        if (!visibleIds.current.delete(old.id)) return;
        setFeed(previous => previous.key === scopeKey ? { ...previous, items: previous.items.filter(row => row.id !== old.id) } : previous);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'questions' }, ({ new: row }) => {
        if (!visibleIds.current.has(row.id)) return;
        setFeed(previous => previous.key === scopeKey ? { ...previous, items: previous.items.map(question => question.id === row.id
          ? { ...question, ...row, answers_count: question.answers_count ?? row.answers_count } : question) } : previous);
      })
      .subscribe(status => {
        if (status !== 'SUBSCRIBED') return;
        if (connectedBefore) refreshSoon();
        connectedBefore = true;
      });
    return () => {
      clearTimeout(timer);
      void supabase.removeChannel(channel);
    };
  }, [scopeKey, applyReply]);

  const onQuickReply = useCallback(async (questionId: string, text: string) => {
    const { data, error } = await supabase.rpc('hayna_create_question_answer', {
      p_question_id: questionId, p_body: text.trim(), p_parent_answer_id: null,
    });
    if (error) throw new Error('تعذّر إرسال الرد. حاول مرة أخرى.');
    applyReply(Array.isArray(data) ? data[0] : data);
  }, [applyReply]);

  const onDeleted = useCallback(() => { void loadRef.current('live'); }, []);
  const showToast = useCallback((message: string) => showIsland(message, undefined, 'success'), [showIsland]);
  const sortedItems = useMemo(() => filterQuestions(items, filters, currentUserId ?? null, sortBy, activeLoc.district), [items, filters, currentUserId, sortBy, activeLoc.district]);
  const needle = normalizeSearch(search);
  const filteredItems = useMemo(() => needle ? sortedItems.filter(row => normalizeSearch([row.title, row.body, row.category, row.district].join(' ')).includes(needle)) : sortedItems, [needle, sortedItems]);
  const filtersActive = Object.keys(DEFAULT_QUESTION_FILTERS).some(key => filters[key as keyof QuestionFilters] !== DEFAULT_QUESTION_FILTERS[key as keyof QuestionFilters]);
  const initialLoading = !ready || (!loadError && (feed.key !== scopeKey || (!items.length && loading)));
  const showOlder = ready && feed.key === scopeKey && hasMore;
  const renderQuestion = useCallback(({ item }: { item: any }) => (
    <QuestionCard type='question' data={item} currentUserProfile={profile?.id === currentUserId ? profile : null}
      currentUserId={currentUserId ?? null} isGuest={!currentUserId} onQuickReply={onQuickReply} onToast={showToast} onDeleted={onDeleted} />
  ), [currentUserId, profile, onQuickReply, showToast, onDeleted]);

  return (
    <View style={styles.container}>
      <AppHeader variant='sub' title='استفسارات الجيران' fallbackRoute='/home' rightAction={
        <HeaderAction accessibilityRole='button' accessibilityLabel='اطرح استفسارًا' onPress={() => router.push('/ask')}>
          <Plus size={20} color={colors.primary} />
        </HeaderAction>
      } />
      <FlatList
        data={filteredItems}
        keyExtractor={item => item.id}
        renderItem={renderQuestion}
        initialNumToRender={4}
        maxToRenderPerBatch={5}
        windowSize={7}
        refreshing={refreshing}
        onRefresh={() => void loadQuestions('refresh')}
        keyboardShouldPersistTaps='handled'
        contentContainerStyle={[styles.feed, { paddingBottom: bottomNavInset + 24 }]}
        ListHeaderComponent={(
          <View style={styles.toolbar}>
            <LocationScopeBar location={activeLoc} />
            <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.line }]}>
              <Search size={19} color={colors.muted} />
              <TextInput value={search} onChangeText={setSearch} accessibilityLabel='ابحث في الاستفسارات'
                placeholder='ابحث في الاستفسارات' returnKeyType='search' style={styles.searchInput} />
              {!!search && <Pressable oasisKind='plain' accessibilityRole='button' accessibilityLabel='مسح البحث' onPress={() => setSearch('')} style={styles.iconButton}><X size={17} color={colors.muted} /></Pressable>}
            </View>
            <View style={[styles.controls, { backgroundColor: colors.surface, borderColor: colors.line }]}>
              {SORT_OPTIONS.map(([key, label]) => (
                <Pressable key={key} oasisKind='plain' accessibilityRole='button' accessibilityState={{ selected: sortBy === key }}
                  onPress={() => setSortBy(key)} style={[styles.sort, sortBy === key && { backgroundColor: colors.soft }]}>
                  <Text style={[styles.sortLabel, { color: sortBy === key ? colors.primary : colors.muted }]}>{label}</Text>
                </Pressable>
              ))}
              <Pressable oasisKind='plain' accessibilityRole='button' accessibilityLabel='تصفية المنشورات'
                onPress={() => { setDraftFilters(filters); setFilterOpen(true); }}
                style={[styles.iconButton, filtersActive && { backgroundColor: colors.soft }]}>
                <SlidersHorizontal size={19} color={colors.primary} />
                {filtersActive && <View style={[styles.filterDot, { backgroundColor: colors.primary }]} />}
              </Pressable>
            </View>
            {!!loadError && items.length > 0 && <Text accessibilityRole='alert' style={[styles.notice, { color: colors.danger }]}>{loadError}</Text>}
          </View>
        )}
        ListEmptyComponent={(
          <View style={[styles.state, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            {initialLoading ? <ActivityIndicator color={colors.primary} accessibilityLabel='جارٍ تحميل الاستفسارات' /> : <>
              {!loadError && <OasisEmptyIllustration kind='empty-feed' />}
              <Text style={[styles.stateTitle, { color: colors.ink }]}>{loadError || (needle || filtersActive ? 'لا توجد نتائج مطابقة' : 'كن أول من يبدأ النقاش')}</Text>
              <Pressable oasisKind='plain' accessibilityRole='button' onPress={() => {
                if (loadError) void loadQuestions();
                else if (needle || filtersActive) { setSearch(''); setFilters(DEFAULT_QUESTION_FILTERS); }
                else router.push('/ask');
              }} style={styles.stateAction}>
                <Text style={[styles.sortLabel, { color: colors.primary }]}>{loadError ? 'إعادة المحاولة' : needle || filtersActive ? 'مسح البحث والفلاتر' : 'اطرح استفسارًا'}</Text>
              </Pressable>
            </>}
          </View>
        )}
        ListFooterComponent={showOlder ? (
          <Pressable oasisKind='plain' accessibilityRole='button' disabled={loading} onPress={() => setQueryLimit(limit => limit + PAGE_SIZE)} style={styles.stateAction}>
            <Text style={[styles.sortLabel, { color: colors.primary }]}>{loading ? 'جارٍ التحميل…' : 'تحميل أسئلة أقدم'}</Text>
          </Pressable>
        ) : null}
      />
      <QuestionFilterSheet visible={filterOpen} value={draftFilters} isMember={Boolean(currentUserId)} onChange={setDraftFilters}
        onClose={() => setFilterOpen(false)} onApply={() => { setFilters(draftFilters); setFilterOpen(false); }}
        onReset={() => { setFilters(DEFAULT_QUESTION_FILTERS); setDraftFilters(DEFAULT_QUESTION_FILTERS); setFilterOpen(false); }} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  feed: { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 12, paddingTop: 12 },
  toolbar: { gap: 8, marginBottom: 12 },
  search: { minHeight: 48, flexDirection: 'row-reverse', alignItems: 'center', gap: 9, paddingHorizontal: 12, borderWidth: 1, borderRadius: 15 },
  searchInput: { flex: 1, minHeight: 44, backgroundColor: 'transparent', paddingVertical: 6 },
  controls: { minHeight: 48, flexDirection: 'row-reverse', alignItems: 'center', gap: 3, padding: 4, borderWidth: 1, borderRadius: 15 },
  sort: { flex: 1, minHeight: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 11, paddingHorizontal: 3 },
  sortLabel: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  iconButton: { width: 44, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 11 },
  filterDot: { position: 'absolute', top: 7, right: 8, width: 6, height: 6, borderRadius: 3 },
  state: { alignItems: 'center', justifyContent: 'center', minHeight: 110, padding: 16, borderRadius: 18, borderWidth: 1, gap: 8 },
  stateTitle: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  stateAction: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  notice: { textAlign: 'right', fontSize: 12 },
});
