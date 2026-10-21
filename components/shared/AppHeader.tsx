import React, { useState, type ReactNode } from 'react';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronRight, Bell, MessageCircle, LogIn, UserRound, Home } from 'lucide-react-native';
import { FALLBACK_LOGO_URI } from '@/lib/branding';
import { usePlatformConfig } from '@/lib/platformConfig';

export const APP_HEADER_HEIGHT = 56;
export const HEADER_ACTION_SIZE = 44;
export const HEADER_HORIZONTAL_PADDING = 16;
export const HEADER_SIDE_WIDTH = 88;
export type HeaderTone = 'light' | 'overlay';

export function headerTopInset(top: number) {
  return Math.max(top, Platform.OS === 'ios' ? 44 : Platform.OS === 'android' ? 24 : 0);
}
export function useAppHeaderHeight() {
  return APP_HEADER_HEIGHT + headerTopInset(useSafeAreaInsets().top) + 1;
}

/** Shared geometry for page headers and immersive media toolbars. */
export function AppHeaderFrame({ children, tone = 'light', safeArea = true, style }: { children: ReactNode; tone?: HeaderTone; safeArea?: boolean; style?: StyleProp<ViewStyle> }) {
  const insets = useSafeAreaInsets();
  return <View testID="app-header" style={[styles.container, tone === 'overlay' && styles.overlay, { paddingTop: safeArea ? headerTopInset(insets.top) : 0 }, style]}>
    <View testID="app-header-content" style={styles.content}>{children}</View>
  </View>;
}

function actionContent(children: ReactNode, color: string): ReactNode {
  return React.Children.map(children, child => {
    if (!React.isValidElement(child)) return child;
    const element = child as React.ReactElement<{ color?: string; style?: unknown; children?: ReactNode; numberOfLines?: number }>;
    if (element.type === Text) return React.cloneElement(element, { style: [element.props.style, { color, fontSize: 12, lineHeight: 18 }] as never, numberOfLines: 1 });
    if (element.props.color !== undefined) return React.cloneElement(element, { color });
    if (element.props.children) return React.cloneElement(element, {}, actionContent(element.props.children, color));
    return child;
  });
}
export function HeaderAction({ children, style, tone = 'light', ...props }: PressableProps & { children: ReactNode; tone?: HeaderTone }) {
  return <Pressable {...props} accessibilityRole="button" hitSlop={0} style={state => [typeof style === 'function' ? style(state) : style, styles.actionButton, tone === 'overlay' && styles.overlayButton, (state.pressed || props.disabled) && styles.pressed]}>{actionContent(children, tone === 'overlay' ? '#ffffff' : '#047857')}</Pressable>;
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
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const [failedLogo, setFailedLogo] = useState(false);
  const dark = tone === 'overlay';
  const color = dark ? '#ffffff' : '#334155';
  const headerKey = title?.includes('بحث') ? 'search' : title?.includes('سوق') ? 'market' : title?.includes('يوميات') || title?.includes('قصص') ? 'stories' : undefined;
  const displayTitle = (headerKey && branding.headers?.[headerKey]) || title || branding.name || 'حيّنا';
  const goBack = () => {
    if (onBackPress) onBackPress();
    else if (router.canGoBack()) router.back();
    else router.replace(fallbackRoute as never);
  };
  const avatar = (uri: string | null | undefined) => uri && failedImage !== uri ? <Image source={{ uri }} style={styles.avatar} onError={() => setFailedImage(uri)} /> : <View style={[styles.avatar, styles.avatarFallback]}><UserRound size={20} color="#047857" /></View>;
  const home = variant === 'home';
  const identity = titleContent || <>
    {home ? <View style={styles.brand}>
      {failedLogo ? <Home size={22} color="#047857" /> : <Image source={{ uri: logoUri || FALLBACK_LOGO_URI }} style={styles.logo} onError={() => setFailedLogo(true)} />}
      <Text numberOfLines={1} style={[styles.title, dark && styles.lightText]}>حيّنا</Text>
    </View> : <View style={styles.identityRow}>
      {variant === 'chat' ? <View>{avatar(avatarUrl)}{isOnline ? <View style={styles.onlineDot} /> : null}</View> : null}
      <View style={styles.titleCopy}><Text accessibilityRole="header" numberOfLines={1} style={[styles.title, dark && styles.lightText]}>{displayTitle}</Text>{subtitle ? <Text numberOfLines={1} style={[styles.subtitle, dark && styles.lightSubtitle]}>{subtitle}</Text> : null}</View>
    </View>}
  </>;
  return <AppHeaderFrame tone={tone} safeArea={safeArea} style={style}>
    <View style={[styles.side, styles.leading]}>
      {home ? isGuest ? <HeaderAction tone={tone} accessibilityLabel="تسجيل الدخول" onPress={() => router.push('/auth')}><LogIn size={21} color="#047857" /></HeaderAction> : <HeaderAction tone={tone} accessibilityLabel="الملف الشخصي" onPress={() => router.push('/profile')}>{avatar(profile?.avatar_url)}</HeaderAction> : showBack ? <HeaderAction tone={tone} accessibilityLabel="رجوع" onPress={goBack}><ChevronRight size={23} color={color} /></HeaderAction> : null}
    </View>
    {onTitlePress ? <Pressable accessibilityRole="button" accessibilityLabel={displayTitle} onPress={onTitlePress} style={styles.center}>{identity}</Pressable> : <View style={styles.center}>{identity}</View>}
    <View style={styles.side}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.actions} style={styles.actionScroll}>
        {home ? !isGuest ? <>
          <HeaderAction tone={tone} accessibilityLabel="الإشعارات" onPress={() => router.push('/notifications')}><Bell size={20} color={color} />{unreadCount > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text></View> : null}</HeaderAction>
          <HeaderAction tone={tone} accessibilityLabel="الدردشة" onPress={() => router.push('/messages')}><MessageCircle size={20} color="#16865b" />{unreadMessagesCount > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{unreadMessagesCount > 99 ? "99+" : unreadMessagesCount}</Text></View> : null}</HeaderAction>
        </> : null : rightAction}
      </ScrollView>
    </View>
  </AppHeaderFrame>;
}

const styles = StyleSheet.create({
  container: { width: '100%', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e8eeeb', zIndex: 20, flexShrink: 0 },
  overlay: { backgroundColor: 'transparent', borderBottomColor: 'transparent' },
  content: { height: APP_HEADER_HEIGHT, width: '100%', maxWidth: 1100, alignSelf: 'center', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: HEADER_HORIZONTAL_PADDING, gap: 4 },
  side: { width: HEADER_SIDE_WIDTH, flexShrink: 0, alignItems: 'flex-start', justifyContent: 'center', height: HEADER_ACTION_SIZE },
  leading: { alignItems: 'flex-end' },
  center: { flex: 1, minWidth: 0, minHeight: HEADER_ACTION_SIZE, alignItems: 'center', justifyContent: 'center' },
  titleCopy: { flexShrink: 1, minWidth: 0, alignItems: 'center' },
  title: { color: '#0f172a', fontSize: 16, lineHeight: 21, fontWeight: '800', textAlign: 'center', writingDirection: 'rtl' },
  subtitle: { color: '#64748b', fontSize: 11, lineHeight: 16, textAlign: 'center', writingDirection: 'rtl' },
  lightText: { color: '#fff' }, lightSubtitle: { color: '#e2e8f0' },
  identityRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', minWidth: 0 },
  brand: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6 },
  logo: { width: 28, height: 28, borderRadius: 8 }, avatar: { width: 32, height: 32, borderRadius: 16 }, avatarFallback: { backgroundColor: '#ecfdf5', alignItems: 'center', justifyContent: 'center' },
  actionScroll: { flexGrow: 0, maxWidth: HEADER_SIDE_WIDTH }, actions: { flexDirection: 'row-reverse', alignItems: 'center' },
  actionButton: { height: HEADER_ACTION_SIZE, minHeight: HEADER_ACTION_SIZE, minWidth: HEADER_ACTION_SIZE, paddingVertical: 0, paddingHorizontal: 8, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row-reverse', gap: 4, backgroundColor: '#f1f7f3', borderWidth: 0, flexShrink: 0 },
  overlayButton: { backgroundColor: 'rgba(15,23,42,0.35)' }, pressed: { opacity: 0.65 },
  badge: { position: 'absolute', top: 2, right: 2, minWidth: 15, height: 15, borderRadius: 8, backgroundColor: '#16834A', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }, badgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  onlineDot: { width: 8, height: 8, borderRadius: 4, position: 'absolute', bottom: 0, left: 0, backgroundColor: '#10b981', borderWidth: 1, borderColor: '#fff' },
});
export default AppHeader;
