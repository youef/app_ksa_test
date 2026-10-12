import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  Platform,
  Linking,
  RefreshControl,
} from 'react-native';
import { router } from 'expo-router';
import { AppHeader } from '@/components/shared/AppHeader';
import {
  Car,
  Users,
  Clock,
  MapPin,
  Plus,
  Phone,
  MessageCircle,
  X,
  GraduationCap,
  ShieldCheck,
  Search,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useBottomNavInset } from '@/lib/bottomNav';

interface CarpoolItem {
  id: string;
  requester_id?: string;
  parent_name: string;
  school_name: string;
  district: string;
  city?: string;
  trip_type: string; // 'morning', 'return', 'both'
  trip_type_label: string;
  seats_available: number;
  notes: string;
  phone?: string;
  is_verified?: boolean;
}

const DEFAULT_CARPOOLS: CarpoolItem[] = [
  {
    id: 'c-1',
    parent_name: 'أبو فهد (ولي أمر)',
    school_name: 'مدارس التربية النموذجية (بنين)',
    district: 'الياسمين',
    city: 'الرياض',
    trip_type: 'both',
    trip_type_label: 'ذهاب وعودة (صباحاً وظهراً)',
    seats_available: 2,
    notes: 'عندي مقعدين شاغرين لطلاب المرحلة المتوسطة، الانطلاق 6:30 ص والعودة 1:30 ظهراً.',
    phone: '0501112233',
    is_verified: true,
  },
  {
    id: 'c-2',
    parent_name: 'أم سارة',
    school_name: 'مدارس الفرسان الأهلية (بنات)',
    district: 'النرجس',
    city: 'الرياض',
    trip_type: 'morning',
    trip_type_label: 'فترة الصباح فقط (6:40 ص)',
    seats_available: 3,
    notes: 'مستعدة لتوصيل الطالبات صباحاً بالتبادل مع ولية أمر أخرى تتولى فترة الرجعة.',
    phone: '0554443322',
    is_verified: true,
  },
  {
    id: 'c-3',
    parent_name: 'أبو عبد العزيز',
    school_name: 'مجمع مدارس حي العارض الحكومي',
    district: 'العارض',
    city: 'الرياض',
    trip_type: 'return',
    trip_type_label: 'فترة الظهر (1:15 م)',
    seats_available: 2,
    notes: 'توصيل الظهر للمرحلة الابتدائية، سيارة عائلية مريحة ومكيفة.',
    phone: '0567778899',
    is_verified: true,
  },
];

export default function CarpoolingScreen() {
  const bottomNavInset = useBottomNavInset();
  const [filterType, setFilterType] = useState<'all' | 'morning' | 'return'>('all');
  const [search, setSearch] = useState('');
  const [carpools, setCarpools] = useState<CarpoolItem[]>(DEFAULT_CARPOOLS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);

  // New ride modal
  const [modalOpen, setModalOpen] = useState(false);
  const [schoolName, setSchoolName] = useState('');
  const [tripType, setTripType] = useState('morning');
  const [seats, setSeats] = useState('2');
  const [notes, setNotes] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      // 1. Fetch current user
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user) {
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', auth.user.id).maybeSingle();
        setUserProfile(prof);
      }

      // 2. Fetch community carpools from `requests` table where request_type is 'carpooling'
      const { data: dbRides, error } = await supabase
        .from('requests')
        .select(`
          id,
          requester_id,
          title,
          description,
          city,
          district,
          status,
          created_at,
          profiles:requester_id(display_name, phone, avatar_url, is_verified_neighbor)
        `)
        .eq('request_type', 'carpooling')
        .order('created_at', { ascending: false })
        .limit(40);

      if (error) {
        console.warn('Load carpools DB error:', error);
      }

      const formattedDbRides: CarpoolItem[] = (dbRides || []).map((r: any) => {
        // Parse school name from title "توصيل مدرسة: XYZ"
        const cleanSchool = r.title.replace(/^توصيل مدرسة:\s*/, '').trim() || r.title;
        return {
          id: r.id,
          requester_id: r.requester_id,
          parent_name: r.profiles?.display_name || 'ولي أمر بالحي',
          school_name: cleanSchool,
          district: r.district || 'الحي',
          city: r.city || 'الرياض',
          trip_type: 'both',
          trip_type_label: 'مشاركة توصيل مدرسي',
          seats_available: 2,
          notes: r.description || 'مشاركة توصيل بين أولياء أمور الحي.',
          phone: r.profiles?.phone || '',
          is_verified: Boolean(r.profiles?.is_verified_neighbor),
        };
      });

      // Combine with curated defaults
      const merged = [...formattedDbRides];
      for (const cur of DEFAULT_CARPOOLS) {
        if (!merged.some(m => m.school_name === cur.school_name)) {
          merged.push(cur);
        }
      }

      setCarpools(merged);
    } catch (e) {
      console.warn('Carpool load error:', e);
      setCarpools(DEFAULT_CARPOOLS);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleAddCarpool = async () => {
    if (!schoolName.trim()) {
      return Alert.alert('بيانات ناقصة', 'يرجى إدخال اسم المدرسة.');
    }

    setSubmitting(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth?.user;

      const tripLabel = tripType === 'morning' ? 'فترة الصباح فقط' : tripType === 'return' ? 'فترة الظهر فقط' : 'ذهاب وعودة';

      if (!user) {
        // Guest user fallback
        const guestRide: CarpoolItem = {
          id: `c-guest-${Date.now()}`,
          parent_name: 'أنت (زائر)',
          school_name: schoolName.trim(),
          district: 'الحي',
          trip_type: tripType,
          trip_type_label: tripLabel,
          seats_available: parseInt(seats, 10) || 1,
          notes: notes.trim() || 'مشاركة توصيل أبناء الحي',
          phone: contactNumber.trim() || '0500000000',
          is_verified: false,
        };
        setCarpools(prev => [guestRide, ...prev]);
        setModalOpen(false);
        setSchoolName('');
        setNotes('');
        setContactNumber('');
        Alert.alert('تم النشر مؤقتاً 🚗', 'سجّل الدخول لحفظ رحلتك بشكل دائم في قاعدة بيانات الحي.');
        return;
      }

      // Real INSERT into Supabase `requests` table
      const fullDesc = `مشاركة مقاعد توصيل لـ ${schoolName.trim()} (${tripLabel}) - المقاعد المتاحة: ${seats}. ${notes.trim()}`;
      const { data: newRequest, error } = await supabase
        .from('requests')
        .insert({
          requester_id: user.id,
          title: `توصيل مدرسة: ${schoolName.trim()}`,
          description: fullDesc,
          request_type: 'carpooling',
          city: userProfile?.city || 'الرياض',
          district: userProfile?.district || 'الياسمين',
          status: 'open',
          is_urgent: false,
        })
        .select(`
          id,
          requester_id,
          title,
          description,
          city,
          district,
          status,
          created_at,
          profiles:requester_id(display_name, phone, avatar_url, is_verified_neighbor)
        `)
        .single();

      if (error) throw error;

      const newRideItem: CarpoolItem = {
        id: newRequest.id,
        requester_id: user.id,
        parent_name: (newRequest as any).profiles?.display_name || userProfile?.display_name || 'ولي أمر بالحي',
        school_name: schoolName.trim(),
        district: newRequest.district || 'الحي',
        city: newRequest.city || 'الرياض',
        trip_type: tripType,
        trip_type_label: tripLabel,
        seats_available: parseInt(seats, 10) || 1,
        notes: notes.trim() || 'مشاركة توصيل أبناء الحي',
        phone: contactNumber.trim() || userProfile?.phone || '',
        is_verified: true,
      };

      setCarpools(prev => [newRideItem, ...prev]);
      setModalOpen(false);
      setSchoolName('');
      setNotes('');
      setContactNumber('');
      Alert.alert('تم النشر في قاعدة البيانات! 🚗', 'أصبح عرض مشاركة المقعد متاحاً لجيران الحي الآن.');
    } catch (err: any) {
      console.warn('Carpool submit error:', err);
      Alert.alert('خطأ أثناء النشر', err?.message || 'تعذر حفظ رحلة التوصيل');
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = carpools.filter(item => {
    if (filterType === 'morning' && item.trip_type === 'return') return false;
    if (filterType === 'return' && item.trip_type === 'morning') return false;
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      item.school_name.toLowerCase().includes(q) ||
      item.district.toLowerCase().includes(q) ||
      item.parent_name.toLowerCase().includes(q)
    );
  });

  return (
    <View style={styles.container}>
      <AppHeader
        variant="sub"
        title="توصيل مدارس الحي"
        subtitle="مشاركة المقاعد وتخفيف الزحام بين أولياء الأمور"
        fallbackRoute="/home"
        rightAction={
          <Pressable
            style={styles.headerActionBtn}
            onPress={() => setModalOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="شارك مقعداً"
          >
            <Plus size={14} color="#059669" />
            <Text style={styles.headerActionBtnText}>شارك مقعداً</Text>
          </Pressable>
        }
      />

      {/* Search Input */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="ابحث باسم المدرسة، الحي، أو ولي الأمر..."
            placeholderTextColor="#9ca3af"
          />
          <Search size={18} color="#059669" />
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabsRow}>
        <Pressable
          style={[styles.tabChip, filterType === 'all' && styles.tabChipActive]}
          onPress={() => setFilterType('all')}
        >
          <Text style={[styles.tabText, filterType === 'all' && styles.tabTextActive]}>كل الرحلات ({carpools.length})</Text>
        </Pressable>
        <Pressable
          style={[styles.tabChip, filterType === 'morning' && styles.tabChipActive]}
          onPress={() => setFilterType('morning')}
        >
          <Text style={[styles.tabText, filterType === 'morning' && styles.tabTextActive]}>☀️ صباحاً (ذهاب)</Text>
        </Pressable>
        <Pressable
          style={[styles.tabChip, filterType === 'return' && styles.tabChipActive]}
          onPress={() => setFilterType('return')}
        >
          <Text style={[styles.tabText, filterType === 'return' && styles.tabTextActive]}>🌤️ ظهراً (عودة)</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomNavInset + 30 }]}
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
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#059669" />
            <Text style={styles.loadingText}>جاري تحميل رحلات المدارس بالحي...</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyCard}>
            <Car size={44} color="#94a3b8" />
            <Text style={styles.emptyTitle}>لا توجد رحلات توصيل مسجلة</Text>
            <Text style={styles.emptySub}>شارك مقاعد سيارتك الفارغة مع أولياء أمور مدرستكم بالحي ووفر وقتك وزحامك.</Text>
            <Pressable style={styles.emptyAddBtn} onPress={() => setModalOpen(true)}>
              <Plus size={16} color="#fff" />
              <Text style={styles.emptyAddBtnText}>أضف أول رحلة مشاركة</Text>
            </Pressable>
          </View>
        ) : (
          filtered.map(item => (
            <View key={item.id} style={styles.carpoolCard}>
              <View style={styles.cardHeader}>
                <View style={styles.seatsBadge}>
                  <Users size={12} color="#065f46" />
                  <Text style={styles.seatsBadgeText}>{item.seats_available} مقاعد شاغرة</Text>
                </View>

                <View style={{ alignItems: 'flex-end' }}>
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }}>
                    <Text style={styles.parentName}>{item.parent_name}</Text>
                    {item.is_verified && <ShieldCheck size={13} color="#059669" />}
                  </View>
                  <View style={styles.locRow}>
                    <MapPin size={11} color="#64748b" />
                    <Text style={styles.locText}>حي {item.district}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.schoolRow}>
                <GraduationCap size={16} color="#047857" />
                <Text style={styles.schoolName}>{item.school_name}</Text>
              </View>

              <View style={styles.tripTypeRow}>
                <Clock size={13} color="#b45309" />
                <Text style={styles.tripTypeText}>{item.trip_type_label}</Text>
              </View>

              {item.notes ? (
                <Text style={styles.notesText}>"{item.notes}"</Text>
              ) : null}

              <View style={styles.cardActions}>
                {item.phone ? (
                  <Pressable
                    style={styles.contactBtn}
                    onPress={() => Linking.openURL(`tel:${item.phone}`)}
                  >
                    <Phone size={14} color="#059669" />
                    <Text style={styles.contactBtnText}>اتصال للتنسيق</Text>
                  </Pressable>
                ) : null}

                <Pressable
                  style={styles.chatBtn}
                  onPress={() => {
                    if (item.requester_id) {
                      router.push({ pathname: '/conversation', params: { userId: item.requester_id } });
                    } else {
                      router.push('/messages');
                    }
                  }}
                >
                  <MessageCircle size={14} color="#fff" />
                  <Text style={styles.chatBtnText}>محادثة خاصة</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Modal: Add School Carpool */}
      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setModalOpen(false)}>
          <Pressable style={styles.modalCard} onPress={e => e.stopPropagation?.()}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setModalOpen(false)} style={styles.modalCloseBtn}>
                <X size={18} color="#64748b" />
              </Pressable>
              <Text style={styles.modalTitle}>مشاركة مقعد توصيل للمدرسة 🚗</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 450 }}>
              <Text style={styles.fieldLabel}>اسم المدرسة *</Text>
              <TextInput
                style={styles.input}
                value={schoolName}
                onChangeText={setSchoolName}
                placeholder="مثال: مدارس الرياض، ابتدائية ابن كثير، ثانوية الملك فهد..."
                placeholderTextColor="#9ca3af"
              />

              <Text style={styles.fieldLabel}>الفترة</Text>
              <View style={{ flexDirection: 'row-reverse', gap: 6, marginBottom: 12 }}>
                {[
                  { id: 'morning', label: 'صباحاً (ذهاب)' },
                  { id: 'return', label: 'ظهراً (عودة)' },
                  { id: 'both', label: 'ذهاب وعودة' },
                ].map(t => (
                  <Pressable
                    key={t.id}
                    style={[styles.tabChip, tripType === t.id && styles.tabChipActive]}
                    onPress={() => setTripType(t.id)}
                  >
                    <Text style={[styles.tabText, tripType === t.id && styles.tabTextActive]}>{t.label}</Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.fieldLabel}>عدد المقاعد المتاحة</Text>
              <TextInput
                style={styles.input}
                value={seats}
                onChangeText={setSeats}
                keyboardType="numeric"
                placeholder="2"
                placeholderTextColor="#9ca3af"
              />

              <Text style={styles.fieldLabel}>رقم التواصل أو الواتساب</Text>
              <TextInput
                style={styles.input}
                value={contactNumber}
                onChangeText={setContactNumber}
                keyboardType="phone-pad"
                placeholder="05XXXXXXXX"
                placeholderTextColor="#9ca3af"
              />

              <Text style={styles.fieldLabel}>ملاحظات أو شروط التبادل</Text>
              <TextInput
                style={[styles.input, { height: 75, textAlignVertical: 'top' }]}
                value={notes}
                onChangeText={setNotes}
                placeholder="مثال: طلاب مرحلة ابتدائية، التجمع عند مدخل الشارع 6:35 ص..."
                placeholderTextColor="#9ca3af"
                multiline
              />

              <Pressable
                style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
                onPress={handleAddCarpool}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Car size={18} color="#fff" />
                    <Text style={styles.submitBtnText}>نشر المقعد في قاعدة البيانات 🤝</Text>
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
  headerActionBtn: {
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
  headerActionBtnText: { fontSize: 12, fontWeight: '800', color: '#059669' },
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
  tabsRow: {
    flexDirection: 'row-reverse',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
  },
  tabChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tabChipActive: { backgroundColor: '#059669', borderColor: '#059669' },
  tabText: { fontSize: 11.5, fontWeight: '700', color: '#64748b' },
  tabTextActive: { color: '#ffffff', fontWeight: '900' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },
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
  emptyAddBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
    marginTop: 16,
  },
  emptyAddBtnText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  carpoolCard: {
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
    alignItems: 'center',
    marginBottom: 10,
  },
  seatsBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  seatsBadgeText: { fontSize: 11, fontWeight: '800', color: '#065f46' },
  parentName: { fontSize: 13.5, fontWeight: '900', color: '#0f172a' },
  locRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 2, marginTop: 1 },
  locText: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  schoolRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0fdf4',
    padding: 10,
    borderRadius: 12,
    marginBottom: 8,
  },
  schoolName: { fontSize: 13.5, fontWeight: '800', color: '#047857', textAlign: 'right' },
  tripTypeRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginBottom: 8 },
  tripTypeText: { fontSize: 12, fontWeight: '700', color: '#92400e' },
  notesText: { fontSize: 12, color: '#475569', lineHeight: 18, textAlign: 'right', marginBottom: 10 },
  cardActions: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: '#f8fafc',
  },
  contactBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 12,
    paddingVertical: 8,
  },
  contactBtnText: { fontSize: 12, fontWeight: '800', color: '#059669' },
  chatBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 8,
  },
  chatBtnText: { fontSize: 12, fontWeight: '800', color: '#fff' },

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
