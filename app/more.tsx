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
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useBottomNavInset } from '@/lib/bottomNav';
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
  Lock,
  ChevronRight,
  Send,
  X,
  Wrench,
  Car,
  Flame,
  Users,
  Mail,
  Star,
  Rocket,
  Globe,
  FileText,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { requireAccount } from '@/lib/authGate';
import * as Location from 'expo-location';
import { MapPin, RefreshCw, Sun, Cloud, CloudRain, CloudSun, CloudFog, Wind, Droplets, Thermometer, Sunrise, Sunset, Search } from 'lucide-react-native';

export default function MoreScreen() {
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
    const text = 'تطبيق حيّنا 🇸🇦 — مجتمع وسوق وخدمات حيك في مكان واحد!\nhttps://appksatest.vercel.app';
    try {
      await Share.share({ message: text, title: 'حيّنا' });
    } catch {}
  };

  const openExternal = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('تعذّر الفتح', 'لا يمكن فتح الرابط على هذا الجهاز.');
    }
  };

  const handleContactSupport = () => {
    openExternal('mailto:support@hayna.app?subject=' + encodeURIComponent('الدعم - تطبيق حيّنا'));
  };

  const handleOpenPolicy = () => {
    openExternal('https://appksatest.vercel.app/privacy');
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

  const FAQS = [
    {
      q: 'هل تُرسل طلبات أو عروض مساعدة تلقائياً؟',
      a: 'لا. لا يرسل التطبيق أي طلب أو عرض مساعدة نيابةً عنك. جميع الطلبات والعروض تُنشأ فقط عندما يضغط المستخدم الحقيقي على زر الإرسال بنفسه.',
    },
    {
      q: 'كيف أطلب فزعة أو مساعدة من جيراني؟',
      a: 'من قسم «فزعة وطلبات المساعدة» اضغط «طلب جديد»، اكتب التفاصيل وحدّد حيّك ثم انشر. سيصل طلبك لجيرانك القريبين منك.',
    },
    {
      q: 'هل موقعي الدقيق ظاهر للجميع؟',
      a: 'لا. يُعرض موقعك على مستوى الحي فقط لحماية خصوصيتك، ويتم تبادل الموقع الدقيق بالخاص وبموافقتك فقط.',
    },
    {
      q: 'ما فائدة نقاط السمعة وشارات الجار الفاعل؟',
      a: 'تُمنح نقاط السمعة للجيران المتعاونين عند إتمام الفزعات والإجابات المفيدة، وتظهر كشارات تميّز في ملفك الشخصي.',
    },
  ];

  const APP_VERSION = '2.5.0';

  return (
    <View style={styles.container}>
      {/* Compact Hero Header */}
      <LinearGradient
        colors={['#064e3b', '#065f46', '#047857']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <View style={styles.heroTopRow}>
          <View style={styles.heroVersionPill}>
            <Sparkles size={12} color="#a7f3d0" />
            <Text style={styles.heroVersionText}>الإصدار {APP_VERSION}</Text>
          </View>
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            <Text style={styles.heroTitle}>المزيد والخدمات 🌟</Text>
            <Text style={styles.heroSubtitle}>كل خدمات حيّك في مكان واحد — مجتمع، سوق، وفزعة 🇸🇦</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomNavInset + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentWrap}>
          {!hasSession && (
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

          <WeatherSection initialCity={profile?.city || ''} />

          {/* 3. CORE NEIGHBORHOOD SERVICES — unique destinations only */}
          <Text style={styles.sectionHeader}>خدمات إضافية للحي 🏬</Text>
          <View style={styles.menuGroup}>
            <MenuItem
              icon={<Truck size={20} color="#ea580c" />}
              iconBg="#fff7ed"
              title="فزعة وطلبات المساعدة"
              sub="طلبات المساعدة وإعارة الأدوات بين الجيران"
              onPress={() => router.push('/requests')}
            />
            <MenuItem
              icon={<Wrench size={20} color="#16a34a" />}
              iconBg="#f0fdf4"
              title="سلفني بالحي"
              sub="استعر وأعِر أدوات ومعدات الصيانة"
              badge="جديد"
              badgeColor="#16a34a"
              onPress={() => router.push('/tools')}
            />
            <MenuItem
              icon={<Car size={20} color="#059669" />}
              iconBg="#ecfdf5"
              title="توصيل مدارس الحي"
              sub="مشاركة المقاعد بين أولياء الأمور"
              badge="جديد"
              badgeColor="#059669"
              onPress={() => router.push('/carpooling')}
            />
            <MenuItem
              icon={<Flame size={20} color="#dc2626" />}
              iconBg="#fef2f2"
              title="تنبيه الحي العاجل"
              sub="تنبيهات الطوارئ وطلبات المساعدة الفورية"
              badge="عاجل"
              badgeColor="#dc2626"
              onPress={() => router.push('/emergency-alert')}
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
              onPress={() => (hasSession ? router.push('/settings') : requireAccount())}
            />
            <MenuItem
              icon={<Share2 size={20} color="#0284c7" />}
              iconBg="#f0f9ff"
              title="شارك تطبيق حيّنا مع جيرانك"
              sub="ادعُ جيرانك في الحي والعمارة للانضمام"
              onPress={handleShareApp}
            />
            <MenuItem
              icon={<Star size={20} color="#d97706" />}
              iconBg="#fffbeb"
              title="قيّم تجربتك في حيّنا"
              sub="رأيك يساعدنا على تطوير المنصة لخدمة حيّك"
              onPress={() => openExternal('https://appksatest.vercel.app')}
            />
          </View>

          {/* 6.5 FREQUENTLY ASKED QUESTIONS */}
          <Text style={styles.sectionHeader}>أسئلة شائعة 💬</Text>
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

          {/* 6.6 SUPPORT & CONTACT */}
          <Text style={styles.sectionHeader}>الدعم والتواصل 📞</Text>
          <View style={styles.menuGroup}>
            <MenuItem
              icon={<Mail size={20} color="#0284c7" />}
              iconBg="#f0f9ff"
              title="تواصل مع فريق الدعم"
              sub="support@hayna.app — نسعد بخدمتك ومساعدتك"
              onPress={handleContactSupport}
            />
            <MenuItem
              icon={<FileText size={20} color="#7c3aed" />}
              iconBg="#f5f3ff"
              title="سياسة الخصوصية والشروط"
              sub="نحمي بياناتك ونحترم خصوصية حيّك"
              onPress={handleOpenPolicy}
            />
            <MenuItem
              icon={<Globe size={20} color="#059669" />}
              iconBg="#ecfdf5"
              title="زيارة موقع حيّنا"
              sub="appksatest.vercel.app"
              onPress={() => openExternal('https://appksatest.vercel.app')}
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
            <View style={styles.footerBadgeRow}>
              <View style={styles.footerBadge}>
                <ShieldCheck size={12} color="#047857" />
                <Text style={styles.footerBadgeText}>بيانات حقيقية بلا طلبات تجريبية</Text>
              </View>
              <View style={styles.footerBadge}>
                <Rocket size={12} color="#0369a1" />
                <Text style={styles.footerBadgeText}>تحديثات مستمرة</Text>
              </View>
            </View>
            <Text style={styles.footerVersion}>الإصدار {APP_VERSION} · التحديث المطور</Text>
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


type WeatherData = { city: string; current: any; hourly: any; daily: any };

function weatherDescription(code: number) {
  if (code === 0) return 'سماء صافية';
  if ([1, 2].includes(code)) return 'غائم جزئياً';
  if (code === 3) return 'غائم';
  if ([45, 48].includes(code)) return 'ضباب';
  if ([51, 53, 55, 56, 57].includes(code)) return 'رذاذ';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'أمطار';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'ثلوج';
  if ([95, 96, 99].includes(code)) return 'عواصف رعدية';
  return 'حالة جوية متغيرة';
}

function WeatherGlyph({ code, size = 28, color = '#d97706' }: { code: number; size?: number; color?: string }) {
  if (code === 0) return <Sun size={size} color={color} />;
  if ([1, 2].includes(code)) return <CloudSun size={size} color={color} />;
  if ([45, 48].includes(code)) return <CloudFog size={size} color={color} />;
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(code)) return <CloudRain size={size} color={color} />;
  return <Cloud size={size} color={color} />;
}

function WeatherSection({ initialCity }: { initialCity: string }) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [weatherError, setWeatherError] = useState('');
  const [cityInput, setCityInput] = useState(initialCity);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    if (initialCity.trim()) {
      setCityInput(initialCity);
      loadWeatherForCity(initialCity);
    }
  }, [initialCity]);

  const fetchWeather = async (latitude: number, longitude: number, city: string) => {
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + latitude +
      '&longitude=' + longitude +
      '&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m' +
      '&hourly=temperature_2m,precipitation_probability,weather_code' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max&forecast_days=5&timezone=auto';
    const response = await fetch(url);
    if (!response.ok) throw new Error('خدمة الطقس غير متاحة حالياً.');
    const data = await response.json();
    if (!data.current || !data.daily) throw new Error('وصلت بيانات طقس غير مكتملة.');
    setWeather({ city: city, current: data.current, hourly: data.hourly, daily: data.daily });
    setLastUpdated(new Date());
    setWeatherError('');
  };

  const loadWeatherForCity = async (cityName: string) => {
    const trimmed = cityName.trim();
    if (!trimmed) {
      setWeatherError('اكتب اسم المدينة أو فعّل موقع الجهاز لعرض الطقس.');
      return;
    }
    setLoadingWeather(true);
    setWeatherError('');
    try {
      const geoResponse = await fetch('https://geocoding-api.open-meteo.com/v1/search?name=' +
        encodeURIComponent(trimmed) + '&count=1&language=ar&format=json');
      if (!geoResponse.ok) throw new Error('تعذّر الاتصال بخدمة تحديد المدينة.');
      const geo = await geoResponse.json();
      const place = geo.results && geo.results[0];
      if (!place) throw new Error('لم نعثر على المدينة. جرّب كتابة اسمها بالعربية أو الإنجليزية.');
      await fetchWeather(place.latitude, place.longitude, place.name || trimmed);
    } catch (error: any) {
      setWeatherError(error?.message || 'تعذّر تحميل بيانات الطقس. حاول مرة أخرى.');
    } finally {
      setLoadingWeather(false);
    }
  };

  const useDeviceLocation = async () => {
    setLoadingWeather(true);
    setWeatherError('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') throw new Error('اسمح باستخدام موقعك أثناء الاستخدام، أو اكتب اسم المدينة يدوياً.');
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      let city = 'موقعك الحالي';
      try {
        const addresses = await Location.reverseGeocodeAsync({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        const address = addresses[0];
        city = address?.city || address?.district || address?.region || city;
      } catch {}
      setCityInput(city === 'موقعك الحالي' ? '' : city);
      await fetchWeather(position.coords.latitude, position.coords.longitude, city);
    } catch (error: any) {
      setWeatherError(error?.message || 'تعذّر تحديد موقعك.');
    } finally {
      setLoadingWeather(false);
    }
  };

  const hourlyIndices = (() => {
    if (!weather?.hourly?.time) return [];
    const now = new Date();
    let start = weather.hourly.time.findIndex((time: string) => new Date(time).getTime() >= now.getTime() - 3600000);
    if (start < 0) start = 0;
    return Array.from({ length: 6 }, (_, i) => start + i).filter((index) => index < weather.hourly.time.length);
  })();

  const dayLabel = (value: string, index: number) => {
    if (index === 0) return 'اليوم';
    if (index === 1) return 'غداً';
    return new Intl.DateTimeFormat('ar-SA', { weekday: 'short' }).format(new Date(value + 'T12:00:00'));
  };

  return (
    <View style={weatherStyles.section}>
      <View style={weatherStyles.sectionHeading}>
        <View style={weatherStyles.livePill}><View style={weatherStyles.liveDot} /><Text style={weatherStyles.liveText}>بيانات مباشرة</Text></View>
        <View style={weatherStyles.headingCopy}>
          <Text style={weatherStyles.sectionTitle}>الطقس حولك</Text>
          <Text style={weatherStyles.sectionSubtitle}>الآن وتوقعات الأيام القادمة</Text>
        </View>
        <View style={weatherStyles.headingIcon}><Sun size={21} color="#d97706" /></View>
      </View>

      <View style={weatherStyles.card}>
        <LinearGradient
          colors={weather?.current?.is_day ? ['#0f766e', '#0e7490', '#155e75'] : ['#1e3a5f', '#334155', '#475569']}
          start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={weatherStyles.currentPanel}
        >
          <View style={weatherStyles.weatherTopLine}>
            <Pressable onPress={() => loadWeatherForCity(cityInput || weather?.city || '')} disabled={loadingWeather} style={weatherStyles.refreshButton} accessibilityLabel="تحديث الطقس">
              {loadingWeather ? <ActivityIndicator size="small" color="#fff" /> : <RefreshCw size={16} color="#fff" />}
            </Pressable>
            <View style={weatherStyles.cityLine}><MapPin size={14} color="#d1fae5" /><Text style={weatherStyles.cityName}>{weather?.city || 'اختر مدينتك'}</Text></View>
          </View>
          {weather ? (
            <>
              <View style={weatherStyles.currentMain}>
                <View style={weatherStyles.tempCopy}>
                  <Text style={weatherStyles.conditionText}>{weatherDescription(weather.current.weather_code)}</Text>
                  <Text style={weatherStyles.feelsLike}>المحسوسة {Math.round(weather.current.apparent_temperature)}°</Text>
                </View>
                <View style={weatherStyles.tempAndIcon}>
                  <WeatherGlyph code={weather.current.weather_code} size={43} color="#fde68a" />
                  <Text style={weatherStyles.temperature}>{Math.round(weather.current.temperature_2m)}°</Text>
                </View>
              </View>
              <View style={weatherStyles.sunTimes}>
                <View style={weatherStyles.sunTimeItem}><Sunset size={15} color="#fde68a" /><Text style={weatherStyles.sunTimeText}>الغروب</Text><Text style={weatherStyles.sunTimeValue}>{weather.daily.sunset?.[0] ? new Date(weather.daily.sunset[0]).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : '--'}</Text></View>
                <View style={weatherStyles.sunTimeDivider} />
                <View style={weatherStyles.sunTimeItem}><Sunrise size={15} color="#fde68a" /><Text style={weatherStyles.sunTimeText}>الشروق</Text><Text style={weatherStyles.sunTimeValue}>{weather.daily.sunrise?.[0] ? new Date(weather.daily.sunrise[0]).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : '--'}</Text></View>
              </View>
            </>
          ) : (
            <View style={weatherStyles.emptyWeather}>
              {loadingWeather ? <ActivityIndicator size="large" color="#fff" /> : <><CloudSun size={40} color="#fde68a" /><Text style={weatherStyles.emptyTitle}>اعرف أجواء مدينتك</Text><Text style={weatherStyles.emptySub}>طقس فعلي وتوقعات محدثة من Open-Meteo</Text></>}
            </View>
          )}
        </LinearGradient>

        <View style={weatherStyles.citySearchRow}>
          <Pressable style={weatherStyles.locationButton} onPress={useDeviceLocation} disabled={loadingWeather}><MapPin size={15} color="#047857" /><Text style={weatherStyles.locationButtonText}>موقعي</Text></Pressable>
          <Pressable style={weatherStyles.searchButton} onPress={() => loadWeatherForCity(cityInput)} disabled={loadingWeather || !cityInput.trim()}><Search size={15} color="#fff" /></Pressable>
          <TextInput value={cityInput} onChangeText={setCityInput} placeholder="اكتب اسم المدينة" placeholderTextColor="#94a3b8" style={weatherStyles.cityInput} textAlign="right" returnKeyType="search" onSubmitEditing={() => loadWeatherForCity(cityInput)} />
        </View>

        {weatherError ? <Text style={weatherStyles.errorText}>{weatherError}</Text> : null}

        {weather && (
          <>
            <View style={weatherStyles.metricsGrid}>
              <View style={weatherStyles.metricCard}><View style={[weatherStyles.metricIcon, { backgroundColor: '#eff6ff' }]}><Thermometer size={17} color="#2563eb" /></View><Text style={weatherStyles.metricLabel}>المحسوسة</Text><Text style={weatherStyles.metricValue}>{Math.round(weather.current.apparent_temperature)}°</Text></View>
              <View style={weatherStyles.metricCard}><View style={[weatherStyles.metricIcon, { backgroundColor: '#ecfeff' }]}><Droplets size={17} color="#0891b2" /></View><Text style={weatherStyles.metricLabel}>الرطوبة</Text><Text style={weatherStyles.metricValue}>{weather.current.relative_humidity_2m}%</Text></View>
              <View style={weatherStyles.metricCard}><View style={[weatherStyles.metricIcon, { backgroundColor: '#f0fdf4' }]}><Wind size={17} color="#16a34a" /></View><Text style={weatherStyles.metricLabel}>الرياح</Text><Text style={weatherStyles.metricValue}>{Math.round(weather.current.wind_speed_10m)} <Text style={weatherStyles.metricUnit}>كم/س</Text></Text></View>
              <View style={weatherStyles.metricCard}><View style={[weatherStyles.metricIcon, { backgroundColor: '#fff7ed' }]}><CloudRain size={17} color="#ea580c" /></View><Text style={weatherStyles.metricLabel}>الهطول</Text><Text style={weatherStyles.metricValue}>{weather.current.precipitation} <Text style={weatherStyles.metricUnit}>مم</Text></Text></View>
            </View>
            <View style={weatherStyles.forecastHeader}><Text style={weatherStyles.forecastTitle}>توقعات الساعات القادمة</Text><Text style={weatherStyles.forecastHint}>6 ساعات</Text></View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={weatherStyles.hourlyList}>
              {hourlyIndices.map((index) => (
                <View key={weather.hourly.time[index]} style={weatherStyles.hourCard}>
                  <Text style={weatherStyles.hourText}>{new Date(weather.hourly.time[index]).toLocaleTimeString('ar-SA', { hour: '2-digit', hour12: true })}</Text>
                  <WeatherGlyph code={weather.hourly.weather_code[index]} size={23} />
                  <Text style={weatherStyles.hourTemp}>{Math.round(weather.hourly.temperature_2m[index])}°</Text>
                  <View style={weatherStyles.rainChance}><Droplets size={10} color="#0284c7" /><Text style={weatherStyles.rainText}>{weather.hourly.precipitation_probability[index] ?? 0}%</Text></View>
                </View>
              ))}
            </ScrollView>
            <View style={weatherStyles.forecastHeader}><Text style={weatherStyles.forecastTitle}>توقعات 5 أيام</Text><Text style={weatherStyles.forecastHint}>العظمى / الصغرى</Text></View>
            {weather.daily.time.map((date: string, index: number) => (
              <View key={date} style={weatherStyles.dayRow}>
                <Text style={weatherStyles.dayLow}>{Math.round(weather.daily.temperature_2m_min[index])}°</Text>
                <Text style={weatherStyles.dayHigh}>{Math.round(weather.daily.temperature_2m_max[index])}°</Text>
                <View style={weatherStyles.dayCondition}><Text style={weatherStyles.dayConditionText}>{weatherDescription(weather.daily.weather_code[index])}</Text><WeatherGlyph code={weather.daily.weather_code[index]} size={21} /></View>
                <Text style={weatherStyles.dayName}>{dayLabel(date, index)}</Text>
              </View>
            ))}
            <View style={weatherStyles.weatherFooter}>
              <Text style={weatherStyles.sourceText}>المصدر: Open-Meteo · آخر تحديث {lastUpdated ? lastUpdated.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' }) : ''}</Text>
              <Text style={weatherStyles.uvText}>مؤشر الأشعة فوق البنفسجية: {weather.daily.uv_index_max?.[0] ?? '--'}</Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const weatherStyles = StyleSheet.create({
  section: { gap: 10, marginBottom: 2 },
  sectionHeading: { flexDirection: 'row-reverse', alignItems: 'center', gap: 9, paddingHorizontal: 2 },
  headingCopy: { flex: 1, alignItems: 'flex-end', gap: 2 },
  sectionTitle: { fontSize: 17, fontWeight: '900', color: '#0f172a', textAlign: 'right' },
  sectionSubtitle: { fontSize: 11.5, color: '#64748b', textAlign: 'right' },
  headingIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#fffbeb', alignItems: 'center', justifyContent: 'center' },
  livePill: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, backgroundColor: '#ecfdf5', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 20 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#10b981' },
  liveText: { color: '#047857', fontSize: 10, fontWeight: '800' },
  card: { backgroundColor: '#fff', borderRadius: 23, borderWidth: 1, borderColor: '#e2e8f0', overflow: 'hidden', shadowColor: '#0f172a', shadowOpacity: 0.05, shadowRadius: 12, elevation: 2 },
  currentPanel: { padding: 17, minHeight: 190 },
  weatherTopLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  refreshButton: { width: 34, height: 34, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  cityLine: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5 },
  cityName: { color: '#fff', fontSize: 13, fontWeight: '800' },
  currentMain: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16 },
  tempAndIcon: { flexDirection: 'row-reverse', alignItems: 'center', gap: 9 },
  temperature: { color: '#fff', fontSize: 51, fontWeight: '300', letterSpacing: -2 },
  tempCopy: { alignItems: 'flex-end', gap: 5 },
  conditionText: { color: '#fff', fontSize: 15, fontWeight: '900' },
  feelsLike: { color: '#dbeafe', fontSize: 11.5 },
  sunTimes: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 13, padding: 10, gap: 13 },
  sunTimeItem: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', gap: 5 },
  sunTimeText: { color: '#e2e8f0', fontSize: 10 },
  sunTimeValue: { color: '#fff', fontSize: 10.5, fontWeight: '800' },
  sunTimeDivider: { width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.25)' },
  emptyWeather: { alignItems: 'center', justifyContent: 'center', gap: 9, paddingVertical: 21 },
  emptyTitle: { color: '#fff', fontSize: 16, fontWeight: '900' },
  emptySub: { color: '#e0f2fe', fontSize: 11, textAlign: 'center', lineHeight: 17 },
  citySearchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
  locationButton: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, backgroundColor: '#ecfdf5', borderRadius: 11, paddingHorizontal: 10, paddingVertical: 10 },
  locationButtonText: { color: '#047857', fontSize: 11, fontWeight: '900' },
  searchButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', backgroundColor: '#047857', borderRadius: 11 },
  cityInput: { flex: 1, minWidth: 80, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 11, paddingHorizontal: 11, paddingVertical: 9, color: '#0f172a', fontSize: 12.5 },
  errorText: { color: '#b91c1c', fontSize: 11.5, textAlign: 'right', paddingHorizontal: 14, paddingTop: 8, lineHeight: 17 },
  metricsGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', padding: 11, gap: 8 },
  metricCard: { width: '48%', flexGrow: 1, flexBasis: '44%', backgroundColor: '#fff', borderWidth: 1, borderColor: '#f1f5f9', borderRadius: 15, padding: 11, alignItems: 'flex-end', gap: 5 },
  metricIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  metricLabel: { color: '#64748b', fontSize: 10.5, fontWeight: '700' },
  metricValue: { color: '#0f172a', fontSize: 18, fontWeight: '900' },
  metricUnit: { color: '#64748b', fontSize: 9.5, fontWeight: '700' },
  forecastHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingTop: 7, paddingBottom: 10 },
  forecastTitle: { color: '#0f172a', fontSize: 13, fontWeight: '900' },
  forecastHint: { color: '#94a3b8', fontSize: 10.5 },
  hourlyList: { flexDirection: 'row-reverse', gap: 8, paddingHorizontal: 12, paddingBottom: 15 },
  hourCard: { minWidth: 66, alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 11, paddingHorizontal: 8, borderRadius: 14, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#f1f5f9' },
  hourText: { color: '#64748b', fontSize: 10 },
  hourTemp: { color: '#0f172a', fontSize: 15, fontWeight: '900' },
  rainChance: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  rainText: { color: '#0284c7', fontSize: 9.5, fontWeight: '800' },
  dayRow: { flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 15, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9', gap: 11 },
  dayName: { color: '#334155', fontSize: 11.5, fontWeight: '800', width: 42, textAlign: 'right' },
  dayCondition: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', gap: 7 },
  dayConditionText: { color: '#64748b', fontSize: 11 },
  dayHigh: { color: '#0f172a', fontSize: 12, fontWeight: '900', width: 28, textAlign: 'center' },
  dayLow: { color: '#94a3b8', fontSize: 12, fontWeight: '700', width: 28, textAlign: 'center' },
  weatherFooter: { paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#f8fafc', gap: 4, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  sourceText: { color: '#94a3b8', fontSize: 9.5, textAlign: 'right' },
  uvText: { color: '#64748b', fontSize: 10.5, textAlign: 'right', fontWeight: '700' },
});


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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },

  // Hero Header
  hero: {
    paddingTop: Platform.OS === 'ios' ? 54 : 40,
    paddingHorizontal: 16,
    paddingBottom: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    gap: 16,
  },
  heroTopRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  heroTitle: { fontSize: 22, fontWeight: '900', color: '#fff', textAlign: 'right' },
  heroSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'right',
    marginTop: 4,
    lineHeight: 17,
    fontWeight: '600',
  },
  heroVersionPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  heroVersionText: { color: '#a7f3d0', fontSize: 10.5, fontWeight: '800' },
  statsRow: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    gap: 3,
  },
  statIconRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  statValue: { color: '#fff', fontSize: 17, fontWeight: '900' },
  statLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: '700' },

  // Quick Actions
  quickGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
  },
  quickCard: {
    width: '48%',
    borderRadius: 18,
    padding: 14,
    minHeight: 108,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
  },
  quickIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: { color: '#fff', fontSize: 14, fontWeight: '900', textAlign: 'right' },
  quickSub: { color: 'rgba(255,255,255,0.85)', fontSize: 10.5, textAlign: 'right', fontWeight: '600' },

  // How it works
  howCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    gap: 14,
  },
  howRow: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 10 },
  howStepCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  howStepText: { color: '#047857', fontSize: 14, fontWeight: '900' },
  howTitle: { fontSize: 14, fontWeight: '900', color: '#0f172a', textAlign: 'right' },
  howDesc: { fontSize: 11.5, color: '#64748b', textAlign: 'right', lineHeight: 17 },
  howConnector: { display: 'none' },
  honestyNote: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    borderRadius: 14,
    padding: 12,
  },
  honestyNoteText: {
    flex: 1,
    color: '#047857',
    fontSize: 11.5,
    lineHeight: 17,
    fontWeight: '700',
    textAlign: 'right',
  },

  // FAQ
  faqCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
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
