import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Share,
  Image,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/ui';
import { useBottomNavInset } from '@/lib/bottomNav';
import ScreenHeader from '@/components/shared/ScreenHeader';
import { getActiveLocation } from '@/lib/locationSync';
import {
  MapPin,
  MessageCircle,
  Send,
  User,
  Clock,
  Reply,
  Sparkles,
  CheckCircle2,
  ThumbsUp,
  ThumbsDown,
  Lock,
  Award,
  Share2,
  ShieldCheck,
  Check,
  Info,
} from 'lucide-react-native';
import { requireAccount } from '@/lib/authGate';
import { areaLabel } from '@/lib/privacy';
import { getCurrentDeviceLocation, reverseGeocodeDeviceLocation } from '@/lib/deviceLocation';
import { LinearGradient } from 'expo-linear-gradient';
import { relativeTime } from '@/lib/mapPins';

export default function Question() {
  const bottomNavInset = useBottomNavInset();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [q, setQ] = useState<any>();
  const [answers, setAnswers] = useState<any[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [voting, setVoting] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [sharingWith, setSharingWith] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data: auth } = await supabase.auth.getSession();
    const user = auth.session?.user ?? null;
    setCurrentUserId(user?.id ?? null);
    const questionPromise = user
      ? supabase.from('questions').select('*').eq('id', id).maybeSingle()
      : getActiveLocation().then(location => supabase.rpc('hayna_guest_question', {
          p_id: id,
          p_city: location.city,
          p_district: location.district,
        }));
    const [questionResult, b] = await Promise.all([
      questionPromise,
      supabase.from('answers').select('*').eq('question_id', id).order('created_at'),
    ]);
    const question = Array.isArray(questionResult.data) ? questionResult.data[0] : questionResult.data;

    if (question) {
      const userIds = [question.author_id, ...(b.data || []).map((ans: any) => ans.author_id)];
      const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));

      const { data: profilesData } = await supabase.from('profiles').select('*').in('id', uniqueIds);
      const profilesMap = (profilesData || []).reduce((acc: any, p: any) => ({ ...acc, [p.id]: p }), {});

      question.profiles = profilesMap[question.author_id];
      if (b.data) {
        b.data.forEach((ans: any) => { ans.profiles = profilesMap[ans.author_id]; });
      }
    }

    setQ(question);
    const answerIds = (b.data || []).map((x: any) => x.id);
    let votes: any[] = [];
    if (answerIds.length) {
      const { data: vd } = await supabase.from('answer_votes').select('answer_id,voter_id,vote').in('answer_id', answerIds);
      votes = vd || [];
    }
    const voteMap = votes.reduce((m: any, v: any) => { (m[v.answer_id] ||= []).push(v); return m; }, {});
    (b.data || []).forEach((ans: any) => { ans.votes = voteMap[ans.id] || []; });
    setAnswers(b.data ?? []);
    setLoading(false);
  }

  useEffect(() => { load() }, [id]);

  async function answer() {
    if (!body.trim()) return;
    setSubmitting(true);
    const { data: auth } = await supabase.auth.getSession();
    if (!auth.session?.user) {
      setSubmitting(false);
      return requireAccount('سجّل الدخول أو أنشئ حساباً للرد على السؤال.');
    }

    if (q.status !== 'open') {
      setSubmitting(false);
      return Alert.alert('الردود مغلقة', 'تم إغلاق النقاش بعد اعتماد الإجابة.');
    }

    const { error } = await supabase.rpc('hayna_create_question_answer', {
      p_question_id: id,
      p_body: body.trim(),
      p_parent_answer_id: replyTo?.id ?? null,
    });

    setSubmitting(false);
    if (error) {
      const code = error.message || '';
      const message =
        code.includes('AUTH_REQUIRED') ? 'انتهت جلسة الدخول. سجّل الدخول مرة أخرى.' :
        code.includes('QUESTION_CLOSED') ? 'تم إغلاق الردود على هذا الموضوع.' :
        code.includes('INVALID_PARENT') ? 'التعليق الذي تحاول الرد عليه غير صالح.' :
        code.includes('QUESTION_NOT_FOUND') ? 'الموضوع غير موجود.' :
        code.includes('EMPTY_BODY') ? 'اكتب الرد أولاً.' :
        'تعذر إرسال الرد الآن. حاول مرة أخرى.';
      Alert.alert('لم يتم إرسال الرد', message);
      return;
    }

    setBody('');
    setReplyTo(null);
    await load();
    Alert.alert('تم الإرسال 🌟', 'تم نشر ردك بنجاح في نقاش الحي.');
  }

  async function voteAnswer(answerId: string, vote: number) {
    if (!currentUserId) return requireAccount('سجّل الدخول أو أنشئ حساباً لتقييم الإجابات.');
    if (voting) return;
    const { data: sessionCheck } = await supabase.auth.getSession();
    if (!sessionCheck.session) return Alert.alert('تسجيل الدخول مطلوب', 'سجّل الدخول حتى تتمكن من التصويت.');
    setVoting(answerId + ':' + vote);
    const existing = answers.find(a => a.id === answerId)?.votes?.find((v: any) => v.voter_id === currentUserId);
    let error: any = null;
    if (existing?.vote === vote) {
      ({ error } = await supabase.from('answer_votes').delete().eq('answer_id', answerId).eq('voter_id', currentUserId));
    } else if (existing) {
      ({ error } = await supabase.from('answer_votes').update({ vote }).eq('answer_id', answerId).eq('voter_id', currentUserId));
    } else {
      ({ error } = await supabase.from('answer_votes').insert({ answer_id: answerId, voter_id: currentUserId, vote }));
    }
    setVoting(null);
    if (error) Alert.alert('تعذر تسجيل التقييم', error.message);
    else load();
  }

  async function chooseBest(answerId: string) {
    if (!currentUserId) return Alert.alert('تسجيل الدخول مطلوب', 'سجّل الدخول أولاً.');
    if (currentUserId !== q.author_id) return Alert.alert('غير مسموح', 'اعتماد الإجابة متاح لصاحب السؤال فقط.');
    const ok = await new Promise<boolean>(resolve => Alert.alert('اختيار أفضل إجابة ⭐', 'سيتم اعتماد هذا الرد كأفضل إجابة في الحي، ومكافأة الجار بـ +10 نقاط سمعة ⭐ وإغلاق السؤال.', [
      { text: 'إلغاء', style: 'cancel', onPress: () => resolve(false) },
      { text: 'اعتماد ومكافأة ⭐', style: 'default', onPress: () => resolve(true) },
    ]));
    if (!ok) return;

    try {
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('award_best_answer', {
        p_question_id: id,
        p_answer_id: answerId,
      });

      if (rpcErr) {
        // Fallback: direct update + reputation + notification
        const { data: updated, error } = await supabase
          .from('questions')
          .update({ best_answer_id: answerId, status: 'solved', solved_at: new Date().toISOString() })
          .eq('id', id)
          .eq('author_id', currentUserId)
          .select('id, best_answer_id, status')
          .maybeSingle();

        if (error) throw error;
        if (!updated) return Alert.alert('تعذر الاعتماد', 'لم يتم تعديل السؤال. تأكد أنك صاحب السؤال.');

        const targetAns = answers.find(x => x.id === answerId);
        if (targetAns?.author_id && targetAns.author_id !== currentUserId) {
          try {
            const { data: curRep } = await supabase
              .from('reputation')
              .select('points')
              .eq('user_id', targetAns.author_id)
              .maybeSingle();
            const nextPts = (curRep?.points || 0) + 10;
            await supabase.from('reputation').upsert({
              user_id: targetAns.author_id,
              points: nextPts,
              updated_at: new Date().toISOString(),
            });
          } catch {}

          try {
            await supabase.from('notifications').insert({
              user_id: targetAns.author_id,
              type: 'answer',
              title: '🌟 تم اعتماد ردك كأفضل إجابة!',
              body: `اعتمد جارك ردك كأفضل إجابة على: «${(q.title || '').slice(0, 40)}» (+10 نقاط سمعة ⭐)`,
              target_type: 'question',
              target_id: id,
            });
          } catch {}
        }
      }

      Alert.alert('تم اعتماد الإجابة بنجاح! 🌟', 'تمت إضافة +10 نقاط سمعة لحساب الجار تقديراً لإفادته أهل الحي.');
      load();
    } catch (e: any) {
      Alert.alert('تعذر اعتماد الإجابة', e?.message || 'حدث خطأ أثناء الاعتماد.');
    }
  }

  /** Sends the exact fix straight into a private chat with one neighbour. */
  async function shareLocationPrivately(targetUserId: string, targetName: string) {
    if (!currentUserId || sharingWith) return;

    setSharingWith(targetUserId);
    try {
      const location = await getCurrentDeviceLocation();
      if (!location) {
        Alert.alert('تعذّر تحديد الموقع', 'اسمح للتطبيق بالوصول إلى الموقع ثم أعد المحاولة.');
        return;
      }
      const place = await reverseGeocodeDeviceLocation(location);
      const label = place?.district || place?.city || 'موقعي الحالي';

      const { data: convId, error: convError } = await supabase.rpc(
        'hayna_get_or_create_direct_conversation',
        { p_target: targetUserId },
      );
      if (convError) throw convError;
      if (!convId) throw new Error('تعذّر فتح المحادثة الخاصة');

      const { error } = await supabase.from('messages').insert({
        conversation_id: convId,
        sender_id: currentUserId,
        body: JSON.stringify({ type: 'location', lat: location.latitude, lng: location.longitude, label }),
        read_by: [currentUserId],
      });
      if (error) throw error;
      router.push({ pathname: '/conversation', params: { id: convId } });
    } catch (e: any) {
      Alert.alert('تعذّر إرسال الموقع', e?.message || `تعذّر إرسال موقعك إلى ${targetName}.`);
    } finally {
      setSharingWith(null);
    }
  }

  const handleShare = async () => {
    try {
      await Share.share({
        message: `استفسار في حيّنا: «${q?.title}»\nشارك برأيك أو إجابتك لجيرانك.`,
      });
    } catch {
      // Ignored
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#059669" />
        <Text style={styles.loadingText}>جاري تحميل تفاصيل الاستفسار...</Text>
      </View>
    );
  }

  if (!q) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>السؤال غير موجود أو تم حذفه</Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>العودة للرئيسية</Text>
        </Pressable>
      </View>
    );
  }

  const authorName = q.profiles?.hide_name ? 'مستخدم مجهول' : (q.profiles?.display_name || q.profiles?.username || 'أحد سكان الحي');
  const isAuthor = currentUserId === q.author_id;
  const isSolved = q.status === 'solved';

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      {/* Unified Luxury Header */}
      <LinearGradient
        colors={['#064e3b', '#065f46', '#047857']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <ScreenHeader
          title="استفسار ونقاش الحي 💬"
          subtitle="مجتمع حيّنا • تواصل الجيران"
          fallbackRoute="/home"
          rightAction={
            <Pressable
              onPress={handleShare}
              style={styles.headerShareBtn}
              accessibilityRole="button"
              accessibilityLabel="مشاركة السؤال"
            >
              <Share2 size={18} color="#ffffff" />
            </Pressable>
          }
        />
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Main Question Card */}
        <View style={styles.questionCard}>
          {/* Header Row: Author info and status badge */}
          <View style={styles.qHeader}>
            <View style={styles.authorSection}>
              {q.profiles?.avatar_url ? (
                <Image source={{ uri: q.profiles.avatar_url }} style={styles.authorAvatarImg} />
              ) : (
                <View style={styles.authorAvatarPlaceholder}>
                  <Text style={styles.authorAvatarLetter}>{authorName[0] || 'ح'}</Text>
                </View>
              )}
              <View style={styles.authorInfoTexts}>
                <Pressable onPress={() => q.author_id && router.push({ pathname: '/user', params: { id: q.author_id } })}>
                  <View style={styles.authorNameRow}>
                    <Text style={styles.authorName}>{authorName}</Text>
                    {q.profiles?.is_geoverified && <ShieldCheck size={12} color="#10b981" />}
                  </View>
                </Pressable>
                <View style={styles.metaRow}>
                  <MapPin size={11} color="#059669" />
                  <Text style={styles.metaText}>{areaLabel({ district: q.district, city: q.city })}</Text>
                  {Boolean(q.created_at) && (
                    <Text style={styles.metaTimeText}>· {relativeTime(q.created_at)}</Text>
                  )}
                </View>
              </View>
            </View>

            {/* Status Badge */}
            {isSolved ? (
              <View style={styles.solvedBadge}>
                <CheckCircle2 size={12} color="#166534" />
                <Text style={styles.solvedBadgeText}>تم الحل</Text>
              </View>
            ) : (
              <View style={styles.openBadge}>
                <View style={styles.openDot} />
                <Text style={styles.openBadgeText}>مفتوح للنقاش</Text>
              </View>
            )}
          </View>

          {/* Question Title */}
          <Text style={styles.qTitle}>{q.title}</Text>

          {/* Question Body */}
          {Boolean(q.body) && (
            <View style={styles.qBodyContainer}>
              <Text style={styles.qBody}>{q.body}</Text>
            </View>
          )}

          {/* Privacy & Safety Note */}
          <View style={styles.privacyNote}>
            <Info size={13} color="#059669" />
            <Text style={styles.privacyNoteText}>
              موقع تقريبي لحماية الخصوصية. يمكنك مشاركة موقعك الدقيق بالخاص مع الجار المناسب.
            </Text>
          </View>
        </View>

        {/* Answers / Discussion Section */}
        <View style={styles.answersSection}>
          <View style={styles.answersHeader}>
            <View style={styles.answersHeaderLeft}>
              <Text style={styles.answersCountBadge}>{answers.length}</Text>
              <Text style={styles.answersTitle}>إجابات وردود الجيران</Text>
            </View>
            <Text style={styles.answersSubtitle}>
              {answers.length === 0 ? 'كن أول من يجيب ويفيد الجار' : `${answers.length} ردود مسجلة`}
            </Text>
          </View>

          {answers.length === 0 ? (
            <View style={styles.emptyState}>
              <MessageCircle size={38} color="#94a3b8" />
              <Text style={styles.emptyStateTitle}>لا توجد ردود بعد</Text>
              <Text style={styles.emptyStateText}>شارك بمعلوماتك أو تجربتك لمساعدة أهل حيّك!</Text>
            </View>
          ) : (
            answers.map(a => {
              const isBest = q.best_answer_id === a.id;
              const ansAuthorName = a.profiles?.hide_name ? 'مستخدم مجهول' : (a.profiles?.display_name || a.profiles?.username || 'أحد الجيران');
              const upvotesCount = a.votes?.filter((v: any) => v.vote === 1).length || 0;
              const downvotesCount = a.votes?.filter((v: any) => v.vote === -1).length || 0;
              const myVote = a.votes?.find((v: any) => v.voter_id === currentUserId)?.vote;

              return (
                <View
                  key={a.id}
                  style={[styles.answerCard, isBest && styles.bestAnswerCard]}
                >
                  {isBest && (
                    <View style={styles.bestBanner}>
                      <Award size={15} color="#166534" />
                      <Text style={styles.bestBannerText}>الإجابة المعتمدة من صاحب السؤال ⭐</Text>
                    </View>
                  )}

                  <View style={styles.answerHeader}>
                    <View style={styles.answerAvatarWrap}>
                      {a.profiles?.avatar_url ? (
                        <Image source={{ uri: a.profiles.avatar_url }} style={styles.answerAvatarImg} />
                      ) : (
                        <View style={styles.answerAvatarPlaceholder}>
                          <Text style={styles.answerAvatarLetter}>{ansAuthorName[0] || 'ح'}</Text>
                        </View>
                      )}
                    </View>
                    <View style={styles.answerMeta}>
                      <Pressable onPress={() => a.author_id && router.push({ pathname: '/user', params: { id: a.author_id } })}>
                        <View style={styles.authorNameRow}>
                          <Text style={styles.answerAuthor}>{ansAuthorName}</Text>
                          {a.profiles?.is_geoverified && <ShieldCheck size={11} color="#10b981" />}
                        </View>
                      </Pressable>
                      <Text style={styles.dateTextSmall}>
                        {a.created_at ? relativeTime(a.created_at) : ''}
                      </Text>
                    </View>
                  </View>

                  {a.parent_answer_id && (
                    <View style={styles.replyToPill}>
                      <Reply size={12} color="#059669" />
                      <Text style={styles.replyToText}>رد على مشاركة سابقة</Text>
                    </View>
                  )}

                  <Text style={styles.answerBody}>{a.body}</Text>

                  {/* Actions Row */}
                  <View style={styles.answerActions}>
                    <View style={styles.actionsRightGroup}>
                      <Pressable
                        onPress={() => (currentUserId ? setReplyTo(a) : requireAccount('سجّل الدخول للرد على التعليقات.'))}
                        style={styles.replyBtn}
                      >
                        <Reply size={13} color="#475569" />
                        <Text style={styles.replyBtnText}>رد</Text>
                      </Pressable>

                      <Pressable
                        onPress={() => voteAnswer(a.id, 1)}
                        style={[styles.voteBtn, myVote === 1 && styles.voteActive]}
                      >
                        <ThumbsUp size={14} color={myVote === 1 ? '#059669' : '#64748b'} />
                        <Text style={[styles.voteText, myVote === 1 && styles.voteTextActive]}>
                          {upvotesCount}
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() => voteAnswer(a.id, -1)}
                        style={[styles.voteBtn, myVote === -1 && styles.voteDownActive]}
                      >
                        <ThumbsDown size={14} color={myVote === -1 ? '#ef4444' : '#64748b'} />
                        <Text style={[styles.voteText, myVote === -1 && styles.voteTextDownActive]}>
                          {downvotesCount}
                        </Text>
                      </Pressable>
                    </View>

                    {/* Best Answer Button for question owner */}
                    {isAuthor && q.status === 'open' && (
                      <Pressable onPress={() => chooseBest(a.id)} style={styles.bestBtn}>
                        <Check size={14} color="#fff" />
                        <Text style={styles.bestBtnText}>اعتماد</Text>
                      </Pressable>
                    )}

                    {/* Share location privately with neighbor */}
                    {currentUserId && a.author_id && a.author_id !== currentUserId && (
                      <Pressable
                        onPress={() => shareLocationPrivately(a.author_id, ansAuthorName)}
                        style={[styles.shareLocationBtn, sharingWith === a.author_id && { opacity: 0.6 }]}
                        disabled={Boolean(sharingWith)}
                      >
                        {sharingWith === a.author_id ? (
                          <ActivityIndicator size="small" color="#0f766e" />
                        ) : (
                          <MapPin size={13} color="#0f766e" />
                        )}
                        <Text style={styles.shareLocationBtnText}>موقعي (خاص)</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })
          )}
        </View>

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom Input Area */}
      {!currentUserId ? (
        <Pressable
          style={[styles.guestPrompt, { paddingBottom: Platform.OS === 'ios' ? 24 : 14 }]}
          onPress={() => requireAccount('سجّل الدخول أو أنشئ حساباً للرد والتصويت في نقاشات الحي.')}
        >
          <Text style={styles.guestPromptText}>سجّل الدخول للمشاركة في النقاش</Text>
          <MessageCircle size={18} color="#047857" />
        </Pressable>
      ) : (
        <View style={[styles.inputWrapper, { paddingBottom: Platform.OS === 'ios' ? 26 : 14 }]}>
          {replyTo && (
            <View style={styles.replyingBar}>
              <Reply size={14} color="#059669" />
              <Text style={styles.replyingText} numberOfLines={1}>
                الرد على {replyTo.profiles?.display_name || replyTo.profiles?.username || 'الجار'}
              </Text>
              <Pressable onPress={() => setReplyTo(null)}>
                <Text style={styles.cancelReply}>إلغاء</Text>
              </Pressable>
            </View>
          )}

          {q.status !== 'open' ? (
            <View style={styles.closedNotice}>
              <Lock size={15} color="#64748b" />
              <Text style={styles.closedNoticeText}>تم إغلاق الردود بعد اعتماد الإجابة الصحيحة</Text>
            </View>
          ) : (
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                multiline
                value={body}
                onChangeText={setBody}
                placeholder="اكتب ردك ومشاركتك هنا..."
                placeholderTextColor="#9ca3af"
                maxLength={500}
              />
              <Pressable
                style={({ pressed }) => [
                  styles.sendButton,
                  !body.trim() && styles.sendButtonDisabled,
                  pressed && { transform: [{ scale: 0.95 }] },
                ]}
                onPress={answer}
                disabled={!body.trim() || submitting || q.status !== 'open'}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Send size={18} color="#fff" />
                )}
              </Pressable>
            </View>
          )}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f8f7',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#f6f8f7',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
  loadingText: {
    color: '#059669',
    fontSize: 13,
    fontWeight: '800',
  },
  errorText: {
    fontSize: 17,
    color: '#475569',
    marginBottom: 16,
    fontWeight: '800',
  },
  backButton: {
    backgroundColor: '#059669',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 16,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 14,
  },
  hero: {
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerShareBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  scroll: {
    padding: 16,
  },
  questionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    marginBottom: 20,
  },
  qHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  authorSection: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  authorAvatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  authorAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#a7f3d0',
  },
  authorAvatarLetter: {
    color: '#065f46',
    fontSize: 18,
    fontWeight: '900',
  },
  authorInfoTexts: {
    alignItems: 'flex-end',
    flex: 1,
  },
  authorNameRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
  },
  authorName: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'right',
  },
  metaRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    marginTop: 3,
  },
  metaText: {
    fontSize: 11.5,
    color: '#64748b',
    fontWeight: '700',
  },
  metaTimeText: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  solvedBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  solvedBadgeText: {
    color: '#166534',
    fontSize: 11,
    fontWeight: '900',
  },
  openBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  openDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  openBadgeText: {
    color: '#047857',
    fontSize: 11,
    fontWeight: '900',
  },
  qTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'right',
    lineHeight: 26,
    marginBottom: 12,
  },
  qBodyContainer: {
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  qBody: {
    fontSize: 14.5,
    lineHeight: 24,
    color: '#334155',
    textAlign: 'right',
    fontWeight: '500',
  },
  privacyNote: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  privacyNoteText: {
    flex: 1,
    fontSize: 11,
    color: '#065f46',
    fontWeight: '700',
    textAlign: 'right',
    lineHeight: 16,
  },
  answersSection: {
    marginTop: 4,
  },
  answersHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  answersHeaderLeft: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  answersCountBadge: {
    backgroundColor: '#059669',
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  answersTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0f172a',
  },
  answersSubtitle: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 36,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderStyle: 'dashed',
    gap: 8,
  },
  emptyStateTitle: {
    fontSize: 15,
    color: '#0f172a',
    fontWeight: '900',
    marginTop: 4,
  },
  emptyStateText: {
    fontSize: 12.5,
    color: '#64748b',
    fontWeight: '700',
    textAlign: 'center',
  },
  answerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  bestAnswerCard: {
    borderColor: '#86efac',
    borderWidth: 2,
    backgroundColor: '#f0fdf4',
  },
  bestBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#86efac',
    alignSelf: 'flex-start',
  },
  bestBannerText: {
    color: '#166534',
    fontSize: 11.5,
    fontWeight: '900',
  },
  answerHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 12,
  },
  answerAvatarWrap: {
    marginLeft: 12,
  },
  answerAvatarImg: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  answerAvatarPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  answerAvatarLetter: {
    color: '#047857',
    fontSize: 16,
    fontWeight: '900',
  },
  answerMeta: {
    alignItems: 'flex-end',
    flex: 1,
  },
  answerAuthor: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'right',
  },
  dateTextSmall: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
    marginTop: 2,
  },
  replyToPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    marginBottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#ecfdf5',
  },
  replyToText: {
    color: '#047857',
    fontSize: 10.5,
    fontWeight: '800',
  },
  answerBody: {
    fontSize: 14,
    lineHeight: 23,
    color: '#334155',
    textAlign: 'right',
    fontWeight: '500',
    marginBottom: 14,
  },
  answerActions: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 6,
  },
  actionsRightGroup: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  replyBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
  },
  replyBtnText: {
    color: '#475569',
    fontSize: 11.5,
    fontWeight: '800',
  },
  voteBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  voteActive: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
  },
  voteDownActive: {
    backgroundColor: '#fee2e2',
    borderColor: '#fca5a5',
  },
  voteText: {
    color: '#64748b',
    fontSize: 11.5,
    fontWeight: '800',
  },
  voteTextActive: {
    color: '#059669',
  },
  voteTextDownActive: {
    color: '#dc2626',
  },
  bestBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#059669',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  bestBtnText: {
    color: '#ffffff',
    fontSize: 11.5,
    fontWeight: '900',
  },
  shareLocationBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ccfbf1',
    borderWidth: 1,
    borderColor: '#5eead4',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  shareLocationBtnText: {
    color: '#0f766e',
    fontSize: 11,
    fontWeight: '800',
  },
  guestPrompt: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 14,
    backgroundColor: '#ecfdf5',
    borderTopWidth: 1,
    borderColor: '#d1fae5',
  },
  guestPromptText: {
    color: '#047857',
    fontSize: 13,
    fontWeight: '900',
  },
  inputWrapper: {
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  replyingBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#ecfdf5',
  },
  replyingText: {
    flex: 1,
    color: '#047857',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
  },
  cancelReply: {
    color: '#64748b',
    fontSize: 11.5,
    fontWeight: '800',
  },
  closedNotice: {
    flexDirection: 'row-reverse',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  closedNoticeText: {
    color: '#64748b',
    fontSize: 12.5,
    fontWeight: '800',
  },
  inputContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-end',
    backgroundColor: '#f8fafc',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 110,
    textAlign: 'right',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 14,
    color: '#0f172a',
    fontWeight: '500',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  sendButtonDisabled: {
    backgroundColor: '#cbd5e1',
    shadowOpacity: 0,
    elevation: 0,
  },
});
