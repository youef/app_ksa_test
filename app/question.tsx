import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/ui';
import BottomNav from '@/components/BottomNav';
import { MapPin, MessageCircle, Send, ChevronRight, User, Clock3, Reply, Sparkles, CheckCircle2, ThumbsUp, ThumbsDown, Lock, CircleCheck, Award } from 'lucide-react-native';

export default function Question() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [q, setQ] = useState<any>();
  const [answers, setAnswers] = useState<any[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [voting, setVoting] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<any | null>(null);

  async function load() {
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    setCurrentUserId(auth.user?.id ?? null);
    const [a, b] = await Promise.all([
      supabase.from('questions').select('*').eq('id', id).single(),
      supabase.from('answers').select('*').eq('question_id', id).order('created_at')
    ]);

    if (a.data) {
      const userIds = [a.data.author_id, ...(b.data || []).map(ans => ans.author_id)];
      const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
      
      const { data: profilesData } = await supabase.from('profiles').select('*').in('id', uniqueIds);
      const profilesMap = (profilesData || []).reduce((acc: any, p: any) => ({ ...acc, [p.id]: p }), {});
      
      a.data.profiles = profilesMap[a.data.author_id];
      if (b.data) {
        b.data.forEach((ans: any) => { ans.profiles = profilesMap[ans.author_id]; });
      }
    }

    setQ(a.data);
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
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setSubmitting(false);
      return Alert.alert('تنبيه', 'يجب تسجيل الدخول أولاً');
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
    Alert.alert('تم الإرسال', 'تم نشر ردك بنجاح.');
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={C.accent} />
      </View>
    );
  }

  async function voteAnswer(answerId: string, vote: number) {
    if (!currentUserId || voting) return;
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
    const ok = await new Promise<boolean>(resolve => Alert.alert('اختيار الإجابة الصحيحة', 'سيتم اعتماد هذه الإجابة وإغلاق الردود تلقائياً.', [
      { text: 'إلغاء', style: 'cancel', onPress: () => resolve(false) },
      { text: 'اعتماد وإغلاق', style: 'default', onPress: () => resolve(true) },
    ]));
    if (!ok) return;
    const { data: updated, error } = await supabase.from('questions').update({ best_answer_id: answerId, status: 'solved', solved_at: new Date().toISOString() }).eq('id', id).eq('author_id', currentUserId).select('id, best_answer_id, status').maybeSingle();
    if (!error && !updated) return Alert.alert('تعذر الاعتماد', 'لم يتم تعديل السؤال. تأكد أنك صاحب السؤال.');
    if (error) return Alert.alert('تعذر اعتماد الإجابة', error.message);
    load();
  }

  if (!q) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>السؤال غير موجود أو تم حذفه</Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>العودة</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={({pressed}) => [styles.headerBtn, pressed && {opacity: 0.7}]}>
          <ChevronRight size={24} color="#fff" />
        </Pressable>
        <View style={styles.headerCenter}><Text style={styles.headerEyebrow}>حيّنا • نقاش محلي</Text><Text style={styles.headerTitle}>تفاصيل السؤال</Text></View>
        <Pressable onPress={() => router.push('/notifications')} style={styles.headerBtn}><MessageCircle size={21} color="#fff" /></Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.questionCard}>
          <View style={styles.qHeader}>
            <View style={styles.authorBadge}>
              <User size={24} color="#fff" />
            </View>
            <View style={styles.qHeaderTexts}>
              <Text style={styles.qTitle}>{q.title}</Text>
              <View style={styles.locationRow}>
                <MapPin size={14} color={C.muted} />
                <Text style={styles.metaText}>{q.city || 'السعودية'} {q.district ? `· ${q.district}` : ''}</Text>
              </View>
            </View>
          </View>
          
          <View style={styles.qBodyContainer}>
            <Text style={styles.qBody}>{q.body}</Text>
          </View>
          
          <View style={styles.qFooter}>
            <View>
              <Pressable onPress={() => router.push({ pathname: '/user', params: { id: q.author_id } })}>
                <Text style={styles.authorName}>
                  بواسطة: {q.profiles?.hide_name ? 'مستخدم مجهول' : (q.profiles?.display_name || q.profiles?.username || 'مستخدم')}
                </Text>
              </Pressable>
              <Text style={styles.dateText}>
                {new Date(q.created_at).toLocaleDateString('ar-SA')}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.answersSection}>
          <View style={styles.answersHeader}>
            <MessageCircle size={22} color={C.ink} />
            <View><Text style={styles.answersTitle}>الإجابات والردود</Text><Text style={styles.answersSubtitle}>{answers.length === 0 ? "كن أول من يشارك في النقاش" : `${answers.length} ردود من المجتمع`}</Text></View>
          </View>

          {answers.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>لا توجد ردود بعد. كن أول من يجيب!</Text>
            </View>
          ) : (
            answers.map(a => (
              <View key={a.id} style={[styles.answerCard, q.best_answer_id === a.id && styles.bestAnswerCard]}>
                <View style={styles.answerHeader}>
                  <View style={styles.answerAvatar}>
                    <User size={20} color="#059669" />
                  </View>
                  <View style={styles.answerMeta}>
                    <Pressable onPress={() => router.push({ pathname: '/user', params: { id: a.author_id } })}>
                      <Text style={styles.answerAuthor}>
                        {a.profiles?.hide_name ? 'مستخدم مجهول' : (a.profiles?.display_name || a.profiles?.username || 'مستخدم')}
                      </Text>
                    </Pressable>
                    <Text style={styles.dateTextSmall}>
                      {new Date(a.created_at).toLocaleDateString('ar-SA')}
                    </Text>
                  </View>
                </View>
                <Text style={styles.answerBody}>{a.body}</Text>
                {a.parent_answer_id ? <View style={styles.replyToPill}><Reply size={13} color="#059669" /><Text style={styles.replyToText}>رد على تعليق سابق</Text></View> : null}
                {q.best_answer_id === a.id ? <View style={styles.bestBanner}><Award size={16} color="#166534" /><Text style={styles.bestBannerText}>الإجابة المعتمدة</Text></View> : null}
                <View style={styles.answerActions}>
                  <Pressable onPress={() => setReplyTo(a)} style={styles.replyBtn}><Reply size={15} color="#475569" /><Text style={styles.replyBtnText}>رد</Text></Pressable>
                  <Pressable onPress={() => voteAnswer(a.id, 1)} style={[styles.voteBtn, { minHeight: 42 }, a.votes?.some((v: any) => v.voter_id === currentUserId && v.vote === 1) && styles.voteActive]}><ThumbsUp size={16} color={a.votes?.some((v: any) => v.voter_id === currentUserId && v.vote === 1) ? C.accent : '#64748b'} /><Text style={styles.voteText}>{a.votes?.filter((v: any) => v.vote === 1).length || 0}</Text></Pressable>
                  <Pressable onPress={() => voteAnswer(a.id, -1)} style={[styles.voteBtn, a.votes?.some((v: any) => v.voter_id === currentUserId && v.vote === -1) && styles.voteDownActive]}><ThumbsDown size={16} color="#64748b" /><Text style={styles.voteText}>{a.votes?.filter((v: any) => v.vote === -1).length || 0}</Text></Pressable>
                  {currentUserId === q.author_id && q.status === 'open' ? <Pressable onPress={() => chooseBest(a.id)} style={styles.bestBtn}><CircleCheck size={16} color="#fff" /><Text style={styles.bestBtnText}>اعتماد كأفضل إجابة</Text></Pressable> : null}
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <View style={styles.inputWrapper}>{replyTo ? <View style={styles.replyingBar}><Reply size={15} color={C.accent} /><Text style={styles.replyingText}>الرد على {replyTo.profiles?.display_name || replyTo.profiles?.username || 'المستخدم'}</Text><Pressable onPress={() => setReplyTo(null)}><Text style={styles.cancelReply}>إلغاء</Text></Pressable></View> : null}{q.status !== 'open' ? <View style={styles.closedNotice}><Lock size={16} color="#64748b" /><Text style={styles.closedNoticeText}>تم إغلاق الردود بعد اعتماد الإجابة</Text></View> : null}<View style={styles.replyHint}><Reply size={15} color={C.accent} /><Text style={styles.replyHintText}>شارك رأيك مع أهل الحي</Text></View>
        <View style={styles.inputContainer}>
          <TextInput 
            style={styles.input} 
            multiline 
            value={body} 
            onChangeText={setBody} 
            placeholder="اكتب ردك هنا..." 
            placeholderTextColor="#9ca3af"
          />
          <Pressable 
            style={({pressed}) => [
              styles.sendButton, 
              !body.trim() && styles.sendButtonDisabled,
              pressed && {transform: [{scale: 0.95}]}
            ]} 
            onPress={answer}
            disabled={!body.trim() || submitting || q.status !== 'open'}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Send size={20} color="#fff" style={{ marginLeft: -2 }} />
            )}
          </Pressable>
        </View>
      </View>
      <BottomNav />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: C.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 18,
    color: C.muted,
    marginBottom: 20,
    fontWeight: '800',
  },
  backButton: {
    backgroundColor: C.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#064e3b',
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerEyebrow: { fontSize: 11, color: "#a7f3d0", fontWeight: "800", marginBottom: 3 },
  headerBtn: {
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#fff',
  },
  scroll: {
    flexGrow: 1,
    padding: 24,
    paddingBottom: 180,
  },
  questionCard: {
    backgroundColor: C.card,
    borderRadius: 32,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 15,
    elevation: 3,
    marginBottom: 32,
  },
  qHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  authorBadge: {
    width: 56,
    height: 56,
    borderRadius: 20,
    backgroundColor: C.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 16,
  },
  qHeaderTexts: {
    flex: 1,
    alignItems: 'flex-end',
  },
  qTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: C.ink,
    textAlign: 'right',
    marginBottom: 8,
    lineHeight: 32,
  },
  locationRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  metaText: {
    fontSize: 13,
    color: C.muted,
    marginRight: 6,
    fontWeight: '700',
  },
  qBodyContainer: {
    backgroundColor: '#f9fafb',
    padding: 20,
    borderRadius: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  qBody: {
    fontSize: 16,
    lineHeight: 28,
    color: '#374151',
    textAlign: 'right',
    fontWeight: '500',
  },
  qFooter: {
    flexDirection: 'row-reverse',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  authorLine: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5 },
  metaLine: { flexDirection: 'row-reverse', alignItems: 'center', gap: 7, marginTop: 4 },
  openBadge: { color: '#047857', backgroundColor: '#d1fae5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9, fontSize: 10, fontWeight: '900' },
  closedBadge: { color: '#475569', backgroundColor: '#e2e8f0', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9, fontSize: 10, fontWeight: '900' },
  authorName: {
    fontSize: 14,
    fontWeight: '900',
    color: C.accent,
    marginBottom: 4,
    textAlign: 'right',
  },
  dateText: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '600',
    textAlign: 'right',
  },
  answersSection: {
    marginTop: 8,
  },
  answersHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 20,
  },
  answersSubtitle: { fontSize: 12, color: "#94a3b8", fontWeight: "700", textAlign: "right", marginTop: 3 },
  answersTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: C.ink,
    marginRight: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#fff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#9ca3af',
    fontWeight: '800',
  },
  answerCard: {
    backgroundColor: C.card,
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: C.line,
  },
  answerHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 16,
  },
  answerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 16,
  },
  answerMeta: {
    alignItems: 'flex-end',
    flex: 1,
  },
  avatarLetter: { color: '#047857', fontSize: 18, fontWeight: '900' },
  bestAnswerCard: { borderColor: '#86efac', borderWidth: 2, backgroundColor: '#f0fdf4' },
  bestBanner: { flexDirection: 'row-reverse', alignItems: 'center', alignSelf: 'flex-end', gap: 6, marginTop: 14, backgroundColor: '#dcfce7', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12 },
  bestBannerText: { color: '#166534', fontSize: 12, fontWeight: '900' },
  answerActions: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  voteBtn: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, backgroundColor: '#f8fafc' },
  voteActive: { backgroundColor: '#dcfce7' },
  voteDownActive: { backgroundColor: '#f1f5f9' },
  voteText: { color: '#64748b', fontSize: 12, fontWeight: '800' },
  bestBtn: { marginLeft: 'auto', flexDirection: 'row-reverse', alignItems: 'center', gap: 6, backgroundColor: '#059669', paddingHorizontal: 12, paddingVertical: 9, borderRadius: 12 },
  bestBtnText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  closedNotice: { flexDirection: 'row-reverse', justifyContent: 'center', alignItems: 'center', gap: 7, paddingBottom: 9 },
  closedNoticeText: { color: '#64748b', fontSize: 12, fontWeight: '800' },
  replyBtn: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: '#f1f5f9', marginRight: 4 },
  replyBtnText: { color: '#475569', fontSize: 12, fontWeight: '800' },
  replyToPill: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, alignSelf: 'flex-end', marginTop: 10, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10, backgroundColor: '#ecfdf5' },
  replyToText: { color: '#047857', fontSize: 11, fontWeight: '800' },
  replyingBar: { flexDirection: 'row-reverse', alignItems: 'center', gap: 7, marginBottom: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: '#ecfdf5' },
  replyingText: { flex: 1, color: '#047857', fontSize: 12, fontWeight: '800', textAlign: 'right' },
  cancelReply: { color: '#64748b', fontSize: 11, fontWeight: '800' },
  answerAuthor: {
    fontSize: 16,
    fontWeight: '900',
    color: C.ink,
    textAlign: 'right',
    marginBottom: 4,
  },
  dateTextSmall: {
    fontSize: 12,
    color: '#9ca3af',
    fontWeight: '600',
  },
  answerBody: {
    fontSize: 15,
    lineHeight: 26,
    color: '#4b5563',
    textAlign: 'right',
    fontWeight: '500',
  },
  replyHint: { flexDirection: "row-reverse", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 8 },
  replyHintText: { fontSize: 12, color: "#64748b", fontWeight: "700" },
  inputWrapper: {
    padding: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: C.line,
    paddingBottom: Platform.OS === 'ios' ? 92 : 76,
  },
  inputContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-end',
    backgroundColor: '#f9fafb',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    minHeight: 48,
    maxHeight: 120,
    textAlign: 'right',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    fontSize: 16,
    color: C.ink,
    fontWeight: '500',
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 4,
  },
  sendButtonDisabled: {
    backgroundColor: '#d1d5db',
    shadowOpacity: 0,
    elevation: 0,
  }
});
