import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/ui';
import { MapPin, MessageCircle, Send, ChevronRight, User, HelpCircle, Clock3, Reply, Sparkles } from 'lucide-react-native';

export default function Question() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [q, setQ] = useState<any>();
  const [answers, setAnswers] = useState<any[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    setLoading(true);
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

    const r = await supabase.from('answers').insert({
      question_id: id,
      author_id: u.user.id,
      body: body.trim()
    });

    setSubmitting(false);
    if (r.error) {
      Alert.alert('خطأ', r.error.message);
    } else {
      setBody('');
      load();
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={C.accent} />
      </View>
    );
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
          <ChevronRight size={24} color="#059669" />
        </Pressable>
        <View style={styles.headerCenter}><Text style={styles.headerEyebrow}>حيّنا • نقاش محلي</Text><Text style={styles.headerTitle}>تفاصيل السؤال</Text></View>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.questionCard}>
          <View style={styles.qHeader}>
            <View style={styles.authorBadge}>
              <Sparkles size={24} color="#fff" />
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
              <View key={a.id} style={styles.answerCard}>
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
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <View style={styles.inputWrapper}><View style={styles.replyHint}><Reply size={15} color={C.accent} /><Text style={styles.replyHintText}>شارك رأيك مع أهل الحي</Text></View>
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
            disabled={!body.trim() || submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Send size={20} color="#fff" style={{ marginLeft: -2 }} />
            )}
          </Pressable>
        </View>
      </View>
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
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: C.line,
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerEyebrow: { fontSize: 11, color: "#059669", fontWeight: "800", marginBottom: 3 },
  headerBtn: {
    padding: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: C.ink,
  },
  scroll: {
    flexGrow: 1,
    padding: 24,
    paddingBottom: 100,
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
    paddingBottom: Platform.OS === 'ios' ? 30 : 16,
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
