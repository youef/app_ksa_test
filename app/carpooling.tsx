import React, { useState, useEffect } from 'react';
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
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Car,
  Users,
  Clock,
  MapPin,
  Plus,
  ChevronRight,
  Phone,
  MessageCircle,
  X,
  GraduationCap,
  Sparkles,
  ShieldCheck,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useBottomNavInset } from '@/lib/bottomNav';

const DEFAULT_CARPOOLS = [
  {
    id: 'c-1',
    parent_name: 'أبو فهد',
    school_name: 'مدارس التربية النموذجية (بنين)',
    district: 'الياسمين',
    trip_type: 'morning_return', // 'morning', 'return', 'both'
    trip_type_label: 'ذهاب وعودة (صباحاً وظهراً)',
    seats_available: 2,
    notes: 'عندي مقعدين شاغرين لطلاب المرحلة المتوسطة، الانطلاق 6:30 ص.',
    phone: '0501112233',
    is_verified: true,
  },
  {
    id: 'c-2',
    parent_name: 'أم سارة',
    school_name: 'مدارس الفرسان الأهلية (بنات)',
    district: 'النرجس',
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
    trip_type: 'return',
    trip_type_label: 'فترة الظهر (1:15 م)',
    seats_available: 2,
    notes: 'توصيل الظهر للمرحلة الابتدائية، سيارة عائلية مريحة.',
    phone: '0567778899',
    is_verified: true,
  },
];

export default function CarpoolingScreen() {
  const bottomNavInset = useBottomNavInset();
  const [filterType, setFilterType] = useState<'all' | 'morning' | 'return'>('all');
  const [search, setSearch] = useState('');
  const [carpools, setCarpools] = useState(DEFAULT_CARPOOLS);

  // New ride modal
  const [modalOpen, setModalOpen] = useState(false);
  const [schoolName, setSchoolName] = useState('');
  const [tripType, setTripType] = useState('morning');
  const [seats, setSeats] = useState('2');
  const [notes, setNotes] = useState('');
  const [contactNumber, setContactNumber] = useState('');

  const handleAddCarpool = () => {
    if (!schoolName.trim()) {
      return Alert.alert('بيانات ناقصة', 'يرجى إدخال اسم المدرسة.');
    }
    const newRide = {
      id: `c-${Date.now()}`,
      parent_name: 'أحد أولياء الأمور',
      school_name: schoolName.trim(),
      district: 'الحي',
      trip_type: tripType,
      trip_type_label: tripType === 'morning' ? 'فترة الصباح فقط' : tripType === 'return' ? 'فترة الظهر فقط' : 'ذهاب وعودة',
      seats_available: parseInt(seats, 10) || 1,
      notes: notes.trim() || 'مشاركة توصيل أبناء الحي',
      phone: contactNumber.trim() || '0500000000',
      is_verified: true,
    };

    setCarpools(prev => [newRide, ...prev]);
    setModalOpen(false);
    setSchoolName('');
    setNotes('');
    Alert.alert('تمت الإضافة بنجاح 🚗', 'تم نشر عرض مشاركة التوصيل لجيرانك في الحي.');
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
      <LinearGradient
        colors={['#064e3b', '#047857', '#059669']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroTop}>
          <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button">
            <ChevronRight size={22} color="#ffffff" />
          </Pressable>
          <View style={styles.heroTitleWrap}>
            <Text style={styles.heroTitle}>توصيل مدارس الحي 🚗</Text>
            <Text style={styles.heroSubtitle}>مشاركة المقاعد بين أولياء الأمور لتخفيف زحمة المدارس</Text>
          </View>
          <Pressable style={styles.addBtn} onPress={() => setModalOpen(true)}>
            <Plus size={16} color="#064e3b" />
            <Text style={styles.addBtnText}>شارك مقعداً</Text>
          </Pressable>
        </View>

        <TextInput
          style={styles.searchBar}
          value={search}
          onChangeText={setSearch}
          placeholder="ابحث باسم المدرسة، الحي، أو ولي الأمر..."
          placeholderTextColor="#9ca3af"
        />
      </LinearGradient>

      {/* Filter Tabs */}
      <View style={styles.tabsRow}>
        <Pressable
          style={[styles.tabChip, filterType === 'all' && styles.tabChipActive]}
          onPress={() => setFilterType('all')}
        >
          <Text style={[styles.tabText, filterType === 'all' && styles.tabTextActive]}>كل الرحلات</Text>
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

      <ScrollView style={styles.scroll} contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomNavInset + 30 }]}>
        {filtered.map(item => (
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
              <Pressable
                style={styles.contactBtn}
                onPress={() => {
                  if (item.phone) {
                    Linking.openURL(`tel:${item.phone}`);
                  } else {
                    router.push('/messages');
                  }
                }}
              >
                <Phone size={14} color="#059669" />
                <Text style={styles.contactBtnText}>اتصال للتنسيق</Text>
              </Pressable>

              <Pressable
                style={styles.chatBtn}
                onPress={() => router.push('/messages')}
              >
                <MessageCircle size={14} color="#fff" />
                <Text style={styles.chatBtnText}>محادثة خاصة</Text>
              </Pressable>
            </View>
          </View>
        ))}
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

              <Pressable style={styles.submitBtn} onPress={handleAddCarpool}>
                <Car size={18} color="#fff" />
                <Text style={styles.submitBtnText}>نشر المقعد لجيران الحي 🤝</Text>
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
  hero: {
    paddingTop: Platform.OS === 'ios' ? 52 : 24,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  heroTop: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  heroTitleWrap: { flex: 1, alignItems: 'flex-end', paddingHorizontal: 10 },
  heroTitle: { fontSize: 20, fontWeight: '900', color: '#fff' },
  heroSubtitle: { fontSize: 11.5, color: '#a7f3d0', fontWeight: '600', marginTop: 2 },
  addBtn: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, backgroundColor: '#fff', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12 },
  addBtnText: { fontSize: 11.5, fontWeight: '900', color: '#064e3b' },
  searchBar: { backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 14, height: 44, fontSize: 13, color: '#0f172a', textAlign: 'right' },

  tabsRow: { flexDirection: 'row-reverse', paddingHorizontal: 16, paddingVertical: 10, gap: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#f1f5f9' },
  tabChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  tabChipActive: { backgroundColor: '#059669', borderColor: '#059669' },
  tabText: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  tabTextActive: { color: '#ffffff', fontWeight: '900' },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },

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
  cardHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  seatsBadge: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  seatsBadgeText: { fontSize: 11, fontWeight: '800', color: '#065f46' },
  parentName: { fontSize: 13.5, fontWeight: '900', color: '#0f172a' },
  locRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 2, marginTop: 1 },
  locText: { fontSize: 11, color: '#64748b', fontWeight: '600' },

  schoolRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, backgroundColor: '#f0fdf4', padding: 10, borderRadius: 12, marginBottom: 8 },
  schoolName: { fontSize: 13.5, fontWeight: '800', color: '#047857', textAlign: 'right' },

  tripTypeRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginBottom: 8 },
  tripTypeText: { fontSize: 12, fontWeight: '700', color: '#92400e' },
  notesText: { fontSize: 12, color: '#475569', lineHeight: 18, textAlign: 'right', marginBottom: 10 },

  cardActions: { flexDirection: 'row-reverse', gap: 8, marginTop: 4, paddingTop: 10, borderTopWidth: 1, borderColor: '#f8fafc' },
  contactBtn: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0', borderRadius: 12, paddingVertical: 8 },
  contactBtnText: { fontSize: 12, fontWeight: '800', color: '#059669' },
  chatBtn: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: '#059669', borderRadius: 12, paddingVertical: 8 },
  chatBtnText: { fontSize: 12, fontWeight: '800', color: '#fff' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 },
  modalHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 16, fontWeight: '900', color: '#0f172a' },
  modalCloseBtn: { padding: 4 },
  fieldLabel: { fontSize: 12, fontWeight: '800', color: '#334155', textAlign: 'right', marginBottom: 6 },
  input: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: '#0f172a', textAlign: 'right', marginBottom: 10 },
  submitBtn: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#059669', paddingVertical: 13, borderRadius: 14, marginTop: 6, marginBottom: 14 },
  submitBtnText: { color: '#fff', fontSize: 13.5, fontWeight: '900' },
});
