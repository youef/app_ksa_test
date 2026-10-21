import { useCallback, useEffect, useState } from 'react';
import {
  Keyboard,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Compass, Plus, Store, MoreHorizontal } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import Animated, { makeMutable, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';
import { BOTTOM_NAV_HEIGHT } from '@/lib/bottomNav';

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
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [hasSession, setHasSession] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [barWidth, setBarWidth] = useState(0);

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
      setUnreadCount(unread.length);
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

  const center = barWidth / 2;
  // A real transparent cradle: the screen remains visible around the raised button.
  const cradlePath = `M 28 0 H ${center - 40} C ${center - 32} 0 ${center - 34} 36 ${center} 36 C ${center + 34} 36 ${center + 32} 0 ${center + 40} 0 H ${barWidth - 28} Q ${barWidth} 0 ${barWidth} 28 V 42 Q ${barWidth} 70 ${barWidth - 28} 70 H 28 Q 0 70 0 42 V 28 Q 0 0 28 0 Z`;

  return (
    <Animated.View pointerEvents="box-none" style={[styles.dock, { paddingBottom: bottomPadding }, animatedStyle]}>
      <View style={styles.surface} onLayout={event => setBarWidth(event.nativeEvent.layout.width)}>
        {barWidth > 0 && (
          <Svg pointerEvents="none" accessible={false} width={barWidth} height={70} style={styles.background}>
            <Path d={cradlePath} fill="#ffffff" />
          </Svg>
        )}
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
                style={({ pressed }) => [styles.tab, isCreate && styles.createTab, pressed && styles.pressed]}
              >
                {isCreate ? (
                  <View style={styles.createButton}>
                    <Icon size={27} color="#ffffff" strokeWidth={2.7} />
                  </View>
                ) : (
                  <View style={styles.iconWrap}>
                    <Icon size={21} color={isActive ? '#047857' : '#64748b'} strokeWidth={isActive ? 2.4 : 2} />

                  </View>
                )}
                {!isCreate && (
                  <Text numberOfLines={1} style={[styles.label, isActive && styles.labelActive]}>
                    {tab.label}
                  </Text>
                )}
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
  dock: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 0,
    zIndex: 100,
    paddingTop: 0,
    backgroundColor: 'transparent',
  },
  surface: {
    height: 98,
    overflow: 'visible',
    ...Platform.select({
      ios: { shadowColor: '#064e3b', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.10, shadowRadius: 12 },
      web: { filter: 'drop-shadow(0px 5px 12px rgba(6,78,59,0.10))' } as any,
      default: {},
    }),
  },
  background: { position: 'absolute', top: 28, left: 0 },
  row: {
    height: 98,
    paddingTop: 28,
    // Keep the Arabic order identical with or without native RTL enabled.
    direction: 'ltr',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 1,
    position: 'relative',
  },
  createTab: { transform: [{ translateY: -30 }] },
  iconWrap: {
    width: 34,
    height: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#047857',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: { shadowColor: '#047857', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.20, shadowRadius: 7 },
      android: { elevation: 5 },
      web: { boxShadow: '0px 4px 14px rgba(4,120,87,0.20)' } as any,
    }),
  },
  label: { fontSize: 11, lineHeight: 15, fontWeight: '500', color: '#64748b', textAlign: 'center', writingDirection: 'rtl' },
  labelActive: { color: '#047857', fontWeight: '600' },
  activeDot: { position: 'absolute', bottom: 0, width: 4, height: 4, borderRadius: 2, backgroundColor: '#047857' },
  // Opacity keeps the raised create button in place while it is pressed.
  pressed: { opacity: 0.65 },
});

