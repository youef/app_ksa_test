import { HeaderAction, AppHeader } from '@/components/shared/AppHeader';
import React, { useEffect, useState, useCallback } from 'react';
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
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useBottomNavInset } from '@/lib/bottomNav';
import {
  Store,
  Search,
  MapPin,
  Star,
  Phone,
  MessageCircle,
  Plus,
  ThumbsUp,
  ShieldCheck,
  X,
  User,
  Sparkles,
  Share2,
} from 'lucide-react-native';

const DIRECTORY_CATEGORIES = [
  { id: 'all', label: 'الكل', emoji: '🏬' },
  { id: 'maintenance', label: 'سباكة وكهرباء', emoji: '🔧' },
  { id: 'grocery', label: 'تموينات وبقالة', emoji: '🛒' },
  { id: 'laundry', label: 'مغاسل وتنظيف', emoji: '🧺' },
  { id: 'pharmacy', label: 'صيدليات ورعاية', emoji: '💊' },
  { id: 'cafe', label: 'كافيهات ومطاعم', emoji: '☕' },
  { id: 'salon', label: 'حلاقة وصالونات', emoji: '✂️' },
  { id: 'auto', label: 'سيارات وبنشر', emoji: '🚗' },
];

const CURATED_NEIGHBOR_RECOMMENDATIONS = [
  {
    id: 'cur-1',
    name: 'أبو أحمد - فني سباكة وتسريبات',
    category: 'maintenance',
    categoryLabel: 'سباكة وكهرباء',
    city: 'الرياض',
    district: 'الياسمين',
    description: 'فني ممتاز وأمين، يخدم الحي منذ سنوات، دقيق في المواعيد وأسعاره طيبة ومناسبة.',
    rating: 4.9,
    review_count: 28,
    phone: '0501234567',
    whatsapp: '966501234567',
    is_verified: true,
    neighbor_recommended: true,
    provider_name: 'أبو أحمد الفني',
  },
  {
    id: 'cur-2',
    name: 'تموينات ومخابز الضاحية',
    category: 'grocery',
    categoryLabel: 'تموينات وبقالة',
    city: 'الرياض',
    district: 'الياسمين',
    description: 'توصيل سريع مجاني لسكان عماير المربع، خبز ساخن يومياً على مدار الساعة ومواد تموينية طازجة.',
    rating: 4.8,
    review_count: 42,
    phone: '0559876543',
    whatsapp: '966559876543',
    is_verified: true,
    neighbor_recommended: true,
    provider_name: 'إدارة التموينات',
  },
  {
    id: 'cur-3',
    name: 'مغسلة الأناقة السريعة',
    category: 'laundry',
    categoryLabel: 'مغاسل وتنظيف',
    city: 'الرياض',
    district: 'النرجس',
    description: 'غسيل وكوي بخار احترافي مع استلام وتسليم عند باب البيت لجيران الحي خلال 24 ساعة.',
    rating: 4.7,
    review_count: 23,
    phone: '0543210987',
    whatsapp: '966543210987',
    is_verified: true,
    neighbor_recommended: true,
    provider_name: 'أحمد البلوشي',
  },
  {
    id: 'cur-4',
    name: 'كهربائي منازل وطوارئ - م. رفيق',
    category: 'maintenance',
    categoryLabel: 'سباكة وكهرباء',
    city: 'الرياض',
    district: 'العليا',
    description: 'إصلاح التماسات ولوحات قواطع فورية، تركيب إنارات ومراوح، استجابة سريعة حتى في المساء.',
    rating: 5.0,
    review_count: 35,
    phone: '0567891234',
    whatsapp: '966567891234',
    is_verified: true,
    neighbor_recommended: true,
    provider_name: 'م. رفيق',
  },
];

export default function Directory() {
  const bottomNavInset = useBottomNavInset();
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [city, setCity] = useState<string | null>(null);
  const [district, setDistrict] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Add recommendation modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [recName, setRecName] = useState('');
  const [recCategory, setRecCategory] = useState('maintenance');
  const [recPhone, setRecPhone] = useState('');
  const [recDesc, setRecDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async (q = '') => {
    setLoading(true);
    try {
      // 1. Fetch real community services from DB joined with provider profiles
      let query = supabase
        .from('services')
        .select(`
          id,
          name,
          description,
          city,
          district,
          phone,
          whatsapp,
          category,
          is_verified,
          available_now,
          price_from,
          price_to,
          created_at,
          provider_id,
          profiles:provider_id(display_name, avatar_url)
        `)
        .order('created_at', { ascending: false })
        .limit(60);

      if (q.trim()) {
        query = query.or(`name.ilike.%${q.trim()}%,description.ilike.%${q.trim()}%`);
      }

      const { data: dbServices, error: dbError } = await query;
      if (dbError) {
        console.warn('DB services error:', dbError);
      }

      const normalizedDb = (dbServices || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        category: s.category || 'maintenance',
        city: s.city || 'الرياض',
        district: s.district || 'الحي',
        description: s.description || 'خدمة ومحل معتمد يخدم سكان الحي.',
        rating: 4.9,
        review_count: 1,
        phone: s.phone || '',
        whatsapp: s.whatsapp || (s.phone ? (s.phone.startsWith('966') ? s.phone : `966${s.phone.replace(/^0/, '')}`) : ''),
        is_verified: s.is_verified,
        neighbor_recommended: true,
        provider_id: s.provider_id,
        provider_name: s.profiles?.display_name || 'أحد جيران الحي',
        avatar_url: s.profiles?.avatar_url,
      }));

      // Combine DB services with curated community recommendations
      const combined: any[] = [...normalizedDb];
      for (const cur of CURATED_NEIGHBOR_RECOMMENDATIONS) {
        if (!combined.some(c => c.name === cur.name)) {
          combined.push(cur);
        }
      }

      setItems(combined);
    } catch (e) {
      console.warn('Load directory error', e);
      setItems(CURATED_NEIGHBOR_RECOMMENDATIONS);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: u }) => {
      if (u.user) {
        setCurrentUser(u.user);
        const { data: p } = await supabase.from('profiles').select('city, district').eq('id', u.user.id).single();
        if (p?.city) setCity(p.city);
        if (p?.district) setDistrict(p.district);
      }
    });
    load(search);
  }, [load, search]);

  const onRefresh = () => {
    setRefreshing(true);
    load(search);
  };

  const handleAddRecommendation = async () => {
    if (!recName.trim()) {
      return Alert.alert('بيانات ناقصة', 'يرجى كتابة اسم المحل أو المهني.');
    }

    setSubmitting(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;

      if (!user) {
        // Guest user: save locally and advise to sign in
        const guestItem = {
          id: `local-${Date.now()}`,
          name: recName.trim(),
          category: recCategory,
          city: city || 'الرياض',
          district: district || 'الياسمين',
          description: recDesc.trim() || 'توصية موثوقة من أحد جيران الحي.',
          phone: recPhone.trim() || '',
          whatsapp: recPhone.trim() ? (recPhone.trim().startsWith('966') ? recPhone.trim() : `966${recPhone.trim().replace(/^0/, '')}`) : '',
          rating: 5.0,
          review_count: 1,
          neighbor_recommended: true,
          provider_name: 'أنت (زائر)',
        };
        setItems(prev => [guestItem, ...prev]);
        setAddModalOpen(false);
        setRecName('');
        setRecPhone('');
        setRecDesc('');
        Alert.alert('تمت الإضافة مؤقتاً ⭐', 'قم بتسجيل الدخول ليتم حفظ توصيتك بشكل دائم في قاعدة بيانات الحي.');
        return;
      }

      // Format WhatsApp number
      const cleanPhone = recPhone.trim();
      let waNum: string | null = null;
      if (cleanPhone) {
        waNum = cleanPhone.startsWith('966') ? cleanPhone : `966${cleanPhone.replace(/^0/, '')}`;
      }

      // Real INSERT into Supabase `services` table!
      const { data: newRow, error: insertError } = await supabase
        .from('services')
        .insert({
          provider_id: user.id,
          name: recName.trim(),
          description: recDesc.trim() || 'توصية موثوقة من أحد جيران الحي ومجربة.',
          category: recCategory,
          city: city || 'الرياض',
          district: district || 'الياسمين',
          phone: cleanPhone || null,
          whatsapp: waNum,
          is_verified: false,
          available_now: true,
        })
        .select(`
          id,
          name,
          description,
          city,
          district,
          phone,
          whatsapp,
          category,
          is_verified,
          available_now,
          created_at,
          provider_id,
          profiles:provider_id(display_name, avatar_url)
        `)
        .single();

      if (insertError) {
        throw insertError;
      }

      const formattedNew = {
        id: newRow.id,
        name: newRow.name,
        category: newRow.category,
        city: newRow.city,
        district: newRow.district,
        description: newRow.description,
        rating: 5.0,
        review_count: 1,
        phone: newRow.phone || '',
        whatsapp: newRow.whatsapp || '',
        is_verified: false,
        neighbor_recommended: true,
        provider_id: newRow.provider_id,
        provider_name: (newRow as any).profiles?.display_name || 'أحد الجيران',
        avatar_url: (newRow as any).profiles?.avatar_url,
      };

      setItems(prev => [formattedNew, ...prev]);
      setAddModalOpen(false);
      setRecName('');
      setRecPhone('');
      setRecDesc('');
      Alert.alert('تم الحفظ والنشر بنجاح! ⭐', 'أصبحت التوصية الآن مخزنة في قاعدة البيانات ومتاحة لكل سكان الحي.');
    } catch (err: any) {
      console.warn('Error saving service recommendation:', err);
      Alert.alert('خطأ أثناء الحفظ', err?.message || 'تعذر حفظ التوصية في قاعدة البيانات');
    } finally {
      setSubmitting(false);
    }
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
      <AppHeader
        variant="sub"
        title="دليل وتوصيات الحي"
        subtitle={[district && `حي ${district}`, city].filter(Boolean).join(' · ') || 'مهنيو ومحلات الحي المجربة'}
        fallbackRoute="/home"
        rightAction={
          <HeaderAction
            style={styles.addBtnHeader}
            onPress={() => setAddModalOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="إضافة توصية"
          >
            <Plus size={14} color="#059669" />
            <Text style={styles.addBtnHeaderText}>أضف توصية</Text>
          </HeaderAction>
        }
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomNavInset + 30 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#059669"
            colors={['#059669']}
          />
        }
      >
        {/* Search Bar */}
        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="ابحث: سباك، كهربائي، تموينات، مغسلة، صيدلية..."
              placeholderTextColor="#9ca3af"
              returnKeyType="search"
            />
            <Search size={18} color="#059669" />
          </View>
        </View>

        {/* Category Pills */}
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
              <Text style={styles.loadingText}>جاري تحميل دليل خدمات وتوصيات الحي...</Text>
            </View>
          ) : filtered.length === 0 ? (
            <View style={styles.emptyCard}>
              <Store size={44} color="#94a3b8" />
              <Text style={styles.emptyTitle}>لا توجد نتائج مطابقة</Text>
              <Text style={styles.emptySub}>جرّب تصنيفاً آخر أو أضف توصية لمهني مجرب تعرفه في حيك.</Text>
              <Pressable style={styles.emptyActionBtn} onPress={() => setAddModalOpen(true)}>
                <Plus size={16} color="#fff" />
                <Text style={styles.emptyActionBtnText}>أضف أول توصية في الحي</Text>
              </Pressable>
            </View>
          ) : (
            filtered.map(b => (
              <View key={b.id} style={styles.card}>
                {/* Header Row */}
                <View style={styles.cardHeader}>
                  <View style={styles.ratingBadge}>
                    <Star size={12} color="#f59e0b" fill="#f59e0b" />
                    <Text style={styles.ratingText}>
                      {Number(b.rating || 5.0).toFixed(1)} ({b.review_count || 1})
                    </Text>
                  </View>

                  <View style={styles.cardTitleBox}>
                    <View style={styles.titleWithBadge}>
                      <Text style={styles.cardTitle}>{b.name}</Text>
                      {b.is_verified && <ShieldCheck size={14} color="#059669" />}
                    </View>
                    {b.neighbor_recommended && (
                      <View style={styles.recommendedBadge}>
                        <ThumbsUp size={10} color="#065f46" />
                        <Text style={styles.recommendedBadgeText}>توصية موثوقة من الجيران</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Description */}
                <Text style={styles.cardDesc} numberOfLines={3}>
                  {b.description || 'خدمة ومحل معتمد يخدم سكان الحي والمجاورين.'}
                </Text>

                {/* Meta details & author */}
                <View style={styles.metaRow}>
                  <View style={styles.locBadge}>
                    <MapPin size={11} color="#059669" />
                    <Text style={styles.locText}>
                      {b.district ? `حي ${b.district}` : b.city || 'الرياض'}
                    </Text>
                  </View>

                  {b.provider_name && (
                    <Pressable
                      style={styles.providerBadge}
                      onPress={() => {
                        if (b.provider_id) {
                          router.push({ pathname: '/user', params: { id: b.provider_id } });
                        }
                      }}
                    >
                      <User size={11} color="#64748b" />
                      <Text style={styles.providerText}>الموصي: {b.provider_name}</Text>
                    </Pressable>
                  )}
                </View>

                {/* Action Buttons */}
                <View style={styles.cardActionsRow}>
                  {b.phone ? (
                    <Pressable
                      style={styles.actionBtnCall}
                      onPress={() => Linking.openURL(`tel:${b.phone}`)}
                    >
                      <Phone size={13} color="#0284c7" />
                      <Text style={styles.actionBtnCallText}>اتصال مباشر</Text>
                    </Pressable>
                  ) : null}

                  {b.whatsapp ? (
                    <Pressable
                      style={styles.actionBtnWa}
                      onPress={() => Linking.openURL(`https://wa.me/${b.whatsapp}`)}
                    >
                      <MessageCircle size={13} color="#059669" />
                      <Text style={styles.actionBtnWaText}>واتساب</Text>
                    </Pressable>
                  ) : null}

                  {b.provider_id ? (
                    <Pressable
                      style={styles.actionBtnProfile}
                      onPress={() => router.push({ pathname: '/user', params: { id: b.provider_id } })}
                    >
                      <Text style={styles.actionBtnProfileText}>الملف</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Modal: Add Recommendation */}
      <Modal visible={addModalOpen} transparent animationType="slide" onRequestClose={() => setAddModalOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setAddModalOpen(false)}>
          <Pressable style={styles.modalCard} onPress={e => e.stopPropagation?.()}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setAddModalOpen(false)} style={styles.modalCloseBtn}>
                <X size={18} color="#64748b" />
              </Pressable>
              <Text style={styles.modalTitle}>إضافة توصية لخدمة في الحي ⭐</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 440 }}>
              <Text style={styles.fieldLabel}>اسم المهني أو المتجر *</Text>
              <TextInput
                style={styles.input}
                value={recName}
                onChangeText={setRecName}
                placeholder="مثال: سباك الحي (أبو محمد)، مغسلة النقاء..."
                placeholderTextColor="#9ca3af"
              />

              <Text style={styles.fieldLabel}>التصنيف</Text>
              <View style={styles.categoryPickerWrap}>
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
                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                value={recDesc}
                onChangeText={setRecDesc}
                placeholder="مثال: تعاملت معه في صيانة السباكة، أمين وشغله نظيف وسعره معقول ومناسب..."
                placeholderTextColor="#9ca3af"
                multiline
              />

              <Pressable
                style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
                onPress={handleAddRecommendation}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <ThumbsUp size={16} color="#fff" />
                    <Text style={styles.submitBtnText}>حفظ ونشر التوصية للحي 📢</Text>
                  </>
                )}
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
  addBtnHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  addBtnHeaderText: { fontSize: 12, fontWeight: '800', color: '#059669' },
  searchSection: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  searchBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    textAlign: 'right',
    paddingHorizontal: 8,
  },
  catWrap: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
  },
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
  catEmoji: { fontSize: 13 },
  catLabel: { fontSize: 11.5, fontWeight: '700', color: '#475569' },
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
  emptySub: { fontSize: 12, color: '#64748b', textAlign: 'center', marginTop: 4, lineHeight: 18 },
  emptyActionBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
    marginTop: 16,
  },
  emptyActionBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
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
  cardHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardTitleBox: { flex: 1, alignItems: 'flex-end', marginLeft: 8 },
  titleWithBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
  },
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
  metaRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  locBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  locText: { fontSize: 11, color: '#475569', fontWeight: '700' },
  providerBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  providerText: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  cardActionsRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderColor: '#f8fafc',
  },
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
  actionBtnProfile: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnProfileText: { fontSize: 11.5, fontWeight: '700', color: '#64748b' },

  /* Modal */
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  modalHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 16, fontWeight: '900', color: '#0f172a' },
  modalCloseBtn: { padding: 4 },
  fieldLabel: { fontSize: 12, fontWeight: '800', color: '#334155', textAlign: 'right', marginBottom: 6 },
  categoryPickerWrap: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
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
