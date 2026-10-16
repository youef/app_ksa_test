import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Compass, Plus, Bell, UserRound } from 'lucide-react-native';
import { BlurView } from 'expo-blur';
import { supabase } from '@/lib/supabase';
import { BOTTOM_NAV_HEIGHT } from '@/lib/bottomNav';

export { BOTTOM_NAV_HEIGHT };

const TABS = [
  { key: '/home', label: 'الرئيسية', icon: Home, kind: 'tab' },
  { key: '/search', label: 'استكشف', icon: Compass, kind: 'tab' },
  { key: '/ask', label: 'إضافة', icon: Plus, kind: 'create' },
  { key: '/notifications', label: 'الإشعارات', icon: Bell, kind: 'tab' },
  { key: '/profile', label: 'حسابي', icon: UserRound, kind: 'tab' },
] as const;

const ROUTE_PARENT: Array<[string, string]> = [
  ['/question', '/home'], ['/questions', '/home'], ['/create-story', '/home'],
  ['/story', '/home'], ['/user', '/profile'], ['/settings', '/profile'],
  ['/account-type', '/profile'], ['/market', '/search'], ['/service', '/search'],
  ['/new-service', '/search'], ['/directory', '/search'], ['/business', '/search'],
  ['/requests', '/home'], ['/conversation', '/notifications'],
];

function normalize(path: string) {
  const clean = (path || '/').replace(/\/+$/, '');
  return clean || '/';
}

function activeFor(pathname: string, key: string) {
  const path = normalize(pathname);
  if (path === key || path.startsWith(`${key}/`)) return true;
  return ROUTE_PARENT.some(([prefix, parent]) =>
    parent === key && (path === prefix || path.startsWith(`${prefix}/`)),
  );
}

export default function BottomNav() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [hasSession, setHasSession] = useState(false);
  const [unreadMsgs, setUnreadMsgs] = useState(0);

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

      if (!myConvs?.length) {
        setUnreadMsgs(0);
        return;
      }

      const convIds = myConvs.map((c: { conversation_id: string }) => c.conversation_id);
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

  useEffect(() => {
    void loadBadges();
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(Boolean(session?.user));
      if (session?.user) setTimeout(() => void loadBadges(), 0);
      else setUnreadMsgs(0);
    });
    const interval = setInterval(() => void loadBadges(), 30000);
    return () => {
      clearInterval(interval);
      authListener.subscription.unsubscribe();
    };
  }, [loadBadges]);

  const path = normalize(pathname);
  if (path === '/' || path === '/index' || path === '/auth') return null;
  // Keep immersive conversation/live experiences unobstructed.
  if (path === '/conversation' || path.startsWith('/conversation/') || path === '/live' || path.startsWith('/live/')) return null;

  const bottomPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 8 : 7);

  return (
    <View pointerEvents="box-none" style={[styles.dock, { paddingBottom: bottomPadding }]}>
      <BlurView intensity={Platform.OS === 'ios' ? 82 : 96} tint="light" style={styles.glass}>
        <View style={styles.row}>
          {TABS.map((tab) => {
            const isCreate = tab.kind === 'create';
            const isActive = !isCreate && activeFor(path, tab.key);
            const Icon = tab.icon;
            const badge = tab.key === '/notifications' ? unreadMsgs : 0;
            return (
              <Pressable
                key={tab.key}
                accessibilityRole="button"
                accessibilityLabel={tab.label}
                accessibilityState={{ selected: isActive }}
                onPress={() => {
                  if (isCreate && !hasSession) {
                    router.navigate('/auth' as never);
                    return;
                  }
                  if (path !== tab.key) router.navigate(tab.key as never);
                }}
                style={({ pressed }) => [
                  styles.tab,
                  isCreate && styles.createTab,
                  pressed && styles.pressed,
                ]}
                hitSlop={4}
              >
                {isCreate ? (
                  <View style={styles.createButton}>
                    <View style={styles.createInner}>
                      <Icon size={27} color="#ffffff" strokeWidth={2.7} />
                    </View>
                  </View>
                ) : (
                  <View style={[styles.iconHalo, isActive && styles.iconHaloActive]}>
                    <Icon size={22} color={isActive ? '#087f5b' : '#7b8794'} strokeWidth={isActive ? 2.5 : 2} />
                    {badge > 0 && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
                      </View>
                    )}
                    {isActive && <View style={styles.activeDot} />}
                  </View>
                )}
                <Text numberOfLines={1} style={[styles.label, isActive && styles.labelActive, isCreate && styles.createLabel]}>
                  {tab.label}
                </Text>
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
    width: '100%',
    paddingHorizontal: 12,
    paddingTop: 5,
    backgroundColor: 'transparent',
  },
  glass: {
    overflow: 'visible',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.95)',
    backgroundColor: 'rgba(255,255,255,0.90)',
    shadowColor: '#123c32',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.09,
    shadowRadius: 18,
    elevation: 14,
  },
  row: {
    minHeight: 68,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 5,
    paddingTop: 5,
    paddingBottom: 3,
  },
  tab: {
    flex: 1,
    minWidth: 0,
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderRadius: 18,
    paddingHorizontal: 1,
    paddingVertical: 2,
  },
  createTab: { marginTop: -18 },
  pressed: { opacity: 0.76, transform: [{ scale: 0.97 }] },
  iconHalo: {
    width: 42,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  iconHaloActive: { backgroundColor: 'rgba(8,127,91,0.11)' },
  activeDot: {
    position: 'absolute',
    bottom: -5,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#087f5b',
  },
  createButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    padding: 4,
    backgroundColor: '#e2f4eb',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#087f5b',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.23,
    shadowRadius: 9,
    elevation: 8,
  },
  createInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#087f5b',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  label: { fontSize: 10.5, lineHeight: 15, fontWeight: '700', color: '#84909c', textAlign: 'center' },
  labelActive: { color: '#087f5b', fontWeight: '900' },
  createLabel: { color: '#087f5b', fontWeight: '900', marginTop: -1 },
  badge: {
    position: 'absolute',
    top: -3,
    right: 1,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: '#e5484d',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },
});
