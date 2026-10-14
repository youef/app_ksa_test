import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Share, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { addLiveBlock, endLiveStream, getLiveToken, reportLiveStream, requestLiveGuest, sendLiveMessage, type LiveChatMessage, type LiveStream } from '@/lib/lives';
import LiveMedia from '@/components/lives/LiveMedia';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Eye, EyeOff, Gift, Heart, MessageCircle, Mic, MoreHorizontal, Radio, Send, Share2, ShieldAlert, UserPlus, Users, X } from 'lucide-react-native';

type Role = 'host' | 'viewer' | 'guest';
type GuestRequest = { id: string; guest_id: string; stream_id: string; status: string; profiles?: { display_name: string | null; username: string | null; avatar_url: string | null } | null };

export default function LiveRoomScreen() {
  const { id, role: roleParam } = useLocalSearchParams<{ id: string; role?: string }>();
  const insets = useSafeAreaInsets();
  const [stream, setStream] = useState<LiveStream | null>(null);
  const [roomUrl, setRoomUrl] = useState('');
  const [token, setToken] = useState('');
  const [currentUser, setCurrentUser] = useState('');
  const [role, setRole] = useState<Role>(roleParam === 'host' ? 'host' : 'viewer');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sending, setSending] = useState(false);
  const [viewerCount, setViewerCount] = useState(0);
  const [pendingRequests, setPendingRequests] = useState<GuestRequest[]>([]);
  const [guestState, setGuestState] = useState<'idle' | 'pending' | 'accepted'>('idle');
  const [hearts, setHearts] = useState<{ id: string; emoji: string }[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [connected, setConnected] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showTopBar, setShowTopBar] = useState(true);
  const [showInfoPanel, setShowInfoPanel] = useState(true);
  const [showChat, setShowChat] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [giftBursts, setGiftBursts] = useState<{ id: string; emoji: string; x: number; y: number }[]>([]);
  const scrollRef = useRef<ScrollView>(null);
  const heartChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const mediaRole = role === 'host' || role === 'guest';

  const loadRoom = useCallback(async () => {
    if (!id) return;
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { router.replace('/auth'); return; }
      setCurrentUser(auth.user.id);
      const { data: live, error: streamError } = await supabase.from('live_streams')
        .select('id,host_id,title,category,audience,room_name,status,viewer_count,peak_viewer_count,started_at,updated_at,profiles!live_streams_host_id_fkey(id,display_name,username,avatar_url,is_verified,city,district)')
        .eq('id', id).maybeSingle();
      if (streamError) throw streamError;
      if (!live) throw new Error('تعذر العثور على هذا البث.');
      const typed = live as unknown as LiveStream;
      setStream(typed);
      if (typed.status !== 'live') throw new Error('انتهى هذا البث.');
      if (typed.host_id !== auth.user.id && Date.now() - new Date(typed.updated_at || typed.started_at).getTime() > 90_000) {
        throw new Error('انقطع اتصال المضيف وانتهى البث.');
      }
      const initialRole: Role = typed.host_id === auth.user.id ? 'host' : roleParam === 'guest' ? 'guest' : 'viewer';
      setRole(initialRole);
      if (initialRole !== 'host') {
        const { data: follow } = await supabase.from('follows').select('id')
          .eq('follower_id', auth.user.id).eq('following_id', typed.host_id).maybeSingle();
        setIsFollowing(Boolean(follow));
      }
      const credential = await getLiveToken(typed.id, initialRole);
      setRoomUrl(credential.url);
      setToken(credential.token);
      await loadMessages(typed.id);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'تعذر فتح البث.';
      setError(message);
      if (roleParam === 'host' && id) {
        // A stream row is created before requesting a media token. Close it if the host cannot enter.
        await endLiveStream(id).catch(() => {});
      }
    } finally {
      setLoading(false);
    }
  }, [id, roleParam]);

  async function loadMessages(streamId: string) {
    const { data, error: chatError } = await supabase.from('live_chat_messages')
      .select('id,stream_id,sender_id,body,created_at,profiles!live_chat_messages_sender_id_fkey(display_name,username,avatar_url)')
      .eq('stream_id', streamId).eq('is_hidden', false).order('created_at', { ascending: false }).limit(35);
    if (chatError) throw chatError;
    setMessages(((data || []).reverse()) as unknown as LiveChatMessage[]);
  }

  useEffect(() => { void loadRoom(); }, [loadRoom]);

  useEffect(() => {
    if (!id || loading || error) return;
    const chatChannel = supabase.channel(`live-chat:${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'live_chat_messages', filter: `stream_id=eq.${id}` }, () => { void loadMessages(id); })
      .subscribe();
    const streamChannel = supabase.channel(`live-state:${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'live_streams', filter: `id=eq.${id}` }, (payload) => {
        if ((payload.new as any)?.status === 'ended') setError('أنهى المضيف هذا البث.');
      })
      .subscribe();

    const poll = setInterval(() => {
      void (async () => {
        const { count } = await supabase.from('live_viewer_sessions').select('viewer_id', { count: 'exact', head: true })
          .eq('stream_id', id).gt('last_seen_at', new Date(Date.now() - 45_000).toISOString());
        setViewerCount((count || 0) + (role === 'host' ? 1 : 0));
        if (role === 'host') {
          const { data } = await supabase.from('live_guest_requests')
            .select('id,guest_id,stream_id,status,profiles!live_guest_requests_guest_id_fkey(display_name,username,avatar_url)')
            .eq('stream_id', id).eq('status', 'pending').order('created_at', { ascending: true });
          setPendingRequests((data || []) as unknown as GuestRequest[]);
        } else if (role === 'viewer' && guestState === 'pending') {
          const { data } = await supabase.from('live_guest_requests').select('status')
            .eq('stream_id', id).eq('guest_id', currentUser).maybeSingle();
          if (data?.status === 'accepted') {
            setRole('guest');
            setGuestState('accepted');
            const credential = await getLiveToken(id, 'guest');
            setRoomUrl(credential.url);
            setToken(credential.token);
          } else if (data?.status === 'rejected' || data?.status === 'removed') setGuestState('idle');
        }
      })();
    }, 2500);

    const presenceChannel = supabase.channel(`live-hearts:${id}`)
      .on('broadcast', { event: 'heart' }, ({ payload }) => {
        const entry = { id: `${Date.now()}-${Math.random()}`, emoji: typeof payload?.emoji === 'string' ? payload.emoji : '💚' };
        setHearts((items) => [...items.slice(-5), entry]);
        setTimeout(() => setHearts((items) => items.filter((heart) => heart.id !== entry.id)), 2400);
      })
      .subscribe();
    heartChannelRef.current = presenceChannel;

    const heartbeat = async () => {
      if (!currentUser) return;
      if (role === 'host') {
        await supabase.from('live_streams').update({ updated_at: new Date().toISOString() })
          .eq('id', id).eq('host_id', currentUser).eq('status', 'live');
        return;
      }
      await supabase.from('live_viewer_sessions').upsert({ stream_id: id, viewer_id: currentUser, last_seen_at: new Date().toISOString() }, { onConflict: 'stream_id,viewer_id' });
    };
    void heartbeat();
    const heartbeatTimer = setInterval(() => { void heartbeat(); }, 20_000);
    const elapsedTimer = setInterval(() => {
      if (stream?.started_at) setElapsed(Math.max(0, Math.floor((Date.now() - new Date(stream.started_at).getTime()) / 1000)));
    }, 1000);

    return () => {
      clearInterval(poll); clearInterval(heartbeatTimer); clearInterval(elapsedTimer);
      heartChannelRef.current = null;
      void supabase.from('live_viewer_sessions').delete().eq('stream_id', id).eq('viewer_id', currentUser);
      void supabase.removeChannel(chatChannel); void supabase.removeChannel(streamChannel); void supabase.removeChannel(presenceChannel);
    };
  }, [id, loading, error, role, guestState, currentUser, stream?.started_at]);

  async function sendMessage() {
    const body = chatInput.trim();
    if (!body || sending || !id) return;
    setSending(true);
    try { await sendLiveMessage(id, body.slice(0, 300)); setChatInput(''); }
    catch (e) { Alert.alert('تعذر إرسال التعليق', e instanceof Error ? e.message : 'حاول مرة أخرى.'); }
    finally { setSending(false); }
  }

  async function requestGuestSeat() {
    if (!id) return;
    try { await requestLiveGuest(id); setGuestState('pending'); }
    catch (e) { Alert.alert('تعذر إرسال الطلب', e instanceof Error ? e.message : 'حاول مرة أخرى.'); }
  }

  async function decideGuest(request: GuestRequest, status: 'accepted' | 'rejected') {
    const { error: updateError } = await supabase.from('live_guest_requests')
      .update({ status, decided_at: new Date().toISOString() }).eq('id', request.id).eq('status', 'pending');
    if (updateError) Alert.alert('تعذر تحديث الطلب', updateError.message);
    else setPendingRequests((rows) => rows.filter((item) => item.id !== request.id));
  }

  function confirmEnd() {
    Alert.alert('إنهاء البث؟', 'سيُغلق بثك عن جميع المشاهدين.', [
      { text: 'متابعة البث', style: 'cancel' },
      { text: 'إنهاء البث', style: 'destructive', onPress: () => { void finishLive(); } },
    ]);
  }

  async function finishLive() {
    if (!id) return;
    try { await endLiveStream(id); }
    catch (e) { Alert.alert('تعذر إنهاء البث', e instanceof Error ? e.message : 'حاول مرة أخرى.'); return; }
    setError('انتهى بثك.');
    router.replace('/lives');
  }

  function showReport() {
    if (!id) return;
    Alert.alert('الإبلاغ عن البث', 'اختر سببًا للإبلاغ:', [
      { text: 'محتوى غير مناسب', onPress: () => void submitReport('محتوى غير مناسب') },
      { text: 'إساءة أو تنمّر', onPress: () => void submitReport('إساءة أو تنمّر') },
      { text: 'معلومات مضللة أو احتيال', onPress: () => void submitReport('معلومات مضللة أو احتيال') },
      { text: 'إلغاء', style: 'cancel' },
    ]);
  }

  async function submitReport(reason: string) {
    try { await reportLiveStream(id, reason); Alert.alert('تم استلام البلاغ', 'سيُراجع فريق حيّنا البث.'); }
    catch (e) { Alert.alert('تعذر إرسال البلاغ', e instanceof Error ? e.message : 'حاول مرة أخرى.'); }
  }

  function triggerGiftBurst(emoji: string) {
    const burst = Array.from({ length: 5 }, (_, index) => ({
      id: `${Date.now()}-${Math.random()}-${index}`,
      emoji,
      x: 14 + index * 14,
      y: 34 + index * 18,
    }));
    setGiftBursts((items) => [...items, ...burst]);
    setTimeout(() => {
      setGiftBursts((items) => items.filter((item) => !burst.some((entry) => entry.id === item.id)));
    }, 1700);
  }

  async function sendHeart() {
    const emoji = ['💚', '❤️', '👏', '✨'][Math.floor(Math.random() * 4)];
    setHearts((items) => [...items.slice(-5), { id: `${Date.now()}-${Math.random()}`, emoji }]);
    triggerGiftBurst(emoji);
    await heartChannelRef.current?.send({ type: 'broadcast', event: 'heart', payload: { emoji } });
  }

  async function sendGift() {
    const emoji = ['🎁', '💎', '🌟', '🔥'][Math.floor(Math.random() * 4)];
    setHearts((items) => [...items.slice(-5), { id: `${Date.now()}-${Math.random()}`, emoji }]);
    triggerGiftBurst(emoji);
    await heartChannelRef.current?.send({ type: 'broadcast', event: 'heart', payload: { emoji } });
  }

  function toggleOverlayMode() {
    const shouldShow = !(showTopBar && showInfoPanel && showChat && showControls);
    setShowTopBar(shouldShow);
    setShowInfoPanel(shouldShow);
    setShowChat(shouldShow);
    setShowControls(shouldShow);
  }

  async function toggleFollow() {
    if (!stream || role === 'host') return;
    const { data, error: followError } = await supabase.rpc('hayna_toggle_follow', { p_target: stream.host_id });
    if (followError) Alert.alert('تعذر تحديث المتابعة', followError.message);
    else setIsFollowing(data === true);
  }

  async function shareLive() {
    try { await Share.share({ title: 'بث مباشر في حيّنا', message: `انضم إلى بث ${hostName} في حيّنا: https://appksatest.vercel.app/live/${id}` }); }
    catch { /* The share sheet can be dismissed without action. */ }
  }

  function moderateMessage(message: LiveChatMessage) {
    if (role !== 'host' || !id) return;
    Alert.alert('إدارة التعليق', 'إخفاء هذا التعليق عن المشاهدين؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'إخفاء', style: 'destructive', onPress: () => {
        void supabase.from('live_chat_messages').update({ is_hidden: true }).eq('id', message.id)
          .then(({ error: hideError }) => { if (hideError) Alert.alert('تعذر إخفاء التعليق', hideError.message); else void loadMessages(id); });
      } },
    ]);
  }

  async function manageGuests() {
    const { data } = await supabase.from('live_guest_requests')
      .select('guest_id,profiles!live_guest_requests_guest_id_fkey(display_name,username)')
      .eq('stream_id', id).eq('status', 'accepted');
    const guests = (data || []) as any[];
    if (!guests.length) { Alert.alert('الضيوف', 'لا يوجد ضيف في البث الآن.'); return; }
    Alert.alert('إدارة الضيوف', 'يمكنك إزالة الضيف وحظره من هذا البث.', [
      ...guests.slice(0, 2).map((guest) => ({
        text: `إزالة ${guest.profiles?.display_name || guest.profiles?.username || 'الضيف'}`,
        style: 'destructive' as const,
        onPress: () => void addLiveBlock(id, stream!.host_id, guest.guest_id)
          .then(() => Alert.alert('تمت الإزالة', 'أُزيل الضيف وحُظر من هذا البث.'))
          .catch((e) => Alert.alert('تعذر إزالة الضيف', e instanceof Error ? e.message : 'حاول مرة أخرى.')),
      })),
      { text: 'إغلاق', style: 'cancel' },
    ]);
  }

  async function handleBack() {
    if (role === 'host' && stream?.status === 'live') { confirmEnd(); return; }
    if (router.canGoBack()) router.back(); else router.replace('/lives');
  }

  const duration = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
  const hostName = stream?.profiles?.display_name || stream?.profiles?.username || 'جارٍ';

  if (loading) return <View style={styles.loadingScreen}><StatusBar hidden /><ActivityIndicator size="large" color="#34d399" /><Text style={styles.loadingText}>جارٍ تجهيز البث…</Text></View>;
  if (error || !stream) return <View style={styles.errorScreen}><StatusBar hidden /><View style={styles.errorIcon}><Radio color="#fff" size={30} /></View><Text style={styles.errorTitle}>{error || 'تعذر فتح البث'}</Text><Text style={styles.errorHint}>تأكد من الاتصال بالإنترنت وحاول مرة أخرى.</Text><Pressable onPress={() => router.replace('/lives')} style={styles.returnButton}><Text style={styles.returnText}>العودة للبثوث</Text></Pressable></View>;

  return (
    <View style={styles.screen}>
      <StatusBar hidden />
      <View style={styles.stage}>
        <LiveMedia url={roomUrl} token={token} canPublish={mediaRole} onReady={() => setConnected(true)} onError={(message) => {
          setConnected(false);
          if (role === 'host' && id) void endLiveStream(id).finally(() => setError(message));
          else setError(message);
        }} />

        {showTopBar && (
          <View pointerEvents="box-none" style={[styles.topOverlay, { top: Math.max(insets.top, 12) }]}>
            <Pressable accessibilityLabel="إغلاق البث" onPress={() => void handleBack()} style={styles.roundButton}><X color="#fff" size={21} /></Pressable>
            <View style={styles.livePill}><View style={styles.redDot} /><Text style={styles.liveText}>مباشر</Text></View>
            <View style={styles.viewerPill}><Users color="#fff" size={14} /><Text style={styles.viewerCount}>{viewerCount}</Text></View>
          </View>
        )}

        {showInfoPanel && (
          <View pointerEvents="box-none" style={[styles.hostOverlay, { top: Math.max(insets.top, 12) + 52 }]}>
            <View style={styles.hostMeta}>
              {stream.profiles?.avatar_url ? <Image source={{ uri: stream.profiles.avatar_url }} style={styles.hostAvatar} /> : <View style={styles.hostAvatarFallback}><Text style={{ color: '#047857', fontWeight: '900' }}>ح</Text></View>}
              <View style={{ alignItems: 'flex-end', maxWidth: 175 }}><Text numberOfLines={1} style={styles.hostName}>{hostName}</Text><Text numberOfLines={1} style={styles.hostTitle}>{stream.title}</Text></View>
              {role !== 'host' && <Pressable onPress={() => void toggleFollow()} style={styles.followButton}><Text style={styles.followText}>{isFollowing ? 'تتابع' : 'متابعة +'}</Text></Pressable>}
            </View>
            {role === 'host' ? <Pressable onPress={confirmEnd} style={styles.endButton}><Text style={styles.endText}>إنهاء</Text></Pressable> : <Pressable onPress={showReport} style={styles.roundButton}><MoreHorizontal color="#fff" size={20} /></Pressable>}
          </View>
        )}

        <View pointerEvents="none" style={styles.heartsFloat}>{hearts.slice(-4).map((heart, index) => <Text key={heart.id} style={[styles.floatingHeart, { bottom: 35 + index * 36, opacity: 0.55 + (index * 0.1) }]}>{heart.emoji}</Text>)}</View>
        {giftBursts.map((item) => (
          <View key={item.id} pointerEvents="none" style={[styles.giftBurst, { left: item.x, bottom: 165 + item.y }]}>
            <Text style={styles.giftBurstText}>{item.emoji}</Text>
          </View>
        ))}

        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0} style={styles.bottomOverlay}>
          {showControls && role === 'host' && pendingRequests.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.requestRow}>
              {pendingRequests.map((request) => <View key={request.id} style={styles.requestCard}><Text style={styles.requestName}>{request.profiles?.display_name || request.profiles?.username || 'مستخدم'} يطلب الصعود</Text><Pressable onPress={() => void decideGuest(request, 'accepted')} style={styles.acceptButton}><Check color="#fff" size={15} /></Pressable><Pressable onPress={() => void decideGuest(request, 'rejected')} style={styles.rejectButton}><X color="#fff" size={15} /></Pressable></View>)}
            </ScrollView>
          )}

          {showChat && (
            <View style={styles.chatPanel}>
              <ScrollView ref={scrollRef} style={styles.messageList} contentContainerStyle={{ justifyContent: 'flex-end', paddingVertical: 5 }} showsVerticalScrollIndicator={false} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
                {messages.slice(-18).map((message) => <Pressable key={message.id} onLongPress={() => moderateMessage(message)} style={styles.messageRow}><Text style={styles.messageBody}><Text style={styles.messageName}>{message.profiles?.display_name || message.profiles?.username || 'جارٍ'} </Text>{message.body}</Text></Pressable>)}
                {messages.length === 0 && <Text style={styles.firstMessage}>كن أول من يحيّي {hostName} 👋</Text>}
              </ScrollView>
            </View>
          )}

          {showControls ? (
            <>
              <View style={[styles.actionRow, { paddingBottom: Math.max(insets.bottom, 10) }]}>
                <Pressable onPress={() => void sendHeart()} style={styles.actionButton}><Heart size={22} color="#fff" fill="#fb7185" /><Text style={styles.actionLabel}>تفاعل</Text></Pressable>
                <Pressable onPress={() => void sendGift()} style={styles.actionButton}><Gift size={21} color="#fff" /><Text style={styles.actionLabel}>هدية</Text></Pressable>
                <Pressable onPress={() => setShowChat((value) => !value)} style={styles.actionButton}><MessageCircle size={20} color="#fff" /><Text style={styles.actionLabel}>{showChat ? 'إخفاء' : 'التعليقات'}</Text></Pressable>
                <Pressable onPress={toggleOverlayMode} style={styles.actionButton}><EyeOff size={20} color="#fff" /><Text style={styles.actionLabel}>وضع</Text></Pressable>
                {role === 'host' ? (
                  <Pressable onPress={() => void manageGuests()} style={styles.actionButton}><Users size={21} color="#fff" /><Text style={styles.actionLabel}>الضيوف</Text></Pressable>
                ) : role === 'viewer' ? (
                  <Pressable disabled={guestState !== 'idle'} onPress={() => void requestGuestSeat()} style={[styles.actionButton, guestState !== 'idle' && { opacity: 0.7 }]}><UserPlus size={21} color="#fff" /><Text style={styles.actionLabel}>{guestState === 'pending' ? 'بانتظار المضيف' : 'اطلب الصعود'}</Text></Pressable>
                ) : <View style={styles.guestBadge}><Mic size={15} color="#fff" /><Text style={styles.actionLabel}>أنت ضيف</Text></View>}
                {role !== 'host' && <Pressable onPress={showReport} style={styles.actionButton}><ShieldAlert size={20} color="#fff" /><Text style={styles.actionLabel}>إبلاغ</Text></Pressable>}
                <Pressable onPress={() => void shareLive()} style={styles.actionButton}><Share2 size={19} color="#fff" /><Text style={styles.actionLabel}>مشاركة</Text></Pressable>
                <View style={styles.durationPill}><Text style={styles.durationText}>{duration}</Text></View>
              </View>

              <View style={[styles.inputBar, { marginBottom: Math.max(insets.bottom, 8) }]}>
                <Pressable onPress={() => void sendMessage()} disabled={!chatInput.trim() || sending} style={[styles.sendButton, (!chatInput.trim() || sending) && { opacity: 0.5 }]}><Send color="#fff" size={16} /></Pressable>
                <TextInput value={chatInput} onChangeText={setChatInput} placeholder="أضف تعليقًا…" placeholderTextColor="#cbd5e1" maxLength={300} style={styles.chatInput} returnKeyType="send" onSubmitEditing={() => void sendMessage()} />
                <View style={styles.commentIcon}><MessageCircle size={18} color="#fff" /></View>
              </View>
            </>
          ) : (
            <Pressable onPress={() => setShowControls(true)} style={styles.quickReveal}>
              <Eye size={16} color="#fff" /><Text style={styles.quickRevealText}>إظهار لوحة التحكم</Text>
            </Pressable>
          )}
        </KeyboardAvoidingView>
        {!connected && <View pointerEvents="none" style={styles.connectingPill}><ActivityIndicator color="#fff" size="small" /><Text style={styles.connectingText}>جارٍ الاتصال…</Text></View>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#020617' }, stage: { flex: 1, backgroundColor: '#020617' },
  topOverlay: { position: 'absolute', left: 14, right: 14, zIndex: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roundButton: { width: 38, height: 38, borderRadius: 20, backgroundColor: 'rgba(2,6,23,0.45)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  livePill: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 18, backgroundColor: 'rgba(220,38,38,0.92)', shadowColor: '#ef4444', shadowOpacity: 0.5, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } },
  redDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff' },
  liveText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  viewerPill: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, paddingVertical: 7, paddingHorizontal: 10, borderRadius: 18, backgroundColor: 'rgba(2,6,23,0.5)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  viewerCount: { color: '#fff', fontSize: 12, fontWeight: '800' },
  hostOverlay: { position: 'absolute', left: 14, right: 14, zIndex: 10, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  hostMeta: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, padding: 6, paddingRight: 10, borderRadius: 24, backgroundColor: 'rgba(2,6,23,0.45)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  hostAvatar: { width: 34, height: 34, borderRadius: 18 }, hostAvatarFallback: { width: 34, height: 34, borderRadius: 18, backgroundColor: '#d1fae5', alignItems: 'center', justifyContent: 'center' },
  hostName: { color: '#fff', fontSize: 12, fontWeight: '900' }, hostTitle: { color: '#e2e8f0', fontSize: 10, marginTop: 2 },
  followButton: { backgroundColor: '#059669', borderRadius: 16, paddingHorizontal: 9, paddingVertical: 6 }, followText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  endButton: { backgroundColor: '#dc2626', borderRadius: 20, paddingHorizontal: 15, paddingVertical: 8 }, endText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  heartsFloat: { position: 'absolute', right: 18, bottom: 150, width: 52, height: 200, zIndex: 3 },
  floatingHeart: { position: 'absolute', right: 6, fontSize: 25 },
  giftBurst: { position: 'absolute', width: 26, height: 26, alignItems: 'center', justifyContent: 'center', zIndex: 4 },
  giftBurstText: { fontSize: 22 },
  bottomOverlay: { position: 'absolute', left: 12, right: 12, bottom: 0, zIndex: 10 },
  chatPanel: { height: 180, maxHeight: '34%', width: '75%', marginBottom: 6, backgroundColor: 'rgba(2,6,23,0.28)', borderRadius: 14, paddingHorizontal: 9, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  messageList: { flex: 1 },
  messageRow: { alignSelf: 'flex-end', maxWidth: '100%', backgroundColor: 'rgba(2,6,23,0.42)', borderRadius: 15, paddingHorizontal: 10, paddingVertical: 6, marginVertical: 3 },
  messageBody: { color: '#fff', fontSize: 12, textAlign: 'right', lineHeight: 18 }, messageName: { color: '#a7f3d0', fontWeight: '900' },
  firstMessage: { color: '#e2e8f0', fontSize: 12, textAlign: 'right', paddingTop: 12 },
  requestRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, paddingVertical: 6 },
  requestCard: { flexDirection: 'row-reverse', alignItems: 'center', gap: 7, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: 'rgba(2,6,23,0.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  requestName: { color: '#fff', fontSize: 11, fontWeight: '700' },
  acceptButton: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center' },
  rejectButton: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center' },
  actionRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-around', paddingTop: 8 },
  actionButton: { minWidth: 48, alignItems: 'center', justifyContent: 'center', gap: 3 },
  actionLabel: { color: '#fff', fontSize: 9, fontWeight: '700' },
  guestBadge: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, backgroundColor: 'rgba(5,150,105,0.8)', paddingHorizontal: 9, paddingVertical: 7, borderRadius: 14 },
  durationPill: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 14, backgroundColor: 'rgba(2,6,23,0.4)' },
  durationText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  quickReveal: { alignSelf: 'center', flexDirection: 'row-reverse', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 18, backgroundColor: 'rgba(2,6,23,0.58)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', marginBottom: 18 },
  quickRevealText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  inputBar: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 9, borderRadius: 24, backgroundColor: 'rgba(2,6,23,0.56)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  sendButton: { width: 30, height: 30, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#059669' },
  chatInput: { flex: 1, minHeight: 40, color: '#fff', textAlign: 'right', fontSize: 13 },
  commentIcon: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  connectingPill: { position: 'absolute', top: '48%', alignSelf: 'center', flexDirection: 'row-reverse', alignItems: 'center', gap: 8, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, backgroundColor: 'rgba(2,6,23,0.7)' },
  connectingText: { color: '#fff', fontSize: 12 },
  loadingScreen: { flex: 1, backgroundColor: '#020617', alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: '#fff', fontSize: 14 },
  errorScreen: { flex: 1, backgroundColor: '#020617', alignItems: 'center', justifyContent: 'center', padding: 28 },
  errorIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center' },
  errorTitle: { color: '#fff', textAlign: 'center', fontWeight: '900', fontSize: 18, marginTop: 16 },
  errorHint: { color: '#cbd5e1', textAlign: 'center', fontSize: 13, marginTop: 7, lineHeight: 20 },
  returnButton: { marginTop: 20, backgroundColor: '#059669', borderRadius: 16, paddingHorizontal: 21, paddingVertical: 12 },
  returnText: { color: '#fff', fontWeight: '900' },
});
