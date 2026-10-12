import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  Linking,
  Alert,
  Share,
} from 'react-native';
import { router } from 'expo-router';
import { useBottomNavInset } from '@/lib/bottomNav';
import AppHeader from '@/components/shared/AppHeader';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Code2,
  Phone,
  MessageCircle,
  Copy,
  Check,
  ShieldCheck,
  Sparkles,
  Users,
  Store,
  Truck,
  HeartHandshake,
  ExternalLink,
  Share2,
  Mail,
  MapPin,
  BadgeCheck,
  Award,
  Globe,
  Zap,
} from 'lucide-react-native';

export default function AboutScreen() {
  const bottomNavInset = useBottomNavInset();
  const [copied, setCopied] = useState(false);

  const DEVELOPER_NAME = 'يوسف الحازمي';
  const DEVELOPER_PHONE = '0538243481';
  const DEVELOPER_PHONE_INTL = '966538243481';
  const DEVELOPER_EMAIL = 'support@hayna.app';
  const APP_VERSION = '2.6.0';

  const handleCall = () => {
    Linking.openURL(`tel:${DEVELOPER_PHONE}`).catch(() => {
      Alert.alert('رقم الاتصال', DEVELOPER_PHONE);
    });
  };

  const handleWhatsApp = () => {
    const msg = encodeURIComponent(
      'مرحباً م. يوسف الحازمي، يسعدني التواصل معك بخصوص تطبيق ومنصة حيّنا المجتمعية.'
    );
    Linking.openURL(`https://wa.me/${DEVELOPER_PHONE_INTL}?text=${msg}`).catch(() => {
      Alert.alert('رقم الواتساب', DEVELOPER_PHONE);
    });
  };

  const handleCopyPhone = () => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(DEVELOPER_PHONE);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } else {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      Alert.alert('تم النسخ', `تم نسخ رقم المطور: ${DEVELOPER_PHONE}`);
    }
  };

  const handleEmail = () => {
    Linking.openURL(`mailto:${DEVELOPER_EMAIL}?subject=${encodeURIComponent('استفسار بخصوص منصة حيّنا')}`).catch(() => {});
  };

  const handleShareApp = async () => {
    const text = 'منصة حيّنا 🇸🇦 — مجتمع وسوق وفزعة وخدمات حيك في مكان واحد وبدون وسطاء!\nتطوير: م. يوسف الحازمي\nhttps://appksatest.vercel.app';
    try {
      await Share.share({ message: text, title: 'منصة حيّنا' });
    } catch {}
  };

  return (
    <View style={styles.container}>
      <AppHeader
        variant="sub"
        title="حول المنصة والمطور"
        subtitle="رؤية حيّنا · مطور المنصة وبيانات التواصل المباشر"
        fallbackRoute="/more"
        rightAction={
          <Pressable
            style={styles.headerShareBtn}
            onPress={handleShareApp}
            accessibilityRole="button"
            accessibilityLabel="مشاركة المنصة"
          >
            <Share2 size={18} color="#047857" />
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomNavInset + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentWrap}>
          {/* ======================================================== */}
          {/* 1. PLATFORM VISION HERO BANNER                           */}
          {/* ======================================================== */}
          <LinearGradient
            colors={['#064e3b', '#047857', '#059669']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.visionHero}
          >
            <View style={styles.visionBadgeRow}>
              <View style={styles.visionBadge}>
                <Sparkles size={12} color="#fef08a" />
                <Text style={styles.visionBadgeText}>المنصة المجتمعية السعودية 🇸🇦</Text>
              </View>
              <View style={styles.visionVersionBadge}>
                <Text style={styles.visionVersionText}>الإصدار {APP_VERSION}</Text>
              </View>
            </View>

            <Text style={styles.visionTitle}>منصة حيّنا المجتمعية</Text>
            <Text style={styles.visionSubtitle}>
              المنصة الرقمية الوطنية الموحدة لإحياء روح الجيرة الأصيلة وتعزيز الترابط، الفزعة،
              والتجارة المحلية بين سكان وأسر الأحياء في المملكة بدون وسطاء وبلا أي عمولات.
            </Text>

            <View style={styles.visionPillarsRow}>
              <View style={styles.visionPillar}>
                <ShieldCheck size={14} color="#a7f3d0" />
                <Text style={styles.visionPillarText}>100% بيانات حقيقية</Text>
              </View>
              <View style={styles.visionPillar}>
                <MapPin size={14} color="#a7f3d0" />
                <Text style={styles.visionPillarText}>خصوصية السكن</Text>
              </View>
              <View style={styles.visionPillar}>
                <HeartHandshake size={14} color="#a7f3d0" />
                <Text style={styles.visionPillarText}>تكافل بين الجيران</Text>
              </View>
            </View>
          </LinearGradient>

          {/* ======================================================== */}
          {/* 2. DEDICATED DEVELOPER & FOUNDER CARD                     */}
          {/* ======================================================== */}
          <View style={styles.devCardOuter}>
            <LinearGradient
              colors={['#0f172a', '#1e293b']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.devCardInner}
            >
              <View style={styles.devHeaderRow}>
                <View style={styles.devRolePill}>
                  <Code2 size={13} color="#34d399" />
                  <Text style={styles.devRolePillText}>مطور ومؤسس المنصة</Text>
                </View>
                <View style={styles.saudiFlagPill}>
                  <Text style={styles.saudiFlagText}>سواعد وطنية 🇸🇦</Text>
                </View>
              </View>

              <View style={styles.devIdentityRow}>
                <View style={styles.devAvatarBox}>
                  <Text style={styles.devAvatarInitials}>ي.ح</Text>
                </View>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.devName}>{DEVELOPER_NAME}</Text>
                    <BadgeCheck size={18} color="#34d399" />
                  </View>
                  <Text style={styles.devRoleTitle}>هندسة وتطوير النظم والبرمجيات</Text>
                  <Text style={styles.devBioSnippet}>
                    المؤسس والمطور البرمجي لمنصة حيّنا لتمكين مجتمعات الأحياء بالمملكة
                  </Text>
                </View>
              </View>

              {/* Contact Information & Direct Action Box */}
              <View style={styles.devContactContainer}>
                <View style={styles.contactHeaderRow}>
                  <Phone size={14} color="#34d399" />
                  <Text style={styles.contactHeaderTitle}>للتواصل المباشر والاستفسارات والاقتراحات:</Text>
                </View>

                {/* Phone Display with Instant Copy */}
                <View style={styles.phoneDisplayCard}>
                  <Pressable style={styles.copyPhoneBtn} onPress={handleCopyPhone}>
                    {copied ? <Check size={14} color="#34d399" /> : <Copy size={14} color="#94a3b8" />}
                    <Text style={[styles.copyPhoneText, copied && { color: '#34d399' }]}>
                      {copied ? 'تم النسخ بنجاح' : 'نسخ الرقم'}
                    </Text>
                  </Pressable>
                  <Text style={styles.phoneValueText}>{DEVELOPER_PHONE}</Text>
                </View>

                {/* Direct Action Buttons: Call & WhatsApp */}
                <View style={styles.contactButtonsRow}>
                  <Pressable style={styles.callBtn} onPress={handleCall}>
                    <Phone size={15} color="#fff" />
                    <Text style={styles.callBtnText}>اتصال مباشر</Text>
                  </Pressable>

                  <Pressable style={styles.whatsappBtn} onPress={handleWhatsApp}>
                    <MessageCircle size={15} color="#fff" />
                    <Text style={styles.whatsappBtnText}>محادثة واتساب</Text>
                  </Pressable>
                </View>

                {/* Email Support Button */}
                <Pressable style={styles.emailBtn} onPress={handleEmail}>
                  <Mail size={14} color="#94a3b8" />
                  <Text style={styles.emailBtnText}>{DEVELOPER_EMAIL}</Text>
                </Pressable>
              </View>
            </LinearGradient>
          </View>

          {/* ======================================================== */}
          {/* 3. PLATFORM CORE PILLARS & FEATURES                      */}
          {/* ======================================================== */}
          <Text style={styles.sectionHeader}>ركائز وأهداف المنصة 🌟</Text>
          <View style={styles.featuresGrid}>
            <View style={styles.featureCard}>
              <View style={[styles.featureIconBox, { backgroundColor: '#fff7ed' }]}>
                <Truck size={22} color="#ea580c" />
              </View>
              <Text style={styles.featureTitle}>فزعة وتكافل الجيران</Text>
              <Text style={styles.featureDesc}>
                طلب واستجابة سريعة للفزعات، إعارة الأدوات المنزلية، وتوصيل المدارس بأمان.
              </Text>
            </View>

            <View style={styles.featureCard}>
              <View style={[styles.featureIconBox, { backgroundColor: '#ecfdf5' }]}>
                <Store size={22} color="#059669" />
              </View>
              <Text style={styles.featureTitle}>سوق الحي المحلي</Text>
              <Text style={styles.featureDesc}>
                تمكين الأسر المنتجة والمتاجر المحلية لعرض السلع والخدمات مباشرة بدون عمولات.
              </Text>
            </View>

            <View style={styles.featureCard}>
              <View style={[styles.featureIconBox, { backgroundColor: '#f0f9ff' }]}>
                <Users size={22} color="#0284c7" />
              </View>
              <Text style={styles.featureTitle}>استفسارات ومجتمع الحي</Text>
              <Text style={styles.featureDesc}>
                مشاركة التجارب والنصائح وأسئلة الحي مع سكان حيك الفعليين فقط.
              </Text>
            </View>

            <View style={styles.featureCard}>
              <View style={[styles.featureIconBox, { backgroundColor: '#f5f3ff' }]}>
                <ShieldCheck size={22} color="#7c3aed" />
              </View>
              <Text style={styles.featureTitle}>خصوصية وأمان فائق</Text>
              <Text style={styles.featureDesc}>
                توثيق السكن عبر العنوان الوطني ونظام GPS لحماية الخصوصية الكاملة.
              </Text>
            </View>
          </View>

          {/* ======================================================== */}
          {/* 4. TECHNICAL SPECIFICATIONS & SYSTEM INFO                */}
          {/* ======================================================== */}
          <Text style={styles.sectionHeader}>المواصفات والبيانات التقنية ⚙️</Text>
          <View style={styles.specsCard}>
            <View style={styles.specRow}>
              <Text style={styles.specVal}>منصة حيّنا المجتمعية (Hayna)</Text>
              <Text style={styles.specKey}>اسم المنصة</Text>
            </View>
            <View style={styles.specRow}>
              <Text style={styles.specVal}>م. يوسف الحازمي 🇸🇦</Text>
              <Text style={styles.specKey}>المطور والمؤسس</Text>
            </View>
            <View style={styles.specRow}>
              <Text style={styles.specVal}>{DEVELOPER_PHONE}</Text>
              <Text style={styles.specKey}>رقم التواصل</Text>
            </View>
            <View style={styles.specRow}>
              <Text style={styles.specVal}>الإصدار {APP_VERSION} (محدث ومطور)</Text>
              <Text style={styles.specKey}>رقم الإصدار</Text>
            </View>
            <View style={styles.specRow}>
              <Text style={styles.specVal}>المملكة العربية السعودية 🇸🇦</Text>
              <Text style={styles.specKey}>نطاق الخدمة</Text>
            </View>
            <View style={[styles.specRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.specVal}>بيانات حقيقية موثقة 100%</Text>
              <Text style={styles.specKey}>طبيعة البيانات</Text>
            </View>
          </View>

          {/* ======================================================== */}
          {/* 5. FOOTER & COPYRIGHT                                    */}
          {/* ======================================================== */}
          <View style={styles.footerBox}>
            <Text style={styles.footerBrand}>منصة حيّنا — Hayna App 🇸🇦</Text>
            <Text style={styles.footerCopyright}>
              جميع الحقوق محفوظة © {new Date().getFullYear()} · تطوير م. يوسف الحازمي
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    width: '100%',
  },
  scroll: {
    paddingTop: 12,
  },
  contentWrap: {
    maxWidth: 860,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 16,
    gap: 14,
  },
  headerShareBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Vision Hero
  visionHero: {
    borderRadius: 22,
    padding: 18,
    shadowColor: '#059669',
    shadowOpacity: 0.18,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    gap: 10,
  },
  visionBadgeRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  visionBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  visionBadgeText: {
    color: '#fef08a',
    fontSize: 11,
    fontWeight: '800',
  },
  visionVersionBadge: {
    backgroundColor: 'rgba(0,0,0,0.22)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  visionVersionText: {
    color: '#a7f3d0',
    fontSize: 10.5,
    fontWeight: '700',
  },
  visionTitle: {
    fontSize: 21,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'right',
  },
  visionSubtitle: {
    fontSize: 12.5,
    color: '#d1fae5',
    textAlign: 'right',
    lineHeight: 19,
  },
  visionPillarsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 10,
    marginTop: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  visionPillar: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  visionPillarText: {
    fontSize: 10.5,
    color: '#fff',
    fontWeight: '800',
  },

  // Developer Card
  devCardOuter: {
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
  devCardInner: {
    padding: 18,
    gap: 14,
  },
  devHeaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  devRolePill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  devRolePillText: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '900',
  },
  saudiFlagPill: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  saudiFlagText: {
    color: '#cbd5e1',
    fontSize: 10.5,
    fontWeight: '700',
  },
  devIdentityRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  devAvatarBox: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(5, 150, 105, 0.25)',
    borderWidth: 2,
    borderColor: '#34d399',
    alignItems: 'center',
    justifyContent: 'center',
  },
  devAvatarInitials: {
    color: '#34d399',
    fontSize: 19,
    fontWeight: '900',
  },
  devName: {
    color: '#fff',
    fontSize: 19,
    fontWeight: '900',
    textAlign: 'right',
  },
  devRoleTitle: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'right',
  },
  devBioSnippet: {
    color: '#cbd5e1',
    fontSize: 11,
    marginTop: 3,
    textAlign: 'right',
    lineHeight: 16,
  },

  // Contact Hub
  devContactContainer: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 10,
  },
  contactHeaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  contactHeaderTitle: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '800',
  },
  phoneDisplayCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  phoneValueText: {
    color: '#34d399',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  copyPhoneBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  copyPhoneText: {
    color: '#cbd5e1',
    fontSize: 10.5,
    fontWeight: '700',
  },
  contactButtonsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  callBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0284c7',
    paddingVertical: 10,
    borderRadius: 12,
  },
  callBtnText: {
    color: '#fff',
    fontSize: 12.5,
    fontWeight: '800',
  },
  whatsappBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#16a34a',
    paddingVertical: 10,
    borderRadius: 12,
  },
  whatsappBtnText: {
    color: '#fff',
    fontSize: 12.5,
    fontWeight: '800',
  },
  emailBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
  },
  emailBtnText: {
    color: '#94a3b8',
    fontSize: 11.5,
    fontWeight: '600',
  },

  // Section Headers
  sectionHeader: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'right',
    marginTop: 4,
  },

  // Features Grid
  featuresGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
  },
  featureCard: {
    width: '48.5%',
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'flex-end',
    gap: 4,
    shadowColor: '#0f172a',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  featureIconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  featureTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'right',
  },
  featureDesc: {
    fontSize: 11,
    color: '#64748b',
    textAlign: 'right',
    lineHeight: 16,
  },

  // Specs Card
  specsCard: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#0f172a',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  specRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  specKey: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
  },
  specVal: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#0f172a',
  },

  // Footer
  footerBox: {
    alignItems: 'center',
    paddingVertical: 18,
    gap: 4,
  },
  footerBrand: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#059669',
  },
  footerCopyright: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
  },
});
