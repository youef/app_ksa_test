import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { router, usePathname } from 'expo-router';
import { Home, MessageCircle, Search, Bell, User } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const TABS = [
  { key: '/home',          icon: Home,          label: 'الرئيسية' },
  { key: '/messages',      icon: MessageCircle, label: 'الرسائل'  },
  { key: '/notifications', icon: Bell,          label: 'الإشعارات'},
];

export default function BottomNav() {
  const pathname = usePathname();
  const [unreadMsgs, setUnreadMsgs]  = useState(0);
  const [unreadNotif, setUnreadNotif] = useState(0);

  useEffect(() => {
    loadBadges();
    // refresh every 30s
    const interval = setInterval(loadBadges, 30000);
    return () => clearInterval(interval);
  }, []);

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

    // Unread messages (conversations where last msg is not mine and not in read_by)
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

      // Count convs with unread messages (last msg in conv is unread)
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

  return (
    <View style={styles.container}>
      {TABS.map(tab => {
        const isActive = pathname === tab.key;
        const IconComp = tab.icon;
        const badge = tab.key === '/messages' ? unreadMsgs
                    : tab.key === '/notifications' ? unreadNotif
                    : 0;
        return (
          <Pressable
            key={tab.key}
            style={styles.tab}
            onPress={() => router.push(tab.key as any)}
          >
            <View style={[styles.iconWrap, isActive && styles.iconWrapActive]}>
              <IconComp
                size={24}
                color={isActive ? '#0891b2' : '#9ca3af'}
                strokeWidth={isActive ? 2.5 : 1.8}
              />
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row-reverse',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 10,
    paddingHorizontal: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 10,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  iconWrap: {
    position: 'relative',
    width: 48,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  iconWrapActive: {
    backgroundColor: '#e0f2fe',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: 4,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
  },
  label: {
    fontSize: 11,
    color: '#9ca3af',
    fontWeight: '600',
  },
  labelActive: {
    color: '#0891b2',
    fontWeight: '800',
  },
});
