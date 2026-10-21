import { useState, useEffect } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Platform,
  Share,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  MessageCircle,
  MapPin,
  Flame,
  Heart,
  Share2,
  MoreHorizontal,
  User,
  ChevronUp,
  ChevronLeft,
  Wrench,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Bookmark,
  Send,
  Eye,
  Check,
  Sparkles,
  HeartHandshake,
  Coffee,
  Award,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { requireAccount } from '@/lib/authGate';
import { showDialog } from '@/lib/dialog';

export function formatArabicTimeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const now = new Date();
  const past = new Date(dateStr);
  const diffMs = now.getTime() - past.getTime();
  const diffSec = Math.max(0, Math.floor(diffMs / 1000));
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  if (diffMin < 1) return 'الآن';
  if (diffMin < 60) return `منذ ${diffMin} د`;
  if (diffHour < 24) return `منذ ${diffHour} س`;
  if (diffDay === 1) return 'أمس';
  if (diffDay < 7) return `منذ ${diffDay} أيام`;
  return past.toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' });
}

export interface TwitterInquiryCardProps {
  type: 'question' | 'request';
  data: any;
  currentUserProfile: any;
  currentUserId: string | null;
  isGuest?: boolean;
  isMine?: boolean;
  onQuickReply: (id: string, text: string) => Promise<void>;
  onToast: (msg: string) => void;
  onDeleted?: () => void;
  detailMode?: boolean;
}

export default function TwitterInquiryCard({
  type,
  data,
  currentUserProfile,
  currentUserId,
  isGuest = false,
  isMine,
  onQuickReply,
  onToast,
  onDeleted,
  detailMode = false,
}: TwitterInquiryCardProps) {
  const isReq = type === 'request';
  const isAdmin = Boolean(currentUserId && currentUserProfile?.role === 'admin');
  const isOwner = Boolean(currentUserId && currentUserId === (isReq ? data.requester_id : data.author_id));
  const name = data.profiles?.hide_name ? 'جار مجهول 🕶️' : (data.profiles?.display_name || data.profiles?.username || 'ابن الحي');
  const username = data.profiles?.username || 'neighbor';
  const avatar = data.profiles?.avatar_url;
  const isEmergency = data.is_urgent || data.is_emergency || data.urgency_level === 'emergency' || (data.title && (data.title.includes('مفقود') || data.title.includes('طارئ')));
  const isToolSharing = data.is_tool_sharing || data.item_type === 'tool_sharing' || (data.title && (data.title.includes('إعارة') || data.title.includes('دريل')));

  const [expanded, setExpanded] = useState(false);
  const [quickReplyText, setQuickReplyText] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);
  type ReactionType = 'like' | 'help' | 'useful' | 'thanks';
  const REACTIONS: { id: ReactionType; Icon: typeof Heart; label: string }[] = [
    { id: 'like', Icon: Heart, label: 'أعجبني' },
    { id: 'help', Icon: HeartHandshake, label: 'أبشر بالفزعة' },
    { id: 'useful', Icon: Sparkles, label: 'معلومة مفيدة' },
    { id: 'thanks', Icon: Coffee, label: 'الله يعطيك العافية' },
  ];
  const [myReaction, setMyReaction] = useState<ReactionType | null>(null);
  const [reactionCounts, setReactionCounts] = useState<Record<ReactionType, number>>({
    like: Number(data.likes_count ?? data.likes ?? 0), help: 0, useful: 0, thanks: 0,
  });
  const [reactionBusy, setReactionBusy] = useState(false);
  const [reactionPickerOpen, setReactionPickerOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editTitle, setEditTitle] = useState(String(data.title || ''));
  const [editBody, setEditBody] = useState(String(isReq ? data.description || '' : data.body || ''));
  const [editBusy, setEditBusy] = useState(false);
  const [editNotes, setEditNotes] = useState(String(data.notes || ''));
  const [bookmarked, setBookmarked] = useState(false);
  const [viewsCount, setViewsCount] = useState<number>(() => Number(data.views_count ?? data.views ?? data.view_count ?? 0));
  const [savesCount, setSavesCount] = useState(0);
  const [isPinned, setIsPinned] = useState(Boolean(data.is_pinned));
  const [isFeatured, setIsFeatured] = useState(Boolean(data.is_featured));
  const [resolutionStatus, setResolutionStatus] = useState(String(data.status === 'completed' ? 'helped' : data.status === 'accepted' ? 'accepted' : data.resolution_status || 'open'));
  const [bestAnswerId, setBestAnswerId] = useState<string | null>(data.best_answer_id || null);
  const [statusPickerOpen, setStatusPickerOpen] = useState(false);
  const statusLabels: Record<string, string> = { accepted: 'جارٍ تنفيذ الطلب', open: 'بانتظار المساعدة', found: 'تم العثور على الغرض', helped: 'تمت المساعدة', resolved: 'تم حل المشكلة', not_needed: 'لم أعد بحاجة للمساعدة' };

  // Detail screens reload after accepting an answer or completing a request.
  useEffect(() => {
    setResolutionStatus(String(data.status === 'completed' ? 'helped' : data.status === 'accepted' ? 'accepted' : data.resolution_status || 'open'));
    setBestAnswerId(data.best_answer_id || null);
    setIsPinned(Boolean(data.is_pinned));
    setIsFeatured(Boolean(data.is_featured));
  }, [data.status, data.resolution_status, data.best_answer_id, data.is_pinned, data.is_featured]);

  // Track real view count on mount
  useEffect(() => {
    let isMounted = true;
    const viewKey = `viewed_${type}_${data.id}`;
    if (typeof window !== 'undefined' && window.sessionStorage) {
      if (!window.sessionStorage.getItem(viewKey)) {
        window.sessionStorage.setItem(viewKey, '1');
        const tableName = type === 'request' ? 'requests' : 'questions';
        Promise.resolve(
          supabase.rpc('increment_view_count', { p_table: tableName, p_id: data.id })
        )
          .then(({ data: nextVal, error }) => {
            if (!error && typeof nextVal === 'number' && isMounted) setViewsCount(nextVal);
          })
          .catch(() => {
            // Keep the last persisted count; never fabricate analytics when tracking fails.
          });
      }
    }
    return () => {
      isMounted = false;
    };
  }, [data.id, type]);

  useEffect(() => {
    let active = true;
    async function loadReactions() {
      const targetType = type === 'request' ? 'request' : 'question';
      try {
        const { data: rows, error } = await supabase.from('post_reactions').select('reaction_type,user_id').eq('target_type', targetType).eq('target_id', data.id);
        if (error) throw error;
        if (!active) return;
        const counts: Record<ReactionType, number> = { like: 0, help: 0, useful: 0, thanks: 0 };
        (rows || []).forEach((row: { reaction_type: ReactionType; user_id: string }) => {
          if (row.reaction_type in counts) counts[row.reaction_type] += 1;
          if (currentUserId && row.user_id === currentUserId) setMyReaction(row.reaction_type);
        });
        setReactionCounts(counts);
      } catch { /* Optional migration may not have been applied yet. */ }
    }
    void loadReactions();
    return () => { active = false; };
  }, [currentUserId, data.id, type]);

  useEffect(() => {
    let active = true;
    async function loadPostMetadata() {
      if (!currentUserId) { setBookmarked(false); return; }
      try {
        const targetType = type === 'request' ? 'request' : 'question';
        const [{ data: saved }, stats] = await Promise.all([
          supabase.from('favorite_items').select('id').eq('user_id', currentUserId).eq('target_type', targetType).eq('target_id', data.id).maybeSingle(),
          isOwner
            ? supabase.rpc('get_owned_post_save_count', { p_target_type: targetType, p_target_id: data.id })
            : Promise.resolve({ data: null, error: null } as any),
        ]);
        if (active) {
          setBookmarked(Boolean(saved));
          if (isOwner && !stats.error && typeof stats.data === 'number') setSavesCount(stats.data);
        }
      } catch { /* Keep the card usable if metadata is unavailable. */ }
    }
    void loadPostMetadata();
    return () => { active = false; };
  }, [currentUserId, data.id, isOwner, type]);

  const answers = [...(data.answers || [])].sort((a: any, b: any) => {
    const aBest = bestAnswerId && a.id === bestAnswerId ? 1 : 0;
    const bBest = bestAnswerId && b.id === bestAnswerId ? 1 : 0;
    if (aBest !== bBest) return bBest - aBest;
    return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
  });
  const answersCount = data.answers_count !== undefined ? data.answers_count : answers.length;
  // Keep the accepted answer visible in the compact card even when many replies exist.
  const displayedAnswers = answers.slice(0, 4);
  const remainingCount = Math.max(0, answers.length - 4);

  async function markBestAnswer(answerId: string) {
    if (!isOwner || isReq || !currentUserId) return;
    try {
      const { data: updated, error } = await supabase
        .from('questions')
        .update({ best_answer_id: answerId, status: 'answered', solved_at: new Date().toISOString(), resolution_status: 'resolved' })
        .eq('id', data.id)
        .eq('author_id', currentUserId)
        .select('id, best_answer_id')
        .maybeSingle();
      if (error) throw error;
      if (!updated) throw new Error('يمكن لصاحب السؤال فقط اعتماد الإجابة.');
      setBestAnswerId(answerId);
      setResolutionStatus('resolved');
      data.best_answer_id = answerId;
      data.status = 'answered';
      data.resolution_status = 'resolved';
      data.answers = [...answers].sort((a: any, b: any) => {
        const aBest = a.id === answerId ? 1 : 0;
        const bBest = b.id === answerId ? 1 : 0;
        return bBest - aBest || new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime();
      });
      onToast('تم اعتماد الرد كأفضل إجابة ⭐');
    } catch (error: any) {
      Alert.alert('تعذر اعتماد الإجابة', error?.message || 'حاول مرة أخرى.');
    }
  }

  async function handleReaction(reaction: ReactionType) {
    if (isGuest || !currentUserId) return requireAccount('سجّل الدخول أو أنشئ حساباً للتفاعل مع منشورات الحي.');
    if (reactionBusy) return;
    const previous = myReaction;
    const next = previous === reaction ? null : reaction;
    const targetType = type === 'request' ? 'request' : 'question';
    setReactionBusy(true);
    setMyReaction(next);
    setReactionCounts(current => {
      const updated = { ...current };
      if (previous) updated[previous] = Math.max(0, updated[previous] - 1);
      if (next) updated[next] += 1;
      return updated;
    });
    try {
      if (next) {
        const { error } = await supabase.from('post_reactions').upsert({ user_id: currentUserId, target_type: targetType, target_id: data.id, reaction_type: next }, { onConflict: 'target_type,target_id,user_id' });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('post_reactions').delete().eq('user_id', currentUserId).eq('target_type', targetType).eq('target_id', data.id);
        if (error) throw error;
      }
      const selected = REACTIONS.find(item => item.id === next);
      onToast(next ? (selected?.label || 'تم التفاعل') : 'تم إلغاء التفاعل');
    } catch (error: any) {
      setMyReaction(previous);
      setReactionCounts(current => {
        const updated = { ...current };
        if (next) updated[next] = Math.max(0, updated[next] - 1);
        if (previous) updated[previous] += 1;
        return updated;
      });
      Alert.alert('تعذر حفظ التفاعل', error?.message || 'تأكد من تطبيق تحديث قاعدة البيانات ثم حاول مرة أخرى.');
    } finally { setReactionBusy(false); }
  }

  async function handleBookmark() {
    if (isGuest || !currentUserId) return requireAccount('سجّل الدخول أو أنشئ حساباً لحفظ المنشورات.');
    const next = !bookmarked;
    setBookmarked(next);
    setSavesCount(value => Math.max(0, value + (next ? 1 : -1)));
    try {
      const targetType = type === 'request' ? 'request' : 'question';
      const result = next
        ? await supabase.from('favorite_items').upsert({ user_id: currentUserId, target_type: targetType, target_id: data.id }, { onConflict: 'user_id,target_type,target_id' })
        : await supabase.from('favorite_items').delete().eq('user_id', currentUserId).eq('target_type', targetType).eq('target_id', data.id);
      if (result.error) throw result.error;
      onToast(next ? 'تم حفظ المنشور في المفضلة 🔖' : 'تمت إزالة المنشور من المفضلة');
    } catch (error: any) {
      setBookmarked(!next);
      setSavesCount(value => Math.max(0, value + (next ? -1 : 1)));
      Alert.alert('تعذر تحديث المفضلة', error?.message || 'حاول مرة أخرى.');
    }
  }

  async function handleShare() {
    const pageUrl = (Platform.OS === 'web' && typeof window !== 'undefined')
      ? `${(window as any).location.origin}/${isReq ? 'request' : 'question'}?id=${data.id}`
      : `https://appksa-main.vercel.app/${isReq ? 'request' : 'question'}?id=${data.id}`;
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && (navigator as any).clipboard) {
      try {
        await (navigator as any).clipboard.writeText(pageUrl);
        onToast('تم نسخ الرابط 🔗');
        return;
      } catch {}
    }
    try {
      await Share.share({ title: data.title, message: `${data.title}\n${pageUrl}`, url: pageUrl });
    } catch {
      onToast('تم نسخ الرابط');
    }
  }

  async function confirmDeletePost() {
    showDialog({ title: 'حذف المنشور نهائياً', message: 'هل أنت متأكد؟ لا يمكن التراجع عن حذف المنشور.', buttons: [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف المنشور',
          style: 'destructive',
          onPress: async () => {
            try {
              const table = isReq ? 'requests' : 'questions';
              if (!currentUserId || (!isOwner && !isAdmin)) return;
              let query = supabase.from(table).delete().eq('id', data.id);
              if (!isAdmin) query = query.eq(isReq ? 'requester_id' : 'author_id', currentUserId);
              const { data: removed, error } = await query.select('id');
              if (error) throw error;
              if (!removed?.length) throw new Error('لا تملك صلاحية حذف هذا المنشور.');
              onToast('تم حذف المنشور بنجاح');
              onDeleted?.();
            } catch (err: any) {
              Alert.alert('تعذر الحذف', err?.message || 'تأكد من اتصالك ثم حاول مرة أخرى.');
            }
          },
        },
      ],
    });
  }

  async function updateResolutionStatus(nextStatus: string) {
    if ((!isOwner && !isAdmin) || !currentUserId) return;
    const table = isReq ? 'requests' : 'questions';
    const ownerColumn = isReq ? 'requester_id' : 'author_id';
    let query = supabase.from(table).update({ resolution_status: nextStatus, updated_at: new Date().toISOString() }).eq('id', data.id);
    if (!isAdmin) query = query.eq(ownerColumn, currentUserId);
    const { data: updated, error } = await query.select('id').maybeSingle();
    if (!error && !updated) return Alert.alert('تعذر تحديث الحالة', 'لا تملك صلاحية تعديل هذا المنشور.');
    if (error) return Alert.alert('تعذر تحديث الحالة', error.message || 'حاول مرة أخرى.');
    setResolutionStatus(nextStatus);
    data.resolution_status = nextStatus;
    onToast('تم تحديث حالة المنشور: ' + (statusLabels[nextStatus] || nextStatus));
  }

  function openStatusOptions() {
    setStatusPickerOpen(true);
  }

  async function togglePinned() {
    if (!currentUserId) return;
    const isAdminPin = currentUserProfile?.role === 'admin';
    const next = isAdminPin ? !isFeatured : !isPinned;
    const table = isReq ? 'requests' : 'questions';
    const ownerColumn = isReq ? 'requester_id' : 'author_id';
    const now = new Date().toISOString();
    let query = supabase.from(table).update({
      is_pinned: next,
      pinned_at: next ? now : null,
      ...(isAdminPin ? { is_featured: next, featured_at: next ? now : null } : {}),
      updated_at: now,
    }).eq('id', data.id);
    if (isOwner) query = query.eq(ownerColumn, currentUserId);
    else if (currentUserProfile?.role !== 'admin') return;
    const { error } = await query;
    if (error) return Alert.alert('تعذر تحديث التثبيت', error.message || 'تحقق من الصلاحيات ثم حاول مرة أخرى.');
    setIsPinned(next);
    data.is_pinned = next;
    if (isAdminPin) { setIsFeatured(next); data.is_featured = next; }
    onToast(isAdminPin
      ? (next ? 'تم تثبيت المنشور كتنبيه مهم للحي 📌' : 'تم إلغاء تثبيت التنبيه للحي')
      : (next ? 'تم تثبيت المنشور في أعلى الملف الشخصي 📌' : 'تم إلغاء تثبيت المنشور'));
  }

  function handleMoreOptions() {
    const options: any[] = [];
    if (isOwner || isAdmin) {
      options.push({
        text: 'تعديل المنشور',
        onPress: () => { setEditTitle(String(data.title || '')); setEditBody(String(isReq ? data.description || '' : data.body || '')); setEditNotes(String(data.notes || '')); setEditorOpen(true); },
      });
      options.push({ text: 'حذف المنشور', style: 'destructive', onPress: confirmDeletePost });
      options.push({ text: 'تحديث حالة المنشور', onPress: openStatusOptions });
    }
    if (isOwner || currentUserProfile?.role === 'admin') {
      const adminPin = currentUserProfile?.role === 'admin';
      options.push({ text: adminPin ? (isFeatured ? 'إلغاء تثبيت التنبيه للحي' : 'تثبيت كتنبيه مهم للحي 📌') : (isPinned ? 'إلغاء تثبيت المنشور من الملف' : 'تثبيت في الملف الشخصي 📌'), onPress: () => { void togglePinned(); } });
    }
    options.push({ text: 'نسخ رابط المنشور', onPress: handleShare });
    if (!isGuest) {
      options.push({
        text: 'إبلاغ عن محتوى غير لائق',
        onPress: () => router.push({ pathname: '/report', params: { id: data.id, type: isReq ? 'request' : 'question' } }),
        style: 'destructive',
      });
    }
    options.push({ text: 'إلغاء', style: 'cancel' });
    showDialog({ title: 'خيارات المنشور', message: data.title, buttons: options });
  }

  async function savePostEdit() {
    if (!currentUserId || (!isOwner && !isAdmin) || !editTitle.trim() || editBusy) return;
    setEditBusy(true);
    try {
      const changes = { ...(isReq ? { notes: editNotes.trim() } : {}), title: editTitle.trim(), [isReq ? 'description' : 'body']: editBody.trim(), updated_at: new Date().toISOString() };
      let query = supabase.from(isReq ? 'requests' : 'questions').update(changes).eq('id', data.id);
      if (!isAdmin) query = query.eq(isReq ? 'requester_id' : 'author_id', currentUserId);
      const { data: updated, error } = await query.select('id').maybeSingle();
      if (error) throw error;
      if (!updated) throw new Error('لا تملك صلاحية تعديل هذا المنشور.');
      Object.assign(data, changes);
      setEditorOpen(false);
      onToast('تم حفظ التعديلات');
      onDeleted?.();
    } catch (error: any) {
      Alert.alert('تعذر حفظ التعديلات', error?.message || 'حاول مرة أخرى.');
    } finally { setEditBusy(false); }
  }

  async function handleSendReply() {
    if (isGuest) return requireAccount('سجّل الدخول أو أنشئ حساباً للرد على جيرانك.');
    if (!quickReplyText.trim()) return;
    setReplyLoading(true);
    try {
      await onQuickReply(data.id, quickReplyText);
      setQuickReplyText('');
    } catch (err: any) {
      Alert.alert('خطأ', err?.message || 'تعذر إرسال الرد');
    } finally {
      setReplyLoading(false);
    }
  }

  function navigateToDetails() {
    if (isReq) router.push({ pathname: '/request', params: { id: data.id } });
    else router.push({ pathname: '/question', params: { id: data.id } });
  }

  return (
    <View style={[s.xCard, !expanded && s.xCardCollapsed, isEmergency && s.xCardEmergency, isToolSharing && s.xCardToolSharing]}>
      {/* Top Header */}
      <View style={s.xHeader}>
        <Pressable
          onPress={() => isGuest ? requireAccount() : data.profiles?.id && router.push({ pathname: '/user', params: { id: data.profiles.id } })}
          style={s.xAvatarWrap}
          accessibilityRole="button"
          accessibilityLabel="الملف الشخصي للكاتب"
        >
          {avatar ? (
            <Image source={{ uri: avatar }} style={s.xAvatarImg} />
          ) : (
            <View style={[s.xAvatarFallback, isEmergency && { backgroundColor: '#dc2626' }]}>
              <User size={20} color="#fff" />
            </View>
          )}

        </Pressable>

        <View style={s.xAuthorMeta}>
          <View style={s.xAuthorRow}>
            <Pressable onPress={() => isGuest ? requireAccount() : data.profiles?.id && router.push({ pathname: '/user', params: { id: data.profiles.id } })}>              <Text style={s.xAuthorName} numberOfLines={1}>{name}</Text>
            </Pressable>
            {isEmergency ? (
              <View style={s.xEmergencyBadge}><Flame size={11} color="#dc2626" /><Text style={s.xEmergencyBadgeText}>عاجل</Text></View>
            ) : isToolSharing ? (
              <View style={s.xToolBadge}><Wrench size={11} color="#16a34a" /><Text style={s.xToolBadgeText}>إعارة</Text></View>
            ) : isReq ? (
              <View style={s.xReqBadge}><HeartHandshake size={11} color="#d97706" /><Text style={s.xReqBadgeText}>طلب فزعة</Text></View>
            ) : (
              <View style={s.xCategoryBadge}><MessageCircle size={11} color="#047857" /><Text style={s.xCategoryBadgeText}>استفسار</Text></View>
            )}

          </View>

          {!data.profiles?.hide_name && <Text style={[s.xHandle, { maxWidth: '100%', textAlign: 'right', writingDirection: 'ltr' }]} numberOfLines={1}>@{username}</Text>}

          <View style={s.xLocationRow}>
            <MapPin size={11} color="#047857" />
            <Text style={s.xLocationText}>
              {data.district ? `حي ${data.district}` : 'الحي'}{data.city ? ` · ${data.city}` : ''}
            </Text>
          </View>
        </View>

        <Pressable onPress={handleMoreOptions} style={s.xMoreBtn} accessibilityRole="button" accessibilityLabel="خيارات">
          <MoreHorizontal size={18} color="#94a3b8" />
        </Pressable>
      </View>

      {/* Main Content Area */}
      <Pressable onPress={detailMode ? undefined : navigateToDetails} style={s.xContentArea} accessibilityRole={detailMode ? undefined : "button"} accessibilityLabel={detailMode ? undefined : "فتح تفاصيل المنشور"}>
        <Text style={[s.xTitle, isEmergency && { color: '#991b1b' }]} numberOfLines={detailMode ? undefined : 2}>{data.title}</Text>
        {(data.body || data.description) && (
          <>
            <Text style={s.xBodyText} numberOfLines={detailMode ? undefined : 2}>{isReq ? data.description : data.body}</Text>
            {!detailMode && String(isReq ? data.description : data.body || '').length > 130 && <Text style={s.xReadMore}>عرض المزيد وفتح التفاصيل ←</Text>}
          </>
        )}
        {isPinned && <View style={{ alignSelf: 'flex-start', flexDirection: 'row-reverse', alignItems: 'center', gap: 4, backgroundColor: '#fff7ed', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5, marginTop: 8 }}><Text style={{ color: '#c2410c', fontSize: 11, fontWeight: '800' }}>📌 مثبت في الملف الشخصي</Text></View>}
        {isFeatured && <View style={{ alignSelf: 'flex-start', backgroundColor: '#fee2e2', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5, marginTop: 7 }}><Text style={{ color: '#991b1b', fontSize: 11, fontWeight: '900' }}>📢 تنبيه مثبت من إدارة الحي</Text></View>}
        <View style={s.xCompactStatus}>
          <View style={[s.xCompactStatusDot, resolutionStatus !== 'open' && s.xCompactStatusDotResolved]} />
          <Text style={s.xCompactStatusText}>{statusLabels[resolutionStatus] || 'مفتوح'}</Text>
        </View>
        <View style={s.xHashtagRow}>
          {data.district && (
            <View style={s.xHashPill}><Text style={s.xHashText}>#{data.district.replace(/\s+/g, '_')}</Text></View>
          )}
          <View style={s.xHashPill}><Text style={s.xHashText}>#أهل_الحي</Text></View>
          {isToolSharing && (
            <View style={[s.xHashPill, { backgroundColor: '#f0fdf4' }]}><Text style={[s.xHashText, { color: '#16a34a' }]}>#إعارة_مجانية</Text></View>
          )}
          {Boolean(data.best_answer_id) && (
            <View style={[s.xHashPill, { backgroundColor: '#fef3c7' }]}>
              <Text style={[s.xHashText, { color: '#b45309', fontWeight: '800' }]}>⭐ تم الحل</Text>
            </View>
          )}
        </View>
      </Pressable>

      {/* Interactive Responders Preview (Collapsed Strip) */}
      {!detailMode && !expanded && answers.length > 0 && (
        <Pressable style={s.xRespondersPreview} onPress={navigateToDetails} accessibilityRole="button" accessibilityLabel="عرض جميع الردود">
          <View style={s.xRespondersAvatars}>
            {answers.slice(0, 4).map((ans: any, i: number) => {
              const aAvatar = ans.profiles?.avatar_url;
              const aName = ans.profiles?.display_name || 'ج';
              return (
                <View key={ans.id || i} style={[s.xMiniStackAvatarWrap, { zIndex: 10 - i, marginRight: i > 0 ? -10 : 0 }]}>
                  {aAvatar ? (
                    <Image source={{ uri: aAvatar }} style={s.xMiniStackAvatar} />
                  ) : (
                    <View style={s.xMiniStackAvatarFallback}>
                      <Text style={s.xMiniStackAvatarLetter}>{aName[0]}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
          <View style={s.xRespondersPreviewTextCol}>
            <Text style={s.xRespondersPreviewText}>
              {answers.length === 1 ? 'رد واحد من جيران الحي' : `${answers.length} ردود من جيران الحي`}
            </Text>
            <Text style={s.xRespondersPreviewSub}>انقر للاطلاع على التوصيات والردود 💬</Text>
          </View>
          <ChevronLeft size={16} color="#047857" />
        </Pressable>
      )}

      <View style={[s.xReactionsRow, { justifyContent: 'space-between' }]}>
        <Text style={s.xTimeAgo}>{formatArabicTimeAgo(data.created_at)}</Text>
        <Pressable style={[s.xActionBtn, myReaction && s.xActionBtnActive]} onPress={() => {
          if (isGuest || !currentUserId) return requireAccount('سجّل الدخول لاختيار تفاعلك مع منشورات جيرانك.');
          setReactionPickerOpen(true);
        }} accessibilityRole="button" accessibilityLabel="اختيار التفاعل" accessibilityState={{ expanded: reactionPickerOpen }}>
          <Heart size={18} color={myReaction ? '#047857' : '#64748b'} />
          <Text style={s.xActionCounter}>{REACTIONS.find(r => r.id === myReaction)?.label || 'تفاعل'}</Text>
          <Text style={s.xActionCounter}>{Object.values(reactionCounts).reduce((sum, count) => sum + count, 0)}</Text>
        </Pressable>
      </View>

      {/* Action Bar */}
      <View style={s.xActionBar}>
        <Pressable style={s.xActionBtn} onPress={detailMode ? undefined : navigateToDetails} accessibilityRole={detailMode ? undefined : "button"} accessibilityLabel={detailMode ? "عدد الردود" : "فتح الردود في صفحة المنشور"}>
          <MessageCircle size={17} color="#64748b" />
          <Text style={s.xActionCounter}>{answersCount}</Text>
        </Pressable>

        {!isGuest && (
          <Pressable style={s.xActionBtn} onPress={handleBookmark}>
            <Bookmark size={17} color={bookmarked ? '#f59e0b' : '#64748b'} fill={bookmarked ? '#f59e0b' : 'none'} />
            {bookmarked && <Text style={[s.xActionCounter, { color: '#f59e0b', fontSize: 10 }]}>محفوظ</Text>}
          </Pressable>
        )}

        <Pressable style={s.xActionBtn} onPress={handleShare}>
          <Share2 size={17} color="#64748b" />
        </Pressable>

        <View style={s.xActionBtn}>
          <Eye size={16} color="#94a3b8" />
          <Text style={s.xActionViews}>{viewsCount}</Text>
        </View>
      </View>

      {isOwner && expanded && (
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-around', gap: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#f0fdf4', borderTopWidth: 1, borderTopColor: '#dcfce7' }}>
          <View style={{ alignItems: 'center', gap: 3 }}><Eye size={15} color="#166534" /><Text style={{ color: '#166534', fontSize: 11, fontWeight: '800' }}>{viewsCount} مشاهدة</Text></View>
          <View style={{ alignItems: 'center', gap: 3 }}><MessageCircle size={15} color="#166534" /><Text style={{ color: '#166534', fontSize: 11, fontWeight: '800' }}>{answersCount} رد</Text></View>
          <View style={{ alignItems: 'center', gap: 3 }}><Bookmark size={15} color="#166534" /><Text style={{ color: '#166534', fontSize: 11, fontWeight: '800' }}>{savesCount} حفظ</Text></View>
        </View>
      )}

      {/* Expanded Thread: Shows up to 4 responders then link to full page */}
      {expanded && (
        <View style={s.xThreadContainer}>
          <View style={s.xThreadHeader}>
            <Pressable onPress={() => setExpanded(false)} style={s.xThreadCloseBtn}>
              <ChevronUp size={14} color="#047857" />
              <Text style={s.xThreadCloseText}>طي التفاصيل</Text>
            </Pressable>
            <View style={s.xThreadTitleRow}>
              <Text style={s.xThreadTitle}>
                {isReq ? `عروض وفزعات الجيران (${answersCount})` : `خيط الردود والتوصيات (${answersCount})`}
              </Text>
              <Sparkles size={14} color="#047857" />
            </View>
          </View>

          {displayedAnswers.length > 0 ? (
            <View style={s.xAnswersList}>
              {displayedAnswers.map((ans: any, idx: number) => {
                const ansName = ans.profiles?.hide_name ? 'جار مجهول 🕶️' : (ans.profiles?.display_name || ans.profiles?.username || 'ابن الحي');
                const ansAvatar = ans.profiles?.avatar_url;
                const isAccepted = Boolean(ans.is_accepted || data.best_answer_id === ans.id || ans.status === 'completed');

                return (
                  <View key={ans.id || idx} style={s.xAnswerItem}>
                    <View style={s.xThreadLine} />
                    <View style={s.xAnswerAvatarWrap}>
                      {ansAvatar ? (
                        <Image source={{ uri: ansAvatar }} style={s.xAnswerAvatar} />
                      ) : (
                        <View style={s.xAnswerAvatarFallback}>
                          <Text style={s.xAnswerAvatarLetter}>{ansName[0]}</Text>
                        </View>
                      )}
                    </View>

                    <View style={[s.xAnswerBubble, isAccepted && s.xAnswerBubbleAccepted]}>
                      <View style={s.xAnswerHeaderRow}>
                        <Text style={s.xAnswerTime}>{formatArabicTimeAgo(ans.created_at)}</Text>
                        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 5 }}>
                          <Text style={s.xAnswerAuthorName}>{ansName}</Text>

                          {isAccepted && (
                            <View style={s.xAcceptedBadge}>
                              <Award size={10} color="#fff" />
                              <Text style={s.xAcceptedBadgeText}>
                                {isReq ? 'فزعة معتمدة 🤝' : 'أفضل إجابة ⭐'}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <Text style={s.xAnswerBodyText}>{ans.body}</Text>
                      {isOwner && !isReq && bestAnswerId !== ans.id && (
                        <Pressable
                          onPress={() => void markBestAnswer(ans.id)}
                          style={{ alignSelf: 'flex-start', flexDirection: 'row-reverse', alignItems: 'center', gap: 5, marginTop: 8, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0' }}
                          accessibilityRole="button"
                          accessibilityLabel="اعتماد الرد كأفضل إجابة"
                        >
                          <Award size={13} color="#047857" />
                          <Text style={{ color: '#047857', fontSize: 11, fontWeight: '800' }}>هل أفادك الرد؟ اعتمده كأفضل إجابة</Text>
                        </Pressable>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={s.xNoAnswersBox}>
              <Text style={s.xNoAnswersText}>
                {isReq ? 'كن أول من يفزع ويقدم المساعدة لجارك! 🤝' : 'كن أول من يفيد جارك بتوصية أو معلومة! 💡'}
              </Text>
            </View>
          )}

          {/* Prompt when more than 4 responders exist */}
          {remainingCount > 0 && (
            <Pressable
              style={s.xMoreRepliesCard}
              onPress={navigateToDetails}
              accessibilityRole="button"
              accessibilityLabel={`عرض ${remainingCount} ردود إضافية في الصفحة الكاملة`}
            >
              <View style={s.xMoreRepliesPill}>
                <Text style={s.xMoreRepliesPillText}>+{remainingCount} ردود أخرى</Text>
              </View>
              <Text style={s.xMoreRepliesCardText}>
                انقر لعرض باقي ردود وتوصيات الجيران في الصفحة كاملة
              </Text>
              <ChevronLeft size={16} color="#047857" />
            </Pressable>
          )}

          {/* Quick Reply Form */}
          {isGuest ? (
            <Pressable
              style={s.xGuestReplyPrompt}
              onPress={() => requireAccount('سجّل الدخول أو أنشئ حساباً للرد على جيرانك.')}
            >
              <Text style={s.xGuestReplyText}>سجّل الدخول للمشاركة في النقاش</Text>
              <MessageCircle size={16} color="#047857" />
            </Pressable>
          ) : (
            <View style={s.xQuickReplyContainer}>
              <View style={s.xQuickReplyAvatar}>
                {currentUserProfile?.avatar_url ? (
                  <Image source={{ uri: currentUserProfile.avatar_url }} style={s.xMiniAvatar} />
                ) : (
                  <View style={s.xMiniAvatarFallback}>
                    <Text style={s.xMiniAvatarLetter}>{currentUserProfile?.display_name?.[0] || 'أ'}</Text>
                  </View>
                )}
              </View>
              <TextInput
                style={s.xQuickReplyInput}
                placeholder={isReq ? 'اكتب عرض مساعدتك للجار...' : 'اكتب إجابتك وتوصيتك للجار...'}
                placeholderTextColor="#94a3b8"
                value={quickReplyText}
                onChangeText={setQuickReplyText}
                multiline
              />
              <Pressable
                style={[s.xQuickReplySendBtn, (!quickReplyText.trim() || replyLoading) && s.xQuickReplySendBtnDisabled]}
                onPress={handleSendReply}
                disabled={!quickReplyText.trim() || replyLoading}
              >
                <Send size={15} color="#fff" />
                <Text style={s.xQuickReplySendText}>رد</Text>
              </Pressable>
            </View>
          )}

          {/* Full Page Redirection Button */}
          <Pressable
            style={s.xOpenFullThreadBtn}
            onPress={navigateToDetails}
            accessibilityRole="button"
            accessibilityLabel={isReq ? 'فتح صفحة طلب الفزعة بالكامل' : 'فتح صفحة الاستفسار بالكامل'}
          >
            <LinearGradient
              colors={['#064e3b', '#065f46', '#047857']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.xOpenFullThreadGrad}
            >
              <ExternalLink size={14} color="#fff" />
              <Text style={s.xOpenFullThreadText}>
                {isReq ? 'فتح صفحة طلب الفزعة كاملة والمتابعة ←' : 'فتح صفحة الاستفسار كاملة والتفاعل ←'}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
      )}
      <Modal visible={reactionPickerOpen} transparent animationType="fade" onRequestClose={() => setReactionPickerOpen(false)}>
        <View style={s.pickerBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setReactionPickerOpen(false)} accessibilityRole="button" accessibilityLabel="إغلاق التفاعلات" />
          <View style={s.pickerPanel}>
            <Text style={s.pickerTitle}>اختر تفاعلك</Text>
            {REACTIONS.map(({ id, Icon, label }) => (
              <Pressable key={id} disabled={reactionBusy} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: myReaction === id, disabled: reactionBusy }} style={[s.pickerOption, myReaction === id && s.xReactionChipActive]} onPress={() => { setReactionPickerOpen(false); void handleReaction(id); }}>
                <Icon size={22} color="#047857" />
                <Text style={s.pickerLabel}>{label}</Text>
                <Text style={s.xReactionCount}>{reactionCounts[id]}</Text>
              </Pressable>
            ))}
            <Text style={s.xTimeAgo}>اختيار تفاعلك الحالي مرة أخرى يزيله</Text>
          </View>
        </View>
      </Modal>
      <Modal visible={editorOpen} transparent animationType="fade" onRequestClose={() => { if (!editBusy) setEditorOpen(false); }}>
        <View style={s.pickerBackdrop}>
          <View style={s.pickerPanel}>
            <Text style={s.pickerTitle}>تعديل المنشور</Text>
            <TextInput accessibilityLabel="عنوان المنشور" value={editTitle} onChangeText={setEditTitle} maxLength={200} style={s.editInput} />
            <TextInput accessibilityLabel="نص المنشور" value={editBody} onChangeText={setEditBody} multiline maxLength={5000} style={[s.editInput, { minHeight: 100 }]} />
            {isReq && <TextInput accessibilityLabel="ملاحظات الطلب" value={editNotes} onChangeText={setEditNotes} multiline maxLength={2000} style={s.editInput} />}
            <Pressable accessibilityRole="button" disabled={editBusy || !editTitle.trim()} onPress={() => void savePostEdit()} style={[s.pickerOption, { backgroundColor: '#ecfdf5' }]}><Text style={s.pickerLabel}>{editBusy ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}</Text></Pressable>
            <Pressable accessibilityRole="button" disabled={editBusy} onPress={() => setEditorOpen(false)} style={s.pickerOption}><Text style={s.pickerLabel}>إلغاء</Text></Pressable>
          </View>
        </View>
      </Modal>
      <Modal visible={statusPickerOpen} transparent animationType="fade" onRequestClose={() => setStatusPickerOpen(false)}>
        <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: 'rgba(15,23,42,0.45)' }}>
          <Pressable style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }} onPress={() => setStatusPickerOpen(false)} accessibilityLabel="إغلاق اختيار الحالة" />
          <View style={{ backgroundColor: '#ffffff', borderRadius: 22, padding: 18, gap: 9 }}>
            <Text style={{ color: '#0f172a', fontSize: 16, fontWeight: '900', textAlign: 'right', marginBottom: 4 }}>تحديث حالة المنشور</Text>
            {Object.entries(statusLabels).filter(([value]) => value !== 'accepted').map(([value, label]) => (
              <Pressable key={value} onPress={() => { setStatusPickerOpen(false); void updateResolutionStatus(value); }} style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 13, paddingVertical: 12, borderRadius: 13, backgroundColor: resolutionStatus === value ? '#dcfce7' : '#f8fafc', borderWidth: 1, borderColor: resolutionStatus === value ? '#86efac' : '#e2e8f0' }}>
                <Text style={{ color: resolutionStatus === value ? '#166534' : '#334155', fontSize: 13, fontWeight: '800', textAlign: 'right' }}>{label}</Text>
                {resolutionStatus === value && <Check size={16} color="#166534" />}
              </Pressable>
            ))}
            <Pressable onPress={() => setStatusPickerOpen(false)} style={{ alignItems: 'center', padding: 10 }}>
              <Text style={{ color: '#64748b', fontSize: 12, fontWeight: '800' }}>إلغاء</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  pickerBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: 'rgba(15,23,42,0.4)' },
  pickerPanel: { width: '100%', maxWidth: 420, borderRadius: 24, backgroundColor: '#fff', padding: 20, gap: 10 },
  pickerTitle: { color: '#173c2c', fontSize: 18, fontWeight: '800', textAlign: 'right', marginBottom: 4 },
  pickerOption: { minHeight: 48, borderRadius: 14, paddingHorizontal: 12, flexDirection: 'row-reverse', alignItems: 'center', gap: 12, backgroundColor: '#f7faf8' },
  pickerLabel: { flex: 1, textAlign: 'right', color: '#254b39', fontSize: 14, fontWeight: '700' },
  editInput: { borderWidth: 1, borderColor: '#dbe5df', borderRadius: 12, padding: 12, color: '#173c2c', textAlign: 'right', fontSize: 14 },
  xCard: {
    backgroundColor: '#ffffff',
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.055,
    shadowRadius: 12,
    elevation: 3,
  },
  // Natural height prevents text, chips and actions from being clipped on different devices.
  xCardCollapsed: {},
  xCardEmergency: {
    borderColor: '#fca5a5',
    backgroundColor: '#fffafa',
  },
  xCardToolSharing: {
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4',
  },
  xHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  xAvatarWrap: {
    position: 'relative',
    marginLeft: 10,
  },
  xAvatarImg: {
    width: 46,
    height: 46,
    borderRadius: 23,
  },
  xAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#047857',
    alignItems: 'center',
    justifyContent: 'center',
  },
  xGeoBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#047857',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  xAuthorMeta: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-end',
    gap: 5,
  },
  xAuthorRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  xAuthorName: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
  },
  xHandle: {
    fontSize: 11,
    color: '#94a3b8',
    maxWidth: 90,
  },
  xDot: {
    color: '#cbd5e1',
    fontSize: 14,
  },
  xTimeAgo: {
    fontSize: 11,
    color: '#94a3b8',
  },
  xMoreBtn: {
    padding: 6,
  },
  xEmergencyBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 10,
  },
  xEmergencyBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#dc2626',
  },
  xToolBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 10,
  },
  xToolBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#16a34a',
  },
  xReqBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 10,
  },
  xReqBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#d97706',
  },
  xCategoryBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 10,
  },
  xCategoryBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#047857',
  },
  xLocationRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,  },
  xLocationText: {
    fontSize: 11,
    color: '#047857',
    fontWeight: '700',
  },
  xContentArea: { marginBottom: 12, minHeight: 0 },
  xCompactStatus: { alignSelf: 'flex-start', flexDirection: 'row-reverse', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#ecfdf5', marginTop: 10, marginBottom: 10 },
  xCompactStatusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#047857' },
  xCompactStatusDotResolved: { backgroundColor: '#64748b' },
  xCompactStatusText: { fontSize: 10, color: '#047857', fontWeight: '800' },
  xReadMore: { alignSelf: 'flex-end', color: '#047857', fontSize: 12, fontWeight: '800', marginTop: 2, marginBottom: 10, textAlign: 'right' },
  xStatusTrack: { flexDirection: 'row-reverse', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4, marginTop: 10, marginBottom: 8, paddingHorizontal: 2 },
  xStatusStep: { flex: 1, alignItems: 'center', gap: 4 },
  xStatusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#cbd5e1', borderWidth: 1, borderColor: '#cbd5e1' },
  xStatusDotActive: { backgroundColor: '#047857', borderColor: '#047857' },
  xStatusLabel: { fontSize: 9, lineHeight: 12, color: '#94a3b8', textAlign: 'center' },
  xStatusLabelActive: { color: '#047857', fontWeight: '800' },
  xReactionsRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 7, marginTop: 12, marginBottom: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  xReactionChip: { flex: 1, minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingHorizontal: 5, paddingVertical: 7, borderRadius: 14, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  xReactionChipActive: { backgroundColor: '#ecfdf5', borderColor: '#6ee7b7' },
  xReactionEmoji: { fontSize: 13 },
  xReactionCount: { color: '#64748b', fontSize: 11, fontWeight: '800' },
  xReactionCountActive: { color: '#047857' },
  xTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'right',
    lineHeight: 27,
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  xBodyText: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'right',
    lineHeight: 23,
    marginBottom: 4,
  },
  xHashtagRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
  },
  xHashPill: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  xHashText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '700',
  },
  xRespondersPreview: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  xRespondersAvatars: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  xMiniStackAvatarWrap: {
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 13,
  },
  xMiniStackAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  xMiniStackAvatarFallback: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#047857',
    alignItems: 'center',
    justifyContent: 'center',
  },
  xMiniStackAvatarLetter: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  xRespondersPreviewTextCol: {
    flex: 1,
    marginHorizontal: 10,
    alignItems: 'flex-end',
  },
  xRespondersPreviewText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1e293b',
  },
  xRespondersPreviewSub: {
    fontSize: 10.5,
    color: '#64748b',
  },
  xActionBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginHorizontal: -16,
    marginBottom: -16,
    marginTop: 2,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#fcfdff',
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  xActionBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  xActionBtnActive: {
    backgroundColor: '#ecfdf5',
    borderRadius: 16,
    paddingHorizontal: 8,
  },
  xActionCounter: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '700',
  },
  xActionViews: {
    fontSize: 11,
    color: '#94a3b8',
  },
  xThreadContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1.5,
    borderTopColor: '#e2e8f0',
  },
  xThreadHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  xThreadCloseBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  xThreadCloseText: {
    fontSize: 11,
    color: '#047857',
    fontWeight: '700',
  },
  xThreadTitleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
  },
  xThreadTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
  },
  xAnswersList: {
    gap: 8,
  },
  xAnswerItem: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 8,
  },
  xThreadLine: {
    position: 'absolute',
    right: 17,
    top: 36,
    width: 1.5,
    height: '100%',
    backgroundColor: '#e2e8f0',
  },
  xAnswerAvatarWrap: {
    width: 34,
    height: 34,
  },
  xAnswerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  xAnswerAvatarFallback: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  xAnswerAvatarLetter: {
    fontSize: 13,
    fontWeight: '800',
    color: '#475569',
  },
  xAnswerBubble: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#edf2f7',
  },
  xAnswerBubbleAccepted: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1.5,
    borderColor: '#86efac',
  },
  xAnswerHeaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  xAnswerAuthorName: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
  },
  xAnswerTime: {
    fontSize: 10,
    color: '#94a3b8',
  },
  xAcceptedBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#047857',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  xAcceptedBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#fff',
  },
  xAnswerBodyText: {
    fontSize: 13,
    color: '#1e293b',
    textAlign: 'right',
    lineHeight: 19,
  },
  xNoAnswersBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
  },
  xNoAnswersText: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
  },
  xMoreRepliesCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 14,
    padding: 12,
    marginTop: 8,
  },
  xMoreRepliesPill: {
    backgroundColor: '#047857',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  xMoreRepliesPillText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  xMoreRepliesCardText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: '#065f46',
    textAlign: 'right',
    marginHorizontal: 8,
  },
  xQuickReplyContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  xGuestReplyPrompt: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#ecfdf5',
  },
  xGuestReplyText: {
    color: '#047857',
    fontSize: 13,
    fontWeight: '800',
  },
  xQuickReplyAvatar: {
    width: 32,
    height: 32,
  },
  xMiniAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  xMiniAvatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#047857',
    alignItems: 'center',
    justifyContent: 'center',
  },
  xMiniAvatarLetter: {
    fontSize: 13,
    fontWeight: '800',
    color: '#fff',
  },
  xQuickReplyInput: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0f172a',
    textAlign: 'right',
    minHeight: 38,
    maxHeight: 80,
  },
  xQuickReplySendBtn: {
    backgroundColor: '#047857',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
  },
  xQuickReplySendBtnDisabled: {
    backgroundColor: '#cbd5e1',
  },
  xQuickReplySendText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  xOpenFullThreadBtn: {
    marginTop: 12,
    borderRadius: 14,
    overflow: 'hidden',
  },
  xOpenFullThreadGrad: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  xOpenFullThreadText: {
    fontSize: 12.5,
    color: '#fff',
    fontWeight: '800',
  },
});
