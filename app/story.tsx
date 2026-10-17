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
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { X, Send, Eye, Heart, Trash2, ChevronLeft, ChevronRight } from 'lucide-react-native';

const { width, height } = Dimensions.get('window');
const STORY_DURATION = 7000; // 7 seconds per story

export default function StoryViewer() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [storiesList, setStoriesList] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [author, setAuthor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [liked, setLiked] = useState(false);
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [canReply, setCanReply] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [pollVotes, setPollVotes] = useState<number[]>([0, 0]);
  const [myPollVote, setMyPollVote] = useState<number | null>(null);
  const [questionAnswer, setQuestionAnswer] = useState('');
  const [questionSent, setQuestionSent] = useState(false);
  const [interactiveSending, setInteractiveSending] = useState(false);

  const progressAnim = useRef(new Animated.Value(0)).current;
  const currentStory = storiesList[currentIndex];

  useEffect(() => {
    let cancelled = false;
    async function loadInteractiveState() {
      if (!currentStory?.id) return;
      setMyPollVote(null);
      setPollVotes([0, 0]);
      setQuestionAnswer('');
      setQuestionSent(false);
      if (currentStory.interactive_type !== 'poll') return;

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
  }, [id]);

  async function loadStoriesSequence() {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (u?.user) {
      setCurrentUserId(u.user.id);
    } else {
      setCurrentUserId('');
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

    const sequence = allAuthorStories && allAuthorStories.length > 0 ? allAuthorStories : [targetStory];
    setStoriesList(sequence);

    // Start from target story index
    const targetIdx = sequence.findIndex(s => s.id === targetStory.id);
    setCurrentIndex(targetIdx >= 0 ? targetIdx : 0);

    // Privacy check for replies
    let allowed = true;
    if (!u?.user) {
      allowed = false;
    } else if (targetStory.allow_replies === false) {
      allowed = false;
    } else if (p?.allow_story_replies === 'nobody') {
      allowed = false;
    } else if (p?.allow_story_replies === 'followers') {
      const { data: followRecord } = await supabase
        .from('follows')
        .select('id')
        .eq('follower_id', u.user.id)
        .eq('following_id', targetStory.author_id)
        .maybeSingle();
      if (!followRecord) allowed = false;
    }
    setCanReply(allowed);

    setLoading(false);
  }

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
      supabase.from('story_views').insert({ story_id: currentStory.id, viewer_id: currentUserId }).then(() => {});
      supabase.from('stories').update({ view_count: (currentStory.view_count || 0) + 1 }).eq('id', currentStory.id);
    }

    return () => animation.stop();
  }, [currentIndex, isPaused, showReplyBox, storiesList.length]);

  function handleNextStory() {
    if (currentIndex < storiesList.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      router.back();
    }
  }

  function handlePrevStory() {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
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
          await supabase.from('stories').delete().eq('id', currentStory.id);
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
    if (!replyText.trim() || !currentStory) return;
    setSending(true);
    const msgText = replyText.trim();
    setReplyText('');
    setShowReplyBox(false);

    try {
      // 1. Try story_replies trigger
      const { error: replyErr } = await supabase.from('story_replies').insert({
        story_id: currentStory.id,
        sender_id: currentUserId,
        body: msgText,
      });

      if (!replyErr) {
        setSending(false);
        Alert.alert('تم! ✅', 'وصل ردك لصاحب القصة في الرسائل الخاصة', [
          { text: 'فتح الدردشة', onPress: () => router.replace('/messages') },
          { text: 'لاحقاً' },
        ]);
        return;
      }

      // 2. Manual conversation fallback
      const { data: myConvs } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', currentUserId);

      let convId: string | null = null;
      if (myConvs && myConvs.length > 0) {
        const convIds = myConvs.map((c: any) => c.conversation_id);
        const { data: otherMember } = await supabase
          .from('conversation_members')
          .select('conversation_id')
          .eq('user_id', currentStory.author_id)
          .in('conversation_id', convIds)
          .limit(1)
          .maybeSingle();
        if (otherMember) convId = otherMember.conversation_id;
      }

      if (!convId) {
        const { data: newConv } = await supabase.from('conversations').insert({}).select().single();
        convId = newConv?.id;
        if (convId) {
          await supabase.from('conversation_members').insert([
            { conversation_id: convId, user_id: currentUserId },
            { conversation_id: convId, user_id: currentStory.author_id },
          ]);
        }
      }

      if (convId) {
        await supabase.from('messages').insert({
          conversation_id: convId,
          sender_id: currentUserId,
          body: `↩️ رد على قصتك: ${msgText}`,
          read_by: [currentUserId],
        });

        setSending(false);
        Alert.alert('تم! ✅', 'وصل ردك في الرسائل الخاصة', [
          { text: 'فتح الدردشة', onPress: () => router.replace('/messages') },
          { text: 'لاحقاً' },
        ]);
      } else {
        setSending(false);
        Alert.alert('خطأ', 'لم نتمكن من إرسال ردك.');
      }
    } catch (e: any) {
      setSending(false);
      Alert.alert('خطأ', e.message);
    }
  }

  function handleLike() {
    if (!currentUserId) {
      Alert.alert('تسجيل الدخول', 'يرجى تسجيل الدخول للتفاعل والإعجاب بالقصة', [
        { text: 'تسجيل الدخول', onPress: () => router.push('/auth') },
        { text: 'إلغاء', style: 'cancel' },
      ]);
      return;
    }
    setLiked(!liked);
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
      <View style={styles.container}>
        {/* Story Background */}
        {currentStory.type === 'image' && currentStory.image_url ? (
          <Image source={{ uri: currentStory.image_url }} style={styles.bgImage} resizeMode="cover" />
        ) : null}

        <LinearGradient
          colors={currentStory.type === 'image' ? ['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.75)'] : gradColors}
          style={styles.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* ======================================================== */}
          {/* SEGMENTED PROGRESS BARS                                  */}
          {/* ======================================================== */}
          <View style={styles.progressRow}>
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
          </View>

          {/* ======================================================== */}
          {/* TOP HEADER                                               */}
          {/* ======================================================== */}
          <View style={styles.header}>
            <View style={styles.headerRightActions}>
              <Pressable onPress={() => router.back()} style={styles.iconBtn}>
                <X size={22} color="#fff" />
              </Pressable>

              {isOwn && (
                <Pressable onPress={confirmDeleteStory} style={[styles.iconBtn, { backgroundColor: 'rgba(239,68,68,0.3)' }]}>
                  <Trash2 size={18} color="#ef4444" />
                </Pressable>
              )}
            </View>

            {/* Author info & Story Counter */}
            <View style={styles.authorRow}>
              <View style={styles.authorInfo}>
                <View style={styles.authorNameRow}>
                  <Text style={styles.authorName}>{author?.display_name || author?.username || 'جار'}</Text>
                  {storiesList.length > 1 && (
                    <Text style={styles.counterBadge}>
                      {currentIndex + 1} / {storiesList.length}
                    </Text>
                  )}
                </View>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 5 }}>
                  {(author?.district || author?.city) && (
                    <Text style={styles.authorDistrictText} numberOfLines={1}>
                      {[author.district, author.city].filter(Boolean).join(' · ')}
                    </Text>
                  )}
                  <Text style={styles.storyTime}>· تنتهي بعد {timeLeft}س</Text>
                </View>
              </View>

              <View style={styles.authorAvatar}>
                {author?.avatar_url ? (
                  <Image source={{ uri: author.avatar_url }} style={styles.avatarImg} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarLetter}>{author?.display_name?.[0] || 'ج'}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* ======================================================== */}
          {/* INTERACTIVE TAP ZONES (Left / Right Navigation)          */}
          {/* ======================================================== */}
          <View style={styles.tapZonesContainer}>
            {/* Left Tap Zone -> Previous Story */}
            <Pressable
              style={styles.tapZoneLeft}
              onPress={handlePrevStory}
              onPressIn={() => setIsPaused(true)}
              onPressOut={() => setIsPaused(false)}
            />

            {/* Right Tap Zone -> Next Story */}
            <Pressable
              style={styles.tapZoneRight}
              onPress={handleNextStory}
              onPressIn={() => setIsPaused(true)}
              onPressOut={() => setIsPaused(false)}
            />

            {/* Center Story Content */}
            <View style={styles.storyContent} pointerEvents="box-none">
              {currentStory.type === 'text' ? (
                <Text style={[styles.storyText, {
                  color: currentStory.text_color || '#FFFFFF',
                  fontSize: currentStory.font_size || 34,
                  fontFamily: currentStory.font_family === 'serif' ? 'serif' : currentStory.font_family === 'monospace' ? 'monospace' : 'System',
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
              {questionSent ? (
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
          {isOwn ? (
            <View style={styles.ownerStats}>
              <View style={styles.statBadge}>
                <Eye size={16} color="#fff" />
                <Text style={styles.statBadgeText}>{currentStory.view_count || 0} مشاهدة</Text>
              </View>
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
                      onChangeText={setReplyText}
                      placeholder="ردك يصل مباشرة للرسائل..."
                      placeholderTextColor="rgba(255,255,255,0.5)"
                      autoFocus
                      onSubmitEditing={sendReply}
                    />
                  </View>
                ) : (
                  <View style={styles.replyActions}>
                    <Pressable style={styles.likeBtn} onPress={handleLike}>
                      <Heart size={26} color={liked ? '#f43f5e' : '#fff'} fill={liked ? '#f43f5e' : 'transparent'} />
                    </Pressable>
                    <Pressable style={styles.replyTrigger} onPress={handleOpenReply}>
                      <Text style={styles.replyTriggerText}>رد على القصة...</Text>
                    </Pressable>
                  </View>
                )
              ) : (
                <View style={styles.disabledReplyBar}>
                  <Pressable style={styles.likeBtn} onPress={handleLike}>
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
          )}
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
  questionAnswerRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  questionAnswerInput: { flex: 1, minHeight: 40, backgroundColor: '#f1f5f9', borderRadius: 10, paddingHorizontal: 12, color: '#0f172a', textAlign: 'right' },
  questionSendButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center' },
  container: { flex: 1, backgroundColor: '#000' },
  loadingScreen: { flex: 1, backgroundColor: '#0f172a', alignItems: 'center', justifyContent: 'center' },
  notFoundText: { color: '#fff', fontSize: 17, fontWeight: '700', marginBottom: 20, textAlign: 'center' },
  backBtn: { backgroundColor: '#059669', paddingHorizontal: 28, paddingVertical: 12, borderRadius: 14 },
  backBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  bgImage: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  gradient: {
    flex: 1,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 14,
    marginTop: Platform.OS === 'ios' ? 52 : 40,
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
    backgroundColor: 'rgba(0,0,0,0.35)',
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
    textShadowRadius: 8,
  },
  imageStory: {
    width: '100%',
    alignItems: 'center',
  },
  captionContainer: {
    backgroundColor: 'rgba(0,0,0,0.65)',
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
    borderColor: 'rgba(255,255,255,0.45)',
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
