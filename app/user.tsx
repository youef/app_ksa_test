import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/ui';
import { getBlockStatus, setBlock } from '@/lib/chatControls';
import { isExactDistrictMatching } from '@/lib/locationSync';
import {
  ChevronRight,
  MessageCircle,
  MapPin,
  Shield,
  User as UserIcon,
  UserPlus,
  UserCheck,
  Lock,
  EyeOff,
  UserX,
  Sparkles,
  MoreHorizontal,
  Star,
} from 'lucide-react-native';

export default function UserProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [p, setP] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedByOther, setBlockedByOther] = useState(false);
  const [isFollowedBy, setIsFollowedBy] = useState(false);
  const [followSaving, setFollowSaving] = useState(false);
  const [blockSaving, setBlockSaving] = useState(false);
  const [messageOpening, setMessageOpening] = useState(false);
  const [sameNeighborhood, setSameNeighborhood] = useState(false);
  const [activeTab, setActiveTab] = useState<'questions' | 'requests' | 'services'>('services');
  const [reputation, setReputation] = useState<any>(null);
  const [badges, setBadges] = useState<any[]>([]);
  const [stats, setStats] = useState({ questions: 0, answers: 0, requests: 0, services: 0, followers: 0, following: 0 });
  const [questions, setQuestions] = useState<any[]>([]);
  const [answers, setAnswers] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const [{ data: auth }, { data: profile, error: profileError }] = await Promise.all([
          supabase.auth.getUser(),
          supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
        ]);
        if (profileError) throw profileError;
        if (!active) return;
        const myId = auth.user?.id || null;
        setCurrentUserId(myId);
        setP(profile);
        if (!profile) return;

        let neighborhoodMatch = myId === id;
        if (myId && myId !== id) {
          const { data: myProfile } = await supabase.from('profiles').select('city, district').eq('id', myId).maybeSingle();
          neighborhoodMatch = !!myProfile && isExactDistrictMatching(profile, myProfile.city, myProfile.district);
        }
        setSameNeighborhood(neighborhoodMatch);

        let following = false;
        let followedBy = false;
        let blocked = false;
        let blockedMe = false;
        if (myId && myId !== id) {
          const [followingRes, followedByRes, blockStatus] = await Promise.all([
            supabase.from('follows').select('id').eq('follower_id', myId).eq('following_id', id).maybeSingle(),
            supabase.from('follows').select('id').eq('follower_id', id).eq('following_id', myId).maybeSingle(),
            getBlockStatus(myId, id),
          ]);
          following = !!followingRes.data;
          followedBy = !!followedByRes.data;
          blocked = blockStatus.iBlocked;
          blockedMe = blockStatus.blockedMe;
        }
        if (!active) return;
        setIsFollowing(following);
        setIsFollowedBy(followedBy);
        setIsBlocked(blocked);
        setBlockedByOther(blockedMe);

        const locked = (profile.profile_privacy === 'private' && !following && myId !== id) || (myId !== id && !neighborhoodMatch);
        const hiddenByBlock = blocked || blockedMe;
        const hiddenByAnonymous = profile.hide_name === true && myId !== id;
        if (locked || hiddenByBlock || hiddenByAnonymous) {
          setQuestions([]); setAnswers([]); setRequests([]); setServices([]);
          setStats({ questions: 0, answers: 0, requests: 0, services: 0, followers: 0, following: 0 });
          return;
        }

        const [qCount, aCount, requestCount, serviceCount, followersCount, followingCount, questionRows, answerRows, requestRows, serviceRows, reputationRes, badgesRes] = await Promise.all([
          supabase.from('questions').select('id', { count: 'exact', head: true }).eq('author_id', id),
          supabase.from('answers').select('id', { count: 'exact', head: true }).eq('author_id', id),
          supabase.from('requests').select('id', { count: 'exact', head: true }).eq('requester_id', id),
          supabase.from('services').select('id', { count: 'exact', head: true }).eq('provider_id', id),
          supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', id),
          supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', id),
          supabase.from('questions').select('id, title, body, created_at, city, district, status').eq('author_id', id).order('created_at', { ascending: false }).limit(30),
          supabase.from('answers').select('id, body, created_at, question_id, questions(title)').eq('author_id', id).order('created_at', { ascending: false }).limit(30),
          supabase.from('requests').select('id, title, description, status, request_type, budget, is_urgent, city, district, created_at').eq('requester_id', id).order('created_at', { ascending: false }).limit(30),
          supabase.from('services').select('id, name, description, category, city, district, price_from, price_to, available_now, is_verified, created_at').eq('provider_id', id).order('created_at', { ascending: false }).limit(30),
          supabase.from('reputation').select('points, answers_count, helpful_votes, best_answers').eq('user_id', id).maybeSingle(),
          supabase.from('profile_badges').select('badge_code, awarded_at, badge_definitions(code,name,icon,description)').eq('user_id', id).order('awarded_at', { ascending: false }).limit(8),
        ]);
        if (!active) return;
        setStats({
          questions: qCount.count || 0, answers: aCount.count || 0, requests: requestCount.count || 0,
          services: serviceCount.count || 0, followers: followersCount.count || 0, following: followingCount.count || 0,
        });
        setQuestions(questionRows.data || []);
        setAnswers(answerRows.data || []);
        setRequests(requestRows.data || []);
        setServices(serviceRows.data || []);
        setReputation(reputationRes.data || null);
        setBadges(badgesRes.data || []);
      } catch (error) {
        console.error('Public profile load failed:', error);
        if (active) setP(null);
      } finally {
        if (active) setLoading(false);
      }
    }
    if (id) void load();
    else setLoading(false);
    return () => { active = false; };
  }, [id, refreshKey]);

  async function toggleFollow() {
    if (!currentUserId) {
      return Alert.alert('تنبيه', 'يجب تسجيل الدخول لمتابعة المستخدمين.');
    }
    if (currentUserId === id) return;

    if (isBlocked) {
      return Alert.alert('تنبيه', 'لا يمكنك متابعة مستخدم قمت بحظره. قم بإلغاء الحظر أولاً.');
    }

    if (followSaving) return;
    setFollowSaving(true);
    try {
      if (isFollowing) {
        const { error } = await supabase.rpc('hayna_toggle_follow', { p_target: id });
        if (error) throw error;
        setIsFollowing(false);
        setStats(s => ({ ...s, followers: Math.max(0, s.followers - 1) }));
        setRefreshKey(value => value + 1);
      } else {
        const { data: followed, error } = await supabase.rpc('hayna_toggle_follow', { p_target: id });
        if (error) throw error;
        setIsFollowing(followed === true);
        setStats(s => ({ ...s, followers: followed === true ? s.followers + 1 : s.followers }));
        setRefreshKey(value => value + 1);
      }
    } catch (e: any) {
      Alert.alert('تعذّر تحديث المتابعة', e?.message || 'تحقق من الاتصال ثم أعد المحاولة.');
    } finally {
      setFollowSaving(false);
    }
  }

  // Toggle Block / Unblock user
  function confirmToggleBlock() {
    if (!currentUserId || currentUserId === id || blockSaving) return;

    if (isBlocked) {
      Alert.alert('إلغاء الحظر', 'هل تريد بالتأكيد إلغاء حظر هذا المستخدم؟', [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'إلغاء الحظر',
          onPress: async () => {
            setBlockSaving(true);
            try {
              const result = await setBlock(currentUserId, id, false);
              if (!result.ok) return Alert.alert('تعذّر إلغاء الحظر', result.error);
              setIsBlocked(false);
              setRefreshKey(value => value + 1);
              Alert.alert('تم! ✅', 'تم رفع الحظر عن هذا المستخدم.');
            } finally {
              setBlockSaving(false);
            }
          },
        },
      ]);
    } else {
      Alert.alert('حظر المستخدم 🚫', 'لن يتمكن هذا المستخدم من مراسلتك أو التفاعل معك، ولن تظهر رسائله لك.', [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حظر الآن',
          style: 'destructive',
          onPress: async () => {
            setBlockSaving(true);
            try {
              const result = await setBlock(currentUserId, id, true);
              if (!result.ok) return Alert.alert('تعذّر الحظر', result.error);
              setIsBlocked(true);
              setIsFollowing(false);
              setStats(s => ({ ...s, followers: Math.max(0, s.followers - (isFollowing ? 1 : 0)), following: Math.max(0, s.following - (isFollowedBy ? 1 : 0)) }));
              setQuestions([]); setAnswers([]); setRequests([]); setServices([]);
              setRefreshKey(value => value + 1);
              Alert.alert('تم الحظر 🚫', 'تمت إضافة هذا المستخدم إلى قائمة المحظورين وإزالة علاقات المتابعة بينكما.');
            } finally {
              setBlockSaving(false);
            }
          },
        },
      ]);
    }
  }

  async function handleMessage() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      return Alert.alert('تنبيه', 'يجب تسجيل الدخول أولاً للمراسلة.');
    }
    const myId = u.user.id;

    if (myId === id) {
      return Alert.alert('تنبيه', 'لا يمكنك بدء محادثة مع نفسك.');
    }

    if (isBlocked) {
      return Alert.alert('تنبيه', 'لقد قمت بحظر هذا المستخدم، يرجى إلغاء الحظر أولاً للمراسلة.');
    }

    if (blockedByOther) {
      return Alert.alert('لا يمكن المراسلة', 'هذا المستخدم حظرك، لا يمكنك إرسال رسائل له.');
    }

    if (!sameNeighborhood) {
      return Alert.alert('الحي غير مطابق', 'الرسائل الخاصة متاحة بين سكان الحي نفسه فقط. حدّد حيّك من إعدادات الموقع أولاً.');
    }

    // Check target user's privacy settings
    if (p?.allow_dms === 'nobody') {
      return Alert.alert('الخاص مقفل', 'هذا المستخدم عطل استلام الرسائل الخاصة من الجميع.');
    }

    if (p?.allow_dms === 'followers' && !isFollowing) {
      return Alert.alert(
        'المتابعون فقط',
        'يقبل هذا المستخدم الرسائل من متابعيه فقط. يمكنك متابعته للتمكن من مراسلته.',
        [
          { text: 'إلغاء', style: 'cancel' },
          { text: 'متابعة الآن', onPress: toggleFollow },
        ]
      );
    }

    if (messageOpening) return;
    setMessageOpening(true);

    try {
      const { data: targetConvId, error: convError } = await supabase.rpc('hayna_get_or_create_direct_conversation', { p_target: id });
      if (convError) throw convError;
      if (!targetConvId) throw new Error('تعذر إنشاء المحادثة');
      router.push({ pathname: '/conversation', params: { id: targetConvId } });
    } catch (e: any) {
      Alert.alert('خطأ في بدء المحادثة', e.message || 'تعذر بدء المحادثة.');
    } finally {
      setMessageOpening(false);
    }
  }

  if (loading) {
    return <View style={styles.loadingContainer}><ActivityIndicator size="large" color={C.accent} /><Text style={styles.loadingText}>جاري تحميل الملف الشخصي…</Text></View>;
  }

  if (!p) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorTitle}>تعذر العثور على هذا الحساب</Text>
        <Pressable style={styles.backButton} onPress={() => router.replace('/home')}><Text style={styles.backButtonText}>رجوع</Text></Pressable>
      </View>
    );
  }

  const isAnonymous = p.hide_name === true;
  const displayName = isAnonymous ? 'جار مجهول' : p.display_name || p.username || 'مستخدم';
  const isPrivate = p.profile_privacy === 'private';
  const isOwnProfile = currentUserId === id;
  const isLocked = isPrivate && !isFollowing && !isOwnProfile;
  const restricted = isLocked || (isAnonymous && !isOwnProfile);
  const statusLabel: Record<string, string> = { open: 'مفتوح', accepted: 'تم قبول المساعدة', closed: 'مكتمل', pending: 'قيد المراجعة' };
  const tabs = [
    { key: 'services' as const, label: 'الخدمات', count: stats.services },
    { key: 'questions' as const, label: 'الاستفسارات', count: stats.questions },
    { key: 'requests' as const, label: 'الطلبات', count: stats.requests },
  ];

  return (
    <View style={styles.screen}>
      <View style={styles.ambientOrbOne} />
      <View style={styles.ambientOrbTwo} />
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Pressable onPress={() => router.replace('/home')} style={styles.topIconButton} accessibilityLabel="رجوع"><ChevronRight size={23} color="#0f172a" /></Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.topTitle}>الملف الشخصي</Text>
            {!!p.username && <Text style={styles.topSubtitle}>@{p.username}</Text>}
          </View>
          {isOwnProfile ? (
            <Pressable onPress={() => router.push('/profile')} style={styles.topIconButton} accessibilityLabel="إعدادات الملف"><UserIcon size={20} color="#0f172a" /></Pressable>
          ) : currentUserId ? (
            <Pressable onPress={isBlocked ? undefined : confirmToggleBlock} disabled={blockSaving || isBlocked} style={styles.topIconButton} accessibilityLabel={isBlocked ? 'هذا الحساب محظور' : 'حظر المستخدم'}>
              {blockSaving ? <ActivityIndicator size="small" color="#dc2626" /> : <UserX size={20} color={isBlocked ? '#dc2626' : '#64748b'} />}
            </Pressable>
          ) : <View style={styles.topIconButton} />}
        </View>

        {isBlocked && (
          <View style={styles.blockedNotice}><UserX size={16} color="#dc2626" /><Text style={styles.blockedNoticeText}>تم حظر هذا المستخدم. ستظهر منشوراته، لكن المتابعة والمراسلة متوقفتان.</Text><Pressable onPress={confirmToggleBlock} style={styles.noticeAction}><Text style={styles.noticeActionText}>إلغاء الحظر</Text></Pressable></View>
        )}
        {blockedByOther && (
          <View style={styles.blockedNotice}><Lock size={16} color="#dc2626" /><Text style={styles.blockedNoticeText}>هذا المستخدم حظرك. يمكنك الاطلاع على منشوراته العامة فقط.</Text></View>
        )}


        <View style={styles.profileCard}>
          <LinearGradient colors={["#064e3b", "#047857", "#059669"]} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.profileHero}>
          <View style={styles.profileActionsTop}>
            <View style={styles.avatarWrap}>
              {p.avatar_url && !isAnonymous ? <Image source={{ uri: p.avatar_url }} style={styles.avatarImage} /> : <View style={styles.avatarPlaceholder}><UserIcon size={38} color="#64748b" /></View>}
              {!isAnonymous && p.is_verified && <View style={styles.avatarVerified}><Shield size={14} color="#fff" /></View>}
            </View>
            {currentUserId !== id && !isBlocked && !blockedByOther && (
              <View style={styles.actionButtonsRow}>
                <Pressable style={[styles.followButton, isFollowing && styles.followingButton]} onPress={toggleFollow} disabled={followSaving}>
                  {followSaving ? <ActivityIndicator size="small" color={isFollowing ? '#059669' : '#fff'} /> : isFollowing ? <><UserCheck size={17} color="#059669" /><Text style={styles.followingButtonText}>تتابعه</Text></> : <><UserPlus size={17} color="#fff" /><Text style={styles.followButtonText}>متابعة</Text></>}
                </Pressable>
                <Pressable style={[styles.messageButton, (!sameNeighborhood || p.allow_dms === 'nobody' || messageOpening) && { opacity: 0.55 }]} onPress={handleMessage} disabled={messageOpening || !sameNeighborhood || p.allow_dms === 'nobody' || (p.allow_dms === 'followers' && !isFollowing)}>
                  {messageOpening ? <ActivityIndicator size="small" color="#fff" /> : <MessageCircle size={17} color="#fff" />}
                  <Text style={styles.messageButtonText}>{messageOpening ? 'جارٍ فتح المحادثة' : !sameNeighborhood ? 'حي غير مطابق' : p.allow_dms === 'nobody' ? 'الخاص مغلق' : p.allow_dms === 'followers' && !isFollowing ? 'للمتابعين فقط' : 'مراسلة'}</Text>
                </Pressable>
              </View>
            )}
            {isOwnProfile && <Pressable style={styles.editButton} onPress={() => router.push('/profile')}><Text style={styles.editButtonText}>إدارة ملفي</Text></Pressable>}
          </View>

          <View style={styles.heroIdentity}>
            <View style={styles.heroTitleRow}><Sparkles size={14} color="#a7f3d0" /><Text style={styles.heroEyebrow}>ملف من الحي</Text></View>
            <Text style={styles.displayName}>{displayName}</Text>
          {!isAnonymous && !!p.username && <Text style={styles.handle}>@{p.username}</Text>}
          </View>
          {!isAnonymous && (p.city || p.district) && (
            <View style={styles.locationLine}><MapPin size={15} color="#64748b" /><Text style={styles.locationText}>{[p.district && `حي ${p.district}`, p.city].filter(Boolean).join('، ')}</Text></View>
          )}
          {!isLocked && !isAnonymous && !!p.bio && <Text style={styles.bio}>{p.bio}</Text>}

          <View style={styles.badgesRow}>
            {p.is_verified && !isAnonymous && <View style={[styles.badge, styles.officialBadge]}><Shield size={14} color="#2563eb" /><Text style={styles.officialBadgeText}>هوية معتمدة</Text></View>}
            {p.is_geoverified && !isAnonymous && <View style={[styles.badge, styles.locationBadge]}><MapPin size={14} color="#047857" /><Text style={styles.locationBadgeText}>فحص قرب الموقع</Text></View>}
            {p.role === 'admin' || p.role === 'moderator' ? <View style={[styles.badge, styles.staffBadge]}><Shield size={14} color="#7c3aed" /><Text style={styles.staffBadgeText}>إدارة المنصة</Text></View> : null}
            {isPrivate && <View style={[styles.badge, styles.privateBadge]}><Lock size={13} color="#475569" /><Text style={styles.privateBadgeText}>حساب خاص</Text></View>}
            {isAnonymous && <View style={[styles.badge, styles.anonymousBadge]}><EyeOff size={13} color="#b45309" /><Text style={styles.anonymousBadgeText}>الاسم مخفي</Text></View>}
          </View>
          {p.is_geoverified && !isAnonymous && <Text style={styles.badgeNote}>فحص الموقع تقريبي حول المدينة، ولا يثبت السكن في حي محدد.</Text>}

          </LinearGradient>
          <View style={styles.statsGrid}>
            {[
              ['استفسار', stats.questions], ['طلب مساعدة', stats.requests], ['خدمة', stats.services],
              ['متابع', stats.followers], ['يتابع', stats.following],
            ].map(([label, value]) => <View key={String(label)} style={styles.statCell}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>)}
          </View>
          {isFollowedBy && !isOwnProfile && !restricted && <Text style={styles.mutualNote}>يتابعك هذا الحساب أيضاً</Text>}
          {!restricted && (reputation || badges.length > 0) && <View style={styles.rewardCard}>
            <View style={styles.rewardHeader}><Text style={styles.rewardTitle}>أثره في الحي</Text><Text style={styles.rewardPoints}>{reputation?.points || 0} نقطة</Text></View>
            <View style={styles.rewardStats}><Text style={styles.rewardStat}>💡 {reputation?.answers_count || 0} ردود</Text><Text style={styles.rewardStat}>🏆 {reputation?.best_answers || 0} أفضل إجابة</Text><Text style={styles.rewardStat}>🤝 {reputation?.helpful_votes || 0} مفيدة</Text></View>
            {badges.length > 0 && <View style={styles.badgesRow}>{badges.map((b:any) => <View key={b.badge_code} style={styles.rewardBadge}><Text style={styles.rewardBadgeIcon}>{b.badge_definitions?.icon || '🏅'}</Text><Text style={styles.rewardBadgeText}>{b.badge_definitions?.name || b.badge_code}</Text></View>)}</View>}
          </View>}
        </View>

        {isLocked && !isBlocked && !blockedByOther && (
          <View style={styles.lockedCard}>
            <View style={styles.lockIcon}><Lock size={25} color="#059669" /></View>
            <Text style={styles.lockedTitle}>هذا الحساب خاص</Text>
            <Text style={styles.lockedText}>تابع الحساب أولاً ليظهر لك نشاطه وطلباته وخدماته.</Text>
          </View>
        )}
        {isAnonymous && !isOwnProfile && !isLocked && !isBlocked && !blockedByOther && (
          <View style={styles.lockedCard}><View style={styles.lockIcon}><EyeOff size={24} color="#b45309" /></View><Text style={styles.lockedTitle}>نشاط هذا الحساب مجهول</Text><Text style={styles.lockedText}>لا نعرض منشورات أو طلبات مرتبطة بحساب يختار إخفاء اسمه.</Text></View>
        )}

        {!restricted && (
          <>
            <View style={styles.sectionHeading}><View><Text style={styles.sectionTitle}>نشاط الحي</Text><Text style={styles.sectionSubtitle}>ما يقدمه هذا العضو للمجتمع</Text></View><View style={styles.sectionIcon}><Star size={17} color="#047857" /></View></View>
            <View style={styles.tabs}>
              {tabs.map(tab => <Pressable key={tab.key} onPress={() => setActiveTab(tab.key)} style={styles.tab}>
                <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
                <Text style={[styles.tabCount, activeTab === tab.key && styles.tabTextActive]}>{tab.count}</Text>
                {activeTab === tab.key && <View style={styles.tabIndicator} />}
              </Pressable>)}
            </View>

            {activeTab === 'questions' && (questions.length ? questions.map(item => (
              <Pressable key={item.id} style={styles.contentItem} onPress={() => router.push({ pathname: '/question', params: { id: item.id } })}>
                <View style={styles.itemIcon}><MessageCircle size={18} color="#059669" /></View>
                <View style={styles.itemBody}><View style={styles.itemMetaRow}><Text style={styles.itemEyebrow}>استفسار</Text><Text style={styles.itemDate}>{new Date(item.created_at).toLocaleDateString('ar-SA')}</Text></View><Text style={styles.itemTitle}>{item.title}</Text><Text style={styles.itemDescription} numberOfLines={4}>{item.body}</Text><Text style={styles.itemFooter}>{statusLabel[item.status] || item.status || 'منشور'}{item.district ? ` · حي ${item.district}` : ''}</Text></View>
              </Pressable>
            )) : <Text style={styles.emptyState}>لا توجد استفسارات منشورة.</Text>)}

            {activeTab === 'requests' && (requests.length ? requests.map(item => (
              <Pressable key={item.id} style={styles.contentItem} onPress={() => router.push({ pathname: '/request', params: { id: item.id } })}>
                <View style={[styles.itemIcon, item.is_urgent && styles.urgentIcon]}><UserX size={18} color={item.is_urgent ? '#dc2626' : '#059669'} /></View>
                <View style={styles.itemBody}><View style={styles.itemMetaRow}><Text style={[styles.itemEyebrow, item.is_urgent && { color: '#dc2626' }]}>{item.is_urgent ? 'طلب عاجل' : 'طلب مساعدة'}</Text><Text style={styles.itemDate}>{new Date(item.created_at).toLocaleDateString('ar-SA')}</Text></View><Text style={styles.itemTitle}>{item.title}</Text><Text style={styles.itemDescription} numberOfLines={4}>{item.description}</Text><Text style={styles.itemFooter}>{statusLabel[item.status] || item.status}{item.district || item.city ? ` · ${[item.district && `حي ${item.district}`, item.city].filter(Boolean).join('، ')}` : ''}{item.budget ? ` · الميزانية ${item.budget} ر.س` : ''}</Text></View>
              </Pressable>
            )) : <Text style={styles.emptyState}>لا توجد طلبات مساعدة.</Text>)}

            {activeTab === 'services' && (services.length ? services.map(item => (
              <Pressable key={item.id} style={styles.contentItem} onPress={() => router.push({ pathname: '/service', params: { id: item.id } })}>
                <View style={[styles.itemIcon, styles.serviceIcon]}><Shield size={18} color="#7c3aed" /></View>
                <View style={styles.itemBody}><View style={styles.itemMetaRow}><Text style={styles.itemEyebrow}>خدمة {item.is_verified ? '· موثقة' : ''}</Text><Text style={[styles.availability, !item.available_now && styles.unavailable]}>{item.available_now ? 'متاح الآن' : 'غير متاح'}</Text></View><Text style={styles.itemTitle}>{item.name}</Text><Text style={styles.itemDescription} numberOfLines={4}>{item.description || item.category || 'خدمة محلية'}</Text><Text style={styles.itemFooter}>{[item.category, item.district && `حي ${item.district}`, item.city].filter(Boolean).join(' · ')}{item.price_from != null ? ` · ${item.price_from}${item.price_to != null ? `–${item.price_to}` : '+'} ر.س` : ''}</Text></View>
              </Pressable>
            )) : <Text style={styles.emptyState}>لا توجد خدمات معلنة.</Text>)}

            {false && activeTab === 'questions' && answers.length > 0 && (answers.length ? answers.map(item => (
              <Pressable key={item.id} style={styles.contentItem} onPress={() => router.push({ pathname: '/question', params: { id: item.question_id } })}>
                <View style={styles.itemIcon}><MessageCircle size={18} color="#2563eb" /></View>
                <View style={styles.itemBody}><View style={styles.itemMetaRow}><Text style={styles.itemEyebrow}>رد على استفسار</Text><Text style={styles.itemDate}>{new Date(item.created_at).toLocaleDateString('ar-SA')}</Text></View><Text style={styles.itemTitle}>{item.questions?.title || 'استفسار من الحي'}</Text><Text style={styles.itemDescription}>{item.body}</Text></View>
              </Pressable>
            )) : <Text style={styles.emptyState}>لا توجد ردود بعد.</Text>)}
          </>
        )}
        <View style={{ height: 48 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc', overflow: 'hidden' },
  ambientOrbOne: { position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(16,185,129,0.07)', top: 120, left: -150 },
  ambientOrbTwo: { position: 'absolute', width: 210, height: 210, borderRadius: 105, backgroundColor: 'rgba(6,95,70,0.05)', bottom: 100, right: -120 },
  page: { paddingHorizontal: 16, paddingTop: 38, paddingBottom: 30 },
  loadingContainer: { flex: 1, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { color: '#64748b', fontSize: 13, fontWeight: '700' },
  errorTitle: { color: '#0f172a', fontSize: 17, fontWeight: '900', textAlign: 'center' },
  backButton: { marginTop: 14, backgroundColor: C.accent, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 12 },
  backButtonText: { color: '#fff', fontWeight: '800' },
  topBar: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginBottom: 16 },
  topIconButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#e2e8f0' },
  topTitle: { color: '#0f172a', fontSize: 17, fontWeight: '900', textAlign: 'right' },
  topSubtitle: { color: '#64748b', fontSize: 12, textAlign: 'right', marginTop: 1 },
  blockedNotice: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 14, padding: 12, marginBottom: 12 },
  blockedNoticeText: { flex: 1, color: '#991b1b', fontSize: 12, fontWeight: '800', textAlign: 'right', lineHeight: 18 },
  noticeBanner: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, borderRadius: 14, padding: 12, marginBottom: 12 },
  mutedNotice: { backgroundColor: '#f1f5f9', borderWidth: 1, borderColor: '#cbd5e1' },
  noticeText: { flex: 1, color: '#334155', fontSize: 12, fontWeight: '700', textAlign: 'right' },
  noticeAction: { backgroundColor: '#dc2626', borderRadius: 9, paddingHorizontal: 11, paddingVertical: 7 },
  noticeActionText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  profileCard: { backgroundColor: '#fff', borderRadius: 24, padding: 0, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 14, overflow: 'hidden', shadowColor: '#0f172a', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.07, shadowRadius: 20, elevation: 3 },
  profileHero: { padding: 18, paddingBottom: 20 },
  heroIdentity: { marginTop: 8, alignItems: 'flex-end' },
  heroTitleRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, marginBottom: 4 },
  heroEyebrow: { color: '#a7f3d0', fontSize: 10, fontWeight: '900' },
  profileActionsTop: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  avatarWrap: { width: 82, height: 82, borderRadius: 41, position: 'relative' },
  avatarImage: { width: 82, height: 82, borderRadius: 41, backgroundColor: '#e2e8f0' },
  avatarPlaceholder: { width: 82, height: 82, borderRadius: 41, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  avatarVerified: { position: 'absolute', left: 0, bottom: 0, width: 25, height: 25, borderRadius: 13, backgroundColor: '#2563eb', borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  actionButtonsRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-start', marginRight: 12 },
  followButton: { minWidth: 106, height: 42, borderRadius: 22, backgroundColor: '#059669', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 14 },
  followingButton: { backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0' },
  followButtonText: { color: '#fff', fontWeight: '900', fontSize: 13 },
  followingButtonText: { color: '#047857', fontWeight: '900', fontSize: 13 },
  messageButton: { minWidth: 94, height: 42, borderRadius: 22, backgroundColor: '#0f172a', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 13 },
  messageButtonText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  editButton: { height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#cbd5e1', justifyContent: 'center', paddingHorizontal: 13 },
  editButtonText: { color: '#0f172a', fontWeight: '800', fontSize: 12 },
  displayName: { color: '#fff', fontSize: 25, fontWeight: '900', textAlign: 'right' },
  handle: { color: '#d1fae5', fontSize: 12, textAlign: 'right', marginTop: 2 },
  locationLine: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, marginTop: 10, paddingHorizontal: 18 },
  locationText: { color: '#64748b', fontSize: 13 },
  bio: { color: '#334155', fontSize: 14, lineHeight: 22, textAlign: 'right', marginTop: 11, paddingHorizontal: 18 },
  badgesRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 7, marginTop: 12, paddingHorizontal: 18 },
  badge: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  officialBadge: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  officialBadgeText: { color: '#1d4ed8', fontSize: 11, fontWeight: '800' },
  locationBadge: { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' },
  locationBadgeText: { color: '#047857', fontSize: 11, fontWeight: '800' },
  staffBadge: { backgroundColor: '#f5f3ff', borderColor: '#ddd6fe' },
  staffBadgeText: { color: '#6d28d9', fontSize: 11, fontWeight: '800' },
  privateBadge: { backgroundColor: '#f8fafc', borderColor: '#e2e8f0' },
  privateBadgeText: { color: '#475569', fontSize: 11, fontWeight: '800' },
  anonymousBadge: { backgroundColor: '#fffbeb', borderColor: '#fde68a' },
  anonymousBadgeText: { color: '#b45309', fontSize: 11, fontWeight: '800' },
  badgeNote: { color: '#64748b', fontSize: 11, lineHeight: 16, textAlign: 'right', marginTop: 7 },
  statsGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', borderTopWidth: 1, borderColor: '#f1f5f9', marginTop: 6, paddingTop: 9, paddingHorizontal: 10, paddingBottom: 5 },
  statCell: { width: '33.333%', alignItems: 'center', paddingVertical: 9 },
  statValue: { color: '#0f172a', fontSize: 16, fontWeight: '900' },
  statLabel: { color: '#64748b', fontSize: 11, marginTop: 2 },
  mutualNote: { textAlign: 'right', color: '#059669', fontSize: 11, fontWeight: '700', marginTop: 7 },
  rewardCard: { marginTop: 14, padding: 14, borderRadius: 18, backgroundColor: '#f8fffb', borderWidth: 1, borderColor: '#d1fae5' },
  rewardHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  rewardTitle: { color: '#064e3b', fontSize: 14, fontWeight: '900' },
  rewardPoints: { color: '#047857', fontSize: 15, fontWeight: '900' },
  rewardStats: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, marginTop: 9 },
  rewardStat: { color: '#475569', fontSize: 11, fontWeight: '800' },
  rewardBadge: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#d1fae5', paddingHorizontal: 8, paddingVertical: 5 },
  rewardBadgeIcon: { fontSize: 14 },
  rewardBadgeText: { color: '#065f46', fontSize: 10, fontWeight: '900' },
  lockedCard: { backgroundColor: '#fff', borderRadius: 20, alignItems: 'center', padding: 24, marginBottom: 14, borderWidth: 1, borderColor: '#e2e8f0' },
  lockIcon: { width: 54, height: 54, borderRadius: 27, backgroundColor: '#ecfdf5', alignItems: 'center', justifyContent: 'center', marginBottom: 11 },
  lockedTitle: { color: '#0f172a', fontSize: 17, fontWeight: '900', textAlign: 'center' },
  lockedText: { color: '#64748b', fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 6 },
  sectionHeading: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingTop: 16, paddingBottom: 10 },
  sectionTitle: { color: '#0f172a', fontSize: 17, fontWeight: '900', textAlign: 'right' },
  sectionSubtitle: { color: '#94a3b8', fontSize: 10, fontWeight: '700', textAlign: 'right', marginTop: 2 },
  sectionIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#ecfdf5', alignItems: 'center', justifyContent: 'center' },
  tabs: { flexDirection: 'row-reverse', backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, borderBottomWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden', marginHorizontal: 0 },
  tab: { flex: 1, minHeight: 54, alignItems: 'center', justifyContent: 'center', position: 'relative', gap: 2 },
  tabText: { color: '#64748b', fontSize: 11, fontWeight: '700' },
  tabTextActive: { color: '#047857', fontWeight: '900' },
  tabCount: { color: '#94a3b8', fontSize: 10 },
  tabIndicator: { position: 'absolute', bottom: 0, width: '56%', height: 3, backgroundColor: '#059669', borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  contentItem: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 10, padding: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#e2e8f0' },
  itemIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#ecfdf5', alignItems: 'center', justifyContent: 'center' },
  urgentIcon: { backgroundColor: '#fef2f2' },
  serviceIcon: { backgroundColor: '#f5f3ff' },
  itemBody: { flex: 1, alignItems: 'flex-end' },
  itemMetaRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 8 },
  itemEyebrow: { color: '#059669', fontSize: 11, fontWeight: '900' },
  itemDate: { color: '#94a3b8', fontSize: 10 },
  itemTitle: { color: '#0f172a', fontSize: 15, fontWeight: '900', textAlign: 'right', width: '100%', marginTop: 5 },
  itemDescription: { color: '#475569', fontSize: 13, lineHeight: 20, textAlign: 'right', width: '100%', marginTop: 4 },
  itemFooter: { color: '#64748b', fontSize: 11, textAlign: 'right', width: '100%', marginTop: 8 },
  availability: { color: '#047857', fontSize: 10, fontWeight: '800' },
  unavailable: { color: '#64748b' },
  emptyState: { backgroundColor: '#fff', color: '#64748b', fontSize: 13, textAlign: 'center', paddingHorizontal: 15, paddingVertical: 34, borderBottomLeftRadius: 16, borderBottomRightRadius: 16 },
});
