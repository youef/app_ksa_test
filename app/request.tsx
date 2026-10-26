import { OasisPressable as Pressable, OasisTextInput as TextInput, OasisSurface } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import { HeaderAction } from '@/components/shared/AppHeader';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View, ActivityIndicator, Platform, Image, Modal, Share, KeyboardAvoidingView } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { sendPushToUser } from '@/lib/pushSender';
import {
  MapPin,
  HeartHandshake,
  Banknote,
  CheckCircle2,
  Trash2,
  Flag,
  User,
  MessageSquare,
  Clock,
  ShieldCheck,
  Flame,
  Check,
  Send,
  Info,
  Coffee,
  Sparkles,
  X,
  ChevronLeft,
  Share2,
  Car,
  GraduationCap,
  Wrench,
  Eye,
  ArrowRight,
  ShieldAlert,
  Pencil,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import TwitterInquiryCard from '@/components/TwitterInquiryCard';
import { useDynamicIsland } from '@/context/DynamicIslandContext';
import { AppHeader } from '@/components/shared/AppHeader';
import { requireAccount } from '@/lib/authGate';
import { getActiveLocation } from '@/lib/locationSync';
import { areaLabel } from '@/lib/privacy';
import { getCurrentDeviceLocation, reverseGeocodeDeviceLocation } from '@/lib/deviceLocation';
import { relativeTime } from '@/lib/mapPins';
import { useBottomNavInset } from '@/lib/bottomNav';

// Auto-generated "اقتراح تلقائي" offers are produced by a server-side matcher and
// must never be treated as real neighbour offers. Only a genuine authenticated user
// who deliberately sends an offer counts (see migration 202610080001).
const AUTO_SUGGESTION_MARKERS = ['اقتراح تلقائي', 'اقتراح تلقائى'];
function isAutoSuggestedOffer(match: any): boolean {
  const msg = typeof match?.message === 'string' ? match.message.trim() : '';
  if (!msg) return false;
  return AUTO_SUGGESTION_MARKERS.some(marker => msg.startsWith(marker));
}

function getRequestTypeInfo(type?: string) {
  switch (type) {
    case 'carpooling':
      return { label: 'توصيل المدارس', icon: GraduationCap, bg: '#ECFDF5', color: '#047857', border: '#A7F3D0' };
    case 'delivery':
      return { label: 'توصيل مشوار أو غرض', icon: Car, bg: OASIS.colors.infoSoft, color: '#2563eb', border: '#bfdbfe' };
    case 'tools':
      return { label: 'إعارة واستعارة أداة', icon: Wrench, bg: '#fff7ed', color: '#ea580c', border: '#fed7aa' };
    case 'home':
    case 'maintenance':
      return { label: 'مساعدة وصيانة بالحي', icon: Wrench, bg: OASIS.colors.soft, color: OASIS.colors.primary, border: '#bbf7d0' };
    case 'volunteer':
      return { label: 'فزعة وتطوع خيري', icon: HeartHandshake, bg: '#fdf2f8', color: '#db2777', border: '#fbcfe8' };
    default:
      return { label: type || 'طلب فزعة عامة', icon: HeartHandshake, bg: OASIS.colors.soft, color: OASIS.colors.primary, border: '#a7f3d0' };
  }
}

const QUICK_REPLY_TEMPLATES = [
  'أقدر أساعدك اليوم إن شاء الله 🤝',
  'أنا قريب بالحي وأقدر أمرك 🚗',
  'الأداة متوفرة عندي وتفضل استعرها 🛠️',
  'أنا بالخدمة وجاهز، تواصل معي 💬',
];

const COMPLETION_TEMPLATES = [
  'بيض الله وجهك على الفزعة الكريمة 🤍',
  'تسلم وما قصرت، يعطيك ألف عافية يا جارنا 🤝',
  'شكراً لحسن تعاملك وسرعة استجابتك ⭐',
  'قهوتك واصلة، فزعة في ميزان حسناتك ☕',
];

export default function Request() {
  const bottomNavInset = useBottomNavInset();
  const { showIsland } = useDynamicIsland();
  const [viewerProfile, setViewerProfile] = useState<any>(null);
  const { id } = useLocalSearchParams<{ id: string }>();
  const [request, setRequest] = useState<any>(null);
  const [requester, setRequester] = useState<any>(null);
  const [offers, setOffers] = useState<any[]>([]);
  const [autoSuggestedCount, setAutoSuggestedCount] = useState(0);
  const [message, setMessage] = useState('');
  const [me, setMe] = useState('');
  const [loading, setLoading] = useState(true);
  const [submittingOffer, setSubmittingOffer] = useState(false);
  const [sharingLocation, setSharingLocation] = useState(false);
  const [convId, setConvId] = useState('');
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<any>(null);
  const [completeNote, setCompleteNote] = useState('بيض الله وجهك على الفزعة الكريمة 🤍');
  const [completingRequest, setCompletingRequest] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingRequest, setDeletingRequest] = useState(false);

  async function load() {
    if (!id) return;
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getSession();
      const user = auth.session?.user ?? null;
      setMe(user?.id || '');
      const viewer = user ? await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle() : { data: null };
      setViewerProfile(viewer.data);

      const requestPromise = user
        ? supabase.from('requests').select('*').eq('id', id).maybeSingle()
        : getActiveLocation().then(location => supabase.rpc('hayna_guest_request', {
            p_id: id,
            p_city: location.city,
            p_district: location.district,
          }));

      const [requestResult, oData] = await Promise.all([
        requestPromise,
        supabase
          .from('help_matches')
          .select('id, helper_id, message, status, created_at, profiles:helper_id(id, display_name, username, avatar_url, is_verified, is_geoverified, district, city)')
          .eq('request_id', id)
          .order('created_at', { ascending: false }),
      ]);

      const requestData = Array.isArray(requestResult.data) ? requestResult.data[0] : requestResult.data;
      setRequest(requestData || null);
      if (requestData) {

        if (requestData.requester_id) {
          const { data: p } = await supabase
            .from('profiles')
            .select('id, display_name, username, avatar_url, is_verified, is_geoverified, city, district, badges')
            .eq('id', requestData.requester_id)
            .single();
          setRequester(p);
        }
      }

      // Only real neighbour offers are shown. Auto-generated matcher rows are ignored.
      const allMatches = oData.data ?? [];
      const realOffers = allMatches.filter((o: any) => !isAutoSuggestedOffer(o));
      setAutoSuggestedCount(allMatches.length - realOffers.length);
      setOffers(realOffers);

      const { data: conv } = await supabase
        .from('conversations')
        .select('id')
        .eq('request_id', id)
        .order('created_at', { ascending: false })
        .limit(1);
      setConvId(conv?.[0]?.id || '');
    } catch (e) {
      console.warn('Load request error', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  const handleShare = async () => {
    const shareUrl = typeof window !== 'undefined' ? window.location.href : `https://hayna.app/request?id=${id}`;
    const shareText = `طلب فزعة في حي ${request?.district || 'الحي'}: «${request?.title || 'طلب مساعدة'}» عبر منصة حيّنا\n${shareUrl}`;

    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareText);
        Alert.alert('تم نسخ الرابط 📋', 'تم نسخ رابط الطلب بنجاح، يمكنك مشاركته مع جيرانك في مجموعات الواتساب.');
        return;
      } catch {}
    }

    try {
      await Share.share({
        message: shareText,
        url: shareUrl,
        title: request?.title || 'طلب فزعة في حيّنا',
      });
    } catch {}
  };

  async function sendOffer() {
    if (!me) return requireAccount('سجّل الدخول أو أنشئ حساباً لتقديم المساعدة.');
    if (me === request?.requester_id) return Alert.alert('تنبيه', 'أنت صاحب هذا الطلب.');

    setSubmittingOffer(true);
    try {
      const r = await supabase.from('help_matches').insert({
        request_id: id,
        helper_id: me,
        message: message.trim() || 'أقدر أساعدك في هذا الطلب 🤝',
        status: 'proposed',
      });

      if (r.error) {
        Alert.alert('خطأ', r.error.message);
      } else {
        setMessage('');
        Alert.alert('تم إرسال عرضك بنجاح! 🤝', 'تم إشعار صاحب الطلب، وبإمكانه قبول عرضك لبدء المحادثة.');
        load();
      }
    } catch (e: any) {
      Alert.alert('خطأ', e.message || 'تعذر إرسال العرض');
    } finally {
      setSubmittingOffer(false);
    }
  }

  async function acceptOffer(match: any) {
    if (me !== request?.requester_id) return;

    try {
      // 1. Update request to 'accepted' and current match to 'accepted'
      await supabase.from('requests').update({ accepted_by: match.helper_id, status: 'accepted' }).eq('id', id);
      await supabase.from('help_matches').update({ status: 'accepted' }).eq('id', match.id);

      // 2. Decline other pending matches so the request is exclusively handled
      try {
        await supabase
          .from('help_matches')
          .update({ status: 'declined' })
          .eq('request_id', id)
          .neq('id', match.id);
      } catch {}

      // 3. Resolve or create direct conversation with the helper
      let finalConvId: string | null = null;

      // Step A: Check existing direct conversation via conversation_members
      try {
        const { data: myMemberships } = await supabase
          .from('conversation_members')
          .select('conversation_id')
          .eq('user_id', me);

        if (myMemberships && myMemberships.length > 0) {
          const myConvIds = myMemberships.map((m: any) => m.conversation_id);
          const { data: partnerMatch } = await supabase
            .from('conversation_members')
            .select('conversation_id')
            .in('conversation_id', myConvIds)
            .eq('user_id', match.helper_id)
            .limit(1)
            .maybeSingle();

          if (partnerMatch?.conversation_id) {
            finalConvId = partnerMatch.conversation_id;
          }
        }
      } catch {}

      // Step B: Try RPC if not found
      if (!finalConvId) {
        try {
          const { data: rpcConvId, error: convError } = await supabase.rpc(
            'hayna_get_or_create_direct_conversation',
            { p_target: match.helper_id },
          );
          if (!convError && rpcConvId) {
            finalConvId = rpcConvId;
          }
        } catch {}
      }

      // Membership is created atomically by the protected server RPC.
      if (!finalConvId) throw new Error('تعذر إنشاء محادثة آمنة. تحقق من إعدادات الرسائل ثم حاول مجددًا.');

      // Step D: Send message directly in private chat to the helper
      if (finalConvId) {
        const welcomeMessage = `أهلاً بك يا جارنا العزيز! 🤝\nتم قبول عرض مساعدتك بخصوص: «${request.title}».\nشكراً لك، وبإمكاننا ترتيب موعد وتفاصيل الفزعة هنا في الخاص.`;

        let { error: msgErr } = await supabase.from('messages').insert({
          conversation_id: finalConvId,
          sender_id: me,
          body: welcomeMessage,
          read_by: [me],
        });

        if (msgErr) {
          await supabase.from('messages').insert({
            conversation_id: finalConvId,
            sender_id: me,
            body: welcomeMessage,
          });
        }

        // Notify helper
        try {
          await supabase.from('notifications').insert({
            user_id: match.helper_id,
            type: 'request',
            title: '🎉 تم قبول عرضك للفزعة!',
            body: `قبل جارك عرضك بخصوص: «${(request.title || '').slice(0, 40)}»، وتم فتح المحادثة الخاصة للاتفاق.`,
            target_type: 'conversation',
            target_id: finalConvId,
          });

          if (match.helper_id) {
            void sendPushToUser(match.helper_id, {
              title: '🎉 تم قبول عرضك للفزعة!',
              body: `قبل جارك عرضك بخصوص: «${(request.title || '').slice(0, 40)}»، اضغط للاتفاق بالخاص.`,
              data: { url: `/conversation?id=${finalConvId}` },
            });
          }
        } catch {}

        Alert.alert('تم قبول العرض! 🎉', 'تم إرسال رسالة ترحيبية للجار بالخاص وتحويلك للمحادثة.');
        router.push({ pathname: '/conversation', params: { id: finalConvId } });
      } else {
        router.push('/messages');
      }

      load();
    } catch (e: any) {
      console.warn('acceptOffer error:', e);
      router.push('/messages');
    }
  }

  async function shareExactLocation() {
    if (sharingLocation || !me) return;
    if (!convId) return Alert.alert('لا توجد محادثة', 'اقبل عرض المساعدة أولاً لتتمكن من إرسال موقعك بالخاص.');

    setSharingLocation(true);
    try {
      const location = await getCurrentDeviceLocation();
      if (!location) {
        Alert.alert('تعذّر تحديد الموقع', 'اسمح للتطبيق بالوصول إلى الموقع ثم أعد المحاولة.');
        return;
      }
      const place = await reverseGeocodeDeviceLocation(location);
      const label = place?.district || place?.city || 'موقعي الحالي';
      const { error } = await supabase.from('messages').insert({
        conversation_id: convId,
        sender_id: me,
        body: JSON.stringify({ type: 'location', lat: location.latitude, lng: location.longitude, label }),
        read_by: [me],
      });
      if (error) throw error;
      router.push({ pathname: '/conversation', params: { id: convId } });
    } catch (e: any) {
      Alert.alert('تعذّر إرسال الموقع', e?.message || 'حدث خطأ أثناء إرسال الموقع');
    } finally {
      setSharingLocation(false);
    }
  }

  function openCompletionModal(match: any) {
    setSelectedMatch(match);
    setCompleteNote('بيض الله وجهك على الفزعة الكريمة 🤍');
    setCompleteModalOpen(true);
  }

  async function completeRequestWithCoffee(matchToComplete?: any, noteToSend?: string) {
    const targetMatch = matchToComplete || selectedMatch;
    if (!targetMatch || completingRequest) return;
    if (me !== request?.requester_id) return;

    setCompletingRequest(true);
    const finalNote = (noteToSend || completeNote || 'بيض الله وجهك على الفزعة الكريمة 🤍').trim();
    const helperId = targetMatch.helper_id;
    const helperName = targetMatch.profiles?.display_name || targetMatch.profiles?.username || 'جارك';

    try {
      // 1. Try RPC function
      const { data: _rpcRes, error: rpcErr } = await supabase.rpc('complete_neighbor_request', {
        p_request_id: id,
        p_helper_id: helperId,
        p_note: finalNote,
      });

      if (rpcErr) {
        // Fallback: direct update
        await supabase.from('requests').update({
          status: 'completed',
          accepted_by: helperId,
        }).eq('id', id);

        await supabase.from('help_matches').update({
          status: 'completed',
        }).eq('id', targetMatch.id);

        // If conversation exists, post appreciation card
        if (convId) {
          try {
            await supabase.from('messages').insert({
              conversation_id: convId,
              sender_id: me,
              body: JSON.stringify({
                type: 'appreciation',
                title: '☕ تمت الفزعة بنجاح! بطاقة شكر وقهوة',
                note: finalNote,
                points: 15,
                giver_name: requester?.display_name || 'جارك',
                request_id: id,
              }),
              read_by: [me],
            });
          } catch {}
        }

        // Award reputation to helper
        try {
          const { data: curRep } = await supabase
            .from('reputation')
            .select('points')
            .eq('user_id', helperId)
            .maybeSingle();
          const nextPts = (curRep?.points || 0) + 15;
          await supabase.from('reputation').upsert({
            user_id: helperId,
            points: nextPts,
            updated_at: new Date().toISOString(),
          });
        } catch {}

        // Award small reputation bonus to requester (+5)
        try {
          const { data: curRepMe } = await supabase
            .from('reputation')
            .select('points')
            .eq('user_id', me)
            .maybeSingle();
          const nextPtsMe = (curRepMe?.points || 0) + 5;
          await supabase.from('reputation').upsert({
            user_id: me,
            points: nextPtsMe,
            updated_at: new Date().toISOString(),
          });
        } catch {}
      }

      setCompleteModalOpen(false);
      Alert.alert(
        'تم إتمام الفزعة بنجاح! 🎉☕',
        `بيض الله وجهك ووجه ${helperName}! تم إهداء القهوة ومنح +15 نقطة سمعة للفازع تقديراً لتعاونه.`
      );
      load();
    } catch (e: any) {
      Alert.alert('خطأ', e?.message || 'تعذر إتمام الطلب');
    } finally {
      setCompletingRequest(false);
    }
  }

  async function deleteRequest() {
    if (me !== request?.requester_id) return;
    Alert.alert('تأكيد الحذف', 'هل أنت متأكد من حذف هذا الطلب؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          const r = await supabase.from('requests').delete().eq('id', id);
          if (r.error) Alert.alert('خطأ', r.error.message);
          else {
            Alert.alert('تم', 'تم حذف الطلب.');
            router.back();
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={OASIS.colors.primary} />
        <Text style={styles.loadingText}>جاري تحميل تفاصيل الفزعة...</Text>
      </View>
    );
  }

  if (!request) {
    return (
      <View style={styles.center}>
        <ShieldAlert size={48} color="#94a3b8" />
        <Text style={styles.errorText}>الطلب غير موجود أو تمت إزالته.</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtnAction}>
          <Text style={styles.backBtnActionText}>العودة للطلبات</Text>
        </Pressable>
      </View>
    );
  }

  const isOwner = me === request.requester_id;
  const MAX_EDITS = 2;
  const editCount = request?.edit_count || 0;
  const editsRemaining = Math.max(0, MAX_EDITS - editCount);

  function handleOpenEdit() {
    if (editsRemaining <= 0) {
      Alert.alert(
        'استنفاد محاولات التعديل ⚠️',
        'تم استنفاد الحد الأقصى المسموح للتعديل (محاولتان فقط) حفاظاً على مصداقية وسياق الطلبات في الحي.'
      );
      return;
    }
    setEditTitle(request?.title || '');
    setEditDescription(request?.description || '');
    setEditNotes(request?.notes || '');
    setIsEditModalOpen(true);
  }

  async function handleSaveEdit() {
    if (!editTitle.trim()) {
      return Alert.alert('بيانات ناقصة', 'يرجى كتابة عنوان الطلب.');
    }
    if (!editDescription.trim()) {
      return Alert.alert('بيانات ناقصة', 'يرجى كتابة تفاصيل الطلب.');
    }
    if (editsRemaining <= 0) {
      return Alert.alert('تنبيه', 'تم استنفاد الحد الأقصى للتعديل.');
    }

    setSavingEdit(true);
    try {
      const nextEditCount = editCount + 1;
      const { error } = await supabase
        .from('requests')
        .update({
          title: editTitle.trim(),
          description: editDescription.trim(),
          notes: editNotes.trim() || null,
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
      Alert.alert('خطأ', err?.message || 'تعذر تعديل الطلب.');
    } finally {
      setSavingEdit(false);
    }
  }

  function handleDeleteRequest() {
    Alert.alert(
      'حذف طلب الفزعة نهائياً ⚠️',
      'هل أنت متأكد من رغبتك في حذف هذا الطلب وعروض المساعدة المرتبطة به؟ لا يمكن التراجع عن هذا الإجراء.',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف نهائي',
          style: 'destructive',
          onPress: async () => {
            setDeletingRequest(true);
            try {
              await supabase.from('help_matches').delete().eq('request_id', id);
              const { error } = await supabase.from('requests').delete().eq('id', id);
              if (error) throw error;

              Alert.alert('تم الحذف', 'تم حذف طلب الفزعة بنجاح.', [
                { text: 'حسناً', onPress: () => router.replace('/requests') },
              ]);
            } catch (err: any) {
              Alert.alert('خطأ', err?.message || 'تعذر حذف الطلب.');
              setDeletingRequest(false);
            }
          },
        },
      ]
    );
  }
  const locationLabel = areaLabel({ district: request.district, city: request.city });
  const typeInfo = getRequestTypeInfo(request.request_type);
  const TypeIcon = typeInfo.icon;
  const myOffer = offers.find(o => o.helper_id === me);

  return (
    <View style={styles.container}>
      <AppHeader
        variant="sub"
        title={request.request_type === 'carpooling' ? 'توصيل المدارس' : 'طلب فزعة بالحي'}
        subtitle={locationLabel}
        fallbackRoute="/requests"
        rightAction={
          <View style={styles.headerRightActions}>
            <HeaderAction
              onPress={handleShare}
              style={styles.headerActionBtn}
              accessibilityRole="button"
              accessibilityLabel="مشاركة"
            >
              <Share2 size={16} color={OASIS.colors.primary} />
            </HeaderAction>
            <HeaderAction
              onPress={() => router.push({ pathname: '/report', params: { type: 'request', id: request.id } })}
              style={styles.headerActionBtn}
              accessibilityRole="button"
              accessibilityLabel="إبلاغ"
            >
              <Flag size={16} color={OASIS.colors.muted} />
            </HeaderAction>
          </View>
        }
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomNavInset + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {request.request_type === 'carpooling' ? <View style={{ backgroundColor: '#ECFDF5', borderColor: '#BBE7CE', borderWidth: 1, borderRadius: 15, padding: 14, marginBottom: 12, gap: 6, flexDirection: 'row-reverse', alignItems: 'flex-start' }}><GraduationCap size={21} color="#047857" /><View style={{ flex: 1, alignItems: 'flex-end' }}><Text style={{ color: '#064E3B', fontWeight: '800', fontSize: 14 }}>تنسيق توصيل المدارس</Text><Text style={{ color: '#376454', fontSize: 12, lineHeight: 21, textAlign: 'right' }}>المنشور مخصص لترتيب التوصيل فقط. لا تشارك بيانات الأطفال أو موقع المنزل أو وقت الالتقاء العلني؛ تأكد من الجهة والسائق واتفق برسائل خاصة.</Text></View></View> : null}
        <TwitterInquiryCard detailMode type="request" data={{ ...request, profiles: requester, answers_count: offers.length }} currentUserId={me || null} currentUserProfile={viewerProfile} isGuest={!me} onQuickReply={async () => {}} onToast={message => showIsland(message, undefined, 'success')} onDeleted={() => void load()} />
        <View style={{ backgroundColor: OASIS.colors.surface, borderRadius: 14, padding: 16, gap: 12, borderWidth: 1, borderColor: OASIS.colors.line }}>
          {Boolean(request.notes) && <Text style={styles.notesText}>{request.notes}</Text>}
          {Number(request.budget) > 0 && <Text style={styles.budgetValue}>المكافأة المقترحة: {request.budget} ر.س</Text>}
          <Pressable oasisKind="action" onPress={() => router.push({ pathname: '/map', params: { district: request.district, city: request.city } })} accessibilityRole="button" style={styles.openMapBtn}><MapPin size={16} color="#176b52" /><Text style={styles.openMapBtnText}>عرض الحي على الخريطة</Text></Pressable>
        </View>
        <View style={styles.bodyContainer}>
          {/* Celebratory Banner if completed */}
          {request.status === 'completed' && (
            <LinearGradient
              colors={[OASIS.colors.soft, OASIS.colors.soft]}
              style={styles.completedStatusCard}
            >
              <View style={styles.completedStatusIconCircle}>
                <Check size={20} color={OASIS.colors.primary} />
              </View>
              <View style={styles.completedStatusTextCol}>
                <Text style={styles.completedStatusTitle}>تمت الفزعة وإتمام هذا الطلب بنجاح! 🎉</Text>
                <Text style={styles.completedStatusSub}>
                  شكراً لتعاون أهل الحي وروح الفزعة والمبادرة الأخوية 🤍☕ (+15 نقطة سمعة للفازع)
                </Text>
              </View>
            </LinearGradient>
          )}

          {/* Helper Already Offered State */}
          {!isOwner && myOffer && (
            <OasisSurface oasisSurface="card" style={styles.myOfferNoticeCard}>
              <View style={styles.myOfferHeader}>
                <CheckCircle2 size={20} color={OASIS.colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.myOfferTitle}>لقد أرسلت عرض فزعتك لهذا الطلب! 🤝</Text>
                  <Text style={styles.myOfferSub}>
                    رسالتك: «{myOffer.message}»
                  </Text>
                </View>
              </View>

              <View style={styles.myOfferStatusRow}>
                <Text style={styles.myOfferStatusLabel}>حالة العرض:</Text>
                <View style={[
                  styles.myOfferStatusPill,
                  myOffer.status === 'accepted' ? styles.myOfferStatusPillAccepted : styles.myOfferStatusPillPending
                ]}>
                  <Text style={[
                    styles.myOfferStatusText,
                    myOffer.status === 'accepted' ? styles.myOfferStatusTextAccepted : styles.myOfferStatusTextPending
                  ]}>
                    {myOffer.status === 'accepted' ? 'تم قبول عرضك 🎉' : 'قيد انتظار موافقة الجار ⏳'}
                  </Text>
                </View>
              </View>

              {myOffer.status === 'accepted' && convId && (
                <Pressable oasisKind="action"
                  style={styles.goToChatBtn}
                  onPress={() => router.push({ pathname: '/conversation', params: { id: convId } })}
                >
                  <MessageSquare size={16} color={OASIS.colors.surface} />
                  <Text style={styles.goToChatBtnText}>الانتقال إلى المحادثة الخاصة للاتفاق 💬</Text>
                </Pressable>
              )}
            </OasisSurface>
          )}

          {/* Offers Received Section */}
          <OasisSurface oasisSurface="card" style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderIconBox}>
                <MessageSquare size={18} color={OASIS.colors.primary} />
              </View>
              <View style={styles.sectionTitleWithCount}>
                <Text style={styles.cardTitle}>عروض المساعدة من الجيران</Text>
                <Text style={styles.countBadgePill}>{offers.length}</Text>
              </View>
            </View>

            {autoSuggestedCount > 0 && (
              <View style={styles.autoSuggestionNote}>
                <Info size={14} color="#0369a1" />
                <Text style={styles.autoSuggestionNoteText}>
                  تم تجاهل {autoSuggestedCount} مطابقة آلية — لا تُرسل العروض تلقائياً، ويظهر هنا فقط من أرسل فزعته بنفسه من الجيران الحقيقيين.
                </Text>
              </View>
            )}

            {offers.length === 0 ? (
              <View style={styles.noOffersBox}>
                <HeartHandshake size={42} color="#cbd5e1" />
                <Text style={styles.noOffersTitle}>لا توجد عروض مساعدة بعد</Text>
                <Text style={styles.noOffersSub}>
                  {isOwner
                    ? 'سيظهر هنا أي جار يعرض مساعدته فور إرسالها.'
                    : 'كن أول جار يقدم الفزعة والمبادرة الكريمة!'}
                </Text>
              </View>
            ) : (
              offers.map(o => (
                <View key={o.id} style={styles.offerItem}>
                  <View style={styles.offerHeader}>
                    <View style={styles.offerHelperInfo}>
                      <View style={styles.offerAvatarCircle}>
                        <User size={14} color={OASIS.colors.primary} />
                      </View>
                      <View>
                        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }}>
                          <Text style={styles.offerHelperName}>
                            {o.profiles?.display_name || `@${o.profiles?.username || 'فاعل خير'}`}
                          </Text>
                          {o.profiles?.is_geoverified && <ShieldCheck size={12} color={OASIS.colors.primary} />}
                        </View>
                        {o.created_at && (
                          <Text style={styles.offerTimeText}>{relativeTime(o.created_at)}</Text>
                        )}
                      </View>
                    </View>

                    <View style={[
                      styles.offerStatusBadge,
                      o.status === 'completed' && styles.offerStatusCompleted,
                      o.status === 'accepted' && styles.offerStatusAccepted,
                    ]}>
                      <Text style={[
                        styles.offerStatusText,
                        o.status === 'completed' && styles.offerStatusTextCompleted,
                        o.status === 'accepted' && styles.offerStatusTextAccepted,
                      ]}>
                        {o.status === 'completed' ? 'تمت الفزعة ✓' : o.status === 'accepted' ? 'تم القبول 🤝' : 'عرض جديد'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.offerBubble}>
                    <Text style={styles.offerMessage}>{o.message}</Text>
                  </View>

                  {/* Owner Accept Button */}
                  {isOwner && o.status === 'proposed' && request.status === 'open' && (
                    <Pressable oasisKind="action" style={styles.acceptBtn} onPress={() => acceptOffer(o)}>
                      <Check size={16} color={OASIS.colors.surface} />
                      <Text style={styles.acceptBtnText}>قبول العرض وبدء التنسيق بالخاص 💬</Text>
                    </Pressable>
                  )}

                  {/* Accepted Actions */}
                  {o.status === 'accepted' && (
                    <View style={styles.acceptedOfferWrap}>
                      {convId && (
                        <View style={styles.offerActionsRow}>
                          <Pressable oasisKind="action"
                            style={styles.openChatBtn}
                            onPress={() => router.push({ pathname: '/conversation', params: { id: convId } })}
                          >
                            <MessageSquare size={15} color={OASIS.colors.primary} />
                            <Text style={styles.openChatBtnText}>فتح المحادثة الخاصة</Text>
                          </Pressable>

                          {isOwner && (
                            <Pressable oasisKind="chip"
                              style={[styles.shareLocationBtn, sharingLocation && { opacity: 0.6 }]}
                              onPress={shareExactLocation}
                              disabled={sharingLocation}
                            >
                              {sharingLocation ? (
                                <ActivityIndicator size="small" color={OASIS.colors.surface} />
                              ) : (
                                <MapPin size={15} color={OASIS.colors.surface} />
                              )}
                              <Text style={styles.shareLocationBtnText}>إرسال موقعي الدقيق</Text>
                            </Pressable>
                          )}
                        </View>
                      )}

                      {isOwner && request.status !== 'completed' && (
                        <Pressable oasisKind="action"
                          style={styles.completeWithCoffeeBtn}
                          onPress={() => openCompletionModal(o)}
                        >
                          <Coffee size={16} color="#78350f" />
                          <Text style={styles.completeWithCoffeeBtnText}>
                            إتمام الطلب وشكر الفازع ☕ (+15 نقطة سمعة)
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  )}

                  {o.status === 'completed' && (
                    <View style={styles.completedHelperBanner}>
                      <Sparkles size={14} color={OASIS.colors.primary} />
                      <Text style={styles.completedHelperBannerText}>
                        تمت الفزعة بنجاح بفضل هذا الجار 🤍☕ (+15 نقطة سمعة)
                      </Text>
                    </View>
                  )}
                </View>
              ))
            )}
          </OasisSurface>

          {/* Interactive Offer Submission Form (For Neighbors when Request is Open) */}
          {!isOwner && !myOffer && request.status === 'open' && me && (
            <OasisSurface oasisSurface="card" style={styles.offerFormCard}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardHeaderIconBox}>
                  <HeartHandshake size={18} color={OASIS.colors.primary} />
                </View>
                <Text style={styles.offerFormTitle}>تقديم فزعة ومساعدة 🤝</Text>
              </View>

              <Text style={styles.offerFormSub}>
                اختر رداً سريعاً بنقرة واحدة أو اكتب تفاصيل عرضك لصاحب الطلب:
              </Text>

              {/* Quick Reply Chips */}
              <View style={styles.quickChipsGrid}>
                {QUICK_REPLY_TEMPLATES.map((tmpl, idx) => (
                  <Pressable oasisKind="chip"
                    key={idx}
                    style={styles.quickChip}
                    onPress={() => setMessage(tmpl)}
                  >
                    <Text style={styles.quickChipText}>{tmpl}</Text>
                  </Pressable>
                ))}
              </View>

              <TextInput
                style={styles.offerInput}
                value={message}
                onChangeText={setMessage}
                placeholder="اكتب رسالتك لجارك... (مثال: أقدر أساعدك وأنا متاح الليلة)"
                placeholderTextColor="#94a3b8"
                multiline
              />

              <Pressable oasisKind="action"
                style={[styles.sendOfferBtn, submittingOffer && { opacity: 0.6 }]}
                onPress={sendOffer}
                disabled={submittingOffer}
              >
                {submittingOffer ? (
                  <ActivityIndicator size="small" color={OASIS.colors.surface} />
                ) : (
                  <>
                    <Send size={16} color={OASIS.colors.surface} />
                    <Text style={styles.sendOfferBtnText}>إرسال عرض المساعدة للجار</Text>
                  </>
                )}
              </Pressable>
            </OasisSurface>
          )}

          {/* Guest Sign-In Prompt */}
          {!me && request.status === 'open' && (
            <Pressable
              style={styles.guestOfferPrompt}
              onPress={() => requireAccount('سجّل الدخول أو أنشئ حساباً لتقديم المساعدة لأهل الحي.')}
            >
              <HeartHandshake size={20} color={OASIS.colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.guestOfferPromptTitle}>سجّل الدخول للمشاركة في فزعة جارك</Text>
                <Text style={styles.guestOfferPromptSub}>انضم لأهل حيك وساهم في تعزيز روح الجيرة والتكافل</Text>
              </View>
              <ChevronLeft size={16} color={OASIS.colors.primary} />
            </Pressable>
          )}

          {/* Safety & Neighbor Guidelines */}
          <OasisSurface oasisSurface="card" style={styles.guidelinesCard}>
            <View style={styles.guidelinesTitleRow}>
              <ShieldCheck size={16} color={OASIS.colors.primary} />
              <Text style={styles.guidelinesTitle}>إرشادات الفزعة الآمنة في الحي</Text>
            </View>
            <Text style={styles.guidelinesItem}>• التنسيق المباشر واللقاء في أماكن معروفة ومدخل الحي.</Text>
            <Text style={styles.guidelinesItem}>• الحفاظ على الأمانات والأدوات المعارة وردّها بحالة ممتازة.</Text>
            <Text style={styles.guidelinesItem}>• التعامل بأخلاق الإسلام وحسن الجوار والإخلاص في المساعدة.</Text>
          </OasisSurface>
        </View>
      </ScrollView>

      {/* Neighbor Appreciation & Completion Modal */}
      <Modal
        visible={completeModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCompleteModalOpen(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setCompleteModalOpen(false)}
        >
          <Pressable oasisKind="card" style={styles.appreciationModalCard} onPress={e => e.stopPropagation?.()}>
            <View style={styles.appreciationModalHeader}>
              <Pressable oasisKind="icon"
                onPress={() => setCompleteModalOpen(false)}
                style={styles.modalCloseBtn}
                accessibilityRole="button"
              >
                <X size={18} color={OASIS.colors.muted} />
              </Pressable>
              <View style={styles.appreciationModalTitleCol}>
                <View style={styles.appreciationModalIconCircle}>
                  <Coffee size={28} color="#78350f" />
                </View>
                <Text style={styles.appreciationModalTitle}>إتمام الطلب وشكر الفازع ☕</Text>
                <Text style={styles.appreciationModalSub}>
                  سيتم اعتماد إتمام الفزعة، ومنح الجار {selectedMatch?.profiles?.display_name || 'الفازع'} +15 نقطة سمعة إيجابية في الحي ⭐
                </Text>
              </View>
            </View>

            <Text style={styles.appreciationSectionLabel}>اختر عبارة شكر وتقدير لجارك:</Text>
            <View style={styles.appreciationChipsWrap}>
              {COMPLETION_TEMPLATES.map((tmpl, idx) => {
                const isSelected = completeNote === tmpl;
                return (
                  <Pressable oasisKind="chip"
                    key={idx}
                    style={[styles.appreciationChip, isSelected && styles.appreciationChipSelected]}
                    onPress={() => setCompleteNote(tmpl)}
                    accessibilityRole="button"
                  >
                    <Text
                      style={[styles.appreciationChipText, isSelected && styles.appreciationChipTextSelected]}
                    >
                      {tmpl}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <TextInput
              style={styles.appreciationInput}
              value={completeNote}
              onChangeText={setCompleteNote}
              placeholder="اكتب رسالة شكر خاصة لجارك..."
              placeholderTextColor="#94a3b8"
              multiline
            />

            <Pressable oasisKind="action"
              style={[styles.appreciationSendBtn, completingRequest && { opacity: 0.7 }]}
              onPress={() => completeRequestWithCoffee()}
              disabled={completingRequest}
              accessibilityRole="button"
            >
              {completingRequest ? (
                <ActivityIndicator size="small" color={OASIS.colors.surface} />
              ) : (
                <>
                  <Coffee size={18} color={OASIS.colors.surface} />
                  <Text style={styles.appreciationSendBtnText}>
                    اعتماد الإتمام وإهداء القهوة والسمعة (+15 نقطة) ☕
                  </Text>
                </>
              )}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal for Editing Request */}
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
                <Text style={styles.modalTitle}>تعديل طلب الفزعة</Text>
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
              <Text style={styles.modalInputLabel}>عنوان الطلب</Text>
              <TextInput
                style={styles.modalInput}
                value={editTitle}
                onChangeText={setEditTitle}
                placeholder="عنوان مختصر لطلب الفزعة..."
                placeholderTextColor="#94a3b8"
                textAlign="right"
                maxLength={100}
              />

              <Text style={styles.modalInputLabel}>تفاصيل الطلب والاحتياج</Text>
              <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
                value={editDescription}
                onChangeText={setEditDescription}
                placeholder="اشرح لجارك بالتفصيل ماذا تحتاج..."
                placeholderTextColor="#94a3b8"
                textAlign="right"
                multiline
                numberOfLines={4}
                maxLength={500}
              />

              <Text style={styles.modalInputLabel}>ملاحظات إضافية (اختياري)</Text>
              <TextInput
                style={styles.modalInput}
                value={editNotes}
                onChangeText={setEditNotes}
                placeholder="أي ملاحظات مثل التوقيت أو الأداة المطلوبة..."
                placeholderTextColor="#94a3b8"
                textAlign="right"
                maxLength={200}
              />

              <View style={styles.editWarningBox}>
                <Info size={14} color="#d97706" />
                <Text style={styles.editWarningText}>
                  تنبيه: يُسمح بتعديل الطلب مرتين كحد أقصى حفاظاً على ترابط عروض الفزعة ومصداقية الطلبات.
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
                style={[styles.modalSubmitBtn, (!editTitle.trim() || !editDescription.trim() || savingEdit) && styles.modalSubmitBtnDisabled]}
                onPress={handleSaveEdit}
                disabled={!editTitle.trim() || !editDescription.trim() || savingEdit}
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
    </View>
  );
}

const styles = StyleSheet.create({
  srOnly: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  container: {
    flex: 1,
    backgroundColor: '#f5f7f6',
  },
  scroll: {
    flexGrow: 1, width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 12, gap: 12,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#f5f7f6',
    gap: 12,
  },
  loadingText: {
    color: OASIS.colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    color: OASIS.colors.ink,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  backBtnAction: {
    backgroundColor: OASIS.colors.primary,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 16,
  },
  backBtnActionText: {
    color: OASIS.colors.surface,
    fontWeight: '700',
    fontSize: 13,
  },
  headerRightActions: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  headerActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 14,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: OASIS.colors.line,
  },
  heroCard: {
    backgroundColor: OASIS.colors.surface,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 14,
    padding: 15,
    borderWidth: 1,
    borderColor: OASIS.colors.line,
    shadowColor: OASIS.colors.ink,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  heroTopBadges: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  openBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: OASIS.colors.soft,
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  openDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: OASIS.colors.primary,
  },
  openBadgeText: {
    color: OASIS.colors.primary,
    fontSize: 11.5,
    fontWeight: '700',
  },
  acceptedBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  acceptedBadgeText: {
    color: '#15803d',
    fontSize: 11.5,
    fontWeight: '700',
  },
  completedBadgeHero: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    backgroundColor: OASIS.colors.soft,
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  completedBadgeHeroText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: OASIS.colors.deep,
  },
  typePill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 10,
    borderWidth: 1,
  },
  typePillText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  urgentBadge: {
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
  urgentBadgeText: {
    color: OASIS.colors.danger,
    fontSize: 11,
    fontWeight: '700',
  },
  heroTitle: {
    color: OASIS.colors.ink,
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'right',
    lineHeight: 28,
  },
  metaRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  metaChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f5f7f6',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: OASIS.colors.line,
  },
  metaChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: OASIS.colors.muted,
  },
  privacyNoteBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: OASIS.colors.soft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  privacyNoteText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: '#15803d',
    textAlign: 'right',
    lineHeight: 16,
  },
  bodyContainer: {
    padding: 0,
    gap: 12,
  },
  completedStatusCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    gap: 12,
  },
  completedStatusIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: OASIS.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: OASIS.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0,
    shadowRadius: 3,
    elevation: 2,
  },
  completedStatusTextCol: {
    flex: 1,
  },
  completedStatusTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: OASIS.colors.deep,
    marginBottom: 2,
    textAlign: 'right',
  },
  completedStatusSub: {
    fontSize: 11.5,
    lineHeight: 17,
    color: OASIS.colors.primary,
    textAlign: 'right',
  },
  requesterCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: OASIS.colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: OASIS.colors.line,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0,
    shadowRadius: 6,
    elevation: 1,
    gap: 12,
  },
  requesterAvatarWrap: {
    position: 'relative',
  },
  requesterAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: OASIS.colors.line,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: OASIS.colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#a7f3d0',
  },
  avatarLetter: {
    color: OASIS.colors.deep,
    fontSize: 20,
    fontWeight: '700',
  },
  verifiedBadgeCircle: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: OASIS.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: OASIS.colors.surface,
  },
  requesterTextCol: {
    alignItems: 'flex-end',
    flex: 1,
  },
  requesterNameRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  requesterName: {
    color: OASIS.colors.ink,
    fontSize: 14.5,
    fontWeight: '700',
  },
  requesterBadgePill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
    backgroundColor: OASIS.colors.soft,
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  requesterBadgePillText: {
    fontSize: 11,
    fontWeight: '600',
    color: OASIS.colors.primary,
  },
  requesterSub: {
    color: OASIS.colors.muted,
    fontSize: 12,
    marginTop: 3,
    fontWeight: '700',
  },
  visitProfilePill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
    backgroundColor: OASIS.colors.soft,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  visitProfilePillText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: OASIS.colors.primary,
  },
  card: {
    backgroundColor: OASIS.colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: OASIS.colors.line,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0,
    shadowRadius: 6,
    elevation: 1,
  },
  cardHeaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardHeaderIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: OASIS.colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    color: OASIS.colors.ink,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'right',
  },
  cardDesc: {
    color: OASIS.colors.ink,
    fontSize: 14,
    lineHeight: 23,
    textAlign: 'right',
    marginBottom: 12,
  },
  notesBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f5f7f6',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: OASIS.colors.line,
    marginBottom: 12,
  },
  notesText: {
    flex: 1,
    fontSize: 12,
    color: OASIS.colors.muted,
    fontWeight: '600',
    textAlign: 'right',
  },
  budgetBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#dcfce7',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#86efac',
    marginBottom: 10,
  },
  budgetCol: {
    flex: 1,
    alignItems: 'flex-end',
  },
  budgetValue: {
    color: '#15803d',
    fontSize: 13.5,
    fontWeight: '700',
  },
  budgetSub: {
    color: '#166534',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  volunteerBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    backgroundColor: OASIS.colors.soft,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    marginBottom: 10,
  },
  volunteerCol: {
    flex: 1,
    alignItems: 'flex-end',
  },
  volunteerValue: {
    color: OASIS.colors.deep,
    fontSize: 13,
    fontWeight: '700',
  },
  volunteerSub: {
    color: OASIS.colors.primary,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  openMapBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f5f7f6',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: OASIS.colors.line,
    marginTop: 4,
  },
  openMapBtnText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: OASIS.colors.primary,
  },
  ownerNoticeCard: {
    backgroundColor: OASIS.colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#a7f3d0',
    gap: 10,
    shadowColor: OASIS.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0,
    shadowRadius: 5,
    elevation: 2,
  },
  ownerNoticeTop: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  ownerNoticeTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: OASIS.colors.deep,
  },
  ownerNoticeSub: {
    fontSize: 12,
    lineHeight: 18,
    color: OASIS.colors.muted,
    textAlign: 'right',
  },
  ownerActionRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginTop: 4,
  },
  ownerShareBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: OASIS.colors.primary,
    paddingVertical: 10,
    borderRadius: 12,
  },
  ownerShareBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: OASIS.colors.surface,
  },
  ownerDeleteBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#fee2e2',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  ownerDeleteBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: OASIS.colors.danger,
  },
  myOfferNoticeCard: {
    backgroundColor: OASIS.colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: '#a7f3d0',
    gap: 10,
    shadowColor: OASIS.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0,
    shadowRadius: 6,
    elevation: 2,
  },
  myOfferHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 10,
  },
  myOfferTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: OASIS.colors.deep,
    textAlign: 'right',
    marginBottom: 4,
  },
  myOfferSub: {
    fontSize: 12.5,
    color: OASIS.colors.ink,
    textAlign: 'right',
    lineHeight: 18,
  },
  myOfferStatusRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  myOfferStatusLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: OASIS.colors.muted,
  },
  myOfferStatusPill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 8,
  },
  myOfferStatusPillPending: {
    backgroundColor: '#fef3c7',
  },
  myOfferStatusPillAccepted: {
    backgroundColor: '#dcfce7',
  },
  myOfferStatusText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  myOfferStatusTextPending: {
    color: '#b45309',
  },
  myOfferStatusTextAccepted: {
    color: '#15803d',
  },
  goToChatBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: OASIS.colors.primary,
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 4,
  },
  goToChatBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: OASIS.colors.surface,
  },
  sectionTitleWithCount: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  countBadgePill: {
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
  noOffersBox: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  autoSuggestionNote: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: OASIS.colors.infoSoft,
    borderWidth: 1,
    borderColor: '#bae6fd',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  autoSuggestionNoteText: {
    flex: 1,
    color: '#0369a1',
    fontSize: 11.5,
    lineHeight: 17,
    fontWeight: '700',
    textAlign: 'right',
  },
  noOffersTitle: {
    color: OASIS.colors.ink,
    fontSize: 14.5,
    fontWeight: '700',
    marginTop: 4,
  },
  noOffersSub: {
    color: OASIS.colors.muted,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  offerItem: {
    borderTopWidth: 1,
    borderColor: '#f1f5f9',
    paddingTop: 14,
    marginTop: 12,
  },
  offerHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  offerHelperInfo: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  offerAvatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: OASIS.colors.soft,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  offerHelperName: {
    color: OASIS.colors.ink,
    fontSize: 13.5,
    fontWeight: '700',
  },
  offerTimeText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'right',
  },
  offerStatusBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  offerStatusAccepted: {
    backgroundColor: '#dcfce7',
  },
  offerStatusCompleted: {
    backgroundColor: OASIS.colors.soft,
  },
  offerStatusText: {
    color: OASIS.colors.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  offerStatusTextAccepted: {
    color: '#15803d',
  },
  offerStatusTextCompleted: {
    color: OASIS.colors.primary,
  },
  offerBubble: {
    backgroundColor: '#f5f7f6',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: OASIS.colors.line,
    marginBottom: 8,
  },
  offerMessage: {
    color: OASIS.colors.ink,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'right',
  },
  acceptBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: OASIS.colors.primary,
    borderRadius: 12,
    paddingVertical: 10,
    marginTop: 4,
  },
  acceptBtnText: {
    color: OASIS.colors.surface,
    fontSize: 12.5,
    fontWeight: '700',
  },
  acceptedOfferWrap: {
    gap: 8,
    marginTop: 6,
  },
  offerActionsRow: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  openChatBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: OASIS.colors.soft,
    borderRadius: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  openChatBtnText: {
    color: OASIS.colors.primary,
    fontWeight: '700',
    fontSize: 12,
  },
  shareLocationBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0f766e',
    borderRadius: 12,
    paddingVertical: 10,
  },
  shareLocationBtnText: {
    color: OASIS.colors.surface,
    fontWeight: '700',
    fontSize: 12,
  },
  completeWithCoffeeBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#fef3c7',
    borderWidth: 1.5,
    borderColor: OASIS.colors.warning,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  completeWithCoffeeBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#78350f',
  },
  completedHelperBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: OASIS.colors.soft,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 12,
    paddingVertical: 8,
    marginTop: 6,
  },
  completedHelperBannerText: {
    fontSize: 12,
    fontWeight: '600',
    color: OASIS.colors.deep,
  },
  offerFormCard: {
    backgroundColor: OASIS.colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: OASIS.colors.line,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0,
    shadowRadius: 6,
    elevation: 1,
    gap: 10,
  },
  offerFormTitle: {
    color: OASIS.colors.ink,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'right',
  },
  offerFormSub: {
    color: OASIS.colors.muted,
    fontSize: 12,
    textAlign: 'right',
    lineHeight: 17,
  },
  quickChipsGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
  },
  quickChip: {
    backgroundColor: '#f5f7f6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: OASIS.colors.line,
  },
  quickChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: OASIS.colors.ink,
  },
  offerInput: {
    backgroundColor: '#f5f7f6',
    borderRadius: 14,
    padding: 12,
    textAlign: 'right',
    fontSize: 13,
    color: OASIS.colors.ink,
    borderWidth: 1.5,
    borderColor: OASIS.colors.line,
    minHeight: 44,
  },
  sendOfferBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: OASIS.colors.primary,
    borderRadius: 14,
    paddingVertical: 12,
    shadowColor: OASIS.colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0,
    shadowRadius: 4,
    elevation: 2,
  },
  sendOfferBtnText: {
    color: OASIS.colors.surface,
    fontSize: 13,
    fontWeight: '700',
  },
  guestOfferPrompt: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    backgroundColor: OASIS.colors.soft,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  guestOfferPromptTitle: {
    color: OASIS.colors.primary,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
    marginBottom: 2,
  },
  guestOfferPromptSub: {
    color: OASIS.colors.deep,
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'right',
  },
  guidelinesCard: {
    backgroundColor: OASIS.colors.surface,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: OASIS.colors.line,
    gap: 6,
  },
  guidelinesTitleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  guidelinesTitle: {
    fontSize: 12.5,
    fontWeight: '700',
    color: OASIS.colors.ink,
  },
  guidelinesItem: {
    fontSize: 11.5,
    lineHeight: 18,
    color: OASIS.colors.muted,
    textAlign: 'right',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 14,
  },
  appreciationModalCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: OASIS.colors.surface,
    borderRadius: 14,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0,
    shadowRadius: 20,
    elevation: 8,
  },
  appreciationModalHeader: {
    marginBottom: 12,
  },
  modalCloseBtn: {
    alignSelf: 'flex-start',
    padding: 6,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
  },
  appreciationModalTitleCol: {
    alignItems: 'center',
    marginTop: 4,
  },
  appreciationModalIconCircle: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#fde68a',
  },
  appreciationModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: OASIS.colors.ink,
    textAlign: 'center',
    marginBottom: 4,
  },
  appreciationModalSub: {
    fontSize: 12,
    lineHeight: 18,
    color: OASIS.colors.muted,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  appreciationSectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: OASIS.colors.ink,
    textAlign: 'right',
    marginBottom: 8,
    marginTop: 6,
  },
  appreciationChipsWrap: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  appreciationChip: {
    backgroundColor: '#f5f7f6',
    borderWidth: 1,
    borderColor: OASIS.colors.line,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
  },
  appreciationChipSelected: {
    backgroundColor: '#fef3c7',
    borderColor: OASIS.colors.warning,
  },
  appreciationChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: OASIS.colors.muted,
  },
  appreciationChipTextSelected: {
    color: '#92400e',
    fontWeight: '700',
  },
  appreciationInput: {
    backgroundColor: '#f5f7f6',
    borderWidth: 1.5,
    borderColor: OASIS.colors.line,
    borderRadius: 16,
    padding: 12,
    textAlign: 'right',
    fontSize: 13,
    color: OASIS.colors.ink,
    minHeight: 44,
    marginBottom: 14,
  },
  appreciationSendBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#b45309',
    paddingVertical: 13,
    borderRadius: 16,
    shadowColor: '#b45309',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0,
    shadowRadius: 5,
    elevation: 3,
  },
  appreciationSendBtnText: {
    color: OASIS.colors.surface,
    fontSize: 13,
    fontWeight: '700',
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
    backgroundColor: OASIS.colors.primary,
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
