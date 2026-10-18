import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ArrowRight, Bell, BellOff, VolumeX } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

type Person = { id: string; display_name: string | null; username: string | null; avatar_url: string | null };
type Preference = { author_id: string; notifications_enabled: boolean; muted: boolean };

export default function StorySettingsScreen() {
  const [people, setPeople] = useState<Person[]>([]);
  const [blockedPeople, setBlockedPeople] = useState<Person[]>([]);
  const [prefs, setPrefs] = useState<Record<string, Preference>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [globalEnabled, setGlobalEnabled] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const user = authData.user;
      if (!user) {
        router.replace('/auth');
        return;
      }
      const [{ data: follows, error: followsError }, { data: preferenceRows, error: prefError }, { data: globalRow }, { data: blockRows, error: blocksError }] = await Promise.all([
        supabase.from('follows').select('following_id').eq('follower_id', user.id),
        supabase.from('story_author_preferences').select('author_id,notifications_enabled,muted').eq('user_id', user.id),
        supabase.from('story_notification_settings').select('enabled').eq('user_id', user.id).maybeSingle(),
        supabase.from('blocks').select('blocked_id').eq('blocker_id', user.id),
      ]);
      if (followsError) throw followsError;
      if (prefError) throw prefError;
      if (blocksError) throw blocksError;
      const ids = [...new Set((follows || []).map((row: any) => String(row.following_id)))];
      let profiles: Person[] = [];
      if (ids.length) {
        const { data, error } = await supabase.from('profiles').select('id,display_name,username,avatar_url').in('id', ids).order('display_name');
        if (error) throw error;
        profiles = (data || []) as Person[];
      }
      setPeople(profiles);
      const blockedIds = [...new Set((blockRows || []).map((row: any) => String(row.blocked_id)))];
      if (blockedIds.length) {
        const { data: blockedProfiles, error: blockedProfilesError } = await supabase.from('profiles').select('id,display_name,username,avatar_url').in('id', blockedIds);
        if (blockedProfilesError) throw blockedProfilesError;
        setBlockedPeople((blockedProfiles || []) as Person[]);
      } else {
        setBlockedPeople([]);
      }
      setPrefs(Object.fromEntries((preferenceRows || []).map((row: any) => [row.author_id, row as Preference])));
      setGlobalEnabled(globalRow?.enabled !== false);
    } catch (e: any) {
      Alert.alert('تعذر تحميل الإعدادات', e?.message || 'تحقق من الاتصال ثم حاول مجددًا.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  async function updatePreference(authorId: string, patch: Partial<Preference>) {
    const previous = prefs[authorId] || { author_id: authorId, notifications_enabled: true, muted: false };
    const next = { ...previous, ...patch };
    setBusyId(authorId);
    setPrefs(current => ({ ...current, [authorId]: next }));
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (!userId) throw new Error('سجّل الدخول أولاً.');
      const { error } = await supabase.from('story_author_preferences').upsert({
        user_id: userId,
        author_id: authorId,
        notifications_enabled: next.notifications_enabled,
        muted: next.muted,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,author_id' });
      if (error) throw error;
    } catch (e: any) {
      setPrefs(current => ({ ...current, [authorId]: previous }));
      Alert.alert('تعذر حفظ التغيير', e?.message || 'حاول مرة أخرى.');
    } finally {
      setBusyId('');
    }
  }

  async function unblockPerson(person: Person) {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (!userId) throw new Error('سجّل الدخول أولاً.');
      const { error } = await supabase.from('blocks').delete().eq('blocker_id', userId).eq('blocked_id', person.id);
      if (error) throw error;
      setBlockedPeople(current => current.filter(item => item.id !== person.id));
      Alert.alert('تم إلغاء الحظر', `يمكنك الآن رؤية محتوى ${person.display_name || person.username || 'هذا الحساب'} وفق إعدادات الخصوصية.`);
    } catch (e: any) {
      Alert.alert('تعذر إلغاء الحظر', e?.message || 'حاول مرة أخرى.');
    }
  }

  async function toggleGlobal() {
    const next = !globalEnabled;
    setGlobalEnabled(next);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const userId = authData.user?.id;
      if (!userId) throw new Error('سجّل الدخول أولاً.');
      const { error } = await supabase.from('story_notification_settings').upsert({
        user_id: userId, enabled: next, updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
      if (error) throw error;
    } catch (e: any) {
      setGlobalEnabled(!next);
      Alert.alert('تعذر حفظ الإعداد', e?.message || 'حاول مرة أخرى.');
    }
  }

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.back} accessibilityRole="button" accessibilityLabel="رجوع"><ArrowRight size={22} color="#0f172a" /></Pressable>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text style={s.title}>إعدادات القصص</Text>
          <Text style={s.subtitle}>تحكم في التنبيهات وكتم الحسابات</Text>
        </View>
        <Bell size={24} color="#059669" />
      </View>
      <ScrollView contentContainerStyle={s.content}>
        <View style={s.globalCard}>
          <View style={s.iconBox}><BellOff size={20} color="#047857" /></View>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={s.rowTitle}>تنبيهات القصص بشكل عام</Text>
            <Text style={s.hint}>إيقافها يمنع تنبيهات القصص من كل الحسابات</Text>
          </View>
          <Switch value={globalEnabled} onValueChange={toggleGlobal} trackColor={{ true: '#059669', false: '#cbd5e1' }} />
        </View>
        <Text style={s.sectionTitle}>الحسابات التي تتابعها</Text>
        {loading ? <ActivityIndicator color="#059669" size="large" style={{ marginTop: 28 }} /> : people.length === 0 ? (
          <View style={s.empty}><Text style={s.emptyTitle}>لا توجد حسابات تتابعها</Text><Text style={s.hint}>عند متابعة حسابات ستظهر هنا إعدادات التنبيهات والكتم.</Text></View>
        ) : people.map(person => {
          const pref = prefs[person.id] || { author_id: person.id, notifications_enabled: true, muted: false };
          const name = person.display_name || person.username || 'مستخدم';
          return (
            <View key={person.id} style={s.personCard}>
              {person.avatar_url ? <Image source={{ uri: person.avatar_url }} style={s.avatar} /> : <View style={[s.avatar, s.avatarFallback]}><Text style={s.initial}>{name[0]}</Text></View>}
              <View style={{ flex: 1, alignItems: 'flex-end', gap: 5 }}>
                <Text style={s.rowTitle}>{name}</Text>
                <View style={s.settingRow}>
                  <Text style={s.settingLabel}>تنبيهات هذا الحساب</Text>
                  <Switch value={pref.notifications_enabled} disabled={busyId === person.id} onValueChange={value => updatePreference(person.id, { notifications_enabled: value })} trackColor={{ true: '#059669', false: '#cbd5e1' }} />
                </View>
                <View style={s.settingRow}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><VolumeX size={15} color={pref.muted ? '#dc2626' : '#64748b'} /><Text style={s.settingLabel}>كتم قصص الحساب</Text></View>
                  <Switch value={pref.muted} disabled={busyId === person.id} onValueChange={value => updatePreference(person.id, { muted: value })} trackColor={{ true: '#dc2626', false: '#cbd5e1' }} />
                </View>
              </View>
            </View>
          );
        })}
        <Text style={s.sectionTitle}>الحسابات المحظورة</Text>
        {blockedPeople.length === 0 ? (
          <View style={s.empty}><Text style={s.hint}>لا توجد حسابات محظورة حاليًا.</Text></View>
        ) : blockedPeople.map(person => {
          const name = person.display_name || person.username || 'مستخدم';
          return (
            <View key={person.id} style={s.personCard}>
              {person.avatar_url ? <Image source={{ uri: person.avatar_url }} style={s.avatar} /> : <View style={[s.avatar, s.avatarFallback]}><Text style={s.initial}>{name[0]}</Text></View>}
              <View style={{ flex: 1, alignItems: 'flex-end', gap: 7 }}>
                <Text style={s.rowTitle}>{name}</Text>
                <Pressable style={s.unblockButton} onPress={() => void unblockPerson(person)}><Text style={s.unblockText}>إلغاء الحظر</Text></Pressable>
              </View>
            </View>
          );
        })}
        <Text style={s.footer}>الكتم لا يلغي المتابعة. إعدادات التنبيه لكل حساب تعمل بالإضافة إلى خيار التنبيهات العام.</Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  header: { paddingTop: 54, paddingBottom: 18, paddingHorizontal: 18, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  back: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 21, fontWeight: '900', color: '#0f172a' },
  subtitle: { fontSize: 12, color: '#64748b', marginTop: 3 },
  content: { padding: 16, paddingBottom: 36, gap: 12 },
  globalCard: { backgroundColor: '#fff', borderRadius: 18, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  iconBox: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#d1fae5', alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: '#0f172a', textAlign: 'right', marginTop: 12 },
  personCard: { backgroundColor: '#fff', borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#e2e8f0' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#d1fae5' },
  initial: { color: '#047857', fontWeight: '900', fontSize: 18 },
  rowTitle: { color: '#0f172a', fontSize: 15, fontWeight: '800' },
  hint: { color: '#64748b', fontSize: 12, lineHeight: 19, textAlign: 'right' },
  settingRow: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 5 },
  settingLabel: { color: '#475569', fontSize: 12, fontWeight: '600' },
  empty: { backgroundColor: '#fff', padding: 24, borderRadius: 18, alignItems: 'center', gap: 8 },
  emptyTitle: { color: '#0f172a', fontSize: 16, fontWeight: '800' },
  unblockButton: { backgroundColor: '#fee2e2', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  unblockText: { color: '#b91c1c', fontSize: 12, fontWeight: '800' },
  footer: { color: '#64748b', fontSize: 12, lineHeight: 20, textAlign: 'right', paddingHorizontal: 4, marginTop: 8 },
});
