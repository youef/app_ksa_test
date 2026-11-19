import { OasisEmptyIllustration } from '@/components/oasis/OasisEmptyIllustration';
import { OasisPressable as Pressable } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import { HeaderAction } from '@/components/shared/AppHeader';
import { useEffect, useState, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScrollView, Text, View, StyleSheet, ActivityIndicator, Alert, Modal, Switch, Platform, Image } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Bell,
  ChevronRight,
  CheckCheck,
  Trash2,
  AlertTriangle,
  MessageCircle,
  Share2,
  Sparkles,
  ShieldCheck,
  Settings,
  Filter,
  ArrowLeft,
  X,
  RefreshCw,
  SlidersHorizontal,
  Coffee,
} from 'lucide-react-native';
import { useBottomNavInset } from '@/lib/bottomNav';
import AppHeader from '@/components/shared/AppHeader';

type NotificationCategory = 'all' | 'emergency' | 'answers' | 'community' | 'stories';

interface NotificationActor { id: string; username?: string | null; display_name?: string | null; avatar_url?: string | null; is_verified?: boolean | null; }

interface NotificationItem {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type?: string; // info | emergency | answer | request | message | story | system
  target_type?: string; // question | request | conversation | story
  target_id?: string;
  read_at?: string | null;
  created_at: string;
  data?: Record<string, any> | null;
  actor?: NotificationActor | null;
}
 
function notificationMatchesCategory(n: NotificationItem, category: NotificationCategory): boolean {
  if (category === 'all') return true;
  if (category === 'emergency') return n.type === 'emergency' || n.title?.includes('تنبيه') || n.title?.includes('طوارئ') || false;
  if (category === 'answers') return n.type === 'answer' || n.target_type === 'question' || n.type === 'message';
  if (category === 'community') return n.type === 'request' || n.target_type === 'request' || n.type === 'service' || n.target_type === 'service' || n.target_type === 'order' || !!n.title?.includes('إعارة');
  return n.type === 'story' || n.target_type === 'story' || !!n.title?.includes('يوميات');
}

export default function Notifications() {
  const bottomNavInset = useBottomNavInset();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<NotificationCategory>('all');
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [clearingAll, setClearingAll] = useState(false);
  const [clearError, setClearError] = useState('');
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Settings Modal State
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notifPrefEmergency, setNotifPrefEmergency] = useState(true);
  const [notifPrefAnswers, setNotifPrefAnswers] = useState(true);
  const [notifPrefCommunity, setNotifPrefCommunity] = useState(true);
  const [notifPrefStories, setNotifPrefStories] = useState(true);
  const [notifPrefFollows, setNotifPrefFollows] = useState(true);
  const [notifPrefReviews, setNotifPrefReviews] = useState(true);

  async function load() {
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        setLoading(false);
        return;
      }
      setCurrentUserId(u.user.id);

      const [notificationResult, savedPrefs] = await Promise.all([
        supabase.from('notifications').select('*').eq('user_id', u.user.id)
          .order('created_at', { ascending: false }).limit(100),
        AsyncStorage.getItem(`notification-preferences:${u.user.id}`),
      ]);
      if (savedPrefs) {
        try {
          const prefs = JSON.parse(savedPrefs);
          setNotifPrefEmergency(prefs.emergency !== false);
          setNotifPrefAnswers(prefs.answers !== false);
          setNotifPrefCommunity(prefs.community !== false);
          setNotifPrefStories(prefs.stories !== false);
          setNotifPrefFollows(prefs.follows !== false);
          setNotifPrefReviews(prefs.reviews !== false);
        } catch {}
      }
      if (notificationResult.error) throw notificationResult.error;
      const raw = (notificationResult.data || []) as NotificationItem[];
      // Direct messages already have a dedicated inbox entry; do not duplicate them here.
      const visible = raw.filter(item => item.type !== 'message' && item.target_type !== 'conversation' && item.data?.in_app_allowed !== false);
      const actorIds = [...new Set(visible.map(item => {
        const data = item.data || {};
        return data.actor_id || data.author_id || data.follower_id || data.reviewer_id || data.sender_id || null;
      }).filter((id): id is string => typeof id === 'string'))];
      let actors: NotificationActor[] = [];
      if (actorIds.length) {
        const { data: profiles } = await supabase.from('profiles')
          .select('id,username,display_name,avatar_url,is_verified')
          .in('id', actorIds);
        actors = (profiles || []) as NotificationActor[];
      }
      const actorMap = new Map(actors.map(actor => [actor.id, actor]));
      setItems(visible.map(item => {
        const data = item.data || {};
        const actorId = data.actor_id || data.author_id || data.follower_id || data.reviewer_id || data.sender_id;
        return { ...item, actor: actorId ? actorMap.get(actorId) || null : null };
      }));
    } catch (e) {
      console.error('Error loading notifications:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();

    const ch = supabase
      .channel(`notifications-live-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        () => load()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  async function savePreferences(next?: Partial<{ emergency: boolean; answers: boolean; community: boolean; stories: boolean; follows: boolean; reviews: boolean }>) {
    if (!currentUserId) return;
    const prefs = { emergency: notifPrefEmergency, answers: notifPrefAnswers, community: notifPrefCommunity, stories: notifPrefStories, follows: notifPrefFollows, reviews: notifPrefReviews, ...next };
    try { await AsyncStorage.setItem(`notification-preferences:${currentUserId}`, JSON.stringify(prefs)); }
    catch { Alert.alert('تعذّر الحفظ', 'لم نتمكن من حفظ تفضيلات التنبيهات على هذا الجهاز.'); }
  }

  // Mark single notification as read
  async function markAsRead(id: string) {
    setItems(prev =>
      prev.map(it => (it.id === id ? { ...it, read_at: new Date().toISOString() } : it))
    );
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
  }

  // Toggle Read / Unread
  async function toggleReadStatus(n: NotificationItem) {
    const newRead = n.read_at ? null : new Date().toISOString();
    setItems(prev =>
      prev.map(it => (it.id === n.id ? { ...it, read_at: newRead } : it))
    );
    await supabase.from('notifications').update({ read_at: newRead }).eq('id', n.id);
  }

  // Mark all as read
  async function markAllAsRead() {
    if (!currentUserId) return;
    const now = new Date().toISOString();
    setItems(prev => prev.map(it => ({ ...it, read_at: now })));
    await supabase
      .from('notifications')
      .update({ read_at: now })
      .eq('user_id', currentUserId)
      .is('read_at', null);
  }

  // Delete notification
  async function deleteNotification(id: string) {
    setItems(prev => prev.filter(it => it.id !== id));
    await supabase.from('notifications').delete().eq('id', id);
  }

  // Keep the destructive confirmation usable in Expo web and on native devices.
  function confirmClearAll() {
    if (!items.length) return;
    setClearError('');
    setClearConfirmOpen(true);
  }

  async function clearAllNotifications() {
    if (!currentUserId || clearingAll) return;
    setClearingAll(true);
    setClearError('');
    try {
      const { error } = await supabase.from('notifications').delete().eq('user_id', currentUserId);
      if (error) throw error;
      setItems([]);
      setClearConfirmOpen(false);
    } catch {
      setClearError('تعذّر حذف الإشعارات. تأكد من الاتصال وحاول مجددًا.');
    } finally {
      setClearingAll(false);
    }
  }

  // Interactive Click on Notification -> Navigate to Target
  async function handleNotificationPress(n: NotificationItem) {
    if (!n.read_at) {
      markAsRead(n.id);
    }

    if(n.target_type==='order'&&n.target_id){
      const key=String(n.data?.event_key||'');
      if(n.type==='dispute_reply'||n.type==='dispute_status'){
        const d=await supabase.from('order_disputes').select('service_order_id,product_request_id').eq('id',n.target_id).maybeSingle();
        const id=d.data?.service_order_id||d.data?.product_request_id;
        if(id){router.push({pathname:'/order-details',params:{id,kind:d.data?.product_request_id?'product':'service'}});return;}
      }else if(n.type==='review_reply'){
        const d=await supabase.from('order_reviews').select('service_order_id,product_request_id').eq('id',n.target_id).maybeSingle();
        const id=d.data?.service_order_id||d.data?.product_request_id;
        if(id){router.push({pathname:'/order-details',params:{id,kind:d.data?.product_request_id?'product':'service'}});return;}
      }else{
        const isProduct=key.startsWith('order:product:')||key.startsWith('product_rev:');
        router.push({pathname:'/order-details',params:{id:n.target_id,kind:isProduct?'product':'service'}});return;
      }
      router.push('/product-orders');return;
    }
    if (n.target_type === 'question' && n.target_id) {
      router.push({ pathname: '/question', params: { id: n.target_id } });
    } else if (n.target_type === 'request' && n.target_id) {
      router.push({ pathname: '/request', params: { id: n.target_id } });
    } else if (n.target_type === 'service' && n.target_id) {
      router.push({ pathname: '/service', params: { id: n.target_id } });
    } else if ((n.target_type === 'conversation' || n.target_type === 'message') && n.target_id) {
      router.push({ pathname: '/conversation', params: { id: n.target_id } });
    } else if (n.target_type === 'story' && n.target_id) {
      router.push({ pathname: '/story', params: { id: n.target_id } });
    } else if (n.type === 'emergency') {
      router.push('/home');
    } else {
      router.push('/home');
    }
  }


  // Use one category matcher for both displayed notifications and tab totals.
  const filteredItems = useMemo(() => items.filter(n => (!onlyUnread || !n.read_at) && notificationMatchesCategory(n, activeTab)),
    [items, activeTab, onlyUnread]);
  const countForCategory = (category: NotificationCategory) => items.filter(n => (!onlyUnread || !n.read_at) && notificationMatchesCategory(n, category)).length;

  const unreadCount = items.filter(i => !i.read_at && i.type !== 'message' && i.target_type !== 'conversation').length;

  return (
    <View style={styles.container}>
      <AppHeader
        variant="sub"
        title="مركز الإشعارات"
        fallbackRoute="/home"
        subtitle={unreadCount > 0 ? `${unreadCount} إشعار جديد` : 'تنبيهات وتفاعلات أهالي حيك'}
        rightAction={
          <HeaderAction
            accessibilityLabel="إعدادات الإشعارات" onPress={() => setSettingsOpen(true)}

          >
            <SlidersHorizontal size={20} color={OASIS.colors.primary} />
          </HeaderAction>
        }
      />

      {/* Compact inbox actions: readability and destructive actions stay separate. */}
      <View style={styles.inboxActionBar}>
        <Pressable oasisKind="plain" accessibilityRole="button"
          accessibilityLabel={onlyUnread ? 'عرض جميع الإشعارات' : 'عرض الإشعارات غير المقروءة'}
          accessibilityState={{ selected: onlyUnread }} style={[styles.unreadToggle, onlyUnread && styles.unreadToggleActive]}
          onPress={() => setOnlyUnread(value => !value)}>
          <View style={[styles.filterDot, onlyUnread && styles.filterDotActive]} />
          <Text style={[styles.unreadToggleText, onlyUnread && styles.unreadToggleTextActive]}>غير المقروء ({unreadCount})</Text>
        </Pressable>
        <View style={styles.headerTools}>
          {unreadCount > 0 && (
            <Pressable oasisKind="plain" accessibilityRole="button" accessibilityLabel="تحديد جميع الإشعارات كمقروءة"
              onPress={() => void markAllAsRead()} style={styles.markAllAction}>
              <CheckCheck size={17} color={OASIS.colors.primary} />
              <Text style={styles.markAllActionText}>قراءة الكل</Text>
            </Pressable>
          )}
          {items.length > 0 && (
            <Pressable oasisKind="plain" accessibilityRole="button" accessibilityLabel="مسح جميع الإشعارات"
              onPress={confirmClearAll} style={styles.clearAllAction}>
              <Trash2 size={17} color={OASIS.colors.muted} />
            </Pressable>
          )}
        </View>
      </View>

      {/* ======================================================== */}
      {/* 2. CATEGORY TABS (SCROLLABLE PILLS)                      */}
      {/* ======================================================== */}
      <View style={styles.tabsWrapper}>
        <ScrollView style={{ direction: 'rtl' }} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.tabsScroll, { direction: 'ltr' }]}>
          {[
            { key: 'all', label: 'الكل', count: countForCategory('all') },
            { key: 'emergency', label: 'طوارئ وبلاغات', count: countForCategory('emergency') },
            { key: 'answers', label: 'أسئلة وردود', count: countForCategory('answers') },
            { key: 'community', label: 'طلبات ومجتمع', count: countForCategory('community') },
            { key: 'stories', label: 'اليوميات', count: countForCategory('stories') },
          ].map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <Pressable oasisKind="plain" accessibilityRole="tab" accessibilityState={{ selected: isActive }}
                key={tab.key}
                style={[styles.tabItem, isActive && styles.tabItemActive]}
                onPress={() => setActiveTab(tab.key as NotificationCategory)}
              >
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
                {tab.count > 0 && (
                  <View style={[styles.tabCountBadge, isActive && styles.tabCountBadgeActive]}>
                    <Text style={[styles.tabCountText, isActive && styles.tabCountTextActive]}>
                      {tab.count}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ======================================================== */}
      {/* 3. NOTIFICATIONS FEED                                    */}
      {/* ======================================================== */}
      {loading ? (
        <ScrollView
          style={styles.feed}
          contentContainerStyle={[styles.feedContent, { paddingBottom: bottomNavInset + 16 }]}
          accessibilityLabel="جاري تحميل الإشعارات"
          accessibilityState={{ busy: true }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.loadingText}>جاري مزامنة الإشعارات...</Text>
          {[0, 1, 2, 3].map(index => (
            <View
              key={index}
              accessible={false}
              importantForAccessibility="no-hide-descendants"
              style={[styles.notifCard, { backgroundColor: OASIS.colors.surface, opacity: 1 - index * 0.12 }]}
            >
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }}>
                <View style={{ width: 44, height: 44, borderRadius: 16, backgroundColor: OASIS.colors.soft }} />
                <View style={{ flex: 1, gap: 9 }}>
                  <View style={{ height: 13, width: '64%', borderRadius: 7, backgroundColor: OASIS.colors.line }} />
                  <View style={{ height: 10, width: '90%', borderRadius: 6, backgroundColor: OASIS.colors.soft }} />
                  <View style={{ height: 10, width: '48%', borderRadius: 6, backgroundColor: OASIS.colors.soft }} />
                </View>
              </View>
              <View style={{ marginTop: 14, width: 82, height: 20, borderRadius: 10, backgroundColor: OASIS.colors.soft }} />
            </View>
          ))}
        </ScrollView>
      ) : (
        <ScrollView
          style={styles.feed}
          contentContainerStyle={[styles.feedContent, { paddingBottom: bottomNavInset + 16 }]}
          showsVerticalScrollIndicator={false}
        >
          {filteredItems.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={{ alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}><OasisEmptyIllustration kind="empty-notifications" /></View>
              <Text style={styles.emptyTitle}>
                {onlyUnread ? 'لا توجد إشعارات غير مقروءة' : 'لا توجد إشعارات في هذا التصنيف'}
              </Text>
              <Text style={styles.emptySub}>
                {onlyUnread
                  ? 'أنت مطلع على كل ما يهمك أولاً بأول!'
                  : 'ستظهر هنا الردود على استفساراتك، تنبيهات أهالي حيك، وإشعارات الطوارئ.'}
              </Text>
            </View>
          ) : (
            filteredItems.map(item => {
              const isRead = !!item.read_at;
              const typeConfig = getTypeVisuals(item);

              return (
                <Pressable oasisKind="card" oasisSurfaceState={isRead ? "default" : item.type === "emergency" ? "error" : "unread"}
                  key={item.id}
                  style={[
                    styles.notifCard,
                    isRead ? styles.notifCardRead : styles.notifCardUnread,
                    item.type === 'emergency' && !isRead && styles.notifCardEmergency,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.title}. ${item.body || ''}. ${isRead ? 'مقروء' : 'جديد'}`}
                  onPress={() => handleNotificationPress(item)}
                >
                  <View style={styles.cardBodyRow}>
                    <LinearGradient colors={typeConfig.gradColors} style={styles.leadingIconBox}>
                      {typeConfig.icon}
                    </LinearGradient>
                    <View style={styles.textContainer}>
                      <View style={styles.titleRow}>
                        {!isRead && <View style={styles.unreadPillDot} />}
                        <Text numberOfLines={2} style={[styles.cardTitle, isRead && styles.cardTitleRead]}>{item.title}</Text>
                      </View>
                      {!!item.body && (
                        <Text numberOfLines={3} style={[styles.cardBody, isRead && styles.cardBodyRead]}>{item.body}</Text>
                      )}
                      {item.actor && (
                        <Pressable oasisKind="plain" style={styles.actorRow} accessibilityRole="button"
                          accessibilityLabel={`عرض ملف ${item.actor.display_name || item.actor.username || 'المستخدم'}`}
                          onPress={e => {
                            e.stopPropagation();
                            if (item.actor?.id) {
                              void markAsRead(item.id);
                              router.push({ pathname: '/user', params: { id: item.actor.id } });
                            }
                          }}>
                          {item.actor.avatar_url
                            ? <Image source={{ uri: item.actor.avatar_url }} style={styles.actorAvatar} />
                            : <View style={styles.actorAvatarFallback}><Text style={styles.actorAvatarInitial}>{(item.actor.display_name || item.actor.username || 'م')[0]}</Text></View>}
                          <Text numberOfLines={1} style={styles.actorName}>{item.actor.display_name || item.actor.username || 'مستخدم'} {item.actor.is_verified ? '✓' : ''}</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                  <View style={styles.cardFooterRow}>
                    <View style={styles.cardTagRow}>
                      <Text style={styles.timeText}>{formatTimeAgo(item.created_at)}</Text>
                      <View style={[styles.typeBadge, { backgroundColor: typeConfig.bgColor }]}>
                        <Text style={[styles.typeBadgeText, { color: typeConfig.textColor }]}>{typeConfig.label}</Text>
                      </View>
                    </View>
                    <View style={styles.actionIconGroup}>
                      <Pressable oasisKind="plain" accessibilityRole="button"
                        accessibilityLabel={isRead ? 'تحديد الإشعار كغير مقروء' : 'تحديد الإشعار كمقروء'}
                        style={styles.smallActionBtn}
                        onPress={e => { e.stopPropagation(); void toggleReadStatus(item); }} hitSlop={8}>
                        <CheckCheck size={17} color={isRead ? OASIS.colors.muted : OASIS.colors.primary} />
                      </Pressable>
                      <Pressable oasisKind="plain" accessibilityRole="button" accessibilityLabel="حذف الإشعار"
                        style={[styles.smallActionBtn, styles.deleteActionBtn]}
                        onPress={e => { e.stopPropagation(); void deleteNotification(item.id); }} hitSlop={8}>
                        <Trash2 size={16} color={OASIS.colors.danger} />
                      </Pressable>
                    </View>
                  </View>

                </Pressable>
              );
            })
          )}


        </ScrollView>
      )}

      <Modal visible={clearConfirmOpen} transparent animationType="fade" onRequestClose={() => { if (!clearingAll) setClearConfirmOpen(false); }}>
        <View style={styles.clearOverlay}>
          <View style={styles.clearConfirmCard}>
            <View style={styles.clearConfirmIcon}><Trash2 size={22} color={OASIS.colors.danger}/></View>
            <Text style={styles.clearConfirmTitle}>مسح جميع الإشعارات؟</Text>
            <Text style={styles.clearConfirmDesc}>سيتم حذف {items.length} إشعار من مركز الإشعارات، ولا يمكن التراجع عن الحذف.</Text>
            {!!clearError && <Text accessibilityRole="alert" style={styles.clearConfirmError}>{clearError}</Text>}
            <View style={styles.clearConfirmActions}>
              <Pressable oasisKind="plain" accessibilityRole="button" accessibilityLabel="إلغاء مسح الإشعارات"
                disabled={clearingAll} onPress={() => setClearConfirmOpen(false)} style={styles.clearCancelButton}>
                <Text style={styles.clearCancelText}>إلغاء</Text>
              </Pressable>
              <Pressable oasisKind="plain" accessibilityRole="button" accessibilityLabel="تأكيد مسح جميع الإشعارات"
                disabled={clearingAll} onPress={() => void clearAllNotifications()} style={[styles.clearDestructiveButton, clearingAll && { opacity: 0.6 }]}>
                {clearingAll ? <ActivityIndicator size="small" color="#FFFFFF"/> : <Trash2 size={16} color="#FFFFFF"/>}
                <Text style={styles.clearDestructiveText}>مسح الكل</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ======================================================== */}
      {/* 4. NOTIFICATION SETTINGS MODAL                           */}
      {/* ======================================================== */}
      <Modal visible={settingsOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Pressable oasisKind="icon" onPress={() => setSettingsOpen(false)} style={styles.modalCloseBtn}>
                <X size={20} color={OASIS.colors.muted} />
              </Pressable>
              <Text style={styles.modalTitle}>إعدادات التنبيهات</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.settingsSectionSub}>
                فعّل فقط التنبيهات التي تهمك. إشعارات الرسائل تبقى في قسم الدردشة لتجنب التكرار.
              </Text>

              {/* Setting 1: Emergency */}
              <View style={styles.settingRow}>
                <Switch
                  value={notifPrefEmergency}
                  onValueChange={setNotifPrefEmergency}
                  trackColor={{ false: OASIS.colors.line, true: OASIS.colors.danger }}
                />
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>🚨 طوارئ وبلاغات الحي العاجلة (SOS)</Text>
                  <Text style={styles.settingDesc}>حرائق، تحويلات مرورية خطرة، أو انقطاعات مياه فورية</Text>
                </View>
              </View>

              {/* Setting 2: Answers */}
              <View style={styles.settingRow}>
                <Switch
                  value={notifPrefAnswers}
                  onValueChange={setNotifPrefAnswers}
                  trackColor={{ false: OASIS.colors.line, true: '#a7f3d0' }}
                  thumbColor={notifPrefAnswers ? OASIS.colors.primary : '#9ca3af'}
                />
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>💬 إجابات وردود أهل الحي</Text>
                  <Text style={styles.settingDesc}>عندما يجيب أحد الجيران أو الخبراء على أسئلتك</Text>
                </View>
              </View>

              {/* Setting 3: Community Tools */}
              <View style={styles.settingRow}>
                <Switch
                  value={notifPrefCommunity}
                  onValueChange={setNotifPrefCommunity}
                  trackColor={{ false: OASIS.colors.line, true: '#a7f3d0' }}
                  thumbColor={notifPrefCommunity ? OASIS.colors.primary : '#9ca3af'}
                />
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>🤝 إعارة الأدوات ومساعدة الجيران</Text>
                  <Text style={styles.settingDesc}>طلبات إعارة المعدات أو المبادرات التطوعية بالحي</Text>
                </View>
              </View>

              {/* Setting 4: Stories */}
              <View style={styles.settingRow}>
                <Switch
                  value={notifPrefStories}
                  onValueChange={setNotifPrefStories}
                  trackColor={{ false: OASIS.colors.line, true: '#a7f3d0' }}
                  thumbColor={notifPrefStories ? OASIS.colors.primary : '#9ca3af'}
                />
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>📸 يوميات وقصص الجيران</Text>
                  <Text style={styles.settingDesc}>قصص جديدة من الجيران الذين تتابعهم في الحي</Text>
                </View>
              </View>

              <View style={styles.settingRow}>
                <Switch value={notifPrefFollows} onValueChange={v => { setNotifPrefFollows(v); void savePreferences({ follows: v }); }} trackColor={{ false: OASIS.colors.line, true: '#a7f3d0' }} thumbColor={notifPrefFollows ? OASIS.colors.primary : '#9ca3af'} />
                <View style={styles.settingInfo}><Text style={styles.settingLabel}>👤 متابع جديد</Text><Text style={styles.settingDesc}>عندما يبدأ شخص بمتابعتك</Text></View>
              </View>
              <View style={styles.settingRow}>
                <Switch value={notifPrefReviews} onValueChange={v => { setNotifPrefReviews(v); void savePreferences({ reviews: v }); }} trackColor={{ false: OASIS.colors.line, true: '#a7f3d0' }} thumbColor={notifPrefReviews ? OASIS.colors.primary : '#9ca3af'} />
                <View style={styles.settingInfo}><Text style={styles.settingLabel}>⭐ التقييمات والشكر</Text><Text style={styles.settingDesc}>تقييم جديد أو تقدير لمساهماتك</Text></View>
              </View>
              <View style={styles.settingRow}>
                <View style={styles.settingInfo}><Text style={styles.settingLabel}>💬 رسائل الدردشة</Text><Text style={styles.settingDesc}>لا تظهر هنا؛ راجع قسم الدردشة لتفادي تكرار التنبيه.</Text></View>
                <Switch value={false} disabled trackColor={{ false: OASIS.colors.line, true: '#a7f3d0' }} />
              </View>

              <Pressable oasisKind="action"
                style={styles.modalSaveBtn}
                onPress={async () => {
                  await savePreferences();
                  setSettingsOpen(false);
                  Alert.alert('تم الحفظ', 'تم حفظ تفضيلات التنبيهات على هذا الجهاز.');
                }}
              >
                <Text style={styles.modalSaveBtnText}>حفظ الإعدادات</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Helpers for contextual styling
function getTypeVisuals(item: NotificationItem) {
  if (
    item.type === 'emergency' ||
    item.title?.includes('طوارئ') ||
    item.title?.includes('تنبيه عاجل')
  ) {
    return {
      label: 'بلاغ طارئ',
      bgColor: '#fee2e2',
      textColor: OASIS.colors.danger,
      gradColors: [OASIS.colors.danger, OASIS.colors.danger] as [string, string],
      icon: <AlertTriangle size={20} color={OASIS.colors.surface} />,
    };
  }

  if (
    item.type === 'appreciation' ||
    item.title?.includes('قهوة') ||
    item.title?.includes('شكر')
  ) {
    return {
      label: 'شكر وقهوة ☕',
      bgColor: '#fef3c7',
      textColor: '#92400e',
      gradColors: ['#d97706', '#92400e'] as [string, string],
      icon: <Coffee size={20} color={OASIS.colors.surface} />,
    };
  }

  if (item.type === 'answer' || item.target_type === 'question') {
    return {
      label: 'إجابة وتفاعل',
      bgColor: OASIS.colors.soft,
      textColor: OASIS.colors.primary,
      gradColors: [OASIS.colors.primary, OASIS.colors.deep] as [string, string],
      icon: <MessageCircle size={20} color={OASIS.colors.surface} />,
    };
  }

  if (item.type === 'request' || item.target_type === 'request') {
    return {
      label: 'إعارة ومجتمع',
      bgColor: '#dcfce7',
      textColor: OASIS.colors.primary,
      gradColors: [OASIS.colors.primary, OASIS.colors.primary] as [string, string],
      icon: <Share2 size={20} color={OASIS.colors.surface} />,
    };
  }

  if (item.type === 'story' || item.target_type === 'story') {
    return {
      label: 'يوميات الحي',
      bgColor: '#f3e8ff',
      textColor: '#9333ea',
      gradColors: ['#a855f7', '#7e22ce'] as [string, string],
      icon: <Sparkles size={20} color={OASIS.colors.surface} />,
    };
  }

  return {
    label: 'تحديث حيّنا',
    bgColor: '#fef3c7',
    textColor: '#d97706',
    gradColors: [OASIS.colors.warning, '#d97706'] as [string, string],
    icon: <ShieldCheck size={20} color={OASIS.colors.surface} />,
  };
}

function getActionText(targetType: string) {
  switch (targetType) {
    case 'question':
      return 'عرض الاستفسار والردود';
    case 'request':
      return 'عرض تفاصيل الطلب والأدوات';
    case 'conversation':
      return 'فتح المحادثة الفورية';
    case 'story':
      return 'مشاهدة قصة الجار';
    case 'order':
      return 'عرض حالة الطلب والتقييم والبلاغات';
    default:
      return 'عرض التفاصيل';
  }
}

function formatTimeAgo(dateStr: string) {
  try {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return 'الآن';
    if (diff < 3600) return `منذ ${Math.floor(diff / 60)} دقيقة`;
    if (diff < 86400) return `منذ ${Math.floor(diff / 3600)} ساعة`;
    if (diff < 172800) return 'أمس';
    return new Date(dateStr).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

const styles = StyleSheet.create({
  clearOverlay: { flex: 1, backgroundColor: 'rgba(0,13,10,0.58)', justifyContent: 'center', paddingHorizontal: 22 },
  clearConfirmCard: { backgroundColor: OASIS.colors.surface, borderRadius: 20, padding: 20, alignItems: 'center', gap: 11, borderWidth: 1, borderColor: OASIS.colors.line },
  clearConfirmIcon: { width: 48, height: 48, borderRadius: 15, backgroundColor: OASIS.colors.dangerSoft, alignItems: 'center', justifyContent: 'center' },
  clearConfirmTitle: { color: OASIS.colors.ink, fontSize: 17, fontWeight: '800', textAlign: 'center' },
  clearConfirmDesc: { color: OASIS.colors.muted, fontSize: 12.5, lineHeight: 20, textAlign: 'center' },
  clearConfirmError: { color: OASIS.colors.danger, fontSize: 11.5, textAlign: 'center' },
  clearConfirmActions: { width: '100%', flexDirection: 'row-reverse', gap: 10, marginTop: 7 },
  clearCancelButton: { flex: 1, minHeight: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: OASIS.colors.background, borderRadius: 12, borderWidth: 1, borderColor: OASIS.colors.line },
  clearCancelText: { color: OASIS.colors.ink, fontSize: 13, fontWeight: '700' },
  clearDestructiveButton: { flex: 1, minHeight: 44, flexDirection: 'row-reverse', justifyContent: 'center', alignItems: 'center', gap: 7, borderRadius: 12, backgroundColor: OASIS.colors.danger },
  clearDestructiveText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  inboxActionBar: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: OASIS.colors.surface, borderBottomWidth: 1, borderBottomColor: OASIS.colors.line },
  unreadToggle: { minHeight: 37, flexDirection: 'row-reverse', alignItems: 'center', gap: 7, borderRadius: 12, paddingHorizontal: 10, backgroundColor: OASIS.colors.background, borderWidth: 1, borderColor: OASIS.colors.line },
  unreadToggleActive: { backgroundColor: OASIS.colors.soft, borderColor: '#91D9B9' },
  unreadToggleText: { fontSize: 11.5, fontWeight: '700', color: OASIS.colors.muted },
  unreadToggleTextActive: { color: OASIS.colors.primary },
  headerTools: { flexDirection: 'row-reverse', alignItems: 'center', gap: 7 },
  markAllAction: { minHeight: 37, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 11, paddingHorizontal: 11, backgroundColor: OASIS.colors.soft },
  markAllActionText: { fontSize: 11.5, fontWeight: '700', color: OASIS.colors.primary },
  clearAllAction: { width: 37, height: 37, justifyContent: 'center', alignItems: 'center', borderRadius: 11, backgroundColor: OASIS.colors.background, borderWidth: 1, borderColor: OASIS.colors.line },
  cardFooterRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: OASIS.colors.line },
  deleteActionBtn: { backgroundColor: '#FFF3F1' },

  container: {
    flex: 1,
    backgroundColor: OASIS.colors.background,
  },
  headerHero: {
    paddingTop: Platform.OS === 'ios' ? 52 : 40,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    shadowColor: '#0369a1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0,
    shadowRadius: 16,
    elevation: 8,
  },
  headerTopRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    alignItems: 'center',
    flex: 1,
  },
  titleBadgeRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: OASIS.colors.surface,
    fontSize: 20,
    fontWeight: '700',
  },
  unreadCounterBadge: {
    backgroundColor: OASIS.colors.danger,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  unreadCounterText: {
    color: OASIS.colors.surface,
    fontSize: 11,
    fontWeight: '600',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  quickBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  quickPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  quickPillActive: {
    backgroundColor: OASIS.colors.surface,
  },
  filterDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  filterDotActive: {
    backgroundColor: OASIS.colors.primary,
  },
  quickPillText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '700',
  },
  quickPillTextActive: {
    color: OASIS.colors.primary,
    fontWeight: '700',
  },
  headerRightButtons: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  markAllBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  markAllText: {
    color: OASIS.colors.surface,
    fontSize: 12,
    fontWeight: '600',
  },
  clearBtn: {
    padding: 5,
  },

  // Tabs
  tabsWrapper: { backgroundColor: OASIS.colors.surface, borderBottomWidth: 1, borderColor: OASIS.colors.line, paddingVertical: 8 },
  tabsScroll: { flexDirection: 'row-reverse', gap: 7, paddingHorizontal: 14, alignItems: 'center' },
  tabItem: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 36, backgroundColor: OASIS.colors.soft, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 12, borderWidth: 1, borderColor: 'transparent' },
  tabItemActive: {
    backgroundColor: OASIS.colors.primary,
    borderColor: OASIS.colors.primary,
  },
  tabLabel: { color: OASIS.colors.deep, fontSize: 11.5, fontWeight: '700' },
  tabLabelActive: {
    color: OASIS.colors.surface,
  },
  tabCountBadge: { minWidth: 22, minHeight: 21, backgroundColor: 'rgba(0,70,52,0.07)', paddingHorizontal: 6, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tabCountBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  tabCountText: {
    color: OASIS.colors.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  tabCountTextActive: {
    color: OASIS.colors.surface,
  },

  // Feed
  feed: {
    flex: 1,
  },
  feedContent: { paddingHorizontal: 12, paddingTop: 12, paddingBottom: 12 },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: OASIS.colors.muted,
    fontSize: 14,
    fontWeight: '700',
  },

  // Cards
  actorRow: { minHeight: 26, maxWidth: '100%', alignSelf: 'flex-end', flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginTop: 6, paddingHorizontal: 5, paddingVertical: 3, borderRadius: 9, backgroundColor: OASIS.colors.soft },
  actorAvatar: { width: 20, height: 20, borderRadius: 10, backgroundColor: OASIS.colors.line },
  actorAvatarFallback: { width: 20, height: 20, borderRadius: 10, backgroundColor: OASIS.colors.background, alignItems: 'center', justifyContent: 'center' },
  actorAvatarInitial: { color: OASIS.colors.primary, fontWeight: '800', fontSize: 11 },
  actorCopy: { flex: 1, minWidth: 0, alignItems: 'flex-end' },
  actorName: { color: OASIS.colors.primary, fontSize: 10.5, fontWeight: '700', textAlign: 'right', flexShrink: 1 },
  actorHandle: { color: OASIS.colors.muted, fontSize: 10, marginTop: 2, textAlign: 'right' },
  actorLink: { color: OASIS.colors.primary, fontSize: 11, fontWeight: '600' },
  notifCard: { backgroundColor: OASIS.colors.surface, borderRadius: 15, padding: 11, marginBottom: 8, borderWidth: 1, borderColor: OASIS.colors.line, shadowOpacity: 0, elevation: 0 },
  notifCardUnread: { borderColor: '#ACDDC5', backgroundColor: '#F4FBF7' },
  notifCardRead: { borderColor: OASIS.colors.line, backgroundColor: OASIS.colors.surface },
  notifCardEmergency: { borderColor: '#F3B4B4', backgroundColor: '#FFF9F8' },
  cardHeaderRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  cardTagRow: { flex: 1, minWidth: 0, flexDirection: 'row-reverse', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  typeBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 9 },
  typeBadgeText: { fontSize: 10.5, fontWeight: '700' },
  timeText: { color: OASIS.colors.muted, fontSize: 10.5, fontWeight: '600' },
  actionIconGroup: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5 },
  smallActionBtn: { width: 34, height: 34, justifyContent: 'center', alignItems: 'center', borderRadius: 10, backgroundColor: OASIS.colors.soft },
  cardBodyRow: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 10 },
  leadingIconBox: { width: 37, height: 37, borderRadius: 11, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  textContainer: { flex: 1, minWidth: 0, alignItems: 'flex-end', gap: 3 },
  titleRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, minWidth: 0 },
  unreadPillDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: OASIS.colors.primary },
  cardTitle: { flexShrink: 1, color: OASIS.colors.ink, fontSize: 13.5, lineHeight: 21, fontWeight: '800', textAlign: 'right' },
  cardTitleRead: { color: OASIS.colors.muted, fontWeight: '700' },
  cardBody: { color: OASIS.colors.ink, fontSize: 12, fontWeight: '500', lineHeight: 19, textAlign: 'right' },
  cardBodyRead: { color: OASIS.colors.muted },
  cardFooterAction: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, marginTop: 8, paddingTop: 8, alignSelf: 'flex-start' },
  footerActionText: { color: OASIS.colors.primary, fontSize: 11.5, fontWeight: '700' },

  // Empty State
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: OASIS.colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  emptyTitle: {
    color: OASIS.colors.ink,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySub: {
    color: OASIS.colors.muted,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },

  // Settings Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: OASIS.colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 16,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    color: OASIS.colors.ink,
    fontSize: 18,
    fontWeight: '700',
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsSectionSub: {
    color: OASIS.colors.muted,
    fontSize: 12,
    textAlign: 'right',
    marginBottom: 14,
  },
  settingRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
    gap: 16,
  },
  settingInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  settingLabel: {
    color: OASIS.colors.ink,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 3,
    textAlign: 'right',
  },
  settingDesc: {
    color: OASIS.colors.muted,
    fontSize: 11,
    textAlign: 'right',
    lineHeight: 16,
  },
  modalSaveBtn: {
    backgroundColor: OASIS.colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 10,
  },
  modalSaveBtnText: {
    color: OASIS.colors.surface,
    fontSize: 15,
    fontWeight: '700',
  },
});
