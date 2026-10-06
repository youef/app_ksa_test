import { useBottomNavInset } from '@/lib/bottomNav';
import { useEffect, useState, useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  Platform,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/ui';
import {
  HeartHandshake,
  Search,
  Plus,
  ChevronRight,
  ChevronDown,
  MapPin,
  Clock,
  AlertCircle,
  Banknote,
  Sparkles,
  X,
  ArrowRight,
  User,
  ShieldCheck,
  Flame,
  CheckCircle2,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenHeader from '@/components/shared/ScreenHeader';
import {
  getActiveLocation,
  subscribeLocation,
  isExactDistrictMatching,
  isLocationMatching,
  isAllKingdom,
} from '@/lib/locationSync';
import { relativeTime } from '@/lib/mapPins';

type FilterType = 'all' | 'urgent' | 'volunteer' | 'reward';

export default function Requests() {
  const bottomNavInset = useBottomNavInset();
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [activeLoc, setActiveLoc] = useState({
    region: 'كل المملكة',
    city: 'كل المدن',
    district: 'كل الأحياء',
  });

  async function load(q = '', location = activeLoc) {
    setLoading(true);
    setLoadError('');
    try {
      const { data: session } = await supabase.auth.getSession();
      if (session.session?.user) {
        const currentUid = session.session.user.id;
        let query = supabase.from('requests').select('*').order('created_at', { ascending: false }).limit(60);
        if (q.trim()) query = query.or(`title.ilike.%${q.trim()}%,description.ilike.%${q.trim()}%`);
        const result = await query;
        // Hide requests that are accepted or completed from other users
        const visibleRequests = (result.data ?? []).filter((r: any) =>
          r.status === 'open' || r.requester_id === currentUid || r.accepted_by === currentUid
        );
        setItems(visibleRequests);
      } else {
        const result = await supabase.rpc('hayna_guest_requests', {
          p_city: location.city,
          p_district: location.district,
          p_limit: 60,
        });
        if (result.error) throw result.error;
        const searchTerm = q.trim().toLocaleLowerCase('ar');
        setItems((result.data ?? []).filter((item: any) =>
          !searchTerm || `${item.title} ${item.description}`.toLocaleLowerCase('ar').includes(searchTerm)
        ));
      }
    } catch (e) {
      console.warn('Load requests error', e);
      setLoadError((e as any)?.code === 'PGRST202' ? 'يلزم تحديث قاعدة البيانات لعرض طلبات الحي للزوار.' : 'تعذر تحميل الطلبات. حاول مرة أخرى.');
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
    return items.filter(r => hasSession
      ? isExactDistrictMatching(r, activeLoc.city, activeLoc.district)
      : isLocationMatching(r, activeLoc.city, activeLoc.district)
    );
  }, [items, hasSession, activeLoc]);

  // Tab Filtering
  const displayedItems = useMemo(() => {
    return locationFilteredItems.filter(r => {
      if (activeFilter === 'urgent') return Boolean(r.is_urgent && r.status !== 'completed');
      if (activeFilter === 'volunteer') return (!r.budget || Number(r.budget) === 0) && r.status !== 'completed';
      if (activeFilter === 'reward') return Boolean(r.budget && Number(r.budget) > 0) && r.status !== 'completed';
      if (activeFilter === 'completed') return r.status === 'completed';
      return true;
    });
  }, [locationFilteredItems, activeFilter]);

  // Counts for pills
  const counts = useMemo(() => {
    return {
      all: locationFilteredItems.length,
      urgent: locationFilteredItems.filter(r => r.is_urgent && r.status !== 'completed').length,
      volunteer: locationFilteredItems.filter(r => (!r.budget || Number(r.budget) === 0) && r.status !== 'completed').length,
      reward: locationFilteredItems.filter(r => Boolean(r.budget && Number(r.budget) > 0) && r.status !== 'completed').length,
      completed: locationFilteredItems.filter(r => r.status === 'completed').length,
    };
  }, [locationFilteredItems]);

  const locationLabel = !isAllKingdom(activeLoc.city)
    ? `${activeLoc.city}${activeLoc.district !== 'كل الأحياء' ? ` · حي ${activeLoc.district}` : ''}`
    : 'كل مناطق المملكة';

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomNavInset + 30 }]}
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
        {/* Unified Luxury Header */}
        <LinearGradient
          colors={['#064e3b', '#065f46', '#047857']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <ScreenHeader
            title="فزعات وطلبات الحي 🤝"
            fallbackRoute="/home"
            rightAction={hasSession ? (
              <Pressable
                onPress={() => router.push('/new-request')}
                style={styles.addBtn}
                accessibilityRole="button"
                accessibilityLabel="إضافة طلب جديد"
              >
                <Plus size={16} color="#064e3b" />
                <Text style={styles.addBtnText}>طلب جديد</Text>
              </Pressable>
            ) : undefined}
          />

          <Pressable
            onPress={() => router.push('/locations')}
            style={styles.heroLocationRow}
            accessibilityRole="button"
            accessibilityLabel={`الموقع الحالي: ${locationLabel}، اضغط للتغيير`}
          >
            <ChevronDown size={13} color="#a7f3d0" />
            <Text style={styles.heroLocationText} numberOfLines={1}>
              {locationLabel}
            </Text>
            <MapPin size={13} color="#6ee7b7" />
          </Pressable>

          <Text style={styles.heroSubtitle}>
            منصة تعاون أهالي الحي: للمساعدة، التوصيل، الإعارة، والفزعة المتبادلة
          </Text>

          {/* Search Box */}
          <View style={styles.searchBar}>
            <Search size={18} color="#059669" />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={() => load(search, activeLoc)}
              placeholder="ابحث في طلبات الفزعة والمساعدة..."
              placeholderTextColor="#94a3b8"
              returnKeyType="search"
            />
            {search.length > 0 && (
              <Pressable
                onPress={() => {
                  setSearch('');
                  load('', activeLoc);
                }}
                style={styles.clearSearchBtn}
              >
                <X size={16} color="#94a3b8" />
              </Pressable>
            )}
          </View>
        </LinearGradient>

        {/* Filter Segment Chips */}
        <View style={styles.filterSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
          >
            <Pressable
              style={[styles.filterChip, activeFilter === 'all' && styles.filterChipActive]}
              onPress={() => setActiveFilter('all')}
            >
              <Text style={[styles.filterChipText, activeFilter === 'all' && styles.filterChipTextActive]}>
                كل الطلبات ({counts.all})
              </Text>
            </Pressable>

            <Pressable
              style={[styles.filterChip, activeFilter === 'urgent' && styles.filterChipUrgentActive]}
              onPress={() => setActiveFilter('urgent')}
            >
              <AlertCircle size={14} color={activeFilter === 'urgent' ? '#fff' : '#ef4444'} />
              <Text style={[styles.filterChipText, activeFilter === 'urgent' && styles.filterChipTextActive]}>
                فزعات عاجلة 🚨 ({counts.urgent})
              </Text>
            </Pressable>

            <Pressable
              style={[styles.filterChip, activeFilter === 'volunteer' && styles.filterChipActive]}
              onPress={() => setActiveFilter('volunteer')}
            >
              <HeartHandshake size={14} color={activeFilter === 'volunteer' ? '#fff' : '#059669'} />
              <Text style={[styles.filterChipText, activeFilter === 'volunteer' && styles.filterChipTextActive]}>
                تطوع ومساعدة 🤝 ({counts.volunteer})
              </Text>
            </Pressable>

            <Pressable
              style={[styles.filterChip, activeFilter === 'reward' && styles.filterChipActive]}
              onPress={() => setActiveFilter('reward')}
            >
              <Banknote size={14} color={activeFilter === 'reward' ? '#fff' : '#15803d'} />
              <Text style={[styles.filterChipText, activeFilter === 'reward' && styles.filterChipTextActive]}>
                بمكافأة مالية 💰 ({counts.reward})
              </Text>
            </Pressable>

            {counts.completed > 0 && (
              <Pressable
                style={[styles.filterChip, activeFilter === 'completed' && styles.filterChipCompletedActive]}
                onPress={() => setActiveFilter('completed')}
              >
                <CheckCircle2 size={14} color={activeFilter === 'completed' ? '#fff' : '#059669'} />
                <Text style={[styles.filterChipText, activeFilter === 'completed' && styles.filterChipTextActive]}>
                  تمت الفزعة ☕ ({counts.completed})
                </Text>
              </Pressable>
            )}
          </ScrollView>
        </View>

        {/* Content Section */}
        <View style={styles.content}>
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#059669" />
              <Text style={styles.loadingText}>جاري تحميل طلبات الجيران...</Text>
            </View>
          ) : loadError ? (
            <View style={styles.emptyCard}>
              <HeartHandshake size={44} color="#f59e0b" />
              <Text style={styles.emptyTitle}>{loadError}</Text>
              <Pressable style={styles.emptyAddBtn} onPress={() => load(search, activeLoc)}>
                <Text style={styles.emptyAddBtnText}>إعادة المحاولة</Text>
              </Pressable>
            </View>
          ) : displayedItems.length === 0 ? (
            <View style={styles.emptyCard}>
              <HeartHandshake size={52} color="#94a3b8" />
              <Text style={styles.emptyTitle}>لا توجد طلبات فزعة حالياً</Text>
              <Text style={styles.emptySub}>
                {!isAllKingdom(activeLoc.city)
                  ? `لا توجد طلبات فزعة مسجلة حالياً في ${activeLoc.city}${activeLoc.district !== 'كل الأحياء' ? ` (حي ${activeLoc.district})` : ''}. كن أول من يطلب مساعدة جيرانه!`
                  : 'تحتاج مساعدة أو توصيل أو غرض؟ اطلب وخل جيرانك يفزعون لك!'}
              </Text>
              {hasSession && (
                <Pressable
                  style={styles.emptyAddBtn}
                  onPress={() => router.push('/new-request')}
                >
                  <Plus size={18} color="#fff" />
                  <Text style={styles.emptyAddBtnText}>إضافة طلب فزعة جديد</Text>
                </Pressable>
              )}
            </View>
          ) : (
            displayedItems.map(req => {
              const timeLabel = req.created_at ? relativeTime(req.created_at) : '';
              return (
                <Pressable
                  key={req.id}
                  style={({ pressed }) => [
                    styles.card,
                    pressed && { transform: [{ scale: 0.99 }] },
                  ]}
                  onPress={() => router.push({ pathname: '/request', params: { id: req.id } })}
                >
                  {/* Card Header */}
                  <View style={styles.cardTopRow}>
                    <View style={styles.cardTitleWrap}>
                      {req.is_urgent && (
                        <View style={styles.urgentBadge}>
                          <Flame size={12} color="#dc2626" />
                          <Text style={styles.urgentBadgeText}>فزعة عاجلة</Text>
                        </View>
                      )}
                      {req.status === 'completed' && (
                        <View style={styles.completedCardPill}>
                          <CheckCircle2 size={11} color="#059669" />
                          <Text style={styles.completedCardPillText}>تمت الفزعة ✓</Text>
                        </View>
                      )}
                      <Text style={[styles.requestTitle, req.status === 'completed' && styles.requestTitleCompleted]} numberOfLines={2}>
                        {req.title}
                      </Text>
                    </View>
                  </View>

                  {/* Body description */}
                  <Text style={styles.requestDesc} numberOfLines={3}>
                    {req.description}
                  </Text>

                  {/* Meta Pills */}
                  <View style={styles.cardMetaRow}>
                    <View style={styles.locationPill}>
                      <MapPin size={11} color="#059669" />
                      <Text style={styles.locationPillText} numberOfLines={1}>
                        {req.district ? `حي ${req.district}` : req.city || 'داخل الحي'}
                      </Text>
                    </View>

                    {Boolean(timeLabel) && (
                      <View style={styles.timePill}>
                        <Clock size={11} color="#64748b" />
                        <Text style={styles.timePillText}>{timeLabel}</Text>
                      </View>
                    )}

                    {req.budget && Number(req.budget) > 0 ? (
                      <View style={styles.budgetPill}>
                        <Banknote size={12} color="#15803d" />
                        <Text style={styles.budgetPillText}>مكافأة: {req.budget} ر.س</Text>
                      </View>
                    ) : (
                      <View style={styles.volunteerPill}>
                        <HeartHandshake size={12} color="#059669" />
                        <Text style={styles.volunteerPillText}>فزعة وتطوع</Text>
                      </View>
                    )}
                  </View>

                  {/* Card Footer with CTA */}
                  <View style={styles.cardFooter}>
                    <View style={styles.cardAuthorRow}>
                      <View style={styles.authorAvatarCircle}>
                        <User size={13} color="#059669" />
                      </View>
                      <Text style={styles.authorNameText}>
                        {req.requester_name || 'أحد سكان الحي'}
                      </Text>
                    </View>

                    <View style={styles.cardCtaWrap}>
                      <Text style={styles.cardCtaText}>تقديم فزعة والتفاصيل</Text>
                      <ArrowRight size={13} color="#059669" />
                    </View>
                  </View>
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>
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
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
    paddingHorizontal: 16,
    paddingBottom: 22,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroLocationRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  heroLocationText: {
    color: '#ecfdf5',
    fontSize: 12,
    fontWeight: '800',
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12.5,
    textAlign: 'right',
    marginBottom: 14,
    lineHeight: 18,
    fontWeight: '600',
  },
  addBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  addBtnText: {
    color: '#064e3b',
    fontSize: 12.5,
    fontWeight: '900',
  },
  searchBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    paddingHorizontal: 14,
    height: 48,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    color: '#0f172a',
    fontSize: 13,
    textAlign: 'right',
  },
  clearSearchBtn: {
    padding: 6,
  },
  filterSection: {
    marginTop: 14,
    marginBottom: 4,
  },
  filterRow: {
    flexDirection: 'row-reverse',
    paddingHorizontal: 16,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ffffff',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterChipActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  filterChipUrgentActive: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  filterChipText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: '#ffffff',
    fontWeight: '900',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  loadingBox: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 10,
  },
  loadingText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
  },
  emptyTitle: {
    color: '#0f172a',
    fontSize: 17,
    fontWeight: '900',
    marginTop: 6,
  },
  emptySub: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  emptyAddBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 16,
  },
  emptyAddBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTopRow: {
    marginBottom: 8,
  },
  cardTitleWrap: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  requestTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
    textAlign: 'right',
    flex: 1,
    lineHeight: 22,
  },
  urgentBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fee2e2',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  urgentBadgeText: {
    color: '#dc2626',
    fontSize: 11,
    fontWeight: '900',
  },
  requestDesc: {
    color: '#475569',
    fontSize: 13.5,
    textAlign: 'right',
    lineHeight: 21,
    marginBottom: 12,
  },
  cardMetaRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  locationPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  locationPillText: {
    color: '#065f46',
    fontSize: 11,
    fontWeight: '800',
  },
  timePill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  timePillText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
  },
  budgetPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  budgetPillText: {
    color: '#15803d',
    fontSize: 11.5,
    fontWeight: '900',
  },
  volunteerPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
  },
  volunteerPillText: {
    color: '#059669',
    fontSize: 11.5,
    fontWeight: '900',
  },
  cardFooter: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: '#f1f5f9',
    paddingTop: 12,
  },
  cardAuthorRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  authorAvatarCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorNameText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },
  cardCtaWrap: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  cardCtaText: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '800',
  },
  filterChipCompletedActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  completedCardPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  completedCardPillText: {
    color: '#047857',
    fontSize: 11,
    fontWeight: '900',
  },
  requestTitleCompleted: {
    color: '#334155',
  },
});
