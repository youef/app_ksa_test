import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, Monitor, Palette } from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';
import { ThemeToggle } from '@/components/shared/ThemeToggle';

export function AppearanceSettings({ onProfileDesign }: { onProfileDesign: () => void }) {
  const { colors, mode, isDark } = useTheme();
  const modeLabel = mode === 'system' ? 'تلقائي · حسب إعدادات جهازك' : isDark ? 'الوضع الداكن' : 'الوضع الفاتح';
  return <View testID="appearance-settings" style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.line }]}>
    <View style={{ alignItems: 'flex-end', gap: 8 }}>
      <Text style={[styles.eyebrow, { color: colors.primary }]}>تجربة تناسبك</Text>
      <Text style={[styles.title, { color: colors.ink }]}>اختر مظهر التطبيق</Text>
      <Text style={[styles.description, { color: colors.muted }]}>اختر إضاءة مريحة لك، أو دع المظهر يتغيّر تلقائيًا مع جهازك.</Text>
    </View>

    <View style={[styles.preview, { backgroundColor: colors.background, borderColor: colors.line }]} accessibilityLabel={`معاينة المظهر: ${modeLabel}`}>
      <View style={[styles.windowBar, { backgroundColor: colors.surface, borderColor: colors.line }]}><View style={styles.dots}>{[0.35, 0.55, 0.8].map(opacity => <View key={opacity} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.muted, opacity }} />)}</View><Text style={{ color: colors.muted, fontSize: 11 }}>حيّنا</Text></View>
      <View style={styles.previewBody}>
        <View style={[styles.previewAvatar, { backgroundColor: colors.soft }]}><Text style={{ color: colors.primary, fontSize: 24, fontWeight: '800' }}>ح</Text></View>
        <View style={{ flex: 1, gap: 10, alignItems: 'flex-end' }}><View style={[styles.line, { width: '55%', backgroundColor: colors.ink, opacity: 0.8 }]} /><View style={[styles.line, { width: '90%', backgroundColor: colors.line }]} /><View style={[styles.line, { width: '72%', backgroundColor: colors.line }]} /><View style={{ width: 65, height: 23, borderRadius: 12, backgroundColor: colors.primary, marginTop: 3 }} /></View>
      </View>
      <View style={[styles.previewFooter, { borderColor: colors.line }]}><Monitor size={14} color={colors.primary} /><Text style={{ color: colors.muted, fontSize: 12 }}>{modeLabel}</Text></View>
    </View>

    <View style={{ gap: 12 }}><ThemeToggle /><Text style={[styles.description, { color: colors.muted, fontSize: 11 }]}>يُحفظ اختيارك تلقائيًا على هذا الجهاز ويُطبّق على جميع صفحات التطبيق.</Text></View>

    <Pressable accessibilityRole="button" onPress={onProfileDesign} style={[styles.designLink, { borderColor: colors.line }]}>
      <View style={[styles.linkIcon, { backgroundColor: colors.soft }]}><Palette size={19} color={colors.primary} /></View>
      <View style={{ flex: 1, alignItems: 'flex-end', gap: 5 }}><Text style={{ color: colors.ink, fontSize: 13, fontWeight: '700' }}>تخصيص ملفك العام</Text><Text style={{ color: colors.muted, fontSize: 11, textAlign: 'right' }}>الغلاف والألوان والأقسام التي يراها الآخرون</Text></View><ArrowLeft size={17} color={colors.muted} />
    </Pressable>
  </View>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 20, padding: 24, gap: 24 },
  eyebrow: { fontSize: 11, fontWeight: '700' },
  title: { fontSize: 23, fontWeight: '800', textAlign: 'right' },
  description: { fontSize: 13, lineHeight: 22, textAlign: 'right' },
  preview: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  windowBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: 1 },
  dots: { flexDirection: 'row', gap: 5 },
  previewBody: { flexDirection: 'row-reverse', gap: 14, padding: 24, alignItems: 'flex-start' },
  previewAvatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  line: { height: 7, borderRadius: 5 },
  previewFooter: { flexDirection: 'row-reverse', gap: 7, justifyContent: 'center', alignItems: 'center', borderTopWidth: 1, padding: 12 },
  designLink: { borderTopWidth: 1, paddingTop: 20, flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  linkIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
