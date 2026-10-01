import { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/ui';
import {
  HeartHandshake,
  Search,
  Plus,
  ChevronRight,
  MapPin,
  Clock,
  AlertCircle,
  Banknote,
  Sparkles,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import BottomNav from '@/components/BottomNav';
import {
  getActiveLocation,
  subscribeLocation,
  isExactDistrictMatching,
  isAllKingdom,
} from '@/lib/locationSync';

export default function Requests() {
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [filterUrgent, setFilterUrgent] = useState(false);
  const [activeLoc, setActiveLoc] = useState({
    region: 'كل المملكة',
    city: 'كل المدن',
    district: 'كل الأحياء',
  });

  async function load(q = '', onlyUrgent = filterUrgent) {
    setLoading(true);
    try {
      let query = supabase
        .from('requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(60);

      if (q.trim()) {
        query = query.or(`title.ilike.%${q.trim()}%,description.ilike.%${q.trim()}%`);
      }
      if (onlyUrgent) {
        query = query.eq('is_urgent', true);
      }

      const r = await query;
      setItems(r.data ?? []);
    } catch (e) {
      console.warn('Load requests error', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    getActiveLocation().then(setActiveLoc);
    const unsub = subscribeLocation(setActiveLoc);
    load(search, filterUrgent);
    return unsub;
  }, [filterUrgent]);

  const displayedItems = items.filter((r) =>
    isExactDistrictMatching(r, activeLoc.city, activeLoc.district)
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Header Hero */}
        <LinearGradient
          colors={['#065f46', '#059669', '#10b981']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.navBar}>
            <Pressable onPress={() => router.back()} style={styles.iconBtn}>
              <ChevronRight size={26} color="#fff" />
            </Pressable>
            <Text style={styles.navTitle}>فزعة وطلبات الحي 🤝</Text>
            <Pressable onPress={() => router.push('/new-request')} style={styles.addBtn}>
              <Plus size={18} color="#059669" />
              <Text style={styles.addBtnText}>طلب جديد</Text>
            </Pressable>
          </View>
          <Text style={styles.heroSubtitle}>
            {!isAllKingdom(activeLoc.city)
              ? `طلبات واحتياجات جيرانك في ${activeLoc.city}${activeLoc.district !== 'كل الأحياء' ? ` · حي ${activeLoc.district}` : ''}`
              : 'فزعات وطلبات التعاون بين أهالي الحي في السعودية'}
          </Text>

          {/* Search Box */}
          <View style={styles.searchBar}>
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={() => load(search, filterUrgent)}
              placeholder="ابحث في طلبات الفزعة والمساعدة..."
              placeholderTextColor="#94a3b8"
            />
            <Pressable onPress={() => load(search, filterUrgent)}>
              <Search size={20} color="#059669" />
            </Pressable>
          </View>
        </LinearGradient>

        {/* Filter Bar */}
        <View style={styles.filterRow}>
          <Pressable
            style={[styles.filterChip, !filterUrgent && styles.filterChipActive]}
            onPress={() => setFilterUrgent(false)}
          >
            <Text style={[styles.filterChipText, !filterUrgent && styles.filterChipTextActive]}>
              كل الطلبات ({items.length})
            </Text>
          </Pressable>

          <Pressable
            style={[styles.filterChip, filterUrgent && styles.filterChipUrgentActive]}
            onPress={() => setFilterUrgent(true)}
          >
            <AlertCircle size={14} color={filterUrgent ? '#fff' : '#ef4444'} />
            <Text style={[styles.filterChipText, filterUrgent && styles.filterChipTextActive]}>
              طلبات عاجلة فزعة 🚨
            </Text>
          </Pressable>
        </View>

        {/* Requests List */}
        <View style={styles.content}>
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#059669" />
              <Text style={styles.loadingText}>جاري تحميل الطلبات...</Text>
            </View>
          ) : displayedItems.length === 0 ? (
            <View style={styles.emptyCard}>
              <HeartHandshake size={48} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>لا توجد طلبات فزعة حالياً</Text>
              <Text style={styles.emptySub}>
                {!isAllKingdom(activeLoc.city)
                  ? `لا توجد طلبات فزعة مسجلة حالياً في ${activeLoc.city}${activeLoc.district !== 'كل الأحياء' ? ` (حي ${activeLoc.district})` : ''}. كن أول من يطلب مساعدة!`
                  : 'تحتاج مساعدة أو توصيل أو غرض؟ اطلب وخل جيرانك يفزعون لك!'}
              </Text>
              <Pressable style={styles.emptyAddBtn} onPress={() => router.push('/new-request')}>
                <Plus size={18} color="#fff" />
                <Text style={styles.emptyAddBtnText}>إضافة طلب جديد</Text>
              </Pressable>
            </View>
          ) : (
            displayedItems.map(req => (
              <Pressable
                key={req.id}
                style={styles.card}
                onPress={() => router.push({ pathname: '/request', params: { id: req.id } })}
              >
                <View style={styles.cardTopRow}>
                  {req.is_urgent && (
                    <View style={styles.urgentBadge}>
                      <AlertCircle size={12} color="#dc2626" />
                      <Text style={styles.urgentBadgeText}>عاجل</Text>
                    </View>
                  )}
                  <Text style={styles.requestTitle}>{req.title}</Text>
                </View>

                <Text style={styles.requestDesc} numberOfLines={2}>
                  {req.description}
                </Text>

                <View style={styles.cardFooter}>
                  <View style={styles.metaRow}>
                    <MapPin size={13} color="#059669" />
                    <Text style={styles.metaText}>
                      {req.city || 'السعودية'}{req.district ? ` · حي ${req.district}` : ''}
                    </Text>
                  </View>

                  {req.budget ? (
                    <View style={styles.budgetRow}>
                      <Banknote size={14} color="#15803d" />
                      <Text style={styles.budgetText}>مكافأة: {req.budget} ر.س</Text>
                    </View>
                  ) : (
                    <Text style={styles.volunteerTag}>فزعة وتطوع</Text>
                  )}
                </View>
              </Pressable>
            ))
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.bottomNavWrapper}>
        <BottomNav />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scroll: {
    paddingBottom: 20,
  },
  hero: {
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  navBar: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  iconBtn: {
    padding: 6,
  },
  navTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
  },
  addBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  addBtnText: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '800',
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    textAlign: 'right',
    marginBottom: 16,
    lineHeight: 18,
  },
  searchBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 48,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    color: '#0f172a',
    fontSize: 13,
    textAlign: 'right',
  },
  filterRow: {
    flexDirection: 'row-reverse',
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 8,
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
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: '#fff',
    fontWeight: '800',
  },
  content: {
    paddingHorizontal: 18,
  },
  loadingBox: {
    paddingVertical: 60,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    color: '#64748b',
    fontSize: 13,
  },
  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    gap: 8,
  },
  emptyTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 6,
  },
  emptySub: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 10,
  },
  emptyAddBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
  },
  emptyAddBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  requestTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'right',
    flex: 1,
  },
  urgentBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 8,
  },
  urgentBadgeText: {
    color: '#dc2626',
    fontSize: 11,
    fontWeight: '800',
  },
  requestDesc: {
    color: '#475569',
    fontSize: 13,
    textAlign: 'right',
    lineHeight: 20,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderColor: '#f8fafc',
    paddingTop: 10,
  },
  metaRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    color: '#64748b',
    fontSize: 11,
  },
  budgetRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  budgetText: {
    color: '#15803d',
    fontSize: 12,
    fontWeight: '800',
  },
  volunteerTag: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '800',
  },
  bottomNavWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});
