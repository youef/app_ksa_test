import { OasisPressable as Pressable } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Platform, Text, View } from 'react-native';
import { Redirect, router, Stack, usePathname } from 'expo-router';
import Head from 'expo-router/head';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { DynamicIslandProvider } from '@/context/DynamicIslandContext';
import { ThemeProvider, useTheme } from '@/context/ThemeContext';
import DialogProvider from '@/lib/dialog';
import { registerPushToken, syncDndWithNotifications } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { C } from '@/lib/ui';
import { initLogRocket } from '@/lib/logrocket';
import BottomNav from '@/components/BottomNav';
import { PlatformConfigProvider, usePlatformConfig } from '@/lib/platformConfig';
import { installDarkModeWebFixes } from '@/lib/darkModeWeb';

const ACCOUNT_ONLY_ROUTES = [
  '/profile', '/settings', '/market', '/messages', '/conversation', '/search',
  '/ask', '/create-story', '/story', '/stories', '/story-settings', '/story-viewers', '/notifications',
  '/new-service', '/new-listing', '/service', '/business', '/directory', '/user', '/report', '/admin', '/support',
  '/live',
];

function needsAccount(pathname: string) {
  return ACCOUNT_ONLY_ROUTES.some(route => pathname === route || pathname.startsWith(`${route}/`));
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <PlatformConfigProvider><RootContent /></PlatformConfigProvider>
    </ThemeProvider>
  );
}

function PendingScreen() {
  const { colors } = useTheme();
  return <View accessibilityRole="progressbar" accessibilityLabel="جارٍ تجهيز حيّنا" style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.background }}>
    <Image source={require('../public/brand/HAYNA_LOGO.png')} resizeMode="contain" style={{ width: 56, height: 56 }} />
    <ActivityIndicator size="small" color={colors.primary} />
    <Text style={{ fontSize: 13, color: colors.muted }}>جارٍ تجهيز حيّنا…</Text>
  </View>;
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

  const { colors, isDark } = useTheme();
  const path = pathname.replace(/\/+$/, '') || '/';
  const liveFullScreen = path === '/live' || path.startsWith('/live/');
  const storyFullScreen = ['/stories', '/create-story', '/story', '/story-viewers', '/story-settings'].some(route => path === route || path.startsWith(route + '/'));
  const hideBottomNav = ['/ask', '/service', '/new-service', '/new-listing', '/admin', '/admin-pro', '/admin-support', '/admin-marketplace'].some(route => path === route || path.startsWith(route + '/'));
  const hiddenRoute = Object.entries(flags).some(([key, enabled]) => enabled === false && ({ market: ['/market', '/service', '/new-service', '/new-listing'], directory: ['/directory', '/business'], search: ['/search'], stories: ['/stories', '/story', '/create-story'], weather: ['/weather'], carpooling: ['/carpooling'], urgent_alerts: ['/emergency-alert'], questions: ['/questions', '/question'], live: ['/lives', '/live'], map: ['/map'] }[key] || []).some(route => path === route || path.startsWith(route + '/')));
  const routeBlocked = hiddenRoute && path !== '/admin';

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    if (!isDark) {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
      document.documentElement.style.colorScheme = 'light';
      document.body.style.backgroundColor = '#F2F2F7';
      return;
    }
    return installDarkModeWebFixes();
  }, [isDark]);

  return (
    <>
      <Head>
        <title>{branding.name || 'حيّنا'}</title>
        <meta name="description" content={branding.description || 'منصة أهل الحي للتواصل والخدمات المحلية'} />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <style type="text/css">{`
          html, body { width: 100%; min-height: 100%; -webkit-text-size-adjust: 100%; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
          body, #root, #root * { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
          html, body, #root { background-color: ${isDark ? '#0F0F10' : '#F2F2F7'}; color: ${isDark ? '#FFFFFF' : '#1C1C1E'}; transition: background-color 0.25s, color 0.25s; }
          #root { isolation: isolate; }
          input, textarea, select { font-size: 16px !important; color-scheme: ${isDark ? 'dark' : 'light'}; }
          input:focus, textarea:focus, select:focus { font-size: 16px !important; }
          input, textarea { caret-color: ${isDark ? '#34D399' : '#047857'}; }
          [role="button"]:focus-visible, [role="tab"]:focus-visible { outline: 2px solid ${isDark ? '#34D399' : '#047857'}; outline-offset: 3px; }
          ::selection { background: ${isDark ? '#0D2419' : '#BBD9C3'}; color: ${isDark ? '#34D399' : '#064E3B'}; }
          ::-webkit-scrollbar { width: 6px; height: 6px; }
          ::-webkit-scrollbar-track { background: ${isDark ? '#1C1C1E' : '#F2F2F7'}; }
          ::-webkit-scrollbar-thumb { background: ${isDark ? '#3A3A3C' : '#C7C7CC'}; border-radius: 3px; }
          @media (prefers-reduced-motion: reduce) { *, *::before, *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; transition-duration: .01ms !important; } }

        `}</style>
      </Head>

      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
        <DynamicIslandProvider>
          <DialogProvider>
            <View style={{ flex: 1, position: 'relative', backgroundColor: colors.background, width: '100%', maxWidth: path.startsWith('/admin') ? 1440 : path === '/map' || path.startsWith('/live/') ? 1280 : path === '/' ? 1100 : 820, alignSelf: 'center' }}>
              {!configReady ? <PendingScreen /> : maintenance.enabled && sessionReady && !isAdmin && path !== '/auth' ? <View style={{ flex: 1, backgroundColor: OASIS.colors.background, alignItems: 'center', justifyContent: 'center', padding: 16 }}><Text style={{ fontSize: 28 }}>🛠️</Text><Text style={{ fontSize: 20, fontWeight: '700', color: OASIS.colors.ink, marginTop: 14 }}>نعتذر، المنصة تحت الصيانة</Text><Text style={{ fontSize: 15, color: OASIS.colors.muted, textAlign: 'center', lineHeight: 25, marginTop: 10 }}>{maintenance.message || 'نعمل على تحسين تجربتكم، يرجى العودة لاحقاً.'}</Text><Pressable onPress={() => router.push('/auth')} style={{ marginTop: 16, backgroundColor: OASIS.colors.primary, paddingHorizontal: 22, paddingVertical: 12, borderRadius: 14 }}><Text style={{ color: OASIS.colors.surface, fontWeight: '600' }}>دخول المدير</Text></Pressable></View> : maintenance.enabled && isAdmin && path !== '/admin' ? <Redirect href="/admin" /> : protectCurrentRoute ? (sessionReady ? <Redirect href="/auth" /> : <PendingScreen />) : routeBlocked ? <Redirect href="/home" /> : (
                <Stack
                  screenOptions={{
                    headerShown: false,
                    // Native gets a short slide; web swaps screens without a blank animation frame.
                    animation: Platform.OS === 'web' ? 'none' : 'slide_from_right',
                    animationDuration: Platform.OS === 'web' ? 0 : 180,
                    contentStyle: { backgroundColor: 'transparent', flex: 1 },
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
