import { useEffect, useState } from 'react';
import { ScrollView, View, Text, Pressable, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { AppHeader } from '@/components/shared/AppHeader';
import { useBottomNavInset } from '@/lib/bottomNav';
import { supabase } from '@/lib/supabase';
import { User, Users } from 'lucide-react-native';

export default function ConnectedSocialScreen() {
  const bottomNavInset = useBottomNavInset();
  const [tab, setTab] = useState<'following' | 'followers'>('following');
  const [followingList, setFollowingList] = useState<any[]>([]);
  const [followersList, setFollowersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) return;
        const [followingRes, followersRes] = await Promise.all([
          supabase.from('follows').select('following_id').eq('follower_id', auth.user.id),
          supabase.from('follows').select('follower_id').eq('following_id', auth.user.id),
        ]);
        const followingIds = (followingRes.data || []).map((r: any) => r.following_id);
        const followerIds = (followersRes.data || []).map((r: any) => r.follower_id);
        const [followingProfiles, followerProfiles] = await Promise.all([
          followingIds.length ? supabase.from('profiles').select('id,display_name,avatar_url,account_type').in('id', followingIds) : Promise.resolve({ data: [] }),
          followerIds.length ? supabase.from('profiles').select('id,display_name,avatar_url,account_type').in('id', followerIds) : Promise.resolve({ data: [] }),
        ]);
        setFollowingList(followingProfiles.data || []);
        setFollowersList(followerProfiles.data || []);
      } finally { setLoading(false); }
    })();
  }, []);

  const list = tab === 'following' ? followingList : followersList;

  return (
    <View style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <AppHeader variant="sub" title="المتابعون" subtitle="قائمة المتابعين" fallbackRoute="/more" />
      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', backgroundColor: '#fff' }}>
        <Pressable onPress={() => setTab('following')} style={{ flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: tab === 'following' ? '#ecfdf5' : '#fff' }}>
          <Text style={{ fontWeight: '900', color: tab === 'following' ? '#047857' : '#64748b' }}>أتابعهم ({followingList.length})</Text>
        </Pressable>
        <Pressable onPress={() => setTab('followers')} style={{ flex: 1, paddingVertical: 12, alignItems: 'center', backgroundColor: tab === 'followers' ? '#ecfdf5' : '#fff' }}>
          <Text style={{ fontWeight: '900', color: tab === 'followers' ? '#047857' : '#64748b' }}>متابعولي ({followersList.length})</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: bottomNavInset + 24 }}>
        {loading ? <ActivityIndicator /> : list.length ? list.map((p) => (
          <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
            {p.avatar_url ? <Image source={{ uri: p.avatar_url }} style={{ width: 36, height: 36, borderRadius: 18 }} /> : <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#d1fae5', alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#047857', fontWeight: '900' }}>{p.display_name?.slice(0, 1)}</Text></View>}
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '800', color: '#0f172a', textAlign: 'left' }}>{p.display_name || 'مستخدم'}</Text>
              {p.account_type ? <Text style={{ fontSize: 10, color: '#64748b' }}>{p.account_type}</Text> : null}
            </View>
          </View>
        )) : (
          <Text style={{ textAlign: 'center', color: '#64748b', marginTop: 30 }}>لا يوجد متابعون حاليا.</Text>
        )}
      </ScrollView>
    </View>
  );
}
