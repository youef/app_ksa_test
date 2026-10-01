import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { Home, ArrowLeft } from 'lucide-react-native';
import Landing3D from '@/components/Landing3D';

export default function Index() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setSignedIn(true);
        setTimeout(() => router.replace('/home'), 300);
      } else {
        setCheckingSession(false);
      }
    });
  }, []);

  if (signedIn || checkingSession) {
    return (
      <View style={styles.loading}>
        <LinearGradient colors={['#04110f', '#07352d', '#020908']} style={StyleSheet.absoluteFillObject} />
        <View style={styles.loadingLogo}><Home size={30} color="#d7fff3" /></View>
        {signedIn ? null : <ActivityIndicator color="#63e6be" />}
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <LinearGradient
        colors={['#04110f', '#06251f', '#020908']}
        style={StyleSheet.absoluteFillObject}
      />

      <View pointerEvents="none" style={styles.glowOne} />
      <View pointerEvents="none" style={styles.glowTwo} />

      <View style={styles.scene}>
        <Landing3D />
      </View>

      <View style={styles.identity} pointerEvents="box-none">
        <View style={styles.logo}>
          <Home size={34} color="#eafff8" strokeWidth={2.2} />
        </View>
        <Text style={styles.brand}>حيّنا</Text>
      </View>

      <View style={styles.actionWrap}>
        <Pressable onPress={() => router.push('/auth')} style={styles.button}>
          <LinearGradient colors={['#4ade80', '#14b8a6']} style={styles.buttonGradient}>
            <Text style={styles.buttonText}>دخول</Text>
            <ArrowLeft size={18} color="#04231d" strokeWidth={2.4} />
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
    backgroundColor: '#020908',
    overflow: 'hidden',
    position: 'relative',
  },
  scene: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  identity: {
    position: 'absolute',
    top: 34,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 5,
  },
  logo: {
    width: 62,
    height: 62,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(52,211,153,.12)',
    borderWidth: 1,
    borderColor: 'rgba(120,255,218,.25)',
    shadowColor: '#34d399',
    shadowOpacity: 0.25,
    shadowRadius: 24,
  },
  brand: {
    color: '#effff9',
    fontSize: 24,
    fontWeight: '900',
    marginTop: 9,
    letterSpacing: 0.5,
  },
  actionWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 42,
    alignItems: 'center',
    zIndex: 6,
  },
  button: {
    borderRadius: 17,
    overflow: 'hidden',
    shadowColor: '#34d399',
    shadowOpacity: 0.25,
    shadowRadius: 20,
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
    color: '#04231d',
    fontSize: 15,
    fontWeight: '900',
  },
  glowOne: {
    position: 'absolute',
    width: 520,
    height: 520,
    borderRadius: 520,
    backgroundColor: 'rgba(16,185,129,.10)',
    top: -260,
    left: -160,
    zIndex: 0,
  },
  glowTwo: {
    position: 'absolute',
    width: 500,
    height: 500,
    borderRadius: 500,
    backgroundColor: 'rgba(20,184,166,.07)',
    bottom: -280,
    right: -160,
    zIndex: 0,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingLogo: {
    width: 62,
    height: 62,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(52,211,153,.13)',
    marginBottom: 14,
  },
});
