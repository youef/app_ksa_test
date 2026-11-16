import { useEffect } from 'react';
import { Image, Platform, StyleSheet, View, type ViewProps } from 'react-native';
import { usePathname } from 'expo-router';
import { useTheme } from '@/context/ThemeContext';
import { usePageBackground } from '@/hooks/usePageBackground';

/** Decorative backgrounds for internal pages and the independently managed chat. */
export default function AppBackground({ children, style, ...props }: ViewProps) {
  const path = usePathname().replace(/\/+$/, '') || '/';
  const { colors } = useTheme();
  const background = usePageBackground(path === '/conversation' ? 'chat' : 'app');
  const enabled = path !== '/' && path !== '/index' && path !== '/auth' && !path.startsWith('/auth/');

  // Paint outside React Native's fixed viewport in iOS standalone mode.
  const wallpaperUrl = typeof background.source === 'object' && background.source && 'uri' in background.source
    ? background.source.uri
    : '/welcome/hayna-app-background.png';
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined' || !enabled) return;
    const hex = colors.background.replace('#', '');
    const rgb = /^[0-9a-fA-F]{6}$/.test(hex)
      ? [0, 2, 4].map(index => parseInt(hex.slice(index, index + 2), 16))
      : [243, 247, 244];
    const opacity = Math.max(0, Math.min(1, background.opacity));
    const tint = `rgba(${rgb.join(',')},${(1 - opacity).toFixed(3)})`;
    const wallpaper = `linear-gradient(${tint},${tint}),url(${JSON.stringify(wallpaperUrl)})`;
    const nodes = [document.documentElement, document.body];
    const previous = nodes.map(node => ({
      image: node.style.backgroundImage,
      size: node.style.backgroundSize,
      position: node.style.backgroundPosition,
      repeat: node.style.backgroundRepeat,
    }));
    nodes.forEach(node => {
      node.style.backgroundImage = wallpaper;
      node.style.backgroundSize = 'cover';
      node.style.backgroundPosition = 'center bottom';
      node.style.backgroundRepeat = 'no-repeat';
    });
    return () => nodes.forEach((node, i) => {
      node.style.backgroundImage = previous[i].image;
      node.style.backgroundSize = previous[i].size;
      node.style.backgroundPosition = previous[i].position;
      node.style.backgroundRepeat = previous[i].repeat;
    });
  }, [enabled, wallpaperUrl, background.opacity, colors.background]);
  return <View {...props} testID="app-background" style={[{ flex: 1 }, style, { backgroundColor: colors.background }]}>
    {enabled ? <View pointerEvents="none" style={StyleSheet.absoluteFillObject}><Image accessible={false} source={background.source} onError={background.onError} resizeMode="cover" style={[StyleSheet.absoluteFillObject, { opacity: background.opacity }]} /></View> : null}
    {children}
  </View>;
}
