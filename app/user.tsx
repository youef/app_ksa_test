import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View, Alert } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/ui';
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
  BellOff,
  MoreVertical,
} from 'lucide-react-native';

export default function UserProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [p, setP] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [stats, setStats] = useState({ questions: 0, answers: 0, followers: 0, following: 0 });

  useEffect(() => {
    async function load() {
      const { data: u } = await supabase.auth.getUser();
      const myId = u.user?.id || null;
      setCurrentUserId(myId);

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();

      const [qCount, aCount, followersCount, followingCount] = await Promise.all([
        supabase.from('questions').select('id', { count: 'exact', head: true }).eq('author_id', id),
        supabase.from('answers').select('id', { count: 'exact', head: true }).eq('author_id', id),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('following_id', id),
        supabase.from('follows').select('id', { count: 'exact', head: true }).eq('follower_id', id),
      ]);

      if (myId && id) {
        // Follow status
        const { data: followRecord } = await supabase
          .from('follows')
          .select('id')
          .eq('follower_id', myId)
          .eq('following_id', id)
          .maybeSingle();
        setIsFollowing(!!followRecord);

        // Block status
        const { data: blockRecord } = await supabase
          .from('blocks')
          .select('id')
          .eq('blocker_id', myId)
          .eq('blocked_id', id)
          .maybeSingle();
        setIsBlocked(!!blockRecord);
      }

      setP(profile);
      setStats({
        questions: qCount.count || 0,
        answers: aCount.count || 0,
        followers: followersCount.count || 0,
        following: followingCount.count || 0,
      });
      setLoading(false);
    }
    load();
  }, [id]);

  async function toggleFollow() {
    if (!currentUserId) {
      return Alert.alert('تنبيه', 'يجب تسجيل الدخول لمتابعة المستخدمين.');
    }
    if (currentUserId === id) return;

    if (isBlocked) {
      return Alert.alert('تنبيه', 'لا يمكنك متابعة مستخدم قمت بحظره. قم بإلغاء الحظر أولاً.');
    }

    try {
      if (isFollowing) {
        await supabase.from('follows').delete().eq('follower_id', currentUserId).eq('following_id', id);
        setIsFollowing(false);
        setStats(s => ({ ...s, followers: Math.max(0, s.followers - 1) }));
      } else {
        await supabase.from('follows').insert({ follower_id: currentUserId, following_id: id });
        setIsFollowing(true);
        setStats(s => ({ ...s, followers: s.followers + 1 }));
      }
    } catch (e: any) {
      console.log('Follow error:', e);
    }
  }

  // Toggle Block / Unblock user
  function confirmToggleBlock() {
    if (!currentUserId || currentUserId === id) return;

    if (isBlocked) {
      Alert.alert('إلغاء الحظر', 'هل تريد بالتأكيد إلغاء حظر هذا المستخدم؟', [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'إلغاء الحظر',
          onPress: async () => {
            await supabase.from('blocks').delete().eq('blocker_id', currentUserId).eq('blocked_id', id);
            setIsBlocked(false);
            Alert.alert('تم! ✅', 'تم رفع الحظر عن هذا المستخدم.');
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
            await supabase.from('blocks').insert({ blocker_id: currentUserId, blocked_id: id });
            // Also unfollow
            if (isFollowing) {
              await supabase.from('follows').delete().eq('follower_id', currentUserId).eq('following_id', id);
              setIsFollowing(false);
            }
            setIsBlocked(true);
            Alert.alert('تم الحظر 🚫', 'تمت إضافة هذا المستخدم إلى قائمة المحظورين.');
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

    setLoading(true);

    try {
      // 1. Fetch current user's conversations
      const { data: myConvs } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', myId);

      const myConvIds = (myConvs || []).map(c => c.conversation_id);
      let targetConvId = null;

      if (myConvIds.length > 0) {
        const { data: sharedConvs } = await supabase
          .from('conversation_members')
          .select('conversation_id')
          .eq('user_id', id)
          .in('conversation_id', myConvIds);

        if (sharedConvs && sharedConvs.length > 0) {
          targetConvId = sharedConvs[0].conversation_id;
        }
      }

      if (!targetConvId) {
        const { data: newConv, error: convError } = await supabase
          .from('conversations')
          .insert({})
          .select('id')
          .single();

        if (convError) throw convError;
        targetConvId = newConv.id;

        await supabase.from('conversation_members').insert([
          { conversation_id: targetConvId, user_id: currentUserId },
          { conversation_id: targetConvId, user_id: id },
        ]);
      }

      setLoading(false);
      router.push({ pathname: '/conversation', params: { id: targetConvId } });
    } catch (e: any) {
      setLoading(false);
      Alert.alert('خطأ في بدء المحادثة', e.message || 'تعذر بدء المحادثة.');
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={C.accent} />
      </View>
    );
  }

  if (!p) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={{ fontSize: 16, color: C.muted, fontWeight: 'bold' }}>المستخدم غير موجود</Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>رجوع</Text>
        </Pressable>
      </View>
    );
  }

  const isAnonymous = p.hide_name === true;
  const displayName = isAnonymous ? 'جار مجهول 🕶️' : p.display_name || p.username || 'مستخدم';
  const isPrivate = p.profile_privacy === 'private';
  const isLocked = isPrivate && !isFollowing && currentUserId !== id;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.iconBtn}>
          <ChevronRight size={28} color={C.ink} />
        </Pressable>
        <Text style={styles.title}>الملف الشخصي</Text>
        {currentUserId !== id ? (
          <Pressable onPress={confirmToggleBlock} style={styles.iconBtn}>
            <UserX size={22} color={isBlocked ? '#dc2626' : '#94a3b8'} />
          </Pressable>
        ) : (
          <View style={{ width: 28 }} />
        )}
      </View>

      {/* Blocked banner if blocked */}
      {isBlocked && (
        <View style={styles.blockedBanner}>
          <UserX size={18} color="#dc2626" />
          <Text style={styles.blockedBannerText}>لقد قمت بحظر هذا المستخدم</Text>
          <Pressable style={styles.unblockBannerBtn} onPress={confirmToggleBlock}>
            <Text style={styles.unblockBannerBtnText}>إلغاء الحظر</Text>
          </Pressable>
        </View>
      )}

      {/* Profile Card */}
      <View style={styles.card}>
        <View style={styles.avatarContainer}>
          {p.avatar_url && !isAnonymous ? (
            <Image source={{ uri: p.avatar_url }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <UserIcon size={40} color="#fff" />
            </View>
          )}

          {p.is_verified && !isAnonymous && (
            <View style={styles.verifiedBadge}>
              <Shield size={16} color="#fff" />
            </View>
          )}
        </View>

        <Text style={styles.name}>{displayName}</Text>

        {!isAnonymous && (p.city || p.district) && (
          <View style={styles.locationRow}>
            <MapPin size={16} color={C.muted} />
            <Text style={styles.locationText}>
              {p.city} {p.district ? `· ${p.district}` : ''}
            </Text>
          </View>
        )}

        {/* Status badges */}
        <View style={styles.badgesRow}>
          {isPrivate && (
            <View style={styles.badgePill}>
              <Lock size={12} color="#0891b2" />
              <Text style={styles.badgePillText}>حساب خاص</Text>
            </View>
          )}
          {isAnonymous && (
            <View style={[styles.badgePill, { backgroundColor: '#fef3c7' }]}>
              <EyeOff size={12} color="#d97706" />
              <Text style={[styles.badgePillText, { color: '#d97706' }]}>اسم مخفي</Text>
            </View>
          )}
        </View>

        {/* Bio (hidden if locked profile) */}
        {!isLocked && p.bio && !isAnonymous ? <Text style={styles.bio}>{p.bio}</Text> : null}

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.questions}</Text>
            <Text style={styles.statLabel}>أسئلة</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.answers}</Text>
            <Text style={styles.statLabel}>مشاركات</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.followers}</Text>
            <Text style={styles.statLabel}>متابعون</Text>
          </View>
        </View>
      </View>

      {/* Locked Private Account Screen */}
      {isLocked && !isBlocked && (
        <View style={styles.privateCard}>
          <View style={styles.privateIconCircle}>
            <Lock size={32} color="#0891b2" />
          </View>
          <Text style={styles.privateTitle}>هذا الملف الشخصي مقفل 🔒</Text>
          <Text style={styles.privateSubtitle}>
            قام هذا الجار بقفل حسابه لحماية خصوصيته. اضغط على زر المتابعة لمشاهدة منشوراته وأنشطته في الحي.
          </Text>
        </View>
      )}

      {/* Action Buttons Row */}
      {currentUserId !== id && !isBlocked && (
        <View style={styles.actionButtonsRow}>
          <Pressable
            style={[styles.followBtn, isFollowing && styles.followingBtn]}
            onPress={toggleFollow}
          >
            {isFollowing ? (
              <>
                <UserCheck size={20} color="#0891b2" style={{ marginLeft: 6 }} />
                <Text style={styles.followingBtnText}>تتابعه ✓</Text>
              </>
            ) : (
              <>
                <UserPlus size={20} color="#fff" style={{ marginLeft: 6 }} />
                <Text style={styles.followBtnText}>متابعة</Text>
              </>
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.messageBtn, pressed && { opacity: 0.8 }]}
            onPress={handleMessage}
          >
            <MessageCircle size={20} color="#fff" style={{ marginLeft: 6 }} />
            <Text style={styles.messageBtnText}>مراسلة</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: C.bg,
    padding: 20,
    paddingTop: 55,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButton: {
    marginTop: 20,
    backgroundColor: C.accent,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
  },
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  iconBtn: {
    padding: 6,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: C.ink,
  },
  blockedBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
  },
  blockedBannerText: {
    color: '#dc2626',
    fontSize: 13,
    fontWeight: '800',
  },
  unblockBannerBtn: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  unblockBannerBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  card: {
    backgroundColor: C.card,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    elevation: 3,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.02)',
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 14,
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#8da698',
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: C.accent,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: '#fff',
  },
  name: {
    fontSize: 22,
    fontWeight: '900',
    color: C.ink,
    textAlign: 'center',
    marginBottom: 6,
  },
  locationRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 10,
  },
  locationText: {
    fontSize: 13,
    color: C.muted,
    marginRight: 4,
    fontWeight: '600',
  },
  badgesRow: {
    flexDirection: 'row-reverse',
    gap: 6,
    marginBottom: 12,
  },
  badgePill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfeff',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgePillText: {
    color: '#0891b2',
    fontSize: 11,
    fontWeight: '800',
  },
  bio: {
    fontSize: 14,
    color: '#4a5550',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 16,
    paddingHorizontal: 10,
  },
  statsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 26,
    backgroundColor: C.line,
  },
  statNumber: {
    fontSize: 18,
    fontWeight: '900',
    color: C.ink,
    marginBottom: 3,
  },
  statLabel: {
    fontSize: 12,
    color: C.muted,
    fontWeight: '600',
  },
  privateCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  privateIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ecfeff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  privateTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0f172a',
    marginBottom: 6,
  },
  privateSubtitle: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
  },
  actionButtonsRow: {
    flexDirection: 'row-reverse',
    gap: 12,
  },
  followBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    backgroundColor: '#0891b2',
    borderRadius: 16,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  followingBtn: {
    backgroundColor: '#ecfeff',
    borderWidth: 1.5,
    borderColor: '#0891b2',
  },
  followBtnText: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 15,
  },
  followingBtnText: {
    color: '#0891b2',
    fontWeight: '900',
    fontSize: 15,
  },
  messageBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    backgroundColor: '#0f172a',
    borderRadius: 16,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
});
