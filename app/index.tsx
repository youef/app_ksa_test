import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ActivityIndicator, Image, Animated, Easing } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft } from 'lucide-react-native';

const LOGO_URI = '/assets/branding/HAYNA_LOGO.png?v=2';

export default function Index() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [signedIn, setSignedIn] = useState(false);
  const floatY = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0.96)).current;
  const shine = useRef(new Animated.Value(-1)).current;
  const rotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setSignedIn(true);
        setTimeout(() => router.replace('/home'), 300);
      } else {
        setCheckingSession(false);
      }
    });

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, { toValue: -10, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(floatY, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.04, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.96, duration: 1800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.timing(shine, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: true })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(rotate, { toValue: 1, duration: 9000, easing: Easing.linear, useNativeDriver: true }),
        Animated.timing(rotate, { toValue: 0, duration: 9000, easing: Easing.linear, useNativeDriver: true }),
      ])
    ).start();
  }, [floatY, pulse, shine, rotate]);

  if (signedIn || checkingSession) {
    return (
      <View style={styles.loading}>
        <LinearGradient colors={['#065f46', '#059669', '#10b981']} style={StyleSheet.absoluteFillObject} />
        <View style={styles.loadingGlass}>
          <Image source={{ uri: LOGO_URI }} style={styles.loadingLogoImage} resizeMode="contain" />
        </View>
        {signedIn ? null : <ActivityIndicator color="#ffffff" />}
      </View>
    );
  }

  const spin = rotate.interpolate({ inputRange: [0, 1], outputRange: ['-2deg', '2deg'] });
  const shineX = shine.interpolate({ inputRange: [-1, 1], outputRange: [-180, 180] });

  return (
    <View style={styles.page}>
      <LinearGradient
        colors={['#065f46', '#059669', '#10b981']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      <View pointerEvents="none" style={styles.glassGlow} />
      <View pointerEvents="none" style={styles.glassGlowTwo} />
      <View pointerEvents="none" style={styles.orbOne} />
      <View pointerEvents="none" style={styles.orbTwo} />

      <View style={styles.content}>
        <Text style={styles.welcome}>أهلًا بك في</Text>

        <Animated.View style={[styles.logoStage, { transform: [{ translateY: floatY }, { scale: pulse }, { rotate: spin }] }]}>
          <View style={styles.outerGlass}>
            <View style={styles.innerGlass}>
              <Image source={{ uri: LOGO_URI }} style={styles.logoImage} resizeMode="contain" />
              <Animated.View style={[styles.shine, { transform: [{ translateX: shineX }, { rotate: '22deg' }] }]} />
            </View>
          </View>
          <View style={styles.glassReflection} />
        </Animated.View>

        <Text style={styles.brand}>حيّنا</Text>
        <Text style={styles.tagline}>بيوت تجمعنا • مجتمع ينتمي لنا</Text>
        <Text style={styles.description}>مكان يجمع أهل الحي، ويقرّب الجيران من بعض.</Text>
      </View>

      <View style={styles.actionWrap}>
        <Pressable onPress={() => router.push('/auth')} style={styles.button}>
          <LinearGradient colors={['#ffffff', '#d1fae5']} style={styles.buttonGradient}>
            <Text style={styles.buttonText}>دخول</Text>
            <ArrowLeft size={18} color="#065f46" strokeWidth={2.6} />
          </LinearGradient>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    minHeight: Platform.OS === 'web' ? '100vh' as any : undefined,
    backgroundColor: '#059669',
    overflow: 'hidden',
    position: 'relative',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 110,
  },
  welcome: {
    color: 'rgba(255,255,255,.82)',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 18,
  },
  logoStage: {
    width: 285,
    height: 285,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerGlass: {
    width: 258,
    height: 258,
    borderRadius: 129,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,.13)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,.48)',
    shadowColor: '#022c22',
    shadowOpacity: 0.32,
    shadowRadius: 38,
    shadowOffset: { width: 0, height: 18 },
    elevation: 18,
    overflow: 'hidden',
  },
  innerGlass: {
    width: 226,
    height: 226,
    borderRadius: 113,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.28)',
    overflow: 'hidden',
  },
  logoImage: {
    width: 205,
    height: 205,
  },
  shine: {
    position: 'absolute',
    width: 34,
    height: 310,
    top: -20,
    backgroundColor: 'rgba(255,255,255,.20)',
    borderRadius: 30,
  },
  glassReflection: {
    position: 'absolute',
    top: 23,
    left: 45,
    width: 90,
    height: 28,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,.22)',
    transform: [{ rotate: '-18deg' }],
  },
  brand: {
    color: '#ffffff',
    fontSize: 34,
    fontWeight: '900',
    marginTop: 2,
    textShadowColor: 'rgba(0,0,0,.16)',
    textShadowRadius: 12,
  },
  tagline: {
    color: 'rgba(255,255,255,.92)',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 7,
  },
  description: {
    color: 'rgba(236,253,245,.78)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  actionWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 42,
    alignItems: 'center',
  },
  button: {
    borderRadius: 17,
    overflow: 'hidden',
    shadowColor: '#022c22',
    shadowOpacity: 0.25,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  buttonGradient: {
    minWidth: 170,
    height: 54,
    paddingHorizontal: 24,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  buttonText: {
    color: '#065f46',
    fontSize: 15,
    fontWeight: '900',
  },
  glassGlow: {
    position: 'absolute',
    width: 520,
    height: 520,
    borderRadius: 260,
    backgroundColor: 'rgba(255,255,255,.08)',
    top: -260,
    right: -190,
  },
  glassGlowTwo: {
    position: 'absolute',
    width: 440,
    height: 440,
    borderRadius: 220,
    backgroundColor: 'rgba(6,95,70,.18)',
    bottom: -230,
    left: -170,
  },
  orbOne: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,.35)',
    top: '27%',
    left: '14%',
  },
  orbTwo: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,.45)',
    top: '36%',
    right: '16%',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingGlass: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,.16)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,.45)',
    marginBottom: 16,
    overflow: 'hidden',
  },
  loadingLogoImage: {
    width: 98,
    height: 98,
  },
});
