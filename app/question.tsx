import { PROFILE_READ_FIELDS } from '@/lib/profileFields';
import { OasisPressable as Pressable, OasisTextInput as TextInput, OasisSurface } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import { HeaderAction } from '@/components/shared/AppHeader';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View, KeyboardAvoidingView, Keyboard, Platform, ActivityIndicator, Share, Image, ImageBackground, Modal } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import TwitterInquiryCard from '@/components/TwitterInquiryCard';
import { useDynamicIsland } from '@/context/DynamicIslandContext';
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
  const { showIsland } = useDynamicIsland();
  const [viewerProfile, setViewerProfile] = useState<any>(null);
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
    const viewer = user ? await supabase.from('profiles').select(PROFILE_READ_FIELDS).eq('id', user.id).maybeSingle() : { data: null };
    setViewerProfile(viewer.data);
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
      const userIds = [question.author_id, ...(b.data || []).map((ans: any) => ans.author_id)];
      const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));

      const { data: profilesData } = await supabase.from('profiles').select(PROFILE_READ_FIELDS).in('id', uniqueIds);
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
      <View style={[styles.loadingContainer, { backgroundColor: 'transparent' }]}>
        <ActivityIndicator size="large" color={OASIS.colors.primary} />
        <Text style={styles.loadingText}>جاري تحميل تفاصيل الاستفسار...</Text>
      </View>
    );
  }

  if (!q) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: 'transparent' }]}>
        <Text style={styles.errorText}>السؤال غير موجود أو تم حذفه</Text>
        <Pressable oasisKind="action" style={styles.backButton} onPress={() => router.back()}>
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
        .update({ body: editAnswerBody.trim() })
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
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0} style={[styles.container, { backgroundColor: 'transparent' }]}>
      <AppHeader
        variant="sub"
        title="استفسار ونقاش الحي"
        subtitle={locationLabel}
        fallbackRoute="/questions"
        rightAction={
          <HeaderAction
            onPress={handleShare}
            style={styles.headerShareBtn}
            accessibilityRole="button"
            accessibilityLabel="مشاركة السؤال"
          >
            <Share2 size={16} color={OASIS.colors.primary} />
          </HeaderAction>
        }
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 16 }]}
        showsVerticalScrollIndicator={false}
      >
        <TwitterInquiryCard detailMode type="question" data={{ ...q, answers, answers_count: answers.length }} currentUserId={currentUserId} currentUserProfile={viewerProfile} isGuest={!currentUserId} onQuickReply={async () => {}} onToast={message => showIsland(message, undefined, 'success')} onDeleted={() => void load(false)} />

        {/* Quick Suggested Responses Pills */}
        {!isSolved && currentUserId && (
          <View style={styles.quickPillsSection}>
            <Text style={styles.quickPillsTitle}>ردود واقتراحات سريعة بنقرة واحدة:</Text>
            <View style={styles.quickPillsWrap}>
              {QUICK_QUESTION_RESPONSES.map((resp, idx) => (
                <Pressable oasisKind="chip"
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
            <Pressable oasisKind="chip" onPress={() => setAnswerSort('newest')} style={[styles.answerSortButton, answerSort === 'newest' && styles.answerSortButtonActive]}>
              <Clock size={13} color={answerSort === 'newest' ? OASIS.colors.primary : OASIS.colors.muted} /><Text style={[styles.answerSortButtonText, answerSort === 'newest' && styles.answerSortButtonTextActive]}>الأحدث</Text>
            </Pressable>
            <Pressable oasisKind="chip" onPress={() => setAnswerSort('useful')} style={[styles.answerSortButton, answerSort === 'useful' && styles.answerSortButtonActive]}>
              <ThumbsUp size={13} color={answerSort === 'useful' ? OASIS.colors.primary : OASIS.colors.muted} /><Text style={[styles.answerSortButtonText, answerSort === 'useful' && styles.answerSortButtonTextActive]}>الأكثر فائدة</Text>
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
                <OasisSurface oasisSurface="card"
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

                        </View>
                        <Text style={styles.dateTextSmall}>
                          {a.created_at ? relativeTime(a.created_at) : ''}
                        </Text>
                      </View>
                    </Pressable>
                  </View>

                  {a.parent_answer_id && (
                    <View style={styles.replyToPill}>
                      <Reply size={12} color={OASIS.colors.primary} />
                      <Text style={styles.replyToText}>رد على: {(answers.find((parent: any) => parent.id === a.parent_answer_id)?.body || 'رد محذوف').slice(0, 70)}</Text>
                    </View>
                  )}

                  <Text style={styles.answerBody}>{a.body}</Text>

                  {/* Actions Row */}
                  <View style={styles.answerActions}>
                    <View style={styles.actionsRightGroup}>
                      <Pressable oasisKind="chip"
                        onPress={() => currentUserId ? setReplyTo(a) : requireAccount('سجّل الدخول للرد على التعليقات.')}
                        style={styles.replyBtn}
                      >
                        <Reply size={13} color={OASIS.colors.muted} />
                        <Text style={styles.replyBtnText}>الرد على رد</Text>
                      </Pressable>
                      {currentUserId && a.author_id === currentUserId && <>
                        <Pressable oasisKind="chip" onPress={() => { setEditingAnswer(a); setEditAnswerBody(a.body || ''); }} style={styles.replyBtn}>
                          <Pencil size={13} color={OASIS.colors.primary} /><Text style={styles.replyBtnText}>تعديل</Text>
                        </Pressable>
                        <Pressable oasisKind="chip" onPress={() => confirmDeleteAnswer(a)} style={styles.replyBtn} disabled={deletingAnswerId === a.id}>
                          {deletingAnswerId === a.id ? <ActivityIndicator size="small" color={OASIS.colors.danger} /> : <><Trash2 size={13} color={OASIS.colors.danger} /><Text style={styles.replyBtnText}>حذف</Text></>}
                        </Pressable>
                      </>}

                      <Pressable oasisKind="action"
                        onPress={() => voteAnswer(a.id, 1)}
                        style={[styles.voteBtn, myVote === 1 && styles.voteActive]}
                      >
                        <ThumbsUp size={14} color={myVote === 1 ? OASIS.colors.primary : OASIS.colors.muted} />
                        <Text style={[styles.voteText, myVote === 1 && styles.voteTextActive]}>
                          {upvotesCount}
                        </Text>
                      </Pressable>

                      <Pressable oasisKind="action"
                        onPress={() => voteAnswer(a.id, -1)}
                        style={[styles.voteBtn, myVote === -1 && styles.voteDownActive]}
                      >
                        <ThumbsDown size={14} color={myVote === -1 ? OASIS.colors.danger : OASIS.colors.muted} />
                        <Text style={[styles.voteText, myVote === -1 && styles.voteTextDownActive]}>
                          {downvotesCount}
                        </Text>
                      </Pressable>
                    </View>

                    {/* Best Answer Button for question owner */}
                    {isAuthor && !isSolved && (
                      <Pressable oasisKind="action" onPress={() => chooseBest(a.id)} style={styles.bestBtn}>
                        <Check size={13} color={OASIS.colors.surface} />
                        <Text style={styles.bestBtnText}>اعتماد كأفضل إجابة</Text>
                      </Pressable>
                    )}

                    {/* Share location privately with neighbor */}
                    {currentUserId && a.author_id && a.author_id !== currentUserId && (
                      <Pressable oasisKind="chip"
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
                </OasisSurface>
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
          <MessageCircle size={18} color={OASIS.colors.primary} />
        </Pressable>
      ) : (
        <OasisSurface oasisSurface="field" style={[styles.inputWrapper, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 12 : 8) }]}>
          {replyTo && (
            <View style={styles.replyingBar}>
              <Reply size={14} color={OASIS.colors.primary} />
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
              <Lock size={15} color={OASIS.colors.muted} />
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
              <Pressable oasisVariant="primary" oasisKind="action"
                style={({ pressed }) => [
                  styles.sendButton,
                  !body.trim() && styles.sendButtonDisabled,
                  pressed && { transform: [{ scale: 0.95 }] },
                ]}
                onPress={answer}
                disabled={!body.trim() || submitting || isSolved}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color={OASIS.colors.surface} />
                ) : (
                  <Send size={18} color={OASIS.colors.surface} />
                )}
              </Pressable>
            </View>
          )}
        </OasisSurface>
      )}

      <Modal visible={reportOpen} transparent animationType="slide" onRequestClose={() => setReportOpen(false)}>
        <View style={styles.modalOverlay}>
          <OasisSurface oasisSurface="card" style={styles.reportModalCard}>
            <View style={styles.modalHeader}>
              <View><Text style={styles.modalTitle}>الإبلاغ عن الاستفسار</Text><Text style={styles.modalSubtitle}>اختر السبب وسنراجع البلاغ بسرية</Text></View>
              <Pressable oasisKind="icon" style={styles.modalCloseBtn} onPress={() => setReportOpen(false)} disabled={reportBusy}><X size={18} color={OASIS.colors.muted} /></Pressable>
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
              <Pressable oasisKind="action" style={styles.modalCancelBtn} onPress={() => setReportOpen(false)} disabled={reportBusy}><Text style={styles.modalCancelBtnText}>إلغاء</Text></Pressable>
              <Pressable oasisVariant="primary" oasisKind="action" style={[styles.modalSubmitBtn, reportBusy && styles.modalSubmitBtnDisabled]} onPress={submitReport} disabled={reportBusy}>{reportBusy ? <ActivityIndicator size="small" color={OASIS.colors.surface} /> : <Text style={styles.modalSubmitBtnText}>إرسال البلاغ</Text>}</Pressable>
            </View>
          </OasisSurface>
        </View>
      </Modal>

      <Modal visible={Boolean(editingAnswer)} transparent animationType="slide" onRequestClose={() => !savingAnswerEdit && setEditingAnswer(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <OasisSurface oasisSurface="sheet" style={styles.modalCard}>
            <View style={styles.modalHeader}><View><Text style={styles.modalTitle}>تعديل الرد</Text><Text style={styles.modalSubtitle}>يمكنك تعديل ردك أنت فقط</Text></View><Pressable oasisKind="icon" style={styles.modalCloseBtn} onPress={() => setEditingAnswer(null)} disabled={savingAnswerEdit}><X size={18} color={OASIS.colors.muted} /></Pressable></View>
            <TextInput style={[styles.modalInput, styles.modalTextArea]} value={editAnswerBody} onChangeText={setEditAnswerBody} placeholder="اكتب الرد بعد التعديل..." placeholderTextColor="#94a3b8" textAlign="right" multiline maxLength={500} />
            <View style={styles.modalFooter}><Pressable oasisKind="action" style={styles.modalCancelBtn} onPress={() => setEditingAnswer(null)} disabled={savingAnswerEdit}><Text style={styles.modalCancelBtnText}>إلغاء</Text></Pressable><Pressable oasisVariant="primary" oasisKind="action" style={[styles.modalSubmitBtn, (!editAnswerBody.trim() || savingAnswerEdit) && styles.modalSubmitBtnDisabled]} onPress={saveAnswerEdit} disabled={!editAnswerBody.trim() || savingAnswerEdit}>{savingAnswerEdit ? <ActivityIndicator size="small" color={OASIS.colors.surface} /> : <Text style={styles.modalSubmitBtnText}>حفظ الرد</Text>}</Pressable></View>
          </OasisSurface>
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
          <OasisSurface oasisSurface="sheet" style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>تعديل الاستفسار</Text>
                <Text style={styles.modalSubtitle}>
                  محاولة {editCount + 1} من {MAX_EDITS} (متبقي بعدها {Math.max(0, MAX_EDITS - (editCount + 1))})
                </Text>
              </View>
              <Pressable oasisKind="icon"
                style={styles.modalCloseBtn}
                onPress={() => setIsEditModalOpen(false)}
                disabled={savingEdit}
              >
                <X size={18} color={OASIS.colors.muted} />
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
              <Pressable oasisKind="action"
                style={[styles.modalCancelBtn, savingEdit && { opacity: 0.6 }]}
                onPress={() => setIsEditModalOpen(false)}
                disabled={savingEdit}
              >
                <Text style={styles.modalCancelBtnText}>إلغاء</Text>
              </Pressable>

              <Pressable oasisVariant="primary" oasisKind="action"
                style={[styles.modalSubmitBtn, (!editTitle.trim() || savingEdit) && styles.modalSubmitBtnDisabled]}
                onPress={handleSaveEdit}
                disabled={!editTitle.trim() || savingEdit}
              >
                {savingEdit ? (
                  <ActivityIndicator size="small" color={OASIS.colors.surface} />
                ) : (
                  <Text style={styles.modalSubmitBtnText}>حفظ التعديلات</Text>
                )}
              </Pressable>
            </View>
          </OasisSurface>
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
    borderRadius: 14,
    backgroundColor: OASIS.colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#f5f7f6',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  loadingText: {
    color: OASIS.colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 16,
    color: OASIS.colors.muted,
    marginBottom: 16,
    fontWeight: '600',
  },
  backButton: {
    backgroundColor: OASIS.colors.primary,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 16,
  },
  backButtonText: {
    color: OASIS.colors.surface,
    fontWeight: '700',
    fontSize: 14,
  },
  scroll: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 12,
  },
  questionCard: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 14,
    padding: 17,
    borderWidth: 1,
    borderColor: '#e1eee7',
    shadowColor: '#164e3b',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0,
    shadowRadius: 14,
    elevation: 3,
    gap: 13,
  },
  statsCard: { backgroundColor: OASIS.colors.surface, borderRadius: 14, padding: 15, borderWidth: 1, borderColor: '#e2eee7', gap: 14, shadowColor: '#164e3b', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0, shadowRadius: 10, elevation: 2 },
  statsHeadingRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  statsIconBubble: { width: 36, height: 36, borderRadius: 13, backgroundColor: '#e9f8f0', alignItems: 'center', justifyContent: 'center' },
  statsTitle: { textAlign: 'right', color: '#15382b', fontSize: 14, fontWeight: '700' },
  statsSubtitle: { textAlign: 'right', color: '#82928a', fontSize: 11, marginTop: 2 },
  pinnedPill: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, backgroundColor: '#fff7df', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5 },
  pinnedPillText: { color: '#8a5a0a', fontSize: 11, fontWeight: '700' },
  statsGrid: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#f7faf8', borderRadius: 16, paddingVertical: 13, paddingHorizontal: 5 },
  statItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  statValue: { color: '#18372c', fontSize: 17, fontWeight: '700', fontVariant: ['tabular-nums'] },
  statLabel: { color: '#82928a', fontSize: 11, fontWeight: '700' },
  statDivider: { width: 1, height: 34, backgroundColor: '#e1eae5' },
  questionActionRow: { flexDirection: 'row-reverse', gap: 8 },
  questionActionBtn: { flex: 1, minHeight: 43, borderRadius: 14, borderWidth: 1, borderColor: '#b8e6d0', backgroundColor: '#f2fbf6', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 7 },
  questionActionBtnActive: { backgroundColor: '#0f8a62', borderColor: '#0f8a62' },
  questionActionText: { color: '#0f8a62', fontSize: 12, fontWeight: '700' },
  questionActionTextActive: { color: OASIS.colors.surface },
  reportActionBtn: { minWidth: 84, minHeight: 43, borderRadius: 14, borderWidth: 1, borderColor: '#f3d9ad', backgroundColor: OASIS.colors.warningSoft, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12 },
  reportActionText: { color: '#a16207', fontSize: 12, fontWeight: '700' },
  pinActionBtn: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 40, paddingHorizontal: 11, borderRadius: 13, borderWidth: 1, borderColor: '#f0d8a4', backgroundColor: OASIS.colors.warningSoft },
  pinActionBtnActive: { backgroundColor: '#9a6700', borderColor: '#9a6700' },
  pinActionText: { color: '#8a5a0a', fontSize: 11, fontWeight: '700' },
  pinActionTextActive: { color: OASIS.colors.surface },
  reportModalCard: { width: '100%', maxWidth: 480, alignSelf: 'center', backgroundColor: OASIS.colors.surface, borderTopLeftRadius: 26, borderTopRightRadius: 26, borderRadius: 14, padding: 14, gap: 14 },
  reportOptions: { gap: 7 },
  reportOption: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, borderRadius: 13, borderWidth: 1, borderColor: OASIS.colors.line, backgroundColor: '#f5f7f6', paddingHorizontal: 12, paddingVertical: 11 },
  reportOptionSelected: { borderColor: '#16a36d', backgroundColor: '#effaf4' },
  reportRadio: { width: 15, height: 15, borderRadius: 8, borderWidth: 1.5, borderColor: '#94a3b8' },
  reportRadioSelected: { borderColor: '#0f8a62', backgroundColor: '#0f8a62' },
  reportOptionText: { flex: 1, textAlign: 'right', color: OASIS.colors.muted, fontSize: 12, fontWeight: '700' },
  reportOptionTextSelected: { color: '#166534', fontWeight: '700' },
  reportDetailsInput: { minHeight: 44, maxHeight: 120, textAlignVertical: 'top', borderRadius: 14, borderWidth: 1, borderColor: '#dbe5df', backgroundColor: '#f5f7f6', padding: 12, color: OASIS.colors.ink, fontSize: 13 },
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
    color: OASIS.colors.danger,
    fontSize: 11,
    fontWeight: '700',
  },
  categoryPill: {
    backgroundColor: OASIS.colors.infoSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  categoryPillText: {
    color: '#2563eb',
    fontSize: 11.5,
    fontWeight: '600',
  },
  openBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: OASIS.colors.soft,
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
    backgroundColor: OASIS.colors.primary,
  },
  openBadgeText: {
    color: OASIS.colors.primary,
    fontSize: 11,
    fontWeight: '600',
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
    fontWeight: '600',
  },
  qTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: OASIS.colors.ink,
    textAlign: 'right',
    lineHeight: 26,
  },
  qBodyContainer: {
    backgroundColor: '#f5f7f6',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: OASIS.colors.line,
  },
  qBody: {
    fontSize: 14,
    lineHeight: 22,
    color: OASIS.colors.ink,
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
    borderColor: OASIS.colors.line,
  },
  authorAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: OASIS.colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#a7f3d0',
  },
  authorAvatarLetter: {
    color: OASIS.colors.primary,
    fontSize: 18,
    fontWeight: '700',
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
    fontWeight: '700',
    color: OASIS.colors.ink,
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
    color: OASIS.colors.muted,
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
    backgroundColor: OASIS.colors.soft,
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
    fontWeight: '600',
    color: OASIS.colors.muted,
    textAlign: 'right',
  },
  quickPillsWrap: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
  },
  quickResponsePill: {
    backgroundColor: OASIS.colors.surface,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: OASIS.colors.line,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0,
    shadowRadius: 2,
    elevation: 1,
  },
  quickResponseText: {
    fontSize: 12,
    fontWeight: '700',
    color: OASIS.colors.ink,
  },
  answerSortRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' },
  answerSortLabel: { color: OASIS.colors.muted, fontSize: 12, fontWeight: '600', marginLeft: 'auto' },
  answerSortButton: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: OASIS.colors.line, backgroundColor: OASIS.colors.surface, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 },
  answerSortButtonActive: { borderColor: '#6ee7b7', backgroundColor: OASIS.colors.soft },
  answerSortButtonText: { color: OASIS.colors.muted, fontSize: 11, fontWeight: '600' },
  answerSortButtonTextActive: { color: OASIS.colors.primary },
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
    backgroundColor: OASIS.colors.soft,
    color: OASIS.colors.primary,
    fontSize: 11.5,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  answersTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: OASIS.colors.ink,
  },
  answersSubtitle: {
    fontSize: 12,
    color: OASIS.colors.muted,
    fontWeight: '600',
  },
  emptyState: {
    backgroundColor: OASIS.colors.surface,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: OASIS.colors.line,
    gap: 6,
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: OASIS.colors.ink,
    marginTop: 4,
  },
  emptyStateText: {
    fontSize: 12.5,
    color: OASIS.colors.muted,
    fontWeight: '600',
    textAlign: 'center',
  },
  answerCard: {
    backgroundColor: OASIS.colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: OASIS.colors.line,
    gap: 10,
    shadowColor: OASIS.colors.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0,
    shadowRadius: 4,
    elevation: 1,
  },
  bestAnswerCard: {
    borderColor: '#86efac',
    backgroundColor: OASIS.colors.soft,
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
    fontWeight: '700',
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
    borderColor: OASIS.colors.line,
  },
  answerAvatarPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: OASIS.colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#a7f3d0',
  },
  answerAvatarLetter: {
    fontSize: 15,
    fontWeight: '700',
    color: OASIS.colors.primary,
  },
  answerMeta: {
    alignItems: 'flex-end',
    flex: 1,
  },
  answerAuthor: {
    fontSize: 13.5,
    fontWeight: '700',
    color: OASIS.colors.ink,
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
    color: OASIS.colors.muted,
    fontWeight: '700',
  },
  answerBody: {
    fontSize: 13.5,
    lineHeight: 22,
    color: OASIS.colors.ink,
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
    backgroundColor: '#f5f7f6',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: OASIS.colors.line,
  },
  replyBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: OASIS.colors.muted,
  },
  voteBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f5f7f6',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: OASIS.colors.line,
  },
  voteActive: {
    backgroundColor: OASIS.colors.soft,
    borderColor: '#a7f3d0',
  },
  voteDownActive: {
    backgroundColor: OASIS.colors.dangerSoft,
    borderColor: '#fecaca',
  },
  voteText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: OASIS.colors.muted,
  },
  voteTextActive: {
    color: OASIS.colors.primary,
  },
  voteTextDownActive: {
    color: OASIS.colors.danger,
  },
  bestBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: OASIS.colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  bestBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: OASIS.colors.surface,
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
    fontWeight: '600',
    color: '#0f766e',
  },
  guestPrompt: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: OASIS.colors.soft,
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#a7f3d0',
  },
  guestPromptText: {
    fontSize: 13,
    fontWeight: '700',
    color: OASIS.colors.primary,
  },
  inputWrapper: {
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderTopWidth: 1,
    borderTopColor: '#dcebe3',
    paddingHorizontal: 14,
    paddingTop: 10,
    shadowColor: OASIS.colors.ink,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0,
    shadowRadius: 12,
    elevation: 8,
  },
  replyingBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: OASIS.colors.soft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    marginBottom: 8,
  },
  replyingText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: OASIS.colors.primary,
    flex: 1,
    textAlign: 'right',
    marginRight: 6,
  },
  cancelReply: {
    fontSize: 11,
    fontWeight: '600',
    color: OASIS.colors.danger,
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
    fontWeight: '600',
    color: OASIS.colors.muted,
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
    color: OASIS.colors.ink,
    borderWidth: 1.5,
    borderColor: OASIS.colors.line,
    textAlign: 'right',
    maxHeight: 90,
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#16865b',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: OASIS.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0,
    shadowRadius: 4,
    elevation: 2,
  },
  sendButtonDisabled: {
    backgroundColor: '#94a3b8',
    opacity: 0.6,
  },
  authorManageBox: {
    backgroundColor: OASIS.colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: OASIS.colors.line,
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
    fontWeight: '700',
    color: OASIS.colors.ink,
  },
  authorManageSub: {
    fontSize: 12,
    color: OASIS.colors.muted,
    marginTop: 2,
  },
  editLimitBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
  },
  editLimitBadgeActive: {
    backgroundColor: OASIS.colors.soft,
    borderColor: '#a7f3d0',
  },
  editLimitBadgeExpired: {
    backgroundColor: OASIS.colors.dangerSoft,
    borderColor: '#fecaca',
  },
  editLimitBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  editLimitBadgeTextActive: {
    color: OASIS.colors.primary,
  },
  editLimitBadgeTextExpired: {
    color: OASIS.colors.danger,
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
    backgroundColor: OASIS.colors.soft,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  editActionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: OASIS.colors.primary,
  },
  disabledActionBtn: {
    backgroundColor: '#f1f5f9',
    borderColor: OASIS.colors.line,
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
    backgroundColor: OASIS.colors.dangerSoft,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  deleteActionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: OASIS.colors.danger,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: OASIS.colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 14,
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
    fontWeight: '700',
    color: OASIS.colors.ink,
    textAlign: 'right',
  },
  modalSubtitle: {
    fontSize: 12,
    color: OASIS.colors.primary,
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
    fontWeight: '600',
    color: OASIS.colors.ink,
    textAlign: 'right',
  },
  modalInput: {
    backgroundColor: '#f5f7f6',
    borderWidth: 1.5,
    borderColor: OASIS.colors.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: OASIS.colors.ink,
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
    backgroundColor: OASIS.colors.warningSoft,
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
    backgroundColor: 'transparent',
    paddingVertical: 12,
    borderRadius: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSubmitBtnDisabled: {
    backgroundColor: '#94a3b8',
    opacity: 0.6,
  },
  modalSubmitBtnText: {
    color: OASIS.colors.surface,
    fontSize: 14,
    fontWeight: '700',
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
    color: OASIS.colors.muted,
    fontSize: 14,
    fontWeight: '600',
  },
});
