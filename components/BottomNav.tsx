import { OasisPressable as Pressable } from '@/components/oasis/OasisPrimitives';
import { useEffect, useState } from 'react';
import { DeviceEventEmitter, Keyboard, NativeScrollEvent, NativeSyntheticEvent, Platform, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Compass, Plus, Store, MoreHorizontal } from 'lucide-react-native';
import Animated, { makeMutable, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';
import { BOTTOM_NAV_HEIGHT } from '@/lib/bottomNav';
import { useTheme } from '@/context/ThemeContext';

export { BOTTOM_NAV_HEIGHT };

const TABS = [
  { key: '/home', label: 'الرئيسية', icon: Home, kind: 'tab' },
  { key: '/search', label: 'استكشف', icon: Compass, kind: 'tab' },
  { key: '/ask', label: 'إضافة', icon: Plus, kind: 'create' },
  { key: '/market', label: 'السوق', icon: Store, kind: 'tab' },
  { key: '/more', label: 'المزيد', icon: MoreHorizontal, kind: 'tab' },
] as const;

const ROUTE_PARENT: Array<[string, string]> = [
  ['/question', '/home'], ['/questions', '/home'], ['/create-story', '/home'],
  ['/story', '/home'], ['/user', '/more'], ['/settings', '/profile'],
  ['/account-type', '/profile'], ['/profile-customization', '/profile'], ['/market', '/market'], ['/service', '/market'],
  ['/new-service', '/profile'], ['/new-listing', '/profile'], ['/directory', '/search'], ['/business', '/search'],
  ['/requests', '/home'], ['/conversation', '/messages'], ['/notifications', '/more'],
];

// المسارات التي يجب إخفاء شريط التنقل فيها بالكامل
const HIDDEN_PREFIXES = ['/auth', '/questions', '/question', '/conversation', '/ask'];
const HIDDEN_EXACT = ['/', '/index'];

// ───────── منطق إخفاء/إظهار الشريط عند السكرول ─────────
const HIDE_OFFSET = 180;     // مسافة الإخفاء
const HIDE_AFTER_Y = 60;     // لا يختفي قبل هذا الموضع
const MIN_DELTA = 8;         // تجاهل الحركات الصغيرة

// قيمة مشتركة (خارج المكوّن) حتى يستطيع أي ScrollView التحكم بها
const navTranslateY = makeMutable(0);

function setNavHidden(hidden: boolean) {
  navTranslateY.value = withTiming(hidden ? HIDE_OFFSET : 0, { duration: 200 });
}

function resolveHidden(y: number, lastY: number): boolean | null {
  const delta = y - lastY;
  if (Math.abs(delta) < MIN_DELTA) return null; // لا تغيير
  if (y <= HIDE_AFTER_Y) return false;
  return delta > 0;
}

// للجوال (iOS/Android): مرّره إلى onScroll في أي ScrollView / FlatList
// مثال: <FlatList onScroll={onNavScroll} scrollEventThrottle={16} />
let nativeLastY = 0;
export function onNavScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
  const y = Math.max(0, e.nativeEvent.contentOffset.y);
  const hidden = resolveHidden(y, nativeLastY);
  if (hidden !== null) {
    setNavHidden(hidden);
    nativeLastY = y;
  }
}

function normalize(path: string) {
  const clean = (path || '/').replace(/\/+$/, '');
  return clean || '/';
}

function activeFor(pathname: string, key: string) {
  const path = normalize(pathname);
  if (path === key || path.startsWith(`${key}/`)) return true;
  return ROUTE_PARENT.some(([prefix, parent]) => parent === key && (path === prefix || path.startsWith(`${prefix}/`)));
}

export default function BottomNav() {
  const { colors, isDark } = useTheme();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [hasSession, setHasSession] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: navTranslateY.value }],
  }));

  // إعادة إظهار الشريط عند تغيير الصفحة
  useEffect(() => {
    navTranslateY.value = withTiming(0, { duration: 150 });
    nativeLastY = 0;
  }, [pathname]);

  // Keep only the auth state needed to protect the compose button.
  // Unread messages belong to the messaging UI, not this navigation component:
  // the previous subscription performed costly queries without displaying a badge.
  useEffect(() => {
    let mounted = true;
    void supabase.auth.getSession()
      .then(({ data }) => { if (mounted) setHasSession(Boolean(data.session?.user)); })
      .catch(() => { if (mounted) setHasSession(false); });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) setHasSession(Boolean(session?.user));
    });
    return () => { mounted = false; authListener.subscription.unsubscribe(); };
  }, []);

  // الكيبورد + السكرول (ويب)
  useEffect(() => {
    if (Platform.OS === 'web') {
      const viewport = typeof window !== 'undefined' ? window.visualViewport : null;
      const syncViewport = () => {
        if (!viewport || typeof window === 'undefined') return;
        setKeyboardVisible(window.innerHeight - viewport.height - viewport.offsetTop > 120);
      };
      const onComposerFocus = (event: Event) => {
        const focused = Boolean((event as CustomEvent<{ focused?: boolean }>).detail?.focused);
        setKeyboardVisible(focused);
      };

      // في React Native Web كل ScrollView له عنصر div خاص به، وحدث scroll لا يصعد (bubble)،
      // لذلك نستمع في مرحلة capture على window ونتتبع كل عنصر على حدة.
      const lastPositions = new WeakMap<object, number>();
      const onAnyScroll = (event: Event) => {
        const target = event.target as any;
        const isDoc = target === document || target === document.documentElement || target === document.body;
        const y = Math.max(0, isDoc ? window.scrollY || window.pageYOffset || 0 : target?.scrollTop ?? 0);
        const key = (isDoc ? window : target) as object;
        const last = lastPositions.get(key) ?? 0;
        const hidden = resolveHidden(y, last);
        if (hidden !== null) {
          setNavHidden(hidden);
          lastPositions.set(key, y);
        }
      };

      viewport?.addEventListener('resize', syncViewport);
      viewport?.addEventListener('scroll', syncViewport);
      window.addEventListener('hayna:composer-focus', onComposerFocus);
      window.addEventListener('scroll', onAnyScroll, { passive: true, capture: true });

      return () => {
        viewport?.removeEventListener('resize', syncViewport);
        viewport?.removeEventListener('scroll', syncViewport);
        window.removeEventListener('hayna:composer-focus', onComposerFocus);
        window.removeEventListener('scroll', onAnyScroll, true);
      };
    }

    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const path = normalize(pathname);
  const isHiddenRoute = HIDDEN_EXACT.includes(path) || HIDDEN_PREFIXES.some(prefix => path.startsWith(prefix));

  if (keyboardVisible || isHiddenRoute) return null;

  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 8 : 7);

  return (
    <Animated.View pointerEvents="box-none" style={[styles.dock, { paddingBottom: bottomPadding }, animatedStyle]}>
      <View style={[styles.surface, { backgroundColor: isDark ? 'rgba(20,36,29,.76)' : 'rgba(255,255,255,.76)', borderColor: isDark ? 'rgba(180,218,197,.2)' : 'rgba(255,255,255,.92)' }]}>
        <BlurView intensity={80} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFillObject} />
        <LinearGradient pointerEvents="none" colors={isDark ? ['rgba(196,238,215,.12)', 'rgba(10,30,20,.08)'] : ['rgba(255,255,255,.68)', 'rgba(232,246,237,.24)']} style={StyleSheet.absoluteFillObject} />
        <View pointerEvents="none" style={[styles.glassHighlight, { backgroundColor: isDark ? 'rgba(213,246,227,.22)' : '#FFFFFF' }]} />
        <View style={styles.row}>
          {TABS.map((tab) => {
            const isCreate = tab.kind === 'create';
            const isActive = !isCreate && activeFor(path, tab.key);
            const Icon = tab.icon;
            return (
              <Pressable
                oasisKind="plain"
                key={tab.key}
                accessibilityRole="button"
                accessibilityLabel={tab.label}
                accessibilityHint={isCreate ? 'إنشاء منشور جديد' : isActive && tab.key === '/home' ? 'اضغط للعودة إلى أعلى الصفحة' : undefined}
                accessibilityState={{ selected: isActive }}
                onPress={() => {
                  if (isCreate && !hasSession) { router.navigate('/auth' as never); return; }
                  if (isActive && tab.key === '/home') { setNavHidden(false); DeviceEventEmitter.emit('hayna:home-scroll-top'); return; }
                  if (normalize(pathname) !== tab.key) router.navigate(tab.key as never);
                }}
                style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
              >
                <View style={[styles.iconWrap, { backgroundColor: isDark ? 'rgba(198,230,213,.06)' : 'rgba(4,120,87,.04)' }, isActive && { backgroundColor: isDark ? 'rgba(52,211,153,.16)' : 'rgba(4,120,87,.1)' }, isCreate && styles.createIcon]}>
                  <Icon size={isCreate ? 21 : 20} color={isCreate ? '#FFFFFF' : isActive ? colors.primary : colors.muted} strokeWidth={isActive || isCreate ? 2.3 : 1.8} />
                </View>
                <Text numberOfLines={1} style={[styles.label, { color: isActive ? colors.primary : colors.muted }, isActive && styles.activeLabel]}>{tab.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 100, backgroundColor: 'transparent', paddingHorizontal: 12, paddingTop: 8 },
  surface: { height: BOTTOM_NAV_HEIGHT - 8, maxWidth: 560, width: '100%', alignSelf: 'center', borderRadius: 999, borderWidth: 1, overflow: 'hidden', shadowColor: '#173F30', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.14, shadowRadius: 18, elevation: 6 },
  glassHighlight: { position: 'absolute', top: 0, right: 22, left: 22, height: 1 },
  row: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 4 },
  tab: { flex: 1, minWidth: 0, minHeight: 44, height: '100%', alignItems: 'center', justifyContent: 'center', gap: 3 },
  iconWrap: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  createIcon: { backgroundColor: '#047857', width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,.45)', shadowColor: '#047857', shadowOffset: { width: 0, height: 3 }, shadowOpacity: .18, shadowRadius: 6 },
  label: { fontSize: 10, lineHeight: 14, fontWeight: '500' },
  activeLabel: { fontWeight: '700' },
  pressed: { opacity: 0.7, transform: [{ scale: 0.95 }] },
});
