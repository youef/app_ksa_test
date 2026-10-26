import { OasisPressable as Pressable, OasisSurface } from '@/components/oasis/OasisPrimitives';
import { OASIS } from '@/lib/oasis';
import { HeaderAction } from '@/components/shared/AppHeader';
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, Linking, Alert, Share } from 'react-native';
import AppHeader from '@/components/shared/AppHeader';
import { useBottomNavInset } from '@/lib/bottomNav';
import {
  BadgeCheck,
  Check,
  Code2,
  Copy,
  Globe,
  HeartHandshake,
  Mail,
  MessageCircle,
  Phone,
  Share2,
  Store,
  Users,
} from 'lucide-react-native';

const DEVELOPER_NAME = 'يوسف الحازمي';
const DEVELOPER_PHONE = '0538243481';
const DEVELOPER_PHONE_INTL = '966538243481';
const DEVELOPER_EMAIL = 'support@hayna.app';
const APP_VERSION = '2.6.0';

export default function AboutScreen() {
  const bottomNavInset = useBottomNavInset();
  const [copied, setCopied] = useState(false);

  const handleWhatsApp = () => {
    const msg = encodeURIComponent(
      'مرحباً م. يوسف الحازمي، يسعدني التواصل معك بخصوص منصة حيّنا المجتمعية.'
    );
    Linking.openURL(`https://wa.me/${DEVELOPER_PHONE_INTL}?text=${msg}`).catch(() => {
      Alert.alert('رقم الواتساب', DEVELOPER_PHONE);
    });
  };

  const handleCall = () => {
    Linking.openURL(`tel:${DEVELOPER_PHONE}`).catch(() => {
      Alert.alert('رقم الاتصال', DEVELOPER_PHONE);
    });
  };

  const handleEmail = () => {
    Linking.openURL(
      `mailto:${DEVELOPER_EMAIL}?subject=${encodeURIComponent('استفسار بخصوص منصة حيّنا')}`
    ).catch(() => {});
  };

  const handleCopyPhone = async () => {
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(DEVELOPER_PHONE);
      } else {
        Alert.alert('رقم التواصل', DEVELOPER_PHONE);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      Alert.alert('رقم التواصل', DEVELOPER_PHONE);
    }
  };

  const handleShareApp = async () => {
    try {
      await Share.share({
        title: 'منصة حيّنا',
        message: 'منصة حيّنا 🇸🇦 — مجتمع الحي وخدماته وسوقه في مكان واحد.\nhttps://appksatest.vercel.app',
      });
    } catch {}
  };

  return (
    <View style={styles.container}>
      <AppHeader
        variant="sub"
        title="حول المنصة والمطور"
        subtitle="معلومات مختصرة وتواصل مباشر"
        fallbackRoute="/more"
        rightAction={
          <HeaderAction
            style={styles.headerAction}
            onPress={handleShareApp}
            accessibilityRole="button"
            accessibilityLabel="مشاركة المنصة"
          >
            <Share2 size={18} color="#075e54" />
          </HeaderAction>
        }
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomNavInset + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.content}>
          <OasisSurface oasisSurface="card" style={styles.brandCard}>
            <View style={styles.brandIcon}>
              <HeartHandshake size={27} color={OASIS.colors.surface} />
            </View>
            <Text style={styles.brandTitle}>حيّنا | Hayna</Text>
            <Text style={styles.brandSubtitle}>مجتمعك يبدأ من هنا</Text>
            <View style={styles.versionPill}>
              <Text style={styles.versionText}>الإصدار {APP_VERSION}</Text>
            </View>
          </OasisSurface>

          <View style={styles.introBubble}>
            <Text style={styles.introTitle}>أهلًا بك في حيّنا 👋</Text>
            <Text style={styles.introText}>
              مساحة تجمع أهل الحي للتواصل والتكافل، وتبادل الخدمات والمنتجات المحلية بسهولة، بهدف تقوية روابط الجيرة.
            </Text>
            <Text style={styles.bubbleTime}>منصة مجتمعية سعودية 🇸🇦</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ماذا تجد في حيّنا؟</Text>
            <View style={styles.featureRow}>
              <OasisSurface oasisSurface="icon" style={styles.featureIcon}><Users size={19} color="#075e54" /></OasisSurface>
              <View style={styles.featureCopy}>
                <Text style={styles.featureTitle}>مجتمع الحي</Text>
                <Text style={styles.featureText}>أسئلة ومشاركة ومساعدة بين الجيران.</Text>
              </View>
            </View>
            <View style={styles.featureRow}>
              <OasisSurface oasisSurface="icon" style={styles.featureIcon}><Store size={19} color="#075e54" /></OasisSurface>
              <View style={styles.featureCopy}>
                <Text style={styles.featureTitle}>السوق والخدمات</Text>
                <Text style={styles.featureText}>تعرّف على المتاجر والخدمات المحلية.</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>المطور والمؤسس</Text>
            <OasisSurface oasisSurface="card" style={styles.developerCard}>
              <View style={styles.avatar}><Code2 size={25} color={OASIS.colors.surface} /></View>
              <View style={styles.developerInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.developerName}>م. {DEVELOPER_NAME}</Text>
                  <BadgeCheck size={17} color={OASIS.colors.primary} />
                </View>
                <Text style={styles.developerRole}>تطوير وهندسة منصة حيّنا</Text>
                <Text style={styles.developerPhone}>{DEVELOPER_PHONE}</Text>
              </View>
              <Pressable oasisKind="icon" onPress={handleCopyPhone} style={styles.copyButton} accessibilityRole="button" accessibilityLabel="نسخ رقم التواصل">
                {copied ? <Check size={17} color="#075e54" /> : <Copy size={17} color="#075e54" />}
              </Pressable>
            </OasisSurface>

            <Pressable oasisKind="action" style={styles.whatsappButton} onPress={handleWhatsApp} accessibilityRole="button">
              <MessageCircle size={20} color={OASIS.colors.surface} />
              <Text style={styles.whatsappButtonText}>تواصل عبر واتساب</Text>
            </Pressable>

            <View style={styles.secondaryActions}>
              <Pressable oasisKind="action" style={styles.secondaryButton} onPress={handleCall} accessibilityRole="button">
                <Phone size={17} color="#075e54" />
                <Text style={styles.secondaryText}>اتصال</Text>
              </Pressable>
              <Pressable oasisKind="action" style={styles.secondaryButton} onPress={handleEmail} accessibilityRole="button">
                <Mail size={17} color="#075e54" />
                <Text style={styles.secondaryText}>البريد</Text>
              </Pressable>
              <Pressable oasisKind="action" style={styles.secondaryButton} onPress={handleShareApp} accessibilityRole="button">
                <Globe size={17} color="#075e54" />
                <Text style={styles.secondaryText}>مشاركة</Text>
              </Pressable>
            </View>
          </View>

          <Text style={styles.footer}>حيّنا — مجتمع أقرب لبعض · © {new Date().getFullYear()}</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', backgroundColor: 'transparent' },
  scroll: { paddingTop: 12 },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 14, gap: 12 },
  headerAction: {
    width: 36, height: 36, borderRadius: 14, backgroundColor: '#e6f4ee',
    alignItems: 'center', justifyContent: 'center',
  },
  brandCard: {
    alignItems: 'center', backgroundColor: '#075e54', borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 16, gap: 5,
  },
  brandIcon: {
    width: 54, height: 54, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 3,
  },
  brandTitle: { color: OASIS.colors.surface, fontSize: 21, fontWeight: '700' },
  brandSubtitle: { color: '#d7f5e8', fontSize: 13, fontWeight: '600' },
  versionPill: { marginTop: 5, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 },
  versionText: { color: OASIS.colors.surface, fontSize: 11, fontWeight: '700' },
  introBubble: {
    alignSelf: 'flex-start', width: '96%', backgroundColor: OASIS.colors.surface, borderRadius: 14,
    borderTopRightRadius: 4, padding: 14, borderWidth: 1, borderColor: '#e4ebe7',
  },
  introTitle: { textAlign: 'right', color: '#1f2937', fontSize: 14, fontWeight: '700', marginBottom: 5 },
  introText: { textAlign: 'right', color: OASIS.colors.muted, fontSize: 12.5, lineHeight: 20 },
  bubbleTime: { textAlign: 'left', color: '#94a3b8', fontSize: 11, marginTop: 8 },
  section: { backgroundColor: OASIS.colors.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#e5ece8', gap: 12 },
  sectionTitle: { textAlign: 'right', fontSize: 14, fontWeight: '700', color: '#1f2937' },
  featureRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  featureIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#e8f5ef', alignItems: 'center', justifyContent: 'center' },
  featureCopy: { flex: 1, alignItems: 'flex-end', gap: 2 },
  featureTitle: { color: '#1f2937', fontSize: 12.5, fontWeight: '600' },
  featureText: { color: OASIS.colors.muted, fontSize: 11.5, textAlign: 'right' },
  developerCard: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#128c7e', alignItems: 'center', justifyContent: 'center' },
  developerInfo: { flex: 1, alignItems: 'flex-end', gap: 3 },
  nameRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5 },
  developerName: { color: '#1f2937', fontSize: 14, fontWeight: '700' },
  developerRole: { color: OASIS.colors.muted, fontSize: 11.5 },
  developerPhone: { color: '#075e54', fontSize: 12, fontWeight: '600', letterSpacing: 0.3 },
  copyButton: { width: 36, height: 36, borderRadius: 14, backgroundColor: '#e8f5ef', alignItems: 'center', justifyContent: 'center' },
  whatsappButton: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 9,
    backgroundColor: '#25d366', borderRadius: 12, paddingVertical: 13, marginTop: 2,
  },
  whatsappButtonText: { color: OASIS.colors.surface, fontSize: 14, fontWeight: '700' },
  secondaryActions: { flexDirection: 'row-reverse', gap: 8 },
  secondaryButton: {
    flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: '#f2f8f5', borderRadius: 10, paddingVertical: 10,
  },
  secondaryText: { color: '#075e54', fontSize: 11.5, fontWeight: '600' },
  footer: { textAlign: 'center', color: '#94a3b8', fontSize: 11, paddingVertical: 6 },
});
