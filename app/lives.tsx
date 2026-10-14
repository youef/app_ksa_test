import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { AppHeader } from '@/components/shared/AppHeader';
import { useBottomNavInset } from '@/lib/bottomNav';
import { C } from '@/lib/ui';
import { supabase } from '@/lib/supabase';
import { fetchLiveStreams, type LiveStream } from '@/lib/lives';
import { ChevronLeft, MapPin, Radio, Users, Video } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

type Filter = 'all' | 'following' | 'nearby';

export default function LivesScreen() {
  const bottomNavInset = useBottomNavInset();
  const [streams, setStreams] = useState<LiveStream[]>([]);
  const [following, setFollowing] = useState<string[]>([]);
  const [city, setCity] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setError('');
      const { data: auth } = await supabase.auth.getUser();
      const [rows, profile, follows] = await Promise.all([
        fetchLiveStreams(),
        auth.user ? supabase.from('profiles').select('city').eq('id', auth.user.id).maybeSingle() : Promise.resolve({ data: null }),
        auth.user ? supabase.from('follows').select('following_id').eq('follower_id', auth.user.id) : Promise.resolve({ data: [] }),
      ]);
      setStreams(rows);
      setCity(profile.data?.city || null);
      setFollowing((follows.data || []).map((row: any) => row.following_id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تحميل البثوث.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useFocusEffect(useCallback(() => {
    const channel = supabase.channel('live-directory-refresh')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_streams' }, () => { void load(); })
      .subscribe();
    const timer = setInterval(() => { void load(); }, 20_000);
    return () => { clearInterval(timer); void supabase.removeChannel(channel); };
  }, [load]));

  const filtered = useMemo(() => streams.filter((stream) => {
    if (filter === 'following') return following.includes(stream.host_id);
    if (filter === 'nearby') return Boolean(city && stream.profiles?.city?.toLocaleLowerCase() === city.toLocaleLowerCase());
    return true;
  }), [streams, following, filter, city]);

  return (
    <View style={styles.screen}>
      <AppHeader variant="sub" title="البثوث المباشرة" subtitle="كن قريبًا من مجتمع حيّك" fallbackRoute="/more" />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomNavInset + 28 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={C.accent} />}
      >
        <Pressable accessibilityRole="button" style={styles.createCard} onPress={() => router.push('/live/create')}>
          <LinearGradient colors={['#065f46', '#059669', '#10b981']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.createGradient}>
            <View style={styles.createIcon}><Video size={25} color="#059669" /></View>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Text style={styles.createTitle}>ابدأ بثًا مباشرًا</Text>
              <Text style={styles.createSubtitle}>شارك جيرانك لحظتك واصعد بضيوفك</Text>
            </View>
            <ChevronLeft color="#fff" size={22} />
          </LinearGradient>
        </Pressable>

        <View style={styles.filterRow}>
          {([
            ['all', 'لك'], ['following', 'أتابعهم'], ['nearby', 'قريب مني'],
          ] as [Filter, string][]).map(([key, label]) => (
            <Pressable key={key} onPress={() => setFilter(key)} style={[styles.filter, filter === key && styles.filterActive]}>
              <Text style={[styles.filterText, filter === key && styles.filterTextActive]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.sectionRow}>
          <Text style={styles.sectionTitle}>على الهواء الآن</Text>
          <View style={styles.liveCount}><View style={styles.liveDot} /><Text style={styles.liveCountText}>{filtered.length} بث</Text></View>
        </View>

        {loading ? (
          <View style={styles.state}><ActivityIndicator size="large" color={C.accent} /><Text style={styles.stateText}>جارٍ البحث عن بثوث جيرانك…</Text></View>
        ) : error ? (
          <View style={styles.empty}><Radio color="#dc2626" size={32} /><Text style={styles.emptyTitle}>تعذر تحميل البثوث</Text><Text style={styles.emptyText}>{error}</Text><Pressable onPress={() => { setLoading(true); void load(); }} style={styles.retry}><Text style={styles.retryText}>إعادة المحاولة</Text></Pressable></View>
        ) : filtered.length === 0 ? (
          <View style={styles.empty}><Radio color="#059669" size={34} /><Text style={styles.emptyTitle}>{filter === 'following' ? 'لا يوجد بث لمتابَعيك الآن' : filter === 'nearby' ? 'لا يوجد بث قريب الآن' : 'ما فيه بث مباشر الآن'}</Text><Text style={styles.emptyText}>ابدأ بثك الأول وخل جيرانك ينضمون لك.</Text></View>
        ) : (
          <View style={styles.grid}>
            {filtered.map((stream) => <LiveCard key={stream.id} stream={stream} onPress={() => router.push({ pathname: '/live/[id]', params: { id: stream.id } })} />)}
          </View>
        )}
        <View style={styles.privacyHint}><MapPin size={15} color="#64748b" /><Text style={styles.privacyText}>نُظهر المدينة والحي فقط بحسب إعدادات البث، ولا نشارك موقعك الدقيق.</Text></View>
      </ScrollView>
    </View>
  );
}

function LiveCard({ stream, onPress }: { stream: LiveStream; onPress: () => void }) {
  const profile = stream.profiles;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`مشاهدة بث ${profile?.display_name || 'مستخدم'}`} onPress={onPress} style={styles.card}>
      <LinearGradient colors={['#052e26', '#065f46', '#047857']} style={styles.cardCover}>
        <View style={styles.cardTop}><View style={styles.onAir}><View style={styles.liveDot} /><Text style={styles.onAirText}>مباشر</Text></View><Text style={styles.category}>{stream.category}</Text></View>
        <View style={styles.cardCenter}><View style={styles.avatarRing}>{profile?.avatar_url ? <Image source={{ uri: profile.avatar_url }} style={styles.avatar} /> : <Text style={styles.avatarLetter}>{profile?.display_name?.slice(0, 1) || 'ح'}</Text>}</View><Text style={styles.streamTitle} numberOfLines={2}>{stream.title}</Text></View>
        <View style={styles.cardBottom}><View style={styles.viewers}><Users size={13} color="#fff" /><Text style={styles.viewerText}>{stream.viewer_count || 0}</Text></View><View style={styles.joinText}><Text style={styles.joinLabel}>انضم للبث</Text><ChevronLeft size={14} color="#fff" /></View></View>
      </LinearGradient>
      <View style={styles.hostRow}>
        <View style={{ flex: 1, alignItems: 'flex-end' }}><Text numberOfLines={1} style={styles.hostName}>{profile?.display_name || profile?.username || 'جارٍ'}</Text><Text numberOfLines={1} style={styles.hostArea}>{profile?.district ? `حي ${profile.district}` : profile?.city || 'من حيّنا'}</Text></View>
        {profile?.avatar_url ? <Image source={{ uri: profile.avatar_url }} style={styles.smallAvatar} /> : <View style={styles.smallAvatarFallback}><Text style={styles.smallAvatarLetter}>ح</Text></View>}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f0fdf4' }, content: { padding: 16, paddingTop: 8 },
  createCard: { borderRadius: 24, overflow: 'hidden', marginBottom: 18, elevation: 6, shadowColor: '#059669', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } }, createGradient: { minHeight: 104, padding: 16, flexDirection: 'row-reverse', alignItems: 'center', gap: 12 }, createIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }, createTitle: { color: '#fff', fontSize: 18, fontWeight: '900' }, createSubtitle: { color: '#d1fae5', fontSize: 12, marginTop: 4, textAlign: 'right' },
  filterRow: { flexDirection: 'row-reverse', gap: 8, marginBottom: 20 }, filter: { paddingHorizontal: 17, paddingVertical: 9, borderRadius: 30, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#0f172a', shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } }, filterActive: { backgroundColor: '#065f46', borderColor: '#065f46' }, filterText: { fontSize: 13, color: '#64748b', fontWeight: '700' }, filterTextActive: { color: '#fff' },
  sectionRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }, sectionTitle: { color: '#0f172a', fontSize: 19, fontWeight: '900', textAlign: 'right' }, liveCount: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, backgroundColor: '#ecfdf5', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 }, liveCountText: { color: '#047857', fontSize: 12, fontWeight: '700' }, liveDot: { width: 7, height: 7, borderRadius: 5, backgroundColor: '#fb3a4b' },
  grid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 12 }, card: { width: '48%', flexGrow: 1, maxWidth: '49%', backgroundColor: '#fff', borderRadius: 22, overflow: 'hidden', marginBottom: 4, borderWidth: 1, borderColor: '#e2e8f0', shadowColor: '#0f172a', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 3 }, cardCover: { minHeight: 190, padding: 12, justifyContent: 'space-between' }, cardTop: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }, onAir: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, backgroundColor: '#dc2626', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 }, onAirText: { color: '#fff', fontSize: 10, fontWeight: '900' }, category: { color: '#d1fae5', fontSize: 11, fontWeight: '700' }, cardCenter: { alignItems: 'center', gap: 8 }, avatarRing: { width: 70, height: 70, borderRadius: 36, borderWidth: 2, borderColor: '#34d399', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#047857' }, avatar: { width: '100%', height: '100%' }, avatarLetter: { color: '#fff', fontWeight: '900', fontSize: 25 }, streamTitle: { color: '#fff', textAlign: 'center', fontWeight: '900', fontSize: 14, minHeight: 36 }, cardBottom: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' }, viewers: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, backgroundColor: 'rgba(0,0,0,0.24)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }, viewerText: { color: '#fff', fontSize: 11, fontWeight: '800' }, joinText: { flexDirection: 'row-reverse', alignItems: 'center', gap: 1 }, joinLabel: { color: '#d1fae5', fontSize: 11, fontWeight: '800' },
  hostRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, padding: 10 }, hostName: { color: '#0f172a', fontSize: 12, fontWeight: '800' }, hostArea: { color: '#64748b', fontSize: 10, marginTop: 2, textAlign: 'right' }, smallAvatar: { width: 30, height: 30, borderRadius: 15 }, smallAvatarFallback: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#d1fae5', alignItems: 'center', justifyContent: 'center' }, smallAvatarLetter: { color: '#047857', fontWeight: '900' },
  state: { paddingVertical: 50, alignItems: 'center', gap: 12 }, stateText: { color: '#64748b', fontSize: 13 }, empty: { backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', padding: 28, alignItems: 'center', gap: 9, shadowColor: '#0f172a', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }, emptyTitle: { color: '#0f172a', fontSize: 16, fontWeight: '900', textAlign: 'center' }, emptyText: { color: '#64748b', fontSize: 13, textAlign: 'center', lineHeight: 21 }, retry: { paddingVertical: 9, paddingHorizontal: 18, backgroundColor: '#ecfdf5', borderRadius: 15, marginTop: 5 }, retryText: { color: '#047857', fontWeight: '800' }, privacyHint: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 7, padding: 12, marginTop: 16, backgroundColor: '#f1f5f9', borderRadius: 14 }, privacyText: { flex: 1, color: '#64748b', fontSize: 11, textAlign: 'right', lineHeight: 17 },
});
