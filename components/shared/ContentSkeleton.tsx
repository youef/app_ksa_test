import React from 'react';
import { View, Text, StyleSheet, useWindowDimensions } from 'react-native';
import { OASIS } from '@/lib/oasis';

/** A content-shaped loading state that does not animate when reduced motion is preferred. */
export function ContentSkeleton({ variant }: { variant: 'market' | 'profile' }) {
  const { width } = useWindowDimensions();
  const columns = width >= 760 ? 2 : 1;
  return (
    <View accessibilityRole="progressbar" accessibilityLabel={variant === 'market' ? 'جارٍ تحميل عروض السوق' : 'جارٍ تحميل الملف الشخصي'} style={styles.root}>
      {variant === 'profile' ? (
        <View style={styles.profileCard}>
          <View style={styles.cover} />
          <View style={styles.profileRow}>
            <View style={styles.avatar} />
            <View style={styles.profileLines}><View style={[styles.line, { width: '70%' }]} /><View style={[styles.line, { width: '48%' }]} /></View>
          </View>
          <View style={styles.statRow}>{[0,1,2].map(i => <View key={i} style={styles.stat} />)}</View>
        </View>
      ) : <View style={styles.toolbar}><View style={[styles.line, { width: '55%' }]} /><View style={[styles.line, { width: '28%' }]} /></View>}
      <View style={styles.grid}>
        {[0,1,2,3].map(i => (
          <View key={i} style={[styles.card, { width: columns === 2 ? '48.5%' : '100%' }]}>
            <View style={styles.thumbnail} />
            <View style={[styles.line, { width: '78%' }]} />
            <View style={[styles.line, { width: '52%' }]} />
            <View style={styles.cardFooter}><View style={[styles.line, { width: '30%' }]} /><View style={styles.pill} /></View>
          </View>
        ))}
      </View>
      <Text style={styles.hint}>نجهّز المحتوى لك…</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { width: '100%', maxWidth: 1080, alignSelf: 'center', padding: 16, gap: 16 },
  grid: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  card: { backgroundColor: OASIS.colors.surface, borderColor: OASIS.colors.line, borderWidth: 1, borderRadius: 18, padding: 12, gap: 12 },
  thumbnail: { height: 126, borderRadius: 12, backgroundColor: '#E7EBEF' },
  line: { height: 13, borderRadius: 8, backgroundColor: '#E7EBEF' },
  cardFooter: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  pill: { width: 64, height: 32, borderRadius: 12, backgroundColor: '#E7EBEF' },
  toolbar: { backgroundColor: OASIS.colors.surface, padding: 18, borderRadius: 16, gap: 12 },
  profileCard: { backgroundColor: OASIS.colors.surface, borderRadius: 20, overflow: 'hidden', paddingBottom: 18, gap: 14 },
  cover: { height: 118, backgroundColor: '#E7EBEF' },
  profileRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 16, paddingHorizontal: 16 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#D7DEE6' },
  profileLines: { flex: 1, gap: 12 },
  statRow: { flexDirection: 'row-reverse', gap: 12, paddingHorizontal: 16 },
  stat: { flex: 1, height: 50, borderRadius: 12, backgroundColor: '#E7EBEF' },
  hint: { color: OASIS.colors.muted, textAlign: 'center', fontSize: 13 },
});
