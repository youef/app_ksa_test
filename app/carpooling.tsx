import { OasisPressable as Pressable, OasisTextInput as TextInput, OasisSurface } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import { HeaderAction, AppHeader } from '@/components/shared/AppHeader';
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { router } from 'expo-router';
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
import { getActiveLocation, isAllKingdom } from '@/lib/locationSync';

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
  mode?: 'need' | 'offer';
  is_verified?: boolean;
  participants_count?: number;
  max_participants?: number;
  departure_time?: string;
  price_per_seat?: number;
}

function tripDirection(description: string): 'morning' | 'return' | 'both' {
  if (/المشوار:\s*ذهاب وعودة/.test(description)) return 'both';
  if (/المشوار:\s*ذهاب/.test(description)) return 'morning';
  if (/المشوار:\s*عودة/.test(description)) return 'return';
  return 'both';
}
export default function CarpoolingScreen() {
  const bottomNavInset = useBottomNavInset();
  const [filterType, setFilterType] = useState<'all' | 'morning' | 'return'>('all');
  const [search, setSearch] = useState('');
  const [carpools, setCarpools] = useState<CarpoolItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [locationCity, setLocationCity] = useState('');
  const [openingChatId, setOpeningChatId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      const savedLocation = await getActiveLocation();
      const { data: profile } = auth.user
        ? await supabase.from('profiles').select('city').eq('id', auth.user.id).maybeSingle()
        : { data: null };
      const city = profile?.city?.trim() || (savedLocation?.city && !isAllKingdom(savedLocation.city) ? savedLocation.city.trim() : '');
      setLocationCity(city);
      if (!city) { setCarpools([]); return; }

      const { data, error } = await supabase.from('requests')
        .select('id,requester_id,title,description,city,district,status,created_at,max_participants,current_participants,available_seats,profiles:requester_id(id,display_name)')
        .eq('request_type', 'carpooling')
        .eq('status', 'open')
        .eq('city', city)
        .order('created_at', { ascending: false }).limit(80);
      if (error) throw error;
      const rides: CarpoolItem[] = (data || []).map((row: any) => {
        const description = typeof row.description === 'string' ? row.description : '';
        const trip_type = tripDirection(description);
        const mode = (/نوع المشاركة:\s*عرض/.test(description) || /مقاعد لتوصيل مدرسي/.test(row.title || '')) ? 'offer' : 'need';
        const capacity = mode === 'offer' ? Math.max(0, Number(row.available_seats ?? row.max_participants) || 0) : 0;
        return {
          id: row.id, requester_id: row.requester_id,
          parent_name: row.profiles?.display_name || 'عضو في الحي',
          school_name: row.title || 'توصيل مدرسي', district: row.district || 'الحي',
          city: row.city || city, mode,
          trip_type,
          trip_type_label: trip_type === 'morning' ? 'ذهاب للمدرسة' : trip_type === 'return' ? 'عودة من المدرسة' : 'ذهاب وعودة',
          seats_available: capacity, max_participants: capacity,
          participants_count: Math.max(0, Number(row.current_participants) || 0),
          notes: description,
          // An account badge is NOT a school transport licence.
          is_verified: false,
        };
      });
      setCarpools(rides);
    } catch (cause) {
      console.error('Unable to load school transport requests:', cause);
      setCarpools([]);
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

  const handleOpenChat = async (item: CarpoolItem) => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      return Alert.alert('تسجيل الدخول مطلوب', 'يرجى تسجيل الدخول لبدء محادثة خاصة مع ولي الأمر.', [
        { text: 'تسجيل الدخول', onPress: () => router.push('/auth') },
        { text: 'إلغاء', style: 'cancel' },
      ]);
    }

    const targetId = item.requester_id;
    if (!targetId) {
      return router.push('/messages');
    }

    if (targetId === auth.user.id) {
      return Alert.alert('تنبيه', 'هذا العرض منشور من قبلك.');
    }

    setOpeningChatId(item.id);
    try {
      const { data: convId, error } = await supabase.rpc('hayna_get_or_create_direct_conversation', {
        p_target: targetId,
      });

      if (error) {
        console.warn('RPC direct conv error, falling back to target parameter:', error);
        router.push({ pathname: '/conversation', params: { target: targetId } });
        return;
      }

      if (convId) {
        router.push({ pathname: '/conversation', params: { id: convId } });
      } else {
        router.push({ pathname: '/conversation', params: { target: targetId } });
      }
    } catch (err: any) {
      console.warn('Open chat error:', err);
      router.push({ pathname: '/conversation', params: { target: targetId } });
    } finally {
      setOpeningChatId(null);
    }
  };

  const handleJoinCarpool = async (item: CarpoolItem) => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      return Alert.alert('تسجيل الدخول مطلوب', 'يرجى تسجيل الدخول للانضمام للرحلة.', [
        { text: 'تسجيل الدخول', onPress: () => router.push('/auth') },
        { text: 'إلغاء', style: 'cancel' },
      ]);
    }

    if (item.requester_id === auth.user.id) {
      return Alert.alert('تنبيه', 'لا يمكنك الانضمام لرحلتك الخاصة.');
    }

    try {
      // Check if already joined
      const { data: existing } = await supabase
        .from('carpool_participants')
        .select('id, status')
        .eq('carpool_request_id', item.id)
        .eq('user_id', auth.user.id)
        .maybeSingle();

      if (existing) {
        if (existing.status === 'cancelled') {
          // Re-join
          await supabase
            .from('carpool_participants')
            .update({ status: 'pending', cancelled_at: null })
            .eq('id', existing.id);
        } else {
          return Alert.alert('معلومات', 'أنت منضم بالفعل لهذه الرحلة.');
        }
      } else {
        // Join new
        const { error } = await supabase
          .from('carpool_participants')
          .insert({
            carpool_request_id: item.id,
            user_id: auth.user.id,
            status: 'pending',
            seats_booked: 1,
          });
        if (error) throw error;
      }

      // Refresh the carpool data
      await loadData();
      Alert.alert('تم الانضمام! 🚗', 'تم طلب الانضمام للرحلة. سينسق معك ولي الأمر لتأكيد التفاصيل.');
    } catch (err: any) {
      console.warn('Join carpool error:', err);
      Alert.alert('خطأ', err?.message || 'تعذر الانضمام للرحلة');
    }
  };

  const openPublish = () => router.push({ pathname: '/ask', params: { type: 'school_transport' } });

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
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <AppHeader
        variant="sub"
        title="توصيل مدارس الحي"
        subtitle="طلبات وعروض حقيقية · التنسيق خاص وآمن"
        fallbackRoute="/home"
        rightAction={
          <HeaderAction
            style={styles.headerActionBtn}
            onPress={openPublish}
            accessibilityRole="button"
            accessibilityLabel="شارك مقعداً"
          >
            <Plus size={14} color={OASIS.colors.primary} />
            <Text style={styles.headerActionBtnText}>نشر توصيل</Text>
          </HeaderAction>
        }
      />

      {/* Search Input */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="ابحث بالحي، المرحلة، أو نوع المشوار..."
            placeholderTextColor="#9ca3af"
          />
          <Search size={18} color={OASIS.colors.primary} />
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabsRow}>
        <Pressable oasisKind="chip"
          style={[styles.tabChip, filterType === 'all' && styles.tabChipActive]}
          onPress={() => setFilterType('all')}
        >
          <Text style={[styles.tabText, filterType === 'all' && styles.tabTextActive]}>
            كل الرحلات ({carpools.length})
          </Text>
        </Pressable>
        <Pressable oasisKind="chip"
          style={[styles.tabChip, filterType === 'morning' && styles.tabChipActive]}
          onPress={() => setFilterType('morning')}
        >
          <Text style={[styles.tabText, filterType === 'morning' && styles.tabTextActive]}>
            ☀️ صباحاً (ذهاب)
          </Text>
        </Pressable>
        <Pressable oasisKind="chip"
          style={[styles.tabChip, filterType === 'return' && styles.tabChipActive]}
          onPress={() => setFilterType('return')}
        >
          <Text style={[styles.tabText, filterType === 'return' && styles.tabTextActive]}>
            🌤️ ظهراً (عودة)
          </Text>
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
            tintColor={OASIS.colors.primary}
            colors={[OASIS.colors.primary]}
          />
        }
      >
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={OASIS.colors.primary} />
            <Text style={styles.loadingText}>جاري تحميل رحلات المدارس بالحي...</Text>
          </View>
        ) : filtered.length === 0 ? (
          <OasisSurface oasisSurface="card" style={styles.emptyCard}>
            <Car size={44} color="#94a3b8" />
            <Text style={styles.emptyTitle}>{locationCity ? 'لا توجد طلبات توصيل في مدينتك الآن' : 'حدد مدينتك لعرض التوصيل المدرسي'}</Text>
            <Text style={styles.emptySub}>
              اعرض مقاعد متاحة أو اطلب توصيلًا، مع تنسيق التفاصيل في محادثة خاصة فقط.
            </Text>
            <Pressable oasisKind="action" style={styles.emptyAddBtn} onPress={openPublish}>
              <Plus size={16} color={OASIS.colors.surface} />
              <Text style={styles.emptyAddBtnText}>أضف طلب توصيل</Text>
            </Pressable>
          </OasisSurface>
        ) : (
          filtered.map(item => {
            const isChatLoading = openingChatId === item.id;
            return (
              <OasisSurface oasisSurface="card" key={item.id} style={styles.carpoolCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.seatsBadge}>
                    <Users size={12} color={OASIS.colors.deep} />
                    <Text style={styles.seatsBadgeText}>
                      {item.mode === 'offer' ? `${item.seats_available} مقاعد معروضة` : 'مطلوب توصيل'}
                    </Text>
                  </View>

                  <Pressable
                    style={styles.parentProfilePressable}
                    onPress={() => {
                      if (item.requester_id) {
                        router.push({ pathname: '/user', params: { id: item.requester_id } });
                      }
                    }}
                  >
                    <View style={{ alignItems: 'flex-end' }}>
                      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }}>
                        <Text style={styles.parentName}>{item.parent_name}</Text>
                        
                      </View>
                      <View style={styles.locRow}>
                        <MapPin size={11} color={OASIS.colors.muted} />
                        <Text style={styles.locText}>حي {item.district}</Text>
                      </View>
                    </View>
                    <View style={styles.parentAvatarCircle}>
                      <Text style={styles.parentAvatarInitial}>
                        {(item.parent_name || 'ج')[0]}
                      </Text>
                    </View>
                  </Pressable>
                </View>

                <View style={styles.schoolRow}>
                  <GraduationCap size={16} color={OASIS.colors.primary} />
                  <Text style={styles.schoolName}>{item.school_name}</Text>
                </View>

                <View style={styles.tripTypeRow}>
                  <Clock size={13} color="#b45309" />
                  <Text style={styles.tripTypeText}>{item.trip_type_label} · التنسيق عبر المحادثة</Text>
                </View>

                {item.notes ? (
                  <Text style={styles.notesText} numberOfLines={5}>{item.notes}</Text>
                ) : null}

                <View style={styles.cardActions}>
                  <Pressable oasisVariant="primary" oasisKind="action"
                    style={[styles.joinBtn, isChatLoading && { opacity: 0.8 }]}
                    onPress={() => item.mode === 'offer' ? void handleJoinCarpool(item) : void handleOpenChat(item)}
                    disabled={isChatLoading}
                  >
                    <Users size={14} color={OASIS.colors.surface} />
                    <Text style={styles.joinBtnText}>{item.mode === 'offer' ? 'طلب مقعد' : 'عرض مساعدة'}</Text>
                  </Pressable>

                  <Pressable oasisKind="action"
                    style={[styles.chatBtn, isChatLoading && { opacity: 0.8 }]}
                    onPress={() => handleOpenChat(item)}
                    disabled={isChatLoading}
                  >
                    {isChatLoading ? (
                      <ActivityIndicator size="small" color={OASIS.colors.surface} />
                    ) : (
                      <>
                        <MessageCircle size={14} color={OASIS.colors.surface} />
                        <Text style={styles.chatBtnText}>محادثة خاصة</Text>
                      </>
                    )}
                  </Pressable>
                </View>
              </OasisSurface>
            );
          })
        )}
      </ScrollView>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: OASIS.colors.background },
  headerActionBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: OASIS.colors.soft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  headerActionBtnText: { fontSize: 12, fontWeight: '600', color: OASIS.colors.primary },
  searchSection: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 },
  searchBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: OASIS.colors.surface,
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: OASIS.colors.line,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: OASIS.colors.ink,
    textAlign: 'right',
    paddingHorizontal: 8,
  },
  tabsRow: {
    flexDirection: 'row-reverse',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: OASIS.colors.surface,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
  },
  tabChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: OASIS.colors.background,
    borderWidth: 1,
    borderColor: OASIS.colors.line,
  },
  tabChipActive: { backgroundColor: OASIS.colors.primary, borderColor: OASIS.colors.primary },
  tabText: { fontSize: 11.5, fontWeight: '700', color: OASIS.colors.muted },
  tabTextActive: { color: OASIS.colors.surface, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { padding: 14, gap: 12 },
  loadingBox: { paddingVertical: 50, alignItems: 'center', gap: 10 },
  loadingText: { fontSize: 13, color: OASIS.colors.muted, fontWeight: '700' },
  emptyCard: {
    backgroundColor: OASIS.colors.surface,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: OASIS.colors.line,
    marginTop: 10,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: OASIS.colors.ink, marginTop: 10 },
  emptySub: { fontSize: 12, color: OASIS.colors.muted, textAlign: 'center', marginTop: 4, lineHeight: 18 },
  emptyAddBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: OASIS.colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
    marginTop: 16,
  },
  emptyAddBtnText: { color: OASIS.colors.surface, fontSize: 13, fontWeight: '600' },
  carpoolCard: {
    backgroundColor: OASIS.colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: OASIS.colors.line,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0,
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
    backgroundColor: OASIS.colors.soft,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  seatsBadgeText: { fontSize: 11, fontWeight: '600', color: OASIS.colors.deep },
  parentProfilePressable: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  parentAvatarCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: OASIS.colors.soft,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  parentAvatarInitial: {
    fontSize: 14,
    fontWeight: '700',
    color: OASIS.colors.primary,
  },
  parentName: { fontSize: 13.5, fontWeight: '700', color: OASIS.colors.ink },
  locRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 2, marginTop: 1 },
  locText: { fontSize: 11, color: OASIS.colors.muted, fontWeight: '600' },
  schoolRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: OASIS.colors.soft,
    padding: 10,
    borderRadius: 12,
    marginBottom: 8,
  },
  schoolName: { fontSize: 13.5, fontWeight: '600', color: OASIS.colors.primary, textAlign: 'right' },
  tripTypeRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginBottom: 8 },
  tripTypeText: { fontSize: 12, fontWeight: '700', color: '#92400e' },
  notesText: { fontSize: 12, color: OASIS.colors.muted, lineHeight: 18, textAlign: 'right', marginBottom: 10 },
  cardActions: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: OASIS.colors.background,
  },
  contactBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: OASIS.colors.soft,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    borderRadius: 12,
    paddingVertical: 8,
  },
  contactBtnText: { fontSize: 12, fontWeight: '600', color: OASIS.colors.primary },
  chatBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: OASIS.colors.primary,
    borderRadius: 12,
    paddingVertical: 8,
    minHeight: 38,
  },
  chatBtnText: { fontSize: 12, fontWeight: '600', color: OASIS.colors.surface },
  joinBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: OASIS.colors.primary,
    borderRadius: 12,
    paddingVertical: 8,
    minHeight: 38,
  },
  joinBtnText: { fontSize: 12, fontWeight: '600', color: OASIS.colors.surface },
  departureRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: OASIS.colors.soft,
    padding: 8,
    borderRadius: 10,
    marginBottom: 8,
  },
  departureText: { fontSize: 12, fontWeight: '700', color: OASIS.colors.primary, textAlign: 'right' },
  priceRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fef3c7',
    padding: 8,
    borderRadius: 10,
    marginBottom: 8,
  },
  priceText: { fontSize: 12, fontWeight: '700', color: '#b45309', textAlign: 'right' },

  /* Modal */
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: OASIS.colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 14 },
  modalHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: OASIS.colors.ink },
  modalCloseBtn: { padding: 4 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: OASIS.colors.ink, textAlign: 'right', marginBottom: 6 },
  input: {
    backgroundColor: OASIS.colors.background,
    borderWidth: 1,
    borderColor: OASIS.colors.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: OASIS.colors.ink,
    textAlign: 'right',
    marginBottom: 10,
  },
  submitBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: OASIS.colors.primary,
    paddingVertical: 13,
    borderRadius: 14,
    marginTop: 6,
    marginBottom: 14,
  },
  submitBtnText: { color: OASIS.colors.surface, fontSize: 13.5, fontWeight: '700' },
});
