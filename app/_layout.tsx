import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { Redirect, Stack, usePathname } from 'expo-router';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { DynamicIslandProvider } from '@/context/DynamicIslandContext';
import DialogProvider from '@/lib/dialog';
import { registerPushToken, syncDndWithNotifications } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/ui';
import BottomNav from '@/components/BottomNav';

const ACCOUNT_ONLY_ROUTES = [
  '/profile', '/settings', '/market', '/messages', '/conversation', '/search',
  '/ask', '/create-story', '/story', '/notifications', '/new-request',
  '/new-service', '/service', '/business', '/directory', '/user', '/report', '/admin',
];

function needsAccount(pathname: string) {
  return ACCOUNT_ONLY_ROUTES.some(route => pathname === route || pathname.startsWith(`${route}/`));
}

export default function RootLayout() {
  const pathname = usePathname();
  const [sessionReady, setSessionReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const protectCurrentRoute = needsAccount(pathname) && (!sessionReady || !hasSession);

  useEffect(() => {
    void syncDndWithNotifications();

    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      setHasSession(Boolean(data.session?.user));
      setSessionReady(true);
      if (data.session?.user) void registerPushToken();
    };

    void loadSession();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(Boolean(session?.user));
      setSessionReady(true);
      if (session?.user) void registerPushToken();
    });

    const timer = setInterval(() => void syncDndWithNotifications(), 5 * 60_000);
    return () => {
      clearInterval(timer);
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <DynamicIslandProvider>
        <DialogProvider>
          <View style={{ flex: 1 }}>
            {protectCurrentRoute ? (sessionReady ? <Redirect href="/auth" /> : <View style={{ flex: 1, backgroundColor: C.bg }} />) : (
              <Stack
                screenOptions={{
                  headerShown: false,
                  // Native gets a short slide; web swaps screens without a blank animation frame.
                  animation: Platform.OS === 'web' ? 'none' : 'slide_from_right',
                  animationDuration: Platform.OS === 'web' ? 0 : 180,
                  contentStyle: { backgroundColor: C.bg, flex: 1 },
                  freezeOnBlur: false,
                  gestureEnabled: true,
                }}
              />
            )}
            <BottomNav />
          </View>
        </DialogProvider>
      </DynamicIslandProvider>
    </SafeAreaProvider>
  );
}
