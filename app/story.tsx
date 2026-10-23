import { headerTopInset } from '@/components/shared/AppHeader';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Platform,
  Image,
  Dimensions,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Animated,
  PanResponder,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { isActiveStory } from '@/lib/storyActivity';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { requireAccount } from '@/lib/authGate';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Send, Eye, Heart, Trash2, ChevronLeft, ChevronRight, Flag, Ban, MoreVertical, UserRound } from 'lucide-react-native';

const { width, height } = Dimensions.get('window');
const STORY_DURATION = 7000; // 7 seconds per story

export default function StoryViewer() {
  const headerInsets = useSafeAreaInsets();
  const { id, resume } = useLocalSearchParams<{ id: string; resume?: string }>();
  const [storiesList, setStoriesList] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [author, setAuthor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const activeLikeStory = useRef<string | undefined>(undefined);
  activeLikeStory.current = storiesList[currentIndex]?.id;
  const [liked, setLiked] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [likesReady, setLikesReady] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  useEffect(() => {
    let active = true;
    setLiked(false); setLikesReady(false); setLikeCount(0);
    if (!currentStoryIdForLikes()) return;
    const storyId = storiesList[currentIndex]?.id;
    (async () => {
      const [mine, count] = await Promise.all([
        supabase.from('story_likes').select('story_id').eq('story_id', storyId).eq('user_id', currentUserId).maybeSingle(),
        supabase.from('story_likes').select('story_id', { count: 'exact', head: true }).eq('story_id', storyId),
      ]);
      if (!active || mine.error || count.error) return;
      setLiked(Boolean(mine.data)); setLikeCount(count.count || 0); setLikesReady(true);
    })().catch(() => {});
    return () => { active = false; };
    function currentStoryIdForLikes() { return Boolean(storiesList[currentIndex]?.id && currentUserId); }
  }, [storiesList[currentIndex]?.id, currentUserId]);
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [canReply, setCanReply] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [pollVotes, setPollVotes] = useState<number[]>([0, 0]);
  const [myPollVote, setMyPollVote] = useState<number | null>(null);
  const [questionAnswer, setQuestionAnswer] = useState('');
  const [questionSent, setQuestionSent] = useState(false);
  const [questionResponses, setQuestionResponses] = useState<Array<{ answer: string; responder_id: string; created_at: string }>>([]);
  const [interactiveSending, setInteractiveSending] = useState(false);
  const [uiVisible, setUiVisible] = useState(true);
  const hideUiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressActive = useRef(false);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dy) > 14 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.25,
    onPanResponderRelease: (_event, gesture) => {
      if (gesture.dy > 105 && Math.abs(gesture.dx) < 90) {
        if (hideUiTimer.current) clearTimeout(hideUiTimer.current);
        router.back();
      }
    },
  })).current;

  function revealUi() {
    setUiVisible(true);
    if (hideUiTimer.current) clearTimeout(hideUiTimer.current);
    if (!showReplyBox && !isPaused) {
      hideUiTimer.current = setTimeout(() => setUiVisible(false), 2600);
    }
  }

  function handleStoryPressIn() {
    // A fresh touch starts a new gesture; long presses are marked below.
    longPressActive.current = false;
    revealUi();
  }

  function handleStoryLongPress() {
    longPressActive.current = true;
    setIsPaused(true);
    setUiVisible(true);
    if (hideUiTimer.current) clearTimeout(hideUiTimer.current);
  }

  function handleStoryPressOut() {
    if (longPressActive.current) {
      // Keep the marker until onPress is suppressed, or the next touch begins.
      setIsPaused(false);
      revealUi();
    }
  }
  const currentStory = storiesList[currentIndex];

  useEffect(() => {
    let cancelled = false;
    async function loadInteractiveState() {
      if (!currentStory?.id) return;
      setMyPollVote(null);
      setPollVotes([0, 0]);
      setQuestionAnswer('');
      setQuestionSent(false);
      setQuestionResponses([]);

      if (currentStory.interactive_type === 'poll') {
        const { data: votes, error } = await supabase
          .from('story_poll_votes')
          .select('option_index')
          .eq('story_id', currentStory.id);
        if (cancelled || error) return;
        const rows = votes || [];
        setPollVotes([
          rows.filter((row: { option_index: number }) => row.option_index === 0).length,
          rows.filter((row: { option_index: number }) => row.option_index === 1).length,
        ]);
        if (currentUserId) {
          const { data: ownVote } = await supabase
            .from('story_poll_votes')
            .select('option_index')
            .eq('story_id', currentStory.id)
            .eq('voter_id', currentUserId)
            .maybeSingle();
          if (!cancelled && ownVote) setMyPollVote(ownVote.option_index);
        }
      }

      if (currentStory.interactive_type === 'question' && currentUserId === currentStory.author_id) {
        const { data: answers } = await supabase
          .from('story_question_answers')
          .select('answer, responder_id, created_at')
          .eq('story_id', currentStory.id)
          .order('created_at', { ascending: false });
        if (!cancelled) setQuestionResponses((answers || []) as Array<{ answer: string; responder_id: string; created_at: string }>);
      }
    }
    void loadInteractiveState();
    return () => { cancelled = true; };
  }, [currentStory?.id, currentStory?.interactive_type, currentUserId]);

  async function votePoll(optionIndex: number) {
    if (!currentStory?.id) return;
    if (!currentUserId) {
      Alert.alert('تسجيل الدخول', 'سجّل الدخول للتصويت في الاستطلاع.');
      return;
    }
    setInteractiveSending(true);
    try {
      const { error } = await supabase.from('story_poll_votes').upsert({
        story_id: currentStory.id,
        voter_id: currentUserId,
        option_index: optionIndex,
      }, { onConflict: 'story_id,voter_id' });
      if (error) throw error;
      setMyPollVote(optionIndex);
      const { data: votes, error: votesError } = await supabase
        .from('story_poll_votes')
        .select('option_index')
        .eq('story_id', currentStory.id);
      if (votesError) throw votesError;
      const rows = votes || [];
      setPollVotes([
        rows.filter((row: { option_index: number }) => row.option_index === 0).length,
        rows.filter((row: { option_index: number }) => row.option_index === 1).length,
      ]);
    } catch (error) {
      Alert.alert('تعذر تسجيل التصويت', error instanceof Error ? error.message : 'حاول مجددًا.');
    } finally {
      setInteractiveSending(false);
    }
  }

  async function submitQuestionAnswer() {
    const answer = questionAnswer.trim();
    if (!currentStory?.id || !answer) return;
    if (!currentUserId) {
      Alert.alert('تسجيل الدخول', 'سجّل الدخول لإرسال إجابتك.');
      return;
    }
    setInteractiveSending(true);
    try {
      const { error } = await supabase.from('story_question_answers').insert({
        story_id: currentStory.id,
        responder_id: currentUserId,
        answer,
      });
      if (error) throw error;
      setQuestionSent(true);
      setQuestionAnswer('');
      Alert.alert('تم الإرسال', 'وصلت إجابتك إلى صاحب القصة.');
    } catch (error) {
      Alert.alert('تعذر إرسال الإجابة', error instanceof Error ? error.message : 'حاول مجددًا.');
    } finally {
      setInteractiveSending(false);
    }
  }

  // 1. Initial Load: Fetch active stories for this author
  useEffect(() => {
    loadStoriesSequence();
    return () => {
      if (hideUiTimer.current) clearTimeout(hideUiTimer.current);
    };
  }, [id]);

  useEffect(() => {
    setUiVisible(true);
    if (hideUiTimer.current) clearTimeout(hideUiTimer.current);
    if (!showReplyBox && !isPaused) {
      hideUiTimer.current = setTimeout(() => setUiVisible(false), 2600);
    }
    return () => {
      if (hideUiTimer.current) clearTimeout(hideUiTimer.current);
    };
  }, [currentIndex, showReplyBox, isPaused]);

  async function loadStoriesSequence() {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (u?.user) {
      setCurrentUserId(u.user.id);
    } else {
      setCurrentUserId('');
      setStoriesList([]);
      setLoading(false);
      requireAccount('اليوميات متاحة لأعضاء حيّنا فقط. سجّل الدخول أو أنشئ حساباً للمشاهدة.');
      router.replace('/auth');
      return;
    }

    // Fetch the target story first
    const { data: targetStory } = await supabase
      .from('stories')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!targetStory) {
      setLoading(false);
      return;
    }

    // Load author profile
    const { data: p } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', targetStory.author_id)
      .maybeSingle();
    setAuthor(p);

    // Fetch ALL active stories for this author in chronological order
    const nowIso = new Date().toISOString();
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: allAuthorStories } = await supabase
      .from('stories')
      .select('*')
      .eq('author_id', targetStory.author_id)
      .or(`expires_at.gt.${nowIso},and(expires_at.is.null,created_at.gte.${yesterday})`)
      .order('created_at', { ascending: true });

    const sequence = !isActiveStory(targetStory) && targetStory.author_id === u.user.id ? [targetStory] : (allAuthorStories || []).filter(story => isActiveStory(story));
    if (!sequence.length) { setStoriesList([]); setLoading(false); return; }
    setStoriesList(sequence);

    // Resume the last viewed story only when opening from the author story ring.
    let targetIdx = sequence.findIndex(s => s.id === targetStory.id);
    if (resume === '1') {
      try {
        const savedStoryId = await AsyncStorage.getItem(`story_resume_${targetStory.author_id}`);
        const savedIdx = savedStoryId ? sequence.findIndex(s => s.id === savedStoryId) : -1;
        if (savedIdx >= 0) targetIdx = savedIdx;
      } catch {}
    }
    setCurrentIndex(targetIdx >= 0 ? targetIdx : 0);

    // Per-story reply permissions are recalculated when the active story changes.
    setCanReply(false);

    setLoading(false);
  }

  useEffect(() => {
    if (!currentStory?.id || !currentStory?.author_id) return;
    AsyncStorage.setItem(`story_resume_${currentStory.author_id}`, String(currentStory.id)).catch(() => {});
  }, [currentStory?.id, currentStory?.author_id]);

  // Respect the reply policy of the currently displayed story (not just the first story).
  useEffect(() => {
    let cancelled = false;
    async function checkReplyPermission() {
      setCanReply(false);
      if (!currentStory?.id || !currentUserId || currentStory.author_id === currentUserId || currentStory.allow_replies === false) {
        setCanReply(false);
        return;
      }
      if (author?.allow_story_replies === 'nobody' || author?.allow_dms === 'nobody') {
        setCanReply(false);
        return;
      }
      if (author?.allow_story_replies === 'followers' || author?.allow_dms === 'followers') {
        const { data: followRecord, error } = await supabase
          .from('follows')
          .select('id')
          .eq('follower_id', currentUserId)
          .eq('following_id', currentStory.author_id)
          .maybeSingle();
        if (!cancelled) setCanReply(!error && Boolean(followRecord));
        return;
      }
      if (!cancelled) setCanReply(true);
    }
    void checkReplyPermission();
    return () => { cancelled = true; };
  }, [currentStory?.id, currentStory?.allow_replies, currentUserId, author?.allow_story_replies, author?.allow_dms]);

  // 2. Animate Progress Bar and Auto-Advance
  useEffect(() => {
    if (!currentStory || isPaused || showReplyBox) return;

    // Reset progress
    progressAnim.setValue(0);

    const animation = Animated.timing(progressAnim, {
      toValue: 1,
      duration: STORY_DURATION,
      useNativeDriver: false,
    });

    animation.start(({ finished }) => {
      if (finished) {
        handleNextStory();
      }
    });

    // Record view & increment view count for current story
    if (currentUserId && currentStory?.id) {
      supabase.rpc('record_story_view', { p_story_id: currentStory.id }).then(() => {});
    }

    return () => animation.stop();
  }, [currentIndex, isPaused, showReplyBox, storiesList.length]);


  useEffect(() => {
    const nextStory = storiesList[currentIndex + 1];
    if (nextStory?.type === 'image' && nextStory.image_url) {
      Image.prefetch(nextStory.image_url).catch(() => {});
    }
  }, [currentIndex, storiesList]);

  function showStoryViewers() {
    if (!currentStory?.id || currentStory.author_id !== currentUserId) return;
    router.push({ pathname: '/story-viewers', params: { id: currentStory.id } });
  }

  function handleNextStory() {
    if (longPressActive.current) {
      longPressActive.current = false;
      return;
    }
    if (currentIndex < storiesList.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      router.back();
    }
  }

  function handlePrevStory() {
    if (longPressActive.current) {
      longPressActive.current = false;
      return;
    }
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  }

  async function submitStoryReport(reason: 'spam' | 'harassment' | 'inappropriate' | 'misinformation' | 'other') {
    if (!currentStory?.id || !currentUserId || isOwn) return;
    const { error } = await supabase.from('story_reports').insert({
      story_id: currentStory.id,
      reporter_id: currentUserId,
      author_id: currentStory.author_id,
      reason,
    });
    if (error) {
      Alert.alert('تعذر إرسال البلاغ', 'حاول مجددًا بعد قليل.');
      return;
    }
    Alert.alert('تم استلام البلاغ', 'شكرًا لمساعدتنا في الحفاظ على مجتمع آمن.');
  }

  async function blockStoryAuthor() {
    if (!currentStory?.author_id || !currentUserId || isOwn) return;
    const { error } = await supabase.from('blocks').upsert({
      blocker_id: currentUserId,
      blocked_id: currentStory.author_id,
    }, { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true });
    if (error) {
      Alert.alert('تعذر حظر الحساب', error.message || 'حاول مرة أخرى.');
      return;
    }
    Alert.alert('تم حظر الحساب', 'لن تظهر قصص هذا الحساب لك بعد تحديث القائمة.', [
      { text: 'حسنًا', onPress: () => router.back() },
    ]);
  }

  function openStorySafetyMenu() {
    Alert.alert('خيارات القصة', 'اختر الإجراء المطلوب', [
      { text: 'إبلاغ عن قصة', onPress: () => Alert.alert('سبب البلاغ', 'اختر السبب الأقرب للمشكلة', [
        { text: 'محتوى غير لائق', onPress: () => void submitStoryReport('inappropriate') },
        { text: 'مضايقة أو إساءة', onPress: () => void submitStoryReport('harassment') },
        { text: 'معلومات مضللة', onPress: () => void submitStoryReport('misinformation') },
        { text: 'رسائل مزعجة أو احتيال', onPress: () => void submitStoryReport('spam') },
        { text: 'سبب آخر', onPress: () => void submitStoryReport('other') },
        { text: 'إلغاء', style: 'cancel' },
      ]) },
      { text: 'حظر صاحب الحساب', style: 'destructive', onPress: () => Alert.alert('حظر الحساب؟', 'لن تظهر لك قصص هذا الحساب، ويمكن إدارة الحظر لاحقًا من إعدادات الحساب.', [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'حظر', style: 'destructive', onPress: () => void blockStoryAuthor() },
      ]) },
      { text: 'إلغاء', style: 'cancel' },
    ]);
  }

  // Delete active story (if owner)
  function confirmDeleteStory() {
    if (!currentStory) return;
    setIsPaused(true);

    Alert.alert('حذف القصة', 'هل أنت متأكد من حذف هذه الشريحة من يومياتك؟', [
      { text: 'إلغاء', style: 'cancel', onPress: () => setIsPaused(false) },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          const deleted = await supabase.from('stories').delete().eq('id', currentStory.id).eq('author_id', currentUserId).select('id').single();
          if (deleted.error || !deleted.data) { Alert.alert('تعذر الحذف', 'لم يتم حذف اليومية. حاول مجددًا.'); setIsPaused(false); return; }
          const remaining = storiesList.filter(s => s.id !== currentStory.id);
          if (remaining.length === 0) {
            router.back();
          } else {
            setStoriesList(remaining);
            setCurrentIndex(prev => Math.min(prev, remaining.length - 1));
            setIsPaused(false);
          }
        },
      },
    ]);
  }

  // Send DM reply
  async function sendReply() {
    if (!replyText.trim() || !currentStory || sending) return;
    if (!currentUserId) {
      Alert.alert('تسجيل الدخول', 'يرجى تسجيل الدخول للرد على القصة', [
        { text: 'تسجيل الدخول', onPress: () => router.push('/auth') },
        { text: 'إلغاء', style: 'cancel' },
      ]);
      return;
    }
    if (currentStory.allow_replies === false || !canReply) {
      Alert.alert('الردود غير متاحة', 'لا يمكن إرسال رد على هذه القصة وفق إعدادات الخصوصية.');
      setShowReplyBox(false);
      return;
    }
    setSending(true);
    const msgText = replyText.trim();

    try {
      const { error } = await supabase.from('story_replies').insert({ story_id: currentStory.id, sender_id: currentUserId, body: msgText });
      if (error) throw error;
      setReplyText(''); setShowReplyBox(false); setSending(false);
      Alert.alert('تم إرسال الرد', 'يمكنك متابعة المحادثة في الرسائل الخاصة.', [{ text: 'فتح الرسائل', onPress: () => router.replace('/messages') }, { text: 'لاحقًا' }]);
    } catch (e: any) {
      setSending(false);
      Alert.alert('خطأ', e.message);
    }
  }

  async function handleLike() {
    if (!currentUserId || !currentStory || likeBusy || !likesReady) return;
    const storyId = currentStory.id;
    setLikeBusy(true);
    try {
      const result = liked
        ? await supabase.from('story_likes').delete().eq('story_id', storyId).eq('user_id', currentUserId)
        : await supabase.from('story_likes').upsert({ story_id: storyId, user_id: currentUserId }, { onConflict: 'story_id,user_id', ignoreDuplicates: true });
      if (result.error) throw result.error;
      if (activeLikeStory.current === storyId) { setLiked(!liked); setLikeCount(value => Math.max(0, value + (liked ? -1 : 1))); }
    } catch { Alert.alert('تعذر حفظ الإعجاب', 'تحقق من الاتصال وحاول مجددًا.'); }
    finally { setLikeBusy(false); }
  }

  function handleOpenReply() {
    if (!currentUserId) {
      Alert.alert('تسجيل الدخول', 'يرجى تسجيل الدخول للرد على القصة', [
        { text: 'تسجيل الدخول', onPress: () => router.push('/auth') },
        { text: 'إلغاء', style: 'cancel' },
      ]);
      return;
    }
    setShowReplyBox(true);
  }

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }

  if (!currentStory) {
    return (
      <View style={styles.loadingScreen}>
        <Text style={styles.notFoundText}>القصة غير موجودة أو انتهت مدتها ⏳</Text>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>العودة</Text>
        </Pressable>
      </View>
    );
  }

  const isOwn = currentUserId === currentStory.author_id;
  const timeLeft = Math.max(0, Math.floor((new Date(currentStory.expires_at).getTime() - Date.now()) / (1000 * 60 * 60)));

  const gradColors = currentStory.bg_color
    ? [currentStory.bg_color, shiftColor(currentStory.bg_color)] as [string, string]
    : ['#065f46', '#059669'] as [string, string];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.container} {...panResponder.panHandlers}>
        {/* Story Background */}
        {currentStory.type === 'image' && currentStory.image_url ? (
          <Image
            key={currentStory.image_url}
            source={{ uri: currentStory.image_url }}
            style={styles.bgImage}
            resizeMode="cover"
            resizeMethod="scale"
            fadeDuration={0}
            accessibilityLabel="صورة القصة بملء الشاشة"
          />
        ) : null}

        <LinearGradient
          colors={currentStory.type === 'image' ? ['rgba(0,0,0,0.08)', 'rgba(0,0,0,0.42)'] : gradColors}
          style={styles.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* ======================================================== */}
          {/* SEGMENTED PROGRESS BARS                                  */}
          {/* ======================================================== */}
          {uiVisible && <View style={[styles.progressRow, { marginTop: headerTopInset(headerInsets.top) + 4 }]}>
            {storiesList.map((st, idx) => {
              let fillWidth: any = '0%';
              if (idx < currentIndex) {
                fillWidth = '100%';
              } else if (idx === currentIndex) {
                fillWidth = progressAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                });
              }

              return (
                <View key={st.id || idx} style={styles.progressSegmentTrack}>
                  <Animated.View style={[styles.progressSegmentFill, { width: fillWidth }]} />
                </View>
              );
            })}
          </View>}

          {/* ======================================================== */}
          {/* TOP HEADER                                               */}
          {/* ======================================================== */}
          {uiVisible && (
            <View style={styles.storyOverlayHeader}>
              <View style={styles.storyOverlayIdentity}>
                <View style={styles.storyOverlayAvatar}>
                  {!author?.hide_name && author?.avatar_url
                    ? <Image source={{ uri: author.avatar_url }} style={styles.storyOverlayAvatarImage} />
                    : <UserRound size={19} color="#fff" />}
                </View>
                <View style={styles.storyOverlayNameBox}>
                  <Text numberOfLines={1} style={styles.storyOverlayName}>{author?.hide_name ? 'مجهول' : (author?.display_name || author?.username || 'جار')}</Text>
                  <Text style={styles.storyOverlayMeta}>{currentIndex + 1} / {storiesList.length}</Text>
                </View>
              </View>
              <View style={styles.storyOverlayActions}>
                {isOwn ? (
                  <Pressable accessibilityRole="button" accessibilityLabel="حذف اليومية" onPress={confirmDeleteStory} style={styles.storyOverlayIcon}>
                    <Trash2 size={21} color="#fff" />
                  </Pressable>
                ) : currentUserId ? (
                  <Pressable accessibilityRole="button" accessibilityLabel="خيارات اليومية" onPress={openStorySafetyMenu} style={styles.storyOverlayIcon}>
                    <MoreVertical size={22} color="#fff" />
                  </Pressable>
                ) : null}
                <Pressable accessibilityRole="button" accessibilityLabel="إغلاق اليومية" onPress={() => router.back()} style={styles.storyOverlayIcon}>
                  <X size={24} color="#fff" />
                </Pressable>
              </View>
            </View>
          )}

          {/* ======================================================== */}
          {/* INTERACTIVE TAP ZONES (Left / Right Navigation)          */}
          {/* ======================================================== */}
          <View style={styles.tapZonesContainer}>
            {/* Left Tap Zone -> Previous Story */}
            <Pressable
              style={styles.tapZoneLeft}
              onPress={handlePrevStory}
              onPressIn={handleStoryPressIn}
              onLongPress={handleStoryLongPress}
              onPressOut={handleStoryPressOut}
              delayLongPress={260}
            />

            {/* Right Tap Zone -> Next Story */}
            <Pressable
              style={styles.tapZoneRight}
              onPress={handleNextStory}
              onPressIn={handleStoryPressIn}
              onLongPress={handleStoryLongPress}
              onPressOut={handleStoryPressOut}
              delayLongPress={260}
            />

            {/* Center Story Content */}
            <View style={styles.storyContent} pointerEvents="box-none">
              {currentStory.type === 'text' ? (
                <Text style={[styles.storyText, {
                  color: currentStory.text_color || '#FFFFFF',
                  fontSize: currentStory.font_size || 34,
                  fontFamily: currentStory.font_family === 'serif' ? 'serif' : currentStory.font_family === 'monospace' ? 'monospace' : 'System',
                  fontWeight: currentStory.font_family === 'normal' ? '600' : '900',
                  fontStyle: currentStory.font_family === 'italic' ? 'italic' : 'normal',
                  transform: [
                    { translateX: Number(currentStory.text_offset_x || 0) },
                    { translateY: Number(currentStory.text_offset_y || 0) },
                    { rotate: `${Number(currentStory.text_rotation || 0)}deg` },
                  ],
                }]}>{currentStory.content}</Text>
              ) : (
                <View style={styles.imageStory}>
                  {currentStory.content ? (
                    <View style={styles.captionContainer}>
                      <Text style={[styles.imageCaption, {
                        color: currentStory.text_color || '#FFFFFF',
                        fontSize: currentStory.font_size || 20,
                        fontFamily: currentStory.font_family === 'serif' ? 'serif' : currentStory.font_family === 'monospace' ? 'monospace' : 'System',
                        fontWeight: currentStory.font_family === 'normal' ? '600' : '900',
                        fontStyle: currentStory.font_family === 'italic' ? 'italic' : 'normal',
                        transform: [
                          { translateX: Number(currentStory.text_offset_x || 0) },
                          { translateY: Number(currentStory.text_offset_y || 0) },
                          { rotate: `${Number(currentStory.text_rotation || 0)}deg` },
                        ],
                      }]}>{currentStory.content}</Text>
                    </View>
                  ) : null}
                </View>
              )}
            </View>
          </View>

          {currentStory.interactive_type === 'poll' ? (
            <View style={styles.storyInteractivePanel}>
              <Text style={styles.interactiveQuestion}>{currentStory.poll_question || 'استطلاع رأي'}</Text>
              {((Array.isArray(currentStory.poll_options) ? currentStory.poll_options : ['نعم', 'لا']) as string[]).slice(0, 2).map((option, index) => {
                const totalVotes = pollVotes[0] + pollVotes[1];
                const count = pollVotes[index] || 0;
                const percent = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
                return (
                  <Pressable key={index} style={[styles.interactiveOption, myPollVote === index && styles.interactiveOptionSelected]}
                    onPress={() => votePoll(index)} disabled={interactiveSending}>
                    <View style={styles.interactiveOptionHeader}>
                      <Text style={styles.interactiveOptionText}>{option}</Text>
                      <Text style={styles.interactiveOptionCount}>{count} · {percent}%</Text>
                    </View>
                    <View style={styles.interactiveVoteTrack}>
                      <View style={[styles.interactiveVoteFill, { width: `${percent}%` }]} />
                    </View>
                  </Pressable>
                );
              })}
              <Text style={styles.interactiveHint}>{myPollVote === null ? 'اختر إجابتك للتصويت' : 'تم تسجيل تصويتك ويمكنك تغييره'}</Text>
            </View>
          ) : currentStory.interactive_type === 'question' ? (
            <View style={styles.storyInteractivePanel}>
              <Text style={styles.interactiveQuestion}>{currentStory.question_prompt || 'سؤال للمتابعين'}</Text>
              {isOwn ? (
                <View style={styles.questionResponsesList}>
                  <Text style={styles.interactiveHint}>{questionResponses.length} إجابة</Text>
                  {questionResponses.length === 0 ? (
                    <Text style={styles.interactiveHint}>ستظهر إجابات المتابعين هنا.</Text>
                  ) : questionResponses.slice(0, 4).map((response, index) => (
                    <View key={`${response.responder_id}-${response.created_at}-${index}`} style={styles.questionResponseItem}>
                      <Text style={styles.questionResponseText}>{response.answer}</Text>
                    </View>
                  ))}
                </View>
              ) : questionSent ? (
                <Text style={styles.interactiveHint}>وصلت إجابتك لصاحب القصة ✓</Text>
              ) : (
                <View style={styles.questionAnswerRow}>
                  <Pressable style={styles.questionSendButton} onPress={submitQuestionAnswer} disabled={interactiveSending || !questionAnswer.trim()}>
                    {interactiveSending ? <ActivityIndicator size="small" color="#fff" /> : <Send size={16} color="#fff" />}
                  </Pressable>
                  <TextInput value={questionAnswer} onChangeText={setQuestionAnswer} style={styles.questionAnswerInput}
                    placeholder="اكتب إجابتك..." placeholderTextColor="#64748b" maxLength={1000} />
                </View>
              )}
            </View>
          ) : null}

          {/* ======================================================== */}
          {/* FOOTER: STATS OR DM REPLY                                */}
          {/* ======================================================== */}
          {(uiVisible || showReplyBox || isPaused) && (isOwn ? (
            <View style={styles.ownerStats}>
              <Pressable style={styles.statBadge} onPress={showStoryViewers} accessibilityRole="button" accessibilityLabel="عرض قائمة مشاهدي القصة">
                <Eye size={16} color="#fff" />
                <Text style={styles.statBadgeText}>{currentStory.view_count || 0} مشاهدة · {likesReady ? likeCount : '—'} إعجاب · عرض القائمة</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.replyArea}>
              {canReply ? (
                showReplyBox ? (
                  <View style={styles.replyBox}>
                    <Pressable style={styles.sendBtn} onPress={sendReply} disabled={sending}>
                      {sending ? <ActivityIndicator size="small" color="#fff" /> : <Send size={18} color="#fff" />}
                    </Pressable>
                    <TextInput
                      style={styles.replyInput}
                      value={replyText}
                      maxLength={2000}
                      onChangeText={setReplyText}
                      placeholder="ردك يصل مباشرة للرسائل..."
                      placeholderTextColor="rgba(255,255,255,0.5)"
                      autoFocus
                      onSubmitEditing={sendReply}
                    />
                  </View>
                ) : (
                  <View style={styles.replyActions}>
                    <Pressable style={[styles.likeBtn, !likesReady && { opacity: 0.4 }]} onPress={handleLike} disabled={likeBusy || !likesReady} accessibilityRole="button" accessibilityLabel={!likesReady ? 'الإعجابات غير متاحة مؤقتًا' : liked ? 'إلغاء الإعجاب' : 'إعجاب باليومية'}>
                      <Heart size={26} color={liked ? '#f43f5e' : '#fff'} fill={liked ? '#f43f5e' : 'transparent'} />
                    </Pressable>
                    <Pressable style={styles.replyTrigger} onPress={handleOpenReply}>
                      <Text style={styles.replyTriggerText}>رد على القصة...</Text>
                    </Pressable>
                  </View>
                )
              ) : (
                <View style={styles.disabledReplyBar}>
                  <Pressable style={[styles.likeBtn, !likesReady && { opacity: 0.4 }]} onPress={handleLike} disabled={likeBusy || !likesReady} accessibilityRole="button" accessibilityLabel={!likesReady ? 'الإعجابات غير متاحة مؤقتًا' : liked ? 'إلغاء الإعجاب' : 'إعجاب باليومية'}>
                    <Heart size={26} color={liked ? '#f43f5e' : '#fff'} fill={liked ? '#f43f5e' : 'transparent'} />
                  </Pressable>
                  <View style={styles.disabledReplyNotice}>
                    <Text style={styles.disabledReplyNoticeText}>
                      {!currentUserId ? 'سجل الدخول للتفاعل مع القصة' : 'الردود معطلة لهذه القصة'}
                    </Text>
                  </View>
                </View>
              )}
            </View>
          ))}
        </LinearGradient>
      </View>
    </KeyboardAvoidingView>
  );
}

function shiftColor(hex: string): string {
  try {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, (num >> 16) - 40);
    const g = Math.max(0, ((num >> 8) & 0xff) - 40);
    const b = Math.max(0, (num & 0xff) - 40);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  } catch {
    return '#065f46';
  }
}

const styles = StyleSheet.create({
  storyInteractivePanel: {
    marginHorizontal: 18,
    marginVertical: 8,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.96)',
    gap: 8,
    zIndex: 30,
  },
  interactiveQuestion: { color: '#0f172a', fontSize: 14, fontWeight: '900', textAlign: 'center' },
  interactiveOption: { padding: 9, borderRadius: 10, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#f8fafc', gap: 5 },
  interactiveOptionSelected: { borderColor: '#059669', backgroundColor: '#ecfdf5' },
  interactiveOptionHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  interactiveOptionText: { color: '#0f172a', fontSize: 12, fontWeight: '800' },
  interactiveOptionCount: { color: '#475569', fontSize: 11, fontWeight: '700' },
  interactiveVoteTrack: { height: 4, borderRadius: 4, backgroundColor: '#e2e8f0', overflow: 'hidden' },
  interactiveVoteFill: { height: '100%', backgroundColor: '#059669' },
  interactiveHint: { color: '#64748b', fontSize: 10, textAlign: 'center' },
  questionResponsesList: { maxHeight: 130, gap: 6 },
  questionResponseItem: { backgroundColor: '#ecfdf5', borderRadius: 10, padding: 9 },
  questionResponseText: { color: '#064e3b', fontSize: 12, textAlign: 'right', fontWeight: '700' },
  questionAnswerRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  questionAnswerInput: { flex: 1, minHeight: 40, backgroundColor: '#f1f5f9', borderRadius: 10, paddingHorizontal: 12, color: '#0f172a', textAlign: 'right' },
  questionSendButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: '#000' },
  loadingScreen: { flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' },
  notFoundText: { color: '#fff', fontSize: 17, fontWeight: '700', marginBottom: 20, textAlign: 'center' },
  backBtn: { backgroundColor: '#059669', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 14 },
  backBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  bgImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%', backgroundColor: '#080808' },
  gradient: {
    flex: 1,
    paddingBottom: Platform.OS === 'ios' ? 30 : 12,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 14,
    marginTop: Platform.OS === 'ios' ? 54 : 34,
    zIndex: 20,
  },
  progressSegmentTrack: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressSegmentFill: {
    height: '100%',
    backgroundColor: '#fff',
    borderRadius: 2,
  },
  storyOverlayHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 9, paddingBottom: 7, zIndex: 30, backgroundColor: 'transparent' },
  storyOverlayIdentity: { flexDirection: 'row-reverse', alignItems: 'center', gap: 9, flex: 1, minWidth: 0 },
  storyOverlayAvatar: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.9)', backgroundColor: 'rgba(0,0,0,0.16)', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  storyOverlayAvatarImage: { width: '100%', height: '100%' },
  storyOverlayNameBox: { flex: 1, alignItems: 'flex-end' },
  storyOverlayName: { fontSize: 14, color: '#fff', fontWeight: '800', textAlign: 'right' },
  storyOverlayMeta: { fontSize: 11, color: 'rgba(255,255,255,0.8)', textAlign: 'right', marginTop: 2 },
  storyOverlayActions: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5 },
  storyOverlayIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 6,
    zIndex: 20,
  },
  headerRightActions: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  authorAvatar: {},
  avatarImg: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: '#fff' },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarLetter: { color: '#fff', fontSize: 18, fontWeight: '900' },
  authorInfo: { alignItems: 'flex-end' },
  authorNameRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  authorName: { color: '#fff', fontSize: 15, fontWeight: '900' },
  counterBadge: {
    color: '#10b981',
    fontSize: 11,
    fontWeight: '800',
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  authorDistrictText: {
    color: '#a7f3d0',
    fontSize: 10.5,
    fontWeight: '800',
  },
  storyTime: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600', marginTop: 1 },
  tapZonesContainer: {
    flex: 1,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tapZoneLeft: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: '35%',
    zIndex: 10,
  },
  tapZoneRight: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: '35%',
    zIndex: 10,
  },
  storyContent: {
    width: '100%',
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5,
  },
  storyText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 42,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  imageStory: {
    width: '100%',
    alignItems: 'center',
  },
  captionContainer: {
    backgroundColor: 'rgba(0,0,0,0.48)',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
    maxWidth: '92%',
  },
  imageCaption: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  ownerStats: {
    paddingHorizontal: 20,
    paddingBottom: 10,
    alignItems: 'flex-end',
    zIndex: 20,
  },
  statBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    gap: 6,
  },
  statBadgeText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  replyArea: {
    paddingHorizontal: 16,
    paddingBottom: 6,
    zIndex: 20,
  },
  replyActions: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  likeBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyTrigger: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  replyTriggerText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    textAlign: 'right',
    fontWeight: '700',
  },
  replyBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
    paddingHorizontal: 6,
    height: 52,
  },
  replyInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    paddingHorizontal: 14,
    textAlign: 'right',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledReplyBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  disabledReplyNotice: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    height: 48,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  disabledReplyNoticeText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '700',
  },
});
