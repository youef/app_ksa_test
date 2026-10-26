/**
 * ThemeContext — Dark / Light mode for the entire platform.
 * Persisted to AsyncStorage. Consumed via `useTheme()`.
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'light' | 'dark' | 'system';

// ─── Color Palettes ──────────────────────────────────────────────────────────

export const LIGHT_COLORS = {
  background: '#F2F2F7',
  surface: '#FFFFFF',
  ink: '#1C1C1E',
  muted: '#636366',
  line: '#E5E5EA',
  primary: '#047857',
  deep: '#064E3B',
  soft: '#EAF5EF',
  gold: '#C4A45F',
  danger: '#B93838',
  dangerSoft: '#FFF0EC',
  warning: '#986B19',
  warningSoft: '#FFFAE8',
  info: '#286A91',
  infoSoft: '#EFF7FC',
  chatBackground: '#F2F2F7',
  live: '#0D211B',
  liveSurface: '#153C30',
} as const;

export const DARK_COLORS = {
  background: '#0F0F10',
  surface: '#1C1C1E',
  ink: '#FFFFFF',
  muted: '#F2F2F7',
  line: '#2C2C2E',
  primary: '#34D399',
  deep: '#059669',
  soft: '#0D2419',
  gold: '#D4B06A',
  danger: '#F87171',
  dangerSoft: '#3A1515',
  warning: '#FBB849',
  warningSoft: '#2E2209',
  info: '#60A5FA',
  infoSoft: '#0F2235',
  chatBackground: '#111112',
  live: '#0D211B',
  liveSurface: '#153C30',
} as const;

export type OasisColors = Record<keyof typeof LIGHT_COLORS, string>;

let activeColors: OasisColors = LIGHT_COLORS;

export function setActiveColors(colors: OasisColors) {
  activeColors = colors;
}

export function getActiveColors(): OasisColors {
  return activeColors;
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface ThemeContextValue {
  mode: ThemeMode;
  isDark: boolean;
  colors: OasisColors;
  setMode: (mode: ThemeMode) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'system',
  isDark: false,
  colors: LIGHT_COLORS,
  setMode: () => {},
  toggle: () => {},
});

const STORAGE_KEY = '@hayna_theme_mode';

// ─── Provider ────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const modeRef = useRef<ThemeMode>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((saved) => {
        if (saved === 'light' || saved === 'dark' || saved === 'system') {
          setModeState(saved);
          modeRef.current = saved;
        }
      })
.catch(() => {});
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    if (next === modeRef.current) return;
    modeRef.current = next;
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.setTimeout(() => window.location.reload(), 80);
    }
  }, []);

  const toggle = useCallback(() => {
    const next = modeRef.current === 'dark' ? 'light' : 'dark';
    setMode(next);
  }, [setMode]);

  const isDark =
    mode === 'dark' || (mode === 'system' && systemScheme === 'dark');

  const colors = isDark ? DARK_COLORS : LIGHT_COLORS;
  setActiveColors(colors);

  return (
    <ThemeContext.Provider value={{ mode, isDark, colors, setMode, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTheme() {
  return useContext(ThemeContext);
}
