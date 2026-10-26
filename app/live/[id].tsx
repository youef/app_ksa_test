import { OasisPressable as Pressable, OasisTextInput as TextInput, OasisSurface } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import { AppHeader, HeaderAction, useAppHeaderHeight } from '@/components/shared/AppHeader';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Modal, PanResponder, Platform, ScrollView, Share, StatusBar, Text, View, type GestureResponderHandlers } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import {
  addLiveBlock,
  endLiveStream,
  fetchInviteCandidates,
  fetchLiveSupporters,
  fetchMyGuestState,
  fetchNextLiveStream,
  fetchPendingGuestRequests,
  getLiveToken,
  hideLiveMessage,
  inviteLiveGuest,
  reportLiveStream,
  requestLiveGuest,
  respondToLiveInvite,
  setLiveGuestMuted,
  setLiveMessagePinned,
  type InviteCandidate,
  type LiveChatMessage,
  type LiveStream,
} from '@/lib/lives';
import { useNoCopy } from '@/lib/noCopy';
import LiveMedia, { type LiveMediaApi, type LiveMediaConnection, type LiveMediaQuality, type LiveMediaState } from '@/components/lives/LiveMedia';
import LiveModerationPanel from '@/components/lives/LiveModerationPanel';
import LiveCommentCard from '@/components/lives/LiveCommentCard';
import FloatingEffect from '@/components/lives/FloatingEffect';
import LiveHostControlBar from '@/components/lives/LiveHostControlBar';
import { styles } from '@/components/lives/liveRoomStyles';
import { useLiveModeration } from '@/hooks/useLiveModeration';
import { useLiveRoomHeartbeat } from '@/hooks/useLiveRoomHeartbeat';
import { useLiveChat } from '@/hooks/useLiveChat';
import { useLiveEffects } from '@/hooks/useLiveEffects';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BadgeCheck, Check, ChevronDown, ChevronUp, Eye, EyeOff, Gift, Heart, MessageCircle, Mic, MicOff, MoreHorizontal, Pin, Radio, Send, Share2, ShieldAlert, SignalHigh, SignalLow, SignalMedium, Sparkles, Trophy, UserMinus, UserPlus, Users, X } from 'lucide-react-native';

type Role = 'host' | 'viewer' | 'guest';
type GuestRequest = { id: string; guest_id: string; stream_id: string; status: string; seat_order?: number; is_muted?: boolean; invited_by?: string | null; created_at?: string; decided_at?: string | null; profiles?: { display_name: string | null; username: string | null; avatar_url: string | null; is_verified?: boolean | null } | null };
type AudienceMember = { id: string; display_name: string | null; username: string | null; avatar_url: string | null; is_verified: boolean | null };
type Supporter = { user: AudienceMember; gifts: number };
type HostSheetTab = 'comments' | 'guests' | 'requests';

export default function LiveRoomScreen() {
  const appHeaderHeight = useAppHeaderHeight();
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
  const [mediaIssue, setMediaIssue] = useState('');
  const [retryingMedia, setRetryingMedia] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [giftSending, setGiftSending] = useState(false);
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
  const [ending, setEnding] = useState(false);
  const [endReason, setEndReason] = useState('تم انتهاء البث');
  const [endCountdown, setEndCountdown] = useState(30);
  const [nextStream, setNextStream] = useState<LiveStream | null>(null);
  const [noMoreStreams, setNoMoreStreams] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [incomingInvite, setIncomingInvite] = useState<GuestRequest | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteCandidates, setInviteCandidates] = useState<InviteCandidate[]>([]);
  const [inviteBusy, setInviteBusy] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const endedRef = useRef(false);
  const previewHostRef = useRef<View | null>(null);
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
  const lastGiftSentAtRef = useRef(0);
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
  useNoCopy();

  const handleConnectionChange = useCallback((state: LiveMediaConnection) => {
    setConnection(state);
    const isConnected = state === 'connected';
    connectedRef.current = isConnected;
    setConnected(isConnected);
  }, []);
  const handleQualityChange = useCallback((next: LiveMediaQuality) => setQuality(next), []);
  const handleMediaStateChange = useCallback((next: LiveMediaState) => setMediaState(next), []);
  const handleApiReady = useCallback((api: LiveMediaApi) => { mediaApiRef.current = api; }, []);

  const handleStreamEnded = useCallback(async (reason: string) => {
    if (endedRef.current) return;
    endedRef.current = true;
    setEndReason(reason);
    setEnding(true);
    setShowReactions(false);
    setError('');
    setEndCountdown(30);
    const streamId = id ? String(id) : '';
    if (streamId) {
      try {
        const next = await fetchNextLiveStream(streamId);
        setNextStream(next);
        setNoMoreStreams(!next);
      } catch {
        setNextStream(null);
        setNoMoreStreams(true);
      }
    } else {
      setNoMoreStreams(true);
    }
  }, [id]);

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
    endedRef.current = false;
    setEnding(false);
    setEndCountdown(30);
    setNextStream(null);
    setNoMoreStreams(false);
    setError('');
    setMediaIssue('');
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
      if (typed.status !== 'live') {
        setLoading(false);
        void handleStreamEnded('تم انتهاء البث');
        return;
      }
      if (typed.host_id !== auth.user.id && Date.now() - new Date(typed.updated_at || typed.started_at).getTime() > 90_000) {
        setLoading(false);
        void handleStreamEnded('انقطع اتصال المضيف وانتهى البث');
        return;
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
        if (next.status === 'ended') void handleStreamEnded('تم انتهاء البث');
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
        } else {
          void fetchMyGuestState(id, currentUserRef.current)
            .then((row) => setIncomingInvite(row && row.status === 'invited' ? (row as unknown as GuestRequest) : null))
            .catch(() => {});
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
          void handleStreamEnded('انقطع اتصال المضيف وانتهى البث');
        }
        if (roleRef.current === 'host') {
          const { data } = await supabase.from('live_guest_requests')
            .select('id,guest_id,stream_id,status,profiles!live_guest_requests_guest_id_fkey(display_name,username,avatar_url)')
            .eq('stream_id', id).eq('status', 'pending').order('created_at', { ascending: true });
          setPendingRequests((data || []) as unknown as GuestRequest[]);
          void loadGuests(id).catch((cause) => console.error('Unable to refresh live guests.', cause));
        } else {
          const primary = await supabase.from('live_guest_requests').select('id,guest_id,stream_id,status,is_muted')
            .eq('stream_id', id).eq('guest_id', currentUserRef.current).maybeSingle();
          const own = primary.error
            ? (await supabase.from('live_guest_requests').select('id,guest_id,stream_id,status')
                .eq('stream_id', id).eq('guest_id', currentUserRef.current).maybeSingle()).data
            : primary.data;
          const status = own?.status;
          if (status === 'invited') {
            setIncomingInvite((current) => (current && current.id === (own as GuestRequest).id ? current : (own as unknown as GuestRequest)));
          } else {
            setIncomingInvite(null);
          }
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
  }, [id, loading, error, loadMessages, loadGuests, handleStreamEnded]);

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

  async function submitGuestRequest() {
    if (!id) return;
    try { await requestLiveGuest(id); setGuestState('pending'); }
    catch (e) { Alert.alert('تعذر إرسال الطلب', e instanceof Error ? e.message : 'حاول مرة أخرى.'); }
  }

  async function startGuestRequest() {
    if (!id) return;
    if (guests.length >= guestLimit) {
      Alert.alert('اكتملت المقاعد', `الحد الحالي ${guestLimit} ضيوف.`);
      return;
    }
    if (Platform.OS === 'web') {
      setPreviewOpen(true);
      return;
    }
    await submitGuestRequest();
  }

  async function openInviteSheet() {
    if (!currentUser) return;
    setInviteOpen(true);
    setInviteBusy('');
    try {
      const candidates = await fetchInviteCandidates(currentUser);
      setInviteCandidates(candidates);
    } catch (e) {
      Alert.alert('تعذر تحميل قائمة الدعوات', e instanceof Error ? e.message : 'حاول مرة أخرى.');
      setInviteOpen(false);
    }
  }

  async function invitePerson(person: InviteCandidate) {
    if (!id) return;
    if (guests.length >= guestLimit) {
      Alert.alert('اكتملت المقاعد', `الحد الحالي ${guestLimit} ضيوف.`);
      setInviteOpen(false);
      return;
    }
    setInviteBusy(person.id);
    try {
      await inviteLiveGuest(id, person.id);
      setInviteOpen(false);
      Alert.alert('تم إرسال الدعوة', 'سيصلك تنبيه عند قبول أو رفض الدعوة.');
    } catch (e) {
      Alert.alert('تعذر إرسال الدعوة', e instanceof Error ? e.message : 'حاول مرة أخرى.');
    } finally {
      setInviteBusy('');
    }
  }

  async function decideInvite(accept: boolean) {
    if (!incomingInvite) return;
    try {
      await respondToLiveInvite(incomingInvite.id, accept);
      setIncomingInvite(null);
      if (accept && id) {
        setRole('guest'); roleRef.current = 'guest'; setGuestState('accepted');
        const credential = await getLiveToken(id, 'guest');
        setRoomUrl(credential.url); setToken(credential.token);
      }
    } catch (e) {
      Alert.alert('تعذر الرد على الدعوة', e instanceof Error ? e.message : 'حاول مرة أخرى.');
    }
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

  async function retryMediaConnection() {
    if (!id || retryingMedia) return;
    setRetryingMedia(true);
    setMediaIssue('');
    try {
      const credentials = await getLiveToken(String(id), role);
      setToken(credentials.token);
      setRoomUrl(credentials.url);
    } catch (cause) {
      setMediaIssue(cause instanceof Error ? cause.message : 'تعذرت إعادة الاتصال. حاول مرة أخرى.');
    } finally {
      setRetryingMedia(false);
    }
  }

  async function sendReaction(emoji: string) {
    const name = currentUserName;
    pushEffect({ emoji, name, kind: 'heart' });
    await heartChannelRef.current?.send({ type: 'broadcast', event: 'heart', payload: { emoji, name } });
    await heartChannelRef.current?.send({ type: 'broadcast', event: 'reaction', payload: { emoji, name } });
    setShowReactions(false);
  }

  async function sendGift(emoji: '🎁' | '💎' | '🌟' | '🔥') {
    if (!id || !currentUser || giftSending || Date.now() - lastGiftSentAtRef.current < 1500) return;
    setGiftSending(true);
    try {
      const { error: giftError } = await supabase.from('live_gift_events').insert({
        stream_id: id,
        sender_id: currentUser,
        emoji,
      });
      if (giftError) throw giftError;
      lastGiftSentAtRef.current = Date.now();
      setGiftOpen(false);
      pushEffect({ emoji, name: currentUserName, kind: 'gift' });
      await heartChannelRef.current?.send({ type: 'broadcast', event: 'gift', payload: { emoji, name: currentUserName } });
      await loadSupporters(id);
    } catch (cause) {
      Alert.alert('تعذر إرسال الهدية', cause instanceof Error ? cause.message : 'حاول مرة أخرى.');
    } finally {
      setGiftSending(false);
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
    if (!id || (!canHideComments && !canTimeoutUsers)) return;
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

  function goToNextStream() {
    if (nextStream) router.replace(`/live/${nextStream.id}`);
    else setNoMoreStreams(true);
  }

  useEffect(() => {
    if (!ending) return;
    if (endCountdown <= 0) { router.replace('/lives'); return; }
    const timer = setTimeout(() => setEndCountdown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [ending, endCountdown]);

  useEffect(() => {
    if (!previewOpen || Platform.OS !== 'web') return;
    let media: MediaStream | null = null;
    let cancelled = false;
    const host = previewHostRef.current as unknown as HTMLElement | null;
    if (!host || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return;
    navigator.mediaDevices.getUserMedia({ video: true, audio: false }).then((stream) => {
      if (cancelled) { stream.getTracks().forEach((track) => track.stop()); return; }
      media = stream;
      const video = document.createElement('video');
      video.autoplay = true; video.muted = true; video.playsInline = true;
      video.srcObject = stream;
      video.style.width = '100%'; video.style.height = '100%'; video.style.objectFit = 'cover';
      host.innerHTML = '';
      host.appendChild(video);
      void video.play().catch(() => {});
    }).catch(() => {});
    return () => {
      cancelled = true;
      if (media) media.getTracks().forEach((track) => track.stop());
      if (host) host.innerHTML = '';
    };
  }, [previewOpen]);

  const endSwipe = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => gesture.dy < -12 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderRelease: (_event, gesture) => { if (gesture.dy < -60) goToNextStream(); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [nextStream]);

  const duration = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
  const hostName = stream?.profiles?.display_name || stream?.profiles?.username || 'جارٍ';
  const mediaAlerts = useMemo(() => {
    const items: string[] = [];
    if (mediaRole && !mediaState.microphoneEnabled) items.push(guestMutedByHost ? 'كتمك المضيف' : 'المايك مكتوم');
    if (mediaRole && !mediaState.cameraEnabled) items.push('الكاميرا متوقفة');
    return items;
  }, [mediaRole, mediaState, guestMutedByHost]);

  if (loading) return <View style={styles.loadingScreen}><StatusBar hidden /><ActivityIndicator size="large" color="#34d399" /><Text style={styles.loadingText}>جارٍ تجهيز البث…</Text></View>;
  if (ending) return <EndedOverlay reason={endReason} countdown={endCountdown} hostName={hostName} nextStream={nextStream} noMoreStreams={noMoreStreams} onNext={goToNextStream} onBrowse={() => router.replace('/lives')} panHandlers={endSwipe.panHandlers} />;
  if (error || !stream) return <View style={styles.errorScreen}><StatusBar hidden /><View style={styles.errorIcon}><Radio color={OASIS.colors.surface} size={30} /></View><Text style={styles.errorTitle}>{error || 'تعذر فتح البث'}</Text><Text style={styles.errorHint}>تأكد من الاتصال بالإنترنت وحاول مرة أخرى.</Text><Pressable oasisKind="action" onPress={() => router.replace('/lives')} style={styles.returnButton}><Text style={styles.returnText}>العودة للبثوث</Text></Pressable></View>;

  return (
    <View style={styles.screen}>
      <StatusBar hidden />
      <View style={styles.stage}>
        <LiveMedia
          {...({ participantOrder: [stream.host_id, ...guests.slice().sort((a, b) => (a.seat_order ?? 999) - (b.seat_order ?? 999)).map((guest) => guest.guest_id)] } as any)}
          url={roomUrl}
          token={token}
          canPublish={mediaRole}
          onConnectionChange={handleConnectionChange}
          onQualityChange={handleQualityChange}
          onMediaStateChange={handleMediaStateChange}
          onApiReady={handleApiReady}
          onReady={() => { connectedRef.current = true; setConnected(true); setMediaIssue(''); }}
          onError={(message) => {
            connectedRef.current = false;
            setConnected(false);
            // An interrupted media connection is recoverable. Never end a live
            // session automatically before the host can reconnect.
            setMediaIssue(message);
          }}
        />

        {/* Full-stage touch catchers intercepted the browser's media-unlock action.
            Use the explicit hide/show controls instead. */}

        <Modal visible={giftOpen} transparent animationType="slide" onRequestClose={() => setGiftOpen(false)}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.62)' }}>
            <Pressable accessibilityLabel="إغلاق الهدايا" onPress={() => setGiftOpen(false)} style={{ flex: 1 }} />
            <View style={{ backgroundColor: '#102b23', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 19, paddingBottom: Math.max(insets.bottom, 22) + 14, borderWidth: 1, borderColor: '#245746' }}>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
                <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>ادعم البث بهدية</Text>
                <Pressable onPress={() => setGiftOpen(false)} accessibilityLabel="إغلاق"><X size={22} color="#fff" /></Pressable>
              </View>
              <Text style={{ textAlign: 'right', color: '#c0d8ce', fontSize: 12, marginBottom: 18 }}>الهدايا رمزية ومجانية، لا تستخدم أموالًا أو رصيدًا مدفوعًا.</Text>
              <View style={{ flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 }}>
                {([
                  ['🎁', 'هدية الجار', 'تشجيع جميل'],
                  ['💎', 'ألماسة', 'تميّز المضيف'],
                  ['🌟', 'نجمة', 'محتوى يستحق'],
                  ['🔥', 'حماس', 'بث رائع'],
                ] as const).map(([emoji, label, description]) => (
                  <Pressable key={emoji} disabled={giftSending} onPress={() => void sendGift(emoji)} style={{ width: '47%', backgroundColor: '#193d31', borderRadius: 18, borderWidth: 1, borderColor: '#30634e', alignItems: 'center', paddingVertical: 18, gap: 5, opacity: giftSending ? 0.55 : 1 }}>
                    <Text style={{ fontSize: 32 }}>{emoji}</Text>
                    <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>{label}</Text>
                    <Text style={{ color: '#b6d6c9', fontSize: 11 }}>{description}</Text>
                    <Text style={{ color: '#6ee7b7', fontSize: 11, fontWeight: '700' }}>مجانية</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
        </Modal>

        {overlayVisible && (
          <>
            <LinearGradient colors={['rgba(2,6,23,0.78)', 'rgba(2,6,23,0.32)', 'rgba(2,6,23,0)']} locations={[0, 0.55, 1]} pointerEvents="none" style={[styles.topGradient, { height: 210 + insets.top }]} />
            <LinearGradient colors={['rgba(2,6,23,0)', 'rgba(2,6,23,0.5)', 'rgba(2,6,23,0.9)']} locations={[0, 0.5, 1]} pointerEvents="none" style={[styles.bottomGradient, { height: 340 + insets.bottom }]} />
          </>
        )}

        {overlayVisible ? (
          <>
            <AppHeader tone="overlay" title="بث مباشر" fallbackRoute="/lives" onBackPress={() => { void handleBack(); }} style={{position: 'absolute', top: 0}} titleContent={<View style={styles.topCenter}>
                <View style={styles.livePill}><View style={styles.redDot} /><Text style={styles.liveText}>مباشر</Text></View>
                {connection === 'connected' && quality !== 'unknown' && (
                  <View style={styles.qualityPill}>
                    {quality === 'excellent' ? <SignalHigh size={14} color="#34d399" /> : quality === 'good' ? <SignalMedium size={14} color="#fbbf24" /> : <SignalLow size={14} color="#fb7185" />}
                    <Text style={styles.qualityText}>{quality === 'excellent' ? 'جودة ممتازة' : quality === 'good' ? 'جودة جيدة' : 'جودة ضعيفة'}</Text>
                  </View>
                )}
              </View>} rightAction={<HeaderAction tone="overlay" accessibilityLabel="مشاهدو البث" onPress={() => setPeoplePanel('viewers')}><Users color={OASIS.colors.surface} size={17}/><Text style={styles.viewerCount}>{viewerCount}</Text></HeaderAction>} />

            <View pointerEvents="box-none" style={[styles.hostOverlay, { top: appHeaderHeight + 8 }]}>
              <View style={styles.hostMeta}>
                {stream.profiles?.avatar_url ? <Image source={{ uri: stream.profiles.avatar_url }} style={styles.hostAvatar} /> : <View style={styles.hostAvatarFallback}><Text style={{ color: OASIS.colors.primary, fontWeight: '700' }}>ح</Text></View>}
                <View style={{ alignItems: 'flex-end', maxWidth: 175 }}>
                  <View style={styles.hostNameRow}>
                    <Text numberOfLines={1} style={styles.hostName}>{hostName}</Text>
                    {stream.profiles?.is_verified && <BadgeCheck color="#34d399" size={14} />}
                    <View style={styles.roleTagHost}><Text style={styles.roleTagHostText}>مضيف</Text></View>
                  </View>
                  <Text numberOfLines={1} style={styles.hostTitle}>{stream.title}</Text>
                </View>
                {role !== 'host' && <Pressable oasisKind="action" onPress={() => void toggleFollow()} style={styles.followButton}><Text style={styles.followText}>{isFollowing ? 'تتابع' : 'متابعة +'}</Text></Pressable>}
              </View>
              {role === 'host' ? <Pressable oasisKind="action" onPress={confirmEnd} style={styles.endButton}><Text style={styles.endText}>إنهاء</Text></Pressable> : <Pressable oasisKind="icon" onPress={showReport} style={styles.roundButton}><MoreHorizontal color={OASIS.colors.surface} size={20} /></Pressable>}
            </View>

            {topSupporters.length > 0 && (
              <Pressable oasisKind="chip" onPress={() => setPeoplePanel('supporters')} style={[styles.supportersPill, { top: appHeaderHeight + 60 }]}>
                <Trophy size={14} color="#fde68a" />
                <Text numberOfLines={1} style={styles.supportersPillText}>الأكثر دعمًا: {topSupporters[0].user.display_name || topSupporters[0].user.username}</Text>
              </Pressable>
            )}
          </>
        ) : (
          <View pointerEvents="box-none" style={[styles.hiddenBar, { top: Math.max(insets.top, 12) }]}>
            {role === 'host' ? (
              <Pressable oasisKind="action" onPress={confirmEnd} style={styles.emergencyButton}><Radio color={OASIS.colors.surface} size={16} /><Text style={styles.emergencyText}>إنهاء</Text></Pressable>
            ) : <View style={styles.roundButtonSpacer} />}
            <Pressable onPress={() => setOverlayVisible(true)} style={styles.hiddenHint}><Eye size={15} color={OASIS.colors.surface} /><Text style={styles.hiddenHintText}>اضغط لإظهار الواجهة</Text></Pressable>
            <View style={styles.roundButtonSpacer} />
          </View>
        )}

        {mediaIssue ? (
          <View style={[styles.connectionBanner, { top: '37%', maxWidth: '86%', flexDirection: 'column' }]}>
            <Text style={[styles.connectionBannerText, { textAlign: 'center' }]}>{mediaIssue}</Text>
            <Pressable accessibilityRole="button" disabled={retryingMedia} onPress={() => void retryMediaConnection()} style={{ backgroundColor: '#047857', borderRadius: 12, paddingVertical: 9, paddingHorizontal: 17, marginTop: 7 }}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>{retryingMedia ? 'جارٍ إعادة الاتصال…' : 'إعادة الاتصال بالبث'}</Text>
            </Pressable>
          </View>
        ) : null}
        {connection === 'reconnecting' && (
          <View pointerEvents="none" style={styles.connectionBanner}><ActivityIndicator color={OASIS.colors.surface} size="small" /><Text style={styles.connectionBannerText}>جارٍ إعادة الاتصال…</Text></View>
        )}
        {connection === 'connecting' && !connected && (
          <View pointerEvents="none" style={styles.connectionBanner}><ActivityIndicator color={OASIS.colors.surface} size="small" /><Text style={styles.connectionBannerText}>جارٍ الاتصال…</Text></View>
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
                <Pressable onPress={() => setPeoplePanel(null)} style={styles.modalClose}><X color={OASIS.colors.surface} size={19} /></Pressable>
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
                <Pressable onPress={() => setHostSheet(null)} style={styles.modalClose}><X color={OASIS.colors.surface} size={19} /></Pressable>
              </View>
              <View style={styles.peopleTabs}>
                <Pressable onPress={() => setHostSheet('comments')} style={[styles.peopleTab, hostSheet === 'comments' && styles.peopleTabActive]}><Text style={styles.peopleTabText}>التعليقات</Text></Pressable>
                <Pressable onPress={() => setHostSheet('guests')} style={[styles.peopleTab, hostSheet === 'guests' && styles.peopleTabActive]}><Text style={styles.peopleTabText}>الضيوف ({guests.length})</Text></Pressable>
                <Pressable onPress={() => setHostSheet('requests')} style={[styles.peopleTab, hostSheet === 'requests' && styles.peopleTabActive]}><Text style={styles.peopleTabText}>الطلبات ({pendingRequests.length})</Text></Pressable>
              </View>
              <ScrollView style={styles.hostSheetList}>
                {hostSheet === 'comments' && messages.slice().reverse().map((message) => (
                  <View key={message.id} style={styles.hostCommentRow}>
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <Text style={styles.hostCommentName}>{message.profiles?.display_name || message.profiles?.username || 'جارٍ'}</Text>
                      <Text numberOfLines={2} style={styles.hostCommentBody}>{message.body}</Text>
                    </View>
                    <Pressable onPress={() => void pinMessage(message)} style={[styles.hostAction, message.is_pinned && styles.hostActionActive]}><Pin size={15} color={message.is_pinned ? OASIS.colors.live : OASIS.colors.surface} /></Pressable>
                    <Pressable onPress={() => void hideMessage(message)} style={styles.hostActionDanger}><EyeOff size={15} color={OASIS.colors.surface} /></Pressable>
                  </View>
                ))}
                {hostSheet === 'comments' && messages.length === 0 && <Text style={styles.peopleEmpty}>لا توجد تعليقات بعد.</Text>}
                {hostSheet === 'guests' && (
                  <Pressable oasisKind="action" onPress={() => void openInviteSheet()} style={styles.inviteRowButton}><UserPlus size={15} color="#a7f3d0" /><Text style={styles.inviteRowButtonText}>دعوة صديق للصعود</Text></Pressable>
                )}
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
                    <Pressable accessibilityLabel="رفع ترتيب الضيف" disabled={guestIndex === 0} onPress={() => void moveGuest(guest, -1)} style={[styles.hostAction, guestIndex === 0 && { opacity: 0.35 }]}><ChevronUp size={15} color={OASIS.colors.surface} /></Pressable>
                    <Pressable accessibilityLabel="خفض ترتيب الضيف" disabled={guestIndex === guests.length - 1} onPress={() => void moveGuest(guest, 1)} style={[styles.hostAction, guestIndex === guests.length - 1 && { opacity: 0.35 }]}><ChevronDown size={15} color={OASIS.colors.surface} /></Pressable>
                    <Pressable onPress={() => void toggleGuestMute(guest)} style={[styles.hostAction, guest.is_muted && styles.hostActionActive]}>{guest.is_muted ? <MicOff size={15} color={OASIS.colors.live} /> : <Mic size={15} color={OASIS.colors.surface} />}</Pressable>
                    <Pressable onPress={() => removeGuest(guest)} style={styles.hostActionDanger}><UserMinus size={15} color={OASIS.colors.surface} /></Pressable>
                  </View>
                ))}
                {hostSheet === 'guests' && guests.length === 0 && <Text style={styles.peopleEmpty}>لا يوجد ضيوف في البث الآن.</Text>}
                {hostSheet === 'requests' && (
                  <View style={styles.hostPanelHeader}>
                    <Text style={styles.hostPanelTitle}>طابور طلبات الصعود</Text>
                    <Pressable onPress={() => void openInviteSheet()} style={styles.hostPanelCta}><UserPlus size={14} color={OASIS.colors.surface} /><Text style={styles.hostPanelCtaText}>دعوة صديق</Text></Pressable>
                  </View>
                )}
                {hostSheet === 'requests' && pendingRequests.map((request, index) => (
                  <View key={request.id} style={styles.queueRow}>
                    <Text style={styles.peopleRank}>{index + 1}</Text>
                    {request.profiles?.avatar_url ? <Image source={{ uri: request.profiles.avatar_url }} style={styles.peopleAvatar} /> : <View style={styles.peopleAvatarFallback}><Text style={styles.peopleInitial}>{(request.profiles?.display_name || request.profiles?.username || 'ح').slice(0, 1)}</Text></View>}
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <Text numberOfLines={1} style={styles.peopleName}>{request.profiles?.display_name || request.profiles?.username || 'مستخدم'}</Text>
                      {request.created_at && <Text style={styles.requestWait}>بانتظار {waitingLabel(request.created_at)}</Text>}
                    </View>
                    <Pressable oasisKind="icon" accessibilityLabel="قبول" onPress={() => void decideGuest(request, 'accepted')} style={styles.acceptButton}><Check color={OASIS.colors.surface} size={15} /></Pressable>
                    <Pressable oasisKind="icon" accessibilityLabel="رفض" onPress={() => void decideGuest(request, 'rejected')} style={styles.rejectButton}><X color={OASIS.colors.surface} size={15} /></Pressable>
                  </View>
                ))}
                {hostSheet === 'requests' && pendingRequests.length === 0 && <Text style={styles.peopleEmpty}>لا توجد طلبات صعود الآن. يمكنك دعوة صديق مباشرة.</Text>}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>

        <Modal visible={inviteOpen} transparent animationType="slide" onRequestClose={() => setInviteOpen(false)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setInviteOpen(false)}>
            <Pressable style={styles.hostSheet} onPress={(event) => event.stopPropagation()}>
              <View style={styles.peopleSheetHeader}>
                <Text style={styles.peopleSheetTitle}>دعوة ضيف</Text>
                <Pressable onPress={() => setInviteOpen(false)} style={styles.modalClose}><X color={OASIS.colors.surface} size={19} /></Pressable>
              </View>
              <Text style={styles.hostPanelHint}>اختر شخصًا من متابَعيك لدعوته للصعود كضيف على الهواء.</Text>
              <ScrollView style={styles.hostSheetList}>
                {inviteCandidates.map((person) => (
                  <View key={person.id} style={styles.peopleRow}>
                    {person.avatar_url ? <Image source={{ uri: person.avatar_url }} style={styles.peopleAvatar} /> : <View style={styles.peopleAvatarFallback}><Text style={styles.peopleInitial}>{(person.display_name || person.username || 'ح').slice(0, 1)}</Text></View>}
                    <Text numberOfLines={1} style={styles.peopleName}>{person.display_name || person.username || 'صديق'}</Text>
                    <Pressable oasisKind="action" disabled={inviteBusy === person.id} onPress={() => void invitePerson(person)} style={[styles.invitePersonButton, inviteBusy === person.id && { opacity: 0.5 }]}><UserPlus size={15} color={OASIS.colors.surface} /><Text style={styles.invitePersonText}>دعوة</Text></Pressable>
                  </View>
                ))}
                {inviteCandidates.length === 0 && <Text style={styles.peopleEmpty}>لا يوجد متابَعون بعد. تابع أحدهم أولًا لتدعوه.</Text>}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>

        <Modal visible={previewOpen} transparent animationType="fade" onRequestClose={() => setPreviewOpen(false)}>
          <View style={styles.previewBackdrop}>
            <View style={styles.previewSheet}>
              <Text style={styles.previewTitle}>معاينة الكاميرا</Text>
              <Text style={styles.previewHint}>تأكد من مظهرك قبل إرسال طلب الصعود.</Text>
              <View ref={previewHostRef} style={styles.previewViewport}>
                {Platform.OS !== 'web' && <Text style={styles.previewFallback}>المعاينة الحية متاحة على الويب.</Text>}
              </View>
              <View style={styles.previewActions}>
                <Pressable onPress={() => setPreviewOpen(false)} style={styles.previewCancel}><Text style={styles.previewCancelText}>إلغاء</Text></Pressable>
                <Pressable onPress={() => { setPreviewOpen(false); void submitGuestRequest(); }} style={styles.previewSend}><Text style={styles.previewSendText}>إرسال طلب الصعود</Text></Pressable>
              </View>
            </View>
          </View>
        </Modal>

        <LiveModerationPanel visible={moderationOpen} onClose={() => setModerationOpen(false)} settings={moderation.settings} moderators={moderation.moderators} loading={moderation.loading} error={moderation.error} isHost={role === 'host'} canManageSettings={canManageFilters} currentUserId={currentUser} onRefresh={moderation.refresh} onSaveSettings={moderation.saveSettings} onManageModerator={moderation.manageModerator} />

        {overlayVisible && (
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0} style={styles.bottomOverlay}>
            {role === 'host' && controlsOpen && pendingRequests.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.requestRow}>
                {pendingRequests.map((request) => (
                  <OasisSurface oasisSurface="card" key={request.id} style={styles.requestCard}>
                    <Text style={styles.requestName}>{request.profiles?.display_name || request.profiles?.username || 'مستخدم'} يطلب الصعود</Text>
                    {request.created_at && <Text style={styles.requestWait}>بانتظار {waitingLabel(request.created_at)}</Text>}
                    <Pressable oasisKind="icon" accessibilityLabel="قبول" onPress={() => void decideGuest(request, 'accepted')} style={styles.acceptButton}><Check color={OASIS.colors.surface} size={15} /></Pressable>
                    <Pressable oasisKind="icon" accessibilityLabel="رفض" onPress={() => void decideGuest(request, 'rejected')} style={styles.rejectButton}><X color={OASIS.colors.surface} size={15} /></Pressable>
                  </OasisSurface>
                ))}
                <Pressable oasisKind="action" onPress={() => void openInviteSheet()} style={styles.requestInviteButton}><UserPlus size={15} color={OASIS.colors.surface} /><Text style={styles.requestInviteText}>دعوة صديق</Text></Pressable>
              </ScrollView>
            )}

            {pinnedMessage && (
              <View style={styles.pinnedBanner}>
                <Pin size={13} color="#a7f3d0" />
                <Text numberOfLines={2} style={styles.pinnedText}><Text style={styles.pinnedAuthor}>{pinnedMessage.profiles?.display_name || pinnedMessage.profiles?.username || 'مثبّت'}: </Text>{pinnedMessage.body}</Text>
              </View>
            )}

            {incomingInvite && (
              <View style={styles.inviteBanner}>
                <Sparkles size={15} color="#a7f3d0" />
                <Text style={styles.inviteBannerText}>دعاك المضيف للصعود كضيف على الهواء</Text>
                <Pressable onPress={() => void decideInvite(true)} style={styles.inviteAccept}><Text style={styles.inviteAcceptText}>قبول</Text></Pressable>
                <Pressable onPress={() => void decideInvite(false)} style={styles.inviteDecline}><Text style={styles.inviteDeclineText}>رفض</Text></Pressable>
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
              <LiveHostControlBar
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
              <>
                {showReactions && (
                  <View style={styles.reactionBar}>
                    {['❤️', '😂', '😮', '👏', '🔥', '🎉'].map((emoji) => (
                      <Pressable key={emoji} onPress={() => void sendReaction(emoji)} style={styles.reactionItem}><Text style={styles.reactionEmoji}>{emoji}</Text></Pressable>
                    ))}
                  </View>
                )}
                <View style={[styles.actionRow, { paddingBottom: Math.max(insets.bottom, 10) }]}>
                  <Pressable oasisKind="action" onPress={() => setShowReactions((value) => !value)} style={[styles.actionButton, showReactions && styles.actionButtonActive]}><Heart size={22} color={OASIS.colors.surface} fill="#fb7185" /><Text style={styles.actionLabel}>تفاعل</Text></Pressable>
                  <Pressable oasisKind="action" onPress={() => setGiftOpen(true)} style={[styles.actionButton, { backgroundColor: 'rgba(251,191,36,0.12)', borderRadius: 16, padding: 5 }]}><Gift size={23} color="#fde68a" /><Text style={styles.actionLabel}>ادعم</Text></Pressable>
                  <Pressable oasisKind="action" onPress={() => setShowChat((value) => !value)} style={styles.actionButton}><MessageCircle size={20} color={OASIS.colors.surface} /><Text style={styles.actionLabel}>{showChat ? 'إخفاء' : 'التعليقات'}</Text></Pressable>
                  <Pressable oasisKind="action" onPress={() => setOverlayVisible(false)} style={styles.actionButton}><EyeOff size={20} color={OASIS.colors.surface} /><Text style={styles.actionLabel}>وضع</Text></Pressable>
                  {guestState !== 'accepted' && (
                    <Pressable oasisKind="action" disabled={guestState !== 'idle'} onPress={startGuestRequest} style={[styles.actionButton, guestState !== 'idle' && { opacity: 0.7 }]}><UserPlus size={21} color={OASIS.colors.surface} /><Text style={styles.actionLabel}>{guestState === 'pending' ? 'بانتظار المضيف' : 'اطلب الصعود'}</Text></Pressable>
                  )}
                  {moderatorPermissions && <Pressable oasisKind="action" onPress={() => setModerationOpen(true)} style={styles.actionButton}><ShieldAlert size={20} color="#a7f3d0" /><Text style={styles.actionLabel}>إشراف</Text></Pressable>}
                  <Pressable oasisKind="action" onPress={showReport} style={styles.actionButton}><ShieldAlert size={20} color={OASIS.colors.surface} /><Text style={styles.actionLabel}>إبلاغ</Text></Pressable>
                  <Pressable oasisKind="action" onPress={() => void shareLive()} style={styles.actionButton}><Share2 size={19} color={OASIS.colors.surface} /><Text style={styles.actionLabel}>مشاركة</Text></Pressable>
                  <View style={styles.durationPill}><Text style={styles.durationText}>{duration}</Text></View>
                </View>
              </>
            )}

            <View style={[styles.inputBar, { marginBottom: Math.max(insets.bottom, 8) }]}>
              <Pressable oasisVariant="primary" oasisKind="action" onPress={() => void sendMessage()} disabled={!chatInput.trim() || sending} style={[styles.sendButton, (!chatInput.trim() || sending) && { opacity: 0.5 }]}><Send color={OASIS.colors.surface} size={16} /></Pressable>
              <TextInput value={chatInput} onChangeText={setChatInput} placeholder="أضف تعليقًا…" placeholderTextColor="#cbd5e1" maxLength={300} style={styles.chatInput} returnKeyType="send" onSubmitEditing={() => void sendMessage()} />
              <View style={styles.commentIcon}><MessageCircle size={18} color={OASIS.colors.surface} /></View>
            </View>
          </KeyboardAvoidingView>
        )}
      </View>
    </View>
  );
}

function waitingLabel(iso: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return `${seconds} ث`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} د`;
  return `${Math.floor(minutes / 60)} س`;
}

function EndedOverlay({ reason, countdown, hostName, nextStream, noMoreStreams, onNext, onBrowse, panHandlers }: {
  reason: string;
  countdown: number;
  hostName: string;
  nextStream: LiveStream | null;
  noMoreStreams: boolean;
  onNext: () => void;
  onBrowse: () => void;
  panHandlers: GestureResponderHandlers;
}) {
  return (
    <View style={styles.endedScreen} {...panHandlers}>
      <StatusBar hidden />
      <View style={styles.endedBadge}><Radio color={OASIS.colors.surface} size={32} /></View>
      <Text style={styles.endedTitle}>تم انتهاء البث</Text>
      <Text style={styles.endedHint}>{reason === 'تم انتهاء البث' ? `أنهى ${hostName} البث. يمكنك الانتقال إلى بث آخر.` : reason}</Text>
      <View style={styles.endedCountdownRing}><Text style={styles.endedCountdownText}>{countdown}</Text></View>
      {nextStream ? (
        <OasisSurface oasisSurface="card" style={styles.endedNextCard}>
          <Text style={styles.endedNextLabel}>بث مباشر آخر</Text>
          <View style={styles.endedNextRow}>
            {nextStream.profiles?.avatar_url ? <Image source={{ uri: nextStream.profiles.avatar_url }} style={styles.endedNextAvatar} /> : <View style={styles.endedNextAvatarFallback}><Text style={styles.endedNextInitial}>{(nextStream.profiles?.display_name || nextStream.profiles?.username || 'ح').slice(0, 1)}</Text></View>}
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text numberOfLines={1} style={styles.endedNextName}>{nextStream.profiles?.display_name || nextStream.profiles?.username || 'بث مباشر'}</Text>
              <Text numberOfLines={1} style={styles.endedNextTitle}>{nextStream.title}</Text>
            </View>
          </View>
          <Pressable oasisKind="action" onPress={onNext} style={styles.endedNextButton}><ChevronUp size={16} color={OASIS.colors.primary} /><Text style={styles.endedNextButtonText}>انتقل إلى هذا البث</Text></Pressable>
        </OasisSurface>
      ) : (
        <View style={styles.endedEmpty}>
          <Text style={styles.endedEmptyText}>{noMoreStreams ? 'لا يوجد بثوث أخرى' : 'جارٍ البحث عن بث آخر…'}</Text>
          <Text style={styles.endedEmptyHint}>اسحب للأعلى للبحث أو تصفّح كل البثوث.</Text>
        </View>
      )}
      <View style={styles.endedSwipeHint}><ChevronUp size={16} color="#6ee7b7" /><Text style={styles.endedSwipeText}>اسحب للأعلى للانتقال لبث آخر</Text></View>
      <Pressable onPress={onBrowse} style={styles.endedBrowse}><Text style={styles.endedBrowseText}>تصفّح كل البثوث</Text></Pressable>
    </View>
  );
}
