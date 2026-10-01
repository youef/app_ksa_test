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
  HelpCircle,
  Search,
  Plus,
  ChevronRight,
  MapPin,
  MessageCircle,
  ThumbsUp,
  Sparkles,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import BottomNav from '@/components/BottomNav';

export default function Questions() {
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  async function load(q = '') {
    setLoading(true);
    try {
      let query = supabase
        .from('questions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(60);

      if (q.trim()) {
        query = query.or(`title.ilike.%${q.trim()}%,body.ilike.%${q.trim()}%`);
      }

      const r = await query;
      setItems(r.data ?? []);
    } catch (e) {
      console.warn('Load questions error', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(search);
  }, []);

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
            <Text style={styles.navTitle}>أسئلة واستفسارات الحي ❓</Text>
            <Pressable onPress={() => router.push('/ask')} style={styles.addBtn}>
              <Plus size={18} color="#059669" />
              <Text style={styles.addBtnText}>اسأل جارك</Text>
            </Pressable>
          </View>
          <Text style={styles.heroSubtitle}>
            استفسر عن أي شيء في حيك وتلقى إجابات موثوقة من جيرانك وسكان المنطقة.
          </Text>

          {/* Search Box */}
          <View style={styles.searchBar}>
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              onSubmitEditing={() => load(search)}
              placeholder="ابحث في الأسئلة والتوصيات..."
              placeholderTextColor="#94a3b8"
            />
            <Pressable onPress={() => load(search)}>
              <Search size={20} color="#059669" />
            </Pressable>
          </View>
        </LinearGradient>

        {/* Questions List */}
        <View style={styles.content}>
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#0891b2" />
              <Text style={styles.loadingText}>جاري تحميل الأسئلة...</Text>
            </View>
          ) : items.length === 0 ? (
            <View style={styles.emptyCard}>
              <HelpCircle size={48} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>لا توجد أسئلة مطابقة</Text>
              <Text style={styles.emptySub}>عندك استفسار عن خدمات الحي أو أماكن؟ اطرح سؤالك الآن!</Text>
              <Pressable style={styles.emptyAddBtn} onPress={() => router.push('/ask')}>
                <Plus size={18} color="#fff" />
                <Text style={styles.emptyAddBtnText}>طرح سؤال جديد</Text>
              </Pressable>
            </View>
          ) : (
            items.map(q => (
              <Pressable
                key={q.id}
                style={styles.card}
                onPress={() => router.push({ pathname: '/question', params: { id: q.id } })}
              >
                <Text style={styles.questionTitle}>{q.title}</Text>
                <Text style={styles.questionBody} numberOfLines={2}>
                  {q.body}
                </Text>

                <View style={styles.cardFooter}>
                  <View style={styles.metaRow}>
                    <MapPin size={13} color="#64748b" />
                    <Text style={styles.metaText}>
                      {q.city || 'السعودية'}{q.district ? ` · حي ${q.district}` : ''}
                    </Text>
                  </View>

                  <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                      <MessageCircle size={13} color="#0891b2" />
                      <Text style={styles.statText}>إجابات</Text>
                    </View>
                  </View>
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
  questionTitle: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'right',
    marginBottom: 6,
  },
  questionBody: {
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
  statsRow: {
    flexDirection: 'row-reverse',
    gap: 12,
  },
  statItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    color: '#0891b2',
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
