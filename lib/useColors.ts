/**
 * useColors() — returns the current theme palette reactively.
 *
 * Usage:
 *   const C = useColors();
 *   <View style={{ backgroundColor: C.background }} />
 *
 * This is a thin re-export of useTheme().colors for convenience.
 */
export { useTheme, LIGHT_COLORS, DARK_COLORS } from '@/context/ThemeContext';
export type { OasisColors, ThemeMode } from '@/context/ThemeContext';

import { useTheme } from '@/context/ThemeContext';
export function useColors() {
  return useTheme().colors;
}
