import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft, Home, MapPin, Sparkles, Users } from 'lucide-react-native';
import Landing3D from '@/components/Landing3D';

export default function Index() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) {
        setSignedIn(true);
        setTimeout(() => router.replace('/home'), 500);
      } else {
        setCheckingSession(false);
      }
    });
  }, []);

  if (signedIn || checkingSession) {
    return (
      <View style={styles.loading}>
        <LinearGradient colors={['#061a16', '#07352d', '#0a1715']} style={StyleSheet.absoluteFillObject} />
        <View style={styles.loadingLogo}><Home size={30} color="#d7fff3" /></View>
        {signedIn ? <Text style={styles.loadingText}>مرحباً بك مجدداً في حيّنا</Text> : <ActivityIndicator color="#63e6be" />}
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <LinearGradient
        colors={['#061a16', '#082c25', '#061514']}
        style={StyleSheet.absoluteFillObject}
      />

      <View pointerEvents="none" style={styles.glowOne} />
      <View pointerEvents="none" style={styles.glowTwo} />

      <View style={styles.nav}>
        <View style={styles.brand}>
          <View style={styles.logo}><Home size={22} color="#eafff8" /></View>
          <Text style={styles.brandText}>حيّنا</Text>
        </View>
        <Pressable onPress={() => router.push('/auth')} style={styles.navButton}>
          <Text style={styles.navButtonText}>دخول</Text>
        </Pressable>
      </View>

      <View style={styles.hero}>
        <View style={styles.copy}>
          <View style={styles.eyebrow}>
            <Sparkles size={14} color="#63e6be" />
            <Text style={styles.eyebrowText}>مساحتك الرقمية في الحي</Text>
          </View>

          <Text style={styles.title}>
            <Text style={styles.titleAccent}>حيّنا</Text>{'\n'}أقرب من مجرد تطبيق.
          </Text>

          <Text style={styles.subtitle}>
            تعرّف على جيرانك، اكتشف ما حولك، وابقَ على اتصال بكل ما يهم حيّك — ببساطة وخصوصية.
          </Text>

          <View style={styles.actions}>
            <Pressable onPress={() => router.push('/auth')} style={styles.primary}>
              <LinearGradient colors={['#34d399', '#14b8a6']} style={styles.primaryGradient}>
                <Text style={styles.primaryText}>ابدأ مع حيّنا</Text>
                <ArrowLeft size={18} color="#05251f" />
              </LinearGradient>
            </Pressable>
            <Pressable onPress={() => router.push('/home')} style={styles.secondary}>
              <Text style={styles.secondaryText}>استكشف كزائر</Text>
            </Pressable>
          </View>

          <View style={styles.trustRow}>
            <View style={styles.trustIcon}><MapPin size={15} color="#8ff5d4" /></View>
            <Text style={styles.trustText}>حيّك أولاً · مجتمع محلي · تجربة خفيفة</Text>
          </View>
        </View>

        <View style={styles.visual}>
          <Landing3D />
          <View style={styles.orbitLabel}>
            <View style={styles.liveDot} />
            <Text style={styles.orbitText}>حيّك حولك، الآن</Text>
          </View>
        </View>
      </View>

      <View style={styles.bottom}>
        <View style={styles.miniStat}>
          <Users size={17} color="#63e6be" />
          <Text style={styles.miniText}>جيرانك في مكان واحد</Text>
        </View>
        <Text style={styles.bottomHint}>صُمّم ليكون سريعاً وهادئاً على جهازك</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, minHeight: Platform.OS === 'web' ? '100vh' as any : undefined, backgroundColor: '#061514', overflow: 'hidden' },
  nav: { height: 82, paddingHorizontal: '6%', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', zIndex: 5 },
  brand: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  logo: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(52,211,153,.13)', borderWidth: 1, borderColor: 'rgba(99,230,190,.22)' },
  brandText: { color: '#effff9', fontSize: 22, fontWeight: '800' },
  navButton: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(180,255,232,.18)', backgroundColor: 'rgba(255,255,255,.035)' },
  navButtonText: { color: '#d7fff3', fontWeight: '700', fontSize: 14 },
  hero: { flex: 1, maxWidth: 1240, width: '88%', alignSelf: 'center', flexDirection: 'row-reverse', alignItems: 'center', gap: 24, zIndex: 2 },
  copy: { flex: 1, alignItems: 'flex-end' },
  visual: { flex: 1.05, height: 560, minHeight: 420, position: 'relative' },
  eyebrow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(52,211,153,.08)', borderWidth: 1, borderColor: 'rgba(99,230,190,.16)', marginBottom: 20 },
  eyebrowText: { color: '#8ff5d4', fontSize: 13, fontWeight: '700' },
  title: { color: '#f1fffb', fontSize: 58, lineHeight: 70, fontWeight: '900', textAlign: 'right', letterSpacing: -1 },
  titleAccent: { color: '#63e6be' },
  subtitle: { color: '#a7c3bc', fontSize: 17, lineHeight: 29, maxWidth: 570, textAlign: 'right', marginTop: 20 },
  actions: { flexDirection: 'row-reverse', gap: 10, marginTop: 30 },
  primary: { borderRadius: 15, overflow: 'hidden' },
  primaryGradient: { minWidth: 160, paddingHorizontal: 20, height: 52, flexDirection: 'row-reverse', gap: 10, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#05251f', fontSize: 15, fontWeight: '900' },
  secondary: { height: 52, paddingHorizontal: 20, borderRadius: 15, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(180,255,232,.16)', backgroundColor: 'rgba(255,255,255,.035)' },
  secondaryText: { color: '#d9f9ef', fontWeight: '800', fontSize: 14 },
  trustRow: { marginTop: 22, flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  trustIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(99,230,190,.08)' },
  trustText: { color: '#78958e', fontSize: 12 },
  orbitLabel: { position: 'absolute', bottom: 55, left: 35, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, backgroundColor: 'rgba(5,25,21,.72)', borderWidth: 1, borderColor: 'rgba(99,230,190,.14)' },
  liveDot: { width: 7, height: 7, borderRadius: 7, backgroundColor: '#63e6be' },
  orbitText: { color: '#a8dcd0', fontSize: 11, fontWeight: '700' },
  bottom: { height: 72, paddingHorizontal: '6%', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', zIndex: 3, borderTopWidth: 1, borderTopColor: 'rgba(180,255,232,.07)' },
  miniStat: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  miniText: { color: '#a8c8c0', fontSize: 12, fontWeight: '700' },
  bottomHint: { color: '#526e67', fontSize: 11 },
  glowOne: { position: 'absolute', width: 520, height: 520, borderRadius: 520, backgroundColor: 'rgba(16,185,129,.09)', top: -250, left: -120 },
  glowTwo: { position: 'absolute', width: 460, height: 460, borderRadius: 460, backgroundColor: 'rgba(20,184,166,.06)', bottom: -260, right: -130 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingLogo: { width: 62, height: 62, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(52,211,153,.13)', marginBottom: 14 },
  loadingText: { color: '#d7fff3', fontSize: 16, fontWeight: '700' },
});
