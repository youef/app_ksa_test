import { HeaderAction } from '@/components/shared/AppHeader';
import { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, House, Store, UsersRound } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import {
  FALLBACK_LOGO_URI,
  getBrandingLogo,
  getCachedBrandingLogo,
  subscribeBrandingLogo,
} from '@/lib/branding';
import AppHeader from '@/components/shared/AppHeader';

export default function Index() {
  const [signedIn, setSignedIn] = useState(false);
  const [logoUri, setLogoUri] = useState(getCachedBrandingLogo() || FALLBACK_LOGO_URI);
  const { height, width } = useWindowDimensions();
  const compact = height < 700 || width < 360;

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
    return (
      <View style={styles.loading}>
        <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
        <Image source={{ uri: logoUri }} style={styles.loadingLogo} resizeMode="contain" />
        <ActivityIndicator color="#ffffff" />
      </View>
    );
  }

  return (
    <View style={styles.page}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <AppHeader
        variant="sub"
        title="حيّنا"
        subtitle="الشبكة الاجتماعية للحي والمدينة"
        showBack={false}
        rightAction={
          <HeaderAction
            onPress={() => router.replace('/home')}
            style={styles.headerSkip}
            accessibilityRole="button"
            accessibilityLabel="تصفح كزائر"
            hitSlop={8}
          >
            <Text style={styles.headerSkipText}>تصفح كزائر</Text>
            <ArrowLeft size={14} color="#047857" />
          </HeaderAction>
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, compact && styles.contentCompact]}
        showsVerticalScrollIndicator={false}
        alwaysBounceVertical={false}
      >
        <View style={styles.intro}>
          <View style={styles.eyebrow}>
            <View style={styles.dot} />
            <Text style={styles.eyebrowText}>مجتمعك يبدأ من هنا</Text>
          </View>

          <Text style={[styles.title, compact && styles.titleCompact]}>حيّنا… أقرب لبعض</Text>
          <Text style={styles.description}>
            مكان يجمع أهل الحي، ويقرّب الجيران من بعض.
          </Text>
        </View>

        <View style={[styles.logoWrap, compact && styles.logoWrapCompact]}>
          <Image
            source={{ uri: logoUri }}
            style={[styles.logo, compact && styles.logoCompact]}
            resizeMode="contain"
            accessibilityLabel="شعار حيّنا"
          />
        </View>

        <View style={styles.features}>
          <View style={styles.feature}>
            <UsersRound size={17} color="#d1fae5" strokeWidth={2} />
            <Text style={styles.featureText}>جيرانك</Text>
          </View>
          <View style={styles.featureDivider} />
          <View style={styles.feature}>
            <Store size={17} color="#d1fae5" strokeWidth={2} />
            <Text style={styles.featureText}>سوق الحي</Text>
          </View>
          <View style={styles.featureDivider} />
          <View style={styles.feature}>
            <House size={17} color="#d1fae5" strokeWidth={2} />
            <Text style={styles.featureText}>خدمات قريبة</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={() => router.replace('/auth')}
            style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="تسجيل الدخول أو إنشاء حساب"
            hitSlop={6}
          >
            <Text style={styles.primaryButtonText}>تسجيل الدخول / إنشاء حساب</Text>
            <ArrowLeft size={17} color="#065f46" strokeWidth={2.5} />
          </Pressable>

          <Pressable
            onPress={() => router.replace('/home')}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="تصفح حيّنا كزائر دون تسجيل"
            hitSlop={6}
          >
            <Text style={styles.secondaryButtonText}>تصفح كزائر دون تسجيل</Text>
          </Pressable>

          <Text style={styles.footer}>حيّك، ناسك، وحياتك اليومية في مكان واحد</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#047857',
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: Platform.OS === 'ios' ? 28 : 22,
  },
  contentCompact: {
    paddingTop: 12,
    paddingBottom: 16,
  },
  intro: {
    width: '100%',
    alignItems: 'center',
  },
  eyebrow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.10)',
    marginBottom: 12,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#a7f3d0',
  },
  eyebrowText: {
    color: '#d1fae5',
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.4,
  },
  titleCompact: {
    fontSize: 24,
  },
  description: {
    color: '#d1fae5',
    fontSize: 13,
    lineHeight: 21,
    textAlign: 'center',
    marginTop: 8,
  },
  logoWrap: {
    width: 156,
    height: 156,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
    marginBottom: 16,
    borderRadius: 78,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  logoWrapCompact: {
    width: 128,
    height: 128,
    borderRadius: 64,
    marginTop: 12,
    marginBottom: 12,
  },
  logo: {
    width: 124,
    height: 124,
  },
  logoCompact: {
    width: 102,
    height: 102,
  },
  features: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(2,44,34,0.12)',
  },
  feature: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
  },
  featureText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  featureDivider: {
    width: 1,
    height: 18,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  actions: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    marginTop: 22,
  },
  primaryButton: {
    width: '100%',
    minHeight: 50,
    borderRadius: 14,
    paddingHorizontal: 16,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
  },
  primaryButtonText: {
    color: '#065f46',
    fontSize: 14,
    fontWeight: '900',
  },
  secondaryButton: {
    width: '100%',
    minHeight: 44,
    borderRadius: 14,
    marginTop: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  secondaryButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.84,
  },
  footer: {
    color: 'rgba(236,253,245,0.75)',
    fontSize: 10,
    textAlign: 'center',
    marginTop: 14,
  },
  headerSkip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#ecfdf5',
  },
  headerSkipText: {
    color: '#047857',
    fontSize: 11,
    fontWeight: '800',
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#047857',
  },
  loadingLogo: {
    width: 88,
    height: 88,
    marginBottom: 20,
  },
});
