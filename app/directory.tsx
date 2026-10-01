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
  Store,
  Search,
  ChevronRight,
  MapPin,
  Star,
  Phone,
  Clock,
  ExternalLink,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import BottomNav from '@/components/BottomNav';

export default function Directory() {
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [city, setCity] = useState<string | null>(null);
  const [district, setDistrict] = useState<string | null>(null);

  async function load(q = '') {
    setLoading(true);
    try {
      let query = supabase.from('business_directory').select('*').order('review_count', { ascending: false }).limit(60);

      if (q.trim()) {
        query = query.or(`name.ilike.%${q.trim()}%,description.ilike.%${q.trim()}%,category.ilike.%${q.trim()}%`);
      }
      if (city) {
        query = query.eq('city', city);
      }

      const r = await query;
      setItems(r.data ?? []);
    } catch (e) {
      console.warn('Load directory error', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: u }) => {
      if (u.user) {
        const { data: p } = await supabase.from('profiles').select('city, district').eq('id', u.user.id).single();
        if (p?.city) setCity(p.city);
        if (p?.district) setDistrict(p.district);
      }
    });
    load(search);
  }, [city]);

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
            <Text style={styles.navTitle}>دليل ومحلات الحي 🏪</Text>
            <View style={{ width: 26 }} />
          </View>
          <Text style={styles.heroSubtitle}>
            اكتشف المتاجر، الصيدليات، المقاهي، والأنشطة التجارية القريبة في حيك.
          </Text>

          {/* Search Box */}
          <View style={styles.searchBar}>
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={() => load(search)}
              placeholder="ابحث عن بقالة، مغسلة، كافيه، مطعم، صيدلية..."
              placeholderTextColor="#94a3b8"
            />
            <Pressable onPress={() => load(search)}>
              <Search size={20} color="#059669" />
            </Pressable>
          </View>
        </LinearGradient>

        {/* Directory List */}
        <View style={styles.content}>
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#059669" />
              <Text style={styles.loadingText}>جاري تحميل الدليل التجاري...</Text>
            </View>
          ) : items.length === 0 ? (
            <View style={styles.emptyCard}>
              <Store size={48} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>لا توجد محلات مسجلة في هذا النطاق بعد</Text>
              <Text style={styles.emptySub}>سيتم تحديث الدليل باستمرار بمحلات وخدمات أهالي الحي.</Text>
            </View>
          ) : (
            items.map(b => (
              <Pressable
                key={b.id}
                style={styles.card}
                onPress={() => router.push({ pathname: '/business', params: { id: b.id } })}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.ratingBadge}>
                    <Star size={13} color="#f59e0b" fill="#f59e0b" />
                    <Text style={styles.ratingText}>
                      {Number(b.rating || 5.0).toFixed(1)} ({b.review_count || 0})
                    </Text>
                  </View>
                  <Text style={styles.cardTitle}>{b.name}</Text>
                </View>

                <Text style={styles.cardDesc} numberOfLines={2}>
                  {b.description || 'محل تجاري معتمد يخدم سكان الحي والمجاورين.'}
                </Text>

                <View style={styles.cardFooter}>
                  <View style={styles.metaRow}>
                    <MapPin size={13} color="#64748b" />
                    <Text style={styles.metaText}>
                      {b.city || 'السعودية'}{b.district ? ` · حي ${b.district}` : ''}
                    </Text>
                  </View>

                  <Text style={styles.categoryBadge}>{b.category || 'متجر'}</Text>
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
  content: {
    paddingHorizontal: 18,
    paddingTop: 16,
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
  cardHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'right',
    flex: 1,
  },
  ratingBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 8,
  },
  ratingText: {
    color: '#b45309',
    fontSize: 11,
    fontWeight: '800',
  },
  cardDesc: {
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
  categoryBadge: {
    color: '#059669',
    fontSize: 11,
    fontWeight: '800',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  bottomNavWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});
