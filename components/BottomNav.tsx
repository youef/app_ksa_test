import { View, Text, Pressable, StyleSheet, Platform, Dimensions } from 'react-native';
import { router, usePathname } from 'expo-router';
import { Home, MessageCircle, Map, Bell, User, LayoutDashboard, ShoppingBag } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { BlurView } from 'expo-blur';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

const { width } = Dimensions.get('window');

const TABS = [
  { key: '/home',          icon: Home,          label: 'الرئيسية' },
  { key: '/market',        icon: ShoppingBag,   label: 'السوق'    },
  { key: '/messages',      icon: MessageCircle, label: 'الرسائل'  },
];

export default function BottomNav() {
  const pathname = usePathname();
  const [unreadMsgs, setUnreadMsgs]  = useState(0);
  const [unreadNotif, setUnreadNotif] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    loadBadges();
    checkAdmin();
    // refresh every 30s
    const interval = setInterval(loadBadges, 30000);
    return () => clearInterval(interval);
  }, []);

  async function checkAdmin() {
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u?.user) {
        setIsAdmin(false);
        return;
      }
      const email = (u.user.email || '').toLowerCase().trim();
      if (email === 'root@gmail.com') {
        setIsAdmin(true);
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', u.user.id)
        .maybeSingle();
      setIsAdmin(profile?.role === 'admin');
    } catch {
      setIsAdmin(false);
    }
  }

  async function loadBadges() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;

    // Unread notifications
    const { count: nc } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', u.user.id)
      .is('read_at', null);
    setUnreadNotif(nc ?? 0);

    // Unread messages
    const { data: myConvs } = await supabase
      .from('conversation_members')
      .select('conversation_id')
      .eq('user_id', u.user.id);

    if (myConvs && myConvs.length > 0) {
      const convIds = myConvs.map((c: any) => c.conversation_id);
      const { data: lastMsgs } = await supabase
        .from('messages')
        .select('conversation_id, sender_id, read_by, created_at')
        .in('conversation_id', convIds)
        .neq('sender_id', u.user.id)
        .order('created_at', { ascending: false });

      const seenConvs = new Set<string>();
      let unread = 0;
      for (const msg of lastMsgs || []) {
        if (!seenConvs.has(msg.conversation_id)) {
          seenConvs.add(msg.conversation_id);
          if (!(msg.read_by || []).includes(u.user.id)) {
            unread++;
          }
        }
      }
      setUnreadMsgs(unread);
    }
  }

  const handleTabPress = (key: string) => {
    router.push(key as any);
  };

  return (
    <View style={styles.container}>
      <BlurView intensity={Platform.OS === 'ios' ? 85 : 100} tint="light" style={styles.blurContainer}>
        {TABS.map((tab) => {
          const isActive = pathname === tab.key;
          const IconComp = tab.icon;
          const badge = tab.key === '/messages' ? unreadMsgs
                      : tab.key === '/notifications' ? unreadNotif
                      : 0;

          return (
            <Pressable
              key={tab.key}
              style={styles.tab}
              onPress={() => handleTabPress(tab.key)}
            >
              <View style={styles.iconWrap}>
                <Animated.View style={[styles.iconInner, isActive && styles.iconInnerActive]}>
                  <IconComp
                    size={24}
                    color={isActive ? '#059669' : '#94a3b8'}
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                </Animated.View>
                {badge > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.label, isActive && styles.labelActive]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
        {isAdmin && (
          <Pressable style={styles.tab} onPress={() => router.push('/admin' as any)}>
             <View style={styles.iconWrap}>
               <Animated.View style={[styles.iconInner, pathname === '/admin' && styles.iconInnerActive]}>
                 <LayoutDashboard size={24} color={pathname === '/admin' ? '#059669' : '#94a3b8'} strokeWidth={pathname === '/admin' ? 2.5 : 2} />
               </Animated.View>
             </View>
             <Text style={[styles.label, pathname === '/admin' && styles.labelActive]}>لوحة التحكم</Text>
          </Pressable>
        )}
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: 'transparent',
    zIndex: 999,
  },
  blurContainer: {
    flexDirection: 'row-reverse',
    paddingBottom: Platform.OS === 'ios' ? 30 : 12,
    paddingTop: 10,
    paddingHorizontal: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(226, 232, 240, 0.8)',
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  iconWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 32,
  },
  iconInner: {
    width: 40,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconInnerActive: {
    backgroundColor: 'rgba(5, 150, 105, 0.1)',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: 2,
    backgroundColor: '#ef4444',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  label: {
    fontSize: 11,
    color: '#94a3b8',
    fontWeight: '600',
  },
  labelActive: {
    color: '#059669',
    fontWeight: '800',
  },
});
