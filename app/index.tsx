import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Image, ImageBackground, Platform, Pressable,
  StatusBar, StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, LogIn, ShieldCheck } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import {
  FALLBACK_LOGO_URI, getBrandingLogo, getCachedBrandingLogo, subscribeBrandingLogo,
} from '@/lib/branding';

// Animated header background, separate from the logo and controls.
// The background is separate from the interactive buttons and text below.
const LOGIN_BUTTON_BACKGROUND = { uri: Platform.OS === 'web' ? '/images/buttons/hayna-login-button-bg.png' : 'https://appksatest.vercel.app/images/buttons/hayna-login-button-bg.png' };

const WELCOME_BACKGROUND = {
  uri: Platform.OS === 'web'
    ? '/welcome/welcome-background.gif'
    : 'https://appksatest.vercel.app/welcome/welcome-background.gif',
};

export default function Index() {
  const [signedIn, setSignedIn] = useState(false);
  const [logoUri, setLogoUri] = useState(getCachedBrandingLogo() || FALLBACK_LOGO_URI);
  const { height, width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const compact = height < 740 || width < 365;

  useEffect(() => {
    let active = true;
    let manifestBlobUrl: string | null = null;

    const applyBranding = (uri: string) => {
      if (!uri || !active) return;
      setLogoUri(uri);

      if (Platform.OS !== 'web' || typeof document === 'undefined') return;

      const setLink = (rel: string, href: string) => {
        let link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
        if (!link) {
          link = document.createElement('link');
          link.rel = rel;
          document.head.appendChild(link);
        }
        link.href = href;
      };

      setLink('icon', uri);
      setLink('apple-touch-icon', uri);

      if (manifestBlobUrl) URL.revokeObjectURL(manifestBlobUrl);
      const manifest = {
        name: 'حيّنا',
        short_name: 'حيّنا',
        start_url: '/',
        display: 'standalone',
        background_color: '#047857',
        theme_color: '#047857',
        dir: 'rtl',
        lang: 'ar',
        icons: [{ src: uri, sizes: '512x512', type: 'image/png', purpose: 'any maskable' }],
      };
      manifestBlobUrl = URL.createObjectURL(
        new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' }),
      );
      setLink('manifest', manifestBlobUrl);
    };

    void getBrandingLogo().then(applyBranding).catch(() => undefined);
    const unsubscribeBranding = subscribeBrandingLogo(applyBranding);

    void supabase.auth.getSession()
      .then(({ data }) => {
        if (active && data.session?.user) {
          setSignedIn(true);
          router.replace('/home');
        }
      })
      .catch(() => {
        if (active) setSignedIn(false);
      });

    return () => {
      active = false;
      unsubscribeBranding();
      if (manifestBlobUrl) URL.revokeObjectURL(manifestBlobUrl);
    };
  }, []);


  if (signedIn) {
    return <View style={styles.loading}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F3E9" />
      <Image source={{ uri: logoUri }} style={styles.loadingLogo} resizeMode="contain" />
      <ActivityIndicator color="#047857" />
    </View>;
  }

  return (
    <View style={styles.page}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F3E9" translucent={false} />
      <View style={styles.background}>
        <View pointerEvents="none" style={[styles.headerBackground, { height: Math.min(height * 0.6, 520) }]}>
        <ImageBackground source={WELCOME_BACKGROUND} resizeMode="cover" style={StyleSheet.absoluteFillObject}>
          <View style={styles.topVeil} />
          <LinearGradient colors={['rgba(245,243,233,0)', '#F5F3E9']} style={styles.headerFade} />
        </ImageBackground>
        </View>
        <View
          style={[styles.content, { paddingTop: Math.max(insets.top, 12), paddingBottom: Math.max(insets.bottom, 12) }, compact && styles.compact]}
        ><View pointerEvents="none" style={[styles.hero, { top: Math.max(insets.top, 12) }, compact && styles.heroCompact]}>
            <Image source={{ uri: logoUri }} resizeMode="contain" style={[styles.logo, compact && styles.logoCompact]} accessibilityLabel="شعار حيّنا" />
          </View>

          <View style={styles.spacer} />

          <View style={styles.bottomPanel}>
            <View style={styles.panelHandle} />
            <Text style={styles.panelTitle}>أهلًا بك في حيّنا</Text>
            <Text style={styles.panelSubtitle}>حيّك وناسك وخدماتك في مكان واحد</Text>

            <Pressable onPress={() => router.push('/auth')} accessibilityRole="button" accessibilityLabel="تسجيل الدخول" style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
              <Image source={LOGIN_BUTTON_BACKGROUND} resizeMode="stretch" style={styles.primaryButtonArtwork} pointerEvents="none" />
              <LogIn size={21} color="#FFFFFF" style={styles.primaryButtonContent} />
              <Text style={[styles.primaryText, styles.primaryButtonContent]}>تسجيل الدخول</Text>
            </Pressable>
            <Pressable onPress={() => router.replace('/home')} accessibilityRole="button" accessibilityLabel="استكشاف حيّنا دون تسجيل" style={styles.explore}>
              <Text style={styles.exploreText}>استكشف حيّنا دون تسجيل</Text>
              <ArrowRight size={16} color="#166044" />
            </Pressable>
            <View style={styles.trustRow}><ShieldCheck size={15} color="#047857" /><Text style={styles.trustText}>مجتمع محلي، خصوصية واحترام للجميع</Text></View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, overflow: 'hidden', backgroundColor: '#F5F3E9' },
  background: { flex: 1, width: '100%' },
  headerBackground: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
  topVeil: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(250,249,241,0.25)' },
  headerFade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 120 },
  content: { flex: 1, minHeight: 0, paddingHorizontal: 22, alignItems: 'center' },
  compact: { paddingHorizontal: 16 },
  hero: { position: 'absolute', alignSelf: 'center', alignItems: 'center', zIndex: 1 },
  heroCompact: {},
  logo: { width: 112, height: 112 },
  logoCompact: { width: 84, height: 84 },
  spacer: { flexGrow: 1, minHeight: 8 },
  bottomPanel: { width: '100%', maxWidth: 440, borderRadius: 28, paddingHorizontal: 18, paddingTop: 15, paddingBottom: 18, backgroundColor: 'rgba(255,253,247,0.91)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.92)', alignItems: 'center', ...Platform.select({ web: { boxShadow: '0px 8px 36px rgba(34,65,48,0.10)' } as any, default: { elevation: 3 } }) },
  panelHandle: { width: 36, height: 4, borderRadius: 3, backgroundColor: '#D5DED7', marginBottom: 12 },
  panelTitle: { color: '#173F30', fontSize: 19, fontWeight: '900', textAlign: 'center' },
  panelSubtitle: { color: '#63766A', fontSize: 12, fontWeight: '600', textAlign: 'center', marginTop: 4, marginBottom: 20 },
  primaryButton: { width: '100%', minHeight: 62, borderRadius: 18, overflow: 'hidden', backgroundColor: 'transparent', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 18 },
  primaryButtonArtwork: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  primaryButtonContent: { zIndex: 1 },
  primaryText: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  explore: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 43, marginTop: 8 },
  exploreText: { color: '#166044', fontSize: 12, fontWeight: '800' },
  trustRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8 },
  trustText: { color: '#718176', fontSize: 10, fontWeight: '600' },
  pressed: { opacity: 0.82 },
  loading: { flex: 1, backgroundColor: '#F5F3E9', alignItems: 'center', justifyContent: 'center' },
  loadingLogo: { width: 88, height: 88, marginBottom: 20 },
});
