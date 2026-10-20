import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Image, Alert, Share,
  TextInput, ActivityIndicator, Linking,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  UserRound, MapPin, ShieldCheck, ChevronLeft, Settings, Bell, Share2,
  LogOut, LogIn, Sparkles, Store, BriefcaseBusiness, Map, MessageCircle,
  Sun, Code2, CarFront, Flame, Radio, Search, CircleHelp, FileText,
  LockKeyhole, Lightbulb, Phone, ExternalLink, HeartHandshake, Github,
  Database, Rocket, Globe2, X, Send, CheckCircle2, Compass, ShoppingBag,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useBottomNavInset } from '@/lib/bottomNav';
import AppHeader from '@/components/shared/AppHeader';
import { usePlatformConfig } from '@/lib/platformConfig';

type MenuLink = {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  tint: string;
  bg: string;
  onPress: () => void;
  badge?: string;
};

export default function MoreScreen() {
  const { flags } = usePlatformConfig();
  const bottomNavInset = useBottomNavInset();
  const [profile, setProfile] = useState<any>(null);
  const [hasSession, setHasSession] = useState(false);
  const [unreadNotif, setUnreadNotif] = useState(0);
  const [query, setQuery] = useState('');
  const [showIdea, setShowIdea] = useState(false);
  const [idea, setIdea] = useState('');
  const [sendingIdea, setSendingIdea] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getSession();
        const user = auth.session?.user;
        if (!alive) return;
        setHasSession(Boolean(user));
        if (!user) return;
        const [{ data: p }, { count }] = await Promise.all([
          supabase.from('profiles').select('id,display_name,username,avatar_url,is_verified,city,district').eq('id', user.id).maybeSingle(),
          supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).is('read_at', null),
        ]);
        if (alive) { setProfile(p); setUnreadNotif(count ?? 0); }
      } catch {}
    })();
    return () => { alive = false; };
  }, []);

  const open = (url: string) => Linking.openURL(url).catch(() => Alert.alert('تعذّر الفتح', 'لم نتمكن من فتح الرابط على هذا الجهاز.'));
  const shareApp = () => Share.share({ title: 'حيّنا', message: 'حيّنا 🇸🇦 — مجتمع وخدمات وسوق الحي في مكان واحد\nhttps://appksatest.vercel.app' });
  const signOut = () => Alert.alert('تسجيل الخروج', 'هل تريد تسجيل الخروج من حسابك؟', [
    { text: 'إلغاء', style: 'cancel' },
    { text: 'تسجيل الخروج', style: 'destructive', onPress: async () => { await supabase.auth.signOut(); router.replace('/auth'); } },
  ]);
  const sendIdea = async () => {
    if (!idea.trim()) return Alert.alert('اكتب اقتراحك أولاً', 'شاركنا فكرة تساعد على تطوير حيّنا.');
    setSendingIdea(true);
    try {
      const { error } = await supabase.from('reports').insert({ reason: 'اقتراح ميزة مستقبلية: ' + idea.trim(), reporter_id: profile?.id || null, target_type: 'idea' });
      if (error) throw error;
      setShowIdea(false); setIdea('');
      Alert.alert('شكراً لمساهمتك', 'وصل اقتراحك بنجاح.');
    } catch { Alert.alert('لم يتم الإرسال', 'تعذّر إرسال الاقتراح حالياً، حاول مرة أخرى.'); }
    finally { setSendingIdea(false); }
  };

  const services: MenuLink[] = [
    ...(flags.carpooling !== false ? [{ title: 'توصيل المدارس', subtitle: 'تنظيم المقاعد والمشاوير المشتركة', icon: <CarFront size={20} color="#047857" />, tint: '#047857', bg: '#ecfdf5', onPress: () => router.push('/carpooling') }] : []),
    ...(flags.urgent_alerts !== false ? [{ title: 'تنبيهات طوارئ الحي', subtitle: 'التنبيهات العاجلة لسكان الحي', icon: <Flame size={20} color="#dc2626" />, tint: '#dc2626', bg: '#fef2f2', onPress: () => router.push('/emergency-alert') }] : []),
    ...(flags.live !== false ? [{ title: 'البثوث المباشرة', subtitle: 'تابع البثوث وشارك مجتمعك', icon: <Radio size={20} color="#7c3aed" />, tint: '#7c3aed', bg: '#f5f3ff', onPress: () => router.push('/lives') }] : []),
    ...(flags.market !== false ? [{ title: 'سوق الحي', subtitle: 'منتجات وخدمات من حولك', icon: <ShoppingBag size={20} color="#047857" />, tint: '#047857', bg: '#ecfdf5', onPress: () => router.push('/market') }] : []),
    ...(flags.directory !== false ? [{ title: 'دليل المحلات والأعمال', subtitle: 'اكتشف الأنشطة التجارية القريبة', icon: <Store size={20} color="#0369a1" />, tint: '#0369a1', bg: '#eff6ff', onPress: () => router.push('/directory') }] : []),
    ...(flags.map !== false ? [{ title: 'خريطة الحي', subtitle: 'استكشف الأماكن والخدمات القريبة', icon: <Map size={20} color="#7c3aed" />, tint: '#7c3aed', bg: '#f5f3ff', onPress: () => router.push('/map') }] : []),
    ...(flags.questions !== false ? [{ title: 'أسئلة الجيران', subtitle: 'اسأل وشارك الخبرات والتوصيات', icon: <MessageCircle size={20} color="#0f766e" />, tint: '#0f766e', bg: '#f0fdfa', onPress: () => router.push('/questions') }] : []),
    ...(flags.weather !== false ? [{ title: 'الطقس', subtitle: 'أحوال الطقس في مدينتك', icon: <Sun size={20} color="#b45309" />, tint: '#b45309', bg: '#fffbeb', onPress: () => router.push('/weather') }] : []),
  ];
  const filteredServices = useMemo(() => services.filter(x => (x.title + ' ' + x.subtitle).includes(query.trim())), [query, flags]);
  const faqs = [
    { q: 'كيف أطلب مساعدة من الجيران؟', a: 'استخدم زر الإضافة في التطبيق، واختر نوع الطلب المناسب وأضف التفاصيل والحي ثم انشره.' },
    { q: 'هل يظهر موقعي الدقيق للآخرين؟', a: 'تُراعى خصوصية الموقع، ولا تشارك عنوانك الدقيق إلا عند الحاجة وبموافقتك.' },
    { q: 'كيف أضيف نشاطي التجاري؟', a: 'افتح دليل المحلات واتبع خطوات إضافة النشاط، ثم أكمل البيانات المطلوبة.' },
  ];

  const renderLink = (item: MenuLink, index: number) => (
    <Pressable key={item.title} onPress={item.onPress} style={({ pressed }) => [styles.serviceRow, pressed && styles.pressed, index !== filteredServices.length - 1 && styles.rowBorder]}>
      <View style={[styles.serviceIcon, { backgroundColor: item.bg }]}>{item.icon}</View>
      <View style={styles.serviceCopy}>
        <Text style={styles.serviceTitle}>{item.title}</Text>
        <Text style={styles.serviceSubtitle}>{item.subtitle}</Text>
      </View>
      {item.badge ? <Text style={styles.badge}>{item.badge}</Text> : null}
      <ChevronLeft size={18} color="#94a3b8" />
    </Pressable>
  );

  return (
    <View style={styles.container}>
      <AppHeader variant="tab" title="المزيد" subtitle="كل ما تحتاجه في حيّنا" rightAction={
        <Pressable onPress={() => router.push('/settings')} style={styles.headerBtn} accessibilityRole="button" accessibilityLabel="الإعدادات">
          <Settings size={19} color="#047857" />
        </Pressable>
      } />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: bottomNavInset + 28 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>
          {hasSession && profile ? (
            <LinearGradient colors={['#064e3b', '#047857', '#059669']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.profileHero}>
              <View style={styles.profileTop}>
                <View style={styles.avatarWrap}>
                  {profile.avatar_url ? <Image source={{ uri: profile.avatar_url }} style={styles.avatar} /> : <View style={styles.avatarFallback}><UserRound size={25} color="#d1fae5" /></View>}
                  {profile.is_verified ? <View style={styles.verified}><ShieldCheck size={12} color="#047857" /></View> : null}
                </View>
                <View style={styles.profileInfo}>
                  <Text style={styles.eyebrow}>أهلاً بعودتك 👋</Text>
                  <Text style={styles.profileName}>{profile.display_name || profile.username || 'جار حيّنا'}</Text>
                  <Text style={styles.profileMeta}>@{profile.username || 'user'}{profile.city ? '  ·  ' + profile.city : ''}</Text>
                </View>
                <Pressable onPress={() => router.push('/profile')} style={styles.profileArrow}><ChevronLeft size={20} color="#fff" /></Pressable>
              </View>
              <View style={styles.profileActions}>
                <Pressable style={styles.profileAction} onPress={() => router.push('/profile')}><UserRound size={15} color="#064e3b" /><Text style={styles.profileActionText}>ملفي الشخصي</Text></Pressable>
                <Pressable style={styles.profileActionGhost} onPress={() => router.push('/settings')}><Settings size={15} color="#fff" /><Text style={styles.profileActionGhostText}>الإعدادات</Text></Pressable>
              </View>
            </LinearGradient>
          ) : !hasSession ? (
            <LinearGradient colors={['#ecfdf5', '#f0fdfa']} style={styles.guestHero}>
              <View style={styles.guestIcon}><UserRound size={24} color="#047857" /></View>
              <Text style={styles.guestTitle}>أهلاً بك في حيّنا</Text>
              <Text style={styles.guestText}>مجتمعك المحلي أقرب إليك. سجّل الدخول لتستفيد من جميع الخدمات.</Text>
              <Pressable style={styles.loginButton} onPress={() => router.push('/auth')}><LogIn size={16} color="#fff" /><Text style={styles.loginText}>تسجيل الدخول أو إنشاء حساب</Text></Pressable>
            </LinearGradient>
          ) : null}

          <View style={styles.searchBox}>
            <Search size={19} color="#94a3b8" />
            <TextInput value={query} onChangeText={setQuery} placeholder="ابحث عن خدمة..." placeholderTextColor="#94a3b8" style={styles.searchInput} textAlign="right" returnKeyType="search" />
            {query ? <Pressable onPress={() => setQuery('')}><X size={17} color="#64748b" /></Pressable> : null}
          </View>

          <View style={styles.sectionHeading}>
            <View><Text style={styles.sectionTitle}>خدمات الحي</Text><Text style={styles.sectionSubtitle}>وصول سريع للأقسام المهمة</Text></View>
            <View style={styles.countPill}><Compass size={14} color="#047857" /><Text style={styles.countText}>{filteredServices.length} خدمات</Text></View>
          </View>
          <View style={styles.panel}>
            {filteredServices.length ? filteredServices.map(renderLink) : <View style={styles.empty}><Search size={22} color="#94a3b8" /><Text style={styles.emptyText}>لا توجد خدمات تطابق بحثك</Text></View>}
          </View>

          <Text style={styles.sectionTitle}>حسابك والمساعدة</Text>
          <View style={styles.panel}>
            <Pressable style={[styles.serviceRow, styles.rowBorder]} onPress={() => router.push('/notifications')}>
              <View style={[styles.serviceIcon, { backgroundColor: '#eff6ff' }]}><Bell size={20} color="#2563eb" /></View>
              <View style={styles.serviceCopy}><Text style={styles.serviceTitle}>الإشعارات</Text><Text style={styles.serviceSubtitle}>آخر المستجدات والتنبيهات</Text></View>
              {unreadNotif > 0 ? <View style={styles.unread}><Text style={styles.unreadText}>{unreadNotif > 99 ? '99+' : unreadNotif}</Text></View> : null}
              <ChevronLeft size={18} color="#94a3b8" />
            </Pressable>
            <Pressable style={[styles.serviceRow, styles.rowBorder]} onPress={() => router.push('/settings')}>
              <View style={[styles.serviceIcon, { backgroundColor: '#f1f5f9' }]}><Settings size={20} color="#475569" /></View>
              <View style={styles.serviceCopy}><Text style={styles.serviceTitle}>الإعدادات والخصوصية</Text><Text style={styles.serviceSubtitle}>إدارة الحساب والتفضيلات</Text></View><ChevronLeft size={18} color="#94a3b8" />
            </Pressable>
            <Pressable style={[styles.serviceRow, styles.rowBorder]} onPress={() => open('https://appksatest.vercel.app/privacy')}>
              <View style={[styles.serviceIcon, { backgroundColor: '#f5f3ff' }]}><LockKeyhole size={20} color="#7c3aed" /></View>
              <View style={styles.serviceCopy}><Text style={styles.serviceTitle}>سياسة الخصوصية</Text><Text style={styles.serviceSubtitle}>كيف نحافظ على بياناتك</Text></View><ExternalLink size={16} color="#94a3b8" />
            </Pressable>
            <Pressable style={[styles.serviceRow, styles.rowBorder]} onPress={() => open('mailto:support@hayna.app?subject=' + encodeURIComponent('الدعم والاستفسارات - تطبيق حيّنا'))}>
              <View style={[styles.serviceIcon, { backgroundColor: '#fff7ed' }]}><CircleHelp size={20} color="#c2410c" /></View>
              <View style={styles.serviceCopy}><Text style={styles.serviceTitle}>الدعم والمساعدة</Text><Text style={styles.serviceSubtitle}>تواصل معنا عند الحاجة</Text></View><ChevronLeft size={18} color="#94a3b8" />
            </Pressable>
            <Pressable style={styles.serviceRow} onPress={() => setShowIdea(true)}>
              <View style={[styles.serviceIcon, { backgroundColor: '#ecfdf5' }]}><Lightbulb size={20} color="#047857" /></View>
              <View style={styles.serviceCopy}><Text style={styles.serviceTitle}>اقترح ميزة جديدة</Text><Text style={styles.serviceSubtitle}>ساهم في تطوير تجربة حيّنا</Text></View><ChevronLeft size={18} color="#94a3b8" />
            </Pressable>
          </View>

          <View style={styles.devCard}>
            <LinearGradient colors={['#0f172a', '#172554']} style={styles.devTop}>
              <View style={styles.devIcon}><Code2 size={22} color="#6ee7b7" /></View>
              <View style={styles.devTextWrap}><Text style={styles.devEyebrow}>صُنع بعناية في السعودية</Text><Text style={styles.devTitle}>عن حيّنا والمطوّر</Text><Text style={styles.devSubtitle}>تجربة محلية تجمع الجيران والخدمات في مكان واحد.</Text></View>
            </LinearGradient>
            <View style={styles.devLinks}>
              <Pressable style={styles.devLink} onPress={() => router.push('/about')}><Text style={styles.devLinkText}>عن المنصة</Text><ChevronLeft size={16} color="#64748b" /></Pressable>
              <Pressable style={styles.devLink} onPress={() => open('https://github.com/youef/app_ksa_test')}><Github size={17} color="#334155" /><Text style={styles.devLinkText}>المصدر على GitHub</Text><ExternalLink size={14} color="#94a3b8" /></Pressable>
              <Pressable style={styles.devLink} onPress={() => open('https://appksatest.vercel.app')}><Globe2 size={17} color="#047857" /><Text style={styles.devLinkText}>موقع حيّنا</Text><ExternalLink size={14} color="#94a3b8" /></Pressable>
              <Pressable style={styles.devLink} onPress={shareApp}><Share2 size={17} color="#047857" /><Text style={styles.devLinkText}>مشاركة التطبيق</Text><ChevronLeft size={16} color="#64748b" /></Pressable>
            </View>
          </View>

          <View style={styles.faqPanel}>
            <View style={styles.faqHeading}><CircleHelp size={18} color="#047857" /><Text style={styles.sectionTitle}>أسئلة شائعة</Text></View>
            {faqs.map((item, index) => <View key={item.q} style={index < faqs.length - 1 && styles.rowBorder}>
              <Pressable style={styles.faqQuestion} onPress={() => setOpenFaq(openFaq === index ? null : index)}><Text style={styles.faqQ}>{item.q}</Text><ChevronLeft size={17} color="#64748b" style={{ transform: [{ rotate: openFaq === index ? '-90deg' : '0deg' }] }} /></Pressable>
              {openFaq === index ? <Text style={styles.faqAnswer}>{item.a}</Text> : null}
            </View>)}
          </View>

          {hasSession ? <Pressable style={styles.logout} onPress={signOut}><LogOut size={17} color="#dc2626" /><Text style={styles.logoutText}>تسجيل الخروج</Text></Pressable> : null}
          <View style={styles.footer}><View style={styles.footerMark}><HeartHandshake size={17} color="#047857" /><Text style={styles.footerBrand}>حيّنا</Text></View><Text style={styles.footerText}>مجتمع أقرب، وحياة أسهل.</Text><Text style={styles.version}>الإصدار 2.7.0</Text></View>
        </View>
      </ScrollView>

      {showIdea ? <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHead}><Text style={styles.modalTitle}>اقترح ميزة جديدة</Text><Pressable onPress={() => setShowIdea(false)} style={styles.closeBtn}><X size={18} color="#475569" /></Pressable></View>
          <Text style={styles.modalHint}>ما الميزة التي تتمنى إضافتها إلى حيّنا؟</Text>
          <TextInput value={idea} onChangeText={setIdea} multiline maxLength={1000} placeholder="اكتب اقتراحك هنا..." placeholderTextColor="#94a3b8" style={styles.ideaInput} textAlign="right" textAlignVertical="top" />
          <Pressable disabled={sendingIdea} style={[styles.submitButton, sendingIdea && { opacity: 0.65 }]} onPress={sendIdea}>{sendingIdea ? <ActivityIndicator color="#fff" /> : <Send size={17} color="#fff" />}<Text style={styles.submitText}>{sendingIdea ? 'جارٍ الإرسال...' : 'إرسال الاقتراح'}</Text></Pressable>
        </View>
      </View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { paddingTop: 8 },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', paddingHorizontal: 16, gap: 14 },
  headerBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: '#ecfdf5', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#d1fae5' },
  profileHero: { borderRadius: 24, padding: 18, gap: 18, overflow: 'hidden' },
  profileTop: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 58, height: 58, borderRadius: 20, borderWidth: 2, borderColor: '#a7f3d0' },
  avatarFallback: { width: 58, height: 58, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  verified: { position: 'absolute', bottom: -3, left: -3, width: 21, height: 21, borderRadius: 11, backgroundColor: '#d1fae5', alignItems: 'center', justifyContent: 'center' },
  profileInfo: { flex: 1, alignItems: 'flex-end', gap: 3 },
  eyebrow: { color: '#a7f3d0', fontSize: 11, fontWeight: '700' },
  profileName: { color: '#fff', fontSize: 19, fontWeight: '900' },
  profileMeta: { color: '#d1fae5', fontSize: 11, textAlign: 'right' },
  profileArrow: { width: 34, height: 34, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' },
  profileActions: { flexDirection: 'row-reverse', gap: 9 },
  profileAction: { flex: 1, flexDirection: 'row-reverse', justifyContent: 'center', alignItems: 'center', gap: 7, paddingVertical: 11, borderRadius: 13, backgroundColor: '#d1fae5' },
  profileActionText: { color: '#064e3b', fontSize: 12, fontWeight: '900' },
  profileActionGhost: { flex: 1, flexDirection: 'row-reverse', justifyContent: 'center', alignItems: 'center', gap: 7, paddingVertical: 11, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  profileActionGhostText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  guestHero: { borderRadius: 24, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#a7f3d0', gap: 8 },
  guestIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: '#d1fae5', alignItems: 'center', justifyContent: 'center' },
  guestTitle: { color: '#064e3b', fontSize: 19, fontWeight: '900' },
  guestText: { color: '#047857', fontSize: 12, textAlign: 'center', lineHeight: 19, maxWidth: 340 },
  loginButton: { marginTop: 5, backgroundColor: '#047857', borderRadius: 14, paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  loginText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  searchBox: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, paddingHorizontal: 14, height: 48, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0' },
  searchInput: { flex: 1, color: '#0f172a', fontSize: 14, paddingVertical: 0 },
  sectionHeading: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginTop: 3 },
  sectionTitle: { color: '#0f172a', fontSize: 15, fontWeight: '900', textAlign: 'right' },
  sectionSubtitle: { color: '#64748b', fontSize: 11, marginTop: 3, textAlign: 'right' },
  countPill: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, backgroundColor: '#ecfdf5', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6 },
  countText: { color: '#047857', fontSize: 10, fontWeight: '800' },
  panel: { backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
  serviceRow: { minHeight: 70, paddingVertical: 12, paddingHorizontal: 13, flexDirection: 'row-reverse', alignItems: 'center', gap: 11 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  pressed: { backgroundColor: '#f8fafc', opacity: 0.8 },
  serviceIcon: { width: 43, height: 43, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  serviceCopy: { flex: 1, alignItems: 'flex-end', gap: 4 },
  serviceTitle: { color: '#0f172a', fontSize: 13, fontWeight: '900', textAlign: 'right' },
  serviceSubtitle: { color: '#64748b', fontSize: 10.5, textAlign: 'right', lineHeight: 15 },
  badge: { color: '#047857', backgroundColor: '#d1fae5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, fontSize: 10, fontWeight: '800' },
  unread: { minWidth: 22, height: 22, paddingHorizontal: 5, borderRadius: 11, backgroundColor: '#dc2626', alignItems: 'center', justifyContent: 'center' },
  unreadText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  empty: { alignItems: 'center', padding: 25, gap: 8 },
  emptyText: { color: '#64748b', fontSize: 12 },
  devCard: { backgroundColor: '#fff', borderRadius: 22, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden' },
  devTop: { flexDirection: 'row-reverse', alignItems: 'center', gap: 13, padding: 18 },
  devIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(110,231,183,0.12)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(110,231,183,0.2)' },
  devTextWrap: { flex: 1, alignItems: 'flex-end', gap: 4 },
  devEyebrow: { color: '#6ee7b7', fontSize: 10, fontWeight: '800' },
  devTitle: { color: '#fff', fontSize: 16, fontWeight: '900' },
  devSubtitle: { color: '#cbd5e1', fontSize: 11, textAlign: 'right', lineHeight: 17 },
  devLinks: { paddingHorizontal: 14 },
  devLink: { minHeight: 47, flexDirection: 'row-reverse', alignItems: 'center', gap: 9, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  devLinkText: { flex: 1, color: '#334155', fontSize: 12, fontWeight: '800', textAlign: 'right' },
  faqPanel: { backgroundColor: '#fff', borderRadius: 20, borderWidth: 1, borderColor: '#e2e8f0', paddingHorizontal: 14, paddingVertical: 12 },
  faqHeading: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, paddingBottom: 5 },
  faqQuestion: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingVertical: 13 },
  faqQ: { flex: 1, color: '#334155', fontSize: 12, fontWeight: '800', textAlign: 'right' },
  faqAnswer: { color: '#64748b', fontSize: 12, lineHeight: 20, textAlign: 'right', paddingBottom: 13, paddingRight: 2 },
  logout: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 15, borderWidth: 1, borderColor: '#fecaca', paddingVertical: 13 },
  logoutText: { color: '#dc2626', fontSize: 13, fontWeight: '900' },
  footer: { alignItems: 'center', paddingVertical: 13, gap: 4 },
  footerMark: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  footerBrand: { color: '#047857', fontSize: 14, fontWeight: '900' },
  footerText: { color: '#64748b', fontSize: 11 },
  version: { color: '#94a3b8', fontSize: 10, marginTop: 4 },
  modalOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 20, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end', paddingTop: 40 },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 30, gap: 13 },
  modalHead: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { color: '#0f172a', fontSize: 17, fontWeight: '900' },
  closeBtn: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' },
  modalHint: { color: '#64748b', fontSize: 12, textAlign: 'right' },
  ideaInput: { minHeight: 115, maxHeight: 180, borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 14, padding: 13, color: '#0f172a', fontSize: 14, backgroundColor: '#f8fafc' },
  submitButton: { backgroundColor: '#047857', borderRadius: 14, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row-reverse', gap: 8 },
  submitText: { color: '#fff', fontSize: 13, fontWeight: '900' },
});