import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppHeader } from '@/components/shared/AppHeader';
import { useBottomNavInset } from '@/lib/bottomNav';
import { supabase } from '@/lib/supabase';
import { UserRound, Users, Search, RefreshCw, UserMinus, BadgeCheck, ChevronLeft, UserPlus, Sparkles, Inbox } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

type SocialProfile = { id: string; display_name: string | null; username?: string | null; avatar_url: string | null; account_type: string | null; is_verified?: boolean | null };
type Tab = 'following' | 'followers';

export default function ConnectedSocialScreen() {
  const bottomNavInset = useBottomNavInset();
  const [tab, setTab] = useState<Tab>('following');
  const [followingList, setFollowingList] = useState<SocialProfile[]>([]);
  const [followersList, setFollowersList] = useState<SocialProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [uid, setUid] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError('');
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!auth.user) { setUid(null); setFollowingList([]); setFollowersList([]); return; }
      setUid(auth.user.id);
      const [followingRes, followersRes] = await Promise.all([
        supabase.from('follows').select('following_id,created_at').eq('follower_id', auth.user.id).order('created_at', { ascending: false }),
        supabase.from('follows').select('follower_id,created_at').eq('following_id', auth.user.id).order('created_at', { ascending: false }),
      ]);
      if (followingRes.error) throw followingRes.error;
      if (followersRes.error) throw followersRes.error;
      const followingIds = (followingRes.data || []).map((r: any) => r.following_id);
      const followerIds = (followersRes.data || []).map((r: any) => r.follower_id);
      const [followingProfiles, followerProfiles] = await Promise.all([
        followingIds.length ? supabase.from('profiles').select('id,display_name,username,avatar_url,account_type,is_verified').in('id', followingIds) : Promise.resolve({ data: [], error: null }),
        followerIds.length ? supabase.from('profiles').select('id,display_name,username,avatar_url,account_type,is_verified').in('id', followerIds) : Promise.resolve({ data: [], error: null }),
      ]);
      if (followingProfiles.error) throw followingProfiles.error;
      if (followerProfiles.error) throw followerProfiles.error;
      const sortByName = (a: SocialProfile, b: SocialProfile) => (a.display_name || a.username || '').localeCompare(b.display_name || b.username || '', 'ar');
      setFollowingList(((followingProfiles.data || []) as SocialProfile[]).sort(sortByName));
      setFollowersList(((followerProfiles.data || []) as SocialProfile[]).sort(sortByName));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحميل قوائم المتابعة.');
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const list = tab === 'following' ? followingList : followersList;
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) => [p.display_name || '', p.username || '', p.account_type || ''].some((v) => v.toLowerCase().includes(q)));
  }, [list, query]);

  const unfollow = (person: SocialProfile) => {
    if (!uid) return;
    Alert.alert('إلغاء المتابعة', `هل تريد إلغاء متابعة ${person.display_name || person.username || 'هذا الحساب'}؟`, [
      { text: 'إبقاء المتابعة', style: 'cancel' },
      { text: 'إلغاء المتابعة', style: 'destructive', onPress: async () => {
        const before = followingList;
        setFollowingList((rows) => rows.filter((p) => p.id !== person.id));
        const { error: deleteError } = await supabase.from('follows').delete().eq('follower_id', uid).eq('following_id', person.id);
        if (deleteError) { setFollowingList(before); Alert.alert('تعذّر إلغاء المتابعة', deleteError.message); }
      } },
    ]);
  };

  return (
    <View style={styles.screen}>
      <AppHeader variant="sub" title="المتابعون" subtitle="علاقاتك ومجتمعك في حيّنا" fallbackRoute="/more" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content,{paddingBottom:bottomNavInset+28}]}>
        <LinearGradient colors={['#082F49','#075985','#0E7490']} start={{x:0,y:0}} end={{x:1,y:1}} style={styles.hero}>
          <View style={styles.heroTop}><View style={styles.heroIcon}><Users size={25} color="#CFFAFE"/></View><View style={styles.heroBadge}><Sparkles size={12} color="#CFFAFE"/><Text style={styles.heroBadgeText}>مجتمعك الأقرب</Text></View></View>
          <Text style={styles.heroTitle}>ابقَ على تواصل مع جيرانك</Text>
          <Text style={styles.heroDesc}>تابع الحسابات التي تهمك واكتشف من يتابعك داخل مجتمع حيّنا.</Text>
          <View style={styles.stats}><Stat value={String(followersList.length)} label="متابعون"/><View style={styles.statDivider}/><Stat value={String(followingList.length)} label="أتابعهم"/></View>
        </LinearGradient>

        <View style={styles.tabs}>
          <Pressable onPress={() => setTab('following')} style={[styles.tab,tab==='following'&&styles.tabActive]}><UserPlus size={16} color={tab==='following'?'#0369A1':'#64748B'}/><Text style={[styles.tabText,tab==='following'&&styles.tabTextActive]}>أتابعهم</Text><View style={[styles.tabCount,tab==='following'&&styles.tabCountActive]}><Text style={[styles.tabCountText,tab==='following'&&styles.tabCountTextActive]}>{followingList.length}</Text></View></Pressable>
          <Pressable onPress={() => setTab('followers')} style={[styles.tab,tab==='followers'&&styles.tabActive]}><Users size={16} color={tab==='followers'?'#0369A1':'#64748B'}/><Text style={[styles.tabText,tab==='followers'&&styles.tabTextActive]}>يتابعونني</Text><View style={[styles.tabCount,tab==='followers'&&styles.tabCountActive]}><Text style={[styles.tabCountText,tab==='followers'&&styles.tabCountTextActive]}>{followersList.length}</Text></View></Pressable>
        </View>

        <View style={styles.searchBox}><Search size={17} color="#94A3B8"/><TextInput value={query} onChangeText={setQuery} placeholder="ابحث بالاسم أو اسم المستخدم أو نوع الحساب" placeholderTextColor="#94A3B8" style={styles.searchInput}/><Pressable onPress={() => void load(true)} style={styles.refresh}><RefreshCw size={15} color="#475569"/></Pressable></View>

        {loading ? <View style={styles.state}><ActivityIndicator size="large" color="#0284C7"/><Text style={styles.stateText}>جارٍ تحميل المجتمع...</Text></View> :
          error ? <View style={styles.state}><Text style={styles.stateTitle}>تعذّر تحميل القائمة</Text><Text style={styles.stateText}>{error}</Text><Pressable onPress={() => void load()} style={styles.retry}><RefreshCw size={14} color="#0369A1"/><Text style={styles.retryText}>إعادة المحاولة</Text></Pressable></View> :
          !uid ? <View style={styles.state}><View style={styles.emptyIcon}><UserRound size={25} color="#0284C7"/></View><Text style={styles.stateTitle}>سجّل الدخول أولًا</Text><Text style={styles.stateText}>ستظهر هنا قائمة الأشخاص الذين تتابعهم ومن يتابعك.</Text><Pressable onPress={() => router.push('/auth')} style={styles.retry}><Text style={styles.retryText}>تسجيل الدخول</Text><ChevronLeft size={15} color="#0369A1"/></Pressable></View> :
          visible.length ? <View style={styles.list}>{visible.map((person) => {
            const name = person.display_name || person.username || 'جارٍ من حيّنا';
            return <View key={person.id} style={styles.personCard}>
              {person.avatar_url ? <Image source={{uri:person.avatar_url}} style={styles.avatar}/> : <View style={styles.avatarFallback}><Text style={styles.avatarLetter}>{name.slice(0,1)}</Text></View>}
              <View style={styles.personInfo}><View style={styles.nameRow}><Text numberOfLines={1} style={styles.personName}>{name}</Text>{person.is_verified ? <BadgeCheck size={14} color="#0284C7"/> : null}</View><Text style={styles.handle}>@{person.username || 'neighbor'}</Text><View style={styles.metaRow}><View style={styles.onlineDot}/><Text style={styles.accountType}>{person.account_type && person.account_type !== 'standard' ? (person.account_type==='merchant'?'نشاط تجاري':person.account_type==='freelance'?'عمل حر':person.account_type==='provider'?'مقدم خدمة':person.account_type) : 'عضو في مجتمع حيّنا'}</Text></View></View>
              {tab==='following' ? <Pressable onPress={() => unfollow(person)} style={styles.unfollowButton}><UserMinus size={14} color="#B91C1C"/><Text style={styles.unfollowText}>إلغاء</Text></Pressable> : <View style={styles.followerBadge}><Users size={13} color="#0369A1"/><Text style={styles.followerBadgeText}>متابع</Text></View>}
            </View>;
          })}</View> :
          <View style={styles.state}><View style={styles.emptyIcon}><Inbox size={25} color="#94A3B8"/></View><Text style={styles.stateTitle}>{query ? 'لا توجد نتائج مطابقة' : tab==='following' ? 'لم تبدأ المتابعة بعد' : 'لا يوجد متابعون حتى الآن'}</Text><Text style={styles.stateText}>{query ? 'جرّب اسمًا آخر أو امسح البحث.' : tab==='following' ? 'عندما تتابع حسابًا، سيظهر هنا لتصل إلى محتواه بسهولة.' : 'شارك في مجتمع الحي وأكمل ملفك ليتمكن الجيران من العثور عليك.'}</Text>{query ? <Pressable onPress={() => setQuery('')} style={styles.retry}><Text style={styles.retryText}>مسح البحث</Text></Pressable> : null}</View>
        }
        <Text style={styles.privacyNote}>يمكنك إدارة علاقات المتابعة في أي وقت.</Text>
      </ScrollView>
    </View>
  );
}

function Stat({value,label}:{value:string;label:string}) { return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>; }

const styles = StyleSheet.create({
  screen:{flex:1,backgroundColor:'#F4F7FB'},content:{padding:16,gap:13},
  hero:{borderRadius:25,padding:18,gap:12},heroTop:{flexDirection:'row-reverse',alignItems:'center',justifyContent:'space-between'},heroIcon:{width:48,height:48,borderRadius:16,backgroundColor:'rgba(255,255,255,0.14)',alignItems:'center',justifyContent:'center'},heroBadge:{flexDirection:'row-reverse',alignItems:'center',gap:5,backgroundColor:'rgba(255,255,255,0.12)',paddingHorizontal:9,paddingVertical:6,borderRadius:30},heroBadgeText:{fontSize:10,fontWeight:'900',color:'#CFFAFE'},heroTitle:{fontSize:21,fontWeight:'900',color:'#fff',textAlign:'right'},heroDesc:{fontSize:12,color:'#CFFAFE',lineHeight:20,textAlign:'right'},stats:{flexDirection:'row-reverse',alignItems:'center',gap:18,marginTop:2},stat:{alignItems:'center',gap:3,minWidth:70},statValue:{fontSize:20,fontWeight:'900',color:'#fff'},statLabel:{fontSize:10,fontWeight:'700',color:'#CFFAFE'},statDivider:{width:1,height:30,backgroundColor:'rgba(255,255,255,0.25)'},
  tabs:{flexDirection:'row-reverse',backgroundColor:'#fff',padding:5,borderWidth:1,borderColor:'#E2E8F0',borderRadius:16,gap:5},tab:{flex:1,flexDirection:'row-reverse',alignItems:'center',justifyContent:'center',gap:6,paddingVertical:11,borderRadius:12},tabActive:{backgroundColor:'#E0F2FE'},tabText:{fontSize:11.5,fontWeight:'800',color:'#64748B'},tabTextActive:{color:'#075985'},tabCount:{minWidth:22,height:22,borderRadius:11,alignItems:'center',justifyContent:'center',backgroundColor:'#F1F5F9',paddingHorizontal:4},tabCountActive:{backgroundColor:'#BAE6FD'},tabCountText:{fontSize:10,fontWeight:'900',color:'#64748B'},tabCountTextActive:{color:'#075985'},
  searchBox:{flexDirection:'row-reverse',alignItems:'center',gap:8,backgroundColor:'#fff',borderWidth:1,borderColor:'#E2E8F0',borderRadius:15,paddingHorizontal:12},searchInput:{flex:1,paddingVertical:12,fontSize:11.5,color:'#0F172A',textAlign:'right'},refresh:{width:31,height:31,borderRadius:10,backgroundColor:'#F1F5F9',alignItems:'center',justifyContent:'center'},
  list:{gap:9},personCard:{flexDirection:'row-reverse',alignItems:'center',gap:10,backgroundColor:'#fff',borderWidth:1,borderColor:'#E2E8F0',borderRadius:17,padding:12},avatar:{width:47,height:47,borderRadius:16,backgroundColor:'#E0F2FE'},avatarFallback:{width:47,height:47,borderRadius:16,backgroundColor:'#E0F2FE',alignItems:'center',justifyContent:'center'},avatarLetter:{fontSize:17,fontWeight:'900',color:'#0369A1'},personInfo:{flex:1,gap:4},nameRow:{flexDirection:'row-reverse',alignItems:'center',gap:5},personName:{fontSize:12.5,fontWeight:'900',color:'#0F172A',flexShrink:1},handle:{fontSize:10,color:'#94A3B8',textAlign:'right'},metaRow:{flexDirection:'row-reverse',alignItems:'center',gap:5},onlineDot:{width:6,height:6,borderRadius:3,backgroundColor:'#0D9488'},accountType:{fontSize:10,color:'#64748B'},unfollowButton:{flexDirection:'row-reverse',alignItems:'center',gap:4,paddingHorizontal:9,paddingVertical:8,borderRadius:10,backgroundColor:'#FEF2F2'},unfollowText:{fontSize:10,fontWeight:'900',color:'#B91C1C'},followerBadge:{flexDirection:'row-reverse',alignItems:'center',gap:4,paddingHorizontal:9,paddingVertical:7,borderRadius:10,backgroundColor:'#F0F9FF'},followerBadgeText:{fontSize:10,fontWeight:'900',color:'#0369A1'},
  state:{alignItems:'center',gap:9,backgroundColor:'#fff',borderWidth:1,borderColor:'#E2E8F0',borderRadius:20,padding:23},emptyIcon:{width:50,height:50,borderRadius:16,backgroundColor:'#F1F5F9',alignItems:'center',justifyContent:'center'},stateTitle:{fontSize:13.5,fontWeight:'900',color:'#0F172A',textAlign:'center'},stateText:{fontSize:11.5,color:'#64748B',textAlign:'center',lineHeight:18},retry:{flexDirection:'row-reverse',alignItems:'center',gap:6,paddingHorizontal:13,paddingVertical:9,backgroundColor:'#E0F2FE',borderRadius:11},retryText:{fontSize:11,fontWeight:'900',color:'#0369A1'},privacyNote:{fontSize:10,color:'#94A3B8',textAlign:'center',paddingVertical:5},
});
