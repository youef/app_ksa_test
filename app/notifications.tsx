import { useEffect, useState, useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  Switch,
  Platform,
} from 'react-native';
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
} from 'lucide-react-native';

type NotificationCategory = 'all' | 'emergency' | 'answers' | 'community' | 'stories';

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
}

export default function Notifications() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<NotificationCategory>('all');
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Settings Modal State
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notifPrefEmergency, setNotifPrefEmergency] = useState(true);
  const [notifPrefAnswers, setNotifPrefAnswers] = useState(true);
  const [notifPrefCommunity, setNotifPrefCommunity] = useState(true);
  const [notifPrefStories, setNotifPrefStories] = useState(true);

  async function load() {
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) {
        setLoading(false);
        return;
      }
      setCurrentUserId(u.user.id);

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', u.user.id)
        .order('created_at', { ascending: false })
        .limit(60);

      if (!error && data) {
        setItems(data);
      }
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
      .channel('notifications-live')
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

  // Clear all notifications
  function confirmClearAll() {
    if (items.length === 0) return;
    Alert.alert('مسح جميع الإشعارات', 'هل أنت متأكد من مسح جميع الإشعارات من قائمتك؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'مسح الكل',
        style: 'destructive',
        onPress: async () => {
          setItems([]);
          if (currentUserId) {
            await supabase.from('notifications').delete().eq('user_id', currentUserId);
          }
        },
      },
    ]);
  }

  // Interactive Click on Notification -> Navigate to Target
  function handleNotificationPress(n: NotificationItem) {
    if (!n.read_at) {
      markAsRead(n.id);
    }

    if (n.target_type === 'question' && n.target_id) {
      router.push(`/question/${n.target_id}` as any);
    } else if (n.target_type === 'request' && n.target_id) {
      router.push(`/request/${n.target_id}` as any);
    } else if (n.target_type === 'conversation' && n.target_id) {
      router.push(`/messages/${n.target_id}` as any);
    } else if (n.target_type === 'story' && n.target_id) {
      router.push({ pathname: '/story', params: { id: n.target_id } });
    } else if (n.type === 'emergency') {
      router.push('/home');
    }
  }


  // Filtering Logic
  const filteredItems = useMemo(() => {
    return items.filter(n => {
      // 1. Unread Filter
      if (onlyUnread && !!n.read_at) return false;

      // 2. Tab Filter
      if (activeTab === 'all') return true;
      if (activeTab === 'emergency') {
        return (
          n.type === 'emergency' ||
          (n.title && n.title.includes('تنبيه')) ||
          (n.title && n.title.includes('طوارئ'))
        );
      }
      if (activeTab === 'answers') {
        return n.type === 'answer' || n.target_type === 'question' || n.type === 'message';
      }
      if (activeTab === 'community') {
        return n.type === 'request' || n.target_type === 'request' || (n.title && n.title.includes('إعارة'));
      }
      if (activeTab === 'stories') {
        return n.type === 'story' || n.target_type === 'story' || (n.title && n.title.includes('يوميات'));
      }
      return true;
    });
  }, [items, activeTab, onlyUnread]);

  const unreadCount = items.filter(i => !i.read_at).length;

  return (
    <View style={styles.container}>
      {/* ======================================================== */}
      {/* 1. TOP CURVED GRADIENT HEADER                            */}
      {/* ======================================================== */}
      <LinearGradient colors={['#065f46', '#059669', '#10b981']} style={styles.headerHero}>
        <View style={styles.headerTopRow}>
          <Pressable onPress={() => router.replace('/home')} style={styles.headerBtn}>
            <ChevronRight size={26} color="#fff" />
          </Pressable>

          <View style={styles.headerTitleContainer}>
            <View style={styles.titleBadgeRow}>
              <Text style={styles.headerTitle}>مركز الإشعارات</Text>
              {unreadCount > 0 && (
                <View style={styles.unreadCounterBadge}>
                  <Text style={styles.unreadCounterText}>{unreadCount} جديدة</Text>
                </View>
              )}
            </View>
            <Text style={styles.headerSubtitle}>تنبيهات وتفاعلات أهالي حيك والخدمات</Text>
          </View>

          <View style={styles.headerActions}>
            <Pressable onPress={() => setSettingsOpen(true)} style={styles.headerBtn}>
              <SlidersHorizontal size={20} color="#fff" />
            </Pressable>
          </View>
        </View>

        {/* Action bar inside header */}
        <View style={styles.quickBar}>
          <Pressable
            style={[styles.quickPill, onlyUnread && styles.quickPillActive]}
            onPress={() => setOnlyUnread(!onlyUnread)}
          >
            <View style={[styles.filterDot, onlyUnread && styles.filterDotActive]} />
            <Text style={[styles.quickPillText, onlyUnread && styles.quickPillTextActive]}>
              غير المقروء ({unreadCount})
            </Text>
          </Pressable>

          <View style={styles.headerRightButtons}>
            {unreadCount > 0 && (
              <Pressable style={styles.markAllBtn} onPress={markAllAsRead}>
                <CheckCheck size={16} color="#6ee7b7" />
                <Text style={styles.markAllText}>قراءة الكل</Text>
              </Pressable>
            )}

            {items.length > 0 && (
              <Pressable style={styles.clearBtn} onPress={confirmClearAll}>
                <Trash2 size={15} color="rgba(255,255,255,0.7)" />
              </Pressable>
            )}
          </View>
        </View>
      </LinearGradient>

      {/* ======================================================== */}
      {/* 2. CATEGORY TABS (SCROLLABLE PILLS)                      */}
      {/* ======================================================== */}
      <View style={styles.tabsWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
          {[
            { key: 'all', label: 'الكل', count: items.length },
            {
              key: 'emergency',
              label: '🚨 طوارئ وبلاغات',
              count: items.filter(i => i.type === 'emergency' || i.title?.includes('طوارئ') || i.title?.includes('تنبيه')).length,
            },
            {
              key: 'answers',
              label: '💬 أسئلة وردود',
              count: items.filter(i => i.type === 'answer' || i.target_type === 'question').length,
            },
            {
              key: 'community',
              label: '🤝 طلبات وإعارة',
              count: items.filter(i => i.type === 'request' || i.target_type === 'request').length,
            },
            {
              key: 'stories',
              label: '📸 يوميات الحي',
              count: items.filter(i => i.type === 'story' || i.target_type === 'story').length,
            },
          ].map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <Pressable
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
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#059669" />
          <Text style={styles.loadingText}>جاري مزامنة الإشعارات...</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.feed}
          contentContainerStyle={styles.feedContent}
          showsVerticalScrollIndicator={false}
        >
          {filteredItems.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Bell size={42} color="#94a3b8" />
              </View>
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
                <Pressable
                  key={item.id}
                  style={[
                    styles.notifCard,
                    isRead ? styles.notifCardRead : styles.notifCardUnread,
                    item.type === 'emergency' && !isRead && styles.notifCardEmergency,
                  ]}
                  onPress={() => handleNotificationPress(item)}
                >
                  {/* Left Action & Menu Buttons */}
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.actionIconGroup}>
                      <Pressable
                        style={styles.smallActionBtn}
                        onPress={e => {
                          e.stopPropagation();
                          toggleReadStatus(item);
                        }}
                        hitSlop={8}
                      >
                        <CheckCheck size={16} color={isRead ? '#94a3b8' : '#059669'} />
                      </Pressable>

                      <Pressable
                        style={styles.smallActionBtn}
                        onPress={e => {
                          e.stopPropagation();
                          deleteNotification(item.id);
                        }}
                        hitSlop={8}
                      >
                        <Trash2 size={15} color="#cbd5e1" />
                      </Pressable>
                    </View>

                    {/* Notification Category Tag & Time */}
                    <View style={styles.cardTagRow}>
                      <Text style={styles.timeText}>{formatTimeAgo(item.created_at)}</Text>
                      <View style={[styles.typeBadge, { backgroundColor: typeConfig.bgColor }]}>
                        <Text style={[styles.typeBadgeText, { color: typeConfig.textColor }]}>
                          {typeConfig.label}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Body Content */}
                  <View style={styles.cardBodyRow}>
                    <View style={styles.textContainer}>
                      <View style={styles.titleRow}>
                        {!isRead && <View style={styles.unreadPillDot} />}
                        <Text style={[styles.cardTitle, isRead && styles.cardTitleRead]}>
                          {item.title}
                        </Text>
                      </View>
                      <Text style={[styles.cardBody, isRead && styles.cardBodyRead]}>
                        {item.body}
                      </Text>
                    </View>

                    {/* Leading Contextual Icon */}
                    <LinearGradient
                      colors={typeConfig.gradColors}
                      style={styles.leadingIconBox}
                    >
                      {typeConfig.icon}
                    </LinearGradient>
                  </View>

                  {/* Target Action Link if available */}
                  {item.target_type && (
                    <View style={styles.cardFooterAction}>
                      <Text style={styles.footerActionText}>
                        {getActionText(item.target_type)}
                      </Text>
                      <ArrowLeft size={13} color="#059669" />
                    </View>
                  )}
                </Pressable>
              );
            })
          )}

          <View style={{ height: 60 }} />
        </ScrollView>
      )}

      {/* ======================================================== */}
      {/* 4. NOTIFICATION SETTINGS MODAL                           */}
      {/* ======================================================== */}
      <Modal visible={settingsOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setSettingsOpen(false)} style={styles.modalCloseBtn}>
                <X size={20} color="#64748b" />
              </Pressable>
              <Text style={styles.modalTitle}>إعدادات تنبيهات الحي</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.settingsSectionSub}>
                تحكم بنوع الإشعارات التي ترغب باستلامها فوراً على هاتفك
              </Text>

              {/* Setting 1: Emergency */}
              <View style={styles.settingRow}>
                <Switch
                  value={notifPrefEmergency}
                  onValueChange={setNotifPrefEmergency}
                  trackColor={{ false: '#e2e8f0', true: '#ef4444' }}
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
                  trackColor={{ false: '#e2e8f0', true: '#a7f3d0' }}
                  thumbColor={notifPrefAnswers ? '#059669' : '#9ca3af'}
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
                  trackColor={{ false: '#e2e8f0', true: '#a7f3d0' }}
                  thumbColor={notifPrefCommunity ? '#059669' : '#9ca3af'}
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
                  trackColor={{ false: '#e2e8f0', true: '#a7f3d0' }}
                  thumbColor={notifPrefStories ? '#059669' : '#9ca3af'}
                />
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>📸 يوميات وقصص الجيران</Text>
                  <Text style={styles.settingDesc}>قصص جديدة من الجيران الذين تتابعهم في الحي</Text>
                </View>
              </View>

              <Pressable
                style={styles.modalSaveBtn}
                onPress={() => {
                  setSettingsOpen(false);
                  Alert.alert('تم الحفظ ✅', 'تم تحديث تفضيلات التنبيهات بنجاح');
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
      textColor: '#dc2626',
      gradColors: ['#ef4444', '#b91c1c'] as [string, string],
      icon: <AlertTriangle size={20} color="#fff" />,
    };
  }

  if (item.type === 'answer' || item.target_type === 'question') {
    return {
      label: 'إجابة وتفاعل',
      bgColor: '#ecfdf5',
      textColor: '#059669',
      gradColors: ['#059669', '#065f46'] as [string, string],
      icon: <MessageCircle size={20} color="#fff" />,
    };
  }

  if (item.type === 'request' || item.target_type === 'request') {
    return {
      label: 'إعارة ومجتمع',
      bgColor: '#dcfce7',
      textColor: '#16a34a',
      gradColors: ['#10b981', '#059669'] as [string, string],
      icon: <Share2 size={20} color="#fff" />,
    };
  }

  if (item.type === 'story' || item.target_type === 'story') {
    return {
      label: 'يوميات الحي',
      bgColor: '#f3e8ff',
      textColor: '#9333ea',
      gradColors: ['#a855f7', '#7e22ce'] as [string, string],
      icon: <Sparkles size={20} color="#fff" />,
    };
  }

  return {
    label: 'تحديث حيّنا',
    bgColor: '#fef3c7',
    textColor: '#d97706',
    gradColors: ['#f59e0b', '#d97706'] as [string, string],
    icon: <ShieldCheck size={20} color="#fff" />,
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
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  headerHero: {
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    shadowColor: '#0369a1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
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
    borderRadius: 21,
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
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
  },
  unreadCounterBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  unreadCounterText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
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
    backgroundColor: '#fff',
  },
  filterDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  filterDotActive: {
    backgroundColor: '#059669',
  },
  quickPillText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 12,
    fontWeight: '700',
  },
  quickPillTextActive: {
    color: '#059669',
    fontWeight: '900',
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
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  clearBtn: {
    padding: 5,
  },

  // Tabs
  tabsWrapper: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 10,
  },
  tabsScroll: {
    paddingHorizontal: 16,
    flexDirection: 'row-reverse',
    gap: 8,
  },
  tabItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tabItemActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  tabLabel: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '800',
  },
  tabLabelActive: {
    color: '#fff',
  },
  tabCountBadge: {
    backgroundColor: '#e2e8f0',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
  },
  tabCountBadgeActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  tabCountText: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '800',
  },
  tabCountTextActive: {
    color: '#fff',
  },

  // Feed
  feed: {
    flex: 1,
  },
  feedContent: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '700',
  },

  // Cards
  notifCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  notifCardUnread: {
    borderColor: '#059669',
    backgroundColor: '#ffffff',
    shadowColor: '#059669',
    shadowOpacity: 0.08,
  },
  notifCardRead: {
    borderColor: '#e2e8f0',
    backgroundColor: 'rgba(255,255,255,0.7)',
    opacity: 0.85,
  },
  notifCardEmergency: {
    borderColor: '#ef4444',
    backgroundColor: '#fff5f5',
  },
  cardHeaderRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTagRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  timeText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
  },
  actionIconGroup: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  smallActionBtn: {
    padding: 4,
  },
  cardBodyRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 12,
  },
  leadingIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  textContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  titleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  unreadPillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#059669',
  },
  cardTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'right',
  },
  cardTitleRead: {
    color: '#475569',
    fontWeight: '700',
  },
  cardBody: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 20,
    textAlign: 'right',
  },
  cardBodyRead: {
    color: '#64748b',
  },
  cardFooterAction: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: '#f1f5f9',
    alignSelf: 'flex-start',
  },
  footerActionText: {
    color: '#059669',
    fontSize: 12,
    fontWeight: '800',
  },

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
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  emptyTitle: {
    color: '#1e293b',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySub: {
    color: '#64748b',
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
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '900',
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsSectionSub: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'right',
    marginBottom: 20,
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
    color: '#0f172a',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 3,
    textAlign: 'right',
  },
  settingDesc: {
    color: '#64748b',
    fontSize: 11,
    textAlign: 'right',
    lineHeight: 16,
  },
  modalSaveBtn: {
    backgroundColor: '#059669',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 10,
  },
  modalSaveBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
});
