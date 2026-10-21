import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Image, ImageBackground, Platform, Pressable,
  ScrollView, StatusBar, StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, ArrowRight, LogIn, UserRoundPlus, UsersRound, ShieldCheck } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import {
  FALLBACK_LOGO_URI, getBrandingLogo, getCachedBrandingLogo, subscribeBrandingLogo,
} from '@/lib/branding';

// Store the background-only image at public/welcome/welcome-background.png.
// The background is separate from the interactive buttons and text below.
const WELCOME_BACKGROUND = { uri: 'https://appksatest.vercel.app/welcome/welcome-background.png.png' };

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
      <ImageBackground source={WELCOME_BACKGROUND} resizeMode="cover" style={styles.background} imageStyle={styles.backgroundImage}>
        <View pointerEvents="none" style={styles.topVeil} />
        <View pointerEvents="none" style={styles.bottomVeil} />
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, { paddingTop: Math.max(insets.top, 16) + 14, paddingBottom: Math.max(insets.bottom, 12) + 22 }, compact && styles.compact]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.topRow}>
            <Pressable accessibilityRole="button" accessibilityLabel="تصفح كزائر" onPress={() => router.replace('/home')} style={styles.guestTop}>
              <UsersRound size={17} color="#166044" />
              <Text style={styles.guestTopText}>الدخول كزائر</Text>
            </Pressable>
            <View style={styles.languagePill}><Text style={styles.languageText}>العربية</Text></View>
          </View>

          <View style={styles.hero}>
            <Image source={{ uri: logoUri }} resizeMode="contain" style={[styles.logo, compact && styles.logoCompact]} accessibilityLabel="شعار حيّنا" />
            <Text style={styles.name}>حيّنا</Text>
            <Text style={styles.tagline}>مجتمعنا .. أقرب</Text>
            <Text style={styles.description}>منصة تجمع الجيران للتواصل والمساعدة والخدمات في حيّك</Text>
          </View>

          <View style={styles.spacer} />

          <View style={styles.bottomPanel}>
            <View style={styles.panelHandle} />
            <Text style={styles.panelTitle}>أهلًا بك في حيّنا</Text>
            <Text style={styles.panelSubtitle}>حيّك وناسك وخدماتك في مكان واحد</Text>

            <Pressable onPress={() => router.push('/auth')} accessibilityRole="button" accessibilityLabel="تسجيل الدخول" style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
              <LogIn size={21} color="#FFFFFF" />
              <Text style={styles.primaryText}>تسجيل الدخول</Text>
              <ArrowLeft size={19} color="#FFFFFF" />
            </Pressable>
            <Pressable onPress={() => router.push('/auth')} accessibilityRole="button" accessibilityLabel="إنشاء حساب جديد" style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
              <UserRoundPlus size={21} color="#047857" />
              <Text style={styles.secondaryText}>إنشاء حساب جديد</Text>
              <ArrowLeft size={19} color="#047857" />
            </Pressable>
            <Pressable onPress={() => router.replace('/home')} accessibilityRole="button" accessibilityLabel="استكشاف حيّنا دون تسجيل" style={styles.explore}>
              <Text style={styles.exploreText}>استكشف حيّنا دون تسجيل</Text>
              <ArrowRight size={16} color="#166044" />
            </Pressable>
            <View style={styles.trustRow}><ShieldCheck size={15} color="#047857" /><Text style={styles.trustText}>مجتمع محلي، خصوصية واحترام للجميع</Text></View>
          </View>
        </ScrollView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#F5F3E9' },
  background: { flex: 1, width: '100%' },
  backgroundImage: { width: '100%', height: '100%' },
  topVeil: { position: 'absolute', top: 0, left: 0, right: 0, height: '47%', backgroundColor: 'rgba(250,249,241,0.25)' },
  bottomVeil: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '37%', backgroundColor: 'rgba(250,249,241,0.32)' },
  scroll: { flex: 1 },
  content: { flexGrow: 1, minHeight: '100%', paddingHorizontal: 22, alignItems: 'center' },
  compact: { paddingHorizontal: 16 },
  topRow: { width: '100%', maxWidth: 440, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  guestTop: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, borderRadius: 24, paddingHorizontal: 12, minHeight: 38, backgroundColor: 'rgba(255,255,255,0.82)', borderWidth: 1, borderColor: 'rgba(4,120,87,0.16)' },
  guestTopText: { color: '#166044', fontSize: 12, fontWeight: '800' },
  languagePill: { paddingHorizontal: 14, minHeight: 36, borderRadius: 20, justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.65)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.85)' },
  languageText: { color: '#166044', fontSize: 12, fontWeight: '700' },
  hero: { width: '100%', maxWidth: 390, alignItems: 'center', paddingTop: 30 },
  logo: { width: 112, height: 112 },
  logoCompact: { width: 84, height: 84 },
  name: { fontSize: 49, lineHeight: 64, fontWeight: '900', color: '#176044', textAlign: 'center', marginTop: -4 },
  tagline: { fontSize: 20, fontWeight: '900', color: '#176044', textAlign: 'center' },
  description: { fontSize: 14, lineHeight: 23, fontWeight: '600', color: '#53615A', textAlign: 'center', marginTop: 12, maxWidth: 295 },
  spacer: { flexGrow: 1, minHeight: 100 },
  bottomPanel: { width: '100%', maxWidth: 440, borderRadius: 28, paddingHorizontal: 18, paddingTop: 15, paddingBottom: 18, backgroundColor: 'rgba(255,253,247,0.91)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.92)', alignItems: 'center', ...Platform.select({ web: { boxShadow: '0px 8px 36px rgba(34,65,48,0.10)' } as any, default: { elevation: 3 } }) },
  panelHandle: { width: 36, height: 4, borderRadius: 3, backgroundColor: '#D5DED7', marginBottom: 12 },
  panelTitle: { color: '#173F30', fontSize: 19, fontWeight: '900', textAlign: 'center' },
  panelSubtitle: { color: '#63766A', fontSize: 12, fontWeight: '600', textAlign: 'center', marginTop: 4, marginBottom: 20 },
  primaryButton: { width: '100%', minHeight: 54, borderRadius: 18, backgroundColor: '#176044', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 },
  primaryText: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  secondaryButton: { width: '100%', minHeight: 54, borderRadius: 18, borderWidth: 1.5, borderColor: '#176044', backgroundColor: 'rgba(255,255,255,0.82)', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, marginTop: 10 },
  secondaryText: { color: '#176044', fontSize: 16, fontWeight: '900' },
  explore: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 43, marginTop: 8 },
  exploreText: { color: '#166044', fontSize: 12, fontWeight: '800' },
  trustRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 8 },
  trustText: { color: '#718176', fontSize: 10, fontWeight: '600' },
  pressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  loading: { flex: 1, backgroundColor: '#F5F3E9', alignItems: 'center', justifyContent: 'center' },
  loadingLogo: { width: 88, height: 88, marginBottom: 20 },
});
