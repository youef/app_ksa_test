import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import HeroLogo from '@/components/HeroLogo';

export default function Index() {
  const { width, height } = useWindowDimensions();
  const [status, setStatus] = useState<'checking' | 'guest' | 'signedIn'>('checking');

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setStatus('signedIn');
        timer = setTimeout(() => router.replace('/home'), 1400);
      } else {
        setStatus('guest');
      }
    });
    return () => clearTimeout(timer);
  }, []);

  const logoSize = Math.min(width * 0.75, height * 0.42, 320);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#021c1a', '#042f2e', '#021c1a']}
        style={StyleSheet.absoluteFillObject}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <View style={styles.center}>
        <HeroLogo size={logoSize} />
        <Text style={styles.tagline}>حيّك وجيرانك في مكان واحد</Text>
      </View>

      <View style={styles.actions}>
        {status === 'guest' ? (
          <>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
              onPress={() => router.push('/auth')}
            >
              <Text style={styles.primaryText}>تسجيل الدخول</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
              onPress={() => router.push('/home')}
            >
              <Text style={styles.secondaryText}>تصفح كزائر</Text>
            </Pressable>
          </>
        ) : (
          <View style={styles.loading}>
            <ActivityIndicator color="#5eead4" />
            {status === 'signedIn' && <Text style={styles.welcome}>مرحباً بعودتك</Text>}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#021c1a',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagline: {
    color: '#94a3b8',
    fontSize: 15,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  actions: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    gap: 12,
    minHeight: 116,
    justifyContent: 'flex-end',
  },
  primaryBtn: {
    backgroundColor: '#10b981',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 18,
    elevation: 6,
  },
  primaryText: {
    color: '#022c22',
    fontSize: 16,
    fontWeight: '900',
  },
  secondaryBtn: {
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(94,234,212,0.3)',
  },
  secondaryText: {
    color: '#5eead4',
    fontSize: 15,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  loading: {
    alignItems: 'center',
    gap: 10,
    paddingBottom: 24,
  },
  welcome: {
    color: '#ccfbf1',
    fontSize: 14,
    fontWeight: '700',
  },
});
