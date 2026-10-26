import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { BadgeCheck, BellRing, ShieldCheck } from 'lucide-react-native';
import AppHeader from '@/components/shared/AppHeader';
import { OasisPressable as Pressable } from '@/components/oasis/OasisPrimitives';
import { useTheme } from '@/context/ThemeContext';
import { useBottomNavInset } from '@/lib/bottomNav';
import { supabase } from '@/lib/supabase';
import { loadPlatformMessages, markPlatformMessagesRead, PLATFORM_NAME, type PlatformMessage } from '@/lib/platformMessages';

export default function PlatformInbox() {
  const { colors } = useTheme();
  const bottom = useBottomNavInset();
  const [messages, setMessages] = useState<PlatformMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const busy = useRef(false);
  const load = useCallback(async (older = false) => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('سجّل دخولك لقراءة رسائل المنصة.');
      const page = await loadPlatformMessages(user.id, older ? messages[messages.length - 1] : undefined);
      setHasMore(page.length === 40);
      setMessages(previous => older ? [...previous, ...page.filter(row => !previous.some(item => item.id === row.id))] : page);
      await markPlatformMessagesRead(user.id, page.filter(row => !row.read).map(row => row.id));
    } catch (e) { setError(e instanceof Error ? e.message : 'تعذر تحميل الرسائل.'); }
    finally { busy.current = false; setLoading(false); }
  }, [messages]);
  const loadRef = useRef(load);
  loadRef.current = load;
  useFocusEffect(useCallback(() => {
    void loadRef.current();
    // Recipient filtering is enforced by RLS; refresh when an official message arrives.
    const channel = supabase.channel('platform-inbox')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'platform_messages' }, () => { void loadRef.current(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []));
  return <View style={{ flex: 1, backgroundColor: 'transparent' }}>
    <AppHeader variant="sub" title={PLATFORM_NAME} subtitle="الحساب الرسمي · الترحيب وآخر التحديثات" fallbackRoute="/messages" />
    <ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />} contentContainerStyle={[s.content, { paddingBottom: bottom + 20 }]}>
      <View style={[s.identity, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        <View style={[s.avatar, { backgroundColor: colors.soft }]}><ShieldCheck color={colors.primary} size={24} /></View>
        <View style={{ flex: 1, gap: 4 }}><Text style={[s.name, { color: colors.ink }]}>{PLATFORM_NAME} <BadgeCheck size={15} color={colors.primary} /></Text><Text style={[s.note, { color: colors.muted }]}>رسائل رسمية من فريق المنصة. للدعم، تواصل معنا عبر صفحة المساعدة.</Text></View>
      </View>
      {error ? <Pressable oasisKind="action" onPress={() => void load()}><Text style={{ color: colors.danger }}>{error} · إعادة المحاولة</Text></Pressable> : null}
      {!loading && !error && !messages.length ? <View style={s.empty}><BellRing size={28} color={colors.primary} /><Text style={[s.name, { color: colors.ink }]}>كل جديد من حيّنا يصلك هنا</Text><Text style={[s.note, { color: colors.muted }]}>ستظهر رسائل الترحيب والإعلانات والتحديثات في هذه المحادثة.</Text></View> : null}
      {[...messages].reverse().map(message => <View key={message.id} style={[s.bubble, { backgroundColor: colors.surface, borderColor: colors.line }]}>
        <Text style={[s.tag, { color: colors.primary }]}>{message.type === 'welcome' ? 'أهلًا بك' : message.type === 'update' ? 'جديد المنصة' : 'رسالة رسمية'}</Text>
        {message.title ? <Text style={[s.title, { color: colors.ink }]}>{message.title}</Text> : null}
        <Text selectable style={[s.body, { color: colors.ink }]}>{message.body}</Text>
        <Text style={[s.date, { color: colors.muted }]}>{new Date(message.created_at).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' })}</Text>
      </View>)}
      {loading ? <ActivityIndicator color={colors.primary} /> : hasMore ? <Pressable oasisKind="action" onPress={() => void load(true)}><Text style={{ color: colors.primary }}>الرسائل السابقة</Text></Pressable> : null}
    </ScrollView>
  </View>;
}
const s = StyleSheet.create({
  content: { padding: 16, gap: 12, maxWidth: 680, width: '100%', alignSelf: 'center', flexGrow: 1 },
  identity: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 16, fontWeight: '700', textAlign: 'right' }, note: { fontSize: 12, lineHeight: 20, textAlign: 'right' },
  empty: { alignItems: 'center', paddingVertical: 36, gap: 12 },
  bubble: { width: '94%', alignSelf: 'flex-end', padding: 14, borderWidth: 1, borderRadius: 16, borderTopRightRadius: 4, gap: 7 },
  tag: { fontSize: 11, fontWeight: '700', textAlign: 'right' }, title: { fontSize: 16, fontWeight: '700', textAlign: 'right' },
  body: { fontSize: 15, lineHeight: 25, textAlign: 'right', writingDirection: 'rtl' }, date: { fontSize: 10, textAlign: 'left', marginTop: 4 },
});
