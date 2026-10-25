import { OasisPressable as Pressable, OasisSurface } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Palette, Pin, ChevronLeft } from 'lucide-react-native';

type Props = { accentColor?: string; compact?: boolean };

export function ProfileCustomizationEntry({ accentColor = OASIS.colors.primary, compact = false }: Props) {
  return (
    <Pressable oasisKind="card"
      accessibilityRole="button"
      accessibilityLabel="فتح تخصيص الملف وإدارة الأعمال المميزة"
      onPress={() => router.push({ pathname: '/profile', params: { tab: 'settings', section: 'design' } })}
      style={({ pressed }) => [
        styles.card,
        compact && styles.compact,
        { borderColor: `${accentColor}55`, backgroundColor: `${accentColor}0D`, opacity: pressed ? 0.82 : 1 },
      ]}
    >
      <OasisSurface oasisSurface="icon" style={[styles.iconWrap, { backgroundColor: `${accentColor}18` }]}>
        <Palette size={20} color={accentColor} />
      </OasisSurface>
      <View style={styles.copy}>
        <Text style={styles.title}>تخصيص الملف الشخصي</Text>
        <Text style={styles.description}>مظهر الملف، الإحصائيات، الشارات والأعمال المثبتة</Text>
      </View>
      <View style={styles.trailing}>
        <Pin size={15} color={accentColor} />
        <ChevronLeft size={18} color={accentColor} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginHorizontal: 16, marginTop: 12, padding: 14, borderWidth: 1, borderRadius: 16, flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  compact: { marginHorizontal: 0, marginTop: 8 },
  iconWrap: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 4 },
  title: { fontSize: 14, fontWeight: '700', color: OASIS.colors.ink, textAlign: 'right' },
  description: { fontSize: 11, lineHeight: 17, color: OASIS.colors.muted, textAlign: 'right' },
  trailing: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
});
