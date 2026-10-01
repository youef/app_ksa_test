import { useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  Platform,
  Share,
} from 'react-native';
import { router } from 'expo-router';
import {
  MessageCircle,
  MapPin,
  Flame,
  Heart,
  Share2,
  MoreHorizontal,
  User,
  ChevronUp,
  Wrench,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Bookmark,
  Send,
  Eye,
  Check,
  Sparkles,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

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
  isMine?: boolean;
  onQuickReply: (id: string, text: string) => Promise<void>;
  onToast: (msg: string) => void;
}

export default function TwitterInquiryCard({
  type, data, currentUserProfile, currentUserId, isMine, onQuickReply, onToast,
}: TwitterInquiryCardProps) {
  const isReq = type === 'request';
  const name = data.profiles?.hide_name ? 'جار مجهول 🕶️' : (data.profiles?.display_name || data.profiles?.username || 'ابن الحي');
  const username = data.profiles?.username || 'neighbor';
  const avatar = data.profiles?.avatar_url;
  const isVerifiedNeighbor = data.profiles?.is_geoverified;
  const isIdVerified = data.profiles?.is_verified;
  const isEmergency = data.is_emergency || data.urgency_level === 'emergency' || (data.title && (data.title.includes('مفقود') || data.title.includes('طارئ')));
  const isToolSharing = data.is_tool_sharing || data.item_type === 'tool_sharing' || (data.title && (data.title.includes('إعارة') || data.title.includes('دريل')));

  const [expanded, setExpanded] = useState(false);
  const [quickReplyText, setQuickReplyText] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(Math.floor(Math.random() * 6) + 3);
  const [bookmarked, setBookmarked] = useState(false);
  const [viewsCount] = useState(Math.floor(Math.random() * 85) + 65);

  const answers = data.answers || [];
  const answersCount = data.answers_count !== undefined ? data.answers_count : answers.length;

  function handleLike() {
    if (!liked) { setLiked(true); setLikeCount(p => p + 1); onToast('أعجبك الاستفسار ❤️'); }
    else { setLiked(false); setLikeCount(p => p - 1); }
  }

  async function handleBookmark() {
    const next = !bookmarked;
    setBookmarked(next);
    if (next) {
      onToast('تم حفظ الاستفسار في منشوراتي المحفوظة 🔖');
      if (currentUserId && type === 'question')
        supabase.from('saved_questions').upsert({ user_id: currentUserId, question_id: data.id }, { onConflict: 'user_id,question_id' }).then(() => {});
    } else {
      onToast('تمت إزالة الاستفسار من المحفوظات');
      if (currentUserId && type === 'question')
        supabase.from('saved_questions').delete().eq('user_id', currentUserId).eq('question_id', data.id).then(() => {});
    }
  }

  async function handleShare() {
    const pageUrl = (Platform.OS === 'web' && typeof window !== 'undefined')
      ? `${(window as any).location.origin}/question?id=${data.id}`
      : `https://appksa-main.vercel.app/question?id=${data.id}`;
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && (navigator as any).clipboard) {
      try { await (navigator as any).clipboard.writeText(pageUrl); onToast('تم نسخ رابط الاستفسار 🔗'); return; } catch {}
    }
    try { await Share.share({ title: data.title, message: `${data.title}\n${pageUrl}`, url: pageUrl }); }
    catch { onToast('تم نسخ الرابط'); }
  }

  function handleMoreOptions() {
    Alert.alert('خيارات الاستفسار', data.title, [
      { text: 'نسخ رابط المنشور', onPress: handleShare },
      { text: 'كتم إشعارات هذا المنشور', onPress: () => onToast('تم كتم الإشعارات 🔕') },
      { text: 'إبلاغ عن محتوى غير لائق', onPress: () => router.push({ pathname: '/report', params: { id: data.id, type: isReq ? 'request' : 'question' } }), style: 'destructive' },
      { text: 'إلغاء', style: 'cancel' },
    ]);
  }

  async function handleSendReply() {
    if (!quickReplyText.trim()) return;
    setReplyLoading(true);
    try { await onQuickReply(data.id, quickReplyText); setQuickReplyText(''); }
    catch (err: any) { Alert.alert('خطأ', err?.message || 'تعذر إرسال الرد'); }
    finally { setReplyLoading(false); }
  }

  function navigateToDetails() {
    if (isReq) router.push({ pathname: '/request', params: { id: data.id } });
    else router.push({ pathname: '/question', params: { id: data.id } });
  }

  return (
    <View style={[s.xCard, isEmergency && s.xCardEmergency, isToolSharing && s.xCardToolSharing]}>
      <View style={s.xHeader}>
        <Pressable onPress={() => data.profiles?.id && router.push({ pathname: '/user', params: { id: data.profiles.id } })} style={s.xAvatarWrap}>
          {avatar ? <Image source={{ uri: avatar }} style={s.xAvatarImg} /> : (
            <View style={[s.xAvatarFallback, isEmergency && { backgroundColor: '#dc2626' }]}>
              <User size={20} color="#fff" />
            </View>
          )}
          {isVerifiedNeighbor && <View style={s.xGeoBadge}><ShieldCheck size={9} color="#fff" /></View>}
        </Pressable>
        <View style={s.xAuthorMeta}>
          <View style={s.xAuthorRow}>
            {isEmergency ? (
              <View style={s.xEmergencyBadge}><Flame size={11} color="#dc2626" /><Text style={s.xEmergencyBadgeText}>عاجل</Text></View>
            ) : isToolSharing ? (
              <View style={s.xToolBadge}><Wrench size={11} color="#16a34a" /><Text style={s.xToolBadgeText}>إعارة</Text></View>
            ) : isReq ? (
              <View style={s.xReqBadge}><Text style={s.xReqBadgeText}>فزعة</Text></View>
            ) : (
              <View style={s.xCategoryBadge}><Text style={s.xCategoryBadgeText}>استفسار</Text></View>
            )}
            <Text style={s.xTimeAgo}>{formatArabicTimeAgo(data.created_at)}</Text>
            <Text style={s.xDot}>·</Text>
            <Text style={s.xHandle} numberOfLines={1}>@{username}</Text>
            {isIdVerified && <CheckCircle2 size={13} color="#059669" />}
            <Pressable onPress={() => data.profiles?.id && router.push({ pathname: '/user', params: { id: data.profiles.id } })}>
              <Text style={s.xAuthorName} numberOfLines={1}>{name}</Text>
            </Pressable>
          </View>
          <View style={s.xLocationRow}>
            <MapPin size={11} color="#059669" />
            <Text style={s.xLocationText}>
              {data.district ? `حي ${data.district}` : 'الحي'}{data.city ? ` · ${data.city}` : ''}
            </Text>
          </View>
        </View>
        <Pressable onPress={handleMoreOptions} style={s.xMoreBtn}>
          <MoreHorizontal size={18} color="#94a3b8" />
        </Pressable>
      </View>

      <Pressable onPress={() => setExpanded(!expanded)} style={s.xContentArea}>
        <Text style={[s.xTitle, isEmergency && { color: '#991b1b' }]}>{data.title}</Text>
        {(data.body || data.description) && (
          <Text style={s.xBodyText} numberOfLines={expanded ? undefined : 3}>
            {isReq ? data.description : data.body}
          </Text>
        )}
        <View style={s.xHashtagRow}>
          {data.district && <View style={s.xHashPill}><Text style={s.xHashText}>#{data.district.replace(/\s+/g, '_')}</Text></View>}
          <View style={s.xHashPill}><Text style={s.xHashText}>#أهل_الحي</Text></View>
          {isToolSharing && <View style={[s.xHashPill, { backgroundColor: '#f0fdf4' }]}><Text style={[s.xHashText, { color: '#16a34a' }]}>#إعارة_مجانية</Text></View>}
        </View>
      </Pressable>

      <View style={s.xActionBar}>
        <Pressable style={[s.xActionBtn, expanded && s.xActionBtnActive]} onPress={() => setExpanded(!expanded)}>
          <MessageCircle size={17} color={expanded ? '#059669' : '#64748b'} />
          <Text style={[s.xActionCounter, expanded && { color: '#059669', fontWeight: '800' }]}>{answersCount}</Text>
        </Pressable>
        <Pressable style={s.xActionBtn} onPress={handleLike}>
          <Heart size={17} color={liked ? '#f43f5e' : '#64748b'} fill={liked ? '#f43f5e' : 'none'} />
          <Text style={[s.xActionCounter, liked && { color: '#f43f5e', fontWeight: '800' }]}>{likeCount}</Text>
        </Pressable>
        <Pressable style={s.xActionBtn} onPress={handleBookmark}>
          <Bookmark size={17} color={bookmarked ? '#f59e0b' : '#64748b'} fill={bookmarked ? '#f59e0b' : 'none'} />
          {bookmarked && <Text style={[s.xActionCounter, { color: '#f59e0b', fontSize: 10 }]}>محفوظ</Text>}
        </Pressable>
        <Pressable style={s.xActionBtn} onPress={handleShare}>
          <Share2 size={17} color="#64748b" />
        </Pressable>
        <View style={s.xActionBtn}>
          <Eye size={16} color="#94a3b8" />
          <Text style={s.xActionViews}>{viewsCount}</Text>
        </View>
      </View>

      {expanded && (
        <View style={s.xThreadContainer}>
          <View style={s.xThreadHeader}>
            <Pressable onPress={() => setExpanded(false)} style={s.xThreadCloseBtn}>
              <ChevronUp size={14} color="#059669" />
              <Text style={s.xThreadCloseText}>طي التفاصيل</Text>
            </Pressable>
            <View style={s.xThreadTitleRow}>
              <Text style={s.xThreadTitle}>خيط الردود والتوصيات ({answersCount})</Text>
              <Sparkles size={14} color="#059669" />
            </View>
          </View>

          {answers.length > 0 ? (
            <View style={s.xAnswersList}>
              {answers.map((ans: any, idx: number) => {
                const ansName = ans.profiles?.hide_name ? 'جار مجهول 🕶️' : (ans.profiles?.display_name || ans.profiles?.username || 'ابن الحي');
                const ansAvatar = ans.profiles?.avatar_url;
                const isAccepted = ans.is_accepted || idx === 0;
                return (
                  <View key={ans.id || idx} style={s.xAnswerItem}>
                    <View style={s.xThreadLine} />
                    <View style={s.xAnswerAvatarWrap}>
                      {ansAvatar ? <Image source={{ uri: ansAvatar }} style={s.xAnswerAvatar} /> : (
                        <View style={s.xAnswerAvatarFallback}><Text style={s.xAnswerAvatarLetter}>{ansName[0]}</Text></View>
                      )}
                    </View>
                    <View style={[s.xAnswerBubble, isAccepted && s.xAnswerBubbleAccepted]}>
                      <View style={s.xAnswerHeaderRow}>
                        <Text style={s.xAnswerTime}>{formatArabicTimeAgo(ans.created_at)}</Text>
                        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 5 }}>
                          <Text style={s.xAnswerAuthorName}>{ansName}</Text>
                          {ans.profiles?.is_geoverified && <ShieldCheck size={11} color="#16a34a" />}
                          {isAccepted && (
                            <View style={s.xAcceptedBadge}>
                              <Check size={10} color="#fff" />
                              <Text style={s.xAcceptedBadgeText}>توصية معتمدة</Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <Text style={s.xAnswerBodyText}>{ans.body}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={s.xNoAnswersBox}>
              <Text style={s.xNoAnswersText}>كن أول من يفيد جارك! 💡</Text>
            </View>
          )}

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
              placeholder="اكتب إجابتك للجار..."
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

          <Pressable style={s.xOpenFullThreadBtn} onPress={navigateToDetails}>
            <Text style={s.xOpenFullThreadText}>
              {isReq ? 'فتح صفحة طلب الفزعة ←' : 'فتح صفحة الاستفسار الكاملة ←'}
            </Text>
            <ExternalLink size={14} color="#059669" />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  xCard: { backgroundColor: '#fff', borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  xCardEmergency: { borderColor: '#fca5a5', backgroundColor: '#fffafa' },
  xCardToolSharing: { borderColor: '#bbf7d0', backgroundColor: '#f0fdf4' },
  xHeader: { flexDirection: 'row-reverse', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 },
  xAvatarWrap: { position: 'relative', marginLeft: 10 },
  xAvatarImg: { width: 44, height: 44, borderRadius: 22 },
  xAvatarFallback: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center' },
  xGeoBadge: { position: 'absolute', bottom: -2, right: -2, width: 16, height: 16, borderRadius: 8, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#fff' },
  xAuthorMeta: { flex: 1, alignItems: 'flex-end', gap: 3 },
  xAuthorRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  xAuthorName: { fontSize: 14, fontWeight: '900', color: '#0f172a' },
  xHandle: { fontSize: 11, color: '#94a3b8', maxWidth: 80 },
  xDot: { color: '#cbd5e1', fontSize: 14 },
  xTimeAgo: { fontSize: 11, color: '#94a3b8' },
  xMoreBtn: { padding: 6 },
  xEmergencyBadge: { flexDirection: 'row-reverse', alignItems: 'center', gap: 3, backgroundColor: '#fee2e2', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  xEmergencyBadgeText: { fontSize: 10, fontWeight: '800', color: '#dc2626' },
  xToolBadge: { flexDirection: 'row-reverse', alignItems: 'center', gap: 3, backgroundColor: '#dcfce7', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  xToolBadgeText: { fontSize: 10, fontWeight: '800', color: '#16a34a' },
  xReqBadge: { backgroundColor: '#fef3c7', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  xReqBadgeText: { fontSize: 10, fontWeight: '800', color: '#d97706' },
  xCategoryBadge: { backgroundColor: '#ecfdf5', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  xCategoryBadgeText: { fontSize: 10, fontWeight: '800', color: '#059669' },
  xLocationRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 3 },
  xLocationText: { fontSize: 11, color: '#059669', fontWeight: '600' },
  xContentArea: { marginBottom: 10 },
  xTitle: { fontSize: 15, fontWeight: '800', color: '#0f172a', textAlign: 'right', lineHeight: 22, marginBottom: 6 },
  xBodyText: { fontSize: 13, color: '#475569', textAlign: 'right', lineHeight: 20, marginBottom: 8 },
  xHashtagRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 6 },
  xHashPill: { backgroundColor: '#f1f5f9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  xHashText: { fontSize: 11, color: '#64748b', fontWeight: '600' },
  xActionBar: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  xActionBtn: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, padding: 6 },
  xActionBtnActive: { backgroundColor: '#ecfdf5', borderRadius: 20 },
  xActionCounter: { fontSize: 12, color: '#64748b', fontWeight: '700' },
  xActionViews: { fontSize: 11, color: '#94a3b8' },
  xThreadContainer: { marginTop: 12, paddingTop: 12, borderTopWidth: 1.5, borderTopColor: '#e2e8f0' },
  xThreadHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  xThreadCloseBtn: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, backgroundColor: '#ecfdf5', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12 },
  xThreadCloseText: { fontSize: 11, color: '#059669', fontWeight: '700' },
  xThreadTitleRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5 },
  xThreadTitle: { fontSize: 13, fontWeight: '800', color: '#334155' },
  xAnswersList: { gap: 8 },
  xAnswerItem: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 8 },
  xThreadLine: { position: 'absolute', right: 17, top: 36, width: 1.5, height: '100%', backgroundColor: '#e2e8f0' },
  xAnswerAvatarWrap: { width: 34, height: 34 },
  xAnswerAvatar: { width: 34, height: 34, borderRadius: 17 },
  xAnswerAvatarFallback: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  xAnswerAvatarLetter: { fontSize: 13, fontWeight: '800', color: '#475569' },
  xAnswerBubble: { flex: 1, backgroundColor: '#f8fafc', borderRadius: 14, padding: 10 },
  xAnswerBubbleAccepted: { backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0' },
  xAnswerHeaderRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  xAnswerAuthorName: { fontSize: 12, fontWeight: '800', color: '#334155' },
  xAnswerTime: { fontSize: 10, color: '#94a3b8' },
  xAcceptedBadge: { flexDirection: 'row-reverse', alignItems: 'center', gap: 3, backgroundColor: '#059669', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  xAcceptedBadgeText: { fontSize: 9, fontWeight: '800', color: '#fff' },
  xAnswerBodyText: { fontSize: 13, color: '#1e293b', textAlign: 'right', lineHeight: 19 },
  xNoAnswersBox: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 14, alignItems: 'center' },
  xNoAnswersText: { fontSize: 12, color: '#94a3b8', textAlign: 'center' },
  xQuickReplyContainer: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  xQuickReplyAvatar: { width: 32, height: 32 },
  xMiniAvatar: { width: 32, height: 32, borderRadius: 16 },
  xMiniAvatarFallback: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#059669', alignItems: 'center', justifyContent: 'center' },
  xMiniAvatarLetter: { fontSize: 13, fontWeight: '800', color: '#fff' },
  xQuickReplyInput: { flex: 1, backgroundColor: '#f1f5f9', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, color: '#0f172a', textAlign: 'right', minHeight: 38, maxHeight: 80 },
  xQuickReplySendBtn: { backgroundColor: '#059669', flexDirection: 'row-reverse', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14 },
  xQuickReplySendBtnDisabled: { backgroundColor: '#cbd5e1' },
  xQuickReplySendText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  xOpenFullThreadBtn: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, marginTop: 10, justifyContent: 'flex-end' },
  xOpenFullThreadText: { fontSize: 12, color: '#059669', fontWeight: '700' },
});
