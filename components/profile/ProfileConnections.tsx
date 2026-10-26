import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Users, X } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/context/ThemeContext';

export function ProfileConnections({ userId, kind, onClose }: { userId: string; kind: 'followers' | 'following' | null; onClose: () => void }) {
  const { colors } = useTheme();
  const [people, setPeople] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => { setPage(0); setPeople([]); }, [userId, kind]);
  useEffect(() => {
    if (!kind) return;
    let cancelled = false;
    async function load() {
      setLoading(true); setError(false);
      try {
        const column = kind === 'followers' ? 'follower_id' : 'following_id';
        const result = await supabase.from('follows').select('follower_id,following_id')
          .eq(kind === 'followers' ? 'following_id' : 'follower_id', userId)
          .order('id', { ascending: false }).range(page * 30, page * 30 + 29);
        if (result.error) throw result.error;
        const ids = (result.data || []).map(row => row[column]);
        const profiles = ids.length ? await supabase.from('profiles').select('id,username,display_name,avatar_url,bio,hide_name').in('id', ids) : { data: [], error: null };
        if (profiles.error) throw profiles.error;
        if (!cancelled) {
          const rows = ids.map(id => profiles.data?.find(person => person.id === id)).filter((row): row is NonNullable<typeof row> => Boolean(row));
          setPeople(previous => page === 0 ? rows : [...previous, ...rows.filter(row => !previous.some(person => person.id === row.id))]);
          setHasMore(ids.length === 30);
        }
      } catch { if (!cancelled) setError(true); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [userId, kind, page, retry]);
  return <Modal visible={kind !== null} transparent animationType="fade" onRequestClose={onClose}>
    <View style={s.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="إغلاق القائمة" />
      <View style={[s.dialog, { backgroundColor: colors.surface }]} accessibilityViewIsModal>
        <View style={[s.header, { borderColor: colors.line }]}><Text style={[s.title, { color: colors.ink }]}>{kind === 'followers' ? 'المتابعون' : 'يتابع'}</Text><Pressable onPress={onClose} style={s.close} accessibilityRole="button" accessibilityLabel="إغلاق"><X size={22} color={colors.ink} /></Pressable></View>
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          {people.map(person => <Pressable key={person.id} style={[s.person, { borderColor: colors.line }]} onPress={() => { onClose(); router.push({ pathname: '/user', params: { id: person.id } }); }}>
            {person.avatar_url && !person.hide_name ? <Image source={{ uri: person.avatar_url }} style={s.avatar} /> : <View style={[s.avatar, { backgroundColor: colors.soft, alignItems: 'center', justifyContent: 'center' }]}><Users size={20} color={colors.primary} /></View>}
            <View style={{ flex: 1, gap: 4 }}><Text style={{ color: colors.ink, fontWeight: '700', textAlign: 'right' }}>{person.hide_name ? 'جار مجهول' : person.display_name || person.username}</Text>{!person.hide_name && <Text style={{ color: colors.muted, textAlign: 'right' }}>@{person.username}</Text>}</View>
          </Pressable>)}
          {loading ? <ActivityIndicator color={colors.primary} style={{ margin: 24 }} /> : error ? <Pressable onPress={() => setRetry(value => value + 1)} style={s.empty}><Text style={{ color: colors.primary }}>تعذر التحميل. اضغط لإعادة المحاولة</Text></Pressable> : !people.length ? <View style={s.empty}><Users size={32} color={colors.muted} /><Text style={{ color: colors.muted }}>لا توجد حسابات لعرضها حتى الآن</Text></View> : hasMore ? <Pressable style={s.empty} onPress={() => setPage(value => value + 1)}><Text style={{ color: colors.primary }}>عرض المزيد</Text></Pressable> : null}
        </ScrollView>
      </View>
    </View>
  </Modal>;
}
const s = StyleSheet.create({ overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,.45)', alignItems: 'center', justifyContent: 'center', padding: 20 }, dialog: { width: '100%', maxWidth: 520, maxHeight: '80%', borderRadius: 24, overflow: 'hidden' }, header: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1 }, title: { fontSize: 20, fontWeight: '700' }, close: { padding: 10 }, person: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, paddingVertical: 15, borderBottomWidth: 1 }, avatar: { width: 48, height: 48, borderRadius: 24 }, empty: { padding: 24, alignItems: 'center', gap: 14 } });
