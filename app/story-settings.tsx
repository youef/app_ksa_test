import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Bell, BellOff, VolumeX, Search, Users, Settings2, CheckCircle2 } from 'lucide-react-native';
import { AppHeader } from '@/components/shared/AppHeader';
import { supabase } from '@/lib/supabase';

type Person = { id: string; display_name: string | null; username: string | null; avatar_url: string | null };
type Preference = { author_id: string; notifications_enabled: boolean; muted: boolean };

export default function StorySettingsScreen() {
  const [people, setPeople] = useState<Person[]>([]);
  const [search, setSearch] = useState('');
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
      const [{ data: follows, error: followsError }, { data: preferenceRows, error: prefError }, { data: globalRow }] = await Promise.all([
        supabase.from('follows').select('following_id').eq('follower_id', user.id),
        supabase.from('story_author_preferences').select('author_id,notifications_enabled,muted').eq('user_id', user.id),
        supabase.from('story_notification_settings').select('enabled').eq('user_id', user.id).maybeSingle(),
      ]);
      if (followsError) throw followsError;
      if (prefError) throw prefError;
      const ids = [...new Set((follows || []).map((row: any) => String(row.following_id)))];
      let profiles: Person[] = [];
      if (ids.length) {
        const { data, error } = await supabase.from('profiles').select('id,display_name,username,avatar_url').in('id', ids).order('display_name');
        if (error) throw error;
        profiles = (data || []) as Person[];
      }
      setPeople(profiles);
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

  const normalizedSearch = search.trim().toLocaleLowerCase('ar');
  const visiblePeople = people.filter(person => {
    const name = (person.display_name || person.username || '').toLocaleLowerCase('ar');
    const username = (person.username || '').toLocaleLowerCase('ar');
    return !normalizedSearch || name.includes(normalizedSearch) || username.includes(normalizedSearch);
  });
  const mutedCount = people.filter(person => prefs[person.id]?.muted).length;
  const customNotificationsCount = people.filter(person => prefs[person.id]?.notifications_enabled === false).length;

  return (
    <View style={s.screen}>
      <AppHeader variant="sub" title="إعدادات القصص" subtitle="التنبيهات والخصوصية" fallbackRoute="/stories"
        rightAction={<View style={s.headerIcon}><Settings2 size={19} color="#047857" /></View>} />
      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        <View style={s.heroCard}>
          <View style={s.heroTop}>
            <View style={s.heroIcon}><Bell size={23} color="#047857" /></View>
            <View style={{ flex: 1, alignItems: 'flex-end', gap: 4 }}>
              <Text style={s.heroTitle}>خلّ القصص على مزاجك</Text>
              <Text style={s.heroDescription}>تحكم في تنبيهات الحسابات التي تتابعها، واكتم القصص التي لا تريد ظهورها.</Text>
            </View>
          </View>
          <View style={s.statsRow}>
            <View style={s.statBox}>
              <Users size={16} color="#047857" />
              <Text style={s.statNumber}>{people.length}</Text>
              <Text style={s.statLabel}>حساب تتابعه</Text>
            </View>
            <View style={s.statBox}>
              <VolumeX size={16} color="#b45309" />
              <Text style={s.statNumber}>{mutedCount}</Text>
              <Text style={s.statLabel}>حساب مكتوم</Text>
            </View>
            <View style={s.statBox}>
              <BellOff size={16} color="#64748b" />
              <Text style={s.statNumber}>{customNotificationsCount}</Text>
              <Text style={s.statLabel}>تنبيهات متوقفة</Text>
            </View>
          </View>
        </View>

        <View style={s.globalCard}>
          <View style={[s.iconBox, !globalEnabled && s.iconBoxOff]}>
            {globalEnabled ? <Bell size={20} color="#047857" /> : <BellOff size={20} color="#64748b" />}
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end', gap: 4 }}>
            <Text style={s.rowTitle}>تنبيهات القصص بشكل عام</Text>
            <Text style={s.hint}>{globalEnabled ? 'التنبيهات مفعّلة للحسابات المسموح بها أدناه' : 'تم إيقاف تنبيهات القصص من جميع الحسابات'}</Text>
          </View>
          <Switch value={globalEnabled} onValueChange={toggleGlobal} trackColor={{ true: '#059669', false: '#cbd5e1' }} />
        </View>

        <View style={s.sectionHeading}>
          <View style={{ flex: 1, alignItems: 'flex-end', gap: 3 }}>
            <Text style={s.sectionTitle}>إعدادات كل حساب</Text>
            <Text style={s.hint}>التنبيهات والكتم مستقلان لكل حساب</Text>
          </View>
          <View style={s.sectionIcon}><Users size={18} color="#047857" /></View>
        </View>

        <View style={s.searchBox}>
          <Search size={18} color="#94a3b8" />
          <TextInput value={search} onChangeText={setSearch} placeholder="ابحث عن حساب بالاسم..." placeholderTextColor="#94a3b8"
            style={s.searchInput} textAlign="right" returnKeyType="search" accessibilityLabel="البحث عن حساب" />
        </View>

        {loading ? <ActivityIndicator color="#059669" size="large" style={{ marginTop: 28 }} /> : visiblePeople.length === 0 ? (
          <View style={s.empty}>
            <View style={s.emptyIcon}><Users size={24} color="#64748b" /></View>
            <Text style={s.emptyTitle}>{people.length === 0 ? 'لا توجد حسابات تتابعها' : 'لا توجد نتائج مطابقة'}</Text>
            <Text style={s.hint}>{people.length === 0 ? 'عند متابعة حسابات ستظهر إعداداتها هنا.' : 'جرّب البحث باسم مختلف.'}</Text>
          </View>
        ) : visiblePeople.map(person => {
          const pref = prefs[person.id] || { author_id: person.id, notifications_enabled: true, muted: false };
          const name = person.display_name || person.username || 'مستخدم';
          return (
            <View key={person.id} style={s.personCard}>
              {person.avatar_url ? <Image source={{ uri: person.avatar_url }} style={s.avatar} /> : <View style={[s.avatar, s.avatarFallback]}><Text style={s.initial}>{name[0]}</Text></View>}
              <View style={{ flex: 1, alignItems: 'flex-end', gap: 10 }}>
                <View style={s.personHeader}>
                  <View style={{ flex: 1, alignItems: 'flex-end', gap: 3 }}>
                    <Text style={s.rowTitle} numberOfLines={1}>{name}</Text>
                    {person.username ? <Text style={s.username}>@{person.username}</Text> : null}
                  </View>
                  {(pref.muted || !pref.notifications_enabled) ? <View style={s.customBadge}><Text style={s.customBadgeText}>{pref.muted ? 'مكتوم' : 'بدون تنبيه'}</Text></View> : <CheckCircle2 size={17} color="#059669" />}
                </View>
                <View style={s.settingDivider} />
                <View style={s.settingRow}>
                  <View style={{ flex: 1, alignItems: 'flex-end', gap: 3 }}>
                    <Text style={s.settingLabel}>تنبيهات هذا الحساب</Text>
                    <Text style={s.settingHint}>{pref.notifications_enabled ? 'إشعار عند نشر قصة جديدة' : 'لن يصلك إشعار من هذا الحساب'}</Text>
                  </View>
                  <Switch value={pref.notifications_enabled} disabled={busyId === person.id} onValueChange={value => updatePreference(person.id, { notifications_enabled: value })} trackColor={{ true: '#059669', false: '#cbd5e1' }} />
                </View>
                <View style={s.settingRow}>
                  <View style={{ flex: 1, alignItems: 'flex-end', gap: 3 }}>
                    <Text style={s.settingLabel}>كتم قصص الحساب</Text>
                    <Text style={s.settingHint}>{pref.muted ? 'قصص هذا الحساب مخفية عن يومياتك' : 'إخفاء القصص دون إلغاء المتابعة'}</Text>
                  </View>
                  <Switch value={pref.muted} disabled={busyId === person.id} onValueChange={value => updatePreference(person.id, { muted: value })} trackColor={{ true: '#d97706', false: '#cbd5e1' }} />
                </View>
              </View>
            </View>
          );
        })}

        <View style={s.footerCard}>
          <CheckCircle2 size={17} color="#047857" />
          <Text style={s.footer}>الكتم لا يلغي المتابعة، ويمكنك تغيير هذه الخيارات في أي وقت. إعدادات كل حساب تعمل مع إعداد التنبيهات العام.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  headerIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#d1fae5', alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 40, gap: 14, maxWidth: 760, width: '100%', alignSelf: 'center' },
  heroCard: { backgroundColor: '#ecfdf5', borderRadius: 22, borderWidth: 1, borderColor: '#bbf7d0', padding: 17, gap: 16 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#d1fae5', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: '#064e3b', fontSize: 18, fontWeight: '900', textAlign: 'right' },
  heroDescription: { color: '#047857', fontSize: 12, lineHeight: 19, textAlign: 'right' },
  statsRow: { flexDirection: 'row', gap: 8 },
  statBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.78)', borderRadius: 15, paddingVertical: 11, paddingHorizontal: 5, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: '#d1fae5' },
  statNumber: { color: '#0f172a', fontSize: 18, fontWeight: '900' },
  statLabel: { color: '#64748b', fontSize: 10, fontWeight: '700', textAlign: 'center' },
  globalCard: { backgroundColor: '#fff', borderRadius: 18, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  iconBox: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#d1fae5', alignItems: 'center', justifyContent: 'center' },
  iconBoxOff: { backgroundColor: '#f1f5f9' },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: '#0f172a', textAlign: 'right' },
  sectionIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#d1fae5', alignItems: 'center', justifyContent: 'center' },
  searchBox: { minHeight: 48, backgroundColor: '#fff', borderRadius: 15, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#e2e8f0' },
  searchInput: { flex: 1, color: '#0f172a', fontSize: 14, paddingVertical: 10, outlineStyle: 'none' as any },
  personCard: { backgroundColor: '#fff', borderRadius: 19, padding: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderWidth: 1, borderColor: '#e2e8f0' },
  personHeader: { width: '100%', flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#e2e8f0' },
  avatarFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#d1fae5' },
  initial: { color: '#047857', fontWeight: '900', fontSize: 18 },
  rowTitle: { color: '#0f172a', fontSize: 14, fontWeight: '800', textAlign: 'right' },
  username: { color: '#94a3b8', fontSize: 11, textAlign: 'right' },
  customBadge: { backgroundColor: '#fffbeb', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  customBadgeText: { color: '#b45309', fontSize: 10, fontWeight: '800' },
  hint: { color: '#64748b', fontSize: 12, lineHeight: 19, textAlign: 'right' },
  settingDivider: { height: 1, width: '100%', backgroundColor: '#f1f5f9' },
  settingRow: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  settingLabel: { color: '#334155', fontSize: 12, fontWeight: '800', textAlign: 'right' },
  settingHint: { color: '#94a3b8', fontSize: 10, textAlign: 'right', lineHeight: 16 },
  empty: { backgroundColor: '#fff', padding: 26, borderRadius: 20, alignItems: 'center', gap: 9, borderWidth: 1, borderColor: '#e2e8f0' },
  emptyIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: '#0f172a', fontSize: 15, fontWeight: '800' },
  footerCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', borderWidth: 1, borderRadius: 15, padding: 13 },
  footer: { color: '#166534', fontSize: 11, lineHeight: 18, textAlign: 'right', flex: 1 },
});
