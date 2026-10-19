import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, RefreshControl, ScrollView, StatusBar, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft, Flame, Sparkles, HeartHandshake, MessageCircle, SlidersHorizontal, X, Check, ShieldAlert } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import { getBrandingLogo, subscribeBrandingLogo, getCachedBrandingLogo } from '@/lib/branding';
import { isLocationMatching, type HaynaLocation } from '@/lib/locationSync';
import {
  getGreeting,
  isEmergencyQuestion,
  isToolQuestion,
  toFeed,
  type FeedItem,
  type HomeTab,
} from '@/lib/homeUtils';
import { useDynamicIsland } from '@/context/DynamicIslandContext';
import { useHomeFeed } from '@/hooks/useHomeFeed';
import { useHomeLocation } from '@/hooks/useHomeLocation';
import { useBottomNavInset } from '@/lib/bottomNav';
import TwitterInquiryCard from '@/components/TwitterInquiryCard';
import LocationScopeBar from '@/components/LocationScopeBar';
import AppHeader from '@/components/shared/AppHeader';
import AtmosphereBar from '@/components/home/AtmosphereBar';
import StoriesRow from '@/components/home/StoriesRow';
import { usePlatformConfig } from '@/lib/platformConfig';
import EmptyState from '@/components/home/EmptyState';
import { FeedSkeleton, ErrorBanner } from '@/components/home/HomeStates';
import { styles } from '@/components/home/homeStyles';
import { requireAccount } from '@/lib/authGate';

const DAY_MS = 24 * 60 * 60 * 1000;

export default function Home() {
  const { flags } = usePlatformConfig();
  const bottomNavInset = useBottomNavInset();
  const { showIsland } = useDynamicIsland();
  const showToast = useCallback((msg: string) => showIsland(msg, undefined, 'success'), [showIsland]);

  const [logoUri, setLogoUri] = useState(getCachedBrandingLogo());
  const [activeTab, setActiveTab] = useState<HomeTab>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'engaged' | 'nearby'>('newest');
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftKind, setDraftKind] = useState('الكل');
  const [draftStatus, setDraftStatus] = useState('الكل');
  const [draftPeriod, setDraftPeriod] = useState('كل الأوقات');
  const [appliedFilters, setAppliedFilters] = useState({ kind: 'الكل', status: 'الكل', period: 'كل الأوقات' });
  const [refreshing, setRefreshing] = useState(false);
  const [greeting] = useState(() => getGreeting());
  const emergencyCarouselRef = useRef<ScrollView>(null);

  // The feed hook resolves the saved location; the location hook owns it.
  // A ref breaks the circular dependency between the two hooks.
  const applyLocationRef = useRef<(loc: HaynaLocation) => void>(() => {});
  const feed = useHomeFeed({ onLocation: loc => applyLocationRef.current(loc) });
  const loc = useHomeLocation({ setProfile: feed.setProfile, showToast });
  applyLocationRef.current = loc.apply;

  useEffect(() => {
    getBrandingLogo().then(setLogoUri);
    return subscribeBrandingLogo(setLogoUri);
  }, []);

  // ---------- Quick reply ----------
  const handleQuickReply = useCallback(
    async (questionId: string, text: string) => {
      const body = text.trim();
      if (!body) return;
      if (!feed.currentUserId) {
        requireAccount('سجّل الدخول أو أنشئ حساباً للمشاركة بالرد في مجتمع حيك.');
        return;
      }

      const { data: auth } = await supabase.auth.getSession();
      const user = auth.session?.user;
      if (!user) return requireAccount('انتهت الجلسة. يرجى تسجيل الدخول مجدداً.');

      const { data: newAns, error } = await supabase
        .from('answers')
        .insert({ question_id: questionId, author_id: user.id, body })
        .select('*')
        .single();

      if (error || !newAns) {
        Alert.alert('خطأ', 'تعذر إضافة الرد: ' + (error?.message ?? 'حدث خطأ غير متوقع'));
        return;
      }

      const answer = { ...newAns, profiles: feed.profile };
      feed.setQuestions(prev =>
        prev.map(q => {
          if (q.id !== questionId) return q;
          const answers = [...(q.answers || []), answer];
          return { ...q, answers, answers_count: answers.length };
        }),
      );
      showToast('تم نشر الرد بنجاح في المحادثة');
    },
    [feed.profile, feed.setQuestions, showToast],
  );

  // ---------- Filtering ----------
  const { matchesLocation } = loc;

  const matchesVisibleLocation = useCallback(
    (item: { city?: string | null; district?: string | null }) => feed.currentUserId
      ? matchesLocation(item)
      : isLocationMatching(item, loc.city, loc.district),
    [feed.currentUserId, loc.city, loc.district, matchesLocation],
  );

  const { questions, requests, currentUserId } = feed;

  const derived = useMemo(() => {
    const filteredQuestions = questions.filter(matchesVisibleLocation);
    const filteredRequests = requests.filter(matchesVisibleLocation);
    const myQuestions = questions.filter(x => x.author_id === currentUserId);
    const myRequests = requests.filter(x => x.requester_id === currentUserId);

    return {
      filteredQuestions,
      filteredRequests,
      myCount: myQuestions.length + myRequests.length,
      filteredMyQuestions: myQuestions,
      filteredMyRequests: myRequests,
      emergency: filteredQuestions.filter(isEmergencyQuestion).slice(0, 5),
      tools: filteredQuestions.filter(isToolQuestion),
    };
  }, [questions, requests, currentUserId, matchesVisibleLocation]);

  const items: FeedItem[] = useMemo(() => {
    switch (activeTab) {
      case 'emergency': return [];
      case 'tools': return toFeed(derived.tools, []);
      case 'questions': return toFeed(derived.filteredQuestions, []);
      case 'requests': return toFeed([], derived.filteredRequests);
      case 'mine': return toFeed(derived.filteredMyQuestions, derived.filteredMyRequests);
      default: return toFeed(derived.filteredQuestions, derived.filteredRequests);
    }
  }, [activeTab, derived]);

  const filteredItems = useMemo(() => {
    const now = Date.now();
    const filtered = items.filter(item => {
      const data: any = item.data;
      const title = String(data.title || '');
      const category = String(data.category || '');
      const isEmergency = item.type === 'question' && isEmergencyQuestion(data);
      const isTools = item.type === 'question' && isToolQuestion(data);
      const kind = appliedFilters.kind;
      if (kind === 'مساعدة وطلبات' && item.type !== 'request') return false;
      if (kind === 'إعارة أغراض' && !isTools) return false;
      if (kind === 'أسئلة واستفسارات' && (item.type !== 'question' || isEmergency || isTools)) return false;
      if (kind === 'خدمات الحي' && !/خدم|صيان|تنظيف|توصيل|سباك|كهرب|نجار/.test(category + ' ' + title)) return false;
      if (kind === 'الطوارئ' && !isEmergency) return false;

      const status = String(data.resolution_status || data.status || '').toLowerCase();
      const completed = Boolean(data.best_answer_id || data.is_resolved || data.is_closed || ['completed', 'resolved', 'closed', 'done', 'found', 'helped', 'not_needed'].includes(status));
      const responded = Number(data.answers_count ?? data.answers?.length ?? 0) > 0;
      if (appliedFilters.status === 'بانتظار المساعدة' && (completed || responded)) return false;
      if (appliedFilters.status === 'تم الرد' && (!responded || completed)) return false;
      if (appliedFilters.status === 'مكتمل' && !completed) return false;

      const created = new Date(data.created_at || 0).getTime();
      if (appliedFilters.period === 'اليوم' && (now - created > 24 * 60 * 60 * 1000 || created > now)) return false;
      if (appliedFilters.period === 'هذا الأسبوع' && (now - created > 7 * 24 * 60 * 60 * 1000 || created > now)) return false;
      if (appliedFilters.period === 'هذا الشهر' && (now - created > 30 * 24 * 60 * 60 * 1000 || created > now)) return false;
      return true;
    });

    const score = (item: FeedItem) => {
      const data: any = item.data;
      return Number(data.answers_count ?? data.answers?.length ?? 0) * 3
        + Number(data.likes_count ?? data.likes ?? 0) * 2
        + Number(data.views_count ?? data.views ?? 0);
    };
    return filtered.sort((a, b) => {
      const featuredPriority = Number(Boolean(b.data.is_featured)) - Number(Boolean(a.data.is_featured));
      if (featuredPriority !== 0) return featuredPriority;
      if (sortBy === 'engaged') return score(b) - score(a) || new Date(b.data.created_at).getTime() - new Date(a.data.created_at).getTime();
      if (sortBy === 'nearby') {
        const rank = (item: FeedItem) => item.data.district && item.data.district === loc.district ? 0
          : item.data.city && item.data.city === loc.city ? 1 : 2;
        return rank(a) - rank(b) || new Date(b.data.created_at).getTime() - new Date(a.data.created_at).getTime();
      }
      return new Date(b.data.created_at).getTime() - new Date(a.data.created_at).getTime();
    });
  }, [items, appliedFilters, sortBy, loc.city, loc.district]);

  // Real activity: distinct neighbours who posted in the visible area during the last 24h.
  const activeNeighbors = useMemo(() => {
    const since = Date.now() - DAY_MS;
    const ids = new Set<string>();
    derived.filteredQuestions.forEach(x => new Date(x.created_at).getTime() > since && ids.add(x.author_id));
    derived.filteredRequests.forEach(x => new Date(x.created_at).getTime() > since && ids.add(x.requester_id));
    feed.stories.forEach(s => s.author_id && ids.add(s.author_id));
    return ids.size;
  }, [derived.filteredQuestions, derived.filteredRequests, feed.stories]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await feed.reload();
    setRefreshing(false);
  }, [feed.reload]);

  // Infinite feed: fetch the next batch when the user scrolls near the end.
  const handleFeedScroll = useCallback(({ nativeEvent }: any) => {
    const { contentOffset, contentSize, layoutMeasurement } = nativeEvent;
    const nearEnd = contentOffset.y + layoutMeasurement.height >= contentSize.height - 520;
    if (nearEnd && feed.hasMore && !feed.loadingMore && !feed.loading) {
      void feed.loadMore();
    }
  }, [feed.hasMore, feed.loadingMore, feed.loading, feed.loadMore]);

  const emergencyTop = derived.emergency[0];

  useEffect(() => {
    if (derived.emergency.length < 2) return;
    let index = 0;
    const timer = setInterval(() => {
      index = (index + 1) % derived.emergency.length;
      emergencyCarouselRef.current?.scrollTo({ x: index * 290, animated: true });
    }, 30000);
    return () => clearInterval(timer);
  }, [derived.emergency.length]);

  return (
    <View style={styles.container}>
      <AppHeader
        variant="home"
        profile={feed.profile}
        isGuest={!feed.currentUserId}
        logoUri={logoUri}
        unreadCount={feed.unreadNotifCount}
      />

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={handleFeedScroll}
        scrollEventThrottle={300}
        contentContainerStyle={{ paddingBottom: bottomNavInset + 24, backgroundColor: '#eaf3ee', flexGrow: 1 }}
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
        <View style={{ flexDirection: 'row-reverse', alignItems: 'stretch', gap: 8, marginHorizontal: 12, marginTop: 6, marginBottom: 10 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <LocationScopeBar compact location={{ region: loc.region, city: loc.city, district: loc.district }} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <AtmosphereBar compact weather={loc.weather} weatherLoading={loc.weatherLoading} />
          </View>
        </View>

        {flags.stories !== false && <StoriesRow profile={feed.profile} stories={feed.stories} selectedDistrict={loc.district} />}

        <View style={[styles.emergencyHomeCard, { marginHorizontal: 12, marginBottom: 16, padding: 14, borderRadius: 22, backgroundColor: '#fffafa', borderWidth: 1, borderColor: '#fee2e2', shadowColor: '#7f1d1d', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.06, shadowRadius: 14, elevation: 2 }]}>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10, flex: 1 }}>
              <View style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: '#fee2e2', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#fecaca' }}>
                <ShieldAlert size={23} color="#b91c1c" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#7f1d1d', fontSize: 17, fontWeight: '900', textAlign: 'right' }}>البلاغات والطوارئ</Text>
                <Text style={{ color: '#9f5a5a', fontSize: 11, textAlign: 'right', marginTop: 3 }}>تنبيهات مهمة من سكان الحي</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 5, backgroundColor: '#fff1f2', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: '#ffe4e6' }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#ef4444' }} />
              <Text style={{ color: '#be123c', fontSize: 10, fontWeight: '900' }}>قسم مستقل</Text>
            </View>
          </View>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ color: '#64748b', fontSize: 11, textAlign: 'right', flex: 1, lineHeight: 17 }}>آخر البلاغات المسجلة في نطاقك — اضغط على البلاغ لمعرفة التفاصيل.</Text>
            <View style={{ backgroundColor: '#f1f5f9', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5, marginRight: 8 }}>
              <Text style={{ color: '#475569', fontSize: 10, fontWeight: '900' }}>{derived.emergency.length} من 5</Text>
            </View>
          </View>
          {derived.emergency.length > 0 ? (
            <ScrollView ref={emergencyCarouselRef} horizontal inverted showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 2 }}>
              {derived.emergency.map((report: any, index: number) => (
                <Pressable key={String(report.id)} onPress={() => router.push({ pathname: '/question', params: { id: String(report.id) } })} accessibilityRole="button" accessibilityLabel={`عرض تفاصيل البلاغ ${index + 1}`} style={{ width: 265, minHeight: 142, borderRadius: 17, padding: 13, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#f1d2d2', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                    <View style={{ width: 28, height: 28, borderRadius: 10, backgroundColor: '#fff1f2', alignItems: 'center', justifyContent: 'center' }}>
                      <Flame size={15} color="#dc2626" />
                    </View>
                    <Text style={{ color: '#b91c1c', fontSize: 10, fontWeight: '900' }}>بلاغ طارئ {index + 1}</Text>
                    <View style={{ flex: 1 }} />
                    <Text style={{ color: '#94a3b8', fontSize: 10 }}>{report.created_at ? new Date(report.created_at).toLocaleDateString('ar-SA') : ''}</Text>
                  </View>
                  <Text numberOfLines={3} style={{ color: '#172a22', fontSize: 14, lineHeight: 21, fontWeight: '900', textAlign: 'right', marginTop: 10 }}>{report.title || report.body || report.content || 'بلاغ طارئ مسجل'}</Text>
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 5, marginTop: 10, paddingTop: 9, borderTopWidth: 1, borderTopColor: '#f1f5f9' }}>
                    <View style={{ width: 22, height: 22, borderRadius: 7, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#64748b', fontSize: 11 }}>⌖</Text>
                    </View>
                    <Text numberOfLines={1} style={{ color: '#64748b', fontSize: 11, textAlign: 'right', flex: 1 }}>{report.district || report.city || 'الموقع غير محدد'}</Text>
                    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 3 }}>
                      <Text style={{ color: '#b91c1c', fontSize: 10, fontWeight: '900' }}>التفاصيل</Text>
                      <ChevronLeft size={13} color="#b91c1c" />
                    </View>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <View style={{ alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 16, padding: 18, borderWidth: 1, borderColor: '#f1d2d2' }}>
              <View style={{ width: 42, height: 42, borderRadius: 14, backgroundColor: '#fff1f2', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                <ShieldAlert size={21} color="#dc2626" />
              </View>
              <Text style={{ color: '#7f1d1d', fontSize: 12, fontWeight: '800', textAlign: 'center' }}>لا توجد بلاغات طارئة مسجلة حالياً</Text>
              <Text style={{ color: '#94a3b8', fontSize: 11, textAlign: 'center', marginTop: 4 }}>يمكنك إضافة بلاغ ليستفيد سكان الحي</Text>
            </View>
          )}
          <Pressable onPress={() => router.push('/ask')} accessibilityRole="button" accessibilityLabel="إضافة بلاغ طارئ" style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12, minHeight: 46, backgroundColor: '#b91c1c', paddingHorizontal: 16, borderRadius: 14, shadowColor: '#b91c1c', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 2 }}>
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900' }}>＋ إضافة بلاغ طارئ</Text>
            <Text style={{ color: '#fecaca', fontSize: 11 }}>ساعد في تنبيه الحي</Text>
          </Pressable>
        </View>

        <View style={styles.feedSection}>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 7 }}>
              {([
                ['newest', 'الأحدث'],
                ['engaged', 'الأكثر تفاعلاً'],
                ['nearby', 'الأقرب'],
              ] as const).map(([key, label]) => (
                <Pressable key={key} onPress={() => setSortBy(key)} style={{ paddingHorizontal: 13, paddingVertical: 8, borderRadius: 18, backgroundColor: sortBy === key ? '#176b52' : '#ffffff', borderWidth: 1, borderColor: sortBy === key ? '#176b52' : '#dbe5df' }} accessibilityRole="button" accessibilityState={{ selected: sortBy === key }}>
                  <Text style={{ color: sortBy === key ? '#ffffff' : '#475569', fontSize: 12, fontWeight: '800' }}>{label}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable onPress={() => { setDraftKind(appliedFilters.kind); setDraftStatus(appliedFilters.status); setDraftPeriod(appliedFilters.period); setFilterOpen(true); }} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 14, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#b7d8c8' }} accessibilityRole="button" accessibilityLabel="تصفية المنشورات">
              <SlidersHorizontal size={15} color="#176b52" />
              <Text style={{ color: '#176b52', fontSize: 12, fontWeight: '900' }}>تصفية</Text>
              {(appliedFilters.kind !== 'الكل' || appliedFilters.status !== 'الكل' || appliedFilters.period !== 'كل الأوقات') && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#dc2626' }} />}
            </Pressable>
          </View>


          {feed.error && <ErrorBanner message={feed.error} onRetry={feed.reload} />}

          {feed.loading ? (
            <FeedSkeleton />
          ) : filteredItems.length === 0 ? (
            <EmptyState tab={activeTab} searching={false} city={loc.city} hasExactLocation={loc.hasExactLocation} />
          ) : (
            filteredItems.map(item => (
              <TwitterInquiryCard
                key={`${activeTab}-${item.type}-${item.data.id}`}
                type={item.type}
                data={item.data}
                currentUserProfile={feed.profile}
                currentUserId={feed.currentUserId}
                isGuest={!feed.currentUserId}
                isMine={activeTab === 'mine' ? true : undefined}
                onQuickReply={handleQuickReply}
                onToast={showToast}
                onDeleted={() => { void feed.reload(); }}
              />
            ))
          )}

          {!feed.loading && feed.hasMore && items.length > 0 && (
            <Pressable
              style={styles.loadMoreBtn}
              onPress={feed.loadMore}
              disabled={feed.loadingMore}
              accessibilityRole="button"
              accessibilityLabel="تحميل المزيد"
            >
              {feed.loadingMore ? (
                <ActivityIndicator color="#059669" />
              ) : (
                <Text style={styles.loadMoreText}>حمّل المزيد</Text>
              )}
            </Pressable>
          )}

          <View style={{ height: bottomNavInset }} />
        </View>
      </ScrollView>

      <Modal visible={filterOpen} transparent animationType="slide" onRequestClose={() => setFilterOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.38)' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setFilterOpen(false)} accessibilityLabel="إغلاق لوحة التصفية" />
          <View style={{ backgroundColor: '#f8fbf9', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 28, maxHeight: '82%' }}>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 9 }}>
                <View style={{ width: 38, height: 38, borderRadius: 13, backgroundColor: '#dff4e9', alignItems: 'center', justifyContent: 'center' }}><SlidersHorizontal size={18} color="#176b52" /></View>
                <View>
                  <Text style={{ color: '#102a22', fontSize: 18, fontWeight: '900', textAlign: 'right' }}>تصفية المنشورات</Text>
                  <Text style={{ color: '#718078', fontSize: 11, marginTop: 2, textAlign: 'right' }}>اعرض ما يناسبك من منشورات الحي</Text>
                </View>
              </View>
              <Pressable onPress={() => setFilterOpen(false)} style={{ padding: 8, borderRadius: 12, backgroundColor: '#eaf1ed' }} accessibilityLabel="إغلاق"><X size={18} color="#475569" /></Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {([
                { title: 'نوع المنشور', value: draftKind, setter: setDraftKind, options: ['الكل', 'مساعدة وطلبات', 'إعارة أغراض', 'أسئلة واستفسارات', 'خدمات الحي', 'الطوارئ'] },
                { title: 'حالة الطلب', value: draftStatus, setter: setDraftStatus, options: ['الكل', 'بانتظار المساعدة', 'تم الرد', 'مكتمل'] },
                { title: 'تاريخ النشر', value: draftPeriod, setter: setDraftPeriod, options: ['كل الأوقات', 'اليوم', 'هذا الأسبوع', 'هذا الشهر'] },
              ] as const).map(section => (
                <View key={section.title} style={{ marginBottom: 18 }}>
                  <Text style={{ color: '#334155', fontSize: 13, fontWeight: '900', textAlign: 'right', marginBottom: 9 }}>{section.title}</Text>
                  <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 }}>
                    {section.options.map(option => {
                      const selected = section.value === option;
                      return (
                        <Pressable key={option} onPress={() => section.setter(option)} style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 14, backgroundColor: selected ? '#176b52' : '#ffffff', borderWidth: 1, borderColor: selected ? '#176b52' : '#dbe5df' }} accessibilityRole="button" accessibilityState={{ selected }}>
                          {selected && <Check size={13} color="#ffffff" />}
                          <Text style={{ color: selected ? '#ffffff' : '#475569', fontSize: 12, fontWeight: '800' }}>{option}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row-reverse', gap: 10, marginTop: 12 }}>
              <Pressable onPress={() => { setDraftKind('الكل'); setDraftStatus('الكل'); setDraftPeriod('كل الأوقات'); setAppliedFilters({ kind: 'الكل', status: 'الكل', period: 'كل الأوقات' }); setFilterOpen(false); }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48, borderRadius: 15, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1' }}>
                <Text style={{ color: '#475569', fontSize: 13, fontWeight: '900' }}>مسح الكل</Text>
              </Pressable>
              <Pressable onPress={() => { setAppliedFilters({ kind: draftKind, status: draftStatus, period: draftPeriod }); setFilterOpen(false); }} style={{ flex: 1.4, alignItems: 'center', justifyContent: 'center', minHeight: 48, borderRadius: 15, backgroundColor: '#176b52' }}>
                <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '900' }}>اعتماد التصفية</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}
