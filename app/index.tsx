import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Dimensions,
  Image,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Home,
  Compass,
  Sparkles,
  ShieldCheck,
  MapPin,
  Users,
  MessageCircle,
  AlertTriangle,
  Share2,
  Layers,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  Heart,
  Building2,
  Radio,
} from 'lucide-react-native';

const { width, height } = Dimensions.get('window');

const SAUDI_REGIONS_PREVIEWS = [
  { city: 'الرياض', districts: 'الياسمين · النرجس · الملقا · حطين' },
  { city: 'جدة', districts: 'الشاطئ · الروضة · أبحر الشمالية · الزهراء' },
  { city: 'الدمام والخبر', districts: 'الشاطئ الشرقي · الحزام الذهبي · العقربية' },
  { city: 'مكة المكرمة', districts: 'العوالي · الشوقية · بطحاء قريش' },
  { city: 'المدينة المنورة', districts: 'سلطانة · قباء · العريض' },
];

export default function Index() {
  const [checkingSession, setCheckingSession] = useState(true);
  const [signedInUser, setSignedInUser] = useState<any>(null);
  const [selectedRegionIndex, setSelectedRegionIndex] = useState(0);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && data.session.user) {
        setSignedInUser(data.session.user);
        // Quick auto-redirect for existing authenticated neighbors
        setTimeout(() => {
          router.replace('/home');
        }, 1200);
      } else {
        setCheckingSession(false);
      }
    });
  }, []);

  // If already signed in: show a polished splash transition
  if (signedInUser) {
    return (
      <View style={styles.splashContainer}>
        <LinearGradient
          colors={['#042f2e', '#0f766e', '#0891b2']}
          style={StyleSheet.absoluteFillObject}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <View style={styles.splashContent}>
          <View style={styles.splashLogoCircle}>
            <Home size={44} color="#fff" />
          </View>
          <Text style={styles.splashBrand}>حيّنا</Text>
          <Text style={styles.splashSub}>مرحباً بك مجدداً بين أهل حيك 🇸🇦</Text>
          <ActivityIndicator size="small" color="#5eead4" style={{ marginTop: 24 }} />
        </View>
      </View>
    );
  }

  // If checking session initial flash
  if (checkingSession) {
    return (
      <View style={[styles.splashContainer, { backgroundColor: '#042f2e' }]}>
        <ActivityIndicator size="large" color="#0891b2" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ======================================================== */}
        {/* 1. HERO SECTION WITH SAUDI CIVIC BRANDING               */}
        {/* ======================================================== */}
        <LinearGradient
          colors={['#064e3b', '#0f766e', '#0e7490', '#0f172a']}
          style={styles.heroGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {/* Top Bar with Vision 2030 Badge */}
          <View style={styles.heroTopBar}>
            <View style={styles.visionBadge}>
              <Text style={styles.visionBadgeText}>رؤية 2030 · جودة الحياة 🇸🇦</Text>
            </View>

            <Pressable style={styles.loginHeaderBtn} onPress={() => router.push('/auth')}>
              <Text style={styles.loginHeaderBtnText}>تسجيل الدخول</Text>
            </Pressable>
          </View>

          {/* Main Hero Header */}
          <View style={styles.heroCenter}>
            <View style={styles.brandIconBox}>
              <LinearGradient colors={['#10b981', '#06b6d4']} style={styles.brandIconGradient}>
                <Home size={38} color="#fff" />
              </LinearGradient>
            </View>

            <View style={styles.platformPill}>
              <Sparkles size={14} color="#34d399" />
              <Text style={styles.platformPillText}>المنصة الذكية الأولى لأحياء المملكة</Text>
            </View>

            <Text style={styles.heroHeadline}>
              حيّـك، جيرانـك،{'\n'}وخدماتك في مكان واحد
            </Text>

            <Text style={styles.heroSubhead}>
              انضم لأكثر من 500 ألف ساكن موثق في مختلف مناطق المملكة، استفسر عن خدمات حيك، شارك الأدوات، وكن في قلب الحدث.
            </Text>

            {/* Quick Action CTAs */}
            <View style={styles.heroCtaGroup}>
              <Pressable
                style={styles.primaryCtaBtn}
                onPress={() => router.push('/auth')}
              >
                <Text style={styles.primaryCtaText}>انضم لأهل حيك الآن 🚀</Text>
                <ArrowLeft size={18} color="#fff" />
              </Pressable>

              <Pressable
                style={styles.guestCtaBtn}
                onPress={() => router.push('/home')}
              >
                <Compass size={17} color="#5eead4" />
                <Text style={styles.guestCtaText}>استكشف حيّنا كزائر (بدون تسجيل)</Text>
              </Pressable>
            </View>
          </View>

          {/* Live Saudi Neighborhoods Radar Ticker */}
          <View style={styles.radarCard}>
            <View style={styles.radarCardHeader}>
              <View style={styles.liveDot} />
              <Text style={styles.radarCardTitle}>أحياء نشطة الآن في المملكة</Text>
              <Radio size={14} color="#34d399" />
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.radarScroll}
            >
              {SAUDI_REGIONS_PREVIEWS.map((reg, idx) => (
                <Pressable
                  key={reg.city}
                  style={[
                    styles.radarPill,
                    selectedRegionIndex === idx && styles.radarPillActive,
                  ]}
                  onPress={() => setSelectedRegionIndex(idx)}
                >
                  <MapPin size={12} color={selectedRegionIndex === idx ? '#fff' : '#5eead4'} />
                  <Text
                    style={[
                      styles.radarPillCity,
                      selectedRegionIndex === idx && styles.radarPillCityActive,
                    ]}
                  >
                    {reg.city}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.radarDistrictsText}>
              الأحياء الأكثر تفاعلاً: {SAUDI_REGIONS_PREVIEWS[selectedRegionIndex].districts}
            </Text>
          </View>
        </LinearGradient>

        {/* ======================================================== */}
        {/* 2. LIVE METRICS & SOCIAL PROOF                           */}
        {/* ======================================================== */}
        <View style={styles.statsSection}>
          <View style={styles.statItem}>
            <Text style={styles.statBigNum}>+500K</Text>
            <Text style={styles.statSubText}>ساكن متفاعل 👥</Text>
          </View>
          <View style={styles.statItemDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statBigNum}>+850</Text>
            <Text style={styles.statSubText}>حي سعودي 🏘️</Text>
          </View>
          <View style={styles.statItemDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statBigNum}>99.2%</Text>
            <Text style={styles.statSubText}>إجابات موثقة ⚡</Text>
          </View>
        </View>

        {/* ======================================================== */}
        {/* 3. KEY SMART PILLARS & FEATURES                          */}
        {/* ======================================================== */}
        <View style={styles.featuresSection}>
          <Text style={styles.sectionHeading}>لماذا يعتمد الجيران على حيّنا؟</Text>
          <Text style={styles.sectionSubtitle}>
            حلول رقمية متقدمة مصممة خصيصاً لراحة أهل الحي وأمانهم
          </Text>

          {/* Feature 1: AI Instant resident archive */}
          <View style={styles.featureCard}>
            <LinearGradient colors={['#0284c7', '#0369a1']} style={styles.featureIcon}>
              <MessageCircle size={24} color="#fff" />
            </LinearGradient>
            <View style={styles.featureInfo}>
              <View style={styles.featureTitleRow}>
                <View style={styles.featureBadge}>
                  <Text style={styles.featureBadgeText}>ذكاء اصطناعي</Text>
                </View>
                <Text style={styles.featureTitle}>إجابات فورية من تجارب الجيران</Text>
              </View>
              <Text style={styles.featureBody}>
                اسأل عن أفضل السباكين، أطباء الأسنان، الصيدليات، أو مدارس الحي، وتلقَّ فوراً ملخصاً دقيقاً من تجارب أهل حيك السابقة قبل أن يرد الجيران الفعليون.
              </Text>
            </View>
          </View>

          {/* Feature 2: Emergency SOS Radar */}
          <View style={styles.featureCard}>
            <LinearGradient colors={['#dc2626', '#b91c1c']} style={styles.featureIcon}>
              <AlertTriangle size={24} color="#fff" />
            </LinearGradient>
            <View style={styles.featureInfo}>
              <View style={styles.featureTitleRow}>
                <View style={[styles.featureBadge, { backgroundColor: '#fee2e2' }]}>
                  <Text style={[styles.featureBadgeText, { color: '#dc2626' }]}>أمان فوري</Text>
                </View>
                <Text style={styles.featureTitle}>رادار طوارئ وبلاغات الحي (SOS)</Text>
              </View>
              <Text style={styles.featureBody}>
                تنبيهات فورية بأعمال الطرق، انقطاع الخدمات، أو حالات الطوارئ في محيط 2 كم لتكون وعائلتك دائماً في أمان.
              </Text>
            </View>
          </View>

          {/* Feature 3: Tool Sharing & Community Lending */}
          <View style={styles.featureCard}>
            <LinearGradient colors={['#059669', '#047857']} style={styles.featureIcon}>
              <Share2 size={24} color="#fff" />
            </LinearGradient>
            <View style={styles.featureInfo}>
              <View style={styles.featureTitleRow}>
                <View style={[styles.featureBadge, { backgroundColor: '#dcfce7' }]}>
                  <Text style={[styles.featureBadgeText, { color: '#059669' }]}>توفير وتكافل</Text>
                </View>
                <Text style={styles.featureTitle}>إعارة الأدوات ومبادرات الجيران</Text>
              </View>
              <Text style={styles.featureBody}>
                سلالم، معدات صيانة، كتب، أو أدوات حدائق. استعرها من جيرانك بسهولة دون الحاجة للشراء، وشارك بما لديك لدعم مجتمعك.
              </Text>
            </View>
          </View>

          {/* Feature 4: Verified Neighbor & National Address */}
          <View style={styles.featureCard}>
            <LinearGradient colors={['#7c3aed', '#6d28d9']} style={styles.featureIcon}>
              <ShieldCheck size={24} color="#fff" />
            </LinearGradient>
            <View style={styles.featureInfo}>
              <View style={styles.featureTitleRow}>
                <View style={[styles.featureBadge, { backgroundColor: '#f3e8ff' }]}>
                  <Text style={[styles.featureBadgeText, { color: '#7c3aed' }]}>توثيق رسمي</Text>
                </View>
                <Text style={styles.featureTitle}>شارة «ابن الحي الموثق» والعنوان الوطني</Text>
              </View>
              <Text style={styles.featureBody}>
                ربط دقيق بالرمز المختصر للعنوان الوطني السعودي وفحص جغرافي GPS للتأكد من هوية وسكن كل جار في منطقته بكل موثوقية.
              </Text>
            </View>
          </View>
        </View>

        {/* ======================================================== */}
        {/* 4. FINAL CALL TO ACTION BANNER                           */}
        {/* ======================================================== */}
        <View style={styles.finalCtaContainer}>
          <LinearGradient
            colors={['#0f172a', '#1e293b', '#0891b2']}
            style={styles.finalCtaCard}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Building2 size={36} color="#5eead4" style={{ marginBottom: 12 }} />
            <Text style={styles.finalCtaTitle}>جاهز لتكتشف أسرار حيك وتتواصل مع جيرانك؟</Text>
            <Text style={styles.finalCtaSub}>
              خطوة واحدة تفصلك عن مجتمعك المحلي في المملكة. التسجيل مجاني ويستغرق 30 ثانية فقط!
            </Text>

            <Pressable
              style={styles.finalBigBtn}
              onPress={() => router.push('/auth')}
            >
              <Text style={styles.finalBigBtnText}>أنشئ حسابك وانضم مجاناً ✨</Text>
              <ArrowLeft size={18} color="#0f172a" />
            </Pressable>

            <Pressable
              style={styles.exploreLinkBtn}
              onPress={() => router.push('/home')}
            >
              <Text style={styles.exploreLinkText}>أو تصفح التطبيق كزائر أولاً 👁️</Text>
            </Pressable>
          </LinearGradient>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerBrand}>حيّنا © 2026 — منصة الأحياء الذكية بالمملكة</Text>
          <Text style={styles.footerVision}>معاً نحو أحياء حيوية ومترابطة وفق رؤية السعودية 2030 🇸🇦</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f1d',
  },
  splashContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  splashLogoCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 2,
    borderColor: '#5eead4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  splashBrand: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 1,
  },
  splashSub: {
    color: '#ccfbf1',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 6,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  heroGradient: {
    paddingTop: Platform.OS === 'ios' ? 52 : 36,
    paddingHorizontal: 20,
    paddingBottom: 40,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
  },
  heroTopBar: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  visionBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  visionBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  loginHeaderBtn: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  loginHeaderBtnText: {
    color: '#5eead4',
    fontSize: 12,
    fontWeight: '800',
  },
  heroCenter: {
    alignItems: 'center',
    marginBottom: 24,
  },
  brandIconBox: {
    marginBottom: 14,
  },
  brandIconGradient: {
    width: 74,
    height: 74,
    borderRadius: 37,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
  },
  platformPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16,185,129,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(52,211,153,0.4)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginBottom: 16,
  },
  platformPillText: {
    color: '#34d399',
    fontSize: 12,
    fontWeight: '800',
  },
  heroHeadline: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 44,
    marginBottom: 14,
  },
  heroSubhead: {
    color: '#e2e8f0',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 23,
    paddingHorizontal: 12,
    marginBottom: 26,
    fontWeight: '500',
  },
  heroCtaGroup: {
    width: '100%',
    gap: 12,
    alignItems: 'center',
  },
  primaryCtaBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#0891b2',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 18,
    shadowColor: '#0891b2',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 14,
    elevation: 6,
  },
  primaryCtaText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  guestCtaBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1.5,
    borderColor: 'rgba(94,234,212,0.4)',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 18,
  },
  guestCtaText: {
    color: '#5eead4',
    fontSize: 14,
    fontWeight: '800',
  },
  radarCard: {
    backgroundColor: 'rgba(15,23,42,0.7)',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  radarCardHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  radarCardTitle: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    flex: 1,
    textAlign: 'right',
  },
  radarScroll: {
    flexDirection: 'row-reverse',
    gap: 8,
    paddingBottom: 8,
  },
  radarPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  radarPillActive: {
    backgroundColor: '#0891b2',
  },
  radarPillCity: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
  },
  radarPillCityActive: {
    color: '#fff',
    fontWeight: '900',
  },
  radarDistrictsText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'right',
    marginTop: 4,
  },

  // Stats Section
  statsSection: {
    flexDirection: 'row-reverse',
    backgroundColor: '#111827',
    marginHorizontal: 18,
    marginTop: -20,
    borderRadius: 22,
    paddingVertical: 18,
    paddingHorizontal: 12,
    justifyContent: 'space-around',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1f2937',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  statItem: {
    alignItems: 'center',
  },
  statBigNum: {
    color: '#38bdf8',
    fontSize: 20,
    fontWeight: '900',
  },
  statSubText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  statItemDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#1f2937',
  },

  // Features
  featuresSection: {
    paddingHorizontal: 18,
    paddingTop: 36,
  },
  sectionHeading: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 6,
  },
  sectionSubtitle: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  featureCard: {
    flexDirection: 'row-reverse',
    backgroundColor: '#111827',
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#1f2937',
    gap: 14,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  featureInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  featureTitleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
    flexWrap: 'wrap',
  },
  featureTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'right',
  },
  featureBadge: {
    backgroundColor: '#e0f2fe',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  featureBadgeText: {
    color: '#0284c7',
    fontSize: 10,
    fontWeight: '800',
  },
  featureBody: {
    color: '#94a3b8',
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'right',
    fontWeight: '500',
  },

  // Final CTA
  finalCtaContainer: {
    paddingHorizontal: 18,
    marginTop: 20,
  },
  finalCtaCard: {
    borderRadius: 28,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  finalCtaTitle: {
    color: '#fff',
    fontSize: 19,
    fontWeight: '900',
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: 8,
  },
  finalCtaSub: {
    color: '#94a3b8',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  finalBigBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#5eead4',
    width: '100%',
    paddingVertical: 15,
    borderRadius: 16,
    marginBottom: 10,
  },
  finalBigBtnText: {
    color: '#042f2e',
    fontSize: 15,
    fontWeight: '900',
  },
  exploreLinkBtn: {
    paddingVertical: 8,
  },
  exploreLinkText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
  },

  // Footer
  footer: {
    marginTop: 30,
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 20,
  },
  footerBrand: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
  },
  footerVision: {
    color: '#475569',
    fontSize: 10,
    textAlign: 'center',
  },
});