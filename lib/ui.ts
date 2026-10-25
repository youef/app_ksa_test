import { OASIS } from '@/lib/oasis';
import { StyleSheet } from 'react-native';

export const C = {
  bg: OASIS.colors.background,
  card: OASIS.colors.surface,
  ink: OASIS.colors.ink,
  muted: OASIS.colors.muted,
  line: OASIS.colors.line,
  accent: OASIS.colors.primary,
  accentDark: OASIS.colors.primary,
  accentSoft: OASIS.colors.soft,
  success: OASIS.colors.primary,
  danger: OASIS.colors.danger,
  warning: OASIS.colors.warning,
  heroStart: OASIS.colors.deep,
  heroMid: OASIS.colors.primary,
  heroEnd: OASIS.colors.primary,
  shadow: 'rgba(15, 23, 42, 0.08)',
} as const;

export const R = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  pill: 999,
} as const;

export const S = StyleSheet.create({
  page: { flexGrow: 1, width: '100%', backgroundColor: C.bg },
  scrollContent: { padding: 18, paddingBottom: 110 },
  title: { fontSize: 22, fontWeight: '700', color: C.ink, textAlign: 'right' },
  subtitle: { fontSize: 15, color: C.muted, textAlign: 'right', lineHeight: 23, marginTop: 5 },
  card: { backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, padding: 14, marginBottom: 12 },
  input: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 15, padding: 14, textAlign: 'right', fontSize: 16, marginBottom: 10, color: C.ink },
  button: { backgroundColor: C.accent, borderRadius: 15, padding: 15, alignItems: 'center', marginTop: 4 },
  buttonText: { color: OASIS.colors.surface, fontWeight: '600', fontSize: 16 },
  ghost: { borderWidth: 1, borderColor: C.line, borderRadius: 15, padding: 13, alignItems: 'center', backgroundColor: C.card },
  row: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontWeight: '600', color: C.ink, textAlign: 'right', marginBottom: 7 },
  meta: { color: C.muted, textAlign: 'right', fontSize: 12 },
  body: { color: '#34413B', textAlign: 'right', fontSize: 15, lineHeight: 23 },
  screen: { flex: 1, width: '100%', backgroundColor: C.bg },
  section: { marginBottom: 18 },
  hero: { backgroundColor: C.heroMid, borderBottomLeftRadius: R.xl, borderBottomRightRadius: R.xl },
});
