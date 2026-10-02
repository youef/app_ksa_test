import { StyleSheet } from 'react-native';

export const C = {
  bg: '#F8FAFC',
  card: '#FFFFFF',
  ink: '#0F172A',
  muted: '#64748B',
  line: '#E2E8F0',
  accent: '#059669',
  accentDark: '#047857',
  accentSoft: '#ECFDF5',
  success: '#10B981',
  danger: '#DC2626',
  warning: '#F59E0B',
  heroStart: '#065F46',
  heroMid: '#059669',
  heroEnd: '#10B981',
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
  title: { fontSize: 30, fontWeight: '900', color: C.ink, textAlign: 'right' },
  subtitle: { fontSize: 15, color: C.muted, textAlign: 'right', lineHeight: 23, marginTop: 5 },
  card: { backgroundColor: C.card, borderRadius: R.lg, borderWidth: 1, borderColor: C.line, padding: 16, marginBottom: 12 },
  input: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 15, padding: 14, textAlign: 'right', fontSize: 16, marginBottom: 10, color: C.ink },
  button: { backgroundColor: C.accent, borderRadius: 15, padding: 15, alignItems: 'center', marginTop: 4 },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  ghost: { borderWidth: 1, borderColor: C.line, borderRadius: 15, padding: 13, alignItems: 'center', backgroundColor: C.card },
  row: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontWeight: '800', color: C.ink, textAlign: 'right', marginBottom: 7 },
  meta: { color: C.muted, textAlign: 'right', fontSize: 12 },
  body: { color: '#34413B', textAlign: 'right', fontSize: 15, lineHeight: 23 },
  screen: { flex: 1, width: '100%', backgroundColor: C.bg },
  section: { marginBottom: 18 },
  hero: { backgroundColor: C.heroMid, borderBottomLeftRadius: R.xl, borderBottomRightRadius: R.xl },
});