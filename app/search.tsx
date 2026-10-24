import { HeaderAction } from '@/components/shared/AppHeader';
import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Image,
  Platform,
  Linking,
} from 'react-native';
const HAYNA_ACTION_ART = { uri: Platform.OS === 'web' ? '/images/buttons/hayna-login-button-bg.png' : 'https://appksatest.vercel.app/images/buttons/hayna-login-button-bg.png' };

import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import {
  Search as SearchIcon,
  MessageCircle,
  Truck,
  Store,
  MapPin,
  X,
  ChevronLeft,
  Phone,
  Flame,
  Users,
  Clock,
  Sparkles,
  Star,
  CheckCircle2,
  Trash2,
  ArrowRight,
} from 'lucide-react-native';
import { areaLabel } from '@/lib/privacy';
import { relativeTime } from '@/lib/mapPins';
import { useBottomNavInset } from '@/lib/bottomNav';
import AppHeader from '@/components/shared/AppHeader';

type Row = Record<string, any>;
type Tab = 'all' | 'users' | 'questions' | 'requests' | 'shops';

/** RLS and column names drift between deployments, so every query degrades instead of throwing. */
async function searchRows(
  table: string,
  term: string,
  columns: string[],
  fallbacks: string[],
  limit = 12,
): Promise<Row[]> {
  // Keep the search scoped to literal text; PostgREST's .or() syntax uses commas
  // as separators, so strip filter-control characters before building the query.
  const pattern = (term.includes('%') ? term : `%${term}%`)
    .replace(/[(),]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!pattern || pattern === '%%') return [];

  const run = async (order: boolean, cols: string[]) => {
    let query = supabase.from(table).select('*');
    if (order) query = query.order('created_at', { ascending: false });
    return query.or(cols.map((column) => `${column}.ilike.${pattern}`).join(',')).limit(limit);
  };

  const attempts: Array<() => PromiseLike<{ data: unknown; error: unknown }>> = [
    () => run(true, columns),
    () => run(false, columns),
    ...fallbacks.map((column) => () => run(false, [column])),
  ];

  for (const attempt of attempts) {
    try {
      const { data, error } = await attempt();
      if (!error) return (data as Row[]) ?? [];
    } catch {
      // Continue to a narrower schema-compatible query.
    }
  }
  return [];
}

async function searchUsers(term: string, limit = 15): Promise<Row[]> {
  const pattern = `%${term.replace(/[(),]/g, ' ').trim()}%`;
  const { data, error } = await supabase
    .from('profiles')
    .select('id,username,display_name,avatar_url,city,district,is_verified,show_in_search,profile_privacy,created_at')
    .eq('show_in_search', true)
    .or(`display_name.ilike.${pattern},username.ilike.${pattern},city.ilike.${pattern},district.ilike.${pattern}`)
    .limit(limit);

  if (error) {
    console.warn('Profile search unavailable:', error.message);
    return [];
  }

  return ((data as Row[]) ?? []).filter((profile) =>
    profile.show_in_search === true &&
    (!profile.profile_privacy || profile.profile_privacy === 'public')
  );
}

async function searchBusinesses(term: string, limit = 20): Promise<Row[]> {
  const [businesses, services] = await Promise.all([
    searchRows('businesses', term, ['name', 'description', 'city', 'district'], ['name'], limit),
    searchRows('services', term, ['name', 'description', 'category', 'subcategory', 'shop_name', 'city', 'district'], ['name'], limit),
  ]);

  const taggedItems: Row[] = [
    ...businesses.map((item: Row) => ({ ...item, __sourceTable: 'businesses' } as Row)),
    ...services.map((item: Row) => ({ ...item, __sourceTable: 'services' } as Row)),
  ];
  const unique = new Map<string, Row>();
  for (const item of taggedItems) {
    const key = `${item.id ?? ''}:${item.name ?? item.shop_name ?? ''}`;
    if (!unique.has(key)) {
      unique.set(key, {
        ...item,
        name: item.name || item.shop_name,
        category: item.category || item.subcategory,
      });
    }
  }
  return Array.from(unique.values()).slice(0, limit);
}

const TRENDING_KEYWORDS = [
  'سباك 🔧',
  'كهربائي ⚡',
  'توصيل مدارس 🚗',
  'إعارة دريل 🛠️',
  'صيانة مكيفات ❄️',
  'بقالة قريبة 🛒',
  'حلاق ✂️',
  'غسيل سيارات 🚙',
];

export default function SearchPage() {
  const params = useLocalSearchParams<{ q?: string; tab?: Tab }>();
  const bottomNavInset = useBottomNavInset();
  const [query, setQuery] = useState(params.q || '');
  const [activeTab, setActiveTab] = useState<Tab>(params.tab || 'all');
  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const searchSequence = useRef(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([
    'سباك بالحي',
    'توصيل مدارس',
    'إعارة سلم',
  ]);
  const [results, setResults] = useState<{
    users: Row[];
    questions: Row[];
    requests: Row[];
    shops: Row[];
  }>({ users: [], questions: [], requests: [], shops: [] });

  // Update query if params change
  useEffect(() => {
    if (params.q !== undefined && params.q !== query) {
      setQuery(params.q);
    }
  }, [params.q]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length > 0) {
        performSearch();
      } else {
        searchSequence.current += 1;
        setLoading(false);
        setResults({ users: [], questions: [], requests: [], shops: [] });
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSelectKeyword = (rawKeyword: string) => {
    const cleanWord = rawKeyword.replace(/[🔧⚡🚗🛠️❄️🛒✂️🚙]/gu, '').trim();
    setQuery(cleanWord);
    setRecentSearches((prev) => {
      const filtered = prev.filter((s) => s !== cleanWord);
      return [cleanWord, ...filtered].slice(0, 8);
    });
  };

  const removeRecentSearch = (itemToRemove: string) => {
    setRecentSearches((prev) => prev.filter((item) => item !== itemToRemove));
  };

  const performSearch = async () => {
    const sequence = ++searchSequence.current;
    const searchTerm = query.trim();
    if (!searchTerm) {
      setResults({ users: [], questions: [], requests: [], shops: [] });
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Query the live Supabase tables directly. Each table query respects its
      // own RLS policies; one missing/optional table must not cancel all results.
      const [authResult, usersResult, questionsResult, requestsResult, shopsResult] = await Promise.all([
        supabase.auth.getUser(),
        searchUsers(searchTerm),
        searchRows('questions', searchTerm, ['title', 'body', 'category', 'district', 'city'], ['title'], 20),
        searchRows('requests', searchTerm, ['title', 'description', 'request_type', 'district', 'city'], ['title'], 20),
        searchBusinesses(searchTerm, 30),
      ]);
      if (sequence !== searchSequence.current) return;

      const myId = authResult.data?.user?.id;
      let visibleUsers = usersResult;
      if (myId) {
        try {
          const { data: blocks } = await supabase
            .from('blocks')
            .select('blocker_id,blocked_id')
            .or(`blocker_id.eq.${myId},blocked_id.eq.${myId}`);
          const blocked = new Set<string>();
          (blocks || []).forEach((block: Row) => {
            if (block.blocker_id === myId) blocked.add(block.blocked_id);
            if (block.blocked_id === myId) blocked.add(block.blocker_id);
          });
          visibleUsers = visibleUsers.filter((profile: Row) => !blocked.has(profile.id));
        } catch {
          // Block filtering is best-effort; table RLS still applies to all queries.
        }
      }

      setResults({
        users: visibleUsers,
        questions: questionsResult,
        requests: requestsResult,
        shops: shopsResult,
      });
    } catch (error) {
      console.warn('Search failed:', error);
      if (sequence === searchSequence.current) {
        setResults({ users: [], questions: [], requests: [], shops: [] });
      }
    } finally {
      if (sequence === searchSequence.current) setLoading(false);
    }
  };

  const timeText = (createdAt?: string) => (createdAt ? relativeTime(createdAt) : '');

  const metaText = (row: Row) => {
    const parts = [areaLabel({ district: row.district, city: row.city })];
    const when = timeText(row.created_at);
    if (when) parts.push(when);
    return parts.join(' · ');
  };

  const total = results.users.length + results.questions.length + results.requests.length + results.shops.length;

  const renderUser = (u: any) => (
    <Pressable
      key={`u-${u.id}`}
      style={styles.userCard}
      onPress={() => router.push({ pathname: '/user', params: { id: u.id } })}
    >
      <View style={styles.cardHeaderRow}>
        <View style={styles.avatarWrapper}>
          {u.avatar_url ? (
            <Image source={{ uri: u.avatar_url }} style={styles.userAvatar} />
          ) : (
            <View style={styles.userAvatarFallback}>
              <Text style={styles.userAvatarLetter}>{u.display_name?.[0] || u.username?.[0] || 'ج'}</Text>
            </View>
          )}
          <View style={styles.onlineBadge} />
        </View>

        <View style={styles.userInfo}>
          <View style={styles.userNameRow}>
            <Text style={styles.userName} numberOfLines={1}>
              {u.display_name || u.username}
            </Text>
            <View style={styles.neighborBadge}>
              <CheckCircle2 size={11} color="#059669" />
              <Text style={styles.neighborBadgeText}>جار</Text>
            </View>
          </View>
          <Text style={styles.userHandle} numberOfLines={1}>
            @{u.username || 'user'} {u.city ? `· ${u.city}` : ''}
          </Text>
        </View>

        <View style={styles.visitProfileBtn}>
          <Text style={styles.visitProfileText}>زيارة</Text>
          <ChevronLeft size={14} color="#059669" />
        </View>
      </View>
    </Pressable>
  );

  const renderQuestion = (q: Row) => (
    <Pressable
      key={`q-${q.id}`}
      style={styles.postCard}
      onPress={() => router.push({ pathname: '/question', params: { id: q.id } })}
    >
      <View style={styles.cardTopRow}>
        <View style={styles.iconBoxGreen}>
          <MessageCircle size={18} color="#059669" />
        </View>
        <View style={styles.cardMainText}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {q.title}
          </Text>
          <Text style={styles.cardAuthor} numberOfLines={1}>
            من {q.profiles?.display_name || 'أحد جيران الحي'}
          </Text>
        </View>
        <ChevronLeft size={18} color="#94a3b8" />
      </View>

      <View style={styles.cardDivider} />

      <View style={styles.cardBottomRow}>
        <View style={styles.locationPill}>
          <MapPin size={12} color="#059669" />
          <Text style={styles.locationPillText} numberOfLines={1}>
            {metaText(q)}
          </Text>
        </View>
        <Text style={styles.privacyTag}>موقع تقريبي</Text>
      </View>
    </Pressable>
  );

  const renderRequest = (r: Row) => {
    const isClosed = r.status === 'completed' || r.status === 'closed';
    return (
      <Pressable
        key={`r-${r.id}`}
        style={styles.postCard}
        onPress={() => router.push({ pathname: '/request', params: { id: r.id } })}
      >
        <View style={styles.cardTopRow}>
          <View style={styles.iconBoxOrange}>
            <Truck size={18} color="#ea580c" />
          </View>
          <View style={styles.cardMainText}>
            <View style={styles.badgeRow}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {r.title}
              </Text>
              <View style={[styles.statusPill, isClosed ? styles.statusPillClosed : styles.statusPillOpen]}>
                <View style={[styles.statusDot, isClosed ? styles.statusDotClosed : styles.statusDotOpen]} />
                <Text style={[styles.statusPillText, isClosed ? styles.statusPillTextClosed : styles.statusPillTextOpen]}>
                  {isClosed ? 'مغلق' : 'متاح'}
                </Text>
              </View>
            </View>
            <Text style={styles.cardAuthor} numberOfLines={1}>
              نوع الطلب: {r.request_type || 'فزعة حارة'}
            </Text>
          </View>
          <ChevronLeft size={18} color="#94a3b8" />
        </View>

        <View style={styles.cardDivider} />

        <View style={styles.cardBottomRow}>
          <View style={styles.locationPill}>
            <MapPin size={12} color="#ea580c" />
            <Text style={styles.locationPillText} numberOfLines={1}>
              {metaText(r)}
            </Text>
          </View>
          <Text style={styles.privacyTag}>الحي فقط</Text>
        </View>
      </Pressable>
    );
  };

  const renderShop = (s: Row) => (
    <Pressable
      key={`s-${s.id}`}
      style={styles.postCard}
      onPress={() => router.push({ pathname: s.__sourceTable === 'services' ? '/service' : '/business', params: { id: s.id } })}
    >
      <View style={styles.cardTopRow}>
        <View style={styles.iconBoxTeal}>
          <Store size={18} color="#0f766e" />
        </View>
        <View style={styles.cardMainText}>
          <View style={styles.badgeRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {s.name || 'محل وخدمات الحي'}
            </Text>
            {s.rating != null ? (
              <View style={styles.ratingBadge}>
                <Star size={11} color="#f59e0b" fill="#f59e0b" />
                <Text style={styles.ratingBadgeText}>{Number(s.rating).toFixed(1)}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.cardAuthor} numberOfLines={1}>
            {[s.category, s.description].filter(Boolean).join(' · ') || 'خدمات مهنية وتجارية'}
          </Text>
        </View>
        <ChevronLeft size={18} color="#94a3b8" />
      </View>

      <View style={styles.cardDivider} />

      <View style={styles.cardBottomRow}>
        <View style={styles.locationPill}>
          <MapPin size={12} color="#0f766e" />
          <Text style={styles.locationPillText} numberOfLines={1}>
            {metaText(s)}
          </Text>
        </View>
        {s.phone ? (
          <Pressable
            style={styles.phoneActionBtn}
            onPress={(e) => {
              e.stopPropagation();
              Linking.openURL(`tel:${s.phone}`);
            }}
          >
            <Phone size={12} color="#0284c7" />
            <Text style={styles.phoneActionText}>{s.phone}</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <AppHeader
        variant="tab"
        title="البحث الشامل"
        subtitle={query.trim() ? `النتائج لكلمة: «${query.trim()}»` : 'ابحث في كل ما يخص حيك'}
        rightAction={
          <HeaderAction
            accessibilityLabel="فتح الخريطة" onPress={() => router.push('/map')}
            style={styles.headerMapBtn}
          >
            <MapPin size={17} color="#059669" />
          </HeaderAction>
        }
      />

      {/* Modern Search Input Capsule */}
      <View style={styles.searchBarContainer}>
        <View style={[styles.searchBox, isFocused && styles.searchBoxFocused]}>
          <View style={styles.searchIconBadge}>
            <SearchIcon size={17} color="#059669" />
          </View>

          <TextInput
            style={styles.searchInput}
            placeholder="ابحث عن جيران، أسئلة، فزعات، محلات..."
            placeholderTextColor="#94a3b8"
            value={query}
            onChangeText={setQuery}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            autoFocus={!params.q}
            selectionColor="#059669"
            returnKeyType="search"
            onSubmitEditing={() => {
              if (query.trim()) {
                handleSelectKeyword(query.trim());
              }
            }}
          />

          {query.length > 0 && (
            <Pressable
              onPress={() => {
                setQuery('');
                setResults({ users: [], questions: [], requests: [], shops: [] });
              }}
              style={styles.clearBtn}
              hitSlop={8}
            >
              <X size={15} color="#64748b" />
            </Pressable>
          )}
        </View>
      </View>

      {/* Modern Pills Filter Tabs */}
      <View style={styles.tabsWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
          <Pressable
            style={[styles.tab, activeTab === 'all' && styles.tabActive]}
            onPress={() => setActiveTab('all')}
          >
            {activeTab === 'all' && <Image source={HAYNA_ACTION_ART} resizeMode="stretch" pointerEvents="none" style={StyleSheet.absoluteFillObject} />}
            <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
              الكل {total > 0 ? `(${total})` : ''}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.tab, activeTab === 'users' && styles.tabActive]}
            onPress={() => setActiveTab('users')}
          >
            {activeTab === 'users' && <Image source={HAYNA_ACTION_ART} resizeMode="stretch" pointerEvents="none" style={StyleSheet.absoluteFillObject} />}
            <Users size={13} color={activeTab === 'users' ? '#ffffff' : '#64748b'} />
            <Text style={[styles.tabText, activeTab === 'users' && styles.tabTextActive]}>
              الجيران {results.users.length > 0 ? `(${results.users.length})` : ''}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.tab, activeTab === 'questions' && styles.tabActive]}
            onPress={() => setActiveTab('questions')}
          >
            {activeTab === 'questions' && <Image source={HAYNA_ACTION_ART} resizeMode="stretch" pointerEvents="none" style={StyleSheet.absoluteFillObject} />}
            <MessageCircle size={13} color={activeTab === 'questions' ? '#ffffff' : '#64748b'} />
            <Text style={[styles.tabText, activeTab === 'questions' && styles.tabTextActive]}>
              أسئلة {results.questions.length > 0 ? `(${results.questions.length})` : ''}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.tab, activeTab === 'requests' && styles.tabActive]}
            onPress={() => setActiveTab('requests')}
          >
            {activeTab === 'requests' && <Image source={HAYNA_ACTION_ART} resizeMode="stretch" pointerEvents="none" style={StyleSheet.absoluteFillObject} />}
            <Truck size={13} color={activeTab === 'requests' ? '#ffffff' : '#64748b'} />
            <Text style={[styles.tabText, activeTab === 'requests' && styles.tabTextActive]}>
              فزعات {results.requests.length > 0 ? `(${results.requests.length})` : ''}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.tab, activeTab === 'shops' && styles.tabActive]}
            onPress={() => setActiveTab('shops')}
          >
            {activeTab === 'shops' && <Image source={HAYNA_ACTION_ART} resizeMode="stretch" pointerEvents="none" style={StyleSheet.absoluteFillObject} />}
            <Store size={13} color={activeTab === 'shops' ? '#ffffff' : '#64748b'} />
            <Text style={[styles.tabText, activeTab === 'shops' && styles.tabTextActive]}>
              محلات {results.shops.length > 0 ? `(${results.shops.length})` : ''}
            </Text>
          </Pressable>
        </ScrollView>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: bottomNavInset + 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#059669" />
            <Text style={styles.loadingText}>جارٍ البحث في قاعدة بيانات حيك...</Text>
          </View>
        )}

        {!loading && query.trim().length > 0 && (
          <View style={styles.resultsContainer}>
            {/* Search Summary Header */}
            <View style={styles.summaryBanner}>
              <View style={styles.summaryRight}>
                <Sparkles size={16} color="#059669" />
                <Text style={styles.summaryTitle}>
                  نتائج البحث عن: «{query.trim()}»
                </Text>
              </View>
              <View style={styles.summaryBadge}>
                <Text style={styles.summaryBadgeText}>{total} نتيجة</Text>
              </View>
            </View>

            {/* Users Section */}
            {(activeTab === 'all' || activeTab === 'users') && results.users.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionHeaderTitle}>
                    <Users size={16} color="#059669" />
                    <Text style={styles.sectionTitle}>الجيران في الحي</Text>
                  </View>
                  <View style={styles.badgeCount}>
                    <Text style={styles.badgeText}>{results.users.length}</Text>
                  </View>
                </View>
                {results.users.map(renderUser)}
              </View>
            )}

            {/* Questions Section */}
            {(activeTab === 'all' || activeTab === 'questions') && results.questions.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionHeaderTitle}>
                    <MessageCircle size={16} color="#059669" />
                    <Text style={styles.sectionTitle}>الأسئلة والاستفسارات</Text>
                  </View>
                  <View style={styles.badgeCount}>
                    <Text style={styles.badgeText}>{results.questions.length}</Text>
                  </View>
                </View>
                {results.questions.map(renderQuestion)}
              </View>
            )}

            {/* Requests Section */}
            {(activeTab === 'all' || activeTab === 'requests') && results.requests.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionHeaderTitle}>
                    <Truck size={16} color="#ea580c" />
                    <Text style={styles.sectionTitle}>طلبات الفزعة والمساعدة</Text>
                  </View>
                  <View style={[styles.badgeCount, { backgroundColor: '#fff7ed' }]}>
                    <Text style={[styles.badgeText, { color: '#ea580c' }]}>{results.requests.length}</Text>
                  </View>
                </View>
                {results.requests.map(renderRequest)}
              </View>
            )}

            {/* Shops Section */}
            {(activeTab === 'all' || activeTab === 'shops') && results.shops.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionHeaderTitle}>
                    <Store size={16} color="#0f766e" />
                    <Text style={styles.sectionTitle}>المحلات والخدمات</Text>
                  </View>
                  <View style={[styles.badgeCount, { backgroundColor: '#f0fdfa' }]}>
                    <Text style={[styles.badgeText, { color: '#0f766e' }]}>{results.shops.length}</Text>
                  </View>
                </View>
                {results.shops.map(renderShop)}
              </View>
            )}

            {total === 0 && (
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconBg}>
                  <SearchIcon size={36} color="#94a3b8" />
                </View>
                <Text style={styles.emptyText}>لم نجد نتائج تطابق «{query}»</Text>
                <Text style={styles.emptySub}>
                  جرب البحث بكلمات عامة مثل (سباك، توصيل، كهرباء، إعارة) أو تصفح الأقسام المقترحة أدناه.
                </Text>
                <Pressable
                  style={styles.clearSearchBtn}
                  onPress={() => {
                    setQuery('');
                    setActiveTab('all');
                  }}
                >
                  <Text style={styles.clearSearchBtnText}>مسح البحث والبدء من جديد</Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {/* Discovery Hub when query is empty */}
        {!loading && query.trim().length === 0 && (
          <View style={styles.discoveryWrapper}>
            {/* Friendly Neighborhood Welcome Capsule */}
            <View style={styles.welcomeBanner}>
              <View style={styles.welcomeBannerIcon}>
                <Sparkles size={20} color="#059669" />
              </View>
              <View style={styles.welcomeBannerContent}>
                <Text style={styles.welcomeBannerTitle}>ابحث عن أي شيء في حيك</Text>
                <Text style={styles.welcomeBannerSub}>
                  تواصل مع الجيران، استعر أدوات، أو استفسر عن خدمات قريبة منك بكل سهولة.
                </Text>
              </View>
            </View>

            {/* Trending Keywords */}
            <View style={styles.discoverySection}>
              <View style={styles.discoverySectionTitleRow}>
                <Flame size={18} color="#ea580c" />
                <Text style={styles.discoverySectionTitle}>الأكثر بحثاً في الحي الآن</Text>
              </View>
              <View style={styles.tagsGrid}>
                {TRENDING_KEYWORDS.map((kw) => (
                  <Pressable
                    key={kw}
                    onPress={() => handleSelectKeyword(kw)}
                    style={styles.keywordTag}
                  >
                    <Text style={styles.keywordTagText}>{kw}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Quick Explore Hub (4 Categories) */}
            <View style={styles.discoverySection}>
              <View style={styles.discoverySectionTitleRow}>
                <Sparkles size={18} color="#059669" />
                <Text style={styles.discoverySectionTitle}>استكشف حسب القسم</Text>
              </View>
              <View style={styles.categoryGrid}>
                <Pressable
                  style={styles.categoryCard}
                  onPress={() => {
                    setActiveTab('users');
                    setQuery('حي');
                  }}
                >
                  <View style={[styles.categoryIconBox, { backgroundColor: '#ecfdf5' }]}>
                    <Users size={20} color="#059669" />
                  </View>
                  <Text style={styles.categoryCardTitle}>جيران الحي</Text>
                  <Text style={styles.categoryCardSub}>أهل حيك وأصحاب المهارات</Text>
                </Pressable>

                <Pressable
                  style={styles.categoryCard}
                  onPress={() => {
                    setActiveTab('questions');
                    setQuery('توصية');
                  }}
                >
                  <View style={[styles.categoryIconBox, { backgroundColor: '#eff6ff' }]}>
                    <MessageCircle size={20} color="#2563eb" />
                  </View>
                  <Text style={styles.categoryCardTitle}>أسئلة واستفسارات</Text>
                  <Text style={styles.categoryCardSub}>تجارب وتوصيات الجيران</Text>
                </Pressable>

                <Pressable
                  style={styles.categoryCard}
                  onPress={() => {
                    setActiveTab('requests');
                    setQuery('مساعدة');
                  }}
                >
                  <View style={[styles.categoryIconBox, { backgroundColor: '#fff7ed' }]}>
                    <Truck size={20} color="#ea580c" />
                  </View>
                  <Text style={styles.categoryCardTitle}>فزعات وطلبات</Text>
                  <Text style={styles.categoryCardSub}>إعارة ومساعدات الجيران</Text>
                </Pressable>

                <Pressable
                  style={styles.categoryCard}
                  onPress={() => {
                    setActiveTab('shops');
                    setQuery('محل');
                  }}
                >
                  <View style={[styles.categoryIconBox, { backgroundColor: '#f0fdfa' }]}>
                    <Store size={20} color="#0f766e" />
                  </View>
                  <Text style={styles.categoryCardTitle}>محلات وخدمات</Text>
                  <Text style={styles.categoryCardSub}>المتاجر والفنيين القريبين</Text>
                </Pressable>
              </View>
            </View>

            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <View style={styles.recentSearchesCard}>
                <View style={styles.recentHeader}>
                  <View style={styles.recentHeaderTitleRow}>
                    <Clock size={16} color="#64748b" />
                    <Text style={styles.recentTitle}>سجل البحث الأخير</Text>
                  </View>
                  <Pressable
                    onPress={() => setRecentSearches([])}
                    hitSlop={8}
                    style={styles.clearRecentBtn}
                  >
                    <Trash2 size={13} color="#ef4444" />
                    <Text style={styles.clearRecentText}>مسح السجل</Text>
                  </Pressable>
                </View>
                <View style={styles.recentChipsRow}>
                  {recentSearches.map((item, idx) => (
                    <View key={idx} style={styles.recentChipWrapper}>
                      <Pressable
                        onPress={() => handleSelectKeyword(item)}
                        style={styles.recentChip}
                      >
                        <Text style={styles.recentChipText}>{item}</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => removeRecentSearch(item)}
                        style={styles.recentChipDelete}
                        hitSlop={6}
                      >
                        <X size={12} color="#94a3b8" />
                      </Pressable>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  headerMapBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  searchBarContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: '#ffffff',
  },
  searchBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    paddingHorizontal: 12,
    height: 48,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  searchBoxFocused: {
    borderColor: '#059669',
    backgroundColor: '#ffffff',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  searchIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: '#0f172a',
    fontWeight: '700',
    textAlign: 'right',
    height: 44,
    padding: 0,
  },
  clearBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsWrapper: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  tabsScroll: {
    flexDirection: 'row-reverse',
    gap: 8,
    alignItems: 'center',
  },
  tab: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7.5,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tabActive: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  tabText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#ffffff',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingTop: 12,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    color: '#059669',
    fontWeight: '800',
  },
  resultsContainer: {
    paddingHorizontal: 16,
  },
  summaryBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12
  },
  summaryRight: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  summaryTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  summaryBadge: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  summaryBadgeText: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#059669',
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionHeaderTitle: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0f172a',
  },
  badgeCount: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    color: '#059669',
    fontSize: 11.5,
    fontWeight: '900',
  },
  userCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  cardHeaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  avatarWrapper: {
    position: 'relative',
    marginLeft: 12,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  userAvatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#a7f3d0',
  },
  userAvatarLetter: {
    fontSize: 20,
    fontWeight: '900',
    color: '#059669',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10b981',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  userInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  userNameRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  userName: {
    fontSize: 14.5,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'right',
  },
  neighborBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 8,
  },
  neighborBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#059669',
  },
  userHandle: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    textAlign: 'right',
  },
  visitProfileBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    marginRight: 6,
  },
  visitProfileText: {
    color: '#059669',
    fontSize: 11.5,
    fontWeight: '800',
  },
  postCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb'
  },
  cardTopRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  iconBoxGreen: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  iconBoxOrange: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  iconBoxTeal: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#f0fdfa',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#99f6e4',
  },
  cardMainText: {
    flex: 1,
    alignItems: 'flex-end',
  },
  badgeRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  cardTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'right',
  },
  cardAuthor: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
    textAlign: 'right',
    marginTop: 2,
  },
  statusPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusPillOpen: {
    backgroundColor: '#ecfdf5',
  },
  statusPillClosed: {
    backgroundColor: '#f1f5f9',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotOpen: {
    backgroundColor: '#10b981',
  },
  statusDotClosed: {
    backgroundColor: '#94a3b8',
  },
  statusPillText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  statusPillTextOpen: {
    color: '#059669',
  },
  statusPillTextClosed: {
    color: '#64748b',
  },
  ratingBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  ratingBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#d97706',
  },
  cardDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 10,
  },
  cardBottomRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  locationPill: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  locationPillText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
    textAlign: 'right',
  },
  privacyTag: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#b45309',
    backgroundColor: '#fef3c7',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  phoneActionBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  phoneActionText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0284c7',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    paddingHorizontal: 20,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginTop: 8
  },
  emptyIconBg: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyText: {
    fontSize: 15.5,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 12.5,
    color: '#64748b',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  clearSearchBtn: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  clearSearchBtnText: {
    color: '#059669',
    fontSize: 12.5,
    fontWeight: '800',
  },
  discoveryWrapper: {
    paddingHorizontal: 16,
    gap: 18,
  },
  welcomeBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 10
  },
  welcomeBannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  welcomeBannerContent: {
    flex: 1,
    alignItems: 'flex-end',
  },
  welcomeBannerTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'right',
    marginBottom: 3,
  },
  welcomeBannerSub: {
    fontSize: 11.5,
    color: '#64748b',
    fontWeight: '600',
    textAlign: 'right',
    lineHeight: 16,
  },
  discoverySection: {
    gap: 10,
  },
  discoverySectionTitleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  discoverySectionTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
  },
  tagsGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  keywordTag: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  keywordTagText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155',
  },
  categoryGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
  },
  categoryIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  categoryCardTitle: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'right',
  },
  categoryCardSub: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
    textAlign: 'right',
  },
  recentSearchesCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
  },
  recentHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recentHeaderTitleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  recentTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
  },
  clearRecentBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  clearRecentText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ef4444',
  },
  recentChipsRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
  },
  recentChipWrapper: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingLeft: 6,
  },
  recentChip: {
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  recentChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  recentChipDelete: {
    padding: 3,
  },
});
