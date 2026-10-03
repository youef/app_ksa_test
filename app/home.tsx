import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Flame, Plus } from 'lucide-react-native';

import { supabase } from '@/lib/supabase';
import { getBrandingLogo, subscribeBrandingLogo } from '@/lib/branding';
import { savePermanentMyLocation, type HaynaLocation } from '@/lib/locationSync';
import {
  getGreeting,
  isEmergencyQuestion,
  isToolQuestion,
  normalizeSearchText,
  toFeed,
  type FeedItem,
  type HomeTab,
} from '@/lib/homeUtils';
import { useDynamicIsland } from '@/context/DynamicIslandContext';
import { useHomeFeed } from '@/hooks/useHomeFeed';
import { useHomeLocation } from '@/hooks/useHomeLocation';

import BottomNav from '@/components/BottomNav';
import LocationSelectorModal from '@/components/LocationSelectorModal';
import TwitterInquiryCard from '@/components/TwitterInquiryCard';
import HomeHero from '@/components/home/HomeHero';
import AtmosphereBar from '@/components/home/AtmosphereBar';
import StoriesRow from '@/components/home/StoriesRow';
import ServicesGrid from '@/components/home/ServicesGrid';
import FeedTabs from '@/components/home/FeedTabs';
import EmptyState from '@/components/home/EmptyState';
import { FeedSkeleton, ErrorBanner } from '@/components/home/HomeStates';
import { LocationGateModal, WeeklyLocationPrompt } from '@/components/home/LocationModals';
import { styles } from '@/components/home/homeStyles';

const DAY_MS = 24 * 60 * 60 * 1000;

export default function Home() {
  const { showIsland } = useDynamicIsland();
  const showToast = useCallback((msg: string) => showIsland(msg, undefined, 'success'), [showIsland]);

  const [logoUri, setLogoUri] = useState('/assets/branding/HAYNA_LOGO.png?v=2');
  const [activeTab, setActiveTab] = useState<HomeTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [greeting] = useState(() => getGreeting());

  // The feed hook resolves the saved location; the location hook owns it.
  // A ref breaks the circular dependency between the two hooks.
  const applyLocationRef = useRef<(loc: HaynaLocation) => void>(() => {});
  const feed = useHomeFeed({ onLocation: loc => applyLocationRef.current(loc) });
  const loc = useHomeLocation({ setProfile: feed.setProfile, showToast });
  applyLocationRef.current = loc.apply;

  const { setSetupOpen } = loc;
  useEffect(() => {
    setSetupOpen(feed.locationIncomplete);
  }, [feed.locationIncomplete, setSetupOpen]);

  useEffect(() => {
    getBrandingLogo().then(setLogoUri);
    return subscribeBrandingLogo(setLogoUri);
  }, []);

  // FAB pulse (stopped on unmount)
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  // ---------- Quick reply ----------
  const handleQuickReply = useCallback(
    async (questionId: string, text: string) => {
      const body = text.trim();
      if (!body) return;

      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        Alert.alert('تنبيه', 'يرجى تسجيل الدخول أولاً للرد');
        return;
      }

      const { data: newAns, error } = await supabase
        .from('answers')
        .insert({ question_id: questionId, author_id: u.user.id, body })
        .select('*')
        .single();

      if (error || !newAns) {
        Alert.alert('خطأ', 'تعذر إرسال الرد: ' + (error?.message ?? 'حاول مرة أخرى'));
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
      showToast('تم نشر ردك بنجاح في المحادثة');
    },
    [feed.profile, feed.setQuestions, showToast],
  );

  // ---------- Filtering ----------
  const q = normalizeSearchText(searchQuery);
  const searching = q.length > 0;

  const matches = useCallback(
    (values: unknown[]) => !q || values.some(v => normalizeSearchText(v).includes(q)),
    [q],
  );

  const { questions, requests, currentUserId } = feed;
  const { matchesLocation } = loc;

  const derived = useMemo(() => {
    const qSearch = (x: any) =>
      matches([x.title, x.body, x.profiles?.display_name, x.profiles?.username, x.city, x.district, x.category]);
    const rSearch = (x: any) =>
      matches([x.title, x.description, x.profiles?.display_name, x.profiles?.username, x.city, x.district, x.category]);

    const filteredQuestions = questions.filter(x => qSearch(x) && matchesLocation(x));
    const filteredRequests = requests.filter(x => rSearch(x) && matchesLocation(x));
    const myQuestions = questions.filter(x => x.author_id === currentUserId);
    const myRequests = requests.filter(x => x.requester_id === currentUserId);

    return {
      filteredQuestions,
      filteredRequests,
      myCount: myQuestions.length + myRequests.length,
      filteredMyQuestions: myQuestions.filter(qSearch),
      filteredMyRequests: myRequests.filter(rSearch),
      emergency: filteredQuestions.filter(isEmergencyQuestion),
      tools: filteredQuestions.filter(isToolQuestion),
    };
  }, [questions, requests, currentUserId, matches, matchesLocation]);

  const items: FeedItem[] = useMemo(() => {
    switch (activeTab) {
      case 'emergency': return toFeed(derived.emergency, []);
      case 'tools': return toFeed(derived.tools, []);
      case 'questions': return toFeed(derived.filteredQuestions, []);
      case 'requests': return toFeed([], derived.filteredRequests);
      case 'mine': return toFeed(derived.filteredMyQuestions, derived.filteredMyRequests);
      default: return toFeed(derived.filteredQuestions, derived.filteredRequests);
    }
  }, [activeTab, derived]);

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

  const handleLocationSelect = useCallback(
    (region: string, city: string, district: string) => {
      loc.apply({ region, city, district });
      const incomplete =
        !region || !city || !district ||
        city === 'كل المدن' || district === 'كل الأحياء' || district === 'كل أحياء المدينة';
      if (incomplete) {
        showToast('حدد المنطقة والمدينة والحي لإكمال موقعك');
        return;
      }
      void savePermanentMyLocation({ region, city, district }, true);
    },
    [loc.apply, showToast],
  );

  const emergencyTop = derived.emergency[0];

  return (
    <View style={styles.container}>
      <LocationGateModal
        visible={loc.setupOpen}
        busy={loc.setupBusy}
        message={loc.setupMessage}
        region={loc.region}
        city={loc.city}
        district={loc.district}
        hasExactLocation={loc.hasExactLocation}
        onSetupLocation={loc.setupRequiredLocation}
        onEnableNotifications={loc.enableNotifications}
      />

      <WeeklyLocationPrompt
        visible={loc.promptVisible && !loc.setupOpen}
        onAllow={loc.acceptWeeklyCheck}
        onLater={loc.snoozePrompt}
      />

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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
        <HomeHero
          profile={feed.profile}
          logoUri={logoUri}
          greeting={greeting}
          unreadCount={feed.unreadNotifCount}
          city={loc.city}
          district={loc.district}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onOpenLocation={() => setShowLocationModal(true)}
        />

        <AtmosphereBar
          weather={loc.weather}
          weatherLoading={loc.weatherLoading}
          activeNeighbors={activeNeighbors}
          emergencyCount={derived.emergency.length}
        />

        <StoriesRow profile={feed.profile} stories={feed.stories} selectedDistrict={loc.district} />

        {emergencyTop && (
          <View style={styles.emergencyHomeCard}>
            <View style={styles.emergencyHomeHeader}>
              <View style={styles.emergencyLiveBadge}>
                <Text style={styles.emergencyLiveText}>مباشر الآن</Text>
              </View>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                <Flame size={18} color="#dc2626" />
                <Text style={styles.emergencyHomeTitle}>تنبيه طارئ عاجل في الحي</Text>
              </View>
            </View>
            <Pressable
              onPress={() => router.push({ pathname: '/question', params: { id: emergencyTop.id } })}
              style={styles.emergencyContentBox}
              accessibilityRole="button"
              accessibilityLabel={`بلاغ طارئ: ${emergencyTop.title}`}
            >
              <Text style={styles.emergencyQuestionTitle}>{emergencyTop.title}</Text>
              <Text style={styles.emergencyQuestionSub}>اضغط للتفاصيل والمساعدة الفورية من أهل الحي ←</Text>
            </Pressable>
          </View>
        )}

        <ServicesGrid
          onTools={() => {
            setActiveTab('tools');
            showToast('أدوات ومعدات متاحة للإعارة بين الجيران');
          }}
        />

        <View style={styles.feedSection}>
          <FeedTabs
            activeTab={activeTab}
            onChange={setActiveTab}
            counts={{
              mine: derived.myCount,
              emergency: derived.emergency.length,
              tools: derived.tools.length,
              questions: derived.filteredQuestions.length,
              requests: derived.filteredRequests.length,
            }}
          />

          {feed.error && <ErrorBanner message={feed.error} onRetry={feed.reload} />}

          {feed.loading ? (
            <FeedSkeleton />
          ) : items.length === 0 ? (
            <EmptyState tab={activeTab} searching={searching} city={loc.city} hasExactLocation={loc.hasExactLocation} />
          ) : (
            items.map(item => (
              <TwitterInquiryCard
                key={`${activeTab}-${item.type}-${item.data.id}`}
                type={item.type}
                data={item.data}
                currentUserProfile={feed.profile}
                currentUserId={feed.currentUserId}
                isMine={activeTab === 'mine' ? true : undefined}
                onQuickReply={handleQuickReply}
                onToast={showToast}
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
                <Text style={styles.loadMoreText}>عرض المزيد</Text>
              )}
            </Pressable>
          )}

          <View style={{ height: 130 }} />
        </View>
      </ScrollView>

      <Animated.View style={[styles.fabContainer, { transform: [{ scale: pulseAnim }] }]}>
        <Pressable
          style={styles.fabBtn}
          onPress={() => router.push('/ask')}
          accessibilityRole="button"
          accessibilityLabel="اسأل أهل حيك"
        >
          <LinearGradient
            colors={['#065f46', '#059669', '#10b981']}
            style={styles.fabGrad}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Plus size={20} color="#fff" />
            <Text style={styles.fabText}>اسأل أهل حيك</Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>

      <View style={styles.bottomNavWrapper}>
        <BottomNav />
      </View>

      <LocationSelectorModal
        visible={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        selectedCity={loc.city}
        selectedDistrict={loc.district}
        onSelect={handleLocationSelect}
      />
    </View>
  );
}
