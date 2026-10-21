import { useEffect, useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { Redirect, router, Stack, usePathname } from 'expo-router';
import Head from 'expo-router/head';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { DynamicIslandProvider } from '@/context/DynamicIslandContext';
import DialogProvider from '@/lib/dialog';
import { registerPushToken, syncDndWithNotifications } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/ui';
import { initLogRocket } from '@/lib/logrocket';
import BottomNav from '@/components/BottomNav';
import { PlatformConfigProvider, usePlatformConfig } from '@/lib/platformConfig';

const ACCOUNT_ONLY_ROUTES = [
  '/profile', '/settings', '/market', '/messages', '/conversation', '/search',
  '/ask', '/create-story', '/story', '/notifications',
  '/new-service', '/new-listing', '/service', '/business', '/directory', '/user', '/report', '/admin', '/support',
  '/live',
];

function needsAccount(pathname: string) {
  return ACCOUNT_ONLY_ROUTES.some(route => pathname === route || pathname.startsWith(`${route}/`));
}

export default function RootLayout() {
  return <PlatformConfigProvider><RootContent /></PlatformConfigProvider>;
}

function RootContent() {
  const pathname = usePathname();
  const { maintenance, flags, branding, ready: configReady } = usePlatformConfig();
  const [sessionReady, setSessionReady] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const protectCurrentRoute = needsAccount(pathname) && (!sessionReady || !hasSession);

  useEffect(() => {
    initLogRocket();
    void syncDndWithNotifications();

    const loadSession = async () => {
      const { data } = await supabase.auth.getSession();
      setHasSession(Boolean(data.session?.user));
      if (data.session?.user) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.session.user.id).maybeSingle();
        setIsAdmin(profile?.role === 'admin' || (data.session.user.email || '').toLowerCase() === 'root@gmail.com');
      } else setIsAdmin(false);
      setSessionReady(true);
      // Background sync: never let a denied notification permission surface
      // as an uncaught rejection (which would show the dev error overlay).
      if (data.session?.user) void registerPushToken().catch(() => {});
    };

    void loadSession();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setHasSession(Boolean(session?.user));
      if (!session?.user) setIsAdmin(false);
      else void supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle().then(({ data: profile }) => setIsAdmin(profile?.role === 'admin' || (session.user?.email || '').toLowerCase() === 'root@gmail.com'));
      setSessionReady(true);
      if (session?.user) void registerPushToken().catch(() => {});
    });

    const timer = setInterval(() => void syncDndWithNotifications(), 5 * 60_000);
    return () => {
      clearInterval(timer);
      listener.subscription.unsubscribe();
    };
  }, []);

  const path = pathname.replace(/\/+$/, '') || '/';
  const liveFullScreen = path === '/live' || path.startsWith('/live/');
  const storyFullScreen = ['/stories', '/create-story', '/story', '/story-viewers', '/story-settings'].some(route => path === route || path.startsWith(route + '/'));
  const hideBottomNav = ['/service', '/new-service', '/new-listing'].some(route => path === route || path.startsWith(route + '/'));
  const hiddenRoute = Object.entries(flags).some(([key, enabled]) => enabled === false && ({ market: ['/market', '/service', '/new-service', '/new-listing'], directory: ['/directory', '/business'], search: ['/search'], stories: ['/stories', '/story', '/create-story'], weather: ['/weather'], carpooling: ['/carpooling'], urgent_alerts: ['/emergency-alert'], questions: ['/questions', '/question'], live: ['/lives', '/live'], map: ['/map'] }[key] || []).some(route => path === route || path.startsWith(route + '/')));
  const routeBlocked = hiddenRoute && path !== '/admin';

  return (
    <>
      <Head>
        <title>{branding.name || 'حيّنا'}</title>
        <meta name="description" content={branding.description || 'منصة أهل الحي للتواصل والخدمات المحلية'} />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <style type="text/css">{`
          html, body { width: 100%; min-height: 100%; -webkit-text-size-adjust: 100%; }
          input, textarea, select { font-size: 16px !important; }
          input:focus, textarea:focus, select:focus { font-size: 16px !important; }
        `}</style>
      </Head>
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <DynamicIslandProvider>
          <DialogProvider>
            <View style={{ flex: 1 }}>
              {!configReady ? <View style={{ flex: 1, backgroundColor: C.bg }} /> : maintenance.enabled && sessionReady && !isAdmin && path !== '/auth' ? <View style={{ flex: 1, backgroundColor: '#f8fafc', alignItems: 'center', justifyContent: 'center', padding: 28 }}><Text style={{ fontSize: 42 }}>🛠️</Text><Text style={{ fontSize: 24, fontWeight: '900', color: '#0f172a', marginTop: 14 }}>نعتذر، المنصة تحت الصيانة</Text><Text style={{ fontSize: 15, color: '#64748b', textAlign: 'center', lineHeight: 25, marginTop: 10 }}>{maintenance.message || 'نعمل على تحسين تجربتكم، يرجى العودة لاحقاً.'}</Text><Pressable onPress={() => router.push('/auth')} style={{ marginTop: 24, backgroundColor: '#059669', paddingHorizontal: 22, paddingVertical: 12, borderRadius: 14 }}><Text style={{ color: '#fff', fontWeight: '800' }}>دخول المدير</Text></Pressable></View> : maintenance.enabled && isAdmin && path !== '/admin' ? <Redirect href="/admin" /> : protectCurrentRoute ? (sessionReady ? <Redirect href="/auth" /> : <View style={{ flex: 1, backgroundColor: C.bg }} />) : routeBlocked ? <Redirect href="/home" /> : (
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
              {!(maintenance.enabled && sessionReady && !isAdmin) && !liveFullScreen && !storyFullScreen && !hideBottomNav && path !== '/map' && !path.startsWith('/map/') && <BottomNav />}
            </View>
          </DialogProvider>
        </DynamicIslandProvider>
      </SafeAreaProvider>
    </>
  );
}
