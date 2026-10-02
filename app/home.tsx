import { useCallback, useState, useEffect, useRef } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Pressable, RefreshControl, ScrollView, Text, View, Image, StyleSheet, Dimensions, Platform, Animated, TextInput, Alert, Modal, ActivityIndicator } from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { getBrandingLogo, subscribeBrandingLogo } from '@/lib/branding'
import { LinearGradient } from 'expo-linear-gradient'
import { MessageCircle, Truck, MapPin, Briefcase, Plus, Sparkles, Map, Bell, Search, Flame, CloudSun, User, Mic, ChevronDown, Wrench, ShieldCheck, Camera, RefreshCw, X } from 'lucide-react-native'
import BottomNav from '@/components/BottomNav'
import LocationSelectorModal from '@/components/LocationSelectorModal'
import { useDynamicIsland } from '@/context/DynamicIslandContext'
import { getActiveLocation, setActiveLocation, savePermanentMyLocation, subscribeLocation, isExactDistrictMatching, isAllKingdom } from '@/lib/locationSync'
import TwitterInquiryCard from '@/components/TwitterInquiryCard'
import { CurrentWeather, describeWeatherCode, loadCurrentWeather } from '@/lib/weather'
import { getCurrentDeviceLocation, reverseGeocodeDeviceLocation } from '@/lib/deviceLocation'
import { registerPushToken } from '@/lib/notifications'

const { width } = Dimensions.get('window');

export default function Home() {
  const [logoUri, setLogoUri] = useState('/assets/branding/HAYNA_LOGO.png?v=2');
  const { showIsland } = useDynamicIsland();
  const [profile, setProfile] = useState<any>(null);
  useEffect(() => {
    getBrandingLogo().then(setLogoUri);
    return subscribeBrandingLogo(setLogoUri);
  }, []);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [stories, setStories] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'emergency' | 'tools' | 'questions' | 'requests' | 'mine'>('all');
  const [greeting, setGreeting] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Location filter state
  const [selectedRegion, setSelectedRegion] = useState('كل المملكة');
  const [selectedCity, setSelectedCity] = useState('كل المدن');
  const [selectedDistrict, setSelectedDistrict] = useState('كل الأحياء');
  const [currentWeather, setCurrentWeather] = useState<CurrentWeather | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationSetupOpen, setLocationSetupOpen] = useState(false);
  const [locationSetupBusy, setLocationSetupBusy] = useState(false);
  const [locationSetupMessage, setLocationSetupMessage] = useState('');
  const [locationPromptVisible, setLocationPromptVisible] = useState(false);


  // Unread badge count
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  // Toast feedback state

  // Animation for FAB
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const showToast = useCallback((msg: string) => {
    showIsland(msg, undefined, 'success');
  }, [showIsland]);

  useEffect(() => {
    let active = true;
    const updateWeather = async () => {
      setWeatherLoading(true);
      try {
        const weather = await loadCurrentWeather(selectedRegion, selectedCity, selectedDistrict);
        if (active) setCurrentWeather(weather);
      } catch (error) {
        console.warn('Weather update failed', error);
        if (active) setCurrentWeather(null);
      } finally { if (active) setWeatherLoading(false); }
    };
    updateWeather();
    const interval = setInterval(updateWeather, 30 * 60 * 1000);
    return () => { active = false; clearInterval(interval); };
  }, [selectedRegion, selectedCity, selectedDistrict]);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('صباح الخير');
    else setGreeting('مساء الخير');

    // Subscribe to global location sync
    getActiveLocation().then((loc) => {
      setSelectedRegion(loc.region);
      setSelectedCity(loc.city);
      setSelectedDistrict(loc.district);
    });

    const unsub = subscribeLocation((loc) => {
      setSelectedRegion(loc.region);
      setSelectedCity(loc.city);
      setSelectedDistrict(loc.district);
    });

    // Start FAB Pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true })
      ])
    ).start();

    return unsub;
  }, []);

  const refreshLiveLocation = useCallback(async () => {
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      const device = await getCurrentDeviceLocation();
      if (!device) return false;
      const place = await reverseGeocodeDeviceLocation(device);
      const live = {
        region: place?.region?.trim() || '',
        city: place?.city?.trim() || '',
        district: place?.district?.trim() || '',
      };
      if (!live.region || !live.city || !live.district) return false;

      await savePermanentMyLocation(live, true);
      setSelectedRegion(live.region);
      setSelectedCity(live.city);
      setSelectedDistrict(live.district);
      setProfile((current: any) => ({ ...(current || {}), ...live }));
      return true;
    } catch (error) {
      console.warn('live location refresh failed:', error);
      return false;
    }
  }, []);

  useEffect(() => {
    // Location is intentionally NOT refreshed on a timer.
    // It is requested once per 7 days, or manually from Profile.
    let active = true;
    const checkLocationAge = async () => {
      const raw = await AsyncStorage.getItem('@hayna_location_last_auto_check_v1');
      const last = raw ? Number(raw) : 0;
      const due = !last || Date.now() - last >= 7 * 24 * 60 * 60 * 1000;
      if (active && due) setLocationPromptVisible(true);
    };
    void checkLocationAge();
    return () => { active = false; };
  }, []);

  const acceptWeeklyLocationCheck = useCallback(async () => {
    setLocationPromptVisible(false);
    await AsyncStorage.setItem('@hayna_location_last_auto_check_v1', String(Date.now()));
    await refreshLiveLocation();
  }, [refreshLiveLocation]);

  const load = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) {
      router.replace('/auth');
      return;
    }

    setCurrentUserId(user.id);

    // Load the stable location once, then reuse it for every Home query.
    const [profileRes, locationRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      getActiveLocation(),
    ]);

    const profileData = profileRes.data;
    const loc = locationRes;
    setProfile(profileData);

    const locationComplete = !!(profileData?.region && profileData?.city && profileData?.district);
    setLocationSetupOpen(!locationComplete);
    if (!locationComplete) {
      setLocationSetupMessage('حدد موقعك تلقائياً لنربط حسابك بالمنطقة والمدينة والحي.');
    }

    if (profileData?.city && isAllKingdom(loc.city)) {
      await setActiveLocation(
        profileData.region || 'المملكة',
        profileData.city,
        profileData.district || 'كل الأحياء',
        false
      );
    }

    // Fetch the Home feed in parallel instead of waiting section-by-section.
    const [notificationsRes, storiesRes, questionsRes, requestsRes] = await Promise.all([
      supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .is('read_at', null),
      supabase
        .from('stories')
        .select('*, profiles:author_id(id, display_name, username, avatar_url, is_verified, is_geoverified, city, district)')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('questions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30),
      supabase
        .from('requests')
        .select('*')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(25),
    ]);

    setUnreadNotifCount(notificationsRes.count ?? 0);

    const seenStoryAuthors = new Set<string>();
    const uniqueStories = (storiesRes.data ?? []).filter((s: any) => {
      if (!s.author_id || seenStoryAuthors.has(s.author_id)) return false;
      const authorCity = s.profiles?.city || '';
      const authorDistrict = s.profiles?.district || '';
      if (!isAllKingdom(loc.city)) {
        if (loc.city && authorCity && authorCity !== loc.city) return false;
        if (
          loc.district &&
          loc.district !== 'كل الأحياء' &&
          authorDistrict &&
          authorDistrict !== loc.district
        ) return false;
      }
      seenStoryAuthors.add(s.author_id);
      return true;
    });
    setStories(uniqueStories);

    if (questionsRes.error) console.log('questions error:', questionsRes.error.message);
    const uniqueQData = (questionsRes.data ?? []).filter((q: any, index: number, arr: any[]) => {
      const title = (q.title || '').trim().toLowerCase();
      return arr.findIndex((item: any) => (item.title || '').trim().toLowerCase() === title) === index;
    });

    if (uniqueQData.length) {
      const authorIds = [...new Set(uniqueQData.map((q: any) => q.author_id).filter(Boolean))];
      const qIds = uniqueQData.map((q: any) => q.id);
      const [profilesRes, answersRes] = await Promise.all([
        authorIds.length ? supabase.from('profiles').select('*').in('id', authorIds) : Promise.resolve({ data: [] }),
        qIds.length ? supabase.from('answers').select('*').in('question_id', qIds).order('created_at', { ascending: true }) : Promise.resolve({ data: [] }),
      ]);

      const profileMap = (profilesRes.data || []).reduce((acc: any, p: any) => ({ ...acc, [p.id]: p }), {});
      const answerAuthorIds = [...new Set((answersRes.data || []).map((a: any) => a.author_id).filter(Boolean))];
      const { data: answerProfiles } = answerAuthorIds.length
        ? await supabase.from('profiles').select('*').in('id', answerAuthorIds)
        : { data: [] };
      const answerProfileMap = (answerProfiles || []).reduce((acc: any, p: any) => ({ ...acc, [p.id]: p }), {});

      const answersByQ: Record<string, any[]> = {};
      (answersRes.data || []).forEach((answer: any) => {
        answer.profiles = answerProfileMap[answer.author_id] || null;
        (answersByQ[answer.question_id] ||= []).push(answer);
      });

      setQuestions(uniqueQData.map((q: any) => ({
        ...q,
        profiles: profileMap[q.author_id] || null,
        answers: answersByQ[q.id] || [],
        answers_count: (answersByQ[q.id] || []).length,
      })));
    } else {
      setQuestions([]);
    }

    if (requestsRes.error) console.log('requests error:', requestsRes.error.message);
    const uniqueRData = (requestsRes.data ?? []).filter((item: any, index: number, arr: any[]) => {
      const title = (item.title || '').trim().toLowerCase();
      return arr.findIndex((candidate: any) => (candidate.title || '').trim().toLowerCase() === title) === index;
    });
    if (uniqueRData.length) {
      const requesterIds = [...new Set(uniqueRData.map((item: any) => item.requester_id).filter(Boolean))];
      const { data: requesterProfiles } = requesterIds.length
        ? await supabase.from('profiles').select('*').in('id', requesterIds)
        : { data: [] };
      const requesterMap = (requesterProfiles || []).reduce((acc: any, p: any) => ({ ...acc, [p.id]: p }), {});
      setRequests(uniqueRData.map((item: any) => ({
        ...item,
        profiles: requesterMap[item.requester_id] || null,
      })));
    } else {
      setRequests([]);
    }
  }, []);
  useFocusEffect(useCallback(() => { load() }, [load]));

  // Inline Quick Reply Handler
  const handleQuickReplySubmit = async (questionId: string, text: string) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      Alert.alert('تنبيه', 'يرجى تسجيل الدخول أولاً للرد');
      return;
    }

    const { data: newAns, error } = await supabase
      .from('answers')
      .insert({
        question_id: questionId,
        author_id: u.user.id,
        body: text.trim()
      })
      .select('*')
      .single();

    if (error) {
      Alert.alert('خطأ', 'تعذر إرسال الرد: ' + error.message);
      return;
    }

    // Optimistic local state update
    newAns.profiles = profile;
    setQuestions(prev => prev.map(q => {
      if (q.id === questionId) {
        const updatedAnswers = [...(q.answers || []), newAns];
        return {
          ...q,
          answers: updatedAnswers,
          answers_count: updatedAnswers.length,
        };
      }
      return q;
    }));

    showToast('تم نشر ردك بنجاح في المحادثة');
  };

  // Filter questions and requests by selected Saudi region / city / district strictly
  const normalizedSearch = normalizeSearchText(searchQuery);
  const matchesSearch = (values: unknown[]) => !normalizedSearch || values.some(value => normalizeSearchText(value).includes(normalizedSearch));

  const filteredQuestions = questions.filter(q => {
    if (!matchesSearch([q.title, q.body, q.profiles?.display_name, q.profiles?.username, q.city, q.district, q.category])) return false;
    return isExactDistrictMatching(q, selectedCity, selectedDistrict);
  });

  const filteredRequests = requests.filter(r => {
    if (!matchesSearch([r.title, r.description, r.profiles?.display_name, r.profiles?.username, r.city, r.district, r.category])) return false;
    return isExactDistrictMatching(r, selectedCity, selectedDistrict);
  });

  // Mine filter: user's own questions and requests
  const myQuestions = questions.filter(q => q.author_id === currentUserId);
  const myRequests = requests.filter(r => r.requester_id === currentUserId);
  const filteredMyQuestions = myQuestions.filter(q => matchesSearch([q.title, q.body, q.profiles?.display_name, q.profiles?.username, q.city, q.district, q.category]));
  const filteredMyRequests = myRequests.filter(r => matchesSearch([r.title, r.description, r.profiles?.display_name, r.profiles?.username, r.city, r.district, r.category]));

  // Emergency & Tools categorization
  const emergencyQuestions = filteredQuestions.filter(
    q => q.is_emergency || q.urgency_level === 'emergency' || (q.title && (q.title.includes('مفقود') || q.title.includes('طارئ') || q.title.includes('حادث')))
  );

  const toolQuestions = filteredQuestions.filter(
    q => q.is_tool_sharing || q.item_type === 'tool_sharing' || (q.title && (q.title.includes('إعارة') || q.title.includes('دريل') || q.title.includes('سلم')))
  );

  async function setupRequiredLocation() {
    if (locationSetupBusy) return;
    setLocationSetupBusy(true);
    setLocationSetupMessage('جارٍ تحديد موقعك وقراءة المنطقة والمدينة والحي…');
    try {
      const device = await getCurrentDeviceLocation();
      if (!device) {
        setLocationSetupMessage('لم نتمكن من الوصول إلى موقعك. فعّل إذن الموقع ثم اضغط المحاولة مرة أخرى.');
        return;
      }
      const place = await reverseGeocodeDeviceLocation(device);
      if (!place?.region || !place?.city || !place?.district) {
        setLocationSetupMessage('تم تحديد موقعك، لكن لم نستطع استخراج المنطقة والمدينة والحي بدقة. حاول مرة أخرى.');
        return;
      }

      await savePermanentMyLocation({
        region: place.region,
        city: place.city,
        district: place.district,
      }, true);

      setSelectedRegion(place.region);
      setSelectedCity(place.city);
      setSelectedDistrict(place.district);
      setProfile((current: any) => ({ ...(current || {}), region: place.region, city: place.city, district: place.district }));
      setLocationSetupMessage('تم حفظ موقعك. نطلب الآن تفعيل الإشعارات حتى لا تفوتك تنبيهات الحي…');

      const pushToken = await registerPushToken();
      setLocationSetupOpen(false);
      if (!pushToken) {
        showToast('تم حفظ موقعك. يمكنك تفعيل الإشعارات لاحقاً من الإعدادات.');
        return;
      }

      showToast('تم ربط حسابك بموقعك وتفعيل الإشعارات ✓');
    } catch (error: any) {
      setLocationSetupMessage(error?.message || 'تعذر إكمال الإعداد. حاول مرة أخرى.');
    } finally {
      setLocationSetupBusy(false);
    }
  }

  async function enableRequiredNotifications() {
    if (locationSetupBusy) return;
    setLocationSetupBusy(true);
    setLocationSetupMessage('جارٍ طلب إذن الإشعارات…');
    try {
      const token = await registerPushToken();
      setLocationSetupOpen(false);
      if (!token) {
        showToast('تم الدخول. الإشعارات غير مفعلة ويمكن تفعيلها لاحقاً من الإعدادات.');
        return;
      }
      showToast('تم تفعيل إشعارات حيّك ✓');
    } finally {
      setLocationSetupBusy(false);
    }
  }

  return (
    <View style={styles.container}>

      {/* Mandatory first-login setup: location + notifications */}
      <Modal visible={locationSetupOpen} transparent animationType="fade" onRequestClose={() => {}}>
        <View style={styles.locationGateOverlay}>
          <View style={styles.locationGateCard}>
            <View style={styles.locationGateIcon}><MapPin size={28} color="#059669" /></View>
            <Text style={styles.locationGateTitle}>نحتاج موقعك قبل البدء</Text>
            <Text style={styles.locationGateText}>
              حدّد موقعك تلقائياً لربط حسابك بالمنطقة والمدينة والحي، ثم فعّل الإشعارات لتصلك أخبار وتنبيهات حيّك فوراً.
            </Text>

            <View style={styles.locationGateStatus}>
              <View style={styles.locationGateStatusRow}>
                <MapPin size={17} color="#059669" />
                <Text style={styles.locationGateStatusText}>
                  {selectedCity !== 'كل المدن' && selectedDistrict !== 'كل الأحياء'
                    ? `الموقع: ${selectedRegion} · ${selectedCity} · حي ${selectedDistrict}`
                    : 'الموقع غير مكتمل'}
                </Text>
              </View>
            </View>

            {!!locationSetupMessage && <Text style={styles.locationGateMessage}>{locationSetupMessage}</Text>}

            {selectedCity !== 'كل المدن' && selectedDistrict !== 'كل الأحياء' ? (
              <Pressable style={styles.locationGatePrimary} onPress={enableRequiredNotifications} disabled={locationSetupBusy}>
                {locationSetupBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.locationGatePrimaryText}>تفعيل الإشعارات والمتابعة</Text>}
              </Pressable>
            ) : (
              <Pressable style={styles.locationGatePrimary} onPress={setupRequiredLocation} disabled={locationSetupBusy}>
                {locationSetupBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.locationGatePrimaryText}>تحديد موقعي تلقائياً</Text>}
              </Pressable>
            )}

            <Text style={styles.locationGateRequired}>تحديد الموقع مطلوب. الإشعارات يمكن تفعيلها الآن أو لاحقاً من الإعدادات.</Text>
          </View>
        </View>
      </Modal>

      {/* Twitter-style new posts indicator */}
      {newPostsCount > 0 && !refreshing && (
        <Pressable
          style={styles.newPostsBanner}
          onPress={async () => {
            setNewPostsCount(0);
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        >
          <RefreshCw size={14} color="#fff" />
          <Text style={styles.newPostsBannerText}>
            {newPostsCount} استفسار جديد · اسحب للتحديث
          </Text>
        </Pressable>
      )}

      <ScrollView 
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={async () => { 
              setRefreshing(true);
              setNewPostsCount(0);
              await load(); 
              setRefreshing(false); 
            }} 
            tintColor="#059669"
            colors={['#059669']}
            progressBackgroundColor="#ecfdf5"
          />
        }
      >
        {/* ======================================================== */}
        {/* 1. ULTRA-SLEEK MODERN HEADER                            */}
        {/* ======================================================== */}
        <LinearGradient 
          colors={['#065f46', '#059669', '#10b981']} 
          start={{ x: 0, y: 0 }} 
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          {/* Top Bar: Brand, Location Select, Weather & Notification + Avatar */}
          <View style={styles.topNavRow}>
            {/* Left side actions (Notifications & Profile Avatar) */}
            <View style={styles.leftActions}>
              <Pressable onPress={() => router.push('/profile')} style={styles.avatarWrap}>
                {profile?.avatar_url ? (
                  <Image source={{ uri: profile.avatar_url }} style={styles.avatarImg} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={styles.avatarLetter}>{profile?.display_name?.[0] || 'ح'}</Text>
                  </View>
                )}
                {profile?.is_geoverified && (
                  <View style={styles.avatarVerifiedBadge}>
                    <ShieldCheck size={10} color="#fff" />
                  </View>
                )}
              </Pressable>

              <Pressable onPress={() => router.push('/notifications')} style={styles.iconCircleBtn}>
                <Bell size={20} color="#fff" />
                {unreadNotifCount > 0 && (
                  <View style={styles.notifBadge}>
                    <Text style={styles.notifBadgeText}>{unreadNotifCount > 9 ? '9+' : unreadNotifCount}</Text>
                  </View>
                )}
              </Pressable>
            </View>

            {/* Right side: App Brand & Location Selector */}
            <View style={styles.brandAndLocation}>
              <View style={styles.brandTitleRow}>
                <Image source={{ uri: logoUri }} style={styles.headerLogo} resizeMode="contain" />
              </View>

              {/* Location Selector Pill */}
              <Pressable
                style={styles.locationSelectorPill}
                onPress={() => setShowLocationModal(true)}
              >
                <ChevronDown size={14} color="#a7f3d0" />
                <Text style={styles.locationSelectorText} numberOfLines={1}>
                  {selectedCity === 'كل المدن'
                    ? 'كل مناطق المملكة'
                    : `${selectedCity}${selectedDistrict !== 'كل الأحياء' ? ` · حي ${selectedDistrict}` : ''}`}
                </Text>
                <MapPin size={13} color="#6ee7b7" />
              </Pressable>
            </View>
          </View>

          {/* Search Bar */}
          <View style={styles.searchBarContainer}>
            <View style={styles.searchBar}>
              <Search size={20} color="#94a3b8" />
              <TextInput 
                placeholder="ابحث عن استفسار أو طلب أو اسم جار..."
                placeholderTextColor="#94a3b8"
                style={styles.searchInput}
                accessibilityLabel="البحث في الاستفسارات والطلبات وأسماء الجيران"
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
              />
              {searchQuery.length > 0 ? (
                <Pressable onPress={() => setSearchQuery('')} style={styles.clearSearchBtn} accessibilityRole="button" accessibilityLabel="مسح البحث">
                  <X size={17} color="#64748b" />
                </Pressable>
              ) : (
                <Pressable style={styles.micBtn} onPress={() => router.push('/questions')}>
                  <Mic size={17} color="#059669" />
                </Pressable>
              )}
            </View>
          </View>
        </LinearGradient>

        {/* ======================================================== */}
        {/* 1.5 LIVE NEIGHBORHOOD ATMOSPHERE BAR (أجواء ونبض الحي)     */}
        {/* ======================================================== */}
        <View style={styles.atmosphereBar}>
          <View style={styles.atmoItem}>
            <CloudSun size={15} color="#059669" />
            <Text style={styles.atmoText} numberOfLines={1}>
              {currentWeather ? `${Math.round(currentWeather.temperature)}°C · ${describeWeatherCode(currentWeather.weatherCode)} · ${currentWeather.locationName}` : weatherLoading ? 'جارٍ جلب الطقس الحالي...' : 'الطقس غير متاح حالياً'}
            </Text>
          </View>
          <View style={styles.atmoDivider} />
          <View style={styles.atmoItem}>
            <Flame size={15} color="#f59e0b" />
            <Text style={styles.atmoText}>42 جار نشط الآن</Text>
          </View>
          <View style={styles.atmoDivider} />
          <View style={styles.atmoItem}>
            <ShieldCheck size={15} color="#059669" />
            <Text style={styles.atmoText}>حي آمن ومترابط</Text>
          </View>
        </View>

        {/* ======================================================== */}
        {/* 2. NEIGHBORHOOD STORIES (يوميات ومحطات الحي الفخمة)        */}
        {/* ======================================================== */}
        <View style={styles.storiesContainer}>
          {/* Stories Header Row */}
          <View style={styles.storiesHeaderRow}>
            <Pressable 
              style={styles.publishStoryHeaderBtn} 
              onPress={() => router.push('/create-story')}
            >
              <Plus size={14} color="#059669" />
              <Text style={styles.publishStoryHeaderText}>نشر يوميات</Text>
            </Pressable>

            <View style={styles.storiesTitleRow}>
              <View style={styles.storiesLiveBadge}>
                <View style={styles.storiesLivePulseDot} />
                <Text style={styles.storiesLiveText}>مباشر 24س</Text>
              </View>
              <Text style={styles.storiesSectionTitle}>يوميات الحي</Text>
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storiesScroll}>
            {/* User's Story Item */}
            <Pressable style={styles.storyBox} onPress={() => router.push('/create-story')}>
              <LinearGradient 
                colors={['#059669', '#10b981', '#34d399']} 
                style={styles.storyAddRing} 
                start={{ x: 0, y: 0 }} 
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.storyInnerBorder}>
                  {profile?.avatar_url ? (
                    <Image source={{ uri: profile.avatar_url }} style={styles.storyImg} />
                  ) : (
                    <View style={styles.storySelfPlaceholder}>
                      <Camera size={20} color="#059669" />
                    </View>
                  )}
                  <View style={styles.storySelfPlusBadge}>
                    <Plus size={11} color="#fff" strokeWidth={3} />
                  </View>
                </View>
              </LinearGradient>
              <Text style={styles.storyName}>أضف يومياتك</Text>
              <Text style={styles.storyDistrictSub}>قصتك أنت</Text>
            </Pressable>

            {/* Real Stories from DB */}
            {stories.map((story) => {
              const authorName = story.profiles?.display_name || story.profiles?.username || 'جار';
              const avatarUrl = story.profiles?.avatar_url;
              const isVerified = story.profiles?.is_verified;
              const isGeoVerified = story.profiles?.is_geoverified;
              return (
                <Pressable 
                  key={story.id} 
                  style={styles.storyBox} 
                  onPress={() => router.push({ pathname: '/story', params: { id: story.id } })}
                >
                  <LinearGradient 
                    colors={['#059669', '#10b981', '#3b82f6']} 
                    style={styles.storyGradientRing}
                    start={{ x: 0, y: 0 }} 
                    end={{ x: 1, y: 1 }}
                  >
                    <View style={styles.storyInnerBorder}>
                      {story.type === 'text' ? (
                        <View style={[styles.storyTextPreview, { backgroundColor: story.bg_color || '#059669' }]}>
                          <Text style={styles.storyTextPreviewLetter} numberOfLines={1}>
                            {story.content?.[0] || 'ق'}
                          </Text>
                        </View>
                      ) : avatarUrl ? (
                        <Image source={{ uri: avatarUrl }} style={styles.storyImg} />
                      ) : (
                        <View style={[styles.storyTextPreview, { backgroundColor: story.bg_color || '#059669' }]}>
                          <Text style={styles.storyTextPreviewLetter}>{authorName[0]}</Text>
                        </View>
                      )}
                    </View>
                    {(isVerified || isGeoVerified) && (
                      <View style={styles.storyVerifiedTag}>
                        <ShieldCheck size={9} color="#fff" />
                      </View>
                    )}
                  </LinearGradient>
                  <Text style={styles.storyName} numberOfLines={1}>{authorName}</Text>
                  <Text style={styles.storyDistrictSub} numberOfLines={1}>
                    {selectedDistrict !== 'كل الأحياء' ? selectedDistrict : 'جار الحي'}
                  </Text>
                </Pressable>
              );
            })}

          </ScrollView>
        </View>

        {/* ======================================================== */}
        {/* 4. EMERGENCY SOS BANNER (Live Urgent Neighborhood Alert) */}
        {/* ======================================================== */}
        {emergencyQuestions.length > 0 && (
          <View style={styles.emergencyHomeCard}>
            <View style={styles.emergencyHomeHeader}>
              <View style={styles.emergencyLiveBadge}>
                <Text style={styles.emergencyLiveText}>مباشر الآن</Text>
              </View>
              <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 6 }}>
                <Flame size={18} color="#dc2626" />
                <Text style={styles.emergencyHomeTitle}>تنبيه طارئ عاجل في الحي</Text>
              </View>
            </View>
            <Pressable
              onPress={() => router.push({ pathname: '/question', params: { id: emergencyQuestions[0].id } })}
              style={styles.emergencyContentBox}
            >
              <Text style={styles.emergencyQuestionTitle}>{emergencyQuestions[0].title}</Text>
              <Text style={styles.emergencyQuestionSub}>اضغط للتفاصيل والمساعدة الفورية من أهل الحي ←</Text>
            </Pressable>
          </View>
        )}

        {/* ======================================================== */}
        {/* 5. QUICK SERVICES GRID (خدمات وفزعة الحي)                */}
        {/* ======================================================== */}
        <View style={styles.servicesGrid}>
          <ServicePill 
            icon={<MessageCircle size={22} color="#059669" />} 
            bg="#ecfdf5" 
            label="اسأل الحي" 
            badge="فوري"
            badgeBg="#059669"
            onPress={() => router.push('/ask')} 
          />
          <ServicePill 
            icon={<Camera size={22} color="#8b5cf6" />} 
            bg="#f5f3ff" 
            label="يوميات الحي" 
            badge="24 ساعة"
            badgeBg="#7c3aed"
            onPress={() => router.push('/create-story')} 
          />
          <ServicePill 
            icon={<Wrench size={22} color="#16a34a" />} 
            bg="#f0fdf4" 
            label="إعارة أدوات" 
            badge="مجاني"
            badgeBg="#16a34a"
            onPress={() => {
              setActiveTab('tools');
              showToast('أدوات ومعدات متاحة للإعارة بين الجيران');
            }} 
          />
          <ServicePill 
            icon={<Briefcase size={22} color="#0284c7" />} 
            bg="#f0f9ff" 
            label="خدمات الحي" 
            badge="مهنيون"
            badgeBg="#0284c7"
            onPress={() => router.push('/services')} 
          />
          <ServicePill 
            icon={<Truck size={22} color="#d97706" />} 
            bg="#fffbeb" 
            label="فزعة وطلبات" 
            badge="تعاون"
            badgeBg="#d97706"
            onPress={() => router.push('/requests')} 
          />
          <ServicePill 
            icon={<Map size={22} color="#059669" />} 
            bg="#ecfdf5" 
            label="خريطة الحي" 
            badge="مباشر"
            badgeBg="#059669"
            onPress={() => router.push('/map')} 
          />
        </View>



        {/* ======================================================== */}
        {/* 6. COMMUNITY FEED SECTION & TABS                        */}
        {/* ======================================================== */}
        <View style={styles.feedSection}>
          {/* Twitter-style Filter Pills */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.floatingTabs}>
            <Pressable 
              style={[styles.fTab, activeTab === 'all' && styles.fTabActive]} 
              onPress={() => setActiveTab('all')}
            >
              <View style={styles.fTabLabelRow}>
                <Map size={15} color={activeTab === 'all' ? '#fff' : '#475569'} />
                <Text style={[styles.fTabText, activeTab === 'all' && styles.fTabTextActive]}>الكل</Text>
              </View>
            </Pressable>

            {/* My posts filter */}
            <Pressable 
              style={[styles.fTab, activeTab === 'mine' && styles.fTabActiveMine]} 
              onPress={() => setActiveTab('mine')}
            >
              <View style={styles.fTabLabelRow}>
                <User size={15} color={activeTab === 'mine' ? '#fff' : '#475569'} />
                <Text style={[styles.fTabText, activeTab === 'mine' && styles.fTabTextActive]}>منشوراتي ({myQuestions.length + myRequests.length})</Text>
              </View>
            </Pressable>

            {emergencyQuestions.length > 0 && (
              <Pressable 
                style={[styles.fTab, activeTab === 'emergency' && styles.fTabActiveRed]} 
                onPress={() => setActiveTab('emergency')}
              >
                <View style={styles.fTabLabelRow}>
                  <Flame size={15} color={activeTab === 'emergency' ? '#fff' : '#475569'} />
                  <Text style={[styles.fTabText, activeTab === 'emergency' && styles.fTabTextActive]}>طوارئ ({emergencyQuestions.length})</Text>
                </View>
              </Pressable>
            )}

            <Pressable 
              style={[styles.fTab, activeTab === 'tools' && styles.fTabActiveGreen]} 
              onPress={() => setActiveTab('tools')}
            >
              <View style={styles.fTabLabelRow}>
                <Wrench size={15} color={activeTab === 'tools' ? '#fff' : '#475569'} />
                <Text style={[styles.fTabText, activeTab === 'tools' && styles.fTabTextActive]}>إعارة ({toolQuestions.length})</Text>
              </View>
            </Pressable>

            <Pressable 
              style={[styles.fTab, activeTab === 'questions' && styles.fTabActive]} 
              onPress={() => setActiveTab('questions')}
            >
              <View style={styles.fTabLabelRow}>
                <MessageCircle size={15} color={activeTab === 'questions' ? '#fff' : '#475569'} />
                <Text style={[styles.fTabText, activeTab === 'questions' && styles.fTabTextActive]}>استفسارات ({filteredQuestions.length})</Text>
              </View>
            </Pressable>

            <Pressable 
              style={[styles.fTab, activeTab === 'requests' && styles.fTabActive]} 
              onPress={() => setActiveTab('requests')}
            >
              <View style={styles.fTabLabelRow}>
                <Truck size={15} color={activeTab === 'requests' ? '#fff' : '#475569'} />
                <Text style={[styles.fTabText, activeTab === 'requests' && styles.fTabTextActive]}>فزعة ({filteredRequests.length})</Text>
              </View>
            </Pressable>
          </ScrollView>

          {/* Render Twitter-Style Progressive Feed */}
          {activeTab === 'all' && (
            [
              ...filteredQuestions.map(q => ({ type: 'question' as const, data: q })),
              ...filteredRequests.map(r => ({ type: 'request' as const, data: r }))
            ]
              .sort((a, b) => new Date(b.data.created_at).getTime() - new Date(a.data.created_at).getTime())
              .map(item => (
                <TwitterInquiryCard 
                  key={`${item.type}-${item.data.id}`} 
                  type={item.type} 
                  data={item.data} 
                  currentUserProfile={profile}
                  currentUserId={currentUserId}
                  onQuickReply={handleQuickReplySubmit}
                  onToast={showToast}
                />
              ))
          )}

          {activeTab === 'emergency' && emergencyQuestions.map(q => (
            <TwitterInquiryCard 
              key={`em-${q.id}`} 
              type="question" 
              data={q} 
              currentUserProfile={profile}
              currentUserId={currentUserId}
              onQuickReply={handleQuickReplySubmit}
              onToast={showToast}
            />
          ))}

          {activeTab === 'tools' && toolQuestions.map(q => (
            <TwitterInquiryCard 
              key={`tool-${q.id}`} 
              type="question" 
              data={q} 
              currentUserProfile={profile}
              currentUserId={currentUserId}
              onQuickReply={handleQuickReplySubmit}
              onToast={showToast}
            />
          ))}

          {activeTab === 'questions' && filteredQuestions.map(q => (
            <TwitterInquiryCard 
              key={`q-${q.id}`} 
              type="question" 
              data={q} 
              currentUserProfile={profile}
              currentUserId={currentUserId}
              onQuickReply={handleQuickReplySubmit}
              onToast={showToast}
            />
          ))}

          {activeTab === 'requests' && filteredRequests.map(r => (
            <TwitterInquiryCard 
              key={`r-${r.id}`} 
              type="request" 
              data={r} 
              currentUserProfile={profile}
              currentUserId={currentUserId}
              onQuickReply={handleQuickReplySubmit}
              onToast={showToast}
            />
          ))}

          {/* My Posts Tab */}
          {activeTab === 'mine' && (
            [
              ...filteredMyQuestions.map(q => ({ type: 'question' as const, data: q })),
              ...filteredMyRequests.map(r => ({ type: 'request' as const, data: r }))
            ]
              .sort((a, b) => new Date(b.data.created_at).getTime() - new Date(a.data.created_at).getTime())
              .map(item => (
                <TwitterInquiryCard 
                  key={`mine-${item.type}-${item.data.id}`} 
                  type={item.type} 
                  data={item.data} 
                  currentUserProfile={profile}
                  currentUserId={currentUserId}
                  isMine={true}
                  onQuickReply={handleQuickReplySubmit}
                  onToast={showToast}
                />
              ))
          )}

          {activeTab === 'mine' && filteredMyQuestions.length === 0 && filteredMyRequests.length === 0 && (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBg}>
                <User size={36} color="#059669" />
              </View>
              <Text style={styles.emptyTitle}>{normalizedSearch ? 'لا توجد منشورات تطابق البحث' : 'لا توجد منشورات بعد'}</Text>
              <Text style={styles.emptySub}>{normalizedSearch ? 'جرّب كلمة أخرى أو امسح البحث.' : 'استفساراتك وطلباتك ستظهر هنا عند نشرها في الحي.'}</Text>
              {!normalizedSearch && <Pressable style={styles.emptyAskBtn} onPress={() => router.push('/ask')}>
                <Text style={styles.emptyAskBtnText}>انشر أول استفسار لك</Text>
              </Pressable>}
            </View>
          )}

          {/* Empty States */}
          {activeTab === 'all' && filteredQuestions.length === 0 && filteredRequests.length === 0 && (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBg}>
                <Sparkles size={36} color="#059669" />
              </View>
              <Text style={styles.emptyTitle}>
                {normalizedSearch ? 'لا توجد نتائج مطابقة للبحث' : selectedCity === 'كل المدن' ? 'لا توجد استفسارات حالياً' : `لا توجد استفسارات في ${selectedCity} حالياً`}
              </Text>
              <Text style={styles.emptySub}>
                {normalizedSearch ? 'جرّب كلمات أخرى أو امسح البحث لعرض جميع المنشورات.' : 'كن المبادر الأول في حيك واطرح سؤالاً أو اعرض مساعدة لجيرانك بأسلوب خيط المحادثات.'}
              </Text>
              <Pressable style={styles.emptyAskBtn} onPress={() => router.push('/ask')}>
                <Text style={styles.emptyAskBtnText}>اسأل أهل حيك الآن</Text>
              </Pressable>
            </View>
          )}

          {activeTab === 'emergency' && emergencyQuestions.length === 0 && (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBg}>
                <ShieldCheck size={36} color="#16a34a" />
              </View>
              <Text style={styles.emptyTitle}>{normalizedSearch ? 'لا توجد نتائج طوارئ مطابقة' : 'الحمد لله، لا توجد طوارئ'}</Text>
              <Text style={styles.emptySub}>{normalizedSearch ? 'جرّب كلمات أخرى أو امسح البحث.' : 'الحي آمن ومستقر بفضل الله.'}</Text>
            </View>
          )}

          {activeTab === 'tools' && toolQuestions.length === 0 && (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBg}>
                <Wrench size={36} color="#16a34a" />
              </View>
              <Text style={styles.emptyTitle}>{normalizedSearch ? 'لا توجد عروض إعارة مطابقة' : 'لا توجد عروض إعارة حالياً'}</Text>
              <Text style={styles.emptySub}>{normalizedSearch ? 'جرّب كلمات أخرى أو امسح البحث.' : 'هل لديك سلم أو دريل أو أدوات ترغب بإعارتها لجيرانك؟'}</Text>
              {!normalizedSearch && <Pressable style={[styles.emptyAskBtn, { backgroundColor: '#16a34a' }]} onPress={() => router.push('/ask')}>
                <Text style={styles.emptyAskBtnText}>اعرض أداة للإعارة المجانية</Text>
              </Pressable>}
            </View>
          )}

          {activeTab === 'questions' && filteredQuestions.length === 0 && (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBg}>
                <MessageCircle size={36} color="#059669" />
              </View>
              <Text style={styles.emptyTitle}>{normalizedSearch ? 'لا توجد استفسارات مطابقة' : 'لا توجد استفسارات حالياً'}</Text>
              <Text style={styles.emptySub}>{normalizedSearch ? 'جرّب كلمات أخرى أو امسح البحث.' : 'اطرح سؤالك الأول لأهل الحي وتلقى ردوداً وتوصيات مجربة.'}</Text>
              {!normalizedSearch && <Pressable style={styles.emptyAskBtn} onPress={() => router.push('/ask')}>
                <Text style={styles.emptyAskBtnText}>اطرح سؤالك الآن</Text>
              </Pressable>}
            </View>
          )}

          {activeTab === 'requests' && filteredRequests.length === 0 && (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconBg}>
                <Truck size={36} color="#d97706" />
              </View>
              <Text style={styles.emptyTitle}>{normalizedSearch ? 'لا توجد طلبات مطابقة' : 'لا توجد طلبات فزعة حالياً'}</Text>
              <Text style={styles.emptySub}>{normalizedSearch ? 'جرّب كلمات أخرى أو امسح البحث.' : 'شارك جيرانك أي مساعدة تحتاجها وسيقف أهل حيك بجانبك.'}</Text>
            </View>
          )}

          <View style={{ height: 130 }} />
        </View>
      </ScrollView>

      {/* Floating Ask Button (above bottom nav) */}
      <Animated.View style={[styles.fabContainer, { transform: [{ scale: pulseAnim }] }]}>
        <Pressable style={styles.fabBtn} onPress={() => router.push('/ask')}>
          <LinearGradient colors={['#065f46', '#059669', '#10b981']} style={styles.fabGrad} start={{x:0, y:0}} end={{x:1, y:1}}>
            <Plus size={20} color="#fff" />
            <Text style={styles.fabText}>اسأل أهل حيك</Text>
          </LinearGradient>
        </Pressable>
      </Animated.View>

      {/* Bottom Navigation */}
      <View style={styles.bottomNavWrapper}>
        <BottomNav />
      </View>

      {/* Saudi Regions & Districts Selector Modal */}
      <LocationSelectorModal
        visible={showLocationModal}
        onClose={() => setShowLocationModal(false)}
        selectedCity={selectedCity}
        selectedDistrict={selectedDistrict}
        onSelect={(region, city, district) => {
          setSelectedRegion(region);
          setSelectedCity(city);
          setSelectedDistrict(district);
          if (!region || !city || !district || city === 'كل المدن' || district === 'كل الأحياء' || district === 'كل أحياء المدينة') {
            showToast('حدد المنطقة والمدينة والحي لإكمال موقعك');
            return;
          }
          void savePermanentMyLocation({ region, city, district }, true);
        }}
      />
    </View>
  );
}

// ========================================================
// HELPER COMPONENTS
// ========================================================

function normalizeSearchText(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLocaleLowerCase('ar')
    .trim()
    .replace(/\s+/g, ' ');
}

function ServicePill({
  icon,
  bg,
  label,
  badge,
  badgeBg,
  onPress,
}: {
  icon: any;
  bg: string;
  label: string;
  badge?: string;
  badgeBg?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable style={styles.servicePill} onPress={onPress}>
      <View style={[styles.serviceIconBox, { backgroundColor: bg }]}>
        {icon}
        {badge ? (
          <View style={[styles.servicePillBadge, badgeBg ? { backgroundColor: badgeBg } : {}]}>
            <Text style={styles.servicePillBadgeText}>{badge}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.serviceLabel} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

// ========================================================
// STYLESHEET
// ========================================================

const styles = StyleSheet.create({
  locationPromptBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.48)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  locationPromptCard: { width: '100%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 24, padding: 22, alignItems: 'center' },
  locationPromptTitle: { marginTop: 10, fontSize: 18, fontWeight: '900', color: '#064e3b', textAlign: 'center' },
  locationPromptText: { marginTop: 8, fontSize: 13, lineHeight: 21, color: '#475569', textAlign: 'center' },
  locationPromptActions: { width: '100%', flexDirection: 'row-reverse', gap: 10, marginTop: 18 },
  locationPromptAllow: { flex: 1, backgroundColor: '#059669', borderRadius: 14, padding: 13, alignItems: 'center' },
  locationPromptAllowText: { color: '#fff', fontWeight: '900' },
  locationPromptLater: { flex: 1, backgroundColor: '#f1f5f9', borderRadius: 14, padding: 13, alignItems: 'center' },
  locationPromptLaterText: { color: '#475569', fontWeight: '900' },
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  hero: {
    paddingTop: Platform.OS === 'ios' ? 52 : 38,
    paddingBottom: 22,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  topNavRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  brandAndLocation: {
    alignItems: 'flex-end',
  },
  brandTitleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  headerLogo: {
    width: 38,
    height: 38,
    marginLeft: 7,
  },
  locationSelectorPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  locationSelectorText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    maxWidth: 200,
  },
  leftActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarWrap: {
    position: 'relative',
  },
  avatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  avatarLetter: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '900',
  },
  avatarVerifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#16a34a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  iconCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#ef4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  notifBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '900',
  },
  searchBarContainer: {
    paddingHorizontal: 20,
  },
  searchBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingHorizontal: 14,
    height: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0f172a',
    textAlign: 'right',
  },
  micBtn: {
    padding: 6,
  },
  clearSearchBtn: {
    padding: 6,
  },
  // Atmosphere & Neighborhood Pulse Bar
  atmosphereBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: -14,
    marginBottom: 12,
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    zIndex: 10,
  },
  atmoItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  atmoText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#334155',
  },
  atmoDivider: {
    width: 1,
    height: 16,
    backgroundColor: '#e2e8f0',
  },

  // Upgraded Stories Section
  storiesContainer: {
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  storiesHeaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  storiesTitleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  storiesSectionTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#0f172a',
  },
  storiesLiveBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    gap: 4,
  },
  storiesLivePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  storiesLiveText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#059669',
  },
  publishStoryHeaderBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 10,
    paddingVertical: 4.5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    gap: 4,
  },
  publishStoryHeaderText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#059669',
  },
  storiesScroll: {
    paddingHorizontal: 16,
    gap: 14,
    alignItems: 'flex-start',
  },
  storyBox: {
    alignItems: 'center',
    width: 68,
  },
  storyAddRing: {
    width: 66,
    height: 66,
    borderRadius: 33,
    padding: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },
  storyGradientRing: {
    width: 66,
    height: 66,
    borderRadius: 33,
    padding: 2.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
    position: 'relative',
  },
  storyInnerBorder: {
    width: '100%',
    height: '100%',
    borderRadius: 31,
    borderWidth: 2,
    borderColor: '#fff',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    position: 'relative',
  },
  storySelfPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#ecfdf5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  storySelfPlusBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#059669',
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  storyImg: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
  },
  storyTextPreview: {
    width: '100%',
    height: '100%',
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storyTextPreviewLetter: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
  },
  storyVerifiedTag: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#16a34a',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#fff',
  },
  storyName: {
    fontSize: 11,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
  },
  storyDistrictSub: {
    fontSize: 9.5,
    color: '#64748b',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 1,
  },

  // Service Pill Badges
  servicePillBadge: {
    position: 'absolute',
    top: -5,
    right: -6,
    backgroundColor: '#059669',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#fff',
    zIndex: 5,
  },
  servicePillBadgeText: {
    color: '#fff',
    fontSize: 7.5,
    fontWeight: '900',
  },
  emergencyHomeCard: {
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: '#fef2f2',
    borderRadius: 18,
    padding: 14,
    borderWidth: 2,
    borderColor: '#fca5a5',
  },
  emergencyHomeHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  emergencyHomeTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#dc2626',
  },
  emergencyLiveBadge: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  emergencyLiveText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
  },
  emergencyContentBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  emergencyQuestionTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#991b1b',
    textAlign: 'right',
  },
  emergencyQuestionSub: {
    fontSize: 11,
    color: '#dc2626',
    textAlign: 'right',
    marginTop: 3,
  },
  servicesGrid: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginTop: 14,
    marginBottom: 8,
  },
  servicePill: {
    alignItems: 'center',
    width: (width - 48) / 6,
  },
  serviceIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  serviceLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#334155',
    textAlign: 'center',
  },
  feedSection: {
    marginTop: 12,
    paddingHorizontal: 16,
  },
  floatingTabs: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginBottom: 14,
    paddingVertical: 4,
  },
  fTab: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: '#e2e8f0',
  },
  fTabActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  fTabActiveRed: {
    backgroundColor: '#dc2626',
    borderColor: '#dc2626',
  },
  fTabActiveGreen: {
    backgroundColor: '#16a34a',
    borderColor: '#16a34a',
  },
  fTabActiveMine: {
    backgroundColor: '#7c3aed',
    borderColor: '#7c3aed',
  },
  fTabText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
  },
  fTabLabelRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  fTabTextActive: {
    color: '#fff',
  },
  // Empty state & FAB
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderRadius: 20,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  emptyIconBg: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ecfdf5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1e293b',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 13,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  emptyAskBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
  },
  emptyAskBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  fabContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 95 : 82,
    left: 20,
    zIndex: 99,
    borderRadius: 30,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  fabBtn: {
    borderRadius: 30,
  },
  fabGrad: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 30,
    gap: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  fabText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '900',
  },
  locationGateOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.62)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
  },
  locationGateCard: {
    width: '100%',
    maxWidth: 430,
    backgroundColor: '#fff',
    borderRadius: 28,
    padding: 24,
    alignItems: 'stretch',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.2,
    shadowRadius: 28,
    elevation: 12,
  },
  locationGateIcon: {
    alignSelf: 'center',
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#ecfdf5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  locationGateTitle: {
    color: '#0f172a',
    fontSize: 22,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 9,
  },
  locationGateText: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 16,
  },
  locationGateStatus: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 13,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 12,
  },
  locationGateStatusRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  locationGateStatusText: {
    flex: 1,
    color: '#334155',
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
  },
  locationGateMessage: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 12,
  },
  locationGatePrimary: {
    minHeight: 52,
    borderRadius: 16,
    backgroundColor: '#059669',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  locationGatePrimaryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
  },
  locationGateRequired: {
    color: '#94a3b8',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 11,
  },

  bottomNavWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },


});
