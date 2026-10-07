import { useState, useEffect } from 'react';
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
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useBottomNavInset } from '@/lib/bottomNav';
import {
  User,
  ShieldCheck,
  ChevronLeft,
  MapPin,
  Map,
  ShoppingBag,
  Building2,
  Calendar,
  Truck,
  MessageCircle,
  Settings,
  Bell,
  Share2,
  HelpCircle,
  LogOut,
  LogIn,
  LayoutDashboard,
  Sparkles,
  CreditCard,
  Building,
  PackageCheck,
  Lightbulb,
  Award,
  Lock,
  ChevronRight,
  Send,
  X,
  Compass,
  Wrench,
  Car,
  Flame,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { requireAccount } from '@/lib/authGate';
import { getActiveLocation, type HaynaLocation } from '@/lib/locationSync';

export default function MoreScreen() {
  const bottomNavInset = useBottomNavInset();
  const [profile, setProfile] = useState<any>(null);
  const [hasSession, setHasSession] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [unreadNotif, setUnreadNotif] = useState(0);
  const [location, setLocation] = useState<HaynaLocation>({
    region: 'كل المملكة',
    city: 'كل المدن',
    district: 'كل الأحياء',
  });

  // Suggestion Modal State
  const [showIdeaModal, setShowIdeaModal] = useState(false);
  const [ideaText, setIdeaText] = useState('');
  const [sendingIdea, setSendingIdea] = useState(false);

  useEffect(() => {
    loadUserData();
    getActiveLocation().then(setLocation);
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

      const isRoot = (user.email || '').toLowerCase().trim() === 'root@gmail.com';
      setIsAdmin(isRoot || p?.role === 'admin');
    } catch {}
  };

  const handleShareApp = async () => {
    const text = 'تطبيق حيّنا 🇸🇦 — مجتمع وسوق وخدمات حيك في مكان واحد!\nhttps://appksatest.vercel.app';
    try {
      await Share.share({ message: text, title: 'حيّنا' });
    } catch {}
  };

  const handleSignOut = () => {
    Alert.alert('تسجيل الخروج', 'هل أنت متأكد من تسجيل الخروج من حسابك؟', [
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
      Alert.alert('تنبيه', 'يرجى كتابة فكرتك أو اقتراحك.');
      return;
    }
    setSendingIdea(true);
    try {
      // Record feedback/idea in Supabase reports/feedback if table exists, or notify
      await supabase.from('reports').insert({
        reason: 'اقتراح ميزة مستقبلية: ' + ideaText.trim(),
        reporter_id: profile?.id || null,
        target_type: 'idea',
      });

      setShowIdeaModal(false);
      setIdeaText('');
      Alert.alert('شكراً لك! 🌟', 'تم إرسال اقتراحك لفريق التطوير وسنعمل على دراسته في التحديثات القادمة.');
    } catch {
      setShowIdeaModal(false);
    } finally {
      setSendingIdea(false);
    }
  };

  const locLabel =
    location.city === 'كل المدن'
      ? 'كل مناطق المملكة'
      : `${location.city}${location.district !== 'كل الأحياء' ? ` · حي ${location.district}` : ''}`;

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.topNavbar}>
        <Text style={styles.navTitle}>المزيد والخدمات 🌟</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomNavInset + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentWrap}>
          {/* 1. USER PROFILE GLANCE CARD */}
          {hasSession ? (
            <Pressable
              style={styles.profileCard}
              onPress={() => router.push('/profile')}
            >
              <View style={styles.profileEditPill}>
                <Text style={styles.profileEditPillText}>عرض الملف</Text>
                <ChevronLeft size={14} color="#059669" />
              </View>

              <View style={{ flex: 1, alignItems: 'flex-end', gap: 3 }}>
                <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                  <Text style={styles.profileName}>{profile?.display_name || 'الجار'}</Text>
                  {profile?.is_geoverified && <ShieldCheck size={16} color="#059669" />}
                </View>
                <Text style={styles.profileSub}>
                  {profile?.district ? `حي ${profile.district}` : ''} {profile?.city ? `· ${profile.city}` : 'أحد سكان الحي'}
                </Text>
              </View>

              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={styles.avatarImg} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarLetter}>{profile?.display_name?.[0] || 'ح'}</Text>
                </View>
              )}
            </Pressable>
          ) : (
            <View style={styles.guestBanner}>
              <View style={styles.guestIconCircle}>
                <User size={24} color="#059669" />
              </View>
              <View style={{ flex: 1, alignItems: 'flex-end', gap: 3 }}>
                <Text style={styles.guestTitle}>مرحباً بك في حيّنا! 🇸🇦</Text>
                <Text style={styles.guestSub}>سجّل دخولك أو أنشئ حساباً للتواصل مع جيرانك وطلب ونشر الخدمات.</Text>
              </View>
              <Pressable style={styles.guestLoginBtn} onPress={() => router.push('/auth')}>
                <LogIn size={15} color="#fff" />
                <Text style={styles.guestLoginBtnText}>دخول</Text>
              </Pressable>
            </View>
          )}

          {/* 2. ACTIVE LOCATION BAR */}
          <Pressable
            style={styles.locBar}
            onPress={() => router.push('/locations')}
          >
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 4 }}>
              <Text style={styles.locChangeText}>تغيير</Text>
              <ChevronLeft size={14} color="#059669" />
            </View>

            <View style={{ flex: 1, alignItems: 'flex-end', gap: 2 }}>
              <Text style={styles.locBarLabel}>الموقع المختار حالياً</Text>
              <Text style={styles.locBarValue} numberOfLines={1}>📍 {locLabel}</Text>
            </View>

            <View style={styles.locIconBox}>
              <Compass size={20} color="#059669" />
            </View>
          </Pressable>

          {/* 3. CORE NEIGHBORHOOD SERVICES */}
          <Text style={styles.sectionHeader}>خدمات وأقسام الحي 🏬</Text>
          <View style={styles.menuGroup}>
            <MenuItem
              icon={<Map size={20} color="#059669" />}
              iconBg="#ecfdf5"
              title="خريطة الحي التفاعلية"
              sub="استعراض الأنشطة والخدمات والمحلات مباشرة على الخريطة"
              badge="مباشر"
              onPress={() => router.push('/map')}
            />
            <MenuItem
              icon={<ShoppingBag size={20} color="#0284c7" />}
              iconBg="#f0f9ff"
              title="سوق الحي والأسر المنتجة"
              sub="عروض، منتجات، سلع، وأطعمة منزلية من أهل الحي"
              onPress={() => router.push('/market')}
            />
            <MenuItem
              icon={<Building2 size={20} color="#7c3aed" />}
              iconBg="#f5f3ff"
              title="دليل المحلات والمنشآت"
              sub="تموينات، صيدليات، مخابز، ورش، ومغاسل حيك"
              onPress={() => router.push('/market')}
            />
            <MenuItem
              icon={<Calendar size={20} color="#d97706" />}
              iconBg="#fffbeb"
              title="فعاليات وملتقيات الحي"
              sub="أنشطة اجتماعية ومبادرات تطوعية ورياضية"
              onPress={() => router.push('/market')}
            />
            <MenuItem
              icon={<Truck size={20} color="#ea580c" />}
              iconBg="#fff7ed"
              title="فزعة وطلبات المساعدة"
              sub="طلب مساعدة عاجلة أو إعارة أدوات بين الجيران"
              onPress={() => router.push('/requests')}
            />
            <MenuItem
              icon={<Wrench size={20} color="#16a34a" />}
              iconBg="#f0fdf4"
              title="سلفني بالحي (إعارة أدوات 🔧)"
              sub="استعر وأعِر الدريل، السلالم، ومعدات الصيانة مجاناً"
              badge="جديد"
              badgeColor="#16a34a"
              onPress={() => router.push('/tools')}
            />
            <MenuItem
              icon={<Car size={20} color="#059669" />}
              iconBg="#ecfdf5"
              title="توصيل مدارس الحي 🚗"
              sub="مشاركة المقاعد بين أولياء الأمور وتخفيف الزحام"
              badge="جديد"
              badgeColor="#059669"
              onPress={() => router.push('/carpooling')}
            />
            <MenuItem
              icon={<Flame size={20} color="#dc2626" />}
              iconBg="#fef2f2"
              title="تنبيه الحي العاجل 🚨"
              sub="بث حالات الطوارئ والمساعدة الفورية في الحي"
              badge="عاجل"
              badgeColor="#dc2626"
              onPress={() => router.push('/emergency-alert')}
            />
            <MenuItem
              icon={<MessageCircle size={20} color="#059669" />}
              iconBg="#ecfdf5"
              title="استفسارات وأسئلة الجيران"
              sub="اسأل أهل حيك واستفد من تجاربهم ومعرفتهم"
              onPress={() => router.push('/questions')}
            />
          </View>

          {/* 4. FUTURE EXPANSIONS & UPGRADES BOX (MODULAR SECTION) */}
          <View style={styles.futureBox}>
            <View style={styles.futureHeader}>
              <Sparkles size={18} color="#059669" />
              <Text style={styles.futureTitle}>المميزات والتطويرات القادمة 🚀</Text>
            </View>
            <Text style={styles.futureSub}>
              نعمل باستمرار على إضافة مميزات متطورة تخدم سكان الحي وعمارته:
            </Text>

            <View style={styles.futureItemsGrid}>
              <View style={styles.futureItem}>
                <CreditCard size={18} color="#0284c7" />
                <Text style={styles.futureItemTitle}>بطاقة الجار الذكية</Text>
                <Text style={styles.futureItemDesc}>خصومات وعروض خاصة لسكان الحي لدى المتاجر والشركاء (قريباً)</Text>
              </View>

              <View style={styles.futureItem}>
                <Building size={18} color="#7c3aed" />
                <Text style={styles.futureItemTitle}>مجلس وسكان العمارة</Text>
                <Text style={styles.futureItemDesc}>مجموعة خاصة لعمارتك لإدارة الصيانة ومشاركة الأخبار (قريباً)</Text>
              </View>

              <View style={styles.futureItem}>
                <PackageCheck size={18} color="#059669" />
                <Text style={styles.futureItemTitle}>صندوق أمانات الحي</Text>
                <Text style={styles.futureItemDesc}>استلام وتسليم الطرود والمفاتيح بأمان بين الجيران (قريباً)</Text>
              </View>

              <View style={styles.futureItem}>
                <Award size={18} color="#d97706" />
                <Text style={styles.futureItemTitle}>نقاط الجار الفاعل</Text>
                <Text style={styles.futureItemDesc}>مكافآت وشارات تميز للمساهمين في خدمة وإفادة الحي (قريباً)</Text>
              </View>
            </View>

            <Pressable
              style={styles.suggestBtn}
              onPress={() => setShowIdeaModal(true)}
            >
              <Lightbulb size={16} color="#047857" />
              <Text style={styles.suggestBtnText}>اقترح فكرة أو خدمة جديدة للمطورين 💡</Text>
            </Pressable>
          </View>

          {/* 5. ADMIN CONTROLS (ONLY IF ADMIN) */}
          {isAdmin && (
            <>
              <Text style={styles.sectionHeader}>لوحة إدارة وتحكم المشرف 🛠️</Text>
              <View style={styles.menuGroup}>
                <MenuItem
                  icon={<LayoutDashboard size={20} color="#dc2626" />}
                  iconBg="#fef2f2"
                  title="لوحة تحكم الإدارة (Admin Dashboard)"
                  sub="إدارة المستخدمين، التوثيق، البلاغات، والشعارات"
                  badge="مشرف"
                  badgeColor="#dc2626"
                  onPress={() => router.push('/admin')}
                />
              </View>
            </>
          )}

          {/* 6. SETTINGS & APP ACTIONS */}
          <Text style={styles.sectionHeader}>الإعدادات والتطبيق ⚙️</Text>
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
              title="إعدادات الحساب والخصوصية"
              sub="إدارة بياناتك والتوثيق والمظهر"
              onPress={() => isGuest ? requireAccount() : router.push('/settings')}
            />
            <MenuItem
              icon={<Share2 size={20} color="#0284c7" />}
              iconBg="#f0f9ff"
              title="شارك تطبيق حيّنا مع جيرانك"
              sub="ادعُ جيرانك في الحي والعمارة للانضمام"
              onPress={handleShareApp}
            />
          </View>

          {/* 7. SIGN OUT BUTTON (IF LOGGED IN) */}
          {hasSession && (
            <Pressable style={styles.logoutBtn} onPress={handleSignOut}>
              <LogOut size={18} color="#ef4444" />
              <Text style={styles.logoutBtnText}>تسجيل الخروج من الحساب</Text>
            </Pressable>
          )}

          {/* App Info Footer */}
          <View style={styles.footerBox}>
            <Text style={styles.footerTitle}>حيّنا — Hayna</Text>
            <Text style={styles.footerSub}>المنصة المجتمعية الرقمية لتعزيز الترابط والخدمات بين الجيران 🇸🇦</Text>
            <Text style={styles.footerVersion}>الإصدار 2.4.0 · التحديث المطور</Text>
          </View>
        </View>
      </ScrollView>

      {/* ======================================================== */}
      {/* MODAL: SUGGEST A FEATURE FOR FUTURE DEVELOPMENT          */}
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
                يسعدنا سماع أفكارك لتطوير تطبيق حيّنا! اكتب الخدمة أو الميزة التي تود رؤيتها في حيك:
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
                    <Text style={styles.submitIdeaBtnText}>إرسال الاقتراح للمطورين</Text>
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
  return (
    <Pressable
      style={({ pressed }) => [styles.menuItem, pressed && { backgroundColor: '#f8fafc' }]}
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

const isGuest = false;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },

  // Navbar
  topNavbar: {
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    paddingTop: Platform.OS === 'ios' ? 48 : 16,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  navTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0f172a',
    textAlign: 'right',
    maxWidth: 800,
    width: '100%',
    alignSelf: 'center',
  },

  scroll: { paddingTop: 14 },
  contentWrap: { maxWidth: 800, width: '100%', alignSelf: 'center', paddingHorizontal: 16, gap: 14 },

  // Profile Card
  profileCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  avatarImg: { width: 50, height: 50, borderRadius: 25 },
  avatarPlaceholder: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { fontSize: 19, fontWeight: '900', color: '#047857' },
  profileName: { fontSize: 16, fontWeight: '900', color: '#0f172a' },
  profileSub: { fontSize: 12, color: '#64748b', fontWeight: '600' },
  profileEditPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  profileEditPillText: { fontSize: 11.5, fontWeight: '800', color: '#059669' },

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

  // Location Bar
  locBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  locIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locBarLabel: { fontSize: 11, color: '#64748b', fontWeight: '700' },
  locBarValue: { fontSize: 13.5, fontWeight: '900', color: '#0f172a' },
  locChangeText: { fontSize: 12, fontWeight: '800', color: '#059669' },

  // Section Headers
  sectionHeader: { fontSize: 15, fontWeight: '900', color: '#0f172a', textAlign: 'right', marginTop: 4 },

  // Menu Group
  menuGroup: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
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
  menuItemTitle: { fontSize: 14, fontWeight: '900', color: '#0f172a' },
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
    backgroundColor: '#f8fafc',
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    borderRadius: 20,
    padding: 16,
    gap: 10,
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
    backgroundColor: '#fff',
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
    gap: 3,
  },
  footerTitle: { fontSize: 14, fontWeight: '900', color: '#059669' },
  footerSub: { fontSize: 11.5, color: '#64748b', textAlign: 'center' },
  footerVersion: { fontSize: 10.5, color: '#94a3b8', marginTop: 4 },

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
