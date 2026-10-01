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
  Wrench,
  Search,
  Plus,
  ChevronRight,
  MapPin,
  Clock,
  ShieldCheck,
  CheckCircle2,
  Tag,
  Briefcase,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import BottomNav from '@/components/BottomNav';
import {
  getActiveLocation,
  subscribeLocation,
  isExactDistrictMatching,
  isAllKingdom,
} from '@/lib/locationSync';

export default function Services() {
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('الكل');
  const [activeLoc, setActiveLoc] = useState({
    region: 'كل المملكة',
    city: 'كل المدن',
    district: 'كل الأحياء',
  });

  const categories = ['الكل', 'صيانة منزلية', 'كهرباء وسباكة', 'توصيل ونقل', 'تعليم ودروس', 'تصميم وبرمجة', 'أخرى'];

  async function load(q = '', cat = activeCategory) {
    setLoading(true);
    try {
      let query = supabase
        .from('services')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(60);

      if (q.trim()) {
        query = query.or(`name.ilike.%${q.trim()}%,description.ilike.%${q.trim()}%`);
      }
      if (cat !== 'الكل') {
        query = query.eq('category', cat);
      }

      const r = await query;
      setItems(r.data ?? []);
    } catch (e) {
      console.warn('Load services error', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    getActiveLocation().then(setActiveLoc);
    const unsub = subscribeLocation(setActiveLoc);
    load(search, activeCategory);
    return unsub;
  }, [activeCategory]);

  const displayedItems = items.filter((s) =>
    isExactDistrictMatching(s, activeLoc.city, activeLoc.district)
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
            <Text style={styles.navTitle}>خدمات المجتمع 🛠️</Text>
            <Pressable onPress={() => router.push('/new-service')} style={styles.addBtn}>
              <Plus size={18} color="#059669" />
              <Text style={styles.addBtnText}>أضف خدمة</Text>
            </Pressable>
          </View>
          <Text style={styles.heroSubtitle}>
            اعرض مهاراتك وخدماتك لجيرانك، أو اعثر على من يساعدك في حيك.
          </Text>

          {/* Search Box */}
          <View style={styles.searchBar}>
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={() => load(search, activeCategory)}
              placeholder="ابحث عن كهربائي، سباك، معلم، تقني..."
              placeholderTextColor="#94a3b8"
            />
            <Pressable onPress={() => load(search, activeCategory)}>
              <Search size={20} color="#059669" />
            </Pressable>
          </View>
        </LinearGradient>

        {/* Categories Horizontal Scroll */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesRow}
        >
          {categories.map(cat => (
            <Pressable
              key={cat}
              style={[styles.categoryChip, activeCategory === cat && styles.categoryChipActive]}
              onPress={() => setActiveCategory(cat)}
            >
              <Text style={[styles.categoryChipText, activeCategory === cat && styles.categoryChipTextActive]}>
                {cat}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Services List */}
        <View style={styles.content}>
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#059669" />
              <Text style={styles.loadingText}>جاري تحميل الخدمات...</Text>
            </View>
          ) : displayedItems.length === 0 ? (
            <View style={styles.emptyCard}>
              <Briefcase size={48} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>لا توجد خدمات مطابقة حالياً</Text>
              <Text style={styles.emptySub}>
                {!isAllKingdom(activeLoc.city)
                  ? `لا توجد خدمات مسجلة بعد في ${activeLoc.city}${activeLoc.district !== 'كل الأحياء' ? ` (حي ${activeLoc.district})` : ''}. كن أول من يقدّم خدماته!`
                  : 'كن أول من يقدّم خدماته لأهالي الحي والمنطقة!'}
              </Text>
              <Pressable style={styles.emptyAddBtn} onPress={() => router.push('/new-service')}>
                <Plus size={18} color="#fff" />
                <Text style={styles.emptyAddBtnText}>إضافة خدمة جديدة</Text>
              </Pressable>
            </View>
          ) : (
            displayedItems.map(s => (
              <Pressable
                key={s.id}
                style={styles.serviceCard}
                onPress={() => router.push({ pathname: '/service', params: { id: s.id } })}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.badgeRow}>
                    {s.available_now && (
                      <View style={styles.availableBadge}>
                        <CheckCircle2 size={12} color="#15803d" />
                        <Text style={styles.availableText}>متاح الآن</Text>
                      </View>
                    )}
                    {s.is_verified && (
                      <View style={styles.verifiedBadge}>
                        <ShieldCheck size={12} color="#059669" />
                        <Text style={styles.verifiedText}>موثّق</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.serviceTitle}>{s.name}</Text>
                </View>

                <Text style={styles.serviceDesc} numberOfLines={2}>
                  {s.description}
                </Text>

                <View style={styles.cardFooter}>
                  <View style={styles.metaRow}>
                    <MapPin size={14} color="#64748b" />
                    <Text style={styles.metaText}>
                      {s.city || 'السعودية'}{s.district ? ` · حي ${s.district}` : ''}
                    </Text>
                  </View>

                  {s.price_from != null ? (
                    <Text style={styles.priceTag}>
                      يبدأ من <Text style={styles.priceBold}>{s.price_from}</Text> ر.س
                    </Text>
                  ) : (
                    <Text style={styles.priceNeg}>حسب الاتفاق</Text>
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
  categoriesRow: {
    flexDirection: 'row-reverse',
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 8,
  },
  categoryChip: {
    backgroundColor: '#fff',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  categoryChipActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  categoryChipText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },
  categoryChipTextActive: {
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
  serviceCard: {
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
  cardHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  serviceTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'right',
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row-reverse',
    gap: 6,
    marginLeft: 8,
  },
  availableBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  availableText: {
    color: '#15803d',
    fontSize: 11,
    fontWeight: '800',
  },
  verifiedBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  verifiedText: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '800',
  },
  serviceDesc: {
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
  priceTag: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '700',
  },
  priceBold: {
    fontSize: 15,
    fontWeight: '900',
  },
  priceNeg: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
  },
  bottomNavWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});
