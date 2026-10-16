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
import { supabase } from '@/lib/supabase';
import { useBottomNavInset } from '@/lib/bottomNav';
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
  const bottomNavInset = useBottomNavInset();
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
  const [savedCount, setSavedCount] = useState(0);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('محتوى غير مناسب');
  const [reportDetails, setReportDetails] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const [pinBusy, setPinBusy] = useState(false);

  // Edit & Delete states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingQuestion, setDeletingQuestion] = useState(false);

  async function load() {
    setLoading(true);
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
      const { count } = await supabase.from('favorite_items').select('id', { count: 'exact', head: true }).eq('target_type', 'question').eq('target_id', id);
      setSavedCount(count || 0);
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
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [id]);

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

  const composerNeedsNavClearance = !composerFocused && !keyboardVisible;

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
    load();
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
        setSavedCount(value => Math.max(0, value - 1));
      } else {
        const { error } = await supabase.from('favorite_items').insert({ user_id: currentUserId, target_type: 'question', target_id: id });
        if (error) throw error;
        setIsFavorite(true);
        setSavedCount(value => value + 1);
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
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomNavInset + 150 }] }
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

          {answers.length === 0 ? (
            <View style={styles.emptyState}>
              <MessageCircle size={38} color="#94a3b8" />
              <Text style={styles.emptyStateTitle}>لا توجد ردود بعد</Text>
              <Text style={styles.emptyStateText}>شارك بمعلوماتك أو تجربتك لمساعدة أهل حيّك!</Text>
            </View>
          ) : (
            answers.map(a => {
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
                  style={[styles.answerCard, isBest && styles.bestAnswerCard]}
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
                      <Text style={styles.replyToText}>رد على مشاركة سابقة</Text>
                    </View>
                  )}

                  <Text style={styles.answerBody}>{a.body}</Text>

                  {/* Actions Row */}
                  <View style={styles.answerActions}>
                    <View style={styles.actionsRightGroup}>
                      <Pressable
                        onPress={() =>
                          currentUserId ? setReplyTo(a) : requireAccount('سجّل الدخول للرد على التعليقات.')
                        }
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
          style={[styles.guestPrompt, { paddingBottom: (Platform.OS === 'ios' ? 12 : 8) + (composerNeedsNavClearance ? 76 : Math.max(bottomNavInset, 8)) }] }
          onPress={() => requireAccount('سجّل الدخول أو أنشئ حساباً للرد والتصويت في نقاشات الحي.')}
        >
          <Text style={styles.guestPromptText}>سجّل الدخول للمشاركة في النقاش</Text>
          <MessageCircle size={18} color="#047857" />
        </Pressable>
      ) : (
        <View style={[styles.inputWrapper, { paddingBottom: composerNeedsNavClearance ? bottomNavInset + 76 : Math.max(bottomNavInset, 8) }]}>
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
