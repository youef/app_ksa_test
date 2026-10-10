import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ActivityIndicator, Image, Animated, Easing, StatusBar, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { getBrandingLogo, FALLBACK_LOGO_URI, subscribeBrandingLogo, getCachedBrandingLogo } from '@/lib/branding';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, House, UsersRound, Store } from 'lucide-react-native';

const FALLBACK_URI = FALLBACK_LOGO_URI;

export default function Index() {
  const [signedIn, setSignedIn] = useState(false);
  const [logoUri, setLogoUri] = useState(getCachedBrandingLogo() || FALLBACK_URI);
  const { width, height } = useWindowDimensions();
  const compact = height < 740 || width < 370;
  const floatY = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0.98)).current;
  const shine = useRef(new Animated.Value(-1)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const applyBranding = (uri: string) => {
      if (!uri) return;
      setLogoUri(uri);
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const icon = document.querySelector('link[rel="icon"]') || document.createElement('link');
        icon.setAttribute('rel', 'icon');
        icon.setAttribute('href', uri);
        document.head.appendChild(icon);
        const apple = document.querySelector('link[rel="apple-touch-icon"]') || document.createElement('link');
        apple.setAttribute('rel', 'apple-touch-icon');
        apple.setAttribute('href', uri);
        document.head.appendChild(apple);
        const manifest = {
          name: 'حيّنا',
          short_name: 'حيّنا',
          start_url: '/',
          display: 'standalone',
          background_color: '#064e3b',
          theme_color: '#047857',
          dir: 'rtl',
          lang: 'ar',
          icons: [{ src: uri, sizes: '512x512', type: 'image/png', purpose: 'any maskable' }],
        };
        const blobUrl = URL.createObjectURL(new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' }));
        const manifestLink = document.querySelector('link[rel="manifest"]') || document.createElement('link');
        manifestLink.setAttribute('rel', 'manifest');
        manifestLink.setAttribute('href', blobUrl);
        document.head.appendChild(manifestLink);
      }
    };

    void getBrandingLogo().then(applyBranding);
    const unsubscribeBranding = subscribeBrandingLogo(applyBranding);
    let sessionActive = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!sessionActive) return;
      if (data.session?.user) {
        setSignedIn(true);
        router.replace('/home');
      }
    }).catch(() => {
      if (sessionActive) setSignedIn(false);
    });

    const floatLoop = Animated.loop(Animated.sequence([
      Animated.timing(floatY, { toValue: -9, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(floatY, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    const pulseLoop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.025, duration: 1900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0.98, duration: 1900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));
    const shineLoop = Animated.loop(Animated.sequence([
      Animated.delay(350),
      Animated.timing(shine, { toValue: 1, duration: 2600, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(shine, { toValue: -1, duration: 0, useNativeDriver: true }),
    ]));
    const rotateLoop = Animated.loop(Animated.sequence([
      Animated.timing(rotate, { toValue: 1, duration: 7000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(rotate, { toValue: 0, duration: 7000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ]));

    floatLoop.start();
    pulseLoop.start();
    shineLoop.start();
    rotateLoop.start();

    return () => {
      sessionActive = false;
      unsubscribeBranding();
      floatLoop.stop();
      pulseLoop.stop();
      shineLoop.stop();
      rotateLoop.stop();
    };
  }, [floatY, pulse, shine, rotate]);

  if (signedIn) {
    return (
      <View style={styles.loading}>
        <StatusBar barStyle="light-content" backgroundColor="#064e3b" />
        <LinearGradient colors={['#064e3b', '#047857', '#059669']} style={StyleSheet.absoluteFillObject} />
        <View style={styles.loadingGlass}>
          <Image source={{ uri: logoUri }} style={styles.loadingLogoImage} resizeMode="contain" />
        </View>
        <ActivityIndicator color="#ffffff" />
      </View>
    );
  }

  const spin = rotate.interpolate({ inputRange: [0, 1], outputRange: ['-1.5deg', '1.5deg'] });
  const shineX = shine.interpolate({ inputRange: [-1, 1], outputRange: [-230, 230] });

  return (
    <View style={styles.page}>
      <StatusBar barStyle="light-content" backgroundColor="#064e3b" />
      <LinearGradient
        colors={['#064e3b', '#047857', '#059669', '#10b981']}
        locations={[0, 0.38, 0.76, 1]}
        start={{ x: 0.05, y: 0 }}
        end={{ x: 0.95, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <View pointerEvents="none" style={styles.topGlow} />
      <View pointerEvents="none" style={styles.bottomGlow} />
      <View pointerEvents="none" style={styles.orbOne} />
      <View pointerEvents="none" style={styles.orbTwo} />
      <View pointerEvents="none" style={styles.orbThree} />
      <View pointerEvents="none" style={styles.decorRing} />

      <View style={[styles.content, compact && styles.contentCompact]}>
        <View style={styles.eyebrow}>
          <View style={styles.liveDot} />
          <Text style={styles.eyebrowText}>مجتمعك يبدأ من هنا</Text>
        </View>

        <Text style={[styles.welcome, compact && styles.welcomeCompact]}>حيّنا… أقرب لبعض</Text>

        <View style={[styles.scene3D, compact && styles.scene3DCompact]}>
          <View pointerEvents="none" style={[styles.floatCard, styles.floatCardTopLeft, { transform: [{ perspective: 700 }, { rotateY: '16deg' }, { rotateX: '-8deg' }] }]}>
            <View style={[styles.floatIcon, styles.floatIconMint]}><UsersRound size={18} color="#d1fae5" strokeWidth={2.4} /></View>
            <View style={styles.floatCardCopy}><Text style={styles.floatCardTitle}>جيرانك</Text><Text style={styles.floatCardSub}>قريبين منك</Text></View>
          </View>
          <View pointerEvents="none" style={[styles.floatCard, styles.floatCardTopRight, { transform: [{ perspective: 700 }, { rotateY: '-18deg' }, { rotateX: '-7deg' }] }]}>
            <View style={[styles.floatIcon, styles.floatIconGold]}><Store size={18} color="#fef3c7" strokeWidth={2.4} /></View>
            <View style={styles.floatCardCopy}><Text style={styles.floatCardTitle}>سوق الحي</Text><Text style={styles.floatCardSub}>كل شيء حولك</Text></View>
          </View>
          <Animated.View style={[
            styles.logoStage,
            compact && styles.logoStageCompact,
            { transform: [{ translateY: floatY }, { scale: pulse }, { rotate: spin }] },
          ]}>
            <View style={styles.logoShadow} />
            <View style={styles.outerGlass}>
              <View style={styles.innerGlass}>
                <Image source={{ uri: logoUri }} style={[styles.logoImage, compact && styles.logoImageCompact]} resizeMode="contain" />
                <Animated.View style={[styles.shine, { transform: [{ translateX: shineX }, { rotate: '22deg' }] }]} />
              </View>
            </View>
            <View style={styles.glassReflection} />
            <View style={styles.logoOrbit} />
          </Animated.View>
          <View pointerEvents="none" style={[styles.floatCard, styles.floatCardBottom, { transform: [{ perspective: 700 }, { rotateY: '12deg' }, { rotateX: '8deg' }] }]}>
            <View style={[styles.floatIcon, styles.floatIconBlue]}><House size={18} color="#dbeafe" strokeWidth={2.4} /></View>
            <View style={styles.floatCardCopy}><Text style={styles.floatCardTitle}>خدمات قريبة</Text><Text style={styles.floatCardSub}>حيّك في مكان واحد</Text></View>
            <View style={styles.cardLiveDot} />
          </View>
          <View pointerEvents="none" style={styles.sceneFloor} />
        </View>

        <Text style={styles.tagline}>بيوت تجمعنا • مجتمع ينتمي لنا</Text>
        <Text style={[styles.description, compact && styles.descriptionCompact]}>مكان يجمع أهل الحي، ويقرّب الجيران من بعض.</Text>

        <View style={styles.features}>
          <View style={styles.feature}>
            <View style={styles.featureIcon}><UsersRound size={16} color="#d1fae5" strokeWidth={2.2} /></View>
            <Text style={styles.featureText}>جيرانك</Text>
          </View>
          <View style={styles.featureDivider} />
          <View style={styles.feature}>
            <View style={styles.featureIcon}><Store size={16} color="#d1fae5" strokeWidth={2.2} /></View>
            <Text style={styles.featureText}>سوق الحي</Text>
          </View>
          <View style={styles.featureDivider} />
          <View style={styles.feature}>
            <View style={styles.featureIcon}><House size={16} color="#d1fae5" strokeWidth={2.2} /></View>
            <Text style={styles.featureText}>خدمات قريبة</Text>
          </View>
        </View>
      </View>

      <View style={[styles.actionWrap, compact && styles.actionWrapCompact]}>
        <Pressable
          onPress={() => router.replace('/auth')}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
          accessibilityRole="button"
          accessibilityLabel="ابدأ استخدام حيّنا"
          hitSlop={8}
        >
          <LinearGradient colors={['#ffffff', '#ecfdf5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.buttonGradient}>
            <Text style={styles.buttonText}>ابدأ الآن</Text>
            <View style={styles.buttonArrow}><ArrowLeft size={17} color="#065f46" strokeWidth={2.8} /></View>
          </LinearGradient>
        </Pressable>
        <Text style={styles.footerText}>حيّك، ناسك، وحياتك اليومية في مكان واحد</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    minHeight: Platform.OS === 'web' ? '100vh' as any : undefined,
    backgroundColor: '#047857',
    overflow: 'hidden',
    position: 'relative',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 24 : 18,
    paddingBottom: 150,
  },
  contentCompact: { paddingTop: 10, paddingBottom: 125 },
  eyebrow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(209,250,229,.24)',
    backgroundColor: 'rgba(255,255,255,.09)',
    marginBottom: 16,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#a7f3d0',
    shadowColor: '#a7f3d0',
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  eyebrowText: { color: '#d1fae5', fontSize: 12, fontWeight: '800', letterSpacing: 0.2 },
  welcome: {
    color: '#ffffff',
    fontSize: 29,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 7,
    letterSpacing: -0.6,
    textShadowColor: 'rgba(2,44,34,.18)',
    textShadowRadius: 12,
    textShadowOffset: { width: 0, height: 3 },
  },
  welcomeCompact: { fontSize: 25, marginBottom: 2 },
  logoStage: {
    width: 280,
    height: 280,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 3,
    marginBottom: 4,
  },
  logoStageCompact: { width: 225, height: 225 },
  scene3D: {
    width: 340,
    maxWidth: '100%',
    height: 310,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -3,
    marginBottom: 1,
    position: 'relative',
  },
  scene3DCompact: { height: 255, marginTop: -5 },
  floatCard: {
    position: 'absolute',
    zIndex: 4,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 9,
    minWidth: 132,
    paddingHorizontal: 11,
    paddingVertical: 10,
    borderRadius: 17,
    backgroundColor: 'rgba(4, 55, 43, .82)',
    borderWidth: 1,
    borderColor: 'rgba(236,253,245,.28)',
    shadowColor: '#022c22',
    shadowOpacity: 0.3,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  floatCardTopLeft: { top: 24, left: 0 },
  floatCardTopRight: { top: 54, right: 0 },
  floatCardBottom: { bottom: 9, left: 42, minWidth: 194, paddingVertical: 9 },
  floatIcon: { width: 35, height: 35, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,.2)' },
  floatIconMint: { backgroundColor: 'rgba(16,185,129,.32)' },
  floatIconGold: { backgroundColor: 'rgba(245,158,11,.24)' },
  floatIconBlue: { backgroundColor: 'rgba(59,130,246,.25)' },
  floatCardCopy: { alignItems: 'flex-end', gap: 2 },
  floatCardTitle: { color: '#ffffff', fontSize: 11, fontWeight: '900' },
  floatCardSub: { color: 'rgba(236,253,245,.72)', fontSize: 9, fontWeight: '600' },
  cardLiveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#6ee7b7', marginLeft: 1 },
  sceneFloor: {
    position: 'absolute',
    width: 205,
    height: 40,
    bottom: 18,
    borderRadius: 100,
    backgroundColor: 'rgba(2,44,34,.19)',
    transform: [{ perspective: 500 }, { rotateX: '62deg' }, { scaleX: 1.4 }],
  },
  logoShadow: {
    position: 'absolute',
    width: 180,
    height: 28,
    bottom: 10,
    borderRadius: 100,
    backgroundColor: 'rgba(2,44,34,.24)',
    transform: [{ scaleX: 1.15 }],
  },
  outerGlass: {
    width: 244,
    height: 244,
    borderRadius: 122,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,.10)',
    borderWidth: 1.5,
    borderColor: 'rgba(236,253,245,.58)',
    shadowColor: '#022c22',
    shadowOpacity: 0.26,
    shadowRadius: 36,
    shadowOffset: { width: 0, height: 18 },
    elevation: 16,
    overflow: 'hidden',
  },
  innerGlass: {
    width: 214,
    height: 214,
    borderRadius: 107,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.30)',
    overflow: 'hidden',
  },
  logoImage: { width: 192, height: 192 },
  logoImageCompact: { width: 170, height: 170 },
  shine: {
    position: 'absolute',
    width: 30,
    height: 290,
    top: -38,
    backgroundColor: 'rgba(255,255,255,.19)',
    borderRadius: 30,
  },
  glassReflection: {
    position: 'absolute',
    top: 26,
    left: 52,
    width: 78,
    height: 23,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,.25)',
    transform: [{ rotate: '-20deg' }],
  },
  logoOrbit: {
    position: 'absolute',
    width: 268,
    height: 268,
    borderRadius: 134,
    borderWidth: 1,
    borderColor: 'rgba(236,253,245,.15)',
  },
  tagline: {
    color: '#ecfdf5',
    fontSize: 14,
    fontWeight: '900',
    textAlign: 'center',
    marginTop: 2,
  },
  description: {
    color: 'rgba(236,253,245,.78)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  descriptionCompact: { marginTop: 5, fontSize: 11 },
  features: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 13,
    marginTop: 24,
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(236,253,245,.15)',
    backgroundColor: 'rgba(2,44,34,.12)',
  },
  feature: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  featureIcon: {
    width: 25,
    height: 25,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,.10)',
  },
  featureText: { color: 'rgba(255,255,255,.91)', fontSize: 10, fontWeight: '800' },
  featureDivider: { width: 1, height: 19, backgroundColor: 'rgba(236,253,245,.22)' },
  actionWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: Platform.OS === 'ios' ? 34 : 25,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  actionWrapCompact: { bottom: Platform.OS === 'ios' ? 24 : 18 },
  button: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#022c22',
    shadowOpacity: 0.24,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 9 },
    elevation: 9,
  },
  buttonPressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
  buttonGradient: {
    height: 56,
    paddingHorizontal: 22,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 11,
  },
  buttonText: { color: '#065f46', fontSize: 15, fontWeight: '900' },
  buttonArrow: {
    width: 29,
    height: 29,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d1fae5',
  },
  footerText: {
    color: 'rgba(236,253,245,.65)',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 12,
    textAlign: 'center',
  },
  topGlow: {
    position: 'absolute',
    width: 440,
    height: 440,
    borderRadius: 220,
    backgroundColor: 'rgba(255,255,255,.07)',
    top: -260,
    right: -180,
  },
  bottomGlow: {
    position: 'absolute',
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(6,95,70,.22)',
    bottom: -220,
    left: -170,
  },
  orbOne: { position: 'absolute', width: 11, height: 11, borderRadius: 6, backgroundColor: 'rgba(255,255,255,.42)', top: '25%', left: '12%' },
  orbTwo: { position: 'absolute', width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(209,250,229,.68)', top: '36%', right: '11%' },
  orbThree: { position: 'absolute', width: 14, height: 14, borderRadius: 7, backgroundColor: 'rgba(255,255,255,.17)', bottom: '27%', right: '17%' },
  decorRing: {
    position: 'absolute',
    width: 360,
    height: 360,
    borderRadius: 180,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.055)',
    top: '18%',
    right: -245,
  },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#064e3b' },
  loadingGlass: {
    width: 112,
    height: 112,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,.13)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,.38)',
    marginBottom: 22,
    overflow: 'hidden',
  },
  loadingLogoImage: { width: 88, height: 88 },
});
