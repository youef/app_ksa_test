import { OasisPressable as Pressable } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import { GlassIconArtwork } from './GlassIconArtwork';
import { HeaderArtwork } from './HeaderArtwork';
import React, { useState, type ReactNode } from 'react';
import { Image, Platform, ScrollView, StyleSheet, Text, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, Bell, MessageCircle, LogIn, UserRound, Home } from 'lucide-react-native';
import { FALLBACK_LOGO_URI } from '@/lib/branding';
import { usePlatformConfig } from '@/lib/platformConfig';
import { useTheme } from '@/context/ThemeContext';

export const APP_HEADER_HEIGHT = Platform.OS === 'ios' ? 44 : 48;
export const HEADER_ACTION_SIZE = 44;
export const HEADER_HORIZONTAL_PADDING = 16;
export const HEADER_SIDE_WIDTH = 88;
export type HeaderTone = 'light' | 'overlay';

export function headerTopInset(top: number) {
  return Math.max(0, top);
}
export function useAppHeaderHeight() {
  return APP_HEADER_HEIGHT + headerTopInset(useSafeAreaInsets().top) + 1;
}

export function AppHeaderFrame({ children, tone = 'light', safeArea = true, style }: { children: ReactNode; tone?: HeaderTone; safeArea?: boolean; style?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  return <View testID="app-header" style={[styles.container, { backgroundColor: 'transparent', borderBottomColor: 'transparent' }, tone === 'overlay' && styles.overlay, { paddingTop: safeArea ? headerTopInset(insets.top) : 0 }, style]}>
    <HeaderArtwork dark={tone === 'overlay' || isDark} />
    <View testID="app-header-content" style={styles.content}>{children}</View>
  </View>;
}

function actionContent(children: ReactNode, color: string): ReactNode {
  return React.Children.map(children, child => {
    if (!React.isValidElement(child)) return child;
    const element = child as React.ReactElement<{ color?: string; style?: unknown; children?: ReactNode; numberOfLines?: number }>;
    if (element.type === Text) return React.cloneElement(element, { style: [{ color, fontSize: 12, lineHeight: 18 }, element.props.style] as never, numberOfLines: 1 });
    if (element.props.color !== undefined) return React.cloneElement(element, { color });
    if (element.props.children) return React.cloneElement(element, {}, actionContent(element.props.children, color));
    return child;
  });
}
export function HeaderAction({ children, style, tone = 'light', bare = true, ...props }: PressableProps & { children: ReactNode; tone?: HeaderTone; bare?: boolean }) {
  return <Pressable oasisKind="plain" {...props} accessibilityRole="button" hitSlop={0} style={state => [styles.actionButton, bare && styles.bareAction, typeof style === 'function' ? style(state) : style, styles.glassAction, (state.pressed || props.disabled) && styles.pressed]}><GlassIconArtwork dark={tone === 'overlay'} /><View style={styles.actionForeground}>{actionContent(children, tone === 'overlay' ? OASIS.colors.surface : OASIS.colors.primary)}</View></Pressable>;
}

function decorateHeaderActions(children: ReactNode): ReactNode {
  return React.Children.map(children, child => {
    if (!React.isValidElement(child)) return child;
    const element = child as React.ReactElement<PressableProps & { children?: ReactNode }>;
    if (element.type === React.Fragment) return <React.Fragment>{decorateHeaderActions(element.props.children)}</React.Fragment>;
    if (element.type === Pressable) return <HeaderAction {...element.props}>{element.props.children}</HeaderAction>;
    return child;
  });
}

export interface AppHeaderProps {
  variant?: 'home' | 'tab' | 'sub' | 'chat';
  title?: string;
  subtitle?: string;
  fallbackRoute?: string;
  rightAction?: ReactNode;
  showBack?: boolean;
  onBackPress?: () => void;
  onTitlePress?: () => void;
  titleContent?: ReactNode;
  tone?: HeaderTone;
  safeArea?: boolean;
  style?: StyleProp<ViewStyle>;
  profile?: { avatar_url?: string | null; display_name?: string | null } | null;
  isGuest?: boolean;
  unreadCount?: number;
  unreadMessagesCount?: number;
  logoUri?: string;
  avatarUrl?: string | null;
  isOnline?: boolean;
}

export function AppHeader({ variant = 'sub', title, subtitle, fallbackRoute = '/home', rightAction, showBack = true, onBackPress, onTitlePress, titleContent, tone = 'light', safeArea = true, style, profile, isGuest = false, unreadCount = 0, unreadMessagesCount = 0, logoUri, avatarUrl, isOnline }: AppHeaderProps) {
  const { branding = {} } = usePlatformConfig();
  const { colors, isDark } = useTheme();
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const [failedLogo, setFailedLogo] = useState(false);
  const dark = tone === 'overlay';
  const color = dark ? OASIS.colors.surface : colors.primary;
  const headerKey = title?.includes('بحث') ? 'search' : title?.includes('سوق') ? 'market' : title?.includes('يوميات') || title?.includes('قصص') ? 'stories' : undefined;
  const displayTitle = (headerKey && branding.headers?.[headerKey]) || title || branding.name || 'حيّنا';
  const goBack = () => {
    if (onBackPress) onBackPress();
    else if (router.canGoBack()) router.back();
    else router.replace(fallbackRoute as never);
  };
  const avatar = (uri: string | null | undefined) => <View style={styles.avatarRing}>{uri && failedImage !== uri ? <Image source={{ uri }} style={styles.avatar} onError={() => setFailedImage(uri)} /> : <View style={[styles.avatar, styles.avatarFallback]}><UserRound size={20} color={OASIS.colors.primary} /></View>}</View>;
  const home = variant === 'home';
  const identity = titleContent || <>
    {home ? <View accessible accessibilityRole="image" accessibilityLabel="شعار حيّنا" style={styles.brand}>
      {failedLogo ? <Home size={28} color={color} /> : <Image accessible={false} source={{ uri: logoUri || FALLBACK_LOGO_URI }} resizeMode="contain" style={styles.logo} onError={() => setFailedLogo(true)} />}
    </View> : <View style={styles.identityRow}>
      {variant === 'chat' ? <View>{avatar(avatarUrl)}{isOnline ? <View style={styles.onlineDot} /> : null}</View> : null}
      <View style={styles.titleCopy}><Text accessibilityRole="header" numberOfLines={1} style={[styles.title, { color: colors.ink }, dark && styles.lightText]}>{displayTitle}</Text>{subtitle ? <Text numberOfLines={1} style={[styles.subtitle, { color: colors.muted }, dark && styles.lightSubtitle]}>{subtitle}</Text> : null}</View>
    </View>}
  </>;
  return <AppHeaderFrame tone={tone} safeArea={safeArea} style={style}>
    <View style={[styles.side, styles.leading]}>
      {home ? isGuest ? <HeaderAction tone={tone} accessibilityLabel="تسجيل الدخول" onPress={() => router.push('/auth')}><LogIn size={21} color={OASIS.colors.primary} /></HeaderAction> : <HeaderAction bare tone={tone} accessibilityLabel="الملف الشخصي" onPress={() => router.push('/profile')}>{avatar(profile?.avatar_url)}</HeaderAction> : showBack ? <HeaderAction tone={tone} accessibilityLabel="رجوع" onPress={goBack}><ChevronRight size={23} color={color} /></HeaderAction> : null}
    </View>
    {onTitlePress ? <Pressable accessibilityRole="button" accessibilityLabel={displayTitle} onPress={onTitlePress} style={styles.center}>{identity}</Pressable> : <View style={styles.center}>{identity}</View>}
    <View style={styles.side}>
      {home ? !isGuest ? <View style={styles.actions}>
          <HeaderAction bare style={styles.glassIcon} tone={tone} accessibilityLabel={unreadCount > 0 ? `الإشعارات، ${unreadCount} غير مقروء` : 'الإشعارات'} onPress={() => router.push('/notifications')}><Bell size={20} color={color} />{unreadCount > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text></View> : null}</HeaderAction>
          <HeaderAction bare style={styles.glassIcon} tone={tone} accessibilityLabel={unreadMessagesCount > 0 ? `الدردشة، ${unreadMessagesCount} غير مقروء` : 'الدردشة'} onPress={() => router.push('/messages')}><MessageCircle size={20} color={color} />{unreadMessagesCount > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}</Text></View> : null}</HeaderAction>
        </View> : null : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.actions, { direction: 'ltr' }]} style={[styles.actionScroll, { direction: 'rtl' }]}>{decorateHeaderActions(rightAction)}</ScrollView>}
    </View>
  </AppHeaderFrame>;
}

const styles = StyleSheet.create({
  container: { width: '100%', backgroundColor: 'transparent', borderBottomWidth: 0, borderBottomColor: 'transparent', zIndex: 20, flexShrink: 0, overflow: 'hidden' },
  overlay: { backgroundColor: 'transparent', borderBottomColor: 'transparent' },
  content: { position: 'relative', height: APP_HEADER_HEIGHT, width: '100%', maxWidth: 1100, alignSelf: 'center', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: HEADER_HORIZONTAL_PADDING, gap: 4 },
  side: { width: HEADER_SIDE_WIDTH, flexShrink: 0, alignItems: 'flex-start', justifyContent: 'center', height: HEADER_ACTION_SIZE },
  leading: { alignItems: 'flex-end' },
  center: { flex: 1, minWidth: 0, minHeight: HEADER_ACTION_SIZE, alignItems: 'center', justifyContent: 'center' },
  titleCopy: { flexShrink: 1, minWidth: 0, alignItems: 'center' },
  title: { color: OASIS.colors.ink, fontSize: 17, lineHeight: 23, fontWeight: '600', textAlign: 'center', writingDirection: 'rtl' },
  subtitle: { color: OASIS.colors.muted, fontSize: 12, lineHeight: 16, textAlign: 'center', writingDirection: 'rtl' },
  lightText: { color: OASIS.colors.surface }, lightSubtitle: { color: OASIS.colors.line },
  identityRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', minWidth: 0 },
  brand: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 7, maxWidth: '100%' },
  logo: { width: 36, height: 40, flexShrink: 0 }, avatarRing: { width: 40, height: 40, borderRadius: 20, borderWidth: 0, padding: 2, backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, avatar: { width: 32, height: 32, borderRadius: 16 }, avatarFallback: { backgroundColor: OASIS.colors.soft, alignItems: 'center', justifyContent: 'center' },
  glass: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  glassTexture: { position: 'absolute', width: 50, height: 50, top: -3, left: -3 },
  glassIcon: { backgroundColor: 'transparent', borderWidth: 0 },
  glassAction: { backgroundColor: 'transparent', borderWidth: 0, overflow: 'visible' },
  actionForeground: { position: 'relative', zIndex: 2, width: '100%', height: '100%', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 4 },
  actionScroll: { flexGrow: 0, maxWidth: HEADER_SIDE_WIDTH }, actions: { flexDirection: 'row-reverse', alignItems: 'center', gap: 0 },
  actionButton: { height: HEADER_ACTION_SIZE, minHeight: HEADER_ACTION_SIZE, minWidth: HEADER_ACTION_SIZE, paddingVertical: 0, paddingHorizontal: 8, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row-reverse', gap: 4, backgroundColor: OASIS.colors.soft, borderWidth: 1, borderColor: '#a7f3d0', flexShrink: 0 },
  bareAction: { backgroundColor: 'transparent', borderWidth: 0, paddingHorizontal: 0, borderRadius: 14 },
  overlayButton: { backgroundColor: 'rgba(15,23,42,0.35)' }, pressed: { opacity: 0.65 },
  badge: { position: 'absolute', top: 2, right: 1, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: OASIS.colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3, borderWidth: 1.5, borderColor: OASIS.colors.surface }, badgeText: { color: OASIS.colors.surface, fontSize: 11, lineHeight: 13, fontWeight: '700', textAlign: 'center', includeFontPadding: false },
  onlineDot: { width: 8, height: 8, borderRadius: 4, position: 'absolute', bottom: 0, left: 0, backgroundColor: OASIS.colors.primary, borderWidth: 1, borderColor: OASIS.colors.surface },
});
export default AppHeader;
