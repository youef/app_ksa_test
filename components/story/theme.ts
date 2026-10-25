import { OASIS } from '@/lib/oasis';
export const SC = {
  bg: '#0a0f1d',
  panel: OASIS.colors.ink,
  panelAlt: OASIS.colors.ink,
  panelDeep: OASIS.colors.ink,
  border: OASIS.colors.ink,
  borderSoft: '#1f2937',
  muted: '#94a3b8',
  mutedSoft: OASIS.colors.muted,
  primary: OASIS.colors.primary,
  mint: OASIS.colors.primary,
  mintSoft: '#a7f3d0',
  danger: OASIS.colors.danger,
  white: OASIS.colors.surface,
  scrim: 'rgba(0,0,0,0.5)',
  imageScrim: [OASIS.colors.ink, OASIS.colors.ink] as [string, string],
} as const;
