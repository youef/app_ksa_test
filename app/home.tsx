import { oasisAssets } from '@/components/oasis/assets';
import { OasisPressable as Pressable } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import CommunityShortcuts from '@/components/home/CommunityShortcuts';
import { FeedSkeleton, ErrorBanner } from '@/components/home/HomeStates';
import { styles } from '@/components/home/homeStyles';
import { requireAccount } from '@/lib/authGate';
import { useTheme } from '@/context/ThemeContext';


export default function Home() {
  const { colors, isDark } = useTheme();
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
    <View style={[styles.container, layout.page, { backgroundColor: 'transparent' }]}>

      <AppHeader
        variant="home"
        profile={feed.profile}
        isGuest={!feed.currentUserId}
        logoUri={logoUri}
        unreadCount={feed.unreadNotifCount}
        unreadMessagesCount={feed.unreadMessagesCount}
      />

      {/* The shared root owns the heritage background; do not draw it twice. */}
      <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      <ScrollView
        style={{ flex: 1, backgroundColor: 'transparent' }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={handleFeedScroll}
        scrollEventThrottle={300}
        contentContainerStyle={{ paddingBottom: bottomNavInset + 24, backgroundColor: 'transparent', flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={isDark ? colors.surface : colors.soft}
          />
        }
      >
        <CommunityShortcuts signedIn={Boolean(feed.currentUserId)} />
        <View style={layout.contextRow}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <LocationScopeBar compact location={{ region: loc.region, city: loc.city, district: loc.district }} onLocationChanged={loc.apply} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <AtmosphereBar compact weather={loc.weather} weatherLoading={loc.weatherLoading} />
          </View>
        </View>

        {flags.stories !== false && Boolean(feed.currentUserId) && <View style={layout.stories}><StoriesRow profile={feed.profile} stories={feed.stories} selectedDistrict={loc.district} /></View>}

        <View style={[styles.feedSection, layout.feed]}>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, gap: 8 }}>
            <ScrollView horizontal style={{ flex: 1, minWidth: 0, direction: 'rtl' }} showsHorizontalScrollIndicator={false} contentContainerStyle={{ direction: 'ltr', flexDirection: 'row-reverse', alignItems: 'center', gap: 6, paddingVertical: 6 }}>
              {([['newest', 'الأحدث'], ['engaged', 'الأكثر تفاعلاً'], ['nearby', 'الأقرب']] as const).map(([key, label]) => (
                <Pressable oasisKind="chip" oasisVariant={sortBy === key ? 'primary' : 'ghost'} key={key} onPress={() => setSortBy(key)} style={{ flexDirection: 'row-reverse', gap: 4, paddingHorizontal: 10 }} accessibilityRole="button" accessibilityState={{ selected: sortBy === key }}>
                  {key === 'newest' ? <Clock3 size={14} color={OASIS.colors.primary} /> : key === 'engaged' ? <TrendingUp size={14} color={OASIS.colors.primary} /> : <MapPin size={14} color={OASIS.colors.primary} />}
                  <Text style={{ fontSize: 12, fontWeight: '600', color: sortBy === key ? '#FFFFFF' : colors.ink }}>{label}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Pressable oasisKind="icon" oasisVariant="ghost" onPress={() => { setDraftKind(appliedFilters.kind); setDraftStatus(appliedFilters.status); setDraftPeriod(appliedFilters.period); setFilterOpen(true); }} accessibilityRole="button" accessibilityLabel="تصفية المنشورات">
              <SlidersHorizontal size={20} color={OASIS.colors.primary} />
              {(appliedFilters.kind !== 'الكل' || appliedFilters.status !== 'الكل' || appliedFilters.period !== 'كل الأوقات') && <View style={{ position: 'absolute', top: 5, right: 5, width: 6, height: 6, borderRadius: 3, backgroundColor: OASIS.colors.danger }} />}
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
            <Pressable oasisKind="action"
              style={styles.loadMoreBtn}
              onPress={feed.loadMore}
              disabled={feed.loadingMore}
              accessibilityRole="button"
              accessibilityLabel="تحميل المزيد"
            >
              {feed.loadingMore ? (
                <ActivityIndicator color={OASIS.colors.primary} />
              ) : (
                <Text style={styles.loadMoreText}>حمّل المزيد</Text>
              )}
            </Pressable>
          )}


        </View>
      </ScrollView>
      </View>

      <Modal visible={filterOpen} transparent animationType="slide" onRequestClose={() => setFilterOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.38)' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setFilterOpen(false)} accessibilityLabel="إغلاق لوحة التصفية" />
          <View style={{ backgroundColor: '#f8fbf9', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 16, maxHeight: '82%' }}>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 9 }}>
                <View style={{ width: 38, height: 38, borderRadius: 13, backgroundColor: '#dff4e9', alignItems: 'center', justifyContent: 'center' }}><SlidersHorizontal size={18} color="#176b52" /></View>
                <View>
                  <Text style={{ color: '#102a22', fontSize: 18, fontWeight: '700', textAlign: 'right' }}>تصفية المنشورات</Text>
                  <Text style={{ color: '#718078', fontSize: 11, marginTop: 2, textAlign: 'right' }}>اعرض ما يناسبك من منشورات الحي</Text>
                </View>
              </View>
              <Pressable onPress={() => setFilterOpen(false)} style={{ padding: 8, borderRadius: 12, backgroundColor: '#eaf1ed' }} accessibilityLabel="إغلاق"><X size={18} color={OASIS.colors.muted} /></Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {([
                { title: 'نوع المنشور', value: draftKind, setter: setDraftKind, options: ['الكل', 'مساعدة وطلبات', 'إعارة أغراض', 'أسئلة واستفسارات', 'خدمات الحي', 'الطوارئ', ...(currentUserId ? ['منشوراتي'] : [])] },
                { title: 'حالة الطلب', value: draftStatus, setter: setDraftStatus, options: ['الكل', 'بانتظار المساعدة', 'تم الرد', 'مكتمل'] },
                { title: 'تاريخ النشر', value: draftPeriod, setter: setDraftPeriod, options: ['كل الأوقات', 'اليوم', 'هذا الأسبوع', 'هذا الشهر'] },
              ] as const).map(section => (
                <View key={section.title} style={{ marginBottom: 18 }}>
                  <Text style={{ color: OASIS.colors.ink, fontSize: 13, fontWeight: '700', textAlign: 'right', marginBottom: 9 }}>{section.title}</Text>
                  <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 }}>
                    {section.options.map(option => {
                      const selected = section.value === option;
                      const OptionIcon = FILTER_OPTION_ICONS[option] || ListFilter;
                      return (
                        <Pressable oasisKind="chip" oasisVariant={selected ? 'primary' : 'secondary'} key={option} onPress={() => section.setter(option)} style={{ width: '48%', minHeight: 36, borderRadius: 10, overflow: 'hidden', justifyContent: 'center', flexShrink: 0 }} accessibilityRole="button" accessibilityState={{ selected }}>
                          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                            <OptionIcon size={14} color={(selected ? OASIS.colors.surface : OASIS.colors.deep)} />
                            <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ flexShrink: 1, color: (selected ? OASIS.colors.surface : OASIS.colors.deep), fontSize: 12, fontWeight: '700', textAlign: 'center' }}>{option}</Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row-reverse', gap: 10, marginTop: 12 }}>
              <Pressable onPress={() => { setDraftKind('الكل'); setDraftStatus('الكل'); setDraftPeriod('كل الأوقات'); setAppliedFilters({ kind: 'الكل', status: 'الكل', period: 'كل الأوقات' }); setFilterOpen(false); }} style={{ flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48, borderRadius: 15, backgroundColor: OASIS.colors.surface, borderWidth: 1, borderColor: '#cbd5e1' }}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 7 }}><RotateCcw size={16} color={OASIS.colors.muted} /><Text style={{ color: OASIS.colors.muted, fontSize: 13, fontWeight: '700' }}>مسح الكل</Text></View>
              </Pressable>
              <Pressable onPress={() => { setAppliedFilters({ kind: draftKind, status: draftStatus, period: draftPeriod }); setFilterOpen(false); }} style={{ flex: 1.4, alignItems: 'center', justifyContent: 'center', minHeight: 48, borderRadius: 15, backgroundColor: '#176b52' }}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 7 }}><Check size={16} color={OASIS.colors.surface} /><Text style={{ color: OASIS.colors.surface, fontSize: 13, fontWeight: '700' }}>اعتماد التصفية</Text></View>
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
  contextRow: { width: '100%', maxWidth: 760, alignSelf: 'center', flexDirection: 'row-reverse', alignItems: 'stretch', gap: 8, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  stories: { width: '100%', maxWidth: 728, alignSelf: 'center', backgroundColor: 'transparent', borderRadius: 14, overflow: 'hidden', marginBottom: 8 },
  feed: { maxWidth: 760, marginTop: 4 },

});
