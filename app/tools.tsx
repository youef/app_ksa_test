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
  RefreshControl,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Wrench,
  Search,
  Plus,
  Clock,
  MapPin,
  CheckCircle2,
  X,
  Share2,
  Calendar,
  AlertCircle,
  ShieldCheck,
  ChevronRight,
  HandMetal,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useBottomNavInset } from '@/lib/bottomNav';
import { fetchWithCache } from '@/lib/offlineCache';
import { sendPushToUser } from '@/lib/pushSender';

type ToolCategory = 'all' | 'tools' | 'ladder' | 'cleaning' | 'outdoor' | 'electronics' | 'other';

const TOOL_CATEGORIES: { id: ToolCategory; label: string; emoji: string }[] = [
  { id: 'all', label: 'الكل', emoji: '🧰' },
  { id: 'tools', label: 'دريل وعدة', emoji: '🔨' },
  { id: 'ladder', label: 'سلالم وروافع', emoji: '🪜' },
  { id: 'cleaning', label: 'أجهزة تنظيف', emoji: '🧹' },
  { id: 'outdoor', label: 'تخييم ورحلات', emoji: '⛺' },
  { id: 'electronics', label: 'أجهزة قياس وفحص', emoji: '🔌' },
  { id: 'other', label: 'أدوات أخرى', emoji: '📦' },
];

export default function ToolsLendingScreen() {
  const bottomNavInset = useBottomNavInset();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState<ToolCategory>('all');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);

  // Modals
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCategory, setNewCategory] = useState<ToolCategory>('tools');
  const [newDays, setNewDays] = useState('3');
  const [newDeposit, setNewDeposit] = useState('');
  const [savingItem, setSavingItem] = useState(false);

  // Borrow Request Modal
  const [borrowModalOpen, setBorrowModalOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<any>(null);
  const [borrowDays, setBorrowDays] = useState('1');
  const [borrowNote, setBorrowNote] = useState('');
  const [sendingRequest, setSendingRequest] = useState(false);

  const loadData = useCallback(async (forceRefresh = false) => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id || null;
      setCurrentUserId(uid);

      if (uid) {
        const { data: prof } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
        setUserProfile(prof);
      }

      const cacheKey = `borrow_items_${selectedCat}`;
      const { data, isFromCache } = await fetchWithCache(
        cacheKey,
        async () => {
          let query = supabase
            .from('borrow_items')
            .select('*, profiles:owner_id(display_name, avatar_url, city, district, is_verified_neighbor)')
            .order('created_at', { ascending: false });

          if (selectedCat !== 'all') {
            query = query.eq('category', selectedCat);
          }

          const res = await query;
          if (res.error) throw res.error;
          return res.data || [];
        },
        { forceRefresh, ttlMs: 1000 * 60 * 10 }
      );

      if (data) {
        setItems(data);
      }
    } catch (err) {
      console.warn('Failed to load borrow items:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedCat]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const onRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const handleAddItem = async () => {
    if (!newTitle.trim()) {
      return Alert.alert('بيانات ناقصة', 'يرجى كتابة اسم الأداة أو المعدة.');
    }
    if (!currentUserId) {
      return Alert.alert('تسجيل الدخول', 'يرجى تسجيل الدخول أولاً لإضافة أداة للإعارة.');
    }

    setSavingItem(true);
    try {
      const { error } = await supabase.from('borrow_items').insert({
        owner_id: currentUserId,
        title: newTitle.trim(),
        description: newDesc.trim() || null,
        category: newCategory,
        max_days: parseInt(newDays, 10) || 3,
        deposit_note: newDeposit.trim() || null,
        city: userProfile?.city || 'الرياض',
        district: userProfile?.district || 'العليا',
        status: 'available',
      });

      if (error) throw error;

      setAddModalOpen(false);
      setNewTitle('');
      setNewDesc('');
      setNewDeposit('');
      Alert.alert('تمت الإضافة بنجاح 🛠️', 'أصبحت أداتك متاحة الآن لجيرانك للاستعارة.');
      loadData(true);
    } catch (err: any) {
      Alert.alert('خطأ', err?.message || 'تعذر إضافة الأداة');
    } finally {
      setSavingItem(false);
    }
  };

  const handleSendBorrowRequest = async () => {
    if (!currentUserId) {
      return Alert.alert('تسجيل الدخول', 'يرجى تسجيل الدخول لإرسال طلب الاستعارة.');
    }
    if (!activeItem) return;

    if (activeItem.owner_id === currentUserId) {
      return Alert.alert('غير مسموح', 'هذه الأداة ملكك بالفعل!');
    }

    setSendingRequest(true);
    try {
      // 1. Insert borrow request
      const { error: reqErr } = await supabase.from('borrow_requests').insert({
        item_id: activeItem.id,
        borrower_id: currentUserId,
        duration_days: parseInt(borrowDays, 10) || 1,
        note: borrowNote.trim() || 'السلام عليكم، أحتاج الأداة لساعات وأعيدها بإذن الله.',
        status: 'pending',
      });

      if (reqErr) throw reqErr;

      // 2. Notify tool owner via push notification
      const borrowerName = userProfile?.display_name || 'أحد الجيران';
      void sendPushToUser(activeItem.owner_id, {
        title: '🔧 طلب استعارة أداة بالحي!',
        body: `طلب ${borrowerName} استعارة «${activeItem.title}» لمدة ${borrowDays} أيام.`,
        data: { url: '/tools' },
      });

      // 3. Insert in-app notification
      try {
        await supabase.from('notifications').insert({
          user_id: activeItem.owner_id,
          type: 'tool_borrow',
          title: '🔧 طلب استعارة أداة',
          body: `طلب ${borrowerName} استعارة «${activeItem.title}» في حيكم.`,
        });
      } catch {}

      setBorrowModalOpen(false);
      setBorrowNote('');
      Alert.alert('تم إرسال الطلب! 🤝', 'تم إشعار صاحب الأداة وسيقوم بالتواصل معك لتسليمها.');
    } catch (err: any) {
      Alert.alert('خطأ', err?.message || 'تعذر إرسال طلب الاستعارة');
    } finally {
      setSendingRequest(false);
    }
  };

  const filteredItems = items.filter(item => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      item.title?.toLowerCase().includes(q) ||
      item.description?.toLowerCase().includes(q) ||
      item.district?.toLowerCase().includes(q)
    );
  });

  return (
    <View style={styles.container}>
      {/* Header Hero */}
      <LinearGradient
        colors={['#064e3b', '#065f46', '#047857']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroTopRow}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="رجوع"
          >
            <ChevronRight size={22} color="#ffffff" />
          </Pressable>

          <View style={styles.heroTitleWrap}>
            <Text style={styles.heroTitle}>سلفني بالحي 🔧</Text>
            <Text style={styles.heroSubtitle}>سوق إعارة الأدوات والمعدات بين الجيران مجاناً</Text>
          </View>

          <Pressable
            style={styles.addBtnHeader}
            onPress={() => setAddModalOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="أعِر أداتك للحي"
          >
            <Plus size={18} color="#064e3b" />
            <Text style={styles.addBtnHeaderText}>أعِر أداة</Text>
          </Pressable>
        </View>

        {/* Search Input */}
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="ابحث عن: سُلّم، دريل، منفاخ كفرات، عربة نقل..."
            placeholderTextColor="#9ca3af"
          />
          <Search size={18} color="#059669" />
        </View>
      </LinearGradient>

      {/* Category Pills */}
      <View style={styles.categoriesWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catScroll}>
          {TOOL_CATEGORIES.map(cat => {
            const isSelected = selectedCat === cat.id;
            return (
              <Pressable
                key={cat.id}
                onPress={() => setSelectedCat(cat.id)}
                style={[styles.catPill, isSelected && styles.catPillActive]}
              >
                <Text style={styles.catEmoji}>{cat.emoji}</Text>
                <Text style={[styles.catLabel, isSelected && styles.catLabelActive]}>
                  {cat.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Tool Items List */}
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
          <View style={styles.loadingCenter}>
            <ActivityIndicator size="large" color="#059669" />
            <Text style={styles.loadingText}>جارٍ تحميل الأدوات المتاحة بالحي...</Text>
          </View>
        ) : filteredItems.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIconWrap}>
              <Wrench size={36} color="#059669" />
            </View>
            <Text style={styles.emptyTitle}>لا توجد أدوات معروضة حالياً</Text>
            <Text style={styles.emptySub}>
              كن أول من يبادر بإعارة أدواتك التي لا تستخدمها يومياً، واكسب أجر وفزعة جيرانك 🤍
            </Text>
            <Pressable style={styles.emptyActionBtn} onPress={() => setAddModalOpen(true)}>
              <Plus size={16} color="#fff" />
              <Text style={styles.emptyActionBtnText}>أضف أول أداة للإعارة</Text>
            </Pressable>
          </View>
        ) : (
          filteredItems.map(item => (
            <View key={item.id} style={styles.toolCard}>
              <View style={styles.toolCardHeader}>
                <View style={styles.toolBadge}>
                  <Text style={styles.toolBadgeText}>
                    {item.status === 'available' ? '🟢 متاح للإعارة' : '🟡 مُعار حالياً'}
                  </Text>
                </View>

                <View style={styles.toolOwnerRow}>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.toolOwnerName}>
                      {item.profiles?.display_name || 'أحد الجيران'}
                    </Text>
                    <View style={styles.toolLocRow}>
                      <MapPin size={11} color="#64748b" />
                      <Text style={styles.toolLocText}>
                        {item.district ? `حي ${item.district}` : item.city}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.ownerAvatarFallback}>
                    <Text style={styles.ownerAvatarLetter}>
                      {(item.profiles?.display_name?.[0] || 'ج')}
                    </Text>
                  </View>
                </View>
              </View>

              <Text style={styles.toolTitle}>{item.title}</Text>
              {item.description ? (
                <Text style={styles.toolDesc}>{item.description}</Text>
              ) : null}

              <View style={styles.toolMetaRow}>
                <View style={styles.toolMetaPill}>
                  <Clock size={12} color="#059669" />
                  <Text style={styles.toolMetaText}>أقصى مدة: {item.max_days || 3} أيام</Text>
                </View>
                <View style={styles.toolMetaPill}>
                  <ShieldCheck size={12} color="#0284c7" />
                  <Text style={styles.toolMetaText}>إعارة مجانية بدون مقابل 🤝</Text>
                </View>
              </View>

              {item.deposit_note ? (
                <Text style={styles.depositNotice}>ملاحظة: {item.deposit_note}</Text>
              ) : null}

              <View style={styles.toolCardFooter}>
                <Pressable
                  style={[styles.borrowBtn, item.status !== 'available' && styles.borrowBtnDisabled]}
                  onPress={() => {
                    setActiveItem(item);
                    setBorrowModalOpen(true);
                  }}
                  disabled={item.status !== 'available'}
                >
                  <HandMetal size={16} color="#fff" />
                  <Text style={styles.borrowBtnText}>طلب استعارة الأداة</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Modal: Add Tool */}
      <Modal visible={addModalOpen} transparent animationType="slide" onRequestClose={() => setAddModalOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setAddModalOpen(false)}>
          <Pressable style={styles.modalCard} onPress={e => e.stopPropagation?.()}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setAddModalOpen(false)} style={styles.modalCloseBtn}>
                <X size={18} color="#64748b" />
              </Pressable>
              <Text style={styles.modalTitle}>إضافة أداة للإعارة في الحي 🛠️</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 450 }}>
              <Text style={styles.fieldLabel}>اسم الأداة أو المعدة *</Text>
              <TextInput
                style={styles.input}
                value={newTitle}
                onChangeText={setNewTitle}
                placeholder="مثال: سلّم المنيوم 4 أمتار، دريل كهربائي بوش..."
                placeholderTextColor="#9ca3af"
              />

              <Text style={styles.fieldLabel}>التصنيف</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, marginBottom: 12 }}>
                {TOOL_CATEGORIES.filter(c => c.id !== 'all').map(c => (
                  <Pressable
                    key={c.id}
                    style={[styles.catPill, newCategory === c.id && styles.catPillActive]}
                    onPress={() => setNewCategory(c.id)}
                  >
                    <Text style={styles.catEmoji}>{c.emoji}</Text>
                    <Text style={[styles.catLabel, newCategory === c.id && styles.catLabelActive]}>
                      {c.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>

              <Text style={styles.fieldLabel}>وصف الأداة وحالتها</Text>
              <TextInput
                style={[styles.input, { height: 75, textAlignVertical: 'top' }]}
                value={newDesc}
                onChangeText={setNewDesc}
                placeholder="اكتب تفاصيل الأداة، ملحقاتها، وأي تعليمات للاستخدام..."
                placeholderTextColor="#9ca3af"
                multiline
              />

              <Text style={styles.fieldLabel}>أقصى مدة للإعارة (بالأيام)</Text>
              <TextInput
                style={styles.input}
                value={newDays}
                onChangeText={setNewDays}
                keyboardType="numeric"
                placeholder="3"
                placeholderTextColor="#9ca3af"
              />

              <Text style={styles.fieldLabel}>ملاحظة خاصة أو شرط الإرجاع (اختياري)</Text>
              <TextInput
                style={styles.input}
                value={newDeposit}
                onChangeText={setNewDeposit}
                placeholder="مثال: يرجى تنظيفها قبل الإرجاع، أو إعادة الشاحن معها..."
                placeholderTextColor="#9ca3af"
              />

              <Pressable
                style={[styles.submitBtn, savingItem && { opacity: 0.6 }]}
                onPress={handleAddItem}
                disabled={savingItem}
              >
                {savingItem ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Plus size={18} color="#fff" />
                    <Text style={styles.submitBtnText}>نشر الأداة لجيران الحي</Text>
                  </>
                )}
              </Pressable>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal: Request Borrow */}
      <Modal visible={borrowModalOpen} transparent animationType="slide" onRequestClose={() => setBorrowModalOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setBorrowModalOpen(false)}>
          <Pressable style={styles.modalCard} onPress={e => e.stopPropagation?.()}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setBorrowModalOpen(false)} style={styles.modalCloseBtn}>
                <X size={18} color="#64748b" />
              </Pressable>
              <Text style={styles.modalTitle}>طلب استعارة: {activeItem?.title}</Text>
            </View>

            <View style={styles.borrowSummaryCard}>
              <Text style={styles.borrowSummaryOwner}>
                صاحب الأداة: {activeItem?.profiles?.display_name || 'الجار'}
              </Text>
              <Text style={styles.borrowSummaryLoc}>
                الحي: {activeItem?.district || activeItem?.city}
              </Text>
            </View>

            <Text style={styles.fieldLabel}>المدة المطلوبة (بالأيام)</Text>
            <TextInput
              style={styles.input}
              value={borrowDays}
              onChangeText={setBorrowDays}
              keyboardType="numeric"
              placeholder="1"
              placeholderTextColor="#9ca3af"
            />

            <Text style={styles.fieldLabel}>رسالتك للجار</Text>
            <TextInput
              style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
              value={borrowNote}
              onChangeText={setBorrowNote}
              placeholder="السلام عليكم، أحتاج الأداة لعمل صيانة بسيطة وأعيدها لكم في الموعد..."
              placeholderTextColor="#9ca3af"
              multiline
            />

            <Pressable
              style={[styles.submitBtn, sendingRequest && { opacity: 0.6 }]}
              onPress={handleSendBorrowRequest}
              disabled={sendingRequest}
            >
              {sendingRequest ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <HandMetal size={18} color="#fff" />
                  <Text style={styles.submitBtnText}>إرسال طلب الاستعارة للجار 🤝</Text>
                </>
              )}
            </Pressable>
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
  heroTopRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 14,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitleWrap: { flex: 1, alignItems: 'flex-end' },
  heroTitle: { fontSize: 20, fontWeight: '900', color: '#fff', textAlign: 'right' },
  heroSubtitle: { fontSize: 11.5, color: '#a7f3d0', fontWeight: '600', marginTop: 2, textAlign: 'right' },
  addBtnHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
  },
  addBtnHeaderText: { fontSize: 12, fontWeight: '900', color: '#064e3b' },
  searchBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#ffffff',
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

  categoriesWrap: { backgroundColor: '#fff', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#f1f5f9' },
  catScroll: { flexDirection: 'row-reverse', paddingHorizontal: 14, gap: 8 },
  catPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  catPillActive: { backgroundColor: '#059669', borderColor: '#059669' },
  catEmoji: { fontSize: 14 },
  catLabel: { fontSize: 12, fontWeight: '700', color: '#475569' },
  catLabelActive: { color: '#ffffff', fontWeight: '900' },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },
  loadingCenter: { paddingVertical: 60, alignItems: 'center', gap: 10 },
  loadingText: { fontSize: 13, color: '#64748b', fontWeight: '700' },

  emptyCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 20,
  },
  emptyIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 17, fontWeight: '900', color: '#0f172a', textAlign: 'center' },
  emptySub: { fontSize: 12.5, color: '#64748b', textAlign: 'center', lineHeight: 20, marginTop: 6, marginHorizontal: 16 },
  emptyActionBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 14,
    marginTop: 18,
  },
  emptyActionBtnText: { color: '#fff', fontSize: 13, fontWeight: '900' },

  toolCard: {
    backgroundColor: '#ffffff',
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
  toolCardHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  toolBadge: {
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  toolBadgeText: { fontSize: 11, fontWeight: '800', color: '#065f46' },
  toolOwnerRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  ownerAvatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  ownerAvatarLetter: { fontSize: 13, fontWeight: '900', color: '#059669' },
  toolOwnerName: { fontSize: 12.5, fontWeight: '800', color: '#0f172a' },
  toolLocRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 2, marginTop: 1 },
  toolLocText: { fontSize: 10.5, color: '#64748b', fontWeight: '600' },

  toolTitle: { fontSize: 15, fontWeight: '900', color: '#0f172a', textAlign: 'right', marginBottom: 4 },
  toolDesc: { fontSize: 12.5, color: '#475569', lineHeight: 18, textAlign: 'right', marginBottom: 10 },
  toolMetaRow: { flexDirection: 'row-reverse', gap: 8, marginBottom: 8 },
  toolMetaPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  toolMetaText: { fontSize: 11, fontWeight: '700', color: '#334155' },
  depositNotice: { fontSize: 11, color: '#b45309', backgroundColor: '#fffbeb', padding: 8, borderRadius: 10, textAlign: 'right', marginBottom: 10 },

  toolCardFooter: { marginTop: 4, paddingTop: 10, borderTopWidth: 1, borderColor: '#f8fafc' },
  borrowBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingVertical: 10,
    borderRadius: 12,
  },
  borrowBtnDisabled: { backgroundColor: '#cbd5e1' },
  borrowBtnText: { color: '#ffffff', fontSize: 12.5, fontWeight: '900' },

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
    marginBottom: 12,
  },
  submitBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#059669',
    paddingVertical: 13,
    borderRadius: 14,
    marginTop: 8,
    marginBottom: 16,
  },
  submitBtnText: { color: '#ffffff', fontSize: 13.5, fontWeight: '900' },

  borrowSummaryCard: { backgroundColor: '#f0fdf4', padding: 12, borderRadius: 12, marginBottom: 12 },
  borrowSummaryOwner: { fontSize: 13, fontWeight: '800', color: '#065f46', textAlign: 'right' },
  borrowSummaryLoc: { fontSize: 11, color: '#047857', textAlign: 'right', marginTop: 2 },
});
