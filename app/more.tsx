import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { router } from 'expo-router';
import {
  UserRound, Settings, Bell, Heart, Store, Map, MessageCircle,
  ShieldCheck, CircleHelp, ChevronLeft, LogIn, ShoppingBag,
  Compass, CarFront, SlidersHorizontal
} from 'lucide-react-native';

const items = [
  { title: 'الملف الشخصي', subtitle: 'بياناتك ونشاطك في حيّنا', href: '/profile', Icon: UserRound },
  { title: 'الإشعارات', subtitle: 'آخر التنبيهات والتحديثات', href: '/notifications', Icon: Bell },
  { title: 'المفضلة', subtitle: 'العناصر التي حفظتها', href: '/favorites', Icon: Heart },
  { title: 'سوق الحي', subtitle: 'المنتجات والخدمات القريبة', href: '/market', Icon: ShoppingBag },
  { title: 'دليل الأعمال', subtitle: 'المتاجر ومقدمو الخدمات', href: '/directory', Icon: Store },
  { title: 'خريطة الحي', subtitle: 'استكشف ما حولك', href: '/map', Icon: Map },
  { title: 'أسئلة الجيران', subtitle: 'الاستفسارات وتجارب أهل الحي', href: '/questions', Icon: MessageCircle },
  { title: 'توصيل المدارس', subtitle: 'المشاوير والمقاعد المشتركة', href: '/carpooling', Icon: CarFront },
];

const accountItems = [
  { title: 'تخصيص الملف الشخصي', subtitle: 'تحكم في أقسام وهوية ملفك', href: '/profile-customization', Icon: SlidersHorizontal },
  { title: 'الإعدادات', subtitle: 'الحساب والخصوصية والتفضيلات', href: '/settings', Icon: Settings },
];

function Row({ item, last = false }: { item: any; last?: boolean }) {
  const Icon = item.Icon;
  return (
    <Pressable
      onPress={() => router.push(item.href as any)}
      style={({ pressed }) => [styles.row, !last && styles.border, pressed && styles.pressed]}
    >
      <View style={styles.iconBox}><Icon size={20} color="#047857" /></View>
      <View style={styles.copy}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.subtitle}>{item.subtitle}</Text>
      </View>
      <ChevronLeft size={18} color="#94a3b8" />
    </Pressable>
  );
}

export default function MoreScreen() {
  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.heading}>المزيد</Text>
          <Text style={styles.headingSub}>كل خدمات حيّنا في مكان واحد</Text>
        </View>
        <View style={styles.logo}><Compass size={22} color="#047857" /></View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={() => router.push('/profile' as any)} style={styles.hero}>
          <View style={styles.heroIcon}><UserRound size={26} color="#ffffff" /></View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroEyebrow}>حسابك في حيّنا</Text>
            <Text style={styles.heroTitle}>عرض الملف الشخصي</Text>
            <Text style={styles.heroSub}>إدارة معلوماتك ونشاطك وتخصيص حسابك</Text>
          </View>
          <ChevronLeft size={21} color="#ffffff" />
        </Pressable>

        <Text style={styles.sectionTitle}>خدمات حيّنا</Text>
        <View style={styles.card}>
          {items.map((item, index) => <Row key={item.title} item={item} last={index === items.length - 1} />)}
        </View>

        <Text style={styles.sectionTitle}>الحساب والتطبيق</Text>
        <View style={styles.card}>
          {accountItems.map((item, index) => <Row key={item.title} item={item} last={index === accountItems.length - 1} />)}
        </View>

        <View style={styles.infoCard}>
          <ShieldCheck size={21} color="#047857" />
          <View style={styles.infoCopy}>
            <Text style={styles.infoTitle}>الخصوصية والأمان</Text>
            <Text style={styles.infoText}>تحكم في بيانات حسابك وإعدادات الخصوصية من الإعدادات.</Text>
          </View>
        </View>

        <Pressable onPress={() => router.push('/settings' as any)} style={styles.supportButton}>
          <CircleHelp size={19} color="#334155" />
          <Text style={styles.supportText}>المساعدة والدعم</Text>
          <ChevronLeft size={18} color="#94a3b8" />
        </Pressable>

        <Pressable onPress={() => router.push('/auth' as any)} style={styles.loginButton}>
          <LogIn size={18} color="#047857" />
          <Text style={styles.loginText}>تسجيل الدخول / تبديل الحساب</Text>
        </Pressable>

        <Text style={styles.footer}>حيّنا · مجتمعك أقرب إليك</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f8fafc' },
  header: {
    minHeight: 78, paddingHorizontal: 18, paddingTop: 16, paddingBottom: 12,
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#eef2f7'
  },
  headerText: { alignItems: 'flex-end' },
  heading: { color: '#0f172a', fontSize: 22, fontWeight: '900', textAlign: 'right' },
  headingSub: { color: '#64748b', fontSize: 11, marginTop: 3, textAlign: 'right' },
  logo: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#ecfdf5', alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', padding: 16, paddingBottom: 120 },
  hero: {
    backgroundColor: '#047857', borderRadius: 22, padding: 17, flexDirection: 'row-reverse',
    alignItems: 'center', gap: 12, marginBottom: 20
  },
  heroIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  heroCopy: { flex: 1, alignItems: 'flex-end' },
  heroEyebrow: { color: '#a7f3d0', fontSize: 10, fontWeight: '800' },
  heroTitle: { color: '#ffffff', fontSize: 17, fontWeight: '900', marginTop: 2, textAlign: 'right' },
  heroSub: { color: '#d1fae5', fontSize: 10.5, marginTop: 4, textAlign: 'right' },
  sectionTitle: { color: '#0f172a', fontSize: 14, fontWeight: '900', textAlign: 'right', marginBottom: 9, marginTop: 2 },
  card: { backgroundColor: '#ffffff', borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden', marginBottom: 18 },
  row: { minHeight: 69, paddingHorizontal: 13, paddingVertical: 11, flexDirection: 'row-reverse', alignItems: 'center', gap: 11 },
  border: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  pressed: { backgroundColor: '#f8fafc', opacity: 0.78 },
  iconBox: { width: 43, height: 43, borderRadius: 14, backgroundColor: '#ecfdf5', alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, alignItems: 'flex-end' },
  title: { color: '#0f172a', fontSize: 13, fontWeight: '900', textAlign: 'right' },
  subtitle: { color: '#64748b', fontSize: 10.5, marginTop: 4, textAlign: 'right' },
  infoCard: { padding: 15, backgroundColor: '#ecfdf5', borderRadius: 18, flexDirection: 'row-reverse', alignItems: 'center', gap: 11, marginBottom: 12 },
  infoCopy: { flex: 1, alignItems: 'flex-end' },
  infoTitle: { color: '#065f46', fontSize: 12.5, fontWeight: '900', textAlign: 'right' },
  infoText: { color: '#047857', fontSize: 10.5, lineHeight: 17, marginTop: 3, textAlign: 'right' },
  supportButton: { minHeight: 55, borderRadius: 16, borderWidth: 1, borderColor: '#e2e8f0', backgroundColor: '#ffffff', paddingHorizontal: 14, flexDirection: 'row-reverse', alignItems: 'center', gap: 10, marginBottom: 10 },
  supportText: { flex: 1, color: '#334155', fontSize: 12.5, fontWeight: '800', textAlign: 'right' },
  loginButton: { minHeight: 52, borderRadius: 16, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#a7f3d0', flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8 },
  loginText: { color: '#047857', fontSize: 12.5, fontWeight: '900' },
  footer: { color: '#94a3b8', fontSize: 10.5, textAlign: 'center', marginTop: 22 }
});
