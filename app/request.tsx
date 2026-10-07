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
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/ui';
import { sendPushToUser } from '@/lib/pushSender';
import {
  ChevronRight,
  MapPin,
  HeartHandshake,
  AlertCircle,
  Banknote,
  CheckCircle2,
  Trash2,
  Flag,
  User,
  MessageSquare,
  Clock,
  ShieldCheck,
  Flame,
  ArrowRight,
  Check,
  Send,
  Info,
  Coffee,
  Sparkles,
  X,
  Award,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenHeader from '@/components/shared/ScreenHeader';
import { requireAccount } from '@/lib/authGate';
import { getActiveLocation } from '@/lib/locationSync';
import { areaLabel } from '@/lib/privacy';
import { getCurrentDeviceLocation, reverseGeocodeDeviceLocation } from '@/lib/deviceLocation';
import { relativeTime } from '@/lib/mapPins';
import { useBottomNavInset } from '@/lib/bottomNav';

export default function Request() {
  const bottomNavInset = useBottomNavInset();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [request, setRequest] = useState<any>(null);
  const [requester, setRequester] = useState<any>(null);
  const [offers, setOffers] = useState<any[]>([]);
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

  const COMPLETION_TEMPLATES = [
    'بيض الله وجهك على الفزعة الكريمة 🤍',
    'تسلم وما قصرت، يعطيك ألف عافية يا جارنا 🤝',
    'شكراً لحسن تعاملك وسرعة استجابتك ⭐',
    'قهوتك واصلة، فزعة في ميزان حسناتك ☕',
  ];

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
          .select('id, helper_id, message, status, created_at, profiles:helper_id(id, display_name, username, avatar_url, is_verified, is_geoverified, district)')
          .eq('request_id', id)
          .order('created_at', { ascending: false }),
      ]);

      const requestData = Array.isArray(requestResult.data) ? requestResult.data[0] : requestResult.data;
      if (requestData) {
        setRequest(requestData);
        if (requestData.requester_id) {
          const { data: p } = await supabase
            .from('profiles')
            .select('id, display_name, username, avatar_url, is_verified, is_geoverified, city, district')
            .eq('id', requestData.requester_id)
            .single();
          setRequester(p);
        }
      }
      setOffers(oData.data ?? []);

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
      const { data: rpcRes, error: rpcErr } = await supabase.rpc('complete_neighbor_request', {
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
        <Text style={styles.loadingText}>جاري تحميل تفاصيل الطلب...</Text>
      </View>
    );
  }

  if (!request) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>الطلب غير موجود أو تم إغلاقه.</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtnAction}>
          <Text style={styles.backBtnActionText}>العودة للطلبات</Text>
        </Pressable>
      </View>
    );
  }

  const isOwner = me === request.requester_id;
  const locationLabel = areaLabel({ district: request.district, city: request.city });

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomNavInset + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Unified Luxury Header */}
        <LinearGradient
          colors={['#064e3b', '#065f46', '#047857']}
          style={styles.hero}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <ScreenHeader
            title="تفاصيل طلب الفزعة 🤝"
            fallbackRoute="/requests"
            rightAction={(
              <Pressable
                onPress={() => router.push({ pathname: '/report', params: { type: 'request', id: request.id } })}
                style={styles.headerActionBtn}
                accessibilityRole="button"
                accessibilityLabel="إبلاغ"
              >
                <Flag size={18} color="#ffffff" />
              </Pressable>
            )}
          />

          <View style={styles.heroBadgeRow}>
            {request.is_urgent && (
              <View style={styles.urgentBadge}>
                <Flame size={12} color="#dc2626" />
                <Text style={styles.urgentBadgeText}>فزعة عاجلة</Text>
              </View>
            )}
            {request.status === 'completed' ? (
              <View style={styles.completedBadgeHero}>
                <Sparkles size={12} color="#047857" />
                <Text style={styles.completedBadgeHeroText}>تمت الفزعة بنجاح ☕</Text>
              </View>
            ) : request.status === 'accepted' ? (
              <View style={styles.acceptedBadge}>
                <CheckCircle2 size={12} color="#15803d" />
                <Text style={styles.acceptedBadgeText}>تم قبول مساعدة</Text>
              </View>
            ) : (
              <View style={styles.openBadge}>
                <View style={styles.openDot} />
                <Text style={styles.openBadgeText}>مفتوح للمساعدة</Text>
              </View>
            )}
          </View>

          <Text style={styles.heroTitle}>{request.title}</Text>

          <View style={styles.metaRow}>
            <MapPin size={13} color="#a7f3d0" />
            <Text style={styles.metaText}>{locationLabel}</Text>
            {request.created_at && (
              <Text style={styles.metaTimeText}>· {relativeTime(request.created_at)}</Text>
            )}
          </View>
          <Text style={styles.heroPrivacy}>
            الموقع معروض على مستوى الحي فقط لحماية الخصوصية · يتم تبادل الإحداثي الدقيق بالخاص
          </Text>
        </LinearGradient>

        <View style={styles.bodyContainer}>
          {/* Completed celebratory banner */}
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
                  شكراً لتعاون أهل الحي وروح الفزعة والمبادرة الأخوية 🤍☕ (+15 نقطة سمعة)
                </Text>
              </View>
            </LinearGradient>
          )}
          {/* Requester Profile Card */}
          {requester && (
            <Pressable
              style={({ pressed }) => [
                styles.requesterCard,
                pressed && { opacity: 0.95 },
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
                  {requester.is_verified && <ShieldCheck size={13} color="#059669" />}
                </View>
                <Text style={styles.requesterSub}>
                  {requester.district ? `ساكن في حي ${requester.district}` : 'أحد جيران الحي'}
                </Text>
              </View>

              <View style={styles.requesterArrow}>
                <ArrowRight size={15} color="#94a3b8" />
              </View>
            </Pressable>
          )}

          {/* Details Card */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.cardTitle}>تفاصيل الطلب والاحتياج</Text>
              <HeartHandshake size={18} color="#059669" />
            </View>
            <Text style={styles.cardDesc}>{request.description}</Text>

            {request.budget && Number(request.budget) > 0 ? (
              <View style={styles.budgetBox}>
                <Banknote size={18} color="#15803d" />
                <Text style={styles.budgetValue}>المكافأة المقترحة: {request.budget} ر.س</Text>
              </View>
            ) : (
              <View style={styles.volunteerBox}>
                <HeartHandshake size={18} color="#059669" />
                <Text style={styles.volunteerValue}>فزعة وتطوع ومساعدة أخوية لوجه الله 🤝</Text>
              </View>
            )}
          </View>

          {/* Offers Section */}
          <View style={styles.card}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.sectionTitleWithCount}>
                <Text style={styles.countBadgePill}>{offers.length}</Text>
                <Text style={styles.cardTitle}>عروض المساعدة المقدمة</Text>
              </View>
              <MessageSquare size={18} color="#059669" />
            </View>

            {offers.length === 0 ? (
              <View style={styles.noOffersBox}>
                <HeartHandshake size={36} color="#cbd5e1" />
                <Text style={styles.noOffersTitle}>لا توجد عروض مساعدة بعد</Text>
                <Text style={styles.noOffersSub}>كن أول جار يقدم الفزعة والمساعدة!</Text>
              </View>
            ) : (
              offers.map(o => (
                <View key={o.id} style={styles.offerItem}>
                  <View style={styles.offerHeader}>
                    <View style={styles.offerHelperInfo}>
                      <View style={styles.offerAvatarCircle}>
                        <User size={13} color="#059669" />
                      </View>
                      <Text style={styles.offerHelperName}>
                        {o.profiles?.display_name || `@${o.profiles?.username || 'فاعل خير'}`}
                      </Text>
                      {o.profiles?.is_geoverified && <ShieldCheck size={11} color="#10b981" />}
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
                        {o.status === 'completed' ? 'تمت الفزعة ✓' : o.status === 'accepted' ? 'جاري الفزعة' : 'عرض جديد'}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.offerMessage}>{o.message}</Text>

                  {isOwner && o.status === 'proposed' && request.status === 'open' && (
                    <Pressable style={styles.acceptBtn} onPress={() => acceptOffer(o)}>
                      <Check size={16} color="#fff" />
                      <Text style={styles.acceptBtnText}>قبول العرض وفتح المحادثة 💬</Text>
                    </Pressable>
                  )}

                  {o.status === 'accepted' && (
                    <View style={styles.acceptedOfferWrap}>
                      {convId && (
                        <View style={styles.offerActionsRow}>
                          <Pressable
                            style={styles.openChatBtn}
                            onPress={() => router.push({ pathname: '/conversation', params: { id: convId } })}
                          >
                            <MessageSquare size={15} color="#047857" />
                            <Text style={styles.openChatBtnText}>فتح المحادثة</Text>
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
                              <Text style={styles.shareLocationBtnText}>إرسال موقعي الدقيق (خاص)</Text>
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
                            إتمام الطلب وشكر الفازع ☕ (+15 نقطة)
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

          {/* Help Form (For non-owners if request is open) */}
          {!isOwner && request.status === 'open' && me && (
            <View style={styles.offerFormCard}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.offerFormTitle}>تقديم فزعة ومساعدة 🤝</Text>
              </View>
              <Text style={styles.offerFormSub}>اكتب رسالة سريعة لصاحب الطلب لتخبره كيف تقدر تساعده.</Text>

              <TextInput
                style={styles.offerInput}
                value={message}
                onChangeText={setMessage}
                placeholder="مثال: أقدر أساعدك الليلة أو في طريقي للحي..."
                placeholderTextColor="#9ca3af"
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
                    <Text style={styles.sendOfferBtnText}>إرسال عرض المساعدة</Text>
                  </>
                )}
              </Pressable>
            </View>
          )}

          {!me && request.status === 'open' && (
            <Pressable
              style={styles.guestOfferPrompt}
              onPress={() => requireAccount('سجّل الدخول أو أنشئ حساباً لتقديم المساعدة لأهل الحي.')}
            >
              <Text style={styles.guestOfferPromptText}>سجّل الدخول لتقديم المساعدة لأهل الحي</Text>
              <HeartHandshake size={18} color="#047857" />
            </Pressable>
          )}

          {/* Owner Delete Button */}
          {isOwner && (
            <Pressable style={styles.deleteBtn} onPress={deleteRequest}>
              <Trash2 size={16} color="#ef4444" />
              <Text style={styles.deleteBtnText}>إلغاء وحذف هذا الطلب</Text>
            </Pressable>
          )}
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
                  <Coffee size={26} color="#78350f" />
                </View>
                <Text style={styles.appreciationModalTitle}>إتمام الطلب وشكر الفازع ☕</Text>
                <Text style={styles.appreciationModalSub}>
                  سيتم اعتماد إتمام الفزعة، ومنح الجار {selectedMatch?.profiles?.display_name || 'الفازع'} +15 نقطة سمعة إيجابية في الحي ⭐
                </Text>
              </View>
            </View>

            <Text style={styles.appreciationSectionLabel}>اختر عبارة شكر وتقدير أو اكتب رسالتك:</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f6f8f7',
  },
  scroll: {
    flexGrow: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f6f8f7',
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
  hero: {
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
    paddingHorizontal: 16,
    paddingBottom: 22,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  heroBadgeRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginTop: 6,
    marginBottom: 10,
  },
  urgentBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#fee2e2',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  urgentBadgeText: {
    color: '#dc2626',
    fontSize: 11,
    fontWeight: '900',
  },
  openBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  openDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#6ee7b7',
  },
  openBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
  },
  acceptedBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  acceptedBadgeText: {
    color: '#15803d',
    fontSize: 11,
    fontWeight: '900',
  },
  heroTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'right',
    lineHeight: 28,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
  },
  metaText: {
    color: '#ecfdf5',
    fontSize: 12.5,
    fontWeight: '800',
  },
  metaTimeText: {
    color: '#a7f3d0',
    fontSize: 11.5,
    fontWeight: '600',
  },
  heroPrivacy: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 8,
    textAlign: 'right',
    lineHeight: 16,
  },
  bodyContainer: {
    padding: 16,
    marginTop: -8,
  },
  requesterCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
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
    gap: 5,
  },
  requesterName: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '900',
  },
  requesterSub: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 3,
    fontWeight: '700',
  },
  requesterArrow: {
    transform: [{ rotate: '180deg' }],
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
  cardTitle: {
    color: '#0f172a',
    fontSize: 15.5,
    fontWeight: '900',
    textAlign: 'right',
  },
  cardDesc: {
    color: '#334155',
    fontSize: 14,
    lineHeight: 23,
    textAlign: 'right',
    marginBottom: 14,
  },
  budgetBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#dcfce7',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  budgetValue: {
    color: '#15803d',
    fontSize: 13.5,
    fontWeight: '900',
  },
  volunteerBox: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ecfdf5',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  volunteerValue: {
    color: '#065f46',
    fontSize: 13,
    fontWeight: '900',
  },
  noOffersBox: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 6,
  },
  noOffersTitle: {
    color: '#0f172a',
    fontSize: 14.5,
    fontWeight: '900',
    marginTop: 4,
  },
  noOffersSub: {
    color: '#64748b',
    fontSize: 12.5,
    fontWeight: '700',
  },
  offerItem: {
    borderTopWidth: 1,
    borderColor: '#f1f5f9',
    paddingTop: 12,
    marginTop: 10,
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
    gap: 6,
  },
  offerAvatarCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  offerHelperName: {
    color: '#0f172a',
    fontSize: 13.5,
    fontWeight: '900',
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
  offerStatusText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '800',
  },
  offerStatusTextAccepted: {
    color: '#15803d',
  },
  offerMessage: {
    color: '#475569',
    fontSize: 13.5,
    lineHeight: 21,
    textAlign: 'right',
    marginBottom: 10,
  },
  acceptBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#059669',
    borderRadius: 14,
    paddingVertical: 10,
    marginTop: 4,
  },
  acceptBtnText: {
    color: '#fff',
    fontSize: 12.5,
    fontWeight: '900',
  },
  offerActionsRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginTop: 8,
  },
  openChatBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ecfdf5',
    borderRadius: 14,
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
    borderRadius: 14,
    paddingVertical: 10,
  },
  shareLocationBtnText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 12,
  },
  offerFormCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  offerFormTitle: {
    color: '#0f172a',
    fontSize: 15.5,
    fontWeight: '900',
    textAlign: 'right',
  },
  offerFormSub: {
    color: '#64748b',
    fontSize: 12.5,
    textAlign: 'right',
    lineHeight: 18,
    marginBottom: 12,
  },
  offerInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 14,
    textAlign: 'right',
    fontSize: 13.5,
    color: '#0f172a',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minHeight: 80,
    marginBottom: 12,
  },
  sendOfferBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#059669',
    borderRadius: 16,
    paddingVertical: 13,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  sendOfferBtnText: {
    color: '#fff',
    fontSize: 13.5,
    fontWeight: '900',
  },
  guestOfferPrompt: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    marginBottom: 14,
  },
  guestOfferPromptText: {
    color: '#047857',
    fontSize: 13,
    fontWeight: '900',
  },
  deleteBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  deleteBtnText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '900',
  },
  completedBadgeHero: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#d1fae5',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  completedBadgeHeroText: {
    fontSize: 11.5,
    fontWeight: '900',
    color: '#065f46',
  },
  completedStatusCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    marginBottom: 14,
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
  offerStatusCompleted: {
    backgroundColor: '#dcfce7',
    borderColor: '#86efac',
  },
  offerStatusTextCompleted: {
    color: '#15803d',
    fontWeight: '900',
  },
  acceptedOfferWrap: {
    gap: 8,
    marginTop: 6,
  },
  completeWithCoffeeBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#fef3c7',
    borderWidth: 1.5,
    borderColor: '#f59e0b',
    borderRadius: 14,
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
    borderRadius: 14,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  completedHelperBannerText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#065f46',
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
});
