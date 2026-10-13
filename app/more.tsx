import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Image,
  Platform,
  Alert,
  Share,
  Modal,
  TextInput,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useBottomNavInset } from '@/lib/bottomNav';
import AppHeader from '@/components/shared/AppHeader';
import {
  User,
  ShieldCheck,
  ChevronLeft,
  Truck,
  Settings,
  Bell,
  Share2,
  LogOut,
  LogIn,
  Sparkles,
  CreditCard,
  Building,
  PackageCheck,
  Lightbulb,
  Award,
  Send,
  X,
  Car,
  Flame,
  Mail,
  Star,
  Globe,
  FileText,
  Sun,
  Store,
  Briefcase,
  Map,
  MessageCircle,
  Phone,
  Code2,
  CheckCircle2,
  Copy,
  HeartHandshake,
  BadgeCheck,
  ChevronDown,
  ChevronRight,
  Shield,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { requireAccount } from '@/lib/authGate';
import { usePlatformConfig } from '@/lib/platformConfig';

export default function MoreScreen() {
  const { flags } = usePlatformConfig();
  const bottomNavInset = useBottomNavInset();
  const [profile, setProfile] = useState<any>(null);
  const [hasSession, setHasSession] = useState(false);
  const [unreadNotif, setUnreadNotif] = useState(0);

  // Suggestion Modal State
  const [showIdeaModal, setShowIdeaModal] = useState(false);
  const [ideaText, setIdeaText] = useState('');
  const [sendingIdea, setSendingIdea] = useState(false);

  // FAQ accordion
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Copy feedback state
  const [copiedPhone, setCopiedPhone] = useState(false);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const { data: auth } = await supabase.auth.getSession();
      const user = auth.session?.user;
      setHasSession(Boolean(user));
      if (!user) return;

      const [{ data: p }, { count }] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, display_name, username, avatar_url, is_verified, is_geoverified, city, district, role, email')
          .eq('id', user.id)
          .maybeSingle(),
        supabase
          .from('notifications')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .is('read_at', null),
      ]);

      setProfile(p);
      setUnreadNotif(count ?? 0);
    } catch {}
  };

  const handleShareApp = async () => {
    const text = 'تطبيق حيّنا 🇸🇦 — مجتمع وسوق وفزعة وخدمات حيك في مكان واحد وبدون وسطاء!\nhttps://appksatest.vercel.app';
    try {
      await Share.share({ message: text, title: 'تطبيق حيّنا' });
    } catch {}
  };

  const openExternal = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('تعذّر الفتح', 'لا يمكن فتح الرابط على هذا الجهاز.');
    }
  };

  const openDeveloperPhone = () => {
    Linking.openURL('tel:0538243481').catch(() => {
      Alert.alert('رقم الاتصال', '0538243481');
    });
  };

  const openDeveloperWhatsApp = () => {
    const msg = encodeURIComponent('مرحباً م. يوسف الحازمي، يسعدني التواصل معك بخصوص تطبيق ومنصة حيّنا المجتمعية.');
    Linking.openURL(`https://wa.me/966538243481?text=${msg}`).catch(() => {
      Alert.alert('واتساب', 'يمكنك التواصل عبر الرقم: 0538243481');
    });
  };

  const handleContactSupport = () => {
    openExternal('mailto:support@hayna.app?subject=' + encodeURIComponent('الدعم والاستفسارات - تطبيق حيّنا'));
  };

  const handleOpenPolicy = () => {
    openExternal('https://appksatest.vercel.app/privacy');
  };

  const handleSignOut = () => {
    Alert.alert('تسجيل الخروج', 'هل أنت متأكد من تسجيل الخروج من حسابك في تطبيق حيّنا؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'تسجيل الخروج',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/auth');
        },
      },
    ]);
  };

  const handleSendIdea = async () => {
    if (!ideaText.trim()) {
      Alert.alert('تنبيه', 'يرجى كتابة فكرتك أو اقتراحك للمنصة.');
      return;
    }
    setSendingIdea(true);
    try {
      await supabase.from('reports').insert({
        reason: 'اقتراح ميزة مستقبلية: ' + ideaText.trim(),
        reporter_id: profile?.id || null,
        target_type: 'idea',
      });

      setShowIdeaModal(false);
      setIdeaText('');
      Alert.alert('شكراً لك! 🌟', 'تم إرسال اقتراحك للمطور وسنعمل على دراسته وتضمينه في التحديثات القادمة.');
    } catch {
      setShowIdeaModal(false);
    } finally {
      setSendingIdea(false);
    }
  };

  const FAQS = [
    {
      q: 'هل توجد عروض أو طلبات وهمية تجريبية في المنصة؟',
      a: 'إطلاقاً. منصة حيّنا نظيفة تماماً من أي بيانات تجريبية وهمية، وتعتمد بنسبة 100% على المستخدمين وسكان الحي الحقيقيين.',
    },
    {
      q: 'كيف أطلب فزعة أو مساعدة من جيراني؟',
      a: 'من قسم «فزعة وطلبات المساعدة» اضغط «طلب جديد»، اكتب التفاصيل وحدّد حيّك ثم انشر. سيصل طلبك فوراً لجيرانك القريبين منك.',
    },
    {
      q: 'هل موقعي وسكني الدقيق ظاهر للعامة؟',
      a: 'لا. يُعرض موقعك على مستوى الحي فقط لحماية خصوصيتك التامة، ويتم تبادل العنوان الدقيق بالمحادثات الخاصة وبموافقتك الشخصية فقط.',
    },
    {
      q: 'ما فائدة شارات الجار الموثق ونقاط السمعة؟',
      a: 'تُمنح نقاط السمعة والشارات للجيران المتعاونين عند إتمام الفزعات والإجابات المعتمدة وتظهر كأوسمة ثقة وتميز في ملفك الشخصي.',
    },
    {
      q: 'كيف أسجل محلي أو متجري في دليل الأعمال؟',
      a: 'يمكنك إضافة متجرك أو نشاطك التجاري مجاناً بالكامل من خلال قسم «سوق الحي والدليل» ليظهر لكافة سكان الحي.',
    },
  ];

  const APP_VERSION = '2.6.0';

  return (
    <View style={styles.container}>
      <AppHeader
        variant="tab"
        title="المزيد والخدمات"
        subtitle={`منصة حيّنا المجتمعية · الإصدار ${APP_VERSION}`}
        rightAction={
          <Pressable
            onPress={() => router.push('/settings')}
            style={styles.headerBtn}
            accessibilityRole="button"
            accessibilityLabel="مركز الإعدادات والتحكم"
          >
            <Settings size={18} color="#047857" />
          </Pressable>
        }
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomNavInset + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentWrap}>
          {/* ======================================================== */}
          {/* 1. USER IDENTITY CARD OR GUEST BANNER                    */}
          {/* ======================================================== */}
          {hasSession && profile ? (
            <LinearGradient
              colors={['#064e3b', '#047857', '#059669']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.userHeroCard}
            >
              <View style={styles.userHeroTopRow}>
                <View style={styles.avatarWrap}>
                  {profile.avatar_url ? (
                    <Image source={{ uri: profile.avatar_url }} style={styles.avatarImg} />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Text style={styles.avatarLetter}>
                        {(profile.display_name || profile.username || 'ج')[0]?.toUpperCase() || 'ج'}
                      </Text>
                    </View>
                  )}
                  {profile.is_verified && (
                    <View style={styles.verifiedIconBadge}>
                      <ShieldCheck size={11} color="#fff" />
                    </View>
                  )}
                </View>

                <View style={styles.userHeroInfoCol}>
                  <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.userHeroName}>
                      {profile.display_name || profile.username || 'جار حيّنا'}
                    </Text>
                    {profile.is_verified && (
                      <View style={styles.verifiedTag}>
                        <Text style={styles.verifiedTagText}>موثّق 🛡️</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.userHeroHandle}>@{profile.username || 'user'}</Text>

                  {(profile.city || profile.district) && (
                    <View style={styles.userHeroLocationPill}>
                      <MapPin size={11} color="#a7f3d0" />
                      <Text style={styles.userHeroLocationText}>
                        {[profile.district && `حي ${profile.district}`, profile.city].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.userHeroActionsRow}>
                <Pressable
                  style={styles.userHeroProfileBtn}
                  onPress={() => router.push('/profile')}
                >
                  <User size={14} color="#064e3b" />
                  <Text style={styles.userHeroProfileBtnText}>عرض الملف الشخصي</Text>
                  <ChevronLeft size={14} color="#064e3b" />
                </Pressable>

                <Pressable
                  style={styles.userHeroSettingsBtn}
                  onPress={() => router.push('/settings')}
                >
                  <Settings size={14} color="#fff" />
                  <Text style={styles.userHeroSettingsBtnText}>الإعدادات والتحكم</Text>
                </Pressable>
              </View>
            </LinearGradient>
          ) : !hasSession ? (
            <View style={styles.guestBanner}>
              <View style={styles.guestIconCircle}>
                <User size={24} color="#059669" />
              </View>
              <View style={{ flex: 1, alignItems: 'flex-end', gap: 3 }}>
                <Text style={styles.guestTitle}>مرحباً بك في منصة حيّنا! 🇸🇦</Text>
                <Text style={styles.guestSub}>سجّل دخولك أو أنشئ حسابك للتواصل مع جيرانك وتفعيل جميع الخدمات.</Text>
              </View>
              <Pressable style={styles.guestLoginBtn} onPress={() => router.push('/auth')}>
                <LogIn size={15} color="#fff" />
                <Text style={styles.guestLoginBtnText}>تسجيل الدخول</Text>
              </Pressable>
            </View>
          ) : null}

          {/* ======================================================== */}
          {/* 2. ABOUT PLATFORM & DEVELOPER (DEDICATED PAGE)           */}
          {/* ======================================================== */}
          <View style={styles.menuGroup}>
            <MenuItem
              icon={<Code2 size={20} color="#059669" />}
              iconBg="#ecfdf5"
              title="حول المنصة ومطور التطبيق"
              sub="م. يوسف الحازمي — الرؤية، الأهداف، وبيانات التواصل المباشر (0538243481)"
              badge="المطور 🇸🇦"
              badgeColor="#059669"
              onPress={() => router.push('/about')}
            />
          </View>

          {/* ======================================================== */}
          {/* 3. QUICK HUB 4-CARDS                                     */}
          {/* ======================================================== */}
          {(flags.requests !== false || flags.carpooling !== false || flags.urgent_alerts !== false) && <Text style={styles.sectionHeader}>خدمات الفزعة والتكافل بالحي 🤝</Text>}
          <View style={styles.quickHubGrid}>
            {flags.requests !== false && <Pressable style={styles.quickHubCard} onPress={() => router.push('/requests')}>
              <View style={[styles.quickHubIconCircle, { backgroundColor: '#fff7ed' }]}>
                <Truck size={22} color="#ea580c" />
              </View>
              <Text style={styles.quickHubTitle}>فزعة الحي</Text>
              <Text style={styles.quickHubSub}>طلب مساعدة الجيران</Text>
            </Pressable>}

            {flags.carpooling !== false && <Pressable style={styles.quickHubCard} onPress={() => router.push('/carpooling')}>
              <View style={[styles.quickHubIconCircle, { backgroundColor: '#ecfdf5' }]}>
                <Car size={22} color="#059669" />
              </View>
              <Text style={styles.quickHubTitle}>توصيل مدارس</Text>
              <Text style={styles.quickHubSub}>مقاعد مشتركة آمنة</Text>
            </Pressable>}

            {flags.urgent_alerts !== false && <Pressable style={styles.quickHubCard} onPress={() => router.push('/emergency-alert')}>
              <View style={[styles.quickHubIconCircle, { backgroundColor: '#fef2f2' }]}>
                <Flame size={22} color="#dc2626" />
              </View>
              <Text style={styles.quickHubTitle}>طوارئ الحي</Text>
              <Text style={styles.quickHubSub}>تنبيه للحالات العاجلة</Text>
            </Pressable>}
          </View>

          {/* ======================================================== */}
          {/* 4. CORE NEIGHBORHOOD SERVICES DIRECTORY                  */}
          {/* ======================================================== */}
          <Text style={styles.sectionHeader}>أقسام وخدمات الحي الأساسية 🏬</Text>
          <View style={styles.menuGroup}>
            <MenuItem
              icon={<Store size={20} color="#059669" />}
              iconBg="#ecfdf5"
              title="سوق الحي والأسر المنتجة"
              sub="بيع واشترِ واعرض منتجاتك وخدماتك في حيك بدون عمولات"
              badge="نشط"
              badgeColor="#059669"
              onPress={() => router.push('/market')}
            />
            <MenuItem
              icon={<Briefcase size={20} color="#0284c7" />}
              iconBg="#f0f9ff"
              title="دليل الأنشطة والمحلات التجارية"
              sub="البقالات، الصيدليات، المغاسل، والورش المحلية بالحي"
              onPress={() => router.push('/directory')}
            />
            <MenuItem
              icon={<Map size={20} color="#7c3aed" />}
              iconBg="#f5f3ff"
              title="خريطة الحي التفاعلية المباشرة"
              sub="استكشف الفعاليات والخدمات والمحلات القريبة منك"
              onPress={() => router.push('/map')}
            />
            <MenuItem
              icon={<MessageCircle size={20} color="#0f766e" />}
              iconBg="#f0fdfa"
              title="استفسارات وأسئلة الجيران"
              sub="تجارب أهالي الحي، نصائحهم، وتوصياتهم الموثوقة"
              onPress={() => router.push('/questions')}
            />
            <MenuItem
              icon={<Sun size={20} color="#d97706" />}
              iconBg="#fffbeb"
              title="الطقس والمناخ المباشر"
              sub="درجات الحرارة، الرطوبة، وسرعة الرياح لمدينتك"
              badge="مباشر"
              badgeColor="#0284c7"
              onPress={() => router.push('/weather')}
            />
          </View>

          {/* ======================================================== */}
          {/* 5. FUTURE EXPANSIONS & COMMUNITY INNOVATIONS             */}
          {/* ======================================================== */}
          <View style={styles.futureBox}>
            <View style={styles.futureHeader}>
              <Sparkles size={18} color="#059669" />
              <Text style={styles.futureTitle}>المميزات والتطويرات القادمة للمنصة 🚀</Text>
            </View>
            <Text style={styles.futureSub}>
              نعمل مع المطور م. يوسف الحازمي على تعزيز الخدمات الرقمية لخدمة الحي:
            </Text>

            <View style={styles.futureItemsGrid}>
              <View style={styles.futureItem}>
                <CreditCard size={18} color="#0284c7" />
                <Text style={styles.futureItemTitle}>بطاقة الجار الذكية</Text>
                <Text style={styles.futureItemDesc}>خصومات خاصة لسكان الحي لدى المتاجر والشركاء المعتمدين</Text>
              </View>

              <View style={styles.futureItem}>
                <Building size={18} color="#7c3aed" />
                <Text style={styles.futureItemTitle}>مجلس وسكان العمارة</Text>
                <Text style={styles.futureItemDesc}>مجموعة خاصة لعمارتك لإدارة الصيانة الدورية وتكاليف الخدمات</Text>
              </View>

              <View style={styles.futureItem}>
                <PackageCheck size={18} color="#059669" />
                <Text style={styles.futureItemTitle}>صندوق أمانات الحي</Text>
                <Text style={styles.futureItemDesc}>استلام وتسليم الطرود والمفاتيح بأمان فائق بين الجيران</Text>
              </View>

              <View style={styles.futureItem}>
                <Award size={18} color="#d97706" />
                <Text style={styles.futureItemTitle}>نقاط الجار الفاعل</Text>
                <Text style={styles.futureItemDesc}>مكافآت وشارات تميز مجتمعية للمساهمين في خدمة أهالي الحي</Text>
              </View>
            </View>

            <Pressable
              style={styles.suggestBtn}
              onPress={() => setShowIdeaModal(true)}
            >
              <Lightbulb size={16} color="#047857" />
              <Text style={styles.suggestBtnText}>اقترح فكرة أو خدمة جديدة للمطور 💡</Text>
            </Pressable>
          </View>

          {/* ======================================================== */}
          {/* 6. SETTINGS & APP PREFERENCES                            */}
          {/* ======================================================== */}
          <Text style={styles.sectionHeader}>الإعدادات والتحكم ⚙️</Text>
          <View style={styles.menuGroup}>
            {hasSession && (
              <MenuItem
                icon={<Bell size={20} color="#059669" />}
                iconBg="#ecfdf5"
                title="مركز الإشعارات والتنبيهات"
                sub="تنبيهات الأسئلة والردود وطلبات الحي"
                badge={unreadNotif > 0 ? `${unreadNotif}` : undefined}
                badgeColor="#ef4444"
                onPress={() => router.push('/notifications')}
              />
            )}
            <MenuItem
              icon={<Settings size={20} color="#475569" />}
              iconBg="#f1f5f9"
              title="إعدادات الحساب والأمان والخصوصية"
              sub="إدارة كلمة المرور، ساعات الصمت، وتوثيق السكن"
              onPress={() => (hasSession ? router.push('/settings') : requireAccount())}
            />
            <MenuItem
              icon={<Share2 size={20} color="#0284c7" />}
              iconBg="#f0f9ff"
              title="شارك تطبيق حيّنا مع جيرانك"
              sub="ادعُ جيرانك في الحي للانضمام والمشاركة"
              onPress={handleShareApp}
            />
            <MenuItem
              icon={<Star size={20} color="#d97706" />}
              iconBg="#fffbeb"
              title="قيّم تجربتك في حيّنا"
              sub="رأيك واقتراحاتك تساهم في تطوير وتحديث المنصة"
              onPress={() => openExternal('https://appksatest.vercel.app')}
            />
          </View>

          {/* ======================================================== */}
          {/* 7. FREQUENTLY ASKED QUESTIONS                            */}
          {/* ======================================================== */}
          <Text style={styles.sectionHeader}>الأسئلة الشائعة 💬</Text>
          <View style={styles.faqCard}>
            {FAQS.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <View key={idx} style={styles.faqItem}>
                  <Pressable
                    style={styles.faqQuestionRow}
                    onPress={() => setOpenFaq(isOpen ? null : idx)}
                    accessibilityRole="button"
                  >
                    <ChevronRight
                      size={16}
                      color="#059669"
                      style={{ transform: [{ rotate: isOpen ? '90deg' : '0deg' }] }}
                    />
                    <Text style={styles.faqQuestion}>{item.q}</Text>
                  </Pressable>
                  {isOpen && <Text style={styles.faqAnswer}>{item.a}</Text>}
                </View>
              );
            })}
          </View>

          {/* ======================================================== */}
          {/* 8. SUPPORT & PLATFORM POLICIES                           */}
          {/* ======================================================== */}
          <Text style={styles.sectionHeader}>الدعم والسياسات 📜</Text>
          <View style={styles.menuGroup}>
            <MenuItem
              icon={<Code2 size={20} color="#059669" />}
              iconBg="#ecfdf5"
              title="عن تطبيق حيّنا ومطور المنصة"
              sub="م. يوسف الحازمي — الرؤية والاتصال المباشر"
              onPress={() => router.push('/about')}
            />
            <MenuItem
              icon={<Mail size={20} color="#0284c7" />}
              iconBg="#f0f9ff"
              title="فريق الدعم الفني"
              sub="support@hayna.app — نسعد بخدمتكم دائماً"
              onPress={handleContactSupport}
            />
            <MenuItem
              icon={<FileText size={20} color="#7c3aed" />}
              iconBg="#f5f3ff"
              title="سياسة الخصوصية والشروط"
              sub="حماية بياناتك واحترام خصوصية أهالي الحي"
              onPress={handleOpenPolicy}
            />
            <MenuItem
              icon={<Globe size={20} color="#059669" />}
              iconBg="#ecfdf5"
              title="موقع المنصة الرسمي"
              sub="appksatest.vercel.app"
              onPress={() => openExternal('https://appksatest.vercel.app')}
            />
          </View>

          {/* ======================================================== */}
          {/* 9. SIGN OUT BUTTON (IF LOGGED IN)                        */}
          {/* ======================================================== */}
          {hasSession && (
            <Pressable style={styles.logoutBtn} onPress={handleSignOut}>
              <LogOut size={18} color="#ef4444" />
              <Text style={styles.logoutBtnText}>تسجيل الخروج من الحساب</Text>
            </Pressable>
          )}

          {/* ======================================================== */}
          {/* 10. APP FOOTER & CREDITS                                 */}
          {/* ======================================================== */}
          <View style={styles.footerBox}>
            <Text style={styles.footerTitle}>منصة حيّنا المجتمعية — Hayna</Text>
            <Text style={styles.footerSub}>
              المنصة الرقمية الموحدة لترابط سكان وأسر الأحياء بالمملكة العربية السعودية 🇸🇦
            </Text>
            <View style={styles.footerBadgeRow}>
              <View style={styles.footerBadge}>
                <ShieldCheck size={12} color="#047857" />
                <Text style={styles.footerBadgeText}>بيانات حقيقية موثقة</Text>
              </View>
              <Pressable
                style={[styles.footerBadge, { borderColor: '#a7f3d0', backgroundColor: '#ecfdf5' }]}
                onPress={() => router.push('/about')}
              >
                <Code2 size={12} color="#047857" />
                <Text style={[styles.footerBadgeText, { color: '#047857', fontWeight: '800' }]}>
                  المطور: يوسف الحازمي 👨‍💻
                </Text>
              </Pressable>
            </View>
            <Text style={styles.footerVersion}>الإصدار {APP_VERSION} · جميع الحقوق محفوظة</Text>
          </View>
        </View>
      </ScrollView>

      {/* ======================================================== */}
      {/* MODAL: SUGGEST A FEATURE TO DEVELOPER                    */}
      {/* ======================================================== */}
      <Modal visible={showIdeaModal} animationType="slide" transparent onRequestClose={() => setShowIdeaModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setShowIdeaModal(false)} style={styles.modalCloseBtn} hitSlop={8}>
                <X size={18} color="#0f172a" />
              </Pressable>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                <Lightbulb size={18} color="#d97706" />
                <Text style={styles.modalTitle}>اقتراح ميزة أو تطوير مستقبلي 💡</Text>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 350 }}>
              <Text style={styles.ideaHelpText}>
                يسعد المطور م. يوسف الحازمي بتلقي اقتراحاتك وأفكارك لتطوير منصة حيّنا! اكتب الميزة أو الخدمة التي تود رؤيتها:
              </Text>
              <TextInput
                style={styles.ideaInput}
                placeholder="اكتب فكرتك أو اقتراحك هنا..."
                placeholderTextColor="#94a3b8"
                value={ideaText}
                onChangeText={setIdeaText}
                multiline
                textAlign="right"
              />

              <Pressable
                style={[styles.submitIdeaBtn, sendingIdea && { opacity: 0.6 }]}
                onPress={handleSendIdea}
                disabled={sendingIdea}
              >
                {sendingIdea ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Send size={16} color="#fff" />
                    <Text style={styles.submitIdeaBtnText}>إرسال الاقتراح للمطور</Text>
                  </>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function MenuItem({
  icon,
  iconBg,
  title,
  sub,
  badge,
  badgeColor,
  onPress,
}: {
  icon: any;
  iconBg: string;
  title: string;
  sub: string;
  badge?: string;
  badgeColor?: string;
  onPress: () => void;
}) {
  const { flags } = usePlatformConfig();
  const key = title.includes('سوق') ? 'market' : title.includes('دليل الأنشطة') ? 'directory' : title.includes('طقس') ? 'weather' : title.includes('توصيل') ? 'carpooling' : title.includes('طوارئ') ? 'urgent_alerts' : title.includes('بثوث') ? 'live' : title.includes('استفسارات') ? 'questions' : undefined;
  if (key && flags[key] === false) return null;
  return (
    <Pressable
      style={({ pressed }: any) => [styles.menuItem, pressed && { backgroundColor: '#f8fafc' }]}
      onPress={onPress}
    >
      <ChevronLeft size={16} color="#94a3b8" />
      <View style={{ flex: 1, alignItems: 'flex-end', gap: 2 }}>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
          <Text style={styles.menuItemTitle}>{title}</Text>
          {badge && (
            <View style={[styles.menuBadge, badgeColor ? { backgroundColor: badgeColor } : {}]}>
              <Text style={styles.menuBadgeText}>{badge}</Text>
            </View>
          )}
        </View>
        <Text style={styles.menuItemSub}>{sub}</Text>
      </View>
      <View style={[styles.menuIconBox, { backgroundColor: iconBg }]}>{icon}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  scroll: { paddingTop: 14 },
  contentWrap: { maxWidth: 860, width: '100%', alignSelf: 'center', paddingHorizontal: 16, gap: 14 },

  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // User Hero Card
  userHeroCard: {
    borderRadius: 22,
    padding: 18,
    shadowColor: '#059669',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    gap: 14,
  },
  userHeroTopRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 14,
  },
  avatarWrap: {
    position: 'relative',
    borderWidth: 2.5,
    borderColor: '#fff',
    borderRadius: 30,
  },
  avatarImg: { width: 56, height: 56, borderRadius: 28 },
  avatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { fontSize: 22, fontWeight: '900', color: '#fff' },
  verifiedIconBadge: {
    position: 'absolute',
    bottom: -2,
    left: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#064e3b',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  userHeroInfoCol: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 2,
  },
  userHeroName: { fontSize: 17, fontWeight: '900', color: '#fff' },
  verifiedTag: {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  verifiedTagText: { fontSize: 10, fontWeight: '900', color: '#fef08a' },
  userHeroHandle: { fontSize: 12.5, color: '#a7f3d0', fontWeight: '700' },
  userHeroLocationPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0,0,0,0.22)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginTop: 3,
  },
  userHeroLocationText: { fontSize: 11, color: '#d1fae5', fontWeight: '700' },
  userHeroActionsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.18)',
  },
  userHeroProfileBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#fff',
    paddingVertical: 9,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  userHeroProfileBtnText: { fontSize: 12, fontWeight: '900', color: '#064e3b' },
  userHeroSettingsBtn: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    paddingVertical: 9,
    borderRadius: 12,
  },
  userHeroSettingsBtnText: { fontSize: 12, fontWeight: '800', color: '#fff' },

  // Guest Banner
  guestBanner: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 20,
    padding: 16,
  },
  guestIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#d1fae5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestTitle: { fontSize: 15, fontWeight: '900', color: '#065f46' },
  guestSub: { fontSize: 11.5, color: '#047857', lineHeight: 17 },
  guestLoginBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#059669',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  guestLoginBtnText: { color: '#fff', fontSize: 12.5, fontWeight: '800' },

  // Developer Card (Prestigious & High Credibility)
  developerCard: {
    borderRadius: 22,
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  developerHeaderGradient: {
    padding: 18,
    gap: 12,
  },
  developerRoleBadge: {
    alignSelf: 'flex-start',
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
  developerRoleBadgeText: {
    color: '#34d399',
    fontSize: 11,
    fontWeight: '900',
  },
  developerProfileRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
  },
  developerAvatarBox: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(5, 150, 105, 0.25)',
    borderWidth: 2,
    borderColor: '#34d399',
    alignItems: 'center',
    justifyContent: 'center',
  },
  developerAvatarInitials: {
    color: '#34d399',
    fontSize: 18,
    fontWeight: '900',
  },
  developerName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'right',
  },
  developerTitle: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
    textAlign: 'right',
  },
  developerMission: {
    color: '#cbd5e1',
    fontSize: 11,
    marginTop: 4,
    textAlign: 'right',
    lineHeight: 16,
  },
  developerContactBox: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 10,
  },
  developerPhoneRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  developerPhoneLabel: {
    color: '#e2e8f0',
    fontSize: 11.5,
    fontWeight: '700',
  },
  developerPhoneValue: {
    color: '#34d399',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  developerActionBtnsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  devBtnCall: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0284c7',
    paddingVertical: 9,
    borderRadius: 11,
  },
  devBtnCallText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
  devBtnWa: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#16a34a',
    paddingVertical: 9,
    borderRadius: 11,
  },
  devBtnWaText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },

  // Section Headers
  sectionHeader: { fontSize: 15, fontWeight: '900', color: '#0f172a', textAlign: 'right', marginTop: 4 },

  // Quick Hub Grid (4 Cards)
  quickHubGrid: {
    flexDirection: 'row-reverse',
    gap: 10,
  },
  quickHubCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 5,
    elevation: 1,
  },
  quickHubIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  quickHubTitle: { fontSize: 12, fontWeight: '900', color: '#0f172a', textAlign: 'center' },
  quickHubSub: { fontSize: 9.5, color: '#64748b', fontWeight: '600', marginTop: 1, textAlign: 'center' },

  // Menu Group
  menuGroup: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
    gap: 12,
  },
  menuIconBox: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemTitle: { fontSize: 13.5, fontWeight: '900', color: '#0f172a' },
  menuItemSub: { fontSize: 11.5, color: '#64748b', lineHeight: 16 },
  menuBadge: {
    backgroundColor: '#059669',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  menuBadgeText: { color: '#fff', fontSize: 10, fontWeight: '900' },

  // Future Box
  futureBox: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 20,
    padding: 16,
    gap: 10,
    shadowColor: '#0f172a',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  futureHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  futureTitle: { fontSize: 15, fontWeight: '900', color: '#0f172a' },
  futureSub: { fontSize: 12, color: '#64748b', textAlign: 'right', lineHeight: 18 },
  futureItemsGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  futureItem: {
    width: '48.5%',
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'flex-end',
    gap: 4,
  },
  futureItemTitle: { fontSize: 12.5, fontWeight: '900', color: '#0f172a' },
  futureItemDesc: { fontSize: 10.5, color: '#64748b', textAlign: 'right', lineHeight: 15 },
  suggestBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    paddingVertical: 11,
    borderRadius: 12,
    marginTop: 6,
  },
  suggestBtnText: { fontSize: 12.5, fontWeight: '800', color: '#047857' },

  // FAQ
  faqCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    shadowColor: '#0f172a',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  faqItem: { borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingHorizontal: 14 },
  faqQuestionRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
  },
  faqQuestion: { flex: 1, fontSize: 13, fontWeight: '800', color: '#0f172a', textAlign: 'right' },
  faqAnswer: {
    fontSize: 12,
    color: '#475569',
    textAlign: 'right',
    lineHeight: 19,
    paddingBottom: 14,
    paddingRight: 24,
  },

  // Logout
  logoutBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 14,
    paddingVertical: 13,
  },
  logoutBtnText: { fontSize: 13.5, fontWeight: '900', color: '#dc2626' },

  // Footer
  footerBox: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 4,
  },
  footerTitle: { fontSize: 14, fontWeight: '900', color: '#059669' },
  footerSub: { fontSize: 11.5, color: '#64748b', textAlign: 'center', maxWidth: 360, lineHeight: 17 },
  footerBadgeRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  footerBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 10,
  },
  footerBadgeText: { fontSize: 10, fontWeight: '700', color: '#475569' },
  footerVersion: { fontSize: 10.5, color: '#94a3b8', marginTop: 8 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.65)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingBottom: 14,
    marginBottom: 12,
  },
  modalTitle: { fontSize: 16, fontWeight: '900', color: '#0f172a' },
  modalCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ideaHelpText: { fontSize: 12.5, color: '#475569', textAlign: 'right', marginBottom: 10, lineHeight: 18 },
  ideaInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 14,
    padding: 12,
    fontSize: 13.5,
    color: '#0f172a',
    height: 100,
    textAlignVertical: 'top',
  },
  submitIdeaBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#059669',
    borderRadius: 14,
    paddingVertical: 13,
    marginTop: 14,
  },
  submitIdeaBtnText: { color: '#fff', fontSize: 13, fontWeight: '900' },
});
