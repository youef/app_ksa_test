import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, ImageBackground, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SlidersHorizontal, X, Check, Clock3, TrendingUp, MapPin, LayoutGrid, HandHelping, PackageOpen, CircleHelp, Store, Siren, UserRound, Hourglass, MessageCircle, CircleCheck, CalendarDays, CalendarRange, CalendarClock, RotateCcw, ListFilter } from 'lucide-react-native';

const FILTER_OPTION_ICONS: Record<string, typeof Check> = {
  'الكل': LayoutGrid,
  'مساعدة وطلبات': HandHelping,
  'إعارة أغراض': PackageOpen,
  'أسئلة واستفسارات': CircleHelp,
  'خدمات الحي': Store,
  'الطوارئ': Siren,
  'منشوراتي': UserRound,
  'بانتظار المساعدة': Hourglass,
  'تم الرد': MessageCircle,
  'مكتمل': CircleCheck,
  'كل الأوقات': CalendarDays,
  'اليوم': Clock3,
  'هذا الأسبوع': CalendarRange,
  'هذا الشهر': CalendarClock,
};

import { supabase } from '@/lib/supabase';
import { getBrandingLogo, subscribeBrandingLogo, getCachedBrandingLogo } from '@/lib/branding';
import { isLocationMatching, type HaynaLocation } from '@/lib/locationSync';
import {
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


export default function Home() {
  const { flags } = usePlatformConfig();
  const bottomNavInset = useBottomNavInset();
  const { showIsland } = useDynamicIsland();
  const showToast = useCallback((msg: string) => showIsland(msg, undefined, 'success'), [showIsland]);

  const [logoUri, setLogoUri] = useState(getCachedBrandingLogo());
  const [sortBy, setSortBy] = useState<'newest' | 'engaged' | 'nearby'>('newest');
  const [filterOpen, setFilterOpen] = useState(false);
  const [draftKind, setDraftKind] = useState('الكل');
  const [draftStatus, setDraftStatus] = useState('الكل');
  const [draftPeriod, setDraftPeriod] = useState('كل الأوقات');
  const [appliedFilters, setAppliedFilters] = useState({ kind: 'الكل', status: 'الكل', period: 'كل الأوقات' });
  const [refreshing, setRefreshing] = useState(false);
  const activeTab: HomeTab = appliedFilters.kind === 'منشوراتي' ? 'mine' : 'all';

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
    [feed.currentUserId, feed.profile, feed.setQuestions, showToast],
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
    return activeTab === 'mine'
      ? toFeed(derived.filteredMyQuestions, derived.filteredMyRequests)
      : toFeed(derived.filteredQuestions, derived.filteredRequests);
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

  return (
    <View style={[styles.container, layout.page]}>
      <ImageBackground
        source={{ uri: Platform.OS === 'web' ? '/welcome/hayna-heritage-bg.png' : 'https://appksatest.vercel.app/welcome/hayna-heritage-bg.png' }}
        resizeMode="cover"
        pointerEvents="none"
        style={StyleSheet.absoluteFillObject}
        imageStyle={{ opacity: 0.15 }}
      />
      <AppHeader
        variant="home"
        profile={feed.profile}
        isGuest={!feed.currentUserId}
        logoUri={logoUri}
        unreadCount={feed.unreadNotifCount}
        unreadMessagesCount={feed.unreadMessagesCount}
      />

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={handleFeedScroll}
        scrollEventThrottle={300}
        contentContainerStyle={{ paddingBottom: bottomNavInset + 24, backgroundColor: 'transparent', flexGrow: 1 }}
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
        <View style={layout.contextRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <LocationScopeBar compact location={{ region: loc.region, city: loc.city, district: loc.district }} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <AtmosphereBar compact weather={loc.weather} weatherLoading={loc.weatherLoading} />
          </View>
        </View>

        {flags.stories !== false && Boolean(feed.currentUserId) && <View style={layout.stories}><StoriesRow profile={feed.profile} stories={feed.stories} selectedDistrict={loc.district} /></View>}

        <View style={[styles.feedSection, layout.feed]}>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 7 }}>
              {([
                ['newest', 'الأحدث'],
                ['engaged', 'الأكثر تفاعلاً'],
                ['nearby', 'الأقرب'],
              ] as const).map(([key, label]) => (
                <Pressable key={key} onPress={() => setSortBy(key)} style={{ height: 44, width: 98, borderRadius: 22, overflow: 'hidden', justifyContent: 'center' }} accessibilityRole="button" accessibilityState={{ selected: sortBy === key }}>
                  {sortBy === key ? (
                    <ImageBackground source={{ uri: Platform.OS === 'web' ? '/images/buttons/sort-active-bg.png' : 'https://appksatest.vercel.app/images/buttons/sort-active-bg.png' }} resizeMode="stretch" imageStyle={{ height: 34, top: 5, width: 98 }} style={{ height: 44, width: 98, flexDirection: 'row-reverse', justifyContent: 'center', alignItems: 'center', gap: 4, paddingHorizontal: 5 }}>
                      {key === 'newest' ? <Clock3 size={13} color="#064e3b" /> : key === 'engaged' ? <TrendingUp size={13} color="#064e3b" /> : <MapPin size={13} color="#064e3b" />}
                      <Text numberOfLines={1} style={{ color: '#064e3b', fontSize: key === 'engaged' ? 10 : 12, fontWeight: '900' }}>{label}</Text>
                    </ImageBackground>
                  ) : (
                    <View style={{ height: 44, width: 98, flexDirection: 'row-reverse', justifyContent: 'center', alignItems: 'center', gap: 4, paddingHorizontal: 5 }}>
                      {key === 'newest' ? <Clock3 size={13} color="#78857f" /> : key === 'engaged' ? <TrendingUp size={13} color="#78857f" /> : <MapPin size={13} color="#78857f" />}
                      <Text numberOfLines={1} style={{ color: '#78857f', fontSize: key === 'engaged' ? 10 : 12, fontWeight: '900' }}>{label}</Text>
                    </View>
                  )}
                </Pressable>
              ))}
            </ScrollView>
            <Pressable onPress={() => { setDraftKind(appliedFilters.kind); setDraftStatus(appliedFilters.status); setDraftPeriod(appliedFilters.period); setFilterOpen(true); }} style={{ width: 98, height: 44, borderRadius: 22, overflow: 'hidden', justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel="تصفية المنشورات">
              <ImageBackground source={{ uri: Platform.OS === 'web' ? '/images/buttons/filter-glass-bg.png' : 'https://appksatest.vercel.app/images/buttons/filter-glass-bg.png' }} resizeMode="stretch" style={{ height: 44, width: 98, paddingHorizontal: 8, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <SlidersHorizontal size={15} color="#176b52" />
                <Text style={{ color: '#176b52', fontSize: 12, fontWeight: '900' }}>تصفية</Text>
                {(appliedFilters.kind !== 'الكل' || appliedFilters.status !== 'الكل' || appliedFilters.period !== 'كل الأوقات') && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#dc2626' }} />}
              </ImageBackground>
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
                { title: 'نوع المنشور', value: draftKind, setter: setDraftKind, options: ['الكل', 'مساعدة وطلبات', 'إعارة أغراض', 'أسئلة واستفسارات', 'خدمات الحي', 'الطوارئ', ...(currentUserId ? ['منشوراتي'] : [])] },
                { title: 'حالة الطلب', value: draftStatus, setter: setDraftStatus, options: ['الكل', 'بانتظار المساعدة', 'تم الرد', 'مكتمل'] },
                { title: 'تاريخ النشر', value: draftPeriod, setter: setDraftPeriod, options: ['كل الأوقات', 'اليوم', 'هذا الأسبوع', 'هذا الشهر'] },
              ] as const).map(section => (
                <View key={section.title} style={{ marginBottom: 18 }}>
                  <Text style={{ color: '#334155', fontSize: 13, fontWeight: '900', textAlign: 'right', marginBottom: 9 }}>{section.title}</Text>
                  <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 }}>
                    {section.options.map(option => {
                      const selected = section.value === option;
                      const OptionIcon = FILTER_OPTION_ICONS[option] || ListFilter;
                      return (
                        <Pressable key={option} onPress={() => section.setter(option)} style={{ borderRadius: 16, overflow: 'hidden', minHeight: 42, justifyContent: 'center' }} accessibilityRole="button" accessibilityState={{ selected }}>
                          <ImageBackground source={{ uri: Platform.OS === 'web' ? (selected ? '/images/buttons/sort-active-bg.png' : '/images/buttons/filter-glass-bg.png') : (selected ? 'https://appksatest.vercel.app/images/buttons/sort-active-bg.png' : 'https://appksatest.vercel.app/images/buttons/filter-glass-bg.png') }} resizeMode="stretch" style={{ minHeight: 42, paddingHorizontal: 14, paddingVertical: 9, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6 }} imageStyle={{ borderRadius: 16 }}>
                            <OptionIcon size={14} color="#064e3b" />
                            <Text style={{ color: '#064e3b', fontSize: 12, fontWeight: selected ? '900' : '800' }}>{option}</Text>
                          </ImageBackground>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row-reverse', gap: 10, marginTop: 12 }}>
              <Pressable onPress={() => { setDraftKind('الكل'); setDraftStatus('الكل'); setDraftPeriod('كل الأوقات'); setAppliedFilters({ kind: 'الكل', status: 'الكل', period: 'كل الأوقات' }); setFilterOpen(false); }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48, borderRadius: 15, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1' }}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 7 }}><RotateCcw size={16} color="#475569" /><Text style={{ color: '#475569', fontSize: 13, fontWeight: '900' }}>مسح الكل</Text></View>
              </Pressable>
              <Pressable onPress={() => { setAppliedFilters({ kind: draftKind, status: draftStatus, period: draftPeriod }); setFilterOpen(false); }} style={{ flex: 1.4, alignItems: 'center', justifyContent: 'center', minHeight: 48, borderRadius: 15, backgroundColor: '#176b52' }}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 7 }}><Check size={16} color="#ffffff" /><Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '900' }}>اعتماد التصفية</Text></View>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const layout = StyleSheet.create({
  page: { backgroundColor: 'transparent' },
  contextRow: { width: '100%', maxWidth: 760, alignSelf: 'center', flexDirection: 'row-reverse', alignItems: 'stretch', gap: 8, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  stories: { width: '100%', maxWidth: 728, alignSelf: 'center', backgroundColor: 'transparent', borderRadius: 22, overflow: 'hidden', marginBottom: 8 },
  feed: { maxWidth: 760, marginTop: 16 },

});
