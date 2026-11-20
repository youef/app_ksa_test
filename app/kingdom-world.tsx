import React from 'react';
import { Platform, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { ArrowRight, Gamepad2 } from 'lucide-react-native';
import { AppHeader } from '@/components/shared/AppHeader';
import { useTheme } from '@/context/ThemeContext';
import { OasisPressable as Pressable } from '@/components/oasis/OasisPrimitives';

export default function KingdomWorld() {
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  if (Platform.OS === 'web') {
    return <View style={{ flex: 1, backgroundColor: '#102b25' }}>
      {React.createElement('iframe' as any, { title: 'مماليك حيّنا 3D', src: '/mamaleek-hina.html', allow: 'fullscreen; gamepad', style: { width: '100%', height: '100%', border: 0, display: 'block' } })}
    </View>;
  }
  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <AppHeader variant="sub" fallbackRoute="/kingdom" title="مماليك حيّنا 3D" subtitle="العالم المفتوح" />
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 14 }}>
      <Gamepad2 size={48} color={colors.primary} />
      <Text style={{ color: colors.ink, fontSize: 19, fontWeight: '800', textAlign: 'center' }}>عالم مماليك حيّنا جاهز لنسخة الويب</Text>
      <Text style={{ color: colors.muted, textAlign: 'center', lineHeight: 24 }}>تمت إضافة مدخل اللعبة إلى تطبيق حيّنا. تشغيل محرك WebGL داخل تطبيق iOS وAndroid يتطلب إضافة WebView أو إعداد محرك رسوم أصلي في إصدار التطبيق القادم.</Text>
      <Pressable oasisKind="plain" onPress={() => router.replace('/kingdom')} style={{ backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14 }}>
        <Text style={{ color: '#fff', fontWeight: '700' }}>العودة إلى ممالك حيّنا</Text>
      </Pressable>
    </View>
  </View>;
}
