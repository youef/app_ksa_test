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
  Switch,
  Alert,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import {
  MessageCircle,
  Search,
  Plus,
  Check,
  CheckCheck,
  BellOff,
  Bell,
  UserX,
  Lock,
} from 'lucide-react-native';
import BottomNav from '@/components/BottomNav';

export default function Messages() {
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dndEnabled, setDndEnabled] = useState(false);
  const [mutedConvs, setMutedConvs] = useState<string[]>([]);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return router.replace('/auth');
    setCurrentUserId(u.user.id);

    // 1. Fetch user profile for DND & Muted convs
    const { data: prof } = await supabase
      .from('profiles')
      .select('dnd_enabled, muted_conversations')
      .eq('id', u.user.id)
      .maybeSingle();

    if (prof) {
      setDndEnabled(!!prof.dnd_enabled);
      setMutedConvs(prof.muted_conversations || []);
    }

    // 2. Fetch blocked user IDs
    const { data: blocks } = await supabase
      .from('blocks')
      .select('blocked_id')
      .eq('blocker_id', u.user.id);

    const blockedIds = (blocks || []).map(b => b.blocked_id);
    setBlockedUserIds(blockedIds);

    // 3. Get all my conversations
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

    // Get last message for each conversation
    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .in('conversation_id', convIds)
      .order('created_at', { ascending: false });

    // Get all members for these conversations
    const { data: allMembers } = await supabase
      .from('conversation_members')
      .select('conversation_id, user_id')
      .in('conversation_id', convIds)
      .neq('user_id', u.user.id);

    // Get other users' profiles
    const otherUserIds = [...new Set((allMembers || []).map(m => m.user_id))];
    const { data: profiles } =
      otherUserIds.length > 0
        ? await supabase.from('profiles').select('*').in('id', otherUserIds)
        : { data: [] };

    const profileMap = (profiles || []).reduce((acc: any, p: any) => ({ ...acc, [p.id]: p }), {});

    const convMap: Record<string, any> = {};
    (messages || []).forEach(msg => {
      if (!convMap[msg.conversation_id]) {
        convMap[msg.conversation_id] = msg;
      }
    });

    const convList = convIds
      .map(convId => {
        const otherMember = (allMembers || []).find(m => m.conversation_id === convId);
        const otherProfile = otherMember ? profileMap[otherMember.user_id] : null;
        const lastMsg = convMap[convId];
        const isUnread =
          lastMsg && lastMsg.sender_id !== u.user.id && !(lastMsg.read_by || []).includes(u.user.id);
        const isBlocked = otherMember ? blockedIds.includes(otherMember.user_id) : false;
        const isMuted = (prof?.muted_conversations || []).includes(convId);

        return {
          id: convId,
          other: otherProfile,
          lastMessage: lastMsg,
          isUnread,
          isBlocked,
          isMuted,
          otherUserId: otherMember?.user_id,
        };
      })
      .filter(c => c.other);

    convList.sort((a, b) => {
      const aTime = a.lastMessage?.created_at || '';
      const bTime = b.lastMessage?.created_at || '';
      return bTime.localeCompare(aTime);
    });

    setConversations(convList);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function toggleDND(newVal: boolean) {
    setDndEnabled(newVal);
    if (!currentUserId) return;
    await supabase.from('profiles').update({ dnd_enabled: newVal }).eq('id', currentUserId);
  }

  const filtered = conversations.filter(c => {
    if (!searchQuery.trim()) return true;
    const name = c.other?.display_name || c.other?.username || '';
    return name.includes(searchQuery);
  });

  const unreadCount = conversations.filter(c => c.isUnread).length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={['#065f46', '#059669', '#10b981']} style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerRight}>
            <Text style={styles.headerTitle}>الرسائل</Text>
            {unreadCount > 0 && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </View>

          <View style={styles.headerLeftActions}>
            {/* Quick DND Toggle button */}
            <Pressable
              style={[styles.dndHeaderBtn, dndEnabled && styles.dndHeaderBtnActive]}
              onPress={() => toggleDND(!dndEnabled)}
            >
              {dndEnabled ? <BellOff size={16} color="#fff" /> : <Bell size={16} color="#a7f3d0" />}
              <Text style={[styles.dndHeaderText, dndEnabled && { color: '#fff' }]}>
                {dndEnabled ? 'عدم الإزعاج مفعّل' : 'إشعارات عادية'}
              </Text>
            </Pressable>

            <Pressable style={styles.newChatBtn} onPress={() => router.push('/search')}>
              <Plus size={20} color="#fff" />
            </Pressable>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Search size={18} color="#9ca3af" />
          <TextInput
            style={styles.searchInput}
            placeholder="ابحث في محادثاتك مع الجيران..."
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </LinearGradient>

      {/* DND Alert Banner if enabled */}
      {dndEnabled && (
        <View style={styles.dndBanner}>
          <BellOff size={16} color="#b91c1c" />
          <Text style={styles.dndBannerText}>
            وضع عدم الإزعاج مفعّل 🔕 — التنبيهات الصوتية للرسائل في وضع صامت.
          </Text>
          <Pressable onPress={() => toggleDND(false)} style={styles.dndBannerAction}>
            <Text style={styles.dndBannerActionText}>إلغاء</Text>
          </Pressable>
        </View>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0891b2" />
        </View>
      ) : (
        <ScrollView
          style={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
              tintColor="#0891b2"
            />
          }
        >
          {filtered.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <MessageCircle size={48} color="#cbd5e1" />
              </View>
              <Text style={styles.emptyTitle}>
                {searchQuery ? 'لا نتائج لبحثك' : 'لا توجد محادثات بعد'}
              </Text>
              <Text style={styles.emptySub}>
                {searchQuery ? 'جرب اسماً آخر' : 'تواصل مع جيرانك واستفسر عن الحي بالضغط على +'}
              </Text>
              {!searchQuery && (
                <Pressable style={styles.startChatBtn} onPress={() => router.push('/search')}>
                  <Text style={styles.startChatBtnText}>ابحث عن جار وابدأ محادثة</Text>
                </Pressable>
              )}
            </View>
          ) : (
            <>
              {/* Unread Section */}
              {filtered.some(c => c.isUnread) && <Text style={styles.sectionLabel}>غير مقروء</Text>}
              {filtered
                .filter(c => c.isUnread)
                .map(conv => (
                  <ConvCard key={conv.id} conv={conv} currentUserId={currentUserId} />
                ))}

              {/* All Conversations */}
              {filtered.some(c => c.isUnread) && filtered.some(c => !c.isUnread) && (
                <Text style={styles.sectionLabel}>المحادثات</Text>
              )}
              {filtered
                .filter(c => !c.isUnread)
                .map(conv => (
                  <ConvCard key={conv.id} conv={conv} currentUserId={currentUserId} />
                ))}
            </>
          )}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        <BottomNav />
      </View>
    </View>
  );
}

function ConvCard({ conv, currentUserId }: { conv: any; currentUserId: string }) {
  const { other, lastMessage, isUnread, isBlocked, isMuted, id } = conv;
  const name = other?.display_name || other?.username || 'جار';
  const avatar = other?.avatar_url;
  const isLastMine = lastMessage?.sender_id === currentUserId;
  const isRead = isLastMine ? true : (lastMessage?.read_by || []).includes(currentUserId);
  const timeStr = lastMessage?.created_at ? formatTime(lastMessage.created_at) : '';

  return (
    <Pressable
      style={[
        styles.convCard,
        isUnread && styles.convCardUnread,
        isBlocked && styles.convCardBlocked,
      ]}
      onPress={() => router.push({ pathname: '/conversation', params: { id } })}
    >
      {/* Avatar */}
      <View style={styles.avatarWrap}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarLetter}>{name[0]}</Text>
          </View>
        )}
        {other?.is_verified && (
          <View style={styles.verifiedDot}>
            <Text style={{ fontSize: 8 }}>✓</Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.convContent}>
        <View style={styles.convTopRow}>
          <View style={styles.nameBadgesRow}>
            <Text style={[styles.convName, isUnread && styles.convNameUnread]}>{name}</Text>
            {isBlocked && (
              <View style={styles.blockedPill}>
                <Text style={styles.blockedPillText}>محظور</Text>
              </View>
            )}
            {isMuted && <BellOff size={13} color="#94a3b8" style={{ marginRight: 4 }} />}
          </View>
          <Text style={[styles.convTime, isUnread && styles.convTimeUnread]}>{timeStr}</Text>
        </View>

        <View style={styles.convBottomRow}>
          <View style={styles.lastMsgRow}>
            {isLastMine &&
              (isRead ? (
                <CheckCheck size={14} color="#0891b2" style={{ marginLeft: 4 }} />
              ) : (
                <Check size={14} color="#94a3b8" style={{ marginLeft: 4 }} />
              ))}
            <Text style={[styles.lastMsg, isUnread && styles.lastMsgUnread]} numberOfLines={1}>
              {isBlocked
                ? '🚫 المستخدم محظور'
                : `${isLastMine ? 'أنت: ' : ''}${lastMessage?.body || 'لا توجد رسائل'}`}
            </Text>
          </View>
          {isUnread && <View style={styles.unreadDot} />}
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
    if (diffMins < 60) return `${diffMins}د`;
    if (diffHours < 24) return `${diffHours}س`;
    if (diffDays === 1) return 'أمس';
    return date.toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    paddingTop: 54,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerContent: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerRight: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  headerLeftActions: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
  },
  unreadBadge: {
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  unreadBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  dndHeaderBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  dndHeaderBtnActive: {
    backgroundColor: '#ef4444',
    borderColor: '#f87171',
  },
  dndHeaderText: {
    color: '#cffafe',
    fontSize: 11,
    fontWeight: '800',
  },
  newChatBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#111827',
    textAlign: 'right',
  },
  dndBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fee2e2',
    borderBottomWidth: 1,
    borderColor: '#fca5a5',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  dndBannerText: {
    flex: 1,
    color: '#991b1b',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
    marginRight: 6,
  },
  dndBannerAction: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#ef4444',
    borderRadius: 6,
  },
  dndBannerActionText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
    textAlign: 'right',
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  convCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  convCardUnread: {
    borderColor: '#bae6fd',
    backgroundColor: '#f0f9ff',
  },
  convCardBlocked: {
    opacity: 0.65,
    backgroundColor: '#fef2f2',
    borderColor: '#fee2e2',
  },
  avatarWrap: {
    position: 'relative',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0891b2',
  },
  verifiedDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#0891b2',
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  convContent: {
    flex: 1,
  },
  convTopRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  nameBadgesRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  convName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
  },
  convNameUnread: {
    fontWeight: '900',
    color: '#0369a1',
  },
  blockedPill: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  blockedPillText: {
    color: '#dc2626',
    fontSize: 10,
    fontWeight: '800',
  },
  convTime: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  convTimeUnread: {
    color: '#0891b2',
    fontWeight: '800',
  },
  convBottomRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMsgRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    flex: 1,
  },
  lastMsg: {
    fontSize: 12,
    color: '#64748b',
    flex: 1,
    textAlign: 'right',
  },
  lastMsgUnread: {
    color: '#0f172a',
    fontWeight: '700',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0891b2',
    marginRight: 6,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 6,
  },
  emptySub: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  startChatBtn: {
    backgroundColor: '#0891b2',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 14,
  },
  startChatBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
});
