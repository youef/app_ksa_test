import { useEffect, useState, useRef, useCallback } from 'react';
import {
  ScrollView,
  View,
  KeyboardAvoidingView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { getCurrentDeviceLocation, reverseGeocodeDeviceLocation } from '@/lib/deviceLocation';

import { chatStyles as styles } from '@/components/chat/chatStyles';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { EmptyChatState } from '@/components/chat/EmptyChatState';
import { MessageBubble, MessageItem } from '@/components/chat/MessageBubble';
import { ChatInputBar } from '@/components/chat/ChatInputBar';
import { ChatModals } from '@/components/chat/ChatModals';
import { sendPushToUser } from '@/lib/pushSender';

export default function Conversation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [messages, setMessages] = useState<MessageItem[]>([]);
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
  const [sharingLocation, setSharingLocation] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [myProfile, setMyProfile] = useState<any>(null);
  const [appreciationModalOpen, setAppreciationModalOpen] = useState(false);
  const [appreciationNote, setAppreciationNote] = useState('كفو يا جارنا، بيض الله وجهك 🤍');
  const [sendingAppreciation, setSendingAppreciation] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const convId = Array.isArray(id) ? id[0] : (id as string);
  const insets = useSafeAreaInsets();
  const bottomSafe = Math.max(insets.bottom, 10);
  const otherName = displayName(otherUser, 'المحادثة');
  const isAnonymous = otherUser?.hide_name === true;
  const anyBlock = blockedByMe || blockedMe;

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return router.replace('/auth');
    setCurrentUserId(u.user.id);

    const { data: myProf } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', u.user.id)
      .maybeSingle();
    setMyProfile(myProf);

    // 1. Messages
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

    // 2. Other member + profile
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

    // 3. My settings
    const settings = await loadConvSettings(u.user.id, [convId]);
    const mine = settings[convId];
    setIsMuted(!!mine?.muted);
    setIsCleared(!!mine?.clearedAt);

    // 4. DND state
    const mine_dnd = await loadDnd(u.user.id);
    setDndActive(isDndActiveNow(mine_dnd));
    await syncDndWithNotifications(u.user.id);

    // 5. Blocks in both directions
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

    // 6. Mark read
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
        .channel('chat-' + convId + '-' + userId + '-' + Math.random().toString(36).slice(2), {
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
            const newMsg = payload.new as unknown as MessageItem;
            setMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev;
              if (newMsg.sender_id === userId) {
                const optimisticIndex = prev.findIndex(
                  m =>
                    String(m.id).startsWith('optimistic-') &&
                    m.sender_id === userId &&
                    m.body === newMsg.body &&
                    Math.abs(new Date(m.created_at).getTime() - new Date(newMsg.created_at).getTime()) < 10000
                );
                if (optimisticIndex >= 0) {
                  const next = [...prev];
                  next[optimisticIndex] = newMsg;
                  return next;
                }
              }
              return [...prev, newMsg];
            });
            setOtherTyping(false);
            requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
            if (newMsg.sender_id !== userId) {
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
            const updatedMsg = payload.new as unknown as MessageItem;
            setMessages(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
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
          body: JSON.stringify({ type: 'image', url: urlData.publicUrl, name: 'صورة' }),
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

  async function sendAppreciation(noteToSend?: string) {
    if (sendingAppreciation || !otherUser) return;
    if (anyBlock) {
      return Alert.alert('غير مسموح', 'لا يمكن إرسال بطاقات تقدير أثناء الحظر.');
    }

    setSendingAppreciation(true);
    const finalNote = (noteToSend || appreciationNote || 'كفو يا جارنا، بيض الله وجهك 🤍').trim();
    const pts = 10;

    try {
      const { error: rpcErr } = await supabase.rpc('send_neighbor_appreciation', {
        p_conversation_id: convId,
        p_recipient_id: otherUser.id,
        p_note: finalNote,
      });

      if (rpcErr) {
        const senderName = displayName(myProfile) || 'جارك';
        const payload = JSON.stringify({
          type: 'appreciation',
          title: '☕ بطاقة شكر وقهوة الجيران',
          note: finalNote,
          points: pts,
          giver_name: senderName,
        });

        const { error: msgErr } = await supabase.from('messages').insert({
          conversation_id: convId,
          sender_id: currentUserId,
          body: payload,
          read_by: [currentUserId],
        });
        if (msgErr) throw msgErr;

        try {
          const { data: curRep } = await supabase
            .from('reputation')
            .select('points')
            .eq('user_id', otherUser.id)
            .maybeSingle();
          const nextPts = (curRep?.points || 0) + pts;
          await supabase.from('reputation').upsert({
            user_id: otherUser.id,
            points: nextPts,
            updated_at: new Date().toISOString(),
          });
        } catch {}
      }

      if (otherUser?.id && !otherDnd) {
        const senderName = displayName(myProfile) || 'جارك';
        void sendPushToUser(otherUser.id, {
          title: `☕ أهداك ${senderName} بطاقة شكر وقهوة!`,
          body: finalNote,
          data: { url: `/conversation?id=${convId}` },
        });
      }

      setAppreciationModalOpen(false);
      Alert.alert(
        'تم الإهداء بنجاح ☕',
        `أرسلت بطاقة شكر وقهوة لـ ${otherName}، وتمت إضافة +10 نقاط لسمعته ⭐`
      );
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e: any) {
      Alert.alert('تعذّر الإرسال', e?.message || 'حدث خطأ أثناء إرسال بطاقة التقدير.');
    } finally {
      setSendingAppreciation(false);
    }
  }

  async function shareExactLocation() {
    if (sharingLocation) return;
    if (anyBlock) {
      return Alert.alert(
        'غير مسموح',
        blockedByMe
          ? 'قم بإلغاء حظر هذا المستخدم أولاً لتتمكن من مشاركة الموقع.'
          : 'هذا المستخدم حظرك. لا يمكنك مشاركة موقعك معه.'
      );
    }

    setSharingLocation(true);
    try {
      const location = await getCurrentDeviceLocation();
      if (!location) {
        Alert.alert('تعذّر تحديد الموقع', 'اسمح للتطبيق بالوصول إلى الموقع ثم أعد المحاولة.');
        return;
      }
      const place = await reverseGeocodeDeviceLocation(location);
      const label = place?.district || place?.city || 'موقعي الحالي';
      const { error } = await supabase.from('messages').insert({
        conversation_id: convId,
        sender_id: currentUserId,
        body: JSON.stringify({
          type: 'location',
          lat: location.latitude,
          lng: location.longitude,
          label,
        }),
        read_by: [currentUserId],
      });
      if (error) throw error;

      if (otherUser?.id && !otherDnd) {
        const senderName = displayName(myProfile) || 'جارك';
        void sendPushToUser(otherUser.id, {
          title: `📍 شاركك ${senderName} موقعه`,
          body: label,
          data: { url: `/conversation?id=${convId}` },
        });
      }

      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    } catch (e: any) {
      Alert.alert('تعذّر إرسال الموقع', e?.message || 'حدث خطأ أثناء إرسال الموقع');
    } finally {
      setSharingLocation(false);
    }
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
    const optimisticMessage: MessageItem = {
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

    if (otherUser?.id && !otherDnd) {
      const senderName = displayName(myProfile) || 'جارك بالحي';
      void sendPushToUser(otherUser.id, {
        title: `رسالة من ${senderName}`,
        body: trimmed,
        data: { url: `/conversation?id=${convId}` },
      });
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ChatHeader
        otherUser={otherUser}
        otherName={otherName}
        isAnonymous={isAnonymous}
        isMuted={isMuted}
        isOnline={isOnline}
        otherTyping={otherTyping}
        blockedByMe={blockedByMe}
        blockedMe={blockedMe}
        onBackPress={() => router.replace('/messages')}
        onUserPress={() => otherUser && router.push({ pathname: '/user', params: { id: otherUser.id } })}
        onOptionsPress={() => setOptionsOpen(true)}
        onUnblockPress={confirmToggleBlock}
      />

      <ScrollView
        ref={scrollRef}
        style={styles.messagesList}
        contentContainerStyle={[styles.messagesContent, { paddingBottom: 24 }]}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        {messages.length === 0 ? (
          <EmptyChatState
            otherUser={otherUser}
            otherName={otherName}
            isAnonymous={isAnonymous}
            blockedByMe={blockedByMe}
            isCleared={isCleared}
          />
        ) : (
          messages.map((msg, index) => (
            <MessageBubble
              key={msg.id}
              msg={msg}
              prevMsg={index > 0 ? messages[index - 1] : undefined}
              currentUserId={currentUserId}
              otherUser={otherUser}
              otherName={otherName}
              isAnonymous={isAnonymous}
              onPreviewImage={url => setPreviewImageUrl(url)}
            />
          ))
        )}
        <View style={{ height: 16 }} />
      </ScrollView>

      <ChatInputBar
        body={body}
        onBodyChange={handleBodyChange}
        sending={sending}
        uploadingMedia={uploadingMedia}
        sharingLocation={sharingLocation}
        stickersOpen={stickersOpen}
        onToggleStickers={() => setStickersOpen(v => !v)}
        onCloseStickers={() => setStickersOpen(false)}
        anyBlock={anyBlock}
        blockedByMe={blockedByMe}
        onUnblock={confirmToggleBlock}
        onSend={send}
        onPickImages={pickImages}
        onShareLocation={shareExactLocation}
        onOpenAppreciation={() => setAppreciationModalOpen(true)}
        bottomSafe={bottomSafe}
      />

      <ChatModals
        optionsOpen={optionsOpen}
        onCloseOptions={() => setOptionsOpen(false)}
        otherName={otherName}
        otherUser={otherUser}
        isMuted={isMuted}
        onToggleMute={toggleMute}
        dndActive={dndActive}
        onToggleMyDnd={toggleMyDnd}
        onViewProfile={() => {
          setOptionsOpen(false);
          if (otherUser) router.push({ pathname: '/user', params: { id: otherUser.id } });
        }}
        blockedByMe={blockedByMe}
        onToggleBlock={confirmToggleBlock}
        onOpenClear={() => {
          setOptionsOpen(false);
          setConfirmClear(true);
        }}
        confirmClear={confirmClear}
        onCloseConfirmClear={() => setConfirmClear(false)}
        onClearMine={doClearMine}
        onDeleteForEveryone={doDeleteForEveryone}
        previewImageUrl={previewImageUrl}
        onClosePreviewImage={() => setPreviewImageUrl(null)}
        appreciationModalOpen={appreciationModalOpen}
        onCloseAppreciation={() => setAppreciationModalOpen(false)}
        appreciationNote={appreciationNote}
        onChangeAppreciationNote={setAppreciationNote}
        onSendAppreciation={sendAppreciation}
        sendingAppreciation={sendingAppreciation}
      />
    </KeyboardAvoidingView>
  );
}
