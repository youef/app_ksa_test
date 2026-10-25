import { OASIS } from '@/lib/oasis';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Image, ImageBackground, Platform,
  StatusBar, StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowRight, LogIn, ShieldCheck } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { HAYNA_BUTTON } from '@/components/shared/haynaButtonTokens';
import { HaynaActionButton } from '@/components/shared/HaynaActionButton';
import {
  FALLBACK_LOGO_URI, getBrandingLogo, getCachedBrandingLogo, subscribeBrandingLogo,
} from '@/lib/branding';

// Animated header background, separate from the logo and controls.
// The background is separate from the interactive buttons and text below.

const WELCOME_BACKGROUND = require('../public/design-system/hayna-v1/artwork/welcome-art.png');

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
        background_color: OASIS.colors.primary,
        theme_color: OASIS.colors.primary,
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
      <StatusBar barStyle="dark-content" backgroundColor={OASIS.colors.background} />
      <Image source={{ uri: logoUri }} style={styles.loadingLogo} resizeMode="contain" />
      <ActivityIndicator color={OASIS.colors.primary} />
    </View>;
  }

  return (
    <View style={styles.page}>
      <StatusBar barStyle="dark-content" backgroundColor={OASIS.colors.background} translucent={false} />
      <View style={styles.background}>
        <View pointerEvents="none" style={[styles.headerBackground, { height: Math.min(height * 0.6, 520) }]}>
        <ImageBackground source={WELCOME_BACKGROUND} resizeMode="cover" style={StyleSheet.absoluteFillObject}>
          <View style={styles.topVeil} />
          <LinearGradient colors={['rgba(245,243,233,0)', OASIS.colors.background]} style={styles.headerFade} />
        </ImageBackground>
        </View>
        <View
          style={[styles.content, { paddingTop: Math.max(insets.top, 12), paddingBottom: Math.max(insets.bottom, 12) }, compact && styles.compact]}
        ><View pointerEvents="none" style={[styles.hero, { top: Math.max(insets.top, 12) }, compact && styles.heroCompact]}>
            <Image source={{ uri: logoUri }} resizeMode="contain" style={[styles.logo, compact && styles.logoCompact]} accessibilityLabel="شعار حيّنا" />
          </View>

          <View style={styles.spacer} />

          <View style={styles.bottomPanel}>
            <Text style={styles.panelTitle}>أهلًا بك في حيّنا</Text>
            <Text style={styles.panelSubtitle}>حيّك وناسك وخدماتك في مكان واحد</Text>

            <HaynaActionButton
              title="تسجيل الدخول"
              onPress={() => router.push('/auth')}
              icon={<LogIn size={HAYNA_BUTTON.iconSize} color={OASIS.colors.surface} />}
            />
            <HaynaActionButton
              title="استكشف حيّنا دون تسجيل"
              variant="secondary"
              onPress={() => router.replace('/home')}
              icon={<ArrowRight size={HAYNA_BUTTON.iconSize} color={OASIS.colors.primary} />}
              style={styles.secondaryAction}
            />
            <View style={styles.trustRow}><ShieldCheck size={15} color={OASIS.colors.primary} /><Text style={styles.trustText}>مجتمع محلي، خصوصية واحترام للجميع</Text></View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, overflow: 'hidden', backgroundColor: OASIS.colors.background },
  background: { flex: 1, width: '100%' },
  headerBackground: { position: 'absolute', top: 0, left: 0, right: 0, overflow: 'hidden' },
  topVeil: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(250,249,241,0.25)' },
  headerFade: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 120 },
  content: { flex: 1, minHeight: 0, paddingHorizontal: 16, alignItems: 'center' },
  compact: { paddingHorizontal: 16 },
  hero: { position: 'absolute', alignSelf: 'center', alignItems: 'center', zIndex: 1 },
  heroCompact: {},
  logo: { width: 112, height: 112 },
  logoCompact: { width: 84, height: 84 },
  spacer: { flexGrow: 1, minHeight: 8 },
  bottomPanel: { width: '100%', maxWidth: HAYNA_BUTTON.maxContentWidth, paddingHorizontal: 19, paddingTop: 15, paddingBottom: 18, backgroundColor: 'transparent', borderWidth: 0, alignItems: 'center' },
  panelTitle: { color: OASIS.colors.ink, fontSize: 19, fontWeight: '700', textAlign: 'center' },
  panelSubtitle: { color: OASIS.colors.muted, fontSize: 12, fontWeight: '600', textAlign: 'center', marginTop: 4, marginBottom: 14 },
  secondaryAction: { marginTop: HAYNA_BUTTON.verticalGap },
  trustRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8 },
  trustText: { color: '#718176', fontSize: 11, fontWeight: '600' },
  loading: { flex: 1, backgroundColor: OASIS.colors.background, alignItems: 'center', justifyContent: 'center' },
  loadingLogo: { width: 88, height: 88, marginBottom: 20 },
});
