import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Palette, Pin, ChevronLeft } from 'lucide-react-native';

type Props = { accentColor?: string; compact?: boolean };

export function ProfileCustomizationEntry({ accentColor = '#059669', compact = false }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="فتح تخصيص الملف وإدارة الأعمال المميزة"
      onPress={() => router.push('/profile-customization')}
      style={({ pressed }) => [
        styles.card,
        compact && styles.compact,
        { borderColor: `${accentColor}55`, backgroundColor: `${accentColor}0D`, opacity: pressed ? 0.82 : 1 },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: `${accentColor}18` }]}>
        <Palette size={20} color={accentColor} />
      </View>
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
  iconWrap: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 4 },
  title: { fontSize: 14, fontWeight: '900', color: '#0f172a', textAlign: 'right' },
  description: { fontSize: 11, lineHeight: 17, color: '#64748b', textAlign: 'right' },
  trailing: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
});
