import { OASIS } from '@/lib/oasis';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ban, ShieldAlert } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';

export default function BannedScreen() {
  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <View style={styles.icon}><Ban size={40} color={OASIS.colors.danger} /></View>
        <Text style={styles.title}>تم إغلاق الحساب</Text>
        <Text style={styles.body}>
          تم حظر حسابك بسبب مخالفة شروط منصة حيّنا (محتوى غير لائق/مغازل/تحرش/محتوى جنسي أو غير قانوني).
          {'\n\n'}
          لا يمكنك استخدام أي إجراء في المنصة. للاستفسار، تواصل مع الدعم (support@hayna.app).
        </Text>
        <View style={styles.row}>
          <ShieldAlert size={16} color={OASIS.colors.muted} />
          <Text style={styles.note}>الجهة القانونية قد تُبلّغ في حالات الإساءة.</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent', padding: 24 },
  card: { maxWidth: 420, width: '100%', backgroundColor: OASIS.colors.surface, borderRadius: 18, borderWidth: 1, borderColor: OASIS.colors.line, padding: 24, alignItems: 'center', gap: 12 },
  icon: { width: 72, height: 72, borderRadius: 36, backgroundColor: OASIS.colors.dangerSoft, alignItems: 'center', justifyContent: 'center' },
  title: { color: OASIS.colors.danger, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  body: { color: OASIS.colors.ink, fontSize: 13, lineHeight: 22, textAlign: 'center' },
  row: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginTop: 6 },
  note: { color: OASIS.colors.muted, fontSize: 11, textAlign: 'center' },
});
