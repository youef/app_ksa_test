import { useEffect, useState, useRef, useCallback } from 'react';
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  StyleSheet,
  Platform,
  Image,
  KeyboardAvoidingView,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import {
  ChevronRight,
  Send,
  MoreHorizontal,
  Check,
  CheckCheck,
  BellOff,
  Bell,
  UserX,
  UserCheck,
  Trash2,
  X,
  User,
  ShieldAlert,
} from 'lucide-react-native';

export default function Conversation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [messages, setMessages] = useState<any[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');
  const [otherUser, setOtherUser] = useState<any>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isBlockedByMe, setIsBlockedByMe] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return router.replace('/auth');
    setCurrentUserId(u.user.id);

    // 1. Get messages
    const { data: msgs } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });

    setMessages(msgs ?? []);

    // 2. Get other user
    const { data: members } = await supabase
      .from('conversation_members')
      .select('user_id')
      .eq('conversation_id', id)
      .neq('user_id', u.user.id);

    let otherId: string | null = null;
    if (members && members.length > 0) {
      otherId = members[0].user_id;
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', otherId)
        .single();
      setOtherUser(profile);
    }

    // 3. Get my profile for mute list & check blocks
    const { data: myProfile } = await supabase
      .from('profiles')
      .select('muted_conversations')
      .eq('id', u.user.id)
      .maybeSingle();

    if (myProfile) {
      setIsMuted((myProfile.muted_conversations || []).includes(id));
    }

    if (otherId) {
      const { data: blockRecord } = await supabase
        .from('blocks')
        .select('id')
        .eq('blocker_id', u.user.id)
        .eq('blocked_id', otherId)
        .maybeSingle();
      setIsBlockedByMe(!!blockRecord);
    }

    setLoading(false);

    // Mark messages as read
    if (msgs && msgs.length > 0) {
      const unreadMsgIds = msgs
        .filter(m => m.sender_id !== u.user.id && !(m.read_by || []).includes(u.user.id))
        .map(m => m.id);
      if (unreadMsgIds.length > 0) {
        for (const msgId of unreadMsgIds) {
          await supabase
            .from('messages')
            .update({
              read_by: [...(msgs.find(m => m.id === msgId)?.read_by || []), u.user.id],
            })
            .eq('id', msgId);
        }
      }
    }

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 100);
  }, [id]);

  useEffect(() => {
    load();
    const ch = supabase
      .channel('chat-' + id)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` },
        payload => {
          setMessages(prev => [...prev, payload.new]);
          setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
  }, [id]);

  async function send() {
    if (!body.trim() || sending) return;
    if (isBlockedByMe) {
      return Alert.alert('تنبيه', 'قم بإلغاء حظر هذا المستخدم أولاً لتتمكن من المراسلة.');
    }

    setSending(true);
    const trimmed = body.trim();
    setBody('');

    await supabase.from('messages').insert({
      conversation_id: id,
      sender_id: currentUserId,
      body: trimmed,
      read_by: [currentUserId],
    });

    setSending(false);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }

  // Toggle Mute / DND for this conversation
  async function toggleMute() {
    if (!currentUserId) return;
    setOptionsOpen(false);

    try {
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('muted_conversations')
        .eq('id', currentUserId)
        .single();

      let currentMuted: string[] = myProfile?.muted_conversations || [];
      let nextMuted: string[];

      if (isMuted) {
        nextMuted = currentMuted.filter(convId => convId !== id);
        setIsMuted(false);
        Alert.alert('تم! 🔔', 'تم إلغاء كتم إشعارات هذه المحادثة.');
      } else {
        nextMuted = [...new Set([...currentMuted, id])];
        setIsMuted(true);
        Alert.alert('تم! 🔕', 'تم تفعيل وضع عدم الإزعاج وكتم إشعارات هذه المحادثة.');
      }

      await supabase.from('profiles').update({ muted_conversations: nextMuted }).eq('id', currentUserId);
    } catch (e: any) {
      Alert.alert('خطأ', e.message);
    }
  }

  // Toggle Block / Unblock user
  function confirmToggleBlock() {
    if (!otherUser) return;
    setOptionsOpen(false);

    if (isBlockedByMe) {
      Alert.alert('إلغاء الحظر', `هل تريد بالتأكيد إلغاء حظر ${otherName}؟`, [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'إلغاء الحظر',
          onPress: async () => {
            await supabase.from('blocks').delete().eq('blocker_id', currentUserId).eq('blocked_id', otherUser.id);
            setIsBlockedByMe(false);
            Alert.alert('تم! ✅', 'تم رفع الحظر بنجاح.');
          },
        },
      ]);
    } else {
      Alert.alert('حظر المستخدم 🚫', `هل تريد بالتأكيد حظر ${otherName}؟ لن يتمكن من مراسلتك ولن تظهر لك رسائله.`, [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حظر الآن',
          style: 'destructive',
          onPress: async () => {
            await supabase.from('blocks').insert({ blocker_id: currentUserId, blocked_id: otherUser.id });
            setIsBlockedByMe(true);
            Alert.alert('تم الحظر 🚫', 'تمت إضافة المستخدم لقائمة المحظورين.');
          },
        },
      ]);
    }
  }

  // Clear conversation history
  function confirmClearChat() {
    setOptionsOpen(false);
    Alert.alert('مسح المحادثة 🗑️', 'هل تريد بالتأكيد حذف جميع الرسائل في هذه المحادثة؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'مسح الآن',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('messages').delete().eq('conversation_id', id);
          setMessages([]);
        },
      },
    ]);
  }

  const isOtherAnonymous = otherUser?.hide_name === true;
  const otherName = isOtherAnonymous
    ? 'جار مجهول 🕶️'
    : otherUser?.display_name || otherUser?.username || 'المحادثة';

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ChevronRight size={26} color="#059669" />
        </Pressable>

        <Pressable
          style={styles.headerUser}
          onPress={() => otherUser && router.push({ pathname: '/user', params: { id: otherUser.id } })}
        >
          {otherUser?.avatar_url && !isOtherAnonymous ? (
            <Image source={{ uri: otherUser.avatar_url }} style={styles.headerAvatar} />
          ) : (
            <View style={styles.headerAvatarFallback}>
              <Text style={styles.headerAvatarLetter}>{otherName[0]}</Text>
            </View>
          )}

          <View style={styles.headerInfo}>
            <View style={styles.headerNameRow}>
              <Text style={styles.headerName}>{otherName}</Text>
              {isMuted && <BellOff size={13} color="#94a3b8" />}
            </View>
            {otherUser?.city && !isOtherAnonymous && (
              <Text style={styles.headerCity}>
                📍 {otherUser.city} {otherUser.district ? `· ${otherUser.district}` : ''}
              </Text>
            )}
          </View>
        </Pressable>

        <View style={styles.headerActions}>
          <Pressable style={styles.headerActionBtn} onPress={() => setOptionsOpen(true)}>
            <MoreHorizontal size={22} color="#374151" />
          </Pressable>
        </View>
      </View>

      {/* Blocked or Muted Notices Banner */}
      {isBlockedByMe ? (
        <View style={styles.noticeBannerBlocked}>
          <UserX size={16} color="#dc2626" />
          <Text style={styles.noticeBannerBlockedText}>
            لقد قمت بحظر هذا المستخدم. لا يمكن تبادل الرسائل.
          </Text>
          <Pressable onPress={confirmToggleBlock} style={styles.unblockQuickBtn}>
            <Text style={styles.unblockQuickText}>إلغاء الحظر</Text>
          </Pressable>
        </View>
      ) : isMuted ? (
        <View style={styles.noticeBannerMuted}>
          <BellOff size={14} color="#64748b" />
          <Text style={styles.noticeBannerMutedText}>
            تم كتم إشعارات هذه المحادثة (وضع عدم الإزعاج)
          </Text>
        </View>
      ) : otherUser?.dnd_enabled ? (
        <View style={styles.noticeBannerMuted}>
          <BellOff size={14} color="#64748b" />
          <Text style={styles.noticeBannerMutedText}>
            الجار في وضع عدم الإزعاج حالياً
          </Text>
        </View>
      ) : null}

      {/* Messages Feed */}
      <ScrollView
        ref={scrollRef}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyConv}>
            <View style={styles.emptyConvIcon}>
              {otherUser?.avatar_url && !isOtherAnonymous ? (
                <Image source={{ uri: otherUser.avatar_url }} style={styles.emptyConvAvatar} />
              ) : (
                <View style={styles.emptyConvAvatarFallback}>
                  <Text style={styles.emptyConvAvatarLetter}>{otherName[0]}</Text>
                </View>
              )}
            </View>
            <Text style={styles.emptyConvName}>{otherName}</Text>
            {otherUser?.bio && !isOtherAnonymous && (
              <Text style={styles.emptyConvBio}>{otherUser.bio}</Text>
            )}
            <Text style={styles.emptyConvHint}>ابدأ محادثتك مع جارك بالحي 👋</Text>
          </View>
        ) : (
          messages.map((msg, index) => {
            const isMine = msg.sender_id === currentUserId;
            const isRead =
              isMine && (msg.read_by || []).filter((uid: string) => uid !== currentUserId).length > 0;
            const prevMsg = index > 0 ? messages[index - 1] : null;
            const showDate = !prevMsg || !isSameDay(new Date(msg.created_at), new Date(prevMsg.created_at));

            return (
              <View key={msg.id}>
                {showDate && (
                  <Text style={styles.dateDivider}>{formatDateLabel(msg.created_at)}</Text>
                )}
                <View style={[styles.msgRow, isMine && styles.msgRowMine]}>
                  {!isMine && (
                    <View style={styles.otherAvatar}>
                      {otherUser?.avatar_url && !isOtherAnonymous ? (
                        <Image source={{ uri: otherUser.avatar_url }} style={styles.otherAvatarImg} />
                      ) : (
                        <View style={styles.otherAvatarFallback}>
                          <Text style={styles.otherAvatarLetter}>{otherName[0]}</Text>
                        </View>
                      )}
                    </View>
                  )}
                  <View style={[styles.msgBubble, isMine ? styles.msgBubbleMine : styles.msgBubbleOther]}>
                    <Text style={[styles.msgText, isMine && styles.msgTextMine]}>{msg.body}</Text>
                    <View style={[styles.msgMeta, isMine && styles.msgMetaMine]}>
                      <Text style={[styles.msgTime, isMine && styles.msgTimeMine]}>
                        {formatMsgTime(msg.created_at)}
                      </Text>
                      {isMine &&
                        (isRead ? (
                          <CheckCheck size={12} color="rgba(255,255,255,0.8)" style={{ marginRight: 4 }} />
                        ) : (
                          <Check size={12} color="rgba(255,255,255,0.6)" style={{ marginRight: 4 }} />
                        ))}
                    </View>
                  </View>
                </View>
              </View>
            );
          })
        )}
        <View style={{ height: 16 }} />
      </ScrollView>

      {/* Input Area or Blocked Notice */}
      {isBlockedByMe ? (
        <View style={styles.blockedInputArea}>
          <Text style={styles.blockedInputText}>لا يمكنك إرسال رسائل لأنك قمت بحظر هذا المستخدم</Text>
          <Pressable style={styles.unblockActionBtn} onPress={confirmToggleBlock}>
            <Text style={styles.unblockActionBtnText}>إلغاء الحظر للمراسلة</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.inputArea}>
          <Pressable
            style={[styles.sendButton, !body.trim() && styles.sendButtonDisabled]}
            onPress={send}
            disabled={!body.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Send size={18} color="#fff" style={{ transform: [{ rotate: '180deg' }] }} />
            )}
          </Pressable>

          <TextInput
            style={styles.textInput}
            value={body}
            onChangeText={setBody}
            placeholder="اكتب رسالة لجيرانك..."
            placeholderTextColor="#9ca3af"
            multiline
            maxLength={1000}
          />
        </View>
      )}

      {/* Options Menu Modal */}
      <Modal visible={optionsOpen} transparent animationType="fade">
        <Pressable style={styles.optionsOverlay} onPress={() => setOptionsOpen(false)}>
          <View style={styles.optionsSheet}>
            <View style={styles.optionsHeader}>
              <Pressable onPress={() => setOptionsOpen(false)} style={styles.optionsClose}>
                <X size={18} color="#64748b" />
              </Pressable>
              <Text style={styles.optionsTitle}>خيارات المحادثة</Text>
            </View>

            {/* Mute Conversation */}
            <Pressable style={styles.optionRow} onPress={toggleMute}>
              {isMuted ? <Bell size={18} color="#0891b2" /> : <BellOff size={18} color="#d97706" />}
              <Text style={styles.optionRowText}>
                {isMuted ? 'إلغاء كتم الإشعارات 🔔' : 'كتم المحادثة (عدم الإزعاج) 🔕'}
              </Text>
            </Pressable>

            {/* View Profile */}
            {otherUser && (
              <Pressable
                style={styles.optionRow}
                onPress={() => {
                  setOptionsOpen(false);
                  router.push({ pathname: '/user', params: { id: otherUser.id } });
                }}
              >
                <User size={18} color="#0891b2" />
                <Text style={styles.optionRowText}>عرض الملف الشخصي 👤</Text>
              </Pressable>
            )}

            {/* Block / Unblock */}
            <Pressable style={styles.optionRow} onPress={confirmToggleBlock}>
              <UserX size={18} color="#dc2626" />
              <Text style={[styles.optionRowText, { color: '#dc2626' }]}>
                {isBlockedByMe ? 'إلغاء حظر هذا المستخدم' : 'حظر هذا المستخدم 🚫'}
              </Text>
            </Pressable>

            {/* Clear History */}
            <Pressable style={[styles.optionRow, { borderBottomWidth: 0 }]} onPress={confirmClearChat}>
              <Trash2 size={18} color="#64748b" />
              <Text style={styles.optionRowText}>مسح رسائل المحادثة 🗑️</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function isSameDay(d1: Date, d2: Date) {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function formatDateLabel(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  if (isSameDay(d, now)) return 'اليوم';
  const yday = new Date(now);
  yday.setDate(now.getDate() - 1);
  if (isSameDay(d, yday)) return 'أمس';
  return d.toLocaleDateString('ar-SA', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatMsgTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
    paddingBottom: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    padding: 6,
  },
  headerUser: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
    gap: 10,
  },
  headerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  headerAvatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarLetter: {
    color: '#0891b2',
    fontSize: 16,
    fontWeight: '800',
  },
  headerInfo: {
    alignItems: 'flex-end',
  },
  headerNameRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  headerName: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '800',
  },
  headerCity: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row-reverse',
  },
  headerActionBtn: {
    padding: 6,
  },
  noticeBannerBlocked: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fef2f2',
    borderBottomWidth: 1,
    borderColor: '#fca5a5',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  noticeBannerBlockedText: {
    flex: 1,
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
    marginRight: 6,
  },
  unblockQuickBtn: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  unblockQuickText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  noticeBannerMuted: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  noticeBannerMutedText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
  },
  messagesList: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
  },
  dateDivider: {
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    marginVertical: 14,
    backgroundColor: '#f1f5f9',
    alignSelf: 'center',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  msgRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  msgRowMine: {
    flexDirection: 'row',
  },
  otherAvatar: {
    marginRight: 8,
  },
  otherAvatarImg: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  otherAvatarFallback: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  otherAvatarLetter: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  msgBubble: {
    maxWidth: '78%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  msgBubbleMine: {
    backgroundColor: '#059669',
    borderBottomLeftRadius: 4,
  },
  msgBubbleOther: {
    backgroundColor: '#fff',
    borderBottomRightRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  msgText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#0f172a',
    textAlign: 'right',
  },
  msgTextMine: {
    color: '#fff',
  },
  msgMeta: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: 3,
  },
  msgMetaMine: {
    justifyContent: 'flex-end',
  },
  msgTime: {
    fontSize: 10,
    color: '#94a3b8',
  },
  msgTimeMine: {
    color: 'rgba(255,255,255,0.7)',
  },
  emptyConv: {
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyConvIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyConvAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  emptyConvAvatarFallback: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyConvAvatarLetter: {
    fontSize: 26,
    fontWeight: '900',
    color: '#059669',
  },
  emptyConvName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 4,
  },
  emptyConvBio: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginHorizontal: 32,
    marginBottom: 10,
  },
  emptyConvHint: {
    fontSize: 12,
    color: '#059669',
    fontWeight: '700',
  },
  inputArea: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    color: '#0f172a',
    maxHeight: 100,
    textAlign: 'right',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  blockedInputArea: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderColor: '#fca5a5',
    padding: 16,
    alignItems: 'center',
    gap: 10,
  },
  blockedInputText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  unblockActionBtn: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 20,
    paddingVertical: 9,
    borderRadius: 12,
  },
  unblockActionBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  optionsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  optionsSheet: {
    width: '90%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  optionsHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
    paddingBottom: 10,
  },
  optionsTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
  },
  optionsClose: {
    padding: 4,
  },
  optionRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderColor: '#f8fafc',
  },
  optionRowText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#334155',
  },
});
