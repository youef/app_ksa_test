import { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
  Platform,
  Image,
  Modal,
  Share,
  KeyboardAvoidingView,
} from 'react-native';
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
  Wrench,
  Eye,
  ArrowRight,
  ShieldAlert,
  Pencil,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
    case 'delivery':
      return { label: 'توصيل مشوار أو غرض', icon: Car, bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' };
    case 'tools':
      return { label: 'إعارة واستعارة أداة', icon: Wrench, bg: '#fff7ed', color: '#ea580c', border: '#fed7aa' };
    case 'home':
    case 'maintenance':
      return { label: 'مساعدة وصيانة بالحي', icon: Wrench, bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' };
    case 'volunteer':
      return { label: 'فزعة وتطوع خيري', icon: HeartHandshake, bg: '#fdf2f8', color: '#db2777', border: '#fbcfe8' };
    default:
      return { label: type || 'طلب فزعة عامة', icon: HeartHandshake, bg: '#ecfdf5', color: '#059669', border: '#a7f3d0' };
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
      if (requestData) {
        setRequest(requestData);

        // Safely bump views count
        if (requestData.id && user) {
          try {
            supabase
              .from('requests')
              .update({ views_count: (requestData.views_count || 0) + 1 })
              .eq('id', id)
              .then(() => {});
          } catch {}
        }

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

      // Step C: Fallback creation
      if (!finalConvId) {
        try {
          let convRes = await supabase.from('conversations').insert({}).select('id').single();
          if (convRes.error) {
            convRes = await supabase.from('conversations').insert({ created_by: me }).select('id').single();
          }

          if (convRes.data?.id) {
            finalConvId = convRes.data.id;
            await supabase.from('conversation_members').insert([
              { conversation_id: finalConvId, user_id: me },
              { conversation_id: finalConvId, user_id: match.helper_id },
            ]);
          }
        } catch {}
      }

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
        <ActivityIndicator size="large" color="#059669" />
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
        title="طلب فزعة بالحي"
        subtitle={locationLabel}
        fallbackRoute="/requests"
        rightAction={
          <View style={styles.headerRightActions}>
            <Pressable
              onPress={handleShare}
              style={styles.headerActionBtn}
              accessibilityRole="button"
              accessibilityLabel="مشاركة"
            >
              <Share2 size={16} color="#059669" />
            </Pressable>
            <Pressable
              onPress={() => router.push({ pathname: '/report', params: { type: 'request', id: request.id } })}
              style={styles.headerActionBtn}
              accessibilityRole="button"
              accessibilityLabel="إبلاغ"
            >
              <Flag size={16} color="#64748b" />
            </Pressable>
          </View>
        }
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomNavInset + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Modern Executive Hero Card */}
        <View style={styles.heroCard}>
          {/* Top Badges Row */}
          <View style={styles.heroTopBadges}>
            {/* Status Badge */}
            {request.status === 'completed' ? (
              <View style={styles.completedBadgeHero}>
                <Sparkles size={13} color="#047857" />
                <Text style={styles.completedBadgeHeroText}>تمت الفزعة بنجاح ☕</Text>
              </View>
            ) : request.status === 'accepted' ? (
              <View style={styles.acceptedBadge}>
                <CheckCircle2 size={13} color="#15803d" />
                <Text style={styles.acceptedBadgeText}>جاري التنفيذ مع جار 🤝</Text>
              </View>
            ) : (
              <View style={styles.openBadge}>
                <View style={styles.openDot} />
                <Text style={styles.openBadgeText}>مفتوح ويحتاج فزعة</Text>
              </View>
            )}

            {/* Category / Type Pill */}
            <View style={[styles.typePill, { backgroundColor: typeInfo.bg, borderColor: typeInfo.border }]}>
              <TypeIcon size={12} color={typeInfo.color} />
              <Text style={[styles.typePillText, { color: typeInfo.color }]}>{typeInfo.label}</Text>
            </View>

            {/* Urgency Badge */}
            {request.is_urgent && (
              <View style={styles.urgentBadge}>
                <Flame size={12} color="#dc2626" />
                <Text style={styles.urgentBadgeText}>عاجل</Text>
              </View>
            )}
          </View>

          {/* Title */}
          <Text style={styles.heroTitle}>{request.title}</Text>

          {/* Meta Info Row */}
          <View style={styles.metaRow}>
            <View style={styles.metaChip}>
              <MapPin size={13} color="#059669" />
              <Text style={styles.metaChipText}>{locationLabel}</Text>
            </View>

            {request.created_at && (
              <View style={styles.metaChip}>
                <Clock size={12} color="#64748b" />
                <Text style={styles.metaChipText}>{relativeTime(request.created_at)}</Text>
              </View>
            )}

            {request.views_count != null && (
              <View style={styles.metaChip}>
                <Eye size={12} color="#64748b" />
                <Text style={styles.metaChipText}>{request.views_count} مشاهدة</Text>
              </View>
            )}
          </View>

          {/* Privacy Guarantee Note */}
          <View style={styles.privacyNoteBox}>
            <Info size={13} color="#047857" />
            <Text style={styles.privacyNoteText}>
              الموقع معروض على مستوى الحي فقط لحماية خصوصية الجيران · يتم تبادل الإحداثيات بالخاص بعد قبول الفزعة.
            </Text>
          </View>
        </View>

        <View style={styles.bodyContainer}>
          {/* Author Management Card: Edit (Limit 2) & Delete */}
          {isOwner && (
            <View style={styles.authorManageBox}>
              <View style={styles.authorManageHeader}>
                <View style={styles.authorManageInfo}>
                  <Text style={styles.authorManageTitle}>إدارة طلبك</Text>
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
                    {editsRemaining === 0 ? 'انتهت محاولات التعديل' : 'تعديل الطلب'}
                  </Text>
                </Pressable>

                <Pressable
                  style={[styles.deleteActionBtn, deletingRequest && { opacity: 0.6 }]}
                  onPress={handleDeleteRequest}
                  disabled={deletingRequest}
                >
                  {deletingRequest ? (
                    <ActivityIndicator size="small" color="#dc2626" />
                  ) : (
                    <>
                      <Trash2 size={15} color="#dc2626" />
                      <Text style={styles.deleteActionBtnText}>حذف الطلب</Text>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          )}

          {/* Celebratory Banner if completed */}
          {request.status === 'completed' && (
            <LinearGradient
              colors={['#ecfdf5', '#d1fae5']}
              style={styles.completedStatusCard}
            >
              <View style={styles.completedStatusIconCircle}>
                <Check size={20} color="#059669" />
              </View>
              <View style={styles.completedStatusTextCol}>
                <Text style={styles.completedStatusTitle}>تمت الفزعة وإتمام هذا الطلب بنجاح! 🎉</Text>
                <Text style={styles.completedStatusSub}>
                  شكراً لتعاون أهل الحي وروح الفزعة والمبادرة الأخوية 🤍☕ (+15 نقطة سمعة للفازع)
                </Text>
              </View>
            </LinearGradient>
          )}

          {/* Requester Profile Card */}
          {requester && (
            <Pressable
              style={({ pressed }) => [
                styles.requesterCard,
                pressed && { opacity: 0.96 },
              ]}
              onPress={() => router.push({ pathname: '/user', params: { id: requester.id } })}
            >
              <View style={styles.requesterAvatarWrap}>
                {requester.avatar_url ? (
                  <Image source={{ uri: requester.avatar_url }} style={styles.requesterAvatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarLetter}>
                      {(requester.display_name || requester.username || 'ح')[0]}
                    </Text>
                  </View>
                )}
                {requester.is_geoverified && (
                  <View style={styles.verifiedBadgeCircle}>
                    <ShieldCheck size={11} color="#fff" />
                  </View>
                )}
              </View>

              <View style={styles.requesterTextCol}>
                <View style={styles.requesterNameRow}>
                  <Text style={styles.requesterName}>
                    {requester.display_name || `@${requester.username || 'صاحب الطلب'}`}
                  </Text>
                  <View style={styles.requesterBadgePill}>
                    <CheckCircle2 size={11} color="#059669" />
                    <Text style={styles.requesterBadgePillText}>صاحب الطلب</Text>
                  </View>
                </View>
                <Text style={styles.requesterSub}>
                  {requester.district ? `ساكن في حي ${requester.district} · ${requester.city || ''}` : 'أحد جيران الحي'}
                </Text>
              </View>

              <View style={styles.visitProfilePill}>
                <Text style={styles.visitProfilePillText}>الملف</Text>
                <ChevronLeft size={13} color="#059669" />
              </View>
            </Pressable>
          )}

          {/* Details & Needs Card */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderIconBox}>
                <HeartHandshake size={18} color="#059669" />
              </View>
              <Text style={styles.cardTitle}>تفاصيل الطلب والاحتياج</Text>
            </View>

            <Text style={styles.cardDesc}>{request.description}</Text>

            {request.notes && (
              <View style={styles.notesBox}>
                <Info size={14} color="#64748b" />
                <Text style={styles.notesText}>{request.notes}</Text>
              </View>
            )}

            {/* Compensation / Volunteer Mode */}
            {request.budget && Number(request.budget) > 0 ? (
              <View style={styles.budgetBox}>
                <Banknote size={18} color="#15803d" />
                <View style={styles.budgetCol}>
                  <Text style={styles.budgetValue}>المكافأة المقترحة: {request.budget} ر.س</Text>
                  <Text style={styles.budgetSub}>مكافأة تقديرية اختيارية من صاحب الطلب</Text>
                </View>
              </View>
            ) : (
              <View style={styles.volunteerBox}>
                <HeartHandshake size={18} color="#059669" />
                <View style={styles.volunteerCol}>
                  <Text style={styles.volunteerValue}>فزعة وتطوع ومساعدة أخوية لوجه الله 🤝</Text>
                  <Text style={styles.volunteerSub}>خدمة جيرة متبادلة تكسبك دعوة صادقة ونقاط سمعة</Text>
                </View>
              </View>
            )}

            {/* Open Map Link */}
            <Pressable
              style={styles.openMapBtn}
              onPress={() => router.push({ pathname: '/map', params: { district: request.district, city: request.city } })}
            >
              <MapPin size={15} color="#059669" />
              <Text style={styles.openMapBtnText}>عرض موقع الحي في خريطة المنصة 🗺️</Text>
              <ArrowRight size={14} color="#059669" style={{ transform: [{ rotate: '180deg' }] }} />
            </Pressable>
          </View>

          {/* Owner Broadcast Action Card */}
          {isOwner && (
            <View style={styles.ownerNoticeCard}>
              <View style={styles.ownerNoticeTop}>
                <Sparkles size={18} color="#059669" />
                <Text style={styles.ownerNoticeTitle}>أنت صاحب هذا الطلب المنشور 📢</Text>
              </View>
              <Text style={styles.ownerNoticeSub}>
                طلبك معروض أمام جميع جيران {locationLabel}. يمكنك نسخ رابط الطلب ومشاركته في قروب الحي بالواتساب لسرعة التجاوب.
              </Text>
              <View style={styles.ownerActionRow}>
                <Pressable style={styles.ownerShareBtn} onPress={handleShare}>
                  <Share2 size={15} color="#ffffff" />
                  <Text style={styles.ownerShareBtnText}>مشاركة الطلب في قروب الحي</Text>
                </Pressable>
                <Pressable style={styles.ownerDeleteBtn} onPress={deleteRequest}>
                  <Trash2 size={15} color="#dc2626" />
                  <Text style={styles.ownerDeleteBtnText}>حذف</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Helper Already Offered State */}
          {!isOwner && myOffer && (
            <View style={styles.myOfferNoticeCard}>
              <View style={styles.myOfferHeader}>
                <CheckCircle2 size={20} color="#059669" />
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
                <Pressable
                  style={styles.goToChatBtn}
                  onPress={() => router.push({ pathname: '/conversation', params: { id: convId } })}
                >
                  <MessageSquare size={16} color="#ffffff" />
                  <Text style={styles.goToChatBtnText}>الانتقال إلى المحادثة الخاصة للاتفاق 💬</Text>
                </Pressable>
              )}
            </View>
          )}

          {/* Offers Received Section */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderIconBox}>
                <MessageSquare size={18} color="#059669" />
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
                        <User size={14} color="#059669" />
                      </View>
                      <View>
                        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }}>
                          <Text style={styles.offerHelperName}>
                            {o.profiles?.display_name || `@${o.profiles?.username || 'فاعل خير'}`}
                          </Text>
                          {o.profiles?.is_geoverified && <ShieldCheck size={12} color="#10b981" />}
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
                    <Pressable style={styles.acceptBtn} onPress={() => acceptOffer(o)}>
                      <Check size={16} color="#fff" />
                      <Text style={styles.acceptBtnText}>قبول العرض وبدء التنسيق بالخاص 💬</Text>
                    </Pressable>
                  )}

                  {/* Accepted Actions */}
                  {o.status === 'accepted' && (
                    <View style={styles.acceptedOfferWrap}>
                      {convId && (
                        <View style={styles.offerActionsRow}>
                          <Pressable
                            style={styles.openChatBtn}
                            onPress={() => router.push({ pathname: '/conversation', params: { id: convId } })}
                          >
                            <MessageSquare size={15} color="#047857" />
                            <Text style={styles.openChatBtnText}>فتح المحادثة الخاصة</Text>
                          </Pressable>

                          {isOwner && (
                            <Pressable
                              style={[styles.shareLocationBtn, sharingLocation && { opacity: 0.6 }]}
                              onPress={shareExactLocation}
                              disabled={sharingLocation}
                            >
                              {sharingLocation ? (
                                <ActivityIndicator size="small" color="#fff" />
                              ) : (
                                <MapPin size={15} color="#fff" />
                              )}
                              <Text style={styles.shareLocationBtnText}>إرسال موقعي الدقيق</Text>
                            </Pressable>
                          )}
                        </View>
                      )}

                      {isOwner && request.status !== 'completed' && (
                        <Pressable
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
                      <Sparkles size={14} color="#059669" />
                      <Text style={styles.completedHelperBannerText}>
                        تمت الفزعة بنجاح بفضل هذا الجار 🤍☕ (+15 نقطة سمعة)
                      </Text>
                    </View>
                  )}
                </View>
              ))
            )}
          </View>

          {/* Interactive Offer Submission Form (For Neighbors when Request is Open) */}
          {!isOwner && !myOffer && request.status === 'open' && me && (
            <View style={styles.offerFormCard}>
              <View style={styles.cardHeaderRow}>
                <View style={styles.cardHeaderIconBox}>
                  <HeartHandshake size={18} color="#059669" />
                </View>
                <Text style={styles.offerFormTitle}>تقديم فزعة ومساعدة 🤝</Text>
              </View>

              <Text style={styles.offerFormSub}>
                اختر رداً سريعاً بنقرة واحدة أو اكتب تفاصيل عرضك لصاحب الطلب:
              </Text>

              {/* Quick Reply Chips */}
              <View style={styles.quickChipsGrid}>
                {QUICK_REPLY_TEMPLATES.map((tmpl, idx) => (
                  <Pressable
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

              <Pressable
                style={[styles.sendOfferBtn, submittingOffer && { opacity: 0.6 }]}
                onPress={sendOffer}
                disabled={submittingOffer}
              >
                {submittingOffer ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Send size={16} color="#fff" />
                    <Text style={styles.sendOfferBtnText}>إرسال عرض المساعدة للجار</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}

          {/* Guest Sign-In Prompt */}
          {!me && request.status === 'open' && (
            <Pressable
              style={styles.guestOfferPrompt}
              onPress={() => requireAccount('سجّل الدخول أو أنشئ حساباً لتقديم المساعدة لأهل الحي.')}
            >
              <HeartHandshake size={20} color="#047857" />
              <View style={{ flex: 1 }}>
                <Text style={styles.guestOfferPromptTitle}>سجّل الدخول للمشاركة في فزعة جارك</Text>
                <Text style={styles.guestOfferPromptSub}>انضم لأهل حيك وساهم في تعزيز روح الجيرة والتكافل</Text>
              </View>
              <ChevronLeft size={16} color="#047857" />
            </Pressable>
          )}

          {/* Safety & Neighbor Guidelines */}
          <View style={styles.guidelinesCard}>
            <View style={styles.guidelinesTitleRow}>
              <ShieldCheck size={16} color="#059669" />
              <Text style={styles.guidelinesTitle}>إرشادات الفزعة الآمنة في الحي</Text>
            </View>
            <Text style={styles.guidelinesItem}>• التنسيق المباشر واللقاء في أماكن معروفة ومدخل الحي.</Text>
            <Text style={styles.guidelinesItem}>• الحفاظ على الأمانات والأدوات المعارة وردّها بحالة ممتازة.</Text>
            <Text style={styles.guidelinesItem}>• التعامل بأخلاق الإسلام وحسن الجوار والإخلاص في المساعدة.</Text>
          </View>
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
          <Pressable style={styles.appreciationModalCard} onPress={e => e.stopPropagation?.()}>
            <View style={styles.appreciationModalHeader}>
              <Pressable
                onPress={() => setCompleteModalOpen(false)}
                style={styles.modalCloseBtn}
                accessibilityRole="button"
              >
                <X size={18} color="#64748b" />
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
                  <Pressable
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

            <Pressable
              style={[styles.appreciationSendBtn, completingRequest && { opacity: 0.7 }]}
              onPress={() => completeRequestWithCoffee()}
              disabled={completingRequest}
              accessibilityRole="button"
            >
              {completingRequest ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <>
                  <Coffee size={18} color="#ffffff" />
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
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>تعديل طلب الفزعة</Text>
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
              <Pressable
                style={[styles.modalCancelBtn, savingEdit && { opacity: 0.6 }]}
                onPress={() => setIsEditModalOpen(false)}
                disabled={savingEdit}
              >
                <Text style={styles.modalCancelBtnText}>إلغاء</Text>
              </Pressable>

              <Pressable
                style={[styles.modalSubmitBtn, (!editTitle.trim() || !editDescription.trim() || savingEdit) && styles.modalSubmitBtnDisabled]}
                onPress={handleSaveEdit}
                disabled={!editTitle.trim() || !editDescription.trim() || savingEdit}
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scroll: {
    flexGrow: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f8fafc',
    gap: 12,
  },
  loadingText: {
    color: '#059669',
    fontSize: 14,
    fontWeight: '800',
  },
  errorText: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '900',
    marginBottom: 8,
  },
  backBtnAction: {
    backgroundColor: '#059669',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 16,
  },
  backBtnActionText: {
    color: '#fff',
    fontWeight: '900',
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
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  heroCard: {
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
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
    backgroundColor: '#ecfdf5',
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
    backgroundColor: '#10b981',
  },
  openBadgeText: {
    color: '#047857',
    fontSize: 11.5,
    fontWeight: '900',
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
    fontWeight: '900',
  },
  completedBadgeHero: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  completedBadgeHeroText: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#065f46',
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
    fontWeight: '800',
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
    color: '#dc2626',
    fontSize: 11,
    fontWeight: '900',
  },
  heroTitle: {
    color: '#0f172a',
    fontSize: 19,
    fontWeight: '900',
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
    backgroundColor: '#f8fafc',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  metaChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
  },
  privacyNoteBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f0fdf4',
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
    padding: 16,
    gap: 12,
  },
  completedStatusCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    gap: 12,
  },
  completedStatusIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  completedStatusTextCol: {
    flex: 1,
  },
  completedStatusTitle: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#065f46',
    marginBottom: 2,
    textAlign: 'right',
  },
  completedStatusSub: {
    fontSize: 11.5,
    lineHeight: 17,
    color: '#047857',
    textAlign: 'right',
  },
  requesterCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
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
    borderColor: '#e2e8f0',
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#a7f3d0',
  },
  avatarLetter: {
    color: '#065f46',
    fontSize: 20,
    fontWeight: '900',
  },
  verifiedBadgeCircle: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 17,
    height: 17,
    borderRadius: 8.5,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
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
    color: '#0f172a',
    fontSize: 14.5,
    fontWeight: '900',
  },
  requesterBadgePill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
  },
  requesterBadgePillText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#059669',
  },
  requesterSub: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 3,
    fontWeight: '700',
  },
  visitProfilePill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  visitProfilePillText: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#059669',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
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
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'right',
  },
  cardDesc: {
    color: '#334155',
    fontSize: 14,
    lineHeight: 23,
    textAlign: 'right',
    marginBottom: 12,
  },
  notesBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#f8fafc',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  notesText: {
    flex: 1,
    fontSize: 12,
    color: '#64748b',
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
    fontWeight: '900',
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
    backgroundColor: '#ecfdf5',
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
    color: '#065f46',
    fontSize: 13,
    fontWeight: '900',
  },
  volunteerSub: {
    color: '#047857',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  openMapBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginTop: 4,
  },
  openMapBtnText: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#059669',
  },
  ownerNoticeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#a7f3d0',
    gap: 10,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
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
    fontWeight: '900',
    color: '#065f46',
  },
  ownerNoticeSub: {
    fontSize: 12,
    lineHeight: 18,
    color: '#475569',
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
    backgroundColor: '#059669',
    paddingVertical: 10,
    borderRadius: 12,
  },
  ownerShareBtnText: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#ffffff',
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
    fontWeight: '900',
    color: '#dc2626',
  },
  myOfferNoticeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#a7f3d0',
    gap: 10,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
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
    fontWeight: '900',
    color: '#065f46',
    textAlign: 'right',
    marginBottom: 4,
  },
  myOfferSub: {
    fontSize: 12.5,
    color: '#334155',
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
    color: '#64748b',
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
    fontWeight: '900',
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
    backgroundColor: '#059669',
    paddingVertical: 10,
    borderRadius: 12,
    marginTop: 4,
  },
  goToChatBtnText: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#ffffff',
  },
  sectionTitleWithCount: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  countBadgePill: {
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
  noOffersBox: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 8,
  },
  autoSuggestionNote: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f0f9ff',
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
    color: '#0f172a',
    fontSize: 14.5,
    fontWeight: '900',
    marginTop: 4,
  },
  noOffersSub: {
    color: '#64748b',
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
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  offerHelperName: {
    color: '#0f172a',
    fontSize: 13.5,
    fontWeight: '900',
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
    backgroundColor: '#ecfdf5',
  },
  offerStatusText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '800',
  },
  offerStatusTextAccepted: {
    color: '#15803d',
  },
  offerStatusTextCompleted: {
    color: '#047857',
  },
  offerBubble: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  offerMessage: {
    color: '#334155',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'right',
  },
  acceptBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#059669',
    borderRadius: 12,
    paddingVertical: 10,
    marginTop: 4,
  },
  acceptBtnText: {
    color: '#fff',
    fontSize: 12.5,
    fontWeight: '900',
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
    backgroundColor: '#ecfdf5',
    borderRadius: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  openChatBtnText: {
    color: '#047857',
    fontWeight: '900',
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
    color: '#fff',
    fontWeight: '900',
    fontSize: 12,
  },
  completeWithCoffeeBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#fef3c7',
    borderWidth: 1.5,
    borderColor: '#f59e0b',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  completeWithCoffeeBtnText: {
    fontSize: 12.5,
    fontWeight: '900',
    color: '#78350f',
  },
  completedHelperBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 12,
    paddingVertical: 8,
    marginTop: 6,
  },
  completedHelperBannerText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#065f46',
  },
  offerFormCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
    gap: 10,
  },
  offerFormTitle: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'right',
  },
  offerFormSub: {
    color: '#64748b',
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
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  quickChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#334155',
  },
  offerInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 12,
    textAlign: 'right',
    fontSize: 13,
    color: '#0f172a',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    minHeight: 70,
  },
  sendOfferBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#059669',
    borderRadius: 14,
    paddingVertical: 12,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  sendOfferBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '900',
  },
  guestOfferPrompt: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  guestOfferPromptTitle: {
    color: '#047857',
    fontSize: 13,
    fontWeight: '900',
    textAlign: 'right',
    marginBottom: 2,
  },
  guestOfferPromptSub: {
    color: '#065f46',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'right',
  },
  guidelinesCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
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
    fontWeight: '900',
    color: '#0f172a',
  },
  guidelinesItem: {
    fontSize: 11.5,
    lineHeight: 18,
    color: '#64748b',
    textAlign: 'right',
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  appreciationModalCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
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
    borderRadius: 27,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 2,
    borderColor: '#fde68a',
  },
  appreciationModalTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 4,
  },
  appreciationModalSub: {
    fontSize: 12,
    lineHeight: 18,
    color: '#64748b',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  appreciationSectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
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
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
  },
  appreciationChipSelected: {
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
  },
  appreciationChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#475569',
  },
  appreciationChipTextSelected: {
    color: '#92400e',
    fontWeight: '900',
  },
  appreciationInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 12,
    textAlign: 'right',
    fontSize: 13,
    color: '#0f172a',
    minHeight: 70,
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
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  appreciationSendBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
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
