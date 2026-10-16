import { useCallback, useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Compass, Plus, MessageCircle, MoreHorizontal } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { supabase } from '@/lib/supabase';
import { BOTTOM_NAV_HEIGHT } from '@/lib/bottomNav';

export { BOTTOM_NAV_HEIGHT };

const TABS = [
  { key: '/home', label: 'الرئيسية', icon: Home, kind: 'tab' },
  { key: '/search', label: 'استكشف', icon: Compass, kind: 'tab' },
  { key: '/ask', label: 'إضافة', icon: Plus, kind: 'create' },
  { key: '/messages', label: 'الدردشة', icon: MessageCircle, kind: 'tab' },
  { key: '/more', label: 'المزيد', icon: MoreHorizontal, kind: 'tab' },
] as const;

const ROUTE_PARENT: Array<[string, string]> = [
  ['/question', '/home'], ['/questions', '/home'], ['/create-story', '/home'],
  ['/story', '/home'], ['/user', '/more'], ['/settings', '/more'],
  ['/account-type', '/more'], ['/market', '/search'], ['/service', '/search'],
  ['/new-service', '/search'], ['/directory', '/search'], ['/business', '/search'],
  ['/requests', '/home'], ['/conversation', '/messages'], ['/notifications', '/more'],
];

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

  useEffect(() => {
    void refreshUnread();
    const { data: listener } = supabase.auth.onAuthStateChange(() => { void refreshUnread(); });
    return () => listener.subscription.unsubscribe();
  }, [refreshUnread]);

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
      viewport?.addEventListener('resize', syncViewport);
      viewport?.addEventListener('scroll', syncViewport);
      window.addEventListener('hayna:composer-focus', onComposerFocus);
      return () => {
        viewport?.removeEventListener('resize', syncViewport);
        viewport?.removeEventListener('scroll', syncViewport);
        window.removeEventListener('hayna:composer-focus', onComposerFocus);
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
  if (keyboardVisible || path === '/' || path === '/index' || path === '/auth' || path.startsWith('/auth/') ||
      path === '/conversation' || path.startsWith('/conversation/')) return null;

  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 8 : 7);

  return (
    <View pointerEvents="box-none" style={[styles.dock, { paddingBottom: bottomPadding }]}>
      <BlurView intensity={Platform.OS === 'ios' ? 72 : 58} tint="default" style={styles.glass}>
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
                hitSlop={4}
              >
                {isCreate ? (
                  <View style={styles.createButton}>
                    <Icon size={27} color="#ffffff" strokeWidth={2.7} />
                  </View>
                ) : (
                  <View style={[styles.iconWrap, isActive && styles.iconWrapActive]}>
                    <Icon size={21} color={isActive ? '#16865b' : '#64748b'} strokeWidth={isActive ? 2.4 : 2} />
                    {tab.key === '/messages' && unreadCount > 0 && (
                      <View style={styles.badge}><Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text></View>
                    )}
                  </View>
                )}
                <Text numberOfLines={1} style={[styles.label, isActive && styles.labelActive, isCreate && styles.createLabel]}>
                  {tab.label}
                </Text>
                {isActive && <View style={styles.activeDot} />}
              </Pressable>
            );
          })}
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 0,
    zIndex: 100,
    paddingTop: 7,
    backgroundColor: 'transparent',
  },
  glass: {
    overflow: 'hidden',
    borderRadius: 27,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    backgroundColor: 'rgba(255,255,255,0.10)',
    ...Platform.select({
      web: { backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)' } as any,
      default: {},
    }),
  },
  row: {
    minHeight: 67,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 5,
    paddingTop: 3,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    minHeight: 59,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 2,
    paddingTop: 2,
    position: 'relative',
  },
  createTab: { transform: [{ translateY: -7 }] },
  iconWrap: {
    width: 36,
    height: 32,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconWrapActive: { backgroundColor: 'rgba(22,134,91,0.12)' },
  createButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#16865b',
    borderWidth: 4,
    borderColor: 'rgba(220,252,231,0.98)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: -1,
    ...Platform.select({
      web: { boxShadow: '0px 5px 14px rgba(22,134,91,0.28)' } as any,
      default: { elevation: 7 },
    }),
  },
  label: { fontSize: 10.5, lineHeight: 14, fontWeight: '500', color: '#64748b', textAlign: 'center' },
  labelActive: { color: '#16865b', fontWeight: '700' },
  createLabel: { color: '#16865b', fontWeight: '700' },
  activeDot: { position: 'absolute', bottom: -1, width: 4, height: 4, borderRadius: 2, backgroundColor: '#16865b' },
  pressed: { opacity: 0.72, transform: [{ scale: 0.96 }] },
  badge: {
    position: 'absolute', top: -3, right: -5, minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: '#e11d48', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 3,
  },
  badgeText: { color: '#ffffff', fontSize: 9, fontWeight: '800' },
});
