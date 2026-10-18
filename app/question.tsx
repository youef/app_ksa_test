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
  Keyboard,
  Platform,
  ActivityIndicator,
  Share,
  Image,
  Modal,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { AppHeader } from '@/components/shared/AppHeader';
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
  Flame,
  Eye,
  AlertTriangle,
  ChevronLeft,
  Pencil,
  Trash2,
  X,
  Bookmark,
  Flag,
  Pin,
} from 'lucide-react-native';
import { requireAccount } from '@/lib/authGate';
import { areaLabel } from '@/lib/privacy';
import { getCurrentDeviceLocation, reverseGeocodeDeviceLocation } from '@/lib/deviceLocation';
import { relativeTime } from '@/lib/mapPins';

const QUICK_QUESTION_RESPONSES = [
  'شفته بالقرب من المسجد 📍',
  'الله يحفظه ويرده بالسلامة 🤲',
  'أنا بالحي وأقدر أساعدكم بالبحث 🚗',
  'تواصل معي بالخاص للتنسيق 💬',
];

export default function Question() {
  const insets = useSafeAreaInsets();
  const [composerFocused, setComposerFocused] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
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
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteBusy, setFavoriteBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('محتوى غير مناسب');
  const [reportDetails, setReportDetails] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const [pinBusy, setPinBusy] = useState(false);
  const [answerSort, setAnswerSort] = useState<'newest' | 'useful'>('newest');
  const [editingAnswer, setEditingAnswer] = useState<any | null>(null);
  const [editAnswerBody, setEditAnswerBody] = useState('');
  const [savingAnswerEdit, setSavingAnswerEdit] = useState(false);
  const [deletingAnswerId, setDeletingAnswerId] = useState<string | null>(null);

  // Edit & Delete states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingQuestion, setDeletingQuestion] = useState(false);

  async function load(showLoading = true) {
    if (showLoading) setLoading(true);
    const { data: auth } = await supabase.auth.getSession();
    const user = auth.session?.user ?? null;
    setCurrentUserId(user?.id ?? null);
    const questionPromise = user
      ? supabase.from('questions').select('*').eq('id', id).maybeSingle()
      : getActiveLocation().then(location =>
          supabase.rpc('hayna_guest_question', {
            p_id: id,
            p_city: location.city,
            p_district: location.district,
          })
        );
    const [questionResult, b] = await Promise.all([
      questionPromise,
      supabase.from('answers').select('*').eq('question_id', id).order('created_at'),
    ]);
    const question = Array.isArray(questionResult.data) ? questionResult.data[0] : questionResult.data;

    if (question) {
      // Safely increment views_count
      if (question.id && user) {
        try {
          supabase
            .from('questions')
            .update({ views_count: (question.views_count || 0) + 1 })
            .eq('id', id)
            .then(() => {});
        } catch {}
      }

      const userIds = [question.author_id, ...(b.data || []).map((ans: any) => ans.author_id)];
      const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));

      const { data: profilesData } = await supabase.from('profiles').select('*').in('id', uniqueIds);
      const profilesMap = (profilesData || []).reduce((acc: any, p: any) => ({ ...acc, [p.id]: p }), {});

      question.profiles = profilesMap[question.author_id];
      if (b.data) {
        b.data.forEach((ans: any) => {
          ans.profiles = profilesMap[ans.author_id];
        });
      }
    }

    setQ(question);
    if (id) {
      if (user) {
        const { data: favoriteRow } = await supabase.from('favorite_items').select('id').eq('user_id', user.id).eq('target_type', 'question').eq('target_id', id).maybeSingle();
        setIsFavorite(Boolean(favoriteRow));
      } else setIsFavorite(false);
    }
    const answerIds = (b.data || []).map((x: any) => x.id);
    let votes: any[] = [];
    if (answerIds.length) {
      const { data: vd } = await supabase
        .from('answer_votes')
        .select('answer_id,voter_id,vote')
        .in('answer_id', answerIds);
      votes = vd || [];
    }
    const voteMap = votes.reduce((m: any, v: any) => {
      (m[v.answer_id] ||= []).push(v);
      return m;
    }, {});
    (b.data || []).forEach((ans: any) => {
      ans.votes = voteMap[ans.id] || [];
    });
    setAnswers(b.data ?? []);
    if (showLoading) setLoading(false);
  }

  useEffect(() => {
    void load();
  }, [id]);

  // Keep the discussion and in-app notifications fresh across web and native clients.
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`question-discussion-${id}-${currentUserId || 'guest'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'answers', filter: `question_id=eq.${id}` }, () => {
        void load(false);
      });
    if (currentUserId) {
      channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${currentUserId}` }, (payload: any) => {
        const notification = payload.new;
        if (notification?.target_type === 'question' && notification?.target_id === id && notification?.type === 'answer') {
          Alert.alert(notification.title || 'رد جديد على استفسارك', notification.body || 'وصل رد جديد إلى النقاش.');
        }
      });
    }
    channel.subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [id, currentUserId]);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const viewport = typeof window !== 'undefined' ? window.visualViewport : null;
      const syncViewport = () => {
        if (!viewport || typeof window === 'undefined') return;
        setKeyboardVisible(window.innerHeight - viewport.height - viewport.offsetTop > 120);
      };
      viewport?.addEventListener('resize', syncViewport);
      viewport?.addEventListener('scroll', syncViewport);
      return () => {
        viewport?.removeEventListener('resize', syncViewport);
        viewport?.removeEventListener('scroll', syncViewport);
      };
    }

    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const notifyComposerFocus = (focused: boolean) => {
    setComposerFocused(focused);
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('hayna:composer-focus', { detail: { focused } }));
    }
  };

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
        code.includes('AUTH_REQUIRED')
          ? 'انتهت جلسة الدخول. سجّل الدخول مرة أخرى.'
          : code.includes('QUESTION_CLOSED')
          ? 'تم إغلاق الردود على هذا الموضوع.'
          : code.includes('INVALID_PARENT')
          ? 'التعليق الذي تحاول الرد عليه غير صالح.'
          : code.includes('QUESTION_NOT_FOUND')
          ? 'الموضوع غير موجود.'
          : code.includes('EMPTY_BODY')
          ? 'اكتب الرد أولاً.'
          : 'تعذر إرسال الرد الآن. حاول مرة أخرى.';
      Alert.alert('لم يتم إرسال الرد', message);
      return;
    }

    setBody('');
    setReplyTo(null);
    // Best-effort in-app notification to the question owner and the replied-to author.
    try {
      const recipients = new Set<string>();
      if (q?.author_id && q.author_id !== auth.session.user.id) recipients.add(q.author_id);
      if (replyTo?.author_id && replyTo.author_id !== auth.session.user.id) recipients.add(replyTo.author_id);
      if (recipients.size) {
        await supabase.from('notifications').insert(Array.from(recipients).map(user_id => ({
          user_id, type: 'answer', title: replyTo ? '💬 رد جديد على تعليقك' : '💬 وصل رد جديد على استفسارك',
          body: `${(auth.session.user.user_metadata?.display_name || 'أحد الجيران')} أضاف ردًا: «${body.trim().slice(0, 120)}»`,
          target_type: 'question', target_id: id,
        })));
      }
    } catch { /* The answer remains successful if optional notifications are unavailable. */ }
    void load(false);
  }

  async function voteAnswer(answerId: string, value: number) {
    if (!currentUserId) {
      return requireAccount('سجّل الدخول للتصويت على الإجابات.');
    }
    if (voting) return;

    setVoting(answerId);
    try {
      const existingVote = answers.find(a => a.id === answerId)?.votes?.find((v: any) => v.voter_id === currentUserId);
      if (existingVote && existingVote.vote === value) {
        await supabase.from('answer_votes').delete().eq('answer_id', answerId).eq('voter_id', currentUserId);
      } else {
        await supabase.from('answer_votes').upsert({
          answer_id: answerId,
          voter_id: currentUserId,
          vote: value,
        });
      }
      load();
    } catch {
      // Ignored
    } finally {
      setVoting(null);
    }
  }

  async function chooseBest(answerId: string) {
    if (!currentUserId || currentUserId !== q.author_id) return;

    try {
      let updated: any = null;
      let updateErr: any = null;

      const resSolved = await supabase
        .from('questions')
        .update({ best_answer_id: answerId, status: 'solved', solved_at: new Date().toISOString() })
        .eq('id', id)
        .eq('author_id', currentUserId)
        .select('id, best_answer_id, status')
        .maybeSingle();

      if (!resSolved.error) {
        updated = resSolved.data;
      } else {
        const resClosed = await supabase
          .from('questions')
          .update({ best_answer_id: answerId, status: 'closed', solved_at: new Date().toISOString() })
          .eq('id', id)
          .eq('author_id', currentUserId)
          .select('id, best_answer_id, status')
          .maybeSingle();

        if (!resClosed.error) {
          updated = resClosed.data;
        } else {
          const resMinimal = await supabase
            .from('questions')
            .update({ best_answer_id: answerId, solved_at: new Date().toISOString() })
            .eq('id', id)
            .eq('author_id', currentUserId)
            .select('id, best_answer_id, status')
            .maybeSingle();

          if (!resMinimal.error) {
            updated = resMinimal.data;
          } else {
            updateErr = resMinimal.error;
          }
        }
      }

      if (updateErr) throw updateErr;
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

      Alert.alert('تم اعتماد الإجابة بنجاح! 🌟', 'تمت إضافة +10 نقاط سمعة لحساب الجار تقديراً لإفادته أهل الحي.');
      load();
    } catch (e: any) {
      Alert.alert('تعذر اعتماد الإجابة', e?.message || 'حدث خطأ أثناء الاعتماد.');
    }
  }

  async function shareLocationPrivately(targetUserId: string, _targetName: string) {
    if (!currentUserId || sharingWith) return;

    setSharingWith(targetUserId);
    try {
      let locLat = 24.7136;
      let locLng = 46.6753;
      let label = 'موقعي في الحي';

      const deviceLoc = await getCurrentDeviceLocation();
      if (deviceLoc) {
        locLat = deviceLoc.latitude;
        locLng = deviceLoc.longitude;
        const place = await reverseGeocodeDeviceLocation(deviceLoc);
        label = place?.district ? `حي ${place.district}` : place?.city || 'موقعي الحالي';
      }

      let finalConvId: string | null = null;
      try {
        const { data: rpcConvId } = await supabase.rpc('hayna_get_or_create_direct_conversation', {
          p_target: targetUserId,
        });
        if (rpcConvId) finalConvId = rpcConvId;
      } catch {}

      if (finalConvId) {
        await supabase.from('messages').insert({
          conversation_id: finalConvId,
          sender_id: currentUserId,
          body: JSON.stringify({ type: 'location', lat: locLat, lng: locLng, label }),
          read_by: [currentUserId],
        });
        router.push({ pathname: '/conversation', params: { id: finalConvId } });
      }
    } catch {
      Alert.alert('تنبيه', 'تعذر إرسال الموقع بالخاص حالياً.');
    } finally {
      setSharingWith(null);
    }
  }

  async function toggleFavorite() {
    if (!currentUserId) return requireAccount('سجّل الدخول لحفظ الاستفسار والرجوع إليه لاحقاً.');
    if (favoriteBusy) return;
    setFavoriteBusy(true);
    try {
      if (isFavorite) {
        const { error } = await supabase.from('favorite_items').delete().eq('user_id', currentUserId).eq('target_type', 'question').eq('target_id', id);
        if (error) throw error;
        setIsFavorite(false);
      } else {
        const { error } = await supabase.from('favorite_items').insert({ user_id: currentUserId, target_type: 'question', target_id: id });
        if (error) throw error;
        setIsFavorite(true);
      }
    } catch {
      Alert.alert('تعذر الحفظ', 'لم نتمكن من تحديث قائمة المحفوظات. تحقق من اتصالك وحاول مجدداً.');
    } finally {
      setFavoriteBusy(false);
    }
  }

  async function submitReport() {
    if (!currentUserId) return requireAccount('سجّل الدخول للإبلاغ عن الاستفسار.');
    const reason = [reportReason, reportDetails.trim()].filter(Boolean).join(' — ').slice(0, 500);
    if (reportBusy || !reason) return;
    setReportBusy(true);
    try {
      const { error } = await supabase.from('reports').insert({ reporter_id: currentUserId, target_type: 'question', target_id: id, reason });
      if (error) throw error;
      setReportOpen(false);
      setReportDetails('');
      Alert.alert('تم استلام البلاغ', 'شكرًا لمساهمتك في الحفاظ على مجتمع آمن. سيُراجع فريق حيّنا البلاغ.');
    } catch {
      Alert.alert('تعذر إرسال البلاغ', 'لم يتم إرسال البلاغ الآن. حاول مرة أخرى لاحقًا.');
    } finally {
      setReportBusy(false);
    }
  }

  async function togglePin() {
    if (!isAuthor || pinBusy) return;
    setPinBusy(true);
    try {
      const nextPinned = !Boolean(q?.is_pinned);
      const { error } = await supabase.from('questions').update({ is_pinned: nextPinned, pinned_at: nextPinned ? new Date().toISOString() : null }).eq('id', id).eq('author_id', currentUserId);
      if (error) throw error;
      setQ((current: any) => current ? { ...current, is_pinned: nextPinned, pinned_at: nextPinned ? new Date().toISOString() : null } : current);
      Alert.alert(nextPinned ? 'تم تثبيت الاستفسار' : 'تم إلغاء التثبيت', nextPinned ? 'تم تثبيت الاستفسار في ملفه.' : 'أزيل التثبيت من الاستفسار.');
    } catch {
      Alert.alert('تعذر تحديث التثبيت', 'تأكد من صلاحية تعديل الاستفسار ثم حاول مجددًا.');
    } finally {
      setPinBusy(false);
    }
  }

  const handleShare = async () => {
    const shareUrl = typeof window !== 'undefined' ? window.location.href : `https://hayna.app/question?id=${id}`;
    const shareText = `استفسار في حيّنا: «${q?.title}»\n${shareUrl}`;
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareText);
        Alert.alert('تم نسخ الرابط 📋', 'تم نسخ رابط السؤال لمشاركته في مجموعات الحي.');
        return;
      } catch {}
    }
    try {
      await Share.share({ message: shareText, url: shareUrl, title: q?.title });
    } catch {}
  };

  const isAuthor = Boolean(currentUserId && q?.author_id && currentUserId === q.author_id);
  const editCount = q?.edit_count || 0;
  const MAX_EDITS = 2;
  const editsRemaining = Math.max(0, MAX_EDITS - editCount);

  function handleOpenEdit() {
    if (editsRemaining <= 0) {
      Alert.alert(
        'استنفاد محاولات التعديل ⚠️',
        'تم استنفاد الحد الأقصى المسموح للتعديل (محاولتان فقط) حفاظاً على مصداقية وسياق الردود في الحي.'
      );
      return;
    }
    setEditTitle(q?.title || '');
    setEditContent(q?.content || q?.body || '');
    setIsEditModalOpen(true);
  }

  async function handleSaveEdit() {
    if (!editTitle.trim()) {
      return Alert.alert('بيانات ناقصة', 'يرجى كتابة عنوان السؤال.');
    }
    if (editsRemaining <= 0) {
      return Alert.alert('تنبيه', 'تم استنفاد الحد الأقصى للتعديل.');
    }

    setSavingEdit(true);
    try {
      const nextEditCount = editCount + 1;
      const { error } = await supabase
        .from('questions')
        .update({
          title: editTitle.trim(),
          content: editContent.trim(),
          body: editContent.trim(),
          edit_count: nextEditCount,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;

      setIsEditModalOpen(false);
      Alert.alert(
        'تم حفظ التعديل بنجاح ✅',
        `متبقي لك ${MAX_EDITS - nextEditCount} من أصل ${MAX_EDITS} محاولات تعديل.`
      );
      load();
    } catch (err: any) {
      Alert.alert('خطأ', err?.message || 'تعذر تعديل الاستفسار.');
    } finally {
      setSavingEdit(false);
    }
  }

  function handleDeleteQuestion() {
    Alert.alert(
      'حذف الاستفسار نهائياً ⚠️',
      'هل أنت متأكد من رغبتك في حذف هذا الاستفسار وجميع الردود المرتبطة به؟ لا يمكن التراجع عن هذا الإجراء.',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف نهائي',
          style: 'destructive',
          onPress: async () => {
            setDeletingQuestion(true);
            try {
              await supabase.from('answers').delete().eq('question_id', id);
              const { error } = await supabase.from('questions').delete().eq('id', id);
              if (error) throw error;

              Alert.alert('تم الحذف', 'تم حذف الاستفسار بنجاح من الحي.', [
                { text: 'حسناً', onPress: () => router.replace('/questions') },
              ]);
            } catch (err: any) {
              Alert.alert('خطأ', err?.message || 'تعذر حذف الاستفسار.');
              setDeletingQuestion(false);
            }
          },
        },
      ]
    );
  }

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

  const authorName = q.profiles?.hide_name
    ? 'مستخدم مجهول'
    : q.profiles?.display_name || q.profiles?.username || 'أحد سكان الحي';
  const isSolved = q.status === 'solved' || q.status === 'closed' || Boolean(q.best_answer_id);
  const locationLabel = areaLabel({ district: q.district, city: q.city });

  const threadedAnswers = (() => {
    const compare = (left: any, right: any) => {
      if (answerSort === 'useful') {
        const score = (item: any) => (item.votes || []).reduce((sum: number, vote: any) => sum + (vote.vote === 1 ? 1 : vote.vote === -1 ? -1 : 0), 0);
        const delta = score(right) - score(left);
        if (delta) return delta;
      }
      return new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime();
    };
    const byParent = new Map<string, any[]>();
    answers.forEach((item: any) => {
      const parent = item.parent_answer_id || '__root__';
      byParent.set(parent, [...(byParent.get(parent) || []), item]);
    });
    const flattened: { answer: any; depth: number }[] = [];
    const visit = (parentId: string, depth: number, seen: Set<string>) => {
      (byParent.get(parentId) || []).sort(compare).forEach((item: any) => {
        if (seen.has(item.id)) return;
        flattened.push({ answer: item, depth });
        const nextSeen = new Set(seen); nextSeen.add(item.id);
        visit(item.id, Math.min(depth + 1, 4), nextSeen);
      });
    };
    visit('__root__', 0, new Set());
    // Orphaned replies remain visible rather than disappearing if their parent was removed.
    answers.filter((item: any) => !flattened.some(entry => entry.answer.id === item.id)).sort(compare)
      .forEach((item: any) => flattened.push({ answer: item, depth: 0 }));
    return flattened;
  })();

  async function saveAnswerEdit() {
    if (!editingAnswer || !currentUserId || !editAnswerBody.trim() || savingAnswerEdit) return;
    setSavingAnswerEdit(true);
    try {
      const { data: updated, error } = await supabase.from('answers')
        .update({ body: editAnswerBody.trim(), updated_at: new Date().toISOString() })
        .eq('id', editingAnswer.id).eq('author_id', currentUserId).select('id').maybeSingle();
      if (error) throw error;
      if (!updated) throw new Error('يمكن لصاحب الرد فقط تعديله.');
      setEditingAnswer(null); setEditAnswerBody('');
      await load(false);
    } catch (error: any) {
      Alert.alert('تعذر تعديل الرد', error?.message || 'تحقق من صلاحياتك وحاول مجددًا.');
    } finally { setSavingAnswerEdit(false); }
  }

  function confirmDeleteAnswer(answer: any) {
    if (!currentUserId || answer.author_id !== currentUserId) return;
    Alert.alert('حذف الرد', 'هل تريد حذف هذا الرد؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: async () => {
        setDeletingAnswerId(answer.id);
        try {
          // A database trigger detaches child replies before deletion so nested discussion remains readable.
          const { data: deleted, error } = await supabase.from('answers').delete().eq('id', answer.id).eq('author_id', currentUserId).select('id').maybeSingle();
          if (error) throw error;
          if (!deleted) throw new Error('يمكن لصاحب الرد فقط حذفه.');
          await load(false);
        } catch (error: any) {
          Alert.alert('تعذر حذف الرد', error?.message || 'حاول مرة أخرى.');
        } finally { setDeletingAnswerId(null); }
      } },
    ]);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0} style={styles.container}>
      <AppHeader
        variant="sub"
        title="استفسار ونقاش الحي"
        subtitle={locationLabel}
        fallbackRoute="/questions"
        rightAction={
          <Pressable
            onPress={handleShare}
            style={styles.headerShareBtn}
            accessibilityRole="button"
            accessibilityLabel="مشاركة السؤال"
          >
            <Share2 size={16} color="#059669" />
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Main Question Luxury Card */}
        <View style={styles.questionCard}>
          {/* Top Badges Row */}
          <View style={styles.topBadgesRow}>
            {q.is_emergency && (
              <View style={styles.emergencyBadge}>
                <Flame size={12} color="#dc2626" />
                <Text style={styles.emergencyBadgeText}>تنبيه عاجل بالحي 🚨</Text>
              </View>
            )}

            {q.category && (
              <View style={styles.categoryPill}>
                <Text style={styles.categoryPillText}>{q.category}</Text>
              </View>
            )}

            {isSolved ? (
              <View style={styles.solvedBadge}>
                <CheckCircle2 size={12} color="#15803d" />
                <Text style={styles.solvedBadgeText}>تم الحل والاعتماد ✓</Text>
              </View>
            ) : (
              <View style={styles.openBadge}>
                <View style={styles.openDot} />
                <Text style={styles.openBadgeText}>مفتوح للنقاش</Text>
              </View>
            )}
          </View>

          {/* Title */}
          <Text style={styles.qTitle}>{q.title}</Text>

          {/* Body Content */}
          {Boolean(q.body) && (
            <View style={styles.qBodyContainer}>
              <Text style={styles.qBody}>{q.body}</Text>
            </View>
          )}

          {/* Author and Meta Row */}
          <View style={styles.authorSection}>
            <Pressable
              style={styles.authorTouchRow}
              onPress={() => q.author_id && router.push({ pathname: '/user', params: { id: q.author_id } })}
            >
              {q.profiles?.avatar_url ? (
                <Image source={{ uri: q.profiles.avatar_url }} style={styles.authorAvatarImg} />
              ) : (
                <View style={styles.authorAvatarPlaceholder}>
                  <Text style={styles.authorAvatarLetter}>{(authorName[0] || 'ج').toUpperCase()}</Text>
                </View>
              )}
              <View style={styles.authorInfoTexts}>
                <View style={styles.authorNameRow}>
                  <Text style={styles.authorName}>{authorName}</Text>
                  {q.profiles?.is_geoverified && <ShieldCheck size={12} color="#10b981" />}
                </View>
                <View style={styles.metaRow}>
                  <MapPin size={11} color="#059669" />
                  <Text style={styles.metaText}>{locationLabel}</Text>
                  {Boolean(q.created_at) && (
                    <Text style={styles.metaTimeText}>· {relativeTime(q.created_at)}</Text>
                  )}
                  {q.views_count != null && (
                    <Text style={styles.metaTimeText}>· {q.views_count} مشاهدة</Text>
                  )}
                </View>
              </View>
            </Pressable>
          </View>

          {/* Privacy Note */}
          <View style={styles.privacyNote}>
            <Info size={13} color="#059669" />
            <Text style={styles.privacyNoteText}>
              الموقع معروض على مستوى الحي لحماية الخصوصية. يمكنك إرسال موقعك الدقيق بالخاص عند الحاجة.
            </Text>
          </View>
        </View>

        <View style={styles.statsCard}>
          <View style={styles.statsHeadingRow}>
            <View style={styles.statsIconBubble}><Sparkles size={16} color="#0f8a62" /></View>
            <View style={{ flex: 1 }}><Text style={styles.statsTitle}>ملخص الاستفسار</Text><Text style={styles.statsSubtitle}>مؤشرات تفاعل بدون كشف هوية الزوار</Text></View>
            {Boolean(q.is_pinned) && <View style={styles.pinnedPill}><Pin size={12} color="#8a5a0a" /><Text style={styles.pinnedPillText}>مثبّت</Text></View>}
          </View>
          <View style={styles.statsGrid}>
            <View style={styles.statItem}><Eye size={17} color="#64748b" /><Text style={styles.statValue}>{Number(q.views_count ?? q.view_count ?? 0).toLocaleString('ar-SA')}</Text><Text style={styles.statLabel}>مشاهدة</Text></View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}><MessageCircle size={17} color="#0f8a62" /><Text style={styles.statValue}>{answers.length.toLocaleString('ar-SA')}</Text><Text style={styles.statLabel}>ردود الجيران</Text></View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}><Bookmark size={17} color="#7c3aed" /><Text style={styles.statValue}>{isFavorite ? 'نعم' : '—'}</Text><Text style={styles.statLabel}>حفظك</Text></View>
          </View>
          <View style={styles.questionActionRow}>
            <Pressable onPress={toggleFavorite} disabled={favoriteBusy} style={[styles.questionActionBtn, isFavorite && styles.questionActionBtnActive]}>
              {favoriteBusy ? <ActivityIndicator size="small" color="#0f8a62" /> : <Bookmark size={16} color={isFavorite ? '#ffffff' : '#0f8a62'} />}
              <Text style={[styles.questionActionText, isFavorite && styles.questionActionTextActive]}>{isFavorite ? 'محفوظ عندك' : 'حفظ الاستفسار'}</Text>
            </Pressable>
            {!isAuthor && <Pressable onPress={() => { if (!currentUserId) { requireAccount('سجّل الدخول للإبلاغ عن الاستفسار.'); return; } setReportOpen(true); }} style={styles.reportActionBtn}><Flag size={15} color="#b45309" /><Text style={styles.reportActionText}>إبلاغ</Text></Pressable>}
          </View>
        </View>

        {/* Author Management Card: Edit (Limit 2) & Delete */}
        {isAuthor && (
          <View style={styles.authorManageBox}>
            <View style={styles.authorManageHeader}>
              <View style={styles.authorManageInfo}>
                <Text style={styles.authorManageTitle}>إدارة استفسارك</Text>
                <Text style={styles.authorManageSub}>
                  {editsRemaining > 0
                    ? `متبقي لك ${editsRemaining} من ${MAX_EDITS} محاولات تعديل`
                    : 'استنفدت الحد الأقصى للتعديل (محاولتان فقط)'}
                </Text>
              </View>
              <View style={[styles.editLimitBadge, editsRemaining === 0 ? styles.editLimitBadgeExpired : styles.editLimitBadgeActive]}>
                <Text style={[styles.editLimitBadgeText, editsRemaining === 0 ? styles.editLimitBadgeTextExpired : styles.editLimitBadgeTextActive]}>
                  {editsRemaining}/{MAX_EDITS} محاولات
                </Text>
              </View>
            </View>

            <View style={styles.authorActionsRow}>
              <Pressable style={[styles.pinActionBtn, q.is_pinned && styles.pinActionBtnActive]} onPress={togglePin} disabled={pinBusy}>
                {pinBusy ? <ActivityIndicator size="small" color="#8a5a0a" /> : <Pin size={15} color={q.is_pinned ? '#ffffff' : '#8a5a0a'} />}
                <Text style={[styles.pinActionText, q.is_pinned && styles.pinActionTextActive]}>{q.is_pinned ? 'إلغاء التثبيت' : 'تثبيت الاستفسار'}</Text>
              </Pressable>
              <Pressable
                style={[styles.editActionBtn, editsRemaining === 0 && styles.disabledActionBtn]}
                onPress={handleOpenEdit}
                disabled={editsRemaining === 0}
              >
                <Pencil size={15} color={editsRemaining === 0 ? '#94a3b8' : '#047857'} />
                <Text style={[styles.editActionBtnText, editsRemaining === 0 && styles.disabledActionBtnText]}>
                  {editsRemaining === 0 ? 'انتهت محاولات التعديل' : 'تعديل الاستفسار'}
                </Text>
              </Pressable>

              <Pressable
                style={[styles.deleteActionBtn, deletingQuestion && { opacity: 0.6 }]}
                onPress={handleDeleteQuestion}
                disabled={deletingQuestion}
              >
                {deletingQuestion ? (
                  <ActivityIndicator size="small" color="#dc2626" />
                ) : (
                  <>
                    <Trash2 size={15} color="#dc2626" />
                    <Text style={styles.deleteActionBtnText}>حذف الاستفسار</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        )}

        {/* Quick Suggested Responses Pills */}
        {!isSolved && currentUserId && (
          <View style={styles.quickPillsSection}>
            <Text style={styles.quickPillsTitle}>ردود واقتراحات سريعة بنقرة واحدة:</Text>
            <View style={styles.quickPillsWrap}>
              {QUICK_QUESTION_RESPONSES.map((resp, idx) => (
                <Pressable
                  key={idx}
                  style={styles.quickResponsePill}
                  onPress={() => setBody(resp)}
                >
                  <Text style={styles.quickResponseText}>{resp}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

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
          <View style={styles.answerSortRow}>
            <Text style={styles.answerSortLabel}>ترتيب الردود</Text>
            <Pressable onPress={() => setAnswerSort('newest')} style={[styles.answerSortButton, answerSort === 'newest' && styles.answerSortButtonActive]}>
              <Clock size={13} color={answerSort === 'newest' ? '#047857' : '#64748b'} /><Text style={[styles.answerSortButtonText, answerSort === 'newest' && styles.answerSortButtonTextActive]}>الأحدث</Text>
            </Pressable>
            <Pressable onPress={() => setAnswerSort('useful')} style={[styles.answerSortButton, answerSort === 'useful' && styles.answerSortButtonActive]}>
              <ThumbsUp size={13} color={answerSort === 'useful' ? '#047857' : '#64748b'} /><Text style={[styles.answerSortButtonText, answerSort === 'useful' && styles.answerSortButtonTextActive]}>الأكثر فائدة</Text>
            </Pressable>
          </View>

          {answers.length === 0 ? (
            <View style={styles.emptyState}>
              <MessageCircle size={38} color="#94a3b8" />
              <Text style={styles.emptyStateTitle}>لا توجد ردود بعد</Text>
              <Text style={styles.emptyStateText}>شارك بمعلوماتك أو تجربتك لمساعدة أهل حيّك!</Text>
            </View>
          ) : (
            threadedAnswers.map(({ answer: a, depth }) => {
              const isBest = q.best_answer_id === a.id;
              const ansAuthorName = a.profiles?.hide_name
                ? 'مستخدم مجهول'
                : a.profiles?.display_name || a.profiles?.username || 'أحد الجيران';
              const upvotesCount = a.votes?.filter((v: any) => v.vote === 1).length || 0;
              const downvotesCount = a.votes?.filter((v: any) => v.vote === -1).length || 0;
              const myVote = a.votes?.find((v: any) => v.voter_id === currentUserId)?.vote;

              return (
                <View
                  key={a.id}
                  style={[styles.answerCard, depth > 0 && { marginRight: Math.min(depth, 4) * 14, borderRightWidth: 3, borderRightColor: '#a7f3d0' }, isBest && styles.bestAnswerCard]}
                >
                  {isBest && (
                    <View style={styles.bestBanner}>
                      <Award size={15} color="#166534" />
                      <Text style={styles.bestBannerText}>الإجابة المعتمدة من صاحب السؤال ⭐ (+10 نقاط)</Text>
                    </View>
                  )}

                  <View style={styles.answerHeader}>
                    <Pressable
                      style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10, flex: 1 }}
                      onPress={() => a.author_id && router.push({ pathname: '/user', params: { id: a.author_id } })}
                    >
                      <View style={styles.answerAvatarWrap}>
                        {a.profiles?.avatar_url ? (
                          <Image source={{ uri: a.profiles.avatar_url }} style={styles.answerAvatarImg} />
                        ) : (
                          <View style={styles.answerAvatarPlaceholder}>
                            <Text style={styles.answerAvatarLetter}>{(ansAuthorName[0] || 'ح').toUpperCase()}</Text>
                          </View>
                        )}
                      </View>
                      <View style={styles.answerMeta}>
                        <View style={styles.authorNameRow}>
                          <Text style={styles.answerAuthor}>{ansAuthorName}</Text>
                          {a.profiles?.is_geoverified && <ShieldCheck size={11} color="#10b981" />}
                        </View>
                        <Text style={styles.dateTextSmall}>
                          {a.created_at ? relativeTime(a.created_at) : ''}
                        </Text>
                      </View>
                    </Pressable>
                  </View>

                  {a.parent_answer_id && (
                    <View style={styles.replyToPill}>
                      <Reply size={12} color="#059669" />
                      <Text style={styles.replyToText}>رد على: {(answers.find((parent: any) => parent.id === a.parent_answer_id)?.body || 'رد محذوف').slice(0, 70)}</Text>
                    </View>
                  )}

                  <Text style={styles.answerBody}>{a.body}</Text>

                  {/* Actions Row */}
                  <View style={styles.answerActions}>
                    <View style={styles.actionsRightGroup}>
                      <Pressable
                        onPress={() => currentUserId ? setReplyTo(a) : requireAccount('سجّل الدخول للرد على التعليقات.')}
                        style={styles.replyBtn}
                      >
                        <Reply size={13} color="#475569" />
                        <Text style={styles.replyBtnText}>الرد على رد</Text>
                      </Pressable>
                      {currentUserId && a.author_id === currentUserId && <>
                        <Pressable onPress={() => { setEditingAnswer(a); setEditAnswerBody(a.body || ''); }} style={styles.replyBtn}>
                          <Pencil size={13} color="#047857" /><Text style={styles.replyBtnText}>تعديل</Text>
                        </Pressable>
                        <Pressable onPress={() => confirmDeleteAnswer(a)} style={styles.replyBtn} disabled={deletingAnswerId === a.id}>
                          {deletingAnswerId === a.id ? <ActivityIndicator size="small" color="#dc2626" /> : <><Trash2 size={13} color="#dc2626" /><Text style={styles.replyBtnText}>حذف</Text></>}
                        </Pressable>
                      </>}

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
                    {isAuthor && !isSolved && (
                      <Pressable onPress={() => chooseBest(a.id)} style={styles.bestBtn}>
                        <Check size={13} color="#fff" />
                        <Text style={styles.bestBtnText}>اعتماد كأفضل إجابة</Text>
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
                          <MapPin size={12} color="#0f766e" />
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
      </ScrollView>

      {/* Bottom Input Area */}
      {!currentUserId ? (
        <Pressable
          style={[styles.guestPrompt, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 12 : 8) }]}
          onPress={() => requireAccount('سجّل الدخول أو أنشئ حساباً للرد والتصويت في نقاشات الحي.')}
        >
          <Text style={styles.guestPromptText}>سجّل الدخول للمشاركة في النقاش</Text>
          <MessageCircle size={18} color="#047857" />
        </Pressable>
      ) : (
        <View style={[styles.inputWrapper, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 12 : 8) }]}>
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

          {isSolved ? (
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
                placeholderTextColor="#94a3b8"
                maxLength={500}
                onFocus={() => notifyComposerFocus(true)}
                onBlur={() => notifyComposerFocus(false)}
              />
              <Pressable
                style={({ pressed }) => [
                  styles.sendButton,
                  !body.trim() && styles.sendButtonDisabled,
                  pressed && { transform: [{ scale: 0.95 }] },
                ]}
                onPress={answer}
                disabled={!body.trim() || submitting || isSolved}
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

      <Modal visible={reportOpen} transparent animationType="slide" onRequestClose={() => setReportOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.reportModalCard}>
            <View style={styles.modalHeader}>
              <View><Text style={styles.modalTitle}>الإبلاغ عن الاستفسار</Text><Text style={styles.modalSubtitle}>اختر السبب وسنراجع البلاغ بسرية</Text></View>
              <Pressable style={styles.modalCloseBtn} onPress={() => setReportOpen(false)} disabled={reportBusy}><X size={18} color="#64748b" /></Pressable>
            </View>
            <View style={styles.reportOptions}>
              {['محتوى غير مناسب', 'معلومة مضللة', 'إساءة أو تنمّر', 'احتيال أو إعلان مزعج', 'انتهاك الخصوصية', 'سبب آخر'].map(reason => {
                const selected = reportReason === reason;
                return <Pressable key={reason} onPress={() => setReportReason(reason)} style={[styles.reportOption, selected && styles.reportOptionSelected]}>
                  <View style={[styles.reportRadio, selected && styles.reportRadioSelected]} />
                  <Text style={[styles.reportOptionText, selected && styles.reportOptionTextSelected]}>{reason}</Text>
                </Pressable>;
              })}
            </View>
            <TextInput style={styles.reportDetailsInput} value={reportDetails} onChangeText={setReportDetails} placeholder="تفاصيل إضافية (اختياري)" placeholderTextColor="#94a3b8" multiline maxLength={350} textAlign="right" />
            <View style={styles.modalFooter}>
              <Pressable style={styles.modalCancelBtn} onPress={() => setReportOpen(false)} disabled={reportBusy}><Text style={styles.modalCancelBtnText}>إلغاء</Text></Pressable>
              <Pressable style={[styles.modalSubmitBtn, reportBusy && styles.modalSubmitBtnDisabled]} onPress={submitReport} disabled={reportBusy}>{reportBusy ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalSubmitBtnText}>إرسال البلاغ</Text>}</Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(editingAnswer)} transparent animationType="slide" onRequestClose={() => !savingAnswerEdit && setEditingAnswer(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}><View><Text style={styles.modalTitle}>تعديل الرد</Text><Text style={styles.modalSubtitle}>يمكنك تعديل ردك أنت فقط</Text></View><Pressable style={styles.modalCloseBtn} onPress={() => setEditingAnswer(null)} disabled={savingAnswerEdit}><X size={18} color="#64748b" /></Pressable></View>
            <TextInput style={[styles.modalInput, styles.modalTextArea]} value={editAnswerBody} onChangeText={setEditAnswerBody} placeholder="اكتب الرد بعد التعديل..." placeholderTextColor="#94a3b8" textAlign="right" multiline maxLength={500} />
            <View style={styles.modalFooter}><Pressable style={styles.modalCancelBtn} onPress={() => setEditingAnswer(null)} disabled={savingAnswerEdit}><Text style={styles.modalCancelBtnText}>إلغاء</Text></Pressable><Pressable style={[styles.modalSubmitBtn, (!editAnswerBody.trim() || savingAnswerEdit) && styles.modalSubmitBtnDisabled]} onPress={saveAnswerEdit} disabled={!editAnswerBody.trim() || savingAnswerEdit}>{savingAnswerEdit ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalSubmitBtnText}>حفظ الرد</Text>}</Pressable></View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Modal for Editing Question */}
      <Modal
        visible={isEditModalOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsEditModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>تعديل الاستفسار</Text>
                <Text style={styles.modalSubtitle}>
                  محاولة {editCount + 1} من {MAX_EDITS} (متبقي بعدها {Math.max(0, MAX_EDITS - (editCount + 1))})
                </Text>
              </View>
              <Pressable
                style={styles.modalCloseBtn}
                onPress={() => setIsEditModalOpen(false)}
                disabled={savingEdit}
              >
                <X size={18} color="#64748b" />
              </Pressable>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.modalInputLabel}>عنوان الاستفسار</Text>
              <TextInput
                style={styles.modalInput}
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="عنوان واضح ومختصر للاستفسار..."
                placeholderTextColor="#94a3b8"
                textAlign="right"
                maxLength={100}
              />

              <Text style={styles.modalInputLabel}>تفاصيل الاستفسار</Text>
              <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
                value={editContent}
                onChangeText={setEditContent}
                placeholder="تفاصيل إضافية إن وجدت..."
                placeholderTextColor="#94a3b8"
                textAlign="right"
                multiline
                numberOfLines={4}
                maxLength={500}
              />

              <View style={styles.editWarningBox}>
                <Info size={14} color="#d97706" />
                <Text style={styles.editWarningText}>
                  تنبيه: يُسمح بتعديل السؤال مرتين كحد أقصى حفاظاً على ترابط الردود وسياقها في الحي.
                </Text>
              </View>
            </View>

            <View style={styles.modalFooter}>
              <Pressable
                style={[styles.modalCancelBtn, savingEdit && { opacity: 0.6 }]}
                onPress={() => setIsEditModalOpen(false)}
                disabled={savingEdit}
              >
                <Text style={styles.modalCancelBtnText}>إلغاء</Text>
              </Pressable>

              <Pressable
                style={[styles.modalSubmitBtn, (!editTitle.trim() || savingEdit) && styles.modalSubmitBtnDisabled]}
                onPress={handleSaveEdit}
                disabled={!editTitle.trim() || savingEdit}
              >
                {savingEdit ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>حفظ التعديلات</Text>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f4f8f6',
  },
  headerShareBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#f8fafc',
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
    fontSize: 16,
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
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  questionCard: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 24,
    padding: 17,
    borderWidth: 1,
    borderColor: '#e1eee7',
    shadowColor: '#164e3b',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
    gap: 13,
  },
  statsCard: { backgroundColor: '#ffffff', borderRadius: 22, padding: 15, borderWidth: 1, borderColor: '#e2eee7', gap: 14, shadowColor: '#164e3b', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.035, shadowRadius: 10, elevation: 2 },
  statsHeadingRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  statsIconBubble: { width: 36, height: 36, borderRadius: 13, backgroundColor: '#e9f8f0', alignItems: 'center', justifyContent: 'center' },
  statsTitle: { textAlign: 'right', color: '#15382b', fontSize: 14, fontWeight: '900' },
  statsSubtitle: { textAlign: 'right', color: '#82928a', fontSize: 10.5, marginTop: 2 },
  pinnedPill: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, backgroundColor: '#fff7df', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5 },
  pinnedPillText: { color: '#8a5a0a', fontSize: 10, fontWeight: '900' },
  statsGrid: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#f7faf8', borderRadius: 16, paddingVertical: 13, paddingHorizontal: 5 },
  statItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  statValue: { color: '#18372c', fontSize: 17, fontWeight: '900', fontVariant: ['tabular-nums'] },
  statLabel: { color: '#82928a', fontSize: 10.5, fontWeight: '700' },
  statDivider: { width: 1, height: 34, backgroundColor: '#e1eae5' },
  questionActionRow: { flexDirection: 'row-reverse', gap: 8 },
  questionActionBtn: { flex: 1, minHeight: 43, borderRadius: 14, borderWidth: 1, borderColor: '#b8e6d0', backgroundColor: '#f2fbf6', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 7 },
  questionActionBtnActive: { backgroundColor: '#0f8a62', borderColor: '#0f8a62' },
  questionActionText: { color: '#0f8a62', fontSize: 12, fontWeight: '900' },
  questionActionTextActive: { color: '#ffffff' },
  reportActionBtn: { minWidth: 84, minHeight: 43, borderRadius: 14, borderWidth: 1, borderColor: '#f3d9ad', backgroundColor: '#fffbeb', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12 },
  reportActionText: { color: '#a16207', fontSize: 12, fontWeight: '900' },
  pinActionBtn: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 40, paddingHorizontal: 11, borderRadius: 13, borderWidth: 1, borderColor: '#f0d8a4', backgroundColor: '#fffbeb' },
  pinActionBtnActive: { backgroundColor: '#9a6700', borderColor: '#9a6700' },
  pinActionText: { color: '#8a5a0a', fontSize: 11, fontWeight: '900' },
  pinActionTextActive: { color: '#ffffff' },
  reportModalCard: { width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: '#ffffff', borderTopLeftRadius: 26, borderTopRightRadius: 26, borderRadius: 26, padding: 20, gap: 14 },
  reportOptions: { gap: 7 },
  reportOption: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, borderRadius: 13, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#f8fafc', paddingHorizontal: 12, paddingVertical: 11 },
  reportOptionSelected: { borderColor: '#16a36d', backgroundColor: '#effaf4' },
  reportRadio: { width: 15, height: 15, borderRadius: 8, borderWidth: 1.5, borderColor: '#94a3b8' },
  reportRadioSelected: { borderColor: '#0f8a62', backgroundColor: '#0f8a62' },
  reportOptionText: { flex: 1, textAlign: 'right', color: '#475569', fontSize: 12, fontWeight: '700' },
  reportOptionTextSelected: { color: '#166534', fontWeight: '900' },
  reportDetailsInput: { minHeight: 72, maxHeight: 120, textAlignVertical: 'top', borderRadius: 14, borderWidth: 1, borderColor: '#dbe5df', backgroundColor: '#f8fafc', padding: 12, color: '#1e293b', fontSize: 13 },
  topBadgesRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  emergencyBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fee2e2',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  emergencyBadgeText: {
    color: '#dc2626',
    fontSize: 11,
    fontWeight: '900',
  },
  categoryPill: {
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  categoryPillText: {
    color: '#2563eb',
    fontSize: 11.5,
    fontWeight: '800',
  },
  openBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
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
    fontWeight: '800',
  },
  solvedBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  solvedBadgeText: {
    color: '#15803d',
    fontSize: 11,
    fontWeight: '800',
  },
  qTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'right',
    lineHeight: 26,
  },
  qBodyContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  qBody: {
    fontSize: 14,
    lineHeight: 22,
    color: '#334155',
    textAlign: 'right',
  },
  authorSection: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  authorTouchRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
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
    color: '#059669',
    fontSize: 18,
    fontWeight: '900',
  },
  authorInfoTexts: {
    flex: 1,
    alignItems: 'flex-end',
  },
  authorNameRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
  },
  authorName: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
  },
  metaRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  metaText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
  },
  metaTimeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
  },
  privacyNote: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0fdf4',
    padding: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  privacyNoteText: {
    flex: 1,
    fontSize: 11,
    color: '#15803d',
    fontWeight: '700',
    textAlign: 'right',
    lineHeight: 16,
  },
  quickPillsSection: {
    gap: 8,
  },
  quickPillsTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#475569',
    textAlign: 'right',
  },
  quickPillsWrap: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
  },
  quickResponsePill: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  quickResponseText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  answerSortRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  answerSortLabel: { color: '#64748b', fontSize: 12, fontWeight: '800', marginLeft: 'auto' },
  answerSortButton: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 },
  answerSortButtonActive: { borderColor: '#6ee7b7', backgroundColor: '#ecfdf5' },
  answerSortButtonText: { color: '#64748b', fontSize: 11, fontWeight: '800' },
  answerSortButtonTextActive: { color: '#047857' },
  answersSection: {
    gap: 10,
  },
  answersHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  answersHeaderLeft: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  answersCountBadge: {
    backgroundColor: '#ecfdf5',
    color: '#047857',
    fontSize: 11.5,
    fontWeight: '900',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  answersTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0f172a',
  },
  answersSubtitle: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
  },
  emptyState: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 6,
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 4,
  },
  emptyStateText: {
    fontSize: 12.5,
    color: '#64748b',
    fontWeight: '600',
    textAlign: 'center',
  },
  answerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 10,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  bestAnswerCard: {
    borderColor: '#86efac',
    backgroundColor: '#f0fdf4',
  },
  bestBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  bestBannerText: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#166534',
  },
  answerHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  answerAvatarWrap: {
    position: 'relative',
  },
  answerAvatarImg: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  answerAvatarPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#a7f3d0',
  },
  answerAvatarLetter: {
    fontSize: 15,
    fontWeight: '900',
    color: '#059669',
  },
  answerMeta: {
    alignItems: 'flex-end',
    flex: 1,
  },
  answerAuthor: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#0f172a',
  },
  dateTextSmall: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
    marginTop: 1,
  },
  replyToPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: 'flex-end',
  },
  replyToText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '700',
  },
  answerBody: {
    fontSize: 13.5,
    lineHeight: 22,
    color: '#334155',
    textAlign: 'right',
  },
  answerActions: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
    gap: 8,
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
    backgroundColor: '#f8fafc',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  replyBtnText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#475569',
  },
  voteBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f8fafc',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  voteActive: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  voteDownActive: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  voteText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#64748b',
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
    borderRadius: 8,
  },
  bestBtnText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#ffffff',
  },
  shareLocationBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f0fdfa',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#99f6e4',
  },
  shareLocationBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0f766e',
  },
  guestPrompt: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#ecfdf5',
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#a7f3d0',
  },
  guestPromptText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#047857',
  },
  inputWrapper: {
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderTopWidth: 1,
    borderTopColor: '#dcebe3',
    paddingHorizontal: 14,
    paddingTop: 10,
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 8,
  },
  replyingBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    marginBottom: 8,
  },
  replyingText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#059669',
    flex: 1,
    textAlign: 'right',
    marginRight: 6,
  },
  cancelReply: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ef4444',
  },
  closedNotice: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#f1f5f9',
    paddingVertical: 12,
    borderRadius: 14,
  },
  closedNoticeText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#64748b',
  },
  inputContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#f5f9f7',
    borderRadius: 17,
    paddingHorizontal: 15,
    paddingVertical: 11,
    fontSize: 16,
    color: '#0f172a',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    textAlign: 'right',
    maxHeight: 90,
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#16865b',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  sendButtonDisabled: {
    backgroundColor: '#94a3b8',
    opacity: 0.6,
  },
  authorManageBox: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    gap: 12,
  },
  authorManageHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  authorManageInfo: {
    alignItems: 'flex-end',
  },
  authorManageTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
  },
  authorManageSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  editLimitBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  editLimitBadgeActive: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  editLimitBadgeExpired: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
  editLimitBadgeText: {
    fontSize: 11,
    fontWeight: '900',
  },
  editLimitBadgeTextActive: {
    color: '#047857',
  },
  editLimitBadgeTextExpired: {
    color: '#b91c1c',
  },
  authorActionsRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
  },
  editActionBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ecfdf5',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  editActionBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#047857',
  },
  disabledActionBtn: {
    backgroundColor: '#f1f5f9',
    borderColor: '#e2e8f0',
  },
  disabledActionBtnText: {
    color: '#94a3b8',
  },
  deleteActionBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#fef2f2',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  deleteActionBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#dc2626',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 16,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'right',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#047857',
    fontWeight: '700',
    textAlign: 'right',
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    gap: 10,
  },
  modalInputLabel: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#334155',
    textAlign: 'right',
  },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0f172a',
    textAlign: 'right',
  },
  modalTextArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  editWarningBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fffbeb',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  editWarningText: {
    fontSize: 11.5,
    color: '#92400e',
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
    lineHeight: 17,
  },
  modalFooter: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    paddingTop: 8,
  },
  modalSubmitBtn: {
    flex: 2,
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitBtnDisabled: {
    backgroundColor: '#94a3b8',
    opacity: 0.6,
  },
  modalSubmitBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '900',
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelBtnText: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '800',
  },
});
