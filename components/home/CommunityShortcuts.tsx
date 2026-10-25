import { useCallback, useEffect, useState } from 'react';
import { Image, Linking, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowUpLeft, Megaphone } from 'lucide-react-native';
import { OasisPressable as Pressable } from '@/components/oasis/OasisPrimitives';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/context/ThemeContext';

type Announcement = { id: string; title: string | null; message: string | null; image_url: string | null; expires_at: string; action_type: 'none' | 'internal' | 'external'; action_target: string | null };
export default function CommunityShortcuts({ signedIn: _signedIn }: { signedIn: boolean }) {
  const { colors: c, isDark } = useTheme();
  const [items, setItems] = useState<Announcement[]>([]);
  const [active, setActive] = useState(0);
  const refresh = useCallback(async () => {
    const { data, error } = await supabase.from('home_announcements').select('id,title,message,image_url,expires_at,action_type,action_target')
      .gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(30);
    if (!error) setItems((data || []) as Announcement[]);
  }, []);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => { void refresh(); setActive(n => n + 1); }, 30000);
    return () => clearInterval(timer);
  }, [refresh]);
  const visible = items.filter(item => Date.parse(item.expires_at) > Date.now());
  const ad = visible.length ? visible[active % visible.length] : null;
  if (!ad) return null;
  const hasAction = ad.action_type !== 'none' && Boolean(ad.action_target);
  async function openDestination() {
    if (!ad?.action_target || !hasAction) return;
    if (ad.action_type === 'internal' && /^\/[a-zA-Z0-9/_-]+$/.test(ad.action_target)) {
      router.push(ad.action_target as any);
    } else if (ad.action_type === 'external' && /^https:\/\/[^\s]+$/i.test(ad.action_target)) {
      await Linking.openURL(ad.action_target).catch(() => undefined);
    }
  }
  return <View style={s.outer}>
    <View style={s.header}>
      <View style={s.headerTitle}><Megaphone size={14} color={c.primary} /><Text style={[s.label, { color: c.primary }]}>إعلانات حيّنا</Text></View>
      {visible.length > 1 ? <Text style={{ color: c.muted, fontSize: 10 }}>{(active % visible.length) + 1} / {visible.length}</Text> : <Text style={{ color: c.muted, fontSize: 10 }}>إعلان رسمي</Text>}
    </View>
    <Pressable oasisKind="plain" disabled={!hasAction} onPress={() => void openDestination()} accessibilityRole={hasAction ? 'link' : undefined} accessibilityLabel={hasAction ? 'فتح الإعلان' : 'إعلان حيّنا'} style={[s.banner, { backgroundColor: isDark ? '#14362D' : '#E7F5ED', borderColor: c.line }]}>
      {ad.image_url && !ad.title && !ad.message ? (
        <Image source={{ uri: ad.image_url }} resizeMode="cover" style={s.fullImage} accessibilityLabel="صورة الإعلان" />
      ) : ad.image_url ? (
        <View style={s.mixed}>
          <View style={s.copy}>
            {ad.title ? <Text numberOfLines={2} style={[s.title, { color: c.ink }]}>{ad.title}</Text> : null}
            {ad.message ? <Text numberOfLines={3} style={[s.message, { color: c.muted }]}>{ad.message}</Text> : null}
            {hasAction ? <View style={s.cta}><Text style={s.ctaText}>اكتشف المزيد</Text><ArrowUpLeft size={13} color="#FFFFFF" /></View> : null}
          </View>
          <Image source={{ uri: ad.image_url }} resizeMode="cover" style={s.sideImage} />
        </View>
      ) : (
        <View style={s.textOnly}>
          <View style={s.copy}>
            {ad.title ? <Text numberOfLines={2} style={[s.title, { color: c.ink }]}>{ad.title}</Text> : null}
            {ad.message ? <Text numberOfLines={3} style={[s.message, { color: c.muted }]}>{ad.message}</Text> : null}
          </View>
          {hasAction ? <View style={s.cta}><Text style={s.ctaText}>عرض التفاصيل</Text><ArrowUpLeft size={13} color="#FFFFFF" /></View> : null}
        </View>
      )}
      {hasAction && ad.image_url && !ad.title && !ad.message ? <View style={s.imageAction}><ArrowUpLeft size={17} color="#FFFFFF" /></View> : null}
    </Pressable>
    {visible.length > 1 ? <View style={s.dots}>{visible.slice(0, 8).map((item, i) => <View key={item.id} style={[s.dot, { backgroundColor: i === active % visible.length ? c.primary : c.line, width: i === active % visible.length ? 15 : 5 }]} />)}</View> : null}
  </View>;
}
const s = StyleSheet.create({
  outer: { marginHorizontal: 14, marginTop: 9, marginBottom: 12, gap: 7, maxWidth: 760, width: 'auto' },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 3 },
  headerTitle: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  label: { fontSize: 11, fontWeight: '800' },
  banner: { width: '100%', aspectRatio: 2.8, minHeight: 112, maxHeight: 200, borderRadius: 17, borderWidth: 1, overflow: 'hidden', padding: 0, position: 'relative' },
  fullImage: { width: '100%', height: '100%' },
  mixed: { flex: 1, flexDirection: 'row-reverse' },
  sideImage: { width: '43%', height: '100%' },
  copy: { flex: 1, justifyContent: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 9 },
  textOnly: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 4 },
  title: { fontSize: 15, fontWeight: '900', textAlign: 'right' },
  message: { fontSize: 11, lineHeight: 17, textAlign: 'right' },
  cta: { backgroundColor: '#047857', borderRadius: 9, paddingHorizontal: 9, paddingVertical: 6, flexDirection: 'row-reverse', alignItems: 'center', gap: 5, alignSelf: 'flex-start' },
  ctaText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  imageAction: { position: 'absolute', bottom: 10, left: 10, backgroundColor: 'rgba(4,78,59,0.88)', borderRadius: 12, padding: 8 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dot: { height: 5, borderRadius: 5 },
});
