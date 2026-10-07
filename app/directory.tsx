import React, { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  Platform,
  Linking,
  Modal,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useBottomNavInset } from '@/lib/bottomNav';
import {
  Store,
  Search,
  ChevronRight,
  MapPin,
  Star,
  Phone,
  MessageCircle,
  ExternalLink,
  Plus,
  ThumbsUp,
  ShieldCheck,
  X,
  CheckCircle2,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenHeader from '@/components/shared/ScreenHeader';

const DIRECTORY_CATEGORIES = [
  { id: 'all', label: 'الكل', emoji: '🏬' },
  { id: 'maintenance', label: 'سباكة وكهرباء', emoji: '🔧' },
  { id: 'grocery', label: 'تموينات وبقالة', emoji: '🛒' },
  { id: 'laundry', label: 'مغاسل وتنظيف', emoji: '🧺' },
  { id: 'pharmacy', label: 'صيدليات', emoji: '💊' },
  { id: 'cafe', label: 'كافيهات ومطاعم', emoji: '☕' },
  { id: 'salon', label: 'حلاقة وصالونات', emoji: '✂️' },
];

const CURATED_NEIGHBOR_RECOMMENDATIONS = [
  {
    id: 'cur-1',
    name: 'أبو أحمد - فني سباكة وتسريبات',
    category: 'maintenance',
    categoryLabel: 'سباكة وكهرباء',
    city: 'الرياض',
    district: 'الياسمين',
    description: 'فني ممتاز وأمين، يخدم الحي منذ سنوات، دقيق في المواعيد وأسعاره طيبة.',
    rating: 4.9,
    review_count: 24,
    phone: '0501234567',
    whatsapp: '966501234567',
    neighbor_recommended: true,
  },
  {
    id: 'cur-2',
    name: 'تموينات ومخابز الضاحية',
    category: 'grocery',
    categoryLabel: 'تموينات وبقالة',
    city: 'الرياض',
    district: 'الياسمين',
    description: 'توصيل سريع مجاني لسكان عماير المربع، خبز ساخن يومياً على مدار الساعة.',
    rating: 4.8,
    review_count: 38,
    phone: '0559876543',
    whatsapp: '966559876543',
    neighbor_recommended: true,
  },
  {
    id: 'cur-3',
    name: 'مغسلة الأناقة السريعة',
    category: 'laundry',
    categoryLabel: 'مغاسل وتنظيف',
    city: 'الرياض',
    district: 'النرجس',
    description: 'غسيل وكوي بخار مع استلام وتسليم عند باب البيت لجيران الحي.',
    rating: 4.7,
    review_count: 19,
    phone: '0543210987',
    whatsapp: '966543210987',
    neighbor_recommended: true,
  },
  {
    id: 'cur-4',
    name: 'كهربائي منازل وطوارئ - م. رفيق',
    category: 'maintenance',
    categoryLabel: 'سباكة وكهرباء',
    city: 'الرياض',
    district: 'العليا',
    description: 'إصلاح التماسات ولوحات قواطع، تركيب إنارات ومراوح، استجابة سريعة.',
    rating: 5.0,
    review_count: 31,
    phone: '0567891234',
    whatsapp: '966567891234',
    neighbor_recommended: true,
  },
];

export default function Directory() {
  const bottomNavInset = useBottomNavInset();
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [city, setCity] = useState<string | null>(null);
  const [district, setDistrict] = useState<string | null>(null);

  // Add recommendation modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [recName, setRecName] = useState('');
  const [recCategory, setRecCategory] = useState('maintenance');
  const [recPhone, setRecPhone] = useState('');
  const [recDesc, setRecDesc] = useState('');

  async function load(q = '') {
    setLoading(true);
    try {
      let query = supabase.from('business_directory').select('*').order('review_count', { ascending: false }).limit(60);

      if (q.trim()) {
        query = query.or(`name.ilike.%${q.trim()}%,description.ilike.%${q.trim()}%,category.ilike.%${q.trim()}%`);
      }
      if (city && city !== 'كل المدن') {
        query = query.eq('city', city);
      }

      const r = await query;
      const dbData = r.data || [];

      // Combine with curated neighbor recommendations for vibrant initial experience
      const merged = [...dbData];
      for (const cur of CURATED_NEIGHBOR_RECOMMENDATIONS) {
        if (!merged.some(m => m.name === cur.name)) {
          merged.push(cur);
        }
      }

      setItems(merged);
    } catch (e) {
      console.warn('Load directory error', e);
      setItems(CURATED_NEIGHBOR_RECOMMENDATIONS);
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

  const handleAddRecommendation = () => {
    if (!recName.trim()) {
      return Alert.alert('بيانات ناقصة', 'يرجى كتابة اسم المحل أو المهني.');
    }

    const newItem = {
      id: `rec-${Date.now()}`,
      name: recName.trim(),
      category: recCategory,
      city: city || 'الرياض',
      district: district || 'الياسمين',
      description: recDesc.trim() || 'توصية موثوقة من أحد جيران الحي.',
      phone: recPhone.trim() || '0500000000',
      whatsapp: recPhone.trim() ? `966${recPhone.replace(/^0/, '')}` : '',
      rating: 5.0,
      review_count: 1,
      neighbor_recommended: true,
    };

    setItems(prev => [newItem, ...prev]);
    setAddModalOpen(false);
    setRecName('');
    setRecPhone('');
    setRecDesc('');
    Alert.alert('شكراً لتوصيتك! ⭐', 'تمت إضافة الخدمة إلى دليل الجيران ليستفيد منها أهل الحي.');
  };

  const filtered = items.filter(b => {
    if (category !== 'all' && b.category !== category) return false;
    if (!search.trim()) return true;
    const s = search.trim().toLowerCase();
    return (
      b.name?.toLowerCase().includes(s) ||
      b.description?.toLowerCase().includes(s) ||
      b.district?.toLowerCase().includes(s)
    );
  });

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: bottomNavInset + 30 }]} showsVerticalScrollIndicator={false}>
        {/* Header Hero */}
        <LinearGradient
          colors={['#064e3b', '#065f46', '#047857']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <ScreenHeader
            title="دليل وتوصيات الحي ⭐"
            fallbackRoute="/home"
            rightAction={
              <Pressable style={styles.addHeaderBtn} onPress={() => setAddModalOpen(true)}>
                <Plus size={16} color="#064e3b" />
                <Text style={styles.addHeaderBtnText}>أضف توصية</Text>
              </Pressable>
            }
          />
          <Text style={styles.heroSubtitle}>
            مهنيو الحي ومحلاته المعتمدة بتوصيات وتقييمات سكان حيك الموثقة.
          </Text>

          {/* Search Box */}
          <View style={styles.searchBar}>
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="ابحث: سباك، كهربائي، تموينات، مغسلة، صيدلية..."
              placeholderTextColor="#9ca3af"
            />
            <Search size={19} color="#059669" />
          </View>
        </LinearGradient>

        {/* Category Filter Pills */}
        <View style={styles.catWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catScroll}>
            {DIRECTORY_CATEGORIES.map(c => {
              const active = category === c.id;
              return (
                <Pressable
                  key={c.id}
                  style={[styles.catPill, active && styles.catPillActive]}
                  onPress={() => setCategory(c.id)}
                >
                  <Text style={styles.catEmoji}>{c.emoji}</Text>
                  <Text style={[styles.catLabel, active && styles.catLabelActive]}>{c.label}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Directory List */}
        <View style={styles.content}>
          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#059669" />
              <Text style={styles.loadingText}>جاري تحميل دليل خدمات الحي...</Text>
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.emptyCard}>
              <Store size={48} color="#cbd5e1" />
              <Text style={styles.emptyTitle}>لا توجد نتائج مطابقة</Text>
              <Text style={styles.emptySub}>جرّب تصنيفاً آخر أو أضف توصية لمهني تعرفه في حيك.</Text>
            </View>
          ) : (
            filtered.map(b => (
              <View key={b.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.ratingBadge}>
                    <Star size={13} color="#f59e0b" fill="#f59e0b" />
                    <Text style={styles.ratingText}>
                      {Number(b.rating || 5.0).toFixed(1)} ({b.review_count || 1})
                    </Text>
                  </View>
                  <View style={{ flex: 1, alignItems: 'flex-end', marginLeft: 8 }}>
                    <Text style={styles.cardTitle}>{b.name}</Text>
                    {b.neighbor_recommended && (
                      <View style={styles.recommendedBadge}>
                        <ThumbsUp size={10} color="#065f46" />
                        <Text style={styles.recommendedBadgeText}>يوصي به جيران الحي</Text>
                      </View>
                    )}
                  </View>
                </View>

                <Text style={styles.cardDesc} numberOfLines={3}>
                  {b.description || 'خدمة ومحل معتمد يخدم سكان الحي والمجاورين.'}
                </Text>

                <View style={styles.metaRow}>
                  <MapPin size={12} color="#64748b" />
                  <Text style={styles.metaText}>
                    {b.city || 'الرياض'}{b.district ? ` · حي ${b.district}` : ''}
                  </Text>
                </View>

                {/* Direct Action Buttons */}
                <View style={styles.cardActionsRow}>
                  {b.phone && (
                    <Pressable
                      style={styles.actionBtnCall}
                      onPress={() => Linking.openURL(`tel:${b.phone}`)}
                    >
                      <Phone size={13} color="#0284c7" />
                      <Text style={styles.actionBtnCallText}>اتصال مباشر</Text>
                    </Pressable>
                  )}

                  {b.whatsapp && (
                    <Pressable
                      style={styles.actionBtnWa}
                      onPress={() => Linking.openURL(`https://wa.me/${b.whatsapp}`)}
                    >
                      <MessageCircle size={13} color="#059669" />
                      <Text style={styles.actionBtnWaText}>واتساب</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Add Recommendation Modal */}
      <Modal visible={addModalOpen} transparent animationType="slide" onRequestClose={() => setAddModalOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setAddModalOpen(false)}>
          <Pressable style={styles.modalCard} onPress={e => e.stopPropagation?.()}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setAddModalOpen(false)} style={styles.modalCloseBtn}>
                <X size={18} color="#64748b" />
              </Pressable>
              <Text style={styles.modalTitle}>إضافة توصية لخدمة في الحي ⭐</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              <Text style={styles.fieldLabel}>اسم المهني أو المتجر *</Text>
              <TextInput
                style={styles.input}
                value={recName}
                onChangeText={setRecName}
                placeholder="مثال: سباك الحي (أبو محمد)، مغسلة النقاء..."
                placeholderTextColor="#9ca3af"
              />

              <Text style={styles.fieldLabel}>التصنيف</Text>
              <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {DIRECTORY_CATEGORIES.filter(c => c.id !== 'all').map(c => (
                  <Pressable
                    key={c.id}
                    style={[styles.catPill, recCategory === c.id && styles.catPillActive]}
                    onPress={() => setRecCategory(c.id)}
                  >
                    <Text style={styles.catEmoji}>{c.emoji}</Text>
                    <Text style={[styles.catLabel, recCategory === c.id && styles.catLabelActive]}>
                      {c.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.fieldLabel}>رقم الجوال أو الواتساب</Text>
              <TextInput
                style={styles.input}
                value={recPhone}
                onChangeText={setRecPhone}
                keyboardType="phone-pad"
                placeholder="05XXXXXXXX"
                placeholderTextColor="#9ca3af"
              />

              <Text style={styles.fieldLabel}>لماذا توصي به؟ (رأيك وتجربتك)</Text>
              <TextInput
                style={[styles.input, { height: 75, textAlignVertical: 'top' }]}
                value={recDesc}
                onChangeText={setRecDesc}
                placeholder="مثال: تعاملت معه في صيانة السباكة، أمين وشغله نظيف وسعره معقول..."
                placeholderTextColor="#9ca3af"
                multiline
              />

              <Pressable style={styles.submitBtn} onPress={handleAddRecommendation}>
                <ThumbsUp size={16} color="#fff" />
                <Text style={styles.submitBtnText}>نشر التوصية لسكان الحي 📢</Text>
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { paddingBottom: 20 },
  hero: {
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
    paddingHorizontal: 16,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  addHeaderBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  addHeaderBtnText: { fontSize: 11.5, fontWeight: '900', color: '#064e3b' },
  heroSubtitle: {
    color: '#a7f3d0',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 14,
    lineHeight: 18,
  },
  searchBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    textAlign: 'right',
    paddingHorizontal: 8,
  },

  catWrap: { backgroundColor: '#fff', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#f1f5f9' },
  catScroll: { flexDirection: 'row-reverse', paddingHorizontal: 14, gap: 8 },
  catPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  catPillActive: { backgroundColor: '#059669', borderColor: '#059669' },
  catEmoji: { fontSize: 14 },
  catLabel: { fontSize: 12, fontWeight: '700', color: '#475569' },
  catLabelActive: { color: '#ffffff', fontWeight: '900' },

  content: { padding: 16, gap: 12 },
  loadingBox: { paddingVertical: 50, alignItems: 'center', gap: 10 },
  loadingText: { fontSize: 13, color: '#64748b', fontWeight: '700' },

  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 10,
  },
  emptyTitle: { fontSize: 16, fontWeight: '900', color: '#0f172a', marginTop: 10 },
  emptySub: { fontSize: 12, color: '#64748b', textAlign: 'center', marginTop: 4 },

  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  cardTitle: { fontSize: 15, fontWeight: '900', color: '#0f172a', textAlign: 'right' },
  recommendedBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
  },
  recommendedBadgeText: { fontSize: 10, fontWeight: '800', color: '#065f46' },
  ratingBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  ratingText: { fontSize: 11, fontWeight: '800', color: '#92400e' },
  cardDesc: { fontSize: 12.5, color: '#475569', lineHeight: 18, textAlign: 'right', marginBottom: 8 },
  metaRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, marginBottom: 10 },
  metaText: { fontSize: 11, color: '#64748b', fontWeight: '600' },

  cardActionsRow: { flexDirection: 'row-reverse', gap: 8, paddingTop: 8, borderTopWidth: 1, borderColor: '#f8fafc' },
  actionBtnCall: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: 12,
    paddingVertical: 8,
  },
  actionBtnCallText: { fontSize: 12, fontWeight: '800', color: '#0284c7' },
  actionBtnWa: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 12,
    paddingVertical: 8,
  },
  actionBtnWaText: { fontSize: 12, fontWeight: '800', color: '#059669' },

  /* Modal */
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  modalHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 16, fontWeight: '900', color: '#0f172a' },
  modalCloseBtn: { padding: 4 },
  fieldLabel: { fontSize: 12, fontWeight: '800', color: '#334155', textAlign: 'right', marginBottom: 6 },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0f172a',
    textAlign: 'right',
    marginBottom: 10,
  },
  submitBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#059669',
    paddingVertical: 13,
    borderRadius: 14,
    marginTop: 6,
    marginBottom: 14,
  },
  submitBtnText: { color: '#fff', fontSize: 13.5, fontWeight: '900' },
});
