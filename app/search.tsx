import { OasisEmptyIllustration } from '@/components/oasis/OasisEmptyIllustration';
import { OasisTextInput as TextInput, OasisPressable as Pressable, OasisSurface } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import { HeaderAction } from '@/components/shared/AppHeader';
import { useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Image, Platform, Linking } from 'react-native';

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
  const cleaned = term.replace(/[(),.%*_\\]/g, ' ').replace(/\s+/g, ' ').trim();
  const pattern = `%${cleaned}%`;
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
  const pattern = `%${term.replace(/^@/, '').replace(/[(),.%*_\\]/g, ' ').trim()}%`;
  const { data, error } = await supabase
    .from('profiles')
    .select('id,username,display_name,avatar_url,city,district,is_verified,show_in_search,profile_privacy,is_banned,created_at')
    .eq('show_in_search', true)
    .eq('is_banned', false)
    .or(`display_name.ilike.${pattern},username.ilike.${pattern},city.ilike.${pattern},district.ilike.${pattern}`)
    .limit(limit);

  if (error) {
    console.warn('Profile search unavailable:', error.message);
    return [];
  }

  return ((data as Row[]) ?? []).filter((profile) =>
    profile.show_in_search === true && profile.is_banned !== true &&
    (!profile.profile_privacy || profile.profile_privacy === 'public')
  );
}

async function searchBusinesses(term: string, limit = 20): Promise<Row[]> {
  const [businesses, services] = await Promise.all([
    searchRows('businesses', term, ['name', 'description', 'city', 'district'], ['name'], limit),
    searchRows('services', term, ['name', 'description', 'category', 'subcategory', 'shop_name', 'city', 'district'], ['name'], limit),
  ]);

  const taggedItems: Row[] = [
    ...businesses.filter((item: Row) => item.moderation_status === 'approved').map((item: Row) => ({ ...item, __sourceTable: 'businesses' } as Row)),
    ...services.filter((item: Row) => item.moderation_status === 'approved' && item.activity_status !== 'inactive').map((item: Row) => ({ ...item, __sourceTable: 'services' } as Row)),
  ];
  const unique = new Map<string, Row>();
  for (const item of taggedItems) {
    const key = `${item.__sourceTable}:${item.id ?? ''}`;
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
  'سباك',
  'كهربائي',
  'توصيل مدارس',
  'إعارة أدوات',
  'صيانة مكيفات',
  'بقالة قريبة',
  'حلاق',
  'غسيل سيارات',
];

export default function SearchPage() {
  const params = useLocalSearchParams<{ q?: string; tab?: Tab }>();
  const bottomNavInset = useBottomNavInset();
  const [query, setQuery] = useState(params.q || '');
  const [activeTab, setActiveTab] = useState<Tab>(['all', 'users', 'questions', 'requests', 'shops'].includes(params.tab || '') ? params.tab! : 'all');
  const [loading, setLoading] = useState(false);
  const [localOnly, setLocalOnly] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const searchSequence = useRef(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [results, setResults] = useState<{
    users: Row[];
    questions: Row[];
    requests: Row[];
    shops: Row[];
  }>({ users: [], questions: [], requests: [], shops: [] });

  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem('hayna_recent_searches').then(value => {
      if (!mounted || !value) return;
      try {
        const saved = JSON.parse(value);
        if (Array.isArray(saved)) setRecentSearches(saved.filter((s): s is string => typeof s === 'string').slice(0, 8));
      } catch { /* Ignore corrupt local search history. */ }
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  const saveRecentSearches = (items: string[]) => {
    setRecentSearches(items);
    void AsyncStorage.setItem('hayna_recent_searches', JSON.stringify(items)).catch(() => {});
  };

  // Update query if params change
  useEffect(() => {
    if (params.q !== undefined && params.q !== query) {
      setQuery(params.q);
    }
  }, [params.q]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length > 0) {
        void performSearch();
      } else {
        searchSequence.current += 1;
        setLoading(false);
        setResults({ users: [], questions: [], requests: [], shops: [] });
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query, localOnly]);

  const handleSelectKeyword = (rawKeyword: string) => {
    const cleanWord = rawKeyword.replace(/[🔧⚡🚗🛠️❄️🛒✂️🚙]/gu, '').trim();
    setQuery(cleanWord);
    saveRecentSearches([cleanWord, ...recentSearches.filter(s => s !== cleanWord)].slice(0, 8));
  };

  const removeRecentSearch = (itemToRemove: string) => {
    saveRecentSearches(recentSearches.filter((item) => item !== itemToRemove));
  };

  const performSearch = async () => {
    const sequence = ++searchSequence.current;
    const searchTerm = query.trim();
    if (!searchTerm) {
      searchSequence.current += 1;
      setResults({ users: [], questions: [], requests: [], shops: [] });
      setLoading(false);
      return;
    }

    setLoading(true);
    setResults({ users: [], questions: [], requests: [], shops: [] });
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
      let currentCity: string | null = null;
      if (localOnly && myId) {
        const { data: myProfile } = await supabase.from('profiles').select('city').eq('id', myId).maybeSingle();
        currentCity = myProfile?.city?.trim() || null;
      }
      const inCity = (row: Row) => !currentCity || String(row.city || '').trim() === currentCity;
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
        users: visibleUsers.filter(inCity),
        questions: questionsResult.filter(inCity),
        requests: requestsResult.filter(inCity),
        shops: shopsResult.filter(inCity),
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
  const selectedCount = activeTab === 'all' ? total : results[activeTab].length;

  const renderUser = (u: any) => (
    <Pressable oasisKind="card"
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
              <CheckCircle2 size={11} color={OASIS.colors.primary} />
              <Text style={styles.neighborBadgeText}>جار</Text>
            </View>
          </View>
          <Text style={styles.userHandle} numberOfLines={1}>
            @{u.username || 'user'} {u.city ? `· ${u.city}` : ''}
          </Text>
        </View>

        <View style={styles.visitProfileBtn}>
          <Text style={styles.visitProfileText}>زيارة</Text>
          <ChevronLeft size={14} color={OASIS.colors.primary} />
        </View>
      </View>
    </Pressable>
  );

  const renderQuestion = (q: Row) => (
    <Pressable oasisKind="card"
      key={`q-${q.id}`}
      style={styles.postCard}
      onPress={() => router.push({ pathname: '/question', params: { id: q.id } })}
    >
      <View style={styles.cardTopRow}>
        <View style={styles.iconBoxGreen}>
          <MessageCircle size={18} color={OASIS.colors.primary} />
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
          <MapPin size={12} color={OASIS.colors.primary} />
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
      <Pressable oasisKind="card"
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
    <Pressable oasisKind="card"
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
                <Star size={11} color={OASIS.colors.warning} fill={OASIS.colors.warning} />
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
          <Pressable oasisKind="action"
            style={styles.phoneActionBtn}
            onPress={(e) => {
              e.stopPropagation();
              Linking.openURL(`tel:${s.phone}`);
            }}
          >
            <Phone size={12} color={OASIS.colors.info} />
            <Text style={styles.phoneActionText}>{s.phone}</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );

  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <AppHeader
        variant="tab"
        title="استكشف"
        subtitle={undefined}
        rightAction={
          <HeaderAction
            accessibilityLabel="فتح الخريطة" onPress={() => router.push('/map')}
            style={styles.headerMapBtn}
          >
            <MapPin size={17} color={OASIS.colors.primary} />
          </HeaderAction>
        }
      />

      <Pressable onPress={() => setLocalOnly(v => !v)} accessibilityRole="button"
        style={{ alignSelf: 'flex-start', marginHorizontal: 16, marginVertical: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 12, backgroundColor: localOnly ? '#dcfce7' : '#f1f5f9' }}>
        <Text style={{ color: '#065f46', fontWeight: '600' }}>{localOnly ? '✓ داخل مدينتي' : 'تصفية حسب مدينتي'}</Text>
      </Pressable>
      {/* Modern Search Input Capsule */}
      <View style={styles.searchBarContainer}>
        <OasisSurface oasisSurface="field" style={[styles.searchBox, isFocused && styles.searchBoxFocused]}>
          <View style={styles.searchIconBadge}>
            <SearchIcon size={17} color={OASIS.colors.primary} />
          </View>

          <TextInput
            style={styles.searchInput}
            placeholder="ابحث عن جيران، أسئلة، فزعات، محلات..."
            placeholderTextColor="#94a3b8"
            value={query}
            onChangeText={setQuery}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            selectionColor={OASIS.colors.primary}
            returnKeyType="search"
            onSubmitEditing={() => {
              if (query.trim()) {
                handleSelectKeyword(query.trim());
              }
            }}
          />

          {query.length > 0 && (
            <Pressable oasisKind="icon"
              onPress={() => {
                setQuery('');
                setResults({ users: [], questions: [], requests: [], shops: [] });
              }}
              style={styles.clearBtn}
              hitSlop={8}
            >
              <X size={15} color={OASIS.colors.muted} />
            </Pressable>
          )}
        </OasisSurface>
      </View>

      {/* Modern Pills Filter Tabs */}
      <View style={styles.tabsWrapper}>
        <ScrollView style={{ direction: 'rtl' }} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.tabsScroll, { direction: 'ltr' }]}>
          <Pressable oasisKind="chip" oasisVariant={activeTab === 'all' ? 'primary' : 'secondary'}
            style={[styles.tab, activeTab === 'all' && styles.tabActive]}
            onPress={() => setActiveTab('all')}
          >

            <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
              الكل
            </Text>
          </Pressable>

          <Pressable oasisKind="chip" oasisVariant={activeTab === 'users' ? 'primary' : 'secondary'}
            style={[styles.tab, activeTab === 'users' && styles.tabActive]}
            onPress={() => setActiveTab('users')}
          >

            <Users size={13} color={activeTab === 'users' ? OASIS.colors.surface : OASIS.colors.muted} />
            <Text style={[styles.tabText, activeTab === 'users' && styles.tabTextActive]}>
              الجيران
            </Text>
          </Pressable>

          <Pressable oasisKind="chip" oasisVariant={activeTab === 'questions' ? 'primary' : 'secondary'}
            style={[styles.tab, activeTab === 'questions' && styles.tabActive]}
            onPress={() => setActiveTab('questions')}
          >

            <MessageCircle size={13} color={activeTab === 'questions' ? OASIS.colors.surface : OASIS.colors.muted} />
            <Text style={[styles.tabText, activeTab === 'questions' && styles.tabTextActive]}>
              الأسئلة
            </Text>
          </Pressable>

          <Pressable oasisKind="chip" oasisVariant={activeTab === 'requests' ? 'primary' : 'secondary'}
            style={[styles.tab, activeTab === 'requests' && styles.tabActive]}
            onPress={() => setActiveTab('requests')}
          >

            <Truck size={13} color={activeTab === 'requests' ? OASIS.colors.surface : OASIS.colors.muted} />
            <Text style={[styles.tabText, activeTab === 'requests' && styles.tabTextActive]}>
              الطلبات
            </Text>
          </Pressable>

          <Pressable oasisKind="chip" oasisVariant={activeTab === 'shops' ? 'primary' : 'secondary'}
            style={[styles.tab, activeTab === 'shops' && styles.tabActive]}
            onPress={() => setActiveTab('shops')}
          >

            <Store size={13} color={activeTab === 'shops' ? OASIS.colors.surface : OASIS.colors.muted} />
            <Text style={[styles.tabText, activeTab === 'shops' && styles.tabTextActive]}>
              المحلات
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
            <ActivityIndicator size="large" color={OASIS.colors.primary} />
            <Text style={styles.loadingText}>جارٍ البحث في قاعدة بيانات حيك...</Text>
          </View>
        )}

        {!loading && query.trim().length > 0 && (
          <View style={styles.resultsContainer}>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text style={{ color: OASIS.colors.ink, fontWeight: '800', fontSize: 14, textAlign: 'right' }}>نتائج الاستكشاف</Text>
              <Text style={{ color: OASIS.colors.muted, fontSize: 11 }}>{selectedCount} نتيجة</Text>
            </View>
            {/* Compact results without redundant section headers */}
            {(activeTab === 'all' || activeTab === 'users') && results.users.length > 0 && (
              <View style={styles.section}>
                {results.users.map(renderUser)}
              </View>
            )}

            {/* Questions Section */}
            {(activeTab === 'all' || activeTab === 'questions') && results.questions.length > 0 && (
              <View style={styles.section}>
                {results.questions.map(renderQuestion)}
              </View>
            )}

            {/* Requests Section */}
            {(activeTab === 'all' || activeTab === 'requests') && results.requests.length > 0 && (
              <View style={styles.section}>
                {results.requests.map(renderRequest)}
              </View>
            )}

            {/* Shops Section */}
            {(activeTab === 'all' || activeTab === 'shops') && results.shops.length > 0 && (
              <View style={styles.section}>
                {results.shops.map(renderShop)}
              </View>
            )}

            {selectedCount === 0 && (
              <View style={styles.emptyContainer}>
                <View style={{ alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}><OasisEmptyIllustration kind="empty-search" /></View>
                <Text style={styles.emptyText}>لا توجد نتائج في هذا القسم تطابق «{query}»</Text>
                <Text style={styles.emptySub}>
                  جرب البحث بكلمات عامة مثل (سباك، توصيل، كهرباء، إعارة) أو تصفح الأقسام المقترحة أدناه.
                </Text>
                <Pressable oasisKind="action"
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

        {!loading && !query.trim() && (
          <View style={{ paddingTop: 12, gap: 12 }}>
            <Text style={{ color: OASIS.colors.muted, textAlign: 'right', fontSize: 12 }}>ابحث في حيّك أو اختر تصنيفًا بالأعلى.</Text>
            {recentSearches.length > 0 && (
              <View style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ color: OASIS.colors.ink, fontWeight: '700', fontSize: 13 }}>آخر عمليات البحث</Text>
                  <Pressable onPress={() => saveRecentSearches([])}><Text style={{ color: OASIS.colors.muted, fontSize: 11 }}>مسح</Text></Pressable>
                </View>
                <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 7 }}>
                  {recentSearches.slice(0, 4).map(item => <Pressable key={item} oasisKind="chip" onPress={() => handleSelectKeyword(item)} style={styles.recentChip}><Text style={styles.recentChipText}>{item}</Text></Pressable>)}
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
    backgroundColor: OASIS.colors.background,
  },
  headerMapBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: OASIS.colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  searchBarContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: OASIS.colors.surface,
  },
  searchBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: OASIS.colors.background,
    borderRadius: 16,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1.5,
    borderColor: OASIS.colors.line,
    gap: 10,
  },
  searchBoxFocused: {
    borderColor: OASIS.colors.primary,
    backgroundColor: OASIS.colors.surface,
    shadowColor: OASIS.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0,
    shadowRadius: 6,
    elevation: 2,
  },
  searchIconBadge: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: OASIS.colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInput: {
    flex: 1,
    fontSize: 13.5,
    color: OASIS.colors.ink,
    fontWeight: '700',
    textAlign: 'right',
    height: 44,
    padding: 0,
  },
  clearBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: OASIS.colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsWrapper: {
    backgroundColor: OASIS.colors.surface,
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
    borderColor: OASIS.colors.line,
  },
  tabActive: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    shadowOpacity: 0,
    elevation: 0,
  },
  tabText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: OASIS.colors.muted,
  },
  tabTextActive: {
    color: OASIS.colors.surface,
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
    color: OASIS.colors.primary,
    fontWeight: '600',
  },
  resultsContainer: {
    paddingHorizontal: 16,
  },
  summaryBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: OASIS.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: OASIS.colors.line,
    marginBottom: 12
  },
  summaryRight: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  summaryTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: OASIS.colors.ink,
  },
  summaryBadge: {
    backgroundColor: OASIS.colors.soft,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  summaryBadgeText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: OASIS.colors.primary,
  },
  section: {
    marginBottom: 14,
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
    fontWeight: '700',
    color: OASIS.colors.ink,
  },
  badgeCount: {
    backgroundColor: OASIS.colors.soft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    color: OASIS.colors.primary,
    fontSize: 11.5,
    fontWeight: '700',
  },
  userCard: {
    backgroundColor: OASIS.colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: OASIS.colors.line
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
    borderColor: OASIS.colors.line,
  },
  userAvatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: OASIS.colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#a7f3d0',
  },
  userAvatarLetter: {
    fontSize: 20,
    fontWeight: '700',
    color: OASIS.colors.primary,
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: OASIS.colors.primary,
    borderWidth: 2,
    borderColor: OASIS.colors.surface,
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
    fontWeight: '700',
    color: OASIS.colors.ink,
    textAlign: 'right',
  },
  neighborBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
    backgroundColor: OASIS.colors.soft,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 8,
  },
  neighborBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: OASIS.colors.primary,
  },
  userHandle: {
    fontSize: 12,
    color: OASIS.colors.muted,
    fontWeight: '600',
    textAlign: 'right',
  },
  visitProfileBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 2,
    backgroundColor: OASIS.colors.soft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    marginRight: 6,
  },
  visitProfileText: {
    color: OASIS.colors.primary,
    fontSize: 11.5,
    fontWeight: '600',
  },
  postCard: {
    backgroundColor: OASIS.colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: OASIS.colors.line
  },
  cardTopRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  iconBoxGreen: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: OASIS.colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  iconBoxOrange: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#fff7ed',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#fed7aa',
  },
  iconBoxTeal: {
    width: 36,
    height: 36,
    borderRadius: 10,
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
    fontWeight: '600',
    color: OASIS.colors.ink,
    textAlign: 'right',
  },
  cardAuthor: {
    fontSize: 12,
    fontWeight: '600',
    color: OASIS.colors.muted,
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
    backgroundColor: OASIS.colors.soft,
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
    backgroundColor: OASIS.colors.primary,
  },
  statusDotClosed: {
    backgroundColor: '#94a3b8',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statusPillTextOpen: {
    color: OASIS.colors.primary,
  },
  statusPillTextClosed: {
    color: OASIS.colors.muted,
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
    fontWeight: '600',
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
    color: OASIS.colors.muted,
    textAlign: 'right',
  },
  privacyTag: {
    fontSize: 11,
    fontWeight: '600',
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
    backgroundColor: OASIS.colors.infoSoft,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bae6fd',
  },
  phoneActionText: {
    fontSize: 11,
    fontWeight: '600',
    color: OASIS.colors.info,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    backgroundColor: OASIS.colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: OASIS.colors.line,
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
    fontWeight: '700',
    color: OASIS.colors.ink,
    textAlign: 'center',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 12.5,
    color: OASIS.colors.muted,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  clearSearchBtn: {
    backgroundColor: OASIS.colors.soft,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  clearSearchBtnText: {
    color: OASIS.colors.primary,
    fontSize: 12.5,
    fontWeight: '600',
  },
  discoveryWrapper: {
    paddingHorizontal: 16,
    gap: 18,
  },
  welcomeBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: OASIS.colors.surface,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: OASIS.colors.line,
    gap: 10
  },
  welcomeBannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: OASIS.colors.soft,
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
    fontWeight: '700',
    color: OASIS.colors.ink,
    textAlign: 'right',
    marginBottom: 3,
  },
  welcomeBannerSub: {
    fontSize: 11.5,
    color: OASIS.colors.muted,
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
    fontWeight: '700',
    color: OASIS.colors.ink,
  },
  tagsGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  keywordTag: {
    backgroundColor: OASIS.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: OASIS.colors.line,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0,
    shadowRadius: 2,
    elevation: 1,
  },
  keywordTagText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: OASIS.colors.ink,
  },
  categoryGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryCard: {
    width: '48%',
    backgroundColor: OASIS.colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: OASIS.colors.line,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0,
    shadowRadius: 3,
    elevation: 1,
  },
  categoryIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  categoryCardTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: OASIS.colors.ink,
    textAlign: 'right',
  },
  categoryCardSub: {
    fontSize: 11,
    color: OASIS.colors.muted,
    fontWeight: '600',
    textAlign: 'right',
  },
  recentSearchesCard: {
    backgroundColor: OASIS.colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: OASIS.colors.line,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0,
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
    fontWeight: '700',
    color: OASIS.colors.ink,
  },
  clearRecentBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  clearRecentText: {
    fontSize: 11,
    fontWeight: '600',
    color: OASIS.colors.danger,
  },
  recentChipsRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
  },
  recentChipWrapper: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: OASIS.colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: OASIS.colors.line,
    paddingLeft: 6,
  },
  recentChip: {
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  recentChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: OASIS.colors.ink,
  },
  recentChipDelete: {
    padding: 3,
  },
});
