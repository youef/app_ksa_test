import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowRight, UserRound } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

type Viewer = {
  id: string;
  avatar_url: string | null;
  viewed_at: string | null;
};

function formatViewedAt(value: string | null) {
  if (!value) return 'وقت غير متاح';
  const elapsed = Math.max(0, Date.now() - new Date(value).getTime());
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return 'الآن';
  if (minutes < 60) return `منذ ${minutes} د`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `منذ ${hours} س`;
  return new Date(value).toLocaleDateString('ar-SA', { day: 'numeric', month: 'short' });
}

export default function StoryViewersScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const storyId = Array.isArray(params.id) ? params.id[0] : params.id || '';
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    let active = true;
    async function loadViewers() {
      setLoading(true);
      setErrorText('');
      try {
        const { data: auth } = await supabase.auth.getUser();
        const userId = auth.user?.id;
        if (!userId || !storyId) throw new Error('تعذر التحقق من الحساب أو القصة.');
        const { data: story, error: storyError } = await supabase
          .from('stories')
          .select('id, author_id')
          .eq('id', storyId)
          .maybeSingle();
        if (storyError) throw storyError;
        if (!story || story.author_id !== userId) throw new Error('قائمة المشاهدين متاحة لصاحب القصة فقط.');

        const { data: views, error: viewsError } = await supabase
          .from('story_views')
          .select('viewer_id, viewed_at')
          .eq('story_id', storyId)
          .order('viewed_at', { ascending: false });
        if (viewsError) throw viewsError;

        const rows = views || [];
        const ids = [...new Set(rows.map((row: any) => row.viewer_id).filter(Boolean))];
        let profiles: any[] = [];
        if (ids.length) {
          const { data, error } = await supabase
            .from('profiles')
            .select('id, avatar_url')
            .in('id', ids);
          if (error) throw error;
          profiles = data || [];
        }
        const profileMap = new Map(profiles.map((profile: any) => [profile.id, profile]));
        const result = rows.map((row: any) => ({
          id: row.viewer_id,
          avatar_url: profileMap.get(row.viewer_id)?.avatar_url || null,
          viewed_at: row.viewed_at || null,
        }));
        if (active) setViewers(result);
      } catch (error: any) {
        if (active) setErrorText(error?.message || 'تعذر تحميل المشاهدين.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadViewers();
    return () => { active = false; };
  }, [storyId]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="رجوع">
          <ArrowRight size={22} color="#0f172a" />
        </Pressable>
        <Text style={styles.title}>مشاهدو القصة</Text>
        <View style={styles.countPill}><Text style={styles.countText}>{viewers.length}</Text></View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#059669" />
        </View>
      ) : errorText ? (
        <View style={styles.center}>
          <Text style={styles.message}>{errorText}</Text>
        </View>
      ) : viewers.length === 0 ? (
        <View style={styles.center}>
          <UserRound size={34} color="#94a3b8" />
          <Text style={styles.message}>لا توجد مشاهدات حتى الآن</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {viewers.map((viewer, index) => (
            <Pressable
              key={`${viewer.id}-${viewer.viewed_at || index}`}
              style={styles.viewerRow}
              onPress={() => router.push({ pathname: '/user', params: { id: viewer.id } })}
              accessibilityRole="button"
              accessibilityLabel="فتح الملف الشخصي للمشاهد"
            >
              {viewer.avatar_url ? (
                <Image source={{ uri: viewer.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}><UserRound size={22} color="#64748b" /></View>
              )}
              <Text style={styles.time}>{formatViewedAt(viewer.viewed_at)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, width: '100%', minHeight: '100%', backgroundColor: '#f8fafc' },
  header: {
    minHeight: 64, paddingHorizontal: 18, paddingTop: 8, paddingBottom: 10,
    flexDirection: 'row-reverse', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e8edf2',
  },
  backButton: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: '#f1f5f9',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { flex: 1, textAlign: 'right', color: '#0f172a', fontSize: 18, fontWeight: '900' },
  countPill: { minWidth: 34, height: 30, paddingHorizontal: 9, borderRadius: 15, backgroundColor: '#e7f7ef', alignItems: 'center', justifyContent: 'center' },
  countText: { color: '#047857', fontSize: 13, fontWeight: '900' },
  list: { paddingHorizontal: 18, paddingTop: 10, paddingBottom: 28 },
  viewerRow: {
    minHeight: 76, paddingHorizontal: 4, paddingVertical: 10,
    flexDirection: 'row-reverse', alignItems: 'center', gap: 14,
    borderBottomWidth: 1, borderBottomColor: '#e9eef3',
  },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#e2e8f0' },
  avatarFallback: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center' },
  time: { marginLeft: 'auto', color: '#64748b', fontSize: 13, fontWeight: '700', textAlign: 'right' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 10 },
  message: { color: '#64748b', fontSize: 14, fontWeight: '700', textAlign: 'center' },
});
