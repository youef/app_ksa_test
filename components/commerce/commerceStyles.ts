import { StyleSheet } from 'react-native';
import type { OasisColors } from '@/lib/oasis';
export const commerceStyles = (c: OasisColors) => StyleSheet.create({
  card: { backgroundColor: c.surface, borderColor: c.line, borderWidth: 1, borderRadius: 18, padding: 16, gap: 12, marginTop: 14 },
  row: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  spread: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { color: c.ink, fontSize: 16, fontWeight: '700', textAlign: 'right' },
  body: { color: c.ink, fontSize: 13, lineHeight: 22, textAlign: 'right' },
  hint: { color: c.muted, fontSize: 12, lineHeight: 20, textAlign: 'right' },
  badge: { backgroundColor: c.soft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { color: c.primary, fontSize: 12, fontWeight: '600', textAlign: 'right' },
  button: { minHeight: 44, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row-reverse', gap: 6, backgroundColor: c.soft },
  primary: { backgroundColor: c.primary },
  buttonText: { color: c.primary, fontSize: 13, fontWeight: '600', textAlign: 'center' },
  primaryText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  icon: { minHeight: 44, minWidth: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: c.soft },
  input: { minHeight: 44, borderWidth: 1, borderColor: c.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: c.background, color: c.ink, fontSize: 14, textAlign: 'right' },
  divider: { borderTopWidth: 1, borderColor: c.line, paddingTop: 12, gap: 8 },
  error: { color: c.danger, fontSize: 13, textAlign: 'right', lineHeight: 21 },
});
