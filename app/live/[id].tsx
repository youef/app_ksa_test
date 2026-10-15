import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Share, StatusBar, Text, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import {
  addLiveBlock,
  endLiveStream,
  fetchLiveSupporters,
  getLiveToken,
  hideLiveMessage,
  reportLiveStream,
  requestLiveGuest,
  setLiveGuestMuted,
  setLiveMessagePinned,
  type LiveChatMessage,
  type LiveStream,
} from '@/lib/lives';
import LiveMedia, { type LiveMediaApi, type LiveMediaConnection, type LiveMediaQuality, type LiveMediaState } from '@/components/lives/LiveMedia';
import LiveModerationPanel from '@/components/lives/LiveModerationPanel';
import LiveCommentCard from '@/components/lives/LiveCommentCard';
import FloatingEffect from '@/components/lives/FloatingEffect';
import { styles } from '@/components/lives/liveRoomStyles';
import { useLiveModeration } from '@/hooks/useLiveModeration';
import { useLiveRoomHeartbeat } from '@/hooks/useLiveRoomHeartbeat';
import { useLiveChat } from '@/hooks/useLiveChat';
import { useLiveEffects } from '@/hooks/useLiveEffects';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BadgeCheck, Camera, CameraOff, Check, ChevronDown, ChevronUp, Eye, EyeOff, Gift, Heart, MessageCircle, Mic, MicOff, MoreHorizontal, Pin, Radio, Send, Share2, ShieldAlert, SignalHigh, SignalLow, SignalMedium, Trophy, UserMinus, UserPlus, Users, X } from 'lucide-react-native';

type Role = 'host' | 'viewer' | 'guest';
type GuestRequest = { id: string; guest_id: string; stream_id: string; status: string; seat_order?: number; is_muted?: boolean; profiles?: { display_name: string | null; username: string | null; avatar_url: string | null } | null };
type AudienceMember = { id: string; display_name: string | null; username: string | null; avatar_url: string | null; is_verified: boolean | null };
type Supporter = { user: AudienceMember; gifts: number };
type HostSheetTab = 'comments' | 'guests';

export default function LiveRoomScreen() {
  const { id, role: roleParam } = useLocalSearchParams<{ id: string; role?: string }>();
  const insets = useSafeAreaInsets();
  const [stream, setStream] = useState<LiveStream | null>(null);
  const [roomUrl, setRoomUrl] = useState('');
  const [token, setToken] = useState('');
  const [currentUser, setCurrentUser] = useState('');
  const [currentUserName, setCurrentUserName] = useState('');
  const [role, setRole] = useState<Role>(roleParam === 'host' ? 'host' : 'viewer');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { messages, pinnedMessage, sending, loadMessages, sendMessage: sendChatMessage } = useLiveChat(id ? String(id) : undefined);
  const [chatInput, setChatInput] = useState('');
  const [viewerCount, setViewerCount] = useState(0);
  const [pendingRequests, setPendingRequests] = useState<GuestRequest[]>([]);
  const [guests, setGuests] = useState<GuestRequest[]>([]);
  const [guestLimit, setGuestLimit] = useState(4);
  const [guestState, setGuestState] = useState<'idle' | 'pending' | 'accepted'>('idle');
  const [guestMutedByHost, setGuestMutedByHost] = useState(false);
  const elapsed = useLiveRoomHeartbeat(id ? String(id) : undefined, currentUser, role, stream?.started_at);
  const [connected, setConnected] = useState(false);
  const [connection, setConnection] = useState<LiveMediaConnection>('connecting');
  const [quality, setQuality] = useState<LiveMediaQuality>('unknown');
  const [mediaState, setMediaState] = useState<LiveMediaState>({ cameraEnabled: true, microphoneEnabled: true });
  const [isFollowing, setIsFollowing] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [showChat, setShowChat] = useState(true);
  const [controlsOpen, setControlsOpen] = useState(true);
  const [audienceMembers, setAudienceMembers] = useState<AudienceMember[]>([]);
  const [topSupporters, setTopSupporters] = useState<Supporter[]>([]);
  const [supporterError, setSupporterError] = useState('');
  const [peoplePanel, setPeoplePanel] = useState<'viewers' | 'supporters' | null>(null);
  const [hostSheet, setHostSheet] = useState<HostSheetTab | null>(null);
  const [moderationOpen, setModerationOpen] = useState(false);
  const moderation = useLiveModeration(id ? String(id) : undefined, Boolean(id) && !loading && !error);
  const { effects, pushEffect, channelRef: heartChannelRef } = useLiveEffects(id ? String(id) : undefined, Boolean(id) && !loading && !error);
  const moderatorPermissions = moderation.moderators.find((item) => item.user_id === currentUser);
  const canHideComments = role === 'host' || Boolean(moderatorPermissions?.can_hide_comments);
  const canTimeoutUsers = role === 'host' || Boolean(moderatorPermissions?.can_timeout_users);
  const canManageFilters = role === 'host' || Boolean(moderatorPermissions?.can_manage_filters);
  const scrollRef = useRef<ScrollView>(null);
  const mediaApiRef = useRef<LiveMediaApi | null>(null);
  const connectedRef = useRef(false);
  const hostPulseAtRef = useRef(Date.now());
  const staleSweepAtRef = useRef(0);
  const guestMutedRef = useRef(false);
  const roleRef = useRef(role);
  const guestStateRef = useRef(guestState);
  const currentUserRef = useRef(currentUser);
  roleRef.current = role;
  guestStateRef.current = guestState;
  currentUserRef.current = currentUser;
  const mediaRole = role === 'host' || role === 'guest';

  const handleConnectionChange = useCallback((state: LiveMediaConnection) => {
    setConnection(state);
    const isConnected = state === 'connected';
    connectedRef.current = isConnected;
    setConnected(isConnected);
  }, []);
  const handleQualityChange = useCallback((next: LiveMediaQuality) => setQuality(next), []);
  const handleMediaStateChange = useCallback((next: LiveMediaState) => setMediaState(next), []);
  const handleApiReady = useCallback((api: LiveMediaApi) => { mediaApiRef.current = api; }, []);

  const loadGuests = useCallback(async (streamId: string) => {
    const result = await supabase.from('live_guest_requests')
      .select('id,guest_id,stream_id,status,seat_order,is_muted,profiles!live_guest_requests_guest_id_fkey(display_name,username,avatar_url)')
      .eq('stream_id', streamId).eq('status', 'accepted').order('seat_order', { ascending: true });
    if (result.error) {
      const fallback = await supabase.from('live_guest_requests')
        .select('id,guest_id,stream_id,status,profiles!live_guest_requests_guest_id_fkey(display_name,username,avatar_url)')
        .eq('stream_id', streamId).eq('status', 'accepted');
      if (fallback.error) throw fallback.error;
      setGuests((fallback.data || []) as unknown as GuestRequest[]);
      return;
    }
    setGuests((result.data || []) as unknown as GuestRequest[]);
  }, []);

  const loadRoom = useCallback(async () => {
    if (!id) return;
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { router.replace('/auth'); return; }
      setCurrentUser(auth.user.id);
      const { data: me } = await supabase.from('profiles').select('display_name,username').eq('id', auth.user.id).maybeSingle();
      setCurrentUserName(me?.display_name || me?.username || 'مشاهد');
      const { data: live, error: streamError } = await supabase.from('live_streams')
        .select('id,host_id,title,category,audience,room_name,status,viewer_count,peak_viewer_count,started_at,updated_at,guest_limit,profiles!live_streams_host_id_fkey(id,display_name,username,avatar_url,is_verified,city,district)')
        .eq('id', id).maybeSingle();
      if (streamError) throw streamError;
      if (!live) throw new Error('تعذر العثور على هذا البث.');
      const typed = live as unknown as LiveStream;
      setStream(typed);
      setGuestLimit(Math.max(1, Math.min(8, Number(typed.guest_limit) || 4)));
      hostPulseAtRef.current = new Date(typed.updated_at || typed.started_at).getTime();
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
        try {
          await endLiveStream(id);
        } catch (cleanupError) {
          console.error('Unable to close the host stream after room setup failed.', cleanupError);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [id, roleParam, loadMessages]);

  async function loadAudience(streamId: string) {
    const { data, error: audienceError } = await supabase.from('live_viewer_sessions')
      .select('viewer_id,profiles!live_viewer_sessions_viewer_id_fkey(id,display_name,username,avatar_url,is_verified)')
      .eq('stream_id', streamId)
      .gt('last_seen_at', new Date(Date.now() - 45_000).toISOString())
      .order('last_seen_at', { ascending: false })
      .limit(50);
    if (audienceError) throw audienceError;
    setAudienceMembers((data || []).map((row: any) => row.profiles).filter(Boolean) as AudienceMember[]);
  }

  async function loadSupporters(streamId: string) {
    try {
      const rows = await fetchLiveSupporters(streamId);
      setTopSupporters(rows.map((item) => ({
        user: { id: item.user_id, display_name: item.display_name, username: null, avatar_url: item.avatar_url, is_verified: item.is_verified },
        gifts: item.gifts_count,
      })));
      setSupporterError('');
    } catch (cause) {
      setSupporterError('قائمة الداعمين تحتاج إلى تحديث قاعدة البيانات.');
      throw cause;
    }
  }

  useEffect(() => { void loadRoom(); }, [loadRoom]);

  useEffect(() => {
    if (!id) return;
    const closeHostStream = () => {
      if (roleRef.current !== 'host' || !connectedRef.current) return;
      void endLiveStream(id).catch((cause) => {
        console.error('Unable to end host stream after leaving the room.', cause);
      });
    };
    // Deliberately do not end a stream on AppState background transitions.
    const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') closeHostStream();
    });
    const onPageHide = () => closeHostStream();
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      window.addEventListener('pagehide', onPageHide);
    }
    return () => {
      authListener.subscription.unsubscribe();
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        window.removeEventListener('pagehide', onPageHide);
      }
      closeHostStream();
    };
  }, [id]);

  useEffect(() => {
    if (!id || loading || error) return;
    const chatChannel = supabase.channel(`live-chat:${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_chat_messages', filter: `stream_id=eq.${id}` }, () => { void loadMessages(id); })
      .subscribe();
    const streamChannel = supabase.channel(`live-state:${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'live_streams', filter: `id=eq.${id}` }, (payload) => {
        const next = payload.new as { status?: string; updated_at?: string };
        if (next.status === 'ended') setError('أنهى المضيف هذا البث.');
        if (next.updated_at) hostPulseAtRef.current = new Date(next.updated_at).getTime();
      })
      .subscribe();
    const guestChannel = supabase.channel(`live-guests:${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_guest_requests', filter: `stream_id=eq.${id}` }, () => {
        if (roleRef.current === 'host') {
          void loadGuests(id).catch((cause) => console.error('Unable to refresh live guests.', cause));
          void supabase.from('live_guest_requests')
            .select('id,guest_id,stream_id,status,profiles!live_guest_requests_guest_id_fkey(display_name,username,avatar_url)')
            .eq('stream_id', id).eq('status', 'pending').order('created_at', { ascending: true })
            .then(({ data }) => setPendingRequests((data || []) as unknown as GuestRequest[]));
        }
      })
      .subscribe();

    const poll = setInterval(() => {
      void (async () => {
        const { count } = await supabase.from('live_viewer_sessions').select('viewer_id', { count: 'exact', head: true })
          .eq('stream_id', id).gt('last_seen_at', new Date(Date.now() - 45_000).toISOString());
        setViewerCount((count || 0) + (roleRef.current === 'host' ? 1 : 0));
        if (roleRef.current !== 'host' && Date.now() - hostPulseAtRef.current > 75_000 && Date.now() - staleSweepAtRef.current > 30_000) {
          staleSweepAtRef.current = Date.now();
          const { error: sweepError } = await supabase.rpc('expire_stale_live_streams');
          if (sweepError && sweepError.code !== 'PGRST202') console.error('Unable to expire the disconnected host stream.', sweepError);
        }
        if (roleRef.current === 'host') {
          const { data } = await supabase.from('live_guest_requests')
            .select('id,guest_id,stream_id,status,profiles!live_guest_requests_guest_id_fkey(display_name,username,avatar_url)')
            .eq('stream_id', id).eq('status', 'pending').order('created_at', { ascending: true });
          setPendingRequests((data || []) as unknown as GuestRequest[]);
          void loadGuests(id).catch((cause) => console.error('Unable to refresh live guests.', cause));
        } else {
          const primary = await supabase.from('live_guest_requests').select('status,is_muted')
            .eq('stream_id', id).eq('guest_id', currentUserRef.current).maybeSingle();
          const own = primary.error
            ? (await supabase.from('live_guest_requests').select('status')
                .eq('stream_id', id).eq('guest_id', currentUserRef.current).maybeSingle()).data
            : primary.data;
          const status = own?.status;
          if (status === 'accepted' && roleRef.current === 'viewer') {
            setRole('guest');
            roleRef.current = 'guest';
            guestStateRef.current = 'accepted';
            setGuestState('accepted');
            const credential = await getLiveToken(id, 'guest');
            setRoomUrl(credential.url);
            setToken(credential.token);
          } else if (roleRef.current === 'guest') {
            const muted = Boolean((own as { is_muted?: boolean } | null)?.is_muted);
            if (muted && !guestMutedRef.current) mediaApiRef.current?.setMicrophoneEnabled(false);
            guestMutedRef.current = muted;
            setGuestMutedByHost(muted);
            if (status === 'removed') setError('أزالك المضيف من البث.');
          } else if (status === 'rejected' || status === 'removed') {
            if (guestStateRef.current === 'pending') setGuestState('idle');
          }
        }
      })();
    }, 10_000);

    const audienceTimer = setInterval(() => {
      void loadAudience(id).catch((cause) => console.error('Unable to refresh live audience.', cause));
      void loadSupporters(id).catch((cause) => console.error('Unable to refresh live supporters.', cause));
    }, 20_000);
    void loadAudience(id).catch((cause) => console.error('Unable to load live audience.', cause));
    void loadSupporters(id).catch((cause) => console.error('Unable to load live supporters.', cause));
    if (roleRef.current === 'host') void loadGuests(id).catch((cause) => console.error('Unable to load live guests.', cause));

    return () => {
      clearInterval(poll); clearInterval(audienceTimer);
      void supabase.removeChannel(chatChannel); void supabase.removeChannel(streamChannel); void supabase.removeChannel(guestChannel);
    };
  }, [id, loading, error, loadMessages, loadGuests]);

  async function timeoutMessageAuthor(message: LiveChatMessage, minutes: number) {
    if (!id || !canTimeoutUsers) return;
    try {
      await moderation.timeoutUser(message.sender_id, minutes, 'مخالفة قواعد التعليقات');
      Alert.alert('تم الحظر المؤقت', `مُنع المستخدم من التعليق لمدة ${minutes} دقيقة.`);
    } catch (cause) {
      Alert.alert('تعذر الحظر المؤقت', cause instanceof Error ? cause.message : 'حاول مرة أخرى.');
    }
  }

  async function sendMessage() {
    const body = chatInput.trim();
    if (!body || sending || !id) return;
    try {
      const sent = await sendChatMessage(body);
      if (sent) setChatInput('');
    } catch (e) {
      Alert.alert('تعذر إرسال التعليق', e instanceof Error ? e.message : 'حاول مرة أخرى.');
    }
  }

  async function requestGuestSeat() {
    if (!id) return;
    try { await requestLiveGuest(id); setGuestState('pending'); }
    catch (e) { Alert.alert('تعذر إرسال الطلب', e instanceof Error ? e.message : 'حاول مرة أخرى.'); }
  }

  async function decideGuest(request: GuestRequest, status: 'accepted' | 'rejected') {
    if (status === 'accepted' && guests.length >= guestLimit) {
      Alert.alert('اكتملت المقاعد', `الحد الحالي ${guestLimit} ضيوف. زد عدد المقاعد أو أزل ضيفًا أولًا.`);
      return;
    }
    const { error: updateError } = await supabase.from('live_guest_requests')
      .update({ status, decided_at: new Date().toISOString() }).eq('id', request.id).eq('status', 'pending');
    if (updateError) Alert.alert('تعذر تحديث الطلب', updateError.message);
    else {
      setPendingRequests((rows) => rows.filter((item) => item.id !== request.id));
      if (id) void loadGuests(id).catch(() => {});
    }
  }

  async function changeGuestLimit(nextLimit: number) {
    if (role !== 'host' || !id) return;
    const safeLimit = Math.max(1, Math.min(8, Math.floor(nextLimit)));
    if (safeLimit < guests.length) {
      Alert.alert('عدد المقاعد أقل من الضيوف', 'أزل بعض الضيوف قبل تقليل عدد المقاعد.');
      return;
    }
    const { error: updateError } = await supabase.from('live_streams')
      .update({ guest_limit: safeLimit }).eq('id', id).eq('host_id', currentUser).eq('status', 'live');
    if (updateError) {
      Alert.alert('تعذر تحديث المقاعد', updateError.message);
      return;
    }
    setGuestLimit(safeLimit);
    setStream((current) => current ? { ...current, guest_limit: safeLimit } : current);
  }

  async function moveGuest(guest: GuestRequest, direction: -1 | 1) {
    if (!id) return;
    const ordered = [...guests].sort((a, b) => (a.seat_order ?? 999) - (b.seat_order ?? 999));
    const index = ordered.findIndex((item) => item.id === guest.id);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= ordered.length) return;
    const current = ordered[index];
    const target = ordered[targetIndex];
    const currentOrder = current.seat_order ?? index + 1;
    const targetOrder = target.seat_order ?? targetIndex + 1;
    const { error: orderError } = await supabase.from('live_guest_requests')
      .update({ seat_order: targetOrder }).eq('id', current.id).eq('stream_id', id).eq('status', 'accepted');
    if (orderError) { Alert.alert('تعذر ترتيب الضيوف', orderError.message); return; }
    const { error: swapError } = await supabase.from('live_guest_requests')
      .update({ seat_order: currentOrder }).eq('id', target.id).eq('stream_id', id).eq('status', 'accepted');
    if (swapError) Alert.alert('تعذر ترتيب الضيوف', swapError.message);
    await loadGuests(id);
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

  async function sendHeart() {
    const emoji = ['💚', '❤️', '👏', '✨'][Math.floor(Math.random() * 4)];
    pushEffect({ emoji, name: currentUserName, kind: 'heart' });
    await heartChannelRef.current?.send({ type: 'broadcast', event: 'heart', payload: { emoji, name: currentUserName } });
  }

  async function sendGift() {
    const emoji = ['🎁', '💎', '🌟', '🔥'][Math.floor(Math.random() * 4)];
    if (!id || !currentUser) return;
    try {
      const { error: giftError } = await supabase.from('live_gift_events').insert({
        stream_id: id,
        sender_id: currentUser,
        emoji,
      });
      if (giftError) throw giftError;
      pushEffect({ emoji, name: currentUserName, kind: 'gift' });
      await heartChannelRef.current?.send({ type: 'broadcast', event: 'gift', payload: { emoji, name: currentUserName } });
      await loadSupporters(id);
    } catch (cause) {
      Alert.alert('تعذر إرسال الهدية', cause instanceof Error ? cause.message : 'حاول مرة أخرى.');
    }
  }

  async function pinMessage(message: LiveChatMessage) {
    if (!id) return;
    try {
      if (message.is_pinned) {
        await setLiveMessagePinned(id, message.id, false);
      } else {
        const current = pinnedMessage && pinnedMessage.id !== message.id ? pinnedMessage : messages.find((item) => item.is_pinned);
        if (current && current.id !== message.id) await setLiveMessagePinned(id, current.id, false);
        await setLiveMessagePinned(id, message.id, true);
      }
      await loadMessages(id);
    } catch (cause) {
      Alert.alert('تعذر تثبيت التعليق', cause instanceof Error ? cause.message : 'حاول مرة أخرى.');
    }
  }

  async function hideMessage(message: LiveChatMessage) {
    if (!id) return;
    try { await hideLiveMessage(id, message.id); await loadMessages(id); }
    catch (cause) { Alert.alert('تعذر إخفاء التعليق', cause instanceof Error ? cause.message : 'حاول مرة أخرى.'); }
  }

  async function toggleGuestMute(guest: GuestRequest) {
    if (!id) return;
    try {
      await setLiveGuestMuted(id, guest.guest_id, !guest.is_muted);
      await loadGuests(id);
    } catch (cause) {
      Alert.alert('تعذر تعديل المايك', cause instanceof Error ? cause.message : 'حاول مرة أخرى.');
    }
  }

  function removeGuest(guest: GuestRequest) {
    if (!id || !stream) return;
    Alert.alert('إزالة الضيف؟', 'سيُزال الضيف ويُمنع من الانضمام لهذا البث.', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'إزالة', style: 'destructive', onPress: () => {
        void addLiveBlock(id, stream.host_id, guest.guest_id)
          .then(() => { Alert.alert('تمت الإزالة', 'أُزيل الضيف وحُظر من هذا البث.'); void loadGuests(id).catch(() => {}); })
          .catch((cause) => Alert.alert('تعذر إزالة الضيف', cause instanceof Error ? cause.message : 'حاول مرة أخرى.'));
      } },
    ]);
  }

  function moderateMessage(message: LiveChatMessage) {
    if (!id || (!canHideComments && !canTimeoutUsers && role !== 'host')) return;
    const actions: NonNullable<Parameters<typeof Alert.alert>[2]> = [];
    if (role === 'host') actions.push({ text: message.is_pinned ? 'إلغاء التثبيت' : 'تثبيت التعليق', onPress: () => void pinMessage(message) });
    if (canHideComments) actions.push({ text: 'إخفاء التعليق', style: 'destructive', onPress: () => void hideMessage(message) });
    if (canTimeoutUsers && message.sender_id !== currentUser && message.sender_id !== stream?.host_id) {
      actions.push({ text: 'حظر 5 دقائق', style: 'destructive', onPress: () => void timeoutMessageAuthor(message, 5) });
      actions.push({ text: 'حظر 30 دقيقة', style: 'destructive', onPress: () => void timeoutMessageAuthor(message, 30) });
      actions.push({ text: 'حظر 24 ساعة', style: 'destructive', onPress: () => void timeoutMessageAuthor(message, 1440) });
    }
    actions.push({ text: 'إلغاء', style: 'cancel' });
    Alert.alert('إدارة التعليق', undefined, actions);
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

  async function handleBack() {
    if (role === 'host' && stream?.status === 'live') { confirmEnd(); return; }
    if (router.canGoBack()) router.back(); else router.replace('/lives');
  }

  const duration = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
  const hostName = stream?.profiles?.display_name || stream?.profiles?.username || 'جارٍ';
  const mediaAlerts = useMemo(() => {
    const items: string[] = [];
    if (mediaRole && !mediaState.microphoneEnabled) items.push(guestMutedByHost ? 'كتمك المضيف' : 'المايك مكتوم');
    if (mediaRole && !mediaState.cameraEnabled) items.push('الكاميرا متوقفة');
    return items;
  }, [mediaRole, mediaState, guestMutedByHost]);

  if (loading) return <View style={styles.loadingScreen}><StatusBar hidden /><ActivityIndicator size="large" color="#34d399" /><Text style={styles.loadingText}>جارٍ تجهيز البث…</Text></View>;
  if (error || !stream) return <View style={styles.errorScreen}><StatusBar hidden /><View style={styles.errorIcon}><Radio color="#fff" size={30} /></View><Text style={styles.errorTitle}>{error || 'تعذر فتح البث'}</Text><Text style={styles.errorHint}>تأكد من الاتصال بالإنترنت وحاول مرة أخرى.</Text><Pressable onPress={() => router.replace('/lives')} style={styles.returnButton}><Text style={styles.returnText}>العودة للبثوث</Text></Pressable></View>;

  return (
    <View style={styles.screen}>
      <StatusBar hidden />
      <View style={styles.stage}>
        <LiveMedia
          participantOrder={[stream.host_id, ...guests.slice().sort((a, b) => (a.seat_order ?? 999) - (b.seat_order ?? 999)).map((guest) => guest.guest_id)]}
          url={roomUrl}
          token={token}
          canPublish={mediaRole}
          onConnectionChange={handleConnectionChange}
          onQualityChange={handleQualityChange}
          onMediaStateChange={handleMediaStateChange}
          onApiReady={handleApiReady}
          onReady={() => { connectedRef.current = true; setConnected(true); }}
          onError={(message) => {
            connectedRef.current = false;
            setConnected(false);
            if (role === 'host' && id) {
              void endLiveStream(id).then(() => setError(message)).catch((endError) => {
                console.error('Unable to close the host stream after media failure.', endError);
                setError(`${message} تعذر إنهاء البث تلقائيًا؛ استخدم زر الإنهاء.`);
              });
            } else setError(message);
          }}
        />

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="إظهار أو إخفاء الواجهة"
          style={styles.stageTap}
          onPress={() => setOverlayVisible((value) => !value)}
        />

        {overlayVisible && (
          <>
            <LinearGradient colors={['rgba(2,6,23,0.78)', 'rgba(2,6,23,0.32)', 'rgba(2,6,23,0)']} locations={[0, 0.55, 1]} pointerEvents="none" style={[styles.topGradient, { height: 210 + insets.top }]} />
            <LinearGradient colors={['rgba(2,6,23,0)', 'rgba(2,6,23,0.5)', 'rgba(2,6,23,0.9)']} locations={[0, 0.5, 1]} pointerEvents="none" style={[styles.bottomGradient, { height: 340 + insets.bottom }]} />
          </>
        )}

        {overlayVisible ? (
          <>
            <View pointerEvents="box-none" style={[styles.topBar, { top: Math.max(insets.top, 12) }]}>
              <Pressable accessibilityLabel="إغلاق البث" onPress={() => void handleBack()} style={styles.roundButton}><X color="#fff" size={21} /></Pressable>
              <View style={styles.topCenter}>
                <View style={styles.livePill}><View style={styles.redDot} /><Text style={styles.liveText}>مباشر</Text></View>
                {connection === 'connected' && quality !== 'unknown' && (
                  <View style={styles.qualityPill}>
                    {quality === 'excellent' ? <SignalHigh size={14} color="#34d399" /> : quality === 'good' ? <SignalMedium size={14} color="#fbbf24" /> : <SignalLow size={14} color="#fb7185" />}
                    <Text style={styles.qualityText}>{quality === 'excellent' ? 'جودة ممتازة' : quality === 'good' ? 'جودة جيدة' : 'جودة ضعيفة'}</Text>
                  </View>
                )}
              </View>
              <Pressable onPress={() => setPeoplePanel('viewers')} style={styles.viewerPill}><Users color="#fff" size={14} /><Text style={styles.viewerCount}>{viewerCount}</Text></Pressable>
            </View>

            <View pointerEvents="box-none" style={[styles.hostOverlay, { top: Math.max(insets.top, 12) + 52 }]}>
              <View style={styles.hostMeta}>
                {stream.profiles?.avatar_url ? <Image source={{ uri: stream.profiles.avatar_url }} style={styles.hostAvatar} /> : <View style={styles.hostAvatarFallback}><Text style={{ color: '#047857', fontWeight: '900' }}>ح</Text></View>}
                <View style={{ alignItems: 'flex-end', maxWidth: 175 }}>
                  <View style={styles.hostNameRow}>
                    <Text numberOfLines={1} style={styles.hostName}>{hostName}</Text>
                    {stream.profiles?.is_verified && <BadgeCheck color="#34d399" size={14} />}
                    <View style={styles.roleTagHost}><Text style={styles.roleTagHostText}>مضيف</Text></View>
                  </View>
                  <Text numberOfLines={1} style={styles.hostTitle}>{stream.title}</Text>
                </View>
                {role !== 'host' && <Pressable onPress={() => void toggleFollow()} style={styles.followButton}><Text style={styles.followText}>{isFollowing ? 'تتابع' : 'متابعة +'}</Text></Pressable>}
              </View>
              {role === 'host' ? <Pressable onPress={confirmEnd} style={styles.endButton}><Text style={styles.endText}>إنهاء</Text></Pressable> : <Pressable onPress={showReport} style={styles.roundButton}><MoreHorizontal color="#fff" size={20} /></Pressable>}
            </View>

            {topSupporters.length > 0 && (
              <Pressable onPress={() => setPeoplePanel('supporters')} style={[styles.supportersPill, { top: Math.max(insets.top, 12) + 104 }]}>
                <Trophy size={14} color="#fde68a" />
                <Text numberOfLines={1} style={styles.supportersPillText}>الأكثر دعمًا: {topSupporters[0].user.display_name || topSupporters[0].user.username}</Text>
              </Pressable>
            )}
          </>
        ) : (
          <View pointerEvents="box-none" style={[styles.hiddenBar, { top: Math.max(insets.top, 12) }]}>
            {role === 'host' ? (
              <Pressable onPress={confirmEnd} style={styles.emergencyButton}><Radio color="#fff" size={16} /><Text style={styles.emergencyText}>إنهاء</Text></Pressable>
            ) : <View style={styles.roundButtonSpacer} />}
            <Pressable onPress={() => setOverlayVisible(true)} style={styles.hiddenHint}><Eye size={15} color="#fff" /><Text style={styles.hiddenHintText}>اضغط لإظهار الواجهة</Text></Pressable>
            <View style={styles.roundButtonSpacer} />
          </View>
        )}

        {connection === 'reconnecting' && (
          <View pointerEvents="none" style={styles.connectionBanner}><ActivityIndicator color="#fff" size="small" /><Text style={styles.connectionBannerText}>جارٍ إعادة الاتصال…</Text></View>
        )}
        {connection === 'connecting' && !connected && (
          <View pointerEvents="none" style={styles.connectionBanner}><ActivityIndicator color="#fff" size="small" /><Text style={styles.connectionBannerText}>جارٍ الاتصال…</Text></View>
        )}

        {mediaAlerts.length > 0 && (
          <View pointerEvents="none" style={styles.mediaAlertWrap}>
            {mediaAlerts.map((alert) => (
              <View key={alert} style={styles.mediaAlert}><MicOff size={13} color="#fecdd3" /><Text style={styles.mediaAlertText}>{alert}</Text></View>
            ))}
          </View>
        )}

        <View pointerEvents="none" style={styles.effectsLayer}>
          {effects.map((effect, index) => (
            <FloatingEffect key={effect.id} emoji={effect.emoji} name={effect.kind === 'gift' ? effect.name : undefined} style={[styles.floatingEffect, { bottom: 150 + (index % 4) * 34 }]} />
          ))}
        </View>

        <Modal visible={peoplePanel !== null} transparent animationType="fade" onRequestClose={() => setPeoplePanel(null)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setPeoplePanel(null)}>
            <Pressable style={styles.peopleSheet} onPress={(event) => event.stopPropagation()}>
              <View style={styles.peopleSheetHeader}>
                <Text style={styles.peopleSheetTitle}>{peoplePanel === 'supporters' ? 'أكثر الداعمين' : `المشاهدون (${viewerCount})`}</Text>
                <Pressable onPress={() => setPeoplePanel(null)} style={styles.modalClose}><X color="#fff" size={19} /></Pressable>
              </View>
              <View style={styles.peopleTabs}>
                <Pressable onPress={() => setPeoplePanel('viewers')} style={[styles.peopleTab, peoplePanel === 'viewers' && styles.peopleTabActive]}><Text style={styles.peopleTabText}>المشاهدون</Text></Pressable>
                <Pressable onPress={() => setPeoplePanel('supporters')} style={[styles.peopleTab, peoplePanel === 'supporters' && styles.peopleTabActive]}><Text style={styles.peopleTabText}>أفضل 5 داعمين</Text></Pressable>
              </View>
              <ScrollView style={styles.peopleList}>
                {peoplePanel === 'supporters' ? topSupporters.slice(0, 5).map((supporter, index) => (
                  <View key={supporter.user.id} style={styles.peopleRow}>
                    <Text style={styles.peopleRank}>{index + 1}</Text>
                    {supporter.user.avatar_url ? <Image source={{ uri: supporter.user.avatar_url }} style={styles.peopleAvatar} /> : <View style={styles.peopleAvatarFallback}><Text style={styles.peopleInitial}>{(supporter.user.display_name || supporter.user.username || 'ح').slice(0, 1)}</Text></View>}
                    <Text numberOfLines={1} style={styles.peopleName}>{supporter.user.display_name || supporter.user.username || 'جارٍ'}{supporter.user.is_verified ? '  ✓' : ''}</Text>
                    <Text style={styles.giftCount}>🎁 {supporter.gifts}</Text>
                  </View>
                )) : audienceMembers.map((member) => (
                  <View key={member.id} style={styles.peopleRow}>
                    {member.avatar_url ? <Image source={{ uri: member.avatar_url }} style={styles.peopleAvatar} /> : <View style={styles.peopleAvatarFallback}><Text style={styles.peopleInitial}>{(member.display_name || member.username || 'ح').slice(0, 1)}</Text></View>}
                    <Text numberOfLines={1} style={styles.peopleName}>{member.display_name || member.username || 'جارٍ'}</Text>
                    {member.is_verified && <BadgeCheck color="#34d399" size={17} />}
                  </View>
                ))}
                {peoplePanel === 'supporters' && supporterError !== '' && <Text style={styles.peopleEmpty}>{supporterError}</Text>}
                {peoplePanel === 'supporters' && supporterError === '' && topSupporters.length === 0 && <Text style={styles.peopleEmpty}>كن أول من يرسل هدية مجانية للمضيف.</Text>}
                {peoplePanel === 'viewers' && audienceMembers.length === 0 && <Text style={styles.peopleEmpty}>أنت أول المشاهدين، حيّاك الله.</Text>}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>

        <Modal visible={hostSheet !== null} transparent animationType="slide" onRequestClose={() => setHostSheet(null)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setHostSheet(null)}>
            <Pressable style={styles.hostSheet} onPress={(event) => event.stopPropagation()}>
              <View style={styles.peopleSheetHeader}>
                <Text style={styles.peopleSheetTitle}>أدوات المضيف</Text>
                <Pressable onPress={() => setHostSheet(null)} style={styles.modalClose}><X color="#fff" size={19} /></Pressable>
              </View>
              <View style={styles.peopleTabs}>
                <Pressable onPress={() => setHostSheet('comments')} style={[styles.peopleTab, hostSheet === 'comments' && styles.peopleTabActive]}><Text style={styles.peopleTabText}>التعليقات</Text></Pressable>
                <Pressable onPress={() => setHostSheet('guests')} style={[styles.peopleTab, hostSheet === 'guests' && styles.peopleTabActive]}><Text style={styles.peopleTabText}>الضيوف ({guests.length})</Text></Pressable>
              </View>
              <ScrollView style={styles.hostSheetList}>
                {hostSheet === 'comments' && messages.slice().reverse().map((message) => (
                  <View key={message.id} style={styles.hostCommentRow}>
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <Text style={styles.hostCommentName}>{message.profiles?.display_name || message.profiles?.username || 'جارٍ'}</Text>
                      <Text numberOfLines={2} style={styles.hostCommentBody}>{message.body}</Text>
                    </View>
                    <Pressable onPress={() => void pinMessage(message)} style={[styles.hostAction, message.is_pinned && styles.hostActionActive]}><Pin size={15} color={message.is_pinned ? '#020617' : '#fff'} /></Pressable>
                    <Pressable onPress={() => void hideMessage(message)} style={styles.hostActionDanger}><EyeOff size={15} color="#fff" /></Pressable>
                  </View>
                ))}
                {hostSheet === 'comments' && messages.length === 0 && <Text style={styles.peopleEmpty}>لا توجد تعليقات بعد.</Text>}
                {hostSheet === 'guests' && (
                  <View style={styles.seatLimitRow}>
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <Text style={styles.seatLimitTitle}>مقاعد الضيوف</Text>
                      <Text style={styles.seatLimitHint}>{guests.length} من {guestLimit} مقاعد مستخدمة</Text>
                    </View>
                    <Pressable accessibilityLabel="تقليل المقاعد" disabled={guestLimit <= 1 || guests.length >= guestLimit} onPress={() => void changeGuestLimit(guestLimit - 1)} style={[styles.hostAction, (guestLimit <= 1 || guests.length >= guestLimit) && { opacity: 0.35 }]}><Text style={styles.seatLimitButton}>−</Text></Pressable>
                    <Text style={styles.seatLimitCount}>{guestLimit}</Text>
                    <Pressable accessibilityLabel="زيادة المقاعد" disabled={guestLimit >= 8} onPress={() => void changeGuestLimit(guestLimit + 1)} style={[styles.hostAction, guestLimit >= 8 && { opacity: 0.35 }]}><Text style={styles.seatLimitButton}>+</Text></Pressable>
                  </View>
                )}
                {hostSheet === 'guests' && guests.map((guest, guestIndex) => (
                  <View key={guest.id} style={styles.peopleRow}>
                    {guest.profiles?.avatar_url ? <Image source={{ uri: guest.profiles.avatar_url }} style={styles.peopleAvatar} /> : <View style={styles.peopleAvatarFallback}><Text style={styles.peopleInitial}>{(guest.profiles?.display_name || guest.profiles?.username || 'ح').slice(0, 1)}</Text></View>}
                    <Text numberOfLines={1} style={styles.peopleName}>{guestIndex + 1}. {guest.profiles?.display_name || guest.profiles?.username || 'ضيف'}</Text>
                    <Pressable accessibilityLabel="رفع ترتيب الضيف" disabled={guestIndex === 0} onPress={() => void moveGuest(guest, -1)} style={[styles.hostAction, guestIndex === 0 && { opacity: 0.35 }]}><ChevronUp size={15} color="#fff" /></Pressable>
                    <Pressable accessibilityLabel="خفض ترتيب الضيف" disabled={guestIndex === guests.length - 1} onPress={() => void moveGuest(guest, 1)} style={[styles.hostAction, guestIndex === guests.length - 1 && { opacity: 0.35 }]}><ChevronDown size={15} color="#fff" /></Pressable>
                    <Pressable onPress={() => void toggleGuestMute(guest)} style={[styles.hostAction, guest.is_muted && styles.hostActionActive]}>{guest.is_muted ? <MicOff size={15} color="#020617" /> : <Mic size={15} color="#fff" />}</Pressable>
                    <Pressable onPress={() => removeGuest(guest)} style={styles.hostActionDanger}><UserMinus size={15} color="#fff" /></Pressable>
                  </View>
                ))}
                {hostSheet === 'guests' && guests.length === 0 && <Text style={styles.peopleEmpty}>لا يوجد ضيوف في البث الآن.</Text>}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>

        <LiveModerationPanel visible={moderationOpen} onClose={() => setModerationOpen(false)} settings={moderation.settings} moderators={moderation.moderators} loading={moderation.loading} error={moderation.error} isHost={role === 'host'} canManageSettings={canManageFilters} currentUserId={currentUser} onRefresh={moderation.refresh} onSaveSettings={moderation.saveSettings} onManageModerator={moderation.manageModerator} />

        {overlayVisible && (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0} style={styles.bottomOverlay}>
            {role === 'host' && controlsOpen && pendingRequests.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.requestRow}>
                {pendingRequests.map((request) => <View key={request.id} style={styles.requestCard}><Text style={styles.requestName}>{request.profiles?.display_name || request.profiles?.username || 'مستخدم'} يطلب الصعود</Text><Pressable onPress={() => void decideGuest(request, 'accepted')} style={styles.acceptButton}><Check color="#fff" size={15} /></Pressable><Pressable onPress={() => void decideGuest(request, 'rejected')} style={styles.rejectButton}><X color="#fff" size={15} /></Pressable></View>)}
              </ScrollView>
            )}

            {pinnedMessage && (
              <View style={styles.pinnedBanner}>
                <Pin size={13} color="#a7f3d0" />
                <Text numberOfLines={2} style={styles.pinnedText}><Text style={styles.pinnedAuthor}>{pinnedMessage.profiles?.display_name || pinnedMessage.profiles?.username || 'مثبّت'}: </Text>{pinnedMessage.body}</Text>
              </View>
            )}

            {showChat && (
              <View style={styles.chatPanel}>
                <ScrollView ref={scrollRef} style={styles.messageList} contentContainerStyle={{ justifyContent: 'flex-end', paddingVertical: 5 }} showsVerticalScrollIndicator={false} onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
                  {messages.slice(-10).map((message) => <LiveCommentCard key={message.id} message={message} onLongPress={() => moderateMessage(message)} />)}
                  {messages.length === 0 && <Text style={styles.firstMessage}>كن أول من يحيّي {hostName} 👋</Text>}
                </ScrollView>
              </View>
            )}

            {mediaRole ? (
              <HostControlBar
                role={role}
                open={controlsOpen}
                onToggleOpen={() => setControlsOpen((value) => !value)}
                cameraOn={mediaState.cameraEnabled}
                micOn={mediaState.microphoneEnabled}
                micLocked={role === 'guest' && guestMutedByHost}
                bottomInset={insets.bottom}
                onToggleCamera={() => mediaApiRef.current?.setCameraEnabled(!mediaState.cameraEnabled)}
                onToggleMic={() => mediaApiRef.current?.setMicrophoneEnabled(!mediaState.microphoneEnabled)}
                onGuests={() => setHostSheet('guests')}
                onComments={() => setHostSheet('comments')}
                onModeration={() => setModerationOpen(true)}
                onShare={() => void shareLive()}
                onEnd={confirmEnd}
              />
            ) : (
              <View style={[styles.actionRow, { paddingBottom: Math.max(insets.bottom, 10) }]}>
                <Pressable onPress={() => void sendHeart()} style={styles.actionButton}><Heart size={22} color="#fff" fill="#fb7185" /><Text style={styles.actionLabel}>تفاعل</Text></Pressable>
                <Pressable onPress={() => void sendGift()} style={styles.actionButton}><Gift size={21} color="#fde68a" /><Text style={styles.actionLabel}>هدية</Text></Pressable>
                <Pressable onPress={() => setShowChat((value) => !value)} style={styles.actionButton}><MessageCircle size={20} color="#fff" /><Text style={styles.actionLabel}>{showChat ? 'إخفاء' : 'التعليقات'}</Text></Pressable>
                <Pressable onPress={() => setOverlayVisible(false)} style={styles.actionButton}><EyeOff size={20} color="#fff" /><Text style={styles.actionLabel}>وضع</Text></Pressable>
                {guestState !== 'accepted' && (
                  <Pressable disabled={guestState !== 'idle'} onPress={() => void requestGuestSeat()} style={[styles.actionButton, guestState !== 'idle' && { opacity: 0.7 }]}><UserPlus size={21} color="#fff" /><Text style={styles.actionLabel}>{guestState === 'pending' ? 'بانتظار المضيف' : 'اطلب الصعود'}</Text></Pressable>
                )}
                {role !== 'host' && moderatorPermissions && <Pressable onPress={() => setModerationOpen(true)} style={styles.actionButton}><ShieldAlert size={20} color="#a7f3d0" /><Text style={styles.actionLabel}>إشراف</Text></Pressable>}
                <Pressable onPress={showReport} style={styles.actionButton}><ShieldAlert size={20} color="#fff" /><Text style={styles.actionLabel}>إبلاغ</Text></Pressable>
                <Pressable onPress={() => void shareLive()} style={styles.actionButton}><Share2 size={19} color="#fff" /><Text style={styles.actionLabel}>مشاركة</Text></Pressable>
                <View style={styles.durationPill}><Text style={styles.durationText}>{duration}</Text></View>
              </View>
            )}

            <View style={[styles.inputBar, { marginBottom: Math.max(insets.bottom, 8) }]}>
              <Pressable onPress={() => void sendMessage()} disabled={!chatInput.trim() || sending} style={[styles.sendButton, (!chatInput.trim() || sending) && { opacity: 0.5 }]}><Send color="#fff" size={16} /></Pressable>
              <TextInput value={chatInput} onChangeText={setChatInput} placeholder="أضف تعليقًا…" placeholderTextColor="#cbd5e1" maxLength={300} style={styles.chatInput} returnKeyType="send" onSubmitEditing={() => void sendMessage()} />
              <View style={styles.commentIcon}><MessageCircle size={18} color="#fff" /></View>
            </View>
          </KeyboardAvoidingView>
        )}
      </View>
    </View>
  );
}

function HostControlBar({ role, open, onToggleOpen, cameraOn, micOn, micLocked, bottomInset, onToggleCamera, onToggleMic, onGuests, onComments, onModeration, onShare, onEnd }: {
  role: Role;
  open: boolean;
  onToggleOpen: () => void;
  cameraOn: boolean;
  micOn: boolean;
  micLocked: boolean;
  bottomInset: number;
  onToggleCamera: () => void;
  onToggleMic: () => void;
  onGuests: () => void;
  onComments: () => void;
  onModeration: () => void;
  onShare: () => void;
  onEnd: () => void;
}) {
  return (
    <View style={[styles.glassWrap, { marginBottom: Math.max(bottomInset, 10) }]}>
      <BlurView intensity={Platform.OS === 'ios' ? 48 : 0} tint="dark" style={styles.glassBar}>
        <View style={styles.glassTint}>
          <Pressable onPress={onToggleOpen} style={styles.glassToggle} accessibilityLabel={open ? 'طي الأدوات' : 'فتح الأدوات'}>
            {open ? <ChevronDown size={18} color="#fff" /> : <ChevronUp size={18} color="#fff" />}
          </Pressable>
          {open ? (
            <View style={styles.glassButtons}>
              <GlassButton active={cameraOn} label="كاميرا" onPress={onToggleCamera}>{cameraOn ? <Camera size={20} color="#fff" /> : <CameraOff size={20} color="#fb7185" />}</GlassButton>
              <GlassButton active={micOn && !micLocked} disabled={micLocked} label={micLocked ? 'كتم المضيف' : 'مايك'} onPress={onToggleMic}>{micOn && !micLocked ? <Mic size={20} color="#fff" /> : <MicOff size={20} color="#fb7185" />}</GlassButton>
              {role === 'host' && <GlassButton label="الضيوف" onPress={onGuests}><Users size={20} color="#fff" /></GlassButton>}
              {role === 'host' && <GlassButton label="التعليقات" onPress={onComments}><MessageCircle size={20} color="#fff" /></GlassButton>}
              {role === 'host' && <GlassButton label="الإشراف" onPress={onModeration}><ShieldAlert size={20} color="#a7f3d0" /></GlassButton>}
              <GlassButton label="مشاركة" onPress={onShare}><Share2 size={19} color="#fff" /></GlassButton>
              {role === 'host' && <GlassButton danger label="إنهاء" onPress={onEnd}><Radio size={19} color="#fff" /></GlassButton>}
            </View>
          ) : (
            <Text style={styles.glassCollapsedText}>{role === 'host' ? 'تحكم المضيف' : 'تحكم الضيف'}</Text>
          )}
        </View>
      </BlurView>
    </View>
  );
}

function GlassButton({ children, label, onPress, active, danger, disabled }: { children: ReactNode; label: string; onPress: () => void; active?: boolean; danger?: boolean; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.glassButton, active && styles.glassButtonActive, danger && styles.glassButtonDanger, disabled && { opacity: 0.5 }]}>
      {children}
      <Text style={styles.glassButtonLabel} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

