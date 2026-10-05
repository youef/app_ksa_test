import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, LayoutDashboard, MessageCircle, ShoppingBag } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { supabase } from '@/lib/supabase';
import { BOTTOM_NAV_HEIGHT } from '@/lib/bottomNav';

export { BOTTOM_NAV_HEIGHT };

const TABS = [
  { key: '/home', icon: Home, label: 'الرئيسية' },
  { key: '/market', icon: ShoppingBag, label: 'السوق' },
  { key: '/messages', icon: MessageCircle, label: 'الرسائل' },
];

const NESTED_ROUTES: Array<[string, string]> = [
  ['/question', '/home'],
  ['/ask', '/home'],
  ['/create-story', '/home'],
  ['/notifications', '/home'],
  ['/user', '/home'],
  ['/requests', '/home'],
  ['/service', '/market'],
  ['/new-service', '/market'],
  ['/conversation', '/messages'],
];

// Full-screen routes: the chat owns the whole viewport, the tab bar must not show.
const FULLSCREEN_ROUTES = ['/conversation'];

function normalize(pathname: string) {
  if (!pathname) return '/';
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed || '/';
}

function isTabActive(pathname: string, key: string) {
  const path = normalize(pathname);
  if (path === key || path.startsWith(`${key}/`)) return true;
  return NESTED_ROUTES.some(
    ([prefix, parent]) => parent === key && (path === prefix || path.startsWith(`${prefix}/`)),
  );
}

export default function BottomNav() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [unreadMsgs, setUnreadMsgs] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  const loadBadges = useCallback(async () => {
    try {
      const { data: auth } = await supabase.auth.getSession();
      const user = auth.session?.user;
      setHasSession(Boolean(user));
      if (!user) {
        setUnreadMsgs(0);
        return;
      }

      const { data: myConvs } = await supabase
        .from('conversation_members')
        .select('conversation_id')
        .eq('user_id', user.id);

      if (!myConvs || myConvs.length === 0) {
        setUnreadMsgs(0);
        return;
      }

      const convIds = myConvs.map((c: any) => c.conversation_id);
      const { data: lastMsgs } = await supabase
        .from('messages')
        .select('conversation_id, sender_id, read_by, created_at')
        .in('conversation_id', convIds)
        .neq('sender_id', user.id)
        .order('created_at', { ascending: false });

      const seen = new Set<string>();
      let unread = 0;
      for (const msg of lastMsgs || []) {
        if (seen.has(msg.conversation_id)) continue;
        seen.add(msg.conversation_id);
        if (!(msg.read_by || []).includes(user.id)) unread++;
      }
      setUnreadMsgs(unread);
    } catch {
      setUnreadMsgs(0);
    }
  }, []);

  const checkAdmin = useCallback(async () => {
    try {
      const { data: auth } = await supabase.auth.getSession();
      const user = auth.session?.user;
      if (!user) {
        setIsAdmin(false);
        return;
      }
      if ((user.email || '').toLowerCase().trim() === 'root@gmail.com') {
        setIsAdmin(true);
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      setIsAdmin(profile?.role === 'admin');
    } catch {
      setIsAdmin(false);
    }
  }, []);

  useEffect(() => {
    void loadBadges();
    void checkAdmin();
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(Boolean(session?.user));
      if (session?.user) {
        setTimeout(() => {
          void loadBadges();
          void checkAdmin();
        }, 0);
      } else {
        setUnreadMsgs(0);
        setIsAdmin(false);
      }
    });
    const interval = setInterval(() => {
      void loadBadges();
      void checkAdmin();
    }, 30000);
    return () => {
      clearInterval(interval);
      authListener.subscription.unsubscribe();
    };
  }, [loadBadges, checkAdmin]);

  const normalizedPath = normalize(pathname);
  if (normalizedPath === '/' || normalizedPath === '/index' || normalizedPath === '/auth') {
    return null;
  }
  if (
    FULLSCREEN_ROUTES.some(
      (route) => normalizedPath === route || normalizedPath.startsWith(`${route}/`),
    )
  ) {
    return null;
  }

  const handleTabPress = (key: string) => {
    if (normalize(pathname) === key) return;
    router.navigate(key as never);
  };

  const contentStyle = [
    styles.content,
    { paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 10 : 8) },
  ];

  return (
    <View style={styles.container} pointerEvents="box-none">
      <BlurView
        intensity={Platform.OS === 'ios' ? 85 : 100}
        tint="light"
        style={styles.surface}
      >
        <View style={contentStyle}>
          {TABS.filter(tab => hasSession || tab.key === '/home').map(tab => {
            const isActive = isTabActive(pathname, tab.key);
            const Icon = tab.icon;
            const badge = tab.key === '/messages' ? unreadMsgs : 0;

            return (
              <Pressable
                key={tab.key}
                onPress={() => handleTabPress(tab.key)}
                style={styles.tab}
                hitSlop={6}
                accessibilityRole="tab"
                accessibilityState={{ selected: isActive }}
                accessibilityLabel={tab.label}
              >
                <View style={[styles.iconWrap, isActive && styles.iconWrapActive]}>
                  <Icon
                    size={22}
                    color={isActive ? '#059669' : '#94a3b8'}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  {badge > 0 && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.label, isActive && styles.labelActive]} numberOfLines={1}>
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}

          {isAdmin && (
            <Pressable
              onPress={() => router.navigate('/admin' as never)}
              style={styles.tab}
              hitSlop={6}
              accessibilityRole="tab"
              accessibilityState={{ selected: normalize(pathname) === '/admin' }}
              accessibilityLabel="لوحة التحكم"
            >
              <View style={[styles.iconWrap, normalize(pathname) === '/admin' && styles.iconWrapActive]}>
                <LayoutDashboard
                  size={22}
                  color={normalize(pathname) === '/admin' ? '#059669' : '#94a3b8'}
                  strokeWidth={normalize(pathname) === '/admin' ? 2.5 : 2}
                />
              </View>
              <Text
                style={[styles.label, normalize(pathname) === '/admin' && styles.labelActive]}
                numberOfLines={1}
              >
                لوحة التحكم
              </Text>
            </Pressable>
          )}
        </View>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  surface: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(226, 232, 240, 0.85)',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
  },
  content: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingTop: 8,
    paddingHorizontal: 8,
    minHeight: BOTTOM_NAV_HEIGHT,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 2,
  },
  iconWrap: {
    width: 52,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: 'rgba(5, 150, 105, 0.12)',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: 6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
  },
  labelActive: {
    color: '#059669',
    fontWeight: '900',
  },
});
