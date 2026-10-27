import { Image, StyleSheet, View, type ViewProps } from 'react-native';
import { usePathname } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { usePageBackground } from '@/hooks/usePageBackground';

/** One decorative background beneath every internal page; content surfaces stay opaque. */
export default function AppBackground({ children, style, ...props }: ViewProps) {
  const path = usePathname().replace(/\/+$/, '') || '/';
  const { colors, isDark } = useTheme();
  const background = usePageBackground('app');
  const enabled = path !== '/' && path !== '/index' && path !== '/auth' && !path.startsWith('/auth/');
  return <View {...props} testID="app-background" style={[{ flex: 1 }, style, { backgroundColor: enabled && !isDark ? '#F8FAF7' : colors.background }]}>
    {enabled ? <View pointerEvents="none" style={StyleSheet.absoluteFillObject}><Image accessible={false} source={background.source} onError={background.onError} resizeMode="cover" style={{ width: '100%', height: '100%', opacity: background.opacity }} /></View> : null}
    {children}
  </View>;
}
