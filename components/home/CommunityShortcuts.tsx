import { useTheme } from '@/context/ThemeContext';
import { OasisPressable as Pressable } from '@/components/oasis/OasisPrimitives';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { CirclePlus, Radio, ShieldCheck, ShoppingBag } from 'lucide-react-native';
import { usePlatformConfig } from '@/lib/platformConfig';

export default function CommunityShortcuts({ signedIn }: { signedIn: boolean }) {
  const { colors: c } = useTheme();
  const { flags } = usePlatformConfig();
  const links = [
    { title: 'شارك حيّك', caption: 'سؤال أو مساعدة', href: '/ask', Icon: CirclePlus },
    ...(flags.market === false ? [] : [{ title: 'السوق', caption: 'من جيرانك', href: '/market', Icon: ShoppingBag }]),
    ...(flags.live === false ? [] : [{ title: 'مباشر', caption: 'لقاءات الحي', href: '/lives', Icon: Radio }]),
    { title: 'أخبار حيّنا', caption: 'حساب المنصة', href: '/platform-inbox', Icon: ShieldCheck },
  ];
  return <View style={[s.container, { borderColor: c.line, backgroundColor: c.surface }]}>
    <View style={s.heading}><Text style={[s.title, { color: c.ink }]}>حيّك يبدأ من هنا</Text><Text style={[s.caption, { color: c.muted }]}>شارك، اكتشف، وتواصل</Text></View>
    <View style={s.links}>{links.map(({ title, caption, href, Icon }) => <Pressable key={href} oasisKind="plain" accessibilityRole="button" accessibilityLabel={`${title}، ${caption}`} onPress={() => router.push((signedIn ? href : '/auth') as any)} style={s.link}>
      <View style={[s.icon, { backgroundColor: c.soft }]}><Icon size={21} color={c.primary} /></View><Text style={[s.label, { color: c.ink }]}>{title}</Text><Text style={[s.caption, { color: c.muted }]}>{caption}</Text>
    </Pressable>)}</View>
  </View>;
}
const s = StyleSheet.create({
  container: { marginHorizontal: 14, marginTop: 8, marginBottom: 12, borderWidth: 1, borderRadius: 16, padding: 14, gap: 14 },
  heading: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  title: { fontSize: 15, fontWeight: '700', textAlign: 'right' }, caption: { fontSize: 10, textAlign: 'center' },
  links: { flexDirection: 'row-reverse', gap: 6 }, link: { flex: 1, minHeight: 78, alignItems: 'center', gap: 6 },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, label: { fontSize: 12, fontWeight: '600', textAlign: 'center' },
});
