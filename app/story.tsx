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

  const progressAnim = useRef(new Animated.Value(0)).current;
  const currentStory = storiesList[currentIndex];

  // 1. Initial Load: Fetch active stories for this author
  useEffect(() => {
    loadStoriesSequence();
  }, [id]);

  async function loadStoriesSequence() {
    setLoading(true);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return router.replace('/auth');
    setCurrentUserId(u.user.id);

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
    const { data: allAuthorStories } = await supabase
      .from('stories')
      .select('*')
      .eq('author_id', targetStory.author_id)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: true });

    const sequence = allAuthorStories && allAuthorStories.length > 0 ? allAuthorStories : [targetStory];
    setStoriesList(sequence);

    // Start from target story index
    const targetIdx = sequence.findIndex(s => s.id === targetStory.id);
    setCurrentIndex(targetIdx >= 0 ? targetIdx : 0);

    // Privacy check for replies
    let allowed = true;
    if (targetStory.allow_replies === false) {
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
          { text: 'عرض الرسائل', onPress: () => router.push('/messages') },
          { text: 'حسناً' },
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
          { text: 'عرض الرسائل', onPress: () => router.push('/messages') },
          { text: 'حسناً' },
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

  if (loading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color="#0891b2" />
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
    : ['#0891b2', '#0369a1'] as [string, string];

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
                <Text style={styles.storyTime}>تنتهي بعد {timeLeft}س</Text>
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
                <Text style={styles.storyText}>{currentStory.content}</Text>
              ) : (
                <View style={styles.imageStory}>
                  {currentStory.content ? (
                    <View style={styles.captionContainer}>
                      <Text style={styles.imageCaption}>{currentStory.content}</Text>
                    </View>
                  ) : null}
                </View>
              )}
            </View>
          </View>

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
                    <Pressable style={styles.likeBtn} onPress={() => setLiked(!liked)}>
                      <Heart size={26} color={liked ? '#f43f5e' : '#fff'} fill={liked ? '#f43f5e' : 'transparent'} />
                    </Pressable>
                    <Pressable style={styles.replyTrigger} onPress={() => setShowReplyBox(true)}>
                      <Text style={styles.replyTriggerText}>رد على القصة...</Text>
                    </Pressable>
                  </View>
                )
              ) : (
                <View style={styles.disabledReplyBar}>
                  <Pressable style={styles.likeBtn} onPress={() => setLiked(!liked)}>
                    <Heart size={26} color={liked ? '#f43f5e' : '#fff'} fill={liked ? '#f43f5e' : 'transparent'} />
                  </Pressable>
                  <View style={styles.disabledReplyNotice}>
                    <Text style={styles.disabledReplyNoticeText}>الردود معطلة لهذه القصة</Text>
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
    return '#0369a1';
  }
}

const styles = StyleSheet.create({
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
    marginTop: Platform.OS === 'ios' ? 52 : 36,
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
