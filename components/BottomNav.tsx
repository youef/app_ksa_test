import { OasisPressable as Pressable } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import { useCallback, useEffect, useState } from 'react';
import { Image, Keyboard, NativeScrollEvent, NativeSyntheticEvent, Platform, StyleSheet, View } from 'react-native';
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
  const { colors } = useTheme();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [hasSession, setHasSession] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: navTranslateY.value }],
  }));

  // إعادة إظهار الشريط عند تغيير الصفحة
  useEffect(() => {
    navTranslateY.value = withTiming(0, { duration: 150 });
    nativeLastY = 0;
  }, [pathname]);

  const refreshUnread = useCallback(async () => {
    try {
      const { data: auth } = await supabase.auth.getSession();
      const user = auth.session?.user;
      setHasSession(Boolean(user));
      if (!user) { setUnreadCount(0); return; }

      const { data: memberships } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', user.id);
      const ids = (memberships || []).map((item: { conversation_id: string }) => item.conversation_id);
      if (!ids.length) { setUnreadCount(0); return; }

      const { data: messages } = await supabase
        .from('messages')
        .select('conversation_id, sender_id, read_by')
        .in('conversation_id', ids)
        .neq('sender_id', user.id)
        .limit(100);
      const unread = (messages || []).filter((message: { read_by?: string[] | null }) => !message.read_by?.includes(user.id));
      // platform messages unread
      const { count: pmUnread } = await supabase
        .from('platform_messages')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', user.id)
        .eq('read', false);
      setUnreadCount(unread.length + (pmUnread || 0));
    } catch {
      setUnreadCount(0);
    }
  }, []);

  // الاستماع لتغيير الجلسة والرسائل الجديدة (Realtime)
  useEffect(() => {
    void refreshUnread();

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      void refreshUnread();
    });

    const channel = supabase
      .channel('bottom-nav-unread')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => {
          void refreshUnread();
        }
      )
      .subscribe();

    return () => {
      authListener.subscription.unsubscribe();
      supabase.removeChannel(channel);
    };
  }, [refreshUnread]);

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
      <View style={styles.surface}>
        <Image source={require('../public/welcome/hayna-bottom-nav-background.png')} resizeMode="cover" style={styles.navArtwork} />
        <View style={styles.heritageGlow} />
        <View style={styles.row}>
          {TABS.map((tab) => {
            const isCreate = tab.kind === 'create';
            const isActive = !isCreate && activeFor(path, tab.key);
            const Icon = tab.icon;
            return (
              <Pressable
                key={tab.key}
                accessibilityRole="button"
                accessibilityLabel={tab.label}
                accessibilityState={{ selected: isActive }}
                onPress={() => {
                  if (isCreate && !hasSession) { router.navigate('/auth' as never); return; }
                  if (normalize(pathname) !== tab.key) router.navigate(tab.key as never);
                }}
                style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
              >
                <View style={[styles.orb, !isCreate && styles.standardOrbLower, isCreate && styles.createOrb, isActive && styles.activeOrb]}>
                  <Icon size={isCreate ? 30 : 23} color={isCreate ? '#FFFFFF' : isActive ? '#047857' : '#075A43'} strokeWidth={isCreate ? 2.7 : 2.2} />
                </View>
                {isActive && <View style={styles.activeDot} />}
              </Pressable>
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  dock: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 100, backgroundColor: 'transparent', paddingHorizontal: 12, paddingTop: 14 },
  surface: { height: 88, maxWidth: 560, width: '100%', alignSelf: 'center', borderRadius: 30, backgroundColor: 'transparent', borderWidth: 0, overflow: 'visible', shadowColor: '#064E3B', shadowOpacity: 0.16, shadowRadius: 16, shadowOffset: { width: 0, height: 5 }, elevation: 10 },
  navArtwork: { position: 'absolute', left: 0, right: 0, bottom: 0, width: '100%', height: 88, borderRadius: 30 },
  heritageGlow: { ...StyleSheet.absoluteFillObject, borderRadius: 30, backgroundColor: 'transparent' },
  // Five equal hit areas remain aligned with the circular slots in the PNG.
  // Filling the artwork eliminates the vertical shift caused by visible labels.
  row: { ...StyleSheet.absoluteFillObject, direction: 'ltr', flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 6, paddingTop: 12, paddingBottom: 4 },
  tab: { flex: 1, minWidth: 0, height: '100%', alignItems: 'center', justifyContent: 'center', paddingTop: 10 },
  orb: { width: 49, height: 49, borderRadius: 25, backgroundColor: 'rgba(255,255,255,0.79)', borderWidth: 1.5, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#456A55', shadowOpacity: 0.08, shadowRadius: 5, elevation: 2 },
  // Only the four side icons move 8px lower to sit in the artwork's round slots.
  // The central Add (+) icon keeps its current position, size and styling.
  standardOrbLower: { transform: [{ translateY: 8 }] },
  activeOrb: { borderColor: '#55D8A5', borderWidth: 2.5, backgroundColor: '#F1FFF8' },
  createOrb: { width: 64, height: 64, borderRadius: 32, marginTop: -6, backgroundColor: '#006D4E', borderWidth: 5, borderColor: '#F9F4DF', shadowColor: '#006D4E', shadowOpacity: 0.3, shadowRadius: 10, elevation: 9 },
  activeDot: { position: 'absolute', bottom: 6, width: 17, height: 4, borderRadius: 3, backgroundColor: '#047857' },
  pressed: { opacity: 0.7, transform: [{ scale: 0.95 }] },
});
