import { shareContent } from '@/lib/shareContent';
import { OasisPressable as Pressable, OasisSurface } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import { HeaderAction } from '@/components/shared/AppHeader';
import React from 'react';
import { View, Text, StyleSheet, ScrollView, Linking, Alert } from 'react-native';
import AppHeader from '@/components/shared/AppHeader';
import { useBottomNavInset } from '@/lib/bottomNav';
import {
  BadgeCheck,
  Code2,
  HeartHandshake,
  Mail,
  MessageCircle,
  Phone,
  Share2,
  Store,
  Users,
} from 'lucide-react-native';
import { useTheme } from '@/context/ThemeContext';

const DEVELOPER_NAME = 'يوسف الحازمي';
const DEVELOPER_PHONE = '0538243481';
const DEVELOPER_PHONE_INTL = '966538243481';
const DEVELOPER_EMAIL = 'support@hayna.app';
const APP_VERSION = '2.6.0';

export default function AboutScreen() {
  const bottomNavInset = useBottomNavInset();
  const { colors, isDark } = useTheme();
  const actionColor = isDark ? colors.background : '#FFFFFF';

  const handleWhatsApp = () => {
    const msg = encodeURIComponent(
      'مرحباً م. يوسف الحازمي، يسعدني التواصل معك بخصوص منصة حيّنا المجتمعية.'
    );
    Linking.openURL(`https://wa.me/${DEVELOPER_PHONE_INTL}?text=${msg}`).catch(() => {
      Alert.alert('تعذّر فتح واتساب', `يمكنك التواصل على الرقم ${DEVELOPER_PHONE}`);
    });
  };

  const handleCall = () => {
    Linking.openURL(`tel:${DEVELOPER_PHONE}`).catch(() => {
      Alert.alert('تعذّر بدء الاتصال', `رقم التواصل: ${DEVELOPER_PHONE}`);
    });
  };

  const handleEmail = () => {
    Linking.openURL(
      `mailto:${DEVELOPER_EMAIL}?subject=${encodeURIComponent('استفسار بخصوص منصة حيّنا')}`
    ).catch(() => {
      Alert.alert('تعذّر فتح البريد', `يمكنك مراسلتنا على ${DEVELOPER_EMAIL}`);
    });
  };

  const handleShareApp = async () => {
    try {
      await shareContent({
        title: 'منصة حيّنا',
        message: 'منصة حيّنا 🇸🇦 — مجتمع الحي وخدماته وسوقه في مكان واحد.\\nhttps://appksatest.vercel.app',
      });
    } catch {
      Alert.alert('تعذّرت المشاركة', 'يمكنك مشاركة رابط المنصة يدويًا: https://appksatest.vercel.app');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppHeader
        variant="sub"
        title="عن حيّنا"
        subtitle="رسالتنا، مزايا المنصة، وفريق التطوير"
        fallbackRoute="/more"
        rightAction={
          <HeaderAction
            style={styles.headerAction}
            onPress={handleShareApp}
            accessibilityRole="button"
            accessibilityLabel="مشاركة منصة حيّنا"
            accessibilityHint="فتح خيارات مشاركة رابط المنصة"
          >
            <Share2 size={18} color={colors.primary} />
          </HeaderAction>
        }
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomNavInset + 24 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.content, { paddingHorizontal: 16 }]}>
          <OasisSurface oasisSurface="card" style={[styles.brandCard, { backgroundColor: colors.live, borderColor: colors.live }]}>
            <View style={styles.brandIcon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <HeartHandshake size={30} color="#FFFFFF" />
            </View>
            <Text accessibilityRole="header" style={styles.brandTitle}>حيّنا | Hayna</Text>
            <Text style={styles.brandSubtitle}>مجتمعك يبدأ من هنا</Text>
            <View style={styles.versionPill}>
              <Text style={styles.versionText}>الإصدار {APP_VERSION}</Text>
            </View>
          </OasisSurface>

          <OasisSurface oasisSurface="card" style={[styles.introCard, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <View style={[styles.introAccent, { backgroundColor: colors.primary }]} />
            <View style={styles.introCopy}>
              <Text accessibilityRole="header" style={[styles.introTitle, { color: colors.ink }]}>أهلًا بك في حيّنا 👋</Text>
              <Text style={[styles.introText, { color: colors.muted }]}>
                مساحة تجمع أهل الحي للتواصل والتكافل، وتبادل الخدمات والمنتجات المحلية بسهولة، بهدف تقوية روابط الجيرة.
              </Text>
              <Text style={[styles.introMeta, { color: colors.primary }]}>منصة مجتمعية سعودية 🇸🇦</Text>
            </View>
          </OasisSurface>

          <OasisSurface oasisSurface="card" style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.ink }]}>ماذا تجد في حيّنا؟</Text>
            <View style={styles.featureRow}>
              <OasisSurface oasisSurface="icon" style={[styles.featureIcon, { backgroundColor: colors.soft }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Users size={21} color={colors.primary} />
              </OasisSurface>
              <View style={styles.featureCopy}>
                <Text style={[styles.featureTitle, { color: colors.ink }]}>مجتمع الحي</Text>
                <Text style={[styles.featureText, { color: colors.muted }]}>أسئلة ومشاركة ومساعدة بين الجيران.</Text>
              </View>
            </View>
            <View style={styles.featureRow}>
              <OasisSurface oasisSurface="icon" style={[styles.featureIcon, { backgroundColor: colors.soft }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Store size={21} color={colors.primary} />
              </OasisSurface>
              <View style={styles.featureCopy}>
                <Text style={[styles.featureTitle, { color: colors.ink }]}>السوق والخدمات</Text>
                <Text style={[styles.featureText, { color: colors.muted }]}>تعرّف على المتاجر والخدمات المحلية.</Text>
              </View>
            </View>
          </OasisSurface>

          <OasisSurface oasisSurface="card" style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.ink }]}>المطور والمؤسس</Text>
            <OasisSurface oasisSurface="card" style={[styles.developerCard, { backgroundColor: colors.background, borderColor: colors.line }]}>
              <View style={[styles.avatar, { backgroundColor: colors.deep }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Code2 size={26} color="#FFFFFF" />
              </View>
              <View style={styles.developerInfo}>
                <View style={styles.nameRow}>
                  <Text style={[styles.developerName, { color: colors.ink }]}>م. {DEVELOPER_NAME}</Text>
                  <BadgeCheck size={18} color={colors.primary} />
                </View>
                <Text style={[styles.developerRole, { color: colors.muted }]}>تطوير وهندسة منصة حيّنا</Text>
                <Text style={[styles.developerPhone, { color: colors.primary }]} accessibilityLabel={`رقم الهاتف ${DEVELOPER_PHONE}`} writingDirection="ltr">{DEVELOPER_PHONE}</Text>
              </View>
            </OasisSurface>

            <Pressable
              oasisKind="plain"
              style={[styles.whatsappButton, { backgroundColor: colors.primary }]}
              onPress={handleWhatsApp}
              accessibilityRole="button"
              accessibilityLabel="تواصل عبر واتساب"
              accessibilityHint="فتح محادثة مع مطور منصة حيّنا"
            >
              <MessageCircle size={20} color={actionColor} />
              <Text style={[styles.whatsappButtonText, { color: actionColor }]}>تواصل عبر واتساب</Text>
            </Pressable>

            <View style={styles.secondaryActions}>
              <Pressable oasisKind="plain" style={[styles.secondaryButton, { backgroundColor: colors.soft }]} onPress={handleCall} accessibilityRole="button" accessibilityLabel="اتصال بالمطور" accessibilityHint="بدء اتصال هاتفي">
                <Phone size={17} color={colors.primary} />
                <Text style={[styles.secondaryText, { color: colors.primary }]}>اتصال</Text>
              </Pressable>
              <Pressable oasisKind="plain" style={[styles.secondaryButton, { backgroundColor: colors.soft }]} onPress={handleEmail} accessibilityRole="button" accessibilityLabel="مراسلة المطور بالبريد" accessibilityHint="فتح تطبيق البريد برسالة جديدة">
                <Mail size={17} color={colors.primary} />
                <Text style={[styles.secondaryText, { color: colors.primary }]}>البريد</Text>
              </Pressable>
              <Pressable oasisKind="plain" style={[styles.secondaryButton, { backgroundColor: colors.soft }]} onPress={handleShareApp} accessibilityRole="button" accessibilityLabel="مشاركة حيّنا" accessibilityHint="فتح خيارات مشاركة رابط التطبيق">
                <Share2 size={17} color={colors.primary} />
                <Text style={[styles.secondaryText, { color: colors.primary }]}>مشاركة</Text>
              </Pressable>
            </View>
          </OasisSurface>

          <Text style={[styles.footer, { color: colors.muted }]}>حيّنا — مجتمع أقرب لبعض · © {new Date().getFullYear()}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%' },
  scroll: { paddingTop: 16 },
  content: { width: '100%', maxWidth: 760, alignSelf: 'center', gap: 16 },
  headerAction: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  brandCard: { alignItems: 'center', borderRadius: 22, paddingVertical: 22, paddingHorizontal: 18, gap: 6 },
  brandIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  brandTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', letterSpacing: 0.1, textAlign: 'center' },
  brandSubtitle: { color: '#D7F5E8', fontSize: 14, lineHeight: 20, fontWeight: '600', textAlign: 'center' },
  versionPill: { marginTop: 8, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: OASIS.radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  versionText: { color: '#FFFFFF', fontSize: 12, lineHeight: 16, fontWeight: '700' },
  introCard: { flexDirection: 'row-reverse', alignItems: 'stretch', borderWidth: 1, borderRadius: OASIS.radius.card + 4, padding: 16, gap: 12 },
  introAccent: { width: 4, borderRadius: 4 },
  introCopy: { flex: 1, alignItems: 'flex-end', gap: 6 },
  introTitle: { textAlign: 'right', fontSize: 16, lineHeight: 24, fontWeight: '800' },
  introText: { textAlign: 'right', fontSize: 14, lineHeight: 24 },
  introMeta: { textAlign: 'right', fontSize: 12.5, lineHeight: 18, fontWeight: '700', marginTop: 4 },
  section: { borderWidth: 1, borderRadius: OASIS.radius.card + 4, padding: 18, gap: 14 },
  sectionTitle: { textAlign: 'right', fontSize: 16, lineHeight: 23, fontWeight: '800' },
  featureRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  featureIcon: { width: 44, minWidth: 44, minHeight: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  featureCopy: { flex: 1, minWidth: 0, alignItems: 'flex-end', gap: 3 },
  featureTitle: { fontSize: 14, lineHeight: 21, fontWeight: '700', textAlign: 'right' },
  featureText: { fontSize: 13, lineHeight: 21, textAlign: 'right' },
  developerCard: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: OASIS.radius.card, padding: 12 },
  avatar: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  developerInfo: { flex: 1, minWidth: 0, alignItems: 'flex-end', gap: 4 },
  nameRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  developerName: { fontSize: 14, lineHeight: 21, fontWeight: '800', textAlign: 'right' },
  developerRole: { fontSize: 12.5, lineHeight: 18, textAlign: 'right' },
  developerPhone: { fontSize: 13, lineHeight: 19, fontWeight: '700', letterSpacing: 0.3, textAlign: 'left' },
  whatsappButton: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 9, minHeight: 52, borderRadius: 16, paddingHorizontal: 16, marginTop: 2 },
  whatsappButtonText: { fontSize: 14, lineHeight: 21, fontWeight: '800' },
  secondaryActions: { flexDirection: 'row-reverse', gap: 8 },
  secondaryButton: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 48, borderRadius: 14, paddingHorizontal: 8, paddingVertical: 10 },
  secondaryText: { fontSize: 12, lineHeight: 18, fontWeight: '700' },
  footer: { textAlign: 'center', fontSize: 12, lineHeight: 18, paddingVertical: 8 },
});
