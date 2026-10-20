import { HeaderAction } from '@/components/shared/AppHeader';
import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import {
  MessageCircle,
  Search,
  Plus,
  Check,
  CheckCheck,
  BellOff,
  Bell,
  UserX,
  UserCheck,
  Trash2,
  X,
  Eraser,
  ChevronLeft,
  SlidersHorizontal,
  Lock,
  Filter,
  CheckCircle2,
  MapPin,
  Clock,
  User,
} from 'lucide-react-native';
import { useBottomNavInset } from '@/lib/bottomNav';
import AppHeader from '@/components/shared/AppHeader';
import { syncDndWithNotifications } from '@/lib/notifications';
import {
  DndSettings,
  DEFAULT_DND,
  clearForMe,
  deleteConversationForEveryone,
  displayName,
  dndLabel,
  formatArabicTime,
  isDndActiveNow,
  loadConvSettings,
  loadDnd,
  saveDnd,
  setBlock,
  setMute,
} from '@/lib/chatControls';

type Conv = {
  id: string;
  other: any;
  lastMessage: any;
  isUnread: boolean;
  isBlocked: boolean;
  iBlocked: boolean;
  blockedMe: boolean;
  isMuted: boolean;
  isCleared: boolean;
  otherUserId: string;
  name: string;
};

export default function Messages() {
  const bottomNavInset = useBottomNavInset();
  const [conversations, setConversations] = useState<Conv[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dnd, setDnd] = useState<DndSettings>(DEFAULT_DND);
  const [blockedIds, setBlockedIds] = useState<string[]>([]);
  const [blockerIds, setBlockerIds] = useState<string[]>([]);
  const [dndSheet, setDndSheet] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [draftStart, setDraftStart] = useState('22:00');
  const [draftEnd, setDraftEnd] = useState('07:00');
  const [target, setTarget] = useState<Conv | null>(null);
  const [busy, setBusy] = useState(false);
  const [onlyUnread, setOnlyUnread] = useState(false);

  const dndNow = isDndActiveNow(dnd);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return router.replace('/auth');
    setCurrentUserId(u.user.id);

    // 1. DND state (with schedule)
    const dndSettings = await loadDnd(u.user.id);
    setDnd(dndSettings);
    await syncDndWithNotifications(u.user.id);

    // 2. Blocked user IDs (both directions so the UI can explain a locked chat)
    const [{ data: myBlocks }, { data: blockedBy }] = await Promise.all([
      supabase.from('blocks').select('blocked_id').eq('blocker_id', u.user.id),
      supabase.from('blocks').select('blocker_id').eq('blocked_id', u.user.id),
    ]);

    const bIds = [...new Set((myBlocks || []).map((b: any) => b.blocked_id))] as string[];
    const brIds = [...new Set((blockedBy || []).map((b: any) => b.blocker_id))] as string[];
    setBlockedIds(bIds);
    setBlockerIds(brIds);

    // 3. My conversations
    const { data: myConvs } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', u.user.id);

    if (!myConvs || myConvs.length === 0) {
      setConversations([]);
      setLoading(false);
      return;
    }

    const convIds = myConvs.map(c => c.conversation_id);

    const [messagesRes, allMembersRes, settings] = await Promise.all([
      supabase
        .from('messages')
        .select('*')
        .in('conversation_id', convIds)
        .order('created_at', { ascending: false }),
      supabase
        .from('conversation_members')
        .select('conversation_id, user_id')
        .in('conversation_id', convIds)
        .neq('user_id', u.user.id),
      loadConvSettings(u.user.id, convIds),
    ]);

    const messages = messagesRes.data || [];
    const allMembers = allMembersRes.data || [];

    const otherUserIds = [...new Set(allMembers.map((m: any) => m.user_id))];
    const { data: profiles } =
      otherUserIds.length > 0
        ? await supabase.from('profiles').select('*').in('id', otherUserIds)
        : { data: [] };

    const profileMap = (profiles || []).reduce((acc: any, p: any) => ({ ...acc, [p.id]: p }), {});

    const convMap: Record<string, any> = {};
    messages.forEach((msg: any) => {
      if (!convMap[msg.conversation_id]) convMap[msg.conversation_id] = msg;
    });

    const convList: Conv[] = convIds
      .map(convId => {
        const otherMember = allMembers.find((m: any) => m.conversation_id === convId);
        const otherProfile = otherMember ? profileMap[otherMember.user_id] : null;
        const lastMsg = convMap[convId];
        const setting = settings[convId];
        const otherId = otherMember?.user_id || '';

        return {
          id: convId,
          other: otherProfile,
          lastMessage: lastMsg,
          isUnread:
            !!lastMsg &&
            lastMsg.sender_id !== u.user.id &&
            !(lastMsg.read_by || []).includes(u.user.id),
          isBlocked: otherId ? bIds.includes(otherId) || brIds.includes(otherId) : false,
          iBlocked: otherId ? bIds.includes(otherId) : false,
          blockedMe: otherId ? brIds.includes(otherId) : false,
          isMuted: !!setting?.muted,
          isCleared: !!setting?.clearedAt,
          otherUserId: otherId,
          name: displayName(otherProfile),
        };
      })
      .filter(c => c.other);

    convList.sort((a, b) =>
      (b.lastMessage?.created_at || '').localeCompare(a.lastMessage?.created_at || '')
    );

    setConversations(convList);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Keep the silent state honest while the screen is open.
  useEffect(() => {
    const timer = setInterval(() => {
      setDnd(prev => ({ ...prev }));
    }, 60_000);
    return () => clearInterval(timer);
  }, []);

  async function applyDnd(next: DndSettings) {
    setDnd(next);
    setDndSheet(false);
    const result = await saveDnd(currentUserId, next);
    if (!result.ok) {
      Alert.alert('تعذّر الحفظ', result.error);
      return;
    }
    await syncDndWithNotifications(currentUserId);
  }

  function openDndSheet() {
    setDndSheet(true);
  }

  function pickSchedule(schedule: DndSettings['schedule']) {
    if (schedule === 'custom') {
      setDndSheet(false);
      setDraftStart(dnd.start || '22:00');
      setDraftEnd(dnd.end || '07:00');
      setCustomOpen(true);
      return;
    }
    void applyDnd({ ...dnd, enabled: true, schedule });
  }

  function saveCustom() {
    setCustomOpen(false);
    void applyDnd({ enabled: true, schedule: 'custom', start: draftStart, end: draftEnd });
  }

  async function runAction(
    successTitle: string,
    action: () => Promise<{ ok: boolean; error?: string }>
  ) {
    setBusy(true);
    const result = await action();
    setBusy(false);
    setTarget(null);

    if (!result.ok) {
      Alert.alert('تعذّر تنفيذ العملية', result.error || 'حدث خطأ غير متوقع.');
      return;
    }
    await load();
    Alert.alert('تم ✓', successTitle);
  }

  function confirmMute(conv: Conv) {
    const next = !conv.isMuted;
    runAction(next ? 'تم كتم المحادثة 🔕' : 'تم إلغاء الكتم 🔔', () =>
      setMute(currentUserId, conv.id, next)
    );
  }

  function confirmClearMine(conv: Conv) {
    Alert.alert(
      'مسح المحادثة عندي 🧹',
      `سيتم حذف الرسائل من عندك فقط.\n\n${conv.name} سيحتفظ بنسخته من الرسائل.`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'مسح عندي',
          style: 'destructive',
          onPress: () => runAction('تم مسح المحادثة من عندك ✓', () => clearForMe(currentUserId, conv.id)),
        },
      ]
    );
  }

  function confirmDeleteAll(conv: Conv) {
    Alert.alert(
      'حذف المحادثة للجميع ⚠️',
      `سيتم حذف المحادثة وكل رسائلها نهائياً، ولن تظهر لـ ${conv.name} أيضاً.\n\nلا يمكن التراجع عن هذه العملية.`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف نهائي للجميع',
          style: 'destructive',
          onPress: () =>
            runAction('حُذفت المحادثة من قائمتك ومن عند الطرف الآخر.', () =>
              deleteConversationForEveryone(conv.id)
            ),
        },
      ]
    );
  }

  function confirmBlock(conv: Conv) {
    if (conv.blockedMe) {
      setTarget(null);
      Alert.alert('مُحظر من الطرف الآخر', `${conv.name} حظرك. لن تظهر رسائلك له ولا يمكنكم التواصل حتى يُزيل الحظر.`);
      return;
    }

    if (conv.iBlocked) {
      Alert.alert('إلغاء الحظر', `هل تريد السماح لـ ${conv.name} بمراسلتك مرة أخرى؟`, [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'إلغاء الحظر',
          onPress: () => runAction('تم رفع الحظر ✓ يمكنك تبادل الرسائل مجدداً.', () =>
            setBlock(currentUserId, conv.otherUserId, false)
          ),
        },
      ]);
      return;
    }

    Alert.alert('حظر المستخدم 🚫', `لن يتمكن ${conv.name} من مراسلتك، وستُخفى رسائله من المحادثة.`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حظر الآن',
        style: 'destructive',
        onPress: () => runAction(`أضفنا ${conv.name} إلى قائمة المحظورين.`, () =>
          setBlock(currentUserId, conv.otherUserId, true)
        ),
      },
    ]);
  }

  const filtered = conversations.filter(c => {
    const matchesSearch = !searchQuery.trim() || c.name.toLowerCase().includes(searchQuery.trim().toLowerCase());
    return matchesSearch && (!onlyUnread || c.isUnread);
  });

  const unreadCount = conversations.filter(c => c.isUnread && !c.isMuted && !dndNow).length;
  const silentUnread = conversations.filter(c => c.isUnread && (c.isMuted || dndNow)).length;

  return (
    <View style={styles.container}>
      <AppHeader
        variant="tab"
        title="الرسائل والمحادثات"
        subtitle={unreadCount > 0 ? `${unreadCount} محادثة جديدة غير مقروءة` : 'تواصل وتنسيق مع جيران حيك'}
        rightAction={
          <View style={styles.headerRightActions}>
            {silentUnread > 0 && (
              <View style={styles.silentBadge}>
                <BellOff size={11} color="#059669" />
                <Text style={styles.silentBadgeText}>{silentUnread}</Text>
              </View>
            )}

            <HeaderAction
              style={[styles.dndBtn, dndNow && styles.dndBtnActive]}
              onPress={openDndSheet}
              accessibilityRole="button"
              accessibilityLabel="عدم الإزعاج"
            >
              {dndNow ? <BellOff size={13} color="#dc2626" /> : <Bell size={13} color="#64748b" />}
              <Text style={[styles.dndBtnText, dndNow && { color: '#dc2626' }]}>
                {dndNow ? 'صامت' : 'تنبيهات'}
              </Text>
            </HeaderAction>

            <HeaderAction
              style={styles.newChatBtn}
              onPress={() => router.push('/search')}
              accessibilityRole="button"
              accessibilityLabel="محادثة جديدة"
            >
              <Plus size={17} color="#059669" />
            </HeaderAction>
          </View>
        }
      />

      {/* Modern Search & Filter Capsule */}
      <View style={styles.searchSection}>
        <View style={styles.searchBox}>
          <Search size={17} color="#059669" />
          <TextInput
            style={styles.searchInput}
            placeholder="ابحث في محادثاتك مع الجيران..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            selectionColor="#059669"
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={6} style={styles.clearSearchBtn}>
              <X size={14} color="#64748b" />
            </Pressable>
          )}
        </View>

        {/* Filter Pills */}
        <View style={styles.filtersRow}>
          <Pressable
            style={[styles.filterPill, !onlyUnread && styles.filterPillActive]}
            onPress={() => setOnlyUnread(false)}
          >
            <MessageCircle size={13} color={!onlyUnread ? '#fff' : '#64748b'} />
            <Text style={[styles.filterPillText, !onlyUnread && styles.filterPillTextActive]}>
              الكل ({conversations.length})
            </Text>
          </Pressable>

          <Pressable
            style={[styles.filterPill, onlyUnread && styles.filterPillActive]}
            onPress={() => setOnlyUnread(true)}
          >
            <Filter size={13} color={onlyUnread ? '#fff' : '#64748b'} />
            <Text style={[styles.filterPillText, onlyUnread && styles.filterPillTextActive]}>
              غير مقروء
            </Text>
            {unreadCount > 0 && (
              <View style={styles.unreadCounterBadge}>
                <Text style={styles.unreadCounterText}>{unreadCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {dndNow && (
        <View style={styles.dndBanner}>
          <BellOff size={15} color="#b45309" />
          <Text style={styles.dndBannerText} numberOfLines={2}>
            {dnd.schedule === 'off'
              ? 'وضع عدم الإزعاج مفعّل — الإشعارات صامتة.'
              : `صامت حتى ${formatArabicTime(dnd.schedule === 'nightly' ? '07:00' : dnd.end)}`}
          </Text>
          <Pressable onPress={openDndSheet} style={styles.dndBannerAction}>
            <Text style={styles.dndBannerActionText}>تعديل</Text>
          </Pressable>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#059669" />
          <Text style={{ marginTop: 10, color: '#059669', fontSize: 13, fontWeight: '800' }}>
            جاري تحميل الرسائل...
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          contentContainerStyle={{ paddingBottom: bottomNavInset + 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
              tintColor="#059669"
            />
          }
        >
          <View style={styles.inner}>
            {filtered.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <MessageCircle size={44} color="#94a3b8" />
                </View>
                <Text style={styles.emptyTitle}>
                  {searchQuery ? 'لا توجد نتائج لبحثك' : 'لا توجد محادثات بعد'}
                </Text>
                <Text style={styles.emptySub}>
                  {searchQuery
                    ? 'جرب البحث باسم جار آخر أو كلمة مفتاحية أخرى.'
                    : 'تواصل مع جيران حيك، استفسر عن خدماتهم، أو نسق معهم مباشرة.'}
                </Text>
                {!searchQuery && (
                  <Pressable style={styles.startChatBtn} onPress={() => router.push('/search')}>
                    <Text style={styles.startChatBtnText}>ابحث عن جار وابدأ محادثة 💬</Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <>
                {filtered.some(c => c.isUnread && !c.isMuted && !dndNow) && (
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionLabel}>غير مقروء 🔔</Text>
                  </View>
                )}

                {filtered
                  .filter(c => c.isUnread && !c.isMuted && !dndNow)
                  .map(conv => (
                    <ConvCard
                      key={conv.id}
                      conv={conv}
                      currentUserId={currentUserId}
                      onLongPress={() => setTarget(conv)}
                    />
                  ))}

                {filtered.some(c => c.isUnread && !c.isMuted && !dndNow) &&
                  filtered.some(c => !(c.isUnread && !c.isMuted && !dndNow)) && (
                    <View style={styles.sectionHeaderRow}>
                      <Text style={styles.sectionLabel}>المحادثات</Text>
                    </View>
                  )}

                {filtered
                  .filter(c => !(c.isUnread && !c.isMuted && !dndNow))
                  .map(conv => (
                    <ConvCard
                      key={conv.id}
                      conv={conv}
                      currentUserId={currentUserId}
                      onLongPress={() => setTarget(conv)}
                    />
                  ))}
              </>
            )}
          </View>
        </ScrollView>
      )}

      {/* Conversation actions Bottom Sheet */}
      <Modal visible={!!target} transparent animationType="fade" onRequestClose={() => setTarget(null)}>
        <Pressable style={styles.overlay} onPress={() => setTarget(null)}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={styles.sheetTitle} numberOfLines={1}>
                  {target?.name}
                </Text>
                <Text style={styles.sheetSub}>
                  {target?.other?.district ? `حي ${target.other.district}` : 'أحد جيران الحي'}
                </Text>
              </View>
              <Pressable onPress={() => setTarget(null)} style={styles.sheetClose}>
                <X size={18} color="#64748b" />
              </Pressable>
            </View>

            {busy && <ActivityIndicator style={{ marginBottom: 10 }} color="#059669" />}

            <SheetRow
              icon={target?.isMuted ? <Bell size={18} color="#059669" /> : <BellOff size={18} color="#d97706" />}
              label={target?.isMuted ? 'إلغاء كتم الإشعارات 🔔' : 'كتم المحادثة 🔕'}
              onPress={() => target && confirmMute(target)}
            />
            <SheetRow
              icon={<Eraser size={18} color="#64748b" />}
              label="مسح المحادثة عندي 🧹"
              subtitle="يحذف الرسائل من عندك فقط"
              onPress={() => target && confirmClearMine(target)}
            />
            <SheetRow
              icon={<Trash2 size={18} color="#dc2626" />}
              label="حذف المحادثة للجميع ⚠️"
              subtitle="حذف نهائي للطرفين"
              danger
              onPress={() => target && confirmDeleteAll(target)}
            />
            <SheetRow
              icon={
                target?.iBlocked ? (
                  <UserCheck size={18} color="#059669" />
                ) : target?.blockedMe ? (
                  <Lock size={18} color="#94a3b8" />
                ) : (
                  <UserX size={18} color="#dc2626" />
                )
              }
              label={
                target?.iBlocked
                  ? 'إلغاء حظر المستخدم'
                  : target?.blockedMe
                  ? 'هذا المستخدم حظرك 🔒'
                  : 'حظر المستخدم 🚫'
              }
              danger={!target?.iBlocked && !target?.blockedMe}
              onPress={() => target && confirmBlock(target)}
            />
            <SheetRow
              icon={<ChevronLeft size={18} color="#059669" />}
              label="عرض الملف الشخصي 👤"
              onPress={() => {
                const t = target;
                setTarget(null);
                if (t) router.push({ pathname: '/user', params: { id: t.otherUserId } });
              }}
            />
          </View>
        </Pressable>
      </Modal>

      {/* DND sheet */}
      <Modal visible={dndSheet} transparent animationType="fade" onRequestClose={() => setDndSheet(false)}>
        <Pressable style={styles.overlay} onPress={() => setDndSheet(false)}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>وضع عدم الإزعاج 🔕</Text>
              <Pressable onPress={() => setDndSheet(false)} style={styles.sheetClose}>
                <X size={18} color="#64748b" />
              </Pressable>
            </View>

            <Pressable
              style={[styles.optionCard, !dnd.enabled && styles.optionCardActive]}
              onPress={() => void applyDnd({ ...dnd, enabled: false })}
            >
              <Bell size={18} color={!dnd.enabled ? '#059669' : '#64748b'} />
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={styles.optionCardTitle}>إشعارات عادية</Text>
                <Text style={styles.optionCardSub}>صوت وتنبيهات لكل الرسائل الواردة</Text>
              </View>
            </Pressable>

            <Pressable
              style={[styles.optionCard, dnd.enabled && dnd.schedule === 'off' && styles.optionCardActive]}
              onPress={() => pickSchedule('off')}
            >
              <BellOff size={18} color="#d97706" />
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={styles.optionCardTitle}>صامت دائماً</Text>
                <Text style={styles.optionCardSub}>كتم كل الإشعارات طوال اليوم</Text>
              </View>
            </Pressable>

            <Pressable
              style={[styles.optionCard, dnd.enabled && dnd.schedule === 'nightly' && styles.optionCardActive]}
              onPress={() => pickSchedule('nightly')}
            >
              <SlidersHorizontal size={18} color="#d97706" />
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={styles.optionCardTitle}>صامت ليلاً 🌙</Text>
                <Text style={styles.optionCardSub}>من 10:00 م حتى 7:00 ص تلقائياً</Text>
              </View>
            </Pressable>

            <Pressable
              style={[
                styles.optionCard,
                dnd.enabled && dnd.schedule === 'custom' && styles.optionCardActive,
                { borderBottomWidth: 0 },
              ]}
              onPress={() => pickSchedule('custom')}
            >
              <SlidersHorizontal size={18} color="#d97706" />
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={styles.optionCardTitle}>وقت مخصص ⏱</Text>
                <Text style={styles.optionCardSub}>
                  {dnd.schedule === 'custom'
                    ? `من ${formatArabicTime(dnd.start)} إلى ${formatArabicTime(dnd.end)}`
                    : 'حدّد ساعات الكتم يدوياً'}
                </Text>
              </View>
            </Pressable>

            <Text style={styles.sheetNote}>
              الحالة الحالية: {dndLabel(dnd)}
            </Text>
          </View>
        </Pressable>
      </Modal>

      {/* Custom DND hours */}
      <Modal visible={customOpen} transparent animationType="fade" onRequestClose={() => setCustomOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setCustomOpen(false)}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>وقت الكتم المخصص ⏱</Text>
              <Pressable onPress={() => setCustomOpen(false)} style={styles.sheetClose}>
                <X size={18} color="#64748b" />
              </Pressable>
            </View>

            <Text style={styles.fieldLabel}>يبدأ الكتم من</Text>
            <TextInput
              style={styles.timeInput}
              value={draftStart}
              onChangeText={setDraftStart}
              placeholder="22:00"
              placeholderTextColor="#94a3b8"
              keyboardType="numbers-and-punctuation"
              maxLength={5}
            />

            <Text style={styles.fieldLabel}>ينتهي الكتم في</Text>
            <TextInput
              style={styles.timeInput}
              value={draftEnd}
              onChangeText={setDraftEnd}
              placeholder="07:00"
              placeholderTextColor="#94a3b8"
              keyboardType="numbers-and-punctuation"
              maxLength={5}
            />

            <Text style={styles.sheetNote}>الصيغة 24 ساعة — مثال: 22:00 تعني 10 مساءً.</Text>

            <Pressable style={styles.saveTimeBtn} onPress={saveCustom}>
              <Text style={styles.saveTimeBtnText}>حفظ الوقت</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function SheetRow({
  icon,
  label,
  subtitle,
  danger,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  subtitle?: string;
  danger?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.sheetRow} onPress={onPress}>
      <View style={styles.sheetRowIconBox}>{icon}</View>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        <Text style={[styles.sheetRowText, danger && { color: '#dc2626' }]}>{label}</Text>
        {subtitle ? <Text style={styles.sheetRowSub}>{subtitle}</Text> : null}
      </View>
    </Pressable>
  );
}

function formatMessagePreview(bodyStr?: string | null, isMine = false): string {
  if (!bodyStr) return 'ابدأ المحادثة';
  const trimmed = bodyStr.trim();
  if (!trimmed) return 'ابدأ المحادثة';

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object') {
        const type = parsed.type;
        if (type === 'location') {
          const locName = parsed.label ? ` (${parsed.label})` : '';
          return isMine ? `📍 تم إرسال موقعك${locName}` : `📍 أرسل موقعه${locName}`;
        }
        if (type === 'image' || type === 'photo') {
          return isMine ? '📷 أرسلت صورة' : '📷 أرسل صورة';
        }
        if (type === 'sticker') {
          return isMine ? '✨ أرسلت ملصقاً' : '✨ أرسل ملصقاً';
        }
        if (type === 'file' || type === 'document') {
          const fileName = parsed.name ? ` (${parsed.name})` : '';
          return isMine ? `📎 أرسلت ملفاً${fileName}` : `📎 أرسل ملفاً${fileName}`;
        }
        if (type === 'audio' || type === 'voice') {
          return isMine ? '🎤 أرسلت تسجيلاً صوتياً' : '🎤 أرسل تسجيلاً صوتياً';
        }
        if (type === 'video') {
          return isMine ? '📹 أرسلت مقطع فيديو' : '📹 أرسل مقطع فيديو';
        }
        if (type === 'appreciation') {
          return isMine
            ? '☕ أهديت قهوة وشكر (+10 نقاط)'
            : '☕ وصلتك بطاقة شكر وقهوة (+10 نقاط)';
        }
      }
    } catch {
      // fallback
    }
  }

  return isMine ? `أنت: ${trimmed}` : trimmed;
}

function ConvCard({
  conv,
  currentUserId,
  onLongPress,
}: {
  conv: Conv;
  currentUserId: string;
  onLongPress: () => void;
}) {
  const { lastMessage, isUnread, isBlocked, isMuted, id, other, name } = conv;
  const avatar = other?.avatar_url;
  const isLastMine = lastMessage?.sender_id === currentUserId;
  const isRead = isLastMine ? true : (lastMessage?.read_by || []).includes(currentUserId);
  const timeStr = lastMessage?.created_at ? formatTime(lastMessage.created_at) : '';

  const preview = isBlocked
    ? conv.iBlocked
      ? '🚫 محظور — الإرسال مغلق'
      : '🔒 هذا المستخدم حظرك — لا يمكن التواصل'
    : conv.isCleared && !lastMessage
    ? '🧹 تم مسح المحادثة من عندك'
    : formatMessagePreview(lastMessage?.body, isLastMine);

  return (
    <Pressable
      style={[
        styles.convCard,
        isUnread && styles.convCardUnread,
        isBlocked && styles.convCardBlocked,
        isMuted && styles.convCardMuted,
      ]}
      onPress={() => router.push({ pathname: '/conversation', params: { id } })}
      onLongPress={onLongPress}
      delayLongPress={280}
    >
      <View style={styles.avatarWrap}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarLetter}>{(name?.[0] || 'ج').toUpperCase()}</Text>
          </View>
        )}
        {other?.is_verified && (
          <View style={styles.verifiedDot}>
            <CheckCircle2 size={12} color="#059669" />
          </View>
        )}
        {isMuted && (
          <View style={styles.mutedDot}>
            <BellOff size={9} color="#fff" />
          </View>
        )}
      </View>

      <View style={styles.convContent}>
        <View style={styles.convTopRow}>
          <View style={styles.nameBadgesRow}>
            <Text style={[styles.convName, isUnread && styles.convNameUnread]} numberOfLines={1}>
              {name}
            </Text>
            {isBlocked && (
              <View style={styles.blockedPill}>
                <Text style={styles.blockedPillText}>محظور</Text>
              </View>
            )}
          </View>
          <Text style={[styles.convTime, isUnread && styles.convTimeUnread]}>{timeStr}</Text>
        </View>

        <View style={styles.convBottomRow}>
          <View style={styles.lastMsgRow}>
            {isLastMine &&
              (isRead ? (
                <CheckCheck size={14} color="#059669" style={{ marginLeft: 4 }} />
              ) : (
                <Check size={14} color="#94a3b8" style={{ marginLeft: 4 }} />
              ))}
            <Text style={[styles.lastMsg, isUnread && styles.lastMsgUnread]} numberOfLines={1}>
              {preview}
            </Text>
          </View>
          {isUnread && !isMuted && <View style={styles.unreadDot} />}
        </View>
      </View>
    </Pressable>
  );
}

function formatTime(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'الآن';
    if (diffMins < 60) return `${diffMins} د`;
    if (diffHours < 24) return `${diffHours} س`;
    if (diffDays === 1) return 'أمس';
    return date.toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  headerRightActions: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  silentBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ecfdf5',
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  silentBadgeText: { color: '#059669', fontSize: 11, fontWeight: '800' },
  dndBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  dndBtnActive: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  dndBtnText: { fontSize: 11, fontWeight: '700', color: '#64748b' },
  newChatBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    gap: 8,
  },
  searchBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    paddingHorizontal: 12,
    height: 46,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    textAlign: 'right',
    height: 42,
    padding: 0,
    fontWeight: '700',
  },
  clearSearchBtn: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filtersRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginBottom: 4,
  },
  filterPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterPillActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  filterPillText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#64748b',
  },
  filterPillTextActive: {
    color: '#ffffff',
  },
  unreadCounterBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  unreadCounterText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
  },
  dndBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fef3c7',
    borderBottomWidth: 1,
    borderColor: '#fcd34d',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  dndBannerText: {
    flex: 1,
    color: '#92400e',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
    marginRight: 6,
  },
  dndBannerAction: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#d97706',
    borderRadius: 6,
  },
  dndBannerActionText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  list: { flex: 1, paddingTop: 10 },
  inner: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 16 },
  sectionHeaderRow: {
    marginBottom: 8,
    marginTop: 6,
  },
  sectionLabel: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#475569',
    textAlign: 'right',
  },
  convCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 13,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1,
  },
  convCardUnread: {
    borderColor: '#a7f3d0',
    backgroundColor: '#f0fdf4',
  },
  convCardBlocked: { opacity: 0.7, backgroundColor: '#fef2f2', borderColor: '#fee2e2' },
  convCardMuted: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' },
  avatarWrap: { position: 'relative' },
  avatar: { width: 50, height: 50, borderRadius: 25, borderWidth: 1.5, borderColor: '#e2e8f0' },
  avatarFallback: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#a7f3d0',
  },
  avatarLetter: { fontSize: 18, fontWeight: '900', color: '#059669' },
  verifiedDot: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#ffffff',
    borderRadius: 8,
  },
  mutedDot: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    backgroundColor: '#64748b',
    width: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  convContent: { flex: 1 },
  convTopRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  nameBadgesRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, flex: 1 },
  convName: { fontSize: 14.5, fontWeight: '800', color: '#0f172a', flexShrink: 1, textAlign: 'right' },
  convNameUnread: { fontWeight: '900', color: '#059669' },
  blockedPill: { backgroundColor: '#fee2e2', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
  blockedPillText: { color: '#dc2626', fontSize: 10, fontWeight: '800' },
  convTime: { fontSize: 11, color: '#94a3b8', fontWeight: '600', marginRight: 6 },
  convTimeUnread: { color: '#059669', fontWeight: '800' },
  convBottomRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMsgRow: { flexDirection: 'row-reverse', alignItems: 'center', flex: 1 },
  lastMsg: { fontSize: 12.5, color: '#64748b', flex: 1, textAlign: 'right' },
  lastMsgUnread: { color: '#0f172a', fontWeight: '700' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#059669', marginRight: 6 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60, paddingHorizontal: 20 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 16, fontWeight: '900', color: '#0f172a', marginBottom: 6 },
  emptySub: { fontSize: 12.5, color: '#64748b', textAlign: 'center', lineHeight: 18, marginBottom: 18, maxWidth: 360 },
  startChatBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 14,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  startChatBtnText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  sheet: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 8,
  },
  sheetHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
    paddingBottom: 10,
  },
  sheetTitle: { fontSize: 15.5, fontWeight: '900', color: '#0f172a', textAlign: 'right' },
  sheetSub: { fontSize: 11.5, color: '#64748b', fontWeight: '600', marginTop: 2, textAlign: 'right' },
  sheetClose: { padding: 4, borderRadius: 10, backgroundColor: '#f1f5f9' },
  sheetRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderColor: '#f8fafc',
  },
  sheetRowIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetRowText: { fontSize: 13.5, fontWeight: '800', color: '#334155', textAlign: 'right' },
  sheetRowSub: { fontSize: 11, color: '#94a3b8', marginTop: 1, textAlign: 'right' },
  sheetNote: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 12,
    fontWeight: '700',
  },
  optionCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    padding: 13,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#f1f5f9',
    backgroundColor: '#f8fafc',
    marginBottom: 8,
  },
  optionCardActive: { borderColor: '#059669', backgroundColor: '#ecfdf5' },
  optionCardTitle: { fontSize: 13.5, fontWeight: '800', color: '#0f172a', textAlign: 'right' },
  optionCardSub: { fontSize: 11, color: '#64748b', marginTop: 2, textAlign: 'right' },
  fieldLabel: { fontSize: 12, fontWeight: '800', color: '#475569', marginBottom: 6, textAlign: 'right' },
  timeInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    height: 44,
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 12,
  },
  saveTimeBtn: {
    backgroundColor: '#059669',
    borderRadius: 14,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  saveTimeBtnText: { color: '#fff', fontSize: 14, fontWeight: '900' },
});
