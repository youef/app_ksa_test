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
  { key: '/notifications', icon: Bell,          label: 'النشاط'   },
  { key: '/profile',       icon: User,          label: 'حسابي'    },
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
    const { data: u } = await supabase.auth.getUser();
    if (u?.user?.email === 'root@gmail.com') {
      setIsAdmin(true);
      return;
    }
    if (u?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', u.user.id)
        .single();
      if (profile?.role === 'admin') setIsAdmin(true);
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
        {TABS.map((tab, index) => {
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
                    size={26}
                    color={isActive ? '#007AFF' : '#8E8E93'}
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
                 <LayoutDashboard size={26} color={pathname === '/admin' ? '#007AFF' : '#8E8E93'} strokeWidth={pathname === '/admin' ? 2.5 : 2} />
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
  },
  blurContainer: {
    flexDirection: 'row-reverse',
    paddingBottom: Platform.OS === 'ios' ? 32 : 12,
    paddingTop: 12,
    paddingHorizontal: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  iconWrap: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 36,
  },
  iconInner: {
    width: 44,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconInnerActive: {
    // Optionally add a subtle background for active tab like iOS 18 tab bar
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -2,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  label: {
    fontSize: 10,
    color: '#8E8E93',
    fontWeight: '500',
    marginTop: 2,
  },
  labelActive: {
    color: '#007AFF',
    fontWeight: '600',
  },
});
