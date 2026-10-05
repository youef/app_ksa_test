import { useBottomNavInset } from '@/lib/bottomNav';
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
import ScreenHeader from '@/components/shared/ScreenHeader';
import {
  getActiveLocation,
  subscribeLocation,
  isExactDistrictMatching,
  isLocationMatching,
  isAllKingdom,
} from '@/lib/locationSync';

export default function Questions() {
  const bottomNavInset = useBottomNavInset();
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [hasSession, setHasSession] = useState(false);
  const [loadError, setLoadError] = useState('');
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
        let query = supabase.from('questions').select('*').order('created_at', { ascending: false }).limit(60);
        if (q.trim()) query = query.or(`title.ilike.%${q.trim()}%,body.ilike.%${q.trim()}%`);
        const result = await query;
        setItems(result.data ?? []);
      } else {
        const result = await supabase.rpc('hayna_guest_questions', {
          p_city: location.city,
          p_district: location.district,
          p_limit: 60,
        });
        if (result.error) throw result.error;
        const searchTerm = q.trim().toLocaleLowerCase('ar');
        setItems((result.data ?? []).filter((item: any) => !searchTerm || `${item.title} ${item.body}`.toLocaleLowerCase('ar').includes(searchTerm)));
      }
    } catch (e) {
      console.warn('Load questions error', e);
      setLoadError((e as any)?.code === 'PGRST202' ? 'يلزم تحديث قاعدة البيانات لعرض أسئلة الحي للزوار.' : 'تعذر تحميل الأسئلة. حاول مرة أخرى.');
    } finally {
      setLoading(false);
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

  const displayedItems = items.filter(q => hasSession
    ? isExactDistrictMatching(q, activeLoc.city, activeLoc.district)
    : isLocationMatching(q, activeLoc.city, activeLoc.district)
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: bottomNavInset }]} showsVerticalScrollIndicator={false}>
        {/* Header Hero */}
        <LinearGradient
          colors={['#065f46', '#059669', '#10b981']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <ScreenHeader
            title="أسئلة واستفسارات الحي ❓"
            fallbackRoute="/home"
            rightAction={hasSession ? (
              <Pressable onPress={() => router.push('/ask')} style={styles.addBtn}>
                <Plus size={18} color="#059669" />
                <Text style={styles.addBtnText}>اسأل جارك</Text>
              </Pressable>
            ) : undefined}
          />
          <Text style={styles.heroSubtitle}>
            استفسر عن أي شيء في حيك وتلقى إجابات موثوقة من جيرانك وسكان المنطقة.
          </Text>

          {/* Active Location Filter Pill */}
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <View style={{
              flexDirection: 'row-reverse',
              alignItems: 'center',
              gap: 4,
              backgroundColor: 'rgba(255,255,255,0.18)',
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 20,
            }}>
              <MapPin size={12} color="#fff" />
              <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>
                {isAllKingdom(activeLoc.city)
                  ? 'كل مناطق المملكة 🇸🇦'
                  : `${activeLoc.city}${activeLoc.district && activeLoc.district !== 'كل الأحياء' ? ` · حي ${activeLoc.district}` : ''}`}
              </Text>
            </View>
          </View>

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
              <ActivityIndicator size="large" color="#059669" />
              <Text style={styles.loadingText}>جاري تحميل الأسئلة...</Text>
            </View>
          ) : loadError ? (
            <View style={styles.emptyCard}>
              <HelpCircle size={40} color="#f59e0b" />
              <Text style={styles.emptyTitle}>{loadError}</Text>
              <Pressable style={styles.emptyAddBtn} onPress={() => load(search)}>
                <Text style={styles.emptyAddBtnText}>إعادة المحاولة</Text>
              </Pressable>
            </View>
          ) : displayedItems.length === 0 ? (
            <View style={styles.emptyCard}>
              <HelpCircle size={48} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>لا توجد أسئلة مطابقة</Text>
              <Text style={styles.emptySub}>
                {!isAllKingdom(activeLoc.city)
                  ? `لم يتم طرح أسئلة بعد في ${activeLoc.city}${activeLoc.district !== 'كل الأحياء' ? ` (حي ${activeLoc.district})` : ''}. كن أول من يشارك!`
                  : 'عندك استفسار عن خدمات الحي أو أماكن؟ اطرح سؤالك الآن!'}
              </Text>
              {hasSession && <Pressable style={styles.emptyAddBtn} onPress={() => router.push('/ask')}>
                <Plus size={18} color="#fff" />
                <Text style={styles.emptyAddBtnText}>طرح سؤال جديد</Text>
              </Pressable>}
            </View>
          ) : (
            displayedItems.map(q => (
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
                    <MapPin size={13} color="#059669" />
                    <Text style={styles.metaText}>
                      {q.city || 'السعودية'}{q.district ? ` · حي ${q.district}` : ''}
                    </Text>
                  </View>

                  <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                      <MessageCircle size={13} color="#059669" />
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
    paddingTop: Platform.OS === 'ios' ? 52 : 40,
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
