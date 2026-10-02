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
  Eraser,
  X,
  User,
  Lock,
  Moon,
  Paperclip,
  Smile,
  Wifi,
  WifiOff,
  MessageCircle,
} from 'lucide-react-native';
import {
  clearForMe,
  deleteConversationForEveryone,
  displayName,
  isDndActiveNow,
  loadConvSettings,
  loadDnd,
  markConversationRead,
  saveDnd,
  setBlock,
  setMute,
} from '@/lib/chatControls';
import { syncDndWithNotifications } from '@/lib/notifications';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';

export default function Conversation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [messages, setMessages] = useState<any[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState('');
  const [otherUser, setOtherUser] = useState<any>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCleared, setIsCleared] = useState(false);
  const [blockedByMe, setBlockedByMe] = useState(false);
  const [blockedMe, setBlockedMe] = useState(false);
  const [dndActive, setDndActive] = useState(false);
  const [otherDnd, setOtherDnd] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<any>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [stickersOpen, setStickersOpen] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const convId = Array.isArray(id) ? id[0] : (id as string);
  const otherName = displayName(otherUser, 'المحادثة');
  const isAnonymous = otherUser?.hide_name === true;
  const anyBlock = blockedByMe || blockedMe;

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return router.replace('/auth');
    setCurrentUserId(u.user.id);

    // 1. Messages (RLS already hides blocked-party traffic and anything cleared)
    const { data: msgs } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });

    setMessages(prev => {
      const loaded = msgs ?? [];
      const loadedIds = new Set(loaded.map(m => m.id));
      const liveOnly = prev.filter(m => {
        if (!m.id || !String(m.id).startsWith('optimistic-')) return !loadedIds.has(m.id);
        const duplicate = loaded.some(
          loadedMessage =>
            loadedMessage.sender_id === m.sender_id &&
            loadedMessage.body === m.body &&
            Math.abs(new Date(loadedMessage.created_at).getTime() - new Date(m.created_at).getTime()) < 10000
        );
        return !duplicate;
      });
      return [...loaded, ...liveOnly].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    });

    // 2. Other member + their profile
    const { data: members } = await supabase
      .from('conversation_members')
      .select('user_id')
      .eq('conversation_id', convId)
      .neq('user_id', u.user.id);

    const otherId = members && members.length > 0 ? members[0].user_id : null;
    if (otherId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', otherId)
        .single();
      setOtherUser(profile);
      setOtherDnd(await isDndActiveNow(await loadDnd(otherId)));
    }

    // 3. My per-conversation settings
    const settings = await loadConvSettings(u.user.id, [convId]);
    const mine = settings[convId];
    setIsMuted(!!mine?.muted);
    setIsCleared(!!mine?.clearedAt);

    // 4. My DND state
    const mine_dnd = await loadDnd(u.user.id);
    setDndActive(isDndActiveNow(mine_dnd));
    await syncDndWithNotifications(u.user.id);

    // 5. Blocks in BOTH directions
    if (otherId) {
      const [{ data: mineBlocks }, { data: theirBlocks }] = await Promise.all([
        supabase
          .from('blocks')
          .select('id')
          .eq('blocker_id', u.user.id)
          .eq('blocked_id', otherId)
          .maybeSingle(),
        supabase
          .from('blocks')
          .select('id')
          .eq('blocker_id', otherId)
          .eq('blocked_id', u.user.id)
          .maybeSingle(),
      ]);
      setBlockedByMe(!!mineBlocks);
      setBlockedMe(!!theirBlocks);
    }

    setLoading(false);

    // 6. Read receipts in one call
    if (msgs && msgs.length > 0) {
      void markConversationRead(convId, u.user.id);
    }

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 50);
  }, [convId]);

  useEffect(() => {
    let alive = true;
    let ch: any = null;

    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (!userId) {
        router.replace('/auth');
        return;
      }
      if (!alive) return;
      setCurrentUserId(userId);

      ch = supabase
        .channel('chat-' + convId + '-' + userId, {
          config: {
            broadcast: { self: false },
            presence: { key: userId },
          },
        })
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${convId}`,
          },
          payload => {
            if (!alive) return;
            setMessages(prev => {
              if (prev.some(m => m.id === payload.new.id)) return prev;
              if (payload.new.sender_id === userId) {
                const optimisticIndex = prev.findIndex(
                  m =>
                    String(m.id).startsWith('optimistic-') &&
                    m.sender_id === userId &&
                    m.body === payload.new.body &&
                    Math.abs(new Date(m.created_at).getTime() - new Date(payload.new.created_at).getTime()) < 10000
                );
                if (optimisticIndex >= 0) {
                  const next = [...prev];
                  next[optimisticIndex] = payload.new;
                  return next;
                }
              }
              return [...prev, payload.new];
            });
            setOtherTyping(false);
            requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
            if (payload.new.sender_id !== userId) {
              void markConversationRead(convId, userId);
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'messages',
            filter: `conversation_id=eq.${convId}`,
          },
          payload => {
            if (!alive) return;
            setMessages(prev => prev.map(m => m.id === payload.new.id ? payload.new : m));
          }
        )
        .on('broadcast', { event: 'typing' }, ({ payload }: any) => {
          if (!alive || payload?.userId === userId) return;
          setOtherTyping(!!payload?.typing);
        })
        .on('presence', { event: 'sync' }, () => {
          if (!alive) return;
          const state = ch?.presenceState?.() || {};
          setIsOnline(Object.keys(state).some(key => key !== userId));
        })
        .on('presence', { event: 'join' }, ({ key }: any) => {
          if (key !== userId) setIsOnline(true);
        })
        .on('presence', { event: 'leave' }, ({ key }: any) => {
          if (key !== userId) setIsOnline(false);
        });

      channelRef.current = ch;

      ch.subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED' && alive) {
          await ch.track({ userId, onlineAt: new Date().toISOString() });
        }
      });

      await load();
    })();

    return () => {
      alive = false;
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      channelRef.current = null;
      if (ch) {
        void ch.untrack();
        void supabase.removeChannel(ch);
      }
    };
  }, [convId, load]);
  // ------------------------------------------------------------ actions

  async function broadcastTyping(typing: boolean) {
    try {
      await channelRef.current?.send({
        type: 'broadcast',
        event: 'typing',
        payload: { userId: currentUserId, typing },
      });
    } catch {}
  }

  function handleBodyChange(value: string) {
    setBody(value);
    void broadcastTyping(true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => {
      void broadcastTyping(false);
    }, 900);
  }

  async function pickImages() {
    if (anyBlock || uploadingMedia) return;
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('السماح بالصور', 'اسمح للتطبيق بالوصول إلى الصور لإرسالها.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: 6,
        quality: 0.86,
        base64: true,
      });
      if (result.canceled || !result.assets?.length) return;
      setUploadingMedia(true);
      for (const asset of result.assets) {
        if (!asset.base64) continue;
        const ext = (asset.fileName?.split('.').pop() || 'jpg').replace(/[^a-zA-Z0-9]/g, '');
        const path = currentUserId + '/' + Date.now() + '-' + Math.random().toString(36).slice(2) + '.' + ext;
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
        const clean = asset.base64.replace(/[^A-Za-z0-9+/=]/g, '');
        const bytes = new Uint8Array(Math.floor(clean.length * 3 / 4) - (clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0));
        let buffer = 0, bits = 0, index = 0;
        for (const ch of clean) {
          if (ch === '=') break;
          buffer = (buffer << 6) | chars.indexOf(ch); bits += 6;
          if (bits >= 8) { bits -= 8; bytes[index++] = (buffer >> bits) & 255; }
        }
        const { error: uploadError } = await supabase.storage.from('chat-media').upload(path, bytes, {
          contentType: asset.mimeType || 'image/jpeg', cacheControl: '3600', upsert: false,
        });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(path);
        const { error } = await supabase.from('messages').insert({
          conversation_id: convId, sender_id: currentUserId,
          body: JSON.stringify({ type: 'image', url: urlData.publicUrl, name: asset.fileName || 'صورة' }),
          read_by: [currentUserId],
        });
        if (error) throw error;
      }
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    } catch (e: any) {
      Alert.alert('تعذر إرسال الصورة', e?.message || 'حدث خطأ أثناء رفع الصورة');
    } finally {
      setUploadingMedia(false);
    }
  }

  function parseImageMessage(value: string) {
    try {
      const parsed = JSON.parse(value);
      return parsed?.type === 'image' && parsed?.url ? parsed : null;
    } catch { return null; }
  }

  async function send() {
    if (!body.trim() || sending) return;

    if (anyBlock) {
      return Alert.alert(
        'غير مسموح',
        blockedByMe
          ? 'قم بإلغاء حظر هذا المستخدم أولاً لتتمكن من المراسلة.'
          : 'هذا المستخدم حظرك. لا يمكنك إرسال رسائل إليه.'
      );
    }

    setSending(true);
    const trimmed = body.trim();
    const optimisticKey = `${currentUserId}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const optimisticMessage = {
      id: `optimistic-${optimisticKey}`,
      conversation_id: convId,
      sender_id: currentUserId,
      body: trimmed,
      read_by: [currentUserId],
      created_at: new Date().toISOString(),
      _optimisticKey: optimisticKey,
    };
    setMessages(prev => [...prev, optimisticMessage]);
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 10);
    setBody('');
    void broadcastTyping(false);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);

    const { error } = await supabase.from('messages').insert({
      conversation_id: convId,
      sender_id: currentUserId,
      body: trimmed,
      read_by: [currentUserId],
    });

    setSending(false);

    if (error) {
      setMessages(prev => prev.filter(m => m._optimisticKey !== optimisticKey));
      setBody(trimmed);
      Alert.alert('تعذّر الإرسال', error.message);
      return;
    }
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 20);
  }

  async function toggleMute() {
    setOptionsOpen(false);
    const next = !isMuted;
    setIsMuted(next);

    const result = await setMute(currentUserId, convId, next);
    if (!result.ok) {
      setIsMuted(!next);
      Alert.alert('تعذّر تغيير الكتم', result.error);
      return;
    }
    Alert.alert('تم ✓', next ? 'تم كتم إشعارات هذه المحادثة 🔕' : 'تم إلغاء الكتم 🔔');
  }

  async function toggleMyDnd() {
    setOptionsOpen(false);
    const dnd = await loadDnd(currentUserId);
    const next = !dnd.enabled;
    setDndActive(next);
    const result = await saveDnd(currentUserId, { ...dnd, enabled: next });
    if (!result.ok) {
      Alert.alert('تعذّر الحفظ', result.error);
      return;
    }
    await syncDndWithNotifications(currentUserId);
    Alert.alert('تم ✓', next ? 'عدم الإزعاج مفعّل — الإشعارات صامتة' : 'عادت الإشعارات الصوتية');
  }

  function confirmToggleBlock() {
    if (!otherUser) return;
    setOptionsOpen(false);

    if (blockedByMe) {
      Alert.alert('إلغاء الحظر', `هل تريد السماح لـ ${otherName} بمراسلتك مرة أخرى؟`, [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'إلغاء الحظر',
          onPress: async () => {
            const result = await setBlock(currentUserId, otherUser.id, false);
            if (!result.ok) return Alert.alert('خطأ', result.error);
            setBlockedByMe(false);
            Alert.alert('تم رفع الحظر ✓', 'يمكنك تبادل الرسائل مجدداً.');
          },
        },
      ]);
      return;
    }

    Alert.alert(
      'حظر المستخدم 🚫',
      `لن يتمكن ${otherName} من مراسلتك، وستُخفى رسائله من هذه المحادثة.`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حظر الآن',
          style: 'destructive',
          onPress: async () => {
            const result = await setBlock(currentUserId, otherUser.id, true);
            if (!result.ok) return Alert.alert('خطأ', result.error);
            setBlockedByMe(true);
            setMessages(prev => prev.filter(m => m.sender_id === currentUserId));
            Alert.alert('تم الحظر 🚫', 'أُضيف المستخدم إلى قائمة المحظورين.');
          },
        },
      ]
    );
  }

  function openClearOptions() {
    setOptionsOpen(false);
    setConfirmClear(true);
  }

  async function doClearMine() {
    setConfirmClear(false);
    const result = await clearForMe(currentUserId, convId);
    if (!result.ok) return Alert.alert('تعذّر المسح', result.error);

    setMessages([]);
    setIsCleared(true);
    Alert.alert('تم المسح ✓', 'حُذفت الرسائل من عندك فقط، وآخر رسالة لك محفوظة عند الطرف الآخر.');
  }

  async function doDeleteForEveryone() {
    setConfirmClear(false);
    const result = await deleteConversationForEveryone(convId);
    if (!result.ok) return Alert.alert('تعذّر الحذف', result.error);
    Alert.alert('تم الحذف ✓', 'حُذفت المحادثة من عند الطرفين.', [
      { text: 'رجوع للقائمة', onPress: () => router.replace('/messages') },
    ]);
  }

  // ------------------------------------------------------------ render

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <LinearGradient colors={['#064e3b', '#047857', '#059669']} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.header}>
        <Pressable onPress={() => router.replace('/home')} style={styles.backBtn}>
          <ChevronRight size={26} color="#ffffff" />
        </Pressable>

        <Pressable
          style={styles.headerUser}
          onPress={() => otherUser && router.push({ pathname: '/user', params: { id: otherUser.id } })}
        >
          {otherUser?.avatar_url && !isAnonymous ? (
            <Image source={{ uri: otherUser.avatar_url }} style={styles.headerAvatar} />
          ) : (
            <View style={styles.headerAvatarFallback}>
              <Text style={styles.headerAvatarLetter}>{otherName[0]}</Text>
            </View>
          )}

          <View style={styles.headerInfo}>
            <View style={styles.headerNameRow}>
              <Text style={styles.headerName} numberOfLines={1}>
                {otherName}
              </Text>
              {isMuted && <BellOff size={13} color="#d97706" />}
            </View>
            {otherUser?.city && !isAnonymous ? (
              <Text style={styles.headerCity}>
                📍 {otherUser.city} {otherUser.district ? `· ${otherUser.district}` : ''}
              </Text>
            ) : null}
          </View>
        </Pressable>

        <View style={styles.headerStatusPill}>
          {otherTyping ? <MessageCircle size={13} color="#059669" /> : isOnline ? <Wifi size={13} color="#059669" /> : <WifiOff size={13} color="#94a3b8" />}
          <Text style={styles.headerStatusText}>{otherTyping ? 'يكتب الآن...' : isOnline ? 'متصل الآن' : 'غير متصل'}</Text>
        </View>

        <View style={styles.headerActions}>
          <Pressable style={styles.headerActionBtn} onPress={() => setOptionsOpen(true)}>
            <MoreHorizontal size={22} color="#ffffff" />
          </Pressable>
        </View>
      </LinearGradient>

      {/* Banners: block wins, then mute, then DND context */}
      {blockedByMe ? (
        <View style={styles.noticeBlocked}>
          <UserX size={16} color="#dc2626" />
          <Text style={styles.noticeBlockedText}>
            أنت حظرت {otherName} — الإرسال مغلق ورسائله مخفية عنك.
          </Text>
          <Pressable onPress={confirmToggleBlock} style={styles.unblockQuickBtn}>
            <Text style={styles.unblockQuickText}>إلغاء الحظر</Text>
          </Pressable>
        </View>
      ) : blockedMe ? (
        <View style={styles.noticeBlocked}>
          <Lock size={16} color="#dc2626" />
          <Text style={styles.noticeBlockedText}>
            {otherName} حظرك — لا يمكنكما تبادل الرسائل.
          </Text>
        </View>
      ) : isMuted ? (
        <View style={styles.noticeMuted}>
          <BellOff size={14} color="#b45309" />
          <Text style={styles.noticeMutedText}>إشعارات هذه المحادثة مكتومة 🔕</Text>
        </View>
      ) : otherDnd ? (
        <View style={styles.noticeMuted}>
          <Moon size={14} color="#64748b" />
          <Text style={styles.noticeMutedText}>{otherName} في وضع عدم الإزعاج</Text>
        </View>
      ) : null}

      {isCleared && !blockedByMe && (
        <View style={styles.noticeInfo}>
          <Eraser size={13} color="#0369a1" />
          <Text style={styles.noticeInfoText}>مسحت هذه المحادثة من عندك — الرسائل الجديدة ستظهر فقط.</Text>
        </View>
      )}

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
              {otherUser?.avatar_url && !isAnonymous ? (
                <Image source={{ uri: otherUser.avatar_url }} style={styles.emptyConvAvatar} />
              ) : (
                <View style={styles.emptyConvAvatarFallback}>
                  <Text style={styles.emptyConvAvatarLetter}>{otherName[0]}</Text>
                </View>
              )}
            </View>
            <Text style={styles.emptyConvName}>{otherName}</Text>
            {otherUser?.bio && !isAnonymous && <Text style={styles.emptyConvBio}>{otherUser.bio}</Text>}
            <Text style={styles.emptyConvHint}>
              {blockedByMe
                ? 'المحادثة مغلقة بسبب الحظر'
                : isCleared
                ? 'ابدأ محادثة جديدة — سترى رسائلك الجديدة فقط'
                : 'ابدأ محادثتك مع جارك بالحي 👋'}
            </Text>
          </View>
        ) : (
          messages.map((msg, index) => {
            const isMine = msg.sender_id === currentUserId;
            const isRead =
              isMine && (msg.read_by || []).filter((uid: string) => uid !== currentUserId).length > 0;
            const prevMsg = index > 0 ? messages[index - 1] : null;
            const showDate =
              !prevMsg || !isSameDay(new Date(msg.created_at), new Date(prevMsg.created_at));

            return (
              <View key={msg.id}>
                {showDate && <Text style={styles.dateDivider}>{formatDateLabel(msg.created_at)}</Text>}
                <View style={[styles.msgRow, isMine && styles.msgRowMine]}>
                  {!isMine && (
                    <View style={styles.otherAvatar}>
                      {otherUser?.avatar_url && !isAnonymous ? (
                        <Image source={{ uri: otherUser.avatar_url }} style={styles.otherAvatarImg} />
                      ) : (
                        <View style={styles.otherAvatarFallback}>
                          <Text style={styles.otherAvatarLetter}>{otherName[0]}</Text>
                        </View>
                      )}
                    </View>
                  )}
                  <View style={[styles.msgBubble, isMine ? styles.msgBubbleMine : styles.msgBubbleOther]}>
                    {(() => { const media = parseImageMessage(msg.body); return media ? <View><Image source={{ uri: media.url }} style={styles.messageImage} /><Text style={[styles.imageCaption, isMine && styles.msgTextMine]}>{media.name}</Text></View> : <Text style={[styles.msgText, isMine && styles.msgTextMine]}>{msg.body}</Text>; })()}
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

      {anyBlock ? (
        <View style={styles.blockedInputArea}>
          <Text style={styles.blockedInputText}>
            {blockedByMe
              ? 'لا يمكنك الإرسال لأنك حظرت هذا المستخدم'
              : 'هذا المستخدم حظرك، الإرسال متوقف'}
          </Text>
          {blockedByMe && (
            <Pressable style={styles.unblockActionBtn} onPress={confirmToggleBlock}>
              <Text style={styles.unblockActionBtnText}>إلغاء الحظر للمراسلة</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <View style={styles.composerWrap}>
          {stickersOpen && <View style={styles.stickerPanel}><Text style={styles.stickerTitle}>ملصقات وإيموجي</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stickerRow}>{['😀','😂','😍','🥰','😘','😎','🤍','❤️','💚','👏','🙌','🙏','🔥','✨','🎉','👍','💯','🌹','☕','🍕','🏠','🌙','☀️','🤣','🥹','🤝','💪','🎁','⭐'].map((emoji, i) => <Pressable key={i} style={styles.stickerItem} onPress={() => { handleBodyChange(body + emoji); setStickersOpen(false); }}><Text style={styles.stickerEmoji}>{emoji}</Text></Pressable>)}</ScrollView></View>}
        <View style={styles.inputArea}>
          <Pressable style={styles.emojiButton} onPress={() => setStickersOpen(v => !v)}>
            <Smile size={21} color="#64748b" />
          </Pressable>

          <Pressable style={styles.attachButton} onPress={pickImages}>
            <Paperclip size={20} color="#64748b" />
          </Pressable>

          <Pressable
            style={[styles.sendButton, !body.trim() && styles.sendButtonDisabled]}
            onPress={send}
            disabled={!body.trim() || sending}
          >
            {uploadingMedia ? <ActivityIndicator size="small" color="#fff" /> : sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Send size={18} color="#fff" style={{ transform: [{ rotate: '180deg' }] }} />
            )}
          </Pressable>

          <TextInput
            style={styles.textInput}
            value={body}
            onChangeText={handleBodyChange}
            placeholder="اكتب رسالة لجيرانك..."
            placeholderTextColor="#9ca3af"
            multiline
            maxLength={1000}
          />
        </View>
        </View>
      )}

      {/* Options menu */}
      <Modal visible={optionsOpen} transparent animationType="fade" onRequestClose={() => setOptionsOpen(false)}>
        <Pressable style={styles.optionsOverlay} onPress={() => setOptionsOpen(false)}>
          <View style={styles.optionsSheet}>
            <View style={styles.optionsHeader}>
              <Pressable onPress={() => setOptionsOpen(false)} style={styles.optionsClose}>
                <X size={18} color="#64748b" />
              </Pressable>
              <Text style={styles.optionsTitle} numberOfLines={1}>
                {otherName}
              </Text>
            </View>

            <Pressable style={styles.optionRow} onPress={toggleMute}>
              {isMuted ? <Bell size={18} color="#059669" /> : <BellOff size={18} color="#d97706" />}
              <View style={{ flex: 1 }}>
                <Text style={styles.optionRowText}>
                  {isMuted ? 'إلغاء كتم إشعارات المحادثة 🔔' : 'كتم المحادثة 🔕'}
                </Text>
                <Text style={styles.optionRowSub}>يوقف التنبيهات لهذه المحادثة فقط</Text>
              </View>
            </Pressable>

            <Pressable style={styles.optionRow} onPress={toggleMyDnd}>
              <Moon size={18} color="#d97706" />
              <View style={{ flex: 1 }}>
                <Text style={styles.optionRowText}>
                  {dndActive ? 'إلغاء عدم الإزعاج العام' : 'تفعيل عدم الإزعاج العام 🌙'}
                </Text>
                <Text style={styles.optionRowSub}>يصمت كل الإشعارات الواردة من كل المحادثات</Text>
              </View>
            </Pressable>

            {otherUser && (
              <Pressable
                style={styles.optionRow}
                onPress={() => {
                  setOptionsOpen(false);
                  router.push({ pathname: '/user', params: { id: otherUser.id } });
                }}
              >
                <User size={18} color="#059669" />
                <Text style={styles.optionRowText}>عرض الملف الشخصي 👤</Text>
              </Pressable>
            )}

            <Pressable style={styles.optionRow} onPress={confirmToggleBlock}>
              {blockedByMe ? <UserCheck size={18} color="#059669" /> : <UserX size={18} color="#dc2626" />}
              <Text style={[styles.optionRowText, !blockedByMe && { color: '#dc2626' }]}>
                {blockedByMe ? 'إلغاء حظر هذا المستخدم' : 'حظر هذا المستخدم 🚫'}
              </Text>
            </Pressable>

            <Pressable style={styles.optionRow} onPress={openClearOptions}>
              <Eraser size={18} color="#64748b" />
              <View style={{ flex: 1 }}>
                <Text style={styles.optionRowText}>مسح المحادثة 🧹</Text>
                <Text style={styles.optionRowSub}>اختر: من عندك فقط أو حذف للجميع</Text>
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Clear / delete chooser */}
      <Modal visible={confirmClear} transparent animationType="fade" onRequestClose={() => setConfirmClear(false)}>
        <Pressable style={styles.optionsOverlay} onPress={() => setConfirmClear(false)}>
          <View style={styles.optionsSheet}>
            <View style={styles.optionsHeader}>
              <Pressable onPress={() => setConfirmClear(false)} style={styles.optionsClose}>
                <X size={18} color="#64748b" />
              </Pressable>
              <Text style={styles.optionsTitle}>مسح المحادثة</Text>
            </View>

            <Pressable style={styles.choiceCard} onPress={doClearMine}>
              <Eraser size={20} color="#0369a1" />
              <View style={{ flex: 1 }}>
                <Text style={styles.choiceTitle}>مسح المحادثة عندي 🧹</Text>
                <Text style={styles.choiceSub}>
                  تختفي كل الرسائل من شاشتك فقط. يحتفظ {otherName} بنسخته كاملة.
                </Text>
              </View>
            </Pressable>

            <Pressable
              style={[styles.choiceCard, styles.choiceCardDanger, { borderBottomWidth: 0 }]}
              onPress={doDeleteForEveryone}
            >
              <Trash2 size={20} color="#dc2626" />
              <View style={{ flex: 1 }}>
                <Text style={[styles.choiceTitle, { color: '#dc2626' }]}>حذف المحادثة للجميع ⚠️</Text>
                <Text style={styles.choiceSub}>
                  حذف نهائي للمحادثة وكل رسائلها، وتختفي أيضاً من عند {otherName}.
                </Text>
              </View>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function isSameDay(d1: Date, d2: Date) {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
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
  container: { flex: 1, minHeight: Platform.OS === 'web' ? '100vh' : undefined, width: '100%', alignSelf: 'stretch', backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
    paddingBottom: 14,
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
    borderBottomColor: 'transparent',
  },
  backBtn: { padding: 6 },
  headerUser: { flexDirection: 'row-reverse', alignItems: 'center', flex: 1, marginRight: 10, gap: 10 },
  headerAvatar: { width: 42, height: 42, borderRadius: 21 },
  headerAvatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarLetter: { color: '#fff', fontSize: 16, fontWeight: '900' },
  headerInfo: { alignItems: 'flex-end', flex: 1 },
  headerNameRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  headerName: { color: '#fff', fontSize: 16, fontWeight: '900' },
  headerCity: { color: 'rgba(255,255,255,0.78)', fontSize: 11, fontWeight: '600', marginTop: 2 },
  headerStatusPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.14)',
    marginLeft: 6,
  },
  headerStatusText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  headerActions: { flexDirection: 'row-reverse' },
  headerActionBtn: { padding: 6 },

  noticeBlocked: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderBottomWidth: 1,
    borderColor: '#fca5a5',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  noticeBlockedText: {
    flex: 1,
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
    marginRight: 6,
  },
  unblockQuickBtn: { backgroundColor: '#dc2626', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  unblockQuickText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  noticeMuted: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fffbeb',
    borderBottomWidth: 1,
    borderColor: '#fde68a',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  noticeMutedText: { color: '#b45309', fontSize: 11, fontWeight: '700' },
  noticeInfo: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0f9ff',
    borderBottomWidth: 1,
    borderColor: '#bae6fd',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  noticeInfoText: { color: '#0369a1', fontSize: 11, fontWeight: '700' },

  messagesList: { flex: 1, width: '100%', backgroundColor: '#f8fafc' },
  messagesContent: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 12, minHeight: '100%' },
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
  msgRow: { flexDirection: 'row-reverse', alignItems: 'flex-end', marginBottom: 8 },
  msgRowMine: { flexDirection: 'row' },
  otherAvatar: { marginRight: 8 },
  otherAvatarImg: { width: 28, height: 28, borderRadius: 14 },
  otherAvatarFallback: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  otherAvatarLetter: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  msgBubble: { maxWidth: Platform.OS === 'web' ? 620 : '82%', borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9 },
  msgBubbleMine: { backgroundColor: '#059669', borderBottomLeftRadius: 4, shadowColor: '#064e3b', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.10, shadowRadius: 6, elevation: 2 },
  msgBubbleOther: {
    backgroundColor: '#fff',
    shadowColor: '#0f172a', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 5, elevation: 1,
    borderBottomRightRadius: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  msgText: { fontSize: 14, lineHeight: 20, color: '#0f172a', textAlign: 'right' },
  msgTextMine: { color: '#fff' },
  msgMeta: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'flex-start', marginTop: 3 },
  msgMetaMine: { justifyContent: 'flex-end' },
  msgTime: { fontSize: 10, color: '#94a3b8' },
  msgTimeMine: { color: 'rgba(255,255,255,0.7)' },

  emptyConv: { alignItems: 'center', paddingVertical: 50 },
  emptyConvIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyConvAvatar: { width: 72, height: 72, borderRadius: 36 },
  emptyConvAvatarFallback: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyConvAvatarLetter: { fontSize: 26, fontWeight: '900', color: '#059669' },
  emptyConvName: { fontSize: 18, fontWeight: '900', color: '#0f172a', marginBottom: 4 },
  emptyConvBio: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    marginHorizontal: 32,
    marginBottom: 10,
  },
  emptyConvHint: { fontSize: 12, color: '#059669', fontWeight: '700' },

  composerWrap: { borderTopWidth: 1, borderTopColor: '#e2e8f0', backgroundColor: '#fff', paddingTop: 8, paddingBottom: Platform.OS === 'ios' ? 8 : 6 },
  stickerPanel: { paddingTop: 10, paddingBottom: 8, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  stickerTitle: { textAlign: 'right', paddingHorizontal: 14, color: '#334155', fontSize: 12, fontWeight: '800', marginBottom: 6 },
  stickerRow: { flexDirection: 'row', paddingHorizontal: 10, gap: 5 },
  stickerItem: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  stickerEmoji: { fontSize: 25 },
  messageImage: { width: 230, height: 230, borderRadius: 14, marginBottom: 4 },
  imageCaption: { fontSize: 9, color: '#64748b' },
  inputArea: {
    width: '100%',
    flexDirection: 'row-reverse',
    minHeight: 62,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderTopWidth: 0,
    borderTopColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    paddingBottom: Platform.OS === 'ios' ? 10 : 8,
  },
  emojiButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#d1fae5' },
  attachButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  textInput: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    color: '#0f172a',
    maxHeight: 100,
    textAlign: 'right',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 20,
    backgroundColor: '#059669',
    borderWidth: 2,
    borderColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: { opacity: 0.35 },
  blockedInputArea: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderColor: '#fca5a5',
    padding: 16,
    alignItems: 'center',
    gap: 10,
  },
  blockedInputText: { color: '#dc2626', fontSize: 13, fontWeight: '700', textAlign: 'center' },
  unblockActionBtn: { backgroundColor: '#dc2626', paddingHorizontal: 20, paddingVertical: 9, borderRadius: 12 },
  unblockActionBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  optionsOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  optionsSheet: {
    width: '92%',
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
    marginBottom: 10,
    borderBottomWidth: 1,
    borderColor: '#f1f5f9',
    paddingBottom: 10,
  },
  optionsTitle: { fontSize: 16, fontWeight: '900', color: '#0f172a', flex: 1, textAlign: 'right' },
  optionsClose: { padding: 4 },
  optionRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: '#f8fafc',
  },
  optionRowText: { fontSize: 14, fontWeight: '800', color: '#334155', textAlign: 'right' },
  optionRowSub: { fontSize: 11, color: '#94a3b8', marginTop: 2, fontWeight: '600' },
  choiceCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    marginTop: 10,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#bae6fd',
    backgroundColor: '#f0f9ff',
  },
  choiceCardDanger: { borderColor: '#fecaca', backgroundColor: '#fef2f2' },
  choiceTitle: { fontSize: 14, fontWeight: '900', color: '#0f172a', textAlign: 'right' },
  choiceSub: { fontSize: 11, color: '#64748b', marginTop: 3, lineHeight: 16 },
});
