/**
 * Hayna design tokens.
 * OASIS.colors now returns the *current* theme palette through the
 * ThemeContext proxy — every component that reads `OASIS.colors.xxx` gets
 * the right value without any import changes.
 *
 * For SSR / initial render (before the ThemeProvider mounts) we fall back
 * to the light palette, which matches the previous hard-coded values.
 */
import { LIGHT_COLORS, DARK_COLORS } from '@/context/ThemeContext';
export type { OasisColors } from '@/context/ThemeContext';
export { LIGHT_COLORS, DARK_COLORS };

// Re-export for convenience
export { useTheme } from '@/context/ThemeContext';

/**
 * Static token object — keeps the same shape as before so zero files break.
 * Components that need *reactive* colours should use `useTheme().colors`
 * (or the `useOasis()` shorthand below).  OASIS.colors is the light palette
 * and is kept for non-component contexts (StyleSheet.create outside render,
 * etc.) where a hook cannot be called.
 */
export const OASIS = {
  colors: LIGHT_COLORS,
  heights: { chip: 32, compact: 36, icon: 44, standard: 44, form: 44, prominent: 48, hero: 48 },
  radius: { input: 10, card: 14, sheet: 20, pill: 999 },
  spacing: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, section: 24, page: 32 },
  maxWidth: { form: 440, feed: 680, chat: 960, page: 1200 },
  touchTarget: 44,
} as const;

export type OasisVariant = 'primary' | 'secondary' | 'subtle' | 'ghost' | 'danger' | 'gold';
export type OasisButtonSize = 'xs' | 'sm' | 'icon' | 'md' | 'form' | 'lg' | 'hero';
export type OasisState = 'default' | 'pressed' | 'focus' | 'disabled';
